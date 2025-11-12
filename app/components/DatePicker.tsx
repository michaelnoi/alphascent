'use client';

import { useState, useEffect } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';

interface DateInfo {
  date: string;
  count: number;
}

interface DatePickerProps {
  availableDates: DateInfo[];
  selectedDate: string | null;
  dateRange: { from: string; to: string } | null;
  onDateSelect: (date: string | null) => void;
  onDateRangeSelect: (from: string, to: string) => void;
}

export function DatePicker({ 
  availableDates, 
  selectedDate, 
  dateRange,
  onDateSelect,
  onDateRangeSelect 
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'single' | 'range'>('single');
  const [rangeStart, setRangeStart] = useState<string | null>(null);

  const displayText = () => {
    if (dateRange) {
      return `${dateRange.from} to ${dateRange.to}`;
    }
    if (selectedDate) {
      const dateInfo = availableDates.find(d => d.date === selectedDate);
      return `${selectedDate} (${dateInfo?.count || 0} papers)`;
    }
    return 'Select date';
  };

  const handleDateClick = (date: string) => {
    if (mode === 'single') {
      onDateSelect(date);
      setIsOpen(false);
    } else {
      if (!rangeStart) {
        setRangeStart(date);
      } else {
        const from = date < rangeStart ? date : rangeStart;
        const to = date > rangeStart ? date : rangeStart;
        onDateRangeSelect(from, to);
        setRangeStart(null);
        setIsOpen(false);
      }
    }
  };

  const handleToday = () => {
    if (availableDates.length > 0) {
      onDateSelect(availableDates[0].date);
      setIsOpen(false);
    }
  };

  const handleAllDates = () => {
    if (availableDates.length >= 2) {
      onDateRangeSelect(
        availableDates[availableDates.length - 1].date,
        availableDates[0].date
      );
      setIsOpen(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition-colors shadow-sm"
      >
        <Calendar className="w-4 h-4 text-gray-600" />
        <span className="font-medium text-gray-700">{displayText()}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-96 overflow-hidden flex flex-col">
            <div className="p-3 border-b border-gray-200 flex gap-2">
              <button
                onClick={handleToday}
                className="flex-1 px-3 py-1.5 text-xs font-medium bg-indigo-50 text-indigo-700 rounded hover:bg-indigo-100 transition-colors"
              >
                Today
              </button>
              <button
                onClick={handleAllDates}
                className="flex-1 px-3 py-1.5 text-xs font-medium bg-gray-50 text-gray-700 rounded hover:bg-gray-100 transition-colors"
              >
                All Available
              </button>
              <button
                onClick={() => setMode(mode === 'single' ? 'range' : 'single')}
                className="flex-1 px-3 py-1.5 text-xs font-medium bg-gray-50 text-gray-700 rounded hover:bg-gray-100 transition-colors"
              >
                {mode === 'single' ? 'Range Mode' : 'Single Mode'}
              </button>
            </div>

            {mode === 'range' && rangeStart && (
              <div className="px-3 py-2 bg-indigo-50 text-xs text-indigo-700 border-b border-indigo-100">
                Range start: {rangeStart} - select end date
              </div>
            )}

            <div className="overflow-y-auto">
              {availableDates.map(({ date, count }) => (
                <button
                  key={date}
                  onClick={() => handleDateClick(date)}
                  className={`
                    w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 transition-colors
                    flex items-center justify-between border-b border-gray-100 last:border-0
                    ${selectedDate === date ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700'}
                    ${rangeStart === date ? 'bg-indigo-100' : ''}
                  `}
                >
                  <span className="font-medium">{date}</span>
                  <span className="text-xs text-gray-500">{count} papers</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

