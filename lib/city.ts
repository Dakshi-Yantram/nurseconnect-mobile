/**
 * City names are typed by hand, so the same city ends up stored as "hyderabad",
 * "HYDERABAD" or "Hyderabad ". These helpers keep what we save (and show) clean.
 * Keep in sync with normalize_city_name() in the backend and src/lib/city.ts on the website.
 */
export function formatCity(raw: string | null | undefined): string {
  const cleaned = (raw ?? '').trim().replace(/\s+/g, ' ');
  if (!cleaned) return '';
  if (cleaned === cleaned.toLowerCase() || cleaned === cleaned.toUpperCase()) {
    return cleaned.toLowerCase().replace(/(^|[\s-])([a-zÀ-ɏ])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
  }
  return cleaned; // mixed case ("Delhi NCR") is kept as typed
}

/** Canonical spelling from the known list when it matches case-insensitively, else the cleaned text. */
export function canonicalCity(raw: string | null | undefined, known: string[]): string {
  const f = formatCity(raw);
  if (!f) return '';
  return known.find((k) => k.trim().toLowerCase() === f.toLowerCase()) ?? f;
}

/** Up to `limit` known cities that contain the typed text (all of them, alphabetically, when empty). */
export function suggestCities(query: string, known: string[], limit = 8): string[] {
  const q = query.trim().toLowerCase();
  const uniq = uniqueCities(known); // keeps order: server cities first, then the built-in list
  const hits = q ? uniq.filter((c) => c.toLowerCase().includes(q)) : uniq;
  return hits.slice(0, limit);
}

/** Major Indian cities always offered, in addition to cities from the server. */
export const MAJOR_INDIAN_CITIES: string[] = [
  'Agra',
  'Ahmedabad',
  'Ajmer',
  'Aligarh',
  'Amritsar',
  'Aurangabad',
  'Bareilly',
  'Belagavi',
  'Bengaluru',
  'Bhopal',
  'Bhubaneswar',
  'Chandigarh',
  'Chennai',
  'Coimbatore',
  'Cuttack',
  'Dehradun',
  'Delhi',
  'Dhanbad',
  'Durgapur',
  'Erode',
  'Faridabad',
  'Ghaziabad',
  'Gorakhpur',
  'Gurugram',
  'Guntur',
  'Guwahati',
  'Gwalior',
  'Hubballi',
  'Hyderabad',
  'Indore',
  'Jabalpur',
  'Jaipur',
  'Jalandhar',
  'Jammu',
  'Jamshedpur',
  'Jodhpur',
  'Kakinada',
  'Kanpur',
  'Karimnagar',
  'Kochi',
  'Kolhapur',
  'Kolkata',
  'Kota',
  'Kozhikode',
  'Lucknow',
  'Ludhiana',
  'Madurai',
  'Mangaluru',
  'Meerut',
  'Mumbai',
  'Mysuru',
  'Nagpur',
  'Nashik',
  'Navi Mumbai',
  'Nellore',
  'New Delhi',
  'Nizamabad',
  'Noida',
  'Patna',
  'Prayagraj',
  'Puducherry',
  'Pune',
  'Raipur',
  'Rajahmundry',
  'Rajkot',
  'Ranchi',
  'Salem',
  'Secunderabad',
  'Siliguri',
  'Srinagar',
  'Surat',
  'Thane',
  'Thiruvananthapuram',
  'Tiruchirappalli',
  'Tirupati',
  'Udaipur',
  'Vadodara',
  'Varanasi',
  'Vijayawada',
  'Visakhapatnam',
  'Warangal',
];

/** De-duplicated (case-insensitive) union of city lists, keeping first-seen order and spelling. */
export function uniqueCities(...lists: string[][]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const raw of list) {
      const c = formatCity(raw);
      const k = c.toLowerCase();
      if (c && !seen.has(k)) { seen.add(k); out.push(c); }
    }
  }
  return out;
}
