// App.js 拆出的純計算 window.AppLogic（appLogic.js）：歷史快照轉換、快照定位與取值、季別提示、名單排序、
// 防守缺資料說明、薪資膠囊、未開打場次、附加賽摘要、組合／比較頁狀態更新
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const w = require('./load_bundle')();
const L = w.AppLogic;
const plain = (x) => JSON.parse(JSON.stringify(x));

test('normalizeHistoryPlayer：PlayerID-keyed → 名字 keyed，各類別帶 playerId／名冊旗標，meta 帶新援資訊', () => {
    const doc = { season: '2024-25', stats: {
        '1630162': { playerName: 'Anthony Edwards', isCurrentRoster: true, stats: [{ playType: 'Isolation', ppp: 1.1 }],
            base: { PTS: 27.6 }, tracking: { DRIVES: 12 } },
        '1629': { playerName: 'Old Guy', teamAbbr: 'DEN', isNewcomer: true, stats: [] },
        '9': { stats: [] },   // 沒有名字的列略過
    } };
    const out = L.normalizeHistoryPlayer(doc);
    assert.equal(out.season, '2024-25');
    assert.deepEqual(plain(out.stats['Anthony Edwards']), [{ playType: 'Isolation', ppp: 1.1, playerId: 1630162 }]);
    assert.deepEqual(plain(out.base['Anthony Edwards']), { PTS: 27.6, playerId: 1630162, isCurrentRoster: true, teamAbbr: null });
    assert.deepEqual(plain(out.meta['Old Guy']), { playerId: 1629, teamAbbr: 'DEN', isCurrentRoster: false, isNewcomer: true });
    assert.equal(Object.keys(out.stats).length, 2);
    for (const c of L.HISTORY_CATS) assert.ok(out[c]['Old Guy'], `類別 ${c} 也要展開`);
    assert.equal(L.normalizeHistoryPlayer(null), null);
});

test('seqIndex：序列新到舊，取第一個 <= 日期；找不到退回 0；歷史模式固定 0', () => {
    const seq = [{ date: '2026-11-18' }, { date: '2026-11-15' }, { date: '2026-11-10' }];
    assert.equal(L.seqIndex(seq, '2026-11-18', false), 0);
    assert.equal(L.seqIndex(seq, '2026-11-16', false), 1);
    assert.equal(L.seqIndex(seq, '2026-11-01', false), 0);
    assert.equal(L.seqIndex(seq, '2026-11-16', true), 0);
});

test('pickView：全隊取整份、球員取該員；PlayerID 依 Synergy → tracking → base → meta', () => {
    const cur = { date: '2026-11-18', season: '2026-27', seasonType: '例行賽', stats: [{ x: 1 }], defense: { D_FG_PCT: 44 },
        lineups: [{ a: 1 }], base: { PTS: 110 } };
    const t = L.pickView('TEAM', cur, { stats: [{ x: 0 }], defense: { D_FG_PCT: 45 } }, '');
    assert.deepEqual([t.displayDate, t.currentSeasonType, t.currentDefense.D_FG_PCT, t.prevDefense.D_FG_PCT, t.currentLineups.length, t.currentPlayerId],
        ['2026-11-18', '例行賽', 44, 45, 1, null]);

    const P = 'A. Player';
    const doc = (o) => ({ date: '2026-11-18', seasonType: '例行賽', ...o });
    assert.equal(L.pickView('PLAYER', doc({ stats: { [P]: [{ playerId: 11 }] }, base: { [P]: { playerId: 99 } } }), null, P).currentPlayerId, 11);
    assert.equal(L.pickView('PLAYER', doc({ stats: { [P]: [] }, tracking: { [P]: { playerId: 22 } } }), null, P).currentPlayerId, 22);
    // 開季初 Synergy 未釋出：只有 base 也算有這個人
    assert.equal(L.pickView('PLAYER', doc({ base: { [P]: { playerId: 33, MIN: 30 } } }), null, P).currentPlayerId, 33);
    assert.equal(L.pickView('PLAYER', doc({ stats: { [P]: [] }, meta: { [P]: { playerId: 44, isNewcomer: true } } }), null, P).currentPlayerId, 44);
    // 這份快照沒有這個人：顯示「尚無數據」，但 meta 照樣帶（新援判斷用）
    const miss = L.pickView('PLAYER', doc({ stats: { other: [] }, meta: { [P]: { isNewcomer: true } } }), null, P);
    assert.deepEqual([miss.displayDate, miss.currentPlayerId, miss.selectedMeta.isNewcomer], ['尚無數據', null, true]);
});

test('seasonStatus：休賽期提示、超過 2 天未更新提示、歷史模式不提示', () => {
    const now = new Date('2026-11-19T12:00:00').getTime();
    assert.equal(L.seasonStatus({ isHistory: false, phase: { inSeason: false }, season: '2025-26', now }).kind, 'offseason');
    assert.equal(L.seasonStatus({ isHistory: false, phase: { inSeason: true }, latest: '2026-11-18', now }), null);
    const s = L.seasonStatus({ isHistory: false, phase: { inSeason: true }, latest: '2026-11-15', now });
    assert.deepEqual([s.kind, /4 天前/.test(s.message)], ['stale', true]);
    assert.equal(L.seasonStatus({ isHistory: true, phase: { inSeason: false } }), null);
    assert.equal(L.seasonStatus({ isHistory: false, phase: { inSeason: true }, latest: 'not-a-date', now }), null);
});

test('rosterOrder：有 base 依場均分鐘、沒有 base 依進攻總球權；名單取 stats ∪ base', () => {
    const withBase = { stats: { A: [], B: [] }, base: { A: { MIN: 20 }, B: { MIN: 35 }, C: { MIN: 28 } } };
    assert.deepEqual(plain(L.rosterOrder(withBase)), ['B', 'C', 'A']);
    const noBase = { stats: {
        A: [{ side: 'offensive', poss: 3 }, { side: 'offensive', poss: 4 }],
        B: [{ side: 'offensive', poss: 10 }, { side: 'defensive', poss: 50 }],   // 防守球權不算
    } };
    assert.deepEqual(plain(L.rosterOrder(noBase)), ['B', 'A']);
    assert.deepEqual(plain(L.rosterOrder({ base: { Z: {}, Y: {} } })), ['Y', 'Z']);   // 同分依名字
    assert.deepEqual(plain(L.rosterOrder(null)), []);
});

test('loadedSeasonKey：日期字串＝當季、賽季標籤對回 key', () => {
    const opts = [{ key: '2024-25_regular', label: '2024-25 例行賽' }];
    assert.equal(L.loadedSeasonKey([{ date: '2026-11-18' }], opts), 'current');
    assert.equal(L.loadedSeasonKey([{ date: '2024-25 例行賽' }], opts), '2024-25_regular');
    assert.equal(L.loadedSeasonKey([], opts), undefined);
});

test('defenseMissing：有資料回 null；歷史、單一球員缺、整季都沒有、跳到最近有資料的日期', () => {
    const base = { hasData: false, isHistory: false, viewMode: 'TEAM', idx: 0, player: '', typeLabel: '例行賽', season: '2026-27' };
    assert.equal(L.defenseMissing({ ...base, hasData: true }), null);
    assert.match(L.defenseMissing({ ...base, isHistory: true }).msg, /期末快照沒有防守數據/);
    assert.match(L.defenseMissing({ ...base, seq: [{ date: '2026-11-18' }], date: '2026-11-18' }).msg, /都沒有防守數據/);
    const seq = [{ date: '2026-11-18' }, { date: '2026-11-12', defense: { D_FG_PCT: 44 } }, { date: '2026-11-01', defense: { D_FG_PCT: 40 } }];
    const r = L.defenseMissing({ ...base, seq, date: '2026-11-18' });
    assert.equal(r.jumpDate, '2026-11-12');
    const pseq = [{ date: '2026-11-18', defense: { Other: { D_FG_PCT: 40 } } }];
    assert.match(L.defenseMissing({ ...base, viewMode: 'PLAYER', player: 'A', seq: pseq, date: '2026-11-18' }).msg, /^A 在 2026-11-18/);
});

test('salaryBadge：用 playerId 對合約；雙向合約、選項與非全額保障標記', () => {
    const doc = { contracts: [
        { season: '2026-27', playerId: 1, salary: 50000000, guarantee: 'full' },
        { season: '2026-27', playerId: 2, salary: 50000000, guarantee: 'full', option: 'PO' },
        { season: '2026-27', playerId: 3, salary: 0, type: 'TWO-WAY' },
        { season: '2026-27', playerId: 4, salary: 2000000, guarantee: 'partial' },
    ], dead: [] };
    const b = L.salaryBadge(doc, '2026-27', '1');
    assert.equal(b.text, w.CapCalc.fmtM(50000000));
    assert.match(b.title, /佔全隊奢侈稅薪資 49\.0%/);   // 50M ÷ 102M
    assert.equal(L.salaryBadge(doc, '2026-27', 2).badge, '球員選項');
    assert.deepEqual([L.salaryBadge(doc, '2026-27', 3).text, L.salaryBadge(doc, '2026-27', 3).badge], ['雙向合約', '']);
    assert.equal(L.salaryBadge(doc, '2026-27', 4).badge, '非全額保障');
    assert.equal(L.salaryBadge(doc, '2026-27', 5), null);
    assert.equal(L.salaryBadge(null, '2026-27', 1), null);
});

test('futureGames：只列已開打索引最後一場之後的比賽，且預覽文件要是同一季', () => {
    const pv = { season: w.CURRENT_SEASON, games: [
        { id: '0022600010', date: '2026-11-17', home: true, opp: 'DEN', utc: '2026-11-18T01:00:00Z' },
        { id: '0022600020', date: '2026-11-20', home: false, opp: 'LAL', utc: '2026-11-21T03:30:00Z' },
    ] };
    const f = L.futureGames(pv, w.CURRENT_SEASON, [{ date: '2026-11-17' }]);
    assert.deepEqual(plain(f.map(g => [g.date, g.matchup, g.type, g.future])), [['2026-11-20', 'MIN @ LAL', 'regular', true]]);
    assert.deepEqual(plain(L.futureGames(pv, '2025-26', [])), []);
});

test('playinSummary：附加賽戰績，時光機日期之後的不算', () => {
    const gs = [{ date: '2027-04-10', type: 'regular', wl: 'W' }, { date: '2027-04-15', type: 'playin', wl: 'L' }, { date: '2027-04-17', type: 'playin', wl: 'W' }];
    assert.deepEqual(plain(L.playinSummary(gs, null)), { w: 1, l: 1, lastDate: '2027-04-17' });
    assert.deepEqual(plain(L.playinSummary(gs, '2027-04-16')), { w: 0, l: 1, lastDate: '2027-04-15' });
    assert.equal(L.playinSummary(gs, '2027-04-12'), null);
});

test('patchLu：換人數時最少分鐘與檢視回預設、球員截斷；預設賽季／賽別存空字串', () => {
    const cur = w.CURRENT_SEASON;
    const l = { n: 3, picks: ['1-a', '2-b', '3-c'], min: 80, view: 'mx', season: '', type: '' };
    assert.deepEqual(plain(L.patchLu(l, { n: 2 }, 'regular')), { n: 2, picks: ['1-a', '2-b'], min: null, view: '', season: '', type: '' });
    assert.equal(L.patchLu(l, { season: cur }, 'regular').season, '');
    assert.equal(L.patchLu(l, { type: 'playoffs' }, 'regular').type, 'playoffs');
    assert.equal(L.patchLu(l, { type: 'playoffs' }, 'playoffs').type, '');   // 季後賽期間當季預設就是季後賽
    assert.equal(L.patchLu(l, { season: '2024-25', type: 'regular' }, 'playoffs').type, '');   // 舊賽季預設例行賽
});

test('patchCmp：當季寫成空字串，其他原樣', () => {
    const c = { a: '1-a', b: '2-b', sa: '2024-25', sb: '' };
    assert.deepEqual(plain(L.patchCmp(c, { sa: w.CURRENT_SEASON })), { ...c, sa: '' });
    assert.equal(L.patchCmp(c, { sb: '2023-24' }).sb, '2023-24');
});

test('latestOfType：某賽別最新的一份', () => {
    const arr = [{ date: '2026-11-10', seasonType: '例行賽' }, { date: '2026-11-18', seasonType: '例行賽' }, { date: '2026-11-19', seasonType: '季後賽' }];
    assert.equal(L.latestOfType(arr, '例行賽').date, '2026-11-18');
    assert.equal(L.latestOfType([], '例行賽'), null);
});
