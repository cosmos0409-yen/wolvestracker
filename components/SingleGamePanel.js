// 單場數據面板：選一場比賽，看該場的 Tracking / 投籃 / 防守單場數值
// 資料來源 wolves_player_games/{date} 與 wolves_team_games/{date}（backfill_games.py / 每日順抓）
// 單場只有部分欄位（tracking + 最近防守者 + Hustle + 分區投籃），故只渲染「有資料」的卡片群組
// 刪掉 v1 快取（wt_game_wolves_…，2026-10-19 前的鍵）：內容可能含清理前的非當時隊員，且不刪會永久佔著儲存空間
try {
    Object.keys(localStorage).filter(k => k.startsWith('wt_game_wolves_')).forEach(k => localStorage.removeItem(k));
} catch (e) { /* 私密模式等無法存取 localStorage */ }

const SingleGamePanel = ({ viewMode, playerName, viewSide, gamesIndex }) => {
    const { useState, useEffect } = React;
    const trackingDefs = window.trackingDefs || [];
    const shootingDefs = window.shootingDefs || [];
    const defenseDefs = window.defenseDefs || [];
    const TrackingCardRow = window.TrackingCardRow;

    const dates = (gamesIndex || []).map(g => g.date);
    const [selectedDate, setSelectedDate] = useState(dates.length ? dates[dates.length - 1] : '');
    const [doc, setDoc] = useState(undefined); // undefined=載入中, null=無, obj=資料

    // 賽別切換後索引換一份：原選的日期不在新清單裡 → 跳到新清單最後一場
    const lastDate = dates.length ? dates[dates.length - 1] : '';
    useEffect(() => {
        if (!dates.includes(selectedDate)) setSelectedDate(lastDate);
    }, [lastDate, dates.length]);

    const coll = viewMode === 'TEAM' ? 'wolves_team_games' : 'wolves_player_games';

    useEffect(() => {
        if (!selectedDate || !window.db || !window.firebaseModules) return;
        let cancelled = false;
        setDoc(undefined);
        const cacheKey = `wt_game_v2_${coll}_${selectedDate}`;   // v2：2026-10-19 清理 2025-26 非當時隊員後換版，讓舊快取失效
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
        <window.UI.Section title="單場數據" en="Single Game" accent="blue"
            sub="單場僅含 Tracking／最近防守者／Hustle／分區投籃（PlayType 無單場資料）"
            right={<>
                {meta.wl && <span className={`px-2 py-0.5 font-mono text-[11px] ${meta.wl === 'W' ? 'bg-[#12A150]/[0.08] text-[#12A150]' : 'bg-[#EF4444]/[0.08] text-[#EF4444]'}`}>{meta.matchup} {meta.wl}</span>}
                <label className="sr-only" htmlFor="single-game-date">選擇比賽</label>
                <select id="single-game-date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                    className="rounded-full border border-white/15 bg-[#0A1626] px-3 py-1 text-xs text-slate-200 focus:outline-none focus:border-[#12A150]">
                    {gamesIndex.slice().reverse().map(g => (
                        <option key={g.date} value={g.date}>{g.date} {g.matchup} {g.wl}</option>
                    ))}
                </select>
                {selectedDate && window.UrlState && (
                    <a href={window.UrlState.gameHref(selectedDate, viewMode === 'PLAYER' ? playerName : '')}
                        className="inline-flex min-h-[24px] items-center rounded-full border border-[#12A150]/50 px-3 py-1 text-xs text-[#12A150] hover:bg-[#12A150]/10">
                        看完整比賽 →
                    </a>
                )}
            </>}>
            {doc === undefined && <div className="py-6 text-center text-sm text-slate-500 animate-pulse">載入單場資料中…</div>}
            {doc !== undefined && groups.length === 0 && (
                <div className="py-6 text-center text-sm text-slate-500">
                    {viewMode === 'PLAYER' ? `${playerName} 該場無${viewSide === 'offensive' ? '進攻' : '防守'}單場資料` : '該場無此側單場資料'}
                </div>
            )}
            {groups.map(def => (
                <TrackingCardRow
                    key={def.id} title={def.title} category={def.id}
                    metrics={def.metrics} current={entity} prev={null}
                    clickable={false}
                    citeAsOf="none" citeNote={`單場 ${selectedDate}${meta.matchup ? ` ${meta.matchup}` : ''}${meta.wl ? ` ${meta.wl}` : ''}`}
                />
            ))}
        </window.UI.Section>
    );
};

window.SingleGamePanel = SingleGamePanel;
