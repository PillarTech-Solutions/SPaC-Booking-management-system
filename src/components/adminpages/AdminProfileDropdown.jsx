import React, { useEffect, useRef } from 'react';
import { LogOut } from 'lucide-react';

export default function AdminProfileDropdown({
  isOpen,
  onClose,
  user = {
    name: 'Alyssa Cruz',
    phone: '0917-888-1234',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
    initials: 'AC',
  },
  onLogout,
  onViewProfile, // new
  triggerRef, // ref to the avatar button, so clicking it isn't treated as an "outside" click
}) {
  const dropdownRef = useRef(null);

  // Close dropdown on click outside or Escape key
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event) {
      // Ignore clicks on the toggle button; its own onClick handles open/close
      if (triggerRef?.current?.contains(event.target)) return;
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        onClose?.();
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose?.();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, triggerRef]);

  if (!isOpen) return null;

  return (
    <div
      ref={dropdownRef}
      role="menu"
      style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}
      className="absolute right-0 top-full mt-2 w-56 bg-white border border-neutral-200 rounded-xl shadow-lg p-4 z-[60] animate-in fade-in zoom-in-95 duration-150 origin-top-right flex flex-col items-center text-center"
    >
      <div
        onClick={() => {
          onViewProfile?.();
          onClose?.();
        }}
        className="w-full flex flex-col items-center cursor-pointer"
      >

        {/* Picture (clean, moderately sized avatar) */}
        <div className="w-14 h-14 rounded-full overflow-hidden bg-neutral-100 border border-neutral-200 flex items-center justify-center relative mb-2.5">
          <span className="text-sm font-semibold text-neutral-500 absolute">
            {user.initials || 'AC'}
          </span>
          {user.avatar && (
            <img
              src={user.avatar}
              alt={user.name}
              className="w-full h-full object-cover relative z-10"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          )}
        </div>

      </div>

      {/* Full Name */}
      <h3 className="text-sm font-semibold text-neutral-900 leading-tight">
        {user.name}
      </h3>

      {/* Contact Number */}
      <p className="text-xs text-neutral-500 font-normal mt-0.5">
        {user.phone}
      </p>

      {/* Line separator before logout */}
      <div className="w-full h-px bg-neutral-200/70 my-2.5" />

      {/* Logout button without box, text & icon #121212, turns red on hover */}
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          if (onLogout) {
            onLogout();
          }
          if (onClose) {
            onClose();
          }
        }}
        className="w-full inline-flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg text-xs font-semibold text-[#121212] hover:text-red-600 hover:bg-red-50/60 transition-colors cursor-pointer group"
      >
        <LogOut className="w-3.5 h-3.5 text-[#121212] group-hover:text-red-600 transition-colors stroke-[2]" />
        <span>Logout</span>
      </button>
    </div>
  );
}