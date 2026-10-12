// Tailwind 預編譯設定（由 scripts/bundle.py 呼叫 CLI 產生 dist/app.css）
// content 只掃 components 與 index.html：class 必須完整寫在原始碼裡，
// 不可用字串拼接（如 `text-${color}-400`），否則 CLI 掃不到、樣式會消失
module.exports = {
    content: ['./components/**/*.js', './index.html'],
    theme: { extend: {} },
    plugins: [],
};
