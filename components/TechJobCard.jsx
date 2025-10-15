// components/TechJobCard.jsx
import Link from 'next/link';
import { useCallback, useMemo } from 'react';

function ConditionalWrap({ condition, wrap, children }) {
  return condition ? wrap(children) : children;
}

export default function TechJobCard({ job = {}, href, onOpen, className = '' }) {
  const isSaved = useMemo(() =>
    job?.saved === true || job?.hasReport === true || job?.status === 'saved'
  , [job?.saved, job?.hasReport, job?.status]);

  const canNavigate = !!href || typeof onOpen === 'function';

  const handleOpen = useCallback((e) => {
    if (onOpen) {
      e?.preventDefault?.();
      onOpen();
    }
  }, [onOpen]);

  const headerRight = (
    <div className="flex items-center gap-2 text-xs text-neutral-400">
      {job?.serviceType && (
        <span className="px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300">
          {job.serviceType}
        </span>
      )}
      <span className="opacity-80">นัดที่ {job?.visitNo ?? '-'}</span>
      <span className="opacity-60">• {job?.date ?? '-'}</span>
    </div>
  );

  const statusBadge = (
    <span
      className={`text-[10px] px-2 py-0.5 rounded-full ${
        isSaved ? 'bg-emerald-700/30 text-emerald-300' : 'bg-amber-700/30 text-amber-200'
      }`}
      aria-label={isSaved ? 'บันทึกแล้ว' : 'ยังไม่บันทึก'}
      title={isSaved ? 'บันทึกแล้ว' : 'ยังไม่บันทึก'}
    >
      {isSaved ? 'บันทึกแล้ว' : 'ใหม่'}
    </span>
  );

  const cardInner = (
    <div
      className={`card p-4 space-y-2 ${!isSaved && canNavigate ? 'cursor-pointer hover:bg-neutral-800/60' : ''} ${className}`}
      role="group"
      aria-labelledby={`job-${job?.visitId || ''}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div id={`job-${job?.visitId || ''}`} className="font-semibold">
            {job?.customerName || '-'}
          </div>
          {statusBadge}
        </div>
        {headerRight}
      </div>

      <div className="text-sm text-neutral-400">
        {job?.address || '-'}
      </div>

      {/* ถ้าเคยบันทึกแล้ว -> แสดงปุ่มให้กดเข้าไปแก้/ดูต่อ */}
      {isSaved && (
        href ? (
          <Link
            href={href}
            className="inline-flex items-center px-4 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 focus:ring-2 focus:ring-emerald-500"
            aria-label={`เปิดบันทึกรายงานของ ${job?.visitId || ''}`}
          >
            บันทึกรายงาน
          </Link>
        ) : (
          <button
            type="button"
            onClick={handleOpen}
            className="inline-flex items-center px-4 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 focus:ring-2 focus:ring-emerald-500"
            aria-label={`เปิดบันทึกรายงานของ ${job?.visitId || ''}`}
          >
            บันทึกรายงาน
          </button>
        )
      )}
    </div>
  );

  // ยังไม่บันทึก → คลิกทั้งการ์ดเพื่อนำทาง/เปิด dialog
  const shouldWrapAsLink = !isSaved && !!href;
  const shouldWrapAsButton = !isSaved && !href && typeof onOpen === 'function';

  return (
    <ConditionalWrap
      condition={shouldWrapAsLink || shouldWrapAsButton}
      wrap={(children) =>
        shouldWrapAsLink ? (
          <Link
            href={href}
            className="block rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
            aria-label={`ไปหน้าบันทึกงาน ${job?.visitId || ''}`}
          >
            {children}
          </Link>
        ) : (
          <button
            type="button"
            onClick={handleOpen}
            className="block w-full text-left rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
            aria-label={`ไปหน้าบันทึกงาน ${job?.visitId || ''}`}
          >
            {children}
          </button>
        )
      }
    >
      {cardInner}
    </ConditionalWrap>
  );
}
