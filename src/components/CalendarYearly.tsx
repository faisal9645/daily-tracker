import { Task } from '../types';
import { MONTHS, getDaysInMonth, formatDateString } from '../utils';
import { Award, ChevronLeft, ChevronRight, Activity, Calendar } from 'lucide-react';
import { motion } from 'motion/react';

interface CalendarYearlyProps {
  currentDate: Date;
  onChangeDate: (date: Date) => void;
  tasks: Task[];
  onSelectDay: (dateStr: string) => void;
  onSelectMonth: (monthIndex: number) => void;
}

export default function CalendarYearly({
  currentDate,
  onChangeDate,
  tasks,
  onSelectDay,
  onSelectMonth,
}: CalendarYearlyProps) {
  const selectedYear = currentDate.getFullYear();

  const handlePrevYear = () => {
    const d = new Date(selectedYear - 1, currentDate.getMonth(), 1);
    onChangeDate(d);
  };

  const handleNextYear = () => {
    const d = new Date(selectedYear + 1, currentDate.getMonth(), 1);
    onChangeDate(d);
  };

  // Calculate year statistics
  const yearTasks = tasks.filter((t) => {
    const taskDate = new Date(t.date);
    return taskDate.getFullYear() === selectedYear;
  });

  const totalYearTasks = yearTasks.length;
  const completedYearTasks = yearTasks.filter((t) => t.completed).length;

  // Percentage of accomplishments
  const completedRatio = totalYearTasks > 0 ? Math.round((completedYearTasks / totalYearTasks) * 100) : 0;

  // Count active days (days with at least 1 task done)
  const activeDaysSet = new Set(
    yearTasks.filter((t) => t.completed).map((t) => t.date)
  );
  const totalActiveDays = activeDaysSet.size;

  return (
    <div className="bg-m3-surface-container rounded-3xl border border-m3-surface-variant/30 p-3 sm:p-5 shadow-2xs flex flex-col gap-5">
      {/* Yearly Navigation Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-3 border-b border-m3-outline/10">
        <div className="min-w-0">
          <span className="text-[10px] uppercase font-bold tracking-widest text-m3-primary bg-m3-primary-container px-3 py-1 rounded-full border border-m3-primary/20">
            Yearly Grid
          </span>
          <h2 className="text-xl font-extrabold font-display text-m3-on-surface tracking-tight mt-2.5">
            Year of {selectedYear}
          </h2>
          <p className="text-[11px] sm:text-xs text-m3-on-surface-variant font-semibold mt-1 hidden sm:block">
            Visual activity mapping of your yearly goals. Click any day to view daily tasks.
          </p>
        </div>

        <div className="flex items-center justify-center sm:justify-end gap-2">
          <button
            onClick={handlePrevYear}
            className="p-2 border border-m3-outline/20 rounded-full text-m3-on-surface-variant hover:bg-m3-surface-variant/30 transition shadow-3xs active:scale-95 cursor-pointer"
            title="Previous Year"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="font-display font-extrabold text-sm text-m3-on-surface px-4 py-1.5 bg-m3-surface rounded-full border border-m3-outline/20 min-w-[5rem] text-center select-none shadow-3xs">
            {selectedYear}
          </span>
          <button
            onClick={handleNextYear}
            className="p-2 border border-m3-outline/20 rounded-full text-m3-on-surface-variant hover:bg-m3-surface-variant/30 transition shadow-3xs active:scale-95 cursor-pointer"
            title="Next Year"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Hero Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-m3-surface border border-m3-outline/10 p-3 rounded-2xl flex items-center gap-3 shadow-3xs col-span-2 md:col-span-1">
          <div className="p-2.5 bg-m3-primary/10 text-m3-primary rounded-xl shrink-0">
            <Activity size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-m3-on-surface-variant uppercase tracking-wider">Active Days</p>
            <p className="text-lg font-extrabold font-display text-m3-primary mt-0.5 leading-none">{totalActiveDays}</p>
          </div>
        </div>

        <div className="bg-m3-surface border border-m3-outline/10 p-3 rounded-2xl flex items-center gap-3 shadow-3xs">
          <div className="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl shrink-0">
            <Award size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-m3-on-surface-variant uppercase tracking-wider font-sans">Completion</p>
            <p className="text-lg font-extrabold font-display text-emerald-650 mt-0.5 leading-none">
              {completedRatio}%
            </p>
          </div>
        </div>

        <div className="bg-m3-surface border border-m3-outline/10 p-3 rounded-2xl flex items-center gap-3 shadow-3xs">
          <div className="p-2.5 bg-m3-on-surface-variant/10 text-m3-on-surface-variant rounded-xl shrink-0">
            <Calendar size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-m3-on-surface-variant uppercase tracking-wider">Total Tasks</p>
            <p className="text-lg font-extrabold font-display text-m3-on-surface mt-0.5 leading-none">{totalYearTasks}</p>
          </div>
        </div>
      </div>

      {/* Grid Legend */}
      <div className="flex flex-wrap items-center gap-2.5 text-xs text-m3-on-surface-variant bg-m3-surface border border-m3-outline/10 rounded-2xl p-2.5 shadow-3xs">
        <span className="font-bold text-[9px] uppercase tracking-wider pl-1 shrink-0">Activity:</span>
        <div className="w-3.5 h-3.5 rounded-md bg-m3-surface border border-m3-outline/15 shrink-0" title="No tasks" />
        <div className="w-3.5 h-3.5 rounded-md bg-m3-primary/10 border border-m3-primary/20 shrink-0" title="Light activity" />
        <div className="w-3.5 h-3.5 rounded-md bg-m3-primary/40 border border-m3-primary/50 shrink-0" title="Moderate activity" />
        <div className="w-3.5 h-3.5 rounded-md bg-m3-primary border border-m3-primary/70 shrink-0" title="High activity" />
        <div className="w-3.5 h-3.5 rounded-md bg-emerald-500 flex items-center justify-center text-[7px] text-white font-extrabold shrink-0" title="Fully Completed">✓</div>
        <span className="font-bold text-[9px] uppercase tracking-wider shrink-0">Done</span>
      </div>

      {/* 12-Month Calendar Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {MONTHS.map((monthName, monthIndex) => {
          const monthDays = getDaysInMonth(selectedYear, monthIndex);

          // Get stats for this month
          const monthTasks = yearTasks.filter((t) => {
            const taskDate = new Date(t.date);
            return taskDate.getMonth() === monthIndex;
          });

          const completedInMonth = monthTasks.filter((t) => t.completed).length;
          const totalInMonth = monthTasks.length;
          const pct = totalInMonth > 0 ? Math.round((completedInMonth / totalInMonth) * 100) : 0;

          return (
            <div
              key={monthName}
              className="p-3 rounded-2xl border border-m3-outline/10 bg-m3-surface hover:border-m3-primary/25 hover:shadow-xs transition duration-200 flex flex-col justify-between"
            >
              {/* Month Selector Title */}
              <div className="flex items-center justify-between mb-3 min-w-0 gap-2">
                <button
                  onClick={() => onSelectMonth(monthIndex)}
                  className="font-display font-extrabold text-sm text-m3-on-surface hover:text-m3-primary text-left transition cursor-pointer truncate shrink-0"
                >
                  {monthName}
                </button>
                {totalInMonth > 0 && (
                  <span className={`text-[8.5px] font-bold px-1.5 py-0.5 rounded-md shrink-0 border ${
                    pct === 100
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                      : 'bg-m3-surface-container text-m3-on-surface-variant border-m3-outline/10'
                  }`}>
                    {pct}%
                  </span>
                )}
              </div>

              {/* Day dot matrix (Heatmap) */}
              <div className="grid grid-cols-7 gap-0.5 sm:gap-1 flex-1">
                {monthDays.map((day) => {
                  const dateStr = formatDateString(day);
                  const dayTasks = yearTasks.filter((t) => t.date === dateStr);
                  
                  const total = dayTasks.length;
                  const completed = dayTasks.filter((t) => t.completed).length;
                  const isFullyCompleted = total > 0 && completed === total;

                  // Define background styling matching intensity of tasks
                  let bgStyling = 'bg-m3-surface border border-m3-outline/10 text-m3-on-surface-variant/40';
                  if (total > 0) {
                    if (isFullyCompleted) {
                      bgStyling = 'bg-emerald-500 text-white font-bold border border-emerald-600';
                    } else if (total >= 4) {
                      bgStyling = 'bg-m3-primary text-white border border-m3-primary/80 font-bold';
                    } else if (total >= 2) {
                      bgStyling = 'bg-m3-primary/40 text-m3-on-surface border border-m3-primary/30 font-semibold';
                    } else {
                      bgStyling = 'bg-m3-primary/10 text-m3-on-surface border border-m3-primary/20 font-semibold';
                    }
                  }

                  return (
                    <div
                      key={dateStr}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectDay(dateStr);
                      }}
                      className={`w-full aspect-square rounded-md flex items-center justify-center text-[8px] cursor-pointer hover:scale-110 active:scale-95 transition-all duration-150 relative group ${bgStyling}`}
                      title={`${dateStr}: ${completed}/${total} completed`}
                    >
                      {day.getDate()}

                      {/* Tooltip on hover */}
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1.5 hidden group-hover:block bg-slate-900 text-white text-[9px] px-2 py-1 rounded-lg shadow-md pointer-events-none whitespace-nowrap border border-slate-950 z-50">
                        {monthName.substring(0, 3)} {day.getDate()}: {total} tasks ({completed} done)
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
