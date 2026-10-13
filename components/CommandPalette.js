// 搜尋面板（快捷鍵 /）：球員、章節、賽季、攻守、賽別。↑↓ 選、Enter 確定、Esc 關閉
// items: [{ id, group, label, hint, run() }]；比對用 nameKey（去句點/重音），所以打 "jr" 找得到 "Jr."
const CommandPalette = ({ open, onClose, items }) => {
    const { useState, useEffect, useRef } = React;
    const [q, setQ] = useState('');
    const [idx, setIdx] = useState(0);
    const inputRef = useRef(null);
    const listRef = useRef(null);

    useEffect(() => { if (open) { setQ(''); setIdx(0); setTimeout(() => inputRef.current && inputRef.current.focus(), 0); } }, [open]);
    // 選中項目捲進可視範圍。hook 必須在下面的提早 return 之前（hook 數量每次 render 都要相同）
    useEffect(() => {
        const el = listRef.current && listRef.current.querySelector('[data-active="true"]');
        if (el) el.scrollIntoView({ block: 'nearest' });
    });
    if (!open) return null;

    const key = window.nameKey;
    const kq = key(q);
    const matched = kq ? items.filter(it => key(it.label).includes(kq) || key(it.group).includes(kq) || (it.hint && key(it.hint).includes(kq))) : items;
    const sel = Math.min(idx, Math.max(0, matched.length - 1));
    const run = (it) => { if (!it) return; onClose(); it.run(); };

    const onKey = (e) => {
        if (e.key === 'Escape') { e.preventDefault(); onClose(); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(Math.min(sel + 1, matched.length - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(Math.max(sel - 1, 0)); }
        else if (e.key === 'Enter') { e.preventDefault(); run(matched[sel]); }
    };
    let lastGroup = null;
    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-[12vh]" onMouseDown={onClose}>
            <div role="dialog" aria-modal="true" aria-label="搜尋"
                className="w-full max-w-lg border border-white/15 bg-[#0C1A2E] shadow-2xl" onMouseDown={e => e.stopPropagation()}>
                <input ref={inputRef} value={q} onChange={e => { setQ(e.target.value); setIdx(0); }} onKeyDown={onKey}
                    placeholder="搜尋球員、章節、賽季…" aria-label="搜尋關鍵字"
                    className="w-full border-b border-white/10 bg-transparent px-4 py-3.5 text-[15px] text-slate-100 placeholder:text-slate-500 focus:outline-none" />
                <ul ref={listRef} role="listbox" className="max-h-[50vh] overflow-y-auto py-1">
                    {matched.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-500">找不到「{q}」</li>}
                    {matched.map((it, i) => {
                        const head = it.group !== lastGroup ? it.group : null; lastGroup = it.group;
                        return (
                            <React.Fragment key={it.id}>
                                {head && <li className="px-4 pt-2.5 pb-1 font-mono text-[10px] uppercase tracking-wider text-slate-500">{head}</li>}
                                <li role="option" aria-selected={i === sel} data-active={i === sel}
                                    onMouseEnter={() => setIdx(i)} onClick={() => run(it)}
                                    className={`mx-1 flex cursor-pointer items-center justify-between px-3 py-2 text-[14px] ${i === sel ? 'bg-white/[0.07] text-slate-50' : 'text-slate-300'}`}>
                                    <span className="truncate">{it.label}</span>
                                    {it.hint && <span className="ml-3 shrink-0 font-mono text-[10px] text-slate-500">{it.hint}</span>}
                                </li>
                            </React.Fragment>
                        );
                    })}
                </ul>
                <div className="hidden sm:flex gap-4 border-t border-white/10 px-4 py-2 font-mono text-[10px] text-slate-500">
                    <span>↑↓ 選擇</span><span>Enter 確定</span><span>Esc 關閉</span><span className="ml-auto">1–6 切章節</span>
                </div>
            </div>
        </div>
    );
};

window.CommandPalette = CommandPalette;
