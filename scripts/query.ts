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
  performSearch,
  registerRegexp,
} from "../src/hokkien/engine";
import type { SearchMode } from "../src/hokkien/engine";
import type { PhoneticQuery } from "../src/hokkien/types";
import type { Result, ToneGroup } from "../src/hokkien/types";

import {
  QUERY_PARAM_TO_MODE,
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
): { modeToken: string; term: string | null; leftoverArgs: string[] } => {
  const [a0, a1, ...rest] = argv;

  const explicitMode = options.mode?.toString();
  const explicitTerm = options.term?.toString();

  if (explicitMode) {
    const term = explicitTerm ?? a0 ?? null;
    return { modeToken: explicitMode, term, leftoverArgs: rest };
  }

  if (a0) {
    const resolved = resolveModeToken(a0);
    if (resolved) {
      const term = explicitTerm ?? a1 ?? null;
      return { modeToken: a0, term, leftoverArgs: rest };
    }
  }

  const term = explicitTerm ?? a0 ?? null;
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

const resultToAlfredItem = (result: Result): AlfredScriptFilterItem => {
  const title = `${result.hanzi} ${result.romanization}`.trim();
  const meaningText = result.meanings
    .map((m) => {
      const part = m.part_of_speech ? `${m.part_of_speech} ` : "";
      return `${part}${m.explanation.replace(/^:/, "").trim()}`.trim();
    })
    .filter(Boolean)
    .slice(0, 3)
    .join("；");

  const subtitle = meaningText
    ? trimForSingleLine(meaningText, 160)
    : undefined;

  const appUrl = getAppEntryUrl(DEFAULT_APP_BASE_URL, result.id);
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
): AlfredScriptFilterOutput => ({
  items: results.map(resultToAlfredItem),
});

const renderInkResults = async (payload: {
  mode: string;
  term?: string | null;
  results?: Result[];
  toneGroups?: ToneGroup[];
}) => {
  const { render, Box, Text } = await import("ink");
  const h = React.createElement;

  const InkView = () => {
    const results = payload.results ?? [];
    const toneGroups = payload.toneGroups ?? [];
    const headerTerm = payload.term ? `: ${payload.term}` : "";

    const header = h(
      Text,
      { bold: true },
      `Mode: ${payload.mode}${headerTerm}`,
    );

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
        : results.map((r) => {
            const meaningText = r.meanings
              .map((m) => m.explanation.replace(/^:/, "").trim())
              .filter(Boolean)
              .slice(0, 2)
              .join("；");
            const subtitle = meaningText
              ? trimForSingleLine(meaningText, 120)
              : "";

            const titleLine = h(
              Text,
              null,
              h(Text, { bold: true }, r.hanzi),
              " ",
              h(Text, { dimColor: true }, r.romanization),
              " ",
              h(Text, { dimColor: true }, `(#${r.id})`),
            );

            return h(
              Box,
              { key: r.id, flexDirection: "column", marginBottom: 1 },
              titleLine,
              subtitle ? h(Text, { dimColor: true }, subtitle) : null,
            );
          }),
    );

    return h(
      Box,
      { flexDirection: "column" },
      header,
      toneGroupSection,
      resultsSection,
    );
  };

  const instance = render(React.createElement(InkView));
  // ink 6 returns a stable instance with waitUntilExit
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  await (instance as any).waitUntilExit?.();
};

const main = async () => {
  const helpFile = loadModeHelpFile();

  const cli = cac("hokkien-sutian-query");
  cli
    .option("-m, --mode <mode>", "Search mode (default: qs / multi_search)")
    .option("-t, --term <term>", "Search term (optional)")
    .option("-d, --db <path>", `Database path (default: ${DEFAULT_DB_PATH})`)
    .option("--download", "Allow downloading database if not found", {
      default: true,
    })
    .option("--no-download", "Don't download database; fail if not found")
    .option("--redownload", "Force re-download the database even if it exists")
    .option("--random", "Fetch a random entry")
    .option("-p, --pretty", "Pretty-print JSON output with indentation")
    .option("-i, --ink", "Render results with ink (non-interactive)")
    .option("--alfred", "Output Alfred Script Filter JSON")
    .option("--si <initial>", "Initial consonant (聲母) (phonetic mode)")
    .option("--sf <final>", "Final/rhyme (韻母) (phonetic mode)")
    .option("--st <tone>", "Tone number (調號) (phonetic mode)")
    .option("--sm <0|1>", "Single syllable only (default: 1), use 0 to disable")
    .help();

  cli.help((sections) => {
    const extra = makeExamplesSection(helpFile);
    sections.push({
      title: "Notes",
      body:
        "- You can pass web-style mode codes like qs, q, me, hf, mf, rx, hft, cat, su.\n" +
        "- Mode defaults to qs (multi_search).\n" +
        "- You can also use positional args: hokkien-sutian-query [mode] [term]." +
        extra,
    });
    return sections;
  });

  const parsed = cli.parse(process.argv, { run: false });
  const options = parsed.options as Record<string, unknown>;
  const args = parsed.args as string[];

  const dbPath = (options.db as string | undefined) || DEFAULT_DB_PATH;
  const allowDownload = options.download !== false;
  const forceRedownload = options.redownload === true;
  const pretty = options.pretty === true;
  const isInk = options.ink === true;
  const isAlfred = options.alfred === true;
  const isRandom = options.random === true;

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
  const adapter = new BunSqliteAdapter(db);

  const { modeToken, term, leftoverArgs } = pickModeAndTerm(args, {
    mode: options.mode as string | undefined,
    term: options.term as string | undefined,
  });
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
      });
      return;
    }
    if (isAlfred) {
      const output = resultsToAlfredOutput(result ? [result] : []);
      console.log(JSON.stringify(output));
      return;
    }
    console.log(JSON.stringify({ mode: "random", result }, mapReplacer, 2));
    return;
  }

  if (mode === "phonetic") {
    const query: PhoneticQuery = {
      initial: (options.si as string | undefined) || null,
      final: (options.sf as string | undefined) || null,
      tone: options.st ? parseInt(options.st as string, 10) : null,
      singleSyllableOnly: (options.sm as string | undefined) !== "0",
    };

    const { results, toneGroups } = performPhoneticSearch(adapter, query);
    const payload = {
      mode,
      query,
      results,
      toneGroups,
    };

    if (isInk) {
      await renderInkResults({
        mode,
        results,
        toneGroups,
      });
      return;
    }

    if (isAlfred) {
      const output = resultsToAlfredOutput(results);
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
      await renderInkResults({ mode, term: termValue, results });
      return;
    }
    if (isAlfred) {
      const output = resultsToAlfredOutput(results);
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

  const results = performSearch(adapter, termValue, mode);

  if (isInk) {
    await renderInkResults({ mode, term: termValue, results });
    return;
  }

  if (isAlfred) {
    const output = resultsToAlfredOutput(results);
    console.log(JSON.stringify(output));
    return;
  }

  const payload = { mode, term: termValue, results };
  const indent = pretty ? 2 : 0;
  console.log(JSON.stringify(payload, mapReplacer, indent));
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
