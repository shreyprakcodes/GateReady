"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Mail, Lock, User, AlertCircle, CheckCircle2, Plane } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AuthField } from "../login/page";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName]                   = useState("");
  const [email, setEmail]                 = useState("");
  const [password, setPassword]           = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState("");
  const [success, setSuccess]             = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data, error: authErr } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (authErr) { setError(authErr.message); setLoading(false); return; }

    if (data.session) {
      // Immediate session (email confirm disabled) — create profile then redirect
      await fetch("/api/auth/create-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      router.push("/");
      router.refresh();
    } else {
      // Email confirmation required — show success state
      setSuccess(true);
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-6"
        style={{ backgroundColor: "#F7F5F0" }}
      >
        <div
          className="w-full max-w-sm rounded-3xl p-8 text-center"
          style={{
            backgroundColor: "#FFFFFF",
            border: "1px solid #E5E1D8",
            boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
          }}
        >
          <CheckCircle2 className="h-12 w-12 mx-auto mb-4" style={{ color: "#10B981" }} />
          <h2 className="text-lg font-bold mb-2" style={{ color: "#1A1A2E" }}>Check your email</h2>
          <p className="text-sm" style={{ color: "#6B7280" }}>
            We sent a confirmation link to{" "}
            <span className="font-semibold" style={{ color: "#1A1A2E" }}>{email}</span>.
            Click it to activate your account.
          </p>
          <Link
            href="/login"
            className="block mt-6 text-sm font-semibold"
            style={{ color: "#4F46E5" }}
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
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
        <h2 className="text-lg font-bold mb-6" style={{ color: "#1A1A2E" }}>Create account</h2>

        <form onSubmit={submit} className="space-y-4">
          <AuthField
            icon={<User className="h-4 w-4" />}
            type="text"
            placeholder="Your name"
            label="Full Name"
            value={name}
            onChange={setName}
            autoComplete="name"
          />
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
            placeholder="Min 8 characters"
            label="Password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
          />
          <AuthField
            icon={<Lock className="h-4 w-4" />}
            type="password"
            placeholder="Re-enter your password"
            label="Confirm Password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
          />

          {/* Confirm password match indicator */}
          {confirmPassword && password !== confirmPassword && (
            <p className="text-xs flex items-center gap-1" style={{ color: "#B91C1C" }}>
              <AlertCircle className="h-3.5 w-3.5" />
              Passwords do not match
            </p>
          )}
          {confirmPassword && password === confirmPassword && password.length >= 8 && (
            <p className="text-xs flex items-center gap-1" style={{ color: "#10B981" }}>
              <CheckCircle2 className="h-3.5 w-3.5" />
              Passwords match
            </p>
          )}

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
            disabled={!email || !password || !confirmPassword || loading}
            className="w-full rounded-2xl py-3 text-sm font-semibold transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
            style={{ backgroundColor: "#4F46E5", color: "#FFFFFF" }}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "Creating account…" : "Create Account"}
          </button>
        </form>

        <p className="text-center text-sm mt-6" style={{ color: "#9CA3AF" }}>
          Already have an account?{" "}
          <Link href="/login" className="font-semibold" style={{ color: "#4F46E5" }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
