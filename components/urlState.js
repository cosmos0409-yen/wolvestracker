// 網址狀態：把目前畫面寫進網址 hash，貼到筆記裡下次一點就回到同一個畫面。
// 用 hash 而非 query：GitHub Pages 是靜態站，hash 不會送到伺服器、也不需要路由設定。
// 格式（只寫非預設值，網址保持短）：
//   #v=player&p=1630183-jaden-mcdaniels&tab=shooting&s=2024-25&t=playoffs&d=2026-06-15&side=def
//   v    球隊 team / 球員 player
//   p    球員「ID-名字」，如 1630162-anthony-edwards：只用前面的 NBA 球員 ID 對人，後面的名字只給人看（寫錯、改名都不影響）；
//        App 等名單載入後用 ID 對回快照的 playerName。舊連結的完整名字（Anthony%20Edwards）仍可讀
//   tab  overview / splits / shooting / defense / playtype / comparison
//   s    賽季年份 YYYY-YY（當季省略）；舊連結的 SEASON_OPTIONS.key 寫法（2024-25_playoffs）仍可讀
//   t    賽別 regular / playoffs（當季與歷史賽季都寫；歷史賽季時和 s 合成 key＝歷史 docId）
//   d    當季「截至日期」YYYY-MM-DD（僅當季，空=最新）
//   side off / def
//   m    Splits 打開逐場走勢的指標 key（如 D_FG_PCT；僅 tab=splits）
//   hl   Splits 走勢上圈出的那一場 YYYY-MM-DD（從單場頁點指標過來時帶；僅 tab=splits）
// 單場比賽頁（另一種畫面，沒有 v=）：
//   #game=2026-04-10&tab=box&p=Rudy%20Gobert
//   game 比賽日期；tab 單場分頁 box/compare/shots（省略＝概要）；
//   p 展開進階的灰狼球員，同上「ID-名字」（只在 Box Score；舊連結只帶 p 沒帶 tab 時視為 tab=box）
// 薪資頁（另一種畫面，沒有 v=）：
//   #cap&s=2025-26&tab=contracts
//   cap 薪資頁；s 薪資賽季（省略＝薪資當季，見 constants.js capSeasonForDate）；tab 分頁 contracts/picks/rules（省略＝總覽）
// 對戰分析（另一種畫面，沒有 v=）：
//   #vs&r=cur&t=regular        對戰首頁
//   #vs=DEN&m=FG3_PCT          單隊對戰頁
//   vs 對戰（=三碼＝單隊頁）；r 範圍 cur（只看本季）／YYYY-YY（指定賽季），省略＝近三季；
//   t 賽別 regular / playoffs，省略＝例行＋季後；m 單隊頁標亮的指標（從首頁熱圖點進來時帶）
window.UrlState = (function () {
    const TABS = ['overview', 'splits', 'shooting', 'defense', 'playtype', 'comparison'];
    const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
    const METRIC_RE = /^[A-Z0-9_]+$/;
    const SEASON_RE = /^\d{4}-\d{2}$/;
    const CAP_TABS = ['contracts', 'picks', 'rules'];
    const GAME_TABS = ['box', 'compare', 'shots'];
    // 球員在網址裡的寫法：ID-名字（沒有 ID 才退回完整名字）；解析只看開頭的 ID，解不出＝舊連結的名字
    const playerToken = (id, name) => (Number(id) > 0 ? [Number(id), window.nameSlug(name || '')].filter(Boolean).join('-') : (name || ''));
    const tokenPlayerId = (p) => { const m = /^(\d+)(-[a-z0-9-]*)?$/.exec(p || ''); return m ? Number(m[1]) : null; };

    const parse = (hash) => {
        const out = {};
        const q = new URLSearchParams(String(hash || '').replace(/^#/, ''));
        // 單場頁：有 game 且沒有 v。p 在這裡是「展開的球員」，不可改動主畫面的 selectedPlayer
        if (DATE_RE.test(q.get('game') || '') && !q.get('v')) {
            out.gameDate = q.get('game');
            out.gamePlayer = q.get('p') || '';
            out.gameTab = GAME_TABS.includes(q.get('tab')) ? q.get('tab') : out.gamePlayer ? 'box' : '';
            return out;
        }
        // 薪資頁：有 cap 且沒有 v。s 在這裡是薪資賽季，不可改動主畫面的 selectedSeasonKey
        if (q.has('cap') && !q.get('v')) {
            out.capView = true;
            out.capSeason = SEASON_RE.test(q.get('s') || '') ? q.get('s') : '';
            out.capTab = CAP_TABS.includes(q.get('tab')) ? q.get('tab') : '';
            return out;
        }
        // 對戰分析：有 vs 且沒有 v。r/t 是對戰自己的範圍，不可改動主畫面的賽季／賽別
        if (q.has('vs') && !q.get('v')) {
            out.vsView = true;
            out.vsTeam = /^[A-Z]{3}$/.test(q.get('vs') || '') ? q.get('vs') : '';
            const r = q.get('r') || '';
            out.vsRange = r === 'cur' || SEASON_RE.test(r) ? r : '';
            out.vsType = q.get('t') === 'regular' || q.get('t') === 'playoffs' ? q.get('t') : '';
            out.vsMetric = out.vsTeam && METRIC_RE.test(q.get('m') || '') ? q.get('m') : '';
            return out;
        }
        const v = q.get('v');
        if (v === 'team') out.viewMode = 'TEAM';
        if (v === 'player') out.viewMode = 'PLAYER';
        if (q.get('p')) {
            const pid = tokenPlayerId(q.get('p'));
            if (pid) out.playerId = pid; else out.selectedPlayer = q.get('p');
        }
        if (TABS.includes(q.get('tab'))) out.activeTab = q.get('tab');
        const s = q.get('s') || '', t = q.get('t') === 'regular' || q.get('t') === 'playoffs' ? q.get('t') : '';
        const opts = window.SEASON_OPTIONS || [];
        if (s === 'current' || opts.some(o => o.key === s)) out.selectedSeasonKey = s;   // 舊格式 s=2024-25_playoffs
        else if (SEASON_RE.test(s)) {
            const key = `${s}_${t || 'regular'}`;
            if (s === window.CURRENT_SEASON) out.selectedSeasonKey = 'current';
            else if (opts.some(o => o.key === key)) out.selectedSeasonKey = key;
        }
        // t 只決定當季的賽別；歷史賽季的賽別已在 key 裡，不可改到當季的賽別
        if (t && (!out.selectedSeasonKey || out.selectedSeasonKey === 'current')) out.seasonTypeView = t;
        if (DATE_RE.test(q.get('d') || '')) out.selectedDate = q.get('d');
        if (q.get('side') === 'off') out.viewSide = 'offensive';
        if (q.get('side') === 'def') out.viewSide = 'defensive';
        if (out.activeTab === 'splits') {
            if (METRIC_RE.test(q.get('m') || '')) out.focusMetric = q.get('m');
            if (out.focusMetric && DATE_RE.test(q.get('hl') || '')) out.highlightDate = q.get('hl');
        }
        // 有 v= 代表這是本站產生的完整連結：沒寫的項目一律是預設值（serialize 只寫非預設值），
        // 不可退回瀏覽器偏好——否則同一條連結會因為「這台電腦上次看過什麼」而開出不同畫面
        if (out.viewMode) {
            if (!out.activeTab) out.activeTab = 'overview';
            if (!out.selectedSeasonKey) out.selectedSeasonKey = 'current';
            if (!out.viewSide) out.viewSide = 'offensive';
        }
        return out;
    };

    // URLSearchParams 會把空白編成 +，換成 %20 讓網址在筆記軟體裡比較好讀、也不會被誤判
    const toStr = (q) => q.toString().replace(/\+/g, '%20');

    const serialize = (st) => {
        const q = new URLSearchParams();
        if (st.gameDate) {
            q.set('game', st.gameDate);
            const tab = GAME_TABS.includes(st.gameTab) ? st.gameTab : st.gamePlayer ? 'box' : '';
            if (tab) q.set('tab', tab);
            if (st.gamePlayer && tab === 'box') q.set('p', st.gamePlayer);
            return toStr(q);
        }
        if (st.capView) return ['cap', st.capSeason && `s=${st.capSeason}`, st.capTab && `tab=${st.capTab}`].filter(Boolean).join('&');
        if (st.vsView) return [st.vsTeam ? `vs=${st.vsTeam}` : 'vs', st.vsRange && `r=${st.vsRange}`, st.vsType && `t=${st.vsType}`,
            st.vsTeam && st.vsMetric && `m=${st.vsMetric}`].filter(Boolean).join('&');
        q.set('v', st.viewMode === 'PLAYER' ? 'player' : 'team');
        if (st.viewMode === 'PLAYER' && (st.playerId || st.selectedPlayer)) q.set('p', playerToken(st.playerId, st.selectedPlayer));
        if (st.activeTab && st.activeTab !== 'overview') q.set('tab', st.activeTab);
        const isCurrent = !st.selectedSeasonKey || st.selectedSeasonKey === 'current';
        const hist = isCurrent ? null : /^(\d{4}-\d{2})_(regular|playoffs)$/.exec(st.selectedSeasonKey);
        if (hist) { q.set('s', hist[1]); q.set('t', hist[2]); }
        else if (!isCurrent) q.set('s', st.selectedSeasonKey);   // 保險：不認得的 key 原樣寫
        if (isCurrent && st.seasonTypeView) q.set('t', st.seasonTypeView);
        if (isCurrent && st.selectedDate) q.set('d', st.selectedDate);
        if (st.viewSide === 'defensive') q.set('side', 'def');
        if (st.activeTab === 'splits' && st.focusMetric) {
            q.set('m', st.focusMetric);
            if (st.highlightDate) q.set('hl', st.highlightDate);
        }
        return toStr(q);
    };

    // 給連結用的 href（一般 <a href>：會產生瀏覽紀錄，返回鍵可回上一頁）
    const gameHref = (date, player, tab) => '#' + serialize({ gameDate: date, gamePlayer: player || '', gameTab: tab || '' });
    const capHref = (season, tab) => '#' + serialize({ capView: true, capSeason: season || '', capTab: tab || '' });
    const vsHref = (team, range, type, metric) => '#' + serialize({ vsView: true, vsTeam: team || '', vsRange: range || '', vsType: type || '', vsMetric: metric || '' });

    return { parse, serialize, gameHref, capHref, vsHref, playerToken, tokenPlayerId, TABS };
})();
