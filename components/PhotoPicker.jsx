// components/PhotoPicker.jsx
import { useRef } from "react";

export default function PhotoPicker({ value = [], onChange, captionEnabled = true, defaultCaption = "" }) {
  const inputRef = useRef(null);

  const addFiles = (fileList) => {
    const arr = Array.from(fileList || []).map((f) => ({
      file: f,
      url: URL.createObjectURL(f),
      caption: defaultCaption || "",   // ตั้งค่าเริ่มต้นได้
    }));
    onChange?.([...(value || []), ...arr]);
  };

  const removeAt = (idx) => {
    const next = (value || []).filter((_, i) => i !== idx);
    onChange?.(next);
  };

  const setCaption = (idx, text) => {
    const next = (value || []).map((it, i) => (i === idx ? { ...it, caption: text } : it));
    onChange?.(next);
  };

  return (
    <div className="card">
      <label className="block text-sm mb-1">ภาพถ่ายประกอบ</label>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        capture="environment"
        onChange={(e) => addFiles(e.target.files)}
        className="mb-3 w-full"
      />

      {(value || []).length > 0 && (
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {value.map((it, i) => (
            <div key={i} className="flex gap-3 bg-neutral-800 rounded-xl p-2 items-start">
              <img src={it.url} alt="" className="h-16 w-16 object-cover rounded-lg" />
              <div className="flex-1">
                <div className="text-xs text-neutral-400 mb-1">{it.file?.name}</div>
                {captionEnabled && (
                  <input
                    value={it.caption || ""}
                    onChange={(e) => setCaption(i, e.target.value)}
                    placeholder="คำอธิบายภาพ (caption)"
                    className="w-full rounded-lg bg-neutral-900 px-2 py-1 text-sm outline-none"
                  />
                )}
              </div>
              <button onClick={() => removeAt(i)} className="px-3 py-1 rounded-lg bg-red-600">ลบ</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
