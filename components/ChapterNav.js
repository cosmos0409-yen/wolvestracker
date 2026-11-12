// 章節列（捲動時固定在頂端）：01 總覽 … 06 跨季 ＋ 右側期間膠囊（桌機）＋ 攻守視角切換（僅 sided 章節）
// 攻守標「進攻端／防守端」，和「防守」章節區分
// 鍵盤：數字鍵 1–6 切章節（App 的全域 keydown 處理），這裡的編號就是快捷鍵提示（手機無鍵盤，編號隱藏省寬度）
// periodPill：期間膠囊（只在 sm 以上顯示；手機在身分列）；below：期間面板＋手機篩選提示（跟著章節列吸頂）
// tabs 的 period：該章節內容跟著期間篩選；篩選生效時跟得上的章節名稱旁加綠點，跟不上的變淡（仍可點）
const ChapterNav = ({ tabs, activeTab, onTab, viewSide, onSide, periodPill, periodOn = false, below }) => {
    const UI = window.UI;
    const shown = periodOn ? tabs.map(t => ({
        ...t, label: t.period
            ? <>{t.label}<span aria-label="（跟著期間）" className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-[#12A150] align-middle"></span></>
            : <span className="opacity-50" title="整季數據，期間篩選不適用">{t.label}</span>,
    })) : tabs;
    return (
        <UI.TabBar ariaLabel="章節" tabs={shown} value={activeTab} onChange={onTab} numbered below={below}
            right={<>
                {periodPill && <span className="hidden sm:inline-flex">{periodPill}</span>}
                {/* 只在內容會隨攻守變化的章節顯示（TABS 的 sided），其他章節按了沒反應只會誤導、手機上還擠掉章節 */}
                {tabs.find(t => t.key === activeTab)?.sided && (
                    <UI.Seg ariaLabel="攻守視角" size="sm" value={viewSide} onChange={onSide}
                        options={[
                            { value: 'offensive', label: '進攻端', activeClass: 'bg-[#12A150] text-[#0A1626] font-medium' },
                            { value: 'defensive', label: '防守端', activeClass: 'bg-[#EF4444] text-[#0A1626] font-medium' },
                        ]} />
                )}
            </>} />
    );
};

window.ChapterNav = ChapterNav;
