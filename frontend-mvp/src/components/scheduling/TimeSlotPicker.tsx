'use client';

import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';
import { TimeSlot } from '@/types/scheduling';

interface TimeSlotPickerProps {
    slots: TimeSlot[];
    selectedSlot: TimeSlot | null;
    onSelectSlot: (slot: TimeSlot) => void;
    groupByTimeOfDay?: boolean;
}

export function TimeSlotPicker({
    slots,
    selectedSlot,
    onSelectSlot,
    groupByTimeOfDay = true,
}: TimeSlotPickerProps) {

    if (!groupByTimeOfDay) {
        return (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {slots.map(slot => (
                    <TimeSlotButton
                        key={slot.slot_id}
                        slot={slot}
                        isSelected={selectedSlot?.slot_id === slot.slot_id}
                        onSelect={onSelectSlot}
                    />
                ))}
            </div>
        );
    }

    // Group by time of day
    const morningSlots = slots.filter(s => s.slot_type === 'morning');
    const afternoonSlots = slots.filter(s => s.slot_type === 'afternoon');
    const eveningSlots = slots.filter(s => s.slot_type === 'evening');

    return (
        <div className="space-y-6">
            {morningSlots.length > 0 && (
                <TimeSlotGroup
                    label="Morning"
                    icon="🌅"
                    slots={morningSlots}
                    selectedSlot={selectedSlot}
                    onSelect={onSelectSlot}
                />
            )}

            {afternoonSlots.length > 0 && (
                <TimeSlotGroup
                    label="Afternoon"
                    icon="☀️"
                    slots={afternoonSlots}
                    selectedSlot={selectedSlot}
                    onSelect={onSelectSlot}
                />
            )}

            {eveningSlots.length > 0 && (
                <TimeSlotGroup
                    label="Evening"
                    icon="🌙"
                    slots={eveningSlots}
                    selectedSlot={selectedSlot}
                    onSelect={onSelectSlot}
                />
            )}

            {slots.length === 0 && (
                <div className="text-center py-12">
                    <Clock className="w-12 h-12 text-white/20 mx-auto mb-4" />
                    <p className="text-white/60">No available slots</p>
                </div>
            )}
        </div>
    );
}

function TimeSlotGroup({
    label,
    icon,
    slots,
    selectedSlot,
    onSelect,
}: {
    label: string;
    icon: string;
    slots: TimeSlot[];
    selectedSlot: TimeSlot | null;
    onSelect: (slot: TimeSlot) => void;
}) {
    return (
        <div>
            <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">{icon}</span>
                <span className="text-[13px] text-white/40 uppercase tracking-wide">{label}</span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {slots.map(slot => (
                    <TimeSlotButton
                        key={slot.slot_id}
                        slot={slot}
                        isSelected={selectedSlot?.slot_id === slot.slot_id}
                        onSelect={onSelect}
                    />
                ))}
            </div>
        </div>
    );
}

function TimeSlotButton({
    slot,
    isSelected,
    onSelect,
}: {
    slot: TimeSlot;
    isSelected: boolean;
    onSelect: (slot: TimeSlot) => void;
}) {
    return (
        <motion.button
            whileHover={{ scale: slot.is_available ? 1.03 : 1 }}
            whileTap={{ scale: slot.is_available ? 0.97 : 1 }}
            onClick={() => slot.is_available && onSelect(slot)}
            disabled={!slot.is_available}
            className={`
        py-3 px-4 rounded-xl text-[14px] font-medium transition-all border
        ${isSelected
                    ? 'bg-white text-black border-white'
                    : slot.is_available
                        ? 'bg-white/[0.03] border-white/[0.08] text-white hover:bg-white/[0.08] hover:border-white/[0.15]'
                        : 'bg-white/[0.02] border-white/[0.04] text-white/20 cursor-not-allowed'
                }
      `}
        >
            {slot.start_time}
        </motion.button>
    );
}