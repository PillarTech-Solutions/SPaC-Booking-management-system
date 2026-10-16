import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase_client';

// Current info = default (used until/unless the database answers)
export const DEFAULT_SETTINGS = {
  business_name: 'Saranay Pickleball Court',
  facebook: 'facebook.com/saranaypickleball',
  address: 'Saranay Homes, Block 5 Lot 13 Saranay Road, Bagumbong, North, Caloocan',
  phone_primary: '0927-045-8745',
  phone_secondary: '0906-545-8384',
  logo_url: null,
  banner_url: null,
};

export const telHref = (p = '') => 'tel:' + p.replace(/[^\d+]/g, '');
export const facebookHref = (v = '') => (/^https?:\/\//.test(v) ? v : `https://${v}`);
export const facebookLabel = (v = '') => v.replace(/^https?:\/\/(www\.)?/, '');

export function useSiteSettings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('site_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error('Settings load failed:', error.message);
        else if (data) setSettings({ ...DEFAULT_SETTINGS, ...data });
      });
    return () => { cancelled = true; };
  }, []);

  return { settings };
}