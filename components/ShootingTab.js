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
    const shootLedgerRef = React.useRef(null);   // 匯出命中率格用（hook 須在提早 return 之前）

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

    const UI = window.UI;
    if (doc === undefined) return <div className="py-10 text-center text-sm text-slate-500 animate-pulse">載入投籃資料中…</div>;
    if (doc === null || !doc.shots.length) return <UI.Note>此賽季尚無逐球投籃資料（每週更新，且僅近幾季有）</UI.Note>;

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
        ['RA', '合理衝撞區', z => z === 'Restricted Area', 'Restricted Area'],
        ['PAINT', '禁區（非 RA）', z => z === 'In The Paint (Non-RA)', 'In The Paint (Non-RA)'],
        ['MID', '中距離', z => z === 'Mid-Range', 'Mid-Range'],
        ['C3', '底角三分', z => z === 'Left Corner 3' || z === 'Right Corner 3', 'Corner 3'],
        ['AB3', '非底角三分', z => z === 'Above the Break 3', 'Above the Break 3'],
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
            ? ZONE_DEFS.map(([k, l, fn, en]) => ({ key: k, label: l, en, fn: s => fn(s.zone) }))
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
        // 逐場的點帶 wl（gameMeta）→ 走勢鋪勝負底色
        return Object.keys(groups).sort().map(k => { const g = groups[k]; const m = g.filter(s => s.made === 1).length; const wl = gran === 'game' ? (meta[k] || {}).wl : null;
            return { label: k, value: g.length ? +(100 * m / g.length).toFixed(1) : 0, ...(wl ? { wl } : {}) }; });
    };
    const openItem = items.find(it => it.key === openKey);
    const trendPts = openItem ? trendFor(openItem.fn) : [];
    const trendBaseline = openItem ? calc(allShots, openItem.fn).pct : null;

    const assisted = doc.assisted || {};
    const GROUPS = [['dist', '距離區間', 'Distance'], ['zone', '分區', 'Zone'], ['type', '出手方式', 'Shot Type']];
    const groupInfo = GROUPS.find(g => g[0] === group) || GROUPS[0];

    return (
        <div className="space-y-10">
            {/* 篩選列：期間（影響命中率格與熱圖；受助攻為全季快照不受影響） */}
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
                    <label className="sr-only" htmlFor="shoot-month">選擇月份</label>
                    <select id="shoot-month" value={period === 'month' ? monthKey : ''} onChange={e => { setPeriod('month'); setMonthKey(e.target.value); }}
                        className={UI.selectClass(period === 'month')}>
                        <option value="">每月</option>
                        {months.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <UI.Chip active={period === 'range'} onClick={() => setPeriod('range')}>自訂區間</UI.Chip>
                </div>
                {period === 'range' && (
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                        <input type="date" aria-label="起始日" value={rangeStart} onChange={e => setRangeStart(e.target.value)} className={UI.selectClass(!!rangeStart)} />
                        <span>~</span>
                        <input type="date" aria-label="結束日" value={rangeEnd} onChange={e => setRangeEnd(e.target.value)} className={UI.selectClass(!!rangeEnd)} />
                    </div>
                )}
            </div>

            <UI.Section title={`${groupInfo[1]}命中率`} en={`FG% by ${groupInfo[2]}`} accent="green"
                sub={`${periodLabel}（${periodTotal} 出手，vs 全季 ${allShots.length}）· 大字＝命中率，箭頭為 vs 全季 · 小字＝出手數／佔比 · 點格子看趨勢`}
                right={<>
                    <UI.ExportMenu title={`${groupInfo[1]}命中率（${periodLabel}）`} getNode={() => shootLedgerRef.current}
                        csv={() => ({ header: [groupInfo[1], '原文', `${periodLabel}命中率%`, `${periodLabel}出手`, '全季命中率%', '全季出手'],
                            rows: items.map(it => { const p = calc(periodShots, it.fn), a = calc(allShots, it.fn); return [it.label, it.en || '', p.pct == null ? '' : p.pct, p.fga, a.pct == null ? '' : a.pct, a.fga]; }) })} />
                    <UI.Seg ariaLabel="分組" size="sm" value={group} onChange={(g) => { setGroup(g); setOpenKey(null); }}
                        options={GROUPS.map(([v, l]) => ({ value: v, label: l }))} />
                </>}>
                <div ref={shootLedgerRef}>
                <UI.Ledger cols={UI.ledgerCols(items.length)}>
                    {items.map(it => {
                        const p = calc(periodShots, it.fn), a = calc(allShots, it.fn);
                        const freq = periodTotal ? Math.round(100 * p.fga / periodTotal) : 0;
                        const open = openKey === it.key;
                        return (
                            <button key={it.key} type="button" aria-pressed={open} onClick={() => setOpenKey(open ? null : it.key)}
                                className={`border-r border-b border-white/[0.08] px-3 pt-2.5 pb-3 min-w-0 text-left transition-colors ${open ? 'bg-[#12A150]/[0.08] shadow-[inset_0_-2px_0_#12A150]' : 'hover:bg-white/[0.03]'}`}>
                                <div className="text-[11px] leading-tight text-slate-300 truncate" title={it.en ? `${it.label} · ${it.en}` : it.label}>{it.label}</div>
                                {it.en && <div className="font-mono text-[10px] leading-tight text-slate-500 truncate">{it.en}</div>}
                                <div className="mt-2 flex items-baseline gap-1.5 min-w-0">
                                    <span className={`font-display text-[26px] font-semibold leading-none tabular-nums ${p.pct != null ? 'text-slate-50' : 'text-slate-600'}`}>
                                        {p.pct != null ? p.pct : '—'}{p.pct != null && <span className="ml-0.5 text-[15px] font-medium text-slate-400">%</span>}
                                    </span>
                                    {period !== 'all' && <span className="ml-auto"><UI.Delta value={p.pct} prevValue={a.pct} /></span>}
                                </div>
                                <div className="mt-1.5 font-mono text-[10px] text-slate-500">{p.fga} 出手 · 佔 {freq}%</div>
                            </button>
                        );
                    })}
                </UI.Ledger>
                </div>

                {/* 趨勢折線 */}
                {openItem && TrendChart && (
                    <div className="mt-4 border border-white/10 p-4">
                        <div className="mb-3 flex flex-wrap items-center gap-3">
                            <span className="text-[13px] font-medium text-slate-100">{openItem.label} 命中率趨勢</span>
                            <UI.Seg ariaLabel="趨勢粒度" size="sm" value={gran} onChange={setGran}
                                options={[{ value: 'game', label: '逐場' }, { value: 'week', label: '每週' }, { value: 'month', label: '每月' }]} />
                        </div>
                        <TrendChart points={trendPts} baseline={trendBaseline} unit="%"
                            title={`${openItem.label}命中率趨勢（${gran === 'game' ? '逐場' : gran === 'week' ? '每週' : '每月'}）`} />
                    </div>
                )}
            </UI.Section>

            {/* 受助攻（全季快照，不隨篩選） */}
            {Object.keys(assisted).length > 0 && (
                <UI.Section title="受助攻比例" en="Assisted FGM%" accent="blue" sub="命中球中由隊友助攻的比例 · 全季快照，不受上方期間篩選影響">
                    <UI.Ledger cols="grid-cols-3">
                        {[['整體受助攻', 'All FGM', 'PCT_AST_FGM'], ['兩分受助攻', '2PM', 'PCT_AST_2PM'], ['三分受助攻', '3PM', 'PCT_AST_3PM']].map(([l, en, k]) => (
                            <UI.StatCell key={k} label={l} en={en} value={typeof assisted[k] === 'number' ? assisted[k] : null} unit="%"
                                gkey={k} citeAsOf="none" citeNote="全季（每週更新）" />
                        ))}
                    </UI.Ledger>
                </UI.Section>
            )}

            {/* 篩選後熱圖 */}
            {ShotChart && (
                <ShotChart playerId={playerId} teamMode={teamMode} playerName={playerName} externalShots={periodShots} periodLabel={periodLabel} />
            )}
        </div>
    );
};

window.ShootingTab = ShootingTab;
