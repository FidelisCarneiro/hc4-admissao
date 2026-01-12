import { supabase } from "./supabaseClient.js";
import { FUNCTIONS } from "./config.js";

const $ = (id) => document.getElementById(id);
function onlyDigits(v){ return (v||"").replace(/\D/g,""); }

async function requireAdmin(){
  const { data: sess } = await supabase.auth.getSession();
  if (!sess?.session?.user) { window.location.href = "./index.html"; return; }

  const uid = sess.session.user.id;
  const { data: prof } = await supabase.from("profiles").select("full_name,role").eq("user_id", uid).single();
  if (!prof || prof.role !== "ADMIN") { window.location.href = "./form.html"; return; }

  $("whoami").textContent = `Logado como: ${prof.full_name} • ADMIN`;
}
await requireAdmin();

$("btnLogout").addEventListener("click", async () => {
  await supabase.auth.signOut();
  window.location.href = "./index.html";
});

$("createUserForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = $("createMsg"); msg.className="msg"; msg.textContent="Criando…";

  const full_name = $("cu_name").value.trim();
  const cpf = onlyDigits($("cu_cpf").value);
  const role = $("cu_role").value;
  const is_active = $("cu_active").value === "true";

  if (cpf.length !== 11) { msg.className="msg err"; msg.textContent="CPF inválido (11 dígitos)."; return; }

  const { data: sess } = await supabase.auth.getSession();
  const token = sess?.session?.access_token;

  const res = await fetch(`${supabase.functions.url}/${FUNCTIONS.adminCreateUser}`, {
    method: "POST",
    headers: { "Content-Type":"application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({ cpf, full_name, role, is_active })
  });
  const out = await res.json();
  if (!res.ok) { msg.className="msg err"; msg.textContent = out.error || "Erro"; return; }

  msg.className="msg ok";
  msg.textContent = `Usuário criado ✅ Email: ${out.email} • Senha temporária: ${out.senha_temporaria}`;
});

$("resetForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = $("resetMsg"); msg.className="msg"; msg.textContent="Resetando…";

  const user_id = $("rp_userid").value.trim();
  const cpf = onlyDigits($("rp_cpf").value);
  if (!user_id) { msg.className="msg err"; msg.textContent="Informe user_id."; return; }
  if (cpf.length !== 11) { msg.className="msg err"; msg.textContent="CPF inválido."; return; }

  const { data: sess } = await supabase.auth.getSession();
  const token = sess?.session?.access_token;

  const res = await fetch(`${supabase.functions.url}/${FUNCTIONS.adminResetPassword}`, {
    method: "POST",
    headers: { "Content-Type":"application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({ user_id, cpf })
  });

  const out = await res.json();
  if (!res.ok) { msg.className="msg err"; msg.textContent = out.error || "Erro"; return; }

  msg.className="msg ok";
  msg.textContent = `Senha resetada ✅ Nova senha temporária: ${out.senha_temporaria}`;
});

async function loadNotify(){
  const { data } = await supabase.from("app_settings").select("notification_email").eq("id", 1).single();
  if (data?.notification_email) $("notifyEmail").value = data.notification_email;
}
loadNotify();

$("emailForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = $("emailMsg"); msg.className="msg"; msg.textContent="Salvando…";
  const email = $("notifyEmail").value.trim();
  const { error } = await supabase.from("app_settings").upsert({ id: 1, notification_email: email });
  if (error) { msg.className="msg err"; msg.textContent = "Falha (RLS?): " + error.message; return; }
  msg.className="msg ok"; msg.textContent="Salvo ✅";
});
