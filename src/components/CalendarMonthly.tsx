import { Task } from '../types';
import { DAYS_SHORT, MONTHS, getCalendarGrid, formatDateString, DEFAULT_CATEGORIES } from '../utils';
import { ChevronLeft, ChevronRight, PlusCircle, Check } from 'lucide-react';
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
    <div className="bg-m3-surface-container rounded-3xl border border-m3-surface-variant/30 p-3 sm:p-5 shadow-2xs flex flex-col h-full min-h-0 sm:min-h-[580px]">
      {/* Month Selector Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
        <div className="min-w-0 text-center sm:text-left">
          <h2 className="text-lg sm:text-xl font-extrabold font-display text-m3-on-surface tracking-tight truncate">
            {MONTHS[monthIndex]} <span className="font-normal text-m3-on-surface-variant/80">{year}</span>
          </h2>
          <p className="text-[10px] sm:text-xs text-m3-on-surface-variant font-semibold mt-0.5 hidden sm:block">Tap a day to view and edit tasks</p>
        </div>
        
        <div className="flex items-center justify-between sm:justify-end gap-1.5 w-full sm:w-auto shrink-0">
          <button
            onClick={selectToday}
            className="flex-1 sm:flex-none px-3.5 py-2 text-[10px] sm:text-xs font-bold rounded-full border border-m3-outline/25 text-m3-on-surface bg-m3-surface hover:bg-m3-surface-variant/30 transition active:scale-95 cursor-pointer shadow-3xs text-center"
          >
            Today
          </button>
          <div className="flex items-center rounded-full border border-m3-outline/20 bg-m3-surface shadow-3xs overflow-hidden shrink-0">
            <button
              onClick={prevMonth}
              className="p-2 text-m3-on-surface-variant hover:bg-m3-surface-variant/30 transition cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="w-px h-4 bg-m3-outline/10" />
            <button
              onClick={nextMonth}
              className="p-2 text-m3-on-surface-variant hover:bg-m3-surface-variant/30 transition cursor-pointer"
              title="Next Month"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="w-full">
        <div className="flex flex-col">
          {/* Week Day Titles */}
          <div className="grid grid-cols-7 gap-1 text-center font-display font-extrabold text-[10px] sm:text-xs text-m3-on-surface-variant mb-2 py-2 border-b border-m3-outline/10">
            {DAYS_SHORT.map((day) => (
              <div key={day} className="py-0.5">
                <span className="sm:hidden">{day.charAt(0)}</span>
                <span className="hidden sm:inline">{day}</span>
              </div>
            ))}
          </div>

          {/* Month Days Grid */}
          <div className="grid grid-cols-7 gap-1.5 flex-1 select-none">
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
                  className={`group relative min-h-[62px] sm:min-h-[95px] p-1.5 rounded-2xl flex flex-col justify-between border transition-all cursor-pointer duration-200 active:scale-[0.97] ${
                    isCurrentMonth
                      ? 'bg-m3-surface border-m3-outline/10 hover:border-m3-primary/30 hover:bg-m3-surface-variant/10'
                      : 'bg-m3-surface-container/40 border-m3-outline/5 text-m3-on-surface-variant/40'
                  } ${
                    isSelected
                      ? 'ring-2 ring-m3-primary border-transparent bg-m3-primary/5'
                      : ''
                  } ${isToday ? 'bg-m3-primary/5 border-m3-primary/30' : ''}`}
                >
                  {/* Day Number Header */}
                  <div className="flex items-start justify-between">
                    <span
                      className={`text-[10px] sm:text-xs font-bold flex items-center justify-center w-5.5 h-5.5 sm:w-6.5 sm:h-6.5 rounded-lg ${
                        isToday
                          ? 'bg-m3-primary text-white font-extrabold shadow-3xs'
                          : isSelected
                          ? 'bg-m3-primary-container text-m3-on-primary-container font-extrabold border border-m3-primary/20'
                          : isCurrentMonth
                          ? 'text-m3-on-surface'
                          : 'text-m3-on-surface-variant/40'
                      }`}
                    >
                      {date.getDate()}
                    </span>

                    {/* Quick Add Button */}
                    {isCurrentMonth && (
                      <button
                        id={`quick-add-${dateStr}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onQuickAddTask(dateStr);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-m3-on-surface-variant hover:text-m3-primary hover:bg-m3-surface-variant/30 rounded-md transition duration-150 cursor-pointer hidden md:block"
                        title="Quick add task"
                      >
                        <PlusCircle size={13} />
                      </button>
                    )}
                  </div>

                  {/* Tasks Summary — compact on mobile */}
                  <div className="mt-1 flex-1 flex flex-col justify-end gap-0.5 overflow-hidden">
                    {/* Mobile task dots */}
                    <div className="sm:hidden flex items-center justify-center gap-0.5 min-h-[14px]">
                      {totalCount > 0 && (
                        <>
                          {Array.from({ length: Math.min(totalCount, 3) }).map((_, i) => (
                            <span
                              key={i}
                              className={`w-1.5 h-1.5 rounded-full ${
                                hasHighPriority && !dayTasks.every(t => t.completed)
                                  ? 'bg-red-500'
                                  : 'bg-m3-primary'
                              }`}
                            />
                          ))}
                          {totalCount > 3 && (
                            <span className="text-[8px] font-extrabold text-m3-on-surface-variant">+{totalCount - 3}</span>
                          )}
                        </>
                      )}
                    </div>

                    {/* Desktop task pills */}
                    <div className="hidden sm:flex flex-col gap-0.5">
                      {dayTasks.slice(0, 2).map((task) => {
                        const catColor = DEFAULT_CATEGORIES[task.category] || DEFAULT_CATEGORIES['Other'];
                        return (
                          <div
                            key={task.id}
                            className={`text-[9.5px] px-1.5 py-0.5 rounded-lg truncate flex items-center gap-1 font-semibold select-none ${
                              task.completed
                                ? 'bg-m3-surface-variant/50 text-m3-on-surface-variant/50 line-through border border-m3-outline/5'
                                : `${catColor.bgClass} shadow-3xs`
                            }`}
                          >
                            <TaskIcon task={task} size={10} variant="plain" completed={task.completed} />
                            <span className="truncate">{task.title}</span>
                          </div>
                        );
                      })}
                      {dayTasks.length > 2 && (
                        <span className="text-[8.5px] font-bold text-m3-on-surface-variant pl-1.5">
                          +{dayTasks.length - 2} more
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Day Indicators Footer — desktop only */}
                  {totalCount > 0 && (
                    <div className="hidden sm:flex items-center gap-1 mt-1 shrink-0">
                      {hasHighPriority && (
                        <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" title="High Priority alert" />
                      )}
                      <div className="flex items-center gap-0.5 text-[8.5px] font-bold text-m3-on-surface-variant">
                        {completedCount === totalCount ? (
                          <span className="flex items-center text-emerald-600 dark:text-emerald-400 font-extrabold gap-0.5 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                            <Check size={8} strokeWidth={3} />
                            Done
                          </span>
                        ) : (
                          <span className="bg-m3-surface-variant/60 border border-m3-outline/5 px-1 py-0.2 rounded text-m3-on-surface-variant">
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
