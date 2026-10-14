// 章節列（捲動時固定在頂端）：01 總覽 … 06 跨季 ＋ 右側攻/守切換
// 鍵盤：數字鍵 1–6 切章節（App 的全域 keydown 處理），這裡的編號就是快捷鍵提示（手機無鍵盤，編號隱藏省寬度）
const ChapterNav = ({ tabs, activeTab, onTab, viewSide, onSide }) => {
    const UI = window.UI;
    return (
        <nav aria-label="章節" className="sticky top-0 z-20 border-b border-white/10 bg-[#0A1626]/85 backdrop-blur-md">
            <div className="max-w-7xl mx-auto px-4 md:px-6 flex items-center gap-3">
                {/* 右緣漸層遮罩：提示手機上章節還能往右滑 */}
                <div className="flex min-w-0 flex-1 items-center overflow-x-auto [scrollbar-width:none] [mask-image:linear-gradient(to_right,#000_85%,transparent)] sm:[mask-image:none]">
                    {tabs.map((t, i) => {
                        const on = activeTab === t.key;
                        return (
                            <button key={t.key} type="button" onClick={() => onTab(t.key)} aria-current={on ? 'page' : undefined}
                                title={`快捷鍵 ${i + 1}`}
                                className={`flex shrink-0 items-baseline gap-1.5 border-b-2 px-2.5 sm:px-3 py-3 text-[14px] transition-colors ${on ? 'border-[#12A150] text-slate-50 font-medium' : 'border-transparent text-slate-400 hover:text-slate-100'}`}>
                                <span className={`hidden sm:inline font-mono text-[10px] ${on ? 'text-[#12A150]' : 'text-slate-600'}`}>{String(i + 1).padStart(2, '0')}</span>
                                {t.label}
                            </button>
                        );
                    })}
                </div>
                <UI.Seg ariaLabel="攻守" size="sm" value={viewSide} onChange={onSide}
                    options={[
                        { value: 'offensive', label: '進攻', activeClass: 'bg-[#12A150] text-[#0A1626] font-medium' },
                        { value: 'defensive', label: '防守', activeClass: 'bg-[#EF4444] text-[#0A1626] font-medium' },
                    ]} />
            </div>
        </nav>
    );
};

window.ChapterNav = ChapterNav;
