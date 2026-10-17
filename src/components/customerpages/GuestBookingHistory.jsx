import { useState } from "react";
// ⚠ Adjust if this file is not 3 folders below the project root
import { findBookingByReference } from "../../../lib/bookingService";
// Same details modal as the admin Bookings page (read-only for guests)
import BookingsViewModal from "../adminpages/BookingsViewModal";

/**
 * GuestBookingHistory ("Find your booking")
 * Guests search with their reference number only (temporary, until OTP is added).
 * For privacy, the result shows no contact details and a shortened name.
 *
 * Props:
 *  - backgroundImage: URL of the court photo shown behind the hero
 */

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function manilaParts(date) {
  // read the Manila calendar date regardless of the viewer's computer timezone
  const m = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return { month: MONTHS[m.getUTCMonth()], day: m.getUTCDate(), year: m.getUTCFullYear() };
}

const peso = (n) => `₱${Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

export default function GuestBookingHistory({ backgroundImage = "/images/court-hero.jpg" }) {
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(undefined); // undefined = not searched, null = not found
  const [viewOpen, setViewOpen] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setViewOpen(false);
    if (!reference.trim()) {
      setError("Please enter your reference number.");
      return;
    }
    setLoading(true);
    try {
      const booking = await findBookingByReference(reference);
      setResult(booking);
    } catch (err) {
      setError(err.message);
      setResult(undefined);
    } finally {
      setLoading(false);
    }
  };

  const parts = result?.start ? manilaParts(result.start) : null;
  const statusClass = result ? `gbh-status--${String(result.status).toLowerCase().replace(/[^a-z]/g, "")}` : "";

  return (
    <>
      <style>{css}</style>

      {/* HERO + SEARCH */}
      <section className="fyb-hero" style={{ "--fyb-bg": `url(${backgroundImage})` }}>
        <div className="fyb-inner">
          <p className="fyb-eyebrow">BOOKING LOOKUP</p>
          <h1 className="fyb-title">Find your booking</h1>
          <p className="fyb-subtitle">
            Enter the reference number shown on your receipt to search for your booking.
          </p>

          <form className="fyb-form" onSubmit={handleSubmit} role="search">
            <div className="fyb-search">
              <input
                type="text"
                className="fyb-input"
                placeholder="Enter reference number here (e.g. CR-1001)"
                aria-label="Reference number"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
              <button type="submit" className="fyb-search-btn" aria-label="Search booking" disabled={loading}>
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="7.5" />
                  <line x1="16.5" y1="16.5" x2="21" y2="21" />
                </svg>
              </button>
            </div>

            {loading && <p className="fyb-loading">Searching...</p>}
          </form>
        </div>
      </section>

      {/* RESULTS */}
      <section className="gbh">
        {error && <p className="gbh-message gbh-message--error">{error}</p>}

        {result === null && !error && (
          <p className="gbh-message">
            No booking found. Please check your reference number and try again.
          </p>
        )}

        {result && (
          <>
            <h3 className="gbh-section-title">Your Booking</h3>

            <article className="gbh-card">
              <div className="gbh-card-date">
                <span className="gbh-card-month">{parts?.month}</span>
                <span className="gbh-card-day">{parts?.day}</span>
                <span className="gbh-card-year">{parts?.year}</span>
              </div>

              <div className="gbh-card-main">
                <span className="gbh-type">Court Rental</span>
                <p className="gbh-card-time">{result.time}</p>
                <p className="gbh-card-ref">Ref: {result.ref}</p>
              </div>

              <p className="gbh-card-price">{peso(result.raw.total_amount)}</p>

              <span className={`gbh-status ${statusClass}`}>
                <i aria-hidden="true" />
                {result.status}
              </span>

              <div className="gbh-card-actions">
                <button type="button" className="gbh-btn" onClick={() => setViewOpen(true)}>
                  View Details
                </button>
              </div>
            </article>

            <p className="gbh-help">
              Need to reschedule or cancel? Please contact the court at least 24 hours before your schedule and
              mention your reference number.
            </p>
          </>
        )}
      </section>

      <BookingsViewModal
        isOpen={viewOpen}
        onClose={() => setViewOpen(false)}
        booking={result || null}
        readOnly
      />
    </>
  );
}

const css = `
@import url("https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap");

/* ---------- HERO ---------- */
.fyb-hero {
  --fyb-lime: #ccff00;
  --fyb-parent-pt: 20px;
  font-family: "Be Vietnam Pro", system-ui, -apple-system, sans-serif;
  position: relative;
  width: 100vw;
  margin-left: calc(50% - 50vw);
  margin-right: calc(50% - 50vw);
  margin-top: calc(var(--fyb-parent-pt) * -1);
  min-height: 380px;
  padding: 24px 20px 56px;
  display: flex;
  justify-content: center;
  text-align: center;
  color: #fff;
  background-color: #0d2b4a;
  background-image: linear-gradient(rgba(0, 0, 0, 0.35), rgba(0, 0, 0, 0.35)), var(--fyb-bg);
  background-size: cover;
  background-position: center;
  box-sizing: border-box;
}
@media (min-width: 640px) {
  .fyb-hero { --fyb-parent-pt: 24px; }
}
.fyb-hero *, .fyb-hero *::before, .fyb-hero *::after { box-sizing: border-box; font-family: inherit; }
.fyb-inner { width: 100%; max-width: 820px; }
.fyb-eyebrow { margin: 0; font-size: 18px; font-weight: 500; letter-spacing: 0.01em; color: var(--fyb-lime); }
.fyb-title { margin: 4px 0 0; font-size: clamp(36px, 6vw, 60px); font-weight: 700; line-height: 1.15; color: #fff; }
.fyb-subtitle { margin: 24px auto 28px; max-width: 720px; font-size: clamp(15px, 2vw, 19px); font-weight: 400; line-height: 1.5; color: #fff; }

.fyb-form { display: flex; flex-direction: column; gap: 12px; }
.fyb-search { position: relative; display: flex; align-items: center; width: 100%; height: 56px; background: #fff; border-radius: 12px; }
.fyb-input { flex: 1; min-width: 0; height: 100%; padding: 0 64px 0 20px; border: 0; border-radius: 12px; background: transparent; font-size: 17px; color: #1a1a1a; outline: none; }
.fyb-input::placeholder { color: #6b6b6b; }
.fyb-search:focus-within { box-shadow: 0 0 0 3px var(--fyb-lime); }
.fyb-search-btn { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); display: grid; place-items: center; width: 40px; height: 40px; padding: 0; border: 0; border-radius: 8px; background: transparent; color: #444; cursor: pointer; }
.fyb-search-btn:hover { color: #000; }
.fyb-loading { margin: 4px 0 0; font-size: 14px; color: #fff; }
.fyb-submit { align-self: center; margin-top: 4px; padding: 11px 32px; border: 0; border-radius: 999px; background: var(--fyb-lime); color: #111; font-size: 15px; font-weight: 700; cursor: pointer; }
.fyb-submit:hover:not(:disabled) { filter: brightness(.95); }
.fyb-submit:disabled, .fyb-search-btn:disabled { opacity: .6; cursor: wait; }

@media (max-width: 600px) {
  .fyb-hero { min-height: 320px; padding-bottom: 40px; }
  .fyb-search { height: 52px; }
  .fyb-input { font-size: 15px; }
}

/* ---------- RESULTS (same look as the logged-in Booking History cards) ---------- */
.gbh {
  --lime: #ccff00; --ink: #111111; --muted: #6b6b45; --line: #d9d8c3; --cream: #f9f8ee; --red: #c62828; --yellow: #fff176;
  font-family: "Be Vietnam Pro", system-ui, -apple-system, sans-serif;
  color: var(--ink);
  max-width: 1000px;
  margin: 0 auto;
  padding: 28px 0 24px;
}
.gbh *, .gbh *::before, .gbh *::after { box-sizing: border-box; font-family: inherit; }
.gbh h3, .gbh h4, .gbh p { margin: 0; }

.gbh-section-title { font-size: 16px; font-weight: 600; color: #666; margin: 0 0 10px; }
.gbh-message { padding: 18px 20px; border-radius: 14px; background: #fff; border: 1px solid var(--line); font-size: 15px; color: var(--muted); text-align: center; }
.gbh-message--error { background: #fff1f1; border-color: #f3b4b4; color: var(--red); }

.gbh-card { position: relative; overflow: hidden; display: flex; align-items: center; gap: 20px; padding: 16px 24px 16px 16px; background: #fff; border: 1px solid var(--line); border-radius: 18px; }
.gbh-card::before { content: ""; position: absolute; inset: 0 auto 0 0; width: 6px; background: #f6e03d; }
.gbh-card-date { flex: none; width: 64px; display: flex; flex-direction: column; align-items: center; margin-left: 6px; }
.gbh-card-month { font-size: 13px; font-weight: 600; color: #444; }
.gbh-card-day { font-size: 38px; font-weight: 700; line-height: 1; }
.gbh-card-year { font-size: 13px; color: #555; margin-top: 3px; }
.gbh-card-main { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: flex-start; }
.gbh-type { display: inline-block; padding: 3px 18px; border-radius: 8px; font-size: 13px; font-weight: 600; background: var(--lime); color: var(--ink); }
.gbh-card-time { font-size: 17px; font-weight: 600; margin-top: 10px; padding-left: 10px; }
.gbh-card-ref { font-size: 13px; padding-left: 10px; margin-top: 2px; }
.gbh-card-price { font-size: 19px; font-weight: 700; white-space: nowrap; }
.gbh-card-actions { display: flex; gap: 8px; }

.gbh-status { display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px; border-radius: 999px; font-size: 14px; font-weight: 600; white-space: nowrap; }
.gbh-status i { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.gbh-status--reserved { background: var(--yellow); color: #9a8500; }
.gbh-status--ongoing { background: #bfdbfe; color: #1d4ed8; }
.gbh-status--completed { background: #b9f6a0; color: #2e8b2e; }
.gbh-status--cancelled { background: #ffd6d6; color: var(--red); }

.gbh-btn { display: inline-flex; align-items: center; justify-content: center; padding: 7px 14px; border-radius: 999px; border: 1.5px solid var(--ink); background: #fff; color: var(--ink); font-size: 13px; font-weight: 600; white-space: nowrap; cursor: pointer; }
.gbh-btn:hover { filter: brightness(.95); }

.gbh-help { margin-top: 12px; font-size: 13px; color: var(--muted); }

@media (max-width: 960px) {
  .gbh-card { flex-wrap: wrap; gap: 12px 16px; }
  .gbh-card-main { flex-basis: calc(100% - 100px); }
  .gbh-card-actions { flex-basis: 100%; }
}
`;