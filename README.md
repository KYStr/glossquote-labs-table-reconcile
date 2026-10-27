# 兩份表格對帳 · Reconcile two tables

以明確的唯一鍵核對兩份本地 CSV，找出一致、僅左、僅右與欄位不同，下載完整 JSON 和文字報告。

Match two local CSV exports by an explicitly selected unique key. Review matching, left-only, right-only, and changed rows, then download complete JSON and text reports.

此 repository 是公開來源；本次沒有宣稱工具已部署或通過外部驗收。Source publication and live hosting are separate milestones. See [HANDOFF](HANDOFF.md).

## 使用範圍 / Scope

- UTF-8 comma-separated CSV with a nonempty, unique header row; up to 1 MiB, 5,000 data rows and 30 columns per file.
- 1–3 mapped key pairs and at least one compared field. Values remain exact strings: 001 and 1 are different. Optional trim applies only to key matching.
- Empty or duplicated keys stop the whole run. No guessed pairing, numeric/date normalization, XLSX, account or upload.
- Inputs and outputs stay in page memory; no browser persistence, telemetry or remote fonts. Clearing releases page references and download links, not downloaded files or secure memory erasure.
- Reports use fixed filenames table-reconcile.json and table-reconcile.txt. Both are unavailable if combined UTF-8 output exceeds 16 MiB.

## 本地重現 / Reproduce

Node.js 24+ and npm; no dependency installation is needed.

```text
npm test
npm run check
npm run build
npm run build:release
npm run check:release
```

For a local preview, npm run dev serves only 127.0.0.1:4222 and does not open a browser. public/ and dist/ are noindex previews. The production-format output is generated in release-artifacts/site/; it has the planned canonical URLs and removes exactly two preview banners. Building is offline and does not deploy anything.

wrangler.jsonc is static-only, with a UTC-safe compatibility date pinned to 2026-10-24. Its only domain is reconcile.glossquote.com; workers.dev, preview URLs, CLI metrics, logs and traces are disabled. The generated _redirects file contains exactly three 301 rules: / to /index.html, /en to /en/index.html, and /en/ to /en/index.html. The other 13 generated files are unchanged. Deployment is handled separately; this source patch has not been deployed.

## 固定來源與測試資料 / Provenance and fixtures

[SOURCE-MANIFEST.json](SOURCE-MANIFEST.json) records all 33 frozen source files. [RELEASE-MANIFEST.json](RELEASE-MANIFEST.json) is the expected generated release manifest. The current source-set is 2227cedcc178331732f49827ca8c8d2e3fb32bb54d431e1717d21f22d789a932; the expected release manifest SHA-256 is 12271529426c0330d063d0fb93cbc66575bc9ec8bdfe0185c9fe051f2051f2c8.

The tracked dist/ snapshot is required by a release regression test; it is a complete frozen preview, not private user data. evidence/m1/source-manifest.json is a relative-path-only historical public-input fingerprint required by the pin test. Tests create synthetic temporary copies and remove only their own fixtures. Generated release-artifacts/ remains ignored.

scripts/evidence.mjs is a preserved milestone archival utility whose M1 capture/verify targets historical material; it is not the current source verifier or a required package command. Use SOURCE-MANIFEST.json for the current reviewed source. Internal chat contracts, account-specific evidence and raw local logs are deliberately excluded.

Primary isolated Chromium core acceptance recorded 28 PASS, zero failures/prohibited events and 12 retained NOT_RUN items. Actual 200% browser zoom, native dialogs, physical keyboard/IME, assistive technology/real devices and heap/BFCache internals are not claimed as passed. Source and report bytes remain independently checkable; see [validation scope](HANDOFF.md).

Original product specifications are preserved for reference: [product](PRODUCT.md), [technical contract](TECHNICAL.md), [acceptance](ACCEPTANCE.md), [privacy](docs/PRIVACY-SECURITY.md). Historical specification headings do not replace the current release status.
