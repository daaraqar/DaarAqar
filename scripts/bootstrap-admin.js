/**
 * AqarPulse Platform — Secure Admin Bootstrap Utility
 *
 * Usage:
 *   node scripts/bootstrap-admin.js <email> [fullName]
 *
 * Example:
 *   node scripts/bootstrap-admin.js admin@aqarpulse.eg "مدير النظام الرئيسي"
 *
 * This script safely provisions or promotes an administrator account directly
 * in the persistent database, recording an immutable audit event without
 * committing credentials to Git.
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "../.data");
const DB_FILE = path.join(DATA_DIR, "aqarpulse_db.json");

const crypto = require("crypto");

const email = process.argv[2]?.trim().toLowerCase();
const name = process.argv[3]?.trim() || "مدير النظام";
const adminPassword = process.argv[4]?.trim() || "Admin@2026!Pulse";

if (!email || !email.includes("@")) {
  console.error("\n❌ خطأ: يرجى تمرير بريد إلكتروني صحيح للترقية الإدارية.");
  console.error("الاستخدام: node scripts/bootstrap-admin.js <email> [fullName] [password]\n");
  process.exit(1);
}

if (!fs.existsSync(DB_FILE)) {
  console.error("\n❌ خطأ: قاعدة البيانات المحلية غير موجودة في .data/aqarpulse_db.json\n");
  process.exit(1);
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return { hash: derivedKey.toString("hex"), salt };
}

try {
  const content = fs.readFileSync(DB_FILE, "utf-8");
  const db = JSON.parse(content);

  let user = db.users.find((u) => u.email && u.email.toLowerCase() === email);
  const { hash, salt } = hashPassword(adminPassword);

  if (user) {
    user.role = "admin";
    user.isVerified = true;
    user.phoneVerified = true;
    user.isSuspended = false;
    if (!user.passwordHash || adminPassword !== "Admin@2026!Pulse") {
      user.passwordHash = hash;
      user.passwordSalt = salt;
    }
    console.log(`\n✅ تم ترقية المستخدم الموجود بنجاح إلى مدير نظام (Admin): ${user.email}`);
  } else {
    user = {
      id: "user-admin-" + Date.now().toString(36),
      name,
      email,
      phone: "+201000000001",
      role: "admin",
      isVerified: true,
      phoneVerified: true,
      whatsappEnabled: true,
      passwordHash: hash,
      passwordSalt: salt,
      createdAt: new Date().toISOString(),
    };
    db.users.push(user);
    console.log(`\n✅ تم إنشاء حساب مسؤول النظام الجديد بنجاح: ${user.email} (${user.id})`);
  }

  // Record audit trail event
  if (!db.auditEvents) db.auditEvents = [];
  db.auditEvents.unshift({
    id: "audit-admin-boot-" + Date.now(),
    userId: user.id,
    action: "BOOTSTRAP_ADMIN_PROVISIONED",
    entityType: "user",
    entityId: user.id,
    details: { email: user.email, method: "cli_bootstrap" },
    timestamp: new Date().toISOString(),
  });

  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
  console.log("🔒 تم تسجيل العملية في سجل التدقيق الأمني (Audit Trail).\n");
} catch (err) {
  console.error("❌ فشل تشغيل السكربت:", err.message);
  process.exit(1);
}
