// pages/report/[serviceId].jsx
import React, { useEffect, useState } from "react";

/* -------------------- base exec urls -------------------- */
function getExecBases() {
  const cands = [
    process.env.NEXT_PUBLIC_GAS_EXEC_PRIMARY,
    process.env.NEXT_PUBLIC_GAS_EXEC,
    process.env.NEXT_PUBLIC_GAS_EXEC_BACKUP,
    process.env.NEXT_PUBLIC_GAS_URL,
    process.env.GAS_EXEC,
    process.env.NEXT_PUBLIC_API_BASE,
  ]
    .filter(Boolean)
    .flatMap((s) => String(s).split(","))
    .map((s) => String(s).trim())
    .filter(Boolean)
    .map((s) => s.replace(/\/+$/, ""));
  return Array.from(new Set(cands));
}

/* ---------- helpers for file url / data url ---------- */
function execWithSuffix(b) {
  return /\/exec$/.test(b) ? b : `${b}/exec`;
}

function buildFileUrl(base, id) {
  if (!base || !id) return "";
  const b = execWithSuffix(base);
  return `${b}?route=file&id=${encodeURIComponent(id)}`;
}

async function fetchFileAsDataURL(fileId, bases) {
  const list = bases?.length ? bases : getExecBases();
  const errors = [];
  for (const base of list) {
    try {
      const url = `${execWithSuffix(base)}?route=file64&id=${encodeURIComponent(fileId)}`;
      const res = await fetch(url, { method: "GET", cache: "no-store" });
      const text = await res.text();

      let mime = "image/jpeg";
      let b64 = "";
      try {
        const j = JSON.parse(text);
        if (j?.data || j?.base64) {
          mime = j.mime || mime;
          b64 = j.data || j.base64;
        } else {
          b64 = text.trim();
        }
      } catch {
        b64 = text.trim();
      }

      if (!b64 || b64.length < 50) throw new Error("empty base64");
      return `data:${mime};base64,${b64}`;
    } catch (e) {
      errors.push(String(e));
    }
  }
  throw new Error(errors.join(" | "));
}

function ImageFromFileId({ fileId, className = "", alt = "" }) {
  const [src, setSrc] = React.useState("");
  const [err, setErr] = React.useState("");

  useEffect(() => {
    let alive = true;
    if (!fileId) { setErr("missing fileId"); return; }
    fetchFileAsDataURL(fileId)
      .then((u) => { if (alive) setSrc(u); })
      .catch((e) => { if (alive) setErr(String(e)); });
    return () => { alive = false; };
  }, [fileId]);

  if (err) return <div className={className} style={{opacity:.7}}><small>โหลดรูปไม่สำเร็จ</small></div>;
  if (!src) return <div className={className}><small>กำลังโหลดรูป…</small></div>;
  return <img src={src} alt={alt} className={className} loading="lazy" />;
}

/* -------------------- date/time utils (ไทย พ.ศ.) -------------------- */
function formatThaiDateTime(iso) {
  try {
    const d = iso ? new Date(iso) : new Date();
    const f = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "Asia/Bangkok",
    });
    return f.format(d);
  } catch {
    return "";
  }
}

function formatTeamLabel(name) {
  if (!name) return "";
  return /^ทีม/.test(String(name)) ? String(name) : `ทีม ${name}`;
}

/* map teamId -> teamName จาก ENV (JSON) เช่น:
   NEXT_PUBLIC_TEAM_MAP_JSON='{"T01":"ทีม A","T02":"ทีม B"}' */
function getTeamNameFromId(id) {
  if (!id) return "";
  try {
    const raw =
      process.env.NEXT_PUBLIC_TEAM_MAP_JSON ||
      process.env.TEAM_MAP_JSON ||
      "";
    if (!raw) return "";
    const map = JSON.parse(raw);
    const name = map?.[id] || map?.[String(id)];
    return name ? String(name) : "";
  } catch {
    return "";
  }
}

/* เดาชื่อทีมจากสรุปงาน */
function parseTeamFromSummary(summary) {
  if (!summary || typeof summary !== "string") return "";
  let s = summary.trim();
  if (!s) return "";
  s = s.replace(/^(ช่าง|ผู้ปฏิบัติงาน|เจ้าหน้าที่)[:\s-]*/i, "");
  s = s.replace(/\s*และ\s*/g, " & ");
  s = s.replace(/\s+/g, " ").trim();
  return s.length >= 2 ? s : "";
}

/* ===== deep team extractor ===== */
// เดิน object แบบตื้น-ลึกเพื่อหา value แรกที่เป็น string และ key เข้าข่าย "team"
function deepPickTeam(obj, maxDepth = 4) {
  if (!obj || typeof obj !== "object" || maxDepth < 0) return "";
  const KEY_RE = /(team|ทีม|crew|group|uploaderTeam|uploader_team|tech_team|technicianTeam|teamName|team_name)/i;

  // DFS
  const stack = [{ node: obj, depth: 0 }];
  const seen = new Set();
  while (stack.length) {
    const { node, depth } = stack.pop();
    if (!node || typeof node !== "object") continue;
    if (seen.has(node)) continue;
    seen.add(node);

    for (const k of Object.keys(node)) {
      const v = node[k];
      if (KEY_RE.test(k)) {
        if (typeof v === "string" && v.trim()) return v.trim();
        if (Array.isArray(v)) {
          const s = v.find((x) => typeof x === "string" && x.trim());
          if (s) return s.trim();
        }
      }
      if (depth + 1 <= maxDepth && v && typeof v === "object") {
        stack.push({ node: v, depth: depth + 1 });
      }
    }
  }
  return "";
}

/* ดึงชื่อทีมจาก validate ได้หลายรูปแบบ */
function pickTeamFromValidate(v) {
  if (!v) return "";
  const paths = [
    ["teamName"], ["team_name"], ["team"],
    ["required","teamName"], ["required","team"],
    ["uploader","teamName"], ["uploader","team"],
    ["meta","teamName"], ["meta","team"],
  ];
  for (const p of paths) {
    let cur = v;
    for (const k of p) cur = cur?.[k];
    if (cur) return cur;
  }
  return "";
}

// ลำดับเวลาที่เชื่อถือได้
function pickSavedAtFromHeader(h) {
  const candKeys = [
    "savedAt","saved_at","timestamp","ts","time",
    "createdAt","created_at",
    "updatedAt","updated_at",
    "serviceDate","VISIT_DATE","date"
  ];
  for (const k of candKeys) {
    const v = h?.[k];
    if (v != null && v !== "") return v;
  }
  return null;
}

/* -------------------- normalizer -------------------- */
function adaptReportPayload(json, base) {
  const h = json?.header || {};
  const pick = (o, arr) =>
    arr.map((k) => o?.[k]).find((v) => v != null && v !== "") || "";

  const serviceId = pick(h, ["service_id", "serviceId", "SR_ID", "logId", "idService"]);
  const visitId   = pick(h, ["visit_id", "visitId", "VISIT_ID", "id", "visit"]);

  const savedAt = pickSavedAtFromHeader(h);

  const payload = {
    serviceId,
    visitId,
    createdAt: pick(h, ["date", "serviceDate", "created_at", "createdAt", "VISIT_DATE"]),
    savedAt,
    staffName:    pick(h, ["staff_name", "staffName", "teamName", "team_name", "technicianName", "TECH"]),
    staffTeam:    pick(h, ["team", "teamName", "team_name", "staffTeam", "staff_team"]),
    customerName: pick(h, ["customer_name", "customerName", "client_name", "CLIENT_NAME", "name"]),
    address:      pick(h, ["address", "addr", "ADDRESS"]),
    notes:        pick(h, ["notes", "summary", "remark", "REMARK"]),
    pdfUrl:       pick(h, ["report_url", "pdfUrl"]),
  };

  // ลายเซ็น
  const sigData = pick(h, ["signatureDataUrl","signature","sigDataUrl"]);
  const sigUrlDirect  = pick(h, ["signature_url","signatureUrl","customerSignatureUrl"]);
  const sigId   = pick(h, ["signature_id","signatureFileId","sigFileId"]);
  const signatureUrl =
    sigData ||
    sigUrlDirect ||
    (sigId && base ? buildFileUrl(base, sigId) : "");
  const signatureFileId = sigId || "";

  const byZone = new Map();
  const ensure = (z) => {
    const key = z || "ทั่วไป";
    if (!byZone.has(key)) byZone.set(key, { area: key, chemicals: [], photos: [] });
    return byZone.get(key);
  };

  // chemicals/items
  (json?.items || json?.chemicals || []).forEach((it) => {
    const row = ensure(it.zone || it.area || it.location);
    row.chemicals.push({
      name:   pick(it, ["name", "chemical", "chem", "product"]),
      qty:    pick(it, ["qty", "quantity"]),
      unit:   pick(it, ["unit"]),
      link:   pick(it, ["link", "url"]),
      remark: pick(it, ["remark", "note"]),
    });
  });

  // photos/files
  (json?.photos || json?.images || json?.files || []).forEach((p) => {
    const row = ensure(p.zone || p.area || p.location);
    const fid = p.id || p.file_id || p.fileId || "";
    const directUrl =
      p.dataUrl || p.dataURL || p.base64 || p.url ||
      (fid && base ? buildFileUrl(base, fid) : "");
    if (!directUrl && !fid) return;
    row.photos.push({
      url: directUrl || "",
      fileId: fid || "",
      thumb: directUrl || "",
      caption: p.caption || p.name || "",
      taken_at: p.taken_at || p.takenAt || "",
    });
  });

  return { ...payload, signatureUrl, signatureFileId, items: Array.from(byZone.values()) };
}

/* -------------------- fetch helpers -------------------- */
function withTimeout(ms = 10000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort("timeout"), ms);
  return { signal: ctl.signal, clear: () => clearTimeout(t) };
}

async function tryFetchReport(serviceId) {
  const bases = getExecBases();
  const routes = [
    (b) => `${execWithSuffix(b)}?route=report-by-id&service_id=${encodeURIComponent(serviceId)}`,
    (b) => `${execWithSuffix(b)}?route=report&id=${encodeURIComponent(serviceId)}`,
  ];

  let lastErr = "";
  for (const b of bases) {
    for (const make of routes) {
      const { signal, clear } = withTimeout(12000);
      try {
        const url = make(b);
        const res = await fetch(url, { redirect: "follow", cache: "no-store", signal });
        const json = await res.json().catch(() => ({}));
        clear();
        if (json?.ok) return { base: b, url, json };
        lastErr = json?.error || `HTTP ${res.status}`;
      } catch (e) {
        clear();
        lastErr = String(e?.message || e);
      }
    }
  }
  throw new Error(lastErr || "fetch failed");
}

async function tryValidate(serviceId) {
  const bases = getExecBases();
  for (const b of bases) {
    const { signal, clear } = withTimeout(8000);
    try {
      const url = `${execWithSuffix(b)}?route=validate&service_id=${encodeURIComponent(serviceId)}`;
      const res = await fetch(url, { redirect: "follow", cache: "no-store", signal });
      const json = await res.json().catch(() => ({}));
      clear();
      if (res.ok && json?.ok) return json;
    } catch {}
  }
  return null;
}

/* -------------------- SSR -------------------- */
export async function getServerSideProps(ctx) {
  const REPORT_VIEW_VERSION = "r10";
  const serviceId = String(ctx.params?.serviceId || "");
  const debug = String(ctx.query?.debug || "") === "1";
  const overrideTeam = (ctx.query?.team ? String(ctx.query.team) : "").trim();

  if (!serviceId) {
    return { props: { serviceId, data: null, error: "missing id", debug, meta: null, __v: REPORT_VIEW_VERSION } };
  }

  try {
    ctx.res.setHeader("Cache-Control", "no-store, max-age=0");
    ctx.res.setHeader("x-report-view-version", REPORT_VIEW_VERSION);
  } catch {}

  try {
    const { json, url, base } = await tryFetchReport(serviceId);
    const data = adaptReportPayload(json, base);
    const validate = await tryValidate(serviceId).catch(() => null);
    const meta = debug ? { fetchedFrom: base, endpoint: url, rawOk: json?.ok } : null;
    const rawHeader = debug ? (json?.header || null) : null;
    const rawValidate = debug ? (validate || null) : null;
    return { props: { serviceId, data, validate: validate || null, error: null, debug, meta, rawHeader, rawValidate, overrideTeam, __v: REPORT_VIEW_VERSION } };
  } catch (e) {
    return { props: { serviceId, data: null, error: String(e?.message || e), debug, meta: null, rawHeader: null, rawValidate: null, overrideTeam, __v: REPORT_VIEW_VERSION } };
  }
}

/* -------------------- Client fallback -------------------- */
function ClientFallback({ serviceId, onLoaded }) {
  const [state, setState] = useState({ loading: true, error: "", data: null, validate: null });

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { json, base } = await tryFetchReport(serviceId);
        const data = adaptReportPayload(json, base);
        const validate = await tryValidate(serviceId).catch(() => null);
        if (!mounted) return;
        setState({ loading: false, error: "", data, validate });
        onLoaded?.({ data, validate });
      } catch (e) {
        if (!mounted) return;
        setState({ loading: false, error: String(e?.message || e), data: null, validate: null });
      }
    })();
    return () => { mounted = false; };
  }, [serviceId, onLoaded]);

  if (state.loading) return <div style={{ padding: 16 }}>กำลังโหลด…</div>;
  if (state.error)   return <div style={{ padding: 16, color: "#f66" }}>ผิดพลาด: {state.error}</div>;
  return null;
}

/* -------------------- Small UI helpers -------------------- */
// ลบ overlay ออกจากภาพโดยสิ้นเชิง
function PhotoCard({ url, fileId, alt = "" }) {
  return (
    <div className="relative rounded overflow-hidden border border-neutral-700">
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="block">
          <img loading="lazy" src={url} alt={alt} className="w-full" />
        </a>
      ) : fileId ? (
        <ImageFromFileId fileId={fileId} alt={alt} className="w-full" />
      ) : (
        <div className="p-4 text-sm text-neutral-400">ไม่มีรูป</div>
      )}
    </div>
  );
}

/* -------------------- Page -------------------- */
export default function ServiceReportPage({ serviceId, data, error, validate, debug, meta, rawHeader, rawValidate, overrideTeam, __v }) {
  const [clientData, setClientData] = useState(null);
  const effective = clientData?.data || data;
  const effectiveValidate = clientData?.validate || validate;

  if (error && !effective) {
    return (
      <>
        <ClientFallback serviceId={serviceId} onLoaded={(x) => setClientData(x)} />
        <div style={{ padding: 16, color: "#f66" }}>ผิดพลาด: {error}</div>
      </>
    );
  }

  if (!effective) return <div style={{ padding: 16 }}>ไม่พบข้อมูลรายงาน</div>;

  const {
    serviceId: id = serviceId,
    visitId,
    createdAt,
    savedAt,
    staffName,
    staffTeam,
    customerName,
    address,
    notes,
    items = [],
    signatureUrl,
    signatureFileId,
    pdfUrl,
  } = effective;

  // เวลาไทย
  const savedAtISO = savedAt || createdAt || new Date().toISOString();
  const savedAtTH  = formatThaiDateTime(savedAtISO);

  const teamFromValidate = pickTeamFromValidate(effectiveValidate);
  const autoTeamFromRaw = deepPickTeam(rawHeader) || deepPickTeam(rawValidate ?? validate);
  const teamFromId = getTeamNameFromId(rawHeader?.teamId || rawHeader?.teamID || "");
  const teamFromSummary = parseTeamFromSummary(rawHeader?.summary || "");

  let teamName =
    (overrideTeam || "").trim() ||
    staffTeam ||
    teamFromId ||
    teamFromValidate ||
    autoTeamFromRaw ||
    teamFromSummary ||
    "";

  if (!teamName && staffName && /ทีม/.test(String(staffName))) teamName = staffName;
  if (!teamName && staffName) teamName = staffName;

  const teamLabel = teamName ? formatTeamLabel(teamName) : "-";

  const ValidateBanner = () => {
    const v = effectiveValidate;
    if (!v?.required && !v?.ok) return null;
    let note = "ผลตรวจหลักฐาน: พร้อมใช้งาน";
    if (v?.required?.complete === false || v?.ok === false) note = "ผลตรวจหลักฐาน: ยังไม่ครบ";
    return (
      <div className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-amber-300 text-sm">
        {note}
      </div>
    );
  };

  return (
    <main className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">รายงานหน้างาน <span className="text-xs opacity-50">({__v})</span></h1>

      {debug && meta && (
        <div className="mb-4 rounded-md border border-cyan-700/40 bg-cyan-900/20 p-3 text-cyan-300 text-xs">
          <div>debug=1</div>
          <div>base: {meta.fetchedFrom}</div>
          <div>endpoint: {meta.endpoint}</div>
          <div>raw ok: {String(meta.rawOk)}</div>
        </div>
      )}

      {debug && (
        <div className="mb-4 grid gap-3">
          <details className="rounded-md border border-neutral-700 p-3">
            <summary className="cursor-pointer">header (raw)</summary>
            <pre className="mt-2 whitespace-pre-wrap text-xs">
              {JSON.stringify(rawHeader, null, 2)}
            </pre>
          </details>
          <details className="rounded-md border border-neutral-700 p-3">
            <summary className="cursor-pointer">validate (raw)</summary>
            <pre className="mt-2 whitespace-pre-wrap text-xs">
              {JSON.stringify(rawValidate ?? validate, null, 2)}
            </pre>
          </details>
        </div>
      )}

      <ValidateBanner />

      {/* === ช่าง / ลูกค้า / ที่อยู่ === */}
      <section className="mb-4">
        <div><b>Service ID:</b> {id}</div>
        <div><b>Visit ID:</b> {visitId || "-"}</div>
        <div><b>วัน–เวลา (บันทึก):</b> {savedAtTH || "-"}</div>
        <div><b>ช่างผู้ปฏิบัติงาน:</b> {teamLabel}</div>
        <div><b>ลูกค้า:</b> {customerName || "-"}</div>
        <div><b>ที่อยู่:</b> {address || "-"}</div>
        {pdfUrl && (
          <div className="mt-2">
            <a href={pdfUrl} target="_blank" rel="noreferrer" className="underline">
              เปิดไฟล์ PDF
            </a>
          </div>
        )}
      </section>

      {/* === รายละเอียดการทำงาน === */}
      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">รายละเอียดการทำงาน</h2>
        {items.length === 0 && <div>- ไม่พบรายการ -</div>}

        {items.map((it, idx) => (
          <div key={idx} className="rounded-xl border border-neutral-700 p-3 mb-4">
            <div className="font-medium mb-1">บริเวณที่ทำ: {it?.area || "-"}</div>

            <div className="mb-2">
              <div className="opacity-80 text-sm">สารเคมีที่ใช้</div>
              {(it?.chemicals?.length || 0) === 0 ? (
                <div className="text-neutral-400">-</div>
              ) : (
                <ul className="list-disc pl-5">
                  {it.chemicals.map((c, i) => (
                    <li key={i}>
                      {c?.name} {c?.qty ?? ""} {c?.unit ?? ""}
                      {c?.link ? (
                        <> — <a href={c.link} target="_blank" rel="noreferrer" className="underline">เอกสาร</a></>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {!!(it?.photos || []).length && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {it.photos.map((p, i) => (
                  <PhotoCard
                    key={i}
                    url={p?.url || ""}
                    fileId={p?.fileId || ""}
                    alt={`photo-${i}`}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </section>

      {/* === หมายเหตุ === */}
      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">หมายเหตุ</h2>
        <div className="whitespace-pre-wrap">{notes || "-"}</div>
      </section>

      {/* === ลายเซ็นลูกค้า === */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-2">ลายเซ็นลูกค้า</h2>
        {signatureUrl ? (
          <img
            src={signatureUrl}
            alt="signature"
            className="bg-white p-2 rounded-md border"
            loading="lazy"
          />
        ) : signatureFileId ? (
          <ImageFromFileId fileId={signatureFileId} className="bg-white p-2 rounded-md border" alt="signature" />
        ) : (
          <div>- ไม่มีข้อมูล -</div>
        )}
      </section>
    </main>
  );
}
