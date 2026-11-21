// 單場 Playtype 純計算 GamePT.derive：頻率、PPP（兩位小數）、差值＝顯示值相減、防守反向、回合數 < 5 不判、拆不開回 null
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load_bundle');
const w = load();
const G = w.GamePT;

// 2026-11-19 vs NYK 的真實數字（轉換進攻、定點投籃）＋一列回合數少的
const PT = { ok: true, n: 16, preGP: 15, snaps: ['2026-11-19', '2026-11-20'],
    off: [
        { t: 'Spotup', poss: 21, pts: 16, fgm: 5, fga: 18, prePoss: 400, prePts: 460 },
        { t: 'Transition', poss: 26, pts: 37, fgm: 14, fga: 18, prePoss: 335, prePts: 385 },
        { t: 'Handoff', poss: 2, pts: 0, fgm: 0, fga: 2, prePoss: 50, prePts: 36 },
    ],
    def: [{ t: 'Spotup', poss: 21, pts: 16, fgm: 5, fga: 18, prePoss: 400, prePts: 460 }] };

test('進攻：依本場回合數排序、PPP 兩位、差值＝顯示值相減、好壞', () => {
    const d = G.derive(PT, 'offensive');
    assert.equal(d.def, false);
    assert.deepEqual(d.rows.map(r => r.t), ['Transition', 'Spotup', 'Handoff']);
    const [tr, sp, ho] = d.rows;
    assert.equal(tr.ppp, 1.42); assert.equal(tr.prePpp, 1.15); assert.equal(tr.diff, 0.27);
    assert.ok(tr.good && !tr.bad);
    assert.equal(sp.ppp, 0.76); assert.equal(sp.diff, -0.39); assert.ok(sp.bad && !sp.good);
    assert.ok(Math.abs(tr.freq - 26 / 49 * 100) < 1e-9);
    assert.ok(Math.abs(tr.prePossPG - 335 / 15) < 1e-9);
    assert.ok(ho.few && !ho.good && !ho.bad, '回合數 < 5 不判好壞');
    assert.equal(ho.ppp, 0);
});

test('摘要：總回合數、得分、整體 PPP vs 賽前季均、最常見', () => {
    const s = G.derive(PT, 'offensive').sum;
    assert.equal(s.poss, 49); assert.equal(s.pts, 53);
    assert.equal(s.ppp, 1.08); assert.equal(s.prePpp, 1.12); assert.equal(s.diff, -0.04);
    assert.ok(s.bad);
    assert.equal(s.top.t, 'Transition');
    assert.ok(Math.abs(s.prePossPG - 785 / 15) < 1e-9);
});

test('防守端：失分比季均少＝好', () => {
    const d = G.derive(PT, 'defensive');
    assert.equal(d.def, true);
    assert.equal(d.rows[0].diff, -0.39);
    assert.ok(d.rows[0].good && !d.rows[0].bad);
});

test('拆不開（ok=false）或沒有資料回 null；第一場沒有季均', () => {
    assert.equal(G.derive({ ok: false }, 'offensive'), null);
    assert.equal(G.derive(null, 'offensive'), null);
    const first = G.derive({ ok: true, n: 1, preGP: 0, off: [{ t: 'Isolation', poss: 9, pts: 10, fgm: 4, fga: 8, prePoss: 0, prePts: 0 }], def: [] }, 'offensive');
    assert.equal(first.rows[0].prePpp, null);
    assert.equal(first.rows[0].diff, null);
    assert.equal(first.rows[0].prePossPG, null);
    assert.ok(!first.rows[0].good && !first.rows[0].bad);
});
