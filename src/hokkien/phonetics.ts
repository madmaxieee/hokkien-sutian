// Shared phonetic constants + parsing helpers used by the phonetic picker and sound-based shortcuts.

export const INITIALS = [
  "p",
  "ph",
  "b",
  "m",
  "t",
  "th",
  "n",
  "l",
  "k",
  "kh",
  "g",
  "ng",
  "h",
  "ts",
  "tsh",
  "s",
  "j",
] as const;

export const FINALS = [
  "a",
  "ah",
  "ai",
  "aih",
  "ainn",
  "ainnh",
  "ak",
  "am",
  "an",
  "ang",
  "ann",
  "annh",
  "ap",
  "at",
  "au",
  "auh",
  "aunn",
  "aunnh",
  "e",
  "eh",
  "enn",
  "ennh",
  "i",
  "ia",
  "iah",
  "iak",
  "iam",
  "ian",
  "iang",
  "iann",
  "iannh",
  "iap",
  "iat",
  "iau",
  "iauh",
  "iaunn",
  "ih",
  "im",
  "in",
  "ing",
  "inn",
  "io",
  "ioh",
  "iok",
  "iong",
  "ip",
  "it",
  "iu",
  "iuh",
  "iunn",
  "m",
  "mh",
  "ng",
  "ngh",
  "o",
  "oh",
  "ok",
  "om",
  "ong",
  "onn",
  "onnh",
  "oo",
  "ooh",
  "op",
  "u",
  "ua",
  "uah",
  "uai",
  "uaih",
  "uainn",
  "uainnh",
  "uan",
  "uang",
  "uann",
  "uat",
  "ue",
  "ueh",
  "uh",
  "ui",
  "uih",
  "uinn",
  "un",
  "ut",
] as const;

export const TONES = [1, 2, 3, 4, 5, 7, 8] as const;

export const TONE_LABELS: Record<number, string> = {
  1: "1 陰平",
  2: "2 陰上",
  3: "3 陰去",
  4: "4 陰入",
  5: "5 陽平",
  7: "7 陽去",
  8: "8 陽入",
};

// Tone mark to number mapping (NFD decomposed)
export const TONE_MARKS: Record<string, number> = {
  "\u0301": 2, // ◌́ acute
  "\u0300": 3, // ◌̀ grave
  "\u0302": 5, // ◌̂ circumflex
  "\u0304": 7, // ◌̄ macron
  "\u030D": 8, // ◌̍ vertical line above
};

export interface SyllableComponents {
  initial: string;
  final: string;
  tone: number;
}

export function parseSyllable(syllable: string): SyllableComponents {
  // Remove annotation markers like 【白】【文】【替】
  const cleaned = syllable.replace(/【.*?】/g, "").trim();
  if (!cleaned) return { initial: "", final: "", tone: 0 };

  const normalized = cleaned.normalize("NFD");
  let tone = 0;
  let base = "";

  for (const char of normalized) {
    if (TONE_MARKS[char] !== undefined) {
      tone = TONE_MARKS[char];
    } else {
      base += char;
    }
  }
  base = base.toLowerCase();

  // Check for entering tone (入聲) - ends with h, p, t, k (but not nnh, ngh)
  const isChecked =
    /[ptk]$/.test(base) ||
    (/h$/.test(base) &&
      !/n{1,2}h$/.test(base) &&
      base !== "mh" &&
      base !== "ngh");

  if (tone === 0) {
    tone = isChecked ? 4 : 1;
  } else if (tone === 5 && isChecked) {
    tone = 8;
  }

  // Extract initial (longest match first)
  let initial = "";
  const sortedInitials = [...INITIALS].sort((a, b) => b.length - a.length);
  for (const init of sortedInitials) {
    if (base.startsWith(init)) {
      initial = init;
      break;
    }
  }

  const final = initial ? base.slice(initial.length) : base;

  return { initial, final, tone };
}
