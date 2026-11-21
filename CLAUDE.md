# Wolves Tracker 專案快速查表

> 本檔只放常用指令與「漏了就出錯」的規則，一條一行。箭頭後是 `doc/handover.md` 的章節名（完整條文在「規則與指令細節」）；決定與過程在 `doc/history.md`。

## 常用指令（Python 一律用 Python312；有 `--dry-run` 的先跑它）
- 每日抓取 `python scripts/fetch_data.py`：賽別依全聯盟賽程；附加賽日只抓單場＋預覽；被擋結束碼 2；補期末快照 `--force-type playoffs --date D`、只抓單場 `--games-only` →「自動化排程」
- 看門狗 `python scripts/watchdog.py`（排程台北 15:00＋早上 `--morning`；手動參數見該章）→「自動化排程」
- 投籃熱圖每週 `python scripts/fetch_shotchart.py`（每日抓取已順帶增量；跨季 `--season 2024-25 --type regular`）
- 單場回補 `python scripts/backfill_games.py --season S --type regular|playoffs|playin`（`--dates`／`--box-only`／`--adv-only`／`--onoff-only`／`--matchup-only`／`--playtype-only`；外隊 `--clean-players`；參數見「指令完整參數」）→「單場數據」
- 歷史回補 `python scripts/backfill_history.py --season S --type T`（只補單項 `--only-*`，清單見「指令完整參數」）→「歷史賽季快照」
- 回補 games 後必跑 `python scripts/build_bundles.py --all`；單場題材 `build_insights.py`（改 `INSIGHT_*` 先 `--dry-run --date …`）；賽前預覽 `build_preview.py`；薪資同步 `sync_salary.py`
- 前端：改 `components/*.js` 後必跑 `python scripts/bundle.py`（勿手改 dist/；新電腦先 `npm ci`）；改 `icons/*.svg` 跑 `build_icons.py`；預覽 `python -m http.server 8000`
- 測試 `python scripts/run_tests.py`（`--py`／`--js`；0 request）：改抓取、季平均、快取、薪資、成對規則後必跑；新的成對規則加進 `tests/py/test_contracts.py`；輸出走 `WOLVES_LOCAL_DIR`，不可寫 `_local/`

## 後端與資料
- 抓取邏輯集中在 `nba_common.py`：新數據改 `*_FIELDS`、快照類別改 `TEAM_/PLAYER_SNAPSHOT_CATEGORIES` 並加進 `fetch_data.py` 的 `DATA_KEYS`，不在各腳本重寫
- 賽別一律 `nc.season_type()`／`nc.type_key_of()`；附加賽 `playin` 只有單場（`{season}_playin`），不寫快照、不進例行／季後的任何平均
- 美東時間一律 `nc.now_east()`；資料賽季 `get_current_season()`＝前端 `seasonForDate()`（美東 10/20），名冊／薪資賽季 `get_roster_season()`＝`capSeasonForDate()`（7/1）；改界線兩邊一起改
- 鍵：每日快照球員用 playerName、歷史快照用 PlayerID（前端 `normalizeHistoryPlayer` 對齊），勿更動；單場與網址一律用 PlayerID 對人
- 聯盟名次：全隊類別 `team_id=0`＋`split_league()`；新欄位判斷方向（`RANK_LOWER_BETTER`／`RANK_SKIP`）；新命中率欄加 `PLAYER_RANK_ATT_PAIRS` →「Q: 想新增數據」
- 快照的球員數據是整季合併（含季中轉隊前）：只算灰狼的累計值用逐場 bundle
- 單場 Playtype 只由每日快照相減（`nc.split_game_playtypes`⇔前端 `GamePT.derive`，存 `wolves_team_games.playtype`）；單場整份 `.set()` 會洗掉它，重補後跑 `--playtype-only` →「單場數據」
- NBA 請求：逐球員 shotchartdetail 只能每週；每日只准單場全隊查詢；回補分批；全部逾時多半是指紋被擋 → FAQ「NBA API 跑失敗」
- Tracking「整組 0」前後端同規則（`tracking_zero_filled`⇔`cleanGameStats`）；前端讀單場數值一律經 `cleanGameStats`／`cleanGameDoc`
- 排程是 Windows Task Scheduler（不用 GitHub Actions，IP 被擋）；.bat 必 CRLF、`chcp 65001`、無中文註解、Python 絕對路徑；`run_watchdog.bat` 的 stderr 不可導到 `watchdog_log.txt`；雜物放 `_local/`
- 薪資：Google Sheet 是唯一來源、計算只在前端 `CapCalc`、apron 空間用 apron 薪資 →「薪資資料」
- Pages 偶發 `Deployment failed` → `gh run rerun <id>`

## Firestore 與快取
- 新集合必在 Console 做兩件事：read 白名單（漏了會 `Missing or insufficient permissions`）、`*` 索引豁免 →「Firebase 設定」
- 只能 doc id 升冪範圍／`getDoc`／整集合讀（欄位查詢、`orderBy desc`、`limitToLast` 會被拒）；前端 lite 無 `onSnapshot`、錯誤要接住；讀取 effect 必等 `isCloud`
- 前端資料快取一律 `window.Cache`（不自己 `localStorage.setItem`）：清理或新增前端要讀的單場欄位 → `CACHE_NS.gc.ver` +1；歷史快照回補 → `hist` +1 →「localStorage 快取」

## 前端
- `components/*.js` 掛 `window.*`，`bundle.py` 依 ORDER 串接、esbuild 不改名識別字；Tailwind class 寫完整（不可字串拼接）；提交連 `dist/` 與 `index.html`；圖表自繪 SVG 不引套件
- `App.js` 只放主畫面狀態與組裝：純計算 `appLogic.js`（要測試）、資料載入 `appData.js`、整頁路由 `appRoute.js` →「App.js 的分工」
- 資料層：季平均／Splits／趨勢／對戰與篩選期間的效率、防守、得分組成 → `GameAgg` 算逐場 bundle（新單場欄位放 `adv` 不放 `stats`）；Playtype／Clutch → 快照；投籃 → 逐球；單場 → `loadGameDocs` →「前端架構、各頁網址與資料層」
- 逐場重算不可直接平均比率：新比率指標先決定走 `RATIO_DEFS`／`EFG_DEFS`／`TS_DEFS`／`WAVG_DEFS` 哪一種；次數類 defs 加 `neutral: true`
- 效率：球員效率一律是**在場**效率（`ON_PTS`÷`ON_POSS` 加權）；不在場只用官方單場 On/Off（不可全隊減在場；區間要含該員沒上場的全隊場次）→「各章節」
- 最近防守者：「vs 平常」期間值用 `NORMAL_DEFS` 依出手加權；場均分母用 `D_GP`；全隊版＝對手全部出手，不是球員加總
- 欄位單位：`TM_TOV_PCT` 在 API 已是百分比、不再乘 100；全隊 Misc 沒有 `PFD`
- 全域期間：逐場來源吃 `periodCtx`；整季快照包 `UI.Locked on={periodOn}`、個別缺值格給 `naNote`，**不可默默顯示沒篩選的數字**；新章節在 `TABS` 標 `period: true`
- 元件一律用 `window.UI`（橫捲表展開列 `UI.ExpandRow`、長首欄 `stackFirst`、自訂橫捲加 `UI.scrollHint`）
- 數字用 `fix1`／`fixSigned`／`Num`／`UI.cellNum`，不在各檔另寫；聯盟名次只給當季快照格（`leagueRank`＋`rankWhy`），補充放 `note` 不黏進數值
- 複製引用與加入引用籃都收在「?」小卡（`UI.Info` 的 `cite`／`quote`），格式在 `quoteFormat.js` →「色票與介面規則」
- 同一個控制只放一處（全域期間例外：桌機在章節列、手機在身分列）；分頁列用 `UI.TabBar`；獨立整頁的網址參數不可叫 `v`
- 日期一律美東（`etParts`／`etToday`），開賽時間經 `kickoffTPE`，不自己加減時區
- 預設看進行中賽季（`selectedSeasonKey` 不存 localStorage）；開站首頁＝最新一場單場頁
- 無障礙：slate-500/600 只當文字色；品牌色底的字用 `#0A1626`；`#236192` 不當小字；按鈕 ≥ 24×24 不重疊（「?」不用左右負邊距）；手機不放逐列次要按鈕
- 用詞中性，不貶低對手（勁敵／順手／棘手）；攻守叫「進攻端／防守端」；Playtype 寫「回合數／每回合得分（失分）」不寫「球權」

## 色票與字體
- 主色 `#12A150`、結構藍 `#236192`、底色 `#0A1626`、月光銀 `#C4CED2`、負值 `#EF4444`（hex 直寫，改色全域替換）
- 字體 `font-sans` Noto Sans TC／`font-display` Barlow Condensed／`font-mono` JetBrains Mono

## 頁面與網址
| 畫面 | 網址 | 主要檔案 |
|---|---|---|
| 主畫面六章節 | `#v=…&p=ID-名字&tab=&s=年份&t=&pd=&c=&m=&hl=` | `App.js`、`*Tab.js` |
| 單場 | `#game=日期[&tab=box\|compare\|shots\|pt][&bx=adv][&p=]` | `GamePage.js`、`PreviewPanel.js`、`GamePlaytype.js` |
| 薪資 | `#cap[&s=][&tab=contracts\|picks\|rules]` | `CapPage.js` |
| 對戰 | `#vs[=三碼][&r=][&t=][&m=]` | `MatchupHome.js`、`MatchupPage.js` |
| 組合 | `#lineups[&n=2\|3\|5][&p=][&min=][&view=mx][&s=][&t=]` | `LineupsPage.js` |
| 比較 | `#cmp=ID-名字~ID-名字[&sa=][&sb=][&per=36][&pd=][&m=]` | `ComparePage.js` |
| 完整賽程 | `#schedule[&m=YYYY-MM][&f=home\|away]` | `SchedulePage.js` |

## 規格文件
- 改完功能：現況改寫進 handover、過程與決定寫進 history.md；本檔只加「漏了就出錯」的規則或指令，維持 8,000 字內（不含空白）
