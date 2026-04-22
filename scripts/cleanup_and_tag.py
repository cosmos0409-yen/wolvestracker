"""
清理與標籤腳本：

1. 為 wolves_team_stats / wolves_player_stats 中缺 seasonType / season 欄位的舊文件補上：
   - 依文件日期推算（<=4/15 → 例行賽，4/16-6/20 → 季後賽）
   - season 預設 "2025-26"
2. 找出兩天數據完全一模一樣的情況（比對 stats + tracking），刪除日期較晚的那筆。

執行方式：
    python scripts/cleanup_and_tag.py             # 預設 dry-run，只列出將執行的動作
    python scripts/cleanup_and_tag.py --apply     # 實際寫入 Firebase
"""

import argparse
import os
import json
import sys
from datetime import datetime
from collections import OrderedDict

import firebase_admin
from firebase_admin import credentials, firestore


SEASON_DEFAULT = "2025-26"

# 本季賽季階段切點（25-26）
REGULAR_END = "2026-04-15"   # 含
PLAYOFFS_END = "2026-06-20"  # 含


def init_firebase():
    if firebase_admin._apps:
        return firestore.client()
    cred_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT")
    if cred_json:
        cred = credentials.Certificate(json.loads(cred_json))
    elif os.path.exists("firebase-key.json"):
        cred = credentials.Certificate("firebase-key.json")
        print("使用本地 firebase-key.json")
    else:
        sys.exit("找不到 firebase 憑證")
    firebase_admin.initialize_app(cred)
    return firestore.client()


def infer_season_type(date_str):
    """依文件日期 (YYYY-MM-DD) 推算 25-26 賽季階段"""
    try:
        d = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        return None
    regular_end = datetime.strptime(REGULAR_END, "%Y-%m-%d").date()
    playoffs_end = datetime.strptime(PLAYOFFS_END, "%Y-%m-%d").date()
    season_start = datetime.strptime("2025-10-20", "%Y-%m-%d").date()
    if season_start <= d <= regular_end:
        return "例行賽"
    if regular_end < d <= playoffs_end:
        return "季後賽"
    # 落在賽季外，按使用者要求一律當例行賽（休賽期不應有資料，保守處理）
    return "例行賽"


def normalize_for_compare(value):
    """遞迴標準化以便比對：list 內的 dict 依 key 字串排序避免順序差異"""
    if isinstance(value, dict):
        return {k: normalize_for_compare(v) for k, v in value.items()}
    if isinstance(value, list):
        norm = [normalize_for_compare(item) for item in value]
        # 若 list 元素全為 dict，依其完整 JSON 字串排序，消除順序差異
        if norm and all(isinstance(x, dict) for x in norm):
            try:
                norm.sort(key=lambda x: json.dumps(x, sort_keys=True, ensure_ascii=False))
            except TypeError:
                pass
        return norm
    if isinstance(value, float):
        return round(value, 4)
    return value


def data_equal(a, b):
    return normalize_for_compare(a) == normalize_for_compare(b)


def process_collection(db, collection_name, apply_changes):
    print(f"\n{'='*60}\n處理集合：{collection_name}\n{'='*60}")
    docs = list(db.collection(collection_name).stream())
    print(f"共 {len(docs)} 筆文件")

    # ---------- Step 1：補貼標籤 ----------
    tag_updates = []
    for doc in docs:
        data = doc.to_dict()
        update = {}
        if not data.get("seasonType"):
            inferred = infer_season_type(doc.id)
            if inferred:
                update["seasonType"] = inferred
        if not data.get("season"):
            update["season"] = SEASON_DEFAULT
        if update:
            tag_updates.append((doc.id, update))

    print(f"\n[Step 1] 缺欄位需補貼：{len(tag_updates)} 筆")
    for doc_id, update in tag_updates[:10]:
        print(f"  {doc_id} ← {update}")
    if len(tag_updates) > 10:
        print(f"  ...（其餘 {len(tag_updates) - 10} 筆省略）")

    if apply_changes and tag_updates:
        for doc_id, update in tag_updates:
            db.collection(collection_name).document(doc_id).update(update)
        print(f"  ✅ 已更新 {len(tag_updates)} 筆文件")

    # ---------- Step 2：刪除完全相同的後續日期 ----------
    # 先重新讀取（以拿到剛補貼後的資料，但比對只看 stats/tracking 不受影響）
    docs_sorted = sorted(docs, key=lambda d: d.id)
    to_delete = []
    last_unique_doc_id = None
    last_unique_data = None
    for doc in docs_sorted:
        data = doc.to_dict()
        cur = {"stats": data.get("stats"), "tracking": data.get("tracking")}
        if last_unique_data is None:
            last_unique_doc_id = doc.id
            last_unique_data = cur
            continue
        if data_equal(cur, last_unique_data):
            to_delete.append((doc.id, last_unique_doc_id))
        else:
            last_unique_doc_id = doc.id
            last_unique_data = cur

    print(f"\n[Step 2] 與前一獨特日期數據完全相同需刪除：{len(to_delete)} 筆")
    for doc_id, dup_of in to_delete[:20]:
        print(f"  刪 {doc_id}（與 {dup_of} 完全相同）")
    if len(to_delete) > 20:
        print(f"  ...（其餘 {len(to_delete) - 20} 筆省略）")

    if apply_changes and to_delete:
        for doc_id, _ in to_delete:
            db.collection(collection_name).document(doc_id).delete()
        print(f"  ✅ 已刪除 {len(to_delete)} 筆重複文件")

    return len(tag_updates), len(to_delete)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="實際寫入 Firebase（預設 dry-run）")
    args = parser.parse_args()

    if not args.apply:
        print("⚠️  Dry-run 模式：只會列出將執行的動作，不會實際寫入。\n   加 --apply 才會實際執行。")

    db = init_firebase()

    total_tag = 0
    total_del = 0
    for col in ("wolves_team_stats", "wolves_player_stats"):
        t, d = process_collection(db, col, args.apply)
        total_tag += t
        total_del += d

    print(f"\n{'='*60}\n總結\n{'='*60}")
    print(f"補貼標籤：{total_tag} 筆")
    print(f"刪除重複：{total_del} 筆")
    if not args.apply:
        print("\n（Dry-run，未實際變動。確認無誤後執行 `python scripts/cleanup_and_tag.py --apply`）")


if __name__ == "__main__":
    main()
