// PlayType 卡片元件：PPP 大字 + 百分位色階條（Synergy PERCENTILE）+ FG% / 使用率 / 每場球權
// 漲跌比對前一份快照；防守面 PPP 與 FG% 越低越好（betterIsLarger=false），百分位一律越高越好
const PlayTypeCard = ({ type, current, prev, onClick, side }) => {
    if (!current) return null;
    const UI = window.UI;
    const isDefensive = side === 'defensive';
    const num = (v) => (typeof v === 'number' ? v : null);
    // NBA 在部分快照（例：2025-26 球員季後賽 06-15）的 POSS_PCT 全回 0。有球權卻 0% 不可能是真值，
    // 視為「未提供」顯示「—」。不自行用 possTotal 推算：NBA 不列低球權類型，總和偏少、推算值會失真
    const freqMissing = current.freq === 0 && (current.possTotal > 0 || current.poss > 0);
    const freq = freqMissing ? null : num(current.freq);
    return (
        <div onClick={() => onClick({ type: 'playtype', id: type })}
            className="group p-4 border border-white/[0.08] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04] transition-colors cursor-pointer min-w-0">
            <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-display text-[15px] font-semibold uppercase tracking-wide text-slate-200 truncate" title={type}>{type}</h3>
                <span className="hidden sm:inline shrink-0 font-mono text-[10px] text-slate-500 group-hover:text-[#12A150] transition-colors">走勢 →</span>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
                <span className="font-display text-[34px] font-semibold leading-none tabular-nums text-slate-50">{current.ppp}</span>
                <span className="font-mono text-[10px] text-slate-500">PPP</span>
                <span className="ml-auto"><UI.Delta value={current.ppp} prevValue={prev?.ppp} betterIsLarger={!isDefensive} digits={2} /></span>
            </div>
            <UI.PctBar value={num(current.percentile)} label="PR" />
            <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-white/[0.08] pt-2.5">
                <div className="min-w-0">
                    <dt className="font-mono text-[10px] text-slate-500">FG%</dt>
                    <dd className="flex items-baseline gap-1 font-mono text-[12px] tabular-nums text-slate-200">
                        {num(current.fgPct) != null ? current.fgPct + '%' : '—'}
                    </dd>
                    <UI.Delta value={current.fgPct} prevValue={prev?.fgPct} unit="%" betterIsLarger={!isDefensive} />
                </div>
                <div className="min-w-0">
                    <dt className="font-mono text-[10px] text-slate-500" title="此類型佔全部球權的比例">Freq</dt>
                    <dd className={`font-mono text-[12px] tabular-nums ${freq != null ? 'text-slate-200' : 'text-slate-600'}`}
                        title={freqMissing ? 'NBA 未提供此快照的使用率（POSS_PCT 回傳 0）' : undefined}>{freq != null ? freq + '%' : '—'}</dd>
                </div>
                <div className="min-w-0">
                    <dt className="font-mono text-[10px] text-slate-500" title="每場球權數">Poss/G</dt>
                    <dd className="font-mono text-[12px] tabular-nums text-slate-200">{num(current.poss) != null ? current.poss : '—'}</dd>
                </div>
            </dl>
        </div>
    );
};

window.PlayTypeCard = PlayTypeCard;
