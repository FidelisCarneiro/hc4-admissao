// Retorna 0..100 (quanto maior, mais legível)
export async function scoreFileLegibility(file){
  const type = (file.type || "").toLowerCase();

  try{
    if (type.includes("pdf")){
      return await scorePdf(file);
    }
    if (type.startsWith("image/")){
      return await scoreImage(file);
    }
    // fallback
    return 70;
  } catch {
    return 60;
  }
}

async function scorePdf(file){
  // renderiza 1ª página com pdf.js e calcula nitidez/contraste
  const pdfjsLib = await import("https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.min.mjs");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs";

  const buf = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buf }).promise;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 1.3 });

  const canvas = document.createElement("canvas");
  canvas.width = Math.min(1200, Math.floor(viewport.width));
  canvas.height = Math.min(1600, Math.floor(viewport.height));
  const ctx = canvas.getContext("2d");

  await page.render({ canvasContext: ctx, viewport: page.getViewport({ scale: canvas.width / viewport.width }) }).promise;

  const img = ctx.getImageData(0,0,canvas.width,canvas.height);
  return scoreFromImageData(img);
}

async function scoreImage(file){
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise((res, rej) => { img.onload=res; img.onerror=rej; img.src=url; });

  const canvas = document.createElement("canvas");
  const maxW = 1200;
  const scale = Math.min(1, maxW/img.width);
  canvas.width = Math.max(200, Math.floor(img.width*scale));
  canvas.height = Math.max(200, Math.floor(img.height*scale));
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const data = ctx.getImageData(0,0,canvas.width,canvas.height);
  URL.revokeObjectURL(url);

  return scoreFromImageData(data);
}

function scoreFromImageData(img){
  // Converte para tons de cinza + calcula variância do Laplaciano (nitidez) e contraste
  const { data, width, height } = img;
  const gray = new Float32Array(width*height);

  for (let i=0, p=0; i<data.length; i+=4, p++){
    gray[p] = 0.299*data[i] + 0.587*data[i+1] + 0.114*data[i+2];
  }

  // contraste (std dev)
  let sum=0, sum2=0;
  for (let i=0;i<gray.length;i++){ sum+=gray[i]; sum2+=gray[i]*gray[i]; }
  const mean = sum/gray.length;
  const variance = (sum2/gray.length) - mean*mean;
  const std = Math.sqrt(Math.max(0, variance)); // 0..~80

  // laplaciano (nitidez)
  let lapSum2 = 0;
  for (let y=1;y<height-1;y++){
    for (let x=1;x<width-1;x++){
      const c = gray[y*width + x];
      const lap = (-4*c)
        + gray[(y-1)*width + x]
        + gray[(y+1)*width + x]
        + gray[y*width + (x-1)]
        + gray[y*width + (x+1)];
      lapSum2 += lap*lap;
    }
  }
  const lapVar = lapSum2 / ((width-2)*(height-2)); // quanto maior, mais nítido

  // normalização simples para 0..100
  const contrastScore = clamp((std/55)*100, 0, 100);
  const sharpScore = clamp((lapVar/900)*100, 0, 100);

  // média ponderada
  return clamp(0.55*sharpScore + 0.45*contrastScore, 0, 100);
}

function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
