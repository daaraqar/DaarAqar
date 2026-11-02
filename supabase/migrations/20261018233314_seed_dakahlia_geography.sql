INSERT INTO public.cities (
    country_id,
    slug,
    name_ar,
    name_en,
    center_location,
    zoom_level
)
SELECT
    id,
    'dakahlia',
    'مركز ميت غمر',
    'Meet Ghamr',
    ST_SetSRID(ST_MakePoint(31.2580, 30.7194), 4326)::geography,
    13
FROM public.countries
WHERE iso_code = 'EG'
ON CONFLICT (slug) DO UPDATE SET
    name_ar = EXCLUDED.name_ar,
    name_en = EXCLUDED.name_en,
    center_location = EXCLUDED.center_location,
    zoom_level = EXCLUDED.zoom_level;

DO $$
DECLARE
    v_city_id UUID;
BEGIN
    SELECT id INTO v_city_id
    FROM public.cities
    WHERE slug = 'dakahlia';

    IF v_city_id IS NULL THEN
        RAISE EXCEPTION 'Cannot seed Meet Ghamr districts because the city record is missing';
    END IF;

    INSERT INTO public.districts (city_id, slug, name_ar, name_en, center_location)
    VALUES
        (v_city_id, 'meet-ghamr-city', 'مدينة ميت غمر (المركز)', 'Meet Ghamr City', ST_SetSRID(ST_MakePoint(31.2580, 30.7194), 4326)::geography),
        (v_city_id, 'daqados', 'دقادوس', 'Daqados', ST_SetSRID(ST_MakePoint(31.2650, 30.7280), 4326)::geography),
        (v_city_id, 'tafahna-al-ashraf', 'تفهنا الأشراف', 'Tafahna Al-Ashraf', ST_SetSRID(ST_MakePoint(31.2400, 30.7450), 4326)::geography),
        (v_city_id, 'damas', 'دماص', 'Damas', ST_SetSRID(ST_MakePoint(31.3300, 30.7800), 4326)::geography),
        (v_city_id, 'sehregt-kobra', 'صهرجت الكبرى', 'Sehregt El Kobra', ST_SetSRID(ST_MakePoint(31.2900, 30.6800), 4326)::geography),
        (v_city_id, 'atmida', 'أتميدة', 'Atmida', ST_SetSRID(ST_MakePoint(31.3600, 30.7600), 4326)::geography),
        (v_city_id, 'kom-el-nour', 'كوم النور', 'Kom El Nour', ST_SetSRID(ST_MakePoint(31.3400, 30.7400), 4326)::geography),
        (v_city_id, 'beshla', 'بشلا', 'Beshla', ST_SetSRID(ST_MakePoint(31.3100, 30.7300), 4326)::geography),
        (v_city_id, 'dandit', 'دنديط', 'Dandit', ST_SetSRID(ST_MakePoint(31.3300, 30.6900), 4326)::geography),
        (v_city_id, 'awleela', 'أوليلة', 'Awleela', ST_SetSRID(ST_MakePoint(31.3500, 30.7100), 4326)::geography),
        (v_city_id, 'sanfa', 'سنفا', 'Sanfa', ST_SetSRID(ST_MakePoint(31.3000, 30.7500), 4326)::geography),
        (v_city_id, 'meet-yaeish', 'ميت يعيش', 'Meet Yaeish', ST_SetSRID(ST_MakePoint(31.2800, 30.6700), 4326)::geography),
        (v_city_id, 'meet-abou-khaled', 'ميت أبو خالد', 'Meet Abou Khaled', ST_SetSRID(ST_MakePoint(31.3200, 30.6600), 4326)::geography),
        (v_city_id, 'meet-el-faramawy', 'ميت الفرماوي', 'Meet El Faramawy', ST_SetSRID(ST_MakePoint(31.3500, 30.7700), 4326)::geography),
        (v_city_id, 'meet-el-qorashi', 'ميت القرشي', 'Meet El Qorashi', ST_SetSRID(ST_MakePoint(31.2900, 30.7000), 4326)::geography),
        (v_city_id, 'meet-mohsen', 'ميت محسن', 'Meet Mohsen', ST_SetSRID(ST_MakePoint(31.2800, 30.7300), 4326)::geography),
        (v_city_id, 'meet-el-ezz', 'ميت العز', 'Meet El Ezz', ST_SetSRID(ST_MakePoint(31.2700, 30.7500), 4326)::geography),
        (v_city_id, 'meet-nagy', 'ميت ناجي', 'Meet Nagy', ST_SetSRID(ST_MakePoint(31.3100, 30.6900), 4326)::geography),
        (v_city_id, 'hala', 'هلا', 'Hala', ST_SetSRID(ST_MakePoint(31.2900, 30.7100), 4326)::geography),
        (v_city_id, 'serenga', 'سرنجا', 'Serenga', ST_SetSRID(ST_MakePoint(31.3200, 30.7600), 4326)::geography),
        (v_city_id, 'sanbo-maqam', 'سنبو مقام', 'Sanbo Maqam', ST_SetSRID(ST_MakePoint(31.2800, 30.7400), 4326)::geography),
        (v_city_id, 'santmay', 'سنتماي', 'Santmay', ST_SetSRID(ST_MakePoint(31.3000, 30.7700), 4326)::geography),
        (v_city_id, 'bachaloch', 'بشالوش', 'Bachaloch', ST_SetSRID(ST_MakePoint(31.2900, 30.7200), 4326)::geography),
        (v_city_id, 'el-bouha', 'البوها', 'El Bouha', ST_SetSRID(ST_MakePoint(31.3800, 30.7600), 4326)::geography),
        (v_city_id, 'behida', 'بهيدة', 'Behida', ST_SetSRID(ST_MakePoint(31.3700, 30.7500), 4326)::geography),
        (v_city_id, 'gasfa', 'جصفا', 'Gasfa', ST_SetSRID(ST_MakePoint(31.3100, 30.6800), 4326)::geography),
        (v_city_id, 'kafr-el-miqdam', 'كفر المقدام', 'Kafr El Miqdam', ST_SetSRID(ST_MakePoint(31.2700, 30.6900), 4326)::geography),
        (v_city_id, 'kafr-serenga', 'كفر سرنجا', 'Kafr Serenga', ST_SetSRID(ST_MakePoint(31.3250, 30.7650), 4326)::geography),
        (v_city_id, 'kafr-el-shahid', 'كفر الشهيد', 'Kafr El Shahid', ST_SetSRID(ST_MakePoint(31.2750, 30.7150), 4326)::geography),
        (v_city_id, 'kafr-el-wazir', 'كفر الوزير', 'Kafr El Wazir', ST_SetSRID(ST_MakePoint(31.3600, 30.7400), 4326)::geography),
        (v_city_id, 'kafr-behida', 'كفر بهيدة', 'Kafr Behida', ST_SetSRID(ST_MakePoint(31.3750, 30.7550), 4326)::geography),
        (v_city_id, 'kafr-noaman', 'كفر نعمان', 'Kafr Noaman', ST_SetSRID(ST_MakePoint(31.3400, 30.7850), 4326)::geography),
        (v_city_id, 'kafr-el-naeem', 'كفر النعيم', 'Kafr El Naeem', ST_SetSRID(ST_MakePoint(31.3150, 30.7750), 4326)::geography),
        (v_city_id, 'kafr-el-mohamadeya', 'كفر المحمدية', 'Kafr El Mohamadeya', ST_SetSRID(ST_MakePoint(31.3050, 30.7050), 4326)::geography),
        (v_city_id, 'kafr-el-sheikh-helal', 'كفر الشيخ هلال', 'Kafr El Sheikh Helal', ST_SetSRID(ST_MakePoint(31.3400, 30.7250), 4326)::geography),
        (v_city_id, 'kofour-el-behaita', 'كفور البهايتة', 'Kofour El Behaita', ST_SetSRID(ST_MakePoint(31.3700, 30.7350), 4326)::geography),
        (v_city_id, 'kafr-abou-nabhan', 'كفر أبو نبهان', 'Kafr Abou Nabhan', ST_SetSRID(ST_MakePoint(31.2600, 30.7100), 4326)::geography),
        (v_city_id, 'kafr-ibrahim-youssef', 'كفر إبراهيم يوسف', 'Kafr Ibrahim Youssef', ST_SetSRID(ST_MakePoint(31.3300, 30.7200), 4326)::geography),
        (v_city_id, 'kafr-attallah-soliman', 'كفر عطا الله سليمان', 'Kafr Attallah Soliman', ST_SetSRID(ST_MakePoint(31.2950, 30.6950), 4326)::geography),
        (v_city_id, 'kafr-ali-abdullah', 'كفر علي عبد الله', 'Kafr Ali Abdullah', ST_SetSRID(ST_MakePoint(31.3150, 30.7050), 4326)::geography)
    ON CONFLICT (city_id, slug) DO UPDATE SET
        name_ar = EXCLUDED.name_ar,
        name_en = EXCLUDED.name_en,
        center_location = EXCLUDED.center_location;
END $$;