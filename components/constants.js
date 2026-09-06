// 全域常數
window.PlayTypesList = ["Transition", "Isolation", "PRBallHandler", "PRRollMan", "Postup", "Spotup", "Handoff", "Cut", "OffScreen", "OffRebound", "Misc"];
window.CURRENT_SEASON = "2025-26"; // 投籃熱圖 doc id 用，需與 scripts/fetch_data.py 的 SEASON 一致

// 名稱比對用 key：去句點/重音/多餘空白後小寫。
// 必要性：同一人的名字在不同季的 API 回傳不一致
// （2025-26 是 "Terrence Shannon Jr."，2026-27 是 "Terrence Shannon Jr"），
// 而球員資料以 playerName 為主鍵，不正規化就會對不上。
window.nameKey = (n) => String(n || '')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')   // 去重音: Jokic
    .replace(/[.\u2019']/g, '')                            // 去句點與彎/直撇號
    .replace(/\s+/g, ' ').trim().toLowerCase();

// 賽季階段判斷（前端版本，對應 fetch_data.py 的 get_season_type()）
// 使用美東時間 UTC-5（不處理 DST，誤差可忍）
window.getSeasonPhase = function (date) {
    const d = date || new Date();
    const eastTime = new Date(d.getTime() - 5 * 3600 * 1000);
    const m = eastTime.getUTCMonth() + 1;
    const day = eastTime.getUTCDate();
    if ((m === 10 && day >= 20) || m === 11 || m === 12 || m === 1 || m === 2 || m === 3 || (m === 4 && day <= 15)) {
        return { type: 'regular', label: '例行賽', inSeason: true };
    } else if ((m === 4 && day >= 16) || m === 5 || (m === 6 && day <= 20)) {
        return { type: 'playoffs', label: '季後賽', inSeason: true };
    } else {
        return { type: null, label: '休賽期', inSeason: false };
    }
};
// 賽季選擇器選項：current = 當季每日快照，其餘為歷史終點快照。
// 單一來源：App.js 的跨季比較清單也讀 HISTORY_SEASON_OPTIONS，勿另建第二份。
// 不變式：option.key === Firestore 的 history docId（`${season}_${type}`）
window.HISTORY_SEASONS = ['2025-26', '2024-25', '2023-24', '2022-23'];
window.HISTORY_SEASON_OPTIONS = window.HISTORY_SEASONS.flatMap(s =>
    [['playoffs', '季後賽', '季'], ['regular', '例行賽', '例']].map(([t, l, sh]) => ({
        key: `${s}_${t}`, season: s, type: t,
        label: `${s} ${l}`, short: `${s.slice(2)}${sh}`,
        order: parseInt(s.slice(0, 4), 10) * 10 + (t === 'playoffs' ? 1 : 0),  // ComparisonTab 折線 X 軸排序用
    }))
);
window.SEASON_OPTIONS = [
    // 休賽期時該季已經打完，寫「進行中」是錯的（getSeasonPhase 必須定義在本行之前）
    {
        key: 'current', isCurrent: true,
        label: `${window.CURRENT_SEASON} ${window.getSeasonPhase().inSeason ? '進行中' : '最終'}`,
    },
    ...window.HISTORY_SEASON_OPTIONS,
];

// 新援探測順序：找該球員最近一個「真的有資料」的賽季。
// 只列這兩季，因為回補計畫只重跑 2025-26 / 2024-25；2023-24 與 2022-23 不重跑，
// 新援永遠不會出現在那兩季。（回補尚未執行前，這四個 doc 也還沒有新援）
window.HISTORY_PROBE_ORDER = ['2025-26_regular', '2025-26_playoffs', '2024-25_regular', '2024-25_playoffs'];

// 2026-27 名冊（來自 commonteamroster 實測）。一律寫無句點形式，比對走 nameKey。
// 用途只有一個：列出「在名冊上但當季快照還沒有數據」的球員（新援 / 尚未出賽者）。
// 刻意不拿來做排序權重——側欄排序改由快照的 MIN 決定（見 App.js availablePlayers），
// 這樣看哪一季就是那一季的輪換順序，交易後也不用改程式。
window.CURRENT_ROSTER_NAMES = [
    "Anthony Edwards", "LaMelo Ball", "Jaden McDaniels", "Jonathan Kuminga", "Rudy Gobert",
    "Donte DiVincenzo", "Terrence Shannon Jr", "Ayo Dosunmu", "Trey Lyles", "Cody Williams",
    "Bones Hyland", "Jaylen Clark", "Joan Beringer", "Enrique Freeman", "Isaiah Evans",
    "Trey Kaufman-Renn", "Zyon Pullin", "Rocco Zikarsky",
];

// 球隊標示：非灰狼才標。留隊球員回空字串 → 現有畫面完全不變
window.TEAM_ABBR = 'MIN';
window.teamTag = (abbr) => (!abbr || abbr === window.TEAM_ABBR) ? '' : `@${abbr}`;
window.NA_REASON = {
    CROSS_TEAM: '跨隊資料不適用：NBA API 的對位防守 / On-Off 需綁定 TeamID，該季此球員不在灰狼，無法取得',
};

// 歷史快照的 localStorage 快取。
// 版本號：後端 backfill 改變結構時必須 +1，否則使用者瀏覽器會永遠讀到舊資料
// （舊版程式只要 cache 存在就 return，不再打 Firestore）。
window.HISTORY_CACHE_VER = 3;                 // v3 = 新增 teamAbbr / isNewcomer
window.HISTORY_CACHE_TTL = 24 * 3600 * 1000;
const _histKey = (docId) => `wt_history_v${window.HISTORY_CACHE_VER}_${docId}`;
window.purgeHistoryCache = (all) => {
    try {
        Object.keys(localStorage).forEach(k => {
            if (k.startsWith('wt_history_') && (all || !k.startsWith(`wt_history_v${window.HISTORY_CACHE_VER}_`)))
                localStorage.removeItem(k);
        });
    } catch (e) { /* private mode / quota */ }
};
window.readHistoryCache = (docId) => {
    try {
        const o = JSON.parse(localStorage.getItem(_histKey(docId)) || 'null');
        if (!o || o.v !== window.HISTORY_CACHE_VER) return null;
        if (Date.now() - o.t > window.HISTORY_CACHE_TTL) return null;
        return o.d;
    } catch (e) { return null; }
};
window.writeHistoryCache = (docId, d) => {
    try { localStorage.setItem(_histKey(docId), JSON.stringify({ v: window.HISTORY_CACHE_VER, t: Date.now(), d })); }
    catch (e) { window.purgeHistoryCache(true); }   // quota 滿 → 清掉全部歷史快取
};
window.purgeHistoryCache(false);   // 載入時立即清掉舊版 key

// 每日快照的訂閱起始日：doc id 就是日期字串，故以 doc id 範圍過濾出「當季」。
// 為什麼不用 orderBy(documentId(),'desc') + limit：那需要建 Firestore 複合索引，
// 而 onSnapshot 沒有 error callback，缺索引時會「靜默失敗」讓整個面板空掉。
// __name__ 升冪是 Firestore 預設索引，範圍查詢免建索引（已實測）。
// 以賽季起始年的 7/1 為界：完整涵蓋例行賽+季後賽（打到隔年 6 月），
// 又能永久擋住 collection 隨賽季累積而無限成長。
window.SNAPSHOT_SINCE = `${parseInt(window.CURRENT_SEASON.slice(0, 4), 10)}-07-01`;
// 上界＝隔年 6/30，涵蓋到總冠軍賽結束。除了鎖定單一賽季，也擋掉非日期的 doc id
// （'latest'、'meta' 之類字母 id 字典序都大於數字，只有下界會把它們一起撈進來，
//   之後 new Date(id) 變 NaN 污染排序）
window.SNAPSHOT_UNTIL = `${parseInt(window.CURRENT_SEASON.slice(0, 4), 10) + 1}-06-30`;

// Tracking 卡片定義（每個 metric 含中英對照）
window.trackingDefs = [
    {
        id: 'Drives', title: '切入次數 (Drives)', metrics: [
            { key: 'DRIVES', label: '切入次數', englishLabel: 'Drives' },
            { key: 'DRIVE_FGM', label: '切入進球', englishLabel: 'Drive FGM' },
            { key: 'DRIVE_FG_PCT', label: '切入命中率', englishLabel: 'Drive FG%', unit: '%' },
            { key: 'DRIVE_TOV_PCT', label: '失誤率', englishLabel: 'Drive TOV%', unit: '%', betterIsLarger: false },
        ]
    },
    {
        id: 'CatchShoot', title: '接球跳投 (C&S)', metrics: [
            { key: 'CATCH_SHOOT_FGA', label: '出手次數', englishLabel: 'C&S FGA' },
            { key: 'CATCH_SHOOT_FG3_PCT', label: '三分命中率', englishLabel: 'C&S 3P%', unit: '%' },
            { key: 'CATCH_SHOOT_EFG_PCT', label: '有效命中率', englishLabel: 'C&S eFG%', unit: '%' },
        ]
    },
    {
        id: 'PullUpShot', title: '急停跳投 (Pull Up)', metrics: [
            { key: 'PULL_UP_FGA', label: '急停出手數', englishLabel: 'Pull Up FGA' },
            { key: 'PULL_UP_FG3_PCT', label: '急停三分命中率', englishLabel: 'Pull Up 3P%', unit: '%' },
            { key: 'PULL_UP_EFG_PCT', label: '有效命中率', englishLabel: 'Pull Up eFG%', unit: '%' },
        ]
    },
    {
        id: 'Passing', title: '傳送與二傳 (Passing)', metrics: [
            { key: 'PASSES_MADE', label: '傳送次數', englishLabel: 'Passes Made' },
            { key: 'POTENTIAL_AST', label: '潛在助攻', englishLabel: 'Potential AST' },
            { key: 'SECONDARY_AST', label: '二傳助攻', englishLabel: 'Secondary AST' },
            { key: 'AST_PTS_CREATED', label: '助攻創造得分', englishLabel: 'AST PTS Created' },
        ]
    },
    {
        id: 'Touches', title: '觸球數 (Touches)', metrics: [
            { key: 'TOUCHES', label: '觸球總數', englishLabel: 'Touches' },
            { key: 'FRONT_CT_TOUCHES', label: '前場觸球', englishLabel: 'Front Ct Touches' },
            { key: 'TIME_OF_POSS', label: '持球時間(分)', englishLabel: 'Time of Poss' },
            { key: 'PTS_PER_TOUCH', label: '每次觸球得分', englishLabel: 'PTS / Touch' },
        ]
    },
    {
        id: 'Rebounding', title: '籃板掌握 (Rebounding)', metrics: [
            { key: 'REB', label: '籃板數', englishLabel: 'REB' },
            { key: 'OREB', label: '進攻籃板', englishLabel: 'OREB' },
            { key: 'DREB', label: '防守籃板', englishLabel: 'DREB' },
            { key: 'REB_CHANCES', label: '籃板機會', englishLabel: 'REB Chances' },
            { key: 'REB_COL_PCT', label: '籃板掌握率', englishLabel: 'REB Chance%', unit: '%' },
            { key: 'REB_CONTEST', label: '競爭籃板', englishLabel: 'Contested REB' },
            { key: 'REB_CONTEST_PCT', label: '競爭籃板率', englishLabel: 'Contested REB%', unit: '%' },
            { key: 'AVG_REB_DIST', label: '平均籃板距離(呎)', englishLabel: 'Avg REB Dist' },
        ]
    },
];

// 投籃數據卡片定義（資料來源為 doc.shooting，經由 leaguedash*shotlocations / *ptshot 抓取）
window.shootingDefs = [
    {
        id: 'ShotZones', title: '分區命中率 (Shot Zones)', metrics: [
            { key: 'RA_FG_PCT', label: '禁區命中率', englishLabel: 'Restricted Area FG%', unit: '%' },
            { key: 'PAINT_FG_PCT', label: '油漆區命中率', englishLabel: 'Paint (Non-RA) FG%', unit: '%' },
            { key: 'MID_FG_PCT', label: '中距離命中率', englishLabel: 'Mid-Range FG%', unit: '%' },
            { key: 'C3_FG_PCT', label: '角落三分命中率', englishLabel: 'Corner 3 FG%', unit: '%' },
            { key: 'AB3_FG_PCT', label: '弧頂三分命中率', englishLabel: 'Above Break 3 FG%', unit: '%' },
        ]
    },
    {
        id: 'ShotProfile', title: '投籃拆分 (Shot Profile)', metrics: [
            { key: 'FGA', label: '出手次數', englishLabel: 'FGA' },
            { key: 'EFG_PCT', label: '有效命中率', englishLabel: 'eFG%', unit: '%' },
            { key: 'FG2A_FREQ', label: '兩分出手佔比', englishLabel: '2PA Freq', unit: '%' },
            { key: 'FG2_PCT', label: '兩分命中率', englishLabel: '2P%', unit: '%' },
            { key: 'FG3A_FREQ', label: '三分出手佔比', englishLabel: '3PA Freq', unit: '%' },
            { key: 'FG3_PCT', label: '三分命中率', englishLabel: '3P%', unit: '%' },
        ]
    },
];

// 關鍵時刻卡片定義（資料來源為 doc.clutch，最後 5 分鐘分差 5 分內）
window.clutchDefs = [
    {
        id: 'Clutch', title: '關鍵時刻 (Clutch — 最後5分鐘分差5分內)', metrics: [
            { key: 'PTS', label: '得分', englishLabel: 'PTS' },
            { key: 'FG_PCT', label: '命中率', englishLabel: 'FG%', unit: '%' },
            { key: 'FG3_PCT', label: '三分命中率', englishLabel: '3P%', unit: '%' },
            { key: 'FT_PCT', label: '罰球命中率', englishLabel: 'FT%', unit: '%' },
            { key: 'AST', label: '助攻', englishLabel: 'AST' },
            { key: 'TOV', label: '失誤', englishLabel: 'TOV', betterIsLarger: false },
            { key: 'REB', label: '籃板', englishLabel: 'REB' },
            { key: 'PLUS_MINUS', label: '正負值', englishLabel: '+/-' },
        ]
    },
];

// 防守數據卡片定義（資料來源為 doc.defense）— 顯示於「防守」側
// 對位防守/防守box 多為「越小越好」，用 betterIsLarger:false 讓趨勢箭頭方向正確
window.defenseDefs = [
    {
        id: 'MatchupDefense', title: '對位防守 (Matchup Defense)', metrics: [
            { key: 'D_FGA', label: '被挑戰出手', englishLabel: 'Defended FGA' },
            { key: 'D_FG_PCT', label: '對手命中率', englishLabel: 'Opp FG%', unit: '%', betterIsLarger: false },
            { key: 'PCT_PLUSMINUS', label: '命中率增減', englishLabel: 'FG% Diff', unit: '%', betterIsLarger: false },
            { key: 'D_FG3_PCT', label: '對手三分命中率', englishLabel: 'Opp 3P%', unit: '%', betterIsLarger: false },
        ]
    },
    {
        id: 'Hustle', title: '拼勁數據 (Hustle)', metrics: [
            { key: 'CONTESTED_SHOTS', label: '干擾投籃', englishLabel: 'Contested Shots' },
            { key: 'DEFLECTIONS', label: '抄截干擾', englishLabel: 'Deflections' },
            { key: 'CHARGES_DRAWN', label: '製造進攻犯規', englishLabel: 'Charges Drawn' },
            { key: 'SCREEN_ASSISTS', label: '掩護助攻', englishLabel: 'Screen AST' },
            { key: 'LOOSE_BALLS', label: '地板球', englishLabel: 'Loose Balls' },
            { key: 'BOX_OUTS', label: '卡位', englishLabel: 'Box Outs' },
        ]
    },
    {
        id: 'DefenseBox', title: '防守 Box (Defense)', metrics: [
            { key: 'DEF_RATING', label: '防守效率', englishLabel: 'Def Rating', betterIsLarger: false },
            { key: 'STL', label: '抄截', englishLabel: 'Steals' },
            { key: 'BLK', label: '阻攻', englishLabel: 'Blocks' },
            { key: 'DREB_PCT', label: '防守籃板率', englishLabel: 'DREB%', unit: '%' },
            { key: 'OPP_PTS_PAINT', label: '對手禁區得分', englishLabel: 'Opp Pts Paint', betterIsLarger: false },
            { key: 'OPP_PTS_FB', label: '對手快攻得分', englishLabel: 'Opp Pts FB', betterIsLarger: false },
        ]
    },
];

// 對手分區命中（僅球隊防守側，資料來源 doc.defense 的 *_OPP_* 欄位）
window.oppZonesDefs = [
    {
        id: 'OppZones', title: '對手分區命中 (Opponent Shooting by Zone)', metrics: [
            { key: 'RA_OPP_FG_PCT', label: '禁區命中率', englishLabel: 'Restricted Area', unit: '%', betterIsLarger: false },
            { key: 'PAINT_OPP_FG_PCT', label: '油漆區命中率', englishLabel: 'Paint (Non-RA)', unit: '%', betterIsLarger: false },
            { key: 'MID_OPP_FG_PCT', label: '中距離命中率', englishLabel: 'Mid-Range', unit: '%', betterIsLarger: false },
            { key: 'C3_OPP_FG_PCT', label: '角落三分命中率', englishLabel: 'Corner 3', unit: '%', betterIsLarger: false },
            { key: 'AB3_OPP_FG_PCT', label: '弧頂三分命中率', englishLabel: 'Above Break 3', unit: '%', betterIsLarger: false },
        ]
    },
];

