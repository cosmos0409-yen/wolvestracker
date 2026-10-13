// 刊頭：Logo + 「Wolves Ledger」字標 + 期別行（賽季·賽別·截至日期·連線狀態）＋ 右側控制項
// 控制項：賽季下拉、例行/季後（僅當季）、截至日期（僅當季）、搜尋（/）
// 手機：控制項換到第二列並可橫向捲動，不擠壓字標
const Masthead = ({
    seasonOptions, selectedSeasonKey, onSeasonChange, isHistoryMode, historyLoading, displayDate,
    seasonTypeView, onSeasonTypeChange, effectiveDate, minDate, maxDate, onDateChange,
    issueSeason, issueType, status, onStatusClick, onSearch,
}) => {
    const UI = window.UI;
    const statusEl = status === 'offline'
        ? <span className="text-[#EF4444]">● 未連線</span>
        : status === 'offseason'
            ? <span className="text-amber-400">● 休賽期</span>
            : <span className="text-[#12A150]">● 雲端即時</span>;
    return (
        <header className="border-b border-white/10">
            <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 lg:gap-6">
                <div className="flex items-center gap-3 min-w-0">
                    <img src="https://cdn.nba.com/logos/nba/1610612750/primary/L/logo.svg" alt="" className="w-10 h-10 shrink-0" />
                    <div className="min-w-0">
                        <div className="font-display text-[26px] font-bold uppercase leading-none tracking-wide text-slate-50">
                            Wolves <span className="text-[#12A150]">Ledger</span>
                        </div>
                        <button type="button" onClick={onStatusClick} title="查看連線狀態"
                            className="mt-1 font-mono text-[11px] tracking-wide text-slate-400 hover:text-slate-200 truncate max-w-full text-left">
                            {[issueSeason, issueType].filter(Boolean).join(' · ')}
                            {/* 截至日期在手機上隱藏：下一列的日期控制項已顯示，避免期別行被截斷 */}
                            <span className="hidden sm:inline">{' · '}{isHistoryMode ? '期末快照' : (effectiveDate ? `截至 ${effectiveDate}` : '')}</span>
                            <span className="mx-1.5 text-slate-600">·</span>{statusEl}
                        </button>
                    </div>
                    <button type="button" onClick={onSearch} aria-label="搜尋球員、章節或賽季"
                        className="lg:hidden ml-auto shrink-0 rounded-full border border-white/15 px-3 py-1.5 text-xs text-slate-300">
                        搜尋
                    </button>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-0 pb-1 lg:pb-0 [scrollbar-width:none]">
                    <label className="sr-only" htmlFor="season-select">賽季</label>
                    <select id="season-select" value={selectedSeasonKey} onChange={e => onSeasonChange(e.target.value)}
                        className="shrink-0 rounded-full border border-white/15 bg-[#0A1626] px-3.5 py-1.5 text-[13px] text-slate-200 focus:outline-none focus:border-[#12A150]">
                        {seasonOptions.map(opt => <option key={opt.key} value={opt.key}>{opt.label}</option>)}
                    </select>
                    {isHistoryMode ? (
                        <span className="shrink-0 rounded-full border border-white/10 px-3.5 py-1.5 font-mono text-[12px] text-slate-400">
                            {historyLoading ? '載入中…' : '期末快照'}
                        </span>
                    ) : (<>
                        <UI.Seg ariaLabel="賽別" value={seasonTypeView} onChange={onSeasonTypeChange}
                            options={[{ value: 'regular', label: '例行賽' }, { value: 'playoffs', label: '季後賽' }]} />
                        <label className="sr-only" htmlFor="asof-date">截至日期</label>
                        <input id="asof-date" type="date" value={effectiveDate} min={minDate} max={maxDate}
                            onChange={e => onDateChange(e.target.value)}
                            className="shrink-0 rounded-full border border-white/15 bg-[#0A1626] px-3.5 py-1.5 font-mono text-[12px] text-slate-200 focus:outline-none focus:border-[#12A150]" />
                    </>)}
                    <button type="button" onClick={onSearch} aria-label="搜尋球員、章節或賽季（快捷鍵 /）"
                        className="hidden lg:inline-flex shrink-0 items-center gap-2 rounded-full border border-white/15 px-3.5 py-1.5 text-[13px] text-slate-400 hover:text-slate-100 hover:border-white/30">
                        搜尋<kbd className="rounded border border-white/20 px-1.5 font-mono text-[10px] text-slate-400">/</kbd>
                    </button>
                </div>
            </div>
        </header>
    );
};

window.Masthead = Masthead;
