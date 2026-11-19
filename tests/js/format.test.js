// 數值格式化：fix1、fixSigned（不出現 +0.0／-0.0）、Num（isNum／round1／樣本標準差）、UI.cellNum 補小數位
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const w = require('./load_bundle')();

test('fix1：一位小數、不出現 -0.0', () => {
    assert.deepEqual([12.35, 0.04, -0.04, -1.25, 101.5].map(w.fix1), ['12.3', '0.0', '0.0', '-1.3', '101.5']);
});

test('fixSigned：正數帶 +、四捨五入是 0 不帶號', () => {
    assert.deepEqual([10.6, -12.1, 0.04, -0.04, 0, 0.05].map(v => w.fixSigned(v)), ['+10.6', '-12.1', '0.0', '0.0', '0.0', '+0.1']);
    assert.equal(w.fixSigned(1.234, 2), '+1.23');
    assert.equal(w.fixSigned(-0.004, 2), '0.00');
});

test('Num.isNum／round1', () => {
    assert.deepEqual([1, 0, NaN, Infinity, null, '1'].map(w.Num.isNum), [true, true, false, false, false, false]);
    assert.equal(w.Num.round1(1.25), 1.3);
});

test('Num.sd：樣本標準差，少於 2 筆回 0', () => {
    assert.equal(w.Num.sd([5]), 0);
    assert.equal(w.Num.sd([]), 0);
    assert.equal(Math.round(w.Num.sd([2, 4, 4, 4, 5, 5, 7, 9]) * 1000) / 1000, 2.138);
});

test('UI.cellNum：百分比至少一位、跟參考值補齊小數位', () => {
    assert.equal(w.UI.cellNum(54, '%'), '54.0');
    assert.equal(w.UI.cellNum(101.5, '', 99.25), '101.50');
});
