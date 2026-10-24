# 工程與發布基線
Node24+ ESM 原生 builtins，原生 HTML/CSS/JS；零 runtime/dev 依賴。核心純函式不得 DOM/網路/storage。純測試有手寫精確期望、拒絕邊界、不變式；不得用被測結果產生 expected。
package.json private=true/type=module/engines >=24；npm test=node --test test/*.test.mjs；check/build/dev 各 scripts/*.mjs。T00 建腳本後才引用命令。check 實查必要檔案、ESM 語法、不允許外部資源/危險DOM。regex 掃描非安全證明。
build 閉合 public allowlist；拒絕 symlink/junction、未知檔、traversal/stale；不得刪未知輸出來湊成功，證據/文件/測試不進 dist。preview dist 必須 noindex。production dist-production 與 preview 分開，M2 才建立正式 URL/release 介面。
dev 127.0.0.1:4222，GET/HEAD、精確路由與 MIME，未知404、method405、Host拒絕、防path traversal，不SPA fallback/serve workspace。不要開瀏覽器。不留背景程序未交接。
未來 production 必須驗證完整 HTML title/description/H1/canonical/hreflang zh-Hant/en/x-default、index follow、robots/sitemap、安全headers，並做語義反例；不能只hash manifest 或局部 head regex 就說真實正確。資訊只靜態本地資產，不含遠端字型/追蹤。
原生/真機/實際 browser 與 Node/HTTP/靜態分開記錄。必要check對最終固定輸入跑一次，修改後重跑受影響項。其他安全要求見 AGENTS 與 PRIVACY-SECURITY。
