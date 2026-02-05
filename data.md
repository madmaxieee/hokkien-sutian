# Hokkien Dictionary Database (`kautian.db`)

SQLite database (path: `public/assets/data/kautian.db`) containing Hokkien (閩南語) dictionary data sourced from 教育部臺灣閩南語常用詞辭典.

## Statistics

| Table                      | Row Count |
| -------------------------- | --------- |
| entries                    | 29,154    |
| meanings                   | 23,102    |
| examples                   | 17,696    |
| char_to_romanization       | 20,017    |
| given_names                | 16,876    |
| dialect_comparison         | 12,271    |
| variant_characters         | 3,093     |
| romanization_syllables     | 3,153     |
| surnames                   | 2,532     |
| entry_synonyms             | 1,861     |
| alternative_pronunciations | 1,737     |
| phonetic_differences       | 407       |
| entry_antonyms             | 77        |
| colloquial_pronunciations  | 55        |
| contractions               | 36        |

## Core Tables

### `entries`
Main dictionary entries table.

| Column       | Type    | Description                                                          |
| ------------ | ------- | -------------------------------------------------------------------- |
| id           | INTEGER | Primary key                                                          |
| type         | TEXT    | Entry type (e.g., "主詞目")                                          |
| hanzi        | TEXT    | Chinese characters (may include annotations like 【替】【白】【文】) |
| romanization | TEXT    | Taiwanese romanization (POJ/Tâi-lô)                                  |
| category     | TEXT    | Comma-separated categories (e.g., "性質、程度,數詞、量詞")           |
| audio_file   | TEXT    | Audio file reference (e.g., "1(1)")                                  |

### `meanings`
Definitions/meanings for each entry.

| Column         | Type    | Description                               |
| -------------- | ------- | ----------------------------------------- |
| entry_id       | INTEGER | FK to entries.id                          |
| id             | INTEGER | Primary key                               |
| part_of_speech | TEXT    | Part of speech (數詞, 形容詞, 副詞, etc.) |
| explanation    | TEXT    | Mandarin explanation/definition           |

### `examples`
Usage examples for each meaning.

| Column               | Type    | Description                            |
| -------------------- | ------- | -------------------------------------- |
| entry_id             | INTEGER | FK to entries.id                       |
| meaning_id           | INTEGER | FK to meanings.id                      |
| sequence             | INTEGER | Order within meaning                   |
| hanzi                | TEXT    | Example sentence in Hokkien characters |
| romanization         | TEXT    | Romanization of example                |
| mandarin_translation | TEXT    | Mandarin translation                   |
| audio_file           | TEXT    | Audio file reference                   |

## Supplementary Tables

### `variant_characters`
Alternative character forms for entries.

| Column         | Type    | Description             |
| -------------- | ------- | ----------------------- |
| entry_id       | INTEGER | FK to entries.id        |
| original_hanzi | TEXT    | Original character form |
| variant_hanzi  | TEXT    | Variant character form  |

### `alternative_pronunciations`
Alternative pronunciations (又見音) linking to other entries.

| Column       | Type    | Description                 |
| ------------ | ------- | --------------------------- |
| entry_id     | INTEGER | FK to entries.id            |
| hanzi        | TEXT    | Hanzi of alternative        |
| romanization | TEXT    | Romanization of alternative |

### `colloquial_pronunciations`
Colloquial/spoken pronunciations.

| Column       | Type    | Description             |
| ------------ | ------- | ----------------------- |
| entry_id     | INTEGER | FK to entries.id        |
| hanzi        | TEXT    | Hanzi form              |
| romanization | TEXT    | Colloquial romanization |

### `contractions`
Contracted forms of entries.

| Column       | Type    | Description             |
| ------------ | ------- | ----------------------- |
| entry_id     | INTEGER | FK to entries.id        |
| hanzi        | TEXT    | Contracted hanzi        |
| romanization | TEXT    | Contracted romanization |

### `phonetic_differences`
Regional accent variations for entries.

| Column          | Type    | Description      |
| --------------- | ------- | ---------------- |
| entry_id        | INTEGER | FK to entries.id |
| hanzi           | TEXT    | Base hanzi       |
| lu_gang_quan    | TEXT    | 鹿港偏泉腔       |
| san_xia_quan    | TEXT    | 三峽偏泉腔       |
| taipei_quan     | TEXT    | 臺北偏泉腔       |
| yi_lan_zhang    | TEXT    | 宜蘭偏漳腔       |
| tai_nan_mix     | TEXT    | 臺南混合腔       |
| gao_xiong_mix   | TEXT    | 高雄混合腔       |
| jin_men_quan    | TEXT    | 金門偏泉腔       |
| ma_gong_quan    | TEXT    | 馬公偏泉腔       |
| xin_zhu_quan    | TEXT    | 新竹偏泉腔       |
| tai_zhong_zhang | TEXT    | 臺中偏漳腔       |

## Relationship Tables

### `entry_synonyms` / `entry_antonyms`
Synonym/antonym relationships between entries.

| Column                        | Type    | Description     |
| ----------------------------- | ------- | --------------- |
| entry_id                      | INTEGER | Source entry FK |
| hanzi                         | TEXT    | Source hanzi    |
| synonym_id / antonym_id       | INTEGER | Target entry FK |
| synonym_hanzi / antonym_hanzi | TEXT    | Target hanzi    |

### `meaning_synonyms` / `meaning_antonyms`
Synonym/antonym relationships at meaning level.

| Column                                    | Type    | Description                |
| ----------------------------------------- | ------- | -------------------------- |
| meaning_id                                | INTEGER | Source meaning FK          |
| hanzi                                     | TEXT    | Source entry hanzi         |
| explanation                               | TEXT    | Source meaning explanation |
| synonym_meaning_id / antonym_meaning_id   | INTEGER | Target meaning FK          |
| synonym_hanzi / antonym_hanzi             | TEXT    | Target entry hanzi         |
| synonym_explanation / antonym_explanation | TEXT    | Target explanation         |

### `meaning_to_entry_synonyms` / `meaning_to_entry_antonyms`
Cross-level relationships (meaning to entry).

## Reference Tables

### `dialect_comparison`
Mandarin to regional Hokkien term comparisons.

| Column               | Type    | Description          |
| -------------------- | ------- | -------------------- |
| mandarin_id          | INTEGER | Mandarin term ID     |
| mandarin_term        | TEXT    | Mandarin term        |
| accent               | TEXT    | Regional accent name |
| hokkien_hanzi        | TEXT    | Hokkien equivalent   |
| hokkien_romanization | TEXT    | Romanization         |

### `surnames`
Hokkien pronunciations of Chinese surnames.

| Column       | Type    | Description           |
| ------------ | ------- | --------------------- |
| hanzi        | TEXT    | Surname character     |
| romanization | TEXT    | Hokkien pronunciation |
| sequence     | INTEGER | Priority/order        |
| type         | TEXT    | Classification        |

### `given_names`
Hokkien pronunciations of given name characters.

| Column       | Type    | Description           |
| ------------ | ------- | --------------------- |
| hanzi        | TEXT    | Character             |
| romanization | TEXT    | Hokkien pronunciation |
| sequence     | INTEGER | Priority/order        |
| type         | TEXT    | Classification        |

### `char_to_romanization`
Character to romanization mapping with source tracking.

| Column       | Type | Description                                             |
| ------------ | ---- | ------------------------------------------------------- |
| hanzi        | TEXT | Character(s)                                            |
| romanization | TEXT | Romanization                                            |
| source       | TEXT | Sources (comma-separated: 詞目, 例句, 又唸作, 詞彙比較) |

### `romanization_syllables`
Valid romanization syllables.

| Column       | Type | Description      |
| ------------ | ---- | ---------------- |
| romanization | TEXT | Syllable         |
| source       | TEXT | Source reference |
