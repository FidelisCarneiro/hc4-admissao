import { supabase } from "./supabase.js";

const REQUIRED_DOCS = [
  "foto","rg","cpf","titulo","pis","reservista","nascimento","casamento","residencia","escolaridade",
  "ctps","vacinacao","sus","curriculo","certificado","cursos","dados_banc","transporte","cnh",
  "filhos_nasc","sus_dep","rgcpf_fam","vac_filhos","esc_filhos","conselho"
];

const rowsEl = document.getElementById("rows");
const qEl = document.getElementById("q");
const countEl = document.getElementById("count");
const btnRefresh = document.getElementById("btnRefresh");

const modal = document.getElementById("modal");
const mClose = document.getElementById("m_close");
const mSave = document.getElementById("m_save");
const mDelete = document.getElementById("m_delete");
const mMeta = document.getElementById("modalMeta");
const mNome = document.getElementById("m_nome");
const mCpf = document.getElementById("m_cpf");
const mNasc = document.getElementById("m_nasc");
const mStatus = document.getElementById("m_status");
const mObs = document.getElementById("m_obs");

const mZip = document.getElementById("m_download_zip");
const mFicha = document.getElementById("m_download_ficha");
const mPlano = document.getElementById("m_download_plano");
const mDlInfo = document.getElementById("m_dl_info");

let current = null;

function fmtDateBR(v){
  if(!v) return "";
  if(/^\d{4}-\d{2}-\d{2}$/.test(v)){
    const [y,m,d]=v.split("-");
    return `${d}/${m}/${y}`;
  }
  return v;
}

function docStatusBadge(uploads){
  const up = uploads || {};
  const okCount = REQUIRED_DOCS.filter(k => !!up[k]).length;
  const total = REQUIRED_DOCS.length;
  const missing = total - okCount;
  const klass = missing === 0 ? "badge ok" : (okCount === 0 ? "badge bad" : "badge warn");
  return `<span class="${klass}">${okCount}/${total} (${missing} faltando)</span>`;
}

function statusBadge(status){
  const s = (status||"").toUpperCase();
  const klass =
    s.includes("DRAFT") ? "badge warn" :
    s.includes("EMAIL_ENVIADO") || s.includes("ENVIADO") ? "badge ok" :
    s.includes("FALHOU") ? "badge bad" : "badge";
  return `<span class="${klass}">${status || "-"}</span>`;
}

async function adminList(query){
  const { data, error } = await supabase.functions.invoke("admin-list-submissions", {
    body: { q: query || "" }
  });
  if(error) throw error;
  return data.items || [];
}

function render(items){
  if(!items.length){
    rowsEl.innerHTML = `<tr><td colspan="7" style="opacity:.7;">Nenhum registro.</td></tr>`;
    countEl.textContent = "0 registros";
    return;
  }

  countEl.textContent = `${items.length} registros`;

  rowsEl.innerHTML = items.map(it => {
    const nome = it.nome || "";
    const cpf = it.cpf || "";
    const nasc = fmtDateBR(it.nascimento);
    const docs = docStatusBadge(it.uploads);
    const st = statusBadge(it.status);
    const envio = it.status?.includes("EMAIL") ? "E-mail" : (it.status||"—");
    return `
      <tr>
        <td>${nome}</td>
        <td>${cpf}</td>
        <td>${nasc}</td>
        <td>${st}</td>
        <td>${docs}</td>
        <td>${envio}</td>
        <td>
          <div class="actions">
            <button data-open="${it.id}" class="primary">Abrir</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  rowsEl.querySelectorAll("[data-open]").forEach(btn => {
    btn.addEventListener("click", () => openModal(btn.getAttribute("data-open")));
  });
}

async function refresh(){
  rowsEl.innerHTML = `<tr><td colspan="7" style="opacity:.7;">Carregando...</td></tr>`;
  const items = await adminList(qEl.value.trim());
  render(items);
}

btnRefresh.addEventListener("click", refresh);
qEl.addEventListener("input", () => {
  // debounce simples
  clearTimeout(window.__t);
  window.__t = setTimeout(refresh, 250);
});

mClose.addEventListener("click", () => modal.classList.remove("open"));

async function openModal(id){
  const { data, error } = await supabase.functions.invoke("admin-get-submission", { body: { id } });
  if(error) return alert("Erro ao abrir (ver console)."), console.error(error);
  current = data.item;

  mMeta.textContent = `ID: ${current.id} • Atualizado: ${current.updated_at || "-"}`;
  mNome.value = current.data?.nome || "";
  mCpf.value = current.data?.cpf || "";
  mNasc.value = fmtDateBR(current.data?.nascimento || "");
  mStatus.value = current.status || "";
  mObs.value = current.admin_note || "";

  mDlInfo.textContent = "";
  modal.classList.add("open");
}

mSave.addEventListener("click", async () => {
  if(!current) return;
  const payload = {
    id: current.id,
    patch: {
      status: mStatus.value,
      admin_note: mObs.value,
      data: {
        ...(current.data || {}),
        nome: mNome.value,
        cpf: mCpf.value,
        nascimento: mNasc.value
      }
    }
  };

  const { error } = await supabase.functions.invoke("admin-update-submission", { body: payload });
  if(error) return alert("Erro ao salvar (ver console)."), console.error(error);

  alert("Salvo!");
  modal.classList.remove("open");
  await refresh();
});

mDelete.addEventListener("click", async () => {
  if(!current) return;
  if(!confirm("Excluir esta submissão?")) return;

  const { error } = await supabase.functions.invoke("admin-delete-submission", { body: { id: current.id } });
  if(error) return alert("Erro ao excluir (ver console)."), console.error(error);

  alert("Excluído!");
  modal.classList.remove("open");
  await refresh();
});

async function download(kind){
  if(!current) return;
  const { data, error } = await supabase.functions.invoke("admin-download-links", {
    body: { id: current.id, kind }
  });
  if(error) return alert("Erro ao gerar link (ver console)."), console.error(error);

  if(!data?.url){
    mDlInfo.textContent = "Arquivo ainda não gerado para esta submissão.";
    return;
  }
  window.open(data.url, "_blank");
}

mZip.addEventListener("click", () => download("zip"));
mFicha.addEventListener("click", () => download("pdf_ficha"));
mPlano.addEventListener("click", () => download("pdf_plano"));

refresh().catch(console.error);
