// 通用指標展示元件：TrendValue / SimpleLineChart / SimpleMetricCard

const TrendValue = ({ value, prevValue, unit = "", label, reverseColor = false }) => {
    const diff = prevValue ? (value - prevValue).toFixed(1) : 0;
    const numDiff = parseFloat(diff);
    let colorClass = "text-white"; let Icon = null;
    if (prevValue) {
        if (numDiff > 0) { colorClass = reverseColor ? "text-red-400" : "text-green-400"; Icon = window.Icons.ArrowUp; }
        else if (numDiff < 0) { colorClass = reverseColor ? "text-green-400" : "text-red-400"; Icon = window.Icons.ArrowDown; }
        else { colorClass = "text-slate-400"; Icon = window.Icons.Minus; }
    }
    return (<div><span className="block text-slate-500">{label}</span><div className="flex items-center gap-1"><span className={`font-mono text-sm font-bold ${colorClass}`}>{value}{unit}</span>{Icon && <Icon className={`w-3 h-3 ${colorClass}`} />}</div></div>);
};

const SimpleLineChart = ({ data, dataKey, color = "#12A150", xLabels = null, valueGetter = null }) => {
    if (!data || data.length < 2) return <div className="h-40 flex items-center justify-center text-slate-500 text-xs">數據不足，無法繪製趨勢圖</div>;
    const height = 150; const width = 500; const padding = 20; const paddingLeft = 40;
    const values = data.map(d => parseFloat(valueGetter ? valueGetter(d) : (d.stat?.[dataKey] ?? d.tracking?.[dataKey] ?? 0)));
    const min = Math.min(...values); const max = Math.max(...values);
    const range = max - min || 1; const buffer = range * 0.1;
    const domainMin = min - buffer; const domainMax = max + buffer; const domainRange = domainMax - domainMin;
    const points = values.map((val, index) => { const x = paddingLeft + (index / (values.length - 1)) * (width - paddingLeft - padding); const y = height - padding - ((val - domainMin) / domainRange) * (height - 2 * padding); return `${x},${y}`; }).join(' ');
    const ticks = []; const numTicks = 5; for (let i = 0; i < numTicks; i++) { const val = domainMin + (domainRange * i) / (numTicks - 1); const y = height - padding - (i / (numTicks - 1)) * (height - 2 * padding); ticks.push({ val, y }); }
    return (<div className="w-full overflow-hidden mb-4 bg-slate-900/50 rounded-lg p-2 border border-slate-800"><svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">{ticks.map((tick, i) => (<g key={i}><line x1={paddingLeft} y1={tick.y} x2={width - padding} y2={tick.y} stroke="#1e293b" strokeWidth="1" strokeDasharray="4" opacity="0.6" /><text x={paddingLeft - 5} y={tick.y + 3} textAnchor="end" fill="#64748b" fontSize="10" fontFamily="monospace">{tick.val?.toFixed(2) || 0}</text></g>))}<polyline fill="none" stroke={color} strokeWidth="3" points={points} />{values.map((val, index) => { const x = paddingLeft + (index / (values.length - 1)) * (width - paddingLeft - padding); const y = height - padding - ((val - domainMin) / domainRange) * (height - 2 * padding); return (<g key={index} className="group"><circle cx={x} cy={y} r="4" fill="#0f172a" stroke={color} strokeWidth="2" className="chart-dot transition-all duration-200" /><rect x={x - 15} y={y - 25} width="30" height="16" rx="4" fill="#000" className="opacity-0 group-hover:opacity-100 transition-opacity" /><text x={x} y={y - 13} textAnchor="middle" fill="white" fontSize="10" className="opacity-0 group-hover:opacity-100 transition-opacity font-mono font-bold pointer-events-none">{val}</text><text x={x} y={height - 5} textAnchor="middle" fill="#64748b" fontSize="9">{xLabels ? xLabels[index] : data[index].date.slice(5).replace('-', '/')}</text></g>); })}</svg></div>);
};

const SimpleMetricCard = ({ title, englishLabel, value, prevValue, unit = "", betterIsLarger = true, icon = null }) => {
    const diff = prevValue != null ? (value - prevValue).toFixed(1) : 0;
    const numDiff = parseFloat(diff);
    let isBetter = false, isWorse = false;
    if (numDiff > 0) { isBetter = betterIsLarger; isWorse = !betterIsLarger; }
    else if (numDiff < 0) { isWorse = betterIsLarger; isBetter = !betterIsLarger; }

    return (
        <div className="p-3 bg-slate-800 rounded border border-slate-700 relative">
            <p className="text-[#a0aec0] text-xs font-medium truncate" title={title}>{title}</p>
            {englishLabel && <p className="text-slate-500 text-[10px] font-mono mb-1 truncate" title={englishLabel}>{englishLabel}</p>}
            <div className="flex items-end gap-2">
                <span className="text-xl font-bold text-white">{value}{unit}</span>
                {prevValue != null && numDiff !== 0 && (
                    <span className={`text-[10px] font-bold flex items-center pb-1 ${isBetter ? 'text-green-400' : isWorse ? 'text-red-400' : 'text-slate-500'}`}>
                        {numDiff > 0 ? <window.Icons.ArrowUp className="w-2.5 h-2.5" /> : <window.Icons.ArrowDown className="w-2.5 h-2.5" />}
                        {Math.abs(numDiff)}{unit}
                    </span>
                )}
            </div>
        </div>
    );
};

// 多指標折線圖：每個指標獨立歸一到 0–100，呈現相對走勢
const MultiLineChart = ({ data, metrics, xLabels = null }) => {
    if (!data || data.length < 2 || !metrics || metrics.length === 0) {
        return <div className="h-40 flex items-center justify-center text-slate-500 text-xs">資料不足</div>;
    }
    const height = 180, width = 500, padding = 20, paddingLeft = 40;
    const COLORS = ['#12A150', '#60a5fa', '#f59e0b', '#ec4899', '#a78bfa'];
    const seriesList = metrics.map((m, i) => {
        const values = data.map(d => parseFloat(d.stat?.[m.key] ?? d.tracking?.[m.key] ?? 0));
        const min = Math.min(...values), max = Math.max(...values);
        const range = max - min || 1;
        return {
            ...m,
            color: m.color || COLORS[i % COLORS.length],
            values, min, max,
            normalized: values.map(v => ((v - min) / range) * 100),
        };
    });
    const pts = (norm) => norm.map((v, i) => {
        const x = paddingLeft + (i / (norm.length - 1)) * (width - paddingLeft - padding);
        const y = height - padding - (v / 100) * (height - 2 * padding);
        return `${x},${y}`;
    }).join(' ');
    return (
        <div className="w-full overflow-hidden mb-2 bg-slate-900/50 rounded-lg p-2 border border-slate-800">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
                {[0, 25, 50, 75, 100].map(v => {
                    const y = height - padding - (v / 100) * (height - 2 * padding);
                    return <line key={v} x1={paddingLeft} y1={y} x2={width - padding} y2={y} stroke="#1e293b" strokeWidth="1" strokeDasharray="4" opacity="0.6" />;
                })}
                {seriesList.map(s => (
                    <g key={s.key}>
                        <polyline fill="none" stroke={s.color} strokeWidth="2" points={pts(s.normalized)} />
                        {s.values.map((val, i) => {
                            const x = paddingLeft + (i / (s.values.length - 1)) * (width - paddingLeft - padding);
                            const y = height - padding - (s.normalized[i] / 100) * (height - 2 * padding);
                            return (
                                <g key={i} className="group">
                                    <circle cx={x} cy={y} r="3" fill="#0f172a" stroke={s.color} strokeWidth="2" className="chart-dot" />
                                    <title>{`${s.label}: ${val}`}</title>
                                </g>
                            );
                        })}
                    </g>
                ))}
                {data.map((d, i) => {
                    const x = paddingLeft + (i / (data.length - 1)) * (width - paddingLeft - padding);
                    const label = xLabels ? xLabels[i] : (d.date ? d.date.slice(5).replace('-', '/') : '');
                    return <text key={i} x={x} y={height - 5} textAnchor="middle" fill="#64748b" fontSize="9">{label}</text>;
                })}
            </svg>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 px-2">
                {seriesList.map(s => (
                    <div key={s.key} className="flex items-center gap-1.5 text-[11px] text-slate-300">
                        <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: s.color }}></span>
                        <span>{s.label}</span>
                        <span className="text-slate-500 font-mono text-[10px]">({s.min.toFixed(1)}–{s.max.toFixed(1)})</span>
                    </div>
                ))}
            </div>
            <p className="text-[10px] text-slate-500 mt-1 px-2">* 各指標獨立歸一 0–100 呈現相對走勢；括號為實際區間</p>
        </div>
    );
};

window.TrendValue = TrendValue;
window.SimpleLineChart = SimpleLineChart;
window.SimpleMetricCard = SimpleMetricCard;
window.MultiLineChart = MultiLineChart;
