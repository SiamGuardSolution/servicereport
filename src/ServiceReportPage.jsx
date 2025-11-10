// src/ServiceReportPage.jsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";

/* -------------------- CONFIG / ENV -------------------- */
const RAW_BASE  = (process.env.REACT_APP_GAS_BASE || "").replace(/\/+$/, "");
const EXEC_BASE = RAW_BASE ? (/\/exec$/.test(RAW_BASE) ? RAW_BASE : `${RAW_BASE}/exec`) : "";
if (!EXEC_BASE) {
  // แสดงข้อความชัด ๆ หรือโยน error แทนที่จะปล่อยให้ยิงไป /exec
}
const baseOk = /^https?:\/\//.test(EXEC_BASE); // หรือแค่เช็คว่าไม่ว่าง

/* -------------------- UTILS -------------------- */
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

/* ---------- รูปแบบ URL รูปภาพ Google Drive (หลายทางเลือก) ---------- */
function extractDriveId(url) {
  if (!url) return "";
  const s = String(url);
  let m = s.match(/(?:drive|docs)\.google\.com\/file\/d\/([-\w]{10,})(?:\/|$)/i);
  if (m && m[1]) return m[1];
  m = s.match(/[?&]id=([-\w]{10,})/i);
  if (m && m[1]) return m[1];
  m = s.match(/\/d\/([-\w]{10,})(?:\/|$)/i);
  if (m && m[1]) return m[1];
  // เผื่อกรณีพิเศษ
  m = s.match(/([-\w]{25,})/);
  if (m && m[1] && /google\.com/i.test(s)) return m[1];
  return "";
}

function driveCandidates(raw, fallbackId = "") {
  const id = extractDriveId(raw) || (fallbackId || "");
  if (id) {
    // ใช้ thumbnail เป็นตัวเลือกหลัก → เสถียรสุดสำหรับ <img>
    return [
      `https://drive.google.com/thumbnail?id=${id}&sz=w2000`,
      `https://drive.google.com/uc?export=view&id=${id}`,
      `https://drive.google.com/file/d/${id}/preview`,
    ];
  }
  return raw ? [String(raw).trim()] : [];
}

/** แปลง object/ค่า/ลิงก์ → list ของ URL รูปภาพที่ลองโหลดตามลำดับ */
function toPublicUrlList(p) {
  if (!p) return [];
  const s =
    typeof p === "string"
      ? p
      : (p.photo_url || p.url || p.viewUrl || p.publicUrl || p.signedUrl || p.gcsUrl || p.r2Url || "");
  const fallbackId = typeof p === "object" ? (p.fileId || p.id || p.driveId) : "";
  return driveCandidates(s, fallbackId);
}

/** ทำความสะอาด/จัดรูปแบบข้อมูลจาก backend ให้มีโครงเดียวกัน */
function normalizePayload(raw) {
  const d = raw || {};

  // header
  const H = d.header || d.head || d.report?.header || {};
  // photos (รองรับชื่อ keys หลายแบบ)
  const PHOTOS = d.photos || d.images || d.report?.photos || d.report?.images || [];
  // items / chemicals
  const ITEMS = d.items || d.chemicals || d.report?.items || d.report?.chemicals || [];
  // signature
  const SIG = d.signature || d.sign || d.report?.signature || {};

  const head = {
    serviceId: H.serviceId || d.serviceId || d.id,
    date: H.serviceDate || H.date || H.createdAt || d.date,
    customerName: H.customerName || H.clientName || d.customerName || d.clientName,
    address: H.address || H.clientAddress || d.address || d.clientAddress,
    phone: H.phone || H.clientPhone || d.phone || d.clientPhone,
    teamName: H.teamName || H.team || d.teamName || d.team,
    technicianName: H.technicianName || d.technicianName || "",
    method: H.method || H.packageName || H.package || d.method || "-",
  };

  const photos = (Array.isArray(PHOTOS) ? PHOTOS : []).map((p) => {
    const urls = toPublicUrlList(p);
    return {
      zone: p.zone || p.area || "-",
      caption: p.caption || p.note || "",
      urls,
      url: urls[0] || "",
    };
  });

  const items = (Array.isArray(ITEMS) ? ITEMS : []).map((it) => ({
    zone: it.zone || it.area || "-",
    chemical_name: it.chemical_name || it.name || it.title || "",
    qty: it.qty || it.quantity || it.amount || "",
    link: it.link_info || it.link || "",
    remark: it.remark || it.note || "",
  }));

  // ลายเซ็น
  const signatureCandidates = toPublicUrlList(
    SIG.url || SIG.publicUrl || SIG.signedUrl || d.signatureUrl || SIG
  );

  return { head, photos, items, signatureUrl: signatureCandidates[0] || "", signatureCandidates };
}

/* ---------- รูปภาพที่ลองสลับ URL อัตโนมัติเมื่อโหลดล้มเหลว ---------- */
function SmartImg({ sources, alt, style, ...rest }) {
  const [idx, setIdx] = React.useState(0);
  const list = sources && sources.length ? sources : [];
  const src = list[idx] || "";
  return (
    <img
      src={src}
      alt={alt}
      style={style}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => {
        if (idx + 1 < list.length) setIdx(idx + 1);
      }}
      {...rest}
    />
  );
}

/* -------------------- PAGE -------------------- */
export default function ServiceReportPage() {
  const { serviceId } = useParams();
  const navigate = useNavigate();
  const { search } = useLocation();

  // ---- auth: query -> localStorage (optional)
  const qs = new URLSearchParams(search);
  const isPublic = qs.get("public") === "1";

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
  const [payload, setPayload] = useState(null);

  // ---------- Lightbox state ----------
  const [lbIndex, setLbIndex] = useState(-1);
  const photosAll = useMemo(() => payload?.photos || [], [payload]);
  const photosLen = photosAll.length;

  const openLb = useCallback((idx) => {
    setLbIndex(idx);
    document.body.style.overflow = "hidden";
  }, []);

  const closeLb = useCallback(() => {
    setLbIndex(-1);
    document.body.style.overflow = "";
  }, []);

  const prevLb = useCallback((e) => {
    e?.stopPropagation?.();
    if (photosLen) setLbIndex(i => (i - 1 + photosLen) % photosLen);
  }, [photosLen]);

  const nextLb = useCallback((e) => {
    e?.stopPropagation?.();
    if (photosLen) setLbIndex(i => (i + 1) % photosLen);
  }, [photosLen]);

  useEffect(() => {
    if (lbIndex < 0) return;
    const onKey = (e) => {
      if (e.key === "Escape") closeLb();
      else if (e.key === "ArrowLeft") prevLb(e);
      else if (e.key === "ArrowRight") nextLb(e);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lbIndex, prevLb, nextLb, closeLb]);

  const load = useCallback(async () => {
    if (!serviceId || !baseOk) return;
    setLoading(true);
    setErr("");
    setPayload(null);

    try {
      // โหมด private ต้องมี phone/uid
      if (!isPublic && (!auth_phone || !auth_userId)) {
        throw new Error("Error: missing phone");
      }

      // routes & id keys ที่ลองเรียก
      const routes = ["report-by-id", "report/get", "report.getById"];
      const idKeys = [
        { k: "service_id", v: String(serviceId) },
        { k: "serviceId",  v: String(serviceId) },
        { k: "id",         v: String(serviceId) },
      ];

      const basePayload = {
        phone: auth_phone,
        auth_phone: auth_phone,
        uid: auth_userId,
        auth_userId: auth_userId,
        public: isPublic ? "1" : "",
      };

      let lastErr = null;

      // 1) POST (GAS doPost)
      for (const r of routes) {
        for (const id of idKeys) {
          const body = { ...basePayload, route: r, [id.k]: id.v };
          const res = await fetch(EXEC_BASE, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(body),
          });
          const text = await res.text();
          let out;
          try { out = JSON.parse(text); } catch { out = { ok:false, error:`Invalid JSON: ${text.slice(0,150)}` }; }
          if (res.ok && out?.ok) {
            const data = out.data || out;
            setPayload(normalizePayload(data));
            setLoading(false);
            return;
          }
          lastErr = out?.error || `HTTP ${res.status}`;
        }
      }

      // 2) GET (query)
      for (const r of routes) {
        for (const id of idKeys) {
          const q = new URLSearchParams({
            route: r,
            [id.k]: id.v,
            phone: basePayload.phone,
            auth_phone: basePayload.auth_phone,
            uid: basePayload.uid,
            auth_userId: basePayload.auth_userId,
            public: basePayload.public,
          });
          const url = `${EXEC_BASE}?${q.toString()}`;
          const res = await fetch(url);
          const text = await res.text();
          let out;
          try { out = JSON.parse(text); } catch { out = { ok:false, error:`Invalid JSON: ${text.slice(0,150)}` }; }
          if (res.ok && out?.ok) {
            const data = out.data || out;
            setPayload(normalizePayload(data));
            setLoading(false);
            return;
          }
          lastErr = out?.error || `HTTP ${res.status}`;
        }
      }

      throw new Error(lastErr || "Not found");
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [serviceId, auth_phone, auth_userId, isPublic]);

  useEffect(() => { load(); }, [load]);

  // inject CSS (เล็ก กระทัดรัด)
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

  if (!baseOk) return <div style={{ padding: 16, color: "crimson" }}>โปรดตั้งค่า REACT_APP_GAS_BASE ให้ถูกต้อง (ต้องชี้มาที่ /exec หรือ base ที่ต่อ /exec ได้)</div>;
  if (!serviceId) return <div style={{ padding: 16 }}>ไม่มี serviceId ใน URL</div>;

  if (loading) return <div style={{ padding: 16, opacity: 0.7 }}>กำลังโหลด…</div>;
  if (err) return <div style={{ padding: 16, color: "crimson" }}>เกิดข้อผิดพลาด: {err}</div>;
  if (!payload) return <div style={{ padding: 16 }}>ไม่พบข้อมูล</div>;

  const { head, photos, items, signatureUrl, signatureCandidates } = payload;

  return (
    <div className="report-view" style={{ maxWidth: 960, margin: "0 auto", padding: 16 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
        <button className="btn" onClick={() => navigate(-1)}>← กลับ</button>
        <h2 style={{ fontWeight: 800, fontSize: 22, margin: 0 }}>รายงานการบริการ (อ่านอย่างเดียว)</h2>
      </div>
      <div style={{ opacity: 0.7, fontSize: 13, marginBottom: 14 }}>ID: {head.serviceId || serviceId}</div>

      {/* Header / Customer */}
      <section className="card">
        <h3 style={{ fontWeight: 700, marginBottom: 8 }}>ข้อมูลลูกค้า</h3>
        <div className="grid">
          <div className="kv"><div className="k">ลูกค้า</div><div>{head.customerName || "-"}</div></div>
          <div className="kv"><div className="k">โทร</div><div>{head.phone || "-"}</div></div>
          <div className="kv"><div className="k">ที่อยู่</div><div>{head.address || "-"}</div></div>
          <div className="kv">
            <div className="k">ทีม / ช่าง</div>
            <div>{[head.teamName, head.technicianName].filter(Boolean).join(" / ") || "-"}</div>
          </div>
          <div className="kv"><div className="k">วันที่บริการ</div><div>{fmtDateThai(head.date)}</div></div>
          <div className="kv"><div className="k">แพ็กเกจ</div><div>{head.method || "-"}</div></div>
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
                {list.map((p, i) => {
                  let idxAll = photosAll.indexOf(p);
                  if (idxAll < 0) idxAll = photosAll.findIndex(x => x.url === p.url);
                  return (
                    <figure
                      key={`${zone}-${i}`}
                      title="คลิกเพื่อดูภาพใหญ่"
                      onClick={() => openLb(Math.max(idxAll, 0))}
                      style={{
                        margin: 0, border: "1px solid #eee", borderRadius: 10, padding: 8,
                        cursor: "zoom-in", background: "#fff"
                      }}
                    >
                      <div style={{ width: "100%", aspectRatio: "1/1", background: "#f5f5f5", borderRadius: 8, overflow: "hidden" }}>
                        <SmartImg
                          sources={p.urls || [p.url].filter(Boolean)}
                          alt={p.caption || `photo-${i}`}
                          style={{ width: "100%", height: "100%", objectFit: "cover", display:"block" }}
                        />
                      </div>
                      {p.caption ? <figcaption style={{ fontSize: 12, marginTop: 6 }}>{p.caption}</figcaption> : null}
                    </figure>
                  );
                })}
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
                      <td style={{ borderTop: "1px solid #eee", padding: "8px 6px" }}>{it.chemical_name || "-"}</td>
                      <td style={{ borderTop: "1px solid #eee", padding: "8px 6px" }}>{it.qty || "-"}</td>
                      <td style={{ borderTop: "1px solid #eee", padding: "8px 6px" }}>
                        {it.link ? (
                          <a href={it.link} target="_blank" rel="noreferrer">{it.link}</a>
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
            <SmartImg
              sources={signatureCandidates || [signatureUrl]}
              alt="signature"
              style={{ width: "100%", maxWidth: 420 }}
            />
          </div>
        </section>
      )}

      {/* -------- Lightbox Overlay -------- */}
      {lbIndex >= 0 && photosLen > 0 && (
        <div
          onClick={closeLb}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,.85)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000, padding: 16
          }}
        >
          {/* ปิด */}
          <button
            onClick={(e)=>{e.stopPropagation(); closeLb();}}
            aria-label="Close"
            style={{
              position:"fixed", top:16, right:16,
              width:40, height:40, borderRadius:8,
              background:"rgba(255,255,255,.15)", color:"#fff",
              border:0, fontSize:24, cursor:"pointer"
            }}
          >
            ×
          </button>

          {/* ก่อนหน้า / ถัดไป */}
          {photosLen > 1 && (
            <>
              <button
                onClick={prevLb}
                aria-label="Previous"
                style={{
                  position:"fixed", left:16, top:"50%", transform:"translateY(-50%)",
                  width:44, height:44, borderRadius:"50%",
                  background:"rgba(255,255,255,.15)", color:"#fff", border:0, fontSize:24, cursor:"pointer"
                }}
              >
                ‹
              </button>
              <button
                onClick={nextLb}
                aria-label="Next"
                style={{
                  position:"fixed", right:16, top:"50%", transform:"translateY(-50%)",
                  width:44, height:44, borderRadius:"50%",
                  background:"rgba(255,255,255,.15)", color:"#fff", border:0, fontSize:24, cursor:"pointer"
                }}
              >
                ›
              </button>
            </>
          )}

          {/* ภาพใหญ่ */}
          <figure
            onClick={(e)=>e.stopPropagation()}
            style={{ margin:0, maxWidth:"90vw", maxHeight:"90vh", display:"grid", gap:8, justifyItems:"center" }}
          >
            <SmartImg
              sources={photosAll[lbIndex]?.urls || [photosAll[lbIndex]?.url].filter(Boolean)}
              alt={photosAll[lbIndex]?.caption || ""}
              style={{ maxWidth:"90vw", maxHeight:"80vh", objectFit:"contain", borderRadius:12, boxShadow:"0 6px 30px rgba(0,0,0,.5)" }}
            />
            {(photosAll[lbIndex]?.caption || photosAll[lbIndex]?.zone) && (
              <figcaption style={{ color:"#fff", opacity:.9, textAlign:"center", fontSize:14 }}>
                {photosAll[lbIndex]?.caption || ""}
                {photosAll[lbIndex]?.zone ? <div style={{opacity:.8, fontSize:12}}>โซน: {photosAll[lbIndex].zone}</div> : null}
              </figcaption>
            )}
          </figure>
        </div>
      )}
    </div>
  );
}
