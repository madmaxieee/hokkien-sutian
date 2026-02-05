// identifier: hokkien-dictionary-component, type: application/vnd.ant.react, title: Advanced Hokkien Dictionary React Component
import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import initSqlJs, { Database } from "sql.js";
import {
  Search,
  Loader,
  AlertCircle,
  Volume2,
  Download,
  X,
  Shuffle,
  Menu,
  Copy,
  Check,
  Link as LinkIcon,
  Music,
} from "lucide-react";

// --- Phonetic Constants ---
const INITIALS = [
  "p", "ph", "b", "m",
  "t", "th", "n", "l",
  "k", "kh", "g", "ng",
  "h", "ts", "tsh", "s", "j",
] as const;

const FINALS = [
  "a", "ah", "ai", "aih", "ainn", "ainnh", "ak", "am", "an", "ang", "ann", "annh", "ap", "at", "au", "auh", "aunn", "aunnh",
  "e", "eh", "enn", "ennh",
  "i", "ia", "iah", "iak", "iam", "ian", "iang", "iann", "iannh", "iap", "iat", "iau", "iauh", "iaunn", "ih", "im", "in", "ing", "inn", "io", "ioh", "iok", "iong", "ip", "it", "iu", "iuh", "iunn",
  "m", "mh", "ng", "ngh",
  "o", "oh", "ok", "om", "ong", "onn", "onnh", "oo", "ooh", "op",
  "u", "ua", "uah", "uai", "uaih", "uainn", "uainnh", "uan", "uang", "uann", "uat", "ue", "ueh", "uh", "ui", "uih", "uinn", "un", "ut",
] as const;

const TONES = [1, 2, 3, 4, 5, 7, 8] as const;

const TONE_LABELS: Record<number, string> = {
  1: "1 陰平",
  2: "2 陰上",
  3: "3 陰去",
  4: "4 陰入",
  5: "5 陽平",
  7: "7 陽去",
  8: "8 陽入",
};


// Tone mark to number mapping (NFD decomposed)
const TONE_MARKS: Record<string, number> = {
  "\u0301": 2, // ◌́ acute
  "\u0300": 3, // ◌̀ grave
  "\u0302": 5, // ◌̂ circumflex
  "\u0304": 7, // ◌̄ macron
  "\u030D": 8, // ◌̍ vertical line above
};

interface SyllableComponents {
  initial: string;
  final: string;
  tone: number;
}

function parseSyllable(syllable: string): SyllableComponents {
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
  const isChecked = /[ptk]$/.test(base) || (/h$/.test(base) && !/n{1,2}h$/.test(base) && base !== "mh" && base !== "ngh");

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

// --- TypeScript Interfaces for Data Structures ---
interface Example {
  hanzi: string;
  romanization: string;
  mandarin_translation: string;
}
interface Meaning {
  id: number;
  part_of_speech: string;
  explanation: string;
  display_id: number;
  examples: Example[];
}
interface AltPronunciation {
  id: number;
  hanzi: string;
  romanization: string;
}
interface PhoneticDifference {
  [key: string]: number | string;
}
interface Result {
  id: number;
  hanzi: string;
  romanization: string;
  category: string;
  audio_file: string;
  meanings: Meaning[];
  variant_characters: string[];
  alternative_pronunciations: AltPronunciation[];
  phonetic_differences: PhoneticDifference | null;
}

// --- Helper & UI Components ---

const Spinner = () => (
  <div className="flex justify-center items-center p-8">
    <Loader className="animate-spin text-blue-500" size={48} />
  </div>
);
const ErrorMessage = ({ children }: { children: React.ReactNode }) => (
  <div
    className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4"
    role="alert"
  >
    <div className="flex">
      <div className="py-1">
        <AlertCircle className="h-6 w-6 text-red-500 mr-4" />
      </div>
      <div>
        <p className="font-bold">Error</p>
        <p>{children}</p>
      </div>
    </div>
  </div>
);

const CopyButton = ({ textToCopy }: { textToCopy: string }) => {
  const [copied, setCopied] = useState(false);
  const cleanedText = textToCopy.replace(/【.*?】/g, "").trim();
  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!cleanedText) return;
    navigator.clipboard.writeText(cleanedText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      onClick={handleCopy}
      title={`Copy "${cleanedText}"`}
      className="text-gray-400 hover:text-blue-600 transition-colors relative"
    >
      {copied ? (
        <Check size={16} className="text-green-500" />
      ) : (
        <Copy size={16} />
      )}
    </button>
  );
};

const CopyableText = ({
  text,
  className,
}: {
  text: string;
  className?: string;
}) => (
  <div className={`group inline-flex items-center gap-2 ${className}`}>
    <span>{text}</span>
    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
      <CopyButton textToCopy={text} />
    </div>
  </div>
);
const AudioControls = ({ audioId }: { audioId: string | null }) => {
  if (!audioId) return null;
  const audioUrl = `https://sutian.moe.edu.tw/media/senn/mp3/imtong/subak/0/${audioId}.mp3`;
  const audioRef = useRef<HTMLAudioElement>(null);
  const playAudio = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    audioRef.current?.play();
  };
  const downloadAudio = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const response = await fetch(audioUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = `${audioId}.mp3`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Download failed:", error);
      window.open(audioUrl, "_blank");
    }
  };
  return (
    <div className="hidden items-center gap-2 ml-3">
      <audio ref={audioRef} src={audioUrl} preload="none"></audio>
      <button
        onClick={playAudio}
        title="Play"
        className="text-gray-500 hover:text-blue-600"
      >
        <Volume2 size={22} />
      </button>
      <button
        onClick={downloadAudio}
        title="Download"
        className="text-gray-500 hover:text-blue-600"
      >
        <Download size={22} />
      </button>
    </div>
  );
};
const PhoneticDifferencesTable = ({
  data,
}: {
  data: PhoneticDifference | null;
}) => {
  if (!data) return null;
  const order: { [key: string]: number } = {
    yi_lan_zhang: 1,
    tai_zhong_zhang: 2,
    tai_nan_mix: 3,
    gao_xiong_mix: 4,
    san_xia_quan: 5,
    taipei_quan: 6,
    jin_men_quan: 7,
    ma_gong_quan: 8,
    xin_zhu_quan: 9,
    lu_gang_quan: 10,
  };
  const labels: { [key: string]: string } = {
    yi_lan_zhang: "宜蘭偏漳腔",
    tai_zhong_zhang: "臺中偏漳腔",
    tai_nan_mix: "臺南混合腔",
    gao_xiong_mix: "高雄混合腔",
    san_xia_quan: "三峽偏泉腔",
    taipei_quan: "臺北偏泉腔",
    jin_men_quan: "金門偏泉腔",
    ma_gong_quan: "馬公偏泉腔",
    xin_zhu_quan: "新竹偏泉腔",
    lu_gang_quan: "鹿港偏泉腔",
  };
  const sortedPhonetics = Object.entries(data)
    .filter(([key, value]) => order[key] && value)
    .sort(([keyA], [keyB]) => order[keyA] - order[keyB])
    .map(([key, value]) => ({ label: labels[key], value: value as string }));
  if (sortedPhonetics.length === 0) return null;
  return (
    <div className="mt-6">
      <h3 className="text-xl font-semibold text-gray-700 mb-3">語音差異</h3>
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 font-medium text-gray-600">腔</th>
              <th className="p-3 font-medium text-gray-600">語音差異</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sortedPhonetics.map((item) => (
              <tr key={item.label} className="hover:bg-gray-50">
                <td className="p-3 text-gray-800">{item.label}</td>
                <td className="p-3 text-blue-600 font-mono">
                  <CopyableText text={item.value} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
const DetailSection = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => {
  if (!children || (Array.isArray(children) && children.length === 0))
    return null;
  return (
    <div className="flex items-start mt-2">
      <strong className="font-semibold text-gray-600 w-24 flex-shrink-0">
        {title}:
      </strong>
      <div className="flex-grow flex flex-wrap gap-x-4 gap-y-1">{children}</div>
    </div>
  );
};
const StyledRadio = ({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) => (
  <label className="flex items-center space-x-2 cursor-pointer text-gray-700">
    <input type="radio" className="sr-only peer" {...props} />
    <span className="w-5 h-5 rounded-full border-2 border-gray-300 bg-white peer-checked:border-blue-600 flex items-center justify-center transition">
      <span className="w-2.5 h-2.5 rounded-full bg-blue-600 scale-0 peer-checked:scale-100 transition-transform duration-150"></span>
    </span>
    <span>{label}</span>
  </label>
);
const StyledCheckbox = ({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) => (
  <label className="flex items-center space-x-2 cursor-pointer text-sm text-gray-700">
    <input type="checkbox" className="sr-only peer" {...props} />
    <span className="w-4 h-4 rounded border-2 border-gray-300 bg-white peer-checked:bg-blue-600 peer-checked:border-blue-600 flex items-center justify-center transition-colors">
      <Check
        size={12}
        className="text-white scale-0 peer-checked:scale-100 transition-transform duration-150"
        strokeWidth={3}
      />
    </span>
    <span>{label}</span>
  </label>
);
const ResultCard = ({
  result,
  onPermalinkClick,
}: {
  result: Result;
  onPermalinkClick: (id: number) => void;
}) => {
  const audioId = result.audio_file?.match(/\d+/)?.[0] ?? null;
  return (
    <div className="border border-gray-200 rounded-lg p-6 mb-8 shadow-sm bg-white break-inside-avoid-column">
      <div className="group inline-flex items-center gap-2">
        <a
          href={`https://sutian.moe.edu.tw/zh-hant/su/${result.id}/`}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
        >
          <h2 className="text-4xl font-bold text-gray-800 mb-1 inline-block">
            {result.hanzi}
          </h2>
        </a>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
          <CopyButton textToCopy={result.hanzi} />
          <button
            onClick={() => onPermalinkClick(result.id)}
            title="Link to this entry"
            className="text-gray-400 hover:text-blue-600"
          >
            <LinkIcon size={16} />
          </button>
        </div>
      </div>
      <div className="flex items-center text-xl text-blue-600 font-mono mb-4">
        <CopyableText text={result.romanization} />
        <AudioControls audioId={audioId} />
      </div>
      <div className="space-y-5">
        {result.meanings?.map((meaning) => (
          <div key={meaning.id} className="border-t pt-4 first:border-t-0">
            <div className="flex items-start">
              <span className="text-gray-500 mr-2">{meaning.display_id}.</span>
              <div className="flex-grow">
                <p className="text-lg text-gray-800">
                  {meaning.part_of_speech && (
                    <strong className="font-semibold">
                      {meaning.part_of_speech}
                    </strong>
                  )}
                  {` ${meaning.explanation.replace(/^:/, "").trim()}`}
                </p>
                {meaning.examples?.length > 0 && (
                  <div className="mt-2 pl-4 border-l-2 border-blue-100">
                    <h4 className="font-semibold text-gray-600">用例:</h4>
                    <ul className="list-none space-y-3 mt-1">
                      {meaning.examples.map((ex, index) => (
                        <li key={index}>
                          <CopyableText
                            text={ex.hanzi}
                            className="text-gray-800"
                          />
                          <CopyableText
                            text={ex.romanization}
                            className="text-blue-500 font-mono text-sm"
                          />
                          <p className="text-gray-500 text-sm">
                            ({ex.mandarin_translation})
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 border-t pt-4 text-sm text-gray-500 space-y-1">
        <DetailSection title="又見音">
          {result.alternative_pronunciations?.map((alt, i) => (
            <a
              href={`https://sutian.moe.edu.tw/zh-hant/su/${alt.id}/`}
              target="_blank"
              rel="noopener noreferrer"
              key={i}
              className="text-blue-600 hover:underline"
            >
              <CopyableText text={`${alt.hanzi} ${alt.romanization}`} />
            </a>
          ))}
        </DetailSection>
        <DetailSection title="異用字">
          {result.variant_characters?.map((v, i) => (
            <span key={i}>{v}</span>
          ))}
        </DetailSection>
        <DetailSection title="分類">
          <span>{result.category?.replace(/,/g, " ")}</span>
        </DetailSection>
      </div>
      <PhoneticDifferencesTable data={result.phonetic_differences} />
    </div>
  );
};
const ToneGroupDisplay = ({
  groups,
  onEntryClick,
}: {
  groups: ToneGroup[];
  onEntryClick: (id: number) => void;
}) => {
  if (groups.length === 0) return null;

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.tone} className="border border-gray-200 rounded-lg bg-white shadow-sm overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold text-blue-600 font-mono">{group.syllable}</span>
              <span className="text-sm text-gray-500">
                {TONE_LABELS[group.tone]} ({group.entries.length}字)
              </span>
            </div>
          </div>
          <div className="p-4">
            <div className="flex flex-wrap gap-2">
              {group.entries.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => onEntryClick(entry.id)}
                  className="text-2xl hover:bg-blue-50 hover:text-blue-700 px-2 py-1 rounded transition-colors"
                  title={`${entry.hanzi} (${entry.romanization})`}
                >
                  {entry.hanzi.replace(/【.*?】/g, "").trim()}
                </button>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const CategoryModal = ({
  isOpen,
  onClose,
  categories,
  onSelect,
}: {
  isOpen: boolean;
  onClose: () => void;
  categories: string[];
  onSelect: (category: string) => void;
}) => {
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-full m-4 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-bold">依分類瀏覽</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={24} />
          </button>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => onSelect(cat)}
              className="text-left p-2 rounded hover:bg-blue-100 text-blue-700"
            >
              {cat}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

interface PhoneticQuery {
  initial: string | null;
  final: string | null;
  tone: number | null;
  singleSyllableOnly: boolean;
}

interface ToneGroup {
  tone: number;
  syllable: string;
  entries: Result[];
}

const PhoneticPickerModal = ({
  isOpen,
  onClose,
  onSearch,
  db,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSearch: (query: PhoneticQuery, resultCount: number) => void;
  db: Database | null;
}) => {
  const [selectedInitial, setSelectedInitial] = useState<string | null>(null);
  const [selectedFinal, setSelectedFinal] = useState<string | null>(null);
  const [selectedTone, setSelectedTone] = useState<number | null>(null);
  const [singleSyllableOnly, setSingleSyllableOnly] = useState<boolean>(true);
  const [matchCount, setMatchCount] = useState<number>(0);
  const [syllableIndex, setSyllableIndex] = useState<Map<string, Set<number>>>(new Map());
  const [multiSyllableIndex, setMultiSyllableIndex] = useState<Map<string, Set<number>>>(new Map());
  const [availableInitials, setAvailableInitials] = useState<Set<string>>(new Set());
  const [availableFinals, setAvailableFinals] = useState<Set<string>>(new Set());
  const [availableTones, setAvailableTones] = useState<Set<number>>(new Set());

  // Build syllable index on mount
  useEffect(() => {
    if (!db || !isOpen) return;

    const singleIndex = new Map<string, Set<number>>();
    const multiIndex = new Map<string, Set<number>>();
    const allInitials = new Set<string>();
    const allFinals = new Set<string>();
    const allTones = new Set<number>();

    try {
      const result = db.exec("SELECT id, romanization FROM entries");
      if (result.length > 0) {
        for (const row of result[0].values) {
          const id = row[0] as number;
          const romanization = row[1] as string;
          if (!romanization) continue;

          // Handle alternative pronunciations separated by "/"
          const pronunciationVariants = romanization.split("/");

          for (const variant of pronunciationVariants) {
            const syllables = variant.split(/[-\s]+/).filter(s => s.trim());
            const isSingleSyllable = syllables.length === 1;

            for (const syl of syllables) {
              const { initial, final, tone } = parseSyllable(syl);
              if (!final) continue; // Skip if no valid final

              const key = `${initial || "ling"}|${final}|${tone}`;

              if (isSingleSyllable) {
                if (!singleIndex.has(key)) singleIndex.set(key, new Set());
                singleIndex.get(key)!.add(id);
              } else {
                if (!multiIndex.has(key)) multiIndex.set(key, new Set());
                multiIndex.get(key)!.add(id);
              }

              allInitials.add(initial || "ling");
              allFinals.add(final);
              allTones.add(tone);
            }
          }
        }
      }
    } catch (err) {
      console.error("Error building syllable index:", err);
    }

    setSyllableIndex(singleIndex);
    setMultiSyllableIndex(multiIndex);
    setAvailableInitials(allInitials);
    setAvailableFinals(allFinals);
    setAvailableTones(allTones);
  }, [db, isOpen]);

  // Update match count and available options when selection changes
  useEffect(() => {
    if (syllableIndex.size === 0 && multiSyllableIndex.size === 0) return;

    const matchingIds = new Set<number>();
    const validInitials = new Set<string>();
    const validFinals = new Set<string>();
    const validTones = new Set<number>();

    // Choose which indices to use based on singleSyllableOnly
    const indicesToUse = singleSyllableOnly
      ? [syllableIndex]
      : [syllableIndex, multiSyllableIndex];

    for (const index of indicesToUse) {
      for (const [key, ids] of index) {
        const [init, fin, t] = key.split("|");
        const tone = parseInt(t);

        const matchesInitial = selectedInitial === null || init === selectedInitial;
        const matchesFinal = selectedFinal === null || fin === selectedFinal;
        const matchesTone = selectedTone === null || tone === selectedTone;

        if (matchesInitial && matchesFinal && matchesTone) {
          ids.forEach((id) => matchingIds.add(id));
        }

        // Track what's available given current selection
        if (matchesFinal && matchesTone) validInitials.add(init);
        if (matchesInitial && matchesTone) validFinals.add(fin);
        if (matchesInitial && matchesFinal) validTones.add(tone);
      }
    }

    setMatchCount(matchingIds.size);
    setAvailableInitials(validInitials);
    setAvailableFinals(validFinals);
    setAvailableTones(validTones);
  }, [selectedInitial, selectedFinal, selectedTone, syllableIndex, multiSyllableIndex, singleSyllableOnly]);

  const handleSearch = () => {
    onSearch(
      { initial: selectedInitial, final: selectedFinal, tone: selectedTone, singleSyllableOnly },
      matchCount
    );
    onClose();
  };

  const handleReset = () => {
    setSelectedInitial(null);
    setSelectedFinal(null);
    setSelectedTone(null);
    setSingleSyllableOnly(true);
  };

  if (!isOpen) return null;

  const ButtonPill = ({
    selected,
    available,
    onClick,
    children,
  }: {
    selected: boolean;
    available: boolean;
    onClick: () => void;
    children: React.ReactNode;
  }) => (
    <button
      onClick={onClick}
      disabled={!available && !selected}
      className={`px-2 py-1 rounded text-sm font-mono transition-colors ${
        selected
          ? "bg-blue-600 text-white"
          : available
            ? "bg-gray-100 hover:bg-blue-100 text-gray-700"
            : "bg-gray-50 text-gray-300 cursor-not-allowed"
      }`}
    >
      {children}
    </button>
  );

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] m-4 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b sticky top-0 bg-white">
          <h2 className="text-xl font-bold">聲韻調查詢</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <div className="p-4 space-y-6">
          {/* Initial Consonants */}
          <div>
            <h3 className="text-sm font-semibold text-gray-600 mb-2">
              聲母 (Initial)
              {selectedInitial && (
                <span className="ml-2 text-blue-600">: {selectedInitial === "ling" ? "零聲母" : selectedInitial}</span>
              )}
            </h3>
            <div className="flex flex-wrap gap-1">
              <ButtonPill
                selected={selectedInitial === "ling"}
                available={availableInitials.has("ling")}
                onClick={() => setSelectedInitial(selectedInitial === "ling" ? null : "ling")}
              >
                零
              </ButtonPill>
              {INITIALS.map((init) => (
                <ButtonPill
                  key={init}
                  selected={selectedInitial === init}
                  available={availableInitials.has(init)}
                  onClick={() => setSelectedInitial(selectedInitial === init ? null : init)}
                >
                  {init}
                </ButtonPill>
              ))}
            </div>
          </div>

          {/* Finals */}
          <div>
            <h3 className="text-sm font-semibold text-gray-600 mb-2">
              韻母 (Final)
              {selectedFinal && <span className="ml-2 text-blue-600">: {selectedFinal}</span>}
            </h3>
            <div className="flex flex-wrap gap-1">
              {FINALS.map((fin) => (
                <ButtonPill
                  key={fin}
                  selected={selectedFinal === fin}
                  available={availableFinals.has(fin)}
                  onClick={() => setSelectedFinal(selectedFinal === fin ? null : fin)}
                >
                  {fin}
                </ButtonPill>
              ))}
            </div>
          </div>

          {/* Tones */}
          <div>
            <h3 className="text-sm font-semibold text-gray-600 mb-2">
              聲調 (Tone)
              {selectedTone && <span className="ml-2 text-blue-600">: {TONE_LABELS[selectedTone]}</span>}
            </h3>
            <div className="flex flex-wrap gap-2">
              {TONES.map((tone) => (
                <ButtonPill
                  key={tone}
                  selected={selectedTone === tone}
                  available={availableTones.has(tone)}
                  onClick={() => setSelectedTone(selectedTone === tone ? null : tone)}
                >
                  {TONE_LABELS[tone]}
                </ButtonPill>
              ))}
            </div>
          </div>

          {/* Options */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={singleSyllableOnly}
                onChange={(e) => setSingleSyllableOnly(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">僅顯示單音節詞（單字）</span>
            </label>
          </div>

          {/* Preview */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-gray-600">符合條件: </span>
                <span className="font-bold text-lg text-blue-600">{matchCount.toLocaleString()}</span>
                <span className="text-gray-600"> 筆</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleReset}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  重設
                </button>
                <button
                  onClick={handleSearch}
                  disabled={matchCount === 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  查詢
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Main Dictionary Component ---

const HokkienDictionary = () => {
  const [db, setDb] = useState<Database | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchMode, setSearchMode] = useState("hokkien_entry");
  const [categories, setCategories] = useState<string[]>([]);
  const [isCategoryModalOpen, setCategoryModalOpen] = useState(false);
  const [isPhoneticModalOpen, setPhoneticModalOpen] = useState(false);
  const [forceSingleColumn, setForceSingleColumn] = useState(false);
  const [isSingleEntryView, setIsSingleEntryView] = useState(false);
  const [toneGroups, setToneGroups] = useState<ToneGroup[]>([]);
  const [isPhoneticSearch, setIsPhoneticSearch] = useState(false);

  const queryKeyToMode = useMemo(
    () => ({
      q: "hokkien_entry",
      he: "hokkien_entry",
      me: "mandarin_example",
      hf: "hokkien_example",
      mf: "mandarin_fulltext",
      rx: "regex",
      hft: "hokkien_fulltext",
      cat: "category",
      qs: "multi_search",
      su: "single_entry",
    }),
    [],
  );
  const modeToQueryKey = useMemo(
    () => ({
      hokkien_entry: "q",
      mandarin_example: "me",
      hokkien_example: "hf",
      mandarin_fulltext: "mf",
      regex: "rx",
      hokkien_fulltext: "hft",
      category: "cat",
      multi_search: "qs",
      single_entry: "su",
    }),
    [],
  );

  const fetchEntryDetails = useCallback(
    (entryId: number): Result | null => {
      if (!db) return null;
      const exec = (sql: string) =>
        db.exec(sql)[0] || { columns: [], values: [] };
      const entryRes = exec(
        `SELECT hanzi, romanization, category, audio_file FROM entries WHERE id = ${entryId}`,
      );
      if (entryRes.values.length === 0) return null;
      const [hanzi, romanization, category, audio_file] = entryRes
        .values[0] as [string, string, string, string];
      const meanings = exec(
        `SELECT id, part_of_speech, explanation FROM meanings WHERE entry_id = ${entryId}`,
      ).values.map((m, i) => ({
        id: m[0] as number,
        part_of_speech: m[1] as string,
        explanation: m[2] as string,
        display_id: i + 1,
        examples: [] as Example[],
      }));
      meanings.forEach((m) => {
        m.examples = exec(
          `SELECT hanzi, romanization, mandarin_translation FROM examples WHERE meaning_id = ${m.id}`,
        ).values.map((ex) => ({
          hanzi: ex[0] as string,
          romanization: ex[1] as string,
          mandarin_translation: ex[2] as string,
        }));
      });
      const phoneticRes = exec(
        `SELECT * FROM phonetic_differences WHERE entry_id = ${entryId}`,
      );
      return {
        id: entryId,
        hanzi,
        romanization,
        category,
        audio_file,
        meanings,
        variant_characters: exec(
          `SELECT variant_hanzi FROM variant_characters WHERE entry_id = ${entryId}`,
        ).values.flat() as string[],
        alternative_pronunciations: exec(
          `SELECT entry_id, hanzi, romanization FROM alternative_pronunciations WHERE entry_id = ${entryId}`,
        ).values.map((p) => ({
          id: p[0] as number,
          hanzi: p[1] as string,
          romanization: p[2] as string,
        })),
        phonetic_differences:
          phoneticRes.values.length > 0
            ? phoneticRes.columns.reduce(
                (obj, col, i) => ({ ...obj, [col]: phoneticRes.values[0][i] }),
                {},
              )
            : null,
      };
    },
    [db],
  );

  const getReadingPriority = (hanziWithAnnotation: string): number => {
    if (
      hanziWithAnnotation.includes("【替】") ||
      hanziWithAnnotation.includes("【白】")
    )
      return 0;
    if (hanziWithAnnotation.includes("【文】")) return 2;
    return 1;
  };

  const sortResults = useCallback(
    (resultsToSort: Result[], term: string): Result[] => {
      return resultsToSort.sort((a, b) => {
        const aIsExact = a.hanzi.replace(/【.*?】/g, "").trim() === term;
        const bIsExact = b.hanzi.replace(/【.*?】/g, "").trim() === term;
        if (aIsExact !== bIsExact) return aIsExact ? -1 : 1;
        const aPrio = getReadingPriority(a.hanzi);
        const bPrio = getReadingPriority(b.hanzi);
        if (aPrio !== bPrio) return aPrio - bPrio;
        return a.id - b.id;
      });
    },
    [],
  );

  const performSearch = useCallback(
    async (term: string, mode: string) => {
      if (!db || !term.trim()) {
        setResults([]);
        return;
      }
      setSearching(true);
      setResults([]);
      setToneGroups([]);
      setIsPhoneticSearch(false);
      setError(null);
      try {
        if (mode === "multi_search") {
          const sentence = term.trim();
          const foundResults = new Map<
            string,
            { results: Result[]; termLength: number }
          >();
          for (let len = sentence.length; len >= 1; len--) {
            for (let i = 0; i <= sentence.length - len; i++) {
              const substring = sentence.substring(i, i + len);
              if (foundResults.has(substring)) continue;
              const stmt = db.prepare(
                `SELECT id, hanzi FROM entries WHERE hanzi = $term`,
              );
              const matchedEntries: Result[] = [];
              stmt.bind({ $term: substring });
              while (stmt.step()) {
                const [id] = stmt.get() as [number];
                const details = fetchEntryDetails(id);
                if (details) matchedEntries.push(details);
              }
              stmt.free();
              if (matchedEntries.length > 0) {
                foundResults.set(substring, {
                  results: sortResults(matchedEntries, substring),
                  termLength: len,
                });
              }
            }
          }
          const finalResults = Array.from(foundResults.values())
            .sort((a, b) => b.termLength - a.termLength)
            .flatMap((item) => item.results);
          setResults(finalResults);
        } else {
          const trimmedTerm = term.trim();
          const likeTerm = `%${trimmedTerm}%`;
          const queries: { [key: string]: string } = {
            hokkien_entry: `SELECT id FROM entries WHERE hanzi LIKE $term OR romanization LIKE $term`,
            mandarin_example: `SELECT DISTINCT entry_id FROM examples WHERE mandarin_translation LIKE $term`,
            hokkien_example: `SELECT DISTINCT entry_id FROM examples WHERE hanzi LIKE $term OR romanization LIKE $term`,
            mandarin_fulltext: `SELECT id FROM entries WHERE hanzi LIKE $term UNION SELECT entry_id FROM meanings WHERE explanation LIKE $term UNION SELECT entry_id FROM examples WHERE mandarin_translation LIKE $term`,
            regex: `SELECT id FROM entries WHERE hanzi REGEXP $term`,
            hokkien_fulltext: `SELECT id FROM entries WHERE hanzi LIKE $term OR romanization LIKE $term UNION SELECT entry_id FROM examples WHERE hanzi LIKE $term OR romanization LIKE $term`,
            category: `SELECT id FROM entries WHERE category LIKE $term`,
          };
          const stmt = db.prepare(queries[mode]);
          const entryIds = new Set<number>();
          stmt.bind({ $term: mode === "regex" ? trimmedTerm : likeTerm });
          while (stmt.step()) {
            entryIds.add(stmt.get()[0] as number);
          }
          stmt.free();
          const detailedResults = Array.from(entryIds)
            .map((id) => fetchEntryDetails(id))
            .filter(Boolean) as Result[];
          setResults(sortResults(detailedResults, trimmedTerm));
        }
      } catch (err) {
        console.error("Search error:", err);
        setError("查詢時發生錯誤，請檢查您的語法是否正確。");
      } finally {
        setSearching(false);
      }
    },
    [db, fetchEntryDetails, sortResults],
  );

  const handleRandomWord = useCallback(async () => {
    if (!db) return;
    setIsSingleEntryView(false);
    setSearching(true);
    const randomIdRes = db.exec(
      "SELECT id FROM entries ORDER BY RANDOM() LIMIT 1",
    );
    if (randomIdRes.length > 0 && randomIdRes[0].values.length > 0) {
      const randomId = randomIdRes[0].values[0][0] as number;
      const result = fetchEntryDetails(randomId);
      if (result) {
        setResults([result]);
        setSearchTerm(`(隨機) ${result.hanzi}`);
        setSearchMode("hokkien_entry");
      }
    }
    setSearching(false);
  }, [db, fetchEntryDetails]);

  const handleCategorySelect = (category: string) => {
    setIsSingleEntryView(false);
    setCategoryModalOpen(false);
    setSearchTerm(category);
    setSearchMode("category");
    performSearch(category, "category");
  };

  const handlePhoneticSearch = useCallback(
    (query: PhoneticQuery, _resultCount: number) => {
      if (!db) return;
      setIsSingleEntryView(false);
      setSearching(true);
      setResults([]);
      setToneGroups([]);
      setIsPhoneticSearch(true);
      setError(null);

      try {
        // Map: tone -> Map<syllable, Set<entryId>>
        const toneToEntries = new Map<number, Map<string, Set<number>>>();
        const result = db.exec("SELECT id, romanization FROM entries");

        if (result.length > 0) {
          for (const row of result[0].values) {
            const id = row[0] as number;
            const romanization = row[1] as string;
            if (!romanization) continue;

            // Handle alternative pronunciations separated by "/"
            const pronunciationVariants = romanization.split("/");

            for (const variant of pronunciationVariants) {
              const syllables = variant.split(/[-\s]+/).filter(s => s.trim());

              // Skip multi-syllable entries if singleSyllableOnly is true
              if (query.singleSyllableOnly && syllables.length > 1) continue;

              for (const syl of syllables) {
                const { initial, final, tone } = parseSyllable(syl);
                if (!final) continue;

                const entryInitial = initial || "ling";
                const matchesInitial = query.initial === null || entryInitial === query.initial;
                const matchesFinal = query.final === null || final === query.final;
                const matchesTone = query.tone === null || tone === query.tone;

                if (matchesInitial && matchesFinal && matchesTone) {
                  if (!toneToEntries.has(tone)) {
                    toneToEntries.set(tone, new Map());
                  }
                  const syllableMap = toneToEntries.get(tone)!;
                  // Normalize syllable for grouping (use the matched syllable)
                  const normalizedSyl = syl.trim();
                  if (!syllableMap.has(normalizedSyl)) {
                    syllableMap.set(normalizedSyl, new Set());
                  }
                  syllableMap.get(normalizedSyl)!.add(id);
                }
              }
            }
          }
        }

        // Build tone groups
        const groups: ToneGroup[] = [];
        const allEntryIds = new Set<number>();

        // Sort by tone number
        const sortedTones = Array.from(toneToEntries.keys()).sort((a, b) => a - b);

        for (const tone of sortedTones) {
          const syllableMap = toneToEntries.get(tone)!;
          // Merge all entries for this tone
          const toneEntryIds = new Set<number>();
          let representativeSyllable = "";

          for (const [syl, ids] of syllableMap) {
            if (!representativeSyllable) representativeSyllable = syl;
            ids.forEach(id => {
              toneEntryIds.add(id);
              allEntryIds.add(id);
            });
          }

          const entries = Array.from(toneEntryIds)
            .map(id => fetchEntryDetails(id))
            .filter(Boolean) as Result[];

          if (entries.length > 0) {
            groups.push({
              tone,
              syllable: representativeSyllable,
              entries: sortResults(entries, ""),
            });
          }
        }

        setToneGroups(groups);

        // Also set flat results for compatibility
        const allResults = Array.from(allEntryIds)
          .map(id => fetchEntryDetails(id))
          .filter(Boolean) as Result[];
        setResults(sortResults(allResults, ""));

        // Build display label
        const parts: string[] = [];
        if (query.initial) parts.push(`聲母:${query.initial === "ling" ? "零" : query.initial}`);
        if (query.final) parts.push(`韻母:${query.final}`);
        if (query.tone) parts.push(`聲調:${query.tone}`);
        const label = parts.length > 0 ? parts.join(" ") : "全部";
        const suffix = query.singleSyllableOnly ? "" : " (含多音節)";

        setSearchTerm(`[聲韻調] ${label}${suffix}`);
        setSearchMode("phonetic");

        // Update URL
        const params = new URLSearchParams();
        if (query.initial) params.set("si", query.initial);
        if (query.final) params.set("sf", query.final);
        if (query.tone) params.set("st", query.tone.toString());
        if (!query.singleSyllableOnly) params.set("sm", "0");
        const newUrl = `${window.location.pathname}?${params.toString()}`;
        window.history.pushState({ path: newUrl }, "", newUrl);
      } catch (err) {
        console.error("Phonetic search error:", err);
        setError("聲韻調查詢時發生錯誤。");
      } finally {
        setSearching(false);
      }
    },
    [db, fetchEntryDetails, sortResults]
  );

  const handleSearchModeChange = (newMode: string) => {
    setSearchMode(newMode);
    const trimmedSearchTerm = searchTerm.trim();
    if (trimmedSearchTerm && !trimmedSearchTerm.startsWith("(隨機)")) {
      const queryKey = modeToQueryKey[newMode as keyof typeof modeToQueryKey];
      const newUrl = `${window.location.pathname}?${queryKey}=${encodeURIComponent(trimmedSearchTerm)}`;
      window.history.pushState({ path: newUrl }, "", newUrl);
      performSearch(trimmedSearchTerm, newMode);
    }
  };

  const handlePermalinkClick = (id: number) => {
    const newUrl = `${window.location.pathname}?su=${id}`;
    window.history.pushState({ path: newUrl }, "", newUrl);
    setIsSingleEntryView(true);
    setIsPhoneticSearch(false);
    const result = fetchEntryDetails(id);
    setResults(result ? [result] : []);
  };

  const handleTitleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsSingleEntryView(false);
    setResults([]);
    setSearchTerm("");
    window.history.pushState(
      { path: window.location.pathname },
      "",
      window.location.pathname,
    );
  };

  const syncStateWithUrl = useCallback(
    (locationSearch: string) => {
      const params = new URLSearchParams(locationSearch);
      if (params.has("su")) {
        setIsSingleEntryView(true);
        setSearching(true);
        const id = parseInt(params.get("su")!, 10);
        if (!isNaN(id)) {
          const result = fetchEntryDetails(id);
          setResults(result ? [result] : []);
        }
        setSearching(false);
      } else if (params.has("si") || params.has("sf") || params.has("st")) {
        // Phonetic search from URL
        const query: PhoneticQuery = {
          initial: params.get("si"),
          final: params.get("sf"),
          tone: params.has("st") ? parseInt(params.get("st")!, 10) : null,
          singleSyllableOnly: params.get("sm") !== "0", // default true unless sm=0
        };
        handlePhoneticSearch(query, 0);
      } else {
        setIsSingleEntryView(false);
        let initialTerm = "";
        let initialMode = "hokkien_entry";
        for (const key in queryKeyToMode) {
          if (params.has(key)) {
            initialTerm = params.get(key) || "";
            initialMode = queryKeyToMode[key as keyof typeof queryKeyToMode];
            break;
          }
        }
        setSearchTerm(initialTerm);
        setSearchMode(initialMode);
        if (initialTerm) {
          performSearch(initialTerm, initialMode);
        } else {
          setResults([]);
        }
      }
    },
    [db, fetchEntryDetails, queryKeyToMode, performSearch, handlePhoneticSearch],
  );

  useEffect(() => {
    const loadDb = async () => {
      try {
        const SQL = await initSqlJs();
        const response = await fetch("/assets/data/kautian.db");
        if (!response.ok)
          throw new Error(`Failed to fetch database: ${response.statusText}`);
        const dbInstance = new SQL.Database(
          new Uint8Array(await response.arrayBuffer()),
        );
        dbInstance.create_function("REGEXP", (pattern, str) =>
          new RegExp(pattern as string).test(str as string),
        );
        const catRes = dbInstance.exec(
          "SELECT DISTINCT category FROM entries WHERE category IS NOT NULL AND category != ''",
        );
        const allCats = new Set<string>();
        catRes[0].values.forEach((row) =>
          (row[0] as string)
            .split(",")
            .forEach((cat) => allCats.add(cat.trim())),
        );
        setCategories(Array.from(allCats).sort());
        setDb(dbInstance);
      } catch (err) {
        console.error("Database loading error:", err);
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };
    loadDb();
  }, []);

  useEffect(() => {
    if (loading || !db) return;
    syncStateWithUrl(window.location.search);
    const handlePopState = () => syncStateWithUrl(window.location.search);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [loading, db, syncStateWithUrl]);

  // Dynamically update the document title based on the search/result
  useEffect(() => {
    const baseTitle = "閩南語辭典";
    const trimmedSearchTerm = searchTerm.trim();
    const isRandom = trimmedSearchTerm.startsWith("(隨機)");

    if (results.length === 1) {
      const entryName = results[0].hanzi.replace(/【.*?】/g, "").trim();
      document.title = `${entryName} - ${baseTitle}`;
    } else if (trimmedSearchTerm && !isRandom) {
      document.title = `"${trimmedSearchTerm}" - ${baseTitle}`;
    } else {
      document.title = baseTitle;
    }
  }, [results, searchTerm]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSingleEntryView(false);

    let termToSearch = searchTerm.trim();

    // Check for "sound:XXX" shorthand syntax (e.g., "sound:tan", "sound:kín", "sound:tan1")
    const soundMatch = termToSearch.match(/^sound:(\S+)$/i);
    if (soundMatch) {
      let syllable = soundMatch[1];

      // Check for explicit trailing tone number (e.g., "tan1", "kin2")
      let explicitTone: number | null = null;
      const toneNumMatch = syllable.match(/^(.+?)([12345789])$/);
      if (toneNumMatch) {
        syllable = toneNumMatch[1];
        explicitTone = parseInt(toneNumMatch[2]);
      }

      const { initial, final, tone: parsedTone } = parseSyllable(syllable);

      // Only use tone if explicitly provided: trailing number, or a tone diacritic was present.
      // parseSyllable defaults unmarked to 1/4 — detect marks by checking NFD for diacritics.
      const hasExplicitToneMark = syllable.normalize("NFD").split("").some(c => TONE_MARKS[c] !== undefined);
      const finalTone = explicitTone ?? (hasExplicitToneMark ? parsedTone : null);

      if (final) {
        handlePhoneticSearch({
          initial: initial || null,
          final: final,
          tone: finalTone,
          singleSyllableOnly: true,
        }, 0);
        return;
      }
    }

    // Check for Chinese phonetic format: 聲母:X 韻母:Y 聲調:Z
    const hasChinesePhonetic = termToSearch.includes("聲母:") || termToSearch.includes("韻母:") || termToSearch.includes("聲調:");
    if (hasChinesePhonetic || termToSearch.includes("聲韻調")) {
      const initialMatch = termToSearch.match(/聲母:(\S+)/);
      const finalMatch = termToSearch.match(/韻母:(\S+)/);
      const toneMatch = termToSearch.match(/聲調:(\d+)/);

      const initial = initialMatch ? (initialMatch[1] === "零" ? "ling" : initialMatch[1]) : null;
      const final = finalMatch ? finalMatch[1] : null;
      const tone = toneMatch ? parseInt(toneMatch[1]) : null;

      if (initial || final || tone) {
        handlePhoneticSearch({
          initial,
          final,
          tone,
          singleSyllableOnly: true,
        }, 0);
        return;
      }
    }

    // Strip random label prefix
    if (termToSearch.startsWith("(隨機)")) {
      termToSearch = termToSearch.replace(/^\(隨機\)\s*/, "").trim();
      if (!termToSearch) return;
      setSearchTerm(termToSearch);
    }

    const queryKey = modeToQueryKey[searchMode as keyof typeof modeToQueryKey];
    const params = new URLSearchParams();
    if (termToSearch) params.set(queryKey, termToSearch);
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({ path: newUrl }, "", newUrl);
    performSearch(termToSearch, searchMode);
  };

  const searchModeGroups = useMemo(
    () => [
      {
        group: "基本查詢",
        modes: [
          { id: "hokkien_entry", label: "用閩南語查詞目" },
          { id: "mandarin_example", label: "用北平方言查用例" },
          { id: "hokkien_example", label: "用閩南語查用例" },
          { id: "mandarin_fulltext", label: "用北平方言查全文" },
        ],
      },
      {
        group: "進階查詢",
        modes: [
          { id: "hokkien_fulltext", label: "全文(閩南語)" },
          { id: "regex", label: "正規表示式(詞目)" },
          { id: "multi_search", label: "逐詞查詢" },
        ],
      },
    ],
    [],
  );

  if (loading)
    return (
      <div className="p-8 text-center">
        Loading Database... <Spinner />{" "}
      </div>
    );
  if (error && !db) return <ErrorMessage>{error}</ErrorMessage>;

  return (
    <div className="p-4 sm:p-6 md:p-8 font-sans bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <a
          href="/"
          onClick={handleTitleClick}
          className="text-center block cursor-pointer"
        >
          <h1 className="text-4xl font-bold text-center mb-2 text-gray-800">
            閩南語辭典
          </h1>
        </a>
        {!isSingleEntryView && (
          <>
            <div className="flex justify-center gap-4 mb-6 flex-wrap">
              <button
                onClick={handleRandomWord}
                className="flex items-center gap-2 bg-white text-blue-600 px-4 py-2 rounded-full shadow-sm hover:bg-blue-50 transition-colors"
              >
                <Shuffle size={18} />
                隨機一詞
              </button>
              <button
                onClick={() => setCategoryModalOpen(true)}
                className="flex items-center gap-2 bg-white text-blue-600 px-4 py-2 rounded-full shadow-sm hover:bg-blue-50 transition-colors"
              >
                <Menu size={18} />
                依分類瀏覽
              </button>
              <button
                onClick={() => setPhoneticModalOpen(true)}
                className="flex items-center gap-2 bg-white text-blue-600 px-4 py-2 rounded-full shadow-sm hover:bg-blue-50 transition-colors"
              >
                <Music size={18} />
                聲韻調查詢
              </button>
            </div>
            <div className="max-w-4xl mx-auto">
              <form onSubmit={handleSearchSubmit}>
                <div className="flex flex-col sm:flex-row items-center bg-white rounded-full shadow-lg overflow-hidden p-2">
                  <input
                    type="search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="輸入查詢詞..."
                    className="w-full sm:flex-grow p-3 text-lg text-gray-700 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="bg-blue-500 hover:bg-blue-600 text-white rounded-full p-3 m-1 sm:m-0 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  >
                    <Search size={24} />
                  </button>
                </div>
                <div className="mt-4 space-y-2">
                  {searchModeGroups.map((group) => (
                    <div key={group.group}>
                      <p className="text-sm font-semibold text-gray-500 text-center mb-1">
                        {group.group}
                      </p>
                      <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
                        {group.modes.map((mode) => (
                          <StyledRadio
                            key={mode.id}
                            name="searchMode"
                            value={mode.id}
                            checked={searchMode === mode.id}
                            onChange={(e) =>
                              handleSearchModeChange(e.target.value)
                            }
                            label={mode.label}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </form>
            </div>
            <div className="hidden lg:flex justify-end mb-4 max-w-4xl mx-auto">
              <StyledCheckbox
                label="強制單欄顯示 (Always 1 Col)"
                checked={forceSingleColumn}
                onChange={(e) => setForceSingleColumn(e.target.checked)}
              />
            </div>
          </>
        )}

        {searching && <Spinner />}
        {error && !searching && (
          <div className="max-w-4xl mx-auto">
            <ErrorMessage>{error}</ErrorMessage>
          </div>
        )}
        {!searching &&
          results.length === 0 &&
          (searchTerm || isSingleEntryView) &&
          !searchTerm.startsWith("(隨機)") &&
          !searchTerm.startsWith("[聲韻調]") && (
            <p className="text-center text-gray-500">查無結果。</p>
          )}
        {!searching &&
          toneGroups.length === 0 &&
          searchTerm.startsWith("[聲韻調]") && (
            <p className="text-center text-gray-500">查無結果。</p>
          )}

        {/* Phonetic search: show grouped by tone */}
        {isPhoneticSearch && toneGroups.length > 0 && !isSingleEntryView && (
          <div className="max-w-4xl mx-auto">
            <ToneGroupDisplay
              groups={toneGroups}
              onEntryClick={handlePermalinkClick}
            />
          </div>
        )}

        {/* Regular search or single entry view: show cards */}
        {(!isPhoneticSearch || isSingleEntryView) && (
          <div
            data-testid="results-container"
            className={`transition-all duration-500 ${isSingleEntryView || forceSingleColumn || results.length <= 1 ? "max-w-4xl mx-auto" : "lg:columns-2 lg:gap-x-8"}`}
          >
            {results.map((result) => (
              <ResultCard
                key={`${result.id}-${result.hanzi}`}
                result={result}
                onPermalinkClick={handlePermalinkClick}
              />
            ))}
          </div>
        )}
      </div>
      <CategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        categories={categories}
        onSelect={handleCategorySelect}
      />
      <PhoneticPickerModal
        isOpen={isPhoneticModalOpen}
        onClose={() => setPhoneticModalOpen(false)}
        onSearch={handlePhoneticSearch}
        db={db}
      />
    </div>
  );
};

export default HokkienDictionary;
