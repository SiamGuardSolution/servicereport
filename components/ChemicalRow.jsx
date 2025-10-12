// components/ChemicalRow.jsx
import { useEffect, useMemo, useState } from 'react';
import { CHEMICALS } from '@/lib/chemicals';

const FORCE_UNIT = 'L';
const MAX_DECIMALS = 3;

function clampDecimals(n) {
  if (!isFinite(n)) return '';
  const s = Number(n).toFixed(MAX_DECIMALS);
  return s.replace(/\.?0+$/, '');
}

function toLiters(qty, unit) {
  const n = parseFloat(String(qty ?? '0').replace(',', '.'));
  if (!isFinite(n)) return '';
  const u = String(unit || '').toLowerCase();
  if (u === 'ml' || u === 'มล') return clampDecimals(n / 1000);
  // l หรือหน่วยอื่น ๆ => คงไว้ (เราบังคับ unit เป็น L อยู่แล้ว)
  return clampDecimals(n);
}

function parseQtyToLiters(input) {
  const txt = String(input ?? '').trim();
  if (!txt) return '';
  const m = txt.match(/^(\d+(?:[.,]\d+)?)\s*([A-Za-zก-๙%/²³]*)$/);
  if (!m) return clampDecimals(parseFloat(txt.replace(',', '.')));
  const raw = m[1].replace(',', '.');
  const unit = (m[2] || '').toLowerCase();
  if (unit === 'ml' || unit === 'มล') return toLiters(raw, 'ml');
  if (unit === 'l' || unit === 'ลิตร') return toLiters(raw, 'l');
  return clampDecimals(parseFloat(raw));
}

function sanitizeUrl(u) {
  const s = String(u || '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
}

export default function ChemicalRow({ value, onChange, onRemove }) {
  // value shape: { chemicalId:'', name:'', qty: (string|number), unit:'', datasheetUrl:'' }
  const [touchedQty, setTouchedQty] = useState(false);

  const options = useMemo(
    () => CHEMICALS.map(c => ({ value: c.id, label: c.name })),
    []
  );

  const selected = useMemo(
    () => CHEMICALS.find(c => c.id === value?.chemicalId) || null,
    [value?.chemicalId]
  );

  // เมื่อเลือกสาร → autofill name/unit(L)/datasheet + qty (ถ้ายังไม่แก้มือ) โดยแปลง defaultQty → L
  useEffect(() => {
    if (!selected) return;
    onChange({
      ...value,
      chemicalId: selected.id,
      name: selected.name,
      unit: FORCE_UNIT,
      datasheetUrl: selected.datasheetUrl || '',
      qty: touchedQty
        ? (value?.qty ?? '')
        : (value?.qty || (selected.defaultQty != null
            ? toLiters(selected.defaultQty, selected.unit)
            : '')),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  const qtyPlaceholder = useMemo(() => {
    if (!selected) return '';
    if (selected.defaultQty != null) {
      const qL = toLiters(selected.defaultQty, selected.unit);
      return qL ? `แนะนำ ${qL} ${FORCE_UNIT}` : '';
    }
    return '';
  }, [selected]);

  return (
    <div className="grid grid-cols-12 gap-2 items-end">
      {/* เลือกสารเคมี */}
      <div className="col-span-5">
        <label className="block text-sm mb-1">สารเคมี</label>
        <select
          className="w-full border rounded px-2 py-1"
          value={value?.chemicalId || ''}
          onChange={e => {
            setTouchedQty(false);
            onChange({ ...value, chemicalId: e.target.value });
          }}
        >
          <option value="">-- เลือกสารเคมี --</option>
          {options.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* ปริมาณ (บังคับ L) */}
      <div className="col-span-3">
        <label className="block text-sm mb-1">ปริมาณ (ลิตร)</label>
        <input
          type="text"
          inputMode="decimal"
          pattern="[0-9., ]*"
          className="w-full border rounded px-2 py-1"
          value={value?.qty ?? ''}
          onChange={e => {
            setTouchedQty(true);
            const qtyL = parseQtyToLiters(e.target.value);
            onChange({ ...value, qty: qtyL, unit: FORCE_UNIT });
          }}
          placeholder={qtyPlaceholder}
        />
      </div>

      {/* หน่วย (readOnly = L) */}
      <div className="col-span-2">
        <label className="block text-sm mb-1">หน่วย</label>
        <input
          className="w-full border rounded px-2 py-1 bg-gray-50"
          value={FORCE_UNIT}
          readOnly
          aria-readonly="true"
        />
      </div>

      {/* เอกสาร & ลบ */}
      <div className="col-span-2 flex gap-2 items-end">
        { (value?.datasheetUrl || selected?.datasheetUrl) ? (
          <a
            href={sanitizeUrl(value?.datasheetUrl || selected?.datasheetUrl)}
            target="_blank"
            rel="noreferrer"
            className="text-blue-600 underline text-sm"
            title="เอกสาร/ข้อมูลสารเคมี"
          >
            เอกสาร
          </a>
        ) : (
          <span className="text-xs text-gray-500 mb-1">ไม่มีลิงก์</span>
        )}
        <button
          type="button"
          onClick={onRemove}
          className="text-red-600 text-sm ml-auto underline"
          title="ลบรายการ"
        >
          ลบ
        </button>
      </div>
    </div>
  );
}
