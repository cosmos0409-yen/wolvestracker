# Wolves Tracker 交接手冊

> 最後更新：2026-10-26（**每日抓取看門狗**：新排程 `WolvesWatchdog` 台北 15:00 檢查，主排程沒完成就完整補抓、昨晚那場還沒進資料庫就只抓單場，有補抓或失敗才跳桌面通知，見「2026-10-26 每日抓取看門狗」與「自動化排程」）
> 前次：2026-10-24（**網址改用球員「ID-名字」＋賽季 `s=年份&t=賽別`**、**單場分頁＋介面統一**、**網站圖示（PWA）**，見同名章節；之前的對戰分析、開季修正、薪資頁、單場比賽頁見同名章節）

## 已完成項目

| # | 項目 | 狀態 | 說明 |
|---|---|---|---|
| 1 | Firebase 整合 | ✅ | 前端以 `onSnapshot`（當季）+ `getDoc`（歷史）讀取 Firestore |
| 2 | Python 爬蟲腳本 | ✅ | `scripts/fetch_data.py`，含 11 PlayType + 6 Tracking |
| 3 | 前端 UI 全面改寫 | ✅ | 雷達圖、Tracking 卡片、球員頭像、賽季標籤 |
| 4 | 反爬蟲機制 | ✅ | curl_cffi 瀏覽器 TLS 模擬 + retry |
| 5 | 賽季類型自動判斷 | ✅ | `get_season_type()`（後端）+ `getSeasonPhase()`（前端） |
| 6 | Windows 排程器自動執行 | ✅ | 每日 03:00 抓前一晚比賽（`WolvesTracker`）、每週一 14:30 抓熱圖（`WolvesShotchart`）；詳見「自動化排程」 |
| 7 | `seasonType` / `season` 欄位 | ✅ | 所有文件含「例行賽 / 季後賽」標籤 |
| 8 | **Phase 0：前端元件拆檔（bundle 模式）** | ✅ | components/ 9 檔；`scripts/bundle.py` 合併為 `dist/components-bundle.js` |
| 9 | **Phase 1：歷史賽季回補** | ✅ | 22-23 / 23-24 / 24-25 × 例行 / 季後 共 12 個 history 文件 |
| 10 | **Phase 1：寫入前去重** | ✅ | `fetch_data.py` 比對前一筆，相同則跳過寫入 |
| 11 | **Phase 1：歷史標籤清理** | ✅ | `cleanup_and_tag.py` 補貼舊文件 `seasonType` 並刪重複日 |
| 12 | **Phase 2：賽季標籤 + 篩選 + 中英對照** | ✅ | Header 動態標籤、Modal 賽季篩選、Tracking 中英對照 |
| 13 | **Phase 2：陳舊資料 / 休賽期警告** | ✅ | 賽季期間檢查、休賽期靜態提示 |
| 14 | **Phase 3：賽季選擇器 + localStorage 快取** | ✅ | SeasonPicker 下拉 + history doc 永久快取 |
| 15 | **Phase 3：跨賽季雷達 overlay** | ✅ | 球員模式可疊加最多 3 賽季雷達 |
| 16 | **Phase 3：卡片 Modal 跨賽季比較分頁** | ✅ | 每張卡片可切「當季走勢 / 跨賽季比較」，後者表格 + 折線 |
| 17 | **Phase 3：例行賽 / 季後賽 tab 切換** | ✅ | 當季走勢分頁依當前日期預設例行 / 季後 |
| 18 | **爬蟲重構：共用模組 + 設定表** | ✅ | `scripts/nba_common.py`；欄位對應改 `TRACKING_FIELDS` 等設定表，fetch/backfill 共用 |
| 19 | **籃板完整欄位 + REB_COL_PCT 修復** | ✅ | 擴至 9 欄；API 欄名已改為 `REB_CHANCE_PCT`（舊 `REB_COLLECT_PCT` 不存在導致一直是 0） |
| 20 | **投籃 / Clutch / 陣容每日抓取** | ✅ | shotlocations + ptshot + clutch + lineups，每日 +7 個 request |
| 21 | **投籃熱圖（每日增量＋每週對帳）** | ✅ | `fetch_shotchart.py` 逐球員出手座標 → `wolves_shotcharts`；每日 `fetch_data.py` 以單場全隊查詢增量併入（2026-10-23）；前端 SVG 半場圖 |
| 22 | **移除 GitHub Actions 遺留** | ✅ | 刪除 `nba_update.yml`（datacenter IP 被擋，實際早已改用本機排程） |
| 23 | **配色改版（灰狼新品牌）** | ✅ | 翠綠 `#12A150`（官方 Aurora Green 提亮版）+ 午夜藍底 `#0A1626` + 月光銀 `#C4CED2`；取代舊萊姆綠 |
| 24 | **防守數據（每日）** | ✅ | 對位防守 `leaguedashptdefend` + Hustle + 防守 box + 對手分區；`nba_common.py` 4 支 `fetch_*` + 設定表 |
| 25 | **防守側前端** | ✅ | 修進攻/防守不對稱；`defenseDefs`/`oppZonesDefs`；`doc.defense` 欄位 |
| 26 | **球隊投籃熱圖** | ✅ | `fetch_shotchart.py` `PlayerID=0` 全隊 → `wolves_shotcharts/TEAM_*`；`ShotChart teamMode` |
| 27 | **防守熱圖** | ✅ | `DefenseHeatmap.js` 半場 5 區依「對手命中率 − 該區聯盟均值」著色 |
| 28 | **單場比賽頁（Game Center）** | ✅ | `GamePage.js`，網址 `#game=日期[&tab=]`：比分看板常駐，單場分頁 概要（焦點／本場 vs 季平均／比賽資訊）／Box Score＋展開進階／球隊對比／投籃（2026-10-24 分頁化） |
| 29 | **2025-26 box score 回補** | ✅ | `backfill_games.py --box-only`，例行 82＋季後 12 場（2025-11-19 NBA summary 為空，缺每節比分） |
| 30 | **網址聚焦指標走勢** | ✅ | `m=`／`hl=` 直接開 Splits 逐場走勢並圈出單場；Splits 新增「防守」欄位組 |
| 31 | **走勢勝負底色** | ✅ | Splits／投籃的逐場走勢鋪綠勝紅敗色帶 |
| 32 | **跨季疊圖** | ✅ | 賽季軌跡疊圖（`SeasonPaceChart.js`）＋逐季折線多序列（多球員／多指標／指數化） |
| 33 | **投籃分區與上季比** | ✅ | `ShootingTab` 分區加上季命中率／差距／占比＋分區差異半場圖 |
| 34 | **薪資頁（Cap Sheet）** | ✅ | `CapPage.js`，網址 `#cap`：門檻與奢侈稅、累犯自動判定、門檻限制、逐年薪資總表、薪資結構、選秀權、薪資×表現；資料由 Google Sheet 經 `sync_salary.py` 同步 |
| 35 | **舊賽季單場球員清理** | ✅ | `backfill_games.py --clean-players`（多欄位對帳、0 request）：2022-23～2024-25 例行賽剔除 76 場、105 人次非當時隊員，重建 bundle |
| 36 | **對戰分析** | ✅ | `matchupData.js`（`window.Matchup`）＋對戰首頁 `MatchupHome.js`（`#vs`）＋單隊對戰頁 `MatchupPage.js`（`#vs=DEN`）＋Splits 對手篩選；只用既有逐場資料 |
| 37 | **單場分頁＋介面統一** | ✅ | 單場頁單場分頁、共用 `UI.TabBar`／`UI.useTabKeys`、數字鍵切目前畫面分頁列、主畫面賽季不記憶、重複控制項只留一處、手機橫向溢出修正 |
| 38 | **網址球員「ID-名字」＋賽季參數統一** | ✅ | `p=1630162-anthony-edwards`（只用 ID 對人）、`s=2025-26&t=playoffs`；舊連結仍可開；順帶修正舊連結跨賽季被舊名單誤判 |
| 39 | **每日抓取看門狗** | ✅ | `scripts/watchdog.py`＋排程 `WolvesWatchdog`（台北 15:00）：主排程沒完成 → 完整補抓；昨晚那場缺 → `fetch_data.py --games-only`；有補抓或失敗才跳 Windows 桌面通知 |

---

## 2026-07 六分頁大改版（現行架構）

一次把 UI 從「單頁長捲軸」改為**右欄六分頁**，並讓多數數據改由**單場資料**計算，而非只看整季累積快照。

### 後端變更
- **`nba_common.py`**：新增 `BASE_FIELDS`（傳統基本數據 + GP/W/L）、`ONOFF_FIELDS`、`ASSISTED_FIELDS` 設定表 + `fetch_base_box` / `fetch_onoff` / `fetch_assisted_pct` / `fetch_team_game_log`；並補齊 Drives/CatchShoot/PullUp/對位防守的**分子分母欄位**（供前端加權重算 %）。
- **`fetch_data.py`**：每日快照加 `base`（整季總計）+ `onoff`；`capture_single_game` 加 base 欄、matchup/wl、每日重建 `wolves_games_index`；加 `--force-type/--date`（繞過休賽期補期末快照）。
- **`backfill_games.py`**：`--min-gp 0`（全名單）、管線加 `fetch_base_box`、加 `--dates`（補失敗場）。
- **`backfill_history.py`**：從只抓 Synergy+Tracking **擴充為完整類別**終點快照（base/tracking/shooting/clutch/lineups/defense/onoff）；已回補 2022-23~2025-26 × 例行/季後。
- **`fetch_shotchart.py`**：每球加存 `ACTION_TYPE`（出手方式）、`GAME_DATE`（正規化，`gameDates` 索引）；加 `assisted`（受助攻比例）；加 `--season/--type`。
- **`build_bundles.py`（新）**：把每季逐場濃縮成 bundle doc——球隊 1 份（`wolves_games_bundle/{s}_{t}`）、**逐球員各 1 份**（`wolves_pgames_bundle/{s}_{t}_{playerId}`，因整季 15 人一份超過 Firestore 1 MiB）。每場統一 `{date,matchup,wl,stats}`。
- **`index.html`**：Firestore 改 `initializeFirestore(..., autoDetectLongPolling)`（WebChannel 被擋環境退回長輪詢，修 localhost 讀取卡死）。

### 前端變更（`components/`）
- 新元件：`OverviewTab` / `SplitsTab` / `ShootingTab` / `ComparisonTab` / `RadarPanel` / `gameAggregates.js`(`GameAgg`) / `gamesData.js`。
- **資料層分工**：
  - 季平均 / Splits / 趨勢折線 → `GameAgg` 算 **bundle 逐場**（`gamesData.loadSeasonGames` 讀單一 bundle doc；百分比欄以 Σ分子/Σ分母 加權，見 `GameAgg.RATIO_DEFS`）。
  - Playtype / Clutch / Lineups / On-Off / 防守 → 每日或歷史**快照**。
  - 投籃 → `wolves_shotcharts` 逐球（前端算距離區間/分區/出手方式）。
  - 跨季比較 → `wolves_*_history` 各季終點快照（`ComparisonTab` + `loadHistoryByDocId`）。
- header：賽別切換（例行/季後，預設依時節）+ **日曆日期**（選到哪天 → 總覽顯示截至該日季平均，`GameAgg.seasonToDate`）。取代原 ‹ › 翻頁與 `viewIndex`。
- `RadarPanel`：軸可自選 3~6 個（localStorage 記憶）+ 疊加 chips 搬到雷達下方 + 自選指標比較表。
- `normalizeHistoryPlayer` 擴充：各類別皆以球員名展開（不只 stats/tracking）。
- `HistoryModal` 縮減為僅當季走勢（跨賽季已由跨季分頁取代）。

### 已知資料缺口 / 後續
- ~~2023-24 / 2022-23 逐場 games 未回補~~ **（2026-10-19 更正：已有）**：這兩季的球隊與球員 bundle 都在，賽季軌跡疊圖可疊 2022-23～2026-27。box score 只回補了 2025-26（`--box-only`），2024-25 以前的單場頁沒有比分看板／Box Score。
- **fetch_data 未瘦身**：每日 tracking（雷達用）/defense（防守分頁用）仍需要；只有 shooting 真正沒用（省 1-2 requests，不值得砍）。防守分頁的 defense_box/對手分區不在 games 內，故防守維持快照。
- **2025-26 當季每日快照的類別不齊**：base/shooting/clutch/lineups/defense/onoff 是賽季中途才加進抓取，例行賽只有 2026-04-14（2026-10 以 `fetch_data.py --force-type regular --date 2026-04-14` 補寫完整期末快照）、季後賽只有 2026-05-15 / 06-15 有完整類別。前端防守分頁遇缺會說明並提供「改看 {最近有資料日期}」按鈕；新賽季起每日快照皆完整，不再有此問題
- 排程環境：`.bat` 用 Python312 絕對路徑（裸 `python` 會抓到沒 curl_cffi 的版本）。
- **折線疊圖（2026-10-19 已完成）**：見「跨季疊圖」。決定：同指標多球員直接疊；不同單位的多指標**不做雙 Y 軸**（易誤讀），改小圖並排或指數化（首季＝100）。`TrendChart` 維持單序列，多序列另做 `LineOverlay`

---

## 進行中優化計畫

詳見 `doc/plan.md`。

| Phase | 內容 | 狀態 |
|-------|------|------|
| Phase 0 | 前端元件拆檔（bundle 模式） | ✅ 完成 |
| Phase 1 | 歷史賽季數據回補（22-23 至 24-25） | ✅ 完成 |
| Phase 2 | UI 賽季標籤、分類篩選、Tracking 中英對照 | ✅ 完成 |
| Phase 3 | 跨賽季比較功能 | ✅ 完成 |
| Phase 4 | 行動裝置響應與細節優化 | ✅ 完成 |

（2026-07 後續批次：配色改版、防守數據、球隊/防守熱圖、球員互相比較、休賽期標示、單場數據回補+面板——詳見「已完成項目」23–27 與「給下一位 Agent 的維護重點」。）

### 2026-10 Wolves Ledger 改版（專欄研究工具重設計）

定位：使用者寫灰狼專欄時查資料用的研究工具；品質標竿為 Synergy（密集可排序表格）與 BBall Index（百分位色條、一眼看出強弱）。計畫檔：`~/.claude/plans/partitioned-knitting-fog.md`。

| Phase | 內容 | 狀態 |
|-------|------|------|
| 0 | 數據命名精準度修正（見「指標命名對照」） | ✅ |
| 1 | 預編譯建置（esbuild＋Tailwind CLI，移除瀏覽器內 Babel／Tailwind CDN） | ✅ |
| 2 | 設計系統 `components/ui.js` | ✅ |
| 3 | 版面骨架（刊頭／頭像列／身分列／章節列）＋網址狀態＋快速搜尋 | ✅ |
| 4 | 各章節內容重排（Synergy 式 Playtype 表、強弱項等） | ✅ |
| 5 | 寫作工具（複製引用、指標定義、近期異動、CSV／PNG 匯出） | ✅ |
| 6 | 品質迭代：首屏只讀近期快照、移除阻斷載入、對比 AA、觸控目標、總覽近 N 場 | ✅ |
| 7 | 更新規格文件、清理暫存 | ✅ |

Phase 6 結果（PageSpeed 手機）：無障礙 97→**100**、總傳輸 11.3 MB→約 3.2 MB、SEO 100、最佳做法 96。效能分數見「常見問題：PageSpeed 效能分數」。

### 2026-10-19 單場比賽頁＋跨季疊圖

需求：類官網的單場頁＋跨季折線疊圖。模板與連結手感預覽在 `_mockup/game.html`、`overlay.html`、`links.html`（未進版控）。計畫檔：`~/.claude/plans/bright-shimmying-brook.md`。

| Phase | 內容 | 狀態 | 提交 |
|-------|------|------|------|
| 1 | `backfill_games.py --box-only`，回補 2025-26 box score；box 完整度判定改嚴格 | ✅ | `78e2946` |
| 2 | 網址 `m`／`hl`／`game`、Splits 防守組、走勢勝負底色與圈出單場；修登入時序 bug | ✅ | `7ebbfe7` |
| 3 | 單場比賽頁 `GamePage.js` 與四個入口 | ✅ | `e39161a` |
| 4 | 賽季軌跡疊圖 `SeasonPaceChart.js`＋逐季折線多序列（`ComparisonTab`） | ✅ | `e454c3c` |
| 5 | 投籃分區與上季比 | ✅ | `ed71651` |
| 6 | 更新規格文件 | ✅ | — |

使用者確認過的決定（之後改動前先問）：
- 單場頁是**獨立整頁**（不是第七章節）；對手球員不可點（只有灰狼的季資料）
- 點指標**一律跳 Splits**（逐場走勢只在 Splits；防守章節的走勢是每日快照累積值，意思不同、無法標出單場）
- 標色規則：次數類（觸球、前場觸球、切入次數、防守出手數、籃板機會）**中性不標色**；比率類出手 < 5 標「樣本少」
- 對手 Tracking／Hustle 只有 2026-10 起的比賽有；**2025-26 不回補對手數據**（使用者：「缺對手的沒差」）
- 投籃點賽後隔天併入（每日增量，2026-10-23 起；之前為每週更新）

### 2026-10-20 薪資頁（Cap Sheet）

需求：類似 Spotrac yearly 的灰狼薪資頁，看薪資結構、離各條門檻多遠、奢侈稅、選秀權。NBA API 沒有薪資、Spotrac 等網站禁止爬取，所以**人工維護 Google Sheet 當唯一資料來源**。計畫檔：`~/.claude/plans/sprightly-twirling-harbor.md`。

| Phase | 內容 | 狀態 | 提交 |
|-------|------|------|------|
| 1 | 種子資料（使用者截圖 Spotrac／Fanspo，Claude 轉檔並逐季對帳）＋建立 Google Sheet 並發佈 CSV | ✅ | —（資料在 Sheet） |
| 2 | `scripts/sync_salary.py`（Sheet → `wolves_salary/main`）＋排程＋Firebase 規則與索引豁免 | ✅ | `3afdf29` |
| 3 | `#cap` 路由、刊頭入口、門檻與奢侈稅、門檻限制、累犯自動判定（`tax_history`）、懸停完整金額、球員薪資膠囊 | ✅ | `178905c` |
| 4 | 逐年薪資總表、薪資結構、選秀權、球員名連到球員頁；改成四個分頁＋固定分頁列 | ✅ | `d818b7d` |
| 5 | 薪資占比 vs 貢獻占比（可關閉、公式常駐） | ✅ | `5de5c8d` |
| 6 | 更新規格文件 | ✅ | — |

使用者確認過的決定（之後改動前先問）：
- 資料流程：**Google Sheet → `sync_salary.py`（只檢查格式與對帳）→ Firestore → 前端計算**。計算只放前端，Python 不重複計算邏輯
- 薪資頁是**獨立整頁**（同單場頁，不是第七章節），入口在刊頭；頁內分「總覽／合約／選秀權／規則」四個分頁，**唯一的賽季選單在分頁列**（刊頭的賽季／賽別／日期在薪資頁隱藏，避免兩組賽季控制項）
- 用詞：「第一／第二 apron」指門檻線；「鎖死在第二 apron（hard cap）」指做了特定操作後本季不能超過。**使用者原本把 apron 叫「硬上限」**，混用曾造成誤解
- 狀態資訊不用膠囊（膠囊只給可點的控制項）：狀態列＋色點；累犯試算是勾選框
- 薪資×表現：只是**隊內相對比較**，公式與限制必須常駐顯示；可用 Sheet `settings.show_value` 關閉
- 縮寫金額（$214.93M）滑鼠移上去要顯示完整金額（$214,930,954）
- 回填 2024-25、2025-26（逐年總表可看到 2030-31）
- 資料核對：2024-25／2025-26 的 apron 薪資、2026-27 的奢侈稅薪資與 apron 薪資，都和 Spotrac 截圖**逐元相符**；選秀權以 RealGM 為主、和 Fanspo 交叉核對（差異記在 `picks.verify`）

後續（未完成，需要時再做）：
- [ ] 2026-27 開季後隔天確認：球員頁薪資膠囊出現、薪資×表現當季有數據（今天還沒有任何 2026-27 快照）
- [ ] 2026-27 季末：在 Sheet `tax_history` 加一列（是否繳稅）。若季末仍超過奢侈稅線，2027-28 起自動判定為累犯
- [ ] 待確認的數字（Sheet 的 `verify` 欄有標）：2024-25／2025-26 的 BAE 是 3.32%×cap 推算；2024-25 的稅率（1.50/1.75/2.50/3.25）與 2025-26 稅率（推定同 2026-27）；2024-25 是否有 hard cap；第二 apron 凍結籤「移到第 30 順位」的次數規則（4 季 2 季或 5 季 3 季）
- [ ] 每年 7 月聯盟公布新門檻時：Sheet `thresholds` 加下一季一列、`tax_rates` 加該季級距

### 2026-10-23 對戰分析

需求：做特定隊伍的交手前瞻或勝負預測時，能一眼看出灰狼對各隊的表現（勁敵、最擅長／最不擅長打的對手、特定數據對不同隊伍的好壞）。**不新增數據**：只用既有逐場資料在前端計算，不加 NBA request、不開新 Firestore 集合。計畫檔：`~/.claude/plans/majestic-launching-horizon.md`。

| Phase | 內容 | 狀態 | 提交 |
|-------|------|------|------|
| 0 | `backfill_games.py --clean-players`：多欄位對帳剔除舊賽季單場球員文件裡的非當時隊員，重建三季 bundle；單場面板快取鍵換 v3 | ✅ | `710b0de` |
| 1 | 資料層 `components/matchupData.js`（`window.Matchup`）＋`constants.js` 的 `MATCHUP_RULES`／`MATCHUP_TAGS`／`NBA_TEAM_NAMES` | ✅ | `0aef57d` |
| 2 | 對戰首頁 `MatchupHome.js`（`#vs`）：對手總表、指標 × 對手熱圖、單一指標排行、勝負關鍵因子、灰狼球員 × 對手；刊頭「對戰」與搜尋入口 | ✅ | `b4e7cb5` |
| 3 | 單隊對戰頁 `MatchupPage.js`（`#vs=DEN`）；`gamesData.loadGameDocs` 共用單場文件讀取（快取鍵換 `wt_gc_v2_`）；單場頁「歷次交手」連結 | ✅ | `2710c44` |
| 4 | Splits 期間加「對手」篩選 | ✅ | `b93aec0` |
| 5 | 更新規格文件 | ✅ | — |

驗證方式：Python 直接讀 Firestore **獨立實作**同一套計算，node 載入真正的前端原始碼（`constants.js`／`gameAggregates.js`／`matchupData.js`，加 window shim）餵同一批原始 bundle，逐值比對 850 項＋勝負關鍵因子 8 項全部一致；單隊頁 DEN／CLE／MIA 逐區塊和 Python 驗算一致；Splits 對手篩選和對戰頁同範圍 10 項一致。測試腳本在 session scratchpad，未進版控。

使用者確認過的決定（之後改動前先問）：
- **範圍**：預設「近三季」＝當季＋前兩季，**當季例行賽未滿 41 場時再多含一季**（開季時本季跟多數隊伍還沒交手，嚴格三季會有一半對手不到 6 場）；可切「只看本季」或指定單一賽季。賽別可選例行＋季後（預設）／例行／季後
- **標籤用中性字眼**：勁敵／順手／棘手，不用任何貶低對手的詞（使用者否決過「提款機」）。三種標籤都要交手 ≥ 4 場：
  - 勁敵＝「交手總場數＋季後賽場數」最高的前 3 隊（原本「季後賽交手過或 8 場以上分差 ±5 內」會標出 9 隊，太多）
  - 順手／棘手＝其餘對手中，場均分差偏離程度 z 最高／最低各 3 隊，且 |z| ≥ 1
- **排序與上色看偏離程度 z，不看原始差距**：z ＝（子集值 − 範圍值）÷（範圍內逐場標準差 ÷ √子集場數）。每個數字標場數，不足 4 場淡化。單季每隊只有 2–4 場，單季的「最擅長／最不擅長」大半是雜訊，這是預設近三季的原因
- **不給勝率數字**，改做「勝負關鍵因子」：全範圍勝場 vs 敗場的標準化差 d，排除分差、得分、失分（本身就是比賽結果）
- 對手本季整體表現（聯盟排名）**這次不做**，列為第二期（見 B2）
- 舊賽季單場球員清理用「多欄位對帳」，不補 box score（使用者選的，0 request）

### 2026-10-24 單場分頁＋介面統一

需求：單場頁不該掛主畫面的章節列、單頁太長（桌機約 3,900px／手機約 5,200px）；正式站另查出「開站跳回舊賽季」bug 與幾處重複控制項。計畫檔：`~/.claude/plans/glittery-giggling-kazoo.md`。

| Phase | 內容 | 狀態 | 提交 |
|-------|------|------|------|
| 1 | 主畫面賽季不存 localStorage（`selectedSeasonKey` 只認網址 `s=`，開站清掉舊值 `wt_pref_selectedSeasonKey`） | ✅ | `ee65637` |
| 2 | 單場頁改單場分頁（概要／Box Score／對比／投籃，網址 `tab=`）；新增 `UI.TabBar`／`UI.useTabKeys`，章節列、薪資頁、單場頁共用；數字鍵統一；App 返回鈕收成 `backBtn` | ✅ | `81c8559` |
| 3 | 攻守切換改「進攻端／防守端」；跨季疊圖賽別跟刊頭；近期異動場數跟總覽期間；`UI.Section` 右側手機自行換行（修 375px 橫向溢出） | ✅ | `7450ac3` |
| 4 | 更新規格文件 | ✅ | — |

使用者確認過的決定（之後改動前先問）：
- **賽季不記憶**：開站一律看當季，舊賽季只靠網址 `s=`；同一次瀏覽期間切過的賽季仍留在記憶體狀態（離開再回主畫面不重設）
- **單場分頁分組**：概要＝本場焦點＋本場 vs 季平均＋比賽資訊；Box Score＝兩隊 box＋展開進階（舊場次無 box 時改叫「球員進階」、放灰狼球員進階清單）；對比＝球隊對比；投籃＝本場投籃。沒內容的分頁不顯示，網址指定的分頁不存在就退回概要
- **換場次保留分頁**（賽程條 `‹ ›` 與各場連結帶目前 `tab`、不帶 `p`）；從月曆、刊頭、對戰頁進來一律從概要開始
- **數字鍵切目前畫面的分頁列**：主畫面 `1–6` 章節、單場頁 `1–N` 單場分頁、薪資頁 `1–4`；對戰頁沒有分頁列＝不作用。不再「按數字鍵離開獨立整頁」
- **同一個控制只放一處**：跨季疊圖的賽別跟刊頭例行／季後（`ComparisonTab` 收 `seasonType`＝App 的 `viewType`）；近期異動場數跟總覽「平均期間」（近 5／近 10，全季時用 5）
- 攻守切換標「進攻端／防守端」（含搜尋面板），避免和「防守」章節同一列出現兩個「防守」

### 2026-10-24 網址改用球員「ID-名字」＋賽季參數統一

需求：使用者覺得網址像亂碼。盤點後確認參數本來就全是英文，亂的是球員名字裡空白與重音的編碼（`Anthony%20Edwards`、`Mont%C3%A9%20Morris`）；另外主畫面舊賽季寫 `s=2025-26_playoffs`、當季卻是 `t=`，和薪資頁／對戰頁不一致。計畫檔：`~/.claude/plans/glittery-giggling-kazoo.md`。

| Phase | 內容 | 狀態 | 提交 |
|-------|------|------|------|
| 1 | 球員 `p=ID-名字`（`nameSlug`、`UrlState.playerToken`／`tokenPlayerId`）；App `wantPlayer` 等目標賽季名單再比對；單場頁、薪資頁、單場面板連結改新格式 | ✅ | `7f1b9ec` |
| 2 | 賽季 `s=年份&t=賽別`，舊格式相容；比對中只寫 ID | ✅ | `d532938` |
| 3 | 更新規格文件 | ✅ | — |

使用者確認過的決定（之後改動前先問）：
- **球員寫成「ID-名字」**：只用開頭的 NBA 球員 ID 對人，後面名字只給人看（寫錯、改名都不影響，載入後自動改回正確名字）。曾考慮純名字（怕球員改登錄名，如 Nah'Shon → Bones Hyland，舊連結對不到）與純 ID（看不出是誰），最後選兩者合併
- **賽季統一成 `s=年份&t=賽別`**：和刊頭（年份選單＋例行／季後）、薪資頁 `s=`、對戰頁 `r=&t=` 同一套；當季照舊不寫 `s`、一律寫 `t`（連結在不同時節打開才會是同一個賽別）
- **舊連結永遠要能開**：`p=Anthony%20Edwards`（完整名字）、`s=2025-26_playoffs`（舊 key）都照樣解析
- 指標 key（`m=D_FG_PCT`）維持大寫原樣

### 2026-10-24 網站圖示（PWA／加入主畫面）

需求：iPhone「加入主畫面」要有像樣的圖示。提案經多輪比較（字標／狼首／折線 → 帳本三款 → 帳本封面加籃球／月亮／狼首 → 官方 Logo 版 → 森林排版），定稿為「帳本立在林間空地、星空背景」。

- 原稿：`icons/icon.svg`（一般）、`icons/icon-maskable.svg`（Android 圓形裁切用，帳本縮到 0.76 落在半徑 40% 安全區內，樹林與星空維持滿版）；比稿過程的 SVG 在 `_mockup/pwa-icons/`（不進版控）
- 產物：`python scripts/build_icons.py` 用 `@resvg/resvg-js`（devDependency，`npm ci` 安裝）產 `apple-touch-icon.png`（180）、`icon-192.png`、`icon-512.png`、`icon-maskable-512.png`，PNG 要一起提交
- `manifest.webmanifest`：`short_name` 灰狼帳本、`display: standalone`、`start_url`／`scope` 用相對路徑 `./`（Pages 掛在子路徑）；`index.html` 另加 `apple-touch-icon` 與 `apple-mobile-web-app-*`（狀態列 `black`，不用 `black-translucent` 以免內容被瀏海蓋住）
- 刊頭站徽（`Masthead`）改用 `icons/icon.svg`；身分列、頭像列的「全隊」仍是 NBA 官方 Logo（那裡代表球隊本身）

使用者確認過的決定（之後改動前先問）：
- **圖示元素**：帳本在正中央、書脊無字（四道凸條）、封面是原創幾何狼首、兩側松樹由外往內遞減（中間淨空讓帳本突出）、帳本立在小丘上、不放月亮、星空補星光。比過官方 Logo 版後仍選原創
- **配色只用品牌色系**：深藍底、月光銀、品牌綠（書脊），森林用低對比的藍灰／極深綠，不另加橘色籃球等色票外顏色
- **分頁小圖示（favicon）維持內嵌的 W**：新圖在 16px 會糊成一塊
- **不加 service worker**：加到主畫面不需要，加了要多處理快取換版

### 2026-10-26 每日抓取看門狗

起因：使用者常在白天發現「昨晚那場沒抓到」。查證後 10/26 那次其實不是失敗——03:00 主排程（≈ 美東前一天 14:00）在比賽開打前就跑完，美東晚上的比賽要等隔天 03:00 才上站，**每場比賽約賽後 17～20 小時才看得到**；再加上開季以來另有被擋誤判、程式崩潰（10/24 `NameError`）、筆電用電池時排程直接跳過等失敗型態，沒人發現。

做法（方案 C：03:00 主排程照舊＋15:00 看門狗分級補抓，每次最多補抓一次）：
- `scripts/watchdog.py`：台北 15:00（≈ 美東 02:00，最晚的西岸場剛打完）檢查兩件事——**今天主排程有沒有完成**（讀 `fetch_status.json`，不看快照文件在不在：沒比賽的日子數據相同會被 dedup 跳過寫入）、**賽程上最新一場在不在 `wolves_player_games`**。前者沒完成 → 完整抓取（約 95 requests）；後者缺 → `fetch_data.py --games-only`（約 26 requests：名冊 1＋賽程 1＋單場 24）。補完再檢查一次，成功／失敗都跳通知；正常只花 1 個 request（讀賽程）、不通知
- 下午補抓的單場未過定稿門檻（`final=False`），隔天 03:00 主排程照「單場數據」的定稿規則自動重抓成最終版，**不必另外處理**
- `fetch_data.py`：新增 `--games-only`；每次執行寫 `fetch_status.json`（`full`／`games` 分開記 `ok`、`finishedAt`、`etDate`、`note`）；「Synergy 與 base 皆空」改以**結束碼 2** 結束、Firebase 初始化失敗結束碼 1（舊版都是 0，排程看不出來）
- 主排程與看門狗同時啟動（電腦 03:00、15:00 都沒開機，開機登入後兩個一起補跑，**啟動順序不保證**）：看門狗讀 `WolvesTracker` 的上次執行時間，早於最近一次應觸發時間（觸發時刻從排程讀，不寫死 03:00）＝錯過待補跑 → 先等它啟動（每 30 秒看一次，最多 10 分鐘，`WAIT_MAIN_START_MINUTES`），再等它跑完（最多 60 分鐘）；10 分鐘都沒啟動（如被停用）才由看門狗自行補抓並記 `⚠️`。另外也偵測系統中執行中的 `fetch_data.py`（含終端機手動執行）一樣等它跑完；`Win32_Process` 會列出已結束但仍被握著 handle 的殘影程序（`HasExited=True`，重開機才消失，2026-10-26 遇過 10/23 的 `backfill_history.py` 殘影），偵測時以 `Get-Process` 確認還活著才算，避免殘影讓看門狗每天白等 60 分鐘。主排程 03:00 有跑但失敗時上次執行時間是當天，不等、照常補抓。2026-10-26 修補（初版只看排程狀態，看門狗若先啟動會和主排程同時完整抓取）
- 通知：PowerShell 5.1 內建 toast（借用 Windows PowerShell 的 AppUserModelID，免註冊、免套件；pwsh 7 沒有 WinRT 不能用）；勿擾／專注模式時不跳出但留在通知中心
- `WolvesTracker` 一併改為**用電池可啟動、拔電不中斷**（原設定備份在 `~/.claude/ops/backup-20261026/WolvesTracker-task.xml`）

使用者確認過的決定（之後改動前先問）：
- **檢查只在 15:00 一次**（不另設 04:00 檢查主排程）；主排程 03:00 不動
- **只在有補抓或失敗時通知**，正常的日子不吵；回報用桌面通知＋log，不用 Email／Claude 排程任務
- **分兩級補抓**：只缺單場時不重抓整份快照（省約 70 requests、降低被擋風險）

---

## 專案檔案結構

```
wolvestracker/
├── index.html                       ← HTML 骨架 + Firebase 初始化，引用 dist/components-bundle.js
├── components/                      ← React 元件原始碼（編輯這裡）
│   ├── Icons.js                     ← SVG icon set，掛 window.Icons
│   ├── ui.js                        ← 設計系統 window.UI（StatCell/Ledger/DataTable/Seg/TabBar/Section/PctBar、複製引用、匯出）
│   ├── glossary.js                  ← 指標定義 window.GLOSSARY（「?」小卡內容）
│   ├── constants.js                 ← 標籤與 defs / SEASON_OPTIONS / getSeasonPhase / 快照讀取範圍（SNAPSHOT_SINCE/UNTIL、snapshotWindowStart）/ nameKey、nameSlug
│   ├── MetricComponents.js / PlayTypeCard.js / PlaytypeSection.js / TrackingCardRow.js
│   ├── ShotChart.js / DefenseHeatmap.js ← 投籃熱圖、防守熱圖
│   ├── gameAggregates.js / gamesData.js ← GameAgg 逐場重算、bundle／索引／單場文件（loadGameDocs）載入
│   ├── matchupData.js               ← 對戰分析資料層 window.Matchup（範圍、對手彙整、偏離程度 z、標籤、勝負關鍵因子）
│   ├── SingleGamePanel.js / Highlights.js ← 單場面板、近期異動
│   ├── GamePage.js                  ← 單場比賽頁（#game=日期[&tab=]，單場分頁）
│   ├── CapPage.js                   ← 薪資頁（#cap）：CapCalc 計算、loadCapDoc／loadCapContrib 載入、各分頁區塊
│   ├── MatchupHome.js / MatchupPage.js ← 對戰首頁（#vs）、單隊對戰頁（#vs=三碼）
│   ├── OverviewTab.js / SplitsTab.js / ShootingTab.js / ComparisonTab.js / RadarPanel.js / HistoryModal.js
│   ├── SeasonPaceChart.js           ← 疊圖：LineOverlay（通用多序列折線）＋ SeasonPaceChart（賽季軌跡）
│   ├── urlState.js                  ← 網址 hash 讀寫
│   ├── Masthead.js / GameCalendar.js / RosterRail.js / IdentityBar.js / ChapterNav.js / CommandPalette.js ← 版面骨架、賽程月曆與快速搜尋
│   └── App.js                       ← 主容器：資料訂閱、狀態、版面組裝
├── styles/app.css                   ← Tailwind 入口＋全站基礎樣式（背景、焦點框、減少動態）
├── tailwind.config.js               ← 字體、slate-500/600 對比調整
├── package.json / package-lock.json ← 鎖定 esbuild、tailwindcss、@resvg/resvg-js 版本（npm ci）
├── manifest.webmanifest             ← PWA 設定（名稱、standalone、圖示清單）
├── icons/                           ← 網站圖示：icon.svg／icon-maskable.svg 原稿＋build_icons.py 產的 PNG
├── dist/
│   ├── components-bundle.js(.map)   ← 自動產生，勿手改
│   └── app.css                      ← 自動產生，勿手改
├── scripts/
│   ├── nba_common.py                ← 共用模組：SESSION/重試/欄位設定表/所有抓取函式
│   ├── fetch_data.py                ← 每日當季數據爬蟲（含寫入前去重；--games-only 只抓單場；執行結果寫 fetch_status.json）
│   ├── watchdog.py                  ← 每日抓取看門狗（15:00 檢查、分級補抓、桌面通知；--dry-run／--test-notify）
│   ├── backfill_history.py          ← 歷史賽季回補腳本（import nba_common）
│   ├── fetch_shotchart.py           ← 投籃熱圖爬蟲（每週，逐球員 + 全隊）
│   ├── backfill_games.py            ← 單場數據回補（DateFrom=DateTo 逐場；--index-only 產索引；--box-only 只補 box score；--clean-players 對帳剔除非當時隊員）
│   ├── sync_salary.py               ← 薪資同步：Google Sheet 發佈的 CSV → wolves_salary/main（每日排程順跑）
│   ├── backfill_queue.txt           ← 回補佇列（已清空）
│   ├── cleanup_and_tag.py           ← 一次性：補貼舊文件 seasonType、刪除完全相同的後續日期
│   ├── build_icons.py               ← 網站圖示：icons/*.svg → apple-touch-icon／manifest 用 PNG
│   └── bundle.py                    ← 前端打包（合併＋esbuild＋Tailwind＋版本號）
├── run_fetch.bat                    ← Windows 排程：當日數據＋薪資同步（*.bat 被 .gitignore 排除，不進版控）
├── run_watchdog.bat                 ← Windows 排程：看門狗（參數原樣傳給 watchdog.py，可手動 `run_watchdog.bat --dry-run`）
├── fetch_status.json                ← fetch_data.py 執行結果（看門狗讀；本機產物，不進版控）
├── watchdog_log.txt                 ← 看門狗每日一行結論（watchdog_err.log 收未捕捉例外；皆不進版控）
├── _salary_seed/                    ← 薪資 Sheet 的本地參考副本（未進版控；Sheet 才是資料來源）
├── run_shotchart.bat                ← Windows 排程：每週投籃熱圖
├── run_backfill_next.bat            ← Windows 排程：回補 queue 第一行（已可刪）
└── doc/
    ├── handover.md                  ← 本文件
    └── plan.md                      ← 4 階段執行計畫
```

---

## 開發工作流程

### 編輯前端
0. 新電腦第一次：專案根目錄跑 `npm ci`（依 `package-lock.json` 安裝鎖定版本的 esbuild / tailwindcss / resvg 到 `node_modules/`，不進版控）
   - 只有改網站圖示（`icons/*.svg`）時才需要另跑 `python scripts/build_icons.py`，並提交產出的 PNG
1. 改 `components/*.js`
2. `python scripts/bundle.py` 重新打包（合併 → esbuild 編譯 JSX → Tailwind 產 CSS → 蓋版本號）
3. `python -m http.server 8000` 啟動本地伺服器
4. 瀏覽器開 `http://localhost:8000`，Ctrl+F5 強制重整
5. 確認無誤後 commit `components/`、`dist/`（`components-bundle.js`、`.map`、`app.css`）與 `index.html`，推送 GitHub Pages
   - `bundle.py` 每次會把產物內容雜湊寫進 `index.html` 的 `components-bundle.js?v=…`、`app.css?v=…`（Pages 一律快取 10 分鐘，不加版本號會出現「新 HTML＋舊檔」）——所以 `index.html` 也會有 diff，記得一起提交

### 前端建置（2026-10 起預先編譯）
- 以前：瀏覽器載入 Babel Standalone（約 2.3 MB）即時編譯 JSX、Tailwind CDN（約 400 KB）即時產 CSS。現在兩者都在 `bundle.py` 事先做完，首次造訪少下載約 667 KB（壓縮後），掛載時間約 740ms → 約 100ms
- `dist/components-bundle.js`：esbuild `--target=es2018`（`?.`／`??` 會降級，舊手機也能跑），只壓空白與語法、**不改名識別字**（元件靠頂層名稱與 `window.*` 互相引用）；`.map` 供除錯對照原始碼
- `dist/app.css`：Tailwind 3 CLI 掃 `components/**/*.js` 與 `index.html`，只輸出用到的 class。**class 必須完整寫在原始碼**，不可字串拼接（`text-${c}-400` 會掃不到）
- `index.html` 的 bundle 用 `<script defer>`：與 `type="module"` 的 Firebase 初始化同屬「解析完依序執行」，保證元件在 Firebase 之後執行
- 合併後未編譯的 JSX 暫存在 `.build/`（不進版控）

### 版面骨架與網址狀態（2026-10 Phase 3）
- **開站首頁＝最新一場單場頁**（2026-10-23）：網址沒帶畫面時 App `homePending` → `loadSeasonSchedule(CURRENT_SEASON)` 取最後一場開單場頁；當季未開打就推算上一季（不讀手動維護的 `HISTORY_SEASONS`）；找的期間不寫網址、主區顯示「載入最新一場…」；連不上雲端 8 秒後退回總覽；`hashchange` 會取消 pending。分享連結（`v=`/`game=`/`cap`）不受影響
- 由上而下：`Masthead`（Wolves Ledger 字標、期別行、賽季下拉（只列年份）／例行·季後（常駐）／賽程月曆 `GameCalendar`／薪資／複製連結／搜尋）→ 休賽/陳舊細條 → `RosterRail`（全隊＋球員頭像 chips，尾端「本季無數據」淡色 chips：當季只提示＋「查看最近一季」按鈕，歷史賽季才直接 `jumpToPlayerHistory` 探測）→ `IdentityBar`（4 個主數字，與總覽同源 `GameAgg.seasonToDate`；時光機「數據截至」日期＋「回最新」，僅當季，2026-10-23 從刊頭搬來——它影響所有章節，放每章都看得到的地方）→ `ChapterNav`（`UI.TabBar`，sticky，01–06 章節＋攻守視角「進攻端／防守端」；攻守只在 `TABS` 標 `sided` 的章節顯示）→ 內容。單場／薪資／對戰是獨立整頁，**不掛章節列**，左上「← 回主畫面」（App `backBtn`）
- 舊左側欄已移除；雷達＋疊加比較由 App 組成 `radarSlot` 傳入 `OverviewTab`
- 網址 hash（`components/urlState.js`）：`#v=player&p=1630183-jaden-mcdaniels&tab=shooting&s=2024-25&t=playoffs&d=2026-06-15&side=def`，只寫非預設值；**有 `v=` 時完全以網址為準**，沒寫的項目＝預設（當季/總覽/進攻/最新日），不退回 localStorage——否則同一條連結會因電腦不同而開出不同畫面
- **2026-10-19 新增**：
  - `m`＝Splits 打開逐場走勢的指標 key、`hl`＝走勢上圈出的那一場日期（僅 `tab=splits`）。App 以 `focus = {m, hl, key}` 保存，`key`＝「實體＋章節」：Splits 內換球員保留 `m`、拿掉 `hl`；離開 Splits 清掉。Splits 開關走勢／換指標會回報（`onFocusChange`），網址跟著記住
  - **球員 `p=ID-名字`**（2026-10-24）：`UrlState.playerToken(id, name)` 組（名字部分 `window.nameSlug`＝`nameKey` 後非英數字換 `-`），`tokenPlayerId(p)` 解（符合 `^\d+(-[a-z0-9-]*)?$` 取開頭數字，否則 `null`＝舊連結的完整名字）。App 不直接把網址的 p 塞進 `selectedPlayer`：`wantPlayer = {pid|name, seasonKey}` 交給「自動修正 selectedPlayer」effect，**等 `loadedSeasonKey()`（由 `playerHistory[0].date` 推回：日期字串＝當季、賽季標籤＝歷史）等於目標賽季才比對**（ID 用 `playerIdOf`、名字用 `nameKey`），避開切季那一拍舊名單誤判成「沒有這個人」而退回第一人；比對期間網址只寫 ID（或舊名字），不配上前一位球員的名字。網址帶 ID 時 `selectedPlayer` 初值留空，不先閃出 localStorage 記住的球員
  - **賽季 `s=年份&t=賽別`**（2026-10-24）：歷史賽季寫 `s=2025-26&t=playoffs`（例行賽也寫 `t=regular`）；parse 時 `s=當季年份` 視為當季、舊 key `s=2025-26_playoffs`／`s=current` 照收；`t` 只在當季寫進 `seasonTypeView`（歷史賽季的賽別在 key 裡，不可改到當季賽別）
  - 單場頁 `#game=日期&tab=box&p=展開的球員`（**沒有 `v=`**）。`tab`＝單場分頁 box／compare／shots（省略＝概要，2026-10-24）；`p` 是展開進階的灰狼球員、只在 `tab=box` 寫入，不改主畫面的 `selectedPlayer`；**舊連結只帶 `p=` 時 parse 成 `tab=box`**；`p` 同主畫面寫「ID-名字」，GamePage 先用 ID 對、舊名字才比名字，對到後把網址改寫成目前的 token。App 以 `gameTab` 保存，切分頁用 `replaceState`，離開 Box Score 清掉 `p`
  - 薪資頁 `#cap&s=2025-26&tab=contracts`（2026-10-20，**沒有 `v=`**）：`s`＝薪資賽季（省略＝薪資當季，7/1 切換）、`tab`＝contracts／picks／rules（省略＝總覽）。進出同單場頁（改 `location.hash`、「← 回主畫面」直接切回）；切分頁、換賽季用 `replaceState`
  - 進出單場頁一律改 `location.hash`（產生瀏覽紀錄，返回鍵可回上一頁）；單場頁期間主畫面狀態不動，「← 回主畫面」直接切回（不用 `history.back()`：從外部連結直接打開時會離開本站）
  - 改刊頭賽季／賽別／日期、用搜尋面板 → 都會先離開單場頁；數字鍵在單場頁切單場分頁（2026-10-24 起，不再離開）
  - 對戰分析（2026-10-23，**沒有 `v=`**）：首頁 `#vs[&r=cur|YYYY-YY][&t=regular|playoffs]`、單隊頁 `#vs=DEN[&r=][&t=][&m=指標]`。`r`／`t` 是對戰自己的範圍（省略＝近三季、例行＋季後），**不改主畫面的賽季／賽別**；`m` 只在單隊頁有效（從首頁熱圖點格子帶入，標亮並捲到該指標）。App 以單一 `vs` 物件 `{team, range, type, metric}` 保存；首頁↔單隊頁用 `openVs()` 改 `location.hash`（沿用目前範圍），切範圍／賽別用 `replaceState`；`leaveGame` 一併關掉對戰（對戰頁沒有分頁列，數字鍵不作用）
- 網址帶日期時用 `pendingDateRef` 延後套用：資料載入 effect 一開始會清空 `selectedDate`
- 狀態變動用 `history.replaceState`（不產生瀏覽紀錄）；同分頁貼上新連結靠 `hashchange` 套用
- 快捷鍵：`/` 開 `CommandPalette`（球員/章節/賽季/攻守/賽別/最近 10 場比賽，比對走 `nameKey`）；數字鍵切**目前畫面的分頁列**——主畫面 `1–6` 章節（App 全域 keydown，`ownPageRef` 為真時不處理）、獨立整頁用 `UI.useTabKeys(keys|() => keys, onChange)`（單場、薪資；hook 要在提早 return 之前呼叫，分頁清單晚點才知道時傳函式）；輸入框聚焦或 Modal 開著時不攔截
- **主畫面賽季不存 localStorage**（2026-10-24）：`selectedSeasonKey` 初值＝網址 `s=` 或 `current`，App 掛載時刪除舊版的 `wt_pref_selectedSeasonKey`。原本存了會讓開站首頁（單場）回主畫面跳到上次看的舊賽季，`#vs`／`#cap` 刊頭賽程膠囊也顯示上季最後一場

### 2026-10-23 Hustle 欄位補齊與防守分頁重排
- `HUSTLE_FIELDS` 由 7 欄增為 15 欄：新增干擾兩分、掩護助攻得分、進攻／防守端地板球、進攻／防守卡位、卡位後自己搶下籃板與比例（干擾三分原本就有抓，這次才上畫面）。endpoint 另有 6 欄**刻意不抓**（已與使用者確認）：`BOX_OUT_PLAYER_TEAM_REBS`、`PCT_BOX_OUTS_TEAM_REB`（恆等於卡位／100%）、`PCT_BOX_OUTS_OFF/DEF`、`PCT_LOOSE_BALLS_RECOVERED_OFF/DEF`（可由次數推得）
- 前端 `defenseDefs` 依重要性排序：最近防守者 → 防守 Box → 拼勁（`Hustle`，只放防守向）→ 掩護與卡位（`Screens`，新群組，資料同在 `doc.defense`）。球隊防守頁：防守 Box → 對手分區 → 拼勁 → 掩護與卡位
- 有逐場資料的防守群組集中在 `window.GAME_DEFENSE_IDS`（單場頁展開列、Splits、跨季疊圖讀它）；新增 Hustle 類群組要加進來
- `GameAgg.RATIO_DEFS` 加 `PCT_BOX_OUTS_REB`（不以 `_PCT` 結尾，不加會被當次數相加）
- **球隊版 endpoint 沒有 `BOX_OUT_PLAYER_REBS`／`PCT_BOX_OUTS_REB`**：`fetch_hustle` 只寫 headers 裡真的有的欄位（舊版被 `safe_col` 補成 0，2026-10-23 前寫入的球隊文件仍存著假 0）；前端這兩項標 `playerOnly`，全隊的防守分頁、跨季比較、疊圖一律不顯示
- 歷史快照補齊：`backfill_history.py --season X --type Y --only-hustle`（每份 2 requests，只把 Hustle 併入既有 `defense`，其他類別不動；只更新 doc 裡已有的球員）。2023-24～2025-26 例行賽／季後賽與 2022-23 例行賽共 7 份已補；**2022-23 季後賽未補**（使用者決定放棄，該季新欄位顯示「—」）。注意：腳本寫入完成後 Python 程序可能卡住不退出（推測是 Firestore 連線收尾），看到 ✅ 就代表已寫入。**逐場資料（單場頁／Splits／疊圖）的新欄位只從 2026-10-24 之後的比賽開始有**，過去場次未回補（約 800 requests，需另外分批）

- **起因**：開季 NBA 未釋出 Synergy → 舊守門整次不寫入 → 線上舊前端名單取 `stats` 為空，點球員全被當「本季無數據」自動探測到 2025-26。修法見「每日快照」的寫入守門，以及下列 UI 規則
- **預設一律看進行中賽季**：當季點「本季無數據」的球員不自動切季（頭像列與搜尋面板同一個 `onMissingPlayer`），提示列附「查看最近一季 →」由使用者明確觸發 `jumpToPlayerHistory`
- **刊頭賽季／賽別**：賽季選單只列年份（`window.SEASON_YEAR_OPTIONS`：`current` ＋ `HISTORY_SEASONS`），例行／季後切換常駐（歷史賽季也能切）。App 的 `changeYear`／`changeType` 把「年份＋賽別」對回既有狀態 `selectedSeasonKey`（`2025-26_playoffs`）＋`seasonTypeView`，**網址 `s=`／`t=` 格式不變**。換歷史年份沿用目前賽別；回當季改用時節預設賽別（10 月切去當季季後賽只會是空畫面）。當季沒有季後賽快照時「季後賽」停用（`playoffsAvailable`）；只有一天快照時日期選擇器停用。歷史賽季刊頭不放「期末快照」膠囊（期別行已寫）
- **攻守切換**：`App.TABS` 的 `sided: true`（目前總覽、Playtype）才在章節列顯示；新章節內容用到 `viewSide` 就加上
- **「?」合併複製引用**：見「寫作工具」；`UI.Seg` 的 option 可帶 `disabled`／`title`
- **指標長名稱**：defs 的 metric 可加 `longLabel`（例：兩個「有效命中率」→ 接球跳投／急停跳投）。平鋪清單（跨季疊圖下拉、跨季比較表）一律用 `window.metricLabel(m)`，卡片內維持短 `label`。疊圖選單同 key 只列一次（追蹤 REB 與基本 REB 重複）
- **賽別縮寫**：`HISTORY_SEASON_OPTIONS.short` 由「例／季」改「例行／季後」（「季」會被讀成賽季）；跨季比較表表頭改兩行（上年份、下賽別）
- 單場頁「本場 vs 季平均」：`avgAgg === null`（本季無更早逐場）顯示「—」，`undefined` 才是載入中「…」
- 全站捲軸：`styles/app.css` 的 `scrollbar-color`（月光銀半透明＋透明軌道）

### 寫作工具（2026-10 Phase 5）
- **複製引用**：`UI.citeLine` 組字串；入口是「?」小卡底部的「複製引用」（`UI.Info` 帶 `cite`，2026-10-23 起每格只留一個圖示），沒有 glossary 定義或沒有「?」的地方才用獨立 `UI.CopyBtn`。`cite`／`text` 一律傳**函式**（點擊當下才組字串，句尾網址才是當下畫面），格式「主體｜賽季｜（期間）｜截至日期｜指標（原文） 數值｜資料：來源｜當下畫面網址」（網址含 hash，可從引用回到原畫面查證；總覽「近 N 場」切換不在網址裡，但期間已寫在引用文字中）。情境由 App 每次 render 寫入 `window.CiteCtx`：**快照數字引用快照日（asOfSnap）、GameAgg 逐場重算的平均引用截至日（asOfAgg）**，兩者可能不同；Splits/單場/Clutch 以 `citeNote` 附期間或場次。`StatCell` 的 `citeAsOf`／`citeNote` 由 `TrackingCardRow` 傳入
- **指標定義**：`components/glossary.js`（`window.GLOSSARY`，key → def/calc/src/verify），`UI.Info` 顯示「?」小卡；名稱仍以 constants.js 為單一來源，glossary 只寫意思。`verify: true` 的條目畫面會標「待確認」
- **近期異動**：`components/Highlights.js`，近 N 場 vs 全季（截至 untilDate；N 由 `OverviewTab` 依「平均期間」傳入，近 5／近 10，全季時用 5，本區不另放切換），排序＝|Δ| ÷ (逐場標準差 ÷ √N)，|分數| < 1 不列；命中率需近 N 場出手達門檻（FG 25、3P 10、FT 8）
- 刊頭「複製連結」＝複製含 hash 的目前網址
- **匯出**（`UI.ExportMenu`／`exportCSV`／`exportPNG`）：表格（Playtype、陣容、跨季比較、Splits、投籃分區）可匯出 CSV（第一列為出處、UTF-8 BOM 供 Excel）；投籃分布、雷達、趨勢圖與表格可匯出 PNG 配圖（16:9＝1600×900、1:1＝1080×1080，含字標／標題／主體·賽季·日期／來源）
  - `html-to-image@1.11.13`（jsDelivr）只在第一次匯出時載入
  - 配圖不放 NBA Logo／頭像：跨網域圖片會讓畫布無法輸出，也避免在配圖上用官方商標
  - 踩過的雷：配圖根節點不可 `position:fixed`+負座標（會整張空白）→ 外層 holder 負責藏到畫面外
  - 匯出時移除複製鈕、「?」與 `data-export-hide` 標記的元素
- **複製純文字（臉書）**（2026-10）：`ExportMenu` 的 `text` 選項（`() => string`，回 `null`＝呼叫端自行處理，例如資料未載完就跳 toast 不複製），複製到剪貼簿；臉書不吃表格、字寬不一，所以**不靠空格對齊**，改用「｜」分隔
  - 跨季比較表（`ComparisonTab` 的 `fbText`）：標題【主體｜跨季比較・類別】→ 賽季表頭列 → 一行一指標「指標 原文｜各季值」→ 說明 → 資料來源 → 畫面網址。數字格式與表格同（`fmt`）；全選同賽別時表頭只寫年份、第一格放賽別，混選才用「24-25例行」；有「—」／「@隊名」才附對應說明；Playtype 列前加中文名（取 `GLOSSARY.PT_*` 定義冒號前的字）
  - 折線圖（`TrendChart`，跨季／Splits／投籃三處共用）：點 ≤6 寫成一行箭頭「24-25例行 34.4% → 25-26例行 31.5%」，點多則一行一點「日期｜值」；有基準線附「全季平均」。`unit` 參數決定數值後綴（百分比傳 `'%'`）；標題賽季預設取 `CiteCtx.season`，跨季比較傳 `citeSeason={false}` 省略（各點已標賽季）
  - `TrendChart` X 軸：只有日期標籤（`YYYY-MM(-DD)`）去掉年份，其他標籤原樣顯示（曾用 `slice(5)` 一律砍前 5 字，跨季的「24-25例行」只剩「例行」）
  - `TrendChart`（2026-10-19）：點帶 `wl` 時鋪勝負底色（`GameAgg.trendSeries` 逐場粒度會帶；投籃走勢從 `gameMeta` 補）；`highlight`＝要圈出的點 label，窄螢幕會自動橫捲到該點；`onPointClick`＝點擊某點（Splits 用來開單場頁）。跨季章節已改用多序列的 `LineOverlay`，不再用 `TrendChart`

### 設計系統（2026-10，`components/ui.js` → `window.UI`）
- 字體：`font-sans`＝Noto Sans TC（內文/中文）、`font-display`＝Barlow Condensed（大數字/標題）、`font-mono`＝JetBrains Mono（小標籤/NBA 原文/表格數字），定義在 `tailwind.config.js`，字型檔由 `index.html` 的 Google Fonts 載入
- 背景：底色 `#0A1626`＋刊頭淡光暈＋極淡顆粒，寫在 `styles/app.css` 的 `@layer base`
- 元件：`UI.StatCell`（指標格，數值三態：0 照常顯示／無資料「—」／不適用「—」+ tooltip）、`UI.Ledger`＋`UI.ledgerCols(n)`（細線數據表，依指標數選能整除的欄數）、`UI.PctBar`（百分位色階條，紅→月光銀→綠；**只給真的有 percentile 的資料**）、`UI.Delta`（漲跌）、`UI.DataTable`（可排序表格，手機首欄固定且限寬換行）
- 2026-10-24 補：`UI.TabBar`（sticky 分頁列，章節列／薪資頁／單場頁共用；`numbered` 標 01 02… 快捷鍵提示、`right` 放右側控制項、`bleed` 在 `<main>` 內用負邊距撐滿）、`UI.useTabKeys`（數字鍵切分頁）。新的分頁列一律用它，不要再複製一份 JSX
- Phase 4 補：`UI.Section`（區塊標題＋小字原文＋說明＋右側操作，accent 色標保留舊色條語意：攻綠/守紅/Clutch 琥珀/結構藍；右側容器 `max-w-full`，手機上自行換行不撐寬頁面）、`UI.Note`（空狀態）、`UI.Chip`／`UI.selectClass`（篩選膠囊）
- 新區塊一律用這些元件組，標籤寫「中文＋小字原文」，風格自動一致

### 各章節（2026-10 Phase 4）
- 總覽：季平均可切「全季｜近 5 場｜近 10 場」（同一截至日，`GameAgg.lastN`＋`aggregate`；全季只列身分列沒有的 6 項，近 N 場列完整 10 項）；**Playtype 強弱項**（Synergy 百分位，門檻每場球權 ≥ 1.0、排除 Misc；強項只列 ≥ 50、弱項只列 < 50——攻守百分位皆越高越好，已用資料驗證：防守 PPP 越低百分位越高）；雷達移入；On/Off 顯示「在場 − 離場」差值；陣容手機只顯示姓氏
- Playtype：`PlaytypeSection.js`，預設 Synergy 式可排序表格（Freq/Poss/PPP/百分位/FG%），可切卡片（`wt_pref_playtypeView`）
- 投籃：命中率格可點看趨勢；熱圖命中＝實心綠點、未中＝空心紅環，球場線月光銀畫在點下方
- 投籃「與上季比」（2026-10-19，分區組）：打開時才讀上一季同實體 shotchart（`loadShotDoc`，與本季共用解析與 `__shootTabCache`）；本季套期間篩選、上季一律全季；格子加「上季 % ／差／占比」，下方 `ZoneDiffCourt` 半場圖；任一季該區出手 < 10 標灰；上季無文件時按鈕顯示「XXXX 無資料」
- Splits「防守」欄位組（2026-10-19）：`defenseDefs` 的 MatchupDefense＋Hustle（DefenseBox 沒有單場值不列），只顯示該實體有值的組（球隊沒有最近防守者）。各欄位組的 defs 集中在 `GROUP_DEFS`；基本數據定義移到 `constants.js` 的 `SPLITS_BASE_DEF` 共用
- 防守熱圖：顏色為「不透明預混色」（`blend()`），避免各區半透明疊色互相污染；基準值 `ZONE_REF` 為寫死的聯盟約略均值，畫面上會直接標出，**非官方即時數字**
- 走勢 Modal：賽別預設沿用刊頭的例行/季後（舊版用日期判斷，休賽期誤設例行賽）；Esc 關閉；「近 N 筆」（每筆是一份快照，不一定是一場比賽）
- 雷達關閉進場動畫（使用者不要進場動畫，且截圖/切換時圖形不會只畫一半）
- 當季快照訂閱：略過「fromCache 且為空」的 snapshot——斷網時 Firestore 會先丟本機空結果，不可顯示成「當季尚無快照資料」
- 已知資料缺口：2025-26 球員季後賽 06-15 快照的 Playtype `freq`（POSS_PCT）NBA 全回 0 → 前端視為「未提供」顯示「—」，**不自行用 possTotal 推算**（NBA 不列低球權類型，推算值失真）

### 效能與無障礙（2026-10 Phase 6）
- **當季快照先只讀近期**（`App.js` 的 `snapFull`／`snapFullReady`，`constants.js` 的 `snapshotWindowStart()`）：
  - 開站只讀最近幾天：賽季中＝今天往前 10 天；休賽期＝6/30 往前 30 天。整季約 120 份、首次傳輸近 9 MB，第一屏只需要「當期＋前一期」
  - 何時補讀整季：選了日期、開走勢 Modal、目前賽別在近期快照裡不足兩份、或近期查詢回 `failed-precondition`（缺索引）
  - 補讀期間顯示載入骨架，**不可**顯示「沒有快照」，也不可把最新一天的數字標成所選日期（`showSkeleton` 的兩個條件）
  - 只用 doc id 範圍查詢：`orderBy(documentId,'desc')`／`limitToLast` 需要 `__name__` 降冪索引，已實測會被拒
  - 權限或網路錯誤**不**改讀整季（改讀也不會好），照常顯示錯誤
- **不擋首屏**：React／Recharts／prop-types 用 `<script defer>`（與 module 型 Firebase 初始化、bundle 同屬依序執行佇列，順序不變）；Google Fonts 用 `rel="preload" onload` 非阻斷載入＋`<noscript>` 退路
- **對比（WCAG AA，小字 ≥ 4.5:1）**：`tailwind.config.js` 把 slate-500 改 `#8493A8`、slate-600 改 `#7C8CA2`（原生值在 `#0A1626` 上只有 3.8／2.4）。全站 slate-500/600 只當文字色用；若要拿來當底色或框線，先確認不受影響
  - 品牌色當底時字用深藍 `#0A1626`（白字在綠底 3.4、紅底 3.8 皆不足）；品牌色字配同色淡底用 `/[0.08]`
  - 結構藍 `#236192` 在深底只有 2.8，不可當小字色；連結改用月光銀
- **觸控目標 ≥ 24×24 且不重疊**（PageSpeed 量的是按鈕本身的框，不算 `::before` 外擴）：
  - `UI.Info`（「?」）按鈕本身 24px、內圈 16px，只用上下負邊距，**不可用左右負邊距**（會壓到相鄰複製鈕／排序鈕）
  - `StatCell` 標題列右側留 `pr-8`，避開右上角複製鈕
  - 表頭排序鈕 `min-h/min-w-[24px]`；小按鈕用 `py-1` 補高度
- 鍵盤焦點：`styles/app.css` 的 `:focus-visible` 綠框；`prefers-reduced-motion` 時關過場動畫
- **驗證方式**（無自動化測試，皆手動執行）：
  1. `python scripts/bundle.py` 後用本地 `python -m http.server 8000`
  2. 背景 Chrome（Node 內建 WebSocket＋CDP）跑情境腳本：桌面 1440／手機 375–412 截圖、讀 DOM 斷言、console 錯誤
  3. 無障礙：逐一文字節點算對比（含疊加的半透明底）、找無名稱按鈕、檢查按鈕框大小與重疊
  4. 效能：CDP 加慢速 4G（1.6 Mbps、150ms）＋CPU 4 倍降速，量 `first-contentful-paint`／LCP 與各網域傳輸量
  5. 上線後用 PageSpeed Insights（網頁版；API 匿名額度為 0）看無障礙與總傳輸量
  - 測試腳本放在 session scratchpad，未進版控；重建時照上述方法即可

### bundle.py 合併順序
見 `scripts/bundle.py` 的 `ORDER`（依賴者在後，`App.js` 最後）。元件靠共用 script scope 與 `window.*` 互相引用，所以順序就是依賴順序。

---

## 自動化排程（Windows Task Scheduler）

| 排程名稱 | 時間 | 腳本 | 用途 | Log |
|---|---|---|---|---|
| `WolvesTracker` | 每日 03:00（喚醒＋錯過補跑＋用電池可跑） | `run_fetch.bat` | 抓累積快照（與前一筆完全相同則跳過寫入）＋補抓單場；接著跑 `sync_salary.py`（休賽期也會跑） | `fetch_log.txt` |
| `WolvesWatchdog` | 每日 15:00（喚醒＋錯過補跑＋用電池可跑，上限 2 小時） | `run_watchdog.bat` | 看門狗：主排程沒完成 → 完整補抓；昨晚那場缺 → 只抓單場；有補抓或失敗才跳桌面通知 | `watchdog_log.txt`（補抓過程併入 `fetch_log.txt`，標頭 `=== [watchdog] ...`） |
| `WolvesShotchart` | 每週一 14:30 | `run_shotchart.bat` | 逐球員投籃座標（整季覆寫） | `shotchart_log.txt` |

（`WolvesBackfill` 已刪除；backfill queue 完成後不再需要）

**排程「上次執行結果」的意思（2026-10-24 起）**：`run_fetch.bat` 會記住 `fetch_data.py` 的結束碼，薪資同步照跑，最後抓取失敗就以抓取的碼結束（`fetch_log.txt` 另留一行 `[run_fetch] fetch_data.py failed, exit code N`）；抓取成功才回報薪資同步的碼。所以排程顯示非 0 ＝ 抓取當掉（未捕捉例外，碼 1）、疑似被擋（「Synergy 與 base 皆無資料而終止寫入」，碼 2，2026-10-26 起；之前是 0）、Firebase 初始化失敗（碼 1）或薪資同步失敗，翻 log 末段即可。「休賽期跳過」仍是 0。舊版只回報最後一行（薪資）的碼，2026-10-24 抓取 `NameError` 當掉時排程仍顯示 0、沒人發現。`WolvesWatchdog` 顯示非 0 ＝ 補抓失敗或看門狗本身出錯（同時已跳通知）。

**看門狗（2026-10-26 起，設計緣由見「2026-10-26 每日抓取看門狗」）**：
- 判斷「主排程有沒有完成」＝ `fetch_status.json` 的 `full.ok` 為 true 且 `finishedAt` 在今天 00:00 之後；判斷「昨晚那場」＝ `teamgamelog` 最新一場的日期在 `wolves_player_games` 有文件。兩項都正常就只記一行「正常」
- 手動檢查：`python scripts/watchdog.py --dry-run`（只印判斷，不補抓、不通知）；測通知：`python scripts/watchdog.py --test-notify`
- 改檢查時間：直接改排程觸發時間即可，程式不用動；**不要早於台北 14:00**（西岸場可能還沒打完，`teamgamelog` 只列已完賽場次）
- 暫停：工作排程器停用 `WolvesWatchdog`，主排程不受影響
- 手動補記狀態：`fetch_status.json` 是 `fetch_data.py` 自動寫的；只有在「主排程確實成功、但狀態檔沒記到」時（例如狀態檔上線前的那次，2026-10-26 補記過一次）才手動補 `full`，`note` 寫明是補記

**為什麼是台北 03:00（2026-10 由 14:00 改）**：NBA 賽後最多約 12 小時才把數據補齊。台北 03:00 ≈ 美東 14:00～15:00，距最晚的西岸場結束也超過 12 小時，累積快照各類別（含 Synergy）與單場都是最終數字；快照 doc id 仍是比賽隔天（美東日期），語意不變。排程設 `WakeToRun`＋`StartWhenAvailable`：睡眠中會喚醒（電源計畫「允許喚醒計時器」目前只在接電源時啟用，所以用電池睡眠時仍不會被喚醒），關機錯過則開機後補跑；2026-10-26 起兩個每日排程都取消「使用電池時不啟動」（`DisallowStartIfOnBatteries`／`StopIfGoingOnBatteries` 皆 false），醒著用電池也照跑。單場另有定稿保險（`FINAL_AFTER_HOURS`，見「單場數據」），手動提早執行也不會鎖住半成品。

**建立 / 手動執行**：
```powershell
schtasks /create /tn "WolvesShotchart" /tr "C:\wolvestracker\run_shotchart.bat" /sc WEEKLY /d MON /st 14:30
schtasks /run /tn "WolvesTracker"
schtasks /run /tn "WolvesShotchart"
schtasks /run /tn "WolvesWatchdog"

# 看門狗（schtasks 設不了電池選項，用 Register-ScheduledTask）
$a = New-ScheduledTaskAction -Execute 'C:\wolvestracker\run_watchdog.bat'
$t = New-ScheduledTaskTrigger -Daily -At 15:00
$s = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -WakeToRun -ExecutionTimeLimit (New-TimeSpan -Hours 2)
Register-ScheduledTask -TaskName WolvesWatchdog -Action $a -Trigger $t -Settings $s

# 主排程改成用電池可跑
$m = Get-ScheduledTask -TaskName WolvesTracker
$m.Settings.DisallowStartIfOnBatteries = $false; $m.Settings.StopIfGoingOnBatteries = $false
Set-ScheduledTask -InputObject $m
```
`run_watchdog.bat` 內容（換電腦時重建；CRLF、無中文註解）：`chcp 65001`、`PYTHONIOENCODING=utf-8`、`PYTHONWARNINGS=ignore::DeprecationWarning`、`cd /d C:\wolvestracker`，再以 Python312 絕對路徑跑 `scripts\watchdog.py %* >nul 2>> C:\wolvestracker\watchdog_err.log`，最後 `exit /b %ERRORLEVEL%`。**stderr 不可導到 `watchdog_log.txt`**：bat 開著它時 Python 再寫會 `PermissionError`（Windows 檔案鎖，2026-10-26 踩過）。

**失敗排查**：log 內搜尋 `[FAILED]`——重試 3 次耗盡的項目會印此標記並帶著部分資料繼續，缺哪一項一目了然。

### .bat 檔注意事項
- 必須是 **CRLF** 換行（LF 會讓 cmd 把多行視為一條長指令）
- 開頭必須有 `chcp 65001 > nul` 切 UTF-8，否則中文路徑/字串會以 cp950 解析爆炸
- 內容**不能含中文註解**（會被 cmd 解析）
- Python 腳本前綴 `set PYTHONIOENCODING=utf-8` 才能正確輸出中文

---

## Firebase 設定

### Firestore 安全規則

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /wolves_team_stats/{date}        { allow read: if request.auth != null; allow write: if false; }
    match /wolves_player_stats/{date}      { allow read: if request.auth != null; allow write: if false; }
    match /wolves_team_history/{docId}     { allow read: if request.auth != null; allow write: if false; }
    match /wolves_player_history/{docId}   { allow read: if request.auth != null; allow write: if false; }
    match /wolves_shotcharts/{docId}       { allow read: if request.auth != null; allow write: if false; }
    match /wolves_player_games/{date}      { allow read: if request.auth != null; allow write: if false; }
    match /wolves_team_games/{date}        { allow read: if request.auth != null; allow write: if false; }
    match /wolves_games_index/{docId}      { allow read: if request.auth != null; allow write: if false; }
    match /wolves_games_bundle/{docId}     { allow read: if request.auth != null; allow write: if false; }
    match /wolves_pgames_bundle/{docId}    { allow read: if request.auth != null; allow write: if false; }
    match /wolves_salary/{docId}           { allow read: if request.auth != null; allow write: if false; }
  }
}
```

> ⚠️ 新增集合時必須同步在 Firebase Console 加上對應 match 並重新發佈，否則前端會報 `Missing or insufficient permissions`。

### API Key Referrer 白名單（Google Cloud Console）

到 https://console.cloud.google.com/apis/credentials → 編輯 Browser API key → HTTP referrers，須包含：
- `http://localhost:8000/*`（本地開發）
- `http://localhost/*`
- GitHub Pages 網域

少了 localhost 會出現 `auth/requests-from-referer-...-are-blocked`。

### 服務帳戶（寫入用）
- Firebase Console → 專案設定 → 服務帳戶 → 產生新的私密金鑰
- 下載的 JSON 放在本機（**絕對不要 commit**），檔名 `firebase-key.json` 放專案根目錄

---

## Firebase 資料結構

### 每日快照（`fetch_data.py` 寫入）
```
wolves_team_stats/{YYYY-MM-DD}
wolves_player_stats/{YYYY-MM-DD}
```
欄位：`date`, `seasonType`, `type`, `timestamp`, `stats`, `tracking`, `shooting`, `clutch`, `defense`, `lineups`（lineups 僅球隊文件）

- **寫入守門（2026-10-23 改）**：Synergy **與** base 都空才視為被 NBA 擋、終止寫入。開季初 NBA 尚未釋出 Synergy（`synergyplaytypes` 回 0 筆、不是錯誤），此時印 `⚠️ Synergy 無資料` 並照常寫入其他類別、擷取單場；`stats` 為空陣列／空物件，等 NBA 釋出後隔天自動補上。前端球員名單取 `stats ∪ base`、球員存在判定與 `playerId` 都退回 `base`，Playtype 分頁顯示「尚無資料」

球員以 **playerName** 為 key（每日快照沿用舊結構）；`tracking` / `shooting` / `clutch` / `defense` 皆為 `{playerName: {...}}` 同構。
- **灰狼球員以名冊 PlayerID 過濾，不比名字**（`pid_to_name_keyed(..., keep_ids=roster_ids)`；Synergy 比 `playerId`）。名冊 API（commonteamroster）與數據 API（leaguedash*／synergyplaytypes）的寫法可能不同——2025-26 名冊 `Terrence Shannon Jr.`、數據 `Terrence Shannon Jr`，舊版比名字時他整個從快照消失（2026-10-19 修）。key 一律取**數據 API 的寫法**；`onoff` 的名字（endpoint 本身是 `Last, First`）也取 base 的寫法、沒有才退回名冊，確保 `current.onoff[球員名]` 對得上。前端跨季比對另有 `nameKey`（去句點/重音）兜底。
- `defense`（球員）= 對位防守 + Hustle + 防守 box 合併；`defense`（球隊）= Hustle + 防守 box + 對手分區（`*_OPP_FG_PCT` 等扁平欄位）。

### 投籃熱圖（`fetch_shotchart.py` 每週整季覆寫＋`fetch_data.py` 每日增量）
- **每日增量**（`fetch_data.capture_recent_shots` → `fetch_shotchart.capture_game_shots`）：最近 5 場中「已定稿（`is_final_capture`）且全隊文件 `gameDates` 還沒有」的場次，打一次 `shotchartdetail?GameID=…&PlayerID=0&TeamID=MIN`（拿到該場全隊出手，每球帶 `PLAYER_ID`），依球員拆開併入各文件；同日期舊出手先移除（重抓不重複）；受助攻比例沿用舊值；**全隊文件最後寫**，它的 `gameDates` 就是「已併入」記號，中途失敗下次自動重來
- **每週整季**：逐球員重抓覆寫，負責對帳（NBA 事後修正）與更新 `assisted`
```
wolves_shotcharts/{playerId}_{season}_{regular|playoffs}   例：1630162_2025-26_regular
wolves_shotcharts/TEAM_{season}_{regular|playoffs}         全隊出手（PlayerID=0，前端球隊熱圖用）
```
欄位：`playerId`, `playerName`, `season`, `seasonType`, `timestamp`, `shots[]`（每筆 `{x, y, made, dist, zone}`，座標單位 0.1 呎、籃框在原點）。整季覆寫，非每日快照。全隊約 7,000+ 點、約 0.5 MB（單文件上限 1 MiB）。

### 單場數據（`backfill_games.py` 回補 / `fetch_data.py` 每日順抓，G2/G3）
```
wolves_player_games/{YYYY-MM-DD}   players:{name:{...}}（灰狼）、oppPlayers:{name:{...}}（對手，2026-10 起）
wolves_team_games/{YYYY-MM-DD}     stats:{...}（灰狼）、opp:{...}（對手球隊）、box:{...}（完整 box score）
兩者共同：gameId、oppId、oppAbbr、matchup、wl、partial、final、captureTries
```
含 Tracking(6) + 對位防守 + Hustle + 分區投籃 + 基本數據的單場值（`DateFrom=DateTo` 抓）。不含 Clutch（單日不穩）與 Synergy（不支援日期）。
- **對手與 box score（2026-10 起擷取的場次才有）**：box score 已用 `backfill_games.py --season 2025-26 --type {regular,playoffs} --box-only` 補完 2025-26（每場 2 requests，`update` 合併寫入 `box`／`gameId`，不動 `stats`）；對手 Tracking／Hustle 舊場次**不補**（要補得整場重跑，每場約 20 requests，或另寫只抓球隊端的模式約 9 requests）
  - `fetch_boxscore` 的 `complete` 改為「兩隊都有每節比分」才算完整：summaryv3 偶爾回空殼（2025-11-19 實例，有回應但沒有 periods／背號／傷停／場館），原本只看 `bool(sm)` 會誤判完整
  - 對手球隊：球隊 request 改傳 `TeamID=0`，同一個 request 拿到當天所有球隊，取灰狼（key `MIN`）與對手（key 為 TEAM_ID 字串）——`_team_key()`。每日快照的球隊呼叫維持預設 `team_id=TEAM_ID`，行為不變。
  - 對手球員：球員 request 本來就是全聯盟，以 box score 的對手上場名單（PlayerID）篩出；對位防守另用對手 TeamID 抓（多 2 request）。
  - box score：`nba_common.fetch_boxscore(game_id)` 合併 `boxscoretraditionalv3`（兩隊球員/合計、先發＝有 position、DNP 原因在 comment）與 `boxscoresummaryv3`（每節比分 periods、傷停 inactives、背號、場館、觀眾、裁判）。欄位對照表 `BOX_STAT_FIELDS`（想多存欄位加一行即可）。`MIN` 是字串 `"38:01"`、DNP 球員的 stats 為空 `{}`。
  - Game ID 來自 `teamgamelog`（`fetch_team_game_log` 回傳 5 元組，第 5 個是 game_id；`wolves_games_index` 每場也帶 `gameId`）。
  - 球隊 bundle 的每場多 `opp`/`oppAbbr`（舊場次維持原形狀）；box score 不放 bundle（整季約 0.9 MB，會逼近 1 MiB 上限），前端看單場時讀 `wolves_team_games/{date}` 一份即可。
  - 大小（2026-04-03 實測）：team_games 約 14 KB（box 11 KB）、player_games 約 30 KB（灰狼 15＋對手 15）。
- **早期單場球員文件含非當時隊員（2025-26 已清理，2026-10-19）**：舊回補是用「後來的名冊名字」過濾全聯盟球員，混進別隊比賽。例行賽 51 份 `wolves_player_games` 共 91 筆（Dosunmu 26、Dillingham 19、Phillips 17、Miller 17、Anderson 12；其中 5 筆是他們以對手身分打灰狼）已從 `players` 移除。判定方法：`playerId` 不在當場 `wolves_team_games.box.players` 的 MIN 上場名單（tricode=='MIN' 且有 stats）。清理後重建了 `build_bundles.py --season 2025-26 --type regular`，讀回驗證 21 份球員 bundle 的每一場都對得上 box。季後賽、球隊 bundle、球隊單場 `stats` 沒受影響。注意：Overview 的 `SingleGamePanel` 以名字讀 `players`，並用 localStorage 永久快取（`wt_game_wolves_player_games_{date}`），清理後已把快取鍵換成 `wt_game_v2_…` 並在載入時刪掉舊鍵，讀者不用手動清快取
- **2022-23～2024-25 清理（2026-10-23，`backfill_games.py --clean-players`）**：這三季沒有 box，改用**多欄位對帳**（0 request）。每場把 `players` 加總比 `wolves_team_games.stats`：PTS／FGM／FGA／FG3M／FTM／FTA／OREB／DREB／AST／STL／BLK／PF 必須全等，TOV 只要求不超過球隊（球隊失誤含 24 秒違例等團隊失誤），上場時間加總 ≈ 5 × 球隊 MIN（容差 1.5 分鐘）。對不上時找「剔除後全部對得上」的最少人數組合（1～4 人），**該人數下唯一一組才剔除**，否則只列出不動。先用已清理的 2025-26 校準：94 場零誤刪（唯一對不上的 2026-03-01 是 NBA 球員 DREB 加總比球隊少 1，全員都在 box，屬資料落差）。三季例行賽剔除 76 場、105 人次（2022-23：Conley 26、Alexander-Walker 23、Russell 9、Matt Ryan 7、A.J. Lawson 3；2023-24：Troy Brown Jr. 13、Monte Morris 5、Shake Milton 4、Wendell Moore Jr. 1；2024-25：Hyland 13、Tristen Newton 1），剔除日期與真實交易時間吻合；季後賽三季本來就對得上。重建三季 bundle 後，得分加總、對帳腳本、bundle 端反推三種核對全部歸零。用法：先 `--dry-run` 看名單，再拿掉 `--dry-run` 寫入，接著 `build_bundles.py --season X --type Y`
- **清理資料後一定要讓前端舊快取失效**：`SingleGamePanel` 快取鍵 `wt_game_v3_`（2026-10-23 再換版）、單場頁／對戰頁的 `loadGameDocs` 快取鍵 `wt_gc_v2_`（同日換版，舊 `wt_gc_{date}` 在 `gamesData.js` 載入時刪掉）。球隊／球員 bundle 只有記憶體快取，重新整理就是新資料
- **灰狼單場球員以 box score 上場名單的 PlayerID 過濾，不用名字**：名冊 API 與數據 API 的名字寫法可能不同（2025-26 實例：`Terrence Shannon Jr.` vs `Terrence Shannon Jr`），用名字過濾會整個人漏掉。名字清單只在 box score 抓不到時當後備（`keep_is_fallback`）；`backfill_games.py --min-gp > 0` 時才另外套輪換門檻。
- **PlayType 單場**只能由每日快照的 Synergy 整數總量相減還原：`stats[]` 每項含 `gp/possTotal/ptsTotal/fgmTotal/fgaTotal`（`fetch_synergy_data` 已改 `PerMode=Totals`，顯示用 `poss` 由總量/GP 推導，比率不變）。兩份 GP 差=1 的快照相減得單場；PERCENTILE 無法還原。
- **每日補抓（2026-10 起）**：`fetch_data.py` 的 `capture_recent_games()` 每次執行都讀 `teamgamelog`（只列已完賽場次），檢查最近 5 場（`CAPTURE_LOOKBACK_GAMES`）在 `wolves_player_games` 是否缺漏、未定稿（`final=False`）或 `partial=True`，逐場以**賽程上的比賽日期**擷取，並增量更新 bundle（`build_bundles.upsert_game`）與 `wolves_games_index`。不可改回用「執行當天日期」：排程執行時美東日期永遠是比賽隔天，查單場會落空（舊版 `capture_single_game` 即此問題，從未成功寫入過）。
- 單場文件多三個欄位：
  - `final`：擷取時間是否已過「比賽隔天美東（UTC-5）13:00」（`FINAL_AFTER_HOURS`＝最晚場結束＋12 小時）。未定稿的下次一定重抓——各來源都有值但還沒更新完的半成品，`partial` 抓不到，只能靠時間判斷。
  - `partial`：base 有資料但 tracking/hustle 等某來源整個空；定稿後最多重抓 3 次（`CAPTURE_MAX_TRIES`）。
  - `captureTries`：定稿後的擷取次數（未定稿時為 0）。舊回補文件沒有這些欄位，視為已定稿完整。
  漏跑幾天也會自動補（5 場內）。
- 單場抓取邏輯集中在 `nba_common.fetch_single_game()`（回傳 dict）＋ `game_docs()`（組文件），`backfill_games.py` 與每日共用。
- 前端單場面板（G-c）已完成：`SingleGamePanel.js` 選日期看單場，只渲染有資料的群組（單場無 ShotProfile/DefenseBox/PlayType）；日期選單讀 `wolves_games_index/{season}_{type}`（一份 doc，`backfill_games.py --index-only` 產生）。

### 歷史賽季快照（`backfill_history.py` 寫入）
```
wolves_team_history/{season}_{type}      例：2022-23_regular
wolves_player_history/{season}_{type}    例：2023-24_playoffs
```
球員以 **PlayerID** 為 key，含 `playerName`、`isCurrentRoster`、`stats[]`、`tracking{}`。

前端 `App.js` 內 `normalizeHistoryPlayer()` 把 PlayerID-keyed 結構轉成 playerName-keyed，與每日快照相容。

### 薪資資料（`sync_salary.py` 寫入，2026-10-20）
- **資料來源**：Google Sheet「Wolves Tracker 薪資資料」（使用者的雲端硬碟），整份「發佈到網路」為 CSV；發佈網址與各分頁 gid 在 `nba_common.py` 的 `SALARY_SHEET_PUB`／`SALARY_SHEET_GIDS`（公開唯讀，非機密）。新增分頁會自動包含在發佈範圍，但要把 gid 加進 `SALARY_SHEET_GIDS`
- **8 個分頁**（Sheet 欄名＝Firestore 欄名，Sheet 即 schema）：
  - `contracts`：一位球員一個賽季一列——`season`、`player`、`playerId`、`salary`（cap hit，含 likely incentives）、`unlikely`（unlikely incentives，只計入 apron 薪資）、`guarantee`（full/partial/none）、`guaranteed_amt`、`option`（PO/TO/ETO）、`type`（Spotrac 代碼：VET-EXT、DRK-EXT、RK-1ST、MIN、MLE-TP、TWO-WAY…）、`note`。雙向合約 `salary` 填 0、`type`＝TWO-WAY
  - `dead`：死錢（`season`、`player`、`amount`、`reason`）
  - `thresholds`：每季門檻（`cap`、`tax`、`apron1`、`apron2`、`min_team`、`tax_bracket`、MLE／BAE、`apron_final` 季末層級、`hard_cap` 鎖死狀態＋原因、`ref_tax_total`／`ref_apron_total` 外部參考總額、`verify`）
  - `tax_rates`：每季每級的 `rate`、`repeater_rate`（稅率依賽季不同，不寫死）
  - `tax_history`：逐季是否繳奢侈稅（`paid`），前端據此自動判定累犯（前 4 季有 3 季）。**不再有手填的 repeater 欄**
  - `rules`：門檻限制條文（`tier`＝cap/tax/apron1/apron2/hardcap、`order`、`text_zh`、`detail`、`source_url`）
  - `picks`：選秀權（`year`、`round`、`status`＝own/out/swap/conditional/frozen/in、`summary_zh`、`terms` 原文、`source_url`、`as_of`、`verify`）
  - `settings`：`show_value`（薪資×表現區塊開關）
- **Firestore**：`wolves_salary/main` 單一 doc（約 25 KB），欄位＝上述分頁轉型後的內容＋`contentHash`／`source`／`updatedAt`
- **sync_salary.py 檢查**：必要欄位、型別、允許值清單、同人同季重複、門檻順序、薪資當季（含）以前有合約的賽季必須有門檻與稅率；有錯誤就不寫入並以 exit 1 結束（印出分頁與列號）。對帳（逐季加總 vs `ref_*_total`）不符只警告。內容 hash 與 Firestore 相同就略過寫入。`--dry-run` 只印摘要、`--local DIR` 改讀本地 CSV（測試用）
- **兩種總額**（用 Spotrac 數字逐元驗證過）：奢侈稅薪資＝Σ 標準合約 cap hit＋死錢（薪資帽空間、奢侈稅都用它）；apron 薪資＝奢侈稅薪資＋Σ unlikely incentives（判定兩條 apron 用它）。薪資帽空間不含 cap hold，所以和 Spotrac 的 Cap Space 不同（Spotrac 含 cap hold）

### 寫入前去重
`fetch_data.py` 寫入前會抓最近 14 天最新一筆，深度比對 `DATA_KEYS`（stats / tracking / shooting / clutch / lineups / defense），完全相同則跳過寫入避免堆積無意義文件。

### Firestore 方案與用量（2026-10-19 實測更正）
- **專案是 Blaze（即付即用），不是 Spark**（Firebase Console 專案總覽可見）。免費額度：儲存 1 GiB、讀取 5 萬次/天等；**超過不會停擺而是開始計費**（單價見 Google Cloud 價目，本手冊不記數字以免過期）。單欄位索引設定上限 1,000 個（開帳單的專案）。
- **儲存量要連索引一起算**：Firestore 預設替每個欄位（含 map 裡每個子欄位、整個 map 值）建遞增＋遞減索引、陣列建 array-contains。我們的文件是深層巢狀數值，2026-10-19 依官方 storage-size 規則逐份估算：資料 25 MiB、**索引約 157 MiB**（`wolves_player_games` 單場一份資料 19 KB、索引約 305 KB）。照此每季約 +139 MiB，約 6 季後會超過免費額度。
- **已處理：所有集合都設 `*` 索引豁免**（見下節），每季增量估計降到約 16～19 MiB（≈ 只剩資料本身）。
- 讀取次數：前端開站只讀近期快照（約 10–15 份），需要整季時才讀整個當季 collection（約 120 份）；逐場用 bundle（一份 = 1 次讀取）。個人用量離 50,000/天 很遠。
- 實際儲存量：服務帳戶無 Monitoring 權限，需用自己的帳號到 Google Cloud Console → 監控 → Metrics Explorer → 資源「Firestore Database」的 storage 指標查看。

### Firestore 索引豁免（2026-10-19 起）
- **11 個集合都在 Firebase Console → Firestore → 索引 → 自動 → 豁免項目，設定 `欄位路徑 = *`、範圍「集合」、遞增/遞減/陣列全停用**：`wolves_team_games`、`wolves_player_games`、`wolves_player_stats`、`wolves_team_stats`、`wolves_shotcharts`、`wolves_pgames_bundle`、`wolves_games_bundle`、`wolves_player_history`、`wolves_team_history`、`wolves_games_index`、`wolves_salary`（2026-10-20 加）。map 欄位的子欄位會繼承豁免；之後新增的欄位（如對手 `opp`/`oppPlayers`/`box`）自動涵蓋。
- **為什麼可以全關**：前端與腳本只用「文件 ID 範圍查詢」（`App.js` 的 `where(documentId(), ...)`）、單一文件讀取（`getDoc`）與整集合讀取（`stream()`），這三種用的是內建的文件 ID 索引，不受豁免影響（2026-10-19 逐集合實測通過）。
- **副作用**：任何依欄位內容的查詢（`where('date', ...)`、`where('stats.PTS', ...)`、`orderBy('timestamp')`）都會回 `FAILED_PRECONDITION: The query requires an index`。真的需要時，只替那一個欄位在同頁新增一筆「啟用」的豁免即可，不必整個集合恢復。
- **復原**：同頁刪除該集合那一筆豁免，Firestore 會在背景重建索引（數分鐘，視文件數）。
- 設定前的原始索引設定（全預設）備份在 `~/.claude/ops/backup-20261019/wolvestracker/firestore_index_config_before.json`。
- 服務帳戶只有讀取索引設定的權限、不能修改（刻意不提權：金鑰在本機，權限越小外洩風險越低），所以豁免一律在 Console 手動設定。

---

## 配色（灰狼新品牌，2026-07 改版）

色值目前以 hex 直接寫在各元件（Tailwind arbitrary values），未抽 CSS 變數。要改配色用 `sed` 全域替換 + 對照下表。

| 用途 | 色碼 | 說明 |
|---|---|---|
| 主色（進攻/選中/圖表主線/命中） | `#12A150` | 官方 Aurora Green 提亮版（官方 `#009A4C` 深底小字偏暗） |
| 結構藍（球隊/球員切換、連結） | `#236192` | Lake Blue |
| 底色 | `#0A1626` | 午夜藍（`index.html` body + loading） |
| 月光銀（logo 環、區塊標題底線） | `#C4CED2` | 標題底線用 `border-[#C4CED2]/30` |
| 防守/未命中/負值 | `#EF4444` | 功能色（非品牌） |

> header logo 圖仍是舊 Logo（`i.imgur.com/HSY3cX7.png`）；要換新 Logo 需一張透明 PNG（不宜熱連 IG CDN）。

---

## 前端架構重點

### 賽季模式（`selectedSeasonKey`）
- `'current'`：當季 onSnapshot 兩個集合（先近期、需要時整季，見「效能與無障礙」），date 為實際日期，身分列時光機選日期
- 其他（如 `'2024-25_playoffs'`）：history mode，`getDoc` 一次拿賽季終點快照，date 顯示賽季 label，日期切換隱藏

### localStorage 快取
- key：`wt_history_{season}_{type}`（如 `wt_history_2024-25_playoffs`）
- 存 `{ team, player }` 原始 doc，永不過期
- 切換到歷史賽季優先讀 localStorage；讀到才呼 Firestore（Iter 1）
- 跨賽季比較分頁進入時，逐個歷史賽季走相同邏輯（共用 cache）

### 雷達 overlay（跨賽季 + 球員互相比較）
- `compareKeys` state：勾選的歷史賽季（最多 2 個，加主賽季共 3 條雷達）
- `comparePlayers` state：勾選的同季其他球員（Phase D，球員 + 當季模式；資料已在 `playerHistory`，無需額外抓取）
- `radarSeries` = 主序列 + `compareKeys` 賽季 + `comparePlayers` 球員；比較時主序列標籤改用球員名
- `compareCache` state：已載入的歷史 doc，多源共用
- 主色：進攻綠 / 防守紅；比較色盤：藍 / 黃 / 粉（賽季與球員共用索引）
- 球員模式才顯示

### 單場數據面板（`SingleGamePanel.js`）
- 當季模式下、球員/球隊視圖底部顯示；日期選單讀 `wolves_games_index/{season}_{seasonTypeView}`（隨例行/季後切換；`gamesIndex` state，一份 doc；只有已結束賽季走 localStorage 快取 `wt_games_index_v3_*`（不設期限），當季每次讀最新、空清單一律不快取——2026-10-23 前是 6 小時 TTL，開季曾把空清單快取住導致單場入口消失）
- 切換賽別後原選日期不在新清單 → 自動跳到新清單最後一場；缺值卡片顯示「—」（不印孤立單位）
- 選日期後讀 `wolves_{player|team}_games/{date}`（localStorage 快取），依攻守取 defs，**只渲染該實體有資料的群組**（`def.metrics.some(有值)`）→ 自動隱藏單場沒有的 ShotProfile/DefenseBox/PlayType
- 卡片用 `TrackingCardRow clickable={false}`（單場無走勢，不可點）
- 攻守跟隨右側攻/守切換（`OverviewTab` 的 `viewSide` prop）：防守側顯示最近防守者／Hustle／抄截阻攻單場值

- 面板右上「看完整比賽 →」連到該場單場頁（2026-10-19）

### 單場比賽頁（`GamePage.js`，2026-10-19）
- App 的 `gameDate` 有值時主區改渲染 `GamePage`，隱藏 RosterRail／IdentityBar；ChapterNav 保留但不標選中，點章節＝回主畫面該章節（2026-10-23）。Masthead 期別行改「單場 · 日期」、隱藏賽季／賽別
- **賽程月曆 `GameCalendar.js`**（2026-10-23，取代「最新一場」按鈕）：App `scheduleSeason`＝單場頁時 `seasonForDate(gameDate)`、否則刊頭所選賽季 → `gamesData.loadSeasonSchedule(season)`（例行＋季後索引合併、每場帶 `type`）。月曆格子標對手縮寫（`@`＝客場）＋勝綠敗紅，季後賽標「季後」，點日期 `openGame`；彈出層用 `ReactDOM.createPortal` 掛 body（刊頭控制列是 overflow-x-auto，放裡面會被裁），fixed 定位、視窗太矮時內部捲動。搜尋「最近比賽」也讀同一份。2021-22 以前沒有 `wolves_games_index` → 按鈕停用並說明
- 資料：`wolves_team_games/{date}`（box/stats/opp/matchup/wl/seasonType/final）＋ `wolves_player_games/{date}`（players），經 `gamesData.loadGameDocs(date)` 讀取（2026-10-23 抽出，與對戰頁共用）：記憶體快取 `window.__gameDocCache`＋ localStorage `wt_gc_v2_{date}`（`final === false` 不寫，免得鎖住半成品；對戰頁傳 `persist=false` 只讀不寫）
- 比分下方「與 {對手} 歷次交手 →」連到 `#vs=對手`（2026-10-23；沒有 box 的場次也有）
- 賽季＝`seasonForDate(date)`、賽別＝文件 `seasonType`；賽程條讀 `loadGamesIndex(season, type)`（`gamesData.js`，App 的單場面板也改用它）
- **灰狼球員以 box `personId` 對應 players 文件的 `playerId`**，連結用 players 文件的名字（數據 API 寫法，才找得到主畫面的球員）
- 季平均＝該員 bundle 取「此場之前」的比賽（`GameAgg.aggregate`），各區塊共用 `avgCache`，換場次清空；比率類分母對照 `RATIO`（由 `GameAgg.RATIO_DEFS`／`EFG_DEFS` 推出＋ PCT_PLUSMINUS→D_FGA）
- 標色 `judge()`：`neutral` 指標不判、分母 < 5 標樣本少、其餘依 `betterIsLarger`。**新增次數類指標要在 `constants.js` 加 `neutral: true`**
- 降級：沒有 `box` → 只顯示灰狼進階清單；沒有 `opp` → 球隊對比右側「—」並說明；沒有每節比分 → 看板不畫 linescore、不顯示比賽資訊；投籃點沒有 → 說明賽後隔天才會併入
- 手機：球員選擇鈕放區塊內容第一行（`UI.Section` 的 `right` 不換行，十幾個 chip 會撐寬版面）

### 跨季疊圖（2026-10-19）
- **賽季軌跡疊圖**（`SeasonPaceChart`，跨季章節最上方）：賽季清單＝`[CURRENT_SEASON, ...HISTORY_SEASONS]` 去重，各季 `loadSeasonGames` 依日期排序，第 i 場＝第 i+1 場出賽（球員是出賽場次、不是球隊場次）。算法：累積季平均／近 10 場／逐場，皆用 `GameAgg.metricOf`（與 `aggregate` 共用 `valueOf`，比率 Σ/Σ）。同期比較以最新一季已出賽場數為 N。沒有 bundle 的季 chip 反灰
- **逐季折線多序列**（`ComparisonTab`）：表格列可多選（`openKeys`，最多 8）；單一指標可「＋加入比較」最多 3 位球員或全隊（`extras`，資料取已載入的 `data[k].player`）；他隊季別空心點＋虛線＋@隊名（`tagOfMeta`）；多指標＝小圖並排或指數化（首季＝100）
- `LineOverlay`：通用多序列 SVG（十字線提示、末端標籤避讓、`mini` 小圖模式）。要再加疊圖優先重用它

### 薪資頁（`CapPage.js`，2026-10-20）
- App 的 `capView` 有值時主區改渲染 `CapPage`（同 `gameDate` 的模式），隱藏 RosterRail／IdentityBar／ChapterNav；刊頭在薪資頁隱藏賽季／賽別／日期，期別行改「薪資 · Cap Sheet」
- **計算全在 `window.CapCalc`**（同檔頂端）：`payroll`（兩種總額）、`taxOf`（奢侈稅分級，Sheet 只列到第 n 級、之後每級 +0.50）、`tierOf`（所在層級）、`repeaterOf`（依 `tax_history` 判定累犯；有缺資料時「缺的全算有繳也到不了 3 季」→ 一般、已滿 3 季 → 累犯、其餘 → 無法判定；另算下一季展望）。已用手算值驗證：2026-27 一般 $21,956,339、累犯 $50,962,247
- **薪資當季**＝`capSeasonForDate()`（美東 7/1 切換），與 Python `get_roster_season()` 同規則
- **載入**：`window.loadCapDoc()` 讀 `wolves_salary/main`（記憶體快取，薪資頁與球員身分列共用；`unavailable` 自動重試 2 次）。錯誤分兩種提示：`permission-denied` → 缺安全規則；其他 → 連線中斷＋「重試」鈕
- **分頁**：總覽（狀態列：所在層級／鎖死狀態／奢侈稅率、8 格數字、門檻儀表、奢侈稅估算＋累犯判定）／合約（逐年薪資總表、薪資結構、薪資×表現）／選秀權／規則（四層限制卡片＋鎖死規則）
- **懸停完整金額**：`CapAmt`（虛線底線）、`CapCellAmt`（表格內）、`UI.StatCell` 的 `valueTitle`
- **球員連結**：逐年總表的球員名 → 同季球員頁（`playerId` 對快照名，對不到才用合約名；當季→`current`、其他→`{季}_regular`）。反向：`IdentityBar` 的薪資膠囊（App 依 `currentPlayerId` 對 `contracts`，顯示目前檢視賽季的 cap hit，點擊開該季薪資頁）
- **薪資×表現**（`CapValue`）：貢獻用**逐場 bundle**（`window.loadCapContrib` → `loadSeasonGames`），分子＝有合約球員各自的 `wolves_pgames_bundle`，分母＝球隊 `wolves_games_bundle` 逐場加總（上場時間＝比賽分鐘 × 5）。**不可改用季末／每日快照**：那是整季合併數據，季中轉隊球員會混入他隊比賽（2025-26 Kyle Anderson 快照 43 場、在灰狼只有 19 場；全隊上場時間會多出約 8%）
- **匯出**：`UI.ExportMenu`／`exportCSV`／`exportPNG` 新增 `source` 參數；薪資相關匯出標「Spotrac 等公開資料」，不沿用預設的 NBA.com

### 對戰分析（`matchupData.js`／`MatchupHome.js`／`MatchupPage.js`，2026-10-23）
- App 的 `vs` 有值時主區改渲染對戰頁（同 `capView` 的模式），隱藏 RosterRail／IdentityBar／ChapterNav；刊頭隱藏賽季／賽別／日期，期別行改「對戰分析 · Matchups」，「對戰」按鈕在「薪資」左邊。搜尋面板有「對戰分析」與 29 隊「對戰 DEN 金塊」
- **計算全在 `window.Matchup`**（`matchupData.js`，頁面只負責呈現）：
  - `seasonList()`＝`[CURRENT_SEASON, ...HISTORY_SEASONS]` 去重、新到舊；`windowSeasons(mode, currentRegGP)` 決定範圍與說明文字；`currentRegularGP()` 讀當季例行賽索引
  - `loadWindowGames(seasons, typeFilter, playerId?)`：沿用 `loadSeasonGames`（球隊或球員 bundle），每場加 `season`／`type`／`oppAbbr`；球隊另推導 `OPP_PTS`（得分 − 正負值，所有賽季都有；球員不推導）。**bundle 新場次的 `g.opp` 是對手數據物件，對手三碼放 `oppAbbr`**
  - `groupDefs(viewMode)`：基本（球隊多「失分」）／投籃分區／Tracking／防守，直接吃 `window.*Defs`（與 Splits 同源），球隊拿掉 `playerOnly`；`flatMetrics` 平鋪去重
  - `gameValue`：單場值一律 `GameAgg.metricOf`；**比率分母為 0 視為無值**（沒罰球的 FT% 不可當 0，否則灌進標準差）。`baseline` 只用有值的場次（舊賽季缺欄位不當 0）
  - `deviation(base, subset, def)` → `{value, diff, n, se, z, goodZ, tone}`；n = 1 只給差距、z 為 null；`tone` 依 `betterIsLarger`，`neutral` 指標不分好壞
  - `byOpponent`／`tagOpponents`（門檻 `MATCHUP_RULES`）／`keyFactors`（Cohen's d，排除 `PLUS_MINUS`／`PTS`／`OPP_PTS`）
- **對戰首頁** `MatchupHome`：範圍列（`window.MatchupRangeBar`，單隊頁共用）→ 對手總表（`UI.DataTable`，可匯出）→ 指標 × 對手熱圖（底色＝z，|z| 3 封頂，單場不上色；第一欄固定、手機區塊內橫捲）→ 單一指標排行（HTML 百分比定位畫點與 ±1.96 標準誤橫線，不用 SVG 以免手機字縮小）→ 勝負關鍵因子（各對手 |z| ≥ 1 偏勝場／偏敗場）→ 灰狼球員 × 對手（讀該員範圍內 `wolves_pgames_bundle`，最多 8 份）。場數少時黃色提示附「改看近三季」。淡化套在格子內容上，不套在 sticky 欄（會透出橫捲的格子）
- **單隊對戰頁** `MatchupPage`：頁首五格（戰績／場均比分／場均分差＋z／主場／客場）→ 最突出的 5 項 → 交手紀錄（逐季＋逐場，點日期開單場頁）→ 全部指標（`id="mu-m-KEY"`，`m=` 標亮並捲過去）→ 每節分差 → 對手打灰狼（兩隊 box 合計＋對手球員）→ 灰狼球員打這隊（點名字才讀他的範圍 bundle，`PlayerDetail` 比他自己的平均）→ 投籃分布（按了才讀，只讀有交手的 `TEAM_{season}_{type}`；`ShotChart` 自帶區塊標題，資料到了直接渲染它）
- **交手場次的單場文件**：`loadGameDocs(date, false)`，同時最多 6 個（`mapLimit`）；**每節分差、對手 box、對手球員只算有 box 的場次（2025-26 起）**，畫面寫出涵蓋幾場
- **讀取量**：首頁最多 8 份球隊 bundle（每份約 130 KB，記憶體快取）＋球員區塊最多 8 份；單隊頁另讀交手場次的單場文件 6～25 場 × 2 份；投籃每份約 0.5 MB，大檔會卡住同時進行的其他 Firestore 讀取，所以按了才讀
- **Splits 對手篩選**（`SplitsTab.js`）：例行賽期間列「對手」下拉（三碼＋場數），沿用既有期間子集；選了會提示單季樣本少並連到該隊近三季對戰頁。季後賽用系列賽選單，不顯示

### Modal 跨賽季比較分頁
- 每張卡片皆可用，含 PlayType 與 Tracking
- 進入時自動載入全部 6 個歷史快照
- 表格列出每個賽季 + 主賽季最新值（綠底高亮），欄位是該卡片所有指標
- 點欄位標題切換折線圖：X 軸是賽季縮寫（22-23R / 22-23P / ... / 當季），Y 軸該指標數值

### 當季走勢「例行 / 季後」二擇一
- 當季模式下 Modal「當季走勢」分頁顯示兩個 tab（移除「全部」）
- 預設依 `getSeasonPhase()`：4/15 前例行賽、4/16 後季後賽
- 歷史模式整個 tab 區塊隱藏

### 指標命名對照（2026-10 命名精準度修正）
原則：中文標籤必須對應 NBA 欄位的**實際語意**；中文旁一律以小字保留 NBA 原文（`englishLabel` 或 `en`），避免查證時對不上。資料 key 不因改名而變。

| 前端標籤 | 原文 | API 欄位 / endpoint | 注意 |
|---|---|---|---|
| 合理衝撞區命中率 | Restricted Area | `*shotlocations` 區域 `Restricted Area` | 不是整個禁區 |
| 禁區（非 RA）命中率 | In The Paint (Non-RA) | 同上 `In The Paint (Non-RA)` | 不含合理衝撞區 |
| 底角三分 / 非底角三分 | Corner 3 / Above the Break 3 | 同上 | 非底角含兩翼，不只弧頂 |
| 最近防守者 (Defense Dashboard) | DFGA / DFG% / DIFF% | `leaguedashptdefend`（`MATCHUP_*_FIELDS`） | 是「最近防守者」資料，**不是** `leagueseasonmatchups` 的對位資料；DIFF% 負=守得好 |
| 干擾球 | Deflections | `leaguehustlestats{player|team}` `DEFLECTIONS` | 不是抄截 |
| 地板球 | Loose Balls Recovered | `LOOSE_BALLS_RECOVERED`（進攻端／防守端 `OFF_`/`DEF_LOOSE_BALLS_RECOVERED`） | Loose Ball 譯「地板球」（2026-10-23 使用者指定，舊名「搶回散球」） |
| 掩護助攻得分 | Screen AST PTS | Hustle `SCREEN_AST_PTS` | 掩護直接幫隊友投進的分數；與「掩護助攻」(次數) 同組 |
| 卡位後自己搶下比例 | Box Out REB% | Hustle `PCT_BOX_OUTS_REB`（輸出同名，逐場以 `BOX_OUT_REBS ÷ BOX_OUTS` 重算） | NBA 只在卡位後**球隊**搶到籃板時記卡位，所以 `BOX_OUT_PLAYER_TEAM_REBS` 恆等於 `BOX_OUTS`、`PCT_BOX_OUTS_TEAM_REB` 恆 100%——這兩欄不抓 |
| 籃板機會轉換率 | REB Chance% | `REB_CHANCE_PCT`（輸出欄名沿用 `REB_COL_PCT`） | 籃板 ÷ 籃板機會 |
| 每百次切入得分 | DRIVE_PTS_PCT | tracking Drives | ＝切入得分 ÷ 切入次數 × 100（含被犯規罰球得分），**不是**佔總得分比例（2026-10 經使用者指正並以資料驗證） |
| 二次助攻 | Secondary AST | tracking Passing `SECONDARY_AST` | 傳給隊友、隊友接球 1 秒內未運球就助攻，原傳球者記一次（NBA.com 官方定義，2026-10 查證）；舊名「二傳助攻」易與排球「二傳」混淆而改名，群組名同步改「傳球與助攻」 |
| Clutch（名稱保留） | Clutch | `*clutch`，PerGame | 第四節或延長賽最後 5 分鐘、分差 5 分內，場均 |
| 五人陣容「總分鐘」 | MIN | `leaguedashlineups` Advanced | 此 endpoint 忽略 PerMode，MIN 一律總分鐘（2026-10 實測） |
| 雷達軸 `PR` / `%` | — | Synergy `PERCENTILE` / tracking 原始值 | 兩種尺度共用 0–100 軸，軸名必帶尺度標示 |

新增指標時：先查 NBA.com 對應頁的欄位定義，再決定中文；不確定時中文寫直譯並保留原文。

---

## 常見問題

### Q: 我修了 components/App.js 但網頁沒變
忘了跑 `python scripts/bundle.py`（新電腦還要先 `npm ci`）。或瀏覽器有快取，按 Ctrl+F5。

### Q: 本地開發出現 `auth/requests-from-referer-...-are-blocked`
Google Cloud Console 的 API Key 白名單沒加 `http://localhost:8000/*`。

### Q: 切換歷史賽季出現 `Missing or insufficient permissions`
Firestore Rules 沒涵蓋 history collections。貼上本文件「Firestore 安全規則」整段重新發佈。

### Q: NBA API 跑失敗
看對應 log：`fetch_log.txt`（每日）/ `shotchart_log.txt`（熱圖）/ `backfill_games_log*.txt`（單場回補）。搜 `[FAILED]` 看缺哪項；腳本有 3 次 retry，通常等隔天即可。

### Q: 網站少了昨晚那場比賽
正常情況下台北 15:00 看門狗會補上暫定版（美東晚上的比賽、台北早上結束，03:00 主排程那時還沒開賽），隔天 03:00 自動換成定稿版。15:00 前想先看：`python scripts/fetch_data.py --games-only`（約 26 requests，同樣是暫定版）。15:00 後還沒有：看 `watchdog_log.txt` 最後幾行與通知中心，再翻 `fetch_log.txt` 的 `=== [watchdog]` 段落；`python scripts/watchdog.py --dry-run` 可看它現在的判斷。

### Q: Backfill 進度怎麼看
看 `scripts/backfill_queue.txt` 還剩幾行。Phase 1 已完成、queue 已清空。

### Q: 想新增數據（三種情境，皆只需改一處後端）
1. **既有 API 的新欄位**（如籃板再加一欄）：`nba_common.py` 對應的 `*_FIELDS` 設定表加一行 `(輸出欄名, API 欄名, 是否百分比)`
2. **`leaguedashptstats` 新類型**（如 SpeedDistance）：`TRACKING_TYPES` 加名稱 + `TRACKING_FIELDS` 加對應欄位列表
3. **全新 endpoint**（如 Hustle）：`nba_common.py` 仿照 `fetch_clutch()` 寫一支新函式（用 `fetch_with_retry`），`fetch_data.py` 主流程呼叫並掛進文件欄位與 `DATA_KEYS`

前端同步：`components/constants.js` 加 defs（含 `englishLabel`）→ `App.js` 對應區塊 → `python scripts/bundle.py` 重新打包。每日與歷史回補會自動同步生效（共用 nba_common）。

不確定 API 欄名時，先抓一次 response 印 `resultSets[0]['headers']` 對照（欄名錯誤會被 `safe_col` 靜默吞成 0）。

### Q: 薪資資料怎麼更新
改 Google Sheet（或把 Spotrac／Fanspo 截圖、網頁文字給 Claude 轉成新列）。每日排程會自動同步；想立刻生效就手動跑 `python scripts/sync_salary.py`（先 `--dry-run` 看摘要）。發佈的 CSV 有幾分鐘快取，剛改完可能讀到舊版，稍等再跑。何時要更新：休賽期簽約、選項執行、交易截止日、裁員、10 天合約、牽涉選秀權的交易、觸發鎖死；每年 7 月新門檻；每季季末 `tax_history` 加一列。

### Q: 想關掉薪資×表現
Sheet `settings` 分頁的 `show_value` 改成 FALSE，同步後整個區塊消失，不必改程式。

### Q: 對戰分析的標籤或近三季規則想調整
只改 `components/constants.js` 的 `window.MATCHUP_RULES`（`halfSeasonGames` 近三季多含一季的門檻、`minGames` 標籤與淡化的最少場數、`rivalTopN` 勁敵幾隊、`topN`／`tagMinZ` 順手棘手幾隊與 z 門檻、`factorTopN` 關鍵因子幾項），再 `python scripts/bundle.py`。`glossary.js` 的 `MU_TAGS`／`MU_RANGE` 說明文字寫死了數字，改門檻時一起改。

### Q: 發現單場球員文件混入不是當時隊員的球員
症狀：某場 `players` 得分加總 ≠ 全隊得分，或球員 Splits 出現他還沒加入時的比賽。跑 `python scripts/backfill_games.py --season X --type Y --clean-players --dry-run` 看名單，確認後拿掉 `--dry-run` 寫入，再 `python scripts/build_bundles.py --season X --type Y`，最後把 `SingleGamePanel` 的 `wt_game_v3_` 與 `gamesData.loadGameDocs` 的 `wt_gc_v2_` 快取鍵各加一版（舊鍵在載入時刪掉）。`--clean-players` 只做多欄位對帳、不看 box；另一種更權威的做法是用 box 上場名單（tricode＝MIN 且有 stats）的 personId 比對，只適用於有 box 的場次（2025-26 起，2026-10-19 清理 2025-26 用的就是這個，見「單場數據」）。

### Q: 想追蹤其他球隊
改 `scripts/nba_common.py` 的 `TEAM_ID` 常數（所有腳本共用）。

### Q: PageSpeed 效能分數為什麼和實際感受差很多
PageSpeed 的效能分數是「模擬推算」，每次會跳動：同一版曾給第一個畫面 1.6 秒與 8.4 秒兩種估算。以同樣條件（慢速 4G、CPU 降速、全新訪客）實測為準：2026-10 為第一個畫面約 1.6 秒、主要內容約 9.7 秒（「近期異動」要等 Firestore 資料）。另外 PageSpeed 的測試環境裡匿名登入會失敗（Google 驗證端點 403），所以「最佳做法」會被扣錯誤紀錄，一般讀者不受影響。看 PageSpeed 時以**無障礙分數與總傳輸量**為主。

### Q: 歷史快取要怎麼清
DevTools → Application → Local Storage → 刪 `wt_history_*` 開頭的 key。或在 console 跑 `Object.keys(localStorage).filter(k=>k.startsWith('wt_history_')).forEach(k=>localStorage.removeItem(k))`。

---

## 已知技術決策

- **不用 GitHub Actions**：datacenter IP 容易被 NBA 封鎖，改用本機 Windows 排程（家用 IP）。workflow 檔已於 2026-07-02 移除
- **欄位設定表驅動**：抓哪些欄位寫在 `nba_common.py` 的 `*_FIELDS` 設定表，不寫在程式邏輯裡；加新數據只改設定表
- **全聯盟單次請求優先**：球員數據一律抓全聯盟再過濾（順帶解決轉隊歸屬問題）；唯一逐球員的 `shotchartdetail` 降為每週執行以控制被擋風險
- **`REB_COL_PCT` 來源是 `REB_CHANCE_PCT`**：NBA API 已無 `REB_COLLECT_PCT` 欄位，輸出欄名保留 `REB_COL_PCT` 以相容前端與歷史資料
- **輕量預編譯、不用打包框架**：React／Recharts 仍走鎖版本 CDN；JSX 與 Tailwind 由 `bundle.py` 呼叫 esbuild／tailwindcss 預先編譯，產物進版控，GitHub Pages 直接服務 main（無 CI 建置步驟）
- **PlayerID 為主鍵（歷史）**：跨賽季穩定，姓名僅供顯示。每日快照仍用 playerName-keyed（沿用舊結構），靠前端 normalizer 對齊
- **歷史賽季只存終點快照**：每季 1 個文件，省 Firestore 讀寫額度；逐日 backfill 約需 5,600 次 API call，目前不做
- **歷史賽季用 localStorage 永久快取**：免費版 Firestore 每日讀取上限 50,000，靜態歷史數據只讀 1 次
- **跨賽季折線圖以賽季為 X 軸**：歷史賽季只有終點快照，無法畫逐日；用「賽季順序軸」串接歷史終點 + 當季最新

---

## 給下一位 Agent 的維護重點（2026-07 交接）

> 這一節專門寫給接手的 Agent。前面章節是「怎麼運作」，這節是「動它之前要知道什麼、下一步可以做什麼」。

### A. PlayType (Synergy) 維護

- **資料來源**：`fetch_synergy_data()`（`nba_common.py`），11 種進攻 + 9 種防守（防守跳過 Cut/Misc）。PlayType 清單 `PLAY_TYPES` 是 NBA 固定的，**不能自訂新增**。
- **已改用 `PerMode=Totals`**：每個 stats item 除了顯示欄位（poss/freq/ppp/fgPct/percentile），還存整數總量 `gp/possTotal/ptsTotal/fgmTotal/fgaTotal`。顯示的 `poss` 是 `possTotal/GP` 推導、比率欄位與 PerGame 模式相同。**動這支函式時，顯示欄位與總量欄位都要保留**（總量是單場還原的唯一材料）。
- **Synergy 不支援 `DateFrom/DateTo`**（實測參數被忽略）→ 這是 PlayType 沒有單場資料的根本原因，也是為何 `_with_date()` 不套用在 Synergy。
- **PERCENTILE 是全聯盟相對排名**：只在賽季累積下有意義，無法相減、無法還原單場、單場也沒有百分位。
- 前端顯示：`PlayTypeCard.js` + `App.js` 的 Synergy 區塊 + 雷達圖（用 percentile）。

### B. 下一步：PlayType 單場還原（G3 的收尾，尚未做）

材料已經每天在存（見 A 的整數總量），但**還原邏輯與 UI 都還沒寫**。要做的話：
1. 後端或前端取「兩份 GP 差=1 的每日快照」，同一 playType 的 `possTotal/ptsTotal/fgmTotal/fgaTotal` 相減 → 得單場整數 → 算單場 `ppp = ΔPTS/ΔPOSS`、`fgPct = ΔFGM/ΔFGA`、`freq = 該類ΔPOSS / 全類ΔPOSS`。**因為存的是整數，相減無捨入誤差**。
2. `PERCENTILE` 略過（無法還原）；`GP` 差≠1 時標示為「N 場合計」不可拆。
3. 前端可把還原出的單場 PlayType 併進 `SingleGamePanel`（目前面板只有 Tracking/防守/分區投籃，缺 PlayType）。
4. 只對**未來賽季**有效：2025-26 當時存的是舊結構（無整數總量），無法回溯還原；2026-27 起每天都有材料。

### B2. 對戰對手分析（2026-10-23 已完成第一期）

第一期已上線，見「2026-10-23 對戰分析」與前端架構的「對戰分析」。之後可以做（都要先跟使用者確認）：
- [ ] **第二期：對手本季整體表現（聯盟排名）**——前瞻最缺的一塊。每日快照的球隊 request 目前帶 `TeamID=MIN`（伺服器端只回灰狼）；改成 `TeamID=0`（`_team_key()` 已支援，單場擷取就是這樣做）**request 次數不變**就能拿到全聯盟 30 隊，對戰頁可加「對手本季進攻／防守排第幾」。代價：要開新集合（**必加安全規則 read 白名單與 `*` 索引豁免**），且超出「只用現有資料」的範圍
- [ ] 對手 Tracking／Hustle 逐場資料從 2026-10 起才有，累積幾季後可在單隊頁加「對手端進階數據」；舊場次要補得整場重跑（每場約 20 requests）或另寫只抓球隊端的模式（約 9 requests）
- [ ] 2022-23～2024-25 若補 box score（`--box-only`，約 290 場 × 2 requests），每節分差、對手 box、對手球員就能涵蓋整個近三季範圍（使用者這次選擇不補）
- [ ] 「急停出手數」等出手次數類指標目前沿用 defs 預設（越多越好），對戰頁會標綠；若使用者認為應不分好壞，在 `constants.js` 加 `neutral: true`，所有頁面一起改

### C. 常見雷區（都踩過，務必記得）

- **新 Firestore 集合 = 必加 `*` 索引豁免**：否則該集合的每個欄位都會自動建索引，儲存量約是資料的 5～16 倍（見「Firestore 索引豁免」）。和下一條 read 規則一起做。
- **新 Firestore 集合 = 必加 read 規則**：每加一個集合，都要去 Firebase Console 在 `match /databases/{database}/documents { ... }` **大括號內**加 `allow read: if request.auth != null`。這個 session 踩了兩次（`wolves_shotcharts`、`wolves_*_games`），症狀都是前端 `Missing or insufficient permissions`。放到大括號外會靜默失效。
- **`.bat` / 重導向輸出要 `PYTHONIOENCODING=utf-8`**：腳本裡有 emoji（🔑✅），Windows 預設 cp950 會在 `print` 時崩潰。正式 `.bat` 已設；手動 `python x.py > log.txt` 也要設，否則死在第一個 emoji。
- **新每日欄位要加進 `DATA_KEYS`**（`fetch_data.py`）：否則去重不會比對它，可能漏寫或誤判相同。
- **改 `components/*.js` 後一定要 `python scripts/bundle.py`**：前端讀的是 `dist/components-bundle.js` 與 `dist/app.css`；新元件還要加進 `bundle.py` 的 `ORDER`（放在 `App.js` 之前）。
- **GitHub Pages 偶發 `Deployment failed, try again later`**：GitHub 暫時性，`gh run rerun <id>` 重跑即可，不是程式問題。
- **Firestore 查詢只用 doc id 升冪範圍**：`orderBy(documentId(),'desc')`、`limitToLast` 都需要另建索引，會回 `failed-precondition`；`onSnapshot` 必帶 error callback，否則失敗時畫面永遠停在骨架。
- **slate-500/600 已被改成較亮的自訂值**（對比 AA）：看到 `text-slate-500` 不等於 Tailwind 原生色。
- **讀 Firestore 要等匿名登入完成（`isCloud`）**（2026-10-19 修）：安全規則要求已登入。原本當季快照訂閱只檢查 `window.db`，登入較慢時先被拒，錯誤狀態又只在換賽季時清除，畫面卡在「讀取失敗」。新增讀取的 effect 一律加 `isCloud` 條件
- **`UI.Section` 的 `right` 區不換行**：放很多按鈕（球員 chips 等）會把手機版面撐寬，改放區塊內容第一行
- **Bash heredoc 裡的 Python 若含 JSX／反引號／`'''`** 容易解析失敗：改寫成檔案再執行
- **季末／每日快照的球員數據是「整季合併」**（`backfill_history.py` 不加 TeamID 篩選）：季中轉隊的球員含他隊比賽。要「只算灰狼」的累計值，一律用逐場 bundle（2026-10-20 薪資×表現踩過）
- **薪資頁的 apron 空間要用 apron 薪資**（含 unlikely incentives），不是奢侈稅薪資；Sheet 漏填 unlikely 時頁面會出黃色「資料對帳」提示
- **清理 Firestore 資料後，前端所有 localStorage 快取鍵都要換版**（2026-10-23 踩過）：單場文件有兩處快取——`SingleGamePanel`（`wt_game_v3_`）與 `loadGameDocs`（`wt_gc_v2_`，單場頁／對戰頁）。Phase 0 只換了前者，單場頁的永久快取差點把清理前的資料留在讀者瀏覽器裡。動資料前先 `grep localStorage.setItem` 找出所有快取
- **「近 N 季」這類範圍不要嚴格照季數切**：開季時當季只有幾場，嚴格三季等於兩季的量；對戰分析用「當季未過半多含一季」解決
- **對戰分析的標籤要有場數門檻**：「前 3 名」在只看本季、只有 1 個對手時也會選到它（曾把只打 1 場的 MIA 標成勁敵）

### D. 效能與擴充強化點

- **讀取配額是唯一會隨流量成長的**：2026-10 起開站只讀近期快照（見「效能與無障礙」），整季只在需要時才讀。寫入極寬鬆；儲存在 2026-10-19 設索引豁免後也寬鬆（見「Firestore 方案與用量」）。
- **中文字型約 1 MB**（Noto Sans TC 切片，首次造訪下載、之後快取）：使用者 2026-10 決定先不換；若要再省，可改用系統中文字（微軟正黑體／蘋方），英數字型不受影響。
- **每日請求預算**：目前約 71/天（快照 70＋賽程 1，2026-10 實測），比賽隔天另加單場每場約 24（含對手與 box score）。看門狗（2026-10-26 起）正常日只加 1（讀賽程）；比賽隔天下午先抓暫定版再加約 26（隔天 03:00 定稿時同一場會再抓一次）；主排程失敗的日子補一次完整抓取約 95。加新 endpoint 會同步升高 + 被擋風險。原則：**優先用「全聯盟單次請求」的 leaguedash 系列**（一次拿全隊）；逐球員的 `shotchartdetail` 才降為每週；每日只另加「單場全隊」投籃查詢（比賽隔天 +1）。真要加逐球員數據，比照 `fetch_shotchart.py` 走每週排程。
- **單場資料是累積欄位的子集**：`nba_common.fetch_single_game()`（回補與每日共用）只抓基本數據 + tracking + 對位防守 + Hustle + 分區投籃（＋對手同樣欄位與 box score）。想讓單場也有投籃拆分 / 防守 box / 對手分區，在這個函式加對應 `fetch_*`，再重跑回補（`--start/--limit` 分批）。`SingleGamePanel` 會自動顯示新增的群組（它只渲染「有資料」的 def）。
- **配色未抽變數**：色值以 hex 直接寫在各元件（Tailwind arbitrary values）。改配色目前靠 `sed` 全域替換 + CLAUDE.md 色票表。若之後配色常改，值得抽成 CSS 變數或 Tailwind theme extend（一次性重構所有 `[#...]` 類名）。
- **`SingleGamePanel` 的日期選單靠索引文件**：`wolves_games_index/{season}_{type}`。當季由每日 `fetch_data.py` 自動重建；歷史賽季回補後跑 `backfill_games.py --index-only`。

### E. 可清理 / 待整理（低優先）

- 專案根目錄有早期開發遺留的 `debug_*.py` / `test_*.py`（約 10 個），可清。
- `scripts/backfill_queue.txt`、`run_backfill_next.bat`、`cleanup_and_tag.py` 是 Phase 1 一次性產物，queue 已空、`WolvesBackfill` 排程已刪，可視需要移除。

---

## 更新紀錄

- 2026-10-26 — 每日抓取看門狗（Phase 1–4）：`fetch_data.py` 加 `--games-only`、`fetch_status.json`、被擋結束碼 2／Firebase 失敗結束碼 1；新增 `scripts/watchdog.py`（15:00 分級補抓、Windows 桌面通知、`--dry-run`／`--test-notify`）與 `run_watchdog.bat`、排程 `WolvesWatchdog`；`WolvesTracker` 改為用電池可跑；`.gitignore` 加 `fetch_status.json`、`watchdog_log.txt`；新增「2026-10-26 每日抓取看門狗」章節，更新「自動化排程」、檔案結構、FAQ、請求預算
- 2026-10-23 — 對戰分析（Phase 0–5）：`backfill_games.py --clean-players` 清理 2022-23～2024-25 單場球員文件（剔除 76 場 105 人次，重建 bundle）；`matchupData.js`（`window.Matchup`）、`MATCHUP_RULES`／`MATCHUP_TAGS`／`NBA_TEAM_NAMES`；對戰首頁 `MatchupHome.js`（`#vs`）、單隊對戰頁 `MatchupPage.js`（`#vs=三碼`）、刊頭「對戰」與搜尋入口、單場頁「歷次交手」連結、Splits 對手篩選；`gamesData.loadGameDocs` 共用單場文件讀取（快取鍵 `wt_gc_v2_`、`SingleGamePanel` 換 `wt_game_v3_`）；`glossary.js` 新增 OPP_PTS／MU_* 說明；新增「2026-10-23 對戰分析」「對戰分析」章節、FAQ、雷區，B2 改為已完成並列出第二期
- 2026-10-20 — 薪資頁（Cap Sheet，Phase 1–6）：Google Sheet＋`sync_salary.py`＋`wolves_salary/main`（安全規則、索引豁免已設）；`CapPage.js` 四分頁（總覽／合約／選秀權／規則）、累犯依 `tax_history` 自動判定、懸停完整金額、球員薪資膠囊與雙向連結、薪資×表現（逐場 bundle 計算）；`ui.js` 匯出加 `source`；新增「2026-10-20 薪資頁」「薪資資料」「薪資頁」章節與相關 FAQ、雷區
- 2026-10-19 — 單場比賽頁＋跨季疊圖（Phase 1–6）：`--box-only` 補 2025-26 box score、網址 m/hl/game、Splits 防守組、走勢勝負底色、`GamePage.js`、`SeasonPaceChart.js`／`LineOverlay`、ComparisonTab 多序列、投籃與上季比；修登入時序 bug；更正 22-23／23-24 逐場已有資料；新增「2026-10-19 單場比賽頁＋跨季疊圖」「單場比賽頁」「跨季疊圖」章節
- 2026-10-19 — 單場加抓對手球隊／球員與完整 box score（先發、DNP、每節比分、傷停）；灰狼單場球員改以 box score PlayerID 過濾（修 Terrence Shannon Jr 名字寫法不一致被漏掉）
- 2026-10-19 — 開季前修正：賽季改由日期推算、每日單場改依賽程補抓＋bundle 增量更新＋定稿規則、排程改台北 03:00；Firestore 更正為 Blaze 方案、10 個集合設 `*` 索引豁免（儲存估算由每季 ~139 MiB 降至 ~16～19 MiB）

- 2026-10-14 — SECONDARY_AST 依 NBA.com 官方定義改寫並更名「二次助攻」，glossary 已無待確認條目
- 2026-10-14 — Wolves Ledger 改版 Phase 6–7：近期快照載入、移除阻斷載入、對比 AA、觸控目標、總覽近 N 場、引用附網址；新增「效能與無障礙」「2026-10 Wolves Ledger 改版」，更新檔案結構、Spark 用量、雷區與常見問題
