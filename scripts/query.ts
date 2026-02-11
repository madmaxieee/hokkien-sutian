#!/usr/bin/env bun
import { existsSync, readFileSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { dirname } from "node:path";
import { parseArgs } from "node:util";

import { Database } from "bun:sqlite";

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

const DEFAULT_CACHE_DIR = `${process.env.HOME}/.cache/hokkien-sutian`;
const DEFAULT_DB_PATH = `${DEFAULT_CACHE_DIR}/kautian.db`;
const DEFAULT_SOURCE_URL = "https://sutian.teddysc.me/assets/data/kautian.db";

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
    const fileUrl = new URL("../mode-help.json", import.meta.url);
    const text = readFileSync(fileUrl, "utf8");
    return JSON.parse(text) as ModeHelpFile;
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

const printUsage = (helpFile: ModeHelpFile | null) => {
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

  console.log(`hokkien-sutian-query - Query the 閩南語詞典 database

CLI: hokkien-sutian-query
Web: https://sutian.teddysc.me

Usage:
  hokkien-sutian-query -m <mode> -t <term> [options]
  hokkien-sutian-query --random
  hokkien-sutian-query --redownload

Database:
  Default database path: ~/.cache/hokkien-sutian/kautian.db
  The database is automatically downloaded on first run if not present.

Modes:
${modeLines}

Options:
  -m, --mode <mode>      Search mode (default: hokkien_entry)
  -t, --term <term>      Search term (required for most modes)
  -d, --db <path>        Database path (default: ~/.cache/hokkien-sutian/kautian.db)
  --download             Allow downloading database if not found (default: true)
  --no-download          Don't download database, fail if not found
  --redownload           Force re-download the database even if it exists
  --pretty               Pretty-print JSON output with indentation
  --random               Fetch a random entry
  -h, --help             Show this help message

Phonetic search options (for mode: phonetic):
  --si <initial>         Initial consonant (聲母)
  --sf <final>           Final/rhyme (韻母)
  --st <tone>            Tone number (調號)
  --sm <0|1>             Single syllable only (default: 1), use 0 to disable

Examples:
${exampleLines.length > 0 ? exampleLines.join("\n") : "  (no examples configured)"}

Other:
  hokkien-sutian-query --random
  hokkien-sutian-query --redownload
`);
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

const main = async () => {
  const helpFile = loadModeHelpFile();
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      help: { type: "boolean", short: "h" },
      mode: { type: "string", short: "m", default: "hokkien_entry" },
      term: { type: "string", short: "t" },
      db: { type: "string", short: "d" },
      pretty: { type: "boolean" },
      random: { type: "boolean" },
      download: { type: "boolean", default: true },
      redownload: { type: "boolean" },
      si: { type: "string" },
      sf: { type: "string" },
      st: { type: "string" },
      sm: { type: "string" },
    },
    strict: true,
    allowPositionals: true,
  });

  if (values.help) {
    printUsage(helpFile);
    return;
  }

  const dbPath = values.db || DEFAULT_DB_PATH;
  const allowDownload = values.download !== false;
  const forceRedownload = values.redownload === true;

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

  const mode = values.mode || "hokkien_entry";
  if (mode === "regex") {
    registerRegexp(adapter);
  }

  if (values.random) {
    const result = fetchRandomEntry(adapter);
    console.log(JSON.stringify({ mode: "random", result }, mapReplacer, 2));
    return;
  }

  if (mode === "phonetic") {
    const query: PhoneticQuery = {
      initial: values.si || null,
      final: values.sf || null,
      tone: values.st ? parseInt(values.st, 10) : null,
      singleSyllableOnly: values.sm !== "0",
    };

    const { results, toneGroups } = performPhoneticSearch(adapter, query);
    const payload = {
      mode,
      query,
      results,
      toneGroups,
    };
    const pretty = values.pretty ? 2 : 0;
    console.log(JSON.stringify(payload, mapReplacer, pretty));
    return;
  }

  const term = values.term;
  if (!term) {
    printUsage(helpFile);
    process.exitCode = 1;
    return;
  }

  if (mode === "single_entry") {
    const result = fetchEntryDetails(adapter, parseInt(term, 10));
    const payload = { mode, term, results: result ? [result] : [] };
    const pretty = values.pretty ? 2 : 0;
    console.log(JSON.stringify(payload, mapReplacer, pretty));
    return;
  }

  if (!isSearchMode(mode)) {
    throw new Error(`Unsupported mode: ${mode}`);
  }

  const results = performSearch(adapter, term, mode);
  const payload = { mode, term, results };
  const pretty = values.pretty ? 2 : 0;
  console.log(JSON.stringify(payload, mapReplacer, pretty));
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
