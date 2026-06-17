import { Task } from '../types';
import { DAYS_SHORT, MONTHS, getCalendarGrid, formatDateString, DEFAULT_CATEGORIES } from '../utils';
import { ChevronLeft, ChevronRight, PlusCircle, AlertCircle, Check } from 'lucide-react';
import TaskIcon from './TaskIcon';

interface CalendarMonthlyProps {
  currentDate: Date;
  onChangeDate: (date: Date) => void;
  tasks: Task[];
  onSelectDay: (dateStr: string) => void;
  onQuickAddTask: (dateStr: string) => void;
}

export default function CalendarMonthly({
  currentDate,
  onChangeDate,
  tasks,
  onSelectDay,
  onQuickAddTask,
}: CalendarMonthlyProps) {
  const year = currentDate.getFullYear();
  const monthIndex = currentDate.getMonth();

  const gridDays = getCalendarGrid(year, monthIndex);

  const prevMonth = () => {
    const d = new Date(year, monthIndex - 1, 1);
    onChangeDate(d);
  };

  const nextMonth = () => {
    const d = new Date(year, monthIndex + 1, 1);
    onChangeDate(d);
  };

  const selectToday = () => {
    onChangeDate(new Date());
  };

  return (
    <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 p-3 sm:p-6 shadow-xs flex flex-col h-full min-h-0 sm:min-h-[580px]">
      {/* Month Selector Header */}
      <div className="flex items-center justify-between mb-4 sm:mb-6 gap-3">
        <div className="min-w-0">
          <h2 className="text-lg sm:text-2xl font-bold font-display text-slate-900 tracking-tight truncate">
            {MONTHS[monthIndex]} <span className="font-normal text-slate-500">{year}</span>
          </h2>
          <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 hidden sm:block">Tap a day to view and edit tasks</p>
        </div>
        
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={selectToday}
            className="touch-target px-2.5 sm:px-3.5 py-1.5 text-[10px] sm:text-xs font-semibold rounded-lg border border-slate-200 text-slate-750 bg-white active:bg-slate-50 transition shadow-2xs"
          >
            Today
          </button>
          <div className="flex items-center rounded-lg border border-slate-200 bg-white shadow-2xs">
            <button
              onClick={prevMonth}
              className="touch-target p-2 text-slate-500 active:text-blue-900 active:bg-slate-50 transition rounded-l-lg"
              title="Previous Month"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="w-px h-4 bg-slate-200" />
            <button
              onClick={nextMonth}
              className="touch-target p-2 text-slate-500 active:text-blue-900 active:bg-slate-50 transition rounded-r-lg"
              title="Next Month"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="w-full">
        <div className="flex flex-col">
          {/* Week Day Titles */}
          <div className="grid grid-cols-7 gap-0.5 sm:gap-1 text-center font-display font-bold text-[10px] sm:text-xs text-slate-500 mb-1.5 sm:mb-2 py-1.5 sm:py-2 border-b border-slate-200">
            {DAYS_SHORT.map((day) => (
              <div key={day} className="py-1">
                <span className="sm:hidden">{day.charAt(0)}</span>
                <span className="hidden sm:inline">{day}</span>
              </div>
            ))}
          </div>

          {/* Month Days Grid */}
          <div className="grid grid-cols-7 gap-0.5 sm:gap-1.5 flex-1 select-none">
            {gridDays.map((date, index) => {
              const dateStr = formatDateString(date);
              const dayTasks = tasks.filter((t) => t.date === dateStr);
              const isCurrentMonth = date.getMonth() === monthIndex;
              const isToday = dateStr === formatDateString(new Date());
              const isSelected = dateStr === formatDateString(currentDate);

              // Calculate completion and priority stats for the day
              const completedCount = dayTasks.filter((t) => t.completed).length;
              const totalCount = dayTasks.length;
              const hasHighPriority = dayTasks.some((t) => t.priority === 'high' && !t.completed);
              
              return (
                <div
                  key={dateStr + index}
                  onClick={() => onSelectDay(dateStr)}
                  className={`group relative min-h-[58px] sm:min-h-[90px] p-1 sm:p-2 rounded-lg sm:rounded-xl flex flex-col justify-between border transition-all cursor-pointer duration-200 active:scale-[0.98] ${
                    isCurrentMonth
                      ? 'bg-white border-slate-200 hover:border-blue-200 hover:bg-slate-50/50'
                      : 'bg-slate-50/70 border-slate-200/50 text-slate-400'
                  } ${
                    isSelected
                      ? 'ring-2 ring-blue-900 border-transparent bg-blue-50/30'
                      : ''
                  } ${isToday ? 'bg-blue-50/40 border-blue-200' : ''}`}
                >
                  {/* Day Number Header */}
                  <div className="flex items-start justify-between">
                    <span
                      className={`text-[10px] sm:text-xs font-semibold flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-md sm:rounded-lg ${
                        isToday
                          ? 'bg-blue-900 text-white font-bold'
                          : isSelected
                          ? 'bg-blue-50 text-blue-900 font-semibold border border-blue-200'
                          : isCurrentMonth
                          ? 'text-slate-800'
                          : 'text-slate-400'
                      }`}
                    >
                      {date.getDate()}
                    </span>

                    {/* Quick Add Button on Hover */}
                    {isCurrentMonth && (
                      <button
                        id={`quick-add-${dateStr}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onQuickAddTask(dateStr);
                        }}
                        className="opacity-100 md:opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-blue-900 transition duration-150 rounded-md cursor-pointer"
                        title="Quick add task"
                      >
                        <PlusCircle size={14} />
                      </button>
                    )}
                  </div>

                  {/* Tasks Summary — compact on mobile */}
                  <div className="mt-0.5 sm:mt-1 flex-1 flex flex-col justify-end gap-0.5 sm:gap-1 overflow-hidden">
                    <div className="sm:hidden flex items-center justify-center gap-0.5 min-h-[14px]">
                      {totalCount > 0 && (
                        <>
                          {Array.from({ length: Math.min(totalCount, 3) }).map((_, i) => (
                            <span
                              key={i}
                              className={`w-1.5 h-1.5 rounded-full ${hasHighPriority && !dayTasks.every(t => t.completed) ? 'bg-rose-500' : 'bg-blue-600'}`}
                            />
                          ))}
                          {totalCount > 3 && (
                            <span className="text-[8px] font-bold text-slate-500">+{totalCount - 3}</span>
                          )}
                        </>
                      )}
                    </div>
                    <div className="hidden sm:flex flex-col gap-1">
                    {dayTasks.slice(0, 2).map((task) => {
                      const catColor = DEFAULT_CATEGORIES[task.category] || DEFAULT_CATEGORIES['Other'];
                      return (
                        <div
                          key={task.id}
                          className={`text-[9px] px-1.5 py-0.5 rounded-md truncate flex items-center gap-1 font-medium select-none ${
                            task.completed
                              ? 'bg-slate-100 text-slate-400 line-through border border-slate-205'
                              : `${catColor.bgClass} shadow-3xs`
                          }`}
                        >
                          <TaskIcon task={task} size={10} variant="plain" completed={task.completed} />
                          <span className="truncate text-slate-750">{task.title}</span>
                        </div>
                      );
                    })}
                    {dayTasks.length > 2 && (
                      <span className="text-[8px] font-bold text-slate-500 pl-1">
                        +{dayTasks.length - 2} more
                      </span>
                    )}
                    </div>
                  </div>

                  {/* Day Indicators Footer — desktop only */}
                  {totalCount > 0 && (
                    <div className="hidden sm:flex items-center gap-1 mt-1 shrink-0">
                      {/* High priority indicator */}
                      {hasHighPriority && (
                        <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse" title="Incomplete High Priority Tasks" />
                      )}
                      {/* Progress fraction for complete tasks */}
                      <div className="flex items-center gap-0.5 text-[8px] font-semibold text-slate-500">
                        {completedCount === totalCount ? (
                          <span className="flex items-center text-emerald-700 font-bold gap-0.5 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                            <Check size={8} strokeWidth={3} />
                            Done
                          </span>
                        ) : (
                          <span className="bg-slate-100 border border-slate-205 px-1 py-0.2 rounded text-slate-600">
                            {completedCount}/{totalCount}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
