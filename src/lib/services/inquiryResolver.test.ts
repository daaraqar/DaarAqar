import test from "node:test";
import assert from "node:assert/strict";
import { isCentralDbEnabled } from "./inquiryResolver";

test("Inquiry chat requires the server-only Supabase service role key", () => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const previousPublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const previousAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  try {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test-project.supabase.co";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-publishable-key";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

    assert.equal(
      isCentralDbEnabled(),
      false,
      "Public client keys must not enable server-side inquiry persistence"
    );

    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
    assert.equal(isCentralDbEnabled(), true);

    process.env.SUPABASE_SERVICE_ROLE_KEY = "your_supabase_service_role_key_here";
    assert.equal(isCentralDbEnabled(), false, "Placeholder service keys are not configuration");
  } finally {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousServiceKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousServiceKey;
    if (previousPublishableKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = previousPublishableKey;
    if (previousAnonKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousAnonKey;
  }
});
