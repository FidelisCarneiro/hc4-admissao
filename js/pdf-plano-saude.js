// js/pdf-plano-saude.js
import { fileToOrientedDataURL } from "./image-orient.js";
import { pdfNamePlano } from "./filename.js";

function fmtDateBR(value) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y,m,d] = value.split("-");
    return `${d}/${m}/${y}`;
  }
  return value;
}

export async function gerarPdfPlanoSaude({ dados, fotoFile, assinaturaDataUrl }) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  // Foto (mesmo padrão)
  if (fotoFile) {
    const dataUrl = await fileToOrientedDataURL(fotoFile, 900, 900);
    doc.addImage(dataUrl, "JPEG", 160, 18, 30, 30);
    doc.rect(160, 18, 30, 30);
  } else {
    doc.rect(160, 18, 30, 30);
  }

  doc.setFontSize(14);
  doc.text("HC4 • Plano de Saúde", 14, 18);

  doc.setFontSize(10);
  doc.text(`Titular: ${dados.nome || ""}`, 14, 30);
  doc.text(`CPF: ${dados.cpf || ""}`, 14, 36);
  doc.text(`Nascimento: ${fmtDateBR(dados.nascimento)}`, 14, 42);

  // Dependentes do plano (exemplo)
  let y = 55;
  doc.setFontSize(11);
  doc.text("Dependentes (Plano de Saúde)", 14, y); y += 6;

  const depsPlano = dados.dependentes_plano || [];
  doc.setFontSize(9);
  if (!depsPlano.length) {
    doc.text("Nenhum dependente informado.", 14, y); y += 6;
  } else {
    depsPlano.forEach((d, idx) => {
      doc.text(`${idx+1}) ${d.nome || ""} • CPF: ${d.cpf || ""} • Nasc: ${fmtDateBR(d.nascimento)}`, 14, y);
      y += 5;
    });
  }

  // Declaração (print que você mandou)
  y += 10;
  doc.setFontSize(10);
  doc.text("DECLARAÇÃO", 14, y); y += 6;
  doc.setFontSize(9);
  doc.text(
    "Declaro que as informações acima são verdadeiras e autorizo a inclusão dos dependentes indicados neste\n" +
    "formulário no plano de saúde disponibilizado pela empresa. Estou ciente de que a falsidade de informações\n" +
    "pode acarretar o cancelamento do benefício e demais penalidades cabíveis.",
    14, y
  );
  y += 20;

  // Assinatura única (mesma para os 2 PDFs)
  doc.setFontSize(9);
  doc.text("Assinatura do titular:", 14, y); y += 2;
  doc.line(45, y, 140, y);
  y += 10;

  if (assinaturaDataUrl) {
    doc.addImage(assinaturaDataUrl, "PNG", 45, y-12, 70, 18);
  }

  doc.text(`Data: ____/____/________`, 14, y + 10);

  const blob = doc.output("blob");
  const filename = pdfNamePlano(dados.nome);
  return { blob, filename };
}
