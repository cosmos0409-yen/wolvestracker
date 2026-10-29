// 引用籃資料層＋貼文排版：window.Quote（不含 JSX，可在 Node 單獨測 Quote.render）
// 各頁從「?」小卡「加入引用籃」→ 存在 localStorage（wt_quote_v1，保留到手動清空）→ QuoteBasket 抽屜排序／合併 → render 成貼文用純文字
// 項目：{ id, kind: 'single'|'compare', subject, context, label, en, gkey, values: [{ tag, value, unit }], sep: '→'|'vs.',
//        rank: { rank, n }|null, pr: 百分位|null（Playtype）, better: 'high'|'low'|null, asOf, url }
//   合併後的項目：{ id, kind, subject, context, sep, parts: [項目A, 項目B] }（成對指標寫成一行「A／B」）
// 排版規則（使用者確認的格式）：「：」分隔名稱與數值、「／」成對指標、「→」時間先後、「vs.」並列
//   單值 1A：●主體｜情境（括號為聯盟排名）＋ ※指標：值（第8）
//   前後 2A：●主體｜情境：A → B ＋ ※指標：x → y（2B 差值、2C 加 📈📉 為選項）
//   並列 3A：（以下為 主體｜情境，A vs. B）＋ ※指標：x vs. y；三個以上值 3C：●主體｜指標 ＋ 每個對象一行
(function () {
    const KEY = 'wt_quote_v1';
    const OPTS_KEY = 'wt_quote_opts_v1';
    const EVENT = 'wt-quote-change';

    // 成對指標合併成一行時的名稱（順序不拘）；沒列到的組合寫成「A／B」
    const PAIRS = [
        ['FGA', 'FG_PCT', '出手數／命中率'],
        ['FG3A', 'FG3_PCT', '三分出手數／命中率'],
        ['FTA', 'FT_PCT', '罰球出手數／命中率'],
        ['DRIVES', 'DRIVE_FG_PCT', '切入次數／命中率'],
        ['CATCH_SHOOT_FGA', 'CATCH_SHOOT_EFG_PCT', '接球跳投出手數／有效命中率'],
        ['CATCH_SHOOT_FGA', 'CATCH_SHOOT_FG3_PCT', '接球跳投出手數／三分命中率'],
        ['PULL_UP_FGA', 'PULL_UP_EFG_PCT', '急停跳投出手數／有效命中率'],
        ['PULL_UP_FGA', 'PULL_UP_FG3_PCT', '急停跳投出手數／三分命中率'],
        ['SCREEN_ASSISTS', 'SCREEN_AST_PTS', '掩護助攻次數／得分'],
        ['D_FGA', 'D_FG_PCT', '防守出手數／對手命中率'],
        ['REB_CHANCES', 'REB_COL_PCT', '籃板機會／轉換率'],
    ];
    const DEFAULT_OPTS = {
        header: 'none',      // 整段標頭：none／key（●關鍵數據：）／custom（headerText）
        headerText: '',
        prefix: '※',         // 行首：※／•／''
        names: 'zh',         // 指標名稱：zh／en／both（中文（原文））
        rank: true,          // 帶名次
        ptStyle: 'league',   // Playtype 名次寫法：league（第11）／pr（PR66）
        cmpStyle: 'arrow',   // 前後比較：arrow（2A）／delta（2B 差值）／trend（2C 加 📈📉）
        asOfNote: false,     // 文末「※本文數據統計至 M/D」
        source: false,       // 文末附資料來源＋網址
    };

    // ── 排版（純函式）──
    const render = (items, opts) => {
        const o = Object.assign({}, DEFAULT_OPTS, opts || {});
        const P = o.prefix || '';
        const nm = (it) => o.names === 'en' ? (it.en || it.label)
            : (o.names === 'both' && it.en && it.en !== it.label) ? `${it.label}（${it.en}）` : it.label;
        const pairName = (a, b) => {
            const hit = PAIRS.find(([x, y]) => (x === a.gkey && y === b.gkey) || (x === b.gkey && y === a.gkey));
            if (hit && o.names !== 'en') return hit[0] === a.gkey ? hit[2] : `${nm(a)}／${nm(b)}`;
            return `${nm(a)}／${nm(b)}`;
        };
        const nameOf = (it) => it.parts ? pairName(it.parts[0], it.parts[1]) : nm(it);
        // Playtype：選 PR 寫法，或沒有名次（球員百分位不能換算名次）時寫 PR
        const usesPr = (it) => typeof it.pr === 'number' && (o.ptStyle === 'pr' || !it.rank);
        const rk = (it) => {
            if (!o.rank) return '';
            if (usesPr(it)) return `（PR${Math.round(it.pr)}）`;
            return it.rank ? `（第${it.rank.rank}）` : '';
        };
        const hasLeague = (it) => it.parts ? it.parts.some(hasLeague) : (!!it.rank && !usesPr(it));
        const val = (v) => v ? `${v.value}${v.unit || ''}` : '—';
        const num = (v) => { const n = parseFloat(String(v && v.value).replace(/[^\d.+-]/g, '')); return isNaN(n) ? null : n; };
        const decimals = (v) => { const m = String(v && v.value).match(/\.(\d+)/); return m ? m[1].length : 0; };
        const delta = (a, b) => {
            const x = num(a), y = num(b);
            if (x == null || y == null) return '—';
            const d = y - x, dec = Math.max(decimals(a), decimals(b));
            const s = d.toFixed(dec);
            return d > 0 ? `+${s}` : Number(s) === 0 ? (0).toFixed(dec) : s;
        };
        const trend = (it) => {
            if (it.parts || !it.better) return '';
            const x = num(it.values[0]), y = num(it.values[it.values.length - 1]);
            if (x == null || y == null || x === y) return '';
            return ((y > x) === (it.better === 'high')) ? ' 📈' : ' 📉';
        };
        const tagsOf = (it) => (it.parts ? it.parts[0] : it).values.map(v => v.tag || '');
        const valsAt = (it, i) => it.parts ? it.parts.map(p => val(p.values[i])).join('／') : val(it.values[i]);
        const ctxOf = (it) => it.context ? `｜${it.context}` : '';

        // 相鄰、同主體同情境同比較方式的項目合成一組；三個以上值的比較各自成組（3C）
        const groups = [];
        (items || []).forEach(it => {
            const n = tagsOf(it).length;
            const key = [it.kind, it.subject, it.context, it.kind === 'compare' ? `${it.sep}|${tagsOf(it).join('|')}` : ''].join('§');
            const last = groups[groups.length - 1];
            if (last && last.key === key && !(it.kind === 'compare' && n > 2)) last.items.push(it);
            else groups.push({ key, items: [it], wide: it.kind === 'compare' && n > 2 });
        });

        const blocks = groups.map(g => {
            const first = g.items[0];
            if (g.wide) {
                const tags = tagsOf(first);
                return [`●${first.subject}${ctxOf(first)}｜${nameOf(first)}`, ...tags.map((t, i) => `${t}：${valsAt(first, i)}`)];
            }
            if (first.kind === 'compare') {
                const [A, B] = tagsOf(first);
                if (first.sep === 'vs.') {
                    return [`（以下為 ${first.subject}${ctxOf(first)}，${A} vs. ${B}）`,
                        ...g.items.map(it => `${P}${nameOf(it)}：${valsAt(it, 0)} vs. ${valsAt(it, 1)}`)];
                }
                if (o.cmpStyle === 'delta') {
                    return [`●${first.subject}${ctxOf(first)}：${B}（括號為與${A}差距）`,
                        ...g.items.map(it => `${P}${nameOf(it)}：${it.parts
                            ? it.parts.map(p => `${val(p.values[1])}（${delta(p.values[0], p.values[1])}）`).join('／')
                            : `${val(it.values[1])}（${delta(it.values[0], it.values[1])}）`}`)];
                }
                return [`●${first.subject}${ctxOf(first)}：${A} → ${B}`,
                    ...g.items.map(it => `${P}${nameOf(it)}：${valsAt(it, 0)} → ${valsAt(it, 1)}${o.cmpStyle === 'trend' ? trend(it) : ''}`)];
            }
            const note = o.rank && g.items.some(hasLeague) ? '（括號為聯盟排名）' : '';
            return [`●${first.subject}${ctxOf(first)}${note}`,
                ...g.items.map(it => `${P}${nameOf(it)}：${it.parts
                    ? it.parts.map(p => `${val(p.values[0])}${rk(p)}`).join('／')
                    : `${val(it.values[0])}${rk(it)}`}`)];
        });

        const out = [];
        const head = o.header === 'key' ? '●關鍵數據：' : o.header === 'custom' ? String(o.headerText || '').trim() : '';
        if (head) out.push(head);
        blocks.forEach((b, i) => { if (i > 0 || head) out.push(''); out.push(...b); });
        const flat = [].concat(...(items || []).map(it => it.parts || [it]));
        const tail = [];
        if (o.asOfNote) {
            const d = flat.map(it => it.asOf).filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x || '')).sort().pop();
            if (d) tail.push(`※本文數據統計至 ${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`);
        }
        if (o.source) {
            tail.push('資料：NBA.com Stats');
            const url = flat.map(it => it.url).find(Boolean);
            if (url) tail.push(url);
        }
        if (tail.length && out.length) out.push('');
        return out.concat(tail).join('\n');
    };

    // ── 儲存（localStorage 不可用時退回記憶體，頁面照常運作）──
    let mem = [];
    let memOpts = null;
    const readJSON = (k, fallback) => {
        try { const s = window.localStorage.getItem(k); return s == null ? fallback : JSON.parse(s); } catch (e) { return fallback; }
    };
    const writeJSON = (k, v) => { try { window.localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 私密模式等：只留在記憶體 */ } };
    const notify = () => { try { window.dispatchEvent(new CustomEvent(EVENT)); } catch (e) { /* Node 測試環境 */ } };
    const items = () => { const a = readJSON(KEY, mem); return Array.isArray(a) ? a : []; };
    const save = (a) => { mem = a; writeJSON(KEY, a); notify(); };
    const opts = () => Object.assign({}, DEFAULT_OPTS, readJSON(OPTS_KEY, memOpts) || {});
    const setOpts = (patch) => { memOpts = Object.assign(opts(), patch); writeJSON(OPTS_KEY, memOpts); notify(); };

    const sig = (it) => JSON.stringify([it.subject, it.context, it.label, (it.parts || [it]).map(p => p.values)]);
    const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    // 回傳 { added, total }；同一主體／情境／指標／數值已在籃子裡就不重複加
    const add = (it) => {
        const a = items();
        if (a.some(x => sig(x) === sig(it))) return { added: false, total: a.length };
        a.push(Object.assign({ id: uid() }, it));
        save(a);
        return { added: true, total: a.length };
    };
    const remove = (id) => save(items().filter(x => x.id !== id));
    const move = (id, dir) => {
        const a = items(), i = a.findIndex(x => x.id === id), j = i + dir;
        if (i < 0 || j < 0 || j >= a.length) return;
        [a[i], a[j]] = [a[j], a[i]];
        save(a);
    };
    // 能否和下一項合併：都是未合併的同類項目、同主體同情境，比較項目還要比較對象相同
    const canMerge = (a, b) => !!(a && b && !a.parts && !b.parts && a.kind === b.kind && a.subject === b.subject
        && a.context === b.context && (a.kind !== 'compare'
            || (a.sep === b.sep && JSON.stringify(a.values.map(v => v.tag)) === JSON.stringify(b.values.map(v => v.tag)))));
    const merge = (id) => {
        const a = items(), i = a.findIndex(x => x.id === id);
        if (i < 0 || !canMerge(a[i], a[i + 1])) return;
        const [x, y] = [a[i], a[i + 1]];
        a.splice(i, 2, { id: uid(), kind: x.kind, subject: x.subject, context: x.context, sep: x.sep, parts: [x, y] });
        save(a);
    };
    const split = (id) => {
        const a = items(), i = a.findIndex(x => x.id === id);
        if (i < 0 || !a[i].parts) return;
        a.splice(i, 1, ...a[i].parts);
        save(a);
    };
    const clear = () => save([]);
    const subscribe = (fn) => {
        const onStorage = (e) => { if (!e.key || e.key === KEY || e.key === OPTS_KEY) fn(); };
        window.addEventListener(EVENT, fn);
        window.addEventListener('storage', onStorage);
        return () => { window.removeEventListener(EVENT, fn); window.removeEventListener('storage', onStorage); };
    };

    // 依目前畫面的引用情境（window.CiteCtx）組項目；fields 至少要有 label 與 values
    // asOf：'snap' 快照日／'agg' 截至日／'none'（同 UI.citeLine）
    const make = (fields) => {
        const c = window.CiteCtx || {};
        const subject = c.subject === 'Minnesota Timberwolves' ? '灰狼全隊' : (c.subject || '');
        const asOf = fields.asOf === 'none' || c.isHistory ? null : (fields.asOf === 'agg' ? c.asOfAgg : c.asOfSnap) || null;
        let url = '';
        try { url = `${window.location.origin}${window.location.pathname}${window.location.hash}`; } catch (e) { /* Node */ }
        const it = Object.assign({ kind: 'single', subject, context: c.context || c.season || '', sep: '→', rank: null, pr: null, better: null, url },
            fields, { asOf });
        // 原文只留名稱：畫面小字的補充說明（如「DIFF%（負=守得好）」）不進貼文
        if (it.en) it.en = String(it.en).replace(/（[^）]*）/g, '').trim();
        return it;
    };

    window.Quote = { render, items, add, remove, move, merge, split, canMerge, clear, opts, setOpts, subscribe, make, EVENT, DEFAULT_OPTS, PAIRS };
})();
