import { Category, Task } from './types';

// Safe local date formatter to prevent timezone shifting
export function formatDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Convert a YYYY-MM-DD string to a local Date object safely
export function parseDateString(str: string): Date {
  const [year, month, day] = str.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export const DEFAULT_CATEGORIES: Record<string, Category> = {
  Work: {
    name: 'Work',
    color: 'blue',
    bgClass: 'bg-blue-50 text-blue-700 border-blue-200/60',
    textClass: 'text-blue-700',
    borderClass: 'border-blue-200/60',
    accentBg: 'bg-blue-600',
  },
  Personal: {
    name: 'Personal',
    color: 'emerald',
    bgClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
    textClass: 'text-emerald-700',
    borderClass: 'border-emerald-200/60',
    accentBg: 'bg-emerald-600',
  },
  Health: {
    name: 'Health',
    color: 'rose',
    bgClass: 'bg-rose-50 text-rose-700 border-rose-200/60',
    textClass: 'text-rose-700',
    borderClass: 'border-rose-200/60',
    accentBg: 'bg-rose-600',
  },
  Finance: {
    name: 'Finance',
    color: 'amber',
    bgClass: 'bg-amber-50 text-amber-800 border-amber-200/80',
    textClass: 'text-amber-800',
    borderClass: 'border-amber-200/80',
    accentBg: 'bg-amber-600',
  },
  Learning: {
    name: 'Learning',
    color: 'violet',
    bgClass: 'bg-violet-50 text-violet-700 border-violet-200/60',
    textClass: 'text-violet-700',
    borderClass: 'border-violet-200/60',
    accentBg: 'bg-violet-600',
  },
  Other: {
    name: 'Other',
    color: 'slate',
    bgClass: 'bg-slate-100 text-slate-700 border-slate-200',
    textClass: 'text-slate-700',
    borderClass: 'border-slate-200',
    accentBg: 'bg-slate-500',
  },
};

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Generate days for monthly view (including prev/next month buffer to fill 35 or 42 grid cells)
export function getCalendarGrid(year: number, monthIndex: number): Date[] {
  const firstDayOfMonth = new Date(year, monthIndex, 1);
  const startDayOfWeek = firstDayOfMonth.getDay(); // 0 is Sunday, etc.
  
  // Start from the previous month days if needed
  const gridStart = new Date(year, monthIndex, 1 - startDayOfWeek);
  
  const days: Date[] = [];
  // Standard grid is usually 35 or 42 days. Let's make it dynamic or fixed 42
  // Let's create an array of 42 items to cover 6 full weeks
  for (let i = 0; i < 42; i++) {
    const currentDay = new Date(gridStart);
    currentDay.setDate(gridStart.getDate() + i);
    days.push(currentDay);
  }
  
  return days;
}

// Generate the days of a month to render list/grid quickly (true month days only)
export function getDaysInMonth(year: number, monthIndex: number): Date[] {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const days: Date[] = [];
  for (let i = 1; i <= lastDay; i++) {
    days.push(new Date(year, monthIndex, i));
  }
  return days;
}

// Get tasks filtered by date
export function getTasksForDate(tasks: Task[], dateStr: string): Task[] {
  return tasks.filter(task => task.date === dateStr);
}

// Calculate some helper statistics
export function getTaskStatistics(tasks: Task[]) {
  const total = tasks.length;
  const completedTasks = tasks.filter(t => t.completed);
  const completed = completedTasks.length;
  const pending = total - completed;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
  
  // Calculate streaks
  const completedDates = Array.from(
    new Set(
      tasks.filter(t => t.completed).map(t => t.date)
    )
  ).sort();
  
  let currentStreak = 0;
  let maxStreak = 0;
  
  if (completedDates.length > 0) {
    let tempStreak = 1;
    maxStreak = 1;
    
    for (let i = 1; i < completedDates.length; i++) {
      const prev = parseDateString(completedDates[i - 1]);
      const curr = parseDateString(completedDates[i]);
      
      const diffTime = Math.abs(curr.getTime() - prev.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        tempStreak++;
      } else if (diffDays > 1) {
        tempStreak = 1;
      }
      
      if (tempStreak > maxStreak) {
        maxStreak = tempStreak;
      }
    }
    
    // Calculate current streak from today/yesterday backwards
    const todayStr = formatDateString(new Date());
    const yesterdayStr = formatDateString(new Date(Date.now() - 86400000));
    const hasCompletedToday = completedDates.includes(todayStr);
    const hasCompletedYesterday = completedDates.includes(yesterdayStr);
    
    if (hasCompletedToday || hasCompletedYesterday) {
      let checkDate = hasCompletedToday ? parseDateString(todayStr) : parseDateString(yesterdayStr);
      let isStreakActive = true;
      currentStreak = 0;
      
      while (isStreakActive) {
        const checkStr = formatDateString(checkDate);
        if (completedDates.includes(checkStr)) {
          currentStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          isStreakActive = false;
        }
      }
    }
  }

  return {
    total,
    completed,
    pending,
    completionRate,
    currentStreak,
    maxStreak,
  };
}
