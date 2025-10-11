export async function compressImage(file, maxW = 1280, quality = 0.8) {
  const img = await fileToImage(file);
  const scale = Math.min(1, maxW / img.width);
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality));
  return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
}
function fileToImage(file){
  return new Promise((resolve,reject)=>{
    const fr = new FileReader();
    fr.onload = () => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = fr.result; };
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}
