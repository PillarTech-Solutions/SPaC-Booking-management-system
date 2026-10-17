import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronDown, Check } from 'lucide-react';

const CANCELLATION_REASONS = [
  'Customer requested cancellation',
  'Inclement weather / Rain',
  'Court maintenance / Repairs',
  'Player conflict / Emergency',
  'Duplicate booking',
  'Other'
];

// Reasons a customer picks on their own My Bookings page
const CUSTOMER_CANCELLATION_REASONS = [
  'Change of plans',
  'Schedule conflict',
  'Weather condition / Rain',
  'Emergency',
  'Other'
];

/**
 * BookingsCancelModal
 *  - onConfirmCancel({ booking, reason, notes }) must return a Promise.
 *    If it throws, the error is shown here and the modal stays open.
 */
export default function BookingsCancelModal({
  isOpen = false,
  onClose,
  onBack,
  fromView = false,
  booking = null,
  onConfirmCancel,
  // variant="customer": customer reasons, no "notify customer" checkbox, non-refundable notice
  variant = 'admin',
}) {
  const isCustomer = variant === 'customer';
  const reasonOptions = isCustomer ? CUSTOMER_CANCELLATION_REASONS : CANCELLATION_REASONS;
  const [reason, setReason] = useState('');
  const [isReasonOpen, setIsReasonOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [notifyCustomer, setNotifyCustomer] = useState(true);
  const [showCancellationPolicy, setShowCancellationPolicy] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const reasonRef = useRef(null);

  // Reset when a booking is opened
  useEffect(() => {
    if (booking && isOpen) {
      setReason('');
      setIsReasonOpen(false);
      setNotes('');
      setNotifyCustomer(true);
      setShowCancellationPolicy(false);
      setError('');
      setSaving(false);
    }
  }, [booking, isOpen]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event) {
      if (reasonRef.current && !reasonRef.current.contains(event.target)) setIsReasonOpen(false);
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

  if (!isOpen || !booking) return null;

  const formattedDateTime = `${booking.date} • ${booking.time}`;

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!reason) {
      setError('Please select a cancellation reason');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await onConfirmCancel?.({
        booking,
        reason,
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
            Cancel Booking
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
        <div>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-[#f5f3e5] text-[#121212] border border-[#dedbc4]/60 select-none whitespace-nowrap mb-2.5">
            Ref #: {booking.ref}
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
              DATE & TIME
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
                onClick={() => setIsReasonOpen(!isReasonOpen)}
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

            {/* Notes */}
            <div>
              <label className="block text-xs font-bold text-[#404040] mb-1">Notes</label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any relevant details here..."
                className="w-full h-18 sm:h-20 px-3 py-2 bg-[#ffffff] border border-[#dedbc4] rounded-lg text-xs text-[#121212] placeholder-[#9ca3af] focus:outline-none focus:border-[#121212] transition-colors resize-none leading-relaxed"
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
              View Cancellation Policy
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

          {isCustomer && (
            <p className="mt-1 text-[11px] font-semibold text-[#c42b2b] leading-tight">
              Payments are non-refundable. Cancelling will not return your payment.
            </p>
          )}

          {showCancellationPolicy && (
            <div className="mt-1.5 p-2 bg-neutral-100/90 rounded-lg text-[11px] text-[#525252] leading-tight animate-in fade-in duration-100">
              {/* Matches the customer-side Booking Policy. Confirm final wording with the client. */}
              Cancellations must be made at least 24 hours before the schedule. Cancellations less than 24 hours before are not allowed. Full payment is required and non-refundable.
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
              className="px-6 sm:px-7 py-2 rounded-full font-bold text-xs sm:text-sm bg-[#c42b2b] text-white hover:bg-[#a82424] active:scale-[0.98] transition-all cursor-pointer shadow-xs text-center disabled:opacity-60 disabled:cursor-wait"
            >
              {saving ? 'Cancelling...' : 'Confirm Cancellation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}