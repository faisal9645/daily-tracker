import React, { useState } from 'react';
import { Task, Priority } from '../types';
import { MONTHS, DEFAULT_CATEGORIES, formatDateString } from '../utils';
import {
  Plus,
  Trash2,
  CheckCircle,
  Circle,
  HelpCircle,
  Search,
  Filter,
  CalendarDays,
  Clock,
  Briefcase,
  SlidersHorizontal,
  X,
  AlertCircle,
  ChevronDown,
  Edit2,
  Target
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import TaskIcon from './TaskIcon';

interface CalendarDailyProps {
  currentDate: Date;
  onChangeDate: (date: Date) => void;
  tasks: Task[];
  onAddTask: (task: Omit<Task, 'id' | 'completed'> | Omit<Task, 'id' | 'completed'>[]) => void;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onEditTask: (id: string, updatedFields: Partial<Task>) => void;
}

const getDeadlineStatus = (deadlineStr?: string) => {
  if (!deadlineStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadlineDate = new Date(deadlineStr);
  deadlineDate.setHours(0, 0, 0, 0);
  const diffTime = deadlineDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    const absDays = Math.abs(diffDays);
    return {
      text: `${absDays} day${absDays > 1 ? 's' : ''} overdue`,
      class: 'bg-rose-50 border-rose-200 text-rose-700 font-bold',
      overdue: true,
    };
  } else if (diffDays === 0) {
    return {
      text: `due today`,
      class: 'bg-amber-50 border-amber-200 text-amber-700 font-bold',
      overdue: false,
    };
  } else if (diffDays === 1) {
    return {
      text: `due tomorrow`,
      class: 'bg-blue-50 border-blue-200 text-blue-700 font-bold',
      overdue: false,
    };
  } else {
    return {
      text: `${diffDays} days left`,
      class: 'bg-emerald-50 border-emerald-200 text-emerald-700 font-semibold',
      overdue: false,
    };
  }
};

export default function CalendarDaily({
  currentDate,
  onChangeDate,
  tasks,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  onEditTask,
}: CalendarDailyProps) {
  const dateStr = formatDateString(currentDate);
  const dayTasks = tasks.filter((t) => t.date === dateStr);

  // Filter/Search states
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedPriority, setSelectedPriority] = useState<string>('All');

  // New task form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [time, setTime] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [category, setCategory] = useState('Personal');
  const [duration, setDuration] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [repeatDays, setRepeatDays] = useState<number[]>([]);
  const [repeatWeeks, setRepeatWeeks] = useState(4);
  const [isGoal, setIsGoal] = useState(false);
  const [deadline, setDeadline] = useState('');

  // Edit task states
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPriority, setEditPriority] = useState<Priority>('medium');
  const [editCategory, setEditCategory] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editIsGoal, setEditIsGoal] = useState(false);
  const [editDeadline, setEditDeadline] = useState('');

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (isRecurring && repeatDays.length > 0) {
      const generatedTasks: Omit<Task, 'id' | 'completed'>[] = [];
      const numDays = repeatWeeks * 7;
      
      for (let i = 0; i < numDays; i++) {
        const d = new Date(currentDate);
        d.setDate(d.getDate() + i);
        const dayOfWeek = d.getDay(); // 0 is Sunday, 1 is Monday ...
        if (repeatDays.includes(dayOfWeek)) {
          const taskObj: Omit<Task, 'id' | 'completed'> = {
            title: title.trim(),
            description: description.trim() || undefined,
            date: formatDateString(d),
            time: time || undefined,
            priority,
            category,
            duration: duration ? parseInt(duration) : undefined,
          };
          if (isGoal) {
            taskObj.isGoal = true;
            if (deadline) taskObj.deadline = deadline;
          }
          generatedTasks.push(taskObj);
        }
      }
      
      if (generatedTasks.length > 0) {
        onAddTask(generatedTasks);
      }
    } else {
      const taskObj: Omit<Task, 'id' | 'completed'> = {
        title: title.trim(),
        description: description.trim() || undefined,
        date: dateStr,
        time: time || undefined,
        priority,
        category,
        duration: duration ? parseInt(duration) : undefined,
      };
      if (isGoal) {
        taskObj.isGoal = true;
        if (deadline) taskObj.deadline = deadline;
      }
      onAddTask(taskObj);
    }

    // Reset fields
    setTitle('');
    setDescription('');
    setTime('');
    setPriority('medium');
    setCategory('Personal');
    setDuration('');
    setIsAdding(false);
    setIsRecurring(false);
    setRepeatDays([]);
    setRepeatWeeks(4);
    setIsGoal(false);
    setDeadline('');
  };

  const startEdit = (task: Task) => {
    setEditingTaskId(task.id);
    setEditTitle(task.title);
    setEditDesc(task.description || '');
    setEditPriority(task.priority);
    setEditCategory(task.category);
    setEditTime(task.time || '');
    setEditIsGoal(!!task.isGoal);
    setEditDeadline(task.deadline || '');
  };

  const handleEditSubmit = (e: React.FormEvent, taskId: string) => {
    e.preventDefault();
    if (!editTitle.trim()) return;

    onEditTask(taskId, {
      title: editTitle.trim(),
      description: editDesc.trim() || undefined,
      priority: editPriority,
      category: editCategory,
      time: editTime || undefined,
      isGoal: editIsGoal,
      deadline: editIsGoal && editDeadline ? editDeadline : undefined,
    });

    setEditingTaskId(null);
  };

  const filteredTasks = dayTasks.filter((task) => {
    const matchesSearch =
      task.title.toLowerCase().includes(search.toLowerCase()) ||
      (task.description && task.description.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory = selectedCategory === 'All' || task.category === selectedCategory;
    const matchesPriority = selectedPriority === 'All' || task.priority === selectedPriority;
    return matchesSearch && matchesCategory && matchesPriority;
  });

  const incompleteTasks = filteredTasks.filter((t) => !t.completed);
  const completedTasks = filteredTasks.filter((t) => t.completed);

  // Generate Hour Timeline
  const hours = Array.from({ length: 15 }, (_, i) => i + 7); // 7 AM to 9 PM

  // Priority layout tags
  const priorityClasses = {
    high: 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100',
    medium: 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-105',
    low: 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100',
  };

  const changeDateByOffset = (days: number) => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + days);
    onChangeDate(next);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
      {/* LEFT COLUMN: Controls & Task Checklist Form (7 Cols) */}
      <div className="lg:col-span-7 flex flex-col gap-4">
        {/* Day Navigation Header */}
        <div className="bg-white p-3 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-3 w-full sm:w-auto">
            <button
              onClick={() => changeDateByOffset(-1)}
              className="touch-target px-3 text-slate-500 active:text-blue-900 active:bg-slate-50 border border-slate-200 rounded-lg transition text-sm font-semibold"
            >
              &larr;
            </button>
            <div className="text-center flex-1 sm:flex-none sm:text-left min-w-0">
              <h2 className="text-base sm:text-xl font-bold font-display text-slate-900 tracking-tight truncate">
                {currentDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </h2>
              <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5">
                {dayTasks.length} tasks • {dayTasks.filter((t) => t.completed).length} done
              </p>
            </div>
            <button
              onClick={() => changeDateByOffset(1)}
              className="touch-target px-3 text-slate-500 active:text-blue-900 active:bg-slate-50 border border-slate-200 rounded-lg transition text-sm font-semibold"
            >
              &rarr;
            </button>
          </div>

          <button
            id="add-task-trigger"
            onClick={() => setIsAdding(!isAdding)}
            className={`touch-target w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
              isAdding
                ? 'bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100'
                : 'bg-blue-900 text-white shadow-xs hover:bg-blue-950'
            }`}
          >
            {isAdding ? <X size={14} /> : <Plus size={14} />}
            <span>{isAdding ? 'Cancel' : 'New Task'}</span>
          </button>
        </div>

        {/* Quick Task Add Form */}
        <AnimatePresence>
          {isAdding && (
            <motion.form
              id="new-task-form"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              onSubmit={handleFormSubmit}
              className="bg-white p-4 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-200 shadow-xs flex flex-col gap-4 overflow-hidden"
            >
              <h3 className="font-display font-bold text-sm text-slate-900">Add New Calendar Action</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">What needs to be done? *</label>
                  <input
                    id="task-title-input"
                    type="text"
                    required
                    placeholder="e.g. Workout, Client Retrospective, Bill payments"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm focus:ring-2 focus:ring-blue-900/40 focus:border-blue-900 outline-hidden"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Category</label>
                  <select
                    id="task-category-select"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm focus:ring-2 focus:ring-blue-900/40 focus:border-blue-900 outline-hidden cursor-pointer"
                  >
                    {Object.keys(DEFAULT_CATEGORIES).map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Description (Optional)</label>
                <textarea
                  id="task-desc-input"
                  rows={2}
                  placeholder="Details, locations, context hints..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm focus:ring-2 focus:ring-blue-900/40 focus:border-blue-900 outline-hidden resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Scheduled Time</label>
                  <div className="relative">
                    <Clock size={16} className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400" />
                    <input
                      id="task-time-input"
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm focus:ring-2 focus:ring-blue-900/40 focus:border-blue-900 outline-hidden"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Estimated Mins</label>
                  <input
                    id="task-duration-input"
                    type="number"
                    min={1}
                    placeholder="e.g. 45"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm focus:ring-2 focus:ring-blue-900/40 focus:border-blue-900 outline-hidden"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Urgency</label>
                  <div className="flex rounded-lg border border-slate-200 p-1 bg-slate-50">
                    {(['low', 'medium', 'high'] as Priority[]).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPriority(p)}
                        className={`flex-1 text-[10px] uppercase font-bold py-1.5 rounded-md transition cursor-pointer select-none text-center ${
                          priority === p
                            ? p === 'high'
                              ? 'bg-rose-600 text-white shadow-xs'
                              : p === 'medium'
                              ? 'bg-amber-600 text-white shadow-xs'
                              : 'bg-blue-900 text-white shadow-xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Customizable Repeat Days & Pattern Scheduler */}
              <div className="border-t border-slate-100 pt-4 mt-1.5 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      id="is-recurring-checkbox"
                      checked={isRecurring}
                      onChange={(e) => {
                        setIsRecurring(e.target.checked);
                        if (e.target.checked && repeatDays.length === 0) {
                          // Select current day index by default when checking
                          setRepeatDays([currentDate.getDay()]);
                        }
                      }}
                      className="w-4 h-4 text-blue-900 border-slate-300 rounded focus:ring-blue-900 cursor-pointer"
                    />
                    <label htmlFor="is-recurring-checkbox" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                      Repeat / Recurring Schedule
                    </label>
                  </div>
                  {isRecurring && (
                    <span className="text-[10px] bg-blue-50 text-blue-900 px-2.5 py-0.5 rounded-full font-bold border border-blue-105 active:scale-95 transition-all">
                      Custom Active Days
                    </span>
                  )}
                </div>

                <AnimatePresence>
                  {isRecurring && (
                    <motion.div
                      id="recurring-options-panel"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex flex-col gap-4 bg-slate-50/50 p-4 rounded-xl border border-slate-200 overflow-hidden"
                    >
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Select Active Days</span>
                          <div className="flex items-center gap-2 text-[10px]">
                            <button
                              type="button"
                              onClick={() => setRepeatDays([1, 2, 3, 4, 5])}
                              className="text-blue-900 hover:underline font-bold cursor-pointer"
                            >
                              Weekdays
                            </button>
                            <span className="text-slate-300">|</span>
                            <button
                              type="button"
                              onClick={() => setRepeatDays([1, 2, 3, 4, 5, 6, 0])}
                              className="text-blue-900 hover:underline font-bold cursor-pointer"
                            >
                              Daily
                            </button>
                            <span className="text-slate-300">|</span>
                            <button
                              type="button"
                              onClick={() => setRepeatDays([])}
                              className="text-rose-600 hover:underline font-bold cursor-pointer"
                            >
                              Clear
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {[
                            { label: 'Mon', value: 1 },
                            { label: 'Tue', value: 2 },
                            { label: 'Wed', value: 3 },
                            { label: 'Thu', value: 4 },
                            { label: 'Fri', value: 5 },
                            { label: 'Sat', value: 6 },
                            { label: 'Sun', value: 0 },
                          ].map((day) => {
                            const isSelected = repeatDays.includes(day.value);
                            return (
                              <button
                                key={day.value}
                                type="button"
                                onClick={() => {
                                  if (isSelected) {
                                    setRepeatDays(repeatDays.filter((d) => d !== day.value));
                                  } else {
                                    setRepeatDays([...repeatDays, day.value]);
                                  }
                                }}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition cursor-pointer select-none ${
                                  isSelected
                                    ? 'bg-blue-900 border-blue-900 text-white font-bold shadow-2xs'
                                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                }`}
                              >
                                {day.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Repeat Duration (Weeks)</label>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min={1}
                              max={520}
                              value={repeatWeeks}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                setRepeatWeeks(isNaN(val) ? 1 : Math.max(1, val));
                              }}
                              className="w-20 px-2.5 py-1 text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-lg text-center focus:ring-1 focus:ring-blue-950 focus:outline-hidden"
                            />
                            <span className="text-xs text-slate-500 font-semibold">weeks</span>
                          </div>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={52}
                          value={repeatWeeks > 52 ? 52 : repeatWeeks}
                          onChange={(e) => setRepeatWeeks(parseInt(e.target.value))}
                          className="w-full accent-blue-900 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                        />
                        <div className="flex justify-between text-[9px] text-slate-400 font-bold px-0.5 mt-0.5">
                          <span>1 Week</span>
                          <span>12 Wks</span>
                          <span>26 Wks (Half Yr)</span>
                          <span>52 Wks (1 Yr)</span>
                        </div>
                      </div>

                      {/* Info preview panel */}
                      <div className="bg-white border border-slate-200/80 p-3 rounded-lg flex items-start gap-2.5">
                        <div className="w-1.5 h-1.5 bg-blue-900 rounded-full mt-1.5 shrink-0" />
                        <div className="text-[11px] text-slate-600 leading-relaxed font-medium">
                          {repeatDays.length === 0 ? (
                            <span className="text-amber-600 font-semibold flex items-center gap-1">
                              Please select at least one day to generate instances of this task.
                            </span>
                          ) : (
                            <>
                              Will create <strong className="text-blue-900">{repeatWeeks * repeatDays.length} total tasks</strong> across selected days (
                              {repeatDays
                                .map((d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d])
                                .join(', ')}
                              ) starting from <strong className="text-slate-800">{currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</strong> for <strong className="text-slate-800">{repeatWeeks} weeks</strong>.
                            </>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Goal & Deadline Settings */}
              <div className="border-t border-slate-100 pt-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      id="is-goal-checkbox"
                      checked={isGoal}
                      onChange={(e) => {
                        setIsGoal(e.target.checked);
                        if (e.target.checked && !deadline) {
                          const nextWeek = new Date(currentDate);
                          nextWeek.setDate(nextWeek.getDate() + 7);
                          setDeadline(formatDateString(nextWeek));
                        }
                      }}
                      className="w-4 h-4 text-blue-900 border-slate-300 rounded focus:ring-blue-900 cursor-pointer"
                    />
                    <label htmlFor="is-goal-checkbox" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                      Mark as Goal Task (with Target Deadline)
                    </label>
                  </div>
                  {isGoal && (
                    <span className="text-[10px] bg-emerald-50 text-emerald-800 px-2.5 py-0.5 rounded-full font-bold border border-emerald-200">
                      Goal Mode
                    </span>
                  )}
                </div>

                <AnimatePresence>
                  {isGoal && (
                    <motion.div
                      id="goal-options-panel"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex flex-col gap-3 bg-slate-50/50 p-3.5 rounded-xl border border-slate-200 overflow-hidden"
                    >
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Target Deadline Date</label>
                        <input
                          id="goal-deadline-input"
                          type="date"
                          required
                          value={deadline}
                          onChange={(e) => setDeadline(e.target.value)}
                          className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-905 text-xs focus:ring-1 focus:ring-blue-950 focus:border-blue-950 outline-hidden cursor-pointer"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button
                id="submit-task-button"
                type="submit"
                className="bg-blue-900 hover:bg-blue-950 text-white font-bold text-xs uppercase tracking-wider py-3 rounded-xl transition shadow-xs hover:shadow-md cursor-pointer mt-2"
              >
                Add Action to Planner
              </button>
            </motion.form>
          )}
        </AnimatePresence>        {/* Filters and List */}
        <div className="bg-white p-3 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-200 shadow-xs flex flex-col gap-3 sm:gap-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 justify-between pb-3 border-b border-slate-200">
            <h3 className="font-display font-semibold text-slate-800 text-sm flex items-center gap-1.5 shrink-0">
              <SlidersHorizontal size={15} />
              Customize Filtering
            </h3>
            
            {/* Search Input */}
            <div className="relative flex-1 max-w-none sm:max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
              <input
                id="task-search-input"
                type="text"
                placeholder="Search actions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-900 text-xs focus:ring-1 focus:ring-blue-900 focus:border-blue-900 outline-hidden"
              />
            </div>
          </div>

          {/* Quick Filters */}
          <div className="flex flex-col gap-2.5 text-xs">
            {/* Category selection pill */}
            <div className="flex items-center gap-1 bg-slate-50/80 border border-slate-200 p-1 rounded-xl overflow-x-auto max-w-full scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <span className="text-[10px] font-bold text-slate-500 px-2 uppercase shrink-0">Cat:</span>
              {['All', ...Object.keys(DEFAULT_CATEGORIES)].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-lg font-semibold text-xs transition cursor-pointer shrink-0 ${
                    selectedCategory === cat ? 'bg-blue-900 text-white shadow-2xs font-bold' : 'text-slate-600 hover:text-blue-900 hover:bg-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Priority selection pill */}
            <div className="flex items-center gap-1 bg-slate-50/80 border border-slate-200 p-1 rounded-xl overflow-x-auto max-w-full scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <span className="text-[10px] font-bold text-slate-500 px-2 uppercase shrink-0">Priority:</span>
              {['All', 'low', 'medium', 'high'].map((p) => (
                <button
                  key={p}
                  onClick={() => setSelectedPriority(p)}
                  className={`px-3 py-1 rounded-lg font-semibold text-xs transition cursor-pointer capitalize shrink-0 ${
                    selectedPriority === p ? 'bg-blue-900 text-white shadow-2xs font-bold' : 'text-slate-600 hover:text-blue-900 hover:bg-white'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* INCOMPLETE TASKS LIST */}
          <div className="flex flex-col gap-2">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <span>ACTIVE SCHEDULES ({incompleteTasks.length})</span>
              <span className="flex-1 h-[1px] bg-slate-100" />
            </h4>

            {incompleteTasks.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6 border border-dashed border-slate-200 rounded-xl bg-slate-50">
                No active tasks listed for this date matching filter
              </p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {incompleteTasks.map((task) => {
                  const categoryInfo = DEFAULT_CATEGORIES[task.category] || DEFAULT_CATEGORIES['Other'];
                  const isEditing = editingTaskId === task.id;                  return (
                    <div
                      key={task.id}
                      id={`task-item-${task.id}`}
                      className="group p-3 sm:p-4 bg-white rounded-xl border border-slate-205 transition-all active:border-blue-200 active:bg-slate-50/40 md:hover:border-blue-200 md:hover:bg-slate-50/40 md:hover:shadow-2xs flex items-start gap-2.5 sm:gap-3.5"
                    >
                      <button
                        onClick={() => onToggleTask(task.id)}
                        className="touch-target p-1 text-slate-400 active:text-blue-900 mt-0.5 shrink-0 -ml-1"
                        title="Mark Complete"
                      >
                        <Circle size={22} className="stroke-1.5 text-slate-400" />
                      </button>

                      <TaskIcon task={task} size={16} completed={false} className="mt-0.5" />

                      {/* Content Area */}
                      <div className="flex-1 min-w-0">
                        {isEditing ? (
                          <form onSubmit={(e) => handleEditSubmit(e, task.id)} className="flex flex-col gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                            <input
                              type="text"
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              className="px-2.5 py-1.5 border border-slate-200 text-xs rounded bg-white text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-blue-900"
                              required
                            />
                            <textarea
                              value={editDesc}
                              onChange={(e) => setEditDesc(e.target.value)}
                              placeholder="Description"
                              className="px-2.5 py-1.5 border border-slate-200 text-xs rounded bg-white text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-blue-900 resize-none"
                              rows={2}
                            />
                            <div className="flex items-center gap-2">
                              <select
                                value={editCategory}
                                onChange={(e) => setEditCategory(e.target.value)}
                                className="px-2 py-1.5 border border-slate-200 text-[10px] rounded bg-white text-slate-900 focus:ring-1 focus:ring-blue-900"
                              >
                                {Object.keys(DEFAULT_CATEGORIES).map((cat) => (
                                  <option key={cat} value={cat}>{cat}</option>
                                ))}
                              </select>
                              <select
                                value={editPriority}
                                onChange={(e) => setEditPriority(e.target.value as Priority)}
                                className="px-2 py-1.5 border border-slate-200 text-[10px] rounded bg-white text-slate-900 focus:ring-1 focus:ring-blue-900"
                              >
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                              </select>
                              <input
                                type="time"
                                value={editTime}
                                onChange={(e) => setEditTime(e.target.value)}
                                className="px-2 py-1.5 border border-slate-200 text-[10px] rounded bg-white text-slate-900 focus:ring-1 focus:ring-blue-900"
                              />
                            </div>
                            <div className="flex flex-wrap items-center gap-2.5 border-t border-slate-200/50 pt-2 mt-1">
                              <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={editIsGoal}
                                  onChange={(e) => {
                                    setEditIsGoal(e.target.checked);
                                    if (e.target.checked && !editDeadline) {
                                      const nextWeek = new Date(currentDate);
                                      nextWeek.setDate(nextWeek.getDate() + 7);
                                      setEditDeadline(formatDateString(nextWeek));
                                    }
                                  }}
                                  className="w-3.5 h-3.5 text-blue-900 border-slate-300 rounded focus:ring-1 focus:ring-blue-900"
                                />
                                Goal Task
                              </label>

                              {editIsGoal && (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[9px] font-bold text-slate-400 uppercase">Deadline:</span>
                                  <input
                                    type="date"
                                    required
                                    value={editDeadline}
                                    onChange={(e) => setEditDeadline(e.target.value)}
                                    className="px-1.5 py-1 border border-slate-200 text-[10px] rounded bg-white text-slate-900 focus:ring-1"
                                  />
                                </div>
                              )}
                            </div>
                            <div className="flex justify-end gap-1 mt-1 text-[10px]">
                              <button
                                type="button"
                                onClick={() => setEditingTaskId(null)}
                                className="px-2.5 py-1 text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 rounded cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                className="px-2.5 py-1 text-white bg-blue-900 hover:bg-blue-950 rounded cursor-pointer font-bold"
                              >
                                Save
                              </button>
                            </div>
                          </form>
                        ) : (
                          <>
                            <div className="flex flex-wrap items-center gap-2">
                              <h5 className="font-semibold text-sm text-slate-900 truncate">
                                {task.title}
                              </h5>
                              <span className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded uppercase ${priorityClasses[task.priority]}`}>
                                {task.priority}
                              </span>
                              <span className={`text-[9.5px] font-medium px-2 py-0.2 rounded-full border ${categoryInfo.bgClass}`}>
                                {task.category}
                              </span>
                              {task.isGoal && (
                                <span className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 uppercase shrink-0 ${
                                  task.completed ? 'bg-slate-50 border-slate-200 text-slate-400' : getDeadlineStatus(task.deadline)?.class || 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                }`}>
                                  <Target size={10} />
                                  <span>Goal {task.deadline ? `• ${getDeadlineStatus(task.deadline)?.text}` : ''}</span>
                                </span>
                              )}
                            </div>

                            {task.description && (
                              <p className="text-xs text-slate-605 text-slate-550 mt-1 line-clamp-2">
                                {task.description}
                              </p>
                            )}

                            {/* Scheduled details pill label */}
                            <div className="flex flex-wrap items-center gap-3 mt-2 text-[10px] text-slate-500 font-medium">
                              {task.time && (
                                <span className="flex items-center gap-1">
                                  <Clock size={11} className="text-slate-400" />
                                  <span>{task.time}</span>
                                </span>
                              )}
                              {task.duration && (
                                <span className="flex items-center gap-1">
                                  <Briefcase size={11} className="text-slate-400" />
                                  <span>{task.duration} mins</span>
                                </span>
                              )}
                              {task.isGoal && task.deadline && (
                                <span className="flex items-center gap-1.5 text-slate-500 font-semibold bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200/50">
                                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                  <span>Target: {new Date(task.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                </span>
                              )}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Side Actions (Delete / Edit) */}
                      {!isEditing && (
                        <div className="flex items-center gap-0.5 sm:gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0">
                          <button
                            onClick={() => startEdit(task)}
                            className="touch-target p-2 sm:p-1 text-slate-500 active:text-blue-900 active:bg-slate-100 rounded-lg transition"
                            title="Edit action"
                          >
                            <Edit2 size={16} className="sm:w-3.5 sm:h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteTask(task.id)}
                            className="touch-target p-2 sm:p-1 text-slate-500 active:text-rose-600 active:bg-rose-50 rounded-lg transition"
                            title="Delete action"
                          >
                            <Trash2 size={16} className="sm:w-3.5 sm:h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* COMPLETED TASKS LIST */}
          <div className="flex flex-col gap-2 mt-2">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <span>COMPLETED ({completedTasks.length})</span>
              <span className="flex-1 h-[1px] bg-slate-100" />
            </h4>

            {completedTasks.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4 border border-dashed border-slate-200 rounded-xl bg-slate-50">
                Completed accomplishments will populate here
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {completedTasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-3 bg-slate-50/60 rounded-xl border border-slate-200 flex items-center justify-between text-slate-600 gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button
                        onClick={() => onToggleTask(task.id)}
                        className="p-0.5 text-emerald-600 hover:text-slate-500 mt-0.5 cursor-pointer shrink-0"
                        title="Mark Incomplete"
                      >
                        <CheckCircle size={18} className="fill-emerald-50 text-emerald-600 stroke-1.5" />
                      </button>
                      <TaskIcon task={task} size={14} completed />
                      <div className="min-w-0">
                        <span className="text-sm font-medium line-through text-slate-400 truncate block">
                          {task.title}
                        </span>
                        {task.time && (
                          <span className="text-[9px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <Clock size={10} />
                            Completed scheduled task ({task.time})
                          </span>
                        )}
                        {task.isGoal && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-emerald-650 bg-emerald-50/70 border border-emerald-200/50 px-2 py-0.5 rounded-full mt-1.5">
                            <Target size={10} />
                            Goal Achieved
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => onDeleteTask(task.id)}
                      className="touch-target p-2 text-slate-500 active:text-rose-600 active:bg-rose-50 rounded-lg transition shrink-0"
                      title="Delete log"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Hourly Timeline / Planner (5 Cols) */}
      <div className="lg:col-span-5 bg-white p-4 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-200 shadow-xs flex flex-col gap-4">
        <div>
          <h3 className="font-display font-bold text-slate-900 text-sm flex items-center gap-2">
            <CalendarDays size={16} className="text-blue-900 animate-pulse" />
            Daily Planner Timeline
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">Visual representation of today's time blocks</p>
        </div>

        {/* Timeline representation */}
        <div className="flex flex-col border-l border-slate-200 pl-3 sm:pl-4 ml-1 sm:ml-2 gap-3 sm:gap-4 max-h-[40dvh] sm:max-h-[500px] lg:max-h-[600px] overflow-y-auto pr-1">
          {hours.map((hour) => {
            const displayTime = `${hour > 12 ? hour - 12 : hour} ${hour >= 12 ? 'PM' : 'AM'}`;
            
            // Match with tasks that fall in this hour (e.g. task time begins with '08:' or '8:')
            const formattedHourStr = String(hour).padStart(2, '0');
            const hourTasks = dayTasks.filter((t) => t.time && t.time.startsWith(`${formattedHourStr}:`));

            return (
              <div key={hour} className="relative group/time flex items-start gap-4">
                {/* Time Indicator Marker on the Border */}
                <div className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-slate-100 border border-slate-300 group-hover/time:bg-blue-900 transition" />
                
                {/* Hour Label */}
                <span className="text-[10px] font-bold text-slate-500 w-12 pt-0.5 select-none shrink-0 text-right">
                  {displayTime}
                </span>

                {/* Box holding matched scheduled events */}
                <div className="flex-1 flex flex-col gap-1.5 min-h-[32px] justify-center">
                  {hourTasks.length === 0 ? (
                    <span className="text-[10px] font-medium text-slate-400 italic group-hover/time:text-slate-600 transition">
                      No events scheduled
                    </span>
                  ) : (
                    hourTasks.map((t) => {
                      const cat = DEFAULT_CATEGORIES[t.category] || DEFAULT_CATEGORIES['Other'];
                      return (
                        <div
                          key={t.id}
                          className={`p-2 rounded-lg border text-xs flex flex-col gap-0.5 relative cursor-pointer hover:shadow-xs transition ${
                            t.completed
                              ? 'bg-slate-50/80 border-slate-200 text-slate-400 line-through font-medium'
                              : `${cat.bgClass} shadow-2xs`
                          }`}
                        >
                          <div className="flex items-center justify-between font-semibold gap-2">
                            <span className="truncate flex items-center gap-1.5 min-w-0">
                              <TaskIcon task={t} size={12} variant="plain" completed={t.completed} />
                              <span className="truncate">{t.title}</span>
                            </span>
                            <span className="text-[8px] font-bold uppercase">{t.time}</span>
                          </div>
                          {t.description && (
                            <span className="text-[10px] text-slate-500 font-normal truncate font-sans">
                              {t.description}
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
