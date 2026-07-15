export type HeroClockCityId =
  | "san-francisco"
  | "los-angeles"
  | "new-york"
  | "miami"
  | "chicago"
  | "curitiba"
  | "sao-paulo"
  | "rio-de-janeiro"
  | "brasilia"
  | "belo-horizonte"
  | "lisbon"
  | "london"
  | "paris"
  | "madrid"
  | "berlin"
  | "dubai"
  | "tokyo";

export type HeroClockCity = {
  id: HeroClockCityId;
  city: string;
  timeZone: string;
  abbrev: string;
};

export const HERO_CLOCK_CITIES: readonly HeroClockCity[] = [
  { id: "san-francisco", city: "San Francisco", timeZone: "America/Los_Angeles", abbrev: "PT" },
  { id: "los-angeles", city: "Los Angeles", timeZone: "America/Los_Angeles", abbrev: "PT" },
  { id: "new-york", city: "New York", timeZone: "America/New_York", abbrev: "ET" },
  { id: "miami", city: "Miami", timeZone: "America/New_York", abbrev: "ET" },
  { id: "chicago", city: "Chicago", timeZone: "America/Chicago", abbrev: "CT" },
  { id: "curitiba", city: "Curitiba", timeZone: "America/Sao_Paulo", abbrev: "BRT" },
  { id: "sao-paulo", city: "São Paulo", timeZone: "America/Sao_Paulo", abbrev: "BRT" },
  { id: "rio-de-janeiro", city: "Rio de Janeiro", timeZone: "America/Sao_Paulo", abbrev: "BRT" },
  { id: "brasilia", city: "Brasília", timeZone: "America/Sao_Paulo", abbrev: "BRT" },
  { id: "belo-horizonte", city: "Belo Horizonte", timeZone: "America/Sao_Paulo", abbrev: "BRT" },
  { id: "lisbon", city: "Lisbon", timeZone: "Europe/Lisbon", abbrev: "WET" },
  { id: "london", city: "London", timeZone: "Europe/London", abbrev: "GMT" },
  { id: "paris", city: "Paris", timeZone: "Europe/Paris", abbrev: "CET" },
  { id: "madrid", city: "Madrid", timeZone: "Europe/Madrid", abbrev: "CET" },
  { id: "berlin", city: "Berlin", timeZone: "Europe/Berlin", abbrev: "CET" },
  { id: "dubai", city: "Dubai", timeZone: "Asia/Dubai", abbrev: "GST" },
  { id: "tokyo", city: "Tokyo", timeZone: "Asia/Tokyo", abbrev: "JST" },
] as const;

const CITY_BY_ID = new Map(HERO_CLOCK_CITIES.map((c) => [c.id, c]));

/** Default matches the historical hero clocks (SF + Curitiba). */
export const DEFAULT_HERO_CLOCKS: HeroClocksPreference = {
  cityIds: ["san-francisco", "curitiba"],
};

export type HeroClocksPreference = {
  /** Length 1 or 2. */
  cityIds: HeroClockCityId[];
};

function isCityId(value: unknown): value is HeroClockCityId {
  return typeof value === "string" && CITY_BY_ID.has(value as HeroClockCityId);
}

export function parseHeroClocks(raw: unknown): HeroClocksPreference {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_HERO_CLOCKS, cityIds: [...DEFAULT_HERO_CLOCKS.cityIds] };

  const o = raw as Record<string, unknown>;
  const idsRaw = Array.isArray(o.cityIds) ? o.cityIds : null;
  if (!idsRaw) return { ...DEFAULT_HERO_CLOCKS, cityIds: [...DEFAULT_HERO_CLOCKS.cityIds] };

  const cityIds = idsRaw.filter(isCityId).slice(0, 2);
  if (cityIds.length === 0) {
    return { ...DEFAULT_HERO_CLOCKS, cityIds: [...DEFAULT_HERO_CLOCKS.cityIds] };
  }
  if (cityIds.length === 1) return { cityIds: [cityIds[0]!] };
  // Prefer distinct cities when possible
  if (cityIds[0] === cityIds[1]) {
    const fallback = DEFAULT_HERO_CLOCKS.cityIds.find((id) => id !== cityIds[0]) ?? "curitiba";
    return { cityIds: [cityIds[0]!, fallback] };
  }
  return { cityIds: [cityIds[0]!, cityIds[1]!] };
}

export function heroClocksToDb(pref: HeroClocksPreference): { cityIds: HeroClockCityId[] } {
  return parseHeroClocks(pref);
}

export function resolveHeroClockCities(pref: HeroClocksPreference | null | undefined): HeroClockCity[] {
  const parsed = parseHeroClocks(pref ?? DEFAULT_HERO_CLOCKS);
  return parsed.cityIds.map((id) => CITY_BY_ID.get(id)!).filter(Boolean);
}

export function getHeroClockCity(id: HeroClockCityId): HeroClockCity {
  return CITY_BY_ID.get(id) ?? HERO_CLOCK_CITIES[0]!;
}
