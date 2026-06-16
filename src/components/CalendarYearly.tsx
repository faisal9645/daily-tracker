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
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col gap-6">
      {/* Yearly Navigation Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-widest text-blue-900 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
            Yearly Grid View
          </span>
          <h2 className="text-3xl font-bold font-display text-slate-900 tracking-tight mt-1.5 flex items-center gap-2">
            <span>Year of {selectedYear}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Visual activity mapping of your yearly goals. Click any day to view daily tasks.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevYear}
            className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:text-blue-900 hover:bg-slate-50 cursor-pointer transition shadow-2xs"
            title="Previous Year"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="font-display font-bold text-lg text-slate-800 px-3.5 py-1 bg-slate-50 rounded-lg border border-slate-200">
            {selectedYear}
          </span>
          <button
            onClick={handleNextYear}
            className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:text-blue-900 hover:bg-slate-50 cursor-pointer transition shadow-2xs"
            title="Next Year"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Hero Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-xl flex items-center gap-3 shadow-2xs">
          <div className="p-3 bg-blue-900/10 text-blue-900 rounded-lg">
            <Activity size={18} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Consistency Rating</p>
            <p className="text-xl font-bold font-display text-blue-900 mt-0.5">{totalActiveDays} Active Days</p>
          </div>
        </div>

        <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-xl flex items-center gap-3 shadow-2xs">
          <div className="p-3 bg-emerald-600/10 text-emerald-700 rounded-lg">
            <Award size={18} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Completed Value</p>
            <p className="text-xl font-bold font-display text-emerald-700 mt-0.5">
              {completedYearTasks}/{totalYearTasks} ({completedRatio}%)
            </p>
          </div>
        </div>

        <div className="bg-slate-50/70 border border-slate-100 p-4 rounded-xl flex items-center gap-3 shadow-2xs">
          <div className="p-3 bg-slate-200/50 text-slate-700 rounded-lg">
            <Calendar size={18} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Year-to-Date Volume</p>
            <p className="text-xl font-bold font-display text-slate-800 mt-0.5">{totalYearTasks} Tasks Registered</p>
          </div>
        </div>
      </div>

      {/* Grid Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 self-end mr-2 bg-slate-50 border border-slate-100 rounded-xl p-2.5">
        <span className="font-medium text-[10px]">No Tasks</span>
        <div className="w-3.5 h-3.5 rounded bg-slate-100 border border-slate-205" title="No task entries" />
        <div className="w-3.5 h-3.5 rounded bg-blue-50 border border-blue-200" title="Low task volume day" />
        <div className="w-3.5 h-3.5 rounded bg-blue-300 border border-blue-400" title="Medium task volume day" />
        <div className="w-3.5 h-3.5 rounded bg-blue-600 border border-blue-700" title="High task volume day" />
        <div className="w-3.5 h-3.5 rounded bg-emerald-500 flex items-center justify-center text-[8px] text-white font-bold" title="Completed Day">✓</div>
        <span className="font-medium text-[10px]">Fully Done</span>
      </div>

      {/* 12-Month Calendar Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
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
              className="p-4 rounded-xl border border-slate-200 hover:border-blue-200 hover:shadow-xs transition duration-200 flex flex-col justify-between bg-white"
            >
              {/* Month Selector Title */}
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => onSelectMonth(monthIndex)}
                  className="font-display font-bold text-sm text-slate-800 hover:text-blue-900 text-left transition focus:outline-hidden cursor-pointer"
                >
                  {monthName}
                </button>
                {totalInMonth > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm ${
                    pct === 100 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {pct}% done
                  </span>
                )}
              </div>

              {/* Day dot matrix (Heatmap) */}
              <div className="grid grid-cols-7 gap-1 flex-1">
                {monthDays.map((day) => {
                  const dateStr = formatDateString(day);
                  const dayTasks = yearTasks.filter((t) => t.date === dateStr);
                  
                  const total = dayTasks.length;
                  const completed = dayTasks.filter((t) => t.completed).length;
                  const isFullyCompleted = total > 0 && completed === total;

                  // Define background styling matching intensity of tasks
                  let bgStyling = 'bg-slate-50 border border-slate-205 text-slate-400';
                  if (total > 0) {
                    if (isFullyCompleted) {
                      bgStyling = 'bg-emerald-500 text-white font-bold border border-emerald-600';
                    } else if (total >= 4) {
                      bgStyling = 'bg-blue-600 text-white border border-blue-700 font-semibold';
                    } else if (total >= 2) {
                      bgStyling = 'bg-blue-300 text-blue-900 border border-blue-400 font-semibold';
                    } else {
                      bgStyling = 'bg-blue-50 text-blue-900 border border-blue-200 font-semibold';
                    }
                  }

                  return (
                    <div
                      key={dateStr}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectDay(dateStr);
                      }}
                      className={`w-full aspect-square rounded-md flex items-center justify-center text-[8px] cursor-pointer hover:scale-115 transition duration-150 relative group ${bgStyling}`}
                      title={`${dateStr}: ${completed}/${total} completed`}
                    >
                      {day.getDate()}

                      {/* Cool floating tooltip on hover */}
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1.5 hidden group-hover:block bg-slate-900 text-white text-[9px] px-2 py-1 rounded shadow-md pointer-events-none whitespace-nowrap border border-slate-950 z-50">
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
