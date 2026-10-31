import fs from "fs";
import path from "path";
import {
  Property,
  PublicProperty,
  User,
  City,
  District,
  PropertyFilterParams,
  Inquiry,
  ChatMessage,
  Favorite,
  SavedSearch,
  ModerationLog,
  AuditEvent,
  DuplicateCheckResult,
  SmartMatchResult,
  GeoPoint,
  PropertyStatus,
  PropertyReport,
  ReportStatus,
  ReportReasonCategory,
  UserRole,
  CmsHomepageSettings,
  VisualIdentitySettings,
  CmsStaticPage,
  CmsMediaAsset,
  CmsRevision,
  OfficialNotice,
  APPROXIMATE_LOCATION_RADIUS_METERS,
} from "./types";
import { normalizeEgyptianPhone, normalizeEmail } from "../auth/security";
import { matchesSearchQuery } from "../search/property-search";
import { initialUsers, initialCities, initialDistricts, initialProperties } from "./seed-data";
import { DEFAULT_VISUAL_IDENTITY } from "../brand-theme";

const CMS_SETTINGS_MIGRATION = "20261019012631_restore_cms_settings_from_backup.sql";

function formatCmsPersistenceError(
  action: "تحميل" | "حفظ",
  error: { code?: string; message: string }
): Error {
  const details = error.code === "42P01" || error.code === "PGRST205"
    ? `جدول public.cms_settings غير موجود أو غير ظاهر في مخطط Supabase. طبّق الترحيل ${CMS_SETTINGS_MIGRATION} ثم أعد تحميل الإعدادات. (${error.message})`
    : error.message;
  return new Error(`CENTRAL_DB_ERROR: تعذر ${action} إعدادات CMS (${details})`);
}

export type ClientRecordType = "client" | "broker";

export interface StoredClientRecord {
  id: string;
  type: ClientRecordType;
  name: string;
  phone: string;
  requestedProperty?: string;
  requestedCategory?: string;
  requestedArea?: number;
  requestedPriceRange?: string;
  /** السعر الرقمي الأدنى (بالجنيه المصري) — مستخرج بالذكاء الاصطناعي للفلترة */
  priceMin?: number;
  /** السعر الرقمي الأقصى (بالجنيه المصري) — مستخرج بالذكاء الاصطناعي للفلترة */
  priceMax?: number;
  /** نوع الصفقة: sale = بيع، rent = إيجار — للفلترة */
  transactionType?: "sale" | "rent";
  requestedLocation?: string;
  availableListings?: string;
  listingsCount?: number;
  notes?: string;
  /** مصدر السجل: manual = إدخال يدوي، bot = بوت Gemini، link = استخراج من رابط */
  sourceType?: "manual" | "bot" | "link";
  /** رابط المنشور الأصلي إن وجد */
  sourceUrl?: string;
  /** متجه دلالي (Embedding) للبحث المعنوي — يُحسب مرة عند الحفظ */
  embedding?: number[];
  /** حالة التأكيد الإداري للسجل (عروض وطلبات) */
  isVerified?: boolean;
  verifiedBy?: string;
  verifiedAt?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export type ProjectAuditAction =
  | "submit"
  | "approve"
  | "reject"
  | "suspend"
  | "restore"
  | "delete"
  | "edit"
  | "feature"
  | "status_change";

export interface ProjectAuditEntry {
  id: string;
  projectId: string;
  projectTitle: string;
  action: ProjectAuditAction;
  actorId: string;
  actorName: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

export interface DatabaseState {
  users: User[];
  cities: City[];
  districts: District[];
  properties: Property[];
  inquiries: Inquiry[];
  favorites: Favorite[];
  savedSearches: SavedSearch[];
  moderationLogs: ModerationLog[];
  auditEvents: AuditEvent[];
  reports: PropertyReport[];
  officialNotices?: OfficialNotice[];
  inquiryMessages?: ChatMessage[];
  cmsHomepage?: CmsHomepageSettings;
  cmsPages?: CmsStaticPage[];
  cmsMedia?: CmsMediaAsset[];
  cmsRevisions?: CmsRevision[];
  clientRecords?: StoredClientRecord[];
  projectAuditLog?: ProjectAuditEntry[];
}

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_FILE = process.env.AQARPULSE_DB_FILE || path.join(DATA_DIR, "aqarpulse_db.json");

// ==============================================================================
// Geospatial Math Utilities (PostGIS equivalents in pure TypeScript)
// ==============================================================================

/**
 * Calculates Haversine distance in meters between two coordinates.
 */
export function haversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Validates if a coordinate point falls inside a bounding box [southWest, northEast].
 */
export function isPointInBoundingBox(point: GeoPoint, southWest: GeoPoint, northEast: GeoPoint): boolean {
  const latOk = point.lat >= Math.min(southWest.lat, northEast.lat) && point.lat <= Math.max(southWest.lat, northEast.lat);
  let lngOk = false;
  if (southWest.lng <= northEast.lng) {
    lngOk = point.lng >= southWest.lng && point.lng <= northEast.lng;
  } else {
    // Crosses antimeridian
    lngOk = point.lng >= southWest.lng || point.lng <= northEast.lng;
  }
  return latOk && lngOk;
}

/**
 * Ray-casting algorithm to test whether a coordinate point is inside a polygon.
 */
export function isPointInPolygon(point: GeoPoint, polygon: GeoPoint[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng,
      yi = polygon[i].lat;
    const xj = polygon[j].lng,
      yj = polygon[j].lat;

    const intersect =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Generates a deterministic approximate coordinate within the configured privacy radius
 * for advertisers who select locationPrivacy = 'approximate'.
 */
export function calculateApproximateCoordinates(exactLat: number, exactLng: number, propertyId: string): GeoPoint {
  // Deterministic hash based on ID so the map marker doesn't jump randomly on every request
  let hash = 0;
  for (let i = 0; i < propertyId.length; i++) {
    hash = (hash << 5) - hash + propertyId.charCodeAt(i);
    hash |= 0;
  }
  
  // Offset angle between 20 and 70 degrees in each quadrant to guarantee significant shift on BOTH axes
  const quadrant = Math.abs(hash) % 4;
  const baseAngleDeg = 20 + (Math.abs(hash >> 2) % 50); // 20 to 69 degrees
  const finalDeg = quadrant * 90 + baseAngleDeg;
  const angle = finalDeg * (Math.PI / 180);

  const distanceMeters = 25 + (Math.abs(hash >> 3) % (APPROXIMATE_LOCATION_RADIUS_METERS - 25));

  const deltaLat = (distanceMeters * Math.cos(angle)) / 111111;
  const deltaLng = (distanceMeters * Math.sin(angle)) / (111111 * Math.cos((exactLat * Math.PI) / 180));

  let approxLat = Number((exactLat + deltaLat).toFixed(6));
  let approxLng = Number((exactLng + deltaLng).toFixed(6));

  return {
    lat: approxLat,
    lng: approxLng,
  };
}

// ==============================================================================
// Database Store Singleton with Resilient File Persistence & Locking Safeguards
// ==============================================================================

const globalStoreRef = globalThis as unknown as {
  __aqarpulse_db_state?: DatabaseState;
  __aqarpulse_db_mtime?: number;
  __aqarpulse_deleted_ids?: Set<string>;
};

function mergeInquiryRecords(primary: Inquiry, secondary: Inquiry): Inquiry {
  const msgMap = new Map<string, ChatMessage>();
  for (const m of secondary.messages || []) {
    msgMap.set(m.id, m);
  }
  for (const m of primary.messages || []) {
    const existing = msgMap.get(m.id);
    msgMap.set(m.id, existing ? { ...existing, ...m, isRead: Boolean(existing.isRead || m.isRead) } : m);
  }
  const mergedMessages = Array.from(msgMap.values()).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  return {
    ...secondary,
    ...primary,
    messages: mergedMessages,
    lastMessageAt:
      mergedMessages.length > 0
        ? mergedMessages[mergedMessages.length - 1].createdAt
        : primary.lastMessageAt || secondary.lastMessageAt,
  };
}

function mergeDatabaseStates(
  primary: DatabaseState,
  secondary: Partial<DatabaseState>,
  deletedIds: Set<string>
): DatabaseState {
  // 1. Merge Users
  const usersMap = new Map<string, User>();
  for (const u of primary.users || []) {
    if (!deletedIds.has(u.id)) usersMap.set(u.id, u);
  }
  for (const u of secondary.users || []) {
    if (!deletedIds.has(u.id)) {
      const curr = usersMap.get(u.id);
      usersMap.set(u.id, curr ? { ...u, ...curr } : u);
    }
  }

  // 2. Merge Properties
  const propsMap = new Map<string, Property>();
  for (const p of primary.properties || []) {
    if (!deletedIds.has(p.id)) propsMap.set(p.id, p);
  }
  for (const p of secondary.properties || []) {
    if (!deletedIds.has(p.id)) {
      const curr = propsMap.get(p.id);
      propsMap.set(p.id, curr ? { ...p, ...curr } : p);
    }
  }

  // 3. Merge Inquiries & Messages (preserving primary's newest-first unshift order)
  const inqMap = new Map<string, Inquiry>();
  for (const inq of primary.inquiries || []) {
    if (!deletedIds.has(inq.id)) inqMap.set(inq.id, inq);
  }
  for (const inq of secondary.inquiries || []) {
    if (!deletedIds.has(inq.id)) {
      const curr = inqMap.get(inq.id);
      inqMap.set(inq.id, curr ? mergeInquiryRecords(curr, inq) : inq);
    }
  }

  // 4. Merge Reports
  const reportsMap = new Map<string, PropertyReport>();
  for (const r of primary.reports || []) {
    if (!deletedIds.has(r.id)) reportsMap.set(r.id, r);
  }
  for (const r of secondary.reports || []) {
    if (!deletedIds.has(r.id)) {
      const curr = reportsMap.get(r.id);
      reportsMap.set(r.id, curr ? { ...r, ...curr } : r);
    }
  }

  // 5. Merge Audit Events
  const auditMap = new Map<string, AuditEvent>();
  for (const a of primary.auditEvents || []) {
    auditMap.set(a.id, a);
  }
  for (const a of secondary.auditEvents || []) {
    if (!auditMap.has(a.id)) auditMap.set(a.id, a);
  }
  const mergedAudits = Array.from(auditMap.values())
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 500);

  // 6. Merge Moderation Logs
  const modMap = new Map<string, ModerationLog>();
  for (const m of primary.moderationLogs || []) {
    modMap.set(m.id, m);
  }
  for (const m of secondary.moderationLogs || []) {
    if (!modMap.has(m.id)) modMap.set(m.id, m);
  }

  // 7. Merge Official Notices
  const noticeMap = new Map<string, OfficialNotice>();
  for (const n of primary.officialNotices || []) {
    noticeMap.set(n.id, n);
  }
  for (const n of secondary.officialNotices || []) {
    const curr = noticeMap.get(n.id);
    noticeMap.set(n.id, curr ? { ...n, ...curr } : n);
  }

  primary.users = Array.from(usersMap.values());
  primary.cities = primary.cities?.length ? primary.cities : secondary.cities || [...initialCities];
  primary.districts = primary.districts?.length ? primary.districts : secondary.districts || [...initialDistricts];
  primary.properties = Array.from(propsMap.values());
  primary.inquiries = Array.from(inqMap.values());
  primary.favorites = primary.favorites || secondary.favorites || [];
  primary.savedSearches = primary.savedSearches || secondary.savedSearches || [];
  primary.moderationLogs = Array.from(modMap.values());
  primary.auditEvents = mergedAudits;
  primary.reports = Array.from(reportsMap.values());
  primary.officialNotices = Array.from(noticeMap.values());
  primary.cmsHomepage = primary.cmsHomepage || secondary.cmsHomepage;
  primary.cmsPages = primary.cmsPages || secondary.cmsPages;
  primary.cmsMedia = primary.cmsMedia || secondary.cmsMedia;
  primary.cmsRevisions = primary.cmsRevisions || secondary.cmsRevisions;

  return primary;
}

function safeReadJson(filePath: string, maxRetries = 6): any {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(raw);
    } catch (err: any) {
      const isLockOrPartial =
        err instanceof SyntaxError ||
        err.code === "EBUSY" ||
        err.code === "EPERM" ||
        err.code === "EACCES";
      if (isLockOrPartial && attempt < maxRetries) {
        const end = Date.now() + 25 * attempt;
        while (Date.now() < end) {}
        continue;
      }
      throw err;
    }
  }
}

function safeWriteJson(filePath: string, data: any, maxRetries = 6): void {
  const content = JSON.stringify(data, null, 2);
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}_${Math.random().toString(36).substring(2, 6)}.tmp`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      fs.writeFileSync(tmpPath, content, "utf-8");
      try {
        fs.renameSync(tmpPath, filePath);
      } catch {
        fs.copyFileSync(tmpPath, filePath);
        try {
          fs.unlinkSync(tmpPath);
        } catch {}
      }
      return;
    } catch (err: any) {
      try {
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
      } catch {}

      if ((err.code === "EBUSY" || err.code === "EPERM" || err.code === "EACCES") && attempt < maxRetries) {
        const end = Date.now() + 25 * attempt;
        while (Date.now() < end) {}
        continue;
      }
      if (attempt === maxRetries) {
        console.error("Critical error saving database file after retries:", err);
      }
    }
  }
}

class DataStore {
  private get deletedIds(): Set<string> {
    if (!globalStoreRef.__aqarpulse_deleted_ids) {
      globalStoreRef.__aqarpulse_deleted_ids = new Set<string>();
    }
    return globalStoreRef.__aqarpulse_deleted_ids;
  }

  private get state(): DatabaseState | null {
    return globalStoreRef.__aqarpulse_db_state || null;
  }

  private set state(val: DatabaseState | null) {
    if (val) {
      globalStoreRef.__aqarpulse_db_state = val;
    }
  }

  private get lastLoadedMtime(): number {
    return globalStoreRef.__aqarpulse_db_mtime || 0;
  }

  private set lastLoadedMtime(val: number) {
    globalStoreRef.__aqarpulse_db_mtime = val;
  }

  private isLocalDiskPersistenceAllowed(): boolean {
    if (process.env.NODE_ENV === "production") {
      return process.env.AQARPULSE_ALLOW_TEST_DISK === "true";
    }
    return true;
  }

  private hasCentralCmsConfiguration(): boolean {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    return Boolean(url && !url.includes("placeholder") && serviceKey && !serviceKey.includes("placeholder"));
  }

  private async getCentralCmsClient(requirePersistence: boolean) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const hasSupabaseUrl = Boolean(url && !url.includes("placeholder"));

    if (!hasSupabaseUrl || !serviceKey || serviceKey.includes("placeholder")) {
      if (requirePersistence && process.env.NODE_ENV === "production" && !this.isLocalDiskPersistenceAllowed()) {
        throw new Error("CENTRAL_DB_UNAVAILABLE: إعدادات قاعدة البيانات المركزية غير مكتملة لحفظ المحتوى");
      }
      return null;
    }

    const { createClient } = await import("@supabase/supabase-js");
    return createClient(url!, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  private async readCentralCmsSetting(key: string): Promise<unknown | null> {
    const client = await this.getCentralCmsClient(false);
    if (!client) return null;

    const { data, error } = await client
      .from("cms_settings")
      .select("payload")
      .eq("key", key)
      .maybeSingle();
    if (error) {
      throw formatCmsPersistenceError("تحميل", error);
    }
    return data?.payload ?? null;
  }

  private async writeCentralCmsSetting(key: string, payload: unknown, updatedBy: string): Promise<void> {
    const client = await this.getCentralCmsClient(true);
    if (!client) return;

    const { error } = await client.from("cms_settings").upsert(
      {
        key,
        payload,
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );
    if (error) {
      throw formatCmsPersistenceError("حفظ", error);
    }
  }

  private init(): DatabaseState {
    const isProd = process.env.NODE_ENV === "production";
    const allowDisk = this.isLocalDiskPersistenceAllowed();

    if (!allowDisk) {
      if (this.state) {
        return this.state;
      }
      this.state = {
        users: [],
        cities: [...initialCities],
        districts: [...initialDistricts],
        properties: [],
        inquiries: [],
        favorites: [],
        savedSearches: [],
        moderationLogs: [],
        auditEvents: [],
        reports: [],
        officialNotices: [],
      };
      return this.state;
    }

    if (!fs.existsSync(DATA_DIR)) {
      try {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      } catch {}
    }

    let fileMtime = 0;
    if (fs.existsSync(DB_FILE)) {
      try {
        fileMtime = fs.statSync(DB_FILE).mtimeMs;
      } catch {}
    }

    // Return in-memory state only if file on disk has not changed
    if (this.state && fileMtime > 0 && fileMtime <= this.lastLoadedMtime) {
      return this.state;
    }

    if (fs.existsSync(DB_FILE)) {
      try {
        const parsed = safeReadJson(DB_FILE);
        if (parsed && typeof parsed === "object") {
          if (this.state) {
            this.state = mergeDatabaseStates(this.state, parsed, this.deletedIds);
          } else {
            this.state = parsed;
          }
          this.lastLoadedMtime = fileMtime;

          if (this.state) {
            if (!this.state.reports) this.state.reports = [];
            if (!this.state.auditEvents) this.state.auditEvents = [];
            if (!this.state.moderationLogs) this.state.moderationLogs = [];
            if (!this.state.officialNotices) this.state.officialNotices = [];
            if (!this.state.inquiries) this.state.inquiries = [];
            return this.state;
          }
        }
      } catch (err: any) {
        console.warn("Notice: reading db file encountered transient lock, checking state:", err?.message || err);
        if (this.state) return this.state;
      }
    }

    // Default Seed state (Only in non-production environments; never inject demo users/properties in production)
    this.state = {
      users: isProd ? [] : [...initialUsers],
      cities: [...initialCities],
      districts: [...initialDistricts],
      properties: isProd ? [] : [...initialProperties],
      inquiries: [],
      favorites: [],
      savedSearches: [],
      moderationLogs: [],
      auditEvents: [],
      reports: [],
      officialNotices: [],
    };

    this.save();
    return this.state;
  }

  private save(): void {
    if (!this.state) return;
    if (!this.isLocalDiskPersistenceAllowed()) return;
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      // Merge any records written by concurrent processes on disk before saving
      if (fs.existsSync(DB_FILE)) {
        try {
          const diskData = safeReadJson(DB_FILE);
          if (diskData && typeof diskData === "object") {
            this.state = mergeDatabaseStates(this.state, diskData, this.deletedIds);
          }
        } catch {}
      }

      safeWriteJson(DB_FILE, this.state);
      try {
        this.lastLoadedMtime = fs.statSync(DB_FILE).mtimeMs;
      } catch {}
    } catch (err) {
      console.error("Error saving database file:", err);
    }
  }

  public reloadFromDisk(): void {
    if (!this.isLocalDiskPersistenceAllowed()) return;
    if (fs.existsSync(DB_FILE)) {
      try {
        const parsed = safeReadJson(DB_FILE);
        if (parsed && typeof parsed === "object") {
          if (!this.state) {
            this.state = parsed;
          } else {
            this.state = mergeDatabaseStates(this.state, parsed, this.deletedIds);
          }
        }
      } catch (err) {
        console.warn("Failed to reload db file from disk:", err);
      }
    }
  }

  // ============================================================================
  // Properties & Geospatial Search
  // ============================================================================

  public queryProperties(filters: PropertyFilterParams, viewerUser?: User): {
    properties: PublicProperty[];
    total: number;
    page: number;
    totalPages: number;
  } {
    const db = this.init();
    const isAdmin = viewerUser?.role === "admin";

    // 1. Status Filter: Public queries can see 'active' or 'published'
    let list = db.properties.filter((p) => {
      if (isAdmin) return true;
      return p.status === "active" || p.status === "published";
    });

    // 2. Transaction Type
    if (filters.transactionType) {
      list = list.filter((p) => p.transactionType === filters.transactionType);
    }

    // 3. Category
    if (filters.category) {
      list = list.filter((p) => p.category === filters.category);
    }

    // 4. City & District
    if (filters.cityId) {
      list = list.filter((p) => p.cityId === filters.cityId);
    }
    if (filters.districtId) {
      list = list.filter((p) => p.districtId === filters.districtId);
    }
    if (filters.districtIds) {
      const districtIds = new Set(filters.districtIds);
      list = list.filter((p) => districtIds.has(p.districtId));
    }

    // 5. Price Range
    if (filters.minPrice !== undefined && filters.minPrice !== null) {
      list = list.filter((p) => p.price >= filters.minPrice!);
    }
    if (filters.maxPrice !== undefined && filters.maxPrice !== null) {
      list = list.filter((p) => p.price <= filters.maxPrice!);
    }

    // 6. Area Range
    if (filters.minArea !== undefined && filters.minArea !== null) {
      list = list.filter((p) => p.areaSqM >= filters.minArea!);
    }
    if (filters.maxArea !== undefined && filters.maxArea !== null) {
      list = list.filter((p) => p.areaSqM <= filters.maxArea!);
    }

    // 7. Bedrooms & Bathrooms
    if (filters.bedrooms !== undefined && filters.bedrooms !== null) {
      list = list.filter((p) => (p.bedrooms ?? 0) >= filters.bedrooms!);
    }
    if (filters.bathrooms !== undefined && filters.bathrooms !== null) {
      list = list.filter((p) => (p.bathrooms ?? 0) >= filters.bathrooms!);
    }

    // 8. Specifications
    if (filters.finishingStatus) {
      list = list.filter((p) => p.finishingStatus === filters.finishingStatus);
    }
    if (filters.furnishingStatus) {
      list = list.filter((p) => p.furnishingStatus === filters.furnishingStatus);
    }
    if (filters.advertiserType) {
      list = list.filter((p) => p.advertiserType === filters.advertiserType);
    }
    if (filters.featuredOnly) {
      list = list.filter((p) => p.featured === true);
    }

    // 9. Text Search
    if (filters.searchQuery && filters.searchQuery.trim().length > 0) {
      const districtsById = new Map(db.districts.map((district) => [district.id, district]));
      const citiesById = new Map(db.cities.map((city) => [city.id, city]));
      list = list.filter(
        (p) =>
          matchesSearchQuery(filters.searchQuery!, [
            p.title,
            p.description,
            p.addressDetails,
            p.id,
            p.slug,
            districtsById.get(p.districtId)?.nameAr,
            districtsById.get(p.districtId)?.nameEn,
            citiesById.get(p.cityId)?.nameAr,
            citiesById.get(p.cityId)?.nameEn,
          ])
      );
    }

    // 11. Spatial Filtering (Server-Side)
    // A. Viewport Bounding Box
    if (filters.bounds) {
      const { southWest, northEast } = filters.bounds;
      list = list.filter((p) => {
        const point = p.locationPrivacy === "approximate"
          ? calculateApproximateCoordinates(p.lat, p.lng, p.id)
          : { lat: p.lat, lng: p.lng };
        return isPointInBoundingBox(point, southWest, northEast);
      });
    }

    // B. Radius Search
    if (filters.radius) {
      const { center, radiusKm } = filters.radius;
      const radiusMeters = radiusKm * 1000;
      list = list.filter((p) => {
        const dist = haversineDistanceMeters(center.lat, center.lng, p.lat, p.lng);
        return dist <= radiusMeters;
      });
    }

    // C. Polygon Search
    if (filters.polygon && filters.polygon.length >= 3) {
      list = list.filter((p) => {
        return isPointInPolygon({ lat: p.lat, lng: p.lng }, filters.polygon!);
      });
    }

    // 12. Sorting
    switch (filters.sort) {
      case "price_asc":
        list.sort((a, b) => a.price - b.price);
        break;
      case "price_desc":
        list.sort((a, b) => b.price - a.price);
        break;
      case "area_asc":
        list.sort((a, b) => a.areaSqM - b.areaSqM);
        break;
      case "area_desc":
        list.sort((a, b) => b.areaSqM - a.areaSqM);
        break;
      case "relevance":
        list.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || b.viewsCount - a.viewsCount);
        break;
      case "newest":
      default:
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
    }

    const total = list.length;
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = filters.limit && filters.limit > 0 ? filters.limit : 24;
    const start = (page - 1) * limit;
    const paginated = list.slice(start, start + limit);

    // Map to Public DTO with STRICT Privacy Enforcement
    const publicList = paginated.map((p) => this.toPublicProperty(p, db.users, viewerUser));

    return {
      properties: publicList,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  public getPropertyByIdOrSlug(idOrSlug: string, viewerUser?: User): PublicProperty | null {
    const db = this.init();
    const prop = db.properties.find((p) => p.id === idOrSlug || p.slug === idOrSlug);
    if (!prop) return null;

    // Authorization check for unpublished listings
    const isOwnerOrBroker = viewerUser && viewerUser.id === prop.advertiserId;
    const isAdmin = viewerUser && viewerUser.role === "admin";
    if (prop.status !== "published" && prop.status !== "active" && !isOwnerOrBroker && !isAdmin) {
      return null;
    }

    // Increment view count
    prop.viewsCount = (prop.viewsCount || 0) + 1;
    this.save();

    return this.toPublicProperty(prop, db.users, viewerUser);
  }

  public getRawPropertyById(id: string): Property | null {
    const db = this.init();
    return db.properties.find((p) => p.id === id) || null;
  }

  public getPropertiesByAdvertiser(advertiserId: string): Property[] {
    const db = this.init();
    return db.properties
      .filter((p) => p.advertiserId === advertiserId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public getAllPropertiesForAdmin(): Property[] {
    const db = this.init();
    return [...db.properties].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // ============================================================================
  // Privacy Redaction Engine
  // ============================================================================

  /**
   * Transforms raw internal Property into PublicProperty.
   * CRITICAL SECURITY & PRIVACY RULE:
   * When locationPrivacy === 'approximate', exact lat/lng coordinates are
   * COMPLETELY STRIPPED and replaced by the approximate coordinates.
   */
  public toPublicProperty(property: Property, users: User[], viewerUser?: User): PublicProperty {
    const advertiser = users.find((u) => u.id === property.advertiserId);
    const isOwnerOrAdmin = viewerUser && (viewerUser.id === property.advertiserId || viewerUser.role === "admin");

    const isApproximate = property.locationPrivacy === "approximate";
    
    // Exact or approximate coordinates based on privacy setting & viewing role
    let displayLat = property.lat;
    let displayLng = property.lng;

    if (isApproximate && !isOwnerOrAdmin) {
      // Stripped and replaced with blurred coords
      const approximateCoords = calculateApproximateCoordinates(property.lat, property.lng, property.id);
      displayLat = approximateCoords.lat;
      displayLng = approximateCoords.lng;
    }

    return {
      ...property,
      lat: displayLat,
      lng: displayLng,
      isApproximateLocation: isApproximate,
      privacyRadiusMeters: isApproximate ? APPROXIMATE_LOCATION_RADIUS_METERS : undefined,
      advertiser: {
        id: advertiser?.id || property.advertiserId,
        name: advertiser?.name || "معلن",
        role: advertiser?.role || "owner",
        phone: advertiser?.phone,
        whatsapp: advertiser?.whatsappEnabled ? advertiser.phone : undefined,
        isVerified: advertiser?.isVerified ?? false,
        avatarUrl: advertiser?.avatarUrl,
        companyName: advertiser?.companyName,
      },
    };
  }

  // ============================================================================
  // Property Mutations & Lifecycle
  // ============================================================================

  public createProperty(data: Omit<Property, "id" | "slug" | "createdAt" | "updatedAt" | "viewsCount" | "inquiriesCount"> & { id?: string; slug?: string }): Property {
    const db = this.init();

    if (data.price !== undefined && data.price <= 0) {
      throw new Error("سعر العقار يجب أن يكون رقماً صحيحاً وموجباً");
    }
    if (data.areaSqM !== undefined && data.areaSqM <= 0) {
      throw new Error("مساحة العقار يجب أن تكون رقماً موجباً");
    }

    const id = data.id || ("prop-" + Date.now().toString(36) + "-" + Math.random().toString(36).substring(2, 6));

    // Generate safe slug in Arabic-English format
    const cleanTitle = data.title.toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]+/g, "-").replace(/^-+|-+$/g, "");
    const slug = data.slug || `${cleanTitle}-${id.slice(-6)}`;

    // Calculate approximate coordinates if privacy mode enabled
    let approxCoords: GeoPoint | undefined = undefined;
    if (data.locationPrivacy === "approximate") {
      approxCoords = calculateApproximateCoordinates(data.lat, data.lng, id);
    }

    const newProperty: Property = {
      ...data,
      id,
      slug,
      approximateLat: approxCoords?.lat,
      approximateLng: approxCoords?.lng,
      viewsCount: 0,
      inquiriesCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      publishedAt: data.status === "published" ? new Date().toISOString() : undefined,
    };

    // Remove if already exists with same ID to avoid duplicates
    db.properties = db.properties.filter((p) => p.id !== id);
    db.properties.unshift(newProperty);
    this.recordAuditEvent(data.advertiserId, "CREATE_PROPERTY", "property", id, { title: data.title });
    this.save();
    return newProperty;
  }

  public updateProperty(id: string, updates: Partial<Property>, actorUser: User): Property {
    const db = this.init();
    const index = db.properties.findIndex((p) => p.id === id);
    if (index === -1) throw new Error("العقار غير موجود");

    const existing = db.properties[index];
    if (existing.advertiserId !== actorUser.id && actorUser.role !== "admin") {
      throw new Error("غير مصرح لك بتعديل هذا العقار");
    }

    let approxCoords = {
      approximateLat: existing.approximateLat,
      approximateLng: existing.approximateLng,
    };

    if (updates.locationPrivacy === "approximate" || (existing.locationPrivacy === "approximate" && (updates.lat || updates.lng))) {
      const lat = updates.lat ?? existing.lat;
      const lng = updates.lng ?? existing.lng;
      const approx = calculateApproximateCoordinates(lat, lng, id);
      approxCoords = {
        approximateLat: approx.lat,
        approximateLng: approx.lng,
      };
    }

    // Sanitize updates: prevent tampering with protected or immutable fields
    const {
      id: _id,
      advertiserId: _advId,
      status: _status,
      viewsCount: _vc,
      inquiriesCount: _ic,
      createdAt: _ca,
      ...safeUpdates
    } = updates;

    const updated: Property = {
      ...existing,
      ...safeUpdates,
      ...approxCoords,
      updatedAt: new Date().toISOString(),
    };

    db.properties[index] = updated;
    this.recordAuditEvent(actorUser.id, "UPDATE_PROPERTY", "property", id, { updates });
    this.save();
    return updated;
  }

  public updatePropertyStatus(id: string, newStatus: PropertyStatus, actorUser: User, reason?: string): Property {
    const db = this.init();
    const index = db.properties.findIndex((p) => p.id === id);
    if (index === -1) throw new Error("العقار غير موجود");

    const existing = db.properties[index];
    const prevStatus = existing.status;

    // Prevent repeated state transitions
    if (existing.status === newStatus) {
      throw new Error("العقار في هذه الحالة بالفعل");
    }

    // Role check: Only admin can approve/publish/reject/suspend
    if (actorUser.role !== "admin") {
      if (existing.advertiserId !== actorUser.id) {
        throw new Error("غير مصرح لك بتغيير حالة هذا العقار");
      }
      // Broker verification requirement: Unverified brokers cannot submit listings for review or publish
      if (actorUser.role === "broker" && !actorUser.isVerified) {
        if (newStatus === "pending_review" || newStatus === "pending" || newStatus === "published" || newStatus === "active") {
          throw new Error(
            "يتطلب إرسال العقار للمراجعة والنشر اعتماد ترخيص الوسيط العقاري من قبل الإدارة أولاً. يمكنك حفظ العقار كمسودة حالياً."
          );
        }
      }
      if (newStatus === "published" || newStatus === "active") {
        // Allow advertiser to unpause back to published/active only if it was already approved and paused
        if (existing.status !== "paused") {
          throw new Error("يتطلب نشر العقار موافقة الإدارة");
        }
      }
      if (newStatus === "paused" && existing.status !== "published" && existing.status !== "active") {
        throw new Error("يمكن إيقاف العقار مؤقتاً بعد نشره فقط");
      }
      if (
        newStatus === "sold" &&
        existing.status !== "published" &&
        existing.status !== "active" &&
        existing.status !== "paused"
      ) {
        throw new Error("يمكن تسجيل البيع بعد نشر العقار فقط");
      }
      if (newStatus === "rejected") {
        throw new Error("صلاحية رفض الإعلان مقتصرة على مشرفي المنصة");
      }
      if (newStatus === "suspended") {
        throw new Error("صلاحية تعليق الإعلان مقتصرة على مشرفي المنصة");
      }
      // Advertisers may retract drafts, pause published listings, or mark published listings as sold.
    } else {
      // Admin moderation validations
      if (newStatus === "rejected") {
        if (!reason || !reason.trim()) {
          throw new Error("سبب الرفض إلزامي");
        }
      }
    }

    existing.status = newStatus;
    existing.updatedAt = new Date().toISOString();
    if (newStatus === "rejected") {
      existing.moderationNotes = reason?.trim();
    } else if (newStatus === "pending_review" || newStatus === "pending" || newStatus === "published" || newStatus === "active") {
      // Clear previous rejection reason once resubmitted or published
      existing.moderationNotes = undefined;
    }
    if ((newStatus === "published" || newStatus === "active") && !existing.publishedAt) {
      existing.publishedAt = new Date().toISOString();
    }

    // Record moderation history
    if (!db.moderationLogs) db.moderationLogs = [];
    db.moderationLogs.unshift({
      id: "mod-" + Date.now(),
      propertyId: id,
      adminId: actorUser.id,
      adminName: actorUser.name,
      previousStatus: prevStatus,
      newStatus,
      reason: reason?.trim(),
      timestamp: new Date().toISOString(),
    });

    this.recordAuditEvent(actorUser.id, "CHANGE_STATUS", "property", id, { prevStatus, newStatus, reason: reason?.trim() });
    this.save();
    return existing;
  }

  public getPropertyModerationHistory(propertyId: string): ModerationLog[] {
    const db = this.init();
    return (db.moderationLogs || []).filter((m) => m.propertyId === propertyId);
  }

  public deleteProperty(id: string, actorUser: User): boolean {
    const db = this.init();
    const index = db.properties.findIndex((p) => p.id === id);
    if (index === -1) throw new Error("العقار غير موجود");

    const existing = db.properties[index];
    if (existing.advertiserId !== actorUser.id && actorUser.role !== "admin") {
      throw new Error("غير مصرح لك بحذف هذا العقار");
    }

    // Strict rule from approved diagram:
    // "يحق للمالك أو الوسيط حذف المشروع وهوا قيد المراجعة، إذا قُبل المشروع لا يحق له حذفه"
    // "يحق للإدارة حذف المنشور"
    if (existing.status === "published" && actorUser.role !== "admin") {
      throw new Error(
      "لا يمكن للمعلن حذف العقار بعد اعتماده ونشره من قبل الإدارة. يمكنك وسمه كـ (تم البيع) أو إيقافه مؤقتاً أو تقديم طلب حذف رسمي للإدارة."
      );
    }

    db.properties.splice(index, 1);
    this.deletedIds.add(id);
    this.recordAuditEvent(actorUser.id, "DELETE_PROPERTY", "property", id, { title: existing.title });
    this.save();
    return true;
  }

  // ============================================================================
  // Official Communication Channel between Administration and Advertisers
  // ============================================================================

  public createOfficialNotice(data: Omit<OfficialNotice, "id" | "createdAt" | "status">): OfficialNotice {
    const db = this.init();
    if (!db.officialNotices) db.officialNotices = [];
    const notice: OfficialNotice = {
      ...data,
      id: "notif-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
      status: "unread",
      createdAt: new Date().toISOString(),
    };
    db.officialNotices.unshift(notice);
    this.recordAuditEvent(data.senderId, "CREATE_OFFICIAL_NOTICE", "notice", notice.id, {
      type: notice.type,
      recipientId: notice.recipientId,
      propertyId: notice.propertyId,
      title: notice.title,
    });
    this.save();
    return notice;
  }

  public getOfficialNoticesForUser(userId: string): OfficialNotice[] {
    const db = this.init();
    return (db.officialNotices || []).filter((n) => n.recipientId === userId);
  }

  public getOfficialNoticesForAdmin(): OfficialNotice[] {
    const db = this.init();
    return (db.officialNotices || []).filter((n) => n.recipientRole === "admin" || n.type === "deletion_request");
  }

  public markOfficialNoticeRead(noticeId: string, actorUserId: string): boolean {
    const db = this.init();
    const notice = (db.officialNotices || []).find((n) => n.id === noticeId);
    if (!notice) return false;
    if (notice.recipientId !== actorUserId && actorUserId !== "admin") return false;
    notice.status = "read";
    this.save();
    return true;
  }

  public resolveOfficialNotice(noticeId: string, actorUserId: string): boolean {
    const db = this.init();
    const notice = (db.officialNotices || []).find((n) => n.id === noticeId);
    if (!notice) return false;
    notice.status = "resolved";
    notice.resolvedAt = new Date().toISOString();
    this.save();
    return true;
  }

  // ============================================================================
  // Duplicate Detection Foundation
  // ============================================================================

  public checkPotentialDuplicates(newProp: Partial<Property>): DuplicateCheckResult {
    const db = this.init();
    const candidateProps = db.properties.filter((p) => p.id !== newProp.id && p.status !== "archived");

    const matchedPropertyIds: string[] = [];
    const reasons: string[] = [];
    let maxConfidence = 0;

    for (const cand of candidateProps) {
      let score = 0;
      const reasonsForCand: string[] = [];

      // 1. Proximity check
      if (newProp.lat && newProp.lng) {
        const dist = haversineDistanceMeters(newProp.lat, newProp.lng, cand.lat, cand.lng);
        if (dist <= 150) {
          score += 35;
          reasonsForCand.push(`مسافة جغرافية قريبة جداً (${Math.round(dist)}م)`);
        } else if (dist <= 500) {
          score += 15;
          reasonsForCand.push(`في نفس المربع السكني (${Math.round(dist)}م)`);
        }
      }

      // 2. Price similarity (within 5%)
      if (newProp.price && cand.price) {
        const priceDiffRatio = Math.abs(newProp.price - cand.price) / cand.price;
        if (priceDiffRatio <= 0.05) {
          score += 25;
          reasonsForCand.push("سعر متطابق أو متقارب جداً");
        }
      }

      // 3. Specifications match (Area, bedrooms, bathrooms)
      if (newProp.areaSqM && cand.areaSqM) {
        const areaDiffRatio = Math.abs(newProp.areaSqM - cand.areaSqM) / cand.areaSqM;
        if (areaDiffRatio <= 0.05) {
          score += 15;
        }
      }
      if (newProp.bedrooms !== undefined && newProp.bedrooms === cand.bedrooms) {
        score += 15;
      }

      // 4. Category and transaction type match
      if (newProp.category === cand.category && newProp.transactionType === cand.transactionType) {
        score += 10;
      }

      if (score >= 60) {
        matchedPropertyIds.push(cand.id);
        reasons.push(`عقار مشابه #${cand.id}: ${reasonsForCand.join("، ")}`);
        if (score > maxConfidence) maxConfidence = score;
      }
    }

    return {
      hasPotentialDuplicate: matchedPropertyIds.length > 0,
      confidenceScore: Math.min(100, maxConfidence),
      matchedPropertyIds,
      reasons,
    };
  }

  // ============================================================================
  // Deterministic Smart Matching Engine
  // ============================================================================

  public findSmartMatchesForCriteria(criteria: {
    transactionType?: "sale" | "rent";
    preferredDistrictId?: string;
    maxBudget?: number;
    minArea?: number;
    requiredBedrooms?: number;
    category?: string;
  }): SmartMatchResult[] {
    const db = this.init();
    const publishedProps = db.properties.filter((p) => p.status === "published");
    const results: SmartMatchResult[] = [];

    for (const p of publishedProps) {
      // Hard constraint 1: Transaction type
      if (criteria.transactionType && p.transactionType !== criteria.transactionType) {
        continue;
      }
      // Hard constraint 2: Category if specified
      if (criteria.category && p.category !== criteria.category) {
        continue;
      }
      // Hard constraint 3: Budget upper boundary + 10% tolerance
      if (criteria.maxBudget && p.price > criteria.maxBudget * 1.1) {
        continue;
      }

      let score = 0;
      const matchedCriteria: string[] = [];

      // Budget score (Up to 35 pts)
      if (criteria.maxBudget) {
        if (p.price <= criteria.maxBudget) {
          score += 35;
          matchedCriteria.push("ضمن الميزانية المحددة تماماً");
        } else {
          score += 20;
          matchedCriteria.push("قريب جداً من الميزانية");
        }
      } else {
        score += 20;
      }

      // Location score (Up to 30 pts)
      if (criteria.preferredDistrictId && p.districtId === criteria.preferredDistrictId) {
        score += 30;
        const distName = db.districts.find((d) => d.id === p.districtId)?.nameAr || "الحي المفضل";
        matchedCriteria.push(`في المنطقة المفضلة: ${distName}`);
      }

      // Area score (Up to 20 pts)
      if (criteria.minArea) {
        if (p.areaSqM >= criteria.minArea) {
          score += 20;
          matchedCriteria.push(`المساحة تحقق أو تتجاوز المطلوب (${p.areaSqM} م²)`);
        }
      } else {
        score += 10;
      }

      // Bedrooms score (Up to 15 pts)
      if (criteria.requiredBedrooms) {
        if ((p.bedrooms ?? 0) >= criteria.requiredBedrooms) {
          score += 15;
          matchedCriteria.push(`عدد الغرف يلبي المتطلبات (${p.bedrooms} غرف)`);
        }
      } else {
        score += 10;
      }

      if (score >= 50) {
        results.push({
          property: this.toPublicProperty(p, db.users),
          score: Math.min(100, score),
          matchedCriteria,
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, 10);
  }

  // ============================================================================
  // Inquiries / Leads Management
  // ============================================================================

  public createInquiry(data: Omit<Inquiry, "id" | "createdAt" | "status"> & { id?: string }): Inquiry {
    const db = this.init();

    const prop = db.properties.find((p) => p.id === data.propertyId || p.slug === data.propertyId);
    const adv = db.users.find((u) => u.id === data.advertiserId);

    // 1. If explicit ID is provided and already exists, enrich and return existing record
    if (data.id) {
      const existingById = db.inquiries.find((i) => i.id === data.id);
      if (existingById) {
        existingById.propertySlug = existingById.propertySlug || data.propertySlug || prop?.slug;
        existingById.propertyPrice = existingById.propertyPrice || data.propertyPrice || prop?.price;
        existingById.propertyImage =
          existingById.propertyImage || data.propertyImage || (Array.isArray(prop?.images) ? prop.images[0] : undefined);
        existingById.advertiserName = existingById.advertiserName || data.advertiserName || adv?.companyName || adv?.name;
        existingById.advertiserPhone = existingById.advertiserPhone || data.advertiserPhone || adv?.phone;
        this.save();
        return existingById;
      }
    } else {
      // 2. Idempotency guard against rapid duplicate submissions (within 10s)
      const nowMs = Date.now();
      const recentDuplicate = db.inquiries.find(
        (i) =>
          i.propertyId === data.propertyId &&
          i.seekerId === data.seekerId &&
          i.message.trim() === data.message.trim() &&
          nowMs - new Date(i.createdAt).getTime() < 10000
      );
      if (recentDuplicate) {
        return recentDuplicate;
      }
    }

    const id = data.id || ("inq-" + Date.now().toString(36) + "-" + Math.random().toString(36).substring(2, 6));
    const now = new Date().toISOString();

    const initialMessage: ChatMessage = {
      id: "msg-" + Date.now().toString(36) + "-" + Math.random().toString(36).substring(2, 6),
      inquiryId: id,
      senderId: data.seekerId,
      senderName: data.seekerName,
      senderRole: "buyer",
      content: data.message,
      createdAt: now,
      isRead: false,
    };

    const newInq: Inquiry = {
      ...data,
      id,
      propertySlug: data.propertySlug || prop?.slug,
      propertyPrice: data.propertyPrice || prop?.price,
      propertyImage: data.propertyImage || (Array.isArray(prop?.images) ? prop.images[0] : undefined),
      advertiserName: data.advertiserName || adv?.companyName || adv?.name,
      advertiserPhone: data.advertiserPhone || adv?.phone,
      status: "new",
      messages: [initialMessage],
      lastMessageAt: now,
      createdAt: now,
    };

    db.inquiries.unshift(newInq);

    // Increment inquiry count on property
    if (prop) {
      prop.inquiriesCount = (prop.inquiriesCount || 0) + 1;
    }

    this.recordAuditEvent(data.seekerId, "CREATE_INQUIRY", "inquiry", id, { propertyId: data.propertyId });
    this.save();
    return newInq;
  }

  public getInquiryById(inquiryId: string): Inquiry | null {
    const db = this.init();
    let inq = db.inquiries.find((i) => i.id === inquiryId);
    if (!inq) {
      this.reloadFromDisk();
      inq = this.state?.inquiries.find((i) => i.id === inquiryId);
    }
    return inq || null;
  }

  public addInquiryMessage(
    inquiryId: string,
    messageData: {
      senderId: string;
      senderName: string;
      senderRole: "buyer" | "seeker" | "owner" | "broker" | "admin";
      content: string;
      isAdminNote?: boolean;
      isInternalNote?: boolean;
    }
  ): ChatMessage {
    const db = this.init();
    let inq = db.inquiries.find((i) => i.id === inquiryId);
    if (!inq) {
      this.reloadFromDisk();
      inq = this.state?.inquiries.find((i) => i.id === inquiryId);
    }
    if (!inq) throw new Error("طلب التواصل والمعاينة غير موجود");

    if (!inq.messages) {
      inq.messages = [];
    }

    const cleanContent = messageData.content.trim();
    const nowMs = Date.now();

    // Idempotency guard: prevent duplicate message if identical sender + content sent within 10s
    const lastMsg = inq.messages[inq.messages.length - 1];
    if (
      lastMsg &&
      lastMsg.senderId === messageData.senderId &&
      lastMsg.content === cleanContent &&
      Boolean(lastMsg.isAdminNote) === Boolean(messageData.isAdminNote) &&
      Boolean(lastMsg.isInternalNote) === Boolean(messageData.isInternalNote) &&
      nowMs - new Date(lastMsg.createdAt).getTime() < 10000
    ) {
      return lastMsg;
    }

    const newMsg: ChatMessage = {
      id: "msg-" + Date.now().toString(36) + "-" + Math.random().toString(36).substring(2, 6),
      inquiryId,
      senderId: messageData.senderId,
      senderName: messageData.senderName,
      senderRole: messageData.senderRole,
      content: cleanContent,
      createdAt: new Date().toISOString(),
      isAdminNote: messageData.isAdminNote,
      isInternalNote: messageData.isInternalNote,
      isRead: false,
    };

    inq.messages.push(newMsg);
    if (!messageData.isInternalNote) {
      inq.lastMessageAt = newMsg.createdAt;
    }

    // If advertiser responds, move status from 'new' to 'contacted'
    if (
      !messageData.isInternalNote &&
      inq.status === "new" &&
      (messageData.senderRole === "owner" || messageData.senderRole === "broker")
    ) {
      inq.status = "contacted";
    }

    this.recordAuditEvent(messageData.senderId, "INQUIRY_CHAT_MESSAGE", "inquiry", inquiryId, {
      role: messageData.senderRole,
      isAdminNote: messageData.isAdminNote,
      isInternalNote: messageData.isInternalNote,
    });
    this.save();
    return newMsg;
  }

  public markInquiryMessagesAsRead(inquiryId: string, readerUserId: string): void {
    const inq = this.getInquiryById(inquiryId);
    if (!inq || !inq.messages) return;
    let modified = false;
    inq.messages.forEach((msg) => {
      if (msg.senderId !== readerUserId && msg.isRead !== true) {
        msg.isRead = true;
        modified = true;
      }
    });
    if (modified) {
      this.save();
    }
  }

  public getInquiryUnreadCount(inquiryId: string, userId: string): number {
    const inq = this.getInquiryById(inquiryId);
    if (!inq || !inq.messages) return 0;
    const readerUser = this.findUserById(userId);
    const isAdmin = readerUser?.role === "admin";
    return inq.messages.filter(
      (msg) =>
        msg.senderId !== userId &&
        msg.isRead === false &&
        (isAdmin || !msg.isInternalNote)
    ).length;
  }

  public getInquiryMessages(inquiryId: string): ChatMessage[] {
    const inq = this.getInquiryById(inquiryId);
    if (!inq) return [];
    if (!inq.messages || inq.messages.length === 0) {
      return [];
    }
    return inq.messages.filter((m) => !m.id.endsWith("-initial") && m.id !== "msg-" + inq.id);
  }

  public getAllInquiriesForAdmin(): Inquiry[] {
    const db = this.init();
    return db.inquiries || [];
  }

  public getInquiriesForAdvertiser(advertiserId: string): Inquiry[] {
    const db = this.init();
    return db.inquiries.filter((inq) => inq.advertiserId === advertiserId);
  }

  public getInquiriesForSeeker(seekerId: string, phone?: string, email?: string): Inquiry[] {
    const db = this.init();
    const cleanPhone = phone?.trim();
    const cleanEmail = email?.trim().toLowerCase();
    return db.inquiries.filter((inq) => {
      if (inq.seekerId === seekerId) return true;
      if (cleanPhone && inq.seekerPhone && inq.seekerPhone.trim() === cleanPhone) return true;
      if (cleanEmail && inq.seekerEmail && inq.seekerEmail.trim().toLowerCase() === cleanEmail) return true;
      return false;
    });
  }

  public updateInquiryStatus(
    inquiryId: string,
    status: Inquiry["status"],
    actorUserId: string,
    actorRole?: string
  ): Inquiry {
    const db = this.init();
    let inq = db.inquiries.find((i) => i.id === inquiryId);
    if (!inq) {
      this.reloadFromDisk();
      inq = this.state?.inquiries.find((i) => i.id === inquiryId);
    }
    if (!inq) throw new Error("طلب التواصل غير موجود");
    const isAdvertiser = inq.advertiserId === actorUserId;
    const isSeeker = inq.seekerId === actorUserId;
    const isAdmin = actorRole === "admin" || actorRole === "superadmin" || actorRole === "moderator";

    if (!isAdvertiser && !isAdmin && !isSeeker) {
      throw new Error("غير مصرح بتعديل هذا الطلب");
    }

    inq.status = status;
    this.recordAuditEvent(actorUserId, "UPDATE_INQUIRY_STATUS", "inquiry", inquiryId, { status, actorRole });
    this.save();
    return inq;
  }

  // ============================================================================
  // Favorites & Saved Searches
  // ============================================================================

  public toggleFavorite(userId: string, propertyId: string): boolean {
    const db = this.init();
    const idx = db.favorites.findIndex((f) => f.userId === userId && f.propertyId === propertyId);
    if (idx >= 0) {
      db.favorites.splice(idx, 1);
      this.save();
      return false; // removed
    } else {
      db.favorites.push({
        id: "fav-" + Date.now(),
        userId,
        propertyId,
        createdAt: new Date().toISOString(),
      });
      this.save();
      return true; // added
    }
  }

  public getUserFavorites(userId: string): PublicProperty[] {
    const db = this.init();
    const propIds = new Set(db.favorites.filter((f) => f.userId === userId).map((f) => f.propertyId));
    return db.properties
      .filter((p) => propIds.has(p.id) && p.status === "published")
      .map((p) => this.toPublicProperty(p, db.users));
  }

  public isPropertyFavorited(userId: string, propertyId: string): boolean {
    const db = this.init();
    return db.favorites.some((f) => f.userId === userId && f.propertyId === propertyId);
  }

  public createSavedSearch(userId: string, name: string, filters: PropertyFilterParams): SavedSearch {
    const db = this.init();
    const id = "search-" + Date.now();
    const saved: SavedSearch = {
      id,
      userId,
      name,
      filters,
      notifyNewListings: true,
      createdAt: new Date().toISOString(),
    };
    db.savedSearches.unshift(saved);
    this.save();
    return saved;
  }

  public getUserSavedSearches(userId: string): SavedSearch[] {
    const db = this.init();
    return db.savedSearches.filter((s) => s.userId === userId);
  }

  public deleteSavedSearch(id: string, userId: string): void {
    const db = this.init();
    db.savedSearches = db.savedSearches.filter((s) => !(s.id === id && s.userId === userId));
    this.save();
  }

  // ============================================================================
  // Taxonomy: Cities & Districts
  // ============================================================================

  public getCities(): City[] {
    const db = this.init();
    return db.cities;
  }

  public getDistricts(cityId?: string): District[] {
    const db = this.init();
    if (cityId) return db.districts.filter((d) => d.cityId === cityId);
    return db.districts;
  }

  // ============================================================================
  // Users & Authentication
  // ============================================================================

  public findUserByEmail(email: string): User | null {
    if (!email) return null;
    let db = this.init();
    const targetNorm = normalizeEmail(email);
    if (!targetNorm) return null;
    let found = db.users.find((u) => u.email && normalizeEmail(u.email) === targetNorm);
    if (!found) {
      this.reloadFromDisk();
      found = this.state?.users.find((u) => u.email && normalizeEmail(u.email) === targetNorm);
    }
    return found || null;
  }

  public findUserByPhone(phone: string): User | null {
    if (!phone) return null;
    let db = this.init();
    const targetNorm = normalizeEgyptianPhone(phone);
    if (!targetNorm) return null;
    let found = db.users.find((u) => u.phone && normalizeEgyptianPhone(u.phone) === targetNorm);
    if (!found) {
      this.reloadFromDisk();
      found = this.state?.users.find((u) => u.phone && normalizeEgyptianPhone(u.phone) === targetNorm);
    }
    return found || null;
  }

  public findUserByEmailOrPhone(identifier: string): User | null {
    if (!identifier) return null;
    const trimmed = identifier.trim();
    if (trimmed.includes("@")) {
      return this.findUserByEmail(trimmed);
    }
    return this.findUserByPhone(trimmed);
  }

  public findUserById(id: string): User | null {
    if (!id) return null;
    let db = this.init();
    let found = db.users.find((u) => u.id === id);
    if (!found) {
      this.reloadFromDisk();
      found = this.state?.users.find((u) => u.id === id);
    }
    return found || null;
  }

  public getUsers(): User[] {
    const db = this.init();
    return db.users || [];
  }

  public ensureUser(user: User): User {
    const db = this.init();
    const existingIndex = db.users.findIndex((u) => u.id === user.id);
    if (existingIndex >= 0) {
      db.users[existingIndex] = { ...db.users[existingIndex], ...user };
    } else {
      db.users.push(user);
    }
    this.save();
    return user;
  }

  public createUser(userData: Omit<User, "id" | "createdAt"> & { id?: string }): User {
    const db = this.init();

    // Strict duplicate check on email
    if (userData.email) {
      const existingEmail = this.findUserByEmail(userData.email);
      if (existingEmail) {
        throw new Error("البريد الإلكتروني مسجل بالفعل مسبقاً في المنصة");
      }
    }

    // Strict duplicate check on phone
    if (userData.phone) {
      const existingPhone = this.findUserByPhone(userData.phone);
      if (existingPhone) {
        throw new Error("رقم الهاتف مسجل بالفعل في حساب آخر في المنصة");
      }
    }

    const id = userData.id || ("user-" + Date.now().toString(36) + "-" + Math.random().toString(36).substring(2, 6));
    const newUser: User = {
      ...userData,
      id,
      createdAt: new Date().toISOString(),
    };
    this.state!.users.push(newUser);
    this.save();
    return newUser;
  }

  public updateUserPassword(
    identifierOrId: string,
    passwordHash: string,
    passwordSalt: string
  ): User | null {
    const db = this.init();
    const clean = identifierOrId.trim();
    let user = db.users.find(
      (u) =>
        u.id === clean ||
        (u.email && normalizeEmail(u.email) === normalizeEmail(clean)) ||
        (u.phone && normalizeEgyptianPhone(u.phone) === normalizeEgyptianPhone(clean))
    );

    if (!user) {
      this.reloadFromDisk();
      user = this.state?.users.find(
        (u) =>
          u.id === clean ||
          (u.email && normalizeEmail(u.email) === normalizeEmail(clean)) ||
          (u.phone && normalizeEgyptianPhone(u.phone) === normalizeEgyptianPhone(clean))
      );
    }

    if (user) {
      user.passwordHash = passwordHash;
      user.passwordSalt = passwordSalt;
      this.save();
      return user;
    }

    return null;
  }

  public getAllUsersForAdmin(): User[] {
    const db = this.init();
    return db.users;
  }

  public suspendUser(userId: string, isSuspended: boolean, actorUser: User, reason?: string): User {
    const db = this.init();
    if (actorUser.role !== "admin") {
      throw new Error("غير مصرح، يتطلب صلاحية مدير النظام");
    }

    // Safety Invariant: Prevent self-suspension
    if (userId === actorUser.id) {
      throw new Error("لا يمكن للمشرف تعليق حسابه الشخصي");
    }

    let user = db.users.find((u) => u.id === userId);
    if (!user) {
      this.reloadFromDisk();
      user = this.state?.users.find((u) => u.id === userId);
    }
    if (!user) throw new Error("المستخدم غير موجود");

    // Safety Invariant: Prevent suspending the last remaining active administrator
    if (user.role === "admin" && isSuspended) {
      const activeAdmins = db.users.filter((u) => u.role === "admin" && !u.isSuspended && u.id !== userId);
      if (activeAdmins.length === 0) {
        throw new Error("لا يمكن تعليق آخر مشرف نشط في النظام");
      }
    }

    if (isSuspended && (!reason || !reason.trim())) {
      throw new Error("سبب تعليق الحساب إلزامي");
    }

    user.isSuspended = isSuspended;
    user.suspensionReason = isSuspended ? reason?.trim() : undefined;

    this.recordAuditEvent(
      actorUser.id,
      isSuspended ? "SUSPEND_USER" : "REACTIVATE_USER",
      "user",
      userId,
      { reason: reason?.trim(), targetEmail: user.email, targetRole: user.role }
    );
    this.save();
    return user;
  }

  // ============================================================================
  // Property Reports & Complaints
  // ============================================================================

  public createPropertyReport(data: {
    propertyId: string;
    reporterId?: string;
    reporterName?: string;
    reporterPhone?: string;
    reasonCategory: ReportReasonCategory;
    details: string;
  }): PropertyReport {
    const db = this.init();
    const prop = db.properties.find((p) => p.id === data.propertyId || p.slug === data.propertyId);
    if (!prop && !/^[a-zA-Z0-9_-]{4,}$/.test(data.propertyId)) {
      throw new Error("العقار المُبلّغ عنه غير موجود");
    }

    if (!data.details || !data.details.trim()) {
      throw new Error("تفاصيل البلاغ مطلوبة");
    }

    const cleanDetails = data.details.trim();
    const resolvedPropId = prop ? prop.id : data.propertyId;
    if (!db.reports) db.reports = [];

    // Idempotency guard against network retries / double-clicks within 30s
    const duplicateExisting = db.reports.find((r) => {
      const sameProp = r.propertyId === resolvedPropId || r.propertyId === data.propertyId;
      const sameReporter =
        (data.reporterId && r.reporterId === data.reporterId) ||
        (!data.reporterId && data.reporterPhone && r.reporterPhone === data.reporterPhone);
      const sameContent = r.reasonCategory === data.reasonCategory && r.details === cleanDetails;
      const ageMs = Date.now() - new Date(r.createdAt || 0).getTime();
      return sameProp && sameReporter && sameContent && ageMs >= 0 && ageMs < 30000;
    });
    if (duplicateExisting) {
      return duplicateExisting;
    }

    const report: PropertyReport = {
      id: "rep-" + Date.now().toString(36) + "-" + Math.random().toString(36).substring(2, 6),
      propertyId: resolvedPropId,
      reporterId: data.reporterId,
      reporterName: data.reporterName || "مستخدم مجهول",
      reporterPhone: data.reporterPhone,
      reasonCategory: data.reasonCategory,
      details: cleanDetails,
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.reports.unshift(report);

    this.recordAuditEvent(
      data.reporterId,
      "CREATE_REPORT",
      "property_report",
      report.id,
      { propertyId: resolvedPropId, reasonCategory: data.reasonCategory }
    );
    this.save();
    return report;
  }

  public getPropertyReports(filters?: { status?: ReportStatus; propertyId?: string }): PropertyReport[] {
    const db = this.init();
    let reports = db.reports || [];
    if (filters?.status) {
      reports = reports.filter((r) => r.status === filters.status);
    }
    if (filters?.propertyId) {
      reports = reports.filter((r) => r.propertyId === filters.propertyId);
    }
    return reports;
  }

  public resolvePropertyReport(
    reportId: string,
    status: ReportStatus,
    adminUser: User,
    resolutionNotes?: string
  ): PropertyReport {
    const db = this.init();
    if (adminUser.role !== "admin") {
      throw new Error("غير مصرح، يتطلب صلاحية مدير النظام");
    }

    if (!db.reports) db.reports = [];
    let report = db.reports.find((r) => r.id === reportId);
    if (!report) {
      this.reloadFromDisk();
      report = this.state?.reports?.find((r) => r.id === reportId);
    }
    if (!report) throw new Error("البلاغ غير موجود");

    const previousStatus = report.status;
    report.status = status;
    report.resolutionNotes = resolutionNotes?.trim();
    report.resolvedBy = adminUser.id;
    report.resolvedAt = new Date().toISOString();
    report.updatedAt = new Date().toISOString();

    this.recordAuditEvent(
      adminUser.id,
      "RESOLVE_REPORT",
      "property_report",
      reportId,
      { previousStatus, newStatus: status, resolutionNotes, propertyId: report.propertyId }
    );
    this.save();
    return report;
  }

  // ============================================================================
  // Auditing & Admin Stats
  // ============================================================================

  public recordAuditEvent(
    userId: string | undefined,
    action: string,
    entityType: string,
    entityId: string,
    details: Record<string, unknown>
  ): void {
    const db = this.init();
    if (!db.auditEvents) db.auditEvents = [];
    db.auditEvents.unshift({
      id: "audit-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
      userId,
      action,
      entityType,
      entityId,
      details,
      timestamp: new Date().toISOString(),
    });
    // Keep last 500 audit events
    if (db.auditEvents.length > 500) {
      db.auditEvents = db.auditEvents.slice(0, 500);
    }
    this.save();
  }

  public getAuditEvents(limit = 50): AuditEvent[] {
    const db = this.init();
    return (db.auditEvents || []).slice(0, limit);
  }

  // ============================================================================
  // CRM: Client & Broker Records for the Management Dashboard
  // ============================================================================

  public getClientRecords(): StoredClientRecord[] {
    const db = this.init();
    return db.clientRecords || [];
  }

  public createClientRecord(
    data: Omit<StoredClientRecord, "id" | "createdAt" | "updatedAt">,
    actorUser?: User
  ): StoredClientRecord {
    const db = this.init();
    if (!db.clientRecords) db.clientRecords = [];
    const now = new Date().toISOString();
    const record: StoredClientRecord = {
      ...data,
      id: "crm-" + Date.now() + "-" + Math.random().toString(36).substring(2, 8),
      createdBy: actorUser?.name,
      createdAt: now,
      updatedAt: now,
    };
    db.clientRecords.unshift(record);
    if (actorUser) {
      this.recordAuditEvent(actorUser.id, "CRM_RECORD_CREATED", "crm", record.id, {
        type: record.type,
        name: record.name,
        adminEmail: actorUser.email,
      });
    }
    this.save();
    return record;
  }

  public updateClientRecord(
    id: string,
    updates: Partial<StoredClientRecord>,
    actorUser?: User
  ): StoredClientRecord {
    const db = this.init();
    if (!db.clientRecords) db.clientRecords = [];
    const record = db.clientRecords.find((r) => r.id === id);
    if (!record) throw new Error("السجل غير موجود");
    Object.assign(record, updates, { updatedAt: new Date().toISOString() });
    if (actorUser) {
      this.recordAuditEvent(actorUser.id, "CRM_RECORD_UPDATED", "crm", record.id, {
        type: record.type,
        name: record.name,
        adminEmail: actorUser.email,
      });
    }
    this.save();
    return record;
  }

  public deleteClientRecord(id: string, actorUser?: User): boolean {
    const db = this.init();
    if (!db.clientRecords) db.clientRecords = [];
    const index = db.clientRecords.findIndex((r) => r.id === id);
    if (index === -1) throw new Error("السجل غير موجود");
    const [removed] = db.clientRecords.splice(index, 1);
    if (actorUser) {
      this.recordAuditEvent(actorUser.id, "CRM_RECORD_DELETED", "crm", id, {
        type: removed.type,
        name: removed.name,
        adminEmail: actorUser.email,
      });
    }
    this.save();
    return true;
  }

  // ============================================================================
  // Project Audit Log: full lifecycle record per project (who approved, edited, deleted)
  // ============================================================================

  public recordProjectAudit(
    projectId: string,
    projectTitle: string,
    action: ProjectAuditAction,
    actorUser: User,
    details?: Record<string, unknown>
  ): void {
    const db = this.init();
    if (!db.projectAuditLog) db.projectAuditLog = [];
    db.projectAuditLog.unshift({
      id: "paudit-" + Date.now() + "-" + Math.random().toString(36).substring(2, 8),
      projectId,
      projectTitle,
      action,
      actorId: actorUser.id,
      actorName: actorUser.name,
      details,
      createdAt: new Date().toISOString(),
    });
    if (db.projectAuditLog.length > 1000) {
      db.projectAuditLog = db.projectAuditLog.slice(0, 1000);
    }
    this.save();
  }

  public getProjectAuditLog(projectId?: string): ProjectAuditEntry[] {
    const db = this.init();
    const log = db.projectAuditLog || [];
    return projectId ? log.filter((e) => e.projectId === projectId) : log;
  }

  public getAdminStats(): {
    totalUsers: number;
    seekersCount: number;
    ownersCount: number;
    brokersCount: number;
    adminsCount: number;
    verifiedUsersCount: number;
    suspendedUsersCount: number;
    totalProperties: number;
    pendingReviewCount: number;
    publishedCount: number;
    rejectedCount: number;
    draftsCount: number;
    archivedCount: number;
    soldCount: number;
    totalPropertyViews: number;
    totalFavoritesCount: number;
    totalAdvertisers: number;
    activeAdvertisers: number;
    suspendedAdvertisers: number;
    totalInquiries: number;
    newInquiriesCount: number;
    contactedInquiriesCount: number;
    viewingScheduledCount: number;
    negotiatingCount: number;
    dealClosedCount: number;
    closedInquiriesCount: number;
    spamInquiriesCount: number;
    respondedInquiriesCount: number;
    responseRatePercent: number;
    viewingConversionPercent: number;
    dealConversionPercent: number;
    totalMessagesCount: number;
    pendingReportsCount: number;
    investigatingReportsCount: number;
    resolvedReportsCount: number;
    dismissedReportsCount: number;
    totalReportsCount: number;
    reportResolutionRatePercent: number;
    deletionRequestsCount: number;
  } {
    const db = this.init();
    const advertisers = db.users.filter((u) => u.role === "owner" || u.role === "broker");
    const reports = db.reports || [];
    const notices = db.officialNotices || [];
    const inquiries = db.inquiries || [];

    const totalInquiries = inquiries.length;
    const newInquiriesCount = inquiries.filter((i) => i.status === "new").length;
    const contactedInquiriesCount = inquiries.filter((i) => i.status === "contacted").length;
    const viewingScheduledCount = inquiries.filter((i) => i.status === "viewing_scheduled").length;
    const negotiatingCount = inquiries.filter((i) => i.status === "negotiating").length;
    const dealClosedCount = inquiries.filter((i) => i.status === "deal_closed").length;
    const closedInquiriesCount = inquiries.filter((i) => i.status === "closed").length;
    const spamInquiriesCount = inquiries.filter((i) => i.status === "spam").length;

    const respondedInquiriesCount = inquiries.filter(
      (i) =>
        i.status !== "new" ||
        (Array.isArray(i.messages) &&
          i.messages.some((m) => m.senderRole === "owner" || m.senderRole === "broker"))
    ).length;

    const responseRatePercent =
      totalInquiries > 0 ? Math.round((respondedInquiriesCount / totalInquiries) * 100) : 0;

    const progressedToViewingCount = viewingScheduledCount + negotiatingCount + dealClosedCount;
    const viewingConversionPercent =
      totalInquiries > 0 ? Math.round((progressedToViewingCount / totalInquiries) * 100) : 0;
    const dealConversionPercent =
      totalInquiries > 0 ? Math.round((dealClosedCount / totalInquiries) * 100) : 0;

    const totalMessagesCount = inquiries.reduce(
      (acc, i) => acc + (Array.isArray(i.messages) && i.messages.length > 0 ? i.messages.length : 1),
      0
    );

    const totalPropertyViews = db.properties.reduce((acc, p) => acc + (Number(p.viewsCount) || 0), 0);

    const resolvedReportsCount = reports.filter((r) => r.status === "resolved").length;
    const dismissedReportsCount = reports.filter((r) => r.status === "dismissed").length;
    const investigatingReportsCount = reports.filter((r) => r.status === "investigating").length;
    const pendingReportsCount = reports.filter(
      (r) => r.status === "pending" || r.status === "investigating"
    ).length;
    const reportResolutionRatePercent =
      reports.length > 0
        ? Math.round(((resolvedReportsCount + dismissedReportsCount) / reports.length) * 100)
        : 0;

    return {
      totalUsers: db.users.length,
      seekersCount: db.users.filter((u) => u.role === "seeker" || u.role === "buyer").length,
      ownersCount: db.users.filter((u) => u.role === "owner").length,
      brokersCount: db.users.filter((u) => u.role === "broker").length,
      adminsCount: db.users.filter((u) => u.role === "admin").length,
      verifiedUsersCount: db.users.filter((u) => !!u.isVerified).length,
      suspendedUsersCount: db.users.filter((u) => !!u.isSuspended).length,
      totalProperties: db.properties.length,
      pendingReviewCount: db.properties.filter((p) => p.status === "pending_review").length,
      publishedCount: db.properties.filter((p) => p.status === "published" || p.status === ("active" as any)).length,
      rejectedCount: db.properties.filter((p) => p.status === "rejected").length,
      draftsCount: db.properties.filter((p) => p.status === "draft").length,
      archivedCount: db.properties.filter((p) => p.status === "archived").length,
      soldCount: db.properties.filter((p) => p.status === "sold" || p.status === "rented").length,
      totalPropertyViews,
      totalFavoritesCount: (db.favorites || []).length,
      totalAdvertisers: advertisers.length,
      activeAdvertisers: advertisers.filter((u) => !u.isSuspended).length,
      suspendedAdvertisers: advertisers.filter((u) => !!u.isSuspended).length,
      totalInquiries,
      newInquiriesCount,
      contactedInquiriesCount,
      viewingScheduledCount,
      negotiatingCount,
      dealClosedCount,
      closedInquiriesCount,
      spamInquiriesCount,
      respondedInquiriesCount,
      responseRatePercent,
      viewingConversionPercent,
      dealConversionPercent,
      totalMessagesCount,
      pendingReportsCount,
      investigatingReportsCount,
      resolvedReportsCount,
      dismissedReportsCount,
      totalReportsCount: reports.length,
      reportResolutionRatePercent,
      deletionRequestsCount: notices.filter((n) => n.type === "deletion_request" && n.status === "unread").length,
    };
  }

  // ============================================================================
  // User Profile & Role Administration
  // ============================================================================

  public updateUserProfile(
    userId: string,
    updates: {
      name?: string;
      phone?: string;
      avatarUrl?: string;
      whatsappEnabled?: boolean;
      licenseNumber?: string;
      companyName?: string;
      bio?: string;
    }
  ): User {
    const db = this.init();
    const user = db.users.find((u) => u.id === userId);
    if (!user) throw new Error("المستخدم غير موجود");

    if (updates.name !== undefined && updates.name.trim()) {
      user.name = updates.name.trim();
    }
    if (updates.bio !== undefined) {
      user.bio = updates.bio.trim();
    }
    if (updates.phone !== undefined && updates.phone.trim()) {
      const targetNorm = normalizeEgyptianPhone(updates.phone.trim());
      const duplicate = db.users.find(
        (u) => u.id !== userId && u.phone && normalizeEgyptianPhone(u.phone) === targetNorm
      );
      if (duplicate) {
        throw new Error("رقم الهاتف مسجل بالفعل لدى مستخدم آخر في المنصة");
      }
      user.phone = targetNorm || updates.phone.trim();
    }
    if (updates.avatarUrl !== undefined) {
      user.avatarUrl = updates.avatarUrl.trim();
    }
    if (updates.whatsappEnabled !== undefined) {
      user.whatsappEnabled = updates.whatsappEnabled;
    }
    if (updates.licenseNumber !== undefined) {
      user.licenseNumber = updates.licenseNumber.trim();
    }
    if (updates.companyName !== undefined) {
      user.companyName = updates.companyName.trim();
    }

    this.recordAuditEvent(userId, "USER_PROFILE_UPDATED", "user", userId, {
      updatedFields: Object.keys(updates),
    });
    this.save();
    return user;
  }

  public updateUser(userId: string, updates: Partial<User>): User {
    const db = this.init();
    const user = db.users.find((u) => u.id === userId);
    if (!user) throw new Error("المستخدم غير موجود");

    Object.assign(user, updates);
    this.save();
    return user;
  }

  public upgradeUserRole(
    userId: string,
    targetRole: "owner" | "broker",
    details?: { companyName?: string; licenseNumber?: string; nationalId?: string }
  ): User {
    const db = this.init();
    const user = db.users.find((u) => u.id === userId);
    if (!user) throw new Error("المستخدم غير موجود");

    const oldRole = user.role;
    user.role = targetRole;
    // Self-service upgrade never grants verified status; requires administrator verification
    user.isVerified = false;

    if (details?.companyName && targetRole === "broker") {
      user.companyName = details.companyName.trim();
    }
    if (details?.licenseNumber && targetRole === "broker") {
      user.licenseNumber = details.licenseNumber.trim();
    }
    if (details?.nationalId && targetRole === "owner") {
      user.nationalId = details.nationalId.trim();
    }

    this.recordAuditEvent(userId, "UPGRADE_USER_ROLE", "user", userId, {
      oldRole,
      newRole: targetRole,
      isVerified: false,
    });
    this.save();
    return user;
  }

  public verifyBrokerOrUser(
    targetUserId: string,
    isVerified: boolean,
    actorUser: User,
    reason?: string
  ): User {
    const db = this.init();
    if (actorUser.role !== "admin") {
      throw new Error("غير مصرح، يتطلب صلاحية مدير النظام لتوثيق واعتماد الحسابات");
    }
    const user = db.users.find((u) => u.id === targetUserId);
    if (!user) throw new Error("المستخدم المستهدف غير موجود");

    const previousVerified = Boolean(user.isVerified);
    user.isVerified = isVerified;

    this.recordAuditEvent(actorUser.id, "VERIFY_USER", "user", targetUserId, {
      previousVerified,
      isVerified,
      reason: reason?.trim() || "اعتماد إدارة منصة دار العقار",
    });
    this.save();
    return user;
  }

  public changeUserRole(
    targetUserId: string,
    newRole: UserRole,
    actorUser: User,
    reason: string
  ): User {
    const db = this.init();
    if (actorUser.role !== "admin") {
      throw new Error("غير مصرح، يتطلب صلاحية مدير النظام");
    }
    if (!reason || !reason.trim()) {
      throw new Error("سبب تعديل الدور إلزامي للتدقيق الأمني");
    }
    const user = db.users.find((u) => u.id === targetUserId);
    if (!user) throw new Error("المستخدم المستهدف غير موجود");

    // Safety Invariant: Prevent demoting the last remaining active administrator
    if (user.role === "admin" && newRole !== "admin") {
      const activeAdmins = db.users.filter(
        (u) => u.role === "admin" && !u.isSuspended && u.id !== targetUserId
      );
      if (activeAdmins.length === 0) {
        throw new Error("لا يمكن تغيير دور آخر مشرف نشط في النظام");
      }
    }

    const oldRole = user.role;
    user.role = newRole;

    this.recordAuditEvent(actorUser.id, "CHANGE_USER_ROLE", "user", targetUserId, {
      oldRole,
      newRole,
      reason: reason.trim(),
    });
    this.save();
    return user;
  }

  // ============================================================================
  // CMS & Content Management System
  // ============================================================================

  public getCmsHomepageSettings(): CmsHomepageSettings {
    const db = this.init();
    const replaceLegacyBrand = (value: string) =>
      value
        .replaceAll("نبض العقار", "دار العقار")
        .replaceAll("AqarPulse Egypt", "Dar Al Aqar Egypt")
        .replaceAll("AqarPulse", "Dar Al Aqar");
    const replaceOptionalLegacyBrand = (value?: string) =>
      value ? replaceLegacyBrand(value) : undefined;

    const defaultVisualIdentity = DEFAULT_VISUAL_IDENTITY;

    const defaultSettings: CmsHomepageSettings = {
      heroBadgeText: "عقارات مركز ميت غمر وقراه",
      heroTitleLine1: "اعثر على عقارك المناسب",
      heroTitleLine2: "في ميت غمر وقراها",
      heroDescription:
        "استكشف العقارات في مركز ميت غمر وقراه، وتواصل مباشرة مع الملاك والوسطاء المعتمدين.",
      heroCtaText: "استكشف الخريطة",
      heroCtaLink: "/explore",
      bannerTitle: "تصفح العقارات عبر الخريطة التفاعلية المقسمة",
      bannerSubtitle:
        "شاهد مواقع الفيلات والشقق الفعلية مع حماية خصوصية العناوين، قارن الأسعار الجغرافية لكل متر مربع وتعرّف على الخدمات والمحاور المحيطة بكل عقار في وقت حقيقي.",
      bannerCtaText: "فتح الخريطة التفاعلية الآن",
      sectionOrder: ["hero", "map_banner", "categories", "featured", "recent", "features"],
      sectionVisibility: {
        hero: true,
        map_banner: true,
        categories: true,
        featured: true,
        recent: true,
        features: true,
      },
      navLabels: {
        brandTitle: "دار العقار",
        brandSubtitle: "Dar Al Aqar Egypt",
        home: "الرئيسية",
        propertiesDropdown: "العقارات",
        sale: "بيع",
        rent: "إيجار",
        projects: "المشاريع العقارية",
        explore: "الخريطة الذكية",
        smartMatch: "التوافق الذكي",
        about: "عن منصة دار العقار",
        contact: "اتصل بنا",
        terms: "الشروط والأحكام",
        privacy: "سياسة الخصوصية وأمن البيانات",
        addProperty: "أضف عقارك",
      },
      visualIdentity: defaultVisualIdentity,
      contactPhone: "+201001234567",
      contactEmail: "info@aqarpulse.eg",
      contactWhatsApp: "+201001234567",
      metaTitle: "دار العقار | المنصة العقارية الذكية والخريطة التفاعلية في مصر",
      metaDescription:
        "منصة عقارية مصرية ذكية بالخرائط التفاعلية وتحليلات الموقع وحماية الخصوصية.",
      featuredPropertyIds: [],
      isPublished: true,
      updatedAt: new Date().toISOString(),
      updatedBy: "system",
    };

    if (db.cmsHomepage) {
      const legacyBrand = db.cmsHomepage.visualIdentity?.siteName === "نبض العقار";
      const storedSettings = {
        ...db.cmsHomepage,
        heroBadgeText: replaceLegacyBrand(db.cmsHomepage.heroBadgeText || defaultSettings.heroBadgeText),
        heroTitleLine1: replaceLegacyBrand(db.cmsHomepage.heroTitleLine1 || defaultSettings.heroTitleLine1),
        heroTitleLine2: replaceLegacyBrand(db.cmsHomepage.heroTitleLine2 || defaultSettings.heroTitleLine2),
        heroDescription: replaceLegacyBrand(db.cmsHomepage.heroDescription || defaultSettings.heroDescription),
        heroCtaText: replaceLegacyBrand(db.cmsHomepage.heroCtaText || defaultSettings.heroCtaText),
        bannerTitle: replaceLegacyBrand(db.cmsHomepage.bannerTitle || defaultSettings.bannerTitle),
        bannerSubtitle: replaceLegacyBrand(db.cmsHomepage.bannerSubtitle || defaultSettings.bannerSubtitle),
        bannerCtaText: replaceLegacyBrand(db.cmsHomepage.bannerCtaText || defaultSettings.bannerCtaText),
        metaTitle: replaceLegacyBrand(db.cmsHomepage.metaTitle || defaultSettings.metaTitle),
        metaDescription: replaceLegacyBrand(db.cmsHomepage.metaDescription || defaultSettings.metaDescription),
        navLabels: {
          ...db.cmsHomepage.navLabels,
          brandTitle: replaceOptionalLegacyBrand(db.cmsHomepage.navLabels?.brandTitle) || defaultSettings.navLabels?.brandTitle,
          brandSubtitle: replaceOptionalLegacyBrand(db.cmsHomepage.navLabels?.brandSubtitle) || defaultSettings.navLabels?.brandSubtitle,
          about: replaceOptionalLegacyBrand(db.cmsHomepage.navLabels?.about) || defaultSettings.navLabels?.about,
        },
        visualIdentity: {
          ...db.cmsHomepage.visualIdentity,
          siteName: replaceLegacyBrand(db.cmsHomepage.visualIdentity?.siteName || defaultVisualIdentity.siteName),
          siteSubtitle: replaceLegacyBrand(db.cmsHomepage.visualIdentity?.siteSubtitle || defaultVisualIdentity.siteSubtitle),
          logoType: db.cmsHomepage.visualIdentity?.logoType || defaultVisualIdentity.logoType,
          logoImageUrl: db.cmsHomepage.visualIdentity?.logoImageUrl || defaultVisualIdentity.logoImageUrl,
          logoHeightPx: db.cmsHomepage.visualIdentity?.logoHeightPx || defaultVisualIdentity.logoHeightPx,
          appIconUrl: db.cmsHomepage.visualIdentity?.appIconUrl || defaultVisualIdentity.appIconUrl,
          faviconUrl: db.cmsHomepage.visualIdentity?.faviconUrl || defaultVisualIdentity.faviconUrl,
          headerBackground: db.cmsHomepage.visualIdentity?.headerBackground === "glass"
            ? "white"
            : db.cmsHomepage.visualIdentity?.headerBackground || defaultVisualIdentity.headerBackground,
          ...(legacyBrand
            ? {
                logoType: "image" as const,
                logoImageUrl: "/branding/dar-al-aqar.png",
                headerBackground: "white" as const,
              }
            : {}),
        },
      };
      const normalizedSettings: CmsHomepageSettings = {
        ...defaultSettings,
        ...storedSettings,
        navLabels: { ...defaultSettings.navLabels, ...storedSettings.navLabels },
        visualIdentity: { ...defaultVisualIdentity, ...storedSettings.visualIdentity },
      };
      db.cmsHomepage = normalizedSettings;
      return normalizedSettings;
    }

    db.cmsHomepage = defaultSettings;
    return defaultSettings;
  }

  public async getCmsHomepageSettingsAsync(): Promise<CmsHomepageSettings> {
    const payload = await this.readCentralCmsSetting("homepage");
    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
      this.init().cmsHomepage = payload as CmsHomepageSettings;
    }
    return this.getCmsHomepageSettings();
  }

  public async getCmsHomepageSettingsForDisplayAsync(): Promise<CmsHomepageSettings> {
    try {
      return await this.getCmsHomepageSettingsAsync();
    } catch (error) {
      console.error("[CMS] Failed to load homepage settings for rendering:", error);
      return this.getCmsHomepageSettings();
    }
  }

  public async getCmsHomepageSettingsForAdminAsync(): Promise<{
    settings: CmsHomepageSettings;
    persistenceAvailable: boolean;
    error?: string;
  }> {
    try {
      const settings = await this.getCmsHomepageSettingsAsync();
      const persistenceAvailable = this.isLocalDiskPersistenceAllowed() || this.hasCentralCmsConfiguration();
      return {
        settings,
        persistenceAvailable,
        error: persistenceAvailable
          ? undefined
          : "إعدادات قاعدة البيانات المركزية غير متوفرة؛ لن يتم تفعيل الحفظ حتى استعادة الاتصال.",
      };
    } catch (error) {
      console.error("[CMS] Failed to load homepage settings in admin:", error);
      return {
        settings: this.getCmsHomepageSettings(),
        persistenceAvailable: false,
        error: error instanceof Error
          ? error.message
          : "تعذر الاتصال بمخزن الهوية المركزي.",
      };
    }
  }

  public updateCmsHomepageSettings(
    updates: Partial<CmsHomepageSettings>,
    actorUser: User
  ): CmsHomepageSettings {
    const db = this.init();
    if (actorUser.role !== "admin") {
      throw new Error("غير مصرح، إدارة المحتوى تتطلب صلاحية مسؤول النظام");
    }

    if (updates.visualIdentity) {
      const {
        primaryColor,
        primaryHoverColor,
        secondaryColor,
        accentColor,
        iconColor,
        mapIconColor,
        colorSchemePreset,
        headingWeight,
        logoImageUrl,
        logoHeightPx,
        appIconUrl,
        faviconUrl,
        fontFamily,
        logoType,
        logoIcon,
        headerBackground,
        borderRadius,
      } = updates.visualIdentity;
      for (const color of [primaryColor, primaryHoverColor, secondaryColor, accentColor, iconColor, mapIconColor]) {
        if (color !== undefined && !/^#[0-9a-fA-F]{6}$/.test(color)) {
          throw new Error("ألوان الهوية يجب أن تكون بصيغة HEX صحيحة مثل #047857");
        }
      }
      if (fontFamily !== undefined && !["cairo", "alexandria", "tajawal", "almarai", "ibm_plex"].includes(fontFamily)) {
        throw new Error("نوع الخط المحدد غير مدعوم");
      }
      if (logoType !== undefined && !["icon_text", "image", "text_only"].includes(logoType)) {
        throw new Error("نمط الشعار المحدد غير مدعوم");
      }
      if (logoHeightPx !== undefined &&
        (!Number.isInteger(logoHeightPx) || logoHeightPx < 32 || logoHeightPx > 80)) {
        throw new Error("حجم الشعار يجب أن يكون عدداً صحيحاً بين 32 و80 بكسل");
      }
      if (logoIcon !== undefined && !["building", "map_pin", "sparkles", "compass", "shield", "home", "crown", "layers"].includes(logoIcon)) {
        throw new Error("أيقونة الشعار المحددة غير مدعومة");
      }
      if (headerBackground !== undefined && !["glass", "white", "dark"].includes(headerBackground)) {
        throw new Error("نمط خلفية الرأس المحدد غير مدعوم");
      }
      if (borderRadius !== undefined && !["curved", "soft", "rounded"].includes(borderRadius)) {
        throw new Error("نمط الحواف المحدد غير مدعوم");
      }
      if (colorSchemePreset !== undefined && !["emerald_pulse", "royal_blue", "luxury_gold", "modern_indigo", "midnight_slate", "custom"].includes(colorSchemePreset)) {
        throw new Error("مجموعة الألوان المحددة غير مدعومة");
      }
      if (headingWeight !== undefined && !["bold", "extrabold", "black"].includes(headingWeight)) {
        throw new Error("سماكة العناوين المحددة غير مدعومة");
      }
      for (const imageUrl of [logoImageUrl, appIconUrl, faviconUrl]) {
        if (imageUrl && !imageUrl.startsWith("/") && !/^https:\/\//i.test(imageUrl)) {
          throw new Error("روابط الصور يجب أن تكون مسارات محلية أو روابط HTTPS");
        }
      }
    }
    if (updates.heroCtaLink !== undefined &&
      (!updates.heroCtaLink.startsWith("/") || updates.heroCtaLink.startsWith("//"))) {
      throw new Error("رابط الزر الرئيسي يجب أن يكون مساراً داخلياً يبدأ بـ /");
    }

    const current = this.getCmsHomepageSettings();

    // Verify any curated featured properties are published
    if (updates.featuredPropertyIds) {
      const validIds = updates.featuredPropertyIds.filter((pid) => {
        const prop = db.properties.find((p) => p.id === pid);
        return prop && prop.status === "published";
      });
      updates.featuredPropertyIds = validIds;
    }

    const mergedNavLabels = updates.navLabels
      ? { ...(current.navLabels || {}), ...updates.navLabels }
      : current.navLabels;

    const mergedVisualIdentity = updates.visualIdentity
      ? { ...(current.visualIdentity || {}), ...updates.visualIdentity }
      : current.visualIdentity;

    const updated: CmsHomepageSettings = {
      ...current,
      ...updates,
      navLabels: mergedNavLabels,
      visualIdentity: mergedVisualIdentity,
      updatedAt: new Date().toISOString(),
      updatedBy: actorUser.name || actorUser.email || actorUser.phone || "Admin",
    };

    // Store revision for rollback support
    if (!db.cmsRevisions) db.cmsRevisions = [];
    db.cmsRevisions.unshift({
      id: "rev-hp-" + Date.now(),
      entityType: "homepage",
      entityId: "homepage_settings",
      data: { ...current },
      createdAt: new Date().toISOString(),
      createdBy: actorUser.name || actorUser.email || actorUser.phone || "Admin",
    });

    db.cmsHomepage = updated;
    this.recordAuditEvent(actorUser.id, "CMS_HOMEPAGE_UPDATED", "cms", "homepage_settings", {
      changedKeys: Object.keys(updates),
    });
    this.save();
    return updated;
  }

  public async updateCmsHomepageSettingsAsync(
    updates: Partial<CmsHomepageSettings>,
    actorUser: User
  ): Promise<CmsHomepageSettings> {
    if (actorUser.role !== "admin") {
      throw new Error("غير مصرح، إدارة المحتوى تتطلب صلاحية مسؤول النظام");
    }
    await this.getCmsHomepageSettingsAsync();
    const db = this.init();
    const previousSettings = db.cmsHomepage!;
    const previousRevisions = db.cmsRevisions?.slice();
    const previousAuditEvents = db.auditEvents.slice();
    const updated = this.updateCmsHomepageSettings(updates, actorUser);
    try {
      await this.writeCentralCmsSetting(
        "homepage",
        updated,
        actorUser.name || actorUser.email || actorUser.phone || "Admin"
      );
    } catch (error) {
      db.cmsHomepage = previousSettings;
      db.cmsRevisions = previousRevisions;
      db.auditEvents = previousAuditEvents;
      this.save();
      throw error;
    }
    return updated;
  }

  public getCmsPages(): CmsStaticPage[] {
    const db = this.init();
    if (db.cmsPages && db.cmsPages.length > 0) {
      db.cmsPages = db.cmsPages.map((page) => ({
        ...page,
        titleAr: page.titleAr.replaceAll("نبض العقار", "دار العقار").replaceAll("AqarPulse", "Dar Al Aqar"),
        contentAr: page.contentAr.replaceAll("نبض العقار", "دار العقار").replaceAll("AqarPulse", "Dar Al Aqar"),
        metaTitle: page.metaTitle?.replaceAll("نبض العقار", "دار العقار").replaceAll("AqarPulse", "Dar Al Aqar"),
        metaDescription: page.metaDescription?.replaceAll("نبض العقار", "دار العقار").replaceAll("AqarPulse", "Dar Al Aqar"),
      }));
      return db.cmsPages;
    }

    const defaultPages: CmsStaticPage[] = [
      {
        id: "page-about",
        slug: "about",
        titleAr: "عن منصة دار العقار",
        contentAr:
          "دار العقار هي المنصة الجغرافية الذكية في مصر المصممة للربط المباشر بين الباحثين والملاك والوسطاء العقاريين المعتمدين باستخدام أحدث تقنيات الخرائط المكانية والتحقق الموثوق.",
        metaTitle: "عن دار العقار | المنصة العقارية الذكية",
        metaDescription: "تعرف على رؤية دار العقار وفريق العمل.",
        isPublished: true,
        updatedAt: new Date().toISOString(),
        updatedBy: "system",
      },
      {
        id: "page-contact",
        slug: "contact",
        titleAr: "اتصل بنا",
        contentAr:
          "يسعدنا تواصلكم معنا عبر البريد الإلكتروني أو الهاتف أو واتساب للإجابة على استفساراتكم وتقديم الدعم الفني.",
        metaTitle: "اتصل بنا | دار العقار",
        metaDescription: "تواصل مع فريق دعم وخدمة عملاء دار العقار.",
        isPublished: true,
        updatedAt: new Date().toISOString(),
        updatedBy: "system",
      },
      {
        id: "page-terms",
        slug: "terms",
        titleAr: "الشروط والأحكام",
        contentAr:
          "شروط الاستخدام تحدد القواعد المنظمة لنشر العقارات، التحقق من التراخيص، ومنع الإعلانات المضللة أو المكررة على المنصة.",
        metaTitle: "الشروط والأحكام | دار العقار",
        metaDescription: "شروط وضوابط استخدام منصة دار العقار.",
        isPublished: true,
        updatedAt: new Date().toISOString(),
        updatedBy: "system",
      },
      {
        id: "page-privacy",
        slug: "privacy",
        titleAr: "سياسة الخصوصية وأمن البيانات",
        contentAr:
          "نلتزم بحماية خصوصية بيانات المستخدمين وعدم إفصاح العناوين الدقيقة للمنازل إلا بعد موافقة صريحة للمالك.",
        metaTitle: "سياسة الخصوصية | دار العقار",
        metaDescription: "سياسة حماية الخصوصية وأمن البيانات العقارية.",
        isPublished: true,
        updatedAt: new Date().toISOString(),
        updatedBy: "system",
      },
    ];

    db.cmsPages = defaultPages;
    return defaultPages;
  }

  public async getCmsPagesAsync(): Promise<CmsStaticPage[]> {
    const payload = await this.readCentralCmsSetting("pages");
    if (Array.isArray(payload)) {
      this.init().cmsPages = payload as CmsStaticPage[];
    }
    return this.getCmsPages();
  }

  public getCmsPage(slug: string): CmsStaticPage | null {
    const pages = this.getCmsPages();
    return pages.find((p) => p.slug === slug) || null;
  }

  public async getCmsPageAsync(slug: string): Promise<CmsStaticPage | null> {
    const pages = await this.getCmsPagesAsync();
    return pages.find((page) => page.slug === slug) || null;
  }

  public updateCmsPage(
    slug: string,
    data: Partial<CmsStaticPage>,
    actorUser: User
  ): CmsStaticPage {
    const db = this.init();
    if (actorUser.role !== "admin") {
      throw new Error("غير مصرح، تعديل صفحات المحتوى يتطلب صلاحية مسؤول النظام");
    }

    const pages = this.getCmsPages();
    let page = pages.find((p) => p.slug === slug);

    if (!page) {
      const newPage: CmsStaticPage = {
        id: "page-" + Date.now(),
        slug,
        titleAr: data.titleAr || slug,
        contentAr: data.contentAr || "",
        metaTitle: data.metaTitle,
        metaDescription: data.metaDescription,
        isPublished: data.isPublished !== undefined ? data.isPublished : true,
        updatedAt: new Date().toISOString(),
        updatedBy: actorUser.name || actorUser.email || actorUser.phone || "Admin",
      };
      if (!db.cmsPages) db.cmsPages = [];
      db.cmsPages.push(newPage);
      page = newPage;
    } else {
      // Store revision
      if (!db.cmsRevisions) db.cmsRevisions = [];
      db.cmsRevisions.unshift({
        id: "rev-pg-" + Date.now(),
        entityType: "page",
        entityId: slug,
        data: { ...page },
        createdAt: new Date().toISOString(),
        createdBy: actorUser.name || actorUser.email || actorUser.phone || "Admin",
      });

      if (data.titleAr !== undefined) page.titleAr = data.titleAr;
      if (data.contentAr !== undefined) page.contentAr = data.contentAr;
      if (data.metaTitle !== undefined) page.metaTitle = data.metaTitle;
      if (data.metaDescription !== undefined) page.metaDescription = data.metaDescription;
      if (data.isPublished !== undefined) page.isPublished = data.isPublished;
      page.updatedAt = new Date().toISOString();
      page.updatedBy = actorUser.name || actorUser.email || actorUser.phone || "Admin";
    }

    this.recordAuditEvent(actorUser.id, "CMS_PAGE_UPDATED", "cms", slug, {
      title: page.titleAr,
    });
    this.save();
    return page;
  }

  public async updateCmsPageAsync(
    slug: string,
    data: Partial<CmsStaticPage>,
    actorUser: User
  ): Promise<CmsStaticPage> {
    if (actorUser.role !== "admin") {
      throw new Error("غير مصرح، تعديل صفحات المحتوى يتطلب صلاحية مسؤول النظام");
    }
    const previousPages = (await this.getCmsPagesAsync()).map((page) => ({ ...page }));
    const db = this.init();
    const previousRevisions = db.cmsRevisions?.slice();
    const previousAuditEvents = db.auditEvents.slice();
    const updated = this.updateCmsPage(slug, data, actorUser);
    try {
      await this.writeCentralCmsSetting(
        "pages",
        this.getCmsPages(),
        actorUser.name || actorUser.email || actorUser.phone || "Admin"
      );
    } catch (error) {
      db.cmsPages = previousPages;
      db.cmsRevisions = previousRevisions;
      db.auditEvents = previousAuditEvents;
      this.save();
      throw error;
    }
    return updated;
  }

  public getCmsMediaAssets(): CmsMediaAsset[] {
    const db = this.init();
    return db.cmsMedia || [];
  }

  public async getCmsMediaAssetsAsync(): Promise<CmsMediaAsset[]> {
    const payload = await this.readCentralCmsSetting("media-assets");
    if (Array.isArray(payload)) {
      this.init().cmsMedia = payload as CmsMediaAsset[];
    }
    return this.getCmsMediaAssets();
  }

  public addCmsMediaAsset(asset: Omit<CmsMediaAsset, "id" | "createdAt" | "inUseCount">): CmsMediaAsset {
    const db = this.init();
    const newAsset: CmsMediaAsset = {
      ...asset,
      id: "media-" + Date.now().toString(36) + "-" + Math.random().toString(36).substring(2, 6),
      inUseCount: 0,
      createdAt: new Date().toISOString(),
    };
    if (!db.cmsMedia) db.cmsMedia = [];
    db.cmsMedia.unshift(newAsset);
    this.save();
    return newAsset;
  }

  public async addCmsMediaAssetAsync(
    asset: Omit<CmsMediaAsset, "id" | "createdAt" | "inUseCount">
  ): Promise<CmsMediaAsset> {
    const previousAssets = (await this.getCmsMediaAssetsAsync()).map((item) => ({ ...item }));
    const db = this.init();
    const created = this.addCmsMediaAsset(asset);
    try {
      await this.writeCentralCmsSetting("media-assets", this.getCmsMediaAssets(), created.uploadedBy);
    } catch (error) {
      db.cmsMedia = previousAssets;
      this.save();
      throw error;
    }
    return created;
  }

  public deleteCmsMediaAsset(id: string, actorUser: User): void {
    const db = this.init();
    if (actorUser.role !== "admin") {
      throw new Error("غير مصرح، حذف الوسائط يتطلب صلاحية مسؤول النظام");
    }
    const idx = (db.cmsMedia || []).findIndex((m) => m.id === id);
    if (idx === -1) throw new Error("ملف الوسائط غير موجود");

    const asset = db.cmsMedia![idx];
    if (asset.inUseCount > 0) {
      throw new Error("لا يمكن حذف ملف وسائط مستخدم بالفعل في صفحات منشورة");
    }

    db.cmsMedia!.splice(idx, 1);
    this.recordAuditEvent(actorUser.id, "CMS_MEDIA_DELETED", "cms", id, {
      fileName: asset.fileName,
      url: asset.url,
    });
    this.save();
  }

  public async deleteCmsMediaAssetAsync(id: string, actorUser: User): Promise<void> {
    if (actorUser.role !== "admin") {
      throw new Error("غير مصرح، حذف الوسائط يتطلب صلاحية مسؤول النظام");
    }
    const previousAssets = (await this.getCmsMediaAssetsAsync()).map((item) => ({ ...item }));
    const db = this.init();
    const previousAuditEvents = db.auditEvents.slice();
    this.deleteCmsMediaAsset(id, actorUser);
    try {
      await this.writeCentralCmsSetting(
        "media-assets",
        this.getCmsMediaAssets(),
        actorUser.name || actorUser.email || actorUser.phone || "Admin"
      );
    } catch (error) {
      db.cmsMedia = previousAssets;
      db.auditEvents = previousAuditEvents;
      this.save();
      throw error;
    }
  }

}

export const dbStore = new DataStore();
