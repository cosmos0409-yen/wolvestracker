// 引用籃：右下角浮動鈕（籃子有東西才出現）＋ 抽屜（桌面右側、手機全螢幕）
// 資料與排版在 quoteFormat.js（window.Quote）；各頁從「?」小卡「加入引用籃」放進來
const QuoteBasket = () => {
    const { useState, useEffect, useRef } = React;
    const Q = window.Quote;
    const UI = window.UI;
    const [items, setItems] = useState(() => Q.items());
    const [opts, setOptsState] = useState(() => Q.opts());
    const [open, setOpen] = useState(false);
    const [confirmClear, setConfirmClear] = useState(false);
    // 項目／格式兩個摺疊區預設收起（預覽最大），只記在這次開啟的頁面狀態；copied＝剛複製的段落序號（按鈕短暫顯示「已複製」）
    const [showItems, setShowItems] = useState(false);
    const [showOpts, setShowOpts] = useState(false);
    const [copied, setCopied] = useState(null);
    const panelRef = useRef(null);
    const fabRef = useRef(null);

    useEffect(() => Q.subscribe(() => { setItems(Q.items()); setOptsState(Q.opts()); }), []);
    // 開啟時焦點移進抽屜、Esc 關閉（capture：不讓頁面其他 Esc 處理先吃掉），關閉後焦點回到浮動鈕
    useEffect(() => {
        if (!open) return;
        if (panelRef.current) panelRef.current.focus();
        const esc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
        document.addEventListener('keydown', esc, true);
        return () => { document.removeEventListener('keydown', esc, true); setTimeout(() => fabRef.current && fabRef.current.focus(), 0); };
    }, [open]);
    useEffect(() => { if (!items.length) setOpen(false); }, [items.length]);
    // 清空要按兩次：第一次變成「確定清空？」，4 秒內沒按就恢復
    useEffect(() => {
        if (copied == null) return;
        const t = setTimeout(() => setCopied(null), 1500);
        return () => clearTimeout(t);
    }, [copied]);
    useEffect(() => {
        if (!confirmClear) return;
        const t = setTimeout(() => setConfirmClear(false), 4000);
        return () => clearTimeout(t);
    }, [confirmClear]);

    if (!items.length) return null;

    const blocks = Q.renderBlocks(items, opts);
    const text = Q.render(items, opts);
    const copy = async () => {
        const ok = await UI.copyText(text);
        UI.toast(ok ? `已複製引用籃文字（${items.length} 項，可直接貼到臉書）` : '複製失敗，請手動選取上方文字');
    };
    // 單段複製：文章的數據段散在各小節底下，一段一段貼
    const copyBlock = async (i) => {
        const ok = await UI.copyText(blocks[i].text);
        if (ok) setCopied(i); else UI.toast('複製失敗，請手動選取這一段文字');
    };
    // 清單上的一行摘要：指標：數值（比較項目列出各對象）
    const summary = (it) => {
        const ps = it.parts || [it];
        const v = (x) => x ? `${x.value}${x.unit || ''}` : '—';
        const vals = it.kind === 'compare'
            ? ps[0].values.map((x, i) => `${x.tag} ${ps.map(p => v(p.values[i])).join('／')}`).join(it.sep === 'vs.' ? ' vs. ' : ' → ')
            : ps.map(p => v(p.values[0])).join('／');
        return `${ps.map(p => p.label).join('／')}：${vals}`;
    };
    const noteOf = (it) => (it.parts || [it]).map(p => p.note).filter(Boolean).join('；');
    const hasGame = items.some(it => (it.parts || [it]).some(p => p.game));

    const iconBtn = 'inline-flex h-7 w-7 shrink-0 items-center justify-center border border-white/10 text-[12px] text-slate-400 hover:border-white/30 hover:text-slate-100 disabled:opacity-30 disabled:hover:border-white/10 disabled:hover:text-slate-400';
    const OPT_ROWS = [
        { k: 'header', label: '整段標頭', options: [{ value: 'none', label: '無' }, { value: 'key', label: '●關鍵數據：' },
            ...(hasGame ? [{ value: 'game', label: '單場比分' }] : []), { value: 'custom', label: '自訂' }] },
        ...(hasGame && opts.header === 'game' ? [{ k: 'periods', label: '每節比分', options: [{ value: 'off', label: '不附' }, { value: 'on', label: '附上' }], bool: true }] : []),
        { k: 'order', label: '排列', options: [{ value: 'added', label: '加入順序' }, { value: 'player', label: '依球員' }, { value: 'metric', label: '依指標' }] },
        { k: 'bullet', label: '段首符號', options: [{ value: '', label: '無' }, { value: '●', label: '●' }] },
        { k: 'prefix', label: '行首', options:[{ value: '※', label: '※' }, { value: '•', label: '•' }, { value: '', label: '無' }] },
        { k: 'names', label: '指標名稱', options: [{ value: 'zh', label: '中文' }, { value: 'en', label: '原文' }, { value: 'both', label: '中文（原文）' }] },
        { k: 'cmpStyle', label: '前後比較', options: [{ value: 'arrow', label: 'A → B' }, { value: 'delta', label: '差值' }, { value: 'trend', label: '→ 加📈📉' }] },
        { k: 'rank', label: '名次', options: [{ value: 'on', label: '帶名次' }, { value: 'off', label: '不帶' }], bool: true },
        { k: 'ptStyle', label: 'Playtype 名次', options: [{ value: 'league', label: '聯盟第N' }, { value: 'pr', label: 'PR' }] },
        { k: 'asOfNote', label: '統計日期', options: [{ value: 'off', label: '不附' }, { value: 'on', label: '附「統計至」' }], bool: true },
        { k: 'source', label: '來源網址', options: [{ value: 'off', label: '不附' }, { value: 'on', label: '附上' }], bool: true },
    ];
    // 摺疊時的格式摘要（目前選項的標籤，依 OPT_ROWS 順序；只列常調的幾項）
    const optLabel = (r) => (r.options.find(x => x.value === (r.bool ? (opts[r.k] ? 'on' : 'off') : opts[r.k])) || {}).label;
    const optSummary = OPT_ROWS.filter(r => ['order', 'bullet', 'prefix', 'names', 'cmpStyle', 'rank'].includes(r.k))
        .map(r => r.k === 'bullet' ? `段首${optLabel(r)}` : r.k === 'prefix' ? `行首${optLabel(r)}` : optLabel(r)).join(' · ');

    return (<>
        {!open && (
            <button ref={fabRef} type="button" onClick={() => setOpen(true)} aria-label={`開啟引用籃（${items.length} 項）`}
                style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
                className="fixed right-4 z-40 inline-flex h-12 min-w-[48px] items-center gap-2 rounded-full bg-[#12A150] px-4 text-[14px] font-medium text-[#0A1626] shadow-2xl hover:brightness-110">
                <span aria-hidden="true">引用籃</span>
                <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-[#0A1626] px-1.5 font-mono text-[12px] text-[#12A150]">{items.length}</span>
            </button>
        )}
        {open && (
            <div className="fixed inset-0 z-[60]">
                <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} aria-hidden="true"></div>
                <div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="引用籃"
                    className="absolute inset-y-0 right-0 flex w-full flex-col border-l border-white/15 bg-[#0C1A2E] shadow-2xl outline-none sm:w-[460px]">
                    <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                        <div>
                            <div className="text-[15px] font-medium text-slate-100">引用籃 <span className="font-mono text-[12px] text-slate-400">{items.length} 項</span></div>
                            <div className="text-[11px] text-slate-500">每段可單獨複製，或底下一次複製全部</div>
                        </div>
                        <button type="button" onClick={() => setOpen(false)} aria-label="關閉引用籃"
                            className="inline-flex h-8 w-8 items-center justify-center text-[18px] text-slate-400 hover:text-slate-100">×</button>
                    </header>

                    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
                        {/* 預覽置頂、分段卡片：每段右上角「複製」只複製那一段（手機也有，分段複製是這個抽屜的主要用途）；文字可直接選取 */}
                        <section aria-label="預覽">
                            <div className="mb-1.5 text-[11px] text-slate-400">預覽 · {blocks.length} 段</div>
                            <div className="space-y-2">
                                {blocks.map((b, i) => (
                                    <div key={i} className={`relative border bg-[#0A1626] px-3 py-2.5 ${b.head ? 'border-dashed border-white/15' : 'border-white/15'}`}>
                                        <p className="whitespace-pre-wrap break-words pr-16 text-[13px] leading-relaxed text-slate-100">{b.text}</p>
                                        <button type="button" onClick={() => copyBlock(i)} aria-label={`複製第 ${i + 1} 段`}
                                            className={`absolute right-1.5 top-1.5 inline-flex min-h-[26px] items-center whitespace-nowrap border bg-[#0C1A2E] px-2 text-[11px] ${copied === i ? 'border-[#12A150] text-[#12A150]' : 'border-white/15 text-slate-400 hover:border-[#12A150] hover:text-[#12A150]'}`}>
                                            {copied === i ? '已複製' : '複製'}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* 項目：排序／合併／刪除，預設收起 */}
                        <section className="border-t border-white/[0.08]">
                            <button type="button" onClick={() => setShowItems(v => !v)} aria-expanded={showItems} aria-controls="qb-items"
                                className="flex min-h-[40px] w-full items-center gap-2 text-left text-[13px] text-slate-100">
                                <span aria-hidden="true" className="w-3 font-mono text-slate-500">{showItems ? '▾' : '▸'}</span>
                                項目 <span className="font-mono text-[11px] text-slate-500">{items.length}</span>
                                <span className="ml-auto whitespace-nowrap text-[11px] text-slate-500">排序、併成一行、刪除</span>
                            </button>
                            {showItems && (
                                <ol id="qb-items" className="border-t border-white/[0.08]">
                                    {items.map((it, i) => {
                                        const next = items[i + 1];
                                        return (
                                            <li key={it.id} className="flex items-start gap-2 border-b border-white/[0.08] py-2">
                                                <div className="min-w-0 flex-1">
                                                    <div className="break-words text-[13px] text-slate-100">{summary(it)}{noteOf(it) && <span className="text-slate-500">（{noteOf(it)}）</span>}</div>
                                                    <div className="font-mono text-[10px] text-slate-500">{[it.subject, it.context].filter(Boolean).join('｜')}{it.parts ? ' · 已合併' : ''}</div>
                                                </div>
                                                <div className="flex shrink-0 flex-wrap justify-end gap-1">
                                                    <button type="button" className={iconBtn} aria-label="上移" disabled={i === 0} onClick={() => Q.move(it.id, -1)}>↑</button>
                                                    <button type="button" className={iconBtn} aria-label="下移" disabled={i === items.length - 1} onClick={() => Q.move(it.id, 1)}>↓</button>
                                                    {it.parts
                                                        ? <button type="button" className={`${iconBtn} w-auto px-1.5`} onClick={() => Q.split(it.id)}>拆開</button>
                                                        : <button type="button" className={`${iconBtn} w-auto px-1.5`} disabled={!Q.canMerge(it, next)} onClick={() => Q.merge(it.id)}
                                                            title={Q.canMerge(it, next) ? '和下一項寫成同一行（例：出手數／命中率）' : '下一項的主體、情境或比較對象不同，不能合併'}>併下一項</button>}
                                                    <button type="button" className={iconBtn} aria-label="刪除" onClick={() => Q.remove(it.id)}>✕</button>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ol>
                            )}
                        </section>

                        {/* 格式：選項列，預設收起，摺起時標題列顯示目前設定摘要 */}
                        <section className="border-t border-white/[0.08]">
                            <button type="button" onClick={() => setShowOpts(v => !v)} aria-expanded={showOpts} aria-controls="qb-opts"
                                className="flex min-h-[40px] w-full items-center gap-2 text-left text-[13px] text-slate-100">
                                <span aria-hidden="true" className="w-3 font-mono text-slate-500">{showOpts ? '▾' : '▸'}</span>
                                格式
                                {!showOpts && <span className="ml-auto min-w-0 truncate text-[11px] text-slate-500">{optSummary}</span>}
                            </button>
                            {showOpts && (
                                <div id="qb-opts" className="space-y-2.5 pb-2">
                                    {OPT_ROWS.map(r => (
                                        <div key={r.k} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                            <span className="w-20 shrink-0 text-[11px] text-slate-400">{r.label}</span>
                                            <UI.Seg size="sm" ariaLabel={r.label} options={r.options}
                                                value={r.bool ? (opts[r.k] ? 'on' : 'off') : opts[r.k]}
                                                onChange={(v) => Q.setOpts({ [r.k]: r.bool ? v === 'on' : v })} />
                                        </div>
                                    ))}
                                    {opts.header === 'custom' && (
                                        <input type="text" aria-label="自訂標頭" value={opts.headerText} placeholder="例：●關鍵數據（G1 vs. 熱火）："
                                            onChange={(e) => Q.setOpts({ headerText: e.target.value })}
                                            className="w-full border border-white/15 bg-transparent px-2.5 py-1.5 text-[13px] text-slate-100 placeholder:text-slate-600 focus:border-[#12A150] focus:outline-none" />
                                    )}
                                </div>
                            )}
                        </section>
                    </div>

                    <footer className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-3"
                        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
                        <button type="button" onClick={() => { if (confirmClear) { Q.clear(); setConfirmClear(false); UI.toast('已清空引用籃'); } else setConfirmClear(true); }}
                            className={`inline-flex min-h-[32px] items-center border px-3 text-[12px] ${confirmClear ? 'border-[#EF4444] text-[#EF4444]' : 'border-white/15 text-slate-400 hover:border-white/30 hover:text-slate-100'}`}>
                            {confirmClear ? '確定清空？再按一次' : '清空'}
                        </button>
                        <button type="button" onClick={copy}
                            className="inline-flex min-h-[36px] items-center bg-[#12A150] px-4 text-[14px] font-medium text-[#0A1626] hover:brightness-110">複製全部</button>
                    </footer>
                </div>
            </div>
        )}
    </>);
};

window.QuoteBasket = QuoteBasket;
