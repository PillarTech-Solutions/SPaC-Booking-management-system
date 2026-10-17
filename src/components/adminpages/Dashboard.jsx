import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Megaphone, MoreVertical, Pin } from 'lucide-react';
import AddAnnouncement from './AddAnnouncement';
import AnnouncementMenu from './AnnouncementMenu';
import ViewAnnouncementModal from './ViewAnnouncementsModal';
import DeleteAnnouncementModal from './DeleteAnnouncementsModal';
import { fetchDashboardData } from '../../../lib/bookingService';
import DashboardBookingModals, { STATUS_COLORS, StatusLegend } from './DashboardBookingModals';
import {
  fetchAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  setAnnouncementPinned,
  deleteAnnouncement,
} from '../../../lib/announcementService';

// Operating hours: 6:00 AM to 2:00 AM (20 hours continuous)
const TIMELINE_TICKS = [
  { hour: 6, label: '6AM' },
  { hour: 8, label: '8AM' },
  { hour: 10, label: '10 AM' },
  { hour: 12, label: '12PM' },
  { hour: 14, label: '2PM' },
  { hour: 16, label: '4PM' },
  { hour: 18, label: '6PM' },
  { hour: 20, label: '8PM' },
  { hour: 22, label: '10PM' },
  { hour: 24, label: '12AM' },
  { hour: 26, label: '2AM' },
];

// Timeline scale: 6:00 AM (6) to 2:00 AM (26)
const OPEN_HOUR = 6;
const TOTAL_HOURS = 20;
const pct = (hour) => ((hour - OPEN_HOUR) / TOTAL_HOURS) * 100;

export default function Dashboard({ onAddBookingClick, onNavigateTab, refreshKey } = {}) {
  // ---------------------------------------------------------------------------
  // REAL BOOKING DATA (timeline, week ahead, revenue)
  // ---------------------------------------------------------------------------
  const [dash, setDash] = useState({
    today: [],
    week: [],
    revenue: { courtFees: 0, extraPlayers: 0, equipment: 0, total: 0 },
  });
  const [dashLoading, setDashLoading] = useState(true);
  const [viewingBooking, setViewingBooking] = useState(null); // clicked timeline booking
  const [dashError, setDashError] = useState('');

  const loadDashboard = useCallback(async () => {
    try {
      setDash(await fetchDashboardData());
      setDashError('');
    } catch (err) {
      setDashError(err.message);
    } finally {
      setDashLoading(false);
    }
  }, []);

  // Load now, after "Add Booking" saves (refreshKey), and every minute
  useEffect(() => {
    loadDashboard();
    const timer = setInterval(loadDashboard, 60000);
    return () => clearInterval(timer);
  }, [loadDashboard, refreshKey]);

  // ---------------------------------------------------------------------------
  // ANNOUNCEMENT STATE
  // ---------------------------------------------------------------------------
  const [announcements, setAnnouncements] = useState([]); // saved in the database
  const [annError, setAnnError] = useState('');
  const [menuOpenId, setMenuOpenId] = useState(null); // which kebab menu is open
  const [menuAnchor, setMenuAnchor] = useState(null); // position of the clicked three-dots button
  const [isAddOpen, setIsAddOpen] = useState(false); // "+ New" modal
  const [viewingAnnouncement, setViewingAnnouncement] = useState(null); // View modal
  const [editingAnnouncement, setEditingAnnouncement] = useState(null); // Edit modal
  const [editFromView, setEditFromView] = useState(false); // true when Edit was opened from the View modal
  const [deletingAnnouncement, setDeletingAnnouncement] = useState(null); // Delete confirm

  // Pinned announcements always show first (original order kept otherwise)
  const sortedAnnouncements = useMemo(() => {
    const pinned = announcements.filter((a) => a.pinned);
    const rest = announcements.filter((a) => !a.pinned);
    return [...pinned, ...rest];
  }, [announcements]);

  const loadAnnouncements = useCallback(async () => {
    try {
      setAnnouncements(await fetchAnnouncements());
      setAnnError('');
    } catch (err) {
      setAnnError(err.message);
    }
  }, []);

  useEffect(() => {
    loadAnnouncements();
    const timer = setInterval(loadAnnouncements, 60000);
    return () => clearInterval(timer);
  }, [loadAnnouncements]);

  // Runs a save, then reloads the list (errors show above the list)
  const saveAndReload = async (action) => {
    try {
      await action();
      await loadAnnouncements();
    } catch (err) {
      setAnnError(err.message);
    }
  };

  // Add new announcement (from AddAnnouncement modal)
  const handleAddAnnouncement = (data) =>
    saveAndReload(() => createAnnouncement({ title: data.title, message: data.message, isPinned: data.isPinned }));

  // Pin / Unpin from kebab menu
  const handlePin = (ann) => {
    if (!ann) return;
    saveAndReload(() => setAnnouncementPinned(ann.id, !ann.pinned));
  };

  // Save edits (from AddAnnouncement modal in edit mode)
  const handleSaveEdit = (data) => {
    const id = editingAnnouncement?.id; // read now: the modal closes right after
    if (!id) return;
    saveAndReload(() => updateAnnouncement(id, { title: data.title, message: data.message, isPinned: data.isPinned }));
  };

  // Delete (called by DeleteAnnouncementModal, which also closes itself)
  const handleDelete = (ann) => {
    if (!ann) return;
    saveAndReload(() => deleteAnnouncement(ann.id));
  };

  // Open / close a kebab menu, remembering where the button is on screen
  const handleKebabClick = (e, annId) => {
    e.stopPropagation();
    if (menuOpenId === annId) {
      setMenuOpenId(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuAnchor({
      top: rect.top,
      bottom: rect.bottom,
      left: rect.left,
      right: rect.right,
    });
    setMenuOpenId(annId);
  };

  // Open the Edit modal from the kebab menu (button label stays "Close")
  const openEditFromMenu = (ann) => {
    setEditFromView(false);
    setEditingAnnouncement(ann);
  };

  // Open the Edit modal from the View modal (button label becomes "Back")
  const openEditFromView = (ann) => {
    setEditFromView(true);
    setEditingAnnouncement(ann);
  };

  // Plain close of the Edit modal (X, Escape, backdrop, after Save)
  const closeEditModal = () => {
    setEditingAnnouncement(null);
    setEditFromView(false);
  };

  // "Back" from the Edit modal -> return to the View modal for the same announcement
  const handleEditBack = () => {
    if (editingAnnouncement) {
      const latest =
        announcements.find((a) => a.id === editingAnnouncement.id) ||
        editingAnnouncement;
      setViewingAnnouncement(latest);
    }
    setEditingAnnouncement(null);
    setEditFromView(false);
  };

  // 1. TODAY'S REVENUE BREAKDOWN (payments received today)
  const rev = dash.revenue;
  const share = (n) => (rev.total > 0 ? (n / rev.total) * 100 : 0);
  const revenueData = {
    courtFees: rev.courtFees,
    extraPlayers: rev.extraPlayers,
    equipment: rev.equipment,
    total: rev.total,
    courtPct: share(rev.courtFees),
    extraPct: share(rev.extraPlayers),
    equipPct: share(rev.equipment),
  };

  // Convert hour number to readable time
  const formatHourLabel = (hourVal) => {
    const whole = Math.floor(hourVal);
    const mins = Math.round((hourVal - whole) * 60);
    const displayMins = mins === 0 ? '00' : mins < 10 ? `0${mins}` : mins;

    let period = 'AM';
    let h12 = whole;
    if (whole >= 12 && whole < 24) {
      period = 'PM';
      if (whole > 12) h12 = whole - 12;
    } else if (whole >= 24) {
      period = 'AM';
      h12 = whole === 24 ? 12 : whole - 24;
    } else if (whole === 0) {
      h12 = 12;
    }
    return `${h12}:${displayMins} ${period}`;
  };

  return (
    <div
      style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}
      className="w-full flex flex-col space-y-3 text-[#121212]"
    >
      {/* Page Header: EXACT positioning with other pages (Bookings & Logs) */}
      <div>
        <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[#121212] leading-tight">
          Dashboard Overview
        </h1>
        <p className="text-[11px] sm:text-xs text-[#121212] font-normal mt-0.5 leading-relaxed">
          Real-time facility performance and operations
        </p>
      </div>

      {/* ========================================================================= */}
      {/* ROW 1: TWO BALANCED COLUMNS (6 cols / 6 cols split)                       */}
      {/* Left (6 cols): TODAY'S REVENUE                                            */}
      {/* Right (6 cols): ANNOUNCEMENTS                                             */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-3.5 items-stretch">
        {/* ===================================================================== */}
        {/* 1. TODAY'S REVENUE                                                    */}
        {/* ===================================================================== */}
        <section className="lg:col-span-6 bg-[#ffffff] border border-[#121212] rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-center space-y-3 sm:space-y-3.5">
          {/* Top row: Title + Live Update pill */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-bold text-[#121212] tracking-tight">
              Today’s Revenue
            </h2>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#ccff00] text-[#121212] select-none shadow-2xs">
              {dashLoading ? 'Loading...' : 'Live Update'}
            </span>
          </div>

          {/* Large Total Numeral (₱8,000) */}
          <div className="text-4xl sm:text-5xl font-black text-[#121212] tracking-tight leading-none my-0.5">
            ₱{revenueData.total.toLocaleString()}
          </div>

          {/* 3 Progress Bars (Court Fees, Extra Players, Equipment) */}
          <div className="space-y-2.5 sm:space-y-3 pt-0.5">
            {/* 1. Court Fees */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs sm:text-[13px] font-bold text-[#121212]">
                <span>Court Fees</span>
                <span>₱{revenueData.courtFees.toLocaleString()}</span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#121212] overflow-hidden">
                <div
                  style={{ width: `${revenueData.courtPct}%` }}
                  className="h-full bg-[#ccff00] rounded-l-full transition-all duration-500"
                />
              </div>
            </div>

            {/* 2. Extra Players */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs sm:text-[13px] font-bold text-[#121212]">
                <span>Extra Players</span>
                <span>₱{revenueData.extraPlayers.toLocaleString()}</span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#121212] overflow-hidden">
                <div
                  style={{ width: `${revenueData.extraPct}%` }}
                  className="h-full bg-[#00e676] rounded-l-full transition-all duration-500"
                />
              </div>
            </div>

            {/* 3. Equipment */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs sm:text-[13px] font-bold text-[#121212]">
                <span>Equipment</span>
                <span>₱{revenueData.equipment.toLocaleString()}</span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#121212] overflow-hidden">
                <div
                  style={{ width: `${revenueData.equipPct}%` }}
                  className="h-full bg-[#a855f7] rounded-l-full transition-all duration-500"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ===================================================================== */}
        {/* 4. ANNOUNCEMENTS SECTION                                              */}
        {/* ===================================================================== */}
        <section className="lg:col-span-6 bg-[#ffffff] border border-[#121212] rounded-2xl shadow-xs overflow-hidden flex flex-col">
          {/* Black Header Bar */}
          <div className="bg-[#121212] px-4 py-2.5 sm:px-5 sm:py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Megaphone className="w-4 h-4 sm:w-5 sm:h-5 text-[#ccff00] fill-[#ccff00]/20 stroke-[2.2]" />
              <h2 className="text-sm sm:text-base font-bold text-[#ccff00] tracking-tight">
                Announcements
              </h2>
              {/* Active count badge */}
              <span className="px-2.5 py-0.5 rounded-full border border-[#ccff00] text-[#ccff00] text-[10px] font-semibold select-none">
                {announcements.length} Active
              </span>
            </div>

            {/* "+ New" Button -> opens AddAnnouncement modal */}
            <button
              type="button"
              onClick={() => {
                setMenuOpenId(null);
                setIsAddOpen(true);
              }}
              className="inline-flex items-center justify-center px-2.5 sm:px-3 py-0.5 rounded-[5px] font-bold text-[11px] sm:text-xs bg-[#ccff00] text-[#121212] hover:bg-[#b8e600] active:scale-[0.98] transition-all cursor-pointer shadow-xs"
            >
              + New
            </button>
          </div>

          {/* Announcements Card Body (the kebab menu floats above via a portal, so no extra padding needed) */}
          <div className="p-3.5 sm:p-4 space-y-3 bg-[#ffffff] overflow-y-auto max-h-[220px]">
            {annError && (
              <div className="px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-600 text-[11px] font-medium">
                {annError}
              </div>
            )}

            {sortedAnnouncements.length === 0 && (
              <div className="text-[11px] text-[#6b7280] text-center py-6">
                No announcements yet. Click “+ New” to add one.
              </div>
            )}

            {sortedAnnouncements.map((ann) => (
              <div
                key={ann.id}
                className="bg-[#ffffff] border border-[#121212] rounded-xl p-3 space-y-1 relative"
              >
                {/* Top Line: Timestamp + Kebab menu */}
                <div className="flex items-center justify-between text-[11px] text-[#6b7280]">
                  <span className="flex items-center gap-1.5">
                    {ann.pinned && (
                      <Pin className="w-3 h-3 fill-[#121212] text-[#121212]" />
                    )}
                    {ann.postedText}
                  </span>

                  <div className="relative">
                    <button
                      type="button"
                      aria-label="Announcement options"
                      onClick={(e) => handleKebabClick(e, ann.id)}
                      className="p-0.5 text-[#121212] rounded hover:bg-[#fbfaf1] transition-colors cursor-pointer"
                    >
                      <MoreVertical className="w-3.5 h-3.5 stroke-[2]" />
                    </button>

                    <AnnouncementMenu
                      isOpen={menuOpenId === ann.id}
                      anchorRect={menuAnchor}
                      onClose={() => setMenuOpenId(null)}
                      announcement={ann}
                      isPinned={ann.pinned}
                      onPin={handlePin}
                      onView={(a) => setViewingAnnouncement(a)}
                      onEdit={openEditFromMenu}
                      onDelete={(a) => setDeletingAnnouncement(a)}
                    />
                  </div>
                </div>

                {/* Title */}
                <h3 className="font-bold text-xs sm:text-[13px] text-[#121212] leading-tight">
                  {ann.title}
                </h3>

                {/* Description */}
                <p className="text-[11px] text-[#6b7280] leading-snug">
                  {ann.description}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ========================================================================= */}
      {/* ROW 2: TODAY’S COURT TIMELINE (6AM to 2AM - SINGLE COURT)                 */}
      {/* ========================================================================= */}
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

        {/* Scrollable Timeline Grid Container */}
        <div className="w-full overflow-x-auto select-none pt-0.5">
          <div className="min-w-[920px] space-y-1.5">
            {/* Header row: COURT on left, then time markers 6AM to 2AM */}
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

            {/* Main Court Row */}
            <div className="grid grid-cols-[100px_1fr] items-center py-1 px-1">
              <div className="text-xs font-bold text-[#121212]">
                Main Court
              </div>

              {/* The Timeline Track */}
              <div className="relative w-full h-[40px] bg-[#fbfaf1] border border-[#dedbc4] rounded-lg overflow-hidden shadow-inner">
                {/* Vertical subtle divider lines */}
                <div className="absolute inset-0 grid grid-cols-10 pointer-events-none">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="border-r border-[#dedbc4]/60 h-full" />
                  ))}
                </div>

                {/* No bookings today */}
                {!dashLoading && dash.today.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center text-[11px] text-[#6b7280]">
                    No court rentals today.
                  </div>
                )}

                {/* Plotted Bookings (real, cancelled ones left out) */}
                {dash.today.map((b) => {
                  const leftPct = pct(b.startHour);
                  const widthPct = (b.durationHours / TOTAL_HOURS) * 100;

                  return (
                    <button
                      type="button"
                      key={b.id}
                      onClick={() => setViewingBooking(b.row)}
                      style={{
                        left: `${leftPct}%`,
                        width: `${widthPct}%`,
                        backgroundColor: (STATUS_COLORS[b.status] || STATUS_COLORS.Reserved).bg,
                        color: (STATUS_COLORS[b.status] || STATUS_COLORS.Reserved).text,
                      }}
                      className="absolute top-0.5 bottom-0.5 rounded-md border border-[#121212] px-2 py-0.5 flex flex-col justify-center text-left shadow-xs overflow-hidden cursor-pointer hover:brightness-95 transition-all"
                      title={`${b.customer} (${formatHourLabel(b.startHour)} – ${formatHourLabel(
                        b.startHour + b.durationHours
                      )}) · ${b.pax} pax · ${b.status}`}
                    >
                      <div className="text-[10px] font-bold truncate leading-tight">
                        {b.customer}
                      </div>
                      <div className="text-[9px] font-semibold opacity-90 truncate leading-none mt-0.5">
                        {b.pax} pax
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* ROW 3: WEEK AHEAD OCCUPANCY                                               */}
      {/* ========================================================================= */}
      <section className="w-full bg-[#ffffff] border border-[#121212] rounded-xl sm:rounded-2xl p-3.5 sm:p-4 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm sm:text-base font-bold text-[#121212] tracking-tight">
            Week Ahead Occupancy
          </h2>
          {dashError && <span className="text-[11px] font-semibold text-red-600">{dashError}</span>}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-2.5">
          {dash.week.map((d) => (
            <button
              type="button"
              key={d.day}
              onClick={() => onNavigateTab?.('CALENDAR')}
              title="Open the Calendar"
              className={`text-left cursor-pointer rounded-lg border p-2 sm:p-2.5 flex flex-col justify-between space-y-1.5 transition-all ${
                d.isToday
                  ? 'bg-[#fbfaf1] border-[#121212] ring-1 ring-[#121212] shadow-xs'
                  : 'bg-[#fbfaf1] border-[#dedbc4] hover:border-[#121212]/50'
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
                  <strong className="text-[11px] font-black text-[#121212]">
                    {d.bookingsCount}
                  </strong>
                </div>

                <div className="flex items-baseline justify-between text-[#4a4a42]">
                  <span className="text-[10px] font-medium">Court Rental</span>
                  <strong className="text-[11px] font-black text-[#121212]">
                    {d.totalRentalHours}hr
                  </strong>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* ANNOUNCEMENT MODALS                                                       */}
      {/* ========================================================================= */}

      {/* Add Announcement (from "+ New") */}
      {isAddOpen && (
        <AddAnnouncement
          isOpen
          headerTitle="Add Announcement"
          submitLabel="Post"
          onClose={() => setIsAddOpen(false)}
          onPost={handleAddAnnouncement}
        />
      )}

      {/* Edit Announcement (prefilled). Reuses AddAnnouncement.
          - Opened from kebab menu  -> bottom-left button says "Close"
          - Opened from View modal  -> bottom-left button says "Back" and returns to View */}
      {editingAnnouncement && (
        <AddAnnouncement
          key={editingAnnouncement.id}
          isOpen
          headerTitle="Edit Announcement"
          submitLabel="Save"
          closeLabel={editFromView ? 'Back' : 'Close'}
          onBack={editFromView ? handleEditBack : null}
          initialData={{
            title: editingAnnouncement.title,
            message: editingAnnouncement.description,
            isPinned: editingAnnouncement.pinned,
          }}
          onClose={closeEditModal}
          onPost={handleSaveEdit}
        />
      )}

      {/* View Announcement (from kebab -> View). Its Edit button opens the edit modal in "Back" mode. */}
      {viewingAnnouncement && (
        <ViewAnnouncementModal
          isOpen
          announcement={viewingAnnouncement}
          onClose={() => setViewingAnnouncement(null)}
          onEdit={openEditFromView}
        />
      )}

      {/* Clicked timeline booking: same View / Reschedule / Cancel modals as Bookings */}
      <DashboardBookingModals
        booking={viewingBooking}
        onClose={() => setViewingBooking(null)}
        onReopen={setViewingBooking}
        onChanged={loadDashboard}
      />

      {/* Delete confirmation (from kebab -> Delete) */}
      {deletingAnnouncement && (
        <DeleteAnnouncementModal
          isOpen
          announcement={deletingAnnouncement}
          onClose={() => setDeletingAnnouncement(null)}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}