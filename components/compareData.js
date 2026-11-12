// 球員比較頁的計算（window.Compare，頁面只負責呈現）：版型見 _mockup/compare.html
// 數值一律來自逐場 bundle（只算灰狼場次；loadSeasonGames 已套 cleanGameStats），比率以 Σ分子／Σ分母 重算（GameAgg）
// 指標清單直接取既有 defs（SPLITS_BASE_DEF、shootingDefs 分區、trackingDefs、有逐場的 defenseDefs），不另列；
//   方向沿用 betterIsLarger／neutral（次數類標 neutral 的不分好壞、也不列入「差距最大」）
// 「差距最大」：(A − B) ÷ 兩人逐場標準差的合併值（同對戰頁的思路：平常就波動大的指標要差很多才算明顯），每人至少 3 場有值
window.Compare = (function () {
    const GA = () => window.GameAgg;
    const isNum = (v) => typeof v === 'number' && isFinite(v);
    // 與 GameAgg 的 isAvgKey 同規則：這些是比率／效率，不能換算每 36 分鐘
    const AVG_RE = /_PCT$|_FREQ$|_RATING$|PLUSMINUS$|PER_TOUCH$|REB_DIST$|TIME_OF_POSS$|PACE/;
    const isRate = (k) => !!(GA().RATIO_DEFS[k] || GA().EFG_DEFS[k]) || AVG_RE.test(k);

    // 分組：[{ id, title, en, metrics:[def 的 metric] }]；球員才有的指標都保留（比較頁只比球員）
    const groups = () => {
        const base = window.SPLITS_BASE_DEF || { metrics: [] };
        const zones = (window.shootingDefs || []).find(d => d.id === 'ShotZones');
        const defense = (window.defenseDefs || []).filter(d => (window.GAME_DEFENSE_IDS || []).includes(d.id));
        return [
            { id: 'base', title: '基本', en: 'Traditional', metrics: [{ key: 'MIN', label: '上場時間', englishLabel: 'MIN', neutral: true }, ...base.metrics] },
            { id: 'zones', title: '投籃分區', en: 'Shot Zones', metrics: zones ? zones.metrics : [] },
            { id: 'tracking', title: '持球與傳導', en: 'Tracking', metrics: (window.trackingDefs || []).flatMap(d => d.metrics) },
            { id: 'defense', title: '防守與拼勁', en: 'Defense', metrics: defense.flatMap(d => d.metrics) },
        ].map(g => ({ ...g, metrics: g.metrics.filter((m, i, a) => a.findIndex(x => x.key === m.key) === i) }));
    };

    // 期間：只開放不需要全隊母體的簡單期間（兩人可能是不同賽季，條件與對手不適用）
    const PERIODS = [['all', '全季'], ['last5', '近 5 場'], ['last10', '近 10 場'], ['W', '勝場'], ['L', '敗場'], ['home', '主場'], ['away', '客場']];
    const applyPeriod = (games, kind) => (kind && kind !== 'all' ? window.Period.apply(games, { kind, conds: [] }).games : games);

    // 整組加總；per36：次數類 ÷ 平均上場 × 36（比率不變）
    const summarize = (games, per36) => {
        const agg = GA().aggregate(games || [], null, 'TEAM');
        if (!per36 || !agg.GP || !(agg.MIN > 0)) return agg;
        const out = { ...agg };
        Object.keys(agg).forEach(k => {
            if (k === 'GP' || k === 'W' || k === 'L' || k === 'MIN' || k === 'playerId' || !isNum(agg[k]) || isRate(k)) return;
            out[k] = Math.round(agg[k] / agg.MIN * 36 * 10) / 10;
        });
        return out;
    };
    // 單場值（差距排序、走勢）：比率分母為 0 的場次視為無值；per36 時次數類換算
    const gameValue = (g, key, per36) => {
        const v = window.Matchup ? window.Matchup.gameValue(g, key) : GA().metricOf([g], null, 'TEAM', key);
        if (!isNum(v)) return null;
        if (per36 && !isRate(key) && key !== 'MIN') { const m = (g.stats || {}).MIN; return m > 0 ? v / m * 36 : null; }
        return v;
    };
    const sd = (xs) => { if (xs.length < 2) return 0; const m = xs.reduce((a, b) => a + b, 0) / xs.length; return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1)); };

    // 哪一邊比較好：'a'／'b'／null（中性、相等、缺值）
    const winner = (m, a, b) => {
        if (m.neutral || !isNum(a) || !isNum(b) || Math.abs(a - b) < 0.05) return null;
        const big = m.betterIsLarger !== false;
        return (a > b) === big ? 'a' : 'b';
    };

    // 差距最大的 n 項
    const biggestGaps = (ga, gb, aggA, aggB, per36, n = 5) => {
        const MIN_N = 3;
        return groups().flatMap(g => g.metrics).filter(m => !m.neutral).map(m => {
            const xa = ga.map(x => gameValue(x, m.key, per36)).filter(isNum), xb = gb.map(x => gameValue(x, m.key, per36)).filter(isNum);
            const a = aggA[m.key], b = aggB[m.key];
            if (xa.length < MIN_N || xb.length < MIN_N || !isNum(a) || !isNum(b)) return null;
            const sp = Math.sqrt((sd(xa) ** 2 + sd(xb) ** 2) / 2);
            if (!(sp > 0)) return null;
            return { m, a, b, d: (a - b) / sp, win: winner(m, a, b) };
        }).filter(r => r && r.win).sort((x, y) => Math.abs(y.d) - Math.abs(x.d)).slice(0, n);
    };

    // 走勢：同季 → 以日期對齊（兩人同一張日曆）；不同季 → 以「出賽第 N 場」對齊
    const trend = (ga, gb, key, per36, sameSeason) => {
        const val = (g) => { const v = gameValue(g, key, per36); return isNum(v) ? Math.round(v * 10) / 10 : null; };
        if (sameSeason) {
            const xs = [...new Set([...ga, ...gb].map(g => g.date))].sort();
            const map = (gs) => { const m = Object.fromEntries(gs.map(g => [g.date, val(g)])); return xs.map(d => (d in m ? m[d] : null)); };
            return { xs: xs.map(d => `${Number(d.slice(5, 7))}/${Number(d.slice(8))}`), a: map(ga), b: map(gb), byDate: true };
        }
        const len = Math.max(ga.length, gb.length);
        const pad = (gs) => Array.from({ length: len }, (_, i) => (gs[i] ? val(gs[i]) : null));
        return { xs: Array.from({ length: len }, (_, i) => String(i + 1)), a: pad(ga), b: pad(gb), byDate: false };
    };

    // 快照裡找這位球員（每日快照與正規化後的歷史快照都以名字為 key；用 playerId 對）
    const snapName = (snapPlayer, pid) => {
        if (!snapPlayer) return null;
        const pools = [snapPlayer.base, snapPlayer.meta, snapPlayer.onoff, snapPlayer.tracking];
        for (const pool of pools) {
            const hit = Object.entries(pool || {}).find(([, v]) => v && Number(v.playerId) === Number(pid));
            if (hit) return hit[0];
        }
        return null;
    };

    return { groups, PERIODS, applyPeriod, summarize, gameValue, winner, biggestGaps, trend, snapName, isRate };
})();
