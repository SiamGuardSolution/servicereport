// components/ChemicalRow.jsx
import { useEffect, useMemo, useState } from 'react';
import { CHEMICALS } from '@/lib/chemicals';

export default function ChemicalRow({ value, onChange, onRemove }) {
  // value shape: { chemicalId:'', name:'', qty:0, unit:'', datasheetUrl:'' }
  const [touchedQty, setTouchedQty] = useState(false); // กันทับค่าเมื่อผู้ใช้แก้เองแล้ว

  const options = useMemo(
    () => CHEMICALS.map(c => ({ value: c.id, label: c.name })),
    []
  );

  const selected = useMemo(
    () => CHEMICALS.find(c => c.id === value.chemicalId) || null,
    [value.chemicalId]
  );

  // เปลี่ยนสาร → autofill ปริมาณ/หน่วย/ลิงก์ (ถ้ายังไม่แก้ qty เอง)
  useEffect(() => {
    if (!selected) return;
    onChange({
      ...value,
      name: selected.name,
      unit: selected.unit,
      datasheetUrl: selected.datasheetUrl,
      qty: touchedQty ? value.qty : (value.qty || selected.defaultQty),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  return (
    <div className="grid grid-cols-12 gap-2 items-end">
      {/* เลือกสารเคมี */}
      <div className="col-span-5">
        <label className="block text-sm mb-1">สารเคมี</label>
        <select
          className="w-full border rounded px-2 py-1"
          value={value.chemicalId || ''}
          onChange={e => onChange({ ...value, chemicalId: e.target.value })}
        >
          <option value="">-- เลือกสารเคมี --</option>
          {options.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* ปริมาณ */}
      <div className="col-span-3">
        <label className="block text-sm mb-1">ปริมาณ</label>
        <input
          type="number"
          className="w-full border rounded px-2 py-1"
          value={value.qty ?? ''}
          onChange={e => {
            setTouchedQty(true);
            onChange({ ...value, qty: Number(e.target.value || 0) });
          }}
          placeholder={selected?.defaultQty ?? ''}
        />
      </div>

      {/* หน่วย */}
      <div className="col-span-2">
        <label className="block text-sm mb-1">หน่วย</label>
        <input
          className="w-full border rounded px-2 py-1 bg-gray-50"
          value={value.unit || selected?.unit || ''}
          onChange={e => onChange({ ...value, unit: e.target.value })}
        />
      </div>

      {/* เอกสาร */}
      <div className="col-span-2 flex gap-2">
        {value.datasheetUrl ? (
          <a
            href={value.datasheetUrl}
            target="_blank"
            rel="noreferrer"
            className="text-blue-600 underline text-sm mb-1"
            title="เอกสาร/ข้อมูลสารเคมี"
          >
            เอกสาร
          </a>
        ) : (
          <span className="text-xs text-gray-500 self-end mb-1">ไม่มีลิงก์</span>
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
