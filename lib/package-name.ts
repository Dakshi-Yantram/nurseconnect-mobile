/**
 * Display name for the Breastfeeding packages, per the approved design: "Breastfeeding & Postpartum Support".
 * Display only. The database name is never changed, and every other package passes through untouched.
 * Handles the old short name ("Breastfeeding Support Visit") and the catalogue name
 * ("Breastfeeding & Postpartum Support at Home — Single Visit").
 */
export const BREASTFEEDING_TITLE = 'Breastfeeding & Postpartum Support';

export function isBreastfeeding(name?: string | null): boolean {
  return !!name && /breastfeeding/i.test(name);
}

export function brandPackageName(name: string): string;
export function brandPackageName(name: string | null | undefined): string | null | undefined;
export function brandPackageName(name: string | null | undefined): string | null | undefined {
  if (!name || !isBreastfeeding(name)) return name;
  const parts = name.split(/\s[—–-]\s/);
  const suffix = parts.length > 1 ? parts.slice(1).join(' — ').trim() : /two/i.test(name) ? 'Two-Visit Support' : 'Single Visit';
  return `${BREASTFEEDING_TITLE} — ${suffix}`;
}

/** Group heading (no variant): "Breastfeeding & Postpartum Support". */
export function brandGroupTitle(title?: string | null): string | undefined {
  if (!title) return undefined;
  return isBreastfeeding(title) ? BREASTFEEDING_TITLE : title;
}
