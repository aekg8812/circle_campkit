// ログイン後の全ページ共通の、ごく控えめな山のシルエット背景。
// 画面下部に固定して、コンテンツ（白いカード）の後ろにうっすら見せることで、
// 読みやすさを損なわずにアプリ全体へ“アウトドアの世界観”を広げる。
// 装飾なので操作を邪魔しない（pointer-events:none / aria-hidden）。

export default function AppBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 bottom-0 z-0 h-40 sm:h-52 print:hidden"
    >
      <svg
        className="absolute bottom-0 h-full w-full"
        viewBox="0 0 1200 220"
        preserveAspectRatio="xMidYMax slice"
      >
        {/* 奥の稜線 */}
        <path
          d="M0 120 L180 70 L360 120 L540 60 L720 120 L900 70 L1080 120 L1200 90 L1200 220 L0 220 Z"
          fill="#3f9aa2"
          opacity="0.12"
        />
        {/* 手前の稜線 */}
        <path
          d="M0 160 L200 120 L420 165 L620 115 L820 165 L1020 120 L1200 160 L1200 220 L0 220 Z"
          fill="#2f8790"
          opacity="0.14"
        />
        {/* 針葉樹 */}
        <g fill="#1c5f68" opacity="0.14">
          <PineTree x={90} y={165} s={1.1} />
          <PineTree x={160} y={175} s={0.8} />
          <PineTree x={1110} y={165} s={1.1} />
          <PineTree x={1040} y={175} s={0.8} />
        </g>
      </svg>
    </div>
  )
}

function PineTree({ x, y, s }: { x: number; y: number; s: number }) {
  const w = 30 * s
  const h = 78 * s
  return (
    <path
      d={`M${x} ${y - h}
          L${x + w * 0.5} ${y - h * 0.55}
          L${x + w * 0.28} ${y - h * 0.55}
          L${x + w * 0.62} ${y - h * 0.18}
          L${x + w * 0.34} ${y - h * 0.18}
          L${x + w * 0.7} ${y}
          L${x - w * 0.7} ${y}
          L${x - w * 0.34} ${y - h * 0.18}
          L${x - w * 0.62} ${y - h * 0.18}
          L${x - w * 0.28} ${y - h * 0.55}
          L${x - w * 0.5} ${y - h * 0.55}
          Z`}
    />
  )
}
