// src/App.jsx
import { Routes, Route } from 'react-router-dom';
import TechnicianApp from './TechnicianApp';
import ReportNew from './ReportNew';
import ServiceReportPage from './ServiceReportPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<TechnicianApp />} />

      {/* ช่างสร้างรายงานใหม่ */}
      <Route path="/report/new" element={<ReportNew mode="create" />} />

      {/* ช่างแก้รายงานเดิม */}
      <Route path="/report/:serviceId" element={<ReportNew mode="edit" />} />

      {/* ลูกค้าอ่านย้อนหลัง */}
      <Route path="/report-view/:serviceId" element={<ServiceReportPage />} />
    </Routes>
  );
}
