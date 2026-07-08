// アウトドア風の背景イラスト（夕暮れの山・湖・木立）。
// トップ（ランディング）と認証画面（ログイン/新規登録など）で共有する。
// 外部画像を使わない自作SVGなので軽量で、発色も自由に調整できる。

export function MountainScene({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`absolute inset-0 h-full w-full ${className}`}
      viewBox="0 0 1200 700"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <defs>
        <linearGradient id="ms-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2f93ad" />
          <stop offset="45%" stopColor="#69c1c4" />
          <stop offset="72%" stopColor="#bfe3c0" />
          <stop offset="100%" stopColor="#f4d79a" />
        </linearGradient>
        <radialGradient id="ms-sun" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff7df" />
          <stop offset="35%" stopColor="#ffedb8" />
          <stop offset="100%" stopColor="#ffedb8" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ms-lake" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#cdeef0" />
          <stop offset="100%" stopColor="#8fc9c9" />
        </linearGradient>
      </defs>

      {/* 空 */}
      <rect width="1200" height="700" fill="url(#ms-sky)" />

      {/* 太陽の光 */}
      <circle cx="620" cy="380" r="210" fill="url(#ms-sun)" />
      <circle cx="620" cy="392" r="42" fill="#fffae8" />

      {/* 遠景の山 */}
      <path
        d="M0 380 L160 300 L320 360 L470 300 L620 350 L760 300 L920 360 L1060 310 L1200 360 L1200 700 L0 700 Z"
        fill="#7fc6c4"
        opacity="0.85"
      />

      {/* 中景の山（対岸） */}
      <path
        d="M0 410 L200 360 L420 415 L620 372 L820 418 L1020 362 L1200 405 L1200 700 L0 700 Z"
        fill="#4faab0"
      />

      {/* 湖 */}
      <ellipse cx="620" cy="470" rx="285" ry="26" fill="url(#ms-lake)" />

      {/* 手前の丘（湖の下半分を隠して水際をつくる） */}
      <path
        d="M0 500 L180 480 L360 496 L520 486 L620 493 L760 484 L940 497 L1120 482 L1200 492 L1200 700 L0 700 Z"
        fill="#2f8790"
      />

      {/* 最前景 */}
      <path
        d="M0 560 L200 600 L400 570 L620 610 L820 575 L1020 605 L1200 575 L1200 700 L0 700 Z"
        fill="#16505a"
      />

      {/* 木立（前景の左右に配置してフレーミング） */}
      <g fill="#123f47">
        <PineTree x={85} y={620} s={1.5} />
        <PineTree x={185} y={640} s={1.05} />
        <PineTree x={270} y={625} s={1.25} />
      </g>
      <g fill="#123f47">
        <PineTree x={1115} y={620} s={1.5} />
        <PineTree x={1015} y={640} s={1.05} />
        <PineTree x={930} y={625} s={1.25} />
      </g>
    </svg>
  )
}

/** シンプルな針葉樹のシルエット */
function PineTree({ x, y, s }: { x: number; y: number; s: number }) {
  const w = 34 * s
  const h = 110 * s
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
