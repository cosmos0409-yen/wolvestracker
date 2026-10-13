// 防守熱圖：半場 5 區依「對手命中率 − 該區聯盟約略均值」上色
// 綠 = 守得比平均好、紅 = 較差（用偏差而非絕對命中率，否則合理衝撞區永遠最紅、失去防守意義）
// 座標系同 ShotChart（0.1 呎，籃框在原點，y 取負向上）
const DefenseHeatmap = ({ defense }) => {
    // 各區聯盟約略均值(對手命中率 %)，供偏差著色的基準；隨賽季略有漂移，可微調
    const ZONE_REF = { RA: 63, PAINT: 42, MID: 41, C3: 39, AB3: 36 };

    // 偏差 → 顏色（+ = 對手投更準 = 守得差 = 紅；− = 守得好 = 綠；±1 內視為約略均值＝銀灰）。
    // 必須是「不透明」的最終色：各區色塊由外而內疊畫，若用半透明，內層會混到外層顏色，
    // 顏色就不再只代表該區本身（例：紅色禁區被綠色外圈混成咖啡色）
    const blend = (hex, a) => {   // 把 hex 以透明度 a 疊在底色 #0A1626 上，回傳不透明 rgb
        const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)), bg = [10, 22, 38];
        const m = c.map((v, i) => Math.round(bg[i] + (v - bg[i]) * a));
        return `rgb(${m[0]}, ${m[1]}, ${m[2]})`;
    };
    const devFill = (pct, ref) => {
        if (pct == null) return { fill: '#0A1626' };
        const d = pct - ref;
        if (d <= -3) return { fill: blend('#12A150', 0.6) };   // 明顯優於均值
        if (d <= -1) return { fill: blend('#12A150', 0.28) };  // 略優
        if (d < 1) return { fill: blend('#C4CED2', 0.12) };    // 約略均值
        if (d < 3) return { fill: blend('#EF4444', 0.28) };    // 略差
        return { fill: blend('#EF4444', 0.6) };                 // 明顯差
    };

    const zone = (z) => defense[`${z}_OPP_FG_PCT`];
    const fill = (z) => devFill(zone(z), ZONE_REF[z]);
    const lineStyle = { stroke: 'rgba(196, 206, 210, 0.3)', strokeWidth: 2, fill: 'none' };
    const pctLabel = (z) => (zone(z) == null ? '-' : `${zone(z)}%`);

    // 標籤：對手命中率 + 中文區名（zoneKey 對應 ZONE_REF 的 key）
    const Label = ({ x, y, name, zoneKey }) => (
        <g>
            <text x={x} y={y} textAnchor="middle" fill="#F8FAFC" fontSize="17" fontWeight="600" fontFamily="'Barlow Condensed', sans-serif">{pctLabel(zoneKey)}</text>
            <text x={x} y={y + 15} textAnchor="middle" fill="#C4CED2" fontSize="11">{name}</text>
        </g>
    );

    return (
        <window.UI.Section title="防守熱圖" en="Opponent FG% by Zone" accent="red"
            sub={`數字為對手在各區的命中率；顏色為與聯盟約略均值的偏差（綠＝守得較好、紅＝較差、銀＝±1 以內）。基準為寫死的參考值，非官方即時數字：合理衝撞區 ${ZONE_REF.RA}%、禁區（非 RA）${ZONE_REF.PAINT}%、中距離 ${ZONE_REF.MID}%、底角三分 ${ZONE_REF.C3}%、非底角三分 ${ZONE_REF.AB3}%`}>
            <div className="flex flex-col items-center">
                <svg viewBox="-285 -470 570 522" className="w-full max-w-[560px]" role="img" aria-label="防守熱圖：對手分區命中率">
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
                    <line x1="-30" y1="12.5" x2="30" y2="12.5" stroke="rgba(196, 206, 210, 0.45)" strokeWidth="3" />
                    <circle cx="0" cy="0" r="7.5" stroke="rgba(196, 206, 210, 0.45)" strokeWidth="2.5" fill="none" />
                    <line x1="-220" y1="47.5" x2="-220" y2="-89.5" {...lineStyle} />
                    <line x1="220" y1="47.5" x2="220" y2="-89.5" {...lineStyle} />
                    <path d="M -220 -89.5 A 237.5 237.5 0 0 1 220 -89.5" {...lineStyle} />

                    {/* 標籤 */}
                    <Label x={0} y={-8} name="合理衝撞區" zoneKey="RA" />
                    <Label x={0} y={-95} name="禁區(非RA)" zoneKey="PAINT" />
                    <Label x={0} y={-215} name="中距離" zoneKey="MID" />
                    <Label x={0} y={-370} name="非底角三分" zoneKey="AB3" />
                    <Label x={-235} y={-15} name="底角" zoneKey="C3" />
                </svg>
            </div>
        </window.UI.Section>
    );
};

window.DefenseHeatmap = DefenseHeatmap;
