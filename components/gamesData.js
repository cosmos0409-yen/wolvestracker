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
