import type { LucideIcon } from 'lucide-react';
import {
  Briefcase,
  User,
  HeartPulse,
  Wallet,
  GraduationCap,
  ListTodo,
  Target,
  Users,
  Phone,
  Mail,
  Presentation,
  Dumbbell,
  DollarSign,
  BookOpen,
  Utensils,
  ShoppingCart,
  Plane,
  Car,
  Stethoscope,
  Home,
  Code,
  PenLine,
  CalendarClock,
} from 'lucide-react';
import { Task } from '../types';
import { DEFAULT_CATEGORIES } from '../utils';

type TaskIconInput = Pick<Task, 'title' | 'description' | 'category' | 'isGoal'>;

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Work: Briefcase,
  Personal: User,
  Health: HeartPulse,
  Finance: Wallet,
  Learning: GraduationCap,
  Other: ListTodo,
};

const CONTENT_ICON_RULES: { keywords: string[]; icon: LucideIcon }[] = [
  { keywords: ['meeting', 'standup', 'sync', 'interview', 'team'], icon: Users },
  { keywords: ['call', 'phone', 'zoom', 'teams'], icon: Phone },
  { keywords: ['email', 'mail', 'inbox', 'reply'], icon: Mail },
  { keywords: ['present', 'pitch', 'demo', 'slide'], icon: Presentation },
  { keywords: ['workout', 'gym', 'exercise', 'run', 'yoga', 'walk'], icon: Dumbbell },
  { keywords: ['doctor', 'medical', 'clinic', 'therapy', 'dentist'], icon: Stethoscope },
  { keywords: ['pay', 'bill', 'budget', 'invoice', 'tax', 'salary'], icon: DollarSign },
  { keywords: ['invest', 'savings', 'bank', 'finance', 'expense'], icon: Wallet },
  { keywords: ['study', 'learn', 'course', 'class', 'lecture', 'exam'], icon: GraduationCap },
  { keywords: ['read', 'book', 'research', 'article'], icon: BookOpen },
  { keywords: ['cook', 'meal', 'lunch', 'dinner', 'breakfast', 'recipe'], icon: Utensils },
  { keywords: ['grocery', 'shop', 'buy', 'market'], icon: ShoppingCart },
  { keywords: ['flight', 'travel', 'trip', 'vacation', 'hotel'], icon: Plane },
  { keywords: ['drive', 'commute', 'car', 'uber'], icon: Car },
  { keywords: ['clean', 'laundry', 'chore', 'home', 'house'], icon: Home },
  { keywords: ['code', 'dev', 'program', 'bug', 'deploy', 'api'], icon: Code },
  { keywords: ['write', 'blog', 'journal', 'draft', 'essay'], icon: PenLine },
  { keywords: ['schedule', 'appointment', 'reminder', 'deadline'], icon: CalendarClock },
  { keywords: ['plan', 'goal', 'milestone', 'objective'], icon: Target },
];

export function resolveTaskIcon(task: TaskIconInput): LucideIcon {
  if (task.isGoal) {
    return Target;
  }

  const text = `${task.title} ${task.description ?? ''}`.toLowerCase();

  for (const rule of CONTENT_ICON_RULES) {
    if (rule.keywords.some((keyword) => text.includes(keyword))) {
      return rule.icon;
    }
  }

  return CATEGORY_ICONS[task.category] ?? CATEGORY_ICONS.Other;
}

interface TaskIconProps {
  task: TaskIconInput;
  size?: number;
  className?: string;
  variant?: 'badge' | 'plain';
  completed?: boolean;
}

export default function TaskIcon({
  task,
  size = 14,
  className = '',
  variant = 'badge',
  completed = false,
}: TaskIconProps) {
  const Icon = resolveTaskIcon(task);
  const categoryInfo = DEFAULT_CATEGORIES[task.category] || DEFAULT_CATEGORIES.Other;

  if (variant === 'plain') {
    return (
      <Icon
        size={size}
        className={`shrink-0 ${completed ? 'text-slate-400' : categoryInfo.textClass} ${className}`}
        aria-hidden
      />
    );
  }

  const boxSize = Math.max(size + 6, 18);

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 rounded-md border ${
        completed
          ? 'bg-slate-100 border-slate-200 text-slate-400'
          : categoryInfo.bgClass
      } ${className}`}
      style={{ width: boxSize, height: boxSize }}
    >
      <Icon size={size} className={completed ? 'text-slate-400' : categoryInfo.textClass} aria-hidden />
    </span>
  );
}
