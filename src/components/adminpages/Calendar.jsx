import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Info, Check, Plus } from 'lucide-react';
import BookingsViewModal from './BookingsViewModal';
import BookingsRescheduleModal from './BookingsRescheduleModal';
import BookingsCancelModal from './BookingsCancelModal';
import AddBookingModal from './AddBookingModal';
import { useAuth } from '../../context/AuthContext';
import {
  fetchAdminBookings,
  cancelBooking,
  rescheduleBooking,
  isOutsideBookingWindow,
  hourLabel,
} from '../../../lib/bookingService';

const SHORT_MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Rows 6:00 AM ... 1:00 AM can be booked; the 2:00 AM row only marks closing time.
// 24 = 12:00 AM, 25 = 1:00 AM, 26 = 2:00 AM belong to the same business day as the evening before
const CLOSING_HOUR = 26;
const OPERATING_HOURS = Array.from({ length: 21 }, (_, i) => ({
  hour: 6 + i,
  label: hourLabel(6 + i),
  closed: 6 + i === CLOSING_HOUR,
}));

const ROW_HEIGHT = 60; // px per hour row

// Roles that can add / reschedule / cancel (Court Attendants only view)
const MANAGER_ROLES = ['Owner', 'Admin', 'Manager', 'Staff', 'Cashier'];

// Same colours as the status badges on the Bookings page
// (cancelled bookings aren't shown: they don't use the court)
const STATUS_COLORS = {
  Reserved: { bg: '#ffed76', text: '#a5950c' },
  'On-going': { bg: '#bfdbfe', text: '#1d4ed8' },
  Completed: { bg: '#baff95', text: '#4ea711' },
  'No Show': { bg: '#e5e7eb', text: '#4b5563' },
};
const LEGEND = ['Reserved', 'On-going', 'Completed'];

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

// Business day + hour of a booking in Manila time (1:00 AM belongs to the previous day)
function businessSlot(date) {
  const m = new Date(date.getTime() + MANILA_OFFSET_MS);
  let y = m.getUTCFullYear();
  let mo = m.getUTCMonth();
  let d = m.getUTCDate();
  let h = m.getUTCHours() + m.getUTCMinutes() / 60;
  if (h < 6) {
    const prev = new Date(Date.UTC(y, mo, d - 1));
    y = prev.getUTCFullYear();
    mo = prev.getUTCMonth();
    d = prev.getUTCDate();
    h += 24;
  }
  return { y, mo, d, hour: h };
}

const sameDay = (dateObj, y, mo, d) =>
  dateObj.getFullYear() === y && dateObj.getMonth() === mo && dateObj.getDate() === d;

// Manila "now" as a business slot (for greying out past hours)
function nowSlot() {
  return businessSlot(new Date());
}

export default function CalendarPage({ refreshKey }) {
  const { role } = useAuth();
  const canManage = MANAGER_ROLES.includes(role);

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Week shown (any day inside it)
  const [currentWeekAnchor, setCurrentWeekAnchor] = useState(() => new Date());

  // Modals
  const [viewingBooking, setViewingBooking] = useState(null);
  const [rescheduleTarget, setRescheduleTarget] = useState(null); // { booking, fromView }
  const [cancelTarget, setCancelTarget] = useState(null); // { booking, fromView }
  const [addBookingInitialData, setAddBookingInitialData] = useState(null); // null = closed
  const [notification, setNotification] = useState(null);

  const showNotification = (text) => {
    setNotification(text);
    setTimeout(() => setNotification(null), 3500);
  };

  // ---- Load real bookings ---------------------------------------------------
  const loadBookings = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setLoadError('');
    try {
      setBookings(await fetchAdminBookings());
    } catch (err) {
      setLoadError(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Reload when the page opens, when "Add Booking" in the header saves (refreshKey),
  // and every minute so Reserved -> On-going -> Completed stays current
  useEffect(() => {
    loadBookings();
    const timer = setInterval(() => loadBookings({ silent: true }), 60000);
    return () => clearInterval(timer);
  }, [loadBookings]);

  useEffect(() => {
    if (refreshKey) loadBookings({ silent: true });
  }, [refreshKey, loadBookings]);

  // ---- Week ------------------------------------------------------------------
  const weekDays = useMemo(() => {
    const anchor = new Date(currentWeekAnchor);
    const day = anchor.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(anchor);
    monday.setDate(anchor.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  }, [currentWeekAnchor]);

  const weekRangeLabel = useMemo(() => {
    const first = weekDays[0];
    const last = weekDays[6];
    return `${SHORT_MONTH_NAMES[first.getMonth()]} ${first.getDate()} - ${SHORT_MONTH_NAMES[last.getMonth()]} ${last.getDate()}, ${last.getFullYear()}`;
  }, [weekDays]);

  const shiftWeek = (days) =>
    setCurrentWeekAnchor((prev) => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + days);
      return next;
    });

  const today = nowSlot();

  // ---- Place bookings on the grid (cancelled ones don't take up the court) -----
  const bookingsByDay = useMemo(() => {
    const map = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    bookings.forEach((b) => {
      if (!b.start || !b.end || b.status === 'Cancelled') return;
      const slot = businessSlot(b.start);
      const dayIdx = weekDays.findIndex((wd) => sameDay(wd, slot.y, slot.mo, slot.d));
      if (dayIdx === -1) return;
      const duration = (b.end - b.start) / (60 * 60 * 1000);
      map[dayIdx].push({ ...b, startHour: slot.hour, endHour: slot.hour + duration, calDuration: duration });
    });
    return map;
  }, [bookings, weekDays]);

  // Can a new booking start in this cell? (not past, within 30 days)
  const isBookableCell = (dayDate, hour) => {
    if (hour >= CLOSING_HOUR) return false;
    if (isOutsideBookingWindow({ year: dayDate.getFullYear(), month: dayDate.getMonth(), day: dayDate.getDate() })) {
      return false;
    }
    if (sameDay(dayDate, today.y, today.mo, today.d)) {
      return hour + 1 > today.hour; // the hour currently running is still OK for walk-ins
    }
    return true;
  };

  // ---- Handlers ---------------------------------------------------------------
  const handleEmptySlotClick = (dayDate, timeLabel) => {
    setAddBookingInitialData({
      date: { year: dayDate.getFullYear(), month: dayDate.getMonth(), day: dayDate.getDate() },
      startTime: timeLabel,
    });
  };

  // Errors are thrown back so the modals show them and stay open
  const handleConfirmReschedule = async ({ booking, date, startTime, reason, notes }) => {
    await rescheduleBooking(booking, { date, startTime, reason, notes });
    await loadBookings({ silent: true });
    showNotification(`Booking ${booking.ref} rescheduled.`);
  };

  const handleConfirmCancel = async ({ booking, reason, notes }) => {
    await cancelBooking(booking, { reason, notes });
    await loadBookings({ silent: true });
    showNotification(`Booking ${booking.ref} cancelled.`);
  };

  // ---- Render -----------------------------------------------------------------
  return (
    <div style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }} className="w-full flex flex-col space-y-3.5 select-none">
      {/* TOP NAVIGATION BAR */}
      <div className="w-full bg-[#ffffff] border border-[#121212] rounded-2xl px-4 py-3 sm:px-5 flex items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => shiftWeek(-7)}
            className="p-1 hover:bg-neutral-100 rounded-lg text-[#121212] transition-colors cursor-pointer"
            title="Previous week"
          >
            <ChevronLeft className="w-5 h-5 stroke-[2.2]" />
          </button>
          <span className="text-base sm:text-[17px] font-bold text-[#121212] tracking-tight">{weekRangeLabel}</span>
          <button
            type="button"
            onClick={() => shiftWeek(7)}
            className="p-1 hover:bg-neutral-100 rounded-lg text-[#121212] transition-colors cursor-pointer"
            title="Next week"
          >
            <ChevronRight className="w-5 h-5 stroke-[2.2]" />
          </button>
        </div>

        <div className="flex items-center gap-3 sm:gap-4 flex-wrap justify-end">
          {loading && <span className="text-xs text-[#717171]">Loading...</span>}

          {/* Legend */}
          <div className="hidden sm:flex items-center gap-3 text-xs text-[#525252]">
            {LEGEND.map((label) => (
              <span key={label} className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <span
                  className="w-2.5 h-2.5 rounded-full border"
                  style={{ backgroundColor: STATUS_COLORS[label].bg, borderColor: STATUS_COLORS[label].text }}
                />
                {label}
              </span>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setCurrentWeekAnchor(new Date())}
            className="px-4 py-1.5 rounded-full font-bold text-xs sm:text-sm bg-[#ffffff] border border-[#121212] text-[#121212] hover:bg-[#fbfaf1] transition-all cursor-pointer"
          >
            Today
          </button>
        </div>
      </div>

      {loadError && (
        <div className="w-full px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-semibold flex items-center justify-between">
          <span>{loadError}</span>
          <button type="button" onClick={() => loadBookings()} className="underline cursor-pointer">
            Try again
          </button>
        </div>
      )}

      {/* CALENDAR GRID */}
      <div className="w-full bg-[#ffffff] border border-[#121212] rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <div className="min-w-[960px]">
            {/* Header row */}
            <div className="grid grid-cols-[88px_repeat(7,1fr)] border-b border-[#121212] bg-[#ffffff] sticky top-0 z-20">
              <div className="border-r border-[#121212] py-3 text-center text-[11px] font-bold uppercase tracking-wider text-[#717171] bg-neutral-50/50 flex items-center justify-center">
                Time
              </div>
              {weekDays.map((d, idx) => {
                const isToday = sameDay(d, today.y, today.mo, today.d);
                return (
                  <div
                    key={idx}
                    className={`py-3 text-center border-r border-[#121212] last:border-r-0 ${isToday ? 'bg-[#f3ffc2]' : ''}`}
                  >
                    <span className="text-xs sm:text-sm font-bold text-[#121212] tracking-tight">
                      {d.getDate()} - {DAY_LABELS[idx]}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Hour rows */}
            <div className="divide-y divide-[#dedbc4]">
              {OPERATING_HOURS.map((slot) => (
                <div key={slot.hour} style={{ height: `${ROW_HEIGHT}px` }} className="grid grid-cols-[88px_repeat(7,1fr)]">
                  <div className="border-r border-[#121212] px-2.5 flex items-center justify-end text-xs font-semibold text-[#525252] bg-neutral-50/40 select-none">
                    {slot.label}
                  </div>

                  {weekDays.map((d, dayIdx) => {
                    const dayBookings = bookingsByDay[dayIdx] || [];
                    const startingBooking = dayBookings.find((b) => Math.floor(b.startHour) === slot.hour);
                    const isCovered = dayBookings.some((b) => b.startHour < slot.hour + 1 && b.endHour > slot.hour);
                    const bookable = canManage && !isCovered && isBookableCell(d, slot.hour);

                    return (
                      <div key={dayIdx} className="border-r border-[#121212] last:border-r-0 relative group">
                        {/* Booking card (spans its duration) */}
                        {startingBooking && (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewingBooking(startingBooking);
                            }}
                            style={{
                              height: `${startingBooking.calDuration * ROW_HEIGHT - 6}px`,
                              top: `${(startingBooking.startHour - slot.hour) * ROW_HEIGHT + 3}px`,
                              left: '3px',
                              right: '3px',
                              backgroundColor: (STATUS_COLORS[startingBooking.status] || STATUS_COLORS.Reserved).bg,
                              color: (STATUS_COLORS[startingBooking.status] || STATUS_COLORS.Reserved).text,
                            }}
                            className="absolute rounded-xl border border-[#121212] px-2.5 py-1.5 flex flex-col justify-start gap-1 transition-all cursor-pointer hover:scale-[1.01] hover:shadow-md z-10 select-none overflow-hidden"
                            title={`${startingBooking.ref} • ${startingBooking.customer} (${startingBooking.time}) • ${startingBooking.pax} pax • ${startingBooking.status}`}
                          >
                            <div className="flex items-center justify-between gap-1 leading-tight min-w-0">
                              <span className="font-bold text-xs sm:text-[13px] truncate">{startingBooking.customer}</span>
                              <span className="text-[10px] font-bold bg-[#121212]/10 px-1.5 py-0.5 rounded leading-none shrink-0">
                                {startingBooking.pax} pax
                              </span>
                            </div>
                            <div className="text-[11px] sm:text-xs font-semibold tracking-tight leading-none whitespace-nowrap">
                              {startingBooking.time}
                            </div>
                            {startingBooking.calDuration >= 2 && (
                              <div className="text-[10px] font-semibold opacity-80 leading-none">
                                {startingBooking.ref} · {startingBooking.status}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Empty slot: hover & click to add a booking */}
                        {bookable && (
                          <div
                            onClick={() => handleEmptySlotClick(d, slot.label)}
                            className="w-full h-full flex items-center justify-center cursor-pointer hover:bg-[#fcfbf7] transition-colors"
                          >
                            <span className="hidden group-hover:inline-flex items-center gap-1 text-[10px] font-bold text-[#121212] bg-[#f5f3e5] hover:bg-[#ebf8b8] px-2.5 py-0.5 rounded-full border border-[#dedbc4] shadow-xs active:scale-95 transition-all">
                              <Plus className="w-3 h-3 stroke-[2.2]" /> Book
                            </span>
                          </div>
                        )}

                        {/* 2:00 AM: closing time */}
                        {slot.closed && (
                          <div className="w-full h-full bg-neutral-100 flex items-center justify-center text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                            Closed
                          </div>
                        )}

                        {/* Past / not yet open (and not booked): light grey */}
                        {!slot.closed && !isCovered && !isBookableCell(d, slot.hour) && (
                          <div className="w-full h-full bg-neutral-50" />
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Note */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#525252] px-1 pt-0.5">
        <div className="flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-[#121212] shrink-0" />
          <span>
            Operating Hours: <strong>6:00 AM – 2:00 AM</strong>.{' '}
            {canManage
              ? 'Click a booking to view, reschedule or cancel. Click an empty slot to add a booking.'
              : 'Click a booking to view its details.'}
          </span>
        </div>
      </div>

      {/* Toast */}
      {notification && (
        <div className="fixed top-28 right-6 z-60 bg-[#121212] text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-[#333] animate-in slide-in-from-top-4 duration-200">
          <Check className="w-5 h-5 text-[#ccff00] shrink-0" />
          <span className="text-xs sm:text-sm font-semibold">{notification}</span>
        </div>
      )}

      {/* Add Booking (opened from an empty slot, pre-filled with that date + time) */}
      {addBookingInitialData && (
        <AddBookingModal
          isOpen
          initialData={addBookingInitialData}
          onClose={() => setAddBookingInitialData(null)}
          onBookingAdded={async (created) => {
            setAddBookingInitialData(null);
            await loadBookings({ silent: true });
            showNotification(`Booking ${created?.reference_number || ''} added.`);
          }}
        />
      )}

      {/* Same modals as the Bookings page */}
      <BookingsViewModal
        isOpen={Boolean(viewingBooking)}
        booking={viewingBooking}
        readOnly={!canManage}
        onClose={() => setViewingBooking(null)}
        onReschedule={(b) => {
          setViewingBooking(null);
          setRescheduleTarget({ booking: b, fromView: true });
        }}
        onCancel={(b) => {
          setViewingBooking(null);
          setCancelTarget({ booking: b, fromView: true });
        }}
      />

      <BookingsRescheduleModal
        isOpen={Boolean(rescheduleTarget)}
        booking={rescheduleTarget?.booking || null}
        fromView={Boolean(rescheduleTarget?.fromView)}
        onClose={() => setRescheduleTarget(null)}
        onBack={() => {
          setViewingBooking(rescheduleTarget.booking);
          setRescheduleTarget(null);
        }}
        onConfirmReschedule={handleConfirmReschedule}
      />

      <BookingsCancelModal
        isOpen={Boolean(cancelTarget)}
        booking={cancelTarget?.booking || null}
        fromView={Boolean(cancelTarget?.fromView)}
        onClose={() => setCancelTarget(null)}
        onBack={() => {
          setViewingBooking(cancelTarget.booking);
          setCancelTarget(null);
        }}
        onConfirmCancel={handleConfirmCancel}
      />
    </div>
  );
}