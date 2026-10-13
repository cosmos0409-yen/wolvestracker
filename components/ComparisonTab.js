// 跨季比較分頁：多選賽季 × 數據類別 → 並列各季終點值表格 + 點指標畫逐季折線
// seasons：可選賽季清單 [{key,label,short,order}]；loadSeason(key)→{team,player}（normalized）
const ComparisonTab = ({ viewMode, selectedPlayer, seasons, loadSeason }) => {
    const { useState, useEffect } = React;
    const trackingDefs = window.trackingDefs || [];
    const shootingDefs = window.shootingDefs || [];
    const defenseDefs = window.defenseDefs || [];
    const PLAY = window.PlayTypesList || [];
    const TrendChart = window.TrendChart;

    const [selected, setSelected] = useState([]);
    const [data, setData] = useState({});
    const [cat, setCat] = useState('base');
    const [openMetric, setOpenMetric] = useState(null);
    const tableRef = React.useRef(null);

    // 預設選最近兩季
    useEffect(() => {
        if (!selected.length && seasons.length) setSelected(seasons.slice(0, 2).map(s => s.key));
    }, [seasons]);

    // 載入選取賽季資料
    useEffect(() => {
        let cancelled = false;
        selected.forEach(async k => {
            if (data[k]) return;
            // loadSeason 會往上拋錯（呼叫端需區分「載入失敗」與「查無資料」），
            // 這裡必須接住，否則網路異常會變成 unhandled rejection 讓分頁卡在載入中。
            // 失敗時刻意「不寫入 data」：寫進去會讓 `if (data[k]) return` 永久命中，
            // 使用者再也不會重試，整欄卡在「—」直到重整頁面
            let v;
            try { v = await loadSeason(k); }
            catch (e) { console.error('comparison season load fail', k, e); return; }
            if (!cancelled) setData(prev => prev[k] ? prev : { ...prev, [k]: v || { team: null, player: null } });
        });
        return () => { cancelled = true; };
    }, [selected]);

    const flat = defs => defs.reduce((a, d) => a.concat(d.metrics.map(m => ({ k: m.key, l: m.label, e: m.englishLabel, pct: m.unit === '%' }))), []);
    const CATS = {
        base: { label: '基本', metrics: [
            { k: 'PTS', l: '得分', e: 'PTS' }, { k: 'REB', l: '籃板', e: 'REB' }, { k: 'AST', l: '助攻', e: 'AST' },
            { k: 'FG_PCT', l: '命中率', e: 'FG%', pct: true }, { k: 'FG3_PCT', l: '三分命中率', e: '3P%', pct: true }, { k: 'FT_PCT', l: '罰球命中率', e: 'FT%', pct: true },
            { k: 'STL', l: '抄截', e: 'STL' }, { k: 'BLK', l: '阻攻', e: 'BLK' }, { k: 'TOV', l: '失誤', e: 'TOV' }, { k: 'PLUS_MINUS', l: '正負值', e: '+/-' },
        ] },
        playtype: { label: 'Playtype', metrics: PLAY.map(t => ({ k: t, l: t, e: '進攻 PPP', playtype: true })) },
        tracking: { label: '進階', metrics: flat(trackingDefs) },
        shooting: { label: '投籃', metrics: ((shootingDefs.find(d => d.id === 'ShotZones') || {}).metrics || []).map(m => ({ k: m.key, l: m.label, e: m.englishLabel, pct: true })) },
        defense: { label: '防守', metrics: flat(defenseDefs) },
        onoff: { label: 'On/Off', playerOnly: true, metrics: [
            { k: 'ON_NET_RATING', l: '在場淨效率', e: 'On NetRtg' }, { k: 'OFF_NET_RATING', l: '不在場淨效率', e: 'Off NetRtg' },
            { k: 'ON_OFF_RATING', l: '在場進攻效率', e: 'On OffRtg' }, { k: 'ON_DEF_RATING', l: '在場防守效率', e: 'On DefRtg' },
        ] },
    };
    const catKeys = Object.keys(CATS).filter(c => !(CATS[c].playerOnly && viewMode === 'TEAM'));
    const activeCat = catKeys.includes(cat) ? cat : 'base';
    const metrics = CATS[activeCat].metrics;

    // 選取的賽季（依 order 排序，供折線 X 軸）
    const cols = seasons.filter(s => selected.includes(s.key)).sort((a, b) => a.order - b.order);

    const getVal = (key, m) => {
        const sd = data[key];
        if (!sd) return null;
        if (m.playtype) {
            const arr = viewMode === 'TEAM' ? (sd.team && sd.team.stats) : (sd.player && sd.player.stats && sd.player.stats[selectedPlayer]);
            const it = (arr || []).find(s => s.playType === m.k && (s.side || 'offensive') === 'offensive');
            return it ? it.ppp : null;
        }
        const dict = viewMode === 'TEAM'
            ? (sd.team && sd.team[activeCat])
            : (sd.player && sd.player[activeCat] && sd.player[activeCat][selectedPlayer]);
        const v = dict && dict[m.k];
        return typeof v === 'number' ? v : null;
    };

    // 基本數據與百分比統一一位小數（避免同列出現「1」與「0.7」）；Playtype PPP 兩位；Tracking 等保留原始精度（如 PTS/Touch 0.338）
    const fmt = (v, m) => v == null ? '—'
        : m.pct ? v.toFixed(1) + '%'
        : m.playtype ? v.toFixed(2)
        : activeCat === 'base' || activeCat === 'onoff' ? v.toFixed(1) : v;

    // 該欄（賽季）此球員的 metadata：球隊標示與「跨隊不適用」共用同一份來源
    const metaOf = (key) => viewMode === 'PLAYER' ? (data[key]?.player?.meta?.[selectedPlayer] || null) : null;
    // 對位防守的指標 key 集合：同屬 defense 類別，但只有這一組綁 TeamID。
    // Hustle / DefenseBox 走 leaguedash，跨隊拿得到值，不可一併標成不適用
    const MATCHUP_KEYS = new Set(((defenseDefs.find(d => d.id === 'MatchupDefense') || {}).metrics || []).map(m => m.key));
    // 只在「值真的是 null」時才問是不是不適用；有數字一律照常顯示（含真的是 0）
    const naOf = (key, m) => {
        const meta = metaOf(key);
        if (!meta || !meta.isNewcomer) return null;
        if (activeCat === 'onoff' || (activeCat === 'defense' && MATCHUP_KEYS.has(m.k))) return window.NA_REASON.CROSS_TEAM;
        return null;
    };
    const toggle = k => setSelected(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]);

    const trendPts = openMetric ? cols.map(c => ({ label: c.short || c.label, value: getVal(c.key, openMetric) })).filter(p => typeof p.value === 'number') : [];

    const UI = window.UI;
    const catSub = {
        base: '傳統數據，各季終點快照',
        playtype: 'Synergy 進攻面 PPP（每球權得分），各季終點快照',
        tracking: 'NBA Tracking，各季終點快照',
        shooting: '分區命中率，各季終點快照',
        defense: '最近防守者／Hustle／防守 box，各季終點快照',
        onoff: '球隊在該球員上場／下場時的每 100 回合效率',
    }[activeCat];

    return (
        <div className="space-y-8">
            {/* 賽季多選 + 類別 */}
            <div className="space-y-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                    <span className="mr-1 text-[11px] text-slate-500">比較賽季</span>
                    {seasons.map(s => (
                        <UI.Chip key={s.key} active={selected.includes(s.key)} onClick={() => toggle(s.key)}>{s.label}</UI.Chip>
                    ))}
                </div>
            </div>

            <UI.Section title={viewMode === 'PLAYER' ? selectedPlayer : '全隊'} en="Season by Season" accent="blue"
                sub={`${catSub} · 點指標列看逐季折線 · 「—」表示該季無此類別資料`}
                right={<UI.Seg ariaLabel="比較類別" size="sm" value={activeCat} onChange={(c) => { setCat(c); setOpenMetric(null); }}
                    options={catKeys.map(c => ({ value: c, label: CATS[c].label }))} />}>
                {cols.length === 0 ? (
                    <UI.Note>請至少選一個賽季</UI.Note>
                ) : (
                    <div className="space-y-4">
                        {/* 折線（點指標展開） */}
                        {openMetric && TrendChart && trendPts.length > 0 && (
                            <div className="border border-white/10 p-4">
                                <div className="mb-3 text-[13px] font-medium text-slate-100">{openMetric.l} 逐季變化</div>
                                <TrendChart points={trendPts} baseline={null} title={`${openMetric.l} 逐季變化`} />
                            </div>
                        )}
                        {/* 比較表：列＝指標、欄＝賽季（依時間排序） */}
                        <div className="flex justify-end">
                            <UI.ExportMenu title={`跨季比較（${CATS[activeCat].label}）`} getNode={() => tableRef.current}
                                csv={() => ({ header: ['指標', '原文', ...cols.map(c => c.label)], rows: metrics.map(m => [m.l, m.e || '', ...cols.map(c => { const v = getVal(c.key, m); return v == null ? '' : v; })]) })} />
                        </div>
                        <div ref={tableRef} className="overflow-x-auto border-t border-white/[0.08]">
                            <table className="w-full text-sm border-collapse">
                                <caption className="sr-only">跨季比較表</caption>
                                <thead>
                                    <tr className="border-b border-white/15">
                                        <th scope="col" className="px-3 py-2 text-left text-[11px] font-normal text-slate-400 max-sm:sticky max-sm:left-0 max-sm:bg-[#0A1626]">指標</th>
                                        {cols.map(c => {
                                            const tag = window.tagOfMeta(metaOf(c.key));
                                            return (
                                                <th key={c.key} scope="col" className="px-3 py-2 text-right text-[11px] font-normal whitespace-nowrap text-slate-400">
                                                    {c.short || c.label}
                                                    {tag && <span className="ml-1 font-mono text-[10px] text-amber-400/80">{tag}</span>}
                                                </th>
                                            );
                                        })}
                                    </tr>
                                </thead>
                                <tbody>
                                    {metrics.map(m => {
                                        const open = openMetric && openMetric.k === m.k;
                                        return (
                                            <tr key={m.k} onClick={() => setOpenMetric(open ? null : m)}
                                                className={`cursor-pointer border-b border-white/[0.06] transition-colors ${open ? 'bg-[#12A150]/[0.08]' : 'odd:bg-white/[0.015] hover:bg-white/[0.04]'}`}>
                                                <th scope="row" className="px-3 py-2 text-left font-normal max-sm:sticky max-sm:left-0 max-sm:bg-[#0A1626]">
                                                    <span className="text-slate-200">{m.l}</span>
                                                    {m.e && <span className="ml-1.5 font-mono text-[10px] text-slate-500">{m.e}</span>}
                                                </th>
                                                {cols.map(c => {
                                                    const v = getVal(c.key, m);
                                                    const na = v == null ? naOf(c.key, m) : null;
                                                    return (
                                                        <td key={c.key} title={na || undefined}
                                                            className={`px-3 py-2 text-right font-mono tabular-nums ${v == null ? 'text-slate-600' : 'text-slate-200'} ${na ? 'cursor-help' : ''}`}>
                                                            {fmt(v, m)}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <p className="text-[11px] leading-relaxed text-slate-500">
                            欄頭有 <span className="font-mono text-amber-400/80">@隊名</span> 者為該季在別隊，
                            其最近防守者（Defense Dashboard）與 On/Off 為跨隊不適用（滑過「—」可看說明）。
                        </p>
                    </div>
                )}
            </UI.Section>
        </div>
    );
};

window.ComparisonTab = ComparisonTab;
