// src/TechnicianApp.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const RAW_BASE = (process.env.REACT_APP_GAS_BASE || '').replace(/\/+$/, '');
const BASE = /\/exec$/.test(RAW_BASE) ? RAW_BASE : `${RAW_BASE}/exec`;
const LS_KEY = 'tech-ui';
const TEAM_OPTIONS = ['', 'A', 'B', 'C', 'D', 'Service'];
const TEAM_TO_TECH = { A: 'พนา', B: 'นฤมล', C: 'วันดี', D: 'ไพฑูย์' };

function formatYMD(d = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function jobKey(job){ return `${job.date}|${job.rowIndex}|${job.time}|${job.customer}`; }
const onlyDigits = (s='') => s.replace(/\D+/g, '');

export default function TechnicianApp() {
  const navigate = useNavigate();

  const [date, setDate] = useState(formatYMD());

  // ====== ข้อมูลยืนยันตัวตนช่าง ======
  const [phone, setPhone]   = useState('');   // เบอร์ช่าง (ใช้ล็อกสิทธิ์)
  const [userId, setUserId] = useState('');   // รหัสพนักงาน (ใช้ล็อกสิทธิ์)

  // ====== UI (ไม่ใช้กำหนดสิทธิ์ฝั่งเซิร์ฟเวอร์) ======
  const [team, setTeam] = useState('');
  const [technician, setTechnician] = useState('');

  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState(null);
  const [error, setError] = useState('');
  const [creatingId, setCreatingId] = useState(null);

  const baseOk = /^https?:\/\/script\.google\.com\/macros\//.test(BASE || '');
  const isService = (team || '').trim().toLowerCase() === 'service';

  // โหลด/บันทึก localStorage
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
      if (saved.date) setDate(saved.date);
      if (saved.phone) setPhone(String(saved.phone));
      if (saved.userId) setUserId(saved.userId);
      if (saved.team) setTeam(saved.team);
      if (saved.technician) setTechnician(saved.technician);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ date, phone, userId, team, technician }));
    } catch {}
  }, [date, phone, userId, team, technician]);

  // ถ้าไม่ได้เลือก Service ไม่ต้องให้เลือกชื่อช่าง
  useEffect(() => { if (!isService && technician) setTechnician(''); }, [isService, technician]);

  async function ping() {
    setError('');
    try {
      const r = await fetch(`${BASE}?route=ping`);
      alert(JSON.stringify(await r.json(), null, 2));
    } catch (e) { setError('Ping failed: ' + e.message); }
  }

  async function loadJobs() {
    const p = onlyDigits(phone);
    if (!p || !userId.trim()) { alert('กรุณากรอก เบอร์ + รหัสพนักงาน ให้ครบ'); return; }
    setError(''); setLoading(true); setResp(null);
    try {
      const payload = {
        route: 'jobs.list',
        date,
        auth_phone: p,
        auth_userId: userId.trim(),
      };
      const r = await fetch(BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const out = await r.json();
      setResp(out);
      if (!out.ok) setError(out.error || 'โหลดงานไม่สำเร็จ');
    } catch (e) {
      setError(e.message || 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }

  // === สร้างรายงานใหม่ แล้วพาไปหน้าอ่านอย่างเดียว /report-view/:serviceId ===
  async function handleCreateReport(job) {
    if (!baseOk) { alert('BASE ไม่ถูกต้อง'); return; }
    const p = onlyDigits(phone);
    if (!p || !userId.trim()) { alert('กรุณากรอก เบอร์ + รหัสพนักงาน ให้ครบ'); return; }

    const key = jobKey(job);
    if (creatingId) return;
    setCreatingId(key);

    try {
      const teamName = (job.team || team || '').trim();
      const technicianName =
        (teamName.toLowerCase() === 'service')
          ? (technician || job.technician || '')
          : (TEAM_TO_TECH[(teamName || '').toUpperCase()] || '');

      const payload = {
        // ===== auth =====
        auth_phone:  p,
        auth_userId: userId.trim(),

        // ===== job fields =====
        contractId: job.contractId || '',
        serviceRound: job.serviceRound || '',
        teamName,
        technicianName,
        customerName: job.customer || '',
        phone: job.contact || '',       // เบอร์ลูกค้า (ไม่ใช่ auth)
        address: job.address || '',
        method: '',
        summary: '',

        dateHint: job.date || date,
        timeHint: job.time || '',
      };

      const res = await fetch(`${BASE}?route=report/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      let out;
      try { out = JSON.parse(text); } catch { throw new Error(`Invalid JSON: ${text.slice(0,150)}`); }
      if (!res.ok || !out?.ok) throw new Error(out?.error || `HTTP ${res.status}`);

      const sid = out.serviceId || out.service_id;
      if (!sid) throw new Error('Missing serviceId in response');

      // ➜ ไปหน้า "กรอก/แก้ไข รายงาน"
      navigate(`/report/${encodeURIComponent(sid)}`);
    } catch (err) {
      alert('Create report error: ' + (err.message || String(err)));
    } finally {
      setCreatingId(null);
    }
  }

  return (
    <div className="tech-ui">
      <div className="app">
        <header className="header">
          <h1>Technician UI</h1>
          <div className="base">BASE: <code>{BASE || '(not set)'}</code></div>
        </header>

        <section className="toolbar">
          <div className="field">
            <label className="label">รหัส/เบอร์ช่าง (ใช้ล็อกสิทธิ์)</label>
            <input
              className="input"
              type="tel"
              placeholder="กรอกเบอร์โทรที่ลงทะเบียนใน StaffLink"
              value={phone}
              onChange={e=>setPhone(onlyDigits(e.target.value))}
            />
          </div>

          <div className="field">
            <label className="label">รหัสพนักงาน (userId)</label>
            <input
              className="input"
              placeholder="เช่น SG001"
              value={userId}
              onChange={e=>setUserId(e.target.value)}
            />
          </div>

          <div className="field">
            <label className="label">Date</label>
            <input className="input" type="date" value={date} onChange={e=>setDate(e.target.value)} />
          </div>

          <div className="field">
            <label className="label">Team (optional)</label>
            <select
              className="input"
              value={team}
              onChange={e=>setTeam(e.target.value)}
              title="ระบบจะกรองสิทธิ์ตาม เบอร์+รหัสพนักงาน โดยอัตโนมัติ"
            >
              {TEAM_OPTIONS.map(opt => (
                <option key={opt || 'none'} value={opt}>
                  {opt ? opt : '— ไม่ระบุทีม —'}
                </option>
              ))}
            </select>
          </div>

          {isService && (
            <div className="field">
              <label className="label">ช่าง (ทีม Service)</label>
              <select className="input" value={technician} onChange={e=>setTechnician(e.target.value)}>
                <option value="">— เลือกช่าง —</option>
                <option value="โดม">โดม</option>
                <option value="นนท์">นนท์</option>
                <option value="กอล์ฟ">กอล์ฟ</option>
              </select>
            </div>
          )}

          <div className="actions">
            <button className="btn-primary" onClick={loadJobs} disabled={!baseOk || loading}>
              {loading ? 'กำลังโหลด…' : 'โหลดงาน'}
            </button>
            <button className="btn" onClick={ping}>Ping GAS</button>
          </div>
        </section>

        {!baseOk && <div className="error">⚠️ BASE ไม่ถูกต้อง (ตรวจค่า REACT_APP_GAS_BASE)</div>}
        {error && <div className="error">⚠️ {error}</div>}

        <main className="main">
          {resp && (
            <>
              <h3 className="group-title">General ({resp.general?.length||0})</h3>
              <JobList items={resp.general||[]} onCreate={handleCreateReport} creatingId={creatingId} />

              <h3 className="group-title">Service ({resp.service?.length||0})</h3>
              <JobList items={resp.service||[]} onCreate={handleCreateReport} creatingId={creatingId} />
            </>
          )}
          {!resp && !error && !loading && (
            <div style={{opacity:.7, fontSize:14}}>
              กรอก <b>เบอร์</b> + <b>userId</b> และวันที่ แล้วกด “โหลดงาน”
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function JobList({ items, onCreate, creatingId }) {
  if (!items?.length) return <div style={{opacity:.65}}>— ไม่มีรายการ —</div>;
  return (
    <div className="grid">
      {items.map((it) => {
        const key = jobKey(it);
        const busy = creatingId === key;
        return (
          <div key={key} className="card">
            <div className="row"><span className="k">เวลา</span><span>{it.time||'-'}</span></div>
            <div className="row"><span className="k">ลูกค้า</span><span>{it.customer||'-'}</span></div>
            <div className="row"><span className="k">ที่อยู่</span><span>{it.address||'-'}</span></div>
            <div className="row"><span className="k">ทีม</span><span>{it.team||'-'}</span></div>
            {it.technician && (
              <div className="row"><span className="k">ช่าง</span><span>{it.technician}</span></div>
            )}
            <div className="meta">row #{it.rowIndex}</div>
            <div style={{marginTop:10}}>
              <button className="btn-primary" disabled={busy} onClick={()=>onCreate(it)}>
                {busy ? 'กำลังสร้าง…' : 'สร้างรายงาน'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
