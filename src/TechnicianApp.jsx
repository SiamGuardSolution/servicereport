// src/TechnicianApp.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { openReportForCard } from "./api"; // ⬅️ ใช้ตัวเดียวพอ
import { callRoute } from './api';

/* -------------------- BASE / ENV -------------------- */
const LS_BASE_KEY = 'gas_base';
const RAW_BASE = (
  localStorage.getItem(LS_BASE_KEY) ||
  process.env.REACT_APP_GAS_BASE ||
  ''
).replace(/\/+$/, '');
const EXEC_BASE = RAW_BASE
  ? (/\/exec$/.test(RAW_BASE) ? RAW_BASE : `${RAW_BASE}/exec`)
  : '';

const baseOk = /^https?:\/\//.test(EXEC_BASE);

const LS_KEY = 'tech-ui';
const LS_CREATED_MAP = 'tech-created-map';
const TEAM_OPTIONS = ['', 'A', 'B', 'C', 'D', 'Service'];
const TEAM_TO_TECH = { A: 'พนา', B: 'นฤมล', C: 'วันดี', D: 'ไพฑูย์' };

console.log('ENV.REACT_APP_GAS_BASE =', process.env.REACT_APP_GAS_BASE);
console.log('EXEC_BASE =', EXEC_BASE);

/** เส้นทางหน้าแก้ไข/แสดงรายงาน (viewer ภายในแอป) */
const REPORT_EDITOR_PATH =
  (process.env.REACT_APP_REPORT_EDITOR_PATH || '/report').replace(/\/+$/, '');

/* -------------------- UTILS -------------------- */
function formatYMD(d = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function jobKey(job) { return `${job.date}|${job.rowIndex}|${job.time}|${job.customer}`; }
const onlyDigits = (s = '') => String(s || '').replace(/\D+/g, '');

// แปลง object เป็น query string
function toQuery(obj = {}) {
  const enc = encodeURIComponent;
  return Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${enc(k)}=${enc(String(v))}`)
    .join('&');
}

/**
 * เรียก GAS แบบอัตโนมัติ:
 * - ถ้าเป็น script.google.com -> ใช้ GET + query (หลบ 302 ทิ้ง body)
 * - ถ้าเป็น script.googleusercontent.com -> ใช้ POST ปกติ
 */
async function postJSONSmart(url, payload) {
  try {
    if (/\/\/script\.google\.com\//.test(url)) {
      const qs = toQuery(payload);
      const r = await fetch(qs ? `${url}?${qs}` : url, { method: 'GET' });
      const t = await r.text();
      try { return JSON.parse(t); } catch { return { ok: false, error: t }; }
    }
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });
    const text = await r.text();
    try { return JSON.parse(text); } catch { return { ok: false, error: text }; }
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}

/* -------------------- COMPONENT -------------------- */
export default function TechnicianApp() {
  const navigate = useNavigate();

  const [date, setDate] = useState(formatYMD());

  // ====== ข้อมูลยืนยันตัวตนช่าง ======
  const [phone, setPhone] = useState('');   // เบอร์ช่าง (ใช้ล็อกสิทธิ์)
  const [userId, setUserId] = useState(''); // รหัสพนักงาน (ใช้ล็อกสิทธิ์)

  // ====== UI (ไม่ใช้กำหนดสิทธิ์ฝั่งเซิร์ฟเวอร์) ======
  const [team, setTeam] = useState('');
  const [technician, setTechnician] = useState('');

  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState(null);
  const [error, setError] = useState('');
  const [creatingId, setCreatingId] = useState(null);

  // เก็บ mapping งานที่ "สร้างรายงานแล้ว" -> serviceId
  const [createdMap, setCreatedMap] = useState({});

  const isService = (team || '').trim().toLowerCase() === 'service';

  // โหลด/บันทึก localStorage (ตั้งค่า UI + auth)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
      if (saved.date) setDate(saved.date);
      if (saved.phone) setPhone(String(saved.phone));
      if (saved.userId) setUserId(saved.userId);
      if (saved.team) setTeam(saved.team);
      if (saved.technician) setTechnician(saved.technician);
    } catch {}
    try {
      const m = JSON.parse(localStorage.getItem(LS_CREATED_MAP) || '{}');
      setCreatedMap(m || {});
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ date, phone, userId, team, technician }));
    } catch {}
  }, [date, phone, userId, team, technician]);

  // helper: จำว่า card ไหนสร้างแล้ว
  const rememberCreated = (key, sid) => {
    setCreatedMap(prev => {
      const next = { ...prev, [key]: sid };
      try { localStorage.setItem(LS_CREATED_MAP, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  // ถ้าไม่ได้เลือก Service ไม่ต้องให้เลือกชื่อช่าง
  useEffect(() => { if (!isService && technician) setTechnician(''); }, [isService, technician]);

  async function ping() {
    if (!EXEC_BASE) { setError('ยังไม่ได้ตั้งค่า REACT_APP_GAS_BASE'); return; }
    setError('');
    const out = await postJSONSmart(EXEC_BASE, { route: 'ping' });
    if (!out.ok) setError('Ping failed: ' + (out.error || 'unknown error'));
    alert(JSON.stringify(out, null, 2));
  }

  // ✅ FIXED: ใช้ setResp แทน setJobs และใส่ loading/error
  async function loadJobs() {
    if (!EXEC_BASE) { setError('ยังไม่ได้ตั้งค่า REACT_APP_GAS_BASE'); return; }
    setError('');
    setLoading(true);
    try {
      const d = date instanceof Date ? date : new Date(date);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const ymd = `${y}-${m}-${day}`;

      const p = onlyDigits(phone || '').slice(-10); // 10 หลัก
      const uid = String(userId || '').trim();
      const tm  = String(team || '').trim();

      const q = new URLSearchParams({ route: 'jobs.list', date: ymd });
      if (p.length === 10) q.set('phone', p);
      if (uid) q.set('userId', uid);
      if (tm) q.set('team', tm);

      if (![...q.keys()].some(k => ['phone','userId','team'].includes(k))) {
        console.warn('ไม่มีตัวกรองใดๆ (phone/userId/team) — จะยิงเฉพาะตามวันที่');
      }

      const url = `${EXEC_BASE}?${q.toString()}`;
      console.log('GET', url);

      const res = await fetch(url, { method: 'GET' });
      const json = await res.json();

      if (!json?.ok && !Array.isArray(json?.items)) {
        console.error('jobs.list error:', json);
        setResp({ general: [], service: [] });
        setError(json?.error || 'โหลดงานไม่สำเร็จ');
        return;
      }

      // รองรับหลายรูปแบบตอบกลับ
      let general = [], service = [];
      if (Array.isArray(json?.items)) {
        general = json.items;
      } else if (json?.data && (json.data.general || json.data.service)) {
        general = json.data.general || [];
        service = json.data.service || [];
      } else {
        general = json.general || [];
        service = json.service || [];
      }

      setResp({ general, service });
    } catch (err) {
      console.error('loadJobs failed:', err);
      setResp({ general: [], service: [] });
      setError(String(err?.message || err));
    } finally {
      setLoading(false);
    }
  }

  // === สร้างรายงานใหม่ แล้วพาไปหน้าแก้ไข/แสดง ===
  async function handleCreateReport(job) {
    if (!EXEC_BASE) { alert('ยังไม่ได้ตั้งค่า REACT_APP_GAS_BASE'); return; }
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
        route: 'report/create',
        // ===== auth (ส่งสองชื่อสำหรับ compatibility) =====
        phone: p,
        userId: userId.trim(),
        auth_phone: p,
        auth_userId: userId.trim(),

        // ===== job fields =====
        contractId: job.contractId || '',
        serviceRound: job.serviceRound || '',
        teamName,
        technicianName,
        customerName: job.customer || '',
        phoneCustomer: job.contact || '',
        address: job.address || '',
        method: '',
        summary: '',

        dateHint: job.date || formatYMD(),
        timeHint: job.time || '',
      };

      const out = await callRoute('report/create', payload);
      if (!out?.ok) throw new Error(out?.error || 'create failed');

      const sid = out.serviceId || out.service_id;
      if (!sid) throw new Error('Missing serviceId in response');
      rememberCreated(key, sid);

      navigate(`${REPORT_EDITOR_PATH}/${encodeURIComponent(sid)}`);
    } catch (err) {
      alert('Create report error: ' + (err.message || String(err)));
    } finally {
      setCreatingId(null);
    }
  }

  return (
    <div className="tech-ui">
      <header className="header">
        <h1>Technician UI</h1>
      </header>
      <div className="app">
        <section className="toolbar">
          <div className="field">
            <label className="label">รหัส/เบอร์ช่าง (ใช้ล็อกสิทธิ์)</label>
            <input
              className="input"
              type="tel"
              placeholder="กรอกเบอร์โทรที่ลงทะเบียนใน StaffLink"
              value={phone}
              onChange={e => setPhone(onlyDigits(e.target.value))}
            />
          </div>

          <div className="field">
            <label className="label">รหัสพนักงาน (userId)</label>
            <input
              className="input"
              placeholder="เช่น SG001"
              value={userId}
              onChange={e => setUserId(e.target.value)}
            />
          </div>

          <div className="field">
            <label className="label">Date</label>
            <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>

          <div className="field">
            <label className="label">Team (optional)</label>
            <select
              className="input"
              value={team}
              onChange={e => setTeam(e.target.value)}
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
              <select className="input" value={technician} onChange={e => setTechnician(e.target.value)}>
                <option value="">— เลือกช่าง —</option>
                <option value="โดม">โดม</option>
                <option value="นนท์">นนท์</option>
                <option value="กอล์ฟ">กอล์ฟ</option>
              </select>
            </div>
          )}

          <div className="actions">
            <button className="btn-primary" onClick={loadJobs} disabled={!EXEC_BASE || loading}>
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
              <h3 className="group-title">General ({resp.general?.length || 0})</h3>
              <JobList
                items={resp.general || []}
                onCreate={handleCreateReport}
                creatingId={creatingId}
                createdMap={createdMap}
                phone={phone}
                userId={userId}
                navigate={navigate}
              />

              <h3 className="group-title">Service ({resp.service?.length || 0})</h3>
              <JobList
                items={resp.service || []}
                onCreate={handleCreateReport}
                creatingId={creatingId}
                createdMap={createdMap}
                phone={phone}
                userId={userId}
                navigate={navigate}
              />
            </>
          )}
          {!resp && !error && !loading && (
            <div style={{ opacity: .7, fontSize: 14 }}>
              กรอก <b>เบอร์</b> + <b>userId</b> และวันที่ แล้วกด “โหลดงาน”
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function JobList({ items, onCreate, creatingId, createdMap, phone, userId, navigate }) {
  return (
    <div className="grid">
      {items.map((it) => {
        const key = jobKey({
          date: it.date || it.serviceDate,
          rowIndex: it.rowIndex,
          time: it.time,
          customer: it.customer || it.customerName
        });

        // ---- หา serviceId ----
        const sid =
          it.serviceId ||
          it.service_id ||
          it.reportHeader?.serviceId ||
          it.reportHeader?.service_id ||
          createdMap?.[key];

        // เปิดได้เมื่อ:
        // - มี sid อยู่แล้ว  หรือ
        // - มี auth (phone+userId) + มี date ของงาน → ให้ไป resolve เอา
        const canOpen = Boolean(sid) || Boolean(onlyDigits(phone) && String(userId || '').trim() && (it.date || it.serviceDate));

        // ---- fields สำหรับแสดงผล ----
        const time = it.time || it.reportHeader?.timeHint || '-';
        const customer = it.customer || it.customerName || '-';
        const address = it.address || '-';
        const team = it.team || it.teamName || '-';
        const rowInfo = it.rowIndex ? `row #${it.rowIndex}` : '';

        const serviceMethod =
          (it.reportHeader && it.reportHeader.method) ||
          it.method ||
          it.packageName ||
          '';

        const noteOld =
          it.note ||
          it.remark ||
          (it.reportHeader && it.reportHeader.summary) ||
          '';

        const noteF =
          it.note ??
          it.noteF ??
          it['รูปแบบบริการ(หมายเหตุ)'] ??
          '';

        const note = noteF || noteOld;

        return (
          <div key={key} className="card">
            <div className="card-body" style={{ fontSize: 14, lineHeight: 1.4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', opacity: .8 }}>
                <div>เวลา</div><div>{time}</div>
              </div>

              <div style={{ marginTop: 6, opacity: .8 }}>ลูกค้า</div>
              <div style={{ fontWeight: 600 }}>{customer}</div>

              <div style={{ marginTop: 6, opacity: .8 }}>ที่อยู่</div>
              <div>{address}</div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, opacity: .8 }}>
                <div>ทีม</div><div>{team}</div>
              </div>

              <div style={{ marginTop: 6, opacity: .8 }}>รูปแบบบริการ</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{serviceMethod || '-'}</div>

              <div style={{ marginTop: 6, opacity: .8 }}>หมายเหตุ</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{note || '-'}</div>

              {rowInfo && <div style={{ opacity: .6, marginTop: 6 }}>{rowInfo}</div>}
            </div>

            <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                className="btn-primary"
                disabled={creatingId === key}
                onClick={() => onCreate(it)}
              >
                {creatingId === key ? 'กำลังสร้าง…' : 'สร้างรายงาน'}
              </button>

              <button
                disabled={!canOpen}
                onClick={async () => {
                  const ok = await openReportForCard(
                    { ...it, serviceId: sid },         // ข้อมูลงาน + sid (ถ้ามี)
                    navigate,                           // ใช้ไปหน้า /service-report/:id
                    { phone, userId }                   // auth สำหรับ resolve
                  );
                  if (!ok) {
                    alert("ยังไม่พบรายงานของงานนี้ (ถ้าเพิ่งทำเสร็จ ให้กด ‘สร้างรายงาน’ ก่อน หรือปรับวันที่แล้วลองอีกครั้ง)");
                  }
                }}
              >
                เปิดรายงาน
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
