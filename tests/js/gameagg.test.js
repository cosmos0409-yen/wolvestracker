// GameAgg：季平均／期間平均的加權規則（命中率 Σ分子/Σ分母、eFG、TS、加權平均、在場效率、vs 平常、場均）
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const w = require('./load_bundle')();
const GA = w.GameAgg;
const plain = (x) => JSON.parse(JSON.stringify(x));   // 沙盒裡建的陣列原型不同，比對前轉成本地物件

const g = (date, wl, stats, matchup = 'MIN vs. DEN') => ({ date, wl, matchup, stats });
// 兩場：投籃命中率逐場平均是 (90+25)/2=57.5，正確的加權是 (9+10)/(10+40)=38.0——兩種算法結果不同，才測得出用錯
const games = [
    g('2026-11-01', 'W', { PTS: 120, FGM: 9, FGA: 10, FG3M: 2, FG3A: 4, FTA: 10, FG_PCT: 90.0, DRIVES: 10, DRIVE_AST_PCT: 20.0,
        ON_PTS: 110, ON_OPP_PTS: 100, ON_POSS: 100, D_FGM: 4, D_FGA: 10, NORMAL_FG_PCT: 45.0 }),
    g('2026-11-03', 'L', { PTS: 100, FGM: 10, FGA: 40, FG3M: 4, FG3A: 16, FTA: 0, FG_PCT: 25.0, DRIVES: 30, DRIVE_AST_PCT: 10.0,
        ON_PTS: 95, ON_OPP_PTS: 105, ON_POSS: 100, D_FGM: 1, D_FGA: 2, NORMAL_FG_PCT: 50.0 }, 'MIN @ LAL'),
];

test('GP／W／L 由場次算', () => {
    const a = GA.aggregate(games, null, 'TEAM');
    assert.deepEqual([a.GP, a.W, a.L], [2, 1, 1]);
});

test('命中率是 Σ命中 ÷ Σ出手，不是逐場平均', () => {
    const a = GA.aggregate(games, null, 'TEAM');
    assert.equal(a.FG_PCT, 38.0);        // 19/50；逐場平均會是 57.5
    assert.equal(a.FG3_PCT, 30.0);       // 6/20
    assert.equal(a.FG3A_FREQ, 40.0);     // 三分出手占比 20/50
});

test('eFG、真實命中率依公式重算', () => {
    const a = GA.aggregate(games, null, 'TEAM');
    assert.equal(a.EFG_PCT, 44.0);       // (19 + 0.5*6) / 50
    assert.equal(a.TS_PCT, 202.2);       // 100 × 220 / (2 × (50 + 0.44 × 10)) = 202.2（假資料的得分與出手不成比例，只驗公式）
});

test('沒存分子的比率依權重欄加權（切入助攻率 × 切入次數）', () => {
    assert.equal(GA.aggregate(games, null, 'TEAM').DRIVE_AST_PCT, 12.5);   // (20*10 + 10*30) / 40
});

test('在場效率以 ON_PTS ÷ ON_POSS 加權，淨效率是兩者相減', () => {
    const a = GA.aggregate(games, null, 'TEAM');
    assert.deepEqual([a.ON_OFF_RATING, a.ON_DEF_RATING, a.ON_NET_RATING], [102.5, 102.5, 0]);
});

test('最近防守者 vs 平常依出手數加權', () => {
    // 100*(5/12) − (45*10 + 50*2)/12 = 41.67 − 45.83 = −4.2
    assert.equal(GA.aggregate(games, null, 'TEAM').PCT_PLUSMINUS, -4.2);
});

test('次數類輸出場均', () => {
    assert.equal(GA.aggregate(games, null, 'TEAM').PTS, 110.0);
});

test('metricOf：完全沒有分母欄就回 null（不當 0）', () => {
    assert.equal(GA.metricOf(games, null, 'TEAM', 'RA_FG_PCT'), null);
    assert.equal(GA.metricOf(games, null, 'TEAM', 'FG_PCT'), 38.0);
});

test('seasonToDate 只算到指定日期', () => {
    assert.equal(GA.seasonToDate(games, '2026-11-02', null, 'TEAM').GP, 1);
    assert.equal(GA.seasonToDate(games, null, null, 'TEAM').GP, 2);
});

test('主客、勝敗分組', () => {
    assert.deepEqual(plain(GA.splitByHomeAway(games).map(x => [x.label, x.games.length])), [['主場', 1], ['客場', 1]]);
    assert.deepEqual(plain(GA.splitByWinLoss(games).map(x => x.label)), ['勝場', '敗場']);
});
