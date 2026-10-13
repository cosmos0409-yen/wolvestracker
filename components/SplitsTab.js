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
    const ledgerRef = React.useRef(null);

    if (!games) return <div className="py-10 text-center text-sm text-slate-500 animate-pulse">載入單場資料中…</div>;
    if (!games.length) return <window.UI.Note>此賽季尚無單場資料（Splits 需要逐場資料）</window.UI.Note>;

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

    const UI = window.UI;
    const GROUPS = [['base', '基本', 'Traditional'], ['tracking', '進階', 'Tracking'], ['zones', '投籃分區', 'Shot Zones']];

    return (
        <div className="space-y-8">
            {/* 期間篩選列 */}
            <div className="space-y-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                    <span className="mr-1 text-[11px] text-slate-500">期間</span>
                    <UI.Chip active={period === 'all'} onClick={() => setPeriod('all')}>全季</UI.Chip>
                    <UI.Chip active={period === 'W'} onClick={() => setPeriod('W')}>勝場</UI.Chip>
                    <UI.Chip active={period === 'L'} onClick={() => setPeriod('L')}>敗場</UI.Chip>
                    <UI.Chip active={period === 'home'} onClick={() => setPeriod('home')}>主場</UI.Chip>
                    <UI.Chip active={period === 'away'} onClick={() => setPeriod('away')}>客場</UI.Chip>
                    <UI.Chip active={period === 'last5'} onClick={() => setPeriod('last5')}>近 5 場</UI.Chip>
                    <UI.Chip active={period === 'last10'} onClick={() => setPeriod('last10')}>近 10 場</UI.Chip>
                    <label className="sr-only" htmlFor="splits-month">選擇月份</label>
                    <select id="splits-month" value={period === 'month' ? monthKey : ''} onChange={e => { setPeriod('month'); setMonthKey(e.target.value); }}
                        className={UI.selectClass(period === 'month')}>
                        <option value="">每月</option>
                        {months.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    {isPlayoffs && series.length > 0 && (<>
                        <label className="sr-only" htmlFor="splits-series">選擇系列賽</label>
                        <select id="splits-series" value={period === 'series' ? seriesIdx : ''} onChange={e => { setPeriod('series'); setSeriesIdx(Number(e.target.value)); }}
                            className={UI.selectClass(period === 'series')}>
                            <option value="">系列賽</option>
                            {series.map((s, i) => <option key={i} value={i}>{s.label}</option>)}
                        </select>
                    </>)}
                    <UI.Chip active={period === 'range'} onClick={() => setPeriod('range')}>自訂區間</UI.Chip>
                </div>
                {period === 'range' && (
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                        <input type="date" aria-label="起始日" value={rangeStart} onChange={e => setRangeStart(e.target.value)} className={UI.selectClass(!!rangeStart)} />
                        <span>~</span>
                        <input type="date" aria-label="結束日" value={rangeEnd} onChange={e => setRangeEnd(e.target.value)} className={UI.selectClass(!!rangeEnd)} />
                    </div>
                )}
            </div>

            <UI.Section title={periodLabel} en="Splits" accent="green"
                sub={`${periodAgg.GP} 場，vs 全季 ${seasonAgg.GP} 場 · 箭頭＝此期間 vs 全季平均 · 百分比以 Σ命中 ÷ Σ出手 重算 · 點群組看趨勢`}
                right={<>
                    <UI.ExportMenu title={`Splits：${periodLabel}（${periodAgg.GP} 場）vs 全季`} getNode={() => ledgerRef.current}
                        csv={() => ({ header: ['群組', '指標', '原文', periodLabel, '全季', '差'], rows: defs.flatMap(d => d.metrics.map(m => {
                            const a = periodAgg[m.key], b = seasonAgg[m.key];
                            return [d.title, m.label, m.englishLabel || '', a == null ? '' : a, b == null ? '' : b, (typeof a === 'number' && typeof b === 'number') ? +(a - b).toFixed(1) : ''];
                        })) })} />
                    <UI.Seg ariaLabel="欄位組" size="sm" value={group} onChange={(g) => { setGroup(g); setOpenGroup(null); }}
                        options={GROUPS.map(([v, l]) => ({ value: v, label: l }))} />
                </>}>
                <div ref={ledgerRef}>
                {periodAgg.GP === 0 ? (
                    <UI.Note>此期間沒有比賽</UI.Note>
                ) : defs.map(def => (
                    <div key={def.id}>
                        <TrackingCardRow title={def.title} actionLabel="點看趨勢" category={def.id} metrics={def.metrics}
                            current={periodAgg} prev={seasonAgg} onClick={() => openTrend(def)} source="stats"
                            citeAsOf="none" citeNote={`Splits：${periodLabel}（${periodAgg.GP} 場）`} />
                        {openGroup && openGroup.id === def.id && (
                            <div className="-mt-3 mb-6 border border-white/10 p-4">
                                <div className="mb-3 flex flex-wrap items-center gap-3">
                                    <label className="sr-only" htmlFor={`trend-metric-${def.id}`}>趨勢指標</label>
                                    <select id={`trend-metric-${def.id}`} value={trendMetric || ''} onChange={e => setTrendMetric(e.target.value)}
                                        className={UI.selectClass(true)}>
                                        {def.metrics.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                                    </select>
                                    <UI.Seg ariaLabel="趨勢粒度" size="sm" value={gran} onChange={setGran}
                                        options={[{ value: 'game', label: '逐場' }, { value: 'week', label: '每週' }, { value: 'month', label: '每月' }]} />
                                </div>
                                <TrendChart points={trendPts} baseline={trendBaseline}
                                    title={`${(def.metrics.find(m => m.key === trendMetric) || {}).label || ''}趨勢（${gran === 'game' ? '逐場' : gran === 'week' ? '每週' : '每月'}）`} />
                            </div>
                        )}
                    </div>
                ))}
                </div>
            </UI.Section>
        </div>
    );
};

// 簡易 SVG 折線：逐點值 + 全季均線；hover 顯示精確值、上方圖例、虛線右端標基準值
const TrendChart = ({ points, baseline, title }) => {
    const UI = window.UI;
    const chartRef = React.useRef(null);
    if (!points || points.length < 1) return <div className="py-8 text-center text-xs text-slate-500">資料不足，無法繪製趨勢</div>;
    const W = 640, H = 160, padL = 34, padR = 46, padT = 12, padB = 22; // padR 加大留基準標籤空間
    const vals = points.map(p => p.value);
    let lo = Math.min(...vals, baseline != null ? baseline : Infinity);
    let hi = Math.max(...vals, baseline != null ? baseline : -Infinity);
    if (lo === hi) { lo -= 1; hi += 1; }
    const pad = (hi - lo) * 0.1; lo -= pad; hi += pad;
    const x = i => padL + (points.length === 1 ? (W - padL - padR) / 2 : i * (W - padL - padR) / (points.length - 1));
    const y = v => padT + (H - padT - padB) * (1 - (v - lo) / (hi - lo));
    const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
    const MONO = "'JetBrains Mono', monospace";
    return (
        <div ref={chartRef}>
            {/* 圖例 */}
            <div className="mb-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5"><svg width="18" height="6" aria-hidden="true"><line x1="0" y1="3" x2="18" y2="3" stroke="#12A150" strokeWidth="2" /></svg>逐點值</span>
                {baseline != null && <span className="flex items-center gap-1.5"><svg width="18" height="6" aria-hidden="true"><line x1="0" y1="3" x2="18" y2="3" stroke="#C4CED2" strokeWidth="1.5" strokeDasharray="4 3" /></svg>全季平均 {baseline}</span>}
                <span className="text-slate-600" data-export-hide>滑鼠移到點看數值</span>
                {title && <span className="ml-auto"><UI.ExportMenu title={title} getNode={() => chartRef.current}
                    csv={() => ({ header: ['期間', '數值', '全季平均'], rows: points.map(p => [p.label, p.value, baseline == null ? '' : baseline]) })} /></span>}
            </div>
            <div className="overflow-x-auto">
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 480 }} role="img" aria-label="趨勢折線圖">
                    {[0, 0.5, 1].map(f => { const v = lo + (hi - lo) * (1 - f); return (
                        <g key={f}><line x1={padL} x2={W - padR} y1={padT + f * (H - padT - padB)} y2={padT + f * (H - padT - padB)} stroke="rgba(255, 255, 255, 0.07)" />
                            <text x={4} y={padT + f * (H - padT - padB) + 3} fill="#64748b" fontSize="9" fontFamily={MONO}>{v.toFixed(1)}</text></g>); })}
                    {baseline != null && (<g>
                        <line x1={padL} x2={W - padR} y1={y(baseline)} y2={y(baseline)} stroke="#C4CED2" strokeOpacity="0.6" strokeDasharray="4 3" strokeWidth="1" />
                        <text x={W - padR + 4} y={y(baseline) + 3} fill="#C4CED2" fontSize="9" fontFamily={MONO}>{baseline}</text>
                    </g>)}
                    <path d={line} fill="none" stroke="#12A150" strokeWidth="2" />
                    {points.map((p, i) => (
                        <g key={i}>
                            <circle cx={x(i)} cy={y(p.value)} r="2.5" fill="#12A150" />
                            <circle cx={x(i)} cy={y(p.value)} r="10" fill="transparent" style={{ cursor: 'pointer' }}><title>{p.label}：{p.value}</title></circle>
                            {points.length <= 16 && <text x={x(i)} y={H - 8} fill="#64748b" fontSize="8" textAnchor="middle" fontFamily={MONO}>{String(p.label).slice(5)}</text>}
                        </g>
                    ))}
                </svg>
            </div>
        </div>
    );
};

window.SplitsTab = SplitsTab;
window.TrendChart = TrendChart;
