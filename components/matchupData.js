// 對戰分析資料層（window.Matchup）：灰狼對各隊的逐場彙整、偏離程度、標籤、勝負關鍵因子
// 資料只來自既有逐場 bundle（gamesData.loadSeasonGames），不新增 Firestore 集合、不加 NBA request
// 數值一律走 GameAgg.metricOf（百分比以 Σ分子/Σ分母 重算），與 Splits／單場頁同一套規則
// 偏離程度 z ＝（子集值 − 範圍值）÷ 標準誤，標準誤＝範圍內逐場標準差 ÷ √子集場數：
//   只交手 2 場的極端值會被壓下去，10 場的穩定差異會浮上來（排序、上色都看 z，不看原始差距）
// 門檻集中在 constants.js 的 MATCHUP_RULES
window.Matchup = (function () {
    const GA = window.GameAgg;
    const rules = () => window.MATCHUP_RULES;
    const isNum = v => typeof v === 'number' && isFinite(v);
    const round1 = v => Math.round(v * 10) / 10;
    const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

    // 失分（逐場推得：得分 − 正負值）。舊場次沒有對手數據，這是唯一跨所有賽季都有的防守結果
    const OPP_PTS_DEF = { key: 'OPP_PTS', label: '失分', englishLabel: 'Opp PTS', betterIsLarger: false };
    const MARGIN_DEF = { key: 'PLUS_MINUS', label: '場均分差', englishLabel: '+/-' };
    // 勝負關鍵因子排除：分差、得分、失分本身就是比賽結果，比勝敗必然差最多，沒有資訊量
    const FACTOR_EXCLUDE = ['PLUS_MINUS', 'PTS', 'OPP_PTS'];

    // 對手三碼（與 GameAgg.splitBySeries 同規則）：'MIN @ DEN' / 'MIN vs. DEN' → 'DEN'
    const oppOf = m => String(m || '').replace(/^.*?(vs\.|@)\s*/, '').trim();

    // ── 範圍 ──
    // 可用賽季（新→舊）：當季＋歷史賽季（休賽期當季就是最新的歷史賽季，去重）
    function seasonList() {
        const cur = window.CURRENT_SEASON;
        return [cur, ...(window.HISTORY_SEASONS || []).filter(s => s !== cur)].sort().reverse();
    }

    // mode：'recent'（近三季，預設）／'cur'（只看本季）／'YYYY-YY'（指定賽季）
    // currentRegGP：當季例行賽已打場數，未滿 halfSeasonGames 時近三季多含一季
    function windowSeasons(mode, currentRegGP) {
        const all = seasonList();
        const cur = all[0];
        if (mode === 'cur') return { mode, seasons: [cur], extended: false, label: `只看本季（${cur}）` };
        if (mode && mode !== 'recent' && all.includes(mode)) return { mode, seasons: [mode], extended: false, label: `${mode} 賽季` };
        const extended = (currentRegGP || 0) < rules().halfSeasonGames;
        const seasons = all.slice(0, extended ? 4 : 3);
        return {
            mode: 'recent', seasons, extended,
            // 名稱跟著實際範圍：本季未過半時是「前三個完整賽季＋本季」，不能叫近三季（2026-10-28 前標籤與內容不一致）
            label: `${extended ? '前三季＋本季' : '近三季'}：${seasons[seasons.length - 1]}～${seasons[0]}${extended ? '（本季例行賽未過半，多含一季）' : ''}`,
        };
    }

    // 當季例行賽已打場數（讀索引一份 doc；失敗往上拋）
    async function currentRegularGP() {
        return (await window.loadGamesIndex(window.CURRENT_SEASON, 'regular')).length;
    }

    // 逐場加上 season/type/oppAbbr 與推導欄位；不改動快取裡的 bundle 物件
    // 注意 bundle 新場次的 g.opp 是「對手球隊數據」物件，所以對手三碼另放 oppAbbr
    // 失分只對球隊有意義（球員的正負值是在場時段），球員 bundle 不推導
    function decorate(g, season, type, isPlayer) {
        const s = g.stats || {};
        const stats = !isPlayer && isNum(s.PTS) && isNum(s.PLUS_MINUS) ? { ...s, OPP_PTS: s.PTS - s.PLUS_MINUS } : s;
        return { ...g, stats, season, type, oppAbbr: g.oppAbbr || oppOf(g.matchup) };
    }

    // typeFilter：'all'（例行＋季後，預設）／'regular'／'playoffs'。季後賽 bundle 不存在時該季該賽別為空
    // playerId：給了就讀該球員的逐場 bundle（各季最多 2 份；該季不在隊上的 doc 不存在，回空）
    async function loadWindowGames(seasons, typeFilter, playerId) {
        const types = typeFilter === 'regular' ? ['regular'] : typeFilter === 'playoffs' ? ['playoffs'] : ['regular', 'playoffs'];
        const parts = await Promise.all(seasons.flatMap(season => types.map(type =>
            window.loadSeasonGames(season, type, playerId ? 'PLAYER' : 'TEAM', playerId)
                .then(r => (r.games || []).map(g => decorate(g, season, type, !!playerId))))));
        return parts.flat().sort(byDate);
    }

    // ── 指標 ──
    // 指標組：與 Splits 同源（直接吃 window.*Defs，新增指標自動納入）；基本組多一個推導的「失分」。
    // 球隊畫面拿掉 playerOnly 指標（球隊 endpoint 沒有這欄）。實際有沒有資料由呼叫端以 hasData 再濾
    function groupDefs(viewMode) {
        const team = viewMode !== 'PLAYER';
        const base = window.SPLITS_BASE_DEF;
        const baseDef = team ? { ...base, metrics: [base.metrics[0], OPP_PTS_DEF, ...base.metrics.slice(1)] } : base;
        const zones = (window.shootingDefs || []).find(d => d.id === 'ShotZones');
        const defense = (window.defenseDefs || [])
            .filter(d => (window.GAME_DEFENSE_IDS || []).includes(d.id))
            .map(d => (team ? { ...d, metrics: d.metrics.filter(m => !m.playerOnly) } : d));
        return [
            { key: 'base', label: '基本', defs: [baseDef] },
            { key: 'zones', label: '投籃分區', defs: zones ? [zones] : [] },
            { key: 'tracking', label: 'Tracking', defs: window.trackingDefs || [] },
            { key: 'defense', label: '防守', defs: defense },
        ];
    }

    // 指標組平鋪成不重複的指標清單（STL/REB 等在多組出現，先出現者為準），每項帶所屬組
    function flatMetrics(groups) {
        const seen = new Set(), out = [];
        (groups || []).forEach(gr => gr.defs.forEach(d => d.metrics.forEach(m => {
            if (seen.has(m.key)) return;
            seen.add(m.key);
            out.push({ ...m, group: gr.key, defId: d.id });
        })));
        return out;
    }

    // 單場值。球隊與球員 bundle 都把當場數據放在 game.stats（GameAgg 'TEAM' 語意，同 Splits）。
    // 比率的分母為 0（例：沒罰球的 FT%）視為無值，不當 0——否則會灌進標準差
    function gameValue(g, key) {
        const e = g.stats;
        if (!e) return null;
        const den = GA.RATIO_DEFS[key] ? GA.RATIO_DEFS[key][1] : GA.EFG_DEFS[key] ? GA.EFG_DEFS[key][2] : null;
        if (den && !(e[den] > 0)) return null;
        const v = GA.metricOf([g], null, 'TEAM', key);
        return isNum(v) ? v : null;
    }
    // 只保留這個指標有值的場次（舊賽季缺欄位的場次不可被當 0 拉低平均）
    const withValue = (games, key) => games.filter(g => gameValue(g, key) !== null);

    // 範圍基準：範圍值（加權）＋逐場標準差。之後對任意子集算偏離都用這份（逐場值只算一次）
    function baseline(games, key) {
        const vals = new Map();
        games.forEach(g => { const v = gameValue(g, key); if (v !== null) vals.set(g, v); });
        const xs = [...vals.values()];
        if (xs.length < 2) return null;
        const m = xs.reduce((a, b) => a + b, 0) / xs.length;
        const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) * (b - m), 0) / (xs.length - 1));
        const has = [...vals.keys()];
        return { key, vals, sd, n: has.length, value: GA.metricOf(has, null, 'TEAM', key) };
    }

    // 子集相對範圍的偏離。回傳 {value, diff, n, se, z, tone}；子集沒有值 → null
    //   n = 1 時給值與差距、z 為 null（單場不談偏離程度）
    //   tone：'good' / 'bad'（依 betterIsLarger 換算方向）、'neutral'（次數類指標不分好壞）、差距為 0 時 null
    function deviation(base, subset, def) {
        if (!base) return null;
        const has = subset.filter(g => base.vals.has(g));
        if (!has.length) return null;
        const value = GA.metricOf(has, null, 'TEAM', base.key);
        if (!isNum(value)) return null;
        const n = has.length;
        const diff = round1(value - base.value);
        const se = base.sd / Math.sqrt(n);
        const z = n >= 2 && se > 0 ? (value - base.value) / se : null;
        const dir = def && def.betterIsLarger === false ? -1 : 1;
        const tone = def && def.neutral ? 'neutral' : diff === 0 ? null : diff * dir > 0 ? 'good' : 'bad';
        return { value, diff, n, se, z, goodZ: z === null ? null : (def && def.neutral ? 0 : z * dir), tone };
    }

    // ── 對手彙整 ──
    const avg = (gs, f) => {
        const xs = gs.map(f).filter(isNum);
        return xs.length ? round1(xs.reduce((a, b) => a + b, 0) / xs.length) : null;
    };
    function record(gs) {
        const W = gs.filter(g => g.wl === 'W').length, L = gs.filter(g => g.wl === 'L').length;
        return { n: gs.length, W, L, margin: avg(gs, g => g.stats && g.stats.PLUS_MINUS) };
    }
    function summarize(abbr, games) {
        const gs = games.slice().sort(byDate);
        const seasons = [...new Set(gs.map(g => g.season))].sort().reverse();
        return {
            abbr, name: window.teamName ? window.teamName(abbr) : abbr, games: gs,
            ...record(gs),
            pts: avg(gs, g => g.stats && g.stats.PTS),
            oppPts: avg(gs, g => g.stats && g.stats.OPP_PTS),
            home: record(gs.filter(g => (g.matchup || '').includes('vs.'))),
            away: record(gs.filter(g => (g.matchup || '').includes('@'))),
            last5: gs.slice(-5).map(g => ({ date: g.date, wl: g.wl, type: g.type })),
            playoffGames: gs.filter(g => g.type === 'playoffs').length,
            bySeason: seasons.map(s => ({ season: s, ...record(gs.filter(g => g.season === s)) })),
        };
    }
    // 每個對手一列（依場均分差由高到低）
    function byOpponent(games) {
        const map = {};
        games.forEach(g => { if (g.oppAbbr) (map[g.oppAbbr] = map[g.oppAbbr] || []).push(g); });
        return Object.keys(map).map(a => summarize(a, map[a])).sort((a, b) => (b.margin || 0) - (a.margin || 0));
    }

    // 標籤（中性字眼，見 MATCHUP_TAGS）：每列加 marginDev（場均分差的偏離）、rivalScore 與 tag（'rival'|'favorable'|'tough'|null）
    // 勁敵：場數 ≥ minGames 的對手中，rivalScore（交手總場數＋季後賽場數）前 rivalTopN 名；同分依季後賽場數、再依隊名排，結果固定
    //（不設場數門檻的話，開季只看本季時打過 1 場的對手也會被標成勁敵）
    function tagOpponents(rows, games) {
        const R = rules();
        const base = baseline(games, 'PLUS_MINUS');
        const out = rows.map(r => ({ ...r, marginDev: deviation(base, r.games, MARGIN_DEF), rivalScore: r.n + r.playoffGames, tag: null }));
        out.filter(r => r.n >= R.minGames)
            .sort((a, b) => b.rivalScore - a.rivalScore || b.playoffGames - a.playoffGames || (a.abbr < b.abbr ? -1 : 1))
            .slice(0, R.rivalTopN).forEach(r => { r.tag = 'rival'; });
        const pool = out.filter(r => !r.tag && r.n >= R.minGames && r.marginDev && r.marginDev.z !== null)
            .sort((a, b) => b.marginDev.z - a.marginDev.z);
        pool.filter(r => r.marginDev.z >= R.tagMinZ).slice(0, R.topN).forEach(r => { r.tag = 'favorable'; });
        pool.slice().reverse().filter(r => r.marginDev.z <= -R.tagMinZ).slice(0, R.topN).forEach(r => { r.tag = 'tough'; });
        return out;
    }

    // 勝負關鍵因子：範圍內勝場 vs 敗場，逐指標算標準化差 d ＝（勝場平均 − 敗場平均）÷ 合併標準差（逐場值）。
    // 不分對手，所以不受單一對手場數少的影響。回傳依 |d| 排序的前 factorTopN 名
    function keyFactors(games, groups) {
        const W = games.filter(g => g.wl === 'W'), L = games.filter(g => g.wl === 'L');
        const out = [];
        flatMetrics(groups || groupDefs('TEAM')).forEach(m => {
            if (FACTOR_EXCLUDE.includes(m.key)) return;
            const xw = W.map(g => gameValue(g, m.key)).filter(v => v !== null);
            const xl = L.map(g => gameValue(g, m.key)).filter(v => v !== null);
            if (xw.length < 3 || xl.length < 3) return;
            const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
            const ss = (xs, mu) => xs.reduce((a, b) => a + (b - mu) * (b - mu), 0);
            const mw = mean(xw), ml = mean(xl);
            const sp = Math.sqrt((ss(xw, mw) + ss(xl, ml)) / (xw.length + xl.length - 2));
            if (!(sp > 0)) return;
            const d = (mw - ml) / sp;
            const wv = GA.metricOf(withValue(W, m.key), null, 'TEAM', m.key);
            const lv = GA.metricOf(withValue(L, m.key), null, 'TEAM', m.key);
            out.push({ key: m.key, metric: m, d, w: wv, l: lv, nW: xw.length, nL: xl.length });
        });
        return out.sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, rules().factorTopN);
    }

    return {
        OPP_PTS_DEF, MARGIN_DEF, oppOf, seasonList, windowSeasons, currentRegularGP, decorate, loadWindowGames,
        groupDefs, flatMetrics, gameValue, withValue, baseline, deviation, byOpponent, tagOpponents, keyFactors,
    };
})();
