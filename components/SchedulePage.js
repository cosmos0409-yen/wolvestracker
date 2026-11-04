// 完整賽程頁（#schedule[&m=YYYY-MM][&f=home|away]，獨立整頁，只有當季）：版型見 _mockup/schedule.html
// 資料只讀賽前預覽文件（gamesData.loadPreview）：灰狼本季全部比賽的開賽時間、主客、對手、比分 → 0 個新 request、多讀 1 份文件
// 日期一律美東（跟全站、網址一致），開賽時間寫台北（window.kickoffTPE「台北隔日 09:30」）
// 桌面（md 以上）月曆格：隊徽＋vs／@＋中文隊名＋三碼，下面比分或開賽時間；手機改清單（一場一列、單行），月曆一格只有 47px 放不下
// 隊徽不用 loading="lazy"：桌面格與手機清單同一組網址（另一組被 CSS 藏起來），瀏覽器快取共用；lazy 在背景分頁可能一直不載
// 點任何一場都進 #game=日期：打完的是一般單場頁，還沒打的是預覽模式
// props：month（網址 m=，空＝今天所在月份）、filter（f=，''／home／away）、onMonth(m)、onFilter(f)
const SchedulePage = ({ month, filter = '', onMonth, onFilter }) => {
    const { useState, useEffect, useMemo } = React;
    const UI = window.UI;
    const season = window.CURRENT_SEASON;
    const [pv, setPv] = useState(undefined);   // undefined=載入中, null=沒有
    useEffect(() => {
        let cancelled = false;
        (window.loadPreview ? window.loadPreview(season) : Promise.resolve(null)).then(v => { if (!cancelled) setPv(v || null); });
        return () => { cancelled = true; };
    }, [season]);

    const games = (pv && pv.games) || [];
    const months = useMemo(() => [...new Set(games.map(g => g.date.slice(0, 7)))].sort(), [games]);
    const today = window.etToday();
    const defMonth = !months.length ? '' : months.includes(today.slice(0, 7)) ? today.slice(0, 7) : today < months[0] ? months[0] : months[months.length - 1];
    const cur = months.includes(month) ? month : defMonth;
    UI.useTabKeys(() => months, (m) => onMonth(m === defMonth ? '' : m));

    if (pv === undefined) return <div className="py-16 text-center text-sm text-slate-500 animate-pulse">載入賽程…</div>;
    if (!pv || !games.length) return (
        <UI.Note tone="warn">讀不到本季賽程（完整賽程只有當季，來自每日抓取的賽前預覽資料）。可以先用刊頭的「賽程」月曆查看已打完的比賽。</UI.Note>
    );

    const WD = ['日', '一', '二', '三', '四', '五', '六'];
    const md = (d) => `${d.slice(5, 7)}/${d.slice(8, 10)}`;
    const won = (g) => g.score && g.score[0] > g.score[1];
    const done = games.filter(g => g.score), w = done.filter(won).length;
    const hDone = done.filter(g => g.home), hw = hDone.filter(won).length;
    const aDone = done.filter(g => !g.home), aw = aDone.filter(won).length;
    const next = games.find(g => !g.score && g.status !== 3);
    const pass = (g) => !filter || (filter === 'home' ? g.home : !g.home);
    const byDate = {};
    games.forEach(g => { byDate[g.date] = g; });
    const href = (g) => window.UrlState.gameHref(g.date);
    const name = (g) => <>{g.home ? 'vs' : '@'} {window.teamName(g.opp)}<span className="ml-1 font-mono text-[11px] font-normal text-slate-400">{g.opp}</span></>;
    const result = (g) => g.score
        ? <span className={won(g) ? 'text-[#12A150]' : 'text-[#EF4444]'}>{won(g) ? 'W' : 'L'} {g.score[0]}-{g.score[1]}</span>
        : null;
    const tags = (g) => [
        g.rest && g.rest[0] === 0 && <span key="b2b" title="背靠背（前一天也有比賽）" className="rounded-sm border border-white/15 px-1 font-mono text-[10px] leading-[15px] text-slate-400">B2B</span>,
        window.specialTag(g.label) && <span key="sp" className="rounded-sm border border-amber-400/50 px-1 text-[10px] leading-[15px] text-amber-300">{window.specialTag(g.label)}</span>,
    ].filter(Boolean);
    const logo = (g, cls) => <img src={window.teamLogo(g.oppId || g.opp)} alt="" className={cls} onError={e => { e.currentTarget.style.visibility = 'hidden'; }} />;

    // ── 桌面：月曆格（週日開頭，補滿整週）──
    const [y, m] = cur.split('-').map(Number);
    const first = new Date(Date.UTC(y, m - 1, 1));
    const start = new Date(first); start.setUTCDate(1 - first.getUTCDay());
    const cells = [];
    for (let i = 0; i < 42; i++) {
        const d = new Date(start); d.setUTCDate(start.getUTCDate() + i);
        const ds = d.toISOString().slice(0, 10);
        if (i >= 35 && ds.slice(0, 7) !== cur) break;
        cells.push(ds);
    }
    const grid = (
        <div className="hidden md:grid grid-cols-7 border-l border-t border-white/[0.08]">
            {WD.map(x => <div key={x} className="border-b border-r border-white/[0.08] px-2 py-1.5 text-[11px] text-slate-500">{x}</div>)}
            {cells.map(ds => {
                const g = byDate[ds] && pass(byDate[ds]) ? byDate[ds] : null;
                const out = ds.slice(0, 7) !== cur;
                const cls = `relative min-h-[104px] min-w-0 border-b border-r border-white/[0.08] px-2 py-1.5 ${out ? 'bg-white/[0.015]' : ''} ${ds === today ? 'outline outline-1 -outline-offset-1 outline-[#C4CED2]' : ''}`;
                const dn = <span className={`font-mono text-[11px] ${out ? 'text-slate-600' : 'text-slate-500'}`}>{Number(ds.slice(8))}</span>;
                if (!g) return <div key={ds} className={cls}>{dn}</div>;
                const tg = tags(g);
                return (
                    <a key={ds} href={href(g)} title={`${ds} ${g.home ? 'vs.' : '@'} ${g.opp} · ${g.score ? `${won(g) ? '勝' : '敗'} ${g.score[0]}-${g.score[1]}` : window.kickoffTPE(g)}`}
                        className={`${cls} block hover:bg-white/[0.03] ${g.score ? (won(g) ? 'shadow-[inset_3px_0_0_#12A150]' : 'shadow-[inset_3px_0_0_#EF4444]') : ''}`}>
                        {dn}
                        {tg.length > 0 && <span className="absolute right-2 top-1.5 flex gap-1">{tg}</span>}
                        <div className="mt-1.5 flex items-center gap-2 whitespace-nowrap">
                            {logo(g, 'h-[30px] w-[30px] shrink-0')}
                            <div className="min-w-0">
                                <div className="truncate text-[13px] font-semibold leading-tight text-slate-100">{name(g)}</div>
                                <div className="font-mono text-[12px] text-slate-300">{result(g) || window.kickoffTPE(g)}</div>
                            </div>
                        </div>
                    </a>
                );
            })}
        </div>
    );

    // ── 手機：清單 ──
    const rows = games.filter(g => g.date.startsWith(cur) && pass(g));
    const list = (
        <div className="md:hidden">
            {rows.length === 0 && <div className="py-8 text-center text-sm text-slate-500">這個月沒有{filter === 'home' ? '主場' : '客場'}比賽</div>}
            {rows.map(g => (
                <a key={g.date} href={href(g)}
                    className={`grid grid-cols-[52px_26px_minmax(0,1fr)_auto] items-center gap-2 whitespace-nowrap border-b border-white/[0.08] px-0.5 py-2 ${g.date === today ? 'bg-[#C4CED2]/[0.06]' : ''}`}>
                    <div className="font-mono text-[12px] leading-tight text-slate-300">{md(g.date)}<span className="block text-[10px] text-slate-500">週{WD[new Date(g.date + 'T12:00:00Z').getUTCDay()]}</span></div>
                    {logo(g, 'h-[26px] w-[26px]')}
                    <div className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-[14px] font-semibold text-slate-100">{name(g)}</span>{tags(g)}
                    </div>
                    <div className="text-right font-mono text-[12px]">
                        {result(g) || <><span className="text-slate-300">{(window.kickoffTPE(g).match(/\d{2}:\d{2}$/) || [''])[0]}</span>
                            <span className="block text-[10px] text-slate-500">{window.kickoffTPE(g).replace(/\s*\d{2}:\d{2}$/, '')}</span></>}
                    </div>
                </a>
            ))}
        </div>
    );

    return (
        <div className="pb-10">
            <header className="mb-1">
                <h1 className="flex items-baseline gap-2 whitespace-nowrap text-[24px] font-bold leading-tight text-slate-50">
                    完整賽程<span className="font-mono text-[12px] font-normal text-slate-500">Schedule · {season}</span>
                </h1>
                <p className="mt-1 flex flex-nowrap gap-x-3.5 whitespace-nowrap text-[12px] text-slate-400 sm:flex-wrap">
                    <span>戰績 <b className="font-display text-[16px] font-semibold text-slate-100">{w}-{done.length - w}</b></span>
                    <span className="hidden sm:inline">主 {hw}-{hDone.length - hw} · 客 {aw}-{aDone.length - aw}</span>
                    <span className="hidden sm:inline">剩 {games.length - done.length} 場</span>
                    {next && <span className="min-w-0 truncate">下一場 {md(next.date)} {next.home ? 'vs' : '@'} {window.teamName(next.opp)} · {window.kickoffTPE(next)}</span>}
                </p>
            </header>
            <UI.TabBar ariaLabel="賽程月份" bleed value={cur} onChange={(k) => onMonth(k === defMonth ? '' : k)}
                tabs={months.map(mo => ({ key: mo, label: <>{Number(mo.slice(5))}月<span className="ml-1 font-mono text-[10px] font-normal text-slate-500">{games.filter(g => g.date.startsWith(mo)).length}</span></> }))} />
            <div className="my-2.5 flex items-center justify-between gap-2 whitespace-nowrap">
                <UI.Seg size="sm" ariaLabel="主客場篩選" value={filter} onChange={onFilter}
                    options={[{ value: '', label: '全部' }, { value: 'home', label: '主場' }, { value: 'away', label: '客場' }]} />
                <span className="flex gap-2.5 text-[11px] text-slate-500"><span className="hidden sm:inline">B2B＝背靠背</span><span>日期＝美東</span></span>
            </div>
            {grid}
            {list}
        </div>
    );
};

window.SchedulePage = SchedulePage;
