// Splits 分頁：頂部期間篩選 + 欄位組卡片牆（該期間 vs 全季，綠/紅漲跌）+ 點卡片展開趨勢折線
// games：該季逐場 bundle（每場 {date,matchup,wl,stats}）；一律以 game.stats 為實體（GameAgg 'TEAM' 語意）
// focusMetric / highlightDate：網址 m= / hl=（從單場頁點指標過來）→ 自動切到該指標所屬欄位組、打開逐場走勢、圈出那一場
// onFocusChange(metricKey|null)：走勢開關或換指標時回報，讓網址跟著記住（可分享）
// onGameClick(date)：逐場走勢上點某一場（→ 單場頁）；未傳則點不可點
// rankable：全隊、當季最新快照有名次時為 true → 期間選「全季」時各格加聯盟名次（其他期間沒有名次）
// 條件戰績（期間＝條件，邏輯在 splitConditions.js 的 window.SplitCond）：
//   season／seasonType：bundle 的賽季與賽別（讀條件裡的球員、球員視角時讀全隊逐場當母體）
//   players：[{ name, id }] 本季球員（條件下拉）；isTeam：目前是不是全隊視角（games 就是全隊逐場）
//   condStr／onCondChange：網址 c=（序列化後的完整條件；離開「條件」期間回報空字串）
const SplitsTab = ({ games, seasonLabel, isPlayoffs, focusMetric, highlightDate, onFocusChange, onGameClick, rankable = false,
    season, seasonType, players = [], isTeam = true, condStr = '', onCondChange }) => {
    const { useState, useEffect } = React;
    const GA = window.GameAgg;
    const TrackingCardRow = window.TrackingCardRow;
    const trackingDefs = window.trackingDefs || [];
    const shootingDefs = window.shootingDefs || [];
    const defenseDefs = window.defenseDefs || [];

    const SC = window.SplitCond;
    const [period, setPeriod] = useState(() => (condStr && SC && SC.parse(condStr).length ? 'cond' : 'all'));
    // 條件草稿（可能還沒填完）；完整的才序列化進網址。預設一列：第一位球員的得分 ≥ （數值待填）
    const draftOf = () => ({ who: (players[0] && players[0].id) || 'T', kind: 'stat', key: 'PTS', op: 'ge', value: NaN });
    const [conds, setConds] = useState(() => (condStr && SC ? SC.parse(condStr) : []));
    const [condTeam, setCondTeam] = useState(null);       // 條件母體：全隊逐場（全隊視角直接用 games）
    const [condPlayers, setCondPlayers] = useState({});   // { pid: games[] } 條件裡提到的球員
    const [monthKey, setMonthKey] = useState('');
    const [seriesIdx, setSeriesIdx] = useState(0);
    const [oppKey, setOppKey] = useState('');   // 期間＝對手（三碼）；季後賽用系列賽選單，不另顯示
    const [rangeStart, setRangeStart] = useState('');
    const [rangeEnd, setRangeEnd] = useState('');
    const [group, setGroup] = useState('base');
    const [openGroup, setOpenGroup] = useState(null);
    const [trendMetric, setTrendMetric] = useState(null);
    const [gran, setGran] = useState('game');
    const ledgerRef = React.useRef(null);
    const trendRef = React.useRef(null);
    const pendingScrollRef = React.useRef(false);   // 從網址聚焦後，等走勢出現再捲過去

    const BASE_DEF = window.SPLITS_BASE_DEF;
    const ZONES_DEF = shootingDefs.find(d => d.id === 'ShotZones');
    // 單場有的防守資料：最近防守者（僅球員）＋ Hustle。DefenseBox（防守效率等）沒有單場值
    const DEF_DEFS = defenseDefs.filter(d => (window.GAME_DEFENSE_IDS || []).includes(d.id));
    const GROUP_DEFS = { base: [BASE_DEF], tracking: trackingDefs, zones: ZONES_DEF ? [ZONES_DEF] : [], defense: DEF_DEFS };
    // 欄位組 → 快照名次類別（tracking 的籃板三項在 tracking 也有，找不到再退 base）
    const RANK_CATS = { base: 'base', tracking: ['tracking', 'base'], zones: 'shooting', defense: 'defense' };

    // 網址帶指標 → 找所屬欄位組與群組（由 defs 反查，不另建對照表；新增指標自動適用）
    useEffect(() => {
        // 自己開走勢時也會回報 m → 已經開著同一個指標就不重設、不捲動
        if (!focusMetric || (openGroup && trendMetric === focusMetric)) return;
        for (const [g, defs] of Object.entries(GROUP_DEFS)) {
            const def = defs.find(d => d.metrics.some(m => m.key === focusMetric));
            if (def) {
                setGroup(g); setOpenGroup(def); setTrendMetric(focusMetric);
                if (highlightDate) setGran('game');
                pendingScrollRef.current = true;   // 走勢渲染出來後再捲過去（見下一個 effect）
                return;
            }
        }
    }, [focusMetric, highlightDate, !!games]);
    // 每次渲染後檢查：從網址聚焦且走勢已出現 → 捲到畫面中央（只做一次）。
    // 不能在設定狀態時就捲：當下欄位組還沒切換、版面高度還會變
    useEffect(() => {
        if (!pendingScrollRef.current || !trendRef.current) return;
        pendingScrollRef.current = false;
        trendRef.current.scrollIntoView({ block: 'center' });   // effect 在 DOM 更新後執行，版面已就緒
    });

    // ── 條件戰績：選了「條件」才讀資料（loadSeasonGames 有記憶體快取，切換不重讀）──
    const condOn = period === 'cond';
    const condPids = condOn && SC ? SC.needPids(conds) : [];
    useEffect(() => {
        if (!condOn || isTeam || !season || !window.loadSeasonGames) return;
        let off = false;
        setCondTeam(null);
        window.loadSeasonGames(season, seasonType, 'TEAM').then(r => { if (!off) setCondTeam(r.games || []); });
        return () => { off = true; };
    }, [condOn, isTeam, season, seasonType]);
    useEffect(() => {
        const todo = condPids.filter(pid => !condPlayers[pid]);
        if (!todo.length || !season || !window.loadSeasonGames) return;
        let off = false;
        Promise.all(todo.map(pid => window.loadSeasonGames(season, seasonType, 'PLAYER', pid).then(r => [pid, r.games || []])))
            .then(list => { if (!off) setCondPlayers(m => ({ ...m, ...Object.fromEntries(list) })); });
        return () => { off = true; };
    }, [condPids.join(','), season, seasonType]);
    // 換賽季：讀過的球員逐場是別季的，清掉
    useEffect(() => { setCondPlayers({}); }, [season, seasonType]);
    // 期間切換與條件編輯 → 網址（只寫完整條件；離開條件期間清掉）
    useEffect(() => {
        if (!onCondChange || !SC) return;
        onCondChange(condOn ? SC.serialize(conds) : '');
    }, [condOn, SC ? SC.serialize(conds) : '']);
    // 網址換了條件（貼另一條連結）→ 同步草稿
    useEffect(() => {
        if (!SC || !condStr || condStr === SC.serialize(conds)) return;
        setConds(SC.parse(condStr)); setPeriod('cond');
    }, [condStr]);

    if (!games) return <div className="py-10 text-center text-sm text-slate-500 animate-pulse">載入單場資料中…</div>;
    if (!games.length) return <window.UI.Note>此賽季尚無單場資料（Splits 需要逐場資料）</window.UI.Note>;

    const months = GA.splitByMonth(games).map(g => g.label);
    // 對手清單（三碼排序＋場數）；對手三碼規則與對戰分析相同
    const oppOf = g => g.oppAbbr || window.Matchup.oppOf(g.matchup);
    const opps = Object.entries(games.reduce((m, g) => { const a = oppOf(g); if (a) m[a] = (m[a] || 0) + 1; return m; }, {})).sort();
    const series = isPlayoffs ? GA.splitBySeries(games) : [];

    // 期間子集
    let periodGames = games, periodLabel = '全季';
    if (period === 'W') { periodGames = games.filter(g => g.wl === 'W'); periodLabel = '勝場'; }
    else if (period === 'L') { periodGames = games.filter(g => g.wl === 'L'); periodLabel = '敗場'; }
    else if (period === 'home') { periodGames = games.filter(g => (g.matchup || '').includes('vs.')); periodLabel = '主場'; }
    else if (period === 'away') { periodGames = games.filter(g => (g.matchup || '').includes('@')); periodLabel = '客場'; }
    else if (period === 'last5') { periodGames = GA.lastN(games, 5); periodLabel = '近 5 場'; }
    else if (period === 'last10') { periodGames = GA.lastN(games, 10); periodLabel = '近 10 場'; }
    else if (period === 'month') { periodGames = games.filter(g => (g.date || '').slice(0, 7) === monthKey); periodLabel = monthKey; }
    else if (period === 'range') { periodGames = GA.byDateRange(games, rangeStart, rangeEnd); periodLabel = `${rangeStart || '起'}~${rangeEnd || '訖'}`; }
    else if (period === 'series') { periodGames = (series[seriesIdx] || {}).games || []; periodLabel = (series[seriesIdx] || {}).label || '系列'; }
    else if (period === 'opp') { periodGames = games.filter(g => oppOf(g) === oppKey); periodLabel = `對 ${oppKey} ${window.teamName(oppKey)}`; }
    // 條件：母體＝全隊逐場；資料還沒到齊時 cond＝null（顯示載入中），條件沒填完時 cond.ready＝false
    let cond = null;
    if (condOn && SC) {
        const teamGames = isTeam ? games : condTeam;
        const complete = conds.filter(SC.isComplete);
        const nameOf = (pid) => ((players.find(p => Number(p.id) === Number(pid)) || {}).name) || String(pid);
        const loaded = teamGames && SC.needPids(complete).every(pid => condPlayers[pid]);
        if (!complete.length) cond = { ready: false };
        else if (loaded) {
            const dates = SC.evaluate(complete, { teamGames, playerGames: condPlayers, season });
            cond = { ready: true, dates, sum: SC.summary(teamGames, dates), label: SC.label(complete, nameOf),
                matched: teamGames.filter(g => dates.has(g.date)) };
            periodGames = games.filter(g => dates.has(g.date));
            periodLabel = cond.label;
        }
        if (!cond || !cond.ready) { periodGames = []; periodLabel = '條件'; }
    }

    const seasonAgg = GA.aggregate(games, null, 'TEAM');
    const periodAgg = GA.aggregate(periodGames, null, 'TEAM');

    // 只列出這個實體有資料的群組（球隊沒有最近防守者；舊場次可能沒有 Hustle）
    const hasData = def => def.metrics.some(m => typeof seasonAgg[m.key] === 'number');
    const defs = (GROUP_DEFS[group] || []).filter(hasData);

    const openTrend = (def) => {
        const closing = def.id === (openGroup && openGroup.id);
        setOpenGroup(closing ? null : def);
        setTrendMetric(def.metrics[0].key);
        if (onFocusChange) onFocusChange(closing ? null : def.metrics[0].key);
    };
    const pickTrendMetric = (k) => { setTrendMetric(k); if (onFocusChange) onFocusChange(k); };

    // 趨勢資料（整季，依粒度）
    const trendPts = (openGroup && trendMetric) ? GA.trendSeries(games, null, 'TEAM', trendMetric, gran) : [];
    const trendBaseline = (openGroup && trendMetric) ? seasonAgg[trendMetric] : null;

    const UI = window.UI;
    const GROUPS = [['base', '基本', 'Traditional'], ['tracking', '進階', 'Tracking'], ['zones', '投籃分區', 'Shot Zones'], ['defense', '防守', 'Defense']]
        .filter(([g]) => (GROUP_DEFS[g] || []).some(hasData));

    // ── 條件編輯器（單行：名字縮寫、下拉在手機上限寬）──
    const CR = window.CONDITION_RULES || { maxConds: 2, deadlineMD: '02-15' };
    const pickCond = () => { setPeriod('cond'); if (!conds.length) setConds([draftOf()]); };
    const setCond = (i, patch) => setConds(cs => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));
    const removeCond = (i) => setConds(cs => { const next = cs.filter((_, j) => j !== i); if (!next.length) setPeriod('all'); return next; });
    // 指標選單：基本＋條件專用次數＋進階＋投籃分區＋防守；有樣本資料時只列該實體有值的欄
    const sampleOf = (who) => {
        const gs = who === 'T' ? (isTeam ? games : condTeam) : condPlayers[who];
        return gs && gs.length ? gs[gs.length - 1].stats || {} : null;
    };
    const metricGroups = (who) => {
        const sample = sampleOf(who), seen = new Set();
        const keep = (m) => !seen.has(m.key) && (!sample || typeof sample[m.key] === 'number') && seen.add(m.key);
        return [
            ['基本', (BASE_DEF || { metrics: [] }).metrics],
            ['次數', SC ? SC.EXTRA.filter(x => who !== 'T' || !x.playerOnly) : []],
            ['進階', trackingDefs.flatMap(d => d.metrics)],
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
                {/* 單一切換鈕（≥ ↔ ≤）：兩段式 Seg 在手機上太寬，會把名字擠成「A. Edw」 */}
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
    const condEditor = condOn && SC && (
        <div className="space-y-2 border border-white/[0.08] bg-white/[0.02] p-2 sm:p-3">
            {conds.map(condRow)}
            {conds.some(c => c.who !== 'T' && c.kind === 'absent') && (
                <p className="text-[11px] text-slate-500">未出賽只算在隊期間（最後一次出賽在 {CR.deadlineMD.replace('-', '/')} 後的算到季末）</p>
            )}
            {conds.length < CR.maxConds && (
                <button type="button" onClick={() => setConds(cs => [...cs, { who: 'T', kind: 'stat', key: 'TOV', op: 'le', value: NaN }])}
                    className="inline-flex min-h-[24px] items-center rounded-full border border-dashed border-white/20 px-3 text-[12px] text-slate-300 hover:border-white/40">＋ 加一個條件（且）</button>
            )}
        </div>
    );

    // ── 戰績摘要：符合／其他／全季（一排三格，手機也不換行）──
    const pctTxt = (r) => (r.pct == null ? '—' : `${Math.round(r.pct * 100)}%`);
    const pmTxt = (r) => (r.pm == null ? '—' : `${r.pm > 0 ? '+' : r.pm < 0 ? '−' : ''}${Math.abs(r.pm).toFixed(1)}`);
    const recCell = (title, r, tone, extra) => (
        <div className={`min-w-0 border-b border-r border-white/[0.08] px-2.5 py-2 sm:px-3.5 sm:py-2.5 ${tone === 'main' ? 'bg-[#12A150]/[0.05]' : ''}`}>
            <div className="flex items-center justify-between gap-1 whitespace-nowrap text-[10px] text-slate-400 sm:text-[11px]"><span>{title} · {r.n} 場</span>{extra}</div>
            <div className={`whitespace-nowrap font-display font-bold leading-tight tabular-nums ${tone === 'main' ? 'text-[26px] text-slate-50 sm:text-[34px]' : tone === 'all' ? 'text-[20px] text-slate-400 sm:text-[26px]' : 'text-[20px] text-slate-100 sm:text-[26px]'}`}>{r.w}-{r.l}</div>
            <div className="whitespace-nowrap font-mono text-[10px] text-slate-500 sm:text-[11px]">勝率 {pctTxt(r)}</div>
            <div className="whitespace-nowrap font-mono text-[10px] text-slate-500 sm:text-[11px]">分差 {pmTxt(r)}</div>
        </div>
    );
    const condQuote = () => cond && window.Quote.make({ subject: '灰狼全隊', context: seasonLabel, label: `${cond.label} 戰績`, gkey: 'SPLIT_COND',
        values: [{ value: `${cond.sum.match.w}-${cond.sum.match.l}（勝率 ${pctTxt(cond.sum.match)}，其他 ${cond.sum.rest.w}-${cond.sum.rest.l}）` }], asOf: 'none' });
    const condCite = () => cond && ['灰狼全隊', seasonLabel, `${cond.label}：${cond.sum.match.w}-${cond.sum.match.l}（${cond.sum.match.n} 場，勝率 ${pctTxt(cond.sum.match)}，場均分差 ${pmTxt(cond.sum.match)}）；其他 ${cond.sum.rest.w}-${cond.sum.rest.l}`,
        '資料：NBA.com Stats', `${location.origin}${location.pathname}${location.hash}`].join('｜');
    const shortMu = (m) => String(m || '').replace(/^MIN\s*/, '').replace(/^vs\.\s*/, 'vs ').replace(/^@\s*/, '@');
    const condResult = condOn && (
        !cond ? <div className="py-6 text-center text-sm text-slate-500 animate-pulse">讀取條件需要的逐場資料…</div>
        : !cond.ready ? <UI.Note>填入數值後顯示符合條件的場次與戰績</UI.Note>
        : (<div className="mb-6">
            <div className="grid grid-cols-[1.25fr_1fr_1fr] border-l border-t border-white/[0.08]">
                {recCell('符合', cond.sum.match, 'main', <UI.Info k="SPLIT_COND" align="right" cite={condCite} quote={condQuote} />)}
                {recCell('其他', cond.sum.rest, 'rest')}
                {recCell('全季', cond.sum.all, 'all')}
            </div>
            {window.smallSampleNote(cond.sum.match.n, '符合條件') && <div className="mt-2"><UI.Note tone="warn">{window.smallSampleNote(cond.sum.match.n, '符合條件')}</UI.Note></div>}
            {cond.matched.length > 0 && (
                <details className="mt-2">
                    <summary className="inline-flex min-h-[24px] cursor-pointer items-center text-[12px] text-slate-300 hover:text-slate-100">符合的 {cond.matched.length} 場（點了看單場）</summary>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                        {cond.matched.map(g => {
                            const pts = (g.stats || {}).PTS, pm = (g.stats || {}).PLUS_MINUS;
                            return (
                                <button key={g.date} type="button" onClick={() => onGameClick && onGameClick(g.date)} disabled={!onGameClick}
                                    className="inline-flex min-h-[24px] items-center gap-1 whitespace-nowrap rounded-sm border border-white/[0.08] px-2 font-mono text-[11px] text-slate-400 hover:border-white/25">
                                    <b className="font-semibold text-slate-200">{g.date.slice(5).replace('-', '/')}</b>{shortMu(g.matchup)}
                                    <span className={g.wl === 'W' ? 'text-[#12A150]' : 'text-[#EF4444]'}>{g.wl}{typeof pts === 'number' && typeof pm === 'number' ? ` ${pts}-${pts - pm}` : ''}</span>
                                </button>
                            );
                        })}
                    </div>
                </details>
            )}
        </div>)
    );

    return (
        <div className="space-y-8">
            {/* 期間篩選列 */}
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
                    <label className="sr-only" htmlFor="splits-month">選擇月份</label>
                    <select id="splits-month" value={period === 'month' ? monthKey : ''} onChange={e => { setPeriod('month'); setMonthKey(e.target.value); }}
                        className={UI.selectClass(period === 'month')}>
                        <option value="">每月</option>
                        {months.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    {isPlayoffs && series.length > 0 && (<>
                        <label className="sr-only" htmlFor="splits-series">選擇系列賽</label>
                        <select id="splits-series" value={period === 'series' ? seriesIdx : ''} onChange={e => { setPeriod('series'); setSeriesIdx(Number(e.target.value)); }}
                            className={UI.selectClass(period === 'series')}>
                            <option value="">系列賽</option>
                            {series.map((s, i) => <option key={i} value={i}>{s.label}</option>)}
                        </select>
                    </>)}
                    {!isPlayoffs && opps.length > 0 && (<>
                        <label className="sr-only" htmlFor="splits-opp">選擇對手</label>
                        <select id="splits-opp" value={period === 'opp' ? oppKey : ''} onChange={e => { if (!e.target.value) return; setPeriod('opp'); setOppKey(e.target.value); }}
                            className={UI.selectClass(period === 'opp')}>
                            <option value="">對手</option>
                            {opps.map(([a, n]) => <option key={a} value={a}>{a} {window.teamName(a)}（{n}）</option>)}
                        </select>
                    </>)}
                    <UI.Chip active={period === 'range'} onClick={() => setPeriod('range')}>自訂區間</UI.Chip>
                    {SC && <UI.Chip active={condOn} onClick={pickCond}>條件</UI.Chip>}
                </div>
                {condEditor}
                {period === 'opp' && (
                    <p className="text-[12px] text-slate-400">
                        單季交手只有 2–4 場，數字容易被單場手感左右。
                        <a href={window.UrlState.vsHref(oppKey)} className="ml-1 text-slate-200 underline underline-offset-2 hover:text-[#12A150]">看 {oppKey} 近三季對戰分析 →</a>
                    </p>
                )}
                {period === 'range' && (
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                        <input type="date" aria-label="起始日" value={rangeStart} onChange={e => setRangeStart(e.target.value)} className={UI.selectClass(!!rangeStart)} />
                        <span>~</span>
                        <input type="date" aria-label="結束日" value={rangeEnd} onChange={e => setRangeEnd(e.target.value)} className={UI.selectClass(!!rangeEnd)} />
                    </div>
                )}
            </div>

            <UI.Section title={condOn ? <span className="block truncate max-sm:text-[18px]">{periodLabel}</span> : periodLabel} en={condOn ? undefined : 'Splits'} accent="green"
                sub={`${periodAgg.GP} 場，vs 全季 ${seasonAgg.GP} 場 · 箭頭＝此期間 vs 全季平均 · 百分比以 Σ命中 ÷ Σ出手 重算 · 點群組看趨勢`}
                right={<>
                    <UI.ExportMenu title={`Splits：${periodLabel}（${periodAgg.GP} 場）vs 全季`} getNode={() => ledgerRef.current}
                        csv={() => ({ header: ['群組', '指標', '原文', periodLabel, '全季', '差'], rows: defs.flatMap(d => d.metrics.map(m => {
                            const a = periodAgg[m.key], b = seasonAgg[m.key];
                            return [d.title, m.label, m.englishLabel || '', a == null ? '' : a, b == null ? '' : b, (typeof a === 'number' && typeof b === 'number') ? +(a - b).toFixed(1) : ''];
                        })) })} />
                    <UI.Seg ariaLabel="欄位組" size="sm" value={group} onChange={(g) => { setGroup(g); setOpenGroup(null); if (onFocusChange) onFocusChange(null); }}
                        options={GROUPS.map(([v, l]) => ({ value: v, label: l }))} />
                </>}>
                {condResult}
                <div ref={ledgerRef}>
                {condOn && (!cond || !cond.ready) ? null : periodAgg.GP === 0 ? (
                    <UI.Note>{condOn ? (isTeam ? '沒有符合條件的比賽' : '符合條件的比賽中，這位球員都沒有上場') : '此期間沒有比賽'}</UI.Note>
                ) : defs.map(def => (
                    <div key={def.id}>
                        <TrackingCardRow title={def.title} actionLabel="點看趨勢" category={def.id} metrics={def.metrics}
                            current={periodAgg} prev={seasonAgg} onClick={() => openTrend(def)} source="stats"
                            citeAsOf="none" citeNote={`Splits：${periodLabel}（${periodAgg.GP} 場）`}
                            rankCats={rankable && period === 'all' ? RANK_CATS[group] : null}
                            compareTags={period === 'all' ? null : ['全季', periodLabel]} />
                        {openGroup && openGroup.id === def.id && (
                            <div ref={trendRef} className="-mt-3 mb-6 border border-white/10 p-4">
                                <div className="mb-3 flex flex-wrap items-center gap-3">
                                    <label className="sr-only" htmlFor={`trend-metric-${def.id}`}>趨勢指標</label>
                                    <select id={`trend-metric-${def.id}`} value={trendMetric || ''} onChange={e => pickTrendMetric(e.target.value)}
                                        className={UI.selectClass(true)}>
                                        {def.metrics.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                                    </select>
                                    <UI.Seg ariaLabel="趨勢粒度" size="sm" value={gran} onChange={setGran}
                                        options={[{ value: 'game', label: '逐場' }, { value: 'week', label: '每週' }, { value: 'month', label: '每月' }]} />
                                </div>
                                <TrendChart points={trendPts} baseline={trendBaseline}
                                    highlight={gran === 'game' ? highlightDate : null}
                                    onPointClick={gran === 'game' && onGameClick ? (p) => onGameClick(p.label) : null}
                                    unit={(def.metrics.find(m => m.key === trendMetric) || {}).unit === '%' ? '%' : ''}
                                    title={`${(def.metrics.find(m => m.key === trendMetric) || {}).label || ''}趨勢（${gran === 'game' ? '逐場' : gran === 'week' ? '每週' : '每月'}）`} />
                            </div>
                        )}
                    </div>
                ))}
                </div>
            </UI.Section>
        </div>
    );
};

// 簡易 SVG 折線：逐點值 + 全季均線；hover 顯示精確值、上方圖例、虛線右端標基準值
// unit：純文字複製時接在數值後（'%'）；citeSeason：純文字標題的賽季，預設取 CiteCtx.season，跨季比較傳 false 省略
// 點若帶 wl（逐場）→ 底下鋪勝負色帶（綠勝紅敗）
// highlight：要圈出的點 label（逐場＝日期）；窄螢幕需橫捲時自動捲到該點
// onPointClick(point)：點擊某點（逐場 → 單場頁）；未傳則不可點
const TrendChart = ({ points, baseline, title, unit = '', citeSeason, highlight, onPointClick }) => {
    const UI = window.UI;
    const chartRef = React.useRef(null);
    const scrollRef = React.useRef(null);
    const W = 640, H = 160, padL = 34, padR = 46, padT = 12, padB = 22; // padR 加大留基準標籤空間
    const n = points ? points.length : 0;
    const x = i => padL + (n === 1 ? (W - padL - padR) / 2 : i * (W - padL - padR) / (n - 1));
    const hlIdx = highlight && points ? points.findIndex(p => p.label === highlight) : -1;
    React.useEffect(() => {
        const el = scrollRef.current;
        if (!el || hlIdx < 0 || el.scrollWidth <= el.clientWidth) return;
        el.scrollLeft = el.scrollWidth * x(hlIdx) / W - el.clientWidth / 2;
    }, [hlIdx, n]);
    // X 軸：日期標籤去掉年份（2025-01-15 → 01-15、2025-01 → 01）；其他標籤（跨季的「24-25例」）原樣顯示
    const axisLabel = (l) => /^\d{4}-\d{2}(-\d{2})?$/.test(String(l)) ? String(l).slice(5) : String(l);
    // 臉書用純文字：點少（≤6，如跨季）寫成一行箭頭，點多（逐場）一行一點
    const fbText = () => {
        const c = window.CiteCtx || {};
        const subject = c.subject === 'Minnesota Timberwolves' ? '灰狼全隊' : c.subject;
        const season = citeSeason === undefined ? c.season : citeSeason;
        const v = (x) => `${x}${unit}`;
        const body = points.length <= 6
            ? [points.map(p => `${p.label} ${v(p.value)}`).join(' → ')]
            : points.map(p => `${p.label}｜${v(p.value)}${p.wl ? ` ${p.wl}` : ''}`);
        return [
            `【${[subject, season, title].filter(Boolean).join('｜')}】`,
            '',
            ...body,
            ...(baseline != null ? ['', `全季平均 ${v(baseline)}`] : []),
            '',
            '資料：NBA.com Stats',
            `${location.origin}${location.pathname}${location.hash}`,
        ].join('\n');
    };
    if (!points || points.length < 1) return <div className="py-8 text-center text-xs text-slate-500">資料不足，無法繪製趨勢</div>;
    const vals = points.map(p => p.value);
    let lo = Math.min(...vals, baseline != null ? baseline : Infinity);
    let hi = Math.max(...vals, baseline != null ? baseline : -Infinity);
    if (lo === hi) { lo -= 1; hi += 1; }
    const pad = (hi - lo) * 0.1; lo -= pad; hi += pad;
    const y = v => padT + (H - padT - padB) * (1 - (v - lo) / (hi - lo));
    const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
    const MONO = "'JetBrains Mono', monospace";
    const hasWL = points.some(p => p.wl === 'W' || p.wl === 'L');
    const step = n > 1 ? (W - padL - padR) / (n - 1) : (W - padL - padR);
    const hl = hlIdx >= 0 ? points[hlIdx] : null;
    return (
        <div ref={chartRef}>
            {/* 圖例 */}
            <div className="mb-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5"><svg width="18" height="6" aria-hidden="true"><line x1="0" y1="3" x2="18" y2="3" stroke="#12A150" strokeWidth="2" /></svg>逐點值</span>
                {baseline != null && <span className="flex items-center gap-1.5"><svg width="18" height="6" aria-hidden="true"><line x1="0" y1="3" x2="18" y2="3" stroke="#C4CED2" strokeWidth="1.5" strokeDasharray="4 3" /></svg>全季平均 {baseline}</span>}
                {hasWL && <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 bg-[#12A150]/25" aria-hidden="true"></span>勝
                    <span className="ml-1 inline-block h-2.5 w-2.5 bg-[#EF4444]/25" aria-hidden="true"></span>敗（底色）
                </span>}
                {hl && <span className="flex items-center gap-1.5 text-amber-300"><svg width="10" height="10" aria-hidden="true"><circle cx="5" cy="5" r="4" fill="none" stroke="#FBBF24" strokeWidth="1.5" /></svg>本場 {axisLabel(hl.label)}</span>}
                <span className="text-slate-500" data-export-hide>{onPointClick ? '滑鼠移到點看數值，點擊看該場' : '滑鼠移到點看數值'}</span>
                {title && <span className="ml-auto"><UI.ExportMenu title={title} getNode={() => chartRef.current}
                    csv={() => ({ header: ['期間', '數值', '全季平均', ...(hasWL ? ['勝負'] : [])], rows: points.map(p => [p.label, p.value, baseline == null ? '' : baseline, ...(hasWL ? [p.wl || ''] : [])]) })}
                    text={fbText} /></span>}
            </div>
            <div ref={scrollRef} className="overflow-x-auto">
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 480 }} role="img" aria-label="趨勢折線圖">
                    {hasWL && points.map((p, i) => (p.wl === 'W' || p.wl === 'L') && (
                        <rect key={'wl' + i} x={x(i) - step / 2} y={padT} width={step} height={H - padT - padB}
                            fill={p.wl === 'W' ? '#12A150' : '#EF4444'} fillOpacity="0.09" />
                    ))}
                    {[0, 0.5, 1].map(f => { const v = lo + (hi - lo) * (1 - f); return (
                        <g key={f}><line x1={padL} x2={W - padR} y1={padT + f * (H - padT - padB)} y2={padT + f * (H - padT - padB)} stroke="rgba(255, 255, 255, 0.07)" />
                            <text x={4} y={padT + f * (H - padT - padB) + 3} fill="#64748b" fontSize="9" fontFamily={MONO}>{v.toFixed(1)}</text></g>); })}
                    {baseline != null && (<g>
                        <line x1={padL} x2={W - padR} y1={y(baseline)} y2={y(baseline)} stroke="#C4CED2" strokeOpacity="0.6" strokeDasharray="4 3" strokeWidth="1" />
                        <text x={W - padR + 4} y={y(baseline) + 3} fill="#C4CED2" fontSize="9" fontFamily={MONO}>{baseline}</text>
                    </g>)}
                    <path d={line} fill="none" stroke="#12A150" strokeWidth="2" />
                    {hl && (<g>
                        <circle cx={x(hlIdx)} cy={y(hl.value)} r="7" fill="none" stroke="#FBBF24" strokeWidth="2" />
                        <text x={x(hlIdx)} y={y(hl.value) - 11} fill="#FBBF24" fontSize="10" textAnchor="middle" fontFamily={MONO}>本場 {hl.value}{unit}</text>
                    </g>)}
                    {points.map((p, i) => (
                        <g key={i}>
                            <circle cx={x(i)} cy={y(p.value)} r="2.5" fill={i === hlIdx ? '#FBBF24' : '#12A150'} />
                            <circle cx={x(i)} cy={y(p.value)} r="10" fill="transparent" style={{ cursor: 'pointer' }}
                                onClick={onPointClick ? () => onPointClick(p) : undefined}>
                                <title>{p.label}{p.wl ? `（${p.wl === 'W' ? '勝' : '敗'}）` : ''}：{p.value}{unit}{onPointClick ? '　點擊看這場' : ''}</title>
                            </circle>
                            {(points.length <= 16 || i === hlIdx) && <text x={x(i)} y={H - 8} fill={i === hlIdx ? '#FBBF24' : '#64748b'} fontSize="8" textAnchor="middle" fontFamily={MONO}>{axisLabel(p.label)}</text>}
                        </g>
                    ))}
                </svg>
            </div>
        </div>
    );
};

window.SplitsTab = SplitsTab;
window.TrendChart = TrendChart;
