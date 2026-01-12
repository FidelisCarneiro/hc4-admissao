import { supabase } from "./supabaseClient.js";

const $ = (id) => document.getElementById(id);

function onlyDigits(v){ return (v||"").replace(/\D/g,""); }
function cpfToEmail(cpf){ return `${onlyDigits(cpf).slice(0,11)}@hc4.local`; }

async function loadSessionRedirect(){
  const { data } = await supabase.auth.getSession();
  if (data?.session?.user) {
    // decide destino pelo profile
    const { data: prof } = await supabase.from("profiles").select("role,must_change_password").eq("user_id", data.session.user.id).single();
    if (prof?.must_change_password) {
      // força tela de troca via prompt simples
      await forceChangePassword();
    }
    window.location.href = (prof?.role === "ADMIN") ? "./admin.html" : "./form.html";
  }
}
loadSessionRedirect();

async function forceChangePassword(){
  let newPass = prompt("Primeiro acesso: crie uma nova senha (mínimo 6 caracteres):");
  if (!newPass || newPass.length < 6) {
    alert("Senha inválida.");
    return;
  }
  const { error } = await supabase.auth.updateUser({ password: newPass });
  if (error) { alert("Erro ao trocar senha: " + error.message); return; }

  // marca no profile
  const { data: s } = await supabase.auth.getSession();
  const uid = s?.session?.user?.id;
  if (uid) await supabase.from("profiles").update({ must_change_password: false }).eq("user_id", uid);
  alert("Senha alterada com sucesso ✅");
}

$("btnForgot").addEventListener("click", async () => {
  alert("Para reset de senha, solicite ao administrador do sistema.");
});

$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = $("loginMsg");
  msg.className = "msg";
  msg.textContent = "Entrando…";

  const cpf = onlyDigits($("cpf").value);
  const password = $("password").value;

  if (cpf.length !== 11) {
    msg.className = "msg err";
    msg.textContent = "CPF deve ter 11 dígitos.";
    return;
  }

  const email = cpfToEmail(cpf);

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    msg.className = "msg err";
    msg.textContent = "Falha no login: " + error.message;
    return;
  }

  // checa profile
  const { data: prof } = await supabase.from("profiles").select("role,is_active,must_change_password").eq("user_id", data.user.id).single();
  if (!prof?.is_active) {
    await supabase.auth.signOut();
    msg.className = "msg err";
    msg.textContent = "Usuário inativo. Procure o administrador.";
    return;
  }

  if (prof.must_change_password) {
    await forceChangePassword();
  }

  msg.className = "msg ok";
  msg.textContent = "Login OK ✅ Redirecionando…";
  window.location.href = (prof.role === "ADMIN") ? "./admin.html" : "./form.html";
});
