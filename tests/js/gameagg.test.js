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

// ── 總覽區間效率（teamAdvanced／playerAdvanced／onOff，讀 bundle 每場的 adv）──
const tg = (date, stats, opp, adv) => ({ date, wl: 'W', matchup: 'MIN vs. DEN', stats, opp, adv });
const team2 = [
    tg('2026-11-01', { PTS: 120, FGM: 45, FGA: 90, FG3M: 12, FTA: 20, AST: 30, TOV: 10, OREB: 10, DREB: 30, PLUS_MINUS: 10 },
        { PTS: 110 }, { POSS: 100, OPP_POSS: 101, PACE: 100, GMIN: 240, OREB_CH: 40, DREB_CH: 40 }),
    tg('2026-11-03', { PTS: 100, FGM: 35, FGA: 85, FG3M: 8, FTA: 30, AST: 20, TOV: 20, OREB: 15, DREB: 35, PLUS_MINUS: -5 },
        { PTS: 105 }, { POSS: 110, OPP_POSS: 109, PACE: 110, GMIN: 265, OREB_CH: 35, DREB_CH: 45 }),
];

test('全隊效率：Σ得分 ÷ Σ回合（不是逐場效率平均），失誤率 ÷ 回合，節奏依比賽分鐘加權', () => {
    const a = plain(GA.teamAdvanced(team2));
    assert.equal(a.OFF_RATING, 104.8);                 // 220/210；逐場平均會是 105.5
    assert.equal(a.DEF_RATING, 102.4);                 // 215/210
    assert.equal(a.NET_RATING, 2.4);
    assert.equal(a.TM_TOV_PCT, 14.3);                  // 30/210
    assert.equal(a.PACE, 105.2);                       // (100×240+110×265)/505＝105.25
    assert.equal(a.AST_PCT, 62.5);                     // 50/80
    assert.equal(a.OREB_PCT, 33.3);                    // 25/75
    assert.equal(a.EFG_PCT, 51.4);                     // (80+0.5×20)/175
    assert.deepEqual([a.GP, a.advGP], [2, 2]);
    assert.ok(a.approx.includes('OREB_PCT') && !a.approx.includes('OFF_RATING'));
});

test('全隊效率：沒有 adv 的場次不進效率類（分子分母同一組），比率類照算；全沒有 → null', () => {
    const a = GA.teamAdvanced([team2[0], { ...team2[1], adv: undefined }]);
    assert.equal(a.OFF_RATING, 120.0);
    assert.equal(a.advGP, 1);
    const none = GA.teamAdvanced(team2.map(x => ({ ...x, adv: undefined })));
    assert.equal(none.OFF_RATING, null);
    assert.equal(none.PACE, null);
    assert.equal(none.TS_PCT, 55.8);                   // 220/(2×(175+0.44×50))
});

test('個人效率：失誤率含助攻（NBA 球員公式），USG 依回合加權、PIE 依全場分母加權', () => {
    const pg = [
        { date: 'a', stats: { FGA: 20, FTA: 10, AST: 5, TOV: 5 }, adv: { POSS: 100, USG_PCT: 30, PIE: 20, PIE_W: 200 } },
        { date: 'b', stats: { FGA: 10, FTA: 0, AST: 5, TOV: 0 }, adv: { POSS: 50, USG_PCT: 15, PIE: 5, PIE_W: 100 } },
    ];
    const a = GA.playerAdvanced(pg);
    assert.equal(a.TM_TOV_PCT, 10.1);                  // 5/(30+0.44×10+10+5)
    assert.equal(a.AST_TO, 2);
    assert.equal(a.USG_PCT, 25.0);                     // (30×100+15×50)/150
    assert.equal(a.PIE, 15.0);                         // (20×200+5×100)/300
    assert.equal(GA.playerAdvanced([pg[1]]).AST_TO, null);   // 0 失誤不給比值
});

test('在場／不在場：沒上場的場次算整場全隊，有上場的用單場官方離場值依 OFF_W 加權', () => {
    const pg = [{ date: '2026-11-01', stats: { ON_PTS: 90, ON_OPP_PTS: 80, ON_POSS: 75 },
        adv: { OFF_OFF_RATING: 120, OFF_DEF_RATING: 120, OFF_W: 25 } }];
    const o = GA.onOff(pg, team2);
    assert.equal(o.ON_OFF_RATING, 120.0);
    assert.equal(o.ON_NET_RATING, 13.3);
    // 離場：第 1 場 25 回合 30 得 30 失；第 2 場沒上場＝整場 100 得 105 失、110 回合 → 130/135, 135/135
    assert.equal(o.OFF_OFF_RATING, 96.3);
    assert.equal(o.OFF_DEF_RATING, 100.0);
    assert.deepEqual([o.GP, o.teamGP, o.missing], [1, 2, 0]);
    const none = GA.onOff([], team2);                  // 期間內都沒上場：在場 null、離場＝全隊
    assert.equal(none.ON_OFF_RATING, null);
    assert.equal(none.OFF_OFF_RATING, 104.8);
});

test('在場／不在場節奏：在場依上場分鐘加權；不在場依不在場分鐘加權，沒上場的場次用全隊整場節奏', () => {
    // team2：第 1 場 PACE 100、240 分鐘；第 2 場 PACE 110、265 分鐘（延長賽）
    const pg = [{ date: '2026-11-01', stats: { MIN: 36, ON_PTS: 90, ON_OPP_PTS: 80, ON_POSS: 75 },
        adv: { PACE: 102, OFF_OFF_RATING: 120, OFF_DEF_RATING: 120, OFF_W: 25, OFF_PACE: 96, OFF_MIN: 12 } }];
    const o = GA.onOff(pg, team2);
    assert.equal(o.ON_PACE, 102.0);
    // 不在場：96×12（有上場）＋ 110×53（沒上場，265÷5）＝ 6982；分鐘 12＋53＝65 → 107.4
    assert.equal(o.OFF_PACE, 107.4);
    // 舊資料沒有不在場節奏：有上場的場次不計入，只剩沒上場的整場
    const old = GA.onOff([{ ...pg[0], adv: { PACE: 102, OFF_OFF_RATING: 120, OFF_DEF_RATING: 120, OFF_W: 25 } }], team2);
    assert.equal(old.OFF_PACE, 110.0);
    // 沒有在場節奏（舊場次）→ null
    assert.equal(GA.onOff([{ ...pg[0], adv: {} }], team2).ON_PACE, null);
});
