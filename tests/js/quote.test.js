// 引用籃排版 Quote.render：對齊粉專貼文格式（※ 前綴、「：」分隔、成對指標「出手／命中率」、→ 時間先後、vs. 並列、括號名次）
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load_bundle');
const w = load();
const Q = w.Quote;

const single = (id, label, en, value, rank, extra = {}) => ({ id, kind: 'single', subject: '灰狼全隊', context: '2026-27 例行賽',
    label, en, values: [{ tag: '', value, unit: '' }], sep: '→', rank, ...extra });
const cmp = (id, label, en, a, b, unit = '', sep = '→', tags = ['全季', '近 5 場']) => ({ id, kind: 'compare', subject: 'Anthony Edwards',
    context: '2026-27 例行賽', label, en, values: [{ tag: tags[0], value: a, unit }, { tag: tags[1], value: b, unit }], sep });

test('單值：主體｜情境（括號為聯盟排名）＋ ※指標：值（第N）', () => {
    assert.equal(Q.render([single('a', '得分', 'PTS', '116.7', { rank: 9, n: 30 }), single('b', '籃板', 'REB', '48.6', { rank: 1, n: 30 })]),
        '灰狼全隊｜2026-27 例行賽（括號為聯盟排名）\n※得分：116.7（第9）\n※籃板：48.6（第1）');
});

test('名次開關關掉就不帶名次', () => {
    assert.equal(Q.render([single('a', '得分', 'PTS', '116.7', { rank: 9, n: 30 })], { rank: false }), '灰狼全隊｜2026-27 例行賽\n※得分：116.7');
});

test('前後比較用 →', () => {
    assert.equal(Q.render([cmp('c', '三分命中率', '3P%', '35.1', '38.0', '%')]),
        'Anthony Edwards｜2026-27 例行賽：全季 → 近 5 場\n※三分命中率：35.1% → 38.0%');
});

test('並列比較用 vs.', () => {
    const v = { ...cmp('v', '得分', 'PTS', '118.0', '115.2', '', 'vs.', ['主場', '客場']), subject: '灰狼全隊', context: '2026-27' };
    assert.equal(Q.render([v]), '（以下為 灰狼全隊｜2026-27，主場 vs. 客場）\n※得分：118.0 vs. 115.2');
});

test('成對指標合併成「出手／命中率」', () => {
    const fga = cmp('d', '三分出手', '3PA', '8.2', '9.4'), pct = cmp('c', '三分命中率', '3P%', '35.1', '38.0', '%');
    assert.equal(Q.canMerge(fga, pct), true);
    assert.equal(Q.render([{ id: 'm', kind: 'compare', subject: 'Anthony Edwards', context: '2026-27 例行賽', sep: '→', parts: [fga, pct] }]),
        'Anthony Edwards｜2026-27 例行賽：全季 → 近 5 場\n※三分出手／三分命中率：8.2／35.1% → 9.4／38.0%');
});

test('段標頭預設不加「●」（使用者文章的「●」是小節標題）', () => {
    assert.equal(Q.DEFAULT_OPTS.bullet, '');
    assert.equal(Q.DEFAULT_OPTS.prefix, '※');
});

test('引用籃裡有一筆壞資料不會整個壞掉（只丟掉那筆）', () => {
    const w2 = load({ storage: { wt_quote_v1: JSON.stringify([{ x: 1 }, single('ok', '得分', 'PTS', '10', null), null]) } });
    assert.deepEqual(JSON.parse(JSON.stringify(w2.Quote.items().map(i => i.id))), ['ok']);
    assert.doesNotThrow(() => w2.Quote.render(w2.Quote.items()));
});
