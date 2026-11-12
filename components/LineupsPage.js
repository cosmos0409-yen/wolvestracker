// 組合數據頁（#lineups[&n=2|3|5][&p=ID-名字~ID-名字][&min=分鐘][&view=mx][&s=賽季&t=賽別]，獨立整頁）：版型見 _mockup/lineups.html
// 資料只讀一份文件 wolves_games_index/{season}_{type}_lineups（gamesData.loadLineups）：二人／三人／五人全部組合，每天覆寫、不留逐日歷史
//   → 時光機（數據截至）管不到這頁，頁首自己寫「數據截至」；歷史賽季是季末值
// 分鐘一律是整季「總上場分鐘」；效率＝每 100 回合得／失分（NBA.com Lineups Advanced）
// 上場時間短的組合效率值很極端（17 分鐘淨效率 +80），所以預設濾掉未達最少分鐘的組合，並在下方說明濾掉幾組
// props：season、type（'regular'|'playoffs'）、n（2|3|5）、picks（「ID-名字」陣列，同網址 p=）、min（null＝該人數預設）、view（''|'mx'）、onChange(patch)
const LINEUP_SIZES = [2, 3, 5];
const LINEUP_MIN_OPTS = { 2: [0, 25, 50, 100, 200], 3: [0, 25, 50, 100, 200], 5: [0, 5, 10, 20, 50] };
const LINEUP_MIN_DEFAULT = { 2: 50, 3: 50, 5: 10 };
const LINEUP_LABEL = { 2: '二人', 3: '三人', 5: '五人' };
const LINEUP_EN = { 2: '2-Man Combinations', 3: '3-Man Combinations', 5: '5-Man Lineups' };
window.LINEUP_MIN_DEFAULT = LINEUP_MIN_DEFAULT;

const LineupsPage = ({ season, type, n = 2, picks = [], min = null, view = '', onChange }) => {
    const { useState, useEffect, useMemo } = React;
    const UI = window.UI;
    const [docState, setDocState] = useState({ key: null, v: undefined, err: null });   // v: undefined=載入中, null=沒有這份
    const [retry, setRetry] = useState(0);
    const key = `${season}_${type}`;
    useEffect(() => {
        let cancelled = false;
        setDocState({ key, v: undefined, err: null });
        window.loadLineups(season, type)
            .then(v => { if (!cancelled) setDocState({ key, v: v || null, err: null }); })
            .catch(e => { console.error('lineups load fail', e); if (!cancelled) setDocState({ key, v: null, err: e }); });
        return () => { cancelled = true; };
    }, [key, retry]);
    UI.useTabKeys(LINEUP_SIZES.map(String), (k) => onChange({ n: Number(k) }));

    const d = docState.key === key ? docState.v : undefined;
    const names = (d && d.players) || {};
    // 每位球員的總上場分鐘（五人組合分鐘加總＝他在場上的時間）：決定名字順序與「含球員」清單順序
    const playerMin = useMemo(() => {
        const out = {};
        ((d && d.groups && d.groups['5']) || []).forEach(r => r.ids.forEach(id => { out[id] = (out[id] || 0) + (r.min || 0); }));
        return out;
    }, [d]);
    const players = useMemo(() => Object.keys(names).map(Number).filter(id => playerMin[id] > 0)
        .sort((a, b) => playerMin[b] - playerMin[a]), [names, playerMin]);

    const seasons = [...new Set([window.CURRENT_SEASON, ...(window.HISTORY_SEASONS || [])])];
    const header = (
        <header className="mb-1 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
            <div className="min-w-0">
                <h1 className="flex items-baseline gap-2 whitespace-nowrap text-[24px] font-bold leading-tight text-slate-50">
                    組合數據<span className="font-mono text-[12px] font-normal text-slate-500">Lineups</span>
                </h1>
                <p className="mt-1 text-[12px] leading-relaxed text-slate-400">
                    {d ? <>{season} {type === 'playoffs' ? '季後賽' : '例行賽'} · {d.asOf === 'final' ? '季末' : `數據截至 ${d.asOf}`}{d.gp ? `（${d.gp} 場）` : ''} · </> : null}
                    效率＝每 100 回合得／失分 · 分鐘為整季總上場分鐘
                </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
                <label className="sr-only" htmlFor="lineups-season">賽季</label>
                <select id="lineups-season" value={season} onChange={e => onChange({ season: e.target.value })}
                    className="rounded-full border border-white/15 bg-[#0A1626] px-3 py-1 text-xs text-slate-200 focus:outline-none focus:border-[#12A150]">
                    {seasons.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <UI.Seg size="sm" ariaLabel="賽別" value={type} onChange={(t) => onChange({ type: t })}
                    options={[{ value: 'regular', label: '例行賽' }, { value: 'playoffs', label: '季後賽' }]} />
            </div>
        </header>
    );

    if (d === undefined) return <div className="pb-10">{header}<div className="py-16 text-center text-sm text-slate-500 animate-pulse">載入組合數據…</div></div>;
    if (!d) return (
        <div className="pb-10">{header}
            <div className="mt-4">
                {docState.err ? (
                    <UI.Note tone="warn">
                        <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
                            <span>{docState.err.code === 'permission-denied' ? '讀取被拒（安全規則）' : '讀取組合數據失敗，可能是連線中斷'}</span>
                            <button type="button" onClick={() => setRetry(x => x + 1)}
                                className="rounded-full border border-amber-400/50 px-3 py-1 text-xs text-amber-200 hover:bg-amber-400/10">重試</button>
                        </span>
                    </UI.Note>
                ) : (
                    <UI.Note>{season} {type === 'playoffs' ? '季後賽' : '例行賽'}沒有組合數據{type === 'playoffs' ? '（沒有打進季後賽，或還沒開打）' : '（2022-23 以前的賽季沒有回補）'}。</UI.Note>
                )}
            </div>
        </div>
    );

    const minNow = min == null ? LINEUP_MIN_DEFAULT[n] : min;
    // picks 是網址的「ID-名字」：只用 ID 對人；不在這季名單裡的人略過（換賽季時）
    const pickNow = [...new Set(picks.map(t => window.UrlState.tokenPlayerId(t)))].filter(id => id && names[id]).slice(0, n);
    const tokens = (ids) => ids.map(id => window.UrlState.playerToken(id, names[id]));
    const all = (d.groups[String(n)] || []).filter(r => pickNow.every(id => r.ids.includes(id)));
    const ok = all.filter(r => (r.min || 0) >= minNow);
    const low = all.length - ok.length;
    const order = (ids) => ids.slice().sort((a, b) => (playerMin[b] || 0) - (playerMin[a] || 0));
    const nameList = (ids, hi = []) => order(ids).map((id, i) => (
        <React.Fragment key={id}>
            {i > 0 && <span className="text-slate-600"> · </span>}
            <span className={hi.includes(id) ? 'font-medium text-slate-50' : ''}>{names[id] || id}</span>
        </React.Fragment>
    ));
    const textNames = (ids) => order(ids).map(id => names[id] || id).join(' · ');
    const f1 = (v) => typeof v === 'number' ? window.fix1(v) : '—';
    const sg = (v) => typeof v !== 'number' ? '—' : (v > 0 ? '+' : '') + window.fix1(v);
    const tone = (v) => v > 0 ? 'text-[#12A150]' : v < 0 ? 'text-[#EF4444]' : 'text-slate-200';
    const typeLabel = type === 'playoffs' ? '季後賽' : '例行賽';
    window.CiteCtx = { subject: 'Minnesota Timberwolves', season: `${season} ${typeLabel}`, asOfSnap: d.asOf === 'final' ? null : d.asOf, asOfAgg: null, isHistory: d.asOf === 'final' };

    // ── 摘要四格 ──
    const most = ok.slice().sort((a, b) => b.min - a.min)[0];
    const best = ok.slice().sort((a, b) => b.net - a.net)[0];
    const worst = ok.slice().sort((a, b) => a.net - b.net)[0];
    const cell = (label, r, value, cls = 'text-slate-50') => (
        <div className="min-w-0 border-r border-b border-white/[0.08] px-3 pt-2.5 pb-3">
            <div className="text-[11px] leading-tight text-slate-300">{label}</div>
            {r ? (<>
                <div className="mt-2 flex items-baseline gap-1.5 whitespace-nowrap">
                    <span className={`font-display text-[26px] font-semibold leading-none tabular-nums ${cls}`}>{value}</span>
                    <span className="font-mono text-[11px] text-slate-500">{Math.round(r.min)} 分鐘</span>
                </div>
                <div className="mt-1.5 truncate text-[12px] text-slate-400" title={textNames(r.ids)}>{textNames(r.ids)}</div>
            </>) : <div className="mt-2 font-display text-[26px] font-semibold leading-none text-slate-600">—</div>}
        </div>
    );
    const summary = (
        <div className="grid grid-cols-2 sm:grid-cols-4 border-t border-l border-white/[0.08]">
            <div className="min-w-0 border-r border-b border-white/[0.08] px-3 pt-2.5 pb-3">
                <div className="text-[11px] leading-tight text-slate-300">符合條件</div>
                <div className="mt-2 flex items-baseline gap-1.5 whitespace-nowrap">
                    <span className="font-display text-[26px] font-semibold leading-none tabular-nums text-slate-50">{ok.length}</span>
                    <span className="font-mono text-[11px] text-slate-500">／ {all.length} 組</span>
                </div>
                <div className="mt-1.5 truncate text-[12px] text-slate-400">
                    {pickNow.length ? `含 ${pickNow.map(id => names[id]).join('、')}` : '全隊'} · {minNow ? `${minNow} 分鐘以上` : '不限分鐘'}
                </div>
            </div>
            {cell('上場最久', most, most ? `${Math.round(most.min)}′` : '')}
            {cell('淨效率最高', best, best ? sg(best.net) : '', best ? tone(best.net) : undefined)}
            {cell('淨效率最低', worst, worst ? sg(worst.net) : '', worst ? tone(worst.net) : undefined)}
        </div>
    );

    // ── 表格 ──
    const netBar = (v) => {
        if (typeof v !== 'number') return null;
        const w = Math.min(Math.abs(v), 30) / 30 * 50;
        return (
            <span aria-hidden="true" className="relative mr-2 hidden h-1.5 w-16 align-middle bg-white/[0.06] sm:inline-block">
                <span className="absolute -top-0.5 -bottom-0.5 left-1/2 w-px bg-white/15"></span>
                <span className="absolute top-0 bottom-0" style={v >= 0 ? { left: '50%', width: `${w}%`, background: '#12A150' } : { right: '50%', width: `${w}%`, background: '#EF4444' }}></span>
            </span>
        );
    };
    const table = (
        <UI.DataTable caption={`${LINEUP_LABEL[n]}組合`} rows={ok} rowKey={(r) => r.ids.join('-')} stackFirst limit={15} unit="組"
            exportTitle={`${LINEUP_LABEL[n]}組合${pickNow.length ? `（含 ${pickNow.map(id => names[id]).join('、')}）` : ''}`}
            exportSource="資料：NBA.com Stats（Lineups）"
            initialSort={{ key: 'min', dir: 'desc' }}
            columns={[
                { key: 'ids', label: '組合', align: 'left', render: (r) => nameList(r.ids, pickNow), sortValue: (r) => textNames(r.ids), csv: (r) => textNames(r.ids) },
                { key: 'gp', label: '場數', en: 'GP' },
                { key: 'min', label: '分鐘', en: 'MIN', render: (r) => Math.round(r.min) },
                { key: 'off', label: '進攻效率', en: 'OffRtg', render: (r) => f1(r.off) },
                { key: 'def', label: '防守效率', en: 'DefRtg', render: (r) => f1(r.def) },
                { key: 'net', label: '淨效率', en: 'NetRtg', render: (r) => <span className={tone(r.net)}>{netBar(r.net)}{sg(r.net)}</span> },
                { key: 'ts', label: '真實命中率', en: 'TS%', render: (r) => typeof r.ts === 'number' ? `${r.ts.toFixed(1)}%` : '—' },
                { key: 'poss', label: '回合', en: 'POSS' },
            ]} />
    );

    // ── 二人矩陣：兩人同場時球隊的淨效率 ──
    const matrix = () => {
        const pairs = {};
        (d.groups['2'] || []).forEach(r => { pairs[r.ids.slice().sort((a, b) => a - b).join('-')] = r; });
        const ok2 = (d.groups['2'] || []).filter(r => r.min >= minNow);
        const inMx = players.filter(id => ok2.some(r => r.ids.includes(id)));
        if (!inMx.length) return <UI.Note>沒有達到 {minNow} 分鐘的二人組合，試著把最少分鐘調低。</UI.Note>;
        const bg = (v) => { const a = Math.min(Math.abs(v), 25) / 25 * 0.8 + 0.1; return v >= 0 ? `rgba(18,161,80,${a})` : `rgba(239,68,68,${a})`; };
        return (<>
            <div className="overflow-x-auto" style={UI.scrollHint}>
                <table className="border-collapse font-mono text-[12px]">
                    <caption className="sr-only">二人組合淨效率矩陣</caption>
                    <thead>
                        <tr>
                            <th className="sticky left-0 z-[1] bg-[#0A1626]"></th>
                            {inMx.map(id => (
                                <th key={id} scope="col" className="h-[92px] px-1 pb-1.5 align-bottom font-sans text-[11px] font-normal whitespace-nowrap text-slate-400 [writing-mode:vertical-rl]">{names[id]}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {inMx.map(a => (
                            <tr key={a}>
                                <th scope="row" className="sticky left-0 z-[1] bg-[#0A1626] pr-2.5 text-left font-sans text-[11px] font-normal whitespace-nowrap text-slate-300">{names[a]}</th>
                                {inMx.map(b => {
                                    if (a === b) return <td key={b} className="h-[38px] min-w-[52px] border border-[#0A1626] bg-white/[0.03]"></td>;
                                    const r = pairs[[a, b].sort((x, y) => x - y).join('-')];
                                    if (!r || r.min < minNow) return (
                                        <td key={b} title={r ? `${names[a]} + ${names[b]}：${Math.round(r.min)} 分鐘，未達門檻` : `${names[a]} + ${names[b]}：沒有同場`}
                                            className="h-[38px] min-w-[52px] border border-[#0A1626] bg-white/[0.02] text-center text-slate-600">·</td>
                                    );
                                    return (
                                        <td key={b} title={`${names[a]} + ${names[b]}：${Math.round(r.min)} 分鐘 · 淨效率 ${sg(r.net)}`}
                                            className="h-[38px] min-w-[52px] border border-[#0A1626] px-1 text-center leading-tight text-white" style={{ background: bg(r.net) }}>
                                            {sg(r.net)}<span className="block text-[9.5px] text-white/60">{Math.round(r.min)}′</span>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                <span>淨效率</span><span>−25</span>
                <span aria-hidden="true" className="inline-block h-2 w-24" style={{ background: 'linear-gradient(to right, rgba(239,68,68,.9), rgba(239,68,68,.15), rgba(18,161,80,.15), rgba(18,161,80,.9))' }}></span>
                <span>+25</span><span>· 小字＝同場分鐘 · 「·」＝未達最少分鐘或沒有同場</span>
            </div>
        </>);
    };

    const isMx = n === 2 && view === 'mx';
    const togglePick = (id) => onChange({ picks: tokens(pickNow.includes(id) ? pickNow.filter(x => x !== id) : [...pickNow, id]) });
    return (
        <div className="pb-10">
            {header}
            <UI.TabBar ariaLabel="組合人數" bleed value={String(n)} onChange={(k) => onChange({ n: Number(k) })}
                tabs={LINEUP_SIZES.map(k => ({ key: String(k), label: <>{LINEUP_LABEL[k]}<span className="ml-1 font-mono text-[10px] font-normal text-slate-500">{(d.groups[String(k)] || []).length}</span></> }))} />

            <div className="mt-3 flex min-w-0 items-center gap-2">
                <span className="shrink-0 text-[12px] text-slate-500">含球員</span>
                <div className="flex min-w-0 gap-1.5 overflow-x-auto py-0.5 [scrollbar-width:none]" style={UI.scrollHint}>
                    {players.map(id => {
                        const on = pickNow.includes(id);
                        const full = !on && pickNow.length >= n;
                        return (
                            <button key={id} type="button" aria-pressed={on} disabled={full} onClick={() => togglePick(id)}
                                title={full ? `最多選 ${n} 人` : `${Math.round(playerMin[id])} 分鐘`}
                                className={`min-h-[28px] shrink-0 rounded-full border px-3 text-xs whitespace-nowrap transition-colors ${on ? 'border-[#12A150] bg-[#12A150]/10 text-slate-50' : full ? 'cursor-not-allowed border-white/10 text-slate-600' : 'border-white/15 text-slate-400 hover:border-white/30 hover:text-slate-100'}`}>
                                {names[id]}
                            </button>
                        );
                    })}
                </div>
            </div>
            <div className="mt-2 mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="flex items-center gap-2">
                    <span className="text-[12px] text-slate-500">最少分鐘</span>
                    <UI.Seg size="sm" ariaLabel="最少分鐘" value={minNow} onChange={(m) => onChange({ min: m === LINEUP_MIN_DEFAULT[n] ? null : m })}
                        options={LINEUP_MIN_OPTS[n].map(m => ({ value: m, label: m ? `${m}+` : '全部' }))} />
                </span>
                {n === 2 && (
                    <span className="flex items-center gap-2">
                        <span className="text-[12px] text-slate-500">檢視</span>
                        <UI.Seg size="sm" ariaLabel="檢視方式" value={isMx ? 'mx' : ''} onChange={(v) => onChange({ view: v })}
                            options={[{ value: '', label: '表格' }, { value: 'mx', label: '矩陣' }]} />
                    </span>
                )}
            </div>

            {summary}

            <UI.Section className="mt-8" title={`${LINEUP_LABEL[n]}組合`} en={LINEUP_EN[n]} accent="blue"
                sub={isMx ? '兩人同時在場上時球隊的淨效率；滑鼠移到格子看分鐘' : `點欄位標題排序 · 點上方球員只看含他的組合（最多選 ${n} 人）`}>
                {isMx ? matrix() : (ok.length ? table : <UI.Note>沒有符合條件的組合，試著把最少分鐘調低{pickNow.length ? '或少選幾位球員' : ''}。</UI.Note>)}
                {!isMx && low > 0 && (
                    <p className="mt-3 border-l-2 border-amber-400 pl-2 text-[12px] leading-relaxed text-amber-200">
                        另有 {low} 組未達 {minNow} 分鐘，沒有列出。上場時間短的組合效率值波動很大，引用前請看分鐘數。
                    </p>
                )}
                {d.trimmed && <p className="mt-2 text-[12px] text-slate-500">組合太多、超過單一文件上限，已略去上場最少的部分組合。</p>}
            </UI.Section>
            <p className="mt-6 text-[12px] leading-relaxed text-slate-500">資料來源：NBA.com Lineups（Advanced）。當季每日更新、只保留最新一份；歷史賽季為季末值。</p>
        </div>
    );
};

window.LineupsPage = LineupsPage;
