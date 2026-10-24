# 介面與搜尋資料：兩份表格對帳

狀態：規格，尚未實作。Surface mode：Product App。M1 為本機候選版，`robots` 使用 `noindex,nofollow`，不輸出正式 canonical 或 sitemap；`reconcile.glossquote.com` 僅是 selection 候選網址，未獲主驗與發布閘門前不得宣稱上線。

## 搜尋文案

**繁中 title：** 兩份 CSV 表格對帳｜找出缺列與欄位差異  
**繁中 description：** 在本機用唯一鍵核對兩份 CSV，找出一致、僅左、僅右及不同欄位，下載差異報告與 JSON。  
**繁中 H1：** 把兩份清單逐列對起來

**English title:** Compare Two CSV Tables | Find Missing and Changed Rows  
**English description:** Match two local CSV files by a unique key. Review same, left-only, right-only, and changed rows, then download a report and JSON.  
**English H1:** See exactly what changed between two lists

頁面語言按明確的 `zh-TW` / `en` 切換，不機翻欄位資料。應用只提供一個主要工作區；左、右檔案與映射是連續步驟，不做 generic dashboard。

## 版面線框

桌面 Wide（≥75rem）：

```text
┌────────────── 兩份表格對帳 ─────── zh-TW | 準備中 ────────────────┐
│步驟 1 檔案   │                  對帳工作區                 │ 檢視設定│
│左側 CSV     │ 左檔 [選擇檔案] 右檔 [選擇檔案]               │ key模式│
│右側 CSV     │ 左右欄位樣本與逐欄 mapping                    │ exact  │
│欄位配對     │ key tuple [左欄 ↔ 右欄] [+ 欄位]               │ 比較欄 │
│差異結果     │ compare pairs；顯示 record/column 上限          │        │
│             │ [開始對帳]                                     │        │
├─────────────┴──────────────────────────────────────────────────┴──────┤
│ 結果：一致 | 僅左 | 僅右 | 不同欄位；下載 JSON / 文字報告              │
└───────────────────────────────────────────────────────────────────────┘
```

Compact（<48rem）：

```text
┌─ 兩份表格對帳 ─ 狀態 ─┐
│ 步驟：選檔 → 配對 → 結果│
│ [左側 CSV 選檔]       │
│ [右側 CSV 選檔]       │
│ 左右欄位配對          │
│ key 組 / 比較欄       │
│ [開始對帳]            │
│ 結果分類（單欄工作區）│
│ [下載 JSON] [下載 TXT]│
└───────────────────────┘
```

Compact 優先顯示工作區；檔案步驟、設定和結果以可見文字導覽切換。結果表可在帶標籤的內部區域水平捲動；整頁不可水平捲動。排序和欄位配對不得僅靠拖放。

## 位置層級與操作

- 常見操作：檔案狀態、選 key、選 compare fields、開始對帳、下載結果。
- 相鄰資訊：來源樣本、欄位數、列數、錯誤記錄位置、每列左右值。
- 進階選項：key trim 在「對帳設定」中，預設關閉並解釋它只改 key 判斷；每次切換立即標 stale。
- 狀態語句：idle「選兩份 CSV 開始。」；loading「正在解析左側檔案…」；mapping「請確認哪些欄位代表同一資料。」；running「正在比對第 200 / 1,000 列…［取消］」；success「對帳完成：1 一致、1 僅左、1 僅右、0 欄位不同。」；empty「沒有資料列；請確認匯出檔是否只有標題。」；blocked duplicate key「左側第 2、5 筆的 key 重複，未產生結果。請修正來源或選真正唯一的欄位。」；stale「設定或來源已變更，請重新對帳。」；unsupported「此檔案不是本工具接受的 UTF-8 CSV。」

## 無障礙要求

標題與標籤常駐；表格用 `<table>` 語意標記欄標題，來源內容一律文字呈現。錯誤 `aria-describedby` 到相關欄位，狀態透過單一 `aria-live="polite"` 宣告，不逐筆朗讀。Tab 順序為左檔、右檔、key mapping、compare mapping、開始、結果分類、下載。支援 320 CSS px、200% zoom、44×44px 主要觸控區、明顯雙層 focus、對比至少 4.5:1 和 `prefers-reduced-motion`。不要求拖曳。

## FAQ 文案

### 繁體中文

**會把 `001` 和 `1` 當相同嗎？**  不會。預設把所有值當字串逐字比較。  
**需要上傳帳號嗎？**  不需要；檔案在目前頁面記憶體中處理。  
**有重複編號怎麼辦？**  工具會停止對帳並指出衝突資料列，不會任意配對。

### English

**Will it treat `001` and `1` as the same key?** No. Values are compared as exact strings by default.  
**Do I need to upload my files to an account?** No. The page processes selected files in memory.  
**What happens when a key is duplicated?** Reconciliation stops and identifies the conflicting rows; it never guesses a pairing.

## 真實驗收界線

Node tests can verify parser, classification, serialization and state invalidation contracts. Browser checks for keyboard navigation, 320px reflow, 200% zoom, download behavior, screen-reader announcements, and actual selected-file retention are **NOT_RUN_USER_FOCUS_INCIDENT** until an isolated browser execution surface is approved by the primary. Never describe them as passed from Node results.
