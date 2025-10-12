// pages/tech/settings.jsx
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import AppShell from "@/components/AppShell";

const UID_KEYS = ["sg.staffUid", "staffUid", "uid", "SG_UID"];
const TOKEN_KEYS = ["sg.token", "token", "SG_TOKEN"];

function safeLocalStorageGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeLocalStorageSet(key, val) {
  try { localStorage.setItem(key, val); } catch {}
}
function safeLocalStorageRemove(key) {
  try { localStorage.removeItem(key); } catch {}
}

function readFirst(keys) {
  if (typeof window === "undefined") return "";
  for (const k of keys) {
    const v = safeLocalStorageGet(k);
    if (v) return v;
  }
  return "";
}
function writeAll(keys, value) {
  if (typeof window === "undefined") return;
  keys.forEach((k) => safeLocalStorageSet(k, value));
}
function removeAll(keys) {
  if (typeof window === "undefined") return;
  keys.forEach((k) => safeLocalStorageRemove(k));
}

const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID || "";

export default function Settings() {
  const router = useRouter();
  const [uid, setUid] = useState("");
  const [token, setToken] = useState("");
  const [saved, setSaved] = useState("");
  const [busyLiff, setBusyLiff] = useState(false);
  const [msg, setMsg] = useState("");

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
    setMsg("บันทึกเรียบร้อย");
    setTimeout(() => setMsg(""), 2000);
  };

  const onClear = () => {
    removeAll(UID_KEYS);
    removeAll(TOKEN_KEYS);
    setUid("");
    setToken("");
    setSaved("");
    setMsg("ล้างค่าแล้ว");
    setTimeout(() => setMsg(""), 2000);
  };

  const gotoJobs = () => {
    const q = new URLSearchParams(
      typeof window !== "undefined" ? window.location.search : ""
    );
    if (uid.trim()) q.set("uid", uid.trim());
    router.push(`/tech/jobs?${q.toString()}`);
  };

  const copyJobsLink = async () => {
    const base =
      typeof window !== "undefined"
        ? `${window.location.origin}/tech/jobs`
        : "/tech/jobs";
    const q = new URLSearchParams();
    if (uid.trim()) q.set("uid", uid.trim());
    const link = `${base}?${q.toString()}`;
    try {
      await navigator.clipboard.writeText(link);
      setMsg("คัดลอกลิงก์แล้ว");
      setTimeout(() => setMsg(""), 2000);
    } catch {
      setMsg("คัดลอกไม่สำเร็จ");
      setTimeout(() => setMsg(""), 2000);
    }
  };

  // ดึง UID จาก LINE (ถ้าตั้ง LIFF ไว้)
  const loginByLINE = async () => {
    if (!LIFF_ID) {
      alert("ยังไม่ได้ตั้งค่า NEXT_PUBLIC_LIFF_ID");
      return;
    }
    setBusyLiff(true);
    setMsg("");
    try {
      const { default: liff } = await import("@line/liff");
      await liff.init({ liffId: LIFF_ID });

      if (!liff.isLoggedIn()) {
        liff.login({
          withLoginOnExternalBrowser: true,
          redirectUri: window.location.href,
        });
        return; // จะกลับมาหน้านี้หลัง login
      }

      const prof = await liff.getProfile();
      if (prof?.userId) {
        setUid(prof.userId);
        writeAll(UID_KEYS, prof.userId);
        setSaved(new Date().toLocaleTimeString());
        setMsg("ดึง UID จาก LINE แล้ว");
        setTimeout(() => setMsg(""), 2000);
      } else {
        setMsg("ไม่พบ userId ในโปรไฟล์ LINE");
      }
    } catch (e) {
      setMsg(`เข้าสู่ระบบ LINE ไม่สำเร็จ: ${String(e?.message || e)}`);
    } finally {
      setBusyLiff(false);
    }
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
            placeholder="เช่น Uxxxxxxxxxxxxxxxxxxxxxxxx"
            className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 mb-3 outline-none focus:ring-2 focus:ring-emerald-500"
            autoComplete="off"
            inputMode="text"
          />

          <label className="block text-sm mb-1">Token (ถ้ามี)</label>
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="โทเค็นสำหรับเรียก API (ถ้ามี)"
            className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 mb-4 outline-none focus:ring-2 focus:ring-emerald-500"
            autoComplete="off"
          />

          <div className="flex flex-wrap gap-2">
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
              onClick={copyJobsLink}
              className="px-3 py-2 rounded-xl bg-neutral-700 hover:bg-neutral-600"
              title="คัดลอกลิงก์ /tech/jobs พร้อม uid"
            >
              คัดลอกลิงก์ Jobs
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

          <hr className="my-4 border-neutral-700" />

          {/* เข้าสู่ระบบด้วย LINE (ออปชัน) */}
          <div className="space-y-2">
            <div className="text-sm opacity-80">
              {LIFF_ID
                ? "ต้องการดึง UID อัตโนมัติจาก LINE หรือไม่?"
                : "ยังไม่ได้ตั้งค่า NEXT_PUBLIC_LIFF_ID จึงซ่อนปุ่ม LINE"}
            </div>

            {LIFF_ID && (
              <button
                onClick={loginByLINE}
                disabled={busyLiff}
                className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 disabled:opacity-60"
              >
                {busyLiff ? "กำลังเข้าสู่ระบบ…" : "ดึง UID จาก LINE"}
              </button>
            )}
          </div>

          {!!msg && (
            <div className="mt-3 text-xs text-emerald-300">{msg}</div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
