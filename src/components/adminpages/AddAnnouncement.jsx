import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * AddAnnouncement.jsx
 * Modal component for creating and posting announcements.
 *
 * Designed according to user specs & provided reference image:
 * - Header: “Add Announcement” (or configurable title) (text color: #121212)
 * - Horizontal separator after header line color: #dedbc4
 * - X button color: #6b7280
 * - Horizontal separator before button line color: #dedbc4
 * - Panel border color: #dedbc4
 * - Panel fill color: #fbfaf1
 * - Text field border color: #dedbc4
 * - Text field fill color: #ffffff
 * - Label text color: #4a4a42
 * - Placeholder text color: #6b7280
 * - Text when filled in: #121212
 * - Checkbox: "Pin to the top"
 * - Helper subtext: "This will be visible to Court Staff on their portal."
 * - Buttons:
 *   - "Close" (left, bg: #d1d5db, text: #121212, rounded-full)
 *   - "Post" (right, bg: #ccff00, text: #121212, rounded-full)
 */
export default function AddAnnouncement({
  isOpen = true,
  onClose,
  onPost,
  headerTitle = 'Add Announcement',
}) {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape' && isOpen) {
        handleClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClose = () => {
    setErrorMessage('');
    onClose?.();
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!title.trim()) {
      setErrorMessage('Please enter an announcement title.');
      return;
    }

    if (!message.trim()) {
      setErrorMessage('Please enter the announcement message details.');
      return;
    }

    const newAnnouncementData = {
      title: title.trim(),
      message: message.trim(),
      isPinned,
      createdAt: new Date().toISOString(),
    };

    if (onPost) {
      onPost(newAnnouncementData);
    }

    // Reset & close
    setTitle('');
    setMessage('');
    setIsPinned(false);
    setErrorMessage('');
    onClose?.();
  };

  return (
    <div
      style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-[2px] select-none animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      {/* Modal Container */}
      <div className="w-full max-w-[460px] bg-[#ffffff] border border-[#dedbc4] rounded-2xl shadow-2xl p-4 sm:p-5 flex flex-col relative transition-all duration-150">
        {/* Header Row */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm sm:text-base font-bold text-[#121212] tracking-tight">
            {headerTitle}
          </h2>

          {/* X button (color: #6b7280) */}
          <button
            type="button"
            onClick={handleClose}
            className="p-1 rounded-full text-[#6b7280] hover:text-[#121212] transition-colors cursor-pointer"
            title="Close"
            aria-label="Close modal"
          >
            <X className="w-4 h-4 stroke-[2.2]" />
          </button>
        </div>

        {/* Horizontal separator after the header line color: #dedbc4 */}
        <div className="w-full h-px bg-[#dedbc4] my-3 sm:my-3.5" />

        {/* Validation error if any */}
        {errorMessage && (
          <div className="mb-3 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-600 text-[11px] font-medium">
            {errorMessage}
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Inner Panel: border #dedbc4, fill #fbfaf1 */}
          <div className="bg-[#fbfaf1] border border-[#dedbc4] rounded-xl p-3.5 sm:p-4 space-y-3 sm:space-y-3.5">
            {/* Title Field */}
            <div>
              <label className="block text-xs font-bold text-[#4a4a42] mb-1.5">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (errorMessage) setErrorMessage('');
                }}
                placeholder="Enter announcement title"
                className="w-full h-8 sm:h-9 px-3 bg-[#ffffff] border border-[#dedbc4] rounded-lg text-xs font-normal text-[#121212] placeholder-[#6b7280] focus:outline-none focus:border-[#121212] transition-colors"
              />
            </div>

            {/* Message Field */}
            <div>
              <label className="block text-xs font-bold text-[#4a4a42] mb-1.5">
                Message
              </label>
              <textarea
                rows={3}
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  if (errorMessage) setErrorMessage('');
                }}
                placeholder="Add details staff should know..."
                className="w-full p-2.5 sm:p-3 bg-[#ffffff] border border-[#dedbc4] rounded-lg text-xs font-normal text-[#121212] placeholder-[#6b7280] focus:outline-none focus:border-[#121212] transition-colors resize-none leading-relaxed"
              />
            </div>

            {/* Pin to top Checkbox */}
            <div className="pt-0.5">
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-[#dedbc4] text-[#121212] accent-[#121212] cursor-pointer focus:ring-0"
                />
                <span className="text-xs font-medium text-[#4a4a42]">
                  Pin to the top
                </span>
              </label>
            </div>
          </div>

          {/* Subtext info under panel */}
          <p className="text-[11px] sm:text-xs text-[#6b7280] font-normal px-0.5">
            This will be visible to Court Staff on their portal.
          </p>

          {/* Horizontal separator before the button line color: #dedbc4 */}
          <div className="w-full h-px bg-[#dedbc4] !mt-3.5 !mb-3" />

          {/* Action Buttons: left (Close), right (Post) */}
          <div className="w-full flex items-center justify-between pt-0.5">
            {/* Button for “Close” (bg: #d1d5db, text: #121212, rounded-full) */}
            <button
              type="button"
              onClick={handleClose}
              className="px-6 sm:px-7 py-1.5 sm:py-2 rounded-full font-bold text-xs sm:text-sm bg-[#d1d5db] text-[#121212] hover:bg-[#c4c8ce] active:scale-[0.98] transition-all cursor-pointer"
            >
              Close
            </button>

            {/* Button for “Post” (bg: #ccff00, text: #121212, rounded-full) */}
            <button
              type="submit"
              className="px-6 sm:px-7 py-1.5 sm:py-2 rounded-full font-bold text-xs sm:text-sm bg-[#ccff00] text-[#121212] hover:bg-[#b8e600] active:scale-[0.98] transition-all cursor-pointer shadow-xs"
            >
              Post
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
