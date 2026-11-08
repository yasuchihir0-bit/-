// 写真の縮小・切り抜き・base64 変換

async function decode(blob) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(blob, { imageOrientation: 'from-image' });
    } catch { /* 古いブラウザ向けに下の方法へ */ }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toBlob(canvas, quality = 0.85) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('画像に変換できませんでした'))), 'image/jpeg', quality);
  });
}

function drawScaled(src, sx, sy, sw, sh, maxSide) {
  const scale = Math.min(1, maxSide / Math.max(sw, sh));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas;
}

// 取りこんだ写真を保存用に縮小（長い辺 2000px）
export async function normalizePhoto(file, maxSide = 2000) {
  const img = await decode(file);
  const canvas = drawScaled(img, 0, 0, img.width, img.height, maxSide);
  if (img.close) img.close();
  return toBlob(canvas, 0.85);
}

// box は 0〜1 の割合 {x, y, w, h}。null ならページ全体
export async function cropImage(blob, box, maxSide = 1600) {
  const img = await decode(blob);
  const b = box || { x: 0, y: 0, w: 1, h: 1 };
  const sx = Math.round(b.x * img.width);
  const sy = Math.round(b.y * img.height);
  const sw = Math.max(1, Math.round(b.w * img.width));
  const sh = Math.max(1, Math.round(b.h * img.height));
  const canvas = drawScaled(img, sx, sy, sw, sh, maxSide);
  if (img.close) img.close();
  return toBlob(canvas, 0.88);
}

// Claude API に送る用（長い辺 1568px 程度が目安）
export async function toBase64Jpeg(blob, maxSide = 1568) {
  const img = await decode(blob);
  const canvas = drawScaled(img, 0, 0, img.width, img.height, maxSide);
  if (img.close) img.close();
  return canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
}

export function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export async function dataURLToBlob(dataURL) {
  const res = await fetch(dataURL);
  return res.blob();
}
