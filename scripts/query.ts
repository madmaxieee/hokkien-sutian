import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
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

const DEFAULT_DB_PATH = "public/assets/data/kautian.db";
const DEFAULT_SOURCE_URL = "https://sutian.teddysc.me/assets/data/kautian.db";

const printUsage = () => {
  console.log(`Usage:
  bun run scripts/query.ts -m <mode> -t <term> [--db <path>] [--download]

Modes:
  hokkien_entry | mandarin_example | hokkien_example | mandarin_fulltext
  regex | hokkien_fulltext | category | multi_search | single_entry | phonetic

Phonetic options:
  --si <initial> --sf <final> --st <tone> --sm 0

Examples:
  bun run scripts/query.ts -m hokkien_entry -t "li-ho"
  bun run scripts/query.ts -m phonetic --si k --sf a --st 1
  bun run scripts/query.ts -m multi_search -t "an-tsuann"
  bun run scripts/query.ts --random
`);
};

const ensureDbPath = async (dbPath: string, allowDownload: boolean) => {
  if (existsSync(dbPath)) return dbPath;
  if (!allowDownload) {
    throw new Error(
      `Database not found at ${dbPath}. Use --download to fetch.`,
    );
  }

  await mkdir(dirname(dbPath), { recursive: true });
  const response = await fetch(DEFAULT_SOURCE_URL);
  if (!response.ok) {
    throw new Error(
      `Download failed: ${response.status} ${response.statusText}`,
    );
  }

  await Bun.write(dbPath, await response.arrayBuffer());
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
  const resolvedDbPath = await ensureDbPath(dbPath, allowDownload);

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
