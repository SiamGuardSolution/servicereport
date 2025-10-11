// components/ReportDialog.jsx
import React, { useState } from "react";
import { uploadImages, createServiceReport } from "@/lib/api";

export default function ReportDialog({ open, onClose, job }) {
  if (!open) return null;

  const [notes, setNotes] = useState("");
  const [zone, setZone] = useState("");
  const [files, setFiles] = useState([]); // [{ zone, file, preview }]
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const addFiles = (fileList) => {
    const arr = Array.from(fileList || []);
    const next = arr.map(f => ({
      zone: zone || "ทั่วไป",
      file: f,
      preview: URL.createObjectURL(f),
    }));
    setFiles(prev => [...prev, ...next]);
  };
  const removeAt = (idx) => setFiles(prev => prev.filter((_, i) => i !== idx));

  const onSubmit = async () => {
    setBusy(true); setErr("");
    try {
      const uploaded = await uploadImages(files); // [{zone,fileId,url}]
      const payload = {
        contractNo: job.contractNo,
        customerName: job.customerName,
        phone: job.phone,
        address: job.address,
        serviceType: job.serviceType, // "Spray" | "Bait" | "Mix"
        roundNo: job.roundNo,
        staff: job.staffName,
        notes,
        images: uploaded,
      };
      const res = await createServiceReport(payload);
      if (!res?.ok) throw new Error(res?.error || "save failed");

      onClose({ ok: true, row: res.result?.row });
    } catch (e) {
      setErr(String(e.message || e));
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
          onChange={e=>setZone(e.target.value)}
          placeholder="เช่น ครัว, ห้องนั่งเล่น"
          className="w-full mb-3 rounded-xl bg-neutral-800 px-3 py-2 outline-none"
        />

        <label className="block text-sm mb-1">เลือกรูป (หลายรูปได้)</label>
        <input
          type="file"
          multiple
          accept="image/*"
          capture="environment"
          onChange={e=> addFiles(e.target.files)}
          className="mb-3 w-full"
        />

        {!!files.length && (
          <div className="max-h-48 overflow-y-auto space-y-2 mb-3">
            {files.map((f, i)=>(
              <div key={i} className="flex items-center gap-3 bg-neutral-800 rounded-xl p-2">
                <img src={f.preview} alt="" className="h-14 w-14 object-cover rounded-lg"/>
                <div className="flex-1">
                  <div className="text-sm">{f.file.name}</div>
                  <div className="text-xs text-neutral-400">โซน: {f.zone}</div>
                </div>
                <button onClick={()=>removeAt(i)} className="px-3 py-1 rounded-lg bg-red-600">ลบ</button>
              </div>
            ))}
          </div>
        )}

        <label className="block text-sm mb-1">หมายเหตุ</label>
        <textarea
          value={notes}
          onChange={e=>setNotes(e.target.value)}
          className="w-full h-20 rounded-xl bg-neutral-800 px-3 py-2 outline-none mb-3"
        />

        {err && <div className="mb-3 text-red-400 text-sm">{err}</div>}

        <div className="flex gap-2 justify-end">
          <button onClick={()=>onClose(null)} className="px-4 py-2 rounded-xl bg-neutral-700" disabled={busy}>ยกเลิก</button>
          <button onClick={onSubmit} className="px-4 py-2 rounded-xl bg-emerald-600" disabled={busy || files.length===0}>
            {busy ? "กำลังบันทึก..." : "บันทึกรายงาน"}
          </button>
        </div>
      </div>
    </div>
  );
}
