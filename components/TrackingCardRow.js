// Tracking 卡片群組元件：群組標題（中文 + 小字原文）+ 細線數據表（UI.Ledger / StatCell）
// source: 資料在快照文件中的欄位名（'tracking' | 'shooting' | 'clutch' | 'defense'），供 HistoryModal 取數
// clickable=false（單場面板用）：不可點、無「走勢 →」提示
// actionLabel：右上角動作提示文字（Splits 用「點看趨勢」）
// naReason：整組指標對此球員不適用（跨隊）→ 標題掛 badge，每格顯示灰色「—」
// citeAsOf / citeNote：傳給 StatCell 組引用句（Splits 為期間、單場為場次）
// rankCats：給了就到 window.RankCtx 查聯盟名次（快照類別名或陣列，見 window.leagueRank）；只限全隊當季快照／全季格
// compareTags：[prev 標籤, current 標籤]（Splits 期間 vs 全季）→ 加入引用籃時存成前後比較「全季 → 近 5 場」
const TrackingCardRow = ({ title, category, metrics, current, prev, onClick, source = 'tracking', clickable = true, naReason = null, actionLabel = '走勢', citeAsOf = 'snap', citeNote, rankCats = null, compareTags = null }) => {
    if (!current) return null;
    const UI = window.UI;
    const [zh, en] = UI.splitTitle(title);
    return (
        <section onClick={clickable ? () => onClick({ type: 'tracking', id: category, source }) : undefined}
            className={`mb-6 last:mb-0 ${clickable ? 'group cursor-pointer' : ''}`}>
            <header className="flex items-baseline justify-between gap-3 mb-2">
                <h3 className="flex items-baseline gap-2 min-w-0">
                    <span className="text-[13px] font-medium text-slate-100 whitespace-nowrap">{zh}</span>
                    {en && <span className="font-mono text-[10px] text-slate-500 truncate">{en}</span>}
                    {naReason && (
                        <span className="px-1.5 py-0.5 text-[10px] font-normal border border-white/15 text-slate-400 cursor-help whitespace-nowrap"
                            title={naReason}>{window.NA_BADGE}</span>
                    )}
                </h3>
                {clickable && (
                    <span className="shrink-0 font-mono text-[10px] text-slate-500 group-hover:text-[#12A150] transition-colors">{actionLabel} →</span>
                )}
            </header>
            <UI.Ledger cols={UI.ledgerCols(metrics.length)}>
                {metrics.map((m, i) => (
                    <UI.StatCell key={i} label={m.label} en={m.englishLabel}
                        value={current[m.key]} prevValue={prev?.[m.key]}
                        unit={m.unit} betterIsLarger={m.betterIsLarger !== false}
                        naReason={naReason} gkey={m.key} citeAsOf={citeAsOf} citeNote={citeNote}
                        rank={rankCats ? window.leagueRank(rankCats, m.key) : null} neutral={!!m.neutral}
                        quote={compareTags && typeof prev?.[m.key] === 'number' && typeof current[m.key] === 'number'
                            ? { kind: 'compare', sep: '→', label: window.metricLabel(m), rank: null,
                                values: [{ tag: compareTags[0], value: prev[m.key], unit: m.unit }, { tag: compareTags[1], value: current[m.key], unit: m.unit }] }
                            : { label: window.metricLabel(m) }} />
                ))}
            </UI.Ledger>
        </section>
    );
};

window.TrackingCardRow = TrackingCardRow;
