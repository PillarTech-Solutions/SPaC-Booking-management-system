import React, { useEffect } from 'react';
import { X, CalendarClock, Ban } from 'lucide-react';

const BADGE_STYLES = {
  Reserved: 'bg-[#ffed76] text-[#a5950c]',
  'On-going': 'bg-[#bfdbfe] text-[#1d4ed8]',
  Cancelled: 'bg-[#ff9d90] text-[#c42b2b]',
  Completed: 'bg-[#baff95] text-[#4ea711]',
};

export default function BookingsViewModal({
  isOpen = false,
  onClose,
  booking = null,
  onReschedule,
  onCancel,
  // readOnly: used by the guest "Find your booking" page.
  // Hides the action buttons, contact details and staff notes.
  readOnly = false,
  // variant="customer": used by the customer's My Bookings page.
  // Buttons follow booking.canReschedule / booking.canCancel (24-hour policy) and staff notes are hidden.
  variant = 'admin',
}) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose?.();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !booking) return null;

  // Allowed actions (same rules as the table menu)
  //  Reserved: Reschedule + Cancel | Cancelled: Reschedule | On-going / Completed: view only
  const isCustomer = variant === 'customer';
  const canReschedule = readOnly
    ? false
    : isCustomer
    ? Boolean(booking.canReschedule)
    : booking.status === 'Reserved' || booking.status === 'Cancelled';
  const canCancel = readOnly ? false : isCustomer ? Boolean(booking.canCancel) : booking.status === 'Reserved';
  const hideNotes = readOnly || isCustomer;

  const breakdown = booking.breakdown || {};
  const total =
    (breakdown.courtRate || 0) +
    (breakdown.additionalPlayers || 0) +
    (breakdown.paddleRental || 0) +
    (breakdown.ballRental || 0);

  const fields = [
    ['CUSTOMER', booking.customer],
    readOnly
      ? ['DURATION', `${booking.duration} ${Number(booking.duration) === 1 ? 'hr' : 'hrs'}`]
      : ['CONTACT INFORMATION', booking.contact],
    ['BOOKING SOURCE', booking.bookingSource],
    ['PAYMENT METHOD', booking.paymentMethod],
    ['DATE', booking.date],
    ['TIME', booking.time],
    ['PAX', `${booking.pax} ${booking.pax === '1' ? 'Player' : 'Players'}`],
    ['ADD-ONS', booking.addOns],
  ];

  const handleRescheduleClick = () => {
    onClose?.();
    onReschedule?.(booking);
  };

  const handleCancelClick = () => {
    onClose?.();
    onCancel?.(booking);
  };

  return (
    <div
      style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-[2px] select-none animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="w-full max-w-[460px] sm:max-w-[480px] bg-[#ffffff] border border-[#dedbc4] rounded-2xl shadow-2xl p-4 sm:p-4.5 flex flex-col relative transition-all duration-150">

        {/* HEADER */}
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-[17px] font-bold text-[#121212] tracking-tight">
            Court Rental Details
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 -mr-1 rounded-full text-[#6b7280] hover:text-[#121212] transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4 stroke-[2.2]" />
          </button>
        </div>

        <div className="mx-1 h-px bg-[#dedbc4] mt-2.5 mb-2.5 sm:mt-3 sm:mb-3" />

        {/* UPPER SECTION */}
        <div className="mb-2.5 sm:mb-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#f5f3e5] text-[#121212] border border-[#dedbc4] select-none whitespace-nowrap">
              Ref #: {booking.ref}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold select-none whitespace-nowrap ${
                BADGE_STYLES[booking.status] || 'bg-neutral-200 text-neutral-800'
              }`}
            >
              <span className="text-[8px] leading-none">•</span>
              <span>{booking.status}</span>
            </span>
          </div>

          <p className="text-xs text-[#717171] mt-1 font-normal">
            Booked {booking.bookedDate} · Last updated {booking.lastUpdated}
          </p>
        </div>

        {/* MIDDLE SECTION (two columns) */}
        <div className="grid grid-cols-2 gap-x-6 sm:gap-x-7 gap-y-2 sm:gap-y-2.5 mb-2.5 sm:mb-3">
          {fields.map(([label, value], i) => (
            <div key={label} className={i % 2 === 1 ? 'text-right' : ''}>
              <span className="block text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#717171] mb-0.5">
                {label}
              </span>
              <p className="text-xs sm:text-[13px] font-semibold text-[#121212] truncate" title={value}>
                {value || '—'}
              </p>
            </div>
          ))}

          {!hideNotes && (
            <div className="col-span-2">
              <span className="block text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#717171] mb-0.5">
                NOTE
              </span>
              <p className="text-xs sm:text-[13px] font-normal text-[#121212] leading-tight">
                {booking.notes || 'None'}
              </p>
            </div>
          )}

          {!readOnly && booking.status === 'Cancelled' && booking.cancelReason && (
            <div className="col-span-2">
              <span className="block text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#c42b2b] mb-0.5">
                CANCELLATION REASON
              </span>
              <p className="text-xs sm:text-[13px] font-normal text-[#121212] leading-tight">
                {booking.cancelReason}
              </p>
            </div>
          )}

          {isCustomer && booking.needsAttention && (
            <p className="col-span-2 text-[11px] font-semibold text-[#c42b2b] leading-tight">
              This booking was cancelled by the court. You can reschedule it to a new time at no extra charge.
            </p>
          )}

          {isCustomer && booking.changesClosed && (
            <p className="col-span-2 text-[11px] text-[#717171] leading-tight">
              Cancelling or rescheduling is only allowed at least 24 hours before your schedule.
            </p>
          )}
        </div>

        {/* PRICE BREAKDOWN (saved in the database) */}
        <div className="border border-[#dedbc4] rounded-xl px-3.5 py-2.5 bg-[#fcfbf7]">
          <div className="space-y-1 text-xs">
            {[
              ['Court Rate', breakdown.courtRate],
              [`Additional Players (${breakdown.additionalPlayersCount || 0} x ₱ 100)`, breakdown.additionalPlayers],
              [`Paddle Rental (${breakdown.paddleCount || 0} x ₱ 100)`, breakdown.paddleRental],
              [`Ball Rental (${breakdown.ballCount || 0} x ₱ 50)`, breakdown.ballRental],
            ].map(([label, amount]) => (
              <div key={label} className="flex items-center justify-between text-[#404040]">
                <span>{label}</span>
                <span className="tabular-nums">₱ {(amount || 0).toLocaleString('en-PH')}</span>
              </div>
            ))}
          </div>

          <div className="pt-2 mt-2 border-t border-[#dedbc4] flex items-center justify-between">
            <span className="font-bold text-xs sm:text-sm text-[#121212] tracking-wide">TOTAL</span>
            <span className="font-extrabold text-sm sm:text-base text-[#121212] tabular-nums">
              ₱ {total.toLocaleString('en-PH')}
            </span>
          </div>
        </div>

        <div className="mx-1 h-px bg-[#dedbc4] mt-3 mb-2.5 sm:mt-3.5 sm:mb-3" />

        {/* BUTTONS */}
        <div className="w-full flex items-center justify-between gap-2 pt-0.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 sm:px-5 py-1.5 rounded-full font-bold text-xs sm:text-sm bg-[#d1d5db] text-[#121212] hover:bg-[#c4c8ce] active:scale-[0.98] transition-all cursor-pointer text-center"
          >
            Close
          </button>

          {(canReschedule || canCancel) && (
            <div className="flex items-center gap-2">
              {canReschedule && (
                <button
                  type="button"
                  onClick={handleRescheduleClick}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-1.5 rounded-full font-bold text-xs sm:text-sm bg-[#ffffff] border border-[#121212] text-[#121212] hover:bg-[#fbfaf1] active:scale-[0.98] transition-all cursor-pointer shadow-2xs"
                >
                  <CalendarClock className="w-3.5 h-3.5 stroke-[2] text-[#121212]" />
                  <span>Reschedule</span>
                </button>
              )}

              {canCancel && (
                <button
                  type="button"
                  onClick={handleCancelClick}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-1.5 rounded-full font-bold text-xs sm:text-sm bg-[#C42B2B] text-white hover:bg-[#a82424] active:scale-[0.98] transition-all cursor-pointer shadow-xs"
                >
                  <Ban className="w-3.5 h-3.5 stroke-[2.2] text-white" />
                  <span>Cancel Booking</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}