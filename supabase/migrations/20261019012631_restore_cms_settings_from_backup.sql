CREATE TABLE IF NOT EXISTS public.cms_settings (
    key VARCHAR PRIMARY KEY,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_by TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.cms_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read cms_settings" ON public.cms_settings;
CREATE POLICY "Public read cms_settings"
ON public.cms_settings FOR SELECT
TO anon, authenticated
USING (true);

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON public.cms_settings TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.cms_settings TO service_role;

INSERT INTO public.cms_settings (key, payload, updated_by, updated_at)
VALUES (
    'homepage',
    $payload${"heroBadgeText":"المنصة العقارية الموثوقة 2026","heroTitleLine1":"اكتشف عقارك المثالي على","heroTitleLine2":"خريطة تفاعلية ذكية","heroDescription":"ابحث وتنقّل بين أرقى التجمعات السكنية والمشاريع الاستثمارية في القاهرة الجديدة، الشيخ زايد، 6 أكتوبر، والعاصمة الإدارية بدقة مكانية حقيقية وتواصل مع الملاك والوسطاء المعتمدين.","heroCtaText":"استكشف الخريطة","heroCtaLink":"/explore","bannerTitle":"تصفح العقارات عبر الخريطة التفاعلية المقسمة","bannerSubtitle":"شاهد مواقع الفيلات والشقق الفعلية مع حماية خصوصية العناوين، قارن الأسعار الجغرافية لكل متر مربع وتعرّف على الخدمات والمحاور المحيطة بكل عقار في وقت حقيقي.","bannerCtaText":"فتح الخريطة التفاعلية الآن","sectionOrder":["hero","map_banner","categories","featured","recent","features"],"sectionVisibility":{"hero":true,"map_banner":true,"categories":true,"featured":true,"recent":true,"features":true},"navLabels":{"brandTitle":"نبض العقار","brandSubtitle":"AqarPulse Egypt","home":"الرئيسية","propertiesDropdown":"العقارات","sale":"بيع","rent":"إيجار","explore":"الخريطة الذكية","smartMatch":"التوافق الذكي","about":"عن منصة نبض العقار","contact":"اتصل بنا","terms":"الشروط والأحكام","privacy":"سياسة الخصوصية وأمن البيانات","addProperty":"أضف عقارك"},"visualIdentity":{"siteName":"نبض العقار","siteSubtitle":"AqarPulse Egypt","logoType":"icon_text","logoIcon":"building","logoImageUrl":"","faviconUrl":"","primaryColor":"#059669","primaryHoverColor":"#047857","secondaryColor":"#0f172a","accentColor":"#10b981","headerBackground":"glass","colorSchemePreset":"emerald_pulse","fontFamily":"cairo","headingWeight":"bold","borderRadius":"curved"},"contactPhone":"+201001234567","contactEmail":"info@aqarpulse.eg","contactWhatsApp":"+201001234567","metaTitle":"نبض العقار (AqarPulse) | المنصة العقارية الذكية والخريطة التفاعلية في مصر","metaDescription":"منصة عقارية مصرية ذكية بالخرائط التفاعلية وتحليلات الموقع وحماية الخصوصية.","featuredPropertyIds":[],"isPublished":true,"updatedAt":"2026-10-14T21:45:34.184Z","updatedBy":"مدير النظام التجريبي"}$payload$::jsonb,
    'backup-restore',
    '2026-10-14T21:45:34.184Z'::timestamptz
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.cms_settings (key, payload, updated_by, updated_at)
VALUES (
    'pages',
    $payload$[{"id":"page-about","slug":"about","titleAr":"عن نبض العقار المحدثة","contentAr":"نبض العقار (AqarPulse) هي المنصة الجغرافية الذكية الأولى في مصر المصممة للربط المباشر بين الباحثين والملاك والوسطاء العقاريين المعتمدين باستخدام أحدث تقنيات الخرائط المكانية والتحقق الموثوق.","metaTitle":"عن نبض العقار | المنصة العقارية الذكية","metaDescription":"تعرف على رؤية منصة نبض العقار وفريق العمل.","isPublished":true,"updatedAt":"2026-10-14T21:45:34.197Z","updatedBy":"مدير النظام التجريبي"},{"id":"page-contact","slug":"contact","titleAr":"اتصل بنا","contentAr":"يسعدنا تواصلكم معنا عبر البريد الإلكتروني أو الهاتف أو واتساب للإجابة على استفساراتكم وتقديم الدعم الفني.","metaTitle":"اتصل بنا | نبض العقار","metaDescription":"تواصل مع فريق دعم وخدمة عملاء نبض العقار.","isPublished":true,"updatedAt":"2026-10-14T12:46:56.194Z","updatedBy":"system"},{"id":"page-terms","slug":"terms","titleAr":"الشروط والأحكام","contentAr":"شروط الاستخدام تحدد القواعد المنظمة لنشر العقارات، التحقق من التراخيص، ومنع الإعلانات المضللة أو المكررة على المنصة.","metaTitle":"الشروط والأحكام | نبض العقار","metaDescription":"شروط وضوابط استخدام منصة نبض العقار.","isPublished":true,"updatedAt":"2026-10-14T12:46:56.194Z","updatedBy":"system"},{"id":"page-privacy","slug":"privacy","titleAr":"سياسة الخصوصية وأمن البيانات","contentAr":"نلتزم بحماية خصوصية بيانات المستخدمين وعدم إفصاح العناوين الدقيقة للمنازل إلا بعد موافقة صريحة للمالك.","metaTitle":"سياسة الخصوصية | نبض العقار","metaDescription":"سياسة حماية الخصوصية وأمن البيانات العقارية.","isPublished":true,"updatedAt":"2026-10-14T12:46:56.194Z","updatedBy":"system"}]$payload$::jsonb,
    'backup-restore',
    '2026-10-14T21:45:34.197Z'::timestamptz
)
ON CONFLICT (key) DO NOTHING;

NOTIFY pgrst, 'reload schema';