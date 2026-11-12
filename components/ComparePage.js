// 球員比較頁（#cmp=ID-名字~ID-名字[&sa=賽季][&sb=賽季][&t=賽別][&per=36][&pd=期間][&m=走勢指標]，獨立整頁）：版型見 _mockup/compare.html
// 只比兩位灰狼球員；計算全在 compareData.js 的 window.Compare
// 資料：逐場 bundle（數值只算灰狼場次）＋該季快照（Playtype、在場／不在場；整季合併，季中轉隊者含他隊）＋組合文件（兩人同場、球員名單）
// 兩人可各選賽季（sa／sb），賽別共用（t）；不同賽季時「兩人同場」不適用，走勢以「出賽第 N 場」對齊
// props：a、b（「ID-名字」，同網址）、sa、sb（''＝當季）、type（''＝依時節）、per（''／'36'）、pd（期間 kind）、metric、onChange(patch)、loadSnap(season, type)
const CMP_COLORS = { a: '#12A150', b: '#60a5fa' };

const ComparePage = ({ a = '', b = '', sa = '', sb = '', type = '', per = '', pd = '', metric = '', onChange, loadSnap }) => {
    const { useState, useEffect, useMemo } = React;
    const UI = window.UI, C = window.Compare;
    const tokId = (t) => window.UrlState.tokenPlayerId(t);
    const seasonA = sa || window.CURRENT_SEASON, seasonB = sb || window.CURRENT_SEASON;
    const typ = type || (seasonA === window.CURRENT_SEASON && (window.getSeasonPhase() || {}).type === 'playoffs' ? 'playoffs' : 'regular');
    const per36 = per === '36';
    const kind = C.PERIODS.some(p => p[0] === pd) ? pd : 'all';

    // ── 載入：兩季的組合文件（球員名單＋兩人同場）、兩人逐場、兩季快照 ──
    const [lu, setLu] = useState({});      // { 'season_type': doc|null }
    const [snaps, setSnaps] = useState({}); // { 'season_type': { player }|null }
    const [games, setGames] = useState({}); // { 'season_type_pid': games[] }
    const keyA = `${seasonA}_${typ}`, keyB = `${seasonB}_${typ}`;
    useEffect(() => {
        let off = false;
        [...new Set([keyA, keyB])].forEach(k => {
            if (k in lu) return;
            const [s, t] = k.split('_');
            window.loadLineups(s, t).then(v => { if (!off) setLu(m => ({ ...m, [k]: v || null })); })
                .catch(() => { if (!off) setLu(m => ({ ...m, [k]: null })); });
            if (loadSnap) loadSnap(s, t).then(v => { if (!off) setSnaps(m => ({ ...m, [k]: v || null })); })
                .catch(e => { console.warn('compare snap fail', k, e); if (!off) setSnaps(m => ({ ...m, [k]: null })); });
        });
        return () => { off = true; };
    }, [keyA, keyB]);

    // 球員名單（該季組合文件的球員，依總上場分鐘排序）
    const poolOf = (k) => {
        const d = lu[k];
        if (!d) return [];
        const mins = {};
        ((d.groups || {})['5'] || []).forEach(r => r.ids.forEach(id => { mins[id] = (mins[id] || 0) + (r.min || 0); }));
        const snapP = (snaps[k] || {}).player;
        return Object.keys(d.players || {}).map(Number).filter(id => mins[id] > 0).sort((x, y) => mins[y] - mins[x])
            .map(id => ({ id, short: d.players[id], name: C.snapName(snapP, id) || d.players[id], min: mins[id] }));
    };
    const poolA = poolOf(keyA), poolB = poolOf(keyB);
    // 預設：A＝名單第一位（上場最多）；B＝上場時間最接近 A 的另一位
    let idA = tokId(a), idB = tokId(b);
    if (!poolA.some(p => p.id === idA)) idA = poolA[0] ? poolA[0].id : null;
    if (!poolB.some(p => p.id === idB) || (idB === idA && keyA === keyB)) {
        const ref = (poolA.find(p => p.id === idA) || {}).min || 0;
        const cand = poolB.filter(p => !(p.id === idA && keyA === keyB)).sort((x, y) => Math.abs(x.min - ref) - Math.abs(y.min - ref));
        idB = cand[0] ? cand[0].id : null;
    }
    const pA = poolA.find(p => p.id === idA), pB = poolB.find(p => p.id === idB);
    const gKeyA = idA ? `${keyA}_${idA}` : '', gKeyB = idB ? `${keyB}_${idB}` : '';
    useEffect(() => {
        let off = false;
        [[gKeyA, seasonA, idA], [gKeyB, seasonB, idB]].forEach(([k, s, id]) => {
            if (!k || k in games) return;
            window.loadSeasonGames(s, typ, 'PLAYER', id).then(r => { if (!off) setGames(m => ({ ...m, [k]: (r.games || []).slice().sort((x, y) => (x.date < y.date ? -1 : 1)) })); });
        });
        return () => { off = true; };
    }, [gKeyA, gKeyB]);

    const seasons = [...new Set([window.CURRENT_SEASON, ...(window.HISTORY_SEASONS || [])])];
    const tokenOf = (p) => p ? window.UrlState.playerToken(p.id, p.name) : '';
    const header = (
        <header className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
            <h1 className="flex items-baseline gap-2 whitespace-nowrap text-[24px] font-bold leading-tight text-slate-50">
                球員比較<span className="font-mono text-[12px] font-normal text-slate-500">Compare</span>
            </h1>
            <UI.Seg size="sm" ariaLabel="賽別" value={typ} onChange={(t) => onChange({ type: t })}
                options={[{ value: 'regular', label: '例行賽' }, { value: 'playoffs', label: '季後賽' }]} />
        </header>
    );
    const loadingLists = !(keyA in lu) || !(keyB in lu);
    if (loadingLists) return <div className="pb-10">{header}<div className="py-16 text-center text-sm text-slate-500 animate-pulse">載入球員名單…</div></div>;
    if (!pA || !pB) return (
        <div className="pb-10">{header}
            <UI.Note>{!poolA.length || !poolB.length ? `${!poolA.length ? seasonA : seasonB} ${typ === 'playoffs' ? '季後賽' : '例行賽'}沒有可比較的球員資料（2022-23 以前沒有逐場資料，或沒打進季後賽）。` : '找不到球員'}</UI.Note>
        </div>
    );

    const rawA = games[gKeyA], rawB = games[gKeyB];
    const gA = rawA ? C.applyPeriod(rawA, kind) : null, gB = rawB ? C.applyPeriod(rawB, kind) : null;
    const ready = !!(gA && gB);
    const aggA = ready ? C.summarize(gA, per36) : {}, aggB = ready ? C.summarize(gB, per36) : {};
    const sameSeason = seasonA === seasonB;
    const periodLabel = (C.PERIODS.find(p => p[0] === kind) || [])[1] || '全季';
    window.CiteCtx = { subject: `${pA.name} vs ${pB.name}`, season: sameSeason ? `${seasonA} ${typ === 'playoffs' ? '季後賽' : '例行賽'}` : `${seasonA} vs ${seasonB}`,
        period: kind !== 'all' ? periodLabel : null, asOfSnap: null, asOfAgg: null, isHistory: false };

    // ── 球員卡 ──
    const card = (side) => {
        const p = side === 'a' ? pA : pB, pool = side === 'a' ? poolA : poolB, season = side === 'a' ? seasonA : seasonB;
        const other = side === 'a' ? pB : pA, otherSame = sameSeason;
        const agg = side === 'a' ? aggA : aggB, raw = side === 'a' ? gA : gB;
        const pick = (e) => { const q = pool.find(x => x.id === Number(e.target.value)); onChange({ [side]: tokenOf(q) }); };
        const opts = (short) => pool.map(x => <option key={x.id} value={x.id} disabled={otherSame && x.id === other.id}>{short ? x.short : x.name}</option>);
        const right = side === 'b';
        return (
            <div className={`flex min-w-0 items-center gap-3 border border-white/[0.08] p-2.5 sm:p-3 ${right ? 'flex-row-reverse text-right' : ''} max-sm:flex-col ${right ? 'max-sm:items-end' : 'max-sm:items-start'}`}>
                <img src={`https://cdn.nba.com/headshots/nba/latest/260x190/${p.id}.png`} alt="" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
                    className="h-[38px] w-[52px] shrink-0 rounded bg-white/[0.04] object-cover object-top sm:h-[47px] sm:w-16" />
                <div className="min-w-0 w-full">
                    <div className={`flex min-w-0 items-center gap-1.5 ${right ? 'flex-row-reverse' : ''}`}>
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CMP_COLORS[side] }} aria-hidden="true"></span>
                        <label className="sr-only" htmlFor={`cmp-${side}`}>{side === 'a' ? '左側球員' : '右側球員'}</label>
                        <select id={`cmp-${side}`} value={p.id} onChange={pick}
                            className="hidden min-w-0 max-w-full truncate border-0 border-b border-dashed border-white/20 bg-[#0A1626] text-[18px] font-bold text-slate-50 focus:outline-none sm:block">{opts(false)}</select>
                        <select aria-label={side === 'a' ? '左側球員' : '右側球員'} value={p.id} onChange={pick}
                            className="min-w-0 max-w-full truncate border-0 border-b border-dashed border-white/20 bg-[#0A1626] text-[15px] font-bold text-slate-50 focus:outline-none sm:hidden">{opts(true)}</select>
                    </div>
                    <div className={`mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] text-slate-400 ${right ? 'justify-end' : ''}`}>
                        <span className="whitespace-nowrap">{raw ? `${raw.length} 場` : '…'}{agg.MIN ? ` · ${window.fix1(agg.MIN)} 分鐘` : ''}</span>
                        <label className="sr-only" htmlFor={`cmp-s${side}`}>賽季</label>
                        <select id={`cmp-s${side}`} value={season} onChange={(e) => onChange({ [`s${side}`]: e.target.value })}
                            className="rounded-full border border-white/15 bg-[#0A1626] px-2 py-0.5 text-[11px] text-slate-300 focus:outline-none focus:border-[#12A150]">
                            {seasons.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                </div>
            </div>
        );
    };

    const fmt = (m, v) => !Number.isFinite(v) ? '—' : (/PLUS_?MINUS$/.test(m.key) ? (v > 0 ? '+' : '') : '') + window.fix1(v) + (m.unit || '');
    // 命中率類：小字附成對的出手數（A／B）；最近防守者的 vs 平常用 defs 的 att
    const attOf = (m) => { const r = (window.GameAgg.RATIO_DEFS[m.key] || window.GameAgg.EFG_DEFS[m.key]); return r ? r[r.length - 1] : (m.att || null); };
    const row = (m) => {
        const va = aggA[m.key], vb = aggB[m.key];
        if (!Number.isFinite(va) && !Number.isFinite(vb)) return null;
        const w = C.winner(m, va, vb), mx = Math.max(Math.abs(va || 0), Math.abs(vb || 0)) || 1;
        const att = attOf(m), aa = att ? aggA[att] : null, ab = att ? aggB[att] : null;
        const bar = (v, side) => (
            <span className="relative h-2 overflow-hidden bg-white/[0.05]">
                <span className={`absolute inset-y-0 ${side === 'a' ? 'right-0' : 'left-0'} ${v < 0 ? 'opacity-40' : ''}`}
                    style={{ width: `${Number.isFinite(v) ? Math.abs(v) / mx * 100 : 0}%`, background: CMP_COLORS[side] }}></span>
            </span>
        );
        return (
            <div key={m.key} className="grid grid-cols-[54px_minmax(0,1fr)_54px] items-center gap-x-2 gap-y-0.5 border-b border-white/[0.05] py-1.5 sm:grid-cols-[minmax(0,190px)_58px_minmax(0,1fr)_58px]">
                <div className="col-span-3 flex min-w-0 items-baseline justify-between gap-2 text-[12.5px] text-slate-200 sm:col-span-1 sm:block">
                    <span className="truncate">{m.longLabel || m.label}</span>
                    <span className="truncate font-mono text-[10px] text-slate-500 sm:block">{m.englishLabel}{Number.isFinite(aa) && Number.isFinite(ab) ? ` · ${window.fix1(aa)}／${window.fix1(ab)} 次` : ''}</span>
                </div>
                <div className={`whitespace-nowrap font-mono text-[13.5px] tabular-nums sm:text-right ${w === 'a' ? 'font-medium text-[#34D399]' : 'text-slate-200'}`}>{fmt(m, va)}</div>
                <div className="grid grid-cols-2 gap-0.5">{bar(va, 'a')}{bar(vb, 'b')}</div>
                <div className={`whitespace-nowrap text-right font-mono text-[13.5px] tabular-nums sm:text-left ${w === 'b' ? 'font-medium text-[#60a5fa]' : 'text-slate-200'}`}>{fmt(m, vb)}</div>
            </div>
        );
    };

    const gaps = ready ? C.biggestGaps(gA, gB, aggA, aggB, per36) : [];
    const small = ready && Math.min(gA.length, gB.length) < window.SMALL_SAMPLE_GAMES;
    const flat = C.groups().flatMap(g => g.metrics);
    const trendKey = flat.some(m => m.key === metric) ? metric : 'PTS';
    const trendDef = flat.find(m => m.key === trendKey) || { label: '得分' };
    const tr = ready ? C.trend(gA, gB, trendKey, per36, sameSeason) : null;

    // ── 兩人同場（同季才有）──
    const luDoc = lu[keyA];
    const pair = sameSeason && luDoc ? ((luDoc.groups || {})['2'] || []).find(r => r.ids.includes(pA.id) && r.ids.includes(pB.id)) : null;
    const onoffOf = (k, p) => { const sp = (snaps[k] || {}).player; const n = sp ? C.snapName(sp, p.id) : null; return n && sp.onoff ? sp.onoff[n] || null : null; };
    const ooA = onoffOf(keyA, pA), ooB = onoffOf(keyB, pB);
    const sg = (v) => (Number.isFinite(v) ? (v > 0 ? '+' : '') + window.fix1(v) : '—');
    const tone = (v) => (v > 0 ? 'text-[#34D399]' : v < 0 ? 'text-[#F87171]' : 'text-slate-50');
    const cellBox = (label, value, sub, cls = 'text-slate-50') => (
        <div className="min-w-0 border-r border-b border-white/[0.08] px-3 pt-2.5 pb-3">
            <div className="truncate text-[11px] leading-tight text-slate-300">{label}</div>
            <div className={`mt-2 whitespace-nowrap font-display text-[26px] font-semibold leading-none tabular-nums ${cls}`}>{value}</div>
            {sub && <div className="mt-1.5 truncate font-mono text-[11px] text-slate-500">{sub}</div>}
        </div>
    );

    // ── Playtype（快照）──
    const ptOf = (k, p) => { const sp = (snaps[k] || {}).player; const n = sp ? C.snapName(sp, p.id) : null;
        return Object.fromEntries(((sp && n && sp.stats && sp.stats[n]) || []).filter(x => (x.side || 'offensive') === 'offensive').map(x => [x.playType, x])); };
    const ptA = ptOf(keyA, pA), ptB = ptOf(keyB, pB);
    const ptTypes = (window.PlayTypesList || []).filter(t => t !== 'Misc' && (((ptA[t] || {}).poss || 0) >= 0.5 || ((ptB[t] || {}).poss || 0) >= 0.5))
        .sort((x, y) => (((ptB[y] || {}).poss || 0) + ((ptA[y] || {}).poss || 0)) - (((ptB[x] || {}).poss || 0) + ((ptA[x] || {}).poss || 0)));
    const ptCell = (x, side) => !x ? <div className="font-mono text-[12px] text-slate-600">—</div> : (
        <div className="grid grid-cols-[auto_minmax(0,1fr)_30px] items-center gap-2 whitespace-nowrap font-mono text-[12px]">
            <span className="text-slate-200">{window.fix1(x.poss)} 次<span className="text-slate-500">／</span>{typeof x.ppp === 'number' ? x.ppp.toFixed(2) : '—'} <span className="text-[10.5px] text-slate-500">PPP</span></span>
            <span className="relative h-1.5 bg-white/[0.06]"><span className="absolute inset-y-0 left-0" style={{ width: `${x.percentile || 0}%`, background: CMP_COLORS[side] }}></span></span>
            <span className="text-right text-slate-400">{typeof x.percentile === 'number' ? Math.round(x.percentile) : '—'}</span>
        </div>
    );

    const sameHref = window.UrlState.lineupsHref({ n: 3, picks: [tokenOf(pA), tokenOf(pB)], season: sameSeason && seasonA !== window.CURRENT_SEASON ? seasonA : '', type: type || '' });
    return (
        <div className="pb-10">
            {header}
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5 sm:gap-2.5">
                {card('a')}
                <div className="flex flex-col items-center gap-1 font-display text-[16px] text-slate-500">VS
                    <button type="button" aria-label="左右對調" title="左右對調" onClick={() => onChange({ a: tokenOf(pB), b: tokenOf(pA), sa: sb, sb: sa })}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/15 text-[13px] text-slate-300 hover:border-white/30">⇄</button>
                </div>
                {card('b')}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="flex items-center gap-2"><span className="text-[12px] text-slate-500">數值</span>
                    <UI.Seg size="sm" ariaLabel="數值" value={per36 ? '36' : ''} onChange={(v) => onChange({ per: v })}
                        options={[{ value: '', label: '場均' }, { value: '36', label: '每 36 分鐘' }]} /></span>
                <span className="flex min-w-0 items-center gap-2"><span className="shrink-0 text-[12px] text-slate-500">期間</span>
                    <span className="flex min-w-0 gap-1.5 overflow-x-auto py-0.5 [scrollbar-width:none]">
                        {C.PERIODS.map(([k, l]) => <UI.Chip key={k} active={kind === k} onClick={() => onChange({ pd: k === 'all' ? '' : k })}>{l}</UI.Chip>)}
                    </span></span>
            </div>
            {small && <div className="mt-3"><UI.Note tone="warn">樣本小：{gA.length < gB.length ? pA.short : pB.short} 只有 {Math.min(gA.length, gB.length)} 場（{periodLabel}），數字僅供參考。</UI.Note></div>}
            {!ready ? <div className="py-16 text-center text-sm text-slate-500 animate-pulse">載入逐場資料…</div> : (gA.length === 0 || gB.length === 0) ? (
                <div className="mt-4"><UI.Note>{gA.length === 0 ? pA.short : pB.short} 在這個期間沒有比賽。</UI.Note></div>
            ) : (<>
                <UI.Section className="mt-8" title="差距最大的五項" en="Biggest Gaps" accent="green"
                    sub="依「差距 ÷ 兩人逐場波動」排序，不是看絕對差多少；次數類（觸球、切入次數）不列入">
                    {gaps.length === 0 ? <UI.Note>沒有足夠的逐場資料排出差距（每人每項至少 3 場）。</UI.Note> : (
                        <div className="grid grid-cols-2 border-l border-t border-white/[0.08] sm:grid-cols-5">
                            {/* 只寫事實「誰較高」、顏色代表球員：次數類（急停出手、傳球次數）多不等於好，不下「較佳」的判斷 */}
                            {gaps.map(g => { const hi = g.a > g.b ? 'a' : 'b'; return (
                                <div key={g.m.key} className="min-w-0 border-r border-b border-white/[0.08] px-3 pt-2.5 pb-3">
                                    <div className="truncate text-[11px] text-slate-300">{g.m.longLabel || g.m.label}</div>
                                    <div className="mt-1.5 whitespace-nowrap font-display text-[24px] font-semibold leading-none tabular-nums">
                                        <span className={hi === 'a' ? 'text-[#34D399]' : 'text-slate-400'}>{fmt(g.m, g.a)}</span>
                                        <span className="mx-1 text-[14px] text-slate-600">:</span>
                                        <span className={hi === 'b' ? 'text-[#60a5fa]' : 'text-slate-400'}>{fmt(g.m, g.b)}</span>
                                    </div>
                                    <div className={`mt-1 whitespace-nowrap text-[11px] ${hi === 'a' ? 'text-[#34D399]' : 'text-[#60a5fa]'}`}>{(hi === 'a' ? pA : pB).short} 較高</div>
                                </div>
                            ); })}
                        </div>
                    )}
                </UI.Section>

                <UI.Section className="mt-8" title="逐項對照" en="Side by Side" accent="green"
                    sub={`${periodLabel} · 較好的一側上色；小字是成對的出手數（${pA.short}／${pB.short}）· 命中率與效率不受「每 36 分鐘」影響`}>
                    <div className="grid gap-x-10 lg:grid-cols-2">
                        {C.groups().map(g => {
                            const rows = g.metrics.map(row).filter(Boolean);
                            return rows.length ? (
                                <div key={g.id}>
                                    <div className="mt-3 mb-1 flex items-baseline justify-between text-[13px] text-slate-300"><span>{g.title}</span><span className="font-mono text-[10.5px] text-slate-500">{g.en}</span></div>
                                    {rows}
                                </div>
                            ) : null;
                        })}
                    </div>
                </UI.Section>

                <UI.Section className="mt-8" title="兩人同場" en="Together" accent="blue"
                    sub={sameSeason ? '兩人同時在場上時球隊的表現（整季，不受上方期間與每 36 分鐘影響），對照各自在場／不在場' : '兩人不同賽季，沒有同場資料'}
                    right={sameSeason && pair ? <a href={sameHref} className="inline-flex min-h-[24px] items-center whitespace-nowrap text-[12px] text-slate-300 hover:text-slate-50">含這兩人的所有組合 →</a> : null}>
                    {!sameSeason ? null : !pair ? <UI.Note>這兩位在 {seasonA} {typ === 'playoffs' ? '季後賽' : '例行賽'}沒有同場紀錄{luDoc ? '' : '（這季沒有組合資料）'}。</UI.Note> : (
                        <div className="grid grid-cols-2 border-l border-t border-white/[0.08] sm:grid-cols-4">
                            {cellBox('同場分鐘', Math.round(pair.min), `${pair.gp} 場 · 整季總分鐘`)}
                            {cellBox('同場進攻效率', window.fix1(pair.off), '每 100 回合得分')}
                            {cellBox('同場防守效率', window.fix1(pair.def), '每 100 回合失分')}
                            {cellBox('同場淨效率', sg(pair.net), `TS% ${typeof pair.ts === 'number' ? pair.ts.toFixed(1) : '—'}`, tone(pair.net))}
                            {[[pA, ooA, 'a'], [pB, ooB, 'b']].flatMap(([p, oo, side]) => [
                                <React.Fragment key={side + 'on'}>{cellBox(<><span style={{ color: CMP_COLORS[side] }}>{p.short}</span> 在場淨效率</>, sg(oo && oo.ON_NET_RATING), oo && oo.ON_MIN ? `${Math.round(oo.ON_MIN)} 分鐘` : '', tone(oo && oo.ON_NET_RATING))}</React.Fragment>,
                                <React.Fragment key={side + 'off'}>{cellBox(<><span style={{ color: CMP_COLORS[side] }}>{p.short}</span> 不在場</>, sg(oo && oo.OFF_NET_RATING), oo && oo.OFF_MIN ? `${Math.round(oo.OFF_MIN)} 分鐘` : '', tone(oo && oo.OFF_NET_RATING))}</React.Fragment>,
                            ])}
                        </div>
                    )}
                </UI.Section>

                <UI.Section className="mt-8" title="逐場走勢" en="Game by Game" accent="green"
                    sub={sameSeason ? `${periodLabel} · 以比賽日期對齊（沒上場的日子留空）` : `${periodLabel} · 兩人不同賽季，以「出賽第 N 場」對齊`}
                    right={<>
                        <label className="sr-only" htmlFor="cmp-metric">走勢指標</label>
                        <select id="cmp-metric" value={trendKey} onChange={(e) => onChange({ metric: e.target.value })} className={UI.selectClass(true)}>
                            {C.groups().map(g => <optgroup key={g.id} label={g.title}>{g.metrics.map(m => <option key={m.key} value={m.key}>{m.longLabel || m.label}</option>)}</optgroup>)}
                        </select>
                    </>}>
                    {window.LineOverlay && tr && (
                        <window.LineOverlay xs={tr.xs} unit={trendDef.unit === '%' ? '%' : ''} height={260} ariaLabel={`${trendDef.label}逐場走勢`}
                            series={[{ key: 'a', label: pA.short, color: CMP_COLORS.a, values: tr.a, width: 2.2 }, { key: 'b', label: pB.short, color: CMP_COLORS.b, values: tr.b, width: 2.2 }]} />
                    )}
                </UI.Section>

                <UI.Section className="mt-8" title="Playtype" en="Synergy · 進攻端" accent="green"
                    sub="整季快照（含季中轉隊前在他隊的比賽；不受上方期間影響）· 場均次數／每球權得分 · 橫條＝聯盟百分位">
                    {ptTypes.length === 0 ? <UI.Note>{(keyA in snaps) && (keyB in snaps) ? '沒有 Playtype 資料' : '載入快照中…'}</UI.Note> : (<>
                        <div className="hidden grid-cols-[130px_minmax(0,1fr)_minmax(0,1fr)] gap-5 border-b border-white/[0.08] pb-1 text-[11px] text-slate-500 sm:grid">
                            <span>類型</span><span style={{ color: CMP_COLORS.a }}>{pA.short}</span><span style={{ color: CMP_COLORS.b }}>{pB.short}</span>
                        </div>
                        {ptTypes.map(t => (
                            <div key={t} className="grid grid-cols-1 items-center gap-1 border-b border-white/[0.05] py-2 sm:grid-cols-[130px_minmax(0,1fr)_minmax(0,1fr)] sm:gap-5">
                                <div className="text-[13px] text-slate-200">{window.ptName(t)}</div>
                                {ptCell(ptA[t], 'a')}{ptCell(ptB[t], 'b')}
                            </div>
                        ))}
                    </>)}
                </UI.Section>
                <p className="mt-6 text-[12px] leading-relaxed text-slate-500">資料來源：NBA.com Stats。逐項對照與走勢只算灰狼場次（逐場加總，命中率以 Σ命中 ÷ Σ出手 重算）；兩人同場、在場／不在場、Playtype 為整季數字。</p>
            </>)}
        </div>
    );
};

window.ComparePage = ComparePage;
