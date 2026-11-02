"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Mail,
  KeyRound,
  ShieldCheck,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  RefreshCw,
  Edit2,
  Lock,
} from "lucide-react";

type Step = "request" | "verify" | "completed";

function ForgotPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialEmail = searchParams.get("email") || "";
  const initialCode = searchParams.get("code") || "";

  // Wizard state
  const [step, setStep] = useState<Step>(initialCode || initialEmail ? "verify" : "request");
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState(initialCode);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status & feedback
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(
    initialCode || initialEmail ? "أدخل كود التحقق المرسل لك وكلمة المرور الجديدة" : null
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Resend cooldown timer
  const [countdown, setCountdown] = useState(0);
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  // Focus OTP input and ensure password fields are pristine when transitioning to verify step
  useEffect(() => {
    if (step === "verify") {
      setPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        codeInputRef.current?.focus();
      }, 150);
    }
  }, [step]);

  // Step 1: Send OTP to Email
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMessage("يرجى إدخال البريد الإلكتروني");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "حدث خطأ أثناء معالجة الطلب");
      }

      setStep("verify");
      setCountdown(60);
      setInfoMessage(data.message || `تم إرسال كود التحقق بنجاح إلى: ${cleanEmail}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "حدث خطأ غير متوقع";
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (countdown > 0 || resending) return;
    setErrorMessage(null);
    setResending(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "فشل إعادة إرسال الكود");
      }

      setCountdown(60);
      setInfoMessage("تم إرسال كود تحقق جديد بنجاح إلى بريدك الإلكتروني");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "تعذر إعادة الإرسال";
      setErrorMessage(msg);
    } finally {
      setResending(false);
    }
  };

  // Step 2: Verify Code and Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanCode = code.trim().replace(/\s+/g, "");
    if (!cleanCode) {
      setErrorMessage("يرجى إدخال كود التحقق المرسل");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("كلمة المرور الجديدة يجب ألا تقل عن 6 أحرف");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("كلمتا المرور غير متطابقتين");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          code: cleanCode,
          password,
          confirmPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "فشل تغيير كلمة المرور");
      }

      setStep("completed");
      setTimeout(() => {
        router.push("/login");
      }, 2500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "حدث خطأ أثناء حفظ كلمة المرور";
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200/90 shadow-2xl p-6 sm:p-8 space-y-6 transition-all duration-300">
      
      {/* =================================================================== */}
      {/* STEP 1: Request Code by Email */}
      {/* =================================================================== */}
      {step === "request" && (
        <>
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto shadow-inner">
              <Mail className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">استعادة كلمة المرور</h1>
            <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-xs mx-auto">
              أدخل بريدك الإلكتروني المسجل وسنرسل لك كود تحقق لتغيير كلمة المرور فوراً من هذه الصفحة.
            </p>
          </div>

          {errorMessage && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-start gap-3 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleRequestOtp} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">البريد الإلكتروني المسجل</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  dir="ltr"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-xs font-semibold focus:ring-2 focus:ring-brand-500 focus:outline-none text-right transition-all"
                />
                <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white font-black text-xs shadow-lg shadow-brand-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري إرسال كود التحقق...</span>
                </>
              ) : (
                <span>إرسال كود التحقق</span>
              )}
            </button>
          </form>
        </>
      )}

      {/* =================================================================== */}
      {/* STEP 2: Enter Code & New Password Directly */}
      {/* =================================================================== */}
      {step === "verify" && (
        <>
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
              <KeyRound className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">إدخال كود التحقق وتعيين كلمة المرور</h1>
            <p className="text-xs text-slate-500 font-medium">
              أدخل الكود المرسل لبريدك الإلكتروني، ثم اكتب كلمة المرور الجديدة لحسابك.
            </p>
          </div>

          {/* Email info banner with edit button */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 overflow-hidden">
              <Mail className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-slate-600 truncate font-semibold dir-ltr text-right">{email || "البريد الإلكتروني"}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setStep("request");
                setErrorMessage(null);
                setInfoMessage(null);
              }}
              className="text-[11px] font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1 shrink-0 px-2 py-1 rounded-lg hover:bg-white transition-colors"
            >
              <Edit2 className="w-3 h-3" />
              <span>تغيير البريد</span>
            </button>
          </div>

          {infoMessage && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-start gap-2.5 animate-in fade-in duration-200">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <span>{infoMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-start gap-2.5 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleResetPassword} className="space-y-4" autoComplete="off">
            {/* Decoy fields to neutralize browser password manager automatic credential filling */}
            <input
              type="text"
              name="prevent_autofill_username"
              tabIndex={-1}
              aria-hidden="true"
              autoComplete="username"
              className="hidden pointer-events-none opacity-0 h-0 w-0 absolute"
              readOnly
            />
            <input
              type="password"
              name="prevent_autofill_password"
              tabIndex={-1}
              aria-hidden="true"
              autoComplete="current-password"
              className="hidden pointer-events-none opacity-0 h-0 w-0 absolute"
              readOnly
            />

            {/* OTP Code Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="otp-token-code" className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>كود التحقق المرسل (6 أرقام)</span>
                </label>
                <span className="text-[10px] text-slate-400 font-semibold">مكون من 6 أرقام</span>
              </div>
              <input
                ref={codeInputRef}
                id="otp-token-code"
                name="otp-token-code"
                autoComplete="one-time-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                required
                dir="ltr"
                placeholder="••••••"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="w-full px-4 py-3.5 rounded-2xl border-2 border-emerald-200/90 text-center font-mono text-xl font-black tracking-[0.35em] text-slate-800 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 focus:outline-none transition-all placeholder:tracking-normal placeholder:font-sans"
              />
            </div>

            {/* New Password */}
            <div className="space-y-1.5">
              <label htmlFor="aqar-user-new-password" className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-slate-500" />
                <span>كلمة المرور الجديدة</span>
              </label>
              <div className="relative">
                <input
                  id="aqar-user-new-password"
                  name="aqar-user-new-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-brand-500 focus:outline-none transition-all"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3.5 top-3.5 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">يجب ألا تقل عن 6 أحرف أو أرقام</p>
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label htmlFor="aqar-user-confirm-new-password" className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-slate-500" />
                <span>تأكيد كلمة المرور الجديدة</span>
              </label>
              <div className="relative">
                <input
                  id="aqar-user-confirm-new-password"
                  name="aqar-user-confirm-new-password"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-brand-500 focus:outline-none transition-all"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute left-3.5 top-3.5 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white font-black text-xs shadow-lg shadow-brand-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري تغيير كلمة المرور...</span>
                </>
              ) : (
                <span>تأكيد وتغيير كلمة المرور</span>
              )}
            </button>

            {/* Resend Code Action */}
            <div className="text-center pt-1">
              {countdown > 0 ? (
                <p className="text-[11px] font-semibold text-slate-400">
                  يمكنك طلب كود جديد بعد <span className="font-mono text-emerald-600 font-bold">{countdown}</span> ثانية
                </p>
              ) : (
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resending}
                  className="text-[11px] font-bold text-brand-600 hover:text-brand-700 inline-flex items-center gap-1.5 hover:underline disabled:opacity-50"
                >
                  {resending ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>جاري إرسال كود جديد...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-3 h-3" />
                      <span>لم يصلك الكود؟ إعادة إرسال كود التحقق</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </form>
        </>
      )}

      {/* =================================================================== */}
      {/* STEP 3: Completed State */}
      {/* =================================================================== */}
      {step === "completed" && (
        <div className="text-center space-y-5 py-4 animate-in zoom-in-95 duration-300">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-2xl font-black text-slate-900">تم تغيير كلمة المرور بنجاح!</h2>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              تم تحديث كلمة المرور الجديدة لحسابك بنجاح. يمكنك الآن تسجيل الدخول بها فوراً.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
            <span>جاري توجيهك لصفحة تسجيل الدخول تلقائياً...</span>
          </div>

          <Link
            href="/login"
            className="w-full py-3.5 px-4 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white font-black text-xs shadow-lg shadow-brand-600/30 transition-all flex items-center justify-center gap-2"
          >
            <ArrowRight className="w-4 h-4" />
            <span>تسجيل الدخول الآن</span>
          </Link>
        </div>
      )}

      {/* Back to Login Footer */}
      {step !== "completed" && (
        <div className="text-center pt-2 border-t border-slate-100">
          <Link
            href="/login"
            className="text-xs font-bold text-slate-500 hover:text-brand-600 inline-flex items-center gap-1.5 transition-colors"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            <span>العودة لصفحة تسجيل الدخول</span>
          </Link>
        </div>
      )}

    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <Suspense
        fallback={
          <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 p-8 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
          </div>
        }
      >
        <ForgotPasswordForm />
      </Suspense>
    </div>
  );
}
