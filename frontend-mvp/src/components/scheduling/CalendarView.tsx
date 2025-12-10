
'use client';

import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarViewProps {
    currentMonth: Date;
    onMonthChange: (date: Date) => void;
    availableDates: string[];
    selectedDate: string | null;
    onSelectDate: (date: string) => void;
}

export function CalendarView({
    currentMonth,
    onMonthChange,
    availableDates,
    selectedDate,
    onSelectDate,
}: CalendarViewProps) {
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    const startDay = monthStart.getDay();

    const days: (Date | null)[] = [];

    // Add empty cells for days before month start
    for (let i = 0; i < startDay; i++) {
        days.push(null);
    }

    // Add all days of the month
    for (let i = 1; i <= monthEnd.getDate(); i++) {
        days.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i));
    }

    const goToPrevMonth = () => {
        onMonthChange(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    };

    const goToNextMonth = () => {
        onMonthChange(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    };

    const formatDateString = (date: Date): string => {
        // Format as YYYY-MM-DD in local timezone
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const isDateAvailable = (date: Date): boolean => {
        return availableDates.includes(formatDateString(date));
    };

    const isDateSelected = (date: Date): boolean => {
        return formatDateString(date) === selectedDate;
    };

    const isDatePast = (date: Date): boolean => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        date.setHours(0, 0, 0, 0);
        return date < today;
    };

    return (
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-5">
            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-4">
                <button
                    onClick={goToPrevMonth}
                    className="p-2 hover:bg-white/[0.06] rounded-lg transition-colors"
                >
                    <ChevronLeft className="w-5 h-5 text-white/60" />
                </button>

                <h3 className="text-[15px] font-semibold text-white">
                    {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </h3>

                <button
                    onClick={goToNextMonth}
                    className="p-2 hover:bg-white/[0.06] rounded-lg transition-colors"
                >
                    <ChevronRight className="w-5 h-5 text-white/60" />
                </button>
            </div>

            {/* Days of Week */}
            <div className="grid grid-cols-7 gap-1 mb-2">
                {daysOfWeek.map(day => (
                    <div key={day} className="text-center text-[12px] text-white/40 py-2">
                        {day}
                    </div>
                ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
                {days.map((date, index) => {
                    if (!date) {
                        return <div key={`empty-${index}`} className="aspect-square" />;
                    }

                    const available = isDateAvailable(date);
                    const selected = isDateSelected(date);
                    const past = isDatePast(date);

                    return (
                        <motion.button
                            key={formatDateString(date)}
                            whileHover={available ? { scale: 1.1 } : {}}
                            whileTap={available ? { scale: 0.95 } : {}}
                            onClick={() => available && onSelectDate(formatDateString(date))}
                            disabled={!available}
                            className={`
                aspect-square rounded-lg text-[14px] font-medium transition-all
                flex items-center justify-center relative
                ${selected
                                    ? 'bg-white text-black'
                                    : available
                                        ? 'bg-white/[0.06] text-white hover:bg-white/[0.12]'
                                        : past
                                            ? 'text-white/10'
                                            : 'text-white/30'
                                }
                ${available && !selected ? 'ring-1 ring-green-500/30' : ''}
              `}
                        >
                            {date.getDate()}
                            {available && !selected && (
                                <span className="absolute bottom-1 w-1 h-1 rounded-full bg-green-400" />
                            )}
                        </motion.button>
                    );
                })}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-white/[0.06]">
                <div className="flex items-center gap-2 text-[12px] text-white/40">
                    <div className="w-3 h-3 rounded bg-white/[0.06] ring-1 ring-green-500/30" />
                    Available
                </div>
                <div className="flex items-center gap-2 text-[12px] text-white/40">
                    <div className="w-3 h-3 rounded bg-white" />
                    Selected
                </div>
            </div>
        </div>
    );
}