
# Wolves Tracker 專案快速查表

## 常用指令
- 每日抓取：`python scripts/fetch_data.py`（休賽期自動跳過；Synergy 與 base 都空才當被擋而終止，開季 Synergy 未釋出照常寫入；補期末快照用 `--force-type playoffs --date YYYY-MM-DD`；只抓缺漏單場 `--games-only`；每次執行寫 `fetch_status.json`，被擋結束碼 2；開頭連續 3 項失敗就提前結束，`nba_common.enable_block_guard`）
- 看門狗：排程 `WolvesWatchdog` 台北 15:00 跑 `python scripts/watchdog.py`（主排程沒完成 → 完整補抓、昨晚那場缺 → `--games-only`，有補抓或失敗才跳桌面通知，log `watchdog_log.txt`）；早上排程 `WolvesWatchdogMorning`（09:00＋登入＋解鎖，跑 `--morning`：只在 03:00 主排程今天沒完成時完整補抓，今天已失敗過就不重試、留給 15:00，否則不發 request 直接結束）；手動 `--dry-run`（只判斷）／`--test-notify`；主排程跑超過 60 分鐘就放棄這次補抓（不並行）；`run_watchdog.bat` 的 stderr 不可導到 `watchdog_log.txt`（檔案鎖），補抓輸出遇 `fetch_log.txt` 被鎖改寫 `fetch_log_watchdog.txt`
- 投籃熱圖：每日抓取已順帶增量（定稿場次每場 1 request 併入 `wolves_shotcharts`，以全隊文件 `gameDates` 判斷已併入）；每週整季重抓 `python scripts/fetch_shotchart.py` 對帳＋更新受助攻比例（跨季重跑 `--season 2024-25 --type regular`）
- 單場回補：`python scripts/backfill_games.py --season 2024-25 --type regular`（補失敗場 `--dates 2024-11-21,2025-01-09`；只補 box score `--box-only`，每場 2 requests，2025-26 已補）
- 單場球員混入外隊：`backfill_games.py --season X --type Y --clean-players --dry-run`（多欄位對帳，0 request；確認後拿掉 `--dry-run` 寫入→`build_bundles.py`→前端單場快取鍵換版，見 doc/handover.md；2022-23～2025-26 已清）
- 歷史回補：`python scripts/backfill_history.py --season 2024-25 --type regular`（完整類別終點快照；只補 Hustle 欄位加 `--only-hustle`，每份 2 requests）
- **逐場打包**：回補 games 後跑 `python scripts/build_bundles.py --all`（前端 Splits/總覽讀 bundle）
- 薪資同步：`python scripts/sync_salary.py`（Google Sheet 發佈 CSV → `wolves_salary/main`；先 `--dry-run`；每日排程已順跑；Sheet 欄位見 doc/handover.md「薪資資料」）
- 前端打包：改 `components/*.js` 後必跑 `python scripts/bundle.py`（esbuild 編 JSX＋Tailwind 產 CSS＋index.html 蓋版本號；勿手改 dist/；新電腦先 `npm ci`）
- 網站圖示：改 `icons/icon.svg`／`icon-maskable.svg`／`og-image.svg`（分享預覽圖）後跑 `python scripts/build_icons.py`（resvg 產 apple-touch-icon、manifest PNG 與 `og-image.png`，一起提交）；刊頭站徽同一張，favicon 仍是 index.html 內嵌的 W
- 本地預覽：`python -m http.server 8000`（Firestore lite 走 REST，localhost 可讀）

## 色票（灰狼新品牌，hex 直接寫在元件；改色用 sed 全域替換）
- 主色（進攻/選中/圖表主線/命中）：`#12A150`  · 結構藍（切換/連結）：`#236192`
- 底色：`#0A1626`  · 月光銀（logo 環/標題底線 `/30`）：`#C4CED2`  · 防守/未命中/負值：`#EF4444`

- 無障礙（WCAG AA）：`tailwind.config.js` 已把 slate-500/600 調亮（只當文字色）；品牌色當底時字用 `#0A1626`；`#236192` 不可當小字色；按鈕框 ≥ 24×24 且不重疊（「?」鈕不可用左右負邊距）
- 字體：`font-sans` Noto Sans TC／`font-display` Barlow Condensed（數字/標題）／`font-mono` JetBrains Mono（標籤/原文）；共用介面元件在 `components/ui.js`（`window.UI`：Section/StatCell/Ledger/PctBar/DataTable/Seg/TabBar/Chip/Note），新區塊一律用它組；可橫捲表格裡的展開列一律用 `UI.ExpandRow`（否則手機上內容跟著整張表攤開、落到畫面外）；只給真的有 percentile 的資料畫百分位條
- 介面規則：複製引用收進「?」小卡（`UI.Info` 帶 `cite` 函式），不另放複製圖示；加入引用籃也在同一張小卡（`UI.Info` 帶 `quote`，`StatCell` 自動組，資料與排版在 `quoteFormat.js` 的 `window.Quote`，格式規則見 doc/handover.md）；聯盟名次只給全隊當季快照格（`StatCell rank={window.leagueRank(類別, 欄位)}`，`window.RankCtx` 由 App 設定），逐球自算或期間平均的格子不掛；攻守切換只在 `TABS` 標 `sided` 的章節出現；平鋪指標清單用 `window.metricLabel(m)`（有 `longLabel` 優先）；Playtype 類型名用 `window.ptName(type)`（中文＋小字原文）；一位小數帶正負號用 `window.fix1`（不出現 `-0.0`）；有逐場資料的防守群組列在 `window.GAME_DEFENSE_IDS`；預設一律看進行中賽季，不自動切到舊賽季（`selectedSeasonKey` 不存 localStorage，舊賽季只靠網址 `s=`）
- 統一規則：分頁列一律用 `UI.TabBar`（章節列／薪資頁／單場頁共用）；數字鍵切「目前畫面的分頁列」（主畫面章節由 App 處理、獨立整頁用 `UI.useTabKeys`，沒有分頁列的對戰頁不作用）；同一個控制只放一處（跨季疊圖賽別跟刊頭、近期異動場數跟總覽「平均期間」）；攻守切換標「進攻端／防守端」，不和「防守」章節同字；`UI.Section` 右側操作手機上會自行換行，不可再加會撐寬頁面的固定寬度

## 硬性約束
- 抓取邏輯與欄位對應集中在 `scripts/nba_common.py`——**新增數據改設定表（`*_FIELDS`），不要在 fetch_data.py / backfill_history.py / backfill_games.py 寫重複邏輯**
- **賽季不寫死**：資料賽季 `nba_common.get_current_season()` ＝ 前端 `constants.js` 的 `seasonForDate()`（美東 10/20 切換，兩邊同規則，改界線要一起改）；名冊／薪資賽季 `get_roster_season()` ＝ 前端 `capSeasonForDate()`（7/1 切換，新援判定與薪資當季用）
- 每日快照球員以 playerName 為 key；歷史快照以 PlayerID 為 key（前端 `normalizeHistoryPlayer` 對齊，已展開 base/tracking/shooting/clutch/defense/onoff 各類別），勿更動
- 每日文件欄位：`stats`(Synergy)/`base`/`tracking`/`shooting`/`clutch`/`defense`/`lineups`/`onoff`，全隊另有 `advanced`（全隊進階）/`ranks`（30 隊名次 `{類別: {欄位: 名次, _n}}`，2026-10-28 起、只有當季），新增欄位記得併入 `fetch_data.py` 的 `DATA_KEYS`（去重）
- **聯盟名次**：全隊類別抓取一律 `team_id=0` 拿 30 隊再經 `split_league()` 拆灰狼＋名次（請求數不變）；新增全隊欄位要判斷方向，越低越好加進 `nba_common.RANK_LOWER_BETTER`、不該排名加進 `RANK_SKIP`。球隊 Playtype 名次由百分位換算（`window.ptRank`），球員百分位不可換算
- **新 Firestore 集合必加安全規則 read 白名單**（Firebase Console，見 doc/handover.md）——已踩過多次，症狀是前端 `Missing or insufficient permissions`
- **新 Firestore 集合必加 `*` 索引豁免**（Console → 索引 → 自動 → 豁免項目）；所有集合都已豁免，**只能用文件 ID 範圍／getDoc／整集合讀取**，依欄位查詢會回 `requires an index`。專案是 Blaze 方案（超過免費額度會計費，不會停擺）
- .bat 檔必須 CRLF、`chcp 65001`、無中文註解；排程用 Python 絕對路徑（`Python312`，裸 `python` 會解析到沒套件的版本）
- 不用 GitHub Actions（機房 IP 被 NBA 擋）；正式排程為 Windows Task Scheduler
- 逐球員 endpoint（shotchartdetail）整季逐球員只能低頻執行（每週）；每日只准用「單場全隊」查詢（`GameID`＋`PlayerID=0`，每場 1 request）；games 回補分批、每場約 20 requests，避免被 NBA 封鎖（症狀是 403/429；零星 500/503 是伺服器抖動非封鎖；**全部逾時多半是瀏覽器指紋被 Akamai 擋**，`nba_common.FINGERPRINTS` 會自動換、記在 `nba_fingerprint.json`，log 看 `🔁`，見 doc/handover.md FAQ「NBA API 跑失敗」）
- Pages 部署偶發 `Deployment failed, try again later`（GitHub 暫時性）→ `gh run rerun <id>` 重跑即可
- **薪資：Google Sheet 是唯一資料來源**（`_salary_seed/` 只是本地參考、不提交）；**計算只在前端 `CapCalc`**，`sync_salary.py` 只檢查與對帳；門檻、稅率、限制條文、選秀權、繳稅紀錄都放 Sheet，不寫死。apron 空間用 apron 薪資（含 unlikely incentives）
- **快照的球員數據是整季合併**（含季中轉隊前在他隊的比賽）：要「只算灰狼」的累計值一律用逐場 bundle
- **清理 Firestore 資料後所有 localStorage 快取鍵都要換版**：單場文件有兩處（`SingleGamePanel` 的 `wt_game_v3_`、`gamesData.loadGameDocs` 的 `wt_gc_v2_`）
- 介面標籤用中性字眼，不可貶低對手球隊或球員（對戰分析標籤：勁敵／順手／棘手）

## 前端架構（六分頁，React 18 CDN＋預編譯 JSX/Tailwind）
- `components/*.js` 掛 `window.*`，`bundle.py` 依 ORDER 串接 → esbuild（es2018、不改名識別字）→ `dist/components-bundle.js`；Tailwind CLI → `dist/app.css`。class 必須完整寫在原始碼（不可字串拼接，否則 CLI 掃不到）
- 提交前端改動要連 `dist/` 與 `index.html`（`?v=` 內容雜湊）一起提交
- 圖表一律自繪 SVG（雷達 `RadarSvg`、疊圖 `LineOverlay` 等），不引入圖表套件（Recharts 已於 2026-10-28 移除，省約 120 KB gzip）
- **開站首頁＝最新一場單場頁**（網址沒帶畫面時；當季未開打退上一季最後一場，`homePending` 期間不寫網址）
- 版面（無側欄）：刊頭 `Masthead`（賽季/賽別/賽程月曆 `GameCalendar`/薪資/搜尋）→ 頭像列 `RosterRail`（全隊＋球員）→ 身分列 `IdentityBar`（含時光機「數據截至」，僅當季）→ 章節列 `ChapterNav`（sticky，含攻守）→ 六章節：總覽(`OverviewTab`，含雷達)/Splits(`SplitsTab`)/投籃(`ShootingTab`)/防守/Playtype/跨季(`ComparisonTab`＋`SeasonPaceChart`)
- 單場比賽頁 `GamePage`（`#game=日期[&tab=box|compare|shots][&p=球員]`，獨立整頁，取代主區，**不掛章節列**、用「← 回主畫面」返回）：賽程條＋比分看板常駐，下方單場分頁 概要／Box Score／對比／投籃（沒內容的分頁不顯示、舊場次無 box 時第二頁叫「球員進階」；`p=` 只在 Box Score，舊連結只帶 `p=` 視為 `tab=box`；賽程條換場次保留分頁）；賽程月曆讀 `loadSeasonSchedule`（例行＋季後合併），單場頁跟著該場賽季、其餘跟刊頭所選賽季；灰狼球員一律用 box `personId` 對 players 文件 `playerId`，不用名字；點指標一律跳 Splits 逐場走勢（`m=`/`hl=`）
- 薪資頁 `CapPage`（`#cap[&s=賽季][&tab=contracts|picks|rules]`，獨立整頁）：四分頁＋分頁列上唯一的賽季選單（刊頭在薪資頁隱藏賽季／賽別／日期）；狀態資訊用狀態列＋色點，膠囊只給可點控制項；縮寫金額要能懸停看完整金額；球員對應一律用 `playerId`；薪資×表現可用 Sheet `settings.show_value` 關閉、公式常駐
- 對戰分析（`#vs` 首頁 `MatchupHome`／`#vs=三碼` 單隊頁 `MatchupPage`，獨立整頁）：計算全在 `matchupData.js` 的 `window.Matchup`（只讀既有逐場 bundle＋交手場次單場文件）；範圍預設近三季（當季例行賽未滿 41 場多含一季）、`r=`／`t=` 不影響主畫面賽季；排序上色看偏離程度 z（差距 ÷ 逐場標準差/√n）；門檻全在 `constants.js` 的 `MATCHUP_RULES`；每節分差／對手 box 只有 2025-26 起的場次
- 網址 hash 記住畫面（`urlState.js`；有 `v=` 時完全以網址為準，不退回 localStorage 偏好；球員 `p=ID-名字`（如 `1630162-anthony-edwards`，**只用 ID 對人**，`UrlState.playerToken`／`tokenPlayerId`、名字部分 `window.nameSlug`；舊連結的完整名字仍可讀）；賽季 `s=年份&t=賽別`（當季不寫 `s`；舊格式 `s=2025-26_playoffs` 仍可讀）；Splits 走勢 `m=指標&hl=日期`；單場頁 `game=`（＋`tab=`）、薪資頁 `cap`、對戰 `vs` 都沒有 `v=`）；快捷鍵 `/` 搜尋（`CommandPalette`）、數字鍵切目前畫面的分頁列（主畫面 `1–6` 章節、單場／薪資頁各自分頁）
- **資料層分工**：季平均/Splits/趨勢/對戰 → `GameAgg`(`gameAggregates.js`) 算 **bundle 逐場**（`gamesData.loadSeasonGames`，讀 `wolves_games_bundle`/`wolves_pgames_bundle` 單一 doc，避免 90+ 併發 getDoc 卡死）；Playtype/Clutch/Lineups/On-Off/防守 → 每日/歷史快照；投籃 → `wolves_shotcharts` 逐球；單場對手與 box score → `wolves_team_games/{date}` 的 `opp`/`box`、`wolves_player_games/{date}` 的 `oppPlayers`（單場頁與對戰頁一律經 `gamesData.loadGameDocs` 讀）（2026-10 起的場次；box 另補了 2025-26）；跨季疊圖 → 各季 bundle（`GameAgg.metricOf`）＋多序列 `LineOverlay`
- 季平均加權：百分比欄以 Σ分子/Σ分母 重算（`GameAgg.RATIO_DEFS`），非平均百分比
- 單場數值讀進來一律經 `cleanGameStats`／`cleanGameDoc`（`gamesData.js`）：NBA 未釋出時回的 C&S／Pull Up「整組 0」（同時缺 `TOUCHES`）與 0 分母命中率清成 `null` 顯示「—」，不當真的 0；新增讀 bundle／單場文件的地方要套用。抓取端同規則 `nba_common.tracking_zero_filled` 標 `partial` 讓每日補抓重抓，改規則兩邊一起改
- 當季快照先只讀近期（`snapshotWindowStart`），選日期／開走勢／賽別不足時才補讀整季（`snapFull`）；Firestore 只用 doc id **升冪範圍**查詢（`orderBy desc`／`limitToLast` 需索引會被拒）；前端用 **Firestore lite**（沒有 `onSnapshot`，一律 `getDoc`／`getDocs` 並接住錯誤）
- 場數少於 `SMALL_SAMPLE_GAMES`（10）時用 `window.smallSampleNote` 提示樣本小（Playtype、單場頁季平均）
- 次數類指標（觸球、切入次數等）在 defs 加 `neutral: true`：單場頁／疊圖不標好壞色
- 讀 Firestore 的 effect 必等匿名登入（`isCloud`），否則被安全規則拒絕且錯誤不會自動清掉
- 複製引用格式含當下畫面網址（`UI.citeLine`）；PageSpeed 效能分數是推算、會跳動，以實測與無障礙/傳輸量為準（見 doc/handover.md「效能與無障礙」）
- 刊頭賽季選單只列年份（`SEASON_YEAR_OPTIONS`），例行/季後切換常駐（預設依時節，歷史賽季也能切；App `changeYear`/`changeType` 對回 `selectedSeasonKey`＋`seasonTypeView`，網址格式不變）；時光機（截至某日，影響所有章節）在身分列，不在刊頭；雷達軸自選在 `RadarPanel`

## 規格文件
- `doc/handover.md`：交接手冊（架構/排程/資料結構/FAQ）
- `README.md`：對外說明
