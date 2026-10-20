// 薪資頁（Cap Sheet）：網址 #cap[&s=賽季]
// 資料：wolves_salary/main 單一 doc（scripts/sync_salary.py 由 Google Sheet 同步，欄位名沿用 Sheet 欄名）
// 計算只在這裡做（兩種總額、各門檻空間、奢侈稅、所在層級）；Python 端只檢查格式，計算邏輯只放一處
// 兩種總額（2024-25、2025-26 用 Spotrac 數字驗證過，逐元相符）：
//   奢侈稅薪資 = Σ 標準合約 cap hit（含 likely incentives）＋ 死錢；薪資帽空間、奢侈稅都用它
//   apron 薪資 = 奢侈稅薪資 ＋ Σ unlikely incentives；判定第一／第二 apron 用它
// props：season（網址 s=，空＝薪資當季）、onSeason(season|'')、capTab（網址 tab=，空＝總覽）、onTab(tab|'')、
//        playerNameOf(playerId)→快照裡的球員名（球員連結用，可省略）
window.CapCalc = (function () {
    const sum = (arr, f) => arr.reduce((a, x) => a + (f(x) || 0), 0);

    const payroll = (doc, season) => {
        const rows = (doc.contracts || []).filter(c => c.season === season);
        const std = rows.filter(c => c.type !== 'TWO-WAY');
        const dead = (doc.dead || []).filter(d => d.season === season);
        const deadTotal = sum(dead, d => d.amount);
        const tax = sum(std, c => c.salary) + deadTotal;
        return { rows, std, twoWay: rows.length - std.length, dead, deadTotal, tax, apron: tax + sum(std, c => c.unlikely) };
    };

    // 奢侈稅：超出奢侈稅線的金額每 tax_bracket 一級，各級金額 × 該級稅率後加總。
    // Sheet 只列到第 n 級，之後每多一級稅率 +0.50（CBA 規則）
    const taxOf = (taxPayroll, t, rates, repeater) => {
        const over = taxPayroll - t.tax;
        if (!(over > 0) || !rates || !rates.length || !t.tax_bracket) return { total: 0, over, rows: [] };
        const last = rates[rates.length - 1];
        const rows = [];
        for (let i = 0; i * t.tax_bracket < over; i++) {
            const r = rates[i];
            const rate = r ? (repeater ? r.repeater_rate : r.rate)
                : (repeater ? last.repeater_rate : last.rate) + 0.5 * (i - (rates.length - 1));
            const from = i * t.tax_bracket, to = Math.min(over, (i + 1) * t.tax_bracket);
            rows.push({ bracket: i + 1, from, to, amount: to - from, rate, tax: (to - from) * rate });
        }
        return { total: sum(rows, r => r.tax), over, rows };
    };

    const tierOf = (p, t) => p.apron > t.apron2 ? 'apron2' : p.apron > t.apron1 ? 'apron1'
        : p.tax > t.tax ? 'tax' : p.tax > t.cap ? 'cap' : 'below_cap';

    // 前 n 季的賽季字串（2026-27, 4 → 2022-23…2025-26）
    const prevSeasons = (season, n) => {
        const y = +season.slice(0, 4);
        return Array.from({ length: n }, (_, i) => { const a = y - n + i; return `${a}-${String((a + 1) % 100).padStart(2, '0')}`; });
    };
    // 累犯（repeater）：前 4 季有 3 季繳奢侈稅。依 Sheet 的 tax_history 自動判定，不手填。
    // 有缺資料的季：缺的全算有繳也到不了 3 季 → 一般；已滿 3 季 → 累犯；其餘 → 無法判定
    const repeaterOf = (doc, season) => {
        const hist = {};
        (doc.tax_history || []).forEach(h => { hist[h.season] = h; });
        const win = prevSeasons(season, 4).map(x => ({ season: x, paid: hist[x] ? hist[x].paid : null, note: hist[x] ? hist[x].note : '' }));
        const yes = win.filter(w => w.paid === true).length, unk = win.filter(w => w.paid == null).length;
        const status = yes >= 3 ? 'repeater' : yes + unk < 3 ? 'normal' : 'unknown';
        // 下一季的判定窗＝本季前 3 季＋本季：本季季末是否繳稅會決定下季是不是累犯
        const prior3 = win.slice(1).filter(w => w.paid === true).length;
        return { win, yes, unk, status, prior3 };
    };

    // 金額格式給其他元件共用（球員身分列的薪資膠囊）
    return { payroll, taxOf, tierOf, repeaterOf, fmtM: (n, d) => capM(n, d), fmtFull: (n) => capFull(n) };
})();

// 讀 wolves_salary/main（約 25 KB，只存記憶體 window.__capDoc；同一頁面期間只讀一次）。
// unavailable（連線暫時中斷，常見於剛載入或網路切換）自動重試 2 次；權限錯誤不重試
window.loadCapDoc = function () {
    if (window.__capDoc !== undefined) return Promise.resolve(window.__capDoc);
    if (window.__capDocPromise) return window.__capDocPromise;
    const { doc: fdoc, getDoc } = window.firebaseModules;
    const load = (n) => getDoc(fdoc(window.db, 'wolves_salary', 'main'))
        .then(snap => { window.__capDoc = snap.exists() ? snap.data() : null; return window.__capDoc; })
        .catch(e => {
            if (e.code === 'unavailable' && n < 2) return new Promise(res => setTimeout(res, 1500 * (n + 1))).then(() => load(n + 1));
            throw e;
        });
    window.__capDocPromise = load(0).finally(() => { window.__capDocPromise = null; });
    return window.__capDocPromise;
};

const CapPage = ({ season, onSeason, capTab, onTab, playerNameOf }) => {
    const { useState, useEffect } = React;
    const UI = window.UI;
    const C = window.CapCalc;

    const [doc, setDoc] = useState(window.__capDoc);   // undefined=載入中, null=查無
    const [err, setErr] = useState(null);
    const [repeaterBySeason, setRepeaterBySeason] = useState({});   // 使用者手動試算的稅率（依賽季記住）；沒切換＝用自動判定結果

    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        if (window.__capDoc !== undefined || !window.db || !window.firebaseModules) return;
        let cancelled = false;
        setErr(null); setDoc(undefined);
        window.loadCapDoc()
            .then(v => { if (!cancelled) setDoc(v); })
            .catch(e => {
                console.error('cap doc fetch fail', e);
                if (!cancelled) { setErr(String(e.code || e.message || e)); setDoc(null); }
            });
        return () => { cancelled = true; };
    }, [attempt]);

    const seasons = doc ? Object.keys(doc.thresholds || {}).sort() : [];
    const capNow = window.capSeasonForDate();
    const defaultSeason = seasons.includes(capNow) ? capNow : seasons[seasons.length - 1];
    const s = seasons.includes(season) ? season : defaultSeason;

    if (doc === undefined) return <div className="py-16 text-center text-sm text-slate-500 animate-pulse">載入薪資資料…</div>;
    if (err) return (
        <UI.Note tone="warn">
            薪資資料讀取失敗：<code className="text-amber-100">{err}</code><br />
            {err === 'permission-denied'
                ? '原因是 wolves_salary 集合缺少 Firestore 安全規則的 read 白名單（見 doc/handover.md）。'
                : '連線暫時中斷，請稍後重試。'}
            {err !== 'permission-denied' && (
                <button type="button" onClick={() => setAttempt(a => a + 1)}
                    className="ml-2 inline-flex min-h-[24px] items-center rounded-full border border-amber-300/50 px-3 text-[12px] text-amber-100 hover:border-amber-200">重試</button>
            )}
        </UI.Note>
    );
    if (!doc || !s) return <UI.Note>還沒有薪資資料。請先執行 <code>python scripts/sync_salary.py</code> 從 Google Sheet 同步。</UI.Note>;

    const t = doc.thresholds[s];
    const p = C.payroll(doc, s);
    const rep = C.repeaterOf(doc, s);
    const repeaterAuto = rep.status === 'repeater';
    const repeater = s in repeaterBySeason ? repeaterBySeason[s] : repeaterAuto;
    const whatIf = repeater !== repeaterAuto;   // 使用者切到和判定結果不同的稅率＝試算
    const tax = C.taxOf(p.tax, t, (doc.tax_rates || {})[s], repeater);
    const tier = C.tierOf(p, t);
    const syncDate = doc.updatedAt ? new Date(doc.updatedAt).toLocaleDateString('sv-SE') : '';
    const isCurrent = s === capNow;
    window.CiteCtx = { subject: 'Minnesota Timberwolves', season: `${s} 薪資`, asOfSnap: syncDate, asOfAgg: null, isHistory: false };

    const openPlayer = (pl, season) => {
        const name = (playerNameOf && playerNameOf(pl.id)) || pl.name;
        const key = season === window.CURRENT_SEASON ? 'current' : `${season}_regular`;
        const ok = key === 'current' || (window.SEASON_OPTIONS || []).some(o => o.key === key);
        window.location.hash = window.UrlState.serialize({ viewMode: 'PLAYER', selectedPlayer: name, activeTab: 'overview', selectedSeasonKey: ok ? key : 'current' });
        window.scrollTo(0, 0);
    };

    const recon = [];
    if (t.ref_tax_total != null && Math.abs(t.ref_tax_total - p.tax) > 1) recon.push(`奢侈稅薪資與參考值（${capFull(t.ref_tax_total)}）相差 ${capFull(t.ref_tax_total - p.tax)}`);
    if (t.ref_apron_total != null && Math.abs(t.ref_apron_total - p.apron) > 1) recon.push(`apron 薪資與參考值（${capFull(t.ref_apron_total)}）相差 ${capFull(t.ref_apron_total - p.apron)}`);

    const locked = t.hard_cap === 'apron1' || t.hard_cap === 'apron2' ? t.hard_cap : null;
    // 狀態列「所在層級」的補充：超出目前這條線多少（低於薪資帽時改寫距薪資帽還差多少）。
    // 薪資帽、奢侈稅線比奢侈稅薪資；兩條 apron 比 apron 薪資。距下一條線的空間看下方數字格，不在這裡重複
    const overLine = tier === 'cap' ? ['薪資帽', p.tax - t.cap] : tier === 'tax' ? ['奢侈稅線', p.tax - t.tax]
        : tier === 'apron1' ? ['第一 apron', p.apron - t.apron1] : tier === 'apron2' ? ['第二 apron', p.apron - t.apron2] : null;
    const tab = CAP_TABS.some(x => x.key === capTab) ? capTab : 'overview';

    return (
        <div className="pb-6">
            <header className="mb-2">
                <h1 className="flex items-baseline gap-2 text-[24px] font-bold leading-tight text-slate-50">
                    薪資與奢侈稅<span className="font-mono text-[12px] font-normal text-slate-500">Cap Sheet</span>
                </h1>
                <p className="mt-1 text-[12px] text-slate-400">資料最後同步 {syncDate || '—'}・人工整理自 Spotrac、Hoops Rumors 等公開資料</p>
            </header>

            {/* 分頁列（捲動時固定在頂端）：分頁＋唯一的賽季選單。刊頭的賽季／賽別／日期在薪資頁隱藏，避免兩組賽季控制項 */}
            <nav aria-label="薪資頁分頁" className="sticky top-0 z-20 -mx-4 mb-6 border-b border-white/10 bg-[#0A1626]/85 px-4 backdrop-blur-md md:-mx-6 md:px-6">
                <div className="flex items-center gap-3">
                    <div className="flex min-w-0 flex-1 items-center overflow-x-auto [scrollbar-width:none] [mask-image:linear-gradient(to_right,#000_85%,transparent)] sm:[mask-image:none]">
                        {CAP_TABS.map(x => {
                            const on = tab === x.key;
                            return (
                                <button key={x.key} type="button" onClick={() => onTab(x.key === 'overview' ? '' : x.key)} aria-current={on ? 'page' : undefined}
                                    className={`shrink-0 border-b-2 px-2.5 py-3 text-[14px] transition-colors sm:px-3 ${on ? 'border-[#12A150] font-medium text-slate-50' : 'border-transparent text-slate-400 hover:text-slate-100'}`}>
                                    {x.label}
                                </button>
                            );
                        })}
                    </div>
                    <label className="sr-only" htmlFor="cap-season">薪資賽季</label>
                    <select id="cap-season" value={s} onChange={e => onSeason(e.target.value === defaultSeason ? '' : e.target.value)}
                        className="shrink-0 rounded-full border border-white/15 bg-[#0A1626] px-3 py-1.5 font-mono text-[12px] text-slate-200 focus:border-[#12A150] focus:outline-none">
                        {seasons.map(x => <option key={x} value={x}>{x}</option>)}
                    </select>
                </div>
            </nav>

            {tab === 'overview' && (
                <div className="space-y-10">
                    <UI.Section title="現況" en="Overview" sub={`${s}${isCurrent ? '（本季，依目前名單）' : '（季末名單）'}`}>
                        {/* 狀態列：三項並排、細線分隔，不用膠囊（膠囊留給可點的控制項） */}
                        <dl className="-mt-1 mb-5 grid grid-cols-1 border-b border-white/10 sm:grid-cols-3">
                            <div className="py-3 sm:pr-4">
                                <dt className="font-mono text-[10px] tracking-wide text-slate-500">所在層級 · TIER</dt>
                                <dd className="mt-1 flex items-center gap-2 text-[15px] font-medium text-slate-50">
                                    <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${CAP_TIER_DOT[tier]}`}></span>{CAP_TIER_LABEL[tier]}
                                </dd>
                                <dd className="mt-0.5 text-[12px] text-slate-400">{overLine ? <>超出{overLine[0]} <CapAmt v={overLine[1]} /></> : <>距薪資帽還差 <CapAmt v={t.cap - p.tax} /></>}</dd>
                            </div>
                            <div className="border-t border-white/10 py-3 sm:border-l sm:border-t-0 sm:px-4" title="hard cap：做了特定操作後，本季任何時間都不能超過那條線">
                                <dt className="font-mono text-[10px] tracking-wide text-slate-500">鎖死狀態 · HARD CAP</dt>
                                <dd className="mt-1 flex items-center gap-2 text-[15px] font-medium text-slate-50">
                                    <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${locked ? 'bg-[#EF4444]' : 'bg-slate-600'}`}></span>
                                    {locked ? `鎖死在${locked === 'apron1' ? '第一' : '第二'} apron` : '未鎖死'}
                                </dd>
                                <dd className="mt-0.5 text-[12px] text-slate-400">
                                    {locked ? <>{t.hard_cap_reason ? `${t.hard_cap_reason}・` : ''}距上限 <CapAmt v={t[locked] - p.apron} /></> : '本季沒有觸發鎖死的操作紀錄'}
                                </dd>
                            </div>
                            <div className="border-t border-white/10 py-3 sm:border-l sm:border-t-0 sm:pl-4" title="累犯＝前 4 季有 3 季繳奢侈稅；依繳稅紀錄自動判定">
                                <dt className="font-mono text-[10px] tracking-wide text-slate-500">奢侈稅率 · TAX RATE</dt>
                                <dd className="mt-1 flex items-center gap-2 text-[15px] font-medium text-slate-50">
                                    <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${repeaterAuto ? 'bg-[#EF4444]' : rep.status === 'normal' ? 'bg-slate-400' : 'bg-amber-400'}`}></span>
                                    {rep.status === 'repeater' ? '累犯稅率' : rep.status === 'normal' ? '一般稅率' : '無法判定'}
                                </dd>
                                <dd className="mt-0.5 text-[12px] text-slate-400">前 4 季繳稅 {rep.yes} 季{rep.unk ? `、${rep.unk} 季無紀錄` : ''}（滿 3 季為累犯）</dd>
                            </div>
                        </dl>
                        {!isCurrent && t.apron_final && t.apron_final !== tier && (
                            <p className="-mt-3 mb-4 text-[12px] text-amber-300">Sheet 記錄的季末層級為「{CAP_TIER_LABEL[t.apron_final]}」，與本頁加總不同。</p>
                        )}

                        <UI.Ledger cols="grid-cols-2 sm:grid-cols-4">
                            <UI.StatCell label="奢侈稅薪資" en="Tax Payroll" value={capM(p.tax)} valueTitle={capFull(p.tax)} gkey="CAP_TAX_PAYROLL" />
                            <UI.StatCell label="apron 薪資" en="Apron Payroll" value={capM(p.apron)} valueTitle={capFull(p.apron)} gkey="CAP_APRON_PAYROLL" />
                            <UI.StatCell label="預估奢侈稅" en={`${repeater ? '累犯稅率' : '一般稅率'}${whatIf ? '（試算）' : ''}`} value={capM(tax.total)} valueTitle={capFull(tax.total)} gkey="CAP_TAX_EST" />
                            <UI.StatCell label="標準合約" en={`雙向 ${p.twoWay} 人另計`} value={p.std.length} unit="人" gkey="CAP_ROSTER" />
                            <UI.StatCell label="薪資帽空間" en="Cap Space" value={capM(t.cap - p.tax)} valueTitle={capFull(t.cap - p.tax)} gkey="CAP_SPACE" />
                            <UI.StatCell label="奢侈稅空間" en="Tax Space" value={capM(t.tax - p.tax)} valueTitle={capFull(t.tax - p.tax)} gkey="CAP_TAX_SPACE" />
                            <UI.StatCell label="第一 apron 空間" en="1st Apron Space" value={capM(t.apron1 - p.apron)} valueTitle={capFull(t.apron1 - p.apron)} gkey="CAP_APRON1_SPACE" />
                            <UI.StatCell label="第二 apron 空間" en="2nd Apron Space" value={capM(t.apron2 - p.apron)} valueTitle={capFull(t.apron2 - p.apron)} gkey="CAP_APRON2_SPACE" />
                        </UI.Ledger>

                        {recon.length > 0 && (
                            <div className="mt-3"><UI.Note tone="warn">
                                資料對帳：{recon.join('；')}。通常是 Sheet 還缺部分明細（例如 unlikely incentives），相關空間數字可能略有偏差。
                            </UI.Note></div>
                        )}

                        <CapGauge t={t} p={p} tier={tier} />
                    </UI.Section>

                    <UI.Section title="奢侈稅估算" en="Luxury Tax"
                        right={
                            <span className="inline-flex flex-wrap items-center gap-3">
                                {whatIf && <span className="text-[12px] text-amber-300">試算中（判定為{repeaterAuto ? '累犯' : '一般'}稅率）</span>}
                                <label className="inline-flex min-h-[24px] cursor-pointer items-center gap-2 text-[12px] text-slate-300">
                                    <input type="checkbox" checked={repeater} onChange={e => setRepeaterBySeason(m => ({ ...m, [s]: e.target.checked }))}
                                        className="h-4 w-4 accent-[#12A150]" />
                                    使用累犯稅率
                                </label>
                            </span>
                        }>
                        <CapRepeater rep={rep} s={s} isCurrent={isCurrent} overTax={p.tax - t.tax} />
                        {tax.rows.length === 0 ? (
                            <UI.Note>奢侈稅薪資低於奢侈稅線 <CapAmt v={t.tax - p.tax} />，不需繳奢侈稅。</UI.Note>
                        ) : (
                            <div className="overflow-x-auto border-t border-white/[0.08]">
                                <table className="w-full text-sm border-collapse">
                                    <caption className="sr-only">奢侈稅分級計算</caption>
                                    <thead>
                                        <tr className="border-b border-white/15 text-[11px] text-slate-400">
                                            <th scope="col" className="px-3 py-2 text-left font-normal whitespace-nowrap">級距</th>
                                            <th scope="col" className="px-3 py-2 text-right font-normal whitespace-nowrap">超出奢侈稅線的範圍</th>
                                            <th scope="col" className="px-3 py-2 text-right font-normal whitespace-nowrap">該級金額</th>
                                            <th scope="col" className="px-3 py-2 text-right font-normal whitespace-nowrap">稅率</th>
                                            <th scope="col" className="px-3 py-2 text-right font-normal whitespace-nowrap">稅額</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tax.rows.map(r => (
                                            <tr key={r.bracket} className="border-b border-white/[0.06] odd:bg-white/[0.015]">
                                                <td className="px-3 py-2 text-slate-200 whitespace-nowrap">第 {r.bracket} 級</td>
                                                <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-400 whitespace-nowrap cursor-help" title={`${capFull(r.from)}–${capFull(r.from + t.tax_bracket)}`}>{capM(r.from)}–{capM(r.from + t.tax_bracket)}</td>
                                                <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-200 whitespace-nowrap">{capFull(r.amount)}</td>
                                                <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-200 whitespace-nowrap">× {r.rate.toFixed(2)}</td>
                                                <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-50">{capFull(r.tax)}</td>
                                            </tr>
                                        ))}
                                        <tr className="border-t border-white/15">
                                            <td className="px-3 py-2 font-bold text-slate-100 whitespace-nowrap">合計</td>
                                            <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-400 whitespace-nowrap">超出 {capFull(tax.over)}</td>
                                            <td colSpan="2"></td>
                                            <td className="px-3 py-2 text-right font-mono font-bold tabular-nums text-slate-50">{capFull(tax.total)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        )}
                        <p className="mt-2 text-[12px] leading-relaxed text-slate-400">
                            計算方式：奢侈稅是累進制，超出奢侈稅線的金額每 <CapAmt v={t.tax_bracket} digits={3} /> 一級，各級金額乘以該級稅率後加總；Sheet 列出的級距之後，每多一級稅率加 0.50。
                            累犯稅率是另一套更高的累進稅率，前 4 季有 3 季繳稅的球隊適用；本頁依繳稅紀錄自動判定，可勾選右上角「使用累犯稅率」試算。
                            這是估算：實際以例行賽最後一天的薪資計算，季中交易按比例分攤、獎金是否達成、cap hold 都沒有計入。
                        </p>
                    </UI.Section>
                </div>
            )}

            {tab === 'contracts' && (
                <div className="space-y-10">
                    <CapYearly doc={doc} s={s} onPlayer={openPlayer} />
                    <CapStructure doc={doc} s={s} />
                    {/* 薪資×表現：Sheet 的 settings.show_value 設成 FALSE 就整個隱藏（不必改程式） */}
                    {(doc.settings || {}).show_value !== false && <CapValue doc={doc} s={s} />}
                </div>
            )}
            {tab === 'picks' && <CapPicks doc={doc} />}
            {tab === 'rules' && <CapRules doc={doc} t={t} p={p} tier={tier} />}
        </div>
    );
};

const CAP_TABS = [
    { key: 'overview', label: '總覽' },
    { key: 'contracts', label: '合約' },
    { key: 'picks', label: '選秀權' },
    { key: 'rules', label: '規則' },
];

const CAP_TIER_LABEL = { below_cap: '低於薪資帽', cap: '超過薪資帽', tax: '超過奢侈稅線', apron1: '超過第一 apron', apron2: '超過第二 apron' };
const CAP_TIER_DOT = { below_cap: 'bg-[#12A150]', cap: 'bg-slate-300', tax: 'bg-amber-400', apron1: 'bg-amber-400', apron2: 'bg-[#EF4444]' };
const CAP_TIER_FILL = { below_cap: 'bg-[#12A150]', cap: 'bg-[#12A150]', tax: 'bg-amber-400', apron1: 'bg-amber-400', apron2: 'bg-[#EF4444]' };
const CAP_TIERS = [
    { key: 'cap', line: 'cap', payroll: 'tax', label: '超過薪資帽', en: 'Over the Cap' },
    { key: 'tax', line: 'tax', payroll: 'tax', label: '超過奢侈稅線', en: 'Taxpayer' },
    { key: 'apron1', line: 'apron1', payroll: 'apron', label: '超過第一 apron', en: 'Over 1st Apron' },
    { key: 'apron2', line: 'apron2', payroll: 'apron', label: '超過第二 apron', en: 'Over 2nd Apron' },
];

function capM(n, digits = 2) { return (n < 0 ? '−' : '') + '$' + (Math.abs(n) / 1e6).toFixed(digits) + 'M'; }
function capFull(n) { return (n < 0 ? '−' : '') + '$' + Math.abs(Math.round(n)).toLocaleString('en-US'); }
// 縮寫金額（$214.93M）；滑鼠移上去顯示完整金額（$214,930,954），虛線底線提示可以懸停
const CapAmt = ({ v, digits = 2 }) => (
    <span title={capFull(v)} className="cursor-help underline decoration-dotted decoration-white/30 underline-offset-2">{capM(v, digits)}</span>
);

// 累犯判定：前 4 季逐季是否繳稅＋結論；本季另外提示「本季季末是否繳稅」對下季的影響
const CapRepeater = ({ rep, s, isCurrent, overTax }) => {
    const dot = (w) => w.paid === true ? 'bg-amber-400' : w.paid === false ? 'border border-slate-500' : 'border border-dashed border-slate-600';
    const verdict = rep.status === 'repeater' ? `前 4 季有 ${rep.yes} 季繳稅，${s} 適用累犯稅率`
        : rep.status === 'normal' ? `前 4 季只有 ${rep.yes} 季繳稅（未達 3 季），${s} 適用一般稅率`
        : `前 4 季有 ${rep.yes} 季繳稅、${rep.unk} 季沒有紀錄，無法判定（請在 Sheet 的 tax_history 補上）`;
    let outlook = null;
    if (isCurrent) {
        const next = `${+s.slice(0, 4) + 1}-${String((+s.slice(0, 4) + 2) % 100).padStart(2, '0')}`;
        if (rep.prior3 >= 3) outlook = `不論本季結果，${next} 都會適用累犯稅率。`;
        else if (rep.prior3 === 2) outlook = overTax > 0
            ? <>{s} 季末若仍超過奢侈稅線（目前超出 <CapAmt v={overTax} />），{next} 起就會適用累犯稅率。</>
            : <>{s} 季末若超過奢侈稅線，{next} 起就會適用累犯稅率（目前低於奢侈稅線 <CapAmt v={-overTax} />）。</>;
        else outlook = `${next} 不會是累犯。`;
    }
    return (
        <div className="mb-4 border border-white/10 bg-white/[0.02] px-4 py-3">
            <div className="text-[12px] text-slate-400">累犯判定 <span className="font-mono text-[10px] text-slate-500">Repeater Test</span>：前 4 季有 3 季繳奢侈稅就適用累犯稅率</div>
            <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
                {rep.win.map(w => (
                    <li key={w.season} title={w.note || ''} className="flex items-center gap-2 text-[12px]">
                        <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${dot(w)}`}></span>
                        <span className="font-mono text-slate-300">{w.season}</span>
                        <span className={w.paid === true ? 'text-amber-300' : 'text-slate-500'}>{w.paid === true ? '繳稅' : w.paid === false ? '未繳' : '無紀錄'}</span>
                    </li>
                ))}
            </ul>
            <p className="mt-2 text-[13px] text-slate-100">{verdict}</p>
            {outlook && <p className={`mt-1 text-[12px] ${rep.prior3 >= 2 ? 'text-amber-300' : 'text-slate-400'}`}>{outlook}</p>}
        </div>
    );
};

// 門檻儀表：一條橫條標出最低薪資、薪資帽、奢侈稅線、兩條 apron 與目前 apron 薪資。
// 標籤上下交錯，避免奢侈稅線與第一 apron 太近時重疊
const CapGauge = ({ t, p, tier }) => {
    const lines = [
        { k: 'min_team', label: '最低薪資' }, { k: 'cap', label: '薪資帽' }, { k: 'tax', label: '奢侈稅線' },
        { k: 'apron1', label: '第一 apron' }, { k: 'apron2', label: '第二 apron' },
    ];
    const lo = t.min_team * 0.9, hi = Math.max(t.apron2, p.apron) * 1.06;
    const pos = v => Math.max(0, Math.min(100, (v - lo) / (hi - lo) * 100));
    const locked = t.hard_cap === 'apron1' || t.hard_cap === 'apron2' ? t.hard_cap : null;
    return (
        <figure className="mt-8" aria-label={`門檻儀表：apron 薪資 ${capM(p.apron)}，${CAP_TIER_LABEL[tier]}`}>
            <figcaption className="mb-1 text-[12px] text-slate-400">
                目前 apron 薪資 <span className="font-mono text-slate-100"><CapAmt v={p.apron} /></span>（色條）與各門檻
            </figcaption>
            <div className="px-6 pt-12 pb-10">
                <div className="relative h-3 bg-white/[0.06]">
                    <div className={`absolute inset-y-0 left-0 ${CAP_TIER_FILL[tier]}`} style={{ width: pos(p.apron) + '%' }}></div>
                    {lines.map((l, i) => (
                        <div key={l.k} className={`absolute -top-2 -bottom-2 w-px ${locked === l.k ? 'bg-[#EF4444]' : 'bg-slate-300/70'}`} style={{ left: pos(t[l.k]) + '%' }}>
                            <span title={capFull(t[l.k])} className={`absolute left-1/2 -translate-x-1/2 cursor-help whitespace-nowrap text-center font-mono text-[10px] leading-tight ${locked === l.k ? 'text-[#EF4444]' : 'text-slate-400'} ${i % 2 ? 'top-full mt-1' : 'bottom-full mb-1'}`}>
                                {l.label}<br />{capM(t[l.k], 1)}{locked === l.k && <><br />鎖死</>}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </figure>
    );
};

// ── Phase 4：逐年薪資總表、薪資結構、選秀權 ──
const CAP_SOURCE = '資料：Spotrac、Hoops Rumors 等公開資料（人工整理）';
const capSeasonAdd = (s, k) => { const y = +s.slice(0, 4) + k; return `${y}-${String((y + 1) % 100).padStart(2, '0')}`; };
const CAP_OPT_LABEL = { PO: '球員選項', TO: '球隊選項', ETO: '提前終止' };
const CAP_OPT_CLS = { PO: 'text-[#12A150]', TO: 'text-[#EF4444]', ETO: 'text-amber-300' };
// 表格內的縮寫金額：不畫底線（表格已經很密），滑鼠移上去一樣看得到完整金額
const CapCellAmt = ({ v }) => <span title={capFull(v)} className="cursor-help">{capM(v)}</span>;

// 逐年薪資總表：所選賽季名單 × 該季起 5 季。選項／保障用文字標記（不只靠顏色）；
// 表尾：死錢、奢侈稅薪資合計、薪資帽、奢侈稅線、奢侈稅空間（未公布門檻的賽季顯示 —）
const CapYearly = ({ doc, s, onPlayer }) => {
    const UI = window.UI, C = window.CapCalc;
    const ref = React.useRef(null);
    const cols = [0, 1, 2, 3, 4].map(k => capSeasonAdd(s, k));
    const byPid = {};
    (doc.contracts || []).forEach(c => {
        if (!cols.includes(c.season)) return;
        const e = byPid[c.playerId] = byPid[c.playerId] || { id: c.playerId, name: c.player, rows: {} };
        e.rows[c.season] = c;
    });
    const sal = (e) => e.rows[s].type === 'TWO-WAY' ? -1 : e.rows[s].salary;
    const players = Object.values(byPid).filter(e => e.rows[s]).sort((a, b) => sal(b) - sal(a));
    const pay = cols.map(x => C.payroll(doc, x));
    const thr = cols.map(x => (doc.thresholds || {})[x] || null);

    const cell = (c) => {
        if (!c) return <span className="text-slate-600">—</span>;
        if (c.type === 'TWO-WAY') return <span className="font-sans text-[12px] text-slate-400">雙向合約</span>;
        const tag = c.option ? CAP_OPT_LABEL[c.option] : c.guarantee === 'partial' ? '部分保障' : c.guarantee === 'none' ? '非保障' : null;
        const cls = c.option ? CAP_OPT_CLS[c.option] : 'text-amber-300';
        return (
            <span className="inline-flex flex-col items-end leading-tight">
                <CapCellAmt v={c.salary} />
                {tag && <span className={`font-sans text-[10px] ${cls}`}>{tag}</span>}
            </span>
        );
    };
    const csv = () => ({
        header: ['球員', '合約類型', ...cols],
        rows: [
            ...players.map(e => [e.name, e.rows[s].type, ...cols.map(x => {
                const c = e.rows[x];
                if (!c) return '';
                if (c.type === 'TWO-WAY') return '雙向合約';
                return c.salary + (c.option ? `（${CAP_OPT_LABEL[c.option]}）` : c.guarantee !== 'full' ? `（${c.guarantee === 'partial' ? '部分保障' : '非保障'}）` : '');
            })]),
            ['死錢', '', ...pay.map(p => p.deadTotal || '')],
            ['奢侈稅薪資合計', '', ...pay.map(p => p.tax)],
            ['薪資帽', '', ...thr.map(t => t ? t.cap : '')],
            ['奢侈稅線', '', ...thr.map(t => t ? t.tax : '')],
        ],
    });
    const footRow = (label, vals, cls = 'text-slate-300') => (
        <tr className="border-t border-white/[0.08]">
            <th scope="row" className="sticky left-0 z-[1] bg-[#0A1626] px-3 py-2 text-left text-[12px] font-normal text-slate-400 whitespace-nowrap">{label}</th>
            <td></td>
            {vals.map((v, i) => (
                <td key={cols[i]} className={`px-3 py-2 text-right font-mono tabular-nums whitespace-nowrap ${cls}`}>
                    {v == null ? <span className="text-slate-600">—</span> : <CapCellAmt v={v} />}
                </td>
            ))}
        </tr>
    );
    return (
        <UI.Section title="逐年薪資總表" en="Yearly Cap Sheet"
            sub={`${s} 名單往後 5 季的 cap hit。點球員名字開該球員頁。空白（—）代表那一季沒有合約（自由球員或已離隊）；選項年度照合約金額列入。`}
            right={<UI.ExportMenu title={`逐年薪資總表 ${s}`} getNode={() => ref.current} csv={csv} source={CAP_SOURCE} />}>
            <div ref={ref} className="overflow-x-auto border-t border-white/[0.08]">
                <table className="w-full text-sm border-collapse">
                    <caption className="sr-only">{s} 起逐年薪資總表</caption>
                    <thead>
                        <tr className="border-b border-white/15 text-[11px] text-slate-400">
                            <th scope="col" className="sticky left-0 z-[1] bg-[#0A1626] px-3 py-2 text-left font-normal">球員</th>
                            <th scope="col" className="px-3 py-2 text-left font-normal whitespace-nowrap">合約類型</th>
                            {cols.map(x => (
                                <th key={x} scope="col" className={`px-3 py-2 text-right font-mono font-normal whitespace-nowrap ${x === s ? 'text-slate-100' : ''}`}>{x}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {players.map(e => (
                            <tr key={e.id} className="border-b border-white/[0.06] odd:bg-white/[0.015] hover:bg-white/[0.04]">
                                <th scope="row" className="sticky left-0 z-[1] bg-[#0A1626] px-3 py-1.5 text-left font-normal">
                                    <button type="button" onClick={() => onPlayer(e, s)} title={`開啟 ${e.name} 的球員頁`}
                                        className="inline-flex min-h-[24px] items-center text-left text-[13px] text-slate-100 underline decoration-white/20 underline-offset-2 hover:decoration-[#12A150] whitespace-nowrap">
                                        {e.name}
                                    </button>
                                </th>
                                <td className="px-3 py-1.5 font-mono text-[11px] text-slate-400 whitespace-nowrap">{e.rows[s].type || '—'}</td>
                                {cols.map(x => (
                                    <td key={x} className="px-3 py-1.5 text-right font-mono tabular-nums text-slate-200 whitespace-nowrap">{cell(e.rows[x])}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        {footRow('死錢', pay.map(p => p.deadTotal || null))}
                        {footRow('奢侈稅薪資合計', pay.map(p => p.tax), 'font-bold text-slate-50')}
                        {footRow('薪資帽', thr.map(t => t ? t.cap : null), 'text-slate-400')}
                        {footRow('奢侈稅線', thr.map(t => t ? t.tax : null), 'text-slate-400')}
                        {footRow('奢侈稅空間', thr.map((t, i) => t ? t.tax - pay[i].tax : null))}
                    </tfoot>
                </table>
            </div>
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400">
                <span><span className="text-[#12A150]">球員選項</span>：球員可選擇是否執行</span>
                <span><span className="text-[#EF4444]">球隊選項</span>：球隊可選擇是否執行</span>
                <span><span className="text-amber-300">部分保障／非保障</span>：被裁時球隊不必付全額</span>
                <span>雙向合約不計入薪資</span>
            </p>
        </UI.Section>
    );
};

// 薪資結構：左＝本季每人佔奢侈稅薪資的比例；右＝往後各季已承諾總額對照薪資帽與奢侈稅線
const CapStructure = ({ doc, s }) => {
    const UI = window.UI, C = window.CapCalc;
    const p = C.payroll(doc, s);
    const items = p.std.map(c => ({ name: c.player, v: c.salary }))
        .concat(p.deadTotal ? [{ name: '死錢（已離隊球員）', v: p.deadTotal, dead: true }] : [])
        .sort((a, b) => b.v - a.v);
    const max = items.length ? items[0].v : 1;
    const rows = [0, 1, 2, 3, 4].map(k => {
        const x = capSeasonAdd(s, k);
        const pp = C.payroll(doc, x);
        return { season: x, tax: pp.tax, n: pp.std.length, t: (doc.thresholds || {})[x] || null };
    });
    const hi = Math.max(...rows.map(r => r.tax), ...rows.filter(r => r.t).map(r => r.t.apron2)) * 1.04 || 1;
    const pct = (v) => Math.max(0, Math.min(100, v / hi * 100));
    return (
        <UI.Section title="薪資結構" en="Payroll Structure"
            sub="錢花在誰身上，以及往後幾季已經承諾了多少。">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                <figure>
                    <figcaption className="mb-3 text-[12px] text-slate-400">{s} 每人佔奢侈稅薪資（<CapAmt v={p.tax} />）的比例</figcaption>
                    <ul className="space-y-1.5">
                        {items.map(it => (
                            <li key={it.name} className="grid grid-cols-[minmax(0,8.5rem)_1fr_7.5rem] items-center gap-2 text-[12px]">
                                <span className={`truncate ${it.dead ? 'text-slate-400' : 'text-slate-200'}`} title={it.name}>{it.name}</span>
                                <span className="relative h-2.5 bg-white/[0.05]">
                                    <span className={`absolute inset-y-0 left-0 ${it.dead ? 'bg-slate-500' : 'bg-[#12A150]'}`} style={{ width: (it.v / max * 100) + '%' }}></span>
                                </span>
                                <span className="text-right font-mono tabular-nums text-slate-300 whitespace-nowrap">
                                    <CapCellAmt v={it.v} /> <span className="text-slate-500">{(it.v / p.tax * 100).toFixed(1)}%</span>
                                </span>
                            </li>
                        ))}
                    </ul>
                </figure>
                <figure>
                    <figcaption className="mb-3 text-[12px] text-slate-400">往後各季已承諾的奢侈稅薪資（含選項年度與死錢）</figcaption>
                    <ul className="space-y-4">
                        {rows.map(r => (
                            <li key={r.season}>
                                <div className="mb-1 flex items-baseline justify-between text-[12px]">
                                    <span className={`font-mono ${r.season === s ? 'text-slate-100' : 'text-slate-300'}`}>{r.season}<span className="ml-2 font-sans text-slate-500">{r.n} 份合約</span></span>
                                    <span className="font-mono tabular-nums text-slate-100"><CapCellAmt v={r.tax} /></span>
                                </div>
                                <div className="relative h-3 bg-white/[0.05]">
                                    <div className="absolute inset-y-0 left-0 bg-[#C4CED2]/70" style={{ width: pct(r.tax) + '%' }}></div>
                                    {r.t && <div className="absolute -top-1 -bottom-1 w-px bg-slate-200" style={{ left: pct(r.t.cap) + '%' }} title={`薪資帽 ${capFull(r.t.cap)}`}></div>}
                                    {r.t && <div className="absolute -top-1 -bottom-1 w-0.5 bg-amber-400" style={{ left: pct(r.t.tax) + '%' }} title={`奢侈稅線 ${capFull(r.t.tax)}`}></div>}
                                </div>
                            </li>
                        ))}
                    </ul>
                    <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
                        <span className="mr-1 inline-block h-2.5 w-px bg-slate-200 align-middle"></span>白線＝薪資帽
                        <span className="ml-3 mr-1 inline-block h-2.5 w-0.5 bg-amber-400 align-middle"></span>黃線＝奢侈稅線。
                        聯盟尚未公布門檻的賽季不畫線；未來幾季還沒補滿名單，金額會隨簽約增加。
                    </p>
                </figure>
            </div>
        </UI.Section>
    );
};

// 選秀權：年份 × 首輪／次輪。狀態用文字膠囊（不只靠顏色），展開看原文條件、核對紀錄與出處
const CAP_PICK = {
    own: { label: '自有', mark: 'bg-[#12A150]', text: 'text-slate-100' },
    in: { label: '持有他隊', mark: 'bg-[#12A150]', text: 'text-slate-100' },
    out: { label: '已送出', mark: 'bg-slate-600', text: 'text-slate-400' },
    swap: { label: '互換', mark: 'bg-amber-400', text: 'text-amber-200' },
    conditional: { label: '條件式', mark: 'bg-amber-400', text: 'text-amber-200' },
    frozen: { label: '凍結', mark: 'bg-[#236192]', text: 'text-slate-100' },
};
const CapPicks = ({ doc }) => {
    const UI = window.UI;
    const picks = doc.picks || [];
    if (!picks.length) return null;
    const years = [...new Set(picks.map(p => p.year))].sort();
    const asOf = picks.map(p => p.as_of).filter(Boolean).sort().pop();
    const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return '出處'; } };
    const Entry = ({ p }) => {
        const st = CAP_PICK[p.status] || { label: p.status, mark: 'bg-slate-500', text: 'text-slate-300' };
        return (
            <div className="py-1">
                <div className="flex flex-wrap items-baseline gap-2">
                    <span className={`inline-flex shrink-0 items-center gap-1.5 text-[11px] font-medium ${st.text}`}>
                        <span aria-hidden="true" className={`h-2 w-2 ${st.mark}`}></span>{st.label}
                    </span>
                    <span className="text-[13px] leading-snug text-slate-200">{p.summary_zh}</span>
                </div>
                {(p.terms || p.verify || p.source_url) && (
                    <details className="mt-0.5">
                        <summary className="inline-flex min-h-[24px] cursor-pointer items-center text-[11px] text-slate-400 hover:text-slate-200">原文條件與出處</summary>
                        {p.terms && <p className="font-mono text-[11px] leading-relaxed text-slate-300">{p.terms}</p>}
                        {p.verify && <p className="mt-1 text-[11px] leading-relaxed text-amber-300">核對紀錄：{p.verify}</p>}
                        {p.source_url && (
                            <a href={p.source_url} target="_blank" rel="noopener noreferrer"
                                className="inline-flex min-h-[24px] items-center font-mono text-[11px] text-slate-400 underline decoration-white/20 underline-offset-2 hover:text-slate-100">
                                {hostOf(p.source_url)} ↗
                            </a>
                        )}
                    </details>
                )}
            </div>
        );
    };
    return (
        <UI.Section title="選秀權" en="Draft Picks"
            sub={`灰狼未來選秀權的目前狀態（資料日期 ${asOf || '—'}，與上方賽季選擇無關）。條件很複雜，摘要只是重點，細節請展開看原文。`}>
            <div className="overflow-x-auto border-t border-white/[0.08]">
                <table className="w-full min-w-[36rem] text-sm border-collapse">
                    <caption className="sr-only">灰狼未來選秀權</caption>
                    <thead>
                        <tr className="border-b border-white/15 text-[11px] text-slate-400">
                            <th scope="col" className="w-16 px-3 py-2 text-left font-normal">年份</th>
                            <th scope="col" className="px-3 py-2 text-left font-normal">首輪</th>
                            <th scope="col" className="px-3 py-2 text-left font-normal">次輪</th>
                        </tr>
                    </thead>
                    <tbody>
                        {years.map(y => (
                            <tr key={y} className="border-b border-white/[0.06] align-top odd:bg-white/[0.015]">
                                <th scope="row" className="px-3 py-2 text-left font-mono text-[13px] font-normal text-slate-100">{y}</th>
                                {[1, 2].map(rd => (
                                    <td key={rd} className="px-3 py-1.5">
                                        {picks.filter(p => p.year === y && p.round === rd).map((p, i) => <Entry key={i} p={p} />)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </UI.Section>
    );
};

// ── Phase 5：薪資占比 vs 貢獻占比（Sheet 的 settings.show_value＝FALSE 時整個區塊不顯示）──
// 貢獻資料一律用逐場 bundle（只含替灰狼出賽的比賽）：季末／每日快照的球員數據是「整季合併」，
// 季中轉隊的球員會混進他隊的比賽（例：2025-26 Kyle Anderson 快照 43 場、在灰狼只有 19 場），不能拿來算占比。
//   分子：有合約球員各自的 wolves_pgames_bundle（最多約 15 份，gamesData 有快取）
//   分母：球隊 wolves_games_bundle 逐場加總（上場時間＝比賽分鐘 × 5）
window.loadCapContrib = function (season, pids) {
    const cache = (window.__capContrib = window.__capContrib || {});
    const key = `${season}|${pids.slice().sort().join(',')}`;
    if (cache[key] !== undefined) return Promise.resolve(cache[key]);
    const sumG = (games, f) => games.reduce((a, g) => a + (f(g.stats || {}) || 0), 0);
    const tot = (games) => ({
        min: sumG(games, x => x.MIN), pts: sumG(games, x => x.PTS), ra: sumG(games, x => (x.REB || 0) + (x.AST || 0)),
    });
    return window.loadSeasonGames(season, 'regular', 'TEAM').then(team => {
        const tg = team.games || [];
        if (!tg.length) return null;
        const teamTot = tot(tg);
        teamTot.min *= 5;   // 球隊 MIN 是比賽分鐘（每場 48），× 5 才是全隊球員上場時間
        return Promise.all(pids.map(pid => window.loadSeasonGames(season, 'regular', 'PLAYER', pid)
            .then(r => [pid, (r.games || []).filter(g => (g.stats && g.stats.MIN) > 0)])))
            .then(list => {
                const per = {};
                list.forEach(([pid, games]) => { per[pid] = { gp: games.length, ...tot(games) }; });
                return { teamTot, per, games: tg.length, asOf: tg[tg.length - 1].date };
            });
    }).then(v => { cache[key] = v; return v; });
};

const CAP_METRICS = [
    { key: 'min', label: '上場時間', unit: '分鐘' },
    { key: 'pts', label: '得分', unit: '分' },
    { key: 'ra', label: '籃板＋助攻', unit: '次' },
];

const CapValue = ({ doc, s }) => {
    const UI = window.UI, C = window.CapCalc;
    const [data, setData] = React.useState(undefined);   // undefined=載入中, null=沒有數據
    const [err, setErr] = React.useState(null);
    const [metric, setMetric] = React.useState('min');
    const ref = React.useRef(null);
    const p = C.payroll(doc, s);
    const pids = p.std.map(c => c.playerId);
    React.useEffect(() => {
        let cancelled = false;
        setData(undefined); setErr(null);
        window.loadCapContrib(s, pids)
            .then(v => { if (!cancelled) setData(v); })
            .catch(e => {
                console.error('cap contrib fetch fail', s, e);
                if (!cancelled) { setErr(String(e.code || e.message || e)); setData(null); }
            });
        return () => { cancelled = true; };
    }, [s, pids.join(',')]);

    const m = CAP_METRICS.find(x => x.key === metric);
    const salTotal = p.std.reduce((a, c) => a + c.salary, 0);
    const conTotal = data ? data.teamTot[metric] : 0;
    const rows = data && conTotal > 0 ? p.std.map(c => {
        const r = data.per[c.playerId];
        const played = r && r.gp > 0;
        return {
            name: c.player, sal: c.salary / salTotal, con: played ? r[metric] / conTotal : null,
            why: played ? '' : '本季未替灰狼出賽（例行賽）',
        };
    }).sort((a, b) => b.sal - a.sal) : [];
    const listedCon = rows.reduce((a, r) => a + (r.con || 0), 0);
    const restCon = rows.length ? Math.max(0, 1 - listedCon) : 0;
    const maxShare = Math.max(0.0001, ...rows.map(r => Math.max(r.sal, r.con || 0)), restCon);
    const pctTxt = (v) => (v * 100).toFixed(1) + '%';
    const fmtNum = (v) => Math.round(v).toLocaleString('en-US');
    const when = data ? `${s} 例行賽 ${data.games} 場，截至 ${data.asOf}` : '';

    const csv = () => ({
        header: ['球員', '薪資占比', `${m.label}占比`, '差距（百分點）'],
        rows: [...rows.map(r => [r.name, pctTxt(r.sal), r.con == null ? r.why : pctTxt(r.con), r.con == null ? '' : ((r.con - r.sal) * 100).toFixed(1)]),
            ...(restCon > 0.0005 ? [['其他球員（雙向、季中離隊等）', '', pctTxt(restCon), '']] : [])],
    });

    return (
        <UI.Section title="薪資 × 表現" en="Pay vs. Contribution"
            sub="錢的分配和場上貢獻的分配對不對得上。這是隊內相對比較，請一併看下方的公式與限制。"
            right={<>
                <UI.Seg ariaLabel="貢獻指標" size="sm" value={metric} onChange={setMetric}
                    options={CAP_METRICS.map(x => ({ value: x.key, label: x.label }))} />
                {rows.length > 0 && <UI.ExportMenu title={`薪資占比與${m.label}占比 ${s}`} getNode={() => ref.current} csv={csv}
                    source="資料：薪資＝Spotrac 等公開資料（人工整理）；貢獻＝NBA.com 逐場數據" />}
            </>}>
            {data === undefined ? (
                <div className="py-10 text-center text-sm text-slate-500 animate-pulse">載入表現數據…</div>
            ) : err ? (
                <UI.Note tone="warn">表現數據讀取失敗：<code className="text-amber-100">{err}</code>。請稍後重新整理。</UI.Note>
            ) : !rows.length ? (
                <UI.Note>{s === window.CURRENT_SEASON ? '本季還沒有例行賽數據，開季後隔天的每日抓取完成就會出現。' : `${s} 沒有可用的例行賽季末數據。`}</UI.Note>
            ) : (
                <div ref={ref}>
                    <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400">
                        <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-2 w-3 bg-[#C4CED2]/70"></span>薪資占比</span>
                        <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-2 w-3 bg-[#12A150]"></span>{m.label}占比</span>
                        <span>右側＝貢獻占比 − 薪資占比（百分點）</span>
                    </div>
                    <ul className="divide-y divide-white/[0.06] border-y border-white/[0.08]">
                        {rows.map(r => {
                            const d = r.con == null ? null : (r.con - r.sal) * 100;
                            return (
                                <li key={r.name} className="grid grid-cols-[minmax(0,7.5rem)_1fr_3.75rem] items-center gap-3 py-2 sm:grid-cols-[minmax(0,10rem)_1fr_4.5rem]">
                                    <span className="truncate text-[13px] text-slate-200" title={r.name}>{r.name}</span>
                                    <span className="space-y-1">
                                        <span className="flex items-center gap-2">
                                            <span className="relative h-2 flex-1 bg-white/[0.04]"><span className="absolute inset-y-0 left-0 bg-[#C4CED2]/70" style={{ width: (r.sal / maxShare * 100) + '%' }}></span></span>
                                            <span className="w-12 text-right font-mono text-[11px] tabular-nums text-slate-400">{pctTxt(r.sal)}</span>
                                        </span>
                                        {r.con == null ? (
                                            <span className="block text-[11px] text-slate-500">{r.why}</span>
                                        ) : (
                                            <span className="flex items-center gap-2">
                                                <span className="relative h-2 flex-1 bg-white/[0.04]"><span className="absolute inset-y-0 left-0 bg-[#12A150]" style={{ width: (r.con / maxShare * 100) + '%' }}></span></span>
                                                <span className="w-12 text-right font-mono text-[11px] tabular-nums text-slate-200">{pctTxt(r.con)}</span>
                                            </span>
                                        )}
                                    </span>
                                    <span className={`text-right font-mono text-[13px] tabular-nums ${d == null ? 'text-slate-500' : d >= 0 ? 'text-[#12A150]' : 'text-[#EF4444]'}`}
                                        title={r.con == null ? r.why : `${m.label}占比 ${pctTxt(r.con)} − 薪資占比 ${pctTxt(r.sal)}`}>
                                        {d == null ? '—' : `${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(1)}`}
                                    </span>
                                </li>
                            );
                        })}
                        {restCon > 0.0005 && (
                            <li className="grid grid-cols-[minmax(0,7.5rem)_1fr_3.75rem] items-center gap-3 py-2 sm:grid-cols-[minmax(0,10rem)_1fr_4.5rem]">
                                <span className="text-[12px] text-slate-400">其他球員</span>
                                <span className="flex items-center gap-2">
                                    <span className="relative h-2 flex-1 bg-white/[0.04]"><span className="absolute inset-y-0 left-0 bg-slate-500" style={{ width: (restCon / maxShare * 100) + '%' }}></span></span>
                                    <span className="w-12 text-right font-mono text-[11px] tabular-nums text-slate-400">{pctTxt(restCon)}</span>
                                </span>
                                <span className="text-right text-[11px] text-slate-500">雙向、離隊</span>
                            </li>
                        )}
                    </ul>
                </div>
            )}

            {/* 公式與限制：常駐顯示、不收合，讓讀者自己判斷這組數字可信到什麼程度 */}
            <div className="mt-4 border-l-2 border-[#C4CED2]/40 pl-4 text-[12px] leading-relaxed text-slate-300">
                <p className="font-medium text-slate-100">計算公式</p>
                <p>薪資占比 ＝ 該員 cap hit ÷ 全隊標準合約 cap hit 合計（{rows.length ? <CapAmt v={salTotal} /> : '—'}；不含雙向合約與死錢）</p>
                <p>{m.label}占比 ＝ 該員替灰狼出賽的累計{m.label} ÷ 灰狼全隊的合計（{rows.length ? `${fmtNum(conTotal)} ${m.unit}` : '—'}，含雙向與季中離隊球員）</p>
                <p>只計例行賽中替灰狼出賽的比賽（NBA.com 逐場數據加總）；季中轉隊的球員只算在灰狼的部分。{metric === 'min' ? '全隊上場時間＝每場比賽分鐘數 × 5。' : ''}資料：{when || '—'}。</p>
                <p className="mt-2 font-medium text-slate-100">限制</p>
                <ul className="list-disc pl-4 text-slate-400">
                    <li>只是隊內相對比較，不代表合約在市場上值不值得。</li>
                    <li>防守、掩護、拉開空間等沒有計數的貢獻不在內，防守型球員的貢獻占比會被低估。</li>
                    <li>傷停或季中才加入的球員，出賽場次少，貢獻占比會偏低。</li>
                </ul>
            </div>
        </UI.Section>
    );
};

// 門檻限制：四層卡片（超過薪資帽／奢侈稅線／第一 apron／第二 apron）＋鎖死（hard cap）規則，條文讀 Sheet 的 rules 分頁
const CapRules = ({ doc, t, p, tier }) => {
    const UI = window.UI;
    const rulesOf = (k) => (doc.rules || []).filter(r => r.tier === k).sort((a, b) => (a.order || 0) - (b.order || 0));
    const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return '出處'; } };
    const RuleList = ({ k }) => (
        <ul className="mt-3 space-y-2">
            {rulesOf(k).map((r, i) => (
                <li key={i} className="text-[13px] leading-snug text-slate-200">
                    <span>{r.text_zh}</span>
                    {r.detail && <span className="block text-[12px] text-slate-400">{r.detail}</span>}
                    {r.source_url && (
                        <a href={r.source_url} target="_blank" rel="noopener noreferrer"
                            className="ml-1 inline-flex min-h-[24px] items-center font-mono text-[11px] text-slate-400 underline decoration-white/20 underline-offset-2 hover:text-slate-100">
                            {hostOf(r.source_url)} ↗
                        </a>
                    )}
                </li>
            ))}
        </ul>
    );
    const locked = t.hard_cap === 'apron1' || t.hard_cap === 'apron2' ? t.hard_cap : null;
    return (
        <UI.Section title="門檻限制" en="Cap Rules"
            sub="球隊薪資超過各條線之後，在簽約與交易上會受到的限制。超過的層級會累加（超過第二 apron 也同時受前面各層限制）。">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {CAP_TIERS.map(x => {
                    const line = t[x.line], pay = p[x.payroll], over = pay > line, cur = x.key === tier;
                    return (
                        <div key={x.key} className={`border p-4 ${cur ? 'border-[#12A150] bg-[#12A150]/[0.05]' : over ? 'border-white/25' : 'border-white/10'}`}>
                            <div className="flex items-baseline justify-between gap-2">
                                <h3 className="text-[15px] font-bold text-slate-50">{x.label}</h3>
                                <span className="font-mono text-[12px] text-slate-300"><CapAmt v={line} digits={1} /></span>
                            </div>
                            <div className="font-mono text-[10px] text-slate-500">{x.en}</div>
                            <div className={`mt-2 text-[12px] ${cur ? 'font-medium text-[#12A150]' : over ? 'text-slate-300' : 'text-slate-400'}`}>
                                {cur ? <>目前所在層級（超出 <CapAmt v={pay - line} />）</> : over ? <>已超過 <CapAmt v={pay - line} /></> : <>還差 <CapAmt v={line - pay} /></>}
                            </div>
                            <RuleList k={x.key} />
                        </div>
                    );
                })}
            </div>
            <div className={`mt-3 border p-4 ${locked ? 'border-[#EF4444]/60' : 'border-white/10'}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-[15px] font-bold text-slate-50">鎖死在 apron <span className="font-mono text-[11px] font-normal text-slate-500">Hard Cap</span></h3>
                    <span className="text-[12px] text-slate-300">
                        {locked ? <>本季鎖死在{locked === 'apron1' ? '第一' : '第二'} apron，距上限 <CapAmt v={t[locked] - p.apron} /></> : '本季沒有鎖死記錄'}
                    </span>
                </div>
                <p className="mt-1 text-[12px] text-slate-400">和上面的「超過」不同：鎖死是做了特定操作之後，本季任何時間都不能超過那條線。</p>
                <RuleList k="hardcap" />
            </div>
            <p className="mt-3 text-[12px] text-slate-500">條文整理自公開資料，細節以 NBA 勞資協議（CBA）原文為準。</p>
        </UI.Section>
    );
};

window.CapPage = CapPage;
