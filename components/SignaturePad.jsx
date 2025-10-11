import { useEffect, useRef } from 'react';
import SignaturePadLib from 'signature_pad';

export default function SignaturePad({ value, onChange, height = 180 }) {
  const canvasRef = useRef(null);
  const padRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = height * ratio;
    const ctx = canvas.getContext('2d');
    ctx.scale(ratio, ratio);

    padRef.current = new SignaturePadLib(canvas, { backgroundColor: 'rgb(23 23 23)' });
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, canvas.width/ratio, height);
      img.src = value;
    }
    return () => padRef.current?.off();
  }, [height]);

  const clear = () => { padRef.current?.clear(); onChange?.(null); };
  const save = () => {
    if (!padRef.current || padRef.current.isEmpty()) return;
    const data = padRef.current.toDataURL('image/png');
    onChange?.(data);
  };

  return (
    <div className="card">
      <div className="mb-2 text-sm opacity-80">ลายเซ็นลูกค้า</div>
      <canvas ref={canvasRef} className="w-full rounded-lg border border-neutral-800 bg-neutral-900" style={{height}}/>
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={clear} className="bg-neutral-800">ล้าง</button>
        <button type="button" onClick={save} className="bg-emerald-600">บันทึกลายเซ็น</button>
      </div>
      {value && <div className="mt-2 text-xs opacity-70">บันทึกแล้ว ✓</div>}
    </div>
  );
}
