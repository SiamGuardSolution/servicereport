// components/ChemicalEditor.jsx
import { useMemo, useState, useId, useRef } from "react";

const FORCE_UNIT = "L"; // ใช้ลิตรเสมอ

export default function ChemicalEditor({
  value = [],
  onChange,
  options = [],            // [{ name, link?, defaultQty?, unit? }]
  allowCustom = true,
}) {
  const [row, setRow] = useState({
    name: "", qty: "", remark: "", link: "", unit: FORCE_UNIT
  });
  // เราไม่ต้อง track touched.unit แล้ว เพราะบังคับ L เสมอ
  const [touched, setTouched] = useState({ qty: false, link: false });

  const listId = useId();
  const nameInputRef = useRef(null);

  const byName = useMemo(() => {
    const m = new Map();
    options.forEach(o => m.set(String(o.name).toLowerCase().trim(), o));
    return m;
  }, [options]);

  const getOption = (name) => {
    const key = String(name || "").toLowerCase().trim();
    return byName.get(key);
  };

  // --- helpers ---
  const normalizeNumberInput = (v) => String(v || "").trim().replace(",", ".");

  // แปลงเป็นลิตร: รองรับ ml/L; อื่น ๆ จะคืนค่าตามเดิม (แต่ยัง set unit = L)
  const toLiters = (qtyStr, unit) => {
    const n = parseFloat(String(qtyStr || "0").replace(",", "."));
    if (!isFinite(n)) return "";
    const u = String(unit || "").toLowerCase();
    if (u === "ml") return (n / 1000).toString();
    // l หรืออื่น ๆ ให้คงจำนวนเดิมไว้
    return n.toString();
  };

  // parse "10 ml" หรือ "0.5L" -> แปลงเป็นลิตร + บังคับ unit L
  const parseQtyToLiters = (s) => {
    const m = String(s || "").trim().match(/^(\d+(?:[.,]\d+)?)\s*([A-Za-zก-๙%/²³]+)?$/);
    if (!m) return { qty: normalizeNumberInput(s) };
    const rawQty = m[1].replace(",", ".");
    const unit = (m[2] || "").toLowerCase();
    if (unit === "ml" || unit === "มล") return { qty: toLiters(rawQty, "ml") };
    if (unit === "l" || unit === "ลิตร") return { qty: toLiters(rawQty, "l") };
    // หน่วยอื่น ๆ: ไม่แปลงตัวเลข แต่ยังคงใช้ L เป็น unit ที่บันทึก
    return { qty: normalizeNumberInput(rawQty) };
  };

  // เมื่อเลือกชื่อ -> เติม defaultQty/link แล้วแปลง defaultQty เป็นลิตร
  const onNameChange = (name) => {
    const opt = getOption(name);
    const suggestedQty =
      touched.qty
        ? row.qty
        : (row.qty || (opt?.defaultQty != null ? toLiters(opt.defaultQty, opt.unit) : ""));
    setRow(prev => ({
      ...prev,
      name,
      qty: suggestedQty,
      link: touched.link ? prev.link : (prev.link || (opt?.link ?? "")),
      unit: FORCE_UNIT,
    }));
  };

  const onQtyChange = (v) => {
    setTouched(t => ({ ...t, qty: true }));
    const p = parseQtyToLiters(v);
    setRow(r => ({ ...r, qty: p.qty, unit: FORCE_UNIT }));
  };

  const onLinkChange = (v) => {
    setTouched(t => ({ ...t, link: true }));
    setRow(r => ({ ...r, link: v }));
  };

  const add = () => {
    const nm = (row.name || "").trim();
    if (!nm) return;
    if (!allowCustom && !getOption(nm)) return;

    const opt = getOption(nm) || {};
    const finalizedQty = row.qty || (opt.defaultQty != null ? toLiters(opt.defaultQty, opt.unit) : "");
    const finalized = {
      ...row,
      name: nm,
      qty: finalizedQty,
      link: row.link || opt.link || "",
      unit: FORCE_UNIT,
    };

    onChange?.([...(value || []), finalized]);

    setRow({ name: "", qty: "", remark: "", link: "", unit: FORCE_UNIT });
    setTouched({ qty: false, link: false });
    nameInputRef.current?.focus();
  };

  const removeAt = (i) => onChange?.((value || []).filter((_, x) => x !== i));

  const handleKeyDownOnName = (e) => {
    if (e.key === "Enter") { e.preventDefault(); add(); }
  };

  // หน่วยที่จะแสดงท้ายช่องปริมาณ (บังคับเป็น L เสมอ)
  const currentUnit = FORCE_UNIT;

  return (
    <div className="card">
      <div className="mb-2 font-semibold">เคมีที่ใช้ (เพิ่มได้หลายรายการ)</div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-2">
        {/* ชื่อเคมี */}
        <input
          ref={nameInputRef}
          className="input md:col-span-2"
          placeholder="ชื่อเคมี *"
          list={listId}
          value={row.name}
          onChange={(e) => onNameChange(e.target.value)}
          onKeyDown={handleKeyDownOnName}
        />
        <datalist id={listId}>
          {options.map((o, i) => <option key={i} value={o.name} />)}
        </datalist>

        {/* ปริมาณ + หน่วยเป็น suffix (L) */}
        <div className="relative">
          <input
            className={`input pr-14`}
            placeholder={
              (() => {
                const opt = getOption(row.name);
                if (opt?.defaultQty != null) {
                  const qL = toLiters(opt.defaultQty, opt.unit);
                  return `ปริมาณ (แนะนำ ${qL} ${FORCE_UNIT})`;
                }
                return "ปริมาณ (หน่วยลิตร)";
              })()
            }
            value={row.qty}
            onChange={(e) => onQtyChange(e.target.value)}
            inputMode="decimal"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs px-2 py-0.5 rounded bg-neutral-700">
            {currentUnit}
          </span>
        </div>

        {/* ช่องหน่วย: ซ่อน เพราะบังคับ L เสมอ */}
        <div className="hidden">
          <input className="input" value={FORCE_UNIT} readOnly />
        </div>

        {/* ลิงก์ข้อมูล */}
        <input
          className="input md:col-span-1"
          placeholder="ลิงก์ข้อมูล (ถ้ามี)"
          value={row.link}
          onChange={(e) => onLinkChange(e.target.value)}
        />
      </div>

      <div className="flex gap-2 mb-3">
        <input
          className="input flex-1"
          placeholder="หมายเหตุ"
          value={row.remark}
          onChange={(e) => setRow(r => ({ ...r, remark: e.target.value }))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); add(); }
          }}
        />
        <button type="button" onClick={add} className="px-4 py-2 rounded-xl bg-emerald-600">
          เพิ่ม
        </button>
      </div>

      {(value || []).length > 0 && (
        <div className="space-y-2">
          {value.map((it, i) => (
            <div key={i} className="flex items-center gap-3 bg-neutral-800 rounded-xl p-2 text-sm">
              <div className="flex-1">
                <div className="font-medium">
                  {it.name}{" "}
                  <span className="text-neutral-400">
                    ({it.qty || "-"} {FORCE_UNIT})
                  </span>
                </div>
                {it.remark && <div className="text-neutral-400">{it.remark}</div>}
                {it.link && (
                  <a className="underline text-emerald-400" href={it.link} target="_blank" rel="noreferrer">
                    เปิดลิงก์
                  </a>
                )}
              </div>
              <button type="button" onClick={() => removeAt(i)} className="px-3 py-1 rounded-lg bg-red-600">
                ลบ
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
