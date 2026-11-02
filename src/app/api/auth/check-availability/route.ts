import { NextResponse } from "next/server";
import { dbStore } from "@/lib/db/store";
import {
  isValidEmail,
  isValidPhone,
  normalizeEgyptianPhone,
  normalizeEmail,
} from "@/lib/auth/security";
import { createClient as createSupabaseServerClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const emailParam = searchParams.get("email") || "";
    const phoneParam = searchParams.get("phone") || "";

    return await checkAvailability(emailParam, phoneParam);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "حدث خطأ أثناء فحص البيانات";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const emailParam = body.email || "";
    const phoneParam = body.phone || "";

    return await checkAvailability(emailParam, phoneParam);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "حدث خطأ أثناء فحص البيانات";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function checkAvailability(rawEmail: string, rawPhone: string) {
  let emailTaken = false;
  let emailError: string | null = null;
  let phoneTaken = false;
  let phoneError: string | null = null;

  // 1. Check Email
  if (rawEmail && rawEmail.trim().length > 0) {
    const cleanEmail = normalizeEmail(rawEmail.trim());

    if (isValidEmail(rawEmail.trim())) {
      // Local store check
      const localUser = dbStore.findUserByEmail(cleanEmail);
      if (localUser) {
        emailTaken = true;
        emailError = "البريد الإلكتروني مسجل بالفعل مسبقاً، يمكنك تسجيل الدخول به.";
      }

      // Supabase profiles check
      if (!emailTaken) {
        try {
          const supabase = createSupabaseServerClient();
          const { data: supaUser } = await supabase
            .from("profiles")
            .select("id")
            .ilike("email", cleanEmail)
            .maybeSingle();

          if (supaUser) {
            emailTaken = true;
            emailError = "البريد الإلكتروني مسجل بالفعل مسبقاً، يمكنك تسجيل الدخول به.";
          }
        } catch {
          // Non-blocking if offline
        }
      }
    }
  }

  // 2. Check Phone
  if (rawPhone && rawPhone.trim().length > 0) {
    if (isValidPhone(rawPhone)) {
      const normalizedPhone = normalizeEgyptianPhone(rawPhone);

      // Local store check
      const localUser = dbStore.findUserByPhone(normalizedPhone);
      if (localUser) {
        phoneTaken = true;
        phoneError = "رقم الهاتف مسجل بالفعل في حساب آخر. يرجى تسجيل الدخول.";
      }

      // Supabase profiles check
      if (!phoneTaken) {
        try {
          const supabase = createSupabaseServerClient();
          const { data: supaUser } = await supabase
            .from("profiles")
            .select("id")
            .or(`phone.eq.${normalizedPhone},phone.eq.${rawPhone.trim()}`)
            .maybeSingle();

          if (supaUser) {
            phoneTaken = true;
            phoneError = "رقم الهاتف مسجل بالفعل في حساب آخر. يرجى تسجيل الدخول.";
          }
        } catch {
          // Non-blocking if offline
        }
      }
    }
  }

  const available = !emailTaken && !phoneTaken;

  return NextResponse.json({
    available,
    emailTaken,
    emailError,
    phoneTaken,
    phoneError,
  });
}
