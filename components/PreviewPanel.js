// 單場頁「賽前預覽」模式：還沒有單場文件、但預覽文件（wolves_games_index/{season}_preview）裡有這天的比賽時，
// GamePage 用它取代比分看板與單場分頁。版型見 _mockup/preview.html
//   看板：雙方隊徽／戰績／主客、美東日期＋開賽時間（台北隔日 HH:MM）、球館、休息天數、本季第幾次交手、特殊賽事
//   雙方對照：preview.fields 的順序＋方向，名次寫數字＋英文序數（window.ordinal）
//   交手：window.Matchup 讀既有逐場 bundle（與對戰頁同一套範圍與標籤）；本季剩餘交手取自預覽賽程
//   近況：preview.form 30 隊各自近 5 場
// 比賽已開打／已結束但單場資料還沒抓進來：看板改顯示比分或進行中，並說明何時補上
// props：date（美東）、preview（整份預覽文件）、game（preview.games 裡這天那場）
const PreviewPanel = ({ date, preview, game }) => {
    const { useState, useEffect } = React;
    const UI = window.UI;
    const opp = game.opp;
    const home = !!game.home;
    const L = preview.league || {}, R = preview.ranks || {};
    const md = (d) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
    const WD = ['日', '一', '二', '三', '四', '五', '六'];
    const wd = WD[new Date(date + 'T12:00:00Z').getUTCDay()];
    const rec = (t) => (L[t] && typeof L[t].W === 'number' ? `${L[t].W}-${L[t].L}` : '');

    // ── 狀態：未開打／進行中（開賽後 3 小時內）／應已結束但數據未進來 ──
    const start = game.utc ? Date.parse(game.utc) : NaN;
    const now = Date.now();
    const hasScore = Array.isArray(game.score) && game.score.length === 2;
    const phase = hasScore || game.status === 3 || (isFinite(start) && now > start + 3 * 3600 * 1000) ? 'over'
        : game.status === 2 || (isFinite(start) && now > start) ? 'live' : 'pre';

    // ── 交手：近三季（本季未過半多含一季，與對戰頁同規則）──
    const [h2h, setH2h] = useState(undefined);   // undefined=載入中, null=失敗, {…}
    useEffect(() => {
        let cancelled = false;
        setH2h(undefined);
        (async () => {
            try {
                const M = window.Matchup;
                const win = M.windowSeasons('recent', await M.currentRegularGP());
                const all = await M.loadWindowGames(win.seasons, 'all');
                const row = M.tagOpponents(M.byOpponent(all), all).find(r => r.abbr === opp) || null;
                if (!cancelled) setH2h({ win, row });
            } catch (e) {
                console.error('preview h2h fail', e);
                if (!cancelled) setH2h(null);
            }
        })();
        return () => { cancelled = true; };
    }, [date, opp]);

    // 引用情境（「?」小卡、引用籃）
    window.CiteCtx = { subject: 'Minnesota Timberwolves', season: preview.season, context: `${md(date)} ${home ? 'vs.' : '@'} ${window.teamName(opp)}（賽前）`,
        asOfSnap: preview.statsAsOf || null, asOfAgg: null, isHistory: false };

    const sameOpp = (preview.games || []).filter(g => g.opp === opp);
    const nth = sameOpp.findIndex(g => g.date === date) + 1;
    const restTxt = (n) => n === 0 ? '背靠背' : typeof n === 'number' ? `休 ${n} 天` : '開季首戰';
    const tag = window.specialTag(game.label);

    // ── 看板 ──
    const team = (tri, id, side) => (
        <div className={`flex min-w-0 flex-1 items-center gap-2 whitespace-nowrap sm:gap-4 ${side === 'home' ? 'flex-row-reverse text-right' : ''}`}>
            <img src={window.teamLogo(id || tri)} alt="" className="h-10 w-10 shrink-0 sm:h-16 sm:w-16" onError={e => { e.currentTarget.style.visibility = 'hidden'; }} />
            <div className="min-w-0">
                <div className="font-display text-[26px] font-bold leading-none sm:text-[38px]">{tri}</div>
                <div className="font-mono text-[11px] text-slate-400">{[rec(tri), side === 'home' ? '主' : '客'].filter(Boolean).join(' · ')}</div>
            </div>
        </div>
    );
    const minSide = home ? 'home' : 'away';
    const away = home ? [opp, game.oppId] : ['MIN', 1610612750];
    const hm = home ? ['MIN', 1610612750] : [opp, game.oppId];
    const won = hasScore && game.score[0] > game.score[1];
    const phaseTag = phase === 'pre' ? '賽前預覽' : phase === 'live' ? '比賽進行中' : hasScore ? 'FINAL' : '比賽已結束';
    const board = (
        <div className="border-b border-white/10 py-5 text-center">
            <span className="inline-block bg-[#C4CED2] px-2 py-0.5 font-mono text-[10px] font-semibold tracking-[0.14em] text-[#0A1626]">{phaseTag}</span>
            <div className="mx-auto mt-3 flex max-w-3xl items-center gap-3 sm:gap-6">
                {team(away[0], away[1], 'away')}
                {hasScore
                    ? <div className="shrink-0 font-display text-[34px] font-bold leading-none tabular-nums sm:text-[52px]">
                        {home ? `${game.score[1]}-${game.score[0]}` : `${game.score[0]}-${game.score[1]}`}</div>
                    : <span className="shrink-0 font-mono text-[14px] text-slate-500">{home ? 'vs' : '@'}</span>}
                {team(hm[0], hm[1], 'home')}
            </div>
            <div className="mt-3 whitespace-nowrap">
                <div className="text-[15px] font-bold text-slate-50">
                    美東 {md(date)}（{wd}）{window.kickoffET(game)}<span className="text-slate-500"> · </span>{window.kickoffTPE(game)}
                </div>
                {(game.arena || game.city) && <div className="mt-0.5 truncate text-[11px] text-slate-400">{[game.arena, game.city].filter(Boolean).join(' · ')}</div>}
                {hasScore && <div className={`mt-1 font-mono text-[11px] ${won ? 'text-[#12A150]' : 'text-[#EF4444]'}`}>灰狼{won ? '勝' : '敗'} {won ? '+' : ''}{game.score[0] - game.score[1]}</div>}
            </div>
            <div className="mt-2.5 flex flex-wrap justify-center gap-1.5 whitespace-nowrap">
                <span className="rounded-full border border-white/15 px-2.5 py-0.5 text-[11px] text-slate-300">MIN {restTxt(game.rest && game.rest[0])} · {opp} {restTxt(game.rest && game.rest[1])}</span>
                {nth > 0 && <span className="rounded-full border border-white/15 px-2.5 py-0.5 text-[11px] text-slate-300">本季第 {nth} 次交手</span>}
                {tag && <span className="rounded-full border border-amber-400/50 px-2.5 py-0.5 text-[11px] text-amber-300">{tag}</span>}
            </div>
            {phase === 'over' && (
                <div className="mx-auto mt-3 max-w-xl text-left">
                    <UI.Note>單場數據（Box Score、題材、投籃）會在下次抓取後補上：台北 15:00 看門狗或隔天 03:00 每日抓取。</UI.Note>
                </div>
            )}
        </div>
    );

    // ── 雙方對照 ──
    const fields = (preview.fields || []).filter(f => L.MIN && L[opp] && typeof L.MIN[f.key] === 'number' && typeof L[opp][f.key] === 'number');
    const fmt = (k, v) => k === 'FG3_PCT' ? `${v.toFixed(1)}%` : k === 'NET_RATING' ? `${v > 0 ? '+' : ''}${window.fix1(v)}` : v.toFixed(1);
    const cell = (t, f, better, side) => {
        const rk = (R[t] || {})[f.key];
        return (
            <div className={`flex items-baseline gap-1.5 tabular-nums ${side === 'r' ? 'flex-row-reverse' : ''}`}>
                <span className={`font-display text-[22px] font-semibold leading-none ${better ? 'text-[#12A150]' : 'text-slate-100'}`}>{fmt(f.key, L[t][f.key])}</span>
                {rk && <span className={`font-mono text-[10px] ${rk <= 5 ? 'text-[#12A150]' : 'text-slate-500'}`}>{window.ordinal(rk)}</span>}
            </div>
        );
    };
    const tape = fields.length > 0 && (
        <UI.Section title="雙方對照" en="Tale of the Tape" accent="green" className="mt-8"
            sub={`本季每場平均與聯盟 ${preview.teamsN || 30} 隊名次${preview.statsAsOf ? `（截至 ${md(preview.statsAsOf)}）` : ''} · 綠＝較好的一方 · 節奏不分好壞`}>
            <div className="mx-auto max-w-[720px]">
                <div className="grid grid-cols-[1fr_auto_1fr] pb-1.5 font-mono text-[10px] text-slate-500">
                    <span>MIN</span><span className="min-w-[76px] text-center">本季 · 聯盟名次</span><span className="text-right">{opp}</span>
                </div>
                <div className="border-t border-white/[0.08]">
                    {fields.map(f => {
                        const a = L.MIN[f.key], b = L[opp][f.key];
                        const aBetter = f.dir === 'neutral' || a === b ? null : f.dir === 'low' ? a < b : a > b;
                        const [zh, en] = window.PREVIEW_LABELS[f.key] || [f.key, ''];
                        return (
                            <div key={f.key} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 whitespace-nowrap border-b border-white/[0.08] py-1.5">
                                {cell('MIN', f, aBetter === true, 'l')}
                                <div className="min-w-[76px] text-center text-[12px] leading-tight text-slate-300">{zh}{en && <span className="block font-mono text-[10px] text-slate-500">{en}</span>}</div>
                                {cell(opp, f, aBetter === false, 'r')}
                            </div>
                        );
                    })}
                </div>
            </div>
        </UI.Section>
    );

    // ── 交手 ──
    const box = 'min-w-0 whitespace-nowrap border-b border-r border-white/[0.08] px-3 py-2.5';
    const lbl = 'text-[11px] text-slate-400', big = 'font-display text-[26px] font-bold leading-tight text-slate-50', mid = 'font-display text-[22px] font-bold leading-tight text-slate-50', sm = 'font-mono text-[11px] text-slate-500';
    const rest = sameOpp.filter(g => g.date > date);
    const row = h2h && h2h.row;
    const last = row && row.games.length ? row.games[row.games.length - 1] : null;
    const lastScore = last && last.stats && typeof last.stats.PTS === 'number' && typeof last.stats.PLUS_MINUS === 'number'
        ? `${last.stats.PTS}-${last.stats.PTS - last.stats.PLUS_MINUS}` : '';
    const rangeName = h2h ? (h2h.win.extended ? '前三季＋本季' : '近三季') : '';
    const h2hSec = (
        <UI.Section title="交手" en="Head to Head" accent="green" className="mt-8">
            {h2h === undefined ? <div className="py-6 text-center text-sm text-slate-500 animate-pulse">讀取交手紀錄…</div>
                : h2h === null ? <UI.Note>交手紀錄讀取失敗，可以到對戰分析查看。</UI.Note>
                : (
                    <UI.Ledger cols="grid-cols-1 sm:grid-cols-3">
                        <div className={box}>
                            <div className={lbl}>{rangeName}交手</div>
                            <div className={big}>{row ? `${row.W}-${row.L}` : '0-0'}</div>
                            <div className={sm}>{h2h.win.seasons[h2h.win.seasons.length - 1]} 起 {row ? row.n : 0} 場{row ? ` · ${row.tag ? window.MATCHUP_TAGS[row.tag] : '無標籤'}` : ''}</div>
                        </div>
                        <div className={box}>
                            <div className={lbl}>上次交手</div>
                            <div className={mid}>{last ? `${last.wl === 'W' ? '勝' : '敗'} ${lastScore}` : '—'}</div>
                            <div className={sm}>{last ? `${last.date} ${String(last.matchup || '').includes('@') ? '@' : 'vs '}${opp}` : '範圍內沒有交手'}</div>
                        </div>
                        <div className={box}>
                            <div className={lbl}>本季剩餘交手</div>
                            <div className={mid}>{rest.length ? `${rest.length} 場` : '—'}</div>
                            <div className={sm}>{rest.length ? rest.map(g => md(g.date)).join(' · ') : '這是本季最後一次'}</div>
                        </div>
                    </UI.Ledger>
                )}
            <a href={window.UrlState.vsHref(opp)} className="mt-2 inline-block border-b border-transparent text-[12px] leading-6 text-slate-300 hover:border-[#12A150] hover:text-white">看 {opp} 近三季對戰分析 →</a>
        </UI.Section>
    );

    // ── 近況 ──
    const form = (t) => {
        const rows = (preview.form || {})[t] || [];
        if (!rows.length) return (
            <div key={t} className={box}><div className={lbl}>{t} 近況</div><div className={sm}>本季還沒有比賽</div></div>
        );
        const w = rows.filter(r => r.wl === 'W').length, lr = rows[rows.length - 1];
        return (
            <div key={t} className={box}>
                <div className="flex items-baseline justify-between gap-2"><span className={lbl}>{t} 近 {rows.length} 場</span><span className={sm}>{md(lr.date)} 止</span></div>
                <div className="mt-0.5 flex items-center gap-1.5">
                    <span className={big}>{w}-{rows.length - w}</span>
                    <span className="ml-1.5 inline-flex gap-[3px]">
                        {rows.map(r => <i key={r.date} title={`${md(r.date)} ${r.vs} ${r.wl} ${r.pts}-${r.opp}`} aria-label={`${md(r.date)} ${r.vs} ${r.wl === 'W' ? '勝' : '敗'} ${r.pts}-${r.opp}`}
                            className={`inline-block h-3.5 w-3.5 rounded-sm ${r.wl === 'W' ? 'bg-[#12A150]' : 'bg-[#EF4444]'}`} />)}
                    </span>
                </div>
                <div className={sm}>最近：{lr.vs} {lr.wl} {lr.pts}-{lr.opp}</div>
            </div>
        );
    };
    const formSec = (
        <UI.Section title="近況" en="Recent Form" accent="green" sub="方塊由舊到新 · 滑過看比分" className="mt-8">
            <UI.Ledger cols="grid-cols-1 sm:grid-cols-2">{form('MIN')}{form(opp)}</UI.Ledger>
        </UI.Section>
    );

    return <div>{board}{tape}{h2hSec}{formSec}</div>;
};

window.PreviewPanel = PreviewPanel;
