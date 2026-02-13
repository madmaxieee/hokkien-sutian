#!/usr/bin/env bun
import { existsSync, readFileSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { dirname } from "node:path";

import { cac } from "cac";
import React from "react";

import { Database } from "bun:sqlite";

import { parse as parseJsonc } from "jsonc-parser";

import { BunSqliteAdapter } from "../src/hokkien/db/bun-adapter";
import {
  fetchEntryDetails,
  fetchRandomEntry,
  performPhoneticSearch,
  performSearchWithMeta,
  registerRegexp,
} from "../src/hokkien/engine";
import type { SearchMode } from "../src/hokkien/engine";
import type { PhoneticQuery } from "../src/hokkien/types";
import type { Result, ToneGroup } from "../src/hokkien/types";

import {
  QUERY_PARAM_TO_MODE,
  getFallbackAutoSwitchModes,
  isQueryParamModeKey,
} from "../src/hokkien/queryParams";
import {
  getAppEntryUrl,
  getMoeAudioUrl,
  getMoeEntryUrl,
  getSuiSiannUrl,
} from "../src/hokkien/urls";

const DEFAULT_CACHE_DIR = `${process.env.HOME}/.cache/hokkien-sutian`;
const DEFAULT_DB_PATH = `${DEFAULT_CACHE_DIR}/kautian.db`;
const DEFAULT_SOURCE_URL = "https://sutian.teddysc.me/assets/data/kautian.db";
const DEFAULT_APP_BASE_URL = "https://sutian.teddysc.me";
const LOCAL_APP_BASE_URL = "http://hokkien-sutian.localhost:10390/";
const DEFAULT_RESULT_LIMIT = 200;

const resolveAppBaseUrl = (options: Record<string, unknown>): string => {
  if (options.local === true) return LOCAL_APP_BASE_URL;

  const envValue = process.env.HOKKIEN_SUTIAN_BASE_URL?.trim();
  if (envValue) return envValue;

  const optionValue =
    typeof options.baseUrl === "string" ? options.baseUrl.trim() : "";
  if (optionValue) return optionValue;

  return DEFAULT_APP_BASE_URL;
};

const makeTerminalLink = (url: string, label: string) =>
  `\u001b]8;;${url}\u0007${label}\u001b]8;;\u0007`;

const getAppCategoryUrl = (baseUrl: string, category: string) => {
  const trimmed = baseUrl.replace(/\/$/, "");
  return `${trimmed}/?cat=${encodeURIComponent(category)}`;
};

const getAppQueryUrl = (
  baseUrl: string,
  payload: {
    mode: string;
    term?: string | null;
  },
) => {
  const term = payload.term ?? "";
  if (!term) return null;

  const modeToParam: Record<string, string> = {
    hokkien_entry: "q",
    mandarin_example: "me",
    hokkien_example: "hf",
    mandarin_fulltext: "mf",
    hokkien_fulltext: "hft",
    regex: "rx",
    category: "cat",
    multi_search: "qs",
    single_entry: "su",
  };

  const key = modeToParam[payload.mode];
  if (!key) return null;

  const trimmed = baseUrl.replace(/\/$/, "");
  return `${trimmed}/?${key}=${encodeURIComponent(term)}`;
};

const linkOrText = (url: string | null, label: string) =>
  url ? makeTerminalLink(url, label) : label;

const formatInkCategories = (baseUrl: string, category: string) => {
  const parts = category
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return "";
  return parts
    .map((c) => makeTerminalLink(getAppCategoryUrl(baseUrl, c), c))
    .join(", ");
};

const formatInkIthuanValue = (value: string, seen: Set<string>) => {
  const tokens = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (tokens.length === 0) return value;

  return tokens
    .map((token) => {
      if (seen.has(token)) return token;
      seen.add(token);
      return linkOrText(getSuiSiannUrl(token), token);
    })
    .join(", ");
};

type ModeHelpExampleLink = { url: string; label?: string };
type ModeHelpExample =
  | string
  | { query: string; note?: string; links?: ModeHelpExampleLink[] };
type ModeHelpContent = {
  title: string;
  description: string;
  how: string[];
  examples: ModeHelpExample[];
};
type ModeHelpFile = {
  modeOrder?: string[];
  modes: Record<string, ModeHelpContent>;
};

const loadModeHelpFile = (): ModeHelpFile | null => {
  try {
    const fileUrl = new URL("../data/mode-help.jsonc", import.meta.url);
    const text = readFileSync(fileUrl, "utf8");
    return parseJsonc(text) as ModeHelpFile;
  } catch {
    return null;
  }
};

const formatCliExampleFromQuery = (
  queryString: string,
): { mode: string; term?: string; extraArgs?: string[] } | null => {
  if (!queryString.startsWith("?")) return null;
  const params = new URLSearchParams(queryString);

  const get = (key: string) => {
    const value = params.get(key);
    return value === null ? null : value;
  };

  const q = get("q") ?? get("he");
  if (q !== null) return { mode: "hokkien_entry", term: q };

  const me = get("me");
  if (me !== null) return { mode: "mandarin_example", term: me };

  const hf = get("hf");
  if (hf !== null) return { mode: "hokkien_example", term: hf };

  const mf = get("mf");
  if (mf !== null) return { mode: "mandarin_fulltext", term: mf };

  const hft = get("hft");
  if (hft !== null) return { mode: "hokkien_fulltext", term: hft };

  const rx = get("rx");
  if (rx !== null) return { mode: "regex", term: rx };

  const qs = get("qs");
  if (qs !== null) return { mode: "multi_search", term: qs };

  const cat = get("cat");
  if (cat !== null) return { mode: "category", term: cat };

  const su = get("su");
  if (su !== null) return { mode: "single_entry", term: su };

  const si = get("si");
  const sf = get("sf");
  const st = get("st");
  const sm = get("sm");
  if (si !== null || sf !== null || st !== null) {
    const extraArgs: string[] = [];
    if (si !== null) extraArgs.push("--si", si);
    if (sf !== null) extraArgs.push("--sf", sf);
    if (st !== null) extraArgs.push("--st", st);
    if (sm !== null) extraArgs.push("--sm", sm);
    return { mode: "phonetic", extraArgs };
  }

  return null;
};

const quoteArg = (value: string) => {
  // Minimal shell-friendly quoting for help output.
  const escaped = value.replaceAll('"', '\\"');
  return `"${escaped}"`;
};

type UrlPhoneticArgs = {
  si?: string;
  sf?: string;
  st?: string;
  sm?: string;
};

const parseIthuanUrlTerm = (input: string): string | null => {
  const trimmed = input.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (url.hostname !== "suisiann.ithuan.tw") return null;

  // Accept both encoded and decoded path forms.
  const encodedPrefix = "/%E8%AC%9B/";
  const decodedPrefix = "/講/";
  const prefix = url.pathname.startsWith(encodedPrefix)
    ? encodedPrefix
    : url.pathname.startsWith(decodedPrefix)
      ? decodedPrefix
      : null;
  if (!prefix) return null;

  const rest = url.pathname.slice(prefix.length);
  const first = rest.split("/").filter(Boolean)[0];
  if (!first) return null;

  try {
    return decodeURIComponent(first);
  } catch {
    return null;
  }
};

const parseQueryLikeInput = (
  input: string,
): { mode: string; term?: string; phoneticArgs?: UrlPhoneticArgs } | null => {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const tryParseQuery = (queryString: string) => {
    const parsed = formatCliExampleFromQuery(queryString);
    if (!parsed) return null;
    if (parsed.mode !== "phonetic")
      return { mode: parsed.mode, term: parsed.term };

    const phoneticArgs: UrlPhoneticArgs = {};
    const args = parsed.extraArgs ?? [];
    for (let i = 0; i < args.length; i++) {
      const key = args[i];
      const value = args[i + 1];
      if (typeof value !== "string") continue;
      if (key === "--si") phoneticArgs.si = value;
      if (key === "--sf") phoneticArgs.sf = value;
      if (key === "--st") phoneticArgs.st = value;
      if (key === "--sm") phoneticArgs.sm = value;
    }
    return { mode: "phonetic", phoneticArgs };
  };

  if (trimmed.startsWith("?")) {
    return tryParseQuery(trimmed);
  }

  const qIndex = trimmed.indexOf("?");
  if (qIndex < 0) return null;

  // Accept full URLs, or any string that contains a query-string.
  // Prefer URL parsing (so we correctly handle fragments), then fall back.
  try {
    const url = new URL(trimmed);
    return tryParseQuery(url.search);
  } catch {
    return tryParseQuery(trimmed.slice(qIndex));
  }
};

const formatCliArgs = (args: string[]) =>
  args.map((arg) => (arg.startsWith("-") ? arg : quoteArg(arg))).join(" ");

const makeExamplesSection = (helpFile: ModeHelpFile | null): string => {
  const modeOrder =
    helpFile?.modeOrder && helpFile.modeOrder.length > 0
      ? helpFile.modeOrder
      : [
          "hokkien_entry",
          "mandarin_example",
          "hokkien_example",
          "mandarin_fulltext",
          "hokkien_fulltext",
          "regex",
          "category",
          "multi_search",
          "single_entry",
          "phonetic",
        ];
  const modes = helpFile?.modes ?? {};

  const modeLines = modeOrder
    .map((id) => {
      const title = modes[id]?.title;
      return title ? `  ${id.padEnd(16)} ${title}` : `  ${id}`;
    })
    .join("\n");

  const exampleLines: string[] = [];
  for (const modeId of modeOrder) {
    const examples = modes[modeId]?.examples ?? [];
    for (const ex of examples) {
      const query = typeof ex === "string" ? ex : ex.query;
      const note = typeof ex === "string" ? null : (ex.note ?? null);
      const links = typeof ex === "string" ? null : (ex.links ?? null);

      const parsed = formatCliExampleFromQuery(query);
      if (!parsed) continue;

      if (note) {
        const linkSuffix = links?.[0]?.url ? ` ${links[0].url}` : "";
        exampleLines.push(`  # ${note}${linkSuffix}`);
      }

      const base = `  hokkien-sutian-query -m ${parsed.mode}`;
      if (parsed.term !== undefined) {
        exampleLines.push(`${base} -t ${quoteArg(parsed.term)}`);
      } else if (parsed.extraArgs && parsed.extraArgs.length > 0) {
        exampleLines.push(`${base} ${formatCliArgs(parsed.extraArgs)}`);
      }
    }
  }
  const exampleText =
    exampleLines.length > 0
      ? exampleLines.join("\n")
      : "  (no examples configured)";

  return `\nModes:\n${modeLines}\n\nExamples:\n${exampleText}`;
};

type ResolvedMode = SearchMode | "phonetic";

const isResolvedMode = (value: string): value is ResolvedMode =>
  value === "phonetic" || isSearchMode(value);

const resolveModeToken = (token: string): ResolvedMode | null => {
  const trimmed = token.trim();
  if (!trimmed) return null;
  if (trimmed === "phonetic") return "phonetic";
  if (isResolvedMode(trimmed)) return trimmed;
  if (isQueryParamModeKey(trimmed)) return QUERY_PARAM_TO_MODE[trimmed];
  return null;
};

const pickModeAndTerm = (
  argv: string[],
  options: { mode?: string; term?: string },
): {
  modeToken: string;
  term: string | null;
  leftoverArgs: string[];
  urlPhoneticArgs?: UrlPhoneticArgs;
} => {
  const [a0, a1, ...rest] = argv;

  const explicitMode = options.mode?.toString();
  const explicitTerm = options.term?.toString();

  const explicitTermNormalized = explicitTerm
    ? (parseIthuanUrlTerm(explicitTerm) ?? explicitTerm)
    : undefined;

  // If the user passed a URL/query-string as the term, extract mode + query.
  // This is only used when mode isn't explicitly forced.
  const explicitTermUrl = explicitTermNormalized
    ? parseQueryLikeInput(explicitTermNormalized)
    : null;

  if (explicitMode) {
    const positional = a0 ? (parseIthuanUrlTerm(a0) ?? a0) : null;
    const term = explicitTermNormalized ?? positional ?? null;
    return { modeToken: explicitMode, term, leftoverArgs: rest };
  }

  if (explicitTermUrl) {
    return {
      modeToken: explicitTermUrl.mode,
      term: explicitTermUrl.term ?? null,
      leftoverArgs: argv,
      urlPhoneticArgs: explicitTermUrl.phoneticArgs,
    };
  }

  if (a0) {
    const ithuanTerm = parseIthuanUrlTerm(a0);
    if (ithuanTerm) {
      const leftoverArgs = [a1, ...rest].filter(Boolean) as string[];
      return { modeToken: "qs", term: ithuanTerm, leftoverArgs };
    }

    const urlParsed = parseQueryLikeInput(a0);
    if (urlParsed) {
      return {
        modeToken: urlParsed.mode,
        term: urlParsed.term ?? null,
        leftoverArgs: [a1, ...rest].filter(Boolean) as string[],
        urlPhoneticArgs: urlParsed.phoneticArgs,
      };
    }

    const resolved = resolveModeToken(a0);
    if (resolved) {
      const positionalTerm = a1 ? (parseIthuanUrlTerm(a1) ?? a1) : null;
      const term = explicitTermNormalized ?? positionalTerm ?? null;
      return { modeToken: a0, term, leftoverArgs: rest };
    }
  }

  const a0Normalized = a0 ? (parseIthuanUrlTerm(a0) ?? a0) : null;
  const term = explicitTermNormalized ?? a0Normalized ?? null;
  return {
    modeToken: "qs",
    term,
    leftoverArgs: [a1, ...rest].filter(Boolean) as string[],
  };
};

const downloadDatabase = async (dbPath: string): Promise<void> => {
  await mkdir(dirname(dbPath), { recursive: true });
  const response = await fetch(DEFAULT_SOURCE_URL);
  if (!response.ok) {
    throw new Error(
      `Download failed: ${response.status} ${response.statusText}`,
    );
  }
  await Bun.write(dbPath, await response.arrayBuffer());
};

const ensureDbPath = async (
  dbPath: string,
  allowDownload: boolean,
  forceRedownload: boolean,
): Promise<string> => {
  if (forceRedownload) {
    if (existsSync(dbPath)) {
      await rm(dbPath);
    }
    await downloadDatabase(dbPath);
    return dbPath;
  }

  if (existsSync(dbPath)) return dbPath;

  if (!allowDownload) {
    throw new Error(
      `Database not found at ${dbPath}. Use --download to fetch.`,
    );
  }

  await downloadDatabase(dbPath);
  return dbPath;
};

const isSearchMode = (value: string): value is SearchMode =>
  [
    "hokkien_entry",
    "mandarin_example",
    "hokkien_example",
    "mandarin_fulltext",
    "regex",
    "hokkien_fulltext",
    "category",
    "multi_search",
    "single_entry",
  ].includes(value);

type AlfredScriptFilterMod = {
  valid?: boolean;
  arg?: string | string[];
  subtitle?: string;
};

type AlfredScriptFilterItem = {
  uid?: string;
  title: string;
  subtitle?: string;
  arg?: string | string[];
  valid?: boolean;
  mods?: {
    cmd?: AlfredScriptFilterMod;
    alt?: AlfredScriptFilterMod;
    ctrl?: AlfredScriptFilterMod;
  };
  text?: {
    largetype?: string;
  };
};

type AlfredScriptFilterOutput = {
  items: AlfredScriptFilterItem[];
};

const trimForSingleLine = (value: string, max: number) => {
  const s = value.replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  return `${s.slice(0, Math.max(0, max - 1))}…`;
};

const resultToAlfredItem = (
  result: Result,
  appBaseUrl: string,
): AlfredScriptFilterItem => {
  const title = `${result.hanzi} ${result.romanization}`.trim();
  const meaningText = result.meanings
    .map((m) => {
      const part = m.part_of_speech ? `${m.part_of_speech} ` : "";
      return `${m.display_id}. ${part}${m.explanation.replace(/^:/, "").trim()}`.trim();
    })
    .filter(Boolean)
    .join("；");

  const subtitle = meaningText
    ? trimForSingleLine(meaningText, 160)
    : undefined;

  const appUrl = getAppEntryUrl(appBaseUrl, result.id);
  const moeUrl = getMoeEntryUrl(result.id);
  const ithuanUrl = getSuiSiannUrl(result.hanzi);

  const hasAudio = Boolean(result.audio_file);
  const audioUrl = hasAudio ? getMoeAudioUrl(result.id) : null;

  const largetype = [
    result.hanzi,
    result.romanization,
    "",
    ...(result.meanings.length > 0
      ? result.meanings.map((m) => {
          const part = m.part_of_speech ? `${m.part_of_speech} ` : "";
          return `${m.display_id}. ${part}${m.explanation.replace(/^:/, "").trim()}`.trim();
        })
      : ["(無釋義)"]),
  ].join("\n");

  return {
    uid: String(result.id),
    title,
    subtitle,
    arg: appUrl,
    mods: {
      cmd: {
        valid: true,
        arg: moeUrl,
        subtitle: "教育部辭典",
      },
      alt: ithuanUrl
        ? {
            valid: true,
            arg: ithuanUrl,
            subtitle: "鬥拍字 朗讀/查詢",
          }
        : {
            valid: false,
            subtitle: "無法產生鬥拍字連結",
          },
      ctrl:
        hasAudio && audioUrl
          ? {
              valid: true,
              arg: audioUrl,
              subtitle: "語音 (mp3)",
            }
          : {
              valid: false,
              subtitle: "無語音",
            },
    },
    text: {
      largetype,
    },
  };
};

const resultsToAlfredOutput = (
  results: Result[],
  appBaseUrl: string,
): AlfredScriptFilterOutput => ({
  items: results.map((result) => resultToAlfredItem(result, appBaseUrl)),
});

const renderInkResults = async (payload: {
  mode: string;
  term?: string | null;
  results?: Result[];
  toneGroups?: ToneGroup[];
  truncated?: boolean;
  limit?: number | null;
  appBaseUrl: string;
  showPhoneticDifferences: boolean;
}) => {
  const { render, Box, Text } = await import("ink");
  const h = React.createElement;

  const formatInkAppEntryLinks = (items: { id: number; hanzi: string }[]) =>
    items
      .map((item) =>
        makeTerminalLink(
          getAppEntryUrl(payload.appBaseUrl, item.id),
          item.hanzi,
        ),
      )
      .join("、");

  const InkView = () => {
    const results = payload.results ?? [];
    const toneGroups = payload.toneGroups ?? [];
    const headerTerm = payload.term ? `: ${payload.term}` : "";

    const headerText = `Mode: ${payload.mode}${headerTerm}`;
    const headerUrl = getAppQueryUrl(payload.appBaseUrl, {
      mode: payload.mode,
      term: payload.term,
    });
    const header = h(Text, { bold: true }, linkOrText(headerUrl, headerText));
    const truncationNotice =
      payload.truncated && payload.limit
        ? h(
            Text,
            { color: "yellow" },
            `結果已截斷：目前僅顯示前 ${payload.limit} 筆。`,
          )
        : null;

    const toneGroupSection =
      toneGroups.length > 0
        ? h(
            Box,
            { flexDirection: "column", marginTop: 1 },
            toneGroups.map((g) =>
              h(
                Box,
                {
                  key: `${g.tone}-${g.syllable}`,
                  flexDirection: "column",
                  marginBottom: 1,
                },
                h(
                  Text,
                  null,
                  `調 ${g.tone} · ${g.syllable} (${g.entries.length})`,
                ),
              ),
            ),
          )
        : null;

    const resultsSection = h(
      Box,
      { flexDirection: "column", marginTop: 1 },
      results.length === 0
        ? h(Text, null, "(no results)")
        : results.map((r, idx) => {
            const appUrl = getAppEntryUrl(payload.appBaseUrl, r.id);
            const idLink = makeTerminalLink(appUrl, `#${r.id}`);

            const hanziIthuan = linkOrText(getSuiSiannUrl(r.hanzi), r.hanzi);
            const romanIthuan = linkOrText(
              getSuiSiannUrl(r.romanization),
              r.romanization,
            );

            const titleLine = h(
              Text,
              null,
              h(Text, { bold: true }, hanziIthuan),
              " ",
              h(Text, { dimColor: true }, romanIthuan),
              " ",
              h(Text, { dimColor: true }, "("),
              h(Text, { dimColor: true }, idLink),
              h(Text, { dimColor: true }, ")"),
            );

            const categoryLine = r.category?.trim()
              ? h(
                  Text,
                  { dimColor: true },
                  `分類: ${formatInkCategories(payload.appBaseUrl, r.category.trim())}`,
                )
              : null;

            const meaningsSection =
              r.meanings.length > 0
                ? h(
                    Box,
                    { flexDirection: "column", marginTop: 1 },
                    r.meanings.map((m) => {
                      const part = m.part_of_speech
                        ? `${m.part_of_speech} `
                        : "";
                      const explanation = m.explanation
                        .replace(/^:/, "")
                        .trim();

                      const examples = m.examples ?? [];

                      const meaningSynonyms =
                        r.meaning_synonyms?.get(m.id) ?? [];
                      const meaningSynonymsSection =
                        meaningSynonyms.length > 0
                          ? h(
                              Text,
                              { dimColor: true },
                              `近義：${formatInkAppEntryLinks(
                                meaningSynonyms.map((syn) => ({
                                  id: syn.entryId,
                                  hanzi: syn.hanzi,
                                })),
                              )}`,
                            )
                          : null;

                      const examplesSection =
                        examples.length > 0
                          ? h(
                              Box,
                              {
                                flexDirection: "column",
                                marginTop: 1,
                                marginLeft: 2,
                              },
                              h(Text, { dimColor: true }, "用例:"),
                              ...examples.flatMap((ex, exIdx) => {
                                const hanziLink = linkOrText(
                                  getSuiSiannUrl(ex.hanzi),
                                  ex.hanzi,
                                );
                                const romanLink = linkOrText(
                                  getSuiSiannUrl(ex.romanization),
                                  ex.romanization,
                                );
                                const lines = [
                                  h(Text, null, `  ${hanziLink}`),
                                  h(Text, { dimColor: true }, `  ${romanLink}`),
                                ];
                                if (exIdx < examples.length - 1) {
                                  lines.push(h(Text, null, " "));
                                }
                                return lines;
                              }),
                            )
                          : null;

                      return h(
                        Box,
                        {
                          key: m.id,
                          flexDirection: "column",
                          marginBottom: 1,
                        },
                        h(
                          Text,
                          null,
                          h(Text, { bold: true }, `${m.display_id}.`),
                          " ",
                          part,
                          explanation,
                        ),
                        meaningSynonymsSection,
                        examplesSection,
                      );
                    }),
                  )
                : h(Text, { dimColor: true }, "(無釋義)");

            const entrySynonymsSection =
              (r.entry_synonyms?.length ?? 0) > 0
                ? h(
                    Text,
                    { dimColor: true },
                    `近義詞: ${formatInkAppEntryLinks(
                      (r.entry_synonyms ?? []).map((syn) => ({
                        id: syn.id,
                        hanzi: syn.hanzi,
                      })),
                    )}`,
                  )
                : null;

            const phoneticDifferencesSection =
              payload.showPhoneticDifferences && r.phonetic_differences
                ? (() => {
                    const order: Record<string, number> = {
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

                    const labels: Record<string, string> = {
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

                    const entries = Object.entries(r.phonetic_differences)
                      .filter(([key, value]) => order[key] && value)
                      .sort(([a], [b]) => order[a] - order[b])
                      .map(([key, value]) => ({
                        label: labels[key],
                        value: String(value),
                      }));

                    if (entries.length === 0) return null;

                    const seenSounds = new Set<string>();

                    return h(
                      Box,
                      { flexDirection: "column", marginTop: 1 },
                      h(Text, { bold: true }, "語音差異"),
                      h(Text, { dimColor: true }, "腔  語音差異"),
                      ...entries.map((item) => {
                        const rendered = formatInkIthuanValue(
                          item.value,
                          seenSounds,
                        );
                        return h(
                          Text,
                          { key: item.label },
                          `${item.label}  ${rendered}`,
                        );
                      }),
                    );
                  })()
                : null;

            const separator =
              idx < results.length - 1
                ? h(Text, { dimColor: true }, "─".repeat(40))
                : null;

            return h(
              Box,
              { key: r.id, flexDirection: "column", marginBottom: 1 },
              titleLine,
              categoryLine,
              meaningsSection,
              entrySynonymsSection,
              phoneticDifferencesSection,
              separator,
            );
          }),
    );

    return h(
      Box,
      { flexDirection: "column" },
      header,
      truncationNotice,
      toneGroupSection,
      resultsSection,
    );
  };

  const instance = render(React.createElement(InkView));
  // ink 6 returns a stable instance with waitUntilExit
  const maybeWithWaitUntilExit = instance as {
    waitUntilExit?: () => void | Promise<void>;
  };
  await maybeWithWaitUntilExit.waitUntilExit?.();
};

const main = async () => {
  const helpFile = loadModeHelpFile();

  const cli = cac("hokkien-sutian-query");
  cli
    .option("-m, --mode <mode>", "Search mode (default: qs / multi_search)")
    .option("-t, --term <term>", "Search term (optional)")
    .option(
      "-l, --limit <n>",
      `Max number of matched entries to return (default: ${DEFAULT_RESULT_LIMIT})`,
    )
    .option("-d, --db <path>", `Database path (default: ${DEFAULT_DB_PATH})`)
    .option(
      "--base-url <url>",
      `App base URL for generated links (default: ${DEFAULT_APP_BASE_URL}; env: HOKKIEN_SUTIAN_BASE_URL)`,
    )
    .option("--local", `Use local app base URL (${LOCAL_APP_BASE_URL})`)
    .option("--download", "Allow downloading database if not found", {
      default: true,
    })
    .option("--no-download", "Don't download database; fail if not found")
    .option("--redownload", "Force re-download the database even if it exists")
    .option("--random", "Fetch a random entry")
    .option("-p, --pretty", "Pretty-print JSON output with indentation", {
      default: true,
    })
    .option("-i, --ink", "Render results with ink (non-interactive)")
    .option("--phonetic-differences", "Show 語音差異 in ink output", {
      default: true,
    })
    .option("--alfred", "Output Alfred Script Filter JSON")
    .option("--si <initial>", "Initial consonant (聲母) (phonetic mode)")
    .option("--sf <final>", "Final/rhyme (韻母) (phonetic mode)")
    .option("--st <tone>", "Tone number (調號) (phonetic mode)")
    .option("--sm <0|1>", "Single syllable only (default: 1), use 0 to disable")
    .option(
      "--fallback-auto-switch-query-mode",
      "Automatically switch to next query mode when current mode has no results",
      {
        default: true,
      },
    )
    .help();

  cli.help((sections) => {
    const extra = makeExamplesSection(helpFile);
    sections.push({
      title: "Notes",
      body:
        "- You can pass web-style mode codes like qs, q, me, hf, mf, rx, hft, cat, su.\n" +
        "- Mode defaults to qs (multi_search).\n" +
        `- Result limit defaults to ${DEFAULT_RESULT_LIMIT}; use --limit <n>, --no-limit, or -L.\n` +
        "- Fallback auto-switch is enabled by default; use --no-fallback-auto-switch-query-mode to disable.\n" +
        "- You can also use positional args: hokkien-sutian-query [mode] [term]." +
        extra,
    });
    return sections;
  });

  const argvWithAliases = process.argv.map((arg) =>
    arg === "-L" ? "--no-limit" : arg,
  );
  const parsed = cli.parse(argvWithAliases, { run: false });
  const options = parsed.options as Record<string, unknown>;
  const args = parsed.args as string[];

  if (options.help === true) {
    // Help has already been printed by cac.
    return;
  }

  const dbPath = (options.db as string | undefined) || DEFAULT_DB_PATH;
  const allowDownload = options.download !== false;
  const forceRedownload = options.redownload === true;
  const pretty = options.pretty !== false;
  const isInk = options.ink === true;
  const isAlfred = options.alfred === true;
  const isRandom = options.random === true;
  const showPhoneticDifferences = options.phoneticDifferences !== false;
  const fallbackAutoSwitchQueryMode =
    options.fallbackAutoSwitchQueryMode !== false;
  const noLimit = options.limit === false;
  const parsedLimit =
    options.limit !== undefined && options.limit !== false
      ? Number(options.limit as string)
      : DEFAULT_RESULT_LIMIT;
  const maxResults =
    noLimit || !Number.isFinite(parsedLimit) || parsedLimit <= 0
      ? undefined
      : Math.floor(parsedLimit);

  const appBaseUrl = resolveAppBaseUrl(options);

  if (isInk && isAlfred) {
    throw new Error("--ink and --alfred cannot be used together");
  }

  // Handle redownload-only mode
  if (forceRedownload) {
    console.error(`Re-downloading database to ${dbPath}...`);
    await ensureDbPath(dbPath, allowDownload, true);
    console.error("Download complete.");
    return;
  }

  const resolvedDbPath = await ensureDbPath(dbPath, allowDownload, false);

  const db = new Database(resolvedDbPath, { readonly: true });
  try {
    const adapter = new BunSqliteAdapter(db);

    const { modeToken, term, leftoverArgs, urlPhoneticArgs } = pickModeAndTerm(
      args,
      {
        mode: options.mode as string | undefined,
        term: options.term as string | undefined,
      },
    );
    if (leftoverArgs.length > 0) {
      console.error(`Ignoring extra args: ${leftoverArgs.join(" ")}`);
    }

    const resolvedMode = resolveModeToken(modeToken) ?? resolveModeToken("qs");
    if (!resolvedMode) {
      throw new Error(`Unsupported mode: ${modeToken}`);
    }

    const mode = resolvedMode;
    if (mode === "regex") {
      registerRegexp(adapter);
    }

    if (isRandom) {
      const result = fetchRandomEntry(adapter);
      if (isInk) {
        await renderInkResults({
          mode: "random",
          results: result ? [result] : [],
          truncated: false,
          limit: null,
          appBaseUrl,
          showPhoneticDifferences,
        });
        return;
      }
      if (isAlfred) {
        const output = resultsToAlfredOutput(
          result ? [result] : [],
          appBaseUrl,
        );
        console.log(JSON.stringify(output));
        return;
      }
      const indent = pretty ? 2 : 0;
      console.log(
        JSON.stringify({ mode: "random", result }, mapReplacer, indent),
      );
      return;
    }

    if (mode === "phonetic") {
      const initialFromUrl = urlPhoneticArgs?.si;
      const finalFromUrl = urlPhoneticArgs?.sf;
      const toneFromUrl = urlPhoneticArgs?.st;
      const smFromUrl = urlPhoneticArgs?.sm;

      const toneRaw =
        (options.st as string | undefined) ?? toneFromUrl ?? undefined;
      const query: PhoneticQuery = {
        initial: (options.si as string | undefined) ?? initialFromUrl ?? null,
        final: (options.sf as string | undefined) ?? finalFromUrl ?? null,
        tone: toneRaw ? parseInt(toneRaw, 10) : null,
        singleSyllableOnly:
          ((options.sm as string | undefined) ?? smFromUrl) !== "0",
      };

      const { results, toneGroups } = performPhoneticSearch(adapter, query);
      const payload = {
        mode,
        query,
        results,
        toneGroups,
        truncated: false,
        limit: null,
      };

      if (isInk) {
        await renderInkResults({
          mode,
          results,
          toneGroups,
          truncated: false,
          limit: null,
          appBaseUrl,
          showPhoneticDifferences,
        });
        return;
      }

      if (isAlfred) {
        const output = resultsToAlfredOutput(results, appBaseUrl);
        console.log(JSON.stringify(output));
        return;
      }

      const indent = pretty ? 2 : 0;
      console.log(JSON.stringify(payload, mapReplacer, indent));
      return;
    }

    const termValue = term ?? "";

    if (mode === "single_entry") {
      const entryId = parseInt(termValue, 10);
      const result = Number.isNaN(entryId)
        ? null
        : fetchEntryDetails(adapter, entryId);
      const results = result ? [result] : [];

      if (isInk) {
        await renderInkResults({
          mode,
          term: termValue,
          results,
          appBaseUrl,
          showPhoneticDifferences,
        });
        return;
      }
      if (isAlfred) {
        const output = resultsToAlfredOutput(results, appBaseUrl);
        console.log(JSON.stringify(output));
        return;
      }

      const payload = { mode, term: termValue, results };
      const indent = pretty ? 2 : 0;
      console.log(JSON.stringify(payload, mapReplacer, indent));
      return;
    }

    if (!isSearchMode(mode)) {
      throw new Error(`Unsupported mode: ${mode}`);
    }

    if (!isSearchMode(mode)) {
      throw new Error(`Unsupported mode: ${mode}`);
    }

    const modesToTry = fallbackAutoSwitchQueryMode
      ? getFallbackAutoSwitchModes(mode)
      : [mode];

    let effectiveMode = mode;
    let results: Result[] = [];
    let truncated = false;
    for (const candidateMode of modesToTry) {
      const candidateSearch = performSearchWithMeta(
        adapter,
        termValue,
        candidateMode,
        {
          maxResults,
        },
      );
      const candidateResults = candidateSearch.results;
      if (candidateResults.length > 0) {
        effectiveMode = candidateMode as typeof effectiveMode;
        results = candidateResults;
        truncated = candidateSearch.truncated;
        break;
      }
      if (candidateMode === mode) {
        results = candidateResults;
        truncated = candidateSearch.truncated;
      }
    }

    if (isInk) {
      await renderInkResults({
        mode: effectiveMode,
        term: termValue,
        results,
        truncated,
        limit: maxResults ?? null,
        appBaseUrl,
        showPhoneticDifferences,
      });
      return;
    }

    if (isAlfred) {
      const output = resultsToAlfredOutput(results, appBaseUrl);
      console.log(JSON.stringify(output));
      return;
    }

    const payload = {
      mode: effectiveMode,
      requestedMode: mode,
      term: termValue,
      results,
      truncated,
      limit: maxResults ?? null,
    };
    const indent = pretty ? 2 : 0;
    console.log(JSON.stringify(payload, mapReplacer, indent));
  } finally {
    // `bun:sqlite` keeps the process alive if the DB isn't closed.
    // That breaks pipes into pagers like `less` / `bat`.
    db.close();
  }
};

const mapReplacer = (_key: string, value: unknown) => {
  if (value instanceof Map) {
    return Object.fromEntries(value);
  }
  return value;
};

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
