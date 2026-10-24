# 技術契約：兩份表格對帳

狀態：規格，尚未實作。本專案使用原生 HTML/CSS/瀏覽器 ESM、Node.js 24+ 內建模組與 `node:test`；runtime 零套件，Node 僅供本機開發、測試與建置。正式候選是靜態瀏覽器工具。禁止 CDN、外部字型、框架、遙測、服務端上傳和兄弟專案 API。

## 建議檔案樹

```text
package.json
public/index.html
public/styles/app.css
public/js/app.js
public/js/core/csv.mjs
public/js/core/reconcile.mjs
public/js/core/export.mjs
scripts/serve.mjs
scripts/check.mjs
scripts/build.mjs
test/csv.test.mjs
test/reconcile.test.mjs
test/export.test.mjs
```

遵守 `docs/ENGINEERING.md`、`docs/PRIVACY-SECURITY.md`、`docs/DESIGN-SYSTEM.md`。T00 才建立 package scripts；本規格不含實作。

## 純函式介面

```js
parseCsv(bytes, { maxBytes, maxRows, maxColumns })
// -> { headers: string[], rows: string[][] } | throws CsvError(code, record, column)

validateMappings(left, right, { keys, fields, keyMode })
// -> { ok: true } | { ok: false, issues: Issue[] }

reconcileSteps(left, right, { keys, fields, keyMode }, { signal, batchSize:100 })
// -> AsyncGenerator<Progress, ReconcileResult, void>

serializeResult(result, options, { maxOutputBytes })
// -> { json: Uint8Array, text: Uint8Array } | throws OutputLimitError
```

CSV parser採 byte limit first，使用 `TextDecoder('utf-8',{fatal:true})`；只剝除最前面的 U+FEFF。Parser 是狀態機（fieldStart / unquoted / quoted / afterQuote），以 code unit 掃描並累積欄位；CRLF/LF/CR 只可選一種 record separator，quoted state 內允許各換行原樣進入欄值。結尾分隔符不新增 record。檢查每欄 count、每筆寬度和最大資料列，遇錯立即回傳確定錯碼與 record index，不保留被拒的 parser 中間資料。

Tuple map key 使用 `JSON.stringify(keyValues)`，每個元素必為 string；空字串先拒絕。兩側各建 `Map<tuple,rowRef>`；重複即中止並回報兩個 data index。trim mode 只將 tuple input 做 `.trim()`；保留原始 row。未嘗試 locale compare、數值解析、大小寫轉換或 NFC。

Comparison計算：建立右 key map；依左 rows 順序判斷 absent/changed/same，對每組 fields 作嚴格 `===`；最後掃右 rows 補 unmatched key。結果 arrays 不因排序或本機語言改序。資料輸出採穩定 JSON property insertion order 和 UTF-8；HTML 使用 `textContent`，絕不把來源字串插進 `innerHTML`。

## 非同步包裝與記憶體

`reconcileSteps` 是唯一供 UI 使用的核心。它分兩階段掃描 left index 與 right comparison，每處理最多 100 rows 先 `await new Promise(resolve => setTimeout(resolve,0))`，再 yield `{stage,processed,total}`；最後以 generator return value 回傳完整結果。UI 用手動 `iterator.next()` 迴圈取進度；每個 chunk 間瀏覽器 event loop 能處理使用者取消。AbortSignal 在每次 yield 前後檢查，取消時 throw 固定 `CANCELLED` 並丟棄全部 partial arrays。不可先同步跑完全表，再用 UI 假造進度；也不另做 UI 會呼叫的同步全量版本。每個 await 後同時檢查 signal 和 monotonically increasing generation token。檔案選取、映射、trim 選項變更皆先清 result/state，之後才排新工作。避免把 raw inputs 再複製多份；只保留 2 個解析 row arrays 和必要分類輸出。

下載前先以 `TextEncoder` 產生 JSON 與 TXT bytes，兩者 byte length 合計 ≤16 MiB 才允許同時建立兩個 Blob；任一超限即兩者都不建，清除舊輸出 Blob。建立 Blob URL 後，替換輸出／重設／`pagehide` 時 `URL.revokeObjectURL` 並移除 anchor。輸入 file refs、parsed tables、output bytes 在 reset 後設為 null；不存 IndexedDB、localStorage、sessionStorage。離頁時取消當前 work。

## 狀態與錯誤

`idle → loading → mapping → ready → comparing → result`; 中途錯誤為 `blocked` 或可復原 `error`。資料更動先將 `result` 改成 `stale`，並同步停用下載。`AbortController.abort()` 不構成失敗，狀態回 `mapping`。錯誤只有固定 code、來源側、row/column 數字，不記錄原始單元格。

## 本機命令契約

`package.json`：`"type":"module"`、`"private":true`；不加 dependency。命令為 `npm test` (`node --test`)、`npm run check` (`node scripts/check.mjs`)、`npm run build` (`node scripts/build.mjs`)。`npm run dev` 綁 `127.0.0.1:4222` 且只提供 `public/`。Build 只複製核准過的 `public/` 到 `dist/`，絕不複製 docs、test、fixture 或使用者輸入。使用 Node 24+，不得 npm install。

## 官方參考

- [RFC 4180: Common Format and MIME Type for CSV Files](https://www.rfc-editor.org/rfc/rfc4180.html)。其說明 CSV 社群常見形式，也承認不同實作有差異；本工具採本文件明定的嚴格方言，不宣稱涵蓋所有 CSV。
- [WHATWG Encoding Standard](https://encoding.spec.whatwg.org/)：`TextDecoder` 的 UTF-8 解碼基礎。
- [WHATWG HTML: Blob URL](https://html.spec.whatwg.org/multipage/urls-and-fetching.html#blob-urls)：輸出下載生命週期參考。
