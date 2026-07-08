'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { createGoogleMapsSearchUrl } from '@/lib/maps'
import { getMissingDocumentFields, type ProfileLike } from '@/lib/profileCompleteness'
import { useToast } from '@/components/Toast'
import { StatusBadge } from '@/components/StatusBadge'

type Group = {
  id: string
  name: string
}

type PlanStatus = 'draft' | 'recruiting' | 'past'

type Plan = {
  id: string
  group_id: string
  creator_id: string | null
  title: string
  category: string | null
  status: PlanStatus | string | null
  start_date: string | null
  end_date: string | null
  area: string | null
  description: string | null
  default_transport: string | null
  created_at: string | null
  updated_at: string | null
}

type ScheduleItem = {
  id: string
  day: string | null
  time: string | null
  sort_order: number | null
  time_label: string | null
  location_name: string | null
  location_type: string | null
  map_query: string | null
  note: string | null
  transport: string | null
}

type Recruitment = {
  id: string
  type: string | null
  capacity: number | null
  deadline: string | null
  is_closed: boolean | null
}

type Participant = {
  id: string
  user_id: string
  joined_at: string | null
  profiles: {
    name: string
    avatar_url: string | null
    grade: number | null
  } | null
  position: string
}

type Review = {
  id: string
  user_id: string
  body: string | null
  cost_per_person: number | null
  created_at: string | null
  profiles: {
    name: string
    avatar_url: string | null
  } | null
}

type Preparation = {
  id: string
  user_id: string
  type: string | null
  body: string | null
  created_at: string | null
  profiles: {
    name: string
    avatar_url: string | null
  } | null
}

type Props = {
  group: Group
  plan: Plan
  scheduleItems: ScheduleItem[]
  recruitment: Recruitment | null
  participants: Participant[]
  reviews: Review[]
  preparations: Preparation[]
  currentUserId: string
  currentUserProfile: ProfileLike | null
}

const statusOptions: { value: PlanStatus; label: string }[] = [
  { value: 'draft', label: '下書き' },
  { value: 'recruiting', label: '募集中' },
  { value: 'past', label: '過去' },
]

const scheduleSchema = z.object({
  day: z.string().optional(),
  time: z.string().optional(),
  time_label: z.string().optional(),
  location_name: z.string().min(1, '場所名を入力してください'),
  note: z.string().optional(),
  transport: z.string().optional(),
})

const recruitmentSchema = z.object({
  type: z.enum(['first_come', 'deadline']),
  capacity: z.string().optional(),
  deadline: z.string().optional(),
  is_closed: z.boolean(),
})

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500'

const timeOptions = createHalfHourTimeOptions()
const scheduleLabels = ['集合', '出発', '到着', '解散', '休憩', '買い出し']
const transportOptions = ['未定', '車', '公共交通', '徒歩', 'その他']

export default function PlanDetailClient({
  group,
  plan,
  scheduleItems,
  recruitment,
  participants,
  reviews,
  preparations,
  currentUserId,
  currentUserProfile,
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const toast = useToast()
  const isCreator = plan.creator_id === currentUserId
  const missingProfileFields = getMissingDocumentFields(currentUserProfile)
  const [updatingStatus, setUpdatingStatus] = useState<PlanStatus | null>(null)
  const [updatingTransport, setUpdatingTransport] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [scheduleForm, setScheduleForm] = useState({
    day: plan.start_date ?? '',
    time: '',
    time_label: '',
    location_name: '',
    note: '',
    transport: '',
  })
  const [recruitmentForm, setRecruitmentForm] = useState({
    type: recruitment?.type === 'deadline' ? 'deadline' : 'first_come',
    capacity: recruitment?.capacity != null ? String(recruitment.capacity) : '',
    deadline: toDateTimeLocalValue(recruitment?.deadline ?? null),
    is_closed: recruitment?.is_closed ?? false,
  })
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [prepInput, setPrepInput] = useState('')
  const myReview = reviews.find((review) => review.user_id === currentUserId)
  const [reviewForm, setReviewForm] = useState({
    body: myReview?.body ?? '',
    cost: myReview?.cost_per_person != null ? String(myReview.cost_per_person) : '',
  })
  const myParticipant = participants.find((participant) => participant.user_id === currentUserId)
  const capacityReached =
    recruitment?.capacity != null && participants.length >= recruitment.capacity
  const deadlinePassed =
    recruitment?.type === 'deadline' &&
    recruitment.deadline != null &&
    new Date(recruitment.deadline).getTime() < Date.now()
  const canJoin =
    plan.status === 'recruiting' &&
    !recruitment?.is_closed &&
    !capacityReached &&
    !deadlinePassed &&
    !myParticipant

  const refreshAfterMutation = () => {
    router.refresh()
  }

  const updateStatus = async (status: PlanStatus) => {
    setServerError(null)
    setUpdatingStatus(status)

    const { error } = await supabase
      .from('plans')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', plan.id)

    if (error) {
      setServerError('状態の更新に失敗しました: ' + error.message)
      setUpdatingStatus(null)
      return
    }

    refreshAfterMutation()
    setUpdatingStatus(null)
  }

  const updateDefaultTransport = async (value: string) => {
    setServerError(null)
    setUpdatingTransport(true)

    const { error } = await supabase
      .from('plans')
      .update({
        default_transport: value || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', plan.id)

    if (error) {
      setServerError('交通手段の更新に失敗しました: ' + error.message)
      setUpdatingTransport(false)
      return
    }

    refreshAfterMutation()
    setUpdatingTransport(false)
  }

  const addScheduleItem = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setServerError(null)
    setSubmitting('schedule')

    const parsed = scheduleSchema.safeParse(scheduleForm)
    if (!parsed.success) {
      setServerError(parsed.error.issues[0]?.message ?? '行程を確認してください')
      setSubmitting(null)
      return
    }

    const { data } = parsed
    const availableTimeOptions = getAvailableScheduleTimeOptions(scheduleItems, data.day || '')
    if (data.time && !availableTimeOptions.includes(data.time)) {
      setServerError('直前の行程より後の時刻を選択してください')
      setSubmitting(null)
      return
    }

    const nextSortOrder =
      Math.max(...scheduleItems.map((item) => item.sort_order ?? 0), -1) + 1

    const { error } = await supabase.from('schedule_items').insert({
      plan_id: plan.id,
      day: data.day || null,
      time: data.time || null,
      sort_order: nextSortOrder,
      time_label: data.time_label || null,
      location_name: data.location_name,
      location_type: null,
      map_query: data.location_name,
      note: data.note || null,
      transport: data.transport || null,
    })

    if (error) {
      setServerError('行程の追加に失敗しました: ' + error.message)
      setSubmitting(null)
      return
    }

    setScheduleForm((current) => ({
      ...current,
      time: '',
      time_label: '',
      location_name: '',
      note: '',
      transport: '',
    }))
    refreshAfterMutation()
    setSubmitting(null)
  }

  const saveRecruitment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setServerError(null)
    setSubmitting('recruitment')

    const parsed = recruitmentSchema.safeParse(recruitmentForm)
    if (!parsed.success) {
      setServerError(parsed.error.issues[0]?.message ?? '募集設定を確認してください')
      setSubmitting(null)
      return
    }

    const capacity =
      parsed.data.capacity && parsed.data.capacity.trim() !== ''
        ? Number(parsed.data.capacity)
        : null

    if (capacity != null && (!Number.isInteger(capacity) || capacity < 1)) {
      setServerError('定員は1以上の整数で入力してください')
      setSubmitting(null)
      return
    }

    if (parsed.data.type === 'first_come' && capacity == null) {
      setServerError('先着順では定員を入力してください')
      setSubmitting(null)
      return
    }

    if (parsed.data.type === 'deadline' && !parsed.data.deadline) {
      setServerError('時間締切では締切日時を入力してください')
      setSubmitting(null)
      return
    }

    const { error } = await supabase
      .from('recruitments')
      .upsert(
        {
          plan_id: plan.id,
          type: parsed.data.type,
          capacity: parsed.data.type === 'first_come' ? capacity : null,
          deadline: parsed.data.type === 'deadline' ? parsed.data.deadline : null,
          is_closed: parsed.data.is_closed,
        },
        { onConflict: 'plan_id' }
      )

    if (error) {
      setServerError('募集設定の保存に失敗しました: ' + error.message)
      setSubmitting(null)
      return
    }

    refreshAfterMutation()
    setSubmitting(null)
  }

  const joinPlan = async () => {
    // プロフィール未入力があれば、名簿が空欄になる旨を伝えてから参加させる
    if (missingProfileFields.length > 0) {
      const labels = missingProfileFields.map((field) => field.label).join('・')
      if (
        !confirm(
          `プロフィールの「${labels}」が未入力です。\nこのまま参加すると計画書の名簿でこれらが空欄になります。参加しますか？`
        )
      ) {
        return
      }
    }

    setServerError(null)
    setSubmitting('participant')

    const { error } = await supabase.from('participants').insert({
      plan_id: plan.id,
      user_id: currentUserId,
    })

    if (error) {
      setServerError('参加登録に失敗しました: ' + error.message)
      setSubmitting(null)
      return
    }

    refreshAfterMutation()
    setSubmitting(null)
  }

  const leavePlan = async () => {
    if (!myParticipant) return
    if (!confirm('この計画の参加をキャンセルしますか？')) return

    setServerError(null)
    setSubmitting('participant')

    const { error } = await supabase
      .from('participants')
      .delete()
      .eq('id', myParticipant.id)

    if (error) {
      setServerError('参加キャンセルに失敗しました: ' + error.message)
      setSubmitting(null)
      return
    }

    refreshAfterMutation()
    setSubmitting(null)
  }

  const saveReview = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setServerError(null)

    const trimmedBody = reviewForm.body.trim()
    const costText = reviewForm.cost.trim()
    const cost = costText === '' ? null : Number(costText)

    if (!trimmedBody && cost == null) {
      setServerError('感想または費用のどちらかを入力してください')
      return
    }
    if (cost != null && (!Number.isInteger(cost) || cost < 0)) {
      setServerError('費用は0以上の整数（円）で入力してください')
      return
    }

    setSubmitting('review')

    const { error } = await supabase.from('plan_reviews').upsert(
      {
        plan_id: plan.id,
        user_id: currentUserId,
        body: trimmedBody || null,
        cost_per_person: cost,
      },
      { onConflict: 'plan_id,user_id' }
    )

    if (error) {
      setServerError('レビューの保存に失敗しました: ' + error.message)
      setSubmitting(null)
      return
    }

    toast(myReview ? 'レビューを更新しました' : 'レビューを投稿しました')
    refreshAfterMutation()
    setSubmitting(null)
  }

  const deleteReview = async () => {
    if (!myReview) return
    if (!confirm('自分のレビューを削除しますか？')) return

    setServerError(null)
    setSubmitting('review')

    const { error } = await supabase.from('plan_reviews').delete().eq('id', myReview.id)

    if (error) {
      setServerError('レビューの削除に失敗しました: ' + error.message)
      setSubmitting(null)
      return
    }

    setReviewForm({ body: '', cost: '' })
    toast('レビューを削除しました')
    refreshAfterMutation()
    setSubmitting(null)
  }

  const duplicatePlan = async () => {
    setServerError(null)
    setSubmitting('duplicate')

    // 新しい計画を下書きで作成（日付は引き継がず、複製者が起案者になる）
    const { data: created, error } = await supabase
      .from('plans')
      .insert({
        group_id: plan.group_id,
        creator_id: currentUserId,
        title: `${plan.title}のコピー`,
        category: plan.category,
        status: 'draft',
        area: plan.area,
        description: plan.description,
        default_transport: plan.default_transport,
      })
      .select('id')
      .single()

    if (error || !created) {
      setServerError('複製に失敗しました: ' + (error?.message ?? ''))
      setSubmitting(null)
      return
    }

    // 行程表を引き継ぐ（日付は未設定にして、時刻・場所・メモ等の構成だけ再利用）
    if (scheduleItems.length > 0) {
      const { error: scheduleError } = await supabase.from('schedule_items').insert(
        scheduleItems.map((item) => ({
          plan_id: created.id,
          day: null,
          time: item.time,
          sort_order: item.sort_order,
          time_label: item.time_label,
          location_name: item.location_name,
          location_type: item.location_type,
          map_query: item.map_query,
          note: item.note,
          transport: item.transport,
        }))
      )
      if (scheduleError) {
        // 計画本体は作成済みなので、行程のみ失敗した旨を伝えて新計画へ進む
        toast('行程の一部を複製できませんでした', 'error')
      }
    }

    // 起案者を参加登録
    await supabase.from('participants').upsert({
      plan_id: created.id,
      user_id: currentUserId,
    })

    toast('計画を複製しました。日程を設定してください')
    router.push(`/groups/${group.id}/plans/${created.id}/edit`)
    router.refresh()
  }

  const addPreparation = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const body = prepInput.trim()
    if (!body) return

    setServerError(null)
    setSubmitting('preparation')

    const { error } = await supabase.from('preparations').insert({
      plan_id: plan.id,
      user_id: currentUserId,
      type: 'gear',
      body,
    })

    if (error) {
      setServerError('持ち物の追加に失敗しました: ' + error.message)
      setSubmitting(null)
      return
    }

    setPrepInput('')
    refreshAfterMutation()
    setSubmitting(null)
  }

  const deletePreparation = async (id: string) => {
    setServerError(null)
    const { error } = await supabase.from('preparations').delete().eq('id', id)
    if (error) {
      setServerError('削除に失敗しました: ' + error.message)
      return
    }
    refreshAfterMutation()
  }

  const deletePlan = async () => {
    if (
      !confirm(
        'この計画を削除しますか？\n行程・募集・参加者・計画書もすべて削除され、元に戻せません。'
      )
    ) {
      return
    }

    setServerError(null)
    setSubmitting('delete-plan')

    const { error } = await supabase.from('plans').delete().eq('id', plan.id)

    if (error) {
      setServerError('計画の削除に失敗しました: ' + error.message)
      setSubmitting(null)
      return
    }

    router.push(`/groups/${group.id}`)
    router.refresh()
  }

  const deleteRow = async (
    table: 'schedule_items',
    id: string
  ) => {
    if (!confirm('削除しますか？')) return
    setServerError(null)

    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) {
      setServerError('削除に失敗しました: ' + error.message)
      return
    }
    refreshAfterMutation()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href={`/groups/${group.id}`} className="text-sm text-gray-500 hover:text-gray-700">
            ← 戻る
          </Link>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              {group.name}
            </p>
            <h1 className="text-xl font-bold text-gray-800">{plan.title}</h1>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={duplicatePlan}
            disabled={submitting === 'duplicate'}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:border-green-400 hover:text-green-700 disabled:opacity-50"
          >
            {submitting === 'duplicate' ? '複製中...' : '📋 複製'}
          </button>
          {isCreator && (
            <Link
              href={`/groups/${group.id}/plans/${plan.id}/edit`}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:border-green-400 hover:text-green-700"
            >
              ✏️ 編集
            </Link>
          )}
          <Link
            href={`/groups/${group.id}/plans/${plan.id}/document`}
            className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm font-semibold text-green-700 transition hover:bg-green-100"
          >
            📄 計画書
          </Link>
        </div>
      </div>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <StatusBadge status={plan.status} className="px-3 py-1" />
            {isCreator && (
              <span className="ml-2 inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-500">
                起案者
              </span>
            )}
          </div>
          {isCreator && (
            <div className="flex flex-wrap gap-2">
              {statusOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => updateStatus(option.value)}
                  disabled={updatingStatus != null || plan.status === option.value}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:border-green-400 hover:text-green-700 disabled:opacity-40"
                >
                  {updatingStatus === option.value ? '更新中...' : option.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {serverError && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {serverError}
          </p>
        )}

        <dl className="grid gap-4 sm:grid-cols-2">
          <DetailItem label="種別" value={plan.category} />
          <DetailItem label="日程" value={formatDateRange(plan.start_date, plan.end_date)} />
          <DetailItem label="場所エリア" value={plan.area} />
          <DetailItem label="基本交通手段" value={plan.default_transport || '未定'} />
          <DetailItem label="作成日" value={formatDate(plan.created_at)} />
        </dl>

        {isCreator && (
          <div className="mt-6">
            <label className="mb-2 block text-sm font-bold text-gray-700">
              全体の交通手段
            </label>
            <select
              value={plan.default_transport ?? ''}
              onChange={(event) => updateDefaultTransport(event.target.value)}
              disabled={updatingTransport}
              className={inputClass}
            >
              <option value="">未定</option>
              {transportOptions
                .filter((option) => option !== '未定')
                .map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
            </select>
          </div>
        )}

        <div className="mt-6">
          <h2 className="mb-2 text-sm font-bold text-gray-700">説明</h2>
          <p className="whitespace-pre-wrap rounded-lg bg-gray-50 px-4 py-3 text-sm leading-6 text-gray-700">
            {plan.description || '説明はまだありません'}
          </p>
        </div>
      </section>

      {plan.status === 'past' && (
        <ReviewSection
          reviews={reviews}
          currentUserId={currentUserId}
          canWrite={Boolean(myParticipant)}
          hasMyReview={Boolean(myReview)}
          form={reviewForm}
          setForm={setReviewForm}
          submitting={submitting === 'review'}
          onSave={saveReview}
          onDelete={deleteReview}
        />
      )}

      <RecruitmentSection
        recruitment={recruitment}
        participants={participants}
        isCreator={isCreator}
        isParticipating={Boolean(myParticipant)}
        isCreatorParticipant={Boolean(myParticipant && isCreator)}
        canJoin={canJoin}
        capacityReached={capacityReached}
        deadlinePassed={deadlinePassed}
        form={recruitmentForm}
        setForm={setRecruitmentForm}
        submitting={submitting}
        onSave={saveRecruitment}
        onJoin={joinPlan}
        onLeave={leavePlan}
        missingProfileFields={missingProfileFields}
      />

      <ScheduleSection
        items={scheduleItems}
        defaultTransport={plan.default_transport}
        isCreator={isCreator}
        form={scheduleForm}
        setForm={setScheduleForm}
        submitting={submitting === 'schedule'}
        onSubmit={addScheduleItem}
        onDelete={(id) => deleteRow('schedule_items', id)}
      />

      {plan.status !== 'past' && (
        <PreparationSection
          preparations={preparations}
          currentUserId={currentUserId}
          input={prepInput}
          setInput={setPrepInput}
          submitting={submitting === 'preparation'}
          onAdd={addPreparation}
          onDelete={deletePreparation}
        />
      )}

      {isCreator && (
        <section className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-gray-700">計画の削除</h2>
          <p className="mt-1 text-xs text-gray-500">
            この計画に関する行程・募集・参加者・計画書がすべて削除されます。元に戻せません。
          </p>
          <button
            type="button"
            onClick={deletePlan}
            disabled={submitting === 'delete-plan'}
            className="mt-3 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:border-red-400 hover:bg-red-50 disabled:opacity-50"
          >
            {submitting === 'delete-plan' ? '削除中...' : 'この計画を削除'}
          </button>
        </section>
      )}
    </div>
  )
}

function RecruitmentSection({
  recruitment,
  participants,
  isCreator,
  isParticipating,
  isCreatorParticipant,
  canJoin,
  capacityReached,
  deadlinePassed,
  form,
  setForm,
  submitting,
  onSave,
  onJoin,
  onLeave,
  missingProfileFields,
}: {
  recruitment: Recruitment | null
  participants: Participant[]
  isCreator: boolean
  isParticipating: boolean
  isCreatorParticipant: boolean
  canJoin: boolean
  capacityReached: boolean
  deadlinePassed: boolean
  form: { type: string; capacity: string; deadline: string; is_closed: boolean }
  setForm: React.Dispatch<React.SetStateAction<{
    type: string
    capacity: string
    deadline: string
    is_closed: boolean
  }>>
  submitting: string | null
  onSave: (event: React.FormEvent<HTMLFormElement>) => void
  onJoin: () => void
  onLeave: () => void
  missingProfileFields: { label: string }[]
}) {
  const participantCountText =
    recruitment?.capacity != null
      ? `${participants.length} / ${recruitment.capacity}人`
      : `${participants.length}人`

  return (
    <section className="rounded-2xl bg-white shadow-sm">
      <SectionHeader title="募集・参加" />
      <div className="space-y-5 p-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <DetailItem label="募集方式" value={recruitmentTypeLabel(recruitment?.type)} />
          <DetailItem label="参加人数" value={participantCountText} />
          {recruitment?.type === 'deadline' && (
            <DetailItem
              label="締切"
              value={recruitment.deadline ? formatDateTime(recruitment.deadline) : null}
            />
          )}
        </div>

        <div className="rounded-lg bg-gray-50 px-4 py-3">
          <p className="text-sm font-semibold text-gray-800">
            {recruitment?.is_closed
              ? '募集は締め切られています'
              : capacityReached
                ? '定員に達しています'
                : deadlinePassed
                  ? '締切を過ぎています'
                  : '参加受付中'}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            参加登録は現在ログインしている本人の分だけ操作できます。
          </p>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-bold text-gray-700">参加者</h3>
          {participants.length === 0 ? (
            <p className="rounded-lg bg-gray-50 px-4 py-4 text-center text-sm text-gray-400">
              参加者はまだいません
            </p>
          ) : (
            <div className="divide-y divide-gray-100 rounded-lg border border-gray-100">
              {participants.map((participant) => (
                <div key={participant.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-800">
                      {participant.profiles?.name ?? '名前未設定'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {participant.position}
                      {participant.profiles?.grade != null
                        ? ` / ${participant.profiles.grade}年生`
                        : ''}
                      {participant.joined_at ? ` / ${formatDateTime(participant.joined_at)}` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {!isParticipating && missingProfileFields.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
            プロフィールの未入力があります（
            {missingProfileFields.map((field) => field.label).join('・')}）。
            参加すると計画書の名簿に載りますが、これらの欄は空欄になります。
            <Link href="/profile" className="ml-1 font-bold underline">
              プロフィールを編集
            </Link>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {!isParticipating && (
            <button
              type="button"
              onClick={onJoin}
              disabled={submitting === 'participant' || (!canJoin && !isCreator)}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              {isCreator ? '起案者を参加登録' : '参加する'}
            </button>
          )}
          {isParticipating && !isCreatorParticipant && (
            <button
              type="button"
              onClick={onLeave}
              disabled={submitting === 'participant'}
              className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:border-red-400 disabled:opacity-50"
            >
              参加をキャンセル
            </button>
          )}
        </div>

        {isCreator && (
          <form onSubmit={onSave} className="space-y-3 border-t border-gray-100 pt-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <select
                value={form.type}
                onChange={(event) => {
                  const type = event.target.value
                  setForm((current) => ({
                    ...current,
                    type,
                    capacity: type === 'first_come' ? current.capacity : '',
                    deadline: type === 'deadline' ? current.deadline : '',
                  }))
                }}
                className={inputClass}
              >
                <option value="first_come">先着順</option>
                <option value="deadline">時間締切</option>
              </select>
              {form.type === 'first_come' ? (
                <input
                  type="number"
                  min={1}
                  value={form.capacity}
                  onChange={(event) => setForm((current) => ({ ...current, capacity: event.target.value }))}
                  className={inputClass}
                  placeholder="定員"
                />
              ) : (
                <input
                  type="datetime-local"
                  value={form.deadline}
                  onChange={(event) => setForm((current) => ({ ...current, deadline: event.target.value }))}
                  className={inputClass}
                />
              )}
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.is_closed}
                onChange={(event) => setForm((current) => ({ ...current, is_closed: event.target.checked }))}
                className="h-4 w-4"
              />
              募集を締め切る
            </label>
            <button
              disabled={submitting === 'recruitment'}
              className="w-full rounded-lg bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              {submitting === 'recruitment' ? '保存中...' : '募集設定を保存'}
            </button>
          </form>
        )}
      </div>
    </section>
  )
}

function PreparationSection({
  preparations,
  currentUserId,
  input,
  setInput,
  submitting,
  onAdd,
  onDelete,
}: {
  preparations: Preparation[]
  currentUserId: string
  input: string
  setInput: React.Dispatch<React.SetStateAction<string>>
  submitting: boolean
  onAdd: (event: React.FormEvent<HTMLFormElement>) => void
  onDelete: (id: string) => void
}) {
  return (
    <section className="rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.03]">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <h2 className="text-sm font-bold text-gray-700">持ち物・準備</h2>
        <span className="text-xs text-gray-400">{preparations.length}件</span>
      </div>

      <div className="space-y-4 p-4">
        <p className="text-xs text-gray-500">
          自分が持っていく物を登録すると、みんなに共有されます。かぶりや不足を防げます。
        </p>

        {preparations.length === 0 ? (
          <p className="rounded-lg bg-gray-50 px-4 py-6 text-center text-sm text-gray-400">
            まだ登録がありません。最初のひとつを追加しましょう。
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100">
            {preparations.map((prep) => (
              <li key={prep.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-200">
                  {prep.profiles?.avatar_url ? (
                    <Image
                      src={prep.profiles.avatar_url}
                      alt=""
                      width={28}
                      height={28}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-xs text-gray-400">👤</span>
                  )}
                </div>
                <span className="min-w-0 flex-1 truncate text-sm text-gray-800">{prep.body}</span>
                <span className="flex-shrink-0 text-xs text-gray-400">
                  {prep.profiles?.name ?? '名前未設定'}
                </span>
                {prep.user_id === currentUserId && (
                  <button
                    type="button"
                    onClick={() => onDelete(prep.id)}
                    className="flex-shrink-0 text-xs font-semibold text-red-500 hover:text-red-700"
                  >
                    削除
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={onAdd} className="flex gap-2">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            className={`${inputClass} flex-1`}
            placeholder="例: テント（4人用）、ランタン"
          />
          <button
            type="submit"
            disabled={submitting || input.trim() === ''}
            className="btn-primary flex-shrink-0"
          >
            {submitting ? '追加中...' : '追加'}
          </button>
        </form>
      </div>
    </section>
  )
}

function ReviewSection({
  reviews,
  currentUserId,
  canWrite,
  hasMyReview,
  form,
  setForm,
  submitting,
  onSave,
  onDelete,
}: {
  reviews: Review[]
  currentUserId: string
  canWrite: boolean
  hasMyReview: boolean
  form: { body: string; cost: string }
  setForm: React.Dispatch<React.SetStateAction<{ body: string; cost: string }>>
  submitting: boolean
  onSave: (event: React.FormEvent<HTMLFormElement>) => void
  onDelete: () => void
}) {
  const costs = reviews
    .map((review) => review.cost_per_person)
    .filter((cost): cost is number => cost != null)
  const averageCost =
    costs.length > 0
      ? Math.round(costs.reduce((sum, cost) => sum + cost, 0) / costs.length)
      : null

  return (
    <section className="rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.03]">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <h2 className="text-sm font-bold text-gray-700">活動をふりかえる</h2>
        {averageCost != null && (
          <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
            平均 約{averageCost.toLocaleString()}円 / 人
          </span>
        )}
      </div>

      <div className="space-y-5 p-4">
        {/* みんなの感想 */}
        {reviews.length === 0 ? (
          <p className="rounded-lg bg-gray-50 px-4 py-6 text-center text-sm text-gray-400">
            まだレビューがありません。最初のひとことを書いてみましょう。
          </p>
        ) : (
          <div className="space-y-3">
            {reviews.map((review) => (
              <div key={review.id} className="rounded-xl border border-gray-100 p-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-200">
                    {review.profiles?.avatar_url ? (
                      <Image
                        src={review.profiles.avatar_url}
                        alt=""
                        width={32}
                        height={32}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-sm text-gray-400">👤</span>
                    )}
                  </div>
                  <p className="flex-1 text-sm font-semibold text-gray-800">
                    {review.profiles?.name ?? '名前未設定'}
                    {review.user_id === currentUserId && (
                      <span className="ml-1 text-xs font-normal text-green-600">（あなた）</span>
                    )}
                  </p>
                  {review.cost_per_person != null && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
                      {review.cost_per_person.toLocaleString()}円
                    </span>
                  )}
                </div>
                {review.body && (
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700">
                    {review.body}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 自分のレビュー入力 */}
        {canWrite ? (
          <form onSubmit={onSave} className="space-y-3 border-t border-gray-100 pt-4">
            <p className="text-sm font-bold text-gray-700">
              {hasMyReview ? 'あなたのレビューを編集' : 'レビューを書く'}
            </p>
            <textarea
              value={form.body}
              onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}
              className={`${inputClass} min-h-24 resize-y`}
              placeholder="活動の感想、良かった点、ヒヤリハットなど"
            />
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                一人あたりの費用（円・任意）
              </label>
              <input
                type="number"
                min={0}
                value={form.cost}
                onChange={(event) => setForm((current) => ({ ...current, cost: event.target.value }))}
                className={inputClass}
                placeholder="例: 5000"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 rounded-lg bg-green-600 py-2.5 text-sm font-bold text-white transition hover:bg-green-700 active:scale-[0.99] disabled:opacity-50"
              >
                {submitting ? '保存中...' : hasMyReview ? '更新する' : '投稿する'}
              </button>
              {hasMyReview && (
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={submitting}
                  className="rounded-lg border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:border-red-400 hover:bg-red-50 disabled:opacity-50"
                >
                  削除
                </button>
              )}
            </div>
          </form>
        ) : (
          <p className="border-t border-gray-100 pt-4 text-xs text-gray-400">
            レビューはこの計画に参加したメンバーが書けます。
          </p>
        )}
      </div>
    </section>
  )
}

function ScheduleSection({
  items,
  defaultTransport,
  isCreator,
  form,
  setForm,
  submitting,
  onSubmit,
  onDelete,
}: {
  items: ScheduleItem[]
  defaultTransport: string | null
  isCreator: boolean
  form: {
    day: string
    time: string
    time_label: string
    location_name: string
    note: string
    transport: string
  }
  setForm: React.Dispatch<React.SetStateAction<{
    day: string
    time: string
    time_label: string
    location_name: string
    note: string
    transport: string
  }>>
  submitting: boolean
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  onDelete: (id: string) => void
}) {
  const availableTimeOptions = getAvailableScheduleTimeOptions(items, form.day)
  const groupedItems = groupScheduleItemsByDay(items)

  return (
    <section className="rounded-2xl bg-white shadow-sm">
      <SectionHeader title="行程表" />
      <div className="divide-y divide-gray-100">
        {items.length === 0 ? (
          <EmptyState text="行程はまだありません" />
        ) : (
          groupedItems.map((group) => (
            <div key={group.day ?? 'undated'}>
              <div className="bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700">
                {formatScheduleDayLabel(group.day)}
              </div>
              <div className="divide-y divide-gray-100">
                {group.items.map((item) => {
                  const mapQuery = item.map_query || item.location_name || ''
                  const mapUrl = createGoogleMapsSearchUrl(mapQuery)
                  const scheduleMeta = [
                    item.time?.slice(0, 5) || '時刻未定',
                    item.time_label,
                  ].filter(Boolean).join(' ')
                  const transport = item.transport || defaultTransport

                  return (
                    <div key={item.id} className="px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-800">
                            {scheduleMeta}
                          </p>
                          <p className="mt-1 text-sm text-gray-600">
                            {item.location_name || '場所未設定'}
                          </p>
                          {item.note && (
                            <p className="mt-2 whitespace-pre-wrap rounded-lg bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-900">
                              {item.note}
                            </p>
                          )}
                          {transport && (
                            <p className="mt-2 inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                              交通手段: {transport}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-2">
                          {mapUrl && (
                            <a
                              href={mapUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-lg bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-100"
                            >
                              地図
                            </a>
                          )}
                          {isCreator && (
                            <button
                              onClick={() => onDelete(item.id)}
                              className="text-xs font-semibold text-red-500 hover:text-red-700"
                            >
                              削除
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {isCreator && (
        <form onSubmit={onSubmit} className="space-y-3 border-t border-gray-100 p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              type="date"
              value={form.day}
              onChange={(event) => setForm((current) => ({
                ...current,
                day: event.target.value,
                time: '',
              }))}
              className={inputClass}
            />
            <select
              value={form.time}
              onChange={(event) => setForm((current) => ({ ...current, time: event.target.value }))}
              className={inputClass}
            >
              <option value="">時刻未定</option>
              {availableTimeOptions.map((time) => (
                <option key={time} value={time}>
                  {time}
                </option>
              ))}
            </select>
            <select
              value={form.time_label}
              onChange={(event) => setForm((current) => ({ ...current, time_label: event.target.value }))}
              className={inputClass}
            >
              <option value="">ラベルなし</option>
              {scheduleLabels.map((label) => (
                <option key={label} value={label}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <input
              value={form.location_name}
              onChange={(event) => setForm((current) => ({ ...current, location_name: event.target.value }))}
              className={inputClass}
              placeholder="場所名"
            />
          </div>
          <textarea
            value={form.note}
            onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
            className={`${inputClass} min-h-20 resize-y`}
            placeholder="この場所の注釈（任意）"
          />
          <select
            value={form.transport}
            onChange={(event) => setForm((current) => ({ ...current, transport: event.target.value }))}
            className={inputClass}
          >
            <option value="">
              全体の交通手段を使う{defaultTransport ? `（${defaultTransport}）` : '（未定）'}
            </option>
            {transportOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <button
            disabled={submitting}
            className="w-full rounded-lg bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            {submitting ? '追加中...' : '行程を追加'}
          </button>
        </form>
      )}
    </section>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="border-b border-gray-100 px-4 py-3">
      <h2 className="text-sm font-bold text-gray-700">{title}</h2>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return <div className="p-8 text-center text-sm text-gray-400">{text}</div>
}

function DetailItem({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wider text-gray-400">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-gray-800">{value || '未設定'}</dd>
    </div>
  )
}

function recruitmentTypeLabel(value: string | null | undefined) {
  if (value === 'first_come') return '先着順'
  if (value === 'deadline') return '時間締切'
  return '未設定'
}

function formatDateRange(startDate: string | null, endDate: string | null) {
  if (!startDate && !endDate) return ''
  if (startDate && endDate && startDate !== endDate) {
    return `${startDate} 〜 ${endDate}`
  }
  return startDate || endDate || ''
}

function formatDate(value: string | null) {
  if (!value) return ''
  return value.slice(0, 10)
}

function formatDateTime(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`
}

function toDateTimeLocalValue(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`
}

function createHalfHourTimeOptions() {
  const options: string[] = []
  for (let hour = 0; hour < 24; hour += 1) {
    for (const minute of [0, 30]) {
      options.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`)
    }
  }
  return options
}

function getAvailableScheduleTimeOptions(items: ScheduleItem[], selectedDay: string) {
  const sameDayItems = selectedDay
    ? items.filter((item) => item.day === selectedDay)
    : items

  const previousTime = [...sameDayItems]
    .reverse()
    .find((item) => item.time)?.time
    ?.slice(0, 5)

  if (!previousTime) {
    return timeOptions
  }

  return timeOptions.filter((time) => time > previousTime)
}

function groupScheduleItemsByDay(items: ScheduleItem[]) {
  const groups: { day: string | null; items: ScheduleItem[] }[] = []

  for (const item of items) {
    const day = item.day ?? null
    const lastGroup = groups[groups.length - 1]

    if (!lastGroup || lastGroup.day !== day) {
      groups.push({ day, items: [item] })
      continue
    }

    lastGroup.items.push(item)
  }

  return groups
}

function formatScheduleDayLabel(value: string | null) {
  if (!value) return '日付未定'

  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return value

  return `${year}年${month}月${day}日`
}
