// 刊頭：Logo + 「Wolves Ledger」字標 + 期別行（賽季·賽別·截至日期·連線狀態）＋ 右側控制項
// 控制項：賽季下拉（只列年份）、例行/季後（常駐，歷史賽季也能切）、截至日期（僅當季）、最新一場、薪資、搜尋（/）
// 單場頁／薪資頁是獨立整頁：期別行改顯示頁名，並隱藏賽季／賽別／日期（避免刊頭寫的賽季和內容對不上）
// 手機：控制項換到第二列並可橫向捲動，不擠壓字標
const Masthead = ({
    yearOptions, viewYear, onYearChange, isHistoryMode, historyLoading, displayDate,
    viewType, onTypeChange, effectiveDate, minDate, maxDate, onDateChange,
    issueSeason, issueType, status, onStatusClick, onSearch, onCopyLink,
    latestGame, onGames, inGame, gameDate, inCap, onCap, playoffsAvailable = true,
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
                            className="-mb-1 py-1 font-mono text-[11px] tracking-wide text-slate-400 hover:text-slate-200 truncate max-w-full text-left">
                            {inCap ? '薪資 · Cap Sheet' : inGame ? `單場 · ${gameDate || ''}` : [issueSeason, issueType].filter(Boolean).join(' · ')}
                            {/* 截至日期在手機上隱藏：下一列的日期控制項已顯示，避免期別行被截斷 */}
                            {!inCap && !inGame && <span className="hidden sm:inline">{' · '}{isHistoryMode ? '期末快照' : (effectiveDate ? `截至 ${effectiveDate}` : '')}</span>}
                            <span className="mx-1.5 text-slate-600">·</span>{statusEl}
                        </button>
                    </div>
                    <button type="button" onClick={onSearch} aria-label="搜尋球員、章節或賽季"
                        className="lg:hidden ml-auto shrink-0 rounded-full border border-white/15 px-3 py-1.5 text-xs text-slate-300">
                        搜尋
                    </button>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-0 pb-1 lg:pb-0 [scrollbar-width:none]">
                    {/* 主畫面的賽季／賽別／日期：薪資頁有自己的賽季選單、單場頁只屬於那一場，都隱藏 */}
                    {!inCap && !inGame && (<>
                    <label className="sr-only" htmlFor="season-select">賽季</label>
                    <select id="season-select" value={viewYear} onChange={e => onYearChange(e.target.value)}
                        className="shrink-0 rounded-full border border-white/15 bg-[#0A1626] px-3.5 py-1.5 text-[13px] text-slate-200 focus:outline-none focus:border-[#12A150]">
                        {yearOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                    <UI.Seg ariaLabel="賽別" value={viewType} onChange={onTypeChange}
                        options={[{ value: 'regular', label: '例行賽' },
                            { value: 'playoffs', label: '季後賽', disabled: !playoffsAvailable && viewType !== 'playoffs',
                              title: playoffsAvailable ? undefined : `${issueSeason || '本季'} 尚無季後賽資料` }]} />
                    {/* 歷史賽季沒有日期（期末快照，已寫在期別行）；不放假膠囊，只在載入中給純文字 */}
                    {isHistoryMode ? (
                        historyLoading && <span className="shrink-0 px-1 font-mono text-[12px] text-slate-400">載入中…</span>
                    ) : (<>
                        <label className="sr-only" htmlFor="asof-date">截至日期</label>
                        {/* 只有一天快照時（min＝max）停用，避免看起來能選卻只有一個選項 */}
                        <input id="asof-date" type="date" value={effectiveDate} min={minDate} max={maxDate}
                            onChange={e => onDateChange(e.target.value)} disabled={!!minDate && minDate === maxDate}
                            title={minDate && minDate === maxDate ? '本季目前只有一天的快照' : undefined}
                            className="shrink-0 rounded-full border border-white/15 bg-[#0A1626] px-3.5 py-1.5 font-mono text-[12px] text-slate-200 focus:outline-none focus:border-[#12A150] disabled:cursor-not-allowed disabled:border-white/10 disabled:text-slate-500" />
                    </>)}
                    </>)}
                    {/* 最新一場：開最新一場的單場頁（Game Center）；按鈕上直接標日期／對手，不必滑過才知道去哪 */}
                    <button type="button" onClick={onGames} disabled={!latestGame}
                        title={latestGame ? `最新一場：${latestGame.date} ${latestGame.matchup} ${latestGame.wl}` : '目前賽別沒有比賽資料'}
                        className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] ${inGame ? 'border-[#12A150] bg-[#12A150]/10 text-slate-50' : latestGame ? 'border-white/15 text-slate-400 hover:text-slate-100 hover:border-white/30' : 'border-white/10 text-slate-600 cursor-not-allowed'}`}>
                        最新一場
                        {latestGame && <span className="ml-1.5 font-mono text-[11px] text-slate-500">{latestGame.date.slice(5).replace('-', '/')} {latestGame.matchup.replace(/^MIN\s*/, '')}</span>}
                    </button>
                    {/* 薪資：開薪資頁（#cap） */}
                    <button type="button" onClick={onCap} title="薪資結構、奢侈稅與門檻（Cap Sheet）"
                        className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] ${inCap ? 'border-[#12A150] bg-[#12A150]/10 text-slate-50' : 'border-white/15 text-slate-400 hover:text-slate-100 hover:border-white/30'}`}>
                        薪資
                    </button>
                    <button type="button" onClick={onCopyLink} title="網址記住目前畫面（球員、章節、賽季、日期、攻守），貼到筆記裡可回到同一畫面"
                        className="shrink-0 rounded-full border border-white/15 px-3.5 py-1.5 text-[13px] text-slate-400 hover:text-slate-100 hover:border-white/30">
                        複製連結
                    </button>
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
