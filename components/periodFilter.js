// 全域期間篩選（window.Period）：主畫面各章節共用的「算哪些比賽」。狀態放 App、寫進網址，換章節不重設
// 狀態：{ kind, month, opp, series, start, end, conds }
//   kind：all 全季／W 勝場／L 敗場／home 主場／away 客場／last5／last10／month 每月／opp 對手／series 系列賽（季後賽）／range 自訂區間／cond 條件
//   條件（cond）的判斷全在 splitConditions.js 的 window.SplitCond，這裡只負責接上
// 網址：pd=（W、last5、month:2026-11、opp:DEN、series:1、range:2026-10-21:2026-11-08）；條件沿用 c=（格式見 splitConditions.js）
// 想加新的期間類型：apply 加一個分支、serialize／parse 加一種寫法、PeriodControl 加選項；各章節不用動
window.Period = (function () {
    const GA = () => window.GameAgg;
    const SC = () => window.SplitCond;
    const ALL = Object.freeze({ kind: 'all', conds: [] });
    const SIMPLE = ['W', 'L', 'home', 'away', 'last5', 'last10'];
    const SIMPLE_LABEL = { W: '勝場', L: '敗場', home: '主場', away: '客場', last5: '近 5 場', last10: '近 10 場' };
    const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

    const isActive = (st) => !!st && st.kind !== 'all';
    const oppOf = (g) => g.oppAbbr || (window.Matchup ? window.Matchup.oppOf(g.matchup) : '');
    const months = (games) => GA().splitByMonth(games || []).map(g => g.label);
    // 對手清單（三碼排序＋場數）
    const opps = (games) => Object.entries((games || []).reduce((m, g) => { const a = oppOf(g); if (a) m[a] = (m[a] || 0) + 1; return m; }, {})).sort();
    const series = (games) => GA().splitBySeries(games || []);
    const completeConds = (st) => (SC() && st && st.conds ? st.conds.filter(SC().isComplete) : []);

    // ── 網址 ──
    const serialize = (st) => {
        if (!st || st.kind === 'all' || st.kind === 'cond') return '';
        if (SIMPLE.includes(st.kind)) return st.kind;
        if (st.kind === 'month' && st.month) return `month:${st.month}`;
        if (st.kind === 'opp' && st.opp) return `opp:${st.opp}`;
        if (st.kind === 'series' && st.series != null) return `series:${st.series}`;
        if (st.kind === 'range' && (st.start || st.end)) return `range:${st.start || ''}:${st.end || ''}`;
        return '';
    };
    const condStr = (st) => (st && st.kind === 'cond' && SC() ? SC().serialize(st.conds) : '');
    const parse = (pd, c) => {
        if (c && SC() && SC().parse(c).length) return { kind: 'cond', conds: SC().parse(c) };
        const s = String(pd || '');
        if (SIMPLE.includes(s)) return { kind: s, conds: [] };
        let m;
        if ((m = /^month:(\d{4}-\d{2})$/.exec(s))) return { kind: 'month', month: m[1], conds: [] };
        if ((m = /^opp:([A-Z]{3})$/.exec(s))) return { kind: 'opp', opp: m[1], conds: [] };
        if ((m = /^series:(\d{1,2})$/.exec(s))) return { kind: 'series', series: Number(m[1]), conds: [] };
        if ((m = /^range:([\d-]*):([\d-]*)$/.exec(s)) && (DATE_RE.test(m[1]) || DATE_RE.test(m[2])))
            return { kind: 'range', start: DATE_RE.test(m[1]) ? m[1] : '', end: DATE_RE.test(m[2]) ? m[2] : '', conds: [] };
        return ALL;
    };

    // 條件需要的額外逐場：球員視角時要全隊逐場當母體；條件提到的球員要各自的逐場
    const needs = (st, isTeam) => {
        if (!st || st.kind !== 'cond' || !SC()) return { team: false, pids: [] };
        return { team: !isTeam, pids: SC().needPids(st.conds) };
    };

    // ── 套用：games 是目前實體（全隊或球員）的逐場；回傳 { games, label, cond }
    // ctx：{ isTeam, teamGames（全隊逐場，全隊視角＝games）, playerGames: {pid: games[]}, season, nameOf(pid), isPlayoffs,
    //        rosterIds（當季名冊 PlayerID；「未出賽」的在隊期間用，歷史賽季不傳）}
    // cond：非條件期間為 undefined；條件資料還沒到齊＝null；條件沒填完＝{ ready: false }；
    //       到齊＝{ ready, dates, sum（符合／其他／全季戰績）, label, matched（符合的全隊場次）}
    const apply = (games, st, ctx = {}) => {
        games = games || [];
        st = st || ALL;
        const k = st.kind;
        if (k === 'all') return { games, label: '全季' };
        if (SIMPLE.includes(k)) {
            const sub = k === 'W' ? games.filter(g => g.wl === 'W') : k === 'L' ? games.filter(g => g.wl === 'L')
                : k === 'home' ? games.filter(g => (g.matchup || '').includes('vs.')) : k === 'away' ? games.filter(g => (g.matchup || '').includes('@'))
                : GA().lastN(games, k === 'last5' ? 5 : 10);
            return { games: sub, label: SIMPLE_LABEL[k] };
        }
        if (k === 'month') return { games: games.filter(g => (g.date || '').slice(0, 7) === st.month), label: st.month || '每月' };
        if (k === 'range') return { games: GA().byDateRange(games, st.start, st.end), label: `${st.start || '起'}~${st.end || '訖'}` };
        if (k === 'series') { const s = series(games)[st.series] || {}; return { games: s.games || [], label: s.label || '系列' }; }
        if (k === 'opp') return { games: games.filter(g => oppOf(g) === st.opp), label: `對 ${st.opp} ${window.teamName(st.opp)}` };
        if (k === 'cond' && SC()) {
            const teamGames = ctx.isTeam ? games : ctx.teamGames;
            const complete = completeConds(st);
            if (!complete.length) return { games: [], label: '條件', cond: { ready: false } };
            const loaded = teamGames && SC().needPids(complete).every(pid => (ctx.playerGames || {})[pid]);
            if (!loaded) return { games: [], label: '條件', cond: null };
            const dates = SC().evaluate(complete, { teamGames, playerGames: ctx.playerGames || {}, season: ctx.season, rosterIds: ctx.rosterIds });
            const label = SC().label(complete, ctx.nameOf || String);
            return {
                games: games.filter(g => dates.has(g.date)), label,
                cond: { ready: true, dates, label, sum: SC().summary(teamGames, dates), matched: teamGames.filter(g => dates.has(g.date)) },
            };
        }
        return { games, label: '全季' };
    };

    // 戰績小計（膠囊、手機提示列用）：n 場 · w 勝 l 敗
    const record = (games) => {
        const n = (games || []).length, w = (games || []).filter(g => g.wl === 'W').length;
        return { n, w, l: n - w };
    };

    return { ALL, SIMPLE, SIMPLE_LABEL, isActive, oppOf, months, opps, series, completeConds, serialize, condStr, parse, needs, apply, record };
})();
