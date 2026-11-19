// App.js 的資料載入 hooks（Firestore 讀取都要等匿名登入 isCloud，否則被安全規則拒絕、錯誤狀態不會自己清掉）。
// 2026-11-19 由 App.js 拆出（技術債 F 批）。各 hook 掛在 window，與 App.js 同一個打包作用域，所以一律寫 React.useState 等
//   useCloudReady       移除載入畫面、等 firebase-ready → isCloud
//   useSeasonSnapshots  主畫面快照：當季每日快照（先近期、需要時整季）／歷史期末快照；跨季比較與雷達疊加的載入
//   useScheduleData     比賽索引（單場面板）、整季賽程（刊頭月曆）、賽前預覽（未開打場次）
//   useSeasonGames      逐場 bundle（總覽季平均、Splits、期間篩選）＋條件戰績需要的全隊／其他球員逐場
(function () {
    const { useState, useEffect, useMemo, useRef } = React;

    window.useCloudReady = function () {
        const [isCloud, setIsCloud] = useState(window.isCloudEnabled);
        useEffect(() => {
            const loadingScreen = document.getElementById('loading-screen');
            if (loadingScreen) {
                loadingScreen.style.opacity = '0';
                setTimeout(() => loadingScreen.remove(), 500);
            }
            const handleCloudReady = () => setIsCloud(true);
            window.addEventListener('firebase-ready', handleCloudReady);
            if (window.isCloudEnabled) setIsCloud(true);
            return () => window.removeEventListener('firebase-ready', handleCloudReady);
        }, []);
        return isCloud;
    };

    // selectedSeasonKey：'current'＝當季 getDocs 範圍查詢；其他＝歷史期末快照 getDoc（＋Cache hist）。
    // 換賽季時把 selectedDate 設成 pendingDateRef（網址帶的日期，首次載入用）或清空（回到最新日）
    window.useSeasonSnapshots = function ({ isCloud, selectedSeasonKey, setSelectedDate, pendingDateRef }) {
        const SEASON_OPTIONS = window.SEASON_OPTIONS || [];
        const L = window.AppLogic;
        const [teamHistory, setTeamHistory] = useState([]);
        const [playerHistory, setPlayerHistory] = useState([]);
        const [historyLoading, setHistoryLoading] = useState(false);
        const [compareCache, setCompareCache] = useState({}); // { docId: { team, player (normalized) } }
        // 當季快照是否已收到回應（用來區分「還在載入」與「真的一份都沒有」）
        const [curSnapReceived, setCurSnapReceived] = useState(false);
        const [snapError, setSnapError] = useState(null);   // 當季快照讀取失敗訊息
        // 當季快照先只讀最近幾天（第一屏只需要「當期＋前一期」），整季序列等真的用到才補讀（由 App 判斷 needFullSnap）。
        // 整季約 120 份、首次傳輸近 9 MB，每次開站都整包讀會拖慢手機首屏，也吃 Firestore 每日讀取額度
        const [snapFull, setSnapFull] = useState(false);
        const [snapFullReady, setSnapFullReady] = useState(false);   // 整季資料已從伺服器到達
        const lastSnapSeasonRef = useRef(null);

        // 歷史期末快照的唯一取得路徑（快取 → Firestore），回傳未 normalize 的原始 doc pair。
        // 刻意「往上拋」而非吞錯回 null：呼叫端需要區分「載入失敗」與「查無此球員」，否則斷網時會謊報成「無 NBA 生涯資料」
        const fetchHistoryPair = async (docId) => {
            const cached = window.readHistoryCache(docId);
            if (cached) return cached;
            if (!window.db || !window.firebaseModules) throw new Error('Firestore 未就緒');
            const { doc: docFn, getDoc } = window.firebaseModules;
            const [teamSnap, playerSnap] = await Promise.all([
                getDoc(docFn(window.db, 'wolves_team_history', docId)),
                getDoc(docFn(window.db, 'wolves_player_history', docId)),
            ]);
            const pair = {
                team: teamSnap.exists() ? teamSnap.data() : null,
                player: playerSnap.exists() ? playerSnap.data() : null,
            };
            if (pair.team || pair.player) window.writeHistoryCache(docId, pair);
            return pair;
        };

        useEffect(() => {
            if (!window.db || !window.firebaseModules || !isCloud) return;
            const { collection, getDocs } = window.firebaseModules;
            // snapFull 從「最新幾份」升級成「整季」時也會重跑本 effect：此時不可清日期、不可回到載入中，
            // 舊資料留在畫面上直到整季資料到達
            const seasonChanged = lastSnapSeasonRef.current !== selectedSeasonKey;
            lastSnapSeasonRef.current = selectedSeasonKey;
            if (seasonChanged) {
                setSelectedDate(pendingDateRef.current || '');
                pendingDateRef.current = null;
                setCurSnapReceived(false);
                setSnapError(null);
            }

            if (selectedSeasonKey === 'current') {
                setHistoryLoading(false);
                // 只讀當季快照（doc id 即日期字串），用 doc id 範圍查詢：orderBy(documentId,'desc')／limitToLast 需要
                // __name__ 降冪索引，已實測會被拒。加上界是因為非日期 id（'latest' 等）字典序大於數字，
                // 只有下界會一併撈進來、new Date(id) 變 NaN 污染排序。只讀近期時只是把下界往後移
                const { query, where, documentId } = window.firebaseModules;
                const partial = !snapFull;
                const since = partial ? window.snapshotWindowStart() : window.SNAPSHOT_SINCE;
                const recent = (name) => query(collection(window.db, name),
                    where(documentId(), '>=', since), where(documentId(), '<=', window.SNAPSHOT_UNTIL));
                // 錯誤一定要接住並顯示：被安全規則擋下或缺索引時，不處理畫面就永遠停在骨架
                const onErr = (which) => (err) => {
                    // 近期查詢因「缺索引」被拒（failed-precondition）→ 退回整季查詢；權限、網路錯誤改讀整季也不會好，照常顯示錯誤
                    if (partial && err && err.code === 'failed-precondition') { console.warn(`snapshot ${which} partial query failed, loading full season`, err); setSnapFull(true); return; }
                    console.error(`snapshot ${which} failed`, err);
                    setSnapError(`${which}：${err.code || err.message || err}`);
                    setCurSnapReceived(true);
                };
                // lite 版沒有離線快取：斷網時 getDocs 直接丟錯（走 onErr）。cancelled：快速切換賽季／升級整季時，
                // 較晚回來的舊查詢不可覆寫新資料
                let cancelled = false;
                const load = (name, setter) => getDocs(recent(name)).then((snapshot) => {
                    if (cancelled) return;
                    if (partial && snapshot.size < 2) { setSnapFull(true); return; }
                    const data = snapshot.docs.map(d => ({ ...d.data(), date: d.id }));
                    data.sort((a, b) => new Date(b.date) - new Date(a.date));
                    setter(data);
                    setCurSnapReceived(true);
                    if (!partial) setSnapFullReady(true);
                }).catch((err) => { if (!cancelled) onErr(name)(err); });
                load('wolves_team_stats', setTeamHistory);
                load('wolves_player_stats', setPlayerHistory);
                return () => { cancelled = true; };
            }

            // 歷史賽季：單一期末快照，date 欄放賽季標籤（L.loadedSeasonKey 靠它分辨名單屬於哪一季）
            const opt = SEASON_OPTIONS.find(o => o.key === selectedSeasonKey);
            if (!opt || !opt.season) return;
            const docId = `${opt.season}_${opt.type}`;
            const apply = (teamData, playerData) => {
                setTeamHistory(teamData ? [{ ...teamData, date: opt.label }] : []);
                setPlayerHistory(playerData ? [L.normalizeHistoryPlayer({ ...playerData, date: opt.label })] : []);
            };
            const cached = window.readHistoryCache(docId);   // 有快取就即時套用，不閃骨架
            if (cached) { apply(cached.team, cached.player); return; }
            // cancelled 不可省：快速切換賽季時，先前那次較晚 resolve 會用舊賽季的資料覆寫
            let cancelled = false;
            setHistoryLoading(true);
            (async () => {
                try {
                    const pair = await fetchHistoryPair(docId);
                    if (!cancelled) apply(pair.team, pair.player);
                } catch (e) {
                    if (cancelled) return;
                    console.error('Fetch history failed', e);
                    setSnapError(`歷史賽季 ${opt.label}：${e.message || e}`);
                } finally {
                    if (!cancelled) setHistoryLoading(false);
                }
            })();
            return () => { cancelled = true; };
        }, [selectedSeasonKey, isCloud, snapFull]);

        // 依 docId 載入並 normalize，結果存入 compareCache（記憶體層，單次瀏覽內不失效）
        const loadHistoryByDocId = async (docId) => {
            if (!docId) return null;
            if (compareCache[docId]) return compareCache[docId];
            const raw = await fetchHistoryPair(docId);
            const v = { team: raw.team, player: L.normalizeHistoryPlayer(raw.player) };
            setCompareCache(prev => ({ ...prev, [docId]: v }));
            return v;
        };
        // 雷達疊加用：SEASON_OPTIONS 的 key → docId
        const loadHistoryDoc = (k) => {
            const opt = SEASON_OPTIONS.find(o => o.key === k);
            if (!opt || !opt.season) return Promise.resolve(null);
            return loadHistoryByDocId(`${opt.season}_${opt.type}`);
        };
        // 跨季比較／球員比較的某一季：current_{regular|playoffs} 讀當季某賽別最新的每日快照（組成與歷史 doc 同形的
        // { team, player }），其餘讀歷史期末快照。正在看當季就直接用已載入的序列；看舊賽季時另讀近期快照，近期沒有才讀整季
        const loadComparisonSeason = async (key) => {
            const m = /^current_(regular|playoffs)$/.exec(key || '');
            if (!m) return loadHistoryByDocId(key);
            if (compareCache[key]) return compareCache[key];
            const label = window.SEASON_TYPE_LABEL[m[1]];
            let team = null, player = null;
            if (selectedSeasonKey === 'current') { team = L.latestOfType(teamHistory, label); player = L.latestOfType(playerHistory, label); }
            // 兩邊都要有才用記憶體裡的序列：剛進頁時全隊快照先到、球員快照還沒到，只拿一邊會把「球員欄全 —」快取起來
            if (!team || !player) {
                if (!window.db || !window.firebaseModules) throw new Error('Firestore 未就緒');
                const { collection, getDocs, query, where, documentId } = window.firebaseModules;
                const read = async (name, since) => {
                    const snap = await getDocs(query(collection(window.db, name),
                        where(documentId(), '>=', since), where(documentId(), '<=', window.SNAPSHOT_UNTIL)));
                    return L.latestOfType(snap.docs.map(d => ({ ...d.data(), date: d.id })), label);
                };
                for (const since of [window.snapshotWindowStart(), window.SNAPSHOT_SINCE]) {
                    [team, player] = await Promise.all([read('wolves_team_stats', since), read('wolves_player_stats', since)]);
                    if (team || player || since === window.SNAPSHOT_SINCE) break;
                }
            }
            // 每日快照沒有 meta：補空 meta 讓「疊加其他球員」的名單（取自 meta 的名字）也列得出當季球員
            if (player && !player.meta) {
                const names = [...new Set([...Object.keys(player.stats || {}), ...Object.keys(player.base || {})])];
                player = { ...player, meta: Object.fromEntries(names.map(n => [n, {}])) };
            }
            const v = { team, player };
            if (team && player) setCompareCache(prev => ({ ...prev, [key]: v }));
            return v;
        };

        return {
            teamHistory, playerHistory, historyLoading, curSnapReceived, snapError, snapFull, setSnapFull, snapFullReady,
            compareCache, loadHistoryByDocId, loadHistoryDoc, loadComparisonSeason,
        };
    };

    // scheduleSeason：單場頁跟著那場比賽的賽季、其餘跟著刊頭所選賽季（App 算好傳入）
    window.useScheduleData = function ({ isCloud, scheduleSeason, seasonTypeView }) {
        // 比賽索引（總覽單場面板的日期選單）：依賽別分開存，必須跟著賽別切換，否則看季後賽時會列出例行賽場次
        const [gamesIndex, setGamesIndex] = useState([]);
        useEffect(() => {
            if (!window.db || !window.firebaseModules || !isCloud || !window.loadGamesIndex) return;
            let cancelled = false;
            setGamesIndex([]);
            window.loadGamesIndex(window.CURRENT_SEASON, seasonTypeView)
                .then(games => { if (!cancelled) setGamesIndex(games); })
                .catch(e => console.error('games index fetch fail', e));
            return () => { cancelled = true; };
        }, [isCloud, seasonTypeView]);

        // 刊頭賽程月曆：整季（例行＋季後＋附加賽）
        const [schedule, setSchedule] = useState({ season: null, games: [] });
        useEffect(() => {
            if (!window.db || !window.firebaseModules || !isCloud || !window.loadSeasonSchedule || !scheduleSeason) return;
            let cancelled = false;
            window.loadSeasonSchedule(scheduleSeason)
                .then(games => { if (!cancelled) setSchedule({ season: scheduleSeason, games }); })
                .catch(e => console.error('schedule fetch fail', e));
            return () => { cancelled = true; };
        }, [isCloud, scheduleSeason]);
        const scheduleGames = schedule.season === scheduleSeason ? schedule.games : [];

        // 未開打場次（賽前預覽文件，只有當季）：月曆虛框格、搜尋「下一場」；點進去是單場頁的預覽模式
        const [previewDoc, setPreviewDoc] = useState(null);
        useEffect(() => {
            if (!isCloud || !window.loadPreview || scheduleSeason !== window.CURRENT_SEASON) { setPreviewDoc(null); return; }
            let cancelled = false;
            window.loadPreview(scheduleSeason).then(v => { if (!cancelled) setPreviewDoc(v || null); });
            return () => { cancelled = true; };
        }, [isCloud, scheduleSeason]);
        const futureGames = useMemo(() => window.AppLogic.futureGames(previewDoc, scheduleSeason, scheduleGames),
            [previewDoc, scheduleGames, scheduleSeason]);
        const calendarGames = useMemo(() => [...scheduleGames, ...futureGames], [scheduleGames, futureGames]);
        return { gamesIndex, scheduleGames, previewDoc, futureGames, calendarGames };
    };

    // season／type：目前檢視的賽季與賽別（當季＝CURRENT_SEASON＋刊頭賽別；歷史＝期末快照那季）。
    // 球員視角沒有 pid（名單還沒到）時給空陣列。needs＝Period.needs()：條件戰績要的全隊／其他球員逐場
    window.useSeasonGames = function ({ isCloud, season, type, viewMode, pid, needs }) {
        const [seasonGames, setSeasonGames] = useState(null); // null＝載入中
        useEffect(() => {
            if (!isCloud || !window.loadSeasonGames) return;
            let cancelled = false;
            setSeasonGames(null);
            if (!season) { setSeasonGames([]); return; }
            if (viewMode === 'PLAYER' && !pid) { setSeasonGames([]); return; }
            window.loadSeasonGames(season, type, viewMode, viewMode === 'PLAYER' ? pid : null)
                .then(({ games }) => { if (!cancelled) setSeasonGames(games); })
                .catch(e => { console.error('season bundle load fail', season, type, e); if (!cancelled) setSeasonGames([]); });
            return () => { cancelled = true; };
        }, [season, type, viewMode, pid, isCloud]);

        // 期間＝條件時才讀需要的逐場（loadSeasonGames 有記憶體快取，切換不重讀）；換賽季先清掉別季的
        const [condTeam, setCondTeam] = useState(null);
        const [condPlayers, setCondPlayers] = useState({});   // { pid: games[] }
        useEffect(() => { setCondPlayers({}); setCondTeam(null); }, [season, type]);
        useEffect(() => {
            if (!needs.team || !isCloud || !season || !window.loadSeasonGames) return;
            let off = false;
            window.loadSeasonGames(season, type, 'TEAM')
                .then(r => { if (!off) setCondTeam(r.games || []); }).catch(e => console.error('cond team games fail', e));
            return () => { off = true; };
        }, [needs.team, isCloud, season, type]);
        useEffect(() => {
            const todo = needs.pids.filter(p => !condPlayers[p]);
            if (!todo.length || !isCloud || !season || !window.loadSeasonGames) return;
            let off = false;
            Promise.all(todo.map(p => window.loadSeasonGames(season, type, 'PLAYER', p).then(r => [p, r.games || []])))
                .then(list => { if (!off) setCondPlayers(m => ({ ...m, ...Object.fromEntries(list) })); })
                .catch(e => console.error('cond player games fail', e));
            return () => { off = true; };
        }, [needs.pids.join(','), isCloud, season, type]);
        return { seasonGames, condTeam, condPlayers };
    };
})();
