// 全域期間控制（狀態與計算在 periodFilter.js 的 window.Period，這裡只有介面）：版型見 _mockup/home.html
// 位置：桌機（sm 以上）膠囊在章節列右側、跟著吸頂；手機膠囊在身分列「數據截至」下一行（章節列已橫捲、放不下）
//   ＝「同一個控制只放一處」的例外：每種裝置仍只有一處
// 面板掛在章節列底下（TabBar 的 below），跟著吸頂：不論捲到哪裡、從哪顆膠囊打開都看得到；選完簡單期間自動收起
// 手機篩選生效時，章節列底下另有一條細提示（PeriodStrip），捲到下面也知道正在篩選、可以直接清除

// 膠囊：平常「期間 全季 ▾」；生效時變綠、顯示條件與場數（桌機另有勝敗小字與 ✕）
// props：label、rec { n, w, l }、active、open、onToggle、onClear、withRecord（桌機版顯示勝敗與 ✕）
const PeriodPill = ({ label, rec, active, open, onToggle, onClear, withRecord = false }) => (
    <span className="inline-flex min-w-0 items-center gap-1.5 whitespace-nowrap">
        {active && withRecord && rec && <span className="font-mono text-[11px] tabular-nums text-slate-400">{rec.w} 勝 {rec.l} 敗</span>}
        <span className="text-[11px] text-slate-500">期間</span>
        <button type="button" onClick={onToggle} aria-expanded={!!open} aria-controls="period-panel" title={active ? label : '選擇期間：勝敗、主客、近幾場、每月、對手、自訂區間、條件'}
            className={`inline-flex min-h-[24px] max-w-[16rem] items-center gap-1 rounded-full border px-2.5 text-[12px] transition-colors ${active ? 'border-[#12A150] bg-[#12A150]/[0.12] text-slate-50' : 'border-white/15 text-slate-200 hover:border-white/30'}`}>
            <span className="truncate">{active ? label : '全季'}</span>
            {active && rec && <span className="shrink-0 font-mono text-[11px] text-slate-300">· {rec.n} 場</span>}
            <span aria-hidden="true" className="shrink-0 text-[10px] text-slate-400">{open ? '▴' : '▾'}</span>
        </button>
        {active && withRecord && (
            <button type="button" onClick={onClear} aria-label="清除期間篩選"
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center text-[13px] text-slate-400 hover:text-slate-100">✕</button>
        )}
    </span>
);

// 手機提示列（只在篩選生效時、sm 以下）
const PeriodStrip = ({ label, rec, onClear, onOpen }) => (
    <div className="flex items-center gap-2 border-t border-[#12A150]/30 bg-[#12A150]/[0.08] py-1.5 text-[12px] whitespace-nowrap sm:hidden">
        <span className="shrink-0 text-slate-400">篩選中</span>
        <button type="button" onClick={onOpen} className="min-w-0 truncate text-left font-medium text-slate-50">{label}</button>
        {rec && <span className="shrink-0 font-mono text-[11px] text-slate-400">{rec.n} 場 · {rec.w} 勝 {rec.l} 敗</span>}
        <span className="flex-1"></span>
        <button type="button" onClick={onClear} className="min-h-[24px] shrink-0 rounded-full border border-white/15 px-2.5 text-[11px] text-slate-200">清除</button>
    </div>
);

// 面板：期間選項＋條件編輯器（條件編輯器原本在 Splits，規則不變）
// props：st、onChange(新狀態)、onClose、games（目前實體的逐場：月份／對手／系列賽清單）、isPlayoffs、players [{name,id}]、
//        isTeam、teamGames（全隊逐場；全隊視角＝games）、playerGames {pid: games[]}（條件指標下拉判斷有沒有值用）
const PeriodPanel = ({ st, onChange, onClose, games, isPlayoffs, players = [], isTeam, teamGames, playerGames = {} }) => {
    const UI = window.UI, P = window.Period, SC = window.SplitCond;
    const ref = React.useRef(null);
    React.useEffect(() => {
        const esc = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', esc);
        if (ref.current) ref.current.focus({ preventScroll: true });
        return () => window.removeEventListener('keydown', esc);
    }, []);
    const k = st.kind;
    const set = (patch, close = true) => { onChange({ ...P.ALL, ...patch }); if (close) onClose(); };
    const months = P.months(games), opps = P.opps(games), series = isPlayoffs ? P.series(games) : [];

    // ── 條件編輯器 ──
    const BASE_DEF = window.SPLITS_BASE_DEF;
    const ZONES_DEF = (window.shootingDefs || []).find(d => d.id === 'ShotZones');
    const DEF_DEFS = (window.defenseDefs || []).filter(d => (window.GAME_DEFENSE_IDS || []).includes(d.id));
    const CR = window.CONDITION_RULES || { maxConds: 2, deadlineMD: '02-15' };
    const conds = k === 'cond' ? (st.conds || []) : [];
    const setConds = (cs) => onChange(cs.length ? { kind: 'cond', conds: cs } : P.ALL);
    const draft = () => ({ who: (players[0] && players[0].id) || 'T', kind: 'stat', key: 'PTS', op: 'ge', value: NaN });
    const pickCond = () => { if (k !== 'cond') onChange({ kind: 'cond', conds: [draft()] }); };
    const setCond = (i, patch) => setConds(conds.map((c, j) => (j === i ? { ...c, ...patch } : c)));
    const removeCond = (i) => setConds(conds.filter((_, j) => j !== i));
    const sampleOf = (who) => {
        const gs = who === 'T' ? teamGames : playerGames[who];
        return gs && gs.length ? gs[gs.length - 1].stats || {} : null;
    };
    const metricGroups = (who) => {
        const sample = sampleOf(who), seen = new Set();
        const keep = (m) => !seen.has(m.key) && (!sample || typeof sample[m.key] === 'number') && seen.add(m.key);
        return [
            ['基本', (BASE_DEF || { metrics: [] }).metrics],
            ['次數', SC ? SC.EXTRA.filter(x => who !== 'T' || !x.playerOnly) : []],
            ['進階', (window.trackingDefs || []).flatMap(d => d.metrics)],
            ['投籃分區', ZONES_DEF ? ZONES_DEF.metrics : []],
            ['防守', DEF_DEFS.flatMap(d => d.metrics)],
        ].map(([t, ms]) => [t, ms.filter(keep)]).filter(([, ms]) => ms.length);
    };
    const selCls = (extra) => `${UI.selectClass(true)} ${extra}`;
    // 條件列單行；更窄的手機放不下時只在列內橫捲，不撐寬整頁
    const condRow = (c, i) => (
        <div key={i} className="flex max-w-full flex-nowrap items-center gap-[3px] overflow-x-auto whitespace-nowrap [scrollbar-width:none] sm:gap-1.5">
            {i > 0 && <span className="w-2.5 shrink-0 text-[11px] text-slate-500 sm:w-3">且</span>}
            <label className="sr-only" htmlFor={`cond-who-${i}`}>條件對象</label>
            <select id={`cond-who-${i}`} value={c.who} className={selCls('max-w-[6.75rem] sm:max-w-none')}
                onChange={e => { const who = e.target.value === 'T' ? 'T' : Number(e.target.value);
                    setCond(i, who === 'T' && c.kind !== 'stat' ? { who, kind: 'stat', key: 'PTS', op: 'ge', value: NaN } : { who }); }}>
                <option value="T">全隊</option>
                {players.map(p => <option key={p.id} value={p.id}>{SC.abbr(p.name)}</option>)}
            </select>
            <label className="sr-only" htmlFor={`cond-key-${i}`}>條件指標</label>
            <select id={`cond-key-${i}`} value={c.kind === 'stat' ? c.key : c.kind} className={selCls('max-w-[5rem] sm:max-w-none')}
                onChange={e => { const v = e.target.value;
                    setCond(i, v === 'played' || v === 'absent' ? { kind: v } : { kind: 'stat', key: v, op: c.op || 'ge', value: c.kind === 'stat' ? c.value : NaN }); }}>
                {c.who !== 'T' && <optgroup label="出賽"><option value="absent">未出賽</option><option value="played">有出賽</option></optgroup>}
                {metricGroups(c.who).map(([t, ms]) => (
                    <optgroup key={t} label={t}>{ms.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}</optgroup>
                ))}
            </select>
            {c.kind === 'stat' && (<>
                {/* 單一切換鈕（≥ ↔ ≤）：兩段式 Seg 在手機上太寬 */}
                <button type="button" onClick={() => setCond(i, { op: c.op === 'ge' ? 'le' : 'ge' })}
                    aria-label={c.op === 'ge' ? '大於等於（點了改成小於等於）' : '小於等於（點了改成大於等於）'}
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#12A150]/60 font-mono text-[13px] text-slate-100 hover:border-[#12A150]">
                    {c.op === 'ge' ? '≥' : '≤'}
                </button>
                <label className="sr-only" htmlFor={`cond-val-${i}`}>數值</label>
                <input id={`cond-val-${i}`} type="number" inputMode="decimal" placeholder="數值"
                    value={typeof c.value === 'number' && !isNaN(c.value) ? c.value : ''}
                    onChange={e => setCond(i, { value: e.target.value === '' ? NaN : Number(e.target.value) })}
                    className={`w-10 shrink-0 rounded-full border bg-[#0A1626] px-1 py-1 text-center font-mono text-[12px] focus:outline-none sm:w-16 ${typeof c.value === 'number' && !isNaN(c.value) ? 'border-[#12A150]/60 text-slate-100' : 'border-white/20 text-slate-400'}`} />
            </>)}
            <button type="button" aria-label="移除這個條件" onClick={() => removeCond(i)}
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center text-[13px] text-slate-500 hover:text-slate-100">✕</button>
        </div>
    );

    return (
        <div id="period-panel" ref={ref} tabIndex={-1} role="region" aria-label="期間篩選"
            className="mb-2.5 max-h-[60vh] overflow-y-auto border border-white/15 bg-[#0D1B2E] p-2.5 outline-none sm:p-3">
            <div className="flex flex-wrap items-center gap-1.5">
                <UI.Chip active={k === 'all'} onClick={() => set({})}>全季</UI.Chip>
                {P.SIMPLE.map(x => <UI.Chip key={x} active={k === x} onClick={() => set({ kind: x })}>{P.SIMPLE_LABEL[x]}</UI.Chip>)}
                <label className="sr-only" htmlFor="period-month">選擇月份</label>
                <select id="period-month" value={k === 'month' ? st.month : ''} onChange={e => e.target.value && set({ kind: 'month', month: e.target.value })}
                    className={UI.selectClass(k === 'month')}>
                    <option value="">每月</option>
                    {months.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                {isPlayoffs && series.length > 0 && (<>
                    <label className="sr-only" htmlFor="period-series">選擇系列賽</label>
                    <select id="period-series" value={k === 'series' ? st.series : ''} onChange={e => e.target.value !== '' && set({ kind: 'series', series: Number(e.target.value) })}
                        className={UI.selectClass(k === 'series')}>
                        <option value="">系列賽</option>
                        {series.map((s, i) => <option key={i} value={i}>{s.label}</option>)}
                    </select>
                </>)}
                {!isPlayoffs && opps.length > 0 && (<>
                    <label className="sr-only" htmlFor="period-opp">選擇對手</label>
                    <select id="period-opp" value={k === 'opp' ? st.opp : ''} onChange={e => e.target.value && set({ kind: 'opp', opp: e.target.value })}
                        className={UI.selectClass(k === 'opp')}>
                        <option value="">對手</option>
                        {opps.map(([a, n]) => <option key={a} value={a}>{a} {window.teamName(a)}（{n}）</option>)}
                    </select>
                </>)}
                <UI.Chip active={k === 'range'} onClick={() => k !== 'range' && onChange({ ...P.ALL, kind: 'range', start: '', end: '' })}>自訂區間</UI.Chip>
                {SC && <UI.Chip active={k === 'cond'} onClick={pickCond}>條件</UI.Chip>}
                <button type="button" onClick={onClose} className="ml-auto min-h-[24px] px-1 text-[12px] text-slate-400 hover:text-slate-100">收合 ▴</button>
            </div>
            {k === 'range' && (
                <div className="mt-2.5 flex items-center gap-2 border-t border-white/[0.08] pt-2.5 text-xs text-slate-400">
                    <input type="date" aria-label="起始日" value={st.start || ''} onChange={e => onChange({ ...st, start: e.target.value })} className={UI.selectClass(!!st.start)} />
                    <span>~</span>
                    <input type="date" aria-label="結束日" value={st.end || ''} onChange={e => onChange({ ...st, end: e.target.value })} className={UI.selectClass(!!st.end)} />
                </div>
            )}
            {k === 'cond' && SC && (
                <div className="mt-2.5 space-y-2 border-t border-white/[0.08] pt-2.5">
                    {conds.map(condRow)}
                    {conds.some(c => c.who !== 'T' && c.kind === 'absent') && (
                        <p className="text-[11px] text-slate-500">未出賽只算在隊期間：從他第一次出賽起，當季仍在名冊上的算到最新一場（傷停也算）；歷史賽季以最後一次出賽在 {CR.deadlineMD.replace('-', '/')} 後的才算到季末</p>
                    )}
                    {conds.length < CR.maxConds && (
                        <button type="button" onClick={() => setConds([...conds, { who: 'T', kind: 'stat', key: 'TOV', op: 'le', value: NaN }])}
                            className="inline-flex min-h-[24px] items-center rounded-full border border-dashed border-white/20 px-3 text-[12px] text-slate-300 hover:border-white/40">＋ 加一個條件（且）</button>
                    )}
                </div>
            )}
        </div>
    );
};

window.PeriodPill = PeriodPill;
window.PeriodStrip = PeriodStrip;
window.PeriodPanel = PeriodPanel;
