// 在 Node 裡載入打包好的 dist/components-bundle.js（測的就是上線的程式），回傳它的 window。
// React／ReactDOM／document 換成空殼：元件只會被「定義」、不會渲染；純邏輯（window.GameAgg、window.Cache、window.CapCalc、
// window.Quote、window.Num、seasonForDate…）都能直接呼叫。每次呼叫都是全新的沙盒（localStorage 各自獨立）。
// 用法：const w = require('./load_bundle')();  或  require('./load_bundle')({ storage: {...初始 localStorage...} })
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const BUNDLE = path.join(__dirname, '..', '..', 'dist', 'components-bundle.js');

// 假的 localStorage（行為對齊瀏覽器：值一律轉字串；quota 可設上限模擬存滿）
function fakeStorage(init = {}, quotaChars = Infinity) {
    const m = new Map(Object.entries(init).map(([k, v]) => [k, String(v)]));
    const used = () => [...m].reduce((n, [k, v]) => n + k.length + v.length, 0);
    return {
        get length() { return m.size; },
        key: (i) => [...m.keys()][i] ?? null,
        getItem: (k) => (m.has(k) ? m.get(k) : null),
        setItem(k, v) {
            const s = String(v), prev = m.get(k);
            if (used() - (prev ? k.length + prev.length : 0) + k.length + s.length > quotaChars) {
                const e = new Error('quota exceeded'); e.name = 'QuotaExceededError'; throw e;
            }
            m.set(k, s);
        },
        removeItem: (k) => { m.delete(k); },
        clear: () => m.clear(),
        _dump: () => Object.fromEntries(m),
    };
}

// React 空殼：任何屬性都回傳「什麼都不做的函式」（useState 回 [初值, noop]）
const noop = () => {};
const reactStub = new Proxy({
    createElement: () => null, Fragment: 'Fragment', createContext: () => ({ Provider: noop, Consumer: noop }),
    useState: (v) => [typeof v === 'function' ? v() : v, noop], useRef: (v) => ({ current: v }),
    useMemo: (f) => f(), useCallback: (f) => f, useEffect: noop, useLayoutEffect: noop, useContext: () => ({}),
    memo: (c) => c, forwardRef: (c) => c,
}, { get: (t, k) => (k in t ? t[k] : noop) });

function loadBundle({ storage = {}, quotaChars = Infinity } = {}) {
    const elem = () => ({ style: {}, classList: { add: noop, remove: noop, toggle: noop }, appendChild: noop, setAttribute: noop,
        addEventListener: noop, removeEventListener: noop, querySelector: () => null, querySelectorAll: () => [] });
    const sandbox = {
        console, setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask, structuredClone,
        URL, URLSearchParams, TextEncoder, TextDecoder,
        React: reactStub,
        ReactDOM: { createRoot: () => ({ render: noop, unmount: noop }), createPortal: () => null },
        document: { getElementById: elem, createElement: elem, querySelector: () => null, querySelectorAll: () => [],
            addEventListener: noop, removeEventListener: noop, body: elem(), documentElement: elem(), fonts: { ready: Promise.resolve() } },
        location: { hash: '', href: 'http://localhost/', pathname: '/', search: '' },
        history: { replaceState: noop, pushState: noop },
        navigator: { clipboard: { writeText: async () => {} }, userAgent: 'node' },
        localStorage: fakeStorage(storage, quotaChars),
        addEventListener: noop, removeEventListener: noop, dispatchEvent: noop, matchMedia: () => ({ matches: false, addEventListener: noop }),
        CustomEvent: class CustomEvent { constructor(t, o) { this.type = t; this.detail = o && o.detail; } },
        IntersectionObserver: class { observe() {} disconnect() {} },
        requestAnimationFrame: (f) => setTimeout(f, 0), cancelAnimationFrame: noop,
        innerWidth: 1280, innerHeight: 800, scrollTo: noop,
        isCloudEnabled: false, db: null, firebaseModules: null,
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    sandbox.self = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(BUNDLE, 'utf8'), sandbox, { filename: 'components-bundle.js' });
    return sandbox;
}

module.exports = loadBundle;
module.exports.fakeStorage = fakeStorage;
module.exports.BUNDLE = BUNDLE;
