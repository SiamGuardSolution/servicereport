// pages/report/[serviceId].jsx
/* SSR version */
import React from "react";

/** ---------- SSR: ดึงข้อมูลก่อนเรนเดอร์ ---------- */
function getServiceReport_(serviceId){
  try {
    if (!serviceId) return { ok:false, error:'missing id' };

    const ss = SpreadsheetApp.openById(SS_ID);
    const sh = ss.getSheetByName(REPORT_SHEET);
    if (!sh) return { ok:false, error:'missing sheet '+REPORT_SHEET };

    const values = sh.getDataRange().getValues();
    const head = values[0].map(String);
    const rows = values.slice(1);

    const H = Object.fromEntries(head.map((h,i)=>[h, i]));
    const col = (nameArr) => {
      for (var n of nameArr) if (H[n] != null) return H[n];
      return null;
    };

    const cSID  = col(['Service ID','service_id']);
    if (cSID == null) return { ok:false, error:'missing Service ID column' };

    const row = rows.find(r => String(r[cSID]).trim() === serviceId);
    if (!row) return { ok:false, error:'not found', serviceId };

    const get = (names, d='') => {
      const idx = col(names);
      return idx == null ? d : (row[idx] ?? d);
    };
    const parse = (s,fb)=>{ try{return s?JSON.parse(s):fb;}catch(_){return fb;} };

    return {
      ok: true,
      serviceId,
      visitId:      String(get(['Visit ID','visit_id'], '')),
      createdAt:    String(get(['Created At','วันที่'], '')),
      staffName:    String(get(['Staff','ช่างผู้ปฏิบัติงาน'], '')),
      customerName: String(get(['Customer','ลูกค้า'], '')),
      address:      String(get(['Address','ที่อยู่'], '')),
      notes:        String(get(['Notes','หมายเหตุ'], '')),
      pdfUrl:       String(get(['PdfUrl','ไฟล์PDF'], '')),
      signatureUrl: String(get(['SignatureUrl','ลายเซ็น'], '')),
      items:        parse(String(get(['items','รายการ'], '')), [])
    };
  } catch (err) {
    return { ok:false, error:String(err), where:'getServiceReport_' };
  }
}

/** ---------- หน้าแสดงผล ---------- */
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

  // รองรับทั้งกรณีที่ Apps Script ส่ง {ok:false,...} มา
  if (data.ok === false) {
    return (
      <div style={{ padding: 16, color: "#f66" }}>
        โหลดไม่สำเร็จ: {data.error || "unknown"}
      </div>
    );
  }

  // --------- map ฟิลด์ที่ใช้แสดง ----------
  const {
    serviceId: id = serviceId,
    visitId,
    createdAt,
    staffName,
    customerName,
    address,
    notes,
    items = [],        // [{area, chemicals:[{name,qty,unit}], photos:[{url,thumb}]}, ...]
    signatureUrl,      // URL รูปลายเซ็น
    pdfUrl
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
                    {/* ถ้าตั้ง CORS ถูกต้องสามารถเปลี่ยนเป็น next/image ได้ */}
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
