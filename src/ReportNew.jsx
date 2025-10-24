// src/ReportNew.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
const LS_KEY = 'tech-ui';

const EXEC_BASE = (process.env.REACT_APP_GAS_BASE || "").replace(/\/+$/, "");

// simple request กัน preflight
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

// อ่าน auth จาก localStorage
function getAuth() {
  try {
    const s = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
    return { phone: (s.phone || "").trim(), userId: (s.userId || "").trim() };
  } catch { return { phone:"", userId:"" }; }
}

/* คลังสารเคมี: แก้/เพิ่มได้ */
const CHEM_LIBRARY = [
  { key:"imidacloprid5cs", name:"Imidacloprid 5% CS", defaultQty:"30 ml/10 L",
    link:"https://pubchem.ncbi.nlm.nih.gov/compound/Imidacloprid" },
  { key:"bifenthrin25",    name:"Bifenthrin 2.5%",     defaultQty:"30 ml/10 L",
    link:"https://pubchem.ncbi.nlm.nih.gov/compound/Bifenthrin" },
  { key:"cypermethrin5",   name:"Cypermethrin 5%",     defaultQty:"50 ml/10 L",
    link:"https://pubchem.ncbi.nlm.nih.gov/compound/Cypermethrin" },
];
const findChem = (key) => CHEM_LIBRARY.find(c => c.key === key);

/* file->base64 (ตัด data:...prefix ออก) */
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result).split(",")[1]);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

/* group helper */
function groupBy(arr, getKey) {
  const map = new Map();
  arr.forEach(it => {
    const k = getKey(it) || "— อื่นๆ —";
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(it);
  });
  return Array.from(map.entries());
}

/* id ชุด */
const genId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

export default function ReportNew() {
  const { serviceId } = useParams();

  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  // ===== PHOTO GROUPS (หลายชุด) =====
  const [photoGroups, setPhotoGroups] = useState([
    { id: genId(), files: [], zone: "", caption: "" }
  ]);
  const [uploading, setUploading] = useState(false);

  // ===== CHEMICAL GROUPS (หลายชุด) =====
  const [chemGroups, setChemGroups] = useState([
    { id: genId(), chemKey:"", qty:"", zone:"", link:"", remark:"" }
  ]);
  const [savingChem, setSavingChem] = useState(false);

  // รองรับ script.google.com และ script.googleusercontent.com
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

  // inject CSS
  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      .report-ui .input{height:44px;padding:8px 12px;border-radius:10px;border:1px solid #e5e7eb}
      .report-ui .btn-primary{height:44px;border:0;border-radius:10px;background:#0ea5e9;color:#fff;font-weight:700}
      .report-ui .btn{height:44px;border:1px solid #e5e7eb;border-radius:10px;background:#fff}
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  // ===== Actions: Photo Groups =====
  function addPhotoGroup() {
    setPhotoGroups(gs => [...gs, { id: genId(), files: [], zone: "", caption: "" }]);
  }
  function removePhotoGroup(id) {
    setPhotoGroups(gs => (gs.length > 1 ? gs.filter(g => g.id !== id) : gs));
  }
  function setGroupField(id, field, value) {
    setPhotoGroups(gs => gs.map(g => (g.id === id ? { ...g, [field]: value } : g)));
  }
  function setGroupFiles(id, fileList) {
    const arr = Array.from(fileList || []);
    setPhotoGroups(gs => gs.map(g => (g.id === id ? { ...g, files: arr } : g)));
  }

  async function uploadGroup(id, e) {
    e?.preventDefault?.();
    const g = photoGroups.find(x => x.id === id);
    if (!g) return;
    if (!g.files.length) { alert("กรุณาเลือกไฟล์อย่างน้อย 1 ไฟล์ในชุดนี้"); return; }

    try {
      setUploading(true);
      for (const file of g.files) {
        const base64 = await readFileAsBase64(file);
        const { phone, userId } = getAuth();
        const out = await postJSON(`${EXEC_BASE}`, {
          route: "upload-photo",
          service_id: serviceId,
          filename: file.name,
          mimeType: file.type || "image/jpeg",
          data: base64,
          zone: (g.zone || "").trim(),
          caption: (g.caption || "").trim(),
          auth_phone: phone,
          auth_userId: userId,
        });
        if (!out.ok) throw new Error(out.error || `อัปโหลดรูป ${file.name} ไม่สำเร็จ`);
      }
      setPhotoGroups(gs => gs.map(x => x.id === id ? ({ ...x, files: [], zone: "", caption: "" }) : x));
      await load();
    } catch (err) {
      alert(String(err.message || err));
    } finally {
      setUploading(false);
    }
  }
  async function uploadAllGroups(e) {
    e?.preventDefault?.();
    for (const g of photoGroups) {
      if (g.files.length) {
        await uploadGroup(g.id);
      }
    }
  }

  // ===== Actions: Chemical Groups =====
  function addChemGroup() {
    setChemGroups(gs => [...gs, { id: genId(), chemKey:"", qty:"", zone:"", link:"", remark:"" }]);
  }
  function removeChemGroup(id) {
    setChemGroups(gs => (gs.length > 1 ? gs.filter(g => g.id !== id) : gs));
  }
  function setChemField(id, field, value) {
    setChemGroups(gs => gs.map(g => (g.id === id ? { ...g, [field]: value } : g)));
  }
  function onSelectChem(id, key) {
    setChemGroups(gs => gs.map(g => {
      if (g.id !== id) return g;
      const c = findChem(key);
      if (!c) return { ...g, chemKey: key, qty:"", link:"" };
      return {
        ...g,
        chemKey: key,
        qty: g.qty || c.defaultQty,
        link: g.link || c.link
      };
    }));
  }

  async function saveChemGroup(id, e) {
    e?.preventDefault?.();
    const g = chemGroups.find(x => x.id === id);
    if (!g) return;
    if (!g.chemKey) { alert("กรุณาเลือกสารเคมีในชุดนี้"); return; }

    const c = findChem(g.chemKey);
    if (!c) { alert("ไม่พบรายการสารเคมี"); return; }

    const payload = {
      name: c.name,
      qty: (g.qty || c.defaultQty || "").trim(),
      zone: (g.zone || "").trim(),
      link: (g.link || c.link || "").trim(),
      remark: (g.remark || "").trim(),
    };

    try {
      setSavingChem(true);
      const { phone, userId } = getAuth();
      const out = await postJSON(`${EXEC_BASE}`, {
        route: "append-items",
        service_id: serviceId,
        items: [payload],
        auth_phone: phone,
        auth_userId: userId,
      });
      if (!out.ok) throw new Error(out.error || "บันทึกสารเคมีไม่สำเร็จ");

      // reset เฉพาะค่าที่แก้เอง เหลือ chemKey ไว้ก็ได้หรือจะล้างหมดก็ได้
      setChemGroups(gs => gs.map(x => x.id === id
        ? ({ ...x, chemKey:"", qty:"", zone:"", link:"", remark:"" })
        : x
      ));
      await load();
    } catch (err) {
      alert(String(err.message || err));
    } finally {
      setSavingChem(false);
    }
  }

  async function saveAllChemGroups(e) {
    e?.preventDefault?.();
    for (const g of chemGroups) {
      if (g.chemKey) {
        await saveChemGroup(g.id);
      }
    }
  }

  // ===== Guards =====
  if (!baseOk) return <div style={{padding:16,color:"red"}}>ตั้งค่า REACT_APP_GAS_BASE ให้ชี้ Apps Script /exec หรือ API executable</div>;
  if (!serviceId) return <div style={{padding:16}}>ไม่มี serviceId ใน URL</div>;
  if (err) {
    const { phone, userId } = getAuth();
    const hint = (!phone || !userId) ? " (โปรดกลับไปหน้า Technician เพื่อกรอกเบอร์และ userId ให้ครบ แล้วลองใหม่)" : "";
    return <div style={{padding:16,color:"red"}}>ผิดพลาด: {String(err)}{hint}</div>;
  }
  if (loading || !data) return <div style={{padding:16,opacity:.7}}>กำลังโหลด…</div>;

  const H = data.header || {};
  const photos = data.photos || [];
  const items = data.items || [];

  return (
    <div className="report-ui" style={{maxWidth:960, margin:"0 auto", padding:16}}>
      <h2 style={{fontWeight:800, fontSize:22, marginBottom:6}}>Service Report</h2>
      <div style={{opacity:.7, fontSize:13, marginBottom:14}}>ID: {H.serviceId}</div>

      {/* ข้อมูลลูกค้า */}
      <section style={cardStyle}>
        <h3 style={secTitle}>ข้อมูลลูกค้า</h3>
        <Grid2>
          <Row k="ลูกค้า" v={H.customerName||"-"} />
          <Row k="โทร" v={H.phone||"-"} />
          <Row k="ที่อยู่" v={H.address||"-"} />
          <Row k="ทีม / ช่าง" v={[H.teamName,H.technicianName].filter(Boolean).join(" / ")||"-"} />
          <Row k="วันที่บริการ" v={H.serviceDate||"-"} />
          <Row k="แพ็กเกจ" v={H.method||"-"} />
        </Grid2>
      </section>

      {/* ภาพถ่ายประกอบ: หลายชุด */}
      <section style={cardStyle}>
        <h3 style={secTitle}>ภาพถ่ายประกอบ ({photos.length})</h3>

        {photos.length === 0 ? (
          <div style={{opacity:.6}}>— ยังไม่มีรูป —</div>
        ) : (
          groupBy(photos, p => p.zone).map(([zone, list]) => (
            <div key={zone} style={{marginBottom:16, border:"1px solid #eef", borderRadius:10, padding:12}}>
              <div style={{fontWeight:700, marginBottom:8}}>โซน: {zone} ({list.length})</div>
              <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:12}}>
                {list.map((p,i)=>(
                  <div key={i} style={{border:"1px solid #eee", borderRadius:10, padding:8}}>
                    <div style={{width:"100%", aspectRatio:"1/1", background:"#f5f5f5", borderRadius:8, overflow:"hidden"}}>
                      <img src={p.photo_url} alt={p.caption||""} style={{width:"100%", height:"100%", objectFit:"cover"}} />
                    </div>
                    {p.caption ? <div style={{fontSize:12, marginTop:6}}>{p.caption}</div> : null}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}

        {/* ฟอร์มหลายชุด */}
        <div style={{marginTop:14, display:"grid", gap:12}}>
          {photoGroups.map((g, idx) => (
            <form
              key={g.id}
              onSubmit={(e)=>uploadGroup(g.id, e)}
              style={{border:"1px solid #e5e7eb", borderRadius:12, padding:12}}
            >
              <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8}}>
                <div style={{fontWeight:700}}>ชุดที่ {idx+1}</div>
                <button
                  type="button"
                  className="btn"
                  onClick={()=>removePhotoGroup(g.id)}
                  disabled={photoGroups.length === 1 || uploading}
                >
                  ลบชุดนี้
                </button>
              </div>

              <div style={{display:"grid", gap:8}}>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="input"
                  onChange={(e)=>setGroupFiles(g.id, e.target.files)}
                  disabled={uploading}
                />
                <div style={{display:"grid", gridTemplateColumns:"1fr 2fr", gap:8}}>
                  <input
                    className="input"
                    placeholder="โซน"
                    value={g.zone}
                    onChange={e=>setGroupField(g.id, "zone", e.target.value)}
                    disabled={uploading}
                  />
                  <input
                    className="input"
                    placeholder="คำอธิบายรูป"
                    value={g.caption}
                    onChange={e=>setGroupField(g.id, "caption", e.target.value)}
                    disabled={uploading}
                  />
                </div>
                <button className="btn-primary" disabled={uploading}>
                  {uploading ? 'กำลังอัปโหลด…' : `+ อัปโหลดชุดนี้ (${g.files.length||0} ไฟล์)` }
                </button>
              </div>
            </form>
          ))}

          <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
            <button type="button" className="btn" onClick={addPhotoGroup} disabled={uploading}>
              + เพิ่มชุดอัปโหลด
            </button>
            <button type="button" className="btn" onClick={uploadAllGroups} disabled={uploading}>
              อัปโหลดทุกชุดที่มีไฟล์
            </button>
          </div>
        </div>
      </section>

      {/* สารเคมีที่ใช้: หลายชุด */}
      <section style={cardStyle}>
        <h3 style={secTitle}>สารเคมีที่ใช้ ({items.length})</h3>

        {(items.length === 0) ? (
          <div style={{opacity:.6}}>— ยังไม่มีรายการ —</div>
        ) : (
          groupBy(items, it => it.zone).map(([zone, list]) => (
            <div key={zone} style={{marginBottom:16, border:"1px solid #eef", borderRadius:10, padding:12}}>
              <div style={{fontWeight:700, marginBottom:8}}>โซน: {zone} ({list.length})</div>
              <table style={{width:"100%", borderCollapse:"collapse"}}>
                <thead>
                  <tr>{["ชื่อสารเคมี","ปริมาณ","ลิงก์ข้อมูล","หมายเหตุ"].map(h =>
                    <th key={h} style={thTdStyle}>{h}</th>
                  )}</tr>
                </thead>
                <tbody>
                  {list.map((it,i)=>(
                    <tr key={i}>
                      <td style={thTdStyle}>{it.chemical_name||"-"}</td>
                      <td style={thTdStyle}>{it.qty||"-"}</td>
                      <td style={thTdStyle}>
                        {it.link_info ? <a href={it.link_info} target="_blank" rel="noreferrer">{it.link_info}</a> : ""}
                      </td>
                      <td style={thTdStyle}>{it.remark||""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}

        {/* ฟอร์มหลายชุดสารเคมี */}
        <div style={{marginTop:12, display:"grid", gap:12}}>
          {chemGroups.map((g, idx) => (
            <form
              key={g.id}
              onSubmit={(e)=>saveChemGroup(g.id, e)}
              style={{border:"1px solid #e5e7eb", borderRadius:12, padding:12}}
            >
              <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8}}>
                <div style={{fontWeight:700}}>ชุดที่ {idx+1}</div>
                <button
                  type="button"
                  className="btn"
                  onClick={()=>removeChemGroup(g.id)}
                  disabled={chemGroups.length === 1 || savingChem}
                >
                  ลบชุดนี้
                </button>
              </div>

              <div style={{display:"grid", gap:8}}>
                <select
                  className="input"
                  value={g.chemKey}
                  onChange={(e)=>onSelectChem(g.id, e.target.value)}
                  disabled={savingChem}
                >
                  <option value="">— เลือกสารเคมี —</option>
                  {CHEM_LIBRARY.map(c => (
                    <option key={c.key} value={c.key}>{c.name}</option>
                  ))}
                </select>

                <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:8}}>
                  <input
                    className="input"
                    placeholder="ปริมาณ"
                    value={g.qty}
                    onChange={e=>setChemField(g.id, "qty", e.target.value)}
                    disabled={savingChem}
                  />
                  <input
                    className="input"
                    placeholder="โซน"
                    value={g.zone}
                    onChange={e=>setChemField(g.id, "zone", e.target.value)}
                    disabled={savingChem}
                  />
                </div>

                <input
                  className="input"
                  placeholder="ลิงก์ข้อมูล (ถ้ามี)"
                  value={g.link}
                  onChange={e=>setChemField(g.id, "link", e.target.value)}
                  disabled={savingChem}
                />
                <input
                  className="input"
                  placeholder="หมายเหตุ"
                  value={g.remark}
                  onChange={e=>setChemField(g.id, "remark", e.target.value)}
                  disabled={savingChem}
                />

                <button className="btn-primary" disabled={savingChem}>
                  {savingChem ? 'กำลังบันทึก…' : '+ บันทึกชุดนี้'}
                </button>
              </div>
            </form>
          ))}

          <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
            <button type="button" className="btn" onClick={addChemGroup} disabled={savingChem}>
              + เพิ่มชุดสารเคมี
            </button>
            <button type="button" className="btn" onClick={saveAllChemGroups} disabled={savingChem}>
              บันทึกทุกชุดที่เลือกสารเคมี
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

/* helpers UI */
function Row({k,v}){ return (
  <div style={{display:"grid",gridTemplateColumns:"120px 1fr",gap:10,padding:"6px 0"}}>
    <div style={{opacity:.65}}>{k}</div><div>{v}</div>
  </div>
);}
function Grid2({children}){ return <div style={{display:"grid",gap:6}}>{children}</div>; }
const cardStyle={background:"#fff",borderRadius:12,padding:16,boxShadow:"0 2px 10px rgba(0,0,0,.06)",marginBottom:16};
const secTitle={fontWeight:700,marginBottom:8};
const thTdStyle={borderTop:"1px solid #eee",padding:"8px 6px",fontSize:14};
