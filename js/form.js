import { supabase } from "./supabaseClient.js";
import { FUNCTIONS } from "./config.js";
import { makeCadastroPDF, makePlanoPDF, ddmmyyyy } from "./pdf.js";
import { buildZipFromUploads } from "./zip.js";
import { scoreFileLegibility } from "./legibility.js";

const $ = (id) => document.getElementById(id);
function onlyDigits(v){ return (v||"").replace(/\D/g,""); }

const DOCS_ORDER = [
  { key:"foto_3x4", label:"Foto 3x4 (recente)", accept:"image/*", multi:false },
  { key:"rg", label:"RG (frente e verso)", accept:"application/pdf,image/*", multi:true },
  { key:"cpf", label:"CPF", accept:"application/pdf,image/*", multi:false },
  { key:"titulo", label:"Título de Eleitor", accept:"application/pdf,image/*", multi:false },
  { key:"pis", label:"Cartão do PIS/PASEP", accept:"application/pdf,image/*", multi:false },
  { key:"reservista", label:"Certificado de Reservista (se masculino)", accept:"application/pdf,image/*", multi:false },
  { key:"nascimento", label:"Certidão de Nascimento", accept:"application/pdf,image/*", multi:false },
  { key:"casamento", label:"Certidão de Casamento (se aplicável)", accept:"application/pdf,image/*", multi:false },
  { key:"residencia", label:"Comprovante de Residência", accept:"application/pdf,image/*", multi:false },
  { key:"escolaridade", label:"Certificado de Escolaridade", accept:"application/pdf,image/*", multi:false },
  { key:"ctps", label:"CTPS (física/digital)", accept:"application/pdf,image/*", multi:false },
  { key:"vacinacao", label:"Comprovante de Vacinação (Covid-19)", accept:"application/pdf,image/*", multi:false },
  { key:"sus", label:"Cartão do SUS", accept:"application/pdf,image/*", multi:false },
  { key:"curriculo", label:"Currículo atualizado", accept:"application/pdf,image/*", multi:false },
  { key:"certificados", label:"Certificado/Cursos (quando exigido)", accept:"application/pdf,image/*", multi:true },
  { key:"dados_bancarios", label:"Dados bancários (Itaú)", accept:"application/pdf,image/*", multi:false },
  { key:"cartao_transporte", label:"Cópia do Cartão de Transporte", accept:"application/pdf,image/*", multi:false },
  { key:"cnh", label:"CNH", accept:"application/pdf,image/*", multi:false },
  { key:"cert_nasc_filhos", label:"Certidão de Nascimento dos filhos", accept:"application/pdf,image/*", multi:true },
  { key:"sus_dependentes", label:"Cartão do SUS dos dependentes", accept:"application/pdf,image/*", multi:true },
  { key:"rgcpf_familia", label:"RG e CPF (cônjuge + filhos)", accept:"application/pdf,image/*", multi:true },
  { key:"vac_filhos_7", label:"Caderneta de Vacinação (filhos < 7 anos)", accept:"application/pdf,image/*", multi:true },
  { key:"comp_escolar_7_14", label:"Comprovante escolar (filhos 7 a 14 anos)", accept:"application/pdf,image/*", multi:true },
  { key:"conselho", label:"Registro no Conselho Profissional (CREA/CRA/CRC/OAB/CRM…)", accept:"application/pdf,image/*", multi:true },
];

let profile = null;

async function requireLogin(){
  const { data: sess } = await supabase.auth.getSession();
  if (!sess?.session?.user) { window.location.href = "./index.html"; return; }

  const uid = sess.session.user.id;
  const { data: prof } = await supabase.from("profiles").select("full_name,role,cpf").eq("user_id", uid).single();
  if (!prof) { alert("Perfil não encontrado."); await supabase.auth.signOut(); window.location.href="./index.html"; return; }
  profile = prof;

  $("whoami").textContent = `Olá, ${prof.full_name}. Vamos preencher com calma 🙂`;
  $("footerUser").textContent = `Usuário: ${prof.full_name}`;

  if (prof.role === "ADMIN") $("adminLink").style.display = "inline-flex";
}
await requireLogin();

$("btnLogout").addEventListener("click", async () => {
  await supabase.auth.signOut();
  window.location.href="./index.html";
});

$("estadoCivil").addEventListener("change", (e) => {
  const v = e.target.value || "";
  $("wrapDataCasamento").style.display = v.includes("Casad") ? "block" : "none";
});

function depBlock(type, idx){
  const el = document.createElement("div");
  el.className = "rep-item";
  el.innerHTML = `
    <div class="rep-head">
      <b>${type} #${idx+1}</b>
      <button class="btn" type="button" data-remove>Remover</button>
    </div>
    <div class="grid grid-3">
      <label class="field"><span>Nome</span><input name="${type}[${idx}][nome]" required /></label>
      <label class="field"><span>CPF</span><input name="${type}[${idx}][cpf]" inputmode="numeric" maxlength="11" /></label>
      <label class="field"><span>Data nascimento</span><input name="${type}[${idx}][nascimento]" type="date" /></label>
      <label class="field"><span>Grau parentesco</span><input name="${type}[${idx}][parentesco]" /></label>
      <label class="field"><span>Observações</span><input name="${type}[${idx}][obs]" /></label>
    </div>
  `;
  el.querySelector("[data-remove]").addEventListener("click", () => el.remove());
  return el;
}

$("addDepIR").addEventListener("click", () => {
  const idx = $("depsIRPF").children.length;
  $("depsIRPF").appendChild(depBlock("dependentes_irpf", idx));
});
$("addDepPL").addEventListener("click", () => {
  const idx = $("depsPLANO").children.length;
  $("depsPLANO").appendChild(depBlock("dependentes_plano", idx));
});

// docs UI
const docsWrap = $("docs");
const uploads = {}; // key => File[]
for (const d of DOCS_ORDER){
  uploads[d.key] = [];
  const row = document.createElement("div");
  row.className = "doc-item";
  row.innerHTML = `
    <div class="doc-top">
      <div class="doc-name">
        <span class="doc-pill">${d.label}</span>
      </div>
      <div class="doc-score" id="score_${d.key}">Legibilidade: —</div>
    </div>
    <input type="file" ${d.multi ? "multiple" : ""} accept="${d.accept}" id="file_${d.key}" />
    <small class="hint">Formato preferencial: PDF. Se enviar imagem, envie legível e sem cortes.</small>
  `;
  docsWrap.appendChild(row);

  row.querySelector(`#file_${d.key}`).addEventListener("change", async (e) => {
    const files = Array.from(e.target.files || []);
    uploads[d.key] = files;

    // legibility scoring
    const scores = [];
    for (const f of files){
      const s = await scoreFileLegibility(f);
      scores.push(s);
    }
    const minScore = scores.length ? Math.min(...scores) : null;
    const txt = minScore === null ? "—" : `${minScore.toFixed(0)} / 100`;
    row.querySelector(`#score_${d.key}`).textContent = `Legibilidade: ${txt}` + (minScore !== null && minScore < 55 ? " ⚠️" : " ✅");
  });
}

// assinatura canvas
const canvas = $("sigCanvas");
const ctx = canvas.getContext("2d");
ctx.lineWidth = 3;
ctx.lineCap = "round";
ctx.strokeStyle = "#111";

let drawing = false;
let last = null;

function pos(ev){
  const r = canvas.getBoundingClientRect();
  const x = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
  const y = (ev.touches ? ev.touches[0].clientY : ev.clientY) - r.top;
  return { x: x*(canvas.width/r.width), y: y*(canvas.height/r.height) };
}
function start(ev){ drawing=true; last=pos(ev); ev.preventDefault(); }
function move(ev){
  if(!drawing) return;
  const p = pos(ev);
  ctx.beginPath(); ctx.moveTo(last.x,last.y); ctx.lineTo(p.x,p.y); ctx.stroke();
  last=p; ev.preventDefault();
}
function end(){ drawing=false; last=null; }

canvas.addEventListener("mousedown", start);
canvas.addEventListener("mousemove", move);
window.addEventListener("mouseup", end);
canvas.addEventListener("touchstart", start, { passive:false });
canvas.addEventListener("touchmove", move, { passive:false });
canvas.addEventListener("touchend", end);

$("sigClear").addEventListener("click", () => {
  ctx.clearRect(0,0,canvas.width,canvas.height);
});

// foto (quadrado) obrigatório
let fotoImageDataUrl = null;
$("fotoFile").addEventListener("change", async (e) => {
  const f = e.target.files?.[0];
  if(!f) return;
  const imgUrl = await fileToDataUrl(f);
  fotoImageDataUrl = imgUrl;
});

function fileToDataUrl(file){
  return new Promise((resolve,reject)=>{
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function collectRepeater(prefix){
  const container = prefix === "dependentes_irpf" ? $("depsIRPF") : $("depsPLANO");
  const items = [];
  container.querySelectorAll(".rep-item").forEach((wrap) => {
    const obj = {};
    wrap.querySelectorAll("input").forEach(inp => {
      const name = inp.getAttribute("name"); // dependentes_x[y][field]
      const field = name.match(/\[([a-z_]+)\]$/)?.[1] || name;
      obj[field] = inp.value;
    });
    // normaliza datas dd/mm/aaaa pro payload (o PDF já formata)
    if (obj.nascimento) obj.nascimento = ddmmyyyy(obj.nascimento);
    if (obj.cpf) obj.cpf = onlyDigits(obj.cpf);
    items.push(obj);
  });
  return items;
}

function collectFormPayload(){
  const fd = new FormData($("mainForm"));
  const payload = {};
  for (const [k,v] of fd.entries()){
    payload[k] = String(v);
  }

  // normalizações
  payload.cpf = onlyDigits(payload.cpf);
  if (payload.nascimento) payload.nascimento = ddmmyyyy(payload.nascimento);
  if (payload.rg_emissao) payload.rg_emissao = ddmmyyyy(payload.rg_emissao);
  if (payload.cnh_vencimento) payload.cnh_vencimento = ddmmyyyy(payload.cnh_vencimento);
  if (payload.data_casamento) payload.data_casamento = ddmmyyyy(payload.data_casamento);

  payload.dependentes_irpf = collectRepeater("dependentes_irpf");
  payload.dependentes_plano = collectRepeater("dependentes_plano");

  payload.usuario_rodape = profile?.full_name || "";

  return payload;
}

async function validateBeforeSend(payload){
  // CPF
  if (payload.cpf?.length !== 11) return "CPF inválido (11 dígitos).";
  // Banco Itaú
  if ((payload.banco || "").toLowerCase() !== "itaú" && (payload.banco || "").toLowerCase() !== "itau") {
    return "Dados bancários: banco deve ser Itaú.";
  }
  if (!fotoImageDataUrl) return "Envie a foto 3x4.";

  // legibilidade mínima (se tiver anexos)
  let hasBad = false;
  for (const d of DOCS_ORDER){
    const files = uploads[d.key] || [];
    for (const f of files){
      const s = await scoreFileLegibility(f);
      if (s < 45) hasBad = true;
    }
  }
  if (hasBad) {
    return "Alguns anexos parecem pouco legíveis (pontuação baixa). Troque por arquivos mais nítidos antes de enviar.";
  }
  return null;
}

$("btnPreview").addEventListener("click", async () => {
  const msg = $("formMsg"); msg.className="msg"; msg.textContent="Gerando prévias…";
  const payload = collectFormPayload();

  const assinatura = canvas.toDataURL("image/png");
  const cadastroBlob = await makeCadastroPDF(payload, fotoImageDataUrl, assinatura);
  const planoBlob = await makePlanoPDF(payload, fotoImageDataUrl, assinatura);

  // abre prévia em nova aba
  window.open(URL.createObjectURL(cadastroBlob), "_blank");
  window.open(URL.createObjectURL(planoBlob), "_blank");

  msg.className="msg ok";
  msg.textContent="Prévia gerada ✅ (duas abas abertas)";
});

$("mainForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = $("formMsg"); msg.className="msg"; msg.textContent="Validando…";

  const payload = collectFormPayload();
  const err = await validateBeforeSend(payload);
  if (err) { msg.className="msg err"; msg.textContent=err; return; }

  msg.textContent="Gerando PDFs e ZIP…";

  const assinatura = canvas.toDataURL("image/png");
  const pdfCadastro = await makeCadastroPDF(payload, fotoImageDataUrl, assinatura);
  const pdfPlano = await makePlanoPDF(payload, fotoImageDataUrl, assinatura);

  const zipBlob = await buildZipFromUploads(payload.nome, uploads, DOCS_ORDER);

  msg.textContent="Enviando…";

  const { data: sess } = await supabase.auth.getSession();
  const token = sess?.session?.access_token;

  const formData = new FormData();
  formData.append("payload", JSON.stringify(payload));
  formData.append("pdfCadastro", new File([pdfCadastro], "Ficha_Cadastro.pdf", { type:"application/pdf" }));
  formData.append("pdfPlano", new File([pdfPlano], "Ficha_Plano_Saude.pdf", { type:"application/pdf" }));
  formData.append("zipDocs", new File([zipBlob], "Documentos.zip", { type:"application/zip" }));

  const res = await fetch(`${supabase.functions.url}/${FUNCTIONS.submitPackage}`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}` },
    body: formData
  });

  const out = await res.json();
  if (!res.ok) {
    msg.className="msg err";
    msg.textContent = out.error || "Falha ao enviar.";
    return;
  }

  msg.className="msg ok";
  msg.textContent = `Enviado ✅ Protocolo: ${out.submission_id}` + (out.warning ? " (E-mail com aviso)" : "");
});
