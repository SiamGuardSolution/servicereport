import Link from 'next/link';

function ConditionalWrap({ condition, wrap, children }) {
  return condition ? wrap(children) : children;
}

/**
 * job.saved / job.hasReport / job.status === 'saved' ใบไหนเป็น true = เคยบันทึกแล้ว
 * - ถ้ายังไม่บันทึก -> หุ้มทั้งการ์ดด้วย <Link>
 * - ถ้าบันทึกแล้ว     -> ไม่หุ้มการ์ด และแสดงปุ่ม "บันทึกรายงาน"
 */
export default function TechJobCard({ job, href }) {
  const isSaved =
    job?.saved === true || job?.hasReport === true || job?.status === 'saved';

  const card = (
    <div
      className={`card p-4 space-y-2 ${
        isSaved ? '' : 'cursor-pointer hover:bg-neutral-800/60'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="font-semibold">{job.customerName}</div>
        <div className="text-xs text-neutral-400">
          นัดที่ {job.visitNo} • {job.date}
        </div>
      </div>

      <div className="text-sm text-neutral-400">{job.address}</div>

      {/* ถ้าเคยบันทึกแล้ว -> แสดงปุ่มให้กดเข้าไปแก้/ดูต่อ */}
      {isSaved && (
        <Link
          href={href}
          className="inline-flex items-center px-4 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 focus:ring-2 focus:ring-emerald-500"
          aria-label={`เปิดบันทึกรายงานของ ${job.visitId}`}
        >
          บันทึกรายงาน
        </Link>
      )}
    </div>
  );

  return (
    <ConditionalWrap
      condition={!isSaved}
      wrap={(children) => (
        <Link
          href={href}
          className="block rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
          aria-label={`ไปหน้าบันทึกงาน ${job.visitId}`}
        >
          {children}
        </Link>
      )}
    >
      {card}
    </ConditionalWrap>
  );
}
