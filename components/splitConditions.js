// 條件戰績資料層：window.SplitCond（Splits「條件」用；不含 JSX）
// 條件（最多 CONDITION_RULES.maxConds 個，彼此為「且」）：
//   { who: 'T'（全隊）| 球員ID, kind: 'stat', key, op: 'ge'|'le', value }   某人／全隊該場〈指標〉≥／≤ 數值
//   { who: 球員ID, kind: 'played' | 'absent' }                             該員有出賽／未出賽（只算在隊期間）
// 篩選一律以「全隊逐場」的日期為母體（球員視角也是），再由呼叫端取該實體在這些日期的場次算平均
// 在隊期間：第一次出賽 → 最後一次出賽；以下兩種延到該季最新一場：
//   1. 當季、且仍在名冊上（ctx.rosterIds）——季中受傷缺陣才算得進「未出賽」（2026-11-12 起；舊規則把傷停的人當成離隊）
//   2. 最後一次出賽在交易截止日（CONDITION_RULES.deadlineMD）之後（歷史賽季沒有當時名冊，只能靠這條）
// 網址：c=1630162:PTS:ge:30~T:TOV:le:12、c=203497:absent（serialize／parse）
window.SplitCond = (function () {
    const R = () => window.CONDITION_RULES || { maxConds: 2, deadlineMD: '02-15', minAtt: 3 };
    const OPS = { ge: '≥', le: '≤' };

    // ── 指標中繼資料：取 Splits 用的 defs（新增指標自動可選）──
    const allDefs = () => [window.SPLITS_BASE_DEF, ...(window.trackingDefs || []), ...(window.shootingDefs || []), ...(window.defenseDefs || [])].filter(Boolean);
    // 條件專用的次數欄：Splits 卡片只列比率（命中率、三分%），但條件最常問的是次數（投進 5 顆三分、上場 30 分鐘）。
    // 逐場 bundle 都有這些欄；playerOnly＝只對球員有意義（全隊上場時間固定 240）
    const EXTRA = [
        { key: 'MIN', label: '上場時間', englishLabel: 'MIN', playerOnly: true },
        { key: 'FGM', label: '投籃命中', englishLabel: 'FGM' }, { key: 'FGA', label: '出手數', englishLabel: 'FGA' },
        { key: 'FG3M', label: '三分命中', englishLabel: '3PM' }, { key: 'FG3A', label: '三分出手', englishLabel: '3PA' },
        { key: 'FTA', label: '罰球出手', englishLabel: 'FTA' },
        { key: 'OREB', label: '進攻籃板', englishLabel: 'OREB' }, { key: 'DREB', label: '防守籃板', englishLabel: 'DREB' },
        { key: 'PF', label: '犯規', englishLabel: 'PF' },
    ];
    const metaOf = (key) => {
        for (const d of allDefs()) { const m = d.metrics.find(x => x.key === key); if (m) return m; }
        return EXTRA.find(x => x.key === key) || { key, label: key };
    };
    const isPct = (key) => metaOf(key).unit === '%' || /_PCT$/.test(key);
    // 球員命中率類條件的分母（出手數）：沿用 GameAgg 的比率定義
    const denOf = (key) => {
        const GA = window.GameAgg || {};
        const r = (GA.RATIO_DEFS || {})[key] || (GA.EFG_DEFS || {})[key];
        return r ? r[r.length - 1] : null;
    };

    // 球員名縮寫：Anthony Edwards → A. Edwards（與單場頁 Box Score 手機版同規則）
    const abbr = (name) => {
        const parts = String(name || '').trim().split(/\s+/);
        return parts.length < 2 ? (name || '') : `${parts[0][0]}. ${parts.slice(1).join(' ')}`;
    };
    const fmtVal = (key, v) => `${Math.round(v * 10) / 10}${isPct(key) ? '%' : ''}`;

    // ── 網址 ──
    const serialize = (conds) => (conds || []).filter(isComplete).map(c =>
        c.kind === 'stat' ? [c.who, c.key, c.op, c.value].join(':') : [c.who, c.kind].join(':')).join('~');
    const parse = (str) => String(str || '').split('~').filter(Boolean).slice(0, R().maxConds).map(s => {
        const [who, a, op, v] = s.split(':');
        const w = who === 'T' ? 'T' : Number(who);
        if (w !== 'T' && !w) return null;
        if (a === 'played' || a === 'absent') return w === 'T' ? null : { who: w, kind: a };
        if (!a || !OPS[op] || v === undefined || isNaN(Number(v))) return null;
        return { who: w, kind: 'stat', key: a, op, value: Number(v) };
    }).filter(Boolean);
    const isComplete = (c) => !!c && (c.kind === 'played' || c.kind === 'absent'
        ? c.who !== 'T' && !!c.who
        : c.kind === 'stat' && !!c.who && !!c.key && !!OPS[c.op] && typeof c.value === 'number' && !isNaN(c.value));
    // 需要讀逐場 bundle 的球員
    const needPids = (conds) => [...new Set((conds || []).filter(c => isComplete(c) && c.who !== 'T').map(c => c.who))];

    // ── 在隊期間 ──
    // teamGames：該季該賽別全隊逐場（由舊到新）；playerGames：該員同季同賽別逐場；onRoster：當季且仍在名冊上
    const tenure = (teamGames, playerGames, season, onRoster = false) => {
        const ds = (playerGames || []).map(g => g.date).sort();
        if (!ds.length) return null;
        const end = teamGames.length ? teamGames[teamGames.length - 1].date : ds[ds.length - 1];
        const deadline = `${Number(String(season).slice(0, 4)) + 1}-${R().deadlineMD}`;
        const last = ds[ds.length - 1];
        return { from: ds[0], to: onRoster || last > deadline ? end : last, lastPlayed: last };
    };

    // ── 篩選：回傳符合條件的全隊場次日期 Set ──
    // ctx：{ teamGames, playerGames: { [pid]: games[] }, season, rosterIds（當季名冊 PlayerID 陣列；歷史賽季不傳）}
    const evaluate = (conds, ctx) => {
        const list = (conds || []).filter(isComplete);
        const team = ctx.teamGames || [];
        const roster = new Set((ctx.rosterIds || []).map(Number));
        const byPid = {};
        needPids(list).forEach(pid => {
            const gs = (ctx.playerGames || {})[pid] || [];
            byPid[pid] = { map: Object.fromEntries(gs.map(g => [g.date, g])), ten: tenure(team, gs, ctx.season, roster.has(Number(pid))) };
        });
        const test = (c, tg) => {
            if (c.who === 'T') {
                const v = (tg.stats || {})[c.key];
                return typeof v === 'number' && (c.op === 'ge' ? v >= c.value : v <= c.value);
            }
            const p = byPid[c.who], pg = p && p.map[tg.date];
            if (c.kind === 'played') return !!pg;
            if (c.kind === 'absent') return !pg && !!p.ten && tg.date >= p.ten.from && tg.date <= p.ten.to;
            if (!pg) return false;   // 數據條件：沒上場就不算符合
            const st = pg.stats || {}, v = st[c.key], den = denOf(c.key);
            if (typeof v !== 'number') return false;
            if (den && (st[den] || 0) < R().minAtt) return false;
            return c.op === 'ge' ? v >= c.value : v <= c.value;
        };
        return new Set(team.filter(tg => list.every(c => test(c, tg))).map(tg => tg.date));
    };

    // ── 戰績摘要：符合／其他／全部 ──
    const record = (games) => {
        const n = games.length, w = games.filter(g => g.wl === 'W').length;
        const pms = games.map(g => (g.stats || {}).PLUS_MINUS).filter(v => typeof v === 'number');
        return { n, w, l: n - w, pct: n ? w / n : null, pm: pms.length ? pms.reduce((a, b) => a + b, 0) / pms.length : null };
    };
    const summary = (teamGames, dates) => ({
        match: record(teamGames.filter(g => dates.has(g.date))),
        rest: record(teamGames.filter(g => !dates.has(g.date))),
        all: record(teamGames),
    });

    // ── 文字：單行緊湊寫法（A. Edwards 得分≥30・全隊失誤≤12）──
    // nameOf(pid) → 球員全名（呼叫端由名單對回）
    const condLabel = (c, nameOf) => {
        const who = c.who === 'T' ? '全隊' : `${abbr(nameOf(c.who))} `;
        if (c.kind === 'played') return `${who}有出賽`;
        if (c.kind === 'absent') return `${who}未出賽`;
        return `${who}${window.metricLabel(metaOf(c.key))}${OPS[c.op]}${fmtVal(c.key, c.value)}`;
    };
    const label = (conds, nameOf) => (conds || []).filter(isComplete).map(c => condLabel(c, nameOf)).join('・');

    return { OPS, EXTRA, metaOf, isPct, denOf, abbr, serialize, parse, isComplete, needPids, tenure, evaluate, record, summary, condLabel, label };
})();
