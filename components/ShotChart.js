// 投籃熱圖元件：讀取 wolves_shotcharts/{playerId}_{season}_{type}，以 SVG 半場圖繪出手點
// 座標系：NBA 官方 shotchartdetail（單位 0.1 呎，籃框在原點），SVG y 軸取負值翻轉
// teamMode=true 時讀 wolves_shotcharts/TEAM_{season}_{type}（全隊出手）
const ShotChart = ({ playerId, playerName, teamMode = false }) => {
    const { useState, useEffect } = React;
    const [shots, setShots] = useState(null);   // null=載入中, []=無資料
    const [filter, setFilter] = useState('all'); // 'all' | 'made' | 'missed'

    const season = window.CURRENT_SEASON;
    const idPart = teamMode ? 'TEAM' : playerId;
    // 依目前賽季階段選 doc；季後賽讀不到時退回例行賽
    const phase = window.getSeasonPhase ? window.getSeasonPhase() : { type: 'regular' };
    const preferredTypes = phase.type === 'playoffs' ? ['playoffs', 'regular'] : ['regular'];

    useEffect(() => {
        if ((!playerId && !teamMode) || !window.db || !window.firebaseModules) return;
        let cancelled = false;
        setShots(null);
        (async () => {
            const cache = (window.__shotchartCache = window.__shotchartCache || {});
            const { doc: docFn, getDoc } = window.firebaseModules;
            for (const typeKey of preferredTypes) {
                const docId = `${idPart}_${season}_${typeKey}`;
                if (cache[docId] !== undefined) {
                    if (cache[docId] && !cancelled) { setShots(cache[docId]); return; }
                    continue; // 快取記錄此 doc 不存在，試下一個
                }
                try {
                    const snap = await getDoc(docFn(window.db, 'wolves_shotcharts', docId));
                    cache[docId] = snap.exists() ? (snap.data().shots || []) : null;
                    if (cache[docId] && !cancelled) { setShots(cache[docId]); return; }
                } catch (e) {
                    console.error('shotchart fetch fail', docId, e);
                }
            }
            if (!cancelled) setShots([]);
        })();
        return () => { cancelled = true; };
    }, [playerId, season, teamMode]);

    if (!playerId && !teamMode) return null;

    const made = shots ? shots.filter(s => s.made === 1).length : 0;
    const total = shots ? shots.length : 0;
    const fgPct = total > 0 ? ((made / total) * 100).toFixed(1) : '-';
    const visible = shots ? shots.filter(s =>
        filter === 'all' || (filter === 'made' ? s.made === 1 : s.made !== 1)
    ) : [];

    const lineStyle = { stroke: '#334155', strokeWidth: 3, fill: 'none' };

    return (
        <div className="border border-slate-800 rounded-xl p-6 relative overflow-hidden bg-slate-900 border-l-4 border-l-[#12A150]">
            <div className="flex flex-wrap justify-between items-center border-b-2 border-[#C4CED2]/30 pb-2 mb-4 gap-2">
                <h2 className="text-xl font-bold">投籃熱圖 (Shot Chart)</h2>
                <div className="flex items-center gap-3">
                    {total > 0 && (
                        <span className="text-xs text-slate-400 font-mono">{made}/{total}（{fgPct}%）</span>
                    )}
                    <div className="flex bg-slate-800 rounded p-1">
                        {[
                            { k: 'all', l: '全部' },
                            { k: 'made', l: '命中' },
                            { k: 'missed', l: '未中' },
                        ].map(opt => (
                            <button key={opt.k} onClick={() => setFilter(opt.k)}
                                className={`px-3 py-1 text-xs rounded transition-colors ${filter === opt.k ? 'bg-[#12A150] text-[#0C2340] font-bold shadow' : 'text-slate-400 hover:text-white'}`}>
                                {opt.l}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
            {shots === null && (
                <div className="h-[300px] flex items-center justify-center text-slate-500 text-sm animate-pulse">載入投籃資料中...</div>
            )}
            {shots !== null && total === 0 && (
                <div className="h-[120px] flex items-center justify-center text-slate-500 text-sm">
                    {playerName} 尚無投籃座標資料（每週更新一次）
                </div>
            )}
            {shots !== null && total > 0 && (
                <div className="flex flex-col items-center">
                    <svg viewBox="-250 -470 500 522" className="w-full max-w-[480px]">
                        {/* 出手點（先畫，讓球場線壓在上面）；球隊模式點多，統一用小圓點避免上萬 SVG 節點卡頓 */}
                        {teamMode
                            ? visible.map((s, i) => (
                                <circle key={i} cx={s.x} cy={-s.y} r="2.5"
                                    fill={s.made === 1 ? '#12A150' : '#ef4444'}
                                    fillOpacity={s.made === 1 ? 0.5 : 0.3} />
                            ))
                            : visible.map((s, i) => (
                                s.made === 1
                                    ? <circle key={i} cx={s.x} cy={-s.y} r="5" fill="#12A150" fillOpacity="0.55" />
                                    : <g key={i} stroke="#ef4444" strokeOpacity="0.45" strokeWidth="2.5">
                                        <line x1={s.x - 4} y1={-s.y - 4} x2={s.x + 4} y2={-s.y + 4} />
                                        <line x1={s.x - 4} y1={-s.y + 4} x2={s.x + 4} y2={-s.y - 4} />
                                    </g>
                            ))}
                        {/* 球場線（NBA 半場，單位 0.1 呎） */}
                        <rect x="-250" y="-470" width="500" height="517.5" {...lineStyle} />
                        <rect x="-80" y="-142.5" width="160" height="190" {...lineStyle} />
                        <circle cx="0" cy="-142.5" r="60" {...lineStyle} />
                        <path d="M -40 0 A 40 40 0 0 1 40 0" {...lineStyle} />
                        <line x1="-30" y1="12.5" x2="30" y2="12.5" stroke="#475569" strokeWidth="4" />
                        <circle cx="0" cy="0" r="7.5" stroke="#475569" strokeWidth="3" fill="none" />
                        <line x1="-220" y1="47.5" x2="-220" y2="-89.5" {...lineStyle} />
                        <line x1="220" y1="47.5" x2="220" y2="-89.5" {...lineStyle} />
                        <path d="M -220 -89.5 A 237.5 237.5 0 0 1 220 -89.5" {...lineStyle} />
                    </svg>
                    <div className="flex gap-4 mt-2 text-xs text-slate-400">
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full inline-block bg-[#12A150]"></span> 命中</span>
                        {teamMode
                            ? <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full inline-block bg-[#ef4444]"></span> 未命中</span>
                            : <span className="flex items-center gap-1 text-red-400 font-bold">✕ <span className="text-slate-400 font-normal">未命中</span></span>}
                        <span className="text-slate-500">每週更新</span>
                    </div>
                </div>
            )}
        </div>
    );
};

window.ShotChart = ShotChart;
