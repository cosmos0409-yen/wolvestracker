// 跨季比較分頁：多選賽季 × 數據類別 → 並列各季終點值表格 + 點指標畫逐季折線
// seasons：可選賽季清單 [{key,label,short,order}]；loadSeason(key)→{team,player}（normalized）
const ComparisonTab = ({ viewMode, selectedPlayer, seasons, loadSeason }) => {
    const { useState, useEffect } = React;
    const trackingDefs = window.trackingDefs || [];
    const shootingDefs = window.shootingDefs || [];
    const defenseDefs = window.defenseDefs || [];
    const PLAY = window.PlayTypesList || [];
    const TrendChart = window.TrendChart;

    const [selected, setSelected] = useState([]);
    const [data, setData] = useState({});
    const [cat, setCat] = useState('base');
    const [openMetric, setOpenMetric] = useState(null);

    // 預設選最近兩季
    useEffect(() => {
        if (!selected.length && seasons.length) setSelected(seasons.slice(0, 2).map(s => s.key));
    }, [seasons]);

    // 載入選取賽季資料
    useEffect(() => {
        let cancelled = false;
        selected.forEach(async k => {
            if (data[k]) return;
            // loadSeason 會往上拋錯（呼叫端需區分「載入失敗」與「查無資料」），
            // 這裡必須接住，否則網路異常會變成 unhandled rejection 讓分頁卡在載入中。
            // 失敗時刻意「不寫入 data」：寫進去會讓 `if (data[k]) return` 永久命中，
            // 使用者再也不會重試，整欄卡在「—」直到重整頁面
            let v;
            try { v = await loadSeason(k); }
            catch (e) { console.error('comparison season load fail', k, e); return; }
            if (!cancelled) setData(prev => prev[k] ? prev : { ...prev, [k]: v || { team: null, player: null } });
        });
        return () => { cancelled = true; };
    }, [selected]);

    const flat = defs => defs.reduce((a, d) => a.concat(d.metrics.map(m => ({ k: m.key, l: m.label, pct: m.unit === '%' }))), []);
    const CATS = {
        base: { label: '基本', metrics: [
            { k: 'PTS', l: '得分' }, { k: 'REB', l: '籃板' }, { k: 'AST', l: '助攻' },
            { k: 'FG_PCT', l: 'FG%', pct: true }, { k: 'FG3_PCT', l: '3P%', pct: true }, { k: 'FT_PCT', l: 'FT%', pct: true },
            { k: 'STL', l: '抄截' }, { k: 'BLK', l: '阻攻' }, { k: 'TOV', l: '失誤' }, { k: 'PLUS_MINUS', l: '+/-' },
        ] },
        playtype: { label: 'Playtype', metrics: PLAY.map(t => ({ k: t, l: t, playtype: true })) },
        tracking: { label: '進階', metrics: flat(trackingDefs) },
        shooting: { label: '投籃', metrics: ((shootingDefs.find(d => d.id === 'ShotZones') || {}).metrics || []).map(m => ({ k: m.key, l: m.label, pct: true })) },
        defense: { label: '防守', metrics: flat(defenseDefs) },
        onoff: { label: 'On/Off', playerOnly: true, metrics: [
            { k: 'ON_NET_RATING', l: '在場淨效率' }, { k: 'OFF_NET_RATING', l: '不在場淨效率' },
            { k: 'ON_OFF_RATING', l: '在場進攻' }, { k: 'ON_DEF_RATING', l: '在場防守' },
        ] },
    };
    const catKeys = Object.keys(CATS).filter(c => !(CATS[c].playerOnly && viewMode === 'TEAM'));
    const activeCat = catKeys.includes(cat) ? cat : 'base';
    const metrics = CATS[activeCat].metrics;

    // 選取的賽季（依 order 排序，供折線 X 軸）
    const cols = seasons.filter(s => selected.includes(s.key)).sort((a, b) => a.order - b.order);

    const getVal = (key, m) => {
        const sd = data[key];
        if (!sd) return null;
        if (m.playtype) {
            const arr = viewMode === 'TEAM' ? (sd.team && sd.team.stats) : (sd.player && sd.player.stats && sd.player.stats[selectedPlayer]);
            const it = (arr || []).find(s => s.playType === m.k && (s.side || 'offensive') === 'offensive');
            return it ? it.ppp : null;
        }
        const dict = viewMode === 'TEAM'
            ? (sd.team && sd.team[activeCat])
            : (sd.player && sd.player[activeCat] && sd.player[activeCat][selectedPlayer]);
        const v = dict && dict[m.k];
        return typeof v === 'number' ? v : null;
    };

    const fmt = (v, m) => v == null ? '—' : (m.pct ? v + '%' : (m.playtype ? v.toFixed(2) : v));
    const toggle = k => setSelected(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]);

    const trendPts = openMetric ? cols.map(c => ({ label: c.short || c.label, value: getVal(c.key, openMetric) })).filter(p => typeof p.value === 'number') : [];

    return (
        <div className="space-y-4">
            {/* 賽季多選 */}
            <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800 space-y-2">
                <div className="text-[10px] text-slate-500">選擇賽季比較（{viewMode === 'PLAYER' ? selectedPlayer : '球隊'}）</div>
                <div className="flex flex-wrap gap-1.5">
                    {seasons.map(s => (
                        <button key={s.key} onClick={() => toggle(s.key)}
                            className={`px-2.5 py-1 text-xs rounded border transition-colors ${selected.includes(s.key) ? 'bg-[#236192] text-white border-[#236192] font-bold' : 'border-slate-700 text-slate-400 hover:border-slate-500'}`}>
                            {s.label}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-1.5 pt-1 border-t border-slate-800">
                    <span className="text-[10px] text-slate-500">類別：</span>
                    {catKeys.map(c => (
                        <button key={c} onClick={() => { setCat(c); setOpenMetric(null); }}
                            className={`px-2.5 py-1 text-xs rounded border ${activeCat === c ? 'bg-[#12A150] text-[#0C2340] border-[#12A150] font-bold' : 'border-slate-700 text-slate-400 hover:border-slate-500'}`}>{CATS[c].label}</button>
                    ))}
                </div>
            </div>

            {cols.length === 0 ? (
                <div className="px-4 py-6 text-center text-slate-500 text-sm">請選擇至少一個賽季</div>
            ) : (
                <>
                    {/* 折線（點指標展開） */}
                    {openMetric && TrendChart && trendPts.length > 0 && (
                        <div className="border border-slate-800 rounded-xl p-4 bg-slate-950/40">
                            <div className="text-xs font-bold text-slate-200 mb-3">{openMetric.l} 逐季變化</div>
                            <TrendChart points={trendPts} baseline={null} />
                        </div>
                    )}
                    {/* 比較表 */}
                    <div className="border border-slate-800 rounded-xl overflow-x-auto bg-slate-900">
                        <table className="w-full text-sm">
                            <thead className="bg-[#1e293b] text-xs font-bold text-slate-400">
                                <tr>
                                    <th className="px-4 py-3 text-left sticky left-0 bg-[#1e293b]">指標</th>
                                    {cols.map(c => <th key={c.key} className="px-3 py-3 text-right whitespace-nowrap">{c.short || c.label}</th>)}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {metrics.map(m => {
                                    const open = openMetric && openMetric.k === m.k;
                                    return (
                                        <tr key={m.k} onClick={() => setOpenMetric(open ? null : m)}
                                            className={`cursor-pointer transition-colors ${open ? 'bg-[#12A150]/10' : 'hover:bg-slate-800/60'}`}>
                                            <td className="px-4 py-2.5 text-slate-300 sticky left-0 bg-slate-900">{m.l} <span className="text-slate-600 text-[10px]">▸</span></td>
                                            {cols.map(c => <td key={c.key} className="px-3 py-2.5 text-right font-mono text-slate-200">{fmt(getVal(c.key, m), m)}</td>)}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <p className="text-[10px] text-slate-500">點指標列 → 上方逐季折線。缺欄位（—）表示該季無此類別資料。</p>
                </>
            )}
        </div>
    );
};

window.ComparisonTab = ComparisonTab;
