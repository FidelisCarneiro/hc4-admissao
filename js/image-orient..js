// js/image-orient.js
export async function fileToOrientedDataURL(file, maxW = 900, maxH = 900) {
  // Lê como bitmap com orientação do arquivo (corrige foto tombada)
  const blob = file instanceof Blob ? file : new Blob([file]);
  const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });

  // Redimensiona para PDF (evita peso)
  const scale = Math.min(maxW / bitmap.width, maxH / bitmap.height, 1);
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, w, h);

  return canvas.toDataURL("image/jpeg", 0.9);
}
