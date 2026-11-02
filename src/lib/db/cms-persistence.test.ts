import test from "node:test";
import assert from "node:assert/strict";
import { dbStore } from "./store";
import type { CmsHomepageSettings, CmsStaticPage, User } from "./types";

test("CMS settings and pages persist through the central settings table", async () => {
  const originalFetch = globalThis.fetch;
  const previousSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const rows = new Map<string, { payload: unknown }>();
  let failWrites = false;
  let failReads = false;
  let missingCmsTable = false;
  const defaultHomepage = dbStore.getCmsHomepageSettings();
  const defaultPages = dbStore.getCmsPages();
  rows.set("homepage", { payload: defaultHomepage });
  rows.set("pages", { payload: defaultPages });
  rows.set("media-assets", { payload: [] });

  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://cms-test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "cms-test-service-key";
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl = input instanceof Request ? input.url : String(input);
    const url = new URL(requestUrl);
    const method = init?.method || "GET";

    if (url.pathname.endsWith("/rest/v1/cms_settings") && method === "GET") {
      if (missingCmsTable) {
        return new Response(JSON.stringify({
          code: "PGRST205",
          message: "Could not find the table 'public.cms_settings' in the schema cache",
        }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (failReads) {
        return new Response(JSON.stringify({ message: "simulated database outage" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        });
      }
      const key = url.searchParams.get("key")?.replace(/^eq\./, "") || "";
      const row = rows.get(key);
      return new Response(JSON.stringify(row || null), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname.endsWith("/rest/v1/cms_settings") && method === "POST") {
      if (failWrites) {
        return new Response(JSON.stringify({ message: "simulated database outage" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        });
      }
      const value = JSON.parse(String(init?.body)) as { key: string; payload: unknown };
      rows.set(value.key, { payload: value.payload });
      return new Response(null, { status: 204 });
    }

    throw new Error(`Unexpected CMS persistence request: ${method} ${url.pathname}`);
  }) as typeof fetch;

  try {
    const admin: User = {
      id: "cms-test-admin",
      name: "CMS test administrator",
      phone: "+201000000000",
      role: "admin",
      isVerified: true,
      createdAt: new Date().toISOString(),
    };

    const legacyHomepage = structuredClone(defaultHomepage);
    legacyHomepage.visualIdentity = {
      ...legacyHomepage.visualIdentity!,
      siteName: "نبض العقار",
      siteSubtitle: "AqarPulse Egypt",
      logoType: "icon_text",
      logoImageUrl: "",
      headerBackground: "glass",
    };
    legacyHomepage.navLabels = {
      ...legacyHomepage.navLabels,
      brandTitle: "نبض العقار",
      brandSubtitle: "AqarPulse Egypt",
      about: "عن منصة نبض العقار",
    };
    rows.set("homepage", { payload: legacyHomepage });
    const rebrandedHomepage = await dbStore.getCmsHomepageSettingsAsync();
    assert.equal(rebrandedHomepage.visualIdentity?.siteName, "دار العقار");
    assert.equal(rebrandedHomepage.visualIdentity?.logoType, "image");
    assert.equal(rebrandedHomepage.visualIdentity?.logoImageUrl, "/branding/dar-al-aqar.png");
    assert.equal(rebrandedHomepage.visualIdentity?.headerBackground, "white");
    assert.equal(rebrandedHomepage.navLabels?.about, "عن منصة دار العقار");
    rows.set("homepage", { payload: defaultHomepage });

    rows.set("pages", {
      payload: defaultPages.map((page) => ({
        ...page,
        titleAr: page.slug === "about" ? "عن منصة نبض العقار" : page.titleAr,
      })),
    });
    assert.equal((await dbStore.getCmsPageAsync("about"))?.titleAr, "عن منصة دار العقار");
    rows.set("pages", { payload: defaultPages });

    const updatedHomepage = await dbStore.updateCmsHomepageSettingsAsync(
      {
        visualIdentity: {
          ...defaultHomepage.visualIdentity!,
          primaryColor: "#123456",
          primaryHoverColor: "#234567",
          secondaryColor: "#345678",
          accentColor: "#abcdef",
          iconColor: "#112233",
          mapIconColor: "#445566",
          logoHeightPx: 64,
          colorSchemePreset: "custom",
          headingWeight: "extrabold",
        },
        navLabels: {
          propertiesDropdown: "كل العقارات",
          smartMatch: "الاختيار الذكي",
        },
      },
      admin
    );
    assert.equal(updatedHomepage.visualIdentity?.primaryColor, "#123456");
    assert.equal(updatedHomepage.visualIdentity?.primaryHoverColor, "#234567");
    assert.equal(updatedHomepage.visualIdentity?.secondaryColor, "#345678");
    assert.equal(updatedHomepage.visualIdentity?.accentColor, "#abcdef");
    assert.equal(updatedHomepage.visualIdentity?.iconColor, "#112233");
    assert.equal(updatedHomepage.visualIdentity?.mapIconColor, "#445566");
    assert.equal(updatedHomepage.visualIdentity?.logoHeightPx, 64);
    assert.equal(updatedHomepage.visualIdentity?.headingWeight, "extrabold");
    await assert.rejects(
      () => dbStore.updateCmsHomepageSettingsAsync(
        { visualIdentity: { ...updatedHomepage.visualIdentity!, mapIconColor: "green" } },
        admin
      ),
      /ألوان الهوية يجب أن تكون بصيغة HEX/
    );
    assert.equal(updatedHomepage.navLabels?.propertiesDropdown, "كل العقارات");
    assert.equal(updatedHomepage.navLabels?.smartMatch, "الاختيار الذكي");
    assert.equal(
      (rows.get("homepage")?.payload as CmsHomepageSettings).visualIdentity?.primaryColor,
      "#123456"
    );
    assert.equal((await dbStore.getCmsHomepageSettingsAsync()).visualIdentity?.primaryColor, "#123456");
    assert.equal((await dbStore.getCmsHomepageSettingsForAdminAsync()).persistenceAvailable, true);

    failWrites = true;
    await assert.rejects(
      () => dbStore.updateCmsHomepageSettingsAsync({ heroTitleLine1: "تعديل غير محفوظ" }, admin),
      /CENTRAL_DB_ERROR/
    );
    assert.notEqual((await dbStore.getCmsHomepageSettingsAsync()).heroTitleLine1, "تعديل غير محفوظ");
    failWrites = false;

    const updatedPage = await dbStore.updateCmsPageAsync(
      "about",
      { titleAr: "صفحة تعريفية محفوظة" },
      admin
    );
    assert.equal(updatedPage.titleAr, "صفحة تعريفية محفوظة");
    const persistedPages = rows.get("pages")?.payload as CmsStaticPage[];
    assert.equal(persistedPages.find((page) => page.slug === "about")?.titleAr, "صفحة تعريفية محفوظة");
    assert.equal((await dbStore.getCmsPageAsync("about"))?.titleAr, "صفحة تعريفية محفوظة");

    const asset = await dbStore.addCmsMediaAssetAsync({
      url: "https://example.com/cms-logo.png",
      altText: "CMS test logo",
      fileName: "cms-logo.png",
      mimeType: "image/png",
      fileSizeBytes: 1024,
      uploadedBy: admin.name,
    });
    assert.equal((rows.get("media-assets")?.payload as Array<{ id: string }>)[0].id, asset.id);
    await dbStore.deleteCmsMediaAssetAsync(asset.id, admin);
    assert.deepEqual(rows.get("media-assets")?.payload, []);

    const previousConsoleError = console.error;
    let renderingErrorLogged = false;
    console.error = (...args: unknown[]) => {
      if (String(args[0]).includes("Failed to load homepage settings for rendering")) {
        renderingErrorLogged = true;
      }
    };
    try {
      failReads = true;
      const fallbackSettings = await dbStore.getCmsHomepageSettingsForDisplayAsync();
      assert.equal(fallbackSettings.visualIdentity?.primaryColor, "#123456");
      const adminSettings = await dbStore.getCmsHomepageSettingsForAdminAsync();
      assert.equal(adminSettings.persistenceAvailable, false);
      assert.equal(adminSettings.settings.visualIdentity?.primaryColor, "#123456");
      assert.equal(renderingErrorLogged, true);

      failReads = false;
      missingCmsTable = true;
      const missingTableSettings = await dbStore.getCmsHomepageSettingsForAdminAsync();
      assert.equal(missingTableSettings.persistenceAvailable, false);
      assert.equal(missingTableSettings.settings.visualIdentity?.primaryColor, "#123456");
      assert.match(missingTableSettings.error ?? "", /public\.cms_settings/);
      assert.match(missingTableSettings.error ?? "", /20261019012631_restore_cms_settings_from_backup\.sql/);
    } finally {
      failReads = false;
      missingCmsTable = false;
      console.error = previousConsoleError;
    }
  } finally {
    globalThis.fetch = originalFetch;
    if (previousSupabaseUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousSupabaseUrl;
    if (previousServiceKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousServiceKey;
  }
});
