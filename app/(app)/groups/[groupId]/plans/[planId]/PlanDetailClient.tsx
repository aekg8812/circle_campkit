'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { createGoogleMapsSearchUrl } from '@/lib/maps'

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

type Props = {
  group: Group
  plan: Plan
  scheduleItems: ScheduleItem[]
  recruitment: Recruitment | null
  participants: Participant[]
  currentUserId: string
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
  currentUserId,
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const isCreator = plan.creator_id === currentUserId
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
        <Link
          href={`/groups/${group.id}/plans/${plan.id}/document`}
          className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm font-semibold text-green-700 transition hover:bg-green-100"
        >
          📄 計画書
        </Link>
      </div>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="inline-flex rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
              {statusLabel(plan.status)}
            </span>
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

function statusLabel(status: Plan['status']) {
  if (status === 'draft') return '下書き'
  if (status === 'recruiting') return '募集中'
  if (status === 'past') return '過去'
  return '計画'
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
