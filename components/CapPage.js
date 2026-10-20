// 薪資頁（Cap Sheet）：網址 #cap[&s=賽季]
// 資料：wolves_salary/main 單一 doc（scripts/sync_salary.py 由 Google Sheet 同步，欄位名沿用 Sheet 欄名）
// 計算只在這裡做（兩種總額、各門檻空間、奢侈稅、所在層級）；Python 端只檢查格式，計算邏輯只放一處
// 兩種總額（2024-25、2025-26 用 Spotrac 數字驗證過，逐元相符）：
//   奢侈稅薪資 = Σ 標準合約 cap hit（含 likely incentives）＋ 死錢；薪資帽空間、奢侈稅都用它
//   apron 薪資 = 奢侈稅薪資 ＋ Σ unlikely incentives；判定第一／第二 apron 用它
// props：season（網址 s=，空＝薪資當季）、onSeason(season|'')
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

const CapPage = ({ season, onSeason }) => {
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

    const recon = [];
    if (t.ref_tax_total != null && Math.abs(t.ref_tax_total - p.tax) > 1) recon.push(`奢侈稅薪資與參考值（${capFull(t.ref_tax_total)}）相差 ${capFull(t.ref_tax_total - p.tax)}`);
    if (t.ref_apron_total != null && Math.abs(t.ref_apron_total - p.apron) > 1) recon.push(`apron 薪資與參考值（${capFull(t.ref_apron_total)}）相差 ${capFull(t.ref_apron_total - p.apron)}`);

    return (
        <div className="space-y-10 pb-6">
            <UI.Section title="薪資與奢侈稅" en="Cap Sheet"
                sub={`${s}${isCurrent ? '（本季）' : '（季末名單）'}・資料最後同步 ${syncDate || '—'}・人工整理自 Spotrac、Hoops Rumors 等公開資料`}
                right={<UI.Seg ariaLabel="薪資賽季" size="sm" value={s}
                    onChange={v => onSeason(v === defaultSeason ? '' : v)}
                    options={seasons.map(x => ({ value: x, label: x }))} />}>

                <div className="mb-4 flex flex-wrap items-center gap-2 text-[13px]">
                    <span className={`rounded-full border px-3 py-1 ${CAP_TIER_CHIP[tier]}`}>目前層級：{CAP_TIER_LABEL[tier]}</span>
                    {(t.hard_cap === 'apron1' || t.hard_cap === 'apron2') && (
                        <span className="rounded-full border border-[#EF4444]/60 bg-[#EF4444]/10 px-3 py-1 text-slate-100"
                            title="hard cap：做了特定操作後，本季任何時間都不能超過這條線">
                            本季鎖死在{t.hard_cap === 'apron1' ? '第一' : '第二'} apron（hard cap）
                            {t.hard_cap_reason && <span className="text-slate-300">：{t.hard_cap_reason}</span>}
                            <span className="ml-1 font-mono text-[12px] text-slate-300">距上限 <CapAmt v={t[t.hard_cap] - p.apron} /></span>
                        </span>
                    )}
                    <span className={`rounded-full border px-3 py-1 ${repeaterAuto ? 'border-[#EF4444]/60 bg-[#EF4444]/10 text-slate-100' : 'border-white/20 text-slate-200'}`}
                        title="累犯＝前 4 季有 3 季繳奢侈稅；依繳稅紀錄自動判定">
                        奢侈稅率：{rep.status === 'repeater' ? '累犯稅率' : rep.status === 'normal' ? '一般稅率（非累犯）' : '無法判定（繳稅紀錄不足）'}
                    </span>
                    {!isCurrent && t.apron_final && t.apron_final !== tier && (
                        <span className="text-[12px] text-amber-300">Sheet 記錄的季末層級為「{CAP_TIER_LABEL[t.apron_final]}」，與本頁加總不同</span>
                    )}
                </div>

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

                <div className="mt-2">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-[15px] font-bold text-slate-100">奢侈稅估算 <span className="font-mono text-[11px] font-normal text-slate-500">Luxury Tax</span></h3>
                        <span className="inline-flex items-center gap-2">
                            {whatIf && <span className="text-[12px] text-amber-300">試算中（判定為{repeaterAuto ? '累犯' : '一般'}稅率）</span>}
                            <UI.Seg ariaLabel="稅率" size="sm" value={repeater ? 'r' : 'n'}
                                onChange={v => setRepeaterBySeason(m => ({ ...m, [s]: v === 'r' }))}
                                options={[{ value: 'n', label: '一般稅率' }, { value: 'r', label: '累犯稅率' }]} />
                        </span>
                    </div>
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
                        累犯稅率是另一套更高的累進稅率，前 4 季有 3 季繳稅的球隊適用；本頁依繳稅紀錄自動判定，右上可切換試算。
                        這是估算：實際以例行賽最後一天的薪資計算，季中交易按比例分攤、獎金是否達成、cap hold 都沒有計入。
                    </p>
                </div>
            </UI.Section>

            <CapRules doc={doc} t={t} p={p} tier={tier} />
        </div>
    );
};

const CAP_TIER_LABEL = { below_cap: '低於薪資帽', cap: '超過薪資帽', tax: '超過奢侈稅線', apron1: '超過第一 apron', apron2: '超過第二 apron' };
const CAP_TIER_CHIP = {
    below_cap: 'border-white/20 text-slate-200',
    cap: 'border-white/30 text-slate-100',
    tax: 'border-amber-400/60 bg-amber-400/10 text-slate-100',
    apron1: 'border-amber-400/60 bg-amber-400/10 text-slate-100',
    apron2: 'border-[#EF4444]/60 bg-[#EF4444]/10 text-slate-100',
};
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
    const chip = (w) => w.paid === true ? 'border-amber-400/60 bg-amber-400/10 text-slate-100'
        : w.paid === false ? 'border-white/15 text-slate-300' : 'border-dashed border-white/20 text-slate-500';
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
            <div className="mt-2 flex flex-wrap gap-2">
                {rep.win.map(w => (
                    <span key={w.season} title={w.note || ''} className={`rounded-full border px-3 py-1 font-mono text-[12px] ${chip(w)}`}>
                        {w.season} {w.paid === true ? '繳稅' : w.paid === false ? '未繳' : '無紀錄'}
                    </span>
                ))}
            </div>
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
