// 總覽章節：季平均（扣掉身分列已顯示的 4 項）＋ Playtype 強弱項 ＋ 雷達 ＋ On/Off（球員）＋ Clutch ＋ Lineups（球隊）＋ 單場面板
// games：逐場 bundle（每場 {stats}）；untilDate：截至日期；base：快照 base（bundle 缺時退回，如更早無 games 的歷史季）
// stats：該實體的 Synergy 陣列（強弱項用）；radarSlot：App 組好的雷達＋疊加比較
const OverviewTab = ({ viewMode, selectedPlayer, games, untilDate, base, snapshotClutch, snapshotOnoff, lineups, gamesIndex, seasonLabel, onoffNA = null, viewSide = 'offensive', radarSlot = null, stats = [] }) => {
    const GA = window.GameAgg;
    const UI = window.UI;
    const clutchDefs = window.clutchDefs || [];
    const SingleGamePanel = window.SingleGamePanel;

    // 季平均欄位（NBA.com traditional 主體）。身分列已顯示的不重複列出：
    //   球隊身分列 = PTS/REB/AST/+-；球員身分列 = PTS/REB/AST/FG%（見 IdentityBar.js 的 FIELDS）
    const SUMMARY = [
        { key: 'PTS', label: '得分', en: 'PTS' },
        { key: 'REB', label: '籃板', en: 'REB' },
        { key: 'AST', label: '助攻', en: 'AST' },
        { key: 'STL', label: '抄截', en: 'STL' },
        { key: 'BLK', label: '阻攻', en: 'BLK' },
        { key: 'FG_PCT', label: '命中率', en: 'FG%', pct: true },
        { key: 'FG3_PCT', label: '三分命中率', en: '3P%', pct: true },
        { key: 'FT_PCT', label: '罰球命中率', en: 'FT%', pct: true },
        { key: 'TOV', label: '失誤', en: 'TOV' },
        { key: 'PLUS_MINUS', label: '正負值', en: '+/-', plus: true },
    ];
    // 期間切換：全季／近 5 場／近 10 場（截至同一天）。專欄最常查「最近幾場」，不必再跳到 Splits。
    // 近 N 場時身分列（全季數字）不再重複，故顯示完整 10 項
    const [range, setRange] = React.useState('all');
    const IN_IDENTITY = viewMode === 'TEAM' ? ['PTS', 'REB', 'AST', 'PLUS_MINUS'] : ['PTS', 'REB', 'AST', 'FG_PCT'];

    // 優先用 bundle 逐場算（截至該日，任何日期皆穩定）；bundle 未載入或無資料則退回快照 base（沒有逐場就不能切近 N 場）
    const gamesUntil = (games && games.length) ? games.filter(g => !untilDate || g.date <= untilDate) : null;
    const bundleAgg = gamesUntil ? GA.aggregate(range === 'all' ? gamesUntil : GA.lastN(gamesUntil, Number(range)), null, 'TEAM') : null;
    const baseAgg = (base && typeof base.GP === 'number' && base.GP > 0) ? base : null;
    const agg = (bundleAgg && bundleAgg.GP > 0) ? bundleAgg : baseAgg;
    const canRange = !!(bundleAgg && bundleAgg.GP > 0);
    const isRecent = canRange && range !== 'all';
    const summary = isRecent ? SUMMARY : SUMMARY.filter(s => !IN_IDENTITY.includes(s.key));
    const rangeLabel = isRecent ? `近 ${range} 場平均` : '季平均';
    const loadingAvg = games === null && !baseAgg;

    const valOf = (v, s) => {
        if (typeof v !== 'number') return null;
        if (s.plus) return (v > 0 ? '+' : '') + v.toFixed(1);
        return v.toFixed(1);
    };

    // Playtype 強弱項（BBall Index 式）：只用 Synergy 百分位（真有聯盟排名的數字）。
    // 攻守兩面百分位皆「越高越好」（已用資料驗證：防守 PPP 越低 → 百分位越高）。
    // 門檻：每場球權 ≥ 1.0（球權太少的類型百分位很極端）；排除 Misc（雜項，不是戰術類型）。
    // 強項只列百分位 ≥ 50、弱項只列 < 50：「排最後三名」不等於弱項，高於中位數的不可標成弱項
    const MIN_POSS_PG = 1.0;
    const ranked = (stats || [])
        .filter(x => (x.side || 'offensive') === viewSide && typeof x.percentile === 'number' && x.playType !== 'Misc')
        .filter(x => typeof x.poss === 'number' && x.poss >= MIN_POSS_PG)
        .sort((a, b) => b.percentile - a.percentile);
    const strengths = ranked.filter(x => x.percentile >= 50).slice(0, 3);
    const weaknesses = ranked.filter(x => x.percentile < 50).slice(-3).reverse();

    // On/Off（球員快照）
    const onoff = viewMode === 'PLAYER' ? (snapshotOnoff || {}) : null;
    const hasOnoff = onoff && typeof onoff.ON_NET_RATING === 'number';

    // Clutch（快照，無資料整段隱藏）
    const clutchEntity = snapshotClutch || {};
    const clutchMetrics = clutchDefs[0] ? clutchDefs[0].metrics : [];
    const hasClutch = clutchMetrics.some(m => clutchEntity[m.key] !== undefined);

    // 陣容名：桌面全名「R. Gobert - J. Randle …」，手機只留姓氏，避免表格被撐高
    const f1 = (v) => typeof v === 'number' ? v.toFixed(1) : '—';   // 表格數字統一一位小數（避免「48」與「48.2」並列）
    const shortLineup = (s) => String(s || '').split(' - ').map(n => n.replace(/^[A-Z]\.\s*/, '')).join(' · ');

    const PtRow = ({ x }) => (
        <li className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-x-4 border-b border-white/[0.08] py-2.5 last:border-b-0">
            <div className="min-w-0">
                <div className="font-display text-[15px] font-semibold uppercase tracking-wide text-slate-100 truncate">{x.playType}</div>
                <div className="font-mono text-[10px] text-slate-500">{typeof x.ppp === 'number' ? x.ppp.toFixed(2) : '—'} PPP · {x.poss.toFixed(1)} poss/G</div>
            </div>
            <div className="w-28 sm:w-36"><UI.PctBar value={x.percentile} label="PR" /></div>
        </li>
    );

    return (
        <div className="space-y-10">
            {window.Highlights && <window.Highlights games={games} untilDate={untilDate} />}

            <UI.Section title={isRecent ? `近 ${range} 場` : '季平均'} en={isRecent ? `Last ${range} Games` : 'Season Averages'} accent="green"
                right={canRange && <UI.Seg size="sm" ariaLabel="平均期間" value={range} onChange={setRange}
                    options={[{ value: 'all', label: '全季' }, { value: '5', label: '近 5 場' }, { value: '10', label: '近 10 場' }]} />}
                sub={[agg ? `${agg.GP} 場${(agg.W || agg.L) ? ` · ${agg.W} 勝 ${agg.L} 敗` : ''}` : null, seasonLabel, untilDate ? `截至 ${untilDate}` : '整季', '百分比以 Σ命中 ÷ Σ出手 重算'].filter(Boolean).join(' · ')}>
                {!agg ? (
                    <div className={`py-6 text-center text-sm text-slate-500 ${loadingAvg ? 'animate-pulse' : ''}`}>
                        {loadingAvg ? '載入季平均中…' : '此賽季尚無季平均資料'}
                    </div>
                ) : (
                    <UI.Ledger cols={UI.ledgerCols(summary.length)}>
                        {summary.map(s => (
                            <UI.StatCell key={s.key} label={s.label} en={s.en} value={valOf(agg[s.key], s)} unit={s.pct ? '%' : ''}
                                gkey={s.key} citeAsOf="agg" citeNote={rangeLabel} />
                        ))}
                    </UI.Ledger>
                )}
            </UI.Section>

            {ranked.length > 0 && (
                <UI.Section title="Playtype 強弱項" en="Strengths & Weaknesses" accent={viewSide === 'offensive' ? 'green' : 'red'}
                    sub={`${viewSide === 'offensive' ? '進攻' : '防守'}面 · Synergy 聯盟百分位 · 只計每場球權 ≥ ${MIN_POSS_PG} 的類型（球權太少百分位會失真），不含 Misc`}>
                    <div className="grid gap-x-10 gap-y-6 md:grid-cols-2">
                        <div>
                            <h3 className="mb-1 text-[12px] font-medium text-[#12A150]">強項 · 高於聯盟中位數</h3>
                            {strengths.length ? <ul>{strengths.map(x => <PtRow key={x.playType} x={x} />)}</ul>
                                : <p className="py-3 text-[13px] text-slate-500">沒有高於聯盟中位數的類型</p>}
                        </div>
                        <div>
                            <h3 className="mb-1 text-[12px] font-medium text-[#EF4444]">弱項 · 低於聯盟中位數</h3>
                            {weaknesses.length ? <ul>{weaknesses.map(x => <PtRow key={x.playType} x={x} />)}</ul>
                                : <p className="py-3 text-[13px] text-slate-500">沒有低於聯盟中位數的類型</p>}
                        </div>
                    </div>
                </UI.Section>
            )}

            {radarSlot && (
                <UI.Section title="雷達與疊加比較" en="Radar" accent="silver" sub="軸可自選；可疊加歷史賽季或同季隊友">
                    {radarSlot}
                </UI.Section>
            )}

            {/* On/Off 跨隊不適用（新援該季不在灰狼，API 綁 TeamID 抓不到）。
                onoffNA 預設 null → 留隊球員、以及本來就沒抓 onoff 的舊賽季 doc，
                行為與改動前完全相同（整段隱藏）。「舊季沒抓」不可冒充「跨隊不適用」 */}
            {!hasOnoff && onoffNA && (
                <UI.Section title="在場 / 不在場" en="On/Off Court" accent="blue"
                    right={<span className="border border-white/15 px-1.5 py-0.5 text-[10px] text-slate-400">{window.NA_BADGE}</span>}>
                    <UI.Note>{onoffNA}</UI.Note>
                </UI.Section>
            )}

            {hasOnoff && (
                <UI.Section title="在場 / 不在場" en="On/Off Court" accent="blue" sub="球隊在該球員上場 / 下場時的每 100 回合效率（整季快照）">
                    <UI.Ledger cols="grid-cols-1 sm:grid-cols-3">
                        {[
                            { label: '進攻效率', en: 'OffRtg', gk: 'OFF_RATING', on: onoff.ON_OFF_RATING, off: onoff.OFF_OFF_RATING, better: 'high' },
                            { label: '防守效率', en: 'DefRtg', gk: 'DEF_RATING', on: onoff.ON_DEF_RATING, off: onoff.OFF_DEF_RATING, better: 'low' },
                            { label: '淨效率', en: 'NetRtg', gk: 'NET_RATING', on: onoff.ON_NET_RATING, off: onoff.OFF_NET_RATING, better: 'high' },
                        ].map(m => {
                            const diff = (typeof m.on === 'number' && typeof m.off === 'number') ? m.on - m.off : null;
                            const good = diff != null && (m.better === 'high' ? diff > 0 : diff < 0);
                            return (
                                <div key={m.label} className="group/cell relative border-r border-b border-white/[0.08] px-3 pt-2.5 pb-3 min-w-0">
                                    {diff != null && <UI.CopyBtn className="absolute right-1 top-1"
                                        text={() => UI.citeLine({ label: `${m.label}在場 − 離場`, en: m.en, value: (diff > 0 ? '+' : '') + diff.toFixed(1),
                                            gkey: m.gk, note: `On/Off（在場 ${m.on.toFixed(1)}／離場 ${m.off.toFixed(1)}，每 100 回合）` })} />}
                                    <div className="flex items-center text-[11px] leading-tight text-slate-300">{m.label}<UI.Info k={m.gk} /></div>
                                    <div className="font-mono text-[10px] leading-tight text-slate-500">{m.en} · 在場 − 離場</div>
                                    <div className={`mt-2 font-display text-[26px] font-semibold leading-none tabular-nums ${diff == null ? 'text-slate-600' : good ? 'text-[#12A150]' : 'text-[#EF4444]'}`}>
                                        {diff == null ? '—' : (diff > 0 ? '+' : '') + diff.toFixed(1)}
                                    </div>
                                    <div className="mt-1.5 font-mono text-[11px] tabular-nums text-slate-400">
                                        在場 {typeof m.on === 'number' ? m.on.toFixed(1) : '—'}<span className="mx-1.5 text-slate-600">/</span>離場 {typeof m.off === 'number' ? m.off.toFixed(1) : '—'}
                                    </div>
                                </div>
                            );
                        })}
                    </UI.Ledger>
                </UI.Section>
            )}

            {hasClutch && (
                <UI.Section title="Clutch" en="Per Game" accent="amber" sub="第四節或延長賽最後 5 分鐘、分差 5 分內（NBA 定義）· 整季快照 · 場均">
                    <UI.Ledger cols={UI.ledgerCols(clutchMetrics.length)}>
                        {clutchMetrics.map(m => (
                            <UI.StatCell key={m.key} label={m.label} en={m.englishLabel} value={clutchEntity[m.key]} unit={m.unit}
                                gkey={m.key} citeNote="Clutch（第四節或延長賽最後 5 分鐘、分差 5 分內，場均）" />
                        ))}
                    </UI.Ledger>
                </UI.Section>
            )}

            {viewMode === 'TEAM' && lineups && lineups.length > 0 && (
                <UI.Section title="五人陣容" en="Lineups" accent="blue" sub="預設依總上場分鐘排序，點欄位標題可改排序（效率值為每 100 回合，整季快照）">
                    <UI.DataTable caption="五人陣容進階數據" rows={lineups} exportTitle="五人陣容"
                        initialSort={{ key: 'MIN', dir: 'desc' }} rowKey={(r) => r.players}
                        columns={[
                            { key: 'players', label: '陣容', align: 'left',
                                render: (r) => (<><span className="hidden sm:inline">{r.players}</span><span className="sm:hidden">{shortLineup(r.players)}</span></>) },
                            { key: 'GP', label: '場次', en: 'GP' },
                            { key: 'MIN', label: '總分鐘', en: 'MIN' },
                            { key: 'OFF_RATING', label: '進攻效率', en: 'OffRtg', render: (r) => f1(r.OFF_RATING) },
                            { key: 'DEF_RATING', label: '防守效率', en: 'DefRtg', render: (r) => f1(r.DEF_RATING) },
                            { key: 'NET_RATING', label: '淨效率', en: 'NetRtg',
                                render: (r) => typeof r.NET_RATING !== 'number' ? '—' : (
                                    <span className={r.NET_RATING > 0 ? 'text-[#12A150]' : r.NET_RATING < 0 ? 'text-[#EF4444]' : 'text-slate-200'}>
                                        {r.NET_RATING > 0 ? '+' : ''}{r.NET_RATING.toFixed(1)}
                                    </span>) },
                            { key: 'TS_PCT', label: '真實命中率', en: 'TS%', render: (r) => typeof r.TS_PCT === 'number' ? r.TS_PCT.toFixed(1) + '%' : '—' },
                        ]} />
                </UI.Section>
            )}

            {/* 單場面板（當季，有比賽索引才顯示） */}
            {SingleGamePanel && gamesIndex && gamesIndex.length > 0 && (
                <SingleGamePanel viewMode={viewMode} playerName={selectedPlayer} viewSide={viewSide} gamesIndex={gamesIndex} />
            )}
        </div>
    );
};

window.OverviewTab = OverviewTab;
