// 單隊對戰頁：網址 #vs=DEN[&r=cur|YYYY-YY][&t=regular|playoffs][&m=指標]（獨立整頁）
// 資料：範圍內球隊逐場 bundle（同對戰首頁，window.Matchup）
//       ＋交手場次的單場文件（gamesData.loadGameDocs：每節比分、對手 box、灰狼球員；只讀不寫 localStorage）
//       ＋按了才讀的投籃點（wolves_shotcharts/TEAM_{season}_{type}，ShootingTab 的 loadShotDoc）
// box score 只有 2025-26 起才有：每節分差、對手端兩區只算有 box 的場次，並寫出涵蓋幾場
// props：team（三碼）、range、type、metric（網址 m=：標亮並捲過去）、onRange、onType、onOpenGame(date)
(function () {
    const isNum = v => typeof v === 'number' && isFinite(v);
    const fmt = v => (isNum(v) ? window.fix1(v) : '—');
    const signed = v => (isNum(v) ? (window.fix1(v) !== '0.0' && v > 0 ? '+' : '') + window.fix1(v) : '—');
    const toneText = t => (t === 'good' ? 'text-[#12A150]' : t === 'bad' ? 'text-[#EF4444]' : 'text-slate-300');
    // 已在頁首的比賽結果，不列入「最突出」
    const RESULT_KEYS = ['PLUS_MINUS', 'PTS', 'OPP_PTS'];
    // box 的上場時間是 "38:01" 字串
    const minutesOf = v => (isNum(v) ? v : typeof v === 'string' && v.includes(':') ? Number(v.split(':')[0]) + Number(v.split(':')[1]) / 60 : 0);
    // 同時最多 limit 個讀取（一次讀十幾場時不要全部併發，long-polling 會卡）
    const mapLimit = async (items, limit, fn) => {
        const out = new Array(items.length);
        let next = 0;
        const worker = async () => { while (next < items.length) { const i = next++; out[i] = await fn(items[i]); } };
        await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
        return out;
    };

    // ── 由交手場次的單場文件推得的彙整（只算有 box 的場次）──
    const withBox = (docs) => Object.entries(docs || {})
        .map(([date, v]) => ({ date, box: v && v.team && v.team.box && (v.team.box.teams || []).length === 2 ? v.team.box : null }))
        .filter(x => x.box);

    // 每節分差：Q1–Q4 各場平均（灰狼 − 對手）；延長賽另計（只算有打延長的場次）
    function periodDiffs(docs) {
        const qs = [[], [], [], []], ot = [];
        withBox(docs).forEach(({ box }) => {
            const me = box.teams.find(t => t.tricode === 'MIN'), op = box.teams.find(t => t.tricode !== 'MIN');
            if (!me || !op || me.periods.length < 4 || op.periods.length < 4) return;
            for (let i = 0; i < 4; i++) qs[i].push(me.periods[i].pts - op.periods[i].pts);
            if (me.periods.length > 4) ot.push(me.periods.slice(4).reduce((a, p, i) => a + p.pts - ((op.periods[i + 4] || {}).pts || 0), 0));
        });
        const avg = xs => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
        return { n: qs[0].length, q: qs.map(avg), ot: { n: ot.length, avg: avg(ot) } };
    }

    // 兩隊 box 合計（同一批有 box 的場次）
    const BOX_ROWS = [
        { key: 'PTS', label: '得分' }, { key: 'FG_PCT', label: '命中率', num: 'FGM', den: 'FGA' },
        { key: 'FG3_PCT', label: '三分%', num: 'FG3M', den: 'FG3A' }, { key: 'FG3A', label: '三分出手' },
        { key: 'FT_PCT', label: '罰球%', num: 'FTM', den: 'FTA' }, { key: 'FTA', label: '罰球出手' },
        { key: 'REB', label: '籃板' }, { key: 'OREB', label: '進攻籃板' }, { key: 'AST', label: '助攻' },
        { key: 'TOV', label: '失誤', low: true }, { key: 'STL', label: '抄截' }, { key: 'BLK', label: '阻攻' }, { key: 'PF', label: '犯規', low: true },
    ];
    function boxTotals(docs) {
        const games = withBox(docs);
        const side = (pick) => {
            const s = {};
            games.forEach(({ box }) => { const t = pick(box.teams).totals || {}; Object.keys(t).forEach(k => { if (isNum(t[k])) s[k] = (s[k] || 0) + t[k]; }); });
            const out = {};
            BOX_ROWS.forEach(r => { out[r.key] = r.den ? (s[r.den] ? 100 * s[r.num] / s[r.den] : null) : (games.length ? (s[r.key] || 0) / games.length : null); });
            return out;
        };
        return { n: games.length, me: side(ts => ts.find(t => t.tricode === 'MIN')), op: side(ts => ts.find(t => t.tricode !== 'MIN')) };
    }

    // 對手球員打灰狼（box 名單，以 personId 合併）
    function oppPlayers(docs, team) {
        const by = {};
        withBox(docs).forEach(({ box }) => box.players.forEach(p => {
            if (p.tricode !== team || !p.stats || !Object.keys(p.stats).length) return;
            const r = (by[p.personId] = by[p.personId] || { pid: p.personId, name: p.name, n: 0, PTS: 0, REB: 0, AST: 0, PM: 0, MIN: 0 });
            r.n++; r.PTS += p.stats.PTS || 0; r.REB += p.stats.REB || 0; r.AST += p.stats.AST || 0;
            r.PM += p.stats.PLUS_MINUS || 0; r.MIN += minutesOf(p.stats.MIN);
        }));
        return Object.values(by).map(r => ({ ...r, PTS: r.PTS / r.n, REB: r.REB / r.n, AST: r.AST / r.n, PM: r.PM / r.n, MIN: r.MIN / r.n }))
            .sort((a, b) => b.PTS - a.PTS);
    }

    // 灰狼球員打這隊（單場球員文件，以 playerId 合併；數值走 GameAgg，百分比 Σ/Σ）
    function wolvesPlayers(docs) {
        const by = {};
        Object.values(docs || {}).forEach(v => Object.entries((v && v.player && v.player.players) || {}).forEach(([name, st]) => {
            if (!st || !st.playerId) return;
            (by[st.playerId] = by[st.playerId] || { pid: st.playerId, name, games: [] }).games.push({ stats: st });
        }));
        return Object.values(by).map(r => ({ ...r, n: r.games.length, agg: window.GameAgg.aggregate(r.games, null, 'TEAM') }))
            .sort((a, b) => (b.agg.PTS || 0) - (a.agg.PTS || 0));
    }

    const Tile = ({ label, value, sub, tone }) => (
        <div className="border-b border-r border-white/[0.08] px-3 py-2.5">
            <div className="text-[11px] text-slate-400">{label}</div>
            <div className={`mt-0.5 font-display text-[26px] font-semibold leading-none tabular-nums ${tone || 'text-slate-50'}`}>{value}</div>
            {sub && <div className="mt-1 font-mono text-[11px] text-slate-500">{sub}</div>}
        </div>
    );

    // 灰狼球員展開：讀他在範圍內的逐場 bundle，比較「打這隊」與「他自己的範圍平均」
    const PlayerDetail = ({ pid, name, team, seasons, type }) => {
        const UI = window.UI, M = window.Matchup;
        const { useState, useEffect } = React;
        const [games, setGames] = useState(null);
        useEffect(() => {
            let off = false;
            setGames(null);
            M.loadWindowGames(seasons, type, pid).then(gs => { if (!off) setGames(gs); })
                .catch(e => { console.error('matchup player detail', e); if (!off) setGames([]); });
            return () => { off = true; };
        }, [pid, seasons.join(','), type]);
        if (games === null) return <div className="py-4 text-center text-[12px] text-slate-500 animate-pulse">載入 {name} 的逐場資料…</div>;
        const sub = games.filter(g => g.oppAbbr === team);
        if (!sub.length) return <UI.Note>{name} 的逐場 bundle 裡沒有對 {team} 的比賽。</UI.Note>;
        const CORE = ['PTS', 'REB', 'AST', 'FG_PCT', 'FG3_PCT', 'PLUS_MINUS'];
        const all = M.flatMetrics(M.groupDefs('PLAYER'))
            .map(m => ({ m, base: M.baseline(games, m.key) })).filter(x => x.base)
            .map(x => ({ ...x, dev: M.deviation(x.base, sub, x.m) })).filter(x => x.dev);
        const core = CORE.map(k => all.find(x => x.m.key === k)).filter(Boolean);
        const rest = all.filter(x => !CORE.includes(x.m.key) && x.dev.z !== null && !x.m.neutral)
            .sort((a, b) => Math.abs(b.dev.z) - Math.abs(a.dev.z)).slice(0, 6);
        const Row = ({ x }) => (
            <li className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-baseline gap-3 py-1.5 text-[13px]">
                <span className="truncate text-slate-200">{window.metricLabel(x.m)}</span>
                <span className="font-mono tabular-nums text-slate-50">{fmt(x.dev.value)}</span>
                <span className="font-mono text-[11px] tabular-nums text-slate-500">平均 {fmt(x.base.value)}</span>
                <span className={`w-24 whitespace-nowrap text-right font-mono text-[11px] tabular-nums ${toneText(x.dev.tone)}`}>
                    {signed(x.dev.diff)}{x.dev.z !== null ? ` · z ${signed(x.dev.z)}` : ''}
                </span>
            </li>
        );
        return (
            <div className="border-l-2 border-[#12A150]/50 bg-white/[0.02] px-4 py-3">
                <p className="mb-2 text-[12px] text-slate-400">{name}：對 {team} {sub.length} 場，範圍內共 {games.length} 場（只算替灰狼出賽）</p>
                <div className="grid gap-x-8 md:grid-cols-2">
                    <div><h4 className="text-[11px] text-slate-500">基本</h4><ol className="divide-y divide-white/[0.06]">{core.map(x => <Row key={x.m.key} x={x} />)}</ol></div>
                    <div><h4 className="text-[11px] text-slate-500">偏離最多的其他指標</h4><ol className="divide-y divide-white/[0.06]">{rest.map(x => <Row key={x.m.key} x={x} />)}</ol></div>
                </div>
            </div>
        );
    };

    const MatchupPage = ({ team, range, type, metric, onRange, onType, onOpenGame }) => {
        const UI = window.UI, M = window.Matchup, R = window.MATCHUP_RULES;
        const { useState, useEffect, useMemo } = React;
        const [data, setData] = useState(null);
        const [err, setErr] = useState(null);
        const [docs, setDocs] = useState(null);          // {date: {team, player}|null}；null＝載入中
        const [docsErr, setDocsErr] = useState(null);
        const [openPid, setOpenPid] = useState(null);
        const [shots, setShots] = useState(undefined);   // undefined＝還沒按、'loading'、陣列、{error}

        useEffect(() => {
            let off = false;
            setData(null); setErr(null); setShots(undefined); setOpenPid(null);
            (async () => {
                try {
                    const gp = await M.currentRegularGP();
                    const win = M.windowSeasons(range, gp);
                    const games = await M.loadWindowGames(win.seasons, type);
                    if (!off) setData({ win, games });
                } catch (e) {
                    console.error('matchup page load', e);
                    if (!off) setErr(e.message || String(e));
                }
            })();
            return () => { off = true; };
        }, [range, type]);

        const opp = useMemo(() => (data ? data.games.filter(g => g.oppAbbr === team) : []), [data, team]);
        const dates = opp.map(g => g.date).join(',');

        // 交手場次的單場文件（每節比分／對手 box／灰狼球員）
        useEffect(() => {
            if (!data) return;
            let off = false;
            setDocs(null); setDocsErr(null);
            mapLimit(opp.map(g => g.date), 6, d => window.loadGameDocs(d, false))
                .then(vs => { if (!off) setDocs(Object.fromEntries(opp.map((g, i) => [g.date, vs[i]]))); })
                .catch(e => { console.error('matchup game docs', e); if (!off) { setDocsErr(String(e.code || e.message || e)); setDocs({}); } });
            return () => { off = true; };
        }, [dates, !!data]);

        const derived = useMemo(() => {
            if (!data || !opp.length) return null;
            const groups = M.groupDefs('TEAM');
            const row = M.tagOpponents(M.byOpponent(data.games), data.games).find(r => r.abbr === team);
            const devs = {};
            M.flatMetrics(groups).forEach(m => {
                const base = M.baseline(data.games, m.key);
                const dev = base && M.deviation(base, opp, m);
                if (dev) devs[m.key] = { m, base, dev };
            });
            return { groups, row, devs };
        }, [data, team]);

        // 從首頁熱圖點進來（m=）：資料到了再捲到該指標
        useEffect(() => {
            if (!derived || !metric) return;
            const el = document.getElementById(`mu-m-${metric}`);
            if (el) el.scrollIntoView({ block: 'center' });
        }, [!!derived, metric]);

        const loadShots = async () => {
            setShots('loading');
            try {
                const want = new Set(opp.map(g => g.date));
                // 只讀有交手的賽季／賽別（每份約 0.5 MB，大檔會卡住同時進行的其他讀取）
                const ids = [...new Set(opp.map(g => `TEAM_${g.season}_${g.type}`))];
                const docsShots = await Promise.all(ids.map(id => window.loadShotDoc(id)));
                setShots(docsShots.flatMap(d => (d ? d.shots.filter(s => want.has(s.gdate)) : [])));
            } catch (e) {
                console.error('matchup shots', e);
                setShots({ error: String(e.code || e.message || e) });
            }
        };

        const name = window.teamName(team);
        window.CiteCtx = { subject: 'Minnesota Timberwolves', season: data ? `對 ${team} · ${data.win.label}` : '', asOfSnap: null, asOfAgg: null, isHistory: false };
        const head = (
            <div>
                <h1 className="font-display text-[30px] font-bold leading-tight text-slate-50">
                    MIN <span className="text-slate-500">vs</span> {team}
                    <span className="ml-2 font-sans text-[16px] font-normal text-slate-400">{name}</span>
                    {derived && derived.row && window.MatchupTag && <window.MatchupTag tag={derived.row.tag} />}
                </h1>
                <window.MatchupRangeBar range={range} type={type} onRange={onRange} onType={onType}
                    note={data ? `${data.win.label} · 對 ${team} ${opp.length} 場` : null} />
            </div>
        );
        if (err) return <div className="space-y-6">{head}<UI.Note tone="warn">讀取失敗：{err}</UI.Note></div>;
        if (!data) return <div className="space-y-6">{head}<div className="py-16 text-center text-sm text-slate-500 animate-pulse">載入逐場資料…</div></div>;
        if (!derived) return <div className="space-y-6">{head}<UI.Note>這個範圍沒有和 {team} 交手的比賽{range !== 'recent' ? '，可以改看近三季' : ''}。</UI.Note></div>;

        const { row, devs, groups } = derived;
        const md = row.marginDev;
        const notable = Object.values(devs).filter(x => !RESULT_KEYS.includes(x.m.key) && !x.m.neutral && x.dev.z !== null)
            .sort((a, b) => Math.abs(b.dev.z) - Math.abs(a.dev.z)).slice(0, 5);
        const pd = docs ? periodDiffs(docs) : null;
        const bt = docs ? boxTotals(docs) : null;
        const ops = docs ? oppPlayers(docs, team) : [];
        const wps = docs ? wolvesPlayers(docs) : [];
        const docsNote = docs === null ? <div className="py-6 text-center text-[12px] text-slate-500 animate-pulse">載入交手場次的單場資料…</div>
            : docsErr ? <UI.Note tone="warn">單場資料讀取失敗：{docsErr}</UI.Note> : null;
        const gameCols = [
            {
                key: 'date', label: '日期', align: 'left', render: g => (
                    <button type="button" onClick={() => onOpenGame(g.date)} className="min-h-[24px] font-mono text-[13px] hover:text-[#12A150]">{g.date}</button>),
            },
            { key: 'type', label: '賽別', align: 'left', render: g => (g.type === 'playoffs' ? <span className="text-[#C4CED2]">季後賽</span> : '例行賽'), csv: g => g.type },
            { key: 'ha', label: '主客', align: 'left', render: g => ((g.matchup || '').includes('@') ? '客' : '主'), sortValue: g => ((g.matchup || '').includes('@') ? 1 : 0), csv: g => ((g.matchup || '').includes('@') ? '客' : '主') },
            { key: 'score', label: '比分', render: g => `${g.stats.PTS}–${g.stats.OPP_PTS}`, sortValue: g => g.stats.PTS, csv: g => `${g.stats.PTS}-${g.stats.OPP_PTS}` },
            { key: 'wl', label: '結果', render: g => <span className={g.wl === 'W' ? 'text-[#12A150]' : 'text-[#EF4444]'}>{g.wl === 'W' ? '勝' : '敗'}</span>, csv: g => g.wl },
            { key: 'pm', label: '分差', render: g => signed(g.stats.PLUS_MINUS), sortValue: g => g.stats.PLUS_MINUS, csv: g => g.stats.PLUS_MINUS },
        ];

        return (
            <div className="space-y-8">
                {head}
                {row.n < R.minGames && (
                    <UI.Note tone="warn">這個範圍只和 {team} 交手 {row.n} 場，數字容易被單場手感左右{range !== 'recent' ? <>，建議改看<button type="button" onClick={() => onRange('recent')} className="mx-1 underline underline-offset-2 hover:text-slate-50">近三季</button></> : ''}。</UI.Note>
                )}

                {/* 頁首數字 */}
                <div className="grid grid-cols-2 border-l border-t border-white/[0.08] sm:grid-cols-5">
                    <Tile label="戰績" value={`${row.W}-${row.L}`} sub={`${row.n} 場${row.playoffGames ? `（季後 ${row.playoffGames}）` : ''}`} />
                    <Tile label="場均比分" value={`${fmt(row.pts)}–${fmt(row.oppPts)}`} sub="得分–失分" />
                    <Tile label="場均分差" value={signed(row.margin)} tone={row.margin > 0 ? 'text-[#12A150]' : row.margin < 0 ? 'text-[#EF4444]' : undefined}
                        sub={md && md.z !== null ? `偏離程度 z ${signed(md.z)}` : '場數不足，不算偏離'} />
                    <Tile label="主場" value={row.home.n ? `${row.home.W}-${row.home.L}` : '—'} sub={row.home.n ? `分差 ${signed(row.home.margin)}` : '沒有主場交手'} />
                    <Tile label="客場" value={row.away.n ? `${row.away.W}-${row.away.L}` : '—'} sub={row.away.n ? `分差 ${signed(row.away.margin)}` : '沒有客場交手'} />
                </div>

                {notable.length > 0 && (
                    <UI.Section title="最突出的 5 項" en="Stand-outs" accent="green" sub={<>灰狼打 {team} 時，和範圍平均差最多的指標（依偏離程度排序；分差、得分、失分已在上方）。<UI.Info k="MU_Z" /></>}>
                        <div className="grid grid-cols-2 border-l border-t border-white/[0.08] sm:grid-cols-5">
                            {notable.map(({ m, base, dev }) => (
                                <a key={m.key} href={`#mu-m-${m.key}`} onClick={e => { e.preventDefault(); document.getElementById(`mu-m-${m.key}`).scrollIntoView({ block: 'center' }); }}
                                    className="border-b border-r border-white/[0.08] px-3 py-2.5 hover:bg-white/[0.03]">
                                    <div className="truncate text-[11px] text-slate-400">{window.metricLabel(m)}</div>
                                    <div className={`mt-0.5 font-display text-[26px] font-semibold leading-none tabular-nums ${toneText(dev.tone)}`}>{fmt(dev.value)}</div>
                                    <div className="mt-1 font-mono text-[11px] text-slate-500">平均 {fmt(base.value)} · z {signed(dev.z)}</div>
                                </a>
                            ))}
                        </div>
                    </UI.Section>
                )}

                <UI.Section title="交手紀錄" en="Games" accent="silver" sub="點日期開單場頁。">
                    {row.bySeason.length > 1 && (
                        <div className="mb-3 flex flex-wrap gap-2">
                            {row.bySeason.map(s => (
                                <span key={s.season} className="border border-white/10 px-2.5 py-1 text-[12px] text-slate-300">
                                    {s.season}：<span className="font-mono">{s.W}-{s.L}</span>
                                    <span className={`ml-1.5 font-mono ${s.margin > 0 ? 'text-[#12A150]' : s.margin < 0 ? 'text-[#EF4444]' : ''}`}>{signed(s.margin)}</span>
                                </span>
                            ))}
                        </div>
                    )}
                    <UI.DataTable columns={gameCols} rows={row.games} rowKey={g => g.date} initialSort={{ key: 'date', dir: 'desc' }}
                        caption={`灰狼對 ${team} 逐場`} exportTitle={`灰狼對 ${team} 交手紀錄`} />
                </UI.Section>

                <UI.Section title="全部指標" en="All Metrics" accent="blue"
                    sub={`灰狼打 ${team} 時 vs 範圍平均（${data.win.label}）。綠＝比平常好、紅＝比平常差，次數類不分好壞。`}>
                    <div className="space-y-6">
                        {groups.map(gr => {
                            const ms = M.flatMetrics([gr]).filter(m => devs[m.key]);
                            if (!ms.length) return null;
                            return (
                                <div key={gr.key} className="overflow-x-auto">
                                    <table className="w-full border-collapse text-[13px]">
                                        <caption className="mb-1 text-left text-[12px] text-slate-400">{gr.label}</caption>
                                        <thead>
                                            <tr className="border-b border-white/15 text-[11px] text-slate-400">
                                                <th scope="col" className="px-2 py-1.5 text-left font-normal">指標</th>
                                                <th scope="col" className="px-2 py-1.5 text-right font-normal">對 {team}</th>
                                                <th scope="col" className="px-2 py-1.5 text-right font-normal">範圍平均</th>
                                                <th scope="col" className="px-2 py-1.5 text-right font-normal">差</th>
                                                <th scope="col" className="px-2 py-1.5 text-right font-normal">z</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {ms.map(m => {
                                                const { base, dev } = devs[m.key];
                                                const hl = m.key === metric;
                                                return (
                                                    <tr key={m.key} id={`mu-m-${m.key}`} className={`border-b border-white/[0.06] ${hl ? 'bg-[#12A150]/10 outline outline-1 outline-[#12A150]' : ''}`}>
                                                        <th scope="row" className="px-2 py-1.5 text-left font-normal text-slate-200">{window.metricLabel(m)}</th>
                                                        <td className="px-2 py-1.5 text-right font-mono tabular-nums text-slate-50">{fmt(dev.value)}</td>
                                                        <td className="px-2 py-1.5 text-right font-mono tabular-nums text-slate-400">{fmt(base.value)}</td>
                                                        <td className={`px-2 py-1.5 text-right font-mono tabular-nums ${toneText(dev.tone)}`}>{signed(dev.diff)}</td>
                                                        <td className="px-2 py-1.5 text-right font-mono tabular-nums text-slate-400">{dev.z === null ? '—' : signed(dev.z)}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            );
                        })}
                    </div>
                </UI.Section>

                <UI.Section title="每節分差" en="By Quarter" accent="amber"
                    sub={pd ? `灰狼 − ${team}，各節平均。只算有每節比分的場次（2025-26 起）：${pd.n} / ${opp.length} 場。` : '灰狼 − 對手，各節平均。'}>
                    {docsNote || (!pd.n ? <UI.Note>範圍內和 {team} 的交手都在 2025-26 以前，沒有每節比分。</UI.Note> : (
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                            {pd.q.map((v, i) => (
                                <div key={i} className="border border-white/[0.08] px-3 py-2.5">
                                    <div className="text-[11px] text-slate-400">第 {i + 1} 節</div>
                                    <div className={`font-display text-[26px] font-semibold tabular-nums ${v > 0 ? 'text-[#12A150]' : v < 0 ? 'text-[#EF4444]' : 'text-slate-200'}`}>{signed(v)}</div>
                                </div>
                            ))}
                            <div className="border border-white/[0.08] px-3 py-2.5">
                                <div className="text-[11px] text-slate-400">延長賽</div>
                                <div className="font-display text-[26px] font-semibold tabular-nums text-slate-200">{pd.ot.n ? signed(pd.ot.avg) : '—'}</div>
                                <div className="font-mono text-[10px] text-slate-500">{pd.ot.n ? `${pd.ot.n} 場有延長` : '沒有延長賽'}</div>
                            </div>
                        </div>
                    ))}
                </UI.Section>

                <UI.Section title={`${team} 打灰狼`} en="Opponent Box" accent="red"
                    sub={bt ? `兩隊 box score 合計（場均；百分比為加總後重算）。只算有 box 的場次（2025-26 起）：${bt.n} / ${opp.length} 場。` : '兩隊 box score 合計。'}>
                    {docsNote || (!bt.n ? <UI.Note>範圍內和 {team} 的交手都在 2025-26 以前，沒有對手的 box score。</UI.Note> : (
                        <div className="grid gap-8 lg:grid-cols-2">
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse text-[13px]">
                                    <caption className="sr-only">兩隊 box 合計</caption>
                                    <thead>
                                        <tr className="border-b border-white/15 text-[11px] text-slate-400">
                                            <th scope="col" className="px-2 py-1.5 text-left font-normal">項目</th>
                                            <th scope="col" className="px-2 py-1.5 text-right font-normal text-[#12A150]">MIN</th>
                                            <th scope="col" className="px-2 py-1.5 text-right font-normal">{team}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {BOX_ROWS.map(r => {
                                            const a = bt.me[r.key], b = bt.op[r.key];
                                            const meBetter = isNum(a) && isNum(b) && a !== b && ((a > b) !== !!r.low);
                                            return (
                                                <tr key={r.key} className="border-b border-white/[0.06]">
                                                    <th scope="row" className="px-2 py-1.5 text-left font-normal text-slate-200">{r.label}</th>
                                                    <td className={`px-2 py-1.5 text-right font-mono tabular-nums ${meBetter ? 'font-semibold text-slate-50' : 'text-slate-400'}`}>{fmt(a)}</td>
                                                    <td className={`px-2 py-1.5 text-right font-mono tabular-nums ${!meBetter && isNum(a) && isNum(b) && a !== b ? 'font-semibold text-slate-50' : 'text-slate-400'}`}>{fmt(b)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <div>
                                <h3 className="mb-1.5 text-[12px] text-slate-400">打灰狼表現最好的 {team} 球員（依場均得分）</h3>
                                <ol className="divide-y divide-white/[0.06] border-t border-white/[0.08]">
                                    {ops.slice(0, 8).map(p => (
                                        <li key={p.pid} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-baseline gap-3 py-1.5 text-[13px]">
                                            <span className="truncate text-slate-200">{p.name} <span className="font-mono text-[10px] text-slate-500">{p.n}場 · {p.MIN.toFixed(0)}分鐘</span></span>
                                            <span className="font-mono tabular-nums text-slate-50">{p.PTS.toFixed(1)}<span className="ml-0.5 text-[10px] text-slate-500">分</span></span>
                                            <span className="w-40 whitespace-nowrap text-right font-mono text-[11px] tabular-nums text-slate-400">{p.REB.toFixed(1)}板 {p.AST.toFixed(1)}助 · {signed(p.PM)}</span>
                                        </li>
                                    ))}
                                </ol>
                                <p className="mt-2 text-[11px] text-slate-500">以交手當時的 box score 名單計算；球員之後可能已轉隊。</p>
                            </div>
                        </div>
                    ))}
                </UI.Section>

                <UI.Section title={`灰狼球員打 ${team}`} en="Wolves Players" accent="green" sub="點球員名，和他自己在範圍內的平均比較（會另讀他的逐場資料）。">
                    {docsNote || (!wps.length ? <UI.Note>沒有交手場次的球員資料。</UI.Note> : (
                        <div className="overflow-x-auto border-t border-white/[0.08]">
                            <table className="w-full border-collapse text-[13px]">
                                <caption className="sr-only">灰狼球員打 {team} 的場均</caption>
                                <thead>
                                    <tr className="border-b border-white/15 text-[11px] text-slate-400">
                                        {['球員', '場數', '上場', '得分', '籃板', '助攻', '命中率', '三分%', '正負值'].map((h, i) => (
                                            <th key={h} scope="col" className={`whitespace-nowrap px-2 py-1.5 font-normal ${i ? 'text-right' : 'text-left'}`}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {wps.map(p => (
                                        <React.Fragment key={p.pid}>
                                            <tr className="border-b border-white/[0.06]">
                                                <th scope="row" className="whitespace-nowrap px-2 py-0 text-left font-normal">
                                                    <button type="button" aria-expanded={openPid === p.pid} onClick={() => setOpenPid(openPid === p.pid ? null : p.pid)}
                                                        className={`min-h-[32px] text-left hover:text-[#12A150] ${openPid === p.pid ? 'text-[#12A150]' : 'text-slate-200'}`}>
                                                        {openPid === p.pid ? '▾ ' : '▸ '}{p.name}
                                                    </button>
                                                </th>
                                                {[p.n, p.agg.MIN, p.agg.PTS, p.agg.REB, p.agg.AST, p.agg.FG_PCT, p.agg.FG3_PCT].map((v, i) => (
                                                    <td key={i} className="px-2 py-1.5 text-right font-mono tabular-nums text-slate-200">{i === 0 ? v : fmt(v)}</td>
                                                ))}
                                                <td className="px-2 py-1.5 text-right font-mono tabular-nums text-slate-200">{signed(p.agg.PLUS_MINUS)}</td>
                                            </tr>
                                            {openPid === p.pid && (
                                                <tr><td colSpan={9} className="p-0"><PlayerDetail pid={p.pid} name={p.name} team={team} seasons={data.win.seasons} type={type} /></td></tr>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ))}
                </UI.Section>

                {/* 投籃圖元件自帶「投籃分布」區塊標題；載到點位前才用這裡的區塊放按鈕（每季約 0.5 MB，按了才讀） */}
                {Array.isArray(shots) && shots.length && window.ShotChart
                    ? <window.ShotChart teamMode playerName="灰狼全隊" externalShots={shots} periodLabel={`灰狼對 ${team} · ${opp.length} 場`} />
                    : (
                        <UI.Section title="投籃分布" en="Shot Chart" accent="green" sub={`灰狼打 ${team} 的全隊出手位置（範圍內 ${opp.length} 場；每季約 0.5 MB，按了才讀）。`}>
                            {shots === undefined ? (
                                <button type="button" onClick={loadShots}
                                    className="min-h-[32px] rounded-full border border-white/15 px-4 text-[13px] text-slate-300 hover:border-[#12A150] hover:text-slate-50">
                                    載入投籃分布
                                </button>
                            ) : shots === 'loading' ? <div className="py-8 text-center text-sm text-slate-500 animate-pulse">載入投籃資料…</div>
                                : shots.error ? <UI.Note tone="warn">投籃資料讀取失敗：{shots.error}</UI.Note>
                                : <UI.Note>這些場次沒有投籃點資料。</UI.Note>}
                        </UI.Section>
                    )}
            </div>
        );
    };

    window.MatchupPage = MatchupPage;
})();
