// 單場比賽頁（Game Center）：網址 #game=YYYY-MM-DD[&p=球員]
// 資料：wolves_team_games/{date}（box/stats/opp）＋ wolves_player_games/{date}（players/oppPlayers）
//   季平均：該員逐場 bundle 取「此場之前」的比賽（GameAgg）；投籃點：wolves_shotcharts 以 gdate 篩（每日增量、每週整季對帳）
// 灰狼球員一律用 box score 的 personId 對應 players 文件的 playerId（名字寫法兩邊可能不同，且早期文件含非當時隊員）
// 舊場次沒有 box（2026-10 以前、未回補者）→ 比分看板／Box Score／焦點／Four Factors 降級隱藏
// props：date、gamePlayer（展開的球員名，網址 p=）、onExpand(name|'')
const GamePage = ({ date, gamePlayer, onExpand }) => {
    const { useState, useEffect, useMemo } = React;
    const UI = window.UI;
    const GA = window.GameAgg;

    const [docs, setDocs] = useState(undefined);      // undefined=載入中, null=查無, {team, player}
    const [loadErr, setLoadErr] = useState(null);
    const [index, setIndex] = useState([]);
    const [boxSide, setBoxSide] = useState('MIN');
    const [avgCache, setAvgCache] = useState({});     // {playerId: aggregate|null}（null=無 bundle）
    const [vsWho, setVsWho] = useState(null);
    const [shotWho, setShotWho] = useState('TEAM');
    const [shots, setShots] = useState(undefined);    // undefined=載入中, null=無文件, []=該場無點位
    const boxRef = React.useRef(null);
    const avgInflight = React.useRef({});
    const dateRef = React.useRef(date);
    dateRef.current = date;

    // ── 載入單場兩份文件（記憶體＋localStorage；未定稿 final=false 不寫 localStorage，免得鎖住半成品）──
    useEffect(() => {
        if (!window.db || !window.firebaseModules) return;
        let cancelled = false;
        setDocs(undefined); setLoadErr(null); setBoxSide('MIN'); setShots(undefined);
        setAvgCache({}); avgInflight.current = {};   // 季平均是「這場之前」，換場次要重算
        const mem = (window.__gameDocCache = window.__gameDocCache || {});
        (async () => {
            if (mem[date]) { setDocs(mem[date]); return; }
            const lsKey = `wt_gc_${date}`;
            try { const c = JSON.parse(localStorage.getItem(lsKey) || 'null'); if (c) { mem[date] = c; if (!cancelled) setDocs(c); return; } } catch (e) { /* ignore */ }
            const { doc, getDoc } = window.firebaseModules;
            try {
                const [t, p] = await Promise.all([
                    getDoc(doc(window.db, 'wolves_team_games', date)),
                    getDoc(doc(window.db, 'wolves_player_games', date)),
                ]);
                const v = (t.exists() || p.exists()) ? { team: t.exists() ? t.data() : null, player: p.exists() ? p.data() : null } : null;
                if (v) {
                    mem[date] = v;
                    const final = (v.team || v.player || {}).final !== false;
                    if (final) { try { localStorage.setItem(lsKey, JSON.stringify(v)); } catch (e) { /* quota */ } }
                }
                if (!cancelled) setDocs(v);
            } catch (e) {
                console.error('game page fetch fail', date, e);
                if (!cancelled) { setLoadErr(String(e.code || e.message || e)); setDocs(null); }
            }
        })();
        return () => { cancelled = true; };
    }, [date]);

    const meta = (docs && (docs.team || docs.player)) || {};
    const typeKey = meta.seasonType === '季後賽' ? 'playoffs' : 'regular';
    const season = window.seasonForDate(new Date(date + 'T12:00:00Z'));
    const box = docs && docs.team && docs.team.box && (docs.team.box.teams || []).length === 2 ? docs.team.box : null;

    // 賽程條：同季同賽別的比賽索引
    useEffect(() => {
        if (!docs || !window.loadGamesIndex) return;
        let cancelled = false;
        window.loadGamesIndex(season, typeKey).then(g => { if (!cancelled) setIndex(g); }).catch(e => console.error('game index fail', e));
        return () => { cancelled = true; };
    }, [season, typeKey, !!docs]);

    // ── 灰狼球員：box 名單（personId）× players 文件（playerId）──
    const playersDoc = (docs && docs.player && docs.player.players) || {};
    const byPid = useMemo(() => {
        const m = {};
        Object.entries(playersDoc).forEach(([name, d]) => { if (d && d.playerId) m[d.playerId] = { name, stats: d }; });
        return m;
    }, [docs]);
    const minBox = box ? box.players.filter(p => p.tricode === 'MIN') : [];
    const oppTeam = box ? box.teams.find(t => t.tricode !== 'MIN') : null;
    const minTeam = box ? box.teams.find(t => t.tricode === 'MIN') : null;
    const oppAbbr = (oppTeam && oppTeam.tricode) || meta.oppAbbr || String(meta.matchup || '').replace(/^.*?(vs\.|@)\s*/, '');
    // 灰狼上場球員清單：[{pid, name(數據 API 寫法，連結用), boxName, stats(單場進階)}]
    const minPlayers = box
        ? minBox.filter(p => p.stats && Object.keys(p.stats).length).map(p => ({ pid: p.personId, name: (byPid[p.personId] || {}).name || p.name, boxName: p.name, adv: (byPid[p.personId] || {}).stats || null, box: p }))
        : Object.entries(playersDoc).map(([name, d]) => ({ pid: d.playerId, name, boxName: name, adv: d, box: null }));

    // 季平均（此場之前）：lazily 讀該員 bundle
    const ensureAvg = (pid) => {
        if (!pid || avgCache[pid] !== undefined || avgInflight.current[`${season}_${typeKey}_${pid}`] || !window.loadSeasonGames) return;
        avgInflight.current[`${season}_${typeKey}_${pid}`] = true;   // 同一人只讀一次（多個區塊會同時要）
        const forDate = date;
        window.loadSeasonGames(season, typeKey, 'PLAYER', pid).then(({ games }) => {
            if (dateRef.current !== forDate) return;   // 已換到別場，丟掉舊結果
            const prior = (games || []).filter(g => g.date < date);
            setAvgCache(c => ({ ...c, [pid]: prior.length ? GA.aggregate(prior, null, 'TEAM') : null }));
        });
    };
    const expanded = minPlayers.find(p => p.name === gamePlayer || p.boxName === gamePlayer) || null;
    const vsPlayer = minPlayers.find(p => p.name === vsWho) || expanded
        || minPlayers.slice().sort((a, b) => ((b.box && b.box.stats.PTS) || (b.adv && b.adv.PTS) || 0) - ((a.box && a.box.stats.PTS) || (a.adv && a.adv.PTS) || 0))[0] || null;
    useEffect(() => { if (expanded) ensureAvg(expanded.pid); }, [expanded && expanded.pid, season, typeKey]);
    useEffect(() => { if (vsPlayer) ensureAvg(vsPlayer.pid); }, [vsPlayer && vsPlayer.pid, season, typeKey]);
    useEffect(() => { if (shotWho !== 'TEAM') ensureAvg(Number(shotWho)); }, [shotWho, season, typeKey]);

    // ── 投籃點：wolves_shotcharts/{TEAM|pid}_{season}_{type}，以 gdate 篩這場 ──
    useEffect(() => {
        if (!docs || !window.db) return;
        let cancelled = false;
        setShots(undefined);
        (async () => {
            const cache = (window.__shootTabCache = window.__shootTabCache || {});
            const docId = `${shotWho}_${season}_${typeKey}`;
            let v = cache[docId];
            if (v === undefined) {
                const { doc, getDoc } = window.firebaseModules;
                try {
                    const snap = await getDoc(doc(window.db, 'wolves_shotcharts', docId));
                    if (snap.exists()) {
                        const d = snap.data(), at = d.actionTypes || [], gd = d.gameDates || [];
                        v = { shots: (d.shots || []).map(s => ({ x: s.x, y: s.y, made: s.made, dist: s.dist, zone: s.zone, action: at[s.a], gdate: gd[s.g] })), assisted: d.assisted || {} };
                    } else v = null;
                    cache[docId] = v;
                } catch (e) { console.error('game shots fail', docId, e); v = null; }
            }
            if (!cancelled) setShots(v ? v.shots.filter(s => s.gdate === date) : null);
        })();
        return () => { cancelled = true; };
    }, [shotWho, season, typeKey, date, !!docs]);

    // ── 指標中繼資料（名稱／原文／方向／中性）一律取 constants.js defs ──
    const ALL_DEFS = [window.SPLITS_BASE_DEF, ...(window.trackingDefs || []), ...(window.shootingDefs || []), ...(window.defenseDefs || [])].filter(Boolean);
    const metaOf = (k) => { for (const d of ALL_DEFS) { const m = d.metrics.find(x => x.key === k); if (m) return m; } return { key: k, label: k }; };
    // 比率類的分母（判斷樣本少、顯示 命中/出手）
    const RATIO = { ...GA.RATIO_DEFS, ...Object.fromEntries(Object.entries(GA.EFG_DEFS).map(([k, [fgm, , fga]]) => [k, [fgm, fga]])), PCT_PLUSMINUS: [null, 'D_FGA'], D_FG3_PLUSMINUS: [null, 'D_FG3A'] };
    const MIN_N = 5;
    const fmtV = (k, v) => {
        if (typeof v !== 'number') return '—';
        const m = metaOf(k);
        const s = m.unit === '%' || /_PCT$|PLUSMINUS$/.test(k) ? v.toFixed(1) : (Number.isInteger(v) ? String(v) : v.toFixed(1));
        return (k === 'PCT_PLUSMINUS' && v > 0 ? '+' : '') + s + (m.unit === '%' ? '%' : '');
    };
    // 本場 vs 季平均：中性→不判；樣本少→不判；否則依 betterIsLarger
    const judge = (k, v, avg, ent) => {
        const m = metaOf(k);
        const r = RATIO[k], den = r && ent ? ent[r[1]] : null;
        const small = r && typeof den === 'number' && den < MIN_N;
        if (m.neutral || small || typeof v !== 'number' || typeof avg !== 'number' || Math.abs(v - avg) < 1e-9) return { good: false, bad: false, small };
        const better = (v > avg) === (m.betterIsLarger !== false);
        return { good: better, bad: !better, small };
    };
    const fracOf = (k, ent) => { const r = RATIO[k]; if (!r || !r[0] || !ent || typeof ent[r[1]] !== 'number') return null; return `${ent[r[0]]}/${ent[r[1]]}`; };

    // 連結：球員頁／Splits 指標走勢（帶 hl 圈出這場）
    const seasonState = season === window.CURRENT_SEASON ? { selectedSeasonKey: 'current', seasonTypeView: typeKey } : { selectedSeasonKey: `${season}_${typeKey}` };
    const playerHref = (name) => '#' + window.UrlState.serialize({ viewMode: 'PLAYER', selectedPlayer: name, activeTab: 'overview', ...seasonState });
    const metricHref = (name, k) => '#' + window.UrlState.serialize({ viewMode: 'PLAYER', selectedPlayer: name, activeTab: 'splits', ...seasonState, focusMetric: k, highlightDate: date });

    // 複製引用情境（StatCell／citeLine 讀）
    window.CiteCtx = { subject: expanded ? expanded.name : 'Minnesota Timberwolves', season: `${season} ${meta.seasonType || ''}`.trim(), asOfSnap: null, asOfAgg: null, isHistory: false };

    if (docs === undefined) return <div className="py-16 text-center text-sm text-slate-500 animate-pulse">載入比賽資料中…</div>;
    if (docs === null) return (
        <UI.Note tone="warn">{loadErr ? `比賽資料讀取失敗：${loadErr}` : `找不到 ${date} 的比賽資料（灰狼當天可能沒有比賽，或這場尚未抓取）`}</UI.Note>
    );

    const final = meta.final !== false;
    const wl = meta.wl;
    const linkCls = 'border-b border-transparent hover:border-[#12A150] hover:text-white transition-colors';

    // ── 賽程條 ──
    const idxPos = index.findIndex(g => g.date === date);
    const prevG = idxPos > 0 ? index[idxPos - 1] : null, nextG = idxPos >= 0 && idxPos < index.length - 1 ? index[idxPos + 1] : null;
    const strip = (
        <nav aria-label="賽程" className="flex items-stretch gap-1.5 border-b border-white/10 pb-3">
            <a href={prevG ? window.UrlState.gameHref(prevG.date) : undefined} aria-label="上一場" aria-disabled={!prevG}
                className={`flex w-8 shrink-0 items-center justify-center rounded border border-white/15 text-slate-400 ${prevG ? 'hover:border-white/40 hover:text-slate-100' : 'opacity-30 pointer-events-none'}`}>‹</a>
            <div className="flex flex-1 gap-1.5 overflow-x-auto [scrollbar-width:none]" ref={el => { if (el) { const on = el.querySelector('[aria-current="page"]'); if (on) el.scrollLeft = on.offsetLeft - el.clientWidth / 2 + on.clientWidth / 2; } }}>
                {index.map(g => (
                    <a key={g.date} href={window.UrlState.gameHref(g.date)} aria-current={g.date === date ? 'page' : undefined}
                        className={`w-[104px] shrink-0 rounded border px-2.5 py-1.5 text-[11px] ${g.date === date ? 'border-[#12A150] bg-[#12A150]/10 text-slate-50' : 'border-white/10 text-slate-400 hover:border-white/25 hover:text-slate-100'}`}>
                        <div className="font-mono text-[10px]">{g.date.slice(5)}</div>
                        <div className="font-medium text-slate-100">{String(g.matchup || '').replace(/^MIN\s*/, '')}</div>
                        <div className={`font-mono ${g.wl === 'W' ? 'text-[#12A150]' : 'text-[#EF4444]'}`}>{g.wl}</div>
                    </a>
                ))}
            </div>
            <a href={nextG ? window.UrlState.gameHref(nextG.date) : undefined} aria-label="下一場" aria-disabled={!nextG}
                className={`flex w-8 shrink-0 items-center justify-center rounded border border-white/15 text-slate-400 ${nextG ? 'hover:border-white/40 hover:text-slate-100' : 'opacity-30 pointer-events-none'}`}>›</a>
        </nav>
    );

    // ── 比分看板 ──
    const logo = (id) => `https://cdn.nba.com/logos/nba/${id}/primary/L/logo.svg`;
    const away = box && box.teams.find(t => !t.home), home = box && box.teams.find(t => t.home);
    const teamBlock = (t, side) => {
        const lose = t.score < (side === 'away' ? home.score : away.score);
        const score = <div className={`font-display text-[56px] sm:text-[80px] font-bold leading-none tabular-nums ${lose ? 'text-slate-50/40' : 'text-slate-50'}`}>{t.score}</div>;
        return (
            <div className={`flex items-center gap-3 sm:gap-4 ${side === 'home' ? 'flex-row-reverse text-right' : ''}`}>
                <img src={logo(t.teamId)} alt="" className="h-12 w-12 sm:h-20 sm:w-20 shrink-0" />
                <div className="min-w-0">
                    <div className="font-display text-[30px] sm:text-[40px] font-bold leading-none">{t.tricode}</div>
                    <div className="truncate text-[12px] text-slate-400">{t.name}</div>
                    <div className="font-mono text-[11px] text-slate-500">{side === 'home' ? '主' : '客'}</div>
                </div>
                <div className={side === 'home' ? 'mr-auto' : 'ml-auto'}>{score}</div>
            </div>
        );
    };
    const periodLabel = (p, i) => p.type === 'OVERTIME' || i >= 4 ? `OT${i - 3 > 1 ? i - 3 : ''}` : `Q${i + 1}`;
    const margin = box ? minTeam.score - oppTeam.score : null;
    const board = box ? (
        <div className="grid grid-cols-2 gap-4 border-b border-white/10 py-6 lg:grid-cols-[1fr_auto_1fr] lg:items-center lg:gap-6">
            <div className="order-2 lg:order-1">{teamBlock(away, 'away')}</div>
            <div className="order-1 col-span-2 text-center lg:order-2 lg:col-span-1">
                <span className="inline-block bg-[#C4CED2] px-2 py-0.5 font-mono text-[10px] font-semibold tracking-[0.14em] text-[#0A1626]">FINAL</span>
                {!final && <span className="ml-2 inline-block border border-amber-500/40 px-2 py-0.5 text-[10px] text-amber-300">數據可能更新</span>}
                <div className="mt-2 text-[13px] text-slate-200">{date}</div>
                {box.arena && <div className="text-[11px] text-slate-400">{box.arena}{box.attendance ? ` · ${box.attendance.toLocaleString()} 人` : ''}</div>}
                <div className={`mt-1.5 font-mono text-[11px] ${margin > 0 ? 'text-[#12A150]' : 'text-[#EF4444]'}`}>灰狼{margin > 0 ? '勝' : '敗'} {margin > 0 ? '+' : ''}{margin}</div>
                {away.periods.length > 0 && (
                    <table className="mx-auto mt-3 border-collapse font-mono text-[12px]" aria-label="每節比分">
                        <thead><tr>
                            <th className="px-2"></th>
                            {away.periods.map((p, i) => <th key={i} className="px-2 py-1 text-[10px] font-normal text-slate-500">{periodLabel(p, i)}</th>)}
                            <th className="border-l border-white/15 px-2 text-[10px] font-normal text-slate-500">T</th>
                        </tr></thead>
                        <tbody>{[away, home].map(t => {
                            const other = t === away ? home : away;
                            return (
                                <tr key={t.tricode} className="border-t border-white/10">
                                    <td className="px-2 py-1 text-left font-display text-[14px] font-bold">{t.tricode}</td>
                                    {t.periods.map((p, i) => <td key={i} className={`px-2 py-1 tabular-nums ${p.pts > ((other.periods[i] || {}).pts || 0) ? 'text-[#12A150]' : 'text-slate-300'}`}>{p.pts}</td>)}
                                    <td className="border-l border-white/15 px-2 py-1 font-semibold text-slate-50 tabular-nums">{t.score}</td>
                                </tr>
                            );
                        })}</tbody>
                    </table>
                )}
            </div>
            <div className="order-3">{teamBlock(home, 'home')}</div>
        </div>
    ) : (
        <div className="border-b border-white/10 py-6">
            <div className="font-display text-[34px] font-bold">{meta.matchup} <span className={wl === 'W' ? 'text-[#12A150]' : 'text-[#EF4444]'}>{wl}</span></div>
            <div className="text-[13px] text-slate-400">{date}{docs.team && docs.team.stats && typeof docs.team.stats.PTS === 'number' ? ` · 灰狼 ${docs.team.stats.PTS} 分` : ''}</div>
            <div className="mt-3"><UI.Note>這場沒有 box score（2026-10 起才每場抓取；更早只回補了 2025-26），所以沒有比分看板、Box Score 與 Four Factors。下方灰狼的單場進階數據照常顯示。</UI.Note></div>
        </div>
    );

    // ── 焦點：兩隊各項最高 ＋ Four Factors ──
    const played = (tri) => box.players.filter(p => p.tricode === tri && p.stats && Object.keys(p.stats).length);
    const leaderOf = (tri, k) => played(tri).reduce((a, b) => (b.stats[k] > (a ? a.stats[k] : -1) ? b : a), null);
    const headshot = (id) => `https://cdn.nba.com/headshots/nba/latest/260x190/${id}.png`;
    const ff = (t, o) => ({
        efg: (t.FGM + 0.5 * t.FG3M) / t.FGA * 100,
        tov: t.TOV / (t.FGA + 0.44 * t.FTA + t.TOV) * 100,
        orb: t.OREB / (t.OREB + o.DREB) * 100,
        ftr: t.FTM / t.FGA * 100,
    });
    const leaders = box && (
        <UI.Section title="本場焦點" en="Game Leaders" accent="green" sub="兩隊各項最高；Four Factors 由兩隊合計計算（有效命中率、失誤率、進攻籃板率、罰球率）">
            <div className="grid grid-cols-1 border-l border-t border-white/[0.08] sm:grid-cols-3">
                {[['PTS', '得分'], ['REB', '籃板'], ['AST', '助攻']].map(([k, zh]) => (
                    <div key={k} className="border-b border-r border-white/[0.08] px-3 py-2.5">
                        <div className="mb-1 font-mono text-[10px] tracking-[0.14em] text-slate-500">{zh} {k}</div>
                        {['MIN', oppAbbr].map(tri => {
                            const p = leaderOf(tri, k); if (!p) return null;
                            const mine = tri === 'MIN';
                            const pName = mine ? ((byPid[p.personId] || {}).name || p.name) : p.name;
                            return (
                                <div key={tri} className="flex items-center gap-2.5 border-t border-white/[0.06] py-1.5 first:border-t-0">
                                    <img src={headshot(p.personId)} alt="" loading="lazy" className="h-8 w-11 shrink-0 rounded bg-white/[0.04] object-cover object-top" onError={e => { e.currentTarget.style.visibility = 'hidden'; }} />
                                    <div className="min-w-0 flex-1 text-[13px]">
                                        {mine ? <a href={playerHref(pName)} className={linkCls}>{p.name}</a> : <span title="對手球員沒有個人頁（只抓灰狼的季資料）">{p.name}</span>}
                                        <div className="font-mono text-[10px] text-slate-500">{tri} · {p.stats.PTS}分 {p.stats.REB}板 {p.stats.AST}助</div>
                                    </div>
                                    <div className={`font-display text-[28px] font-bold leading-none ${mine ? 'text-[#12A150]' : 'text-slate-100'}`}>{p.stats[k]}</div>
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
            {(() => {
                const a = ff(minTeam.totals, oppTeam.totals), b = ff(oppTeam.totals, minTeam.totals);
                return (
                    <div className="mt-4 grid grid-cols-2 border-l border-t border-white/[0.08] sm:grid-cols-4">
                        {[['efg', '有效命中率', 'eFG%', false], ['tov', '失誤率', 'TOV%', true], ['orb', '進攻籃板率', 'OREB%', false], ['ftr', '罰球率', 'FTM/FGA', false]].map(([k, zh, en, low]) => {
                            const mWin = low ? a[k] < b[k] : a[k] > b[k];
                            return (
                                <div key={k} className="border-b border-r border-white/[0.08] px-3 py-2.5">
                                    <div className="text-[11px] text-slate-300">{zh}<span className="ml-1.5 font-mono text-[10px] text-slate-500">{en}</span></div>
                                    <div className="mt-1 flex items-baseline justify-between font-display text-[24px] font-semibold tabular-nums">
                                        <span className={mWin ? 'text-[#12A150]' : 'text-slate-200'}>{a[k].toFixed(1)}</span>
                                        <span className={!mWin ? 'text-slate-100' : 'text-slate-500'}>{b[k].toFixed(1)}</span>
                                    </div>
                                    <div className="mt-1.5 flex h-1 gap-0.5"><i className="block bg-[#12A150]" style={{ flex: a[k] }}></i><i className="block bg-[#C4CED2]/40" style={{ flex: b[k] }}></i></div>
                                    <div className="mt-1 flex justify-between font-mono text-[10px] text-slate-500"><span>MIN</span><span>{oppAbbr}</span></div>
                                </div>
                            );
                        })}
                    </div>
                );
            })()}
        </UI.Section>
    );

    // ── 展開列：該員單場進階（Tracking／最近防守者／Hustle）vs 季平均 ──
    const EXP_GROUPS = [...(window.trackingDefs || []).filter(d => ['Touches', 'Drives', 'CatchShoot', 'PullUpShot', 'Passing', 'Rebounding'].includes(d.id)),
        ...(window.defenseDefs || []).filter(d => (window.GAME_DEFENSE_IDS || []).includes(d.id))];
    const metricRow = (name, k, v, avg, ent, link = true) => {
        const m = metaOf(k), j = judge(k, v, avg, ent), frac = fracOf(k, ent);
        return (
            <div key={k} title={((window.GLOSSARY || {})[k] || {}).def || undefined}
                className={`-mx-1.5 flex items-baseline justify-between gap-2 border-b border-dotted border-white/10 px-1.5 py-1 text-[12px] ${j.good ? 'bg-[#12A150]/10 shadow-[inset_2px_0_0_#12A150]' : ''}`}>
                <span className="min-w-0">
                    {link ? <a href={metricHref(name, k)} className={`text-slate-200 ${linkCls}`}>{m.label}</a> : <span className="text-slate-200">{m.label}</span>}
                    {m.englishLabel && <span className="block font-mono text-[9px] text-slate-500">{m.englishLabel}</span>}
                </span>
                <span className="shrink-0 text-right">
                    <b className={`font-mono font-semibold ${j.good ? 'text-[#12A150]' : 'text-slate-100'}`}>{fmtV(k, v)}</b>
                    {frac && <span className="ml-1 font-mono text-[10px] text-slate-500">{frac}</span>}
                    {j.small && <span className="ml-1 text-[10px] text-amber-300/80">樣本少</span>}
                    <span className="block font-mono text-[10px] text-slate-500">季均 {avg === undefined ? '…' : fmtV(k, avg)}</span>
                </span>
            </div>
        );
    };
    const expandRow = (p) => {
        const ent = p.adv;
        const avgAgg = avgCache[p.pid];
        if (!ent) return <UI.Note>這位球員本場沒有進階數據</UI.Note>;
        const groups = EXP_GROUPS.map(d => ({ d, ms: d.metrics.filter(m => typeof ent[m.key] === 'number') })).filter(g => g.ms.length);
        return (
            <div className="px-3 pb-3 pt-2 sm:pl-10">
                <div className="grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
                    {groups.map(({ d, ms }) => (
                        <div key={d.id}>
                            <h4 className="mb-1 font-mono text-[10px] tracking-[0.1em] text-slate-500">{d.title}</h4>
                            {ms.map(m => metricRow(p.name, m.key, ent[m.key], avgAgg === undefined ? undefined : (avgAgg ? avgAgg[m.key] : null), ent))}
                        </div>
                    ))}
                </div>
                <p className="mt-2 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-500">
                    <span className="inline-block h-3 w-3 bg-[#12A150]/25 shadow-[inset_2px_0_0_#12A150]" aria-hidden="true"></span>
                    優於賽前季平均（失誤率、對手命中率越低越好；觸球、切入次數等次數類不標色）· 比率類出手少於 {MIN_N} 次標「樣本少」· 點指標名稱看逐場走勢 · 滑過看定義
                    {avgAgg === null && <span className="text-amber-300/80">（本季沒有更早的逐場資料，無季平均）</span>}
                </p>
            </div>
        );
    };

    // ── Box Score ──
    const BOX_COLS = [['MIN', 'MIN'], ['PTS', 'PTS'], ['FG', 'FG'], ['FG_PCT', 'FG%'], ['3P', '3P'], ['FG3_PCT', '3P%'], ['FT', 'FT'], ['OREB', 'OREB'], ['DREB', 'DREB'], ['REB', 'REB'], ['AST', 'AST'], ['STL', 'STL'], ['BLK', 'BLK'], ['TOV', 'TOV'], ['PF', 'PF'], ['PLUS_MINUS', '+/-']];
    const TOP_KEYS = ['PTS', 'REB', 'AST', 'STL', 'BLK'];
    const sideTri = boxSide === 'MIN' ? 'MIN' : oppAbbr;
    const sidePlayers = box ? box.players.filter(p => p.tricode === sideTri) : [];
    const sideTeam = box ? box.teams.find(t => t.tricode === sideTri) : null;
    const activeP = sidePlayers.filter(p => p.stats && Object.keys(p.stats).length);
    const topOf = (k) => Math.max(0, ...activeP.map(p => p.stats[k] || 0));
    const cell = (s, k) => {
        if (k === 'FG') return `${s.FGM}-${s.FGA}`;
        if (k === '3P') return `${s.FG3M}-${s.FG3A}`;
        if (k === 'FT') return `${s.FTM}-${s.FTA}`;
        if (k === 'FG_PCT') return s.FGA ? s.FG_PCT.toFixed(1) : '—';
        if (k === 'FG3_PCT') return s.FG3A ? s.FG3_PCT.toFixed(1) : '—';
        if (k === 'PLUS_MINUS') return s.PLUS_MINUS > 0 ? `+${s.PLUS_MINUS}` : String(s.PLUS_MINUS);
        return s[k] == null ? '' : String(s[k]);
    };
    const tdCls = (s, k) => {
        if (k === 'PLUS_MINUS') return s.PLUS_MINUS > 0 ? 'text-[#12A150]' : s.PLUS_MINUS < 0 ? 'text-[#EF4444]' : '';
        if (k === 'PTS') return TOP_KEYS.includes(k) && s[k] > 0 && s[k] === topOf(k) ? 'font-semibold text-[#12A150]' : 'font-semibold text-slate-50';
        return TOP_KEYS.includes(k) && s[k] > 0 && s[k] === topOf(k) ? 'font-semibold text-[#12A150]' : '';
    };
    const boxRow = (p) => {
        const mine = sideTri === 'MIN';
        const mp = mine ? minPlayers.find(x => x.pid === p.personId) : null;
        const open = mine && mp && expanded && expanded.pid === p.personId;
        const dnp = !p.stats || !Object.keys(p.stats).length;
        const toggle = () => { if (mine && mp) onExpand(open ? '' : mp.name); };
        const nameEl = mine && mp
            ? <a href={playerHref(mp.name)} onClick={e => e.stopPropagation()} className={linkCls}>{p.name}</a>
            : <span title={mine ? undefined : '對手球員沒有個人頁（只抓灰狼的季資料）'}>{p.name}</span>;
        return (
            <React.Fragment key={p.personId}>
                <tr onClick={dnp ? undefined : toggle} className={`border-b border-white/[0.05] ${mine && mp && !dnp ? 'cursor-pointer hover:bg-white/[0.03]' : ''} ${open ? 'bg-[#12A150]/[0.07]' : ''}`}>
                    <th scope="row" className="sticky left-0 bg-[#0A1626] px-2 py-1.5 text-left font-normal whitespace-nowrap">
                        <span className="inline-block w-6 font-mono text-[10px] text-slate-500">{p.jersey}</span>
                        {nameEl}
                        {p.position && <span className="ml-1.5 font-mono text-[10px] text-slate-500">{p.position}</span>}
                        {mine && mp && !dnp && <span className="ml-2 font-mono text-[10px] text-slate-500">{open ? '▴ 收合' : '▾ 進階'}</span>}
                    </th>
                    {dnp ? (
                        <td colSpan={BOX_COLS.length} className="px-2 py-1.5 text-left text-[12px] text-slate-500">{p.comment || 'DNP'}</td>
                    ) : BOX_COLS.map(([k]) => (
                        <td key={k} className={`px-2 py-1.5 text-right font-mono tabular-nums whitespace-nowrap ${tdCls(p.stats, k)}`}>{cell(p.stats, k)}</td>
                    ))}
                </tr>
                {open && <tr><td colSpan={BOX_COLS.length + 1} className="bg-[#12A150]/[0.04] p-0">{expandRow(mp)}</td></tr>}
            </React.Fragment>
        );
    };
    const boxCsv = () => ({
        header: ['球隊', '球員', '背號', '先發', ...BOX_COLS.map(c => c[1])],
        rows: box.players.map(p => [p.tricode, p.name, p.jersey, p.starter ? '先發' : '', ...(p.stats && Object.keys(p.stats).length ? BOX_COLS.map(([k]) => cell(p.stats, k)) : BOX_COLS.map((c, i) => i === 0 ? (p.comment || 'DNP') : ''))]),
    });
    const boxSection = box && (
        <UI.Section title="Box Score" en="Traditional" accent="silver"
            sub="點灰狼球員那一列展開本場進階（網址會記住，可分享）；點名字到球員頁 · 綠字＝該欄全隊最高"
            right={<>
                <UI.Seg ariaLabel="Box Score 球隊" size="sm" value={boxSide} onChange={setBoxSide}
                    options={[{ value: 'MIN', label: 'MIN 灰狼' }, { value: 'OPP', label: `${oppAbbr} 對手` }]} />
                <UI.ExportMenu title={`Box Score ${date} ${meta.matchup || ''}`} getNode={() => boxRef.current} csv={boxCsv} />
            </>}>
            <div ref={boxRef} className="overflow-x-auto border-t border-white/[0.08]">
                <table className="w-full min-w-[820px] border-collapse text-[13px]">
                    <caption className="sr-only">{sideTri} Box Score</caption>
                    <thead><tr className="border-b border-white/15">
                        <th scope="col" className="sticky left-0 bg-[#0A1626] px-2 py-2 text-left font-mono text-[10px] font-normal text-slate-500">球員</th>
                        {BOX_COLS.map(([k, l]) => <th key={k} scope="col" className="px-2 py-2 text-right font-mono text-[10px] font-normal text-slate-500">{l}</th>)}
                    </tr></thead>
                    <tbody>
                        <tr><td colSpan={BOX_COLS.length + 1} className="px-2 pt-3 pb-1 font-mono text-[10px] tracking-[0.14em] text-slate-500">先發 STARTERS</td></tr>
                        {sidePlayers.filter(p => p.starter).map(boxRow)}
                        <tr><td colSpan={BOX_COLS.length + 1} className="px-2 pt-3 pb-1 font-mono text-[10px] tracking-[0.14em] text-slate-500">替補 BENCH</td></tr>
                        {sidePlayers.filter(p => !p.starter).map(boxRow)}
                        {sideTeam && (
                            <tr className="border-t border-white/20 font-semibold text-slate-50">
                                <th scope="row" className="sticky left-0 bg-[#0A1626] px-2 py-2 text-left">合計</th>
                                {BOX_COLS.map(([k]) => <td key={k} className="px-2 py-2 text-right font-mono tabular-nums">{k === 'MIN' || k === 'PLUS_MINUS' ? '' : cell(sideTeam.totals, k)}</td>)}
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            {(box.inactives || []).filter(p => p.tricode === sideTri).length > 0 && (
                <p className="mt-2 text-[12px] text-slate-400"><span className="mr-2 font-mono text-[10px] text-slate-500">INACTIVE</span>
                    {box.inactives.filter(p => p.tricode === sideTri).map(p => `${p.jersey ? '#' + p.jersey + ' ' : ''}${p.name}`).join('　')}</p>
            )}
        </UI.Section>
    );
    // 沒有 box 的舊場次：灰狼球員清單（只有進階）
    const noBoxPlayers = !box && minPlayers.length > 0 && (
        <UI.Section title="灰狼球員本場進階" en="Tracking" accent="silver" sub="點球員展開本場進階；點名字到球員頁">
            <div className="border-t border-white/[0.08]">
                {minPlayers.map(p => {
                    const open = expanded && expanded.pid === p.pid;
                    return (
                        <div key={p.pid || p.name} className={`border-b border-white/[0.06] ${open ? 'bg-[#12A150]/[0.05]' : ''}`}>
                            <button type="button" onClick={() => onExpand(open ? '' : p.name)} className="flex w-full items-center justify-between px-2 py-2 text-left text-[13px] hover:bg-white/[0.03]">
                                <a href={playerHref(p.name)} onClick={e => e.stopPropagation()} className={linkCls}>{p.name}</a>
                                <span className="font-mono text-[11px] text-slate-500">{p.adv && typeof p.adv.PTS === 'number' ? `${p.adv.PTS} 分 · ` : ''}{open ? '▴ 收合' : '▾ 進階'}</span>
                            </button>
                            {open && expandRow(p)}
                        </div>
                    );
                })}
            </div>
        </UI.Section>
    );

    // ── 球隊對比（鏡像長條）──
    const MS = (docs.team && docs.team.stats) || {}, OS = (docs.team && docs.team.opp) || null;
    const T = box ? minTeam.totals : null, O = box ? oppTeam.totals : null;
    const pctOf = (a, b) => (b ? a / b * 100 : null);
    const CMP = [
        ['基本 BOX', box ? [
            ['FG_PCT', pctOf(T.FGM, T.FGA), pctOf(O.FGM, O.FGA)], ['FG3_PCT', pctOf(T.FG3M, T.FG3A), pctOf(O.FG3M, O.FG3A)], ['FT_PCT', pctOf(T.FTM, T.FTA), pctOf(O.FTM, O.FTA)],
            ['REB', T.REB, O.REB], ['OREB', T.OREB, O.OREB], ['AST', T.AST, O.AST], ['STL', T.STL, O.STL], ['BLK', T.BLK, O.BLK], ['TOV', T.TOV, O.TOV], ['PF', T.PF, O.PF],
        ] : []],
        ['TRACKING', ['TOUCHES', 'PASSES_MADE', 'DRIVES', 'POTENTIAL_AST', 'CATCH_SHOOT_EFG_PCT', 'PULL_UP_EFG_PCT'].map(k => [k, MS[k], OS ? OS[k] : null])],
        ['HUSTLE', ['DEFLECTIONS', 'CONTESTED_SHOTS', 'SCREEN_ASSISTS', 'SCREEN_AST_PTS', 'LOOSE_BALLS', 'BOX_OUTS', 'CHARGES_DRAWN'].map(k => [k, MS[k], OS ? OS[k] : null])],
    ].map(([g, rows]) => [g, rows.filter(r => typeof r[1] === 'number')]).filter(([, rows]) => rows.length);
    const LOW_BETTER = new Set(['TOV', 'PF']);
    const cmpLabel = (k) => ({ OREB: ['進攻籃板', 'OREB'], PF: ['犯規', 'PF'] }[k] || [metaOf(k).label, metaOf(k).englishLabel]);
    const cmpSection = CMP.length > 0 && (
        <UI.Section title="球隊對比" en="Team Comparison" accent="blue"
            sub={`左灰狼、右 ${oppAbbr}；條長以兩隊合計為分母，較佳一方粗體（失誤、犯規越少越好）${OS ? '' : ' · 這場沒有抓對手的 Tracking／Hustle（2026-10 起才有），右側顯示「—」'}`}>
            <div className="mb-1 grid grid-cols-[1fr_96px_1fr] items-center font-display text-[18px] font-bold sm:grid-cols-[1fr_150px_1fr]">
                <span className="text-[#12A150]">MIN</span><span className="text-center font-mono text-[10px] font-normal text-slate-500">指標</span><span className="text-right">{oppAbbr}</span>
            </div>
            {CMP.map(([g, rows]) => (
                <div key={g}>
                    <div className="border-b border-white/10 pb-1 pt-3 font-mono text-[10px] tracking-[0.14em] text-slate-500">{g}</div>
                    {rows.map(([k, a, b]) => {
                        const [zh, en] = cmpLabel(k);
                        const has = typeof b === 'number';
                        const sum = (a || 0) + (has ? b : 0) || 1;
                        const low = LOW_BETTER.has(k);
                        const mWin = has && a !== b && (low ? a < b : a > b), oWin = has && a !== b && !mWin;
                        const pct = /_PCT$/.test(k);
                        const f = v => typeof v !== 'number' ? '—' : pct ? v.toFixed(1) : (Number.isInteger(v) ? v : v.toFixed(1));
                        return (
                            <div key={k} className="grid grid-cols-[40px_1fr_96px_1fr_40px] items-center gap-2 border-b border-white/[0.04] py-1.5 sm:grid-cols-[52px_1fr_150px_1fr_52px]">
                                <span className={`font-mono text-[13px] tabular-nums ${mWin ? 'font-bold text-slate-50' : 'text-slate-300'}`}>{f(a)}</span>
                                <div className="relative h-2 bg-white/[0.04]"><i className="absolute inset-y-0 right-0 block bg-[#12A150]" style={{ width: `${(a || 0) / sum * 100}%` }}></i></div>
                                <div className="text-center text-[12px] text-slate-400">{zh}{en && <span className="block font-mono text-[9px] text-slate-500">{en}</span>}</div>
                                <div className="relative h-2 bg-white/[0.04]">{has && <i className="absolute inset-y-0 left-0 block bg-[#C4CED2]/45" style={{ width: `${b / sum * 100}%` }}></i>}</div>
                                <span className={`text-right font-mono text-[13px] tabular-nums ${oWin ? 'font-bold text-slate-50' : 'text-slate-300'}`}>{f(b)}</span>
                            </div>
                        );
                    })}
                </div>
            ))}
        </UI.Section>
    );

    // ── 本場 vs 季平均 ──
    const VS_KEYS = ['PTS', 'REB', 'AST', 'FG_PCT', 'FG3_PCT', 'TOV', 'PLUS_MINUS', 'DRIVES', 'TOUCHES', 'D_FG_PCT', 'CONTESTED_SHOTS', 'DEFLECTIONS'];
    const vsSection = vsPlayer && vsPlayer.adv && (() => {
        const ent = vsPlayer.adv, avgAgg = avgCache[vsPlayer.pid];
        const keys = VS_KEYS.filter(k => typeof ent[k] === 'number');
        return (
            <UI.Section title="本場 vs 季平均" en="Game vs Season" accent="green"
                sub="銀色刻度＝賽前季平均（不含本場）；條＝本場值，綠＝優於平均、紅＝低於平均，次數類（觸球、切入）為中性灰色">
                {/* 球員選擇放內容第一行（可換行）：Section 標題右側不換行，十幾個人會把手機版面撐寬 */}
                <div className="mb-3 flex flex-wrap gap-1.5">{minPlayers.filter(p => p.adv).map(p => (
                    <UI.Chip key={p.pid || p.name} active={p.pid === vsPlayer.pid} onClick={() => setVsWho(p.name)}>{p.boxName}</UI.Chip>
                ))}</div>
                {avgAgg === null && <div className="mb-3"><UI.Note>本季沒有更早的逐場資料，無季平均可比（例如球季第一場）</UI.Note></div>}
                <div className="grid grid-cols-2 border-l border-t border-white/[0.08] sm:grid-cols-3 lg:grid-cols-4">
                    {keys.map(k => {
                        // undefined＝載入中（顯示 …）；null＝本季無更早逐場（fmtV 顯示 —），與展開列同規則
                        const m = metaOf(k), v = ent[k], avg = avgAgg === undefined ? undefined : (avgAgg ? avgAgg[k] : null);
                        const j = judge(k, v, avg, ent);
                        const hi = Math.max(Math.abs(v), Math.abs(avg || 0)) * 1.3 || 1;
                        const color = j.good ? 'bg-[#12A150]' : j.bad ? 'bg-[#EF4444]' : 'bg-[#C4CED2]/50';
                        const d = typeof avg === 'number' ? v - avg : null;
                        return (
                            <a key={k} href={metricHref(vsPlayer.name, k)} className="group block border-b border-r border-white/[0.08] px-3 pb-3 pt-2.5 hover:bg-white/[0.03]">
                                <div className="flex justify-between text-[11px] text-slate-300"><span>{m.label}</span><span className="font-mono text-[10px] text-slate-500">{m.englishLabel}</span></div>
                                <div className="mb-2 mt-1 flex items-baseline gap-2">
                                    <span className="font-display text-[26px] font-semibold leading-none tabular-nums text-slate-50">{fmtV(k, v)}</span>
                                    {d != null && <span className={`font-mono text-[11px] ${j.good ? 'text-[#12A150]' : j.bad ? 'text-[#EF4444]' : 'text-slate-500'}`}>{d >= 0 ? '+' : ''}{d.toFixed(1)}</span>}
                                    {j.small && <span className="text-[10px] text-amber-300/80">樣本少</span>}
                                </div>
                                <div className="relative h-2.5 bg-white/[0.05]">
                                    <i className={`absolute inset-y-0.5 left-0 block ${color}`} style={{ width: `${Math.max(0, v) / hi * 100}%` }}></i>
                                    {typeof avg === 'number' && avg >= 0 && <u className="absolute -inset-y-1 block w-0.5 bg-[#C4CED2]" style={{ left: `${avg / hi * 100}%` }}></u>}
                                </div>
                                <div className="mt-1 flex justify-between font-mono text-[10px] text-slate-500"><span>本場</span><span>季均 {avg === undefined ? '…' : fmtV(k, avg)}</span></div>
                            </a>
                        );
                    })}
                </div>
                <p className="mt-2 text-[11px] text-slate-500">點任一格 → 該指標逐場走勢（圈出這場）</p>
            </UI.Section>
        );
    })();

    // ── 本場投籃 ──
    const ZONES = [['RA', '合理衝撞區', 'Restricted Area'], ['PAINT', '禁區（非 RA）', 'In The Paint'], ['MID', '中距離', 'Mid-Range'], ['C3', '底角三分', 'Corner 3'], ['AB3', '非底角三分', 'Above the Break 3']];
    const shotEnt = shotWho === 'TEAM' ? MS : ((minPlayers.find(p => String(p.pid) === String(shotWho)) || {}).adv || {});
    const shotAvg = shotWho === 'TEAM' ? null : avgCache[shotWho];
    const shotPlayers = minPlayers.filter(p => p.adv && p.adv.FGA > 0);
    const ShotChart = window.ShotChart;
    const shotSection = (
        <UI.Section title="本場投籃" en="Shot Chart" accent="green"
            sub="投籃點來自 shotchart（賽後隔天併入）；右表分區命中來自單場文件（每天更新）">
            <div className="mb-3 flex flex-wrap gap-1.5">
                <UI.Chip active={shotWho === 'TEAM'} onClick={() => setShotWho('TEAM')}>全隊</UI.Chip>
                {shotPlayers.map(p => <UI.Chip key={p.pid} active={String(shotWho) === String(p.pid)} onClick={() => setShotWho(String(p.pid))}>{p.boxName}</UI.Chip>)}
            </div>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start">
                <div>
                    {shots === undefined ? <div className="py-10 text-center text-sm text-slate-500 animate-pulse">載入投籃點…</div>
                        : !shots || shots.length === 0 ? <UI.Note>這場還沒有投籃點位（賽後隔天才會併入）</UI.Note>
                        : ShotChart && <ShotChart playerId={shotWho === 'TEAM' ? 0 : Number(shotWho)} teamMode={shotWho === 'TEAM'}
                            playerName={shotWho === 'TEAM' ? '灰狼全隊' : (shotPlayers.find(p => String(p.pid) === String(shotWho)) || {}).boxName}
                            externalShots={shots} periodLabel={`${date} ${meta.matchup || ''}`} />}
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-[13px]">
                        <caption className="sr-only">本場分區命中</caption>
                        <thead><tr className="border-b border-white/15">
                            {['分區', 'FGM-FGA', 'FG%', shotAvg ? '季均' : ''].map((h, i) => <th key={i} scope="col" className={`px-2 py-2 font-mono text-[10px] font-normal text-slate-500 ${i ? 'text-right' : 'text-left'}`}>{h}</th>)}
                        </tr></thead>
                        <tbody>{ZONES.map(([z, zh, en]) => {
                            const m = shotEnt[`${z}_FGM`], a = shotEnt[`${z}_FGA`];
                            const pct = a ? m / a * 100 : null, avg = shotAvg ? shotAvg[`${z}_FG_PCT`] : null;
                            const cls = pct == null || avg == null || a < MIN_N ? 'text-slate-200' : pct >= avg ? 'text-[#12A150]' : 'text-[#EF4444]';
                            return (
                                <tr key={z} className="border-b border-white/[0.06]">
                                    <th scope="row" className="px-2 py-1.5 text-left font-normal text-slate-200">{zh}<span className="ml-1.5 font-mono text-[10px] text-slate-500">{en}</span></th>
                                    <td className="px-2 py-1.5 text-right font-mono tabular-nums">{typeof a === 'number' ? `${m}-${a}` : '—'}</td>
                                    <td className={`px-2 py-1.5 text-right font-mono tabular-nums ${cls}`}>{pct == null ? '—' : pct.toFixed(1)}</td>
                                    <td className="px-2 py-1.5 text-right font-mono tabular-nums text-slate-500">{shotAvg ? (typeof avg === 'number' ? avg.toFixed(1) : '—') : ''}</td>
                                </tr>
                            );
                        })}</tbody>
                    </table>
                    {shotAvg && <p className="mt-2 text-[11px] text-slate-500">綠／紅＝高於／低於賽前季均（出手少於 {MIN_N} 次不標色）</p>}
                </div>
            </div>
        </UI.Section>
    );

    // ── 比賽資訊 ──
    const info = box && (box.arena || (box.officials || []).length > 0) && (
        <UI.Section title="比賽資訊" en="Game Info" accent="silver">
            <dl className="grid grid-cols-2 border-l border-t border-white/[0.08] sm:grid-cols-4">
                {[['場館', box.arena], ['觀眾', box.attendance ? box.attendance.toLocaleString() : ''], ['比賽時間', box.duration], ['裁判', (box.officials || []).join(' · ')]].filter(([, v]) => v).map(([k, v]) => (
                    <div key={k} className="border-b border-r border-white/[0.08] px-3 py-2.5">
                        <dt className="font-mono text-[10px] tracking-[0.12em] text-slate-500">{k}</dt><dd className="mt-1 text-[13px] text-slate-200">{v}</dd>
                    </div>
                ))}
            </dl>
        </UI.Section>
    );

    return (
        <div className="space-y-10">
            <div>
                {strip}
                {board}
            </div>
            {leaders}
            {boxSection}
            {noBoxPlayers}
            {cmpSection}
            {vsSection}
            {shotSection}
            {info}
            <p className="text-[11px] leading-relaxed text-slate-500">
                資料：NBA.com Stats（boxscoretraditionalv3／boxscoresummaryv3、leaguedash 單日 Tracking／Hustle、shotchartdetail）。
                {meta.partial ? ' 這場部分來源抓取不完整，之後的每日補抓會再補齊。' : ''}
            </p>
        </div>
    );
};

window.GamePage = GamePage;
