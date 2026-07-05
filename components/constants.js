// 全域常數
window.PlayTypesList = ["Transition", "Isolation", "PRBallHandler", "PRRollMan", "Postup", "Spotup", "Handoff", "Cut", "OffScreen", "OffRebound", "Misc"];
window.CURRENT_SEASON = "2025-26"; // 投籃熱圖 doc id 用，需與 scripts/fetch_data.py 的 SEASON 一致

// 賽季選擇器選項：current = 當季每日快照，其餘為歷史終點快照
window.SEASON_OPTIONS = [
    { key: 'current', label: '2025-26 進行中', isCurrent: true },
    { key: '2024-25_playoffs', season: '2024-25', type: 'playoffs', label: '2024-25 季後賽' },
    { key: '2024-25_regular', season: '2024-25', type: 'regular', label: '2024-25 例行賽' },
    { key: '2023-24_playoffs', season: '2023-24', type: 'playoffs', label: '2023-24 季後賽' },
    { key: '2023-24_regular', season: '2023-24', type: 'regular', label: '2023-24 例行賽' },
    { key: '2022-23_playoffs', season: '2022-23', type: 'playoffs', label: '2022-23 季後賽' },
    { key: '2022-23_regular', season: '2022-23', type: 'regular', label: '2022-23 例行賽' },
];

// 核心球員排序權重（出現於名單中時優先排前）
window.STARTER_SORT_WEIGHT = ["Anthony Edwards", "Julius Randle", "Rudy Gobert", "Jaden McDaniels", "Mike Conley", "Naz Reid", "Donte DiVincenzo"];

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
