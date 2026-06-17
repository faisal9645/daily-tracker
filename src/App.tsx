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
  Sun,
  Moon,
  Smartphone,
  Maximize2,
  Wifi,
  Signal,
  Battery,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, onSnapshot, setDoc, doc, deleteDoc, writeBatch, getDoc, getDocsFromServer } from 'firebase/firestore';
import { auth, db, ensureGoogleProfilePhoto, formatAuthError, getUserPhotoURL, GOOGLE_SIGNIN_SETUP_HINT, handleGoogleRedirectResult, isAndroidGoogleSignInMisconfigured, isGoogleUser, signInWithGoogle, signOutUser, handleFirestoreError, OperationType } from './firebase';
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
import { Capacitor } from '@capacitor/core';

const isNativeApp = Capacitor.isNativePlatform();

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
  
  // Dark mode states
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('planflow_dark_mode');
    if (saved !== null) return saved === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Emulator display toggle (defaults to false for original desktop layout)
  const [useDeviceFrame, setUseDeviceFrame] = useState<boolean>(false);

  useEffect(() => {
    if (isNativeApp) setUseDeviceFrame(false);
  }, []);

  // Quick Add Overlay modal state
  const [quickAddDate, setQuickAddDate] = useState<string | null>(null);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickCategory, setQuickCategory] = useState('Personal');
  const [quickPriority, setQuickPriority] = useState<Priority>('medium');
  const [quickDesc, setQuickDesc] = useState('');
  const [quickTime, setQuickTime] = useState('');
  const [quickDuration, setQuickDuration] = useState('');
  const [quickIsGoal, setQuickIsGoal] = useState(false);
  const [quickDeadline, setQuickDeadline] = useState('');

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
  
  const [statusBarTime, setStatusBarTime] = useState('12:00');

  const suppressLocalImportRef = useRef(false);
  const clearingDataRef = useRef(false);
  const lastClearAtRef = useRef(0);

  // Sync System Theme with local state
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('planflow_dark_mode', String(darkMode));
  }, [darkMode]);

  // Update Status Bar Time
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setStatusBarTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

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
    let unsubscribeAuth = () => {};

    const initAuth = async () => {
      await handleGoogleRedirectResult();

      unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
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
    };

    void initAuth();

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

    const durationNum = quickDuration ? parseInt(quickDuration) : undefined;
    handleAddTask({
      title: quickTitle.trim(),
      description: quickDesc.trim() || undefined,
      date: quickAddDate,
      time: quickTime || undefined,
      priority: quickPriority,
      category: quickCategory,
      duration: durationNum,
      isGoal: quickIsGoal,
      deadline: quickIsGoal && quickDeadline ? quickDeadline : undefined
    });

    // Reset Form
    setQuickTitle('');
    setQuickDesc('');
    setQuickTime('');
    setQuickDuration('');
    setQuickIsGoal(false);
    setQuickDeadline('');
    setQuickAddDate(null);
  };

  const handleGoogleSignIn = async () => {
    setSignInLoading(true);
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      const rawMessage = formatAuthError(err);
      console.error('Auth sign-in error:', err);

      if (rawMessage === 'REDIRECT_PENDING') {
        setAuthError('Opening Google sign-in in your browser...');
        return;
      }

      if (isAndroidGoogleSignInMisconfigured(err)) {
        setAuthError(GOOGLE_SIGNIN_SETUP_HINT);
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
      <div className="h-full w-full bg-m3-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-m3-on-surface">
          <RefreshCw size={32} className="animate-spin text-m3-primary" />
          <p className="text-sm font-semibold tracking-wide font-display">Loading Planflow...</p>
        </div>
      </div>
    );
  }

  // Auth/Sign-in Screen
  if (!user) {
    return (
      <div className="h-full w-full overflow-y-auto bg-m3-background text-m3-on-background font-sans antialiased flex items-center justify-center px-4 py-8 relative">
        <div className="absolute top-0 left-0 right-0 h-80 bg-gradient-to-b from-m3-primary/10 via-transparent to-transparent pointer-events-none -z-10" />
        <div className="relative w-full max-w-md bg-m3-surface-container border border-m3-surface-variant/40 rounded-[32px] shadow-xl p-8 text-center my-auto">
          <div className="w-16 h-16 rounded-[24px] bg-m3-primary flex items-center justify-center text-m3-on-primary shadow-lg mx-auto mb-6">
            <CalendarDays size={32} className="stroke-2" />
          </div>
          <h1 className="font-display font-extrabold text-3xl text-m3-on-surface tracking-tight">Planflow</h1>
          <p className="mt-3 text-sm text-m3-on-surface-variant leading-relaxed">
            Welcome to Daily Tracker. Sign in with Google to sync your daily tasks, monthly grid, and yearly activity heatmap.
          </p>

          <button
            onClick={handleGoogleSignIn}
            disabled={signInLoading}
            className="mt-8 w-full flex items-center justify-center gap-4 px-5 py-4 border border-m3-outline/30 bg-m3-surface hover:bg-m3-surface-variant/30 active:scale-[0.98] transition-all duration-200 rounded-[20px] text-sm font-bold text-m3-on-surface shadow-xs disabled:opacity-50 cursor-pointer"
          >
            <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true" className="shrink-0">
              <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.223 36 24 36c-5.522 0-10-4.478-10-10s4.478-10 10-10c2.837 0 5.402 1.062 7.36 2.804l5.657-5.657C33.64 10.053 29.082 8 24 8 12.955 8 4 16.955 4 28s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
              <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 16.108 18.961 13 24 13c2.837 0 5.402 1.062 7.36 2.804l5.657-5.657C33.64 10.053 29.082 8 24 8 16.318 8 9.656 13.337 6.306 14.691z" />
              <path fill="#4CAF50" d="M24 48c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 39.091 26.715 40 24 40c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 43.556 16.227 48 24 48z" />
              <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-1.015 2.926-3.227 5.364-5.993 6.981l6.19 5.238C39.99 36.071 44 32.428 44 28c0-1.341-.138-2.65-.389-3.917z" />
            </svg>
            <span>{signInLoading ? 'Signing in...' : 'Sign in with Google'}</span>
          </button>

          {authError && (
            <p className="mt-5 text-xs text-red-500 font-semibold">{authError}</p>
          )}
        </div>
      </div>
    );
  }

  // App Layout Helper Component (Mobile format)
  const MobileAppBody = () => (
    <div className="app-shell flex-1 min-h-0 relative">
      {/* Top App Bar (M3 style) */}
      <header className="mobile-safe-top border-b border-m3-surface-variant/30 bg-m3-surface-container px-5 py-3 flex items-center justify-between z-45 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-m3-primary flex items-center justify-center text-m3-on-primary shadow-xs">
            <CalendarDays size={20} className="stroke-2" />
          </div>
          <div>
            <h1 className="font-display font-extrabold text-base text-m3-on-surface leading-tight">Planflow</h1>
            <p className="text-[10px] text-m3-on-surface-variant font-bold uppercase tracking-wider">
              {currentView === 'daily' ? 'Daily Tasks' : currentView === 'monthly' ? 'Monthly Calendar' : 'Yearly Activity'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-full hover:bg-m3-surface-variant/30 text-m3-on-surface cursor-pointer"
            title="Toggle theme"
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            onClick={() => {
              setSettingsOpen(true);
              setShowClearConfirm(false);
              setSettingsError(null);
              setSettingsMessage(null);
            }}
            className="p-2 rounded-full hover:bg-m3-surface-variant/30 text-m3-on-surface cursor-pointer"
            title="Settings"
          >
            <Settings size={18} />
          </button>
          <UserAvatar
            user={user}
            fallbackPhotoURL={profilePhotoURL}
            size="sm"
            onClick={() => {
              setSettingsOpen(true);
              setShowClearConfirm(false);
              setSettingsError(null);
              setSettingsMessage(null);
            }}
          />
        </div>
      </header>

      {/* Main View Area */}
      <main className="app-scroll mobile-page px-4 py-4 bg-m3-background">
        <TaskStats
          tasks={tasks}
          activeFilter={activeFilter}
          onQuickFilterClick={(status) => {
            setActiveFilter(status);
            setCurrentView('daily');
          }}
        />

        <div className="mt-4 pb-12">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={isNativeApp ? false : { opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={isNativeApp ? undefined : { opacity: 0, y: -15 }}
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

      {/* FAB (Floating Action Button) for Mobile */}
      <button
        type="button"
        onClick={() => setQuickAddDate(formatDateString(selectedDate))}
        className="absolute bottom-24 right-5 z-[90] w-14 h-14 bg-m3-primary-container text-m3-on-primary-container active:scale-95 active:bg-m3-primary hover:shadow-xl rounded-[20px] flex items-center justify-center shadow-lg transition-all duration-200 cursor-pointer touch-target"
        title="Add new task"
      >
        <Plus size={28} className="stroke-[2.5]" />
      </button>

      {/* Mobile M3 Bottom Navbar */}
      <nav className="absolute bottom-0 inset-x-0 z-[100] border-t border-m3-surface-variant/30 bg-m3-surface-container px-4 py-2 flex items-center justify-around shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] mobile-safe-bottom">
        {[
          { view: 'daily', label: 'Daily', icon: <FileCheck2 size={20} /> },
          { view: 'monthly', label: 'Monthly', icon: <Calendar size={20} /> },
          { view: 'yearly', label: 'Yearly', icon: <CalendarDays size={20} /> }
        ].map((item) => {
          const isActive = currentView === item.view;
          return (
            <button
              key={item.view}
              type="button"
              onClick={() => setCurrentView(item.view as CalendarView)}
              className="mobile-nav-btn flex flex-col items-center justify-center gap-0.5 py-1 w-20 relative touch-target"
            >
              <div
                className={`flex items-center justify-center px-5 py-1.5 rounded-full transition-all duration-200 ${
                  isActive
                    ? 'bg-m3-primary-container text-m3-on-primary-container dark:bg-m3-secondary-container dark:text-m3-on-secondary-container scale-105'
                    : 'text-m3-on-surface-variant hover:bg-m3-surface-variant/20'
                }`}
              >
                {item.icon}
              </div>
              <span className={`text-[10px] tracking-wide font-semibold mt-0.5 ${isActive ? 'text-m3-on-surface font-extrabold' : 'text-m3-on-surface-variant'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );

  // Simulated power / vol buttons actions
  const handlePowerButton = () => {
    setDarkMode(!darkMode);
  };
  const handleVolumeUp = () => {
    alert("Volume Increased (Simulated)");
  };
  const handleVolumeDown = () => {
    alert("Volume Decreased (Simulated)");
  };

  return (
    <div className={`app-shell transition-all duration-200 bg-m3-background text-m3-on-background ${darkMode ? 'dark' : ''}`}>
      {/* 1. Android Phone Frame (Emulator Mode) */}
      {useDeviceFrame ? (
        <div className="flex-1 flex flex-col">
          {/* Emulator controller header */}
          <div className="flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-slate-800 text-white z-50 shadow-md shrink-0">
            <div className="flex items-center gap-3">
              <Smartphone className="text-m3-primary animate-pulse" size={24} />
              <div>
                <h2 className="text-base font-extrabold tracking-tight font-display text-white">Planflow Android Previewer</h2>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Device: Google Pixel 9 Pro (Simulated)</p>
              </div>
            </div>
            <button
              onClick={() => setUseDeviceFrame(false)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-850 hover:bg-slate-800 active:scale-95 transition-all text-xs font-bold rounded-lg cursor-pointer border border-slate-700"
            >
              <Maximize2 size={14} />
              <span>Full Screen Desktop Layout</span>
            </button>
          </div>

          {/* Emulator container wrapper */}
          <div className="phone-emulator-container flex-1 flex items-center justify-center p-6 bg-slate-950">
            <div className="phone-emulator relative">
              <div className="phone-btn-power" onClick={handlePowerButton} title="Toggle Dark/Light Mode" />
              <div className="phone-btn-volup" onClick={handleVolumeUp} title="Volume Up" />
              <div className="phone-btn-voldown" onClick={handleVolumeDown} title="Volume Down" />

              <div className="phone-screen bg-m3-background flex flex-col">
                <div className="phone-notch-container">
                  <div className="phone-camera-hole" />
                </div>

                {/* Status Bar */}
                <div className="phone-status-bar flex justify-between items-center px-6 pt-1 select-none">
                  <div className="text-[11px] font-bold text-m3-on-surface">{statusBarTime}</div>
                  <div className="flex items-center gap-1.5">
                    <Signal size={12} className="text-m3-on-surface" />
                    <Wifi size={12} className="text-m3-on-surface" />
                    <span className="text-[9px] font-extrabold text-m3-on-surface leading-none pt-0.5">LTE</span>
                    <Battery size={13} className="text-m3-on-surface rotate-90 scale-x-[-1] ml-0.5" />
                  </div>
                </div>

                {/* Mobile App inside Pixel Screen */}
                <MobileAppBody />

                {/* Gesture Indicator */}
                <div className="phone-bottom-nav-bar flex items-center justify-center pb-2 bg-m3-surface-container shrink-0">
                  <div className="phone-gesture-pill bg-m3-on-surface/40" />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // 2. Full-Screen Layout (Original desktop structure preserved, mobile layout on screens < 768px)
        <div className="app-shell flex-1 min-h-0">
          
          {/* Desktop Sticky Header Navbar */}
          <header className="hidden md:block border-b border-m3-surface-variant/30 bg-m3-surface-container sticky top-0 z-40 shrink-0">
            <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-m3-primary flex items-center justify-center text-m3-on-primary shadow-xs">
                  <CalendarDays size={22} className="stroke-2" />
                </div>
                <div>
                  <h1 className="font-display font-extrabold text-lg text-m3-on-surface">Planflow</h1>
                  <p className="text-[10px] text-m3-on-surface-variant font-bold uppercase tracking-wider">Task & Calendar Planner</p>
                </div>
              </div>

              {/* Central View Selector tabs */}
              <div className="flex items-center bg-m3-surface border border-m3-outline/15 p-1 rounded-2xl shadow-3xs gap-1">
                {[
                  { view: 'daily', label: 'Daily Planner', icon: <FileCheck2 size={14} /> },
                  { view: 'monthly', label: 'Monthly Grid', icon: <Calendar size={14} /> },
                  { view: 'yearly', label: 'Yearly Heatmap', icon: <CalendarDays size={14} /> }
                ].map((item) => {
                  const isActive = currentView === item.view;
                  return (
                    <button
                      key={item.view}
                      onClick={() => setCurrentView(item.view as CalendarView)}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer select-none ${
                        isActive
                          ? 'bg-m3-primary text-white shadow-3xs'
                          : 'text-m3-on-surface-variant hover:bg-m3-surface-variant/20 hover:text-m3-on-surface'
                      }`}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Right actions */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className="p-2.5 rounded-full hover:bg-m3-surface-variant/40 transition text-m3-on-surface cursor-pointer"
                  title="Toggle theme"
                >
                  {darkMode ? <Sun size={18} /> : <Moon size={18} />}
                </button>
                <button
                  onClick={() => {
                    setSettingsOpen(true);
                    setShowClearConfirm(false);
                    setSettingsError(null);
                    setSettingsMessage(null);
                  }}
                  className="p-2.5 rounded-full hover:bg-m3-surface-variant/40 transition text-m3-on-surface cursor-pointer"
                  title="Settings"
                >
                  <Settings size={18} />
                </button>

                {/* Google Connection Badge */}
                <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-bold select-none shadow-3xs">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="uppercase tracking-wider text-[9px]">Google</span>
                  <UserAvatar user={user} fallbackPhotoURL={profilePhotoURL} size="xs" />
                  <button
                    onClick={() => signOutUser().catch((err) => console.error('Sign out error:', err))}
                    className="ml-1 p-0.5 text-m3-on-surface-variant hover:text-red-500 transition"
                    title="Sign Out"
                  >
                    <LogOut size={12} />
                  </button>
                </div>
              </div>
            </div>
          </header>

          {/* Desktop Floating Preview Button (Floating Android device toggler) */}
          <button
            onClick={() => setUseDeviceFrame(true)}
            className="hidden md:flex fixed bottom-6 left-6 z-40 bg-slate-900 border border-slate-700 text-white rounded-full p-3 shadow-lg hover:scale-105 transition-all duration-200 cursor-pointer items-center justify-center"
            title="Preview inside Pixel Device"
          >
            <Smartphone size={20} className="text-m3-primary" />
            <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-200 font-bold text-xs whitespace-nowrap pl-0">Phone Mode</span>
          </button>

          {/* Mobile Header (fixed above scroll area on small screens) */}
          <header className="md:hidden mobile-safe-top border-b border-m3-surface-variant/30 bg-m3-surface-container px-5 py-3 flex items-center justify-between z-40 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-m3-primary flex items-center justify-center text-m3-on-primary shadow-xs">
                <CalendarDays size={20} className="stroke-2" />
              </div>
              <div>
                <h1 className="font-display font-extrabold text-base text-m3-on-surface leading-tight">Planflow</h1>
                <p className="text-[10px] text-m3-on-surface-variant font-bold uppercase tracking-wider">
                  {currentView === 'daily' ? 'Daily Tasks' : currentView === 'monthly' ? 'Monthly Calendar' : 'Yearly Activity'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 rounded-full hover:bg-m3-surface-variant/30 text-m3-on-surface cursor-pointer touch-target"
              >
                {darkMode ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSettingsOpen(true);
                  setShowClearConfirm(false);
                  setSettingsError(null);
                  setSettingsMessage(null);
                }}
                className="p-2 rounded-full hover:bg-m3-surface-variant/30 text-m3-on-surface cursor-pointer touch-target"
              >
                <Settings size={18} />
              </button>
              <UserAvatar
                user={user}
                fallbackPhotoURL={profilePhotoURL}
                size="sm"
                onClick={() => {
                  setSettingsOpen(true);
                  setShowClearConfirm(false);
                  setSettingsError(null);
                  setSettingsMessage(null);
                }}
              />
            </div>
          </header>

          {/* Scrollable main content */}
          <main className="app-scroll flex-1 min-h-0 max-w-7xl mx-auto px-4 py-6 w-full mobile-page md:pb-12">
            <TaskStats
              tasks={tasks}
              activeFilter={activeFilter}
              onQuickFilterClick={(status) => {
                setActiveFilter(status);
                setCurrentView('daily');
              }}
            />

            <div className="mt-4">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentView}
                  initial={isNativeApp ? false : { opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={isNativeApp ? undefined : { opacity: 0, y: -15 }}
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

          {/* Floating Action Button (FAB) - Mobile only */}
          <button
            type="button"
            onClick={() => setQuickAddDate(formatDateString(selectedDate))}
            className="md:hidden fixed bottom-24 right-5 z-[90] w-14 h-14 bg-m3-primary-container text-m3-on-primary-container rounded-[20px] flex items-center justify-center shadow-lg active:scale-95 transition-all duration-200 cursor-pointer touch-target"
            title="Add new task"
          >
            <Plus size={28} className="stroke-[2.5]" />
          </button>

          {/* Mobile bottom navbar (Mobile screen widths < 768px only) */}
          <nav className="md:hidden mobile-bottom-nav border-t border-m3-surface-variant/30 bg-m3-surface-container px-4 py-2 flex items-center justify-around shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
            {[
              { view: 'daily', label: 'Daily', icon: <FileCheck2 size={20} /> },
              { view: 'monthly', label: 'Monthly', icon: <Calendar size={20} /> },
              { view: 'yearly', label: 'Yearly', icon: <CalendarDays size={20} /> }
            ].map((item) => {
              const isActive = currentView === item.view;
              return (
                <button
                  key={item.view}
                  type="button"
                  onClick={() => setCurrentView(item.view as CalendarView)}
                  className="mobile-nav-btn flex flex-col items-center justify-center gap-0.5 py-1 w-20 relative touch-target"
                >
                    <div
                      className={`flex items-center justify-center px-5 py-1.5 rounded-full transition-all duration-200 ${
                        isActive
                          ? 'bg-m3-primary-container text-m3-on-primary-container dark:bg-m3-secondary-container dark:text-m3-on-secondary-container scale-105'
                          : 'text-m3-on-surface-variant hover:bg-m3-surface-variant/20'
                      }`}
                    >
                      {item.icon}
                    </div>
                    <span className={`text-[10px] tracking-wide font-semibold mt-0.5 ${isActive ? 'text-m3-on-surface font-extrabold' : 'text-m3-on-surface-variant'}`}>
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </nav>

          {/* Desktop footer (Desktop only) */}
          <footer className="hidden md:block border-t border-m3-outline/10 bg-m3-surface-container/20 py-8 mt-12 shrink-0">
            <div className="max-w-7xl mx-auto px-6 flex items-center justify-between text-xs text-m3-on-surface-variant/80 font-semibold select-none">
              <p>&copy; 2026 Planflow Task & Calendar Manager. Handcrafted offline-first workspace tool.</p>
              <span className="flex items-center gap-1">
                <Info size={12} className="text-m3-primary" />
                Interactive clicking enabled on all calendar elements
              </span>
            </div>
          </footer>
        </div>
      )}

      {/* QUICK ADD / TASK ADD SLIDING BOTTOM SHEET (Mobile) / CENTERED MODAL (Desktop) */}
      <AnimatePresence>
        {quickAddDate && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setQuickAddDate(null)}
              className="fixed inset-0 z-50 bottom-sheet-overlay cursor-pointer"
            />
            {/* Sheet / Dialog Modal (Responsive placement: sm:items-center sm:rounded-[28px]) */}
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none">
              <motion.div
                initial={{ y: '20px', opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: '20px', opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="bg-m3-surface-container border border-m3-outline/20 shadow-2xl rounded-t-[32px] sm:rounded-[28px] p-6 max-h-[90dvh] sm:max-h-[85dvh] overflow-y-auto flex flex-col gap-4 w-full max-w-md pointer-events-auto shadow-2xl"
              >
                {/* Drag Handle Bar (Mobile only) */}
                <div className="w-12 h-1.5 bg-m3-on-surface-variant/20 rounded-full mx-auto mb-1 sm:hidden" onClick={() => setQuickAddDate(null)} />

                <div className="flex items-center justify-between border-b border-m3-outline/10 pb-3">
                  <div>
                    <span className="text-[10px] font-bold text-m3-primary bg-m3-primary-container px-3 py-1 rounded-full uppercase tracking-wider">
                      New Task Entry
                    </span>
                    <h4 className="font-display font-extrabold text-lg text-m3-on-surface mt-2">
                      Create Task for {quickAddDate}
                    </h4>
                  </div>
                  <button
                    onClick={() => setQuickAddDate(null)}
                    className="p-1.5 hover:bg-m3-surface-variant/40 rounded-full text-m3-on-surface-variant cursor-pointer"
                  >
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleQuickAddSubmit} className="flex flex-col gap-4 mt-1">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-m3-on-surface-variant uppercase tracking-wider pl-1">Action Title *</label>
                    <input
                      id="quick-add-title-input"
                      type="text"
                      required
                      autoFocus
                      placeholder="e.g. Design review presentation"
                      value={quickTitle}
                      onChange={(e) => setQuickTitle(e.target.value)}
                      className="px-4 py-2.5 rounded-2xl border border-m3-outline/15 bg-m3-surface text-m3-on-surface text-sm focus:ring-2 focus:ring-m3-primary/30 outline-hidden"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-m3-on-surface-variant uppercase tracking-wider pl-1">Description (Optional)</label>
                    <textarea
                      id="quick-add-desc-input"
                      placeholder="Details, link context..."
                      value={quickDesc}
                      onChange={(e) => setQuickDesc(e.target.value)}
                      className="px-4 py-2.5 rounded-2xl border border-m3-outline/15 bg-m3-surface text-m3-on-surface text-sm focus:ring-2 focus:ring-m3-primary/30 outline-hidden resize-none"
                      rows={2}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-m3-on-surface-variant uppercase tracking-wider pl-1">Category</label>
                      <select
                        id="quick-add-category-select"
                        value={quickCategory}
                        onChange={(e) => setQuickCategory(e.target.value)}
                        className="px-4 py-2.5 rounded-2xl border border-m3-outline/15 text-sm focus:ring-2 focus:ring-m3-primary/30 outline-hidden bg-m3-surface text-m3-on-surface cursor-pointer"
                      >
                        {Object.keys(DEFAULT_CATEGORIES).map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-m3-on-surface-variant uppercase tracking-wider pl-1">Urgency</label>
                      <select
                        id="quick-add-priority-select"
                        value={quickPriority}
                        onChange={(e) => setQuickPriority(e.target.value as Priority)}
                        className="px-4 py-2.5 rounded-2xl border border-m3-outline/15 text-sm focus:ring-2 focus:ring-m3-primary/30 outline-hidden bg-m3-surface text-m3-on-surface cursor-pointer"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-m3-on-surface-variant uppercase tracking-wider pl-1">Time (Optional)</label>
                      <div className="relative">
                        <Clock size={16} className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-m3-on-surface-variant" />
                        <input
                          id="quick-add-time-input"
                          type="time"
                          value={quickTime}
                          onChange={(e) => setQuickTime(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-m3-outline/15 bg-m3-surface text-m3-on-surface text-sm focus:ring-2 focus:ring-m3-primary/30 outline-hidden"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-m3-on-surface-variant uppercase tracking-wider pl-1">Estimated Mins</label>
                      <input
                        id="quick-add-duration-input"
                        type="number"
                        min={1}
                        placeholder="e.g. 30"
                        value={quickDuration}
                        onChange={(e) => setQuickDuration(e.target.value)}
                        className="px-4 py-2.5 rounded-2xl border border-m3-outline/15 bg-m3-surface text-m3-on-surface text-sm focus:ring-2 focus:ring-m3-primary/30 outline-hidden"
                      />
                    </div>
                  </div>

                  {/* Goal tasks */}
                  <div className="border-t border-m3-outline/10 pt-3 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          id="quick-add-is-goal-checkbox"
                          checked={quickIsGoal}
                          onChange={(e) => {
                            setQuickIsGoal(e.target.checked);
                            if (e.target.checked && !quickDeadline) {
                              const nextWeek = new Date(parseDateString(quickAddDate));
                              nextWeek.setDate(nextWeek.getDate() + 7);
                              setQuickDeadline(formatDateString(nextWeek));
                            }
                          }}
                          className="w-4 h-4 text-m3-primary border-m3-outline/35 rounded focus:ring-m3-primary cursor-pointer"
                        />
                        <label htmlFor="quick-add-is-goal-checkbox" className="text-xs font-bold text-m3-on-surface cursor-pointer select-none">
                          Mark as Goal (with Target Deadline)
                        </label>
                      </div>
                      {quickIsGoal && (
                        <span className="text-[9px] bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                          Goal Mode
                        </span>
                      )}
                    </div>

                    <AnimatePresence>
                      {quickIsGoal && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="flex flex-col gap-1.5 overflow-hidden"
                        >
                          <label className="text-[9px] font-bold text-m3-on-surface-variant uppercase tracking-wider pl-1">Target Deadline Date</label>
                          <input
                            type="date"
                            required
                            value={quickDeadline}
                            onChange={(e) => setQuickDeadline(e.target.value)}
                            className="px-4 py-2 rounded-xl border border-m3-outline/15 bg-m3-surface text-m3-on-surface text-xs focus:ring-2 focus:ring-m3-primary/30 outline-hidden cursor-pointer"
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <button
                    id="quick-add-submit-button"
                    type="submit"
                    className="bg-m3-primary hover:bg-m3-primary/90 text-white font-bold text-xs uppercase tracking-wider py-3.5 rounded-2xl transition shadow-md hover:shadow-lg cursor-pointer mt-3"
                  >
                    Create Task
                  </button>
                </form>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* SETTINGS SLIDING BOTTOM SHEET (Mobile) / CENTERED MODAL (Desktop) */}
      <AnimatePresence>
        {settingsOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeSettings}
              className="fixed inset-0 z-50 bottom-sheet-overlay cursor-pointer"
            />
            {/* Modal Container */}
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none">
              <motion.div
                initial={{ y: '20px', opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: '20px', opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="bg-m3-surface-container border border-m3-outline/20 shadow-2xl rounded-t-[32px] sm:rounded-[28px] p-6 max-h-[90dvh] sm:max-h-[85dvh] overflow-y-auto flex flex-col gap-5 w-full max-w-md pointer-events-auto"
              >
                {/* Drag Handle (Mobile only) */}
                <div className="w-12 h-1.5 bg-m3-on-surface-variant/20 rounded-full mx-auto mb-1 sm:hidden" onClick={closeSettings} />

                <div className="flex items-center justify-between border-b border-m3-outline/10 pb-3">
                  <div className="flex items-center gap-3">
                    <UserAvatar user={user} fallbackPhotoURL={profilePhotoURL} size="md" />
                    <div>
                      <h4 className="font-display font-extrabold text-base text-m3-on-surface">Settings</h4>
                      <p className="text-xs text-m3-on-surface-variant mt-0.5">
                        {user.displayName || user.email}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={closeSettings}
                    className="p-1.5 hover:bg-m3-surface-variant/40 rounded-full text-m3-on-surface-variant cursor-pointer"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Notifications Panel */}
                {isNativeNotificationsSupported() && (
                  <div className="rounded-2xl border border-m3-outline/15 bg-m3-surface p-4 flex flex-col gap-3 shadow-3xs">
                    <div>
                      <h5 className="text-[10px] font-bold text-m3-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                        <Bell size={12} className="text-m3-primary" />
                        Task Reminders
                      </h5>
                      <p className="text-xs text-m3-on-surface-variant mt-1.5 leading-relaxed">
                        Sync alerts for upcoming scheduled tasks.
                        {scheduledReminderCount > 0 && (
                          <span className="block mt-1 text-emerald-600 dark:text-emerald-400 font-bold">
                            ✓ {scheduledReminderCount} reminder{scheduledReminderCount === 1 ? '' : 's'} scheduled.
                          </span>
                        )}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-1">
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                        notificationStatus === 'granted'
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-extrabold'
                          : notificationStatus === 'denied'
                            ? 'bg-red-500/10 border-red-500/20 text-red-500 font-extrabold'
                            : 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400 font-extrabold'
                      }`}>
                        Status: {notificationStatus === 'granted' ? 'Enabled' : notificationStatus === 'denied' ? 'Blocked' : 'Unset'}
                      </span>
                      {notificationStatus !== 'granted' && (
                        <button
                          onClick={handleEnableNotifications}
                          disabled={notificationLoading}
                          className="flex items-center gap-2 px-4 py-2 bg-m3-primary hover:bg-m3-primary/95 text-white text-xs font-bold rounded-xl transition cursor-pointer disabled:opacity-50"
                        >
                          <Bell size={12} />
                          {notificationLoading ? 'Enabling...' : 'Enable Reminders'}
                        </button>
                      )}
                    </div>
                    {notificationStatus === 'granted' && (
                      <button
                        onClick={handleTestNotification}
                        disabled={notificationLoading}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-m3-outline/25 bg-m3-surface-container text-m3-on-surface hover:bg-m3-surface-variant/40 text-xs font-bold rounded-xl transition cursor-pointer disabled:opacity-50"
                      >
                        <Bell size={12} />
                        {notificationLoading ? 'Scheduling...' : 'Send Test Notification'}
                      </button>
                    )}
                  </div>
                )}

                {/* Data Management Panel */}
                <div className="rounded-2xl border border-m3-outline/15 bg-m3-surface p-4 flex flex-col gap-3 shadow-3xs">
                  <div>
                    <h5 className="text-[10px] font-bold text-m3-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                      <Trash2 size={12} className="text-red-500" />
                      Data Management
                    </h5>
                    <p className="text-xs text-m3-on-surface-variant mt-1.5 leading-relaxed">
                      Permanently delete all tasks from your cloud database and this device.
                    </p>
                  </div>

                  {!showClearConfirm ? (
                    <button
                      onClick={() => {
                        setShowClearConfirm(true);
                        setSettingsError(null);
                        setSettingsMessage(null);
                      }}
                      className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-3 border border-red-500/35 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      <Trash2 size={14} />
                      Clear All Data
                    </button>
                  ) : (
                    <div className="mt-2 rounded-xl border border-red-500/20 bg-red-500/5 p-3 flex flex-col gap-2">
                      <p className="text-xs text-red-500 font-semibold">
                        Delete all {tasks.length} tasks? This cannot be undone.
                      </p>
                      <div className="flex gap-2.5 mt-1">
                        <button
                          onClick={() => setShowClearConfirm(false)}
                          disabled={clearDataLoading}
                          className="flex-1 px-3 py-2 border border-m3-outline/25 bg-m3-surface hover:bg-m3-surface-variant/30 text-m3-on-surface text-xs font-bold rounded-lg transition cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleClearAllData}
                          disabled={clearDataLoading}
                          className="flex-1 px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition cursor-pointer disabled:opacity-50"
                        >
                          {clearDataLoading ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Sign Out */}
                <button
                  onClick={() => signOutUser().catch((err) => console.error('Sign out error:', err))}
                  className="w-full flex items-center justify-center gap-2.5 px-4 py-3.5 border border-m3-outline/25 bg-m3-surface hover:bg-m3-surface-variant/30 text-m3-on-surface text-xs font-bold rounded-xl transition cursor-pointer shadow-3xs"
                >
                  <LogOut size={14} />
                  Sign Out Google Account
                </button>

                {settingsMessage && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold text-center mt-1">{settingsMessage}</p>
                )}
                {settingsError && (
                  <p className="text-xs text-red-500 font-semibold text-center mt-1">{settingsError}</p>
                )}
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
