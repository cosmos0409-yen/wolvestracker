// Tailwind 預編譯設定（由 scripts/bundle.py 呼叫 CLI 產生 dist/app.css）
// content 只掃 components 與 index.html：class 必須完整寫在原始碼裡，
// 不可用字串拼接（如 `text-${color}-400`），否則 CLI 掃不到、樣式會消失
module.exports = {
    content: ['./components/**/*.js', './index.html'],
    theme: {
        extend: {
            // 字體（Google Fonts 於 index.html 載入）：
            //   sans    內文與中文（Noto Sans TC）
            //   display 大數字與標題（Barlow Condensed，窄體運動感；中文自動退回 Noto Sans TC）
            //   mono    小標籤、NBA 原文、表格數字（JetBrains Mono）
            fontFamily: {
                sans: ['"Noto Sans TC"', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
                display: ['"Barlow Condensed"', '"Noto Sans TC"', 'system-ui', 'sans-serif'],
                mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
            },
            // 無障礙對比（WCAG AA，小字需 ≥ 4.5:1）：Tailwind 原生 slate-500 在 #0A1626 上只有 3.8、
            // slate-600 只有 2.4。全站 slate-500/600 只當文字色用，故直接調亮（各約 5.8 / 5.3）
            colors: {
                slate: { 500: '#8493A8', 600: '#7C8CA2' },
            },
        },
    },
    plugins: [],
};
