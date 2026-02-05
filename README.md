# hokkien-sutian (閩南語辭典)

A fast, client-side Taiwanese Hokkien dictionary that runs entirely in the browser.

It loads an SQLite database (via `sql.js` / WASM) and provides multiple search modes, including a MOE-style phonetic picker (聲韻調：聲母/韻母/聲調) with deep links.

Data is derived from 教育部《臺灣閩南語常用詞辭典》 (https://sutian.moe.edu.tw/).

Data preparation scripts: https://tddschn/moe-hokkien-sutian-data .

## Features

- Search entries by hanzi or romanization
- Search examples by Mandarin or Hokkien
- Full-text search (Mandarin / Hokkien)
- Regex search against entry hanzi (custom SQLite `REGEXP` function)
- Category browse
- Sentence segmentation (“逐詞查詢”) for looking up embedded words
- Phonetic picker (initial/final/tone) with live filtering + match counts
- Permalinks to a single entry (`?su=...`) and links back to MOE
- Audio play/download via MOE media URLs

## Quickstart

```bash
npm install
npm run dev
```

Then open `http://localhost:5173`.

## Build

```bash
npm run build
npm run preview
```

Notes:

- The build uses `vite-plugin-singlefile` to emit a single HTML file for easy static hosting.
- `sql.js` needs `sql-wasm.wasm` at runtime; it’s copied into `dist/` via `vite-plugin-static-copy`.

## Data

- Database file: `public/assets/data/kautian.db`
- Schema/stats: see [data.md](data.md)

At runtime the app fetches the DB from `/assets/data/kautian.db` and queries it in-memory.

## URL Deep Links

Most searches are shareable/bookmarkable via query parameters.

| Parameter | Mode                | Meaning                                            |
| --------- | ------------------- | -------------------------------------------------- |
| `q`, `he` | `hokkien_entry`     | Search entries by Hokkien (hanzi or romanization)  |
| `me`      | `mandarin_example`  | Search examples by Mandarin translation            |
| `hf`      | `hokkien_example`   | Search examples by Hokkien (hanzi or romanization) |
| `mf`      | `mandarin_fulltext` | Full-text search in Mandarin across fields         |
| `rx`      | `regex`             | Regex search on entry hanzi                        |
| `hft`     | `hokkien_fulltext`  | Full-text search in Hokkien (entries + examples)   |
| `cat`     | `category`          | Browse/filter by category                          |
| `qs`      | `multi_search`      | Sentence segmentation search                       |
| `su`      | `single_entry`      | Direct entry lookup by ID                          |
| `si`      | `phonetic`          | Phonetic search: initial consonant (聲母)          |
| `sf`      | `phonetic`          | Phonetic search: final/rhyme (韻母)                |
| `st`      | `phonetic`          | Phonetic search: tone (聲調)                       |

Examples:

- `?q=你好`
- `?mf=運動`
- `?su=1234`
- `?si=k&sf=a&st=1`

Phonetic search also supports `sm=0` to include multi-syllable entries.

For full details, see [spec.md](spec.md).

## Project Structure

- Main component: [src/hokkien/HokkienDictionary.tsx](src/hokkien/HokkienDictionary.tsx)
- Compatibility entrypoint: [src/artifact-component.tsx](src/artifact-component.tsx) (thin re-export)
- Shared types/helpers: `src/hokkien/types.ts`, `src/hokkien/phonetics.ts`
- UI pieces: `src/hokkien/components/*`, `src/hokkien/modals/*`

## Docs

- [spec.md](spec.md) — search modes + URL parameters
- [data.md](data.md) — DB schema + table counts
- [query-by-sound.md](query-by-sound.md) — design notes on phonetic (聲韻調) query
- [docs/moe-sutian/siannuntiau.md](docs/moe-sutian/siannuntiau.md) — MOE “聲韻調索引” URL patterns

## License

Code: MIT, see [LICENSE](LICENSE).

Dictionary data and MOE content may have separate terms; verify upstream licensing/usage constraints on https://sutian.moe.edu.tw/.
