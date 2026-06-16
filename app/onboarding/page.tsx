"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Upload,
  Mail,
  KeyRound,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Method = "pkpass" | "email" | "manual";
type Status = "idle" | "loading" | "success" | "error";

export default function OnboardingPage() {
  const [method, setMethod] = useState<Method>("manual");
  const [userId, setUserId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (data.user) setUserId(data.user.id);
        else router.push("/login");
      });
  }, [router]);

  if (!userId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  return (
    <main className="flex flex-col min-h-screen max-w-md mx-auto px-4 py-6">
      <header className="flex items-center gap-3 mb-8">
        <Link href="/" className="text-zinc-400 hover:text-white transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-sm font-semibold text-white">Add Your Flight</h1>
      </header>

      {/* Method tabs */}
      <div className="flex gap-1 bg-zinc-900 rounded-2xl p-1 mb-6">
        {(
          [
            { key: "manual", label: "Manual", Icon: KeyRound },
            { key: "pkpass", label: "Boarding Pass", Icon: Upload },
            { key: "email", label: "Gmail", Icon: Mail },
          ] as { key: Method; label: string; Icon: React.ComponentType<{ className?: string }> }[]
        ).map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setMethod(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-medium transition-colors ${
              method === key
                ? "bg-blue-600 text-white"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {method === "manual" && <ManualForm router={router} />}
      {method === "pkpass" && <PkpassForm router={router} />}
      {method === "email" && <EmailForm router={router} />}
    </main>
  );
}

// ── Method 3: Manual entry ────────────────────────────────────────
function ManualForm({ router }: { router: ReturnType<typeof useRouter> }) {
  const [flightNumber, setFlightNumber] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!flightNumber || !date) return;

    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/boarding-pass/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flight_number: flightNumber.toUpperCase(),
          departure_date: date,
          confirmation_code: confirmCode || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setMessage(data.error ?? "Flight lookup failed.");
        return;
      }

      setStatus("success");
      setMessage(
        `Found: ${data.status?.status ?? "scheduled"} · Gate ${data.status?.gate ?? "TBD"} · Terminal ${data.status?.terminal ?? "TBD"}`
      );
      setTimeout(() => router.push("/"), 1500);
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field
        label="Flight Number *"
        placeholder="e.g. AA1234"
        value={flightNumber}
        onChange={setFlightNumber}
      />
      <Field
        label="Departure Date *"
        type="date"
        value={date}
        onChange={setDate}
      />
      <Field
        label="Confirmation Code (optional)"
        placeholder="e.g. ABC123"
        value={confirmCode}
        onChange={setConfirmCode}
      />

      <StatusBanner status={status} message={message} />

      <button
        type="submit"
        disabled={!flightNumber || !date || status === "loading"}
        className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm text-white font-medium py-3 transition-colors flex items-center justify-center gap-2"
      >
        {status === "loading" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Looking up flight…
          </>
        ) : (
          <>
            Look Up Flight
            <ChevronRight className="h-4 w-4" />
          </>
        )}
      </button>
    </form>
  );
}

// ── Method 1: .pkpass upload ──────────────────────────────────────
function PkpassForm({ router }: { router: ReturnType<typeof useRouter> }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  }

  async function upload() {
    if (!file) return;
    setStatus("loading");
    setMessage("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/boarding-pass/pkpass", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setMessage(data.error ?? "Parse failed.");
        return;
      }

      setStatus("success");
      setMessage(
        `Imported: ${data.parsed.flight_number ?? "flight"} · ${data.parsed.origin ?? "?"} → ${data.parsed.destination ?? "?"}`
      );
      setTimeout(() => router.push("/"), 1500);
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  }

  return (
    <div className="space-y-4">
      <div
        onClick={() => inputRef.current?.click()}
        className="rounded-2xl border-2 border-dashed border-zinc-700 hover:border-zinc-500 transition-colors p-8 text-center cursor-pointer"
      >
        <Upload className="h-8 w-8 text-zinc-600 mx-auto mb-3" />
        {file ? (
          <p className="text-sm text-zinc-300">{file.name}</p>
        ) : (
          <>
            <p className="text-sm text-zinc-400">
              Tap to select a .pkpass file
            </p>
            <p className="text-xs text-zinc-600 mt-1">
              Export from Apple Wallet → Share → Save File
            </p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".pkpass"
          className="hidden"
          onChange={onFileChange}
        />
      </div>

      <StatusBanner status={status} message={message} />

      <button
        onClick={upload}
        disabled={!file || status === "loading"}
        className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm text-white font-medium py-3 transition-colors flex items-center justify-center gap-2"
      >
        {status === "loading" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Parsing boarding pass…
          </>
        ) : (
          <>
            Import Boarding Pass
            <ChevronRight className="h-4 w-4" />
          </>
        )}
      </button>
    </div>
  );
}

// ── Method 2: Gmail OAuth scan ────────────────────────────────────
function EmailForm({ router }: { router: ReturnType<typeof useRouter> }) {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function connectGmail() {
    setStatus("loading");
    setMessage("Opening Google sign-in…");

    const token = window.prompt(
      "Paste your Google OAuth access token (scope: gmail.readonly)\n\nIn production this opens a popup OAuth flow."
    );

    if (!token) {
      setStatus("idle");
      setMessage("");
      return;
    }

    setMessage("Scanning Gmail for flight confirmations…");

    try {
      const res = await fetch("/api/boarding-pass/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: token }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setMessage(data.error ?? "Gmail scan failed.");
        return;
      }

      if (data.trips?.length > 0) {
        setStatus("success");
        setMessage(`Imported ${data.trips.length} flight${data.trips.length > 1 ? "s" : ""} from Gmail.`);
        setTimeout(() => router.push("/"), 1500);
      } else {
        setStatus("idle");
        setMessage(data.message ?? "No flight confirmations found.");
      }
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 rounded-full bg-red-500/20 flex items-center justify-center">
            <Mail className="h-5 w-5 text-red-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-100">Scan Gmail</p>
            <p className="text-xs text-zinc-500">
              Find flight confirmations automatically
            </p>
          </div>
        </div>
        <ul className="space-y-1.5 text-xs text-zinc-500">
          {[
            "Searches for flight confirmation emails",
            "Extracts details with AI parsing",
            "Read-only access — never sends email",
          ].map((t) => (
            <li key={t} className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              {t}
            </li>
          ))}
        </ul>
      </div>

      <StatusBanner status={status} message={message} />

      <button
        onClick={connectGmail}
        disabled={status === "loading"}
        className="w-full rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm text-white font-medium py-3 transition-colors flex items-center justify-center gap-2"
      >
        {status === "loading" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {message || "Scanning…"}
          </>
        ) : (
          <>
            <Mail className="h-4 w-4" />
            Connect Gmail
          </>
        )}
      </button>
    </div>
  );
}

// ── Shared helpers ────────────────────────────────────────────────
function Field({
  label,
  placeholder,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="text-xs text-zinc-500 uppercase tracking-widest">
        {label}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-xl bg-zinc-900 border border-zinc-700 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
    </div>
  );
}

function StatusBanner({ status, message }: { status: Status; message: string }) {
  if (!message) return null;

  const styles: Record<Status, string> = {
    idle:    "bg-zinc-900 border-zinc-700 text-zinc-400",
    loading: "bg-blue-950/40 border-blue-900 text-blue-300",
    success: "bg-emerald-950/40 border-emerald-900 text-emerald-300",
    error:   "bg-red-950/40 border-red-900 text-red-300",
  };

  const Icon = status === "success"
    ? CheckCircle2
    : status === "error"
    ? AlertCircle
    : Loader2;

  return (
    <div className={`rounded-xl border px-4 py-3 flex items-center gap-2.5 text-sm ${styles[status]}`}>
      <Icon className={`h-4 w-4 shrink-0 ${status === "loading" ? "animate-spin" : ""}`} />
      {message}
    </div>
  );
}
