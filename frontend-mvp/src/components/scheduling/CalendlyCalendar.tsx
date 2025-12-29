'use client';

import { useState, useMemo } from 'react';
import { DayPicker } from 'react-day-picker';
import { format, parseISO, isSameDay } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Calendar as CalendarIcon, MapPin, TestTube, AlertCircle } from 'lucide-react';
import { TimeSlot } from '@/types/scheduling';
import 'react-day-picker/dist/style.css';

interface CalendlyCalendarProps {
    availableSlots: TimeSlot[];
    selectedSlot: TimeSlot | null;
    onSelectSlot: (slot: TimeSlot) => void;
    timezone?: string;
    testMode?: boolean;
}

const IST_TIMEZONE = 'Asia/Kolkata';

export function CalendlyCalendar({
    availableSlots,
    selectedSlot,
    onSelectSlot,
    timezone = IST_TIMEZONE,
    testMode = false
}: CalendlyCalendarProps) {
    const [selectedDate, setSelectedDate] = useState<Date | undefined>();
    const [showManualEntry, setShowManualEntry] = useState(false);

    // Get unique dates that have available slots
    const datesWithSlots = useMemo(() => {
        return Array.from(
            new Set(availableSlots.map(slot => slot.date))
        ).map(dateStr => parseISO(dateStr));
    }, [availableSlots]);

    // Get slots for selected date
    const slotsForDate = useMemo(() => {
        if (!selectedDate) return [];
        return availableSlots.filter(slot =>
            isSameDay(parseISO(slot.date), selectedDate)
        );
    }, [selectedDate, availableSlots]);

    // Group slots by time of day
    const groupedSlots = useMemo(() => {
        const morning = slotsForDate.filter(s => s.slot_type === 'morning');
        const afternoon = slotsForDate.filter(s => s.slot_type === 'afternoon');
        const evening = slotsForDate.filter(s => s.slot_type === 'evening');

        return { morning, afternoon, evening };
    }, [slotsForDate]);

    // Auto-select first available date
    useState(() => {
        if (datesWithSlots.length > 0 && !selectedDate) {
            setSelectedDate(datesWithSlots[0]);
        }
    });

    return (
        <>
            {/* All styles in one block */}
            <style jsx global>{`
                /* Calendar Styles */
                .calendar-container .rdp {
                    --rdp-cell-size: 48px;
                    --rdp-accent-color: #fff;
                    --rdp-background-color: rgba(255, 255, 255, 0.1);
                }
                .calendar-container .rdp-months {
                    justify-content: center;
                }
                .calendar-container .rdp-month {
                    color: white;
                }
                .calendar-container .rdp-caption {
                    color: white;
                    margin-bottom: 1.5rem;
                }
                .calendar-container .rdp-caption_label {
                    font-size: 15px;
                    font-weight: 600;
                }
                .calendar-container .rdp-head_cell {
                    color: rgba(255, 255, 255, 0.4);
                    font-size: 12px;
                    font-weight: 500;
                    text-transform: uppercase;
                }
                .calendar-container .rdp-cell {
                    color: rgba(255, 255, 255, 0.3);
                }
                .calendar-container .rdp-day {
                    border-radius: 10px;
                    color: rgba(255, 255, 255, 0.6);
                    font-size: 14px;
                    font-weight: 500;
                    transition: all 0.15s ease;
                }
                .calendar-container .rdp-day:hover:not(.rdp-day_disabled) {
                    background-color: rgba(255, 255, 255, 0.08);
                    color: white;
                }
                .calendar-container .rdp-day_selected {
                    background-color: white !important;
                    color: black !important;
                    font-weight: 600;
                }
                .calendar-container .rdp-day_disabled {
                    color: rgba(255, 255, 255, 0.08);
                    cursor: not-allowed;
                }
                .calendar-container .rdp-day_today:not(.rdp-day_selected) {
                    color: #60a5fa;
                    font-weight: 600;
                    background-color: rgba(96, 165, 250, 0.1);
                }
                .calendar-container .has-slots {
                    position: relative;
                }
                .calendar-container .has-slots::after {
                    content: '';
                    position: absolute;
                    bottom: 6px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 4px;
                    height: 4px;
                    border-radius: 50%;
                    background-color: #22c55e;
                }
                .calendar-container .rdp-day_selected.has-slots::after {
                    background-color: #000;
                }
                .calendar-container .rdp-nav_button {
                    color: rgba(255, 255, 255, 0.6);
                    transition: all 0.15s ease;
                }
                .calendar-container .rdp-nav_button:hover {
                    background-color: rgba(255, 255, 255, 0.08);
                    color: white;
                }

                /* Custom Scrollbar Styles */
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: rgba(255, 255, 255, 0.03);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.15);
                }
            `}</style>

            <div className="space-y-4">
                {/* Test Mode Manual Entry */}
                {testMode && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="border border-purple-500/20 bg-purple-500/5 rounded-xl p-4"
                    >
                        <div className="flex items-center gap-2 mb-3">
                            <TestTube className="w-4 h-4 text-purple-400" />
                            <h3 className="text-[13px] text-purple-400 font-semibold">Test Mode</h3>
                        </div>

                        <button
                            onClick={() => setShowManualEntry(!showManualEntry)}
                            className="text-[12px] text-purple-300 hover:text-purple-200 underline"
                        >
                            {showManualEntry ? 'Hide' : 'Show'} Manual Time Entry
                        </button>

                        {showManualEntry && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mt-3"
                            >
                                <ManualTimeEntry onTimeSelect={onSelectSlot} />
                            </motion.div>
                        )}
                    </motion.div>
                )}

                {/* Calendar Grid */}
                <div className="grid lg:grid-cols-[420px,1fr] gap-0 border border-white/[0.08] rounded-2xl overflow-hidden bg-white/[0.02]">
                    {/* Left: Calendar Section */}
                    <div className="p-6 border-r border-white/[0.08]">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-base font-semibold text-white flex items-center gap-2">
                                <CalendarIcon className="w-4 h-4" />
                                Select a Date
                            </h3>
                            <div className="flex items-center gap-1.5 text-[12px] text-white/50">
                                <MapPin className="w-3.5 h-3.5" />
                                <span>IST</span>
                            </div>
                        </div>

                        <div className="calendar-container">
                            <DayPicker
                                mode="single"
                                selected={selectedDate}
                                onSelect={setSelectedDate}
                                disabled={(date) => {
                                    // Disable dates in the past
                                    if (date < new Date(new Date().setHours(0, 0, 0, 0))) {
                                        return true;
                                    }
                                    // Disable dates with no slots
                                    return !datesWithSlots.some(d => isSameDay(d, date));
                                }}
                                modifiers={{
                                    hasSlots: datesWithSlots
                                }}
                                modifiersClassNames={{
                                    hasSlots: 'has-slots'
                                }}
                                fromDate={new Date()}
                                toDate={new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)}
                            />
                        </div>

                        <div className="mt-6 pt-6 border-t border-white/[0.06] space-y-3">
                            <div className="flex items-center gap-2 text-[12px] text-white/40">
                                <div className="w-2 h-2 rounded-full bg-green-400" />
                                <span>Dates with available slots</span>
                            </div>
                            <div className="flex items-center gap-2 text-[12px] text-white/40">
                                <div className="w-2 h-2 rounded-full bg-blue-400" />
                                <span>Today</span>
                            </div>
                        </div>
                    </div>

                    {/* Right: Time Slots Section */}
                    <div className="p-6 lg:p-8">
                        <AnimatePresence mode="wait">
                            {!selectedDate ? (
                                <motion.div
                                    key="no-date"
                                    initial={{ opacity: 0, x: 10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -10 }}
                                    className="flex flex-col items-center justify-center h-full text-center py-12"
                                >
                                    <div className="w-16 h-16 rounded-full bg-white/[0.05] flex items-center justify-center mb-4">
                                        <Clock className="w-8 h-8 text-white/30" />
                                    </div>
                                    <h3 className="text-base font-medium text-white mb-2">
                                        Select a date
                                    </h3>
                                    <p className="text-[13px] text-white/50 max-w-[280px]">
                                        Choose a date from the calendar to view available interview times
                                    </p>
                                </motion.div>
                            ) : slotsForDate.length === 0 ? (
                                <motion.div
                                    key="no-slots"
                                    initial={{ opacity: 0, x: 10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -10 }}
                                    className="flex flex-col items-center justify-center h-full text-center py-12"
                                >
                                    <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                                        <Clock className="w-8 h-8 text-red-400/60" />
                                    </div>
                                    <h3 className="text-base font-medium text-white mb-2">
                                        No available times
                                    </h3>
                                    <p className="text-[13px] text-white/50 max-w-[280px]">
                                        Please select another date from the calendar
                                    </p>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="slots"
                                    initial={{ opacity: 0, x: 10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -10 }}
                                    className="space-y-6"
                                >
                                    {/* Header */}
                                    <div>
                                        <h3 className="text-lg font-semibold text-white mb-1">
                                            {format(selectedDate, 'EEEE, MMMM d')}
                                        </h3>
                                        <p className="text-[13px] text-white/50">
                                            {slotsForDate.length} time slots available in IST
                                        </p>
                                    </div>

                                    {/* Time Slots */}
                                    <div className="space-y-5 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                                        {groupedSlots.morning.length > 0 && (
                                            <TimeSlotGroup
                                                label="Morning"
                                                icon="🌅"
                                                slots={groupedSlots.morning}
                                                selectedSlot={selectedSlot}
                                                onSelectSlot={onSelectSlot}
                                            />
                                        )}

                                        {groupedSlots.afternoon.length > 0 && (
                                            <TimeSlotGroup
                                                label="Afternoon"
                                                icon="☀️"
                                                slots={groupedSlots.afternoon}
                                                selectedSlot={selectedSlot}
                                                onSelectSlot={onSelectSlot}
                                            />
                                        )}

                                        {groupedSlots.evening.length > 0 && (
                                            <TimeSlotGroup
                                                label="Evening"
                                                icon="🌙"
                                                slots={groupedSlots.evening}
                                                selectedSlot={selectedSlot}
                                                onSelectSlot={onSelectSlot}
                                            />
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </>
    );
}

function ManualTimeEntry({ onTimeSelect }: { onTimeSelect: (slot: TimeSlot) => void }) {
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = () => {
        if (!date || !time) {
            setError('Please enter both date and time');
            return;
        }

        // Combine date and time into ISO format
        const datetime = `${date}T${time}:00+05:30`; // IST timezone
        const selectedTime = new Date(datetime);
        const now = new Date();

        if (selectedTime <= now) {
            setError('Selected time must be in the future');
            return;
        }

        // Calculate end time (30 minutes later)
        const endTime = new Date(selectedTime.getTime() + 30 * 60 * 1000);

        // Determine slot type
        const hour = selectedTime.getHours();
        let slotType = 'morning';
        if (hour >= 12 && hour < 17) slotType = 'afternoon';
        else if (hour >= 17) slotType = 'evening';

        // Create mock slot
        const mockSlot: TimeSlot = {
            slot_id: 'manual-slot',
            date: date,
            start_time: time,
            end_time: endTime.toTimeString().slice(0, 5),
            datetime: datetime,
            timezone: 'Asia/Kolkata',
            is_available: true,
            slot_type: slotType
        };

        setError('');
        onTimeSelect(mockSlot);
    };

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-[11px] text-white/50 font-medium mb-1.5">
                        Date
                    </label>
                    <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full px-3 py-2 bg-white/[0.06] border border-white/[0.08] rounded-lg text-[13px] text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    />
                </div>
                <div>
                    <label className="block text-[11px] text-white/50 font-medium mb-1.5">
                        Time (IST)
                    </label>
                    <input
                        type="time"
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                        className="w-full px-3 py-2 bg-white/[0.06] border border-white/[0.08] rounded-lg text-[13px] text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    />
                </div>
            </div>

            {error && (
                <div className="flex items-start gap-1.5 text-[11px] text-red-400">
                    <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            <button
                onClick={handleSubmit}
                className="w-full py-2 bg-purple-500 hover:bg-purple-600 text-white text-[12px] font-medium rounded-lg transition-colors"
            >
                Use This Time
            </button>
        </div>
    );
}

function TimeSlotGroup({
    label,
    icon,
    slots,
    selectedSlot,
    onSelectSlot
}: {
    label: string;
    icon: string;
    slots: TimeSlot[];
    selectedSlot: TimeSlot | null;
    onSelectSlot: (slot: TimeSlot) => void;
}) {
    return (
        <div>
            <div className="flex items-center gap-2 mb-3">
                <span className="text-base">{icon}</span>
                <span className="text-[12px] text-white/40 uppercase tracking-wider font-semibold">
                    {label}
                </span>
                <span className="text-[11px] text-white/30 ml-auto">
                    {slots.length} slots
                </span>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
                {slots.map(slot => {
                    const isSelected = selectedSlot?.slot_id === slot.slot_id;
                    return (
                        <motion.button
                            key={slot.slot_id}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => onSelectSlot(slot)}
                            className={`
                                relative py-3 px-4 rounded-xl text-[13px] font-medium 
                                transition-all border
                                ${isSelected
                                    ? 'bg-white text-black border-white shadow-lg shadow-white/20'
                                    : 'bg-white/[0.03] border-white/[0.08] text-white hover:bg-white/[0.06] hover:border-white/[0.12]'
                                }
                            `}
                        >
                            <span className="block">{slot.start_time}</span>
                            {isSelected && (
                                <motion.div
                                    layoutId="selected-indicator"
                                    className="absolute inset-0 rounded-xl ring-2 ring-white ring-offset-2 ring-offset-[#0a0a0a]"
                                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                />
                            )}
                        </motion.button>
                    );
                })}
            </div>
        </div>
    );
}