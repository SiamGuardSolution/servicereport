/**
 * ย่อ/บีบอัดรูปให้พอดีกับกรอบ (maxW × maxH) แล้วคืนเป็น File ใหม่
 * - ปกติบันทึกเป็น JPEG (คุณภาพ quality 0..1)
 * - ถ้าไม่ต้องการเปลี่ยนเป็น JPEG ให้ส่ง { mime: 'image/png' }
 *
 * @param {File} file        ไฟล์ต้นฉบับ
 * @param {Object} opts
 * @param {number} [opts.maxW=1280]   ความกว้างสูงสุด
 * @param {number} [opts.maxH=1280]   ความสูงสูงสุด
 * @param {number} [opts.quality=0.8] คุณภาพ JPEG (0..1)
 * @param {string} [opts.mime='image/jpeg'] ชนิดไฟล์ผลลัพธ์ ('image/jpeg' | 'image/png' ฯลฯ)
 * @param {boolean} [opts.skipIfNoChange=true] ถ้ารูปเล็กกว่ากรอบและเป็นชนิดเดียวกัน → คืนไฟล์เดิม
 * @returns {Promise<File>}
 */
export async function compressImage(
  file,
  { maxW = 1280, maxH = 1280, quality = 0.8, mime = 'image/jpeg', skipIfNoChange = true } = {}
) {
  if (!(file instanceof File)) throw new Error('compressImage: input is not a File');

  // โหลดภาพด้วย objectURL (เร็วกว่าผ่าน FileReader ในหลายกรณี)
  const img = await loadImageFromFile(file);

  // ถ้าไม่ต้องปรับขนาดและชนิดเดียวกัน ให้คืนไฟล์เดิม (ลดงาน/รักษาคุณภาพ)
  if (skipIfNoChange) {
    const fitsW = img.width  <= maxW;
    const fitsH = img.height <= maxH;
    const sameType = (file.type || '').toLowerCase() === mime.toLowerCase();
    if (fitsW && fitsH && sameType) return file;
  }

  // คำนวณสเกลให้พอดีกับกรอบ (รักษาอัตราส่วน)
  const scale = Math.min(1, maxW / img.width, maxH / img.height);
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d', { alpha: mime !== 'image/jpeg' }); // JPEG ไม่รองรับโปร่งใส

  // วาดภาพ
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  // บางเบราว์เซอร์ (Safari) อาจคืน null → fallback ด้วย toDataURL
  const blob = await new Promise((resolve) => {
    try {
      canvas.toBlob((b) => {
        if (b) return resolve(b);
        // fallback: dataURL → Blob
        const dataURL = canvas.toDataURL(mime, clamp01(quality));
        resolve(dataURLToBlob(dataURL));
      }, mime, clamp01(quality));
    } catch (_) {
      const dataURL = canvas.toDataURL(mime, clamp01(quality));
      resolve(dataURLToBlob(dataURL));
    }
  });

  // ตั้งชื่อใหม่ให้เข้ากับนามสกุลผลลัพธ์
  const newName = renameWithExt(file.name, mime);
  return new File([blob], newName, { type: mime, lastModified: Date.now() });
}

/* ---------------- helpers ---------------- */

function clamp01(x) {
  x = Number.isFinite(x) ? x : 0.8;
  return Math.max(0, Math.min(1, x));
}

function renameWithExt(name, mime) {
  const ext = mime === 'image/png' ? '.png'
            : mime === 'image/webp' ? '.webp'
            : '.jpg';
  return (name || 'image').replace(/\.[^.]+$/, '') + ext;
}

function dataURLToBlob(dataURL) {
  const [header, b64] = String(dataURL).split(',');
  const mime = /data:(.*?);base64/.exec(header)?.[1] || 'application/octet-stream';
  const bin = atob(b64 || '');
  const len = bin.length;
  const u8  = new Uint8Array(len);
  for (let i = 0; i < len; i++) u8[i] = bin.charCodeAt(i);
  return new Blob([u8], { type: mime });
}

async function loadImageFromFile(file) {
  // ใช้ createImageBitmap ถ้ามี (เร็ว/ประหยัดเมมมากขึ้น)
  if (window.createImageBitmap) {
    const bmp = await createImageBitmap(file);
    // แปลงเป็น HTMLImageElement แบบง่ายเพื่อใช้ drawImage (ไม่จำเป็น แต่ unify API)
    const canvas = document.createElement('canvas');
    canvas.width = bmp.width; canvas.height = bmp.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bmp, 0, 0);
    return await new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = canvas.toDataURL(); // สร้าง dataURL ชั่วคราว
    });
  }

  // fallback: Image + objectURL
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}
