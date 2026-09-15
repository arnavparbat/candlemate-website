"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Login() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!password.trim()) {
      setError("Please enter your admin password.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        setError("That password doesn’t match. Please try again.");
        setIsLoading(false);
        return;
      }

      router.push("/admin");
    } catch {
      setError("Unable to reach server. Please check your connection.");
      setIsLoading(false);
    }
  }

  return (
    <main className="grain min-h-[100dvh] w-full flex flex-col justify-between items-center px-4 py-6 sm:py-10">
      {/* Top Bar for Mobile navigation */}
      <div className="w-full max-w-[420px] flex items-center justify-between mb-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-full bg-white/80 border border-[#8a614820] px-3.5 py-1.5 text-xs font-medium text-[#765442] hover:text-ink hover:bg-white transition shadow-2xs active:scale-95"
        >
          <span>←</span> Back to store
        </Link>
        <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-clay bg-[#8a614815] px-2.5 py-1 rounded-full">
          Studio Access
        </span>
      </div>

      {/* Main Login Card */}
      <div className="w-full max-w-[420px] my-auto">
        <form
          onSubmit={submit}
          className="paper rounded-3xl p-6 sm:p-8 bg-white/85 backdrop-blur-md border border-[#8a614825] shadow-xl"
        >
          {/* Brand Header */}
          <div className="flex flex-col items-center text-center">
            <Link href="/" className="group flex flex-col items-center transition-transform active:scale-95">
              <img
                src="/logo.png"
                alt="Candlemate Logo"
                className="h-14 w-auto object-contain candle-glow drop-shadow-sm transition-transform duration-300 group-hover:scale-105"
              />
              <img
                src="/logo-wordmark.png"
                alt="Candlemate"
                className="h-6 w-auto object-contain mt-2.5 opacity-90"
              />
            </Link>

            <h1 className="display mt-5 text-2xl sm:text-3xl font-bold text-ink tracking-tight">
              Studio Login
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-[#765442] max-w-xs">
              For the hands behind the glow. Enter your password to manage candles and orders.
            </p>
          </div>

          {/* Form Fields */}
          <div className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="admin-password"
                className="block text-xs font-semibold uppercase tracking-wider text-[#765442] mb-1.5"
              >
                Admin Password
              </label>

              <div className="relative flex items-center">
                <input
                  id="admin-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError("");
                  }}
                  autoComplete="current-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="Enter studio password"
                  className="w-full rounded-xl border border-[#8a614835] bg-white pl-3.5 pr-11 py-3 text-base sm:text-sm text-ink outline-clay focus:border-clay focus:ring-2 focus:ring-clay/20 shadow-2xs transition font-medium"
                />

                {/* Show/Hide Password Button - Touch friendly 44px */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-1.5 flex h-10 w-10 items-center justify-center rounded-lg text-[#765442] hover:text-ink hover:bg-stone-100 transition active:scale-95 cursor-pointer"
                >
                  {showPassword ? (
                    /* Eye Slash Icon */
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.8}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"
                      />
                    </svg>
                  ) : (
                    /* Eye Icon */
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.8}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.8}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Error Message Box */}
            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800 flex items-start gap-2 animate-in fade-in slide-in-from-top-1">
                <span className="text-sm shrink-0">⚠️</span>
                <span className="font-medium leading-relaxed">{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-ink hover:bg-clay text-white text-sm font-semibold transition-all active:scale-[0.98] shadow-md disabled:bg-stone-400 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>Verifying credentials…</span>
                </>
              ) : (
                <>
                  <span>Enter Studio</span>
                  <span className="text-xs">→</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Footer Branding for Mobile */}
      <footer className="w-full max-w-[420px] text-center mt-4">
        <p className="text-[11px] text-[#765442]/70 font-medium">
          Candlemate Studio · Handcrafted with natural soy wax
        </p>
      </footer>
    </main>
  );
}
