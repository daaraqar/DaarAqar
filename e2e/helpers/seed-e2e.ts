import fs from "fs";
import path from "path";
import crypto from "crypto";

export interface E2EUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "owner" | "broker" | "admin" | "buyer" | "seeker";
  isVerified: boolean;
  password: string;
}

export const E2E_USERS: Record<string, E2EUser> = {
  owner: {
    id: "usr-e2e-owner-101",
    name: "مالك تجريبي معتمد",
    email: "e2e.owner@aqarpulse.eg",
    phone: "+201099990001",
    role: "owner",
    isVerified: true,
    password: "OwnerPass123!",
  },
  unverifiedBroker: {
    id: "usr-e2e-broker-unverified-102",
    name: "وسيط تجريبي قيد الاعتماد",
    email: "e2e.unverified.broker@aqarpulse.eg",
    phone: "+201099990002",
    role: "broker",
    isVerified: false,
    password: "BrokerPass123!",
  },
  admin: {
    id: "usr-e2e-admin-103",
    name: "مشرف نظام تجريبي",
    email: "e2e.admin@aqarpulse.eg",
    phone: "+201099990003",
    role: "admin",
    isVerified: true,
    password: "AdminPass123!",
  },
  buyer: {
    id: "usr-e2e-buyer-104",
    name: "مشتري تجريبي",
    email: "e2e.buyer@aqarpulse.eg",
    phone: "+201099990004",
    role: "buyer",
    isVerified: true,
    password: "BuyerPass123!",
  },
  attacker: {
    id: "usr-e2e-attacker-105",
    name: "مستخدم غير مصرح له",
    email: "e2e.attacker@aqarpulse.eg",
    phone: "+201099990005",
    role: "buyer",
    isVerified: true,
    password: "AttackerPass123!",
  },
};

function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return { hash: derivedKey.toString("hex"), salt };
}

export function seedE2EUsers(): void {
  const dbPath =
    process.env.AQARPULSE_DB_FILE ||
    path.join(process.cwd(), ".data", "aqarpulse_db.json");
  if (!fs.existsSync(dbPath)) return;

  try {
    const content = fs.readFileSync(dbPath, "utf-8");
    const db = JSON.parse(content);
    if (!Array.isArray(db.users)) db.users = [];

    for (const key of Object.keys(E2E_USERS)) {
      const u = E2E_USERS[key];
      const existingIdx = db.users.findIndex((item: any) => item.email === u.email || item.id === u.id);
      const { hash, salt } = hashPassword(u.password);

      const record = {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        isVerified: u.isVerified,
        phoneVerified: true,
        emailVerified: true,
        isSuspended: false,
        passwordHash: hash,
        passwordSalt: salt,
        createdAt: new Date().toISOString(),
      };

      if (existingIdx >= 0) {
        db.users[existingIdx] = { ...db.users[existingIdx], ...record };
      } else {
        db.users.push(record);
      }
    }

    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to seed E2E users:", err);
  }
}

export function createE2ESessionCookie(user: E2EUser): { name: string; value: string; domain: string; path: string } {
  const secret = process.env.SESSION_SECRET || process.env.JWT_SECRET || "dev_insecure_aqarpulse_session_signing_secret_do_not_use_in_production_32chars";
  const payload = {
    userId: user.id,
    email: user.email,
    phone: user.phone,
    role: user.role,
    name: user.name,
    iat: Date.now(),
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
  };
  const jsonStr = JSON.stringify(payload);
  const payloadBase64 = Buffer.from(jsonStr).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(payloadBase64).digest("base64url");
  const value = `${payloadBase64}.${signature}`;

  return {
    name: "aqarpulse_session",
    value,
    domain: "localhost",
    path: "/",
  };
}
