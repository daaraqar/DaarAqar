const ARABIC_DIACRITICS = /[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed]/g;

export function normalizeSearchText(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(ARABIC_DIACRITICS, "")
    .replace(/ـ/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\u0621-\u064a\u0660-\u0669\u0671-\u06d3A-Za-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function getSearchTokens(query: string): string[] {
  return normalizeSearchText(query).split(" ").filter(Boolean);
}

export function getLocationMatchScore(query: string, locationName: string): number {
  const queryTokens = getSearchTokens(query);
  const locationTokens = getSearchTokens(locationName).filter(
    (token) => !["مدينة", "مركز", "المركز", "محافظة", "city", "center"].includes(token)
  );
  return locationTokens.filter((locationToken) =>
    queryTokens.some((queryToken) => queryToken === locationToken || queryToken.includes(locationToken))
  ).length;
}

export function matchesSearchQuery(query: string, searchableValues: Array<string | null | undefined>): boolean {
  const tokens = getSearchTokens(query);
  if (tokens.length === 0) return true;

  const searchableText = normalizeSearchText(searchableValues.filter(Boolean).join(" "));
  return tokens.every((token) => searchableText.includes(token));
}
