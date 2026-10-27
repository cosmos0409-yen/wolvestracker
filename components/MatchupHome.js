// 對戰首頁：網址 #vs[&r=cur|YYYY-YY][&t=regular|playoffs]（獨立整頁，與主畫面的賽季／賽別無關）
// 五個區塊：對手總表（勁敵／順手／棘手）→ 指標 × 對手熱圖 → 單一指標排行 → 勝負關鍵因子 → 灰狼球員 × 對手
// 計算全在 window.Matchup（matchupData.js）；這裡只負責呈現。排序、上色一律看偏離程度 z，不看原始差距
// props：range（'recent'|'cur'|'YYYY-YY'）、type（'all'|'regular'|'playoffs'）、onRange、onType、
//        onOpenTeam(abbr, metric?) 開單隊對戰頁、players [{name, id}]（球員區塊的選單）
(function () {
    const isNum = v => typeof v === 'number' && isFinite(v);
    const fmt = v => (isNum(v) ? window.fix1(v) : '—');
    const signed = v => (isNum(v) ? (window.fix1(v) !== '0.0' && v > 0 ? '+' : '') + window.fix1(v) : '—');
    const TYPE_OPTIONS = [{ value: 'all', label: '例行＋季後' }, { value: 'regular', label: '例行賽' }, { value: 'playoffs', label: '季後賽' }];
    const TAG_CLASS = {
        rival: 'border-[#C4CED2]/50 text-[#C4CED2]',
        favorable: 'border-[#12A150]/60 text-[#12A150]',
        tough: 'border-[#EF4444]/60 text-[#EF4444]',
    };

    // 偏離 → 底色：綠＝打這隊時比平常好、紅＝比平常差，越深越偏離（|z| 3 封頂）；次數類指標用灰階；單場（z 為 null）不上色
    const heatColor = (dev) => {
        if (!dev || dev.z === null) return undefined;
        const a = Math.min(Math.abs(dev.z), 3) / 3 * 0.55;
        if (dev.tone === 'neutral') return `rgba(196,206,210,${(a * 0.5).toFixed(3)})`;
        if (!dev.goodZ) return undefined;
        return dev.goodZ > 0 ? `rgba(18,161,80,${a.toFixed(3)})` : `rgba(239,68,68,${a.toFixed(3)})`;
    };
    const devTitle = (abbr, m, dev, base) => dev
        ? `${abbr} ${window.metricLabel(m)} ${fmt(dev.value)}（範圍 ${fmt(base.value)}，差 ${signed(dev.diff)}${dev.z === null ? '，只有 1 場' : `，z ${signed(dev.z)}`}，${dev.n} 場）`
        : `${abbr} ${window.metricLabel(m)}：無資料`;

    const Tag = ({ tag }) => tag ? (
        <span className={`ml-1.5 inline-block whitespace-nowrap border px-1.5 text-[10px] leading-4 ${TAG_CLASS[tag]}`}>{window.MATCHUP_TAGS[tag]}</span>
    ) : null;

    // 近 5 次勝敗：小方塊（綠勝紅敗），季後賽加外框
    const Last5 = ({ games }) => (
        <span className="inline-flex gap-1 align-middle" aria-label={`近 ${games.length} 次：${games.map(g => (g.wl === 'W' ? '勝' : '敗')).join('')}`}>
            {games.map(g => (
                <span key={g.date} title={`${g.date} ${g.wl === 'W' ? '勝' : '敗'}${g.type === 'playoffs' ? '（季後賽）' : ''}`}
                    className={`inline-block h-2.5 w-2.5 ${g.wl === 'W' ? 'bg-[#12A150]' : 'bg-[#EF4444]'} ${g.type === 'playoffs' ? 'ring-1 ring-[#C4CED2] ring-offset-1 ring-offset-[#0A1626]' : ''}`}></span>
            ))}
        </span>
    );

    const TeamCell = ({ r, onOpen }) => (
        <button type="button" onClick={() => onOpen(r.abbr)} title={`開 ${r.abbr} 對戰頁`}
            className="inline-flex min-h-[24px] flex-wrap items-baseline text-left hover:text-[#12A150]">
            <span className="font-display text-[15px] font-bold tracking-wide">{r.abbr}</span>
            <span className="ml-1.5 whitespace-nowrap text-[12px] text-slate-400">{r.name}</span>
            <Tag tag={r.tag} />
        </button>
    );

    // ── 1. 對手總表 ──
    const OpponentTable = ({ rows, minGames, onOpen, label }) => {
        const UI = window.UI;
        // 淡化套在格子上；第一欄在手機上是固定欄（不透明底色），淡化改套在內容，否則橫捲時後面的格子會透出來
        const dim = r => (r.n < minGames ? 'opacity-50' : '');
        const columns = [
            { key: 'abbr', label: '對手', align: 'left', render: r => <span className={dim(r)}><TeamCell r={r} onOpen={onOpen} /></span>, csv: r => r.abbr, sortValue: r => r.abbr },
            { key: 'n', label: '場數', en: 'GP', cellClass: dim },
            { key: 'rec', label: '戰績', en: 'W-L', render: r => `${r.W}-${r.L}`, sortValue: r => r.W / r.n, csv: r => `${r.W}-${r.L}`, cellClass: dim },
            { key: 'pts', label: '得分', en: 'PTS', render: r => fmt(r.pts), cellClass: dim, gkey: 'PTS' },
            { key: 'oppPts', label: '失分', en: 'Opp PTS', render: r => fmt(r.oppPts), cellClass: dim, gkey: 'OPP_PTS' },
            {
                key: 'margin', label: '場均分差', en: '+/-', cellClass: dim,
                render: r => <span className={r.margin > 0 ? 'text-[#12A150]' : r.margin < 0 ? 'text-[#EF4444]' : ''}>{signed(r.margin)}</span>,
            },
            {
                key: 'z', label: '偏離程度', en: 'z', gkey: 'MU_Z', cellClass: dim,
                sortValue: r => (r.marginDev ? r.marginDev.z : null), csv: r => (r.marginDev && r.marginDev.z !== null ? r.marginDev.z.toFixed(2) : ''),
                render: r => (r.marginDev && r.marginDev.z !== null ? <span className="text-slate-400">{signed(r.marginDev.z)}</span> : '—'),
            },
            { key: 'last5', label: '近 5 次', align: 'left', render: r => <Last5 games={r.last5} />, sortValue: r => r.last5.filter(g => g.wl === 'W').length, csv: r => r.last5.map(g => g.wl).join('') },
        ];
        return (
            <UI.Section title="對手總表" en="Opponents" accent="green"
                sub={<>點隊名看單隊對戰。淡色＝交手少於 {minGames} 場，數字參考價值低。<span className="whitespace-nowrap">標籤 <UI.Info k="MU_TAGS" /></span></>}>
                <UI.DataTable columns={columns} rows={rows} rowKey={r => r.abbr} initialSort={{ key: 'margin', dir: 'desc' }}
                    caption="灰狼對各隊戰績" exportTitle={`對戰總表 ${label}`} />
            </UI.Section>
        );
    };

    // ── 2. 指標 × 對手熱圖 ──
    const Heatmap = ({ rows, groups, bases, minGames, onOpen }) => {
        const UI = window.UI;
        const { useState } = React;
        const [gk, setGk] = useState('base');
        const group = groups.find(g => g.key === gk) || groups[0];
        const metrics = window.Matchup.flatMetrics([group]).filter(m => bases[m.key]);
        return (
            <UI.Section title="指標 × 對手" en="Heatmap" accent="blue"
                sub={<>每格是灰狼打這隊時的數值。綠＝比範圍平均好、紅＝比平常差、灰＝次數類不分好壞，顏色越深越偏離（看 z，不看差距）。只交手 1 場不上色。點格子看該隊細節。<UI.Info k="MU_Z" /></>}
                right={<UI.Seg ariaLabel="指標組" size="sm" value={group.key} onChange={setGk} options={groups.map(g => ({ value: g.key, label: g.label }))} />}>
                {!metrics.length ? <UI.Note>這個範圍沒有「{group.label}」的逐場資料。</UI.Note> : (
                    <div className="overflow-x-auto border-t border-white/[0.08]">
                        <table className="w-full border-collapse text-[13px]">
                            <caption className="sr-only">灰狼對各隊的{group.label}指標</caption>
                            <thead>
                                <tr className="border-b border-white/15">
                                    <th scope="col" className="sticky left-0 z-[1] bg-[#0A1626] px-2 py-2 text-left text-[11px] font-normal text-slate-400">對手</th>
                                    {metrics.map(m => (
                                        <th key={m.key} scope="col" className="min-w-[4.5rem] px-1.5 py-2 text-right align-bottom text-[11px] font-normal leading-tight text-slate-400">
                                            {window.metricLabel(m)}
                                        </th>
                                    ))}
                                </tr>
                                <tr className="border-b border-white/15 bg-white/[0.02]">
                                    <th scope="row" className="sticky left-0 z-[1] bg-[#0C1A2E] px-2 py-1.5 text-left text-[11px] font-normal text-slate-400">範圍平均</th>
                                    {metrics.map(m => <td key={m.key} className="px-1.5 py-1.5 text-right font-mono tabular-nums text-slate-300">{fmt(bases[m.key].value)}</td>)}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map(r => (
                                    <tr key={r.abbr} className="border-b border-white/[0.06]">
                                        <th scope="row" className="sticky left-0 z-[1] whitespace-nowrap bg-[#0A1626] px-2 py-0 text-left font-normal">
                                            <button type="button" onClick={() => onOpen(r.abbr)} className={`inline-flex min-h-[32px] items-baseline gap-1.5 hover:text-[#12A150] ${r.n < minGames ? 'opacity-50' : ''}`}>
                                                <span className="font-display text-[14px] font-bold tracking-wide">{r.abbr}</span>
                                                <span className="font-mono text-[10px] text-slate-500">{r.n}場</span>
                                            </button>
                                        </th>
                                        {metrics.map(m => {
                                            const dev = window.Matchup.deviation(bases[m.key], r.games, m);
                                            return (
                                                <td key={m.key} className="p-0">
                                                    <button type="button" onClick={() => onOpen(r.abbr, m.key)} title={devTitle(r.abbr, m, dev, bases[m.key])}
                                                        style={{ backgroundColor: heatColor(dev) }}
                                                        className={`block min-h-[32px] w-full px-1.5 text-right font-mono tabular-nums text-slate-100 hover:outline hover:outline-1 hover:outline-white/40 ${r.n < minGames ? 'opacity-50' : ''}`}>
                                                        {dev ? fmt(dev.value) : '—'}
                                                    </button>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </UI.Section>
        );
    };

    // ── 3. 單一指標排行：點＝打這隊時的值，橫線＝±1.96 標準誤（約 95% 範圍），直線＝範圍平均 ──
    // 用 HTML 百分比定位而非 SVG：手機寬度下文字不會跟著縮小
    const RankPlot = ({ rows, groups, bases, minGames, onOpen }) => {
        const UI = window.UI;
        const { useState } = React;
        const all = window.Matchup.flatMetrics(groups).filter(m => bases[m.key]);
        const [key, setKey] = useState('FG3_PCT');
        const m = all.find(x => x.key === key) || all[0];
        if (!m) return null;
        const base = bases[m.key];
        const items = rows.map(r => ({ r, dev: window.Matchup.deviation(base, r.games, m) })).filter(x => x.dev)
            .map(x => ({ ...x, lo: x.dev.value - 1.96 * x.dev.se, hi: x.dev.value + 1.96 * x.dev.se }))
            .sort((a, b) => (m.betterIsLarger === false ? a.dev.value - b.dev.value : b.dev.value - a.dev.value));
        const ends = items.flatMap(x => (x.dev.n >= 2 ? [x.lo, x.hi] : [x.dev.value])).concat(base.value);
        const pad = (Math.max(...ends) - Math.min(...ends)) * 0.04 || 1;
        const min = Math.min(...ends) - pad, max = Math.max(...ends) + pad;
        const pos = v => `${((v - min) / (max - min)) * 100}%`;
        const groupsWithData = groups.map(g => ({ ...g, ms: all.filter(x => x.group === g.key) })).filter(g => g.ms.length);
        return (
            <UI.Section title="單一指標排行" en="Rank" accent="silver"
                sub={`點＝灰狼打這隊時的${window.metricLabel(m)}，橫線＝約 95% 的波動範圍（只打 1 場沒有橫線）。橫線沒碰到中間直線（範圍平均 ${fmt(base.value)}）才比較可能不是手感起伏。`}
                right={<>
                    <label className="sr-only" htmlFor="mu-rank-metric">指標</label>
                    <select id="mu-rank-metric" value={m.key} onChange={e => setKey(e.target.value)} className={UI.selectClass(true)}>
                        {groupsWithData.map(g => (
                            <optgroup key={g.key} label={g.label}>
                                {g.ms.map(x => <option key={x.key} value={x.key}>{window.metricLabel(x)}</option>)}
                            </optgroup>
                        ))}
                    </select>
                </>}>
                <div role="list" aria-label={`各隊${window.metricLabel(m)}排行`} className="space-y-px">
                    {items.map(({ r, dev, lo, hi }) => {
                        const sig = dev.z !== null && Math.abs(dev.z) >= 1.96 && dev.tone !== 'neutral';
                        const color = !sig ? 'bg-slate-300' : dev.goodZ > 0 ? 'bg-[#12A150]' : 'bg-[#EF4444]';
                        return (
                            <div key={r.abbr} role="listitem" className={`grid grid-cols-[4.5rem_1fr_3.5rem] items-center gap-2 ${r.n < minGames ? 'opacity-50' : ''}`}
                                title={devTitle(r.abbr, m, dev, base)}>
                                <button type="button" onClick={() => onOpen(r.abbr, m.key)} className="inline-flex min-h-[24px] items-baseline gap-1 text-left hover:text-[#12A150]">
                                    <span className="font-display text-[14px] font-bold tracking-wide">{r.abbr}</span>
                                    <span className="font-mono text-[10px] text-slate-500">{dev.n}場</span>
                                </button>
                                <div className="relative h-6">
                                    <span className="absolute inset-y-0 w-px bg-[#C4CED2]/40" style={{ left: pos(base.value) }} aria-hidden="true"></span>
                                    {dev.n >= 2 && <span className="absolute top-1/2 h-px bg-slate-500" style={{ left: pos(lo), width: `calc(${pos(hi)} - ${pos(lo)})` }} aria-hidden="true"></span>}
                                    <span className={`absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${dev.n >= 2 ? color : 'border border-slate-400 bg-transparent'}`}
                                        style={{ left: pos(dev.value) }} aria-hidden="true"></span>
                                </div>
                                <span className="text-right font-mono text-[12px] tabular-nums text-slate-200">{fmt(dev.value)}</span>
                            </div>
                        );
                    })}
                </div>
                <div className="mt-2 grid grid-cols-[4.5rem_1fr_3.5rem] gap-2 font-mono text-[10px] text-slate-500" aria-hidden="true">
                    <span></span><span className="flex justify-between"><span>{fmt(min)}</span><span>{fmt(max)}</span></span><span></span>
                </div>
            </UI.Section>
        );
    };

    // ── 4. 勝負關鍵因子 ──
    const KeyFactors = ({ games, rows, bases, minGames }) => {
        const UI = window.UI;
        const M = window.Matchup;
        const factors = M.keyFactors(games);
        if (!factors.length) return null;
        const maxD = Math.max(...factors.map(f => Math.abs(f.d)));
        return (
            <UI.Section title="勝負關鍵因子" en="Win Factors" accent="amber"
                sub={<>範圍內所有比賽，贏球和輸球時差最多的指標（不分對手）。右側列出灰狼打哪些隊時，這項通常落在「勝場那一邊」或「敗場那一邊」（場數 ≥ {minGames}、|z| ≥ 1）。<UI.Info k="MU_FACTOR" /></>}>
                <div className="divide-y divide-white/[0.06] border-t border-white/[0.08]">
                    {factors.map(f => {
                        const devs = rows.filter(r => r.n >= minGames)
                            .map(r => ({ r, dev: M.deviation(bases[f.key], r.games, f.metric) }))
                            .filter(x => x.dev && x.dev.z !== null && Math.abs(x.dev.z) >= 1)
                            .sort((a, b) => Math.abs(b.dev.z) - Math.abs(a.dev.z));
                        const winSide = devs.filter(x => x.dev.z * f.d > 0).slice(0, 4);
                        const lossSide = devs.filter(x => x.dev.z * f.d < 0).slice(0, 4);
                        const chips = (xs, cls) => xs.length
                            ? xs.map(x => <span key={x.r.abbr} title={devTitle(x.r.abbr, f.metric, x.dev, bases[f.key])} className={`border px-1.5 font-display text-[12px] font-bold tracking-wide ${cls}`}>{x.r.abbr}</span>)
                            : <span className="text-slate-500">—</span>;
                        return (
                            <div key={f.key} className="grid gap-x-6 gap-y-2 py-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                                <div>
                                    <div className="flex items-baseline justify-between gap-3">
                                        <span className="text-[14px] text-slate-100">{window.metricLabel(f.metric)}</span>
                                        <span className="font-mono text-[12px] tabular-nums text-slate-300">
                                            勝 <span className="text-[#12A150]">{fmt(f.w)}</span> · 敗 <span className="text-[#EF4444]">{fmt(f.l)}</span>
                                        </span>
                                    </div>
                                    <div className="mt-1.5 flex items-center gap-2">
                                        <div className="h-1.5 flex-1 bg-white/[0.06]"><div className="h-full bg-amber-400" style={{ width: `${(Math.abs(f.d) / maxD) * 100}%` }}></div></div>
                                        <span className="w-28 shrink-0 text-right text-[11px] text-slate-400">贏球時{f.d > 0 ? '較高' : '較低'}（d {f.d.toFixed(2)}）</span>
                                    </div>
                                </div>
                                <div className="grid gap-1.5 text-[12px] sm:grid-cols-2">
                                    <div className="flex flex-wrap items-center gap-1.5"><span className="text-slate-400">偏勝場：</span>{chips(winSide, 'border-[#12A150]/50 text-[#12A150]')}</div>
                                    <div className="flex flex-wrap items-center gap-1.5"><span className="text-slate-400">偏敗場：</span>{chips(lossSide, 'border-[#EF4444]/50 text-[#EF4444]')}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </UI.Section>
        );
    };

    // ── 5. 灰狼球員 × 對手：讀該球員在範圍內的逐場 bundle（每季每賽別 1 份） ──
    const PlayerVsTeams = ({ seasons, type, players, minGames, onOpen }) => {
        const UI = window.UI;
        const M = window.Matchup;
        const { useState, useEffect, useMemo } = React;
        // 球員 ID 一律存字串（名單來源可能是數字或字串）；直接從網址開對戰頁時名單可能晚到，到了再補選第一位
        const [pid, setPid] = useState(players[0] ? String(players[0].id) : null);
        const [key, setKey] = useState('PTS');
        const [games, setGames] = useState(null);
        useEffect(() => { if (!pid && players[0]) setPid(String(players[0].id)); }, [players.length]);
        useEffect(() => {
            if (!pid) return;
            let off = false;
            setGames(null);
            M.loadWindowGames(seasons, type, pid)
                .then(gs => { if (!off) setGames(gs); })
                .catch(e => { console.error('matchup player games', e); if (!off) setGames([]); });
            return () => { off = true; };
        }, [pid, seasons.join(','), type]);
        const groups = M.groupDefs('PLAYER');
        const all = useMemo(() => (games ? M.flatMetrics(groups).filter(m => M.baseline(games, m.key)) : []), [games]);
        const m = all.find(x => x.key === key) || all[0];
        const lists = useMemo(() => {
            if (!games || !m) return null;
            const base = M.baseline(games, m.key);
            const rows = M.byOpponent(games).filter(r => r.n >= minGames)
                .map(r => ({ r, dev: M.deviation(base, r.games, m) })).filter(x => x.dev && x.dev.z !== null);
            const score = x => (m.neutral ? x.dev.z : x.dev.goodZ);
            rows.sort((a, b) => score(b) - score(a));
            return { base, top: rows.filter(x => score(x) > 0).slice(0, 5), bottom: rows.filter(x => score(x) < 0).slice(-5).reverse() };
        }, [games, m && m.key]);
        if (!players.length) return null;
        const name = (players.find(p => String(p.id) === pid) || {}).name || '';
        const List = ({ title, xs }) => (
            <div>
                <h3 className="mb-1.5 text-[12px] text-slate-400">{title}</h3>
                {!xs.length ? <p className="text-[12px] text-slate-500">沒有明顯偏離的對手</p> : (
                    <ol className="divide-y divide-white/[0.06] border-t border-white/[0.08]">
                        {xs.map(({ r, dev }) => (
                            <li key={r.abbr} className="grid grid-cols-[1fr_auto_auto_auto] items-baseline gap-3 py-1.5 text-[13px]">
                                <TeamCell r={r} onOpen={onOpen} />
                                <span className="font-mono text-[11px] text-slate-500">{dev.n}場</span>
                                <span className="font-mono tabular-nums text-slate-100">{fmt(dev.value)}</span>
                                <span className="whitespace-nowrap text-right font-mono text-[11px] tabular-nums text-slate-400">{signed(dev.diff)} · z {signed(dev.z)}</span>
                            </li>
                        ))}
                    </ol>
                )}
            </div>
        );
        return (
            <UI.Section title="灰狼球員 × 對手" en="Player vs Teams" accent="green"
                sub={`選一位球員和指標，列出他打哪些隊表現最好、最差（交手 ≥ ${minGames} 場，依偏離程度排序；範圍內只算他在灰狼的比賽）。`}
                right={<>
                    <label className="sr-only" htmlFor="mu-player">球員</label>
                    <select id="mu-player" value={pid || ''} onChange={e => setPid(e.target.value)} className={UI.selectClass(true)}>
                        {players.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
                    </select>
                    {all.length > 0 && (<>
                        <label className="sr-only" htmlFor="mu-player-metric">指標</label>
                        <select id="mu-player-metric" value={m ? m.key : ''} onChange={e => setKey(e.target.value)} className={UI.selectClass(false)}>
                            {groups.map(g => ({ ...g, ms: all.filter(x => x.group === g.key) })).filter(g => g.ms.length).map(g => (
                                <optgroup key={g.key} label={g.label}>
                                    {g.ms.map(x => <option key={x.key} value={x.key}>{window.metricLabel(x)}</option>)}
                                </optgroup>
                            ))}
                        </select>
                    </>)}
                </>}>
                {games === null ? <div className="py-8 text-center text-sm text-slate-500 animate-pulse">載入 {name} 的逐場資料…</div>
                    : !games.length || !lists ? <UI.Note>{name} 在這個範圍沒有替灰狼出賽的逐場資料。</UI.Note>
                    : (<>
                        <p className="mb-3 text-[12px] text-slate-400">{name} 範圍內 {games.length} 場，{window.metricLabel(m)}平均 <span className="font-mono text-slate-200">{fmt(lists.base.value)}</span></p>
                        <div className="grid gap-6 md:grid-cols-2">
                            <List title={m.neutral ? '最多' : '表現最好'} xs={lists.top} />
                            <List title={m.neutral ? '最少' : '表現最差'} xs={lists.bottom} />
                        </div>
                    </>)}
            </UI.Section>
        );
    };

    // 範圍列（首頁與單隊頁共用）：範圍選單＋賽別切換＋實際範圍說明（note）
    const RangeBar = ({ range, type, onRange, onType, note }) => {
        const UI = window.UI;
        const seasons = window.Matchup.seasonList();
        const options = [
            { value: 'recent', label: '近三季' },
            { value: 'cur', label: `只看本季（${seasons[0]}）` },
            ...seasons.slice(1).map(s => ({ value: s, label: `${s} 賽季` })),
        ];
        return (
            <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="sr-only" htmlFor="mu-range">範圍</label>
                <select id="mu-range" value={range} onChange={e => onRange(e.target.value)} className={UI.selectClass(true)}>
                    {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <UI.Seg ariaLabel="賽別" size="sm" value={type} onChange={onType} options={TYPE_OPTIONS} />
                {note && <span className="text-[12px] text-slate-400">{note} <UI.Info k="MU_RANGE" /></span>}
            </div>
        );
    };
    window.MatchupRangeBar = RangeBar;
    window.MatchupTag = Tag;

    const MatchupHome = ({ range, type, onRange, onType, onOpenTeam, players = [] }) => {
        const UI = window.UI;
        const M = window.Matchup;
        const R = window.MATCHUP_RULES;
        const { useState, useEffect, useMemo } = React;
        const [data, setData] = useState(null);
        const [err, setErr] = useState(null);

        useEffect(() => {
            let off = false;
            setData(null); setErr(null);
            (async () => {
                try {
                    const gp = await M.currentRegularGP();
                    const win = M.windowSeasons(range, gp);
                    const games = await M.loadWindowGames(win.seasons, type);
                    if (!off) setData({ win, games });
                } catch (e) {
                    console.error('matchup load', e);
                    if (!off) setErr(e.message || String(e));
                }
            })();
            return () => { off = true; };
        }, [range, type]);

        const derived = useMemo(() => {
            if (!data || !data.games.length) return null;
            const { games } = data;
            const groups = M.groupDefs('TEAM');
            const bases = {};
            M.flatMetrics(groups).forEach(m => { const b = M.baseline(games, m.key); if (b) bases[m.key] = b; });
            return { groups, bases, rows: M.tagOpponents(M.byOpponent(games), games) };
        }, [data]);

        window.CiteCtx = { subject: 'Minnesota Timberwolves', season: data ? data.win.label : '', asOfSnap: null, asOfAgg: null, isHistory: false };
        const fewGames = derived && derived.rows.filter(r => r.n >= R.minGames).length < derived.rows.length / 2;

        return (
            <div className="space-y-8">
                <div>
                    <h1 className="font-display text-[30px] font-bold leading-tight text-slate-50">對戰分析 <span className="font-mono text-[12px] font-normal text-slate-500">Matchups</span></h1>
                    <RangeBar range={range} type={type} onRange={onRange} onType={onType}
                        note={data ? `${data.win.label} · ${data.games.length} 場` : null} />
                </div>

                {err ? <UI.Note tone="warn">讀取失敗：{err}</UI.Note>
                    : !data ? <div className="py-16 text-center text-sm text-slate-500 animate-pulse">載入逐場資料…</div>
                    : !derived ? <UI.Note>這個範圍沒有比賽資料{type === 'playoffs' ? '（季後賽可能還沒開打）' : ''}。</UI.Note>
                    : (<>
                        {fewGames && (
                            <UI.Note tone="warn">
                                這個範圍交手場數少（共 {data.games.length} 場，多數對手不到 {R.minGames} 場），數字容易被單場手感左右。
                                {range !== 'recent' && <> 建議改看<button type="button" onClick={() => onRange('recent')} className="mx-1 underline underline-offset-2 hover:text-slate-50">近三季</button>。</>}
                            </UI.Note>
                        )}
                        <OpponentTable rows={derived.rows} minGames={R.minGames} onOpen={onOpenTeam} label={data.win.label} />
                        <Heatmap rows={derived.rows} groups={derived.groups} bases={derived.bases} minGames={R.minGames} onOpen={onOpenTeam} />
                        <RankPlot rows={derived.rows} groups={derived.groups} bases={derived.bases} minGames={R.minGames} onOpen={onOpenTeam} />
                        <KeyFactors games={data.games} rows={derived.rows} bases={derived.bases} minGames={R.minGames} />
                        <PlayerVsTeams seasons={data.win.seasons} type={type} players={players} minGames={R.minGames} onOpen={onOpenTeam} />
                    </>)}
            </div>
        );
    };

    window.MatchupHome = MatchupHome;
})();
