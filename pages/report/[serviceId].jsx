// pages/report/[serviceId].jsx
import React from "react";

/** ---------------------------
 * Helper: GAS exec base URL
 * --------------------------- */
function getExecBase() {
  const base =
    process.env.NEXT_PUBLIC_GAS_EXEC_PRIMARY ||
    process.env.NEXT_PUBLIC_GAS_EXEC ||
    process.env.NEXT_PUBLIC_GAS_EXEC_BACKUP ||
    process.env.GAS_EXEC ||
    process.env.NEXT_PUBLIC_API_BASE ||
    "";
  return String(base || "").replace(/\/+$/, ""); // ตัด / ท้าย
}

/** ---------------------------
 * Adapter: รวมสคีมาเก่า/ใหม่ให้เป็นรูปเดียวกับ UI
 * --------------------------- */
function adaptReportPayload(json) {
  // json รูปแบบ { ok, header, items, photos }
  const h = json?.header || {};
  const svcId = h.service_id || h.logId || "";

  // map ฟิลด์หลัก (เผื่อชื่อใหม่/เก่า)
  const payload = {
    serviceId: svcId,
    visitId: h.visit_id || h.visitId || "",
    createdAt: h.date || h.serviceDate || h.created_at || "",
    staffName: h.staff_name || h.technicianName || "",
    customerName: h.customer_name || h.customerName || "",
    address: h.address || "",
    notes: h.notes || h.summary || "",
    signatureUrl: h.signature_url || h.customerSignatureUrl || "",
    pdfUrl: h.report_url || h.pdfUrl || "",
  };

  // รวม items+photos ตาม zone -> [{area, chemicals, photos}]
  const byZone = new Map();
  const ensure = (z) => {
    const key = z || "ทั่วไป";
    if (!byZone.has(key)) byZone.set(key, { area: key, chemicals: [], photos: [] });
    return byZone.get(key);
  };

  // Chemicals: [{ zone, name, qty, link, remark }]
  (json?.items || []).forEach((it) => {
    const row = ensure(it.zone);
    row.chemicals.push({
      name: it.name || "",
      qty: it.qty || "",
      unit: it.unit || "", // เผื่ออนาคต
      link: it.link || "",
      remark: it.remark || "",
    });
  });

  // Photos: [{ zone, url, caption, taken_at }]
  (json?.photos || []).forEach((p) => {
    const row = ensure(p.zone);
    row.photos.push({
      url: p.url,
      thumb: p.url, // ถ้ามีตัวย่อจะสลับมาใช้ได้
      caption: p.caption || "",
      taken_at: p.taken_at || "",
    });
  });

  return { ...payload, items: Array.from(byZone.values()) };
}

/** ---------------------------
 * SSR: ดึงข้อมูลรายงานจาก GAS
 * --------------------------- */
export async function getServerSideProps(ctx) {
  const serviceId = String(ctx.params?.serviceId || "");
  const base = getExecBase();

  let data = null;
  let error = null;

  if (!serviceId) {
    return { props: { serviceId, data: null, error: "missing id" } };
  }

  try {
    const url = `${base}?route=report-by-id&service_id=${encodeURIComponent(
      serviceId
    )}`;
    const res = await fetch(url, { redirect: "follow" });
    const json = await res.json();

    if (!json?.ok) {
      throw new Error(json?.error || `HTTP ${res.status}`);
    }
    data = adaptReportPayload(json);
  } catch (e) {
    error = String(e?.message || e);
  }

  return { props: { serviceId, data, error } };
}

/** ---------------------------
 * UI
 * --------------------------- */
export default function ServiceReportPage({ serviceId, data, error }) {
  if (error) {
    return (
      <div style={{ padding: 16, color: "#f66" }}>
        ผิดพลาด: {error}
      </div>
    );
  }
  if (!data) {
    return <div style={{ padding: 16 }}>ไม่พบข้อมูลรายงาน</div>;
  }

  const {
    serviceId: id = serviceId,
    visitId,
    createdAt,
    staffName,
    customerName,
    address,
    notes,
    items = [],
    signatureUrl,
    pdfUrl,
  } = data;

  return (
    <main className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">รายงานหน้างาน</h1>

      <section className="mb-4">
        <div><b>Service ID:</b> {id}</div>
        <div><b>Visit ID:</b> {visitId || "-"}</div>
        <div><b>วัน–เวลา:</b> {createdAt || "-"}</div>
        <div><b>ช่างผู้ปฏิบัติงาน:</b> {staffName || "-"}</div>
        <div><b>ลูกค้า:</b> {customerName || "-"}</div>
        <div><b>ที่อยู่:</b> {address || "-"}</div>
        {pdfUrl && (
          <div className="mt-2">
            <a href={pdfUrl} target="_blank" rel="noreferrer" className="underline">
              เปิดไฟล์ PDF
            </a>
          </div>
        )}
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">รายละเอียดการทำงาน</h2>
        {items.length === 0 && <div>- ไม่พบรายการ -</div>}

        {items.map((it, idx) => (
          <div key={idx} className="rounded-xl border border-neutral-700 p-3 mb-4">
            <div className="font-medium mb-1">บริเวณที่ทำ: {it?.area || "-"}</div>

            <div className="mb-2">
              <div className="opacity-80 text-sm">สารเคมีที่ใช้</div>
              <ul className="list-disc pl-5">
                {(it?.chemicals || []).map((c, i) => (
                  <li key={i}>
                    {c?.name} {c?.qty ?? ""} {c?.unit ?? ""}
                  </li>
                ))}
              </ul>
            </div>

            {!!(it?.photos || []).length && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {(it.photos || []).map((p, i) => (
                  <a
                    key={i}
                    href={p.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded overflow-hidden border border-neutral-700"
                  >
                    <img src={p.thumb || p.url} alt={`photo-${i}`} />
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">หมายเหตุ</h2>
        <div className="whitespace-pre-wrap">{notes || "-"}</div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-2">ลายเซ็นลูกค้า</h2>
        {signatureUrl ? (
          <img
            src={signatureUrl}
            alt="signature"
            className="bg-white p-2 rounded-md border"
          />
        ) : (
          <div>- ไม่มีข้อมูล -</div>
        )}
      </section>
    </main>
  );
}
