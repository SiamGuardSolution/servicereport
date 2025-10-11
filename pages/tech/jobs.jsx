// pages/tech/jobs.jsx
import React from 'react';
import AppShell from '@/components/AppShell';
import Link from 'next/link';
import { fetchMyJobs } from '@/lib/api';

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

  return (
    <AppShell title="งานของฉัน">
      {!data?.ok && <div className="text-red-400 text-sm mb-3">โหลดไม่ได้: {data?.error || '-'}</div>}

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
