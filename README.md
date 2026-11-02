# دار العقار — منصة العقارات الذكية والخريطة التفاعلية

> **Smart Real Estate Marketplace with Interactive Geospatial Map for the Egyptian Market**

[![Next.js](https://img.shields.io/badge/Next.js-14.2.15-black.svg)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v3.4-teal.svg)](https://tailwindcss.com/)
[![Leaflet](https://img.shields.io/badge/Leaflet-1.9.4-green.svg)](https://leafletjs.com/)
[![PostGIS](https://img.shields.io/badge/PostGIS-Spatial%20Indexes-blueviolet.svg)](https://postgis.net/)
[![Tests](https://img.shields.io/badge/Tests-9%20Passing-brightgreen.svg)]()

---

## 1. نظرة عامة على النظام (System Overview)

منصة **دار العقار** هي سوق عقاري تفاعلي متقدم مصمم خصيصاً للسوق المصري لمعالجة التشتت في المعروض العقاري بين الملاك والوسطاء المستقلين، وتمكين الباحثين والمستثمرين من استكشاف العقارات مكانياً عبر **خريطة تفاعلية ذكية** مدعومة بقواعد البيانات الجغرافية.

### المزايا والركائز المعمارية
1. **واجهة عربية أصيلة (Arabic-First & RTL Native)**: مبنية بخط **Cairo** وتصميم عصري يراعي أفضل ممارسات تجربة المستخدم وقابلية التوسع مستقبلاً للإنجليزية (LTR).
2. **محرك خرائط تفاعلي ذكي (Interactive Geospatial Engine)**: شاشة منقسمة (Split-Screen) متزامنة بين الخريطة وقائمة العقارات، مع تجميع العلامات (Clustering) وتحديث البيانات تلقائياً عند تحريك مجال الرؤية (Viewport Debouncing).
3. **حماية خصوصية الموقع (Location Privacy by Design)**: خيار للمعلن لإخفاء الإحداثيات الدقيقة وعرض دائرة تقريبية بنطاق 50 مترًا. يضمن الخادم حجب الإحداثيات الدقيقة تماماً من واجهات البرمجة (Public API) لمنع تسريب العناوين الخاصة.
4. **محرك التوافق الذكي (Smart Matching Engine)**: خوارزمية قطعية (Deterministic) بدون خدمات ذكاء اصطناعي خارجية مدفوعة تحتسب نسبة التوافق (Relevance Score من 100%) وتقدم أسباباً واضحة للمستخدم (مثل: "ضمن الميزانية"، "في الحي المفضل: التجمع الخامس").
5. **مكافحة الإعلانات المكررة (Duplicate Detection Foundation)**: فحص متعدد المعايير (القرب الجغرافي < 150م، تقارب السعر، والمواصفات) لتنبيه المشرفين وحماية نزاهة السوق.
6. **إدارة دورة حياة الإعلانات (Moderation Lifecycle)**: مسودة (Draft) ➔ قيد المراجعة (Pending Review) ➔ منشور (Published) ➔ تم البيع/التأجير (Sold/Rented).
7. **سمعة ومنافسة موثوقة**: تقييم البائع بعد رد موثق في محادثة المنصة، وشارة رواج المشروع من مستخدمين فريدين أضافوه للمفضلة؛ القواعد والشارات والاعتمادات الاستثنائية قابلة للإدارة والتدقيق من لوحة التحكم.

### سياسة التقييمات والمنافسة

- لا يُقبل تقييم البائع إلا من صاحب طلب التواصل بعد رد البائع برسالة فعلية داخل المحادثة؛ لا يمكن تقييم النفس، ولكل عميل تقييم واحد لكل بائع.
- يظهر تصنيف «بائع عالي التقييم» افتراضيًا عند متوسط **4.5/5** على الأقل ووجود **5 تقييمات منشورة** على الأقل.
- يظهر تصنيف «مشروع رائج» افتراضيًا عند إضافته إلى المفضلة من **10 مستخدمين فريدين** خلال آخر **30 يومًا**؛ لا تُحتسب المشاهدات أو النقرات.
- يبدأ الترتيب بالمنافسة داخل **المنطقة ونوع النشاط**، ويمكن للمشرف تغيير نطاق المنافسة والحدود والفترة أو إيقاف التقييمات والشارات.
- تعطيل شارة البائع أو المشروع يخفيها من الخريطة ولا يوقف قوائم الترتيب؛ إيقاف تقييمات البائعين يمنع التقييمات الجديدة ويخفي ترتيب البائعين.
- تتيح صلاحية `ratings.manage` مراجعة التقييمات والبلاغات، ومنح الشارات أو إزالتها بسبب موثق، ومراجعة سجل التدقيق.
- قبل تفعيل الميزة على Supabase، طبّق الترحيل `supabase/migrations/20261020231930_ratings_reputation.sql` على المشروع المستهدف.
- خريطة المشروع تعرض دبوسه فقط؛ يطلب زر «اعرض مسار السيارة من موقعي» إذن الموقع، ثم يرسم الطريق على الخريطة. يُرسل موقع البداية لخدمة OSRM المحددة في `NEXT_PUBLIC_OSRM_ROUTING_URL` لحساب الطريق، ولا يحفظه التطبيق. العنوان الافتراضي لخدمة OSRM تجريبي؛ للإنتاج اضبط العنوان على خدمة توجيه تملكها أو تعتمدها.

---

## 2. الهيكل التقني والمكدس البرمجي (Tech Stack)

* **الواجهة الأمامية (Frontend)**: Next.js 14 (App Router)، React 18، TypeScript (Strict Mode)، Tailwind CSS، Lucide Icons.
* **محرك الخرائط (GIS & Maps)**: Leaflet مع تفريغ العلامات المخصص وعلامات الأسعار الذكية بالجنيه المصري (EGP).
* **قاعدة البيانات ونظام PostGIS**: 
* ملف DDL كامل للإنتاج: `src/lib/db/schema.sql` مدعوم بفهارس `USING GIST (location)` ويتضمن تقييمات البائعين الموثقة، إعدادات الشارات، بلاغات التقييم، واعتمادات الإدارة اليدوية.
  * محول بيانات مزدوج (Dual Engine Data Adapter): يتضمن محرك بيانات محلي مستمر ومؤمن (`.data/aqarpulse_db.json`) لتشغيل فوري بدون الحاجة لتثبيت برمجيات خارجية أثناء التطوير، مع توفر كامل سكريبتات PostGIS للإنتاج.
* **الأمان والمصادقة (Auth & Security)**: جلسات مشفرة عبر كوكيز `HttpOnly` آمنة، وحماية كاملة من الوصول غير المصرح به للعمليات الحساسة (Ownership Enforcement).

---

## 3. هيكل المجلدات والملفات (Directory Structure)

```
01 Project/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── admin/             # إحصائيات الإدارة، التقييمات والمنافسة، وسجل التدقيق
│   │   │   ├── auth/              # تسجيل الدخول، إنشاء الحساب، الجلسات، الخروج
│   │   │   ├── favorites/         # إدارة العقارات المفضلة
│   │   │   ├── ratings/           # التقييمات الموثقة وترتيب البائعين والمشاريع الرائجة
│   │   │   ├── inquiries/         # استقبال وتحديث طلبات التواصل والمعاينة
│   │   │   ├── properties/        # البحث الجغرافي، الإضافة، فحص التكرار، والتوافق الذكي
│   │   │   └── taxonomy/          # المحافظات والأحياء (القاهرة، الجيزة، العاصمة الإدارية)
│   │   ├── account/favorites/     # صفحة مفضلة المستخدم
│   │   ├── admin/                 # لوحة إدارة النظام والمراجعة وسجل العمليات
│   │   ├── dashboard/             # لوحة تحكم الملاك والوسطاء العقاريين (Listings & Leads)
│   │   ├── explore/               # الخريطة التفاعلية المتزامنة (الشاشة المنقسمة)
│   │   ├── properties/            # دليل العقارات المفلتر
│   │   │   └── [slug]/            # صفحة تفاصيل العقار، المعرض، ونموذج الطلب
│   │   ├── smart-match/           # محرك التوافق العقاري الشفاف
│   │   ├── login/ & register/     # صفحات الدخول والتسجيل
│   │   ├── privacy/ & terms/      # سياسات الخصوصية والشروط القانونية
│   │   ├── contact/               # صفحة التواصل والدعم
│   │   ├── layout.tsx             # التخطيط العام مع خط Cairo والـ Navbar والـ Footer
│   │   └── page.tsx               # الصفحة الرئيسية
│   ├── components/
│   │   ├── layout/                # شريط التنقل (Navbar) والتذييل (Footer)
│   │   ├── map/                   # مكون الخريطة التفاعلية LeafletInnerMap و PropertyMap
│   │   └── property/              # بطاقة العقار، شريط الفلاتر، ونموذج الإضافة من 6 خطوات
│   └── lib/
│       ├── auth/session.ts        # إدارة التوكن وصلاحيات الأدوار
│       └── db/
│           ├── schema.sql         # مخطط PostGIS DDL الكامل
│           ├── store.ts           # مستودع البيانات وحسابات Haversine والخصوصية
│           ├── types.ts           # عقود البيانات والأنواع البرمجية
│           ├── seed-data.ts       # بيانات العقارات المصرية الحقيقية
│           └── *.test.ts          # اختبارات الوحدة والتكامل
├── scripts/
│   └── run-tests.js              # سكريبت تشغيل الاختبارات بدون متطلبات خارجية
├── .env.example                   # ملف المتغيرات البيئية
└── package.json
```

---

## 4. تعليمات التشغيل السريع (Quickstart Commands)

### 1. تثبيت الحزم (Install Dependencies)
```bash
npm install
```

### 2. تشغيل بيئة التطوير (Run Development Server)
```bash
npm run dev
```
سيعمل التطبيق مباشرة على: `http://localhost:3000`

### 3. بناء النسخة الإنتاجية (Production Build)
```bash
npm run build
```

### 4. تشغيل خادم الإنتاج (Start Production Server)
```bash
npm start
```

### 5. تشغيل حزمة الاختبارات الآلية (Run Automated Tests)
```bash
npm test
```

---

## 5. مصفوفة الصلاحيات والحسابات التجريبية (RBAC Matrix)

يتضمن التطبيق مبدّل أدوار فوري (Demo Switcher) في الشريط العلوي لتسهيل تجربة كافة الصلاحيات:

| الدور | البريد التجريبي | الصلاحيات والواجهات المتاحة |
|---|---|---|
| **زائر (Guest)** | - | استكشاف الخريطة، البحث والتصفية، عرض العقارات، وإرسال طلبات المعاينة. |
| **باحث (Seeker)** | `ziad.seeker@aqarpulse.eg` | حفظ العقارات بالمفضلة، البحث المخصص، وتتبع طلبات التواصل. |
| **مالك عقار (Owner)** | `dr.hani@aqarpulse.eg` | إضافة وإدارة العقارات، اختيار خصوصية الموقع، واستقبال طلبات العملاء. |
| **وسيط عقاري (Broker)** | `tarek.broker@aqarpulse.eg` | إدارة المحفظة العقارية، ترخيص الوساطة، ومتابعة قنوات العملاء المحتملين. |
| **مدير النظام (Admin)** | `admin@aqarpulse.eg` | لوحة الإدارة (`/admin`)، إحصائيات النظام، اعتماد/رفض الإعلانات، وسجل التدقيق. |

---

## 6. نتائج الاختبارات الآلية المنفذة (Test Verification Results)

تم تنفيذ جميع اختبارات الوحدة والتكامل بنسبة نجاح **100%**:

```text
TAP version 13
# Subtest: Duplicate Detection flags identical location and specs as potential duplicate
ok 1 - Duplicate Detection flags identical location and specs as potential duplicate
# Subtest: Duplicate Detection allows distinct properties in different locations
ok 2 - Duplicate Detection allows distinct properties in different locations
# Subtest: haversineDistanceMeters calculates accurate distance between Cairo points
ok 3 - haversineDistanceMeters calculates accurate distance between Cairo points
# Subtest: isPointInBoundingBox accurately filters points inside/outside
ok 4 - isPointInBoundingBox accurately filters points inside/outside
# Subtest: isPointInPolygon tests polygon intersection via ray-casting
ok 5 - isPointInPolygon tests polygon intersection via ray-casting
# Subtest: calculateApproximateCoordinates creates a consistent offset without mutating raw point
ok 6 - calculateApproximateCoordinates creates a consistent offset without mutating raw point
# Subtest: Privacy Redaction: Public caller never receives raw coordinates for approximate listings
ok 7 - Privacy Redaction: Public caller never receives raw coordinates for approximate listings
# Subtest: Smart Match Engine scores properties accurately and enforces hard constraints
ok 8 - Smart Match Engine scores properties accurately and enforces hard constraints
# Subtest: Smart Match Engine rejects properties violating hard constraints
ok 9 - Smart Match Engine rejects properties violating hard constraints
1..9
# tests 9
# suites 0
# pass 9
# fail 0
```

---

## 7. إعداد قاعدة بيانات PostgreSQL + PostGIS للإنتاج

لتطبيق المخطط على خادم PostgreSQL مع إضافة PostGIS:

1. قم بإنشاء قاعدة البيانات وتفعيل الامتداد:
   ```sql
   CREATE DATABASE aqarpulse;
   \c aqarpulse;
   CREATE EXTENSION postgis;
   ```
2. نفذ ملف الـ DDL المرفق:
   ```bash
   psql -U postgres -d aqarpulse -f src/lib/db/schema.sql
   ```
3. قم بتحديث متغير `DATABASE_URL` في ملف `.env` الخاص بالإنتاج.
