// 主應用元件
const { useState, useEffect, useMemo } = React;
const { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } = window.Recharts || {};

const App = () => {
    const Icons = window.Icons;
    const PlayTypesList = window.PlayTypesList;
    const STARTER_SORT_WEIGHT = window.STARTER_SORT_WEIGHT;
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

    const [teamHistory, setTeamHistory] = useState([]);
    const [playerHistory, setPlayerHistory] = useState([]);
    const [viewMode, setViewMode] = useState(() => loadPref('viewMode', 'TEAM'));
    const [viewSide, setViewSide] = useState(() => loadPref('viewSide', 'offensive'));
    const [selectedPlayer, setSelectedPlayer] = useState(() => loadPref('selectedPlayer', ''));
    // 賽別檢視（當季）：預設休賽/季後賽期→季後賽，例行賽期→例行賽
    const [seasonTypeView, setSeasonTypeView] = useState(() => {
        const phase = window.getSeasonPhase ? window.getSeasonPhase() : { type: 'regular' };
        return phase.type === 'regular' ? 'regular' : 'playoffs';
    });
    const [selectedDate, setSelectedDate] = useState(''); // 日曆選定日期（當季）；空=用最新
    const [selectedCard, setSelectedCard] = useState(null);
    const [isCloud, setIsCloud] = useState(window.isCloudEnabled);
    const [selectedSeasonKey, setSelectedSeasonKey] = useState(() => loadPref('selectedSeasonKey', 'current'));
    const [historyLoading, setHistoryLoading] = useState(false);
    const [compareKeys, setCompareKeys] = useState(() => loadPref('compareKeys', [])); // 疊加的歷史賽季 keys
    const [comparePlayers, setComparePlayers] = useState(() => loadPref('comparePlayers', [])); // 疊加的同季其他球員（雷達）
    const [compareCache, setCompareCache] = useState({}); // { docId: { team, player (normalized) } }
    const [gamesIndex, setGamesIndex] = useState([]); // 單場面板的比賽日期清單
    const [activeTab, setActiveTab] = useState(() => loadPref('activeTab', 'overview')); // 右欄分頁
    const [seasonGames, setSeasonGames] = useState(null); // 當前賽季逐場 bundle（總覽/Splits 共用）；null=載入中
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
        const out = { stats: {} };
        HISTORY_CATS.forEach(c => { out[c] = {}; });
        Object.entries(doc.stats || {}).forEach(([pid, p]) => {
            const name = p.playerName;
            if (!name) return;
            const pidNum = parseInt(pid, 10);
            out.stats[name] = (p.stats || []).map(s => ({ ...s, playerId: pidNum }));
            HISTORY_CATS.forEach(c => {
                out[c][name] = { ...(p[c] || {}), playerId: pidNum, isCurrentRoster: p.isCurrentRoster };
            });
        });
        return { ...doc, ...out };
    };

    // 載入比賽索引（單場面板的日期選單用；一份 doc，localStorage 快取）
    useEffect(() => {
        if (!window.db || !window.firebaseModules) return;
        const indexId = `${window.CURRENT_SEASON}_regular`;
        const cacheKey = `wt_games_index_${indexId}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) { try { setGamesIndex(JSON.parse(cached)); return; } catch (e) { /* fall through */ } }
        (async () => {
            const { doc: docFn, getDoc } = window.firebaseModules;
            try {
                const snap = await getDoc(docFn(window.db, 'wolves_games_index', indexId));
                if (snap.exists()) {
                    const games = snap.data().games || [];
                    localStorage.setItem(cacheKey, JSON.stringify(games));
                    setGamesIndex(games);
                }
            } catch (e) { console.error('games index fetch fail', e); }
        })();
    }, [isCloud]);

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
        if (!window.db || !window.firebaseModules) return;
        const { collection, onSnapshot, doc: docFn, getDoc } = window.firebaseModules;
        setSelectedDate(''); // 切賽季時回到最新日期

        if (selectedSeasonKey === 'current') {
            setHistoryLoading(false);
            const unsubA = onSnapshot(collection(window.db, "wolves_team_stats"), (snapshot) => {
                const data = snapshot.docs.map(d => ({ ...d.data(), date: d.id }));
                data.sort((a, b) => new Date(b.date) - new Date(a.date));
                setTeamHistory(data);
            });
            const unsubB = onSnapshot(collection(window.db, "wolves_player_stats"), (snapshot) => {
                const data = snapshot.docs.map(d => ({ ...d.data(), date: d.id }));
                data.sort((a, b) => new Date(b.date) - new Date(a.date));
                setPlayerHistory(data);
            });
            return () => { unsubA(); unsubB(); };
        }

        // History mode
        const opt = SEASON_OPTIONS.find(o => o.key === selectedSeasonKey);
        if (!opt || !opt.season) return;
        const docId = `${opt.season}_${opt.type}`;
        const cacheKey = `wt_history_v2_${docId}`;

        const apply = (teamData, playerData) => {
            const dateLabel = opt.label;
            setTeamHistory(teamData ? [{ ...teamData, date: dateLabel }] : []);
            setPlayerHistory(playerData ? [normalizeHistoryPlayer({ ...playerData, date: dateLabel })] : []);
        };

        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                apply(parsed.team, parsed.player);
                return;
            } catch (e) { console.warn('History cache parse fail', e); }
        }

        setHistoryLoading(true);
        (async () => {
            try {
                const [teamSnap, playerSnap] = await Promise.all([
                    getDoc(docFn(window.db, 'wolves_team_history', docId)),
                    getDoc(docFn(window.db, 'wolves_player_history', docId)),
                ]);
                const teamData = teamSnap.exists() ? teamSnap.data() : null;
                const playerData = playerSnap.exists() ? playerSnap.data() : null;
                if (teamData || playerData) {
                    localStorage.setItem(cacheKey, JSON.stringify({ team: teamData, player: playerData }));
                }
                apply(teamData, playerData);
            } catch (e) {
                console.error('Fetch history failed', e);
                alert('載入歷史賽季失敗：' + (e.message || e));
            } finally {
                setHistoryLoading(false);
            }
        })();
    }, [selectedSeasonKey, isCloud]);

    // 依 docId 直接載入歷史終點快照（localStorage → Firestore），結果存入 compareCache
    const loadHistoryByDocId = async (docId) => {
        if (!docId) return null;
        if (compareCache[docId]) return compareCache[docId];
        const cacheKey = `wt_history_v2_${docId}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                const v = { team: parsed.team, player: normalizeHistoryPlayer(parsed.player) };
                setCompareCache(prev => ({ ...prev, [docId]: v }));
                return v;
            } catch (e) { /* fall through */ }
        }
        if (!window.db || !window.firebaseModules) return null;
        const { doc: docFn, getDoc } = window.firebaseModules;
        try {
            const [teamSnap, playerSnap] = await Promise.all([
                getDoc(docFn(window.db, 'wolves_team_history', docId)),
                getDoc(docFn(window.db, 'wolves_player_history', docId)),
            ]);
            const team = teamSnap.exists() ? teamSnap.data() : null;
            const player = playerSnap.exists() ? playerSnap.data() : null;
            if (team || player) localStorage.setItem(cacheKey, JSON.stringify({ team, player }));
            const v = { team, player: normalizeHistoryPlayer(player) };
            setCompareCache(prev => ({ ...prev, [docId]: v }));
            return v;
        } catch (e) {
            console.error('history fetch fail', docId, e);
            return null;
        }
    };

    // 通用歷史 doc 載入（雷達疊加用；以 SEASON_OPTIONS 的 key 對應 docId）
    const loadHistoryDoc = async (k) => {
        const opt = SEASON_OPTIONS.find(o => o.key === k);
        if (!opt || !opt.season) return null;
        const docId = `${opt.season}_${opt.type}`;
        if (compareCache[docId]) return compareCache[docId];
        const cacheKey = `wt_history_v2_${docId}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                const v = { team: parsed.team, player: normalizeHistoryPlayer(parsed.player) };
                setCompareCache(prev => ({ ...prev, [docId]: v }));
                return v;
            } catch (e) { /* fall through */ }
        }
        if (!window.db || !window.firebaseModules) return null;
        const { doc: docFn, getDoc } = window.firebaseModules;
        try {
            const [teamSnap, playerSnap] = await Promise.all([
                getDoc(docFn(window.db, 'wolves_team_history', docId)),
                getDoc(docFn(window.db, 'wolves_player_history', docId)),
            ]);
            const team = teamSnap.exists() ? teamSnap.data() : null;
            const player = playerSnap.exists() ? playerSnap.data() : null;
            if (team || player) localStorage.setItem(cacheKey, JSON.stringify({ team, player }));
            const v = { team, player: normalizeHistoryPlayer(player) };
            setCompareCache(prev => ({ ...prev, [docId]: v }));
            return v;
        } catch (e) {
            console.error('history fetch fail', k, e);
            return null;
        }
    };

    // 比較資料載入（雷達 overlay 用）
    useEffect(() => {
        if (compareKeys.length === 0) return;
        compareKeys.forEach(k => loadHistoryDoc(k));
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
        return { key: k, label: opt.label, stats, tracking };
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
        if (current && current.stats?.[selectedPlayer]) {
            currentStats = current.stats[selectedPlayer]; currentTracking = current.tracking?.[selectedPlayer] || {}; displayDate = current.date;
            currentShooting = current.shooting?.[selectedPlayer] || {};
            currentClutch = current.clutch?.[selectedPlayer] || {};
            currentDefense = current.defense?.[selectedPlayer] || {};
            currentOnoff = current.onoff?.[selectedPlayer] || {};
            currentBase = current.base?.[selectedPlayer] || {};
            if (currentStats.length > 0 && currentStats[0].playerId) currentPlayerId = currentStats[0].playerId;
            else if (currentTracking.playerId) currentPlayerId = currentTracking.playerId;
        }
        if (prev) {
            prevStats = prev.stats?.[selectedPlayer] || [];
            prevTracking = prev.tracking?.[selectedPlayer] || {};
            prevShooting = prev.shooting?.[selectedPlayer] || {};
            prevClutch = prev.clutch?.[selectedPlayer] || {};
            prevDefense = prev.defense?.[selectedPlayer] || {};
        }
    }

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

    // 動態取得當前數據中有的球員清單
    const availablePlayers = useMemo(() => {
        const currentData = playerSeq[playerIdx];
        if (!currentData || !currentData.stats) return [];
        const names = Object.keys(currentData.stats);
        return names.sort((a, b) => {
            const weightA = STARTER_SORT_WEIGHT.indexOf(a);
            const weightB = STARTER_SORT_WEIGHT.indexOf(b);
            if (weightA !== -1 && weightB !== -1) return weightA - weightB;
            if (weightA !== -1) return -1;
            if (weightB !== -1) return 1;
            return a.localeCompare(b);
        });
    }, [playerHistory, playerIdx, seasonTypeView, isHistoryMode]);

    // 自動修正 selectedPlayer
    useEffect(() => {
        if (viewMode === 'PLAYER' && availablePlayers.length > 0) {
            if (!selectedPlayer || !availablePlayers.includes(selectedPlayer)) {
                setSelectedPlayer(availablePlayers[0]);
            }
        }
    }, [viewMode, availablePlayers]);

    const showSkeleton = historyLoading || (teamHistory.length === 0 && playerHistory.length === 0 && isCloud);

    const SkeletonBlock = () => (
        <div className="md:col-span-3 space-y-6 animate-pulse">
            <div className="border border-slate-800 rounded-xl p-6 bg-slate-900 border-l-4 border-l-[#12A150]">
                <div className="h-6 w-56 bg-slate-800 rounded mb-6"></div>
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="p-4 rounded-xl border border-slate-800 bg-slate-900/60">
                            <div className="h-3 w-20 bg-slate-800 rounded mb-3"></div>
                            <div className="h-8 w-16 bg-slate-800 rounded mb-4"></div>
                            <div className="h-3 w-full bg-slate-800 rounded"></div>
                        </div>
                    ))}
                </div>
            </div>
            <div className="border border-slate-800 rounded-xl p-6 bg-slate-900 border-l-4 border-l-[#236192]">
                <div className="h-6 w-40 bg-slate-800 rounded mb-6"></div>
                {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="mb-4 bg-[#1a202c] border border-slate-800 rounded-xl overflow-hidden">
                        <div className="bg-slate-900/80 h-8 border-b border-slate-800"></div>
                        <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                            {Array.from({ length: 4 }).map((_, j) => (
                                <div key={j} className="p-3 bg-slate-800/50 rounded border border-slate-700">
                                    <div className="h-3 w-12 bg-slate-700 rounded mb-2"></div>
                                    <div className="h-5 w-14 bg-slate-700 rounded"></div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
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
        { key: '__primary__', label: resolvedPrimaryLabel, stats: currentStats, tracking: currentTracking, color: primaryColor },
        ...compareKeys.map((k, idx) => {
            const e = getCompareEntry(k);
            if (!e) return null;
            return { key: e.key, label: e.label, stats: e.stats, tracking: e.tracking, color: COMPARE_COLORS[idx % COMPARE_COLORS.length] };
        }).filter(Boolean),
        ...playerCompareSeries,
    ];


    // History Modal Component (nested for closure access to App state)
    const HistoryModal = ({ cardInfo, onClose }) => {
        const [chartMetrics, setChartMetrics] = useState([]); // array
        const [filterMode, setFilterMode] = useState('recent');
        const [recentCount, setRecentCount] = useState(10);
        const [dateStart, setDateStart] = useState('');
        const [dateEnd, setDateEnd] = useState('');
        const [seasonTypeFilter, setSeasonTypeFilter] = useState(() => {
            if (isHistoryMode) return 'all';
            const phase = window.getSeasonPhase ? window.getSeasonPhase() : { type: 'regular' };
            return phase.type === 'playoffs' ? '季後賽' : '例行賽';
        }); // 歷史模式 'all'，當季依日期預設

        const targetHistory = viewMode === 'TEAM' ? teamHistory : playerHistory;
        // tracking 類卡片的資料來源欄位（'tracking' | 'shooting' | 'clutch'）
        const srcKey = cardInfo.source || 'tracking';

        const baseStats = useMemo(() => {
            return targetHistory.map(entry => {
                let stat, trackingDat;
                if (viewMode === 'TEAM') {
                    if (cardInfo.type === 'playtype') stat = entry.stats?.find(s => s.playType === cardInfo.id && s.side === viewSide);
                    else trackingDat = entry[srcKey] || {};
                } else {
                    if (cardInfo.type === 'playtype') stat = entry.stats?.[selectedPlayer]?.find(s => s.playType === cardInfo.id && s.side === viewSide);
                    else trackingDat = entry[srcKey]?.[selectedPlayer] || {};
                }
                return { date: entry.date, seasonType: entry.seasonType, stat, tracking: trackingDat };
            }).filter(item => (cardInfo.type === 'playtype' ? item.stat : Object.keys(item.tracking || {}).length > 0));
        }, [targetHistory, viewMode, selectedPlayer, cardInfo, viewSide]);

        const displayedStats = useMemo(() => {
            let filtered = [...baseStats];
            if (seasonTypeFilter !== 'all') {
                filtered = filtered.filter(item => item.seasonType === seasonTypeFilter);
            }
            if (filterMode === 'recent') {
                if (recentCount !== 'ALL') filtered = filtered.slice(0, recentCount);
            } else {
                if (dateStart) filtered = filtered.filter(item => item.date >= dateStart);
                if (dateEnd) filtered = filtered.filter(item => item.date <= dateEnd);
            }
            return filtered;
        }, [baseStats, filterMode, recentCount, dateStart, dateEnd, seasonTypeFilter]);

        const chartData = [...displayedStats].reverse();
        const toggleChart = (metric) => setChartMetrics(prev => prev.includes(metric) ? prev.filter(m => m !== metric) : [...prev, metric]);

        let title = "", cols = [];
        if (cardInfo.type === 'playtype') {
            title = `${cardInfo.id} (${viewSide === 'offensive' ? '進攻' : '防守'})`;
            cols = [{ k: 'ppp', l: 'PPP' }, { k: 'fgPct', l: 'FG%' }, { k: 'percentile', l: 'Percentile' }, { k: 'poss', l: 'Poss' }];
        } else {
            const def = [...trackingDefs, ...shootingDefs, ...clutchDefs, ...defenseDefs, ...oppZonesDefs].find(t => t.id === cardInfo.id);
            title = def?.title || cardInfo.id;
            cols = def ? def.metrics.map(m => ({ k: m.key, l: m.label })) : [];
        }

        return (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4 fade-in">
                <div className="bg-slate-950 rounded-xl sm:rounded-2xl border border-slate-700 w-full max-w-full sm:max-w-2xl shadow-2xl overflow-hidden max-h-[95vh] sm:max-h-[90vh] flex flex-col">
                    <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900 shrink-0">
                        <h3 className="text-lg font-bold text-white">
                            {viewMode === 'PLAYER' ? selectedPlayer : '球隊'} - {title} 當季走勢
                        </h3>
                        <button onClick={onClose} className="text-slate-400 hover:text-white"><Icons.X /></button>
                    </div>

                    <div className="p-3 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center gap-3">
                        <div className="flex bg-slate-800 rounded p-1">
                            {[5, 10, 20, 'ALL'].map(count => (
                                <button key={count} onClick={() => { setFilterMode('recent'); setRecentCount(count); setDateStart(''); setDateEnd(''); }} className={`px-3 py-1 text-xs rounded transition-colors ${filterMode === 'recent' && recentCount === count ? 'bg-[#12A150] text-[#0C2340] font-bold shadow' : 'text-slate-400 hover:text-white'}`}>
                                    {count === 'ALL' ? '全部' : `近${count}場`}
                                </button>
                            ))}
                        </div>
                        {!isHistoryMode && (<>
                            <div className="h-6 w-px bg-slate-700 mx-1"></div>
                            <div className="flex bg-slate-800 rounded p-1">
                                {[
                                    { k: '例行賽', l: '例行賽' },
                                    { k: '季後賽', l: '季後賽' },
                                ].map(opt => (
                                    <button key={opt.k} onClick={() => setSeasonTypeFilter(opt.k)} className={`px-3 py-1 text-xs rounded transition-colors ${seasonTypeFilter === opt.k ? (opt.k === '季後賽' ? 'bg-[#12A150] text-[#0C2340] font-bold shadow' : 'bg-[#236192] text-white font-bold shadow') : 'text-slate-400 hover:text-white'}`}>
                                        {opt.l}
                                    </button>
                                ))}
                            </div>
                        </>)}
                        <div className="h-6 w-px bg-slate-700 mx-1"></div>
                        <div className="flex items-center gap-2 text-xs">
                            <input type="date" value={dateStart} onChange={(e) => { setDateStart(e.target.value); setFilterMode('range'); }} className="bg-slate-800 border border-slate-700 text-slate-300 px-2 py-1 rounded" />
                            <span className="text-slate-500">to</span>
                            <input type="date" value={dateEnd} onChange={(e) => { setDateEnd(e.target.value); setFilterMode('range'); }} className="bg-slate-800 border border-slate-700 text-slate-300 px-2 py-1 rounded" />
                        </div>
                    </div>

                    <div className="p-4 bg-slate-900/50 border-b border-slate-800">
                        <p className="text-xs text-slate-400 flex items-center gap-2 mb-2"><Icons.BarChart className="w-3 h-3" /> 點擊下方表格標題切換折線圖（可多選疊加）</p>
                        {chartMetrics.length === 1 && (<div className="mb-4 fade-in"><SimpleLineChart data={chartData} dataKey={chartMetrics[0]} color="#12A150" /></div>)}
                        {chartMetrics.length >= 2 && (<div className="mb-4 fade-in"><MultiLineChart data={chartData} metrics={cols.filter(c => chartMetrics.includes(c.k)).map(c => ({ key: c.k, label: c.l }))} /></div>)}
                    </div>

                    <div className="p-0 overflow-auto">
                        <table className="w-full text-left text-sm text-slate-400">
                            <thead className="bg-[#1e293b] text-xs font-bold text-slate-400 sticky top-0">
                                <tr>
                                    <th className="px-6 py-3">日期</th>
                                    {cols.map(c => (
                                        <th key={c.k} className={`px-4 py-3 cursor-pointer hover:text-white transition-colors select-none ${chartMetrics.includes(c.k) ? 'text-white border-b-2 border-[#12A150]' : ''}`} onClick={() => toggleChart(c.k)}>
                                            {c.l}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {displayedStats.map((item, idx) => {
                                    return (
                                        <tr key={item.date} className="hover:bg-slate-800/70 transition-colors">
                                            <td className="px-6 py-4 font-mono text-slate-300">{item.date}</td>
                                            {cols.map(c => {
                                                const val = cardInfo.type === 'playtype' ? item.stat?.[c.k] : item.tracking?.[c.k];
                                                return <td key={c.k} className="px-4 py-4 font-mono">{val ?? '-'}</td>
                                            })}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div className="px-5 py-2 text-[10px] text-slate-500 border-t border-slate-800">跨賽季比較請用右上「跨季」分頁</div>
                </div>
            </div>
        );
    };

    // 投籃分頁參數：賽季/賽別 + 日期→勝負/對戰 對照（勝敗/主客篩選用）
    const _shootOpt = SEASON_OPTIONS.find(o => o.key === selectedSeasonKey);
    const shootSeason = isHistoryMode ? (_shootOpt && _shootOpt.season) : window.CURRENT_SEASON;
    const shootType = isHistoryMode ? (_shootOpt && _shootOpt.type) : seasonTypeView;
    const gameMeta = {};
    (seasonGames || []).forEach(g => { if (g.date) gameMeta[g.date] = { wl: g.wl, matchup: g.matchup }; });

    // 跨季比較的可選賽季（皆讀 wolves_*_history 終點快照）
    const comparisonSeasons = [];
    ['2025-26', '2024-25', '2023-24', '2022-23'].forEach(s => {
        ['regular', 'playoffs'].forEach(t => {
            comparisonSeasons.push({
                key: `${s}_${t}`, label: `${s} ${t === 'regular' ? '例行賽' : '季後賽'}`,
                short: `${s.slice(2)}${t === 'regular' ? '例' : '季'}`,
                order: parseInt(s.slice(0, 4), 10) * 10 + (t === 'playoffs' ? 1 : 0),
            });
        });
    });

    // 疊加比較 chips（搬到雷達圖下方）
    const compareChipsUI = (
        <div className="w-full space-y-2 mt-2">
            <div>
                <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] text-slate-400 font-bold">疊加比較（賽季）</label>
                    <span className="text-[10px] text-slate-500">{compareKeys.length}/{MAX_COMPARE}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                    {SEASON_OPTIONS.filter(o => !o.isCurrent && o.key !== selectedSeasonKey).map((o) => {
                        const active = compareKeys.includes(o.key);
                        const chipColor = active ? COMPARE_COLORS[compareKeys.indexOf(o.key) % COMPARE_COLORS.length] : null;
                        const disabled = !active && compareKeys.length >= MAX_COMPARE;
                        return (
                            <button key={o.key} onClick={() => toggleCompareKey(o.key)} disabled={disabled}
                                style={active ? { borderColor: chipColor, color: chipColor } : {}}
                                className={`px-2 py-1 text-[10px] rounded border transition-colors ${active ? 'bg-slate-950 font-bold' : disabled ? 'border-slate-800 text-slate-600 cursor-not-allowed' : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'}`}>
                                {o.label}
                            </button>
                        );
                    })}
                </div>
            </div>
            {viewMode === 'PLAYER' && !isHistoryMode && availablePlayers.length > 1 && (
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] text-slate-400 font-bold">比較球員</label>
                        <span className="text-[10px] text-slate-500">{comparePlayers.filter(n => n !== selectedPlayer).length}/{MAX_COMPARE}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 max-h-[100px] overflow-y-auto">
                        {availablePlayers.filter(n => n !== selectedPlayer).map(name => {
                            const active = comparePlayers.includes(name);
                            const chipColor = active ? COMPARE_COLORS[(compareKeys.length + comparePlayers.filter(n => n !== selectedPlayer).indexOf(name)) % COMPARE_COLORS.length] : null;
                            const disabled = !active && comparePlayers.filter(n => n !== selectedPlayer).length >= MAX_COMPARE;
                            return (
                                <button key={name} onClick={() => toggleComparePlayer(name)} disabled={disabled}
                                    style={active ? { borderColor: chipColor, color: chipColor } : {}}
                                    className={`px-2 py-1 text-[10px] rounded border transition-colors ${active ? 'bg-slate-950 font-bold' : disabled ? 'border-slate-800 text-slate-600 cursor-not-allowed' : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'}`}>
                                    {name}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );

    // 右欄分頁定義
    const TABS = [
        { key: 'overview', label: '總覽' },
        { key: 'splits', label: 'Splits' },
        { key: 'shooting', label: '投籃' },
        { key: 'defense', label: '防守' },
        { key: 'playtype', label: 'Playtype' },
        { key: 'comparison', label: '跨季' },
    ];
    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 font-sans pb-20">
            {/* Header */}
            <header className="sticky top-0 z-20 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 p-4 shadow-md">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-[#0C2340] border-2 border-[#C4CED2] flex items-center justify-center overflow-hidden shadow-lg"><img src="https://i.imgur.com/HSY3cX7.png" alt="Timberwolves Logo" className="w-full h-full object-cover" /></div>
                        <div><h1 className="text-xl font-bold text-white tracking-tight">Wolves PlayType & Tracking</h1><p className="text-xs text-[#12A150] font-medium tracking-wide cursor-pointer hover:underline" onClick={handleStatusClick}>DAILY TRACKER {!isCloud ? <span className="text-red-500 ml-2">• No Conn</span> : seasonStatus?.kind === 'offseason' ? <span className="text-amber-400 ml-2">• 休賽期</span> : <span className="text-blue-400 ml-2 animate-pulse">• Cloud Live</span>}</p></div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {(currentSeason || currentSeasonType) && (
                            <div className={`px-3 py-1.5 rounded-md text-xs font-bold border ${currentSeasonType === '季後賽' ? 'bg-[#12A150]/15 border-[#12A150]/40 text-[#12A150]' : 'bg-[#236192]/20 border-[#236192]/50 text-blue-300'}`}>
                                {currentSeason || ''} {currentSeasonType || ''}
                            </div>
                        )}
                        {isHistoryMode ? (
                            <div className="px-4 py-2 bg-slate-950 rounded-lg border border-slate-800 font-mono font-bold text-[#12A150]">
                                {historyLoading ? '載入中...' : displayDate}
                            </div>
                        ) : (
                            <div className="flex flex-wrap items-center gap-2">
                                {/* 賽別切換 */}
                                <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
                                    {[['regular', '例行賽'], ['playoffs', '季後賽']].map(([t, l]) => (
                                        <button key={t} onClick={() => { setSeasonTypeView(t); setSelectedDate(''); }}
                                            className={`px-3 py-1.5 text-xs font-bold rounded ${seasonTypeView === t ? 'bg-[#12A150] text-[#0C2340]' : 'text-slate-400 hover:text-slate-200'}`}>{l}</button>
                                    ))}
                                </div>
                                {/* 日曆：選到哪天，總覽顯示截至該日平均 */}
                                <input type="date" value={effectiveDate}
                                    min={(teamSeq[teamSeq.length - 1] || playerSeq[playerSeq.length - 1] || {}).date || undefined}
                                    max={latestDate || undefined}
                                    onChange={e => setSelectedDate(e.target.value)}
                                    className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm font-mono font-bold text-[#12A150] focus:outline-none focus:border-[#12A150]" />
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* 2-C 休賽期 / 陳舊資料警告 */}
            {seasonStatus && (
                <div className={`max-w-7xl mx-auto mt-4 px-4 md:px-6`}>
                    <div className={`px-4 py-2 rounded-lg text-sm border ${seasonStatus.kind === 'offseason' ? 'bg-slate-800/50 border-slate-700 text-slate-300' : 'bg-yellow-900/30 border-yellow-700/60 text-yellow-300'}`}>
                        {seasonStatus.kind === 'offseason' ? '🌙 ' : '⚠️ '}{seasonStatus.message}
                    </div>
                </div>
            )}

            {/* Main Layout */}
            <main className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
                <div className="grid md:grid-cols-4 gap-6">
                    {/* Left Sidebar */}
                    <div className="md:col-span-1 space-y-6">
                        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 space-y-4 shadow-lg">
                            <div>
                                <label className="text-xs text-slate-400 font-bold tracking-wide block mb-1">賽季</label>
                                <select
                                    value={selectedSeasonKey}
                                    onChange={(e) => setSelectedSeasonKey(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded px-3 py-2 focus:outline-none focus:border-[#12A150]"
                                >
                                    {SEASON_OPTIONS.map(opt => (
                                        <option key={opt.key} value={opt.key}>{opt.label}</option>
                                    ))}
                                </select>
                                {isHistoryMode && (
                                    <p className="text-[10px] text-slate-500 mt-1">歷史終點快照（單日）</p>
                                )}
                            </div>
                            <div className="flex gap-2 bg-slate-950 p-1 rounded border border-slate-800">
                                <button onClick={() => setViewMode('TEAM')} className={`flex-1 py-2 text-sm font-bold rounded flex items-center justify-center gap-2 ${viewMode === 'TEAM' ? 'bg-[#236192] text-white shadow' : 'text-slate-400'}`}><Icons.Users className="w-4 h-4" /> 球隊</button>
                                <button onClick={() => setViewMode('PLAYER')} className={`flex-1 py-2 text-sm font-bold rounded flex items-center justify-center gap-2 ${viewMode === 'PLAYER' ? 'bg-[#236192] text-white shadow' : 'text-slate-400'}`}><Icons.User className="w-4 h-4" /> 球員</button>
                            </div>
                            <div className="flex gap-2 bg-slate-950 p-1 rounded border border-slate-800">
                                <button onClick={() => setViewSide('offensive')} className={`flex-1 py-2 text-sm font-bold rounded flex items-center justify-center gap-2 ${viewSide === 'offensive' ? 'bg-[#12A150] text-[#0C2340] shadow' : 'text-slate-400'}`}><Icons.Sword className="w-4 h-4" /> 進攻</button>
                                <button onClick={() => setViewSide('defensive')} className={`flex-1 py-2 text-sm font-bold rounded flex items-center justify-center gap-2 ${viewSide === 'defensive' ? 'bg-red-700 text-white shadow' : 'text-slate-400'}`}><Icons.Shield className="w-4 h-4" /> 防守</button>
                            </div>
                            {viewMode === 'PLAYER' && (
                                <div className="max-h-[300px] overflow-y-auto pr-2 rounded mt-2 border border-slate-800/50 p-2">
                                    {availablePlayers.length === 0 && <p className="text-slate-500 text-xs p-2">當日無球員數據</p>}
                                    {availablePlayers.map(player => {
                                        const pStats = (playerSeq[playerIdx]?.stats?.[player]) || [];
                                        const pTrack = (playerSeq[playerIdx]?.tracking?.[player]) || {};
                                        const pId = pStats[0]?.playerId || pTrack.playerId || "0";

                                        return (
                                            <button key={player} onClick={() => setSelectedPlayer(player)} className={`w-full text-left px-3 py-2 my-1 rounded text-sm transition-colors flex items-center gap-2 ${selectedPlayer === player ? 'bg-[#12A150]/20 border border-[#12A150]/50 text-[#12A150] font-bold' : 'text-slate-400 hover:bg-slate-800'}`}>
                                                <img src={`https://cdn.nba.com/headshots/nba/latest/260x190/${pId}.png`} onError={(e) => { e.target.style.display = 'none'; }} className="h-6 w-6 rounded-full bg-slate-800 object-cover" alt="" />
                                                {player}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* 雷達圖（軸自選）+ 疊加比較 chips */}
                        {(viewMode === 'PLAYER' && currentStats?.length > 0 && window.RadarPanel) && (
                            <div>
                                <window.RadarPanel series={radarSeries} viewSide={viewSide} />
                                {compareChipsUI}
                            </div>
                        )}
                    </div>

                    {/* Right Content */}
                    {showSkeleton ? <SkeletonBlock /> : (
                    <div className="md:col-span-3 space-y-6">
                        {/* 分頁切換列 */}
                        <div className="flex flex-wrap gap-1 bg-slate-900/50 p-1 rounded-xl border border-slate-800">
                            {TABS.map(t => (
                                <button key={t.key} onClick={() => setActiveTab(t.key)}
                                    className={`px-3 py-2 text-sm font-bold rounded-lg transition-colors ${activeTab === t.key ? 'bg-[#12A150] text-[#0C2340] shadow' : 'text-slate-400 hover:bg-slate-800'}`}>
                                    {t.label}
                                </button>
                            ))}
                        </div>

                        {/* 總覽 */}
                        {activeTab === 'overview' && window.OverviewTab && (
                            <window.OverviewTab
                                viewMode={viewMode} selectedPlayer={selectedPlayer}
                                games={seasonGames} untilDate={isHistoryMode ? null : (/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate) ? effectiveDate : null)}
                                base={currentBase}
                                snapshotClutch={currentClutch} snapshotOnoff={currentOnoff}
                                lineups={currentLineups} gamesIndex={isHistoryMode ? [] : gamesIndex}
                                seasonLabel={primaryLabel}
                            />
                        )}

                        {/* Splits（逐場 bundle → 期間篩選 + 卡片牆 + 趨勢折線） */}
                        {activeTab === 'splits' && window.SplitsTab && (
                            <window.SplitsTab
                                games={seasonGames} seasonLabel={primaryLabel}
                                isPlayoffs={isHistoryMode ? currentSeasonType === '季後賽' : seasonTypeView === 'playoffs'}
                            />
                        )}

                        {/* 投籃（逐球 shotchart → 距離/分區/出手方式卡片 + 受助攻 + 篩選熱圖 + 趨勢） */}
                        {activeTab === 'shooting' && window.ShootingTab && (
                            (viewMode === 'PLAYER' && !currentPlayerId)
                                ? <div className="px-4 py-6 rounded-lg text-sm border bg-slate-800/50 border-slate-700 text-slate-400 text-center">請先選擇球員</div>
                                : <window.ShootingTab
                                    playerId={viewMode === 'TEAM' ? 0 : currentPlayerId} teamMode={viewMode === 'TEAM'}
                                    season={shootSeason} typeKey={shootType}
                                    playerName={viewMode === 'TEAM' ? '灰狼全隊' : selectedPlayer}
                                    seasonLabel={primaryLabel} gameMeta={gameMeta}
                                />
                        )}

                        {/* 防守 */}
                        {activeTab === 'defense' && (
                            <div className="space-y-6">
                                {Object.keys(currentDefense).length > 0 ? (
                                    <div className="border border-slate-800 rounded-xl p-6 bg-slate-900 border-l-4 border-l-red-500">
                                        <h2 className="text-xl font-bold border-b-2 border-[#C4CED2]/30 pb-2 mb-6">防守數據 (Defense)</h2>
                                        {(viewMode === 'PLAYER' ? defenseDefs : [...defenseDefs.filter(d => d.id !== 'MatchupDefense'), ...oppZonesDefs]).map(def => (
                                            <TrackingCardRow key={def.id} title={def.title} category={def.id} source="defense"
                                                metrics={def.metrics} current={currentDefense} prev={prevDefense} onClick={setSelectedCard} />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="px-4 py-3 rounded-lg text-sm border bg-slate-800/50 border-slate-700 text-slate-400">此賽季無防守數據</div>
                                )}
                                {viewMode === 'TEAM' && window.DefenseHeatmap && Object.keys(currentDefense).length > 0 && (
                                    <window.DefenseHeatmap defense={currentDefense} />
                                )}
                            </div>
                        )}

                        {/* Playtype（Synergy 卡片牆，受攻守切換控制） */}
                        {activeTab === 'playtype' && (
                            <div className="border border-slate-800 rounded-xl p-6 bg-slate-900 border-l-4 border-l-[#12A150]">
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-xl font-bold border-b-2 border-[#C4CED2]/30 pb-2 flex-grow">
                                        {viewMode === 'PLAYER' ? selectedPlayer : '團隊'} - Synergy PlayType ({viewSide === 'offensive' ? '進攻' : '防守'})
                                    </h2>
                                </div>
                                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {PlayTypesList.map(type => {
                                        const stat = currentStats.find(s => s.playType === type && (s.side || 'offensive') === viewSide);
                                        const prevStat = prevStats ? prevStats.find(s => s.playType === type && (s.side || 'offensive') === viewSide) : null;
                                        return <PlayTypeCard key={type} type={type} current={stat} prev={prevStat} onClick={setSelectedCard} side={viewSide} />;
                                    })}
                                </div>
                            </div>
                        )}

                        {/* 跨季比較 */}
                        {activeTab === 'comparison' && window.ComparisonTab && (
                            (viewMode === 'PLAYER' && !selectedPlayer)
                                ? <div className="px-4 py-6 rounded-lg text-sm border bg-slate-800/50 border-slate-700 text-slate-400 text-center">請先選擇球員</div>
                                : <window.ComparisonTab
                                    viewMode={viewMode} selectedPlayer={selectedPlayer}
                                    seasons={comparisonSeasons} loadSeason={loadHistoryByDocId}
                                />
                        )}
                    </div>
                    )}
                </div>
            </main>

            {selectedCard && <HistoryModal cardInfo={selectedCard} onClose={() => setSelectedCard(null)} />}
        </div>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
