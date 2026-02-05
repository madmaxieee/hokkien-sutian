# Query Features Specification

Documentation of search/query features implemented in `src/artifact-component.tsx`.

## URL Query Parameters

The app supports deep linking via URL query parameters:

| Parameter | Mode | Description |
|-----------|------|-------------|
| `q`, `he` | `hokkien_entry` | Search entries by Hokkien (hanzi or romanization) |
| `me` | `mandarin_example` | Search examples by Mandarin translation |
| `hf` | `hokkien_example` | Search examples by Hokkien (hanzi or romanization) |
| `mf` | `mandarin_fulltext` | Full-text search in Mandarin across all fields |
| `rx` | `regex` | Regex search on entry hanzi |
| `hft` | `hokkien_fulltext` | Full-text search in Hokkien across entries and examples |
| `cat` | `category` | Browse by category |
| `qs` | `multi_search` | Sentence segmentation search |
| `su` | `single_entry` | Direct entry lookup by ID |

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
