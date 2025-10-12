// pages/report/[serviceId].jsx
import React from "react";

/** ---------------------------
 * Exec base: รองรับหลายค่า + comma-separated
 * --------------------------- */
function getExecBases() {
  const cands = [
    process.env.NEXT_PUBLIC_GAS_EXEC_PRIMARY,
    process.env.NEXT_PUBLIC_GAS_EXEC,
    process.env.NEXT_PUBLIC_GAS_EXEC_BACKUP,
    process.env.NEXT_PUBLIC_GAS_URL,
    process.env.GAS_EXEC,
    process.env.NEXT_PUBLIC_API_BASE,
  ]
    .filter(Boolean)
    .flatMap((s) => String(s).split(","))
    .map((s) => String(s).trim())
    .filter(Boolean)
    .map((s) => s.replace(/\/+$/, "")); // ตัด / ท้าย

  // กันกรณีว่างหมด
  return Array.from(new Set(cands));
}

/** ---------------------------
 * Adapter: รวมสคีมาเก่า/ใหม่ให้เป็นรูปเดียวกับ UI
 * --------------------------- */
function adaptReportPayload(json) {
  // json รูปแบบ { ok, header, items, photos }
  const h = json?.header || {};
  const svcId = h.service_id || h.logId || "";

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
      unit: it.unit || "",
      link: it.link || "",
      remark: it.remark || "",
    });
  });

  // Photos: [{ zone, url, caption, taken_at }]
  (json?.photos || []).forEach((p) => {
    const row = ensure(p.zone);
    row.photos.push({
      url: p.url,
      thumb: p.url,
      caption: p.caption || "",
      taken_at: p.taken_at || "",
    });
  });

  return { ...payload, items: Array.from(byZone.values()) };
}

/** ---------------------------
 * Helper: ลองยิงหลาย URL/หลายเอ็นด์พอยน์ต์จนกว่าจะสำเร็จ
 * --------------------------- */
async function tryFetchReport(serviceId) {
  const bases = getExecBases();
  const endpoints = [
    (b) => `${b}?route=report-by-id&service_id=${encodeURIComponent(serviceId)}`,
    (b) => `${b}?route=report&id=${encodeURIComponent(serviceId)}`, // ของเก่า
  ];

  let lastErr = "";
  for (const b of bases) {
    for (const make of endpoints) {
      try {
        const url = make(b);
        const res = await fetch(url, { redirect: "follow", cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (json?.ok) {
          return { base: b, endpoint: url, json };
        }
        lastErr = json?.error || `HTTP ${res.status}`;
      } catch (e) {
        lastErr = String(e?.message || e);
      }
    }
  }
  throw new Error(lastErr || "fetch failed");
}

/** (optional) เรียก /validate ถ้ามี */
async function tryValidate(serviceId) {
  const bases = getExecBases();
  for (const b of bases) {
    try {
      const url = `${b}?route=validate&service_id=${encodeURIComponent(serviceId)}`;
      const res = await fetch(url, { redirect: "follow", cache: "no-store" });
      if (!res.ok) continue;
      const json = await res.json().catch(() => ({}));
      if (json?.ok) return json;
    } catch (_) {}
  }
  return null; // ไม่ถือเป็น error
}

/** ---------------------------
 * SSR
 * --------------------------- */
export async function getServerSideProps(ctx) {
  const serviceId = String(ctx.params?.serviceId || "");
  if (!serviceId) {
    return { props: { serviceId, data: null, error: "missing id" } };
  }

  try {
    const { json } = await tryFetchReport(serviceId);
    const data = adaptReportPayload(json);

    // เรียก validate แบบไม่บังคับ
    const validate = await tryValidate(serviceId).catch(() => null);

    return { props: { serviceId, data, validate: validate || null, error: null } };
  } catch (e) {
    return { props: { serviceId, data: null, error: String(e?.message || e) } };
  }
}

/** ---------------------------
 * UI
 * --------------------------- */
export default function ServiceReportPage({ serviceId, data, error, validate }) {
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

  // แปลงข้อมูล validate (ถ้ามี) ให้เป็นป้ายสรุปอย่างย่อ
  const ValidateBanner = () => {
    if (!validate?.required && !validate?.ok) return null;

    // ถ้า API /validate ส่ง required มาเป็นสเปคกลุ่ม ให้สรุปผลแบบยืดหยุ่น
    const required = validate.required || {};
    let note = "ผลตรวจหลักฐาน: พร้อมใช้งาน";
    if (required.complete === false) note = "ผลตรวจหลักฐาน: ยังไม่ครบ";

    return (
      <div className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-amber-300 text-sm">
        {note}
      </div>
    );
  };

  return (
    <main className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">รายงานหน้างาน</h1>

      <ValidateBanner />

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
              {(it?.chemicals?.length || 0) === 0 ? (
                <div className="text-neutral-400">-</div>
              ) : (
                <ul className="list-disc pl-5">
                  {it.chemicals.map((c, i) => (
                    <li key={i}>
                      {c?.name} {c?.qty ?? ""} {c?.unit ?? ""}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {!!(it?.photos || []).length && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {it.photos.map((p, i) => (
                  <a
                    key={i}
                    href={p.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded overflow-hidden border border-neutral-700"
                  >
                    <img loading="lazy" src={p.thumb || p.url} alt={`photo-${i}`} />
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
