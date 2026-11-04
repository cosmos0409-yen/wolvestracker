# -*- coding: utf-8 -*-
"""
Wolves Tracker - 賽前預覽資料

寫一份 wolves_games_index/{season}_preview（每天覆寫，約 30 KB），前端單場頁的「預覽模式」讀：
    games   灰狼本季所有正式比賽（含未開打）：美東日期、UTC 開賽時間、主客、對手（三碼＋oppId，隊徽用）、球館、特殊賽事標記、
            狀態、比分（已結束）、雙方休息天數（距上一場的空檔天數，0＝背靠背）
    form    30 隊各自最近 PREVIEW_FORM_N 場已結束比賽 [{date, vs（vs XXX／@XXX）, wl, pts, opp}]
    league  30 隊本季數據（PREVIEW_TEAM_FIELDS）；ranks 為各欄聯盟名次（方向依設定表）
    statsAsOf  league 的數據截至日（每日快照日期）

資料來源：賽程是 cdn.nba.com 的全聯盟賽程檔（1 個 request）；league 用每日抓取本來就拿到的 30 隊 base／advanced，
不多打 stats.nba.com。放在既有的 wolves_games_index 集合（已有安全規則與索引豁免）；
build_bundles.py --all 只處理 {season}_{regular|playoffs}，不會把這份當成索引。

Usage:
    python build_preview.py            # 單獨執行：賽程 1＋全隊 base／advanced 各 1（共 3 requests），寫入
    python build_preview.py --dry-run  # 同上，只印摘要不寫入
每日由 fetch_data.py 呼叫 build()，傳入已抓好的 30 隊資料（只多賽程 1 個 request）。
"""

import sys
import os
import argparse
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import nba_common as nc

MIN_ID = nc.TEAM_ID


def _num(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def league_table(base_map, adv_map, id2tri):
    """30 隊 base／advanced（key：灰狼 'MIN'、其他隊 TEAM_ID 字串）→ ({三碼: {欄: 值}}, {三碼: {欄: 名次}})"""
    tri_of = lambda k: 'MIN' if k == 'MIN' else id2tri.get(int(k)) if str(k).isdigit() else None
    teams = {}
    for src, m in (('base', base_map), ('advanced', adv_map)):
        for k, d in (m or {}).items():
            t = tri_of(k)
            if not t:
                continue
            row = teams.setdefault(t, {})
            for f, s, _ in nc.PREVIEW_TEAM_FIELDS:
                if s == src and _num(d.get(f)):
                    row[f] = round(d[f], 1) if isinstance(d[f], float) else d[f]
            if src == 'base' and _num(d.get('PTS')) and _num(d.get('PLUS_MINUS')):
                row['OPP_PTS'] = round(d['PTS'] - d['PLUS_MINUS'], 1)
    ranks = {t: {} for t in teams}
    for f, _, direction in nc.PREVIEW_TEAM_FIELDS:
        if direction == 'none':
            continue
        for t, r in nc.rank_all({t: row.get(f) for t, row in teams.items()}, lower=(direction == 'low')).items():
            ranks[t][f] = r
    return teams, ranks


def _side(g, team_id):
    """回傳 (自己, 對手, 是否主場)"""
    home = g['home']['id'] == team_id
    return (g['home'], g['away'], True) if home else (g['away'], g['home'], False)


def team_games(sched, team_id):
    """該隊的比賽；對手待定（NBA Cup 淘汰賽、附加賽等還沒決定對手，三碼為空）的先略過，對手確定後每日更新會帶進來"""
    return [g for g in sched if team_id in (g['home']['id'], g['away']['id']) and g['home']['tri'] and g['away']['tri']]


def form_of(sched, team_id, n):
    done = [g for g in team_games(sched, team_id) if g['status'] == 3 and _num(g['home']['score']) and _num(g['away']['score'])]
    out = []
    for g in done[-n:]:
        me, op, home = _side(g, team_id)
        # 每場用物件：Firestore 不允許陣列裡直接放陣列
        out.append({'date': g['date'], 'vs': f"{'vs ' if home else '@'}{op['tri']}", 'wl': 'W' if me['score'] > op['score'] else 'L',
                    'pts': me['score'], 'opp': op['score']})
    return out


def rest_days(sched, team_id, game):
    """這場之前的空檔天數（0＝背靠背）；本季第一場回 None"""
    prev = [g for g in team_games(sched, team_id) if (g['utc'] or '') < (game['utc'] or '')]
    if not prev:
        return None
    d0, d1 = datetime.strptime(prev[-1]['date'], '%Y-%m-%d'), datetime.strptime(game['date'], '%Y-%m-%d')
    return (d1 - d0).days - 1


def compose(season, sched, base_map, adv_map, as_of):
    id2tri = {}
    for g in sched:
        for side in ('home', 'away'):
            if g[side]['id'] and g[side]['tri']:
                id2tri[g[side]['id']] = g[side]['tri']
    league, ranks = league_table(base_map, adv_map, id2tri)
    games = []
    for g in team_games(sched, MIN_ID):
        me, op, home = _side(g, MIN_ID)
        row = {'id': g['id'], 'date': g['date'], 'utc': g['utc'], 'home': home, 'opp': op['tri'], 'oppId': op['id'], 'status': g['status'],
               'label': g['label'], 'arena': g['arena'], 'city': g['city'],
               'rest': [rest_days(sched, MIN_ID, g), rest_days(sched, op['id'], g)]}
        if g['status'] == 3 and _num(me['score']) and _num(op['score']):
            row['score'] = [me['score'], op['score']]
        games.append(row)
    tris = sorted(set(id2tri.values()))
    tri2id = {t: i for i, t in id2tri.items()}
    form = {t: form_of(sched, tri2id[t], nc.PREVIEW_FORM_N) for t in tris}
    # fields：雙方對照的列順序與方向（前端照這個畫，設定表加一列前端就多一列；Firestore map 不保證順序）
    fields = [{'key': f, 'dir': d} for f, _, d in nc.PREVIEW_TEAM_FIELDS if d != 'none']
    return {'season': season, 'statsAsOf': as_of, 'updatedAt': int(datetime.now().timestamp() * 1000),
            'teamsN': len(league), 'games': games, 'form': form, 'league': league, 'ranks': ranks, 'fields': fields}


def summary(doc):
    """dry-run／log 用：下一場的重點"""
    nxt = next((g for g in doc['games'] if g['status'] == 1), None)
    lines = [f"灰狼本季 {len(doc['games'])} 場（已結束 {sum(1 for g in doc['games'] if g['status'] == 3)}），聯盟表 {doc['teamsN']} 隊，數據截至 {doc['statsAsOf']}"]
    if nxt:
        o = nxt['opp']
        lines.append(f"下一場 {nxt['date']} {'vs' if nxt['home'] else '@'} {o}（UTC {nxt['utc']}）{nxt['arena']} {nxt['label']} 休息 MIN {nxt['rest'][0]}／{o} {nxt['rest'][1]}")
        for t in ('MIN', o):
            L, R = doc['league'].get(t, {}), doc['ranks'].get(t, {})
            lines.append(f"  {t} {L.get('W')}-{L.get('L')}｜" + "、".join(f"{f} {L.get(f)}（{R.get(f)}）" for f, _, d in nc.PREVIEW_TEAM_FIELDS if d != 'none'))
            lines.append(f"  {t} 近況 {doc['form'].get(t)}")
    return "\n".join(lines)


def build(db, season, base_map, adv_map, as_of, sched=None, dry_run=False):
    """組好並寫入；賽程抓不到就不寫（前端沿用前一天的版本）。回傳文件或 None"""
    sched = sched if sched is not None else nc.fetch_league_schedule()
    if not sched:
        print("⚠️ 賽前預覽：賽程檔抓不到，本次不更新（沿用前一份）")
        return None
    if not base_map:
        print("⚠️ 賽前預覽：沒有全隊數據，本次不更新")
        return None
    doc = compose(season, sched, base_map, adv_map, as_of)
    print(summary(doc))
    if not dry_run and db is not None:
        db.collection("wolves_games_index").document(f"{season}_preview").set(doc)
        print(f"✅ 賽前預覽已寫入 wolves_games_index/{season}_preview")
    return doc


def main():
    ap = argparse.ArgumentParser(description="賽前預覽（wolves_games_index/{season}_preview）")
    ap.add_argument("--dry-run", action="store_true", help="只印摘要，不寫入")
    args = ap.parse_args()
    season = nc.get_current_season()
    type_api, _ = nc.get_season_type()
    type_api = type_api or "Regular+Season"
    base_map = nc.fetch_base_box(season, type_api, "Team", team_id=0)
    adv_map = nc.fetch_team_advanced(season, type_api, team_id=0)
    db = None if args.dry_run else nc.init_firebase()
    build(db, season, base_map, adv_map, nc.get_today_str(), dry_run=args.dry_run)


if __name__ == "__main__":
    main()
