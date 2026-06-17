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
  Clock,
  Briefcase,
  SlidersHorizontal,
  X,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Target,
  FileCheck2
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
      class: 'bg-rose-500/15 border-rose-500/20 text-rose-500 font-bold',
      overdue: true,
    };
  } else if (diffDays === 0) {
    return {
      text: `due today`,
      class: 'bg-amber-500/15 border-amber-500/20 text-amber-500 font-bold',
      overdue: false,
    };
  } else if (diffDays === 1) {
    return {
      text: `due tomorrow`,
      class: 'bg-blue-500/15 border-blue-500/20 text-blue-500 font-bold',
      overdue: false,
    };
  } else {
    return {
      text: `${diffDays} days left`,
      class: 'bg-emerald-500/15 border-emerald-500/20 text-emerald-500 font-semibold',
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

  // New inline task form state (collapsed/expanded option)
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
        const dayOfWeek = d.getDay();
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

  const hours = Array.from({ length: 15 }, (_, i) => i + 7); // 7 AM to 9 PM

  const priorityClasses = {
    high: 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400 font-bold',
    medium: 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 font-bold',
    low: 'bg-m3-surface-variant text-m3-on-surface-variant font-medium',
  };

  const changeDateByOffset = (days: number) => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + days);
    onChangeDate(next);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* LEFT COLUMN: Controls & Task Checklist Form (7 Cols) */}
      <div className="lg:col-span-7 flex flex-col gap-4">
        {/* Day Navigation Header */}
        <div className="bg-m3-surface-container p-4 rounded-3xl border border-m3-surface-variant/30 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3.5 shadow-2xs">
          <div className="flex items-center justify-between sm:justify-start gap-3 w-full sm:w-auto">
            <button
              onClick={() => changeDateByOffset(-1)}
              className="p-2 border border-m3-outline/20 rounded-full hover:bg-m3-surface-variant/40 text-m3-on-surface transition active:scale-95 cursor-pointer shrink-0"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="text-center sm:text-left flex-1 sm:flex-none min-w-0">
              <h2 className="text-base sm:text-lg font-extrabold font-display text-m3-on-surface tracking-tight leading-tight truncate">
                {currentDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </h2>
              <p className="text-[10px] sm:text-xs text-m3-on-surface-variant font-semibold mt-0.5">
                {dayTasks.length} tasks • {dayTasks.filter((t) => t.completed).length} done
              </p>
            </div>
            <button
              onClick={() => changeDateByOffset(1)}
              className="p-2 border border-m3-outline/20 rounded-full hover:bg-m3-surface-variant/40 text-m3-on-surface transition active:scale-95 cursor-pointer shrink-0"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <button
            id="add-task-trigger"
            onClick={() => setIsAdding(!isAdding)}
            className={`flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-bold transition cursor-pointer shadow-xs active:scale-95 w-full sm:w-auto ${
              isAdding
                ? 'bg-rose-500/10 border border-rose-500/25 text-rose-500 hover:bg-rose-500/15'
                : 'bg-m3-primary text-m3-on-primary hover:bg-m3-primary/90'
            }`}
          >
            {isAdding ? <X size={14} /> : <Plus size={14} />}
            <span>{isAdding ? 'Cancel' : 'Add Task'}</span>
          </button>
        </div>

        {/* Collapsible Inline Task Form */}
        <AnimatePresence>
          {isAdding && (
            <motion.form
              id="new-task-form"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              onSubmit={handleFormSubmit}
              className="bg-m3-surface-container p-5 rounded-3xl border border-m3-surface-variant/30 flex flex-col gap-4 overflow-hidden shadow-xs"
            >
              <h3 className="font-display font-extrabold text-sm text-m3-on-surface">Add New Calendar Action</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-m3-on-surface-variant uppercase tracking-wider pl-1">What needs to be done? *</label>
                  <input
                    id="task-title-input"
                    type="text"
                    required
                    placeholder="e.g. Review milestone blueprints"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="px-4 py-2.5 rounded-2xl border border-m3-outline/20 bg-m3-surface text-m3-on-surface text-sm focus:ring-2 focus:ring-m3-primary/30 outline-hidden"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-m3-on-surface-variant uppercase tracking-wider pl-1">Category</label>
                  <select
                    id="task-category-select"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="px-4 py-2.5 rounded-2xl border border-m3-outline/20 bg-m3-surface text-m3-on-surface text-sm focus:ring-2 focus:ring-m3-primary/30 outline-hidden cursor-pointer"
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
                <label className="text-[10px] font-bold text-m3-on-surface-variant uppercase tracking-wider pl-1">Description (Optional)</label>
                <textarea
                  id="task-desc-input"
                  rows={2}
                  placeholder="Details, locations, context hints..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="px-4 py-2.5 rounded-2xl border border-m3-outline/20 bg-m3-surface text-m3-on-surface text-sm focus:ring-2 focus:ring-m3-primary/30 outline-hidden resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-m3-on-surface-variant uppercase tracking-wider pl-1">Scheduled Time</label>
                  <div className="relative">
                    <Clock size={16} className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-m3-on-surface-variant" />
                    <input
                      id="task-time-input"
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-m3-outline/20 bg-m3-surface text-m3-on-surface text-sm focus:ring-2 focus:ring-m3-primary/30 outline-hidden"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-m3-on-surface-variant uppercase tracking-wider pl-1">Estimated Mins</label>
                  <input
                    id="task-duration-input"
                    type="number"
                    min={1}
                    placeholder="e.g. 45"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-2xl border border-m3-outline/20 bg-m3-surface text-m3-on-surface text-sm focus:ring-2 focus:ring-m3-primary/30 outline-hidden"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-m3-on-surface-variant uppercase tracking-wider pl-1">Urgency</label>
                  <div className="flex rounded-2xl border border-m3-outline/20 p-1 bg-m3-surface">
                    {(['low', 'medium', 'high'] as Priority[]).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPriority(p)}
                        className={`flex-1 text-[10px] uppercase font-bold py-1.5 rounded-xl transition cursor-pointer select-none text-center ${
                          priority === p
                            ? p === 'high'
                              ? 'bg-rose-500 text-white shadow-xs'
                              : p === 'medium'
                              ? 'bg-amber-500 text-white shadow-xs'
                              : 'bg-m3-primary text-white shadow-xs'
                            : 'text-m3-on-surface-variant hover:text-m3-on-surface'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Recurring Switcher */}
              <div className="border-t border-m3-outline/10 pt-4 mt-1 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      id="is-recurring-checkbox"
                      checked={isRecurring}
                      onChange={(e) => {
                        setIsRecurring(e.target.checked);
                        if (e.target.checked && repeatDays.length === 0) {
                          setRepeatDays([currentDate.getDay()]);
                        }
                      }}
                      className="w-4 h-4 text-m3-primary border-m3-outline/35 rounded focus:ring-m3-primary cursor-pointer"
                    />
                    <label htmlFor="is-recurring-checkbox" className="text-xs font-bold text-m3-on-surface cursor-pointer select-none">
                      Repeat Schedule
                    </label>
                  </div>
                  {isRecurring && (
                    <span className="text-[10px] bg-m3-primary-container text-m3-on-primary-container px-2.5 py-0.5 rounded-full font-bold">
                      Active Days
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
                      className="flex flex-col gap-4 bg-m3-surface p-4 rounded-2xl border border-m3-outline/20 overflow-hidden"
                    >
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <span className="text-[10px] font-bold text-m3-on-surface-variant uppercase tracking-wider">Select Days</span>
                          <div className="flex items-center gap-2 text-[10px]">
                            <button
                              type="button"
                              onClick={() => setRepeatDays([1, 2, 3, 4, 5])}
                              className="text-m3-primary hover:underline font-bold cursor-pointer"
                            >
                              Weekdays
                            </button>
                            <span className="text-m3-outline/30">|</span>
                            <button
                              type="button"
                              onClick={() => setRepeatDays([1, 2, 3, 4, 5, 6, 0])}
                              className="text-m3-primary hover:underline font-bold cursor-pointer"
                            >
                              Daily
                            </button>
                            <span className="text-m3-outline/30">|</span>
                            <button
                              type="button"
                              onClick={() => setRepeatDays([])}
                              className="text-red-500 hover:underline font-bold cursor-pointer"
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
                                    ? 'bg-m3-primary border-m3-primary text-white font-bold'
                                    : 'bg-m3-surface-container border-m3-outline/10 text-m3-on-surface-variant hover:bg-m3-surface-variant/30'
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
                          <label className="text-[10px] font-bold text-m3-on-surface-variant uppercase tracking-wider">Repeat Duration (Weeks)</label>
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
                              className="w-16 px-2 py-1 text-xs font-bold text-m3-on-surface bg-m3-surface-container border border-m3-outline/10 rounded-lg text-center"
                            />
                            <span className="text-xs text-m3-on-surface-variant font-semibold">weeks</span>
                          </div>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={52}
                          value={repeatWeeks > 52 ? 52 : repeatWeeks}
                          onChange={(e) => setRepeatWeeks(parseInt(e.target.value))}
                          className="w-full accent-m3-primary h-1.5 bg-m3-surface-variant rounded-lg appearance-none cursor-pointer"
                        />
                      </div>

                      <div className="bg-m3-surface-container/60 border border-m3-outline/10 p-3 rounded-xl flex items-start gap-2.5">
                        <div className="w-1.5 h-1.5 bg-m3-primary rounded-full mt-1.5 shrink-0" />
                        <div className="text-[11px] text-m3-on-surface-variant leading-relaxed font-semibold">
                          {repeatDays.length === 0 ? (
                            <span className="text-amber-500 font-bold">Select at least one day to generate instances of this task.</span>
                          ) : (
                            <>
                              Creates <strong className="text-m3-primary font-bold">{repeatWeeks * repeatDays.length} total tasks</strong> starting from <strong className="text-m3-on-surface">{currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</strong> for <strong className="text-m3-on-surface">{repeatWeeks} weeks</strong>.
                            </>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Goal & Deadline Settings */}
              <div className="border-t border-m3-outline/10 pt-4 flex flex-col gap-3">
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
                      className="w-4 h-4 text-m3-primary border-m3-outline/35 rounded focus:ring-m3-primary cursor-pointer"
                    />
                    <label htmlFor="is-goal-checkbox" className="text-xs font-bold text-m3-on-surface cursor-pointer select-none">
                      Mark as Goal (with Target Deadline)
                    </label>
                  </div>
                  {isGoal && (
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2.5 py-0.5 rounded-full font-bold">
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
                      className="flex flex-col gap-3 bg-m3-surface p-3.5 rounded-2xl border border-m3-outline/20 overflow-hidden"
                    >
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-m3-on-surface-variant uppercase tracking-wider pl-1">Target Deadline Date</label>
                        <input
                          id="goal-deadline-input"
                          type="date"
                          required
                          value={deadline}
                          onChange={(e) => setDeadline(e.target.value)}
                          className="px-3 py-2 rounded-lg border border-m3-outline/20 bg-m3-surface-container text-m3-on-surface text-xs outline-hidden cursor-pointer"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button
                id="submit-task-button"
                type="submit"
                className="bg-m3-primary hover:bg-m3-primary/95 text-white font-bold text-xs uppercase tracking-wider py-3 rounded-2xl transition shadow-xs hover:shadow-md cursor-pointer mt-1"
              >
                Add Action to Planner
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Task List Card */}
        <div className="bg-m3-surface-container p-4 rounded-3xl border border-m3-surface-variant/30 flex flex-col gap-4 shadow-2xs">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 justify-between pb-3 border-b border-m3-outline/10">
            <h3 className="font-display font-extrabold text-m3-on-surface text-sm flex items-center gap-1.5 shrink-0">
              <SlidersHorizontal size={15} />
              Filter & Search
            </h3>
            
            {/* Search Input */}
            <div className="relative flex-1 max-w-none">
              <Search size={14} className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-m3-on-surface-variant" />
              <input
                id="task-search-input"
                type="text"
                placeholder="Search tasks..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-m3-outline/15 bg-m3-surface text-m3-on-surface text-xs focus:ring-2 focus:ring-m3-primary/20 outline-hidden shadow-3xs"
              />
            </div>
          </div>

          {/* Quick Filters */}
          <div className="flex flex-col gap-3 text-xs">
            {/* Category selection row */}
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-extrabold text-m3-on-surface-variant uppercase tracking-wider w-16 shrink-0 text-right select-none">Cat:</span>
              <div className="flex-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-fade-mask py-0.5">
                {['All', ...Object.keys(DEFAULT_CATEGORIES)].map((cat) => {
                  const isActive = selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1.5 rounded-full font-bold text-xs transition-all active:scale-95 cursor-pointer shrink-0 border flex items-center gap-1.5 select-none ${
                        isActive
                          ? 'bg-m3-primary border-m3-primary text-white font-extrabold shadow-3xs'
                          : 'bg-m3-surface border-m3-outline/15 text-m3-on-surface-variant hover:bg-m3-surface-variant/20 hover:text-m3-on-surface'
                      }`}
                    >
                      {isActive && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                      <span>{cat}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Priority selection row */}
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-extrabold text-m3-on-surface-variant uppercase tracking-wider w-16 shrink-0 text-right select-none">Urgency:</span>
              <div className="flex-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-fade-mask py-0.5">
                {['All', 'low', 'medium', 'high'].map((p) => {
                  const isActive = selectedPriority === p;
                  return (
                    <button
                      key={p}
                      onClick={() => setSelectedPriority(p)}
                      className={`px-3 py-1.5 rounded-full font-bold text-xs transition-all active:scale-95 cursor-pointer capitalize shrink-0 border flex items-center gap-1.5 select-none ${
                        isActive
                          ? 'bg-m3-primary border-m3-primary text-white font-extrabold shadow-3xs'
                          : 'bg-m3-surface border-m3-outline/15 text-m3-on-surface-variant hover:bg-m3-surface-variant/20 hover:text-m3-on-surface'
                      }`}
                    >
                      {isActive && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                      <span>{p}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* INCOMPLETE TASKS LIST */}
          <div className="flex flex-col gap-2 mt-1">
            <h4 className="text-[10px] font-extrabold text-m3-on-surface-variant/70 uppercase tracking-widest flex items-center gap-2">
              <span>Active Tasks ({incompleteTasks.length})</span>
              <span className="flex-1 h-[1px] bg-m3-outline/10" />
            </h4>

            {incompleteTasks.length === 0 ? (
              <p className="text-xs text-m3-on-surface-variant text-center py-8 border border-dashed border-m3-outline/20 rounded-2xl bg-m3-surface/30">
                No active tasks listed for this date
              </p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {incompleteTasks.map((task) => {
                  const categoryInfo = DEFAULT_CATEGORIES[task.category] || DEFAULT_CATEGORIES['Other'];
                  const isEditing = editingTaskId === task.id;
                  return (
                    <div
                      key={task.id}
                      id={`task-item-${task.id}`}
                      className="group p-3 bg-m3-surface rounded-2xl border border-m3-outline/10 transition-all hover:border-m3-primary/30 flex items-start gap-3"
                    >
                      <button
                        onClick={() => onToggleTask(task.id)}
                        className="p-1 text-m3-outline hover:text-m3-primary transition-colors shrink-0 -mt-0.5"
                        title="Mark Complete"
                      >
                        <Circle size={20} className="text-m3-outline" />
                      </button>

                      <div className="mt-0.5">
                        <TaskIcon task={task} size={15} completed={false} />
                      </div>

                      {/* Content Area */}
                      <div className="flex-1 min-w-0">
                        {isEditing ? (
                          <form onSubmit={(e) => handleEditSubmit(e, task.id)} className="flex flex-col gap-2 bg-m3-surface-container p-3 rounded-xl border border-m3-outline/25">
                            <input
                              type="text"
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              className="px-2.5 py-1.5 border border-m3-outline/20 text-xs rounded-lg bg-m3-surface text-m3-on-surface focus:ring-1 focus:ring-m3-primary focus:outline-hidden"
                              required
                            />
                            <textarea
                              value={editDesc}
                              onChange={(e) => setEditDesc(e.target.value)}
                              placeholder="Description"
                              className="px-2.5 py-1.5 border border-m3-outline/20 text-xs rounded-lg bg-m3-surface text-m3-on-surface focus:ring-1 focus:ring-m3-primary focus:outline-hidden resize-none"
                              rows={2}
                            />
                            <div className="flex items-center gap-2">
                              <select
                                value={editCategory}
                                onChange={(e) => setEditCategory(e.target.value)}
                                className="px-2 py-1.5 border border-m3-outline/20 text-[10px] rounded-lg bg-m3-surface text-m3-on-surface"
                              >
                                {Object.keys(DEFAULT_CATEGORIES).map((cat) => (
                                  <option key={cat} value={cat}>{cat}</option>
                                ))}
                              </select>
                              <select
                                value={editPriority}
                                onChange={(e) => setEditPriority(e.target.value as Priority)}
                                className="px-2 py-1.5 border border-m3-outline/20 text-[10px] rounded-lg bg-m3-surface text-m3-on-surface"
                              >
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                              </select>
                              <input
                                type="time"
                                value={editTime}
                                onChange={(e) => setEditTime(e.target.value)}
                                className="px-2 py-1.5 border border-m3-outline/20 text-[10px] rounded-lg bg-m3-surface text-m3-on-surface"
                              />
                            </div>
                            <div className="flex flex-wrap items-center gap-2.5 border-t border-m3-outline/10 pt-2 mt-1">
                              <label className="flex items-center gap-1.5 text-[10px] font-bold text-m3-on-surface-variant cursor-pointer select-none">
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
                                  className="w-3.5 h-3.5 text-m3-primary border-m3-outline/30 rounded focus:ring-m3-primary"
                                />
                                Goal Task
                              </label>

                              {editIsGoal && (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[9px] font-bold text-m3-on-surface-variant uppercase">Deadline:</span>
                                  <input
                                    type="date"
                                    required
                                    value={editDeadline}
                                    onChange={(e) => setEditDeadline(e.target.value)}
                                    className="px-1.5 py-1 border border-m3-outline/20 text-[10px] rounded bg-m3-surface text-m3-on-surface"
                                  />
                                </div>
                              )}
                            </div>
                            <div className="flex justify-end gap-1.5 mt-1 text-[10px]">
                              <button
                                type="button"
                                onClick={() => setEditingTaskId(null)}
                                className="px-2.5 py-1 text-m3-on-surface-variant bg-m3-surface hover:bg-m3-surface-variant/30 border border-m3-outline/20 rounded-lg cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                className="px-2.5 py-1 text-white bg-m3-primary hover:bg-m3-primary/90 rounded-lg cursor-pointer font-bold"
                              >
                                Save
                              </button>
                            </div>
                          </form>
                        ) : (
                          <>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <h5 className="font-bold text-sm text-m3-on-surface leading-snug">
                                {task.title}
                              </h5>
                              <span className={`text-[8.5px] font-bold px-2 py-0.5 rounded-full border uppercase shrink-0 ${priorityClasses[task.priority]}`}>
                                {task.priority}
                              </span>
                              <span className={`text-[8.5px] font-bold px-2.5 py-0.5 rounded-full border shrink-0 ${categoryInfo.bgClass}`}>
                                {task.category}
                              </span>
                              {task.isGoal && (
                                <span className={`text-[8.5px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1 uppercase shrink-0 ${
                                  task.completed
                                    ? 'bg-m3-surface-variant border-m3-outline/20 text-m3-on-surface-variant'
                                    : getDeadlineStatus(task.deadline)?.class || 'bg-emerald-500/15 border-emerald-500/20 text-emerald-500'
                                }`}>
                                  <Target size={9} />
                                  <span>Goal {task.deadline ? `• ${getDeadlineStatus(task.deadline)?.text}` : ''}</span>
                                </span>
                              )}
                            </div>

                            {task.description && (
                              <p className="text-xs text-m3-on-surface-variant/90 mt-1 font-medium leading-relaxed">
                                {task.description}
                              </p>
                            )}

                            {/* Scheduled details */}
                            <div className="flex flex-wrap items-center gap-3 mt-2 text-[10px] text-m3-on-surface-variant font-bold">
                              {task.time && (
                                <span className="flex items-center gap-1">
                                  <Clock size={11} className="text-m3-primary/80" />
                                  <span>{task.time}</span>
                                </span>
                              )}
                              {task.duration && (
                                <span className="flex items-center gap-1">
                                  <Briefcase size={11} className="text-m3-primary/80" />
                                  <span>{task.duration} mins</span>
                                </span>
                              )}
                              {task.isGoal && task.deadline && (
                                <span className="flex items-center gap-1 bg-m3-surface-container border border-m3-outline/10 px-2 py-0.5 rounded-lg text-[9px]">
                                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                  <span>Due: {new Date(task.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                </span>
                              )}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Side Actions (Delete / Edit) */}
                      {!isEditing && (
                        <div className="flex items-center gap-0.5 transition-opacity shrink-0">
                          <button
                            onClick={() => startEdit(task)}
                            className="p-1.5 text-m3-on-surface-variant hover:bg-m3-surface-variant/40 rounded-lg transition"
                            title="Edit task"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => onDeleteTask(task.id)}
                            className="p-1.5 text-m3-on-surface-variant hover:text-red-500 hover:bg-red-500/10 rounded-lg transition"
                            title="Delete task"
                          >
                            <Trash2 size={13} />
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
            <h4 className="text-[10px] font-extrabold text-m3-on-surface-variant/70 uppercase tracking-widest flex items-center gap-2">
              <span>Completed ({completedTasks.length})</span>
              <span className="flex-1 h-[1px] bg-m3-outline/10" />
            </h4>

            {completedTasks.length === 0 ? (
              <p className="text-xs text-m3-on-surface-variant text-center py-6 border border-dashed border-m3-outline/20 rounded-2xl bg-m3-surface/30">
                Completed accomplishments will populate here
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {completedTasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-3 bg-m3-surface/50 rounded-2xl border border-m3-outline/5 flex items-center justify-between text-m3-on-surface-variant gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        onClick={() => onToggleTask(task.id)}
                        className="p-1 text-emerald-500 hover:text-m3-outline shrink-0 -mt-0.5 cursor-pointer"
                        title="Mark Incomplete"
                      >
                        <CheckCircle size={20} className="fill-emerald-500/10 text-emerald-500" />
                      </button>
                      <div className="mt-0.5">
                        <TaskIcon task={task} size={14} completed />
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm font-semibold line-through text-m3-on-surface-variant/60 truncate block leading-tight">
                          {task.title}
                        </span>
                        {task.time && (
                          <span className="text-[9px] text-m3-on-surface-variant/80 flex items-center gap-1 mt-0.5 font-semibold">
                            <Clock size={10} />
                            Completed ({task.time})
                          </span>
                        )}
                        {task.isGoal && (
                          <span className="inline-flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full mt-1">
                            <Target size={8} />
                            Goal Met
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => onDeleteTask(task.id)}
                      className="p-2 text-m3-on-surface-variant hover:text-red-500 hover:bg-red-500/10 rounded-lg transition shrink-0 cursor-pointer"
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
      <div className="lg:col-span-5 bg-m3-surface-container p-4 rounded-3xl border border-m3-surface-variant/30 flex flex-col gap-4 shadow-2xs">
        <div>
          <h3 className="font-display font-extrabold text-m3-on-surface text-sm flex items-center gap-2">
            <FileCheck2 size={16} className="text-m3-primary" />
            Planner Timeline
          </h3>
          <p className="text-xs text-m3-on-surface-variant mt-0.5">Visual representation of today's time blocks</p>
        </div>

        {/* Timeline representation */}
        <div className="flex flex-col border-l border-m3-outline/15 pl-4 ml-2 gap-4 max-h-[500px] overflow-y-auto pr-1">
          {hours.map((hour) => {
            const displayTime = `${hour > 12 ? hour - 12 : hour} ${hour >= 12 ? 'PM' : 'AM'}`;
            const formattedHourStr = String(hour).padStart(2, '0');
            const hourTasks = dayTasks.filter((t) => t.time && t.time.startsWith(`${formattedHourStr}:`));

            return (
              <div key={hour} className="relative group/time flex items-start gap-3">
                {/* Time Indicator Marker on the Border */}
                <div className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-m3-surface border-2 border-m3-outline/30 group-hover/time:border-m3-primary transition-colors duration-200" />
                
                {/* Hour Label */}
                <span className="text-[10px] font-extrabold text-m3-on-surface-variant w-10 pt-0.5 select-none shrink-0 text-right">
                  {displayTime}
                </span>

                {/* Box holding matched scheduled events */}
                <div className="flex-1 flex flex-col gap-1.5 min-h-[28px] justify-center">
                  {hourTasks.length === 0 ? (
                    <span className="text-[10px] font-semibold text-m3-on-surface-variant/40 italic group-hover/time:text-m3-on-surface-variant transition-colors duration-150">
                      Empty slot
                    </span>
                  ) : (
                    hourTasks.map((t) => {
                      const cat = DEFAULT_CATEGORIES[t.category] || DEFAULT_CATEGORIES['Other'];
                      return (
                        <div
                          key={t.id}
                          className={`p-2 rounded-xl border text-xs flex flex-col gap-0.5 relative cursor-pointer hover:shadow-2xs transition ${
                            t.completed
                              ? 'bg-m3-surface-variant/60 border-m3-outline/10 text-m3-on-surface-variant/60 line-through'
                              : `${cat.bgClass} shadow-3xs`
                          }`}
                        >
                          <div className="flex items-center justify-between font-bold gap-2">
                            <span className="truncate flex items-center gap-1.5 min-w-0">
                              <TaskIcon task={t} size={11} variant="plain" completed={t.completed} />
                              <span className="truncate">{t.title}</span>
                            </span>
                            <span className="text-[8px] font-extrabold uppercase shrink-0">{t.time}</span>
                          </div>
                          {t.description && (
                            <span className="text-[9px] text-m3-on-surface-variant/80 truncate font-semibold">
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
