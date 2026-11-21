// 單場數據聚合層（pure functions）：把逐場 games 算成季平均 / 每月 / 勝敗 / 主客 / 區間 / 趨勢
// 百分比欄位以「Σ分子 / Σ分母」加權重算，非把每場百分比平均（見 RATIO_DEFS）
// 計數欄位輸出場均（Σ / GP）；無法精確重算的比率/效率值退回逐場平均並在 UI 標註近似
window.GameAgg = (function () {
    // key → [分子欄, 分母欄]，輸出 = 100 * Σ分子 / Σ分母
    const RATIO_DEFS = {
        FG_PCT: ['FGM', 'FGA'], FG3_PCT: ['FG3M', 'FG3A'], FT_PCT: ['FTM', 'FTA'],
        DRIVE_FG_PCT: ['DRIVE_FGM', 'DRIVE_FGA'], DRIVE_TOV_PCT: ['DRIVE_TOV', 'DRIVES'],
        DRIVE_PTS_PCT: ['DRIVE_PTS', 'DRIVES'],   // 每百次切入得分（非百分比；×100 是 NBA 原欄位的尺度）
        CATCH_SHOOT_FG3_PCT: ['CATCH_SHOOT_FG3M', 'CATCH_SHOOT_FG3A'],
        PULL_UP_FG3_PCT: ['PULL_UP_FG3M', 'PULL_UP_FG3A'],
        RA_FG_PCT: ['RA_FGM', 'RA_FGA'], PAINT_FG_PCT: ['PAINT_FGM', 'PAINT_FGA'],
        MID_FG_PCT: ['MID_FGM', 'MID_FGA'], C3_FG_PCT: ['C3_FGM', 'C3_FGA'],
        AB3_FG_PCT: ['AB3_FGM', 'AB3_FGA'],
        D_FG_PCT: ['D_FGM', 'D_FGA'], D_FG3_PCT: ['D_FG3M', 'D_FG3A'],
        D_FG2_PCT: ['D_FG2M', 'D_FG2A'], D_RIM_PCT: ['D_RIM_FGM', 'D_RIM_FGA'],
        FG3A_FREQ: ['FG3A', 'FGA'],   // 三分出手占比（2026-11-12 起由逐場 base 算，取代停抓的投籃拆分）
        REB_COL_PCT: ['REB', 'REB_CHANCES'],
        PCT_BOX_OUTS_REB: ['BOX_OUT_REBS', 'BOX_OUTS'],   // 卡位後自己搶下比例（不以 _PCT 結尾，不加這行會被當次數相加）
        // 球員在場效率（每 100 回合得／失分）：逐場 bundle 的 ON_PTS／ON_OPP_PTS／ON_POSS 由進階 box 還原（2026-27 起）
        ON_OFF_RATING: ['ON_PTS', 'ON_POSS'], ON_DEF_RATING: ['ON_OPP_PTS', 'ON_POSS'],
    };
    // 最近防守者「vs 平常」：key → [命中欄, 出手欄, 平常命中率欄]
    // 輸出 = 100*Σ命中/Σ出手 − Σ(平常命中率×出手)/Σ出手（預期命中數加權；只用三欄都有、出手 > 0 的場次）
    // 舊做法是逐場百分點直接平均（1 投的場次和 10 投的場次一樣重），2026-11 改
    const NORMAL_DEFS = {
        PCT_PLUSMINUS: ['D_FGM', 'D_FGA', 'NORMAL_FG_PCT'],
        D_FG2_PLUSMINUS: ['D_FG2M', 'D_FG2A', 'NORMAL_FG2_PCT'],
        D_FG3_PLUSMINUS: ['D_FG3M', 'D_FG3A', 'NORMAL_FG3_PCT'],
        D_RIM_PLUSMINUS: ['D_RIM_FGM', 'D_RIM_FGA', 'NORMAL_RIM_PCT'],
    };
    // 差值：輸出 = 兩個加權值相減（各自先依 RATIO_DEFS 重算）
    const DIFF_DEFS = { ON_NET_RATING: ['ON_OFF_RATING', 'ON_DEF_RATING'] };
    // eFG 特殊公式：100 * (Σ分子 + 0.5*Σ三分分子) / Σ分母
    const EFG_DEFS = {
        EFG_PCT: ['FGM', 'FG3M', 'FGA'],
        CATCH_SHOOT_EFG_PCT: ['CATCH_SHOOT_FGM', 'CATCH_SHOOT_FG3M', 'CATCH_SHOOT_FGA'],
        PULL_UP_EFG_PCT: ['PULL_UP_FGM', 'PULL_UP_FG3M', 'PULL_UP_FGA'],
    };
    // 依權重欄加權平均：key → 權重欄（沒存分子、但「每場比率 × 權重」＝分子時用；如切入助攻率沒存切入助攻數）
    const WAVG_DEFS = { DRIVE_AST_PCT: 'DRIVES' };
    // 真實命中率：100 * Σ得分 / (2 * (Σ出手 + 0.44 * Σ罰球出手))，key → [得分, 出手, 罰球出手]（與 NBA 整季值一致，2026-11-12 驗證）
    const TS_DEFS = { TS_PCT: ['PTS', 'FGA', 'FTA'] };
    // 無法精確重算 → 退回逐場平均（比率/效率/頻率/距離類）
    const isAvgKey = k => /_PCT$|_FREQ$|_RATING$|PLUSMINUS$|PER_TOUCH$|REB_DIST$|TIME_OF_POSS$|PACE/.test(k);

    const round1 = window.Num.round1;

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

        const keys = new Set();
        rows.forEach(r => Object.keys(r).forEach(k => { if (typeof r[k] === 'number') keys.add(k); }));
        // 只要分母資料在，就一定算出該比率欄（即使某場未存 _PCT 本身）
        Object.keys(RATIO_DEFS).forEach(k => { if (keys.has(RATIO_DEFS[k][1])) keys.add(k); });
        Object.keys(EFG_DEFS).forEach(k => { if (keys.has(EFG_DEFS[k][2])) keys.add(k); });
        Object.keys(TS_DEFS).forEach(k => { if (keys.has(TS_DEFS[k][1])) keys.add(k); });
        Object.keys(DIFF_DEFS).forEach(k => { if (keys.has(RATIO_DEFS[DIFF_DEFS[k][0]][1])) keys.add(k); });
        Object.keys(NORMAL_DEFS).forEach(k => { if (keys.has(NORMAL_DEFS[k][1])) keys.add(k); });
        for (const k of keys) {
            if (k === 'playerId') { out[k] = rows[0][k]; continue; }
            // GP/W/L 由場次計算，勿被單場 base 的 per-game 值（每場 GP=1）覆寫
            if (k === 'GP' || k === 'W' || k === 'L') continue;
            out[k] = valueOf(rows, k);
        }
        return out;
    }

    // 單一欄位的聚合值（aggregate 與 metricOf 共用，確保兩條路徑規則一致）
    function valueOf(rows, k) {
        const sum = key => rows.reduce((a, r) => a + (typeof r[key] === 'number' ? r[key] : 0), 0);
        if (RATIO_DEFS[k]) {
            const d = sum(RATIO_DEFS[k][1]);
            return d ? round1(100 * sum(RATIO_DEFS[k][0]) / d) : 0;
        }
        if (DIFF_DEFS[k]) return round1(valueOf(rows, DIFF_DEFS[k][0]) - valueOf(rows, DIFF_DEFS[k][1]));
        if (NORMAL_DEFS[k]) {
            const [fgm, fga, nrm] = NORMAL_DEFS[k];
            const ok = rows.filter(r => typeof r[fgm] === 'number' && typeof r[nrm] === 'number' && r[fga] > 0);
            const att = ok.reduce((a, r) => a + r[fga], 0);
            if (att) return round1((100 * ok.reduce((a, r) => a + r[fgm], 0) - ok.reduce((a, r) => a + r[nrm] * r[fga], 0)) / att);
            // 舊資料沒有平常命中率（或命中數）→ 退回逐場平均（同 isAvgKey）
        }
        if (EFG_DEFS[k]) {
            const [fgm, fg3m, fga] = EFG_DEFS[k];
            const d = sum(fga);
            return d ? round1(100 * (sum(fgm) + 0.5 * sum(fg3m)) / d) : 0;
        }
        if (WAVG_DEFS[k]) {
            const w = WAVG_DEFS[k];
            const ok = rows.filter(r => typeof r[k] === 'number' && r[w] > 0);
            const tw = ok.reduce((a, r) => a + r[w], 0);
            if (tw) return round1(ok.reduce((a, r) => a + r[k] * r[w], 0) / tw);
        }
        if (TS_DEFS[k]) {
            const [pts, fga, fta] = TS_DEFS[k];
            const d = 2 * (sum(fga) + 0.44 * sum(fta));
            return d ? round1(100 * sum(pts) / d) : 0;
        }
        if (isAvgKey(k)) {
            const vals = rows.filter(r => typeof r[k] === 'number').map(r => r[k]);
            return round1(vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0);
        }
        return round1(sum(k) / rows.length); // 場均
    }

    // 最近防守者 vs 平常：這組比賽合計出手少於 DEF_SHOT_RULES.gameMin → 不給值（逐場走勢、比較頁逐場波動用；1 投 1 中就是 +50 的噪音）
    function tooFewShots(rows, k) {
        const d = NORMAL_DEFS[k], min = (window.DEF_SHOT_RULES || {}).gameMin;
        if (!d || !min) return false;
        return rows.reduce((a, r) => a + (typeof r[d[1]] === 'number' ? r[d[1]] : 0), 0) < min;
    }

    // 只算一個指標（賽季軌跡疊圖要對每個前 N 場重算，整包 aggregate 會多算上百個欄位）。
    // 這組比賽完全沒有該欄位（或比率的分母）→ null，不當成 0
    function metricOf(games, entityKey, viewMode, k) {
        const rows = [];
        for (const g of games) { const e = entityOf(g, entityKey, viewMode); if (e) rows.push(e); }
        if (!rows.length) return null;
        const need = RATIO_DEFS[k] ? RATIO_DEFS[k][1] : EFG_DEFS[k] ? EFG_DEFS[k][2] : TS_DEFS[k] ? TS_DEFS[k][1] : DIFF_DEFS[k] ? RATIO_DEFS[DIFF_DEFS[k][0]][1] : NORMAL_DEFS[k] ? NORMAL_DEFS[k][1] : k;
        if (!rows.some(r => typeof r[need] === 'number')) return null;
        if (tooFewShots(rows, k)) return null;
        return valueOf(rows, k);
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
        } else { // game：每點多帶 wl（走勢勝負底色）
            groups = games.slice().sort(byDate).map(g => ({ label: g.date, games: [g], wl: g.wl }));
        }
        return groups.map(gr => {
            const agg = aggregate(gr.games, entityKey, viewMode);
            const rows = gr.games.map(g => entityOf(g, entityKey, viewMode)).filter(Boolean);
            const value = tooFewShots(rows, metricKey) ? null : agg[metricKey];
            return { label: gr.label, value, gp: agg.GP, ...(gr.wl ? { wl: gr.wl } : {}) };
        }).filter(p => typeof p.value === 'number');
    }

    // ── 總覽「全隊效率／個人效率／在場不在場」的區間重算（2026-11-20 起）──
    // 讀逐場 bundle 每場的 adv（scripts/nba_common.py 的 box_team_adv／box_player_adv；欄位名兩邊一起改，見 tests/py/test_contracts.py）。
    // 公式與 2026-11-19 整季快照對帳過：approx 列的是逐場加權近似（與官方整季值差約 0.1～1，出賽少的球員差更多），其餘精確。
    // 缺輸入的指標回 null（不是 0）；advGP＝有單場進階數據的場次（效率類只算這些場，分子分母同一組場次）
    const num = v => (typeof v === 'number' && isFinite(v) ? v : 0);
    const isNum = v => typeof v === 'number' && isFinite(v);
    const r2 = v => Math.round(v * 100) / 100;
    const sumOf = (rows, f) => rows.reduce((a, r) => a + num(f(r)), 0);
    const ratio = (n, d, k = 100) => (d ? round1(k * n / d) : null);
    const wavg = (rows, val, w) => {
        const ok = rows.filter(r => isNum(val(r)) && isNum(w(r)) && w(r) > 0);
        const tw = sumOf(ok, w);
        return tw ? round1(ok.reduce((a, r) => a + val(r) * w(r), 0) / tw) : null;
    };
    // 對手得分：有對手數據用 opp.PTS，否則由 得分 − 正負值 推（舊場次）
    const oppPts = g => (g.opp && isNum(g.opp.PTS) ? g.opp.PTS : num((g.stats || {}).PTS) - num((g.stats || {}).PLUS_MINUS));

    const TEAM_ADV_APPROX = ['OREB_PCT', 'DREB_PCT'];
    function teamAdvanced(games) {
        const gs = (games || []).filter(g => g && g.stats);
        const S = (rows, k) => sumOf(rows, g => g.stats[k]);
        const fga = S(gs, 'FGA'), fta = S(gs, 'FTA'), fgm = S(gs, 'FGM');
        const out = { GP: gs.length, approx: TEAM_ADV_APPROX,
            TS_PCT: fga + fta ? round1(100 * S(gs, 'PTS') / (2 * (fga + 0.44 * fta))) : null,
            EFG_PCT: ratio(fgm + 0.5 * S(gs, 'FG3M'), fga), AST_PCT: ratio(S(gs, 'AST'), fgm) };
        const adv = gs.filter(g => g.adv && isNum(g.adv.POSS) && isNum(g.adv.OPP_POSS));
        out.advGP = adv.length;
        const poss = sumOf(adv, g => g.adv.POSS), oposs = sumOf(adv, g => g.adv.OPP_POSS);
        const off = poss ? 100 * S(adv, 'PTS') / poss : null, def = oposs ? 100 * sumOf(adv, oppPts) / oposs : null;
        out.OFF_RATING = off == null ? null : round1(off);
        out.DEF_RATING = def == null ? null : round1(def);
        out.NET_RATING = off == null || def == null ? null : round1(off - def);
        out.PACE = wavg(adv, g => g.adv.PACE, g => g.adv.GMIN);
        out.TM_TOV_PCT = ratio(S(adv, 'TOV'), poss);
        const reb = (k) => { const ok = adv.filter(g => isNum(g.adv[k + '_CH'])); return ratio(S(ok, k), sumOf(ok, g => g.adv[k + '_CH'])); };
        out.OREB_PCT = reb('OREB');
        out.DREB_PCT = reb('DREB');
        return out;
    }

    const PLAYER_ADV_APPROX = ['USG_PCT', 'AST_PCT', 'OREB_PCT', 'DREB_PCT', 'REB_PCT', 'PIE'];
    function playerAdvanced(pgames) {
        const gs = (pgames || []).filter(g => g && g.stats);
        const S = k => sumOf(gs, g => g.stats[k]);
        const fga = S('FGA'), fta = S('FTA'), ast = S('AST'), tov = S('TOV');
        const adv = gs.filter(g => g.adv && isNum(g.adv.POSS));
        const byPoss = k => wavg(adv, g => g.adv[k], g => g.adv.POSS);
        return { GP: gs.length, advGP: adv.length, approx: PLAYER_ADV_APPROX,
            AST_TO: tov ? r2(ast / tov) : null,
            TM_TOV_PCT: ratio(tov, fga + 0.44 * fta + ast + tov),
            USG_PCT: byPoss('USG_PCT'), AST_PCT: byPoss('AST_PCT'),
            OREB_PCT: byPoss('OREB_PCT'), DREB_PCT: byPoss('DREB_PCT'), REB_PCT: byPoss('REB_PCT'),
            PIE: wavg(adv, g => g.adv.PIE, g => g.adv.PIE_W) };
    }

    // 在場／不在場（球員）：teamGames＝這個期間的全隊逐場（場次範圍依全隊，含球員沒上場的場次）。
    // 在場：該員有上場的場次，Σ在場得失分 ÷ Σ在場回合（bundle stats 的 ON_*，精確）。
    // 不在場：有上場的場次用官方單場不在場效率、依 OFF_W（估計的不在場回合）加權；沒上場的場次（含加入前、缺陣）算整場全隊。
    //   NBA 整季值也是這樣算（2026-11-20 用只打 1 場、3 場的球員驗證，只從首場起算會差 3 分）。
    //   不可用「全隊 − 在場」推不在場的效率（CLAUDE.md），這裡全隊整場只用在該員沒上場的場次
    // 節奏（2026-11-21 起）：在場＝Σ(單場在場節奏 × 上場分鐘) ÷ Σ上場分鐘；不在場＝Σ(單場不在場節奏 × 不在場分鐘)，
    //   沒上場的場次用全隊整場節奏 × (比賽分鐘÷5)，再除以總分鐘。兩者與 On/Off 快照差 ≤ 0.06（精確）；缺節奏的場次不計入節奏
    // 缺資料的場次（沒有單場 On/Off 或全隊 adv）跳過，missing 記場數
    const ONOFF_APPROX = ['OFF_OFF_RATING', 'OFF_DEF_RATING', 'OFF_NET_RATING'];
    function onOff(pgames, teamGames) {
        const tg = (teamGames || []).filter(g => g && g.stats);
        const byDate = {};
        (pgames || []).forEach(g => { if (g && g.stats) byDate[g.date] = g; });
        const played = tg.map(g => byDate[g.date]).filter(Boolean);
        const onPoss = sumOf(played, g => g.stats.ON_POSS);
        let op = 0, od = 0, ow = 0, missing = 0, offPn = 0, offPm = 0;
        tg.forEach(t => {
            const p = byDate[t.date];
            if (p) {
                const a = p.adv || {};
                if (isNum(a.OFF_W) && isNum(a.OFF_OFF_RATING) && isNum(a.OFF_DEF_RATING)) {
                    op += a.OFF_OFF_RATING * a.OFF_W / 100; od += a.OFF_DEF_RATING * a.OFF_W / 100; ow += a.OFF_W;
                } else missing++;
                if (isNum(a.OFF_PACE) && isNum(a.OFF_MIN)) { offPn += a.OFF_PACE * a.OFF_MIN; offPm += a.OFF_MIN; }
            } else if (t.adv && isNum(t.adv.POSS)) {
                op += num(t.stats.PTS); od += oppPts(t); ow += t.adv.POSS;
                if (isNum(t.adv.PACE) && isNum(t.adv.GMIN)) { offPn += t.adv.PACE * t.adv.GMIN / 5; offPm += t.adv.GMIN / 5; }
            } else missing++;
        });
        const on = onPoss ? [100 * sumOf(played, g => g.stats.ON_PTS) / onPoss, 100 * sumOf(played, g => g.stats.ON_OPP_PTS) / onPoss] : null;
        const off = ow ? [100 * op / ow, 100 * od / ow] : null;
        const onPaced = played.filter(g => g.adv && isNum(g.adv.PACE) && num(g.stats.MIN) > 0);
        return { GP: played.length, teamGP: tg.length, missing, approx: ONOFF_APPROX,
            ON_OFF_RATING: on && round1(on[0]), ON_DEF_RATING: on && round1(on[1]), ON_NET_RATING: on && round1(on[0] - on[1]),
            OFF_OFF_RATING: off && round1(off[0]), OFF_DEF_RATING: off && round1(off[1]), OFF_NET_RATING: off && round1(off[0] - off[1]),
            ON_PACE: wavg(onPaced, g => g.adv.PACE, g => g.stats.MIN), OFF_PACE: offPm ? round1(offPn / offPm) : null };
    }
    // 前後端成對：bundle adv 會讀到的欄位（tests/py/test_contracts.py 對照 nba_common.BUNDLE_*_ADV_KEYS）
    const ADV_KEYS_READ = {
        team: ['POSS', 'OPP_POSS', 'PACE', 'GMIN', 'OREB_CH', 'DREB_CH'],
        player: ['POSS', 'USG_PCT', 'AST_PCT', 'OREB_PCT', 'DREB_PCT', 'REB_PCT', 'PIE', 'PIE_W', 'PACE',
            'OFF_OFF_RATING', 'OFF_DEF_RATING', 'OFF_W', 'OFF_PACE', 'OFF_MIN'],
    };

    return {
        teamAdvanced, playerAdvanced, onOff, ADV_KEYS_READ,
        RATIO_DEFS, EFG_DEFS, TS_DEFS, NORMAL_DEFS, WAVG_DEFS, aggregate, metricOf, seasonToDate,
        splitByMonth, splitByWinLoss, splitByHomeAway, lastN, byDateRange, splitBySeries,
        trendSeries, weekKey,
    };
})();
