// 指標定義（點指標旁的「?」顯示；複製引用時附資料來源）
// 結構：key → { def: 定義, calc: 計算方式（可省略）, src: 資料來源, verify: true＝定義細節待使用者確認 }
// 名稱一律沿用 constants.js 的 label / englishLabel（名稱的單一來源），這裡只寫「意思」，避免兩處名稱不同步。
// 新增指標：資料照舊加 nba_common.py 的 *_FIELDS → constants.js 加 label → 這裡補一筆定義
window.GLOSSARY = (function () {
    const BASE = 'NBA.com Stats 傳統數據（leaguedash*stats，Base）';
    const TRK = 'NBA.com Tracking（leaguedashptstats）';
    const LOC = 'NBA.com 投籃分區（leaguedash*shotlocations）';
    const PTSHOT = 'NBA.com 投籃拆分（leaguedash*ptshot）';
    const DD = 'NBA.com Defense Dashboard（leaguedashptdefend，最近防守者）';
    const HUSTLE = 'NBA.com Hustle（leaguehustlestats*）';
    const DBOX = 'NBA.com 防守數據（leaguedash*stats，Defense）';
    const ADV = 'NBA.com 進階數據（Advanced）';
    const SYN = 'Synergy Playtype（NBA.com synergyplaytypes）';
    const SCOR = 'NBA.com 得分組成（leaguedash*stats，Scoring）';

    const G = {
        // ── 傳統數據 ──
        PTS: { def: '場均得分。', src: BASE },
        REB: { def: '場均籃板（進攻＋防守）。', src: BASE },
        OREB: { def: '場均進攻籃板。', src: BASE },
        DREB: { def: '場均防守籃板。', src: BASE },
        AST: { def: '場均助攻。', src: BASE },
        STL: { def: '場均抄截。', src: BASE },
        BLK: { def: '場均阻攻。', src: BASE },
        TOV: { def: '場均失誤，越少越好。', src: BASE },
        FG_PCT: { def: '投籃命中率。', calc: '本站跨場重算：Σ命中 ÷ Σ出手（不是把每場命中率平均）', src: BASE },
        FG3_PCT: { def: '三分球命中率。', calc: 'Σ三分命中 ÷ Σ三分出手', src: BASE },
        FT_PCT: { def: '罰球命中率。', calc: 'Σ罰球命中 ÷ Σ罰球出手', src: BASE },
        PLUS_MINUS: { def: '在場時球隊得分減失分（場均）。受隊友與對手影響很大，單看不代表個人貢獻。', src: BASE },
        FGA: { def: '場均投籃出手數。', src: PTSHOT },

        // ── 投籃分區與拆分 ──
        RA_FG_PCT: { def: '合理衝撞區（籃框下方半徑 4 呎的半圓弧內）的命中率。', src: LOC },
        PAINT_FG_PCT: { def: '禁區內、但不含合理衝撞區的命中率。', src: LOC },
        MID_FG_PCT: { def: '禁區以外、三分線以內的中距離命中率。', src: LOC },
        C3_FG_PCT: { def: '左右兩側底角三分的命中率（底角三分距離較短，約 22 呎）。', src: LOC },
        AB3_FG_PCT: { def: '底角以外所有三分（弧頂與兩翼）的命中率。', src: LOC },
        EFG_PCT: { def: '有效命中率：把三分球多出的 1 分算進命中率。', calc: '(命中 + 0.5 × 三分命中) ÷ 出手', src: PTSHOT },
        FG2A_FREQ: { def: '兩分出手佔全部出手的比例。', calc: '兩分出手 ÷ 總出手', src: PTSHOT },
        FG2_PCT: { def: '兩分球命中率。', src: PTSHOT },
        FG3A_FREQ: { def: '三分出手佔全部出手的比例。', calc: '三分出手 ÷ 總出手', src: PTSHOT },
        PCT_AST_FGM: { def: '所有命中球中，由隊友助攻完成的比例。越高代表越依賴隊友創造。', src: SCOR },
        PCT_AST_2PM: { def: '兩分命中中由隊友助攻的比例。', src: SCOR },
        PCT_AST_3PM: { def: '三分命中中由隊友助攻的比例。', src: SCOR },

        // ── Tracking ──
        DRIVES: { def: '切入次數：從距籃框 20 呎以外開始持球、運球推進到 10 呎以內的觸球，不含快攻。', src: TRK },
        DRIVE_FGM: { def: '切入後自己出手並命中的次數（場均）。', src: TRK },
        DRIVE_FG_PCT: { def: '切入後自己出手的命中率。', src: TRK },
        DRIVE_TOV_PCT: { def: '切入過程中發生失誤的比例，越低越好。', calc: '切入失誤 ÷ 切入次數', src: TRK },
        DRIVE_PTS_PCT: { def: '每 100 次切入的得分（含切入被犯規的罰球得分）。例如 78.8 ＝ 平均每次切入得 0.79 分。不是「切入得分佔總得分的比例」。', calc: '切入得分 ÷ 切入次數 × 100（已用資料驗證）', src: TRK },
        CATCH_SHOOT_FGA: { def: '接球跳投出手數：距籃 10 呎以外、接球後沒有運球、持球 2 秒內出手的跳投（場均）。', src: TRK },
        CATCH_SHOOT_FG3_PCT: { def: '接球跳投中三分球的命中率。', src: TRK },
        CATCH_SHOOT_EFG_PCT: { def: '接球跳投的有效命中率。', calc: '(命中 + 0.5 × 三分命中) ÷ 出手', src: TRK },
        PULL_UP_FGA: { def: '急停跳投出手數：距籃 10 呎以外、出手前有運球的跳投（場均）。', src: TRK },
        PULL_UP_FG3_PCT: { def: '急停跳投中三分球的命中率。', src: TRK },
        PULL_UP_EFG_PCT: { def: '急停跳投的有效命中率。', calc: '(命中 + 0.5 × 三分命中) ÷ 出手', src: TRK },
        PASSES_MADE: { def: '傳球次數（場均）。', src: TRK },
        POTENTIAL_AST: { def: '潛在助攻：傳給隊友後，隊友在一次運球內出手的傳球；若投進就會是助攻（場均）。', src: TRK },
        SECONDARY_AST: { def: '二傳助攻（hockey assist）：傳給隊友後，該隊友隨即傳出助攻的傳球（場均）。', src: TRK, verify: true },
        AST_PTS_CREATED: { def: '助攻創造的得分：助攻所促成進球的分數總和（兩分助攻算 2 分、三分助攻算 3 分，場均）。', src: TRK },
        TOUCHES: { def: '觸球數：在進攻端持球的次數（場均）。', src: TRK },
        FRONT_CT_TOUCHES: { def: '前場觸球：在前場持球的次數（場均）。', src: TRK },
        TIME_OF_POSS: { def: '持球時間（分鐘，場均）。', src: TRK },
        PTS_PER_TOUCH: { def: '每次觸球的得分。', calc: '得分 ÷ 觸球數', src: TRK },
        REB_CHANCES: { def: '籃板機會：球落下時球員位於籃板落點 3.5 呎內的次數（場均）。', src: TRK },
        REB_COL_PCT: { def: '籃板機會轉換率：有籃板機會時實際搶下的比例。', calc: '籃板 ÷ 籃板機會（API 欄位 REB_CHANCE_PCT）', src: TRK },
        REB_CONTEST: { def: '競爭籃板：搶下時對手也在 3.5 呎內的籃板（場均）。', src: TRK },
        REB_CONTEST_PCT: { def: '競爭籃板佔總籃板的比例。', calc: '競爭籃板 ÷ 籃板', src: TRK },
        AVG_REB_DIST: { def: '搶下籃板的位置與籃框的平均距離（呎）。', src: TRK },

        // ── 防守 ──
        D_FGA: { def: '該球員是「最近防守者」時，對手的出手數（場均）。是最近防守者，不等於一對一主防。', src: DD },
        D_FG_PCT: { def: '該球員是最近防守者時，對手的命中率，越低越好。', src: DD },
        PCT_PLUSMINUS: { def: '對手面對他時的命中率，與這些射手平常命中率的差距；負值＝讓對手投得比平常差，越負越好。', calc: '對手命中率（DFG%）− 射手平常命中率', src: DD },
        D_FG3_PCT: { def: '該球員是最近防守者時，對手的三分命中率。', src: DD },
        CONTESTED_SHOTS: { def: '干擾投籃：在對手出手時伸手干擾的次數（場均）。', src: HUSTLE },
        DEFLECTIONS: { def: '干擾球：碰觸到對手的傳球或運球、改變球路的次數（場均）。不是抄截，但常導致抄截。', src: HUSTLE },
        CHARGES_DRAWN: { def: '製造對手進攻犯規的次數（場均）。', src: HUSTLE },
        SCREEN_ASSISTS: { def: '掩護助攻：掩護直接讓隊友投籃得分的次數（場均）。', src: HUSTLE },
        LOOSE_BALLS: { def: '搶回散球：搶到雙方都未控制的球的次數（場均）。', src: HUSTLE },
        BOX_OUTS: { def: '卡位次數（場均）。', src: HUSTLE },
        DEF_RATING: { def: '防守效率：在場時球隊每 100 回合的失分，越低越好。', src: DBOX },
        DREB_PCT: { def: '防守籃板率：在場時可搶的防守籃板中搶下的比例。', src: DBOX },
        OPP_PTS_PAINT: { def: '對手在禁區（油漆區，含合理衝撞區）的得分（場均）。', src: DBOX },
        OPP_PTS_FB: { def: '對手快攻得分（場均）。', src: DBOX },
        RA_OPP_FG_PCT: { def: '對手在合理衝撞區的命中率（全隊防守），越低越好。', src: LOC },
        PAINT_OPP_FG_PCT: { def: '對手在禁區（非合理衝撞區）的命中率，越低越好。', src: LOC },
        MID_OPP_FG_PCT: { def: '對手中距離命中率，越低越好。', src: LOC },
        C3_OPP_FG_PCT: { def: '對手底角三分命中率，越低越好。', src: LOC },
        AB3_OPP_FG_PCT: { def: '對手非底角三分命中率，越低越好。', src: LOC },

        // ── 進階 / 陣容 / On-Off ──
        OFF_RATING: { def: '進攻效率：每 100 回合得分。', src: ADV },
        NET_RATING: { def: '淨效率：進攻效率 − 防守效率，正值代表每 100 回合淨贏。', src: ADV },
        TS_PCT: { def: '真實命中率：把三分與罰球都算進去的得分效率。', calc: '得分 ÷ (2 × (出手 + 0.44 × 罰球出手))', src: ADV },
        MIN: { def: '該五人陣容一起在場的總分鐘數（此 endpoint 一律回總計，不受 PerMode 影響）。', src: ADV },
        GP: { def: '出賽場次。', src: BASE },

        // ── Synergy Playtype 欄位 ──
        PPP: { def: '每球權得分：以這種打法結束的球權，平均得幾分。防守面是對手每球權得分，越低越好。', calc: '得分 ÷ 球權', src: SYN },
        PERCENTILE: { def: '聯盟百分位：PPP 在全聯盟同類型中的排名百分位（0–100），攻守兩面都是越高越好。球權太少時會很極端。', src: SYN },
        FREQ: { def: '使用率：這種打法佔全部球權的比例。', calc: '該類型球權 ÷ 總球權', src: SYN },
        POSS: { def: '每場以這種打法結束的球權數。', src: SYN },

        // ── Synergy Playtype 類型（key 加 PT_ 前綴） ──
        PT_Transition: { def: '轉換進攻：搶到球權後在對方防守站定前發動的快攻或早期進攻。', src: SYN },
        PT_Isolation: { def: '單打：持球者在半場一對一，隊友拉開空間。', src: SYN },
        PT_PRBallHandler: { def: '擋拆持球者：擋拆中由持球者結束球權（自己出手、造犯規或失誤）。', src: SYN },
        PT_PRRollMan: { def: '擋拆掩護者：擋拆中由掩護者順下或外彈後結束球權。', src: SYN },
        PT_Postup: { def: '背框單打：在低位或中位背對籃框接球進攻。', src: SYN },
        PT_Spotup: { def: '定點投籃：接球後直接出手，或接球後少量運球出手（無掩護、非手遞手）。', src: SYN },
        PT_Handoff: { def: '手遞手：從隊友手上直接接過球後結束球權。', src: SYN },
        PT_Cut: { def: '空切：無球跑動切向籃下接球得分機會。', src: SYN },
        PT_OffScreen: { def: '繞掩護：無球繞過隊友掩護後接球出手。', src: SYN },
        PT_OffRebound: { def: '進攻籃板補進（Putbacks）：搶到進攻籃板後直接出手。', src: SYN },
        PT_Misc: { def: '其他：不屬於以上類型的球權（例如殘局、特殊狀況），分析時通常排除。', src: SYN },
    };
    return G;
})();
