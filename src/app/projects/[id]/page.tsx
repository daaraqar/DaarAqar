import React from "react";
import { notFound } from "next/navigation";
import ProjectShowcaseView, { DEFAULT_OWJ_KHOBAR_PROJECT, ProjectShowcaseData } from "@/components/project/ProjectShowcaseView";
import { dbStore } from "@/lib/db/store";
import { createClient as createSupabaseServerClient } from "@/utils/supabase/server";
import {
  MEET_GHAMR_CITY_SLUG,
  MEET_GHAMR_DISTRICT_SLUGS,
  isMeetGhamrCity,
  resolveMeetGhamrDistrictSlug,
} from "@/lib/db/meet-ghamr-geography";

export const dynamic = "force-dynamic";

interface ProjectPageProps {
  params: {
    id: string;
  };
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const projectId = params.id;

  // 1. Use the in-scope example project for empty/default routes.
  if (projectId === "meet-ghamr-sample" || projectId === "owj-khobar" || projectId === "default") {
    return <ProjectShowcaseView project={DEFAULT_OWJ_KHOBAR_PROJECT} />;
  }

  // 2. Fetch from local store or Supabase cloud
  let projectData: ProjectShowcaseData = { ...DEFAULT_OWJ_KHOBAR_PROJECT, id: projectId };
  let isSoldProject = false;

  try {
    const localProp = dbStore.getRawPropertyById(projectId);
    if (
      localProp &&
      isMeetGhamrCity(localProp.cityId) &&
      resolveMeetGhamrDistrictSlug(localProp.districtId) &&
      localProp.status === "sold"
    ) {
      isSoldProject = true;
    } else if (
      localProp &&
      isMeetGhamrCity(localProp.cityId) &&
      resolveMeetGhamrDistrictSlug(localProp.districtId)
    ) {
      projectData = {
        id: localProp.id,
        title: localProp.title,
        status: localProp.status,
        developerName: (localProp as any).developerName || "مطور معتمد",
        developerLogo: (localProp as any).developerLogo || "https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=100&q=80",
        locationText: localProp.addressDetails || "مركز ميت غمر، الدقهلية",
        city: "مركز ميت غمر",
        lat: localProp.lat || 30.7194,
        lng: localProp.lng || 31.258,
        tags: (localProp as any).projectDetails?.tags || (localProp.amenities?.length ? localProp.amenities.slice(0, 4) : ["متاح", "وحدات جاهزة", "مكاتب للإيجار", "محل للإيجار"]),
        totalUnitsCount: (localProp as any).projectDetails?.totalUnitsCount || 18,
        minAreaSqM: (localProp as any).projectDetails?.minAreaSqM || localProp.areaSqM || 325,
        maxAreaSqM: (localProp as any).projectDetails?.maxAreaSqM || 2100,
        minPrice: (localProp as any).projectDetails?.minPrice || localProp.price || 70000,
        maxPrice: (localProp as any).projectDetails?.maxPrice || (localProp.price ? localProp.price * 3 : 290000),
        currency: "جنيه مصري",
        description: localProp.description || DEFAULT_OWJ_KHOBAR_PROJECT.description,
        amenities: localProp.amenities && localProp.amenities.length > 0
          ? localProp.amenities.map((a: string) => ({ key: a, label: a }))
          : DEFAULT_OWJ_KHOBAR_PROJECT.amenities,
        nearbyLandmarks: (localProp as any).projectDetails?.nearbyLandmarks || DEFAULT_OWJ_KHOBAR_PROJECT.nearbyLandmarks,
        images: localProp.images && localProp.images.length > 0 ? localProp.images : DEFAULT_OWJ_KHOBAR_PROJECT.images,
        subUnits: (localProp as any).projectDetails?.subUnits || DEFAULT_OWJ_KHOBAR_PROJECT.subUnits,
      };
    } else {
      // Check cloud database
      const supabase = createSupabaseServerClient();
      const { data: city } = await supabase
        .from("cities")
        .select("id")
        .eq("slug", MEET_GHAMR_CITY_SLUG)
        .maybeSingle();
      const { data: districts } = city
        ? await supabase
            .from("districts")
            .select("id")
            .eq("city_id", city.id)
            .in("slug", MEET_GHAMR_DISTRICT_SLUGS)
        : { data: [] };
      const { data: cloudProp } = city && districts?.length
        ? await supabase
            .from("properties")
            .select(`*, property_images(url)`)
            .eq("id", projectId)
            .eq("city_id", city.id)
            .in("district_id", districts.map((district) => district.id))
            .maybeSingle()
        : { data: null };

      if (cloudProp?.status === "sold") {
        isSoldProject = true;
      } else if (cloudProp) {
        const imgs = Array.isArray(cloudProp.property_images) && cloudProp.property_images.length > 0
          ? cloudProp.property_images.map((i: any) => i.url)
          : DEFAULT_OWJ_KHOBAR_PROJECT.images;

        projectData = {
          id: cloudProp.id,
          title: cloudProp.title,
          status: cloudProp.status,
          developerName: "مطور معتمد",
          developerLogo: "https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=100&q=80",
          locationText: cloudProp.address_details || "مركز ميت غمر، الدقهلية",
          city: "مركز ميت غمر",
          lat: Number(cloudProp.exact_lat || 30.7194),
          lng: Number(cloudProp.exact_lng || 31.258),
          tags: ["متاح", "مكاتب للإيجار", "محل للإيجار", "وحدات جاهزة"],
          totalUnitsCount: 18,
          minAreaSqM: Number(cloudProp.area_sqm || 325),
          maxAreaSqM: 2100,
          minPrice: Number(cloudProp.price || 70000),
          maxPrice: 290000,
          currency: "جنيه مصري",
          description: cloudProp.description || DEFAULT_OWJ_KHOBAR_PROJECT.description,
          amenities: DEFAULT_OWJ_KHOBAR_PROJECT.amenities,
          nearbyLandmarks: DEFAULT_OWJ_KHOBAR_PROJECT.nearbyLandmarks,
          images: imgs,
          subUnits: DEFAULT_OWJ_KHOBAR_PROJECT.subUnits,
        };
      }
    }
  } catch (error) {
    console.error("[projects/detail] Failed to load in-scope project:", error);
  }

  if (isSoldProject) notFound();

  return <ProjectShowcaseView project={projectData} />;
}
