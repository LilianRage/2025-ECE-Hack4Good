import React from "react";
import { Calendar as CalendarIcon } from "lucide-react";

export function DateTimePicker({ value, onChange }) {
    return (
        <div
            className="fixed bottom-6 left-6 z-[1000] group"
            style={{
                backdropFilter: 'blur(10px)',
            }}
        >
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-black/80 border border-white/20 shadow-xl hover:bg-black/90 transition-all">
                <CalendarIcon className="h-4 w-4 text-white/60" />
                <input
                    type="datetime-local"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="bg-transparent text-white text-sm border-none outline-none focus:outline-none cursor-pointer"
                    style={{
                        colorScheme: 'dark',
                    }}
                />
            </div>
        </div>
    );
}
