// components/AppShell.jsx
export default function AppShell({ title, children }) {
  return (
    <div className="min-h-screen max-w-xl mx-auto p-4">
      <header className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">{title}</h1>
        <nav className="flex items-center gap-4">
          <a href="/tech/jobs" className="text-sm opacity-70 hover:opacity-100">งานของฉัน</a>
          <a href="/tech/settings" className="text-sm opacity-70 hover:opacity-100">ตั้งค่า</a>
        </nav>
      </header>
      <main className="space-y-4">{children}</main>
      <footer className="mt-10 text-center text-xs opacity-60">Siam Guard Field App</footer>
    </div>
  );
}
