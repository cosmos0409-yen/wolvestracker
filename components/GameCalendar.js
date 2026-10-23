// 刊頭「賽程」月曆：取代原本的「最新一場」按鈕
// 一季（例行賽＋季後賽）的比賽畫在月曆格子上：對手縮寫＋勝綠／敗紅，季後賽另標「季後」；點有比賽的日子進該場單場頁
// 刊頭控制列是橫向捲動容器（overflow-x-auto），彈出層若放在裡面會被裁掉 → 用 portal 掛到 body、fixed 定位在按鈕下方
// props：games（[{date, matchup, wl, type}]，由舊到新）、season（顯示用）、activeDate（目前單場頁日期，有則高亮並預設翻到該月）、
//        inGame（單場頁中，按鈕呈選中樣式）、onPick(date)
const GameCalendar = ({ games, season, activeDate, inGame, onPick }) => {
    const { useState, useEffect, useRef, useMemo } = React;
    const [open, setOpen] = useState(false);
    const [month, setMonth] = useState(null);   // 'YYYY-MM'；null＝依 activeDate／最新一場
    const [pos, setPos] = useState(null);
    const btnRef = useRef(null), popRef = useRef(null);

    const byDate = useMemo(() => {
        const m = {};
        (games || []).forEach(g => { m[g.date] = g; });
        return m;
    }, [games]);
    const latest = games && games.length ? games[games.length - 1] : null;
    const months = useMemo(() => {
        if (!games || !games.length) return [];
        const out = [];
        let [y, mo] = games[0].date.slice(0, 7).split('-').map(Number);
        const [ey, emo] = latest.date.slice(0, 7).split('-').map(Number);
        while (y < ey || (y === ey && mo <= emo)) {
            out.push(`${y}-${String(mo).padStart(2, '0')}`);
            mo += 1; if (mo > 12) { mo = 1; y += 1; }
        }
        return out;
    }, [games, latest]);
    const defaultMonth = (activeDate && byDate[activeDate] ? activeDate : latest ? latest.date : '').slice(0, 7);
    const shown = month && months.includes(month) ? month : defaultMonth;
    const mi = months.indexOf(shown);

    // 換賽季（games 變了）就回到預設月份
    useEffect(() => { setMonth(null); }, [games]);

    const place = () => {
        const r = btnRef.current && btnRef.current.getBoundingClientRect();
        if (!r) return;
        const w = Math.min(320, window.innerWidth - 16);
        // 視窗太矮時在彈出層內捲動，不超出畫面
        setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8)), width: w,
                 maxHeight: Math.max(160, window.innerHeight - r.bottom - 14) });
    };
    useEffect(() => {
        if (!open) return;
        place();
        const off = (e) => {
            if (popRef.current && popRef.current.contains(e.target)) return;
            if (btnRef.current && btnRef.current.contains(e.target)) return;
            setOpen(false);
        };
        const esc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); btnRef.current && btnRef.current.focus(); } };
        document.addEventListener('mousedown', off);
        document.addEventListener('keydown', esc, true);
        window.addEventListener('resize', place);
        window.addEventListener('scroll', place, true);
        return () => {
            document.removeEventListener('mousedown', off);
            document.removeEventListener('keydown', esc, true);
            window.removeEventListener('resize', place);
            window.removeEventListener('scroll', place, true);
        };
    }, [open]);
    // 打開時把焦點移到選中／最新那場（鍵盤使用者不必從頭 Tab）
    useEffect(() => {
        if (!open || !popRef.current) return;
        const t = popRef.current.querySelector('[data-focus="1"]') || popRef.current.querySelector('button');
        if (t) t.focus();
    }, [open, !!pos]);

    const oppOf = (matchup) => {
        const away = /@/.test(matchup || '');
        const opp = (matchup || '').replace(/^MIN\s*(@|vs\.?)\s*/, '');
        return away ? `@${opp}` : opp;
    };
    const monthLabel = (ym) => `${ym.slice(0, 4)} 年 ${Number(ym.slice(5))} 月`;

    // 月曆格子：週日開頭；前面補空格
    const cells = [];
    if (shown) {
        const [y, m] = shown.split('-').map(Number);
        const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
        const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
        for (let i = 0; i < first; i++) cells.push(null);
        for (let d = 1; d <= days; d++) cells.push(`${shown}-${String(d).padStart(2, '0')}`);
    }
    const focusDate = activeDate && byDate[activeDate] ? activeDate : latest ? latest.date : null;
    const noGames = !games || !games.length;

    const pop = open && pos && ReactDOM.createPortal(
        <div ref={popRef} role="dialog" aria-label={`${season || ''} 賽程月曆`}
            style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxHeight, overflowY: 'auto' }}
            className="z-50 border border-white/15 bg-[#0C1A2E] p-3 text-slate-200 shadow-2xl">
            <div className="flex items-center justify-between gap-2">
                <button type="button" aria-label="上個月" disabled={mi <= 0} onClick={() => setMonth(months[mi - 1])}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-slate-300 hover:border-white/30 disabled:opacity-30 disabled:cursor-not-allowed">‹</button>
                <div className="text-center">
                    <div className="font-display text-[17px] font-bold tracking-wide text-slate-50">{shown ? monthLabel(shown) : ''}</div>
                    <div className="font-mono text-[10px] text-slate-500">{season} 賽程 · {games.length} 場</div>
                </div>
                <button type="button" aria-label="下個月" disabled={mi < 0 || mi >= months.length - 1} onClick={() => setMonth(months[mi + 1])}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-slate-300 hover:border-white/30 disabled:opacity-30 disabled:cursor-not-allowed">›</button>
            </div>
            <div className="mt-3 grid grid-cols-7 gap-1 text-center font-mono text-[10px] text-slate-500" aria-hidden="true">
                {['日', '一', '二', '三', '四', '五', '六'].map(w => <div key={w}>{w}</div>)}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
                {cells.map((d, i) => {
                    if (!d) return <div key={'b' + i} />;
                    const g = byDate[d], day = Number(d.slice(8));
                    if (!g) return <div key={d} className="flex h-11 items-start justify-center pt-1 font-mono text-[11px] text-slate-600">{day}</div>;
                    const win = g.wl === 'W', sel = d === activeDate, po = g.type === 'playoffs';
                    return (
                        <button key={d} type="button" data-focus={d === focusDate ? '1' : undefined}
                            aria-current={sel ? 'date' : undefined}
                            aria-label={`${d} ${g.matchup} ${win ? '勝' : g.wl === 'L' ? '敗' : ''}${po ? '（季後賽）' : ''}`}
                            title={`${d} ${g.matchup} ${win ? '勝' : g.wl === 'L' ? '敗' : ''}${po ? ' · 季後賽' : ''}`}
                            onClick={() => { setOpen(false); onPick(d); }}
                            className={`flex h-11 flex-col items-center justify-start gap-0.5 border pt-1 leading-none ${sel ? 'border-[#12A150] bg-[#12A150]/15' : 'border-white/10 hover:border-white/30'}`}>
                            <span className="font-mono text-[11px] text-slate-300">{day}</span>
                            <span className={`text-[10px] font-semibold ${win ? 'text-[#12A150]' : 'text-[#EF4444]'}`}>{oppOf(g.matchup)}</span>
                            {po && <span className="text-[8px] text-amber-300/90">季後</span>}
                        </button>
                    );
                })}
            </div>
            <div className="mt-2.5 flex items-center justify-between font-mono text-[10px] text-slate-500">
                <span><span className="text-[#12A150]">■</span> 勝　<span className="text-[#EF4444]">■</span> 敗　@＝客場</span>
                {latest && <button type="button" onClick={() => { setOpen(false); onPick(latest.date); }}
                    className="min-h-[24px] px-1 text-slate-400 hover:text-slate-100">最新一場 →</button>}
            </div>
        </div>,
        document.body
    );

    return (
        <>
            <button ref={btnRef} type="button" onClick={() => setOpen(o => !o)} disabled={noGames}
                aria-haspopup="dialog" aria-expanded={open}
                title={noGames ? `${season || '此賽季'} 沒有單場資料（單場資料從 2022-23 起）` : `${season} 賽程：點日期看該場 Box Score`}
                className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] ${inGame || open ? 'border-[#12A150] bg-[#12A150]/10 text-slate-50' : !noGames ? 'border-white/15 text-slate-400 hover:text-slate-100 hover:border-white/30' : 'border-white/10 text-slate-600 cursor-not-allowed'}`}>
                賽程
                {latest && <span className="ml-1.5 font-mono text-[11px] text-slate-500">{(inGame && activeDate ? activeDate : latest.date).slice(5).replace('-', '/')} {oppOf((inGame && byDate[activeDate] ? byDate[activeDate] : latest).matchup)}</span>}
            </button>
            {pop}
        </>
    );
};

window.GameCalendar = GameCalendar;
