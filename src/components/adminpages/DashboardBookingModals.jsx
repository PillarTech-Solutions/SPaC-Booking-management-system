import React, { useState } from 'react';
import BookingsViewModal from './BookingsViewModal';
import BookingsRescheduleModal from './BookingsRescheduleModal';
import BookingsCancelModal from './BookingsCancelModal';
import { cancelBooking, rescheduleBooking } from '../../../lib/bookingService';

// Same colours as the status badges on the Bookings page and the Calendar
export const STATUS_COLORS = {
  Reserved: { bg: '#ffed76', text: '#a5950c' },
  'On-going': { bg: '#bfdbfe', text: '#1d4ed8' },
  Completed: { bg: '#baff95', text: '#4ea711' },
  'No Show': { bg: '#e5e7eb', text: '#4b5563' },
};
export const STATUS_LEGEND = ['Reserved', 'On-going', 'Completed'];

// Small circle legend (same look as the Calendar)
export function StatusLegend() {
  return (
    <div className="flex items-center gap-3 text-[10px] sm:text-[11px] text-[#4a4a42]">
      {STATUS_LEGEND.map((label) => (
        <span key={label} className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <span
            className="w-2.5 h-2.5 rounded-full border"
            style={{ backgroundColor: STATUS_COLORS[label].bg, borderColor: STATUS_COLORS[label].text }}
          />
          {label}
        </span>
      ))}
    </div>
  );
}

/**
 * View Details -> Reschedule / Cancel, the same modals as the Bookings page.
 *  - booking:   the clicked booking row (null = closed)
 *  - canManage: false = view only (e.g. Court Attendant)
 *  - onChanged: called after a reschedule / cancel is saved (reload the dashboard)
 *  - onReopen:  "Back" from Reschedule / Cancel returns to View Details (pass the setter)
 */
export default function DashboardBookingModals({ booking, onClose, canManage = true, onChanged, onReopen }) {
  const [rescheduleTarget, setRescheduleTarget] = useState(null); // { booking, fromView }
  const [cancelTarget, setCancelTarget] = useState(null);

  return (
    <>
      <BookingsViewModal
        isOpen={Boolean(booking)}
        booking={booking}
        readOnly={!canManage}
        onClose={onClose}
        onReschedule={(b) => {
          onClose();
          setRescheduleTarget({ booking: b, fromView: true });
        }}
        onCancel={(b) => {
          onClose();
          setCancelTarget({ booking: b, fromView: true });
        }}
      />

      <BookingsRescheduleModal
        isOpen={Boolean(rescheduleTarget)}
        booking={rescheduleTarget?.booking || null}
        fromView={Boolean(rescheduleTarget?.fromView)}
        onClose={() => setRescheduleTarget(null)}
        onBack={() => {
          onReopen?.(rescheduleTarget.booking);
          setRescheduleTarget(null);
        }}
        onConfirmReschedule={async ({ booking: b, date, startTime, reason, notes }) => {
          await rescheduleBooking(b, { date, startTime, reason, notes });
          await onChanged?.();
        }}
      />

      <BookingsCancelModal
        isOpen={Boolean(cancelTarget)}
        booking={cancelTarget?.booking || null}
        fromView={Boolean(cancelTarget?.fromView)}
        onClose={() => setCancelTarget(null)}
        onBack={() => {
          onReopen?.(cancelTarget.booking);
          setCancelTarget(null);
        }}
        onConfirmCancel={async ({ booking: b, reason, notes }) => {
          await cancelBooking(b, { reason, notes });
          await onChanged?.();
        }}
      />
    </>
  );
}