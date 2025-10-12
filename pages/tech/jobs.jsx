// pages/tech/jobs.jsx
import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import Link from "next/link";
import { fetchMyJobs } from "@/lib/api";

// ให้ AppShell เรนเดอร์ฝั่ง client เท่านั้น (กัน SSR ลาก liff มา)
const AppShell = dynamic(() => import("@/components/AppShell"), { ssr: false });

const UID_KEYS = ["SG_UID", "sg.staffUid", "staffUid", "uid"];

/** วันนี้ตามเวลาไทย (กันปัญหา UTC ข้ามวัน) */
function todayTH() {
  const d = new Date();
  const th = new Date(d.getTime() + 7 * 3600 * 1000);
  return th.toISOString().slice(0, 10);
}

/** โหลดงานฝั่ง client (กัน SSR ชน env/API) */
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
  const [checkingAccount, setCheckingAccount] = useState(true);
  const [q, setQ] = useState(() => {
    const query = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
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

  /** ช่วยเติม uid ลงใน URL (จะทำให้ useEffect รอบโหลดงานยิงใหม่เอง) */
  const replaceWithUid = async (uid) => {
    const params = new URLSearchParams(router.asPath.split("?")[1] || "");
    params.set("uid", uid);
    await router.replace(`${router.pathname}?${params.toString()}`, undefined, { shallow: true });
    setQ((prev) => ({ ...prev, uid }));
  };

  /** ขั้น 1: หา uid จาก localStorage ก่อน ถ้าไม่มีก็ค่อยเรียก LIFF */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // SSR guard
        if (typeof window === "undefined") return;

        // 1) ถ้า URL มี uid แล้ว → เก็บไว้และจบขั้นตรวจ
        const urlUid = router.query?.uid ? String(router.query.uid) : "";
        if (urlUid) {
          localStorage.setItem("SG_UID", urlUid);
          setCheckingAccount(false);
          return;
        }

        // 2) หาใน localStorage
        const fromLS = UID_KEYS.map((k) => localStorage.getItem(k)).find(Boolean);
        if (fromLS) {
          await replaceWithUid(fromLS);
          setCheckingAccount(false);
          return;
        }

        // 3) ยังหาไม่ได้ → ใช้ LIFF login (รองรับ external browser)
        const { default: liff } = await import("@line/liff");
        await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID });

        if (!liff.isLoggedIn()) {
          liff.login({
            withLoginOnExternalBrowser: true,
            redirectUri: window.location.href,
          });
          return; // จะกลับมาใหม่หลังล็อกอิน
        }

        const prof = await liff.getProfile();
        if (!cancelled && prof?.userId) {
          localStorage.setItem("SG_UID", prof.userId);
          await replaceWithUid(prof.userId);
        }
      } catch (e) {
        // ไม่ต้องบล็อกหน้า ให้ผู้ใช้เติม uid เองได้
        console.warn("check account failed:", e);
      } finally {
        if (!cancelled) setCheckingAccount(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.pathname, router.asPath]);

  /** ขั้น 2: โหลดรายการงานเมื่อมีพารามิเตอร์พร้อม */
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

  return (
    <AppShell title="งานของฉัน">
      {/* สถานะด้านบน */}
      {!hasUid && (
        <div className="text-amber-400 text-sm mb-3">
          ยังไม่พบ UID ใน URL/บัญชี — ระบบจะแนบให้อัตโนมัติหลังเข้าสู่ระบบ LINE (หรือไปที่เมนูตั้งค่าเพื่อผูกบัญชี)
        </div>
      )}
      {checkingAccount && (
        <div className="text-xs text-neutral-400 mb-2">กำลังตรวจสอบบัญชี LINE …</div>
      )}
      {loading && (
        <div className="text-xs text-neutral-500 mb-4">กำลังโหลดรายการงาน …</div>
      )}
      {!data?.ok && (
        <div className="text-red-400 text-sm mb-3">
          โหลดไม่ได้: {data?.error || "-"}{" "}
          {!hasUid && "(กรุณาตั้งค่า UID ที่เมนูตั้งค่า)"}
        </div>
      )}

      {/* แถบ debug สั้น ๆ */}
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
                <div className="text-sm text-neutral-400">{j.date} • {j.time || ""}</div>
                <div className="text-sm text-neutral-400">{j.address || "-"}</div>
              </div>
              <div className="flex gap-2">
                {j.serviceId ? (
                  <Link href={`/report/${encodeURIComponent(j.serviceId)}`} className="underline text-emerald-400">เปิดรายงาน</Link>
                ) : (
                  <Link href={`/tech/visit/${encodeURIComponent(j.visitId || j.rowIndex)}`} className="underline">เริ่มบันทึก</Link>
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
                <div className="text-sm text-neutral-400">{j.date} • {j.time || ""}</div>
                <div className="text-sm text-neutral-400">{j.address || "-"}</div>
              </div>
              <div className="flex gap-2">
                {j.serviceId ? (
                  <Link href={`/report/${encodeURIComponent(j.serviceId)}`} className="underline text-emerald-400">เปิดรายงาน</Link>
                ) : (
                  <Link href={`/tech/visit/${encodeURIComponent(j.visitId || j.rowIndex)}`} className="underline">เริ่มบันทึก</Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
