// js/doc-filename.js
import { cleanNameForFile } from "./filename.js";

export function docFileName(index1based, nome, label, ext = "pdf") {
  const n = String(index1based).padStart(2, "0");
  const safeNome = cleanNameForFile(nome);
  const safeLabel = cleanNameForFile(label);
  return `${n} - ${safeNome} - ${safeLabel}.${ext}`;
}
