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
import {
  formatCapacity,
  formatDeadline,
  getDeadlineStatus,
  getPlanPhase,
  isRecruitmentClosed,
  type RecruitmentInfo,
} from '@/lib/recruitmentStatus'

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
  recruitmentByPlan: Record<string, RecruitmentInfo>
  participantCounts: Record<string, number>
  currentUserId: string
}

type PlanTab = 'recruiting' | 'in_progress' | 'past' | 'mine'

type SortKey = 'deadline_asc' | 'created_desc' | 'start_asc' | 'created_asc'

const sortOptions: { value: SortKey; label: string }[] = [
  { value: 'deadline_asc', label: '締切が近い順' },
  { value: 'created_desc', label: '作成が新しい順' },
  { value: 'start_asc', label: '開始日が近い順' },
  { value: 'created_asc', label: '作成が古い順' },
]

export default function DashboardClient({
  group,
  members,
  plans,
  recruitmentByPlan,
  participantCounts,
  currentUserId,
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const toast = useToast()
  const isLeader =
    group.created_by === currentUserId ||
    members.find((member) => member.user_id === currentUserId)?.position === '部長'
  const [activeTab, setActiveTab] = useState<PlanTab>('recruiting')
  const [sortKey, setSortKey] = useState<SortKey>('created_desc')
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
  // グループの名前・画像の編集（メンバーなら誰でも）
  const [showEditModal, setShowEditModal] = useState(false)
  const [editName, setEditName] = useState(group.name)
  const [editImageUrl, setEditImageUrl] = useState(group.image_url)
  const [editSaving, setEditSaving] = useState(false)
  const [editUploading, setEditUploading] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const uploadGroupImage = async (file: File) => {
    setEditError(null)
    setEditUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${group.id}-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('group-images').upload(path, file, {
      upsert: true,
    })
    if (error) {
      setEditError('画像のアップロードに失敗しました: ' + error.message)
      setEditUploading(false)
      return
    }
    const { data } = supabase.storage.from('group-images').getPublicUrl(path)
    setEditImageUrl(data.publicUrl)
    setEditUploading(false)
  }

  const saveGroup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setEditError(null)
    if (editName.trim() === '') {
      setEditError('グループ名を入力してください')
      return
    }
    setEditSaving(true)
    const { error } = await supabase
      .from('groups')
      .update({ name: editName.trim(), image_url: editImageUrl })
      .eq('id', group.id)

    setEditSaving(false)
    if (error) {
      setEditError('保存に失敗しました: ' + error.message)
      return
    }
    setShowEditModal(false)
    toast('グループ情報を更新しました')
    router.refresh()
  }
  // 表示フェーズを計画ごとに求める
  // （締め切られたら「実施」、実施日を過ぎたら「過去」に自動で移る）
  const phaseOf = (plan: Plan) =>
    getPlanPhase({
      status: plan.status,
      recruitmentClosed: isRecruitmentClosed(
        recruitmentByPlan[plan.id],
        participantCounts[plan.id] ?? 0
      ),
      startDate: plan.start_date,
      endDate: plan.end_date,
    })

  // タブ: 募集中／実施／過去／自分の計画（自分が作成した全ての計画）
  const filteredPlans =
    activeTab === 'mine'
      ? plans.filter((plan) => plan.creator_id === currentUserId)
      : plans.filter((plan) => phaseOf(plan) === activeTab)

  const visiblePlans = [...filteredPlans].sort((a, b) => {
    const last = '9999-12-31'
    switch (sortKey) {
      case 'deadline_asc':
        return (recruitmentByPlan[a.id]?.deadline ?? last).localeCompare(
          recruitmentByPlan[b.id]?.deadline ?? last
        )
      case 'start_asc':
        return (a.start_date ?? last).localeCompare(b.start_date ?? last)
      case 'created_asc':
        return (a.created_at ?? '').localeCompare(b.created_at ?? '')
      case 'created_desc':
      default:
        return (b.created_at ?? '').localeCompare(a.created_at ?? '')
    }
  })

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
            <div className="flex flex-shrink-0 items-center gap-2">
              <button
                onClick={() => {
                  setEditName(group.name)
                  setEditImageUrl(group.image_url)
                  setEditError(null)
                  setShowEditModal(true)
                }}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:border-green-400 hover:text-green-700"
              >
                ✏️ 編集
              </button>
              <button
                onClick={handleLeave}
                disabled={leaving}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-500 transition hover:border-red-400 hover:text-red-700 disabled:opacity-50"
              >
                {leaving ? '処理中...' : '脱退'}
              </button>
            </div>
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
              label="募集中"
              active={activeTab === 'recruiting'}
              onClick={() => setActiveTab('recruiting')}
            />
            <PlanTabButton
              label="実施"
              active={activeTab === 'in_progress'}
              onClick={() => setActiveTab('in_progress')}
            />
            <PlanTabButton
              label="過去"
              active={activeTab === 'past'}
              onClick={() => setActiveTab('past')}
            />
            <PlanTabButton
              label="自分の計画"
              active={activeTab === 'mine'}
              onClick={() => setActiveTab('mine')}
            />
          </div>

          {/* 並び替え */}
          <div className="flex items-center justify-end gap-2 border-b border-gray-100 px-4 py-2">
            <label htmlFor="plan-sort" className="text-xs text-gray-400">
              並び替え
            </label>
            <select
              id="plan-sort"
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value as SortKey)}
              className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {visiblePlans.length === 0 ? (
            <EmptyState
              bare
              icon={activeTab === 'past' ? '📁' : activeTab === 'in_progress' ? '🏕️' : '🗒️'}
              title={
                activeTab === 'mine'
                  ? 'まだ計画を作成していません'
                  : activeTab === 'recruiting'
                    ? '募集中の計画はありません'
                    : activeTab === 'in_progress'
                      ? '実施フェーズの計画はありません'
                      : '過去の計画はありません'
              }
              description={
                activeTab === 'past'
                  ? '終了した計画がここに表示されます。'
                  : activeTab === 'in_progress'
                    ? '募集が締め切られた計画（締切を過ぎた・定員に達した）がここに移ります。'
                    : '「＋ 計画を作成」から新しい計画を作りましょう。'
              }
              action={
                activeTab !== 'past' && activeTab !== 'in_progress' ? (
                  <Link href={`/groups/${group.id}/plans/new`} className="btn-primary">
                    ＋ 計画を作成
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <div className="divide-y divide-gray-100">
              {visiblePlans.map((plan) => {
                const recruitment = recruitmentByPlan[plan.id]
                const deadlineStatus = getDeadlineStatus(recruitment?.deadline ?? null)
                const phase = phaseOf(plan)
                const showRecruitmentInfo =
                  plan.status === 'recruiting' && recruitment != null

                return (
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

                        {/* 締切状況・定員状況 */}
                        {showRecruitmentInfo && (
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {recruitment.is_closed ? (
                              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">
                                締め切り済み
                              </span>
                            ) : (
                              deadlineStatus && (
                                <span
                                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${deadlineStatus.className}`}
                                >
                                  {deadlineStatus.text}
                                </span>
                              )
                            )}
                            {recruitment.deadline && (
                              <span className="text-xs text-gray-500">
                                締切 {formatDeadline(recruitment.deadline)}
                              </span>
                            )}
                            <span className="text-xs text-gray-500">
                              ・
                              {formatCapacity(
                                participantCounts[plan.id] ?? 0,
                                recruitment.capacity
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-shrink-0 items-center gap-1.5">
                        {plan.creator_id === currentUserId && (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                            起案者
                          </span>
                        )}
                        <StatusBadge status={phase} />
                      </div>
                    </div>
                  </Link>
                )
              })}
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

      {/* グループの名前・画像の編集モーダル（メンバーなら誰でも） */}
      {showEditModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowEditModal(false)}
          role="dialog"
          aria-modal="true"
          aria-label="グループを編集"
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-base font-bold text-gray-800">グループを編集</h2>

            {editError && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{editError}</p>
            )}

            <form onSubmit={saveGroup} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">グループ名</label>
                <input
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="アウトドアサークル"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">グループ画像</label>
                <div className="flex items-center gap-3">
                  <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-100">
                    {editImageUrl ? (
                      <Image
                        src={editImageUrl}
                        alt=""
                        width={64}
                        height={64}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-2xl text-gray-300">⛺</span>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={editUploading}
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (file) uploadGroupImage(file)
                    }}
                    className="min-w-0 flex-1 text-xs text-gray-500 file:mr-2 file:rounded-lg file:border-0 file:bg-green-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-green-700"
                  />
                </div>
                {editUploading && (
                  <p className="mt-1 text-xs text-gray-400">アップロード中...</p>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={editSaving || editUploading}
                  className="btn-primary flex-1"
                >
                  {editSaving ? '保存中...' : '保存する'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-200"
                >
                  キャンセル
                </button>
              </div>
            </form>
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

