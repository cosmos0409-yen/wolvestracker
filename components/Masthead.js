// 刊頭：Logo + 「Wolves Ledger」字標 + 期別行（賽季·賽別·截至日期·連線狀態）＋ 右側控制項
// 控制項：賽季下拉（只列年份）、例行/季後（常駐，歷史賽季也能切）、賽程月曆（GameCalendar）、對戰、薪資、搜尋（/）
// 時光機（截至日期）在身分列 IdentityBar：它影響所有章節，放每章都看得到的地方；期別行仍顯示「截至 日期」
// 單場頁／薪資頁／對戰是獨立整頁：期別行改顯示頁名，並隱藏賽季／賽別／日期（避免刊頭寫的賽季和內容對不上）
// 手機：控制項換到第二列並可橫向捲動，不擠壓字標
const Masthead = ({
    yearOptions, viewYear, onYearChange, isHistoryMode, historyLoading, displayDate,
    viewType, onTypeChange, effectiveDate,
    issueSeason, issueType, status, onStatusClick, onSearch, onCopyLink,
    schedule, scheduleSeason, onPickGame, inGame, gameDate, inCap, onCap, inVs, onVs, playoffsAvailable = true,
}) => {
    const UI = window.UI;
    const ownPage = inCap || inGame || inVs;   // 獨立整頁：不顯示主畫面的賽季／賽別／日期
    const pill = (on) => `shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] ${on ? 'border-[#12A150] bg-[#12A150]/10 text-slate-50' : 'border-white/15 text-slate-400 hover:text-slate-100 hover:border-white/30'}`;
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
                            {inCap ? '薪資 · Cap Sheet' : inVs ? '對戰分析 · Matchups' : inGame ? `單場 · ${gameDate || ''}` : [issueSeason, issueType].filter(Boolean).join(' · ')}
                            {/* 截至日期在手機上隱藏：身分列的時光機已顯示，避免期別行被截斷 */}
                            {!ownPage && <span className="hidden sm:inline">{' · '}{isHistoryMode ? '期末快照' : (effectiveDate ? `截至 ${effectiveDate}` : '')}</span>}
                            <span className="mx-1.5 text-slate-600">·</span>{statusEl}
                        </button>
                    </div>
                    <button type="button" onClick={onSearch} aria-label="搜尋球員、章節或賽季"
                        className="lg:hidden ml-auto shrink-0 rounded-full border border-white/15 px-3 py-1.5 text-xs text-slate-300">
                        搜尋
                    </button>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-0 pb-1 lg:pb-0 [scrollbar-width:none]">
                    {/* 主畫面的賽季／賽別／日期：薪資頁、對戰有自己的範圍選單，單場頁只屬於那一場，都隱藏 */}
                    {!ownPage && (<>
                    <label className="sr-only" htmlFor="season-select">賽季</label>
                    <select id="season-select" value={viewYear} onChange={e => onYearChange(e.target.value)}
                        className="shrink-0 rounded-full border border-white/15 bg-[#0A1626] px-3.5 py-1.5 text-[13px] text-slate-200 focus:outline-none focus:border-[#12A150]">
                        {yearOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                    <UI.Seg ariaLabel="賽別" value={viewType} onChange={onTypeChange}
                        options={[{ value: 'regular', label: '例行賽' },
                            { value: 'playoffs', label: '季後賽', disabled: !playoffsAvailable && viewType !== 'playoffs',
                              title: playoffsAvailable ? undefined : `${issueSeason || '本季'} 尚無季後賽資料` }]} />
                    {/* 歷史賽季載入中給純文字（不放假膠囊） */}
                    {isHistoryMode && historyLoading && <span className="shrink-0 px-1 font-mono text-[12px] text-slate-400">載入中…</span>}
                    </>)}
                    {/* 賽程月曆：整季比賽畫在月曆上，點日期開該場單場頁（取代原「最新一場」按鈕） */}
                    {window.GameCalendar && <window.GameCalendar games={schedule} season={scheduleSeason}
                        activeDate={inGame ? gameDate : null} inGame={inGame} onPick={onPickGame} />}
                    {/* 對戰：開對戰首頁（#vs） */}
                    <button type="button" onClick={onVs} aria-pressed={!!inVs} title="灰狼對各隊的表現：勁敵、順手、棘手，與交手前瞻"
                        className={pill(inVs)}>
                        對戰
                    </button>
                    {/* 薪資：開薪資頁（#cap） */}
                    <button type="button" onClick={onCap} aria-pressed={!!inCap} title="薪資結構、奢侈稅與門檻（Cap Sheet）"
                        className={pill(inCap)}>
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
