# Wolves Tracker 開發紀錄（history）

> 這份是**歷史**：各功能當時的需求、做法、驗證、**使用者確認過的決定**，以及已完成項目總表與更新紀錄。內容停在當時的狀態，**現況以 `doc/handover.md` 為準**。
> 2026-11-19 由 handover.md 拆出（技術債 E 批）。要改某功能前，先讀它那一節的「使用者確認過的決定（之後改動前先問）」。

## 目錄
- 已完成項目（總表）
- 2026-07 六分頁大改版
- 功能開發紀錄（2026-10～11）：
  - 2026-10 Wolves Ledger 改版（專欄研究工具重設計）
  - 2026-10-19 單場比賽頁＋跨季疊圖
  - 2026-10-20 薪資頁（Cap Sheet）
  - 2026-10-23 對戰分析
  - 2026-10-24 單場分頁＋介面統一
  - 2026-10-24 網址改用球員「ID-名字」＋賽季參數統一
  - 2026-10-24 網站圖示（PWA／加入主畫面）
  - 2026-10-26 每日抓取看門狗
  - 2026-10-27 正式站掃描：資料顯示修正
  - 2026-10-28 效能與手機入口
  - 2026-10-28 聯盟名次與引用籃
  - 2026-11-05 戰報引用
  - 2026-11-18 引用籃格式對齊貼文
  - 2026-11-04 手機版巡檢與單場題材
  - 2026-11-04 歷史定位
  - 2026-11-04 條件戰績
  - 2026-11-04 賽前預覽與完整賽程
  - 2026-11-12 組合數據、全域期間篩選、球員比較
  - 2026-11-12 護框與兩分／三分防守
  - 2026-11-12 個人效率、得分組成與抓取對帳
  - 2026-11-13 資料品質小修（逐場對帳、最近防守者出賽場數）
  - 2026-11-13 球員聯盟名次
  - 2026-11-20 總覽期間篩選擴大與攻守切換移位
  - 2026-11-21 單場 Playtype 與用詞改為回合數
- 對戰分析後續構想
- 單場球員清理紀錄
- 舊版手冊開頭摘要（2026-11-18 以前）
- 更新紀錄

---

## 已完成項目

| # | 項目 | 狀態 | 說明 |
|---|---|---|---|
| 1 | Firebase 整合 | ✅ | 前端以 Firestore lite 的 `getDocs`（當季範圍查詢）+ `getDoc`（歷史）讀取（2026-10-28 前當季用 `onSnapshot`） |
| 2 | Python 爬蟲腳本 | ✅ | `scripts/fetch_data.py`，含 11 PlayType + 6 Tracking |
| 3 | 前端 UI 全面改寫 | ✅ | 雷達圖、Tracking 卡片、球員頭像、賽季標籤 |
| 4 | 反爬蟲機制 | ✅ | curl_cffi 瀏覽器 TLS 模擬 + retry；被擋自動換指紋（2026-10-29，見 FAQ「NBA API 跑失敗」） |
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
| 24 | **防守數據（每日）** | ✅ | 對位防守 `leaguedashptdefend`（全隊版 `leaguedashptteamdefend`）+ Hustle + 防守 box + 對手分區；`nba_common.py` 4 支 `fetch_*` + 設定表 |
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
| 40 | **組合數據** | ✅ | 每日抓二人／三人／五人全部組合 → `wolves_games_index/{season}_{type}_lineups`（每日 +2 requests）；2022-23 起各季已回補；組合頁 `LineupsPage.js`（`#lineups`） |
| 41 | **全域期間篩選** | ✅ | `periodFilter.js`（`window.Period`）＋`PeriodControl.js`：期間與條件從 Splits 升級成主畫面共用（網址 `pd=`／`c=`）；總覽、Splits、投籃、防守跟著期間，整季快照區塊 `UI.Locked` 停用 |
| 42 | **球員比較** | ✅ | `compareData.js`（`window.Compare`）＋`ComparePage.js`（`#cmp`）：兩位灰狼球員並排（可各選賽季），差距最大、逐項對照、兩人同場、逐場走勢、Playtype |
| 43 | **護框與兩分／三分防守** | ✅ | 最近防守者加 `2 Pointers`、`Less Than 6Ft`（`MATCHUP_CATEGORIES`，每日 +4、每場 +2 requests）；防守章節 3 × 3＋「護框」群組、全隊名次、期間 vs 平常加權、小樣本標示；2022-23 起歷史快照與本季逐場已回補 |
| 44 | **個人效率與得分組成** | ✅ | 球員整季進階（`advanced`）與得分組成（`scoring`，球員＋全隊、全隊名次），每日 +5；總覽「個人效率」、季平均 TS%／eFG%、投籃「得分組成」、跨季「效率」「得分組成」；2022-23 起歷史快照已補（含全隊進階） |
| 45 | **抓取與前端露出對帳** | ✅ | 停抓投籃拆分（每日 −2；2026-11-13 實測每日共 84）；補露出三分出手占比、接球跳投／急停跳投得分、切入助攻率、對手二波得分；重抓開季頭 4 場少抓的 Tracking |
| 46 | **資料品質小修** | ✅ | 看門狗每日逐場對帳（全隊逐場加總 vs 整季快照，0 request，有落差才通知）；最近防守者出賽場數 `D_GP` 修正「樣本小」次數 |
| 47 | **球員聯盟名次** | ✅ | `player_league_ranks()` 每日算灰狼球員在全聯盟合格球員中的名次（0 額外 request），存球員文件 `ranks`；前端前 30 名綠字、「?」小卡說明門檻與沒有名次的原因 |
| 48 | **單場 Playtype（全隊）** | ✅ | 每日快照 Synergy 整數總量相減 → `wolves_team_games.playtype`（0 request，`backfill_games.py --playtype-only`）；單場頁 Playtype 分頁（`tab=pt`）；全站用詞改「回合數／每回合得分」 |

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
  - 跨季比較 → `wolves_*_history` 各季終點快照＋當季每日快照最新一份（`ComparisonTab` + `loadComparisonSeason`；清單 `constants.js` 的 `COMPARISON_SEASON_OPTIONS`，當季 key 為 `current_regular`／`current_playoffs`，季後賽要等例行賽期結束才列；當季已進 `HISTORY_SEASONS` 就只用歷史那份）。預設勾同賽別最近兩季。
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

## 功能開發紀錄（2026-10～11）

（早期 4 階段計畫書 `doc/plan.md` 已於 2026-11-19 移除，內容見 git 歷史。）

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
- `scripts/watchdog.py`：台北 15:00（≈ 美東 02:00，最晚的西岸場剛打完）檢查兩件事——**今天主排程有沒有完成**（讀 `fetch_status.json`，不看快照文件在不在：沒比賽的日子數據相同會被 dedup 跳過寫入）、**賽程上最新一場在不在 `wolves_player_games`**。前者沒完成 → 完整抓取（約 95 requests）；後者缺 → `fetch_data.py --games-only`（約 28 requests：名冊 1＋賽程 1＋單場 26）。補完再檢查一次，成功／失敗都跳通知；正常只花 1 個 request（讀賽程）、不通知
- 下午補抓的單場未過定稿門檻（`final=False`），隔天 03:00 主排程照「單場數據」的定稿規則自動重抓成最終版，**不必另外處理**
- `fetch_data.py`：新增 `--games-only`；每次執行寫 `fetch_status.json`（`full`／`games` 分開記 `ok`、`finishedAt`、`etDate`、`note`）；「Synergy 與 base 皆空」改以**結束碼 2** 結束、Firebase 初始化失敗結束碼 1（舊版都是 0，排程看不出來）
- 主排程與看門狗同時啟動（電腦 03:00、15:00 都沒開機，開機登入後兩個一起補跑，**啟動順序不保證**）：看門狗讀 `WolvesTracker` 的上次執行時間，早於最近一次應觸發時間（觸發時刻從排程讀，不寫死 03:00）＝錯過待補跑 → 先等它啟動（每 30 秒看一次，最多 10 分鐘，`WAIT_MAIN_START_MINUTES`），再等它跑完（最多 60 分鐘）；10 分鐘都沒啟動（如被停用）才由看門狗自行補抓並記 `⚠️`。另外也偵測系統中執行中的 `fetch_data.py`（含終端機手動執行）一樣等它跑完；`Win32_Process` 會列出已結束但仍被握著 handle 的殘影程序（`HasExited=True`，重開機才消失，2026-10-26 遇過 10/23 的 `backfill_history.py` 殘影），偵測時以 `Get-Process` 確認還活著才算，避免殘影讓看門狗每天白等 60 分鐘。主排程 03:00 有跑但失敗時上次執行時間是當天，不等、照常補抓。2026-10-26 修補（初版只看排程狀態，看門狗若先啟動會和主排程同時完整抓取）。**等滿 60 分鐘主排程仍在跑就放棄這次補抓**（記 `⚠️ … 本次不補抓`，交給下一次看門狗）：跑這麼久多半是 NBA 逾時／被擋，再開一個抓取只會加重。2026-10-29 修補（舊版等滿照樣補抓：07:37 解鎖觸發早上看門狗、07:43 主排程補跑後每個 request 都逾時，08:48 看門狗自己再開完整抓取，45 分鐘逾時被殺，寫 `fetch_log.txt` 又撞到 `run_fetch.bat` 的檔案鎖 → `PermissionError`）。補抓輸出寫不進 `fetch_log.txt`（主排程的 `>>` 轉向握著）時改寫 `fetch_log_watchdog.txt`（不進版控），失敗通知寫出實際檔名
- 通知：PowerShell 5.1 內建 toast（借用 Windows PowerShell 的 AppUserModelID，免註冊、免套件；pwsh 7 沒有 WinRT 不能用）；勿擾／專注模式時不跳出但留在通知中心
- `WolvesTracker` 一併改為**用電池可啟動、拔電不中斷**（原設定備份在 `~/.claude/ops/backup-20261026/WolvesTracker-task.xml`）

使用者確認過的決定（之後改動前先問）：
- **檢查只在 15:00 一次**（不另設 04:00 檢查主排程）；主排程 03:00 不動——2026-10-28 使用者改為加開早上看門狗（只補主排程，見「自動化排程」）
- **只在有補抓或失敗時通知**，正常的日子不吵；回報用桌面通知＋log，不用 Email／Claude 排程任務
- **分兩級補抓**：只缺單場時不重抓整份快照（省約 70 requests、降低被擋風險）

### 2026-10-27 正式站掃描：資料顯示修正

掃正式站時發現幾個會誤導讀者的顯示問題，一次修正（純前端，不動 Firestore 資料）：
- **「整組 0」當缺資料**：NBA 單場 Tracking 還沒釋出時，`CatchShoot`／`PullUpShot` 會回整組 0（不是空的），同時 `Touches`／`Drives` 整個缺。原本畫面印出「出手 0、命中率 0%」，季平均也被拉低。全部賽季掃過只有兩場：2022-23 的 2023-04-08（已永久留在資料裡）與 2026-10-26 首抓（會被每日補抓蓋掉）。`gamesData.js` 新增 `window.cleanGameStats(s)`／`cleanGameDoc(d)`，在**資料載入層**統一清理（bundle、`loadGameDocs`、`SingleGamePanel`），規則：
  1. 缺 `TOUCHES` 且 `CATCH_SHOOT_*`／`PULL_UP_*` 全是 0 → 該組清成 `null`（有上場的實體只要 Tracking 有資料就一定有 `TOUCHES`）
  2. 比率欄（`GameAgg.RATIO_DEFS`／`EFG_DEFS`）分母為 0 → `null`（0 出手不顯示 0%）
  清成 `null` 而不是刪掉：`SingleGamePanel` 照樣顯示該群組、每格「—」；`GameAgg` 與單場頁展開列本來就略過非數字
- **Playtype 中文名**：`constants.js` 新增 `window.ptName(type)`（`Spotup` → 定點投籃，與 glossary `PT_*` 同名），總覽強弱項、Playtype 表格／卡片、雷達軸一律「中文＋小字原文」；手機表格首欄中文不換行、原文第二行
- **比分看板**：依每節比分算延長節數，顯示 `FINAL/OT`、`FINAL/2OT`（沒有每節比分的舊場次只顯示 `FINAL`）
- **格式**：`window.fix1(v)`（一位小數，捨入後的 `-0.0` 顯示 `0.0`），對戰頁 `fmt`／`signed` 改用它；`UI.Delta` 改固定位數（`▲ 1` → `▲ 1.00`）

抓取端同日補上：`nba_common.tracking_zero_filled(stats)`（與前端同一規則）併入 `fetch_single_game` 的 `partial` 判定，看灰狼與對手兩隊球隊數據，整組 0 就標 `partial=True`，每日補抓定稿後最多重抓 3 次。以 Firestore 現有 380 份 `wolves_team_games` 驗證只命中這兩場、無誤判。2023-04-08 是舊回補文件（沒有 `partial` 欄位、視為已定稿），不會自動重抓；要補得手動 `backfill_games.py --season 2022-23 --type regular --dates 2023-04-08`（約 20 requests，NBA 那天的 Tracking 可能本來就沒有）。

### 2026-10-28 效能與手機入口

- **移除 Recharts**：雷達圖改自繪 SVG（軸從正上方順時針、0–100 四圈刻度、頂點 `<title>` 顯示數值、`aria-label` 列出全部數值），見「效能與無障礙」
- **手機刊頭**：對戰／薪資／搜尋改放字標同一列（`lg:hidden`），第二列只留賽季／賽別／賽程／複製連結；桌面版不變。字標手機 22px
- **分頁列 `UI.TabBar`**：放不下時右緣漸層＋「›」按鈕（捲 120px，捲到底自動消失）；選中的分頁自動捲進可視範圍（網址或數字鍵直接切到 Playtype／跨季時）。章節列、單場頁、薪資頁共用
- **身分列標題**手機 23px（「MINNESOTA TIMBERWOLVES」不再被截斷）
- **開季小樣本提示**：`window.smallSampleNote(n, 名稱)`（門檻 `SMALL_SAMPLE_GAMES = 10`，`constants.js`）——Playtype 表格、總覽 Playtype 強弱項看 Synergy `gp`，單場頁「本場 vs 季平均」看賽前季平均場數，不足就顯示黃色提示
- **對戰預設範圍名稱**：本季例行賽未過半時選單與說明改叫「前三季＋本季」（原本一律叫「近三季」，實際卻含四個賽季）；`RangeBar` 收 `regGP` 自行判斷
- **分享預覽圖**：`icons/og-image.svg` → `build_icons.py` 產 `og-image.png`（1200×630，站徽由腳本把 `<!--ICON-->` 換成 `icon.svg` 內容），`index.html` 加 `og:image`／`og:url`、`twitter:card=summary_large_image`。`@resvg/resvg-js` 2.6.2 帶 `resourcesDir` 會忽略 `fitTo`（圖示全變原稿尺寸），也不載外部 SVG，所以不用 `<image>`
- **HANDOFF 0.00 PPP 查證**：快照原始資料是 3 場 8 次球權、8 投 0 中、0 分，是真實數據；使用率「—」是 NBA 對低球權類型回 `POSS_PCT=0` 的已知狀況，不需處理
- **03:00 主排程沒執行（10/27、10/28）**：筆電是 Modern Standby（S0），電源計畫的「允許喚醒計時器」電池模式為停用（插電才啟用），電池待命 3 小時後會休眠，因此 03:00 不會被喚醒；10/28 08:05 喚醒後 3 分鐘又回到待命，錯過的排程也沒補跑。使用者選擇加早上看門狗（`WolvesWatchdogMorning`，見「自動化排程」）；未改電源設定、主排程時間不變

### 2026-10-28 聯盟名次與引用籃

起因：使用者的粉專貼文開頭固定列一段數據（`※三分出手數／命中率：41.7（聯盟第4）／39.3%（聯盟第5）`），網站原本沒有聯盟名次、也沒有全隊進攻效率，複製引用一次一格且帶來源網址，不適合直接貼文。寫作格式的歸納見記憶檔 `user-fb-citation-format`（掃個人首頁 220 篇貼文）。

**聯盟名次（後端，`nba_common.py`／`fetch_data.py`）**
- 每日抓取的全隊類別（base／tracking／shooting／clutch／defense）改以 `TeamID=0` 一次拿 30 隊，**請求數不變**；`split_league()` 拆出灰狼那份（存回原欄位，與改前逐欄相同）與名次
- `fetch_pt_shots`／`fetch_clutch`／`fetch_defense_box`／`fetch_opp_shot_locations` 原本寫死 `TEAM_ID` 與 key `"MIN"`，已補 `team_id` 參數、key 改用列上的 `TEAM_ID`（`_team_key`）；預設值不變，回補與單場擷取不受影響
- 新增全隊進階 `fetch_team_advanced()`（`ADVANCED_FIELDS`：OffRtg/DefRtg/NetRtg/Pace/TS%/eFG%/AST%/TOV%/OREB%/DREB%，API 比例欄為 0～1，×100），每日 **+1 請求**（71 → 72）
- 名次方向設定表：`RANK_LOWER_BETTER`（越低越好）、`RANK_SKIP`（不排名）；`*` 開頭為欄名結尾比對（`*_OPP_FG_PCT`）。沒列到的一律「數值大＝第 1」（次數類照數量排）
- `league_ranks()`：同分取最小名次（1、2、2、4），用存進文件的值（已四捨五入）排；另寫 `_n`＝參與排名隊數（開季初 Clutch 只有 28 隊有資料）
- 驗證（2026-10-28）：灰狼 5 類 127 欄與既有文件逐欄相同；名次對 NBA 回應自帶的 `*_RANK` 欄（base／advanced／defense box）38 項中 37 項一致，唯一不一致 OREB 是兩隊顯示值同為 16.3、NBA 以內部精度分先後（API 只給一位小數，無法重現）
- **只做當季**：歷史期末快照沒有 `ranks`／`advanced`，未回補（使用者決定）

**聯盟名次（前端）**
- `App.js` 每次 render 設 `window.RankCtx`：只在全隊視角、當季每日快照有 `ranks` 時有值（時光機跟著那天的快照；上線前的快照沒有名次就不顯示）
- `window.leagueRank(類別或陣列, 欄位)` → `{ rank, n, date }`；`UI.StatCell` 的 `rank` 在數值下方顯示「聯盟第N」、「?」小卡加一行名次依據、複製引用帶「（聯盟第N）」
- 掛名次的位置：身分列 4 項、總覽季平均（僅「全季」）、Clutch、防守各卡（`TrackingCardRow rankCats="defense"`）、Splits 期間「全季」（`rankable`，欄位組 → 類別見 `SplitsTab` 的 `RANK_CATS`）、總覽新增「全隊效率」（`advanced`）
- **投籃分頁不掛名次**：那裡的命中率格是逐球 shotchart 自算，不是快照數字
- **球隊 Playtype**：`window.ptRank(PR)` = `1 + round((1 − PR/100) × 29)`（NBA 以 30 隊名次換算球隊百分位，2025-26 Isolation／Transition 實測驗證）；表格百分位旁小字「第N」、強弱項清單也有；歷史賽季同樣成立。**球員百分位不能換算**（是跟達門檻的球員比，人數不固定），維持 PR
- 名次是 NBA 官方全季數值的排序，季平均格是逐場重算，偶爾差一點小數，以官方為準（「?」小卡有說明）

**引用籃（`quoteFormat.js`／`QuoteBasket.js`）**
- 入口：`UI.Info` 帶 `quote`（回傳項目的函式）時小卡多「＋加入引用籃」；`StatCell` 依 `window.CiteCtx` 自動組項目（`window.Quote.make`），`quote` prop 可覆寫欄位、傳 `null` 不提供。沒有 glossary 定義也保留入口
- 比較項目的入口：Splits 選期間時 `TrackingCardRow compareTags=['全季', 期間]`（→）、球員 On/Off（在場 vs. 離場）、跨季比較每列名稱旁的「?」（2 季 →、3 季以上每季一行）；Playtype 列存 PPP＋名次或 PR；單場頁 Box Score 展開的球員進階（`CiteCtx.context` 帶「10/26 @ 騎士 125:127 敗」）
- **名稱一致性**（2026-10-29 徹查）：`label` 是中文、`en` 是原文，兩欄不可對調或塞說明。Playtype 一律「中文名每球權得分／`Cut PPP`」（防守「防守…每球權失分」），跨季比較與 Playtype 章節同名；Clutch 格加「關鍵時刻」前綴（`Clutch PTS`）；`Quote.make` 會剝掉 `en` 裡的全形括號說明（`DIFF%（負=守得好）`→`DIFF%`）；畫面小字不是英文名的格（薪資頁「預估奢侈稅」「標準合約」）用 `quote={{ en }}` 覆寫；受助攻比例原文為 `%AST FGM/2PM/3PM`
- 儲存：`localStorage` 的 `wt_quote_v1`（項目）、`wt_quote_opts_v1`（格式選項），保留到手動清空；讀寫失敗（私密模式等）退回記憶體；變動發 `wt-quote-change` 事件，另聽 `storage` 讓多分頁同步
- 項目格式：`{ id, kind: 'single'|'compare'|'line', subject, context, label, en, gkey, values: [{ tag, value, unit }], sep: '→'|'vs.', rank, pr, note, better, asOf, url, game }`（`note`、`line`、`game` 見「2026-11-05 戰報引用」）；合併後 `{ id, kind, subject, context, sep, parts: [A, B] }`。能合併的條件見 `Quote.canMerge`（同類、同主體同情境，比較項目還要比較對象相同）
- 排版 `Quote.render(items, opts)`（純函式）：符號一義（`：` 名稱／`／` 成對／`→` 時間先後／`vs.` 並列）；相鄰同主體同情境合成一組。單值 1A「●主體｜情境（括號為聯盟排名）＋※指標：值（第8）」、前後 2A／2B 差值／2C 📈📉（依 `better`，次數類不標）、並列 3A、三個以上值 3C。成對指標名稱表 `PAIRS` 在 `quoteFormat.js`（沒列到就寫「A／B」）。文末「※本文數據統計至 M/D」不寫「臺灣時間」（快照日期是美東日期）
- 抽屜：右下角浮動鈕（有項目才出現，避開安全區域）、桌面右側 460px／手機全螢幕、Esc／點背景關閉、焦點進出歸還；清空要按兩次（不用瀏覽器對話框）
- 測試：`Quote.render` 可在 Node 跑（`global.window = {addEventListener(){}, removeEventListener(){}}` 後 `require('components/quoteFormat.js')`），2026-10-28 以 15 組固定輸入驗證（測試腳本未提交）
- 未做：Box Score 傳統數據表沒有逐格入口（展開列有「加入本場數據」，2026-11-05）；「對比」分頁 2026-11-05 起有入口；Playtype 卡片檢視沒有名次小字。單場頁概要的「本場題材」有入口（2026-11-04）

### 2026-11-05 戰報引用

起因：使用者寫單場戰報時想直接引用「球隊 vs. 球隊」數據，並回報引用籃「不帶名次」拿不掉歷史定位、希望同人／同指標能合併。預覽圖 `_mockup/recap.html`（11/4 @ HOU 真實資料）確認後實作；使用者決定標頭隊名用全名、客場 `@` 主場 `vs.`、手機版球隊對比不放逐列「?」。

**單場頁「球隊對比」（`GamePage.js` 的 `cmpSection`）**
- 分組：基本 BOX → **四因素 FOUR FACTORS**（新）→ **投籃分區 SHOT ZONES**（新）→ TRACKING → HUSTLE；沒有數值的組不顯示
- 四因素全由兩隊 box 合計算：有效命中率 `(FGM+0.5×FG3M)/FGA`、失誤率 `TOV/POSS`（舊場次沒有 POSS 時用 `TOV/(FGA+0.44×FTA+TOV)`）、進攻籃板率 `OREB/(OREB+對手 DREB)`、罰球率 `FTM/FGA`（顯示 `.115`，glossary `FT_RATE`），另附進攻效率、節奏（中性，不比好壞）；失誤率越低越好（`LOW_BETTER`）
- 投籃分區讀單場 `stats`／`opp` 的 `RA/PAINT/MID/C3/AB3_FGM/FGA`，數值下方小字附「命中/出手」；對手分區只有 2026-10 起的場次
- 引用：每列「?」小卡（`UI.Info quote`）**只在 ≥640px 顯示**（手機版面太雜，使用者決定）；分組標題右側「＋整組加入」手機桌面都有，逐列 `Quote.add`，重複的不再加、toast 回報幾項已在籃子裡。項目是 `kind 'compare'`、`sep 'vs.'`、`subject ''`、tags「灰狼／火箭」，分區值寫「60.0%（6/10）」
- 已知資料疑點（未處理）：部分場次合理衝撞區與禁區非 RA 出手數看起來對調（11/4 RA 10、Paint 37；10/21、2025-11-10 也有），待查是 NBA 賽後初版分區還是抓取對應

**Box Score 展開列「加入本場數據」**
- 展開灰狼球員時最上方虛框預覽一行（`statLine`）：得分、籃板、助攻、投籃（有三分出手才括號三分）、有罰球出手才寫罰球、抄截／阻攻 ≥ 2 才寫、正負值；按鈕加入 `kind 'line'` 項目（`values[0].value` 是整行）
- 輸出：`●Ayo Dosunmu｜11/4 @ 火箭 117:107 勝` ＋ `※21 分 1 籃板 6 助攻、投籃 10/20（三分 0/3）、罰球 1/2、2 抄截、+10`；和同人的單項同組，「依球員／依指標」時排在該段最前；`line` 不能「併下一項」

**引用籃（`quoteFormat.js`／`QuoteBasket.js`）**
- `note`：歷史定位、本場焦點標籤等補充改存獨立欄位（以前黏在數值字串裡，「不帶名次」拿不掉），由「名次」開關控制；清單上灰字顯示。**改版前加入的舊項目**仍是黏在數值裡的，要重新加入
- `game`：單場頁的 `window.CiteCtx.game`（`{ date, home, opp, ms, os, wl, periods: [[灰狼, 對手]…], gameNo }`，季後賽 `gameNo` 取 gameId 末碼），`Quote.make` 自動帶上
- 整段標頭「單場比分」（籃子裡有帶 `game` 的項目才出現）：`@ 休士頓火箭 117:107 灰狼勝`（主場 `vs.`、季後賽前加 `G4`；城市全名表 `NBA_TEAM_CITIES`／`window.teamFullName` 在 `constants.js`）；選了才出現「每節比分」（`每節：33:30｜24:27｜…`）；同一場的項目省略各段的「｜11/4 @ 火箭…」情境
- 「排列」（`opts.order`，只影響輸出、不改籃子順序）：加入順序（相鄰同人共用標頭，原行為）／依球員（同主體＋情境集中，依第一次出現排序）／依指標（同指標同情境、兩位以上主體的單值項目合成「●干擾球」＋每人一行，其餘依球員）
- 測試：Node 跑 `Quote.render` 驗證四種排列、單場比分＋每節、名次開關、主場季後賽 `G4 vs. 丹佛金塊`、舊項目無 `game` 時退回無標頭（腳本未提交）

**驗證**：11/4 @ HOU 單場頁桌面 1280（28 列都有「?」）與手機 375（「?」全隱藏、標籤單行、無橫向溢出）；整組加入、重複加入、單列加入、展開列加入本場數據、名次開關、單場比分＋每節在抽屜實際輸出；舊場次（2026-03-05 vs TOR，無對手 tracking）照常顯示

### 2026-11-18 引用籃格式對齊貼文

起因：使用者拿兩篇近期貼文（〈26-27 灰狼防守初探〉、〈G14 vs. 拓荒者〉）要求檢視引用籃，並在正式站實際模擬操作。對照結果：排版主體已對齊，但貼文裡三段數據都手動刪了段首「●」（使用者文章用「●」當小節標題），另有小數位不一致、名次混用、例行賽沒有場次等問題。本次只做「格式」一組（使用者選定）；分段複製、抽屜版面、跨季項目統計日、對手球員引用等另議。

**引用籃（`quoteFormat.js`／`QuoteBasket.js`）**
- 新選項 `opts.bullet`（抽屜「段首符號」：無／●），**預設無**：各段標頭寫成 `灰狼全隊｜例行賽：25-26 → 26-27`；「●關鍵數據：」整段標頭不受影響。標頭內容是空字串時整行省略
- 依指標排列：段標頭補「（括號為聯盟排名）」；同一段同時有球員與全隊時，球員名次寫「（球員第15）」（188 位合格球員中），全隊照舊「（第10）」（30 隊）。以 `subject === '灰狼全隊'` 判斷全隊
- 單場比分標頭：例行賽也帶場次 `G14 vs. 波特蘭拓荒者 106:98 灰狼勝`（`GamePage` 的 `quoteGame.gameNo`＝同季同賽別場次索引中 ≤ 該日的場數；季後賽仍是 gameId 末碼＝系列賽第幾戰）；隊名維持全名（使用者決定）

**數值小數位（`ui.js` 的 `UI.cellNum`）**
- 存檔時四捨五入過的數字會掉尾零（-14.0 → `-14%`、54.0 → `54%`），和同段 `-0.4%`、`54.7%` 對不齊，畫面上也會出現「-4 %」。`StatCell` 改用 `UI.cellNum(value, unit, prevValue)`：百分比至少一位、其餘取本值與比較值較多的小數位（比較值最多參考 3 位），只補零不四捨五入；顯示、複製引用、加入引用籃同一份字串
- `TrackingCardRow` 的期間比較項目（全季 → 期間）兩邊同規則對齊，`signed` 指標（vs 平常）帶正號
- 單場頁「季均」一律一位小數（`fmtV(k, v, true)`：季均 10.0，不寫成 10）；本場次數照整數

**其他**
- 條件戰績引用的情境改用 `CiteCtx.season`（「2026-27 例行賽」），原本是 `primaryLabel` 的「當季例行賽」，和其他項目不同字、不會併段；複製引用同步
- 單場頁球員效率（`ADV_META`：進攻／防守／淨效率）引用名稱加「在場」（`※在場淨效率：+9.3`），畫面不變
- 改版前加入的舊項目（數值已是數字 -14）不會自動補零，要重新加入

**驗證**：Node 跑 `Quote.render` 以貼文三段＋單場（Shannon 本場數據、在場淨效率、球隊對比）比對，輸出與貼文逐字相同；本機預覽實測防守章節「-4.0%」、Splits 條件期間「54.7% → 54.0%」「15.7 → 15.0」、條件戰績情境、11/16 單場 G14 標頭與「季均 10.0」、抽屜新選項，主控台無錯誤

**同日第二輪（跨季修正＋統計日）**
- 跨季「效率」「得分組成」說明列原本顯示「undefined（當季取最新一份快照）」：`ComparisonTab.js` 的 `catSub` 補上兩鍵（查不到時退回「各季終點快照」）
- **直接開跨季頁（球員視角）時 26-27 欄整欄「—」**：`App.loadComparisonSeason` 在當季時先用記憶體裡的快照序列，剛進頁時全隊快照先到、球員快照還沒到，只拿到一邊就回傳並快取，球員欄就一直是空的。改成兩邊都有才用記憶體、否則讀 Firestore，快取也只存兩邊都有的結果（重整直開球員／全隊跨季皆驗證）
- 跨季引用含當季欄時，`asOf` 記那份當季快照的日期（當季值每天在變，例：貼文寫 Spotup 0.89、隔兩天站上是 0.91），引用籃「統計至」附得上；全是歷史賽季仍不附
- 跨季「效率」等保留原始精度的類別，同一列各季補成相同小數位（`ComparisonTab` 的 `rowDp`：取該列各季值的最大小數位，最多 3 位）：歷史 Pace 存檔掉尾零 `101.5` → `101.50`，與當季 `101.21` 對齊；只補零不四捨五入，表格、引用籃、臉書文字共用

**同日第三輪（B／C 組：分段複製、抽屜版面、對手球員）**——預覽圖 `_mockup/quote-basket.html`（11/16 vs POR 真實資料）確認後實作；使用者決定：項目區預設收起、手機也放分段複製、對手寫「名字（拓荒者）」、對手不做季平均
- `Quote.renderBlocks(items, opts)` → `[{ text, head }]`（`head`＝整段標頭或文末「統計至／來源」）；`Quote.render` 改成各段以空行接起來，輸出與改版前逐字相同（Node 比對 HEAD 版本）
- 抽屜（`QuoteBasket.js`）：預覽置頂、每段一張卡片（標頭／文末為虛框），右上角「複製」只複製那一段、按下後短暫顯示「已複製」；手機也有（分段複製是抽屜的主要用途，不算次要按鈕）。「項目」（排序／合併／刪除）與「格式」（選項列）收成摺疊區，**預設收起、不記狀態**；格式摺起時標題列顯示摘要（排列 · 段首 · 行首 · 指標名稱 · 前後比較 · 名次）。底部按鈕改名「複製全部」。原本的唯讀 textarea 拿掉，卡片文字可直接選取
- 對手 Box Score（`GamePage.js` 的 `oppExpand`）：點對手球員列展開，只有本場數據一行（規則同灰狼 `statLine`）＋「＋加入本場數據」；主體 `名字（拓荒者）`（`window.teamName`），排在單場比分標頭底下。展開狀態 `oppOpen` 只在頁面狀態、不寫網址（`p=` 只給灰狼）。對手沒有逐場季資料，不做進階與季平均
- 驗證：本機 11/16 單場頁加入 Camara／Avdija／Gobert，抽屜 4 段（標頭＋3 人）；桌面與手機 375 寬無橫向溢出、展開列在畫面內；分段複製以實際點擊驗證（腳本觸發的點擊沒有使用者手勢，瀏覽器會拒絕寫剪貼簿，屬正常）；主控台無錯誤

### 2026-11-04 手機版巡檢與單場題材

起因：使用者要求巡一次正式站（尤其手機版），並提出「讓專欄找題材」的互動點子；8 個點子中選定 1 單場靈感卡、2 條件戰績、3 歷史定位、6 賽前預覽（四項皆已上線，討論與決定見記憶檔 `project-interaction-ideas`）。

**手機版巡檢方法**：瀏覽器面板截圖在捲動後常畫不完整，改用 scratchpad 的 Node 腳本走 Chrome DevTools Protocol（`Emulation.setDeviceMetricsOverride` 375×812、DPR 2、mobile、觸控），整頁截圖再切一屏一張，並在頁面跑稽核腳本（橫向溢出、點擊區 < 24px、字級 < 10px、被截斷的文字）。headless Chrome 視窗最小約 500px 寬、iframe 內 Firebase 匿名登入會卡在「連線中」，都不能用來模擬手機。腳本未提交（本機暫存），要重做時照此思路重寫即可。

**手機版修正（P1／P2，已上線）**
- 五人陣容：`UI.DataTable` 加 `stackFirst`（手機第一欄獨占上方一行、數字欄收窄），總覽陣容表不再橫捲
- 刊頭第二列手機改換行（控制項總寬約 540px，橫捲會把「複製連結」藏在畫面外）；副標手機只留連線色點、單場頁省年份、對戰頁省英文副名
- 身分列手機不重複賽季，「數據截至」併入戰績行
- 單場頁手機改精簡比分區（一列比分＋兩行資訊＋逐節比分，約 400 → 230px）；平板比分卡隊名改換行
- Box Score 手機名字縮寫（J. McDaniels）、隱藏位置與「進階」字樣；`UI.scrollHint`（橫捲容器右緣陰影，純 CSS，還能往右捲才出現）套在 Box Score 與所有 `DataTable`
- `DataTable` 表頭「?」一律跟在標題右側（放左邊像屬於前一欄）；對戰總表標籤不換行；單場頁文字連結點擊區補到 24px（`linkCls` 加 `inline-block leading-6`）
- 賽程條 snap 對齊卡片左緣，尾端墊片（`data-strip-pad`）把最大捲動量補成卡片寬整數倍，不會停在半張卡
- 薪資頁「最後同步」改「最後異動」：`sync_salary.py` 內容雜湊相同就不寫入，`updatedAt` 其實是最後異動日
- 確認過不是 bug：本季 3 場灰狼切入失誤 0——NBA 原始回應本身就是 0（球隊與球員加總皆同）

**單場題材（本場題材 Story Leads）**
- 後端 `scripts/build_insights.py`：只讀逐場 bundle（全隊＋各球員灰狼場次，2022-23 起）與單場 box，**0 個 NBA request**，寫 `wolves_team_games/{date}.insights`（結構見「單場數據」）。全部 384 場約 17 秒（`db.get_all` 批次讀取；逐份讀要 90 秒）
- 名次語意（使用者決定）：**截至當場**——只和這場之前的比賽比，寫入後不變；之後被超越記在 `tag.after`（之後第一場超越它的比賽），前端把該標籤改灰框並加註。舊賽季的紀錄也可能被本季打破，所以每次都重算**全部**場次、只寫內容有變的
- 卡片：全隊 15 指標（`INSIGHT_TEAM_METRICS`，方向 high／low／neutral；high 另看反向「最低」，0 值不算）、個人 6 指標（`INSIGHT_PLAYER_METRICS`，各有本場最低量門檻，只看高）；範圍 all（2022-23 起前 3 名、樣本 ≥ 100／20）與 season（本季第 1、賽前 ≥ 3 場、不可並列）；上場 ≥ 15 分鐘；每人 ≤ 2、全場 ≤ 5，依名次與偏離程度排序。勝負關鍵＝Four Factors 依 Dean Oliver 權重（40／25／20／15）換算，勝場取貢獻最大、敗場取最負；需要 box，所以 2024-25 以前沒有
- 每日：`fetch_data.capture_recent_games()` 有寫入新場次才呼叫 `build_insights.run(db)`（失敗只印警告，不影響抓取；看門狗補抓走同一路徑）
- 前端（`GamePage.js` 的 `story`）：概要順序 本場焦點 → **本場題材** → 本場 vs 季平均；手機 1 欄、768 起 2 欄、1024 起 3 欄（640 寬三欄會截掉名字）；第一格勝負關鍵、其後題材。文案全在前端組：「2022-23 起第 2 高（42 場）」（不寫「灰狼生涯」——Edwards 等人在 2022-23 前就在灰狼）、越少越好與次數類用「多／少」（前端 `FEWER_IS_BETTER` 要和 `INSIGHT_TEAM_METRICS` 的 low 對齊）、第二行「前高／最高／追平 …（日期 對手）」與「之後被 … 超越」。綠框＝仍是紀錄、紅框＝本季最低、灰框＝次數類或已被超越。球員連球員頁、指標連 Splits 逐場走勢；「?」小卡可複製引用與加入引用籃（`※籃板：12（2022-23 起第 2 高、本季新高；最高 15，2026-03-30 @DAL）`，引用版不附場數以免雙層括號）
- 預覽頁：`_mockup/insights.html`（不進版控）
- 全部場次分布（2026-11-04）：0 張 32 場、1～4 張 266 場、5 張 86 場；2025-26 勝負關鍵：有效命中率 60、進攻籃板率 15、罰球率 10、失誤率 9

**附帶發現（未處理，待使用者決定）**：`wolves_pgames_bundle/2024-25_playoffs` 是一份格式不符的舊文件（內容是 2024-25 季後賽全隊 bundle，誤寫進球員集合），前端用不到；`build_insights.py` 以 id 格式略過

### 2026-11-04 歷史定位

起因：使用者選定的第 3 個點子「這數字算多嗎？」——單場頁看一個數字時，知道它在這位球員灰狼生涯（本站資料內）的位置。

**討論過程與決定（使用者）**
- 名次基準：**現在排名**（含之後的比賽），另寫「自 X 以來最高」（當時的視角）；與「本場題材」的「截至當場」不同，兩者用途不同
- 版面：先看了三版預覽（`_mockup/history-rank.html`）——A 每格加「?」、B 每格底部寫一行、**C 只標例外**（採用）。A／B 被否決的理由：12 格中值得寫的通常只有 1～2 格，其餘是「中段」，12 顆「?」或 12 行字都是雜訊；且格子本身是連結，再塞按鈕手機上容易誤觸
- 標籤門檻：原提「前後 5%」，用 2025-26 起 1,115 球員場次實測後改為**前 3 名＋上場 ≥ 15 分鐘**：

  | 規則 | 平均每人每場 | 至少亮 1 個 |
  |---|---|---|
  | 前後 5% | 0.89 | 51% |
  | 前後 5%＋≥15 分鐘 | 0.73 | 42% |
  | **前 3 名＋≥15 分鐘＋並列 ≤ 2** | 0.26 | 17%（只算 ≥15 分鐘的場次為 21%） |

  前後 5% 的問題：百分位門檻天生讓每項 10% 的場次被標，12 項合起來一半場次都亮，失去「例外」意義；低的一側多半是受傷提早退場、犯規麻煩（57 例，如 2025-10-26 Edwards 上場 3 分鐘被標得分最低）。指標本身（跟自己歷史比的名次）適合：對角色球員公平、不需常態假設（次數類偏斜、大量並列時 z-score 失真）、可直接寫進貼文；限制：只有 2022-23 起且只算灰狼場次（寫「灰狼第 N 高」不寫生涯）、看總量所以角色／上場時間變化會影響（Edwards 場均得分 25.0 → 33.2）

**兩條計算路徑（刻意分開）**
- **格子標籤 → 後端**：`build_insights.player_marks()` 寫 `insights.marks`，門檻 `nba_common.INSIGHT_MARK_RULES`（top 3、max_ties 2、min_n 20、min_att 5）、指標 `INSIGHT_MARK_METRICS`（＝前端 `VS_KEYS` 12 項；高的一側每項看、低的一側只看命中率類）。上場分鐘沿用 `INSIGHT_RULES.min_minutes`。**不存樣本數**：多打一場樣本數就變，存了會讓 384 份文件每天全改寫；實測每日新增一場只改寫 7～18 份舊文件
- **「?」小卡 → 前端**：`GamePage.playerHistory(pid, key)` 點開才讀該員 2022-23 起各季例行／季後 bundle（`loadSeasonGames`，約 600 KB，記憶體快取同次瀏覽不重讀），規則 `constants.js` 的 `HISTORY_RULES`（since、reportPct 20、minN 20、minAtt 5、sinceGap 10）。百分位用中位名次（並列算一半），前後 20% 寫「灰狼 42 場第 2 高（前 2%）」，其餘「中段（前 N%，n 場）」，樣本不足「灰狼才 14 場，樣本少」；往前找最近一場至少這麼高的比賽，相隔 ≥ 10 場才寫「自 2026-03-20 vs POR（86）以來最多」，沒有就寫「當時為 2022-23 起最高」
- **兩邊共用、必須同值**：命中率最少出手（`min_att`＝`minAtt`＝5）、最少場數（`min_n`＝`minN`＝20）
- 字眼：命中率類「高／低」；次數類（neutral、名稱以「數」結尾如傳球次數、觸球總數）與越少越好的次數（失誤）「多／少」——`GamePage.histWord`
- 顏色同本場題材（`CHIP` 已提到元件層級共用）：綠＝好的方向、紅＝不好、灰＝次數類

**元件**
- `UI.Info` 新增 `history`（回傳 Promise 的函式）：點開小卡才呼叫，顯示「載入歷史…」→ `{ title, main, sub, note }`；結果傳給 `cite(hist)`／`quote(hist)`，引用帶名次（`※切入次數：16（灰狼 42 場第 2 多）`）。**關閉小卡就清掉結果**（React 會把同位置的元件實例沿用給別的球員）；載入後小卡變高會重算位置
- 只在 Box Score 展開列（`metricRow`）掛 `history`；進階 box 的效率（`ADV_META`，不在 bundle）不掛
- 「本場 vs 季平均」格子：`markBadge(pid, key)`，標籤在數字列靠右

**單場快取有效期限（同日修正）**：`loadGameDocs` 改存 `{ savedAt, v }`，本季場次 1 天、舊賽季 7 天後重讀（`GAME_DOC_TTL_DAYS`），鍵 `wt_gc_v5_`。原本永久快取，讀者看過的場次不會收到每日重算的「之後被超越」灰框與現在排名。實作時踩到：`seasonForDate` 吃 Date 物件，傳字串會讓單場頁讀取失敗（`d.getTime is not a function`）

**Firestore 用量（2026-11-04 實測）**：全部 1,274 份約 25 MiB（免費額度 1 GiB 的 2.5%），`insights`（題材＋標籤）384 場共 0.47 MiB；每季約增加 10～15 MiB。每日題材計算讀約 550 份、寫 10～20 份（免費額度每日讀 5 萬、寫 2 萬）

**未做／可再議**：全隊數字（Four Factors、對比分頁）沒有歷史定位（本場題材已涵蓋全隊突出項）；小卡的低側（如 Edwards 2024-01-12 觸球並列第 16 少）多半反映上場時間短，若覺得多餘可改成只顯示高的一側


### 2026-11-04 條件戰績

起因：使用者選定的第 2 個點子——專欄最常用的句型「Edwards 30+ 時灰狼 18-14」「Gobert 缺陣時 3-3」。試算時就冒出題材：2025-26 Edwards 30+ 勝率 56%、低於其他場次的 62%。

**決定（使用者）**：條件三種（球員數據、全隊數據、球員有／未出賽）全做；最多 2 個條件（且）；範圍跟著所選賽季（與賽別），不做跨季；版型先看預覽（`_mockup/conditions.html`）；名字一律縮寫、控制項與標題不換行（記憶 `feedback-no-wrap-abbrev`，往後設計都適用）；「未出賽」的在隊期間採「交易截止日後算到季末」

**資料層 `components/splitConditions.js`（`window.SplitCond`，無 JSX，打包順序在 `matchupData.js` 之後、`urlState.js` 之前）**
- 條件：`{ who: 'T'|球員ID, kind: 'stat', key, op: 'ge'|'le', value }` 或 `{ who: 球員ID, kind: 'played'|'absent' }`；`isComplete`／`needPids`
- `evaluate(conds, { teamGames, playerGames, season })` → 符合的全隊場次日期 Set：**母體一律是全隊逐場**（球員視角也是）；球員數據條件要他有上場才算，命中率類該場出手 < `minAtt`（3）不算（`denOf` 取 `GameAgg.RATIO_DEFS`／`EFG_DEFS` 的分母）
- 在隊期間 `tenure()`：第一次出賽 → 最後一次出賽；最後一次在 `{賽季次年}-{deadlineMD}`（`02-15`）之後的算到該季最後一場。**2026-11-12 起當季且仍在名冊上的球員一律算到最新一場**（`evaluate` 的 `ctx.rosterIds`），否則季中傷停的人被當成離隊（本季 Edwards 未出賽 0 場 → 7 場）；歷史賽季沒有當時名冊，維持原規則。例：Gobert 2025-26 最後出賽 4/07，季末 4/08、4/10、4/12 輪休算進「未出賽」（6 場；只算到最後出賽是 3 場）。限制：交易截止日後才被裁或買斷的球員（少見）會被誤算成季末缺陣
- `summary(teamGames, dates)` → 符合／其他／全部的 `{ n, w, l, pct, pm }`（`pm`＝全隊正負值平均＝場均分差）
- 文字：`label`／`condLabel` 單行縮寫（`A. Edwards 得分≥30・全隊失誤≤12`），`abbr` 同單場頁 Box Score 手機版規則
- 指標：Splits 的 defs（基本、進階、投籃分區、防守）＋條件專用次數欄 `EXTRA`（上場時間〔僅球員〕、投籃命中、出手數、三分命中、三分出手、罰球出手、進攻／防守籃板、犯規）——Splits 卡片只有比率，但條件最常問次數
- 網址：`serialize`／`parse`，`c=1630162:PTS:ge:30~T:TOV:le:12`、`c=203497:absent`（`:` 分欄、`~` 分條件；格式不對的條件直接丟掉）
- 門檻：`constants.js` 的 `CONDITION_RULES`（maxConds 2、deadlineMD `02-15`、minAtt 3）；說明文字在 `glossary.js` 的 `SPLIT_COND`（摘要「?」小卡顯示）

**介面（`SplitsTab.js`；2026-11-12 起期間列與條件編輯器搬到全域期間面板 `PeriodControl.js`，見「2026-11-12 組合數據、全域期間篩選、球員比較」，以下規則不變）**
- 期間列最後「條件」；點了才展開編輯器，預設一列「第一位球員 得分 ≥（待填）」。每列：對象下拉（全隊＋球員縮寫）→ 指標下拉（球員多「出賽」群組：未出賽／有出賽；只列該實體有值的欄）→ **單顆 ≥／≤ 切換鈕**（兩段式 `UI.Seg` 在手機上約 76px，會把名字擠成「A. Edw」）→ 數值 → ✕；「＋ 加一個條件（且）」到上限就消失；移除最後一個條件回到全季
- 手機單行：下拉在手機限寬（對象 6.75rem、指標 5rem）、數值框 2.5rem、間距 3px；列本身 `overflow-x-auto`，更窄的手機放不下時只在列內橫捲、不撐寬整頁（實測 375px：兩列右緣 317／330px）
- 結果：戰績摘要一排三格（符合／其他／全季，手機也一排；「?」可複製引用、加入引用籃：`※A. Edwards 得分≥30・全隊失誤≤12 戰績：4-6（勝率 40%，其他 45-27）`）；少於 10 場顯示 `smallSampleNote`；「符合的 N 場」可展開，點了到單場頁；下方卡片牆照舊（這些場次 vs 全季）。Section 標題用條件文字、`truncate`、手機 18px、不顯示英文小字（`UI.Section` 的標題 span 加了 `min-w-0` 才能截斷）
- 資料：全隊視角直接用 `games`；球員視角另讀全隊 bundle（`condTeam`）當母體；條件提到的球員讀該季 bundle（`condPlayers`，換賽季清空）；都經 `loadSeasonGames` 記憶體快取
- App：`splitCond` 狀態（網址 `c=`，只在 Splits 寫入；`hashchange` 同步）、`splitsBundle`（＝逐場 bundle 載入的賽季／賽別）、`players`（`availablePlayers`＋`playerIdOf`）傳給 SplitsTab；SplitsTab 草稿完整才回報（`onCondChange`），離開「條件」期間回報空字串，回來草稿還在

**驗證**：2025-26 例行賽 9 組條件與 Python 試算一致（Edwards 30+ 18-14／其他 31-19、40+ 5-5、三分命中 ≥5 12-8、全隊三分% ≥40% 22-9、失誤 ≤12 17-9、籃板 ≥50 14-3、Edwards 未出賽 12-9、30+ 且失誤 ≤12 4-6）；互動（填值、切換 ≥／≤、加第二條件、改未出賽、離開再回來）、引用籃、點場次進單場頁、球員視角、手機／平板／桌面皆驗證

**踩到的坑：本機驗證被瀏覽器快取騙**：`python -m http.server` 不送快取標頭，瀏覽器面板與自動化截圖的 Chrome 設定檔會沿用舊 `index.html`（指向舊 bundle），一度誤判「首次開帶 `c=` 的網址會丟條件」。用全新設定檔＋在頁面載入前攔截 `history.replaceState` 才確認程式沒問題。**之後本機驗證前端：面板網址加查詢參數（`?nc=1#…`）或關掉快取（CDP `Network.setCacheDisabled`）**

### 2026-11-04 賽前預覽與完整賽程

起因：使用者選定的第 6 個點子（賽前預覽），討論中又擴充出「單獨一頁的完整賽程月曆（對手、主客、開賽時間、隊徽）」。兩者讀同一份文件，合併成一個計畫。

**決定（使用者）**：
- 預覽放在單場頁的「預覽模式」，首頁仍是最新一場；賽程條最後一張是「下一場」卡。
- 名次寫數字＋英文序數（1st、2nd…）。
- **日期全站維持美東**（評估過改台北顯示：5 季 458 場都是台北＝美東＋1 天，技術上可行，但使用者認為球迷記的是對手不是日期），開賽時間寫「台北隔日 09:30」。
- 完整賽程桌面用月曆格、手機用清單；入口三處：刊頭小月曆底部、單場頁返回列右側、搜尋。
- 只做當季。
- 版型預覽：`_mockup/preview.html`、`_mockup/schedule.html`；計畫：`_mockup/plan-preview-schedule.md`（皆不進版控）。

**後端（Phase 1，`b4a5706`；Phase 2 補 `oppId`／`fields`）**
- `scripts/build_preview.py` 寫 `wolves_games_index/{season}_preview`（約 36 KB，每天覆寫；放在既有集合，所以不用設安全規則與索引豁免；`build_bundles.py --all` 只認 `{season}_{regular|playoffs}`，不會誤處理）。
- 每日由 `fetch_data.py` 在單場擷取後呼叫 `build_preview.build()`，傳入本來就抓好的 30 隊 base／advanced，**只多 1 個 request**（cdn.nba.com 全聯盟賽程檔 `nc.SCHEDULE_URL`，要用 `nc.nba_get`，curl 會 403）；賽程檔抓不到就不寫、沿用前一天。
- 單獨執行 `python scripts/build_preview.py [--dry-run]` 共 3 個 request（賽程＋全隊 base／advanced）。
- 設定在 `nba_common`：`PREVIEW_TEAM_FIELDS`（欄位、來源、方向 high／low／neutral／none）、`PREVIEW_FORM_N`（近況場數）、`SCHEDULE_GAME_PREFIXES`（只收例行／季後／附加賽／盃賽決賽）、`fetch_league_schedule()`、`rank_all()`（同分取最小名次）。

**前端**
- `gamesData.loadPreview(season)`：只有當季才讀；記憶體＋localStorage `wt_pv_v1_{season}`（存 `{ savedAt, v }`，3 小時過期）；失敗回 null，入口自動隱藏。
- `constants.js`：
  - `kickoffTPE(g)`：依 `utc` 用 `Intl` 實算。台北日期剛好是美東＋1 天才寫「台北隔日 HH:MM」，否則寫「台北 M/D HH:MM」，不寫死。
  - `kickoffET(g)`：美東當地時間，含夏令時間。
  - `etToday()`：美東今天（Intl America/New_York，含夏令）；後端 `get_today_str()` 2026-11-19 起經 `nc.now_east()` 同規則（舊版後端寫死 UTC−5）。
  - `ordinal(n)`、`teamLogo(id 或三碼)`、`NBA_TEAM_IDS`、`PREVIEW_LABELS`（對照表列名）、`SPECIAL_GAME_TAGS`／`specialTag(label)`（盃賽、宿敵週）。
- **預覽模式 `PreviewPanel.js`**：`GamePage` 找不到單場文件、但預覽賽程有這天時改畫它（等預覽文件讀完才決定，避免「找不到」閃一下）。
  - 看板：隊徽、W-L、主客、「美東 11/4（三）20:30 · 台北隔日 09:30」、球館、休息天數（0＝背靠背）、本季第 N 次交手、特殊賽事。
  - 雙方對照：照文件 `fields` 的順序與方向，較好的一方標綠，前 5 名的名次標綠，節奏不分好壞。
  - 交手：`window.Matchup` 近三季，與對戰頁同規則與標籤；本季剩餘交手取自預覽賽程。
  - 近況：雙方近 5 場。
  - 狀態：開賽後顯示「比賽進行中」；有比分或開賽 3 小時後改顯示「比賽已結束」，並說明數據何時補上（15:00 看門狗或隔天 03:00）。
- **賽程條**：索引最後一場之後的第一場預覽場次加成虛框「下一場」卡；正在看更後面的預覽場次時，那場也放上來。上一場／下一場箭頭走同一串。賽別依 GameID（`004`＝季後賽）。
- **刊頭小月曆**：App 把未開打場次（`future: true`、`kickoff`）併進 `games`，呈虛框灰字，滑過看台北開賽時間。「最新一場」只算已打完的；月份範圍含未開打；標題「8／80 場」。有 `onFull` 時底部顯示「完整賽程 →」。
- **完整賽程 `SchedulePage.js`**（`#schedule[&m=YYYY-MM][&f=home|away]`，`urlState` 的 `schedView`／`schedHref`，App 的 `sched` 狀態）：
  - 頁首：戰績、主客戰績、剩餘場數（後兩項只在桌面）、下一場。
  - 月份用 `UI.TabBar`，數字鍵可切；主客篩選用 `UI.Seg`。
  - 桌面（md 以上）月曆格：左緣色條標勝負，右上角 B2B、特殊賽事，今天加銀框。手機改清單，一場一列。
  - 點任何一場都進 `#game=日期`。
- **入口**只在有預覽文件時出現（App 的 `canSchedule`）：小月曆底部、單場頁返回列右側（只限當季場次）、搜尋「賽程」群組（完整賽程＋下一場）。
- 隊徽：`cdn.nba.com/logos/nba/{id}/primary/L/logo.svg`，失敗就隱藏、只留文字。**不用 `loading="lazy"`**：瀏覽器面板裡格子明明在畫面內卻一直沒載；桌面格與手機清單用同一組網址，快取共用。

**驗證**：
- 預覽頁數字與預覽文件、手算的休息天數與台北開賽時間一致。
- 已打完的場次、沒比賽的日期維持原樣。
- 模擬開賽後與已結束兩種狀態。
- 12 月主場篩選 5 場與賽程一致。
- 數字鍵、網址還原、返回、三個入口、歷史賽季不出現入口。
- 桌面 1280／手機 375 沒有溢出、換行或 10px 以下的字。

**限制**：
- 預覽文件每天 03:00 更新，30 隊數據與比賽狀態最多落後一天。
- 「進行中」是用開賽時間推算的，不即時。
- 歷史賽季沒有開賽時間與對手 ID，所以不做。
- **無頭 Chrome 用桌面 UA 時抓不到 NBA CDN 的隊徽**（手機 UA 可以），截圖驗證看到隊徽空白不代表壞了，用瀏覽器面板確認。

### 2026-11-12 組合數據、全域期間篩選、球員比較

起因：使用者想做「球員與球員比較」，並請 Claude 比對 NBA API 抓得到、但本站還沒有的資料。討論後選定三件事、分六個 Phase 做（計畫 `_mockup/plan-lineups-compare-period.md`；版型預覽 `_mockup/lineups.html`、`home.html`、`compare.html`，皆不進版控）。

**決定（使用者）**：
- 組合只做二人／三人／五人（不加四人）；最少分鐘預設二人／三人 50、五人 10；二人保留「矩陣」檢視。
- 組合資料另存一份「當季最新」文件，每天覆寫、不留逐日歷史（時光機管不到組合頁）。
- 期間篩選做成全域：**桌機膠囊在章節列右側、手機在身分列**（同一控制只放一處的例外：每種裝置仍只有一處）；平常只是一顆膠囊，點了才展開面板。
- 跟不上期間的區塊：變淡＋標「整季數據 · 篩選時停用」＋完全不能點；Playtype、跨季章節仍可進入，最上方說明為整季數據。
- 比較頁只比兩人，可各選賽季；「差距最大」沿用對戰頁算法。
- 不做（之後另案）：跨隊球員比較、四人組合、Playtype 單場還原（護框、進階、得分來源、球員聯盟名次另案完成，見「2026-11-12 護框與兩分／三分防守」「2026-11-12 個人效率、得分組成與抓取對帳」「2026-11-13 球員聯盟名次」）。

**組合後端（Phase 1，`98bac2a`）**
- `nba_common`：`fetch_lineup_rows(season, type, group_quantity)` 抓某種人數的全部組合（抓取失敗回 `None`、沒有組合回 `[]`，前者不覆寫）；`top_lineups()` 取五人前 10 組給每日快照（快照 `lineups` 形狀不變，總覽不受影響）；`LINEUP_GROUPS`＝(2, 3, 5)、`LINEUP_DOC_FIELDS`（短欄名）、`LINEUP_DOC_MAX_BYTES`（900 KB，超過從分鐘最少的列開始砍、記 `trimmed`）。
- **完整性檢查 `lineups_consistent()`**（0 request）：每分鐘場上 5 人，二人／三人組合分鐘加總應是比賽分鐘的 10 倍、五人是 1 倍；任一種折合後少於最大值 3%（`LINEUP_MIN_TOLERANCE`）就視為被截斷、不寫。實測 2026-11-12：二人 5,329、三人 5,331、五人 527（各列 MIN 四捨五入，五人約少 1%）。
- `write_lineups()`（`fetch_data.py` 與 `backfill_history.py` 共用）：任一人數沒抓到、全空（開季前）或檢查沒過 → 不覆寫，印 `⚠️`；內容與現有文件相同 → `⏭️` 略過。
- 每日：五人那次 request 與快照共用，**每天只多 2 個**（73 → 75）。歷史：`backfill_history.py --season X --type Y --only-lineups`（每份 3 requests），2022-23～2025-26 例行賽＋季後賽 8 份已回補（最大 182 KB）。
- **更正**：`leaguedashlineups` 帶灰狼 `TeamID` 只回灰狼的組合（舊註解寫「無效、回全聯盟」已過時）；程式端過濾保留當保險。

**組合頁（Phase 2，`eb47184`）**：`LineupsPage.js`（`#lineups[&n=2|3|5][&p=ID-名字~…][&min=][&view=mx][&s=][&t=]`）
- 人數分頁（`UI.TabBar`＋數字鍵）、含球員 chips（最多選 N 人）、最少分鐘 `UI.Seg`、二人「表格｜矩陣」；摘要四格（符合條件／上場最久／淨效率最高／最低）；表格 `UI.DataTable` 加 `stackFirst`、`limit`（新參數：先排序全部、只顯示前 15 組＋「顯示全部」）；矩陣第一欄 sticky、`UI.scrollHint`。
- 資料：`gamesData.loadLineups(season, type)`，歷史賽季 localStorage `wt_lu_v1_{season}_{type}`（7 天），當季不快取。
- **網址不可用 `v=`**（主畫面靠它判斷「完全以網址為準」，獨立整頁靠沒有 `v` 辨識）→ 矩陣檢視用 `view=mx`。
- 入口：刊頭「組合」（手機在第二列）、搜尋「組合數據」、總覽五人陣容右上「看全部組合 →」（帶主畫面的賽季與賽別）。

**全域期間篩選（Phase 3，`8637cef`；Phase 4，`e4f57c9`）**
- `periodFilter.js`（`window.Period`）：狀態 `{ kind, month, opp, series, start, end, conds }`；`apply(games, st, ctx)`（原本寫在 SplitsTab 的判斷原樣搬出；條件交給 `SplitCond.evaluate`）、`serialize`／`parse`（網址 `pd=W`、`last5`、`month:2026-11`、`opp:DEN`、`series:1`、`range:起:訖`；條件沿用 `c=`，兩者並存時 `c=` 優先）、`needs()`（條件要讀哪些逐場）、`record()`。
- `PeriodControl.js`：`PeriodPill`（膠囊；桌機版另有勝敗小字與 ✕）、`PeriodPanel`（期間 chips、每月／對手／系列賽、自訂區間、條件編輯器——自 SplitsTab 搬來、規則不變；選完簡單期間自動收起，Esc 收）、`PeriodStrip`（手機篩選中提示列）。面板與提示列掛在章節列的 `UI.TabBar below`（新參數），跟著吸頂。
- App：`period` 狀態（網址 `pd=`／`c=` 主畫面各章節都有效；**不存 localStorage**；換賽季或賽別回到全季）；條件需要的全隊逐場（球員視角）與條件球員逐場由 App 載入；`periodCtx` 傳給各章節；`TABS` 的 `period: true` 標出跟得上的章節（章節列加綠點，其他變淡但可點，並顯示「本章節為整季數據」提示）。
- 各章節：
  - 總覽：季平均改「期間平均」（箭頭＝vs 全季、篩選時不顯示名次）、近期異動改「期間 vs 全季」（`Highlights` 的 `subset`）；拿掉原本的「平均期間」切換。全隊效率、Playtype 強弱項、雷達、在場／不在場、Clutch、五人陣容停用。
  - Splits：拿掉自己的期間列，吃全域期間；條件戰績摘要仍在 Splits。
  - 投籃：拿掉自己的期間列，逐球依期間的比賽日期篩（對手、條件也能篩）；受助攻停用。
  - 防守：`GAME_DEFENSE_IDS`（最近防守者、拼勁、掩護與卡位）改用逐場加總、箭頭＝vs 全季；防守 Box、對手分區命中、熱圖、全隊最近防守者（逐場沒有）停用。
  - Playtype、跨季：整章停用說明（仍可進入）。
- `UI.Locked`（`ui.js`）：篩選時變淡、去飽和、標「整季數據 · 篩選時停用」，並設 `inert`（React 18 不認得，用 ref 設在 DOM 上）；**新增區塊時：資料來自逐場 bundle／逐球 → 吃期間；來自整季快照 → 包 `UI.Locked`，不可默默顯示沒篩選的數字**。
- 引用：`CiteCtx.period`（例「勝場（8 場）」）；`UI.citeLine` 與 `Quote.make` 對 `asOf: 'agg'` 的數字附上期間（說明已寫到期間就不重複；快照數字不加）。

**球員比較（Phase 5，`23b5fe8`）**：`compareData.js`（`window.Compare`）＋`ComparePage.js`（`#cmp=ID-名字~ID-名字[&sa=][&sb=][&t=][&per=36][&pd=][&m=]`）
- 指標取既有 defs（基本＋上場時間、投籃分區、Tracking、有逐場的防守群組）；數值一律逐場加總（只算灰狼場次）；每 36 分鐘只換算次數類（`isRate` 判斷，比率不變）。
- 差距最大五項：差距 ÷ 兩人逐場標準差的合併值，每人每項至少 3 場；`neutral` 指標不列；**只寫「XX 較高」、顏色代表球員**（實測前幾名常是急停出手數、傳球次數這類次數指標，多不等於好）。
- 期間只開放近 5／近 10、勝敗、主客（兩人可能不同季，對手與條件不適用）。走勢：同季以日期對齊、不同季以「出賽第 N 場」對齊（`LineOverlay`）。
- 兩人同場：讀組合文件的二人組合＋快照 On/Off（同季才有）；Playtype 讀快照（整季合併，季中轉隊者含他隊）。快照沿用 App 的 `loadComparisonSeason`（當季讀最新每日快照、歷史讀期末快照）。
- 球員名單來自該季組合文件（所以 2022-23 起、例行與季後都能比）；只帶一位時另一位自動挑總上場分鐘最接近的隊友。
- 入口：球員身分列「比較」（帶入目前球員）、搜尋「球員比較」。

**同時修正（併入 `8637cef`）**
- 條件「未出賽」：當季仍在名冊上的球員算到最新一場（見「2026-11-04 條件戰績」）。
- 刊頭控制列單列不換行改到 `xl`（1280）：控制項約 800px＋字標約 290px，1024～1150 單列放不下、橫捲又沒有捲軸，「複製連結」「搜尋」看不到；1024 以前加「組合」後更嚴重。現在 lg～xl 之間在右側換成兩行、靠右對齊。

**驗證**
- 組合：只讀測試 33 項（筆數、ids 與名字對齊、完整性檢查擋得住截斷、快照前 10 組與 11/11 完全相同、砍列邏輯）；9 份文件讀回核對。
- 期間：改動前用舊程式記下 12 個情境（Splits 全隊／McDaniels × 全季、勝場、近 5、對 CLE、三組條件，與總覽全季、近 5）的所有數字，Phase 3、Phase 4 改完逐一比對完全相同。
- 投籃勝場 716 出手、0–4 呎 59.7% 與逐球手算一致；防守期間數字與 Splits 防守組同期間一致；停用區塊用 `elementFromPoint`／`focus()` 確認點不到、Tab 不進去。
- 比較頁 McDaniels vs Kuminga 與預覽圖一致（得分 17.0 : 12.3、同場 284 分鐘 +13.9）；每 36 分鐘手算核對。
- 桌面與手機 375 px 都無橫向溢出。截圖在這台機器常顯示異常（只截到局部放大），版面以量測為準。

**限制與之後可做**
- 組合頁沒有時光機與逐日走勢；歷史賽季的「截至」寫「季末」。
- 球員在場效率（2026-27 起有逐場回合數）目前跟著 On/Off 整塊停用，沒有拆成跟期間。
- Playtype 單場還原仍沒做：本季 11 場只有 5 場拆得出來（背靠背兩場之間沒有快照、開季頭兩場 Synergy 未釋出），要做得先在背靠背之間補抓 Synergy。
- 比較頁逐項對照仍沿用全站好壞上色（次數類標綠），要改得在 defs 加 `neutral: true`，所有頁面一起變。

### 2026-11-12 護框與兩分／三分防守

起因：比對「NBA API 抓得到、本站還沒有」的資料時列出了「護框」，使用者接著問有沒有護三分、護兩分。Defense Dashboard（`leaguedashptdefend`／`leaguedashptteamdefend`）的 `DefenseCategory` 有六類：Overall、3 Pointers、2 Pointers、Less Than 6Ft、Less Than 10Ft、Greater Than 15Ft，每類都有防守出手、對手命中率、對手平常命中率、vs 平常。計畫 `_mockup/plan-rim-protection.md`、版型 `_mockup/rim-protection.html`（皆不進版控）。

**決定（使用者）**
- 用 Defense Dashboard（有 vs 平常），不用 Player Tracking 的 `DEF_RIM_*`（只有命中率）。
- 加 2 Pointers、Less Than 6Ft；三分補顯示 vs 平常（資料早就有）；不加 < 10 Ft、> 15 Ft（和護框、三分大半重疊）。
- 球員＋全隊（全隊算名次）；單場只有灰狼球員（沒有全隊單場版，和原本一樣）。歷史賽季只補快照、不補逐場。
- 最近防守者 3 × 3（手機也 3 欄），護框獨立一組放在正下方；小樣本門檻交給 Claude 定（見下）。
- 「平常」會漂移（見限制）：只在說明寫清楚，不另外重抓。

**後端（`5e600d0`、`83e7f27`）**
- `nba_common` 新增兩張欄位表和一張類別表：
  - `MATCHUP_2PT_FIELDS`：`D_FG2M／D_FG2A／D_FG2_PCT／NORMAL_FG2_PCT／D_FG2_PLUSMINUS`
  - `MATCHUP_RIM_FIELDS`：`D_RIM_FGM／D_RIM_FGA／D_RIM_PCT／NORMAL_RIM_PCT／D_RIM_PLUSMINUS`
  - 類別表 `MATCHUP_CATEGORIES`：每列是 `(DefenseCategory, 欄位表, 標籤)`，球員、全隊、單場共用，**加類別只要加一列**。
- 兩分的出手數和命中率可以由「總體減三分」算出，但「平常兩分命中率」推不準（實測最多差 21 個百分點），所以要真的抓。每場平均是除以 `GP`（不是 `G`）。
- 單場擷取：
  - 灰狼球員抓 4 類；對手球員只抓 `MATCHUP_OPP_CATEGORIES`（Overall＋3PT），所以每場從 26 → 28 requests。
  - `fetch_matchup_defense(failed=list)` 會記下抓失敗的類別，單場據此標 `partial`。以前某一類失敗會被默默略過，那場就永遠少那幾欄。
- 某類沒有出手的球員，不會出現在那一類的回應裡 → 該類欄位就不存在（不補 0）；前端當作沒有樣本。
- 名次方向：`D_FG2_PCT`／`D_FG2_PLUSMINUS`／`D_RIM_PCT`／`D_RIM_PLUSMINUS` 越低越好；出手、命中次數與 `NORMAL_*` 不排名。
- 回補：
  - `backfill_history.py --only-matchup [--matchup-cats 2PT,Rim]`：球員＋全隊，每類 2 requests，只動 `defense` 裡的這些欄位。2022-23～2025-26 例行賽＋季後賽 8 份已補。
  - `backfill_games.py --matchup-only [--matchup-cats …]`：已存在的單場只補灰狼球員，用 `playerId` 對應；某類抓失敗就整場不寫。2026-27 例行賽 11 場已補，bundle 已重建。
  - 本季 2026-11-11 的每日快照手動補過（4 requests），之後每日抓取會自己帶。

**前端（`b2cab09`）**
- `constants.js`：
  - `MatchupDefense` 改成 9 格（`cols: 3`）。`att` 是那格的出手欄位，`signed` 讓正值帶 +；格子用短標籤，完整名稱放 `longLabel`。
  - 新群組 `RimProtection`，加進 `GAME_DEFENSE_IDS`。
  - `DEF_SHOT_RULES = { seasonMin: 20, gameMin: 3 }`。
  - `DEF_NEW_KEYS`：對戰頁不列這些新格子，維持原本的 4 格。
- `GameAgg`：
  - 新增 `NORMAL_DEFS`：vs 平常＝100×Σ命中／Σ出手 − Σ(平常命中率×出手)／Σ出手。只用三欄都有、出手 > 0 的場次；舊資料沒有平常命中率時才退回逐場平均。
  - `PCT_PLUSMINUS`／`D_FG3_PLUSMINUS` 原本是逐場直接平均，**期間數字因此會小幅改變**。
  - `RATIO_DEFS` 加 `D_FG2_PCT`、`D_RIM_PCT`。
  - `metricOf`／`trendSeries` 遇到 vs 平常出手 < `gameMin` 時回 `null`；逐場走勢、比較頁的逐場波動、對戰頁的逐場值都適用。
- `UI.StatCell` 加三個參數：`sample`（數值下方顯示「樣本小 · N 次」）、`signed`、`fullLabel`（格子用短標籤時，引用與複製用完整名稱）。
- `TrackingCardRow` 加 `cols`、`gp`：整季用 base 的 `GP`、期間用 GameAgg 的 `GP`；次數＝場均出手 × gp。
- 單場頁展開列：vs 平常出手 < 3 時顯示「—」，不判好壞、也不給引用。標籤改用 `metricLabel`（完整名稱）。
- Splits 的 CSV 與指標選單、條件選單、條件描述也都改用 `metricLabel`。
- 防守章節全隊順序：防守 Box → 最近防守者 → 護框 → 對手分區 → 拼勁 → 掩護與卡位。
- 其他：跨季的「跨隊不適用」標記涵蓋護框；`glossary` 補 7 個新 key；單場快取 `wt_gc_v5_` → `v6`。

**驗證**
- 實打 API：
  - Gobert 整季籃下 4.3／48.8％／−14.0、兩分 −12.2。
  - 全隊籃下名次第 18、兩分 vs 平常第 4。
  - 11/08 單場剛好 28 requests，對手球員沒有新欄位，也沒有誤標 partial。
  - 模擬某類抓失敗，確認會被記錄。
- 讀回 Firestore：
  - 8 份歷史快照：原本的其他欄位都還在；缺新欄位的球員，本來就沒有總體資料。
  - 3 場單場文件抽查正確。
  - Gobert bundle 10 場加總：籃下 43 投 21 中＝48.8%，等於 NBA 整季值。
- 期間加權：用逐場加權反推全季，總體 −9.4、兩分 −12.2、籃下 −14.0 都等於 NBA 整季值。
- 介面（桌面 1280／手機 375）：
  - 12 格都沒有溢出，標籤和英文小標都在同一行。
  - A. Edwards 顯示「樣本小 · 8 次／16 次」。
  - McDaniels 11/08 三分 0/2 → vs 平常「—」，Splits 走勢也不畫那一點。
  - 比較頁、對戰頁、Splits 的主控台都沒有錯誤。

**限制**
- **「平常命中率」會漂移**：NBA 單場查詢回傳的「平常」，是射手在**擷取當下**的本季命中率，不是比賽當時的。
  - 每日排程賽後隔天就抓，所以開季頭幾場的「平常」樣本很小（10/21 那場三分的「平常」只有 15%）。
  - 實例：Gobert 三分 vs 平常用逐場加權反推是 −2.6，NBA 整季是 −3.9。兩分和護框是 11/12 才回補的，全部用當天的命中率，所以剛好對得上；之後的新場次也會開始漂移。
  - **只影響期間篩選、Splits、比較頁裡的 vs 平常**；整季數字讀 NBA 快照，不受影響。「?」說明已寫明。
  - 要修可以每週重抓本季逐場的最近防守者（約 4 × 場數個 requests），使用者先選擇不做。
- 2026-11-11 以前的每日快照沒有新欄位：時光機選到更早的日期，這幾格會顯示「—」。
- 歷史賽季沒有兩分／護框的逐場資料：歷史賽季開期間篩選時，護框群組會被停用，兩分格也沒有值。
- 2024-25 的 Jesse Edwards（2 場、被投 2 球）不在 NBA 的兩分和籃下回應裡，快照少這幾欄。

### 2026-11-12 個人效率、得分組成與抓取對帳

起因：比對「NBA API 抓得到、本站還沒有」時列出「進階」與「得分來源」。使用者另外要求在驗證和寫規格文件之間，多一步「抓取與前端露出對帳」。計畫 `_mockup/plan-advanced-scoring.md`、版型 `_mockup/advanced-scoring.html`、對帳報告 `_mockup/audit-fields.md`（皆不進版控）。

**決定（使用者）**
- 進階：USG%、TS%、eFG%、AST%、AST/TO、TOV%、OREB%、DREB%、REB%、PIE。不抓在場效率（就是 On/Off 的在場欄位）、節奏、`E_` 估計值。
- 得分來源：Scoring（占比）和 Misc（次數）都抓，每日更新；球員和全隊都做，全隊算名次。
- TS%／eFG% 由逐場資料算，跟著期間；其他進階數字和得分組成只用整季快照，篩選時停用。
- 版面：
  - 球員總覽：季平均加 TS%／eFG%，下方新增「個人效率」（全隊不加，已有「全隊效率」）。
  - 投籃章節：「距離區間命中率」和「受助攻比例」之間新增「得分組成」。
- 歷史賽季只補快照；順帶補全隊進階（歷史期末快照原本沒有）。
- 對帳後：停抓投籃拆分；補露出三分出手占比、接球跳投得分、急停跳投得分、切入助攻率、對手二波得分；重抓開季頭 4 場。

**後端（`eed53e3`、`820acba`、`5237511`）**
- `nba_common` 新增：
  - 欄位表：
    - `PLAYER_ADVANCED_FIELDS`：比例欄 ×100，**`TM_TOV_PCT` 例外，API 已是百分比**。
    - `SCORING_FIELDS`：`PCT_PTS_PAINT／2PT_MR／3PT／FT`＝100%，另有 `PCT_PTS_FB`、`PCT_PTS_OFF_TOV`。
    - `MISC_FIELDS`：`PTS_PAINT／PTS_FB／PTS_2ND_CHANCE／PTS_OFF_TOV／PFD`。**全隊版沒有 `PFD`**，只寫 API 有的欄位。
  - 函式：
    - `fetch_player_advanced`：1 request。
    - `fetch_scoring`：Scoring＋Misc，2 requests；任一支失敗就整份回空。
- 每日快照：球員多 `advanced`、`scoring`；全隊多 `scoring`，名次在 `ranks.scoring`；`DATA_KEYS` 加 `scoring`。
- 歷史：
  - `backfill_history.py --only-adv-scoring`，每份 6 requests（球員進階、球員／全隊得分組成、全隊進階）。
  - 完整回補路徑也一起抓；`PLAYER_CATEGORY_KEYS` 加 `advanced`、`scoring`。
  - 2022-23～2025-26 例行賽＋季後賽 8 份已補；2026-11-11 的每日快照手動補過。
- **停抓投籃拆分**（`fetch_pt_shots`，每日 −2）：欄位全可由逐場 base 算出，前端也沒讀快照值；`fetch_data.py` 和 `backfill_history.py` 的完整回補都不再呼叫，函式留著備用。2026-11-13 起的快照 `shooting` 不再有 `FG2A_FREQ` 等欄位。
- 每日 request +5 −2。2026-11-13 實測：stats.nba.com 83 支（Synergy 40、Tracking 12、其他 31，含名冊與賽程）＋CDN 賽程檔 1，共 **84**（原本估 82，是沿用的舊基準少算 2 支）。

**前端（`f8984c6`、`5237511`、`ed5dbce`）**
- `constants.js`：
  - 新增 defs：`playerAdvancedDefs`、`scoringShareDefs`（長條 4 段與顏色，不用紅）、`scoringSituationDefs`（`shareKey` 補「占總得分 X%」，`PFD` 標 `playerOnly`）。
  - `SPLITS_BASE_DEF` 加 TS%、eFG%、三分出手占比。
  - Tracking 加 `CATCH_SHOOT_PTS`、`PULL_UP_PTS`、`DRIVE_AST_PCT`；防守 Box 加 `OPP_PTS_2ND`。
  - **`HISTORY_CACHE_VER` 5 → 6**。
- `GameAgg` 新增或擴充四種重算：
  - `TS_DEFS`：TS%＝ΣPTS ÷ (2×(ΣFGA＋0.44×ΣFTA))。
  - `EFG_DEFS.EFG_PCT`。
  - `RATIO_DEFS.FG3A_FREQ`：FG3A ÷ FGA。
  - `WAVG_DEFS`：依權重欄加權平均。切入助攻率沒存切入助攻數，所以用切入次數加權。
- 總覽：
  - 球員季平均多 TS%／eFG%。
  - 「個人效率」區塊：篩選時包 `UI.Locked`；時光機選到沒有欄位的舊日期，整區不顯示。
- 投籃：`ScoringMix`（長條＋圖例＋情境得分＋「整組加入」，引用籃寫成一行「得分組成：禁區 X%、中距離 X%、三分 X%、罰球 X%」）；全隊帶 `leagueRank('scoring', …)`。
- 跨季：
  - 新類別「效率」（球員是個人進階＋TS／eFG；全隊是全隊進階）、「得分組成」。
  - 類別列 8 顆，手機改成可橫捲＋`UI.scrollHint`（原本會撐寬頁面）。
- `UI.StatCell` 加 `sub`（數值下方的灰色補充文字）。
- `glossary` 補約 20 個新指標；助攻率、失誤率的說明改成全隊與球員通用。
- 單場快取 `wt_gc_v6_` → `v7`、`SingleGamePanel` 的 `wt_game_v3_` → `v4`（重抓 4 場後）。

**抓取對帳（Phase 5，0 NBA request）**
- 做法：讀實際 Firestore 文件（每日／歷史快照、單場、bundle、組合、預覽、投籃）列出欄位，掃 `components/*.js` 的欄位名交叉比對，再逐項查程式。結論見 `_mockup/audit-fields.md`。
- **整支 request 沒用到**：只有投籃拆分（已停抓）。
- **露出了、資料不全**：沒有找到會把缺值顯示成 0 的地方。
- **保留不動**：`*_OPP_FGA`、`ON_PACE`／`OFF_PACE`、`PCT_UAST_*`、Synergy 的 `fgaTotal` 等（之後做 Playtype 單場還原會用到）、中繼資料。
- **重複抓取（另案）**：每場 base（2 支）和 box score 傳統數據重疊；改由 box 組 bundle 可以每場省 2 支，但要處理分鐘格式不同、2025-26 以前沒有 box 的場次。受助攻比例每週抓、每日得分組成又打同一個回應，每週只省 2 支，保留現狀。
- **發現既有問題：逐場 Tracking 可能少抓**。開季頭 4 場（10/21～10/26）的單場 Tracking 是賽後 12 小時內抓的，NBA 之後補正了數字（全隊切入 30／39／23／34 → 62／78／75／73；Edwards 10/26 切入 12 → 22）。單場文件已經定稿，不會再重抓，而 `tracking_zero_filled` 只抓得到「整組 0」。
  - 已用 `backfill_games.py --dates 2026-10-21,2026-10-23,2026-10-25,2026-10-26` 重抓（114 requests），並重建 bundle 與單場題材；逐場加總的切入次數現在和快照一致（70.7）。
  - 怎麼發現與檢查，見 FAQ「逐場加總和整季快照對不上」。

**驗證**
- 實打 API：
  - Edwards USG 36.6／TS 59.0／PIE 18.1／TOV% 9.9。
  - Gobert 禁區占比 71.8、罰球 28.2、造成犯規 4.5。
  - 全隊禁區得分第 4、罰球占比第 27；全隊沒有 `PFD`。
  - Edwards 四段占比加總 100.0。
- 前端：
  - McDaniels 總覽 TS 58.7、近 5 場 53.1（−5.6，和手算一致）；三分出手占比 32.7%（和 NBA 一致）。
  - 全隊對手二波得分 14.1、第 8；切入助攻率依切入次數加權後和手算一致。
  - 時光機 11/08 不顯示個人效率；歷史賽季 2024-25 季後賽總覽出現全隊效率。
  - 跨季兩個新類別有值；「整組加入」的引用格式正確。
  - 長條四色上的深色字對比度都 ≥ 5.0。
  - 桌面 1280／手機 375 都沒有溢出，主控台沒有錯誤。

**限制**
- 個人效率、得分組成只有整季快照，期間篩選時停用；2026-11-11 以前的每日快照沒有這些欄位。
- 整季快照的「樣本小 · N 次」，次數是「場均 × base 出賽場數」。但 NBA 最近防守者的場均，分母只算有防守到出手的場次（Cody Williams 出賽 6 場，NBA 只算 2 場），所以少數輪替末段的球員次數會多算；「樣本小」照樣會標，期間篩選時用逐場加總，次數是準的。**2026-11-13 起另存 `D_GP` 修正**，只有更早的快照才會多算（見「2026-11-13 資料品質小修」）。
- 單場 Tracking 少抓：2026-11-13 起看門狗每天 15:00 自動比對全隊逐場加總與快照，有落差才通知（見「2026-11-13 資料品質小修」）。

### 2026-11-13 資料品質小修（逐場對帳、最近防守者出賽場數）

起因：2026-11-12 對帳時人工發現兩件事——開季頭 4 場的單場 Tracking 少抓（切入次數只有一半），以及整季快照的「樣本小 · N 次」在少數球員身上多算。計畫 `_mockup/plan-data-quality.md`（不進版控）。

**決定（使用者）**
- 比對放在**每天 15:00 的看門狗**最後一步，0 NBA request；早上 09:00 那次不跑。
- **只比全隊**（球員有季中轉隊、場數定義不同等雜訊）；比「次數類」欄位。
- 發現異常**只通知**，不自動重抓（很少見，而且每場重抓約 28 requests，由使用者決定）。
- 樣本次數另外存 `D_GP`；舊快照、歷史快照不重跑回補。

**最近防守者出賽場數 `D_GP`（`48980ac`）**
- NBA 最近防守者的「場均」，分母只算**有防守到出手的場次**，可能比 base 出賽場數少（2026-11-12：Bones Hyland 10／11、Cody Williams 2／6、Isaiah Evans 2／5、Jaylen Clark 9／10）。4 類的 GP 都相同，所以只從 Overall 存一欄。
- `MATCHUP_OVERALL_FIELDS` 加 `("D_GP", "GP", False)`，`RANK_SKIP` 加 `D_GP`。單場文件的值恆為 1，無用但無害。
- 前端防守章節整季快照的 `TrackingCardRow gp` 改成 `currentDefense.D_GP || currentBase.GP`。Cody Williams 籃下「樣本小」6 → 2 次；Jaylen Clark 15 次，和逐場加總一致。
- 2026-11-12 的每日快照手動補過（2 requests）；之後每日抓取自帶。

**逐場對帳（`9ddf782`）**
- `nba_common`：
  - `CONSISTENCY_RULES = {rel: 0.03, abs: 3, suspect_ratio: 0.7, min_games: 5}`
  - `CONSISTENCY_SKIP`（平均型欄位、GP／W／L／MIN、`D_GP`）
  - `CONSISTENCY_LABELS`（通知用中文名）
  - `consistency_fields()`：從 `BASE_FIELDS`、`TRACKING_FIELDS`、`HUSTLE_FIELDS`、`MATCHUP_CATEGORIES` 自動挑非百分比欄位，目前 67 欄，加欄位會自動納入。
  - `consistency_issues(team_snapshot, bundle_games)`：純函式。
- 比法：
  1. 快照 `base.GP`＝N，取 bundle 依日期排序的前 N 場（昨晚剛抓、快照還沒算進去的暫定版不比）。
  2. 每欄比「逐場加總」和「快照場均 × N」，落差 ≥ 3% **且**總數差 ≥ 3 才算異常。
     **2026-11-18 起只有「逐場比快照少」（少抓）才通知**；逐場比快照多的只在 log 記一行「逐場比快照多（不通知）」。原因：11/15、11/16 卡位逐場比快照多 3 次（+3.6%～+4.8%，卡位一場只有 4～6 次，差 3 次就過門檻）連續誤報兩天，那是 NBA 整季與單場兜不攏，不是少抓、也沒得處理。
  3. 異常欄位裡低於本季中位數 70% 的場次，列為可疑日期。
  4. 逐場沒有的欄位（全隊最近防守者、防守 box 等只有快照）自動略過。
- `watchdog.py`：
  - 原流程拆成 `watch()`；一般模式用 `try/finally`，所以提早結束或補抓失敗也照樣跑 `check_data()`。對帳出錯只記 log，不影響補抓。
  - 有異常：log 寫每欄的逐場加總、快照推算、落差、可疑日期，加一行可直接複製的重抓指令；桌面通知「Wolves Tracker：逐場資料可能少抓」。
  - 沒異常：log 一行「逐場對帳正常（快照 X，比了 N 欄 × M 場）」，不通知。
  - 新增 `--check-data`（只跑對帳，可加 `--dry-run` 不通知）。`--test-notify` 移到 `main()` 最前面。

**驗證**
- 真實資料：正常，58 欄 × 11 場；另 9 欄沒有逐場值，自動略過。
- 重現舊問題：在記憶體副本把 10/21～10/26 的全隊切入換回修正前的 30／39／23／34，報出切入 **−20.8%**，可疑日期正好是那 4 天，重抓指令正確。
- 邊界情況：
  - 少於 5 場不比。
  - 逐場比快照多一場不誤報。
  - 逐場比快照少一場，註明「bundle 還沒更新？」。
- 模式：一般 `--dry-run` 補抓判斷照常、最後跑對帳；`--morning --dry-run` 不跑對帳。
- **正式上線第一次是 2026-11-13 15:00**（同時補抓 11/12 vs DAL，逐場 12 場、快照 11 場）。

**限制**
- 只比全隊：如果只有某位球員的單場數字少抓、全隊加總沒有超過門檻，抓不到。
- 只抓得到「已定稿後又被 NBA 補正」的落差；整季快照本身如果錯了，這裡比不出來。
- 11/12 以前的每日快照與歷史快照沒有 `D_GP`，「樣本小」次數照舊用 base 出賽場數，少數球員會多算。

### 2026-11-13 球員聯盟名次

起因：使用者的貼文固定寫「（聯盟第 N）」，原本只有全隊有名次（30 隊）。這次讓灰狼球員在全聯盟合格球員中排名，寫法和全隊一致。計畫 `_mockup/plan-player-ranks.md`、版型 `_mockup/player-ranks.html`（皆不進版控）。

**決定（使用者）**
- 排名對象：出賽 ≥ 所屬球隊場數 70%（各隊自己的場數）且每場 ≥ 15 分鐘（2026-11-13 實算：合格 247 人，灰狼 8 人）。
- 沒達門檻的球員（例如 Edwards 4／12 場）：格子不顯示名次；「?」小卡寫原因＋「若列入約第 N（僅供參考）」，不進引用。
- 命中率類的出手門檻用**場均出手**（不用 NBA 官方的命中數，官方門檻會把 Gobert 的投籃命中率排除）：
  - 投籃、真實命中率、有效命中率 ≥ 5 次；三分 ≥ 3 次；罰球 ≥ 2 次。
  - 用全聯盟資料校準：投籃 5 留 87%、三分 3 留 70%、罰球 2 留 55%；前幾名不再是出手很少的人，人數也和 NBA 官方門檻接近。
  - 其他有對應出手欄的比率（最近防守者、護框、切入、接球跳投、分區等）：出手要達合格名單的 **P25**。原本提案是中位數，太嚴，後衛的對手命中率幾乎都沒有名次。
- 要排的類別：基本、Tracking、投籃分區、防守、個人效率、得分組成。不排 Clutch（樣本太小）、On/Off。方向沿用全隊的 `RANK_LOWER_BETTER`／`RANK_SKIP`。
- 顯示：
  - 格子下方「聯盟第 N」，人數與門檻寫在「?」小卡。
  - **前 30 名用主色綠**（只有球員）。失誤、犯規照樣排名但不上綠：越少越好，排名主要反映球權多寡，例如 Ball 失誤第 244。
- 只有當季、每天更新；時光機跟著那天的快照；歷史賽季沒有。

**後端（`5a1e283`）**
- `nba_common`：
  - `PLAYER_RANK_RULES`：`gp_ratio`、`min_mpg`、`att_fixed`、`att_quantile`、`top`、`no_highlight`。
  - `PLAYER_RANK_ATT_PAIRS`：25 個比率欄 → 出手欄。
  - `PLAYER_RANK_CATS`。
  - `player_league_ranks()`：純函式，0 request；同分取最小名次。
  - `fetch_base_box(team_of=)`：另外記錄 `{PlayerID: TEAM_ID}`，不寫進文件。
- `fetch_data.py`：
  - 最近防守者（4 支）與防守 Box（1 支）改抓全聯盟（`team_id=0`），支數不變、回傳變大。
  - 全聯盟原始資料算完名次才用名冊過濾，快照的其他內容不變。
  - 名次算失敗只印 ⚠️，不影響其他資料寫入。
- 球員文件的 `ranks`，約 36 KB：
  ```
  {類別: {球員名: {欄位: 名次}},
   _n: {類別: {欄位: 參與人數}},                          # 各欄不同（命中率類有出手門檻）
   _meta: {球員名: {qualified, gp, teamGp, mpg}},
   _ref: {類別: {球員名: {欄位: 若列入名次}}},             # 只有未合格者
   _rules: {gp_ratio, min_mpg, att_fixed, att_pairs, att_thresholds（P25 實際值）, n_qualified, top, no_highlight}}
  ```
- 2026-11-12 的球員快照手動寫過名次（用驗證時抓的資料，0 額外 request）；之後每日抓取自帶。

**前端（`58da65d`）**
- `window.RankCtx`：
  - 全隊 `{kind: 'team', …}` 不變。
  - 球員 `{kind: 'player', name, ranks, vals（該員各類別快照值合併）, date, latest}`；只在當季每日快照有 `ranks._meta[球員]` 時設定。
- `window.leagueRank(cats, key)`：全隊與球員通用。球員另回 `top`（要不要上綠字）、`gate`（出手門檻文字）。
- `window.rankWhy(cats, key)`：沒有名次時的原因。未合格附「若列入約第 N」；單項出手未達門檻時寫實際場均出手與門檻。沒有名次、也不在排名範圍的欄位（例如 Clutch）回 `null`。
- `UI.StatCell`／`UI.Info` 加 `rankWhy`；名次 `top` 時用主色綠。小卡寫法：
  - 球員：「聯盟第 N（M 人）：出賽 ≥ 70% 球隊場數、每場 ≥ 15 分鐘［、出手門檻］的球員中排名」。
  - 全隊：維持「（30 隊）」。
- 接上名次的位置：
  - 身分列；總覽季平均（全季時，找 `base` 再找 `advanced`）與個人效率。
  - Splits 全季：`RANK_CATS.base` 加 `advanced`，讓真實／有效命中率也有名次。
  - 防守章節；投籃得分組成（標題寫「小字為聯盟名次（247 人）」）。

**驗證**
- 實算：
  - Gobert 籃板率第 6、進攻籃板率第 9、正負值第 10、阻攻第 28；投籃命中率第 39（出手 5.6 次有列入），三分沒有名次（0.3 次）。
  - Dosunmu 三分、罰球命中率都是第 10。
  - McDaniels 罰球 1.9 次，沒有名次。
  - Edwards 未合格，若列入得分約第 2。
- 前端：
  - 「?」小卡三種文字都正確（有名次、出手不夠、沒達出賽門檻）。
  - 全隊畫面不變；時光機 11/11、歷史賽季 2025-26 都不顯示球員名次，沒有出錯。
  - 手機 375 沒有溢出，「聯盟第 N」沒有折行。
  - 引用籃「※籃板率：18.7%（第6）」。

**限制**
- 名次以 NBA 整季合併數字排（季中轉隊含前東家），和逐場重算的「只算灰狼」季平均可能差一點小數。
- 季初門檻用場數比例，各隊場數不同、球員剛復出時，可能今天合格、明天又不合格。
- 球員 Playtype 仍只有百分位，不換算名次（球員百分位的母體人數不固定）。
- 待驗：2026-11-14 起每日抓取自帶 `ranks`，每日 request 數應維持 84。

### 2026-11-20 總覽期間篩選擴大與攻守切換移位

起因：使用者問總覽有哪些區塊能做期間篩選——套用期間時總覽有 7 塊停用。查證後，全隊效率、個人效率、在場／不在場的原始數字其實都在單場 box（進階欄位與單場 On/Off）裡，用既有資料就能重算；另外章節列的「進攻端｜防守端」在總覽只影響 Playtype、雷達、單場面板，容易被誤解成整頁切換。預覽 `_mockup/overview-period.html`（資料 `overview_period.json`）、計畫 `~/.claude/plans/stateful-orbiting-wadler.md`（皆不進版控）。

**查證結論（7 塊停用區塊）**
- 用既有資料能做（0 NBA request）：全隊效率、個人效率、在場／不在場。
- 部分能做：雷達（Tracking 軸能、Playtype 百分位軸不能，混在一張圖會誤導 → 維持停用）。
- 要新抓逐場資料：Clutch、五人陣容（`leaguedashlineups` 可帶日期，每場約 1 request＋回補本季）→ 下一批另案。
- 做不到：Playtype 強弱項（Synergy 只有整季、百分位要全聯盟）。
- 期間的聯盟名次：要有其他 29 隊同期間的資料。每日單場抓取其實拿到全聯盟當天數據但只存灰狼與對手、賽前預覽聯盟表每天覆寫 → 現有資料做不到；可行路線（固定期間每天預算，或每天存全聯盟當天數據）都要新抓，下一批另案。

**決定（使用者）**
- 總覽章節列拿掉攻守切換；Playtype 強弱項攻守並列；雷達與單場面板各自帶切換（只控制自己）。
- 全隊效率、個人效率、在場／不在場跟著期間；篩選時不排名（改「vs 全季」箭頭），近似值標「≈」、引用加註「逐場加權近似」。
- 引用期間寫法：「期間（N 場）」；日期區間「A 至 B」，只填開始日「A 起」；有結束日不寫「截至」。（使用者先確認了用日期篩選時引用也會帶出期間——原本就會帶，但有場數不見、「~訖」、與「截至」矛盾等寫法問題，一併修正）
- 往年賽季不回補單場進階數據（沿用 2026-10-29 的決定），缺的指標顯示「—」。
- 每個 Phase 測完回報、同意後才 commit＋push；Phase 3 原本提議另開 session，使用者選在原對話做。

**公式對帳（2026-11-19 整季快照）**
- 預覽階段先用 box 直接算，發現：全隊失誤率要用 TOV÷回合（一般公式差 2 個百分點）；全隊籃板率用「己方＋對方籃板」當分母差 5 個百分點，改用每場官方比率反推的籃板機會（差 0.4）；球員失誤率要含助攻（TOV÷(FGA＋0.44FTA＋AST＋TOV)，與快照完全一致）。
- PIE：用公式自算差很多；同一場各球員 `part÷PIE` 反推的分母都不同，無法還原 NBA 的算法 → 依全場分母加權的近似。
- 不在場：Edwards（只打開季 4 場）只算他出賽場次差 7 分；把他缺陣的場次算整場全隊後一致。Phase 1 再用只打 1 場的 Zikarsky、3 場的 Pullin 驗證，「從首場起算」仍差 3 分，**算進期間內所有全隊場次**才一致（計畫據此修改）。
- 重建 bundle 後只用 bundle 重算：全隊精確項最大差 0.05；球員失誤率、AST/TO、使用率、在場效率全體吻合；助攻率、籃板率、PIE 出賽 10 場以上大多差 1 以內（Hyland 助攻率 2.0、Clark PIE 2.8 為例外），出賽少的差到 2～4。

**做法**
- Phase 1（`fb742c3`）：`nba_common.box_team_adv`／`box_player_adv`，`build_bundles` 把結果放每場的 `adv`（不混進 `stats`）；重建 2026-27 例行賽 bundle（0 NBA request）。
- Phase 3（`d264fbf`）：`TABS` 的 overview 拿掉 `sided`；Playtype 強弱項 `ptSides` 攻守並列；`RadarPanel` 外層管攻守、`RadarBody` 以 `key` 重建（切攻守時重讀該面的軸偏好）；`SingleGamePanel` 自己的 `panelSide`；`UI.SIDE_OPTIONS` 共用。
- Phase 2（`bd0f15b`）：`GameAgg.teamAdvanced`／`playerAdvanced`／`onOff`（`ADV_KEYS_READ` 與後端成對）；`OverviewTab` 三塊篩選時改顯示期間值；`StatCell approx`；`Period.apply` 回傳 `cite`、`CiteCtx` 加 `periodLabel`／`periodEnd`、`citeLine`／`Quote.make` 統一補期間；身分列全季數字加 `periodless`（原本篩選時引用會被誤附期間，順手修）。

**驗證**
- 測試：後端＋契約 45、前端 58 全過（新增 `tests/py/test_bundle_adv.py`、契約 `test_bundle_adv_keys_same`、GameAgg 區間效率 4 條、期間引用 3 條）。
- 本機瀏覽器：全隊近 10 場、LaMelo 日期區間的數字與預覽一致；實按「複製引用」得 `…｜2026-11-01 至 2026-11-17（8 場）｜逐場加權近似｜進攻籃板率（OREB%） 34.8%｜…`，引用籃統計日 11-17；2025-26 篩選時效率類「—」並註明；手機 375 無溢出、console 無錯誤。

**限制**
- 近似值（≈）在出賽少的球員身上可能差 2～4，畫面只標「≈」不另標樣本。
- 缺陣多的球員，「近 10 場」的個人效率（依該員出賽）與在場／不在場（依全隊場次）範圍不同。
- 在場／不在場差值由四捨五入後的在場、離場值相減（與預覽的未四捨五入差值可能差 0.1）。

### 2026-11-21 單場 Playtype 與用詞改為回合數

起因：使用者問「能不能用 Playtype 每日快照算出每一場的整隊與個人 Playtype」。Synergy 不吃日期，但 2026-27 起每日快照存了整季整數總量（`possTotal` 等），賽前、賽後兩份相減就是單場。預覽 `_mockup/game-playtype.html`（資料 `game_playtype.json`／`game_playtype_data.js`）、計畫 `~/.claude/plans/buzzing-whistling-lynx.md`（皆不進版控）。

**查證（Firestore 本季 24 份快照，0 NBA request）**
- 全隊：16 場中第 5、8–16 場（10 場）GP 剛好 +1、拆得開；進攻端還原的得分與實際比分 6 場完全相同，其餘差 −3～+1（Synergy 標記與官方比分偶有落差）。防守端沒有 Cut／Misc，失分合計比實際少 2～26。
- 拆不開的原因：第 1–2 場開季 Synergy 還沒釋出；第 3–4、6–7 場是美東 10/26、10/31 每日快照沒寫成。**更正 2026-11-12 那節「背靠背兩場之間沒有快照」的說法**：台北 03:00 的排程一定在美東當晚開賽前，11/16、11/17 背靠背就拆得開；黏在一起的都是漏跑。
- NBA 會事後修正前幾場的標記：13 段 GP 沒變的區間有 2 段數字有變，出現過 −1 回合、−2 分的負差。
- 個人：球員 Synergy 只列整季累計 ≥ 10 回合的類型（所有球員列的最小值都正好是 10），類型第一次越過門檻那場含 0～9 的未知基底；每場能精確還原的回合 40～89%。球員防守端從沒出現 Transition／OffRebound／Postup，防守擋拆持球者加總是全隊的 198%（一回合可能記多位防守者）。
- 不可算：百分位／聯盟名次（全聯盟整季相對值）；失誤、罰球、造犯規、and-1、得分比例、eFG%（API 有比率欄但沒存；Synergy 沒有三分命中數）。

**決定（使用者）**
- 只做全隊；單場頁獨立第 5 個分頁「Playtype」（`tab=pt`），不併進「對比」。
- 拆不開的場次只寫「因資料來源欠缺而無資料」，不列兩場合計。
- 後端寫進單場文件 `wolves_team_games.playtype`，本季已打場次用回補指令補（不讓前端每次讀兩份完整快照）。
- 全站「球權」改成「回合數」，PPP 叫「每回合得分」（防守「每回合失分」），比較貼近貼文寫法；改畫面、名詞解釋、引用與文件，程式註解不動。
- 引用：一列＝成對「回合數／每回合得分」（賽前季均 → 本場）；逐列「?」在桌面，「＋ 整組加入」手機也有、只收回合數 ≥ 5；本場回合數 < 5 不上色。
- 預覽先用 `fetch` 讀 JSON，使用者直接開檔時被瀏覽器擋、畫面空白 → 預覽資料改用 `<script>` 載入。

**做法**
- Phase 1（`5fc3401`）：`nba_common.split_game_playtypes`（第 n 場＝第一份 gp ≥ n − 最後一份 gp == n-1，第 1 場以 0 為基底）、`write_game_playtypes`（冪等）；`fetch_data.capture_recent_games` 擷取後呼叫（單場重抓 `.set()` 會洗掉 `playtype`，同一輪補回）；`backfill_games.py --playtype-only [--dry-run]`；回補 2026-27 例行賽 16 場（10 可拆、6 `ok: false`）。
- Phase 2（`c72ce15`）：glossary（PPP／FREQ／POSS／PERCENTILE 與各類型定義）、Playtype 表格與卡片、跨季比較、比較頁、歷史彈窗、總覽強弱項、單場頁使用率定義改用回合數；「搶到球權後」這類改寫句子。
- Phase 3（`e22aca7`）：`GamePlaytype.js`（`GamePT.derive`／`rowQuote`／`GamePlaytypeSection`）；`GamePage` 單場文件有 `playtype` 才加分頁；`urlState` 接受 `pt`；`CACHE_NS.gc.ver` → 2；`quoteFormat` 成對名稱只寫一次類型名，並修正合併項目在「單場比分」標頭下沒省略同場情境（原本就有的問題）。

**驗證**
- 測試：後端＋契約 55、前端 63 全過（新增 `test_game_playtype.py` 9 項、`gamept.test.js` 4 項、quote 單場 Playtype、契約 `test_game_playtype_fields_same`；快取測試改成讀實際版號、不寫死 1）。
- 回補後另寫腳本從 Firestore 讀回，與預覽資料逐場逐類型比對 0 筆不一致、單場文件其他欄位完整；再跑一次「寫入 0、未變 16」。
- 本機瀏覽器：11/19 桌面數字與預覽一致（整體每回合得分差值改用顯示值相減：−0.06，預覽 −0.05）；防守端紅綠反向；「?」複製引用與整組加入（7 類）輸出正確；10/31 顯示無資料說明；2025-26 場次沒有分頁；數字鍵 5 可切；手機 375 無溢出、console 無錯誤。

**限制**
- 漏跑的日子救不回來（Synergy 不能事後指定日期），那兩場永久合在一起。
- 單場數字可能含 NBA 對前幾場的修正，差 1～2 個回合。
- 引用籃標頭「單場比分」在例行賽會帶「G16」場次編號（沿用既有規則）。

---

## 對戰分析後續構想（原交接手冊「B2」，2026-10-23）

> 2026-11-19 註：第二期「對手本季整體表現（聯盟排名）」已由賽前預覽（2026-11-04，雙方對照＋聯盟名次）涵蓋；其餘未做項目列在 handover.md「維護重點 › E. 待辦」。

第一期已上線，見「2026-10-23 對戰分析」與前端架構的「對戰分析」。之後可以做（都要先跟使用者確認）：
- [ ] **第二期：對手本季整體表現（聯盟排名）**——前瞻最缺的一塊。每日快照的球隊 request 目前帶 `TeamID=MIN`（伺服器端只回灰狼）；改成 `TeamID=0`（`_team_key()` 已支援，單場擷取就是這樣做）**request 次數不變**就能拿到全聯盟 30 隊，對戰頁可加「對手本季進攻／防守排第幾」。代價：要開新集合（**必加安全規則 read 白名單與 `*` 索引豁免**），且超出「只用現有資料」的範圍
- [ ] 對手 Tracking／Hustle 逐場資料從 2026-10 起才有，累積幾季後可在單隊頁加「對手端進階數據」；舊場次要補得整場重跑（每場約 20 requests）或另寫只抓球隊端的模式（約 9 requests）
- [ ] 2022-23～2024-25 若補 box score（`--box-only`，約 290 場 × 2 requests），每節分差、對手 box、對手球員就能涵蓋整個近三季範圍（使用者這次選擇不補）
- [ ] 「急停出手數」等出手次數類指標目前沿用 defs 預設（越多越好），對戰頁會標綠；若使用者認為應不分好壞，在 `constants.js` 加 `neutral: true`，所有頁面一起改

---

## 舊版手冊開頭摘要（2026-11-18 以前）

（原本疊在 handover.md 開頭的「最後更新／前次／同日稍早」，原文保留）

> 最後更新：2026-11-18（**引用籃格式對齊貼文**＋同日第二、三輪：跨季修正、抽屜分段複製、對手球員可引用；段首「●」預設不加（可選）、依指標段球員名次寫「球員第N」、例行賽單場標頭帶 `G14`、格子數值補齊小數位（-14.0%、54.0%），見「2026-11-18 引用籃格式對齊貼文」）
> 前次：2026-11-13（**球員聯盟名次**：灰狼球員在全聯盟合格球員（出賽 ≥ 70%、每場 ≥ 15 分鐘，247 人）中排名，命中率類另有場均出手門檻；身分列、總覽、Splits 全季、防守、投籃都顯示「聯盟第 N」，前 30 名綠字，「?」小卡說明門檻或沒有名次的原因，見「2026-11-13 球員聯盟名次」）
> 同日稍早：**資料品質小修**：看門狗 15:00 最後一步「逐場對帳」——全隊逐場加總 vs 整季快照，0 request，有落差才通知並附重抓指令（`--check-data` 可手動跑）；最近防守者另存出賽場數 `D_GP`，「樣本小 · N 次」不再多算，見「2026-11-13 資料品質小修」）
> 前次：2026-11-12（**個人效率、得分組成與抓取對帳**：球員總覽加「個人效率」（USG%／AST%／籃板率／PIE 等）與季平均 TS%／eFG%，投籃章節加「得分組成」（禁區／中距離／三分／罰球占比＋情境得分），跨季多「效率」「得分組成」；對帳後停抓投籃拆分（每日實測 84 requests）、補露出三分出手占比等 5 項，並重抓開季頭 4 場少抓的 Tracking，見「2026-11-12 個人效率、得分組成與抓取對帳」）
> 同日稍早：**護框與兩分／三分防守**：最近防守者多抓 `2 Pointers` 與 `Less Than 6Ft`（護框），防守章節的最近防守者改成總體／兩分／三分 3 × 3、新增「護框」群組，全隊帶聯盟名次；期間的 vs 平常改以出手數加權；小樣本標示「樣本小 · N 次」，見「2026-11-12 護框與兩分／三分防守」）
> 同日稍早：**組合數據、全域期間篩選、球員比較**：每日抓二人／三人／五人全部組合、新頁 `#lineups`；Splits 的期間列升級成主畫面共用控制（桌機在章節列、手機在身分列，網址 `pd=`／`c=`），跟不上期間的整季快照區塊篩選時停用；新頁 `#cmp` 兩位球員並排對照。另修「未出賽」傷停算不到、刊頭 1024～1280 px 按鈕被藏，見「2026-11-12 組合數據、全域期間篩選、球員比較」）
> 前次：2026-11-05（**戰報引用**：單場「球隊對比」可加入引用籃（每列「?」只在桌面、分組「整組加入」）、新增四因素與投籃分區兩組；Box Score 展開列「加入本場數據」一行；引用籃新增標頭「單場比分」（客場 @、主場 vs.、城市全名、可附每節）與「排列」（加入順序／依球員／依指標）；「名次」開關改為也控制歷史定位等補充，見「2026-11-05 戰報引用」）
> 前次：2026-11-04（**賽前預覽與完整賽程**：未開打的比賽也能開單場頁（預覽模式：雙方對照＋聯盟名次、交手、近況），賽程條有「下一場」卡、小月曆有未開打格子；新頁 `#schedule` 列出本季全部賽程（對手、主客、台北開賽時間、隊徽）。日期全站維持美東，開賽時間寫「台北隔日 09:30」，見「2026-11-04 賽前預覽與完整賽程」）
> 同日稍早：**條件戰績**：Splits 期間列多「條件」——球員數據／全隊數據／有出賽／未出賽，最多 2 個（且），看符合場次的戰績、勝率、場均分差與平均，網址 `c=` 可分享，見「2026-11-04 條件戰績」）
> 同日稍早：**歷史定位**：單場頁「本場 vs 季平均」只在灰狼場次前 3 名的格子標「灰狼第 N 高」、Box Score 展開列「?」小卡點開看完整定位；單場快取加有效期限 `wt_gc_v5_`，見「2026-11-04 歷史定位」）
> 同日稍早：**單場題材（本場題材 Story Leads）**＋**手機版巡檢修正**：後端 `build_insights.py` 每場算好「本季新高、2022-23 起排名、勝負關鍵」寫進單場文件，單場頁概要新增區塊；手機版陣容表、刊頭換行、比分區、Box Score 欄寬等，見「2026-11-04 手機版巡檢與單場題材」）
> 前次：2026-10-28（**聯盟名次與引用籃**，見同名章節）；2026-10-24（**網址改用球員「ID-名字」＋賽季 `s=年份&t=賽別`**、**單場分頁＋介面統一**、**網站圖示（PWA）**，見同名章節；之前的對戰分析、開季修正、薪資頁、單場比賽頁見同名章節）

---

## 單場球員清理紀錄（2026-10-19、10-23）

（原在 handover.md「單場數據」，現況做法見該處與 FAQ）

- **早期單場球員文件含非當時隊員（2025-26 已清理，2026-10-19）**：舊回補是用「後來的名冊名字」過濾全聯盟球員，混進別隊比賽。例行賽 51 份 `wolves_player_games` 共 91 筆（Dosunmu 26、Dillingham 19、Phillips 17、Miller 17、Anderson 12；其中 5 筆是他們以對手身分打灰狼）已從 `players` 移除。判定方法：`playerId` 不在當場 `wolves_team_games.box.players` 的 MIN 上場名單（tricode=='MIN' 且有 stats）。清理後重建了 `build_bundles.py --season 2025-26 --type regular`，讀回驗證 21 份球員 bundle 的每一場都對得上 box。季後賽、球隊 bundle、球隊單場 `stats` 沒受影響。注意：Overview 的 `SingleGamePanel` 以名字讀 `players`，並用 localStorage 永久快取（`wt_game_wolves_player_games_{date}`），清理後已把快取鍵換成 `wt_game_v2_…` 並在載入時刪掉舊鍵，讀者不用手動清快取
- **2022-23～2024-25 清理（2026-10-23，`backfill_games.py --clean-players`）**：這三季沒有 box，改用**多欄位對帳**（0 request）。每場把 `players` 加總比 `wolves_team_games.stats`：PTS／FGM／FGA／FG3M／FTM／FTA／OREB／DREB／AST／STL／BLK／PF 必須全等，TOV 只要求不超過球隊（球隊失誤含 24 秒違例等團隊失誤），上場時間加總 ≈ 5 × 球隊 MIN（容差 1.5 分鐘）。對不上時找「剔除後全部對得上」的最少人數組合（1～4 人），**該人數下唯一一組才剔除**，否則只列出不動。先用已清理的 2025-26 校準：94 場零誤刪（唯一對不上的 2026-03-01 是 NBA 球員 DREB 加總比球隊少 1，全員都在 box，屬資料落差）。三季例行賽剔除 76 場、105 人次（2022-23：Conley 26、Alexander-Walker 23、Russell 9、Matt Ryan 7、A.J. Lawson 3；2023-24：Troy Brown Jr. 13、Monte Morris 5、Shake Milton 4、Wendell Moore Jr. 1；2024-25：Hyland 13、Tristen Newton 1），剔除日期與真實交易時間吻合；季後賽三季本來就對得上。重建三季 bundle 後，得分加總、對帳腳本、bundle 端反推三種核對全部歸零。用法：先 `--dry-run` 看名單，再拿掉 `--dry-run` 寫入，接著 `build_bundles.py --season X --type Y`

---

## 更新紀錄

- 2026-11-21 — 單場 Playtype 與用詞改為回合數（見「功能開發紀錄」同名一節）：快照相減還原＋寫入單場文件＋`--playtype-only`，回補 2026-27 例行賽 16 場（`5fc3401`）；全站「球權」改「回合數／每回合得分」（`c72ce15`）；單場頁 Playtype 分頁、引用成對命名、`CACHE_NS.gc.ver` 2（`e22aca7`）
- 2026-11-20 — 總覽期間篩選擴大與攻守切換移位（見「功能開發紀錄」同名一節）：逐場 bundle 每場加 `adv`（`fb742c3`，重建 2026-27 例行賽 bundle，0 NBA request）；總覽章節列不再有攻守切換、Playtype 強弱項攻守並列、雷達與單場面板各自帶切換（`d264fbf`）；全隊效率／個人效率／在場不在場跟著期間、近似值標 ≈、篩選時不排名、引用期間寫法統一（`bd0f15b`）
- 2026-11-19 — 技術債 F 批（`App.js` 拆分，畫面不動）：1,506 行拆成 `App.js`（約 900 行，主畫面狀態與畫面組裝）＋`appLogic.js`（純計算 `window.AppLogic`，新增 `tests/js/applogic.test.js` 13 個測試）＋`appData.js`（資料載入 hooks）＋`appRoute.js`（獨立整頁路由與開站首頁）。順手修：歷史賽季讀取失敗改在畫面顯示（原本跳 `alert`），錯誤卡標題分當季／歷史；拿掉未使用的變數與 import（`currentShooting`、`prevTracking`、`SimpleLineChart` 等 14 個）；逐場 bundle 與投籃的賽季／賽別改共用 `splitsBundle`；重複的 `untilDate`、球員清單算式改用既有變數；「賽季不記憶」的註解改寫成實際做法（舊值由 `Cache.purge` 清）。瀏覽器逐頁驗證（首頁最新一場、主畫面六章節、時光機、歷史賽季、期間與條件、走勢視窗、搜尋、單場、薪資、完整賽程、組合、比較、對戰含 `m=` 捲動與範圍保留、手機 375px），console 無錯誤
- 2026-11-19 — 技術債 E 批（文件瘦身）：handover.md 拆成現況（handover.md，約 8.6 萬字，加「文件地圖與維護方式」「功能索引」）與開發紀錄（本檔）；過時敘述逐條對照程式碼改正（快取鍵改 `CACHE_NS`、Blaze 方案、走勢 Modal、單場頁不掛章節列、刊頭站徽、`DATA_KEYS`、反爬蟲現況等）；CLAUDE.md 改查表式（15,750 → 約 5,200 字，舊條文原文移到 handover「規則與指令細節」）；README 移除檔案樹、集合清單、過時反爬蟲說明，改指向手冊。原檔備份在 `~/.claude/ops/backup-20261119/wolvestracker-E/`
- 2026-11-19 — 技術債 D 批（自動化測試，Phase 1–6）：新增 `scripts/run_tests.py`、`tests/py`（36 個）、`tests/js`（38 個）、`tests/fixtures`；`bundle.py` 打包完自動跑前端測試；`.gitignore` 的 `debug_*.py`／`test_*.py` 改成只忽略根目錄；`backfill_history.py` 本地輸出可用 `WOLVES_LOCAL_DIR` 改目錄。過程中發現 B 批對照測試把 `_local/backfill/backfill_2024-25_{regular,playoffs}.json` 覆蓋成假資料，已由 Firestore 同名歷史快照重建（內容為 2026-11-19 的 Firestore 版本，含之後補的欄位；說明在 `_local/backfill/README_2024-25.txt`）。另發現 Sheet 的 2025-26、2026-27 奢侈稅率（1.0／1.25／3.5／4.75，累犯 3.0～6.75）與 2024-25（1.5／1.75／2.5／3.25）不同，待使用者核對

- 2026-11-19 — 技術債 C 批（Phase 1–3）：① 新增 `components/cache.js`（`window.Cache`／`CACHE_NS`），單場文件、舊賽季索引、賽前預覽、舊賽季組合、歷史快照五種快取改走它；總覽 `SingleGamePanel` 改用共用 `loadGameDocs`（拿掉永不過期的 `wt_game_v4_`）；`HISTORY_CACHE_VER`、各檔清舊版快取的程式碼、`wt_pref_selectedSeasonKey` 清理改由 `Cache.purge()` 統一處理。驗證：開站清掉 11 種舊鍵且保留偏好／引用籃、快取命中 0 次讀取、模擬存滿時刪最舊 3 筆後寫入成功。② 引用籃讀取丟掉格式不對的項目（`quoteFormat` `validItem`）：之前一筆壞資料就讓整站白屏。③ `window.fixSigned`、`window.Num`（`isNum`／`round1`／`sd`）取代 13 處各寫各的寫法；新舊對照 300 組只有「±0.0 → 0.0」不同（修掉「+0.0」「-0.0」）；8 個頁面實測無錯誤

- 2026-11-19 — 附加賽與刊頭改版（Phase 1–3）：① 後端：`SEASON_TYPES` 加 `playin`（PlayIn／附加賽），`type_key_of()`、`SNAPSHOT_TYPE_KEYS`；`season_type_from_schedule` 依賽程判斷灰狼附加賽（gameId 005 且有灰狼球隊 ID）→ 主排程只擷取單場＋用例行賽數據更新預覽、不寫快照；附加賽最後一場隔天若已是季後賽首日，`capture_all()`／`pending_playin()` 另外補定稿附加賽，看門狗 `latest_watched_game()` 一起檢查；附加賽期間逐場對帳與每週熱圖跳過；`backfill_games.py`／`build_bundles.py`／`fetch_shotchart.py` 支援 `--type playin`。② 回補 2022-23 兩場附加賽（58 requests，各來源完整），`wolves_games_index`／`wolves_games_bundle`／`wolves_pgames_bundle` 的 `2022-23_playin`；投籃點未補。③ 前端：整季賽程含附加賽、月曆標「附加」、未開打的 005 場次標附加賽、首頁最新一場算進附加賽、單場頁附加賽膠囊與「本場 vs 例行賽平均」、引用標頭寫「附加賽」；身分列附加賽膠囊。④ 刊頭方案 A＋B：刊頭左右分區（「資料」群組／頁面入口＋搜尋）、移除複製連結、身分列季別標籤一律顯示、章節列黏頂時顯示季別。⑤ 前端美東時間改 `window.etParts()`（Intl，含夏令），與後端 `now_east()` 一致（B 批時交接手冊誤寫前端已是 Intl，這次才真的改）。未做：附加賽的本場題材（`build_insights` 只看例行／季後）

- 2026-11-19 — 技術債 B 批（Phase 1–3）：① 時區：新增 `nc.now_east()`（zoneinfo America/New_York，含夏令；Windows 需 `tzdata`，已列入 requirements；沒裝時退回手寫美國夏令規則），取代 5 處 `utcnow() - 5h`，定稿門檻、今天日期、賽季界線都改用它。② 快照類別表化：`TEAM_SNAPSHOT_CATEGORIES`／`PLAYER_SNAPSHOT_CATEGORIES`＋`fetch_team_snapshot()`／`fetch_player_snapshot()`，`fetch_data.py` 與 `backfill_history.py` 共用；賽別鍵轉換收成 `nc.season_type()`。用假資料對照新舊程式（5 種情境，0 request）：寫入內容、request 集合、結束碼完全相同，只有發出順序不同。③ 賽別改由賽程推導：`get_season_type()` 先讀全聯盟賽程（`season_type_from_schedule`，例行賽／季後賽最後一場＋1 天寬限，總冠軍賽有隊拿 4 勝才算季後賽結束），開季前、附加賽空檔、季後賽結束當休賽期；賽程檔與資料賽季不符也當休賽期；抓不到才退回舊日期規則 `_season_type_by_date`。賽程檔同一次執行快取 30 分鐘（`SCHEDULE_CACHE_SECONDS`），與賽前預覽共用，每日排程不多發 request；看門狗與每週熱圖各多 1 個 cdn.nba.com request。已知未處理：灰狼若打附加賽（gameId 005），單場仍不會擷取（舊規則也沒有）

- 2026-11-19 — 技術債 A 批：`run_fetch.bat`／`run_watchdog.bat`／`run_shotchart.bat` 進版控（`.gitattributes` 固定 CRLF），`run_fetch.bat` 加 `fetch_log.txt` 超過 2 MB 封存到 `_local/logs/fetch_log_YYYYMMDD.txt`；根目錄舊檔搬到 `_local/`，`backfill_history.py` 驗證檔改寫 `_local/backfill/`；source map 不進版控（`--sourcemap=external`）；移除 `.agent/`、`doc/plan.md`、`doc/test/`、`.gitignore` 的 AL 範本段、舊 worktree 與已併入分支
- 2026-11-18 — 跨季同列小數位對齊（Pace 101.5 → 101.50）
- 2026-11-18 — 引用籃分段複製與對手球員：`Quote.renderBlocks`、抽屜預覽置頂＋每段複製＋項目／格式摺疊、對手 Box Score 點列加入本場數據（`名字（拓荒者）`）
- 2026-11-18 — 跨季修正：說明列 undefined、直開球員跨季當季欄全「—」（`loadComparisonSeason` 只拿到一邊快照就快取）、跨季引用帶當季快照日
- 2026-11-18 — 引用籃格式對齊貼文：段首「●」改選項且預設不加、依指標段補名次說明與「球員第N」、例行賽單場標頭帶 G 場次、`UI.cellNum` 補齊小數位（格子顯示與引用）、單場季均一位小數、條件戰績情境改正式賽季名、單場球員效率引用加「在場」；新增「2026-11-18 引用籃格式對齊貼文」章節
- 2026-11-18 — 逐場對帳只報少抓：`consistency_issues()` 逐場比快照多的不算異常，改放 `info.over`，看門狗只記 log、不通知（11/15、11/16 卡位 +3 次誤報）。同日確認 11/13～11/18 排程正常：每日快照約 83 requests、球員名次每天寫入（合格 246～248 人）、11/12～11/16 三場定稿且灰狼球員有兩分／護框／`D_GP`
- 2026-11-13 — 球員聯盟名次（Phase 1–4）：`nba_common` 加 `PLAYER_RANK_RULES`／`PLAYER_RANK_ATT_PAIRS`／`PLAYER_RANK_CATS`、`player_league_ranks()`、`fetch_base_box(team_of=)`；`fetch_data.py` 最近防守者與防守 box 改抓全聯盟、球員文件加 `ranks`；前端 `RankCtx` 支援球員、`leagueRank` 回 `top`／`gate`、`rankGateText`／`rankWhy`、`StatCell`／`Info` 的 `rankWhy` 與綠字，身分列／總覽／Splits／防守／投籃接上名次。使用者決定：出賽 ≥ 70%＋每場 ≥ 15 分鐘、場均出手門檻（投籃 5／三分 3／罰球 2、其他 P25）、未合格不顯示（小卡附參考名次）、前 30 名綠字、失誤犯規不上綠
- 2026-11-13 — 資料品質小修（Phase 1–4）：`MATCHUP_OVERALL_FIELDS` 加 `D_GP`（最近防守者出賽場數），防守章節「樣本小」次數改用場均 × `D_GP`；`nba_common` 加 `CONSISTENCY_RULES`／`CONSISTENCY_SKIP`／`CONSISTENCY_LABELS`、`consistency_fields()`／`consistency_issues()`；`watchdog.py` 拆出 `watch()`、15:00 最後一步 `check_data()`、新增 `--check-data`。另把交接手冊的每日 request 改為實測 84。使用者決定：放看門狗、只比全隊、只通知不自動重抓、舊快照不補 `D_GP`
- 2026-11-12 — 個人效率、得分組成與抓取對帳（Phase 1–6）：`nba_common` 加 `PLAYER_ADVANCED_FIELDS`／`SCORING_FIELDS`／`MISC_FIELDS`、`fetch_player_advanced`／`fetch_scoring`；快照球員 `advanced`／`scoring`、全隊 `scoring`／`ranks.scoring`；`backfill_history.py --only-adv-scoring` 補 8 份（含全隊進階）；停抓投籃拆分，每日實測 84；前端 `playerAdvancedDefs`／`scoringShareDefs`／`scoringSituationDefs`、總覽個人效率、投籃 `ScoringMix`、跨季「效率」「得分組成」、`GameAgg.TS_DEFS`／`WAVG_DEFS`／`FG3A_FREQ`、`StatCell` 的 `sub`、`HISTORY_CACHE_VER` 6；Splits 加 TS%／eFG%／三分出手占比，Tracking 加接球跳投／急停得分與切入助攻率，防守 Box 加對手二波得分；重抓 10/21～10/26（Tracking 少抓），單場快取 `wt_gc_v7_`／`wt_game_v4_`。使用者決定：進階 10 欄、Scoring＋Misc 都抓、只有 TS／eFG 跟期間、歷史只補快照、對帳 4 項＋切入助攻率都做、重抓 4 場
- 2026-11-12 — 護框與兩分／三分防守（Phase 1–5）：`nba_common` 加 `MATCHUP_2PT_FIELDS`／`MATCHUP_RIM_FIELDS`／`MATCHUP_CATEGORIES`／`MATCHUP_OPP_CATEGORIES`、`fetch_matchup_defense(categories, failed)`，每日 75 → 79、每場 26 → 28 requests；`backfill_history.py --only-matchup`、`backfill_games.py --matchup-only`（`--matchup-cats`），回補 8 份歷史快照與本季 11 場；前端 `MatchupDefense` 3 × 3＋`RimProtection`、`DEF_SHOT_RULES`／`DEF_NEW_KEYS`、`GameAgg.NORMAL_DEFS`（期間 vs 平常改加權）、`StatCell` 的 `sample`／`signed`／`fullLabel`、`TrackingCardRow` 的 `cols`／`gp`，單場快取 `wt_gc_v6_`。使用者決定：用 Defense Dashboard、加兩分與 < 6 Ft、不加 < 10／> 15 Ft、歷史只補快照、「平常」漂移只寫說明
- 2026-11-12 — 組合數據、全域期間篩選、球員比較（Phase 1–6）：`nba_common` 加 `fetch_lineup_rows`／`top_lineups`／`lineups_consistent`／`lineups_doc`／`write_lineups` 與 `LINEUP_GROUPS`／`LINEUP_DOC_FIELDS`，每日 +2 requests，寫 `wolves_games_index/{season}_{type}_lineups`，`backfill_history.py --only-lineups` 回補 2022-23 起 8 份；前端 `LineupsPage.js`（`#lineups`）、`loadLineups`、`UI.DataTable` 的 `limit`／`exportSource`；`periodFilter.js`（`window.Period`）、`PeriodControl.js`、`UI.TabBar` 的 `below`、`UI.Locked`，總覽／Splits／投籃／防守跟著全域期間（網址 `pd=`／`c=`），整季快照區塊停用、引用附期間；`compareData.js`／`ComparePage.js`（`#cmp`），身分列「比較」。另修：未出賽在隊期間（當季仍在名冊算到最新一場）、刊頭 1024～1280 px 按鈕被藏。使用者決定：只做二／三／五人、組合文件只留最新、桌機 B 手機 A、停用區塊不能點、Playtype 單場還原另案
- 2026-11-04 — 賽前預覽與完整賽程（Phase 1–4）：新增 `scripts/build_preview.py`（`wolves_games_index/{season}_preview`，每日 +1 CDN request）與 `nba_common` 的 `PREVIEW_*`／`fetch_league_schedule`／`rank_all`；前端 `loadPreview`、`kickoffTPE`／`kickoffET`／`etToday`／`ordinal`／`teamLogo`、`PreviewPanel.js`（預覽模式）、賽程條下一場卡、小月曆未開打場次、`SchedulePage.js`（`#schedule`）與三個入口。使用者決定：預覽放單場頁、名次用英文序數、日期維持美東＋台北隔日開賽時間、只做當季
- 2026-11-04 — 條件戰績（Phase 1–3）：新增 `components/splitConditions.js`（`window.SplitCond`）與 `CONDITION_RULES`；`SplitsTab` 期間列「條件」、條件編輯器（單顆 ≥／≤ 鈕、名字縮寫、單行）、戰績摘要、符合場次；網址 `c=`（`urlState`／App `splitCond`）；`glossary` 加 `SPLIT_COND`；`UI.Section` 標題可截斷。使用者決定：三種條件、最多 2 個、跟著所選賽季、未出賽採交易截止日後算到季末、名字縮寫與不換行原則
- 2026-11-04 — 歷史定位（Phase 1–4）：`nba_common` 加 `INSIGHT_MARK_RULES`／`INSIGHT_MARK_METRICS`、`build_insights.player_marks()`（`insights.marks`，v2，回補 384 場）；`loadGameDocs` 快取加有效期限並換 `wt_gc_v5_`；`constants.js` 加 `HISTORY_RULES`；`UI.Info` 加 `history`；單場頁「本場 vs 季平均」標籤與展開列「?」歷史定位。使用者決定：現在排名＋自 X 以來、版型 C 只標例外、標籤前 3 名＋15 分鐘（實測否決前後 5%）、快取期限一起修
- 2026-11-04 — 單場題材（Phase 1–4）：`nba_common` 加 `INSIGHT_RULES`／`INSIGHT_TEAM_METRICS`／`INSIGHT_PLAYER_METRICS`；新增 `scripts/build_insights.py`（0 request，寫 `wolves_team_games/{date}.insights`，回補 384 場）；`fetch_data.py` 擷取新場次後重算；`loadGameDocs` 快取換 `wt_gc_v4_`；單場頁概要新增「本場題材」（勝負關鍵＋最多 5 個題材、可引用）。使用者決定：名次截至當場＋之後被超越改灰框註記、回補全部、開季照常列「本季新高」、不做逐節走勢與對手球員
- 2026-11-04 — 手機版巡檢 P1／P2：`DataTable` `stackFirst`、`UI.scrollHint`、刊頭換行與副標色點、身分列併行、單場頁精簡比分區、Box Score 名字縮寫、表頭「?」移到右側、連結點擊區 24px、賽程條 snap、薪資「最後異動」標籤；確認切入失誤 0 為 NBA 原始資料
- 2026-10-29 — 單場進階 box 與在場／不在場效率：`nba_common` 加 `BOX_ADV_FIELDS`／`add_box_advanced`（boxscoreadvancedv3）、`fetch_onoff(game_date=)`／`add_box_onoff`（單場 On/Off 不在場，只有灰狼）、`box_oncourt_totals`（bundle 的 `ON_PTS`／`ON_OPP_PTS`／`ON_POSS`）；每場抓取 +2 requests；`backfill_games.py --adv-only` 補本季 5 場；`build_bundles` 重建 2026-27；前端 Box Score「傳統｜進階」切換（`bx=adv`）、展開列「效率（在場）」附季均與不在場、`GameAgg` 加 `ON_*_RATING` 加權；`wt_gc_v3_` 換版。使用者決定：不標樣本少、不回補 2025-26 以前
- 2026-10-29 — 看門狗修補：主排程等滿 60 分鐘仍在跑就不補抓（避免兩個抓取並行打 NBA）；`fetch_log.txt` 被鎖時補抓輸出改寫 `fetch_log_watchdog.txt`（`.gitignore` 已加）；被擋時少打 request：`fetch_data.py` 開頭連續 3 項失敗提前結束（碼 2）、早上看門狗當天已失敗過就不再重試、逾時中止的補抓輸出補換行；瀏覽器指紋自動切換（`FINGERPRINTS`、`nba_fingerprint.json`，UA 跟指紋一致、名冊併入共用重試），看門狗 log／通知回報指紋與是否換過（起因：`chrome110` 被 Akamai 擋整天，同機 `safari15_5` 正常）
- 2026-10-29 — 跨季比較 On/Off 加「進攻／防守效率在場差」兩列（在場 − 不在場，`ComparisonTab` 的 metric `diff: [在場欄, 不在場欄]`＋`signed` 帶正負號；防守差負＝上場後失分變少）
- 2026-11-12 — 全隊最近防守者（`leaguedashptteamdefend`，每日＋8 份歷史快照回補、聯盟名次、防守章節放防守 Box 後）；跨季比較 Playtype 加攻守切換（只在 Playtype 類別出現在「匯出」左邊，與章節列共用 `viewSide`；防守端不列 Cut／Misc、引用「防守…每球權失分」）
- 2026-11-05 — 戰報引用：球隊對比可引用（整組加入、桌面逐列「?」）＋四因素／投籃分區；Box Score 展開列加入本場數據；引用籃 `note`／`line`／`game`、標頭「單場比分」＋每節、「排列」三種；新增「2026-11-05 戰報引用」章節
- 2026-10-29 — 引用籃名稱徹查（Playtype 中文／原文對調、Clutch 前綴、原文剝說明、薪資與受助攻原文）；跨季比較可選當季（`COMPARISON_SEASON_OPTIONS`、`loadComparisonSeason`）
- 2026-10-28 — 聯盟名次與引用籃（Phase 1–4）：每日抓取全隊類別改拿 30 隊算名次（`ranks`）、新增全隊進階 `advanced`（+1 請求）、`RANK_LOWER_BETTER`／`RANK_SKIP`；前端 `RankCtx`／`leagueRank`／`ptRank`、StatCell 名次小字、總覽「全隊效率」、球隊 Playtype 百分位換算名次；新增 `quoteFormat.js`（`window.Quote`）與 `QuoteBasket.js` 跨頁引用籃；新增「2026-10-28 聯盟名次與引用籃」章節，更新檔案結構、寫作工具、每日快照欄位、新增數據 FAQ、請求預算
- 2026-10-26 — 每日抓取看門狗（Phase 1–4）：`fetch_data.py` 加 `--games-only`、`fetch_status.json`、被擋結束碼 2／Firebase 失敗結束碼 1；新增 `scripts/watchdog.py`（15:00 分級補抓、Windows 桌面通知、`--dry-run`／`--test-notify`）與 `run_watchdog.bat`、排程 `WolvesWatchdog`；`WolvesTracker` 改為用電池可跑；`.gitignore` 加 `fetch_status.json`、`watchdog_log.txt`；新增「2026-10-26 每日抓取看門狗」章節，更新「自動化排程」、檔案結構、FAQ、請求預算
- 2026-10-23 — 對戰分析（Phase 0–5）：`backfill_games.py --clean-players` 清理 2022-23～2024-25 單場球員文件（剔除 76 場 105 人次，重建 bundle）；`matchupData.js`（`window.Matchup`）、`MATCHUP_RULES`／`MATCHUP_TAGS`／`NBA_TEAM_NAMES`；對戰首頁 `MatchupHome.js`（`#vs`）、單隊對戰頁 `MatchupPage.js`（`#vs=三碼`）、刊頭「對戰」與搜尋入口、單場頁「歷次交手」連結、Splits 對手篩選；`gamesData.loadGameDocs` 共用單場文件讀取（快取鍵 `wt_gc_v2_`、`SingleGamePanel` 換 `wt_game_v3_`）；`glossary.js` 新增 OPP_PTS／MU_* 說明；新增「2026-10-23 對戰分析」「對戰分析」章節、FAQ、雷區，B2 改為已完成並列出第二期
- 2026-10-20 — 薪資頁（Cap Sheet，Phase 1–6）：Google Sheet＋`sync_salary.py`＋`wolves_salary/main`（安全規則、索引豁免已設）；`CapPage.js` 四分頁（總覽／合約／選秀權／規則）、累犯依 `tax_history` 自動判定、懸停完整金額、球員薪資膠囊與雙向連結、薪資×表現（逐場 bundle 計算）；`ui.js` 匯出加 `source`；新增「2026-10-20 薪資頁」「薪資資料」「薪資頁」章節與相關 FAQ、雷區
- 2026-10-19 — 單場比賽頁＋跨季疊圖（Phase 1–6）：`--box-only` 補 2025-26 box score、網址 m/hl/game、Splits 防守組、走勢勝負底色、`GamePage.js`、`SeasonPaceChart.js`／`LineOverlay`、ComparisonTab 多序列、投籃與上季比；修登入時序 bug；更正 22-23／23-24 逐場已有資料；新增「2026-10-19 單場比賽頁＋跨季疊圖」「單場比賽頁」「跨季疊圖」章節
- 2026-10-19 — 單場加抓對手球隊／球員與完整 box score（先發、DNP、每節比分、傷停）；灰狼單場球員改以 box score PlayerID 過濾（修 Terrence Shannon Jr 名字寫法不一致被漏掉）
- 2026-10-19 — 開季前修正：賽季改由日期推算、每日單場改依賽程補抓＋bundle 增量更新＋定稿規則、排程改台北 03:00；Firestore 更正為 Blaze 方案、10 個集合設 `*` 索引豁免（儲存估算由每季 ~139 MiB 降至 ~16～19 MiB）

- 2026-10-14 — SECONDARY_AST 依 NBA.com 官方定義改寫並更名「二次助攻」，glossary 已無待確認條目
- 2026-10-14 — Wolves Ledger 改版 Phase 6–7：近期快照載入、移除阻斷載入、對比 AA、觸控目標、總覽近 N 場、引用附網址；新增「效能與無障礙」「2026-10 Wolves Ledger 改版」，更新檔案結構、Spark 用量、雷區與常見問題
