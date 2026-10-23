// 跨季比較分頁：賽季軌跡疊圖（逐場對齊）＋ 多選賽季 × 數據類別 → 並列各季終點值表格 + 點指標畫逐季折線
// seasons：可選賽季清單 [{key,label,short,order}]；loadSeason(key)→{team,player}（normalized）
// 逐季折線：單一指標可疊加其他球員／全隊（他隊季別空心點＋@隊名）；多選指標改小圖並排或指數化疊圖
const ComparisonTab = ({ viewMode, selectedPlayer, playerId, seasons, loadSeason }) => {
    const { useState, useEffect } = React;
    const trackingDefs = window.trackingDefs || [];
    const shootingDefs = window.shootingDefs || [];
    const defenseDefs = window.defenseDefs || [];
    const PLAY = window.PlayTypesList || [];
    const LineOverlay = window.LineOverlay;

    const [selected, setSelected] = useState([]);
    const [data, setData] = useState({});
    const [cat, setCat] = useState('base');
    const [openKeys, setOpenKeys] = useState([]);      // 點選的指標 key（可多選，最多 MAX_OPEN）
    const [extras, setExtras] = useState([]);          // 疊加比較的其他球員名；'__TEAM__'＝全隊
    const [multiMode, setMultiMode] = useState('small'); // 多指標：small 小圖並排／index 指數化疊圖
    const chartRef = React.useRef(null);
    const MAX_OPEN = 8, MAX_EXTRAS = 3, TEAM = '__TEAM__';
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

    const flat = defs => defs.reduce((a, d) => a.concat(d.metrics.map(m => ({ k: m.key, l: window.metricLabel(m), e: m.englishLabel, pct: m.unit === '%' }))), []);
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

    // who：省略＝頁面主角（全隊或 selectedPlayer）；TEAM＝全隊；其他字串＝該球員
    const getVal = (key, m, who) => {
        const sd = data[key];
        if (!sd) return null;
        const isTeam = who === TEAM || (!who && viewMode === 'TEAM');
        const pname = who && who !== TEAM ? who : selectedPlayer;
        if (m.playtype) {
            const arr = isTeam ? (sd.team && sd.team.stats) : (sd.player && sd.player.stats && sd.player.stats[pname]);
            const it = (arr || []).find(s => s.playType === m.k && (s.side || 'offensive') === 'offensive');
            return it ? it.ppp : null;
        }
        const dict = isTeam
            ? (sd.team && sd.team[activeCat])
            : (sd.player && sd.player[activeCat] && sd.player[activeCat][pname]);
        const v = dict && dict[m.k];
        return typeof v === 'number' ? v : null;
    };

    // 基本數據與百分比統一一位小數（避免同列出現「1」與「0.7」）；Playtype PPP 兩位；Tracking 等保留原始精度（如 PTS/Touch 0.338）
    const fmt = (v, m) => v == null ? '—'
        : m.pct ? v.toFixed(1) + '%'
        : m.playtype ? v.toFixed(2)
        : activeCat === 'base' || activeCat === 'onoff' ? v.toFixed(1) : v;

    // 該欄（賽季）此球員的 metadata：球隊標示與「跨隊不適用」共用同一份來源
    const metaOf = (key, who) => (who === TEAM || (!who && viewMode !== 'PLAYER')) ? null : (data[key]?.player?.meta?.[who || selectedPlayer] || null);
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

    // 臉書用純文字：臉書不吃表格、字是比例字寬對不齊，改成「指標｜各季值」一行一項，第一行是賽季表頭。
    // 數字格式與畫面上的表格相同（fmt）；全部同賽別時表頭只寫年份、賽別放第一格，混選才用「24-25例行」
    const fbText = () => {
        if (cols.some(c => !data[c.key])) { UI.toast('資料還在載入，請稍候再複製'); return null; }
        const TYPE_LABEL = { regular: '例行賽', playoffs: '季後賽' };
        const sameType = cols.every(c => c.type === cols[0].type) && TYPE_LABEL[cols[0].type];
        const tags = cols.map(c => window.tagOfMeta(metaOf(c.key)));
        const head = cols.map((c, i) => (sameType && c.season ? c.season.slice(2) : (c.short || c.label)) + tags[i]);
        // Playtype 表格只有英文 key，臉書讀者看不懂 → 取 glossary 定義冒號前的中文名（去掉括號補充）放前面
        const ptName = k => (((window.GLOSSARY || {})[`PT_${k}`] || {}).def || '').split('：')[0].replace(/（.*?）/g, '');
        const rows = metrics.map(m => {
            const vals = cols.map(c => fmt(getVal(c.key, m), m));
            const name = m.playtype ? [ptName(m.k), m.k].filter(Boolean).join(' ')
                : `${m.l}${m.e && m.e !== m.l ? ` ${m.e}` : ''}`;
            return { line: `${name}｜${vals.join('｜')}`, hasNull: vals.includes('—') };
        });
        const notes = [
            tags.some(Boolean) && '@隊名＝該季效力他隊',
            rows.some(r => r.hasNull) && '—＝該季無此項資料',
        ].filter(Boolean);
        const subject = viewMode === 'PLAYER' ? selectedPlayer : '灰狼全隊';
        return [
            `【${subject}｜跨季比較・${CATS[activeCat].label}${activeCat === 'playtype' ? '（進攻 PPP）' : ''}】`,
            `${sameType || '賽季'}｜${head.join('｜')}`,
            '',
            ...rows.map(r => r.line),
            '',
            ...(notes.length ? [notes.join('；')] : []),
            `資料：NBA.com Stats${activeCat === 'playtype' ? '／Synergy' : ''}，各季期末快照`,
            `${location.origin}${location.pathname}${location.hash}`,
        ].join('\n');
    };

    // ── 逐季折線（疊圖）──
    const openMetrics = metrics.filter(m => openKeys.includes(m.k));
    const toggleMetric = (m) => setOpenKeys(prev => prev.includes(m.k) ? prev.filter(k => k !== m.k) : (prev.length >= MAX_OPEN ? prev : [...prev, m.k]));
    // 可加入比較的球員：已載入各季資料裡出現過的名字（不含主角）
    const playerPool = viewMode !== 'PLAYER' ? [] : [...new Set(cols.flatMap(c => Object.keys(data[c.key]?.player?.meta || {})))]
        .filter(n => n !== selectedPlayer).sort();
    const SERIES_COLORS = ['#12A150', '#5B9BD5', '#F59E0B', '#A78BFA'];
    const INDEX_COLORS = ['#12A150', '#5B9BD5', '#F59E0B', '#A78BFA', '#C4CED2', '#2DD4BF', '#F472B6', '#FBBF24'];
    const nameOf = who => who === TEAM || (!who && viewMode === 'TEAM') ? '全隊' : (who || selectedPlayer);
    // 圖上標籤用姓（Jr. 之類連同前一個字）
    const shortName = n => { if (n === '全隊') return n; const w = n.split(' '); return /^(Jr\.?|Sr\.?|II|III|IV)$/.test(w[w.length - 1]) ? w.slice(-2).join(' ') : w[w.length - 1]; };
    const xsOf = () => cols.map(c => c.short || c.label);
    const seriesFor = (m) => [null, ...extras].map((who, i) => {
        const tags = cols.map(c => window.tagOfMeta(metaOf(c.key, who)) || '');
        return {
            key: who || 'main', label: shortName(nameOf(who)), color: who === TEAM ? '#C4CED2' : SERIES_COLORS[i % SERIES_COLORS.length],
            dashed: who === TEAM, values: cols.map(c => getVal(c.key, m, who)), hollow: tags.map(Boolean), tags,
        };
    });
    const fmtOf = m => v => m.playtype ? v.toFixed(2) : m.pct ? v.toFixed(1) : (Number.isInteger(v) ? String(v) : v.toFixed(1));
    // 指數化：每項以「第一個有值的季」＝100，不同單位才能放同一把尺看成長幅度
    const indexSeries = () => openMetrics.map((m, i) => {
        const vals = cols.map(c => getVal(c.key, m));
        const base = vals.find(v => typeof v === 'number' && v !== 0);
        return { key: m.k, label: m.l, color: INDEX_COLORS[i % INDEX_COLORS.length], values: vals.map(v => typeof v === 'number' && base ? +(v / base * 100).toFixed(1) : null) };
    });

    // 折線的臉書純文字：與上方表格匯出（fbText）同格式——第一行賽季表頭、一行一項「名稱｜各季值」，數字格式同表格（fmt）。
    // 只有主角＝每項指標一行；有疊加球員＝每位球員一行（多指標時名稱寫「球員・指標」）；指數化＝各季值改成指數（首季＝100）
    const chartText = () => {
        if (cols.some(c => !data[c.key])) { UI.toast('資料還在載入，請稍候再複製'); return null; }
        const TYPE_LABEL = { regular: '例行賽', playoffs: '季後賽' };
        const sameType = cols.every(c => c.type === cols[0].type) && TYPE_LABEL[cols[0].type];
        const tags = cols.map(c => window.tagOfMeta(metaOf(c.key)));
        const head = cols.map((c, i) => (sameType && c.season ? c.season.slice(2) : (c.short || c.label)) + tags[i]);
        const ptName = k => (((window.GLOSSARY || {})[`PT_${k}`] || {}).def || '').split('：')[0].replace(/（.*?）/g, '');
        const mName = m => m.playtype ? [ptName(m.k), m.k].filter(Boolean).join(' ') : `${m.l}${m.e && m.e !== m.l ? ` ${m.e}` : ''}`;
        const isIndex = openMetrics.length > 1 && multiMode === 'index';
        let extraTag = false;
        const rows = [];
        if (isIndex) {
            indexSeries().forEach(s => {
                const m = openMetrics.find(x => x.k === s.key);
                rows.push(`${mName(m)}｜${s.values.map(v => v == null ? '—' : String(v)).join('｜')}`);
            });
        } else {
            openMetrics.forEach(m => {
                [null, ...extras].forEach(who => {
                    const vals = cols.map(c => {
                        const v = fmt(getVal(c.key, m, who), m);
                        // 疊加球員的他隊季別：表頭只標得出主角，其他人的 @隊名 接在數值後
                        const t = who && who !== TEAM && v !== '—' ? window.tagOfMeta(metaOf(c.key, who)) : '';
                        if (t) extraTag = true;
                        return v + (t || '');
                    });
                    const label = !extras.length ? mName(m)
                        : openMetrics.length === 1 ? nameOf(who)
                        : `${nameOf(who)}・${m.l}`;
                    rows.push(`${label}｜${vals.join('｜')}`);
                });
            });
        }
        const hasNull = rows.some(r => r.split('｜').slice(1).includes('—'));
        const notes = [
            (tags.some(Boolean) || extraTag) && '@隊名＝該季效力他隊',
            isIndex && '數值為指數：每項以第一個有值的賽季＝100',
            hasNull && '—＝該季無此項資料',
        ].filter(Boolean);
        const subject = viewMode === 'PLAYER' ? selectedPlayer : '灰狼全隊';
        const what = openMetrics.length === 1 && extras.length ? `・${mName(openMetrics[0])}` : '';
        return [
            `【${subject}｜跨季比較・${CATS[activeCat].label}${what}${isIndex ? '（指數化）' : ''}】`,
            `${sameType || '賽季'}｜${head.join('｜')}`,
            '',
            ...rows,
            '',
            ...(notes.length ? [notes.join('；')] : []),
            `資料：NBA.com Stats${activeCat === 'playtype' ? '／Synergy' : ''}，各季期末快照`,
            `${location.origin}${location.pathname}${location.hash}`,
        ].join('\n');
    };

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
            {window.SeasonPaceChart && <window.SeasonPaceChart viewMode={viewMode} playerId={playerId} playerName={selectedPlayer} />}

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
                sub={`${catSub} · 點指標列看逐季折線（可多選，同一指標可疊加其他球員）· 「—」表示該季無此類別資料`}
                right={<UI.Seg ariaLabel="比較類別" size="sm" value={activeCat} onChange={(c) => { setCat(c); setOpenKeys([]); }}
                    options={catKeys.map(c => ({ value: c, label: CATS[c].label }))} />}>
                {cols.length === 0 ? (
                    <UI.Note>請至少選一個賽季</UI.Note>
                ) : (
                    <div className="space-y-4">
                        {/* 逐季折線（點指標列展開；可多選、可疊加球員） */}
                        {openMetrics.length > 0 && LineOverlay && (
                            <div ref={chartRef} className="border border-white/10 p-4">
                                <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                                    <span className="text-[13px] font-medium text-slate-100">
                                        {openMetrics.length === 1 ? `${openMetrics[0].l} 逐季變化` : `${openMetrics.length} 項指標逐季變化`}
                                    </span>
                                    {openMetrics.length > 1 && (
                                        <UI.Seg ariaLabel="多指標呈現" size="sm" value={multiMode} onChange={setMultiMode}
                                            options={[{ value: 'small', label: '小圖並排' }, { value: 'index', label: '指數化疊圖（首季＝100）' }]} />
                                    )}
                                    <span className="ml-auto flex items-center gap-2">
                                        <button type="button" onClick={() => setOpenKeys([])} className="min-h-[24px] text-[12px] text-slate-400 hover:text-slate-100">✕ 收合</button>
                                        <UI.ExportMenu title={`跨季折線（${openMetrics.map(m => m.l).join('、')}）`} getNode={() => chartRef.current}
                                            csv={() => ({ header: ['指標', '對象', ...cols.map(c => c.label)],
                                                rows: openMetrics.flatMap(m => [null, ...extras].map(who => [m.l, nameOf(who), ...cols.map(c => { const v = getVal(c.key, m, who); return v == null ? '' : v; })])) })}
                                            text={chartText} />
                                    </span>
                                </div>
                                {/* 疊加球員（球員模式；多指標指數化時只畫主角） */}
                                {viewMode === 'PLAYER' && !(openMetrics.length > 1 && multiMode === 'index') && (
                                    <div className="mb-3 flex flex-wrap items-center gap-1.5">
                                        <span className="mr-1 text-[11px] text-slate-500">疊加比較</span>
                                        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#12A150] px-3 py-1 text-xs text-slate-100">
                                            <i className="inline-block h-[3px] w-3 bg-[#12A150]"></i>{selectedPlayer}
                                        </span>
                                        {extras.map((who, i) => (
                                            <button key={who} type="button" onClick={() => setExtras(x => x.filter(y => y !== who))} title="移除"
                                                className="inline-flex min-h-[24px] items-center gap-1.5 rounded-full border border-white/20 px-3 py-1 text-xs text-slate-200 hover:border-white/40">
                                                <i className="inline-block h-[3px] w-3" style={{ background: who === TEAM ? '#C4CED2' : SERIES_COLORS[(i + 1) % SERIES_COLORS.length] }}></i>
                                                {nameOf(who)} ✕
                                            </button>
                                        ))}
                                        {extras.length < MAX_EXTRAS && (<>
                                            <label className="sr-only" htmlFor="cmp-add">加入比較</label>
                                            <select id="cmp-add" value="" onChange={e => { const v = e.target.value; if (v) setExtras(x => x.includes(v) ? x : [...x, v]); }}
                                                className={UI.selectClass(false)}>
                                                <option value="">＋加入比較</option>
                                                {!extras.includes(TEAM) && <option value={TEAM}>全隊</option>}
                                                {playerPool.filter(n => !extras.includes(n)).map(n => <option key={n} value={n}>{n}</option>)}
                                            </select>
                                        </>)}
                                    </div>
                                )}
                                {openMetrics.length === 1 ? (
                                    <LineOverlay xs={xsOf()} series={seriesFor(openMetrics[0])} unit={openMetrics[0].pct ? '%' : ''} fmt={fmtOf(openMetrics[0])}
                                        height={260} ariaLabel={`${openMetrics[0].l} 逐季折線`} />
                                ) : multiMode === 'index' ? (
                                    <LineOverlay xs={xsOf()} series={indexSeries()} height={280} ariaLabel="指數化疊圖" />
                                ) : (
                                    <div className="grid grid-cols-1 border-l border-t border-white/[0.08] sm:grid-cols-2 lg:grid-cols-4">
                                        {openMetrics.map(m => (
                                            <div key={m.k} className="border-b border-r border-white/[0.08] px-3 pb-2 pt-2.5">
                                                <div className="mb-1 flex justify-between gap-2 text-[12px] text-slate-300"><span>{m.l}</span>{m.e && <span className="truncate font-mono text-[10px] text-slate-500">{m.e}</span>}</div>
                                                <LineOverlay mini xs={xsOf()} series={seriesFor(m)} unit={m.pct ? '%' : ''} fmt={fmtOf(m)} ariaLabel={`${m.l} 逐季小圖`} />
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <p className="mt-2 text-[11px] text-slate-500">
                                    {openMetrics.length > 1 && multiMode === 'index'
                                        ? '每項以第一個有值的賽季＝100：看各面向成長幅度，不比絕對高低'
                                        : openMetrics.length > 1 ? '各小圖 Y 軸獨立：看形狀，不比高度' : '空心點＋虛線＝該季效力他隊（@隊名）'}
                                    {extras.includes(TEAM) && ' · 銀色虛線＝全隊'}
                                </p>
                            </div>
                        )}
                        {/* 比較表：列＝指標、欄＝賽季（依時間排序） */}
                        <div className="flex justify-end">
                            <UI.ExportMenu title={`跨季比較（${CATS[activeCat].label}）`} getNode={() => tableRef.current}
                                csv={() => ({ header: ['指標', '原文', ...cols.map(c => c.label)], rows: metrics.map(m => [m.l, m.e || '', ...cols.map(c => { const v = getVal(c.key, m); return v == null ? '' : v; })]) })}
                                text={fbText} />
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
                                                    {/* 兩行：上年份、下賽別（不用「例／季」縮寫，避免把「季」讀成賽季） */}
                                                    {c.season ? (<>
                                                        <span className="block">{c.season.slice(2)}{tag && <span className="ml-1 font-mono text-[10px] text-amber-400/80">{tag}</span>}</span>
                                                        <span className="block text-[10px] text-slate-500">{c.type === 'playoffs' ? '季後賽' : '例行賽'}</span>
                                                    </>) : (<>
                                                        {c.short || c.label}
                                                        {tag && <span className="ml-1 font-mono text-[10px] text-amber-400/80">{tag}</span>}
                                                    </>)}
                                                </th>
                                            );
                                        })}
                                    </tr>
                                </thead>
                                <tbody>
                                    {metrics.map(m => {
                                        const open = openKeys.includes(m.k);
                                        return (
                                            <tr key={m.k} onClick={() => toggleMetric(m)} aria-selected={open}
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
