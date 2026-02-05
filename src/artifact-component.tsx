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
} from "lucide-react";

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
  const audioId = result.audio_file
    ? result.audio_file.match(/\d+/)?.[0]
    : null;
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
  const [forceSingleColumn, setForceSingleColumn] = useState(false);
  const [isSingleEntryView, setIsSingleEntryView] = useState(false);

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
    [db, fetchEntryDetails, queryKeyToMode, performSearch],
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
    const queryKey = modeToQueryKey[searchMode as keyof typeof modeToQueryKey];
    const params = new URLSearchParams();
    if (searchTerm.trim()) params.set(queryKey, searchTerm.trim());
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({ path: newUrl }, "", newUrl);
    performSearch(searchTerm, searchMode);
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
            <div className="flex justify-center gap-4 mb-6">
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
          !searchTerm.startsWith("(隨機)") && (
            <p className="text-center text-gray-500">查無結果。</p>
          )}

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
      </div>
      <CategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        categories={categories}
        onSelect={handleCategorySelect}
      />
    </div>
  );
};

export default HokkienDictionary;
