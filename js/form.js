let fotoImageDataUrl = null;

async function fileToOrientedJpegDataUrl(file){
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });

  const max = 900; // mantém bom e leve
  let w = bmp.width, h = bmp.height;
  const scale = Math.min(1, max / Math.max(w, h));
  w = Math.round(w * scale);
  h = Math.round(h * scale);

  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const cx = c.getContext("2d");
  cx.drawImage(bmp, 0, 0, w, h);

  return c.toDataURL("image/jpeg", 0.9);
}

// ... no input da foto (key foto_3x4)
document.getElementById("file_foto_3x4")?.addEventListener("change", async (e) => {
  const f = (e.target.files || [])[0];
  if (!f) { fotoImageDataUrl = null; return; }
  fotoImageDataUrl = await fileToOrientedJpegDataUrl(f);
});
