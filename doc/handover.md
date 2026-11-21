# Wolves Tracker 交接手冊

> 最後更新：2026-11-21（單場 Playtype：每日快照相減寫進 `wolves_team_games.playtype`、單場頁新增 Playtype 分頁 `tab=pt`、`backfill_games.py --playtype-only`；全站 Playtype 用詞改為「回合數／每回合得分」）

## 文件地圖與維護方式

| 檔案 | 內容 | 什麼時候讀 |
|---|---|---|
| `CLAUDE.md` | 常用指令與「漏了就出錯」的規則，一條一行（每次對話自動載入，所以維持精簡） | 自動載入 |
| `doc/handover.md`（本檔） | **現況**：架構、資料結構、排程、各功能現行規則、FAQ、雷區、待辦 | 動手前查對應章節 |
| `doc/history.md` | **歷史**：各功能當時的需求、做法、驗證、使用者確認過的決定、已完成項目總表、更新紀錄 | 改某功能前讀它的「使用者確認過的決定」；想知道為什麼這樣做 |
| `README.md` | 對外說明（功能、快速開始、部署） | — |

本檔裡寫「見 history.md「…」」的章節都在 `doc/history.md`。

**之後怎麼更新**（每次功能改動收尾時）：
1. 現況寫進本檔對應的主題章節——**改寫舊敘述**，不在後面追加「2026-xx 改」段落；舊做法有參考價值就移到 history.md
2. 這次的需求、做法、驗證與使用者確認過的決定，在 history.md「功能開發紀錄」加一節，「更新紀錄」加一行
3. 本檔開頭的「最後更新」只留一行，改寫、不疊加
4. CLAUDE.md 只在新增「漏了就出錯」的規則或常用指令時加一行，細節放本檔「規則與指令細節」並寫章節名

---

## 功能索引

改某個功能前：先看「現況章節」（本檔），再讀「設計紀錄」（history.md）那一節的「使用者確認過的決定」。

| 功能 | 主要檔案 | 現況章節（本檔） | 設計紀錄（history.md） |
|---|---|---|---|
| 每日抓取、賽別、附加賽 | `fetch_data.py`、`nba_common.py` | 自動化排程、Firebase 資料結構 | 2026-07 六分頁大改版；更新紀錄 2026-11-19（B 批、附加賽） |
| 看門狗 | `watchdog.py`、`run_watchdog.bat` | 自動化排程 | 2026-10-26 每日抓取看門狗；2026-11-13 資料品質小修 |
| 版面、網址、快捷鍵 | `App.js`、`appRoute.js`、`urlState.js`、`Masthead.js`、`IdentityBar.js`、`ChapterNav.js` | 版面骨架與網址狀態、規則與指令細節 | 2026-10 Wolves Ledger 改版；2026-10-24 單場分頁＋介面統一；2026-10-24 網址改用球員「ID-名字」＋賽季參數統一；更新紀錄 2026-11-19（刊頭改版） |
| 單場比賽頁 | `GamePage.js` | 單場比賽頁、單場數據 | 2026-10-19 單場比賽頁＋跨季疊圖；2026-10-24 單場分頁＋介面統一 |
| 單場 Playtype（全隊） | `nba_common.py`（`split_game_playtypes`／`write_game_playtypes`）、`GamePlaytype.js` | 單場數據（`playtype`）、單場比賽頁、維護重點 B | 2026-11-21 單場 Playtype 與用詞改為回合數 |
| 單場題材、歷史定位 | `build_insights.py`、`GamePage.js` | 單場數據（`insights`）、FAQ | 2026-11-04 手機版巡檢與單場題材；2026-11-04 歷史定位 |
| 賽前預覽、完整賽程 | `build_preview.py`、`PreviewPanel.js`、`SchedulePage.js` | 單場數據（預覽文件）、FAQ | 2026-11-04 賽前預覽與完整賽程 |
| 跨季疊圖 | `SeasonPaceChart.js`、`ComparisonTab.js` | 跨季疊圖 | 2026-10-19 單場比賽頁＋跨季疊圖 |
| 薪資頁 | `CapPage.js`、`sync_salary.py` | 薪資頁、薪資資料 | 2026-10-20 薪資頁（Cap Sheet） |
| 對戰分析 | `matchupData.js`、`MatchupHome.js`、`MatchupPage.js` | 對戰分析 | 2026-10-23 對戰分析；對戰分析後續構想 |
| 聯盟名次（全隊、球員） | `nba_common.py`（`split_league`、`player_league_ranks`）、`constants.js` | FAQ「想新增數據」 | 2026-10-28 聯盟名次與引用籃；2026-11-13 球員聯盟名次 |
| 複製引用、引用籃 | `ui.js`、`quoteFormat.js`、`QuoteBasket.js` | 寫作工具 | 2026-10-28 聯盟名次與引用籃；2026-11-05 戰報引用；2026-11-18 引用籃格式對齊貼文 |
| 條件戰績 | `splitConditions.js`、`PeriodControl.js` | FAQ「條件戰績」 | 2026-11-04 條件戰績 |
| 組合、全域期間、球員比較 | `LineupsPage.js`、`periodFilter.js`、`PeriodControl.js`、`compareData.js`、`ComparePage.js` | FAQ「組合頁」「期間篩選」「比較頁」 | 2026-11-12 組合數據、全域期間篩選、球員比較 |
| 防守（最近防守者、護框、Hustle） | `nba_common.py`（`MATCHUP_*`、`HUSTLE_FIELDS`）、`constants.js`（`defenseDefs`） | 防守數據：Hustle 欄位與全隊最近防守者 | 2026-11-12 護框與兩分／三分防守 |
| 個人效率、得分組成 | `nba_common.py`（`PLAYER_ADVANCED_FIELDS`、`SCORING_FIELDS`） | 指標命名對照 | 2026-11-12 個人效率、得分組成與抓取對帳 |
| 總覽區間效率（全隊效率、個人效率、在場／不在場跟著期間）、總覽攻守切換 | `gameAggregates.js`（`teamAdvanced`／`playerAdvanced`／`onOff`）、`OverviewTab.js`、`nba_common.py`（`box_team_adv`／`box_player_adv`）、`build_bundles.py` | 各章節、單場數據（bundle 的 `adv`）、FAQ「期間篩選」 | 2026-11-20 總覽期間篩選擴大與攻守切換移位 |
| 單場資料清理（整組 0） | `gamesData.js`（`cleanGameStats`） | 單場數據 | 2026-10-27 正式站掃描：資料顯示修正 |
| 效能、手機入口、圖示 | `index.html`、`RadarPanel.js`、`icons/`、`build_icons.py` | 效能與無障礙 | 2026-10-28 效能與手機入口；2026-10-24 網站圖示（PWA／加入主畫面） |
| 前端快取、測試、時區 | `cache.js`、`tests/`、`run_tests.py` | localStorage 快取、自動化測試 | 更新紀錄 2026-11-19（B、C、D 批） |

---

## 規則與指令細節（2026-11-19 自 CLAUDE.md 移入）

> CLAUDE.md 改成查表式後，原本寫在那裡的完整條文原文搬到這裡（CLAUDE.md 只留一行摘要＋章節名）。之後規則有變，改這裡的條文，CLAUDE.md 只在摘要也變時才動。

### 指令完整參數

- 每日抓取：`python scripts/fetch_data.py`（賽別依全聯盟賽程判斷 `nba_common.get_season_type()`：例行賽／季後賽最後一場隔天為止；賽程上有灰狼附加賽（gameId 005）的日子是**附加賽**，只擷取單場＋更新預覽、不寫快照；開季前、灰狼沒打的附加賽空檔、季後賽結束都當休賽期跳過，賽程檔抓不到才退回日期規則；Synergy 與 base 都空才當被擋而終止，開季 Synergy 未釋出照常寫入；補期末快照用 `--force-type playoffs --date YYYY-MM-DD`；只抓缺漏單場 `--games-only`；每次執行寫 `fetch_status.json`，被擋結束碼 2；開頭連續 3 項失敗就提前結束，`nba_common.enable_block_guard`）
- 看門狗：排程 `WolvesWatchdog` 台北 15:00 跑 `python scripts/watchdog.py`（主排程沒完成 → 完整補抓、昨晚那場缺 → `--games-only`，有補抓或失敗才跳桌面通知，log `watchdog_log.txt`）；早上排程 `WolvesWatchdogMorning`（09:00＋登入＋解鎖，跑 `--morning`：只在 03:00 主排程今天沒完成時完整補抓，今天已失敗過就不重試、留給 15:00，否則不發 request 直接結束）；手動 `--dry-run`（只判斷）／`--test-notify`；主排程跑超過 60 分鐘就放棄這次補抓（不並行）；`run_watchdog.bat` 的 stderr 不可導到 `watchdog_log.txt`（檔案鎖），補抓輸出遇 `fetch_log.txt` 被鎖改寫 `fetch_log_watchdog.txt`；15:00 那次最後一步「逐場對帳」（全隊逐場 bundle 加總 vs 整季快照，0 request，門檻 `nba_common.CONSISTENCY_RULES`，只在逐場比快照少（少抓）時通知、log 附重抓指令，逐場比快照多的只記 log；手動 `--check-data [--dry-run]`）
- 投籃熱圖：每日抓取已順帶增量（定稿場次每場 1 request 併入 `wolves_shotcharts`，以全隊文件 `gameDates` 判斷已併入）；每週整季重抓 `python scripts/fetch_shotchart.py` 對帳＋更新受助攻比例（跨季重跑 `--season 2024-25 --type regular`）
- 單場回補：`python scripts/backfill_games.py --season 2024-25 --type regular`（附加賽 `--type playin`，回補後 `build_bundles.py --season X --type playin`；2022-23 兩場已補）（補失敗場 `--dates 2024-11-21,2025-01-09`；只補 box score `--box-only`，每場 4 requests，2025-26 已補；已有 box 只補進階＋單場 On/Off `--adv-only`，每場 2 requests，2026-27 起才有；已有單場只補灰狼球員的最近防守者類別 `--matchup-only [--matchup-cats 2PT,Rim]`，每類每場 1 request，2026-27 起已補；由每日快照相減重算單場 Playtype `--playtype-only [--dry-run]`，0 request，2026-27 起才有材料）
- 單場球員混入外隊：`backfill_games.py --season X --type Y --clean-players --dry-run`（多欄位對帳，0 request；確認後拿掉 `--dry-run` 寫入→`build_bundles.py`→前端單場快取鍵換版，見 doc/handover.md；2022-23～2025-26 已清）
- 歷史回補：`python scripts/backfill_history.py --season 2024-25 --type regular`（完整類別終點快照；只補 Hustle 欄位加 `--only-hustle`、只補全隊最近防守者加 `--only-team-matchup`（4 requests）；只補最近防守者指定類別（球員＋全隊）加 `--only-matchup [--matchup-cats 2PT,Rim]`，每類每份 2 requests，2022-23 起兩分／護框已補；只補球員進階＋得分組成（含全隊進階）加 `--only-adv-scoring`，每份 6 requests，2022-23 起已補；只補組合頁文件加 `--only-lineups`，每份 3 requests，2022-23 起已補）
- 組合數據：每日抓取順抓二人／三人／五人全部組合 → `wolves_games_index/{season}_{type}_lineups`（每天覆寫、只留最新；+2 requests；`nba_common.lineups_consistent` 檢查分鐘加總，沒過不覆寫）；欄位／人數改 `LINEUP_DOC_FIELDS`／`LINEUP_GROUPS`
- **逐場打包**：回補 games 後跑 `python scripts/build_bundles.py --all`（前端 Splits/總覽讀 bundle）
- 單場題材：`python scripts/build_insights.py`（逐場 bundle＋box → `wolves_team_games/{date}.insights`，0 request，全部場次約 20 秒、只寫有變的；每日抓取有新場次自動跑；也算歷史定位標籤 `insights.marks`；改 `nba_common.INSIGHT_*` 門檻後先 `--dry-run --date …` 再重算，並把 `cache.js` 的 `CACHE_NS.gc.ver` +1）
- 賽前預覽：`python scripts/build_preview.py`（賽程檔＋30 隊數據 → `wolves_games_index/{season}_preview`，每日抓取已順跑、只多 1 個 CDN request；單獨跑 3 requests，先 `--dry-run`；對照表欄位改 `nba_common.PREVIEW_TEAM_FIELDS`＋前端 `PREVIEW_LABELS`）
- 薪資同步：`python scripts/sync_salary.py`（Google Sheet 發佈 CSV → `wolves_salary/main`；先 `--dry-run`；每日排程已順跑；Sheet 欄位見 doc/handover.md「薪資資料」）
- 前端打包：改 `components/*.js` 後必跑 `python scripts/bundle.py`（esbuild 編 JSX＋Tailwind 產 CSS＋index.html 蓋版本號；勿手改 dist/；新電腦先 `npm ci`）
- 網站圖示：改 `icons/icon.svg`／`icon-maskable.svg`／`og-image.svg`（分享預覽圖）後跑 `python scripts/build_icons.py`（resvg 產 apple-touch-icon、manifest PNG 與 `og-image.png`，一起提交）；刊頭站徽同一張，favicon 仍是 index.html 內嵌的 W
- 本地預覽：`python -m http.server 8000`（Firestore lite 走 REST，localhost 可讀）
- **自動化測試**：`python scripts/run_tests.py`（`--py`／`--js` 只跑一邊；用 Python312 跑；0 個 NBA／Firestore request）。後端 `tests/py`（unittest：賽別、時區、名次、逐場對帳、抓取流程假資料 `fake_nba.py`、前後端契約）、前端 `tests/js`（node:test，載入 `dist/components-bundle.js` 測上線程式：GameAgg、Cache、格式化、日期、引用籃、CapCalc）；`bundle.py` 打包完自動跑前端測試（失敗只警告，`--no-test` 略過）。改抓取流程、季平均規則、快取、薪資計算、前後端成對規則後必跑；新增「兩邊一起改」的規則要在 `tests/py/test_contracts.py` 加一條；測試的本地輸出一律導到暫存（`WOLVES_LOCAL_DIR`），不可寫進 `_local/`

### 色票與介面規則

- 主色（進攻/選中/圖表主線/命中）：`#12A150`  · 結構藍（切換/連結）：`#236192`
- 底色：`#0A1626`  · 月光銀（logo 環/標題底線 `/30`）：`#C4CED2`  · 防守/未命中/負值：`#EF4444`
- 無障礙（WCAG AA）：`tailwind.config.js` 已把 slate-500/600 調亮（只當文字色）；品牌色當底時字用 `#0A1626`；`#236192` 不可當小字色；按鈕框 ≥ 24×24 且不重疊（「?」鈕不可用左右負邊距）
- 字體：`font-sans` Noto Sans TC／`font-display` Barlow Condensed（數字/標題）／`font-mono` JetBrains Mono（標籤/原文）；共用介面元件在 `components/ui.js`（`window.UI`：Section/StatCell/Ledger/PctBar/DataTable/Seg/TabBar/Chip/Note），新區塊一律用它組；可橫捲表格裡的展開列一律用 `UI.ExpandRow`（否則手機上內容跟著整張表攤開、落到畫面外）；第一欄很長的表（如五人陣容）給 `DataTable` 加 `stackFirst`（手機第一欄獨占一行，數字欄不橫捲）；自訂的橫捲容器加 `style={UI.scrollHint}`（右緣捲動陰影，`DataTable` 已內建）；只給真的有 percentile 的資料畫百分位條
- 介面規則：複製引用收進「?」小卡（`UI.Info` 帶 `cite` 函式），不另放複製圖示；加入引用籃也在同一張小卡（`UI.Info` 帶 `quote`，`StatCell` 自動組，資料與排版在 `quoteFormat.js` 的 `window.Quote`，格式規則見 doc/handover.md；段標頭預設不加「●」——使用者文章的「●」是小節標題；抽屜預覽依 `Quote.renderBlocks` 分段、每段可單獨複製，手機也有）；`StatCell` 數值經 `UI.cellNum` 補齊小數位（-14.0%、54.0%），自組引用數值也要套用，不可直接塞四捨五入後的數字；名次以外的補充（歷史定位等）放項目的 `note`、不可黏進數值字串（否則「不帶名次」拿不掉）；手機版不放逐列「?」等次要按鈕，改給整組操作；聯盟名次只給全隊與球員的當季快照格（`StatCell rank={window.leagueRank(類別, 欄位)} rankWhy={window.rankWhy(類別, 欄位)}`，`window.RankCtx` 由 App 設定，`kind` 分 team／player；球員前 30 名綠字），逐球自算或期間平均的格子不掛；攻守切換只在 `TABS` 標 `sided` 的章節出現；平鋪指標清單用 `window.metricLabel(m)`（有 `longLabel` 優先）；Playtype 類型名用 `window.ptName(type)`（中文＋小字原文）；一位小數用 `window.fix1`（不出現 `-0.0`）、帶正負號用 `window.fixSigned`（四捨五入後是 0 就不帶號，不出現 `+0.0`）；`isNum`／`round1`／樣本標準差用 `window.Num`，不在各檔另寫；有逐場資料的防守群組列在 `window.GAME_DEFENSE_IDS`；預設一律看進行中賽季，不自動切到舊賽季（`selectedSeasonKey` 不存 localStorage，舊賽季只靠網址 `s=`）
- 全域期間（`periodFilter.js` 的 `window.Period`、介面 `PeriodControl.js`，狀態在 App、網址 `pd=`／`c=`、不存 localStorage、換賽季或賽別回全季）：新區塊資料來自逐場 bundle／逐球就吃 `periodCtx`／`periodDates`，來自整季快照就包 `UI.Locked on={periodOn}`（變淡、標「整季數據 · 篩選時停用」、`inert` 不能點）——**不可默默顯示沒篩選的數字**；新章節跟得上期間要在 `TABS` 標 `period: true`；期間數字的引用由 `CiteCtx.period` 自動附上
- 統一規則：分頁列一律用 `UI.TabBar`（章節列／薪資頁／單場頁共用）；數字鍵切「目前畫面的分頁列」（主畫面章節由 App 處理、獨立整頁用 `UI.useTabKeys`，沒有分頁列的對戰頁不作用）；同一個控制只放一處（跨季疊圖賽別跟刊頭；全域期間篩選例外：**桌機膠囊在章節列右側、手機在身分列**，每種裝置仍只有一處）；攻守切換標「進攻端／防守端」，不和「防守」章節同字；`UI.Section` 右側操作手機上會自行換行，不可再加會撐寬頁面的固定寬度

### 硬性約束（完整說明）

- 抓取邏輯與欄位對應集中在 `scripts/nba_common.py`——**新增數據改設定表（`*_FIELDS`），快照新增類別改 `TEAM_SNAPSHOT_CATEGORIES`／`PLAYER_SNAPSHOT_CATEGORIES`（每日與歷史回補共用），不要在 fetch_data.py / backfill_history.py / backfill_games.py 寫重複邏輯**；賽別鍵轉換一律 `nc.season_type("regular"|"playoffs"|"playin")`／反查 `nc.type_key_of()`（**附加賽 `playin` 只有單場**：索引／bundle／投籃點 `{season}_playin`，不寫快照、不進例行或季後的任何平均；有快照的賽別在 `SNAPSHOT_TYPE_KEYS`）；美東時間一律 `nc.now_east()`（zoneinfo，含夏令，需 `tzdata` 套件，缺了退回手寫夏令規則），不可再寫 `utcnow() - 5h`
- **賽季不寫死**：資料賽季 `nba_common.get_current_season()` ＝ 前端 `constants.js` 的 `seasonForDate()`（美東 10/20 切換，兩邊同規則，改界線要一起改）；名冊／薪資賽季 `get_roster_season()` ＝ 前端 `capSeasonForDate()`（7/1 切換，新援判定與薪資當季用）
- 每日快照球員以 playerName 為 key；歷史快照以 PlayerID 為 key（前端 `normalizeHistoryPlayer` 對齊，已展開 base/tracking/shooting/clutch/defense/onoff 各類別），勿更動
- 每日文件欄位：`stats`(Synergy)/`base`/`tracking`/`shooting`/`clutch`/`defense`/`lineups`/`onoff`/`advanced`/`scoring`（球員 `advanced`＝整季進階、`scoring`＝得分組成，2026-11-12 起；全隊 `advanced`＝全隊進階），全隊另有 `ranks`（30 隊名次 `{類別: {欄位: 名次, _n}}`，2026-10-28 起、只有當季）；球員文件 2026-11-13 起也有 `ranks`（`{類別: {球員名: {欄位: 名次}}, _n, _meta, _ref, _rules}`，見 doc/handover.md），新增欄位記得併入 `fetch_data.py` 的 `DATA_KEYS`（去重）；`shooting` 2026-11-13 起只有分區命中（投籃拆分已停抓，出手占比等由逐場 base 算）
- **聯盟名次**：全隊類別抓取一律 `team_id=0` 拿 30 隊再經 `split_league()` 拆灰狼＋名次（請求數不變）；新增全隊欄位要判斷方向，越低越好加進 `nba_common.RANK_LOWER_BETTER`、不該排名加進 `RANK_SKIP`。球隊 Playtype 名次由百分位換算（`window.ptRank`），球員百分位不可換算。**球員名次**由 `nba_common.player_league_ranks()` 在每日抓取時用全聯盟原始資料算（0 額外 request，最近防守者與防守 box 因此抓全聯盟）；門檻在 `PLAYER_RANK_RULES`（出賽 ≥ 70%、每場 ≥ 15 分鐘；投籃／真實／有效 ≥ 5、三分 ≥ 3、罰球 ≥ 2 次出手），新增命中率類欄位要在 `PLAYER_RANK_ATT_PAIRS` 加出手欄
- **新 Firestore 集合必加安全規則 read 白名單**（Firebase Console，見 doc/handover.md）——已踩過多次，症狀是前端 `Missing or insufficient permissions`
- **新 Firestore 集合必加 `*` 索引豁免**（Console → 索引 → 自動 → 豁免項目）；所有集合都已豁免，**只能用文件 ID 範圍／getDoc／整集合讀取**，依欄位查詢會回 `requires an index`。專案是 Blaze 方案（超過免費額度會計費，不會停擺）
- .bat 檔必須 CRLF（`.gitattributes` 固定，三支 `run_*.bat` 已進版控）、`chcp 65001`、無中文註解；排程用 Python 絕對路徑（`Python312`，裸 `python` 會解析到沒套件的版本）；`run_fetch.bat` 會把超過 2 MB 的 `fetch_log.txt` 封存到 `_local/logs/`；本機雜物（回補驗證檔、舊 log、除錯腳本）一律放 `_local/`，不堆在根目錄；`dist/*.map` 不進版控
- 不用 GitHub Actions（機房 IP 被 NBA 擋）；正式排程為 Windows Task Scheduler
- 逐球員 endpoint（shotchartdetail）整季逐球員只能低頻執行（每週）；每日只准用「單場全隊」查詢（`GameID`＋`PlayerID=0`，每場 1 request）；games 回補分批、每場約 20 requests，避免被 NBA 封鎖（症狀是 403/429；零星 500/503 是伺服器抖動非封鎖；**全部逾時多半是瀏覽器指紋被 Akamai 擋**，`nba_common.FINGERPRINTS` 會自動換、記在 `nba_fingerprint.json`，log 看 `🔁`，見 doc/handover.md FAQ「NBA API 跑失敗」）
- Pages 部署偶發 `Deployment failed, try again later`（GitHub 暫時性）→ `gh run rerun <id>` 重跑即可
- **薪資：Google Sheet 是唯一資料來源**（`_salary_seed/` 只是本地參考、不提交）；**計算只在前端 `CapCalc`**，`sync_salary.py` 只檢查與對帳；門檻、稅率、限制條文、選秀權、繳稅紀錄都放 Sheet，不寫死。apron 空間用 apron 薪資（含 unlikely incentives）
- **快照的球員數據是整季合併**（含季中轉隊前在他隊的比賽）：要「只算灰狼」的累計值一律用逐場 bundle
- **前端 localStorage 快取一律走 `window.Cache`（`components/cache.js`，2026-11-19 起）**，不可自己 `localStorage.setItem` 存資料；換版只改 `CACHE_NS` 的 `ver`：清理 Firestore 單場資料或單場文件新增前端要讀的欄位 → `gc` +1；**歷史快照有任何回補（加欄位或重跑 `backfill_history.py`）→ `hist` +1**；開站時自動清掉過期、舊版與舊格式的鍵，存滿時從最舊的刪起。偏好（`wt_pref_*`、`wt_radar_axes_*`）與引用籃（`wt_quote_*`）不是快取、不經 Cache
- 介面標籤用中性字眼，不可貶低對手球隊或球員（對戰分析標籤：勁敵／順手／棘手）

### 前端架構、各頁網址與資料層

- `components/*.js` 掛 `window.*`，`bundle.py` 依 ORDER 串接 → esbuild（es2018、不改名識別字）→ `dist/components-bundle.js`；Tailwind CLI → `dist/app.css`。class 必須完整寫在原始碼（不可字串拼接，否則 CLI 掃不到）
- 提交前端改動要連 `dist/` 與 `index.html`（`?v=` 內容雜湊）一起提交
- 圖表一律自繪 SVG（雷達 `RadarSvg`、疊圖 `LineOverlay` 等），不引入圖表套件（Recharts 已於 2026-10-28 移除，省約 120 KB gzip）
- **開站首頁＝最新一場單場頁**（網址沒帶畫面時；當季未開打退上一季最後一場，`homePending` 期間不寫網址）
- 版面（無側欄）：刊頭 `Masthead`（左：字標＋**「資料」群組**＝賽季下拉＋例行／季後，只在主畫面；右：頁面入口 賽程月曆 `GameCalendar`・對戰・組合・薪資｜搜尋；手機三列＝字標＋搜尋／資料群組／入口一排四格；沒有「複製連結」，2026-11-19 移除）→ 頭像列 `RosterRail`（全隊＋球員）→ 身分列 `IdentityBar`（**季別標籤**「2026-27 例行賽」純標示、手機也顯示；戰績；全隊且該季有附加賽時「附加賽 N 勝 N 敗 ↗」膠囊；時光機「數據截至」，僅當季）→ 章節列 `ChapterNav`（sticky；攻守切換只在 `TABS` 標 `sided` 的章節＝Playtype，總覽 2026-11-20 起不顯示；**黏頂時左側出現季別小標籤**「26-27 例行」，點了回頁首）→ 六章節：總覽(`OverviewTab`，含雷達)/Splits(`SplitsTab`)/投籃(`ShootingTab`)/防守/Playtype/跨季(`ComparisonTab`＋`SeasonPaceChart`)
- 單場比賽頁 `GamePage`（`#game=日期[&tab=box|compare|shots|pt][&bx=adv][&p=球員]`，獨立整頁；**附加賽場次**（`window.gameTypeOfId`／`typeKeyOfLabel`）：比分看板加「附加賽」膠囊、賽程條只列附加賽、「本場 vs 例行賽平均」（`avgType`）、球員連結帶回例行賽、沒有本場題材與歷史定位、引用標頭寫「附加賽」不寫 G 場次；開站首頁「最新一場」也算附加賽（例行賽期間預覽文件有已開打的 005 場次才多讀附加賽索引），取代主區，**不掛章節列**、用「← 回主畫面」返回）：賽程條＋比分看板常駐（手機另有精簡比分區），下方單場分頁 概要（本場焦點→本場題材→本場 vs 季平均，題材讀單場文件 `insights`、文案在前端組；本場 vs 季平均只在灰狼場次前 3 名的格子標「灰狼第 N 高」（`insights.marks`），Box Score 展開列「?」點開才讀該員各季 bundle 算歷史定位，門檻 `HISTORY_RULES`，與 `INSIGHT_MARK_RULES` 的 min_att／min_n 同值）／Box Score／對比／投籃／Playtype（全隊單場 Playtype，`GamePlaytype.js`，單場文件有 `playtype` 才出現）（沒內容的分頁不顯示、舊場次無 box 時第二頁叫「球員進階」；`p=` 只在 Box Score，舊連結只帶 `p=` 視為 `tab=box`；賽程條換場次保留分頁與 `bx`）；Box Score「傳統｜進階」（`bx=adv`，進階 box＋灰狼「不在場」，2026-27 起才有，舊場次不出現切換）；對手球員列點開只有本場數據一行可加入引用籃（主體「名字（拓荒者）」，展開狀態不寫網址）；球員效率一律是**在場**效率，不在場只能用單場 On/Off 官方數字、不可由全隊減在場推算；賽程月曆讀 `loadSeasonSchedule`（例行＋季後合併），單場頁跟著該場賽季、其餘跟刊頭所選賽季；**預覽模式**：沒有單場文件、但當季預覽文件（`gamesData.loadPreview`）有這天 → `PreviewPanel`（雙方對照＋英文序數名次 `window.ordinal`、交手、近況），賽程條尾端「下一場」卡、月曆未開打格子（虛框）也來自預覽文件；灰狼球員一律用 box `personId` 對 players 文件 `playerId`，不用名字；點指標一律跳 Splits 逐場走勢（`m=`/`hl=`）
- 薪資頁 `CapPage`（`#cap[&s=賽季][&tab=contracts|picks|rules]`，獨立整頁）：四分頁＋分頁列上唯一的賽季選單（刊頭在薪資頁隱藏賽季／賽別／日期）；狀態資訊用狀態列＋色點，膠囊只給可點控制項；縮寫金額要能懸停看完整金額；球員對應一律用 `playerId`；薪資×表現可用 Sheet `settings.show_value` 關閉、公式常駐
- 條件戰績（全域期間面板的「條件」，編輯器在 `PeriodControl.js`；符合／其他／全季戰績摘要在 Splits）：計算在 `splitConditions.js` 的 `window.SplitCond`（以全隊逐場為母體篩選、未出賽只算在隊期間＝從第一次出賽起，當季仍在名冊上的算到最新一場、歷史賽季最後一次出賽在交易截止日後的才算到季末），門檻在 `constants.js` 的 `CONDITION_RULES`；跟著所選賽季、最多 2 個條件；當季名冊由 App 以 `periodCtx.rosterIds` 傳入
- 組合數據 `LineupsPage`（`#lineups[&n=2|3|5][&p=ID-名字~…][&min=][&view=mx][&s=][&t=]`，獨立整頁）：只讀組合文件（`gamesData.loadLineups`，歷史賽季快取 `Cache` 的 `lu`）；時光機管不到、頁首自己寫截至日；最少分鐘預設二人／三人 50、五人 10（`LINEUP_MIN_DEFAULT`）
- 球員比較 `ComparePage`（`#cmp=ID-名字~ID-名字[&sa=][&sb=][&t=][&per=36][&pd=][&m=]`，獨立整頁）：計算全在 `compareData.js` 的 `window.Compare`（數值只算灰狼場次；每 36 分鐘只換算次數類；差距最大＝差距 ÷ 兩人逐場波動、只寫「較高」）；兩人可各選賽季，球員名單取該季組合文件；入口身分列「比較」與搜尋
- 完整賽程 `SchedulePage`（`#schedule[&m=YYYY-MM][&f=home|away]`，獨立整頁，只有當季）：只讀預覽文件；桌面月曆格、手機清單；入口在小月曆底部、單場頁返回列右側、搜尋（App `canSchedule`＝有預覽文件才出現）；隊徽 `window.teamLogo`，不用 lazy
- **日期規則**：資料、網址、月曆、月份分組一律**美東**（前端 `window.etParts()`＝Intl America/New_York 含夏令，與後端 `nc.now_east()` 同規則；`seasonForDate`／`capSeasonForDate`／`getSeasonPhase`／`etToday` 都走它）；開賽時間一律經 `window.kickoffTPE`（「台北隔日 09:30」，依 utc 實算、不寫死＋1 天），美東今天用 `window.etToday()`，不要自己加減時區
- 對戰分析（`#vs` 首頁 `MatchupHome`／`#vs=三碼` 單隊頁 `MatchupPage`，獨立整頁）：計算全在 `matchupData.js` 的 `window.Matchup`（只讀既有逐場 bundle＋交手場次單場文件）；範圍預設近三季（當季例行賽未滿 41 場多含一季）、`r=`／`t=` 不影響主畫面賽季；排序上色看偏離程度 z（差距 ÷ 逐場標準差/√n）；門檻全在 `constants.js` 的 `MATCHUP_RULES`；每節分差／對手 box 只有 2025-26 起的場次
- 網址 hash 記住畫面（`urlState.js`；有 `v=` 時完全以網址為準，不退回 localStorage 偏好；球員 `p=ID-名字`（如 `1630162-anthony-edwards`，**只用 ID 對人**，`UrlState.playerToken`／`tokenPlayerId`、名字部分 `window.nameSlug`；舊連結的完整名字仍可讀）；賽季 `s=年份&t=賽別`（當季不寫 `s`；舊格式 `s=2025-26_playoffs` 仍可讀）；Splits 走勢 `m=指標&hl=日期`；全域期間 `pd=`（`W`、`last5`、`month:2026-11`、`opp:DEN`、`range:起:訖`）與條件 `c=`（如 `c=1630162:PTS:ge:30~T:TOV:le:12`，主畫面各章節都有效，`c=` 優先）；單場頁 `game=`（＋`tab=`）、薪資頁 `cap`、完整賽程 `schedule`、對戰 `vs`、組合 `lineups`、比較 `cmp` 都沒有 `v=`——**獨立整頁的參數不可叫 `v`**，否則會被當成主畫面連結）；快捷鍵 `/` 搜尋（`CommandPalette`）、數字鍵切目前畫面的分頁列（主畫面 `1–6` 章節、單場／薪資頁各自分頁）
- **資料層分工**：季平均/Splits/趨勢/對戰、總覽篩選期間時的全隊效率／個人效率／在場不在場（bundle 每場的 `adv`，2026-27 起）→ `GameAgg`(`gameAggregates.js`) 算 **bundle 逐場**（`gamesData.loadSeasonGames`，讀 `wolves_games_bundle`/`wolves_pgames_bundle` 單一 doc，避免 90+ 併發 getDoc 卡死）；Playtype/Clutch/Lineups/On-Off/防守 → 每日/歷史快照；投籃 → `wolves_shotcharts` 逐球；單場對手與 box score（含進階欄位與灰狼不在場 `OFF_*_RATING`）→ `wolves_team_games/{date}` 的 `opp`/`box`、`wolves_player_games/{date}` 的 `oppPlayers`（單場頁與對戰頁一律經 `gamesData.loadGameDocs` 讀）（2026-10 起的場次；box 另補了 2025-26）；跨季疊圖 → 各季 bundle（`GameAgg.metricOf`）＋多序列 `LineOverlay`
- 季平均加權：百分比欄以 Σ分子/Σ分母 重算（`GameAgg.RATIO_DEFS`），非平均百分比；在場效率 `ON_OFF_RATING`／`ON_DEF_RATING` 以 bundle 的 `ON_PTS`÷`ON_POSS` 加權（`ON_NET_RATING` 為兩者相減）
- 最近防守者（Defense Dashboard）：類別在 `nba_common.MATCHUP_CATEGORIES`（總體／三分／兩分／籃下 < 6 Ft，加類別加一列；單場對手只抓 `MATCHUP_OPP_CATEGORIES`）；「vs 平常」（`*_PLUSMINUS`）期間值一律用 `GameAgg.NORMAL_DEFS` 依出手數加權；小樣本門檻 `DEF_SHOT_RULES`（整季／期間 < 20 次標「樣本小」、單場 < 3 次 vs 平常不計），格子給 `att`／`signed`；逐場的「平常」是擷取當下的射手本季命中率，會漂移（見 doc/handover.md）
- 逐場重算規則都在 `GameAgg`：命中率類 `RATIO_DEFS`（含三分出手占比 `FG3A_FREQ`）、eFG `EFG_DEFS`、真實命中率 `TS_DEFS`、沒存分子的比率用 `WAVG_DEFS` 依權重欄加權（如切入助攻率 × 切入次數）；新增比率指標先決定走哪一種，不可落到逐場直接平均
- 總覽的全隊效率、個人效率（`playerAdvancedDefs`）、在場／不在場：沒篩選時顯示整季快照（含名次）；篩選期間時改用 `GameAgg.teamAdvanced`／`playerAdvanced`／`onOff` 讀 bundle 的 `adv` 重算（2026-11-20 起，公式與近似值見「各章節」總覽），沒有 `adv` 的賽季（2025-26 以前）效率類顯示「—」。得分組成（`scoringShareDefs`／`scoringSituationDefs`）只有整季快照 → 期間篩選時 `UI.Locked`；`TM_TOV_PCT` 在 API 已是百分比，欄位表不乘 100；全隊 Misc 沒有 `PFD`
- 單場 Tracking 是賽後 12 小時內擷取，NBA 之後可能補正（2026-11-12 發現開季頭 4 場切入次數少一半）；看門狗每天自動比對全隊，通知後用 `backfill_games.py --dates` 重抓（見 doc/handover.md FAQ）
- 最近防守者的「場均」分母只算有防守到出手的場次（快照另存 `D_GP`）：「樣本小 · N 次」用場均 × `D_GP`，不可用 base 出賽場數
- 單場數值讀進來一律經 `cleanGameStats`／`cleanGameDoc`（`gamesData.js`）：NBA 未釋出時回的 C&S／Pull Up「整組 0」（同時缺 `TOUCHES`）與 0 分母命中率清成 `null` 顯示「—」，不當真的 0；新增讀 bundle／單場文件的地方要套用。抓取端同規則 `nba_common.tracking_zero_filled` 標 `partial` 讓每日補抓重抓，改規則兩邊一起改
- 當季快照先只讀近期（`snapshotWindowStart`），選日期／開走勢／賽別不足時才補讀整季（`snapFull`）；Firestore 只用 doc id **升冪範圍**查詢（`orderBy desc`／`limitToLast` 需索引會被拒）；前端用 **Firestore lite**（沒有 `onSnapshot`，一律 `getDoc`／`getDocs` 並接住錯誤）
- 場數少於 `SMALL_SAMPLE_GAMES`（10）時用 `window.smallSampleNote` 提示樣本小（Playtype、單場頁季平均）
- 次數類指標（觸球、切入次數等）在 defs 加 `neutral: true`：單場頁／疊圖不標好壞色
- 讀 Firestore 的 effect 必等匿名登入（`isCloud`），否則被安全規則拒絕且錯誤不會自動清掉
- 複製引用格式含當下畫面網址（`UI.citeLine`）；PageSpeed 效能分數是推算、會跳動，以實測與無障礙/傳輸量為準（見 doc/handover.md「效能與無障礙」）
- 刊頭賽季選單只列年份（`SEASON_YEAR_OPTIONS`），例行/季後切換常駐（預設依時節，歷史賽季也能切；App `changeYear`/`changeType` 對回 `selectedSeasonKey`＋`seasonTypeView`，網址格式不變）；時光機（截至某日，影響所有章節）在身分列，不在刊頭；雷達軸自選在 `RadarPanel`

---

## 專案檔案結構

```
wolvestracker/
├── index.html                       ← HTML 骨架 + Firebase 初始化，引用 dist/components-bundle.js
├── components/                      ← React 元件原始碼（編輯這裡）
│   ├── Icons.js                     ← SVG icon set，掛 window.Icons
│   ├── cache.js                     ← 前端 localStorage 快取 window.Cache（CACHE_NS 命名空間與版本、開站清理、存滿刪最舊）
│   ├── ui.js                        ← 設計系統 window.UI（StatCell/Ledger/DataTable/Seg/TabBar/Section/PctBar、複製引用、匯出）
│   ├── quoteFormat.js               ← 引用籃資料層＋貼文排版 window.Quote（不含 JSX，可用 Node 測 render）
│   ├── QuoteBasket.js               ← 引用籃右下角浮動鈕＋抽屜（排序／合併／格式選項／複製）
│   ├── glossary.js                  ← 指標定義 window.GLOSSARY（「?」小卡內容）
│   ├── constants.js                 ← 標籤與 defs / SEASON_OPTIONS / getSeasonPhase / 快照讀取範圍（SNAPSHOT_SINCE/UNTIL、snapshotWindowStart）/ nameKey、nameSlug / 聯盟名次 RankCtx、leagueRank、ptRank
│   ├── MetricComponents.js / PlayTypeCard.js / PlaytypeSection.js / TrackingCardRow.js
│   ├── ShotChart.js / DefenseHeatmap.js ← 投籃熱圖、防守熱圖
│   ├── gameAggregates.js / gamesData.js ← GameAgg 逐場重算、bundle／索引／單場文件（loadGameDocs）／賽前預覽（loadPreview）載入
│   ├── splitConditions.js           ← 條件戰績資料層 window.SplitCond（條件篩選、在隊期間、戰績摘要、網址 c=）
│   ├── periodFilter.js              ← 全域期間 window.Period（apply、網址 pd=／c=、條件需要的逐場）
│   ├── compareData.js               ← 球員比較計算 window.Compare（分組、每 36 分鐘、差距最大、走勢）
│   ├── matchupData.js               ← 對戰分析資料層 window.Matchup（範圍、對手彙整、偏離程度 z、標籤、勝負關鍵因子）
│   ├── SingleGamePanel.js / Highlights.js ← 單場面板、近期異動
│   ├── GamePage.js                  ← 單場比賽頁（#game=日期[&tab=]，單場分頁；未開打場次改畫 PreviewPanel）
│   ├── GamePlaytype.js              ← 單場頁 Playtype 分頁（window.GamePT 純計算＋GamePlaytypeSection，tab=pt）
│   ├── PreviewPanel.js              ← 賽前預覽模式（看板、雙方對照、交手、近況）
│   ├── SchedulePage.js              ← 完整賽程（#schedule：桌面月曆格／手機清單）
│   ├── LineupsPage.js               ← 組合數據（#lineups：二人／三人／五人、含球員篩選、矩陣）
│   ├── ComparePage.js               ← 球員比較（#cmp：差距最大、逐項對照、兩人同場、走勢、Playtype）
│   ├── CapPage.js                   ← 薪資頁（#cap）：CapCalc 計算、loadCapDoc／loadCapContrib 載入、各分頁區塊
│   ├── MatchupHome.js / MatchupPage.js ← 對戰首頁（#vs）、單隊對戰頁（#vs=三碼）
│   ├── OverviewTab.js / SplitsTab.js / ShootingTab.js / ComparisonTab.js / RadarPanel.js / HistoryModal.js
│   ├── SeasonPaceChart.js           ← 疊圖：LineOverlay（通用多序列折線）＋ SeasonPaceChart（賽季軌跡）
│   ├── urlState.js                  ← 網址 hash 讀寫
│   ├── Masthead.js / GameCalendar.js / RosterRail.js / IdentityBar.js / ChapterNav.js / CommandPalette.js ← 版面骨架、賽程月曆與快速搜尋
│   ├── PeriodControl.js             ← 全域期間的膠囊／面板（含條件編輯器）／手機提示列
│   ├── appLogic.js                  ← App 的純計算 window.AppLogic（歷史快照轉換、快照定位與取值、季別提示、名單排序、防守缺資料說明、薪資膠囊、未開打場次、附加賽摘要、組合／比較頁狀態更新；有測試）
│   ├── appData.js                   ← App 的資料載入 hooks：useCloudReady、useSeasonSnapshots（當季／歷史快照、跨季比較與雷達疊加）、useScheduleData（比賽索引、賽程、賽前預覽）、useSeasonGames（逐場 bundle、條件戰績逐場）
│   ├── appRoute.js                  ← 獨立整頁路由 useRouteState（單場／薪資／完整賽程／組合／比較／對戰的狀態、進出、網址）＋開站首頁＝最新一場
│   └── App.js                       ← 主畫面：狀態、網址同步（主畫面部分）、期間與引用情境、畫面組裝（2026-11-19 由 1,506 行拆成約 900 行）
├── styles/app.css                   ← Tailwind 入口＋全站基礎樣式（背景、焦點框、減少動態）
├── tailwind.config.js               ← 字體、slate-500/600 對比調整
├── package.json / package-lock.json ← 鎖定 esbuild、tailwindcss、@resvg/resvg-js 版本（npm ci）
├── manifest.webmanifest             ← PWA 設定（名稱、standalone、圖示清單）
├── icons/                           ← 網站圖示：icon.svg／icon-maskable.svg 原稿＋build_icons.py 產的 PNG
├── dist/
│   ├── components-bundle.js         ← 自動產生，勿手改（同目錄的 .map 只留本機除錯，不進版控）
│   └── app.css                      ← 自動產生，勿手改
├── scripts/
│   ├── nba_common.py                ← 共用模組：SESSION/重試/欄位設定表/所有抓取函式
│   ├── fetch_data.py                ← 每日當季數據爬蟲（含寫入前去重；--games-only 只抓單場；執行結果寫 fetch_status.json）
│   ├── watchdog.py                  ← 每日抓取看門狗（15:00 檢查、分級補抓、最後逐場對帳、桌面通知；--dry-run／--test-notify／--check-data）
│   ├── backfill_history.py          ← 歷史賽季回補腳本（import nba_common；--only-hustle／--only-team-matchup／--only-matchup／--only-adv-scoring／--only-lineups 只補單項）
│   ├── fetch_shotchart.py           ← 投籃熱圖爬蟲（每週，逐球員 + 全隊）
│   ├── backfill_games.py            ← 單場數據回補（DateFrom=DateTo 逐場；--index-only 產索引；--box-only 只補 box score；--adv-only 已有 box 的場次只補進階＋單場 On/Off；--matchup-only 只補灰狼球員的最近防守者指定類別；--clean-players 對帳剔除非當時隊員）
│   ├── sync_salary.py               ← 薪資同步：Google Sheet 發佈的 CSV → wolves_salary/main（每日排程順跑）
│   ├── build_preview.py             ← 賽前預覽：賽程檔＋30 隊數據 → wolves_games_index/{season}_preview（每日由 fetch_data 呼叫；--dry-run）
│   ├── build_insights.py            ← 單場題材：逐場 bundle＋box → wolves_team_games/{date}.insights（每日由 fetch_data 呼叫；--date／--season／--dry-run）
│   ├── build_icons.py               ← 網站圖示：icons/*.svg → apple-touch-icon／manifest 用 PNG
│   ├── run_tests.py                 ← 自動化測試入口（tests/py＋tests/js）
│   └── bundle.py                    ← 前端打包（合併＋esbuild＋Tailwind＋版本號；打包完自動跑前端測試）
├── tests/                           ← py/（unittest，含 fake_nba.py 假資料抓取、test_contracts.py 前後端契約）、js/（node:test，load_bundle.js 載入打包檔）、fixtures/（薪資快照）
├── .gitattributes                   ← *.bat 固定 CRLF（git 取出時自動轉）
├── run_fetch.bat                    ← Windows 排程：當日數據＋薪資同步；fetch_log.txt 超過 2 MB 先封存到 _local/logs/（2026-11-19 起進版控）
├── run_watchdog.bat                 ← Windows 排程：看門狗（參數原樣傳給 watchdog.py，可手動 `run_watchdog.bat --dry-run`）
├── fetch_status.json                ← fetch_data.py 執行結果（看門狗讀；本機產物，不進版控）
├── watchdog_log.txt                 ← 看門狗每日一行結論（watchdog_err.log 收未捕捉例外；皆不進版控）
├── _salary_seed/                    ← 薪資 Sheet 的本地參考副本（未進版控；Sheet 才是資料來源）
├── run_shotchart.bat                ← Windows 排程：每週投籃熱圖
├── _local/                          ← 本機雜物（不進版控）：backfill/ 回補驗證檔（backfill_history.py 寫這裡）、logs/ 舊 log 與封存的 fetch_log、debug/ 早期除錯腳本
└── doc/
    ├── handover.md                  ← 本文件（現況）
    └── history.md                   ← 開發紀錄（各功能設計過程、使用者確認過的決定、已完成項目、更新紀錄）
```

---

## 開發工作流程

### 自動化測試（2026-11-19 起）
- 執行：`python scripts/run_tests.py`（用排程的 Python312；`--py` 只跑後端與契約、`--js` 只跑前端）。全部 0 個 NBA／Firestore request，約 25 秒
- 零新依賴：後端 Python 標準庫 `unittest`、前端 Node 內建 `node:test`
- **前端測的是打包檔**：`tests/js/load_bundle.js` 在 Node 沙盒載入 `dist/components-bundle.js`（React／ReactDOM／document 換空殼、localStorage 換假的，可設 `quotaChars` 模擬存滿），所有 `window.*` 純邏輯都能直接呼叫。改了 `components/*.js` 要先 `bundle.py`；`bundle.py` 打包完自動跑前端測試（失敗只印警告、不擋打包，`--no-test` 略過）
- 後端 `tests/py/`：
  - `test_season_type.py` 賽別判斷（合成賽程：例行／季後寬限、總冠軍封王、附加賽、賽程檔換季、日期後備）
  - `test_now_east.py` 美東時間（zoneinfo vs 手寫夏令規則逐時比對 2024–2030、夏令切換、賽季界線）
  - `test_ranks.py` 全隊／球員聯盟名次（方向、並列、RANK_SKIP、合格門檻、出手門檻、參考名次）
  - `test_consistency.py` 逐場對帳（少抓才算異常、多的只記 over、快照未涵蓋的場次不比）
  - `test_fetch_flow.py`＋`fake_nba.py` 抓取流程假資料（每日、只抓單場、強制快照、附加賽期間、季後賽首日補附加賽、歷史回補）：寫入哪些文件與結構、request 清單、旁路呼叫；**新增快照類別沒加進 `DATA_KEYS` 會失敗**；本地輸出經 `WOLVES_LOCAL_DIR` 導到暫存
  - `test_contracts.py` 前後端成對規則（同一組時間點兩邊算出的資料賽季／名冊賽季／美東日期、賽別標籤與 gameId 前綴、`INSIGHT_MARK_RULES`＝`HISTORY_RULES`、`tracking_zero_filled`⇔`cleanGameStats`、單場 `playtype` 欄位⇔`GamePT.derive` 與 `tab=pt`）；`test_game_playtype.py` 單場 Playtype 相減與寫入（假 Firestore）；前端 `gamept.test.js` 單場 Playtype 計算；`tests/js/eval_bundle.js` 讓 Python 在 Node 沙盒裡呼叫前端函式
- 前端 `tests/js/*.test.js`：`applogic`（App 拆出的純計算：歷史快照轉換、PlayerID 取法、名單排序、季別提示、防守缺資料、薪資膠囊、附加賽摘要、組合／比較頁狀態）、`gameagg`（Σ分子/Σ分母、eFG、TS、加權、在場效率、vs 平常）、`cache`（到期、開站清理、存滿刪最舊、私密模式）、`format`（fix1／fixSigned／Num／cellNum）、`dates`（含夏令的賽季界線、賽別小工具）、`quote`（貼文格式）、`capcalc`（合成資料手算＋`tests/fixtures/salary_main_2026-11-19.json` 真實快照：兩種總額與 Sheet 的 Spotrac 參考值逐元相符、層級與繳稅紀錄一致、2024-25 稅額手算核對）
- 每批都做過「故意改壞」檢查（拿掉 `DATA_KEYS` 一欄、寬限天數改 0、季平均改逐場平均），測試都會失敗
- 加測試：後端照 `test_*.py` 放 `tests/py/`（開頭 `import _common` 取得 scripts 路徑）；前端放 `tests/js/*.test.js`。沙盒建立的陣列／物件原型和 Node 主環境不同，`deepEqual` 前先 `JSON.parse(JSON.stringify(x))`

### 編輯前端
0. 新電腦第一次：專案根目錄跑 `npm ci`（依 `package-lock.json` 安裝鎖定版本的 esbuild / tailwindcss / resvg 到 `node_modules/`，不進版控）
   - 只有改網站圖示（`icons/*.svg`）時才需要另跑 `python scripts/build_icons.py`，並提交產出的 PNG
1. 改 `components/*.js`
2. `python scripts/bundle.py` 重新打包（合併 → esbuild 編譯 JSX → Tailwind 產 CSS → 蓋版本號）
3. `python -m http.server 8000` 啟動本地伺服器
4. 瀏覽器開 `http://localhost:8000`，Ctrl+F5 強制重整
5. 確認無誤後 commit `components/`、`dist/`（`components-bundle.js`、`app.css`；`.map` 已被 .gitignore 排除）與 `index.html`，推送 GitHub Pages
   - `bundle.py` 每次會把產物內容雜湊寫進 `index.html` 的 `components-bundle.js?v=…`、`app.css?v=…`（Pages 一律快取 10 分鐘，不加版本號會出現「新 HTML＋舊檔」）——所以 `index.html` 也會有 diff，記得一起提交

### 前端建置（2026-10 起預先編譯）
- 以前：瀏覽器載入 Babel Standalone（約 2.3 MB）即時編譯 JSX、Tailwind CDN（約 400 KB）即時產 CSS。現在兩者都在 `bundle.py` 事先做完，首次造訪少下載約 667 KB（壓縮後），掛載時間約 740ms → 約 100ms
- `dist/components-bundle.js`：esbuild `--target=es2018`（`?.`／`??` 會降級，舊手機也能跑），只壓空白與語法、**不改名識別字**（元件靠頂層名稱與 `window.*` 互相引用）；`.map` 以 `--sourcemap=external` 產在 `dist/` 供本機除錯對照原始碼（bundle 不帶 `sourceMappingURL`、不進版控，線上不提供）
- `dist/app.css`：Tailwind 3 CLI 掃 `components/**/*.js` 與 `index.html`，只輸出用到的 class。**class 必須完整寫在原始碼**，不可字串拼接（`text-${c}-400` 會掃不到）
- `index.html` 的 bundle 用 `<script defer>`：與 `type="module"` 的 Firebase 初始化同屬「解析完依序執行」，保證元件在 Firebase 之後執行
- 合併後未編譯的 JSX 暫存在 `.build/`（不進版控）

### 版面骨架與網址狀態（2026-10 Phase 3）
- **開站首頁＝最新一場單場頁**（2026-10-23）：網址沒帶畫面時 App `homePending` → `loadSeasonSchedule(CURRENT_SEASON)` 取最後一場開單場頁；當季未開打就推算上一季（不讀手動維護的 `HISTORY_SEASONS`）；找的期間不寫網址、主區顯示「載入最新一場…」；連不上雲端 8 秒後退回總覽；`hashchange` 會取消 pending。分享連結（`v=`/`game=`/`cap`）不受影響
- 由上而下：`Masthead`（2026-11-19 改版：左＝字標、期別行（主畫面只寫「灰狼數據帳本 · 連線狀態」）、「資料」群組＝賽季下拉（只列年份）＋例行·季後（常駐，只在主畫面）；右＝頁面入口 賽程月曆 `GameCalendar`（`navStyle`）・對戰・組合・薪資｜搜尋。手機三列：字標＋搜尋／資料群組占滿一列／入口一排四格；lg 以上單列，1024～1279 賽程膠囊省對手縮寫。「複製連結」已移除）→ 休賽/陳舊細條 → `RosterRail`（全隊＋球員頭像 chips，尾端「本季無數據」淡色 chips：當季只提示＋「查看最近一季」按鈕，歷史賽季才直接 `jumpToPlayerHistory` 探測）→ `IdentityBar`（4 個主數字，與總覽同源 `GameAgg.seasonToDate`；時光機「數據截至」日期＋「回最新」，僅當季，2026-10-23 從刊頭搬來——它影響所有章節，放每章都看得到的地方）→ `ChapterNav`（`UI.TabBar`，sticky，01–06 章節＋攻守視角「進攻端／防守端」；攻守只在 `TABS` 標 `sided` 的章節顯示）→ 內容。單場／薪資／對戰是獨立整頁，**不掛章節列**，左上「← 回主畫面」（App `backBtn`）
- 舊左側欄已移除；雷達＋疊加比較由 App 組成 `radarSlot` 傳入 `OverviewTab`
- 網址 hash（`components/urlState.js`）：`#v=player&p=1630183-jaden-mcdaniels&tab=shooting&s=2024-25&t=playoffs&d=2026-06-15&side=def`，只寫非預設值；**有 `v=` 時完全以網址為準**，沒寫的項目＝預設（當季/總覽/進攻/最新日），不退回 localStorage——否則同一條連結會因電腦不同而開出不同畫面
- **2026-10-19 新增**：
  - `c`＝Splits 條件戰績（僅 `tab=splits`，2026-11-04）：`c=1630162:PTS:ge:30~T:TOV:le:12`；App 的 `splitCond`（`hashchange` 同步），SplitsTab 只回報完整條件、離開「條件」期間清掉。格式見history.md「2026-11-04 條件戰績」
  - `m`＝Splits 打開逐場走勢的指標 key、`hl`＝走勢上圈出的那一場日期（僅 `tab=splits`）。App 以 `focus = {m, hl, key}` 保存，`key`＝「實體＋章節」：Splits 內換球員保留 `m`、拿掉 `hl`；離開 Splits 清掉。Splits 開關走勢／換指標會回報（`onFocusChange`），網址跟著記住
  - **球員 `p=ID-名字`**（2026-10-24）：`UrlState.playerToken(id, name)` 組（名字部分 `window.nameSlug`＝`nameKey` 後非英數字換 `-`），`tokenPlayerId(p)` 解（符合 `^\d+(-[a-z0-9-]*)?$` 取開頭數字，否則 `null`＝舊連結的完整名字）。App 不直接把網址的 p 塞進 `selectedPlayer`：`wantPlayer = {pid|name, seasonKey}` 交給「自動修正 selectedPlayer」effect，**等 `loadedSeasonKey()`（由 `playerHistory[0].date` 推回：日期字串＝當季、賽季標籤＝歷史）等於目標賽季才比對**（ID 用 `playerIdOf`、名字用 `nameKey`），避開切季那一拍舊名單誤判成「沒有這個人」而退回第一人；比對期間網址只寫 ID（或舊名字），不配上前一位球員的名字。網址帶 ID 時 `selectedPlayer` 初值留空，不先閃出 localStorage 記住的球員
  - **賽季 `s=年份&t=賽別`**（2026-10-24）：歷史賽季寫 `s=2025-26&t=playoffs`（例行賽也寫 `t=regular`）；parse 時 `s=當季年份` 視為當季、舊 key `s=2025-26_playoffs`／`s=current` 照收；`t` 只在當季寫進 `seasonTypeView`（歷史賽季的賽別在 key 裡，不可改到當季賽別）
  - 單場頁 `#game=日期&tab=box&p=展開的球員`（**沒有 `v=`**）。`tab`＝單場分頁 box／compare／shots／pt（省略＝概要，2026-10-24；pt 2026-11-21 起）；`p` 是展開進階的灰狼球員、只在 `tab=box` 寫入，不改主畫面的 `selectedPlayer`；**舊連結只帶 `p=` 時 parse 成 `tab=box`**；`p` 同主畫面寫「ID-名字」，GamePage 先用 ID 對、舊名字才比名字，對到後把網址改寫成目前的 token。App 以 `gameTab` 保存，切分頁用 `replaceState`，離開 Box Score 清掉 `p`。`bx=adv`＝Box Score 看進階欄組（App 的 `gameBox`，只在 `tab=box` 寫入，離開 Box Score 清掉；賽程條換場次保留，2026-10-29）
  - 薪資頁 `#cap&s=2025-26&tab=contracts`（2026-10-20，**沒有 `v=`**）：`s`＝薪資賽季（省略＝薪資當季，7/1 切換）、`tab`＝contracts／picks／rules（省略＝總覽）。進出同單場頁（改 `location.hash`、「← 回主畫面」直接切回）；切分頁、換賽季用 `replaceState`
  - 進出單場頁一律改 `location.hash`（產生瀏覽紀錄，返回鍵可回上一頁）；單場頁期間主畫面狀態不動，「← 回主畫面」直接切回（不用 `history.back()`：從外部連結直接打開時會離開本站）
  - 改刊頭賽季／賽別／日期、用搜尋面板 → 都會先離開單場頁；數字鍵在單場頁切單場分頁（2026-10-24 起，不再離開）
  - 對戰分析（2026-10-23，**沒有 `v=`**）：首頁 `#vs[&r=cur|YYYY-YY][&t=regular|playoffs]`、單隊頁 `#vs=DEN[&r=][&t=][&m=指標]`。`r`／`t` 是對戰自己的範圍（省略＝近三季、例行＋季後），**不改主畫面的賽季／賽別**；`m` 只在單隊頁有效（從首頁熱圖點格子帶入，標亮並捲到該指標）。App 以單一 `vs` 物件 `{team, range, type, metric}` 保存；首頁↔單隊頁用 `openVs()` 改 `location.hash`（沿用目前範圍），切範圍／賽別用 `replaceState`；`leaveGame` 一併關掉對戰（對戰頁沒有分頁列，數字鍵不作用）
- 網址帶日期時用 `pendingDateRef` 延後套用：資料載入 effect 一開始會清空 `selectedDate`
- 狀態變動用 `history.replaceState`（不產生瀏覽紀錄）；同分頁貼上新連結靠 `hashchange` 套用
- 快捷鍵：`/` 開 `CommandPalette`（球員/章節/賽季/攻守/賽別/最近 10 場比賽，比對走 `nameKey`）；數字鍵切**目前畫面的分頁列**——主畫面 `1–6` 章節（App 全域 keydown，`ownPageRef` 為真時不處理）、獨立整頁用 `UI.useTabKeys(keys|() => keys, onChange)`（單場、薪資；hook 要在提早 return 之前呼叫，分頁清單晚點才知道時傳函式）；輸入框聚焦或 Modal 開著時不攔截
- **主畫面賽季不存 localStorage**（2026-10-24）：`selectedSeasonKey` 初值＝網址 `s=` 或 `current`，App 掛載時刪除舊版的 `wt_pref_selectedSeasonKey`。原本存了會讓開站首頁（單場）回主畫面跳到上次看的舊賽季，`#vs`／`#cap` 刊頭賽程膠囊也顯示上季最後一場

### 防守數據：Hustle 欄位與全隊最近防守者（2026-10-23 起）
- `HUSTLE_FIELDS` 由 7 欄增為 15 欄：新增干擾兩分、掩護助攻得分、進攻／防守端地板球、進攻／防守卡位、卡位後自己搶下籃板與比例（干擾三分原本就有抓，這次才上畫面）。endpoint 另有 6 欄**刻意不抓**（已與使用者確認）：`BOX_OUT_PLAYER_TEAM_REBS`、`PCT_BOX_OUTS_TEAM_REB`（恆等於卡位／100%）、`PCT_BOX_OUTS_OFF/DEF`、`PCT_LOOSE_BALLS_RECOVERED_OFF/DEF`（可由次數推得）
- 前端 `defenseDefs` 依重要性排序：最近防守者 → 防守 Box → 拼勁（`Hustle`，只放防守向）→ 掩護與卡位（`Screens`，新群組，資料同在 `doc.defense`）。球隊防守頁：防守 Box → 最近防守者（2026-11-12 起）→ 對手分區 → 拼勁 → 掩護與卡位
- 有逐場資料的防守群組集中在 `window.GAME_DEFENSE_IDS`（單場頁展開列、Splits、跨季疊圖讀它）；新增 Hustle 類群組要加進來
- `GameAgg.RATIO_DEFS` 加 `PCT_BOX_OUTS_REB`（不以 `_PCT` 結尾，不加會被當次數相加）
- **球隊版 endpoint 沒有 `BOX_OUT_PLAYER_REBS`／`PCT_BOX_OUTS_REB`**：`fetch_hustle` 只寫 headers 裡真的有的欄位（舊版被 `safe_col` 補成 0，2026-10-23 前寫入的球隊文件仍存著假 0）；前端這兩項標 `playerOnly`，全隊的防守分頁、跨季比較、疊圖一律不顯示
- **全隊最近防守者**（2026-11-12）：`fetch_team_matchup_defense()` 打 `leaguedashptteamdefend`（NBA.com Teams > Defense Dashboard，原本 Overall＋3 Pointers 共 2 requests，2026-11-12 起跟著 `MATCHUP_CATEGORIES` 加 2 Pointers、Less Than 6Ft 共 4），欄位名與球員版相同、共用 `MATCHUP_*_FIELDS`，併入球隊 `defense`。每日抓取用 `team_id=0` 經 `split_league` 算名次（`D_FG_PCT`／`PCT_PLUSMINUS`／`D_FG3_PCT`／`D_FG3_PLUSMINUS` 越低越好；出手／命中次數與 `NORMAL_*` 不排）。全隊的 DFG% 等同對手整體命中率，真正多的資訊是 DIFF%（比對手平常低多少）。歷史快照用 `backfill_history.py --season X --type Y --only-team-matchup`（當時每份 2 requests，現在跟著類別表是 4；只動球隊 `defense`）補，2022-23～2025-26 例行賽／季後賽 8 份已補；當季 2026-11-11 每日快照手動補過，之後每日抓取自帶。單場（逐場 bundle／單場頁／Splits）沒有全隊版
- 歷史快照補齊：`backfill_history.py --season X --type Y --only-hustle`（每份 2 requests，只把 Hustle 併入既有 `defense`，其他類別不動；只更新 doc 裡已有的球員）。2023-24～2025-26 例行賽／季後賽與 2022-23 例行賽共 7 份已補；**2022-23 季後賽未補**（使用者決定放棄，該季新欄位顯示「—」）。注意：腳本寫入完成後 Python 程序可能卡住不退出（推測是 Firestore 連線收尾），看到 ✅ 就代表已寫入。**逐場資料（單場頁／Splits／疊圖）的新欄位只從 2026-10-24 之後的比賽開始有**，過去場次未回補（約 800 requests，需另外分批）

### 開季修正後的介面規則（2026-10-23 起）
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
- **複製引用**：`UI.citeLine` 組字串；入口是「?」小卡底部的「複製引用」（`UI.Info` 帶 `cite`，2026-10-23 起每格只留一個圖示），沒有 glossary 定義或沒有「?」的地方才用獨立 `UI.CopyBtn`。`cite`／`text` 一律傳**函式**（點擊當下才組字串，句尾網址才是當下畫面），格式「主體｜賽季｜（期間（N 場））｜（補充，如逐場加權近似）｜截至日期（期間是有結束日的日期區間時省略）｜指標（原文） 數值｜資料：來源｜當下畫面網址」（期間寫法見 FAQ「期間篩選」）（網址含 hash，可從引用回到原畫面查證；總覽「近 N 場」切換不在網址裡，但期間已寫在引用文字中）。情境由 App 每次 render 寫入 `window.CiteCtx`：**快照數字引用快照日（asOfSnap）、GameAgg 逐場重算的平均引用截至日（asOfAgg）**，兩者可能不同；Splits/單場/Clutch 以 `citeNote` 附期間或場次。`StatCell` 的 `citeAsOf`／`citeNote` 由 `TrackingCardRow` 傳入
- **引用籃**（2026-10-28）：跨頁收集數值、排成貼文用純文字（不附來源網址為預設），見history.md「2026-10-28 聯盟名次與引用籃」
- **指標定義**：`components/glossary.js`（`window.GLOSSARY`，key → def/calc/src/verify），`UI.Info` 顯示「?」小卡；名稱仍以 constants.js 為單一來源，glossary 只寫意思。`verify: true` 的條目畫面會標「待確認」
- **近期異動**：`components/Highlights.js`，近 N 場 vs 全季（截至 untilDate；N 由 `OverviewTab` 依「平均期間」傳入，近 5／近 10，全季時用 5，本區不另放切換），排序＝|Δ| ÷ (逐場標準差 ÷ √N)，|分數| < 1 不列；命中率需近 N 場出手達門檻（FG 25、3P 10、FT 8）
- （2026-11-19 起沒有「複製連結」按鈕：網址列本來就是含 hash 的目前網址，引用籃的引用也會附網址）
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
- 元件：`UI.StatCell`（指標格，數值三態：0 照常顯示／無資料「—」／不適用「—」+ tooltip）、`UI.Ledger`＋`UI.ledgerCols(n)`（細線數據表，依指標數選能整除的欄數）、`UI.PctBar`（百分位色階條，紅→月光銀→綠；**只給真的有 percentile 的資料**）、`UI.Delta`（漲跌）、`UI.DataTable`（可排序表格，手機首欄固定且限寬換行；`stackFirst` 時手機改成首欄獨占上方一行、數字欄收窄，五人陣容用）、`UI.Info` 的 `history`（點開才載入的補充段落，2026-11-04 歷史定位用）、`UI.scrollHint`（橫捲容器右緣陰影的 style 物件：還能往右捲時才出現，Box Score 與 DataTable 已套用；底色須為 #0A1626）
- 2026-10-24 補：`UI.TabBar`（sticky 分頁列，章節列／薪資頁／單場頁共用；`numbered` 標 01 02… 快捷鍵提示、`right` 放右側控制項、`bleed` 在 `<main>` 內用負邊距撐滿）、`UI.useTabKeys`（數字鍵切分頁）。新的分頁列一律用它，不要再複製一份 JSX
- Phase 4 補：`UI.Section`（區塊標題＋小字原文＋說明＋右側操作，accent 色標保留舊色條語意：攻綠/守紅/Clutch 琥珀/結構藍；右側容器 `max-w-full`，手機上自行換行不撐寬頁面）、`UI.Note`（空狀態）、`UI.Chip`／`UI.selectClass`（篩選膠囊）
- 新區塊一律用這些元件組，標籤寫「中文＋小字原文」，風格自動一致

### 各章節（2026-10 Phase 4）
- 總覽：季平均跟著全域期間（同一截至日，`GameAgg.aggregate`；全季只列身分列沒有的項目，篩選時列完整項目、箭頭＝vs 全季）；**Playtype 強弱項**（Synergy 百分位，門檻每場回合數 ≥ 1.0、排除 Misc；強項只列 ≥ 50、弱項只列 < 50——攻守百分位皆越高越好，已用資料驗證：防守 PPP 越低百分位越高；2026-11-20 起**進攻端／防守端並列**，桌機兩欄、手機上下排）；雷達移入；On/Off 顯示「在場 − 離場」差值；陣容手機只顯示姓氏
  - **攻守切換**（2026-11-20 起）：總覽不是 `sided` 章節，章節列不顯示攻守；雷達（`RadarPanel` 外層管攻守、`RadarBody` 以 `key` 重建換軸，主序列顏色依自己的攻守）與單場面板各自在標題旁有 `UI.Seg`（選項共用 `UI.SIDE_OPTIONS`），初始值＝全域 `viewSide`，之後互不影響
  - **期間篩選時跟著期間的效率三塊**（2026-11-20 起，讀 bundle 每場的 `adv`，見「單場數據」）：全隊效率（`GameAgg.teamAdvanced`）、個人效率（`playerAdvanced`）、在場／不在場（`onOff`）。沒篩選時照舊顯示整季快照與名次；篩選時顯示期間值、箭頭＝vs 全季（同一截至日）、**不排名**（聯盟名次只有整季資料）、近似值格子標「≈」（`StatCell approx`／`UI.ApproxMark`）。公式（2026-11-19 整季快照對帳）：
    - 精確：全隊進攻／防守效率＝Σ得分÷Σ回合（防守用對手得分與對手回合）、淨效率、節奏（依比賽分鐘加權）、TS%、eFG%、助攻率＝AST÷FGM、失誤率＝TOV÷回合（全隊精確項最大差 0.05）；球員 AST/TO、失誤率＝TOV÷(FGA＋0.44FTA＋AST＋TOV)、在場效率
    - 近似（≈）：全隊籃板率（每場官方比率反推籃板機會再加總，差約 0.4）；球員使用率、助攻率、三種籃板率（依回合加權）、PIE（依全場 PIE 分母加權，同一場各球員反推的分母不一致，無法做到精確）——出賽 10 場以上大多差 1 以內，出賽少的球員差到 2～4；不在場（單場官方值依估計的不在場回合加權，差約 0.2）
    - **不在場的場次範圍＝期間內所有全隊場次**：該員有上場的場次用單場官方「不在場」值，沒上場的場次（含加入前、缺陣）算整場全隊。NBA 整季值就是這樣算（2026-11-20 用只打 1 場的 Zikarsky 驗證，只從首場起算會差 3 分）。不可用「全隊 − 在場」推不在場效率
    - 場次範圍：個人效率依該員自己的出賽場次套期間（同季平均，例：近 10 場＝該員最近出賽 10 場）；在場／不在場依全隊場次套期間（球員視角在總覽篩選時，App 另讀全隊 bundle，`needs.team`）。所以缺陣多的球員（如 Edwards 只打開季 4 場）「近 10 場」的個人效率是他那 4 場、在場／不在場是全隊近 10 場（出賽 0 場，在場顯示「—」）
    - 缺 `adv` 的場次不進效率類（分子分母同一組場次），說明列寫「效率類只計有單場進階數據的 N 場」；整個期間都沒有 → 「這個期間沒有單場進階數據」
- Playtype：`PlaytypeSection.js`，預設 Synergy 式可排序表格（Freq/Poss/PPP/百分位/FG%），可切卡片（`wt_pref_playtypeView`）
- 投籃：命中率格可點看趨勢；熱圖命中＝實心綠點、未中＝空心紅環，球場線月光銀畫在點下方
- 投籃「與上季比」（2026-10-19，分區組）：打開時才讀上一季同實體 shotchart（`loadShotDoc`，與本季共用解析與 `__shootTabCache`）；本季套期間篩選、上季一律全季；格子加「上季 % ／差／占比」，下方 `ZoneDiffCourt` 半場圖；任一季該區出手 < 10 標灰；上季無文件時按鈕顯示「XXXX 無資料」
- Splits「條件」（2026-11-04）：期間列最後，條件戰績（球員數據／全隊數據／有出賽／未出賽，最多 2 個），見history.md「2026-11-04 條件戰績」
- Splits「防守」欄位組（2026-10-19）：`defenseDefs` 的 MatchupDefense＋Hustle（DefenseBox 沒有單場值不列），只顯示該實體有值的組（球隊沒有最近防守者）。各欄位組的 defs 集中在 `GROUP_DEFS`；基本數據定義移到 `constants.js` 的 `SPLITS_BASE_DEF` 共用
- 防守熱圖：顏色為「不透明預混色」（`blend()`），避免各區半透明疊色互相污染；基準值 `ZONE_REF` 為寫死的聯盟約略均值，畫面上會直接標出，**非官方即時數字**
- 走勢 Modal：賽別預設沿用刊頭的例行/季後（舊版用日期判斷，休賽期誤設例行賽）；Esc 關閉；「近 N 筆」（每筆是一份快照，不一定是一場比賽）
- 雷達關閉進場動畫（使用者不要進場動畫，且截圖/切換時圖形不會只畫一半）
- 已知資料缺口：2025-26 球員季後賽 06-15 快照的 Playtype `freq`（POSS_PCT）NBA 全回 0 → 前端視為「未提供」顯示「—」，**不自行用 possTotal 推算**（NBA 不列低回合數類型，推算值失真）

### 效能與無障礙（2026-10 Phase 6）
- **當季快照先只讀近期**（`App.js` 的 `snapFull`／`snapFullReady`，`constants.js` 的 `snapshotWindowStart()`）：
  - 開站只讀最近幾天：賽季中＝今天往前 10 天；休賽期＝6/30 往前 30 天。整季約 120 份、首次傳輸近 9 MB，第一屏只需要「當期＋前一期」
  - 何時補讀整季：選了日期、開走勢 Modal、目前賽別在近期快照裡不足兩份、或近期查詢回 `failed-precondition`（缺索引）
  - 補讀期間顯示載入骨架，**不可**顯示「沒有快照」，也不可把最新一天的數字標成所選日期（`showSkeleton` 的兩個條件）
  - 只用 doc id 範圍查詢：`orderBy(documentId,'desc')`／`limitToLast` 需要 `__name__` 降冪索引，已實測會被拒
  - 權限或網路錯誤**不**改讀整季（改讀也不會好），照常顯示錯誤
- **Firestore lite（2026-10-28 起）**：`index.html` 改載 `firebase-firestore-lite.js`（30.6 KB gzip，完整版 111 KB）。完整版走 WebChannel 長連線，讀取一輪一輪排隊；lite 每次 `getDoc`／`getDocs` 是獨立 REST 請求、真正並行。沒有 `onSnapshot`／離線快取（資料每天才更新，重新整理即可；斷網時直接報錯，不會有「快取空結果」被誤當沒資料）。冷啟動到首頁比分看板，實測正式站舊版 2.98／3.38／3.39 秒 → 新版 2.68／1.89／1.77 秒（預覽窗格在背景、數字僅供相對比較）。Firestore 單次讀取本身延遲約 240～1130 毫秒浮動，查不存在的文件也要近 1 秒，所以首頁例行賽期間只讀例行賽索引、不等季後賽索引；當季比賽索引 5 分鐘內同頁共用一次讀取（`loadGamesIndex`）
- **不載圖表套件**：2026-10-28 起雷達圖改自繪 SVG（`RadarPanel.js` 的 `RadarSvg`），移除 Recharts＋prop-types（約 120 KB gzip、500 KB 未壓縮，原本每頁都要下載解析）。全站圖表都是自繪 SVG，新圖表也照做，不要再引入圖表套件
- **不擋首屏**：React 用 `<script defer>`（與 module 型 Firebase 初始化、bundle 同屬依序執行佇列，順序不變）；Google Fonts 用 `rel="preload" onload` 非阻斷載入＋`<noscript>` 退路
- **對比（WCAG AA，小字 ≥ 4.5:1）**：`tailwind.config.js` 把 slate-500 改 `#8493A8`、slate-600 改 `#7C8CA2`（原生值在 `#0A1626` 上只有 3.8／2.4）。全站 slate-500/600 只當文字色用；若要拿來當底色或框線，先確認不受影響
  - 品牌色當底時字用深藍 `#0A1626`（白字在綠底 3.4、紅底 3.8 皆不足）；品牌色字配同色淡底用 `/[0.08]`
  - 結構藍 `#236192` 在深底只有 2.8，不可當小字色；連結改用月光銀
- **觸控目標 ≥ 24×24 且不重疊**（PageSpeed 量的是按鈕本身的框，不算 `::before` 外擴）：
  - `UI.Info`（「?」）按鈕本身 24px、內圈 16px，只用上下負邊距，**不可用左右負邊距**（會壓到相鄰複製鈕／排序鈕）
  - `StatCell` 標題列右側留 `pr-8`，避開右上角複製鈕
  - 表頭排序鈕 `min-h/min-w-[24px]`；小按鈕用 `py-1` 補高度
- 鍵盤焦點：`styles/app.css` 的 `:focus-visible` 綠框；`prefers-reduced-motion` 時關過場動畫
- **畫面驗證方式**（計算邏輯已有自動化測試，見「自動化測試」；畫面、無障礙與效能仍手動）：
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
| `WolvesTracker` | 每日 03:00（喚醒＋錯過補跑＋用電池可跑） | `run_fetch.bat` | 抓累積快照（與前一筆完全相同則跳過寫入）＋補抓單場（有新場次就重算單場題材 `build_insights`）＋寫賽前預覽 `build_preview`（+1 request）；接著跑 `sync_salary.py`（休賽期也會跑） | `fetch_log.txt` |
| `WolvesWatchdog` | 每日 15:00（喚醒＋錯過補跑＋用電池可跑，上限 2 小時） | `run_watchdog.bat` | 看門狗：主排程沒完成 → 完整補抓；昨晚那場缺 → 只抓單場；有補抓或失敗才跳桌面通知；最後一步逐場對帳（2026-11-13 起，0 request，有落差才通知） | `watchdog_log.txt`（補抓過程併入 `fetch_log.txt`，標頭 `=== [watchdog] ...`；被主排程鎖住時寫 `fetch_log_watchdog.txt`） |
| `WolvesWatchdogMorning` | 每日 09:00＋登入＋解鎖螢幕（2026-10-28 起） | `run_watchdog.bat --morning` | 早上看門狗：03:00 主排程今天該跑卻沒完成 → 完整補抓；已完成或未到觸發時間就安靜結束（不發 request、不寫 log） | `watchdog_log.txt`（標 `[早上]`） |
| `WolvesShotchart` | 每週一 14:30 | `run_shotchart.bat` | 逐球員投籃座標（整季覆寫） | `shotchart_log.txt` |

（`WolvesBackfill` 已刪除；backfill queue 完成後不再需要）

**排程「上次執行結果」的意思（2026-10-24 起）**：`run_fetch.bat` 會記住 `fetch_data.py` 的結束碼，薪資同步照跑，最後抓取失敗就以抓取的碼結束（`fetch_log.txt` 另留一行 `[run_fetch] fetch_data.py failed, exit code N`）；抓取成功才回報薪資同步的碼。所以排程顯示非 0 ＝ 抓取當掉（未捕捉例外，碼 1）、疑似被擋（「Synergy 與 base 皆無資料而終止寫入」，碼 2，2026-10-26 起；之前是 0。2026-10-29 起另有「開頭連續 3 項都失敗，提前結束」也是碼 2：`nba_common.enable_block_guard()`／`BLOCK_ABORT_AFTER`，`fetch_with_retry` 在這次執行還沒有任何一項成功時連續失敗 3 項就丟 `NBABlockedError`，約 5 分鐘、9 個 request 就收手，不再拖 2 小時打幾百個；中途零星失敗不影響；只有 `fetch_data.py` 開啟，回補腳本照舊）、Firebase 初始化失敗（碼 1）或薪資同步失敗，翻 log 末段即可。「休賽期跳過」仍是 0。舊版只回報最後一行（薪資）的碼，2026-10-24 抓取 `NameError` 當掉時排程仍顯示 0、沒人發現。`WolvesWatchdog` 顯示非 0 ＝ 補抓失敗或看門狗本身出錯（同時已跳通知）。

**看門狗（2026-10-26 起，設計緣由見history.md「2026-10-26 每日抓取看門狗」）**：
- 判斷「主排程有沒有完成」＝ `fetch_status.json` 的 `full.ok` 為 true 且 `finishedAt` 在今天 00:00 之後；判斷「昨晚那場」＝ `teamgamelog` 最新一場的日期在 `wolves_player_games` 有文件。兩項都正常就只記一行「正常」
- 手動檢查：`python scripts/watchdog.py --dry-run`（只印判斷，不補抓、不通知）；測通知：`python scripts/watchdog.py --test-notify`
- 改檢查時間：直接改排程觸發時間即可，程式不用動；**不要早於台北 14:00**（西岸場可能還沒打完，`teamgamelog` 只列已完賽場次）
- 暫停：工作排程器停用 `WolvesWatchdog`，主排程不受影響
- **早上模式 `--morning`（2026-10-28 起，排程 `WolvesWatchdogMorning`）**：只做第 1 級（主排程今天沒完成 → 完整補抓），第 2 級（昨晚那場）仍留給 15:00。觸發用每日 09:00＋登入＋解鎖螢幕（`MSFT_TaskSessionStateChangeTrigger` StateChange=8），因為筆電用電池待命時 09:00 也不一定醒著、`StartWhenAvailable` 補跑也不可靠（10/28 08:05 喚醒後沒補跑）；解鎖一天觸發多次無妨——今天已完成、**今天已失敗過**（`fetch_status.json` 的 full 是今天且 `ok: false`，主排程或看門狗補抓都算；等主排程時它失敗了也一樣，2026-10-29 起）或還沒到主排程觸發時間就直接 return——被擋時解鎖一次就重抓一次只會越擋越久（10/29 下午解鎖又跑了一次 45 分鐘），失敗後留給 15:00 那次（只讀 `fetch_status.json` 與排程資訊）。同一排程 `MultipleInstances=IgnoreNew`，不會重疊。台北 09:00 ≈ 美東前一天 20:00～21:00，前一晚的比賽早已過定稿門檻，補到的就是最終版；當晚比賽仍未打完，所以快照內容與 03:00 跑的相同。手動檢查：`python scripts/watchdog.py --morning --dry-run`
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

# 早上看門狗（同一支 bat 帶 --morning；三個觸發：09:00／登入／解鎖螢幕）
$a = New-ScheduledTaskAction -Execute 'C:\wolvestracker
un_watchdog.bat' -Argument '--morning'
$t1 = New-ScheduledTaskTrigger -Daily -At 09:00
$t2 = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$cls = Get-CimClass -Namespace Root/Microsoft/Windows/TaskScheduler -ClassName MSFT_TaskSessionStateChangeTrigger
$t3 = New-CimInstance -CimClass $cls -ClientOnly -Property @{ StateChange = 8; UserId = $env:USERNAME; Enabled = $true }
$s = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -WakeToRun -ExecutionTimeLimit (New-TimeSpan -Hours 2) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName WolvesWatchdogMorning -Action $a -Trigger $t1,$t2,$t3 -Settings $s

# 主排程改成用電池可跑
$m = Get-ScheduledTask -TaskName WolvesTracker
$m.Settings.DisallowStartIfOnBatteries = $false; $m.Settings.StopIfGoingOnBatteries = $false
Set-ScheduledTask -InputObject $m
```
`run_watchdog.bat` 內容（2026-11-19 起三支 `run_*.bat` 都進版控，`.gitattributes` 固定 CRLF；無中文註解）：`chcp 65001`、`PYTHONIOENCODING=utf-8`、`PYTHONWARNINGS=ignore::DeprecationWarning`、`cd /d C:\wolvestracker`，再以 Python312 絕對路徑跑 `scripts\watchdog.py %* >nul 2>> C:\wolvestracker\watchdog_err.log`，最後 `exit /b %ERRORLEVEL%`。**stderr 不可導到 `watchdog_log.txt`**：bat 開著它時 Python 再寫會 `PermissionError`（Windows 檔案鎖，2026-10-26 踩過）。

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
欄位：`date`, `seasonType`, `type`, `timestamp`, `stats`, `base`, `tracking`, `shooting`, `clutch`, `defense`, `lineups`（lineups 僅球隊文件）；球員文件另有 `onoff`、`meta`

- **全隊文件另有（2026-10-28 起）**：`advanced`（全隊進階 10 欄）、`ranks`（`{base|tracking|shooting|clutch|defense|advanced: {欄位: 名次, _n: 參與隊數}}`），見history.md「2026-10-28 聯盟名次與引用籃」。之前的快照與歷史期末快照沒有這兩欄（歷史期末快照的 `advanced` 2026-11-12 已用 `--only-adv-scoring` 補上）。2026-11-12 起全隊另有 `scoring`（得分組成占比＋情境得分）與 `ranks.scoring`；球員文件另有 `advanced`（整季進階）與 `scoring`

- **寫入守門（2026-10-23 改）**：Synergy **與** base 都空才視為被 NBA 擋、終止寫入。開季初 NBA 尚未釋出 Synergy（`synergyplaytypes` 回 0 筆、不是錯誤），此時印 `⚠️ Synergy 無資料` 並照常寫入其他類別、擷取單場；`stats` 為空陣列／空物件，等 NBA 釋出後隔天自動補上。前端球員名單取 `stats ∪ base`、球員存在判定與 `playerId` 都退回 `base`，Playtype 分頁顯示「尚無資料」

球員以 **playerName** 為 key（每日快照沿用舊結構）；`tracking` / `shooting` / `clutch` / `defense` 皆為 `{playerName: {...}}` 同構。
- **灰狼球員以名冊 PlayerID 過濾，不比名字**（`pid_to_name_keyed(..., keep_ids=roster_ids)`；Synergy 比 `playerId`）。名冊 API（commonteamroster）與數據 API（leaguedash*／synergyplaytypes）的寫法可能不同——2025-26 名冊 `Terrence Shannon Jr.`、數據 `Terrence Shannon Jr`，舊版比名字時他整個從快照消失（2026-10-19 修）。key 一律取**數據 API 的寫法**；`onoff` 的名字（endpoint 本身是 `Last, First`）也取 base 的寫法、沒有才退回名冊，確保 `current.onoff[球員名]` 對得上。前端跨季比對另有 `nameKey`（去句點/重音）兜底。
- `shooting` 2026-11-13 起只剩分區命中（`fetch_shot_locations`）；之前的快照另有投籃拆分的 `FG2A_FREQ／FG3A_FREQ／FG2_PCT／EFG_PCT` 等（停抓，前端不讀）。
- 球員文件 2026-11-13 起另有 `ranks`（球員聯盟名次，結構見history.md「2026-11-13 球員聯盟名次」）；最近防守者與防守 box 改抓全聯盟後才用名冊過濾，快照內容不變。
- `defense`（球員）= 對位防守 + Hustle + 防守 box 合併；`defense`（球隊）= Hustle + 防守 box + 對手分區（`*_OPP_FG_PCT` 等扁平欄位）+ 全隊最近防守者（`D_FG_PCT` 等，2026-11-12 起）。最近防守者（球員與全隊）2026-11-12 起另有兩分 `D_FG2*`／`NORMAL_FG2_PCT` 與護框 `D_RIM*`／`NORMAL_RIM_PCT`（見history.md「2026-11-12 護框與兩分／三分防守」）。

### 投籃熱圖（`fetch_shotchart.py` 每週整季覆寫＋`fetch_data.py` 每日增量）
- **每日增量**（`fetch_data.capture_recent_shots` → `fetch_shotchart.capture_game_shots`）：最近 5 場中「已定稿（`is_final_capture`）且全隊文件 `gameDates` 還沒有」的場次，打一次 `shotchartdetail?GameID=…&PlayerID=0&TeamID=MIN`（拿到該場全隊出手，每球帶 `PLAYER_ID`），依球員拆開併入各文件；同日期舊出手先移除（重抓不重複）；受助攻比例沿用舊值；**全隊文件最後寫**，它的 `gameDates` 就是「已併入」記號，中途失敗下次自動重來
- **每週整季**：逐球員重抓覆寫，負責對帳（NBA 事後修正）與更新 `assisted`
```
wolves_shotcharts/{playerId}_{season}_{regular|playoffs|playin}   例：1630162_2025-26_regular
wolves_shotcharts/TEAM_{season}_{regular|playoffs|playin}  全隊出手（PlayerID=0，前端球隊熱圖用）
```
欄位：`playerId`, `playerName`, `season`, `seasonType`, `timestamp`, `shots[]`（每筆 `{x, y, made, dist, zone}`，座標單位 0.1 呎、籃框在原點）。整季覆寫，非每日快照。全隊約 7,000+ 點、約 0.5 MB（單文件上限 1 MiB）。

### 單場數據（`backfill_games.py` 回補 / `fetch_data.py` 每日順抓，G2/G3）
```
wolves_player_games/{YYYY-MM-DD}   players:{name:{...}}（灰狼）、oppPlayers:{name:{...}}（對手，2026-10 起）
wolves_team_games/{YYYY-MM-DD}     stats:{...}（灰狼）、opp:{...}（對手球隊）、box:{...}（完整 box score）、insights:{...}（單場題材，2026-11-04 起，全部場次）、playtype:{...}（單場 Playtype，2026-27 起）
兩者共同：gameId、oppId、oppAbbr、matchup、wl、partial、final、captureTries
```
含 Tracking(6) + 對位防守 + Hustle + 分區投籃 + 基本數據的單場值（`DateFrom=DateTo` 抓）。不含 Clutch（單日不穩）；Synergy 不支援日期，單場 Playtype 改由每日快照相減另寫 `playtype`（見下）。
- **對手與 box score（2026-10 起擷取的場次才有）**：box score 已用 `backfill_games.py --season 2025-26 --type {regular,playoffs} --box-only` 補完 2025-26（當時每場 2 requests，`update` 合併寫入 `box`／`gameId`，不動 `stats`；2026-10-29 起 `--box-only` 每場 4 個，含進階＋單場 On/Off）；對手 Tracking／Hustle 舊場次**不補**（要補得整場重跑，每場約 20 requests，或另寫只抓球隊端的模式約 9 requests）
  - `fetch_boxscore` 的 `complete` 改為「兩隊都有每節比分」才算完整：summaryv3 偶爾回空殼（2025-11-19 實例，有回應但沒有 periods／背號／傷停／場館），原本只看 `bool(sm)` 會誤判完整
  - 對手球隊：球隊 request 改傳 `TeamID=0`，同一個 request 拿到當天所有球隊，取灰狼（key `MIN`）與對手（key 為 TEAM_ID 字串）——`_team_key()`。每日快照的球隊呼叫維持預設 `team_id=TEAM_ID`，行為不變。
  - 對手球員：球員 request 本來就是全聯盟，以 box score 的對手上場名單（PlayerID）篩出；對位防守另用對手 TeamID 抓（多 2 request）。
  - box score：`nba_common.fetch_boxscore(game_id)` 合併 `boxscoretraditionalv3`（兩隊球員/合計、先發＝有 position、DNP 原因在 comment）與 `boxscoresummaryv3`（每節比分 periods、傷停 inactives、背號、場館、觀眾、裁判）。欄位對照表 `BOX_STAT_FIELDS`（想多存欄位加一行即可）。`MIN` 是字串 `"38:01"`、DNP 球員的 stats 為空 `{}`。
  - 進階 box（2026-10-29 起，2026-27 全季）：`add_box_advanced` 抓 `boxscoreadvancedv3`（每場 1 request）把 `BOX_ADV_FIELDS` 併進兩隊球員 `stats` 與球隊 `totals`：`OFF_RATING`／`DEF_RATING`／`NET_RATING`（球員＝**在場時**球隊每 100 回合得失分）、`POSS`、`PACE`、`USG_PCT`／`TS_PCT`／`AST_PCT`／`OREB_PCT`／`DREB_PCT`／`REB_PCT`／`PIE`（比例 ×100）。
  - 單場 On/Off（同日起）：`teamplayeronoffdetails` **吃 `DateFrom=DateTo`**（舊註解說沒有單場版本是錯的；實測 GP=1、在場與進階 box 完全一致）。`add_box_onoff` 每場 1 request，把灰狼球員的「不在場」`OFF_OFF_RATING`／`OFF_DEF_RATING`／`OFF_NET_RATING`／`OFF_MIN` 併進 box 球員 `stats`（對手沒有）。**不可用「全隊 − 在場」推不在場**：NBA 依每段上場分開算回合，在場＋不在場回合 ≠ 全隊回合（10/26 Kuminga 77＋36＝113，全隊 111），推算差 7～16 分。
  - 進階或 On/Off 沒抓到 → `complete=False`／`partial`，每日補抓會重抓。只缺這兩項的舊場次用 `backfill_games.py --adv-only --dates …`（每場 2 requests）。
  - 逐場 bundle（`build_bundles`）把 box 的在場效率還原成 `ON_PTS`＝`OFF_RATING×POSS/100`、`ON_OPP_PTS`、`ON_POSS` 併進球員逐場（`nba_common.box_oncourt_totals`，每日 `upsert_game` 帶 `box`）。前端 `GameAgg.RATIO_DEFS` 的 `ON_OFF_RATING`／`ON_DEF_RATING`＝Σ得失分 ÷ Σ回合、`DIFF_DEFS.ON_NET_RATING`＝兩者相減。2026-10-29 用本季前 4 場驗證：加權進攻效率與 On/Off 整季快照完全一致、防守效率差 ≤ 0.9（NBA 防守回合另計）。單場頁展開列的效率「季均」就是此場之前各場的加權值（原本想用 On/Off 快照，但快照會缺日子——10/26 沒有快照時退回 10/25，少算一場）。
  - **bundle 每場的 `adv`**（2026-11-20 起，總覽區間效率用；只有有進階 box 的場次＝2026-27 起，舊場次沒有這個欄位）：球隊 `nc.box_team_adv` → `{ POSS, OPP_POSS, PACE, GMIN（比賽分鐘）, OREB_CH, DREB_CH（籃板機會，由本場官方 OREB_PCT／DREB_PCT 反推；比率 0 時退回己方＋對方籃板）}`；球員 `nc.box_player_adv` → `{ POSS, USG_PCT, AST_PCT, OREB_PCT, DREB_PCT, REB_PCT, PIE, PIE_W（全場兩隊 PIE 分母）, OFF_OFF_RATING, OFF_DEF_RATING, OFF_W（估計的不在場回合＝全隊回合 × 不在場分鐘 ÷ (比賽分鐘÷5)）}`。放 `adv` 不放 `stats`：`stats` 會被 `GameAgg.aggregate` 逐欄平均、被看門狗逐場對帳加總。欄位名前後端一起改（`nc.BUNDLE_TEAM_ADV_KEYS`／`BUNDLE_PLAYER_ADV_KEYS` ⇔ `GameAgg.ADV_KEYS_READ`，`tests/py/test_contracts.py` 檢查）；改了要 `build_bundles.py --all` 重建。每日 `upsert_game` 用傳入的 `box` 自動帶入
  - Game ID 來自 `teamgamelog`（`fetch_team_game_log` 回傳 5 元組，第 5 個是 game_id；`wolves_games_index` 每場也帶 `gameId`）。
  - 球隊 bundle 的每場多 `opp`/`oppAbbr`（舊場次維持原形狀）；box score 不放 bundle（整季約 0.9 MB，會逼近 1 MiB 上限），前端看單場時讀 `wolves_team_games/{date}` 一份即可。
  - 大小（2026-04-03 實測）：team_games 約 14 KB（box 11 KB）、player_games 約 30 KB（灰狼 15＋對手 15）。
- **單場球員文件混入非當時隊員**：2022-23～2025-26 都已清理（有 box 的場次比 box 上場名單 PlayerID；沒有 box 的用 `backfill_games.py --clean-players` 多欄位對帳）。做法見 FAQ「發現單場球員文件混入不是當時隊員的球員」，清理經過與名單見 history.md「單場球員清理紀錄」
- **清理資料或單場文件新增前端要讀的欄位 → `cache.js` 的 `CACHE_NS.gc.ver` +1**（舊鍵開站時自動清掉；2026-11-19 前各處自有快取鍵的換版歷程見 history.md 更新紀錄）。球隊／球員 bundle 只有記憶體快取，重新整理就是新資料
- **灰狼單場球員以 box score 上場名單的 PlayerID 過濾，不用名字**：名冊 API 與數據 API 的名字寫法可能不同（2025-26 實例：`Terrence Shannon Jr.` vs `Terrence Shannon Jr`），用名字過濾會整個人漏掉。名字清單只在 box score 抓不到時當後備（`keep_is_fallback`）；`backfill_games.py --min-gp > 0` 時才另外套輪換門檻。
- **`playtype`（單場 Playtype，全隊；2026-11-21 起）**：Synergy 不吃日期，只能由每日快照的整數總量相減（`stats[]` 每項的 `gp/possTotal/ptsTotal/fgmTotal/fgaTotal`，`fetch_synergy_data` 用 `PerMode=Totals`）。
  - 規則（`nc.split_game_playtypes`）：第 n 場＝第一份 `gp ≥ n` 的快照 − 最後一份 `gp == n-1` 的快照（第 1 場以 0 為基底）。
  - 形狀：可拆 `{ ok: true, n, preGP, snaps: [賽前 doc id|null, 賽後 doc id], off: [{ t, poss, pts, fgm, fga, prePoss, prePts }], def: […] }`（全為整數，依本場回合數排序；`pre*`＝賽前整季累計，前端算賽前季均）；拆不開（賽後快照一次多兩場以上）`{ ok: false }`；還沒有賽後快照就**不寫**（下次執行再補）。防守端沒有 Cut／Misc。NBA 事後修正造成的負差照實保留。
  - 寫入（`nc.write_game_playtypes`）：讀當季該賽別全隊快照（doc id 範圍＋`seasonType` 過濾）與比賽索引，內容有變才 `update`。`fetch_data.py` 在 `capture_recent_games()` 擷取單場之後呼叫——單場重抓是 `.set()` 整份覆寫，會洗掉 `playtype`，同一輪補回；主排程與 `--games-only` 都經過。附加賽沒有快照，跳過。手動重算 `backfill_games.py --season S --type T --playtype-only [--dry-run]`（0 request）。
  - 只有 2026-27 起有材料（2025-26 的快照沒有整數總量）。2026-27 例行賽前 16 場：第 5、8–16 場可拆，第 1–2 場（開季 Synergy 未釋出）、3–4、6–7 場（美東 10/26、10/31 每日快照沒寫成）拆不開。**某天快照沒寫成、又沒在下一場打完前補跑，那兩場就永久合在一起**（Synergy 無法事後指定日期補）。
  - PERCENTILE／聯盟名次無法還原（全聯盟整季相對值）；個人單場不做（NBA 球員 Synergy 只列整季累計 ≥ 10 回合的類型，低於門檻的整列不回傳）。欄位名前後端一起改（`GamePT.derive` 讀，`tests/py/test_contracts.py` 對帳）。
- **每日補抓（2026-10 起）**：`fetch_data.py` 的 `capture_recent_games()` 每次執行都讀 `teamgamelog`（只列已完賽場次），檢查最近 5 場（`CAPTURE_LOOKBACK_GAMES`）在 `wolves_player_games` 是否缺漏、未定稿（`final=False`）或 `partial=True`，逐場以**賽程上的比賽日期**擷取，並增量更新 bundle（`build_bundles.upsert_game`）與 `wolves_games_index`。不可改回用「執行當天日期」：排程執行時美東日期永遠是比賽隔天，查單場會落空（舊版 `capture_single_game` 即此問題，從未成功寫入過）。
- 單場文件多三個欄位：
  - `final`：擷取時間是否已過「比賽隔天美東 13:00」（`nc.now_east()`，含夏令）（`FINAL_AFTER_HOURS`＝最晚場結束＋12 小時）。未定稿的下次一定重抓——各來源都有值但還沒更新完的半成品，`partial` 抓不到，只能靠時間判斷。
  - `partial`：base 有資料但 tracking/hustle 等某來源整個空，或 Tracking 回「整組 0」（`tracking_zero_filled`，2026-10-27 起）；定稿後最多重抓 3 次（`CAPTURE_MAX_TRIES`）。
  - `captureTries`：定稿後的擷取次數（未定稿時為 0）。舊回補文件沒有這些欄位，視為已定稿完整。
  漏跑幾天也會自動補（5 場內）。
- **`insights`（單場題材＋歷史定位標籤，`build_insights.py` 寫入）**：`{ v: 2, since: '2022-23', computedAt, cards: [...], key, marks }`
  - `cards[]`：`{ kind: 'team'|'player', pid?, name?, key, label, value, tone: 'pos'|'neg'|'neu', tags: [{ scope: 'all'|'season', side: 'high'|'low', rank, ties, n, after }], prev, score }`；`prev`／`after` 為 `{ date, value, matchup, playoffs? }`（`prev`＝第一個標籤範圍內「這場之前」的最佳紀錄；`after`＝之後第一場比它好的比賽，沒有為 null）
  - `key`（勝負關鍵，沒有 box 為 null）：`{ factor: 'efg'|'tov'|'orb'|'ftr', win, oppAbbr, factors: { efg: { min, opp, contrib }, … } }`
  - `marks`（v2 起，歷史定位標籤）：`{ [球員ID]: { [欄名]: { rank, ties, side: 'high'|'low' } } }`，只存灰狼場次前 3 名（現在排名），不存樣本數
  - 只存結構化資料，文案在前端組；門檻改了用 `build_insights.py` 重算（見 FAQ「單場題材」「歷史定位」）
- 單場抓取邏輯集中在 `nba_common.fetch_single_game()`（回傳 dict）＋ `game_docs()`（組文件），`backfill_games.py` 與每日共用。
- **前端讀單場數值一律經 `cleanGameStats`／`cleanGameDoc`**（`gamesData.js`）：NBA 未釋出時回的「整組 0」與 0 分母的命中率清成 `null`，見 history.md「2026-10-27 正式站掃描：資料顯示修正」。新增直接讀單場文件或 bundle 的地方要記得套用
- **賽前預覽 `wolves_games_index/{season}_preview`**（`build_preview.py`，每天覆寫、只有當季）：`{ season, statsAsOf, updatedAt, teamsN, fields: [{ key, dir }], games: [{ id, date（美東）, utc, home, opp, oppId, status（1 未開打／2 進行中／3 結束）, label, arena, city, rest: [灰狼, 對手]（空檔天數，0＝背靠背，開季首戰 null）, score?: [灰狼, 對手] }], form: { 三碼: [{ date, vs, wl, pts, opp }] }, league: { 三碼: { W, L, PTS, OPP_PTS, … } }, ranks: { 三碼: { 欄: 名次 } } }`；`form` 用物件陣列，因為 Firestore 不允許陣列裡放陣列
- **組合數據 `wolves_games_index/{season}_{type}_lineups`**（2026-11-12 起；當季由 `fetch_data.py` 每天覆寫，歷史由 `backfill_history.py --only-lineups` 寫入）：`{ season, seasonType, asOf（當季＝快照日、歷史＝'final'）, gp, updatedAt, trimmed, players: { PlayerID: 縮寫名 }, groups: { '2'|'3'|'5': [{ ids: [PlayerID…], gp, min（整季總分鐘）, off, def, net, ts（×100）, poss }] } }`；每列依分鐘由多到少。放在既有集合（安全規則與索引豁免已有）；`build_bundles.py --all` 只認 `{season}_{regular|playoffs}`，不會誤處理
- 前端單場面板（G-c）已完成：`SingleGamePanel.js` 選日期看單場，只渲染有資料的群組（單場無 ShotProfile/DefenseBox/PlayType；單場 Playtype 只在單場頁的 Playtype 分頁）；日期選單讀 `wolves_games_index/{season}_{type}`（一份 doc，`backfill_games.py --index-only` 產生）。

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
`fetch_data.py` 寫入前會抓最近 14 天最新一筆，深度比對 `DATA_KEYS`（stats／base／tracking／shooting／clutch／lineups／defense／onoff／advanced／scoring／ranks；新增快照欄位要加進來，`tests/py/test_fetch_flow.py` 會檢查），完全相同則跳過寫入避免堆積無意義文件。

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

> 刊頭站徽用 `icons/icon.svg`（2026-10-24 起）；身分列、頭像列的「全隊」仍是 NBA 官方 Logo（代表球隊本身）。

---

## 前端架構重點

### App.js 的分工（2026-11-19 技術債 F 批）
- `App.js` 只留主畫面的狀態、主畫面網址同步、期間與引用情境（`CiteCtx`／`RankCtx`）與畫面組裝；畫面（JSX）沒有搬動
- 純計算放 `appLogic.js` 的 `window.AppLogic`，不碰 React、不讀 Firestore，所以能在 Node 測（`tests/js/applogic.test.js`）。新增「從快照／賽程算出要顯示什麼」的邏輯優先放這裡並加測試
- 資料載入放 `appData.js` 的 hooks；讀 Firestore 一律等 `isCloud`，快速切換時用 `cancelled` 旗標擋掉較晚回來的舊查詢
- 獨立整頁放 `appRoute.js` 的 `useRouteState`：新增一種獨立整頁時，在這裡加狀態、`applyPageHash` 的判斷（決定優先順序）、`pageHash` 的組法與 `open*`，App.js 只加一段畫面分支。App 的 hashchange 先交給 `applyPageHash`，回 false 才套用主畫面狀態
- 新檔都在 `bundle.py` 的 ORDER 裡排在 `App.js` 前面；它們和 App.js 同一個打包作用域，hooks 內一律從 `React` 取（不可在頂層再宣告一次 `const { useState } = React`）

### 賽季模式（`selectedSeasonKey`）
- `'current'`：當季 `getDocs` 讀兩個集合（先近期、需要時整季，見「效能與無障礙」；2026-10-28 前是 onSnapshot），date 為實際日期，身分列時光機選日期
- 其他（如 `'2024-25_playoffs'`）：history mode，`getDoc` 一次拿賽季終點快照，date 顯示賽季 label，日期切換隱藏

### localStorage 快取
- 2026-11-19 起所有資料快取統一走 `window.Cache`（`components/cache.js`）：鍵 `wt_c_{命名空間}_{版本}_{key}`、值 `{ e: 到期, t: 寫入時間, v }`。命名空間與用途：`gc` 單場兩份文件（本季 1 天、舊季 7 天；單場頁、對戰頁、總覽單場面板共用 `loadGameDocs`）、`idx` 舊賽季比賽索引（30 天）、`pv` 賽前預覽（3 小時）、`lu` 舊賽季組合（7 天）、`hist` 歷史快照（24 小時）。換版只改 `CACHE_NS` 的 `ver`；開站時 `Cache.purge()` 清掉過期、版本不對與舊格式（`wt_gc_`／`wt_game_`／`wt_history_` 等）的鍵；存滿時 `evict` 依寫入時間刪最舊的四分之一再重寫（最多 4 輪）。除錯：瀏覽器 console `Cache.stats()` 看各命名空間筆數與 KB
- 歷史快照（`hist`）存 `{ team, player }` 原始 doc 24 小時；切換到歷史賽季先查快取、沒有才讀 Firestore，跨季比較逐季共用同一份。**歷史快照有任何回補（加欄位或重跑 `backfill_history.py`）都要把 `CACHE_NS.hist.ver` +1**，否則讀者 24 小時內看不到
- 其他換版時機：清理 Firestore 單場資料、或單場文件新增前端要讀的欄位 → `gc` +1；賽前預覽文件格式改了 → `pv` +1；舊賽季組合文件重寫 → `lu` +1
- 不經 `Cache` 的（不是快取、不會被清）：偏好 `wt_pref_*`、雷達軸 `wt_radar_axes_*`、引用籃 `wt_quote_*`。2026-11-19 前各處自有快取鍵（`wt_gc_v7_`、`wt_game_v4_`、`wt_history_v*_`、`wt_pv_v1_`、`wt_games_index_v3_` 等）的換版歷程見 history.md 更新紀錄

### 雷達 overlay（跨賽季 + 球員互相比較）
- `compareKeys` state：勾選的歷史賽季（最多 2 個，加主賽季共 3 條雷達）
- `comparePlayers` state：勾選的同季其他球員（Phase D，球員 + 當季模式；資料已在 `playerHistory`，無需額外抓取）
- `radarSeries` = 主序列 + `compareKeys` 賽季 + `comparePlayers` 球員；比較時主序列標籤改用球員名
- `compareCache` state：已載入的歷史 doc，多源共用
- 主色：進攻綠 / 防守紅（2026-11-20 起由 `RadarPanel` 依自己的攻守切換決定，App 的 `primaryColor` 只是預設值）；比較色盤：藍 / 黃 / 粉（賽季與球員共用索引）
- 球員模式才顯示

### 單場數據面板（`SingleGamePanel.js`）
- 當季模式下、球員/球隊視圖底部顯示；日期選單讀 `wolves_games_index/{season}_{seasonTypeView}`（隨例行/季後切換；`gamesIndex` state，一份 doc；只有已結束賽季走 `Cache` 的 `idx`（30 天），當季每次讀最新、空清單一律不快取——開季曾把空清單快取住導致單場入口消失）
- 切換賽別後原選日期不在新清單 → 自動跳到新清單最後一場；缺值卡片顯示「—」（不印孤立單位）
- 選日期後經 `gamesData.loadGameDocs(date)` 讀兩份單場文件（與單場頁共用快取，**未定稿 `final=false` 不寫入快取**），依攻守取 defs，**只渲染該實體有資料的群組**（`def.metrics.some(有值)`）→ 自動隱藏單場沒有的 ShotProfile/DefenseBox/PlayType
- 卡片用 `TrackingCardRow clickable={false}`（單場無走勢，不可點）
- 攻守由面板標題旁自己的「進攻端｜防守端」切換（2026-11-20 起；初始值＝全域 `viewSide`，之後不受其他區塊影響）：防守側顯示最近防守者／Hustle／抄截阻攻單場值

- 面板右上「看完整比賽 →」連到該場單場頁（2026-10-19）

### 單場比賽頁（`GamePage.js`，2026-10-19）
- App 的 `gameDate` 有值時主區改渲染 `GamePage`（獨立整頁），隱藏 RosterRail／IdentityBar／ChapterNav，左上「← 回主畫面」；Masthead 期別行改「單場 · 日期」、不顯示「資料」群組（賽季／賽別）
- **賽程月曆 `GameCalendar.js`**（2026-10-23，取代「最新一場」按鈕）：App `scheduleSeason`＝單場頁時 `seasonForDate(gameDate)`、否則刊頭所選賽季 → `gamesData.loadSeasonSchedule(season)`（例行＋季後索引合併、每場帶 `type`）。月曆格子標對手縮寫（`@`＝客場）＋勝綠敗紅，季後賽標「季後」，點日期 `openGame`；彈出層用 `ReactDOM.createPortal` 掛 body（刊頭控制列是 overflow-x-auto，放裡面會被裁），fixed 定位、視窗太矮時內部捲動。搜尋「最近比賽」也讀同一份。2021-22 以前沒有 `wolves_games_index` → 按鈕停用並說明
- 資料：`wolves_team_games/{date}`（box/stats/opp/matchup/wl/seasonType/final）＋ `wolves_player_games/{date}`（players），經 `gamesData.loadGameDocs(date)` 讀取（與對戰頁、總覽單場面板共用）：記憶體快取 `window.__gameDocCache`＋`Cache` 的 `gc`（本季 1 天、舊季 7 天過期；`final === false` 不寫，免得鎖住半成品；對戰頁傳 `persist=false` 只讀不寫）
- 比分下方「與 {對手} 歷次交手 →」連到 `#vs=對手`（2026-10-23；沒有 box 的場次也有）
- 概要「本場題材」（2026-11-04）：讀 `docs.team.insights`，沒有題材也沒有勝負關鍵就不顯示；沒有 box 的舊場次照樣顯示（題材來自逐場 bundle）。細節見history.md「2026-11-04 手機版巡檢與單場題材」
- 手機（< 640）另有精簡比分區 `mobileBoard`，原看板 `board` 只在 sm 以上顯示（2026-11-04）
- 預覽模式（2026-11-04）：沒有單場文件、預覽賽程有這天 → `PreviewPanel`；賽程條尾端「下一場」卡。細節見history.md「2026-11-04 賽前預覽與完整賽程」
- 歷史定位（2026-11-04）：「本場 vs 季平均」格子讀 `insights.marks` 標「灰狼第 N 高」（`markBadge`）；Box Score 展開列「?」小卡點開算完整定位（`playerHistory`）。細節見history.md「2026-11-04 歷史定位」
- 賽季＝`seasonForDate(date)`、賽別＝文件 `seasonType`；賽程條讀 `loadGamesIndex(season, type)`（`gamesData.js`，App 的單場面板也改用它）
- **灰狼球員以 box `personId` 對應 players 文件的 `playerId`**，連結用 players 文件的名字（數據 API 寫法，才找得到主畫面的球員）
- 季平均＝該員 bundle 取「此場之前」的比賽（`GameAgg.aggregate`），各區塊共用 `avgCache`，換場次清空；比率類分母對照 `RATIO`（由 `GameAgg.RATIO_DEFS`／`EFG_DEFS` 推出＋ PCT_PLUSMINUS→D_FGA）
- 標色 `judge()`：`neutral` 指標不判、分母 < 5 標樣本少、其餘依 `betterIsLarger`。**新增次數類指標要在 `constants.js` 加 `neutral: true`**
- 降級：沒有 `box` → 只顯示灰狼進階清單；沒有 `opp` → 球隊對比右側「—」並說明；沒有每節比分 → 看板不畫 linescore、不顯示比賽資訊；投籃點沒有 → 說明賽後隔天才會併入
- 手機：球員選擇鈕放區塊內容第一行（十幾個 chip 放在 `UI.Section` 的 `right` 會撐寬版面）
- **Playtype 分頁**（2026-11-21，`GamePlaytype.js`，網址 `tab=pt`，排在投籃後）：單場文件有 `playtype` 才出現分頁（舊賽季、賽後快照還沒寫好的場次沒有）；`ok: false` 只顯示「因資料來源欠缺而無資料」。只有全隊
  - `GamePT.derive(pt, side)`（純計算，`tests/js/gamept.test.js`）：頻率＝本類回合數 ÷ 全類；PPP 取兩位；差值＝**顯示的兩個數相減**（畫面不會對不起來）；防守端失分少＝好；本場回合數 < `MIN_POSS`（5）不判好壞、整列變淡；賽前季均＝`pre*` ÷ `preGP`
  - 版面：標題右側自帶攻守切換（`UI.SIDE_OPTIONS`，只控制這一塊）→ 4 格摘要（回合數、Synergy 得分 vs 實際比分、每回合得分 vs 賽前季均、最常見類型）→「＋ 整組加入」→ 表格（桌面 8 欄：類型、回合數、頻率條＋季均刻度、得分、FGM-FGA、PPP、賽前季均、差；手機 4 欄：類型＋小字頻率、回合數、PPP、vs 季均）→ 頁尾說明（得分合計 vs 實際、防守端沒有 Cut／Misc、百分位不顯示）
  - 引用：`GamePT.rowQuote` 一列＝已合併的成對項目（`parts`：「回合數」「每回合得分／失分」，`pre`＝類型名，賽前季均 → 本場），主體固定「灰狼全隊」；`quoteFormat` 的 `pairName` 看到同一個 `pre` 只寫一次類型名（「※轉換進攻 回合數／每回合得分：22.3／1.15 → 26／1.42」）。逐列「?」（複製引用／加入引用籃）只在桌面；「整組加入」手機也有，只收回合數 ≥ 5

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

### 走勢 Modal（`HistoryModal.js`）
- 只有「當季走勢」（每日快照逐筆的累積值，「近 N 筆」每筆是一份快照、不一定是一場比賽）；跨賽季比較改由「跨季」章節負責，Modal 底部有說明
- 當季的賽別預設沿用刊頭例行／季後（`seasonTypeView`；沒有時才用 `getSeasonPhase()`：美東 10/20～4/15 例行、4/16～6/20 季後）；歷史模式不分賽別；Esc 關閉

### 指標命名對照（2026-10 命名精準度修正）
原則：中文標籤必須對應 NBA 欄位的**實際語意**；中文旁一律以小字保留 NBA 原文（`englishLabel` 或 `en`），避免查證時對不上。資料 key 不因改名而變。

| 前端標籤 | 原文 | API 欄位 / endpoint | 注意 |
|---|---|---|---|
| 合理衝撞區命中率 | Restricted Area | `*shotlocations` 區域 `Restricted Area` | 不是整個禁區 |
| 禁區（非 RA）命中率 | In The Paint (Non-RA) | 同上 `In The Paint (Non-RA)` | 不含合理衝撞區 |
| 底角三分 / 非底角三分 | Corner 3 / Above the Break 3 | 同上 | 非底角含兩翼，不只弧頂 |
| 最近防守者 (Defense Dashboard) | DFGA / DFG% / DIFF%（總體、2PT、3PT） | 球員 `leaguedashptdefend`、全隊 `leaguedashptteamdefend`（`MATCHUP_CATEGORIES`） | 是「最近防守者」資料，**不是** `leagueseasonmatchups` 的對位資料；DIFF% 負=守得好 |
| 個人效率 (Player Efficiency) | USG% / AST% / AST/TO / TOV% / OREB% / DREB% / REB% / PIE | `leaguedashplayerstats?MeasureType=Advanced`（`PLAYER_ADVANCED_FIELDS`） | 球員整季快照；在場效率不在這裡（見 On/Off）；`TM_TOV_PCT` 不乘 100 |
| 得分組成 (Scoring Breakdown) | %PTS Paint／Mid-Range／3PT／FT、快攻／失誤後占比、情境得分 | `leaguedash*stats?MeasureType=Scoring`＋`Misc`（`SCORING_FIELDS`／`MISC_FIELDS`） | 前四段合計 100%；快攻、二波、失誤後和前四段重疊；全隊沒有 PFD |
| 護框 (Rim Protection) | DFGA / DFG% / DIFF% · < 6 Ft | 同上，`DefenseCategory=Less Than 6Ft` | 籃框 6 呎內、該球員是最近防守者的出手；不是 Player Tracking 的 `DEF_RIM_*`（那個沒有 vs 平常） |
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
| Playtype 類型（定點投籃、擋拆持球者…） | Spotup / PRBallHandler… | Synergy `PLAY_TYPE` | 中文一律取 `window.ptName(type)`（`constants.js`），與 glossary `PT_*` 同名；改名兩處一起改 |
| Playtype 回合數／每場回合數 | Poss / Poss/G | Synergy `POSS` | 2026-11-21 起全站用「回合數」，不再寫「球權」（使用者指定，與貼文「回合數／每回合得分」一致）；「搶到球權」這類拿到球的意思改寫句子，不硬換 |
| Playtype 每回合得分（防守端：每回合失分） | PPP | Synergy `PPP` | 同上；引用寫「轉換進攻每回合得分」「防守轉換進攻每回合失分」，成對時「轉換進攻 回合數／每回合得分」 |

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

**全部逾時（`curl: (28) ... 0 bytes received`）多半是瀏覽器指紋被擋，不是 IP**（2026-10-29：`chrome110` 整天全逾時、同機 `safari15_5` 0.5 秒回 200）。stats.nba.com 前面的 Akamai Bot Manager 會檢查 TLS 指紋，被判定是機器人時不回 403、直接不回應。2026-10-29 起 `nba_common` 自動處理：這次執行第一個請求重試耗盡、且還沒有任何成功時，依 `FINGERPRINTS` 順序換其他指紋各試 1 次，成功就寫進 `nba_fingerprint.json`（本機、不進版控）下次沿用；所有腳本共用（名冊也走 `fetch_with_retry`）。User-Agent 不再隨機換，由 impersonate 帶出與指紋相符的 UA。log 看 `🔁` 行；`fetch_status.json` 記 `fingerprint`／`switchedFrom`／`triedAll`，看門狗 log 與通知會寫「指紋 X」或「🔁 指紋 A 沒回應，已自動換成 B」，換過的那天 15:00 另跳「已自動換指紋」通知。**全部指紋都不行**＝多半是 IP 被擋或伺服器問題，block guard 照常收手，等冷卻（網路回報約 1 小時起跳、不固定）。候選全被擋時：升級 `curl_cffi`（本機 0.6.2，新版有較新的指紋；版本跨度大要另外測），再把新名稱加進 `FINGERPRINTS`；想從頭試就刪 `nba_fingerprint.json`。參考：[swar/nba_api#652](https://github.com/swar/nba_api/issues/652)

### Q: 網站少了昨晚那場比賽
正常情況下台北 15:00 看門狗會補上暫定版（美東晚上的比賽、台北早上結束，03:00 主排程那時還沒開賽），隔天 03:00 自動換成定稿版。15:00 前想先看：`python scripts/fetch_data.py --games-only`（約 28 requests，同樣是暫定版）。15:00 後還沒有：看 `watchdog_log.txt` 最後幾行與通知中心，再翻 `fetch_log.txt`（或 `fetch_log_watchdog.txt`）的 `=== [watchdog]` 段落；`python scripts/watchdog.py --dry-run` 可看它現在的判斷。

### Q: 想新增數據（三種情境，皆只需改一處後端）
1. **既有 API 的新欄位**（如籃板再加一欄）：`nba_common.py` 對應的 `*_FIELDS` 設定表加一行 `(輸出欄名, API 欄名, 是否百分比)`
2. **`leaguedashptstats` 新類型**（如 SpeedDistance）：`TRACKING_TYPES` 加名稱 + `TRACKING_FIELDS` 加對應欄位列表
3. **最近防守者多一類**（如 `Less Than 10Ft`）：`nba_common.py` 加欄位表＋`MATCHUP_CATEGORIES` 加一列（每日球員＋全隊各 +1、每場 +1 request）＋`RANK_LOWER_BETTER`／`RANK_SKIP`；舊資料用 `backfill_history.py --only-matchup --matchup-cats 標籤`、`backfill_games.py --matchup-only --matchup-cats 標籤` 補；前端 `defenseDefs` 加格子（vs 平常要加進 `GameAgg.NORMAL_DEFS`，並給 `att`／`signed`）
4. **全新 endpoint**（如 Hustle）：`nba_common.py` 仿照 `fetch_clutch()` 寫一支新函式（用 `fetch_with_retry`）。要成為快照的新類別，在 `TEAM_SNAPSHOT_CATEGORIES`／`PLAYER_SNAPSHOT_CATEGORIES` 加一列（每日 `fetch_data.py` 與歷史 `backfill_history.py` 都會抓、都會寫進同名文件欄位；全隊每日會自動算聯盟名次），再加進 `fetch_data.py` 的 `DATA_KEYS`；併進既有類別（如 defense）就在該列的 `merge_maps` 裡多呼叫一支

前端同步：`components/constants.js` 加 defs（含 `englishLabel`）→ `App.js` 對應區塊 → `python scripts/bundle.py` 重新打包。每日與歷史回補會自動同步生效（共用 nba_common）。

不確定 API 欄名時，先抓一次 response 印 `resultSets[0]['headers']` 對照（欄名錯誤會被 `safe_col` 靜默吞成 0）。

**球員聯盟名次**（2026-11-13 起）：球員新欄位只要在 `PLAYER_RANK_CATS` 的類別裡就會自動排名，方向一樣看 `RANK_LOWER_BETTER`／`RANK_SKIP`；新的命中率類欄位要在 `PLAYER_RANK_ATT_PAIRS` 加「比率欄 → 出手欄」（不加就沒有出手門檻，1 投 1 中會排第一）；門檻改 `PLAYER_RANK_RULES`。前端格子傳 `rank={window.leagueRank(類別, 欄位)}`＋`rankWhy={window.rankWhy(類別, 欄位)}`。

**全隊欄位的聯盟名次**（2026-10-28 起）：全隊新欄位會自動算名次（預設數值大＝第 1）。越低越好的（失誤、對手命中率等）加進 `nba_common.RANK_LOWER_BETTER`、排名沒有意義的加進 `RANK_SKIP`；前端那一格傳 `rank={window.leagueRank('類別', '欄位')}`（或 `TrackingCardRow rankCats`）才會顯示。新類別若要排名，抓取時傳 `team_id=0` 並經 `split_league()`，名次寫進 `ranks.{類別}`。

### Q: 逐場加總和整季快照對不上（例如 Splits 全季切入次數比 NBA 少）
2026-11-13 起看門狗每天 15:00 會自動比對全隊，有落差會跳通知「逐場資料可能少抓」，`watchdog_log.txt` 列出欄位、落差、可疑日期與重抓指令；手動檢查用 `python scripts/watchdog.py --check-data --dry-run`。只有某位球員對不上、全隊沒超過門檻時，要自己查：讀本季全隊 bundle，列出每場的那個欄位，看有沒有明顯偏低的場次。2026-11-12 發現開季頭 4 場（10/21～10/26）的 Tracking 切入次數只有後來的一半：單場文件是賽後 12 小時內抓的，NBA 之後補正了，但文件已定稿不會再重抓（`tracking_zero_filled` 只抓得到「整組 0」）。修法：`python scripts/backfill_games.py --type regular --dates 日期,日期`（每場約 28 requests）→ `build_bundles.py --season X --type Y` → `build_insights.py` → `cache.js` 的 `CACHE_NS.gc.ver` +1。注意最近防守者的「場均」分母只算有防守到出手的場次，用「場均 × 出賽場數」比對會誤判，要比加總。

### Q: 單場題材（本場題材）的門檻、指標或文案想調整
- **門檻／指標**：改 `nba_common.py` 的 `INSIGHT_RULES`（前幾名、最少樣本、上場分鐘、每人／全場張數、Four Factors 權重）、`INSIGHT_TEAM_METRICS`（加一列：欄名、中文、方向 high／low／neutral、最低出手）、`INSIGHT_PLAYER_METRICS`（欄名、中文、本場門檻）→ `python scripts/build_insights.py --dry-run --date 2026-11-02,2026-10-31` 看結果 → 拿掉 `--dry-run` 重算全部（約 20 秒，只寫有變的）→ `cache.js` 的 `CACHE_NS.gc.ver` +1（快取本身有 1～7 天期限，不急可不換）→ `bundle.py`。新增 low 方向的全隊指標時，前端 `GamePage.js` 的 `FEWER_IS_BETTER` 也要加（決定用「多／少」字眼）
- **文案**：只改 `GamePage.js` 的 `story`（`tagText`／`prevText`），不用重算
- 欄位必須在逐場 bundle 裡（`build_bundles` 的 stats）；Synergy／Clutch 沒有逐場資料不能用

### Q: 賽前預覽或完整賽程沒有更新／想調內容
- **沒更新**：`fetch_log.txt` 找「賽前預覽已寫入」；看到「⚠️ 賽前預覽」是賽程檔或全隊數據沒抓到，前端沿用前一份。手動補：`python scripts/build_preview.py`（3 requests），前端快取 3 小時，要立刻看就清 localStorage 裡 `wt_c_pv_` 開頭的鍵
- **對照表加指標**：`nba_common.PREVIEW_TEAM_FIELDS` 加一列（方向 high／low／neutral）＋前端 `constants.js` 的 `PREVIEW_LABELS` 補名稱；衍生欄位在 `build_preview.league_table` 算
- **近況場數**：`PREVIEW_FORM_N`；**特殊賽事標籤**：`constants.js` 的 `SPECIAL_GAME_TAGS`（NBA 改名就加一筆，沒對到不顯示）
- **文件格式改了**：`cache.js` 的 `CACHE_NS.pv.ver` +1
- **日期規則**：資料、網址、月曆一律美東，開賽時間一律經 `kickoffTPE`；不要在別處自己加 8 小時

### Q: 條件戰績想加新的條件類型或調規則
- **調規則**（條件數上限、交易截止日、命中率最少出手）：只改 `constants.js` 的 `CONDITION_RULES`；說明文字同步改 `glossary.js` 的 `SPLIT_COND`
- **多一個可選指標**：Splits defs 有的會自動出現；只想給條件用的次數欄加進 `splitConditions.js` 的 `EXTRA`（欄位要在逐場 bundle 裡）
- **新條件類型**（如主客場、背靠背、對手）：`splitConditions.js` 的 `evaluate` 內 `test()` 加一種 `kind`，`parse`／`serialize`／`isComplete`／`condLabel` 一併處理；`PeriodControl.js` 的 `condRow` 指標下拉加選項（或另一個下拉；2026-11-12 前在 `SplitsTab.js`）。網址格式向下相容：舊連結只會少條件、不會壞
- 本機驗證記得避開快取（面板網址加 `?nc=1`），否則會看到舊版

### Q: 組合頁沒更新／想調門檻或欄位
- **沒更新**：`fetch_log.txt` 找「組合已寫入」或「組合與現有 … 相同」；看到「⚠️ 組合」是某種人數沒抓到或完整性檢查沒過，舊文件保留、隔天自動重試。手動補歷史：`python scripts/backfill_history.py --season X --type Y --only-lineups`（3 requests）
- **最少分鐘預設與選項**：`LineupsPage.js` 的 `LINEUP_MIN_DEFAULT`／`LINEUP_MIN_OPTS`
- **多一種人數（如四人）**：`nba_common.LINEUP_GROUPS` 加 4（每天 +1 request）＋`LineupsPage.js` 的 `LINEUP_SIZES`／`LINEUP_LABEL`；完整性檢查自動適用
- **多存欄位**：`nba_common.LINEUP_DOC_FIELDS` 加一行＋表格欄位；歷史賽季要重跑 `--only-lineups` 才有

### Q: 期間篩選想加新類型，或新區塊該不該跟著期間
- **新期間類型**：只改 `periodFilter.js`（`apply` 加分支、`serialize`／`parse` 加寫法）與 `PeriodControl.js` 的選項，各章節不用動
- **新區塊**：資料來自逐場 bundle／逐球 → 吃 `periodCtx`／`periodDates`；來自整季快照 → 包 `UI.Locked on={periodOn}`。不可默默顯示沒篩選的數字
- **整季快照的區塊想改成跟著期間**：先看單場文件有沒有能重算的原始數（2026-11-20 總覽效率三塊就是從單場 box 的進階欄位還原）。需要的單場欄位放進 bundle 每場的 `adv`（`build_bundles.py`，不放 `stats`），計算寫成 `GameAgg` 的純函式＋測試，再用整季重算對帳快照：對得上的當精確值，對不上的標「≈」（`StatCell approx`）並在說明寫明。篩選時不給聯盟名次（只有整季資料能排名）
- **引用的期間寫法**：`Period.apply` 回傳 `label`（畫面短寫法，如「2026-11-01~2026-11-17」）與 `cite`（引用寫法：日期區間「A 至 B」、只填一端「A 起」／「至 B」，其他同 label）；App 把 `CiteCtx.period`＝「cite（N 場）」、`periodLabel`、`periodEnd`（日期區間的結束日）寫進引用情境。`citeLine`／`Quote.make` 對 `asOf: 'agg'` 的數字自動補期間（說明文字已寫到 cite 或 label 就不重複），有 `periodEnd` 就不寫「截至」、引用籃統計日用結束日；不跟期間的逐場數字（身分列的全季值）傳 `periodless: true`。新區塊的引用不要自己寫期間，交給 `citeLine` 補
- **新章節**：`App.js` 的 `TABS` 標 `period: true` 才會有綠點、不顯示「整季數據」提示
- **條件編輯器**在 `PeriodControl.js` 的 `PeriodPanel`（原本在 SplitsTab）

### Q: 比較頁想多比一項或調規則
- 在對應的 defs（`constants.js`）加指標，比較頁自動出現；次數類記得標 `neutral: true`（不列入差距最大、不上色）
- 差距最大的門檻（每人至少幾場、列幾項）在 `compareData.js` 的 `biggestGaps`；可選期間在 `PERIODS`

### Q: 歷史定位的門檻想調整
- **格子標籤**（本場 vs 季平均）：改 `nba_common.INSIGHT_MARK_RULES`（top、max_ties、min_n、min_att）或 `INSIGHT_MARK_METRICS`（要和 `GamePage.js` 的 `VS_KEYS` 對應）→ `build_insights.py --dry-run --date …` → 重算 → 視需要 `CACHE_NS.gc.ver` +1
- **「?」小卡**：只改 `constants.js` 的 `HISTORY_RULES`，不用重算
- `min_att`／`minAtt`、`min_n`／`minN` 兩邊必須同值；想讓別的格子也有標籤，把欄名加進 `INSIGHT_MARK_METRICS` 並確認該欄在球員逐場 bundle 裡

### Q: 薪資資料怎麼更新
改 Google Sheet（或把 Spotrac／Fanspo 截圖、網頁文字給 Claude 轉成新列）。每日排程會自動同步；想立刻生效就手動跑 `python scripts/sync_salary.py`（先 `--dry-run` 看摘要）。發佈的 CSV 有幾分鐘快取，剛改完可能讀到舊版，稍等再跑。何時要更新：休賽期簽約、選項執行、交易截止日、裁員、10 天合約、牽涉選秀權的交易、觸發鎖死；每年 7 月新門檻；每季季末 `tax_history` 加一列。

### Q: 想關掉薪資×表現
Sheet `settings` 分頁的 `show_value` 改成 FALSE，同步後整個區塊消失，不必改程式。

### Q: 對戰分析的標籤或近三季規則想調整
只改 `components/constants.js` 的 `window.MATCHUP_RULES`（`halfSeasonGames` 近三季多含一季的門檻、`minGames` 標籤與淡化的最少場數、`rivalTopN` 勁敵幾隊、`topN`／`tagMinZ` 順手棘手幾隊與 z 門檻、`factorTopN` 關鍵因子幾項），再 `python scripts/bundle.py`。`glossary.js` 的 `MU_TAGS`／`MU_RANGE` 說明文字寫死了數字，改門檻時一起改。

### Q: 發現單場球員文件混入不是當時隊員的球員
症狀：某場 `players` 得分加總 ≠ 全隊得分，或球員 Splits 出現他還沒加入時的比賽。跑 `python scripts/backfill_games.py --season X --type Y --clean-players --dry-run` 看名單，確認後拿掉 `--dry-run` 寫入，再 `python scripts/build_bundles.py --season X --type Y`，最後把 `cache.js` 的 `CACHE_NS.gc.ver` +1（舊版鍵開站時自動清掉）。`--clean-players` 只做多欄位對帳、不看 box；另一種更權威的做法是用 box 上場名單（tricode＝MIN 且有 stats）的 personId 比對，只適用於有 box 的場次（2025-26 起，2026-10-19 清理 2025-26 用的就是這個，見「單場數據」）。

### Q: 想追蹤其他球隊
改 `scripts/nba_common.py` 的 `TEAM_ID` 常數（所有腳本共用）。

### Q: PageSpeed 效能分數為什麼和實際感受差很多
PageSpeed 的效能分數是「模擬推算」，每次會跳動：同一版曾給第一個畫面 1.6 秒與 8.4 秒兩種估算。以同樣條件（慢速 4G、CPU 降速、全新訪客）實測為準：2026-10 為第一個畫面約 1.6 秒、主要內容約 9.7 秒（「近期異動」要等 Firestore 資料）。另外 PageSpeed 的測試環境裡匿名登入會失敗（Google 驗證端點 403），所以「最佳做法」會被扣錯誤紀錄，一般讀者不受影響。看 PageSpeed 時以**無障礙分數與總傳輸量**為主。

### Q: 歷史快取要怎麼清
自己的瀏覽器：DevTools → Application → Local Storage 刪 `wt_c_hist_` 開頭的鍵（console 跑 `Cache.stats()` 可看各命名空間筆數）。要讓所有讀者都重讀：`cache.js` 的 `CACHE_NS.hist.ver` +1 後打包推送。

---

## 已知技術決策

- **不用 GitHub Actions**：datacenter IP 容易被 NBA 封鎖，改用本機 Windows 排程（家用 IP）。workflow 檔已於 2026-07-02 移除
- **欄位設定表驅動**：抓哪些欄位寫在 `nba_common.py` 的 `*_FIELDS` 設定表，不寫在程式邏輯裡；加新數據只改設定表
- **全聯盟單次請求優先**：球員數據一律抓全聯盟再過濾（順帶解決轉隊歸屬問題）；唯一逐球員的 `shotchartdetail` 降為每週執行以控制被擋風險
- **`REB_COL_PCT` 來源是 `REB_CHANCE_PCT`**：NBA API 已無 `REB_COLLECT_PCT` 欄位，輸出欄名保留 `REB_COL_PCT` 以相容前端與歷史資料
- **輕量預編譯、不用打包框架**：React 仍走鎖版本 CDN（Recharts 已於 2026-10-28 移除）；JSX 與 Tailwind 由 `bundle.py` 呼叫 esbuild／tailwindcss 預先編譯，產物進版控，GitHub Pages 直接服務 main（無 CI 建置步驟）
- **PlayerID 為主鍵（歷史）**：跨賽季穩定，姓名僅供顯示。每日快照仍用 playerName-keyed（沿用舊結構），靠前端 normalizer 對齊
- **歷史賽季只存終點快照**：每季 1 個文件，省 Firestore 讀寫額度；逐日 backfill 約需 5,600 次 API call，目前不做
- **歷史賽季走前端快取**（`Cache` 的 `hist`，24 小時）：歷史快照不會變，重複造訪不必再讀 Firestore（Blaze 方案每日 5 萬次讀取免費，超過才計費）
- **NBA 反爬蟲做法**（`nba_common.py`）：`curl_cffi` 模擬瀏覽器 TLS 指紋（`FINGERPRINTS` 依序試，被擋自動換並記在 `nba_fingerprint.json`；User-Agent 由指紋帶出、不另外隨機換）＋`x-nba-stats-origin`、`Sec-Fetch-*` 等標頭；每次請求間隔 2 秒，失敗遞增等待、最多重試 3 次，耗盡印 `[FAILED]` 帶部分資料繼續；每日抓取開頭連續 3 項失敗就收手（`enable_block_guard`）；欄位一律 `safe_col()` 取值。細節見 FAQ「NBA API 跑失敗」
- **跨賽季折線圖以賽季為 X 軸**：歷史賽季只有終點快照，無法畫逐日；用「賽季順序軸」串接歷史終點 + 當季最新

---

## 維護重點

> 這一節專門寫給接手的 Agent。前面章節是「怎麼運作」，這節是「動它之前要知道什麼、下一步可以做什麼」。

### A. PlayType (Synergy) 維護

- **資料來源**：`fetch_synergy_data()`（`nba_common.py`），11 種進攻 + 9 種防守（防守跳過 Cut/Misc）。PlayType 清單 `PLAY_TYPES` 是 NBA 固定的，**不能自訂新增**。
- **已改用 `PerMode=Totals`**：每個 stats item 除了顯示欄位（poss/freq/ppp/fgPct/percentile），還存整數總量 `gp/possTotal/ptsTotal/fgmTotal/fgaTotal`。顯示的 `poss` 是 `possTotal/GP` 推導、比率欄位與 PerGame 模式相同。**動這支函式時，顯示欄位與總量欄位都要保留**（總量是單場還原的唯一材料）。
- **Synergy 不支援 `DateFrom/DateTo`**（實測參數被忽略）→ 這是 PlayType 沒有單場資料的根本原因，也是為何 `_with_date()` 不套用在 Synergy。
- **PERCENTILE 是全聯盟相對排名**：只在賽季累積下有意義，無法相減、無法還原單場、單場也沒有百分位。
- 前端顯示：`PlaytypeSection.js`（表格／卡片）＋`PlayTypeCard.js`＋總覽強弱項＋雷達圖（用 percentile）。

### B. 單場 Playtype（2026-11-21 完成，全隊）

現況細節見「單場數據」的 `playtype` 與「單場比賽頁」的 Playtype 分頁。動它之前要知道：
1. **還原邏輯只在 `nc.split_game_playtypes`**（純函式，`tests/py/test_game_playtype.py`）；寫入 `nc.write_game_playtypes`（冪等，內容同就不寫）。欄位名與前端 `GamePT.derive` 一起改（契約測試會抓）。
2. **單場重抓（`.set()`）會洗掉 `playtype`**：所以寫入放在 `capture_recent_games()` 擷取之後，同一輪補回。新增其他會整份覆寫單場文件的流程（例如 `backfill_games.py` 整場重補），跑完要再跑 `--playtype-only`。
3. **手動重算**：`python scripts/backfill_games.py --season S --type regular --playtype-only --dry-run` 看差異 → 拿掉 `--dry-run` 寫入；要讓已開過網站的人立即看到，`cache.js` 的 `CACHE_NS.gc.ver` +1（本季單場快取 1 天也會自己過期）。
4. **拆不開的場次救不回來**：比賽隔天的快照要在下一場打完、NBA 把它算進 Synergy 之前寫成。漏跑的日子不能事後補（Synergy 不吃日期）。
5. **想多顯示欄位**（失誤、罰球、and-1、得分比例，或 eFG%）：API 有 `TOV_POSS_PCT`／`FT_POSS_PCT`／`SF_POSS_PCT`／`PLUSONE_POSS_PCT`／`SCORE_POSS_PCT`／`EFG_PCT`，但目前沒存；要先在 `fetch_synergy_data` 存成整數或可還原的值（比率 × POSS 能否還原成整數要先驗小數精度），只對之後的比賽有效 → `split_game_playtypes` 加欄位 → `GamePT.derive` 與畫面。Synergy 沒有三分命中數。
6. **個人單場不做**：球員 Synergy 只回傳整季累計 ≥ 10 回合的類型，類型第一次越過門檻那場的數字含未知基底（0～9），每場只能精確還原約 40～89% 的回合（2026-11-21 實測）。
7. 主畫面的單場面板（`SingleGamePanel`）沒有 Playtype，要加的話讀同一個 `playtype` 欄位、沿用 `GamePT.derive`。

### C. 常見雷區（都踩過，務必記得）

- **新 Firestore 集合 = 必加 `*` 索引豁免**：否則該集合的每個欄位都會自動建索引，儲存量約是資料的 5～16 倍（見「Firestore 索引豁免」）。和下一條 read 規則一起做。
- **新 Firestore 集合 = 必加 read 規則**：每加一個集合，都要去 Firebase Console 在 `match /databases/{database}/documents { ... }` **大括號內**加 `allow read: if request.auth != null`。這個 session 踩了兩次（`wolves_shotcharts`、`wolves_*_games`），症狀都是前端 `Missing or insufficient permissions`。放到大括號外會靜默失效。
- **`.bat` / 重導向輸出要 `PYTHONIOENCODING=utf-8`**：腳本裡有 emoji（🔑✅），Windows 預設 cp950 會在 `print` 時崩潰。正式 `.bat` 已設；手動 `python x.py > log.txt` 也要設，否則死在第一個 emoji。
- **新每日欄位要加進 `DATA_KEYS`**（`fetch_data.py`）：否則去重不會比對它，可能漏寫或誤判相同。
- **改 `components/*.js` 後一定要 `python scripts/bundle.py`**：前端讀的是 `dist/components-bundle.js` 與 `dist/app.css`；新元件還要加進 `bundle.py` 的 `ORDER`（放在 `App.js` 之前）。
- **GitHub Pages 偶發 `Deployment failed, try again later`**：GitHub 暫時性，`gh run rerun <id>` 重跑即可，不是程式問題。
- **Firestore 查詢只用 doc id 升冪範圍**：`orderBy(documentId(),'desc')`、`limitToLast` 都需要另建索引，會回 `failed-precondition`；讀取錯誤一定要接住並顯示（`getDocs(...).catch`），否則失敗時畫面永遠停在骨架。
- **slate-500/600 已被改成較亮的自訂值**（對比 AA）：看到 `text-slate-500` 不等於 Tailwind 原生色。
- **讀 Firestore 要等匿名登入完成（`isCloud`）**（2026-10-19 修）：安全規則要求已登入。原本當季快照訂閱只檢查 `window.db`，登入較慢時先被拒，錯誤狀態又只在換賽季時清除，畫面卡在「讀取失敗」。新增讀取的 effect 一律加 `isCloud` 條件
- **`UI.Section` 的 `right` 區手機會自行換行，但放很多按鈕（球員 chips 等）仍會撐寬版面**：改放區塊內容第一行
- **Bash heredoc 裡的 Python 若含 JSX／反引號／`'''`** 容易解析失敗：改寫成檔案再執行
- **季末／每日快照的球員數據是「整季合併」**（`backfill_history.py` 不加 TeamID 篩選）：季中轉隊的球員含他隊比賽。要「只算灰狼」的累計值，一律用逐場 bundle（2026-10-20 薪資×表現踩過）
- **薪資頁的 apron 空間要用 apron 薪資**（含 unlikely incentives），不是奢侈稅薪資；Sheet 漏填 unlikely 時頁面會出黃色「資料對帳」提示
- **清理 Firestore 資料後，前端快取要換版**：一律改 `cache.js` 的 `CACHE_NS` 版本（見「localStorage 快取」）。2026-10-23 踩過：當時單場文件有兩處各自的快取，只換了一處，單場頁的永久快取差點把清理前的資料留在讀者瀏覽器裡。現在全站只有 `Cache` 一處；`grep localStorage.setItem` 只該剩偏好（`wt_pref_*`、雷達軸）與引用籃
- **不在場效率的場次範圍要含該員沒上場的全隊場次**（2026-11-20）：只算他出賽期間（從首場起）會和 NBA 整季值差 3 分；沒上場的場次算整場全隊。也不可用「全隊 − 在場」推不在場效率（回合數對不上）
- **新的單場欄位要進 bundle 時放每場的 `adv`，不放 `stats`**：`stats` 每個數字欄都會被 `GameAgg.aggregate` 平均、被看門狗逐場對帳加總，放錯會多出無意義的欄位或誤報
- **「近 N 季」這類範圍不要嚴格照季數切**：開季時當季只有幾場，嚴格三季等於兩季的量；對戰分析用「當季未過半多含一季」解決
- **對戰分析的標籤要有場數門檻**：「前 3 名」在只看本季、只有 1 個對手時也會選到它（曾把只打 1 場的 MIA 標成勁敵）

### D. 效能與擴充強化點

- **讀取配額是唯一會隨流量成長的**：2026-10 起開站只讀近期快照（見「效能與無障礙」），整季只在需要時才讀。寫入極寬鬆；儲存在 2026-10-19 設索引豁免後也寬鬆（見「Firestore 方案與用量」）。
- **中文字型約 1 MB**（Noto Sans TC 切片，首次造訪下載、之後快取）：使用者 2026-10 決定先不換；若要再省，可改用系統中文字（微軟正黑體／蘋方），英數字型不受影響。
- **每日請求預算**：目前 84/天（2026-11-13 實測：stats.nba.com 83——Synergy 40、Tracking 12、其他 31，含名冊與賽程——＋賽前預覽的 CDN 賽程檔 1；2026-11-12 加球員進階＋得分組成 +5、停抓投籃拆分 −2、最近防守者兩分／護框 +4、二人／三人組合 +2；2026-10-28 加全隊進階 +1，全隊類別改拿 30 隊不增加請求），比賽隔天另加單場每場約 28（含對手、box score、進階 box 與單場 On/Off；2026-11-12 灰狼球員最近防守者 +2）。看門狗（2026-10-26 起）正常日只加 1（讀賽程）；比賽隔天下午先抓暫定版再加約 30（隔天 03:00 定稿時同一場會再抓一次）；主排程失敗的日子補一次完整抓取約 95。加新 endpoint 會同步升高 + 被擋風險。原則：**優先用「全聯盟單次請求」的 leaguedash 系列**（一次拿全隊）；逐球員的 `shotchartdetail` 才降為每週；每日只另加「單場全隊」投籃查詢（比賽隔天 +1）。真要加逐球員數據，比照 `fetch_shotchart.py` 走每週排程。
- **單場資料是累積欄位的子集**：`nba_common.fetch_single_game()`（回補與每日共用）只抓基本數據 + tracking + 對位防守 + Hustle + 分區投籃（＋對手同樣欄位與 box score）。想讓單場也有投籃拆分 / 防守 box / 對手分區，在這個函式加對應 `fetch_*`，再重跑回補（`--start/--limit` 分批）。`SingleGamePanel` 會自動顯示新增的群組（它只渲染「有資料」的 def）。
- **配色未抽變數**：色值以 hex 直接寫在各元件（Tailwind arbitrary values）。改配色目前靠 `sed` 全域替換 + CLAUDE.md 色票表。若之後配色常改，值得抽成 CSS 變數或 Tailwind theme extend（一次性重構所有 `[#...]` 類名）。
- **`SingleGamePanel` 的日期選單靠索引文件**：`wolves_games_index/{season}_{type}`。當季由每日 `fetch_data.py` 自動重建；歷史賽季回補後跑 `backfill_games.py --index-only`。

### E. 待辦與可清理

- 技術債（2026-11-19 盤點）：A～F 批都已完成（F 批 2026-11-19：`App.js` 拆出 `appLogic.js`／`appData.js`／`appRoute.js`，畫面組裝仍在 App.js）；**Firestore 安全規則進版控**未做（需要使用者安裝 firebase CLI 並 `firebase login`）
- 對戰分析後續（原 B2，都要先跟使用者確認，緣由見 history.md「對戰分析後續構想」）：對手 Tracking／Hustle 逐場資料從 2026-10 起才有，累積幾季後可加「對手端進階數據」；2022-23～2024-25 補 box score（`--box-only`，約 290 場 × 4 requests）就能讓每節分差、對手 box 涵蓋整個近三季；「急停出手數」等出手次數類指標是否改 `neutral: true`
- 薪資：Sheet 的 2025-26、2026-27 奢侈稅率（1.0／1.25／3.5／4.75，累犯 3.0～6.75）與 2024-25（1.5／1.75／2.5／3.25）不同，待使用者核對；其他待確認數字見 history.md「2026-10-20 薪資頁（Cap Sheet）」的後續清單
- 2026-11-19 已清：早期 `debug_*.py`／`test_*.py`、`run_backfill_next.bat`、`scripts/backfill_queue.txt`、舊回補驗證檔與 log 都搬到 `_local/`（未刪除）
- `AGENTS.md`（給其他 AI 工具的 2026-07 舊副本，已被 .gitignore 忽略、不進版控）內容過時，以 CLAUDE.md 為準
