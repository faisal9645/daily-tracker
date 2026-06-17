import React, { useState, useEffect } from 'react';
import { CalendarView, Task, Priority } from './types';
import { formatDateString, parseDateString, DEFAULT_CATEGORIES } from './utils';
import TaskStats from './components/TaskStats';
import CalendarDaily from './components/CalendarDaily';
import CalendarMonthly from './components/CalendarMonthly';
import CalendarYearly from './components/CalendarYearly';
import {
  CalendarDays,
  Calendar,
  CheckCircle,
  FileCheck2,
  Clock,
  Plus,
  X,
  Info,
  LogIn,
  LogOut,
  RefreshCw,
  CloudLightning,
  User as UserIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, onSnapshot, setDoc, doc, deleteDoc, writeBatch, getDoc } from 'firebase/firestore';
import { auth, db, signInWithGoogle, signOutUser, handleFirestoreError, OperationType } from './firebase';

const TASK_STORAGE_KEY = 'calendar_task_tracker_item_v4';
const OLD_TASK_STORAGE_KEYS = [
  'calendar_task_tracker_item_v2',
  'calendar_task_tracker_item_v3',
];

// Returns clean empty tasks list
function getSeedTasks(): Task[] {
  return [];
}

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
  const [authLoading, setAuthLoading] = useState(true);
  const [signInLoading, setSignInLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    OLD_TASK_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
  }, []);

  // Auth Status and Profile Registration Listener
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);
      if (firebaseUser) {
        setAuthError(null);

        // Safe profile creation inside Firestore to meet rules requirements
        const userRef = doc(db, 'users', firebaseUser.uid);
        try {
          const userSnap = await getDoc(userRef);
          if (!userSnap.exists()) {
            await setDoc(userRef, {
              userId: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || '',
              createdAt: new Date().toISOString()
            });
          }
        } catch (error) {
          console.error("Error writing user profile:", error);
        }
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Sync real-time task items securely based on user availability
  useEffect(() => {
    if (authLoading) return;

    if (user) {
      // Listening to Firestore collection subpath
      const tasksRef = collection(db, 'users', user.uid, 'tasks');
      const unsubscribeTasks = onSnapshot(tasksRef, (snapshot) => {
        const fetchedTasks: Task[] = [];
        snapshot.forEach((docSnap) => {
          fetchedTasks.push({
            id: docSnap.id,
            ...docSnap.data()
          } as Task);
        });

        // Smart Local -> Cloud migration if target contains empty cloud registry
        if (fetchedTasks.length === 0) {
          const localSaved = localStorage.getItem(TASK_STORAGE_KEY);
          if (localSaved) {
            try {
              const localTasks = JSON.parse(localSaved) as Task[];
              if (localTasks.length > 0) {
                const batch = writeBatch(db);
                localTasks.forEach((t) => {
                  // Robust sanitization to comply with the exact security rules schema
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
                batch.commit().catch(e => console.error("Cloud batch update failed:", e));
              }
            } catch (err) {
              console.error("Task parsing error on offline backup sync:", err);
            }
          }
        }

        setTasks(fetchedTasks.sort((a, b) => b.id.localeCompare(a.id)));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/tasks`);
      });

      return () => unsubscribeTasks();
    } else {
      // Offline Local Storage Fallback
      const saved = localStorage.getItem(TASK_STORAGE_KEY);
      if (saved) {
        try {
          setTasks(JSON.parse(saved));
        } catch (e) {
          setTasks(getSeedTasks());
        }
      } else {
        setTasks(getSeedTasks());
      }
    }
  }, [user, authLoading]);

  // Persist edits to local storage only during offline access
  useEffect(() => {
    if (!authLoading && !user) {
      localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(tasks));
    }
  }, [tasks, user, authLoading]);

  // Sync Action Handlers
  const handleAddTask = async (newTaskData: Omit<Task, 'id' | 'completed'> | Omit<Task, 'id' | 'completed'>[]) => {
    if (user) {
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
    } else {
      if (Array.isArray(newTaskData)) {
        const freshTasks = newTaskData.map((data, index) => ({
          ...data,
          id: `task-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 4)}`,
          completed: false,
        }));
        setTasks((prev) => [...freshTasks, ...prev]);
      } else {
        const freshTask: Task = {
          ...newTaskData,
          id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          completed: false,
        };
        setTasks((prev) => [freshTask, ...prev]);
      }
    }
  };

  const handleToggleTask = async (id: string) => {
    const taskToToggle = tasks.find((t) => t.id === id);
    if (!taskToToggle) return;

    if (user) {
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
    } else {
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
      );
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (user) {
      const docRef = doc(db, 'users', user.uid, 'tasks', id);
      try {
        await deleteDoc(docRef);
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/tasks/${id}`);
      }
    } else {
      setTasks((prev) => prev.filter((t) => t.id !== id));
    }
  };

  const handleEditTask = async (id: string, updatedFields: Partial<Task>) => {
    const taskToEdit = tasks.find((t) => t.id === id);
    if (!taskToEdit) return;

    if (user) {
      const docRef = doc(db, 'users', user.uid, 'tasks', id);
      try {
        const { id: _, ...cleanFields } = updatedFields;
        await setDoc(docRef, cleanFields, { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/tasks/${id}`);
      }
    } else {
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...updatedFields } : t))
      );
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



  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased relative">
      {/* Visual background accents */}
      <div className="absolute top-0 left-0 right-0 h-64 bg-linear-to-b from-blue-50/70 via-blue-50/10 to-transparent pointer-events-none -z-10" />

      {/* Main Navbar */}
      <header className="mobile-safe-top border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 md:py-0 md:h-16 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 text-center sm:text-left">
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

          {/* Utility Tools */}
          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2">
            {/* Cloud Sync State Button block */}
            {authLoading ? (
              <div className="p-2 border border-slate-200 rounded-xl bg-white shadow-2xs" title="Checking Cloud Connection...">
                <RefreshCw size={14} className="animate-spin text-slate-450" />
              </div>
            ) : user ? (
              <div className="flex items-center gap-2 px-3 py-1.5 border border-emerald-200 bg-emerald-50 text-emerald-800 rounded-xl max-w-full select-none shadow-2xs">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span className="text-[9px] font-bold uppercase tracking-wider hidden md:inline shrink-0">Synced to Cloud</span>
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Me'}
                    className="w-5 h-5 rounded-full object-cover border border-emerald-200 shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[9px] font-bold shrink-0">
                    {user.displayName?.charAt(0) || user.email?.charAt(0) || 'U'}
                  </div>
                )}
                <button
                  onClick={() => signOutUser().catch((err) => console.error('Sign out error:', err))}
                  className="p-1 text-[10px] font-bold text-slate-500 hover:text-rose-600 active:scale-95 transition cursor-pointer"
                  title="Sign Out of Cloud Session"
                >
                  <LogOut size={12} />
                </button>
              </div>
            ) : (
              <button
                onClick={async () => {
                  setSignInLoading(true);
                  setAuthError(null);
                  try {
                    await signInWithGoogle();
                  } catch (err) {
                    const message = err instanceof Error ? err.message : 'Google sign-in failed.';
                    console.error('Auth sign-in error:', err);
                    setAuthError(message);
                  } finally {
                    setSignInLoading(false);
                  }
                }}
                disabled={signInLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-blue-200 text-blue-900 bg-blue-50/75 hover:bg-blue-100/90 active:scale-98 transition rounded-xl cursor-pointer text-[10px] md:text-[11px] font-bold shadow-2xs transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                title="Sign in with Google to sync calendar tasks"
              >
                <CloudLightning size={12} className="text-blue-900 stroke-3 shrink-0" />
                <span>{signInLoading ? 'Signing in...' : 'Sync with Google'}</span>
              </button>
            )}

            {authError && (
              <p className="w-full text-[10px] text-rose-600 font-medium text-center sm:text-right">
                {authError}
              </p>
            )}



          </div>
        </div>
      </header>

      {/* Main Content Layout Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
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
      <footer className="border-t border-slate-200 bg-white py-8 mt-24">
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
          <div className="fixed inset-0 bg-blue-950/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-sm w-full p-6 flex flex-col gap-4 relative"
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
    </div>
  );
}
