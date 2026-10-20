// 精簡身分列：頭像（球隊為 Logo）＋ 名稱 ＋ 出賽/戰績 ＋ 4 個主數字，單行高度，第一屏就是數據
// 數字與總覽「季平均」同源：逐場 bundle 以 GameAgg 算截至 untilDate；bundle 缺時退回快照 base
// 要換顯示的指標 → 改下方 FIELDS（格式同 OverviewTab 的 SUMMARY）
// salary：球員檢視時的薪資膠囊 { season, text, title, badge }（App 依 playerId 對薪資資料組好），onSalary 點擊開薪資頁
const IdentityBar = ({ viewMode, playerName, playerId, tag, games, untilDate, base, seasonLabel, salary, onSalary }) => {
    const GA = window.GameAgg;
    const FIELDS = viewMode === 'TEAM'
        ? [{ key: 'PTS', en: 'PTS', label: '得分' }, { key: 'REB', en: 'REB', label: '籃板' },
           { key: 'AST', en: 'AST', label: '助攻' }, { key: 'PLUS_MINUS', en: '+/-', label: '正負值', plus: true }]
        : [{ key: 'PTS', en: 'PTS', label: '得分' }, { key: 'REB', en: 'REB', label: '籃板' },
           { key: 'AST', en: 'AST', label: '助攻' }, { key: 'FG_PCT', en: 'FG%', label: '命中率', pct: true }];

    const bundleAgg = (games && games.length) ? GA.seasonToDate(games, untilDate, null, 'TEAM') : null;
    const baseAgg = (base && typeof base.GP === 'number' && base.GP > 0) ? base : null;
    const agg = (bundleAgg && bundleAgg.GP > 0) ? bundleAgg : baseAgg;

    const fmt = (v, f) => {
        if (typeof v !== 'number') return '—';
        if (f.plus) return (v > 0 ? '+' : '') + v.toFixed(1);
        return v.toFixed(1);
    };
    const record = agg ? [`${agg.GP} 場`, (agg.W || agg.L) ? `${agg.W} 勝 ${agg.L} 敗` : null].filter(Boolean).join(' · ') : null;
    const name = viewMode === 'TEAM' ? 'Minnesota Timberwolves' : (playerName || '—');

    return (
        <section aria-label="目前檢視對象" className="border-b border-white/10">
            <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
                <div className="flex items-center gap-3 min-w-0">
                    {viewMode === 'TEAM' ? (
                        <img src="https://cdn.nba.com/logos/nba/1610612750/primary/L/logo.svg" alt="" className="h-12 w-12 shrink-0" />
                    ) : (
                        <img src={`https://cdn.nba.com/headshots/nba/latest/260x190/${playerId || 0}.png`} alt=""
                            onError={(e) => { e.target.style.visibility = 'hidden'; }}
                            className="h-12 w-12 shrink-0 rounded-full bg-white/[0.06] object-cover object-top" />
                    )}
                    <div className="min-w-0">
                        <h1 className="font-display text-[28px] font-bold uppercase leading-none tracking-wide text-slate-50 truncate">
                            {name}{tag && <span className="ml-2 align-middle font-mono text-[12px] font-normal normal-case text-amber-400/80">{tag}</span>}
                        </h1>
                        <p className="mt-1 text-[12px] text-slate-400 truncate">
                            {[seasonLabel, record].filter(Boolean).join(' · ')}
                        </p>
                        {viewMode === 'PLAYER' && salary && (
                            <button type="button" onClick={onSalary} title={salary.title}
                                className="mt-1 inline-flex min-h-[24px] max-w-full items-center gap-1.5 whitespace-nowrap rounded-full border border-white/15 px-2.5 text-[12px] text-slate-300 hover:border-white/30 hover:text-slate-100">
                                <span className="font-mono text-[10px] text-slate-500">{salary.season} 薪資</span>
                                <span className="font-mono tabular-nums text-slate-100">{salary.text}</span>
                                {salary.badge && <span className="text-[11px] text-amber-300">{salary.badge}</span>}
                                <span aria-hidden="true" className="text-slate-500">↗</span>
                            </button>
                        )}
                    </div>
                </div>
                <dl className="grid grid-cols-4 sm:ml-auto sm:flex sm:items-end gap-x-6 gap-y-1">
                    {FIELDS.map(f => {
                        const v = agg ? agg[f.key] : null;
                        const color = f.plus && typeof v === 'number' ? (v > 0 ? 'text-[#12A150]' : v < 0 ? 'text-[#EF4444]' : 'text-slate-50') : 'text-slate-50';
                        return (
                            <div key={f.key} className="group/cell relative min-w-0">
                                <dt className="flex items-center font-mono text-[10px] text-slate-500" title={f.label}>
                                    {f.en}<window.UI.Info k={f.key} align="right" />
                                    {typeof v === 'number' && <window.UI.CopyBtn className="-my-1 ml-0.5"
                                        text={() => window.UI.citeLine({ label: f.label, en: f.en, value: fmt(v, f), unit: f.pct ? '%' : '', gkey: f.key, asOf: 'agg', note: '季平均' })} />}
                                </dt>
                                <dd className={`font-display text-[28px] font-semibold leading-none tabular-nums ${color}`}>
                                    {fmt(v, f)}{f.pct && typeof v === 'number' && <span className="ml-0.5 text-[14px] text-slate-400">%</span>}
                                </dd>
                            </div>
                        );
                    })}
                </dl>
            </div>
        </section>
    );
};

window.IdentityBar = IdentityBar;
