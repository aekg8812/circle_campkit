'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const items = [
  { href: '/home', label: 'ホーム', icon: '🏠' },
  { href: '/profile', label: 'プロフィール', icon: '👤' },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white sm:hidden print:hidden">
      <div className="mx-auto flex max-w-5xl">
        {items.map((item) => {
          // ホームタブはグループ関連の画面でもアクティブ表示にする
          const active =
            item.href === '/home'
              ? pathname === '/home' || pathname.startsWith('/groups')
              : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-semibold transition ${
                active ? 'text-green-700' : 'text-gray-400'
              }`}
            >
              <span className="text-xl leading-none">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
