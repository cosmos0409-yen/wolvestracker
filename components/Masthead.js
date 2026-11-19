// 刊頭（2026-11-19 改版，方案 A）：左＝「看哪份資料」、右＝「去哪裡」
//   字標＋期別行（主畫面只寫站名與連線狀態；獨立整頁寫頁名）
//   資料群組：賽季下拉（只列年份）＋例行／季後（常駐，歷史賽季也能切）——只在主畫面；身分列另有季別標籤標示目前範圍
//   頁面入口：賽程月曆（GameCalendar）・對戰・組合・薪資｜搜尋（/）
//   「複製連結」按鈕已移除：網址列本來就記住目前畫面，引用籃的引用也會附網址
// 時光機（截至日期）與期間仍在身分列／章節列（影響所有章節，放每章都看得到的地方）
// 單場頁／薪資頁／對戰等獨立整頁：隱藏資料群組（避免刊頭寫的賽季和內容對不上）
// 手機（< lg）三列：① 字標＋搜尋 ② 資料群組（占滿一列）③ 頁面入口一排四格；lg 以上單列（1024～1279 賽程膠囊省對手縮寫）
const Masthead = ({
    yearOptions, viewYear, onYearChange, isHistoryMode, historyLoading,
    viewType, onTypeChange,
    issueSeason, status, onStatusClick, onSearch,
    schedule, scheduleSeason, onPickGame, inGame, gameDate, inCap, onCap, inVs, onVs, inSched, onFullSchedule, inLineups, onLineups, inCompare, playoffsAvailable = true,
}) => {
    const UI = window.UI;
    const ownPage = inCap || inGame || inVs || inSched || inLineups || inCompare;   // 獨立整頁：不顯示主畫面的賽季／賽別
    // 頁面入口：手機是等寬格子（≥ 44px 高、好點）、lg 以上是膠囊
    const navCls = (on) => `flex items-center justify-center whitespace-nowrap border text-[13px] max-lg:min-h-[44px] max-lg:rounded-[10px] max-lg:px-1 lg:shrink-0 lg:rounded-full lg:px-3.5 lg:py-1.5 ${on ? 'border-[#12A150] bg-[#12A150]/10 text-slate-50' : 'border-white/15 text-slate-300 lg:text-slate-400 hover:text-slate-100 hover:border-white/30'}`;
    // 手機只留色點（文字給螢幕閱讀器），點期別行可看完整狀態
    const statusEl = (cls, text) => <span className={cls}>●<span className="max-sm:sr-only"> {text}</span></span>;
    const statusDot = status === 'offline' ? statusEl('text-[#EF4444]', '未連線')
        : status === 'offseason' ? statusEl('text-amber-400', '休賽期')
        : statusEl('text-[#12A150]', '雲端即時');
    return (
        <header className="border-b border-white/10">
            <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 sm:py-4 flex flex-wrap items-center gap-x-5 gap-y-3">
                <div className="flex min-w-0 items-center gap-3 max-lg:flex-1">
                    {/* 站徽與 PWA 圖示同一張（icons/icon.svg）；身分列／頭像列的球隊 Logo 仍用 NBA 官方 */}
                    <img src="icons/icon.svg" alt="" width="40" height="40" className="w-10 h-10 shrink-0 rounded-lg" />
                    <div className="min-w-0">
                        <div className="font-display text-[22px] sm:text-[26px] font-bold uppercase leading-none tracking-wide text-slate-50 whitespace-nowrap">
                            Wolves <span className="text-[#12A150]">Ledger</span>
                        </div>
                        <button type="button" onClick={onStatusClick} title="查看連線狀態"
                            className="-mb-1 py-1 font-mono text-[11px] tracking-wide text-slate-400 hover:text-slate-200 truncate max-w-full text-left">
                            {/* 手機省掉英文副名，色點才放得下 */}
                            {inCap ? '薪資 · Cap Sheet' : inCompare ? <>球員比較<span className="max-sm:hidden"> · Compare</span></> : inLineups ? <>組合數據<span className="max-sm:hidden"> · Lineups</span></> : inSched ? <>完整賽程<span className="max-sm:hidden"> · Schedule</span></> : inVs ? <>對戰分析<span className="max-sm:hidden"> · Matchups</span></>
                                : inGame ? <>單場 · <span className="max-sm:hidden">{(gameDate || '').slice(0, 5)}</span>{(gameDate || '').slice(5)}</>
                                : '灰狼數據帳本'}
                            <span className="mx-1.5 text-slate-600">·</span>{statusDot}
                        </button>
                    </div>
                </div>
                {/* 手機：搜尋放字標同一列右側；桌機在頁面入口最右邊 */}
                <button type="button" onClick={onSearch} aria-label="搜尋球員、章節或賽季"
                    className="lg:hidden shrink-0 rounded-full border border-white/15 px-3 py-1.5 text-xs text-slate-300">搜尋</button>

                {/* 資料群組：主畫面才有（薪資頁、對戰有自己的範圍選單，單場頁只屬於那一場） */}
                {!ownPage && (
                    <div role="group" aria-label="資料範圍"
                        className="flex items-center gap-1.5 rounded-full border border-[#12A150]/45 bg-[#12A150]/[0.06] py-[3px] pl-3 pr-[3px] max-lg:w-full lg:shrink-0">
                        <span aria-hidden="true" className="font-mono text-[10px] tracking-wider text-[#12A150]">資料</span>
                        <label className="sr-only" htmlFor="season-select">賽季</label>
                        <select id="season-select" value={viewYear} onChange={e => onYearChange(e.target.value)}
                            className="min-h-[30px] min-w-0 rounded-full bg-transparent px-2 text-[13px] text-slate-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#12A150] max-lg:flex-1">
                            {yearOptions.map(opt => <option key={opt.value} value={opt.value} className="bg-[#0A1626]">{opt.label}</option>)}
                        </select>
                        {isHistoryMode && historyLoading && <span className="shrink-0 px-1 font-mono text-[12px] text-slate-400">載入中…</span>}
                        <UI.Seg ariaLabel="賽別" value={viewType} onChange={onTypeChange}
                            options={[{ value: 'regular', label: '例行賽' },
                                { value: 'playoffs', label: '季後賽', disabled: !playoffsAvailable && viewType !== 'playoffs',
                                  title: playoffsAvailable ? undefined : `${issueSeason || '本季'} 尚無季後賽資料` }]} />
                    </div>
                )}

                {/* 頁面入口：手機一排四格（等寬、不換行），lg 以上靠右的膠囊＋分隔線＋搜尋 */}
                <nav aria-label="頁面" className="grid grid-cols-4 gap-1.5 max-lg:w-full lg:ml-auto lg:flex lg:items-center lg:gap-2">
                    {/* 賽程月曆：整季比賽畫在月曆上，點日期開該場單場頁 */}
                    {window.GameCalendar && <window.GameCalendar games={schedule} season={scheduleSeason} navStyle
                        activeDate={inGame ? gameDate : null} inGame={inGame || inSched} onPick={onPickGame} onFull={onFullSchedule} />}
                    <button type="button" onClick={onVs} aria-pressed={!!inVs} title="灰狼對各隊的表現：勁敵、順手、棘手，與交手前瞻"
                        className={navCls(inVs)}>對戰</button>
                    <button type="button" onClick={onLineups} aria-pressed={!!inLineups} title="二人／三人／五人組合的上場時間與效率（Lineups）"
                        className={navCls(inLineups)}>組合</button>
                    <button type="button" onClick={onCap} aria-pressed={!!inCap} title="薪資結構、奢侈稅與門檻（Cap Sheet）"
                        className={navCls(inCap)}>薪資</button>
                    <span aria-hidden="true" className="hidden lg:block h-5 w-px bg-white/15" />
                    <button type="button" onClick={onSearch} aria-label="搜尋球員、章節或賽季（快捷鍵 /）"
                        className="hidden lg:inline-flex shrink-0 items-center gap-2 rounded-full border border-white/15 px-3.5 py-1.5 text-[13px] text-slate-400 hover:text-slate-100 hover:border-white/30">
                        搜尋<kbd className="rounded border border-white/20 px-1.5 font-mono text-[10px] text-slate-400">/</kbd>
                    </button>
                </nav>
            </div>
        </header>
    );
};

window.Masthead = Masthead;
