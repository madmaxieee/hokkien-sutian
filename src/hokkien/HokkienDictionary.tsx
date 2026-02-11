import React, { useCallback, useEffect, useMemo, useState } from "react";
import initSqlJs from "sql.js";
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

import type { DBAdapter } from "./db/types";
import { SqlJsAdapter } from "./db/sqljs-adapter";
import {
  fetchCategories,
  fetchEntryDetails,
  fetchRandomEntry,
  performPhoneticSearch,
  performSearch,
  registerRegexp,
} from "./engine";
import type { SearchMode } from "./engine";
import { parseSyllable, TONE_MARKS } from "./phonetics";
import type { PhoneticQuery, Result, ToneGroup } from "./types";
import { ErrorMessage, Spinner, StyledRadio } from "./components/common";
import { ResultsList } from "./components/ResultsList";
import { ToneGroupDisplay } from "./components/ToneGroupDisplay";
import { MODE_TO_QUERY_PARAM, QUERY_PARAM_TO_MODE } from "./queryParams";
import { CategoryModal } from "./modals/CategoryModal";
import { PhoneticPickerModal } from "./modals/PhoneticPickerModal";
import { SettingsModal, type ThemeMode } from "./modals/SettingsModal";

import { parse as parseJsonc } from "jsonc-parser";
import modeHelpText from "../../data/mode-help.jsonc?raw";

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

type ModeHelpFile = {
  modeOrder?: string[];
  modes: Record<string, ModeHelpContent>;
};

const HokkienDictionary = () => {
  const [db, setDb] = useState<DBAdapter | null>(null);
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

  const queryKeyToMode = useMemo(() => QUERY_PARAM_TO_MODE, []);
  const modeToQueryKey = useMemo(() => MODE_TO_QUERY_PARAM, []);

  const runSearch = useCallback(
    (term: string, mode: string) => {
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
        const results = performSearch(db, term, mode as SearchMode);
        setResults(results);
      } catch (err) {
        console.error("Search error:", err);
        setError("查詢時發生錯誤，請檢查您的語法是否正確。");
      } finally {
        setSearching(false);
      }
    },
    [db],
  );

  const handleRandomWord = useCallback(() => {
    if (!db) return;

    setIsPhoneticSearch(false);
    setToneGroups([]);
    setIsSingleEntryView(false);
    setSearching(true);

    const result = fetchRandomEntry(db);
    if (result) {
      setResults([result]);
      setSearchTerm(`(隨機) ${result.hanzi}`);
      setSearchMode("hokkien_entry");

      const params = new URLSearchParams();
      params.set("q", result.hanzi);
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.pushState({ path: newUrl }, "", newUrl);
    }

    setSearching(false);
  }, [db]);

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

      runSearch(category, "category");
    },
    [runSearch],
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

      runSearch(category, "category");
    },
    [runSearch],
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
        const { results: searchResults, toneGroups } = performPhoneticSearch(
          db,
          query,
        );
        setToneGroups(toneGroups);
        setResults(searchResults);

        const parts: string[] = [];
        if (query.initial)
          parts.push(`聲母:${query.initial === "ling" ? "零" : query.initial}`);
        if (query.final) parts.push(`韻母:${query.final}`);
        if (query.tone) parts.push(`聲調:${query.tone}`);
        const label = parts.length > 0 ? parts.join(" ") : "全部";
        const suffix = query.singleSyllableOnly ? "" : " (含多音節)";
        setSearchTerm(`[聲韻調] ${label}${suffix}`);
        setSearchMode("phonetic");

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
    [db],
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
      runSearch(trimmedSearchTerm, newMode);
    }
  };

  const handlePermalinkClick = useCallback(
    (id: number) => {
      if (!db) return;
      const newUrl = `${window.location.pathname}?su=${id}`;
      window.history.pushState({ path: newUrl }, "", newUrl);

      setIsSingleEntryView(true);
      setIsPhoneticSearch(false);

      const result = fetchEntryDetails(db, id);
      setResults(result ? [result] : []);
    },
    [db],
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
        if (!isNaN(id) && db) {
          const result = fetchEntryDetails(db, id);
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
        runSearch(initialTerm, initialMode);
      } else {
        setResults([]);
      }
    },
    [db, handlePhoneticSearch, queryKeyToMode, runSearch],
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
        const adapter = new SqlJsAdapter(dbInstance);
        registerRegexp(adapter);

        setCategories(fetchCategories(adapter));
        setDb(adapter);
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
    runSearch(termToSearch, searchMode);
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

  const modeHelp = useMemo(() => {
    try {
      const parsed = parseJsonc(modeHelpText) as unknown as ModeHelpFile;
      if (!parsed || typeof parsed !== "object") return {};
      if (!parsed.modes || typeof parsed.modes !== "object") return {};
      return parsed.modes as unknown as ModeHelpMap;
    } catch {
      return {};
    }
  }, []);

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
