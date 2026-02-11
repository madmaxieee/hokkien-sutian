import type { SearchMode } from "./engine";

export const QUERY_PARAM_TO_MODE = {
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
} as const satisfies Record<string, SearchMode>;

export type QueryParamModeKey = keyof typeof QUERY_PARAM_TO_MODE;

export const MODE_TO_QUERY_PARAM = {
  hokkien_entry: "q",
  mandarin_example: "me",
  hokkien_example: "hf",
  mandarin_fulltext: "mf",
  regex: "rx",
  hokkien_fulltext: "hft",
  category: "cat",
  multi_search: "qs",
  single_entry: "su",
} as const satisfies Record<SearchMode, string>;

export const isQueryParamModeKey = (
  value: string,
): value is QueryParamModeKey => value in QUERY_PARAM_TO_MODE;

export const resolveModeFromQueryParamKey = (key: string): SearchMode | null =>
  isQueryParamModeKey(key) ? QUERY_PARAM_TO_MODE[key] : null;
