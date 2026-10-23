// 主應用元件
const { useState, useEffect, useMemo, useRef } = React;
const { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } = window.Recharts || {};

const App = () => {
    const Icons = window.Icons;
    const PlayTypesList = window.PlayTypesList;
    const trackingDefs = window.trackingDefs;
    const shootingDefs = window.shootingDefs || [];
    const clutchDefs = window.clutchDefs || [];
    const defenseDefs = window.defenseDefs || [];
    const oppZonesDefs = window.oppZonesDefs || [];
    const { PlayTypeCard, TrackingCardRow, SimpleLineChart, MultiLineChart, ShotChart } = window;

    // 偏好持久化 helper
    const loadPref = (key, fallback) => {
        try {
            const v = localStorage.getItem(`wt_pref_${key}`);
            return v == null ? fallback : JSON.parse(v);
        } catch (e) { return fallback; }
    };
    const savePref = (key, val) => {
        try { localStorage.setItem(`wt_pref_${key}`, JSON.stringify(val)); } catch (e) { /* ignore */ }
    };

    // 網址狀態優先於 localStorage 偏好：貼上的連結必須重現當時的畫面（格式見 urlState.js）
    const urlInit = useRef(window.UrlState ? window.UrlState.parse(window.location.hash) : {}).current;
    const pick = (k, fallback) => (urlInit[k] !== undefined ? urlInit[k] : fallback);

    const [teamHistory, setTeamHistory] = useState([]);
    const [playerHistory, setPlayerHistory] = useState([]);
    const [viewMode, setViewMode] = useState(() => pick('viewMode', loadPref('viewMode', 'TEAM')));
    const [viewSide, setViewSide] = useState(() => pick('viewSide', loadPref('viewSide', 'offensive')));
    const [selectedPlayer, setSelectedPlayer] = useState(() => pick('selectedPlayer', loadPref('selectedPlayer', '')));
    // 賽別檢視（當季）：預設休賽/季後賽期→季後賽，例行賽期→例行賽
    const [seasonTypeView, setSeasonTypeView] = useState(() => {
        const phase = window.getSeasonPhase ? window.getSeasonPhase() : { type: 'regular' };
        return pick('seasonTypeView', phase.type === 'regular' ? 'regular' : 'playoffs');
    });
    const [selectedDate, setSelectedDate] = useState(''); // 日曆選定日期（當季）；空=用最新
    // 網址帶的日期要等快照訂閱建立後才套用：載入 effect 一開始會清空 selectedDate（換季回到最新日）
    const pendingDateRef = useRef(urlInit.selectedDate || null);
    const [paletteOpen, setPaletteOpen] = useState(false);
    const [selectedCard, setSelectedCard] = useState(null);
    const [isCloud, setIsCloud] = useState(window.isCloudEnabled);
    const [selectedSeasonKey, setSelectedSeasonKey] = useState(() => pick('selectedSeasonKey', loadPref('selectedSeasonKey', 'current')));
    const [historyLoading, setHistoryLoading] = useState(false);
    const [compareKeys, setCompareKeys] = useState(() => loadPref('compareKeys', [])); // 疊加的歷史賽季 keys
    const [comparePlayers, setComparePlayers] = useState(() => loadPref('comparePlayers', [])); // 疊加的同季其他球員（雷達）
    const [compareCache, setCompareCache] = useState({}); // { docId: { team, player (normalized) } }
    const [gamesIndex, setGamesIndex] = useState([]); // 單場面板的比賽日期清單
    const [activeTab, setActiveTab] = useState(() => pick('activeTab', loadPref('activeTab', 'overview'))); // 章節
    // 單場比賽頁（網址 #game=）：有值時主區改顯示 GamePage；gamePlayer＝展開進階的球員（網址 p=）
    const [gameDate, setGameDate] = useState(() => urlInit.gameDate || null);
    const [gamePlayer, setGamePlayer] = useState(() => urlInit.gamePlayer || '');
    // 薪資頁（網址 #cap）：有值時主區改顯示 CapPage；capSeason＝薪資賽季（網址 s=，空＝薪資當季）
    const [capView, setCapView] = useState(() => !!urlInit.capView);
    const [capSeason, setCapSeason] = useState(() => urlInit.capSeason || '');
    const [capTab, setCapTab] = useState(() => urlInit.capTab || '');   // 薪資頁分頁（網址 tab=，空＝總覽）
    const [capDoc, setCapDoc] = useState(window.__capDoc);   // 薪資資料（球員身分列顯示該季薪資用；與薪資頁共用同一份）
    const [seasonGames, setSeasonGames] = useState(null); // 當前賽季逐場 bundle（總覽/Splits 共用）；null=載入中
    // 當季快照是否已收到回應（用來區分「還在載入」與「真的一份都沒有」）
    const [curSnapReceived, setCurSnapReceived] = useState(false);
    const [snapError, setSnapError] = useState(null);   // 當季快照訂閱失敗訊息
    // 當季快照先只讀最近幾天（第一屏只需要「當期＋前一期」），整季序列等真的用到才補讀：
    // 開走勢視窗、選日期、或目前賽別在近期快照裡湊不到兩份。整季約 120 份、首次傳輸近 9 MB，
    // 每次開站都整包讀會拖慢手機首屏，也吃 Firestore 每日讀取額度
    const [snapFull, setSnapFull] = useState(false);
    const [snapFullReady, setSnapFullReady] = useState(false);   // 整季資料已從伺服器到達
    const lastSnapSeasonRef = useRef(null);
    // Splits 打開逐場走勢的指標（網址 m=）與圈出的那一場（hl=）。綁定「實體＋章節」：
    // 換球員／球隊或離開 Splits 就自動失效，不會帶著舊的 m/hl 跑到別的畫面
    const focusKeyOf = (vm, p, tab) => `${vm}|${vm === 'PLAYER' ? p : ''}|${tab}`;
    const [focus, setFocus] = useState(() => urlInit.focusMetric
        ? { m: urlInit.focusMetric, hl: urlInit.highlightDate || null, key: focusKeyOf(urlInit.viewMode, urlInit.selectedPlayer, urlInit.activeTab) }
        : null);
    useEffect(() => savePref('activeTab', activeTab), [activeTab]);

    // 同步偏好回 localStorage
    useEffect(() => savePref('viewMode', viewMode), [viewMode]);
    useEffect(() => savePref('viewSide', viewSide), [viewSide]);
    useEffect(() => savePref('selectedPlayer', selectedPlayer), [selectedPlayer]);
    useEffect(() => savePref('selectedSeasonKey', selectedSeasonKey), [selectedSeasonKey]);
    useEffect(() => savePref('compareKeys', compareKeys), [compareKeys]);
    useEffect(() => savePref('comparePlayers', comparePlayers), [comparePlayers]);

    const isHistoryMode = selectedSeasonKey !== 'current';
    const SEASON_OPTIONS = window.SEASON_OPTIONS || [];
    const COMPARE_COLORS = ['#60a5fa', '#f59e0b', '#ec4899']; // 比較色盤（primary 不用這些）
    const MAX_COMPARE = 2;

    // 將歷史 player doc（PlayerID-keyed）轉成與 daily 同構（playerName-keyed）
    // 各類別（tracking/base/shooting/clutch/defense/onoff）皆以球員名展開
    const HISTORY_CATS = ['tracking', 'base', 'shooting', 'clutch', 'defense', 'onoff'];
    const normalizeHistoryPlayer = (doc) => {
        if (!doc) return doc;
        const out = { stats: {}, meta: {} };
        HISTORY_CATS.forEach(c => { out[c] = {}; });
        Object.entries(doc.stats || {}).forEach(([pid, p]) => {
            const name = p.playerName;
            if (!name) return;
            const pidNum = parseInt(pid, 10);
            out.stats[name] = (p.stats || []).map(s => ({ ...s, playerId: pidNum }));
            // meta：球員層級的 metadata（非統計值）。teamAbbr 用來標示新援該季的舊東家，
            // isNewcomer 用來判定對位防守 / On-Off 是「跨隊不適用」而非 0
            out.meta[name] = {
                playerId: pidNum,
                teamAbbr: p.teamAbbr || null,
                isCurrentRoster: !!p.isCurrentRoster,
                isNewcomer: !!p.isNewcomer,
            };
            HISTORY_CATS.forEach(c => {
                out[c][name] = {
                    ...(p[c] || {}), playerId: pidNum,
                    isCurrentRoster: !!p.isCurrentRoster, teamAbbr: p.teamAbbr || null,
                };
            });
        });
        return { ...doc, ...out };
    };

    // 載入比賽索引（單場面板的日期選單用；一份 doc，localStorage 快取，見 gamesData.js 的 loadGamesIndex）
    // 索引依賽別分開存（backfill_games.py / fetch_data.py 寫 {season}_{type}），必須跟著賽別切換，
    // 否則看季後賽時選單會列出例行賽場次。
    useEffect(() => {
        if (!window.db || !window.firebaseModules || !isCloud || !window.loadGamesIndex) return;   // 等匿名登入完成，否則被安全規則拒絕
        let cancelled = false;
        setGamesIndex([]);
        window.loadGamesIndex(window.CURRENT_SEASON, seasonTypeView)
            .then(games => { if (!cancelled) setGamesIndex(games); })
            .catch(e => console.error('games index fetch fail', e));
        return () => { cancelled = true; };
    }, [isCloud, seasonTypeView]);

    // 註：逐場 games 的載入改在 Splits 分頁需要時才做（lazy），總覽季平均改讀快照的 base 欄位

    // Mount-time setup：移除 loading 畫面、監聽 Firebase ready
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

    // 資料載入：依 selectedSeasonKey 切換 onSnapshot（current）或 getDoc + localStorage 快取（history）
    useEffect(() => {
        // 必須等匿名登入完成（isCloud）：安全規則要求已登入，先訂閱會被拒且錯誤狀態不會自己清掉
        if (!window.db || !window.firebaseModules || !isCloud) return;
        const { collection, onSnapshot } = window.firebaseModules;
        // snapFull 從「最新幾份」升級成「整季」時也會重跑本 effect：此時不可清日期、不可回到載入中，
        // 舊資料留在畫面上直到整季資料到達
        const seasonChanged = lastSnapSeasonRef.current !== selectedSeasonKey;
        lastSnapSeasonRef.current = selectedSeasonKey;
        if (seasonChanged) {
            setSelectedDate(pendingDateRef.current || ''); // 切賽季時回到最新日期（首次載入則套用網址帶的日期）
            pendingDateRef.current = null;
            setCurSnapReceived(false);
            setSnapError(null);
        }

        if (selectedSeasonKey === 'current') {
            setHistoryLoading(false);
            // 只訂閱當季快照（doc id 即日期字串）。用範圍過濾而非 orderBy+limit：
            // 後者需要 Firestore 複合索引，而 onSnapshot 無 error callback，
            // 缺索引時會靜默失敗讓整個面板空掉。詳見 constants.js 的 SNAPSHOT_SINCE
            const { query, where, documentId } = window.firebaseModules;
            // 加上界：doc id 是日期字串，但非日期 id（如 'latest'、'meta'）字典序都大於數字，
            // 只有下界會把它們一併撈進來，之後 new Date(id) 變 NaN 污染排序。
            // 只讀最近幾天時，只是把下界往後移（同樣是 doc id 範圍查詢，免建索引）。
            // 不用 orderBy(documentId,'desc')/limitToLast：那需要 __name__ 降冪索引，已實測會被拒
            const partial = !snapFull;
            const since = partial ? window.snapshotWindowStart() : window.SNAPSHOT_SINCE;
            const recent = (name) => query(collection(window.db, name),
                where(documentId(), '>=', since), where(documentId(), '<=', window.SNAPSHOT_UNTIL));
            // 必須帶 error callback：沒有的話，查詢被安全規則擋下或缺索引時
            // callback 永遠不會被呼叫，畫面就永遠停在骨架，看不出哪裡錯了
            const onErr = (which) => (err) => {
                // 近期查詢若因「缺索引」被拒（failed-precondition），退回整季查詢，不讓畫面空掉。
                // 其他錯誤（權限、網路）改讀整季也不會好，照常顯示錯誤，免得白白多抓整季資料
                if (partial && err && err.code === 'failed-precondition') { console.warn(`snapshot ${which} partial query failed, loading full season`, err); setSnapFull(true); return; }
                console.error(`snapshot ${which} failed`, err);
                setSnapError(`${which}：${err.code || err.message || err}`);
                setCurSnapReceived(true);
            };
            // 連不上伺服器時，Firestore 會先丟一個「本機快取的空結果」（fromCache=true）。
            // 不可當真：否則斷網會被顯示成「當季尚無快照資料」，誤導成資料庫真的沒資料。
            // 略過它、維持載入中，等伺服器真正回應（或 onErr）
            const offlineEmpty = (snapshot) => snapshot.empty && snapshot.metadata && snapshot.metadata.fromCache;
            const unsubA = onSnapshot(recent("wolves_team_stats"), (snapshot) => {
                if (offlineEmpty(snapshot)) return;
                if (partial && snapshot.size < 2) { setSnapFull(true); return; }
                const data = snapshot.docs.map(d => ({ ...d.data(), date: d.id }));
                data.sort((a, b) => new Date(b.date) - new Date(a.date));
                setTeamHistory(data);
                setCurSnapReceived(true);
                if (!partial && !snapshot.metadata.fromCache) setSnapFullReady(true);
            }, onErr('wolves_team_stats'));
            const unsubB = onSnapshot(recent("wolves_player_stats"), (snapshot) => {
                if (offlineEmpty(snapshot)) return;
                if (partial && snapshot.size < 2) { setSnapFull(true); return; }
                const data = snapshot.docs.map(d => ({ ...d.data(), date: d.id }));
                data.sort((a, b) => new Date(b.date) - new Date(a.date));
                setPlayerHistory(data);
                setCurSnapReceived(true);
                if (!partial && !snapshot.metadata.fromCache) setSnapFullReady(true);
            }, onErr('wolves_player_stats'));
            return () => { unsubA(); unsubB(); };
        }

        // History mode
        const opt = SEASON_OPTIONS.find(o => o.key === selectedSeasonKey);
        if (!opt || !opt.season) return;
        const docId = `${opt.season}_${opt.type}`;

        const apply = (teamData, playerData) => {
            const dateLabel = opt.label;
            setTeamHistory(teamData ? [{ ...teamData, date: dateLabel }] : []);
            setPlayerHistory(playerData ? [normalizeHistoryPlayer({ ...playerData, date: dateLabel })] : []);
        };

        // 有快取就即時套用，不閃 skeleton
        const cached = window.readHistoryCache(docId);
        if (cached) { apply(cached.team, cached.player); return; }

        // cancelled 旗標不可省：快速切換賽季時，先前那次較晚 resolve 會用舊賽季的
        // 資料覆寫 teamHistory/playerHistory。切回當季時特別嚴重——onSnapshot 只在
        // 資料「變動」時才推送，被覆寫後不會自動修復，得重整頁面才會好
        let cancelled = false;
        setHistoryLoading(true);
        (async () => {
            try {
                const pair = await fetchHistoryPair(docId);
                if (cancelled) return;
                apply(pair.team, pair.player);
            } catch (e) {
                if (cancelled) return;
                console.error('Fetch history failed', e);
                alert('載入歷史賽季失敗：' + (e.message || e));
            } finally {
                if (!cancelled) setHistoryLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [selectedSeasonKey, isCloud, snapFull]);

    // 歷史終點快照的唯一取得路徑（快取 → Firestore），回傳未 normalize 的原始 doc pair。
    // 刻意「往上拋」而非吞錯回 null：呼叫端需要區分「載入失敗」與「查無此球員」，
    // 否則斷網時會謊報成「無 NBA 生涯資料」。
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

    // 依 docId 載入並 normalize，結果存入 compareCache（記憶體層，單次工作階段內不失效）
    const loadHistoryByDocId = async (docId) => {
        if (!docId) return null;
        if (compareCache[docId]) return compareCache[docId];
        const raw = await fetchHistoryPair(docId);
        const v = { team: raw.team, player: normalizeHistoryPlayer(raw.player) };
        setCompareCache(prev => ({ ...prev, [docId]: v }));
        return v;
    };

    // 通用歷史 doc 載入（雷達疊加用）。SEASON_OPTIONS 的 key 本身即 docId，
    // 保留這層封裝以防未來 key 格式變動。
    const loadHistoryDoc = (k) => {
        const opt = SEASON_OPTIONS.find(o => o.key === k);
        if (!opt || !opt.season) return Promise.resolve(null);
        return loadHistoryByDocId(`${opt.season}_${opt.type}`);
    };

    // 比較資料載入（雷達 overlay 用）
    useEffect(() => {
        if (compareKeys.length === 0) return;
        // fire-and-forget，但 loadHistoryDoc 會拋錯 → 必須接住避免 unhandled rejection
        compareKeys.forEach(k => {
            loadHistoryDoc(k).catch(e => console.error('compare overlay load fail', k, e));
        });
    }, [compareKeys]);

    const getCompareEntry = (k) => {
        const opt = SEASON_OPTIONS.find(o => o.key === k);
        if (!opt || !opt.season) return null;
        const docId = `${opt.season}_${opt.type}`;
        const data = compareCache[docId];
        if (!data) return null;
        let stats = [], tracking = {};
        if (viewMode === 'TEAM') {
            stats = data.team?.stats || [];
            tracking = data.team?.tracking || {};
        } else {
            stats = data.player?.stats?.[selectedPlayer] || [];
            tracking = data.player?.tracking?.[selectedPlayer] || {};
        }
        // 新援在該季的舊東家標示：疊加多季時才看得出「這季他在哪一隊」
        const tag = viewMode === 'PLAYER' ? window.tagOfMeta(data.player?.meta?.[selectedPlayer]) : '';
        return {
            key: k, label: opt.label + tag, stats, tracking,
            shortLabel: (opt.short || opt.label) + tag,
        };
    };

    const toggleCompareKey = (k) => {
        if (k === 'current' || k === selectedSeasonKey) return;
        setCompareKeys(prev => {
            if (prev.includes(k)) return prev.filter(x => x !== k);
            if (prev.length >= MAX_COMPARE) return prev;
            return [...prev, k];
        });
    };

    const toggleComparePlayer = (name) => {
        if (name === selectedPlayer) return;
        setComparePlayers(prev => {
            if (prev.includes(name)) return prev.filter(x => x !== name);
            if (prev.length >= MAX_COMPARE) return prev;
            return [...prev, name];
        });
    };

    const handleStatusClick = () => {
        if (isCloud) {
            alert("🔵 連線正常：已成功連線至 Firestore 資料庫，並進入純讀取模式。");
            return;
        }
        const err = window.firebaseError;
        const dbReady = !!window.db;
        const modulesReady = !!window.firebaseModules;
        const lines = [
            "🔴 連線失敗診斷：",
            "",
            "window.db 存在：" + dbReady,
            "window.firebaseModules 存在：" + modulesReady,
            "window.isCloudEnabled：" + window.isCloudEnabled,
            "",
        ];
        if (err) {
            lines.push("Firebase 錯誤：");
            lines.push("  code: " + (err.code || "(無)"));
            lines.push("  message: " + (err.message || String(err)));
        } else {
            lines.push("尚未收到 Firebase 任何回應 / 錯誤事件。");
            lines.push("可能原因：");
            lines.push("  1. 網路阻擋 firebase.googleapis.com");
            lines.push("  2. Firebase 專案未啟用『匿名登入』");
            lines.push("  3. signInAnonymously 仍在 pending");
        }
        alert(lines.join("\n"));
        console.log("[Firebase 診斷]", { dbReady, modulesReady, err, isCloudEnabled: window.isCloudEnabled });
    };

    // Derive Stats
    let currentStats = []; let currentTracking = {};
    let prevStats = []; let prevTracking = {};
    let currentShooting = {}; let prevShooting = {};
    let currentClutch = {}; let prevClutch = {};
    let currentDefense = {}; let prevDefense = {};
    let currentLineups = []; let currentOnoff = {}; let currentBase = {};
    let displayDate = "尚無數據"; let currentPlayerId = null;
    // 選定球員的 metadata（僅歷史快照有；當季快照無 meta → null）
    let selectedMeta = null;
    let currentSeason = null; let currentSeasonType = null;

    // 當季依賽別過濾快照序列（歷史模式為單筆終點快照）
    const stTypeLabel = seasonTypeView === 'regular' ? '例行賽' : '季後賽';
    const teamSeq = isHistoryMode ? teamHistory : teamHistory.filter(d => d.seasonType === stTypeLabel);
    const playerSeq = isHistoryMode ? playerHistory : playerHistory.filter(d => d.seasonType === stTypeLabel);
    // 日曆有效日期：selectedDate 或該賽別最新一天
    const latestDate = (teamSeq[0] || playerSeq[0] || {}).date || '';
    const effectiveDate = selectedDate || latestDate;
    // 定位快照（序列 date desc，取第一個 <= effectiveDate）；歷史模式固定單筆
    const seqIndex = (seq) => {
        if (isHistoryMode) return 0;
        const i = seq.findIndex(d => d.date <= effectiveDate);
        return i === -1 ? 0 : i;
    };
    const teamIdx = seqIndex(teamSeq);
    const playerIdx = seqIndex(playerSeq);
    // 何時要補讀整季快照（見 snapFull 說明）：選了日期、開了走勢視窗、或目前賽別在近期快照裡不足兩份
    const needFullSnap = !isHistoryMode && !snapFull && curSnapReceived
        && (!!selectedDate || !!selectedCard || (teamSeq.length < 2 && playerSeq.length < 2));
    useEffect(() => { if (needFullSnap) setSnapFull(true); }, [needFullSnap]);

    if (viewMode === 'TEAM') {
        const current = teamSeq[teamIdx]; const prev = teamSeq[teamIdx + 1];
        if (current) {
            currentStats = current.stats || []; currentTracking = current.tracking || {}; displayDate = current.date;
            currentShooting = current.shooting || {}; currentClutch = current.clutch || {};
            currentDefense = current.defense || {};
            currentLineups = current.lineups || []; currentBase = current.base || {};
            currentSeason = current.season; currentSeasonType = current.seasonType;
        }
        if (prev) {
            prevStats = prev.stats || []; prevTracking = prev.tracking || {};
            prevShooting = prev.shooting || {}; prevClutch = prev.clutch || {};
            prevDefense = prev.defense || {};
        }
    } else {
        const current = playerSeq[playerIdx]; const prev = playerSeq[playerIdx + 1];
        if (current) { currentSeason = current.season; currentSeasonType = current.seasonType; }
        // 開季初 NBA 尚未釋出 Synergy，快照只有 base 等類別 → 以 base 判定球員存在
        if (current && (current.stats?.[selectedPlayer] || current.base?.[selectedPlayer])) {
            currentStats = current.stats?.[selectedPlayer] || []; currentTracking = current.tracking?.[selectedPlayer] || {}; displayDate = current.date;
            currentShooting = current.shooting?.[selectedPlayer] || {};
            currentClutch = current.clutch?.[selectedPlayer] || {};
            currentDefense = current.defense?.[selectedPlayer] || {};
            currentOnoff = current.onoff?.[selectedPlayer] || {};
            currentBase = current.base?.[selectedPlayer] || {};
            if (currentStats.length > 0 && currentStats[0].playerId) currentPlayerId = currentStats[0].playerId;
            else if (currentTracking.playerId) currentPlayerId = currentTracking.playerId;
            else if (currentBase.playerId) currentPlayerId = currentBase.playerId;
            // 第三層 fallback：新援若 Synergy 與 tracking 皆空（例如出賽極少），
            // 前兩層會撈不到 ID，導致投籃分頁誤顯示「請先選擇球員」
            else if (current.meta?.[selectedPlayer]?.playerId) currentPlayerId = current.meta[selectedPlayer].playerId;
        }
        selectedMeta = current?.meta?.[selectedPlayer] || null;
        if (prev) {
            prevStats = prev.stats?.[selectedPlayer] || [];
            prevTracking = prev.tracking?.[selectedPlayer] || {};
            prevShooting = prev.shooting?.[selectedPlayer] || {};
            prevClutch = prev.clutch?.[selectedPlayer] || {};
            prevDefense = prev.defense?.[selectedPlayer] || {};
        }
    }

    // 新援＝該季不在灰狼、現在是灰狼。對位防守與 On-Off 的 NBA API 都必須綁 TeamID，
    // 該季他不在灰狼 → 語意上取不到，必須顯示「不適用」而不是 0。
    // Hustle / DefenseBox 走 leaguedash（不綁隊），跨隊有值，不可一併標成不適用。
    const isNewcomerSel = viewMode === 'PLAYER' && !!selectedMeta?.isNewcomer;
    const naCrossTeam = isNewcomerSel ? window.NA_REASON.CROSS_TEAM : null;
    // 選定球員的球隊標示（留隊球員回空字串 → 畫面完全不變）
    const selTag = viewMode === 'PLAYER' ? window.tagOfMeta(selectedMeta) : '';
    // normalizeHistoryPlayer 會注入 playerId/isCurrentRoster/teamAbbr，
    // 用 Object.keys().length 判斷「有沒有防守資料」對歷史快照永遠為真 → 必須排除 metadata
    const hasDefenseData = window.hasRealData(currentDefense);
    // 缺防守時的說明：當季每日快照的 defense 類別是賽季中途才加進抓取的，
    // 舊日期的快照本來就沒有，不可籠統說「此賽季無防守數據」（會讓人以為整季沒資料）。
    // 回傳 { msg, jumpDate }：jumpDate = 離目前日期最近、有防守數據的快照日（可一鍵跳過去）
    const defenseMissing = (() => {
        if (hasDefenseData) return null;
        if (isHistoryMode) return { msg: '此賽季的期末快照沒有防守數據' };
        const seq = viewMode === 'TEAM' ? teamSeq : playerSeq;
        const cur = seq[viewMode === 'TEAM' ? teamIdx : playerIdx];
        const defOf = d => viewMode === 'TEAM' ? d.defense : d.defense?.[selectedPlayer];
        if (viewMode === 'PLAYER' && cur && window.hasRealData(cur.defense) && !window.hasRealData(defOf(cur))) {
            return { msg: `${selectedPlayer} 在 ${cur.date} 的快照沒有防守數據` };
        }
        const withDef = seq.filter(d => window.hasRealData(defOf(d))).map(d => d.date);
        const fallback = `可從賽季選單選「${window.CURRENT_SEASON} ${stTypeLabel}」查看期末完整快照。`;
        if (!withDef.length) return { msg: `當季${stTypeLabel}的每日快照都沒有防守數據（防守類別較晚才加入抓取）。${fallback}` };
        const t = new Date(effectiveDate).getTime();
        const jumpDate = withDef.slice().sort((a, b) => Math.abs(new Date(a) - t) - Math.abs(new Date(b) - t))[0];
        return { msg: `${cur ? cur.date : effectiveDate} 的快照沒有防守數據（防守類別較晚才加入抓取，只有部分日期有）。`, jumpDate };
    })();

    // 逐場 bundle（總覽季平均 + Splits 共用）：依賽季/攻守實體/球員切換載入（單一 getDoc，可靠）
    useEffect(() => {
        if (!isCloud || !window.loadSeasonGames) return;
        let cancelled = false;
        setSeasonGames(null);
        (async () => {
            let combos = [];
            if (selectedSeasonKey === 'current') {
                combos = [[window.CURRENT_SEASON, seasonTypeView]]; // 依賽別檢視載入單一 bundle
            } else {
                const opt = SEASON_OPTIONS.find(o => o.key === selectedSeasonKey);
                if (opt && opt.season) combos = [[opt.season, opt.type]];
            }
            const pid = viewMode === 'PLAYER' ? currentPlayerId : null;
            if (viewMode === 'PLAYER' && !pid) { if (!cancelled) setSeasonGames([]); return; }
            const all = [];
            for (const [s, t] of combos) {
                try { const { games } = await window.loadSeasonGames(s, t, viewMode, pid); all.push(...games); }
                catch (e) { console.error('season bundle load fail', s, t, e); }
            }
            if (!cancelled) setSeasonGames(all);
        })();
        return () => { cancelled = true; };
    }, [selectedSeasonKey, seasonTypeView, viewMode, currentPlayerId, isCloud]);

    // 2-C 資料陳舊與休賽期判斷（歷史模式略過）
    const seasonStatus = useMemo(() => {
        if (isHistoryMode) return null;
        const phase = window.getSeasonPhase ? window.getSeasonPhase() : { inSeason: true, label: '' };
        if (!phase.inSeason) {
            const s = window.CURRENT_SEASON || '';
            return { kind: 'offseason', message: `目前為休賽期，以下為 ${s} 賽季最終數據（非即時），下次更新預計 10/20` };
        }
        const latest = (viewMode === 'TEAM' ? teamHistory[0] : playerHistory[0])?.date;
        if (!latest) return null;
        const latestDate = new Date(latest + 'T00:00:00');
        if (isNaN(latestDate.getTime())) return null;
        const ageDays = (Date.now() - latestDate.getTime()) / 86400000;
        if (ageDays > 2) {
            return { kind: 'stale', message: `最新資料為 ${latest}，已超過 2 天未更新（${Math.floor(ageDays)} 天前）` };
        }
        return null;
    }, [teamHistory, playerHistory, viewMode, isHistoryMode]);

    // 新援跳轉：pending 記住「使用者剛點的人 + 目標賽季」。
    // setSelectedSeasonKey 是 async 載入，這段期間 availablePlayers 仍是舊賽季的清單，
    // 下方「自動修正 selectedPlayer」的 effect 會把剛選的人覆寫回第一人 → 必須擋住
    const pendingPlayerRef = useRef(null);
    const [probing, setProbing] = useState('');
    const [probeMsg, setProbeMsg] = useState('');
    const [probeTarget, setProbeTarget] = useState('');  // 提示列「查看最近一季」按鈕的對象

    // 依 HISTORY_PROBE_ORDER 逐季探測，找到第一個真的有資料的賽季後切過去。
    // 用探測而非硬編 rookie 旗標：同一套機制順帶處理「該季在海外聯賽」的情況（如 Trey Lyles）
    const jumpToPlayerHistory = async (name) => {
        setProbing(name); setProbeMsg(''); setProbeTarget('');
        try {
            for (const docId of (window.HISTORY_PROBE_ORDER || [])) {
                const v = await loadHistoryByDocId(docId);
                const names = Object.keys(v?.player?.stats || {});
                const hit = names.find(n => window.nameKey(n) === window.nameKey(name));
                if (hit) {
                    pendingPlayerRef.current = { name: hit, docId };
                    setViewMode('PLAYER');
                    setSelectedPlayer(hit);
                    setSelectedSeasonKey(docId);
                    return;
                }
            }
            setProbeMsg(`${name}：無 NBA 生涯資料（近兩季未於 NBA 出賽，可能為新秀）`);
        } catch (e) {
            // 必須與「查無資料」分開：fetchHistoryPair 會往上拋，斷網時不可謊報成無資料
            console.error('probe history failed', name, e);
            setProbeMsg(`${name}：歷史資料載入失敗（${e.message || e}），請稍後再試`);
        } finally {
            setProbing('');
        }
    };

    // 進行中賽季點「本季無數據」的人：留在當季只提示，不自動切到舊賽季（預設一律看進行中賽季）；
    // 要看舊資料由提示列按鈕明確觸發探測。瀏覽歷史賽季時維持直接探測
    const onMissingPlayer = (name) => {
        if (isHistoryMode) return jumpToPlayerHistory(name);
        setProbeMsg(`${name}：本季尚無出賽數據`);
        setProbeTarget(name);
    };

    // 動態取得當前數據中有的球員清單
    const availablePlayers = useMemo(() => {
        const currentData = playerSeq[playerIdx];
        if (!currentData || (!currentData.stats && !currentData.base)) return [];
        // 名單取 stats ∪ base：開季初 Synergy 尚未釋出時 stats 為空，球員只出現在 base
        const names = [...new Set([...Object.keys(currentData.stats || {}), ...Object.keys(currentData.base || {})])];
        // 依該份快照的輪換強度遞減排序 = 這一季實際的輪換順序。
        // 刻意不用硬編碼的先發名單：一份全域名單不可能同時對多個賽季正確
        // （看 2025-26 該是 Randle/Conley 在前，看 2026-27 該是 LaMelo/Kuminga 在前），
        // 而且每次交易都要手改。改用資料本身的欄位，永遠跟著所選賽季走。
        //
        // base 是後期才加進每日快照的，2025-26 的 57 份快照裡只有 1 份有；
        // 其餘只有 Synergy stats，所以需要 fallback：每場進攻總球權同樣能反映輪換強度。
        // 尺度在「整份快照」層級擇一，不逐球員混用——MIN(~33) 與 poss(~26) 量級不同，
        // 混用會讓有 base 的球員被系統性排到前面
        const possOf = (n) => (currentData.stats?.[n] || [])
            .filter(x => x.side === 'offensive')
            .reduce((sum, x) => sum + (typeof x.poss === 'number' ? x.poss : 0), 0);
        const useMin = !!currentData.base;
        const weightOf = (n) => {
            if (!useMin) return possOf(n);
            const v = currentData.base[n]?.MIN;
            return typeof v === 'number' ? v : -1;
        };
        return names.sort((a, b) => (weightOf(b) - weightOf(a)) || a.localeCompare(b));
    }, [playerHistory, playerIdx, seasonTypeView, isHistoryMode]);

    // 自動修正 selectedPlayer
    useEffect(() => {
        if (viewMode === 'PLAYER' && availablePlayers.length > 0) {
            const pending = pendingPlayerRef.current;
            if (pending) {
                const hit = availablePlayers.find(n => window.nameKey(n) === window.nameKey(pending.name));
                if (hit) {
                    pendingPlayerRef.current = null;
                    if (selectedPlayer !== hit) setSelectedPlayer(hit);
                    return;
                }
                // 尚未命中 → 判斷是「資料還沒到」還是「使用者自己切走了」。
                // 不可用 selectedSeasonKey 當判準：它是同步更新的，而 availablePlayers
                // 要等 getDoc 回來才換，中間會有一拍「季別已是新的、清單還是舊的」，
                // 此時清掉旗標就會讓下面的自動修正把剛選的新援換成舊清單的第一人
                if (selectedSeasonKey === pending.docId) return;
                pendingPlayerRef.current = null;   // 使用者已切到別季 → 放棄這次跳轉
            }
            if (!selectedPlayer || !availablePlayers.includes(selectedPlayer)) {
                // 換季時名字可能有句點差異（Jr. / Jr），先用 nameKey 救一次再退回第一人。
                // 必須先確認 selectedPlayer 非空：nameKey('') 也是 ''，若快照裡有空白 key
                // 會誤命中並把 selectedPlayer 設成垃圾值
                const soft = selectedPlayer &&
                    availablePlayers.find(n => window.nameKey(n) === window.nameKey(selectedPlayer));
                setSelectedPlayer(soft || availablePlayers[0]);
            }
        }
    }, [viewMode, availablePlayers, selectedSeasonKey]);

    // 在 2026-27 名冊上、但所選賽季的快照裡沒有數據的球員（新援 / 尚未出賽者）。
    // availablePlayers 本體刻意不動——回補跑完後新援會自然出現在歷史快照裡，
    // 這一組只負責提供「從當季面板跳過去」的入口
    const missingRosterNames = useMemo(() => {
        const have = new Set(availablePlayers.map(window.nameKey));
        return (window.CURRENT_ROSTER_NAMES || []).filter(n => !have.has(window.nameKey(n)));
    }, [availablePlayers]);

    // 空狀態要分三種，否則使用者只會看到一片沒有說明的空卡片：
    //   訂閱失敗 / 整個賽季一份快照都沒有 / 有快照但這個賽別沒有
    // 第三種用 teamSeq（賽別過濾後）判斷而非 teamHistory——休賽期預設看季後賽，
    // 球隊沒打進季後賽時就會踩到
    const curNoDocsAtAll = selectedSeasonKey === 'current' && curSnapReceived
        && teamHistory.length === 0 && playerHistory.length === 0;
    // 只讀了近期快照時（!snapFull），這個賽別沒有不代表整季沒有——整季正在補讀，先顯示載入中
    const curNoDocsThisType = selectedSeasonKey === 'current' && curSnapReceived && snapFullReady
        && !curNoDocsAtAll && teamSeq.length === 0 && playerSeq.length === 0;
    const noCurrentSnapshots = !!snapError || curNoDocsAtAll || curNoDocsThisType;
    const showSkeleton = !noCurrentSnapshots
        && (historyLoading || (teamHistory.length === 0 && playerHistory.length === 0 && isCloud)
            || (!isHistoryMode && !snapFullReady && teamSeq.length === 0 && playerSeq.length === 0)
            // 選了日期但整季還沒到：手上只有近期快照，硬顯示會把最新一天的數字標成所選日期
            || (!isHistoryMode && !!selectedDate && !snapFullReady));

    // 載入骨架：與新版「區塊標題 + 細線數據表」同形狀，載入完成時版面不跳動
    const SkeletonBlock = () => (
        <div className="min-w-0 space-y-10 animate-pulse" aria-label="載入中">
            {[6, 8].map((n, k) => (
                <div key={k}>
                    <div className="mb-4 border-b border-white/15 pb-2.5"><div className="h-5 w-40 bg-white/[0.08]"></div></div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 border-t border-l border-white/[0.08]">
                        {Array.from({ length: n }).map((_, i) => (
                            <div key={i} className="border-r border-b border-white/[0.08] px-3 pt-2.5 pb-3">
                                <div className="h-2.5 w-14 bg-white/[0.08]"></div>
                                <div className="mt-3 h-6 w-16 bg-white/[0.08]"></div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );


    // Series 列表：primary + compare（雷達軸與繪製由 RadarPanel 處理）
    const primaryColor = viewSide === 'offensive' ? '#12A150' : '#ef4444';
    const primaryLabel = isHistoryMode
        ? (SEASON_OPTIONS.find(o => o.key === selectedSeasonKey)?.label || '主賽季')
        : `當季${stTypeLabel}`;
    // 同季其他球員疊加（僅球員模式 + 當季；資料已在當前快照，無需額外抓取）
    const currentPlayerDoc = playerSeq[playerIdx];
    const playerCompareSeries = (viewMode === 'PLAYER' && !isHistoryMode ? comparePlayers : [])
        .filter(name => name !== selectedPlayer && currentPlayerDoc?.stats?.[name])
        .map((name, i) => ({
            key: 'p_' + name, label: name,
            stats: currentPlayerDoc.stats[name],
            tracking: currentPlayerDoc.tracking?.[name] || {},
            color: COMPARE_COLORS[(compareKeys.length + i) % COMPARE_COLORS.length],
        }));

    // 比較球員時主序列標籤改用球員名，避免與其他球員並列時「當季」不清楚
    const resolvedPrimaryLabel = (viewMode === 'PLAYER' && playerCompareSeries.length > 0) ? selectedPlayer : primaryLabel;
    const radarSeries = [
        // shortLabel：比較表欄頭用。RadarPanel 的預設截斷（slice(0,6)）會吃掉 @XXX 球隊標示
        {
            key: '__primary__', label: resolvedPrimaryLabel + selTag,
            shortLabel: (isHistoryMode ? (SEASON_OPTIONS.find(o => o.key === selectedSeasonKey)?.short || '') : '') + selTag || undefined,
            stats: currentStats, tracking: currentTracking, color: primaryColor,
        },
        ...compareKeys.map((k, idx) => {
            const e = getCompareEntry(k);
            if (!e) return null;
            return { key: e.key, label: e.label, shortLabel: e.shortLabel, stats: e.stats, tracking: e.tracking, color: COMPARE_COLORS[idx % COMPARE_COLORS.length] };
        }).filter(Boolean),
        ...playerCompareSeries,
    ];


    // History Modal Component (nested for closure access to App state)

    // 投籃分頁參數：賽季/賽別 + 日期→勝負/對戰 對照（勝敗/主客篩選用）
    const _shootOpt = SEASON_OPTIONS.find(o => o.key === selectedSeasonKey);
    const shootSeason = isHistoryMode ? (_shootOpt && _shootOpt.season) : window.CURRENT_SEASON;
    const shootType = isHistoryMode ? (_shootOpt && _shootOpt.type) : seasonTypeView;
    const gameMeta = {};
    (seasonGames || []).forEach(g => { if (g.date) gameMeta[g.date] = { wl: g.wl, matchup: g.matchup }; });

    // 跨季比較的可選賽季（皆讀 wolves_*_history 終點快照）。
    // 單一來源：與賽季下拉共用 constants.js 的 HISTORY_SEASON_OPTIONS，勿再建第二份清單
    const comparisonSeasons = window.HISTORY_SEASON_OPTIONS || [];

    // 疊加比較 chips（搬到雷達圖下方）
    const compareChipsUI = (
        <div className="w-full space-y-5">
            <div>
                <div className="flex items-center justify-between mb-1">
                    <label className="text-[12px] font-medium text-slate-300">疊加比較 · 賽季</label>
                    <span className="text-[10px] text-slate-500">{compareKeys.length}/{MAX_COMPARE}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {SEASON_OPTIONS.filter(o => !o.isCurrent && o.key !== selectedSeasonKey).map((o) => {
                        const active = compareKeys.includes(o.key);
                        const chipColor = active ? COMPARE_COLORS[compareKeys.indexOf(o.key) % COMPARE_COLORS.length] : null;
                        const disabled = !active && compareKeys.length >= MAX_COMPARE;
                        return (
                            <button key={o.key} onClick={() => toggleCompareKey(o.key)} disabled={disabled}
                                style={active ? { borderColor: chipColor, color: chipColor } : {}}
                                className={`rounded-full border px-3 py-1 text-xs transition-colors ${active ? 'bg-white/[0.04] font-medium' : disabled ? 'border-white/10 text-slate-600 cursor-not-allowed' : 'border-white/15 text-slate-400 hover:border-white/30 hover:text-slate-100'}`}>
                                {o.label}
                            </button>
                        );
                    })}
                </div>
            </div>
            {viewMode === 'PLAYER' && !isHistoryMode && availablePlayers.length > 1 && (
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <label className="text-[12px] font-medium text-slate-300">疊加比較 · 同季隊友</label>
                        <span className="text-[10px] text-slate-500">{comparePlayers.filter(n => n !== selectedPlayer).length}/{MAX_COMPARE}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {availablePlayers.filter(n => n !== selectedPlayer).map(name => {
                            const active = comparePlayers.includes(name);
                            const chipColor = active ? COMPARE_COLORS[(compareKeys.length + comparePlayers.filter(n => n !== selectedPlayer).indexOf(name)) % COMPARE_COLORS.length] : null;
                            const disabled = !active && comparePlayers.filter(n => n !== selectedPlayer).length >= MAX_COMPARE;
                            return (
                                <button key={name} onClick={() => toggleComparePlayer(name)} disabled={disabled}
                                    style={active ? { borderColor: chipColor, color: chipColor } : {}}
                                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${active ? 'bg-white/[0.04] font-medium' : disabled ? 'border-white/10 text-slate-600 cursor-not-allowed' : 'border-white/15 text-slate-400 hover:border-white/30 hover:text-slate-100'}`}>
                                    {name}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );

    // 章節定義（ChapterNav、快捷鍵 1–6、搜尋面板共用）
    const TABS = [
        { key: 'overview', label: '總覽' },
        { key: 'splits', label: 'Splits' },
        { key: 'shooting', label: '投籃' },
        { key: 'defense', label: '防守' },
        { key: 'playtype', label: 'Playtype' },
        { key: 'comparison', label: '跨季' },
    ];

    // 換球員／球隊但仍在 Splits：SplitsTab 沒有重新掛載，走勢還開著 → 網址保留 m、拿掉 hl（那場屬於原本的人）；
    // 離開 Splits：SplitsTab 卸載、走勢關閉 → 清掉。網址帶來的新 focus 已用新 key 建立，這裡不會動到
    useEffect(() => {
        if (!focus) return;
        const k = focusKeyOf(viewMode, selectedPlayer, activeTab);
        if (focus.key === k) return;
        setFocus(activeTab === 'splits' && focus.key.endsWith('|splits') ? { m: focus.m, hl: null, key: k } : null);
    }, [viewMode, selectedPlayer, activeTab]);
    const activeFocus = focus && focus.key === focusKeyOf(viewMode, selectedPlayer, activeTab) ? focus : null;
    // Splits 開關走勢／換指標 → 更新 m（保留原本圈出的那一場）
    const onSplitsFocus = (m) => setFocus(m ? { m, hl: activeFocus ? activeFocus.hl : null, key: focusKeyOf(viewMode, selectedPlayer, activeTab) } : null);

    // 球員檢視才需要薪資資料（身分列薪資膠囊）；讀不到就不顯示膠囊，不影響其他畫面
    useEffect(() => {
        if (viewMode !== 'PLAYER' || !isCloud || capDoc !== undefined || !window.loadCapDoc) return;
        let cancelled = false;
        window.loadCapDoc().then(v => { if (!cancelled) setCapDoc(v); }).catch(e => console.warn('salary for identity bar failed', e));
        return () => { cancelled = true; };
    }, [viewMode, isCloud, capDoc]);

    // 網址狀態同步：狀態一變就 replaceState（不新增瀏覽紀錄，返回鍵不會一格格倒退）
    useEffect(() => {
        if (!window.UrlState) return;
        const h = '#' + (gameDate
            ? window.UrlState.serialize({ gameDate, gamePlayer })
            : capView
            ? window.UrlState.serialize({ capView, capSeason, capTab })
            : window.UrlState.serialize({ viewMode, selectedPlayer, activeTab, selectedSeasonKey, seasonTypeView, selectedDate, viewSide,
                focusMetric: activeFocus ? activeFocus.m : null, highlightDate: activeFocus ? activeFocus.hl : null }));
        if (window.location.hash !== h) window.history.replaceState(null, '', h);
    }, [viewMode, selectedPlayer, activeTab, selectedSeasonKey, seasonTypeView, selectedDate, viewSide, focus, gameDate, gamePlayer, capView, capSeason, capTab]);
    // 進出單場頁／薪資頁一律用「新增瀏覽紀錄」的方式（返回鍵可回上一個畫面）：改 location.hash → hashchange 套用
    const openGame = (date, player) => { window.location.hash = window.UrlState.gameHref(date, player).slice(1); };
    const openCap = () => { window.location.hash = window.UrlState.capHref(capSeason, capTab).slice(1); };
    // 回主畫面（單場頁與薪資頁共用）：主畫面狀態在這兩頁期間保持不動
    const leaveGame = () => {
        if (gameDate) { setGameDate(null); setGamePlayer(''); }
        if (capView) setCapView(false);
    };

    // 同一分頁貼上另一個連結時只有 hash 變（不會重新載入）→ 套用新狀態。replaceState 不會觸發 hashchange
    const seasonKeyRef = useRef(selectedSeasonKey);
    seasonKeyRef.current = selectedSeasonKey;
    useEffect(() => {
        if (!window.UrlState) return;
        const onHash = () => {
            const st = window.UrlState.parse(window.location.hash);
            // 單場頁：只切換單場狀態，主畫面（球員、章節、賽季…）保持原樣，返回時回到原畫面
            if (st.gameDate) { setCapView(false); setGameDate(st.gameDate); setGamePlayer(st.gamePlayer || ''); window.scrollTo(0, 0); return; }
            setGameDate(null); setGamePlayer('');
            // 薪資頁：同單場頁，只切換薪資頁狀態
            if (st.capView) { setCapView(true); setCapSeason(st.capSeason || ''); setCapTab(st.capTab || ''); window.scrollTo(0, 0); return; }
            setCapView(false);
            setFocus(st.focusMetric ? { m: st.focusMetric, hl: st.highlightDate || null, key: focusKeyOf(st.viewMode, st.selectedPlayer, st.activeTab) } : null);
            if (st.viewMode) setViewMode(st.viewMode);
            if (st.selectedPlayer) setSelectedPlayer(st.selectedPlayer);
            setActiveTab(st.activeTab || 'overview');
            if (st.viewSide) setViewSide(st.viewSide);
            if (st.seasonTypeView) setSeasonTypeView(st.seasonTypeView);
            const season = st.selectedSeasonKey || 'current';
            if (season !== seasonKeyRef.current) {
                pendingDateRef.current = st.selectedDate || null;   // 換季的載入 effect 會套用
                setSelectedSeasonKey(season);
            } else {
                setSelectedDate(st.selectedDate || '');
            }
        };
        window.addEventListener('hashchange', onHash);
        return () => window.removeEventListener('hashchange', onHash);
    }, []);

    const leaveGameRef = useRef(leaveGame);
    leaveGameRef.current = leaveGame;
    // 快捷鍵：/ 開搜尋、1–6 切章節（在單場頁按會回到主畫面該章節）。輸入框聚焦、搜尋面板或走勢 Modal 開著時不攔截
    useEffect(() => {
        const keys = TABS.map(t => t.key);
        const onKey = (e) => {
            const el = e.target || {};
            if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName || '') || el.isContentEditable) return;
            if (e.metaKey || e.ctrlKey || e.altKey || paletteOpen || selectedCard) return;
            if (e.key === '/') { e.preventDefault(); setPaletteOpen(true); return; }
            const n = parseInt(e.key, 10);
            if (n >= 1 && n <= keys.length) { leaveGameRef.current(); setActiveTab(keys[n - 1]); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [paletteOpen, selectedCard]);

    // 頭像列用：球員 PlayerID（Synergy → tracking → meta 三層 fallback）與跨隊標示
    const curPlayerDoc = playerSeq[playerIdx];
    const playerIdOf = (name) => {
        const st = curPlayerDoc?.stats?.[name] || [];
        return st[0]?.playerId || curPlayerDoc?.tracking?.[name]?.playerId || curPlayerDoc?.meta?.[name]?.playerId || 0;
    };
    const tagOf = (name) => window.tagOfMeta(curPlayerDoc?.meta?.[name]);
    const pickPlayer = (name) => { setViewMode('PLAYER'); setSelectedPlayer(name); };

    const curOpt = SEASON_OPTIONS.find(o => o.key === selectedSeasonKey);
    // 球員身分列的薪資膠囊：顯示「目前檢視賽季」的 cap hit，用 playerId 對 contracts（不比對名字），點擊開薪資頁
    const salarySeason = isHistoryMode ? curOpt?.season : window.CURRENT_SEASON;
    const salaryRow = (viewMode === 'PLAYER' && capDoc && currentPlayerId)
        ? (capDoc.contracts || []).find(c => c.season === salarySeason && c.playerId === Number(currentPlayerId)) : null;
    const identitySalary = salaryRow ? (() => {
        const C = window.CapCalc;
        const twoWay = salaryRow.type === 'TWO-WAY';
        const team = C.payroll(capDoc, salarySeason).tax;
        return {
            season: salarySeason,
            text: twoWay ? '雙向合約' : C.fmtM(salaryRow.salary),
            title: twoWay ? '雙向合約，不計入球隊薪資｜點擊開啟薪資頁'
                : `${C.fmtFull(salaryRow.salary)}｜佔全隊奢侈稅薪資 ${(salaryRow.salary / team * 100).toFixed(1)}%｜點擊開啟薪資頁`,
            badge: salaryRow.option === 'PO' ? '球員選項' : salaryRow.option === 'TO' ? '球隊選項'
                : salaryRow.option === 'ETO' ? '提前終止選項' : (!twoWay && salaryRow.guarantee !== 'full') ? '非全額保障' : '',
        };
    })() : null;
    const openSalary = () => { window.location.hash = window.UrlState.capHref(salarySeason === window.capSeasonForDate() ? '' : salarySeason).slice(1); };
    const seasonDisplay = isHistoryMode
        ? (curOpt?.label || '')
        : `${window.CURRENT_SEASON} ${stTypeLabel}`;
    const untilDateForAvg = isHistoryMode ? null : (/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate) ? effectiveDate : null);

    // 複製引用的情境（UI.citeLine 讀取）。快照數字引用快照日、逐場重算的平均引用截至日——兩者可能不同
    window.CiteCtx = {
        subject: viewMode === 'TEAM' ? 'Minnesota Timberwolves' : (selectedPlayer || '') + (selTag ? ` ${selTag}` : ''),
        season: seasonDisplay,
        asOfSnap: displayDate,
        asOfAgg: untilDateForAvg || displayDate,
        isHistory: isHistoryMode,
    };

    // 搜尋面板項目（依群組排列，群組名也可被搜尋）
    const paletteBase = [
        { id: 'team', group: '球隊／球員', label: '全隊', hint: 'Timberwolves', run: () => setViewMode('TEAM') },
        ...availablePlayers.map(n => ({ id: 'p_' + n, group: '球隊／球員', label: n, run: () => pickPlayer(n) })),
        ...missingRosterNames.map(n => ({ id: 'm_' + n, group: '本季無數據', label: n, run: () => onMissingPlayer(n) })),
        ...TABS.map((t, i) => ({ id: 't_' + t.key, group: '章節', label: t.label, hint: String(i + 1), run: () => setActiveTab(t.key) })),
        ...SEASON_OPTIONS.map(o => ({ id: 's_' + o.key, group: '賽季', label: o.label, run: () => setSelectedSeasonKey(o.key) })),
        { id: 'side_off', group: '檢視', label: '進攻', run: () => setViewSide('offensive') },
        { id: 'side_def', group: '檢視', label: '防守', run: () => setViewSide('defensive') },
        ...(isHistoryMode ? [] : [
            { id: 'ty_r', group: '檢視', label: '例行賽', run: () => { setSeasonTypeView('regular'); setSelectedDate(''); } },
            { id: 'ty_p', group: '檢視', label: '季後賽', run: () => { setSeasonTypeView('playoffs'); setSelectedDate(''); } },
        ]),
    ];
    const paletteItems = [
        ...paletteBase.map(it => ({ ...it, run: () => { leaveGame(); it.run(); } })),
        ...gamesIndex.slice(-10).reverse().map(g => ({ id: 'g_' + g.date, group: '最近比賽', label: `${g.date} ${g.matchup} ${g.wl}`, run: () => openGame(g.date) })),
        { id: 'cap', group: '薪資', label: '薪資與奢侈稅', hint: 'Cap Sheet', run: openCap },
    ];

    // 雷達 + 疊加比較（原左側欄）→ 移入總覽章節
    const radarSlot = (viewMode === 'PLAYER' && currentStats?.length > 0 && window.RadarPanel) ? (
        <section aria-label="雷達與疊加比較" className="grid gap-6 lg:grid-cols-2 items-start">
            <window.RadarPanel series={radarSeries} viewSide={viewSide} />
            <div>{compareChipsUI}</div>
        </section>
    ) : null;

    return (
        <div className="min-h-screen text-slate-200 font-sans pb-20">
            <window.Masthead
                seasonOptions={SEASON_OPTIONS} selectedSeasonKey={selectedSeasonKey} onSeasonChange={(k) => { leaveGame(); setSelectedSeasonKey(k); }}
                isHistoryMode={isHistoryMode} historyLoading={historyLoading} displayDate={displayDate}
                seasonTypeView={seasonTypeView} onSeasonTypeChange={(t) => { leaveGame(); setSeasonTypeView(t); setSelectedDate(''); }}
                effectiveDate={effectiveDate}
                minDate={(snapFull ? (teamSeq[teamSeq.length - 1] || playerSeq[playerSeq.length - 1] || {}).date : window.SNAPSHOT_SINCE) || undefined}
                maxDate={latestDate || undefined} onDateChange={(d) => { leaveGame(); setSelectedDate(d); }}
                issueSeason={isHistoryMode ? curOpt?.season : window.CURRENT_SEASON}
                issueType={isHistoryMode ? (curOpt?.type === 'playoffs' ? '季後賽' : '例行賽') : stTypeLabel}
                status={!isCloud ? 'offline' : seasonStatus?.kind === 'offseason' ? 'offseason' : 'live'}
                onStatusClick={handleStatusClick} onSearch={() => setPaletteOpen(true)}
                onCopyLink={() => window.UI.doCopy(window.location.href)}
                latestGame={gamesIndex.length ? gamesIndex[gamesIndex.length - 1] : null} inGame={!!gameDate}
                playoffsAvailable={!teamHistory.length || teamHistory.some(d => d.seasonType === '季後賽')}
                onGames={() => gamesIndex.length && openGame(gamesIndex[gamesIndex.length - 1].date)}
                inCap={capView} onCap={openCap} />

            {/* 休賽期 / 陳舊資料提示（細條） */}
            {seasonStatus && (
                <div className={`border-b ${seasonStatus.kind === 'offseason' ? 'border-white/10' : 'border-amber-500/30 bg-amber-500/[0.06]'}`}>
                    <p className={`max-w-7xl mx-auto px-4 md:px-6 py-2 text-[12px] ${seasonStatus.kind === 'offseason' ? 'text-slate-400' : 'text-amber-300'}`}>
                        {seasonStatus.message}
                    </p>
                </div>
            )}

            {gameDate ? (
                <main className="max-w-7xl mx-auto px-4 md:px-6 pt-4">
                    {/* 回主畫面：主畫面狀態（球員、章節、走勢）在單場頁期間保持不動，直接切回即可。
                        不用 history.back()：從外部連結直接打開單場頁時，上一頁會離開本站 */}
                    <button type="button" onClick={leaveGame}
                        className="mb-3 inline-flex min-h-[24px] items-center gap-1 text-[12px] text-slate-400 hover:text-slate-100">← 回主畫面</button>
                    {window.GamePage && isCloud
                        ? <window.GamePage date={gameDate} gamePlayer={gamePlayer} onExpand={setGamePlayer} />
                        : <div className="py-16 text-center text-sm text-slate-500 animate-pulse">連線中…</div>}
                </main>
            ) : capView ? (
                <main className="max-w-7xl mx-auto px-4 md:px-6 pt-4">
                    <button type="button" onClick={leaveGame}
                        className="mb-3 inline-flex min-h-[24px] items-center gap-1 text-[12px] text-slate-400 hover:text-slate-100">← 回主畫面</button>
                    {window.CapPage && isCloud
                        ? <window.CapPage season={capSeason} onSeason={setCapSeason} capTab={capTab} onTab={(k) => { setCapTab(k); window.scrollTo(0, 0); }}
                            playerNameOf={(pid) => availablePlayers.find(n => Number(playerIdOf(n)) === Number(pid)) || null} />
                        : <div className="py-16 text-center text-sm text-slate-500 animate-pulse">連線中…</div>}
                </main>
            ) : (<>
            <window.RosterRail viewMode={viewMode} selectedPlayer={selectedPlayer} players={availablePlayers}
                playerIdOf={playerIdOf} tagOf={tagOf} onTeam={() => setViewMode('TEAM')} onPlayer={pickPlayer}
                missing={missingRosterNames} probing={probing} onProbe={onMissingPlayer} probeMsg={probeMsg}
                probeTarget={probeTarget} onProbeHistory={jumpToPlayerHistory} />

            {!noCurrentSnapshots && (
                <window.IdentityBar viewMode={viewMode} playerName={selectedPlayer} playerId={currentPlayerId} tag={selTag}
                    games={seasonGames} untilDate={untilDateForAvg} base={currentBase} seasonLabel={seasonDisplay}
                    salary={identitySalary} onSalary={openSalary} />
            )}

            <window.ChapterNav tabs={TABS} activeTab={activeTab} onTab={setActiveTab} viewSide={viewSide} onSide={setViewSide} />

            <main className="max-w-7xl mx-auto px-4 md:px-6 pt-6 space-y-6">
                    {/* Right Content */}
                    {noCurrentSnapshots ? (
                        <div className="min-w-0 border border-amber-500/30 bg-amber-500/[0.06] p-6">
                            {snapError ? (<>
                                <p className="text-amber-300 font-bold mb-2">當季快照讀取失敗</p>
                                <p className="text-slate-400 text-sm leading-relaxed">
                                    <code className="text-slate-300">{snapError}</code><br />
                                    常見原因是該 collection 缺少 Firestore 安全規則的 read 白名單。<br />
                                    也可以先從上方賽季選單改看歷史賽季。
                                </p>
                            </>) : curNoDocsThisType ? (<>
                                <p className="text-amber-300 font-bold mb-2">當季（{window.CURRENT_SEASON}）沒有{stTypeLabel}的快照</p>
                                <p className="text-slate-400 text-sm leading-relaxed">
                                    這個賽季有每日快照，但沒有任何一份是{stTypeLabel}。<br />
                                    請用右上角的賽別切換改看{stTypeLabel === '例行賽' ? '季後賽' : '例行賽'}，
                                    或從上方賽季選單改看歷史賽季。
                                </p>
                            </>) : (<>
                                <p className="text-amber-300 font-bold mb-2">當季（{window.CURRENT_SEASON}）尚無快照資料</p>
                                <p className="text-slate-400 text-sm leading-relaxed">
                                    查詢範圍為 {window.SNAPSHOT_SINCE} ~ {window.SNAPSHOT_UNTIL}，此區間內沒有任何每日快照。<br />
                                    當季會在美東 10/20 自動切換到新賽季；新賽季第一場比賽打完後，隔天的每日抓取才會寫入第一份快照。<br />
                                    也可以先從上方賽季選單改看歷史賽季。
                                </p>
                            </>)}
                        </div>
                    ) : showSkeleton ? <SkeletonBlock /> : (
                    <div className="min-w-0 space-y-6">

                        {/* 總覽 */}
                        {activeTab === 'overview' && window.OverviewTab && (
                            <window.OverviewTab
                                viewMode={viewMode} selectedPlayer={selectedPlayer}
                                games={seasonGames} untilDate={isHistoryMode ? null : (/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate) ? effectiveDate : null)}
                                base={currentBase}
                                snapshotClutch={currentClutch} snapshotOnoff={currentOnoff}
                                lineups={currentLineups} gamesIndex={isHistoryMode ? [] : gamesIndex} viewSide={viewSide}
                                radarSlot={radarSlot} stats={currentStats}
                                seasonLabel={primaryLabel} onoffNA={naCrossTeam}
                            />
                        )}

                        {/* Splits（逐場 bundle → 期間篩選 + 卡片牆 + 趨勢折線） */}
                        {activeTab === 'splits' && window.SplitsTab && (
                            <window.SplitsTab
                                games={seasonGames} seasonLabel={primaryLabel}
                                isPlayoffs={isHistoryMode ? currentSeasonType === '季後賽' : seasonTypeView === 'playoffs'}
                                focusMetric={activeFocus ? activeFocus.m : null} highlightDate={activeFocus ? activeFocus.hl : null}
                                onFocusChange={onSplitsFocus}
                                onGameClick={(d) => openGame(d, viewMode === 'PLAYER' ? selectedPlayer : '')}
                            />
                        )}

                        {/* 投籃（逐球 shotchart → 距離/分區/出手方式卡片 + 受助攻 + 篩選熱圖 + 趨勢） */}
                        {activeTab === 'shooting' && window.ShootingTab && (
                            (viewMode === 'PLAYER' && !currentPlayerId)
                                ? <window.UI.Note>請先從頭像列選一位球員</window.UI.Note>
                                : <window.ShootingTab
                                    playerId={viewMode === 'TEAM' ? 0 : currentPlayerId} teamMode={viewMode === 'TEAM'}
                                    season={shootSeason} typeKey={shootType}
                                    playerName={viewMode === 'TEAM' ? '灰狼全隊' : selectedPlayer + selTag}
                                    seasonLabel={primaryLabel} gameMeta={gameMeta}
                                />
                        )}

                        {/* 防守 */}
                        {activeTab === 'defense' && (
                            <div className="space-y-10">
                                {hasDefenseData ? (
                                    <window.UI.Section title="防守數據" en="Defense" accent="red"
                                        sub={`${viewMode === 'PLAYER' ? selectedPlayer + selTag : '全隊'} · 對手命中率、防守效率越低越好 · 箭頭為 vs 前一份快照 · 點群組看走勢`}>
                                        {(viewMode === 'PLAYER' ? defenseDefs : [...defenseDefs.filter(d => d.id !== 'MatchupDefense'), ...oppZonesDefs]).map(def => (
                                            <TrackingCardRow key={def.id} title={def.title} category={def.id} source="defense"
                                                metrics={def.metrics} current={currentDefense} prev={prevDefense} onClick={setSelectedCard}
                                                naReason={def.id === 'MatchupDefense' ? naCrossTeam : null} />
                                        ))}
                                    </window.UI.Section>
                                ) : (
                                    <window.UI.Note>
                                        <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
                                            <span>{defenseMissing ? defenseMissing.msg : '此賽季無防守數據'}</span>
                                            {defenseMissing && defenseMissing.jumpDate && (
                                                <button onClick={() => setSelectedDate(defenseMissing.jumpDate)}
                                                    className="rounded-full border border-[#12A150]/50 px-3 py-1 text-xs text-[#12A150] hover:bg-[#12A150]/10">
                                                    改看 {defenseMissing.jumpDate}
                                                </button>
                                            )}
                                        </span>
                                    </window.UI.Note>
                                )}
                                {viewMode === 'TEAM' && window.DefenseHeatmap && hasDefenseData && (
                                    <window.DefenseHeatmap defense={currentDefense} />
                                )}
                            </div>
                        )}

                        {/* Playtype（Synergy 式表格／卡片，受攻守切換控制） */}
                        {activeTab === 'playtype' && window.PlaytypeSection && (
                            <window.PlaytypeSection title={viewMode === 'PLAYER' ? selectedPlayer + selTag : '全隊'}
                                stats={currentStats} prevStats={prevStats} side={viewSide} onOpen={setSelectedCard} />
                        )}

                        {/* 跨季比較 */}
                        {activeTab === 'comparison' && window.ComparisonTab && (
                            (viewMode === 'PLAYER' && !selectedPlayer)
                                ? <window.UI.Note>請先從頭像列選一位球員</window.UI.Note>
                                : <window.ComparisonTab
                                    viewMode={viewMode} selectedPlayer={selectedPlayer} playerId={currentPlayerId}
                                    seasons={comparisonSeasons} loadSeason={loadHistoryByDocId}
                                />
                        )}
                    </div>
                    )}
            </main>
            </>)}

            {selectedCard && <window.HistoryModal
                cardInfo={selectedCard} onClose={() => setSelectedCard(null)}
                viewMode={viewMode} viewSide={viewSide} selectedPlayer={selectedPlayer} playerTag={selTag}
                isHistoryMode={isHistoryMode} seasonTypeView={seasonTypeView}
                history={viewMode === 'TEAM' ? teamHistory : playerHistory} />}

            {window.CommandPalette && <window.CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} items={paletteItems} />}
        </div>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
