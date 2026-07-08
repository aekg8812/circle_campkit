'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import QRCode from 'qrcode'
import { createClient } from '@/lib/supabase/client'
import { StatusBadge } from '@/components/StatusBadge'
import { EmptyState } from '@/components/EmptyState'
import { useToast } from '@/components/Toast'
import PasswordInput from '@/components/PasswordInput'

type Profile = {
  name: string
  avatar_url: string | null
  grade: number | null
}

type Member = {
  id: string
  position: string
  user_id: string
  profiles: Profile | null
}

type Group = {
  id: string
  name: string
  image_url: string | null
  created_by: string | null
}

type Plan = {
  id: string
  title: string
  category: string | null
  status: 'draft' | 'recruiting' | 'past' | string | null
  start_date: string | null
  end_date: string | null
  area: string | null
  creator_id: string | null
  created_at: string | null
}

type Props = {
  group: Group
  members: Member[]
  plans: Plan[]
  currentUserId: string
}

type PlanTab = 'draft' | 'recruiting' | 'past'

export default function DashboardClient({ group, members, plans, currentUserId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const toast = useToast()
  const isLeader =
    group.created_by === currentUserId ||
    members.find((member) => member.user_id === currentUserId)?.position === '部長'
  const [activeTab, setActiveTab] = useState<PlanTab>('draft')
  const [leaving, setLeaving] = useState(false)
  const [leaveError, setLeaveError] = useState<string | null>(null)
  const [inviteCopied, setInviteCopied] = useState(false)
  const [inviteUrl, setInviteUrl] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [showQr, setShowQr] = useState(false)
  const [showPwModal, setShowPwModal] = useState(false)
  const [pwForm, setPwForm] = useState({ password: '', confirm: '' })
  const [pwSaving, setPwSaving] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)
  const visiblePlans = plans.filter((plan) => plan.status === activeTab)

  // 起案者名の逆引き（user_id → 氏名）と、メンバーごとの起案した計画一覧
  const nameByUserId = new Map(
    members.map((member) => [member.user_id, member.profiles?.name ?? '名前未設定'])
  )
  const plansByCreator = new Map<string, Plan[]>()
  for (const plan of plans) {
    if (!plan.creator_id) continue
    const list = plansByCreator.get(plan.creator_id) ?? []
    list.push(plan)
    plansByCreator.set(plan.creator_id, list)
  }

  const changePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPwError(null)
    if (pwForm.password.length < 1) {
      setPwError('新しいパスワードを入力してください')
      return
    }
    if (pwForm.password !== pwForm.confirm) {
      setPwError('パスワードが一致しません')
      return
    }
    setPwSaving(true)
    const { error } = await supabase.rpc('change_group_password', {
      p_group_id: group.id,
      p_new_password: pwForm.password,
    })
    if (error) {
      setPwError(error.message)
      setPwSaving(false)
      return
    }
    setPwSaving(false)
    setShowPwModal(false)
    setPwForm({ password: '', confirm: '' })
    toast('参加パスワードを変更しました')
  }

  useEffect(() => {
    setInviteUrl(`${window.location.origin}/groups?join=${group.id}`)
  }, [group.id])

  const openQr = async () => {
    if (!inviteUrl) return
    // 招待URLからQRコードの画像（データURL）を生成してモーダルで表示
    const dataUrl = await QRCode.toDataURL(inviteUrl, { width: 480, margin: 2 })
    setQrDataUrl(dataUrl)
    setShowQr(true)
  }

  const copyInviteUrl = async () => {
    if (!inviteUrl) return

    await navigator.clipboard.writeText(inviteUrl)
    setInviteCopied(true)
    window.setTimeout(() => setInviteCopied(false), 2000)
  }

  const lineShareUrl = () => {
    const text = `CampKitで「${group.name}」に参加してください。\n${inviteUrl}\n参加パスワードは別途共有します。`
    return `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent(text)}`
  }

  const handleLeave = async () => {
    if (!confirm(`「${group.name}」から脱退しますか？`)) return
    setLeaving(true)
    setLeaveError(null)
    const { error } = await supabase.rpc('leave_group', {
      p_group_id: group.id,
    })
    if (error) {
      setLeaveError(error.message)
      setLeaving(false)
      return
    }
    router.push('/groups')
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* グループヘッダー */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="w-full h-40 bg-gray-100 flex items-center justify-center overflow-hidden">
          {group.image_url ? (
            <Image
              src={group.image_url}
              alt={group.name}
              width={800}
              height={160}
              className="object-cover w-full h-full"
            />
          ) : (
            <span className="text-6xl text-gray-200">&#x26FA;</span>
          )}
        </div>
        <div className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <h1 className="min-w-0 text-xl font-bold text-gray-800">{group.name}</h1>
            <button
              onClick={handleLeave}
              disabled={leaving}
              className="flex-shrink-0 rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-500 transition hover:border-red-400 hover:text-red-700 disabled:opacity-50"
            >
              {leaving ? '処理中...' : '脱退'}
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={copyInviteUrl}
              className="rounded-lg border border-green-200 px-3 py-2 text-sm font-semibold text-green-700 transition hover:border-green-400 hover:bg-green-50"
            >
              {inviteCopied ? 'コピーしました' : '招待リンクをコピー'}
            </button>
            <button
              type="button"
              onClick={openQr}
              className="rounded-lg border border-green-200 px-3 py-2 text-sm font-semibold text-green-700 transition hover:border-green-400 hover:bg-green-50"
            >
              QRコードで招待
            </button>
            <a
              href={inviteUrl ? lineShareUrl() : '#'}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => {
                if (!inviteUrl) event.preventDefault()
              }}
              aria-disabled={!inviteUrl}
              className="rounded-lg bg-green-600 px-3 py-2 text-center text-sm font-semibold text-white transition hover:bg-green-700 aria-disabled:opacity-50"
            >
              LINEで招待
            </a>
          </div>

          {isLeader && (
            <button
              type="button"
              onClick={() => {
                setPwForm({ password: '', confirm: '' })
                setPwError(null)
                setShowPwModal(true)
              }}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 transition hover:border-green-400 hover:text-green-700"
            >
              🔑 参加パスワードを変更
            </button>
          )}
        </div>
        {leaveError && (
          <p className="text-sm text-red-600 bg-red-50 px-4 pb-3">{leaveError}</p>
        )}
      </div>

      {/* メンバー一覧 */}
      <section>
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
          メンバー（{members.length}人）
        </h2>
        <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-100">
          {members.map((m) => {
            const proposed = plansByCreator.get(m.user_id) ?? []
            return (
              <div key={m.id} className="flex items-start gap-3 px-4 py-3">
                <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-200">
                  {m.profiles?.avatar_url ? (
                    <Image
                      src={m.profiles.avatar_url}
                      alt={m.profiles.name}
                      width={36}
                      height={36}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-base text-gray-400">&#128100;</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-800">
                    {m.profiles?.name ?? '（名前未設定）'}
                    {m.user_id === currentUserId && (
                      <span className="ml-1 text-xs font-normal text-green-600">（あなた）</span>
                    )}
                  </p>
                  {m.profiles?.grade != null && (
                    <p className="text-xs text-gray-400">{m.profiles.grade}年生</p>
                  )}
                  {proposed.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      <span className="text-xs text-gray-400">起案:</span>
                      {proposed.map((plan) => (
                        <Link
                          key={plan.id}
                          href={`/groups/${group.id}/plans/${plan.id}`}
                          className="inline-flex max-w-[10rem] items-center gap-1 truncate rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 transition hover:bg-green-100"
                        >
                          {plan.title}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
                <span className="flex-shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                  {m.position}
                </span>
              </div>
            )
          })}
        </div>
      </section>

      {/* 計画一覧 */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">
            計画
          </h2>
          <Link
            href={`/groups/${group.id}/plans/new`}
            className="rounded-xl bg-green-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-green-700 active:scale-95"
          >
            ＋ 計画を作成
          </Link>
        </div>
        <div className="bg-white rounded-2xl shadow-sm">
          <div className="flex border-b border-gray-100">
            <PlanTabButton
              label="下書き"
              active={activeTab === 'draft'}
              onClick={() => setActiveTab('draft')}
            />
            <PlanTabButton
              label="募集中"
              active={activeTab === 'recruiting'}
              onClick={() => setActiveTab('recruiting')}
            />
            <PlanTabButton
              label="過去"
              active={activeTab === 'past'}
              onClick={() => setActiveTab('past')}
            />
          </div>

          {visiblePlans.length === 0 ? (
            <EmptyState
              bare
              icon={activeTab === 'past' ? '📁' : '🗒️'}
              title={
                activeTab === 'draft'
                  ? '下書きの計画はありません'
                  : activeTab === 'recruiting'
                    ? '募集中の計画はありません'
                    : '過去の計画はありません'
              }
              description={
                activeTab === 'past'
                  ? '終了した計画がここに表示されます。'
                  : '「＋ 計画を作成」から新しい計画を作りましょう。'
              }
              action={
                activeTab !== 'past' ? (
                  <Link href={`/groups/${group.id}/plans/new`} className="btn-primary">
                    ＋ 計画を作成
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <div className="divide-y divide-gray-100">
              {visiblePlans.map((plan) => (
                <Link
                  key={plan.id}
                  href={`/groups/${group.id}/plans/${plan.id}`}
                  className="block px-4 py-4 transition hover:bg-gray-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-800">
                        {plan.title}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {[plan.category, formatDateRange(plan.start_date, plan.end_date), plan.area]
                          .filter(Boolean)
                          .join(' ／ ') || '日程・場所未設定'}
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        起案者: {plan.creator_id ? (nameByUserId.get(plan.creator_id) ?? '不明') : '不明'}
                      </p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-1.5">
                      {plan.creator_id === currentUserId && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                          起案者
                        </span>
                      )}
                      <StatusBadge status={plan.status} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* QRコード招待モーダル */}
      {showQr && qrDataUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowQr(false)}
          role="dialog"
          aria-modal="true"
          aria-label="QRコードで招待"
        >
          <div
            className="w-full max-w-xs rounded-2xl bg-white p-6 text-center shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-base font-bold text-gray-800">QRコードで招待</h2>
            <p className="mt-1 text-xs text-gray-500">
              「{group.name}」への参加ページを開けます。読み取ってもらいましょう。
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrDataUrl}
              alt="グループ参加用のQRコード"
              className="mx-auto mt-4 h-56 w-56 rounded-xl border border-gray-100"
            />
            <p className="mt-3 text-xs text-gray-400">
              参加にはパスワードも必要です（別途共有してください）
            </p>
            <button
              type="button"
              onClick={() => setShowQr(false)}
              className="mt-4 w-full rounded-lg bg-gray-100 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-200"
            >
              閉じる
            </button>
          </div>
        </div>
      )}

      {/* 参加パスワード変更モーダル（部長のみ） */}
      {showPwModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowPwModal(false)}
          role="dialog"
          aria-modal="true"
          aria-label="参加パスワードを変更"
        >
          <div
            className="w-full max-w-xs rounded-2xl bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-base font-bold text-gray-800">参加パスワードを変更</h2>
            <p className="mt-1 text-xs text-gray-500">
              変更後は、新しいパスワードを参加希望者に共有してください。
            </p>

            {pwError && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{pwError}</p>
            )}

            <form onSubmit={changePassword} className="mt-4 space-y-3">
              <PasswordInput
                value={pwForm.password}
                onChange={(event) =>
                  setPwForm((current) => ({ ...current, password: event.target.value }))
                }
                placeholder="新しいパスワード"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                autoFocus
              />
              <PasswordInput
                value={pwForm.confirm}
                onChange={(event) =>
                  setPwForm((current) => ({ ...current, confirm: event.target.value }))
                }
                placeholder="新しいパスワード（確認）"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={pwSaving} className="btn-primary flex-1">
                  {pwSaving ? '変更中...' : '変更する'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPwModal(false)}
                  className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-200"
                >
                  キャンセル
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function PlanTabButton({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-3 text-sm font-semibold transition ${
        active
          ? 'border-b-2 border-green-600 text-green-700'
          : 'text-gray-400 hover:text-gray-600'
      }`}
    >
      {label}
    </button>
  )
}

function formatDateRange(startDate: string | null, endDate: string | null) {
  if (!startDate && !endDate) return ''
  if (startDate && endDate && startDate !== endDate) {
    return `${startDate} 〜 ${endDate}`
  }
  return startDate || endDate || ''
}

