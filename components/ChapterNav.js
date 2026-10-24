// 章節列（捲動時固定在頂端）：01 總覽 … 06 跨季 ＋ 右側攻/守切換（僅 sided 章節）
// 鍵盤：數字鍵 1–6 切章節（App 的全域 keydown 處理），這裡的編號就是快捷鍵提示（手機無鍵盤，編號隱藏省寬度）
const ChapterNav = ({ tabs, activeTab, onTab, viewSide, onSide }) => {
    const UI = window.UI;
    return (
        <UI.TabBar ariaLabel="章節" tabs={tabs} value={activeTab} onChange={onTab} numbered
            right={/* 只在內容會隨攻守變化的章節顯示（TABS 的 sided），其他章節按了沒反應只會誤導、手機上還擠掉章節 */
                tabs.find(t => t.key === activeTab)?.sided && (
                    <UI.Seg ariaLabel="攻守" size="sm" value={viewSide} onChange={onSide}
                        options={[
                            { value: 'offensive', label: '進攻', activeClass: 'bg-[#12A150] text-[#0A1626] font-medium' },
                            { value: 'defensive', label: '防守', activeClass: 'bg-[#EF4444] text-[#0A1626] font-medium' },
                        ]} />
                )} />
    );
};

window.ChapterNav = ChapterNav;
