// PlayType 卡片元件
const PlayTypeCard = ({ type, current, prev, onClick, side }) => {
    if (!current) return null;
    const Icons = window.Icons;
    const diffPPP = prev ? (current.ppp - prev.ppp).toFixed(2) : 0;
    const isDefensive = side === 'defensive';
    let isBetter = false; let isWorse = false;
    if (prev) {
        const numDiff = parseFloat(diffPPP);
        if (isDefensive) { if (numDiff < 0) isBetter = true; else if (numDiff > 0) isWorse = true; }
        else { if (numDiff > 0) isBetter = true; else if (numDiff < 0) isWorse = true; }
    }
    let bgColor = "bg-slate-800", borderColor = "border-slate-700";
    if (prev) {
        if (isBetter) { borderColor = "border-green-500/50"; bgColor = "bg-gradient-to-br from-slate-800 to-green-900/30"; }
        else if (isWorse) { borderColor = "border-red-500/50"; bgColor = "bg-gradient-to-br from-slate-800 to-red-900/30"; }
    }
    return (
        <div onClick={() => onClick({ type: 'playtype', id: type })} className={`p-4 rounded-xl border ${borderColor} ${bgColor} shadow-lg relative overflow-hidden cursor-pointer hover:scale-[1.02] transition-transform group`}>
            <div className="absolute top-0 right-0 p-4 opacity-5 text-slate-400 font-black text-4xl pointer-events-none select-none">{type.substring(0, 2)}</div>
            <div className="flex justify-between items-start mb-2 relative z-10">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider truncate" title={type}>{type}</h3>
                <div className="text-slate-500 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">詳情 <Icons.ExternalLink className="w-3 h-3" /></div>
            </div>
            <div className="flex items-baseline gap-2 mb-4 relative z-10">
                <span className={`text-3xl font-extrabold ${isBetter ? 'text-green-400' : isWorse ? 'text-red-400' : 'text-white'}`}>{current.ppp}</span>
                <span className="text-xs text-slate-500 font-medium">PPP</span>
                {prev && (<div className={`flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ml-auto ${isBetter ? 'bg-green-500/20 text-green-400' : isWorse ? 'bg-red-500/20 text-red-400' : 'bg-slate-700 text-slate-400'}`}>{isBetter ? <Icons.ArrowUp className="w-3 h-3 mr-1" /> : isWorse ? <Icons.ArrowDown className="w-3 h-3 mr-1" /> : <Icons.Minus className="w-3 h-3 mr-1" />} {Math.abs(diffPPP)}</div>)}
            </div>
            <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-[10px] border-t border-slate-700/50 pt-3 relative z-10 bg-slate-900/30 rounded p-2">
                <window.TrendValue label="Percentile" value={current.percentile} prevValue={prev?.percentile} unit="th" />
                <window.TrendValue label="FG%" value={current.fgPct} prevValue={prev?.fgPct} unit="%" reverseColor={isDefensive} />
            </div>
        </div>
    );
};

window.PlayTypeCard = PlayTypeCard;
