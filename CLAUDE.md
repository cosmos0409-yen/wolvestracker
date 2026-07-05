<!-- BEGIN: claude-md-12-rules (managed block — do not edit or delete) -->
# CLAUDE.md — 12-rule template

These rules apply to every task in this project unless explicitly overridden.
Bias: caution over speed on non-trivial work. Use judgment on trivial tasks.

## Rule 1 — Think Before Coding
State assumptions explicitly. If uncertain, ask rather than guess.
Present multiple interpretations when ambiguity exists.
Push back when a simpler approach exists.
Stop when confused. Name what's unclear.

## Rule 2 — Simplicity First
Minimum code that solves the problem. Nothing speculative.
No features beyond what was asked. No abstractions for single-use code.
Test: would a senior engineer say this is overcomplicated? If yes, simplify.

## Rule 3 — Surgical Changes
Touch only what you must. Clean up only your own mess.
Don't "improve" adjacent code, comments, or formatting.
Don't refactor what isn't broken. Match existing style.

## Rule 4 — Goal-Driven Execution
Define success criteria. Loop until verified.
Don't follow steps. Define success and iterate.
Strong success criteria let you loop independently.

## Rule 5 — Use the model only for judgment calls
Use me for: classification, drafting, summarization, extraction.
Do NOT use me for: routing, retries, deterministic transforms.
If code can answer, code answers.

## Rule 6 — Token budgets are not advisory
Per-task: 4,000 tokens. Per-session: 30,000 tokens.
If approaching budget, summarize and start fresh.
Surface the breach. Do not silently overrun.

## Rule 7 — Surface conflicts, don't average them
If two patterns contradict, pick one (more recent / more tested).
Explain why. Flag the other for cleanup.
Don't blend conflicting patterns.

## Rule 8 — Read before you write
Before adding code, read exports, immediate callers, shared utilities.
"Looks orthogonal" is dangerous. If unsure why code is structured a way, ask.

## Rule 9 — Tests verify intent, not just behavior
Tests must encode WHY behavior matters, not just WHAT it does.
A test that can't fail when business logic changes is wrong.

## Rule 10 — Checkpoint after every significant step
Summarize what was done, what's verified, what's left.
Don't continue from a state you can't describe back.
If you lose track, stop and restate.

## Rule 11 — Match the codebase's conventions, even if you disagree
Conformance > taste inside the codebase.
If you genuinely think a convention is harmful, surface it. Don't fork silently.

## Rule 12 — Fail loud
"Completed" is wrong if anything was skipped silently.
"Tests pass" is wrong if any were skipped.
Default to surfacing uncertainty, not hiding it.
<!-- END: claude-md-12-rules -->

# Wolves Tracker 專案快速查表

## 常用指令
- 每日抓取：`python scripts/fetch_data.py`（休賽期自動跳過；本地一律輸出 local_test_data.json）
- 投籃熱圖（每週）：`python scripts/fetch_shotchart.py`
- 歷史回補：`python scripts/backfill_history.py --season 2024-25 --type regular`
- 前端打包：改 `components/*.js` 後必跑 `python scripts/bundle.py`（勿手改 dist/）
- 本地預覽：`python -m http.server 8000`

## 色票（灰狼新品牌，hex 直接寫在元件；改色用 sed 全域替換）
- 主色（進攻/選中/圖表主線/命中）：`#12A150`  · 結構藍（切換/連結）：`#236192`
- 底色：`#0A1626`  · 月光銀（logo 環/標題底線 `/30`）：`#C4CED2`  · 防守/未命中/負值：`#EF4444`

## 硬性約束
- 抓取邏輯與欄位對應集中在 `scripts/nba_common.py`——**新增數據改設定表（`*_FIELDS`），不要在 fetch_data.py / backfill_history.py 寫重複邏輯**
- 加防守/新數據三情境見 handover「Q: 想新增數據」；前端對應 `constants.js` 的 `*Defs` + `TrackingCardRow` 的 `source` 參數
- 每日快照球員以 playerName 為 key；歷史快照以 PlayerID 為 key（前端 normalizeHistoryPlayer 對齊），勿更動
- 每日文件欄位：stats/tracking/shooting/clutch/defense/lineups，新增欄位記得併入 `fetch_data.py` 的 `DATA_KEYS`（去重）
- 新 Firestore 集合需在 Firebase Console 安全規則加 read 白名單（見 doc/handover.md）
- .bat 檔必須 CRLF、`chcp 65001`、無中文註解
- 不用 GitHub Actions（機房 IP 被 NBA 擋）；正式排程為 Windows Task Scheduler
- 逐球員 endpoint（shotchartdetail）只能低頻執行（每週），避免被 NBA 封鎖；Synergy 不支援日期篩選（單場只能相減還原）
- Pages 部署偶發 `Deployment failed, try again later`（GitHub 暫時性）→ `gh run rerun <id>` 重跑即可

## 規格文件
- `doc/handover.md`：交接手冊（架構/排程/資料結構/FAQ）
- `README.md`：對外說明
