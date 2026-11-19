// App.js 的獨立整頁路由（單場／薪資／完整賽程／組合／比較／對戰）與開站首頁＝最新一場。
// 2026-11-19 由 App.js 拆出（技術債 F 批）。主畫面的網址狀態（球員、章節、賽季…）仍在 App.js，這裡只管獨立整頁：
//   applyPageHash(st)  hashchange 時先交給它：是獨立整頁就切過去並回 true；否則清掉所有獨立整頁狀態、回 false 讓 App 套用主畫面
//   pageHash()         目前在獨立整頁時回該頁的 hash（不含 #），在主畫面回 null（由 App 組主畫面的 hash）
//   open*／leave       進頁一律改 location.hash（新增瀏覽紀錄，返回鍵可回上一頁）→ hashchange → applyPageHash；
//                      頁內切換（分頁、範圍）只改狀態，由 App 的網址同步 effect replaceState
// 獨立整頁的參數不可叫 v（有 v= 的網址會被當成主畫面連結）
(function () {
    const { useState, useEffect } = React;
    const luOf = (st) => ({ n: st.luN || 2, picks: st.luPicks || [], min: st.luMin == null ? null : st.luMin, view: st.luView2 || '', season: st.luSeason || '', type: st.luType || '' });
    const cmpOf = (st) => ({ a: st.cmpA || '', b: st.cmpB || '', sa: st.cmpSa || '', sb: st.cmpSb || '', type: st.cmpType || '', per: st.cmpPer || '', pd: st.cmpPd || '', metric: st.cmpMetric || '' });
    const vsOf = (st) => ({ team: st.vsTeam || '', range: st.vsRange || '', type: st.vsType || '', metric: st.vsMetric || '' });
    const hrefBody = (h) => h.slice(1);
    const go = (h) => { window.location.hash = hrefBody(h); };

    window.useRouteState = function ({ urlInit, isCloud }) {
        const U = window.UrlState;
        // 單場頁（#game=）：gamePlayer＝Box Score 展開進階的球員（p=）、gameTab＝單場分頁（tab=，''＝概要）、gameBox＝欄組（bx=，''／adv）
        const [gameDate, setGameDate] = useState(() => urlInit.gameDate || null);
        const [gamePlayer, setGamePlayer] = useState(() => urlInit.gamePlayer || '');
        const [gameTab, setGameTab] = useState(() => urlInit.gameTab || '');
        const [gameBox, setGameBox] = useState(() => urlInit.gameBox || '');
        // 首頁＝最新一場：網址完全沒帶畫面時先找最新一場再開單場頁；找的期間不寫網址、主區顯示載入中（避免先閃總覽）
        const [homePending, setHomePending] = useState(() => !window.location.hash.replace(/^#/, ''));
        // 薪資頁（#cap）：capSeason＝薪資賽季（s=，空＝薪資當季）、capTab（tab=，空＝總覽）
        const [capView, setCapView] = useState(() => !!urlInit.capView);
        const [capSeason, setCapSeason] = useState(() => urlInit.capSeason || '');
        const [capTab, setCapTab] = useState(() => urlInit.capTab || '');
        // 對戰（#vs）：team＝單隊頁三碼（空＝首頁）；range（r=，空＝近三季）、type（t=，空＝例行＋季後）是對戰自己的範圍，
        // 與主畫面的賽季／賽別無關；metric（m=）單隊頁標亮的指標
        const [vs, setVs] = useState(() => urlInit.vsView ? vsOf(urlInit) : null);
        // 完整賽程（#schedule，只有當季）：month（m=，空＝今天所在月份）、filter（f=，''／home／away）
        const [sched, setSched] = useState(() => urlInit.schedView ? { month: urlInit.schedMonth || '', filter: urlInit.schedFilter || '' } : null);
        // 組合（#lineups）：n 人數、picks「ID-名字」、min（null＝該人數預設）、view（''／'mx'）、season（''＝當季）、type（''＝依時節）
        const [lu, setLu] = useState(() => urlInit.luView ? luOf(urlInit) : null);
        // 球員比較（#cmp）：a／b「ID-名字」、sa／sb 賽季（''＝當季）、type、per（''／'36'）、pd、metric
        const [cmp, setCmp] = useState(() => urlInit.cmpView ? cmpOf(urlInit) : null);

        // 首頁：當季最新一場；當季還沒比賽（開季後到首戰前）退到上一季最後一場（休賽期 CURRENT_SEASON 仍是剛打完那季）
        useEffect(() => {
            if (!homePending || !isCloud || !window.loadSeasonSchedule) return;
            let cancelled = false;
            (async () => {
                // 例行賽期間最新一場一定在例行賽索引：先只讀它，不等季後賽索引（那份文件還不存在，查不存在的文件也要近 1 秒）。
                // 附加賽（4 月中）也在這段日期內：預覽文件有灰狼已開打的附加賽（gameId 005）才多讀附加賽索引
                if ((window.getSeasonPhase() || {}).type === 'regular') {
                    const [reg, pv] = await Promise.all([window.loadGamesIndex(window.CURRENT_SEASON, 'regular'),
                        window.loadPreview ? window.loadPreview(window.CURRENT_SEASON).catch(() => null) : null]);
                    const today = window.etToday();
                    const hasPi = !!pv && (pv.games || []).some(g => window.gameTypeOfId(g.id) === 'playin' && g.date <= today);
                    const pi = hasPi ? await window.loadGamesIndex(window.CURRENT_SEASON, 'playin') : [];
                    const all = [...reg, ...pi].sort((a, b) => a.date.localeCompare(b.date));
                    if (all.length) { if (!cancelled) setGameDate(all[all.length - 1].date); return; }
                }
                // 上一季用推算的，不讀手動維護的 HISTORY_SEASONS（開季時那份清單可能還沒加上剛打完的賽季）
                const y = parseInt(window.CURRENT_SEASON.slice(0, 4), 10);
                for (const s of [window.CURRENT_SEASON, `${y - 1}-${String(y % 100).padStart(2, '0')}`]) {
                    const gs = await window.loadSeasonSchedule(s);
                    if (gs.length) { if (!cancelled) setGameDate(gs[gs.length - 1].date); return; }
                }
            })().catch(e => console.error('home latest game fail', e))
                .finally(() => { if (!cancelled) setHomePending(false); });
            return () => { cancelled = true; };
        }, [homePending, isCloud]);
        // 連不上雲端（離線、登入失敗）時別卡在「載入最新一場」：8 秒後放棄，照舊顯示總覽
        useEffect(() => {
            if (!homePending || isCloud) return;
            const t = setTimeout(() => setHomePending(false), 8000);
            return () => clearTimeout(t);
        }, [homePending, isCloud]);

        // 只用 setter（不讀狀態值）：App 的 hashchange 監聽只在掛載時註冊一次
        const clearAll = () => {
            setGameDate(null); setGamePlayer(''); setGameTab(''); setGameBox('');
            setCapView(false); setVs(null); setSched(null); setLu(null); setCmp(null);
        };
        const applyPageHash = (st) => {
            setHomePending(false);   // 首頁還在找最新一場時使用者已經切走，以使用者的選擇為準
            // 同時帶多種時依此優先順序（與舊版 App.js 相同）
            const page = st.gameDate ? 'game' : st.capView ? 'cap' : st.schedView ? 'sched' : st.luView ? 'lu' : st.cmpView ? 'cmp' : st.vsView ? 'vs' : null;
            clearAll();
            if (!page) return false;
            if (page === 'game') { setGameDate(st.gameDate); setGamePlayer(st.gamePlayer || ''); setGameTab(st.gameTab || ''); setGameBox(st.gameBox || ''); }
            if (page === 'cap') { setCapView(true); setCapSeason(st.capSeason || ''); setCapTab(st.capTab || ''); }
            if (page === 'sched') setSched({ month: st.schedMonth || '', filter: st.schedFilter || '' });
            if (page === 'lu') setLu(luOf(st));
            if (page === 'cmp') setCmp(cmpOf(st));
            if (page === 'vs') setVs(vsOf(st));
            if (!(page === 'vs' && st.vsMetric)) window.scrollTo(0, 0);   // 對戰帶 m= 時由單隊頁自己捲到該指標
            return true;
        };
        const pageHash = () => (gameDate ? U.serialize({ gameDate, gamePlayer, gameTab, gameBox })
            : capView ? U.serialize({ capView, capSeason, capTab })
            : sched ? U.serialize({ schedView: true, schedMonth: sched.month, schedFilter: sched.filter })
            : lu ? hrefBody(U.lineupsHref(lu))
            : cmp ? hrefBody(U.compareHref(cmp))
            : vs ? U.serialize({ vsView: true, vsTeam: vs.team, vsRange: vs.range, vsType: vs.type, vsMetric: vs.metric })
            : null);

        const phaseType = () => (window.getSeasonPhase() || {}).type;
        // 組合頁的賽季與賽別：沒指定＝當季、依時節
        const luSeason = (lu && lu.season) || window.CURRENT_SEASON;
        const luType = (lu && lu.type) || window.AppLogic.luDefType(luSeason, phaseType());

        return {
            gameDate, setGameDate, gamePlayer, setGamePlayer, gameTab, setGameTab, gameBox, setGameBox, homePending,
            capView, capSeason, setCapSeason, capTab, setCapTab, vs, sched, setSched, lu, cmp, luSeason, luType,
            ownPage: !!(gameDate || capView || vs || sched || lu || cmp || homePending),
            applyPageHash, pageHash,
            openGame: (date, player) => go(U.gameHref(date, player)),
            openCap: () => go(U.capHref(capSeason, capTab)),   // 刊頭按鈕直接當 onClick 用，不可收參數（會收到事件物件）
            openSchedule: () => go(U.schedHref()),
            openLineups: (o) => go(U.lineupsHref(o)),   // o＝{ n, season, type, picks }（從總覽五人陣容點進來時帶主畫面的賽季）
            openCompare: (o) => go(U.compareHref(o)),   // o＝{ a, b, sa, sb, type }
            // 對戰：沿用目前的對戰範圍（從單隊頁回首頁、首頁點進單隊頁都不會把範圍重設）
            openVs: (team, metric) => go(U.vsHref(team || '', vs ? vs.range : '', vs ? vs.type : '', metric || '')),
            setVsRange: (range) => setVs(v => ({ ...v, range: range === 'recent' ? '' : range })),
            setVsType: (type) => setVs(v => ({ ...v, type: type === 'all' ? '' : type })),
            changeCmp: (patch) => setCmp(c => window.AppLogic.patchCmp(c, patch)),
            changeLu: (patch) => setLu(l => window.AppLogic.patchLu(l, patch, phaseType())),
            // 回主畫面：主畫面狀態在獨立整頁期間保持不動，直接切回（不用 history.back()：從外部連結打開時會離開本站）
            leave: clearAll,
        };
    };
})();
