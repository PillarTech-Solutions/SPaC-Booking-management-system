import React, { useState, useRef, useEffect, useMemo } from 'react';
import { X, Calendar, Clock, ChevronDown, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import {
  getAvailableStartTimes,
  calculatePrice,
  parseHour,
  createStaffBooking,
  capacityFor,
  courtRateLabel,
  minDurationFor,
  isOutsideBookingWindow,
  RULES,
} from '../../../lib/bookingService';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Online bookings come from the customer portal, so they're not listed here
const BOOKING_SOURCES = ['Walk-in', 'Phone', 'Social Media'];

const PAYMENT_METHODS = ['Cash', 'GCash', 'Maya', 'Bank Transfer'];

// initialData (optional, e.g. from the Calendar's "+ Book"):
//   { date: { year, month, day }, startTime: '6:00 PM' } pre-fills Session Details
export default function AddBookingModal({ isOpen = true, onClose, onBookingAdded, initialData = null }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [currentStep, setCurrentStep] = useState(1);

  // Step 1: Session Details State
  const initDate = initialData?.date || null;
  const [selectedDate, setSelectedDate] = useState(
    initDate ? { year: initDate.year, month: initDate.month, dayNumber: initDate.day } : null
  ); // { year, month, dayNumber }
  const [dateDisplay, setDateDisplay] = useState(
    initDate
      ? `${String(initDate.day).padStart(2, '0')}/${String(initDate.month + 1).padStart(2, '0')}/${initDate.year}`
      : ''
  );
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [viewYear, setViewYear] = useState(initDate ? initDate.year : today.getFullYear());
  const [viewMonth, setViewMonth] = useState(initDate ? initDate.month : today.getMonth());

  const [startTime, setStartTime] = useState(initialData?.startTime || '');
  const [isStartTimeOpen, setIsStartTimeOpen] = useState(false);
  const [availableTimes, setAvailableTimes] = useState([]); // [{ label, available, reason }]
  const [loadingTimes, setLoadingTimes] = useState(false);

  // Start at the lowest allowed values (like the equipment counters).
  // Picking a daytime start bumps the duration to 2 hrs automatically.
  const [duration, setDuration] = useState(() => minDurationFor(initialData?.startTime || ''));
  const [players, setPlayers] = useState(1);
  const minDuration = minDurationFor(startTime);
  // Once a start time is picked, the duration can only go up to the next booking / 2:00 AM closing
  const selectedSlot = availableTimes.find((t) => t.label === startTime);
  const maxDuration = Math.min(20, selectedSlot?.maxHours || 20);

  // Step 2: Add-Ons State
  const [paddleRental, setPaddleRental] = useState(0);
  const [ballRental, setBallRental] = useState(0);

  // Step 3: Customer & Payment State
  const [customerName, setCustomerName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [emailAddress, setEmailAddress] = useState('');

  const [bookingSource, setBookingSource] = useState('');
  const [isBookingSourceOpen, setIsBookingSourceOpen] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState('');
  const [isPaymentMethodOpen, setIsPaymentMethodOpen] = useState(false);

  const [notes, setNotes] = useState('');

  // Saving / errors
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Refs for click-outside
  const datePickerRef = useRef(null);
  const startTimeRef = useRef(null);
  const bookingSourceRef = useRef(null);
  const paymentMethodRef = useRef(null);

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target)) {
        setIsDatePickerOpen(false);
      }
      if (startTimeRef.current && !startTimeRef.current.contains(event.target)) {
        setIsStartTimeOpen(false);
      }
      if (bookingSourceRef.current && !bookingSourceRef.current.contains(event.target)) {
        setIsBookingSourceOpen(false);
      }
      if (paymentMethodRef.current && !paymentMethodRef.current.contains(event.target)) {
        setIsPaymentMethodOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load real availability whenever the date or duration changes
  useEffect(() => {
    if (!selectedDate || duration < 1) {
      setAvailableTimes([]);
      return;
    }
    let cancelled = false;
    setLoadingTimes(true);
    getAvailableStartTimes(
      { year: selectedDate.year, month: selectedDate.month, day: selectedDate.dayNumber },
      duration,
      { allowStarted: true } // staff can book the hour that's currently running (walk-ins)
    )
      .then((times) => {
        if (cancelled) return;
        setAvailableTimes(times);
        // clear the chosen time if it's no longer available
        setStartTime((current) =>
          current && !times.some((t) => t.label === current && t.available) ? '' : current
        );
      })
      .catch((err) => !cancelled && setFormError(err.message))
      .finally(() => !cancelled && setLoadingTimes(false));
    return () => {
      cancelled = true;
    };
  }, [selectedDate, duration]);

  // Calendar days calculation
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
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ dayNumber: i, month: viewMonth + 1, year: viewYear, isCurrentMonth: false });
    }
    return days;
  }, [viewYear, viewMonth]);

  // Past days and days beyond the 30-day booking window can't be picked
  const isPastDay = (d) => isOutsideBookingWindow(d);

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
    // normalize filler days from the previous/next month
    const d = new Date(dayObj.year, dayObj.month, dayObj.dayNumber);
    const normalized = { year: d.getFullYear(), month: d.getMonth(), dayNumber: d.getDate(), isCurrentMonth: true };
    setSelectedDate(normalized);
    setDateDisplay(`${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`);
    setIsDatePickerOpen(false);
    setFormError('');
  };

  const handleClearDate = (e) => {
    e.stopPropagation();
    setSelectedDate(null);
    setDateDisplay('');
    setStartTime('');
    setIsDatePickerOpen(false);
  };

  const handleTodayDate = (e) => {
    e.stopPropagation();
    const now = new Date();
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    handleSelectDay({ dayNumber: now.getDate(), month: now.getMonth(), year: now.getFullYear() });
  };

  // Cost calculations (same rules as the customer portal)
  const price = calculatePrice({
    startHour: startTime ? parseHour(startTime) : 6,
    duration: duration || 0,
    players,
    paddles: paddleRental,
    balls: ballRental,
  });
  const courtRate = price.courtFee;
  const additionalPlayers = price.extraPlayers;
  const additionalPlayersCost = price.extraPlayerFee;
  const paddleRentalCost = price.paddleFee;
  const ballRentalCost = price.ballFee;
  const totalAmount = price.total;

  const handleNext = () => {
    setFormError('');
    if (currentStep === 1 && (!selectedDate || !startTime)) {
      setFormError('Please select a date and an available start time.');
      return;
    }
    if (currentStep === 1 && duration < minDuration) {
      setFormError(`Daytime bookings (6:00 AM – 4:00 PM) need at least ${minDuration} hours.`);
      return;
    }
    if (currentStep < 3) setCurrentStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setFormError('');
    if (currentStep > 1) setCurrentStep((prev) => prev - 1);
  };

  const handleConfirm = async () => {
    setFormError('');
    setSaving(true);
    try {
      const booking = await createStaffBooking({
        date: selectedDate
          ? { year: selectedDate.year, month: selectedDate.month, day: selectedDate.dayNumber }
          : null,
        startTime,
        duration,
        players,
        paddles: paddleRental,
        balls: ballRental,
        customerName,
        contactNumber,
        email: emailAddress,
        bookingSource,
        paymentMethod,
        notes,
      });
      onBookingAdded?.(booking);
      onClose?.();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/40 backdrop-blur-[2px] select-none"
    >
      <div className={`w-full ${currentStep === 3 ? 'max-w-[760px] sm:max-w-[780px]' : 'max-w-[500px] sm:max-w-[520px]'} bg-[#ffffff] border border-[#dedbc4] rounded-2xl shadow-2xl p-3.5 sm:p-4 flex flex-col overflow-visible transition-all duration-200 relative`}>

        {/* Header */}
        <div className="flex items-center justify-between pb-2">
          <h2 className="text-base font-bold text-[#121212] tracking-tight">
            Add Court Rental
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-[#6b7280] hover:text-[#121212] transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4 stroke-[2.2]" />
          </button>
        </div>

        <div className="w-full h-px bg-[#dedbc4] mb-2.5" />

        {/* Stepper */}
        <div className="w-full mb-2.5 px-2 sm:px-3">
          <div className="flex items-center w-full">
            {[1, 2, 3].map((step, i) => (
              <React.Fragment key={step}>
                <div
                  className={`w-5.5 h-5.5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 transition-colors shadow-xs ${
                    currentStep === step
                      ? 'bg-[#121212] text-[#ccff00]'
                      : currentStep > step
                      ? 'bg-[#ccff00] text-[#121212]'
                      : 'bg-[#d1d5db] text-[#4a4a42]'
                  }`}
                >
                  {currentStep > step ? <Check className="w-3 h-3 stroke-[2.5]" /> : step}
                </div>
                {i < 2 && (
                  <div className="flex-1 flex items-center px-2">
                    <div className={`w-full h-[2px] transition-colors ${currentStep > step ? 'bg-[#ccff00]' : 'bg-[#dedbc4]'}`} />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>

          <div className="relative h-3.5 mt-1.5 text-[10px] font-bold tracking-tight">
            <span className="absolute left-0 text-[#121212]">SESSION DETAILS</span>
            <span className={`absolute left-1/2 -translate-x-1/2 transition-colors ${currentStep >= 2 ? 'text-[#121212]' : 'text-[#4a4a42]'}`}>
              ADD-ONS
            </span>
            <span className={`absolute right-0 transition-colors ${currentStep === 3 ? 'text-[#121212]' : 'text-[#4a4a42]'}`}>
              CUSTOMER & PAYMENT
            </span>
          </div>
        </div>

        {/* STEP 1: SESSION DETAILS */}
        {currentStep === 1 && (
          <div className="space-y-2.5">
            {/* Panel 1: Date & Start Time */}
            <div className="bg-[#fbfaf1] border border-[#dedbc4] rounded-xl p-2.5 sm:p-3">
              <div className="grid grid-cols-2 gap-2.5">
                {/* Date */}
                <div className="relative" ref={datePickerRef}>
                  <label className="block text-[11px] font-semibold text-[#121212] mb-1">Date</label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsDatePickerOpen(!isDatePickerOpen);
                      setIsStartTimeOpen(false);
                    }}
                    className={`w-full h-7.5 sm:h-8 pl-3 pr-2.5 bg-[#ffffff] border border-[#dedbc4] rounded-lg text-xs transition-colors flex items-center justify-between text-left focus:outline-none focus:border-[#121212] cursor-pointer ${
                      dateDisplay ? 'text-[#121212] font-medium' : 'text-[#6b7280]'
                    }`}
                  >
                    <span className="truncate">{dateDisplay || 'dd/mm/yyyy'}</span>
                    <Calendar className="w-3.5 h-3.5 stroke-[1.8] text-[#6b7280] shrink-0 ml-1" />
                  </button>

                  {isDatePickerOpen && (
                    <div className="absolute top-full mt-1 left-0 z-50 w-64 bg-[#ffffff] border border-[#dedbc4] rounded-2xl p-3 shadow-xl select-none animate-in fade-in duration-100">
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#dedbc4]/50">
                        <button type="button" onClick={handlePrevMonth} className="p-1 hover:bg-[#fbfaf1] rounded-lg text-[#121212] transition-colors cursor-pointer" title="Previous month">
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-xs font-bold text-[#121212]">
                          {MONTH_NAMES[viewMonth]} {viewYear}
                        </span>
                        <button type="button" onClick={handleNextMonth} className="p-1 hover:bg-[#fbfaf1] rounded-lg text-[#121212] transition-colors cursor-pointer" title="Next month">
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-[#6b7280] mb-1">
                        <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
                      </div>

                      <div className="grid grid-cols-7 gap-1 text-center text-xs">
                        {calendarDays.map((d, index) => {
                          const normalized = new Date(d.year, d.month, d.dayNumber);
                          const isSelected =
                            selectedDate &&
                            selectedDate.year === normalized.getFullYear() &&
                            selectedDate.month === normalized.getMonth() &&
                            selectedDate.dayNumber === normalized.getDate();
                          const past = isPastDay(d);

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

                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#dedbc4]/50 text-[11px]">
                        <button type="button" onClick={handleClearDate} className="text-[#6b7280] hover:text-[#121212] font-semibold cursor-pointer">
                          Clear
                        </button>
                        <button type="button" onClick={handleTodayDate} className="text-[#121212] hover:underline font-bold cursor-pointer">
                          Today
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Start Time (real availability) */}
                <div className="relative" ref={startTimeRef}>
                  <label className="block text-[11px] font-semibold text-[#121212] mb-1">Start Time</label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsStartTimeOpen(!isStartTimeOpen);
                      setIsDatePickerOpen(false);
                    }}
                    className={`w-full h-7.5 sm:h-8 pl-3 pr-2.5 bg-[#ffffff] border border-[#dedbc4] rounded-lg text-xs transition-colors flex items-center justify-between text-left focus:outline-none focus:border-[#121212] cursor-pointer ${
                      startTime ? 'text-[#121212] font-medium' : 'text-[#6b7280]'
                    }`}
                  >
                    <span className="truncate">{startTime || '--:-- --'}</span>
                    <Clock className="w-3.5 h-3.5 stroke-[1.8] text-[#6b7280] shrink-0 ml-1" />
                  </button>

                  {isStartTimeOpen && (
                    <div className="absolute top-full mt-1 left-0 z-50 w-full max-h-44 overflow-y-auto bg-[#ffffff] border border-[#dedbc4] rounded-xl p-1 shadow-xl select-none animate-in fade-in duration-100">
                      {!selectedDate && (
                        <p className="px-2.5 py-1.5 text-xs text-[#6b7280]">Pick a date first</p>
                      )}
                      {selectedDate && loadingTimes && (
                        <p className="px-2.5 py-1.5 text-xs text-[#6b7280]">Checking availability...</p>
                      )}
                      {selectedDate && !loadingTimes && availableTimes.map(({ label, available, reason }) => {
                        const isSelected = startTime === label;
                        return (
                          <button
                            key={label}
                            type="button"
                            disabled={!available}
                            onClick={() => {
                              setStartTime(label);
                              setDuration((prev) => Math.max(prev, minDurationFor(label)));
                              setIsStartTimeOpen(false);
                              setFormError('');
                            }}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left ${
                              !available
                                ? 'text-neutral-300 cursor-not-allowed'
                                : isSelected
                                ? 'bg-[#fbfaf1] text-[#121212] font-bold cursor-pointer'
                                : 'text-[#121212] hover:bg-neutral-50 cursor-pointer'
                            }`}
                          >
                            <span>{label}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 stroke-[2] text-[#121212]" />}
                            {!available && <span className="text-[10px]">{reason}</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Panel 2: Duration & Players */}
            <div className="bg-[#fbfaf1] border border-[#dedbc4] rounded-xl p-2.5 sm:p-3">
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  {
                    label: 'Duration (hrs)', value: duration, set: setDuration, min: minDuration, max: maxDuration,
                    hint: minDuration > 1 ? `Daytime: min ${minDuration} hrs` : 'Nighttime: min 1 hr',
                  },
                  {
                    label: 'Players', value: players, set: setPlayers, min: 1, max: 30,
                    hint: price.extraPlayers > 0
                      ? `${capacityFor(duration)} included + ${price.extraPlayers} extra (₱ ${RULES.extraPlayerFee} each)`
                      : `Up to ${capacityFor(duration)} players included`,
                  },
                ].map(({ label, value, set, min, max, hint }) => (
                  <div key={label}>
                    <label className="block text-[11px] font-semibold text-[#121212] mb-1">{label}</label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={value <= min}
                        onClick={() => set((prev) => Math.max(min, prev - 1))}
                        className="w-7 h-7 rounded-lg bg-[#ffffff] border border-[#dedbc4] text-[#121212] font-semibold text-xs flex items-center justify-center hover:bg-neutral-50 active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        –
                      </button>
                      <span className="w-5 text-center text-xs font-bold text-[#121212]">{value}</span>
                      <button
                        type="button"
                        disabled={value >= max}
                        onClick={() => set((prev) => Math.min(max, prev + 1))}
                        className="w-7 h-7 rounded-lg bg-[#ffffff] border border-[#dedbc4] text-[#121212] font-semibold text-xs flex items-center justify-center hover:bg-neutral-50 active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        +
                      </button>
                    </div>
                    <div className="mt-1 text-[10.5px] text-[#4a4a42]">{hint}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: ADD-ONS */}
        {currentStep === 2 && (
          <div className="space-y-2.5">
            <div className="bg-[#fbfaf1] border border-[#dedbc4] rounded-xl p-2.5 sm:p-3">
              <h3 className="text-[10px] sm:text-[10.5px] font-bold text-[#121212] mb-2.5 uppercase tracking-wide">
                Equipment Rental
              </h3>

              <div className="grid grid-cols-2 gap-3.5">
                {[
                  { label: 'Paddle Rental', value: paddleRental, set: setPaddleRental, price: '₱ 100/session' },
                  { label: 'Ball Rental', value: ballRental, set: setBallRental, price: '₱ 50/session' },
                ].map(({ label, value, set, price: priceLabel }) => (
                  <div key={label}>
                    <label className="block text-[11px] font-semibold text-[#121212] mb-1">{label}</label>
                    <div className="flex items-center gap-2 mb-1">
                      <button
                        type="button"
                        onClick={() => set((prev) => Math.max(0, prev - 1))}
                        className="w-7 h-7 rounded-lg bg-[#ffffff] border border-[#dedbc4] text-[#121212] font-semibold text-xs flex items-center justify-center hover:bg-neutral-50 active:scale-95 transition-all cursor-pointer"
                      >
                        –
                      </button>
                      <span className="w-5 text-center text-xs font-bold text-[#121212]">{value}</span>
                      <button
                        type="button"
                        onClick={() => set((prev) => prev + 1)}
                        className="w-7 h-7 rounded-lg bg-[#ffffff] border border-[#dedbc4] text-[#121212] font-semibold text-xs flex items-center justify-center hover:bg-neutral-50 active:scale-95 transition-all cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                    <div className="text-[11px] text-[#4a4a42]">{priceLabel}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: CUSTOMER & PAYMENT */}
        {currentStep === 3 && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-stretch">
            <div className="md:col-span-7 space-y-2 flex flex-col justify-between">
              {/* Customer Details */}
              <div className="bg-[#fbfaf1] border border-[#dedbc4] rounded-xl p-2.5 sm:p-3">
                <h3 className="text-[10px] sm:text-[10.5px] font-bold text-[#121212] uppercase tracking-wider mb-2">
                  CUSTOMER DETAILS
                </h3>
                <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
                  {[
                    { label: 'Customer Name', value: customerName, set: setCustomerName, placeholder: 'e.g. Juan Dela Cruz', type: 'text' },
                    { label: 'Contact Number', value: contactNumber, set: setContactNumber, placeholder: 'Enter 11-digit number', type: 'tel' },
                    { label: 'Email Address (optional)', value: emailAddress, set: setEmailAddress, placeholder: 'e.g. name@example.com', type: 'email' },
                  ].map(({ label, value, set, placeholder, type }) => (
                    <div key={label}>
                      <label className="block text-[11px] font-semibold text-[#121212] mb-1">{label}</label>
                      <input
                        type={type}
                        value={value}
                        onChange={(e) => set(e.target.value)}
                        placeholder={placeholder}
                        className={`w-full h-7.5 sm:h-8 px-2.5 bg-[#ffffff] border border-[#dedbc4] rounded-lg text-xs transition-colors focus:outline-none focus:border-[#121212] placeholder-[#6b7280] ${
                          value ? 'text-[#121212]' : 'text-[#6b7280]'
                        }`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Booking & Payment Source */}
              <div className="bg-[#fbfaf1] border border-[#dedbc4] rounded-xl p-2.5 sm:p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
                  {[
                    {
                      label: 'Booking Source', ref: bookingSourceRef, value: bookingSource, set: setBookingSource,
                      open: isBookingSourceOpen, setOpen: setIsBookingSourceOpen, closeOther: () => setIsPaymentMethodOpen(false),
                      options: BOOKING_SOURCES, placeholder: 'Select Booking Source',
                    },
                    {
                      label: 'Payment Method', ref: paymentMethodRef, value: paymentMethod, set: setPaymentMethod,
                      open: isPaymentMethodOpen, setOpen: setIsPaymentMethodOpen, closeOther: () => setIsBookingSourceOpen(false),
                      options: PAYMENT_METHODS, placeholder: 'Select Payment Method',
                    },
                  ].map((dd) => (
                    <div key={dd.label} className="relative" ref={dd.ref}>
                      <label className="block text-[11px] font-semibold text-[#121212] mb-1">{dd.label}</label>
                      <button
                        type="button"
                        onClick={() => {
                          dd.setOpen(!dd.open);
                          dd.closeOther();
                        }}
                        className={`w-full h-7.5 sm:h-8 pl-2.5 pr-2 bg-[#ffffff] border border-[#dedbc4] rounded-lg text-xs transition-colors flex items-center justify-between text-left focus:outline-none focus:border-[#121212] cursor-pointer ${
                          dd.value ? 'text-[#121212] font-medium' : 'text-[#6b7280]'
                        }`}
                      >
                        <span className="truncate">{dd.value || dd.placeholder}</span>
                        <ChevronDown className="w-3.5 h-3.5 stroke-[1.8] text-[#6b7280] shrink-0 ml-1" />
                      </button>

                      {dd.open && (
                        <div className="absolute top-full mt-1 left-0 z-50 w-full max-h-36 overflow-y-auto bg-[#ffffff] border border-[#dedbc4] rounded-xl p-1 shadow-xl select-none animate-in fade-in duration-100">
                          {dd.options.map((opt) => {
                            const isSelected = dd.value === opt;
                            return (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => {
                                  dd.set(opt);
                                  dd.setOpen(false);
                                }}
                                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer text-left ${
                                  isSelected ? 'bg-[#fbfaf1] text-[#121212] font-bold' : 'text-[#121212] hover:bg-neutral-50'
                                }`}
                              >
                                <span>{opt}</span>
                                {isSelected && <Check className="w-3.5 h-3.5 stroke-[2] text-[#121212]" />}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-[11px] font-semibold text-[#121212] mb-1">Notes</label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add any relevant details here..."
                    className={`w-full h-13 sm:h-14 py-1.5 px-2.5 bg-[#ffffff] border border-[#dedbc4] rounded-lg text-xs transition-colors focus:outline-none focus:border-[#121212] placeholder-[#6b7280] resize-none leading-relaxed ${
                      notes ? 'text-[#121212]' : 'text-[#6b7280]'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Booking Summary */}
            <div className="md:col-span-5 h-full flex flex-col justify-between">
              <div className="border border-dashed border-[#dedbc4] rounded-xl p-3 sm:p-3.5 flex flex-col justify-between h-full bg-[#fbfaf1]/40">
                <div className="space-y-2 text-xs sm:text-[11.5px]">
                  <div className="flex items-center justify-between text-[#4a4a42]">
                    <span>{courtRateLabel(price)}</span>
                    <span className="font-semibold text-[#121212] tabular-nums">₱ {courtRate}</span>
                  </div>
                  <div className="flex items-center justify-between text-[#4a4a42]">
                    <span>Additional Players ({additionalPlayers} x ₱ 100)</span>
                    <span className="font-semibold text-[#121212] tabular-nums">₱ {additionalPlayersCost}</span>
                  </div>
                  <div className="flex items-center justify-between text-[#4a4a42]">
                    <span>Paddle Rental ({paddleRental} x ₱ 100)</span>
                    <span className="font-semibold text-[#121212] tabular-nums">₱ {paddleRentalCost}</span>
                  </div>
                  <div className="flex items-center justify-between text-[#4a4a42]">
                    <span>Ball Rental ({ballRental} x ₱ 50)</span>
                    <span className="font-semibold text-[#121212] tabular-nums">₱ {ballRentalCost}</span>
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-[#dedbc4]/80 flex items-center justify-between text-xs sm:text-[12.5px]">
                  <span className="font-bold text-[#121212]">TOTAL</span>
                  <span className="font-extrabold text-[#121212] tabular-nums">₱ {totalAmount}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error message */}
        {formError && (
          <p className="mt-2.5 text-[11px] font-semibold text-red-600">{formError}</p>
        )}

        <div className="w-full h-px bg-[#dedbc4] mt-2.5 mb-2.5" />

        {/* Action Buttons */}
        <div className="w-full flex items-center justify-between">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={handleBack}
              disabled={saving}
              className="px-6 sm:px-7 py-1.5 sm:py-2 rounded-full font-bold text-xs sm:text-sm bg-[#d1d5db] text-[#121212] hover:bg-[#c4c8ce] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
            >
              Back
            </button>
          ) : (
            <div />
          )}

          {currentStep < 3 ? (
            <button
              type="button"
              onClick={handleNext}
              className="px-6 sm:px-7 py-1.5 sm:py-2 rounded-full font-bold text-xs sm:text-sm bg-[#ccff00] text-[#121212] hover:bg-[#b8e600] active:scale-[0.98] transition-all cursor-pointer shadow-xs"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConfirm}
              disabled={saving}
              className="px-6 sm:px-7 py-1.5 sm:py-2 rounded-full font-bold text-xs sm:text-sm bg-[#ccff00] text-[#121212] hover:bg-[#b8e600] active:scale-[0.98] transition-all cursor-pointer shadow-xs disabled:opacity-60 disabled:cursor-wait"
            >
              {saving ? 'Saving...' : 'Confirm'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}