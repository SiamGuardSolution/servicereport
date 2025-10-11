// pages/tech/settings.jsx
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import AppShell from "@/components/AppShell";

const UID_KEYS = ["sg.staffUid", "staffUid", "uid", "SG_UID"];
const TOKEN_KEYS = ["sg.token", "token", "SG_TOKEN"];

function readFirst(keys) {
  if (typeof window === "undefined") return "";
  for (const k of keys) {
    const v = localStorage.getItem(k);
    if (v) return v;
  }
  return "";
}

function writeAll(keys, value) {
  if (typeof window === "undefined") return;
  keys.forEach((k) => localStorage.setItem(k, value));
}

function removeAll(keys) {
  if (typeof window === "undefined") return;
  keys.forEach((k) => localStorage.removeItem(k));
}

export default function Settings() {
  const router = useRouter();
  const [uid, setUid] = useState("");
  const [token, setToken] = useState("");
  const [saved, setSaved] = useState("");

  useEffect(() => {
    setUid(readFirst(UID_KEYS));
    setToken(readFirst(TOKEN_KEYS));
  }, []);

  const onSave = () => {
    const u = uid.trim();
    const t = token.trim();
    if (!u) {
      alert("กรุณากรอก Staff UID");
      return;
    }
    writeAll(UID_KEYS, u);
    if (t) writeAll(TOKEN_KEYS, t);
    setSaved(new Date().toLocaleTimeString());
  };

  const onClear = () => {
    removeAll(UID_KEYS);
    removeAll(TOKEN_KEYS);
    setUid("");
    setToken("");
    setSaved("");
  };

  const gotoJobs = () => {
    // อ่าน query ปัจจุบันแบบปลอดภัย (JS ไม่ใช้ as any)
    const currentQs =
      typeof window !== "undefined" ? window.location.search : "";
    const q = new URLSearchParams(currentQs);
    if (uid.trim()) q.set("uid", uid.trim());
    router.push(`/tech/jobs?${q.toString()}`);
  };

  return (
    <AppShell title="ตั้งค่า">
      <div className="max-w-xl space-y-6">
        <section className="rounded-2xl bg-neutral-800 p-4">
          <h2 className="text-lg font-semibold mb-3">บัญชีผู้ใช้</h2>

          <label className="block text-sm mb-1">Staff UID</label>
          <input
            value={uid}
            onChange={(e) => setUid(e.target.value)}
            placeholder="เช่น Uxxxxxxxxxxxxxxxx"
            className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 mb-3 outline-none focus:ring-2 focus:ring-emerald-500"
          />

          <label className="block text-sm mb-1">Token (ถ้ามี)</label>
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="โทเค็นสำหรับเรียก API (ถ้ามี)"
            className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 mb-4 outline-none focus:ring-2 focus:ring-emerald-500"
          />

          <div className="flex gap-2">
            <button
              onClick={onSave}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500"
            >
              บันทึก
            </button>
            <button
              onClick={gotoJobs}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500"
            >
              ไปที่งานของฉัน
            </button>
            <button
              onClick={onClear}
              className="ml-auto px-3 py-2 rounded-xl bg-neutral-700 hover:bg-neutral-600"
            >
              ล้างค่า
            </button>
          </div>

          <div className="text-xs text-neutral-400 mt-3">
            บันทึกล่าสุด: {saved ? saved : "-"} | คีย์ที่ใช้เก็บ UID:{" "}
            <code className="bg-neutral-900 px-1 rounded">
              {UID_KEYS.join(", ")}
            </code>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
