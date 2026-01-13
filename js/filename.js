// js/filename.js
export function cleanNameForFile(name) {
  return (name || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function pdfNameFicha(nome) {
  return `${cleanNameForFile(nome)} - ficha cadastral.pdf`;
}

export function pdfNamePlano(nome) {
  return `${cleanNameForFile(nome)} - plano de saude.pdf`;
}
