"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, Mail, Lock, AlertCircle, CheckCircle2, Plane } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next      = params.get("next") ?? "/";
  const authError = params.get("error");

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(
    authError === "auth_failed" ? "Authentication failed. Please try again." : "",
  );
  const [resetSent, setResetSent]   = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createClient();
    const { error: authErr } = await supabase.auth.signInWithPassword({ email, password });
    if (authErr) { setError(authErr.message); setLoading(false); return; }
    router.push(next);
    router.refresh();
  }

  async function sendReset() {
    if (!email) { setError("Enter your email address above, then click Forgot password."); return; }
    setError("");
    setResetLoading(true);
    const supabase = createClient();
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setResetLoading(false);
    if (resetErr) { setError(resetErr.message); return; }
    setResetSent(true);
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ backgroundColor: "#F7F5F0" }}
    >
      {/* Logo */}
      <div className="mb-10 text-center">
        <div
          className="h-14 w-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ backgroundColor: "#4F46E5" }}
        >
          <Plane className="h-7 w-7 rotate-45 text-white" />
        </div>
        <h1 className="text-[28px] font-bold" style={{ color: "#4F46E5" }}>GateReady ✈️</h1>
        <p className="text-sm mt-1" style={{ color: "#9CA3AF" }}>Your day-of travel companion</p>
      </div>

      {/* Card */}
      <div
        className="w-full max-w-sm rounded-3xl p-6"
        style={{
          backgroundColor: "#FFFFFF",
          border: "1px solid #E5E1D8",
          boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
        }}
      >
        <h2 className="text-lg font-bold mb-6" style={{ color: "#1A1A2E" }}>Sign in</h2>

        <form onSubmit={submit} className="space-y-4">
          <AuthField
            icon={<Mail className="h-4 w-4" />}
            type="email"
            placeholder="you@example.com"
            label="Email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
          />
          <AuthField
            icon={<Lock className="h-4 w-4" />}
            type="password"
            placeholder="••••••••"
            label="Password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
          />

          {/* Forgot password */}
          <div className="flex justify-end -mt-1">
            {resetSent ? (
              <span className="flex items-center gap-1 text-xs" style={{ color: "#10B981" }}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                Reset link sent — check your email
              </span>
            ) : (
              <button
                type="button"
                onClick={sendReset}
                disabled={resetLoading}
                className="text-xs flex items-center gap-1"
                style={{ color: "#9CA3AF" }}
              >
                {resetLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                Forgot password?
              </button>
            )}
          </div>

          {error && (
            <div
              className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm"
              style={{
                backgroundColor: "rgba(239,68,68,0.06)",
                color: "#B91C1C",
                border: "1px solid rgba(239,68,68,0.18)",
              }}
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!email || !password || loading}
            className="w-full rounded-2xl py-3 text-sm font-semibold transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
            style={{ backgroundColor: "#4F46E5", color: "#FFFFFF" }}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <p className="text-center text-sm mt-6" style={{ color: "#9CA3AF" }}>
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-semibold" style={{ color: "#4F46E5" }}>
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}

export function AuthField({
  icon, type, placeholder, label, value, onChange, autoComplete,
}: {
  icon:          React.ReactNode;
  type:          string;
  placeholder:   string;
  label:         string;
  value:         string;
  onChange:      (v: string) => void;
  autoComplete?: string;
}) {
  return (
    <div>
      <label
        className="text-xs font-semibold uppercase tracking-widest mb-2 block"
        style={{ color: "#9CA3AF" }}
      >
        {label}
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#9CA3AF" }}>
          {icon}
        </span>
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required
          className="w-full rounded-2xl pl-10 pr-4 py-3 text-sm outline-none transition-colors"
          style={{ backgroundColor: "#F7F5F0", border: "1px solid #E5E1D8", color: "#1A1A2E" }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "#4F46E5")}
          onBlur={(e)  => (e.currentTarget.style.borderColor = "#E5E1D8")}
        />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
