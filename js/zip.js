export async function buildZipFromUploads(nome, uploads, DOCS_ORDER){
  const zip = new window.JSZip();
  const baseName = (nome || "COLABORADOR").trim().replace(/[\\/:*?"<>|]/g, "-");

  for (const d of DOCS_ORDER){
    const files = uploads[d.key] || [];
    if (!files.length) continue;

    for (let i=0; i<files.length; i++){
      const f = files[i];
      const ext = (f.name.split(".").pop() || "pdf").toLowerCase();
      const idx = files.length > 1 ? ` (${i+1})` : "";
      const filename = `${baseName} - ${d.label}${idx}.${ext}`
        .replace(/[\\/:*?"<>|]/g, "-")
        .replace(/\s+/g, " ")
        .trim();

      zip.file(filename, f);
    }
  }

  return await zip.generateAsync({ type:"blob" });
}
