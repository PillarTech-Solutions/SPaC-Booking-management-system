import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
// ⚠ Adjust if this file is not 3 folders below the project root
import {
  getAvailableStartTimes,
  calculatePrice,
  parseHour,
  minDurationFor,
  isOutsideBookingWindow,
  maxBookableDate,
  RULES,
} from '../../../lib/bookingService';

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function BookingStep1({
  bookingData,
  updateBookingData,
  onNext,
  calculatedTotal,
}) {
  const now = new Date();
  const selectedDay = bookingData.day ?? now.getDate();
  const selectedMonthIdx = Math.max(0, MONTHS.indexOf(bookingData.month ?? MONTHS[now.getMonth()]));
  const selectedYear = bookingData.year ?? now.getFullYear();
  const selectedTime = bookingData.startTime || '';
  const duration = bookingData.duration || 1;
  const minDuration = minDurationFor(selectedTime); // 2 for daytime starts, 1 for nighttime

  const [view, setView] = useState({ month: selectedMonthIdx, year: selectedYear });
  const [times, setTimes] = useState([]);
  const [loadingTimes, setLoadingTimes] = useState(false);
  const [timesError, setTimesError] = useState('');
  const [stepError, setStepError] = useState('');

  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const firstWeekday = new Date(view.year, view.month, 1).getDay();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isSelected = (d) =>
    d === selectedDay && view.month === selectedMonthIdx && view.year === selectedYear;

  // Past days and days beyond the 30-day booking window are disabled
  const isPast = (d) => isOutsideBookingWindow({ year: view.year, month: view.month, day: d });

  const lastDay = maxBookableDate();
  const canGoPrev =
    view.year > today.getFullYear() ||
    (view.year === today.getFullYear() && view.month > today.getMonth());
  const canGoNext =
    view.year < lastDay.year || (view.year === lastDay.year && view.month < lastDay.month);

  // Load real availability for the selected date + duration
  useEffect(() => {
    let cancelled = false;
    setLoadingTimes(true);
    setTimesError('');
    getAvailableStartTimes({ year: selectedYear, month: selectedMonthIdx, day: selectedDay }, duration)
      .then((list) => {
        if (cancelled) return;
        setTimes(list);
        // clear the chosen time if it's no longer available
        if (selectedTime && !list.some((t) => t.label === selectedTime && t.available)) {
          updateBookingData({ startTime: '' });
        }
      })
      .catch((err) => !cancelled && setTimesError(err.message))
      .finally(() => !cancelled && setLoadingTimes(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, selectedMonthIdx, selectedDay, duration]);

  const changeMonth = (delta) => {
    setView((v) => {
      const d = new Date(v.year, v.month + delta, 1);
      return { month: d.getMonth(), year: d.getFullYear() };
    });
  };

  const dateFormatted = `${String(selectedMonthIdx + 1).padStart(2, '0')}/${String(selectedDay).padStart(2, '0')}/${selectedYear}`;

  const handleDaySelect = (day) => {
    setStepError('');
    updateBookingData({ day, month: MONTHS[view.month], year: view.year, startTime: '' });
  };

  const handleTimeSelect = (slot) => {
    if (!slot.available) return;
    setStepError('');
    // Daytime starts need at least 2 hours, so bump the duration if needed
    updateBookingData({ startTime: slot.label, duration: Math.max(duration, minDurationFor(slot.label)) });
  };

  // Once a start time is picked, the duration can only go up to the next booking / 2:00 AM closing
  const selectedSlot = times.find((t) => t.label === selectedTime);
  const maxDuration = Math.min(8, selectedSlot?.maxHours || 8);

  const handleDurationChange = (delta) => {
    const newDur = Math.max(minDuration, Math.min(maxDuration, duration + delta));
    updateBookingData({ duration: newDur });
  };

  const handleNext = () => {
    if (!selectedTime) {
      setStepError('Please pick an available start time.');
      return;
    }
    onNext();
  };

  const price = selectedTime ? calculatePrice({ startHour: parseHour(selectedTime), duration }) : null;
  const rateNote = !price
    ? ''
    : price.dayHours && price.nightHours
    ? `(${price.dayHours} hr daytime ₱${RULES.dayRate} + ${price.nightHours} hr nighttime ₱${RULES.nightRate})`
    : price.nightHours
    ? `(Nighttime rate ₱${RULES.nightRate}/hr)`
    : `(Daytime rate ₱${RULES.dayRate}/hr)`;

  return (
    <div className="w-full flex flex-col">
      {/* Stepper Progress Bar */}
      <div className="w-full max-w-[576px] mx-auto pb-8 mb-6 border-b border-neutral-100 relative">
        <div className="relative flex items-center justify-between">
          <div className="absolute left-[40px] right-[40px] top-[20px] h-[2px] bg-neutral-200 z-0" />

          <div className="relative z-10 flex flex-col items-center">
            <div className="w-10 h-10 rounded-full bg-[#ccff00] flex items-center justify-center font-bold text-black text-sm ring-4 ring-white shadow-xs">
              1
            </div>
            <span className="mt-2 text-[11px] sm:text-xs font-bold text-black tracking-wider uppercase">
              DATE & TIME
            </span>
          </div>

          <div className="relative z-10 flex flex-col items-center">
            <div className="w-10 h-10 rounded-full bg-[#F7F6F0] border border-neutral-300 flex items-center justify-center font-semibold text-neutral-600 text-sm ring-4 ring-white">
              2
            </div>
            <span className="mt-2 text-[11px] sm:text-xs font-semibold text-neutral-500 tracking-wider uppercase">
              PLAYERS & GEAR
            </span>
          </div>

          <div className="relative z-10 flex flex-col items-center">
            <div className="w-10 h-10 rounded-full bg-[#F7F6F0] border border-neutral-300 flex items-center justify-center font-semibold text-neutral-600 text-sm ring-4 ring-white">
              3
            </div>
            <span className="mt-2 text-[11px] sm:text-xs font-semibold text-neutral-500 tracking-wider uppercase">
              REVIEW & CONFIRM
            </span>
          </div>
        </div>
      </div>

      {/* Title */}
      <div className="text-left mb-6">
        <h2 className="text-2xl sm:text-[30px] font-extrabold text-[#111827] tracking-tight leading-tight">
          When do you want to play?
        </h2>
        <p className="text-sm sm:text-base text-neutral-500 mt-1.5 font-normal">
          Pick a date, a start time, and how long you'll be on court.
        </p>
      </div>

      {/* Date & Start Time Summary */}
      <div className="bg-[#F7F6F0] border border-[#E7E5DC] rounded-2xl p-4 sm:p-5 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-bold text-neutral-600 uppercase tracking-wider mb-1.5">DATE</label>
            <div className="bg-white border border-neutral-300 rounded-xl px-4 py-2.5 flex items-center justify-between shadow-2xs">
              <span className="text-sm font-semibold text-neutral-800">{dateFormatted}</span>
              <CalendarIcon className="w-4 h-4 text-neutral-500 stroke-[1.8]" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-neutral-600 uppercase tracking-wider mb-1.5">START TIME</label>
            <div className="bg-white border border-neutral-300 rounded-xl px-4 py-2.5 flex items-center justify-between shadow-2xs">
              <span className={`text-sm font-semibold ${selectedTime ? 'text-neutral-800' : 'text-neutral-400'}`}>
                {selectedTime || 'Select a time'}
              </span>
              <Clock className="w-4 h-4 text-neutral-500 stroke-[1.8]" />
            </div>
          </div>
        </div>
      </div>

      {/* Calendar + Time Slots */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Calendar */}
        <div className="bg-white border border-[#E7E5DC] rounded-2xl p-5 sm:p-6 flex flex-col justify-between shadow-2xs">
          <div>
            <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-3">SELECT DATE</div>

            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={() => changeMonth(-1)}
                disabled={!canGoPrev}
                className="w-8 h-8 rounded-lg border border-neutral-200 flex items-center justify-center text-neutral-600 hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <h3 className="text-base font-bold text-[#1F2937]">
                {MONTHS[view.month]} {view.year}
              </h3>
              <button
                type="button"
                onClick={() => changeMonth(1)}
                disabled={!canGoNext}
                className="w-8 h-8 rounded-lg border border-neutral-200 flex items-center justify-center text-neutral-600 hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                aria-label="Next month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center mb-2">
              {DAYS_OF_WEEK.map((day) => (
                <div key={day} className="text-xs font-semibold text-neutral-500 py-1">{day}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-y-2 gap-x-1 text-center">
              {Array.from({ length: firstWeekday }).map((_, i) => (
                <div key={`blank-${i}`} />
              ))}

              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
                const past = isPast(d);
                return (
                  <button
                    key={d}
                    type="button"
                    disabled={past}
                    onClick={() => handleDaySelect(d)}
                    className={`h-9 flex items-center justify-center text-sm rounded-full transition-all ${
                      isSelected(d)
                        ? 'bg-[#ccff00] text-black font-extrabold shadow-xs scale-105 cursor-pointer'
                        : past
                        ? 'text-neutral-300 font-medium cursor-not-allowed'
                        : 'text-neutral-800 font-bold hover:bg-neutral-100 cursor-pointer'
                    }`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Time Slots & Duration */}
        <div className="bg-white border border-[#E7E5DC] rounded-2xl p-5 sm:p-6 flex flex-col justify-between shadow-2xs">
          <div>
            <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-3">SELECT START TIME</div>

            {loadingTimes ? (
              <p className="text-sm text-neutral-500 py-6 text-center">Checking availability...</p>
            ) : timesError ? (
              <p className="text-sm text-red-600 py-6 text-center">{timesError}</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {times.map((slot) => {
                  const selected = selectedTime === slot.label;
                  return (
                    <button
                      key={slot.label}
                      type="button"
                      disabled={!slot.available}
                      onClick={() => handleTimeSelect(slot)}
                      title={slot.reason || ''}
                      className={`py-2 px-1 text-xs font-semibold rounded-lg transition-all text-center select-none ${
                        selected
                          ? 'bg-[#ccff00] border-2 border-[#ccff00] text-black font-bold shadow-xs'
                          : !slot.available
                          ? 'bg-neutral-300 text-neutral-500 cursor-not-allowed border border-neutral-300'
                          : 'bg-white border border-neutral-300 text-neutral-800 hover:border-black cursor-pointer'
                      }`}
                    >
                      {slot.label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 mt-4 pt-2 text-xs text-neutral-600">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full border border-neutral-400 bg-white" />
                <span>Open</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-neutral-400" />
                <span>Unavailable</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ccff00]" />
                <span>Selected</span>
              </div>
            </div>
            <p className="text-[11px] text-neutral-500 text-center mt-2">
              Daytime (6 AM – 4 PM) needs at least 2 hours. Nighttime (4 PM – 2 AM) allows 1 hour.
              <br />
              Bookings are open up to {RULES.bookingWindowDays} days in advance.
            </p>
          </div>

          {/* Duration */}
          <div className="border-t border-neutral-100 pt-4 mt-4">
            <div className="text-[11px] font-bold text-neutral-800 uppercase tracking-wider mb-2">DURATION (HOURS)</div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleDurationChange(-1)}
                disabled={duration <= minDuration}
                className="w-11 h-11 rounded-xl border border-neutral-300 flex items-center justify-center text-lg font-bold text-neutral-800 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                aria-label="Decrease hours"
              >
                -
              </button>
              <div className="w-16 h-11 rounded-xl border border-neutral-300 flex items-center justify-center font-bold text-sm text-neutral-900 bg-white shadow-2xs">
                {duration}
              </div>
              <button
                type="button"
                onClick={() => handleDurationChange(1)}
                disabled={duration >= maxDuration}
                className="w-11 h-11 rounded-xl border border-neutral-300 flex items-center justify-center text-lg font-bold text-neutral-800 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                aria-label="Increase hours"
              >
                +
              </button>
              {selectedTime && <span className="text-xs text-neutral-500 ml-2">{rateNote}</span>}
            </div>
          </div>
        </div>
      </div>

      {stepError && <p className="text-sm text-red-600 font-semibold mb-3">{stepError}</p>}

      {/* Bottom Action Bar */}
      <div className="bg-[#111411] text-white rounded-2xl px-6 py-5 flex items-center justify-between shadow-md">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">TOTAL AMOUNT</div>
          <div className="text-2xl sm:text-[30px] font-extrabold text-[#ccff00] leading-none mt-1">
            ₱{calculatedTotal.toFixed(2)}
          </div>
        </div>

        <button
          type="button"
          onClick={handleNext}
          className="bg-[#ccff00] hover:bg-[#b8e600] text-black font-extrabold px-8 py-2.5 rounded-full text-sm sm:text-base shadow-md cursor-pointer transition-all hover:scale-105 active:scale-95"
        >
          Next
        </button>
      </div>
    </div>
  );
}