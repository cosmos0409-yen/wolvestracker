// window.Cache（components/cache.js）：讀寫、到期、換版、開站清理、存滿時刪最舊、偏好與引用籃不受影響
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load_bundle');

const now = Date.now();
const entry = (v, e = 0, t = now) => JSON.stringify({ e, t, v });

test('讀寫與到期', async () => {
    const w = load();
    assert.equal(w.Cache.set('gc', '2026-11-17', { a: 1 }, w.Cache.DAY), true);
    assert.deepEqual({ ...w.Cache.get('gc', '2026-11-17') }, { a: 1 });
    assert.equal(w.Cache.get('gc', 'none'), undefined);
    w.Cache.set('pv', 'x', 1, 1);   // 1 毫秒後到期
    await new Promise(r => setTimeout(r, 5));
    assert.equal(w.Cache.get('pv', 'x'), undefined);
    assert.equal(w.localStorage.getItem(`wt_c_pv_${w.CACHE_NS.pv.ver}_x`), null, '讀到過期的要順手刪掉');
});

test('開站清理：舊格式、版本不對、過期、未知命名空間都刪；有效快取、偏好、引用籃保留', () => {
    const w = load({
        storage: {
            'wt_gc_v7_2026-11-17': '{}', 'wt_game_v4_x': '{}', 'wt_history_v6_x': '{}', 'wt_games_index_v3_x': '{}',
            'wt_pv_v1_x': '{}', 'wt_lu_v1_x': '{}', 'wt_pref_selectedSeasonKey': '"current"',
            'wt_c_gc_0_old': entry(1), 'wt_c_pv_1_expired': entry(1, now - 1000), 'wt_c_zz_1_unknown': entry(1),
            'wt_c_lu_1_keep': entry({ ok: 1 }, now + 86400000),
            'wt_pref_viewMode': '"TEAM"', 'wt_quote_v1': '[]', 'wt_radar_axes_TEAM': '["PTS"]', 'other_site_key': 'x',
        },
    });
    assert.deepEqual(Object.keys(w.localStorage._dump()).sort(),
        ['other_site_key', 'wt_c_lu_1_keep', 'wt_pref_viewMode', 'wt_quote_v1', 'wt_radar_axes_TEAM']);
});

test('存滿：刪最舊的快取再寫入成功，不動偏好與引用籃', () => {
    const big = 'x'.repeat(2000);
    const storage = { 'wt_quote_v1': '[]', 'wt_pref_viewMode': '"TEAM"' };
    for (let i = 0; i < 8; i++) storage[`wt_c_gc_1_old${i}`] = entry(big, 0, 1000 + i);   // 越小越舊
    const w = load({ storage, quotaChars: 8 * 2100 + 200 });
    assert.equal(w.Cache.set('gc', 'new', big, w.Cache.DAY), true);
    const keys = Object.keys(w.localStorage._dump());
    assert.ok(!keys.includes('wt_c_gc_1_old0') && !keys.includes('wt_c_gc_1_old1'), '最舊的先刪');
    assert.ok(keys.includes('wt_c_gc_1_old7'), '較新的保留');
    assert.ok(keys.includes('wt_quote_v1') && keys.includes('wt_pref_viewMode'));
    assert.equal(w.Cache.get('gc', 'new'), big);
});

test('localStorage 不能用時不丟例外（私密模式）', () => {
    const w = load();
    Object.defineProperty(w, 'localStorage', { get() { throw new Error('denied'); } });
    assert.equal(w.Cache.get('gc', 'x'), undefined);
    assert.equal(w.Cache.set('gc', 'x', 1, 1000), false);
    assert.equal(w.Cache.purge(), 0);
});
