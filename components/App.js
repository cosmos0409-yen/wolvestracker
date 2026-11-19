// 主應用元件：主畫面的狀態、網址同步與畫面組裝。2026-11-19 拆出（技術債 F 批）：
//   純計算 → appLogic.js（window.AppLogic，有測試）；資料載入 → appData.js（useCloudReady／useSeasonSnapshots／
//   useScheduleData／useSeasonGames）；獨立整頁路由與開站首頁 → appRoute.js（useRouteState）
const { useState, useEffect, useMemo, useRef } = React;

const App = () => {
    const { TrackingCardRow } = window;
    const defenseDefs = window.defenseDefs || [];
    const oppZonesDefs = window.oppZonesDefs || [];
    const L = window.AppLogic;

    // 偏好持久化（wt_pref_*：偏好不是快取，不經 window.Cache）
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

    const isCloud = window.useCloudReady();
    // 獨立整頁（單場／薪資／完整賽程／組合／比較／對戰）與開站首頁：狀態與進出都在 appRoute.js
    const route = window.useRouteState({ urlInit, isCloud });
    const { gameDate, gamePlayer, setGamePlayer, gameTab, setGameTab, gameBox, setGameBox, homePending,
        capView, capSeason, setCapSeason, capTab, setCapTab, vs, sched, setSched, lu, cmp, luSeason, luType,
        openGame, openCap, openSchedule, openLineups, openCompare, openVs, setVsRange, setVsType, changeCmp, changeLu } = route;
    const leaveGame = route.leave;

    const [viewMode, setViewMode] = useState(() => pick('viewMode', loadPref('viewMode', 'TEAM')));
    const [viewSide, setViewSide] = useState(() => pick('viewSide', loadPref('viewSide', 'offensive')));
    // 網址帶球員 ID（p=ID-名字）時先留空，等名單載入後由 wantPlayer 對回名字，免得先閃出 localStorage 記住的另一位
    const [selectedPlayer, setSelectedPlayer] = useState(() => pick('selectedPlayer', urlInit.playerId ? '' : loadPref('selectedPlayer', '')));
    // 網址要的球員（pid＝新連結的 ID；name＝舊連結的完整名字）與所屬賽季：
    // 「自動修正 selectedPlayer」effect 等該季名單到了才比對，切季那一拍不會被舊名單誤判成「沒有這個人」
    const wantOf = (st) => (st.playerId || st.selectedPlayer) ? { pid: st.playerId || null, name: st.playerId ? '' : st.selectedPlayer, seasonKey: st.selectedSeasonKey || 'current' } : null;
    const [wantPlayer, setWantPlayer] = useState(() => urlInit.viewMode ? wantOf(urlInit) : null);
    // 賽別檢視（當季）：預設休賽/季後賽期→季後賽，例行賽期→例行賽
    const [seasonTypeView, setSeasonTypeView] = useState(() => {
        const phase = window.getSeasonPhase ? window.getSeasonPhase() : { type: 'regular' };
        return pick('seasonTypeView', phase.type === 'regular' ? 'regular' : 'playoffs');
    });
    const [selectedDate, setSelectedDate] = useState(''); // 時光機選定日期（當季）；空=用最新
    // 網址帶的日期要等快照載入建立後才套用：載入 effect 換季時會清空 selectedDate（回到最新日）
    const pendingDateRef = useRef(urlInit.selectedDate || null);
    const [paletteOpen, setPaletteOpen] = useState(false);
    const [selectedCard, setSelectedCard] = useState(null);
    // 賽季不記憶：開站一律看當季，舊賽季只靠網址 s= 打開（舊版存下的 wt_pref_selectedSeasonKey 由 Cache.purge 清掉）
    const [selectedSeasonKey, setSelectedSeasonKey] = useState(() => pick('selectedSeasonKey', 'current'));
    const [compareKeys, setCompareKeys] = useState(() => loadPref('compareKeys', [])); // 雷達疊加的歷史賽季 keys
    const [comparePlayers, setComparePlayers] = useState(() => loadPref('comparePlayers', [])); // 雷達疊加的同季其他球員
    const [activeTab, setActiveTab] = useState(() => pick('activeTab', loadPref('activeTab', 'overview'))); // 章節
    const [capDoc, setCapDoc] = useState(window.__capDoc);   // 薪資資料（球員身分列顯示該季薪資用；與薪資頁共用同一份）
    // Splits 打開逐場走勢的指標（網址 m=）與圈出的那一場（hl=）。綁定「實體＋章節」：
    // 換球員／球隊或離開 Splits 就自動失效，不會帶著舊的 m/hl 跑到別的畫面
    const focusKeyOf = (vm, p, tab) => `${vm}|${vm === 'PLAYER' ? p : ''}|${tab}`;
    const [focus, setFocus] = useState(() => urlInit.focusMetric
        ? { m: urlInit.focusMetric, hl: urlInit.highlightDate || null, key: focusKeyOf(urlInit.viewMode, urlInit.selectedPlayer, urlInit.activeTab) }
        : null);
    // 全域期間（網址 pd=／c=，格式見 periodFilter.js）：主畫面各章節共用，換章節、換球員不重設；換賽季或賽別回到全季。
    // 不存 localStorage（開站不帶著上次的篩選，同「預設一律看進行中賽季」）
    const [period, setPeriod] = useState(() => window.Period ? window.Period.parse(urlInit.periodStr, urlInit.periodCond) : { kind: 'all', conds: [] });
    const [periodOpen, setPeriodOpen] = useState(false);   // 期間面板（掛在章節列底下）

    // 同步偏好回 localStorage
    useEffect(() => savePref('activeTab', activeTab), [activeTab]);
    useEffect(() => savePref('viewMode', viewMode), [viewMode]);
    useEffect(() => savePref('viewSide', viewSide), [viewSide]);
    useEffect(() => savePref('selectedPlayer', selectedPlayer), [selectedPlayer]);
    useEffect(() => savePref('compareKeys', compareKeys), [compareKeys]);
    useEffect(() => savePref('comparePlayers', comparePlayers), [comparePlayers]);

    const isHistoryMode = selectedSeasonKey !== 'current';
    const SEASON_OPTIONS = window.SEASON_OPTIONS || [];
    const COMPARE_COLORS = ['#60a5fa', '#f59e0b', '#ec4899']; // 比較色盤（primary 不用這些）
    const MAX_COMPARE = 2;
    const curOpt = SEASON_OPTIONS.find(o => o.key === selectedSeasonKey);
    // 目前檢視的賽季與賽別（逐場 bundle、Splits、條件戰績、投籃共用）：當季＝CURRENT_SEASON＋刊頭賽別；歷史＝期末快照那季
    const splitsBundle = !isHistoryMode ? [window.CURRENT_SEASON, seasonTypeView]
        : (curOpt && curOpt.season ? [curOpt.season, curOpt.type] : [null, null]);

    // 主畫面快照（當季每日／歷史期末）與跨季比較、雷達疊加的載入
    const snaps = window.useSeasonSnapshots({ isCloud, selectedSeasonKey, setSelectedDate, pendingDateRef });
    const { teamHistory, playerHistory, historyLoading, curSnapReceived, snapError, snapFull, snapFullReady, compareCache,
        loadHistoryByDocId, loadHistoryDoc, loadComparisonSeason } = snaps;

    // 賽程月曆的賽季：單場頁跟著那場比賽的賽季（直接開舊場次連結也對得上），其餘跟著刊頭所選賽季
    const scheduleSeason = gameDate
        ? window.seasonForDate(new Date(gameDate + 'T17:00:00Z'))
        : (isHistoryMode ? (curOpt || {}).season : window.CURRENT_SEASON);
    const { gamesIndex, scheduleGames, previewDoc, futureGames, calendarGames } = window.useScheduleData({ isCloud, scheduleSeason, seasonTypeView });

    // 雷達疊加的歷史賽季：fire-and-forget，但 loadHistoryDoc 會拋錯 → 必須接住避免 unhandled rejection
    useEffect(() => {
        compareKeys.forEach(k => { loadHistoryDoc(k).catch(e => console.error('compare overlay load fail', k, e)); });
    }, [compareKeys]);

    const getCompareEntry = (k) => {
        const opt = SEASON_OPTIONS.find(o => o.key === k);
        if (!opt || !opt.season) return null;
        const data = compareCache[`${opt.season}_${opt.type}`];
        if (!data) return null;
        const team = viewMode === 'TEAM';
        const stats = team ? (data.team?.stats || []) : (data.player?.stats?.[selectedPlayer] || []);
        const tracking = team ? (data.team?.tracking || {}) : (data.player?.tracking?.[selectedPlayer] || {});
        // 新援在該季的舊東家標示：疊加多季時才看得出「這季他在哪一隊」
        const tag = team ? '' : window.tagOfMeta(data.player?.meta?.[selectedPlayer]);
        return { key: k, label: opt.label + tag, stats, tracking, shortLabel: (opt.short || opt.label) + tag };
    };
    const toggleIn = (setter, v) => setter(prev => prev.includes(v) ? prev.filter(x => x !== v) : prev.length >= MAX_COMPARE ? prev : [...prev, v]);
    const toggleCompareKey = (k) => { if (k !== 'current' && k !== selectedSeasonKey) toggleIn(setCompareKeys, k); };
    const toggleComparePlayer = (name) => { if (name !== selectedPlayer) toggleIn(setComparePlayers, name); };

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

    // 當季依賽別過濾快照序列（歷史模式為單筆終點快照）；時光機日期＝selectedDate 或該賽別最新一天
    const stTypeLabel = seasonTypeView === 'regular' ? '例行賽' : '季後賽';
    const teamSeq = isHistoryMode ? teamHistory : teamHistory.filter(d => d.seasonType === stTypeLabel);
    const playerSeq = isHistoryMode ? playerHistory : playerHistory.filter(d => d.seasonType === stTypeLabel);
    const latestDate = (teamSeq[0] || playerSeq[0] || {}).date || '';
    const effectiveDate = selectedDate || latestDate;
    const teamIdx = L.seqIndex(teamSeq, effectiveDate, isHistoryMode);
    const playerIdx = L.seqIndex(playerSeq, effectiveDate, isHistoryMode);
    // 何時要補讀整季快照（見 useSeasonSnapshots 的 snapFull）：選了日期、開了走勢視窗、或目前賽別在近期快照裡不足兩份
    const needFullSnap = !isHistoryMode && !snapFull && curSnapReceived
        && (!!selectedDate || !!selectedCard || (teamSeq.length < 2 && playerSeq.length < 2));
    useEffect(() => { if (needFullSnap) snaps.setSnapFull(true); }, [needFullSnap]);

    const isTeamView = viewMode === 'TEAM';
    const viewSeq = isTeamView ? teamSeq : playerSeq;
    const viewIdx = isTeamView ? teamIdx : playerIdx;
    const { currentStats, currentTracking, currentClutch, currentDefense, currentLineups, currentOnoff, currentBase,
        prevStats, prevDefense, displayDate, currentPlayerId, selectedMeta, currentSeasonType } =
        L.pickView(viewMode, viewSeq[viewIdx], viewSeq[viewIdx + 1], selectedPlayer);

    // 新援＝該季不在灰狼、現在是灰狼。對位防守與 On-Off 的 NBA API 都必須綁 TeamID，該季他不在灰狼 → 顯示「不適用」而不是 0。
    // Hustle／DefenseBox 走 leaguedash（不綁隊），跨隊有值，不可一併標成不適用
    const naCrossTeam = viewMode === 'PLAYER' && !!selectedMeta?.isNewcomer ? window.NA_REASON.CROSS_TEAM : null;
    // 選定球員的球隊標示（留隊球員回空字串 → 畫面完全不變）
    const selTag = viewMode === 'PLAYER' ? window.tagOfMeta(selectedMeta) : '';
    // normalizeHistoryPlayer 會注入 playerId 等 metadata，「有沒有防守資料」要排除它們
    const hasDefenseData = window.hasRealData(currentDefense);
    const defenseMissing = L.defenseMissing({ hasData: hasDefenseData, isHistory: isHistoryMode, viewMode, seq: viewSeq, idx: viewIdx,
        player: selectedPlayer, typeLabel: stTypeLabel, date: effectiveDate, season: window.CURRENT_SEASON });

    // 逐場 bundle（總覽季平均、Splits、期間篩選）與條件戰績要的全隊／其他球員逐場
    const periodNeeds = window.Period ? window.Period.needs(period, isTeamView) : { team: false, pids: [] };
    const { seasonGames, condTeam, condPlayers } = window.useSeasonGames({
        isCloud, season: splitsBundle[0], type: splitsBundle[1], viewMode, pid: currentPlayerId, needs: periodNeeds });

    // 休賽期／資料陳舊提示（刊頭下的細條）
    const seasonStatus = useMemo(() => L.seasonStatus({
        isHistory: isHistoryMode, phase: window.getSeasonPhase ? window.getSeasonPhase() : { inSeason: true },
        latest: (isTeamView ? teamHistory[0] : playerHistory[0])?.date, season: window.CURRENT_SEASON,
    }), [teamHistory, playerHistory, viewMode, isHistoryMode]);

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

    // 頭像列的球員名單（依輪換強度排序，規則見 AppLogic.rosterOrder）
    const availablePlayers = useMemo(() => L.rosterOrder(playerSeq[playerIdx]), [playerHistory, playerIdx, seasonTypeView, isHistoryMode]);

    // 目前名單屬於哪一季（當季快照的 date 是日期字串、歷史快照是賽季標籤）
    const loadedSeasonKey = () => L.loadedSeasonKey(playerHistory, SEASON_OPTIONS);

    // 自動修正 selectedPlayer
    useEffect(() => {
        if (viewMode === 'PLAYER' && availablePlayers.length > 0) {
            // 網址帶球員：名單換成目標賽季後才比對（切季時會有一拍「季別已是新的、名單還是舊的」）；
            // ID 用 playerIdOf 對、舊連結的名字用 nameKey 對；該季沒有這個人 → 放棄，照下面的規則退回第一人
            if (wantPlayer) {
                if (loadedSeasonKey() !== wantPlayer.seasonKey) return;
                setWantPlayer(null);
                const hit = wantPlayer.pid
                    ? availablePlayers.find(n => Number(playerIdOf(n)) === wantPlayer.pid)
                    : availablePlayers.find(n => window.nameKey(n) === window.nameKey(wantPlayer.name));
                if (hit) { if (selectedPlayer !== hit) setSelectedPlayer(hit); return; }
            }
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
    }, [viewMode, availablePlayers, selectedSeasonKey, wantPlayer]);

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
    const curPlayerDoc = playerSeq[playerIdx];
    const playerCompareSeries = (viewMode === 'PLAYER' && !isHistoryMode ? comparePlayers : [])
        .filter(name => name !== selectedPlayer && curPlayerDoc?.stats?.[name])
        .map((name, i) => ({
            key: 'p_' + name, label: name,
            stats: curPlayerDoc.stats[name],
            tracking: curPlayerDoc.tracking?.[name] || {},
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


    // 投籃章節：賽季／賽別同逐場 bundle；日期→勝負／對戰對照（勝敗／主客篩選用）
    const [shootSeason, shootType] = splitsBundle;
    const gameMeta = {};
    (seasonGames || []).forEach(g => { if (g.date) gameMeta[g.date] = { wl: g.wl, matchup: g.matchup }; });

    // 跨季比較的可選賽季：當季讀每日快照最新一份，其餘讀 wolves_*_history 終點快照。
    // 單一來源：constants.js 的 COMPARISON_SEASON_OPTIONS（由 HISTORY_SEASON_OPTIONS 加當季組成），勿再建第二份清單
    const comparisonSeasons = window.COMPARISON_SEASON_OPTIONS || [];

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
        // sided：該章節內容會隨攻／守切換（章節列只在這些章節顯示攻守切換；新章節用到 viewSide 就加上）
        // period：內容跟著全域期間篩選（其他章節篩選時顯示「整季數據」提示）
        { key: 'overview', label: '總覽', sided: true, period: true },
        { key: 'splits', label: 'Splits', period: true },
        { key: 'shooting', label: '投籃', period: true },
        { key: 'defense', label: '防守', period: true },
        { key: 'playtype', label: 'Playtype', sided: true },
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
        if (!window.UrlState || homePending) return;
        const h = '#' + (route.pageHash()
            // 網址帶來的球員還在等名單比對時，原樣寫回（只寫 ID 或舊名字），不可配上前一位球員的名字
            || window.UrlState.serialize({ viewMode, selectedPlayer: wantPlayer ? wantPlayer.name : selectedPlayer, playerId: wantPlayer ? wantPlayer.pid : currentPlayerId, activeTab, selectedSeasonKey, seasonTypeView, selectedDate, viewSide,
                focusMetric: activeFocus ? activeFocus.m : null, highlightDate: activeFocus ? activeFocus.hl : null,
                periodStr: window.Period ? window.Period.serialize(period) : '', periodCond: window.Period ? window.Period.condStr(period) : '' }));
        if (window.location.hash !== h) window.history.replaceState(null, '', h);
    }, [viewMode, selectedPlayer, activeTab, selectedSeasonKey, seasonTypeView, selectedDate, viewSide, focus, gameDate, gamePlayer, gameTab, gameBox, capView, capSeason, capTab, vs, sched, lu, cmp, homePending, wantPlayer, currentPlayerId, period]);
    // 比較頁的快照（Playtype、在場／不在場）：沿用跨季比較的載入（當季讀最新每日快照、歷史讀期末快照，皆以名字為 key）
    const loadCompareSnap = (season, type) => loadComparisonSeason(season === window.CURRENT_SEASON ? `current_${type}` : `${season}_${type}`);
    // 完整賽程入口只在有當季預覽文件時出現（歷史賽季沒有開賽時間與對手 ID）
    const canSchedule = !!previewDoc;
    // 獨立整頁左上的返回鈕。不用 history.back()：從外部連結直接打開時，上一頁會離開本站
    const backBtn = (label, onClick) => (
        <button type="button" onClick={onClick}
            className="mb-3 inline-flex min-h-[24px] items-center gap-1 text-[12px] text-slate-400 hover:text-slate-100">{label}</button>
    );

    // 同一分頁貼上另一個連結時只有 hash 變（不會重新載入）→ 套用新狀態。replaceState 不會觸發 hashchange
    const seasonKeyRef = useRef(selectedSeasonKey);
    seasonKeyRef.current = selectedSeasonKey;
    const routeRef = useRef(route);
    routeRef.current = route;
    useEffect(() => {
        if (!window.UrlState) return;
        const onHash = () => {
            const st = window.UrlState.parse(window.location.hash);
            // 獨立整頁：只切換該頁狀態，主畫面（球員、章節、賽季…）保持原樣，返回時回到原畫面
            if (routeRef.current.applyPageHash(st)) return;
            setFocus(st.focusMetric ? { m: st.focusMetric, hl: st.highlightDate || null, key: focusKeyOf(st.viewMode, st.selectedPlayer, st.activeTab) } : null);
            if (window.Period) setPeriod(window.Period.parse(st.periodStr, st.periodCond));
            if (st.viewMode) setViewMode(st.viewMode);
            if (st.selectedPlayer) setSelectedPlayer(st.selectedPlayer);
            setWantPlayer(wantOf(st));
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

    // 獨立整頁（單場／薪資／對戰）的數字鍵由該頁自己的分頁列處理（UI.useTabKeys；對戰頁沒有分頁列＝不作用）
    const ownPageRef = useRef(false);
    ownPageRef.current = route.ownPage;
    // 快捷鍵：/ 開搜尋、1–6 切章節（只在主畫面）。輸入框聚焦、搜尋面板或走勢 Modal 開著時不攔截
    useEffect(() => {
        const keys = TABS.map(t => t.key);
        const onKey = (e) => {
            const el = e.target || {};
            if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName || '') || el.isContentEditable) return;
            if (e.metaKey || e.ctrlKey || e.altKey || paletteOpen || selectedCard) return;
            if (e.key === '/') { e.preventDefault(); setPaletteOpen(true); return; }
            const n = parseInt(e.key, 10);
            if (n >= 1 && n <= keys.length && !ownPageRef.current) setActiveTab(keys[n - 1]);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [paletteOpen, selectedCard]);

    // 頭像列用：球員 PlayerID（Synergy → tracking → meta 三層 fallback）與跨隊標示
    const playerIdOf = (name) => {
        const st = curPlayerDoc?.stats?.[name] || [];
        return st[0]?.playerId || curPlayerDoc?.tracking?.[name]?.playerId || curPlayerDoc?.meta?.[name]?.playerId || 0;
    };
    const tagOf = (name) => window.tagOfMeta(curPlayerDoc?.meta?.[name]);
    const pickPlayer = (name) => { setViewMode('PLAYER'); setSelectedPlayer(name); };

    // 刊頭／搜尋面板的「年份＋賽別」→ 既有狀態（selectedSeasonKey＋seasonTypeView），網址 s=/t= 格式不變。
    // 換到歷史年份沿用目前賽別；回到當季改用時節預設（10 月切去「當季季後賽」只會是空畫面）
    const viewYear = isHistoryMode ? (curOpt?.season || '') : 'current';
    const viewType = isHistoryMode ? (curOpt?.type || 'regular') : seasonTypeView;
    // 換賽季或賽別：期間回到全季（月份、對手、條件裡的球員都屬於原本那季）
    const changeYear = (y) => {
        leaveGame(); setPeriod(window.Period.ALL); setPeriodOpen(false);
        if (y !== 'current') { setSelectedSeasonKey(`${y}_${viewType}`); return; }
        const phase = window.getSeasonPhase ? window.getSeasonPhase() : { type: 'regular' };
        setSelectedSeasonKey('current'); setSeasonTypeView(phase.type === 'regular' ? 'regular' : 'playoffs'); setSelectedDate('');
    };
    const changeType = (t) => {
        leaveGame(); setPeriod(window.Period.ALL); setPeriodOpen(false);
        if (isHistoryMode) setSelectedSeasonKey(`${viewYear}_${t}`);
        else { setSeasonTypeView(t); setSelectedDate(''); }
    };
    // 球員身分列的薪資膠囊：顯示「目前檢視賽季」的 cap hit，用 playerId 對 contracts（不比對名字），點擊開薪資頁
    const salarySeason = isHistoryMode ? curOpt?.season : window.CURRENT_SEASON;
    const identitySalary = viewMode === 'PLAYER' ? L.salaryBadge(capDoc, salarySeason, currentPlayerId) : null;
    const openSalary = () => { window.location.hash = window.UrlState.capHref(salarySeason === window.capSeasonForDate() ? '' : salarySeason).slice(1); };
    const seasonDisplay = isHistoryMode
        ? (curOpt?.label || '')
        : `${window.CURRENT_SEASON} ${stTypeLabel}`;
    const untilDateForAvg = isHistoryMode ? null : (/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate) ? effectiveDate : null);
    // 身分列的附加賽膠囊（只有全隊檢視、該季有附加賽才出現；時光機選的日期之後的不算）：點了開最近一場附加賽
    const pin = isTeamView ? L.playinSummary(scheduleGames, untilDateForAvg) : null;
    const playinSummary = pin ? { w: pin.w, l: pin.l, onOpen: () => openGame(pin.lastDate) } : null;
    // 章節列黏頂時左側的季別標籤（「26-27 例行」）：捲到下面也看得到正在看哪一季
    const chapterSeasonTag = `${String((isHistoryMode ? curOpt?.season : window.CURRENT_SEASON) || '').slice(2)} ${viewType === 'playoffs' ? '季後' : '例行'}`;

    // ── 全域期間：各章節共用的 ctx 與膠囊顯示（計算在 window.Period）──
    const periodOn = !!(window.Period && window.Period.isActive(period));
    const periodPlayers = availablePlayers.map(n => ({ name: n, id: playerIdOf(n) })).filter(p => p.id);
    const periodIsPlayoffs = isHistoryMode ? currentSeasonType === '季後賽' : seasonTypeView === 'playoffs';
    const periodCtx = {
        isTeam: viewMode === 'TEAM', teamGames: viewMode === 'TEAM' ? seasonGames : condTeam, playerGames: condPlayers,
        season: splitsBundle[0], isPlayoffs: periodIsPlayoffs,
        // 當季名冊（快照的球員＝抓取時以名冊 PlayerID 過濾）：還在隊上的人「未出賽」算到最新一場；歷史賽季沒有當時名冊，不傳
        rosterIds: isHistoryMode ? null : periodPlayers.map(p => Number(p.id)),
        nameOf: (pid) => ((periodPlayers.find(p => Number(p.id) === Number(pid)) || {}).name) || String(pid),
    };
    const periodRes = periodOn && seasonGames ? window.Period.apply(seasonGames, period, periodCtx) : null;
    const periodRec = periodRes && (periodRes.cond === undefined || (periodRes.cond && periodRes.cond.ready)) ? window.Period.record(periodRes.games) : null;
    const periodLabel = periodRes ? periodRes.label : (periodOn ? '條件' : '全季');
    // 條件資料還沒到齊或沒填完（各章節顯示等待，不可先顯示全季數字）
    const periodWaiting = !!(periodOn && (!periodRes || (periodRes.cond !== undefined && !(periodRes.cond && periodRes.cond.ready))));
    const periodDates = periodOn && periodRes && !periodWaiting ? new Set(periodRes.games.map(g => g.date)) : null;
    // 防守章節：有逐場的群組（GAME_DEFENSE_IDS）改用逐場加總，箭頭＝vs 全季；全季同 Splits（不套「數據截至」）
    const defPeriod = periodDates && seasonGames ? {
        cur: window.GameAgg.aggregate(periodRes.games, null, 'TEAM'), all: window.GameAgg.aggregate(seasonGames, null, 'TEAM'),
    } : null;
    const clearPeriod = () => { setPeriod(window.Period.ALL); setPeriodOpen(false); };
    const periodPill = (withRecord) => window.PeriodPill && (
        <window.PeriodPill label={periodLabel} rec={periodRec} active={periodOn} open={periodOpen} withRecord={withRecord}
            onToggle={() => setPeriodOpen(o => !o)} onClear={clearPeriod} />
    );

    // 複製引用的情境（UI.citeLine 讀取）。快照數字引用快照日、逐場重算的平均引用截至日——兩者可能不同
    window.CiteCtx = {
        subject: viewMode === 'TEAM' ? 'Minnesota Timberwolves' : (selectedPlayer || '') + (selTag ? ` ${selTag}` : ''),
        season: seasonDisplay,
        asOfSnap: displayDate,
        asOfAgg: untilDateForAvg || displayDate,
        isHistory: isHistoryMode,
        // 全域期間（篩選時）：citeLine／Quote.make 對「截至日」類（逐場加總）的數字附上，避免貼出去被當成季平均
        period: periodOn && periodRes && !periodWaiting ? `${periodLabel}（${periodRes.games.length} 場）` : null,
    };
    // 聯盟名次情境（window.leagueRank 讀取）：當季每日快照（時光機選日期時跟著用那天的快照）；歷史賽季沒有名次
    // 球員（2026-11-13 起）：球員文件的 ranks＋該員各類別快照值（「出手未達門檻」的說明要用）
    const rankDoc = isHistoryMode ? null : (viewMode === 'TEAM' ? teamSeq[teamIdx] : playerSeq[playerIdx]);
    window.RankCtx = !(rankDoc && rankDoc.ranks) ? null
        : viewMode === 'TEAM' ? { kind: 'team', ranks: rankDoc.ranks, date: rankDoc.date, latest: teamIdx === 0 }
        : (rankDoc.ranks._meta || {})[selectedPlayer] ? {
            kind: 'player', name: selectedPlayer, ranks: rankDoc.ranks, date: rankDoc.date, latest: playerIdx === 0,
            vals: Object.assign({}, ...['base', 'tracking', 'shooting', 'defense', 'advanced', 'scoring'].map(c => ((rankDoc[c] || {})[selectedPlayer]) || {})),
        } : null;

    // 搜尋面板項目（依群組排列，群組名也可被搜尋）
    const paletteBase = [
        { id: 'team', group: '球隊／球員', label: '全隊', hint: 'Timberwolves', run: () => setViewMode('TEAM') },
        ...availablePlayers.map(n => ({ id: 'p_' + n, group: '球隊／球員', label: n, run: () => pickPlayer(n) })),
        ...missingRosterNames.map(n => ({ id: 'm_' + n, group: '本季無數據', label: n, run: () => onMissingPlayer(n) })),
        ...TABS.map((t, i) => ({ id: 't_' + t.key, group: '章節', label: t.label, hint: String(i + 1), run: () => setActiveTab(t.key) })),
        ...(window.SEASON_YEAR_OPTIONS || []).map(o => ({ id: 's_' + o.value, group: '賽季', label: o.label, run: () => changeYear(o.value) })),
        { id: 'side_off', group: '檢視', label: '進攻端', run: () => setViewSide('offensive') },
        { id: 'side_def', group: '檢視', label: '防守端', run: () => setViewSide('defensive') },
        // 賽別在歷史賽季也能切（改 selectedSeasonKey 的 _regular/_playoffs）
        { id: 'ty_r', group: '檢視', label: '例行賽', run: () => changeType('regular') },
        { id: 'ty_p', group: '檢視', label: '季後賽', run: () => changeType('playoffs') },
    ];
    const paletteItems = [
        ...paletteBase.map(it => ({ ...it, run: () => { leaveGame(); it.run(); } })),
        // 賽程：下一場（預覽模式）；group 叫「賽程」，打「賽程」就找得到
        ...futureGames.slice(0, 1).map(g => ({ id: 'next_' + g.date, group: '賽程', label: `下一場 ${Number(g.date.slice(5, 7))}/${Number(g.date.slice(8))} ${g.matchup.includes('@') ? '@' : 'vs'} ${window.teamName(g.matchup.slice(-3))}`, hint: g.kickoff, run: () => openGame(g.date) })),
        ...scheduleGames.slice(-10).reverse().map(g => ({ id: 'g_' + g.date, group: `${scheduleSeason} 最近比賽`, label: `${g.date} ${g.matchup} ${g.wl}`, run: () => openGame(g.date) })),
        ...(canSchedule ? [{ id: 'schedule', group: '賽程', label: '完整賽程', hint: '對手、主客、開賽時間 · Schedule', run: openSchedule }] : []),
        { id: 'cap', group: '薪資', label: '薪資與奢侈稅', hint: 'Cap Sheet', run: openCap },
        { id: 'vs', group: '對戰', label: '對戰分析', hint: '對各隊表現、勁敵／順手／棘手', run: () => openVs() },
        { id: 'lineups', group: '組合', label: '組合數據', hint: '二人／三人／五人組合 · Lineups', run: () => openLineups() },
        { id: 'compare', group: '比較', label: '球員比較', hint: '兩位球員並排對照 · Compare',
            run: () => openCompare(viewMode === 'PLAYER' && currentPlayerId ? { a: window.UrlState.playerToken(currentPlayerId, selectedPlayer), sa: isHistoryMode ? (curOpt?.season || '') : '', type: viewType } : {}) },
        ...Object.keys(window.NBA_TEAM_NAMES || {}).filter(a => a !== window.TEAM_ABBR)
            .map(a => ({ id: 'vs_' + a, group: '對戰', label: `對戰 ${a} ${window.teamName(a)}`, run: () => openVs(a) })),
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
                yearOptions={window.SEASON_YEAR_OPTIONS || []} viewYear={viewYear} onYearChange={changeYear}
                isHistoryMode={isHistoryMode} historyLoading={historyLoading}
                viewType={viewType} onTypeChange={changeType}
                issueSeason={isHistoryMode ? curOpt?.season : window.CURRENT_SEASON}
                status={!isCloud ? 'offline' : seasonStatus?.kind === 'offseason' ? 'offseason' : 'live'}
                onStatusClick={handleStatusClick} onSearch={() => setPaletteOpen(true)}
                schedule={calendarGames} scheduleSeason={scheduleSeason} onPickGame={(d) => openGame(d)} inGame={!!gameDate || homePending} gameDate={gameDate}
                playoffsAvailable={isHistoryMode || !teamHistory.length || teamHistory.some(d => d.seasonType === '季後賽')}
                inCap={capView} onCap={openCap} inVs={!!vs} onVs={() => openVs()}
                inSched={!!sched} onFullSchedule={canSchedule ? openSchedule : null}
                inLineups={!!lu} onLineups={() => openLineups()} inCompare={!!cmp} />

            {/* 休賽期 / 陳舊資料提示（細條） */}
            {seasonStatus && (
                <div className={`border-b ${seasonStatus.kind === 'offseason' ? 'border-white/10' : 'border-amber-500/30 bg-amber-500/[0.06]'}`}>
                    <p className={`max-w-7xl mx-auto px-4 md:px-6 py-2 text-[12px] ${seasonStatus.kind === 'offseason' ? 'text-slate-400' : 'text-amber-300'}`}>
                        {seasonStatus.message}
                    </p>
                </div>
            )}

            {homePending ? (
                <main className="max-w-7xl mx-auto px-4 md:px-6 pt-4">
                    <div className="py-16 text-center text-sm text-slate-500 animate-pulse">載入最新一場…</div>
                </main>
            ) : gameDate ? (
                /* 單場頁（也是首頁）是獨立整頁：不掛主畫面章節列，頁內有自己的單場分頁（概要／Box Score／對比／投籃） */
                <main className="max-w-7xl mx-auto px-4 md:px-6 pt-4">
                    <div className="flex items-start justify-between gap-3">
                        {backBtn('← 回主畫面', leaveGame)}
                        {canSchedule && window.seasonForDate(new Date(gameDate + 'T17:00:00Z')) === window.CURRENT_SEASON && (
                            <a href={window.UrlState.schedHref()} className="mb-3 inline-flex min-h-[24px] items-center whitespace-nowrap text-[12px] text-slate-300 hover:text-slate-50">完整賽程 →</a>
                        )}
                    </div>
                    {window.GamePage && isCloud
                        ? <window.GamePage date={gameDate} gamePlayer={gamePlayer} onExpand={setGamePlayer}
                            gameTab={gameTab} onGameTab={(k) => { setGameTab(k); if (k !== 'box') { setGamePlayer(''); setGameBox(''); } }}
                            gameBox={gameBox} onGameBox={setGameBox} />
                        : <div className="py-16 text-center text-sm text-slate-500 animate-pulse">連線中…</div>}
                </main>
            ) : capView ? (
                <main className="max-w-7xl mx-auto px-4 md:px-6 pt-4">
                    {backBtn('← 回主畫面', leaveGame)}
                    {window.CapPage && isCloud
                        ? <window.CapPage season={capSeason} onSeason={setCapSeason} capTab={capTab} onTab={(k) => { setCapTab(k); window.scrollTo(0, 0); }}
                            playerNameOf={(pid) => availablePlayers.find(n => Number(playerIdOf(n)) === Number(pid)) || null} />
                        : <div className="py-16 text-center text-sm text-slate-500 animate-pulse">連線中…</div>}
                </main>
            ) : sched ? (
                <main className="max-w-7xl mx-auto px-4 md:px-6 pt-4">
                    {backBtn('← 回主畫面', leaveGame)}
                    {window.SchedulePage && isCloud
                        ? <window.SchedulePage month={sched.month} filter={sched.filter}
                            onMonth={(m) => setSched(s => ({ ...s, month: m }))} onFilter={(f) => setSched(s => ({ ...s, filter: f }))} />
                        : <div className="py-16 text-center text-sm text-slate-500 animate-pulse">連線中…</div>}
                </main>
            ) : cmp ? (
                <main className="max-w-7xl mx-auto px-4 md:px-6 pt-4">
                    {backBtn('← 回主畫面', leaveGame)}
                    {window.ComparePage && isCloud
                        ? <window.ComparePage a={cmp.a} b={cmp.b} sa={cmp.sa} sb={cmp.sb} type={cmp.type} per={cmp.per} pd={cmp.pd} metric={cmp.metric}
                            onChange={changeCmp} loadSnap={loadCompareSnap} />
                        : <div className="py-16 text-center text-sm text-slate-500 animate-pulse">連線中…</div>}
                </main>
            ) : lu ? (
                <main className="max-w-7xl mx-auto px-4 md:px-6 pt-4">
                    {backBtn('← 回主畫面', leaveGame)}
                    {window.LineupsPage && isCloud
                        ? <window.LineupsPage season={luSeason} type={luType} n={lu.n} picks={lu.picks} min={lu.min} view={lu.view} onChange={changeLu} />
                        : <div className="py-16 text-center text-sm text-slate-500 animate-pulse">連線中…</div>}
                </main>
            ) : vs ? (
                <main className="max-w-7xl mx-auto px-4 md:px-6 pt-4">
                    {vs.team ? backBtn('← 對戰首頁', () => openVs()) : backBtn('← 回主畫面', leaveGame)}
                    {!isCloud ? <div className="py-16 text-center text-sm text-slate-500 animate-pulse">連線中…</div>
                        : vs.team ? (window.MatchupPage
                            ? <window.MatchupPage team={vs.team} range={vs.range || 'recent'} type={vs.type || 'all'} metric={vs.metric}
                                onRange={setVsRange} onType={setVsType} onOpenGame={openGame} />
                            : <div className="py-16 text-center text-sm text-slate-500 animate-pulse">載入中…</div>)
                        : window.MatchupHome && <window.MatchupHome range={vs.range || 'recent'} type={vs.type || 'all'}
                            onRange={setVsRange} onType={setVsType} onOpenTeam={openVs}
                            players={periodPlayers} />}
                </main>
            ) : (<>
            <window.RosterRail viewMode={viewMode} selectedPlayer={selectedPlayer} players={availablePlayers}
                playerIdOf={playerIdOf} tagOf={tagOf} onTeam={() => setViewMode('TEAM')} onPlayer={pickPlayer}
                missing={missingRosterNames} probing={probing} onProbe={onMissingPlayer} probeMsg={probeMsg}
                probeTarget={probeTarget} onProbeHistory={jumpToPlayerHistory} />

            {!noCurrentSnapshots && (
                <window.IdentityBar viewMode={viewMode} playerName={selectedPlayer} playerId={currentPlayerId} tag={selTag}
                    games={seasonGames} untilDate={untilDateForAvg} base={currentBase} seasonLabel={seasonDisplay} playin={playinSummary}
                    salary={identitySalary} onSalary={openSalary} periodSlot={periodPill(false)}
                    onCompare={viewMode === 'PLAYER' && currentPlayerId ? () => openCompare({ a: window.UrlState.playerToken(currentPlayerId, selectedPlayer), sa: isHistoryMode ? (curOpt?.season || '') : '', type: viewType }) : null}
                    asOf={isHistoryMode ? null : {
                        value: effectiveDate, max: latestDate || undefined, onChange: setSelectedDate,
                        min: (snapFull ? (teamSeq[teamSeq.length - 1] || playerSeq[playerSeq.length - 1] || {}).date : window.SNAPSHOT_SINCE) || undefined,
                    }} />
            )}

            <window.ChapterNav tabs={TABS} activeTab={activeTab} onTab={setActiveTab} viewSide={viewSide} onSide={setViewSide} seasonTag={chapterSeasonTag}
                periodPill={periodPill(true)} periodOn={periodOn}
                below={<>
                    {periodOpen && window.PeriodPanel && (
                        <window.PeriodPanel st={period} onChange={setPeriod} onClose={() => setPeriodOpen(false)}
                            games={seasonGames || []} isPlayoffs={periodIsPlayoffs} players={periodPlayers}
                            isTeam={viewMode === 'TEAM'} teamGames={periodCtx.teamGames} playerGames={condPlayers} />
                    )}
                    {periodOn && !periodOpen && window.PeriodStrip && (
                        <window.PeriodStrip label={periodLabel} rec={periodRec} onClear={clearPeriod} onOpen={() => setPeriodOpen(true)} />
                    )}
                </>} />

            <main className="max-w-7xl mx-auto px-4 md:px-6 pt-6 space-y-6">
                    {/* Right Content */}
                    {noCurrentSnapshots ? (
                        <div className="min-w-0 border border-amber-500/30 bg-amber-500/[0.06] p-6">
                            {snapError ? (<>
                                <p className="text-amber-300 font-bold mb-2">{isHistoryMode ? '歷史賽季快照讀取失敗' : '當季快照讀取失敗'}</p>
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
                        {/* 篩選中、但這個章節跟不上期間：說清楚是整季數據（篩選保留，回到其他章節繼續生效） */}
                        {periodOn && !noCurrentSnapshots && !(TABS.find(t => t.key === activeTab) || {}).period && (
                            <window.UI.Note>本章節為整季數據，期間篩選（{periodLabel}）不適用；篩選條件保留，回到其他章節繼續生效。</window.UI.Note>
                        )}

                        {/* 總覽 */}
                        {activeTab === 'overview' && window.OverviewTab && (
                            <window.OverviewTab
                                viewMode={viewMode} selectedPlayer={selectedPlayer}
                                games={seasonGames} untilDate={untilDateForAvg}
                                base={currentBase}
                                snapshotClutch={currentClutch} snapshotOnoff={currentOnoff}
                                lineups={currentLineups} lineupsHref={window.UrlState.lineupsHref({ n: 5, season: isHistoryMode ? (curOpt?.season || '') : '', type: viewType })}
                                gamesIndex={isHistoryMode ? [] : gamesIndex} viewSide={viewSide}
                                radarSlot={radarSlot} stats={currentStats} playerId={currentPlayerId}
                                seasonLabel={primaryLabel} onoffNA={naCrossTeam} period={period} periodCtx={periodCtx}
                                advanced={viewMode === 'TEAM' ? (teamSeq[teamIdx] || {}).advanced : null}
                                playerAdvanced={viewMode === 'PLAYER' ? (((playerSeq[playerIdx] || {}).advanced || {})[selectedPlayer] || null) : null}
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
                                rankable={!!window.RankCtx && window.RankCtx.latest}
                                season={splitsBundle[0]} seasonType={splitsBundle[1]} isTeam={viewMode === 'TEAM'}
                                period={period} periodCtx={periodCtx}
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
                                    scoring={viewMode === 'TEAM' ? ((teamSeq[teamIdx] || {}).scoring || null) : (((playerSeq[playerIdx] || {}).scoring || {})[selectedPlayer] || null)}
                                    seasonLabel={primaryLabel} gameMeta={gameMeta}
                                    periodDates={periodDates} periodLabel={periodLabel} periodWaiting={periodWaiting}
                                />
                        )}

                        {/* 防守 */}
                        {activeTab === 'defense' && (
                            <div className="space-y-10">
                                {periodWaiting ? (
                                    <div className="py-10 text-center text-sm text-slate-500 animate-pulse">等待期間條件（讀取逐場資料或條件還沒填完）…</div>
                                ) : hasDefenseData ? (
                                    <window.UI.Section title="防守數據" en="Defense" accent="red"
                                        sub={defPeriod
                                            ? `${viewMode === 'PLAYER' ? selectedPlayer + selTag : '全隊'} · ${periodLabel}（${defPeriod.cur.GP} 場）· 有逐場資料的群組跟著期間，箭頭＝vs 全季；其他為整季快照（停用）`
                                            : `${viewMode === 'PLAYER' ? selectedPlayer + selTag : '全隊'} · 對手命中率、防守效率越低越好；vs 平常負數＝守得好 · 箭頭為 vs 前一份快照 · 點群組看走勢`}>
                                        {/* 球隊：防守 Box → 最近防守者（全隊版 2026-11 起有）→ 護框 → 對手分區 → 拼勁 → 掩護與卡位（重要性順序；球員沿用 defenseDefs 順序） */}
                                        {(viewMode === 'PLAYER' ? defenseDefs : [...defenseDefs.filter(d => d.id === 'DefenseBox'), ...defenseDefs.filter(d => d.id === 'MatchupDefense' || d.id === 'RimProtection'), ...oppZonesDefs, ...defenseDefs.filter(d => !['MatchupDefense', 'RimProtection', 'DefenseBox'].includes(d.id))]
                                            .map(d => ({ ...d, metrics: d.metrics.filter(m => !m.playerOnly) }))).map(def => {
                                            // 期間篩選：逐場有這組數字 → 用期間加總；沒有（防守 Box、對手分區、全隊最近防守者）→ 整季快照、停用
                                            const live = defPeriod && (window.GAME_DEFENSE_IDS || []).includes(def.id)
                                                && def.metrics.some(m => typeof defPeriod.all[m.key] === 'number');
                                            return live ? (
                                                <TrackingCardRow key={def.id} title={def.title} category={def.id} source="defense" clickable={false}
                                                    metrics={def.metrics} current={defPeriod.cur} prev={defPeriod.all} cols={def.cols} gp={defPeriod.cur.GP}
                                                    citeAsOf="none" citeNote={`${periodLabel}（${defPeriod.cur.GP} 場）`} compareTags={['全季', periodLabel]} />
                                            ) : (
                                                <window.UI.Locked key={def.id} on={periodOn}>
                                                    <TrackingCardRow title={def.title} category={def.id} source="defense"
                                                        metrics={def.metrics} current={currentDefense} prev={prevDefense} onClick={setSelectedCard}
                                                        cols={def.cols} gp={currentDefense.D_GP || currentBase.GP}
                                                        naReason={def.id === 'MatchupDefense' || def.id === 'RimProtection' ? naCrossTeam : null}
                                                        rankCats="defense" />
                                                </window.UI.Locked>
                                            );
                                        })}
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
                                {viewMode === 'TEAM' && window.DefenseHeatmap && hasDefenseData && !periodWaiting && (
                                    <window.UI.Locked on={periodOn}><window.DefenseHeatmap defense={currentDefense} /></window.UI.Locked>
                                )}
                            </div>
                        )}

                        {/* Playtype（Synergy 式表格／卡片，受攻守切換控制） */}
                        {activeTab === 'playtype' && window.PlaytypeSection && (
                            <window.PlaytypeSection title={viewMode === 'PLAYER' ? selectedPlayer + selTag : '全隊'}
                                stats={currentStats} prevStats={prevStats} side={viewSide} onOpen={setSelectedCard}
                                teamRank={viewMode === 'TEAM'} />
                        )}

                        {/* 跨季比較 */}
                        {activeTab === 'comparison' && window.ComparisonTab && (
                            (viewMode === 'PLAYER' && !selectedPlayer)
                                ? <window.UI.Note>請先從頭像列選一位球員</window.UI.Note>
                                : <window.ComparisonTab
                                    viewMode={viewMode} selectedPlayer={selectedPlayer} playerId={currentPlayerId}
                                    seasons={comparisonSeasons} loadSeason={loadComparisonSeason} seasonType={viewType}
                                    viewSide={viewSide} setViewSide={setViewSide}
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
            {window.QuoteBasket && <window.QuoteBasket />}
        </div>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
