// 單場數據面板：選一場比賽，看該場的 Tracking / 投籃 / 防守單場數值
// 資料來源 wolves_player_games/{date} 與 wolves_team_games/{date}（backfill_games.py / 每日順抓）
// 單場只有部分欄位（tracking + 對位防守 + Hustle + 分區投籃），故只渲染「有資料」的卡片群組
const SingleGamePanel = ({ viewMode, playerName, viewSide, gamesIndex }) => {
    const { useState, useEffect } = React;
    const trackingDefs = window.trackingDefs || [];
    const shootingDefs = window.shootingDefs || [];
    const defenseDefs = window.defenseDefs || [];
    const TrackingCardRow = window.TrackingCardRow;

    const dates = (gamesIndex || []).map(g => g.date);
    const [selectedDate, setSelectedDate] = useState(dates.length ? dates[dates.length - 1] : '');
    const [doc, setDoc] = useState(undefined); // undefined=載入中, null=無, obj=資料

    const coll = viewMode === 'TEAM' ? 'wolves_team_games' : 'wolves_player_games';

    useEffect(() => {
        if (!selectedDate || !window.db || !window.firebaseModules) return;
        let cancelled = false;
        setDoc(undefined);
        const cacheKey = `wt_game_${coll}_${selectedDate}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            try { setDoc(JSON.parse(cached)); return; } catch (e) { /* fall through */ }
        }
        (async () => {
            const { doc: docFn, getDoc } = window.firebaseModules;
            try {
                const snap = await getDoc(docFn(window.db, coll, selectedDate));
                const data = snap.exists() ? snap.data() : null;
                if (data) localStorage.setItem(cacheKey, JSON.stringify(data));
                if (!cancelled) setDoc(data);
            } catch (e) {
                console.error('single game fetch fail', coll, selectedDate, e);
                if (!cancelled) setDoc(null);
            }
        })();
        return () => { cancelled = true; };
    }, [selectedDate, coll]);

    if (!dates.length) return null;

    // 取當前實體（球員 / 球隊）的單場數值
    const entity = doc == null ? null
        : viewMode === 'TEAM' ? (doc.stats || {})
        : (doc.players || {})[playerName] || {};
    const meta = gamesIndex.find(g => g.date === selectedDate) || {};

    // 依攻守選 defs，只保留「該實體有資料」的群組
    const groups = (viewSide === 'offensive' ? [...trackingDefs, ...shootingDefs] : defenseDefs)
        .filter(def => entity && def.metrics.some(m => entity[m.key] !== undefined));

    return (
        <div className="border border-slate-800 rounded-xl p-6 relative overflow-hidden bg-slate-900 border-l-4 border-l-[#236192]">
            <div className="flex flex-wrap justify-between items-center border-b-2 border-[#C4CED2]/30 pb-2 mb-4 gap-2">
                <h2 className="text-xl font-bold">單場數據 (Single Game)</h2>
                <div className="flex items-center gap-2">
                    {meta.wl && <span className={`text-xs font-bold px-2 py-0.5 rounded ${meta.wl === 'W' ? 'bg-[#12A150]/20 text-[#12A150]' : 'bg-red-500/20 text-red-400'}`}>{meta.matchup} {meta.wl}</span>}
                    <select value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                        className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded px-2 py-1 focus:outline-none focus:border-[#12A150]">
                        {gamesIndex.slice().reverse().map(g => (
                            <option key={g.date} value={g.date}>{g.date} {g.matchup} {g.wl}</option>
                        ))}
                    </select>
                </div>
            </div>
            {doc === undefined && <div className="h-[80px] flex items-center justify-center text-slate-500 text-sm animate-pulse">載入單場資料中...</div>}
            {doc !== undefined && groups.length === 0 && (
                <div className="h-[80px] flex items-center justify-center text-slate-500 text-sm">
                    {viewMode === 'PLAYER' ? `${playerName} 該場無${viewSide === 'offensive' ? '進攻' : '防守'}單場資料` : '該場無此側單場資料'}
                </div>
            )}
            {groups.map(def => (
                <TrackingCardRow
                    key={def.id} title={def.title} category={def.id}
                    metrics={def.metrics} current={entity} prev={null}
                    clickable={false}
                />
            ))}
            <p className="text-[10px] text-slate-500 mt-1">單場僅含 Tracking／對位防守／Hustle／分區投籃（PlayType 無單場資料）</p>
        </div>
    );
};

window.SingleGamePanel = SingleGamePanel;
