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

### 1. Web app 

- https://sutian.teddysc.me/
- https://sutian.teddysc.me/?q=%E7%89%A9%E4%BB%B6
- https://sutian.teddysc.me/?qs=%E4%BD%A0%E6%AC%B2%E5%8E%BB%E4%BD%97%E8%90%BD%E4%BB%94
- https://sutian.teddysc.me/?su=9222

<img width="1508" height="1047" alt="Image" src="https://github.com/user-attachments/assets/0c4646a5-efc2-403a-a724-c395c1ed3daf" />

<img width="1513" height="1045" alt="Image" src="https://github.com/user-attachments/assets/629593c2-c012-41c8-a1bb-98835bd98a31" />

<img width="912" height="1041" alt="Image" src="https://github.com/user-attachments/assets/328a794d-ebb3-4fcc-b2ea-b41bff2b1a59" />

### 2. CLI

<details>
  <summary>Usage</summary>
  
```
hokkien-sutian-query

Usage:
  $ hokkien-sutian-query <command> [options]

Options:
  -m, --mode <mode>                  Search mode (default: qs / multi_search) 
  -t, --term <term>                  Search term (optional) 
  -l, --limit <n>                    Max number of matched entries to return (default: 200) 
  -d, --db <path>                    Database path (default: /Users/tsca/.cache/hokkien-sutian/kautian.db) 
  --base-url <url>                   App base URL for generated links (default: https://sutian.teddysc.me; env: HOKKIEN_SUTIAN_BASE_URL) 
  --local                            Use local app base URL (http://hokkien-sutian.localhost:10390/) 
  --download                         Allow downloading database if not found (default: true)
  --no-download                      Don't download database; fail if not found (default: true)
  --redownload                       Force re-download the database even if it exists 
  --random                           Fetch a random entry 
  -p, --pretty                       Pretty-print JSON output with indentation (default: true)
  -i, --ink                          Render results with ink (non-interactive) 
  --phonetic-differences             Show 語音差異 in ink output (default: true)
  --alfred                           Output Alfred Script Filter JSON 
  --si <initial>                     Initial consonant (聲母) (phonetic mode) 
  --sf <final>                       Final/rhyme (韻母) (phonetic mode) 
  --st <tone>                        Tone number (調號) (phonetic mode) 
  --sm <0|1>                         Single syllable only (default: 1), use 0 to disable 
  --fallback-auto-switch-query-mode  Automatically switch to next query mode when current mode has no results (default: true)
  -h, --help                         Display this message 
  -h, --help                         Display this message 

Notes:
- You can pass web-style mode codes like qs, q, me, hf, mf, rx, hft, cat, su.
- Mode defaults to qs (multi_search).
- Result limit defaults to 200; use --limit <n>, --no-limit, or -L.
- Fallback auto-switch is enabled by default; use --no-fallback-auto-switch-query-mode to disable.
- You can also use positional args: hokkien-sutian-query [mode] [term].
Modes:
  hokkien_entry    用閩南語查詞目
  mandarin_example 用北平方言查用例
  hokkien_example  用閩南語查用例
  mandarin_fulltext 用北平方言查全文
  hokkien_fulltext 全文(閩南語)
  regex            正規表示式(詞目)
  multi_search     逐詞查詢
  category         依分類瀏覽
  single_entry     單一詞目
  phonetic         聲韻調查詢

Examples:
  hokkien-sutian-query -m hokkien_entry -t "物件"
  hokkien-sutian-query -m hokkien_entry -t "袂"
  hokkien-sutian-query -m hokkien_entry -t "嚨喉"
  hokkien-sutian-query -m hokkien_entry -t "尻川"
  hokkien-sutian-query -m hokkien_entry -t "按怎"
  # 注意：結果可能很多，查詢可能較慢。
  hokkien-sutian-query -m hokkien_entry -t "食"
  # 注意：結果可能很多，查詢可能較慢。
  hokkien-sutian-query -m hokkien_entry -t "tsia̍h"
  # 注意：結果可能很多，查詢可能較慢。
  hokkien-sutian-query -m hokkien_entry -t "【白】"
  hokkien-sutian-query -m mandarin_example -t "運動"
  hokkien-sutian-query -m mandarin_example -t "生氣"
  hokkien-sutian-query -m mandarin_example -t "一起"
  hokkien-sutian-query -m hokkien_example -t "食"
  hokkien-sutian-query -m hokkien_example -t "tsia̍h"
  hokkien-sutian-query -m hokkien_example -t "beh"
  hokkien-sutian-query -m mandarin_fulltext -t "感謝"
  hokkien-sutian-query -m mandarin_fulltext -t "稱讚"
  hokkien-sutian-query -m mandarin_fulltext -t "害怕"
  hokkien-sutian-query -m hokkien_fulltext -t "龍溪"
  hokkien-sutian-query -m hokkien_fulltext -t "食"
  hokkien-sutian-query -m hokkien_fulltext -t "tsia̍h"
  hokkien-sutian-query -m hokkien_fulltext -t "lí"
  hokkien-sutian-query -m regex -t "^【白】"
  hokkien-sutian-query -m regex -t "食.*"
  hokkien-sutian-query -m regex -t "^.*飯$"
  hokkien-sutian-query -m multi_search -t "龍溪"
  hokkien-sutian-query -m multi_search -t "銅山"
  # 源：傷心地獄芳花引魂 https://www.youtube.com/watch?v=5vyT2qDmFhE
  hokkien-sutian-query -m multi_search -t "嚨喉出力講袂出聲"
  # 源：一身是膽趙子龍 https://www.youtube.com/watch?v=8KRKyU3rce0
  hokkien-sutian-query -m multi_search -t "千秋萬世永其昌"
  # 源：暮沉武德殿 https://www.youtube.com/watch?v=W_kFoBWkOAk
  hokkien-sutian-query -m multi_search -t "砲火 銃聲 獨裁者 邪氣 屍臭 魔神仔"
  hokkien-sutian-query -m multi_search -t "我欲來去食肉骨茶"
  hokkien-sutian-query -m multi_search -t "伊會曉講"
  hokkien-sutian-query -m multi_search -t "你欲去佗落仔"
```

<!-- Two important rules:

Make sure you have an empty line after the closing </summary> tag, otherwise the markdown/code blocks won't show correctly.
Make sure you have an empty line after the closing </details> tag if you have multiple collapsible sections. -->
</details>

  - hokkien-sutian-query (see `bin` in [package.json](package.json)), a `bun` script that fully replicates the web app's features for your terminal.
  - hokkien_sutian_pak_penn_to_hokkien_translation_prompt_builder.py ([package.json](package.json)) - it extract relevant entries and examples from the SQLite database and generates a (long) prompt for LLMs to translate a given 北平方言 sentence(s) into Hokkien. LLM usually does a okay job. I do not recommend using China developed LLMs (like Kimi) for this purpose, they'll fuck up your translation or refuse to generate output. Just use latest long context Gemini flash or pro on AI Studio, these models seem to have some pretraining done in Hokkien.

### 3. Alfred workflow - script filter

<img width="764" height="540" alt="Image" src="https://github.com/user-attachments/assets/a0105b6f-0e6a-48b3-b1b6-7cea8bb9525b" />

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

### 4. Apple Dictionary 
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
