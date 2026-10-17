"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../../../lib/supabase_client";
import PopupSettingsSaveConfirmation from "./PopupSettingsSaveConfirmation";
import { FAQ_CATEGORIES, FaqText, useFaqs, withNumbers } from "../../hooks/useFaqs";
import {
  X,
  Bold,
  Italic,
  Upload,
  AlertTriangle,
  Plus,
  MoreHorizontal,
  RotateCw,
  Trash2,
  Copy,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Search,
  Eye,
  CheckCircle,
  Save,
  RotateCcw,
} from "lucide-react";

const LIME = "#ccff00";
const FAQS_PER_PAGE = 8;
const inputBase =
  "w-full h-[34px] sm:h-[36px] rounded-xl border border-[#121212] bg-[#ffffff] px-3.5 py-1.5 text-xs text-[#121212] placeholder-[#6b7280] focus:outline-none focus:ring-1 focus:ring-[#121212] transition-all";
const modalInput =
  "w-full rounded-xl border border-[#121212] bg-[#ffffff] px-3.5 py-2 text-xs text-[#121212] placeholder-[#6b7280] focus:outline-none focus:ring-1 focus:ring-[#121212] transition-all";

const tempKey = () => `new-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const toDraftRows = (rows = []) =>
  rows.map((faq) => ({ ...faq, _key: faq._key || `db-${String(faq.id)}` }));
const cleanText = (text = "") =>
  String(text)
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1");
const nextOrderFor = (rows, category) => {
  const orders = rows
    .filter((faq) => faq.category === category)
    .map((faq) => Number(faq.order) || 0);
  return (orders.length ? Math.max(...orders) : 0) + 1;
};

function fieldsChanged(a, b) {
  return (
    a.category !== b.category ||
    a.q !== b.q ||
    a.a !== b.a ||
    Boolean(a.fullSpan) !== Boolean(b.fullSpan) ||
    Number(a.order || 0) !== Number(b.order || 0)
  );
}

function sameDrafts(a = [], b = []) {
  if (a.length !== b.length) return false;
  const bByKey = new Map(b.map((item) => [item._key, item]));
  return a.every((item) => {
    const other = bByKey.get(item._key);
    return Boolean(other) && !fieldsChanged(item, other);
  });
}

function SectionTitle({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[#121212]" strokeWidth={1.5} />
      <div>
        <h2 className="text-sm font-bold leading-tight text-[#121212]">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[11px] text-[#5f5e5e]">{subtitle}</p>}
      </div>
    </div>
  );
}

function Chip({ children, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`h-[34px] min-w-[62px] cursor-pointer rounded-lg border border-[#121212] px-4 text-xs font-medium text-[#121212]/80 transition-colors sm:h-[36px] ${
        active ? "bg-[#ccff00] hover:brightness-95" : "bg-[#d9d9d9] hover:bg-[#cfcfcf]"
      }`}
    >
      {children}
    </button>
  );
}

function ActionBar({ onReset, onSave, saveLabel, section, saving, hasChanges }) {
  const [confirm, setConfirm] = useState(null);
  const close = () => setConfirm(null);

  return (
    <>
      <div className="flex flex-col gap-2 border-t border-[#dedecb] pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] text-[#5f5e5e]" aria-live="polite">
          {hasChanges
            ? "You have unsaved FAQ changes. Customers will see them after saving."
            : "All FAQ changes are saved in the database."}
        </p>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setConfirm("reset")}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#121212] bg-white px-4 py-2 text-xs font-semibold text-[#121212] transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </button>
          <button
            type="button"
            onClick={() => setConfirm("save")}
            disabled={saving || !hasChanges}
            style={{ backgroundColor: LIME }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#121212] px-4 py-2 text-xs font-bold text-[#121212] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : saveLabel}
          </button>
        </div>
      </div>

      {confirm === "reset" && createPortal(
        <div role="dialog" aria-modal="true" onClick={close} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div onClick={(event) => event.stopPropagation()} className="w-full max-w-md rounded-2xl border border-[#121212] bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-[#121212]">Reset FAQ draft?</h3>
                <p className="mt-1 text-xs leading-relaxed text-[#5f5e5e]">This discards unsaved FAQ changes and reloads the current records from Supabase. It will not delete or reseed saved FAQs.</p>
              </div>
              <button type="button" aria-label="Close" onClick={close} className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[#121212] bg-white text-[#121212] hover:bg-neutral-100"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={close} className="cursor-pointer rounded-xl border border-[#121212] bg-white px-4 py-1.5 text-xs font-semibold text-[#121212] hover:bg-neutral-100">Keep editing</button>
              <button type="button" onClick={async () => { await onReset(); close(); }} style={{ backgroundColor: LIME }} className="cursor-pointer rounded-xl border border-[#121212] px-4 py-1.5 text-xs font-bold text-[#121212] hover:brightness-95">Reset draft</button>
            </div>
          </div>
        </div>,
        document.body
      )}
      <PopupSettingsSaveConfirmation
        isOpen={confirm === "save"}
        sectionName={section}
        onClose={close}
        onConfirm={async () => {
          await onSave();
          close();
        }}
      />
    </>
  );
}

function RowActionMenu({ label, onEdit, onDelete, onDuplicate }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: undefined, bottom: undefined });
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const menuWidth = 144;
  const menuHeight = onDuplicate ? 148 : 116;

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;
    const left = Math.max(8, Math.min(window.innerWidth - menuWidth - 8, rect.right - menuWidth));
    const openUp = rect.bottom + menuHeight + 8 > window.innerHeight;
    setPos(
      openUp
        ? { left, bottom: window.innerHeight - rect.top + 6, top: undefined }
        : { left, top: rect.bottom + 6, bottom: undefined }
    );
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpen(false);
    const onDown = (event) => {
      if (menuRef.current?.contains(event.target) || btnRef.current?.contains(event.target)) return;
      close();
    };
    const onKey = (event) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  const itemBase =
    "flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-xs font-medium transition-colors hover:bg-neutral-100";

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={`Actions for ${label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
        className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-[#121212] bg-white text-[#121212] transition-colors hover:bg-neutral-100"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          style={{ position: "fixed", left: pos.left, top: pos.top, bottom: pos.bottom, width: menuWidth }}
          className="z-50 overflow-hidden rounded-xl border border-[#121212] bg-white py-1 text-left shadow-lg"
        >
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onEdit?.(); }} className={`${itemBase} text-[#121212]`}>
            <RotateCw className="h-3.5 w-3.5" /> Edit
          </button>
          {onDuplicate && (
            <button type="button" role="menuitem" onClick={() => { setOpen(false); onDuplicate(); }} className={`${itemBase} text-[#121212]`}>
              <Copy className="h-3.5 w-3.5" /> Duplicate
            </button>
          )}
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onDelete(); }} className={`${itemBase} text-[#121212]`}>
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
          <div className="my-1 border-t border-[#c4c9ac]" />
          <button type="button" role="menuitem" onClick={() => setOpen(false)} className={`${itemBase} text-red-600`}>
            <X className="h-3.5 w-3.5" /> Cancel
          </button>
        </div>
      )}
    </>
  );
}

function FaqFormModal({ isOpen, initialData, categoryDefault = "GENERAL", onClose, onSave }) {
  const [form, setForm] = useState({ category: categoryDefault, q: "", a: "", fullSpan: false });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const areaRef = useRef(null);
  const isEdit = Boolean(initialData?._key);

  useEffect(() => {
    if (!isOpen) return;
    setForm({
      category: initialData?.category || categoryDefault,
      q: initialData?.q || "",
      a: initialData?.a || "",
      fullSpan: Boolean(initialData?.fullSpan),
    });
    setError("");
    setSaving(false);
  }, [isOpen, initialData, categoryDefault]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const setField = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const wrap = (marker) => {
    const element = areaRef.current;
    if (!element) return;
    const start = element.selectionStart;
    const end = element.selectionEnd;
    const selected = form.a.slice(start, end) || "text";
    const next = form.a.slice(0, start) + marker + selected + marker + form.a.slice(end);
    setForm((current) => ({ ...current, a: next }));
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(start + marker.length, start + marker.length + selected.length);
    });
  };

  const submit = async () => {
    const q = form.q.trim();
    const a = form.a.trim();
    if (!q || !a) {
      setError("Please fill in both the question and the answer.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({
        ...(initialData?._key ? { _key: initialData._key, id: initialData.id ?? null } : {}),
        category: form.category,
        q,
        a,
        fullSpan: form.fullSpan,
      });
      onClose();
    } catch (saveError) {
      setError(saveError?.message || "The FAQ could not be added to the draft.");
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div role="dialog" aria-modal="true" onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div onClick={(event) => event.stopPropagation()} style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }} className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-[#121212] bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-[#c4c9ac] pb-3">
          <div>
            <h3 className="text-sm font-bold text-[#121212]">{isEdit ? "Edit question" : "Add question"}</h3>
            <p className="mt-0.5 text-[11px] text-[#5f5e5e]">This change stays in the draft until you click Save changes.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[#121212] bg-white text-[#121212] hover:bg-neutral-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-[#5f5e5e]">Category</span>
            <select className={`${modalInput} h-[36px] cursor-pointer`} value={form.category} onChange={setField("category")}>
              {FAQ_CATEGORIES.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-[#5f5e5e]">Question / title</span>
            <input className={`${modalInput} h-[36px]`} value={form.q} onChange={setField("q")} placeholder="e.g. Do you have parking?" />
          </label>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[#5f5e5e]">Answer / policy</span>
              <div className="flex gap-1">
                <button type="button" title="Bold (select text first)" onClick={() => wrap("**")} className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-[#121212] hover:bg-neutral-100"><Bold className="h-3 w-3" /></button>
                <button type="button" title="Italic (select text first)" onClick={() => wrap("*")} className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-[#121212] hover:bg-neutral-100"><Italic className="h-3 w-3" /></button>
              </div>
            </div>
            <textarea ref={areaRef} rows={5} className={`${modalInput} resize-y leading-relaxed`} value={form.a} onChange={setField("a")} placeholder="Write the answer… use **double asterisks** for bold." />
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-xs text-[#121212]">
            <input type="checkbox" checked={form.fullSpan} onChange={(event) => setForm((current) => ({ ...current, fullSpan: event.target.checked }))} className="h-3.5 w-3.5 cursor-pointer accent-[#121212]" />
            <span><strong>Wide card</strong> spans both columns on the public page.</span>
          </label>

          <div>
            <span className="text-[11px] font-semibold text-[#5f5e5e]">Live preview</span>
            <div className="mt-1 flex items-start gap-3 rounded-2xl border border-[#E3DCB8] bg-[#f3f5e0] p-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#D7E84B] bg-[#F4F9CE] text-xs font-extrabold text-[#556306]">{initialData?.num || "•"}</div>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-bold leading-snug text-[#141414]">{form.q || "Your question"}</p>
                <p className="text-xs leading-relaxed text-[#4E4B3E]">{form.a ? <FaqText text={form.a} /> : "Your answer will show here."}</p>
              </div>
            </div>
          </div>
          {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="cursor-pointer rounded-xl border border-[#121212] bg-white px-4 py-1.5 text-xs font-semibold text-[#121212] hover:bg-neutral-100">Cancel</button>
          <button type="button" onClick={submit} disabled={saving} style={{ backgroundColor: LIME }} className="cursor-pointer rounded-xl border border-[#121212] px-4 py-1.5 text-xs font-bold text-[#121212] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Applying..." : isEdit ? "Update draft" : "Add to draft"}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

const norm = (value) => String(value).toLowerCase().replace(/[^a-z]/g, "");
const pick = (record, names) => {
  for (const name of names) {
    if (record[name] !== undefined && record[name] !== null) return record[name];
  }
  return "";
};

function resolveCategory(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return null;
  const category = FAQ_CATEGORIES.find((item) =>
    item.id.toLowerCase() === normalized ||
    item.label.toLowerCase() === normalized ||
    item.label.toLowerCase().startsWith(normalized)
  );
  return category?.id || null;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (inQuotes) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += character;
      }
    } else if (character === '"') {
      inQuotes = true;
    } else if (character === ",") {
      row.push(current);
      current = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
    } else {
      current += character;
    }
  }
  if (current !== "" || row.length) {
    row.push(current);
    rows.push(row);
  }
  return rows.filter((items) => items.some((item) => item.trim() !== ""));
}

function toRecords(text, filename) {
  const clean = text.replace(/^\uFEFF/, "");
  if (/\.json$/i.test(filename)) {
    const data = JSON.parse(clean);
    const items = Array.isArray(data) ? data : data?.faqs;
    if (!Array.isArray(items)) throw new Error("JSON must be an array of FAQ objects or an object with a faqs array.");
    return items.map((item) => Object.fromEntries(Object.entries(item).map(([key, value]) => [norm(key), value])));
  }

  const [header, ...rest] = parseCsv(clean);
  if (!header) throw new Error("The file is empty.");
  const keys = header.map(norm);
  return rest.map((row) => Object.fromEntries(keys.map((key, index) => [key, row[index] ?? ""])));
}

function buildItems(records) {
  const items = [];
  const errors = [];
  records.forEach((record, index) => {
    const rowNumber = index + 1;
    const category = resolveCategory(pick(record, ["category", "cat"]));
    const q = String(pick(record, ["q", "question", "title"])).trim();
    const a = String(pick(record, ["a", "answer", "summary"])).trim();
    if (!category) {
      errors.push(`Row ${rowNumber}: unknown or missing category`);
      return;
    }
    if (!q || !a) {
      errors.push(`Row ${rowNumber}: question and answer are required`);
      return;
    }
    const wide = String(pick(record, ["fullspan", "wide"])).trim().toLowerCase();
    items.push({
      id: null,
      _key: tempKey(),
      category,
      q,
      a,
      fullSpan: ["true", "yes", "y", "1"].includes(wide),
      order: index + 1,
    });
  });
  return { items, errors };
}

function FaqUploadModal({ isOpen, onClose, onImport }) {
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState(null);
  const [fatal, setFatal] = useState("");
  const [mode, setMode] = useState("append");
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) return;
    setFileName("");
    setResult(null);
    setFatal("");
    setMode("append");
    setDragging(false);
    setImporting(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleFile = async (file) => {
    if (!file) return;
    setFileName(file.name);
    try {
      const contents = await file.text();
      setResult(buildItems(toRecords(contents, file.name)));
      setFatal("");
    } catch (fileError) {
      setResult(null);
      setFatal(fileError?.message || "Could not read this file.");
    }
  };

  const categoryLabel = (id) => FAQ_CATEGORIES.find((category) => category.id === id)?.label || id;
  const validCount = result?.items.length || 0;

  return createPortal(
    <div role="dialog" aria-modal="true" onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div onClick={(event) => event.stopPropagation()} style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }} className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-[#121212] bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-[#c4c9ac] pb-3">
          <div>
            <h3 className="text-sm font-bold text-[#121212]">Upload FAQs</h3>
            <p className="mt-0.5 text-[11px] text-[#5f5e5e]">Import FAQ records from a CSV or JSON file into the draft. Save changes to publish them.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[#121212] bg-white text-[#121212] hover:bg-neutral-100"><X className="h-4 w-4" /></button>
        </div>

        <div className="mt-4 space-y-4">
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => { event.preventDefault(); setDragging(false); handleFile(event.dataTransfer.files?.[0]); }}
            className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[#121212]/50 px-4 py-7 text-center transition-colors ${dragging ? "bg-[#f3f5e0]" : "hover:bg-neutral-50"}`}
          >
            <Upload className="h-5 w-5 text-[#121212]" />
            <p className="text-xs font-semibold text-[#121212]">{fileName || "Click to choose a file, or drag it here"}</p>
            <p className="text-[11px] text-[#5f5e5e]">.csv or .json · columns: Category, Question, Answer (FullSpan optional)</p>
          </div>
          <input ref={inputRef} type="file" accept=".csv,.json,application/json,text/csv" className="hidden" onChange={(event) => { handleFile(event.target.files?.[0]); event.target.value = ""; }} />

          {fatal && <p className="flex items-center gap-1.5 text-xs font-semibold text-red-600"><AlertTriangle className="h-3.5 w-3.5" /> {fatal}</p>}

          {result && (
            <div className="space-y-3">
              <p className="text-xs text-[#121212]">
                <span className="font-bold">{validCount}</span> FAQ{validCount === 1 ? "" : "s"} ready to add
                {result.errors.length > 0 && <span className="text-red-600"> · {result.errors.length} skipped</span>}
              </p>
              {validCount > 0 && (
                <div className="overflow-hidden rounded-xl border border-[#121212]/20">
                  <table className="w-full text-left text-[11px]"><tbody>
                    {result.items.slice(0, 5).map((item) => (
                      <tr key={item._key} className="border-b border-[#c4c9ac] last:border-0">
                        <td className="whitespace-nowrap px-3 py-1.5 font-bold text-[#444933]">{categoryLabel(item.category)}</td>
                        <td className="px-3 py-1.5 text-[#121212]">{item.q}</td>
                      </tr>
                    ))}
                  </tbody></table>
                  {validCount > 5 && <p className="bg-[#f9faf2] px-3 py-1 text-[10px] text-[#5f5e5e]">+ {validCount - 5} more</p>}
                </div>
              )}
              {result.errors.length > 0 && <ul className="list-disc space-y-0.5 pl-4 text-[11px] text-red-600">{result.errors.slice(0, 5).map((message) => <li key={message}>{message}</li>)}{result.errors.length > 5 && <li>+ {result.errors.length - 5} more</li>}</ul>}
              <div className="flex flex-wrap gap-4 text-xs text-[#121212]">
                {[ ["append", "Add to existing FAQs"], ["replace", "Replace all FAQs in the draft"] ].map(([value, label]) => (
                  <label key={value} className="flex cursor-pointer items-center gap-1.5">
                    <input type="radio" name="faq-import-mode" checked={mode === value} onChange={() => setMode(value)} className="cursor-pointer accent-[#121212]" />
                    {label}
                  </label>
                ))}
              </div>
              {mode === "replace" && <p className="text-[11px] font-semibold text-red-600">This replaces all FAQ rows in the current draft. Database records are changed only after Save changes is confirmed.</p>}
            </div>
          )}
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="cursor-pointer rounded-xl border border-[#121212] bg-white px-4 py-1.5 text-xs font-semibold text-[#121212] hover:bg-neutral-100">Cancel</button>
          <button
            type="button"
            disabled={validCount === 0 || importing}
            onClick={async () => {
              setImporting(true);
              try {
                await onImport(result.items, mode);
                onClose();
              } catch (importError) {
                setFatal(importError?.message || "Could not add the imported FAQs to the draft.");
              } finally {
                setImporting(false);
              }
            }}
            style={{ backgroundColor: LIME }}
            className="cursor-pointer rounded-xl border border-[#121212] px-4 py-1.5 text-xs font-bold text-[#121212] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {importing ? "Adding..." : `Add ${validCount > 0 ? `${validCount} FAQ${validCount === 1 ? "" : "s"}` : "FAQs"} to draft`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function Pagination({ page, totalPages, onChange }) {
  const navClass = "rounded-md border border-[#121212] p-1 transition-colors";
  const disabledClass = "cursor-not-allowed border-neutral-300 text-neutral-400 opacity-30";
  const enabledClass = "cursor-pointer text-[#121212] hover:bg-neutral-100";

  return (
    <div className="flex items-center gap-1">
      <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} className={`${navClass} ${page <= 1 ? disabledClass : enabledClass}`} title="Previous page"><ChevronLeft className="h-3.5 w-3.5 stroke-[2]" /></button>
      {Array.from({ length: totalPages }).map((_, index) => {
        const number = index + 1;
        return <button key={number} type="button" onClick={() => onChange(number)} className={`flex h-7 min-w-[28px] cursor-pointer items-center justify-center rounded-md px-1 text-xs font-semibold transition-all ${page === number ? "bg-[#121212] font-bold text-[#ccff00] shadow-sm" : "border border-[#121212]/30 text-[#121212] hover:bg-neutral-100"}`}>{number}</button>;
      })}
      <button type="button" disabled={page >= totalPages} onClick={() => onChange(page + 1)} className={`${navClass} ${page >= totalPages ? disabledClass : enabledClass}`} title="Next page"><ChevronRight className="h-3.5 w-3.5 stroke-[2]" /></button>
    </div>
  );
}

function FaqsTab() {
  const { faqs: databaseFaqs, loading, error: loadError, reload } = useFaqs();
  const [baseline, setBaseline] = useState([]);
  const [draftFaqs, setDraftFaqs] = useState([]);
  const [editingDraft, setEditingDraft] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [previewFaq, setPreviewFaq] = useState(null);
  const [notice, setNotice] = useState(null);
  const [saving, setSaving] = useState(false);
  const noticeTimer = useRef(null);
  const editingDraftRef = useRef(false);

  // When the database changes externally, refresh the working copy only if no local draft is open.
  useEffect(() => {
    if (editingDraftRef.current) return;
    const freshRows = toDraftRows(databaseFaqs);
    setBaseline(freshRows);
    setDraftFaqs(freshRows);
  }, [databaseFaqs]);

  useEffect(() => () => clearTimeout(noticeTimer.current), []);

  const toast = (message, type = "ok") => {
    setNotice({ type, text: message });
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 4000);
  };

  const categoryLabel = (id) => FAQ_CATEGORIES.find((category) => category.id === id)?.label || id;
  const numberedDraft = useMemo(() => withNumbers(draftFaqs), [draftFaqs]);
  const hasChanges = editingDraft && !sameDrafts(baseline, draftFaqs);

  const categoryCounts = useMemo(() => {
    const counts = { ALL: numberedDraft.length };
    FAQ_CATEGORIES.forEach((category) => { counts[category.id] = 0; });
    numberedDraft.forEach((faq) => { counts[faq.category] = (counts[faq.category] || 0) + 1; });
    return counts;
  }, [numberedDraft]);

  const filteredFaqs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return numberedDraft.filter((faq) => {
      if (selectedCategory !== "ALL" && faq.category !== selectedCategory) return false;
      if (!query) return true;
      return (
        faq.q.toLowerCase().includes(query) ||
        faq.a.toLowerCase().includes(query) ||
        String(faq.num).toLowerCase().includes(query) ||
        categoryLabel(faq.category).toLowerCase().includes(query)
      );
    });
  }, [numberedDraft, selectedCategory, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredFaqs.length / FAQS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * FAQS_PER_PAGE;
  const paginatedFaqs = filteredFaqs.slice(startIndex, startIndex + FAQS_PER_PAGE);

  const stageDraft = (mutator) => {
    editingDraftRef.current = true;
    setEditingDraft(true);
    setDraftFaqs((current) => mutator(current.length || baseline.length ? current : toDraftRows(databaseFaqs)));
  };

  const handleStageSaveFaq = async (data) => {
    stageDraft((current) => {
      if (data._key) {
        const old = current.find((faq) => faq._key === data._key);
        if (!old) return current;
        const movedCategory = old.category !== data.category;
        return current.map((faq) => faq._key === data._key
          ? {
              ...faq,
              category: data.category,
              q: data.q,
              a: data.a,
              fullSpan: data.fullSpan,
              order: movedCategory ? nextOrderFor(current.filter((item) => item._key !== faq._key), data.category) : faq.order,
            }
          : faq
        );
      }
      return [...current, {
        id: null,
        _key: tempKey(),
        category: data.category,
        q: data.q,
        a: data.a,
        fullSpan: Boolean(data.fullSpan),
        order: nextOrderFor(current, data.category),
      }];
    });
    setPage(1);
    toast(data._key ? "FAQ change added to the draft." : "Question added to the draft.");
  };

  const handleStageDeleteFaq = (key) => {
    stageDraft((current) => current.filter((faq) => faq._key !== key));
    toast("FAQ removed from the draft. Save changes to publish this deletion.");
  };

  const handleStageDuplicateFaq = (item) => {
    stageDraft((current) => {
      const sameCategory = current.filter((faq) => faq.category === item.category).sort((a, b) => a.order - b.order);
      const index = sameCategory.findIndex((faq) => faq._key === item._key);
      const next = sameCategory[index + 1];
      const possibleMiddle = next ? (Number(item.order) + Number(next.order)) / 2 : Number(item.order) + 1;
      const order = next && possibleMiddle > Number(item.order) && possibleMiddle < Number(next.order)
        ? possibleMiddle
        : nextOrderFor(current, item.category);
      const duplicate = { ...item, id: null, _key: tempKey(), q: `${item.q} (Copy)`, order };
      const nextRows = [...current, duplicate];
      return nextRows;
    });
    toast("FAQ duplicated in the draft. Save changes to publish it.");
  };

  const handleStageImport = async (imported, mode) => {
    stageDraft((current) => {
      if (mode === "replace") {
        const categoryOrders = Object.create(null);
        return imported.map((item) => {
          categoryOrders[item.category] = (categoryOrders[item.category] || 0) + 1;
          return { ...item, id: null, _key: item._key || tempKey(), order: categoryOrders[item.category] };
        });
      }
      const nextRows = [...current];
      imported.forEach((item) => {
        nextRows.push({ ...item, id: null, _key: item._key || tempKey(), order: nextOrderFor(nextRows, item.category) });
      });
      return nextRows;
    });
    setPage(1);
    toast(`Imported ${imported.length} FAQ${imported.length === 1 ? "" : "s"} into the draft. Save changes to publish.`);
  };

  const resetDraft = async () => {
    setNotice(null);
    editingDraftRef.current = false;
    setEditingDraft(false);
    const fresh = await reload();
    if (!fresh) {
      toast("Could not reload FAQs from the database.", "error");
      return;
    }
    const rows = toDraftRows(fresh);
    setBaseline(rows);
    setDraftFaqs(rows);
    setPage(1);
    toast("Unsaved changes discarded. The current database FAQs have been reloaded.");
  };

  const saveDraft = async () => {
    if (!hasChanges) {
      editingDraftRef.current = false;
      setEditingDraft(false);
      toast("There are no unsaved FAQ changes.");
      return;
    }

    setSaving(true);
    setNotice(null);
    try {
      const baselineById = new Map(baseline.filter((faq) => faq.id !== null && faq.id !== undefined).map((faq) => [String(faq.id), faq]));
      const persistedDraft = draftFaqs.filter((faq) => faq.id !== null && faq.id !== undefined);
      const changedExisting = persistedDraft.filter((faq) => {
        const old = baselineById.get(String(faq.id));
        return old && fieldsChanged(faq, old);
      });
      const newFaqs = draftFaqs.filter((faq) => faq.id === null || faq.id === undefined);
      const deletedIds = baseline
        .filter((old) => !draftFaqs.some((faq) => faq.id !== null && faq.id !== undefined && String(faq.id) === String(old.id)))
        .map((faq) => faq.id);

      for (const faq of changedExisting) {
        const { error } = await supabase
          .from("faqs")
          .update({
            category: faq.category,
            question: faq.q,
            answer: faq.a,
            full_span: Boolean(faq.fullSpan),
            sort_order: Number(faq.order) || 0,
            updated_at: new Date().toISOString(),
          })
          .eq("id", faq.id);
        if (error) throw error;
      }

      if (newFaqs.length > 0) {
        const rows = newFaqs.map((faq) => ({
          category: faq.category,
          question: faq.q,
          answer: faq.a,
          full_span: Boolean(faq.fullSpan),
          sort_order: Number(faq.order) || 0,
          updated_at: new Date().toISOString(),
        }));
        const { error } = await supabase.from("faqs").insert(rows);
        if (error) throw error;
      }

      if (deletedIds.length > 0) {
        const { error } = await supabase.from("faqs").delete().in("id", deletedIds);
        if (error) throw error;
      }

      const fresh = await reload();
      if (!fresh) throw new Error("Changes were sent, but the updated FAQ list could not be reloaded. Refresh the page to verify the database.");
      const rows = toDraftRows(fresh);
      setBaseline(rows);
      setDraftFaqs(rows);
      editingDraftRef.current = false;
      setEditingDraft(false);
      toast("FAQ changes saved. The customer FAQ page will update from Supabase automatically.");
    } catch (saveError) {
      toast(saveError?.message || "Some FAQ changes could not be saved.", "error");
    } finally {
      setSaving(false);
    }
  };

  const openForm = (faq = null) => {
    setEditingFaq(faq);
    setIsFormOpen(true);
  };

  if (loading) return <p className="text-xs text-[#5f5e5e]">Loading FAQs...</p>;

  return (
    <div className="space-y-6">
      {notice && (
        <div className={`flex items-center gap-2 rounded-xl border border-[#121212] px-4 py-2 text-xs font-bold shadow-sm ${notice.type === "error" ? "bg-red-100 text-red-700" : "bg-[#ccff00] text-[#121212]"}`} role="status">
          {notice.type === "error" ? <AlertTriangle className="h-4 w-4 shrink-0" /> : <CheckCircle className="h-4 w-4 shrink-0" />}
          <span>{notice.text}</span>
        </div>
      )}
      {loadError && <p className="text-xs font-semibold text-red-600">Couldn't load FAQs: {loadError}</p>}

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <SectionTitle icon={HelpCircle} title="Court FAQs & Guidelines" subtitle="Edit FAQ content here. Save changes to publish the database updates to the customer page." />
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setIsUploadOpen(true)} disabled={saving} className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#121212] bg-white px-3 py-1.5 text-xs font-semibold text-[#121212] transition-colors hover:bg-neutral-100 disabled:opacity-50"><Upload className="h-3 w-3 stroke-[2.2]" /><span>Upload infos</span></button>
          <button type="button" onClick={() => openForm()} disabled={saving} style={{ backgroundColor: LIME }} className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#121212] px-3.5 py-1.5 text-xs font-bold text-[#121212] transition-all hover:brightness-95 disabled:opacity-50"><Plus className="h-3.5 w-3.5 stroke-[2.5]" /><span>Add Question</span></button>
        </div>
      </div>

      <div className="flex flex-col justify-between gap-3 pt-1 md:flex-row md:items-center">
        <div className="flex flex-wrap items-center gap-2">
          <Chip active={selectedCategory === "ALL"} onClick={() => { setSelectedCategory("ALL"); setPage(1); }}>All Questions ({categoryCounts.ALL})</Chip>
          {FAQ_CATEGORIES.map((category) => <Chip key={category.id} active={selectedCategory === category.id} onClick={() => { setSelectedCategory(category.id); setPage(1); }}>{category.label} ({categoryCounts[category.id] || 0})</Chip>)}
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#5f5e5e]" />
          <input type="text" placeholder="Search FAQs & keywords..." value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setPage(1); }} className={`${inputBase} pl-8`} />
          {searchQuery && <button type="button" onClick={() => { setSearchQuery(""); setPage(1); }} className="absolute right-2.5 top-2 text-[11px] font-semibold text-[#5f5e5e] hover:text-[#121212]">Clear</button>}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#121212]/20">
        <table className="w-full min-w-[620px] text-left text-xs">
          <thead><tr className="border-b border-[#121212] bg-[#f9faf2]">
            {[["No.", "w-14"], ["Category", "w-36"], ["Question / Title", ""], ["Answer / Policy Summary", ""], ["Action", "text-right w-24"]].map(([heading, className]) => <th key={heading} className={`px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[#5f5e5e] sm:px-4 sm:text-[10.5px] ${className}`}>{heading}</th>)}
          </tr></thead>
          <tbody>
            {paginatedFaqs.map((faq) => (
              <tr key={faq._key} className="border-b border-[#c4c9ac] transition-colors hover:bg-neutral-50/80">
                <td className="px-3 py-2.5 sm:px-4"><span style={{ backgroundColor: LIME }} className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-[#121212] text-[10px] font-extrabold text-[#121212]">{faq.num}</span></td>
                <td className="px-3 py-2.5 sm:px-4"><span className="inline-block whitespace-nowrap rounded-md border border-[#121212]/40 bg-[#f3f5e0] px-2 py-0.5 text-[10px] font-bold text-[#444933]">{categoryLabel(faq.category)}</span></td>
                <td className="px-3 py-2.5 font-semibold text-[#121212] sm:px-4"><div className="flex items-center gap-1.5"><span>{faq.q}</span>{faq.fullSpan && <span className="rounded border border-neutral-300 bg-neutral-100 px-1.5 text-[9px] font-bold text-neutral-600">Wide</span>}{faq.id == null && <span className="rounded border border-amber-300 bg-amber-50 px-1.5 text-[9px] font-bold text-amber-800">New</span>}</div></td>
                <td className="max-w-xs px-3 py-2.5 text-xs text-[#5f5e5e] sm:max-w-md sm:px-4"><p className="line-clamp-2 leading-relaxed">{cleanText(faq.a)}</p></td>
                <td className="px-3 py-2.5 text-right sm:px-4"><div className="inline-flex items-center justify-end gap-1.5">
                  <button type="button" title="Quick preview card" onClick={() => setPreviewFaq(faq)} className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-[#121212] bg-white text-[#121212] transition-colors hover:bg-neutral-100"><Eye className="h-3.5 w-3.5" /></button>
                  <RowActionMenu label={faq.q} onEdit={() => openForm(faq)} onDuplicate={() => handleStageDuplicateFaq(faq)} onDelete={() => handleStageDeleteFaq(faq._key)} />
                </div></td>
              </tr>
            ))}
            {filteredFaqs.length === 0 && <tr><td colSpan={5} className="py-10 text-center text-xs text-[#5f5e5e]"><p className="font-semibold text-neutral-700">{draftFaqs.length === 0 ? "No FAQs in the database yet." : "No FAQs found matching your criteria."}</p><p className="mt-1 text-[11px] text-neutral-500">{draftFaqs.length === 0 ? "Use Add Question or Upload infos to add content, then Save changes." : "Try another keyword, or clear the category filter."}</p></td></tr>}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col items-center justify-between gap-2.5 pt-1 text-xs text-[#5f5e5e] sm:flex-row">
        <div>Showing <span className="font-bold text-[#121212]">{filteredFaqs.length === 0 ? 0 : startIndex + 1}</span> to <span className="font-bold text-[#121212]">{Math.min(startIndex + FAQS_PER_PAGE, filteredFaqs.length)}</span> of <span className="font-bold text-[#121212]">{filteredFaqs.length}</span> FAQ items{selectedCategory !== "ALL" && ` in ${categoryLabel(selectedCategory)}`}</div>
        <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />
      </div>

      <ActionBar onReset={resetDraft} onSave={saveDraft} saveLabel="Save changes" section="FAQs & guidelines" saving={saving} hasChanges={Boolean(hasChanges)} />

      {previewFaq && createPortal(
        <div onClick={() => setPreviewFaq(null)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div onClick={(event) => event.stopPropagation()} className="relative w-full max-w-lg rounded-2xl border border-[#121212] bg-[#f3f5e0] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#c4c9ac] pb-3"><span className="text-[11px] font-bold uppercase tracking-wider text-[#556306]">Customer card preview · {categoryLabel(previewFaq.category)}</span><button type="button" aria-label="Close preview" onClick={() => setPreviewFaq(null)} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-[#121212] bg-white text-[#121212] hover:bg-neutral-100"><X className="h-4 w-4" /></button></div>
            <div className="mt-4 flex items-start gap-4 rounded-2xl border border-[#E3DCB8] bg-white p-5 shadow-sm"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#D7E84B] bg-[#F4F9CE] text-sm font-extrabold text-[#556306]">{previewFaq.num}</div><div className="min-w-0 flex-1 space-y-1.5"><h3 className="text-base font-bold leading-snug text-[#141414]">{previewFaq.q}</h3><p className="text-sm leading-relaxed text-[#4E4B3E]"><FaqText text={previewFaq.a} /></p></div></div>
            <div className="mt-4 flex items-center justify-end gap-2"><button type="button" onClick={() => { const target = previewFaq; setPreviewFaq(null); openForm(target); }} className="cursor-pointer rounded-xl border border-[#121212] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#121212] hover:bg-neutral-100">Edit this question</button><button type="button" onClick={() => setPreviewFaq(null)} className="cursor-pointer rounded-xl border border-[#121212] bg-[#ccff00] px-4 py-1.5 text-xs font-bold text-[#121212]">Close preview</button></div>
          </div>
        </div>,
        document.body
      )}

      <FaqFormModal isOpen={isFormOpen} initialData={editingFaq} categoryDefault={selectedCategory === "ALL" ? "GENERAL" : selectedCategory} onClose={() => { setIsFormOpen(false); setEditingFaq(null); }} onSave={handleStageSaveFaq} />
      <FaqUploadModal isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} onImport={handleStageImport} />
    </div>
  );
}

export default FaqsTab;
