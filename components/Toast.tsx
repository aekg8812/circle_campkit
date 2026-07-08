'use client'

// トースト通知（No.40）
// 目的: 「保存しました」等のフィードバックを、画面を覆わず一瞬で伝える。
//   従来のインライン緑メッセージは場所を取り見落としやすいのに対し、
//   トーストは視線を邪魔せず自動で消えるためストレスが少ない。
// アクセシビリティ: コンテナに role="status" / aria-live="polite" を付け、
//   スクリーンリーダーが内容を読み上げる。装飾アイコンは aria-hidden。

import { createContext, useCallback, useContext, useState } from 'react'

type ToastType = 'success' | 'error' | 'info'
type ToastItem = { id: number; message: string; type: ToastType }

type ToastContextValue = {
  toast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast は ToastProvider の内側で使ってください')
  }
  return ctx.toast
}

let nextId = 1

const typeStyles: Record<ToastType, { className: string; icon: string }> = {
  success: {
    className: 'bg-green-600 text-white ring-green-700/20',
    icon: '✓',
  },
  error: {
    className: 'bg-red-600 text-white ring-red-700/20',
    icon: '!',
  },
  info: {
    className: 'bg-gray-800 text-white ring-black/20',
    icon: 'i',
  },
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = nextId++
    setItems((current) => [...current, { id, message, type }])
    // 約3.4秒で自動的に消す
    window.setTimeout(() => {
      setItems((current) => current.filter((item) => item.id !== id))
    }, 3400)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 pb-24 sm:pb-4 print:hidden"
      >
        {items.map((item) => {
          const style = typeStyles[item.type]
          return (
            <div
              key={item.id}
              className={`animate-toast-in pointer-events-auto flex w-full max-w-sm items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-semibold shadow-lg ring-1 ${style.className}`}
            >
              <span
                aria-hidden
                className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-white/20 text-xs"
              >
                {style.icon}
              </span>
              <span className="flex-1">{item.message}</span>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
