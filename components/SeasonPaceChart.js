// 疊圖元件（跨季章節用）
//   LineOverlay：通用多序列 SVG 折線（十字線提示、末端標籤、他隊季別空心點＋虛線）
//   SeasonPaceChart：賽季軌跡疊圖——各季逐場 bundle 以「出賽第 N 場」對齊，看今年同期 vs 往年
//     賽別跟著刊頭的例行／季後切換（seasonType），不另放賽別控制項
//
// LineOverlay props：
//   xs        X 軸標籤（陣列）
//   series    [{ key, label, color, values:[number|null], dashed?, width?, hollow?:[bool], tags?:[string] }]
//             hollow/tags 為逐點：他隊季別畫空心點、點上方標 @隊名，相鄰任一端為他隊的線段改虛線
//   unit      '%' 時數值後接 %；fmt 自訂數值格式
//   marker    { index, label } 垂直參考線（如「今年第 34 場」）
//   mini      小圖並排用：不畫 Y 軸刻度、末端標籤只標數值
//   xEvery    X 軸每幾個標一次（預設依點數自動）
const LineOverlay = ({ xs, series, unit = '', fmt, marker, mini = false, height, xEvery, ariaLabel = '疊圖折線' }) => {
    const { useState, useRef } = React;
    const [hover, setHover] = useState(null);
    const svgRef = useRef(null);
    const W = mini ? 300 : 960, H = height || (mini ? 120 : 320);
    const pL = mini ? 8 : 44, pR = mini ? 10 : 96, pT = mini ? 12 : 18, pB = mini ? 18 : 28;
    const n = xs.length;
    const all = series.flatMap(s => s.values).filter(v => typeof v === 'number');
    if (!n || !all.length) return <div className="py-8 text-center text-xs text-slate-500">資料不足，無法繪製</div>;
    let lo = Math.min(...all), hi = Math.max(...all);
    if (lo === hi) { lo -= 1; hi += 1; }
    const pad = (hi - lo) * 0.1; lo -= pad; hi += pad;
    const x = i => pL + (n === 1 ? (W - pL - pR) / 2 : i * (W - pL - pR) / (n - 1));
    const y = v => pT + (H - pT - pB) * (1 - (v - lo) / (hi - lo));
    const f = v => (fmt ? fmt(v) : (Number.isInteger(v) ? String(v) : v.toFixed(1))) + unit;
    const MONO = "'JetBrains Mono', monospace";
    const every = xEvery || (n <= 8 ? 1 : n <= 20 ? 2 : 10);
    const onMove = (e) => {
        const r = svgRef.current.getBoundingClientRect();
        const sx = (e.clientX - r.left) * W / r.width;
        setHover({ i: Math.max(0, Math.min(n - 1, Math.round((sx - pL) / ((W - pL - pR) / Math.max(1, n - 1))))), px: e.clientX - r.left, w: r.width });
    };
    // 末端標籤：各序列最後一個有值的點，依 y 排開避免重疊
    const ends = series.map(s => { let i = s.values.length - 1; while (i >= 0 && typeof s.values[i] !== 'number') i--; return i >= 0 ? { s, i, yy: y(s.values[i]) } : null; }).filter(Boolean)
        .sort((a, b) => a.yy - b.yy);
    for (let k = 1; k < ends.length; k++) if (ends[k].yy - ends[k - 1].yy < 12) ends[k].yy = ends[k - 1].yy + 12;
    return (
        <div className="relative">
            <div className="overflow-x-auto">
                <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: mini ? 0 : 560 }} role="img" aria-label={ariaLabel}
                    onMouseMove={mini ? undefined : onMove} onMouseLeave={() => setHover(null)}>
                    {!mini && [0, 0.25, 0.5, 0.75, 1].map(t => { const v = lo + (hi - lo) * (1 - t), yy = pT + t * (H - pT - pB); return (
                        <g key={t}><line x1={pL} x2={W - pR} y1={yy} y2={yy} stroke="rgba(255,255,255,0.07)" />
                            <text x={pL - 6} y={yy + 3} fill="#7C8B9C" fontSize="10" textAnchor="end" fontFamily={MONO}>{v.toFixed(1)}</text></g>); })}
                    {xs.map((l, i) => (i % every === 0 || i === n - 1) && (
                        <text key={i} x={x(i)} y={H - (mini ? 4 : 9)} fill="#7C8B9C" fontSize={mini ? 9 : 10} textAnchor="middle" fontFamily={MONO}>{l}</text>
                    ))}
                    {marker && marker.index >= 0 && marker.index < n && (<g>
                        <line x1={x(marker.index)} x2={x(marker.index)} y1={pT} y2={H - pB} stroke="rgba(18,161,80,0.4)" />
                        {!mini && <text x={x(marker.index) + 4} y={pT + 10} fill="#12A150" fontSize="10" fontFamily={MONO}>{marker.label}</text>}
                    </g>)}
                    {/* 舊序列先畫、第一個（主角）最後畫在最上層 */}
                    {series.slice().reverse().map(s => {
                        const segs = [];
                        for (let i = 1; i < s.values.length; i++) {
                            const a = s.values[i - 1], b = s.values[i];
                            if (typeof a !== 'number' || typeof b !== 'number') continue;
                            const other = (s.hollow || [])[i - 1] || (s.hollow || [])[i];
                            segs.push(<line key={i} x1={x(i - 1)} y1={y(a)} x2={x(i)} y2={y(b)} stroke={s.color} strokeWidth={s.width || 2}
                                strokeDasharray={s.dashed || other ? '5 4' : undefined} strokeOpacity={other ? 0.6 : (s.opacity || 1)} strokeLinecap="round" />);
                        }
                        const dots = n <= 30 ? s.values.map((v, i) => typeof v === 'number' && (
                            <g key={'d' + i}>
                                <circle cx={x(i)} cy={y(v)} r={mini ? 2.5 : 3.5} fill={(s.hollow || [])[i] ? '#0A1626' : s.color} stroke={s.color} strokeWidth="1.5" />
                                {!mini && (s.tags || [])[i] && <text x={x(i)} y={y(v) - 8} fill="#FBBF24" fillOpacity="0.85" fontSize="9" textAnchor="middle" fontFamily={MONO}>{s.tags[i]}</text>}
                            </g>)) : null;
                        return <g key={s.key}>{segs}{dots}</g>;
                    })}
                    {ends.map(({ s, i, yy }) => (
                        <text key={'e' + s.key} x={mini ? x(i) - 4 : W - pR + 6} y={(mini ? y(s.values[i]) - 6 : yy + 3)} fill={s.color} fontSize="10"
                            textAnchor={mini ? 'end' : 'start'} fontFamily={MONO}>{mini ? f(s.values[i]) : `${s.label} ${f(s.values[i])}`}</text>
                    ))}
                    {hover && (<g pointerEvents="none">
                        <line x1={x(hover.i)} x2={x(hover.i)} y1={pT} y2={H - pB} stroke="rgba(232,237,240,0.45)" />
                        {series.map(s => typeof s.values[hover.i] === 'number' && <circle key={s.key} cx={x(hover.i)} cy={y(s.values[hover.i])} r="4" fill={s.color} />)}
                    </g>)}
                </svg>
            </div>
            {hover && (
                <div className="pointer-events-none absolute top-3 z-10 min-w-[150px] border border-white/20 bg-[#0E1D33]/95 px-2.5 py-2 text-[12px]"
                    style={{ left: hover.px > hover.w - 200 ? Math.max(0, hover.px - 180) : hover.px + 14 }}>
                    <div className="mb-1 font-mono text-[10px] text-slate-500">{xs[hover.i]}</div>
                    {series.map(s => (
                        <div key={s.key} className="flex justify-between gap-4 font-mono">
                            <span className="flex items-center gap-1.5 text-slate-300"><i className="inline-block h-[3px] w-2.5" style={{ background: s.color }}></i>{s.label}</span>
                            <span className="text-slate-100">{typeof s.values[hover.i] === 'number' ? f(s.values[hover.i]) : '—'}{(s.tags || [])[hover.i] ? ` ${s.tags[hover.i]}` : ''}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ── 賽季軌跡疊圖 ──
// 各季逐場 bundle 依日期排序後，第 i 場＝該員（或球隊）該季第 i+1 場出賽；球員是「出賽場次」不是球隊場次
const PACE_COLORS = ['#12A150', '#C4CED2', '#5B9BD5', '#F59E0B', '#A78BFA'];
const SeasonPaceChart = ({ viewMode, playerId, playerName, seasonType }) => {
    const { useState, useEffect, useMemo, useRef } = React;
    const UI = window.UI, GA = window.GameAgg;
    const phase = window.getSeasonPhase ? window.getSeasonPhase() : { inSeason: false, type: 'regular' };
    const type = seasonType === 'playoffs' ? 'playoffs' : 'regular';
    const [metric, setMetric] = useState('PTS');
    const [mode, setMode] = useState('cum');
    const [off, setOff] = useState([]);          // 使用者關掉的賽季
    const [data, setData] = useState({});        // { season: games[] }
    const [loading, setLoading] = useState(true);
    const chartRef = useRef(null);

    const seasons = useMemo(() => [...new Set([window.CURRENT_SEASON, ...(window.HISTORY_SEASONS || [])])].sort().reverse(), []);
    const isTeam = viewMode === 'TEAM';

    useEffect(() => {
        if (!window.loadSeasonGames || (!isTeam && !playerId)) { setData({}); setLoading(false); return; }
        let cancelled = false;
        setLoading(true);
        Promise.all(seasons.map(s => window.loadSeasonGames(s, type, viewMode, isTeam ? null : playerId)
            .then(({ games }) => [s, (games || []).slice().sort((a, b) => (a.date < b.date ? -1 : 1))])))
            .then(pairs => { if (!cancelled) { setData(Object.fromEntries(pairs)); setLoading(false); } });
        return () => { cancelled = true; };
    }, [type, viewMode, playerId]);

    // 指標選單：沿用 defs（Playtype／On-Off 沒有逐場資料，不列）
    const GROUPS = [
        ['基本', [window.SPLITS_BASE_DEF]],
        ['進階', window.trackingDefs || []],
        ['投籃分區', (window.shootingDefs || []).filter(d => d.id === 'ShotZones')],
        ['防守', (window.defenseDefs || []).filter(d => (window.GAME_DEFENSE_IDS || []).includes(d.id))],
    ];
    // 同一 key 只列一次（追蹤數據的 REB 與基本 REB 同一個值，重複會出現「籃板」「籃板數」兩項）
    const seenKeys = new Set();
    const GROUP_METRICS = GROUPS.map(([g, defs]) => [g, defs.filter(Boolean).flatMap(d => d.metrics)
        .filter(x => !(isTeam && x.playerOnly))   // 球隊沒有此欄
        .filter(x => !seenKeys.has(x.key) && seenKeys.add(x.key))]);
    const allMetrics = GROUP_METRICS.flatMap(([, ms]) => ms);
    const m = allMetrics.find(x => x.key === metric) || allMetrics[0];
    const ml = window.metricLabel(m);   // 平鋪清單／匯出用名稱（longLabel 優先）
    const pct = m.unit === '%';

    const withData = seasons.filter(s => (data[s] || []).length);
    const shown = withData.filter(s => !off.includes(s));
    const colorOf = s => PACE_COLORS[seasons.indexOf(s) % PACE_COLORS.length];
    const valuesOf = (games) => games.map((_, i) => {
        if (mode === 'game') return GA.metricOf([games[i]], null, 'TEAM', metric);
        if (mode === 'roll') return i < 9 ? null : GA.metricOf(games.slice(i - 9, i + 1), null, 'TEAM', metric);
        return GA.metricOf(games.slice(0, i + 1), null, 'TEAM', metric);
    });
    const series = useMemo(() => shown.map(s => ({
        key: s, label: s.slice(2), color: colorOf(s), values: valuesOf(data[s]),
        width: s === shown[0] ? 2.6 : 1.5, opacity: mode === 'game' && s !== shown[0] ? 0.5 : 0.85,
    })), [data, shown.join(), metric, mode]);
    const maxN = Math.max(0, ...shown.map(s => data[s].length));
    const xs = Array.from({ length: maxN }, (_, i) => String(i + 1));

    // 同期：以最新一季（有資料者）已出賽場數為 N
    const ref = withData[0];
    const N = ref ? data[ref].length : 0;
    const inProgress = ref === window.CURRENT_SEASON && phase.inSeason;
    const cumAt = (s, k) => GA.metricOf(data[s].slice(0, k), null, 'TEAM', metric);
    const rows = withData.map(s => {
        const g = data[s], k = Math.min(N, g.length);
        const w = g.slice(0, k).filter(x => x.wl === 'W').length;
        return { s, v: cumAt(s, k), final: cumAt(s, g.length), rec: `${w}-${k - w}`, n: k, total: g.length };
    });
    const refV = rows.length ? rows[0].v : null;
    const fv = v => typeof v === 'number' ? v.toFixed(1) + (pct ? '%' : '') : '—';
    const modeLabel = { cum: '累積季平均', roll: '近 10 場移動平均', game: '逐場' }[mode];
    const typeLabel = type === 'playoffs' ? '季後賽' : '例行賽';
    const subject = isTeam ? '灰狼全隊' : playerName;

    const fbText = () => [
        `【${subject}｜${typeLabel}前 ${N} 場${ml}・跨季同期比較】`,
        '',
        ...rows.map(r => `${r.s}｜前 ${r.n} 場 ${fv(r.v)}${r.s === ref ? '（最新）' : ''}｜${r.s === ref ? '' : `全季 ${fv(r.final)}｜`}戰績 ${r.rec}`),
        '',
        `${ml}${m.englishLabel ? `（${m.englishLabel}）` : ''}以 Σ 加權重算；${isTeam ? '球隊場次' : '球員出賽場次'}對齊`,
        '資料：NBA.com Stats 逐場',
        `${location.origin}${location.pathname}${location.hash}`,
    ].join('\n');
    const csv = () => ({ header: [isTeam ? '球隊第N場' : '出賽第N場', ...series.map(s => s.key)], rows: xs.map((x, i) => [x, ...series.map(s => s.values[i] == null ? '' : s.values[i])]) });

    return (
        <UI.Section title="賽季軌跡疊圖" en="Season Pace" accent="green"
            sub={`各季以「${isTeam ? '球隊第 N 場' : '出賽第 N 場'}」對齊，看今年打到這裡和往年同期比 · 百分比以 Σ命中 ÷ Σ出手 重算 · 只列有逐場資料的賽季`}
            right={<UI.ExportMenu title={`賽季軌跡：${subject} ${ml}（${typeLabel}・${modeLabel}）`} getNode={() => chartRef.current} csv={csv} text={fbText} />}>
            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                <label className="sr-only" htmlFor="pace-metric">指標</label>
                <select id="pace-metric" value={metric} onChange={e => setMetric(e.target.value)} className={UI.selectClass(true)}>
                    {GROUP_METRICS.map(([g, ms]) => (
                        <optgroup key={g} label={g}>
                            {ms.map(x => <option key={x.key} value={x.key}>{window.metricLabel(x)}{x.englishLabel ? ` · ${x.englishLabel}` : ''}</option>)}
                        </optgroup>
                    ))}
                </select>
                <UI.Seg ariaLabel="算法" size="sm" value={mode} onChange={setMode}
                    options={[{ value: 'cum', label: '累積季平均' }, { value: 'roll', label: '近 10 場' }, { value: 'game', label: '逐場' }]} />
            </div>
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-[11px] text-slate-500">賽季</span>
                {seasons.map(s => {
                    const has = (data[s] || []).length > 0, on = has && !off.includes(s);
                    return (
                        <button key={s} type="button" disabled={!has} aria-pressed={on}
                            title={has ? `${data[s].length} 場` : '這一季沒有逐場資料（尚未回補）'}
                            onClick={() => setOff(o => o.includes(s) ? o.filter(x => x !== s) : (shown.length > 1 ? [...o, s] : o))}
                            className={`inline-flex min-h-[24px] items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${!has ? 'border-white/10 text-slate-600 cursor-not-allowed' : on ? 'bg-white/[0.04] text-slate-100' : 'border-white/15 text-slate-500'}`}
                            style={on ? { borderColor: colorOf(s) } : undefined}>
                            <i className="inline-block h-[3px] w-3.5" style={{ background: has ? colorOf(s) : '#475569', opacity: on ? 1 : 0.35 }}></i>
                            {s}{s === window.CURRENT_SEASON && phase.inSeason ? '（進行中）' : ''}{!has ? ' · 無資料' : ''}
                        </button>
                    );
                })}
            </div>
            {loading ? <div className="py-10 text-center text-sm text-slate-500 animate-pulse">載入各季逐場資料中…</div>
                : !shown.length ? <UI.Note>{isTeam ? '' : `${playerName} `}這個賽別沒有任何一季的逐場資料</UI.Note>
                : (
                    <div ref={chartRef}>
                        <LineOverlay xs={xs} series={series} unit={pct ? '%' : ''} ariaLabel={`${ml} 賽季軌跡疊圖`}
                            marker={inProgress && N < maxN ? { index: N - 1, label: `今年第 ${N} 場` } : null} />
                        <div className="mt-4 overflow-x-auto border-t border-white/[0.08]">
                            <table className="w-full border-collapse text-[13px]">
                                <caption className="sr-only">同期比較</caption>
                                <thead><tr className="border-b border-white/15">
                                    {['賽季', `前 ${N} 場${ml}`, `與 ${ref ? ref.slice(2) : ''} 差`, '全季終值', `前 ${N} 場戰績`].map((h, i) => (
                                        <th key={i} scope="col" className={`px-3 py-2 font-mono text-[10px] font-normal text-slate-500 whitespace-nowrap ${i ? 'text-right' : 'text-left'}`}>{h}</th>
                                    ))}
                                </tr></thead>
                                <tbody>{rows.map(r => {
                                    const d = r.s === ref || typeof r.v !== 'number' || typeof refV !== 'number' ? null : refV - r.v;
                                    const better = d == null ? null : (d >= 0) === (m.betterIsLarger !== false);
                                    return (
                                        <tr key={r.s} className="border-b border-white/[0.06]">
                                            <th scope="row" className="px-3 py-2 text-left font-normal whitespace-nowrap">
                                                <i className="mr-2 inline-block h-[3px] w-3 align-middle" style={{ background: colorOf(r.s) }}></i>{r.s}
                                                {r.n < N && <span className="ml-1.5 font-mono text-[10px] text-slate-500">（該季只有 {r.n} 場）</span>}
                                            </th>
                                            <td className="px-3 py-2 text-right font-mono tabular-nums">{fv(r.v)}</td>
                                            <td className={`px-3 py-2 text-right font-mono tabular-nums ${d == null || m.neutral ? 'text-slate-500' : better ? 'text-[#12A150]' : 'text-[#EF4444]'}`}>
                                                {d == null ? '—' : `${ref.slice(2)} ${d >= 0 ? '+' : ''}${d.toFixed(1)}`}
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono tabular-nums">{r.s === ref && inProgress ? <span className="text-slate-500">進行中</span> : fv(r.final)}</td>
                                            <td className="px-3 py-2 text-right font-mono tabular-nums">{r.rec}</td>
                                        </tr>
                                    );
                                })}</tbody>
                            </table>
                        </div>
                        <p className="mt-2 text-[11px] text-slate-500">
                            滑鼠移到圖上看各季同一場次的數值 · 「差」以最新一季為基準，綠＝最新一季較好（依指標方向；次數類不標色）
                            {!isTeam && ' · 球員以「出賽第 N 場」對齊，缺席的比賽不算'}
                        </p>
                    </div>
                )}
        </UI.Section>
    );
};

window.LineOverlay = LineOverlay;
window.SeasonPaceChart = SeasonPaceChart;
