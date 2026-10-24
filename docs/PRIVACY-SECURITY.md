# 隱私與生命週期
輸入與產物只在當前頁記憶體，不 network/upload/storage/IndexedDB/service worker/URL/query/console/crash logs/telemetry。不載外部font/script/CDN；無帳號/API。只在使用者明確操作時由瀏覽器下載本地生成的產物。不要以本機處理宣稱無風險或安全抹除。
惡意檔名/文字以 textContent 呈現，禁止 innerHTML/eval/dynamic script。所有輸入有hard caps，先驗header/schema/size再昂貴操作。錯誤不得沿用上一個成功結果；先同步取消可下載狀態再更新來源。非同步結果綁 generation，失效結果不可復活。取消、清除、pagehide 清引用、revoke Blob URL、釋放 bitmap；不能承諾清除OS/下載資料夾/瀏覽器內存。
所有測試假資料，驗收包不含任何真實輸入、token、帳戶/瀏覽器資料。正式資料不離開使用者頁面；HTTP headers、Network、Storage 必須另外真實驗證，靜態掃描不替代。
