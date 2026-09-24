'use client'

// LINEでログインするボタン。
// LIFFの初期化が成功しているときだけ表示する（通常のブラウザでLIFF未設定なら出ない）。
// 流れ: LINEのIDトークンを取得 → サーバーで検証 → ワンタイムトークンを受け取り
//   → verifyOtp でセッション確立。パスワードも確認メールも使わない。

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useLiff } from '@/components/LiffProvider'

export default function LineLoginButton() {
  const router = useRouter()
  const { ready } = useLiff()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // LIFFが使えない環境（LIFF ID未設定・初期化失敗）では何も出さない
  if (!ready) return null

  const signInWithLine = async () => {
    setError(null)
    setLoading(true)

    try {
      const liff = (await import('@line/liff')).default

      // LINEにログインしていなければ、まずLINE側のログインへ送る
      // （戻ってきたら、もう一度このボタンを押してもらう）
      if (!liff.isLoggedIn()) {
        liff.login()
        return
      }

      const idToken = liff.getIDToken()
      if (!idToken) {
        // トークンが取れない場合はセッションが古いので、ログインし直してもらう
        liff.login()
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
        setError('ログイン処理に失敗しました: ' + verifyError.message)
        setLoading(false)
        return
      }

      router.push('/home')
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'LINEログインに失敗しました')
      setLoading(false)
    }
  }

  return (
    <div className="mt-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="h-px flex-1 bg-gray-200" />
        <span className="text-xs text-gray-400">または</span>
        <span className="h-px flex-1 bg-gray-200" />
      </div>

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      <button
        type="button"
        onClick={signInWithLine}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#06C755] py-3 text-sm font-bold text-white transition hover:bg-[#05b34c] active:scale-[0.99] disabled:opacity-50"
      >
        <span aria-hidden className="text-base leading-none">💬</span>
        {loading ? '処理中...' : 'LINEでログイン'}
      </button>

      <p className="mt-2 text-center text-xs text-gray-400">
        確認メールのやり取りなしでログインできます
      </p>
    </div>
  )
}
