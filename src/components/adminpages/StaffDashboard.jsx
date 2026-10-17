import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Megaphone, Pin } from 'lucide-react';
import ViewAnnouncementModal from './ViewAnnouncementsModal';
import { fetchDashboardData } from '../../../lib/bookingService';
import { useAuth } from '../../context/AuthContext';
import DashboardBookingModals, { STATUS_COLORS, StatusLegend } from './DashboardBookingModals';
import { fetchAnnouncements } from '../../../lib/announcementService';




// =============================================================================
// STAFF DASHBOARD
// - No revenue (owner only). Court Rental is the only booking type.
// - Announcements are read-only for staff (owner posts / edits / deletes).
// - Booking, payment and check-in are all automatic, so staff have nothing to confirm.
// - Add Booking lives in the main header, so it is not repeated here.
// - Layout: same as the original dashboard. The revenue card is replaced by a
//   date and time card, next to the (read-only) Announcements.
// - Timeline blocks open View Details; week cards open the Calendar.
//
// Prop (optional, wire it to your router / tab state):
//   onNavigateTab(tabKey, params)  switches tab; params is an optional filter, e.g.
//                                  { bookingId: 'CR-1008' } or { date: '2026-10-16' }
// =============================================================================




// Operating hours: 6:00 AM to 2:00 AM (20 hours). Hours past midnight run 24-26.
const OPEN_HOUR = 6;
const CLOSE_HOUR = 26;
const TOTAL_HOURS = CLOSE_HOUR - OPEN_HOUR;




// Labels sit ON the hour line (left edge = start of that hour)
const TIMELINE_TICKS = [
  { hour: 6, label: '6AM' },
  { hour: 8, label: '8AM' },
  { hour: 10, label: '10AM' },
  { hour: 12, label: '12PM' },
  { hour: 14, label: '2PM' },
  { hour: 16, label: '4PM' },
  { hour: 18, label: '6PM' },
  { hour: 20, label: '8PM' },
  { hour: 22, label: '10PM' },
  { hour: 24, label: '12AM' },
  { hour: 26, label: '2AM' },
];








// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------




// 12:30 AM = 0.5 on the clock, but 24.5 on our timeline
const toOperatingHour = (date) => {
  const raw = date.getHours() + date.getMinutes() / 60;
  return raw < OPEN_HOUR ? raw + 24 : raw;
};




const formatHourLabel = (hourVal) => {
  const whole = Math.floor(hourVal);
  const mins = Math.round((hourVal - whole) * 60);
  const displayMins = mins < 10 ? `0${mins}` : mins;
  const h24 = whole % 24;
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${displayMins} ${period}`;
};




const pct = (hour) => ((hour - OPEN_HOUR) / TOTAL_HOURS) * 100;




export default function StaffDashboard({ onNavigateTab, refreshKey } = {}) {
  // Court Attendants only view bookings; other staff can reschedule / cancel
  const { role } = useAuth();
  const canManage = role !== 'Court Attendant';
  const [viewingBooking, setViewingBooking] = useState(null); // clicked timeline booking




  // Live clock (refreshes every 30s)
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 30000);
    return () => clearInterval(t);
  }, []);




  // Real bookings for the timeline + week ahead (no revenue for staff)
  const [dash, setDash] = useState({ today: [], week: [] });
  const [dashLoading, setDashLoading] = useState(true);
  const loadDashboard = useCallback(async () => {
    try {
      const data = await fetchDashboardData();
      setDash({ today: data.today, week: data.week });
    } catch {
      // keep the last data on screen
    } finally {
      setDashLoading(false);
    }
  }, []);
  useEffect(() => {
    loadDashboard();
    const timer = setInterval(loadDashboard, 60000);
    return () => clearInterval(timer);
  }, [loadDashboard, refreshKey]);

  // Announcements posted by the owner (read-only here)
  const [announcements, setAnnouncements] = useState([]);
  useEffect(() => {
    const load = () =>
      fetchAnnouncements()
        .then(setAnnouncements)
        .catch(() => {});
    load();
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, []);
  const [viewingAnnouncement, setViewingAnnouncement] = useState(null);
  const sortedAnnouncements = useMemo(
    () => [...announcements.filter((a) => a.pinned), ...announcements.filter((a) => !a.pinned)],
    [announcements]
  );




  const isClosed = toOperatingHour(clock) >= CLOSE_HOUR;




  // Date and time card text
  const rawHour = clock.getHours();
  const greeting = rawHour < 12 ? 'Good morning' : rawHour < 18 ? 'Good afternoon' : 'Good evening';
  const weekday = clock.toLocaleDateString('en-US', { weekday: 'long' });
  const fullDate = clock.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const timeText = clock.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });




  // Week strip: Monday to Sunday of the current week (real counts)
  const weekDays = dash.week;

  return (
    <div
      style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}
      className="w-full flex flex-col space-y-3 text-[#121212]"
    >
      {/* Page Header */}
      <div>
        <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[#121212] leading-tight">
          Dashboard Overview
        </h1>
        <p className="text-[11px] sm:text-xs text-[#121212] font-normal mt-0.5 leading-relaxed">
          Real-time facility performance and operations
        </p>
      </div>




      {/* ROW 1: DATE & TIME + ANNOUNCEMENTS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-3.5 items-stretch">
        {/* DATE & TIME */}
        <section className="lg:col-span-6 relative overflow-hidden rounded-2xl bg-[#121212] text-[#ffffff] border border-[#121212] p-4 sm:p-5 shadow-xs flex flex-col justify-between min-h-[200px]">
          {/* Pickleball court lines */}
          <svg
            viewBox="0 0 200 100"
            aria-hidden="true"
            className="absolute -right-6 -bottom-6 w-[82%] max-w-[480px] text-[#ccff00] opacity-[0.22] pointer-events-none"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          >
            <rect x="10" y="10" width="180" height="80" />
            <line x1="100" y1="4" x2="100" y2="96" strokeWidth="2.4" />
            <line x1="71.4" y1="10" x2="71.4" y2="90" />
            <line x1="128.6" y1="10" x2="128.6" y2="90" />
            <line x1="10" y1="50" x2="71.4" y2="50" />
            <line x1="128.6" y1="50" x2="190" y2="50" />
          </svg>




          <div className="relative">
            <span
              className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold ${
                isClosed ? 'bg-[#ffffff]/15 text-[#ffffff]' : 'bg-[#ccff00] text-[#121212]'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isClosed ? 'bg-[#ffffff]/60' : 'bg-[#121212] motion-safe:animate-pulse'
                }`}
              />
              {isClosed ? 'Closed · opens 6:00 AM' : 'Open · until 2:00 AM'}
            </span>
          </div>




          <div className="relative mt-6">
            <p className="text-sm text-[#ffffff]/70 font-medium">{greeting}</p>
            <h2 className="text-4xl sm:text-5xl font-black tracking-tight leading-none mt-1">
              {weekday}
            </h2>
            <div className="mt-3 flex items-baseline gap-3 flex-wrap">
              <span className="text-2xl sm:text-3xl font-black text-[#ccff00] tabular-nums">
                {timeText}
              </span>
              <span className="text-xs sm:text-sm text-[#ffffff]/70">{fullDate}</span>
            </div>
          </div>
        </section>




        {/* ANNOUNCEMENTS (read-only; staff can view only) */}
        <section className="lg:col-span-6 bg-[#ffffff] border border-[#121212] rounded-2xl shadow-xs overflow-hidden flex flex-col">
          <div className="bg-[#121212] px-4 py-2.5 sm:px-5 sm:py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Megaphone className="w-4 h-4 sm:w-5 sm:h-5 text-[#ccff00] fill-[#ccff00]/20 stroke-[2.2]" />
              <h2 className="text-sm sm:text-base font-bold text-[#ccff00] tracking-tight">
                Announcements
              </h2>
              <span className="px-2.5 py-0.5 rounded-full border border-[#ccff00] text-[#ccff00] text-[10px] font-semibold select-none">
                {announcements.length} Active
              </span>
            </div>
          </div>




          <div className="p-3.5 sm:p-4 space-y-3 bg-[#ffffff] overflow-y-auto max-h-[220px]">
            {sortedAnnouncements.length === 0 && (
              <div className="text-[11px] text-[#6b7280] text-center py-6">
                No announcements right now.
              </div>
            )}
            {sortedAnnouncements.map((ann) => (
              // Read-only for staff: click the card to open the announcement
              <button
                type="button"
                key={ann.id}
                onClick={() => setViewingAnnouncement(ann)}
                title="View announcement"
                className="w-full text-left bg-[#ffffff] border border-[#121212] rounded-xl p-3 space-y-1 relative cursor-pointer hover:bg-[#fbfaf1] transition-colors"
              >
                {/* Timestamp */}
                <div className="flex items-center gap-1.5 text-[11px] text-[#6b7280]">
                  {ann.pinned && <Pin className="w-3 h-3 fill-[#121212] text-[#121212]" />}
                  {ann.postedText}
                </div>

                {/* Title */}
                <h3 className="font-bold text-xs sm:text-[13px] text-[#121212] leading-tight">{ann.title}</h3>

                {/* Description (shortened; the full text is in the View modal) */}
                <p className="text-[11px] text-[#6b7280] leading-snug line-clamp-2">{ann.description}</p>
              </button>
            ))}
          </div>
        </section>
      </div>




      {/* ROW 2: TODAY'S COURT TIMELINE */}
      <section className="w-full bg-[#ffffff] border border-[#121212] rounded-xl sm:rounded-2xl p-3.5 sm:p-4 shadow-xs space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-2 border-b border-[#dedbc4]">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-[#121212] tracking-tight">
              Today’s Court Timeline
            </h2>
            <p className="text-[10px] sm:text-[11px] text-[#6b7280]">
              Operating hours: 6:00 AM to 2:00 AM (Single Main Court)
            </p>
          </div>
          {/* Status legend (same colours as Bookings and Calendar) */}
          <StatusLegend />
        </div>




        <div className="w-full overflow-x-auto select-none pt-0.5">
          <div className="min-w-[920px] space-y-1.5">
            {/* Hour labels aligned to their hour line */}
            <div className="grid grid-cols-[100px_1fr] text-[10px] font-bold text-[#6b7280] uppercase tracking-wider px-1">
              <div>COURT</div>
              <div className="relative h-4">
                {TIMELINE_TICKS.map((tick, i) => (
                  <span
                    key={tick.hour}
                    style={{ left: `${pct(tick.hour)}%` }}
                    className={`absolute top-0 whitespace-nowrap ${
                      i === 0 ? '' : i === TIMELINE_TICKS.length - 1 ? '-translate-x-full' : '-translate-x-1/2'
                    }`}
                  >
                    {tick.label}
                  </span>
                ))}
              </div>
            </div>




            <div className="grid grid-cols-[100px_1fr] items-center py-1 px-1">
              <div className="text-xs font-bold text-[#121212]">Main Court</div>




              <div className="relative w-full h-[40px] bg-[#fbfaf1] border border-[#dedbc4] rounded-lg overflow-hidden shadow-inner">
                <div className="absolute inset-0 grid grid-cols-10 pointer-events-none">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="border-r border-[#dedbc4]/60 h-full" />
                  ))}
                </div>




                {!dashLoading && dash.today.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center text-[11px] text-[#6b7280]">
                    No court rentals today.
                  </div>
                )}

                {dash.today.map((b) => (
                  <button
                    type="button"
                    key={b.id}
                    onClick={() => setViewingBooking(b.row)}
                    style={{
                      left: `${pct(b.startHour)}%`,
                      width: `${(b.durationHours / TOTAL_HOURS) * 100}%`,
                      backgroundColor: (STATUS_COLORS[b.status] || STATUS_COLORS.Reserved).bg,
                      color: (STATUS_COLORS[b.status] || STATUS_COLORS.Reserved).text,
                    }}
                    className="absolute top-0.5 bottom-0.5 rounded-md border border-[#121212] px-2 py-0.5 flex flex-col justify-center text-left shadow-xs overflow-hidden cursor-pointer hover:brightness-95 transition-all"
                    title={`${b.customer} (${formatHourLabel(b.startHour)} – ${formatHourLabel(
                      b.startHour + b.durationHours
                    )}) · ${b.pax} pax`}
                  >
                    <div className="text-[10px] font-bold truncate leading-tight">{b.customer}</div>
                    <div className="text-[9px] font-semibold opacity-90 truncate leading-none mt-0.5">
                      {b.pax} pax
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>




      {/* ROW 3: WEEK AHEAD OCCUPANCY */}
      <section className="w-full bg-[#ffffff] border border-[#121212] rounded-xl sm:rounded-2xl p-3.5 sm:p-4 shadow-xs space-y-2.5">
        <h2 className="text-sm sm:text-base font-bold text-[#121212] tracking-tight">
          Week Ahead Occupancy
        </h2>




        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-2.5">
          {weekDays.map((d) => (
            <button
              type="button"
              key={d.day}
              onClick={() => onNavigateTab?.('CALENDAR')}
              title="Open the Calendar"
              className={`text-left cursor-pointer rounded-lg border p-2 sm:p-2.5 flex flex-col justify-between space-y-1.5 transition-all bg-[#fbfaf1] ${
                d.isToday
                  ? 'border-[#121212] ring-1 ring-[#121212] shadow-xs'
                  : 'border-[#dedbc4] hover:border-[#121212]/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black tracking-wide text-[#121212] uppercase">
                  {d.day}
                </span>
                {d.isToday && (
                  <span className="text-[8px] font-bold px-1.5 py-0.2 rounded-full bg-[#ccff00] text-[#121212]">
                    TODAY
                  </span>
                )}
              </div>




              <div className="space-y-1 pt-0.5 text-xs">
                <div className="flex items-baseline justify-between text-[#4a4a42]">
                  <span className="text-[10px] font-medium">Bookings</span>
                  <strong className="text-[11px] font-black text-[#121212]">{d.bookingsCount}</strong>
                </div>
                <div className="flex items-baseline justify-between text-[#4a4a42]">
                  <span className="text-[10px] font-medium">Court Rental</span>
                  <strong className="text-[11px] font-black text-[#121212]">{d.totalRentalHours}hr</strong>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>




      {/* Clicked timeline booking: same View / Reschedule / Cancel modals as Bookings */}
      <DashboardBookingModals
        booking={viewingBooking}
        canManage={canManage}
        onClose={() => setViewingBooking(null)}
        onReopen={setViewingBooking}
        onChanged={loadDashboard}
      />

      {/* Read-only announcement details: using the shared modal without onEdit,
          so the Edit button is hidden for staff. */}
      {viewingAnnouncement && (
        <ViewAnnouncementModal
          isOpen
          announcement={viewingAnnouncement}
          onClose={() => setViewingAnnouncement(null)}
        />
      )}
    </div>
  );
}