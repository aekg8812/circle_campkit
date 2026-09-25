'use client'

// LINEでログインするボタン。
// LIFFの初期化が成功しているときだけ表示する（LIFF未設定の環境では出ない）。
//
// 流れ: LINEのIDトークンを取得 → サーバーで検証 → ワンタイムトークンを受け取り
//   → verifyOtp でセッション確立。パスワードも確認メールも使わない。
//
// LINEアプリの外（ブラウザ）から開いた場合は、先にLINE側の認証画面へ送られる。
// 戻ってきたときにボタンを押し直さなくて済むよう、印をつけておいて自動で続きを実行する。

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useLiff } from '@/components/LiffProvider'
import { toUserMessage } from '@/lib/errorMessage'

// LINEの認証へ送り出したことを覚えておくための印（タブを閉じれば消える）
const PENDING_KEY = 'campkit.line-login-pending'

function markPending() {
  try {
    sessionStorage.setItem(PENDING_KEY, '1')
  } catch {
    // プライベートモード等で使えなくても、ボタンを押し直せば進めるので無視する
  }
}

function takePending(): boolean {
  try {
    const pending = sessionStorage.getItem(PENDING_KEY) === '1'
    if (pending) sessionStorage.removeItem(PENDING_KEY)
    return pending
  } catch {
    return false
  }
}

export default function LineLoginButton() {
  const router = useRouter()
  const { ready } = useLiff()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // canRedirect: LINEの認証画面へ送り出してよいか。
  //   ボタン押下なら true。認証から戻った直後の自動実行では false にして、
  //   ログインできていない場合に何度もリダイレクトが繰り返されるのを防ぐ。
  const signInWithLine = useCallback(
    async (canRedirect: boolean) => {
      try {
        // SDKの読み込みを待ってから状態を更新する。
        // 先に setState すると、エフェクトから呼ばれたときに同期的な更新になり、
        // 不要な再レンダリングの連鎖を招くため。
        const liff = (await import('@line/liff')).default
        setError(null)
        setLoading(true)

        const idToken = liff.isLoggedIn() ? liff.getIDToken() : null

        if (!idToken) {
          if (!canRedirect) {
            setError('LINEのログインが完了しませんでした。もう一度お試しください。')
            setLoading(false)
            return
          }
          // 戻り先を今のページにして、戻ったら自動で続きを実行する
          markPending()
          liff.login({ redirectUri: window.location.href })
          return
        }

        const response = await fetch('/api/auth/line', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        })
        const result = await response.json()

        if (!response.ok || !result.tokenHash) {
          setError(result.error ?? 'LINEログインに失敗しました')
          setLoading(false)
          return
        }

        const supabase = createClient()
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: result.tokenHash,
          type: 'magiclink',
        })

        if (verifyError) {
          setError(toUserMessage(verifyError, 'ログイン処理できませんでした。'))
          setLoading(false)
          return
        }

        router.push('/home')
        router.refresh()
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'LINEログインに失敗しました')
        setLoading(false)
      }
    },
    [router]
  )

  // LINEの認証から戻ってきたときだけ、自動で続きを実行する。
  // SDKの読み込み完了（外部システムからのコールバック）を待って呼び出すことで、
  // エフェクト内での同期的な状態更新を避けている。
  useEffect(() => {
    if (!ready) return
    if (!takePending()) return

    let cancelled = false
    import('@line/liff').then(() => {
      if (!cancelled) signInWithLine(false)
    })

    return () => {
      cancelled = true
    }
  }, [ready, signInWithLine])

  // LIFFが使えない環境（LIFF ID未設定・初期化失敗）では何も出さない
  if (!ready) return null

  return (
    <div className="mt-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="h-px flex-1 bg-gray-200" />
        <span className="text-xs text-gray-500">または</span>
        <span className="h-px flex-1 bg-gray-200" />
      </div>

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      <button
        type="button"
        onClick={() => signInWithLine(true)}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#06C755] py-3 text-sm font-bold text-white transition-ui hover:bg-[#05b34c] active:scale-[0.99] disabled:opacity-50"
      >
        <span aria-hidden className="text-base leading-none">💬</span>
        {loading ? 'LINEでログインしています...' : 'LINEでログイン'}
      </button>

      <p className="mt-2 text-center text-xs text-gray-500">
        確認メールのやり取りなしでログインできます
      </p>
    </div>
  )
}
