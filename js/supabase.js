// js/supabase.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

export const SUPABASE_URL = "https://ejbxuizkcyeubcgczlha.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_NUV25qROPZbOOnkNxZOR_g_pQ9Imm9S";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
