---
description: WolvesTracker 測試案例清單
---

> 狀態：初始為 [ ]、完成為 [x]
> 注意：狀態只能在測試通過後由流程更新。
> 測試類型：Python爬蟲邏輯、前端UI渲染、權限與路徑

---

## [x] 【Python抓取邏輯】測試自動腳本在無 Firebase 環境下運行
**範例輸入**： `python scripts/fetch_data.py` (且不提供環境變數 `FIREBASE_SERVICE_ACCOUNT`)
**期待輸出**： 腳本印出「沒有找到 FIREBASE_SERVICE_ACCOUNT」，並且成功輸出 `local_test_data.json` 檔案到本地，不會因為 Firebase 缺少而掛掉。
**實測結果**： ✅ 通過！腳本正常輸出 `local_test_data.json`，exit code 0。

---

## [x] 【Python抓取邏輯】測試自動腳本抓取資料的完整性與反爬蟲機制 (NBA API)
**範例輸入**： `python scripts/fetch_data.py`
**期待輸出**： 腳本能爬完全部 11 項 PlayType (進攻+防守) 以及 6 項 Tracking 數據，未發生 403 Forbidden 或是 Timeout 錯誤 (證明 Header 設定成功騙過 NBA 官網的反爬蟲機制)；產出的 json 檔案包含各項數據 `Drives`, `CatchShoot` 等完整資料。
**實測結果**： ✅ 通過！
- 球隊進攻 PlayType: 11 項 ✅
- 球隊防守 PlayType: 9 項 (Cut/Misc 無防守面) ✅
- Tracking 欄位: DRIVES, DRIVE_FGM, CATCH_SHOOT_FGA, PULL_UP_FGA, PASSES_MADE, SECONDARY_AST, TOUCHES, REB 等全數到齊 ✅
- 球員資料: 11 名灰狼球員 (含 Anthony Edwards, Julius Randle 等) ✅
- 使用 `requests.Session()` + User-Agent 旋轉 + `Sec-Fetch-*` 成功繞過反爬蟲 ✅

---

## [ ] 【前端UI渲染】測試新版 Firebase 預設唯讀讀取是否正常連線
**範例輸入**： 啟動本地靜態伺服器瀏覽 `index.html`
**期待輸出**： console 顯示 "✅ Firebase 連線成功 (匿名登入 - 純讀取)"，右上角狀態顯示綠色 "Cloud Live"。

---

## [ ] 【前端UI渲染】測試 Tracking 卡片與走勢圖
**範例輸入**： 點選畫面下方的「切入次數 (Drives)」卡片元件
**期待輸出**： 跳出 Modal 對話框，包含「近10場、全部」的篩選按鈕列與日期過濾器；表格將顯示 PPP、FG% 等正確欄位；點擊表格上方的欄位名稱可以正確看到摺線圖(SimpleLineChart)切換。

---

## [x] 【權限與路徑】驗證前端寫死密碼機制是否確實移除
**範例輸入**： 搜尋 `index.html` 原始碼中的 `yen76wolfherd` 以及 `// --- BOOKMARKLETS ---`
**期待輸出**： 完全搜尋不到，舊有的管理員密碼驗證 UI 已被徹底消滅，不再暴露於開發者工具(F12)中。
**實測結果**： ✅ 通過！新版 `index.html` 已完全移除密碼與 Bookmarklet 機制。
