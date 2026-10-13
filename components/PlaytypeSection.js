// Playtype 章節（Synergy 式）：預設可排序表格，可切回卡片牆；選擇記在 localStorage
// 表格欄：類型｜使用率 Freq｜每場球權 Poss/G｜PPP（含 vs 前一份快照）｜聯盟百分位｜FG%
// 點類型名稱開走勢 Modal（與卡片點擊相同：onOpen({ type:'playtype', id })）
// 防守面：PPP、FG% 越低越好；百分位攻守皆越高越好（已以資料驗證）
const PlaytypeSection = ({ title, stats, prevStats, side, onOpen }) => {
    const { useState } = React;
    const UI = window.UI;
    const PlayTypeCard = window.PlayTypeCard;
    const isDef = side === 'defensive';
    const [view, setView] = useState(() => { try { return localStorage.getItem('wt_pref_playtypeView') || 'table'; } catch (e) { return 'table'; } });
    const changeView = (v) => { setView(v); try { localStorage.setItem('wt_pref_playtypeView', v); } catch (e) { /* ignore */ } };

    const ofSide = (arr) => (arr || []).filter(s => (s.side || 'offensive') === side);
    const prevOf = (type) => ofSide(prevStats).find(s => s.playType === type);
    // NBA 部分快照的 POSS_PCT 全回 0（有球權卻 0% 不可能）→ 視為未提供（同 PlayTypeCard）
    const freqOf = (r) => (r.freq === 0 && (r.possTotal > 0 || r.poss > 0)) ? null : (typeof r.freq === 'number' ? r.freq : null);
    const rows = ofSide(stats).map(r => ({ ...r, _freq: freqOf(r), _prev: prevOf(r.playType) }));
    const freqMissing = rows.some(r => r._freq == null && (r.possTotal > 0 || r.poss > 0));

    const columns = [
        { key: 'playType', label: '類型', en: 'Play Type', align: 'left',
            render: (r) => (
                <button type="button" onClick={() => onOpen({ type: 'playtype', id: r.playType })}
                    className="group inline-flex items-baseline gap-1.5 text-left" title="看當季走勢">
                    <span className="font-display text-[15px] font-semibold uppercase tracking-wide text-slate-100 group-hover:text-[#12A150]">{r.playType}</span>
                    <span className="font-mono text-[10px] text-slate-600 group-hover:text-[#12A150]">↗</span>
                </button>) },
        { key: '_freq', label: '使用率', en: 'Freq%', render: (r) => r._freq == null ? <span className="text-slate-600" title={freqMissing ? 'NBA 未提供此快照的使用率' : undefined}>—</span> : r._freq.toFixed(1) + '%' },
        { key: 'poss', label: '每場球權', en: 'Poss/G', render: (r) => typeof r.poss === 'number' ? r.poss.toFixed(1) : '—' },
        { key: 'ppp', label: 'PPP', en: isDef ? '被得分效率' : '每球權得分',
            render: (r) => (
                <span className="inline-flex items-baseline gap-2">
                    <UI.Delta value={r.ppp} prevValue={r._prev?.ppp} betterIsLarger={!isDef} digits={2} />
                    <span className="text-slate-50">{typeof r.ppp === 'number' ? r.ppp.toFixed(2) : '—'}</span>
                </span>) },
        { key: 'percentile', label: '聯盟百分位', en: 'Percentile', sortValue: (r) => r.percentile,
            render: (r) => typeof r.percentile !== 'number' ? '—' : (
                <span className="inline-flex items-center gap-2">
                    <span className="relative inline-block h-[3px] w-16 bg-white/[0.08]" aria-hidden="true">
                        <span className="absolute inset-y-0 left-0" style={{ width: Math.max(0, Math.min(100, r.percentile)) + '%', background: UI.pctColor(r.percentile) }}></span>
                    </span>
                    <span className="w-9 text-right" style={{ color: UI.pctColor(r.percentile) }}>{r.percentile.toFixed(1)}</span>
                </span>) },
        { key: 'fgPct', label: '命中率', en: 'FG%', render: (r) => typeof r.fgPct === 'number' ? r.fgPct.toFixed(1) + '%' : '—' },
    ];

    return (
        <UI.Section title={title} en="Synergy Playtype" accent={isDef ? 'red' : 'green'}
            sub={`${isDef ? '防守面：PPP 為對手每球權得分，越低越好' : '進攻面：PPP 為每球權得分'} · 聯盟百分位越高越好 · 變化箭頭為 vs 前一份快照`}
            right={<UI.Seg ariaLabel="檢視方式" size="sm" value={view} onChange={changeView}
                options={[{ value: 'table', label: '表格' }, { value: 'cards', label: '卡片' }]} />}>
            {rows.length === 0 ? (
                <UI.Note>此對象沒有{isDef ? '防守' : '進攻'}面的 Playtype 資料</UI.Note>
            ) : view === 'table' ? (
                <UI.DataTable caption={`${title} Synergy Playtype`} rows={rows} rowKey={(r) => r.playType}
                    initialSort={{ key: 'poss', dir: 'desc' }} columns={columns} />
            ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {(window.PlayTypesList || []).map(type => {
                        const stat = rows.find(r => r.playType === type);
                        return <PlayTypeCard key={type} type={type} current={stat} prev={stat?._prev} onClick={onOpen} side={side} />;
                    })}
                </div>
            )}
        </UI.Section>
    );
};

window.PlaytypeSection = PlaytypeSection;
