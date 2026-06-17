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
  Info,
  Calendar,
  Percent,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
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
  const mCompletionRate = mTotal > 0 ? Math.round((mCompleted / mTotal) * 105) > 100 ? 100 : Math.round((mCompleted / mTotal) * 100) : 0;

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
  }).filter(c => c.total > 0); // Only show categories with tasks scheduled this month

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
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  };

  // Helper colors for monthly micro highlights
  const getProgressColorClass = (rate: number, hasTasks: boolean) => {
    if (!hasTasks) return 'bg-slate-50 border-slate-100 text-slate-400';
    if (rate >= 80) return 'bg-emerald-50 border-emerald-200 text-emerald-800';
    if (rate >= 50) return 'bg-blue-50 border-blue-200 text-blue-800';
    if (rate > 0) return 'bg-amber-50 border-amber-200 text-amber-800';
    return 'bg-rose-50 border-rose-100 text-rose-700';
  };

  const getProgressDotClass = (rate: number, hasTasks: boolean) => {
    if (!hasTasks) return 'bg-slate-200';
    if (rate >= 80) return 'bg-emerald-500';
    if (rate >= 50) return 'bg-blue-500';
    if (rate > 0) return 'bg-amber-500';
    return 'bg-rose-400';
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-6 mb-4 sm:mb-6">
      {/* 4 Standard Global Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Total Tasks Card */}
        <motion.div
          id="stat-card-total"
          onClick={() => onQuickFilterClick?.('all')}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          whileHover={{ y: -2, transition: { duration: 0.2 } }}
          className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl cursor-pointer border transition-all duration-200 ${
            activeFilter === 'all'
              ? 'bg-blue-50 border-blue-300 shadow-sm shadow-blue-100 text-blue-950'
              : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-slate-50/50 text-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">Total Tasks</p>
              <h3 className={`text-2xl sm:text-3xl font-bold font-display mt-1 ${activeFilter === 'all' ? 'text-blue-900' : 'text-slate-800'}`}>{stats.total}</h3>
            </div>
            <div className="p-2 sm:p-3 bg-blue-50 rounded-xl text-blue-600 shrink-0">
              <CalendarDays size={18} />
            </div>
          </div>
          <p className="text-[10px] sm:text-xs text-slate-500 mt-3 flex items-center gap-1">
            <TrendingUp size={11} className="text-slate-400" />
            <span>All actions in database</span>
          </p>
        </motion.div>

        {/* Completed Card */}
        <motion.div
          id="stat-card-completed"
          onClick={() => onQuickFilterClick?.('completed')}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          whileHover={{ y: -2, transition: { duration: 0.2 } }}
          className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl cursor-pointer border transition-all duration-200 ${
            activeFilter === 'completed'
              ? 'bg-emerald-50 border-emerald-300 shadow-sm shadow-emerald-100 text-emerald-950'
              : 'bg-white border-slate-200 hover:border-emerald-300 hover:bg-slate-50/50 text-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">Completed</p>
              <h3 className={`text-2xl sm:text-3xl font-bold font-display mt-1 ${activeFilter === 'completed' ? 'text-emerald-700' : 'text-emerald-650'}`}>{stats.completed}</h3>
            </div>
            <div className="p-2 sm:p-3 bg-emerald-50 rounded-xl text-emerald-600 shrink-0">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <p className="text-[10px] sm:text-xs text-emerald-600 font-bold font-sans">
              {stats.completionRate}% completion rate
            </p>
            <div className="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden max-w-[60px] sm:max-w-[80px]">
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
          whileHover={{ y: -2, transition: { duration: 0.2 } }}
          className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl cursor-pointer border transition-all duration-200 ${
            activeFilter === 'pending'
              ? 'bg-amber-50 border-amber-300 shadow-sm shadow-amber-100 text-amber-950'
              : 'bg-white border-slate-200 hover:border-amber-300 hover:bg-slate-50/50 text-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">Pending</p>
              <h3 className={`text-2xl sm:text-3xl font-bold font-display mt-1 ${activeFilter === 'pending' ? 'text-amber-700' : 'text-amber-600'}`}>{stats.pending}</h3>
            </div>
            <div className="p-2 sm:p-3 bg-amber-50 rounded-xl text-amber-600 shrink-0">
              <Circle size={18} className="stroke-2" />
            </div>
          </div>
          <p className="text-[10px] sm:text-xs text-slate-500 mt-3 flex items-center gap-1">
            <Award size={11} className="text-amber-500" />
            <span>Actions awaiting completion</span>
          </p>
        </motion.div>

        {/* Streak Card */}
        <motion.div
          id="stat-card-streak"
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          whileHover={{ y: -2, transition: { duration: 0.2 } }}
          className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-white border border-slate-200 transition-all duration-200 text-slate-800"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">Daily Streak</p>
              <h3 className="text-2xl sm:text-3xl font-bold font-display text-orange-600 mt-1 flex items-baseline gap-1">
                {stats.currentStreak}
                <span className="text-[10px] sm:text-xs font-normal text-slate-400">days</span>
              </h3>
            </div>
            <div className="p-2 sm:p-3 bg-orange-50 rounded-xl text-orange-500 shrink-0">
              <Flame size={18} className={stats.currentStreak > 0 ? 'animate-bounce' : ''} />
            </div>
          </div>
          <p className="text-[10px] sm:text-xs text-slate-500 mt-3 flex items-center gap-1">
            <span>Max streak: <strong className="text-orange-600 font-bold">{stats.maxStreak}</strong> days</span>
          </p>
        </motion.div>
      </div>

      {/* COMPREHENSIVE MONTHLY TRACKING & ANALYTICS WIDGET */}
      <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* Interactive Month Switcher Header */}
        <div className="bg-slate-50/70 px-3 sm:px-6 py-3 sm:py-4 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 text-blue-900 rounded-lg shrink-0">
              <BarChart3 size={15} />
            </div>
            <div>
              <h4 className="font-display font-bold text-sm text-slate-900">Monthly Performance Analytics</h4>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Interactive Growth Tracker ({selectedYear})</p>
            </div>
          </div>

          <div className="flex items-center bg-white border border-slate-200 p-1 rounded-xl shadow-2xs">
            <button
              onClick={() => navigateMonth('prev')}
              className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-blue-900 rounded-lg transition cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft size={14} className="stroke-3" />
            </button>
            <div className="px-3.5 py-1 text-xs font-bold text-blue-950 font-display min-w-[120px] text-center select-none">
              {MONTHS_FULL[selectedMonth]} {selectedYear}
            </div>
            <button
              onClick={() => navigateMonth('next')}
              className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-blue-900 rounded-lg transition cursor-pointer"
              title="Next Month"
            >
              <ChevronRight size={14} className="stroke-3" />
            </button>
          </div>
        </div>

        {/* Dashboard Grid Container */}
        <div className="p-4 sm:p-6 flex flex-col gap-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* COLUMN 1: Completion Circular Gauge & Basic stats meters (5 Cols) */}
            <div className="lg:col-span-5 flex flex-col gap-5 border-b lg:border-b-0 lg:border-r border-slate-150 pb-5 lg:pb-0 lg:pr-6">
              
              <div className="flex items-center gap-4 sm:gap-6">
                {/* Radial Gauge Visual Indicator */}
                <div className="relative w-20 sm:w-24 h-20 sm:h-24 flex items-center justify-center shrink-0">
                  <svg className="absolute w-full h-full transform -rotate-90">
                    <circle
                      cx="50%"
                      cy="50%"
                      r="36"
                      className="stroke-slate-100 fill-none"
                      strokeWidth="7"
                    />
                    <circle
                      cx="50%"
                      cy="50%"
                      r="36"
                      className="stroke-blue-900 fill-none transition-all duration-700"
                      strokeWidth="7"
                      strokeDasharray={`${2 * Math.PI * 36}`}
                      strokeDashoffset={`${2 * Math.PI * 36 * (1 - mCompletionRate / 100)}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="text-center">
                    <span className="font-display font-extrabold text-lg sm:text-xl text-blue-950">{mCompletionRate}%</span>
                    <p className="text-[8px] font-bold text-slate-450 uppercase tracking-widest leading-none">Done</p>
                  </div>
                </div>

                <div className="flex-1">
                  <span className="text-[9px] font-bold text-slate-400 capitalize uppercase tracking-widest">Monthly Metric Volume</span>
                  <h5 className="font-display font-bold text-slate-900 text-sm mt-0.5">{MONTHS_FULL[selectedMonth]}'s Completion Score</h5>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {mCompleted} of {mTotal} scheduled action items resolved successfully.
                  </p>
                </div>
              </div>

              {/* Stat progress indicators */}
              <div className="grid grid-cols-2 gap-3 mt-1">
                <div className="bg-slate-50 border border-slate-200/60 p-3 rounded-xl">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Completed</span>
                  <span className="text-xl font-bold text-slate-800 font-display mt-0.5 block">{mCompleted}</span>
                  <span className="text-[10px] text-slate-500 mt-1 block">Ready actions</span>
                </div>
                <div className="bg-slate-50 border border-slate-200/60 p-3 rounded-xl">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Remaining</span>
                  <span className="text-xl font-bold text-amber-650 font-display mt-0.5 block">{mPending}</span>
                  <span className="text-[10px] text-slate-500 mt-1 block">Unfinished tasks</span>
                </div>
              </div>

              {/* Goal Tasks Met Tracker */}
              <div className="border border-indigo-100 bg-indigo-50/50 p-3.5 rounded-xl flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-blue-900 flex items-center gap-1 uppercase tracking-wide">
                    <Target size={12} className="text-blue-800" />
                    Month Goal Tasks
                  </span>
                  <span className="text-[10px] font-bold bg-white text-blue-900 border border-blue-100 px-2 py-0.5 rounded-full">
                    {mGoalsCompleted}/{mGoalsTotal} Met
                  </span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Target milestones with strict deadlines.
                </p>
                {mGoalsTotal > 0 ? (
                  <div className="mt-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold mb-1">
                      <span>Goal Accomplishment Score</span>
                      <span className="text-blue-900">{mGoalsCompletionRate}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-900 h-full rounded-full transition-all duration-300"
                        style={{ width: `${mGoalsCompletionRate}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <span className="text-[10px] text-slate-400 italic font-medium mt-1">No Goal Tasks scheduled this month. Set target deadline tasks to trigger goals!</span>
                )}
              </div>

            </div>

            {/* COLUMN 2: Category distribution & priority details (7 Cols) */}
            <div className="lg:col-span-7 flex flex-col gap-5">
              
              {/* Category-wise Breakdown with multi colored bars */}
              <div>
                <h5 className="font-display font-bold text-slate-800 text-xs uppercase tracking-wider mb-3.5 flex items-center gap-1.5">
                  <Percent size={13} className="text-teal-650" />
                  Category Success Rates
                </h5>
                
                {mCategoryStats.length > 0 ? (
                  <div className="flex flex-col gap-3.5">
                    {mCategoryStats.map(catStat => {
                      const categoryConfig = DEFAULT_CATEGORIES[catStat.category] || DEFAULT_CATEGORIES['Other'];
                      return (
                        <div key={catStat.category} className="flex flex-col gap-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-700 flex items-center gap-2">
                              <TaskIcon
                                task={{ title: catStat.category, category: catStat.category }}
                                size={12}
                                variant="plain"
                              />
                              {catStat.category}
                            </span>
                            <span className="text-slate-500 font-medium">
                              <strong className="text-slate-805 font-bold">{catStat.completed}</strong>/{catStat.total} done • <strong className="text-blue-900 font-bold">{catStat.rate}%</strong>
                            </span>
                          </div>
                          <div className="w-full bg-slate-50 h-2 rounded-full border border-slate-100 overflow-hidden">
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
                  <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-xl text-center">
                    <p className="text-xs text-slate-405 italic font-medium">No tasks recorded with category tags for {MONTHS_FULL[selectedMonth]}.</p>
                  </div>
                )}
              </div>

              {/* Priority achievements breakdown list */}
              <div className="border-t border-slate-150 pt-4">
                <h5 className="font-display font-bold text-slate-800 text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Award size={13} className="text-orange-500" />
                  Task Priority Resolutions
                </h5>

                {mPriorityStats.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {mPriorityStats.map(pStat => {
                      const badgeColor = 
                        pStat.priority === 'high' ? 'bg-rose-50 border-rose-200 text-rose-700' :
                        pStat.priority === 'medium' ? 'bg-amber-50 border-amber-200 text-amber-800' :
                        'bg-blue-50 border-blue-200 text-slate-700';
                      
                      const dotColor = 
                        pStat.priority === 'high' ? 'bg-rose-550' :
                        pStat.priority === 'medium' ? 'bg-amber-500' :
                        'bg-blue-450';

                      return (
                        <div key={pStat.priority} className={`p-3 rounded-xl border ${badgeColor} flex flex-col justify-between gap-1`}>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider capitalize flex items-center gap-1">
                              <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                              {pStat.priority} priority
                            </span>
                            <span className="text-xs font-bold">{pStat.rate}%</span>
                          </div>
                          <p className="text-[10px] font-semibold tracking-wide text-slate-500 mt-1">
                            {pStat.completed} of {pStat.total} Resolved
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No priorities tracking present this month.</p>
                )}
              </div>

            </div>

          </div>

          {/* SECTION 4: Annual Interactive Trend Tracker Grid */}
          <div className="border-t border-slate-150 pt-5 mt-2">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3.5">
              <div>
                <h5 className="font-display font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar size={13} className="text-blue-900" />
                  Interactive Action Roadmap ({selectedYear})
                </h5>
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">Click any month below to analyze its complete metrics & data in Planflow</p>
              </div>

              <div className="flex items-center gap-3.5 text-[9.5px] font-bold uppercase text-slate-500 shrink-0 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg">
                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-slate-200 rounded-full" /> Empty</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-rose-400 rounded-full" /> 0% Done</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-amber-500 rounded-full" /> 1-49%</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-500 rounded-full" /> 50-79%</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-500 rounded-full" /> 80%+</span>
              </div>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2">
              {annualPerformance.map(mPerf => {
                const isActive = selectedMonth === mPerf.monthIndex;
                const progressClass = getProgressColorClass(mPerf.rate, mPerf.total > 0);
                const dotClass = getProgressDotClass(mPerf.rate, mPerf.total > 0);

                return (
                  <motion.button
                    key={mPerf.monthIndex}
                    onClick={() => setSelectedMonth(mPerf.monthIndex)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`p-2.5 rounded-xl border flex flex-col items-center justify-between text-center transition-all duration-150 cursor-pointer min-h-[64px] ${progressClass} ${
                      isActive 
                        ? 'ring-2 ring-blue-900 ring-offset-2 border-transparent font-black shadow-xs' 
                        : 'hover:shadow-3xs'
                    }`}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider">{mPerf.monthName}</span>
                    {mPerf.total > 0 ? (
                      <div className="flex flex-col items-center gap-1 mt-1 shrink-0">
                        <span className="text-[11px] font-extrabold font-display leading-none">{mPerf.rate}%</span>
                        <span className="text-[8px] font-medium leading-none text-slate-500">{mPerf.completed}/{mPerf.total}</span>
                      </div>
                    ) : (
                      <span className="text-[8px] text-slate-400 italic font-bold">--</span>
                    )}
                    <span className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${dotClass}`} />
                  </motion.button>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
