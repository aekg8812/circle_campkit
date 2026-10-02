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
import Image from 'next/image'
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

// variant で見た目を変える。
//   hero   : ログイン画面の主役。区切り線なしで大きく出す
//   inline : 他の手段の「または」として、控えめに出す
type Props = {
  variant?: 'hero' | 'inline'
  /** ボタンの文字。新規登録画面では「LINEではじめる」などに変える */
  label?: string
  /** ボタンの下に出す補足。省略すると variant ごとの既定文が出る */
  note?: string
}

export default function LineLoginButton({ variant = 'inline', label, note }: Props) {
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
          // 戻り先を今のページにして、戻ったら自動で続きを実行する。
          //
          // LINEの外（PCやスマホのブラウザ）から押した場合、この戻り先は
          // LINEログインチャネルの「コールバックURL」に登録されている必要がある。
          // クエリ文字列や # が付いたまま渡すと登録した文字列と変わってしまうため、
          // 戻り先は必ず /login か /signup だけになるよう、後ろを落としてから渡す。
          markPending()
          liff.login({ redirectUri: window.location.origin + window.location.pathname })
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

  const isHero = variant === 'hero'

  return (
    <div className={isHero ? '' : 'mt-5'}>
      {!isHero && (
        <div className="mb-4 flex items-center gap-3">
          <span className="h-px flex-1 bg-gray-200" />
          <span className="text-xs text-gray-500">または</span>
          <span className="h-px flex-1 bg-gray-200" />
        </div>
      )}

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      <button
        type="button"
        onClick={() => signInWithLine(true)}
        disabled={loading}
        className={`flex w-full items-center justify-center gap-2 bg-[#06C755] font-bold text-white transition-ui hover:bg-[#05b34c] active:scale-[0.99] disabled:opacity-50 ${
          isHero ? 'rounded-xl py-4 text-base shadow-sm shadow-green-900/10' : 'rounded-lg py-3 text-sm'
        }`}
      >
        {/* LINEのロゴ。背景の角丸はボタンと同じ緑なので、吹き出しだけが浮いて見える */}
        <Image
          src="/line-logo.png"
          alt=""
          aria-hidden
          width={isHero ? 26 : 20}
          height={isHero ? 26 : 20}
          className="flex-shrink-0"
          priority={isHero}
        />
        {loading ? 'LINEでログインしています...' : (label ?? 'LINEでログイン')}
      </button>

      <p className={`mt-2 text-center text-xs ${isHero ? 'leading-5 text-gray-600' : 'text-gray-500'}`}>
        {note ??
          (isHero
            ? 'はじめての方も、このボタンだけで登録できます（確認メールは不要）'
            : '確認メールのやり取りなしでログインできます')}
      </p>
    </div>
  )
}
