export async function buildZipFromUploads(nome, uploads, DOCS_ORDER){
  const zip = new window.JSZip();
  const baseName = (nome || "COLABORADOR").trim().replace(/[\\/:*?"<>|]/g, "-");

  function cleanLabel(label){
    return String(label || "")
      .replace(/\(.*?\)/g, "")     // remove parenteses
      .replace(/\s+/g, " ")
      .trim();
  }

  for (let dIndex = 0; dIndex < DOCS_ORDER.length; dIndex++){
    const d = DOCS_ORDER[dIndex];
    const files = uploads[d.key] || [];
    if (!files.length) continue;

    const order = String(dIndex + 1).padStart(2, "0");
    const docName = cleanLabel(d.label);

    for (let i=0; i<files.length; i++){
      const f = files[i];
      const ext = (f.name.split(".").pop() || "pdf").toLowerCase();
      const idx = files.length > 1 ? ` (${i+1})` : "";

      const filename = `${order} - ${baseName} - ${docName}${idx}.${ext}`
        .replace(/[\\/:*?"<>|]/g, "-")
        .replace(/\s+/g, " ")
        .trim();

      zip.file(filename, f);
    }
  }

  return await zip.generateAsync({ type:"blob" });
}
