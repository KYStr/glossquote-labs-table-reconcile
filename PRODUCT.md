# 產品需求：兩份表格對帳

狀態：規格，尚未實作。目標使用者是需要把兩個系統匯出清單對起來的會計助理或營運人員。核心成功條件是使用者能指出每個差異來自哪個來源列，且不會把不同 key 靜默合併。

## MVP 與明確決策

- 只接受兩個 UTF-8 CSV 檔，每個必須有唯一、非空標題列；第一個 UTF-8 BOM 可移除。
- 每邊原始檔最多 1 MiB、資料列最多 5,000、欄最多 30。欄位值保留成 JavaScript 字串；不做數字、日期、大小寫或 Unicode 正規化。
- 介面先自動建議兩邊名稱完全相同的欄位配對，使用者確認。左右欄名可不同；每個欄只能配一次。至少選一組比較欄，key 欄可不納入比較欄。
- 唯一鍵為 1–3 組左右欄位對照。預設 `exact`。可明確選「只對 key 值 trim 前後空白」；資料原值仍保留，且 trim 後重新驗證空鍵／重複鍵。比較欄一律原字串比較。
- 一個來源中出現空 key 或重複 key，整次對帳停止；不配對、不產生部分下載。
- 確認結果後可下載固定名稱 `table-reconcile.json` 及 `table-reconcile.txt`。兩種產物 UTF-8 bytes 合計上限 16 MiB；若任一產物或合計超限，整批匯出失敗、兩個下載均不可用，且清除舊輸出 Blob，不提供截斷或僅下載其中一種。頁面對帳結果仍可讀；可減少來源列後重新跑。
- 所有處理在當前頁面記憶體；不寫 localStorage、IndexedDB、Cookie、服務端或遙測。重設／頁面離開清除引用與 Blob URL。

## 功能需求

### FR-01：載入與界線

使用者選擇左、右 CSV 後，顯示檔名（純文字）、大小及解析狀態。每個檔上限 1,048,576 bytes；超過立即拒絕，不先完整解碼。總列數為標題後最多 5,000 筆，欄最多 30。超過上限不進入映射步驟。空檔、只有空白內容、非有效 UTF-8、二進位或解析不完整都要指出來源及行／記錄位置。

CSV dialect：以 RFC 4180 的逗號、雙引號包欄、`""` escape 和引用欄內換行為基礎；接受外部記錄分隔符 CRLF、LF 或 CR，但不接受同一檔內不同分隔符混用。引用欄可包含逗號及換行。未閉合 quote、未引用欄位中 quote、結束 quote 後非逗號／記錄分隔符、欄數不一均拒絕。忽略檔案開頭單一 BOM；不 trim 欄名或值。只允許最後一個 record terminator，不把它解讀成額外空白列；中間空行是單欄空記錄，因欄數不合而拒絕。

### FR-02：標題和映射

欄名以 CSV 解碼後字串逐字處理；空字串、重複欄名拒絕。映射清單為 `{leftColumn,rightColumn}`；每一側不得重複使用同一欄。UI 列出全部欄名及左右樣本值，以文字節點呈現。選定 1–3 組 key 和至少一組 compare pair 後才可開始。若同一欄被同時選為 key 與 compare，不視為錯誤：key 仍以 key 規則比對，compare 仍顯示原值差異。

### FR-03：建立唯一鍵與拒絕歧義

每列 key tuple 由各 key 欄解碼值依欄位順序組成。`exact` 用原字串。`trim` 僅對 key tuple 每格套用 `String.prototype.trim()`；不改資料 row。任一 tuple 成員為空字串（trim 時以 trim 後結果判定）或同側 tuple 重複，顯示來源、資料列 index、衝突 key 文字摘要並停止。不得用 delimiter 串接 tuple；必須以欄位長度或 JSON tuple 編碼，避免 `['a|b','c']` 與 `['a','b|c']` 碰撞。

### FR-04：精確對齊與分類

先以左側資料列順序掃描：沒有右列則 `leftOnly`；找到右列則逐一比較 compare pairs，無差異為 `same`，有差異為 `changed` 並列出所有不同 pair。最後依右側原順序補上尚未出現的 `rightOnly`。左右 row index 從資料列第一筆起算為 1，不是實體行號，因欄位可以換行。計數必須滿足四類筆數總和等於 `max(leftRows,rightRows)` 以外並不成立；正確不變條件是分類中的 matched pairs 不重複、left-side coverage = left row count、right-side coverage = right row count。

### FR-05：檢視與無損差異資料

結果檢視提供總覽與四個可切換區段：一致、僅左、僅右、欄位不同。每列顯示 key、左右資料列、差異欄和左右值；內容以純文字呈現。長值可展開但不可預設截斷下載資料。當任一分類為 0 時顯示 `0 筆`，不隱藏分類。

### FR-06：輸出

JSON schemaVersion 固定為 1，欄位如下。此例對應左 `001,A;002,B`、右 `001,A;003,C`，所以四類互斥且計數相符：

```json
{
  "schemaVersion": 1,
  "tool": "table-reconcile",
  "options": {
    "keyMode": "exact",
    "keys": [{"left": "id", "right": "id"}],
    "fields": [{"left": "amount", "right": "amount"}]
  },
  "counts": {"leftRows": 2, "rightRows": 2, "same": 1, "leftOnly": 1, "rightOnly": 1, "changed": 0},
  "same": [{"key": ["001"], "leftRow": 1, "rightRow": 1}],
  "leftOnly": [{"key": ["002"], "leftRow": 2, "left": ["002", "A"]}],
  "rightOnly": [{"key": ["003"], "rightRow": 2, "right": ["003", "C"]}],
  "changed": []
}
```

`same` 不重複放原資料以減小結果；changed/only 陣列含完整該側 row 字串陣列。另一個獨立 changed 例子：若左右同 key `001` 的 v 分別是 `A`、`X`，該 key 只在 `changed` 出現，欄位差異為 `[{"left":"v","right":"v","leftValue":"A","rightValue":"X"}]`。TXT 包含固定標題、設定摘要、筆數和四分類資料；以 JSON-stringified 風格引號顯示字串，避免換行／控制字元混淆。JSON 和 TXT UTF-8 bytes 合計在建立任一 Blob 前驗證 ≤16 MiB；超限則兩者都不輸出，也不留下先前 generation 的 Blob。兩種檔案名固定，不使用來源檔名。

### FR-07：處理中、取消和過期結果

狀態為 `idle → loading → mapping → ready → comparing → result`，任何檔案、映射、keyMode 或比較欄變更都使結果轉為 `stale` 並立即禁用下載。執行比較時顯示掃描列數並有「取消」；取消後不保留部分分類，不可下載，回到 mapping。每次輸入變更遞增 generation；舊工作即使晚回也不得覆蓋新狀態。重設清空檔案物件、解析表、輸出與 Blob URL。

## 錯誤與隱私

錯誤分為 `FILE_TOO_LARGE`、`INVALID_UTF8`、`CSV_SYNTAX`、`ROW_WIDTH`、`HEADER_EMPTY_OR_DUPLICATE`、`TOO_MANY_ROWS`、`TOO_MANY_COLUMNS`、`MAPPING_INVALID`、`KEY_EMPTY`、`KEY_DUPLICATE`、`OUTPUT_TOO_LARGE`、`CANCELLED`。訊息包括檔案側、可定位 row/欄名和修復行動，但不暴露堆疊或原始內容。檔案不離開本機頁面；使用者自行下載是唯一持久化路徑。

## 非目標與未來

MVP 不支援 XLSX、多工作表、模糊配對、公式／格式、日期容差、金額加總、資料庫連線或同步。未來若提議新增正規化，需讓使用者逐條選規則並在對帳前預覽；不可改變此版 exact 預設。
