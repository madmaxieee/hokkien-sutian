# 教育部臺灣台語常用詞辭典 - 聲韻調索引系統

## 概述

教育部臺灣台語常用詞辭典的「聲韻調索引」功能允許使用者透過台語的聲母（initial consonants）、韻母（finals/rhymes）和聲調（tones）來查詢漢字。本文檔詳細說明該系統的 URL 結構和查詢機制。

**入口網址**: https://sutian.moe.edu.tw/zh-hant/siannuntiau/

---

## URL 結構

### 基礎路徑

```
https://sutian.moe.edu.tw/zh-hant/siannuntiau/
```

### 1. 聲母查詢 (Initial Consonant Query)

查詢特定聲母下的所有韻母組合。

**URL 模式**:
```
/siannuntiau/siann/{聲母}/
```

**範例**:
- `/siannuntiau/siann/k/` - 查詢聲母 "k" 的所有韻母組合
- `/siannuntiau/siann/ph/` - 查詢聲母 "ph" 的所有韻母組合
- `/siannuntiau/siann/ling/` - 查詢零聲母的所有韻母組合

**回傳內容**: 顯示該聲母可搭配的所有韻母清單（如 a, ah, ann, am, an 等）。

---

### 2. 聲母 + 韻母查詢 (Initial + Final Query)

查詢特定聲母和韻母組合下的所有聲調及對應漢字。

**URL 模式**:
```
/siannuntiau/siann/{聲母}/{韻母}/
```

**範例**:
- `/siannuntiau/siann/k/a/` - 查詢 "k" + "a" 的所有聲調組合（ka, ká, kà, kā）

**回傳內容**: 表格顯示各聲調對應的音節及漢字清單。

---

### 3. 韻母查詢 (Final/Rhyme Query)

查詢特定韻母下的所有聲調組合。

**URL 模式**:
```
/siannuntiau/un/{韻母}/
```

**範例**:
- `/siannuntiau/un/a/` - 查詢韻母 "a" 的所有聲調（a, á, à, â, ā）
- `/siannuntiau/un/ong/` - 查詢韻母 "ong" 的所有聲調

**回傳內容**: 顯示該韻母的所有聲調變體（含聲調符號）。

---

### 4. 韻母 + 聲調查詢 (Final + Tone Query)

查詢特定韻母和聲調組合下的所有聲母及對應漢字。

**URL 模式**:
```
/siannuntiau/un/{韻母}/{聲調數字}/
```

**範例**:
- `/siannuntiau/un/a/1/` - 查詢韻母 "a" + 第1調的所有聲母組合（a, ha, ka, kha, la, ma...）

**回傳內容**: 表格顯示各聲母與該韻母/聲調組合的音節及漢字清單。

---

### 5. 聲調查詢 (Tone Query)

查詢特定聲調下的所有韻母組合。

**URL 模式**:
```
/siannuntiau/tiau/{聲調數字}/
```

**範例**:
- `/siannuntiau/tiau/1/` - 查詢第1調的所有韻母組合
- `/siannuntiau/tiau/4/` - 查詢第4調（入聲）的所有韻母組合

**回傳內容**: 顯示該聲調可搭配的所有韻母清單。

---

### 6. 完整結果查詢 (All/Combined Results)

使用 `tsong`（所有）路徑取得不分類的完整結果列表。

**URL 模式**:
```
/siannuntiau/tsong/siann/{聲母}/
/siannuntiau/tsong/un/{韻母}/
/siannuntiau/tsong/tiau/{聲調數字}/
```

**範例**:
- `/siannuntiau/tsong/siann/k/` - 顯示聲母 "k" 的所有音節和漢字（跨所有韻母和聲調）
- `/siannuntiau/tsong/un/a/` - 顯示韻母 "a" 的所有音節和漢字（跨所有聲母和聲調）
- `/siannuntiau/tsong/tiau/1/` - 顯示第1調的所有音節和漢字（跨所有聲母和韻母）

**回傳內容**: 完整的結果表格，支援分頁（預設每頁 20 筆）。

**分頁參數**:
- `?iahbe={頁碼}&pitsoo={每頁筆數}`
- 範例: `?iahbe=2&pitsoo=20` - 第2頁，每頁20筆

---

### 7. 單字詳細資料頁面 (Character Detail Page)

**URL 模式**:
```
/siannuntiau/siann/{聲母}/_/{音節}{聲調數字}/{URL編碼後的漢字}/
```

**範例**:
- `/siannuntiau/siann/k/_/ka1/%E5%AE%B6/` - 「家」字詳細資料（音節 ka，第1調）
- `/siannuntiau/siann/k/_/ka3/%E5%83%B9/` - 「價」字詳細資料（音節 kà，第3調）

**注意**: 音節部分使用不帶聲調符號的羅馬字 + 聲調數字（如 ka1, ka2, ka3, ka4, ka5, ka7, ka8）。

---

## 聲母列表 (Initial Consonants)

共有 18 個聲母：

| 聲母 | 例字 | URL 範例 |
|------|------|----------|
| p | 巴 | `/siannuntiau/siann/p/` |
| ph | 拋 | `/siannuntiau/siann/ph/` |
| b | 麻 | `/siannuntiau/siann/b/` |
| m | 媽 | `/siannuntiau/siann/m/` |
| t | 焦 | `/siannuntiau/siann/t/` |
| th | 他 | `/siannuntiau/siann/th/` |
| n | 焦 | `/siannuntiau/siann/n/` |
| l | 拉 | `/siannuntiau/siann/l/` |
| k | 家 | `/siannuntiau/siann/k/` |
| kh | 咳 | `/siannuntiau/siann/kh/` |
| g | 牙 | `/siannuntiau/siann/g/` |
| ng | 吳 | `/siannuntiau/siann/ng/` |
| h | 哈 | `/siannuntiau/siann/h/` |
| ts | 查 | `/siannuntiau/siann/ts/` |
| tsh | 差 | `/siannuntiau/siann/tsh/` |
| s | 沙 | `/siannuntiau/siann/s/` |
| j | 熱 | `/siannuntiau/siann/j/` |
| 零聲母 | 阿 | `/siannuntiau/siann/ling/` |

---

## 聲調系統 (Tones)

台語有 7 個基本聲調（第6調與第2調合併，故跳過第6調）：

| 調號 | 調名 | 調值 | 例字（IPA） | 標記法 | URL 路徑 |
|------|------|------|-------------|--------|----------|
| 第1調 | 高平調 | 55 | tong | 無符號 | `/tiau/1/` |
| 第2調 | 高升調 | 51 | tóng | ◌́ | `/tiau/2/` |
| 第3調 | 低降調 | 31 | tòng | ◌̀ | `/tiau/3/` |
| 第4調 | 高入聲 | 4h | tok | 無符號+h | `/tiau/4/` |
| 第5調 | 中平調 | 33 | tông | ◌̂ | `/tiau/5/` |
| 第7調 | 中降調 | 11 | tōng | ◌̄ | `/tiau/7/` |
| 第8調 | 低入聲 | 12h | to̍k | ◌̍ | `/tiau/8/` |

**入聲韻母（第4、8調）**: 以 `-h`, `-p`, `-t`, `-k` 結尾的韻母，如 ah, ap, at, ak, oh, ok 等。

---

## 韻母列表 (Finals/Rhymes)

韻母系統包含以下類型：

### 單母音及鼻化
- a, ah, ann, annh
- e, eh, enn, annh
- i, ih, inn
- o, oh, onn, onnh
- oo, ooh
- u, uh, un, ut
- m, mh, ng, ngh

### 複合韻母
- ai, aih, ainn
- au, auh, aunn, aunnh
- ia, iah, iann, iannh
- iau, iauh, iaunn
- io, ioh, iong, iok
- iu, iuh, iunn
- ua, uah, uann
- uai, uainn, uainnh
- ue, ueh
- ui, uih, uinn

### 鼻音韻尾
- am, ap
- an, at
- ang, ak
- iam, iap
- ian, iat
- iang, iak
- om, op
- ong, ok
- uan, uat
- uang

---

## 查詢流程範例

### 範例 1：查詢「家」字的相關資訊

1. 確定讀音：ka（聲母 k + 韻母 a + 第1調）
2. 聲母查詢：`/siannuntiau/siann/k/` → 找到韻母 "a"
3. 組合查詢：`/siannuntiau/siann/k/a/` → 看到所有聲調組合
4. 找到第1調：ka → 列出「交、佳、傀、加、咖、咳、嘉、家...」等字
5. 點擊「家」字進入詳細頁面

### 範例 2：查詢所有第1調的字

1. 聲調查詢：`/siannuntiau/tiau/1/`
2. 看到所有支援第1調的韻母清單
3. 選擇韻母 "a"：`/siannuntiau/un/a/1/`
4. 看到所有第1調 + 韻母 "a" 的音節和漢字

### 範例 3：查詢所有讀音為 "ka" 的字（所有聲調）

使用完整結果查詢：`/siannuntiau/tsong/siann/k/`
然後在結果中搜尋所有以 "k" 開頭的音節。

---

## 頁面結構說明

### 結果表格欄位

| 欄位 | 說明 |
|------|------|
| 音節 | 帶聲調符號的羅馬拼音（如 ka, ká, kà, kā） |
| 搜尋相關詞 | 該音節對應的所有漢字，每個字可點擊進入詳細頁 |

### 側邊導航

每個查詢結果頁面都包含：
- 聲母索引（快速切換不同聲母）
- 韻母索引（快速切換不同韻母）
- 聲調索引（快速切換不同聲調）
- 重新選索引（返回主索引頁）

---

## 技術備註

### URL 編碼

漢字在 URL 中使用 UTF-8 百分比編碼：
- 「家」→ `%E5%AE%B6`
- 「價」→ `%E5%83%B9`

### 聲調數字對應

在 URL 中，聲調以數字表示：
- 1 = 第1調（高平）
- 2 = 第2調（高升）
- 3 = 第3調（低降）
- 4 = 第4調（高入）
- 5 = 第5調（中平）
- 7 = 第7調（中降）
- 8 = 第8調（低入）

### 零聲母處理

零聲母（無聲母）使用 `ling` 表示：
`/siannuntiau/siann/ling/`

---

## 相關資源

- 主網站：https://sutian.moe.edu.tw/
- 聲韻調索引入口：https://sutian.moe.edu.tw/zh-hant/siannuntiau/
- 分類索引：https://sutian.moe.edu.tw/zh-hant/hunlui/
- 部首索引：https://sutian.moe.edu.tw/zh-hant/poosiu/
- 總筆畫搜尋：https://sutian.moe.edu.tw/zh-hant/tsongpitueh/
