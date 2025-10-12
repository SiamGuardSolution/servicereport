// components/SignaturePad.jsx
import { useEffect, useRef, useState } from 'react';
import SignaturePadLib from 'signature_pad';

export default function SignaturePad({
  value,                 // dataURL ที่บันทึกไว้ (เช่น 'data:image/png;base64,...')
  onChange,
  height = 180,
  penColor = '#16a34a',  // สีปากกา (default เขียว)
  minWidth = 0.8,
  maxWidth = 2.2,
  bgColor = 'rgb(23 23 23)', // สีพื้นหลังตอนใช้งานบนจอ (เทาเข้มให้ตัดกับเส้น)
  saveBg = 'white',      // 'white' = บันทึกบนพื้นขาว, 'transparent' = โปร่งใส
  autoSaveOnEnd = false, // true = เซฟอัตโนมัติเมื่อยกปากกา
  disabled = false,
}) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const padRef = useRef(null);
  const roRef = useRef(null);
  const [loadedOnce, setLoadedOnce] = useState(false);

  // วาดพื้นหลังสีก่อนเริ่ม (เฉพาะบนแคนวาสแสดงผล)
  const paintBg = (ctx, w, h) => {
    ctx.save();
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  };

  // ตั้งขนาดแคนวาสตาม DPR
  const fitCanvas = () => {
    if (!canvasRef.current || !wrapRef.current) return;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);

    const cssW = Math.floor(wrap.clientWidth);
    const cssH = Math.floor(height);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    canvas.width = Math.max(1, Math.round(cssW * ratio));
    canvas.height = Math.max(1, Math.round(cssH * ratio));

    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);     // reset
    ctx.scale(ratio, ratio);
    paintBg(ctx, cssW, cssH);
  };

  // สร้าง/ทำลาย SignaturePad
  useEffect(() => {
    if (typeof window === 'undefined') return; // SSR guard
    const canvas = canvasRef.current;
    if (!canvas) return;

    fitCanvas();

    const pad = new SignaturePadLib(canvas, {
      penColor,
      minWidth,
      maxWidth,
      backgroundColor: null, // ไม่ลงสีพื้นหลังถาวรบนบัฟเฟอร์ เพื่อวาดเอง (ให้ชัดบน DPR)
    });
    padRef.current = pad;

    if (disabled) pad.off();
    else pad.on();

    // โหลดลายเซ็นเดิม (ถ้ามี) ทับลงบนพื้นหลัง
    if (value && !loadedOnce) {
      const img = new Image();
      img.onload = () => {
        const ctx = canvas.getContext('2d');
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        const cssW = Math.floor(wrapRef.current?.clientWidth || canvas.width / ratio);
        const cssH = Math.floor(height);
        paintBg(ctx, cssW, cssH);
        ctx.drawImage(img, 0, 0, cssW, cssH);
        setLoadedOnce(true);
      };
      img.src = value;
    }

    // บันทึกอัตโนมัติเมื่อยกปากกา (ออปชัน)
    const onEnd = () => {
      if (!autoSaveOnEnd) return;
      doSave();
    };
    pad.addEventListener('endStroke', onEnd);

    // คอย fit เมื่อรีไซซ์คอนเทนเนอร์
    if ('ResizeObserver' in window) {
      roRef.current = new ResizeObserver(() => {
        const data = pad.isEmpty() ? null : pad.toData();   // เก็บเวกเตอร์ strokes ไว้ชั่วคราว
        fitCanvas();
        pad.clear();
        if (data) pad.fromData(data);                       // วาดคืนหลังปรับขนาด
      });
      roRef.current.observe(wrapRef.current);
    } else {
      const onR = () => {
        const data = pad.isEmpty() ? null : pad.toData();
        fitCanvas();
        pad.clear();
        if (data) pad.fromData(data);
      };
      window.addEventListener('resize', onR);
      roRef.current = { disconnect: () => window.removeEventListener('resize', onR) };
    }

    return () => {
      try { pad.removeEventListener('endStroke', onEnd); } catch {}
      pad.off();
      pad.clear();
      padRef.current = null;
      roRef.current?.disconnect?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height, penColor, minWidth, maxWidth, bgColor, autoSaveOnEnd, disabled]);

  // เปลี่ยน value จากภายนอก -> วาดทับ
  useEffect(() => {
    if (!value || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const cssW = Math.floor(wrapRef.current?.clientWidth || canvas.width / ratio);
    const cssH = Math.floor(height);
    const img = new Image();
    img.onload = () => {
      paintBg(ctx, cssW, cssH);
      ctx.drawImage(img, 0, 0, cssW, cssH);
    };
    img.src = value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // ล้างลายเซ็น
  const clear = () => {
    const pad = padRef.current;
    if (!pad) return;
    pad.clear();
    // วาดพื้นหลังกลับเข้าไป
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const cssW = Math.floor(wrapRef.current?.clientWidth || canvas.width / ratio);
    const cssH = Math.floor(height);
    paintBg(ctx, cssW, cssH);
    onChange?.(null);
  };

  // ย้อนกลับ 1 สโตรก
  const undo = () => {
    const pad = padRef.current;
    if (!pad) return;
    const data = pad.toData();
    if (!data || data.length === 0) return;
    data.pop();
    pad.fromData(data);
  };

  // บันทึกเป็น PNG dataURL (พื้นหลังตามค่า saveBg)
  const doSave = () => {
    const pad = padRef.current;
    const canvas = canvasRef.current;
    if (!pad || !canvas || pad.isEmpty()) return;

    // สร้างบัฟเฟอร์ใหม่เพื่อควบคุมพื้นหลังขณะ export
    const exportCanvas = document.createElement('canvas');
    const cssW = Math.floor(canvas.clientWidth);
    const cssH = Math.floor(height);
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    exportCanvas.width = Math.max(1, Math.round(cssW * ratio));
    exportCanvas.height = Math.max(1, Math.round(cssH * ratio));
    const ectx = exportCanvas.getContext('2d');

    // scale แล้วทาสีพื้นหลัง
    ectx.scale(ratio, ratio);
    if (saveBg === 'white') {
      ectx.fillStyle = '#ffffff';
      ectx.fillRect(0, 0, cssW, cssH);
    } else {
      // transparent
      ectx.clearRect(0, 0, cssW, cssH);
    }
    // วาดภาพจากแคนวาสหลัก
    ectx.drawImage(canvas, 0, 0, cssW, cssH);

    const dataUrl = exportCanvas.toDataURL('image/png'); // PNG ชัด/พื้นหลังตามที่เลือก
    onChange?.(dataUrl);
  };

  return (
    <div className="card" ref={wrapRef}>
      <div className="mb-2 text-sm opacity-80">ลายเซ็นลูกค้า</div>
      <canvas
        ref={canvasRef}
        className="w-full rounded-lg border border-neutral-800 bg-neutral-900"
        style={{ height }}
      />
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={clear} disabled={disabled} className="px-3 py-1 rounded-lg bg-neutral-800 disabled:opacity-60">ล้าง</button>
        <button type="button" onClick={undo} disabled={disabled} className="px-3 py-1 rounded-lg bg-neutral-700 disabled:opacity-60">Undo</button>
        <button type="button" onClick={doSave} disabled={disabled} className="px-3 py-1 rounded-lg bg-emerald-600 disabled:opacity-60">บันทึกลายเซ็น</button>
      </div>
      {value && <div className="mt-2 text-xs opacity-70">บันทึกแล้ว ✓</div>}
    </div>
  );
}
