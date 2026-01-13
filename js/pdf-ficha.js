// js/pdf-ficha.js
import { fileToOrientedDataURL } from "./image-orient.js";
import { pdfNameFicha } from "./filename.js";

function fmtDateBR(value) {
  // aceita yyyy-mm-dd e retorna dd/mm/aaaa
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y,m,d] = value.split("-");
    return `${d}/${m}/${y}`;
  }
  return value; // já veio dd/mm/aaaa
}

export async function gerarPdfFicha({ dados, fotoFile }) {
  // Você provavelmente já usa jsPDF. Mantenha.
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  // Foto (quadrado)
  if (fotoFile) {
    const dataUrl = await fileToOrientedDataURL(fotoFile, 900, 900);
    doc.addImage(dataUrl, "JPEG", 160, 18, 30, 30); // quadrado
    doc.rect(160, 18, 30, 30);
  } else {
    doc.rect(160, 18, 30, 30);
  }

  // Conteúdo mínimo (exemplo)
  doc.setFontSize(14);
  doc.text("HC4 • Ficha de Cadastro", 14, 18);

  doc.setFontSize(10);
  doc.text(`Nome: ${dados.nome || ""}`, 14, 30);
  doc.text(`CPF: ${dados.cpf || ""}`, 14, 36);
  doc.text(`Nascimento: ${fmtDateBR(dados.nascimento)}`, 14, 42);

  // ... aqui você mantém o restante do seu layout

  const blob = doc.output("blob");
  const filename = pdfNameFicha(dados.nome);

  return { blob, filename };
}
