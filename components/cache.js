// 前端 localStorage 快取（2026-11-19 起統一；取代各檔各寫各的 wt_gc_v7_／wt_game_v4_／wt_history_v6_ 等）
//   鍵：wt_c_{命名空間}_{版本}_{key}；值：{ e: 到期時間(ms), t: 寫入時間(ms), v: 資料 }
//   換版：改下面 CACHE_NS 的 ver（後端回補、清理 Firestore、前端要讀新欄位時）——只要改這一個數字，舊版鍵開站時自動清掉
//   開站時一次清掉：過期的、版本不對的、舊格式的鍵（LEGACY_KEY_RE）；存滿時從最舊的快取刪起再重寫
//   不是快取、不經這裡、也不會被清：偏好 wt_pref_*、雷達軸 wt_radar_axes_*、引用籃 wt_quote_*
//   localStorage 不能用（私密模式等）時 get 一律回 undefined、set 回 false，畫面照常（只是不快取）
window.CACHE_NS = {
    gc: { ver: 2, note: 'v2：2026-11-21 全隊文件加 playtype（單場 Playtype）。單場兩份文件 wolves_team_games＋wolves_player_games（loadGameDocs；單場頁、對戰頁、總覽單場面板共用）' },
    idx: { ver: 1, note: '已結束賽季的比賽索引 wolves_games_index/{season}_{type}（loadGamesIndex）' },
    pv: { ver: 1, note: '當季賽前預覽 wolves_games_index/{season}_preview（loadPreview）' },
    lu: { ver: 1, note: '已結束賽季的組合文件（loadLineups）' },
    hist: { ver: 1, note: '歷史賽季終點快照（readHistoryCache；重跑 backfill_history.py 要 +1）' },
};
(function () {
    const PREFIX = 'wt_c_';
    // 2026-11-19 以前各檔自訂的快取鍵，以及已不用的偏好鍵：開站時一律刪掉
    const LEGACY_KEY_RE = /^wt_(gc_|game_|games_index_|pv_|lu_|history_)|^wt_pref_selectedSeasonKey$/;
    const ls = () => { try { return window.localStorage; } catch (e) { return null; } };
    const keyOf = (ns, key) => `${PREFIX}${ns}_${(window.CACHE_NS[ns] || {}).ver}_${key}`;
    const parse = (k) => { try { return JSON.parse(ls().getItem(k)); } catch (e) { return null; } };
    // 鍵是否為目前版本的快取：wt_c_{ns}_{ver}_…
    const current = (k) => {
        const m = k.slice(PREFIX.length).match(/^([a-z]+)_(\d+)_/);
        return !!m && !!window.CACHE_NS[m[1]] && Number(m[2]) === window.CACHE_NS[m[1]].ver;
    };
    const allKeys = () => { const s = ls(); if (!s) return []; const out = []; for (let i = 0; i < s.length; i++) out.push(s.key(i)); return out; };

    const get = (ns, key) => {
        const s = ls(); if (!s) return undefined;
        const k = keyOf(ns, key), o = parse(k);
        if (!o || typeof o !== 'object' || !('v' in o)) return undefined;
        if (o.e && Date.now() > o.e) { try { s.removeItem(k); } catch (e) { /* ignore */ } return undefined; }
        return o.v;
    };
    // 存滿：把所有快取依寫入時間排序，刪掉最舊的四分之一（至少 1 筆）再試，最多 4 輪
    const evict = () => {
        const s = ls(); if (!s) return 0;
        const rows = allKeys().filter(k => k && k.startsWith(PREFIX)).map(k => ({ k, t: (parse(k) || {}).t || 0 })).sort((a, b) => a.t - b.t);
        const n = Math.max(1, Math.ceil(rows.length / 4));
        rows.slice(0, n).forEach(r => { try { s.removeItem(r.k); } catch (e) { /* ignore */ } });
        return rows.length ? n : 0;
    };
    const set = (ns, key, v, ttlMs) => {
        const s = ls(); if (!s || !window.CACHE_NS[ns]) return false;
        const now = Date.now();
        const text = JSON.stringify({ e: ttlMs ? now + ttlMs : 0, t: now, v });
        for (let i = 0; i < 5; i++) {
            try { s.setItem(keyOf(ns, key), text); return true; }
            catch (e) { if (i === 4 || !evict()) return false; }
        }
        return false;
    };
    const remove = (ns, key) => { const s = ls(); if (s) { try { s.removeItem(keyOf(ns, key)); } catch (e) { /* ignore */ } } };
    // 開站清理：舊格式、版本不對、過期
    const purge = () => {
        const s = ls(); if (!s) return 0;
        let n = 0;
        allKeys().forEach(k => {
            if (!k) return;
            const legacy = LEGACY_KEY_RE.test(k);
            const mine = k.startsWith(PREFIX);
            if (!legacy && !mine) return;
            const o = mine && current(k) ? parse(k) : null;
            if (legacy || !o || (o.e && Date.now() > o.e)) { try { s.removeItem(k); n++; } catch (e) { /* ignore */ } }
        });
        return n;
    };
    // 除錯用：各命名空間的筆數與大小（KB）
    const stats = () => {
        const out = {};
        allKeys().filter(k => k && k.startsWith(PREFIX)).forEach(k => {
            const ns = k.slice(PREFIX.length).split('_')[0];
            const r = (out[ns] = out[ns] || { n: 0, kb: 0 });
            r.n++; r.kb += Math.round(((ls().getItem(k) || '').length * 2) / 102.4) / 10;
        });
        return out;
    };
    window.Cache = { get, set, remove, purge, stats, DAY: 86400000, HOUR: 3600000 };
    purge();
})();
