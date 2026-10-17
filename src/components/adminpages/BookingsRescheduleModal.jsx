import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Calendar, Clock, ChevronDown, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { getAvailableStartTimes, isOutsideBookingWindow } from '../../../lib/bookingService';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const REASON_OPTIONS = [
  'Customer requested change of schedule',
  'Weather condition / Rain',
  'Court maintenance',
  'Player conflict / Emergency',
  'Other'
];

// Reasons a customer picks on their own My Bookings page
const CUSTOMER_REASON_OPTIONS = [
  'Change of plans',
  'Schedule conflict',
  'Weather condition / Rain',
  'Emergency',
  'Other'
];

/**
 * BookingsRescheduleModal
 *  - fromView: true when opened from the View modal (left button reads "Back")
 *  - onConfirmReschedule({ booking, date, startTime, reason, notes }) must return a Promise.
 *    If it throws, the error is shown here and the modal stays open.
 *  - The booking keeps its ORIGINAL duration; only the date/time changes.
 */
export default function BookingsRescheduleModal({
  isOpen = false,
  onClose,
  onBack,
  fromView = false,
  booking = null,
  onConfirmReschedule,
  // variant="customer": customer reasons, no "notify customer" checkbox
  variant = 'admin',
}) {
  const isCustomer = variant === 'customer';
  const reasonOptions = isCustomer ? CUSTOMER_REASON_OPTIONS : REASON_OPTIONS;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [reason, setReason] = useState('');
  const [isReasonOpen, setIsReasonOpen] = useState(false);

  const [newDateDisplay, setNewDateDisplay] = useState('');
  const [selectedDateObj, setSelectedDateObj] = useState(null); // { year, month, dayNumber }
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const [newStartTime, setNewStartTime] = useState('');
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
  const [availableTimes, setAvailableTimes] = useState([]);
  const [loadingTimes, setLoadingTimes] = useState(false);

  const [notes, setNotes] = useState('');
  const [notifyCustomer, setNotifyCustomer] = useState(true);
  const [showCancellationPolicy, setShowCancellationPolicy] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const reasonRef = useRef(null);
  const datePickerRef = useRef(null);
  const timePickerRef = useRef(null);

  const duration = booking?.duration || 1;

  // Reset the form whenever a booking is opened
  useEffect(() => {
    if (booking && isOpen) {
      setReason('');
      setIsReasonOpen(false);
      setNewDateDisplay('');
      setSelectedDateObj(null);
      setIsDatePickerOpen(false);
      setNewStartTime('');
      setIsTimePickerOpen(false);
      setAvailableTimes([]);
      setNotes('');
      setNotifyCustomer(true);
      setShowCancellationPolicy(false);
      setError('');
      setSaving(false);

      // open the calendar on the booking's current month (or today if it's in the past)
      const base = booking.start && booking.start > today ? booking.start : new Date();
      setViewYear(base.getFullYear());
      setViewMonth(base.getMonth());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking, isOpen]);

  // Load real availability when a date is chosen
  useEffect(() => {
    if (!isOpen || !booking || !selectedDateObj) {
      setAvailableTimes([]);
      return;
    }
    let cancelled = false;
    setLoadingTimes(true);
    getAvailableStartTimes(
      { year: selectedDateObj.year, month: selectedDateObj.month, day: selectedDateObj.dayNumber },
      duration,
      {
        // the booking's own current slot shouldn't block it (e.g. moving it 1 hour later)
        ignore: booking.status !== 'Cancelled' ? { start: booking.start, end: booking.end } : undefined,
        // the duration can't change on reschedule, so a 1-hr booking can't move to a daytime start
        strictDuration: true,
      }
    )
      .then((times) => {
        if (cancelled) return;
        setAvailableTimes(times);
        setNewStartTime((current) =>
          current && !times.some((t) => t.label === current && t.available) ? '' : current
        );
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoadingTimes(false));
    return () => {
      cancelled = true;
    };
  }, [isOpen, booking, selectedDateObj, duration]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event) {
      if (reasonRef.current && !reasonRef.current.contains(event.target)) setIsReasonOpen(false);
      if (datePickerRef.current && !datePickerRef.current.contains(event.target)) setIsDatePickerOpen(false);
      if (timePickerRef.current && !timePickerRef.current.contains(event.target)) setIsTimePickerOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(event) {
      if (event.key === 'Escape' && !saving) onClose?.();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, saving]);

  // Calendar days generation
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();
    const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const days = [];
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      days.push({ dayNumber: daysInPrevMonth - i, month: viewMonth - 1, year: viewYear, isCurrentMonth: false });
    }
    for (let i = 1; i <= daysInCurrentMonth; i++) {
      days.push({ dayNumber: i, month: viewMonth, year: viewYear, isCurrentMonth: true });
    }
    const remaining = 35 - days.length > 0 ? 35 - days.length : 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ dayNumber: i, month: viewMonth + 1, year: viewYear, isCurrentMonth: false });
    }
    return days;
  }, [viewYear, viewMonth]);

  if (!isOpen || !booking) return null;

  const handlePrevMonth = (e) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = (e) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleSelectDay = (dayObj) => {
    const d = new Date(dayObj.year, dayObj.month, dayObj.dayNumber); // normalize filler days
    setSelectedDateObj({ year: d.getFullYear(), month: d.getMonth(), dayNumber: d.getDate() });
    setNewDateDisplay(`${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`);
    setIsDatePickerOpen(false);
    setError('');
  };

  const formattedDateTime = `${booking.date} • ${booking.time}`;

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!selectedDateObj) {
      setError('Please select a new date');
      return;
    }
    if (!newStartTime) {
      setError('Please select a new start time');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await onConfirmReschedule?.({
        booking,
        date: { year: selectedDateObj.year, month: selectedDateObj.month, day: selectedDateObj.dayNumber },
        startTime: newStartTime,
        reason: reason || null,
        notes: notes || null,
        notifyCustomer,
      });
      onClose?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-[2px] select-none animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose?.();
      }}
    >
      <div className="w-full max-w-[460px] sm:max-w-[480px] bg-[#ffffff] border border-[#dedbc4] rounded-2xl shadow-2xl p-4 sm:p-5 flex flex-col relative transition-all duration-150">

        {/* HEADER */}
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-[17px] font-bold text-[#121212] tracking-tight">
            Reschedule Booking
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="p-1 -mr-1 rounded-full text-[#6b7280] hover:text-[#121212] transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4.5 h-4.5 stroke-[2.4]" />
          </button>
        </div>

        <div className="mx-2.5 h-px bg-[#dedbc4] mt-2.5 mb-3 sm:mt-3 sm:mb-3.5" />

        {/* UPPER SECTION */}
        <div className="flex items-center gap-2 mb-2.5">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-[#f5f3e5] text-[#121212] border border-[#dedbc4]/60 select-none whitespace-nowrap">
            Ref #: {booking.ref}
          </span>
          <span className="text-[11px] text-[#525252]">
            Duration stays {duration} {duration === 1 ? 'hr' : 'hrs'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-x-4 mb-1">
          <div>
            <span className="block text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#525252] mb-0.5">
              CUSTOMER
            </span>
            <p className="text-xs sm:text-[13px] font-bold text-[#121212] truncate">{booking.customer}</p>
          </div>
          <div className="text-right">
            <span className="block text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#525252] mb-0.5">
              CURRENT DATE & TIME
            </span>
            <p className="text-xs sm:text-[13px] font-bold text-[#121212] truncate">{formattedDateTime}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="bg-[#fcfbf7] border border-[#dedbc4] rounded-2xl p-3 sm:p-3.5 my-2.5 sm:my-3 space-y-2.5">
            {/* Reason */}
            <div className="relative" ref={reasonRef}>
              <label className="block text-xs font-bold text-[#404040] mb-1">Reason</label>
              <button
                type="button"
                onClick={() => {
                  setIsReasonOpen(!isReasonOpen);
                  setIsDatePickerOpen(false);
                  setIsTimePickerOpen(false);
                }}
                className={`w-full h-8 sm:h-8.5 px-3 bg-[#ffffff] border border-[#dedbc4] hover:border-[#121212] rounded-lg text-xs transition-colors flex items-center justify-between text-left focus:outline-none focus:border-[#121212] cursor-pointer ${
                  reason ? 'text-[#121212] font-medium' : 'text-[#9ca3af]'
                }`}
              >
                <span className="truncate">{reason || 'Select a reason'}</span>
                <ChevronDown className="w-4 h-4 text-[#6b7280] shrink-0 ml-1.5" />
              </button>

              {isReasonOpen && (
                <div className="absolute top-full mt-1 left-0 right-0 z-60 bg-[#ffffff] border border-[#dedbc4] rounded-xl p-1 shadow-xl select-none animate-in fade-in zoom-in-95 duration-100">
                  {reasonOptions.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        setReason(opt);
                        setIsReasonOpen(false);
                        setError('');
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors cursor-pointer ${
                        reason === opt ? 'bg-[#121212] text-[#ccff00] font-bold' : 'text-[#121212] hover:bg-neutral-100 font-medium'
                      }`}
                    >
                      <span className="truncate">{opt}</span>
                      {reason === opt && <Check className="w-3.5 h-3.5 stroke-[2.5] shrink-0 ml-1" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* New Date & New Start Time */}
            <div className="grid grid-cols-2 gap-2.5">
              {/* New Date */}
              <div className="relative" ref={datePickerRef}>
                <label className="block text-xs font-bold text-[#404040] mb-1">New Date</label>
                <button
                  type="button"
                  onClick={() => {
                    setIsDatePickerOpen(!isDatePickerOpen);
                    setIsReasonOpen(false);
                    setIsTimePickerOpen(false);
                  }}
                  className={`w-full h-8 sm:h-8.5 px-2.5 bg-[#ffffff] border border-[#dedbc4] hover:border-[#121212] rounded-lg text-xs transition-colors flex items-center justify-between text-left focus:outline-none focus:border-[#121212] cursor-pointer ${
                    newDateDisplay ? 'text-[#121212] font-medium' : 'text-[#9ca3af]'
                  }`}
                >
                  <span className="truncate">{newDateDisplay || 'dd/mm/yyyy'}</span>
                  <Calendar className="w-4 h-4 stroke-[1.8] text-[#121212] shrink-0 ml-1" />
                </button>

                {isDatePickerOpen && (
                  <div className="absolute top-full mt-1 left-0 z-60 w-64 bg-[#ffffff] border border-[#dedbc4] rounded-2xl p-2.5 shadow-2xl select-none animate-in fade-in zoom-in-95 duration-100">
                    <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-[#dedbc4]/60">
                      <button type="button" onClick={handlePrevMonth} className="p-1 hover:bg-[#fbfaf1] rounded-lg text-[#121212] transition-colors cursor-pointer" title="Previous month">
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-xs font-bold text-[#121212]">
                        {MONTH_NAMES[viewMonth]} {viewYear}
                      </span>
                      <button type="button" onClick={handleNextMonth} className="p-1 hover:bg-[#fbfaf1] rounded-lg text-[#121212] transition-colors cursor-pointer" title="Next month">
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-semibold text-[#6b7280] mb-1">
                      <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
                    </div>

                    <div className="grid grid-cols-7 gap-0.5 text-center text-xs">
                      {calendarDays.map((d, index) => {
                        const normalized = new Date(d.year, d.month, d.dayNumber);
                        const isSelected =
                          selectedDateObj &&
                          selectedDateObj.year === normalized.getFullYear() &&
                          selectedDateObj.month === normalized.getMonth() &&
                          selectedDateObj.dayNumber === normalized.getDate();
                        // past days and days beyond the 30-day booking window
                        const past = isOutsideBookingWindow({
                          year: normalized.getFullYear(),
                          month: normalized.getMonth(),
                          day: normalized.getDate(),
                        });

                        return (
                          <button
                            key={`${d.year}-${d.month}-${d.dayNumber}-${index}`}
                            type="button"
                            disabled={past}
                            onClick={() => handleSelectDay(d)}
                            className={`w-6.5 h-6.5 rounded-lg flex items-center justify-center text-[11px] font-medium transition-all ${
                              isSelected
                                ? 'bg-[#121212] text-[#ccff00] font-bold shadow-xs cursor-pointer'
                                : past
                                ? 'text-neutral-200 cursor-not-allowed'
                                : d.isCurrentMonth
                                ? 'text-[#121212] hover:bg-[#fbfaf1] hover:font-bold cursor-pointer'
                                : 'text-neutral-300 hover:text-neutral-400 cursor-pointer'
                            }`}
                          >
                            {d.dayNumber}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* New Start Time (real availability) */}
              <div className="relative" ref={timePickerRef}>
                <label className="block text-xs font-bold text-[#404040] mb-1">New Start Time</label>
                <button
                  type="button"
                  onClick={() => {
                    setIsTimePickerOpen(!isTimePickerOpen);
                    setIsDatePickerOpen(false);
                    setIsReasonOpen(false);
                  }}
                  className={`w-full h-8 sm:h-8.5 px-2.5 bg-[#ffffff] border border-[#dedbc4] hover:border-[#121212] rounded-lg text-xs transition-colors flex items-center justify-between text-left focus:outline-none focus:border-[#121212] cursor-pointer ${
                    newStartTime ? 'text-[#121212] font-medium' : 'text-[#9ca3af]'
                  }`}
                >
                  <span className="truncate">{newStartTime || '--:-- --'}</span>
                  <Clock className="w-4 h-4 stroke-[1.8] text-[#121212] shrink-0 ml-1" />
                </button>

                {isTimePickerOpen && (
                  <div className="absolute top-full mt-1 right-0 z-60 w-48 max-h-48 overflow-y-auto bg-[#ffffff] border border-[#dedbc4] rounded-xl p-1 shadow-2xl select-none animate-in fade-in zoom-in-95 duration-100">
                    {!selectedDateObj && (
                      <p className="px-2.5 py-1.5 text-xs text-[#6b7280]">Pick a date first</p>
                    )}
                    {selectedDateObj && loadingTimes && (
                      <p className="px-2.5 py-1.5 text-xs text-[#6b7280]">Checking availability...</p>
                    )}
                    {selectedDateObj && !loadingTimes && availableTimes.map(({ label, available, reason: why }) => {
                      const isSelected = newStartTime === label;
                      return (
                        <button
                          key={label}
                          type="button"
                          disabled={!available}
                          onClick={() => {
                            setNewStartTime(label);
                            setIsTimePickerOpen(false);
                            setError('');
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors ${
                            !available
                              ? 'text-neutral-300 cursor-not-allowed'
                              : isSelected
                              ? 'bg-[#121212] text-[#ccff00] font-bold cursor-pointer'
                              : 'text-[#121212] hover:bg-neutral-100 font-medium cursor-pointer'
                          }`}
                        >
                          <span>{label}</span>
                          {isSelected && <Check className="w-3 h-3 stroke-[2.5]" />}
                          {!available && <span className="text-[10px]">{why}</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-bold text-[#404040] mb-1">Notes</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any relevant details here..."
                className="w-full h-15 sm:h-16 px-3 py-2 bg-[#ffffff] border border-[#dedbc4] rounded-lg text-xs text-[#121212] placeholder-[#9ca3af] focus:outline-none focus:border-[#121212] transition-colors resize-none leading-relaxed"
              />
            </div>
          </div>

          {/* Policy and Notify Row */}
          <div className="flex items-center justify-between px-0.5 my-1 text-xs">
            <button
              type="button"
              onClick={() => setShowCancellationPolicy((prev) => !prev)}
              className="text-[#2563eb] hover:text-[#1d4ed8] hover:underline font-medium cursor-pointer"
            >
              View Reschedule Policy
            </button>

            {!isCustomer && (
              <label className="flex items-center gap-1.5 text-xs text-[#404040] font-normal cursor-pointer select-none">
                <span>Notify customer via SMS/Email</span>
                <input
                  type="checkbox"
                  checked={notifyCustomer}
                  onChange={(e) => setNotifyCustomer(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-blue-600 accent-blue-600 focus:ring-0 cursor-pointer"
                />
              </label>
            )}
          </div>

          {showCancellationPolicy && (
            <div className="mt-1.5 p-2 bg-neutral-100/90 rounded-lg text-[11px] text-[#525252] leading-tight animate-in fade-in duration-100">
              Bookings may be rescheduled at least 24 hours before the schedule, subject to court availability.
              The duration and the amount paid stay the same.
            </div>
          )}

          {error && <p className="text-[11px] font-semibold text-red-600 mt-1">{error}</p>}

          <div className="mx-2.5 h-px bg-[#dedbc4] mt-2.5 mb-3 sm:mt-3 sm:mb-3.5" />

          {/* BUTTONS */}
          <div className="w-full flex items-center justify-between gap-2 pt-0.5">
            <button
              type="button"
              onClick={fromView ? onBack : onClose}
              disabled={saving}
              className="px-6 sm:px-7 py-2 rounded-full font-bold text-xs sm:text-sm bg-[#d1d5db] text-[#121212] hover:bg-[#c4c8ce] active:scale-[0.98] transition-all cursor-pointer text-center disabled:opacity-50"
            >
              {fromView ? 'Back' : 'Close'}
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-6 sm:px-7 py-2 rounded-full font-bold text-xs sm:text-sm bg-[#ccff00] text-[#121212] hover:bg-[#b8e600] active:scale-[0.98] transition-all cursor-pointer shadow-xs text-center disabled:opacity-60 disabled:cursor-wait"
            >
              {saving ? 'Saving...' : 'Confirm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}