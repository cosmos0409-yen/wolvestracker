// 防守熱圖：半場 5 區依「對手命中率 − 該區聯盟約略均值」上色
// 綠 = 守得比平均好、紅 = 較差（用偏差而非絕對命中率，否則禁區永遠最紅、失去防守意義）
// 座標系同 ShotChart（0.1 呎，籃框在原點，y 取負向上）
const DefenseHeatmap = ({ defense }) => {
    // 各區聯盟約略均值(對手命中率 %)，供偏差著色的基準；隨賽季略有漂移，可微調
    const ZONE_REF = { RA: 63, PAINT: 42, MID: 41, C3: 39, AB3: 36 };

    // 偏差 → 顏色（+ = 對手投更準 = 守得差 = 紅；− = 守得好 = 綠）
    const devColor = (pct, ref) => {
        if (pct == null) return '#1e293b';
        const d = pct - ref;
        if (d <= -3) return '#15803d';   // 明顯優於均值
        if (d <= -1) return '#4ade80';   // 略優
        if (d < 1) return '#475569';     // 約略均值
        if (d < 3) return '#f87171';     // 略差
        return '#dc2626';                // 明顯差
    };

    const zone = (z) => defense[`${z}_OPP_FG_PCT`];
    const fill = (z) => ({ fill: devColor(zone(z), ZONE_REF[z]), fillOpacity: 0.55 });
    const lineStyle = { stroke: '#334155', strokeWidth: 3, fill: 'none' };
    const pctLabel = (z) => (zone(z) == null ? '-' : `${zone(z)}%`);

    // 標籤：對手命中率 + 中文區名（zoneKey 對應 ZONE_REF 的 key）
    const Label = ({ x, y, name, zoneKey }) => (
        <g>
            <text x={x} y={y} textAnchor="middle" fill="#f1f5f9" fontSize="15" fontWeight="bold">{pctLabel(zoneKey)}</text>
            <text x={x} y={y + 16} textAnchor="middle" fill="#cbd5e0" fontSize="11">{name}</text>
        </g>
    );

    return (
        <div className="border border-slate-800 rounded-xl p-6 relative overflow-hidden bg-slate-900 border-l-4 border-l-red-500">
            <h2 className="text-xl font-bold border-b-2 border-[#C4CED2]/30 pb-2 mb-4">防守熱圖 (對手分區命中率)</h2>
            <p className="text-xs text-slate-500 mb-3">綠 = 守得比聯盟平均好，紅 = 較差（依對手命中率與該區均值的偏差著色）</p>
            <div className="flex flex-col items-center">
                <svg viewBox="-250 -470 500 522" className="w-full max-w-[480px]">
                    {/* 分區色塊（由外而內疊，內層蓋外層） */}
                    <rect x="-250" y="-470" width="500" height="517.5" {...fill('AB3')} />
                    <path d="M -220 47.5 L -220 -89.5 A 237.5 237.5 0 0 1 220 -89.5 L 220 47.5 Z" {...fill('MID')} />
                    <rect x="-250" y="-89.5" width="30" height="137" {...fill('C3')} />
                    <rect x="220" y="-89.5" width="30" height="137" {...fill('C3')} />
                    <rect x="-80" y="-142.5" width="160" height="190" {...fill('PAINT')} />
                    <path d="M -60 0 A 60 60 0 0 1 60 0 L 60 47.5 L -60 47.5 Z" {...fill('RA')} />

                    {/* 球場線 */}
                    <rect x="-250" y="-470" width="500" height="517.5" {...lineStyle} />
                    <rect x="-80" y="-142.5" width="160" height="190" {...lineStyle} />
                    <circle cx="0" cy="-142.5" r="60" {...lineStyle} />
                    <line x1="-30" y1="12.5" x2="30" y2="12.5" stroke="#94a3b8" strokeWidth="4" />
                    <circle cx="0" cy="0" r="7.5" stroke="#94a3b8" strokeWidth="3" fill="none" />
                    <line x1="-220" y1="47.5" x2="-220" y2="-89.5" {...lineStyle} />
                    <line x1="220" y1="47.5" x2="220" y2="-89.5" {...lineStyle} />
                    <path d="M -220 -89.5 A 237.5 237.5 0 0 1 220 -89.5" {...lineStyle} />

                    {/* 標籤 */}
                    <Label x={0} y={-8} name="禁區" zoneKey="RA" />
                    <Label x={0} y={-95} name="油漆區" zoneKey="PAINT" />
                    <Label x={0} y={-215} name="中距離" zoneKey="MID" />
                    <Label x={0} y={-370} name="弧頂三分" zoneKey="AB3" />
                    <Label x={-235} y={-15} name="角落" zoneKey="C3" />
                </svg>
            </div>
        </div>
    );
};

window.DefenseHeatmap = DefenseHeatmap;
