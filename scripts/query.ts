import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

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

const parseArgs = (argv: string[]) => {
  const options: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    if (arg === "--pretty") {
      options.pretty = true;
      continue;
    }
    if (arg === "--download") {
      options.download = true;
      continue;
    }
    if (arg === "--no-download") {
      options.download = false;
      continue;
    }
    if (arg === "--random") {
      options.random = true;
      continue;
    }

    if (arg.startsWith("--")) {
      const [key, value] = arg.slice(2).split("=");
      if (value !== undefined) {
        options[key] = value;
      } else {
        options[key] = argv[i + 1];
        i += 1;
      }
      continue;
    }

    if (arg === "-m") {
      options.mode = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "-t") {
      options.term = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "-d") {
      options.db = argv[i + 1];
      i += 1;
      continue;
    }
  }

  return options;
};

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
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  const dbPath = (options.db as string) || DEFAULT_DB_PATH;
  const allowDownload = options.download !== false;
  const resolvedDbPath = await ensureDbPath(dbPath, allowDownload);

  const db = new Database(resolvedDbPath, { readonly: true });
  const adapter = new BunSqliteAdapter(db);
  registerRegexp(adapter);

  if (options.random) {
    const result = fetchRandomEntry(adapter);
    console.log(JSON.stringify({ mode: "random", result }, mapReplacer, 2));
    return;
  }

  const mode = (options.mode as string) || "hokkien_entry";
  if (mode === "phonetic") {
    const query: PhoneticQuery = {
      initial: (options.si as string) || null,
      final: (options.sf as string) || null,
      tone: options.st ? parseInt(options.st as string, 10) : null,
      singleSyllableOnly: options.sm !== "0",
    };

    const { results, toneGroups } = performPhoneticSearch(adapter, query);
    const payload = {
      mode,
      query,
      results,
      toneGroups,
    };
    const pretty = options.pretty ? 2 : 0;
    console.log(JSON.stringify(payload, mapReplacer, pretty));
    return;
  }

  const term = options.term as string | undefined;
  if (!term) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  if (mode === "single_entry") {
    const result = fetchEntryDetails(adapter, parseInt(term, 10));
    const payload = { mode, term, results: result ? [result] : [] };
    const pretty = options.pretty ? 2 : 0;
    console.log(JSON.stringify(payload, mapReplacer, pretty));
    return;
  }

  if (!isSearchMode(mode)) {
    throw new Error(`Unsupported mode: ${mode}`);
  }

  const results = performSearch(adapter, term, mode);
  const payload = { mode, term, results };
  const pretty = options.pretty ? 2 : 0;
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
