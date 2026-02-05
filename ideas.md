# Feature Ideas for Hokkien Dictionary

## Advanced Query Modes

### 1. Synonym/Antonym Explorer
**Uses:** `entry_synonyms`, `entry_antonyms`, `meaning_synonyms`, `meaning_antonyms` tables

- Show related words when viewing an entry
- "Find synonyms of X" search mode
- Visual word relationship graph (network visualization)
- Thesaurus-style browsing

### 2. Dialect Comparison Search
**Uses:** `dialect_comparison` table (12,271 rows)

- Input Mandarin term → Show regional Hokkien equivalents
- Compare how different regions say the same thing
- Filter by accent (臺北偏泉腔, 高雄混合腔, etc.)

### 3. Name Pronunciation Lookup
**Uses:** `surnames` (2,532 rows), `given_names` (16,876 rows)

- Dedicated mode for looking up name pronunciations
- Input full name → Get complete Hokkien pronunciation
- Show multiple pronunciation variants (surnames often have 2-3 readings)

### 4. Reverse Romanization Search
**Uses:** `char_to_romanization` table (20,017 rows)

- Input romanization → Get all possible characters
- Useful for learners who hear a word but don't know the characters
- Show source context (from 詞目, 例句, 又唸作, 詞彙比較)

### 5. Tone Pattern Search
Parse romanization to extract tone numbers, then search by pattern.

- Input: `1-7-3` → Find all words with that tone sequence
- Useful for poetry, songs, or studying tone sandhi
- Could also search by tone contour shape

### 6. Rhyme Search
Extract final syllable (韻母 + 聲調) from romanization.

- Find words that rhyme with a given word
- Useful for poetry composition
- Group by rhyme categories

### 7. Initial Consonant Search (聲母)
Extract initial consonant from romanization.

- Find all words starting with `ts-`, `ph-`, `kh-`, etc.
- Useful for studying consonant patterns
- Help learners who confuse similar initials

### 8. Syllable Count Filter
Count syllables in romanization (split by `-` or spaces).

- Filter results by syllable count (1字詞, 2字詞, 3字詞, etc.)
- Combine with other search modes
- Statistics view: distribution of word lengths

### 9. Wildcard Romanization Search
More powerful pattern matching for romanization.

- `*ong` - ends with "ong"
- `k*ng` - starts with k, ends with ng
- `?at` - single character + "at"

### 10. Cross-Reference Graph
**Uses:** `alternative_pronunciations`, all synonym/antonym tables

- Show all entries that reference a given entry
- Bidirectional relationship visualization
- "See also" network exploration

---

## Non-Query Features

### 1. Flashcard / Quiz Mode
- Random word quiz with multiple choice
- Show hanzi → guess romanization (or vice versa)
- Show Mandarin → guess Hokkien
- Spaced repetition tracking (localStorage)
- Filter by category for focused study

### 2. Regional Accent Comparison Panel
**Uses:** `phonetic_differences` table

- Side-by-side comparison of all 10 regional accents
- Audio playback for each region (if available)
- Highlight differences between selected regions

### 3. Pronunciation Trainer
- Play audio → user attempts to speak
- Compare user's pronunciation (via Web Audio API analysis)
- Focus on commonly confused sounds

### 4. Favorites & History
- Bookmark entries for later review
- Search history with timestamps
- Export bookmarks as study list

### 5. Romanization Converter
- POJ ↔ Tâi-lô bidirectional conversion
- Batch convert text
- Support for different tone marking styles (numbers vs diacritics)

### 6. Text Annotation Tool
- Paste Hokkien text → annotate with romanization
- Ruby text (振り仮名 style) display
- Export as HTML or image

### 7. Statistics Dashboard
- Database statistics visualization
- Category distribution pie chart
- Most common characters/syllables
- Tone distribution

### 8. Offline Mode (PWA)
- Cache database for offline use
- Service worker for app shell
- Sync favorites when online

---

## Sound-Based Query Design

### Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Audio Input    │────▶│  Audio Processing │────▶│  Query Engine   │
│  (Microphone)   │     │  Pipeline         │     │  (Fuzzy Match)  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                    ┌──────────┴──────────┐
                    ▼                     ▼
            ┌──────────────┐      ┌──────────────┐
            │ Syllable     │      │ Tone         │
            │ Recognition  │      │ Detection    │
            └──────────────┘      └──────────────┘
```

### Approach 1: Phonetic Transcription (Recommended)

**Pipeline:**
1. **Audio capture** via Web Audio API / MediaRecorder
2. **Speech-to-text** using:
   - OpenAI Whisper (supports Hokkien via `--language zh`)
   - Or browser Web Speech API (Mandarin fallback)
3. **Phonetic normalization:**
   - Convert STT output to phonetic representation
   - Handle Mandarin approximations (STT often outputs Mandarin for Hokkien)
4. **Fuzzy romanization matching:**
   - Compare against `romanization_syllables` table
   - Use phonetic distance algorithms (Soundex variant for tonal languages)

**Implementation:**
```typescript
interface AudioQueryResult {
  transcription: string;        // Raw STT output
  normalizedSyllables: string[]; // Parsed syllables
  candidates: Entry[];          // Matched entries with confidence scores
}

// Phonetic similarity scoring
function phoneticDistance(a: string, b: string): number {
  // Weight by: initial, final, tone
  // Similar sounds (p/ph, t/th, k/kh) get partial credit
}
```

### Approach 2: Tone Contour Analysis

**For users who know the syllables but not the tones:**

1. **Pitch extraction** using Web Audio API (AnalyserNode + FFT)
2. **Tone classification:**
   - Hokkien has 7 citation tones + tone sandhi
   - Train simple classifier on pitch contours
3. **Combined search:**
   - User inputs approximate romanization (toneless)
   - System detects tone from audio
   - Match against entries with that tone pattern

**Tone patterns in Tâi-lô:**
| Tone | Number | Contour | Example |
|------|--------|---------|---------|
| 陰平 | 1 | high level | 東 (tong) |
| 陰上 | 2 | high falling | 黨 (tóng) |
| 陰去 | 3 | low falling | 棟 (tòng) |
| 陰入 | 4 | low checked | 督 (tok) |
| 陽平 | 5 | rising | 同 (tông) |
| 陽去 | 7 | mid level | 洞 (tōng) |
| 陽入 | 8 | high checked | 毒 (to̍k) |

### Approach 3: Audio Fingerprinting (Advanced)

**For "What's this word?" queries:**

1. **Pre-compute audio fingerprints** for all dictionary audio files
2. **User records audio** of word they heard
3. **Match against fingerprint database**
4. **Return closest matches** with confidence scores

**Pros:** Works even without good STT for Hokkien
**Cons:** Only matches words in the dictionary's audio corpus

### Approach 4: Syllable-by-Syllable Input

**Interactive guided input:**

1. User speaks one syllable at a time
2. System shows possible matches after each syllable
3. User confirms or corrects
4. Progressive narrowing of candidates

**UI Flow:**
```
[Record] → "lâng" detected → Showing 127 entries starting with "lâng"
[Record] → "kheh" detected → Showing 3 entries for "lâng-kheh"
  → 人客 (lâng-kheh) - guest
```

### Technical Considerations

**Browser APIs:**
- `navigator.mediaDevices.getUserMedia()` - microphone access
- `AudioContext` + `AnalyserNode` - real-time audio analysis
- `MediaRecorder` - audio recording for server-side processing

**Backend Options (for Whisper):**
- Self-hosted Whisper API
- OpenAI Whisper API
- Cloudflare Workers AI (has Whisper)
- Run in browser via whisper.cpp WASM (experimental)

**Fallback Strategy:**
1. Try Hokkien-specific STT if available
2. Fall back to Mandarin STT
3. Apply phonetic mapping (Mandarin → Hokkien approximation)
4. Return multiple candidates with confidence scores

### MVP Implementation

**Phase 1: Basic voice input**
- Record audio → send to Whisper API
- Display raw transcription
- Fuzzy search against entries

**Phase 2: Phonetic matching**
- Build phonetic similarity index
- Rank results by pronunciation similarity
- Show "Did you mean...?" suggestions

**Phase 3: Tone detection**
- Add pitch analysis
- Combine with syllable input
- Train on dictionary audio files

---

## Priority Recommendations

### High Impact, Low Effort
1. **Synonym/Antonym display** - Data exists, just wire it up
2. **Name pronunciation lookup** - Dedicated UI for existing tables
3. **Favorites & History** - localStorage, no backend needed
4. **Dialect comparison** - Useful feature, data ready

### High Impact, Medium Effort
5. **Rhyme search** - Needs romanization parsing logic
6. **Flashcard mode** - UI work, reuses existing queries
7. **Sound-based query (MVP)** - Whisper API + fuzzy matching

### High Impact, High Effort
8. **Full audio fingerprinting** - Needs audio processing pipeline
9. **PWA offline mode** - Database caching strategy
10. **Pronunciation trainer** - Audio analysis + comparison
