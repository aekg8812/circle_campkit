'use client'

// LIFF（LINE Front-end Framework）の初期化。
// 目的: LINEアプリ内で開かれたときに、LINEの機能（ログイン・プロフィール取得・
//   トークへの共有など）を使えるようにする。
// 方針: LINEの外（通常のブラウザ）でも今まで通り動くことを最優先にする。
//   初期化に失敗しても例外を投げず、画面の表示をブロックしない。
//   SDK本体はサイズが大きいので、クライアントで必要になった時点で動的importする。

import { createContext, useContext, useEffect, useState } from 'react'

export type LiffState = {
  // liff.init() が成功したか
  ready: boolean
  // LINEアプリ内のブラウザで開かれているか（外部ブラウザなら false）
  isInLine: boolean
  // 初期化に失敗した理由。LINEの外では失敗しても問題ないので画面には出さない
  error: string | null
  // liff.init() の結果待ちか。
  // ログイン画面は「LINEが使えるか」で見た目を変えるので、
  // 判定前に中身を描いて直後に切り替わる（ちらつく）のを防ぐために使う。
  initializing: boolean
}

// LIFF ID が未設定の環境では初期化しないので、最初から待っていない扱いにする。
// この値はビルド時に埋め込まれるため、サーバーとクライアントで食い違わない。
const initialState: LiffState = {
  ready: false,
  isInLine: false,
  error: null,
  initializing: Boolean(process.env.NEXT_PUBLIC_LIFF_ID),
}

const LiffContext = createContext<LiffState>(initialState)

/** LIFFの初期化状態を読む。Providerの外で呼んでも初期値が返るだけで落ちない */
export function useLiff() {
  return useContext(LiffContext)
}

export function LiffProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<LiffState>(initialState)

  useEffect(() => {
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID
    // LIFF IDが未設定の環境では何もしない（通常のWebアプリとして動く）
    if (!liffId) return

    let cancelled = false

    // 初期化が返ってこないまま画面が待ち続けると、何も押せない画面に見えてしまう。
    // 一定時間で待つのをやめて、LINEが使えない場合の案内に切り替える。
    const timer = setTimeout(() => {
      if (cancelled) return
      setState((current) =>
        current.initializing
          ? { ...current, initializing: false, error: 'LIFFの初期化がタイムアウトしました' }
          : current
      )
    }, 6000)

    const init = async () => {
      try {
        const liff = (await import('@line/liff')).default
        await liff.init({ liffId })
        if (cancelled) return
        setState({ ready: true, isInLine: liff.isInClient(), error: null, initializing: false })
      } catch (error) {
        if (cancelled) return
        setState({
          ready: false,
          isInLine: false,
          error: error instanceof Error ? error.message : String(error),
          initializing: false,
        })
      }
    }

    init()

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [])

  return <LiffContext.Provider value={state}>{children}</LiffContext.Provider>
}
