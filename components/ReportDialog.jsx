// components/ReportDialog.jsx
import React, { useEffect, useRef, useState } from "react";
import { uploadImages, createServiceReport } from "@/lib/api";

export default function ReportDialog({ open, onClose, job }) {
  const [notes, setNotes] = useState("");
  const [zone, setZone] = useState("");
  const [files, setFiles] = useState([]); // [{ zone, file, url, caption, takenAt }]
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const fileInputRef = useRef(null);

  if (!open) return null;

  // cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      (files || []).forEach((f) => f?.url && URL.revokeObjectURL(f.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFiles = (fileList) => {
    const arr = Array.from(fileList || []);
    const nowIso = new Date().toISOString();
    const next = arr.map((f) => ({
      zone: zone?.trim() || "ทั่วไป",
      file: f,
      url: URL.createObjectURL(f),
      caption: "",
      takenAt: nowIso,
    }));
    setFiles((prev) => [...prev, ...next]);
    // reset เพื่อให้เลือกไฟล์เดิมซ้ำได้
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAt = (idx) => {
    setFiles((prev) => {
      const it = prev[idx];
      if (it?.url) URL.revokeObjectURL(it.url);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const setCaptionAt = (idx, text) => {
    setFiles((prev) => prev.map((it, i) => (i === idx ? { ...it, caption: text } : it)));
  };

  const onSubmit = async () => {
    setBusy(true);
    setErr("");
    try {
      // อัปโหลดภาพ: uploadImages ต้องได้ array ของ { file, zone, caption, takenAt }
      const uploaded = await uploadImages(
        files.map((f) => ({
          file: f.file,
          zone: f.zone,
          caption: f.caption || "",
          takenAt: f.takenAt,
        }))
      ); // → [{ zone, caption, fileId, url }]

      // payload ตามโครงสร้าง GAS ชุดใหม่ (auto-detect)
      const payload = {
        contractNo: job.contractNo,
        customerName: job.customerName,
        phone: job.phone,
        address: job.address,
        serviceType: job.serviceType, // 'Spray' | 'Bait' | 'Mix' ...
        roundNo: job.roundNo,
        staff: job.staffName,
        notes,
        images: uploaded,
      };

      const res = await createServiceReport(payload);
      // คาดหวัง { ok:true, service_id, report_url }
      if (!res?.ok) throw new Error(res?.error || "save failed");

      // คืนค่าให้ parent ใช้ไปเปิดรายงาน/อัปเดต UI
      onClose?.({ ok: true, serviceId: res.service_id, reportUrl: res.report_url });
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-lg rounded-2xl bg-neutral-900 p-4 text-white shadow-xl">
        <div className="mb-3">
          <div className="text-lg font-semibold">
            บันทึกรายงาน • {job.serviceType} • รอบที่ {job.roundNo}
          </div>
          <div className="text-sm text-neutral-400">
            {job.customerName} • {job.contractNo}
          </div>
        </div>

        <label className="block text-sm mb-1">โซน (ใส่ก่อนเลือกไฟล์)</label>
        <input
          value={zone}
          onChange={(e) => setZone(e.target.value)}
          placeholder="เช่น ครัว, ห้องนั่งเล่น"
          className="w-full mb-3 rounded-xl bg-neutral-800 px-3 py-2 outline-none"
          disabled={busy}
        />

        <label className="block text-sm mb-1">เลือกรูป (หลายรูปได้)</label>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          capture="environment"
          onChange={(e) => addFiles(e.target.files)}
          className="mb-3 w-full"
          disabled={busy}
        />

        {!!files.length && (
          <div className="max-h-48 overflow-y-auto space-y-2 mb-3">
            {files.map((f, i) => (
              <div key={i} className="flex items-start gap-3 bg-neutral-800 rounded-xl p-2">
                <img src={f.url} alt="" className="h-14 w-14 object-cover rounded-lg" />
                <div className="flex-1">
                  <div className="text-sm">{f.file.name}</div>
                  <div className="text-xs text-neutral-400 mb-1">
                    โซน: {f.zone} • {new Date(f.takenAt).toLocaleString()}
                  </div>
                  <input
                    value={f.caption || ""}
                    onChange={(e) => setCaptionAt(i, e.target.value)}
                    placeholder="คำอธิบายภาพ (caption)"
                    className="w-full rounded-lg bg-neutral-900 px-2 py-1 text-sm outline-none"
                    disabled={busy}
                  />
                </div>
                <button
                  onClick={() => removeAt(i)}
                  className="px-3 py-1 rounded-lg bg-red-600"
                  disabled={busy}
                >
                  ลบ
                </button>
              </div>
            ))}
          </div>
        )}

        <label className="block text-sm mb-1">หมายเหตุ</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full h-20 rounded-xl bg-neutral-800 px-3 py-2 outline-none mb-3"
          disabled={busy}
        />

        {err && <div className="mb-3 text-red-400 text-sm">{err}</div>}

        <div className="flex gap-2 justify-end">
          <button
            onClick={() => !busy && onClose?.(null)}
            className="px-4 py-2 rounded-xl bg-neutral-700 disabled:opacity-60"
            disabled={busy}
          >
            ยกเลิก
          </button>
          <button
            onClick={onSubmit}
            className="px-4 py-2 rounded-xl bg-emerald-600 disabled:opacity-60"
            disabled={busy || files.length === 0}
          >
            {busy ? "กำลังบันทึก..." : "บันทึกรายงาน"}
          </button>
        </div>
      </div>
    </div>
  );
}
