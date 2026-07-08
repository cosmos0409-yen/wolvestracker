// Splits 分頁：頂部期間篩選 + 欄位組卡片牆（該期間 vs 全季，綠/紅漲跌）+ 點卡片展開趨勢折線
// games：該季逐場 bundle（每場 {date,matchup,wl,stats}）；一律以 game.stats 為實體（GameAgg 'TEAM' 語意）
const SplitsTab = ({ games, seasonLabel, isPlayoffs }) => {
    const { useState } = React;
    const GA = window.GameAgg;
    const TrackingCardRow = window.TrackingCardRow;
    const trackingDefs = window.trackingDefs || [];
    const shootingDefs = window.shootingDefs || [];

    const [period, setPeriod] = useState('all');
    const [monthKey, setMonthKey] = useState('');
    const [seriesIdx, setSeriesIdx] = useState(0);
    const [rangeStart, setRangeStart] = useState('');
    const [rangeEnd, setRangeEnd] = useState('');
    const [group, setGroup] = useState('base');
    const [openGroup, setOpenGroup] = useState(null);
    const [trendMetric, setTrendMetric] = useState(null);
    const [gran, setGran] = useState('game');

    if (!games) return <div className="h-[120px] flex items-center justify-center text-slate-500 text-sm animate-pulse">載入單場資料中...</div>;
    if (!games.length) return <div className="px-4 py-6 rounded-lg text-sm border bg-slate-800/50 border-slate-700 text-slate-400 text-center">此賽季尚無單場資料（Splits 需要逐場資料）</div>;

    const BASE_DEF = {
        id: 'Base', title: '基本數據 (Traditional)', metrics: [
            { key: 'PTS', label: '得分', englishLabel: 'PTS' },
            { key: 'REB', label: '籃板', englishLabel: 'REB' },
            { key: 'AST', label: '助攻', englishLabel: 'AST' },
            { key: 'FG_PCT', label: '命中率', englishLabel: 'FG%', unit: '%' },
            { key: 'FG3_PCT', label: '三分%', englishLabel: '3P%', unit: '%' },
            { key: 'FT_PCT', label: '罰球%', englishLabel: 'FT%', unit: '%' },
            { key: 'STL', label: '抄截', englishLabel: 'STL' },
            { key: 'BLK', label: '阻攻', englishLabel: 'BLK' },
            { key: 'TOV', label: '失誤', englishLabel: 'TOV', betterIsLarger: false },
            { key: 'PLUS_MINUS', label: '正負值', englishLabel: '+/-' },
        ]
    };
    const ZONES_DEF = shootingDefs.find(d => d.id === 'ShotZones');
    const defs = group === 'base' ? [BASE_DEF] : group === 'tracking' ? trackingDefs : (ZONES_DEF ? [ZONES_DEF] : []);

    const months = GA.splitByMonth(games).map(g => g.label);
    const series = isPlayoffs ? GA.splitBySeries(games) : [];

    // 期間子集
    let periodGames = games, periodLabel = '全季';
    if (period === 'W') { periodGames = games.filter(g => g.wl === 'W'); periodLabel = '勝場'; }
    else if (period === 'L') { periodGames = games.filter(g => g.wl === 'L'); periodLabel = '敗場'; }
    else if (period === 'home') { periodGames = games.filter(g => (g.matchup || '').includes('vs.')); periodLabel = '主場'; }
    else if (period === 'away') { periodGames = games.filter(g => (g.matchup || '').includes('@')); periodLabel = '客場'; }
    else if (period === 'last5') { periodGames = GA.lastN(games, 5); periodLabel = '近 5 場'; }
    else if (period === 'last10') { periodGames = GA.lastN(games, 10); periodLabel = '近 10 場'; }
    else if (period === 'month') { periodGames = games.filter(g => (g.date || '').slice(0, 7) === monthKey); periodLabel = monthKey; }
    else if (period === 'range') { periodGames = GA.byDateRange(games, rangeStart, rangeEnd); periodLabel = `${rangeStart || '起'}~${rangeEnd || '訖'}`; }
    else if (period === 'series') { periodGames = (series[seriesIdx] || {}).games || []; periodLabel = (series[seriesIdx] || {}).label || '系列'; }

    const seasonAgg = GA.aggregate(games, null, 'TEAM');
    const periodAgg = GA.aggregate(periodGames, null, 'TEAM');

    const openTrend = (def) => {
        setOpenGroup(def.id === (openGroup && openGroup.id) ? null : def);
        setTrendMetric(def.metrics[0].key);
    };

    // 趨勢資料（整季，依粒度）
    const trendPts = (openGroup && trendMetric) ? GA.trendSeries(games, null, 'TEAM', trendMetric, gran) : [];
    const trendBaseline = (openGroup && trendMetric) ? seasonAgg[trendMetric] : null;

    const FilterBtn = ({ v, label }) => (
        <button onClick={() => setPeriod(v)}
            className={`px-2.5 py-1 text-xs rounded border transition-colors ${period === v ? 'bg-[#12A150] text-[#0C2340] border-[#12A150] font-bold' : 'border-slate-700 text-slate-400 hover:border-slate-500'}`}>
            {label}
        </button>
    );

    return (
        <div className="space-y-4">
            {/* 期間篩選列 */}
            <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800 space-y-2">
                <div className="flex flex-wrap items-center gap-1.5">
                    <FilterBtn v="all" label="全季" />
                    <FilterBtn v="W" label="勝場" /><FilterBtn v="L" label="敗場" />
                    <FilterBtn v="home" label="主場" /><FilterBtn v="away" label="客場" />
                    <FilterBtn v="last5" label="近5場" /><FilterBtn v="last10" label="近10場" />
                    <select value={period === 'month' ? monthKey : ''} onChange={e => { setPeriod('month'); setMonthKey(e.target.value); }}
                        className={`text-xs rounded border px-2 py-1 bg-slate-950 ${period === 'month' ? 'border-[#12A150] text-[#12A150]' : 'border-slate-700 text-slate-400'}`}>
                        <option value="">每月▾</option>
                        {months.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    {isPlayoffs && series.length > 0 && (
                        <select value={period === 'series' ? seriesIdx : ''} onChange={e => { setPeriod('series'); setSeriesIdx(Number(e.target.value)); }}
                            className={`text-xs rounded border px-2 py-1 bg-slate-950 ${period === 'series' ? 'border-[#12A150] text-[#12A150]' : 'border-slate-700 text-slate-400'}`}>
                            <option value="">系列賽▾</option>
                            {series.map((s, i) => <option key={i} value={i}>{s.label}</option>)}
                        </select>
                    )}
                    <FilterBtn v="range" label="自訂區間" />
                </div>
                {period === 'range' && (
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                        <input type="date" value={rangeStart} onChange={e => setRangeStart(e.target.value)} className="bg-slate-950 border border-slate-700 rounded px-2 py-1" />
                        <span>~</span>
                        <input type="date" value={rangeEnd} onChange={e => setRangeEnd(e.target.value)} className="bg-slate-950 border border-slate-700 rounded px-2 py-1" />
                    </div>
                )}
                <div className="flex items-center gap-1.5 pt-1 border-t border-slate-800">
                    <span className="text-[10px] text-slate-500">欄位：</span>
                    {[['base', '基本'], ['tracking', '進階'], ['zones', '投籃分區']].map(([g, l]) => (
                        <button key={g} onClick={() => { setGroup(g); setOpenGroup(null); }}
                            className={`px-2.5 py-1 text-xs rounded border ${group === g ? 'bg-[#236192] text-white border-[#236192] font-bold' : 'border-slate-700 text-slate-400 hover:border-slate-500'}`}>{l}</button>
                    ))}
                </div>
            </div>

            {/* 期間標題 */}
            <div className="flex items-center justify-between text-sm">
                <span className="font-bold text-slate-200">{periodLabel} <span className="text-slate-500 font-normal">（{periodAgg.GP} 場，vs 全季 {seasonAgg.GP} 場）</span></span>
                <span className="text-[10px] text-slate-500">綠/紅箭頭 = 此期間 vs 全季平均</span>
            </div>

            {/* 卡片牆 */}
            {periodAgg.GP === 0 ? (
                <div className="px-4 py-6 text-center text-slate-500 text-sm">此期間無比賽</div>
            ) : defs.map(def => (
                <div key={def.id}>
                    <TrackingCardRow title={def.title + '  ▸ 點看趨勢'} category={def.id} metrics={def.metrics}
                        current={periodAgg} prev={seasonAgg} onClick={() => openTrend(def)} source="stats" />
                    {openGroup && openGroup.id === def.id && (
                        <div className="border border-slate-800 rounded-xl p-4 bg-slate-950/40 -mt-2 mb-4">
                            <div className="flex flex-wrap items-center gap-2 mb-3">
                                <select value={trendMetric || ''} onChange={e => setTrendMetric(e.target.value)}
                                    className="text-xs rounded border border-slate-700 bg-slate-950 text-slate-200 px-2 py-1">
                                    {def.metrics.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                                </select>
                                <div className="flex gap-1">
                                    {[['game', '逐場'], ['week', '每週'], ['month', '每月']].map(([g, l]) => (
                                        <button key={g} onClick={() => setGran(g)}
                                            className={`px-2 py-0.5 text-[11px] rounded border ${gran === g ? 'bg-[#12A150] text-[#0C2340] border-[#12A150]' : 'border-slate-700 text-slate-400'}`}>{l}</button>
                                    ))}
                                </div>
                            </div>
                            <TrendChart points={trendPts} baseline={trendBaseline} />
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

// 簡易 SVG 折線：逐點值 + 全季均線；hover 顯示精確值、上方圖例、虛線右端標基準值
const TrendChart = ({ points, baseline }) => {
    if (!points || points.length < 1) return <div className="h-[120px] flex items-center justify-center text-slate-500 text-xs">無足夠資料繪製趨勢</div>;
    const W = 640, H = 160, padL = 34, padR = 46, padT = 12, padB = 22; // padR 加大留基準標籤空間
    const vals = points.map(p => p.value);
    let lo = Math.min(...vals, baseline != null ? baseline : Infinity);
    let hi = Math.max(...vals, baseline != null ? baseline : -Infinity);
    if (lo === hi) { lo -= 1; hi += 1; }
    const pad = (hi - lo) * 0.1; lo -= pad; hi += pad;
    const x = i => padL + (points.length === 1 ? (W - padL - padR) / 2 : i * (W - padL - padR) / (points.length - 1));
    const y = v => padT + (H - padT - padB) * (1 - (v - lo) / (hi - lo));
    const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
    return (
        <div>
            {/* 圖例 */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-1 text-[10px] text-slate-400">
                <span className="flex items-center gap-1"><svg width="18" height="6"><line x1="0" y1="3" x2="18" y2="3" stroke="#12A150" strokeWidth="2" /></svg>逐點值</span>
                {baseline != null && <span className="flex items-center gap-1"><svg width="18" height="6"><line x1="0" y1="3" x2="18" y2="3" stroke="#236192" strokeWidth="1.5" strokeDasharray="4 3" /></svg>全季平均 {baseline}</span>}
                <span className="text-slate-600">滑鼠移到點看數值</span>
            </div>
            <div className="overflow-x-auto">
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 480 }}>
                    {[0, 0.5, 1].map(f => { const v = lo + (hi - lo) * (1 - f); return (
                        <g key={f}><line x1={padL} x2={W - padR} y1={padT + f * (H - padT - padB)} y2={padT + f * (H - padT - padB)} stroke="#1e293b" />
                            <text x={4} y={padT + f * (H - padT - padB) + 3} fill="#64748b" fontSize="9">{v.toFixed(1)}</text></g>); })}
                    {baseline != null && (<g>
                        <line x1={padL} x2={W - padR} y1={y(baseline)} y2={y(baseline)} stroke="#236192" strokeDasharray="4 3" strokeWidth="1" />
                        <text x={W - padR + 4} y={y(baseline) + 3} fill="#60a5fa" fontSize="9" fontWeight="bold">{baseline}</text>
                    </g>)}
                    <path d={line} fill="none" stroke="#12A150" strokeWidth="2" />
                    {points.map((p, i) => (
                        <g key={i}>
                            <circle cx={x(i)} cy={y(p.value)} r="2.5" fill="#12A150" />
                            <circle cx={x(i)} cy={y(p.value)} r="10" fill="transparent" style={{ cursor: 'pointer' }}><title>{p.label}：{p.value}</title></circle>
                            {points.length <= 16 && <text x={x(i)} y={H - 8} fill="#64748b" fontSize="8" textAnchor="middle">{String(p.label).slice(5)}</text>}
                        </g>
                    ))}
                </svg>
            </div>
        </div>
    );
};

window.SplitsTab = SplitsTab;
window.TrendChart = TrendChart;
