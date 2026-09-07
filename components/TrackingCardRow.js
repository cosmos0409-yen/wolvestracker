// Tracking 卡片群組元件
// source: 資料在快照文件中的欄位名（'tracking' | 'shooting' | 'clutch' | 'defense'），供 HistoryModal 取數
// clickable=false（單場面板用）：不可點、無 hover/外連圖示
// naReason：整組指標對此球員不適用（跨隊）→ 卡頭掛 badge，每張卡顯示灰色「—」
const TrackingCardRow = ({ title, category, metrics, current, prev, onClick, source = 'tracking', clickable = true, naReason = null }) => {
    if (!current) return null;
    const Icons = window.Icons;
    return (
        <div onClick={clickable ? () => onClick({ type: 'tracking', id: category, source }) : undefined}
            className={`bg-[#1a202c] border border-slate-800 rounded-xl overflow-hidden transition-colors mb-4 ${clickable ? 'cursor-pointer hover:border-slate-600 group' : ''}`}>
            <div className="bg-slate-900/80 px-4 py-2 border-b border-slate-800 flex justify-between items-center text-sm font-bold text-[#cbd5e0]">
                <span className="flex items-center gap-2">
                    {title}
                    {naReason && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-normal bg-slate-800 border border-slate-700 text-slate-400 cursor-help"
                            title={naReason}>{window.NA_BADGE}</span>
                    )}
                </span>
                {clickable && <Icons.ExternalLink className="w-3 h-3 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />}
            </div>
            <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                {metrics.map((m, i) => (
                    <window.SimpleMetricCard
                        key={i} title={m.label} englishLabel={m.englishLabel}
                        value={current[m.key]} prevValue={prev?.[m.key]}
                        unit={m.unit} betterIsLarger={m.betterIsLarger !== false}
                        naReason={naReason}
                    />
                ))}
            </div>
        </div>
    );
};

window.TrackingCardRow = TrackingCardRow;
