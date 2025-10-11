// pages/tech/jobs.jsx
import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import AppShell from '@/components/AppShell';
import Link from 'next/link';
import { fetchMyJobs } from '@/lib/api';

const UID_KEYS = ['sg.staffUid', 'staffUid', 'uid', 'SG_UID'];

function todayTH() {
  // วันนี้ตามเวลาไทย (กันปัญหา UTC ข้ามวัน)
  const d = new Date();
  const th = new Date(d.getTime() + 7 * 3600 * 1000);
  return th.toISOString().slice(0, 10);
}

export async function getServerSideProps(ctx) {
  // รับค่าจาก query เพื่อทดสอบย้อนหลัง/ล่วงหน้าได้
  const date  = (ctx.query.date  && String(ctx.query.date))  || todayTH();
  const range = (ctx.query.range && parseInt(String(ctx.query.range),10)) || 0;
  const uid   = ctx.query.uid   ? String(ctx.query.uid)   : undefined;
  const name  = ctx.query.name  ? String(ctx.query.name)  : undefined;
  const phone = ctx.query.phone ? String(ctx.query.phone) : undefined;

  try {
    const data = await fetchMyJobs({ date, range, uid, name, phone, includeUnassigned: true });
    return { props: { data, q: { date, range, uid: uid||'', name: name||'', phone: phone||'' } } };
  } catch (e) {
    return { props: { data: { ok:false, error:String(e), general:[], service:[], sources:{} }, q:{ date, range, uid:'', name:'', phone:'' } } };
  }
}

export default function JobsPage({ data, q }) {
  const general = data?.general ?? [];
  const service = data?.service ?? [];
  const router = useRouter();

  // ถ้า URL ยังไม่มี uid แต่ localStorage มี → เติม uid แล้ว navigate ใหม่
  useEffect(() => {
    // ฝั่งเซิร์ฟเวอร์ไม่มี localStorage
    if (typeof window === 'undefined') return;

    const hasUidInUrl =
      (typeof router.query.uid === 'string' && router.query.uid.length > 0) ||
      (q?.uid && q.uid.length > 0);

    if (hasUidInUrl) return;

    // หา UID จาก localStorage ตามคีย์ยอดนิยม
    const u = UID_KEYS.map(k => localStorage.getItem(k)).find(Boolean);
    if (!u) return; // ยังไม่ได้ตั้งค่า → ให้หน้าแสดงเตือนต่อไป

    const params = new URLSearchParams(router.asPath.split('?')[1] || '');
    params.set('uid', u);
    // ไม่ใช้ shallow เพื่อให้ GSSP ทำงานใหม่ด้วย uid ที่เติมเข้าไป
    router.replace(`${router.pathname}?${params.toString()}`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.pathname, router.asPath]); // ใช้ asPath เพื่อจับการเปลี่ยน query

  return (
    <AppShell title="งานของฉัน">
      {!data?.ok && (
        <div className="text-red-400 text-sm mb-3">
          โหลดไม่ได้: {data?.error || '-'} {(!q?.uid || q.uid === '') && '(กรุณาตั้งค่า UID ที่เมนูตั้งค่า)'}
        </div>
      )}

      {/* แถบ debug สั้น ๆ */}
      <div className="text-xs text-neutral-400 mb-3">
        วันที่ค้นหา: <code className="px-1 bg-neutral-800 rounded">{q.date}</code> •
        ช่วงวัน: <code className="px-1 bg-neutral-800 rounded">±{q.range}</code> •
        แหล่งข้อมูล:
        <span className="ml-1">ทั่วไป={data?.sources?.general?.name || '-'}</span>,{' '}
        <span>Service={data?.sources?.service?.name || '-'}</span>
      </div>

      <h2 className="text-lg font-semibold mb-2">งานทั่วไป</h2>
      {general.length === 0 ? (
        <div className="text-neutral-400 mb-6">- ไม่มีรายการ -</div>
      ) : (
        <div className="space-y-2 mb-6">
          {general.map((j, i) => (
            <div key={i} className="rounded-xl bg-neutral-800 p-3 flex items-center justify-between">
              <div>
                <div className="font-medium">{j.customer || '-'}</div>
                <div className="text-sm text-neutral-400">{j.date} • {j.time || ''}</div>
                <div className="text-sm text-neutral-400">{j.address || '-'}</div>
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
      {service.length === 0 ? (
        <div className="text-neutral-400">- ไม่มีรายการ -</div>
      ) : (
        <div className="space-y-2">
          {service.map((j, i) => (
            <div key={i} className="rounded-xl bg-neutral-800 p-3 flex items-center justify-between">
              <div>
                <div className="font-medium">{j.customer || '-'}</div>
                <div className="text-sm text-neutral-400">{j.date} • {j.time || ''}</div>
                <div className="text-sm text-neutral-400">{j.address || '-'}</div>
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
