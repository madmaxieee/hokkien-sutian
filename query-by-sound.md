# Query by Sound: Comparison & Implementation Plan

## Two Different Interpretations of "Query by Sound"

| Aspect | MOE Sutian 聲韻調索引 | My Original Ideas |
|--------|----------------------|-------------------|
| **Input method** | Click/tap phonetic selectors | Voice/microphone recording |
| **User requirement** | Must know romanization basics | Can be illiterate in romanization |
| **Technology** | Simple URL routing + database queries | STT, pitch analysis, audio processing |
| **Complexity** | Low | High |
| **Reliability** | 100% deterministic | Probabilistic, error-prone |
| **Offline capable** | Yes | Depends on STT backend |

**Key insight:** MOE's system is a **phonetic picker/navigator**, not voice input. It's fundamentally different from audio-based search—and much more practical.

---

## MOE Sutian's Approach: Detailed Analysis

### Strengths

1. **Deterministic results** - No ambiguity, exact matches
2. **Educational value** - Teaches phonetic structure as users navigate
3. **Progressive disclosure** - Narrows down step by step
4. **URL-friendly** - Bookmarkable, shareable results
5. **No external dependencies** - Pure database queries
6. **Works offline** - Just needs the data

### Weaknesses

1. **Learning curve** - Requires romanization knowledge
2. **Multi-step navigation** - 2-3 clicks to reach results
3. **Not useful for "I heard a word, what is it?"** - Assumes you can decompose the sound

### Query Patterns

```
/siannuntiau/siann/{initial}/           → List finals for this initial
/siannuntiau/siann/{initial}/{final}/   → List tones with characters
/siannuntiau/un/{final}/                → List tones for this final
/siannuntiau/un/{final}/{tone}/         → List initials with characters
/siannuntiau/tiau/{tone}/               → List finals for this tone
/siannuntiau/tsong/siann/{initial}/     → All results for initial (paginated)
```

---

## Recommendation: Implement BOTH Approaches

### Phase 1: Phonetic Picker (Like MOE, but better)
**Effort: Low | Impact: High**

A structured phonetic selector that's easier to use than MOE's multi-page navigation.

### Phase 2: Voice Input (Original idea, simplified)
**Effort: Medium | Impact: Medium**

Add optional voice input that feeds into the phonetic picker.

---

## Phase 1: Phonetic Picker Implementation

### UI Design: Single-Page Interactive Selector

```
┌─────────────────────────────────────────────────────────────┐
│  聲韻調查詢                                                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  聲母 (Initial):  [p][ph][b][m][t][th][n][l]...  [零]        │
│                   ───                                       │
│                                                             │
│  韻母 (Final):    [a][ah][ai][aih][am][an][ang]...          │
│                       ───                                   │
│                                                             │
│  聲調 (Tone):     [1][2][3][4][5][7][8]  or  [any]          │
│                   ───                                       │
│                                                             │
│  Preview: "pah" (8 characters found)                        │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 八 百 柏 伯 北 ...                                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Key Improvements Over MOE

| MOE | Our Version |
|-----|-------------|
| Multi-page navigation | Single-page with live filtering |
| Must select in order | Select any component first |
| Page reloads between steps | Instant updates |
| Separate "tsong" for full results | Integrated view |
| No tone visualization | Show tone contour icons |

### Data Requirements

Already have in database:
- `entries.romanization` - can parse for initials/finals/tones
- `romanization_syllables` (3,153 rows) - valid syllable inventory

Need to build:
- **Syllable decomposition index** - pre-computed initial/final/tone for each entry

### Schema Addition

```sql
CREATE TABLE syllable_components (
  entry_id INTEGER REFERENCES entries(id),
  syllable_position INTEGER,  -- 1st, 2nd, 3rd syllable in word
  initial TEXT,               -- 'k', 'ph', 'ts', 'ling' (零聲母)
  final TEXT,                 -- 'a', 'ong', 'iah'
  tone INTEGER,               -- 1,2,3,4,5,7,8
  syllable TEXT,              -- full syllable 'kah'
  PRIMARY KEY (entry_id, syllable_position)
);

CREATE INDEX idx_syllable_initial ON syllable_components(initial);
CREATE INDEX idx_syllable_final ON syllable_components(final);
CREATE INDEX idx_syllable_tone ON syllable_components(tone);
```

### Romanization Parsing Logic

```typescript
const INITIALS = ['p', 'ph', 'b', 'm', 't', 'th', 'n', 'l', 'k', 'kh',
                  'g', 'ng', 'h', 'ts', 'tsh', 's', 'j'];

const TONE_MARKS: Record<string, number> = {
  '': 1,      // no mark = tone 1 (or 4 if checked)
  '\u0301': 2, // ◌́ acute
  '\u0300': 3, // ◌̀ grave
  '\u0302': 5, // ◌̂ circumflex
  '\u0304': 7, // ◌̄ macron
  '\u030D': 8, // ◌̍ vertical line above
};

function parseSyllable(syllable: string): { initial: string; final: string; tone: number } {
  // Normalize to NFD to separate tone marks
  const normalized = syllable.normalize('NFD');

  // Extract tone mark
  let tone = 1;
  let base = '';
  for (const char of normalized) {
    if (TONE_MARKS[char] !== undefined) {
      tone = TONE_MARKS[char];
    } else {
      base += char;
    }
  }

  // Check for entering tone (入聲) - ends with h, p, t, k
  const isChecked = /[hptk]$/.test(base) && !/nn?h$/.test(base);
  if (isChecked && tone === 1) tone = 4;
  if (isChecked && tone === 5) tone = 8;

  // Extract initial (longest match)
  let initial = 'ling'; // zero initial
  for (const init of INITIALS.sort((a, b) => b.length - a.length)) {
    if (base.startsWith(init)) {
      initial = init;
      break;
    }
  }

  const final = initial === 'ling' ? base : base.slice(initial.length);

  return { initial, final, tone };
}
```

### Query Implementation

```typescript
type PhoneticQuery = {
  initial?: string;   // 'k', 'ph', 'ling', etc.
  final?: string;     // 'a', 'ong', 'iah', etc.
  tone?: number;      // 1-8
};

async function queryByPhonetics(db: Database, query: PhoneticQuery): Promise<Entry[]> {
  const conditions: string[] = [];
  const params: any[] = [];

  if (query.initial) {
    conditions.push('initial = ?');
    params.push(query.initial);
  }
  if (query.final) {
    conditions.push('final = ?');
    params.push(query.final);
  }
  if (query.tone) {
    conditions.push('tone = ?');
    params.push(query.tone);
  }

  const where = conditions.length > 0
    ? `WHERE ${conditions.join(' AND ')}`
    : '';

  const sql = `
    SELECT DISTINCT e.*
    FROM entries e
    JOIN syllable_components sc ON e.id = sc.entry_id
    ${where}
    ORDER BY e.hanzi
  `;

  return db.exec(sql, params);
}
```

### URL Parameters

```
?si=k           → initial = k
?su=ong         → final = ong
?st=1           → tone = 1
?si=k&su=a&st=1 → ka with tone 1
```

---

## Phase 2: Voice Input Enhancement

### Simplified Approach

Instead of full STT → text → search, use voice to **assist the phonetic picker**:

```
┌─────────────────────────────────────────────────────────────┐
│  🎤 Tap to speak a syllable                                 │
│                                                             │
│  [Record] ──▶ "Detected: kah (tone 4)"                      │
│              Did you mean: [kah] [khat] [khah] [kat]        │
│                                                             │
│  Selected: kah → Showing 8 entries                          │
└─────────────────────────────────────────────────────────────┘
```

### Implementation

1. **Record single syllable** (short audio, ~1 second)
2. **Send to Whisper API** with Hokkien/Chinese hints
3. **Parse result** into initial/final/tone candidates
4. **Show top 3-5 candidates** for user confirmation
5. **User selects** → populates phonetic picker

### Why This is Better Than Full Voice Search

| Full Voice Search | Voice-Assisted Picker |
|-------------------|----------------------|
| User speaks whole word | User speaks one syllable |
| Must handle multi-syllable | Simpler single-syllable processing |
| Ambiguous results | User confirms before search |
| Frustrating when wrong | Quick to correct |

### Minimal Backend

```typescript
// /api/voice-to-syllable
export async function POST(req: Request) {
  const formData = await req.formData();
  const audio = formData.get('audio') as Blob;

  // Send to Whisper
  const transcription = await whisper.transcribe(audio, {
    language: 'zh',
    prompt: 'Taiwanese Hokkien syllable'
  });

  // Parse into phonetic components
  const candidates = generateCandidates(transcription.text);

  return Response.json({ candidates });
}

function generateCandidates(text: string): PhoneticQuery[] {
  // Generate variations accounting for common STT errors
  // e.g., "ka" → [ka, kha, ga, kah]
  const parsed = parseSyllable(text);
  return [
    parsed,
    { ...parsed, initial: addAspiration(parsed.initial) },
    { ...parsed, tone: getAlternateTone(parsed.tone) },
    // etc.
  ];
}
```

---

## Comparison Summary

| Criteria | MOE 聲韻調索引 | Our Phase 1 | Our Phase 2 |
|----------|--------------|-------------|-------------|
| Ease of implementation | Reference | Easy | Medium |
| User experience | Multi-page clicks | Single-page instant | Voice + confirm |
| Requires romanization knowledge | Yes | Yes | Partial |
| Accuracy | 100% | 100% | ~80-90% |
| Offline support | Yes | Yes | No (needs API) |
| Mobile-friendly | Medium | High | High |
| Educational value | High | High | Medium |

---

## Implementation Roadmap

### Week 1: Data Preparation
- [ ] Write script to parse all `entries.romanization` into components
- [ ] Create `syllable_components` table
- [ ] Validate parsing against `romanization_syllables` table
- [ ] Build initial/final/tone frequency statistics

### Week 2: Phase 1 UI
- [ ] Create phonetic picker component
- [ ] Add URL parameter support (`?si=`, `?su=`, `?st=`)
- [ ] Implement live filtering as user selects
- [ ] Add tone contour visualization
- [ ] Mobile-responsive button grid

### Week 3: Phase 1 Polish
- [ ] Add "common syllables" quick-pick section
- [ ] Keyboard navigation support
- [ ] Integration with existing search modes (new tab)
- [ ] Analytics on popular phonetic queries

### Week 4+ (Optional): Phase 2 Voice
- [ ] Set up Whisper API endpoint
- [ ] Create voice recording UI component
- [ ] Implement candidate generation logic
- [ ] A/B test voice vs. manual picker

---

## Quick Win: Pure Frontend Syllable Picker

If we don't want to modify the database, we can do Phase 1 entirely in the browser:

```typescript
// Build index on app load from existing entries
const syllableIndex = new Map<string, Set<number>>();

entries.forEach(entry => {
  const syllables = entry.romanization.split(/[-\s]+/);
  syllables.forEach(syl => {
    const { initial, final, tone } = parseSyllable(syl);
    const key = `${initial}|${final}|${tone}`;
    if (!syllableIndex.has(key)) syllableIndex.set(key, new Set());
    syllableIndex.get(key)!.add(entry.id);
  });
});

// Query is instant lookup
function queryPhonetic(initial?: string, final?: string, tone?: number): number[] {
  const results = new Set<number>();
  for (const [key, ids] of syllableIndex) {
    const [i, f, t] = key.split('|');
    if (initial && i !== initial) continue;
    if (final && f !== final) continue;
    if (tone && parseInt(t) !== tone) continue;
    ids.forEach(id => results.add(id));
  }
  return [...results];
}
```

**Trade-off:** Builds index on page load (~29k entries), but avoids schema changes.

---

## Conclusion

MOE's phonetic index is **simpler and more practical** than my original audio-based ideas. The right approach is:

1. **Implement a better phonetic picker** (single-page, instant feedback)
2. **Optionally add voice input** as an assistant to the picker, not a replacement

This gives users the reliability of structured selection with the convenience of voice when desired.
