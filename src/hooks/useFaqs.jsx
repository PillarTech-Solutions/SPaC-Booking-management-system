import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase_client";

// Same folder as useSiteSettings.js  →  src/app/hooks/useFaqs.jsx

// Categories are structural (they match the DB check constraint), not content.
export const FAQ_CATEGORIES = [
  { id: "GENERAL", label: "General FAQs", description: "Court setup, amenities, facility features & hospitality" },
  { id: "BOOKING", label: "Booking Guidelines", description: "Reservation procedures, policies & requirements" },
  { id: "RAIN", label: "Rain Policy", description: "Weather protocols, reschedules & credits" },
  { id: "LIABILITY", label: "Liability Notice", description: "Safety, conduct, and player responsibility rules" },
];

const rowToFaq = (r) => ({
  id: r.id,
  category: r.category,
  q: r.question,
  a: r.answer,
  fullSpan: r.full_span,
  order: r.sort_order,
});

/** Sorts by category, then order, and adds "01", "02"… numbers per category. */
export function withNumbers(list) {
  const catIndex = (id) => FAQ_CATEGORIES.findIndex((c) => c.id === id);
  const counters = {};
  return [...list]
    .sort((a, b) => catIndex(a.category) - catIndex(b.category) || a.order - b.order || a.id - b.id)
    .map((f) => {
      counters[f.category] = (counters[f.category] || 0) + 1;
      return { ...f, num: String(counters[f.category]).padStart(2, "0") };
    });
}

/** Splits "**bold**" and "*italic*" markers into renderable segments. */
export function faqSegments(text = "") {
  return String(text)
    .split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
    .filter(Boolean)
    .map((p) => {
      if (p.startsWith("**") && p.endsWith("**") && p.length > 4) {
        return {
          type: "bold",
          text: p.slice(2, -2),
        };
      }

      if (p.startsWith("*") && p.endsWith("*") && p.length > 2) {
        return {
          type: "italic",
          text: p.slice(1, -1),
        };
      }

      return { type: "text", text: p };
    });
}

/** Renders FAQ text with **bold** and *italic* markers. */
export function FaqText({ text }) {
  return faqSegments(text).map((s, i) =>
    s.type === "bold" ? (
      <strong key={i} className="font-bold text-[#141414]">{s.text}</strong>
    ) : s.type === "italic" ? (
      <em key={i}>{s.text}</em>
    ) : (
      <span key={i}>{s.text}</span>
    )
  );
}

/** Loads FAQs from Supabase and keeps them live (if realtime is enabled for the table). */
export function useFaqs() {
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    const { data, error } = await supabase
      .from("faqs")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true });
    if (error) setError(error.message);
    else {
      setError(null);
      setFaqs(withNumbers(data.map(rowToFaq)));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
    const channel = supabase
      .channel(`faqs-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "faqs" }, reload)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [reload]);

  return { faqs, loading, error, reload };
}