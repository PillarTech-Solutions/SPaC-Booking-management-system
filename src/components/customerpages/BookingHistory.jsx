import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarClock, Ban, Eye } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
// Same modals as the admin Bookings page (customer mode)
import BookingsViewModal from "../adminpages/BookingsViewModal";
import BookingsRescheduleModal from "../adminpages/BookingsRescheduleModal";
import BookingsCancelModal from "../adminpages/BookingsCancelModal";
// Customer success pop-ups (shown after a reschedule / cancellation)
import ModalRescheduleConfirmation from "./ModalRescheduleConfirmation";
import ModalCancellationConfirmation from "./ModalCancellationConfirmation";
// ⚠ Adjust if this file is not 3 folders below the project root
import {
  fetchMyBookings,
  customerCancelBooking,
  customerRescheduleBooking,
} from "../../../lib/bookingService";

/* ------------------------------------------------------------------ */
/* Formatting helpers (Manila time, whatever the viewer's timezone)    */
/* ------------------------------------------------------------------ */
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

const manilaParts = (date) => {
  const m = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return { month: MONTHS[m.getUTCMonth()], day: m.getUTCDate(), year: m.getUTCFullYear() };
};
const fmtDateLong = (d) =>
  d.toLocaleDateString("en-US", { timeZone: "Asia/Manila", month: "long", day: "numeric", year: "numeric" });
const fmtTime = (d) =>
  d.toLocaleTimeString("en-US", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" });
const fmtRange = (s, e) => `${fmtTime(s)} - ${fmtTime(e)}`;
const peso = (n) => `₱${Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

// "Reserved" also shows bookings that are playing right now (On-going)
const FILTERS = ["All", "Reserved", "Completed", "Cancelled"];
const matchesFilter = (b, filter) =>
  filter === "All" || b.status === filter || (filter === "Reserved" && b.status === "On-going");

/* Same button styles as the admin Bookings modals */
const BTN_BASE =
  "inline-flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-1.5 rounded-full font-bold text-xs sm:text-sm active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap";
const BTN = {
  outline: `${BTN_BASE} bg-[#ffffff] border border-[#121212] text-[#121212] hover:bg-[#fbfaf1] shadow-2xs`,
  danger: `${BTN_BASE} bg-[#C42B2B] text-white hover:bg-[#a82424] shadow-xs`,
  primary: `${BTN_BASE} bg-[#ccff00] text-[#121212] hover:bg-[#b8e600] shadow-xs`,
  dark: `${BTN_BASE} bg-[#121212] text-[#ccff00] hover:bg-black shadow-xs`,
};

function ViewButton({ onClick }) {
  return (
    <button type="button" className={BTN.outline} onClick={onClick}>
      <Eye className="w-3.5 h-3.5 stroke-[2] text-[#121212]" />
      <span>View Details</span>
    </button>
  );
}

function RescheduleButton({ onClick, dark = false }) {
  return (
    <button type="button" className={dark ? BTN.dark : BTN.outline} onClick={onClick}>
      <CalendarClock className={`w-3.5 h-3.5 stroke-[2] ${dark ? "text-[#ccff00]" : "text-[#121212]"}`} />
      <span>Reschedule</span>
    </button>
  );
}

function CancelButton({ onClick }) {
  return (
    <button type="button" className={BTN.danger} onClick={onClick}>
      <Ban className="w-3.5 h-3.5 stroke-[2.2] text-white" />
      <span>Cancel Booking</span>
    </button>
  );
}

const statusClass = (status) => `bk-status--${String(status).toLowerCase().replace(/[^a-z]/g, "")}`;

/* ------------------------------------------------------------------ */
/* Overlay for the success pop-ups (Esc / outside click closes)        */
/* ------------------------------------------------------------------ */
function Overlay({ onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return createPortal(
    <div className="bk bk-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      {children}
    </div>,
    document.body
  );
}

/* ------------------------------------------------------------------ */
/* Booking row                                                         */
/* ------------------------------------------------------------------ */
function BookingRow({ booking, onView, onReschedule, onCancel }) {
  const { month, day, year } = manilaParts(booking.start);

  return (
    <article className="bk-card bk-card--rental">
      <div className="bk-card-date">
        <span className="bk-card-month">{month}</span>
        <span className="bk-card-day">{day}</span>
        <span className="bk-card-year">{year}</span>
      </div>

      <div className="bk-card-main">
        <span className="bk-type bk-type--rental">Court Rental</span>
        <p className="bk-card-time">{fmtRange(booking.start, booking.end)}</p>
        <p className="bk-card-ref">Ref: {booking.ref}</p>
      </div>

      <p className="bk-card-price">{peso(booking.raw.total_amount)}</p>
      <span className={`bk-status ${statusClass(booking.status)}`}>
        <i aria-hidden="true" />
        {booking.status}
      </span>

      <div className="bk-card-actions">
        <ViewButton onClick={() => onView(booking)} />
        {booking.canReschedule && !booking.needsAttention && (
          <RescheduleButton onClick={() => onReschedule(booking)} />
        )}
        {booking.canCancel && <CancelButton onClick={() => onCancel(booking)} />}
      </div>

      {booking.changesClosed && (
        <p className="bk-card-hint">Changes close 24 hours before your schedule.</p>
      )}
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export default function BookingHistory({ onNavigateToTab }) {
  const { user } = useAuth();

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [filter, setFilter] = useState("All");

  // Admin modals (customer mode)
  const [viewBooking, setViewBooking] = useState(null);
  const [rescheduleTarget, setRescheduleTarget] = useState(null); // { booking, fromView }
  const [cancelTarget, setCancelTarget] = useState(null); // { booking, fromView }

  // Success pop-up: { kind: "reschedule" | "cancel", ...props }
  const [confirmation, setConfirmation] = useState(null);

  const loadBookings = useCallback(
    async ({ silent = false } = {}) => {
      if (!user?.id) return;
      if (!silent) setLoading(true);
      setLoadError("");
      try {
        setBookings(await fetchMyBookings(user.id));
      } catch (err) {
        setLoadError(err.message);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [user?.id]
  );

  useEffect(() => {
    loadBookings();
    // keep statuses fresh (Reserved -> On-going -> Completed)
    const timer = setInterval(() => loadBookings({ silent: true }), 60000);
    return () => clearInterval(timer);
  }, [loadBookings]);

  // Upcoming first (soonest on top), then past bookings (newest on top)
  const sorted = useMemo(() => {
    const upcoming = bookings
      .filter((b) => b.status === "Reserved" || b.status === "On-going")
      .sort((a, b) => a.start - b.start);
    const past = bookings
      .filter((b) => b.status !== "Reserved" && b.status !== "On-going")
      .sort((a, b) => b.start - a.start);
    return [...upcoming, ...past];
  }, [bookings]);

  const attention = sorted.filter((b) => b.needsAttention);
  const visible = sorted.filter((b) => matchesFilter(b, filter));

  // ---- Modal handlers ----------------------------------------------------
  const openReschedule = (booking, fromView = false) => {
    setViewBooking(null);
    setRescheduleTarget({ booking, fromView });
  };
  const openCancel = (booking, fromView = false) => {
    setViewBooking(null);
    setCancelTarget({ booking, fromView });
  };

  // Errors are thrown back so the modal shows them and stays open
  const handleConfirmReschedule = async ({ booking, date, startTime, reason, notes }) => {
    const slot = await customerRescheduleBooking(booking, { date, startTime, reason, notes });
    await loadBookings({ silent: true });
    setConfirmation({
      kind: "reschedule",
      newDate: fmtDateLong(slot.start),
      newTime: fmtRange(slot.start, slot.end),
      refNo: booking.ref,
    });
  };

  const handleConfirmCancel = async ({ booking, reason, notes }) => {
    await customerCancelBooking(booking, { reason, notes });
    await loadBookings({ silent: true });
    setConfirmation({
      kind: "cancel",
      date: fmtDateLong(booking.start),
      time: fmtRange(booking.start, booking.end),
      refNo: booking.ref,
    });
  };

  const closeConfirmation = () => setConfirmation(null);

  // ---- Render ------------------------------------------------------------
  return (
    <main className="bk bk-page">
      <style>{css}</style>

      <h1 className="bk-page-title">My Bookings</h1>
      <p className="bk-page-sub">View and manage your past and upcoming bookings.</p>

      {/* Only shown when something needs action (e.g. the court cancelled a booking because of rain) */}
      {attention.length > 0 && (
        <section aria-labelledby="bk-attn">
          <h3 id="bk-attn" className="bk-section-title">Needs Your Attention</h3>
          <div className="bk-attention-list">
            {attention.map((b) => (
              <div key={b.id} className="bk-attention">
                <div className="bk-attention-icon" aria-hidden="true">
                  <svg width="48" height="48" viewBox="0 0 48 48">
                    <path d="M24 6 L44 40 H4 Z" fill="#fff" stroke="#fff" strokeWidth="4" strokeLinejoin="round" />
                    <rect x="22" y="17" width="4" height="12" rx="1" fill="#e8a21e" />
                    <rect x="22" y="32" width="4" height="4" rx="1" fill="#e8a21e" />
                  </svg>
                </div>
                <div className="bk-attention-main">
                  <span className="bk-type bk-type--rental">Court Rental</span>
                  <p className="bk-attention-when">
                    {b.date} · {fmtRange(b.start, b.end)} · Ref: {b.ref}
                  </p>
                  <p className="bk-attention-note">
                    This booking was cancelled by the court{b.cancelReason ? ` (${b.cancelReason})` : ""}. Reschedule
                    to a new time at no extra charge.
                  </p>
                </div>
                <div className="bk-attention-actions">
                  <RescheduleButton dark onClick={() => openReschedule(b)} />
                  <ViewButton onClick={() => setViewBooking(b)} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="bk-filters" role="tablist" aria-label="Filter bookings">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            className={`bk-filter ${filter === f ? "is-active" : ""}`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      <h3 className="bk-section-title">Booking Log</h3>
      <div className="bk-list">
        {loading && <p className="bk-empty">Loading your bookings...</p>}

        {!loading && loadError && (
          <div className="bk-empty bk-empty--error">
            <p>{loadError}</p>
            <button type="button" className={BTN.outline} onClick={() => loadBookings()}>
              Try again
            </button>
          </div>
        )}

        {/* No bookings at all yet */}
        {!loading && !loadError && bookings.length === 0 && (
          <div className="bk-empty">
            <p className="bk-empty-title">No bookings yet</p>
            <p>Bookings you make while logged in will show up here.</p>
            <button type="button" className={BTN.primary} onClick={() => onNavigateToTab?.("HOME")}>
              Book a court
            </button>
          </div>
        )}

        {/* Has bookings, but none match the selected filter */}
        {!loading && !loadError && bookings.length > 0 && visible.length === 0 && (
          <p className="bk-empty">No {filter.toLowerCase()} bookings.</p>
        )}

        {!loading &&
          !loadError &&
          visible.map((b) => (
            <BookingRow
              key={b.id}
              booking={b}
              onView={setViewBooking}
              onReschedule={(booking) => openReschedule(booking)}
              onCancel={(booking) => openCancel(booking)}
            />
          ))}
      </div>

      {/* Same modals as the admin Bookings page, in customer mode */}
      <BookingsViewModal
        isOpen={Boolean(viewBooking)}
        booking={viewBooking}
        variant="customer"
        onClose={() => setViewBooking(null)}
        onReschedule={(b) => openReschedule(b, true)}
        onCancel={(b) => openCancel(b, true)}
      />

      <BookingsRescheduleModal
        isOpen={Boolean(rescheduleTarget)}
        booking={rescheduleTarget?.booking || null}
        fromView={Boolean(rescheduleTarget?.fromView)}
        variant="customer"
        onClose={() => setRescheduleTarget(null)}
        onBack={() => {
          setViewBooking(rescheduleTarget.booking);
          setRescheduleTarget(null);
        }}
        onConfirmReschedule={handleConfirmReschedule}
      />

      <BookingsCancelModal
        isOpen={Boolean(cancelTarget)}
        booking={cancelTarget?.booking || null}
        fromView={Boolean(cancelTarget?.fromView)}
        variant="customer"
        onClose={() => setCancelTarget(null)}
        onBack={() => {
          setViewBooking(cancelTarget.booking);
          setCancelTarget(null);
        }}
        onConfirmCancel={handleConfirmCancel}
      />

      {confirmation && (
        <Overlay onClose={closeConfirmation}>
          {confirmation.kind === "reschedule" ? (
            <ModalRescheduleConfirmation {...confirmation} onClose={closeConfirmation} />
          ) : (
            <ModalCancellationConfirmation {...confirmation} onClose={closeConfirmation} />
          )}
        </Overlay>
      )}
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Styles (page + the two success pop-ups)                             */
/* ------------------------------------------------------------------ */
const css = `
@import url("https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap");

.bk {
  --lime: #ccff00; --ink: #111111; --muted: #6b6b45; --line: #d9d8c3;
  --cream: #f9f8ee; --cream-deep: #efede0; --red: #c62828; --yellow: #fff176;
  font-family: "Be Vietnam Pro", system-ui, -apple-system, sans-serif;
  color: var(--ink);
}
.bk *, .bk *::before, .bk *::after { box-sizing: border-box; font-family: inherit; }
.bk h1, .bk h2, .bk h3, .bk h4, .bk p { margin: 0; }

.bk-btn {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 7px 14px; border-radius: 999px; border: 1.5px solid var(--ink);
  background: #fff; color: var(--ink);
  font-size: 13px; font-weight: 600; line-height: 1.2; white-space: nowrap; cursor: pointer;
  transition: filter .15s;
}
.bk-btn:hover:not(:disabled) { filter: brightness(.95); }
.bk-btn:focus-visible { outline: 3px solid var(--lime); outline-offset: 2px; box-shadow: 0 0 0 2px var(--ink); }
.bk-btn:disabled { opacity: .45; cursor: not-allowed; }
.bk-btn--dark { background: var(--ink); color: var(--lime); }
.bk-btn--danger { background: var(--red); border-color: var(--red); color: #fff; }
.bk-btn--lime { background: var(--lime); border-color: var(--lime); color: var(--ink); }
.bk-btn--gray { background: #d1d3db; border-color: #d1d3db; }
.bk-btn--lg { padding: 11px 22px; font-size: 15px; font-weight: 700; }
.bk-btn--block { width: 100%; border-radius: 12px; }

.bk-type { display: inline-block; padding: 3px 18px; border-radius: 8px; font-size: 13px; font-weight: 600; }
.bk-type--rental { background: var(--lime); color: var(--ink); }

.bk-status { display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px; border-radius: 999px; font-size: 14px; font-weight: 600; white-space: nowrap; }
.bk-status i { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.bk-status--reserved { background: var(--yellow); color: #9a8500; }
.bk-status--ongoing { background: #bfdbfe; color: #1d4ed8; }
.bk-status--completed { background: #b9f6a0; color: #2e8b2e; }
.bk-status--cancelled { background: #ffd6d6; color: var(--red); }
.bk-status--noshow { background: #e5e7eb; color: #4b5563; }

.bk-page { padding: 0 0 24px; background: transparent; }
.bk-page-title { font-size: 30px; font-weight: 700; line-height: 1.2; }
.bk-page-sub { font-size: 15px; margin-top: 4px; }
.bk-section-title { font-size: 16px; font-weight: 600; color: #666; margin: 28px 0 10px; }

.bk-attention-list { display: flex; flex-direction: column; gap: 12px; }
.bk-attention { display: flex; align-items: center; gap: 20px; padding: 14px 22px; border-radius: 16px; background: #fff1f1; border: 1px solid #e8b84a; }
.bk-attention-icon { flex: none; width: 56px; height: 56px; border-radius: 50%; background: #e8a21e; display: grid; place-items: center; }
.bk-attention-icon svg { width: 36px; height: 36px; }
.bk-attention-main { flex: 1; min-width: 0; }
.bk-attention-when { font-size: 17px; font-weight: 600; margin-top: 6px; }
.bk-attention-note { font-size: 13px; color: var(--red); margin-top: 3px; }
.bk-attention-actions { display: flex; gap: 8px; }

.bk-filters { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 28px; }
.bk-filter { padding: 8px 22px; border-radius: 999px; cursor: pointer; border: 1.5px solid #bdbdb0; background: #fff; color: var(--muted); font-size: 15px; font-weight: 600; }
.bk-filter.is-active { background: var(--ink); border-color: var(--ink); color: var(--lime); }
.bk-filter:focus-visible { outline: 3px solid var(--lime); box-shadow: 0 0 0 2px var(--ink); }

.bk-list { display: flex; flex-direction: column; gap: 16px; }
.bk-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 28px 20px; text-align: center; color: var(--muted); font-size: 15px; background: #fff; border: 1px dashed var(--line); border-radius: 18px; }
.bk-empty-title { font-size: 18px; font-weight: 700; color: var(--ink); }
.bk-empty--error { color: var(--red); border-color: #f3b4b4; background: #fff1f1; }

.bk-card { --accent: #f6e03d; position: relative; overflow: hidden; display: flex; flex-wrap: wrap; align-items: center; gap: 0 20px; padding: 16px 24px 16px 16px; background: #fff; border: 1px solid var(--line); border-radius: 18px; }
.bk-card::before { content: ""; position: absolute; inset: 0 auto 0 0; width: 6px; background: var(--accent); }
.bk-card--rental { --accent: #f6e03d; }
.bk-card-date { flex: none; width: 64px; display: flex; flex-direction: column; align-items: center; margin-left: 6px; }
.bk-card-month { font-size: 13px; font-weight: 600; color: #444; }
.bk-card-day { font-size: 38px; font-weight: 700; line-height: 1; }
.bk-card-year { font-size: 13px; color: #555; margin-top: 3px; }
.bk-card-main { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: flex-start; }
.bk-card-time { font-size: 17px; font-weight: 600; margin-top: 10px; padding-left: 10px; }
.bk-card-ref { font-size: 13px; padding-left: 10px; margin-top: 2px; }
.bk-card-price { font-size: 19px; font-weight: 700; white-space: nowrap; }
.bk-card-actions { display: flex; gap: 8px; }
.bk-card-hint { flex-basis: 100%; text-align: right; font-size: 12px; color: #6b7280; margin-top: 6px; }

/* Success pop-ups */
.bk-overlay { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; padding: 16px; background: rgba(0,0,0,.55); overflow-y: auto; }
.bk-modal { width: 100%; max-height: calc(100vh - 32px); display: flex; flex-direction: column; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,.35); }
.bk-modal--md { max-width: 540px; }
.bk-modal--sm { max-width: 360px; background: #fdfdfb; }
.bk-modal-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid var(--line); }
.bk-modal-header h2 { font-size: 18px; font-weight: 700; }
.bk-close { border: 0; background: transparent; color: #5b6475; cursor: pointer; padding: 4px; border-radius: 8px; display: grid; }
.bk-close:hover { color: #000; }
.bk-close:focus-visible { outline: 3px solid var(--lime); box-shadow: 0 0 0 2px var(--ink); }
.bk-modal-body { padding: 16px; overflow-y: auto; }
.bk-modal-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px; border-top: 1px solid var(--line); }
.bk-footer-group { display: flex; gap: 8px; }
.bk-success { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 14px 8px 4px; }
.bk-success-icon { width: 80px; height: 80px; }
.bk-success h2 { font-size: 22px; font-weight: 700; margin-top: 18px; }
.bk-success-msg { font-size: 14px; margin-top: 6px; }
.bk-success-rows { width: 100%; margin: 18px 0; padding: 14px 16px; border: 1.5px solid var(--ink); border-radius: 14px; display: flex; flex-direction: column; gap: 10px; }
.bk-success-rows div { display: flex; justify-content: space-between; gap: 12px; font-size: 14px; }
.bk-success-rows dt, .bk-success-rows dd { margin: 0; }
.bk-success-rows dd { text-align: right; }

@media (max-width: 960px) {
  .bk-card { gap: 12px 16px; }
  .bk-card-main { flex-basis: calc(100% - 100px); }
  .bk-card-actions { flex-basis: 100%; flex-wrap: wrap; }
  .bk-card-hint { text-align: left; margin-top: 0; }
  .bk-attention { flex-wrap: wrap; }
  .bk-attention-actions { flex-basis: 100%; }
}
@media (max-width: 600px) {
  .bk-page-title { font-size: 26px; }
  .bk-page-sub { font-size: 14px; }
  .bk-filter { padding: 7px 16px; font-size: 14px; }
  .bk-modal-footer { flex-wrap: wrap; }
  .bk-footer-group { width: 100%; }
  .bk-footer-group .bk-btn { flex: 1; padding-inline: 12px; }
  .bk-btn--lg { padding: 10px 18px; font-size: 14px; }
}
`;