'use client'

// 「一度読めば分かる説明」を、初回だけ開いた状態で出すための入れ物。
// 2回目以降は「ℹ️ 〇〇」の1行に畳まれ、押せばいつでも読み直せる。
//
// 読んだかどうかは、その端末の localStorage に持つ（サーバーには保存しない）。
// useSyncExternalStore を使うのは、サーバー描画時は必ず「未読」として扱い、
// エフェクト内での状態更新を避けるため。

import { useSyncExternalStore } from 'react'

const listeners = new Set<() => void>()

const storageKey = (id: string) => `campkit.note.${id}`

function readFlag(id: string): boolean {
  try {
    return localStorage.getItem(storageKey(id)) === '1'
  } catch {
    // プライベートモード等で読めない場合は「未読」として扱う
    return false
  }
}

function markAsRead(id: string) {
  try {
    localStorage.setItem(storageKey(id), '1')
  } catch {
    // 保存できなくても、この場で畳めれば実害はない
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

type Props = {
  /** 説明ごとに固有の名前。これが保存先のキーになる */
  id: string
  /** 畳んだときに出す見出し */
  label: string
  children: React.ReactNode
}

export default function FirstTimeNote({ id, label, children }: Props) {
  const alreadyRead = useSyncExternalStore(
    subscribe,
    () => readFlag(id),
    () => false
  )

  if (alreadyRead) {
    return (
      <details className="group">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs font-semibold text-gray-400 transition hover:text-green-700">
          <span aria-hidden>ℹ️</span>
          {label}
          <span aria-hidden className="transition group-open:rotate-90">
            ›
          </span>
        </summary>
        <div className="mt-2">{children}</div>
      </details>
    )
  }

  return (
    <div>
      {children}
      <button
        type="button"
        onClick={() => markAsRead(id)}
        className="mt-2 rounded-lg px-2 py-1 text-xs font-semibold text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
      >
        わかった（次からは畳んでおく）
      </button>
    </div>
  )
}
