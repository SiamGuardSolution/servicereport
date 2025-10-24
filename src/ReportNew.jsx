// src/ReportNew.jsx (Simple Mode)
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";


const LS_KEY = 'tech-ui';
const EXEC_BASE = (process.env.REACT_APP_GAS_BASE || "").replace(/\/+$/, "");

const genId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const isChemRowEmpty = (r) =>
  !((r?.name || r?.qty || r?.zone || r?.link || r?.remark || '').trim());

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
  { key:"imidacloprid5cs", name:"Imidacloprid 5% CS", defaultQty:"30 ml/10 L",
    link:"https://pubchem.ncbi.nlm.nih.gov/compound/Imidacloprid" },
  { key:"bifenthrin25",    name:"Bifenthrin 2.5%",     defaultQty:"30 ml/10 L",
    link:"https://pubchem.ncbi.nlm.nih.gov/compound/Bifenthrin" },
  { key:"cypermethrin5",   name:"Cypermethrin 5%",     defaultQty:"50 ml/10 L",
    link:"https://pubchem.ncbi.nlm.nih.gov/compound/Cypermethrin" },
];
const findChemByName = (name) => CHEM_LIBRARY.find(c => c.name === name);
const findChemByKey  = (key)  => CHEM_LIBRARY.find(c => c.key === key);

// =================================
export default function ReportNew() {
  const { serviceId } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  // Simple Photo Uploader (single area, multi files)
  const [pickedFiles, setPickedFiles] = useState([]);
  const [photoZone, setPhotoZone] = useState("");
  const [photoCaption, setPhotoCaption] = useState("");
  const [uploading, setUploading] = useState(false);

  // Simple Chemical Editor (table rows)
  
  const [savingChem, setSavingChem] = useState(false);
  const [chemRows, setChemRows] = useState([
    { id: genId(), name:"", qty:"", zone:"", link:"", remark:"" }
  ]);

  // Exit control 
  const [savingAll, setSavingAll] = useState(false);

  // protect refresh/close while working
  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (uploading || savingChem) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [uploading, savingChem]);

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
      if (!phone || !userId) {
        throw new Error("ต้องตั้งค่าเบอร์ + userId ในหน้า Technician ก่อน");
      }
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

  // inject minimal CSS + sticky footer
  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      .report-ui .input{height:44px;padding:8px 12px;border-radius:10px;border:1px solid #e5e7eb}
      .report-ui .btn-primary{height:44px;border:0;border-radius:10px;background:#0ea5e9;color:#fff;font-weight:700}
      .report-ui .btn{height:44px;border:1px solid #e5e7eb;border-radius:10px;background:#fff}
      .report-ui .card{background:#fff;border-radius:12px;padding:16px;box-shadow:0 2px 10px rgba(0,0,0,.06);margin-bottom:16px}
      .report-ui .footer{position:sticky;bottom:0;background:#fff;padding:10px 12px;border-top:1px solid #ececec;display:flex;gap:8px;z-index:5}
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  // ---------- Photos (simple) ----------
  function onPickFiles(e) {
    setPickedFiles(Array.from(e.target.files || []));
  }
  async function uploadPhotos() {
    if (!pickedFiles.length) { alert("กรุณาเลือกไฟล์อย่างน้อย 1 รูป"); return; }
    try {
      setUploading(true);
      const { phone, userId } = getAuth();
      for (const file of pickedFiles) {
        const base64 = await readFileAsBase64(file);
        const out = await postJSON(`${EXEC_BASE}`, {
          route: "upload-photo",
          service_id: serviceId,
          filename: file.name,
          mimeType: file.type || "image/jpeg",
          data: base64,
          zone: (photoZone || "").trim(),
          caption: (photoCaption || "").trim(),
          auth_phone: phone,
          auth_userId: userId,
        });
        if (!out.ok) throw new Error(out.error || `อัปโหลดรูป ${file.name} ไม่สำเร็จ`);
      }
      setPickedFiles([]); setPhotoZone(""); setPhotoCaption("");
      await load();
    } catch (e) {
      alert(String(e.message || e));
    } finally {
      setUploading(false);
    }
  }

  // ---------- Chemicals (simple) ----------
  function addRow() {
    setChemRows(r => [...r, { id: genId(), name:"", qty:"", zone:"", link:"", remark:"" }]);
  }
  function removeRow(id) {
    setChemRows(r => r.length>1 ? r.filter(x => x.id !== id) : r);
  }
  function setRow(id, field, value) {
    setChemRows(r => r.map(x => x.id===id ? { ...x, [field]: value } : x));
  }
  function pickPreset(id, preset) {
    const c = findChemByKey(preset);
    setChemRows(r => r.map(x => {
      if (x.id !== id) return x;
      if (!c) return x;
      return {
        name: c.name,
        qty:  x.qty  || c.defaultQty,
        link: x.link || c.link
      };
    }));
  }
  async function saveChemicals() {
    const items = chemRows
      .map(r => {
        const name = (r.name || "").trim();
        const qty  = (r.qty  || "").trim();
        const zone = (r.zone || "").trim();
        const link = (r.link || "").trim();
        const remark = (r.remark || "").trim();
        if (!name && !qty && !zone && !link && !remark) return null; // ข้ามแถวว่าง
        const preset = findChemByName(name);
        return {
          name: name || (preset?.name || ""),
          qty:  qty || (preset?.defaultQty || ""),
          zone, link: link || (preset?.link || ""), remark
        };
      })
      .filter(Boolean);

    if (!items.length) { alert("ยังไม่มีรายการสารเคมี"); return; }

    try {
      setSavingChem(true);
      const { phone, userId } = getAuth();
      const out = await postJSON(`${EXEC_BASE}`, {
        route: "append-items",
        service_id: serviceId,
        items,
        auth_phone: phone,
        auth_userId: userId,
      });
      if (!out.ok) throw new Error(out.error || "บันทึกสารเคมีไม่สำเร็จ");
      // เคลียร์ให้เหลือแถวเดียวว่าง ๆ
      setChemRows([{ id: genId(), name:"", qty:"", zone:"", link:"", remark:"" }]);
      await load();
    } catch (e) {
      alert(String(e.message || e));
    } finally {
      setSavingChem(false);
    }
  }

  async function saveAllAndExit() {
    try {
      setSavingAll(true);
      if (pickedFiles.length > 0) {
        await uploadPhotos();
      }
      const hasChem = chemRows.some(r => !isChemRowEmpty(r));
      if (hasChem) {
        await saveChemicals();
      }
      navigate('/');
    } catch (e) {
        alert(String(e.message || e));
    } finally {
      setSavingAll(false);
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
  const items  = data.items  || [];

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

      {/* -------- Photos (Simple) -------- */}
      <section className="card">
        <h3 style={{ fontWeight:700, marginBottom:8 }}>ภาพถ่ายประกอบ ({photos.length})</h3>

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

        {/* Uploader (single area) */}
        <div style={{display:"grid", gap:8}}>
          <input type="file" className="input" accept="image/*" multiple onChange={onPickFiles} disabled={uploading}/>
          <div style={{display:"grid", gridTemplateColumns:"1fr 2fr", gap:8}}>
            <input className="input" placeholder="โซน (ใช้กับรูปชุดนี้)" value={photoZone} onChange={e=>setPhotoZone(e.target.value)} disabled={uploading}/>
            <input className="input" placeholder="คำอธิบาย (ใช้กับรูปชุดนี้)" value={photoCaption} onChange={e=>setPhotoCaption(e.target.value)} disabled={uploading}/>
          </div>
          <button className="btn-primary" onClick={uploadPhotos} disabled={uploading}>
            {uploading ? "กำลังอัปโหลด…" : `+ อัปโหลดรูป (${pickedFiles.length||0} ไฟล์)`}
          </button>
        </div>
      </section>

      {/* -------- Chemicals (Simple Table) -------- */}
      <section className="card">
        <h3 style={{ fontWeight:700, marginBottom:8 }}>สารเคมีที่ใช้ (ปัจจุบัน: {items.length})</h3>

        {items.length === 0 ? (
          <div style={{opacity:.6, marginBottom:8}}>— ยังไม่มีรายการ —</div>
        ) : (
          <table style={{width:"100%", borderCollapse:"collapse", marginBottom:12}}>
            <thead>
              <tr>{["ชื่อสารเคมี","ปริมาณ","ลิงก์ข้อมูล","โซน","หมายเหตุ"].map(h =>
                <th key={h} style={thTdStyle}>{h}</th>
              )}</tr>
            </thead>
            <tbody>
              {items.map((it,i)=>(
                <tr key={i}>
                  <td style={thTdStyle}>{it.chemical_name||"-"}</td>
                  <td style={thTdStyle}>{it.qty||"-"}</td>
                  <td style={thTdStyle}>{it.link_info ? <a href={it.link_info} target="_blank" rel="noreferrer">{it.link_info}</a> : ""}</td>
                  <td style={thTdStyle}>{it.zone||""}</td>
                  <td style={thTdStyle}>{it.remark||""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Editable rows */}
        <div style={{display:"grid", gap:8}}>
          {chemRows.map((r,idx)=>(
            <div key={r.id} style={{display:"grid", gap:8, border:"1px solid #e5e7eb", padding:12, borderRadius:12}}>
              <div style={{display:"grid", gridTemplateColumns:"1fr auto", gap:8, alignItems:"center"}}>
                <select className="input" value={r.name ? (findChemByName(r.name)?.key || "") : ""} onChange={(e)=>pickPreset(r.id, e.target.value)} disabled={savingChem}>
                  <option value="">— เลือกสารเคมี (เติมอัตโนมัติ) —</option>
                  {CHEM_LIBRARY.map(c => <option key={c.key} value={c.key}>{c.name}</option>)}
                </select>
                <button type="button" className="btn" onClick={()=>removeRow(r.id)} disabled={chemRows.length===1 || savingChem}>ลบ</button>
              </div>
              <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:8}}>
                <input className="input" placeholder="ชื่อสารเคมี" value={r.name} onChange={e=>setRow(r.id,"name",e.target.value)} disabled={savingChem}/>
                <input className="input" placeholder="ปริมาณ" value={r.qty} onChange={e=>setRow(r.id,"qty",e.target.value)} disabled={savingChem}/>
              </div>
              <div style={{display:"grid", gridTemplateColumns:"1fr 2fr", gap:8}}>
                <input className="input" placeholder="โซน" value={r.zone} onChange={e=>setRow(r.id,"zone",e.target.value)} disabled={savingChem}/>
                <input className="input" placeholder="ลิงก์ข้อมูล (ถ้ามี)" value={r.link} onChange={e=>setRow(r.id,"link",e.target.value)} disabled={savingChem}/>
              </div>
              <input className="input" placeholder="หมายเหตุ" value={r.remark} onChange={e=>setRow(r.id,"remark",e.target.value)} disabled={savingChem}/>
            </div>
          ))}

          <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
            <button type="button" className="btn" onClick={addRow} disabled={savingChem}>+ เพิ่มรายการ</button>
            <button type="button" className="btn-primary" onClick={saveChemicals} disabled={savingChem}>
              {savingChem ? "กำลังบันทึก…" : "บันทึกสารเคมี"}
            </button>
          </div>
        </div>
      </section>

      {/* -------- Sticky Footer: main actions -------- */}
      <div className="footer">
        <button
          type="button"
          className="btn"
          onClick={saveAllAndExit}
          disabled={uploading || savingChem || savingAll}
          style={{marginLeft:"auto"}}
          title="บันทึกรูปที่เลือก + สารเคมี แล้วกลับหน้า Technician"
        >
          {savingAll ? 'กำลังบันทึกทั้งหมด…' : 'บันทึกและออก'}
        </button>
      </div>
    </div>
  );
}

// ---------- small UI helpers ----------
function Row({k,v}){ return (
  <div style={{display:"grid",gridTemplateColumns:"120px 1fr",gap:10,padding:"6px 0"}}>
    <div style={{opacity:.65}}>{k}</div><div>{v}</div>
  </div>
);}
const thTdStyle={borderTop:"1px solid #eee",padding:"8px 6px",fontSize:14};
