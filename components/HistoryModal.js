// 卡片走勢 Modal。從 App.js 抽出來的原因不只是檔案太大：
// 原本它定義在 App 元件「內部」，每次 App re-render 都會產生一個新的元件型別，
// React 會把整棵子樹卸載重掛，使用者選的指標與日期區間因此被丟掉。
//
// 相依一律走 props / window，不在檔案頂層宣告任何東西——bundle 是單一 script scope，
// 與 App.js 頂層的 `const { useState, useEffect, useMemo } = React` 重複宣告會讓整包 SyntaxError。
const HistoryModal = ({ cardInfo, onClose, viewMode, viewSide, selectedPlayer, isHistoryMode, history }) => {
    const { useState, useMemo } = React;
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
    const [seasonTypeFilter, setSeasonTypeFilter] = useState(() => {
        if (isHistoryMode) return 'all';
        const phase = window.getSeasonPhase ? window.getSeasonPhase() : { type: 'regular' };
        return phase.type === 'playoffs' ? '季後賽' : '例行賽';
    }); // 歷史模式 'all'，當季依日期預設

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
window.HistoryModal = HistoryModal;
