// src/ReportNew.jsx (Simple Mode - Combined Group + Save)
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";

const LS_KEY = 'tech-ui';
const EXEC_BASE = (process.env.REACT_APP_GAS_BASE || "").replace(/\/+$/, "");
const genId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

// ---------- helpers ----------
async function postJSON(url, payload) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  try { return JSON.parse(text); }
  catch { return { ok:false, error:`Invalid JSON: ${text.slice(0,150)}` }; }
}
function getAuth() {
  try {
    const s = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
    return { phone: (s.phone || "").trim(), userId: (s.userId || "").trim() };
  } catch { return { phone:"", userId:"" }; }
}
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result).split(",")[1]);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

// ---------- CHEM preset ----------
const CHEM_LIBRARY = [
  { key:"Imidacloprid 5%", name:"อิมิฟอร์ซ", defaultQty:"1 L/150 L",
    link:"https://drive.google.com/file/d/1Lza45QqIuqg9P4_-5qZZkp2FCY76RsbU/view" },
  { key:"Bromadioguard",    name:"โบรมาดิโอการ์ด (เหยื่อหนู)",     defaultQty:"1 unit",
    link:"https://www.icpladda.com/wp-content/uploads/2019/09/SDS_Bromadioguard_rev_004_5_9_2017.pdf" },
  { key:"Cypermethrin 10%",   name:"ไซเพอร์การ์ด",     defaultQty:"1 L/100 L",
    link:"https://www.icpladda.com/wp-content/uploads/2019/09/SDS_Cyperguard_10_EC_Rev_005_6_9_2017.pdf" },
  { key:"Fipronil 5%",   name:"อีลิมิเนท(ฟิปโฟนิล)",     defaultQty:"1 L/200 L",
    link:"https://www.icpladda.com/product/%e0%b8%ad%e0%b8%b5%e0%b8%a5%e0%b8%b5%e0%b8%a1%e0%b8%b4%e0%b9%80%e0%b8%99%e0%b8%97/" },
  { key:"Nemesis land station",   name:"เหยื่อปลวกนอกบ้าน",     defaultQty:"4 units",
    link:"https://www.chemicalthai.com/product/Nemesis-land-station" },
  { key:"Termatrix",   name:"เหยื่อปลวกในบ้าน",     defaultQty:"2-4 units",
    link:"https://www.sherwood.co.th/msds/Termatrix_Termite_Bait.pdf" },
];
const findChemByName = (name) => CHEM_LIBRARY.find(c => c.name === name);
const findChemByKey  = (key)  => CHEM_LIBRARY.find(c => c.key === key);

export default function ReportNew() {
  const { serviceId } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  // ====== ชุดรวม (รูป + สารเคมี) — เริ่มต้น 1 ชุด ======
  const [groups, setGroups] = useState([
    {
      id: genId(),
      label: "",       // โซนหลักของชุด
      caption: "",     // คำอธิบายติดทุกภาพของชุด
      files: [],       // ไฟล์ภาพของชุด
      chems: [         // แถวสารเคมีของชุด (เริ่ม 1 แถว)
        { id: genId(), name:"", qty:"", zone:"", link:"", remark:"" }
      ]
    }
  ]);

  // สถานะทำงานรวม (ใช้ disable ปุ่ม/input และ block ปิดหน้า)
  const [busy, setBusy] = useState(false);

  // ✅ ปุ่ม “เพิ่มชุด”
  function addGroup() {
    const id = genId();
    setGroups(prev => [
      ...prev,
      { id, label:"", caption:"", files:[], chems:[{ id: genId(), name:"", qty:"", zone:"", link:"", remark:"" }] }
    ]);
  }

  // ป้องกันปิด/รีเฟรชขณะบันทึก/อัปโหลด
  useEffect(() => {
    const handler = (e) => { if (busy) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [busy]);

  // base url guard
  const baseOk = useMemo(
    () => /^https?:\/\/script\.google(?:usercontent)?\.com\/macros\//.test(EXEC_BASE),
    []
  );

  const load = useCallback(async () => {
    if (!serviceId || !baseOk) return;
    setLoading(true); setErr(""); setData(null);
    try {
      const { phone, userId } = getAuth();
      if (!phone || !userId) throw new Error("ต้องตั้งค่าเบอร์ + userId ในหน้า Technician ก่อน");
      const qs = new URLSearchParams({
        route:"report-by-id",
        service_id:String(serviceId),
        auth_phone: phone,
        auth_userId: userId
      });
      const r = await fetch(`${EXEC_BASE}?${qs.toString()}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const out = await r.json();
      if (!out.ok) throw new Error(out.error || "not found");
      setData(out);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [serviceId, baseOk]);

  useEffect(() => { load(); }, [load]);

  // inject minimal CSS
  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      .report-ui .input{height:44px;padding:8px 12px;border-radius:10px;border:1px solid #e5e7eb}
      .report-ui .btn-primary,.report-ui .btn{
        height:44px;border-radius:10px;
        padding:0 16px; box-sizing:border-box;
        display:inline-flex; align-items:center; justify-content:center;
        line-height:1; font-size:14px; font-weight:700;
      }
      .report-ui .btn-primary{border:0;background:#0ea5e9;color:#fff;font-weight:700}
      .report-ui .btn{border:1px solid #e5e7eb;background:#fff}
      .report-ui .card{background:#fff;border-radius:12px;padding:16px;box-shadow:0 2px 10px rgba(0,0,0,.06);margin-bottom:16px}
      .muted{opacity:.7}
      .subtle{border:1px dashed #dcdcdc;border-radius:12px;padding:12px}
      .report-ui .btn:empty{display:none}
      .actions{display:flex;justify-content:flex-end;gap:8px}
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  // ===== helpers: จัดการแถวสารเคมีในชุด =====
  function removeChemRow(groupId, rowId) {
    setGroups(prev => prev.map(g => {
      if (g.id !== groupId) return g;
      const next = g.chems.length > 1 ? g.chems.filter(x => x.id !== rowId) : g.chems;
      return { ...g, chems: next };
    }));
  }
  function setChemRow(groupId, rowId, field, value) {
    setGroups(prev => prev.map(g => {
      if (g.id !== groupId) return g;
      return { ...g, chems: g.chems.map(x => x.id === rowId ? { ...x, [field]: value } : x) };
    }));
  }
  function pickPreset(groupId, rowId, preset) {
    const c = findChemByKey(preset);
    if (!c) return;
    setGroups(prev => prev.map(g => {
      if (g.id !== groupId) return g;
      return {
        ...g,
        chems: g.chems.map(x => x.id !== rowId ? x : ({
          ...x,
          name: c.name,
          qty:  x.qty  || c.defaultQty,
          link: x.link || c.link
        }))
      };
    }));
  }

  // ====== บันทึกสารเคมีทุกชุด → Google Sheet ======
  async function saveChemicalsFromGroups() {
    const items = groups.flatMap(g =>
      g.chems
        .map(r => {
          const name = (r.name || "").trim();
          const qty  = (r.qty  || "").trim();
          const zone = (r.zone || g.label || "").trim(); // ถ้าไม่กรอก zone ใช้ label ของชุด
          const link = (r.link || "").trim();
          const remark = (r.remark || "").trim();
          if (!name && !qty && !zone && !link && !remark) return null;
          const preset = findChemByName(name);
          return {
            name: name || (preset?.name || ""),
            qty:  qty  || (preset?.defaultQty || ""),
            zone, link: link || (preset?.link || ""), remark
          };
        })
        .filter(Boolean)
    );

    if (!items.length) return { ok:true };

    const { phone, userId } = getAuth();
    return postJSON(`${EXEC_BASE}`, {
      route: "append-items",
      service_id: serviceId,
      items,
      auth_phone: phone,
      auth_userId: userId,
    });
  }

  // ====== อัปโหลดรูปของแต่ละชุด → Google Drive ======
  async function uploadGroupPhotos({ label, caption, files }) {
    if (!files?.length) return { ok:true, uploaded: [] };
    const { phone, userId } = getAuth();
    for (const file of files) {
      const base64 = await readFileAsBase64(file);
      const out = await postJSON(`${EXEC_BASE}`, {
        route: "upload-photo",
        service_id: serviceId,
        filename: file.name,
        mimeType: file.type || "image/jpeg",
        data: base64,
        zone: (label || "").trim(),
        caption: (caption || "").trim(),
        auth_phone: phone,
        auth_userId: userId,
      });
      if (!out?.ok) {
        throw new Error(out?.error || `อัปโหลดรูป (${label || 'ไม่ระบุโซน'}) ไม่สำเร็จ`);
      }
    }
    return { ok:true };
  }

  // ✅ ปุ่ม “บันทึกข้อมูล” — เซฟสารเคมีทุกชุด + อัปโหลดรูปทุกชุด
  async function saveAll() {
    try {
      setBusy(true);

      const chemRes = await saveChemicalsFromGroups();
      if (chemRes && chemRes.ok === false) {
        throw new Error(chemRes.error || "บันทึกสารเคมีไม่สำเร็จ");
      }

      for (const g of groups) {
        await uploadGroupPhotos(g);
      }

      await load(); // รีเฟรชแกลเลอรีที่อัปโหลดแล้ว
      alert("บันทึกข้อมูลเรียบร้อย");
      navigate("/");
    } catch (e) {
      alert(String(e.message || e));
    } finally {
      setBusy(false);
    }
  }

  // ---------- Guards ----------
  if (!/^https?:\/\//.test(EXEC_BASE)) {
    return <div style={{padding:16,color:"red"}}>ตั้งค่า REACT_APP_GAS_BASE ให้ชี้ Apps Script /exec หรือ base ที่ต่อ /exec ได้</div>;
  }
  if (!serviceId) return <div style={{padding:16}}>ไม่มี serviceId ใน URL</div>;
  if (err) {
    const { phone, userId } = getAuth();
    const hint = (!phone || !userId) ? " (โปรดตั้งค่าเบอร์และ userId ในหน้า Technician ก่อน)" : "";
    return <div style={{padding:16,color:"red"}}>ผิดพลาด: {String(err)}{hint}</div>;
  }
  if (loading || !data) return <div style={{padding:16,opacity:.7}}>กำลังโหลด…</div>;

  const H = data.header || {};
  const photos = data.photos || [];

  return (
    <div className="report-ui" style={{maxWidth:960, margin:"0 auto", padding:16}}>
      <h2 style={{fontWeight:800, fontSize:22, marginBottom:6}}>Service Report</h2>
      <div style={{opacity:.7, fontSize:13, marginBottom:14}}>ID: {H.serviceId}</div>

      {/* -------- Customer Info -------- */}
      <section className="card">
        <h3 style={{ fontWeight:700, marginBottom:8 }}>ข้อมูลลูกค้า</h3>
        <div style={{display:"grid",gap:6}}>
          <Row k="ลูกค้า" v={H.customerName||"-"} />
          <Row k="โทร" v={H.phone||"-"} />
          <Row k="ที่อยู่" v={H.address||"-"} />
          <Row k="ทีม / ช่าง" v={[H.teamName,H.technicianName].filter(Boolean).join(" / ")||"-"} />
          <Row k="วันที่บริการ" v={H.serviceDate||"-"} />
          <Row k="แพ็กเกจ" v={H.method||"-"} />
        </div>
      </section>

      {/* -------- Gallery (ของที่อัปโหลดแล้ว) -------- */}
      <section className="card">
        <h3 style={{ fontWeight:700, marginBottom:8 }}>
          ภาพถ่ายประกอบ ({photos.length}) <span className="muted">• ชุดที่จะอัปโหลด: {groups.length} ชุด</span>
        </h3>

        {photos.length === 0 ? (
          <div style={{opacity:.6, marginBottom:8}}>— ยังไม่มีรูป —</div>
        ) : (
          <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(120px, 1fr))", gap:8, marginBottom:12}}>
            {photos.map((p,i)=>(
              <div key={i} style={{border:"1px solid #eee", borderRadius:10, padding:6}}>
                <div style={{width:"100%", aspectRatio:"1/1", background:"#f5f5f5", borderRadius:8, overflow:"hidden"}}>
                  <img src={p.photo_url} alt={p.caption||""} style={{width:"100%", height:"100%", objectFit:"cover"}} loading="lazy"/>
                </div>
                {p.caption ? <div style={{fontSize:12, marginTop:4}}>{p.caption}</div> : null}
                {p.zone ? <div style={{fontSize:11, opacity:.65}}>โซน: {p.zone}</div> : null}
              </div>
            ))}
          </div>
        )}

        {/* -------- ชุดรวม (รูป + สารเคมี) -------- */}
        {groups.map((g, idx) => (
          <div key={g.id} className="subtle" style={{display:"grid", gap:12, marginBottom:12}}>
            <div className="muted" style={{fontWeight:700}}>ชุดที่ {idx+1}</div>

            {/* โซน + คำอธิบาย */}
            <div style={{display:"grid", gridTemplateColumns:"1fr 2fr", gap:8}}>
              <input
                className="input"
                placeholder="โซนของชุด (เช่น ห้องครัว/หน้าบ้าน)"
                value={g.label}
                onChange={(e)=> setGroups(prev => prev.map(x => x.id===g.id ? { ...x, label: e.target.value } : x))}
                disabled={busy}
              />
              <input
                className="input"
                placeholder="คำอธิบาย (แนบกับรูปทุกภาพในชุด)"
                value={g.caption}
                onChange={(e)=> setGroups(prev => prev.map(x => x.id===g.id ? { ...x, caption: e.target.value } : x))}
                disabled={busy}
              />
            </div>

            {/* ไฟล์รูป */}
            <label className="btn" style={{width:"auto", display:"inline-flex"}}>
              เลือกไฟล์รูป — {g.files?.length || 0} ไฟล์
              <input
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e)=>{
                  const files = Array.from(e.target.files || []); 
                  setGroups(prev => prev.map(x => x.id === g.id ? { ...x, files } : x));
                }}
                disabled={busy}
              />
            </label>

            {/* ตารางสารเคมีของชุด */}
            <div style={{display:"grid", gap:8}}>
              {g.chems.map((r)=>(
                <div key={r.id} style={{display:"grid", gap:8, border:"1px solid #e5e7eb", padding:12, borderRadius:12}}>
                  <div style={{display:"grid", gridTemplateColumns:"1fr auto", gap:8, alignItems:"center"}}>
                    <select
                      className="input"
                      value={r.name ? (findChemByName(r.name)?.key || "") : ""}
                      onChange={(e)=>pickPreset(g.id, r.id, e.target.value)}
                      disabled={busy}
                    >
                      <option value="">— เลือกสารเคมี (เติมอัตโนมัติ) —</option>
                      {CHEM_LIBRARY.map(c => <option key={c.key} value={c.key}>{c.name}</option>)}
                    </select>
                    <button type="button" className="btn"
                            onClick={()=>removeChemRow(g.id, r.id)}
                            disabled={g.chems.length===1 || busy}>
                      ลบ
                    </button>
                  </div>
                  <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:8}}>
                    <input className="input" placeholder="ชื่อสารเคมี"
                           value={r.name}
                           onChange={e=>setChemRow(g.id, r.id,"name",e.target.value)}
                           disabled={busy}/>
                    <input className="input" placeholder="ปริมาณ"
                           value={r.qty}
                           onChange={e=>setChemRow(g.id, r.id,"qty",e.target.value)}
                           disabled={busy}/>
                  </div>
                  <div style={{display:"grid", gridTemplateColumns:"1fr", gap:8}}>
                    <input className="input" placeholder="ลิงก์ข้อมูล (ถ้ามี)"
                           value={r.link}
                           onChange={e=>setChemRow(g.id, r.id,"link",e.target.value)}
                           disabled={busy}/>
                  </div>
                  <input className="input" placeholder="หมายเหตุ"
                         value={r.remark}
                         onChange={e=>setChemRow(g.id, r.id,"remark",e.target.value)}
                         disabled={busy}/>
                </div>
              ))}
            </div>

            {groups.length > 1 && (
              <button
                type="button"
                className="btn"
                onClick={()=> setGroups(prev => prev.filter(x => x.id !== g.id))}
                disabled={busy}
              >
                ลบชุดนี้
              </button>
            )}
          </div>
        ))}

        {/* ปุ่มเพิ่มชุด */}
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:8}}>
          <button type="button" className="btn" style={{width:"100%"}} onClick={addGroup} disabled={busy}>
            + เพิ่มชุด
          </button>
          <button type="button" className="btn-primary" style={{width:"100%"}} onClick={saveAll} disabled={busy || loading}>
            {busy ? "กำลังบันทึก…" : "บันทึกข้อมูล"}
          </button>
        </div>
      </section>
    </div>
  );
}

// ---------- small UI helpers ----------
function Row({k,v}){ 
  return (
    <div style={{display:"grid",gridTemplateColumns:"120px 1fr",gap:10,padding:"6px 0"}}>
      <div style={{opacity:.65}}>{k}</div><div>{v}</div>
    </div>
  );
}
