import React, { useEffect, useRef } from 'react';
import { Pin, Eye, Pencil, Trash2 } from 'lucide-react';

/**
 * AnnouncementMenu
 * Kebab dropdown menu component for announcements.
 *
 * Buttons:
 * - Pin (or Unpin if already pinned)
 * - View
 * - Edit
 * - Delete (styled in #C42B2B red)
 *
 * Cohesive with Saranay design system:
 * - Border: #dedbc4
 * - Background: #ffffff
 * - Hover: #fbfaf1
 * - Font: Be Vietnam Pro
 * - Text: #121212
 */
export default function AnnouncementMenu({
  isOpen = false,
  onClose,
  onPin,
  onView,
  onEdit,
  onDelete,
  announcement = null,
  isPinned = false,
  align = 'right',
  className = '',
}) {
  const menuRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose?.();
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose?.();
      }
    }

    // Delay slightly to prevent immediate closing from the opening click event
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }, 10);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentIsPinned = Boolean(isPinned ?? announcement?.pinned);

  const handleAction = (callback) => {
    if (callback) {
      callback(announcement);
    }
    onClose?.();
  };

  return (
    <div
      ref={menuRef}
      style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}
      className={`absolute ${
        align === 'left' ? 'left-0' : 'right-0'
      } top-full mt-1.5 w-36 bg-[#ffffff] border border-[#dedbc4] rounded-xl shadow-lg p-1 z-50 animate-in fade-in zoom-in-95 duration-100 select-none ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 1. Pin / Unpin */}
      <button
        type="button"
        onClick={() => handleAction(onPin)}
        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#121212] hover:bg-[#fbfaf1] active:bg-[#f0eedb] transition-colors cursor-pointer text-left group"
      >
        <Pin
          className={`w-3.5 h-3.5 ${
            currentIsPinned ? 'fill-[#121212] text-[#121212]' : 'text-[#6b7280] group-hover:text-[#121212]'
          } transition-colors`}
        />
        <span>{currentIsPinned ? 'Unpin' : 'Pin'}</span>
      </button>

      {/* 2. View */}
      <button
        type="button"
        onClick={() => handleAction(onView)}
        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#121212] hover:bg-[#fbfaf1] active:bg-[#f0eedb] transition-colors cursor-pointer text-left group"
      >
        <Eye className="w-3.5 h-3.5 text-[#6b7280] group-hover:text-[#121212] transition-colors" />
        <span>View</span>
      </button>

      {/* 3. Edit */}
      <button
        type="button"
        onClick={() => handleAction(onEdit)}
        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#121212] hover:bg-[#fbfaf1] active:bg-[#f0eedb] transition-colors cursor-pointer text-left group"
      >
        <Pencil className="w-3.5 h-3.5 text-[#6b7280] group-hover:text-[#121212] transition-colors" />
        <span>Edit</span>
      </button>

      {/* Separator line */}
      <div className="w-full h-px bg-[#dedbc4] my-1" />

      {/* 4. Delete */}
      <button
        type="button"
        onClick={() => handleAction(onDelete)}
        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#C42B2B] hover:bg-[#C42B2B]/10 active:bg-[#C42B2B]/20 transition-colors cursor-pointer text-left group"
      >
        <Trash2 className="w-3.5 h-3.5 text-[#C42B2B] transition-colors" />
        <span>Delete</span>
      </button>
    </div>
  );
}
