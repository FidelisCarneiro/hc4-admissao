// js/form-save.js
import { supabase } from "./supabase.js";

export async function saveDraft(submissionId, payload) {
  const { error } = await supabase
    .from("submissions")
    .update({
      data: payload,
      status: "DRAFT",
      updated_at: new Date().toISOString()
    })
    .eq("id", submissionId);

  if (error) throw error;
}

export async function loadDraftByUser(userId) {
  // pega o draft mais recente do usuário
  const { data, error } = await supabase
    .from("submissions")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}
