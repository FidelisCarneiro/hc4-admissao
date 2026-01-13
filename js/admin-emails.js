// js/admin-emails.js
import { supabase } from "./supabase.js";

function parseEmails(str) {
  if (!str) return [];
  return str
    .split(/[;, \n]+/g)
    .map(s => s.trim())
    .filter(Boolean);
}

const textarea = document.getElementById("admin_notify_emails");
const statusEl = document.getElementById("emailsStatus");

document.getElementById("btnLoadEmails").addEventListener("click", async () => {
  statusEl.textContent = "Carregando...";
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "notify_emails")
    .maybeSingle();

  if (error) {
    statusEl.textContent = "Erro ao carregar.";
    console.error(error);
    return;
  }

  const emails = data?.value?.emails || [];
  textarea.value = emails.join("; ");
  statusEl.textContent = "OK.";
});

document.getElementById("btnSaveEmails").addEventListener("click", async () => {
  statusEl.textContent = "Salvando...";

  const emails = parseEmails(textarea.value);

  const { data, error } = await supabase.functions.invoke("admin-update-settings", {
    body: { key: "notify_emails", value: { emails } }
  });

  if (error) {
    statusEl.textContent = "Erro ao salvar (ver console).";
    console.error(error);
    return;
  }

  statusEl.textContent = "Salvo com sucesso!";
});
