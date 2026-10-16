import React, { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
// ⚠️ Adjust these two paths to match where this file lives (hooks = src/app/hooks)
import { FAQ_CATEGORIES, FaqText, useFaqs } from '../../hooks/useFaqs';
import { useSiteSettings, telHref, facebookHref } from '../../hooks/useSiteSettings';
// Strips **bold** / *italic* markers so search matches the visible text
const plain = (t = "") =>
  String(t)
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1");
    
export default function FAQs() {
  const { faqs, loading, error } = useFaqs();
  const { settings } = useSiteSettings();
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Search results (all categories)
  const searched = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return faqs;
    return faqs.filter((f) => `${f.q} ${plain(f.a)}`.toLowerCase().includes(q));
  }, [faqs, searchQuery]);

  // Sections to show: one per category that has matching items
  const sections = FAQ_CATEGORIES.map((cat) => ({
    ...cat,
    items: searched.filter((f) => f.category === cat.id),
  })).filter((s) => (selectedCategory === 'ALL' || selectedCategory === s.id) && s.items.length > 0);

  // Filter buttons: only categories that actually have questions
  const filterButtons = [
    { id: 'ALL', label: 'All Questions', count: faqs.length },
    ...FAQ_CATEGORIES.map((c) => ({ ...c, count: faqs.filter((f) => f.category === c.id).length })).filter((c) => c.count > 0),
  ];

  return (
    <div
      style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}
      className="w-full flex flex-col space-y-10 text-neutral-900 antialiased"
    >
      {/* HERO HEADER SECTION */}
      <div className="w-full pt-4 pb-6 border-b border-[#DFD8C4] flex flex-col lg:flex-row justify-between lg:items-end gap-6">
        <div className="max-w-[672px] space-y-3">
          <div
            style={{ background: '#F3F8D3', border: '1px solid rgba(199, 219, 46, 0.4)', borderRadius: '9999px' }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5"
          >
            <span style={{ width: '8px', height: '8px', background: '#C7DB2E', borderRadius: '9999px' }} className="shrink-0" />
            <span style={{ letterSpacing: '1.2px', color: '#4D580C' }} className="text-xs font-bold uppercase tracking-wider">
              INFORMATION & COURT HOUSE RULES
            </span>
          </div>

          <h1
            style={{ letterSpacing: '-1.2px', lineHeight: '1.05', color: '#141414' }}
            className="text-3xl sm:text-4xl md:text-5xl font-extrabold"
          >
            FAQs & Guidelines
          </h1>

          <p style={{ color: '#575447', lineHeight: '24px' }} className="text-sm sm:text-base font-normal max-w-xl">
            Everything you need to know about court bookings, cancellations, weather policies, and house rules.
          </p>
        </div>

        {/* Search */}
        <div className="w-full sm:w-[392px] shrink-0">
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.9)',
              border: '1px solid #D4CCB4',
              boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.05)',
              borderRadius: '12px',
            }}
            className="relative flex items-center px-4 py-3.5 sm:py-4 transition-all focus-within:border-[#141414] focus-within:ring-2 focus-within:ring-[#C7DB2E]/40"
          >
            <Search className="w-5 h-5 text-[#7C7764] shrink-0 mr-3 stroke-[1.8]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search questions (e.g. shoes, rain, refund, cafe)..."
              style={{ color: '#141414' }}
              className="w-full bg-transparent text-sm placeholder:text-[#8B8573] focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-xs text-[#7C7764] hover:text-black font-semibold ml-2 cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* CATEGORY FILTER BUTTONS */}
      {faqs.length > 0 && (
        <div className="w-full overflow-x-auto scrollbar-none pb-2">
          <div className="inline-flex items-center gap-2 sm:gap-2.5">
            {filterButtons.map((cat) => {
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  style={{
                    background: isActive ? '#171717' : '#FFFFFF',
                    border: isActive ? '1px solid #171717' : '1px solid #E5DFCF',
                    borderRadius: '9999px',
                    boxShadow: isActive
                      ? '0px 4px 6px -1px rgba(0, 0, 0, 0.1), 0px 2px 4px -2px rgba(0, 0, 0, 0.1)'
                      : '0px 1px 2px rgba(0, 0, 0, 0.05)',
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 cursor-pointer whitespace-nowrap transition-all select-none"
                >
                  <span
                    style={{ color: isActive ? '#C7DB2E' : '#404040' }}
                    className={`text-sm font-semibold tracking-normal ${isActive ? 'font-bold' : ''}`}
                  >
                    {cat.label}
                  </span>
                  <span
                    style={{
                      background: isActive ? 'rgba(199, 219, 46, 0.2)' : '#F5F5F5',
                      color: isActive ? '#C7DB2E' : '#737373',
                      borderRadius: '9999px',
                    }}
                    className="px-2 py-0.5 text-[11px] font-bold"
                  >
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* LOADING / ERROR */}
      {loading && <p className="text-sm text-[#737373]">Loading FAQs...</p>}
      {!loading && error && (
        <p className="text-sm font-semibold text-red-600">Sorry, we couldn't load the FAQs right now. Please try again later.</p>
      )}

      {/* SECTIONS (one per category, driven by the database) */}
      {sections.map((section) => (
        <section key={section.id} className="w-full space-y-5">
          <div className="w-full pb-3 border-b border-[#E5DFCF] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div style={{ width: '10px', height: '28px', background: '#C7DB2E', borderRadius: '9999px' }} className="shrink-0" />
              <div>
                <h2 style={{ letterSpacing: '-0.6px', color: '#171717' }} className="text-xl sm:text-2xl font-black uppercase">
                  {section.label}
                </h2>
                <p className="text-xs sm:text-sm font-medium text-[#737373] mt-0.5">{section.description}</p>
              </div>
            </div>

            <div
              style={{ background: '#FFFFFF', border: '1px solid #E5DFCF', borderRadius: '9999px' }}
              className="px-3 py-1 text-xs font-bold text-[#737373] shrink-0"
            >
              {section.items.length} items
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {section.items.map((faq) => (
              <div
                key={faq.id}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E3DCB8',
                  borderRadius: '16px',
                  boxShadow: '0px 2px 6px -1px rgba(20, 20, 20, 0.04), 0px 2px 4px -2px rgba(20, 20, 20, 0.03)',
                }}
                className={`p-5 flex items-start gap-4 ${faq.fullSpan ? 'md:col-span-2' : ''}`}
              >
                <div
                  style={{ background: '#F4F9CE', border: '1px solid #D7E84B', borderRadius: '12px', color: '#556306' }}
                  className="w-9 h-9 shrink-0 flex items-center justify-center font-extrabold text-sm"
                >
                  {faq.num}
                </div>

                <div className="space-y-1.5 flex-1 min-w-0">
                  <h3 style={{ color: '#141414' }} className="font-bold text-base leading-snug">
                    {faq.q}
                  </h3>
                  <p style={{ color: '#4E4B3E' }} className="text-sm leading-relaxed">
                    <FaqText text={faq.a} />
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {/* NO RESULTS / EMPTY STATE */}
      {!loading && !error && sections.length === 0 && (
        <div className="w-full text-center py-12 bg-white rounded-2xl border border-[#E5DFCF]">
          {faqs.length === 0 ? (
            <p className="text-base font-bold text-neutral-800">No FAQs have been posted yet. Please check back soon.</p>
          ) : (
            <>
              <p className="text-base font-bold text-neutral-800">
                {searchQuery ? `No questions found matching "${searchQuery}"` : 'No questions in this category.'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('ALL');
                }}
                className="mt-3 text-xs font-bold text-[#556306] hover:underline cursor-pointer"
              >
                Reset search filter
              </button>
            </>
          )}
        </div>
      )}

      {/* HELP / CONTACT BANNER (phone + Facebook come from site_settings) */}
      <div
        style={{
          background: 'linear-gradient(90deg, #171717 0%, #252522 100%)',
          border: '1px solid #262626',
          borderRadius: '16px',
          boxShadow: '0px 20px 25px -5px rgba(0, 0, 0, 0.1), 0px 8px 10px -6px rgba(0, 0, 0, 0.1)',
        }}
        className="p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
      >
        <div className="space-y-1.5">
          <span style={{ letterSpacing: '1.2px', color: '#C7DB2E' }} className="text-xs font-bold uppercase tracking-wider block">
            STILL HAVE QUESTIONS?
          </span>
          <h4 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Need help or have special inquiries?</h4>
          <p className="text-xs sm:text-sm text-[#A3A3A3]">Reach out to our staff directly on Facebook or give us a quick call.</p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <a
            href={telHref(settings.phone_primary)}
            style={{ background: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px' }}
            className="px-5 py-2.5 text-xs font-semibold text-white uppercase tracking-wider hover:bg-white/20 transition-colors inline-block"
          >
            CALL US
          </a>

          <a
            href={facebookHref(settings.facebook)}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: '#C7DB2E',
              borderRadius: '12px',
              boxShadow: '0px 4px 6px -1px rgba(0, 0, 0, 0.1), 0px 2px 4px -2px rgba(0, 0, 0, 0.1)',
            }}
            className="px-6 py-2.5 text-xs font-extrabold text-[#141414] uppercase tracking-wider hover:bg-[#b8e600] active:scale-95 transition-all inline-block"
          >
            MESSAGE FACEBOOK
          </a>
        </div>
      </div>
    </div>
  );
}