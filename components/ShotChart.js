// 投籃熱圖元件：讀取 wolves_shotcharts/{playerId}_{season}_{type}，以 SVG 半場圖繪出手點
// 座標系：NBA 官方 shotchartdetail（單位 0.1 呎，籃框在原點），SVG y 軸取負值翻轉
// teamMode=true 時讀 wolves_shotcharts/TEAM_{season}_{type}（全隊出手）
const ShotChart = ({ playerId, playerName, teamMode = false, externalShots, periodLabel }) => {
    const { useState, useEffect } = React;
    const [loadedShots, setLoadedShots] = useState(null);   // null=載入中, []=無資料
    const [filter, setFilter] = useState('all'); // 'all' | 'made' | 'missed'
    const chartRef = React.useRef(null);   // 匯出配圖用；hook 須在下方提早 return 之前
    // externalShots 提供時（ShootingTab 傳入已篩選出手），直接用它、不自行載入
    const useExternal = externalShots !== undefined;
    const shots = useExternal ? externalShots : loadedShots;

    const season = window.CURRENT_SEASON;
    const idPart = teamMode ? 'TEAM' : playerId;
    // 依目前賽季階段選 doc；季後賽讀不到時退回例行賽
    const phase = window.getSeasonPhase ? window.getSeasonPhase() : { type: 'regular' };
    const preferredTypes = phase.type === 'playoffs' ? ['playoffs', 'regular'] : ['regular'];

    useEffect(() => {
        if (useExternal) return; // 外部提供出手，不載入
        if ((!playerId && !teamMode) || !window.db || !window.firebaseModules) return;
        let cancelled = false;
        setLoadedShots(null);
        (async () => {
            const cache = (window.__shotchartCache = window.__shotchartCache || {});
            const { doc: docFn, getDoc } = window.firebaseModules;
            for (const typeKey of preferredTypes) {
                const docId = `${idPart}_${season}_${typeKey}`;
                if (cache[docId] !== undefined) {
                    if (cache[docId] && !cancelled) { setLoadedShots(cache[docId]); return; }
                    continue; // 快取記錄此 doc 不存在，試下一個
                }
                try {
                    const snap = await getDoc(docFn(window.db, 'wolves_shotcharts', docId));
                    cache[docId] = snap.exists() ? (snap.data().shots || []) : null;
                    if (cache[docId] && !cancelled) { setLoadedShots(cache[docId]); return; }
                } catch (e) {
                    console.error('shotchart fetch fail', docId, e);
                }
            }
            if (!cancelled) setLoadedShots([]);
        })();
        return () => { cancelled = true; };
    }, [playerId, season, teamMode, useExternal]);

    if (!playerId && !teamMode) return null;

    const made = shots ? shots.filter(s => s.made === 1).length : 0;
    const total = shots ? shots.length : 0;
    const fgPct = total > 0 ? ((made / total) * 100).toFixed(1) : '-';
    const visible = shots ? shots.filter(s =>
        filter === 'all' || (filter === 'made' ? s.made === 1 : s.made !== 1)
    ) : [];

    // 球場線：淡月光銀，先畫（壓在出手點下面），點才看得清楚
    const lineStyle = { stroke: 'rgba(196, 206, 210, 0.28)', strokeWidth: 2, fill: 'none' };
    const UI = window.UI;
    const MADE = '#12A150', MISS = '#EF4444';

    return (
        <UI.Section title="投籃分布" en="Shot Chart" accent="green"
            sub={`${periodLabel ? periodLabel + ' · ' : ''}實心綠點＝命中，空心紅環＝未中 · 逐球座標賽後隔天更新`}
            right={<>
                {total > 0 && <span className="font-mono text-[12px] tabular-nums text-slate-400">{made}/{total}（{fgPct}%）</span>}
                {total > 0 && <UI.ExportMenu title={`投籃分布（${periodLabel || '全季'}，${filter === 'made' ? '只看命中' : filter === 'missed' ? '只看未中' : `${made}/${total}，${fgPct}%`}）`} getNode={() => chartRef.current} />}
                <UI.Seg ariaLabel="顯示出手" size="sm" value={filter} onChange={setFilter}
                    options={[{ value: 'all', label: '全部' }, { value: 'made', label: '命中' }, { value: 'missed', label: '未中' }]} />
            </>}>
            {shots === null && (
                <div className="py-16 text-center text-sm text-slate-500 animate-pulse">載入投籃資料中…</div>
            )}
            {shots !== null && total === 0 && (
                <UI.Note>{playerName} 尚無投籃座標資料（賽後隔天更新）</UI.Note>
            )}
            {shots !== null && total > 0 && (
                <div ref={chartRef} className="flex flex-col items-center">
                    <svg viewBox="-250 -470 500 522" className="w-full max-w-[520px]" role="img" aria-label={`${playerName} 投籃分布：${made} 命中 / ${total} 出手`}>
                        <rect x="-250" y="-470" width="500" height="517.5" fill="rgba(255, 255, 255, 0.015)" />
                        {/* 球場線（NBA 半場，單位 0.1 呎） */}
                        <rect x="-250" y="-470" width="500" height="517.5" {...lineStyle} />
                        <rect x="-80" y="-142.5" width="160" height="190" {...lineStyle} />
                        <circle cx="0" cy="-142.5" r="60" {...lineStyle} />
                        <path d="M -40 0 A 40 40 0 0 1 40 0" {...lineStyle} />
                        <line x1="-30" y1="12.5" x2="30" y2="12.5" stroke="rgba(196, 206, 210, 0.45)" strokeWidth="3" />
                        <circle cx="0" cy="0" r="7.5" stroke="rgba(196, 206, 210, 0.45)" strokeWidth="2.5" fill="none" />
                        <line x1="-220" y1="47.5" x2="-220" y2="-89.5" {...lineStyle} />
                        <line x1="220" y1="47.5" x2="220" y2="-89.5" {...lineStyle} />
                        <path d="M -220 -89.5 A 237.5 237.5 0 0 1 220 -89.5" {...lineStyle} />
                        {/* 出手點：未中先畫、命中後畫（命中壓在上面）；球隊模式點多，縮小尺寸避免糊成一片 */}
                        {visible.filter(s => s.made !== 1).map((s, i) => (
                            <circle key={'m' + i} cx={s.x} cy={-s.y} r={teamMode ? 2.4 : 4.2} fill="none"
                                stroke={MISS} strokeOpacity={teamMode ? 0.35 : 0.6} strokeWidth={teamMode ? 1 : 1.6} />
                        ))}
                        {visible.filter(s => s.made === 1).map((s, i) => (
                            <circle key={'h' + i} cx={s.x} cy={-s.y} r={teamMode ? 2.4 : 4.2}
                                fill={MADE} fillOpacity={teamMode ? 0.5 : 0.8} />
                        ))}
                    </svg>
                    <div className="mt-3 flex gap-5 text-[12px] text-slate-400">
                        <span className="flex items-center gap-1.5"><svg width="10" height="10" aria-hidden="true"><circle cx="5" cy="5" r="4" fill={MADE} /></svg>命中</span>
                        <span className="flex items-center gap-1.5"><svg width="10" height="10" aria-hidden="true"><circle cx="5" cy="5" r="3.5" fill="none" stroke={MISS} strokeWidth="1.5" /></svg>未中</span>
                    </div>
                </div>
            )}
        </UI.Section>
    );
};

window.ShotChart = ShotChart;
