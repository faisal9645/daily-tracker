import React, { useState, useEffect, useRef } from 'react';
import { CalendarView, Task, Priority } from './types';
import { formatDateString, parseDateString, DEFAULT_CATEGORIES } from './utils';
import TaskStats from './components/TaskStats';
import CalendarDaily from './components/CalendarDaily';
import CalendarMonthly from './components/CalendarMonthly';
import CalendarYearly from './components/CalendarYearly';
import UserAvatar from './components/UserAvatar';
import {
  CalendarDays,
  Calendar,
  CheckCircle,
  FileCheck2,
  Clock,
  Plus,
  X,
  Info,
  LogOut,
  RefreshCw,
  Settings,
  Trash2,
  Bell,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, onSnapshot, setDoc, doc, deleteDoc, writeBatch, getDoc, getDocsFromServer } from 'firebase/firestore';
import { auth, db, ensureGoogleProfilePhoto, getUserPhotoURL, isGoogleUser, signInWithGoogle, signOutUser, handleFirestoreError, OperationType } from './firebase';
import {
  getNotificationPermissionStatus,
  getScheduledReminderCount,
  initNotificationListeners,
  isNativeNotificationsSupported,
  requestNotificationPermissions,
  scheduleTestNotification,
  syncTaskNotifications,
  type NotificationPermissionStatus,
} from './services/notifications';
import { App as CapacitorApp } from '@capacitor/app';

const TASK_STORAGE_KEY = 'calendar_task_tracker_item_v4';
const LOCAL_IMPORT_DONE_KEY = 'planflow_local_import_done';
const OLD_TASK_STORAGE_KEYS = [
  'calendar_task_tracker_item_v2',
  'calendar_task_tracker_item_v3',
];

export default function App() {
  const [currentView, setCurrentView] = useState<CalendarView>('monthly');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'completed' | 'pending'>('all');
  
  // Quick Add Overlay modal state
  const [quickAddDate, setQuickAddDate] = useState<string | null>(null);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickCategory, setQuickCategory] = useState('Personal');
  const [quickPriority, setQuickPriority] = useState<Priority>('medium');

  // Multi-device cloud sync auth states
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profilePhotoURL, setProfilePhotoURL] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [signInLoading, setSignInLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearDataLoading, setClearDataLoading] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [notificationStatus, setNotificationStatus] = useState<NotificationPermissionStatus>('unsupported');
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [scheduledReminderCount, setScheduledReminderCount] = useState(0);
  const suppressLocalImportRef = useRef(false);
  const clearingDataRef = useRef(false);
  const lastClearAtRef = useRef(0);

  useEffect(() => {
    OLD_TASK_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
  }, []);

  useEffect(() => {
    if (!isNativeNotificationsSupported()) return undefined;

    return initNotificationListeners((_taskId, date) => {
      if (date) {
        setSelectedDate(parseDateString(date));
        setCurrentView('daily');
      }
    });
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;

    syncTaskNotifications(tasks)
      .then((count) => setScheduledReminderCount(count))
      .catch((error) => {
        console.error('Failed to sync task notifications:', error);
      });
  }, [tasks, user, authLoading]);

  useEffect(() => {
    if (!isNativeNotificationsSupported()) return undefined;

    const resumeListener = CapacitorApp.addListener('resume', () => {
      if (!user) return;
      syncTaskNotifications(tasks)
        .then((count) => setScheduledReminderCount(count))
        .catch((error) => console.error('Failed to refresh reminders on resume:', error));
    });

    return () => {
      void resumeListener.then((listener) => listener.remove());
    };
  }, [tasks, user]);

  useEffect(() => {
    if (!settingsOpen || !isNativeNotificationsSupported()) return;

    Promise.all([
      getNotificationPermissionStatus(),
      getScheduledReminderCount(),
    ]).then(([status, count]) => {
      setNotificationStatus(status);
      setScheduledReminderCount(count);
    });
  }, [settingsOpen, tasks]);

  // Auth Status and Profile Registration Listener
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && !isGoogleUser(firebaseUser)) {
        await signOutUser();
        setUser(null);
        setProfilePhotoURL(null);
        setAuthError('Please sign in with your Google account to continue.');
        setAuthLoading(false);
        return;
      }

      if (firebaseUser) {
        const syncedUser = await ensureGoogleProfilePhoto(firebaseUser);
        setUser(syncedUser);
        setAuthLoading(false);
        setAuthError(null);

        const userRef = doc(db, 'users', syncedUser.uid);
        let storedPhotoURL: string | null = null;
        try {
          const userSnap = await getDoc(userRef);
          storedPhotoURL = userSnap.exists() ? (userSnap.data().photoURL as string | undefined) || null : null;

          const resolvedPhotoURL = getUserPhotoURL(syncedUser, storedPhotoURL);
          setProfilePhotoURL(resolvedPhotoURL);

          await setDoc(
            userRef,
            {
              userId: syncedUser.uid,
              email: syncedUser.email || '',
              displayName: syncedUser.displayName || '',
              photoURL: resolvedPhotoURL || '',
              createdAt: userSnap.exists() ? userSnap.data().createdAt : new Date().toISOString(),
            },
            { merge: true },
          );
        } catch (error) {
          console.error('Error writing user profile:', error);
          setProfilePhotoURL(getUserPhotoURL(syncedUser, storedPhotoURL));
        }

        if (isNativeNotificationsSupported()) {
          requestNotificationPermissions()
            .then((granted) => {
              if (granted) {
                getNotificationPermissionStatus().then(setNotificationStatus);
              }
            })
            .catch((error) => console.error('Notification permission error:', error));
        }
      } else {
        setUser(null);
        setProfilePhotoURL(null);
        setAuthLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Sync real-time task items for signed-in Google users
  useEffect(() => {
    if (authLoading || !user) return;

    const tasksRef = collection(db, 'users', user.uid, 'tasks');
    const unsubscribeTasks = onSnapshot(tasksRef, (snapshot) => {
      const fetchedTasks: Task[] = [];
      snapshot.forEach((docSnap) => {
        fetchedTasks.push({
          id: docSnap.id,
          ...docSnap.data()
        } as Task);
      });

      const recentlyCleared = Date.now() - lastClearAtRef.current < 10000;

      // Firestore emits cached docs first; ignore stale cache after a clear.
      if (
        fetchedTasks.length > 0 &&
        snapshot.metadata.fromCache &&
        (clearingDataRef.current || recentlyCleared)
      ) {
        return;
      }

      if (clearingDataRef.current && !snapshot.metadata.fromCache && fetchedTasks.length === 0) {
        clearingDataRef.current = false;
      }

      // One-time local -> cloud migration after first Google sign-in
      const shouldAttemptLocalImport =
        fetchedTasks.length === 0 &&
        !clearingDataRef.current &&
        !suppressLocalImportRef.current &&
        !localStorage.getItem(LOCAL_IMPORT_DONE_KEY);

      if (shouldAttemptLocalImport) {
        const localSaved = localStorage.getItem(TASK_STORAGE_KEY);
        if (localSaved) {
          try {
            const localTasks = JSON.parse(localSaved) as Task[];
            if (localTasks.length > 0) {
              const batch = writeBatch(db);
              localTasks.forEach((t) => {
                const taskId = typeof t.id === 'string' && t.id.trim() ? t.id : `task-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
                const docRef = doc(db, 'users', user.uid, 'tasks', taskId);

                const title = typeof t.title === 'string' ? t.title.substring(0, 200) : 'Untitled';
                const description = typeof t.description === 'string' ? t.description.substring(0, 1000) : '';
                const date = typeof t.date === 'string' && t.date.length === 10 ? t.date : new Date().toISOString().split('T')[0];
                const time = typeof t.time === 'string' ? t.time.substring(0, 5) : '';
                const completed = typeof t.completed === 'boolean' ? t.completed : false;

                let priority = 'medium';
                if (t.priority === 'low' || t.priority === 'medium' || t.priority === 'high') {
                  priority = t.priority;
                }

                const category = typeof t.category === 'string' ? t.category.substring(0, 100) : 'Other';
                const duration = typeof t.duration === 'number' && t.duration >= 0 && t.duration <= 1440 ? t.duration : 0;

                const isGoal = typeof t.isGoal === 'boolean' ? t.isGoal : false;
                const deadline = typeof t.deadline === 'string' && t.deadline.length === 10 ? t.deadline : undefined;

                const docData: any = {
                  title,
                  description,
                  date,
                  time,
                  completed,
                  priority,
                  category,
                  duration,
                  createdAt: new Date().toISOString()
                };
                if (isGoal) docData.isGoal = isGoal;
                if (deadline) docData.deadline = deadline;

                batch.set(docRef, docData);
              });
              batch.commit()
                .then(() => {
                  localStorage.removeItem(TASK_STORAGE_KEY);
                  localStorage.setItem(LOCAL_IMPORT_DONE_KEY, '1');
                })
                .catch(e => console.error("Cloud batch update failed:", e));
            } else {
              localStorage.setItem(LOCAL_IMPORT_DONE_KEY, '1');
            }
          } catch (err) {
            console.error("Task parsing error on offline backup sync:", err);
            localStorage.setItem(LOCAL_IMPORT_DONE_KEY, '1');
          }
        }
      }

      setTasks(fetchedTasks.sort((a, b) => b.id.localeCompare(a.id)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/tasks`);
    });

    return () => unsubscribeTasks();
  }, [user, authLoading]);

  // Sync Action Handlers
  const handleAddTask = async (newTaskData: Omit<Task, 'id' | 'completed'> | Omit<Task, 'id' | 'completed'>[]) => {
    if (!user) return;

    try {
      const batch = writeBatch(db);
      const dataArray = Array.isArray(newTaskData) ? newTaskData : [newTaskData];
      
      dataArray.forEach((data, index) => {
        const taskId = `task-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 4)}`;
        const docRef = doc(db, 'users', user.uid, 'tasks', taskId);
        const docData: any = {
          title: data.title,
          description: data.description || '',
          date: data.date,
          time: data.time || '',
          completed: false,
          priority: data.priority,
          category: data.category,
          duration: data.duration || 0,
          createdAt: new Date().toISOString()
        };
        if (data.isGoal !== undefined) docData.isGoal = !!data.isGoal;
        if (data.deadline !== undefined && data.deadline) docData.deadline = data.deadline;

        batch.set(docRef, docData);
      });

      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}/tasks`);
    }
  };

  const handleToggleTask = async (id: string) => {
    if (!user) return;

    const taskToToggle = tasks.find((t) => t.id === id);
    if (!taskToToggle) return;

    const docRef = doc(db, 'users', user.uid, 'tasks', id);
    try {
      const docData: any = {
        title: taskToToggle.title,
        description: taskToToggle.description || '',
        date: taskToToggle.date,
        time: taskToToggle.time || '',
        completed: !taskToToggle.completed,
        priority: taskToToggle.priority,
        category: taskToToggle.category,
        duration: taskToToggle.duration || 0,
      };
      if (taskToToggle.isGoal !== undefined) docData.isGoal = taskToToggle.isGoal;
      if (taskToToggle.deadline !== undefined) docData.deadline = taskToToggle.deadline;

      await setDoc(docRef, docData, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/tasks/${id}`);
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (!user) return;

    const docRef = doc(db, 'users', user.uid, 'tasks', id);
    try {
      await deleteDoc(docRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/tasks/${id}`);
    }
  };

  const handleEditTask = async (id: string, updatedFields: Partial<Task>) => {
    if (!user) return;

    const taskToEdit = tasks.find((t) => t.id === id);
    if (!taskToEdit) return;

    const docRef = doc(db, 'users', user.uid, 'tasks', id);
    try {
      const { id: _, ...cleanFields } = updatedFields;
      await setDoc(docRef, cleanFields, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/tasks/${id}`);
    }
  };

  const jumpToDateString = (dateStr: string) => {
    setSelectedDate(parseDateString(dateStr));
    setCurrentView('daily');
  };

  const handleQuickAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim() || !quickAddDate) return;

    handleAddTask({
      title: quickTitle.trim(),
      date: quickAddDate,
      priority: quickPriority,
      category: quickCategory,
    });

    setQuickTitle('');
    setQuickAddDate(null);
  };

  const handleGoogleSignIn = async () => {
    setSignInLoading(true);
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : 'Google sign-in failed.';
      console.error('Auth sign-in error:', err);

      const lower = rawMessage.toLowerCase();
      if (
        lower.includes('no credential') ||
        (lower.includes('credential') && lower.includes('available')) ||
        lower.includes('id token') ||
        lower.includes('12500') ||
        lower.includes('10:')
      ) {
        setAuthError(
          'Google sign-in is not configured for this Android build yet. In Firebase Console, add your app SHA-1 fingerprint, download a new google-services.json, replace android/app/google-services.json, then rebuild the APK. Run: npm run android:sha',
        );
      } else {
        setAuthError(rawMessage);
      }
    } finally {
      setSignInLoading(false);
    }
  };

  const clearLocalTaskStorage = () => {
    [TASK_STORAGE_KEY, ...OLD_TASK_STORAGE_KEYS].forEach((key) => {
      localStorage.removeItem(key);
    });
    localStorage.setItem(LOCAL_IMPORT_DONE_KEY, '1');
  };

  const deleteAllTaskDocs = async (userId: string, docIds: string[]) => {
    if (docIds.length === 0) return;

    for (let i = 0; i < docIds.length; i += 500) {
      const batch = writeBatch(db);
      docIds.slice(i, i + 500).forEach((taskId) => {
        batch.delete(doc(db, 'users', userId, 'tasks', taskId));
      });
      await batch.commit();
    }
  };

  const handleClearAllData = async () => {
    if (!user) return;

    setClearDataLoading(true);
    setSettingsError(null);
    setSettingsMessage(null);

    const knownTaskIds = tasks.map((task) => task.id);
    const tasksRef = collection(db, 'users', user.uid, 'tasks');

    // Block cache rehydrate and local re-import before deletes run.
    clearingDataRef.current = true;
    lastClearAtRef.current = Date.now();
    suppressLocalImportRef.current = true;
    clearLocalTaskStorage();
    setTasks([]);

    try {
      const idsToDelete = new Set<string>(knownTaskIds);
      const serverSnapshot = await getDocsFromServer(tasksRef);
      serverSnapshot.docs.forEach((taskDoc) => idsToDelete.add(taskDoc.id));

      await deleteAllTaskDocs(user.uid, Array.from(idsToDelete));

      // Retry in case a pending local migration batch re-writes tasks.
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const remaining = await getDocsFromServer(tasksRef);
        if (remaining.empty) break;
        await deleteAllTaskDocs(
          user.uid,
          remaining.docs.map((taskDoc) => taskDoc.id),
        );
      }

      const finalSnapshot = await getDocsFromServer(tasksRef);
      if (!finalSnapshot.empty) {
        throw new Error(`Still ${finalSnapshot.size} tasks on server`);
      }

      setTasks([]);
      clearingDataRef.current = false;
      setShowClearConfirm(false);
      setSettingsMessage('All tasks have been deleted.');
    } catch (error) {
      console.error('Clear all data error:', error);
      setSettingsError('Failed to clear data. Please try again.');
      clearingDataRef.current = false;
    } finally {
      setClearDataLoading(false);
    }
  };

  const closeSettings = () => {
    setSettingsOpen(false);
    setShowClearConfirm(false);
    setSettingsError(null);
    setSettingsMessage(null);
  };

  const handleEnableNotifications = async () => {
    setNotificationLoading(true);
    setSettingsError(null);
    setSettingsMessage(null);
    try {
      const granted = await requestNotificationPermissions();
      const status = await getNotificationPermissionStatus();
      setNotificationStatus(status);
      if (!granted || status !== 'granted') {
        setSettingsError(
          'Allow notifications and Alarms & reminders for Planflow in Android Settings, then try again.',
        );
        return;
      }

      const count = await syncTaskNotifications(tasks);
      setScheduledReminderCount(count);
      setSettingsMessage(
        count > 0
          ? `${count} task reminder${count === 1 ? '' : 's'} scheduled on this device.`
          : 'Reminders enabled. Add a future task with a date/time to schedule alerts.',
      );
    } catch (error) {
      console.error('Notification permission error:', error);
      setSettingsError('Could not enable notifications. Please try again.');
    } finally {
      setNotificationLoading(false);
    }
  };

  const handleTestNotification = async () => {
    setNotificationLoading(true);
    setSettingsError(null);
    setSettingsMessage(null);
    try {
      await scheduleTestNotification();
      setSettingsMessage('Test notification will appear in about 15 seconds.');
    } catch (error) {
      console.error('Test notification error:', error);
      setSettingsError('Could not send test notification. Check Android notification settings.');
    } finally {
      setNotificationLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <RefreshCw size={24} className="animate-spin text-blue-900" />
          <p className="text-sm font-medium">Loading Planflow...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[100dvh] bg-slate-50 text-slate-900 font-sans antialiased flex items-center justify-center px-4 py-8 mobile-safe-top mobile-safe-bottom">
        <div className="absolute top-0 left-0 right-0 h-72 bg-linear-to-b from-blue-50/80 via-blue-50/20 to-transparent pointer-events-none" />
        <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-lg p-6 sm:p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-blue-900 flex items-center justify-center text-white shadow-xs mx-auto mb-5">
            <CalendarDays size={28} className="stroke-2" />
          </div>
          <h1 className="font-display font-bold text-2xl text-blue-950 tracking-tight">Planflow</h1>
          <p className="mt-2 text-sm text-slate-500">
            Sign in with Google to access your daily, monthly, and yearly task planner.
          </p>

          <button
            onClick={handleGoogleSignIn}
            disabled={signInLoading}
            className="touch-target mt-8 w-full flex items-center justify-center gap-3 px-4 py-3.5 border border-slate-200 bg-white active:bg-slate-50 active:scale-[0.99] transition rounded-xl text-sm font-semibold text-slate-700 shadow-2xs disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.223 36 24 36c-5.522 0-10-4.478-10-10s4.478-10 10-10c2.837 0 5.402 1.062 7.36 2.804l5.657-5.657C33.64 10.053 29.082 8 24 8 12.955 8 4 16.955 4 28s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
              <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 16.108 18.961 13 24 13c2.837 0 5.402 1.062 7.36 2.804l5.657-5.657C33.64 10.053 29.082 8 24 8 16.318 8 9.656 13.337 6.306 14.691z" />
              <path fill="#4CAF50" d="M24 48c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 39.091 26.715 40 24 40c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 43.556 16.227 48 24 48z" />
              <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-1.015 2.926-3.227 5.364-5.993 6.981l6.19 5.238C39.99 36.071 44 32.428 44 28c0-1.341-.138-2.65-.389-3.917z" />
            </svg>
            <span>{signInLoading ? 'Signing in...' : 'Continue with Google'}</span>
          </button>

          {authError && (
            <p className="mt-4 text-xs text-rose-600 font-medium">{authError}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-slate-50 text-slate-900 font-sans antialiased relative">
      {/* Visual background accents */}
      <div className="absolute top-0 left-0 right-0 h-64 bg-linear-to-b from-blue-50/70 via-blue-50/10 to-transparent pointer-events-none -z-10" />

      {/* Main Navbar */}
      <header className="mobile-safe-top border-b border-slate-200 bg-white/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 md:py-0 md:h-16">
          {/* Mobile top bar */}
          <div className="flex md:hidden items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-blue-900 flex items-center justify-center text-white shadow-xs shrink-0">
                <CalendarDays size={18} className="stroke-2" />
              </div>
              <div className="min-w-0">
                <h1 className="font-display font-bold text-base text-blue-950 tracking-tight truncate">Planflow</h1>
                <p className="text-[9px] text-slate-500 font-medium uppercase tracking-wide truncate">
                  {currentView === 'daily' ? 'Daily Planner' : currentView === 'monthly' ? 'Monthly Grid' : 'Yearly Heatmap'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => {
                  setSettingsOpen(true);
                  setShowClearConfirm(false);
                  setSettingsError(null);
                  setSettingsMessage(null);
                }}
                className="touch-target p-2 border border-slate-200 rounded-xl bg-white text-slate-600 active:bg-slate-50 transition"
                title="Settings"
              >
                <Settings size={16} />
              </button>
              <UserAvatar
                user={user}
                fallbackPhotoURL={profilePhotoURL}
                size="md"
                onClick={() => {
                  setSettingsOpen(true);
                  setShowClearConfirm(false);
                  setSettingsError(null);
                  setSettingsMessage(null);
                }}
              />
            </div>
          </div>

          {/* Desktop header */}
          <div className="hidden md:flex items-center justify-between gap-4 h-16">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-900 flex items-center justify-center text-white shadow-xs">
              <CalendarDays size={20} className="stroke-2" />
            </div>
            <div>
              <h1 className="font-display font-bold text-lg md:text-xl text-blue-950 tracking-tight">
                Planflow
              </h1>
              <p className="text-[10px] text-slate-500 font-medium tracking-wide uppercase">Daily • Monthly • Yearly Action Maps</p>
            </div>
          </div>

          {/* View Selection Controls */}
          <div className="flex items-center bg-slate-100 border border-slate-200 p-1 rounded-xl gap-1">
            <button
              onClick={() => setCurrentView('daily')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer select-none ${
                currentView === 'daily'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-blue-900 hover:bg-slate-50'
              }`}
            >
              <FileCheck2 size={13} />
              <span className="hidden sm:inline">Daily Planner</span>
              <span className="sm:hidden">Daily</span>
            </button>

            <button
              onClick={() => setCurrentView('monthly')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer select-none ${
                currentView === 'monthly'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-blue-900 hover:bg-slate-50'
              }`}
            >
              <Calendar size={13} />
              <span className="hidden sm:inline">Monthly Grid</span>
              <span className="sm:hidden">Monthly</span>
            </button>

            <button
              onClick={() => setCurrentView('yearly')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer select-none ${
                currentView === 'yearly'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-blue-900 hover:bg-slate-50'
              }`}
            >
              <CalendarDays size={13} />
              <span className="hidden sm:inline">Yearly Heatmap</span>
              <span className="sm:hidden">Yearly</span>
            </button>
          </div>

          {/* Account */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setSettingsOpen(true);
                setShowClearConfirm(false);
                setSettingsError(null);
                setSettingsMessage(null);
              }}
              className="p-2 border border-slate-200 rounded-xl bg-white text-slate-600 hover:text-blue-900 hover:bg-slate-50 active:scale-95 transition cursor-pointer shadow-2xs"
              title="Settings"
            >
              <Settings size={14} />
            </button>
            <div className="flex items-center gap-2 px-3 py-1.5 border border-emerald-200 bg-emerald-50 text-emerald-800 rounded-xl max-w-full select-none shadow-2xs">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="text-[9px] font-bold uppercase tracking-wider shrink-0">Google Account</span>
              <UserAvatar user={user} fallbackPhotoURL={profilePhotoURL} size="xs" />
              <button
                onClick={() => signOutUser().catch((err) => console.error('Sign out error:', err))}
                className="p-1 text-[10px] font-bold text-slate-500 hover:text-rose-600 active:scale-95 transition cursor-pointer"
                title="Sign Out"
              >
                <LogOut size={12} />
              </button>
            </div>
          </div>
          </div>
        </div>
      </header>

      {/* Mobile bottom navigation */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-slate-200 bg-white/95 backdrop-blur-lg mobile-safe-bottom shadow-[0_-4px_24px_rgba(15,23,42,0.08)]">
        <div className="grid grid-cols-3 gap-1 px-2 pt-2 pb-1">
          <button
            onClick={() => setCurrentView('daily')}
            className={`touch-target flex flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-bold transition ${
              currentView === 'daily' ? 'bg-blue-900 text-white' : 'text-slate-500 active:bg-slate-100'
            }`}
          >
            <FileCheck2 size={18} />
            Daily
          </button>
          <button
            onClick={() => setCurrentView('monthly')}
            className={`touch-target flex flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-bold transition ${
              currentView === 'monthly' ? 'bg-blue-900 text-white' : 'text-slate-500 active:bg-slate-100'
            }`}
          >
            <Calendar size={18} />
            Monthly
          </button>
          <button
            onClick={() => setCurrentView('yearly')}
            className={`touch-target flex flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-bold transition ${
              currentView === 'yearly' ? 'bg-blue-900 text-white' : 'text-slate-500 active:bg-slate-100'
            }`}
          >
            <CalendarDays size={18} />
            Yearly
          </button>
        </div>
      </nav>

      {/* Main Content Layout Container */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 mobile-page md:pb-6">
        
        {/* Dynamic Statistics Block */}
        <TaskStats
          tasks={tasks}
          activeFilter={activeFilter}
          onQuickFilterClick={(status) => {
            setActiveFilter(status);
            setCurrentView('daily');
          }}
        />

        {/* View Selection Section */}
        <div className="mt-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {currentView === 'daily' && (
                <CalendarDaily
                  currentDate={selectedDate}
                  onChangeDate={setSelectedDate}
                  tasks={tasks}
                  onAddTask={handleAddTask}
                  onToggleTask={handleToggleTask}
                  onDeleteTask={handleDeleteTask}
                  onEditTask={handleEditTask}
                />
              )}

              {currentView === 'monthly' && (
                <CalendarMonthly
                  currentDate={selectedDate}
                  onChangeDate={setSelectedDate}
                  tasks={tasks}
                  onSelectDay={jumpToDateString}
                  onQuickAddTask={(dateStr) => setQuickAddDate(dateStr)}
                />
              )}

              {currentView === 'yearly' && (
                <CalendarYearly
                  currentDate={selectedDate}
                  onChangeDate={setSelectedDate}
                  tasks={tasks}
                  onSelectDay={jumpToDateString}
                  onSelectMonth={(m) => {
                    setSelectedDate(new Date(selectedDate.getFullYear(), m, 1));
                    setCurrentView('monthly');
                  }}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="hidden md:block border-t border-slate-200 bg-white py-8 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-500 text-center sm:text-left">
            &copy; 2026 Planflow Task & Calendar Manager. Handcrafted offline-first workspace tool.
          </p>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
            <Info size={12} className="text-blue-900" />
            <span>Interactive clicking enabled on all calendar elements</span>
          </div>
        </div>
      </footer>

      {/* QUICK ADD ACTION DIALOG OVERLAY (MODAL) */}
      <AnimatePresence>
        {quickAddDate && (
          <div className="fixed inset-0 bg-blue-950/40 backdrop-blur-xs flex items-end sm:items-center justify-center z-50 p-3 sm:p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 12 }}
              className="bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 shadow-xl max-w-sm w-full p-5 sm:p-6 flex flex-col gap-4 relative mobile-modal mobile-safe-bottom"
            >
              <button
                onClick={() => setQuickAddDate(null)}
                className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X size={16} />
              </button>

              <div>
                <span className="text-[10px] font-bold text-blue-900 bg-blue-50 border border-blue-100 px-2.5 py-0.5 rounded-full uppercase">
                  Quick Add Action
                </span>
                <h4 className="font-display font-bold text-slate-900 mt-2">
                  Add task for {quickAddDate}
                </h4>
              </div>

              <form onSubmit={handleQuickAddSubmit} className="flex flex-col gap-3.5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Action Title *</label>
                  <input
                    id="quick-add-title-input"
                    type="text"
                    required
                    autoFocus
                    placeholder="e.g. Review milestone blueprints"
                    value={quickTitle}
                    onChange={(e) => setQuickTitle(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs focus:ring-1 focus:ring-blue-900 outline-hidden"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Category</label>
                    <select
                      id="quick-add-category-select"
                      value={quickCategory}
                      onChange={(e) => setQuickCategory(e.target.value)}
                      className="px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-1 focus:ring-blue-900 outline-hidden bg-white text-slate-950 cursor-pointer"
                    >
                      {Object.keys(DEFAULT_CATEGORIES).map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Urgency</label>
                    <select
                      id="quick-add-priority-select"
                      value={quickPriority}
                      onChange={(e) => setQuickPriority(e.target.value as Priority)}
                      className="px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-1 focus:ring-blue-900 outline-hidden bg-white text-slate-950 cursor-pointer"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                </div>

                <button
                  id="quick-add-submit-button"
                  type="submit"
                  className="bg-blue-900 hover:bg-blue-950 text-white font-bold text-[11px] uppercase tracking-wider py-2.5 rounded-xl transition cursor-pointer mt-2"
                >
                  Confirm Action
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SETTINGS MODAL */}
      <AnimatePresence>
        {settingsOpen && (
          <div className="fixed inset-0 bg-blue-950/40 backdrop-blur-xs flex items-end sm:items-center justify-center z-50 p-3 sm:p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 12 }}
              className="bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-5 sm:p-6 flex flex-col gap-5 relative mobile-modal mobile-safe-bottom"
            >
              <button
                onClick={closeSettings}
                className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X size={16} />
              </button>

              <div className="flex items-center gap-3">
                <UserAvatar user={user} fallbackPhotoURL={profilePhotoURL} size="lg" />
                <div>
                <span className="text-[10px] font-bold text-blue-900 bg-blue-50 border border-blue-100 px-2.5 py-0.5 rounded-full uppercase">
                  Settings
                </span>
                <h4 className="font-display font-bold text-slate-900 mt-2">Account & Data</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Signed in as {user.displayName || user.email}
                </p>
                </div>
              </div>

              {isNativeNotificationsSupported() && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Task Reminders</h5>
                  <p className="text-xs text-slate-600 mt-2">
                    Reminders fire 15 minutes before a timed task, or at 9:00 AM for tasks without a time.
                    {scheduledReminderCount > 0 && (
                      <span className="block mt-1 text-emerald-700 font-semibold">
                        {scheduledReminderCount} reminder{scheduledReminderCount === 1 ? '' : 's'} currently scheduled.
                      </span>
                    )}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border ${
                      notificationStatus === 'granted'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : notificationStatus === 'denied'
                          ? 'bg-rose-50 border-rose-200 text-rose-700'
                          : 'bg-amber-50 border-amber-200 text-amber-800'
                    }`}>
                      {notificationStatus === 'granted' ? 'Enabled' : notificationStatus === 'denied' ? 'Blocked' : 'Not enabled'}
                    </span>
                    {notificationStatus !== 'granted' && (
                      <button
                        onClick={handleEnableNotifications}
                        disabled={notificationLoading}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold transition cursor-pointer disabled:opacity-60"
                      >
                        <Bell size={14} />
                        {notificationLoading ? 'Enabling...' : 'Enable Reminders'}
                      </button>
                    )}
                  </div>
                  {notificationStatus === 'granted' && (
                    <button
                      onClick={handleTestNotification}
                      disabled={notificationLoading}
                      className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-blue-200 bg-blue-50 text-blue-900 hover:bg-blue-100 text-xs font-bold transition cursor-pointer disabled:opacity-60"
                    >
                      <Bell size={14} />
                      {notificationLoading ? 'Scheduling...' : 'Send Test Notification'}
                    </button>
                  )}
                </div>
              )}

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Data Management</h5>
                <p className="text-xs text-slate-600 mt-2">
                  Permanently delete all tasks from your cloud account and this device.
                </p>

                {!showClearConfirm ? (
                  <button
                    onClick={() => {
                      setShowClearConfirm(true);
                      setSettingsError(null);
                      setSettingsMessage(null);
                    }}
                    className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    <Trash2 size={14} />
                    Clear All Data
                  </button>
                ) : (
                  <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3">
                    <p className="text-xs text-rose-800 font-medium">
                      Delete all {tasks.length} task{tasks.length === 1 ? '' : 's'}? This cannot be undone.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => setShowClearConfirm(false)}
                        disabled={clearDataLoading}
                        className="flex-1 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 transition cursor-pointer disabled:opacity-60"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleClearAllData}
                        disabled={clearDataLoading}
                        className="flex-1 px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition cursor-pointer disabled:opacity-60"
                      >
                        {clearDataLoading ? 'Deleting...' : 'Delete All'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => signOutUser().catch((err) => console.error('Sign out error:', err))}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-200 bg-white text-slate-600 active:bg-slate-50 rounded-xl text-xs font-bold transition"
              >
                <LogOut size={14} />
                Sign Out
              </button>

              {settingsMessage && (
                <p className="text-xs text-emerald-700 font-medium">{settingsMessage}</p>
              )}
              {settingsError && (
                <p className="text-xs text-rose-600 font-medium">{settingsError}</p>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
