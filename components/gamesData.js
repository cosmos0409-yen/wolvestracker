// games 資料載入層：讀「逐場打包」bundle（單一 getDoc），避免一次讀 90+ 份文件而卡死。
//   球隊：wolves_games_bundle/{season}_{type}
//   球員：wolves_pgames_bundle/{season}_{type}_{playerId}
// bundle 內每場統一為 { date, matchup, wl, stats }（球隊=球隊當場、球員=該員當場），
// 前端一律以 game.stats 為實體交給 GameAgg 算任意期間。記憶體快取一份。
window.__gamesBundle = window.__gamesBundle || {};

// viewMode='TEAM' 免 playerId；'PLAYER' 需傳 playerId
window.loadSeasonGames = async function (season, type, viewMode, playerId) {
    if (!window.db || !window.firebaseModules) return { games: [] };
    const { doc, getDoc } = window.firebaseModules;
    const isTeam = viewMode === 'TEAM';
    const coll = isTeam ? 'wolves_games_bundle' : 'wolves_pgames_bundle';
    const bundleId = isTeam ? `${season}_${type}` : `${season}_${type}_${playerId}`;
    if (!isTeam && !playerId) return { games: [] };
    const cacheKey = `${coll}/${bundleId}`;
    if (window.__gamesBundle[cacheKey]) return { games: window.__gamesBundle[cacheKey] };
    try {
        const snap = await getDoc(doc(window.db, coll, bundleId));
        const games = snap.exists() ? (snap.data().games || []) : [];
        window.__gamesBundle[cacheKey] = games;
        return { games };
    } catch (e) {
        console.error('bundle load fail', cacheKey, e);
        return { games: [] };
    }
};

// 比賽索引 wolves_games_index/{season}_{type}（一份 doc：[{date,matchup,wl,gameId}]，由舊到新）。
// App 的單場面板日期選單、單場頁賽程條共用。
// 只有已結束的賽季走 localStorage 快取（索引不會再變）；當季每次都讀最新，
// 否則新比賽寫入後要等快取過期才看得到（開季曾把空清單快取 6 小時，入口整個消失）。空清單一律不快取
window.loadGamesIndex = async function (season, type) {
    if (!window.db || !window.firebaseModules) return [];
    const indexId = `${season}_${type}`;
    const cacheKey = `wt_games_index_v3_${indexId}`;
    const cacheable = season !== window.CURRENT_SEASON;
    if (cacheable) {
        try {
            const c = JSON.parse(localStorage.getItem(cacheKey) || 'null');
            if (c && c.games && c.games.length) return c.games;
        } catch (e) { /* fall through */ }
    }
    const { doc, getDoc } = window.firebaseModules;
    const snap = await getDoc(doc(window.db, 'wolves_games_index', indexId));   // 失敗往上拋，呼叫端決定怎麼顯示
    const games = snap.exists() ? (snap.data().games || []) : [];
    if (cacheable && games.length) {
        try { localStorage.setItem(cacheKey, JSON.stringify({ t: Date.now(), games })); } catch (e) { /* quota */ }
    }
    return games;
};

// 整季賽程（例行賽＋季後賽合併、由舊到新，每場帶 type）：刊頭賽程月曆、搜尋「最近比賽」用。
// 季後賽索引不存在（沒打進／還沒開打）時只回例行賽
window.loadSeasonSchedule = async function (season) {
    const [reg, po] = await Promise.all(['regular', 'playoffs'].map(t =>
        window.loadGamesIndex(season, t).then(gs => gs.map(g => ({ ...g, type: t })))));
    return [...reg, ...po].sort((a, b) => a.date.localeCompare(b.date));
};
