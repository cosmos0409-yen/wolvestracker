// games 資料載入層：依 wolves_games_index/{season}_{type} 的日期清單，逐日 getDoc 讀入。
// 安全規則只開放 get（未開放 list），故不能用 getDocs(collection)；改用「限併發」批次 getDoc
// （一次最多 CONCURRENCY 筆），避免 90+ 併發把 long-polling 通道塞爆而卡死。
// 每份 doc localStorage v2 快取（回補後舊 v1 失效）+ 記憶體快取；單場資料定格，讀一次即可。
window.__gamesMem = window.__gamesMem || {};
const GAMES_CONCURRENCY = 6;

async function loadGameDoc(coll, date) {
    const key = `wt_game_v2_${coll}_${date}`;
    if (window.__gamesMem[key]) return window.__gamesMem[key];
    try {
        const c = localStorage.getItem(key);
        if (c) { const d = JSON.parse(c); window.__gamesMem[key] = d; return d; }
    } catch (e) { /* 重抓 */ }
    const { doc, getDoc } = window.firebaseModules;
    try {
        const snap = await getDoc(doc(window.db, coll, date));
        const d = snap.exists() ? snap.data() : null;
        if (d) {
            window.__gamesMem[key] = d;
            try { localStorage.setItem(key, JSON.stringify(d)); } catch (e) { /* quota：僅記憶體 */ }
        }
        return d;
    } catch (e) { console.error('game doc load fail', coll, date, e); return null; }
}
window.loadGameDoc = loadGameDoc;

// 載入某賽季某賽別全部單場（限併發批次），併入索引的 matchup/wl，依日期排序
// 回傳 { games: [ {date, matchup, wl, players|stats, ...} ], index: [{date,matchup,wl}] }
window.loadSeasonGames = async function (season, type, viewMode) {
    if (!window.db || !window.firebaseModules) return { games: [], index: [] };
    const coll = viewMode === 'TEAM' ? 'wolves_team_games' : 'wolves_player_games';
    const { doc, getDoc } = window.firebaseModules;
    const indexId = `${season}_${type}`;
    let index = [];
    try {
        const idxSnap = await getDoc(doc(window.db, 'wolves_games_index', indexId));
        if (idxSnap.exists()) index = idxSnap.data().games || [];
    } catch (e) {
        console.error('games index load fail', indexId, e);
        return { games: [], index: [] };
    }
    if (!index.length) return { games: [], index: [] };

    const queue = index.slice();
    const games = [];
    async function worker() {
        while (queue.length) {
            const meta = queue.shift();
            const d = await loadGameDoc(coll, meta.date);
            if (d) games.push({ matchup: meta.matchup, wl: meta.wl, ...d });
        }
    }
    await Promise.all(Array.from({ length: Math.min(GAMES_CONCURRENCY, queue.length) }, worker));
    games.sort((a, b) => (a.date < b.date ? -1 : 1));
    return { games, index };
};
