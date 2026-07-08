// 單場數據聚合層（pure functions）：把逐場 games 算成季平均 / 每月 / 勝敗 / 主客 / 區間 / 趨勢
// 百分比欄位以「Σ分子 / Σ分母」加權重算，非把每場百分比平均（見 RATIO_DEFS）
// 計數欄位輸出場均（Σ / GP）；無法精確重算的比率/效率值退回逐場平均並在 UI 標註近似
window.GameAgg = (function () {
    // key → [分子欄, 分母欄]，輸出 = 100 * Σ分子 / Σ分母
    const RATIO_DEFS = {
        FG_PCT: ['FGM', 'FGA'], FG3_PCT: ['FG3M', 'FG3A'], FT_PCT: ['FTM', 'FTA'],
        DRIVE_FG_PCT: ['DRIVE_FGM', 'DRIVE_FGA'], DRIVE_TOV_PCT: ['DRIVE_TOV', 'DRIVES'],
        CATCH_SHOOT_FG3_PCT: ['CATCH_SHOOT_FG3M', 'CATCH_SHOOT_FG3A'],
        PULL_UP_FG3_PCT: ['PULL_UP_FG3M', 'PULL_UP_FG3A'],
        RA_FG_PCT: ['RA_FGM', 'RA_FGA'], PAINT_FG_PCT: ['PAINT_FGM', 'PAINT_FGA'],
        MID_FG_PCT: ['MID_FGM', 'MID_FGA'], C3_FG_PCT: ['C3_FGM', 'C3_FGA'],
        AB3_FG_PCT: ['AB3_FGM', 'AB3_FGA'],
        D_FG_PCT: ['D_FGM', 'D_FGA'], D_FG3_PCT: ['D_FG3M', 'D_FG3A'],
        REB_COL_PCT: ['REB', 'REB_CHANCES'],
    };
    // eFG 特殊公式：100 * (Σ分子 + 0.5*Σ三分分子) / Σ分母
    const EFG_DEFS = {
        CATCH_SHOOT_EFG_PCT: ['CATCH_SHOOT_FGM', 'CATCH_SHOOT_FG3M', 'CATCH_SHOOT_FGA'],
        PULL_UP_EFG_PCT: ['PULL_UP_FGM', 'PULL_UP_FG3M', 'PULL_UP_FGA'],
    };
    // 無法精確重算 → 退回逐場平均（比率/效率/頻率/距離類）
    const isAvgKey = k => /_PCT$|_FREQ$|_RATING$|PLUSMINUS$|PER_TOUCH$|REB_DIST$|TIME_OF_POSS$|PACE/.test(k);

    const round1 = v => Math.round(v * 10) / 10;

    function entityOf(game, entityKey, viewMode) {
        if (viewMode === 'TEAM') return game.stats || null;
        return (game.players || {})[entityKey] || null;
    }

    // 聚合一組 games 內某實體所有欄位；回傳含 GP / W / L 及各欄位聚合值
    function aggregate(games, entityKey, viewMode) {
        const rows = [];
        let W = 0, L = 0;
        for (const g of games) {
            const e = entityOf(g, entityKey, viewMode);
            if (!e) continue;
            rows.push(e);
            if (g.wl === 'W') W++; else if (g.wl === 'L') L++;
        }
        const GP = rows.length;
        const out = { GP, W, L };
        if (!GP) return out;

        const sum = k => rows.reduce((a, r) => a + (typeof r[k] === 'number' ? r[k] : 0), 0);
        const meanOf = k => {
            const vals = rows.filter(r => typeof r[k] === 'number').map(r => r[k]);
            return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
        };

        const keys = new Set();
        rows.forEach(r => Object.keys(r).forEach(k => { if (typeof r[k] === 'number') keys.add(k); }));
        // 只要分母資料在，就一定算出該比率欄（即使某場未存 _PCT 本身）
        Object.keys(RATIO_DEFS).forEach(k => { if (keys.has(RATIO_DEFS[k][1])) keys.add(k); });
        Object.keys(EFG_DEFS).forEach(k => { if (keys.has(EFG_DEFS[k][2])) keys.add(k); });
        for (const k of keys) {
            if (k === 'playerId') { out[k] = rows[0][k]; continue; }
            if (RATIO_DEFS[k]) {
                const d = sum(RATIO_DEFS[k][1]);
                out[k] = d ? round1(100 * sum(RATIO_DEFS[k][0]) / d) : 0;
            } else if (EFG_DEFS[k]) {
                const [fgm, fg3m, fga] = EFG_DEFS[k];
                const d = sum(fga);
                out[k] = d ? round1(100 * (sum(fgm) + 0.5 * sum(fg3m)) / d) : 0;
            } else if (isAvgKey(k)) {
                out[k] = round1(meanOf(k));
            } else {
                out[k] = round1(sum(k) / GP); // 場均
            }
        }
        return out;
    }

    // ── 篩選 / 分組 ──
    const byDate = (a, b) => (a.date < b.date ? -1 : 1);

    function seasonToDate(games, untilDate, entityKey, viewMode) {
        const sub = untilDate ? games.filter(g => g.date <= untilDate) : games;
        return aggregate(sub, entityKey, viewMode);
    }
    function splitByMonth(games) {
        const m = {};
        games.forEach(g => { const k = (g.date || '').slice(0, 7); (m[k] = m[k] || []).push(g); });
        return Object.keys(m).sort().map(k => ({ label: k, games: m[k] }));
    }
    function splitByWinLoss(games) {
        return [
            { label: '勝場', games: games.filter(g => g.wl === 'W') },
            { label: '敗場', games: games.filter(g => g.wl === 'L') },
        ].filter(x => x.games.length);
    }
    function splitByHomeAway(games) {
        return [
            { label: '主場', games: games.filter(g => (g.matchup || '').includes('vs.')) },
            { label: '客場', games: games.filter(g => (g.matchup || '').includes('@')) },
        ].filter(x => x.games.length);
    }
    function lastN(games, n) {
        return games.slice().sort(byDate).slice(-n);
    }
    function byDateRange(games, from, to) {
        return games.filter(g => (!from || g.date >= from) && (!to || g.date <= to));
    }
    // 季後賽以「連續同對手」分系列賽
    function splitBySeries(games) {
        const oppOf = m => (m || '').replace(/^.*?(vs\.|@)\s*/, '');
        const series = [];
        let cur = null;
        games.slice().sort(byDate).forEach(g => {
            const opp = oppOf(g.matchup);
            if (!cur || cur.opp !== opp) { cur = { opp, label: `vs ${opp}`, games: [] }; series.push(cur); }
            cur.games.push(g);
        });
        return series.map(s => ({ label: s.label, games: s.games }));
    }

    // 該週週一（趨勢圖每週分組用）
    function weekKey(dateStr) {
        const d = new Date(dateStr + 'T00:00:00');
        const day = (d.getDay() + 6) % 7; // Mon=0
        d.setDate(d.getDate() - day);
        return d.toISOString().slice(0, 10);
    }

    // 趨勢序列：粒度 game | week | month（season 跨季由 Phase 5 呼叫端組）
    // 每點 = 該組聚合後的 metricKey 值（多場加權平均），回傳 [{label, value, gp}]
    function trendSeries(games, entityKey, viewMode, metricKey, granularity) {
        let groups;
        if (granularity === 'week') {
            const m = {};
            games.forEach(g => { const k = weekKey(g.date); (m[k] = m[k] || []).push(g); });
            groups = Object.keys(m).sort().map(k => ({ label: k, games: m[k] }));
        } else if (granularity === 'month') {
            groups = splitByMonth(games);
        } else { // game
            groups = games.slice().sort(byDate).map(g => ({ label: g.date, games: [g] }));
        }
        return groups.map(gr => {
            const agg = aggregate(gr.games, entityKey, viewMode);
            return { label: gr.label, value: agg[metricKey], gp: agg.GP };
        }).filter(p => typeof p.value === 'number');
    }

    return {
        RATIO_DEFS, EFG_DEFS, aggregate, seasonToDate,
        splitByMonth, splitByWinLoss, splitByHomeAway, lastN, byDateRange, splitBySeries,
        trendSeries, weekKey,
    };
})();
