// pages/tech/visit/[visitId].jsx
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import AppShell from '@/components/AppShell';
import { uploadImages, createServiceReport, appendChemicals } from '@/lib/api';
import ChemicalEditor from '@/components/ChemicalEditor';
import Link from 'next/link';

const PhotoPicker  = dynamic(() => import('@/components/PhotoPicker'),  { ssr: false });
const SignaturePad = dynamic(() => import('@/components/SignaturePad'), { ssr: false });

const summarizeChems = (chems=[]) =>
  chems.map(c => [c.name, c.qty ? `(${c.qty})` : ''].filter(Boolean).join(' ')).join(' • ');

const CHEM_OPTIONS = [
  { name: 'Fipronil 0.05%',     link: 'https://example.com/fipronil',   defaultQty: '10 ml' },
  { name: 'Bendiocarb 80%',     link: 'https://example.com/bendiocarb', defaultQty: '1 sachet' },
  { name: 'Imidacloprid 5 SC',  link: 'https://example.com/imidacloprid', defaultQty: '20 ml' },
  { name: 'Gel Bait (Cockroach)', defaultQty: '1-2 g/จุด' },
];

const FRONT_AREA = 'หน้าบ้าน (ติดเลขที่บ้าน)';

/* ---------- ✨ helpers เพื่อแสดง ID ยาวให้สวย + คัดลอกได้ ---------- */

function formatId(value, head = 10, tail = 6) {
  if (!value) return '-';
  const s = String(value);
  return s.length > head + tail + 1 ? `${s.slice(0, head)}…${s.slice(-tail)}` : s;
}

function CopyableField({ label, value, className = '' }) {
  const copy = async () => {
    try { await navigator.clipboard.writeText(String(value ?? '')); } catch {}
  };
  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      {label && <span className="text-sm text-neutral-300">{label}</span>}
      <span
        className="font-mono text-xs px-2 py-1 rounded-md bg-neutral-800 max-w-[70vw] sm:max-w-[48ch] overflow-hidden text-ellipsis whitespace-nowrap"
        title={String(value ?? '')}
      >
        {formatId(value)}
      </span>
      <button
        type="button"
        onClick={copy}
        className="text-xs px-2 py-1 rounded-md bg-neutral-700 hover:bg-neutral-600"
      >
        คัดลอก
      </button>
    </div>
  );
}

/* ---------------- GAS base & mapping helpers ---------------- */

function getGasBase(){
  const cands = [
    process.env.NEXT_PUBLIC_GAS_EXEC_PRIMARY,
    process.env.NEXT_PUBLIC_GAS_EXEC_BACKUP,
    process.env.GAS_EXEC,
  ].filter(Boolean);
  if (!cands.length) return '';
  return String(cands[0]).replace(/\/+$/,'');
}

async function setServiceIndex({ visitId, serviceId, date='', customer='', fileId='', sheet='', row='' }){
  const base = getGasBase();
  if (!base || !visitId || !serviceId) return;
  const qs = new URLSearchParams({
    route: 'setServiceIndex',
    visitId: String(visitId),
    serviceId: String(serviceId),
    date, customer, fileId, sheet, row
  });
  try {
    await fetch(`${base}/exec?${qs.toString()}`, { method:'GET', redirect:'follow' });
  } catch (err) {
    console.warn('setServiceIndex failed:', err);
  }
}

/** ====== การ์ดบังคับใบเดียว ====== */
function RequiredMainCard({ hasPipe, value, onChange, chemOptions }) {
  const set = (patch) => onChange({ ...value, ...patch });
  const slots = [
    { key: 'front_house', label: 'ภาพหน้าบ้าน (ติดเลขที่บ้าน)', enabled: true },
    { key: 'pipe_injection', label: 'ภาพขณะอัดน้ำยาลงท่อ', enabled: !!hasPipe },
    { key: 'drill_injection', label: 'ภาพขณะเจาะพื้นอัดน้ำยา', enabled: !hasPipe },
    { key: 'indoor_spray', label: 'ภาพการฉีดพ่นภายใน', enabled: true },
  ];
  const photos = value.photos || {};
  const updateSlot = (k, v) => set({ photos: { ...photos, [k]: v } });

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-semibold">ภาพที่ต้องถ่าย</div>
        <span className="text-xs px-2 py-0.5 rounded bg-amber-600/20 text-amber-300">บังคับ</span>
      </div>

      {slots.filter(s=>s.enabled).map(s => (
        <div key={s.key} className="rounded-xl border border-neutral-700 p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-medium">{s.label}</span>
            <span className="text-xs px-2 py-0.5 rounded bg-amber-600/20 text-amber-300">บังคับ</span>
          </div>
          {s.key === 'front_house' && (
            <div className="text-xs text-neutral-400 mb-2">
              กรุณาถ่ายให้เห็น <b>เลขที่บ้าน</b> ชัดเจนอย่างน้อย 1 รูป
            </div>
          )}
          <PhotoPicker
            value={photos[s.key] || []}
            onChange={(v)=>updateSlot(s.key, v)}
            captionEnabled
            defaultCaption={s.label}
          />
        </div>
      ))}

      <ChemicalEditor
        value={value.chems || []}
        onChange={(v)=>set({ chems: v })}
        options={chemOptions}
      />
    </div>
  );
}

/** การ์ดรายการงานทั่วไป */
function JobItem({ item, index, onChange, onRemove, chemOptions }) {
  const chemSummary = useMemo(() => summarizeChems(item.chems), [item.chems]);
  const set = (patch) => onChange({ ...item, ...patch });
  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-semibold">รายการที่ {index + 1}</div>
        <button type="button" onClick={onRemove} className="px-3 py-1 rounded-lg bg-red-600">ลบรายการ</button>
      </div>

      <div>
        <label className="block text-sm mb-1">บริเวณที่ทำ</label>
        <input
          className="input"
          value={item.area}
          onChange={e=>set({ area: e.target.value })}
          placeholder="เช่น ครัว, โรงจอดรถ"
        />
      </div>

      <PhotoPicker
        value={item.photos}
        onChange={(v)=>set({ photos: v })}
        captionEnabled
        defaultCaption={[item.area, chemSummary].filter(Boolean).join(' • ')}
      />

      <ChemicalEditor
        value={item.chems}
        onChange={(v)=>set({ chems: v })}
        options={chemOptions}
      />
    </div>
  );
}

export default function Visit(){
  const { query:{ visitId } } = useRouter();

  const [isClient, setIsClient] = useState(false);
  useEffect(()=>{ setIsClient(true); }, []);

  const [hasPipe, setHasPipe] = useState(true);

  const [requiredMain, setRequiredMain] = useState({
    photos: { front_house: [], pipe_injection: [], drill_injection: [], indoor_spray: [] },
    chems: [],
  });

  const [items, setItems] = useState([]);
  const addItem    = () => setItems(prev => [...prev, { area:'', photos:[], chems:[] }]);
  const updateItem = (i, v) => setItems(prev => prev.map((it,idx)=> idx===i ? v : it));
  const removeItem = (i) => setItems(prev => prev.filter((_,idx)=> idx!==i));

  const [sign, setSign]   = useState(null);
  const [busy, setBusy]   = useState(false);
  const [err, setErr]     = useState('');
  const [done, setDone]   = useState(false);
  const [result, setResult]= useState(null);

  const copy = async (txt) => { try { await navigator.clipboard.writeText(String(txt||'')); alert('คัดลอกแล้ว'); } catch {} };

  const dataUrlToFile = async (dataUrl, name='signature.png') => {
    const res  = await fetch(dataUrl);
    const blob = await res.blob();
    return new File([blob], name, { type: blob.type || 'image/png' });
  };

  const validateRequired = () => {
    const missing = [];
    const ph = requiredMain.photos || {};
    const need = [
      { key: 'front_house', label: 'ภาพหน้าบ้าน (ติดเลขที่บ้าน)', enabled: true },
      { key: 'pipe_injection', label: 'ภาพขณะอัดน้ำยาลงท่อ', enabled: !!hasPipe },
      { key: 'drill_injection', label: 'ภาพขณะเจาะพื้นอัดน้ำยา', enabled: !hasPipe },
      { key: 'indoor_spray', label: 'ภาพการฉีดพ่นภายใน', enabled: true },
    ];
    need.forEach(s=>{
      if (!s.enabled) return;
      if ((ph[s.key] || []).length === 0) missing.push(s.label);
    });
    return missing;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setErr('');
    setBusy(true);
    try {
      const miss = validateRequired();
      if (miss.length) throw new Error(`กรุณาแนบรูปบังคับให้ครบ:\n- ${miss.join('\n- ')}`);

      const uploadedAll = [];

      // รูปจากการ์ดบังคับ
      const slots = [
        { key: 'front_house', label: 'ภาพหน้าบ้าน (ติดเลขที่บ้าน)', enabled: true },
        { key: 'pipe_injection', label: 'ภาพขณะอัดน้ำยาลงท่อ', enabled: !!hasPipe },
        { key: 'drill_injection', label: 'ภาพขณะเจาะพื้นอัดน้ำยา', enabled: !hasPipe },
        { key: 'indoor_spray', label: 'ภาพการฉีดพ่นภายใน', enabled: true },
      ];
      for (const s of slots) {
        if (!s.enabled) continue;
        const list = (requiredMain.photos?.[s.key] || []);
        if (!list.length) continue;
        const filesWithZone = list.map((p,i)=>({
          zone: s.label,
          file: p.file,
          caption: p.caption || `${s.label} ${i+1}`
        }));
        const up = await uploadImages(filesWithZone);
        uploadedAll.push(...up);
      }

      // รูปจากรายการงานอื่น ๆ
      for (const it of items) {
        const autoCap = [it.area, summarizeChems(it.chems)].filter(Boolean).join(' • ');
        const filesWithZone = (it.photos || []).map((p, i) => ({
          zone: it.area || 'ทั่วไป',
          file: p.file,
          caption: (p.caption || autoCap || `photo ${i+1}`).trim()
        }));
        if (filesWithZone.length) {
          const up = await uploadImages(filesWithZone);
          uploadedAll.push(...up);
        }
      }

      // เซ็น
      if (sign) {
        const sig = await dataUrlToFile(sign, `signature-${visitId||'unknown'}.png`);
        const up = await uploadImages([{ zone:'signature', file: sig, caption:'signature' }]);
        uploadedAll.push(...up);
      }

      // บันทึกโน้ต
      const frontLine = `1) ${FRONT_AREA}${requiredMain.chems?.length ? ' | เคมี: ' + summarizeChems(requiredMain.chems) : ''}`;
      const otherLines = items.map((it, i) => {
        const sum = summarizeChems(it.chems);
        return `${i+2}) ${it.area || '-'}${sum ? ' | เคมี: ' + sum : ''}`;
      });
      const notes = [frontLine, ...otherLines].join(' ; ');

      const payload = {
        contractNo: visitId || '',
        customerName: '',
        phone: '',
        address: '',
        serviceType: hasPipe ? 'Spray+Pipe' : 'Spray',
        roundNo: 1,
        staff: '',
        notes,
        images: uploadedAll
      };

      // === สร้าง Service Report ===
      const res = await createServiceReport(payload);
      if (!res || res.ok === false) {
        throw new Error(res?.error || 'บันทึกรายงานไม่สำเร็จ');
      }

      // รองรับหลายทรงผลลัพธ์จาก GAS
      const serviceId =
        res?.result?.service_id ??
        res?.result?.id ??
        res?.service_id ??
        res?.id ??
        null;

      const reportUrl =
        res?.result?.report_url ??
        res?.report_url ??
        null;

      // ถ้ายังหาไม่ได้ ให้แจ้งรายละเอียดคร่าว ๆ ไว้ debug
      if (!serviceId) {
        console.warn('createServiceReport raw response =', res);
        throw new Error('createServiceReport: ไม่มี service_id ในผลลัพธ์');
      }

      // เก็บผลแบบ normalized
      setResult({ service_id: serviceId, report_url: reportUrl });

      // === mapping visitId -> serviceId ไปที่ GAS ===
      await setServiceIndex({
        visitId: String(visitId || ''),
        serviceId: String(serviceId),
        date: new Date().toISOString().slice(0,10),
        customer: payload.customerName || ''
      });

      // === บันทึกเคมี ===
      const chemList = [
        ...(requiredMain.chems || []).map(c => ({
          zone: FRONT_AREA, name: c.name, qty: c.qty || '', remark: c.remark || '', link: c.link || ''
        })),
        ...items.flatMap(it =>
          (it.chems || []).map(c => ({
            zone: it.area || '', name: c.name, qty: c.qty || '', remark: c.remark || '', link: c.link || ''
          }))
        )
      ];
      if (chemList.length) {
        const chemRes = await appendChemicals(res.result.service_id, chemList);
        if (!chemRes || chemRes.ok === false) {
          throw new Error(chemRes?.error || 'บันทึกเคมีไม่สำเร็จ');
        }
      }

      setDone(true);
      alert('บันทึกรายงานเรียบร้อย ✅');
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell title="บันทึกงาน">
      {/* แถบหัวเรื่อง: แสดง visitId แบบย่อ + คัดลอกได้ */}
      <CopyableField label="เลขงาน:" value={visitId} className="mb-2" />

      <form onSubmit={submit} className="space-y-4">
        {/* toggle มี/ไม่มีท่อ */}
        <div className="rounded-2xl bg-neutral-800 p-3 flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={hasPipe} onChange={e => setHasPipe(e.target.checked)} />
            มีท่ออัดน้ำยา (reticulation)
          </label>
          <div className="text-xs text-neutral-400">
            ใช้กำหนดว่าต้องแนบ “อัดน้ำยาลงท่อ” หรือ “เจาะพื้นอัดน้ำยา”
          </div>
        </div>

        <RequiredMainCard
          hasPipe={hasPipe}
          value={requiredMain}
          onChange={setRequiredMain}
          chemOptions={CHEM_OPTIONS}
        />

        <div className="space-y-4">
          {items.map((it, idx) => (
            <JobItem
              key={idx}
              item={it}
              index={idx}
              onChange={(v)=>updateItem(idx, v)}
              onRemove={()=>removeItem(idx)}
              chemOptions={CHEM_OPTIONS}
            />
          ))}
          <div>
            <button type="button" onClick={()=>addItem()} className="px-4 py-2 rounded-xl bg-neutral-700">
              + เพิ่มรายการ
            </button>
          </div>
        </div>

        <SignaturePad value={sign} onChange={setSign} />

        {err && <div className="text-red-400 text-sm whitespace-pre-line">Failed: {err}</div>}
        {done && <div className="text-emerald-400 text-sm">บันทึกแล้ว</div>}

        <div className="flex gap-2">
          <a href="/tech/jobs" className="bg-neutral-800 px-4 py-2 rounded-xl inline-flex items-center">ย้อนกลับ</a>
          <button
            type="submit"
            className="bg-emerald-600 px-4 py-2 rounded-xl inline-flex items-center disabled:opacity-50"
            disabled={busy}
          >
            {busy ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
        </div>

        {done && result && (
          <div className="mt-3 rounded-2xl bg-neutral-800 p-4 text-sm text-white space-y-2">
            <div className="font-semibold">สรุปการบันทึก</div>

            {/* Service ID แสดงแบบย่อ + คัดลอกได้ */}
            <CopyableField label="Service ID:" value={result.service_id} />

            <div className="flex items-center gap-2">
              <span className="text-neutral-300">รายงาน:</span>
              <Link
                href={`/report/${encodeURIComponent(result.service_id)}`}
                className="underline text-emerald-400 break-all"
              >
                เปิดดูรายงาน
              </Link>
            </div>

            {result.report_url && (
              <div className="flex items-center gap-2 text-neutral-300">
                <span>ไฟล์ PDF:</span>
                <a
                  href={result.report_url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline break-all"
                  title={result.report_url}
                >
                  {formatId(result.report_url, 24, 12)}
                </a>
              </div>
            )}
          </div>
        )}
      </form>
    </AppShell>
  );
}
