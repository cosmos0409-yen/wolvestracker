# 🐺 Wolves Tracker 交接手冊

> 最後更新：2026-02-27

## 已完成項目

| # | 項目 | 狀態 | 說明 |
|---|---|---|---|
| 1 | Firebase 整合 | ✅ | 前端以 `onSnapshot` 即時讀取 Firestore |
| 2 | Python 爬蟲腳本 | ✅ | `scripts/fetch_data.py`，含 11 PlayType + 6 Tracking |
| 3 | GitHub Actions 自動排程 | ✅ | `.github/workflows/nba_update.yml`，每日 UTC 12:00 |
| 4 | 前端 UI 全面改寫 | ✅ | 移除密碼登入、新增雷達圖、Tracking 卡片、球員頭像 |
| 5 | 反爬蟲機制 | ✅ | Session + UA 旋轉 + Sec-Fetch headers + retry |
| 6 | 安全性修復 | ✅ | 移除 F12 可見的 `yen76wolfherd` 密碼 |
| 7 | 測試驗證 | ✅ | 本地試跑成功，資料完整性確認 |

---

## 下一步操作指引

### Step 1：設定 GitHub Secret

> [!IMPORTANT]
> 這是唯一需要手動操作的步驟，完成後自動化就會生效。

1. 前往 Firebase Console → 專案設定 → 服務帳戶 → **產生新的私密金鑰**
2. 下載 JSON 檔案，複製其**完整內容**
3. 前往 GitHub Repo → Settings → Secrets and variables → Actions
4. 新增 Secret：
   - Name: `FIREBASE_SERVICE_ACCOUNT`
   - Value: 貼上整份 JSON

### Step 2：設定 Firestore 安全規則

到 Firebase Console → Firestore → Rules，貼上：

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /wolves_team_stats/{date} {
      allow read: if request.auth != null;
      allow write: if false; // 只允許 Admin SDK 寫入
    }
    match /wolves_player_stats/{date} {
      allow read: if request.auth != null;
      allow write: if false;
    }
  }
}
```

### Step 3：推送至 `main` 分支

```bash
git add .
git commit -m "feat: 自動化數據管線 + UI 全面更新"
git push origin main
```

### Step 4：手動觸發一次 GitHub Actions 測試

1. 前往 GitHub Repo → Actions → "Daily NBA Stats Update"
2. 點擊 **Run workflow** 手動觸發
3. 確認 log 顯示 `✅ 球隊數據已寫入` 與 `✅ 球員數據已寫入`

### Step 5：驗證前端

打開 GitHub Pages 網址，確認：
- 右上角顯示 **Cloud Live** (綠色)
- PlayType 卡片有數據
- Tracking 區塊有數據
- 點擊卡片可以看到歷史表格

---

## 常見問題

### Q: GitHub Actions 跑失敗怎麼辦？

NBA API 偶爾會因為流量管制導致 timeout。腳本有內建 retry 機制（最多3次），通常重新跑一次就會成功。如果連續失敗，可能是 NBA 官網在維護。

### Q: 想新增更多 Tracking 類型？

在 `fetch_data.py` 的 `TRACKING_TYPES` 列表中加入新的 `PtMeasureType`，然後在 `fetch_tracking_data()` 函式中加入對應的 `elif measure_type == "新類型"` 處理邏輯。前端 `index.html` 的 `trackingDefs` 陣列也要同步更新。

### Q: 想追蹤其他球隊？

修改 `fetch_data.py` 中的 `TEAM_ID` 常數即可。所有 NBA 球隊的 ID 可從 [NBA Stats](https://www.nba.com/stats) 查詢。

---

## 檔案變更清單

| 檔案 | 動作 | 說明 |
|---|---|---|
| `index.html` | 改寫 | 全新 React SPA，純讀取模式 |
| `scripts/fetch_data.py` | 新增 | Python 爬蟲 + Firebase 寫入 |
| `requirements.txt` | 新增 | `requests`, `firebase-admin` |
| `.github/workflows/nba_update.yml` | 新增 | 每日排程自動化 |
| `doc/test/test_cases.md` | 新增 | 測試案例與結果 |
| `doc/handover.md` | 新增 | 本文件 |
| `README.md` | 改寫 | 專案說明文件 |
