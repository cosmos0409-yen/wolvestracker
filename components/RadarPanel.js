// 雷達圖面板：軸可自選（Playtype percentile + Tracking 百分比，皆 0-100）
// 兩種尺度語意不同（PR=聯盟百分位、%=原始數值），軸名一律帶 scale 標示，避免讀者把形狀當同一把尺+ 疊加多序列 + 自選指標比較表
// series：[{key,label,color,stats(synergy array),tracking(dict)}]；第一個為主序列
const RadarPanel = ({ series, viewSide }) => {
    const { useState } = React;
    const R = window.Recharts || {};
    const { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } = R;
    const PLAY = window.PlayTypesList || [];
    const loadPref = (k, f) => { try { const v = localStorage.getItem(k); return v == null ? f : JSON.parse(v); } catch (e) { return f; } };
    const savePref = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };

    // 指標目錄（依攻守）
    const CATALOG = viewSide === 'offensive' ? [
        ...PLAY.map(pt => ({ key: 'pt_' + pt, label: pt, scale: 'PR', pt, side: 'offensive' })),
        { key: 'DRIVE_PTS_PCT', label: '每百次切入得分', scale: '', tk: 'DRIVE_PTS_PCT' },  // 切入得分 ÷ 切入次數 × 100，不是百分比
        { key: 'DRIVE_FG_PCT', label: '切入命中率', scale: '%', tk: 'DRIVE_FG_PCT' },
        { key: 'CATCH_SHOOT_EFG_PCT', label: '接球跳投 eFG', scale: '%', tk: 'CATCH_SHOOT_EFG_PCT' },
        { key: 'CATCH_SHOOT_FG3_PCT', label: '接球跳投三分', scale: '%', tk: 'CATCH_SHOOT_FG3_PCT' },
        { key: 'PULL_UP_EFG_PCT', label: '急停跳投 eFG', scale: '%', tk: 'PULL_UP_EFG_PCT' },
        { key: 'REB_COL_PCT', label: '籃板機會轉換率', scale: '%', tk: 'REB_COL_PCT' },
    ] : [
        ...PLAY.filter(pt => pt !== 'Cut' && pt !== 'Misc').map(pt => ({ key: 'pt_' + pt, label: pt + ' 防守', scale: 'PR', pt, side: 'defensive' })),
        { key: 'REB_CONTEST_PCT', label: '競爭籃板率', scale: '%', tk: 'REB_CONTEST_PCT' },
    ];
    const catMap = Object.fromEntries(CATALOG.map(c => [c.key, c]));
    const axisName = c => c ? [c.label, c.scale].filter(Boolean).join(' ') : '';
    const DEFAULTS = viewSide === 'offensive'
        ? ['pt_Isolation', 'DRIVE_PTS_PCT', 'CATCH_SHOOT_EFG_PCT', 'pt_Transition', 'pt_PRBallHandler']
        : ['pt_Isolation', 'pt_Spotup', 'pt_PRBallHandler', 'REB_CONTEST_PCT'];

    const prefKey = `wt_radar_axes_${viewSide}`;
    const [axes, setAxes] = useState(() => {
        const saved = loadPref(prefKey, null);
        const valid = (saved || []).filter(k => catMap[k]);
        return valid.length >= 3 ? valid : DEFAULTS.filter(k => catMap[k]);
    });
    const [editing, setEditing] = useState(false);
    const chartRef = React.useRef(null);

    const getVal = (c, s) => {
        if (!c) return null;
        if (c.pt) { const it = (s.stats || []).find(x => x.playType === c.pt && (x.side || 'offensive') === c.side); return it ? it.percentile : null; }
        const v = (s.tracking || {})[c.tk]; return typeof v === 'number' ? v : null;
    };

    const toggleAxis = k => {
        setAxes(prev => {
            let next;
            if (prev.includes(k)) { if (prev.length <= 3) return prev; next = prev.filter(x => x !== k); }
            else { if (prev.length >= 6) return prev; next = [...prev, k]; }
            savePref(prefKey, next);
            return next;
        });
    };
    const resetAxes = () => { setAxes(DEFAULTS.filter(k => catMap[k])); savePref(prefKey, DEFAULTS); };

    const radarData = axes.map(k => {
        const c = catMap[k];
        const row = { subject: c ? axisName(c) : k, fullMark: 100 };
        series.forEach(s => { row[s.label] = getVal(c, s) || 0; });
        return row;
    });

    return (
        <div className="flex flex-col items-center border border-white/10 p-3">
            <div className="w-full flex justify-between items-center px-2 mt-1">
                <h3 className="text-[13px] font-medium text-slate-200">{viewSide === 'offensive' ? '進攻雷達網' : '防守雷達網'}</h3>
                <span className="flex items-center gap-2">
                <window.UI.ExportMenu title={viewSide === 'offensive' ? '進攻雷達' : '防守雷達'} getNode={() => chartRef.current}
                    csv={() => ({ header: ['軸', ...series.map(s => s.label)], rows: axes.map(k => { const c = catMap[k]; return [c ? axisName(c) : k, ...series.map(s => { const v = getVal(c, s); return v == null ? '' : v; })]; }) })} />
                <button onClick={() => setEditing(e => !e)} className="rounded-full border border-white/15 px-2.5 py-0.5 text-[11px] text-slate-400 hover:text-slate-100">自訂軸</button>
                </span>
            </div>

            {editing && (
                <div className="mb-1 w-full border border-white/10 p-2">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] text-slate-500">勾選 3~6 個軸（{axes.length}/6）</span>
                        <button onClick={resetAxes} className="text-[10px] text-[#236192] hover:underline">恢復預設</button>
                    </div>
                    <div className="flex flex-wrap gap-1 max-h-[140px] overflow-y-auto">
                        {CATALOG.map(c => {
                            const on = axes.includes(c.key);
                            return <button key={c.key} onClick={() => toggleAxis(c.key)}
                                className={`rounded-full border px-2.5 py-0.5 text-[11px] ${on ? 'border-[#12A150] bg-[#12A150]/10 text-slate-50' : 'border-white/15 text-slate-400 hover:border-white/30'}`}>{axisName(c)}</button>;
                        })}
                    </div>
                </div>
            )}

            <div ref={chartRef} className="w-full">
            {RadarChart && ResponsiveContainer ? (
                <div className="w-full h-[240px] sm:h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="60%" data={radarData} margin={{ top: 18, right: 30, bottom: 18, left: 30 }}>
                            <PolarGrid stroke="rgba(196, 206, 210, 0.16)" />
                            <PolarAngleAxis dataKey="subject" tick={{ fill: '#C4CED2', fontSize: 11 }} />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                            {series.map((s, i) => (
                                <Radar key={s.key} name={s.label} dataKey={s.label} stroke={s.color} fill={s.color} isAnimationActive={false}
                                    fillOpacity={i === 0 ? 0.35 : 0.15} strokeWidth={i === 0 ? 2 : 1.5} />
                            ))}
                            <Tooltip contentStyle={{ backgroundColor: '#0C1A2E', borderColor: 'rgba(255,255,255,0.15)', borderRadius: 0 }} itemStyle={{ color: '#F8FAFC' }} />
                        </RadarChart>
                    </ResponsiveContainer>
                </div>
            ) : <div className="w-full h-[240px] flex items-center justify-center text-slate-500 text-xs">雷達圖模組載入中...</div>}

            <p className="w-full px-2 pb-1 text-[10px] leading-relaxed text-slate-500">
                PR＝Synergy 聯盟百分位（0–100）；%＝原始百分比；未標示者為原始數值（如每百次切入得分）。不同尺度共用 0–100 軸，形狀只代表各軸相對位置，不同尺度的軸不能直接互比。
            </p>

            {series.length > 1 && (
                <div className="flex flex-wrap gap-x-3 gap-y-1 px-2 pb-1 justify-center">
                    {series.map(s => (
                        <div key={s.key} className="flex items-center gap-1 text-[10px] text-slate-300">
                            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: s.color }}></span>{s.label}
                        </div>
                    ))}
                </div>
            )}

            </div>

            {/* 自選指標比較表（數值精確） */}
            {series.length > 1 && (
                <div className="w-full mt-1 overflow-x-auto">
                    <table className="w-full text-[11px]">
                        <thead className="text-slate-500">
                            <tr><th className="text-left px-2 py-1">指標</th>
                                {/* shortLabel：呼叫端已備好的縮寫（如 24例@CHA）。截斷會吃掉 @XXX 球隊標示，故優先採用 */}
                                {series.map(s => <th key={s.key} className="text-right px-2 py-1" style={{ color: s.color }}>{s.shortLabel || (s.label.length > 6 ? s.label.slice(0, 6) : s.label)}</th>)}</tr>
                        </thead>
                        <tbody>
                            {axes.map(k => { const c = catMap[k]; return (
                                <tr key={k} className="border-t border-white/[0.08]">
                                    <td className="text-left px-2 py-1 text-slate-400">{c ? axisName(c) : k}</td>
                                    {series.map(s => { const v = getVal(c, s); return <td key={s.key} className="text-right px-2 py-1 font-mono text-slate-200">{v == null ? '—' : v}</td>; })}
                                </tr>
                            ); })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

window.RadarPanel = RadarPanel;
