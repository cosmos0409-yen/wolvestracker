// 單場頁 Playtype 分頁（全隊）：網址 #game=日期&tab=pt
// 資料：wolves_team_games/{date}.playtype（後端 nba_common.split_game_playtypes 由「賽前最後一份、賽後第一份」每日快照的
//   Synergy 整數總量相減）：{ ok, n, preGP, snaps, off: [{ t, poss, pts, fgm, fga, prePoss, prePts }], def: […] }；
//   拆不開的場次（兩場合在一份快照裡）＝{ ok: false }。欄位名前後端一起改（tests/py/test_contracts.py 有對帳）
// window.GamePT：純計算＋引用項目（Node 測 tests/js/gamept.test.js）；window.GamePlaytypeSection：畫面
(function () {
    const MIN_POSS = 5;   // 本場回合數少於此數：不判好壞（不上色、整列變淡），「整組加入」也不收
    const r2 = (v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : null);
    const f2 = (v) => (typeof v === 'number' ? v.toFixed(2) : '—');
    const f1 = (v) => (typeof v === 'number' ? v.toFixed(1) : '—');

    // side：'offensive'／'defensive'。PPP 與差值以兩位小數計（差值＝顯示的兩個數相減，避免畫面上對不起來）
    const derive = (pt, side) => {
        if (!pt || !pt.ok) return null;
        const def = side === 'defensive';
        const src = (def ? pt.def : pt.off) || [];
        const sum = (k) => src.reduce((a, r) => a + (r[k] || 0), 0);
        const poss = sum('poss'), pts = sum('pts'), prePoss = sum('prePoss'), prePts = sum('prePts');
        const preGP = pt.preGP || 0;
        const judge = (diff, few) => {
            const on = !few && typeof diff === 'number' && diff !== 0;
            const good = on && (def ? diff < 0 : diff > 0);
            return { good, bad: on && !good };
        };
        const rows = src.map(r => {
            const ppp = r.poss > 0 ? r2(r.pts / r.poss) : null;
            const prePpp = r.prePoss > 0 ? r2(r.prePts / r.prePoss) : null;
            const diff = ppp != null && prePpp != null ? r2(ppp - prePpp) : null;
            const few = r.poss < MIN_POSS;
            return { ...r, ppp, prePpp, diff, few, ...judge(diff, few),
                freq: poss > 0 ? r.poss / poss * 100 : null,
                preFreq: prePoss > 0 ? r.prePoss / prePoss * 100 : null,
                prePossPG: preGP ? r.prePoss / preGP : null };
        }).sort((a, b) => b.poss - a.poss);
        const ppp = poss > 0 ? r2(pts / poss) : null, prePpp = prePoss > 0 ? r2(prePts / prePoss) : null;
        const diff = ppp != null && prePpp != null ? r2(ppp - prePpp) : null;
        return { def, rows, preGP, n: pt.n,
            sum: { poss, pts, ppp, prePpp, diff, ...judge(diff, false), prePossPG: preGP ? prePoss / preGP : null, top: rows[0] || null } };
    };

    // 引用：一列＝成對指標「回合數／每回合得分」（賽前季均 → 本場），情境取 window.CiteCtx（單場頁設的比分情境）；
    // 主體固定「灰狼全隊」（單場頁展開球員時 CiteCtx.subject 是球員）。pre＝類型名，quoteFormat 的 pairName 用它只寫一次類型名
    const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const rowQuote = (row, side) => {
        const def = side === 'defensive';
        const pre = `${def ? '防守' : ''}${window.ptName(row.t)}`;
        const mk = (label, en, gkey, a, b, better) => Object.assign(window.Quote.make({
            kind: 'compare', sep: '→', label: pre + label, en, gkey, asOf: 'none', better, pre,
            values: [{ tag: '賽前季均', value: a }, { tag: '本場', value: b }] }), { id: uid(), subject: '灰狼全隊' });
        const parts = [
            mk('回合數', `${row.t} Poss`, 'POSS', f1(row.prePossPG), String(row.poss), null),
            mk(def ? '每回合失分' : '每回合得分', `${row.t} PPP`, 'PPP', f2(row.prePpp), f2(row.ppp), def ? 'low' : 'high'),
        ];
        return { kind: 'compare', subject: '灰狼全隊', context: parts[0].context, sep: '→', parts };
    };

    window.GamePT = { MIN_POSS, derive, rowQuote };

    const tone = (o) => (o.good ? 'text-[#12A150]' : o.bad ? 'text-[#EF4444]' : 'text-slate-500');
    const signed = (v) => (typeof v !== 'number' ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(v).toFixed(2)}`);

    // pt：單場文件的 playtype；pts／oppPts：實際比分（沒有 box 時 null，頁尾就不比對）
    window.GamePlaytypeSection = ({ pt, pts, oppPts }) => {
        const UI = window.UI;
        const [side, setSide] = React.useState('offensive');
        if (!pt || !pt.ok) {
            return (
                <UI.Section title="本場 Playtype" en="Play Types" accent="green">
                    <UI.Note>因資料來源欠缺而無資料</UI.Note>
                </UI.Section>
            );
        }
        const d = derive(pt, side), S = d.sum, def = d.def;
        const real = def ? oppPts : pts;
        const addAll = () => {
            const ok = d.rows.filter(r => !r.few);
            const n = ok.filter(r => window.Quote.add(rowQuote(r, side)).added).length;
            UI.toast(n ? `已加入引用籃 ${n} 項${n < ok.length ? `（${ok.length - n} 項已在籃子裡）` : ''}` : '這組都已在引用籃裡');
        };
        const cells = [
            [def ? '對手回合數' : '回合數', S.poss, `賽前季均 ${f1(S.prePossPG)}`],
            [def ? '失分（Synergy）' : '得分（Synergy）', S.pts, typeof real === 'number' ? (def ? `實際失分 ${real}（不含空切、其他）` : `實際得分 ${real}`) : ''],
            [def ? '每回合失分' : '每回合得分', <>{f2(S.ppp)}<span className={`ml-2 font-mono text-[12px] font-normal ${tone(S)}`}>{signed(S.diff)}</span></>, `賽前季均 ${f2(S.prePpp)}`],
            ['最常見', S.top ? <span className="text-[20px]">{window.ptName(S.top.t)}</span> : '—',
                S.top ? `${f1(S.top.freq)}%（季均 ${f1(S.top.preFreq)}%）` : ''],
        ];
        const gap = typeof real === 'number' ? S.pts - real : null;
        const th = 'px-2 py-2 font-mono text-[10px] font-normal text-slate-500 whitespace-nowrap';
        const td = 'px-2 py-1.5 text-right font-mono tabular-nums whitespace-nowrap';
        return (
            <UI.Section title="本場 Playtype" en="Play Types" accent="green"
                sub={`Synergy 戰術分類（全隊）；由賽前、賽後兩份每日快照相減還原，比較基準＝賽前季均${d.preGP ? `（第 1～${d.preGP} 場）` : '（本季第一場，沒有季均）'}`}
                right={<UI.Seg ariaLabel="Playtype 攻守" size="sm" value={side} onChange={setSide} options={UI.SIDE_OPTIONS} />}>
                <div className="grid grid-cols-2 border-l border-t border-white/[0.08] sm:grid-cols-4">
                    {cells.map(([l, v, n]) => (
                        <div key={l} className="min-w-0 border-b border-r border-white/[0.08] px-3 pb-2.5 pt-2">
                            <div className="whitespace-nowrap text-[11px] text-slate-300">{l}</div>
                            <div className="mt-1 whitespace-nowrap font-display text-[26px] font-semibold leading-none tabular-nums text-slate-50">{v}</div>
                            {n && <div className="mt-1.5 truncate font-mono text-[10px] text-slate-500">{n}</div>}
                        </div>
                    ))}
                </div>
                <div className="mt-4 flex items-center justify-between gap-2 border-b border-white/10 pb-1 font-mono text-[10px] tracking-[0.14em] text-slate-500">
                    <span className="whitespace-nowrap">{def ? `防守 ${d.rows.length} 類` : `進攻 ${d.rows.length} 類`} · 依本場回合數排序</span>
                    <button type="button" onClick={addAll} title={`把回合數 ≥ ${MIN_POSS} 的類型（回合數／${def ? '每回合失分' : '每回合得分'}，賽前季均 → 本場）加入引用籃`}
                        className="inline-flex min-h-[24px] shrink-0 items-center whitespace-nowrap rounded-full border border-white/15 px-2.5 font-sans text-[11px] tracking-normal text-slate-300 hover:border-[#12A150] hover:text-[#12A150]">＋ 整組加入</button>
                </div>
                <table className="w-full border-collapse text-[13px]">
                    <caption className="sr-only">本場 Playtype（{def ? '防守端' : '進攻端'}）</caption>
                    <thead><tr className="border-b border-white/15">
                        <th scope="col" className={`${th} text-left`}>類型</th>
                        <th scope="col" className={`${th} text-right`}>回合數</th>
                        <th scope="col" className={`${th} hidden text-right sm:table-cell`}>頻率（刻度＝季均）</th>
                        <th scope="col" className={`${th} hidden text-right sm:table-cell`}>{def ? '失分' : '得分'}</th>
                        <th scope="col" className={`${th} hidden text-right sm:table-cell`}>FGM-FGA</th>
                        <th scope="col" className={`${th} text-right`}>PPP</th>
                        <th scope="col" className={`${th} hidden text-right sm:table-cell`}>賽前季均</th>
                        <th scope="col" className={`${th} text-right`}><span className="sm:hidden">vs 季均</span><span className="hidden sm:inline">差</span></th>
                    </tr></thead>
                    <tbody>{d.rows.map(r => (
                        <tr key={r.t} className={`border-b border-white/[0.06] ${r.few ? 'text-slate-400' : 'text-slate-200'}`}>
                            <th scope="row" className="px-2 py-1.5 text-left font-normal">
                                <span className="whitespace-nowrap">{window.ptName(r.t)}</span>
                                <span className="ml-1.5 hidden font-mono text-[10px] text-slate-500 sm:inline">{r.t}</span>
                                <span className="block font-mono text-[10px] text-slate-500 sm:hidden">{f1(r.freq)}%</span>
                            </th>
                            <td className={td}>{r.poss}</td>
                            <td className={`${td} hidden sm:table-cell`}>
                                <span className="flex items-center justify-end gap-2">
                                    <span className="relative h-[7px] w-[120px] bg-white/[0.06]">
                                        <i className="absolute inset-y-0 left-0 block bg-[#12A150]" style={{ width: `${Math.min(100, Math.max(0, r.freq || 0) / 40 * 100)}%` }}></i>
                                        {typeof r.preFreq === 'number' && <u className="absolute -inset-y-1 block w-0.5 bg-[#C4CED2]" style={{ left: `${Math.min(100, r.preFreq / 40 * 100)}%` }}></u>}
                                    </span>
                                    <span className="w-11 text-right">{f1(r.freq)}%</span>
                                </span>
                            </td>
                            <td className={`${td} hidden sm:table-cell`}>{r.pts}</td>
                            <td className={`${td} hidden sm:table-cell`}>{r.fgm}-{r.fga}</td>
                            <td className={td}>
                                {f2(r.ppp)}
                                {/* 逐列「?」只在桌面：手機用「整組加入」 */}
                                <span className="hidden sm:inline-flex"><UI.Info k="PPP" align="right" quote={() => rowQuote(r, side)}
                                    cite={() => window.Quote.render([rowQuote(r, side)], { ...window.Quote.opts(), header: 'none', asOfNote: false, source: false })} /></span>
                            </td>
                            <td className={`${td} hidden text-slate-500 sm:table-cell`}>{f2(r.prePpp)}</td>
                            <td className={`${td} ${tone(r)}`}>{signed(r.diff)}</td>
                        </tr>
                    ))}</tbody>
                </table>
                <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                    {def ? `防守端沒有空切、其他兩類（NBA 不提供），失分合計 ${S.pts}${typeof real === 'number' ? ` 會比實際失分 ${real} 少` : ''}。`
                        : gap == null ? '' : gap === 0 ? `得分合計 ${S.pts}，與實際得分一致。`
                        : `得分合計 ${S.pts}，與實際得分 ${real} 差 ${gap > 0 ? '+' : '−'}${Math.abs(gap)}（Synergy 標記與官方比分偶有幾分落差）。`}
                    綠／紅＝每回合{def ? '失分' : '得分'}優於／差於賽前季均；回合數少於 {MIN_POSS} 的列不上色。百分位、聯盟名次只有整季才有意義，單場不顯示。NBA 偶爾會事後修正前幾場的標記，單場數字可能差 1～2 個回合。
                </p>
            </UI.Section>
        );
    };
})();
