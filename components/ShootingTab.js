// 投籃分頁：讀 shotchart 逐球資料 → 距離區間/分區/出手方式卡片牆（期間 vs 全季）
//   + 受助攻卡（全季快照）+ 篩選熱圖 + 點卡片展開趨勢折線
// gameMeta：{date:{wl,matchup}}，供勝敗/主客篩選（出手本身只帶 gdate）
const ShootingTab = ({ playerId, teamMode, season, typeKey, playerName, seasonLabel, gameMeta }) => {
    const { useState, useEffect } = React;
    const TrendChart = window.TrendChart;
    const ShotChart = window.ShotChart;

    const [doc, setDoc] = useState(undefined); // undefined=載入中, null=無, {shots,assisted}
    const [period, setPeriod] = useState('all');
    const [monthKey, setMonthKey] = useState('');
    const [rangeStart, setRangeStart] = useState('');
    const [rangeEnd, setRangeEnd] = useState('');
    const [group, setGroup] = useState('dist');
    const [openKey, setOpenKey] = useState(null);
    const [gran, setGran] = useState('game');

    const idPart = teamMode ? 'TEAM' : playerId;

    useEffect(() => {
        if ((!playerId && !teamMode) || !season || !typeKey || !window.db || !window.firebaseModules) return;
        let cancelled = false;
        setDoc(undefined);
        (async () => {
            const cache = (window.__shootTabCache = window.__shootTabCache || {});
            const docId = `${idPart}_${season}_${typeKey}`;
            if (cache[docId] !== undefined) { if (!cancelled) setDoc(cache[docId]); return; }
            const { doc: docFn, getDoc } = window.firebaseModules;
            try {
                const snap = await getDoc(docFn(window.db, 'wolves_shotcharts', docId));
                let v = null;
                if (snap.exists()) {
                    const d = snap.data();
                    const at = d.actionTypes || [], gd = d.gameDates || [];
                    v = {
                        shots: (d.shots || []).map(s => ({ x: s.x, y: s.y, made: s.made, dist: s.dist, zone: s.zone, action: at[s.a], gdate: gd[s.g] })),
                        assisted: d.assisted || {},
                    };
                }
                cache[docId] = v;
                if (!cancelled) setDoc(v);
            } catch (e) { console.error('shooting doc fail', docId, e); if (!cancelled) setDoc(null); }
        })();
        return () => { cancelled = true; };
    }, [idPart, season, typeKey]);

    if (doc === undefined) return <div className="h-[160px] flex items-center justify-center text-slate-500 text-sm animate-pulse">載入投籃資料中...</div>;
    if (doc === null || !doc.shots.length) return <div className="px-4 py-6 rounded-lg text-sm border bg-slate-800/50 border-slate-700 text-slate-400 text-center">此賽季尚無逐球投籃資料（每週更新，且僅近幾季有）</div>;

    const allShots = doc.shots;
    const dates = [...new Set(allShots.map(s => s.gdate))].sort();
    const months = [...new Set(dates.map(d => d.slice(0, 7)))].sort();
    const meta = gameMeta || {};

    // 期間篩選
    let periodShots = allShots, periodLabel = '全季';
    if (period === 'month' && monthKey) { periodShots = allShots.filter(s => (s.gdate || '').slice(0, 7) === monthKey); periodLabel = monthKey; }
    else if (period === 'last5' || period === 'last10') { const n = period === 'last5' ? 5 : 10; const set = new Set(dates.slice(-n)); periodShots = allShots.filter(s => set.has(s.gdate)); periodLabel = `近 ${n} 場`; }
    else if (period === 'range') { periodShots = allShots.filter(s => (!rangeStart || s.gdate >= rangeStart) && (!rangeEnd || s.gdate <= rangeEnd)); periodLabel = `${rangeStart || '起'}~${rangeEnd || '訖'}`; }
    else if (period === 'W' || period === 'L') { periodShots = allShots.filter(s => (meta[s.gdate] || {}).wl === period); periodLabel = period === 'W' ? '勝場' : '敗場'; }
    else if (period === 'home') { periodShots = allShots.filter(s => ((meta[s.gdate] || {}).matchup || '').includes('vs.')); periodLabel = '主場'; }
    else if (period === 'away') { periodShots = allShots.filter(s => ((meta[s.gdate] || {}).matchup || '').includes('@')); periodLabel = '客場'; }

    // 分組定義
    const DIST_BINS = [[0, 4, '0-4 呎'], [5, 9, '5-9 呎'], [10, 14, '10-14 呎'], [15, 19, '15-19 呎'], [20, 24, '20-24 呎'], [25, 29, '25-29 呎'], [30, 999, '30 呎+']];
    const ZONE_DEFS = [
        ['RA', '禁區', z => z === 'Restricted Area'],
        ['PAINT', '油漆區', z => z === 'In The Paint (Non-RA)'],
        ['MID', '中距離', z => z === 'Mid-Range'],
        ['C3', '角落三分', z => z === 'Left Corner 3' || z === 'Right Corner 3'],
        ['AB3', '弧頂三分', z => z === 'Above the Break 3'],
    ];
    const topTypes = (() => {
        const cnt = {};
        allShots.forEach(s => { if (s.action) cnt[s.action] = (cnt[s.action] || 0) + 1; });
        return Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]).slice(0, 8);
    })();

    // FG% 計算：filterFn 套用於一組 shots
    const calc = (shots, fn) => { const f = shots.filter(fn); const m = f.filter(s => s.made === 1).length; return { fga: f.length, pct: f.length ? +(100 * m / f.length).toFixed(1) : null }; };

    // 目前分組的項目清單 [{key,label,fn}]
    const items = group === 'dist'
        ? DIST_BINS.map(([lo, hi, l]) => ({ key: `d${lo}`, label: l, fn: s => s.dist >= lo && s.dist <= hi }))
        : group === 'zone'
            ? ZONE_DEFS.map(([k, l, fn]) => ({ key: k, label: l, fn: s => fn(s.zone) }))
            : topTypes.map(t => ({ key: t, label: t, fn: s => s.action === t }));

    const periodTotal = periodShots.length;

    // 趨勢：某項目 FG% 依粒度（逐場/每週/每月）over 全季
    const weekKey = d => { const dt = new Date(d + 'T00:00:00'); const day = (dt.getDay() + 6) % 7; dt.setDate(dt.getDate() - day); return dt.toISOString().slice(0, 10); };
    const trendFor = (fn) => {
        const groups = {};
        allShots.filter(fn).forEach(s => {
            const k = gran === 'week' ? weekKey(s.gdate) : gran === 'month' ? (s.gdate || '').slice(0, 7) : s.gdate;
            (groups[k] = groups[k] || []).push(s);
        });
        return Object.keys(groups).sort().map(k => { const g = groups[k]; const m = g.filter(s => s.made === 1).length; return { label: k, value: g.length ? +(100 * m / g.length).toFixed(1) : 0 }; });
    };
    const openItem = items.find(it => it.key === openKey);
    const trendPts = openItem ? trendFor(openItem.fn) : [];
    const trendBaseline = openItem ? calc(allShots, openItem.fn).pct : null;

    const assisted = doc.assisted || {};
    const FilterBtn = ({ v, label }) => (
        <button onClick={() => setPeriod(v)} className={`px-2.5 py-1 text-xs rounded border transition-colors ${period === v ? 'bg-[#12A150] text-[#0C2340] border-[#12A150] font-bold' : 'border-slate-700 text-slate-400 hover:border-slate-500'}`}>{label}</button>
    );

    return (
        <div className="space-y-4">
            {/* 篩選列 */}
            <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800 space-y-2">
                <div className="flex flex-wrap items-center gap-1.5">
                    <FilterBtn v="all" label="全季" />
                    <FilterBtn v="W" label="勝場" /><FilterBtn v="L" label="敗場" />
                    <FilterBtn v="home" label="主場" /><FilterBtn v="away" label="客場" />
                    <FilterBtn v="last5" label="近5場" /><FilterBtn v="last10" label="近10場" />
                    <select value={period === 'month' ? monthKey : ''} onChange={e => { setPeriod('month'); setMonthKey(e.target.value); }}
                        className={`text-xs rounded border px-2 py-1 bg-slate-950 ${period === 'month' ? 'border-[#12A150] text-[#12A150]' : 'border-slate-700 text-slate-400'}`}>
                        <option value="">每月▾</option>
                        {months.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <FilterBtn v="range" label="自訂區間" />
                </div>
                {period === 'range' && (
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                        <input type="date" value={rangeStart} onChange={e => setRangeStart(e.target.value)} className="bg-slate-950 border border-slate-700 rounded px-2 py-1" />
                        <span>~</span>
                        <input type="date" value={rangeEnd} onChange={e => setRangeEnd(e.target.value)} className="bg-slate-950 border border-slate-700 rounded px-2 py-1" />
                    </div>
                )}
                <div className="flex items-center gap-1.5 pt-1 border-t border-slate-800">
                    <span className="text-[10px] text-slate-500">分組：</span>
                    {[['dist', '距離區間'], ['zone', '分區'], ['type', '出手方式']].map(([g, l]) => (
                        <button key={g} onClick={() => { setGroup(g); setOpenKey(null); }}
                            className={`px-2.5 py-1 text-xs rounded border ${group === g ? 'bg-[#236192] text-white border-[#236192] font-bold' : 'border-slate-700 text-slate-400 hover:border-slate-500'}`}>{l}</button>
                    ))}
                </div>
            </div>

            <div className="flex items-center justify-between text-sm">
                <span className="font-bold text-slate-200">{periodLabel} <span className="text-slate-500 font-normal">（{periodTotal} 出手，vs 全季 {allShots.length}）</span></span>
                <span className="text-[10px] text-slate-500">大字=命中率(vs 全季 綠/紅)，小字=出手數/佔比 · 點卡看趨勢</span>
            </div>

            {/* 卡片牆 */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {items.map(it => {
                    const p = calc(periodShots, it.fn), a = calc(allShots, it.fn);
                    const diff = (p.pct != null && a.pct != null) ? +(p.pct - a.pct).toFixed(1) : null;
                    const freq = periodTotal ? Math.round(100 * p.fga / periodTotal) : 0;
                    const open = openKey === it.key;
                    return (
                        <div key={it.key} onClick={() => setOpenKey(open ? null : it.key)}
                            className={`p-3 rounded-lg border cursor-pointer transition-colors ${open ? 'border-[#12A150] bg-[#12A150]/5' : 'border-slate-800 bg-slate-950/40 hover:border-slate-600'}`}>
                            <div className="text-[11px] text-slate-400 truncate" title={it.label}>{it.label}</div>
                            <div className="text-2xl font-bold font-mono">{p.pct != null ? p.pct + '%' : '—'}
                                {diff != null && diff !== 0 && <span className={`text-xs ml-1 ${diff > 0 ? 'text-[#12A150]' : 'text-red-400'}`}>{diff > 0 ? '▲' : '▼'}{Math.abs(diff)}</span>}
                            </div>
                            <div className="text-[10px] text-slate-500">{p.fga} 出手 · 佔 {freq}%</div>
                        </div>
                    );
                })}
            </div>

            {/* 趨勢折線 */}
            {openItem && TrendChart && (
                <div className="border border-slate-800 rounded-xl p-4 bg-slate-950/40">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className="text-xs font-bold text-slate-200">{openItem.label} 命中率趨勢</span>
                        <div className="flex gap-1">
                            {[['game', '逐場'], ['week', '每週'], ['month', '每月']].map(([g, l]) => (
                                <button key={g} onClick={() => setGran(g)} className={`px-2 py-0.5 text-[11px] rounded border ${gran === g ? 'bg-[#12A150] text-[#0C2340] border-[#12A150]' : 'border-slate-700 text-slate-400'}`}>{l}</button>
                            ))}
                        </div>
                    </div>
                    <TrendChart points={trendPts} baseline={trendBaseline} />
                </div>
            )}

            {/* 受助攻（全季快照，不隨篩選） */}
            {Object.keys(assisted).length > 0 && (
                <div className="border border-slate-800 rounded-xl p-4 bg-slate-900 border-l-4 border-l-[#236192]">
                    <h3 className="text-sm font-bold mb-3">受助攻比例 <span className="text-[10px] text-slate-500 font-normal">【全季】</span></h3>
                    <div className="grid grid-cols-3 gap-3 text-center">
                        {[['整體受助攻', 'PCT_AST_FGM'], ['2 分受助攻', 'PCT_AST_2PM'], ['3 分受助攻', 'PCT_AST_3PM']].map(([l, k]) => (
                            <div key={k} className="p-2 rounded border border-slate-800 bg-slate-950/40">
                                <div className="text-[11px] text-slate-400">{l}</div>
                                <div className="text-xl font-bold font-mono">{typeof assisted[k] === 'number' ? assisted[k] + '%' : '—'}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 篩選後熱圖 */}
            {ShotChart && (
                <ShotChart playerId={playerId} teamMode={teamMode} playerName={playerName} externalShots={periodShots} />
            )}
        </div>
    );
};

window.ShootingTab = ShootingTab;
