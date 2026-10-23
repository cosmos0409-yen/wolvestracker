// Splits 分頁：頂部期間篩選 + 欄位組卡片牆（該期間 vs 全季，綠/紅漲跌）+ 點卡片展開趨勢折線
// games：該季逐場 bundle（每場 {date,matchup,wl,stats}）；一律以 game.stats 為實體（GameAgg 'TEAM' 語意）
// focusMetric / highlightDate：網址 m= / hl=（從單場頁點指標過來）→ 自動切到該指標所屬欄位組、打開逐場走勢、圈出那一場
// onFocusChange(metricKey|null)：走勢開關或換指標時回報，讓網址跟著記住（可分享）
// onGameClick(date)：逐場走勢上點某一場（→ 單場頁）；未傳則點不可點
const SplitsTab = ({ games, seasonLabel, isPlayoffs, focusMetric, highlightDate, onFocusChange, onGameClick }) => {
    const { useState, useEffect } = React;
    const GA = window.GameAgg;
    const TrackingCardRow = window.TrackingCardRow;
    const trackingDefs = window.trackingDefs || [];
    const shootingDefs = window.shootingDefs || [];
    const defenseDefs = window.defenseDefs || [];

    const [period, setPeriod] = useState('all');
    const [monthKey, setMonthKey] = useState('');
    const [seriesIdx, setSeriesIdx] = useState(0);
    const [oppKey, setOppKey] = useState('');   // 期間＝對手（三碼）；季後賽用系列賽選單，不另顯示
    const [rangeStart, setRangeStart] = useState('');
    const [rangeEnd, setRangeEnd] = useState('');
    const [group, setGroup] = useState('base');
    const [openGroup, setOpenGroup] = useState(null);
    const [trendMetric, setTrendMetric] = useState(null);
    const [gran, setGran] = useState('game');
    const ledgerRef = React.useRef(null);
    const trendRef = React.useRef(null);
    const pendingScrollRef = React.useRef(false);   // 從網址聚焦後，等走勢出現再捲過去

    const BASE_DEF = window.SPLITS_BASE_DEF;
    const ZONES_DEF = shootingDefs.find(d => d.id === 'ShotZones');
    // 單場有的防守資料：最近防守者（僅球員）＋ Hustle。DefenseBox（防守效率等）沒有單場值
    const DEF_DEFS = defenseDefs.filter(d => (window.GAME_DEFENSE_IDS || []).includes(d.id));
    const GROUP_DEFS = { base: [BASE_DEF], tracking: trackingDefs, zones: ZONES_DEF ? [ZONES_DEF] : [], defense: DEF_DEFS };

    // 網址帶指標 → 找所屬欄位組與群組（由 defs 反查，不另建對照表；新增指標自動適用）
    useEffect(() => {
        // 自己開走勢時也會回報 m → 已經開著同一個指標就不重設、不捲動
        if (!focusMetric || (openGroup && trendMetric === focusMetric)) return;
        for (const [g, defs] of Object.entries(GROUP_DEFS)) {
            const def = defs.find(d => d.metrics.some(m => m.key === focusMetric));
            if (def) {
                setGroup(g); setOpenGroup(def); setTrendMetric(focusMetric);
                if (highlightDate) setGran('game');
                pendingScrollRef.current = true;   // 走勢渲染出來後再捲過去（見下一個 effect）
                return;
            }
        }
    }, [focusMetric, highlightDate, !!games]);
    // 每次渲染後檢查：從網址聚焦且走勢已出現 → 捲到畫面中央（只做一次）。
    // 不能在設定狀態時就捲：當下欄位組還沒切換、版面高度還會變
    useEffect(() => {
        if (!pendingScrollRef.current || !trendRef.current) return;
        pendingScrollRef.current = false;
        trendRef.current.scrollIntoView({ block: 'center' });   // effect 在 DOM 更新後執行，版面已就緒
    });

    if (!games) return <div className="py-10 text-center text-sm text-slate-500 animate-pulse">載入單場資料中…</div>;
    if (!games.length) return <window.UI.Note>此賽季尚無單場資料（Splits 需要逐場資料）</window.UI.Note>;

    const months = GA.splitByMonth(games).map(g => g.label);
    // 對手清單（三碼排序＋場數）；對手三碼規則與對戰分析相同
    const oppOf = g => g.oppAbbr || window.Matchup.oppOf(g.matchup);
    const opps = Object.entries(games.reduce((m, g) => { const a = oppOf(g); if (a) m[a] = (m[a] || 0) + 1; return m; }, {})).sort();
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
    else if (period === 'opp') { periodGames = games.filter(g => oppOf(g) === oppKey); periodLabel = `對 ${oppKey} ${window.teamName(oppKey)}`; }

    const seasonAgg = GA.aggregate(games, null, 'TEAM');
    const periodAgg = GA.aggregate(periodGames, null, 'TEAM');

    // 只列出這個實體有資料的群組（球隊沒有最近防守者；舊場次可能沒有 Hustle）
    const hasData = def => def.metrics.some(m => typeof seasonAgg[m.key] === 'number');
    const defs = (GROUP_DEFS[group] || []).filter(hasData);

    const openTrend = (def) => {
        const closing = def.id === (openGroup && openGroup.id);
        setOpenGroup(closing ? null : def);
        setTrendMetric(def.metrics[0].key);
        if (onFocusChange) onFocusChange(closing ? null : def.metrics[0].key);
    };
    const pickTrendMetric = (k) => { setTrendMetric(k); if (onFocusChange) onFocusChange(k); };

    // 趨勢資料（整季，依粒度）
    const trendPts = (openGroup && trendMetric) ? GA.trendSeries(games, null, 'TEAM', trendMetric, gran) : [];
    const trendBaseline = (openGroup && trendMetric) ? seasonAgg[trendMetric] : null;

    const UI = window.UI;
    const GROUPS = [['base', '基本', 'Traditional'], ['tracking', '進階', 'Tracking'], ['zones', '投籃分區', 'Shot Zones'], ['defense', '防守', 'Defense']]
        .filter(([g]) => (GROUP_DEFS[g] || []).some(hasData));

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
                    {!isPlayoffs && opps.length > 0 && (<>
                        <label className="sr-only" htmlFor="splits-opp">選擇對手</label>
                        <select id="splits-opp" value={period === 'opp' ? oppKey : ''} onChange={e => { if (!e.target.value) return; setPeriod('opp'); setOppKey(e.target.value); }}
                            className={UI.selectClass(period === 'opp')}>
                            <option value="">對手</option>
                            {opps.map(([a, n]) => <option key={a} value={a}>{a} {window.teamName(a)}（{n}）</option>)}
                        </select>
                    </>)}
                    <UI.Chip active={period === 'range'} onClick={() => setPeriod('range')}>自訂區間</UI.Chip>
                </div>
                {period === 'opp' && (
                    <p className="text-[12px] text-slate-400">
                        單季交手只有 2–4 場，數字容易被單場手感左右。
                        <a href={window.UrlState.vsHref(oppKey)} className="ml-1 text-slate-200 underline underline-offset-2 hover:text-[#12A150]">看 {oppKey} 近三季對戰分析 →</a>
                    </p>
                )}
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
                    <UI.Seg ariaLabel="欄位組" size="sm" value={group} onChange={(g) => { setGroup(g); setOpenGroup(null); if (onFocusChange) onFocusChange(null); }}
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
                            <div ref={trendRef} className="-mt-3 mb-6 border border-white/10 p-4">
                                <div className="mb-3 flex flex-wrap items-center gap-3">
                                    <label className="sr-only" htmlFor={`trend-metric-${def.id}`}>趨勢指標</label>
                                    <select id={`trend-metric-${def.id}`} value={trendMetric || ''} onChange={e => pickTrendMetric(e.target.value)}
                                        className={UI.selectClass(true)}>
                                        {def.metrics.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                                    </select>
                                    <UI.Seg ariaLabel="趨勢粒度" size="sm" value={gran} onChange={setGran}
                                        options={[{ value: 'game', label: '逐場' }, { value: 'week', label: '每週' }, { value: 'month', label: '每月' }]} />
                                </div>
                                <TrendChart points={trendPts} baseline={trendBaseline}
                                    highlight={gran === 'game' ? highlightDate : null}
                                    onPointClick={gran === 'game' && onGameClick ? (p) => onGameClick(p.label) : null}
                                    unit={(def.metrics.find(m => m.key === trendMetric) || {}).unit === '%' ? '%' : ''}
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
// unit：純文字複製時接在數值後（'%'）；citeSeason：純文字標題的賽季，預設取 CiteCtx.season，跨季比較傳 false 省略
// 點若帶 wl（逐場）→ 底下鋪勝負色帶（綠勝紅敗）
// highlight：要圈出的點 label（逐場＝日期）；窄螢幕需橫捲時自動捲到該點
// onPointClick(point)：點擊某點（逐場 → 單場頁）；未傳則不可點
const TrendChart = ({ points, baseline, title, unit = '', citeSeason, highlight, onPointClick }) => {
    const UI = window.UI;
    const chartRef = React.useRef(null);
    const scrollRef = React.useRef(null);
    const W = 640, H = 160, padL = 34, padR = 46, padT = 12, padB = 22; // padR 加大留基準標籤空間
    const n = points ? points.length : 0;
    const x = i => padL + (n === 1 ? (W - padL - padR) / 2 : i * (W - padL - padR) / (n - 1));
    const hlIdx = highlight && points ? points.findIndex(p => p.label === highlight) : -1;
    React.useEffect(() => {
        const el = scrollRef.current;
        if (!el || hlIdx < 0 || el.scrollWidth <= el.clientWidth) return;
        el.scrollLeft = el.scrollWidth * x(hlIdx) / W - el.clientWidth / 2;
    }, [hlIdx, n]);
    // X 軸：日期標籤去掉年份（2025-01-15 → 01-15、2025-01 → 01）；其他標籤（跨季的「24-25例」）原樣顯示
    const axisLabel = (l) => /^\d{4}-\d{2}(-\d{2})?$/.test(String(l)) ? String(l).slice(5) : String(l);
    // 臉書用純文字：點少（≤6，如跨季）寫成一行箭頭，點多（逐場）一行一點
    const fbText = () => {
        const c = window.CiteCtx || {};
        const subject = c.subject === 'Minnesota Timberwolves' ? '灰狼全隊' : c.subject;
        const season = citeSeason === undefined ? c.season : citeSeason;
        const v = (x) => `${x}${unit}`;
        const body = points.length <= 6
            ? [points.map(p => `${p.label} ${v(p.value)}`).join(' → ')]
            : points.map(p => `${p.label}｜${v(p.value)}${p.wl ? ` ${p.wl}` : ''}`);
        return [
            `【${[subject, season, title].filter(Boolean).join('｜')}】`,
            '',
            ...body,
            ...(baseline != null ? ['', `全季平均 ${v(baseline)}`] : []),
            '',
            '資料：NBA.com Stats',
            `${location.origin}${location.pathname}${location.hash}`,
        ].join('\n');
    };
    if (!points || points.length < 1) return <div className="py-8 text-center text-xs text-slate-500">資料不足，無法繪製趨勢</div>;
    const vals = points.map(p => p.value);
    let lo = Math.min(...vals, baseline != null ? baseline : Infinity);
    let hi = Math.max(...vals, baseline != null ? baseline : -Infinity);
    if (lo === hi) { lo -= 1; hi += 1; }
    const pad = (hi - lo) * 0.1; lo -= pad; hi += pad;
    const y = v => padT + (H - padT - padB) * (1 - (v - lo) / (hi - lo));
    const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
    const MONO = "'JetBrains Mono', monospace";
    const hasWL = points.some(p => p.wl === 'W' || p.wl === 'L');
    const step = n > 1 ? (W - padL - padR) / (n - 1) : (W - padL - padR);
    const hl = hlIdx >= 0 ? points[hlIdx] : null;
    return (
        <div ref={chartRef}>
            {/* 圖例 */}
            <div className="mb-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5"><svg width="18" height="6" aria-hidden="true"><line x1="0" y1="3" x2="18" y2="3" stroke="#12A150" strokeWidth="2" /></svg>逐點值</span>
                {baseline != null && <span className="flex items-center gap-1.5"><svg width="18" height="6" aria-hidden="true"><line x1="0" y1="3" x2="18" y2="3" stroke="#C4CED2" strokeWidth="1.5" strokeDasharray="4 3" /></svg>全季平均 {baseline}</span>}
                {hasWL && <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 bg-[#12A150]/25" aria-hidden="true"></span>勝
                    <span className="ml-1 inline-block h-2.5 w-2.5 bg-[#EF4444]/25" aria-hidden="true"></span>敗（底色）
                </span>}
                {hl && <span className="flex items-center gap-1.5 text-amber-300"><svg width="10" height="10" aria-hidden="true"><circle cx="5" cy="5" r="4" fill="none" stroke="#FBBF24" strokeWidth="1.5" /></svg>本場 {axisLabel(hl.label)}</span>}
                <span className="text-slate-500" data-export-hide>{onPointClick ? '滑鼠移到點看數值，點擊看該場' : '滑鼠移到點看數值'}</span>
                {title && <span className="ml-auto"><UI.ExportMenu title={title} getNode={() => chartRef.current}
                    csv={() => ({ header: ['期間', '數值', '全季平均', ...(hasWL ? ['勝負'] : [])], rows: points.map(p => [p.label, p.value, baseline == null ? '' : baseline, ...(hasWL ? [p.wl || ''] : [])]) })}
                    text={fbText} /></span>}
            </div>
            <div ref={scrollRef} className="overflow-x-auto">
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 480 }} role="img" aria-label="趨勢折線圖">
                    {hasWL && points.map((p, i) => (p.wl === 'W' || p.wl === 'L') && (
                        <rect key={'wl' + i} x={x(i) - step / 2} y={padT} width={step} height={H - padT - padB}
                            fill={p.wl === 'W' ? '#12A150' : '#EF4444'} fillOpacity="0.09" />
                    ))}
                    {[0, 0.5, 1].map(f => { const v = lo + (hi - lo) * (1 - f); return (
                        <g key={f}><line x1={padL} x2={W - padR} y1={padT + f * (H - padT - padB)} y2={padT + f * (H - padT - padB)} stroke="rgba(255, 255, 255, 0.07)" />
                            <text x={4} y={padT + f * (H - padT - padB) + 3} fill="#64748b" fontSize="9" fontFamily={MONO}>{v.toFixed(1)}</text></g>); })}
                    {baseline != null && (<g>
                        <line x1={padL} x2={W - padR} y1={y(baseline)} y2={y(baseline)} stroke="#C4CED2" strokeOpacity="0.6" strokeDasharray="4 3" strokeWidth="1" />
                        <text x={W - padR + 4} y={y(baseline) + 3} fill="#C4CED2" fontSize="9" fontFamily={MONO}>{baseline}</text>
                    </g>)}
                    <path d={line} fill="none" stroke="#12A150" strokeWidth="2" />
                    {hl && (<g>
                        <circle cx={x(hlIdx)} cy={y(hl.value)} r="7" fill="none" stroke="#FBBF24" strokeWidth="2" />
                        <text x={x(hlIdx)} y={y(hl.value) - 11} fill="#FBBF24" fontSize="10" textAnchor="middle" fontFamily={MONO}>本場 {hl.value}{unit}</text>
                    </g>)}
                    {points.map((p, i) => (
                        <g key={i}>
                            <circle cx={x(i)} cy={y(p.value)} r="2.5" fill={i === hlIdx ? '#FBBF24' : '#12A150'} />
                            <circle cx={x(i)} cy={y(p.value)} r="10" fill="transparent" style={{ cursor: 'pointer' }}
                                onClick={onPointClick ? () => onPointClick(p) : undefined}>
                                <title>{p.label}{p.wl ? `（${p.wl === 'W' ? '勝' : '敗'}）` : ''}：{p.value}{unit}{onPointClick ? '　點擊看這場' : ''}</title>
                            </circle>
                            {(points.length <= 16 || i === hlIdx) && <text x={x(i)} y={H - 8} fill={i === hlIdx ? '#FBBF24' : '#64748b'} fontSize="8" textAnchor="middle" fontFamily={MONO}>{axisLabel(p.label)}</text>}
                        </g>
                    ))}
                </svg>
            </div>
        </div>
    );
};

window.SplitsTab = SplitsTab;
window.TrendChart = TrendChart;
