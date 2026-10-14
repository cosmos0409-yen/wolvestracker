// 共用介面元件（設計系統）：window.UI
// 風格：細線分隔的數據表（ledger）取代盒狀卡片；大數字用 font-display（Barlow Condensed），
// 標籤一律「中文 + 小字 NBA 原文」。Tailwind class 必須完整寫在這裡（CLI 掃不到字串拼接）。
//   StatCell  單一指標格（數值三態：真的 0 照常顯示／無資料「—」／不適用「—」+ tooltip）
//   Ledger    StatCell 的容器（外框上/左線 + 每格右/下線，空位不畫線）
//   PctBar    百分位色階條（紅 → 月光銀 → 綠，中線 = 聯盟中位）；只給「真的有 percentile」的資料用
//   Seg       膠囊分段切換（aria-pressed）
//   Section   區塊（標題＋小字原文＋說明＋右側操作），Note 空狀態／提示，Chip/selectClass 篩選膠囊
//   寫作工具  CopyBtn/citeLine/doCopy（複製引用）、Info（指標定義，讀 glossary.js）、toast、ExportMenu/exportCSV/exportPNG（匯出）
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

    // ── 寫作工具：複製引用、指標定義 ──
    // 引用的「主體／賽季／日期」由 App 每次 render 寫入 window.CiteCtx：
    //   { subject, season, asOfSnap（快照日期）, asOfAgg（逐場重算的截至日期）, isHistory }
    // 每日快照的數字引用快照日；GameAgg 逐場重算的平均引用截至日——兩者可能不同，不可混用
    const copyText = async (text) => {
        try { await navigator.clipboard.writeText(text); return true; }
        catch (e) {
            try {   // 舊瀏覽器 / 非安全來源退回 execCommand
                const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
                document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok;
            } catch (e2) { return false; }
        }
    };
    let toastTimer = null;
    const toast = (msg) => {
        let el = document.getElementById('wl-toast');
        if (!el) {
            el = document.createElement('div'); el.id = 'wl-toast'; el.setAttribute('role', 'status');
            el.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:60;max-width:min(92vw,560px);padding:10px 16px;background:#0C1A2E;border:1px solid rgba(255,255,255,.18);color:#F8FAFC;font-size:13px;line-height:1.5;box-shadow:0 8px 24px rgba(0,0,0,.4);transition:opacity .2s;';
            document.body.appendChild(el);
        }
        el.textContent = msg; el.style.opacity = '1';
        clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.style.opacity = '0'; }, 2600);
    };
    // 組引用句：主體｜賽季｜日期或期間｜指標（原文） 數值｜資料：來源
    const citeLine = ({ label, en, value, unit = '', gkey, asOf = 'snap', note }) => {
        const c = window.CiteCtx || {};
        const g = (window.GLOSSARY || {})[gkey] || {};
        const when = asOf === 'none' ? null : c.isHistory ? '期末快照' : (asOf === 'agg' ? c.asOfAgg : c.asOfSnap);
        // 最後附上當下畫面的網址（hash 記住球員/章節/賽季/日期），日後可從引用直接回到原畫面查證
        const url = `${location.origin}${location.pathname}${location.hash}`;
        return [c.subject, c.season, note, when ? (c.isHistory ? when : `截至 ${when}`) : null,
            `${label}${en ? `（${en}）` : ''} ${value}${unit}`, `資料：${g.src || 'NBA.com Stats'}`, url].filter(Boolean).join('｜');
    };
    const doCopy = async (text) => { const ok = await copyText(text); toast(ok ? `已複製：${text}` : '複製失敗，請手動選取'); };

    const CopyIcon = () => (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="1" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
    );
    // 複製鈕：桌面滑過格子才出現、觸控裝置常駐；stopPropagation 避免觸發外層「開走勢」
    const CopyBtn = ({ text, className = '' }) => (
        <button type="button" aria-label="複製引用" title="複製引用"
            onClick={(e) => { e.stopPropagation(); doCopy(typeof text === 'function' ? text() : text); }}
            className={`inline-flex h-6 w-6 items-center justify-center text-slate-500 hover:text-[#12A150] opacity-0 group-hover/cell:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-100 ${className}`}>
            <CopyIcon />
        </button>
    );

    // 指標定義「?」：點開小卡（定義／計算／來源），點外面或 Esc 關閉
    const Info = ({ k, align = 'left' }) => {
        const g = (window.GLOSSARY || {})[k];
        const [open, setOpen] = React.useState(false);
        const ref = React.useRef(null);
        React.useEffect(() => {
            if (!open) return;
            const off = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
            const esc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
            document.addEventListener('mousedown', off); document.addEventListener('keydown', esc, true);
            return () => { document.removeEventListener('mousedown', off); document.removeEventListener('keydown', esc, true); };
        }, [open]);
        if (!g) return null;
        return (
            <span ref={ref} className="relative inline-flex align-middle">
                {/* 按鈕本身 24px（觸控目標下限，檢測工具量的是按鈕框），負邊距抵銷多出的空間；圓圈仍是 16px */}
                <button type="button" aria-label="指標定義" aria-expanded={open} onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
                    className="group/info -my-1 -mr-1 inline-flex h-6 w-6 items-center justify-center">
                    <span aria-hidden="true" className={`inline-flex h-4 w-4 items-center justify-center rounded-full border text-[9px] leading-none ${open ? 'border-[#12A150] text-[#12A150]' : 'border-white/20 text-slate-500 group-hover/info:border-white/40 group-hover/info:text-slate-200'}`}>?</span>
                </button>
                {open && (
                    <span role="tooltip" onClick={(e) => e.stopPropagation()}
                        className={`absolute top-6 z-40 block w-72 max-w-[80vw] border border-white/15 bg-[#0C1A2E] p-3 text-left text-[12px] font-normal normal-case leading-relaxed tracking-normal text-slate-200 shadow-2xl whitespace-normal ${align === 'right' ? 'right-0' : 'left-0'}`}>
                        <span className="block">{g.def}</span>
                        {g.calc && <span className="mt-1.5 block font-mono text-[11px] text-slate-400">計算：{g.calc}</span>}
                        <span className="mt-1.5 block text-[11px] text-slate-500">來源：{g.src}</span>
                        {g.verify && <span className="mt-1.5 block text-[11px] text-amber-300/90">此定義的細節待確認</span>}
                    </span>
                )}
            </span>
        );
    };

    // gkey：glossary 的 key（顯示「?」定義）；citeAsOf：'snap' 快照日 / 'agg' 截至日 / 'none'；citeNote：期間或場次等補充
    // ── 匯出：CSV 與 PNG 專欄配圖 ──
    const slug = (s) => String(s || '').replace(/[\\/:*?"<>|\s]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const fileName = (title, ext) => {
        const c = window.CiteCtx || {};
        const when = c.isHistory ? '期末' : (c.asOfSnap || '');
        return ['wolves-ledger', slug(c.subject), slug(c.season), slug(title), slug(when)].filter(Boolean).join('_') + '.' + ext;
    };
    const download = (href, name) => {
        const a = document.createElement('a'); a.href = href; a.download = name;
        document.body.appendChild(a); a.click();
        setTimeout(() => { if (href.startsWith('blob:')) URL.revokeObjectURL(href); a.remove(); }, 1500);
    };
    const provenance = (title) => {
        const c = window.CiteCtx || {};
        return [`Wolves Ledger`, title, c.subject, c.season, c.isHistory ? '期末快照' : (c.asOfSnap ? `截至 ${c.asOfSnap}` : null), '資料：NBA.com Stats／Synergy']
            .filter(Boolean).join('｜');
    };
    // CSV：第一列為出處說明，空一列後才是表頭；加 UTF-8 BOM 讓 Excel 正確顯示中文
    const exportCSV = ({ title, header, rows }) => {
        const esc = (v) => { const s = v == null ? '' : String(v); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
        const lines = [[provenance(title)], [], header, ...rows].map(r => r.map(esc).join(','));
        const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
        download(URL.createObjectURL(blob), fileName(title, 'csv'));
        toast(`已匯出 CSV：${title}`);
    };

    // PNG：html-to-image 只在第一次匯出時才載入（鎖定版本），平常不影響載入速度
    const H2I_SRC = 'https://cdn.jsdelivr.net/npm/html-to-image@1.11.13/dist/html-to-image.js';
    let h2iPromise = null;
    const loadH2I = () => {
        if (window.htmlToImage) return Promise.resolve();
        if (!h2iPromise) h2iPromise = new Promise((res, rej) => {
            const s = document.createElement('script'); s.src = H2I_SRC; s.onload = res;
            s.onerror = () => { h2iPromise = null; rej(new Error('圖片匯出模組載入失敗')); };
            document.head.appendChild(s);
        });
        return h2iPromise;
    };
    // 把目標節點複製到固定尺寸的配圖版面（字標＋標題＋圖＋出處），等比縮放置中後輸出 PNG。
    // 不放 NBA Logo／頭像：跨網域圖片會讓畫布無法輸出，也避免在配圖上使用官方商標
    const exportPNG = async (node, { title, ratio = '16:9' }) => {
        if (!node) return;
        const [W, H] = ratio === '1:1' ? [1080, 1080] : [1600, 900];
        const c = window.CiteCtx || {};
        toast('正在產生圖片…');
        try {
            await loadH2I();
            // 外層 holder 負責藏到畫面外；frame 本身只用一般定位——html-to-image 會把根節點的計算後樣式一起複製，
            // 若 frame 自己是 position:fixed + 負座標，內容會被畫到圖片外，輸出整張空白（實測踩過）
            const holder = document.createElement('div');
            holder.style.cssText = 'position:fixed;left:-30000px;top:0;pointer-events:none;';
            const frame = document.createElement('div');
            frame.style.cssText = `position:relative;width:${W}px;height:${H}px;box-sizing:border-box;padding:52px 60px 40px;display:flex;flex-direction:column;background:#0A1626;color:#F8FAFC;font-family:'Noto Sans TC',system-ui,sans-serif;`;
            holder.appendChild(frame);
            const when = c.isHistory ? '期末快照' : (c.asOfSnap ? `截至 ${c.asOfSnap}` : '');
            frame.innerHTML = `
                <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:24px;border-bottom:1px solid rgba(255,255,255,.15);padding-bottom:18px;">
                    <div style="min-width:0;">
                        <div style="font-family:'Barlow Condensed','Noto Sans TC',sans-serif;font-weight:700;font-size:${ratio === '1:1' ? 46 : 52}px;line-height:1.05;letter-spacing:.01em;"></div>
                        <div style="margin-top:8px;font-size:20px;color:#C4CED2;"></div>
                    </div>
                    <div style="flex:none;font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:26px;letter-spacing:.06em;text-transform:uppercase;">WOLVES <span style="color:#12A150;">LEDGER</span></div>
                </div>
                <div data-body style="position:relative;flex:1;min-height:0;margin-top:28px;"></div>
                <div style="display:flex;justify-content:space-between;gap:24px;margin-top:20px;border-top:1px solid rgba(255,255,255,.1);padding-top:14px;font-family:'JetBrains Mono',monospace;font-size:15px;color:#8A99A8;">
                    <span>資料：NBA.com Stats／Synergy</span><span></span>
                </div>`;
            // 文字一律用 textContent 寫入（標題含球員名等資料，不可當 HTML 解析）
            frame.children[0].children[0].children[0].textContent = title;
            frame.children[0].children[0].children[1].textContent = [c.subject, c.season, when].filter(Boolean).join('　·　');
            frame.children[2].children[1].textContent = `${location.host}${location.pathname}`;
            const body = frame.querySelector('[data-body]');
            const clone = node.cloneNode(true);
            clone.querySelectorAll('[aria-label="複製引用"],[aria-label="指標定義"],[data-export-hide]').forEach(el => el.remove());
            clone.style.width = node.offsetWidth + 'px';
            clone.style.position = 'absolute'; clone.style.left = '0'; clone.style.top = '0';
            clone.style.transformOrigin = 'top left';
            body.appendChild(clone);
            document.body.appendChild(holder);
            const bw = body.clientWidth, bh = body.clientHeight;
            const cw = clone.scrollWidth, ch = clone.scrollHeight;
            const k = Math.min(bw / cw, bh / ch, 2.2);
            clone.style.transform = `scale(${k})`;
            clone.style.left = Math.max(0, (bw - cw * k) / 2) + 'px';
            clone.style.top = Math.max(0, (bh - ch * k) / 2) + 'px';
            if (document.fonts && document.fonts.ready) await document.fonts.ready;
            const url = await window.htmlToImage.toPng(frame, { width: W, height: H, pixelRatio: 1, backgroundColor: '#0A1626' });
            holder.remove();
            download(url, fileName(title, 'png').replace('.png', `_${ratio.replace(':', 'x')}.png`));
            toast(`已匯出圖片（${ratio}）：${title}`);
        } catch (e) {
            console.error('export png failed', e);
            toast(`圖片匯出失敗：${e.message || e}`);
            document.querySelectorAll('body > div[style*="-30000px"]').forEach(el => el.remove());
        }
    };

    // 匯出選單：CSV（有 csv 時）＋ PNG 16:9 / 1:1。getNode 回傳要輸出成圖的 DOM 節點
    const ExportMenu = ({ title, getNode, csv }) => {
        const [open, setOpen] = React.useState(false);
        const ref = React.useRef(null);
        React.useEffect(() => {
            if (!open) return;
            const off = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
            document.addEventListener('mousedown', off);
            return () => document.removeEventListener('mousedown', off);
        }, [open]);
        const item = 'block w-full px-3 py-2 text-left text-[12px] text-slate-200 hover:bg-white/[0.06]';
        return (
            <span ref={ref} className="relative inline-flex" data-export-hide>
                <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}
                    className="rounded-full border border-white/15 px-3 py-1 text-xs text-slate-400 hover:border-white/30 hover:text-slate-100">匯出 ▾</button>
                {open && (
                    <span role="menu" className="absolute right-0 top-8 z-40 block w-44 border border-white/15 bg-[#0C1A2E] py-1 shadow-2xl">
                        {getNode && <button type="button" role="menuitem" className={item} onClick={() => { setOpen(false); exportPNG(getNode(), { title, ratio: '16:9' }); }}>配圖 PNG · 16:9</button>}
                        {getNode && <button type="button" role="menuitem" className={item} onClick={() => { setOpen(false); exportPNG(getNode(), { title, ratio: '1:1' }); }}>配圖 PNG · 1:1</button>}
                        {csv && <button type="button" role="menuitem" className={item} onClick={() => { setOpen(false); exportCSV({ title, ...csv() }); }}>表格 CSV（Excel）</button>}
                    </span>
                )}
            </span>
        );
    };

    const StatCell = ({ label, en, value, unit = '', prevValue, betterIsLarger = true, naReason = null, pct = null, pctLabel, gkey, citeAsOf = 'snap', citeNote }) => {
        const isNA = naReason && isBlank(value);
        const missing = isBlank(value);
        return (
            <div className="group/cell relative border-r border-b border-white/[0.08] px-3 pt-2.5 pb-3 min-w-0">
                {!missing && (
                    <CopyBtn className="absolute right-1 top-1"
                        text={() => citeLine({ label, en, value, unit, gkey, asOf: citeAsOf, note: citeNote })} />
                )}
                <div className="flex items-center pr-5 text-[11px] leading-tight text-slate-300 min-w-0">
                    <span className="truncate" title={label}>{label}</span>
                    {gkey && <Info k={gkey} />}
                </div>
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
    // exportTitle：給了就在表格右上加「匯出」（PNG 配圖＋CSV）；CSV 值取 c.csv(r)，否則取 r[c.key] 原始值
    const DataTable = ({ columns, rows, initialSort = null, rowKey = (r, i) => i, caption, exportTitle }) => {
        const [sort, setSort] = React.useState(initialSort);   // { key, dir: 'asc'|'desc' }
        const wrapRef = React.useRef(null);
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
        const csv = () => ({
            header: columns.map(c => c.en ? `${c.label} ${c.en}` : c.label),
            rows: sorted.map(r => columns.map(c => c.csv ? c.csv(r) : (typeof r[c.key] === 'number' || typeof r[c.key] === 'string' ? r[c.key] : ''))),
        });
        return (
            <div>
            {exportTitle && (
                <div className="mb-2 flex justify-end"><ExportMenu title={exportTitle} getNode={() => wrapRef.current} csv={csv} /></div>
            )}
            <div ref={wrapRef} className="overflow-x-auto border-t border-white/[0.08]">
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
                                        <span className={`inline-flex items-start gap-0.5 ${c.align === 'left' ? '' : 'flex-row-reverse'}`}>
                                            <button onClick={() => toggle(c.key)}
                                                className={`inline-flex flex-col ${c.align === 'left' ? 'items-start' : 'items-end'} gap-0.5 hover:text-slate-100 ${active ? 'text-slate-100' : 'text-slate-400'}`}>
                                                <span className="text-[11px]">{c.label}{active && <span className="ml-1 text-[#12A150]">{sort.dir === 'asc' ? '↑' : '↓'}</span>}</span>
                                                {c.en && <span className="font-mono text-[10px] text-slate-500">{c.en}</span>}
                                            </button>
                                            {c.gkey && <Info k={c.gkey} align={ci === columns.length - 1 ? 'right' : 'left'} />}
                                        </span>
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
                                        {c.after && <span className="ml-1 inline-flex items-center align-middle">{c.after(r)}</span>}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
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

    return { splitTitle, pctColor, Delta, PctBar, StatCell, Ledger, ledgerCols, DataTable, Seg, Section, Note, Chip, selectClass, copyText, toast, citeLine, doCopy, CopyBtn, Info, exportCSV, exportPNG, ExportMenu };
})();
