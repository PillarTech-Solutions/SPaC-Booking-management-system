import React, { useState } from 'react';
import Dashboard from './Dashboard';
import Bookings from './Bookings';
import Reports from './Reports';
import Accounts from './Accounts';
import Logs from './Logs';
import Navbar from '../components/Navbar';
import AddBookingModal from '../components/AddBookingModal';
import LogoutConfirmation from '../components/LogoutConfirmation';

const TABS = [
  { id: 'DASHBOARD', label: 'DASHBOARD' },
  { id: 'BOOKINGS', label: 'BOOKINGS' },
  { id: 'REPORTS', label: 'REPORTS' },
  { id: 'ACCOUNTS', label: 'ACCOUNTS' },
  { id: 'LOGS', label: 'LOGS' },
];

// Map each tab id to the page component it should show.
const PAGES = {
  DASHBOARD: Dashboard,
  BOOKINGS: Bookings,
  REPORTS: Reports,
  ACCOUNTS: Accounts,
  LOGS: Logs,
};

export default function AdminMainForm() {
  const [activeTab, setActiveTab] = useState('BOOKINGS');
  const [isAddBookingOpen, setIsAddBookingOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

  const ActivePage = PAGES[activeTab];

  const handleBookingAdded = (booking) => {
    console.log('New booking:', booking);
    // TODO: save to your backend / refresh the Bookings list here
  };

  // Runs only after the user confirms in the logout confirmation modal
  const handleLogout = () => {
    console.log('Logging out...');
    // TODO: clear auth/session and redirect to login here
  };

  return (
    <div
      style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}
      className="min-h-screen flex flex-col bg-[#f3f5e0] text-neutral-900 antialiased selection:bg-[#ccff00] selection:text-black"
    >
      {/* Navbar component */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        tabs={TABS}
        onAddBooking={() => setIsAddBookingOpen(true)}
        onLogoutClick={() => setIsLogoutConfirmOpen(true)}
      />

      {/* Main content: renders the page that matches the active tab */}
      <main className="flex-1 w-full max-w-[1520px] mx-auto px-5 sm:px-10 py-5 sm:py-6 flex flex-col">
        <div id={`tab-${activeTab.toLowerCase()}`} className="w-full flex-1">
          {ActivePage ? (
            <ActivePage />
          ) : (
            <div className="py-24 text-center text-sm text-neutral-500">
              The {activeTab.toLowerCase()} page isn't built yet.
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full h-[62px] mt-auto border-t border-[#c4c9ac] bg-[#eef0da] flex items-center shrink-0">
        <div className="max-w-[1520px] w-full mx-auto px-5 sm:px-10 flex items-center justify-end h-full">
          <p className="text-xs sm:text-sm font-semibold text-[#444933] tracking-tight">
            © 2026 Saranay Pickleball. All rights reserved.
          </p>
        </div>
      </footer>

      {/* Add Booking modal: mounted only while open so the form resets each time */}
      {isAddBookingOpen && (
        <AddBookingModal
          onClose={() => setIsAddBookingOpen(false)}
          onBookingAdded={handleBookingAdded}
        />
      )}

      {/* Logout confirmation: opened from the profile dropdown's Logout button */}
      {isLogoutConfirmOpen && (
        <LogoutConfirmation
          onClose={() => setIsLogoutConfirmOpen(false)}
          onConfirm={handleLogout}
        />
      )}
    </div>
  );
}