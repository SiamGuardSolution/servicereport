// src/ServiceReportPage.jsx
import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";

const RAW_BASE  = (process.env.REACT_APP_GAS_BASE || "").replace(/\/+$/, "");
const EXEC_BASE = /\/exec$/.test(RAW_BASE) ? RAW_BASE : `${RAW_BASE}/exec`;
const baseOk = /^https?:\/\/script\.google(?:usercontent)?\.com\/macros\//.test(EXEC_BASE);

const LS_KEY = "tech-ui";
const onlyDigits = (s = "") => s.replace(/\D+/g, "");

function fmtDateThai(s) {
  if (!s) return "-";
  const d = new Date(s);
  if (isNaN(d)) return String(s);
  const y = d.getFullYear() + 543;
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${day}/${m}/${y}`;
}

function groupBy(arr, getKey) {
  const map = new Map();
  (arr || []).forEach((it) => {
    const k = getKey(it) || "— อื่นๆ —";
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(it);
  });
  return Array.from(map.entries());
}

export default function ServiceReportPage() {
  const { serviceId } = useParams();
  const navigate = useNavigate();
  const { search } = useLocation();

  // ---- auth: query -> localStorage
  const qs = new URLSearchParams(search);
  const qPhone = onlyDigits(qs.get("phone") || "");
  const qUid = (qs.get("uid") || "").trim();

  const saved = (() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); }
    catch { return {}; }
  })();

  const auth_phone = qPhone || onlyDigits(saved.phone || "");
  const auth_userId = qUid || (saved.userId || "");

  // sync กลับไว้ใช้ครั้งต่อไป
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ ...saved, phone: auth_phone, userId: auth_userId }));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth_phone, auth_userId]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
  if (!serviceId || !baseOk) return;
  setLoading(true);
  setErr("");
  setData(null);

  try {
    if (!auth_phone || !auth_userId) throw new Error("Error: missing phone");

    // ตัวเลือกที่เป็นไปได้ของ route + รูปแบบพารามิเตอร์
    const routes = ["report-by-id", "report/get", "report.getById"];
    const idKeys = [
      { k: "service_id", v: String(serviceId) },
      { k: "serviceId",  v: String(serviceId) },
      { k: "id",         v: String(serviceId) },
    ];

    // payload พื้นฐาน (แนบ auth ให้ครบทุกชื่อ)
    const basePayload = {
      phone: auth_phone,
      auth_phone: auth_phone,
      uid: auth_userId,
      auth_userId: auth_userId,
    };

    let lastErr = null;

    // 1) ลอง POST ก่อน (GAS ที่ parse JSON ใน doPost)
    for (const r of routes) {
      for (const id of idKeys) {
        const payload = { route: r, ...basePayload, [id.k]: id.v };
        console.log("[TRY POST]", r, id.k, payload);
        const res = await fetch(`${EXEC_BASE}?route=${encodeURIComponent(r)}`, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(payload),
        });
        const text = await res.text();
        let out;
        try { out = JSON.parse(text); } catch { out = { ok:false, error:`Invalid JSON: ${text.slice(0,150)}` }; }
        if (res.ok && out?.ok) { setData(out); setLoading(false); return; }
        lastErr = out?.error || `HTTP ${res.status}`;
      }
    }

    // 2) ถ้ายังไม่ผ่าน ลอง GET แบบ query
    for (const r of routes) {
      for (const id of idKeys) {
        const qs = new URLSearchParams({
          route: r,
          [id.k]: id.v,
          phone: basePayload.phone,
          auth_phone: basePayload.auth_phone,
          uid: basePayload.uid,
          auth_userId: basePayload.auth_userId,
        });
        const url = `${EXEC_BASE}?${qs.toString()}`;
        console.log("[TRY GET]", url);
        const res = await fetch(url);
        const text = await res.text();
        let out;
        try { out = JSON.parse(text); } catch { out = { ok:false, error:`Invalid JSON: ${text.slice(0,150)}` }; }
        if (res.ok && out?.ok) { setData(out); setLoading(false); return; }
        lastErr = out?.error || `HTTP ${res.status}`;
      }
    }

    throw new Error(lastErr || "Not found");
  } catch (e) {
    setErr(e.message || String(e));
  } finally {
    setLoading(false);
  }
}, [serviceId, auth_phone, auth_userId]);


  useEffect(() => { load(); }, [load]);

  // inject CSS
  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      .report-view .input{height:44px;padding:8px 12px;border-radius:10px;border:1px solid #e5e7eb}
      .report-view .btn{height:40px;border:1px solid #e5e7eb;border-radius:10px;background:#fff}
      .report-view .card{background:#fff;border-radius:12px;padding:16px;box-shadow:0 2px 10px rgba(0,0,0,.06);margin-bottom:16px}
      .report-view .grid{display:grid;gap:6px}
      .report-view .k{opacity:.65}
      .report-view .kv{display:grid;grid-template-columns:120px 1fr;gap:10px;padding:6px 0}
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  if (!baseOk) return <div style={{ padding: 16, color: "crimson" }}>โปรดตั้งค่า REACT_APP_GAS_BASE ให้ถูกต้อง (ต้องชี้ /exec)</div>;
  if (!serviceId) return <div style={{ padding: 16 }}>ไม่มี serviceId ใน URL</div>;

  if (loading) return <div style={{ padding: 16, opacity: 0.7 }}>กำลังโหลด…</div>;
  if (err) return <div style={{ padding: 16, color: "crimson" }}>เกิดข้อผิดพลาด: {err}</div>;
  if (!data) return <div style={{ padding: 16 }}>ไม่พบข้อมูล</div>;

  const H = data.header || {};
  const photos = data.photos || [];
  const items = data.items || [];
  const signatureUrl = data.signature?.url || data.signatureUrl;

  const head = {
    serviceId: H.serviceId || serviceId,
    date: H.serviceDate || H.date || H.createdAt,
    customerName: H.customerName || H.clientName,
    address: H.address || H.clientAddress,
    phone: H.phone || H.clientPhone,
    teamName: H.teamName || H.team || H.technicianName,
    method: H.method || H.packageName || H.package || "-",
  };

  return (
    <div className="report-view" style={{ maxWidth: 960, margin: "0 auto", padding: 16 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
        <button className="btn" onClick={() => navigate(-1)}>← กลับ</button>
        <h2 style={{ fontWeight: 800, fontSize: 22, margin: 0 }}>รายงานการบริการ (อ่านอย่างเดียว)</h2>
      </div>
      <div style={{ opacity: 0.7, fontSize: 13, marginBottom: 14 }}>ID: {head.serviceId}</div>

      {/* Header / Customer */}
      <section className="card">
        <h3 style={{ fontWeight: 700, marginBottom: 8 }}>ข้อมูลลูกค้า</h3>
        <div className="grid">
          <div className="kv"><div className="k">ลูกค้า</div><div>{head.customerName || "-"}</div></div>
          <div className="kv"><div className="k">โทร</div><div>{head.phone || "-"}</div></div>
          <div className="kv"><div className="k">ที่อยู่</div><div>{head.address || "-"}</div></div>
          <div className="kv"><div className="k">ทีม / ช่าง</div><div>{head.teamName || "-"}</div></div>
          <div className="kv"><div className="k">วันที่บริการ</div><div>{fmtDateThai(head.date)}</div></div>
          <div className="kv"><div className="k">แพ็กเกจ/วิธีการ</div><div>{head.method || "-"}</div></div>
        </div>
      </section>

      {/* Photos */}
      <section className="card">
        <h3 style={{ fontWeight: 700, marginBottom: 8 }}>ภาพถ่ายประกอบ ({photos.length})</h3>
        {photos.length === 0 ? (
          <div style={{ opacity: .6 }}>— ยังไม่มีรูป —</div>
        ) : (
          groupBy(photos, (p) => p.zone).map(([zone, list]) => (
            <div key={zone} style={{ marginBottom: 16, border: "1px solid #eef", borderRadius: 10, padding: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>โซน: {zone} ({list.length})</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
                {list.map((p, i) => (
                  <figure key={i} style={{ margin: 0, border: "1px solid #eee", borderRadius: 10, padding: 8 }}>
                    <div style={{ width: "100%", aspectRatio: "1/1", background: "#f5f5f5", borderRadius: 8, overflow: "hidden" }}>
                      <img
                        src={p.photo_url || p.url || p}
                        alt={p.caption || `photo-${i}`}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    </div>
                    {p.caption ? <figcaption style={{ fontSize: 12, marginTop: 6 }}>{p.caption}</figcaption> : null}
                  </figure>
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      {/* Chemicals */}
      <section className="card">
        <h3 style={{ fontWeight: 700, marginBottom: 8 }}>สารเคมีที่ใช้ ({items.length})</h3>
        {items.length === 0 ? (
          <div style={{ opacity: .6 }}>— ยังไม่มีรายการ —</div>
        ) : (
          groupBy(items, (it) => it.zone).map(([zone, list]) => (
            <div key={zone} style={{ marginBottom: 16, border: "1px solid #eef", borderRadius: 10, padding: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>โซน: {zone} ({list.length})</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>{["ชื่อสารเคมี", "ปริมาณ", "ลิงก์ข้อมูล", "หมายเหตุ"].map((h) => (
                    <th key={h} style={{ borderTop: "1px solid #eee", padding: "8px 6px", textAlign: "left" }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {list.map((it, i) => (
                    <tr key={i}>
                      <td style={{ borderTop: "1px solid #eee", padding: "8px 6px" }}>{it.chemical_name || it.name || "-"}</td>
                      <td style={{ borderTop: "1px solid #eee", padding: "8px 6px" }}>{it.qty || "-"}</td>
                      <td style={{ borderTop: "1px solid #eee", padding: "8px 6px" }}>
                        {it.link_info || it.link ? (
                          <a href={it.link_info || it.link} target="_blank" rel="noreferrer">
                            {it.link_info || it.link}
                          </a>
                        ) : ""}
                      </td>
                      <td style={{ borderTop: "1px solid #eee", padding: "8px 6px" }}>{it.remark || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}
      </section>

      {/* Signature */}
      {signatureUrl && (
        <section className="card">
          <h3 style={{ fontWeight: 700, marginBottom: 8 }}>ลายเซ็นลูกค้า</h3>
          <div style={{ border: "1px dashed #cbd5e1", padding: 8, borderRadius: 8 }}>
            <img src={signatureUrl} alt="signature" style={{ width: "100%", maxWidth: 420 }} />
          </div>
        </section>
      )}
    </div>
  );
}
