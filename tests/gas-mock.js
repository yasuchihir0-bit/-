// Google Apps Script の部品（スプレッドシートなど）を、メモリ上の簡単なものに置きかえて、Code.gs をそのまま動かす
const fs = require('fs');
const path = require('path');
const vm = require('vm');

/* rawCode を渡すと、そのプログラムをそのまま動かす（保護者画面の案内がコピーさせたものを試すとき） */
function makeEnv(secret, readSecret, rawCode) {
  const sheets = {};
  const formats = [];
  const props = {};
  class Sheet {
    constructor(name) { this.name = name; this.data = []; this.frozen = 0; }
    getLastRow() { return this.data.length; }
    getRange(r, c, nr = 1, nc = 1) {
      const sh = this;
      return {
        getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => (sh.data[r - 1 + i] || [])[c - 1 + j] ?? '')),
        setValues(v) { v.forEach((row, i) => row.forEach((x, j) => { (sh.data[r - 1 + i] = sh.data[r - 1 + i] || [])[c - 1 + j] = x; })); return this; },
        setNumberFormat(f) { formats.push({ sheet: sh.name, r, c, nr, nc, f }); return this; },
        setFontWeight() { return this; },
      };
    }
    setFrozenRows(n) { this.frozen = n; }
    setColumnWidth() {}
  }
  const ctx = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ({
      getSheetByName: (n) => sheets[n] || null,
      insertSheet: (n) => (sheets[n] = new Sheet(n)),
    }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = v; } }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (s) => ({ s, setMimeType() { return this; } }) },
    console,
  };
  vm.createContext(ctx);
  let code = rawCode || fs.readFileSync(path.join(__dirname, '..', 'tools', 'apps-script', 'Code.gs'), 'utf8');
  if (secret) code = code.replace("const SECRET = 'ここを合言葉に書きかえる';", `const SECRET = '${secret}';`);
  if (readSecret) code = code.replace("const READ_SECRET = '';", `const READ_SECRET = '${readSecret}';`);
  vm.runInContext(code, ctx);
  const post = (obj) => JSON.parse(vm.runInContext('doPost', ctx)({ postData: { contents: typeof obj === 'string' ? obj : JSON.stringify(obj) } }).s);
  return { ctx, sheets, formats, props, post };
}

module.exports = { makeEnv };
