import { supabase } from './supabase_client'

// "Posted Sep 3, 4:00 PM" (Manila time)
function postedText(iso) {
  const d = new Date(iso)
  const date = d.toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' })
  const time = d.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' })
  return `Posted ${date}, ${time}`
}

// Shape the dashboards and the announcement modals already use
function toAnnouncement(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.message,
    message: row.message,
    pinned: row.is_pinned,
    isPinned: row.is_pinned,
    createdAt: row.created_at,
    postedText: postedText(row.created_at),
  }
}

function readableError(error) {
  if (error?.code === '42501' || /row-level security|permission denied/i.test(error?.message || '')) {
    return new Error('Only the Owner, Admin or Manager can change announcements.')
  }
  return new Error(error?.message || 'Something went wrong with announcements.')
}

// Pinned first, then newest first
export async function fetchAnnouncements() {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw readableError(error)
  return (data || []).map(toAnnouncement)
}

export async function createAnnouncement({ title, message, isPinned = false }) {
  const { error } = await supabase
    .from('announcements')
    .insert({ title: title.trim(), message: message.trim(), is_pinned: Boolean(isPinned) })
  if (error) throw readableError(error)
}

export async function updateAnnouncement(id, { title, message, isPinned }) {
  const { error } = await supabase
    .from('announcements')
    .update({ title: title.trim(), message: message.trim(), is_pinned: Boolean(isPinned) })
    .eq('id', id)
  if (error) throw readableError(error)
}

export async function setAnnouncementPinned(id, pinned) {
  const { error } = await supabase.from('announcements').update({ is_pinned: Boolean(pinned) }).eq('id', id)
  if (error) throw readableError(error)
}

export async function deleteAnnouncement(id) {
  const { error } = await supabase.from('announcements').delete().eq('id', id)
  if (error) throw readableError(error)
}