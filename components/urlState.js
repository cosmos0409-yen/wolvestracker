// 網址狀態：把目前畫面寫進網址 hash，貼到筆記裡下次一點就回到同一個畫面。
// 用 hash 而非 query：GitHub Pages 是靜態站，hash 不會送到伺服器、也不需要路由設定。
// 格式（只寫非預設值，網址保持短）：
//   #v=player&p=Jaden%20McDaniels&tab=shooting&s=2024-25_playoffs&t=playoffs&d=2026-06-15&side=def
//   v    球隊 team / 球員 player
//   p    球員名（每日快照以 playerName 為 key，所以用名字而非 ID）
//   tab  overview / splits / shooting / defense / playtype / comparison
//   s    賽季 key（current 省略；其餘同 SEASON_OPTIONS.key = 歷史 docId）
//   t    當季賽別 regular / playoffs（僅當季）
//   d    當季「截至日期」YYYY-MM-DD（僅當季，空=最新）
//   side off / def
window.UrlState = (function () {
    const TABS = ['overview', 'splits', 'shooting', 'defense', 'playtype', 'comparison'];

    const parse = (hash) => {
        const out = {};
        const q = new URLSearchParams(String(hash || '').replace(/^#/, ''));
        const v = q.get('v');
        if (v === 'team') out.viewMode = 'TEAM';
        if (v === 'player') out.viewMode = 'PLAYER';
        if (q.get('p')) out.selectedPlayer = q.get('p');
        if (TABS.includes(q.get('tab'))) out.activeTab = q.get('tab');
        const s = q.get('s');
        if (s && (s === 'current' || (window.SEASON_OPTIONS || []).some(o => o.key === s))) out.selectedSeasonKey = s;
        if (q.get('t') === 'regular' || q.get('t') === 'playoffs') out.seasonTypeView = q.get('t');
        if (/^\d{4}-\d{2}-\d{2}$/.test(q.get('d') || '')) out.selectedDate = q.get('d');
        if (q.get('side') === 'off') out.viewSide = 'offensive';
        if (q.get('side') === 'def') out.viewSide = 'defensive';
        // 有 v= 代表這是本站產生的完整連結：沒寫的項目一律是預設值（serialize 只寫非預設值），
        // 不可退回瀏覽器偏好——否則同一條連結會因為「這台電腦上次看過什麼」而開出不同畫面
        if (out.viewMode) {
            if (!out.activeTab) out.activeTab = 'overview';
            if (!out.selectedSeasonKey) out.selectedSeasonKey = 'current';
            if (!out.viewSide) out.viewSide = 'offensive';
        }
        return out;
    };

    const serialize = (st) => {
        const q = new URLSearchParams();
        q.set('v', st.viewMode === 'PLAYER' ? 'player' : 'team');
        if (st.viewMode === 'PLAYER' && st.selectedPlayer) q.set('p', st.selectedPlayer);
        if (st.activeTab && st.activeTab !== 'overview') q.set('tab', st.activeTab);
        const isCurrent = !st.selectedSeasonKey || st.selectedSeasonKey === 'current';
        if (!isCurrent) q.set('s', st.selectedSeasonKey);
        if (isCurrent && st.seasonTypeView) q.set('t', st.seasonTypeView);
        if (isCurrent && st.selectedDate) q.set('d', st.selectedDate);
        if (st.viewSide === 'defensive') q.set('side', 'def');
        // URLSearchParams 會把空白編成 +，換成 %20 讓網址在筆記軟體裡比較好讀、也不會被誤判
        return q.toString().replace(/\+/g, '%20');
    };

    return { parse, serialize, TABS };
})();
