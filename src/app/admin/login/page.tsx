"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  Lock,
  Mail,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  ArrowRight,
  Shield,
  HelpCircle,
} from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();

  // Login State
  const [email, setEmail] = useState("mkelwayzy@gmail.com");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recovery State
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("mkelwayzy@gmail.com");
  const [recoveryStep, setRecoveryStep] = useState<1 | 2>(1);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryMsg, setRecoveryMsg] = useState<string | null>(null);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("البريد الإلكتروني وكلمة المرور مطلوبان");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          identifier: email.trim(),
          password,
          rememberMe: true,
          redirect: "/admin",
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (data.user?.role !== "admin") {
          setError("عذراً، هذا الحساب لا يملك صلاحية مدير النظام");
          return;
        }
        window.dispatchEvent(new Event("auth-state-changed"));
        router.push("/admin");
      } else {
        setError(data.error || "بيانات الدخول غير صحيحة، يرجى التحقق من كلمة المرور");
      }
    } catch {
      setError("خطأ في الاتصال بالخادم، يرجى المحاولة لاحقاً");
    } finally {
      setLoading(false);
    }
  };

  const handleSendRecoveryCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryLoading(true);
    setRecoveryError(null);
    setRecoveryMsg(null);

    try {
      const res = await fetch("/api/admin/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_code",
          email: recoveryEmail.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setRecoveryMsg(data.message);
        setRecoveryStep(2);
      } else {
        setRecoveryError(data.error || "فشل إرسال رمز التحقق");
      }
    } catch {
      setRecoveryError("حدث خطأ أثناء إرسال رمز التحقق");
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handleVerifyAndResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryLoading(true);
    setRecoveryError(null);

    try {
      const res = await fetch("/api/admin/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify_and_reset",
          email: recoveryEmail.trim(),
          code: recoveryCode.trim(),
          newPassword,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setRecoveryMsg(data.message);
        setTimeout(() => {
          setShowRecovery(false);
          setRecoveryStep(1);
          setRecoveryCode("");
          setNewPassword("");
          setPassword("");
        }, 2000);
      } else {
        setRecoveryError(data.error || "فشل إعادة تعيين كلمة المرور");
      }
    } catch {
      setRecoveryError("حدث خطأ أثناء إعادة تعيين كلمة المرور");
    } finally {
      setRecoveryLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden"
      dir="rtl"
    >
      {/* Background Gradients */}
      <div className="absolute top-1/4 -right-20 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -left-20 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md space-y-8 relative z-10">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl flex items-center justify-center mx-auto text-amber-400">
            <ShieldCheck className="w-9 h-9" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            بوابة الإدارة المركزية
          </h1>
          <p className="text-xs text-slate-400 font-medium">
            لوحة تحكم المشرفين والمديرين • دار العقار
          </p>
        </div>

        {/* Card */}
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          {error && (
            <div className="flex items-center gap-3 p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-xs font-bold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!showRecovery ? (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  البريد الإلكتروني الإداري
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@aqarpulse.eg"
                    className="w-full pl-3 pr-10 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-xs font-bold text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition"
                  />
                  <Mail className="w-4 h-4 text-slate-500 absolute top-3.5 right-3.5" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-300">
                    كلمة مرور المشرف
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowRecovery(true);
                      setRecoveryEmail(email);
                    }}
                    className="text-[11px] font-bold text-amber-400 hover:text-amber-300 transition"
                  >
                    نسيت كلمة المرور؟
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-xs font-bold text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition"
                  />
                  <Lock className="w-4 h-4 text-slate-500 absolute top-3.5 right-3.5" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute top-3.5 left-3 text-slate-500 hover:text-slate-300 transition"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition shadow-lg shadow-amber-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري التحقق والمصادقة...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    <span>دخول لوحة التحكم المركزية</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            /* Emergency Recovery Flow */
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4" />
                  <span>استعادة كلمة مرور المسؤول</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRecovery(false)}
                  className="text-[11px] font-bold text-slate-400 hover:text-white"
                >
                  العودة لتسجيل الدخول
                </button>
              </div>

              {recoveryMsg && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{recoveryMsg}</span>
                </div>
              )}

              {recoveryError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{recoveryError}</span>
                </div>
              )}

              {recoveryStep === 1 ? (
                <form onSubmit={handleSendRecoveryCode} className="space-y-4">
                  <p className="text-xs text-slate-400 leading-relaxed">
                    أدخل البريد الإلكتروني للمسؤول لإرسال رمز تحقق مؤقت مكون من 6 أرقام عبر بريد النظام.
                  </p>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      البريد الإلكتروني للمسؤول
                    </label>
                    <input
                      type="email"
                      required
                      value={recoveryEmail}
                      onChange={(e) => setRecoveryEmail(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={recoveryLoading}
                    className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition flex items-center justify-center gap-2"
                  >
                    {recoveryLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <span>إرسال رمز التحقق إلى البريد</span>
                    )}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyAndResetPassword} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      رمز التحقق (6 أرقام)
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: 489201"
                      value={recoveryCode}
                      onChange={(e) => setRecoveryCode(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white text-center tracking-widest focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      كلمة المرور الجديدة
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="8 أحرف على الأقل"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={recoveryLoading}
                    className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl transition flex items-center justify-center gap-2"
                  >
                    {recoveryLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <span>تأكيد وحفظ كلمة المرور الجديدة</span>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Footer Back Link */}
        <div className="text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition"
          >
            <span>العودة للمنصة الرئيسية</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
