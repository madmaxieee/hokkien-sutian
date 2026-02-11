#!/usr/bin/env bun
import { existsSync } from "node:fs";
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

const printUsage = () => {
  console.log(`hokkien-sutian-query - Query the 臺灣閩南語常用詞典 database

Usage:
  hokkien-sutian-query -m <mode> -t <term> [options]
  hokkien-sutian-query --random
  hokkien-sutian-query --redownload

Database:
  Default database path: ~/.cache/hokkien-sutian/kautian.db
  The database is automatically downloaded on first run if not present.

Modes:
  hokkien_entry      Search Hokkien entries
  mandarin_example   Search Mandarin example sentences
  hokkien_example    Search Hokkien example sentences
  mandarin_fulltext  Full-text search in Mandarin
  hokkien_fulltext   Full-text search in Hokkien
  regex              Search using regular expressions
  category           Search by category
  multi_search       Multi-field search
  single_entry       Get single entry by ID
  phonetic           Search by phonetic components

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
  hokkien-sutian-query -m hokkien_entry -t "an-tsuann"
  hokkien-sutian-query -m hokkien_entry -t "li-ho" --pretty
  hokkien-sutian-query -m phonetic --si k --sf a --st 1
  hokkien-sutian-query -m single_entry -t 12345
  hokkien-sutian-query --random --pretty
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
    printUsage();
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
    printUsage();
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
