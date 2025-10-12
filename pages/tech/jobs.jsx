// pages/tech/jobs.jsx
import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import Link from "next/link";
import { fetchMyJobs } from "@/lib/api";

// เรนเดอร์ AppShell ฝั่ง client เท่านั้น (กัน SSR เจอ window/localStorage)
const AppShell = dynamic(() => import("@/components/AppShell"), { ssr: false });

const UID_KEYS = ["SG_UID", "sg.staffUid", "staffUid", "uid"];
const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID || "";
const LIFF_URL = LIFF_ID ? `https://liff.line.me/${LIFF_ID}` : null;

/** วันนี้ตามเวลาไทย */
function todayTH() {
  const d = new Date();
  const th = new Date(d.getTime() + 7 * 3600 * 1000);
  return th.toISOString().slice(0, 10);
}

/** โหลดงานฝั่ง client */
async function loadJobsClient({ date, range, uid, name, phone }) {
  try {
    const data = await fetchMyJobs({
      date,
      range,
      uid,
      name,
      phone,
      includeUnassigned: true,
    });
    return data;
  } catch (e) {
    return {
      ok: false,
      error: String(e?.message || e),
      general: [],
      service: [],
      sources: {},
    };
  }
}

export default function JobsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [checkingUid, setCheckingUid] = useState(true);
  const [uidInput, setUidInput] = useState("");

  const [q, setQ] = useState(() => {
    const query =
      typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    return {
      date: query?.get("date") || todayTH(),
      range: Number(query?.get("range") || 0) || 0,
      uid: query?.get("uid") || "",
      name: query?.get("name") || "",
      phone: query?.get("phone") || "",
    };
  });

  const [data, setData] = useState({
    ok: true,
    general: [],
    service: [],
    sources: {},
  });

  // เติม uid ลง URL หากหาได้จาก localStorage
  const replaceWithUid = async (uid) => {
    const params = new URLSearchParams(router.asPath.split("?")[1] || "");
    params.set("uid", uid);
    await router.replace(`${router.pathname}?${params.toString()}`, undefined, {
      shallow: true,
    });
    setQ((prev) => ({ ...prev, uid }));
  };

  /** ขั้น 1: ตรวจ UID — ไม่เรียก LIFF อัตโนมัติอีกแล้ว */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (typeof window === "undefined") return;

        // ถ้า URL มี uid แล้ว → เก็บใน localStorage เพื่อใช้หน้าอื่นๆ ต่อ
        const urlUid = router.query?.uid ? String(router.query.uid) : "";
        if (urlUid) {
          localStorage.setItem("SG_UID", urlUid);
          setUidInput(urlUid);
          return;
        }

        // หาใน localStorage ตามคีย์ยอดนิยม
        const fromLS = UID_KEYS.map((k) => localStorage.getItem(k)).find(Boolean);
        if (fromLS) {
          setUidInput(fromLS);
          await replaceWithUid(fromLS);
        }
      } finally {
        if (!cancelled) setCheckingUid(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.pathname, router.asPath]);

  /** ขั้น 2: โหลดรายการงานเมื่อพารามิเตอร์พร้อม */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await loadJobsClient(q);
      if (!cancelled) {
        setData(res);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [q.date, q.range, q.uid, q.name, q.phone]);

  const hasUid = useMemo(() => !!(q?.uid && q.uid.length > 0), [q?.uid]);

  const saveUidManually = async () => {
    const u = (uidInput || "").trim();
    if (!u) return;
    try {
      localStorage.setItem("SG_UID", u);
      await replaceWithUid(u);
    } catch (_) {}
  };

  const clearUid = async () => {
    ["SG_UID", "sg.staffUid", "staffUid", "uid"].forEach((k) => localStorage.removeItem(k));
    setUidInput("");
    const params = new URLSearchParams(router.asPath.split("?")[1] || "");
    params.delete("uid");
    await router.replace(`${router.pathname}?${params.toString()}`, undefined, { shallow: true });
    setQ((prev) => ({ ...prev, uid: "" }));
  };

  // ช่วยแปล error ที่พบบ่อย
  const explainError = (msg) => {
    if (!msg) return "";
    if (/no-team-scope|กรุณาผูก UID/i.test(msg)) {
      return "บัญชียังไม่ผูกทีมในชีต StaffLink หรือยังไม่ได้ตั้งค่า UID ให้ช่าง";
    }
    if (/timeout/i.test(msg)) return "การเชื่อมต่อขัดข้อง/ช้า กรุณาลองรีเฟรชอีกครั้ง";
    return "";
  };

  return (
    <AppShell title="งานของฉัน">
      {/* แจ้งสถานะ + เครื่องมือช่วยเมื่อไม่มี UID */}
      {!hasUid && (
        <div className="mb-4 p-3 rounded-xl bg-yellow-900/20 border border-yellow-800 text-yellow-200 text-sm">
          ยังไม่พบ UID ในระบบ — กรุณาเข้าสู่ระบบด้วย LINE หรือตั้งค่า UID ด้วยตัวเอง
          <div className="mt-2 flex flex-col gap-2">
            {LIFF_URL ? (
              <a href={LIFF_URL} className="underline text-emerald-400">
                เข้าสู่ระบบด้วย LINE
              </a>
            ) : (
              <div className="text-xs opacity-80">
                (ยังไม่ได้ตั้งค่า <code>NEXT_PUBLIC_LIFF_ID</code> จึงซ่อนปุ่ม LINE)
              </div>
            )}
            <div className="flex gap-2 items-center">
              <input
                className="w-full rounded-lg bg-neutral-900 px-3 py-2 outline-none"
                placeholder="กรอก UID ด้วยตนเอง เช่น Uxxxxxxxxxxxxxxxxxxxx"
                value={uidInput}
                onChange={(e) => setUidInput(e.target.value)}
              />
              <button onClick={saveUidManually} className="px-3 py-2 rounded-lg bg-emerald-600">
                ใช้ UID นี้
              </button>
              <button onClick={clearUid} className="px-3 py-2 rounded-lg bg-neutral-700">
                ล้าง
              </button>
            </div>
          </div>
        </div>
      )}

      {checkingUid && <div className="text-xs text-neutral-400 mb-2">กำลังตรวจสอบ UID …</div>}
      {loading && <div className="text-xs text-neutral-500 mb-4">กำลังโหลดรายการงาน …</div>}

      {!data?.ok && (
        <div className="text-red-400 text-sm mb-3">
          โหลดไม่ได้: {data?.error || "-"}{" "}
          {!hasUid && "(กรุณาเข้าสู่ระบบ/ผูก UID)"}
          {explainError(data?.error) && (
            <div className="text-xs text-red-300 mt-1">{explainError(data?.error)}</div>
          )}
        </div>
      )}

      {/* แถบ debug */}
      <div className="text-xs text-neutral-400 mb-3">
        วันที่ค้นหา: <code className="px-1 bg-neutral-800 rounded">{q.date}</code> •{" "}
        ช่วงวัน: <code className="px-1 bg-neutral-800 rounded">±{q.range}</code> •{" "}
        แหล่งข้อมูล:{" "}
        <span className="ml-1">ทั่วไป={data?.sources?.general?.name || "-"}</span>,{" "}
        <span>Service={data?.sources?.service?.name || "-"}</span>{" "}
        <button
          className="ml-2 underline"
          onClick={() => setQ((prev) => ({ ...prev }))}
          title="รีเฟรช"
        >
          รีเฟรช
        </button>
      </div>

      <h2 className="text-lg font-semibold mb-2">งานทั่วไป</h2>
      {(!data?.general || data.general.length === 0) ? (
        <div className="text-neutral-400 mb-6">- ไม่มีรายการ -</div>
      ) : (
        <div className="space-y-2 mb-6">
          {data.general.map((j, i) => (
            <div key={i} className="rounded-xl bg-neutral-800 p-3 flex items-center justify-between">
              <div>
                <div className="font-medium">{j.customer || "-"}</div>
                <div className="text-sm text-neutral-400">
                  {j.date} • {j.time || ""}
                </div>
                <div className="text-sm text-neutral-400">{j.address || "-"}</div>
              </div>
              <div className="flex gap-2">
                {j.serviceId ? (
                  <Link
                    href={`/report/${encodeURIComponent(j.serviceId)}`}
                    className="underline text-emerald-400"
                  >
                    เปิดรายงาน
                  </Link>
                ) : (
                  <Link
                    href={`/tech/visit/${encodeURIComponent(j.visitId || j.rowIndex)}`}
                    className="underline"
                  >
                    เริ่มบันทึก
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="text-lg font-semibold mb-2">งาน Service</h2>
      {(!data?.service || data.service.length === 0) ? (
        <div className="text-neutral-400">- ไม่มีรายการ -</div>
      ) : (
        <div className="space-y-2">
          {data.service.map((j, i) => (
            <div key={i} className="rounded-xl bg-neutral-800 p-3 flex items-center justify-between">
              <div>
                <div className="font-medium">{j.customer || "-"}</div>
                <div className="text-sm text-neutral-400">
                  {j.date} • {j.time || ""}
                </div>
                <div className="text-sm text-neutral-400">{j.address || "-"}</div>
              </div>
              <div className="flex gap-2">
                {j.serviceId ? (
                  <Link
                    href={`/report/${encodeURIComponent(j.serviceId)}`}
                    className="underline text-emerald-400"
                  >
                    เปิดรายงาน
                  </Link>
                ) : (
                  <Link
                    href={`/tech/visit/${encodeURIComponent(j.visitId || j.rowIndex)}`}
                    className="underline"
                  >
                    เริ่มบันทึก
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
