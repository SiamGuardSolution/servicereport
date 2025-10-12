// components/PhotoPicker.jsx
import { useEffect, useMemo, useRef } from "react";

function fmtBytes(n = 0) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

export default function PhotoPicker({
  value = [],
  onChange,
  captionEnabled = true,
  defaultCaption = "",
  maxFiles = 20,          // จำกัดจำนวนรูป
  maxTotalMB = 200,       // จำกัดขนาดรวม (MB)
  accept = "image/*",
  capture = "environment" // กำหนดกล้องหลังบนมือถือได้
}) {
  const inputRef = useRef(null);
  const dropRef = useRef(null);

  const totalBytes = useMemo(
    () => (value || []).reduce((s, it) => s + (it.file?.size || 0), 0),
    [value]
  );

  // --- helpers ---
  const makeUrlItem = (f) => ({
    file: f,
    url: URL.createObjectURL(f),
    caption: defaultCaption || "",
  });

  const isDup = (a, b) =>
    a?.file?.name === b?.file?.name &&
    a?.file?.size === b?.file?.size &&
    a?.file?.lastModified === b?.file?.lastModified;

  const addFiles = (fileList) => {
    const incoming = Array.from(fileList || [])
      .filter((f) => f && f.type?.startsWith("image/")); // กันไฟล์แปลก
    if (incoming.length === 0) return;

    // กันจำนวน/ขนาดรวม
    const remain = Math.max(0, maxFiles - (value?.length || 0));
    const pick = incoming.slice(0, remain);
    const currentBytes = totalBytes;
    let bytes = currentBytes;
    const accepted = [];

    for (const f of pick) {
      if ((bytes + (f.size || 0)) > maxTotalMB * 1024 * 1024) break;
      const item = makeUrlItem(f);
      // กันซ้ำ
      if ((value || []).some((v) => isDup(v, item)) || accepted.some((v) => isDup(v, item))) {
        continue;
      }
      bytes += f.size || 0;
      accepted.push(item);
    }

    if (accepted.length > 0) {
      onChange?.([...(value || []), ...accepted]);
    }
  };

  const removeAt = (idx) => {
    const it = (value || [])[idx];
    if (it?.url) URL.revokeObjectURL(it.url);
    const next = (value || []).filter((_, i) => i !== idx);
    onChange?.(next);
  };

  const setCaption = (idx, text) => {
    const next = (value || []).map((it, i) => (i === idx ? { ...it, caption: text } : it));
    onChange?.(next);
  };

  // cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      (value || []).forEach((it) => { if (it?.url) URL.revokeObjectURL(it.url); });
    };
    // เราไม่ใส่ value เป็น dependency เพราะต้องการ cleanup เฉพาะตอน unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // drag & drop
  useEffect(() => {
    const el = dropRef.current;
    if (!el) return;
    const onPrevent = (e) => { e.preventDefault(); e.stopPropagation(); };
    const onDrop = (e) => {
      onPrevent(e);
      addFiles(e.dataTransfer?.files || []);
    };
    el.addEventListener("dragenter", onPrevent);
    el.addEventListener("dragover", onPrevent);
    el.addEventListener("drop", onDrop);
    return () => {
      el.removeEventListener("dragenter", onPrevent);
      el.removeEventListener("dragover", onPrevent);
      el.removeEventListener("drop", onDrop);
    };
  }, []);

  // paste จาก clipboard
  useEffect(() => {
    const onPaste = (e) => {
      if (!e.clipboardData) return;
      const items = Array.from(e.clipboardData.items || []);
      const files = items.map((it) => it.getAsFile()).filter(Boolean);
      if (files.length) addFiles(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  return (
    <div className="card" ref={dropRef}>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-sm">ภาพถ่ายประกอบ</label>
        <div className="text-xs text-neutral-400">
          {value.length}/{maxFiles} • {fmtBytes(totalBytes)} / {maxTotalMB} MB
        </div>
      </div>

      <div className="flex gap-2 mb-2">
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple
          capture={capture}
          onChange={(e) => {
            addFiles(e.target.files);
            // เคลียร์ค่า input เดิมเพื่อให้เลือกไฟล์เดิมซ้ำได้ในครั้งถัดไป
            e.target.value = "";
          }}
          className="w-full"
        />
        <button
          type="button"
          className="px-3 py-2 rounded-lg bg-neutral-700 text-sm"
          onClick={() => inputRef.current?.click()}
        >
          เลือกไฟล์
        </button>
      </div>

      {(value || []).length > 0 && (
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {value.map((it, i) => (
            <div key={i} className="flex gap-3 bg-neutral-800 rounded-xl p-2 items-start">
              <img src={it.url} alt="" className="h-16 w-16 object-cover rounded-lg" />
              <div className="flex-1">
                <div className="text-xs text-neutral-400 mb-1">
                  {it.file?.name} • {fmtBytes(it.file?.size || 0)}
                </div>
                {captionEnabled && (
                  <input
                    value={it.caption || ""}
                    onChange={(e) => setCaption(i, e.target.value)}
                    placeholder="คำอธิบายภาพ (caption)"
                    className="w-full rounded-lg bg-neutral-900 px-2 py-1 text-sm outline-none"
                  />
                )}
              </div>
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="px-3 py-1 rounded-lg bg-red-600"
              >
                ลบ
              </button>
            </div>
          ))}
        </div>
      )}

      {/* hint ลาก-วาง/วางจากคลิปบอร์ด */}
      <div className="mt-2 text-xs text-neutral-500">
        ลาก-วางรูปเข้ากล่องนี้ หรือวาง (Ctrl/⌘+V) เพื่อเพิ่มจากคลิปบอร์ด
      </div>
    </div>
  );
}
