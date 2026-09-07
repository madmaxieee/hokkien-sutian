# hokkien-sutian (閩南語辭典)

https://sutian.teddysc.me/

A fast, client-side Hokkien dictionary that runs entirely in the browser.

It loads an SQLite database (via `sql.js` / WASM) and provides multiple search modes, including a MOE-style phonetic picker (聲韻調：聲母/韻母/聲調) with deep links.

Data is derived from 教育部《臺灣閩南語常用詞辭典》 (https://sutian.moe.edu.tw/).

Data preparation scripts: https://tddschn/moe-hokkien-sutian-data .


## Features

- Search entries by Hanji (漢字, in the db / spec, "hanzi" is also used, we're choosing not to change it to the correct form as they're not user facing) or romanization (台羅)
- Search examples by Mandarin or Hokkien
- Full-text search (Mandarin / Hokkien)
- Regex search against entry Hanji (custom SQLite `REGEXP` function)
- Category browse
- Sentence segmentation (“逐詞查詢”) for looking up embedded words
- Phonetic picker (initial/final/tone) with live filtering + match counts
- Permalinks to a single entry (`?su=...`) and links back to MOE
- Audio play/download via MOE media URLs

## 4 User interfaces

- 1. Web app - https://sutian.teddysc.me/
- 2. CLI
  - hokkien-sutian-query (see `bin` in [package.json](package.json)), a `bun` script that fully replicates the web app's features for your terminal.
  - hokkien_sutian_pak_penn_to_hokkien_translation_prompt_builder.py ([package.json](package.json)) - it extract relevant entries and examples from the SQLite database and generates a (long) prompt for LLMs to translate a given 北平方言 sentence(s) into Hokkien. LLM usually does a okay job. I do not recommend using China developed LLMs (like Kimi) for this purpose, they'll fuck up your translation or refuse to generate output. Just use latest long context Gemini flash or pro on AI Studio, these models seem to have some pretraining done in Hokkien.
- 3. Alfred workflow - script filter


<img width="805" height="640" alt="Image" src="https://github.com/user-attachments/assets/d80c96f2-c61c-4f64-9769-a877b131b487" />

```bash
# below is my script filter's code, you need to modify it to your system's setup
query=$1

#echo -n $query


PATH=~/config/scripts:$PATH

query="$(zh_hant_hans_conveter_objc.py cn-to-tw "${query}")"

PATH=~/.bun/bin/:$PATH ~/.bun/bin/hokkien-sutian-query "${query}" --alfred
```

The web app accepts URL query params, you can easily use them in alfred too (you can use the sutian.teddysc.me public instance instead of the localhost one).

<img width="632" height="392" alt="Image" src="https://github.com/user-attachments/assets/4bbd9b13-c2c9-445b-bfcb-4c61c683e36c" />

- 4. Apple Dictionary 
  - You can use the `generate_apple_dict.py` script to generate a Apple Dictionary bundle from the SQLite database. It will create a `.dictionary` bundle that you can install on macOS. The script requires the Dictionary Development Kit from Apple, which is included in Xcode's additional tools.

Searching for "連" in the Apple Dictionary app (`multi_search` mode is not possible in rigid Apple Dictionary app, it cannot be use look up a whole Hokkien sentence):

<img width="1459" height="1161" alt="Image" src="https://github.com/user-attachments/assets/3c2c7b4e-5375-42a3-8481-67fe79958b0d" />

Force touch Look Up:

<img width="408" height="456" alt="Image" src="https://github.com/user-attachments/assets/fd9780f0-3aa3-4996-b853-3e03a13a0161" />


## Build

```bash
npm run build
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
| `q`, `he` | `hokkien_entry`     | Search entries by Hokkien (Hanji or romanization)  |
| `me`      | `mandarin_example`  | Search examples by Mandarin translation            |
| `hf`      | `hokkien_example`   | Search examples by Hokkien (Hanji or romanization) |
| `mf`      | `mandarin_fulltext` | Full-text search in Mandarin across fields         |
| `rx`      | `regex`             | Regex search on entry Hanji                        |
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

## Limitations


- Note that the assets in GitHub releases or the one the website uses are NOT the latest MOE data, since their data re org makes it difficult to keep up with the upstream changes. For the latest data, see the MOE site or the data preparation repo.
- Heavy locale bias due to data source - search by sound only works if you type in 台灣優勢腔 tailo.

## License

Code: MIT, see [LICENSE](LICENSE).

Dictionary data and MOE content may have separate terms; verify upstream licensing/usage constraints on https://sutian.moe.edu.tw/.
