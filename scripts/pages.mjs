import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COPY } from '../public/js/i18n.mjs';
import { ROOT } from './files.mjs';

const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
export function makePage(language) {
  const m = COPY[language];
  const e = key => escape(m[key]);
  const english = language === 'en';
  const side = id => `<div class="source"><label for="file-${id}">${e(`${id}File`)}</label><input id="file-${id}" type="file" accept=".csv,text/csv" aria-describedby="file-limits meta-${id} error-${id}"><p id="meta-${id}" class="file-meta">${e('noFile')}</p><p id="error-${id}" class="field-error"></p></div>`;
  const filters = ['same', 'leftOnly', 'rightOnly', 'changed'].map(category => `<button type="button" data-category="${category}" aria-pressed="false" disabled>${e(category)} <span id="count-${category}">0</span></button>`).join('\n');
  const faq = m.faq.map(([q, a]) => `<details><summary>${escape(q)}</summary><p>${escape(a)}</p></details>`).join('\n');
  return `<!doctype html>
<html lang="${language}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <meta name="description" content="${e('description')}">
  <title>${e('title')}</title>
  <link rel="stylesheet" href="/styles/app.css">
  <script type="module" src="/js/app.js"></script>
</head>
<body>
  <a class="skip" href="#workspace">${e('skip')}</a>
  <header class="topbar"><span class="product">${e('product')}</span><nav aria-label="${english ? 'Product and language' : '產品與語言'}"><a href="${english ? 'https://glossquote.com/en/index.html' : 'https://glossquote.com/index.html'}">${e('home')}</a><a href="${english ? '/index.html' : '/en/index.html'}" lang="${english ? 'zh-TW' : 'en'}" aria-label="${e('switchLabel')}">${e('switchText')}</a></nav></header>
  <div class="shell">
    <nav class="steps" aria-label="${e('stepNav')}"><a href="#files">${e('files')}</a><a href="#mapping">${e('mapping')}</a><a href="#results">${e('results')}</a></nav>
    <main id="workspace" class="canvas">
      <div class="introduction"><p class="preview">${e('preview')}</p><h1>${e('h1')}</h1><p>${e('intro')}</p></div>
      <noscript><p class="notice">${english ? 'Enable JavaScript to process CSV files locally in this page.' : '請啟用 JavaScript，才能在此頁本地處理 CSV。'}</p></noscript>
      <section id="files" aria-labelledby="file-heading"><h2 id="file-heading">${e('fileHeading')}</h2><p id="file-limits" class="help">${e('fileHelp')}</p><div class="sources">${side('left')}${side('right')}</div></section>
      <section id="mapping" aria-labelledby="map-heading">
        <h2 id="map-heading">${e('mapHeading')}</h2><p id="mapping-empty" class="empty">${e('mapEmpty')}</p>
        <div id="mapping-content" hidden><p class="help">${e('mapHelp')}</p>
          <fieldset id="mapping-controls" disabled><legend class="sr-only">${e('mapping')}</legend>
            <h3>${e('keyHeading')}</h3><p id="key-help" class="help">${e('keyHelp')}</p><div id="key-pairs"></div><button type="button" id="add-key" class="quiet">${e('addKey')}</button>
            <h3>${e('compareHeading')}</h3><p id="field-help" class="help">${e('compareHelp')}</p><div id="field-pairs"></div><button type="button" id="add-field" class="quiet">${e('addField')}</button>
            <details class="settings"><summary>${e('settings')}</summary><label for="key-mode">${e('keyMode')}</label><select id="key-mode" aria-describedby="trim-help"><option value="exact">${e('exact')}</option><option value="trim">${e('trim')}</option></select><p id="trim-help" class="help">${e('trimHelp')}</p></details>
            <details class="samples"><summary>${e('samples')}</summary><div class="sample-columns"><div id="sample-left"></div><div id="sample-right"></div></div></details>
            <label class="confirmation"><input id="confirm-mapping" type="checkbox" aria-describedby="mapping-feedback"><span>${e('confirm')}</span></label><p id="mapping-feedback" class="help"></p>
          </fieldset>
        </div>
        <div class="actions"><button id="run" class="primary" type="button" disabled>${e('run')}</button><button id="cancel" type="button" hidden>${e('cancel')}</button><button id="reset" class="quiet" type="button">${e('reset')}</button></div>
        <p id="status" role="status" aria-live="polite" aria-atomic="true">${e('idle')}</p><progress id="progress" hidden max="1" value="0" aria-label="${e('comparing')}"></progress>
        <div id="error-box" class="notice error" hidden><h3>${e('errorHeading')}</h3><p id="work-error"></p><p id="key-summary" class="data"></p></div>
      </section>
      <section id="results" aria-labelledby="result-heading"><h2 id="result-heading">${e('resultHeading')}</h2><p id="result-summary" class="empty">${e('resultEmpty')}</p>
        <div class="categories" role="group" aria-label="${e('categoryLabel')}">${filters}</div>
        <div id="result-content" hidden><p class="help">${e('resultHint')}</p><div id="result-table" class="table-region" role="region" tabindex="0" aria-label="${e('resultRegion')}"></div><div class="pager"><button id="prev" type="button">${e('prev')}</button><p id="page-position"></p><button id="next" type="button">${e('next')}</button></div></div>
        <div id="export-controls" hidden><p class="help">${e('downloadHint')}</p><button id="prepare" type="button" class="primary">${e('prepare')}</button><div class="downloads"><a id="download-json" class="button" download="table-reconcile.json" hidden>${e('downloadJson')}</a><a id="download-text" class="button" download="table-reconcile.txt" hidden>${e('downloadText')}</a></div></div>
      </section>
      <section class="reading" aria-labelledby="privacy-heading"><h2 id="privacy-heading">${e('privacyHeading')}</h2><p>${e('privacy')}</p></section>
      <section class="reading faq" aria-labelledby="help-heading"><h2 id="help-heading">${e('helpHeading')}</h2>${faq}</section>
      <footer>Gloss Tools by GlossQuote</footer>
    </main>
  </div>
</body>
</html>
`;
}
export async function verifyPages() {
  for (const [lang, path] of [['zh-TW', 'index.html'], ['en', 'en/index.html']]) if (await readFile(join(ROOT, 'public', path), 'utf8') !== makePage(lang)) throw new Error('STATIC_PAGE_DRIFT');
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  if (process.argv.includes('--check')) await verifyPages();
  else for (const [lang, path] of [['zh-TW', 'index.html'], ['en', 'en/index.html']]) await writeFile(join(ROOT, 'public', path), makePage(lang));
}
