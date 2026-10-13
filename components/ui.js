// 共用介面元件（設計系統）：window.UI
// 風格：細線分隔的數據表（ledger）取代盒狀卡片；大數字用 font-display（Barlow Condensed），
// 標籤一律「中文 + 小字 NBA 原文」。Tailwind class 必須完整寫在這裡（CLI 掃不到字串拼接）。
//   StatCell  單一指標格（數值三態：真的 0 照常顯示／無資料「—」／不適用「—」+ tooltip）
//   Ledger    StatCell 的容器（外框上/左線 + 每格右/下線，空位不畫線）
//   PctBar    百分位色階條（紅 → 月光銀 → 綠，中線 = 聯盟中位）；只給「真的有 percentile」的資料用
//   Seg       膠囊分段切換（aria-pressed）
//   Section   區塊（標題＋小字原文＋說明＋右側操作），Note 空狀態／提示，Chip/selectClass 篩選膠囊
//   DataTable 可排序表格（Synergy 式：數字右對齊等寬、首欄在手機橫捲時固定且限寬換行，避免長名稱蓋住數字）
window.UI = (function () {
    // 「切入次數 (Drives)」→ ['切入次數', 'Drives']；沒有括號就整串當中文
    const splitTitle = (title) => {
        const m = String(title || '').match(/^(.*?)\s*\(([^()]*)\)\s*$/);
        return m ? [m[1], m[2]] : [String(title || ''), null];
    };

    // 0–100 → 紅(#EF4444) / 月光銀(#C4CED2) / 綠(#12A150) 線性內插
    const RED = [239, 68, 68], SILVER = [196, 206, 210], GREEN = [18, 161, 80];
    const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
    const pctColor = (p) => {
        const v = Math.max(0, Math.min(100, p)) / 100;
        const c = v < 0.5 ? mix(RED, SILVER, v / 0.5) : mix(SILVER, GREEN, (v - 0.5) / 0.5);
        return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
    };

    const isBlank = (v) => v == null || v === '';

    // 漲跌：betterIsLarger=false 時（失誤、對手命中率…）下降才是好
    const Delta = ({ value, prevValue, unit = '', betterIsLarger = true, digits = 1 }) => {
        if (isBlank(value) || isBlank(prevValue)) return null;
        const d = +(Number(value) - Number(prevValue)).toFixed(digits);
        if (!d) return null;
        const good = (d > 0) === betterIsLarger;
        return (
            <span className={`font-mono text-[10px] tabular-nums whitespace-nowrap ${good ? 'text-[#12A150]' : 'text-[#EF4444]'}`}>
                {d > 0 ? '▲' : '▼'} {Math.abs(d)}{unit}
            </span>
        );
    };

    const PctBar = ({ value, label = 'PR' }) => {
        if (typeof value !== 'number') return null;
        const v = Math.max(0, Math.min(100, value));
        const color = pctColor(v);
        return (
            <div className="mt-2.5">
                <div className="flex justify-between font-mono text-[10px] text-slate-500" title="聯盟百分位（Percentile，0–100，越高越好；中線為聯盟中位數）">
                    <span>{label}</span>
                    <span className="tabular-nums" style={{ color }}>{v.toFixed(1)}</span>
                </div>
                <div className="relative h-[3px] mt-1 bg-white/[0.08]">
                    <div className="absolute inset-y-0 left-0" style={{ width: v + '%', background: color }}></div>
                    <div className="absolute -top-[2px] left-1/2 h-[7px] w-px bg-slate-400/50" title="聯盟中位數"></div>
                </div>
            </div>
        );
    };

    const StatCell = ({ label, en, value, unit = '', prevValue, betterIsLarger = true, naReason = null, pct = null, pctLabel }) => {
        const isNA = naReason && isBlank(value);
        const missing = isBlank(value);
        return (
            <div className="border-r border-b border-white/[0.08] px-3 pt-2.5 pb-3 min-w-0">
                <div className="text-[11px] leading-tight text-slate-300 truncate" title={label}>{label}</div>
                {en && <div className="font-mono text-[10px] leading-tight text-slate-500 truncate" title={en}>{en}</div>}
                <div className="mt-2 flex items-baseline gap-1.5 min-w-0">
                    {isNA ? (
                        <span className="font-display text-[26px] font-semibold leading-none text-slate-600 cursor-help" title={naReason}>—</span>
                    ) : missing ? (
                        <span className="font-display text-[26px] font-semibold leading-none text-slate-600" title="此項無資料">—</span>
                    ) : (
                        <span className="font-display text-[26px] font-semibold leading-none tabular-nums text-slate-50">
                            {value}{unit && <span className="ml-0.5 text-[15px] font-medium text-slate-400">{unit}</span>}
                        </span>
                    )}
                    {!isNA && !missing && <span className="ml-auto"><Delta value={value} prevValue={prevValue} unit={unit} betterIsLarger={betterIsLarger} /></span>}
                </div>
                {pct != null && <PctBar value={pct} label={pctLabel} />}
            </div>
        );
    };

    // cols：完整的 grid-cols class（例 'grid-cols-2 sm:grid-cols-4'），由呼叫端依指標數決定
    const Ledger = ({ cols = 'grid-cols-2 sm:grid-cols-4', children }) => (
        <div className={`grid ${cols} border-t border-l border-white/[0.08]`}>{children}</div>
    );
    // 依指標數挑欄數：桌面選能整除的欄數（每列排滿、不留空格），手機一律 2 欄（3 個時 3 欄）
    const ledgerCols = (n) => n <= 2 ? 'grid-cols-2'
        : n === 3 ? 'grid-cols-3'
        : n % 5 === 0 ? 'grid-cols-2 sm:grid-cols-5'          // 5、10
        : n % 4 === 0 ? 'grid-cols-2 sm:grid-cols-4'          // 4、8、12
        : n % 6 === 0 ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'
        : n % 3 === 0 ? 'grid-cols-2 sm:grid-cols-3'          // 9
        : 'grid-cols-2 sm:grid-cols-4';

    // columns: [{ key, label, en, align:'left'|'right', render(row), sortValue(row), cellClass(row) }]
    const DataTable = ({ columns, rows, initialSort = null, rowKey = (r, i) => i, caption }) => {
        const [sort, setSort] = React.useState(initialSort);   // { key, dir: 'asc'|'desc' }
        const colOf = (k) => columns.find(c => c.key === k);
        const sorted = React.useMemo(() => {
            if (!sort) return rows;
            const c = colOf(sort.key); if (!c) return rows;
            const get = c.sortValue || (r => r[c.key]);
            const sign = sort.dir === 'asc' ? 1 : -1;
            return rows.slice().sort((a, b) => {
                const x = get(a), y = get(b);
                if (isBlank(x) && isBlank(y)) return 0;
                if (isBlank(x)) return 1;            // 無資料一律排最後
                if (isBlank(y)) return -1;
                return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * sign;
            });
        }, [rows, sort]);
        const toggle = (k) => setSort(s => (s && s.key === k)
            ? { key: k, dir: s.dir === 'desc' ? 'asc' : 'desc' }
            : { key: k, dir: colOf(k).align === 'left' ? 'asc' : 'desc' });
        return (
            <div className="overflow-x-auto border-t border-white/[0.08]">
                <table className="w-full text-sm border-collapse">
                    {caption && <caption className="sr-only">{caption}</caption>}
                    <thead>
                        <tr className="border-b border-white/15">
                            {columns.map((c, ci) => {
                                const active = sort && sort.key === c.key;
                                return (
                                    <th key={c.key} scope="col"
                                        aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                                        className={`px-3 py-2 font-normal whitespace-nowrap align-bottom ${c.align === 'left' ? 'text-left' : 'text-right'} ${ci === 0 ? 'max-sm:sticky max-sm:left-0 max-sm:z-[1] max-sm:bg-[#0A1626]' : ''}`}>
                                        <button onClick={() => toggle(c.key)}
                                            className={`inline-flex flex-col ${c.align === 'left' ? 'items-start' : 'items-end'} gap-0.5 hover:text-slate-100 ${active ? 'text-slate-100' : 'text-slate-400'}`}>
                                            <span className="text-[11px]">{c.label}{active && <span className="ml-1 text-[#12A150]">{sort.dir === 'asc' ? '↑' : '↓'}</span>}</span>
                                            {c.en && <span className="font-mono text-[10px] text-slate-500">{c.en}</span>}
                                        </button>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.map((r, i) => (
                            <tr key={rowKey(r, i)} className="border-b border-white/[0.06] odd:bg-white/[0.015] hover:bg-white/[0.04]">
                                {columns.map((c, ci) => (
                                    <td key={c.key}
                                        className={`px-3 py-2 whitespace-nowrap ${c.align === 'left' ? 'text-left text-slate-200' : 'text-right font-mono tabular-nums text-slate-200'} ${ci === 0 ? 'max-sm:sticky max-sm:left-0 max-sm:bg-[#0A1626] max-sm:whitespace-normal max-sm:min-w-[7.5rem] max-sm:max-w-[9.5rem] max-sm:text-[13px] max-sm:leading-snug' : ''} ${c.cellClass ? c.cellClass(r) : ''}`}>
                                        {c.render ? c.render(r) : (isBlank(r[c.key]) ? '—' : r[c.key])}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    // 膠囊分段切換。options: [{ value, label, icon?, activeClass? }]；activeClass 讓攻（綠）/守（紅）各自上色
    const Seg = ({ options, value, onChange, ariaLabel, size = 'md' }) => (
        <div role="group" aria-label={ariaLabel} className="inline-flex shrink-0 rounded-full border border-white/15 p-[3px]">
            {options.map(o => {
                const on = o.value === value;
                return (
                    <button key={o.value} type="button" aria-pressed={on} onClick={() => onChange(o.value)}
                        className={`inline-flex items-center gap-1.5 rounded-full whitespace-nowrap transition-colors ${size === 'sm' ? 'px-3 py-1 text-xs' : 'px-3.5 py-1.5 text-[13px]'} ${on ? (o.activeClass || 'bg-[#C4CED2] text-[#0A1626] font-medium') : 'text-slate-400 hover:text-slate-100'}`}>
                        {o.icon}{o.label}
                    </button>
                );
            })}
        </div>
    );

    // 區塊：取代舊的「左色條大框」。accent 保留原本色條語意（攻綠/守紅/Clutch 琥珀/結構藍），縮成標題前的小色標
    const ACCENT = { green: 'bg-[#12A150]', red: 'bg-[#EF4444]', blue: 'bg-[#236192]', amber: 'bg-amber-400', silver: 'bg-[#C4CED2]' };
    const Section = ({ title, en, sub, right, accent, children, className = '' }) => (
        <section className={className}>
            <header className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-white/15 pb-2.5">
                <div className="min-w-0">
                    <h2 className="flex items-baseline gap-2 text-[20px] font-bold leading-tight text-slate-50">
                        {accent && <span className={`inline-block h-3.5 w-1 shrink-0 ${ACCENT[accent] || ACCENT.silver}`} aria-hidden="true"></span>}
                        <span>{title}</span>
                        {en && <span className="font-mono text-[11px] font-normal text-slate-500">{en}</span>}
                    </h2>
                    {sub && <p className="mt-1 text-[12px] leading-relaxed text-slate-400">{sub}</p>}
                </div>
                {right && <div className="flex shrink-0 flex-wrap items-center gap-2">{right}</div>}
            </header>
            {children}
        </section>
    );
    // 空狀態／提示（取代各處 bg-slate-800/50 圓角提示框）
    const Note = ({ children, tone = 'muted' }) => (
        <div className={`border px-4 py-3 text-sm ${tone === 'warn' ? 'border-amber-500/30 bg-amber-500/[0.06] text-amber-200' : 'border-white/10 bg-white/[0.02] text-slate-400'}`}>{children}</div>
    );

    // 篩選膠囊（期間篩選列等）與同風格下拉
    const Chip = ({ active, onClick, children, title }) => (
        <button type="button" aria-pressed={!!active} onClick={onClick} title={title}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs whitespace-nowrap transition-colors ${active ? 'border-[#12A150] bg-[#12A150]/10 text-slate-50' : 'border-white/15 text-slate-400 hover:border-white/30 hover:text-slate-100'}`}>
            {children}
        </button>
    );
    const selectClass = (active) => `shrink-0 rounded-full border bg-[#0A1626] px-3 py-1 text-xs focus:outline-none focus:border-[#12A150] ${active ? 'border-[#12A150] text-slate-50' : 'border-white/15 text-slate-400'}`;

    return { splitTitle, pctColor, Delta, PctBar, StatCell, Ledger, ledgerCols, DataTable, Seg, Section, Note, Chip, selectClass };
})();
