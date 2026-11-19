// App.js 的純計算（不含 React、不讀 Firestore）：歷史快照轉換、快照定位與取值、休賽期／陳舊提示、球員名單排序、
// 防守缺資料說明、身分列薪資膠囊、未開打場次、附加賽摘要、組合／比較頁的狀態更新。
// 全部掛在 window.AppLogic，Node 可直接測（tests/js/applogic.test.js）。2026-11-19 由 App.js 拆出（技術債 F 批）
(function () {
    const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

    // 歷史 player doc（PlayerID-keyed）轉成與每日快照同構（playerName-keyed），各類別皆以球員名展開
    const HISTORY_CATS = ['tracking', 'base', 'shooting', 'clutch', 'defense', 'onoff', 'advanced', 'scoring'];
    const normalizeHistoryPlayer = (doc) => {
        if (!doc) return doc;
        const out = { stats: {}, meta: {} };
        HISTORY_CATS.forEach(c => { out[c] = {}; });
        Object.entries(doc.stats || {}).forEach(([pid, p]) => {
            const name = p.playerName;
            if (!name) return;
            const pidNum = parseInt(pid, 10);
            out.stats[name] = (p.stats || []).map(s => ({ ...s, playerId: pidNum }));
            // meta：球員層級的 metadata（非統計值）。teamAbbr 用來標示新援該季的舊東家，
            // isNewcomer 用來判定對位防守 / On-Off 是「跨隊不適用」而非 0
            out.meta[name] = {
                playerId: pidNum,
                teamAbbr: p.teamAbbr || null,
                isCurrentRoster: !!p.isCurrentRoster,
                isNewcomer: !!p.isNewcomer,
            };
            HISTORY_CATS.forEach(c => {
                out[c][name] = {
                    ...(p[c] || {}), playerId: pidNum,
                    isCurrentRoster: !!p.isCurrentRoster, teamAbbr: p.teamAbbr || null,
                };
            });
        });
        return { ...doc, ...out };
    };

    // 快照序列（date 新到舊）中第一個 <= date 的位置（時光機）；歷史模式只有一份終點快照
    const seqIndex = (seq, date, isHistory) => {
        if (isHistory) return 0;
        const i = (seq || []).findIndex(d => d.date <= date);
        return i === -1 ? 0 : i;
    };

    // 目前檢視（全隊或某球員）要用的各類別：current＝定位到的快照、prev＝前一份（箭頭比較用）
    const pickView = (viewMode, current, prev, player) => {
        const v = {
            currentStats: [], currentTracking: {}, currentClutch: {}, currentDefense: {}, currentLineups: [],
            currentOnoff: {}, currentBase: {}, prevStats: [], prevDefense: {},
            displayDate: '尚無數據', currentPlayerId: null, selectedMeta: null, currentSeason: null, currentSeasonType: null,
        };
        if (current) { v.currentSeason = current.season; v.currentSeasonType = current.seasonType; }
        if (viewMode === 'TEAM') {
            if (current) {
                v.currentStats = current.stats || []; v.currentTracking = current.tracking || {}; v.displayDate = current.date;
                v.currentClutch = current.clutch || {}; v.currentDefense = current.defense || {};
                v.currentLineups = current.lineups || []; v.currentBase = current.base || {};
            }
            if (prev) { v.prevStats = prev.stats || []; v.prevDefense = prev.defense || {}; }
            return v;
        }
        // 開季初 NBA 尚未釋出 Synergy，快照只有 base 等類別 → 以 base 判定球員存在
        if (current && ((current.stats || {})[player] || (current.base || {})[player])) {
            const of = (c) => (current[c] || {})[player];
            v.currentStats = of('stats') || []; v.currentTracking = of('tracking') || {}; v.displayDate = current.date;
            v.currentClutch = of('clutch') || {}; v.currentDefense = of('defense') || {};
            v.currentOnoff = of('onoff') || {}; v.currentBase = of('base') || {};
            // PlayerID 依序從 Synergy → tracking → base → meta 取；新援若 Synergy 與 tracking 皆空（出賽極少），
            // 前兩層撈不到 ID，投籃章節會誤顯示「請先選擇球員」
            const meta = (current.meta || {})[player];
            v.currentPlayerId = (v.currentStats[0] && v.currentStats[0].playerId) || v.currentTracking.playerId
                || v.currentBase.playerId || (meta && meta.playerId) || null;
        }
        v.selectedMeta = (current && (current.meta || {})[player]) || null;
        if (prev) { v.prevStats = (prev.stats || {})[player] || []; v.prevDefense = (prev.defense || {})[player] || {}; }
        return v;
    };

    // 休賽期／資料陳舊提示（刊頭下的細條）；歷史模式不提示。now 可注入（測試用）
    const seasonStatus = ({ isHistory, phase, latest, season, now }) => {
        if (isHistory) return null;
        if (phase && !phase.inSeason) {
            return { kind: 'offseason', message: `目前為休賽期，以下為 ${season || ''} 賽季最終數據（非即時），下次更新預計 10/20` };
        }
        if (!latest) return null;
        const t = new Date(latest + 'T00:00:00').getTime();
        if (isNaN(t)) return null;
        const ageDays = ((now == null ? Date.now() : now) - t) / 86400000;
        if (ageDays > 2) return { kind: 'stale', message: `最新資料為 ${latest}，已超過 2 天未更新（${Math.floor(ageDays)} 天前）` };
        return null;
    };

    // 頭像列的球員名單：stats ∪ base（開季初 Synergy 尚未釋出時 stats 為空），依該份快照的輪換強度遞減。
    // 不用硬寫的先發名單（一份名單不可能同時對多個賽季正確，每次交易還要手改）。
    // 有 base 用場均分鐘；沒有（2025-26 早期快照）退回每場進攻總球權。尺度在「整份快照」擇一，不逐人混用
    const rosterOrder = (doc) => {
        if (!doc || (!doc.stats && !doc.base)) return [];
        const names = [...new Set([...Object.keys(doc.stats || {}), ...Object.keys(doc.base || {})])];
        const possOf = (n) => ((doc.stats || {})[n] || [])
            .filter(x => x.side === 'offensive')
            .reduce((sum, x) => sum + (typeof x.poss === 'number' ? x.poss : 0), 0);
        const weightOf = (n) => {
            if (!doc.base) return possOf(n);
            const v = (doc.base[n] || {}).MIN;
            return typeof v === 'number' ? v : -1;
        };
        return names.sort((a, b) => (weightOf(b) - weightOf(a)) || a.localeCompare(b));
    };

    // 目前名單屬於哪一季：當季快照的 date 是日期字串，歷史快照的 date 是賽季標籤
    const loadedSeasonKey = (playerHistory, options) => {
        const d = ((playerHistory || [])[0] || {}).date || '';
        return DATE_RE.test(d) ? 'current' : ((options || []).find(o => o.label === d) || {}).key;
    };

    // 防守章節沒有資料時的說明。當季每日快照的 defense 是賽季中途才加進抓取的，舊日期本來就沒有，
    // 不可籠統說「此賽季無防守數據」。回傳 { msg, jumpDate }：jumpDate＝離目前日期最近、有防守數據的快照日
    const defenseMissing = ({ hasData, isHistory, viewMode, seq, idx, player, typeLabel, date, season }) => {
        if (hasData) return null;
        if (isHistory) return { msg: '此賽季的期末快照沒有防守數據' };
        const has = window.hasRealData;
        const cur = (seq || [])[idx];
        const defOf = d => viewMode === 'TEAM' ? d.defense : (d.defense || {})[player];
        if (viewMode === 'PLAYER' && cur && has(cur.defense) && !has(defOf(cur))) {
            return { msg: `${player} 在 ${cur.date} 的快照沒有防守數據` };
        }
        const withDef = (seq || []).filter(d => has(defOf(d))).map(d => d.date);
        const fallback = `可從賽季選單選「${season} ${typeLabel}」查看期末完整快照。`;
        if (!withDef.length) return { msg: `當季${typeLabel}的每日快照都沒有防守數據（防守類別較晚才加入抓取）。${fallback}` };
        const t = new Date(date).getTime();
        const jumpDate = withDef.slice().sort((a, b) => Math.abs(new Date(a) - t) - Math.abs(new Date(b) - t))[0];
        return { msg: `${cur ? cur.date : date} 的快照沒有防守數據（防守類別較晚才加入抓取，只有部分日期有）。`, jumpDate };
    };

    // 球員身分列的薪資膠囊：該季 cap hit（用 playerId 對 contracts，不比名字）；沒合約回 null
    const salaryBadge = (capDoc, season, playerId) => {
        if (!capDoc || !playerId) return null;
        const row = (capDoc.contracts || []).find(c => c.season === season && c.playerId === Number(playerId));
        if (!row) return null;
        const C = window.CapCalc;
        const twoWay = row.type === 'TWO-WAY';
        const team = C.payroll(capDoc, season).tax;
        return {
            season,
            text: twoWay ? '雙向合約' : C.fmtM(row.salary),
            title: twoWay ? '雙向合約，不計入球隊薪資｜點擊開啟薪資頁'
                : `${C.fmtFull(row.salary)}｜佔全隊奢侈稅薪資 ${(row.salary / team * 100).toFixed(1)}%｜點擊開啟薪資頁`,
            badge: row.option === 'PO' ? '球員選項' : row.option === 'TO' ? '球隊選項'
                : row.option === 'ETO' ? '提前終止選項' : (!twoWay && row.guarantee !== 'full') ? '非全額保障' : '',
        };
    };

    // 未開打場次（賽前預覽文件，只有當季）：已在賽程索引裡的最後一場之後的比賽 → 月曆虛框格、搜尋「下一場」
    const futureGames = (previewDoc, season, scheduleGames) => {
        if (!previewDoc || previewDoc.season !== season) return [];
        const last = scheduleGames.length ? scheduleGames[scheduleGames.length - 1].date : '';
        return (previewDoc.games || []).filter(g => g.date > last).map(g => ({
            date: g.date, matchup: `MIN ${g.home ? 'vs.' : '@'} ${g.opp}`, wl: '', type: window.gameTypeOfId(g.id),
            future: true, kickoff: window.kickoffTPE(g),
        }));
    };

    // 身分列的附加賽膠囊：該季附加賽戰績（時光機選的日期之後的不算）；沒有附加賽回 null
    const playinSummary = (scheduleGames, untilDate) => {
        const gs = (scheduleGames || []).filter(g => g.type === 'playin' && (!untilDate || g.date <= untilDate));
        if (!gs.length) return null;
        return { w: gs.filter(g => g.wl === 'W').length, l: gs.filter(g => g.wl === 'L').length, lastDate: gs[gs.length - 1].date };
    };

    // 組合頁：沒指定賽別＝依時節（當季季後賽期間預設季後賽）
    const luDefType = (season, phaseType) => (season === window.CURRENT_SEASON && phaseType === 'playoffs' ? 'playoffs' : 'regular');
    // 組合頁內的切換：換人數時最少分鐘與檢視回到該人數預設；賽季、賽別是預設值時存空字串（網址不帶）
    const patchLu = (l, patch, phaseType) => {
        const x = { ...l, ...patch };
        if ('n' in patch) { x.min = null; x.view = ''; x.picks = (l.picks || []).slice(0, patch.n); }
        if ('season' in patch) x.season = patch.season === window.CURRENT_SEASON ? '' : patch.season;
        const season = x.season || window.CURRENT_SEASON;
        const type = 'type' in patch ? patch.type : (l.type || luDefType(l.season || window.CURRENT_SEASON, phaseType));
        x.type = type === luDefType(season, phaseType) ? '' : type;
        return x;
    };
    // 比較頁內的切換：當季寫成空字串（網址不帶）
    const patchCmp = (c, patch) => {
        const x = { ...c, ...patch };
        ['sa', 'sb'].forEach(k => { if (k in patch && patch[k] === window.CURRENT_SEASON) x[k] = ''; });
        return x;
    };

    // 快照序列中某賽別最新的一份（跨季比較的「當季」欄）
    const latestOfType = (arr, label) => (arr || []).filter(d => d.seasonType === label).sort((a, b) => (a.date < b.date ? 1 : -1))[0] || null;

    window.AppLogic = {
        HISTORY_CATS, normalizeHistoryPlayer, seqIndex, pickView, seasonStatus, rosterOrder, loadedSeasonKey,
        defenseMissing, salaryBadge, futureGames, playinSummary, luDefType, patchLu, patchCmp, latestOfType,
    };
})();
