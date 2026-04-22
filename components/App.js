// 主應用元件
const { useState, useEffect, useMemo } = React;
const { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } = window.Recharts || {};

const App = () => {
    const Icons = window.Icons;
    const PlayTypesList = window.PlayTypesList;
    const STARTER_SORT_WEIGHT = window.STARTER_SORT_WEIGHT;
    const trackingDefs = window.trackingDefs;
    const { PlayTypeCard, TrackingCardRow, SimpleLineChart, MultiLineChart } = window;

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
    const [viewIndex, setViewIndex] = useState(0);
    const [selectedCard, setSelectedCard] = useState(null);
    const [isCloud, setIsCloud] = useState(window.isCloudEnabled);
    const [selectedSeasonKey, setSelectedSeasonKey] = useState(() => loadPref('selectedSeasonKey', 'current'));
    const [historyLoading, setHistoryLoading] = useState(false);
    const [compareKeys, setCompareKeys] = useState(() => loadPref('compareKeys', [])); // 疊加的歷史賽季 keys
    const [compareCache, setCompareCache] = useState({}); // { docId: { team, player (normalized) } }

    // 同步偏好回 localStorage
    useEffect(() => savePref('viewMode', viewMode), [viewMode]);
    useEffect(() => savePref('viewSide', viewSide), [viewSide]);
    useEffect(() => savePref('selectedPlayer', selectedPlayer), [selectedPlayer]);
    useEffect(() => savePref('selectedSeasonKey', selectedSeasonKey), [selectedSeasonKey]);
    useEffect(() => savePref('compareKeys', compareKeys), [compareKeys]);

    const isHistoryMode = selectedSeasonKey !== 'current';
    const SEASON_OPTIONS = window.SEASON_OPTIONS || [];
    const COMPARE_COLORS = ['#60a5fa', '#f59e0b', '#ec4899']; // 比較色盤（primary 不用這些）
    const MAX_COMPARE = 2;

    // 將歷史 player doc（PlayerID-keyed）轉成與 daily 同構（playerName-keyed）
    const normalizeHistoryPlayer = (doc) => {
        if (!doc) return doc;
        const stats = {};
        const tracking = {};
        Object.entries(doc.stats || {}).forEach(([pid, p]) => {
            const name = p.playerName;
            if (!name) return;
            const pidNum = parseInt(pid, 10);
            stats[name] = (p.stats || []).map(s => ({ ...s, playerId: pidNum }));
            tracking[name] = { ...(p.tracking || {}), playerId: pidNum, isCurrentRoster: p.isCurrentRoster };
        });
        return { ...doc, stats, tracking };
    };

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
        setViewIndex(0);

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
        const cacheKey = `wt_history_${docId}`;

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

    // 通用歷史 doc 載入（localStorage → Firestore），結果存入 compareCache
    const loadHistoryDoc = async (k) => {
        const opt = SEASON_OPTIONS.find(o => o.key === k);
        if (!opt || !opt.season) return null;
        const docId = `${opt.season}_${opt.type}`;
        if (compareCache[docId]) return compareCache[docId];
        const cacheKey = `wt_history_${docId}`;
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
    let displayDate = "尚無數據"; let currentPlayerId = null;
    let currentSeason = null; let currentSeasonType = null;

    if (viewMode === 'TEAM') {
        const current = teamHistory[viewIndex]; const prev = teamHistory[viewIndex + 1];
        if (current) {
            currentStats = current.stats || []; currentTracking = current.tracking || {}; displayDate = current.date;
            currentSeason = current.season; currentSeasonType = current.seasonType;
        }
        if (prev) { prevStats = prev.stats || []; prevTracking = prev.tracking || {}; }
    } else {
        const current = playerHistory[viewIndex]; const prev = playerHistory[viewIndex + 1];
        if (current) { currentSeason = current.season; currentSeasonType = current.seasonType; }
        if (current && current.stats?.[selectedPlayer]) {
            currentStats = current.stats[selectedPlayer]; currentTracking = current.tracking?.[selectedPlayer] || {}; displayDate = current.date;
            if (currentStats.length > 0 && currentStats[0].playerId) currentPlayerId = currentStats[0].playerId;
            else if (currentTracking.playerId) currentPlayerId = currentTracking.playerId;
        }
        if (prev) {
            prevStats = prev.stats?.[selectedPlayer] || [];
            prevTracking = prev.tracking?.[selectedPlayer] || {};
        }
    }

    // 2-C 資料陳舊與休賽期判斷（歷史模式略過）
    const seasonStatus = useMemo(() => {
        if (isHistoryMode) return null;
        const phase = window.getSeasonPhase ? window.getSeasonPhase() : { inSeason: true, label: '' };
        if (!phase.inSeason) {
            return { kind: 'offseason', message: '目前為休賽期，下次數據更新預計 10/20' };
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
        const currentData = playerHistory[viewIndex];
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
    }, [playerHistory, viewIndex]);

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
            <div className="border border-slate-800 rounded-xl p-6 bg-slate-900 border-l-4 border-l-[#78BE20]">
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

    const maxIndex = (viewMode === 'TEAM' ? teamHistory.length : playerHistory.length) - 1;
    const goPrev = () => { if (viewIndex < maxIndex) setViewIndex(viewIndex + 1); };
    const goNext = () => { if (viewIndex > 0) setViewIndex(viewIndex - 1); };

    // Radar Chart：依 stats / tracking 計算單一賽季的雷達值
    const radarValuesFor = (stats, tracking, side) => {
        if (side === 'offensive') {
            const iso = stats.find(s => s.playType === 'Isolation' && s.side === 'offensive');
            const tr = stats.find(s => s.playType === 'Transition' && s.side === 'offensive');
            const pr = stats.find(s => s.playType === 'PRBallHandler' && s.side === 'offensive');
            return {
                '單打 (Isolation)': iso ? iso.percentile : 0,
                '切入得分 (Drive)': tracking.DRIVE_PTS_PCT || 0,
                '接球跳投 (C&S)': tracking.CATCH_SHOOT_EFG_PCT || 0,
                '轉換快攻 (Transition)': tr ? tr.percentile : 0,
                '擋拆持球 (P&R Hand)': pr ? pr.percentile : 0,
            };
        }
        const iso = stats.find(s => s.playType === 'Isolation' && s.side === 'defensive');
        const sp = stats.find(s => s.playType === 'Spotup' && s.side === 'defensive');
        const pr = stats.find(s => s.playType === 'PRBallHandler' && s.side === 'defensive');
        return {
            '單打防禦 (Iso Def)': iso ? iso.percentile : 0,
            '定點防線 (Spotup Def)': sp ? sp.percentile : 0,
            '擋拆防守 (P&R Def)': pr ? pr.percentile : 0,
            '干擾籃板 (Contest Reb)': tracking.REB_CONTEST_PCT || 0,
        };
    };

    const radarAxes = viewSide === 'offensive'
        ? ['單打 (Isolation)', '切入得分 (Drive)', '接球跳投 (C&S)', '轉換快攻 (Transition)', '擋拆持球 (P&R Hand)']
        : ['單打防禦 (Iso Def)', '定點防線 (Spotup Def)', '擋拆防守 (P&R Def)', '干擾籃板 (Contest Reb)'];

    // Series 列表：primary + compare
    const primaryColor = viewSide === 'offensive' ? '#78BE20' : '#ef4444';
    const primaryLabel = isHistoryMode
        ? (SEASON_OPTIONS.find(o => o.key === selectedSeasonKey)?.label || '主賽季')
        : '當季';
    const radarSeries = [
        { key: '__primary__', label: primaryLabel, stats: currentStats, tracking: currentTracking, color: primaryColor },
        ...compareKeys.map((k, idx) => {
            const e = getCompareEntry(k);
            if (!e) return null;
            return { key: e.key, label: e.label, stats: e.stats, tracking: e.tracking, color: COMPARE_COLORS[idx % COMPARE_COLORS.length] };
        }).filter(Boolean),
    ];

    const radarData = radarAxes.map(subject => {
        const row = { subject, fullMark: 100 };
        radarSeries.forEach(s => {
            const vals = radarValuesFor(s.stats || [], s.tracking || {}, viewSide);
            row[s.label] = vals[subject] || 0;
        });
        return row;
    });

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
        const [tab, setTab] = useState('current'); // 'current' | 'cross'
        const [crossMetrics, setCrossMetrics] = useState([]); // array

        const targetHistory = viewMode === 'TEAM' ? teamHistory : playerHistory;

        // 進入 cross 分頁時補載所有歷史 doc
        useEffect(() => {
            if (tab !== 'cross') return;
            SEASON_OPTIONS.filter(o => !o.isCurrent).forEach(o => loadHistoryDoc(o.key));
        }, [tab]);

        const baseStats = useMemo(() => {
            return targetHistory.map(entry => {
                let stat, trackingDat;
                if (viewMode === 'TEAM') {
                    if (cardInfo.type === 'playtype') stat = entry.stats?.find(s => s.playType === cardInfo.id && s.side === viewSide);
                    else trackingDat = entry.tracking || {};
                } else {
                    if (cardInfo.type === 'playtype') stat = entry.stats?.[selectedPlayer]?.find(s => s.playType === cardInfo.id && s.side === viewSide);
                    else trackingDat = entry.tracking?.[selectedPlayer] || {};
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
        const toggleCrossChart = (metric) => setCrossMetrics(prev => prev.includes(metric) ? prev.filter(m => m !== metric) : [...prev, metric]);

        let title = "", cols = [];
        if (cardInfo.type === 'playtype') {
            title = `${cardInfo.id} (${viewSide === 'offensive' ? '進攻' : '防守'})`;
            cols = [{ k: 'ppp', l: 'PPP' }, { k: 'fgPct', l: 'FG%' }, { k: 'percentile', l: 'Percentile' }, { k: 'poss', l: 'Poss' }];
        } else {
            const def = trackingDefs.find(t => t.id === cardInfo.id);
            title = def?.title || cardInfo.id;
            cols = def ? def.metrics.map(m => ({ k: m.key, l: m.label })) : [];
        }

        // ---- 跨賽季比較資料：所有歷史終點 + 主賽季最新 ----
        const extractRow = (entry) => {
            // entry: { teamData, playerData } 或 daily snapshot
            let stat = null, tracking = {};
            if (viewMode === 'TEAM') {
                if (cardInfo.type === 'playtype') stat = entry.stats?.find(s => s.playType === cardInfo.id && s.side === viewSide);
                else tracking = entry.tracking || {};
            } else {
                if (cardInfo.type === 'playtype') stat = entry.stats?.[selectedPlayer]?.find(s => s.playType === cardInfo.id && s.side === viewSide);
                else tracking = entry.tracking?.[selectedPlayer] || {};
            }
            return { stat, tracking };
        };

        const crossRows = useMemo(() => {
            if (tab !== 'cross') return [];
            const rows = [];
            // 歷史賽季按時間順序：22-23 reg → 22-23 PO → 23-24 reg → ... → 24-25 PO
            const ordered = SEASON_OPTIONS.filter(o => !o.isCurrent).slice().reverse();
            ordered.forEach(o => {
                const docId = `${o.season}_${o.type}`;
                const data = compareCache[docId];
                if (!data) return;
                const src = viewMode === 'TEAM' ? data.team : data.player;
                if (!src) return;
                const r = extractRow(src);
                if (cardInfo.type === 'playtype' ? r.stat : Object.keys(r.tracking || {}).length > 0) {
                    rows.push({ key: o.key, label: o.label, shortLabel: o.label.replace(' 例行賽', 'R').replace(' 季後賽', 'P').replace(' 進行中', ''), ...r });
                }
            });
            // 主賽季最新（teamHistory[0] / playerHistory[0]）
            const cur = targetHistory[0];
            if (cur) {
                const r = extractRow(cur);
                if (cardInfo.type === 'playtype' ? r.stat : Object.keys(r.tracking || {}).length > 0) {
                    const curOpt = SEASON_OPTIONS.find(o => o.key === selectedSeasonKey);
                    const baseLabel = curOpt?.label || '主賽季';
                    rows.push({
                        key: 'primary',
                        label: isHistoryMode ? baseLabel : `${baseLabel}（最新）`,
                        shortLabel: isHistoryMode ? baseLabel.replace(' 例行賽', 'R').replace(' 季後賽', 'P') : '當季',
                        isPrimary: true,
                        ...r,
                    });
                }
            }
            return rows;
        }, [tab, compareCache, targetHistory, cardInfo, viewMode, selectedPlayer, viewSide, selectedSeasonKey, isHistoryMode]);

        const crossLoading = tab === 'cross' && crossRows.length < SEASON_OPTIONS.filter(o => !o.isCurrent).length;

        return (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4 fade-in">
                <div className="bg-slate-950 rounded-xl sm:rounded-2xl border border-slate-700 w-full max-w-full sm:max-w-2xl shadow-2xl overflow-hidden max-h-[95vh] sm:max-h-[90vh] flex flex-col">
                    <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900 shrink-0">
                        <h3 className="text-lg font-bold text-white">
                            {viewMode === 'PLAYER' ? selectedPlayer : '球隊'} - {title} 歷史數據
                        </h3>
                        <button onClick={onClose} className="text-slate-400 hover:text-white"><Icons.X /></button>
                    </div>

                    <div className="px-5 pt-3 bg-slate-900 border-b border-slate-800 flex gap-1">
                        {[
                            { k: 'current', l: '當季走勢' },
                            { k: 'cross', l: '跨賽季比較' },
                        ].map(t => (
                            <button
                                key={t.k}
                                onClick={() => setTab(t.k)}
                                className={`px-4 py-2 text-xs font-bold rounded-t border-b-2 transition-colors ${tab === t.k ? 'border-[#78BE20] text-[#78BE20] bg-slate-950' : 'border-transparent text-slate-400 hover:text-white'}`}
                            >
                                {t.l}
                            </button>
                        ))}
                    </div>

                    {tab === 'current' && (<>
                    <div className="p-3 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center gap-3">
                        <div className="flex bg-slate-800 rounded p-1">
                            {[5, 10, 20, 'ALL'].map(count => (
                                <button key={count} onClick={() => { setFilterMode('recent'); setRecentCount(count); setDateStart(''); setDateEnd(''); }} className={`px-3 py-1 text-xs rounded transition-colors ${filterMode === 'recent' && recentCount === count ? 'bg-[#78BE20] text-[#0C2340] font-bold shadow' : 'text-slate-400 hover:text-white'}`}>
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
                                    <button key={opt.k} onClick={() => setSeasonTypeFilter(opt.k)} className={`px-3 py-1 text-xs rounded transition-colors ${seasonTypeFilter === opt.k ? (opt.k === '季後賽' ? 'bg-[#78BE20] text-[#0C2340] font-bold shadow' : 'bg-[#236192] text-white font-bold shadow') : 'text-slate-400 hover:text-white'}`}>
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
                        {chartMetrics.length === 1 && (<div className="mb-4 fade-in"><SimpleLineChart data={chartData} dataKey={chartMetrics[0]} color="#78BE20" /></div>)}
                        {chartMetrics.length >= 2 && (<div className="mb-4 fade-in"><MultiLineChart data={chartData} metrics={cols.filter(c => chartMetrics.includes(c.k)).map(c => ({ key: c.k, label: c.l }))} /></div>)}
                    </div>

                    <div className="p-0 overflow-auto">
                        <table className="w-full text-left text-sm text-slate-400">
                            <thead className="bg-[#1e293b] text-xs font-bold text-slate-400 sticky top-0">
                                <tr>
                                    <th className="px-6 py-3">日期</th>
                                    {cols.map(c => (
                                        <th key={c.k} className={`px-4 py-3 cursor-pointer hover:text-white transition-colors select-none ${chartMetrics.includes(c.k) ? 'text-white border-b-2 border-[#78BE20]' : ''}`} onClick={() => toggleChart(c.k)}>
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
                    </>)}

                    {tab === 'cross' && (<>
                        <div className="p-4 bg-slate-900/50 border-b border-slate-800">
                            <p className="text-xs text-slate-400 flex items-center gap-2 mb-2">
                                <Icons.BarChart className="w-3 h-3" /> 點擊表格標題切換折線圖，可多選疊加（X 軸為賽季順序）
                                {crossLoading && <span className="text-slate-500 ml-2">· 載入中...</span>}
                            </p>
                            {crossRows.length >= 2 && crossMetrics.length === 1 && (
                                <div className="mb-2 fade-in">
                                    <SimpleLineChart
                                        data={crossRows.map(r => ({ stat: r.stat, tracking: r.tracking, date: r.shortLabel }))}
                                        dataKey={crossMetrics[0]}
                                        color="#78BE20"
                                        xLabels={crossRows.map(r => r.shortLabel)}
                                    />
                                </div>
                            )}
                            {crossRows.length >= 2 && crossMetrics.length >= 2 && (
                                <div className="mb-2 fade-in">
                                    <MultiLineChart
                                        data={crossRows.map(r => ({ stat: r.stat, tracking: r.tracking }))}
                                        metrics={cols.filter(c => crossMetrics.includes(c.k)).map(c => ({ key: c.k, label: c.l }))}
                                        xLabels={crossRows.map(r => r.shortLabel)}
                                    />
                                </div>
                            )}
                            {crossRows.length < 2 && !crossLoading && (
                                <p className="text-slate-500 text-xs">當前球員/球隊在歷史賽季無對應數據可比較</p>
                            )}
                        </div>
                        <div className="p-0 overflow-auto">
                            <table className="w-full text-left text-sm text-slate-400">
                                <thead className="bg-[#1e293b] text-xs font-bold text-slate-400 sticky top-0">
                                    <tr>
                                        <th className="px-6 py-3">賽季</th>
                                        {cols.map(c => (
                                            <th key={c.k}
                                                className={`px-4 py-3 cursor-pointer hover:text-white transition-colors select-none ${crossMetrics.includes(c.k) ? 'text-white border-b-2 border-[#78BE20]' : ''}`}
                                                onClick={() => toggleCrossChart(c.k)}>
                                                {c.l}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {crossRows.map(r => (
                                        <tr key={r.key} className={`hover:bg-slate-800/70 transition-colors ${r.isPrimary ? 'bg-[#78BE20]/5' : ''}`}>
                                            <td className={`px-6 py-4 ${r.isPrimary ? 'text-[#78BE20] font-bold' : 'text-slate-300'}`}>{r.label}</td>
                                            {cols.map(c => {
                                                const val = cardInfo.type === 'playtype' ? r.stat?.[c.k] : r.tracking?.[c.k];
                                                return <td key={c.k} className="px-4 py-4 font-mono">{val ?? '-'}</td>
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>)}
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 font-sans pb-20">
            {/* Header */}
            <header className="sticky top-0 z-20 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 p-4 shadow-md">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-[#0C2340] border-2 border-[#78BE20] flex items-center justify-center overflow-hidden shadow-lg"><img src="https://i.imgur.com/HSY3cX7.png" alt="Timberwolves Logo" className="w-full h-full object-cover" /></div>
                        <div><h1 className="text-xl font-bold text-white tracking-tight">Wolves PlayType & Tracking</h1><p className="text-xs text-[#78BE20] font-medium tracking-wide cursor-pointer hover:underline" onClick={handleStatusClick}>DAILY TRACKER {isCloud ? <span className="text-blue-400 ml-2 animate-pulse">• Cloud Live</span> : <span className="text-red-500 ml-2">• No Conn</span>}</p></div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {(currentSeason || currentSeasonType) && (
                            <div className={`px-3 py-1.5 rounded-md text-xs font-bold border ${currentSeasonType === '季後賽' ? 'bg-[#78BE20]/15 border-[#78BE20]/40 text-[#78BE20]' : 'bg-[#236192]/20 border-[#236192]/50 text-blue-300'}`}>
                                {currentSeason || ''} {currentSeasonType || ''}
                            </div>
                        )}
                        {isHistoryMode ? (
                            <div className="px-4 py-2 bg-slate-950 rounded-lg border border-slate-800 font-mono font-bold text-[#78BE20]">
                                {historyLoading ? '載入中...' : displayDate}
                            </div>
                        ) : (
                            <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
                                <button onClick={goPrev} disabled={viewIndex >= maxIndex} className="p-2 rounded hover:bg-slate-800 text-slate-400 disabled:opacity-30"><Icons.ChevronLeft className="w-5 h-5" /></button>
                                <div className="px-4 font-mono font-bold text-[#78BE20]">{displayDate}</div>
                                <button onClick={goNext} disabled={viewIndex === 0} className="p-2 rounded hover:bg-slate-800 text-slate-400 disabled:opacity-30"><Icons.ChevronRight className="w-5 h-5" /></button>
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
                                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded px-3 py-2 focus:outline-none focus:border-[#78BE20]"
                                >
                                    {SEASON_OPTIONS.map(opt => (
                                        <option key={opt.key} value={opt.key}>{opt.label}</option>
                                    ))}
                                </select>
                                {isHistoryMode && (
                                    <p className="text-[10px] text-slate-500 mt-1">歷史終點快照（單日）</p>
                                )}
                            </div>
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-xs text-slate-400 font-bold tracking-wide">疊加比較</label>
                                    <span className="text-[10px] text-slate-500">{compareKeys.length}/{MAX_COMPARE}</span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    {SEASON_OPTIONS.filter(o => !o.isCurrent && o.key !== selectedSeasonKey).map((o, idx) => {
                                        const active = compareKeys.includes(o.key);
                                        const colorIdx = compareKeys.indexOf(o.key);
                                        const chipColor = active ? COMPARE_COLORS[colorIdx % COMPARE_COLORS.length] : null;
                                        const disabled = !active && compareKeys.length >= MAX_COMPARE;
                                        return (
                                            <button
                                                key={o.key}
                                                onClick={() => toggleCompareKey(o.key)}
                                                disabled={disabled}
                                                style={active ? { borderColor: chipColor, color: chipColor } : {}}
                                                className={`px-2 py-1 text-[10px] rounded border transition-colors ${active ? 'bg-slate-950 font-bold' : disabled ? 'border-slate-800 text-slate-600 cursor-not-allowed' : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'}`}
                                            >
                                                {o.label}
                                            </button>
                                        );
                                    })}
                                </div>
                                {compareKeys.length > 0 && (
                                    <p className="text-[10px] text-slate-500 mt-1">僅雷達圖會疊加（球員模式）</p>
                                )}
                            </div>
                            <div className="flex gap-2 bg-slate-950 p-1 rounded border border-slate-800">
                                <button onClick={() => { setViewMode('TEAM'); setViewIndex(0); }} className={`flex-1 py-2 text-sm font-bold rounded flex items-center justify-center gap-2 ${viewMode === 'TEAM' ? 'bg-[#236192] text-white shadow' : 'text-slate-400'}`}><Icons.Users className="w-4 h-4" /> 球隊</button>
                                <button onClick={() => { setViewMode('PLAYER'); setViewIndex(0); }} className={`flex-1 py-2 text-sm font-bold rounded flex items-center justify-center gap-2 ${viewMode === 'PLAYER' ? 'bg-[#236192] text-white shadow' : 'text-slate-400'}`}><Icons.User className="w-4 h-4" /> 球員</button>
                            </div>
                            <div className="flex gap-2 bg-slate-950 p-1 rounded border border-slate-800">
                                <button onClick={() => setViewSide('offensive')} className={`flex-1 py-2 text-sm font-bold rounded flex items-center justify-center gap-2 ${viewSide === 'offensive' ? 'bg-[#78BE20] text-[#0C2340] shadow' : 'text-slate-400'}`}><Icons.Sword className="w-4 h-4" /> 進攻</button>
                                <button onClick={() => setViewSide('defensive')} className={`flex-1 py-2 text-sm font-bold rounded flex items-center justify-center gap-2 ${viewSide === 'defensive' ? 'bg-red-700 text-white shadow' : 'text-slate-400'}`}><Icons.Shield className="w-4 h-4" /> 防守</button>
                            </div>
                            {viewMode === 'PLAYER' && (
                                <div className="max-h-[300px] overflow-y-auto pr-2 rounded mt-2 border border-slate-800/50 p-2">
                                    {availablePlayers.length === 0 && <p className="text-slate-500 text-xs p-2">當日無球員數據</p>}
                                    {availablePlayers.map(player => {
                                        const pStats = (playerHistory[viewIndex]?.stats?.[player]) || [];
                                        const pTrack = (playerHistory[viewIndex]?.tracking?.[player]) || {};
                                        const pId = pStats[0]?.playerId || pTrack.playerId || "0";

                                        return (
                                            <button key={player} onClick={() => { setSelectedPlayer(player); setViewIndex(0); }} className={`w-full text-left px-3 py-2 my-1 rounded text-sm transition-colors flex items-center gap-2 ${selectedPlayer === player ? 'bg-[#78BE20]/20 border border-[#78BE20]/50 text-[#78BE20] font-bold' : 'text-slate-400 hover:bg-slate-800'}`}>
                                                <img src={`https://cdn.nba.com/headshots/nba/latest/260x190/${pId}.png`} onError={(e) => { e.target.style.display = 'none'; }} className="h-6 w-6 rounded-full bg-slate-800 object-cover" alt="" />
                                                {player}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Radar Chart */}
                        {(viewMode === 'PLAYER' && currentStats?.length > 0) && (
                            <div className="bg-slate-900/50 p-2 rounded-xl border border-slate-800 flex flex-col items-center">
                                <h3 className="text-slate-300 text-sm font-bold mt-2 mb-1">{viewSide === 'offensive' ? '進攻雷達網 (Percentile)' : '防守雷達網 (Percentile)'}</h3>
                                {RadarChart && ResponsiveContainer ? (
                                    <div className="w-full h-[240px] sm:h-[280px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <RadarChart cx="50%" cy="50%" outerRadius="55%" data={radarData} margin={{ top: 18, right: 24, bottom: 18, left: 24 }}>
                                                <PolarGrid stroke="#1e293b" />
                                                <PolarAngleAxis
                                                    dataKey="subject"
                                                    tick={(props) => {
                                                        const { payload, x, y, cx, cy } = props;
                                                        const parts = String(payload.value).split(' (');
                                                        const zh = parts[0];
                                                        const en = parts[1] ? '(' + parts[1] : '';
                                                        const anchor = x > cx + 4 ? 'start' : x < cx - 4 ? 'end' : 'middle';
                                                        return (
                                                            <text x={x} y={y} textAnchor={anchor} fill="#cbd5e0" fontSize={10}>
                                                                <tspan x={x} dy={0}>{zh}</tspan>
                                                                {en && <tspan x={x} dy={11} fill="#64748b" fontSize={9}>{en}</tspan>}
                                                            </text>
                                                        );
                                                    }}
                                                />
                                                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                                {radarSeries.map((s, i) => (
                                                    <Radar
                                                        key={s.key}
                                                        name={s.label}
                                                        dataKey={s.label}
                                                        stroke={s.color}
                                                        fill={s.color}
                                                        fillOpacity={i === 0 ? 0.35 : 0.18}
                                                        strokeWidth={i === 0 ? 2 : 1.5}
                                                    />
                                                ))}
                                                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} itemStyle={{ color: 'white', fontWeight: 'bold' }} />
                                            </RadarChart>
                                        </ResponsiveContainer>
                                    </div>
                                ) : (
                                    <div className="w-full h-[280px] flex items-center justify-center text-slate-500 text-xs border border-slate-800 border-dashed rounded mt-2">雷達圖模組載入中或失敗...</div>
                                )}
                                {radarSeries.length > 1 && (
                                    <div className="flex flex-wrap gap-x-3 gap-y-1 px-2 pb-2 mt-1 justify-center">
                                        {radarSeries.map(s => (
                                            <div key={s.key} className="flex items-center gap-1 text-[10px] text-slate-300">
                                                <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: s.color }}></span>
                                                {s.label}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right Content */}
                    {showSkeleton ? <SkeletonBlock /> : (
                    <div className="md:col-span-3 space-y-6">
                        <div className="border border-slate-800 rounded-xl p-6 relative overflow-hidden bg-slate-900 border-l-4 border-l-[#78BE20]">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold border-b-2 border-slate-700 pb-2 flex-grow">
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

                        {/* Tracking */}
                        {viewSide === 'offensive' && (
                            <div className="border border-slate-800 rounded-xl p-6 relative overflow-hidden bg-slate-900 border-l-4 border-l-[#236192]">
                                <h2 className="text-xl font-bold border-b-2 border-slate-700 pb-2 mb-6">進階數據 (Tracking)</h2>
                                {trackingDefs.map(def => (
                                    <TrackingCardRow
                                        key={def.id} title={def.title} category={def.id}
                                        metrics={def.metrics} current={currentTracking} prev={prevTracking}
                                        onClick={setSelectedCard}
                                    />
                                ))}
                            </div>
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
