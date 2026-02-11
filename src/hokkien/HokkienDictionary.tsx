import React, { useCallback, useEffect, useMemo, useState } from "react";
import initSqlJs, { Database } from "sql.js";
import {
  HelpCircle,
  Info,
  Menu,
  Music,
  Search,
  Settings,
  Shuffle,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { parseSyllable, TONE_MARKS } from "./phonetics";
import type {
  Example,
  EntrySynonym,
  MeaningSynonym,
  PhoneticQuery,
  Result,
  ToneGroup,
} from "./types";
import { ErrorMessage, Spinner, StyledRadio } from "./components/common";
import { ResultsList } from "./components/ResultsList";
import { ToneGroupDisplay } from "./components/ToneGroupDisplay";
import { CategoryModal } from "./modals/CategoryModal";
import { PhoneticPickerModal } from "./modals/PhoneticPickerModal";
import { SettingsModal, type ThemeMode } from "./modals/SettingsModal";

const THEME_STORAGE_KEY = "hokkien-sutian:theme";

type ModeHelpExampleLink = {
  url: string;
  label?: string;
};

type ModeHelpExample =
  | string
  | {
      query: string;
      note?: string;
      links?: ModeHelpExampleLink[];
    };

type ModeHelpContent = {
  title: string;
  description: string;
  how: string[];
  examples: ModeHelpExample[];
};

type ModeHelpMap = Record<string, ModeHelpContent>;

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
  const [activeModeHelp, setActiveModeHelp] = useState<string | null>(null);
  const [isGlobalHelpOpen, setGlobalHelpOpen] = useState(false);
  const [forceSingleColumn, setForceSingleColumn] = useState(false);
  const [alwaysShowButtons, setAlwaysShowButtons] = useState(true);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "system";
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    return saved === "light" || saved === "dark" || saved === "system"
      ? saved
      : "system";
  });
  const [isSingleEntryView, setIsSingleEntryView] = useState(false);
  const [toneGroups, setToneGroups] = useState<ToneGroup[]>([]);
  const [isPhoneticSearch, setIsPhoneticSearch] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    } catch {
      // Ignore storage errors (private mode, disabled storage, etc.)
    }
  }, [themeMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const root = window.document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const applyTheme = () => {
      const shouldUseDark =
        themeMode === "dark" || (themeMode === "system" && media.matches);
      root.classList.toggle("dark", shouldUseDark);
    };

    applyTheme();

    if (themeMode !== "system") return;

    const onChange = () => applyTheme();
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    }

    // Safari < 14
    // eslint-disable-next-line deprecation/deprecation
    media.addListener(onChange);
    // eslint-disable-next-line deprecation/deprecation
    return () => media.removeListener(onChange);
  }, [themeMode]);

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

    // If we were in phonetic mode, ensure we exit it so random results render.
    setIsPhoneticSearch(false);
    setToneGroups([]);

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

        // Keep deep-linking consistent: random word behaves like a normal Hokkien entry query.
        const params = new URLSearchParams();
        params.set("q", result.hanzi);
        const newUrl = `${window.location.pathname}?${params.toString()}`;
        window.history.pushState({ path: newUrl }, "", newUrl);
      }
    }

    setSearching(false);
  }, [db, fetchEntryDetails]);

  const handleCategorySelect = useCallback(
    (category: string) => {
      setIsSingleEntryView(false);
      setCategoryModalOpen(false);
      setIsPhoneticSearch(false);
      setToneGroups([]);
      setSearchTerm(category);
      setSearchMode("category");

      const newUrl = `${window.location.pathname}?cat=${encodeURIComponent(category)}`;
      window.history.pushState({ path: newUrl }, "", newUrl);

      performSearch(category, "category");
    },
    [performSearch],
  );

  const handleCategoryClick = useCallback(
    (category: string) => {
      setIsSingleEntryView(false);
      setIsPhoneticSearch(false);
      setToneGroups([]);
      setSearchTerm(category);
      setSearchMode("category");

      const newUrl = `${window.location.pathname}?cat=${encodeURIComponent(category)}`;
      window.history.pushState({ path: newUrl }, "", newUrl);

      performSearch(category, "category");
    },
    [performSearch],
  );

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
    setIsPhoneticSearch(false);
    setToneGroups([]);

    const trimmedSearchTerm = searchTerm.trim();
    if (trimmedSearchTerm && !trimmedSearchTerm.startsWith("(隨機)")) {
      const queryKey = modeToQueryKey[newMode as keyof typeof modeToQueryKey];
      const newUrl = `${window.location.pathname}?${queryKey}=${encodeURIComponent(trimmedSearchTerm)}`;
      window.history.pushState({ path: newUrl }, "", newUrl);
      performSearch(trimmedSearchTerm, newMode);
    }
  };

  const handlePermalinkClick = useCallback(
    (id: number) => {
      const newUrl = `${window.location.pathname}?su=${id}`;
      window.history.pushState({ path: newUrl }, "", newUrl);

      setIsSingleEntryView(true);
      setIsPhoneticSearch(false);

      const result = fetchEntryDetails(id);
      setResults(result ? [result] : []);
    },
    [fetchEntryDetails],
  );

  const handleTitleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsSingleEntryView(false);
    setIsPhoneticSearch(false);
    setToneGroups([]);
    setResults([]);
    setSearchTerm("");
    setSearchMode("hokkien_entry");
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
        setIsPhoneticSearch(false);
        setToneGroups([]);
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
      setIsPhoneticSearch(false);
      setToneGroups([]);

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

    // Any non-phonetic submit exits phonetic display state.
    setIsPhoneticSearch(false);
    setToneGroups([]);

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

  const modeHelp = useMemo(
    () =>
      ({
        hokkien_entry: {
          title: "用閩南語查詞目",
          description:
            "在『詞目』中用漢字或台羅（羅馬字）搜尋。支援包含式比對（類似 %關鍵字%），輸入片段也能找到。",
          how: [
            "會同時比對：詞目的漢字（含【白】【文】等標記）與台羅拼寫。",
            "如果想找特定標記，也可以直接輸入【白】或【文】之類的字樣。",
          ],
          examples: [
            "?q=袂",
            "?q=嚨喉",
            "?q=尻川",
            "?q=食",
            "?q=tsia̍h",
            "?q=【白】",
          ],
        },
        mandarin_example: {
          title: "用北平方言查用例",
          description:
            "用北平方言（例句翻譯）來找用例；找到符合的例句後，再回推對應的詞目。",
          how: [
            "搜尋範圍只在『用例的北平方言翻譯』欄位。",
            "同一個詞目如果有多個符合的用例，只會顯示一次詞目（結果去重）。",
          ],
          examples: ["?me=運動", "?me=生氣", "?me=一起"],
        },
        hokkien_example: {
          title: "用閩南語查用例",
          description:
            "在『用例』中用漢字或台羅搜尋，適合想從例句找回詞目的時候。",
          how: [
            "搜尋範圍在：用例漢字、用例台羅。",
            "同一個詞目如果有多個符合的用例，只會顯示一次詞目（結果去重）。",
          ],
          examples: ["?hf=食", "?hf=tsia̍h", "?hf=beh"],
        },
        mandarin_fulltext: {
          title: "用北平方言查全文",
          description:
            "用北平方言做全面搜尋：會查詞目漢字、釋義（北平方言解釋）、以及用例的北平方言翻譯。",
          how: [
            "適合只記得北平方言意思、想找出對應閩南語詞目的情境。",
            "結果會合併去重（同一詞目被多個欄位命中也只會出現一次）。",
          ],
          examples: ["?mf=感謝", "?mf=稱讚", "?mf=害怕"],
        },
        hokkien_fulltext: {
          title: "全文(閩南語)",
          description: "用閩南語做全文搜尋：會同時查詞目與用例的漢字/台羅。",
          how: [
            "比『用閩南語查詞目』更廣：例句裡出現的詞也會被命中。",
            "結果會合併去重。",
          ],
          examples: ["?hft=食", "?hft=tsia̍h", "?hft=lí"],
        },
        regex: {
          title: "正規表示式(詞目)",
          description:
            "用正規表示式（Regex）搜尋『詞目漢字』欄位。適合做模式比對或精準篩選。",
          how: [
            "只會對『詞目漢字』做比對（不含台羅、釋義、用例）。",
            "語法採 JavaScript RegExp；若語法錯誤會提示查詢失敗。",
            "常用：^ 開頭、$ 結尾、.* 任意字串、[...] 字元集合。",
          ],
          examples: ["?rx=^【白】", "?rx=食.*", "?rx=^.*飯$"],
        },
        multi_search: {
          title: "逐詞查詢",
          description:
            "把輸入的句子拆成多個片段，從『最長』開始嘗試做『完全相等』的詞目比對，找出句中包含的詞。",
          how: [
            "比對方式是『詞目漢字完全相等』，不是包含式比對。",
            "建議輸入一整句漢字（少標點/少空白）來找出可能的詞目切分。",
          ],
          examples: [
            "?qs=龍溪",
            {
              query: "?qs=嚨喉出力講袂出聲",
              note: "源：傷心地獄芳花引魂",
              links: [
                {
                  url: "https://www.youtube.com/watch?v=5vyT2qDmFhE",
                },
              ],
            },
            "?qs=我欲食飯",
            "?qs=伊會曉講",
            "?qs=你欲去佗位",
          ],
        },
      }) satisfies ModeHelpMap,
    [],
  );

  const activeModeHelpContent =
    activeModeHelp && activeModeHelp in modeHelp
      ? modeHelp[activeModeHelp as keyof typeof modeHelp]
      : null;

  const applyExampleQuery = useCallback(
    (example: string) => {
      if (typeof window === "undefined") return;
      if (!example.startsWith("?")) return;

      // Close the help dialog first so the UI feels responsive.
      setActiveModeHelp(null);

      const newUrl = `${window.location.pathname}${example}`;
      window.history.pushState({ path: newUrl }, "", newUrl);
      syncStateWithUrl(example);
    },
    [syncStateWithUrl],
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
    <div className="p-4 sm:p-6 md:p-8 font-sans bg-background text-foreground min-h-screen">
      <div className="max-w-7xl mx-auto">
        <a
          href="/"
          onClick={handleTitleClick}
          className="text-center block cursor-pointer"
        >
          <h1 className="text-4xl font-bold text-center mb-2">閩南語辭典</h1>
        </a>

        {!isSingleEntryView && (
          <>
            <div className="flex justify-center gap-4 mb-6 flex-wrap">
              <button
                onClick={handleRandomWord}
                className="flex items-center gap-2 bg-card text-blue-600 dark:text-blue-400 px-4 py-2 rounded-full shadow-sm border border-border hover:bg-accent transition-colors"
              >
                <Shuffle size={18} />
                隨機一詞
              </button>
              <button
                onClick={() => setCategoryModalOpen(true)}
                className="flex items-center gap-2 bg-card text-blue-600 dark:text-blue-400 px-4 py-2 rounded-full shadow-sm border border-border hover:bg-accent transition-colors"
              >
                <Menu size={18} />
                依分類瀏覽
              </button>
              <button
                onClick={() => setPhoneticModalOpen(true)}
                className="flex items-center gap-2 bg-card text-blue-600 dark:text-blue-400 px-4 py-2 rounded-full shadow-sm border border-border hover:bg-accent transition-colors"
              >
                <Music size={18} />
                聲韻調查詢
              </button>
              <button
                onClick={() => setSettingsModalOpen(true)}
                className="flex items-center gap-2 bg-card text-muted-foreground px-4 py-2 rounded-full shadow-sm border border-border hover:bg-accent transition-colors"
              >
                <Settings size={18} />
                設定
              </button>
              <button
                onClick={() => setGlobalHelpOpen(true)}
                className="flex items-center gap-2 bg-card text-muted-foreground px-4 py-2 rounded-full shadow-sm border border-border hover:bg-accent transition-colors"
              >
                <HelpCircle size={18} />
                使用說明
              </button>
            </div>

            {/* mb-4 controls whitespace here:
  用閩南語查詞目                                                                                                                                                                                                                                
  用北平方言查用例                                                                                                                                                                                                                              
  用閩南語查用例                                                                                                                                                                                                                                
  用北平方言查全文                                                                                                                                                                                                                              
  進階查詢                                                                                                                                                                                                                                      
  全文(閩南語)                                                                                                                                                                                                                                  
  正規表示式(詞目)                                                                                                                                                                                                                              
  逐詞查詢                                                                                                                                                                                                                                      
  ---                                                                                                                                                                                                                                           
  whitespace here!!!!>                                                                                                                                                                                                   
  <search results>   
  */}
            <div className="max-w-4xl mx-auto mb-4">
              <form onSubmit={handleSearchSubmit}>
                <div className="flex flex-col sm:flex-row items-center bg-card rounded-full shadow-lg overflow-hidden p-2 border border-border">
                  <input
                    type="search"
                    value={searchTerm}
                    onChange={(e) => {
                      const nextValue = e.target.value;
                      setSearchTerm(nextValue);

                      // Native clear-[x] (and manual deletion) should fully reset URL + app state.
                      if (nextValue === "") {
                        setError(null);
                        setIsSingleEntryView(false);
                        setIsPhoneticSearch(false);
                        setToneGroups([]);
                        setResults([]);

                        // If we were in the implicit phonetic mode, snap back to a valid radio mode.
                        setSearchMode((prev) =>
                          prev === "phonetic" ? "hokkien_entry" : prev,
                        );

                        window.history.pushState(
                          { path: window.location.pathname },
                          "",
                          window.location.pathname,
                        );
                      }
                    }}
                    placeholder="輸入查詢詞..."
                    className="w-full sm:flex-grow p-3 text-lg bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-full p-3 m-1 sm:m-0 focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-500"
                  >
                    <Search size={24} />
                  </button>
                </div>

                <div className="mt-4 space-y-2">
                  {searchModeGroups.map((group) => (
                    <div key={group.group}>
                      <p className="text-sm font-semibold text-muted-foreground text-center mb-1">
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
                            afterLabel={
                              <button
                                type="button"
                                aria-label={`${mode.label} 說明`}
                                className="ml-1 inline-flex items-center justify-center rounded-sm p-0.5 text-muted-foreground hover:text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setActiveModeHelp(mode.id);
                                }}
                              >
                                <Info size={16} />
                              </button>
                            }
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
            <p className="text-center text-muted-foreground">查無結果。</p>
          )}

        {!searching &&
          toneGroups.length === 0 &&
          searchTerm.startsWith("[聲韻調]") && (
            <p className="text-center text-muted-foreground">查無結果。</p>
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
          <ResultsList
            results={results}
            onPermalinkClick={handlePermalinkClick}
            onCategoryClick={handleCategoryClick}
            alwaysShowButtons={alwaysShowButtons}
            isSingleEntryView={isSingleEntryView}
            forceSingleColumn={forceSingleColumn}
          />
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
        themeMode={themeMode}
        onThemeModeChange={setThemeMode}
      />

      <Dialog
        open={activeModeHelp !== null}
        onOpenChange={(open) => {
          if (!open) setActiveModeHelp(null);
        }}
      >
        <DialogContent className="max-h-[75vh] overflow-auto">
          {activeModeHelpContent ? (
            <>
              <DialogHeader>
                <DialogTitle>{activeModeHelpContent.title}</DialogTitle>
                <DialogDescription>
                  {activeModeHelpContent.description}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="space-y-1">
                  <p className="font-semibold">運作方式</p>
                  <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                    {activeModeHelpContent.how.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
                <div className="space-y-1">
                  <p className="font-semibold">範例</p>
                  <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                    {activeModeHelpContent.examples.map((ex, idx) => {
                      const query = typeof ex === "string" ? ex : ex.query;
                      const note: string | undefined =
                        typeof ex === "string" ? undefined : ex.note;
                      const links: ModeHelpExampleLink[] | undefined =
                        typeof ex === "string" ? undefined : ex.links;

                      return (
                        <li key={`${query}-${idx}`}>
                          <button
                            type="button"
                            className="font-mono underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                            onClick={() => applyExampleQuery(query)}
                          >
                            {query}
                          </button>
                          {(note || (links && links.length > 0)) && (
                            <div className="mt-1 space-y-1">
                              {note && (
                                <div className="text-xs text-muted-foreground">
                                  {note}
                                </div>
                              )}
                              {links && links.length > 0 && (
                                <div className="text-xs text-muted-foreground">
                                  {links.map((link, linkIdx) => (
                                    <React.Fragment
                                      key={`${link.url}-${linkIdx}`}
                                    >
                                      {linkIdx > 0 ? " · " : null}
                                      <a
                                        href={link.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="underline underline-offset-4 hover:text-foreground"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {link.label ?? link.url}
                                      </a>
                                    </React.Fragment>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </>
          ) : (
            <DialogHeader>
              <DialogTitle>說明</DialogTitle>
              <DialogDescription>
                找不到此查詢模式的說明內容。
              </DialogDescription>
            </DialogHeader>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isGlobalHelpOpen} onOpenChange={setGlobalHelpOpen}>
        <DialogContent className="max-h-[75vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>使用說明</DialogTitle>
            <DialogDescription>
              這是一個在瀏覽器內執行的閩南語辭典（SQLite
              資料庫直接在本機載入查詢）。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <div className="space-y-1">
              <p className="font-semibold">快速開始</p>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li>直接在上方輸入框輸入漢字或台羅，按放大鏡搜尋。</li>
                <li>不確定要查什麼，可以先按「隨機一詞」探索。</li>
                <li>想按分類找詞，點「依分類瀏覽」。</li>
                <li>想用聲母/韻母/聲調找讀音，點「聲韻調查詢」。</li>
              </ul>
            </div>

            <div className="space-y-1">
              <p className="font-semibold">查詢模式</p>
              <p className="text-muted-foreground">
                搜尋框下方的模式（單選）會影響查詢範圍。每個模式旁的 ⓘ
                可以查看詳細說明與範例。
              </p>
            </div>

            <div className="space-y-1">
              <p className="font-semibold">資料來源</p>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li>
                  詞典資料來源為臺灣教育部《臺灣閩南語常用詞辭典》（MOE）。
                </li>
                <li>
                  上游原始資料為 ODS 格式；我使用整理/匯入腳本轉成
                  SQLite（kautian.db）。
                </li>
                <li>
                  匯入與整理腳本：
                  <a
                    href="https://github.com/tddschn/moe-hokkien-sutian-data"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-4 hover:text-foreground"
                  >
                    github.com/tddschn/moe-hokkien-sutian-data
                  </a>
                </li>
                <li>
                  下載資料庫：
                  <a
                    href="/assets/data/kautian.db"
                    className="underline underline-offset-4 hover:text-foreground"
                    download
                  >
                    kautian.db
                  </a>
                </li>
              </ul>
            </div>

            <div className="space-y-1">
              <p className="font-semibold">結果卡片小技巧</p>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li>可播放/下載 MOE 音檔（若該詞有音檔）。</li>
                <li>可複製文字、或點擊分類快速再查詢。</li>
                <li>點擊詞目可產生可分享的連結（單筆詞目檢視）。</li>
              </ul>
            </div>

            <p className="text-muted-foreground">
              不妨多試幾種模式：例如用「用北平方言查全文」從北平方言意思反查，或用「逐詞查詢」解析整句話。
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HokkienDictionary;
