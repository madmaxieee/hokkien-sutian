import React, { useCallback, useEffect, useMemo, useState } from "react";
import initSqlJs, { Database } from "sql.js";
import { Menu, Music, Search, Settings, Shuffle } from "lucide-react";

import { parseSyllable, TONE_MARKS } from "./phonetics";
import type { Example, EntrySynonym, MeaningSynonym, PhoneticQuery, Result, ToneGroup } from "./types";
import {
  ErrorMessage,
  Spinner,
  StyledRadio,
} from "./components/common";
import { ResultCard } from "./components/ResultCard";
import { ToneGroupDisplay } from "./components/ToneGroupDisplay";
import { CategoryModal } from "./modals/CategoryModal";
import { PhoneticPickerModal } from "./modals/PhoneticPickerModal";
import { SettingsModal } from "./modals/SettingsModal";

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
  const [isSettingsModalOpen, setSettingsModalOpen] = useState(false);
  const [forceSingleColumn, setForceSingleColumn] = useState(false);
  const [alwaysShowButtons, setAlwaysShowButtons] = useState(true);
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

      // Fetch entry-level synonyms
      const entrySynonyms = exec(
        `SELECT synonym_id, synonym_hanzi FROM entry_synonyms WHERE entry_id = ${entryId}`,
      ).values.map((s) => ({
        id: s[0] as number,
        hanzi: s[1] as string,
      })) as EntrySynonym[];

      // Fetch meaning-level synonyms (join with meanings to get entry_id)
      const meaningSynonymsMap = new Map<number, MeaningSynonym[]>();
      meanings.forEach((m) => {
        const synonyms = exec(
          `SELECT ms.synonym_meaning_id, ms.synonym_hanzi, ms.synonym_explanation, m.entry_id
           FROM meaning_synonyms ms
           JOIN meanings m ON ms.synonym_meaning_id = m.id
           WHERE ms.meaning_id = ${m.id}`,
        ).values.map((s) => ({
          meaningId: s[0] as number,
          hanzi: s[1] as string,
          explanation: s[2] as string,
          entryId: s[3] as number,
        })) as MeaningSynonym[];
        if (synonyms.length > 0) {
          meaningSynonymsMap.set(m.id, synonyms);
        }
      });

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
        entry_synonyms: entrySynonyms,
        meaning_synonyms: meaningSynonymsMap,
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
              const syllables = variant.split(/[-\s]+/).filter((s) => s.trim());

              // Skip multi-syllable entries if singleSyllableOnly is true
              if (query.singleSyllableOnly && syllables.length > 1) continue;

              for (const syl of syllables) {
                const { initial, final, tone } = parseSyllable(syl);
                if (!final) continue;

                const entryInitial = initial || "ling";
                const matchesInitial =
                  query.initial === null || entryInitial === query.initial;
                const matchesFinal =
                  query.final === null || final === query.final;
                const matchesTone = query.tone === null || tone === query.tone;

                if (matchesInitial && matchesFinal && matchesTone) {
                  if (!toneToEntries.has(tone)) {
                    toneToEntries.set(tone, new Map());
                  }
                  const syllableMap = toneToEntries.get(tone)!;
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

        const sortedTones = Array.from(toneToEntries.keys()).sort(
          (a, b) => a - b,
        );

        for (const tone of sortedTones) {
          const syllableMap = toneToEntries.get(tone)!;
          const toneEntryIds = new Set<number>();
          let representativeSyllable = "";

          for (const [syl, ids] of syllableMap) {
            if (!representativeSyllable) representativeSyllable = syl;
            ids.forEach((entryId) => {
              toneEntryIds.add(entryId);
              allEntryIds.add(entryId);
            });
          }

          const entries = Array.from(toneEntryIds)
            .map((entryId) => fetchEntryDetails(entryId))
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
          .map((entryId) => fetchEntryDetails(entryId))
          .filter(Boolean) as Result[];
        setResults(sortResults(allResults, ""));

        // Build display label
        const parts: string[] = [];
        if (query.initial)
          parts.push(`聲母:${query.initial === "ling" ? "零" : query.initial}`);
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
    [db, fetchEntryDetails, sortResults],
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
        return;
      }

      if (params.has("si") || params.has("sf") || params.has("st")) {
        const query: PhoneticQuery = {
          initial: params.get("si"),
          final: params.get("sf"),
          tone: params.has("st") ? parseInt(params.get("st")!, 10) : null,
          singleSyllableOnly: params.get("sm") !== "0",
        };
        handlePhoneticSearch(query, 0);
        return;
      }

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
    },
    [fetchEntryDetails, handlePhoneticSearch, performSearch, queryKeyToMode],
  );

  useEffect(() => {
    const loadDb = async () => {
      try {
        const SQL = await initSqlJs();
        const response = await fetch("/assets/data/kautian.db");
        if (!response.ok) {
          throw new Error(`Failed to fetch database: ${response.statusText}`);
        }

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
  }, [db, loading, syncStateWithUrl]);

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
      const hasExplicitToneMark = syllable
        .normalize("NFD")
        .split("")
        .some((c) => TONE_MARKS[c] !== undefined);
      const finalTone =
        explicitTone ?? (hasExplicitToneMark ? parsedTone : null);

      if (final) {
        handlePhoneticSearch(
          {
            initial: initial || null,
            final,
            tone: finalTone,
            singleSyllableOnly: true,
          },
          0,
        );
        return;
      }
    }

    // Check for Chinese phonetic format: 聲母:X 韻母:Y 聲調:Z
    const hasChinesePhonetic =
      termToSearch.includes("聲母:") ||
      termToSearch.includes("韻母:") ||
      termToSearch.includes("聲調:");
    if (hasChinesePhonetic || termToSearch.includes("聲韻調")) {
      const initialMatch = termToSearch.match(/聲母:(\S+)/);
      const finalMatch = termToSearch.match(/韻母:(\S+)/);
      const toneMatch = termToSearch.match(/聲調:(\d+)/);

      const initial = initialMatch
        ? initialMatch[1] === "零"
          ? "ling"
          : initialMatch[1]
        : null;
      const final = finalMatch ? finalMatch[1] : null;
      const tone = toneMatch ? parseInt(toneMatch[1]) : null;

      if (initial || final || tone) {
        handlePhoneticSearch(
          {
            initial,
            final,
            tone,
            singleSyllableOnly: true,
          },
          0,
        );
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

  if (loading) {
    return (
      <div className="p-8 text-center">
        Loading Database... <Spinner />{" "}
      </div>
    );
  }

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
              <button
                onClick={() => setSettingsModalOpen(true)}
                className="flex items-center gap-2 bg-white text-gray-600 px-4 py-2 rounded-full shadow-sm hover:bg-gray-50 transition-colors"
              >
                <Settings size={18} />
                設定
              </button>
            </div>

            <div className="max-w-4xl mx-auto mb-12">
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
            className={`transition-all duration-500 ${
              isSingleEntryView || forceSingleColumn || results.length <= 1
                ? "max-w-4xl mx-auto"
                : "lg:columns-2 lg:gap-x-8"
            }`}
          >
            {results.map((result) => (
              <ResultCard
                key={`${result.id}-${result.hanzi}`}
                result={result}
                onPermalinkClick={handlePermalinkClick}
                alwaysShowButtons={alwaysShowButtons}
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

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        forceSingleColumn={forceSingleColumn}
        onForceSingleColumnChange={setForceSingleColumn}
        alwaysShowButtons={alwaysShowButtons}
        onAlwaysShowButtonsChange={setAlwaysShowButtons}
      />
    </div>
  );
};

export default HokkienDictionary;
