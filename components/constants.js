// 全域常數
window.PlayTypesList = ["Transition", "Isolation", "PRBallHandler", "PRRollMan", "Postup", "Spotup", "Handoff", "Cut", "OffScreen", "OffRebound", "Misc"];

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
            { key: 'REB_CHANCES', label: '籃板機會', englishLabel: 'REB Chances' },
            { key: 'REB_COL_PCT', label: '籃板掌握率', englishLabel: 'REB Col%', unit: '%' },
            { key: 'REB_CONTEST_PCT', label: '防守干擾籃板率', englishLabel: 'REB Contest%', unit: '%' },
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
