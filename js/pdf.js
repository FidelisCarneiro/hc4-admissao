export function ddmmyyyy(dateValue){
  // aceita "yyyy-mm-dd" e retorna "dd/mm/yyyy"
  if (!dateValue) return "";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateValue)) return dateValue;
  const m = String(dateValue).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return String(dateValue);
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function text(doc, x, y, label, value){
  const v = (value ?? "").toString().trim();
  if (!v) return y;
  doc.setFont("helvetica","bold"); doc.text(`${label}:`, x, y);
  doc.setFont("helvetica","normal"); doc.text(v, x+45, y);
  return y + 6;
}

function addHeader(doc, title){
  doc.setFillColor(13,59,69); doc.rect(0,0,210,20,"F");
  doc.setTextColor(255,255,255);
  doc.setFont("helvetica","bold"); doc.setFontSize(13);
  doc.text(title, 14, 13);
  doc.setTextColor(15,23,42);
  doc.setFontSize(10);
}

function addFooter(doc, user){
  doc.setFontSize(9);
  doc.setTextColor(100,116,139);
  doc.text(`Usuário: ${user || ""}`, 14, 292);
  doc.setTextColor(15,23,42);
}

function addFotoQuadrada(doc, fotoDataUrl){
  // quadrado 32x32 no topo direito
  doc.setDrawColor(231,234,243);
  doc.rect(165, 26, 32, 32);
  if (fotoDataUrl){
    doc.addImage(fotoDataUrl, "JPEG", 165, 26, 32, 32, undefined, "FAST");
  }
}

function addAssinatura(doc, assinaturaDataUrl, y){
  doc.setDrawColor(231,234,243);
  doc.line(14, y, 120, y);
  if (assinaturaDataUrl){
    doc.addImage(assinaturaDataUrl, "PNG", 14, y-16, 80, 14, undefined, "FAST");
  }
  doc.setFontSize(9);
  doc.setTextColor(100,116,139);
  doc.text("Assinatura", 14, y+4);
  doc.setTextColor(15,23,42);
}

export async function makeCadastroPDF(payload, fotoDataUrl, assinaturaDataUrl){
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:"mm", format:"a4" });

  addHeader(doc, "HC4 • Ficha de Cadastro");
  addFotoQuadrada(doc, fotoDataUrl);

  let y = 30;
  doc.setFontSize(10);

  y = text(doc, 14, y, "Nome", payload.nome);
  y = text(doc, 14, y, "CPF", payload.cpf);
  y = text(doc, 14, y, "Nascimento", payload.nascimento);
  y = text(doc, 14, y, "E-mail", payload.email);
  y = text(doc, 14, y, "Telefone", payload.tel);
  y = text(doc, 14, y, "Estado civil", payload.estado_civil);
  if (payload.estado_civil?.includes("Casad")) y = text(doc, 14, y, "Casamento", payload.data_casamento);

  y += 2;
  doc.setDrawColor(231,234,243); doc.line(14,y,196,y); y += 6;

  y = text(doc, 14, y, "Mãe", payload.mae);
  y = text(doc, 14, y, "Pai", payload.pai);
  y = text(doc, 14, y, "Naturalidade", `${payload.naturalidade_cidade || ""}/${payload.naturalidade_uf || ""}`);

  y += 2;
  doc.line(14,y,196,y); y += 6;

  y = text(doc, 14, y, "RG nº", payload.rg_numero);
  y = text(doc, 14, y, "RG órgão", payload.rg_orgao);
  y = text(doc, 14, y, "RG UF", payload.rg_uf);
  y = text(doc, 14, y, "RG emissão", payload.rg_emissao);

  y += 2;
  doc.line(14,y,196,y); y += 6;

  y = text(doc, 14, y, "CNH nº", payload.cnh_numero);
  y = text(doc, 14, y, "CNH cat.", payload.cnh_categoria);
  y = text(doc, 14, y, "CNH venc.", payload.cnh_vencimento);

  y += 2;
  doc.line(14,y,196,y); y += 6;

  y = text(doc, 14, y, "Endereço", `${payload.logradouro || ""}, ${payload.numero || ""}${payload.complemento ? " - "+payload.complemento : ""}`);
  y = text(doc, 14, y, "Bairro", payload.bairro);
  y = text(doc, 14, y, "Cidade/UF", `${payload.cidade || ""}/${payload.end_uf || ""}`);
  y = text(doc, 14, y, "CEP", payload.cep);
  y = text(doc, 14, y, "Referência", payload.referencia);

  y += 2;
  doc.line(14,y,196,y); y += 6;

  y = text(doc, 14, y, "Banco", payload.banco);
  y = text(doc, 14, y, "Agência", payload.agencia);
  y = text(doc, 14, y, "Conta", payload.conta);

  y += 2;
  doc.line(14,y,196,y); y += 6;

  y = text(doc, 14, y, "Indicação", `${payload.indicacao_nome || ""} • ${payload.indicacao_tel || ""}`);
  y = text(doc, 14, y, "Emergência", `${payload.emerg_nome || ""} • ${payload.emerg_tel || ""}`);

  // assinatura
  addAssinatura(doc, assinaturaDataUrl, 270);
  addFooter(doc, payload.usuario_rodape);

  return doc.output("blob");
}

export async function makePlanoPDF(payload, fotoDataUrl, assinaturaDataUrl){
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:"mm", format:"a4" });

  addHeader(doc, "HC4 • Ficha do Plano de Saúde");
  addFotoQuadrada(doc, fotoDataUrl);

  let y = 30;
  doc.setFontSize(10);

  y = text(doc, 14, y, "Titular", payload.nome);
  y = text(doc, 14, y, "CPF", payload.cpf);
  y = text(doc, 14, y, "Nascimento", payload.nascimento);

  y += 2;
  doc.setDrawColor(231,234,243); doc.line(14,y,196,y); y += 6;

  y = text(doc, 14, y, "Possui plano?", payload.plano_possui);
  y = text(doc, 14, y, "Operadora", payload.plano_operadora);
  y = text(doc, 14, y, "Matrícula", payload.plano_matricula);

  y += 2;
  doc.line(14,y,196,y); y += 6;

  doc.setFont("helvetica","bold");
  doc.text("Dependentes do Plano:", 14, y);
  doc.setFont("helvetica","normal");
  y += 6;

  const deps = Array.isArray(payload.dependentes_plano) ? payload.dependentes_plano : [];
  if (!deps.length){
    doc.text("Nenhum dependente informado.", 14, y); y += 6;
  } else {
    deps.forEach((d, i) => {
      const line = `${i+1}. ${d.nome || ""} • CPF: ${(d.cpf||"")} • Nasc: ${(d.nascimento||"")} • Parentesco: ${(d.parentesco||"")}`;
      doc.text(doc.splitTextToSize(line, 182), 14, y);
      y += 10;
      if (y > 240){ doc.addPage(); y = 20; }
    });
  }

  // DECLARAÇÃO (obrigatória)
  y = 250;
  doc.setDrawColor(231,234,243);
  doc.rect(14, y, 182, 32);

  doc.setFontSize(9);
  doc.setTextColor(15,23,42);
  const dec =
`DECLARAÇÃO
Declaro que as informações acima são verdadeiras e autorizo a inclusão dos dependentes indicados neste formulário no plano de saúde disponibilizado pela empresa. Estou ciente de que a falsidade de informações pode acarretar o cancelamento do benefício e demais penalidades cabíveis.`;
  doc.text(doc.splitTextToSize(dec, 176), 16, y+6);

  // assinatura dentro do bloco
  doc.setDrawColor(200,200,200);
  doc.line(16, y+26, 110, y+26);
  if (assinaturaDataUrl){
    doc.addImage(assinaturaDataUrl, "PNG", 16, y+11, 70, 12, undefined, "FAST");
  }
  doc.text("Assinatura do titular", 16, y+30);

  // data
  const today = new Date();
  const dd = String(today.getDate()).padStart(2,"0");
  const mm = String(today.getMonth()+1).padStart(2,"0");
  const yyyy = String(today.getFullYear());
  doc.text(`Data: ${dd}/${mm}/${yyyy}`, 130, y+30);

  addFooter(doc, payload.usuario_rodape);
  return doc.output("blob");
}
