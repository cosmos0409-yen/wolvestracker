// 薪資計算 window.CapCalc（CapPage.js）：兩種總額、分級奢侈稅、所在層級、累犯判定
// 前半用可以手算的合成資料；後半用真實薪資快照（tests/fixtures），總額要與 Sheet 裡的 Spotrac 參考值逐元相符
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const w = require('./load_bundle')();
const C = w.CapCalc;

const S = '2026-27';
const RATES = [{ bracket: 1, rate: 1.5, repeater_rate: 2.5 }, { bracket: 2, rate: 1.75, repeater_rate: 2.75 },
    { bracket: 3, rate: 2.5, repeater_rate: 3.5 }, { bracket: 4, rate: 3.25, repeater_rate: 4.25 }];
const T = { cap: 140, tax: 170, apron1: 178, apron2: 189, tax_bracket: 5 };

test('兩種總額：奢侈稅薪資＝標準合約＋死錢（不含雙向）；apron 薪資再加 unlikely incentives', () => {
    const doc = {
        contracts: [{ season: S, salary: 100, unlikely: 0 }, { season: S, salary: 50, unlikely: 2 },
            { season: S, salary: 1, type: 'TWO-WAY', unlikely: 0 }, { season: '2027-28', salary: 999 }],
        dead: [{ season: S, amount: 5 }, { season: '2027-28', amount: 7 }],
    };
    const p = C.payroll(doc, S);
    assert.deepEqual([p.tax, p.apron, p.twoWay, p.deadTotal, p.std.length], [155, 157, 1, 5, 2]);
});

test('奢侈稅：每一級金額 × 該級稅率（手算）', () => {
    const t = { tax: 100, tax_bracket: 5 };
    assert.equal(C.taxOf(100, t, RATES, false).total, 0);                 // 沒超過
    assert.equal(C.taxOf(112, t, RATES, false).total, 21.25);             // 5×1.5 + 5×1.75 + 2×2.5
    assert.equal(C.taxOf(112, t, RATES, true).total, 33.25);              // 累犯 5×2.5 + 5×2.75 + 2×3.5
    // Sheet 只列 4 級，第 5 級起每級 +0.5：5×1.5 + 5×1.75 + 5×2.5 + 5×3.25 + 5×3.75
    const r = C.taxOf(125, t, RATES, false);
    assert.equal(r.total, 63.75);
    assert.deepEqual(JSON.parse(JSON.stringify(r.rows.map(x => x.rate))), [1.5, 1.75, 2.5, 3.25, 3.75]);
});

test('所在層級：薪資帽／奢侈稅看奢侈稅薪資，兩條 apron 看 apron 薪資（剛好等於門檻不算超過）', () => {
    const tier = (tax, apron = tax) => C.tierOf({ tax, apron }, T);
    assert.deepEqual([tier(140), tier(141), tier(170), tier(171), tier(171, 179), tier(171, 190)],
        ['below_cap', 'cap', 'cap', 'tax', 'apron1', 'apron2']);
});

test('累犯：前 4 季有 3 季繳稅；有缺資料時判定不了就是 unknown', () => {
    const doc = (paid) => ({ tax_history: ['2022-23', '2023-24', '2024-25', '2025-26'].map((season, i) => ({ season, paid: paid[i] })) });
    assert.equal(C.repeaterOf(doc([false, false, true, true]), S).status, 'normal');
    assert.equal(C.repeaterOf(doc([true, true, true, false]), S).status, 'repeater');
    assert.equal(C.repeaterOf(doc([true, true, null, null]), S).status, 'unknown');
    assert.equal(C.repeaterOf(doc([true, null, null, null]), S).status, 'unknown');
    assert.equal(C.repeaterOf(doc([false, false, null, null]), S).status, 'normal');   // 缺的全算有繳也只有 2 季
    assert.equal(C.repeaterOf(doc([true, false, true, true]), S).prior3, 2);            // 下一季判定窗＝本季前 3 季
});

// ── 真實資料（2026-11-19 快照）──
const real = require(path.join(__dirname, '..', 'fixtures', 'salary_main_2026-11-19.json'));

test('真實資料：兩種總額與 Spotrac 參考值、繳稅紀錄逐元相符', () => {
    let checked = 0;
    for (const [s, t] of Object.entries(real.thresholds)) {
        const p = C.payroll(real, s);
        const hist = real.tax_history.find(h => h.season === s);
        if (t.ref_tax_total) { assert.equal(p.tax, t.ref_tax_total, `${s} 奢侈稅薪資`); checked++; }
        if (t.ref_apron_total) { assert.equal(p.apron, t.ref_apron_total, `${s} apron 薪資`); checked++; }
        if (hist && hist.tax_payroll) { assert.equal(p.tax, hist.tax_payroll, `${s} 繳稅紀錄`); checked++; }
    }
    assert.ok(checked >= 5, `至少要比到 5 個參考值（實際 ${checked}）`);
});

test('真實資料：層級與繳稅紀錄的季末說明一致', () => {
    // 2024-25「季末超過第二 apron」、2025-26「季末超過奢侈稅線、低於第一 apron」
    assert.equal(C.tierOf(C.payroll(real, '2024-25'), real.thresholds['2024-25']), 'apron2');
    assert.equal(C.tierOf(C.payroll(real, '2025-26'), real.thresholds['2025-26']), 'tax');
});

test('真實資料：2024-25 奢侈稅（稅率與勞資協議相同，已手算核對）', () => {
    const s = '2024-25', t = real.thresholds[s];
    const tax = C.taxOf(C.payroll(real, s).tax, t, real.tax_rates[s], false);
    // 超出 31,739,470、每級 5,168,000：1.5、1.75、2.5、3.25、3.75、4.25 六級滿＋731,470 × 4.75 ＝ 91,330,482.5
    assert.equal(tax.total, 91330482.5);
});
