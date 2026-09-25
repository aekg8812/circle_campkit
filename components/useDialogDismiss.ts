'use client'

// モーダルを「Escape キーで閉じられる」「背後が動かない」状態にする共通処理。
// どのモーダルも同じ挙動になるよう、開いている間だけ有効にする。
//
// enabled を渡せるのは、モーダルが親の中で条件付きに描画されており、
// フック自体は常に呼ばれる（フックの数は変えられない）ため。

import { useEffect, useRef } from 'react'

export function useDialogDismiss(onDismiss: () => void, enabled = true) {
  // 毎回の再描画で listener を付け外ししないよう、呼び出し先だけ差し替える
  const dismissRef = useRef(onDismiss)

  useEffect(() => {
    dismissRef.current = onDismiss
  }, [onDismiss])

  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismissRef.current()
    }
    document.addEventListener('keydown', handleKeyDown)

    // 背後の画面がスクロールすると、どこを見ていたか分からなくなる
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [enabled])
}
