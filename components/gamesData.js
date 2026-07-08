// games 資料載入層：讀 wolves_games_index/{season}_{type} → 逐日 getDoc
// 快取：每份 doc 存 localStorage（key 升版 v2，因回補後舊 v1 快取缺 BASE 欄）；
// 單場資料一旦打完即定格，故永久快取；當季靠 index 長度增長自動補抓新場次。
// localStorage 寫入包 try/catch，超 quota 時降級為 in-memory（window.__gamesMem）。
window.__gamesMem = window.__gamesMem || {};

async function loadGameDoc(coll, date) {
    const key = `wt_game_v2_${coll}_${date}`;
    if (window.__gamesMem[key]) return window.__gamesMem[key];
    try {
        const c = localStorage.getItem(key);
        if (c) { const d = JSON.parse(c); window.__gamesMem[key] = d; return d; }
    } catch (e) { /* 解析失敗則重抓 */ }
    const { doc, getDoc } = window.firebaseModules;
    try {
        const snap = await getDoc(doc(window.db, coll, date));
        const d = snap.exists() ? snap.data() : null;
        if (d) {
            window.__gamesMem[key] = d;
            try { localStorage.setItem(key, JSON.stringify(d)); } catch (e) { /* quota 滿：僅存記憶體 */ }
        }
        return d;
    } catch (e) {
        console.error('game doc load fail', coll, date, e);
        return null;
    }
}
window.loadGameDoc = loadGameDoc;

// 載入某賽季某賽別的全部單場（含比賽索引 meta 併入 doc）。
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
    // 逐日並行載入（getDoc 快取後極快）；併入索引的 matchup/wl 以防單場 doc 缺欄
    const docs = await Promise.all(index.map(async meta => {
        const d = await loadGameDoc(coll, meta.date);
        if (!d) return null;
        return { matchup: meta.matchup, wl: meta.wl, ...d };
    }));
    return { games: docs.filter(Boolean), index };
};
