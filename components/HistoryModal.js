// 卡片走勢 Modal。從 App.js 抽出來的原因不只是檔案太大：
// 原本它定義在 App 元件「內部」，每次 App re-render 都會產生一個新的元件型別，
// React 會把整棵子樹卸載重掛，使用者選的指標與日期區間因此被丟掉。
//
// 相依一律走 props / window，不在檔案頂層宣告任何東西——bundle 是單一 script scope，
// 與 App.js 頂層的 `const { useState, useEffect, useMemo } = React` 重複宣告會讓整包 SyntaxError。
const HistoryModal = ({ cardInfo, onClose, viewMode, viewSide, selectedPlayer, isHistoryMode, history, playerTag = '', seasonTypeView }) => {
    const { useState, useMemo, useEffect } = React;
    const Icons = window.Icons;
    const { SimpleLineChart, MultiLineChart } = window;
    const trackingDefs = window.trackingDefs || [];
    const shootingDefs = window.shootingDefs || [];
    const clutchDefs = window.clutchDefs || [];
    const defenseDefs = window.defenseDefs || [];
    const oppZonesDefs = window.oppZonesDefs || [];
    const [chartMetrics, setChartMetrics] = useState([]); // array
    const [filterMode, setFilterMode] = useState('recent');
    const [recentCount, setRecentCount] = useState(10);
    const [dateStart, setDateStart] = useState('');
    const [dateEnd, setDateEnd] = useState('');
    // 歷史模式 'all'；當季沿用刊頭選的賽別（舊版用今天日期判斷，休賽期會誤設成例行賽）
    const [seasonTypeFilter, setSeasonTypeFilter] = useState(() => {
        if (isHistoryMode) return 'all';
        if (seasonTypeView) return seasonTypeView === 'playoffs' ? '季後賽' : '例行賽';
        const phase = window.getSeasonPhase ? window.getSeasonPhase() : { type: 'regular' };
        return phase.type === 'playoffs' ? '季後賽' : '例行賽';
    });
    // Esc 關閉
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const targetHistory = history || [];
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
        title = `${window.ptName(cardInfo.id)}（${viewSide === 'offensive' ? '進攻' : '防守'}） (${cardInfo.id} · Synergy Playtype)`;
        cols = [{ k: 'ppp', l: 'PPP', e: 'PPP' }, { k: 'fgPct', l: '命中率', e: 'FG%' }, { k: 'percentile', l: '聯盟百分位', e: 'Percentile' }, { k: 'poss', l: '每場球權', e: 'Poss/G' }];
    } else {
        const def = [...trackingDefs, ...shootingDefs, ...clutchDefs, ...defenseDefs, ...oppZonesDefs].find(t => t.id === cardInfo.id);
        title = def?.title || cardInfo.id;
        cols = def ? def.metrics.map(m => ({ k: m.key, l: m.label, e: m.englishLabel })) : [];
    }

    const UI = window.UI;
    const [zh, en] = UI.splitTitle(title);
    const subject = viewMode === 'PLAYER' ? selectedPlayer + playerTag : '全隊';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 sm:p-4" onMouseDown={onClose}>
            <div role="dialog" aria-modal="true" aria-labelledby="history-modal-title" onMouseDown={e => e.stopPropagation()}
                className="flex max-h-[95vh] w-full max-w-full flex-col overflow-hidden border border-white/15 bg-[#0C1A2E] shadow-2xl sm:max-h-[90vh] sm:max-w-3xl">
                <div className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
                    <div className="min-w-0">
                        <p className="font-mono text-[11px] text-slate-500">{subject} · 當季走勢</p>
                        <h3 id="history-modal-title" className="mt-0.5 flex items-baseline gap-2 text-[18px] font-bold text-slate-50">
                            {zh}{en && <span className="font-mono text-[11px] font-normal text-slate-500">{en}</span>}
                        </h3>
                    </div>
                    <button type="button" onClick={onClose} aria-label="關閉" className="shrink-0 text-slate-400 hover:text-white"><Icons.X /></button>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-white/10 px-5 py-3">
                    <UI.Seg ariaLabel="近幾場" size="sm" value={filterMode === 'recent' ? String(recentCount) : ''}
                        onChange={(v) => { setFilterMode('recent'); setRecentCount(v === 'ALL' ? 'ALL' : Number(v)); setDateStart(''); setDateEnd(''); }}
                        options={[5, 10, 20, 'ALL'].map(c => ({ value: String(c), label: c === 'ALL' ? '全部' : `近 ${c} 筆` }))} />
                    {!isHistoryMode && (
                        <UI.Seg ariaLabel="賽別" size="sm" value={seasonTypeFilter} onChange={setSeasonTypeFilter}
                            options={[{ value: '例行賽', label: '例行賽' }, { value: '季後賽', label: '季後賽' }]} />
                    )}
                    <span className="flex items-center gap-2 text-xs text-slate-500">
                        <input type="date" aria-label="起始日" value={dateStart} onChange={(e) => { setDateStart(e.target.value); setFilterMode('range'); }} className={UI.selectClass(!!dateStart)} />
                        ~
                        <input type="date" aria-label="結束日" value={dateEnd} onChange={(e) => { setDateEnd(e.target.value); setFilterMode('range'); }} className={UI.selectClass(!!dateEnd)} />
                    </span>
                </div>

                <div className="shrink-0 border-b border-white/10 px-5 py-3">
                    <p className="mb-2 text-[12px] text-slate-400">點下方表格欄位標題切換折線圖（可多選疊加）· 每筆為一份快照（截至該日的累計數據）</p>
                    {chartMetrics.length === 1 && (<SimpleLineChart data={chartData} dataKey={chartMetrics[0]} color="#12A150" />)}
                    {chartMetrics.length >= 2 && (<MultiLineChart data={chartData} metrics={cols.filter(c => chartMetrics.includes(c.k)).map(c => ({ key: c.k, label: c.l }))} />)}
                </div>

                <div className="overflow-auto">
                    <table className="w-full border-collapse text-sm">
                        <caption className="sr-only">{zh} 各快照數值</caption>
                        <thead className="sticky top-0 bg-[#0C1A2E]">
                            <tr className="border-b border-white/15">
                                <th scope="col" className="px-5 py-2 text-left text-[11px] font-normal text-slate-400">日期</th>
                                {cols.map(c => {
                                    const on = chartMetrics.includes(c.k);
                                    return (
                                        <th key={c.k} scope="col" className="px-3 py-2 text-right font-normal">
                                            <button type="button" aria-pressed={on} onClick={() => toggleChart(c.k)}
                                                className={`inline-flex flex-col items-end gap-0.5 border-b-2 pb-0.5 ${on ? 'border-[#12A150] text-slate-50' : 'border-transparent text-slate-400 hover:text-slate-100'}`}>
                                                <span className="text-[11px] whitespace-nowrap">{c.l}</span>
                                                {c.e && <span className="font-mono text-[10px] text-slate-500 whitespace-nowrap">{c.e}</span>}
                                            </button>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {displayedStats.length === 0 && (
                                <tr><td colSpan={cols.length + 1} className="px-5 py-8 text-center text-sm text-slate-500">此篩選條件下沒有快照</td></tr>
                            )}
                            {displayedStats.map(item => (
                                <tr key={item.date} className="border-b border-white/[0.06] odd:bg-white/[0.015] hover:bg-white/[0.04]">
                                    <td className="px-5 py-2 font-mono text-[13px] text-slate-300">{item.date}</td>
                                    {cols.map(c => {
                                        const val = cardInfo.type === 'playtype' ? item.stat?.[c.k] : item.tracking?.[c.k];
                                        return <td key={c.k} className={`px-3 py-2 text-right font-mono tabular-nums ${val == null ? 'text-slate-600' : 'text-slate-200'}`}>{val ?? '—'}</td>;
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="shrink-0 border-t border-white/10 px-5 py-2 text-[11px] text-slate-500">跨賽季比較請用「跨季」章節 · Esc 關閉</div>
            </div>
        </div>
    );
};
window.HistoryModal = HistoryModal;
