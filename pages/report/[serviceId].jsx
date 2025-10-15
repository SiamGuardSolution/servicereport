// pages/report/[serviceId].jsx
import React, { useEffect, useState } from "react";

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
    .map((s) => s.replace(/\/+$/, ""));

  return Array.from(new Set(cands)); // unique
}

function adaptReportPayload(json, base) {
  const h = json?.header || {};
  const pick = (o, arr) => arr.map(k => o?.[k]).find(v => v != null && v !== "") || "";

  const serviceId = pick(h, ["service_id","serviceId","SR_ID","logId","idService"]);
  const visitId   = pick(h, ["visit_id","visitId","VISIT_ID","id","visit"]);

  const createdAt    = pick(h, ["date","serviceDate","created_at","createdAt","VISIT_DATE"]);
  const staffName    = pick(h, ["staff_name","staffName","teamName","team_name","technicianName","TECH"]);
  const customerName = pick(h, ["customer_name","customerName","client_name","CLIENT_NAME","name"]);
  const address      = pick(h, ["address","addr","ADDRESS"]);
  const notes        = pick(h, ["notes","summary","remark","REMARK"]);

  // ลายเซ็น: รับทั้ง url, dataURL, หรือ fileId -> สร้าง URL ผ่าน /file64
  const signatureUrlDirect = pick(h, ["signature_url","signatureUrl","customerSignatureUrl"]);
  const signatureDataUrl   = pick(h, ["signatureDataUrl","signature","sigDataUrl"]);
  const signatureFileId    = pick(h, ["signature_id","signatureFileId","sigFileId"]);

  const signatureUrl =
    signatureDataUrl ||
    signatureUrlDirect ||
    (signatureFileId && base ? `${base}?route=file64&id=${encodeURIComponent(signatureFileId)}` : "");

  // รวมรายการตามโซน
  const byZone = new Map();
  const ensure = (z) => {
    const key = z || "ทั่วไป";
    if (!byZone.has(key)) byZone.set(key, { area: key, chemicals: [], photos: [] });
    return byZone.get(key);
  };

  (json?.items || json?.chemicals || []).forEach((it) => {
    const row = ensure(it.zone || it.area || it.location);
    row.chemicals.push({
      name:  pick(it, ["name","chemical","chem","product"]),
      qty:   pick(it, ["qty","quantity"]),
      unit:  pick(it, ["unit"]),
      link:  pick(it, ["link","url"]),
      remark:pick(it, ["remark","note"]),
    });
  });

  (json?.photos || json?.images || json?.files || []).forEach((p) => {
    const row = ensure(p.zone || p.area || p.location);
    const url =
      p.dataUrl || p.dataURL || p.base64 ||
      p.url ||
      (p.id && base ? `${base}?route=file64&id=${encodeURIComponent(p.id)}` : "") ||
      (p.file_id && base ? `${base}?route=file64&id=${encodeURIComponent(p.file_id)}` : "");

    row.photos.push({
      url,
      thumb: url,
      caption: p.caption || p.name || "",
      taken_at: p.taken_at || p.takenAt || "",
    });
  });

  return {
    serviceId,
    visitId,
    createdAt,
    staffName,
    customerName,
    address,
    notes,
    signatureUrl,
    pdfUrl: pick(h, ["report_url","pdfUrl"]),
    items: Array.from(byZone.values()),
  };
}

function withTimeout(ms = 10000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort("timeout"), ms);
  return { signal: ctl.signal, clear: () => clearTimeout(t) };
}

async function tryFetchReport(serviceId) {
  const bases = getExecBases();
  const routes = [
    (b) => `${b}?route=report-by-id&service_id=${encodeURIComponent(serviceId)}`,
    (b) => `${b}?route=report&id=${encodeURIComponent(serviceId)}`, // compat เก่า
  ];

  let lastErr = "";
  for (const b of bases) {
    for (const make of routes) {
      const { signal, clear } = withTimeout(12000);
      try {
        const url = make(b);
        const res = await fetch(url, { redirect: "follow", cache: "no-store", signal });
        const json = await res.json().catch(() => ({}));
        clear();
        if (json?.ok) {
          return { base: b, url, json };
        }
        lastErr = json?.error || `HTTP ${res.status}`;
      } catch (e) {
        clear();
        lastErr = String(e?.message || e);
      }
    }
  }
  throw new Error(lastErr || "fetch failed");
}

async function tryValidate(serviceId) {
  const bases = getExecBases();
  for (const b of bases) {
    const { signal, clear } = withTimeout(8000);
    try {
      const url = `${b}?route=validate&service_id=${encodeURIComponent(serviceId)}`;
      const res = await fetch(url, { redirect: "follow", cache: "no-store", signal });
      const json = await res.json().catch(() => ({}));
      clear();
      if (res.ok && json?.ok) return json;
    } catch (_) {}
  }
  return null;
}

export async function getServerSideProps(ctx) {
  const serviceId = String(ctx.params?.serviceId || "");
  const debug = String(ctx.query?.debug || "") === "1";

  if (!serviceId) {
    return { props: { serviceId, data: null, error: "missing id", debug, meta: null } };
  }

  // ปิด cache CDN/บราวเซอร์ (รายงานควรสด)
  try {
    ctx.res.setHeader("Cache-Control", "no-store, max-age=0");
  } catch {}

  try {
    const { json, url, base } = await tryFetchReport(serviceId);
    const data = adaptReportPayload(json, base);
    const validate = await tryValidate(serviceId).catch(() => null);

    const meta = debug ? { fetchedFrom: base, endpoint: url, rawOk: json?.ok } : null;
    return { props: { serviceId, data, validate: validate || null, error: null, debug, meta } };
  } catch (e) {
    return { props: { serviceId, data: null, error: String(e?.message || e), debug, meta: null } };
  }
}

function ClientFallback({ serviceId, onLoaded }) {
  const [state, setState] = useState({ loading: true, error: "", data: null, validate: null });
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { json, base } = await tryFetchReport(serviceId);
        const data = adaptReportPayload(json, base); 
        const validate = await tryValidate(serviceId).catch(() => null);
        if (!mounted) return;
        setState({ loading: false, error: "", data, validate });
        onLoaded?.({ data, validate });
      } catch (e) {
        if (!mounted) return;
        setState({ loading: false, error: String(e?.message || e), data: null, validate: null });
      }
    })();
    return () => { mounted = false; };
  }, [serviceId, onLoaded]);

  if (state.loading) return <div style={{ padding: 16 }}>กำลังโหลด…</div>;
  if (state.error) return <div style={{ padding: 16, color: "#f66" }}>ผิดพลาด: {state.error}</div>;
  return null;
}

export default function ServiceReportPage({ serviceId, data, error, validate, debug, meta }) {
  // Fallback client ถ้า SSR ล้มเหลว
  const [clientData, setClientData] = useState(null);
  const effective = clientData?.data || data;
  const effectiveValidate = clientData?.validate || validate;

  if (error && !effective) {
    // แสดง fallback loader ที่จะพยายามโหลดเองฝั่ง client
    return (
      <>
        <ClientFallback serviceId={serviceId} onLoaded={(x) => setClientData(x)} />
        {/* ถ้า client ก็ล้มเหลว จะแสดง error เดิมด้านล่าง */}
        <div style={{ padding: 16, color: "#f66" }}>ผิดพลาด: {error}</div>
      </>
    );
  }

  if (!effective) {
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
  } = effective;

  const ValidateBanner = () => {
    const v = effectiveValidate;
    if (!v?.required && !v?.ok) return null;

    // รองรับโครงสร้างยืดหยุ่น เช่น {required: { groups:[...], complete:true/false }}
    let note = "ผลตรวจหลักฐาน: พร้อมใช้งาน";
    if (v?.required?.complete === false || v?.ok === false) note = "ผลตรวจหลักฐาน: ยังไม่ครบ";
    return (
      <div className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-amber-300 text-sm">
        {note}
      </div>
    );
  };

  return (
    <main className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">รายงานหน้างาน</h1>

      {debug && meta && (
        <div className="mb-4 rounded-md border border-cyan-700/40 bg-cyan-900/20 p-3 text-cyan-300 text-xs">
          <div>debug=1</div>
          <div>base: {meta.fetchedFrom}</div>
          <div>endpoint: {meta.endpoint}</div>
          <div>raw ok: {String(meta.rawOk)}</div>
        </div>
      )}

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
                    <img
                      loading="lazy"
                      src={p.thumb || p.url}
                      alt={`photo-${i}`}
                      onError={(e) => { e.currentTarget.style.opacity = 0.5; }}
                    />
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
            loading="lazy"
            onError={(e) => { e.currentTarget.style.opacity = 0.5; }}
          />
        ) : (
          <div>- ไม่มีข้อมูล -</div>
        )}
      </section>
    </main>
  );
}
