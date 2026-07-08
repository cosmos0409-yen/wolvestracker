// 總覽分頁：季平均摘要卡（優先用 bundle 逐場算「截至該日」總計，退回快照 base）
//   + On/Off（球員）+ Clutch + Lineups（球隊）+ 單場面板
// games：逐場 bundle（每場 {stats}）；untilDate：截至日期；base：快照 base（bundle 缺時退回，如更早無 games 的歷史季）
const OverviewTab = ({ viewMode, selectedPlayer, games, untilDate, base, snapshotClutch, snapshotOnoff, lineups, gamesIndex, seasonLabel }) => {
    const GA = window.GameAgg;
    const clutchDefs = window.clutchDefs || [];
    const TrackingCardRow = window.TrackingCardRow;
    const SingleGamePanel = window.SingleGamePanel;

    // 摘要卡欄位（NBA.com traditional 主體）
    const SUMMARY = [
        { key: 'PTS', label: '得分', en: 'PPG' },
        { key: 'REB', label: '籃板', en: 'RPG' },
        { key: 'AST', label: '助攻', en: 'APG' },
        { key: 'STL', label: '抄截', en: 'SPG' },
        { key: 'BLK', label: '阻攻', en: 'BPG' },
        { key: 'FG_PCT', label: '命中率', en: 'FG%', pct: true },
        { key: 'FG3_PCT', label: '三分%', en: '3P%', pct: true },
        { key: 'FT_PCT', label: '罰球%', en: 'FT%', pct: true },
        { key: 'TOV', label: '失誤', en: 'TOV' },
        { key: 'PLUS_MINUS', label: '正負值', en: '+/-', plus: true },
    ];

    // 優先用 bundle 逐場算（截至該日，任何日期皆穩定）；bundle 未載入或無資料則退回快照 base
    const bundleAgg = (games && games.length) ? GA.seasonToDate(games, untilDate, null, 'TEAM') : null;
    const baseAgg = (base && typeof base.GP === 'number' && base.GP > 0) ? base : null;
    const agg = (bundleAgg && bundleAgg.GP > 0) ? bundleAgg : baseAgg;
    const loadingAvg = games === null && !baseAgg;

    // On/Off（球員快照）
    const onoff = viewMode === 'PLAYER' ? (snapshotOnoff || {}) : null;
    const hasOnoff = onoff && typeof onoff.ON_NET_RATING === 'number';

    // Clutch 卡（快照，無資料整卡隱藏）
    const clutchEntity = snapshotClutch || {};
    const hasClutch = clutchDefs[0] && clutchDefs[0].metrics.some(m => clutchEntity[m.key] !== undefined);

    const fmt = (v, s) => {
        if (typeof v !== 'number') return '—';
        if (s.pct) return v.toFixed(1) + '%';
        if (s.plus) return (v > 0 ? '+' : '') + v.toFixed(1);
        return v.toFixed(1);
    };

    return (
        <div className="space-y-6">
            {/* 季平均摘要 */}
            <div className="border border-slate-800 rounded-xl p-6 bg-slate-900 border-l-4 border-l-[#12A150]">
                <div className="flex flex-wrap justify-between items-center border-b-2 border-[#C4CED2]/30 pb-2 mb-4 gap-2">
                    <h2 className="text-xl font-bold">季平均 {agg ? `(${agg.GP} 場${(agg.W || agg.L) ? ` · ${agg.W}勝${agg.L}敗` : ''})` : ''}</h2>
                    <span className="text-[10px] text-slate-500">{seasonLabel || ''}{untilDate ? ` 截至 ${untilDate}` : ' 整季'}</span>
                </div>
                {!agg ? (
                    <div className={`h-[80px] flex items-center justify-center text-slate-500 text-sm ${loadingAvg ? 'animate-pulse' : ''}`}>
                        {loadingAvg ? '載入季平均中...' : '此賽季尚無季平均資料'}
                    </div>
                ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                        {SUMMARY.map(s => (
                            <div key={s.key} className="p-3 rounded-lg border border-slate-800 bg-slate-950/40">
                                <div className="text-[11px] text-slate-400">{s.label} <span className="text-slate-600">{s.en}</span></div>
                                <div className={`text-2xl font-bold font-mono ${s.plus && typeof agg[s.key] === 'number' ? (agg[s.key] > 0 ? 'text-[#12A150]' : agg[s.key] < 0 ? 'text-red-400' : '') : ''}`}>
                                    {fmt(agg[s.key], s)}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* On/Off Court（球員） */}
            {hasOnoff && (
                <div className="border border-slate-800 rounded-xl p-6 bg-slate-900 border-l-4 border-l-[#236192]">
                    <h2 className="text-xl font-bold border-b-2 border-[#C4CED2]/30 pb-2 mb-4">在場 / 不在場 (On/Off Court)</h2>
                    <div className="grid grid-cols-3 gap-3 text-center">
                        {[
                            { label: '進攻效率', on: onoff.ON_OFF_RATING, off: onoff.OFF_OFF_RATING, better: 'high' },
                            { label: '防守效率', on: onoff.ON_DEF_RATING, off: onoff.OFF_DEF_RATING, better: 'low' },
                            { label: '淨效率', on: onoff.ON_NET_RATING, off: onoff.OFF_NET_RATING, better: 'high' },
                        ].map(m => {
                            const diff = (typeof m.on === 'number' && typeof m.off === 'number') ? m.on - m.off : null;
                            const good = diff != null && (m.better === 'high' ? diff > 0 : diff < 0);
                            return (
                                <div key={m.label} className="p-3 rounded-lg border border-slate-800 bg-slate-950/40">
                                    <div className="text-[11px] text-slate-400 mb-1">{m.label}</div>
                                    <div className="flex justify-center gap-2 text-sm font-mono">
                                        <span className="text-[#12A150]">在 {typeof m.on === 'number' ? m.on.toFixed(1) : '—'}</span>
                                        <span className="text-slate-600">/</span>
                                        <span className="text-slate-400">離 {typeof m.off === 'number' ? m.off.toFixed(1) : '—'}</span>
                                    </div>
                                    {diff != null && (
                                        <div className={`text-xs font-bold mt-1 ${good ? 'text-[#12A150]' : 'text-red-400'}`}>
                                            {diff > 0 ? '+' : ''}{diff.toFixed(1)}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-2">球隊在該球員上/下場時的每 100 回合效率（整季快照）</p>
                </div>
            )}

            {/* Clutch（快照） */}
            {hasClutch && (
                <div className="border border-slate-800 rounded-xl p-6 bg-slate-900 border-l-4 border-l-amber-500">
                    <h2 className="text-xl font-bold border-b-2 border-[#C4CED2]/30 pb-2 mb-4">關鍵時刻 (Clutch)</h2>
                    {clutchDefs.map(def => (
                        <TrackingCardRow key={def.id} title={def.title} category={def.id} source="clutch"
                            metrics={def.metrics} current={clutchEntity} prev={null} clickable={false} />
                    ))}
                    <p className="text-[10px] text-slate-500 mt-1">整季快照（最後 5 分鐘分差 5 分內）</p>
                </div>
            )}

            {/* Lineups（球隊） */}
            {viewMode === 'TEAM' && lineups && lineups.length > 0 && (
                <div className="border border-slate-800 rounded-xl p-6 bg-slate-900 border-l-4 border-l-[#236192]">
                    <h2 className="text-xl font-bold border-b-2 border-[#C4CED2]/30 pb-2 mb-4">五人陣容 (Lineups)</h2>
                    <p className="text-xs text-slate-500 mb-3">依上場時間排序（進階效率為每 100 回合，整季快照）</p>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-400">
                            <thead className="bg-[#1e293b] text-xs font-bold text-slate-400">
                                <tr>
                                    <th className="px-4 py-3">陣容</th><th className="px-3 py-3 text-right">場次</th>
                                    <th className="px-3 py-3 text-right">分鐘</th><th className="px-3 py-3 text-right">進攻</th>
                                    <th className="px-3 py-3 text-right">防守</th><th className="px-3 py-3 text-right">淨效率</th>
                                    <th className="px-3 py-3 text-right">TS%</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {lineups.map((lu, i) => (
                                    <tr key={i} className="hover:bg-slate-800/70 transition-colors">
                                        <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{lu.players}</td>
                                        <td className="px-3 py-3 text-right font-mono">{lu.GP}</td>
                                        <td className="px-3 py-3 text-right font-mono">{lu.MIN}</td>
                                        <td className="px-3 py-3 text-right font-mono">{lu.OFF_RATING}</td>
                                        <td className="px-3 py-3 text-right font-mono">{lu.DEF_RATING}</td>
                                        <td className={`px-3 py-3 text-right font-mono font-bold ${lu.NET_RATING > 0 ? 'text-[#12A150]' : lu.NET_RATING < 0 ? 'text-red-400' : ''}`}>
                                            {lu.NET_RATING > 0 ? '+' : ''}{lu.NET_RATING}
                                        </td>
                                        <td className="px-3 py-3 text-right font-mono">{lu.TS_PCT}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* 單場面板（當季，有比賽索引才顯示） */}
            {SingleGamePanel && gamesIndex && gamesIndex.length > 0 && (
                <SingleGamePanel viewMode={viewMode} playerName={selectedPlayer} viewSide="offensive" gamesIndex={gamesIndex} />
            )}
        </div>
    );
};

window.OverviewTab = OverviewTab;
