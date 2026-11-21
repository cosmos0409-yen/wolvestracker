// 引用籃資料層＋貼文排版：window.Quote（不含 JSX，可在 Node 單獨測 Quote.render）
// 各頁從「?」小卡「加入引用籃」→ 存在 localStorage（wt_quote_v1，保留到手動清空）→ QuoteBasket 抽屜排序／合併 → render 成貼文用純文字
// 項目：{ id, kind: 'single'|'compare'|'line', subject, context, label, en, gkey, values: [{ tag, value, unit }], sep: '→'|'vs.',
//        rank: { rank, n }|null, pr: 百分位|null（Playtype）, note: 補充說明|null（歷史定位等，跟「名次」開關）, better: 'high'|'low'|null, asOf, url,
//        game: { date, home, opp, ms, os, wl, periods: [[灰狼, 對手]…], gameNo }|null（單場頁加入的才有，供「單場比分」標頭） }
//   kind 'line'：球員本場數據一行（values[0].value 是整行文字）
//   合併後的項目：{ id, kind, subject, context, sep, parts: [項目A, 項目B] }（成對指標寫成一行「A／B」，PAIRS 一律排成「出手數／命中率」）
//   合成比較（compare）：同主體同指標、情境或統計日不同的兩個單值 → kind 'compare'，src 保留原兩項供「拆開」；
//     make 另記 ctxBase（賽季情境）／ctxPeriod（篩選中的期間）／ctxNote，共同情境＝ctxBase、比較對象＝各自期間（沒有＝全季）
// 排版規則（使用者確認的格式）：「：」分隔名稱與數值、「／」成對指標、「→」時間先後、「vs.」並列
//   段標頭前的「●」是選項 opts.bullet（2026-11-18 起預設不加：使用者文章用「●」當小節標題）
//   單值 1A：主體｜情境（括號為聯盟排名）＋ ※指標：值（第8）
//   前後 2A：主體｜情境：A → B ＋ ※指標：x → y（2B 差值、2C 加 📈📉 為選項）
//   並列 3A：（以下為 主體｜情境，A vs. B）＋ ※指標：x vs. y；三個以上值 3C：主體｜指標 ＋ 每個對象一行
//   依指標：指標｜情境（括號為聯盟排名）＋ ※主體：值；同段有球員也有全隊時球員寫「（球員第15）」
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
        header: 'none',      // 整段標頭：none／key（●關鍵數據：）／game（單場比分，取第一個帶 game 的項目）／custom（headerText）
        headerText: '',
        prefix: '※',         // 行首：※／•／''
        bullet: '',          // 各段標頭前的符號：''（預設，使用者文章的「●」是小節標題）／'●'
        names: 'zh',         // 指標名稱：zh／en／both（中文（原文））
        rank: true,          // 帶名次
        ptStyle: 'league',   // Playtype 名次寫法：league（第11）／pr（PR66）
        cmpStyle: 'arrow',   // 前後比較：arrow（2A）／delta（2B 差值）／trend（2C 加 📈📉）
        asOfNote: false,     // 文末「※本文數據統計至 M/D」
        source: false,       // 文末附資料來源＋網址
        periods: false,      // 單場比分標頭下加一行每節比分
        order: 'added',      // 排列：added 加入順序／player 依球員／metric 依指標（只影響輸出，不改籃子順序）
    };

    // ── 排版（純函式）──
    // renderBlocks：回傳分段 [{ text, head }]（head＝整段標頭或文末「統計至／來源」），抽屜每段單獨複製用；
    // render：各段以空行接起來的整段文字（＝複製全部，與改版前輸出相同）
    const renderBlocks = (items, opts) => {
        const o = Object.assign({}, DEFAULT_OPTS, opts || {});
        const P = o.prefix || '';
        const nm = (it) => o.names === 'en' ? (it.en || it.label)
            : (o.names === 'both' && it.en && it.en !== it.label) ? `${it.label}（${it.en}）` : it.label;
        const pairName = (a, b) => {
            const hit = PAIRS.find(([x, y]) => (x === a.gkey && y === b.gkey) || (x === b.gkey && y === a.gkey));
            if (hit && o.names !== 'en') return hit[0] === a.gkey ? hit[2] : `${nm(a)}／${nm(b)}`;
            // 單場 Playtype 一列（GamePT.rowQuote）：兩個 part 同一個類型名 pre → 類型名只寫一次「轉換進攻 回合數／每回合得分」
            if (a.pre && a.pre === b.pre && o.names !== 'en') {
                const rest = (it) => { const s = nm(it); return s.startsWith(a.pre) ? s.slice(a.pre.length) : s; };
                return `${a.pre} ${rest(a)}／${rest(b)}`;
            }
            return `${nm(a)}／${nm(b)}`;
        };
        const nameOf = (it) => it.parts ? pairName(it.parts[0], it.parts[1]) : nm(it);
        // Playtype：選 PR 寫法，或沒有名次（球員百分位不能換算名次）時寫 PR
        const usesPr = (it) => typeof it.pr === 'number' && (o.ptStyle === 'pr' || !it.rank);
        // who：'player' 時名次寫「球員第N」（依指標段同時有球員與全隊時，區分「球員中的名次」與「30 隊中的名次」）
        const rk = (it, who) => {
            if (!o.rank) return '';
            if (usesPr(it)) return `（PR${Math.round(it.pr)}）`;
            return it.rank ? `（${who === 'player' ? '球員' : ''}第${it.rank.rank}）` : '';
        };
        // note：歷史定位、本場焦點標籤等補充說明，和名次共用「名次」開關
        const nt = (it) => o.rank && it.note ? `（${it.note}）` : '';
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
        // 合併後的比較：📈📉 各自接在該指標的後值後面（例「15.4／40.7% → 18.0／33.3% 📉」；次數類 better 為 null 不標）
        const trendAfter = (it) => it.parts
            ? it.parts.map(p => `${val(p.values[p.values.length - 1])}${trend(p)}`).join('／')
            : `${valsAt(it, 1)}${trend(it)}`;
        const trend = (it) => {
            if (it.parts || !it.better) return '';
            const x = num(it.values[0]), y = num(it.values[it.values.length - 1]);
            if (x == null || y == null || x === y) return '';
            return ((y > x) === (it.better === 'high')) ? ' 📈' : ' 📉';
        };
        const tagsOf = (it) => (it.parts ? it.parts[0] : it).values.map(v => v.tag || '');
        const valsAt = (it, i) => it.parts ? it.parts.map(p => val(p.values[i])).join('／') : val(it.values[i]);
        const oneVal = (it, who) => it.parts ? it.parts.map(p => `${val(p.values[0])}${rk(p, who)}${nt(p)}`).join('／') : `${val(it.values[0])}${rk(it, who)}${nt(it)}`;
        const isTeam = (it) => it.subject === '灰狼全隊';
        const B = o.bullet || '';
        // 段標頭：前面加符號（預設無）；內容是空字串時整行省略
        const headLine = (s) => s ? `${B}${s}` : null;
        const flat = [].concat(...(items || []).map(it => it.parts || [it]));

        // 標頭「單場比分」：取籃子裡第一個帶 game 的項目；同一場的項目省略情境（比分已寫在最上面）
        const hg = o.header === 'game' ? (flat.find(it => it.game) || {}).game : null;
        // 合併後的項目（parts）本身沒有 game，看第一個 part 的
        const gameOf = (it) => (it.parts ? it.parts[0] : it).game;
        const ctxOf = (it) => hg && gameOf(it) && gameOf(it).date === hg.date ? '' : (it.context || '');
        const who = (it) => [it.subject, ctxOf(it)].filter(Boolean).join('｜');

        // 排列：added 照籃子順序；player 同主體＋情境集中；metric 另把「同指標、不同主體」的單值項目合成一段
        const gk = (it) => it.kind === 'compare' ? ['c', it.subject, it.context, it.sep, tagsOf(it).join('|')].join('§') : ['s', it.subject, it.context].join('§');
        const arrange = (list) => {
            if (o.order !== 'player' && o.order !== 'metric') return list;
            const first = {};
            list.forEach((it, i) => { if (!(gk(it) in first)) first[gk(it)] = i; });
            const units = [];
            const merged = new Set();
            if (o.order === 'metric') {
                const buckets = {};
                list.forEach((it, i) => {
                    if (it.kind !== 'single' || it.parts) return;
                    const k = [it.label, it.context].join('§');
                    (buckets[k] = buckets[k] || []).push(i);
                });
                Object.values(buckets).forEach(ix => {
                    if (new Set(ix.map(i => list[i].subject)).size < 2) return;
                    ix.forEach(i => merged.add(i));
                    units.push({ ord: ix[0], sub: ix[0], e: { metric: ix.map(i => list[i]) } });
                });
            }
            // 同一段裡本場數據列排最前（先整場數據、再單項）
            list.forEach((it, i) => { if (!merged.has(i)) units.push({ ord: first[gk(it)], sub: it.kind === 'line' ? i - 1e6 : i, e: it }); });
            return units.sort((a, b) => a.ord - b.ord || a.sub - b.sub).map(u => u.e);
        };

        // 相鄰、同主體同情境同比較方式的項目合成一組（本場數據列與單值同組）；三個以上值的比較各自成組（3C）
        const groups = [];
        arrange(items || []).forEach(it => {
            if (it.metric) { groups.push({ metric: it.metric }); return; }
            const n = tagsOf(it).length;
            const kind = it.kind === 'line' ? 'single' : it.kind;
            const key = [kind, it.subject, it.context, it.kind === 'compare' ? `${it.sep}|${tagsOf(it).join('|')}` : ''].join('§');
            const last = groups[groups.length - 1];
            if (last && last.key === key && !(it.kind === 'compare' && n > 2)) last.items.push(it);
            else groups.push({ key, items: [it], wide: it.kind === 'compare' && n > 2 });
        });

        const blocks = groups.map(g => {
            if (g.metric) {
                const c = ctxOf(g.metric[0]);
                const note = o.rank && g.metric.some(hasLeague) ? '（括號為聯盟排名）' : '';
                // 同段有球員也有全隊：球員名次寫「球員第N」
                const mixed = g.metric.some(isTeam) && g.metric.some(it => !isTeam(it));
                return [headLine(`${nm(g.metric[0])}${c ? `｜${c}` : ''}${note}`),
                    ...g.metric.map(it => `${P}${it.subject}：${oneVal(it, mixed && !isTeam(it) ? 'player' : null)}`)];
            }
            const first = g.items[0], w = who(first);
            if (g.wide) {
                const tags = tagsOf(first);
                return [headLine([w, nameOf(first)].filter(Boolean).join('｜')), ...tags.map((t, i) => `${t}：${valsAt(first, i)}`)];
            }
            if (first.kind === 'compare') {
                const [A, Bt] = tagsOf(first);
                if (first.sep === 'vs.') {
                    return [`（以下為 ${w ? `${w}，` : ''}${A} vs. ${Bt}）`,
                        ...g.items.map(it => `${P}${nameOf(it)}：${valsAt(it, 0)} vs. ${valsAt(it, 1)}`)];
                }
                if (o.cmpStyle === 'delta') {
                    return [headLine(`${w ? `${w}：` : ''}${Bt}（括號為與${A}差距）`),
                        ...g.items.map(it => `${P}${nameOf(it)}：${it.parts
                            ? it.parts.map(p => `${val(p.values[1])}（${delta(p.values[0], p.values[1])}）`).join('／')
                            : `${val(it.values[1])}（${delta(it.values[0], it.values[1])}）`}`)];
                }
                return [headLine(`${w ? `${w}：` : ''}${A} → ${Bt}`),
                    ...g.items.map(it => `${P}${nameOf(it)}：${valsAt(it, 0)} → ${o.cmpStyle === 'trend' ? trendAfter(it) : valsAt(it, 1)}`)];
            }
            const note = o.rank && g.items.some(hasLeague) ? '（括號為聯盟排名）' : '';
            return [headLine(`${w}${note}`),
                ...g.items.map(it => it.kind === 'line' ? `${P}${val(it.values[0])}` : `${P}${nameOf(it)}：${oneVal(it)}`)];
        }).map(b => b.filter(l => l != null));

        const secs = [];
        const full = (abbr) => (typeof window !== 'undefined' && window.teamFullName) ? window.teamFullName(abbr) : abbr;
        const head = hg
            ? [`${hg.stage ? `${hg.stage} ` : hg.gameNo ? `G${hg.gameNo} ` : ''}${hg.home ? 'vs.' : '@'} ${full(hg.opp)} ${hg.ms}:${hg.os} 灰狼${hg.wl === 'W' ? '勝' : hg.wl === 'L' ? '敗' : ''}`,
                o.periods && hg.periods && hg.periods.length ? `每節：${hg.periods.map(([a, b]) => `${a}:${b}`).join('｜')}` : ''].filter(Boolean).join('\n')
            : o.header === 'key' ? '●關鍵數據：' : o.header === 'custom' ? String(o.headerText || '').trim() : '';
        if (head) secs.push({ text: head, head: true });
        blocks.forEach(b => { if (b.length) secs.push({ text: b.join('\n'), head: false }); });
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
        if (tail.length) secs.push({ text: tail.join('\n'), head: true });
        return secs;
    };
    const render = (items, opts) => renderBlocks(items, opts).map(x => x.text).join('\n\n');

    // ── 儲存（localStorage 不可用時退回記憶體，頁面照常運作）──
    let mem = [];
    let memOpts = null;
    const readJSON = (k, fallback) => {
        try { const s = window.localStorage.getItem(k); return s == null ? fallback : JSON.parse(s); } catch (e) { return fallback; }
    };
    const writeJSON = (k, v) => { try { window.localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 私密模式等：只留在記憶體 */ } };
    const notify = () => { try { window.dispatchEvent(new CustomEvent(EVENT)); } catch (e) { /* Node 測試環境 */ } };
    // 只收格式正確的項目：localStorage 裡有一筆壞資料（手動改過、舊版格式）時，渲染會丟例外、整站白屏（2026-11-19 發現）
    const validItem = (it) => !!it && typeof it === 'object' && Array.isArray((it.parts && it.parts[0] ? it.parts[0] : it).values);
    const items = () => { const a = readJSON(KEY, mem); return Array.isArray(a) ? a.filter(validItem) : []; };
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
    // 同一個指標：gkey 相同（兩邊都有時），或名稱相同
    const sameMetric = (a, b) => (a.gkey && b.gkey) ? a.gkey === b.gkey : a.label === b.label;
    // 能否和下一項併成一行：都是未合併的同類項目、同主體同情境、不同指標（同指標併成「得分／得分」沒有意義 → 改用合成比較），
    // 比較項目還要比較對象相同
    const canMerge = (a, b) => !!(a && b && !a.parts && !b.parts && a.kind !== 'line' && a.kind === b.kind && a.subject === b.subject
        && a.context === b.context && !(a.gkey && a.gkey === b.gkey) && a.label !== b.label && (a.kind !== 'compare'
            || (a.sep === b.sep && JSON.stringify(a.values.map(v => v.tag)) === JSON.stringify(b.values.map(v => v.tag)))));
    const merge = (id) => {
        const a = items(), i = a.findIndex(x => x.id === id);
        if (i < 0 || !canMerge(a[i], a[i + 1])) return;
        let [x, y] = [a[i], a[i + 1]];
        // 成對指標一律排成貼文格式「出手數／命中率」，不管加入先後
        if (PAIRS.some(([p, q]) => p === y.gkey && q === x.gkey)) [x, y] = [y, x];
        a.splice(i, 2, { id: uid(), kind: x.kind, subject: x.subject, context: x.context, sep: x.sep, parts: [x, y] });
        save(a);
    };

    // ── 合成比較：同主體、同指標、只差在情境（條件、期間、賽季）或統計日的兩個單值 → 一個比較項 ──
    const canCompareSingles = (a, b) => !!(a && b && a.kind === 'single' && b.kind === 'single' && !a.parts && !b.parts && !a.src && !b.src
        && a.values.length === 1 && b.values.length === 1 && a.subject === b.subject && sameMetric(a, b)
        && (a.context !== b.context || (!!a.asOf && !!b.asOf && a.asOf !== b.asOf)));
    // 比較項的延伸（2026-11-21）：比較項＋比較項（同情境、同基準＝第一個對象的標籤與數值都一樣，例：兩個 Splits「全季 → 期間」），
    // 或比較項＋同指標的單值（單值的期間當新的對象）→ 多值比較，三個以上值排成「主體｜情境｜指標」＋每個對象一行（3C）。
    // 新對象不可和既有的重複；全季的單值排最前。回傳 { cmp, values } 或 null
    const singleTag = (it) => { const c = ctxSplit(it); return [c.per || '全季', c.note].filter(Boolean).join(' '); };
    const extendShape = (a, b) => {
        if (!a || !b || a.parts || b.parts || a.kind === 'line' || b.kind === 'line' || a.subject !== b.subject || !sameMetric(a, b)) return null;
        if (a.kind !== 'compare' && b.kind !== 'compare') return null;   // 兩個單值走 compareShape
        const [cmp, other] = a.kind === 'compare' ? [a, b] : [b, a];
        if (!Array.isArray(cmp.values) || cmp.values.length < 2) return null;
        const tags = cmp.values.map(v => v.tag);
        let add;
        if (other.kind === 'compare') {
            if (other.context !== cmp.context || !Array.isArray(other.values) || other.values.length < 2) return null;
            const [a0, b0] = [cmp.values[0], other.values[0]];
            if (a0.tag !== b0.tag || String(a0.value) !== String(b0.value)) return null;
            add = other.values.slice(1);
        } else {
            if (other.values.length !== 1 || (other.ctxBase == null ? other.context : other.ctxBase) !== cmp.context) return null;
            add = [Object.assign({}, other.values[0], { tag: singleTag(other) })];
        }
        if (!add.length || add.some(v => tags.includes(v.tag)) || new Set(add.map(v => v.tag)).size !== add.length) return null;
        const values = add.length === 1 && add[0].tag === '全季' ? [add[0], ...cmp.values] : [...cmp.values, ...add];
        return { cmp, values };
    };
    // 兩組已併成一行的成對指標（例：「出手數／命中率」全季、近 10 場），指標依序相同、只差情境或統計日 →
    // 合成「※出手數／命中率：5.6／68.0 → 5.9／70.1」（每組各自是比較項，同 Splits 併成一行的寫法）
    const canComparePairs = (a, b) => !!(a && b && a.parts && b.parts && !a.src && !b.src && a.kind === 'single' && b.kind === 'single'
        && a.subject === b.subject && a.parts.length === b.parts.length && a.parts.every((p, k) => sameMetric(p, b.parts[k]))
        && a.parts.every((p, k) => canCompareSingles(p, b.parts[k])));
    const canCompare = (a, b) => canCompareSingles(a, b) || canComparePairs(a, b) || !!extendShape(a, b);
    // 情境拆成 { base 共同情境, per 比較對象, note 補充 }；舊項目沒有 ctxBase → 整段情境當 base
    const ctxSplit = (it) => it.ctxBase == null ? { base: it.context || '', per: '', note: '' }
        : { base: it.ctxBase || '', per: it.ctxPeriod || '', note: it.ctxNote || '' };
    const md = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '') ? `${d.slice(5, 7)}/${d.slice(8, 10)}` : '';
    const seasonOf = (s) => (String(s || '').match(/\d{4}-\d{2}/) || [''])[0];
    // 回傳 { context, tags: [A, B], sep, swap }（swap：舊的／全季排前面時兩項對調）
    const compareShape = (x, y) => {
        const cx = ctxSplit(x), cy = ctxSplit(y);
        const ax = x.asOf || '', ay = y.asOf || '';
        const join = (...s) => s.filter(Boolean).join(' ');
        // 情境完全一樣、只差統計日（時光機）：比較對象寫「截至 M/D」，舊的在前
        if (x.context === y.context) {
            const [o, n] = ay < ax ? [ay, ax] : [ax, ay];
            return { context: x.context || '', tags: [`截至 ${md(o)}`, `截至 ${md(n)}`], sep: '→', swap: ay < ax };
        }
        const sameNote = cx.note === cy.note;
        if (cx.base === cy.base) {
            const tx = join(cx.per || '全季', sameNote ? '' : cx.note), ty = join(cy.per || '全季', sameNote ? '' : cy.note);
            const context = join(cx.base, sameNote ? cx.note : '');
            // 一項是全季：「全季 → 期間」（同 Splits）
            if (!cx.per !== !cy.per) return { context, tags: cy.per ? [tx, ty] : [ty, tx], sep: '→', swap: !!cx.per };
            // 統計日不同（例：兩段日期區間）：舊的在前；其他（條件）並列
            if (ax && ay && ax !== ay) return { context, tags: ay < ax ? [ty, tx] : [tx, ty], sep: '→', swap: ay < ax };
            return { context, tags: [tx, ty], sep: 'vs.', swap: false };
        }
        // 共同情境不同（不同賽季，或舊項目退回整段情境）：整段情境當比較對象
        const sx = seasonOf(cx.base), sy = seasonOf(cy.base);
        const tx = x.context || '', ty = y.context || '';
        if (sx && sy && sx !== sy) return { context: '', tags: sy < sx ? [ty, tx] : [tx, ty], sep: '→', swap: sy < sx };
        if (ax && ay && ax !== ay) return { context: '', tags: ay < ax ? [ty, tx] : [tx, ty], sep: '→', swap: ay < ax };
        return { context: '', tags: [tx, ty], sep: 'vs.', swap: false };
    };
    const compare = (id) => {
        const a = items(), i = a.findIndex(x => x.id === id);
        if (i < 0 || !canCompare(a[i], a[i + 1])) return;
        if (canComparePairs(a[i], a[i + 1])) {   // 兩組成對指標：各組依序合成比較項，再併成一行；src 保留原兩組供「拆開」
            const s = compareShape(a[i].parts[0], a[i + 1].parts[0]);
            const [x, y] = s.swap ? [a[i + 1], a[i]] : [a[i], a[i + 1]];
            const parts = x.parts.map((p, k) => Object.assign({}, p, { kind: 'compare', context: s.context, sep: s.sep, rank: null, pr: null, note: null,
                values: [Object.assign({}, p.values[0], { tag: s.tags[0] }), Object.assign({}, y.parts[k].values[0], { tag: s.tags[1] })] }));
            a.splice(i, 2, { id: uid(), kind: 'compare', subject: x.subject, context: s.context, sep: s.sep, parts, src: [a[i], a[i + 1]] });
            save(a);
            return;
        }
        const ext = canCompareSingles(a[i], a[i + 1]) ? null : extendShape(a[i], a[i + 1]);
        if (ext) {   // 比較項延伸成多值比較；src 保留原兩項供「拆開」
            const c = ext.cmp;
            a.splice(i, 2, { id: uid(), kind: 'compare', subject: c.subject, context: c.context, label: c.label, en: c.en, gkey: c.gkey,
                pre: c.pre, values: ext.values, sep: c.sep, rank: null, pr: null, note: null, better: c.better || null,
                asOf: [a[i].asOf, a[i + 1].asOf].filter(Boolean).sort().pop() || null, url: c.url || '', game: null, src: [a[i], a[i + 1]] });
            save(a);
            return;
        }
        const s = compareShape(a[i], a[i + 1]);
        const [x, y] = s.swap ? [a[i + 1], a[i]] : [a[i], a[i + 1]];
        const v = (it, tag) => Object.assign({}, it.values[0], { tag });
        // 名次不帶（兩個情境的名次不能並排）；src 保留原兩項（照籃子順序），供「拆開」還原
        a.splice(i, 2, { id: uid(), kind: 'compare', subject: x.subject, context: s.context, label: x.label, en: x.en, gkey: x.gkey,
            pre: x.pre, values: [v(x, s.tags[0]), v(y, s.tags[1])], sep: s.sep, rank: null, pr: null, note: null, better: x.better || null,
            asOf: [x.asOf, y.asOf].filter(Boolean).sort().pop() || null, url: y.url || x.url || '', game: null, src: [a[i], a[i + 1]] });
        save(a);
    };
    // 拆開：併成一行的還原成兩項、合成比較的還原成原本兩個單值
    const split = (id) => {
        const a = items(), i = a.findIndex(x => x.id === id);
        if (i < 0 || !(a[i].parts || a[i].src)) return;
        // 合成比較的成對指標同時有 parts 與 src：還原成合成前的兩組（src）
        a.splice(i, 1, ...(a[i].src || a[i].parts));
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
        // 全域期間篩選中、逐場加總類（asOf agg）的數字：情境附上期間（例「2026-27 例行賽 勝場（8 場）」），避免被當成季平均；
        // 日期區間有結束日 → 統計日用結束日。periodless：不跟期間的逐場數字（身分列）。ctxNote：情境補充（例「逐場加權近似」）
        const inPeriod = fields.asOf === 'agg' && c.period && !fields.periodless;
        const asOf = fields.asOf === 'none' || c.isHistory ? null
            : (inPeriod && c.periodEnd) ? c.periodEnd : (fields.asOf === 'agg' ? c.asOfAgg : c.asOfSnap) || null;
        let url = '';
        try { url = `${window.location.origin}${window.location.pathname}${window.location.hash}`; } catch (e) { /* Node */ }
        // ctxBase／ctxPeriod：情境拆開記，合成比較時共同情境用 ctxBase、比較對象用各自的 ctxPeriod（沒有期間＝全季）
        const ctxBase = c.context || c.season || '';
        const ctxPeriod = inPeriod ? c.period : '';
        const context = [ctxBase, ctxPeriod, fields.ctxNote || ''].filter(Boolean).join(' ');
        const it = Object.assign({ kind: 'single', subject, context, sep: '→', rank: null, pr: null, note: null, better: null, url, game: c.game || null },
            fields, { asOf, ctxBase, ctxPeriod });
        // 原文只留名稱：畫面小字的補充說明（如「DIFF%（負=守得好）」）不進貼文
        if (it.en) it.en = String(it.en).replace(/（[^）]*）/g, '').trim();
        return it;
    };

    window.Quote = { render, renderBlocks, items, add, remove, move, merge, split, canMerge, canCompare, compare, clear, opts, setOpts, subscribe, make, EVENT, DEFAULT_OPTS, PAIRS };
})();
