'use client'

// 確認ダイアログ。
// ブラウザ標準の confirm() はLINE内ブラウザで素っ気ないOSダイアログになり、
// アプリの見た目から浮く。また、削除のような取り返しのつかない操作でも
// 見た目が同じで警戒しづらい。
//
// 呼び出し側は useConfirm() を使い、標準の confirm と同じ形で書ける:
//   if (!(await confirm({ title: '削除しますか？' }))) return

import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { useDialogDismiss } from '@/components/useDialogDismiss'

export type ConfirmOptions = {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  /** danger にすると確認ボタンが赤くなる（削除など元に戻せない操作用） */
  tone?: 'normal' | 'danger'
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

export function useConfirm(): ConfirmFn {
  const confirm = useContext(ConfirmContext)
  if (!confirm) {
    throw new Error('useConfirm は ConfirmProvider の内側で使ってください')
  }
  return confirm
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolveRef = useRef<((result: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>((nextOptions) => {
    setOptions(nextOptions)
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve
    })
  }, [])

  const close = useCallback((result: boolean) => {
    setOptions(null)
    const resolve = resolveRef.current
    resolveRef.current = null
    resolve?.(result)
  }, [])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options && <ConfirmDialog options={options} onClose={close} />}
    </ConfirmContext.Provider>
  )
}

function ConfirmDialog({
  options,
  onClose,
}: {
  options: ConfirmOptions
  onClose: (result: boolean) => void
}) {
  const cancel = useCallback(() => onClose(false), [onClose])
  useDialogDismiss(cancel)

  const danger = options.tone === 'danger'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
      onClick={cancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div
        className="animate-toast-in w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="confirm-dialog-title" className="text-base font-bold text-gray-800">
          {options.title}
        </h2>

        {options.message && (
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-600">
            {options.message}
          </p>
        )}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={() => onClose(true)}
            className={`pressable flex-1 rounded-xl py-2.5 text-sm font-bold text-white ${
              danger ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {options.confirmLabel ?? 'はい'}
          </button>
          <button
            type="button"
            onClick={cancel}
            autoFocus
            className="pressable flex-1 rounded-xl bg-gray-100 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-200"
          >
            {options.cancelLabel ?? 'キャンセル'}
          </button>
        </div>
      </div>
    </div>
  )
}
