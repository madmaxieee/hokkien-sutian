# MOE Taiwan Hokkien Dictionary Audio Service

## Entry Audio (詞條音檔 / subak)

**Base URL pattern:**
```
https://sutian.moe.edu.tw/media/senn/mp3/imtong/subak/{folder}/{entry_id}.mp3
```

**Folder calculation:**
```javascript
folder = Math.floor(entry_id / 1000)
```

**Examples verified:**

| Entry ID | Folder | Full URL |
|----------|--------|----------|
| 1 | 0 | `/subak/0/1.mp3` |
| 100 | 0 | `/subak/0/100.mp3` |
| 999 | 0 | `/subak/0/999.mp3` |
| 1000 | 1 | `/subak/1/1000.mp3` |
| 1001 | 1 | `/subak/1/1001.mp3` |
| 2500 | 2 | `/subak/2/2500.mp3` |
| 5000 | 5 | `/subak/5/5000.mp3` |
| 9999 | 9 | `/subak/9/9999.mp3` |
| 10000 | 10 | `/subak/10/10000.mp3` |
| 10356 | 10 | `/subak/10/10356.mp3` |
| 25000 | 25 | `/subak/25/25000.mp3` |

**Coverage:**
- Total entries in DB: 29,660
- Entries with audio: 21,789 (audio_file column is non-empty)
- No exceptions found; entry_id in URL always matches the dictionary entry ID

## Example Audio (例句音檔 / leku)

**Base URL pattern:**
```
https://sutian.moe.edu.tw/media/senn/mp3/imtong/leku/{folder}/{leku_id}.mp3
```

**Folder calculation:**
```javascript
folder = Math.floor(leku_id / 1000)
```

**Important inconsistency:**
The `leku_id` used in MOE URLs is **completely different** from the local database's example IDs.

**Examples:**

| Entry ID | DB audio_file | MOE leku_id | MOE URL |
|----------|---------------|-------------|---------|
| 1 | `1-1-1` | 45549 | `/leku/45/45549.mp3` |
| 1 | `1-2-1` | 45550 | `/leku/45/45550.mp3` |
| 1 | `1-3-1` | 61001 | `/leku/61/61001.mp3` |
| 1 | `1-3-2` | 61002 | `/leku/61/61002.mp3` |
| 2 | `2-2-1` | 45551 | `/leku/45/45551.mp3` |
| 2 | `2-3-1` | 45552 | `/leku/45/45552.mp3` |

The DB's `audio_file` format `{entry_id}-{meaning_num}-{example_num}` does NOT map to MOE's `leku_id`. The leku IDs appear to be sequentially assigned independent of entry structure.

**Coverage:**
- Total examples in DB: ~17,696 with audio_file
- Cannot directly construct MOE URLs from DB data alone

## Zip File Structure

The downloaded zip files follow the same sharding pattern:

**sutiau-mp3.zip** (entry audio):
- Files named: `{folder}/{id}(1).mp3`
- Example: `0/1(1).mp3`, `10/10356(1).mp3`
- Maps directly to MOE URL by removing `(1)` suffix

**leku-mp3.zip** (example audio):
- Files named: `{folder}/{entry_id}-{meaning}-{example}.mp3`
- Example: `0/1-1-1.mp3`, `0/2-3-1.mp3`
- Uses DB's audio_file format, NOT MOE's leku_id format

## Implementation Notes

### For Entry Audio
Always use `entry_id` directly:
```typescript
const folder = Math.floor(entryId / 1000);
const url = `https://sutian.moe.edu.tw/media/senn/mp3/imtong/subak/${folder}/${entryId}.mp3`;
```

### For Example Audio
Two options:
1. **Local files**: Use zip-extracted files with path `leku/{folder}/{entry_id}-{meaning}-{example}.mp3`
2. **MOE server**: Requires mapping table or scraping to convert DB audio_file to leku_id

### Missing Audio
- Entry 15000: exists in DB, but no audio on MOE server
- Entry 20000: 404 on MOE server
- Entry 29000: 404 on MOE server
- Approximately 7,871 entries (29,660 - 21,789) have no audio files
