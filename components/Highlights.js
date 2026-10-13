// 近期異動（找題材用）：近 N 場 vs 全季（皆截至 untilDate），列出變化最明顯的指標
// 排序依據 = |近 N 場平均 − 全季平均| ÷ (逐場標準差 ÷ √N)
//   用意：平常就波動很大的指標（如正負值）要變很多才算明顯；這是「描述性」的尺度，不是統計檢定
// 命中率類以 Σ命中 ÷ Σ出手 計算，且近 N 場出手數需達門檻（MIN_ATT），否則不列入
// 要調整指標或門檻 → 改下方 METRICS
const Highlights = ({ games, untilDate }) => {
    const { useState } = React;
    const UI = window.UI;
    const GA = window.GameAgg;
    const [n, setN] = useState(5);

    const METRICS = [
        { key: 'PTS', label: '得分', en: 'PTS' },
        { key: 'REB', label: '籃板', en: 'REB' },
        { key: 'AST', label: '助攻', en: 'AST' },
        { key: 'STL', label: '抄截', en: 'STL' },
        { key: 'BLK', label: '阻攻', en: 'BLK' },
        { key: 'TOV', label: '失誤', en: 'TOV', lowerIsBetter: true },
        { key: 'PLUS_MINUS', label: '正負值', en: '+/-' },
        { key: 'FG_PCT', label: '命中率', en: 'FG%', pct: ['FGM', 'FGA'], MIN_ATT: 25 },
        { key: 'FG3_PCT', label: '三分命中率', en: '3P%', pct: ['FG3M', 'FG3A'], MIN_ATT: 10 },
        { key: 'FT_PCT', label: '罰球命中率', en: 'FT%', pct: ['FTM', 'FTA'], MIN_ATT: 8 },
    ];

    if (!games || !games.length) return null;
    const pool = untilDate ? games.filter(g => !g.date || g.date <= untilDate) : games;
    const sorted = pool.slice().sort((a, b) => (a.date < b.date ? -1 : 1));
    if (sorted.length < n + 5) return null;   // 全季場數太少，比較沒有意義
    const recent = sorted.slice(-n);

    const num = (v) => (typeof v === 'number' ? v : null);
    const sum = (arr, k) => arr.reduce((a, g) => a + (num(g.stats?.[k]) || 0), 0);
    const rows = [];
    const skipped = [];
    for (const m of METRICS) {
        let season, rec, perGame, recAtt = null;
        if (m.pct) {
            const [mk, ak] = m.pct;
            const sA = sum(sorted, ak), rA = sum(recent, ak);
            if (!sA) continue;
            season = 100 * sum(sorted, mk) / sA;
            recAtt = rA;
            if (rA < m.MIN_ATT) { skipped.push(`${m.label}（近 ${n} 場僅 ${rA} 次出手，門檻 ${m.MIN_ATT}）`); continue; }
            rec = 100 * sum(recent, mk) / rA;
            perGame = sorted.filter(g => num(g.stats?.[ak])).map(g => 100 * (num(g.stats[mk]) || 0) / g.stats[ak]);
        } else {
            perGame = sorted.map(g => num(g.stats?.[m.key])).filter(v => v != null);
            if (perGame.length < n + 5) continue;
            season = perGame.reduce((a, b) => a + b, 0) / perGame.length;
            const r = recent.map(g => num(g.stats?.[m.key])).filter(v => v != null);
            if (!r.length) continue;
            rec = r.reduce((a, b) => a + b, 0) / r.length;
        }
        const mean = perGame.reduce((a, b) => a + b, 0) / perGame.length;
        const sd = Math.sqrt(perGame.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, perGame.length - 1));
        const diff = rec - season;
        const score = sd > 0 ? Math.abs(diff) / (sd / Math.sqrt(n)) : 0;
        rows.push({ ...m, season, rec, diff, score, recAtt });
    }
    const top = rows.sort((a, b) => b.score - a.score).slice(0, 4).filter(r => r.score >= 1);

    const fmt = (v, m) => (m.pct ? v.toFixed(1) + '%' : (m.key === 'PLUS_MINUS' && v > 0 ? '+' : '') + v.toFixed(1));
    const good = (r) => (r.diff > 0) !== !!r.lowerIsBetter;

    return (
        <UI.Section title="近期異動" en="Recent Trends" accent="silver"
            sub={`近 ${n} 場 vs 全季${untilDate ? `（皆截至 ${untilDate}）` : ''} · 依「變化量相對於逐場波動」排序，描述性比較、非統計檢定 · 命中率需達最低出手數`}
            right={<UI.Seg ariaLabel="近幾場" size="sm" value={n} onChange={setN}
                options={[{ value: 5, label: '近 5 場' }, { value: 10, label: '近 10 場' }]} />}>
            {top.length === 0 ? (
                <UI.Note>近 {n} 場沒有明顯偏離全季水準的指標</UI.Note>
            ) : (
                <ul className="grid gap-x-10 md:grid-cols-2">
                    {top.map(r => {
                        const text = UI.citeLine({ label: r.label, en: r.en, value: fmt(r.rec, r), gkey: r.key, asOf: 'agg',
                            note: `近 ${n} 場（全季 ${fmt(r.season, r)}，差 ${r.diff > 0 ? '+' : ''}${r.diff.toFixed(1)}${r.pct ? ' 個百分點' : ''}）` });
                        return (
                            <li key={r.key} className="group/cell grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 border-b border-white/[0.08] py-2.5">
                                <div className="min-w-0">
                                    <div className="flex items-center text-[13px] text-slate-100">
                                        {r.label}<span className="ml-1.5 font-mono text-[10px] text-slate-500">{r.en}</span>
                                        <UI.Info k={r.key} />
                                    </div>
                                    <div className="mt-0.5 font-mono text-[11px] tabular-nums text-slate-400">
                                        全季 {fmt(r.season, r)} → 近 {n} 場 <span className="text-slate-100">{fmt(r.rec, r)}</span>
                                        {r.recAtt != null && <span className="text-slate-500"> · 出手 {r.recAtt}</span>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className={`font-display text-[22px] font-semibold tabular-nums ${good(r) ? 'text-[#12A150]' : 'text-[#EF4444]'}`}>
                                        <span className="mr-1 align-[3px] text-[11px]">{r.diff > 0 ? '▲' : '▼'}</span>{Math.abs(r.diff).toFixed(1)}
                                    </span>
                                    <UI.CopyBtn text={text} />
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
            {skipped.length > 0 && <p className="mt-2 text-[11px] text-slate-500">未列入：{skipped.join('、')}</p>}
        </UI.Section>
    );
};

window.Highlights = Highlights;
