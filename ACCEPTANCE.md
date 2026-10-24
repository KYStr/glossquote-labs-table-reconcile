# 驗收 oracle：兩份表格對帳

狀態：規格，尚未實作。以下是將來的驗收資料，不是本產品測試結果。純函式案例用合成 UTF-8 bytes，禁止讀取真實使用者資料。

## 自動 oracle

1. **A01 FR-01 parse-basic** — 左 `id,v\r\n001,A\r\n002,B`，右 `id,v\n001,A\n003,C`；解析列數各 2、值維持字串、不同檔允許各自選 CRLF/LF。
2. **A02 FR-01 quoted** — bytes `id,note\r\n1,"a,b"\r\n2,"x""y"`；rows 值精確為 `[['1','a,b'],['2','x"y']]`。
3. **A03 FR-01 multiline** — `id,note\r\n1,"a\r\nb"`；第二欄為 `a\r\nb`，row index 是 1 而非實體行號。
4. **A04 FR-01 malformed quote** — `id,v\n1,"open`；得到 `CSV_SYNTAX`，無 rows 可供後續對帳。
5. **A05 FR-01 width** — `id,v\n1,A,B`；得到 `ROW_WIDTH`，record 1，不補欄也不截欄。
6. **A06 FR-01 byte cap** — bytes 恰為 1,048,576 且合法可解析；接受。1,048,577 bytes；`FILE_TOO_LARGE`，解析器未 decode。
7. **A07 FR-02 headers** — 標題 `id,id` 或 `,value`；拒絕 `HEADER_EMPTY_OR_DUPLICATE`；` id` 和 `id` 是不同欄名。
8. **A08 FR-03 left-only/right-only/same** — 左 `id,v:001,A;002,B`、右 `001,A;003,C`，key/field 各映射 `id↔id`,`v↔v`；same `[001]` has leftRow=1/rightRow=1; leftOnly `[002]` has leftRow=2; rightOnly `[003]` has rightRow=2; changed empty.
9. **A09 FR-04 changed** — 左 `001,A`、右 `001,X`；changed 一筆，fields 精確是 `[{left:'v',right:'v',leftValue:'A',rightValue:'X'}]`。
10. **A10 FR-03 string exact** — 左 key `001`、右 key `1`；結果 leftOnly `001` + rightOnly `1`，不得數值合併。
11. **A11 FR-03 tuple collision defense** — 左 tuple `['a|b','c']`、右 `['a','b|c']`；必須分成兩個 key，不得因 delimiter 碰撞。
12. **A12 FR-03 duplicate** — 左 key `x` 出現在 data index 1、2；拒絕 `KEY_DUPLICATE` 並回報這兩個 index，沒有任何分類結果。
13. **A13 FR-03 trim revalidation** — 左 key `x`、` x ` 並選 trim；兩列 trim 後衝突，拒絕。exact mode 則兩列可唯一，輸出不改原字串。
14. **A14 FR-03 empty key** — key 欄為 `""`；exact 拒絕；key 值為三個空白且選 trim 也拒絕。
15. **A15 FR-04 compare exact** — compare value 左 `1`、右 `1.0`；分類 changed，沒有數字格式正規化。
16. **A16 FR-05 hostile text** — cell value `<img src=x onerror=alert(1)>`；原字串保留在結果／JSON，UI 顯示文字；沒有事件、網路請求或 HTML 節點執行。
17. **A17 FR-06 JSON schema** — leftOnly row 原值 `['A','line\n"quoted"']`；JSON parse round-trip 後值相同，`schemaVersion===1`、`tool==='table-reconcile'`，檔名固定。
18. **A18 FR-06 output limit** — JSON+TXT combined UTF-8 bytes exactly 16 MiB accepts and both files are available; combined bytes 16 MiB+1 returns `OUTPUT_TOO_LARGE`, creates neither Blob and clears both old-generation outputs.
19. **A19 FR-01 row cap** — 5,000 data rows 可解析；5,001 筆拒絕 `TOO_MANY_ROWS`，標題不計入上限。
20. **A20 FR-02 column cap** — 30 欄接受，31 欄拒絕 `TOO_MANY_COLUMNS`。
21. **A21 FR-07 real cancellation between batches** — reconcile 201 left rows against 201 right rows with batchSize=100; first `iterator.next()` yields `{stage:'left-index',processed:100,total:201}` after a task yield. Abort before requesting next step; next call throws `CANCELLED`, returns no result and exposes no partial classification arrays.

## 必須人工／瀏覽器驗收

- 對檔案選擇、錯誤定位、tab 順序、320px、200% zoom、鍵盤完成全流程、下載、2000+列長內容與 stale 後下載 disabled 做真瀏覽器檢查。
- 本階段真瀏覽器驗收：**NOT_RUN_USER_FOCUS_INCIDENT**。依全域 focus incident 不操作使用者桌面、瀏覽器或原有分頁；Node tests 不能替代這些檢查。
- 離線性檢查可在網路封鎖的本機測試環境進行；檢查 Network 面板無外連屬於瀏覽器 gate，本文件目前標 **NOT_RUN**。
- 取消、`pagehide` 後 Blob URL 清理以可注入 URL/Abort fake 做單元測試；真實頁面生命週期仍需 browser gate。
