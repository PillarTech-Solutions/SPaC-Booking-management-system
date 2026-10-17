import React, { useState, useRef, useEffect } from 'react';
import { Info, Sun, Moon, Users, ArrowRight } from 'lucide-react';
import BookingStep1 from './BookingStep1';
import BookingStep2 from './BookingStep2';
import BookingStep3 from './BookingStep3';
import PaymentPage from './PaymentPage';
import Receipt from './Receipt';
// ⚠ Adjust if this file is not 3 folders below the project root
import {
  calculatePrice,
  parseHour,
  verifyPayMongoPayment,
  toReceiptProps,
} from '../../../lib/bookingService';
import { useSiteSettings } from '../../hooks/useSiteSettings';

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------
const HERO_IMAGE = '/bgpic.jpg';

const PREVIEW_IMAGES = [
  {
    id: 1,
    src: 'https://images.unsplash.com/photo-1599474924187-334a4ae5bd3c?auto=format&fit=crop&w=800&q=80',
    alt: 'Pickleball player ready to serve',
  },
  {
    id: 2,
    src: 'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=800&q=80',
    alt: 'Pickleball paddles and ball near net',
  },
  {
    id: 3,
    src: 'https://images.unsplash.com/photo-1622163642998-1ea32b0bbc67?auto=format&fit=crop&w=800&q=80',
    alt: 'Pickleball player with visor under blue sky',
  },
  {
    id: 4,
    src: 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&w=800&q=80',
    alt: 'Players tapping paddles over the net',
  },
];

const LIME = '#ccff00';
const INK = '#121212';
const CARD_BORDER = '#A6A887';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------
function PaddleIcon({ className = 'w-9 h-9', color = INK }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <path
        d="M28 6C20 6 15 11 15 20C15 24 17 27 20 29L14 41C13.5 42 14 43 15 43H19C19.5 43 20 42.5 20.5 42L26.5 30C29 30 32 28 33 25C35 21 35 15 35 12C35 8 32 6 28 6Z"
        fill={color}
      />
    </svg>
  );
}

function BallIcon({ className = 'w-9 h-9', color = INK, hole = '#fff' }) {
  const dots = [
    [24, 12], [24, 36], [12, 24], [36, 24],
    [16, 16], [32, 16], [16, 32], [32, 32], [24, 24],
  ];
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <circle cx="24" cy="24" r="21" fill={color} />
      {dots.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="2.6" fill={hole} />
      ))}
    </svg>
  );
}

function CrossedPaddlesIcon({ className = 'w-6 h-6' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="7" cy="7" r="5" stroke={LIME} strokeWidth="2" />
      <path d="M10.5 10.5L18 18" stroke={LIME} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="17" cy="7" r="5" stroke={LIME} strokeWidth="2" />
      <path d="M13.5 10.5L6 18" stroke={LIME} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function GearCard({ icon, name, price }) {
  return (
    <div
      className="flex-1 bg-white rounded-2xl border px-5 sm:px-6 py-4 flex items-center justify-between gap-3"
      style={{ borderColor: CARD_BORDER }}
    >
      <div className="flex items-center gap-4">
        {icon}
        <h3 className="text-2xl sm:text-[28px] font-bold text-[#121212] leading-tight">{name}</h3>
      </div>
      <div className="text-right">
        <div className="text-2xl sm:text-[26px] font-bold text-[#121212] leading-none">{price}</div>
        <div className="text-xs sm:text-sm text-neutral-700 mt-1">per session</div>
      </div>
    </div>
  );
}

function freshBookingData() {
  const now = new Date();
  return {
    day: now.getDate(),
    month: MONTHS[now.getMonth()],
    year: now.getFullYear(),
    startTime: '',
    duration: 1, // bumped to 2 automatically when a daytime start is picked
    players: 1,
    paddles: 0,
    balls: 0,
    bookingType: 'Court Rental',
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
// customer: { name, email, phone } of the logged-in customer (null for guests).
// Passed from CustomerMainForm so the PaymentPage contact form is pre-filled.
export default function Home({ onNavigateToTab, setFocusMode, customer = null }) {
  // Hero image + business name are editable from the admin Settings page
  const { settings } = useSiteSettings();
  const heroImage = settings.banner_url || HERO_IMAGE;
  const businessName = settings.business_name || 'Saranay Pickleball Court';
  // 1, 2, 3, 'payment', 'verifying', 'receipt'
  const [currentStep, setCurrentStep] = useState(1);
  const [policyModalOpen, setPolicyModalOpen] = useState(false);

  const [bookingData, setBookingData] = useState(freshBookingData);

  // Filled after PayMongo confirms the payment
  const [receipt, setReceipt] = useState(null); // { bookingData, paymentDetails, calculatedTotal }
  const [paymentNotice, setPaymentNotice] = useState(null); // { type: 'error' | 'info', text }

  const bookingCardRef = useRef(null);

  const updateBookingData = (updates) => setBookingData((prev) => ({ ...prev, ...updates }));

  // ---- Dynamic total (same rules as admin + database) ----------------------
  const price = calculatePrice({
    startHour: bookingData.startTime ? parseHour(bookingData.startTime) : 6,
    duration: bookingData.duration || 1,
    players: bookingData.players ?? 1,
    paddles: bookingData.paddles ?? 0,
    balls: bookingData.balls ?? 0,
  });
  const calculatedTotal = price.total;

  // ---- Step handlers -------------------------------------------------------
  const scrollToBooking = () => {
    bookingCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleRestartBooking = () => {
    setReceipt(null);
    setBookingData(freshBookingData());
    setCurrentStep(1);
    setTimeout(scrollToBooking, 50);
  };

  // ---- Coming back from PayMongo (?payment=success&booking=...) -----------
  // Runs once. (In development React runs effects twice; the ref stops the second
  // run, which would otherwise find the URL already cleaned and leave the
  // "Confirming your payment..." screen stuck.)
  const paymentReturnHandled = useRef(false);
  useEffect(() => {
    if (paymentReturnHandled.current) return;
    const params = new URLSearchParams(window.location.search);
    const result = params.get('payment');
    const bookingId = params.get('booking');
    if (!result || !bookingId) return;
    paymentReturnHandled.current = true;

    // clean the URL so a refresh doesn't re-run this
    window.history.replaceState({}, '', window.location.pathname);

    if (result === 'cancelled') {
      setPaymentNotice({
        type: 'info',
        text: 'Payment was cancelled, so your booking was not completed. The time slot will be released shortly.',
      });
      return;
    }

    setCurrentStep('verifying');

    (async () => {
      // PayMongo can take a few seconds to mark the payment as paid, so check up to 5 times
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const res = await verifyPayMongoPayment(bookingId);
          if (res.status === 'confirmed') {
            setReceipt(toReceiptProps(res.booking, res.payment));
            setCurrentStep('receipt');
            return;
          }
          if (res.status === 'conflict') {
            setPaymentNotice({ type: 'error', text: res.error });
            setCurrentStep(1);
            return;
          }
        } catch (err) {
          setPaymentNotice({ type: 'error', text: err.message });
          setCurrentStep(1);
          return;
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      setPaymentNotice({
        type: 'error',
        text: "We couldn't confirm your payment yet. If you were charged, please contact the court with your reference number.",
      });
      setCurrentStep(1);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setFocusMode?.(currentStep === 'payment' || currentStep === 'receipt' || currentStep === 'verifying');
    window.scrollTo(0, 0);
    return () => setFocusMode?.(false);
  }, [currentStep, setFocusMode]);

  if (currentStep === 'payment') {
    return (
      <PaymentPage
        bookingData={bookingData}
        calculatedTotal={calculatedTotal}
        customer={customer}
        onBack={() => setCurrentStep(3)}
        onPaymentSuccess={(receiptProps) => {
          // used by the simulated payment mode (DEV)
          setReceipt(receiptProps);
          setCurrentStep('receipt');
        }}
      />
    );
  }

  if (currentStep === 'verifying') {
    return (
      <div
        style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}
        className="w-full flex flex-col items-center justify-center py-32 text-center"
      >
        <div className="w-12 h-12 rounded-full border-4 border-neutral-200 border-t-[#ccff00] animate-spin" />
        <h2 className="mt-6 text-xl font-bold text-[#121212]">Confirming your payment...</h2>
        <p className="mt-1 text-sm text-neutral-500">Please don't close this page.</p>
      </div>
    );
  }

  if (currentStep === 'receipt' && receipt) {
    return (
      <Receipt
        bookingData={receipt.bookingData}
        paymentDetails={receipt.paymentDetails}
        calculatedTotal={receipt.calculatedTotal}
        onBackToBooking={handleRestartBooking}
        onGoToBookings={handleRestartBooking}
      />
    );
  }

  return (
    <div
      style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}
      className="w-full min-w-0 flex flex-col gap-10 sm:gap-14 text-neutral-900"
    >
      <div className="relative">
        {/* 1. HERO */}
        <section className="relative left-1/2 -translate-x-1/2 w-screen -mt-6 sm:-mt-10 h-[300px] sm:h-[340px] md:h-[380px] bg-neutral-900 z-10">
          <img src={heroImage} alt={businessName} className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/25 to-black/55" />

          <div className="relative z-10 h-full flex flex-col items-center pt-14 sm:pt-20 px-4">
            <h1 className="text-white text-3xl sm:text-4xl md:text-[42px] font-bold tracking-tight uppercase text-center leading-tight">
              {businessName}
            </h1>

            <div className="mt-5 w-full max-w-[490px] flex items-center justify-center px-5 py-2.5 rounded-xl border border-white/90 text-white font-bold text-base sm:text-[17px] select-none">
              Court Rental
            </div>
          </div>
        </section>

        {/* 2. BOOKING STEPPER CARD */}
        <div
          ref={bookingCardRef}
          id="booking-card"
          className="relative z-20 w-[92%] md:w-[90%] max-w-[1000px] mx-auto -mt-16 sm:-mt-[68px] bg-white rounded-[28px] sm:rounded-[40px] px-4 sm:px-[29px] py-6 sm:py-8 shadow-[0px_10px_20px_rgba(0,0,0,0.25)]"
        >
          {paymentNotice && (
            <div
              className={`mb-6 rounded-2xl border px-4 py-3 text-sm flex items-start justify-between gap-3 ${
                paymentNotice.type === 'error'
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : 'bg-[#FBF9EE] border-[#EAE3C6] text-[#6B581B]'
              }`}
            >
              <span>{paymentNotice.text}</span>
              <button
                type="button"
                onClick={() => setPaymentNotice(null)}
                className="font-bold cursor-pointer shrink-0"
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          )}

          {currentStep === 1 && (
            <BookingStep1
              bookingData={bookingData}
              updateBookingData={updateBookingData}
              onNext={() => setCurrentStep(2)}
              calculatedTotal={calculatedTotal}
            />
          )}
          {currentStep === 2 && (
            <BookingStep2
              bookingData={bookingData}
              updateBookingData={updateBookingData}
              onBack={() => setCurrentStep(1)}
              onNext={() => setCurrentStep(3)}
              calculatedTotal={calculatedTotal}
            />
          )}
          {currentStep === 3 && (
            <BookingStep3
              bookingData={bookingData}
              onBack={() => setCurrentStep(2)}
              onConfirm={() => setCurrentStep('payment')}
              calculatedTotal={calculatedTotal}
            />
          )}
        </div>
      </div>

      <div className="flex flex-col gap-10 sm:gap-14 min-w-0">
        {/* 3. BOOKING POLICY */}
        <div className="w-full bg-[#FBF9EE] border border-[#EAE3C6] rounded-3xl px-6 sm:px-7 py-6">
          <div className="flex items-center gap-2.5 pb-3 border-b border-[#EBDFBF]">
            <div className="w-5 h-5 rounded-full bg-[#94812A] text-white flex items-center justify-center shrink-0">
              <Info className="w-3.5 h-3.5" strokeWidth={2.5} />
            </div>
            <h3 className="text-lg font-bold text-[#6E5B12]">Booking Policy</h3>
          </div>

          <div className="mt-4 space-y-2 text-sm sm:text-[15px] text-[#6B581B] font-light leading-relaxed">
            <p>1. Full payment is required to confirm your booking. All bookings are non-refundable.</p>
            <p>2. Cancellations and reschedules must be made at least 24 hours before your schedule (reschedules are subject to availability).</p>
            <p>3. Court Rental Rates: Daytime 6 AM – 4 PM ₱200/hr (minimum 2 hours) | Nighttime 4 PM – 2 AM ₱300/hr (1 hour allowed)</p>
            <p>4. Player limit: 1 hour - 4 pax | 2 hours - 8 pax | 3 hours and above - 12 pax (extra players ₱100 each)</p>
            <p>5. Rain: before your schedule, move your booking to another date. During play, see the full policy.</p>
          </div>

          <button
            type="button"
            onClick={() => setPolicyModalOpen(true)}
            className="mt-4 text-[#635117] font-semibold text-sm sm:text-[15px] underline hover:text-black cursor-pointer transition-colors"
          >
            View full policy
          </button>
        </div>

        {/* 4. PLAY YOUR WAY */}
        <section id="rates-section" className="w-full scroll-mt-[120px]">
          <h2 className="text-3xl sm:text-[38px] font-bold text-[#121212] tracking-tight leading-tight">Play Your Way</h2>
          <p className="text-base sm:text-xl text-[#121212] mt-1 font-normal">
            Straightforward rates for court rentals and gear.
          </p>

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch">
            {/* Court Rental */}
            <div
              className="lg:col-span-7 bg-white rounded-2xl border overflow-hidden flex flex-col"
              style={{ borderColor: CARD_BORDER }}
            >
              <div className="bg-[#121212] px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <CrossedPaddlesIcon className="w-6 h-6" />
                  <h3 className="text-xl sm:text-2xl font-bold text-[#ccff00]">Court Rental</h3>
                </div>
                <span className="text-xs sm:text-[13px] font-medium text-[#ccff00]">Monday - Sunday</span>
              </div>

              <div className="p-3 flex-1 flex flex-col justify-between">
                <div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {[
                      { Icon: Sun, label: 'Daytime', range: '6:00 AM - 4:00 PM', price: '₱200', min: 'min 2 hrs' },
                      { Icon: Moon, label: 'Nighttime', range: '4:00 PM - 2:00 AM', price: '₱300', min: 'min 1 hr' },
                    ].map(({ Icon, label, range, price: p, min }) => (
                      <div key={label} className="border border-neutral-300 rounded-lg px-2.5 py-2">
                        <div className="flex items-center gap-1 text-[10px] text-neutral-700">
                          <Icon className="w-3 h-3" />
                          <span>{label}</span>
                        </div>
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-lg sm:text-xl font-bold text-[#121212] leading-none">
                            {p}
                            <span className="text-sm font-medium">/hr</span>
                          </span>
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-[9px] sm:text-[10px] text-neutral-700 whitespace-nowrap">{range}</span>
                            <span className="bg-[#ccff00] text-black font-extrabold text-[9px] px-1.5 py-[1px] rounded">
                              {min}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 text-[11px] font-bold text-[#121212] uppercase tracking-wide">Capacity Rules</div>
                  <div className="grid grid-cols-3 gap-2.5 mt-1.5">
                    {[
                      ['1 hour', 4],
                      ['2 hours', 8],
                      ['3+ hours', 12],
                    ].map(([label, n]) => (
                      <div key={label} className="border border-neutral-300 rounded-lg py-1.5 text-center">
                        <div className="text-xs text-[#121212]">{label}</div>
                        <div className="text-2xl font-bold text-[#121212] leading-tight">{n}</div>
                        <div className="text-[9px] text-neutral-500">players</div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] text-neutral-600 mt-2">
                    <Users className="w-3.5 h-3.5" strokeWidth={1.8} />
                    <span>
                      Extra players: <strong className="text-[#121212]">₱100 per person</strong>
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={scrollToBooking}
                  className="mt-3 w-full bg-[#ccff00] hover:bg-[#b8e600] text-black font-bold py-2 rounded-lg text-sm sm:text-[15px] flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <span>Check Availability</span>
                  <ArrowRight className="w-5 h-5" strokeWidth={1.8} />
                </button>
              </div>
            </div>

            {/* Paddle & Ball rentals */}
            <div className="lg:col-span-5 flex flex-col gap-3.5">
              <GearCard icon={<PaddleIcon className="w-9 h-9" />} name="Paddle" price="₱100" />
              <GearCard icon={<BallIcon className="w-10 h-10" />} name="Ball" price="₱50" />
            </div>
          </div>
        </section>

        {/* 5. GALLERY PREVIEW */}
        <section className="w-full">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-5">
            <div>
              <h2 className="text-3xl sm:text-[38px] font-bold text-[#121212] tracking-tight leading-tight">
                A look at the court
              </h2>
              <p className="text-base sm:text-xl text-[#121212] mt-1 font-normal">
                Courts, facilities, events, and game day moments.
              </p>
            </div>

            <button
              type="button"
              onClick={() => onNavigateToTab && onNavigateToTab('GALLERY')}
              className="self-start sm:self-auto sm:w-[207px] border border-[#121212] hover:bg-[#121212] hover:text-[#ccff00] text-[#121212] font-bold text-sm px-5 py-2 rounded-lg transition-colors cursor-pointer"
            >
              View Full Gallery &gt;
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            {PREVIEW_IMAGES.map((img) => (
              <button
                type="button"
                key={img.id}
                onClick={() => onNavigateToTab && onNavigateToTab('GALLERY')}
                aria-label="Open gallery"
                className="block aspect-[6/5] rounded-xl overflow-hidden bg-neutral-200 cursor-pointer"
              >
                <img src={img.src} alt={img.alt} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* Booking Policy Modal */}
      {policyModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setPolicyModalOpen(false)}
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 sm:p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl relative"
          >
            <div className="flex items-center justify-between pb-4 border-b border-neutral-200">
              <h3 className="text-xl font-extrabold text-[#121212]">Saranay Booking &amp; Cancellation Policy</h3>
              <button
                type="button"
                onClick={() => setPolicyModalOpen(false)}
                aria-label="Close"
                className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-600 flex items-center justify-center cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-sm text-neutral-700 leading-relaxed max-h-[60vh] overflow-y-auto pr-2">
              <p>
                <strong>1. Schedule &amp; Rates:</strong>
                <br />• Open daily, 6:00 AM – 2:00 AM.
                <br />• Daytime (6:00 AM – 4:00 PM): ₱200/hr, minimum 2 hours.
                <br />• Nighttime (4:00 PM – 2:00 AM): ₱300/hr, minimum 1 hour.
                <br />• Bookings are open up to 30 days in advance.
              </p>
              <p>
                <strong>2. Court Capacity:</strong>
                <br />• 1 hour: up to 4 players.
                <br />• 2 hours: up to 8 players.
                <br />• 3 hours or more: up to 12 players.
                <br />• Additional players are charged ₱100/person.
              </p>
              <p>
                <strong>3. Payment:</strong> Full payment is required to confirm your booking. Payments are
                non-refundable.
              </p>
              <p>
                <strong>4. Equipment Rental:</strong> Paddles ₱100/session, balls ₱50/session.
              </p>
              <p>
                <strong>5. Cancellation:</strong> Cancellations must be made at least 24 hours before your schedule.
                Cancellations less than 24 hours before the schedule are not allowed.
              </p>
              <p>
                <strong>6. Rescheduling:</strong> Bookings may be rescheduled at least 24 hours before the schedule,
                subject to court availability.
              </p>
              <p>
                <strong>7. Rain Policy:</strong>
                <br />• Rain before your session: your booking will be moved to another available schedule.
                <br />• Rain during your session: if more than 30 minutes have been played, it counts as 1 hour
                played; if less than 30 minutes, you get a 1-hour reschedule credit.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-neutral-100 flex justify-end">
              <button
                type="button"
                onClick={() => setPolicyModalOpen(false)}
                className="bg-[#121212] hover:bg-black text-[#ccff00] font-bold px-6 py-2.5 rounded-xl text-sm cursor-pointer"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}