import type { ImageSourcePropType } from 'react-native';
import type { Ionicons } from '@expo/vector-icons';
import type { PublicPackage } from '../services/public.service';

/**
 * Display-only helpers for the public package cards: which photo / icon a
 * package gets, which category tab it falls under, and which packages are
 * "options" of one service (companionship hours, injection type, ...).
 * Nothing here changes data, prices or booking.
 */
type IconName = keyof typeof Ionicons.glyphMap;
export type PackageKind = { id: string; image: ImageSourcePropType; icon: IconName; bg: string; fg: string };

const KINDS: Record<string, PackageKind> = {
  vitals: { id: 'vitals', image: require('../assets/images/public/pkg-vitals.jpg'), icon: 'pulse', bg: '#E0F2FE', fg: '#0284C7' },
  injection: { id: 'injection', image: require('../assets/images/public/pkg-injection.jpg'), icon: 'medical', bg: '#DBEAFE', fg: '#2563EB' },
  dressing: { id: 'dressing', image: require('../assets/images/public/pkg-dressing.jpg'), icon: 'bandage', bg: '#EDE9FE', fg: '#7C3AED' },
  elder: { id: 'elder', image: require('../assets/images/public/pkg-elder.jpg'), icon: 'person', bg: '#CCFBF1', fg: '#0D9488' },
  recovery: { id: 'recovery', image: require('../assets/images/public/pkg-recovery.jpg'), icon: 'bed', bg: '#FEF3C7', fg: '#D97706' },
  mother: { id: 'mother', image: require('../assets/images/public/pkg-mother.jpg'), icon: 'happy', bg: '#FCE7F3', fg: '#EC4899' },
  physio: { id: 'physio', image: require('../assets/images/public/pkg-physio.jpg'), icon: 'body', bg: '#E0E7FF', fg: '#4F46E5' },
  respiratory: { id: 'respiratory', image: require('../assets/images/public/pkg-respiratory.jpg'), icon: 'cloud', bg: '#CFFAFE', fg: '#0891B2' },
  nursing: { id: 'nursing', image: require('../assets/images/public/cat-nursing.jpg'), icon: 'pulse', bg: '#E0F2FE', fg: '#0284C7' },
  doctor: { id: 'doctor', image: require('../assets/images/public/pkg-vitals.jpg'), icon: 'medkit', bg: '#DBEAFE', fg: '#2563EB' },
  dental: { id: 'dental', image: require('../assets/images/public/cat-nursing.jpg'), icon: 'happy-outline', bg: '#CFFAFE', fg: '#0891B2' },
  specialized: { id: 'specialized', image: require('../assets/images/public/cat-specialized.jpg'), icon: 'settings', bg: '#EDE9FE', fg: '#7C3AED' },
};

const KIND_RULES: [string, RegExp][] = [
  ['dental', /\b(dent|dental|dentist|tooth|teeth)/i],
  ['doctor', /\b(doctor|physician|mbbs|teleconsult|e-?prescription|acute illness)/i],
  ['mother', /\b(breastfe|lactation)/i],
  ['respiratory', /\b(trach|tracheo|respirat|oxygen|nebul|ventilat|suction|lung|ng\b|peg\b|ryle)/i],
  ['injection', /\b(inject|infusion|iv\b|cannula|vaccin|im\b)/i],
  ['dressing', /\b(dressing|wound|bedsore|pressure sore|ulcer|suture|stitch|burn)/i],
  ['vitals', /\b(vitals?|blood pressure|bp\b|assessment|health check)/i],
  ['physio', /\b(physio|rehab|exercise|mobility)/i],
  ['mother', /\b(mother|baby|babies|newborn|postnatal|prenatal|antenatal|lactation|maternal|infant|pregnan)/i],
  ['recovery', /\b(post[- ]?surg|post[- ]?op|recover|discharge)/i],
  ['elder', /\b(elder|senior|geriatric|companion|caregiver|live-in|attendant|dementia|bedridden)/i],
];

// ---- category tabs (same rules as the website) ----
export type CategoryId = 'nursing' | 'doctor' | 'dental' | 'elder' | 'mother' | 'recovery' | 'physio' | 'specialized';
export const CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: 'nursing', label: 'Nursing Care' },
  { id: 'doctor', label: 'Doctor Consultations' },
  { id: 'dental', label: 'Dental Care' },
  { id: 'elder', label: 'Elder Care' },
  { id: 'mother', label: 'Mother & Baby' },
  { id: 'recovery', label: 'Recovery Care' },
  { id: 'physio', label: 'Physiotherapy' },
  { id: 'specialized', label: 'Specialized Care' },
];
// Matched against the package NAME only, so words in a long description can't misfile a package.
const NAME_RULES: [CategoryId, RegExp][] = [
  ['dental', /\b(dent|dental|dentist|tooth|teeth|oral care)/i],
  ['doctor', /\b(doctor|physician|mbbs|teleconsult|tele-consult|e-?prescription|acute illness|gp\b)/i],
  ['physio', /\bphysio/i],
];
const CAT_RULES: [CategoryId, RegExp][] = [
  ['mother', /\b(mother|baby|babies|newborn|postnatal|prenatal|antenatal|lactation|breastfe|maternal|infant|pregnan)/i],
  ['elder', /\b(elder|elderly|senior|geriatric|old age|dementia|alzheimer|companion|bedridden)/i],
  ['specialized', /\b(trach|tracheo|ng\b|peg\b|ryle|catheter|ventilat|oxygen|respirat|palliative|icu|dialysis|stoma|specialis|specializ|critical)/i],
  ['recovery', /\b(recover|post[- ]?surg|post[- ]?op|rehab|fracture|mobility|discharge)/i],
];
type Textual = Pick<PublicPackage, 'name' | 'tagline' | 'description' | 'target_condition'>;

export function classifyPackage(p: Textual): CategoryId {
  for (const [id, re] of NAME_RULES) if (re.test(p.name)) return id;
  const nameOnly = `${p.name} ${p.tagline ?? ''}`;
  for (const [id, re] of CAT_RULES) if (re.test(nameOnly)) return id;
  const text = `${p.name} ${p.tagline ?? ''} ${p.target_condition ?? ''} ${p.description ?? ''}`;
  for (const [id, re] of CAT_RULES) if (re.test(text)) return id;
  return 'nursing';
}

export function packageKind(p: Textual): PackageKind {
  const name = `${p.name} ${p.tagline ?? ''}`;
  for (const [id, re] of KIND_RULES) if (re.test(name)) return KINDS[id];
  const text = `${name} ${p.target_condition ?? ''} ${p.description ?? ''}`;
  for (const [id, re] of KIND_RULES) if (id !== 'doctor' && id !== 'dental' && re.test(text)) return KINDS[id];
  return classifyPackage(p) === 'specialized' ? KINDS.specialized : KINDS.nursing;
}

// ---- option groups: each option is its own real package with its own price ----
export type VariantGroup = { id: string; title: string; heading: string; description?: string };
const g = (id: string, title: string, heading = 'Choose Package Duration', description?: string): VariantGroup => ({ id, title, heading, description });
const COMPANION = g('companionship', 'Elderly Companionship at Home', 'Choose Package Duration', 'A non-medical visit for conversation, reading, light mobility support and supervision within caregiver scope.');
const IV = g('iv-infusion', 'IV Infusion');
const INJ = g('injection', 'Injection', 'Choose Injection Type');
const NURSE = g('nursing-shift', 'Nursing Care at Home', 'Choose Package Duration', 'Qualified nursing support at your doorstep, available in flexible 4, 8, or 12-hour shifts.');
const CARER = g('caregiver-support', 'Caregiver Support');
const LIVEIN = g('live-in', 'Live-In Caregiver');
const RECOVERY = g('post-surgery', 'Post-Surgery Recovery');

type Rule = { group: VariantGroup; test: RegExp; label: (m: RegExpExecArray) => string; order: (m: RegExpExecArray) => number };
const fixed = (group: VariantGroup, test: RegExp, label: string, order: number): Rule => ({ group, test, label: () => label, order: () => order });
const RULES: Rule[] = [
  { group: COMPANION, test: /^companionship\s*[—–-]\s*(\d+)\s*hours?/i, label: (m) => `${m[1]} hr${m[1] === '1' ? '' : 's'}`, order: (m) => Number(m[1]) },
  fixed(IV, /^iv infusion\s*[—–-]\s*up to 1 hour/i, 'Up to 1 hr', 1),
  fixed(IV, /^iv infusion\s*[—–-]\s*>\s*1 to 3 hours/i, '1–3 hrs', 2),
  fixed(IV, /^iv infusion\s*[—–-]\s*>\s*3 to 6 hours/i, '3–6 hrs', 3),
  fixed(NURSE, /^4-hour nursing shift/i, '4 Hours', 1),
  fixed(NURSE, /^8-hour nursing shift/i, '8 Hours', 2),
  fixed(NURSE, /^12-hour day nursing shift/i, '12 Hrs Day', 3),
  fixed(NURSE, /^12-hour night nursing shift/i, '12 Hrs Night', 4),
  fixed(NURSE, /^24-hour nursing coverage/i, '24 Hours', 5),
  fixed(NURSE, /^7-day 12-hour nursing plan/i, '7 Days', 6),
  fixed(NURSE, /^30-day 12-hour nursing plan/i, '30 Days', 7),
  fixed(CARER, /^caregiver support\s*[—–-]\s*4 hours/i, '4 Hours', 1),
  fixed(CARER, /^caregiver support\s*[—–-]\s*8 hours/i, '8 Hours', 2),
  fixed(CARER, /^caregiver support\s*[—–-]\s*12-hour day/i, '12 Hrs Day', 3),
  fixed(CARER, /^caregiver support\s*[—–-]\s*12-hour night/i, '12 Hrs Night', 4),
  fixed(LIVEIN, /^24-hour live-in caregiver/i, '24 Hours', 1),
  fixed(LIVEIN, /^seven-day live-in caregiver/i, '7 Days', 2),
  fixed(LIVEIN, /^30-day live-in caregiver/i, '30 Days', 3),
  fixed(RECOVERY, /^post-surgery nursing assessment visit/i, 'Single Visit', 1),
  fixed(RECOVERY, /^first 72-hour post-discharge recovery/i, '72 Hours', 2),
  fixed(RECOVERY, /^seven-day recovery package/i, '7 Days', 3),
  fixed(INJ, /^simple im\/sc injection/i, 'IM / SC', 1),
  fixed(INJ, /^insulin injection/i, 'Insulin', 2),
  fixed(INJ, /^multiple im\/sc injections/i, 'Up to 2 injections', 3),
  fixed(INJ, /^ivf\b/i, 'IVF / hormonal', 4),
];

export type VariantInfo = { group: VariantGroup; label: string; order: number };
export function variantOf(p: Pick<PublicPackage, 'name'>): VariantInfo | null {
  const name = p.name.trim();
  for (const r of RULES) {
    const m = r.test.exec(name);
    if (m) return { group: r.group, label: r.label(m), order: r.order(m) };
  }
  return null;
}

/** One entry per list row: a single package, or a whole option group collapsed into one card. */
export type Row = { kind: 'pkg'; pkg: PublicPackage } | { kind: 'group'; group: VariantGroup; options: PublicPackage[] };
/** `source` = full catalogue: option groups (and their "From" price) come from it, not from a filtered/searched `list`. */
export function groupRows(list: PublicPackage[], source: PublicPackage[] = list): Row[] {
  const out: Row[] = [];
  const placed = new Set<string>();
  for (const p of list) {
    const v = variantOf(p);
    if (!v) { out.push({ kind: 'pkg', pkg: p }); continue; }
    if (placed.has(v.group.id)) continue;
    placed.add(v.group.id);
    const options = source.filter((q) => variantOf(q)?.group.id === v.group.id);
    out.push(options.length > 1 ? { kind: 'group', group: v.group, options } : { kind: 'pkg', pkg: p });
  }
  return out;
}
