import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Search, Calendar, ChevronDown, MoreHorizontal, ChevronLeft, ChevronRight, RotateCcw, Check } from 'lucide-react';
import BookingsTblMenu from './BookingsTblMenu';
import BookingsViewModal from './BookingsViewModal';
import BookingsRescheduleModal from './BookingsRescheduleModal';
import BookingsCancelModal from './BookingsCancelModal';
import { fetchAdminBookings, cancelBooking, rescheduleBooking } from '../../../lib/bookingService';

// Kept (empty) only so other files that still import it don't break.
// Real data now comes from Supabase.
export const INITIAL_BOOKINGS = [];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const STATUS_OPTIONS = [
  { id: 'ALL', label: 'All Statuses' },
  { id: 'Reserved', label: 'Reserved', color: '#ffed76', textColor: '#a5950c' },
  { id: 'On-going', label: 'On-going', color: '#bfdbfe', textColor: '#1d4ed8' },
  { id: 'Cancelled', label: 'Cancelled', color: '#ff9d90', textColor: '#c42b2b' },
  { id: 'Completed', label: 'Completed', color: '#baff95', textColor: '#4ea711' },
];

const BADGE_STYLES = {
  Reserved: 'bg-[#ffed76] text-[#a5950c]',
  'On-going': 'bg-[#bfdbfe] text-[#1d4ed8]',
  Cancelled: 'bg-[#ff9d90] text-[#c42b2b]',
  Completed: 'bg-[#baff95] text-[#4ea711]',
};

export default function Bookings({ refreshKey = 0 }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Date filter state
  const [selectedDate, setSelectedDate] = useState(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  // Status dropdown popover state
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);

  // Row action (kebab) menu state
  const [openMenu, setOpenMenu] = useState(null); // { booking, rect } | null
  const pressedWhileOpenRef = useRef(false);

  // Modals
  const [viewBooking, setViewBooking] = useState(null);
  const [rescheduleBooking_, setRescheduleBooking] = useState(null);
  const [rescheduleFromView, setRescheduleFromView] = useState(false);
  const [cancelBooking_, setCancelBooking] = useState(null);
  const [cancelFromView, setCancelFromView] = useState(false);

  // Pagination: 10 rows per page
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Calendar popover view state (defaults to the current month)
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());

  const datePickerRef = useRef(null);
  const statusDropdownRef = useRef(null);

  // ------------------------------------------------------------------
  // Load bookings from Supabase
  // ------------------------------------------------------------------
  const loadBookings = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setLoadError('');
    try {
      const rows = await fetchAdminBookings();
      setBookings(rows);
    } catch (err) {
      setLoadError(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Reload on first open and whenever a booking is added (refreshKey changes)
  useEffect(() => {
    loadBookings();
  }, [loadBookings, refreshKey]);

  // Refresh quietly every minute so Reserved -> On-going -> Completed updates by itself
  useEffect(() => {
    const timer = setInterval(() => loadBookings({ silent: true }), 60 * 1000);
    return () => clearInterval(timer);
  }, [loadBookings]);

  // Close popovers on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target)) {
        setIsDatePickerOpen(false);
      }
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target)) {
        setIsStatusDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Format date display for the filter button: dd/mm/yyyy
  const formattedDisplayDate = useMemo(() => {
    if (!selectedDate) return 'dd/mm/yyyy';
    const dayStr = String(selectedDate.day).padStart(2, '0');
    const monthStr = String(selectedDate.month + 1).padStart(2, '0');
    return `${dayStr}/${monthStr}/${selectedDate.year}`;
  }, [selectedDate]);

  // Calendar days generator
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();

    const days = [];
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      days.push({
        dayNumber: prevMonthDays - i,
        isCurrentMonth: false,
        year: viewMonth === 0 ? viewYear - 1 : viewYear,
        month: viewMonth === 0 ? 11 : viewMonth - 1,
      });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({ dayNumber: d, isCurrentMonth: true, year: viewYear, month: viewMonth });
    }
    const remaining = 35 - days.length > 0 ? 35 - days.length : 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      days.push({
        dayNumber: d,
        isCurrentMonth: false,
        year: viewMonth === 11 ? viewYear + 1 : viewYear,
        month: viewMonth === 11 ? 0 : viewMonth + 1,
      });
    }
    return days;
  }, [viewYear, viewMonth]);

  const handlePrevMonth = (e) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = (e) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const handleDaySelect = (dayObj) => {
    setSelectedDate({ year: dayObj.year, month: dayObj.month, day: dayObj.dayNumber });
    setCurrentPage(1);
    setIsDatePickerOpen(false);
  };

  const handleClearDate = (e) => {
    e.stopPropagation();
    setSelectedDate(null);
    setCurrentPage(1);
    setIsDatePickerOpen(false);
  };

  const handleSelectStatus = (statusId) => {
    setStatusFilter(statusId);
    setCurrentPage(1);
    setIsStatusDropdownOpen(false);
  };

  const isFiltered = Boolean(searchQuery.trim() || statusFilter !== 'ALL' || selectedDate);
  const handleResetAllFilters = () => {
    setSearchQuery('');
    setStatusFilter('ALL');
    setSelectedDate(null);
    setCurrentPage(1);
    setIsDatePickerOpen(false);
    setIsStatusDropdownOpen(false);
  };

  // Kebab menu handlers
  const closeRowMenu = () => setOpenMenu(null);

  const handleRowMenuMouseDown = (booking) => {
    pressedWhileOpenRef.current = openMenu?.booking.id === booking.id;
  };

  const handleToggleRowMenu = (e, booking) => {
    if (pressedWhileOpenRef.current) {
      pressedWhileOpenRef.current = false;
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setOpenMenu({
      booking,
      rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
    });
  };

  // View modal
  const handleViewBooking = (booking) => setViewBooking(booking);
  const closeViewModal = () => setViewBooking(null);

  // Reschedule modal
  const handleRescheduleBooking = (booking) => {
    setRescheduleFromView(false);
    setRescheduleBooking(booking);
  };
  const handleRescheduleFromView = (booking) => {
    setRescheduleFromView(true);
    setRescheduleBooking(booking);
  };
  const closeRescheduleModal = () => {
    setRescheduleBooking(null);
    setRescheduleFromView(false);
  };
  const handleBackFromReschedule = () => {
    setViewBooking(rescheduleBooking_);
    setRescheduleBooking(null);
    setRescheduleFromView(false);
  };

  // Saves to the database. Errors are thrown back so the modal can show them.
  const handleConfirmReschedule = async ({ booking, date, startTime, reason, notes }) => {
    await rescheduleBooking(booking, { date, startTime, reason, notes });
    await loadBookings({ silent: true });
  };

  // Cancel modal
  const handleCancelBooking = (booking) => {
    setCancelFromView(false);
    setCancelBooking(booking);
  };
  const handleCancelFromView = (booking) => {
    setCancelFromView(true);
    setCancelBooking(booking);
  };
  const closeCancelModal = () => {
    setCancelBooking(null);
    setCancelFromView(false);
  };
  const handleBackFromCancel = () => {
    setViewBooking(cancelBooking_);
    setCancelBooking(null);
    setCancelFromView(false);
  };

  const handleConfirmCancel = async ({ booking, reason, notes }) => {
    await cancelBooking(booking, { reason, notes });
    await loadBookings({ silent: true });
  };

  // Filter logic
  const filteredBookings = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return bookings.filter((b) => {
      const matchesSearch =
        !query ||
        (b.customer || '').toLowerCase().includes(query) ||
        (b.ref || '').toLowerCase().includes(query);

      const matchesStatus = statusFilter === 'ALL' || b.status === statusFilter;

      let matchesDate = true;
      if (selectedDate) {
        const expectedDateStr = `${MONTH_SHORT[selectedDate.month]} ${selectedDate.day}, ${selectedDate.year}`;
        matchesDate = b.date.toLowerCase() === expectedDateStr.toLowerCase();
      }

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [bookings, searchQuery, statusFilter, selectedDate]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    setOpenMenu(null);
  }, [searchQuery, statusFilter, selectedDate, currentPage]);

  useEffect(() => {
    if (!openMenu) return;
    const close = () => setOpenMenu(null);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [openMenu]);

  const totalPages = Math.max(1, Math.ceil(filteredBookings.length / itemsPerPage));
  const paginatedBookings = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredBookings.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredBookings, currentPage, itemsPerPage]);

  const renderStatusBadge = (status) => (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold select-none whitespace-nowrap ${
        BADGE_STYLES[status] || 'bg-neutral-200 text-neutral-800'
      }`}
    >
      <span className="text-[8px] leading-none">•</span>
      <span>{status}</span>
    </span>
  );

  return (
    <div
      style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}
      className="w-full flex flex-col space-y-3"
    >
      {/* Page Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#121212] leading-tight">
          Bookings
        </h1>
        <p className="text-xs text-[#121212] font-normal mt-1 sm:mt-1.5 leading-relaxed">
          Manage court rental bookings — reserve, reschedule, and cancel in one place.
        </p>
      </div>

      {/* Main White Card Container */}
      <div className="w-full bg-[#ffffff] border border-[#121212] rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-xs">
        {/* Search bar & Filters Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative w-full sm:w-[44%] max-w-[380px]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name or reference #"
              className="w-full pl-3.5 pr-8 py-1.5 h-[34px] sm:h-[36px] bg-[#ffffff] border border-[#121212] rounded-xl text-xs text-[#121212] placeholder-[#6b7280] focus:outline-none focus:ring-1 focus:ring-[#121212] transition-all"
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-[#6b7280]">
              <Search className="w-4 h-4 stroke-[1.8]" />
            </div>
          </div>

          {/* Right Filters */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Date filter */}
            <div className="relative" ref={datePickerRef}>
              <button
                type="button"
                onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                className="w-[130px] sm:w-[142px] pl-7 pr-3 py-1.5 h-[34px] sm:h-[36px] bg-[#ffffff] border border-[#121212] rounded-xl text-xs text-[#6b7280] font-normal flex items-center justify-start text-left focus:outline-none focus:ring-1 focus:ring-[#121212] transition-all cursor-pointer relative"
                title="Select date to filter"
              >
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-[#6b7280]">
                  <Calendar className="w-3.5 h-3.5 stroke-[1.8]" />
                </div>
                <span className="truncate">{formattedDisplayDate}</span>
              </button>

              {isDatePickerOpen && (
                <div className="absolute top-full mt-1.5 right-0 sm:left-0 z-50 w-72 bg-[#ffffff] border border-[#121212] rounded-2xl p-3.5 shadow-xl select-none animate-in fade-in duration-100">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-neutral-100">
                    <button type="button" onClick={handlePrevMonth} className="p-1 hover:bg-neutral-100 rounded-lg text-[#121212] transition-colors cursor-pointer" title="Previous month">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-bold text-[#121212]">
                      {MONTH_NAMES[viewMonth]} {viewYear}
                    </span>
                    <button type="button" onClick={handleNextMonth} className="p-1 hover:bg-neutral-100 rounded-lg text-[#121212] transition-colors cursor-pointer" title="Next month">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-[#6b7280] mb-1">
                    <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
                  </div>

                  <div className="grid grid-cols-7 gap-1 text-center text-xs">
                    {calendarDays.map((d, index) => {
                      const isSelected =
                        selectedDate &&
                        selectedDate.year === d.year &&
                        selectedDate.month === d.month &&
                        selectedDate.day === d.dayNumber;

                      return (
                        <button
                          key={`${d.year}-${d.month}-${d.dayNumber}-${index}`}
                          type="button"
                          onClick={() => handleDaySelect(d)}
                          className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-medium transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#121212] text-[#ccff00] font-bold shadow-xs'
                              : d.isCurrentMonth
                              ? 'text-[#121212] hover:bg-neutral-100 hover:font-bold'
                              : 'text-neutral-300 hover:text-neutral-500'
                          }`}
                        >
                          {d.dayNumber}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-neutral-100 text-[11px]">
                    <button type="button" onClick={handleClearDate} className="text-[#6b7280] hover:text-[#121212] font-semibold cursor-pointer">
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const now = new Date();
                        setViewYear(now.getFullYear());
                        setViewMonth(now.getMonth());
                        handleDaySelect({ year: now.getFullYear(), month: now.getMonth(), dayNumber: now.getDate() });
                      }}
                      className="text-[#121212] hover:underline font-bold cursor-pointer"
                    >
                      Today
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Status Filter */}
            <div className="relative" ref={statusDropdownRef}>
              <button
                type="button"
                onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                className="w-[130px] sm:w-[142px] pl-7 pr-3 py-1.5 h-[34px] sm:h-[36px] bg-[#ffffff] border border-[#121212] rounded-xl text-xs text-[#6b7280] font-normal flex items-center justify-between text-left focus:outline-none focus:ring-1 focus:ring-[#121212] transition-all cursor-pointer relative"
                title="Filter by status"
              >
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-[#6b7280]">
                  <ChevronDown className="w-3.5 h-3.5 stroke-[1.8]" />
                </div>
                <span className="truncate">{statusFilter === 'ALL' ? 'All Statuses' : statusFilter}</span>
              </button>

              {isStatusDropdownOpen && (
                <div className="absolute top-full mt-1.5 right-0 z-50 w-44 bg-[#ffffff] border border-[#121212] rounded-xl p-1 shadow-xl select-none animate-in fade-in duration-100">
                  {STATUS_OPTIONS.map((opt) => {
                    const isSelected = statusFilter === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleSelectStatus(opt.id)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer text-left ${
                          isSelected ? 'bg-neutral-100 text-[#121212] font-bold' : 'text-[#121212] hover:bg-neutral-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {opt.id !== 'ALL' ? (
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: opt.color, border: `1px solid ${opt.textColor}` }}
                            />
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-neutral-300 shrink-0" />
                          )}
                          <span>{opt.label}</span>
                        </div>
                        {isSelected && <Check className="w-3 h-3 text-[#121212] stroke-[2.5]" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Reset Filter Button */}
            <button
              type="button"
              onClick={handleResetAllFilters}
              disabled={!isFiltered}
              className={`px-3 py-1.5 h-[34px] sm:h-[36px] bg-[#ffffff] border border-[#121212] rounded-xl text-xs transition-all flex items-center gap-1.5 shrink-0 select-none ${
                isFiltered
                  ? 'text-[#121212] font-semibold hover:bg-neutral-100 cursor-pointer shadow-2xs'
                  : 'text-[#6b7280]/50 border-neutral-300 opacity-60 cursor-not-allowed'
              }`}
              title="Reset all filters"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Bookings Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[760px]">
            <thead>
              <tr className="border-b border-[#121212]">
                {['REF #', 'CUSTOMER NAME', 'DATE', 'TIME', 'PAX', 'AMOUNT'].map((h) => (
                  <th key={h} className="py-2.5 px-3 sm:px-4 text-[10px] sm:text-[10.5px] font-bold tracking-wider uppercase text-[#5f5e5e]">
                    {h}
                  </th>
                ))}
                <th className="py-2.5 px-3 sm:px-4 text-[10px] sm:text-[10.5px] font-bold tracking-wider uppercase text-[#5f5e5e] text-center">
                  STATUS
                </th>
                <th className="py-2.5 px-3 sm:px-4 text-[10px] sm:text-[10.5px] font-bold tracking-wider uppercase text-[#5f5e5e] text-center">
                  ACTION
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-xs text-[#5f5e5e]">
                    Loading bookings...
                  </td>
                </tr>
              ) : loadError ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-xs text-red-600">
                    Couldn't load bookings: {loadError}{' '}
                    <button type="button" onClick={() => loadBookings()} className="underline font-semibold cursor-pointer">
                      Try again
                    </button>
                  </td>
                </tr>
              ) : paginatedBookings.length > 0 ? (
                paginatedBookings.map((b) => {
                  const isMenuOpenForRow = openMenu?.booking.id === b.id;
                  return (
                    <tr key={b.id} className="border-b border-[#c4c9ac] hover:bg-neutral-50/70 transition-colors">
                      <td className="py-2 px-3 sm:px-4 text-xs font-semibold text-[#121212] whitespace-nowrap">{b.ref}</td>
                      <td className="py-2 px-3 sm:px-4 text-xs font-medium text-[#121212] whitespace-nowrap">{b.customer}</td>
                      <td className="py-2 px-3 sm:px-4 text-xs font-normal text-[#6b7280] whitespace-nowrap">{b.date}</td>
                      <td className="py-2 px-3 sm:px-4 text-xs font-normal text-[#6b7280] whitespace-nowrap">{b.time}</td>
                      <td className="py-2 px-3 sm:px-4 text-xs font-medium text-[#121212] whitespace-nowrap">{b.pax}</td>
                      <td className="py-2 px-3 sm:px-4 text-xs font-semibold text-[#121212] whitespace-nowrap tabular-nums">{b.amount}</td>
                      <td className="py-2 px-3 sm:px-4 text-center whitespace-nowrap">{renderStatusBadge(b.status)}</td>
                      <td className="py-2 px-3 sm:px-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onMouseDown={() => handleRowMenuMouseDown(b)}
                          onClick={(e) => handleToggleRowMenu(e, b)}
                          aria-haspopup="menu"
                          aria-expanded={isMenuOpenForRow}
                          className={`inline-flex items-center justify-center w-7 h-[18px] border rounded-[4px] text-[#121212] hover:border-[#121212] hover:bg-neutral-100 transition-colors cursor-pointer ${
                            isMenuOpenForRow ? 'border-[#121212] bg-neutral-100' : 'border-[#121212]/35'
                          }`}
                          title="Actions"
                        >
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-xs text-[#5f5e5e]">
                    {bookings.length === 0
                      ? 'No bookings yet. Use "Add Booking" to create one.'
                      : 'No bookings found matching your search.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs text-[#5f5e5e]">
          <div>
            Showing{' '}
            <span className="font-bold text-[#121212]">
              {filteredBookings.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}
            </span>{' '}
            to{' '}
            <span className="font-bold text-[#121212]">
              {Math.min(currentPage * itemsPerPage, filteredBookings.length)}
            </span>{' '}
            of <span className="font-bold text-[#121212]">{filteredBookings.length}</span> court bookings
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className={`p-1 rounded-md border border-[#121212] transition-colors flex items-center justify-center ${
                currentPage <= 1
                  ? 'opacity-30 cursor-not-allowed bg-neutral-100 text-[#5f5e5e]'
                  : 'hover:bg-neutral-100 text-[#121212] cursor-pointer'
              }`}
              title="Previous page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
              const isActive = pageNum === currentPage;
              return (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => setCurrentPage(pageNum)}
                  className={`min-w-[24px] h-6 px-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#121212] text-[#ccff00] border border-[#121212]'
                      : 'bg-white text-[#121212] border border-[#121212]/40 hover:border-[#121212] hover:bg-neutral-50'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className={`p-1 rounded-md border border-[#121212] transition-colors flex items-center justify-center ${
                currentPage >= totalPages
                  ? 'opacity-30 cursor-not-allowed bg-neutral-100 text-[#5f5e5e]'
                  : 'hover:bg-neutral-100 text-[#121212] cursor-pointer'
              }`}
              title="Next page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Row actions menu */}
      {openMenu && (
        <div
          style={{
            position: 'fixed',
            top: openMenu.rect.top,
            left: openMenu.rect.left,
            width: openMenu.rect.width,
            height: openMenu.rect.height,
            zIndex: 60,
            pointerEvents: 'none',
          }}
        >
          <div style={{ pointerEvents: 'auto' }}>
            <BookingsTblMenu
              isOpen
              booking={openMenu.booking}
              onClose={closeRowMenu}
              onView={handleViewBooking}
              onReschedule={handleRescheduleBooking}
              onCancel={handleCancelBooking}
            />
          </div>
        </div>
      )}

      <BookingsViewModal
        isOpen={Boolean(viewBooking)}
        booking={viewBooking}
        onClose={closeViewModal}
        onReschedule={handleRescheduleFromView}
        onCancel={handleCancelFromView}
      />

      <BookingsRescheduleModal
        isOpen={Boolean(rescheduleBooking_)}
        booking={rescheduleBooking_}
        fromView={rescheduleFromView}
        onClose={closeRescheduleModal}
        onBack={handleBackFromReschedule}
        onConfirmReschedule={handleConfirmReschedule}
      />

      <BookingsCancelModal
        isOpen={Boolean(cancelBooking_)}
        booking={cancelBooking_}
        fromView={cancelFromView}
        onClose={closeCancelModal}
        onBack={handleBackFromCancel}
        onConfirmCancel={handleConfirmCancel}
      />
    </div>
  );
}