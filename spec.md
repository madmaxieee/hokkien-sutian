# Query Features Specification

Documentation of search/query features implemented in the hokkien dictionary web app.

Use bun exclusively for everything, never use npm! 

Use `build` package script exclusively, never use `dev`!! never serve! it's already served by the user on localhost:10390, you can visit it with playwright mcp if you have access to that.

`./functions` hosts cloudflare pages functions scripts.

## URL Query Parameters

The app supports deep linking via URL query parameters:

| Parameter | Mode                | Description                                             |
| --------- | ------------------- | ------------------------------------------------------- |
| `q`, `he` | `hokkien_entry`     | Search entries by Hokkien (hanzi or romanization)       |
| `me`      | `mandarin_example`  | Search examples by Mandarin translation                 |
| `hf`      | `hokkien_example`   | Search examples by Hokkien (hanzi or romanization)      |
| `mf`      | `mandarin_fulltext` | Full-text search in Mandarin across all fields          |
| `rx`      | `regex`             | Regex search on entry hanzi                             |
| `hft`     | `hokkien_fulltext`  | Full-text search in Hokkien across entries and examples |
| `cat`     | `category`          | Browse by category                                      |
| `qs`      | `multi_search`      | Sentence segmentation search                            |
| `su`      | `single_entry`      | Direct entry lookup by ID                               |
| `si`      | `phonetic`          | Phonetic search by initial consonant (聲母)             |
| `sf`      | `phonetic`          | Phonetic search by final/rhyme (韻母)                   |
| `st`      | `phonetic`          | Phonetic search by tone (聲調)                          |

## Search Modes

### 1. Hokkien Entry Search (`hokkien_entry`)
**UI Label:** 用閩南語查詞目

```sql
SELECT id FROM entries WHERE hanzi LIKE $term OR romanization LIKE $term
```

Searches the `entries` table matching hanzi or romanization with LIKE wildcards.

### 2. Mandarin Example Search (`mandarin_example`)
**UI Label:** 用北平方言查用例

```sql
SELECT DISTINCT entry_id FROM examples WHERE mandarin_translation LIKE $term
```

Finds entries that have examples matching the Mandarin search term.

### 3. Hokkien Example Search (`hokkien_example`)
**UI Label:** 用閩南語查用例

```sql
SELECT DISTINCT entry_id FROM examples WHERE hanzi LIKE $term OR romanization LIKE $term
```

Searches example sentences by Hokkien text or romanization.

### 4. Mandarin Full-text Search (`mandarin_fulltext`)
**UI Label:** 用北平方言查全文

```sql
SELECT id FROM entries WHERE hanzi LIKE $term
UNION
SELECT entry_id FROM meanings WHERE explanation LIKE $term
UNION
SELECT entry_id FROM examples WHERE mandarin_translation LIKE $term
```

Comprehensive search across entry hanzi, meaning explanations, and example translations.

### 5. Hokkien Full-text Search (`hokkien_fulltext`)
**UI Label:** 全文(閩南語)

```sql
SELECT id FROM entries WHERE hanzi LIKE $term OR romanization LIKE $term
UNION
SELECT entry_id FROM examples WHERE hanzi LIKE $term OR romanization LIKE $term
```

Searches both entries and examples for Hokkien text/romanization.

### 6. Regex Search (`regex`)
**UI Label:** 正規表示式(詞目)

```sql
SELECT id FROM entries WHERE hanzi REGEXP $term
```

Uses a custom JavaScript `REGEXP` function registered on the database:
```javascript
dbInstance.create_function("REGEXP", (pattern, str) =>
  new RegExp(pattern).test(str)
);
```

### 7. Category Browse (`category`)
**UI Label:** 依分類瀏覽

```sql
SELECT id FROM entries WHERE category LIKE $term
```

Filters entries by category field. Categories are comma-separated in the data.

### 8. Multi-Search / Sentence Segmentation (`multi_search`)
**UI Label:** 逐詞查詢

Algorithm:
1. Takes input sentence
2. Iterates from longest to shortest substrings
3. For each substring, performs exact match: `SELECT id, hanzi FROM entries WHERE hanzi = $term`
4. Collects all matching entries
5. Results sorted by match length (longest first)

This enables looking up all dictionary entries found within a sentence.

### 9. Single Entry Lookup (`single_entry`)
Direct entry retrieval by database ID (used for permalinks).

```sql
SELECT hanzi, romanization, category, audio_file FROM entries WHERE id = $entryId
```

### 10. Phonetic Search (`phonetic`)
**UI Label:** 聲韻調查詢

Interactive picker allowing users to filter entries by phonetic components:
- **聲母 (Initial):** p, ph, b, m, t, th, n, l, k, kh, g, ng, h, ts, tsh, s, j, 零(zero initial)
- **韻母 (Final):** a, ah, ai, aih, am, an, ang, etc. (87 finals total)
- **聲調 (Tone):** 1-8 (excluding 6, which merged with 2)

**URL Parameters:**
```
?si=k           → entries with initial "k"
?sf=ong         → entries with final "ong"
?st=1           → entries with tone 1
?si=k&sf=a&st=1 → entries with syllable "ka" (tone 1)
```

**Algorithm:**
1. Builds syllable index from all entry romanizations on modal open
2. Parses each romanization into syllables, then into initial/final/tone components
3. Uses `parseSyllable()` function with NFD normalization to extract tone marks
4. Filters available options based on current selection (dynamic narrowing)
5. Shows real-time match count as user selects components

**Romanization Parsing:**
```typescript
const TONE_MARKS = {
  "\u0301": 2, // ◌́ acute (陰上)
  "\u0300": 3, // ◌̀ grave (陰去)
  "\u0302": 5, // ◌̂ circumflex (陽平)
  "\u0304": 7, // ◌̄ macron (陽去)
  "\u030D": 8, // ◌̍ vertical line (陽入)
};
// No mark + checked final (p,t,k,h) = tone 4 (陰入)
// No mark + non-checked = tone 1 (陰平)
```

## Entry Detail Fetching

When displaying results, `fetchEntryDetails(entryId)` retrieves:

1. **Entry data:** hanzi, romanization, category, audio_file
2. **Meanings:** part_of_speech, explanation (numbered display_id added)
3. **Examples per meaning:** hanzi, romanization, mandarin_translation
4. **Variant characters:** `SELECT variant_hanzi FROM variant_characters WHERE entry_id = $id`
5. **Alternative pronunciations:** `SELECT entry_id, hanzi, romanization FROM alternative_pronunciations WHERE entry_id = $id`
6. **Phonetic differences:** All regional accent columns from `phonetic_differences`

## Result Sorting

Results are sorted by:
1. **Exact match priority:** Entries where hanzi exactly matches search term come first
2. **Reading type priority:**
   - 【替】 or 【白】 (colloquial): highest priority (0)
   - No annotation: medium priority (1)
   - 【文】 (literary): lowest priority (2)
3. **Entry ID:** ascending (older entries first)

## UI Features

### Random Word
```sql
SELECT id FROM entries ORDER BY RANDOM() LIMIT 1
```

### Category Modal
Loads all distinct categories at startup:
```sql
SELECT DISTINCT category FROM entries WHERE category IS NOT NULL AND category != ''
```
Categories are split by comma and deduplicated.

### Phonetic Picker Modal
Interactive single-page phonetic selector with:
- Three-way filter: initial, final, tone (any can be selected first)
- Dynamic availability: unavailable options greyed out based on current selection
- Live match count display
- Toggle selection (click again to deselect)
- Reset button to clear all selections
- URL deep linking support

### Document Title
Dynamically updates based on:
- Single result: `"{entry_hanzi} - 閩南語辭典"`
- Search term: `""{searchTerm}" - 閩南語辭典"`
- Default: `"閩南語辭典"`

### Layout
- Single column for: single entry view, forced single column mode, or ≤1 result
- Two columns (on lg screens) for multiple results

### External Links
- Entry titles link to: `https://sutian.moe.edu.tw/zh-hant/su/{id}/`
- Audio files from: `https://sutian.moe.edu.tw/media/senn/mp3/imtong/subak/0/{audioId}.mp3`

## Data NOT Currently Used

The following database tables exist but are not queried by the current implementation:

- `entry_synonyms` / `entry_antonyms` - Synonym/antonym relationships
- `meaning_synonyms` / `meaning_antonyms` - Meaning-level relationships
- `meaning_to_entry_synonyms` / `meaning_to_entry_antonyms` - Cross-level relationships
- `colloquial_pronunciations` - Colloquial forms
- `contractions` - Contracted forms
- `dialect_comparison` - Regional term comparisons
- `surnames` - Surname pronunciations
- `given_names` - Given name pronunciations
- `char_to_romanization` - Character-to-romanization mapping
- `romanization_syllables` - Valid syllables list
