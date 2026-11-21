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

// ── 全域期間的引用寫法（periodFilter 的 cite、citeLine／Quote.make 讀 CiteCtx.period／periodEnd）──
test('期間的引用寫法：日期區間「A 至 B」、只有開始日「A 起」、只有結束日「至 B」，其他照畫面標籤', () => {
    const P = w.Period, gs = [{ date: '2026-11-05', wl: 'W', matchup: 'MIN vs. DEN', stats: {} }];
    assert.equal(P.apply(gs, { kind: 'range', start: '2026-11-01', end: '2026-11-17' }).cite, '2026-11-01 至 2026-11-17');
    assert.equal(P.apply(gs, { kind: 'range', start: '2026-11-01', end: '' }).cite, '2026-11-01 起');
    assert.equal(P.apply(gs, { kind: 'range', start: '', end: '2026-11-17' }).cite, '至 2026-11-17');
    assert.equal(P.apply(gs, { kind: 'last10' }).cite, '近 10 場');
    assert.equal(P.apply(gs, { kind: 'range', start: '2026-11-01', end: '2026-11-17' }).label, '2026-11-01~2026-11-17');   // 畫面維持短寫法
});

test('citeLine：篩選中附「期間（N 場）」，有結束日不寫截至；近似值加註；身分列（periodless）不附期間', () => {
    w.location = { origin: 'https://x', pathname: '/', hash: '' };
    const base = { subject: 'Minnesota Timberwolves', season: '2026-27 例行賽', asOfSnap: '2026-11-19', asOfAgg: '2026-11-19', isHistory: false };
    w.CiteCtx = { ...base, period: '2026-11-01 至 2026-11-17（8 場）', periodLabel: '2026-11-01~2026-11-17', periodEnd: '2026-11-17' };
    const line = w.UI.citeLine({ label: '得分', en: 'PTS', value: '110.0', gkey: 'PTS', asOf: 'agg' });
    assert.match(line, /^Minnesota Timberwolves｜2026-27 例行賽｜2026-11-01 至 2026-11-17（8 場）｜得分（PTS） 110\.0｜/);
    assert.doesNotMatch(line, /截至/);
    const ident = w.UI.citeLine({ label: '得分', en: 'PTS', value: '116.7', gkey: 'PTS', asOf: 'agg', note: '季平均', periodless: true });
    assert.match(ident, /｜季平均｜截至 2026-11-19｜/);
    assert.doesNotMatch(ident, /2026-11-01/);
    // 近 N 場：沒有結束日，照寫截至
    w.CiteCtx = { ...base, period: '近 10 場（10 場）', periodLabel: '近 10 場', periodEnd: null };
    assert.match(w.UI.citeLine({ label: '進攻籃板率', en: 'OREB%', value: '34.9', unit: '%', gkey: 'OREB_PCT', asOf: 'agg', note: '逐場加權近似' }),
        /｜近 10 場（10 場）｜逐場加權近似｜截至 2026-11-19｜進攻籃板率（OREB%） 34\.9%｜/);
    // 說明已寫到畫面短寫法（近期異動）就不重複
    w.CiteCtx = { ...base, period: '2026-11-01 至 2026-11-17（8 場）', periodLabel: '2026-11-01~2026-11-17', periodEnd: '2026-11-17' };
    assert.doesNotMatch(w.UI.citeLine({ label: '得分', value: '1', gkey: 'PTS', asOf: 'agg', note: '2026-11-01~2026-11-17（全季 1）' }), /至 2026-11-17（8 場）/);
});

test('Quote.make：篩選中情境附期間與補充、統計日用區間結束日', () => {
    w.CiteCtx = { subject: 'LaMelo Ball', season: '2026-27 例行賽', asOfSnap: '2026-11-19', asOfAgg: '2026-11-19', isHistory: false,
        period: '2026-11-01 至 2026-11-17（8 場）', periodLabel: '2026-11-01~2026-11-17', periodEnd: '2026-11-17' };
    const it = Q.make({ label: '使用率', values: [{ value: '29.4' }], asOf: 'agg', ctxNote: '逐場加權近似' });
    assert.equal(it.context, '2026-27 例行賽 2026-11-01 至 2026-11-17（8 場） 逐場加權近似');
    assert.equal(it.asOf, '2026-11-17');
    assert.equal(Q.make({ label: 'x', values: [], asOf: 'agg', periodless: true }).context, '2026-27 例行賽');
});

// ── 單場 Playtype（GamePT.rowQuote）：成對「回合數／每回合得分」，類型名只寫一次；主體固定灰狼全隊 ──
test('單場 Playtype 引用：單列與整組（單場比分標頭）', () => {
    w.CiteCtx = { subject: 'Anthony Edwards', season: '2026-27 例行賽', context: '11/19 vs. 尼克 99:102 敗', isHistory: false,
        game: { date: '2026-11-19', home: true, opp: 'NYK', ms: 99, os: 102, wl: 'L', gameNo: 16, stage: null } };
    const pt = { ok: true, n: 16, preGP: 15, off: [
        { t: 'Transition', poss: 26, pts: 37, fgm: 14, fga: 18, prePoss: 335, prePts: 385 },
        { t: 'Spotup', poss: 21, pts: 16, fgm: 5, fga: 18, prePoss: 400, prePts: 460 }],
        def: [{ t: 'Transition', poss: 8, pts: 10, fgm: 4, fga: 6, prePoss: 340, prePts: 364 }] };
    const off = w.GamePT.derive(pt, 'offensive').rows.map(r => w.GamePT.rowQuote(r, 'offensive'));
    assert.equal(Q.render([off[0]]),
        '灰狼全隊｜11/19 vs. 尼克 99:102 敗：賽前季均 → 本場\n※轉換進攻 回合數／每回合得分：22.3／1.15 → 26／1.42');
    assert.equal(Q.render(off, { header: 'game' }),
        'G16 vs. 紐約尼克 99:102 灰狼敗\n\n灰狼全隊：賽前季均 → 本場\n※轉換進攻 回合數／每回合得分：22.3／1.15 → 26／1.42\n※定點投籃 回合數／每回合得分：26.7／1.15 → 21／0.76');
    const def = w.GamePT.rowQuote(w.GamePT.derive(pt, 'defensive').rows[0], 'defensive');
    assert.equal(Q.render([def]), '灰狼全隊｜11/19 vs. 尼克 99:102 敗：賽前季均 → 本場\n※防守轉換進攻 回合數／每回合失分：22.7／1.07 → 8／1.25');
    // 引用籃：可加入、拆開後每個 part 各自成一行（名稱仍含類型名）
    Q.clear();
    assert.ok(Q.add(off[0]).added);
    assert.equal(Q.add(off[0]).added, false, '同一列不重複加入');
    Q.split(Q.items()[0].id);
    assert.equal(JSON.stringify(Q.items().map(x => x.label)), JSON.stringify(['轉換進攻回合數', '轉換進攻每回合得分']));
    Q.clear();
});

// ── 合併規則（Phase 4，預覽 _mockup/quote-merge.html 情境 A～E 的輸出逐字一致）──
// 用 Quote.make 走真實流程：CiteCtx（賽季／期間／統計日）→ 項目 → 加入籃子 → 合成比較／併下一項
const TEAM = { subject: 'Minnesota Timberwolves', season: '2026-27 例行賽', asOfSnap: '2026-11-19', asOfAgg: '2026-11-19', isHistory: false };
const LB = { ...TEAM, subject: 'LaMelo Ball' };
const mk = (ctx, fields) => { w.CiteCtx = { period: null, periodLabel: null, periodEnd: null, ...ctx }; return Q.make(fields); };
const ortg = (v) => ({ label: '進攻效率', en: 'OffRtg', gkey: 'OFF_RATING', values: [{ value: v }], asOf: 'agg', better: 'high', rank: { rank: 12, n: 30 } });
const fill = (...its) => { Q.clear(); its.forEach(it => Q.add(it)); return Q.items(); };
const plain = (x) => JSON.parse(JSON.stringify(x));

test('情境 A：同指標、不同條件 → 合成比較，並列 vs.、不帶名次', () => {
    const a = mk({ ...TEAM, period: 'A. Edwards 未出賽（12 場）' }, ortg('112.8'));
    const b = mk({ ...TEAM, period: 'A. Edwards 有出賽（4 場）' }, ortg('117.3'));
    assert.equal(a.ctxBase, '2026-27 例行賽');
    assert.equal(a.ctxPeriod, 'A. Edwards 未出賽（12 場）');
    const [x, y] = fill(a, b);
    assert.equal(Q.canMerge(x, y), false, '同一指標不能併成一行');
    assert.equal(Q.canCompare(x, y), true);
    Q.compare(x.id);
    assert.equal(Q.items().length, 1);
    assert.equal(Q.render(Q.items()),
        '（以下為 灰狼全隊｜2026-27 例行賽，A. Edwards 未出賽（12 場） vs. A. Edwards 有出賽（4 場））\n※進攻效率：112.8 vs. 117.3');
    Q.clear();
});

test('情境 B：全季 vs 期間 → 「全季 → 期間」，期間先加入也是全季在前', () => {
    const all = mk(TEAM, ortg('113.9'));
    const l10 = mk({ ...TEAM, period: '近 10 場（10 場）' }, ortg('112.1'));
    const want = '灰狼全隊｜2026-27 例行賽：全季 → 近 10 場（10 場）\n※進攻效率：113.9 → 112.1';
    Q.compare(fill(all, l10)[0].id);
    assert.equal(Q.render(Q.items()), want);
    Q.compare(fill(l10, all)[0].id);
    assert.equal(Q.render(Q.items()), want);
    Q.clear();
});

test('情境 C：時光機同指標不同統計日 → 不可併成「得分／得分」，合成「截至 M/D → 截至 M/D」舊的在前', () => {
    const pts = (v) => ({ label: '得分', en: 'PTS', gkey: 'PTS', values: [{ value: v }], asOf: 'snap', better: 'high' });
    const old = mk({ ...TEAM, asOfSnap: '2026-11-08', asOfAgg: '2026-11-08' }, pts('118.1'));
    const now = mk(TEAM, pts('115.6'));
    const [x, y] = fill(now, old);
    assert.equal(Q.canMerge(x, y), false);
    assert.equal(Q.canCompare(x, y), true);
    Q.compare(x.id);
    assert.equal(Q.render(Q.items()), '灰狼全隊｜2026-27 例行賽：截至 11/08 → 截至 11/19\n※得分：118.1 → 115.6');
    Q.clear();
});

test('情境 D：成對指標先加命中率 → 併下一項自動排成「出手數／命中率」', () => {
    const pct = mk(LB, { label: '命中率', en: 'FG%', gkey: 'FG_PCT', values: [{ value: '40.7', unit: '%' }], asOf: 'agg', better: 'high' });
    const fga = mk(LB, { label: '出手數', en: 'FGA', gkey: 'FGA', values: [{ value: '15.4' }], asOf: 'agg' });
    const [x, y] = fill(pct, fga);
    assert.equal(Q.canMerge(x, y), true);
    assert.equal(Q.canCompare(x, y), false, '不同指標不能合成比較');
    Q.merge(x.id);
    assert.equal(Q.render(Q.items()), 'LaMelo Ball｜2026-27 例行賽\n※出手數／命中率：15.4／40.7%');
    Q.clear();
});

test('情境 E：合併後的比較在 📈📉 格式下，符號接在各指標的後值後面（次數類不標）', () => {
    const fga = cmp('f', '出手數', 'FGA', '15.4', '18.0');
    const pct = { ...cmp('p', '命中率', 'FG%', '40.7', '33.3', '%'), better: 'high' };
    Object.assign(fga, { subject: 'LaMelo Ball', gkey: 'FGA', better: null });
    Object.assign(pct, { subject: 'LaMelo Ball', gkey: 'FG_PCT' });
    const m = { id: 'm', kind: 'compare', subject: 'LaMelo Ball', context: '2026-27 例行賽', sep: '→', parts: [fga, pct] };
    assert.equal(Q.render([m], { cmpStyle: 'trend' }),
        'LaMelo Ball｜2026-27 例行賽：全季 → 近 5 場\n※出手數／命中率：15.4／40.7% → 18.0／33.3% 📉');
    // 兩個都有好壞方向：各自標
    assert.equal(Q.render([{ ...m, parts: [{ ...fga, better: 'high' }, pct] }], { cmpStyle: 'trend' }).split('\n')[1],
        '※出手數／命中率：15.4／40.7% → 18.0 📈／33.3% 📉');
    // 箭頭格式不加
    assert.equal(Q.render([m]).split('\n')[1], '※出手數／命中率：15.4／40.7% → 18.0／33.3%');
});

test('合成比較：不同賽季寫「→」舊的在前；兩段日期區間依統計日；舊項目沒有 ctxBase 退回整段情境', () => {
    const pts = (v) => ({ label: '得分', gkey: 'PTS', values: [{ value: v }], asOf: 'agg' });
    const last = mk({ ...TEAM, subject: 'Anthony Edwards', season: '2025-26 例行賽', isHistory: true }, pts('27.6'));
    const cur = mk({ ...TEAM, subject: 'Anthony Edwards' }, pts('29.1'));
    Q.compare(fill(cur, last)[0].id);
    assert.equal(Q.render(Q.items()), 'Anthony Edwards：2025-26 例行賽 → 2026-27 例行賽\n※得分：27.6 → 29.1');
    const r1 = mk({ ...TEAM, period: '2026-11-01 至 2026-11-10（5 場）', periodEnd: '2026-11-10' }, pts('120.0'));
    const r2 = mk({ ...TEAM, period: '2026-11-11 至 2026-11-19（5 場）', periodEnd: '2026-11-19' }, pts('110.0'));
    Q.compare(fill(r2, r1)[0].id);
    assert.equal(Q.render(Q.items()),
        '灰狼全隊｜2026-27 例行賽：2026-11-01 至 2026-11-10（5 場） → 2026-11-11 至 2026-11-19（5 場）\n※得分：120.0 → 110.0');
    const legacy = (id, context, v) => ({ id, kind: 'single', subject: '灰狼全隊', context, label: '得分', gkey: 'PTS',
        values: [{ tag: '', value: v, unit: '' }], sep: '→', asOf: '2026-11-19' });
    Q.clear();
    Q.add(legacy('l1', '2026-27 例行賽 主場（8 場）', '118.0'));
    Q.add(legacy('l2', '2026-27 例行賽 客場（8 場）', '115.2'));
    Q.compare(Q.items()[0].id);
    assert.equal(Q.render(Q.items()), '（以下為 灰狼全隊，2026-27 例行賽 主場（8 場） vs. 2026-27 例行賽 客場（8 場））\n※得分：118.0 vs. 115.2');
    Q.clear();
});

test('A／A 被擋：同主體同指標同情境同統計日，不能併也不能比；不同主體不能比', () => {
    const a = mk(TEAM, ortg('113.9'));
    const b = { ...a, id: 'b2', values: [{ value: '113.9' }] };
    assert.equal(Q.canMerge(a, b), false);
    assert.equal(Q.canCompare(a, b), false);
    const lb = mk({ ...LB, period: '近 10 場（10 場）' }, ortg('110.0'));
    assert.equal(Q.canCompare(a, lb), false);
    // 比較項目同指標（同 gkey）也不能併成一行
    assert.equal(Q.canMerge(cmp('x', '得分', 'PTS', '1', '2'), cmp('y', '得分', 'PTS', '3', '4')), false);
});

test('拆開還原：合成比較 → 原本兩項（順序、內容不變）；合成後可和同比較對象的項目併成一行再拆回', () => {
    const a = mk({ ...TEAM, period: 'A. Edwards 未出賽（12 場）' }, ortg('112.8'));
    const b = mk({ ...TEAM, period: 'A. Edwards 有出賽（4 場）' }, ortg('117.3'));
    const before = plain(fill(a, b));
    Q.compare(before[0].id);
    const c = Q.items()[0];
    assert.equal(c.kind, 'compare');
    assert.equal(c.rank, null);
    Q.split(c.id);
    assert.deepEqual(plain(Q.items()), before);
    // 全季 → 近 10 場：進攻效率、防守效率各合成後併成一行，再一層層拆回
    const drtg = (v) => ({ label: '防守效率', en: 'DefRtg', gkey: 'DEF_RATING', values: [{ value: v }], asOf: 'agg', better: 'low' });
    fill(mk(TEAM, ortg('113.9')), mk({ ...TEAM, period: '近 10 場（10 場）' }, ortg('112.1')),
        mk(TEAM, drtg('110.2')), mk({ ...TEAM, period: '近 10 場（10 場）' }, drtg('108.0')));
    Q.compare(Q.items()[0].id);
    Q.compare(Q.items()[1].id);
    const [o, d] = Q.items();
    assert.equal(Q.canMerge(o, d), true);
    Q.merge(o.id);
    assert.equal(Q.render(Q.items(), { cmpStyle: 'trend' }),
        '灰狼全隊｜2026-27 例行賽：全季 → 近 10 場（10 場）\n※進攻效率／防守效率：113.9／110.2 → 112.1 📉／108.0 📈');
    Q.split(Q.items()[0].id);
    Q.split(Q.items()[0].id);
    assert.equal(Q.items().length, 3);
    Q.clear();
});
