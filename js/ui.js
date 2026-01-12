function toast(msg, small=""){
  const el = document.getElementById("toast");
  if(!el) return alert(msg);
  el.querySelector(".msg").textContent = msg;
  el.querySelector(".small").textContent = small || "";
  el.classList.add("show");
  clearTimeout(window.__toastT);
  window.__toastT = setTimeout(()=>el.classList.remove("show"), 4500);
}

function fmtCpfDigits(v){
  return (v||"").replace(/\D/g,"").slice(0,11);
}

function fmtDateBRFromISO(iso){
  if(!iso) return "";
  // iso: yyyy-mm-dd
  const [y,m,d] = iso.split("-");
  if(!y||!m||!d) return iso;
  return `${d.padStart(2,"0")}/${m.padStart(2,"0")}/${y}`;
}

function fmtDateISOFromBR(br){
  if(!br) return "";
  const m = br.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if(!m) return br;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function sanitizeNameForFile(name){
  return (name||"")
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-zA-Z0-9\s-]/g,"")
    .replace(/\s+/g," ")
    .trim();
}

async function ensureSignedIn(){
  const { data } = await window.sb.auth.getSession();
  if(!data.session) location.href = "login.html";
  return data.session;
}

async function currentUserAndProfile(){
  const session = await ensureSignedIn();
  const user = session.user;
  const { data: profile, error } = await window.sb
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();
  if(error) throw error;
  return { user, profile };
}
