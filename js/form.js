/* global toast, fmtCpfDigits, fmtDateBRFromISO, sanitizeNameForFile, HC4_CONFIG */

const REQUIRED_FILES = [
  { key:"foto", label:"Foto 3x4", accept:"image/*,application/pdf" },
  { key:"rg", label:"RG (frente e verso)", accept:"application/pdf,image/*" },
  { key:"cpf", label:"CPF", accept:"application/pdf,image/*" },
  { key:"titulo", label:"Título de Eleitor", accept:"application/pdf,image/*" },
  { key:"pis", label:"PIS/PASEP", accept:"application/pdf,image/*" },
  { key:"reservista", label:"Certificado de Reservista (masculino)", accept:"application/pdf,image/*" },
  { key:"nascimento", label:"Certidão de Nascimento", accept:"application/pdf,image/*" },
  { key:"casamento", label:"Certidão de Casamento (se casado)", accept:"application/pdf,image/*" },
  { key:"residencia", label:"Comprovante de Residência", accept:"application/pdf,image/*" },
  { key:"escolaridade", label:"Certificado de escolaridade", accept:"application/pdf,image/*" },
  { key:"ctps", label:"CTPS (física ou digital)", accept:"application/pdf,image/*" },
  { key:"vacinacao", label:"Comprovante de vacinação (Covid-19)", accept:"application/pdf,image/*" },
  { key:"sus", label:"Cartão do SUS", accept:"application/pdf,image/*" },
  { key:"curriculo", label:"Currículo atualizado", accept:"application/pdf,image/*" },
  { key:"certificado", label:"Certificado / Curso (quando exigido)", accept:"application/pdf,image/*" },
  { key:"cursos", label:"Cursos (outros)", accept:"application/pdf,image/*" },
  { key:"dadosbanc", label:"Dados bancários (Itaú) — comprovante", accept:"application/pdf,image/*" },
  { key:"transporte", label:"Cópia do cartão de transporte", accept:"application/pdf,image/*" },
  { key:"cnh", label:"CNH", accept:"application/pdf,image/*" },
  { key:"filhos_nasc", label:"Certidão de nascimento dos filhos", accept:"application/pdf,image/*" },
  { key:"sus_deps", label:"Cartão do SUS dos dependentes", accept:"application/pdf,image/*" },
  { key:"rgcpf_familia", label:"RG e CPF (cônjuge + filhos)", accept:"application/pdf,image/*" },
  { key:"vac_filhos", label:"Caderneta de vacinação (filhos <7)", accept:"application/pdf,image/*" },
  { key:"escolar_filhos", label:"Comprovante escolar (filhos 7–14)", accept:"application/pdf,image/*" },
  { key:"conselho", label:"Registro no Conselho Profissional (se houver)", accept:"application/pdf,image/*" },
];

let session, user, profile;
let draftId = null;
let uploaded = {}; // key -> File
let sigPad;

function showHideCasamento(){
  const v = document.getElementById("estadoCivil").value;
  const row = document.getElementById("casamentoRow");
  row.style.display = (v && v.toLowerCase().includes("casad")) ? "grid" : "none";
}

function todayBR(){
  const d = new Date();
  const dd = String(d.getDate()).padStart(2,"0");
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
}

function setFooter(){
  document.getElementById("footerUser").textContent = "Usuário: " + (user?.email || "");
}

function readForm(){
  const get = id => document.getElementById(id)?.value ?? "";
  return {
    nome: get("nome"),
    cpf: fmtCpfDigits(get("cpf")),
    nascimento: get("nascimento"),
    email: get("email"),
    telefone: get("telefone"),
    estadoCivil: get("estadoCivil"),
    dataCasamento: get("dataCasamento"),
    conjugeNome: get("conjugeNome"),
    rgNumero: get("rgNumero"),
    rgOrgao: get("rgOrgao"),
    rgUf: get("rgUf"),
    naturalCidade: get("naturalCidade"),
    naturalUf: get("naturalUf"),
    cnhNumero: get("cnhNumero"),
    cnhCat: get("cnhCat"),
    cnhVenc: get("cnhVenc"),
    endRua: get("endRua"),
    endNumero: get("endNumero"),
    endCompl: get("endCompl"),
    endBairro: get("endBairro"),
    endCidade: get("endCidade"),
    endUf: get("endUf"),
    endCep: get("endCep"),
    endRef: get("endRef"),
    endLocalRef: get("endLocalRef"),
    emergNome: get("emergNome"),
    emergFone: get("emergFone"),
    indicNome: get("indicNome"),
    indicFone: get("indicFone"),
    itauAg: get("itauAg"),
    itauConta: get("itauConta"),
    psOperadora: get("psOperadora"),
    psPlano: get("psPlano"),
    psTipo: get("psTipo"),
    psCopart: get("psCopart"),
    psObs: get("psObs"),
  };
}

function fillForm(payload){
  if(!payload) return;
  const set = (id, v) => { const el = document.getElementById(id); if(el && v!==undefined && v!==null) el.value = v; };
  for(const [k,v] of Object.entries(payload)){
    set(k, v);
  }
  showHideCasamento();
}

function buildFileInputs(){
  const root = document.getElementById("files");
  root.innerHTML = "";
  for(const item of REQUIRED_FILES){
    const wrap = document.createElement("div");
    wrap.className = "filebox";
    wrap.innerHTML = `
      <div class="meta">
        <div class="title">${item.label}</div>
        <div class="desc">Anexe PDF legível (ou imagem). Se houver mais de um arquivo, envie um PDF com todas as páginas.</div>
        <input type="file" id="file_${item.key}" accept="${item.accept}"/>
      </div>
      <div class="status warn" id="st_${item.key}">Pendente</div>
    `;
    root.appendChild(wrap);

    const inp = wrap.querySelector(`#file_${item.key}`);
    inp.addEventListener("change", async (e)=>{
      const f = e.target.files?.[0];
      if(!f) return;
      uploaded[item.key] = f;
      const ok = await checkLegibility(f);
      const st = document.getElementById(`st_${item.key}`);
      if(ok === true){ st.textContent = "OK"; st.className = "status ok"; }
      else if(ok === "warn"){ st.textContent = "Atenção (baixa qualidade)"; st.className = "status warn"; toast("Atenção", `Arquivo "${item.label}" pode estar pouco legível.`); }
      else { st.textContent = "Problema"; st.className = "status err"; toast("Problema", `Não consegui validar "${item.label}". Verifique se está legível e tente outro arquivo.`); }
    });
  }
}

// PDF legibility check (pdf + images)
async function checkLegibility(file){
  try{
    const type = file.type || "";
    if(type.includes("pdf")){
      // render first page with pdfjs and evaluate basic contrast/blur
      const data = new Uint8Array(await file.arrayBuffer());
      const pdf = await pdfjsLib.getDocument({ data }).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1.2 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      await page.render({ canvasContext: ctx, viewport }).promise;

      const imgData = ctx.getImageData(0,0,canvas.width,canvas.height);
      const { variance, edge } = analyzeImage(imgData);
      // heuristics
      if(variance < 1200) return "warn";
      if(edge < 0.6) return "warn";
      return true;
    }

    if(type.startsWith("image/")){
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(()=>null);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const w = (bmp?.width)||800, h=(bmp?.height)||600;
      canvas.width = Math.min(w, 1200);
      canvas.height = Math.round(canvas.width * (h/w));
      if(bmp) ctx.drawImage(bmp,0,0,canvas.width,canvas.height);
      else {
        const url = await fileToDataURL(file);
        const im = await loadImage(url);
        ctx.drawImage(im,0,0,canvas.width,canvas.height);
      }
      const imgData = ctx.getImageData(0,0,canvas.width,canvas.height);
      const { variance, edge } = analyzeImage(imgData);
      if(variance < 900) return "warn";
      if(edge < 0.5) return "warn";
      return true;
    }

    // unknown type
    return "warn";
  }catch(e){
    return false;
  }
}

function analyzeImage(imgData){
  const d = imgData.data;
  let n = 0;
  let sum = 0;
  let sum2 = 0;
  // grayscale stats
  for(let i=0;i<d.length;i+=16){
    const r=d[i], g=d[i+1], b=d[i+2];
    const y = 0.299*r + 0.587*g + 0.114*b;
    sum += y;
    sum2 += y*y;
    n++;
  }
  const mean = sum/n;
  const variance = sum2/n - mean*mean;

  // simple edge measure: avg abs diff horizontally
  let edges=0, count=0;
  const w = imgData.width;
  const h = imgData.height;
  for(let y=0; y<h; y+=8){
    for(let x=1; x<w; x+=8){
      const idx = (y*w + x)*4;
      const idx2 = (y*w + (x-1))*4;
      const y1 = 0.299*d[idx]+0.587*d[idx+1]+0.114*d[idx+2];
      const y0 = 0.299*d[idx2]+0.587*d[idx2+1]+0.114*d[idx2+2];
      edges += Math.abs(y1-y0);
      count++;
    }
  }
  const edge = (edges/count)/255; // 0..1
  return { variance, edge };
}

function fileToDataURL(file){
  return new Promise((resolve,reject)=>{
    const r = new FileReader();
    r.onload = ()=>resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
function loadImage(src){
  return new Promise((resolve,reject)=>{
    const img = new Image();
    img.onload = ()=>resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function initSignature(){
  const canvas = document.getElementById("sigCanvas");
  const ctx = canvas.getContext("2d");
  const resize = ()=>{
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111827";
  };
  resize();
  window.addEventListener("resize", ()=>{ ctx.setTransform(1,0,0,1,0,0); resize(); });

  let drawing=false, last=null;

  const pos = (e)=>{
    const r = canvas.getBoundingClientRect();
    const t = e.touches?.[0];
    const x = (t ? t.clientX : e.clientX) - r.left;
    const y = (t ? t.clientY : e.clientY) - r.top;
    return {x,y};
  };

  const start = (e)=>{ drawing=true; last=pos(e); e.preventDefault(); };
  const move = (e)=>{
    if(!drawing) return;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last=p;
    e.preventDefault();
  };
  const end = ()=>{ drawing=false; last=null; };

  canvas.addEventListener("mousedown", start);
  canvas.addEventListener("mousemove", move);
  window.addEventListener("mouseup", end);

  canvas.addEventListener("touchstart", start, {passive:false});
  canvas.addEventListener("touchmove", move, {passive:false});
  window.addEventListener("touchend", end);

  document.getElementById("sigClear").onclick = ()=>{
    ctx.clearRect(0,0,canvas.width,canvas.height);
  };

  sigPad = {
    toDataURL: ()=> canvas.toDataURL("image/png")
  };
}

async function setPhotoForPdf(imgId){
  const foto = uploaded["foto"];
  const el = document.getElementById(imgId);
  if(!foto || !el) return;
  if(foto.type.includes("pdf")){
    // não dá pra extrair foto de PDF aqui; usar placeholder
    el.src = "assets/logo-hc4.png";
    return;
  }
  // respect EXIF if supported
  const bmp = await createImageBitmap(foto, { imageOrientation: "from-image" }).catch(()=>null);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const w = bmp ? bmp.width : 800;
  const h = bmp ? bmp.height : 800;
  canvas.width = w;
  canvas.height = h;
  if(bmp) ctx.drawImage(bmp,0,0);
  else {
    const url = await fileToDataURL(foto);
    const im = await loadImage(url);
    canvas.width = im.width; canvas.height=im.height;
    ctx.drawImage(im,0,0);
  }
  el.src = canvas.toDataURL("image/jpeg",0.95);
}

function addRow(tbody, label, value){
  if(!value) return;
  const tr = document.createElement("tr");
  tr.innerHTML = `<td style="padding:6px 0;width:180px"><b>${label}</b></td><td style="padding:6px 0">${value}</td>`;
  tbody.appendChild(tr);
}

function renderPdfData(payload){
  // Cadastro
  const rows = document.getElementById("cadastroRows");
  rows.innerHTML = "";
  addRow(rows,"Nome:", payload.nome);
  addRow(rows,"CPF:", payload.cpf);
  addRow(rows,"Nascimento:", fmtDateBRFromISO(payload.nascimento));
  addRow(rows,"E-mail:", payload.email);
  addRow(rows,"Telefone:", payload.telefone);
  addRow(rows,"Estado civil:", payload.estadoCivil);
  if(payload.estadoCivil?.toLowerCase().includes("casad")){
    addRow(rows,"Casamento:", fmtDateBRFromISO(payload.dataCasamento));
  }
  addRow(rows,"RG nº:", payload.rgNumero);
  addRow(rows,"RG órgão:", payload.rgOrgao);
  addRow(rows,"RG UF:", payload.rgUf);
  addRow(rows,"Naturalidade:", `${payload.naturalCidade || ""}/${payload.naturalUf || ""}`.replace(/^\//,"").replace(/\/$/,""));
  addRow(rows,"CNH nº:", payload.cnhNumero);
  addRow(rows,"CNH cat.:", payload.cnhCat);
  addRow(rows,"CNH venc.:", fmtDateBRFromISO(payload.cnhVenc));

  addRow(rows,"Endereço:", `${payload.endRua||""}, ${payload.endNumero||""} ${payload.endCompl||""}`.trim());
  addRow(rows,"Bairro/Cidade:", `${payload.endBairro||""} - ${payload.endCidade||""}/${payload.endUf||""}`.trim());
  addRow(rows,"CEP:", payload.endCep);
  addRow(rows,"Referência:", payload.endRef || payload.endLocalRef);

  addRow(rows,"Emergência:", `${payload.emergNome||""} (${payload.emergFone||""})`.trim());
  addRow(rows,"Indicação:", `${payload.indicNome||""} (${payload.indicFone||""})`.trim());

  addRow(rows,"Itaú Agência:", payload.itauAg);
  addRow(rows,"Itaú Conta:", payload.itauConta);

  // Plano de saúde
  const tit = document.getElementById("planoTitular");
  tit.innerHTML = `
    <div><b>Titular:</b> ${payload.nome || ""}</div>
    <div><b>CPF:</b> ${payload.cpf || ""}</div>
    <div><b>Operadora:</b> ${payload.psOperadora || ""}</div>
    <div><b>Plano:</b> ${payload.psPlano || ""}</div>
    <div><b>Tipo:</b> ${payload.psTipo || ""}</div>
    <div><b>Co-participação:</b> ${payload.psCopart || ""}</div>
    <div><b>Obs:</b> ${payload.psObs || ""}</div>
  `;

  document.getElementById("cadastroDataHoje").textContent = todayBR();
  document.getElementById("planoDataHoje").textContent = todayBR();
}

async function makePdfFromElement(elId){
  const el = document.getElementById(elId);
  const canvas = await html2canvas(el, { scale: 2, useCORS:true });
  const imgData = canvas.toDataURL("image/jpeg", 0.95);
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF("p", "pt", "a4");
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  // fit
  const ratio = Math.min(pageW / canvas.width, pageH / canvas.height);
  const w = canvas.width * ratio;
  const h = canvas.height * ratio;
  const x = (pageW - w)/2;
  const y = 0;
  pdf.addImage(imgData, "JPEG", x, y, w, h);
  return pdf;
}

async function pdfBlob(pdf){
  return pdf.output("blob");
}

async function saveDraft(){
  const payload = readForm();
  if(!payload.nome || payload.cpf.length!==11){
    toast("Preencha ao menos Nome e CPF (11 dígitos) para salvar.");
    return;
  }
  const { data: up, error } = await sb.from("submissions").upsert({
    id: draftId || undefined,
    user_id: user.id,
    notify_email: (await getNotifyEmail()),
    status: "DRAFT",
    payload
  }).select("id").single();
  if(error){ toast("Erro ao salvar rascunho", error.message); return; }
  draftId = up.id;
  toast("Rascunho salvo ✅");
}

async function getNotifyEmail(){
  const { data: s } = await sb.from("app_settings").select("value").eq("key","default_notify_email").maybeSingle();
  return s?.value || HC4_CONFIG.DEFAULT_NOTIFY_EMAIL;
}

async function previewPdfs(){
  const payload = readForm();
  if(!payload.nome || payload.cpf.length!==11){ toast("Preencha Nome e CPF."); return; }
  renderPdfData(payload);
  await setPhotoForPdf("pdfFoto1");
  await setPhotoForPdf("pdfFoto2");
  document.getElementById("pdfSig1").src = sigPad.toDataURL();
  document.getElementById("pdfSig2").src = sigPad.toDataURL();

  const pdf1 = await makePdfFromElement("pdfCadastro");
  const pdf2 = await makePdfFromElement("pdfPlanoSaude");

  // open in new tabs
  const b1 = await pdfBlob(pdf1);
  const b2 = await pdfBlob(pdf2);
  window.open(URL.createObjectURL(b1), "_blank");
  window.open(URL.createObjectURL(b2), "_blank");
}

async function submitAll(){
  const payload = readForm();
  if(!payload.nome) return toast("Informe o nome.");
  if(payload.cpf.length !== 11) return toast("CPF inválido (11 dígitos).");
  if(!sigPad.toDataURL() || sigPad.toDataURL().length < 2000) return toast("Assine no campo de assinatura.");

  // force casamento only if casado
  if(!(payload.estadoCivil||"").toLowerCase().includes("casad")){
    payload.dataCasamento = "";
  }

  // Ensure required docs attached? We'll warn but allow submit.
  const missing = REQUIRED_FILES.filter(x=>!uploaded[x.key]).map(x=>x.label);
  if(missing.length){
    toast("Atenção", `Faltando anexos: ${missing.slice(0,3).join(", ")}${missing.length>3?"...":""}`);
  }

  renderPdfData(payload);
  await setPhotoForPdf("pdfFoto1");
  await setPhotoForPdf("pdfFoto2");
  const sigData = sigPad.toDataURL();
  document.getElementById("pdfSig1").src = sigData;
  document.getElementById("pdfSig2").src = sigData;

  const pdfCad = await makePdfFromElement("pdfCadastro");
  const pdfPlan = await makePdfFromElement("pdfPlanoSaude");

  const nomeLimpo = sanitizeNameForFile(payload.nome);
  const cadName = `${nomeLimpo} - Ficha Cadastral.pdf`;
  const planName = `${nomeLimpo} - Plano de Saude.pdf`;

  const formData = new FormData();
  formData.append("payload", new Blob([JSON.stringify(payload)], {type:"application/json"}));
  formData.append("signature", sigData);
  formData.append("notify_email", await getNotifyEmail());
  formData.append("pdfCadastro", new File([await pdfBlob(pdfCad)], cadName, { type:"application/pdf" }));
  formData.append("pdfPlano", new File([await pdfBlob(pdfPlan)], planName, { type:"application/pdf" }));

  // attachments
  for(const [key,f] of Object.entries(uploaded)){
    formData.append(`doc_${key}`, f, f.name);
  }

  const accessToken = (await sb.auth.getSession()).data.session.access_token;
  const resp = await fetch(`${HC4_CONFIG.FUNCTIONS_BASE}/submit-package`,{
    method:"POST",
    headers:{ "Authorization": `Bearer ${accessToken}` },
    body: formData
  });

  const j = await resp.json().catch(()=>({}));
  if(!resp.ok){
    toast("Falha ao enviar", j?.error || resp.statusText);
    return;
  }
  toast("Enviado ✅", "Pacote gerado e notificação disparada.");
}

(async function init(){
  session = (await sb.auth.getSession()).data.session;
  if(!session) return location.href="login.html";
  user = session.user;

  // load profile
  const p = await sb.from("profiles").select("*").eq("user_id", user.id).single();
  profile = p.data;
  if(!profile || profile.is_active === false){ await sb.auth.signOut(); return location.href="login.html"; }
  if(profile.must_change_password){ return location.href="reset.html"; }
  if(profile.role === "ADMIN"){ return location.href="admin.html"; }

  setFooter();
  document.getElementById("cpf").addEventListener("input", e => e.target.value = fmtCpfDigits(e.target.value));
  document.getElementById("estadoCivil").addEventListener("change", showHideCasamento);
  showHideCasamento();

  initSignature();
  buildFileInputs();

  // load draft if exists
  const d = await sb.from("submissions").select("id,payload").eq("user_id", user.id).eq("status","DRAFT").order("created_at",{ascending:false}).maybeSingle();
  if(d.data){
    draftId = d.data.id;
    fillForm(d.data.payload);
    toast("Rascunho carregado", "Você pode revisar e enviar quando quiser.");
  } else {
    // prefill cpf and name from profile
    if(profile.name) document.getElementById("nome").value = profile.name;
    if(profile.cpf) document.getElementById("cpf").value = profile.cpf;
  }

  document.getElementById("btnLogout").onclick = async ()=>{ await sb.auth.signOut(); location.href="login.html"; };
  document.getElementById("btnSaveDraft").onclick = saveDraft;
  document.getElementById("btnPreview").onclick = previewPdfs;
  document.getElementById("btnSubmit").onclick = submitAll;
})();
