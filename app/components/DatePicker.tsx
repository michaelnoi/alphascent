'use client';

import { useState, useEffect, useRef } from 'react';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

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

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function parseDate(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00');
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function isDateInRange(date: string, from: string | null, to: string | null): boolean {
  if (!from || !to) return false;
  return date >= from && date <= to;
}

function isDateAvailable(date: string, availableDates: DateInfo[]): boolean {
  return availableDates.some(d => d.date === date);
}

export function DatePicker({ 
  availableDates, 
  selectedDate, 
  dateRange,
  onDateSelect,
  onDateRangeSelect 
}: DatePickerProps) { 
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'single' | 'range'>('range');
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [tempRangeEnd, setTempRangeEnd] = useState<string | null>(null);
  
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  
  const [fromInput, setFromInput] = useState('');
  const [toInput, setToInput] = useState('');
  
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (dateRange) {
      setFromInput(dateRange.from);
      setToInput(dateRange.to);
    } else if (selectedDate) {
      setFromInput(selectedDate);
      setToInput('');
    } else {
      setFromInput('');
      setToInput('');
    }
  }, [dateRange, selectedDate]);

  useEffect(() => {
    if (dateRange || selectedDate) {
      const dateToShow = dateRange ? parseDate(dateRange.from) : parseDate(selectedDate!);
      setCurrentMonth(dateToShow.getMonth());
      setCurrentYear(dateToShow.getFullYear());
    } else if (availableDates.length > 0) {
      const mostRecentDate = parseDate(availableDates[0].date);
      setCurrentMonth(mostRecentDate.getMonth());
      setCurrentYear(mostRecentDate.getFullYear());
    }
  }, [dateRange, selectedDate, availableDates]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleDateClick = (date: string) => {
    if (!isDateAvailable(date, availableDates)) return;

    if (mode === 'single') {
      onDateSelect(date);
      setIsOpen(false);
    } else {
      if (!rangeStart) {
        setRangeStart(date);
        setTempRangeEnd(null);
      } else {
        const from = date < rangeStart ? date : rangeStart;
        const to = date > rangeStart ? date : rangeStart;
        onDateRangeSelect(from, to);
        setRangeStart(null);
        setTempRangeEnd(null);
        setIsOpen(false);
      }
    }
  };

  const handleDateHover = (date: string) => {
    if (mode === 'range' && rangeStart && isDateAvailable(date, availableDates)) {
      setTempRangeEnd(date);
    }
  };

  const handleFromInputChange = (value: string) => {
    setFromInput(value);
    if (value.match(/^\d{4}-\d{2}-\d{2}$/) && isDateAvailable(value, availableDates)) {
      if (mode === 'single') {
        onDateSelect(value);
      } else {
        setRangeStart(value);
        setTempRangeEnd(null);
        if (toInput && toInput.match(/^\d{4}-\d{2}-\d{2}$/) && isDateAvailable(toInput, availableDates)) {
          const from = value < toInput ? value : toInput;
          const to = value > toInput ? value : toInput;
          onDateRangeSelect(from, to);
        }
      }
    }
  };

  const handleToInputChange = (value: string) => {
    setToInput(value);
    if (value.match(/^\d{4}-\d{2}-\d{2}$/) && isDateAvailable(value, availableDates)) {
      const startDate = rangeStart || fromInput;
      if (startDate && startDate.match(/^\d{4}-\d{2}-\d{2}$/) && isDateAvailable(startDate, availableDates)) {
        const from = value < startDate ? value : startDate;
        const to = value > startDate ? value : startDate;
        onDateRangeSelect(from, to);
        setRangeStart(null);
        setTempRangeEnd(null);
      } else {
        setRangeStart(value);
        setTempRangeEnd(null);
      }
    }
  };

  const handleToday = () => {
    if (availableDates.length > 0) {
      const today = formatDate(new Date());
      if (isDateAvailable(today, availableDates)) {
        onDateSelect(today);
      } else {
        onDateSelect(availableDates[0].date);
      }
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

  const handleClear = () => {
    onDateSelect(null);
    setRangeStart(null);
    setTempRangeEnd(null);
    setFromInput('');
    setToInput('');
  };

  const displayText = () => {
    if (dateRange) {
      return `${dateRange.from} to ${dateRange.to}`;
    }
    if (selectedDate) {
      const dateInfo = availableDates.find(d => d.date === selectedDate);
      return `${selectedDate} (${dateInfo?.count || 0})`;
    }
    return 'Select date';
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      if (currentMonth === 0) {
        setCurrentMonth(11);
        setCurrentYear(currentYear - 1);
      } else {
        setCurrentMonth(currentMonth - 1);
      }
    } else {
      if (currentMonth === 11) {
        setCurrentMonth(0);
        setCurrentYear(currentYear + 1);
      } else {
        setCurrentMonth(currentMonth + 1);
      }
    }
  };

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
  const days: (string | null)[] = [];

  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    const date = formatDate(new Date(currentYear, currentMonth, i));
    days.push(date);
  }

  const effectiveRangeEnd = tempRangeEnd || (dateRange ? dateRange.to : null);
  const effectiveRangeStart = rangeStart || (dateRange ? dateRange.from : null);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition-colors shadow-sm"
      >
        <Calendar className="w-4 h-4 text-gray-600" />
        <span className="font-medium text-gray-700">{displayText()}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-[600px] bg-white border border-gray-200 rounded-lg shadow-xl z-50">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex gap-2">
                <button
                  onClick={handleToday}
                  className="px-3 py-1.5 text-xs font-medium bg-indigo-50 text-indigo-700 rounded hover:bg-indigo-100 transition-colors"
                >
                  Today
                </button>
                <button
                  onClick={handleAllDates}
                  className="px-3 py-1.5 text-xs font-medium bg-gray-50 text-gray-700 rounded hover:bg-gray-100 transition-colors"
                >
                  All Available
                </button>
                <button
                  onClick={() => setMode(mode === 'single' ? 'range' : 'single')}
                  className="px-3 py-1.5 text-xs font-medium bg-gray-50 text-gray-700 rounded hover:bg-gray-100 transition-colors"
                >
                  {mode === 'single' ? 'Range Mode' : 'Single Mode'}
                </button>
                <button
                  onClick={() => setViewMode(viewMode === 'calendar' ? 'list' : 'calendar')}
                  className="px-3 py-1.5 text-xs font-medium bg-gray-50 text-gray-700 rounded hover:bg-gray-100 transition-colors"
                >
                  {viewMode === 'calendar' ? 'List View' : 'Calendar View'}
                </button>
                {(dateRange || selectedDate) && (
                  <button
                    onClick={handleClear}
                    className="px-3 py-1.5 text-xs font-medium bg-red-50 text-red-700 rounded hover:bg-red-100 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="flex gap-3 items-center">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">From</label>
                <input
                  type="text"
                  value={fromInput}
                  onChange={(e) => handleFromInputChange(e.target.value)}
                  placeholder="YYYY-MM-DD"
                  className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              {mode === 'range' && (
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-700 mb-1">To</label>
                  <input
                    type="text"
                    value={toInput}
                    onChange={(e) => handleToInputChange(e.target.value)}
                    placeholder="YYYY-MM-DD"
                    className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              )}
            </div>

            {mode === 'range' && rangeStart && (
              <div className="mt-2 px-3 py-2 bg-indigo-50 text-xs text-indigo-700 rounded">
                Range start: {rangeStart} - {tempRangeEnd ? `hovering: ${tempRangeEnd}` : 'select end date'}
              </div>
            )}
          </div>

          {viewMode === 'calendar' ? (
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => navigateMonth('prev')}
                  className="p-1 hover:bg-gray-100 rounded transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-600" />
                </button>
                <h3 className="text-sm font-semibold text-gray-900">
                  {monthNames[currentMonth]} {currentYear}
                </h3>
                <button
                  onClick={() => navigateMonth('next')}
                  className="p-1 hover:bg-gray-100 rounded transition-colors"
                >
                  <ChevronRight className="w-5 h-5 text-gray-600" />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1 mb-2">
                {dayNames.map(day => (
                  <div key={day} className="text-center text-xs font-medium text-gray-500 py-1">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {days.map((date, idx) => {
                  if (!date) {
                    return <div key={`empty-${idx}`} className="aspect-square" />;
                  }

                  const isAvailable = isDateAvailable(date, availableDates);
                  const isSelected = selectedDate === date;
                  const isRangeStart = effectiveRangeStart === date;
                  const isRangeEnd = effectiveRangeEnd === date;
                  const isInRange = effectiveRangeStart && effectiveRangeEnd && 
                    isDateInRange(date, effectiveRangeStart, effectiveRangeEnd);
                  const isToday = date === formatDate(new Date());

                  return (
                    <button
                      key={date}
                      onClick={() => handleDateClick(date)}
                      onMouseEnter={() => handleDateHover(date)}
                      disabled={!isAvailable}
                      className={`
                        aspect-square text-xs font-medium rounded transition-colors
                        ${!isAvailable ? 'text-gray-300 cursor-not-allowed' : ''}
                        ${isSelected ? 'bg-indigo-600 text-white' : ''}
                        ${isRangeStart ? 'bg-indigo-600 text-white rounded-l-full' : ''}
                        ${isRangeEnd ? 'bg-indigo-600 text-white rounded-r-full' : ''}
                        ${isInRange && !isRangeStart && !isRangeEnd ? 'bg-indigo-100 text-indigo-700' : ''}
                        ${!isSelected && !isInRange && isAvailable ? 'hover:bg-gray-100 text-gray-700' : ''}
                        ${isToday && !isSelected && !isInRange ? 'ring-2 ring-indigo-300' : ''}
                      `}
                    >
                      {new Date(date + 'T00:00:00').getDate()}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-4 max-h-96 overflow-y-auto">
              {availableDates.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-500">
                  No dates available
                </div>
              ) : (
                <div className="space-y-1">
                  {availableDates.map(({ date, count }) => {
                    const isSelected = selectedDate === date;
                    const isRangeStart = effectiveRangeStart === date;
                    const isRangeEnd = effectiveRangeEnd === date;
                    const isInRange = effectiveRangeStart && effectiveRangeEnd && 
                      isDateInRange(date, effectiveRangeStart, effectiveRangeEnd);

                    return (
                      <button
                        key={date}
                        onClick={() => handleDateClick(date)}
                        className={`
                          w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 transition-colors
                          flex items-center justify-between border-b border-gray-100 last:border-0
                          ${isSelected ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700'}
                          ${isRangeStart || isRangeEnd ? 'bg-indigo-100 text-indigo-700' : ''}
                          ${isInRange && !isRangeStart && !isRangeEnd ? 'bg-indigo-50 text-indigo-600' : ''}
                        `}
                      >
                        <span className="font-medium">{date}</span>
                        <span className="text-xs text-gray-500">{count} papers</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
