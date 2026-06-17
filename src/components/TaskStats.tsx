import { useState } from 'react';
import { Task } from '../types';
import { getTaskStatistics, formatDateString, DEFAULT_CATEGORIES } from '../utils';
import {
  CheckCircle2,
  Circle,
  Flame,
  TrendingUp,
  CalendarDays,
  Award,
  Target,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Percent,
} from 'lucide-react';
import { motion } from 'motion/react';
import TaskIcon from './TaskIcon';

interface TaskStatsProps {
  tasks: Task[];
  onQuickFilterClick?: (status: 'all' | 'completed' | 'pending') => void;
  activeFilter?: 'all' | 'completed' | 'pending';
}

const MONTHS_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function TaskStats({ tasks, onQuickFilterClick, activeFilter = 'all' }: TaskStatsProps) {
  const stats = getTaskStatistics(tasks);

  // States for the Detailed Monthly Analysis Hub
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth()); // 0-11
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());

  // Navigation handlers for monthly switcher
  const navigateMonth = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      if (selectedMonth === 0) {
        setSelectedMonth(11);
        setSelectedYear(prev => prev - 1);
      } else {
        setSelectedMonth(prev => prev - 1);
      }
    } else {
      if (selectedMonth === 11) {
        setSelectedMonth(0);
        setSelectedYear(prev => prev + 1);
      } else {
        setSelectedMonth(prev => prev + 1);
      }
    }
  };

  // Monthly stats computations
  const monthlyTasks = tasks.filter(t => {
    if (!t.date || t.date.length < 7) return false;
    const [y, m] = t.date.split('-').map(Number);
    return y === selectedYear && (m - 1) === selectedMonth;
  });

  const mTotal = monthlyTasks.length;
  const mCompleted = monthlyTasks.filter(t => t.completed).length;
  const mPending = mTotal - mCompleted;
  const mCompletionRate = mTotal > 0 ? Math.round((mCompleted / mTotal) * 100) : 0;

  // Monthly Goals track
  const mGoals = monthlyTasks.filter(t => t.isGoal);
  const mGoalsTotal = mGoals.length;
  const mGoalsCompleted = mGoals.filter(t => t.completed).length;
  const mGoalsPending = mGoalsTotal - mGoalsCompleted;
  const mGoalsCompletionRate = mGoalsTotal > 0 ? Math.round((mGoalsCompleted / mGoalsTotal) * 100) : 0;

  // Category summary for chosen month
  const categoriesList = ['Work', 'Personal', 'Health', 'Finance', 'Learning', 'Other'];
  const mCategoryStats = categoriesList.map(cat => {
    const catTasks = monthlyTasks.filter(t => t.category === cat);
    const total = catTasks.length;
    const completed = catTasks.filter(t => t.completed).length;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { category: cat, total, completed, rate };
  }).filter(c => c.total > 0);

  // Priority-wise completion
  const prioritiesList = ['high', 'medium', 'low'] as const;
  const mPriorityStats = prioritiesList.map(pri => {
    const priTasks = monthlyTasks.filter(t => t.priority === pri);
    const total = priTasks.length;
    const completed = priTasks.filter(t => t.completed).length;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { priority: pri, total, completed, rate };
  }).filter(p => p.total > 0);

  // Annual overview computation for current chosen year
  const monthsAbbr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const annualPerformance = monthsAbbr.map((mName, index) => {
    const mTasks = tasks.filter(t => {
      if (!t.date) return false;
      const [y, m] = t.date.split('-').map(Number);
      return y === selectedYear && (m - 1) === index;
    });
    const total = mTasks.length;
    const completed = mTasks.filter(t => t.completed).length;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { monthIndex: index, monthName: mName, total, completed, rate };
  });

  const cardVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.25 } },
  };

  // Helper colors for monthly micro highlights
  const getProgressColorClass = (rate: number, hasTasks: boolean) => {
    if (!hasTasks) return 'bg-m3-surface border-m3-outline/10 text-m3-on-surface-variant/40';
    if (rate >= 80) return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-extrabold';
    if (rate >= 50) return 'bg-m3-primary/10 border-m3-primary/30 text-m3-primary font-extrabold';
    if (rate > 0) return 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 font-extrabold';
    return 'bg-red-500/10 border-red-500/30 text-red-500 font-extrabold';
  };

  const getProgressDotClass = (rate: number, hasTasks: boolean) => {
    if (!hasTasks) return 'bg-m3-outline/25';
    if (rate >= 80) return 'bg-emerald-500';
    if (rate >= 50) return 'bg-m3-primary';
    if (rate > 0) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div className="flex flex-col gap-4 mb-4">
      {/* 4 Standard Global Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Total Tasks Card */}
        <motion.div
          id="stat-card-total"
          onClick={() => onQuickFilterClick?.('all')}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          whileHover={{ y: -1 }}
          className={`p-3.5 rounded-3xl cursor-pointer border transition-all duration-200 ${
            activeFilter === 'all'
              ? 'bg-m3-primary-container border-m3-primary/45 shadow-sm text-m3-on-primary-container'
              : 'bg-m3-surface border-m3-outline/10 hover:border-m3-primary/30 text-m3-on-surface'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-m3-on-surface-variant/80">Total Tasks</p>
              <h3 className="text-2xl font-extrabold font-display mt-0.5">{stats.total}</h3>
            </div>
            <div className="p-2.5 bg-m3-primary/10 text-m3-primary rounded-xl shrink-0">
              <CalendarDays size={18} />
            </div>
          </div>
          <p className="text-[10px] text-m3-on-surface-variant font-bold mt-3.5 flex items-center gap-1">
            <TrendingUp size={11} className="text-m3-outline" />
            <span>All tasks in planner</span>
          </p>
        </motion.div>

        {/* Completed Card */}
        <motion.div
          id="stat-card-completed"
          onClick={() => onQuickFilterClick?.('completed')}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          whileHover={{ y: -1 }}
          className={`p-3.5 rounded-3xl cursor-pointer border transition-all duration-200 ${
            activeFilter === 'completed'
              ? 'bg-emerald-500/10 border-emerald-500/40 shadow-sm text-emerald-700 dark:text-emerald-400'
              : 'bg-m3-surface border-m3-outline/10 hover:border-emerald-500/30 text-m3-on-surface'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-m3-on-surface-variant/80">Completed</p>
              <h3 className="text-2xl font-extrabold font-display mt-0.5">{stats.completed}</h3>
            </div>
            <div className="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl shrink-0">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-[9.5px] font-extrabold text-emerald-600 dark:text-emerald-400">
              {stats.completionRate}% rate
            </span>
            <div className="flex-1 bg-m3-surface-variant h-1.5 rounded-full overflow-hidden max-w-[65px]">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${stats.completionRate}%` }}
              />
            </div>
          </div>
        </motion.div>

        {/* Pending Card */}
        <motion.div
          id="stat-card-pending"
          onClick={() => onQuickFilterClick?.('pending')}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          whileHover={{ y: -1 }}
          className={`p-3.5 rounded-3xl cursor-pointer border transition-all duration-200 ${
            activeFilter === 'pending'
              ? 'bg-amber-500/10 border-amber-500/40 shadow-sm text-amber-700 dark:text-amber-400'
              : 'bg-m3-surface border-m3-outline/10 hover:border-amber-500/30 text-m3-on-surface'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-m3-on-surface-variant/80">Pending</p>
              <h3 className="text-2xl font-extrabold font-display mt-0.5">{stats.pending}</h3>
            </div>
            <div className="p-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl shrink-0">
              <Circle size={18} className="stroke-[2.5]" />
            </div>
          </div>
          <p className="text-[10px] text-m3-on-surface-variant font-bold mt-3.5 flex items-center gap-1">
            <Award size={11} className="text-amber-500" />
            <span>Awaiting completion</span>
          </p>
        </motion.div>

        {/* Streak Card */}
        <motion.div
          id="stat-card-streak"
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          whileHover={{ y: -1 }}
          className="p-3.5 rounded-3xl bg-m3-surface border border-m3-outline/10 text-m3-on-surface"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-m3-on-surface-variant/80">Day Streak</p>
              <h3 className="text-2xl font-extrabold font-display text-orange-600 dark:text-orange-400 mt-0.5 flex items-baseline gap-1 leading-none">
                {stats.currentStreak}
                <span className="text-[10px] font-bold text-m3-on-surface-variant">days</span>
              </h3>
            </div>
            <div className="p-2.5 bg-orange-500/10 text-orange-500 rounded-xl shrink-0">
              <Flame size={18} className={stats.currentStreak > 0 ? 'animate-bounce' : ''} />
            </div>
          </div>
          <p className="text-[10px] text-m3-on-surface-variant font-bold mt-3.5">
            <span>Max streak: <strong className="text-orange-500 font-extrabold">{stats.maxStreak}</strong> days</span>
          </p>
        </motion.div>
      </div>

      {/* COMPREHENSIVE MONTHLY TRACKING & ANALYTICS WIDGET */}
      <div className="bg-m3-surface border border-m3-outline/10 rounded-3xl shadow-2xs overflow-hidden">
        {/* Interactive Month Switcher Header */}
        <div className="bg-m3-surface-container px-4 py-3 border-b border-m3-outline/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-m3-primary/10 text-m3-primary rounded-xl shrink-0">
              <BarChart3 size={16} />
            </div>
            <div>
              <h4 className="font-display font-extrabold text-sm text-m3-on-surface">Monthly Analytics</h4>
              <p className="text-[9px] font-bold text-m3-on-surface-variant uppercase tracking-wider">Growth Tracker ({selectedYear})</p>
            </div>
          </div>

          <div className="flex items-center bg-m3-surface border border-m3-outline/15 p-1 rounded-full shadow-3xs">
            <button
              onClick={() => navigateMonth('prev')}
              className="p-1.5 hover:bg-m3-surface-variant/30 text-m3-on-surface-variant hover:text-m3-primary rounded-full transition cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft size={14} className="stroke-3" />
            </button>
            <div className="px-3 py-0.5 text-xs font-bold text-m3-on-surface font-display min-w-[110px] text-center select-none">
              {MONTHS_FULL[selectedMonth]}
            </div>
            <button
              onClick={() => navigateMonth('next')}
              className="p-1.5 hover:bg-m3-surface-variant/30 text-m3-on-surface-variant hover:text-m3-primary rounded-full transition cursor-pointer"
              title="Next Month"
            >
              <ChevronRight size={14} className="stroke-3" />
            </button>
          </div>
        </div>

        {/* Dashboard Grid Container */}
        <div className="p-4 flex flex-col gap-5">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            
            {/* COLUMN 1: Completion Circular Gauge & Basic stats meters (5 Cols) */}
            <div className="md:col-span-5 flex flex-col gap-4 md:border-r md:border-m3-outline/10 md:pr-5">
              
              <div className="flex items-center gap-4">
                {/* Radial Gauge Visual Indicator */}
                <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
                  <svg className="absolute w-full h-full transform -rotate-90">
                    <circle
                      cx="50%"
                      cy="50%"
                      r="34"
                      className="stroke-m3-outline/10 fill-none"
                      strokeWidth="6"
                    />
                    <circle
                      cx="50%"
                      cy="50%"
                      r="34"
                      className="stroke-m3-primary fill-none transition-all duration-700"
                      strokeWidth="6"
                      strokeDasharray={`${2 * Math.PI * 34}`}
                      strokeDashoffset={`${2 * Math.PI * 34 * (1 - mCompletionRate / 100)}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="text-center">
                    <span className="font-display font-extrabold text-base text-m3-on-surface">{mCompletionRate}%</span>
                    <p className="text-[7.5px] font-bold text-m3-on-surface-variant uppercase tracking-wider leading-none mt-0.5">Done</p>
                  </div>
                </div>

                <div className="flex-1">
                  <span className="text-[8.5px] font-bold text-m3-on-surface-variant uppercase tracking-wider">Scorecard</span>
                  <h5 className="font-display font-extrabold text-m3-on-surface text-xs mt-0.5">{MONTHS_FULL[selectedMonth]}'s Completion</h5>
                  <p className="text-[11px] text-m3-on-surface-variant/90 mt-1 font-semibold leading-snug">
                    {mCompleted} of {mTotal} task actions completed.
                  </p>
                </div>
              </div>

              {/* Stat progress indicators */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-m3-surface-container/60 border border-m3-outline/10 p-3 rounded-2xl">
                  <span className="text-[8.5px] font-bold text-m3-on-surface-variant uppercase tracking-wider block">Completed</span>
                  <span className="text-lg font-extrabold text-m3-on-surface font-display mt-0.5 block leading-none">{mCompleted}</span>
                  <span className="text-[10px] text-m3-on-surface-variant font-semibold mt-1 block">Resolved</span>
                </div>
                <div className="bg-m3-surface-container/60 border border-m3-outline/10 p-3 rounded-2xl">
                  <span className="text-[8.5px] font-bold text-m3-on-surface-variant uppercase tracking-wider block">Remaining</span>
                  <span className="text-lg font-extrabold text-amber-600 dark:text-amber-400 font-display mt-0.5 block leading-none">{mPending}</span>
                  <span className="text-[10px] text-m3-on-surface-variant font-semibold mt-1 block">Pending</span>
                </div>
              </div>

              {/* Goal Tasks Met Tracker */}
              <div className="border border-m3-primary/15 bg-m3-primary/5 p-3 rounded-2xl flex flex-col gap-1.5 shadow-3xs">
                <div className="flex items-center justify-between">
                  <span className="text-[9.5px] font-bold text-m3-primary flex items-center gap-1 uppercase tracking-wide">
                    <Target size={11} />
                    Goals Accomplished
                  </span>
                  <span className="text-[8.5px] font-bold bg-m3-surface text-m3-primary border border-m3-primary/10 px-2 py-0.5 rounded-full shrink-0">
                    {mGoalsCompleted}/{mGoalsTotal} Met
                  </span>
                </div>
                {mGoalsTotal > 0 ? (
                  <div className="mt-1">
                    <div className="flex items-center justify-between text-[9px] text-m3-on-surface-variant font-bold mb-1">
                      <span>Completion Goal Rate</span>
                      <span className="text-m3-primary">{mGoalsCompletionRate}%</span>
                    </div>
                    <div className="w-full bg-m3-surface-variant h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-m3-primary h-full rounded-full transition-all duration-300"
                        style={{ width: `${mGoalsCompletionRate}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <span className="text-[9px] text-m3-on-surface-variant/70 italic font-bold mt-0.5 block">No Goal Tasks scheduled this month.</span>
                )}
              </div>

            </div>

            {/* COLUMN 2: Category distribution & priority details (7 Cols) */}
            <div className="md:col-span-7 flex flex-col gap-4">
              
              {/* Category-wise Breakdown */}
              <div>
                <h5 className="font-display font-extrabold text-m3-on-surface text-xs uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <Percent size={12} className="text-m3-primary" />
                  Category Resolutions
                </h5>
                
                {mCategoryStats.length > 0 ? (
                  <div className="flex flex-col gap-2.5">
                    {mCategoryStats.map(catStat => {
                      const categoryConfig = DEFAULT_CATEGORIES[catStat.category] || DEFAULT_CATEGORIES['Other'];
                      return (
                        <div key={catStat.category} className="flex flex-col gap-0.5">
                          <div className="flex items-center justify-between text-[11px] font-semibold text-m3-on-surface-variant">
                            <span className="font-bold text-m3-on-surface flex items-center gap-1.5">
                              <TaskIcon
                                task={{ title: catStat.category, category: catStat.category }}
                                size={12}
                                variant="plain"
                              />
                              {catStat.category}
                            </span>
                            <span>
                              {catStat.completed}/{catStat.total} done • <strong className="text-m3-primary">{catStat.rate}%</strong>
                            </span>
                          </div>
                          <div className="w-full bg-m3-surface-variant h-1.5 rounded-full overflow-hidden border border-m3-outline/5">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${categoryConfig.accentBg}`}
                              style={{ width: `${catStat.rate}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 bg-m3-surface-container/50 border border-m3-outline/10 rounded-2xl text-center">
                    <p className="text-xs text-m3-on-surface-variant/70 italic font-semibold">No category logs for {MONTHS_FULL[selectedMonth]}.</p>
                  </div>
                )}
              </div>

              {/* Priority achievements breakdown list */}
              <div className="border-t border-m3-outline/10 pt-3">
                <h5 className="font-display font-extrabold text-m3-on-surface text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Award size={12} className="text-orange-500" />
                  Priority Resolutions
                </h5>

                {mPriorityStats.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {mPriorityStats.map(pStat => {
                      const badgeColor = 
                        pStat.priority === 'high' ? 'bg-rose-500/10 border-rose-500/25 text-rose-600 dark:text-rose-400' :
                        pStat.priority === 'medium' ? 'bg-amber-500/10 border-amber-500/25 text-amber-600 dark:text-amber-400' :
                        'bg-m3-primary/10 border-m3-primary/20 text-m3-primary';
                      
                      const dotColor = 
                        pStat.priority === 'high' ? 'bg-rose-500' :
                        pStat.priority === 'medium' ? 'bg-amber-500' :
                        'bg-m3-primary';

                      return (
                        <div key={pStat.priority} className={`p-2 rounded-xl border ${badgeColor} flex flex-col justify-between gap-1 shadow-3xs`}>
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-bold uppercase tracking-wider flex items-center gap-1">
                              <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                              {pStat.priority}
                            </span>
                            <span className="text-[10px] font-extrabold">{pStat.rate}%</span>
                          </div>
                          <p className="text-[9px] font-bold text-m3-on-surface-variant/80">
                            {pStat.completed}/{pStat.total} done
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-m3-on-surface-variant/65 italic font-semibold">No priority items.</p>
                )}
              </div>

            </div>

          </div>

          {/* SECTION 4: Annual Interactive Trend Tracker Grid */}
          <div className="border-t border-m3-outline/10 pt-4 mt-1">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 mb-3">
              <div>
                <h5 className="font-display font-extrabold text-m3-on-surface text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar size={13} className="text-m3-primary" />
                  Roadmap Trend ({selectedYear})
                </h5>
                <p className="text-[9px] text-m3-on-surface-variant font-bold uppercase tracking-wider">Tap a month chip to view its breakdown details</p>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[8.5px] font-bold uppercase text-m3-on-surface-variant shrink-0 bg-m3-surface-container border border-m3-outline/10 px-2.5 py-1 rounded-xl">
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-m3-outline/30 rounded-full" /> Empty</span>
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-red-500 rounded-full" /> 0%</span>
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-amber-500 rounded-full" /> 1-49%</span>
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-m3-primary rounded-full" /> 50-79%</span>
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> 80%+</span>
              </div>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-1.5">
              {annualPerformance.map(mPerf => {
                const isActive = selectedMonth === mPerf.monthIndex;
                const progressClass = getProgressColorClass(mPerf.rate, mPerf.total > 0);
                const dotClass = getProgressDotClass(mPerf.rate, mPerf.total > 0);

                return (
                  <button
                    key={mPerf.monthIndex}
                    onClick={() => setSelectedMonth(mPerf.monthIndex)}
                    className={`p-2 rounded-xl border flex flex-col items-center justify-between text-center transition-all duration-150 cursor-pointer min-h-[58px] ${progressClass} ${
                      isActive 
                        ? 'ring-2 ring-m3-primary ring-offset-2 dark:ring-offset-m3-surface border-transparent font-black shadow-xs scale-102' 
                        : 'hover:shadow-3xs'
                    }`}
                  >
                    <span className="text-[9px] font-extrabold uppercase tracking-wider select-none">{mPerf.monthName}</span>
                    {mPerf.total > 0 ? (
                      <div className="flex flex-col items-center gap-0.5 mt-0.5 shrink-0">
                        <span className="text-[10px] font-extrabold font-display leading-none">{mPerf.rate}%</span>
                        <span className="text-[7.5px] font-semibold leading-none text-m3-on-surface-variant/70">{mPerf.completed}/{mPerf.total}</span>
                      </div>
                    ) : (
                      <span className="text-[8px] text-m3-on-surface-variant/40 italic font-bold">--</span>
                    )}
                    <span className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${dotClass}`} />
                  </button>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
