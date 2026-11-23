/**
 * Help videos for care professionals (nurses), shown in Help & Support and by the Help Bot.
 *
 * TO ADD A VIDEO: add one entry to HELP_VIDEOS below. Nothing else needs to change.
 *   - lang:     "en" or "te" (add more languages to HELP_LANGUAGES first)
 *   - title:    shown on the card
 *   - keywords: words a nurse might type for this topic (in English and/or Telugu). The Help Bot uses these
 *               to pick the right video, so add several, e.g. ["start visit", "otp", "code"].
 *   - youtube:  any YouTube link (watch, youtu.be, shorts, embed) or the bare 11-character video id.
 *
 * Keep this file identical to src/lib/help-videos.ts in the website.
 */

export type HelpLang = "en" | "te";

export const HELP_LANGUAGES: { code: HelpLang; label: string }[] = [
  { code: "en", label: "English" },
  { code: "te", label: "తెలుగు (Telugu)" },
];

export interface HelpVideo {
  id: string;
  lang: HelpLang;
  title: string;
  description?: string;
  keywords: string[];
  youtube: string;
}

export const HELP_VIDEOS: HelpVideo[] = [
  // Example (replace with your real videos):
  // {
  //   id: "start-visit-te",
  //   lang: "te",
  //   title: "విజిట్ ఎలా ప్రారంభించాలి (How to start a visit)",
  //   description: "Start a visit with the family's 4-digit code.",
  //   keywords: ["start visit", "otp", "code", "విజిట్", "ఓటీపీ"],
  //   youtube: "https://youtu.be/XXXXXXXXXXX",
  // },
];

const ID_RE = /^[A-Za-z0-9_-]{11}$/;

/** The 11-character video id from any common YouTube link (or a bare id), else null. */
export function youtubeId(input: string): string | null {
  const s = (input ?? "").trim();
  if (!s) return null;
  if (ID_RE.test(s)) return s;
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\.|^m\./, "");
  let id: string | null = null;
  if (host === "youtu.be") {
    id = u.pathname.split("/")[1] ?? null;
  } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") id = u.searchParams.get("v");
    else {
      const m = u.pathname.match(/^\/(embed|shorts|live|v)\/([^/?#]+)/);
      id = m ? m[2] : null;
    }
  }
  return id && ID_RE.test(id) ? id : null;
}

export const watchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;
export const embedUrl = (id: string) => `https://www.youtube-nocookie.com/embed/${id}?rel=0`;
export const thumbUrl = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

export type PlayableVideo = HelpVideo & { videoId: string };

/** Videos in this language that have a valid YouTube link. */
export function videosFor(lang: HelpLang, videos: HelpVideo[] = HELP_VIDEOS): PlayableVideo[] {
  const out: PlayableVideo[] = [];
  for (const v of videos) {
    if (v.lang !== lang) continue;
    const videoId = youtubeId(v.youtube);
    if (videoId) out.push({ ...v, videoId });
  }
  return out;
}

// Unicode-aware so Telugu words (letters + vowel signs) are kept whole.
const tokens = (s: string) => (s.toLowerCase().match(/[\p{L}\p{M}\p{N}]+/gu) ?? []).filter((w) => w.length > 1);

/**
 * Videos in this language that fit what the nurse typed, best first. Returns [] when nothing matches
 * (the caller then falls back to the normal text answer instead of showing an unrelated video).
 */
export function matchVideos(
  query: string,
  lang: HelpLang,
  limit = 3,
  videos: HelpVideo[] = HELP_VIDEOS,
): PlayableVideo[] {
  const q = new Set(tokens(query));
  if (q.size === 0) return [];
  const scored: { v: PlayableVideo; score: number }[] = [];
  for (const v of videosFor(lang, videos)) {
    const kw = new Set(v.keywords.flatMap(tokens));
    const text = new Set([...tokens(v.title), ...tokens(v.description ?? "")]);
    let score = 0;
    for (const w of q) {
      if (kw.has(w)) score += 2;
      else if (text.has(w)) score += 1;
    }
    // A multi-word keyword phrase typed as-is ("start visit") is a strong signal.
    const lower = query.toLowerCase();
    for (const k of v.keywords) if (k.includes(" ") && lower.includes(k.toLowerCase())) score += 2;
    if (score > 0) scored.push({ v, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((x) => x.v);
}
