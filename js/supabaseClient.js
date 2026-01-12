/* global supabase, HC4_CONFIG */
window.sb = supabase.createClient(
  window.HC4_CONFIG.SUPABASE_URL,
  window.HC4_CONFIG.SUPABASE_ANON_KEY
);
