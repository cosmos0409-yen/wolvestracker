// 雷達圖面板：軸可自選（Playtype percentile + Tracking 百分比，皆 0-100）+ 疊加多序列 + 自選指標比較表
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
        ...PLAY.map(pt => ({ key: 'pt_' + pt, label: pt, pt, side: 'offensive' })),
        { key: 'DRIVE_PTS_PCT', label: '切入得分%', tk: 'DRIVE_PTS_PCT' },
        { key: 'DRIVE_FG_PCT', label: '切入命中率', tk: 'DRIVE_FG_PCT' },
        { key: 'CATCH_SHOOT_EFG_PCT', label: '接球 eFG%', tk: 'CATCH_SHOOT_EFG_PCT' },
        { key: 'CATCH_SHOOT_FG3_PCT', label: '接球三分%', tk: 'CATCH_SHOOT_FG3_PCT' },
        { key: 'PULL_UP_EFG_PCT', label: '急停 eFG%', tk: 'PULL_UP_EFG_PCT' },
        { key: 'REB_COL_PCT', label: '籃板掌握率', tk: 'REB_COL_PCT' },
    ] : [
        ...PLAY.filter(pt => pt !== 'Cut' && pt !== 'Misc').map(pt => ({ key: 'pt_' + pt, label: pt + ' 防守', pt, side: 'defensive' })),
        { key: 'REB_CONTEST_PCT', label: '競爭籃板率', tk: 'REB_CONTEST_PCT' },
    ];
    const catMap = Object.fromEntries(CATALOG.map(c => [c.key, c]));
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
        const row = { subject: c ? c.label : k, fullMark: 100 };
        series.forEach(s => { row[s.label] = getVal(c, s) || 0; });
        return row;
    });

    return (
        <div className="bg-slate-900/50 p-2 rounded-xl border border-slate-800 flex flex-col items-center">
            <div className="w-full flex justify-between items-center px-2 mt-1">
                <h3 className="text-slate-300 text-sm font-bold">{viewSide === 'offensive' ? '進攻雷達網' : '防守雷達網'}</h3>
                <button onClick={() => setEditing(e => !e)} className="text-[10px] px-2 py-0.5 rounded border border-slate-700 text-slate-400 hover:text-slate-200">⚙ 自訂軸</button>
            </div>

            {editing && (
                <div className="w-full p-2 mb-1 bg-slate-950/60 rounded border border-slate-800">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] text-slate-500">勾選 3~6 個軸（{axes.length}/6）</span>
                        <button onClick={resetAxes} className="text-[10px] text-[#236192] hover:underline">恢復預設</button>
                    </div>
                    <div className="flex flex-wrap gap-1 max-h-[140px] overflow-y-auto">
                        {CATALOG.map(c => {
                            const on = axes.includes(c.key);
                            return <button key={c.key} onClick={() => toggleAxis(c.key)}
                                className={`px-2 py-0.5 text-[10px] rounded border ${on ? 'bg-[#12A150] text-[#0C2340] border-[#12A150] font-bold' : 'border-slate-700 text-slate-400 hover:border-slate-500'}`}>{c.label}</button>;
                        })}
                    </div>
                </div>
            )}

            {RadarChart && ResponsiveContainer ? (
                <div className="w-full h-[240px] sm:h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="60%" data={radarData} margin={{ top: 18, right: 30, bottom: 18, left: 30 }}>
                            <PolarGrid stroke="#1e293b" />
                            <PolarAngleAxis dataKey="subject" tick={{ fill: '#cbd5e0', fontSize: 10 }} />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                            {series.map((s, i) => (
                                <Radar key={s.key} name={s.label} dataKey={s.label} stroke={s.color} fill={s.color}
                                    fillOpacity={i === 0 ? 0.35 : 0.15} strokeWidth={i === 0 ? 2 : 1.5} />
                            ))}
                            <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} itemStyle={{ color: 'white', fontWeight: 'bold' }} />
                        </RadarChart>
                    </ResponsiveContainer>
                </div>
            ) : <div className="w-full h-[240px] flex items-center justify-center text-slate-500 text-xs">雷達圖模組載入中...</div>}

            {series.length > 1 && (
                <div className="flex flex-wrap gap-x-3 gap-y-1 px-2 pb-1 justify-center">
                    {series.map(s => (
                        <div key={s.key} className="flex items-center gap-1 text-[10px] text-slate-300">
                            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: s.color }}></span>{s.label}
                        </div>
                    ))}
                </div>
            )}

            {/* 自選指標比較表（數值精確） */}
            {series.length > 1 && (
                <div className="w-full mt-1 overflow-x-auto">
                    <table className="w-full text-[11px]">
                        <thead className="text-slate-500">
                            <tr><th className="text-left px-2 py-1">指標</th>
                                {series.map(s => <th key={s.key} className="text-right px-2 py-1" style={{ color: s.color }}>{s.label.length > 6 ? s.label.slice(0, 6) : s.label}</th>)}</tr>
                        </thead>
                        <tbody>
                            {axes.map(k => { const c = catMap[k]; return (
                                <tr key={k} className="border-t border-slate-800">
                                    <td className="text-left px-2 py-1 text-slate-400">{c ? c.label : k}</td>
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
