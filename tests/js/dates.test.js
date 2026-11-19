// 美東日期與賽季界線（etParts／seasonForDate／capSeasonForDate／getSeasonPhase）、賽別小工具
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const w = require('./load_bundle')();
const D = (iso) => new Date(iso);

test('etParts 含夏令', () => {
    assert.deepEqual({ ...w.etParts(D('2026-03-08T06:59:00Z')) }, { y: 2026, m: 3, d: 8 });     // 01:59 EST
    assert.deepEqual({ ...w.etParts(D('2026-11-19T04:30:00Z')) }, { y: 2026, m: 11, d: 18 });   // 23:30 EST
    assert.deepEqual({ ...w.etParts(D('2026-07-01T03:30:00Z')) }, { y: 2026, m: 6, d: 30 });    // 23:30 EDT（舊 UTC−5 會算成 7/1）
});

test('資料賽季 10/20（美東）切換、名冊賽季 7/1 切換', () => {
    assert.equal(w.seasonForDate(D('2026-10-20T03:30:00Z')), '2025-26');   // 美東 10/19 23:30
    assert.equal(w.seasonForDate(D('2026-10-20T04:30:00Z')), '2026-27');
    assert.equal(w.seasonForDate(D('2027-06-30T12:00:00Z')), '2026-27');
    assert.equal(w.capSeasonForDate(D('2026-07-01T03:30:00Z')), '2025-26');
    assert.equal(w.capSeasonForDate(D('2026-07-01T04:30:00Z')), '2026-27');
});

test('getSeasonPhase（畫面預設用）', () => {
    assert.equal(w.getSeasonPhase(D('2026-11-19T12:00:00Z')).type, 'regular');
    assert.equal(w.getSeasonPhase(D('2027-05-01T12:00:00Z')).type, 'playoffs');
    assert.equal(w.getSeasonPhase(D('2027-08-01T12:00:00Z')).type, null);
});

test('etToday 格式', () => {
    assert.match(w.etToday(), /^\d{4}-\d{2}-\d{2}$/);
});

test('賽別：gameId 前三碼與中文標籤', () => {
    assert.deepEqual(['0022600001', '0042600101', '0052600111', '0062600001', ''].map((x) => w.gameTypeOfId(x)),
        ['regular', 'playoffs', 'playin', 'regular', 'regular']);
    assert.deepEqual(['例行賽', '季後賽', '附加賽', undefined].map((x) => w.typeKeyOfLabel(x)), ['regular', 'playoffs', 'playin', 'regular']);
    assert.deepEqual({ ...w.SEASON_TYPE_LABEL }, { regular: '例行賽', playoffs: '季後賽', playin: '附加賽' });
});
