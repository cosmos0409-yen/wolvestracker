// Python 契約測試用：從 stdin 讀一段函式本體，以 (w) => { … } 在載入打包檔的沙盒裡執行，結果以 JSON 印到 stdout
'use strict';
const load = require('./load_bundle');
let body = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { body += c; });
process.stdin.on('end', () => {
    const w = load();
    const fn = new Function('w', body);
    process.stdout.write(JSON.stringify(fn(w)));
});
