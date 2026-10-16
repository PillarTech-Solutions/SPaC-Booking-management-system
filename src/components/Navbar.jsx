import React, { useState, useRef } from 'react';
import { Calendar, Bell, Settings, Menu, X, Plus } from 'lucide-react';
import AdminProfileDropdown from './AdminProfileDropdown';

const DEFAULT_TABS = [
  { id: 'DASHBOARD', label: 'DASHBOARD' },
  { id: 'BOOKINGS', label: 'BOOKINGS' },
  { id: 'REPORTS', label: 'REPORTS' },
  { id: 'ACCOUNTS', label: 'ACCOUNTS' },
  { id: 'LOGS', label: 'LOGS' },
];

export default function Navbar({
  activeTab = 'BOOKINGS',
  setActiveTab,
  tabs = DEFAULT_TABS,
  onAddBooking,
  onLogout,
  onLogoutClick,
  user,
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileBtnRef = useRef(null);

  const handleLogoutTrigger = () => {
    if (onLogoutClick) {
      onLogoutClick();
    } else if (onLogout) {
      onLogout();
    }
  };

  return (
    <header className="bg-[#121212] text-white sticky top-0 z-50 h-[105px] flex flex-col justify-between shrink-0 shadow-sm">
      {/* Top bar (64px) */}
      <div className="h-[64px] w-full flex items-center">
        <div className="max-w-[1520px] w-full mx-auto px-5 sm:px-10 flex items-center justify-between">
          {/* Logo */}
          <div
            onClick={() => setActiveTab?.('DASHBOARD')}
            className="flex items-center cursor-pointer select-none py-0.5"
            title="Saranay Pickleball Court"
          >
            <img
              src="/saranay-logo.png"
              alt="Saranay Pickleball Court"
              className="h-[52px] sm:h-[58px] max-h-[60px] w-auto object-contain transition-transform hover:scale-105"
              onError={(e) => {
                const target = e.currentTarget;
                if (target.src.endsWith('/saranay-logo.png')) {
                  target.src = '/SARANAY LOGO.png';
                }
              }}
            />
          </div>

          {/* Utility cluster: Add Booking Button + Vertical separator + Icons & Profile */}
          <div className="flex items-center gap-3 sm:gap-5">
            {/* Add Booking Button: opens the Add Booking modal */}
            <button
              type="button"
              onClick={onAddBooking}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-full font-bold text-xs sm:text-sm bg-[#ccff00] text-[#121212] hover:bg-[#b8e600] active:scale-[0.98] transition-all cursor-pointer shadow-xs shrink-0"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Add Booking</span>
            </button>

            {/* Vertical separator before Calendar */}
            <div className="h-6 w-[1px] bg-[#d1d5db]/50 shrink-0" />

            {/* Calendar */}
            <button
              type="button"
              title="Calendar"
              className="text-white hover:text-[#ccff00] transition-colors p-1 cursor-pointer"
            >
              <Calendar className="w-5 h-5 stroke-[1.8]" />
            </button>

            {/* Notifications */}
            <button
              type="button"
              title="Notifications"
              className="text-white hover:text-[#ccff00] transition-colors p-1 cursor-pointer"
            >
              <Bell className="w-5 h-5 stroke-[1.8]" />
            </button>

            {/* Settings */}
            <button
              type="button"
              title="Settings"
              className="text-white hover:text-[#ccff00] transition-colors p-1 cursor-pointer"
            >
              <Settings className="w-5 h-5 stroke-[1.8]" />
            </button>

            {/* Profile avatar + dropdown (relative so the dropdown anchors to it) */}
            <div className="relative ml-1">
              <button
                ref={profileBtnRef}
                type="button"
                title="Profile"
                aria-haspopup="menu"
                aria-expanded={isProfileOpen}
                onClick={() => setIsProfileOpen((prev) => !prev)}
                className="block w-8 h-8 rounded-full bg-neutral-700 ring-2 ring-[#ccff00] overflow-hidden cursor-pointer hover:ring-[#b8e600] transition-shadow"
              >
                <img
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </button>

              <AdminProfileDropdown
                isOpen={isProfileOpen}
                onClose={() => setIsProfileOpen(false)}
                onLogout={handleLogoutTrigger}
                triggerRef={profileBtnRef}
                {...(user ? { user } : {})}
              />
            </div>

            {/* Mobile menu button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden text-white ml-2 p-1 cursor-pointer"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Divider (1px, #d1d5db) */}
      <div className="h-[1px] w-full bg-[#d1d5db]" />

      {/* Tabs bar (40px) */}
      <div className="h-[40px] w-full flex items-center">
        <div className="max-w-[1520px] w-full mx-auto px-5 sm:px-10 h-full flex items-center">
          <nav className="hidden md:flex items-center gap-10 h-full overflow-x-auto">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab?.(tab.id)}
                  className={`h-full flex items-center text-xs tracking-wider transition-colors uppercase whitespace-nowrap cursor-pointer relative ${
                    isActive
                      ? 'text-[#ccff00] font-bold'
                      : 'text-white font-normal hover:text-[#ccff00]/90'
                  }`}
                >
                  {tab.label}
                  {isActive && (
                    <span
                      className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#ccff00]"
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Mobile navigation drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-[105px] left-0 right-0 bg-[#121212] border-t border-neutral-800 px-6 py-4 space-y-2 shadow-xl z-50">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab?.(tab.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full text-left py-2 px-3 rounded text-xs tracking-wider uppercase transition-colors ${
                  isActive
                    ? 'bg-neutral-900 text-[#ccff00] font-bold'
                    : 'text-white font-normal hover:bg-neutral-900 hover:text-[#ccff00]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
}
