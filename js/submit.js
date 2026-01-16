// js/submit.js
import { supabase } from "./supabase.js";

function parseEmails(str) {
  if (!str) return [];
  return str
    .split(/[;, \n]+/g)
    .map(s => s.trim())
    .filter(Boolean);
}

async function getDefaultNotifyEmails() {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "notify_emails")
    .maybeSingle();

  if (error || !data?.value?.emails) return [];
  return data.value.emails;
}

export async function submitPackage(submissionId) {
  // (1) pega emails digitados no formulário (se você tiver esse campo)
  const typed = document.getElementById("notify_emails")?.value || "";
  const typedEmails = parseEmails(typed);

  // (2) pega emails padrão do admin
  const defaultEmails = await getDefaultNotifyEmails();

  // (3) combina + remove duplicados
  const allEmails = Array.from(new Set([...(defaultEmails || []), ...(typedEmails || [])]));

  // (4) chama edge function
  const { data, error } = await supabase.functions.invoke("submit-package", {
    body: { submission_id: submissionId, notify_emails: allEmails }
  });

  if (error) {
    console.error(error);
    alert("Falhou ao enviar. Veja o status/erro no Supabase (submissions).");
    return null;
  }

  alert("Enviado! PDFs + ZIP gerados e e-mail disparado (se configurado).");
  return data;
}
