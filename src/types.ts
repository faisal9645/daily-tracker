export type Priority = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  title: string;
  description?: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM
  completed: boolean;
  priority: Priority;
  category: string;
  duration?: number; // in minutes
  deadline?: string; // YYYY-MM-DD
  isGoal?: boolean;
}

export interface Category {
  name: string;
  color: string; // Tailwind color class matching, e.g. 'indigo'
  bgClass: string; // e.g. 'bg-indigo-100 dark:bg-indigo-900/30'
  textClass: string; // e.g. 'text-indigo-700 dark:text-indigo-300'
  borderClass: string; // e.g. 'border-indigo-200'
  accentBg: string; // e.g. 'bg-indigo-600'
}

export type CalendarView = 'daily' | 'monthly' | 'yearly';
