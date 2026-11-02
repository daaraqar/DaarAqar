-- Seed Initial Verified Properties & Images
DO $$
DECLARE
    v_country_id UUID := 'c0000000-0000-0000-0000-000000000001'::uuid;
    v_cairo_id UUID := 'c1000000-0000-0000-0000-000000000001'::uuid;
    v_giza_id UUID := 'c2000000-0000-0000-0000-000000000002'::uuid;
    v_new_cairo_id UUID := 'd1000000-0000-0000-0000-000000000001'::uuid;
    v_zayed_id UUID := 'd2000000-0000-0000-0000-000000000002'::uuid;
    v_october_id UUID := 'd3000000-0000-0000-0000-000000000003'::uuid;
    v_nac_id UUID := 'd4000000-0000-0000-0000-000000000004'::uuid;
    v_demo_user_id UUID := 'a0000000-0000-0000-0000-000000000001'::uuid;
    
    v_prop1_id UUID := 'e1000000-0000-0000-0000-000000000001'::uuid;
    v_prop2_id UUID := 'e2000000-0000-0000-0000-000000000002'::uuid;
    v_prop3_id UUID := 'e3000000-0000-0000-0000-000000000003'::uuid;
    v_prop4_id UUID := 'e4000000-0000-0000-0000-000000000004'::uuid;
    v_prop5_id UUID := 'e5000000-0000-0000-0000-000000000005'::uuid;
    v_prop6_id UUID := 'e6000000-0000-0000-0000-000000000006'::uuid;
BEGIN
    -- Country: Egypt
    INSERT INTO public.countries (id, iso_code, name_ar, name_en, currency_code)
    VALUES (v_country_id, 'EG', 'جمهورية مصر العربية', 'Egypt', 'EGP')
    ON CONFLICT (iso_code) DO NOTHING;

    -- Cities: Cairo & Giza
    INSERT INTO public.cities (id, country_id, slug, name_ar, name_en, center_location, zoom_level)
    VALUES 
        (v_cairo_id, v_country_id, 'cairo', 'القاهرة', 'Cairo', ST_SetSRID(ST_MakePoint(31.2357, 30.0444), 4326)::geography, 12),
        (v_giza_id, v_country_id, 'giza', 'الجيزة', 'Giza', ST_SetSRID(ST_MakePoint(31.1303, 29.9870), 4326)::geography, 12)
    ON CONFLICT (slug) DO NOTHING;

    -- Districts: New Cairo, Sheikh Zayed, 6th of October, NAC
    INSERT INTO public.districts (id, city_id, slug, name_ar, name_en, center_location)
    VALUES 
        (v_new_cairo_id, v_cairo_id, 'new-cairo', 'القاهرة الجديدة (التجمع الخامس)', 'New Cairo (Fifth Settlement)', ST_SetSRID(ST_MakePoint(31.4700, 30.0200), 4326)::geography),
        (v_zayed_id, v_giza_id, 'sheikh-zayed', 'الشيخ زايد', 'Sheikh Zayed City', ST_SetSRID(ST_MakePoint(30.9800, 30.0500), 4326)::geography),
        (v_october_id, v_giza_id, '6th-october', 'السادس من أكتوبر', '6th of October City', ST_SetSRID(ST_MakePoint(30.9300, 29.9700), 4326)::geography),
        (v_nac_id, v_cairo_id, 'new-capital', 'العاصمة الإدارية الجديدة', 'New Administrative Capital', ST_SetSRID(ST_MakePoint(31.7500, 30.0100), 4326)::geography)
    ON CONFLICT (city_id, slug) DO NOTHING;

    -- Demo Advertiser Profile
    INSERT INTO public.profiles (id, name, email, phone, role, is_verified, company_name)
    VALUES (
        v_demo_user_id,
        'طارق الشناوي (مستشار عقاري معتمد)',
        'tarek.broker@aqarpulse.eg',
        '+201012345678',
        'broker',
        TRUE,
        'الشناوي للاستشارات العقارية'
    )
    ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        role = EXCLUDED.role;

    -- Listing 1: Villa in New Cairo (Exact Location)
    INSERT INTO public.properties (
        id, slug, title, description, transaction_type, category, price, currency,
        area_sqm, bedrooms, bathrooms, floor, total_floors, finishing_status, furnishing_status,
        city_id, district_id, address_details, exact_lat, exact_lng, location_privacy,
        status, featured, views_count, inquiries_count, advertiser_id, advertiser_type,
        published_at
    ) VALUES (
        v_prop1_id,
        'luxury-stand-alone-villa-palm-hills-new-cairo',
        'فيلا مستقلة فاخرة مطلة على البحيرة في بالم هيلز التجمع الخامس',
        'فيلا استثنائية بتشطيب ألترا سوبر لوكس وإطلالة مباشرة على البحيرات والمساحات الخضراء. تضم حديقة خاصة بمساحة 450 م² مع حمام سباحة خاص مدفأ.',
        'sale', 'villa', 28500000, 'EGP',
        520, 5, 6, 1, 3, 'ultra_lux', 'unfurnished',
        v_cairo_id, v_new_cairo_id, 'كمبوند بالم هيلز كاتيجي، التجمع الخامس، القاهرة الجديدة',
        30.0145, 31.4892, 'exact',
        'published', TRUE, 420, 18, v_demo_user_id, 'broker',
        NOW()
    ) ON CONFLICT (slug) DO UPDATE SET
        status = 'published';

    -- Listing 2: Luxury Apartment in Sheikh Zayed (Approximate Location)
    INSERT INTO public.properties (
        id, slug, title, description, transaction_type, category, price, currency,
        rental_period, area_sqm, bedrooms, bathrooms, floor, total_floors, finishing_status, furnishing_status,
        city_id, district_id, address_details, exact_lat, exact_lng, approximate_lat, approximate_lng, location_privacy,
        status, featured, views_count, inquiries_count, advertiser_id, advertiser_type,
        published_at
    ) VALUES (
        v_prop2_id,
        'modern-apartment-sheikh-zayed-beverly-hills',
        'شقة فندقية مودرن مفروشة بالكامل في قلب الشيخ زايد',
        'شقة فندقية راقية جداً في أرقى مناطق الشيخ زايد بالقرب من أركان بلازا والممشى السياحي. مكيفة بالكامل مع شرفة بانورامية رائعة.',
        'rent', 'apartment', 45000, 'EGP',
        'monthly', 185, 3, 2, 3, 5, 'ultra_lux', 'furnished',
        v_giza_id, v_zayed_id, 'الشيخ زايد، الحي التاسع بالقرب من بيفرلي هيلز',
        30.0482, 30.9855, 30.0510, 30.9880, 'approximate',
        'published', TRUE, 310, 12, v_demo_user_id, 'broker',
        NOW()
    ) ON CONFLICT (slug) DO UPDATE SET
        status = 'published';

    -- Listing 3: Duplex in New Cairo Golden Square (Exact Location)
    INSERT INTO public.properties (
        id, slug, title, description, transaction_type, category, price, currency,
        down_payment, installment_years, area_sqm, bedrooms, bathrooms, floor, total_floors, finishing_status, furnishing_status,
        city_id, district_id, address_details, exact_lat, exact_lng, location_privacy,
        status, featured, views_count, inquiries_count, advertiser_id, advertiser_type,
        published_at
    ) VALUES (
        v_prop3_id,
        'penthouse-duplex-golden-square-fifth-settlement',
        'دوبلكس بنتهاوس مع رووف خاص في الجولدن سكوير التجمع',
        'دوبلكس مساحة 310 م² بالإضافة إلى رووف خاص 90 م² مع جاكوزي خارجي وإطلالة مفتوحة 360 درجة. موقع استراتيجي على بعد دقيقتين من شارع التسعين الشمالي.',
        'sale', 'duplex', 14200000, 'EGP',
        2500000, 6, 310, 4, 4, 4, 5, 'fully_finished', 'unfurnished',
        v_cairo_id, v_new_cairo_id, 'المربع الذهبي، بالقرب من الجامعة الأمريكية وكمبوند ميفيدا',
        30.0310, 31.4720, 'exact',
        'published', FALSE, 280, 8, v_demo_user_id, 'broker',
        NOW()
    ) ON CONFLICT (slug) DO UPDATE SET
        status = 'published';

    -- Listing 4: Prime Office in New Administrative Capital (Exact Location)
    INSERT INTO public.properties (
        id, slug, title, description, transaction_type, category, price, currency,
        down_payment, installment_years, area_sqm, bedrooms, bathrooms, floor, total_floors, finishing_status, furnishing_status,
        city_id, district_id, address_details, exact_lat, exact_lng, location_privacy,
        status, featured, views_count, inquiries_count, advertiser_id, advertiser_type,
        published_at
    ) VALUES (
        v_prop4_id,
        'prime-administrative-office-central-business-district-nac',
        'مكتب إداري بالبرج الأيقوني في منطقة الأعمال المركزية CBD العاصمة الإدارية',
        'مكتب استثماري بإطلالة مباشرة على النهر الأخضر والبرج الأيقوني. موقع عالمي مجهز بأحدث البنية التحتية الذكية.',
        'sale', 'office', 8900000, 'EGP',
        890000, 7, 120, 0, 1, 14, 30, 'fully_finished', 'unfurnished',
        v_cairo_id, v_nac_id, 'منطقة الأعمال المركزية CBD، العاصمة الإدارية الجديدة',
        30.0150, 31.7450, 'exact',
        'published', TRUE, 560, 24, v_demo_user_id, 'broker',
        NOW()
    ) ON CONFLICT (slug) DO UPDATE SET
        status = 'published';

    -- Listing 5: Family Apartment in 6th of October (Approximate Location)
    INSERT INTO public.properties (
        id, slug, title, description, transaction_type, category, price, currency,
        area_sqm, bedrooms, bathrooms, floor, total_floors, finishing_status, furnishing_status,
        city_id, district_id, address_details, exact_lat, exact_lng, approximate_lat, approximate_lng, location_privacy,
        status, featured, views_count, inquiries_count, advertiser_id, advertiser_type,
        published_at
    ) VALUES (
        v_prop5_id,
        'family-apartment-october-near-mall-of-arabia',
        'شقة عائلية بحري في 6 أكتوبر بالقرب من مول العرب ونادي الصيد',
        'شقة مساحة 200 م² بواجهة بحرية تامة غير مجروحة. موقع هادئ وراقي قريب جداً من المحور المركزي وجامعة مصر.',
        'sale', 'apartment', 5400000, 'EGP',
        200, 3, 3, 2, 4, 'fully_finished', 'unfurnished',
        v_giza_id, v_october_id, 'مدينة 6 أكتوبر، الحي المتميز خلف مول العرب',
        29.9820, 30.9350, 29.9850, 30.9380, 'approximate',
        'published', FALSE, 195, 6, v_demo_user_id, 'broker',
        NOW()
    ) ON CONFLICT (slug) DO UPDATE SET
        status = 'published';

    -- Listing 6: Twin House in Sheikh Zayed (Exact Location)
    INSERT INTO public.properties (
        id, slug, title, description, transaction_type, category, price, currency,
        rental_period, area_sqm, bedrooms, bathrooms, floor, total_floors, finishing_status, furnishing_status,
        city_id, district_id, address_details, exact_lat, exact_lng, location_privacy,
        status, featured, views_count, inquiries_count, advertiser_id, advertiser_type,
        published_at
    ) VALUES (
        v_prop6_id,
        'twin-house-villa-sheikh-zayed-allegria',
        'توين هاوس للإيجار السنوي بكمبوند أليجريا الشيخ زايد مع حديقة واسعة',
        'توين هاوس تشطيب كامل راقي جداً بإطلالة مفتوحة على ملاعب الجولف العالمية. متاح للإيجار السكني الدبلوماسي أو العائلي الراقي.',
        'rent', 'twin_house', 75000, 'EGP',
        'monthly', 340, 4, 4, 1, 2, 'ultra_lux', 'semi_furnished',
        v_giza_id, v_zayed_id, 'كمبوند أليجريا، الشيخ زايد، محافظة الجيزة',
        30.0610, 30.9710, 'exact',
        'published', TRUE, 380, 15, v_demo_user_id, 'broker',
        NOW()
    ) ON CONFLICT (slug) DO UPDATE SET
        status = 'published';

    -- 5. Property Images Links
    INSERT INTO public.property_images (property_id, url, alt, is_main, sort_order)
    VALUES
        (v_prop1_id, 'https://images.unsplash.com/photo-1613977257363-707ba9348227?w=1200&q=80', 'واجهة الفيلا الفاخرة بالم هيلز', TRUE, 0),
        (v_prop1_id, 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&q=80', 'حمام السباحة والحديقة الخاصة', FALSE, 1),
        (v_prop2_id, 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200&q=80', 'غرفة المعيشة الفندقية في الشيخ زايد', TRUE, 0),
        (v_prop2_id, 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&q=80', 'غرفة النوم الرئيسية', FALSE, 1),
        (v_prop3_id, 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80', 'دوبلكس بنتهاوس التجمع الخامس', TRUE, 0),
        (v_prop4_id, 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80', 'المكتب الإداري بالعاصمة الإدارية', TRUE, 0),
        (v_prop5_id, 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200&q=80', 'شقة عائلية 6 أكتوبر', TRUE, 0),
        (v_prop6_id, 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=80', 'توين هاوس أليجريا الشيخ زايد', TRUE, 0)
    ON CONFLICT DO NOTHING;

END $$;
