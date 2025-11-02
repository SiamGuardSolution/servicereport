// src/App.jsx
import { Routes, Route, Navigate } from 'react-router-dom';
import TechnicianApp from './TechnicianApp';
import ReportNew from './ReportNew';
import ServiceReportPage from './ServiceReportPage';

export default function App() {
  return (
    <Routes>
      {/* หน้าหลัก */}
      <Route path="/" element={<TechnicianApp />} />

      {/* ช่างสร้างรายงานใหม่ */}
      <Route path="/report/new" element={<ReportNew mode="create" />} />

      {/* ช่างแก้รายงานเดิม – รองรับทั้ง 2 path */}
      <Route path="/report/:serviceId" element={<ReportNew mode="edit" />} />
      <Route path="/service-report/:serviceId" element={<ReportNew mode="edit" />} />

      {/* ลูกค้า/ฝ่ายงาน อ่านย้อนหลัง (viewer) */}
      <Route path="/report-view/:serviceId" element={<ServiceReportPage />} />

      {/* redirect เก่า ๆ ที่อาจเคยใช้ */}
      <Route path="/service-report" element={<Navigate to="/" replace />} />

      {/* 404 ง่าย ๆ */}
      <Route path="*" element={<div style={{padding:16}}>ไม่พบหน้าเพจ</div>} />
    </Routes>
  );
}
