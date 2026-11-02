import nodemailer from "nodemailer";

export async function sendOtpEmail(to: string, otp: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const user = (process.env.EMAIL_USER || process.env.GMAIL_USER || "").trim();
  const pass = (process.env.EMAIL_PASS || process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, "");

  if (!user || !pass) {
    console.log("==================================================================");
    console.log(`[Email Simulator] 🔑 كود التحقق السريع للبريد: ${to} هو: [ ${otp} ]`);
    console.log("==================================================================");
    return { success: true, messageId: "simulated-" + Date.now() };
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });

  const mailOptions = {
    from: `"دار العقار" <${user}>`,
    to: to,
    subject: `رمز الدخول السريع: ${otp} | دار العقار`,
    html: `
      <div style="font-family: Arial, 'Segoe UI', Tahoma, sans-serif; direction: rtl; text-align: right; background-color: #f8fafc; padding: 36px 16px; border-radius: 12px; max-width: 540px; margin: 0 auto; border: 1px solid #e2e8f0;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #0f766e; margin: 0; font-size: 24px; font-weight: 800;">دار العقار</h1>
          <p style="color: #64748b; font-size: 14px; margin-top: 6px;">المنصة العقارية الذكية للخريطة التفاعلية</p>
        </div>
        <div style="background-color: #ffffff; padding: 24px; border-radius: 12px; border: 1px solid #f1f5f9; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          <h2 style="color: #0f172a; font-size: 18px; margin-top: 0;">رمز الدخول السريع</h2>
          <p style="color: #334155; font-size: 15px; line-height: 1.6;">
            مرحباً بك! استخدم رمز التحقق التالي لإتمام تسجيل الدخول إلى حسابك أو إنشائه تلقائياً:
          </p>
          <div style="text-align: center; margin: 28px 0;">
            <span style="display: inline-block; background: linear-gradient(135deg, #0f766e, #0d9488); color: #ffffff; font-size: 32px; font-weight: 900; letter-spacing: 8px; padding: 14px 32px; border-radius: 10px; font-family: monospace; box-shadow: 0 4px 12px rgba(15, 118, 110, 0.25);">
              ${otp}
            </span>
          </div>
          <p style="color: #64748b; font-size: 13px; line-height: 1.6; margin-bottom: 0;">
            ⏱️ صلاحية هذا الرمز <strong>10 دقائق</strong> فقط.<br>
            🔒 لا تشارك هذا الرمز مع أي شخص لحماية أمان حسابك.
          </p>
        </div>
        <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 24px; margin-bottom: 0;">
          إذا لم تكن قد طلبت تسجيل الدخول، يمكنك تجاهل هذه الرسالة بأمان.
        </p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("✅ تم إرسال رمز التحقق بنجاح إلى", to, ":", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error("❌ فشل إرسال البريد:", error.message);
    // Return error or simulated success in dev
    return { success: false, error: error.message };
  }
}
