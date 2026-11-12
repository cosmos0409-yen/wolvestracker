// 投籃分頁：讀 shotchart 逐球資料 → 距離區間/分區/出手方式卡片牆（期間 vs 全季）
//   + 受助攻卡（全季快照）+ 篩選熱圖 + 點卡片展開趨勢折線
//   + 分區「與上季比」：讀上一季同一實體的 shotchart，比各區命中率與出手占比（本季套期間篩選、上季為全季）
// gameMeta：{date:{wl,matchup}}，走勢鋪勝負底色用（出手本身只帶 gdate）
// 期間（2026-11 起是全域控制，見 periodFilter.js）：periodDates＝期間內的比賽日期 Set（null＝全季）、periodLabel、
//   periodWaiting＝條件資料還沒到齊或沒填完。逐球帶比賽日期，所以勝敗、對手、條件都能篩；受助攻是整季快照，篩選時停用

// 讀 wolves_shotcharts/{id}_{season}_{type} 並解析成 {shots, assisted}；不存在回 null。快取在 window.__shootTabCache
const loadShotDoc = async (docId) => {
    const cache = (window.__shootTabCache = window.__shootTabCache || {});
    if (cache[docId] !== undefined) return cache[docId];
    const { doc: docFn, getDoc } = window.firebaseModules;
    const snap = await getDoc(docFn(window.db, 'wolves_shotcharts', docId));   // 失敗往上拋，呼叫端決定怎麼顯示
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
    return v;
};
window.loadShotDoc = loadShotDoc;   // 對戰頁共用（同一份快取）
// '2025-26' → '2024-25'
const prevSeasonOf = (season) => { const y = parseInt(String(season).slice(0, 4), 10) - 1; return `${y}-${String((y + 1) % 100).padStart(2, '0')}`; };

const ShootingTab = ({ playerId, teamMode, season, typeKey, playerName, seasonLabel, gameMeta, periodDates = null, periodLabel: pLabel = '全季', periodWaiting = false, scoring = null }) => {
    const { useState, useEffect } = React;
    const TrendChart = window.TrendChart;
    const ShotChart = window.ShotChart;

    const [doc, setDoc] = useState(undefined); // undefined=載入中, null=無, {shots,assisted}
    const [group, setGroup] = useState('dist');
    const [openKey, setOpenKey] = useState(null);
    const [gran, setGran] = useState('game');
    const shootLedgerRef = React.useRef(null);   // 匯出命中率格用（hook 須在提早 return 之前）
    const [compare, setCompare] = useState(false);       // 分區「與上季比」
    const [prevDoc, setPrevDoc] = useState(undefined);
    const diffRef = React.useRef(null);

    const idPart = teamMode ? 'TEAM' : playerId;

    useEffect(() => {
        if ((!playerId && !teamMode) || !season || !typeKey || !window.db || !window.firebaseModules) return;
        let cancelled = false;
        setDoc(undefined);
        const docId = `${idPart}_${season}_${typeKey}`;
        loadShotDoc(docId).then(v => { if (!cancelled) setDoc(v); })
            .catch(e => { console.error('shooting doc fail', docId, e); if (!cancelled) setDoc(null); });
        return () => { cancelled = true; };
    }, [idPart, season, typeKey]);

    // 與上季比：打開時才讀上季文件（undefined=未讀/讀取中, null=上季沒有）
    const prevSeason = season ? prevSeasonOf(season) : null;
    useEffect(() => {
        if (!compare || !prevSeason || (!playerId && !teamMode) || !window.db || !window.firebaseModules) return;
        let cancelled = false;
        setPrevDoc(undefined);
        const docId = `${idPart}_${prevSeason}_${typeKey}`;
        loadShotDoc(docId).then(v => { if (!cancelled) setPrevDoc(v && v.shots.length ? v : null); })
            .catch(e => { console.error('prev shooting doc fail', docId, e); if (!cancelled) setPrevDoc(null); });
        return () => { cancelled = true; };
    }, [compare, idPart, prevSeason, typeKey]);

    const UI = window.UI;
    if (doc === undefined) return <div className="py-10 text-center text-sm text-slate-500 animate-pulse">載入投籃資料中…</div>;
    if (doc === null || !doc.shots.length) return <UI.Note>此賽季尚無逐球投籃資料（賽後隔天更新，且僅近幾季有）</UI.Note>;

    const allShots = doc.shots;
    const meta = gameMeta || {};

    // 期間篩選（全域）：逐球依比賽日期篩
    const filtered = !!periodDates;
    const periodShots = filtered ? allShots.filter(s => periodDates.has(s.gdate)) : allShots;
    const periodLabel = filtered ? pLabel : '全季';
    if (periodWaiting) return <div className="py-10 text-center text-sm text-slate-500 animate-pulse">等待期間條件（讀取逐場資料或條件還沒填完）…</div>;

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

    // ── 與上季比（只在分區組）──本季套用期間篩選；上季一律全季
    const cmpOn = compare && group === 'zone' && !!prevDoc;
    const prevShots = prevDoc ? prevDoc.shots : [];
    const MIN_FGA = 10;   // 任一季該區出手少於此數 → 差距標灰（樣本太少）
    const zoneDiff = group === 'zone' ? items.map(it => {
        const c = calc(periodShots, it.fn), pv = calc(prevShots, it.fn);
        const freq = periodTotal ? +(100 * c.fga / periodTotal).toFixed(1) : 0;
        const prevFreq = prevShots.length ? +(100 * pv.fga / prevShots.length).toFixed(1) : 0;
        return {
            key: it.key, label: it.label, en: it.en, pct: c.pct, fga: c.fga, prevPct: pv.pct, prevFga: pv.fga, freq, prevFreq,
            dPct: c.pct != null && pv.pct != null ? +(c.pct - pv.pct).toFixed(1) : null,
            dFreq: +(freq - prevFreq).toFixed(1),
            small: c.fga < MIN_FGA || pv.fga < MIN_FGA,
        };
    }) : [];

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
            {/* 期間在章節列的期間面板（全域）；影響命中率格、分區比較與熱圖，受助攻為全季快照（篩選時停用） */}
            <UI.Section title={`${groupInfo[1]}命中率`} en={`FG% by ${groupInfo[2]}`} accent="green"
                sub={`${periodLabel}（${periodTotal} 出手，vs 全季 ${allShots.length}）· 大字＝命中率，箭頭為 vs 全季 · 小字＝出手數／佔比 · 點格子看趨勢`}
                right={<>
                    <UI.ExportMenu title={`${groupInfo[1]}命中率（${periodLabel}）`} getNode={() => shootLedgerRef.current}
                        csv={() => ({ header: [groupInfo[1], '原文', `${periodLabel}命中率%`, `${periodLabel}出手`, '全季命中率%', '全季出手'],
                            rows: items.map(it => { const p = calc(periodShots, it.fn), a = calc(allShots, it.fn); return [it.label, it.en || '', p.pct == null ? '' : p.pct, p.fga, a.pct == null ? '' : a.pct, a.fga]; }) })} />
                    <UI.Seg ariaLabel="分組" size="sm" value={group} onChange={(g) => { setGroup(g); setOpenKey(null); }}
                        options={GROUPS.map(([v, l]) => ({ value: v, label: l }))} />
                </>}>
                {/* 與上季比：放內容第一行（標題右側不換行，手機會被撐寬） */}
                {group === 'zone' && prevSeason && (
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                        <UI.Chip active={compare && prevDoc !== null} title={prevDoc === null ? `${prevSeason} 沒有投籃資料` : `比較 ${prevSeason} 全季`}
                            onClick={() => setCompare(c => !c)}>
                            {compare && prevDoc === null ? `${prevSeason} 無資料` : `與上季比（${prevSeason}）`}
                        </UI.Chip>
                        {cmpOn && <span className="text-[11px] text-slate-500">格子下方小字＝上季全季命中率、差距、占比</span>}
                    </div>
                )}
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
                                    {filtered && <span className="ml-auto"><UI.Delta value={p.pct} prevValue={a.pct} /></span>}
                                </div>
                                <div className="mt-1.5 font-mono text-[10px] text-slate-500">{p.fga} 出手 · 佔 {freq}%</div>
                                {cmpOn && (() => {
                                    const z = zoneDiff.find(r => r.key === it.key);
                                    if (!z || z.prevPct == null) return <div className="mt-1 font-mono text-[10px] text-slate-600">上季無出手</div>;
                                    return (
                                        <div className="mt-1 font-mono text-[10px] text-slate-400">
                                            上季 {z.prevPct}%
                                            {z.dPct != null && <span className={`ml-1 ${z.small ? 'text-slate-500' : z.dPct >= 0 ? 'text-[#12A150]' : 'text-[#EF4444]'}`}>{z.dPct >= 0 ? '+' : ''}{z.dPct}</span>}
                                            <span className="ml-1 text-slate-500">· 佔 {z.prevFreq}%</span>
                                        </div>
                                    );
                                })()}
                            </button>
                        );
                    })}
                </UI.Ledger>
                </div>

                {/* 與上季比：分區差異半場圖 */}
                {compare && group === 'zone' && prevDoc === undefined && <div className="mt-4 py-6 text-center text-sm text-slate-500 animate-pulse">載入 {prevSeason} 投籃資料…</div>}
                {compare && group === 'zone' && prevDoc === null && <div className="mt-4"><UI.Note>{prevSeason} 沒有{teamMode ? '全隊的逐球投籃資料（該季未抓取）' : '這位球員的逐球投籃資料（可能當季不在隊上，或該季未抓取）'}</UI.Note></div>}
                {cmpOn && window.ZoneDiffCourt && (
                    <div ref={diffRef} className="mt-4 border border-white/10 p-4">
                        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="text-[13px] font-medium text-slate-100">{periodLabel} vs {prevSeason} 全季</span>
                            <span className="text-[11px] text-slate-500">大字＝本期命中率 · 彩色＝與上季差（綠升紅降，任一季出手少於 {MIN_FGA} 次標灰）· 小字＝出手占比變化</span>
                            <span className="ml-auto"><UI.ExportMenu title={`分區命中率 ${periodLabel} vs ${prevSeason}`} getNode={() => diffRef.current}
                                csv={() => ({ header: ['分區', '原文', `${periodLabel}命中率%`, `${periodLabel}出手`, `${prevSeason}命中率%`, `${prevSeason}出手`, '命中率差', `${periodLabel}占比%`, `${prevSeason}占比%`, '占比差'],
                                    rows: zoneDiff.map(z => [z.label, z.en || '', z.pct ?? '', z.fga, z.prevPct ?? '', z.prevFga, z.dPct ?? '', z.freq, z.prevFreq, z.dFreq]) })}
                                text={() => [
                                    `【${playerName}｜分區命中率 ${periodLabel} vs ${prevSeason}】`, '',
                                    ...zoneDiff.map(z => `${z.label}｜${z.pct ?? '—'}%（${z.fga} 出手）vs ${z.prevPct ?? '—'}%｜${z.dPct == null ? '—' : (z.dPct >= 0 ? '+' : '') + z.dPct}｜占比 ${z.dFreq >= 0 ? '+' : ''}${z.dFreq}%`),
                                    '', '資料：NBA.com Stats shotchartdetail', `${location.origin}${location.pathname}${location.hash}`,
                                ].join('\n')} /></span>
                        </div>
                        <window.ZoneDiffCourt zones={zoneDiff} />
                    </div>
                )}

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

            {/* 得分組成（整季快照 scoring，2026-11-12 起；篩選時停用） */}
            {scoring && typeof scoring.PCT_PTS_PAINT === 'number' && (<UI.Locked on={filtered}>
                <ScoringMix scoring={scoring} teamMode={teamMode} />
            </UI.Locked>)}

            {/* 受助攻（全季快照，不隨篩選） */}
            {Object.keys(assisted).length > 0 && (<UI.Locked on={filtered}>
                <UI.Section title="受助攻比例" en="Assisted FGM%" accent="blue" sub="命中球中由隊友助攻的比例 · 全季快照（期間篩選時停用）">
                    <UI.Ledger cols="grid-cols-3">
                        {[['整體受助攻', '%AST FGM', 'PCT_AST_FGM'], ['兩分受助攻', '%AST 2PM', 'PCT_AST_2PM'], ['三分受助攻', '%AST 3PM', 'PCT_AST_3PM']].map(([l, en, k]) => (
                            <UI.StatCell key={k} label={l} en={en} value={typeof assisted[k] === 'number' ? assisted[k] : null} unit="%"
                                gkey={k} citeAsOf="none" citeNote="全季（賽後隔天更新）" />
                        ))}
                    </UI.Ledger>
                </UI.Section>
            </UI.Locked>)}

            {/* 篩選後熱圖 */}
            {ShotChart && (
                <ShotChart playerId={playerId} teamMode={teamMode} playerName={playerName} externalShots={periodShots} periodLabel={periodLabel} />
            )}
        </div>
    );
};

// 得分組成：長條（禁區＋中距離＋三分＋罰球＝100%）＋圖例＋情境得分格子。全隊帶聯盟名次（window.RankCtx，只限當季最新快照）
const ScoringMix = ({ scoring, teamMode }) => {
    const UI = window.UI;
    const SHARE = window.scoringShareDefs || [], SIT = (window.scoringSituationDefs || []).filter(m => !(teamMode && m.playerOnly));
    const rk = (k) => teamMode ? window.leagueRank('scoring', k) : null;
    const nOf = window.RankCtx && window.RankCtx.ranks && window.RankCtx.ranks.scoring ? window.RankCtx.ranks.scoring._n : null;
    const line = SHARE.map(m => `${m.label} ${Number(scoring[m.key]).toFixed(1)}%`).join('、');
    const addLine = () => {
        const r = window.Quote.add(window.Quote.make({ kind: 'line', label: '得分組成', en: 'Scoring Breakdown', gkey: 'SCORING_MIX', values: [{ value: `得分組成：${line}` }], asOf: 'snap' }));
        UI.toast(r.added ? `已加入引用籃（共 ${r.total} 項）` : '這一行已在引用籃裡');
    };
    return (
        <UI.Section title="得分組成" en="Scoring Breakdown" accent="green"
            sub={`得分從哪裡來 · 長條＝禁區＋中距離＋三分＋罰球（合計 100%）· 整季快照（期間篩選時停用）${teamMode && nOf ? ` · 小字為 ${nOf} 隊名次（占比依大小排，不是好壞）` : ''}`}
            right={<button type="button" onClick={addLine}
                className="inline-flex min-h-[28px] items-center whitespace-nowrap rounded-full border border-white/15 px-3 text-[12px] text-slate-300 hover:border-[#12A150] hover:text-[#12A150]">＋ 整組加入</button>}>
            <div className="mb-2.5 flex h-[30px] border border-white/[0.08]" role="img" aria-label={`得分組成：${line}`}>
                {SHARE.map(m => {
                    const w = Math.max(0, Number(scoring[m.key]) || 0);
                    return <div key={m.key} style={{ width: `${w}%`, background: m.color }}
                        className="flex min-w-0 items-center justify-center overflow-hidden whitespace-nowrap font-mono text-[11.5px] font-medium text-[#0A1626]">{w >= 9 ? `${Math.round(w)}%` : ''}</div>;
                })}
            </div>
            <div className="mb-4 grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-4">
                {SHARE.map(m => {
                    const r = rk(m.key);
                    return (
                        <div key={m.key} className="flex items-baseline gap-1.5 whitespace-nowrap text-[12px] text-slate-200">
                            <i className="inline-block h-2.5 w-2.5 shrink-0 translate-y-px" style={{ background: m.color }}></i>{m.label}
                            <span className="font-display text-[20px] font-semibold tabular-nums text-slate-50">{Number(scoring[m.key]).toFixed(1)}<span className="ml-0.5 text-[11px] text-slate-400">%</span></span>
                            {r && <span className="font-mono text-[10.5px] text-slate-400">第{r.rank}</span>}
                        </div>
                    );
                })}
            </div>
            <div className="mb-2 flex items-baseline gap-2">
                <h3 className="text-[13px] font-medium text-slate-100 whitespace-nowrap">情境得分</h3>
                <span className="truncate font-mono text-[10px] text-slate-500">場均 · 禁區與快攻、二波、失誤後彼此重疊，不相加</span>
            </div>
            <UI.Ledger cols={SIT.length === 5 ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-2 sm:grid-cols-4'}>
                {SIT.map(m => (
                    <UI.StatCell key={m.key} label={m.label} en={m.englishLabel} gkey={m.key} citeNote="整季快照"
                        value={typeof scoring[m.key] === 'number' ? scoring[m.key] : null} rank={rk(m.key)}
                        sub={m.shareKey && typeof scoring[m.shareKey] === 'number' ? `占總得分 ${Number(scoring[m.shareKey]).toFixed(1)}%` : null} />
                ))}
            </UI.Ledger>
        </UI.Section>
    );
};

// 分區差異半場示意圖：5 個分區各標「本期命中率 / 與上季差 / 占比變化」
// 座標同 NBA shotchartdetail（0.1 呎，籃框在原點），以 scale(1,-1) 翻成籃框在下方，與 ShotChart 一致
const ZoneDiffCourt = ({ zones }) => {
    const POS = { RA: [0, 22], PAINT: [0, 118], MID: [-150, 150], C3: [-232, 36], AB3: [0, 268] };
    const L = { stroke: 'rgba(196,206,210,0.28)', fill: 'none', strokeWidth: 1.5 };
    const MONO = "'JetBrains Mono', monospace";
    return (
        <svg viewBox="-260 -345 520 400" className="mx-auto w-full max-w-[560px]" role="img" aria-label="分區命中率與上季差異">
            <g transform="scale(1,-1)">
                <rect x="-250" y="-47.5" width="500" height="380" {...L} />
                <rect x="-80" y="-47.5" width="160" height="190" {...L} />
                <circle cx="0" cy="142.5" r="60" {...L} />
                <circle cx="0" cy="0" r="7.5" {...L} />
                <path d="M-40 0 A40 40 0 0 0 40 0" {...L} />
                <line x1="-220" y1="-47.5" x2="-220" y2="92.5" {...L} /><line x1="220" y1="-47.5" x2="220" y2="92.5" {...L} />
                <path d="M-220 92.5 A237.5 237.5 0 0 0 220 92.5" {...L} />
            </g>
            {zones.map(z => {
                const [x, y] = POS[z.key] || [0, 0];
                const up = z.dPct != null && z.dPct >= 0;
                const col = z.dPct == null || z.small ? '#94A3B8' : up ? '#12A150' : '#EF4444';
                const anchor = z.key === 'C3' ? 'start' : 'middle';
                return (
                    <g key={z.key} transform={`translate(${x},${-y})`} fontFamily={MONO} textAnchor={anchor}>
                        <text y="-24" fill="#94A3B8" fontSize="11" fontFamily="'Noto Sans TC', sans-serif">{z.label}</text>
                        <text y="-4" fill="#F8FAFC" fontSize="20" fontWeight="600">{z.pct == null ? '—' : `${z.pct}%`}</text>
                        <text y="14" fill={col} fontSize="13" fontWeight="600">{z.dPct == null ? '上季無' : `${up ? '+' : ''}${z.dPct}`}</text>
                        <text y="29" fill="#7C8B9C" fontSize="10">占比 {z.dFreq >= 0 ? '+' : ''}{z.dFreq}%</text>
                    </g>
                );
            })}
        </svg>
    );
};

window.ShootingTab = ShootingTab;
window.ZoneDiffCourt = ZoneDiffCourt;
