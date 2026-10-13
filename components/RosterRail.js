// 頭像列：「全隊」＋ 球員頭像 chips（橫向捲動），取代舊的左側欄球員名單
// players：已依該快照輪換強度排序（App.availablePlayers）；playerIdOf(name) 取頭像用的 PlayerID
// missing：在 2026-27 名冊上、但所選賽季沒有數據的人 → 淡色 chips，點擊探測最近有資料的賽季
const RosterRail = ({ viewMode, selectedPlayer, players, playerIdOf, tagOf, onTeam, onPlayer, missing, probing, onProbe, probeMsg }) => {
    const chip = 'flex shrink-0 items-center gap-2 rounded-full border py-1 pr-3.5 text-[13px] whitespace-nowrap transition-colors';
    const on = 'border-[#12A150] bg-[#12A150]/10 text-slate-50';
    const off = 'border-transparent text-slate-400 hover:text-slate-100 hover:bg-white/[0.04]';
    return (
        <nav aria-label="球隊與球員" className="border-b border-white/10">
            <div className="max-w-7xl mx-auto px-4 md:px-6">
                <div className="flex items-center gap-1 overflow-x-auto py-2.5 -mx-1 px-1 [scrollbar-width:thin]">
                    <button type="button" aria-pressed={viewMode === 'TEAM'} onClick={onTeam}
                        className={`${chip} pl-1 ${viewMode === 'TEAM' ? on : off}`}>
                        <img src="https://cdn.nba.com/logos/nba/1610612750/primary/L/logo.svg" alt="" className="h-7 w-7 rounded-full bg-[#0C2340] p-0.5" />
                        全隊
                    </button>
                    <span className="mx-1 h-5 w-px shrink-0 bg-white/10" aria-hidden="true"></span>
                    {players.length === 0 && <span className="shrink-0 whitespace-nowrap px-2 text-xs text-slate-500">當日無球員數據</span>}
                    {players.map(name => {
                        const active = viewMode === 'PLAYER' && selectedPlayer === name;
                        const tag = tagOf(name);
                        return (
                            <button key={name} type="button" aria-pressed={active} onClick={() => onPlayer(name)}
                                className={`${chip} pl-1 ${active ? on : off}`}>
                                <img src={`https://cdn.nba.com/headshots/nba/latest/260x190/${playerIdOf(name)}.png`} alt="" loading="lazy"
                                    onError={(e) => { e.target.style.visibility = 'hidden'; }}
                                    className="h-7 w-7 rounded-full bg-white/[0.06] object-cover object-top" />
                                {name}
                                {tag && <span className="font-mono text-[10px] text-amber-400/80">{tag}</span>}
                            </button>
                        );
                    })}
                    {missing.length > 0 && (<>
                        <span className="mx-1 h-5 w-px shrink-0 bg-white/10" aria-hidden="true"></span>
                        <span className="shrink-0 px-1 text-[11px] text-slate-500" title="在 2026-27 名冊上，但所選賽季沒有數據；點擊查最近一季">本季無數據</span>
                        {missing.map(name => (
                            <button key={name} type="button" disabled={!!probing} onClick={() => onProbe(name)}
                                className={`${chip} pl-3 border-dashed border-white/10 text-slate-500 hover:text-slate-300 disabled:opacity-40`}>
                                {name}
                                {probing === name && <span className="text-[10px] text-[#12A150]">查詢中…</span>}
                            </button>
                        ))}
                    </>)}
                </div>
                {probeMsg && (
                    <p className="mb-2.5 px-3 py-1.5 text-[12px] leading-relaxed border border-amber-500/30 bg-amber-500/10 text-amber-300">{probeMsg}</p>
                )}
            </div>
        </nav>
    );
};

window.RosterRail = RosterRail;
