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
}

type PlanNote = {
  id: string
  note_type: string | null
  body: string | null
}

type Car = {
  id: string
  owner_id: string | null
  name: string | null
  capacity: number | null
  luggage_capacity: string | null
  profiles: { name: string } | null
}

type TransportCar = {
  id: string
  car_id: string | null
  note: string | null
  cars: Omit<Car, 'profiles'> | null
}

type Transport = {
  id: string
  type: string | null
  note: string | null
  transport_cars: TransportCar[]
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
  planNotes: PlanNote[]
  transports: Transport[]
  cars: Car[]
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
  sort_order: z.string().optional(),
  time_label: z.string().optional(),
  location_name: z.string().min(1, '場所名を入力してください'),
  location_type: z.string().optional(),
  map_query: z.string().optional(),
})

const noteSchema = z.object({
  note_type: z.string().min(1, '種類を選択してください'),
  body: z.string().min(1, '内容を入力してください'),
})

const transportSchema = z.object({
  type: z.string().min(1, '交通手段を選択してください'),
  note: z.string().optional(),
  car_id: z.string().optional(),
  car_note: z.string().optional(),
})

const recruitmentSchema = z.object({
  type: z.enum(['first_come', 'deadline']),
  capacity: z.string().optional(),
  deadline: z.string().optional(),
  is_closed: z.boolean(),
})

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500'

export default function PlanDetailClient({
  group,
  plan,
  scheduleItems,
  planNotes,
  transports,
  cars,
  recruitment,
  participants,
  currentUserId,
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const isCreator = plan.creator_id === currentUserId
  const [updatingStatus, setUpdatingStatus] = useState<PlanStatus | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [scheduleForm, setScheduleForm] = useState({
    day: plan.start_date ?? '',
    time: '',
    sort_order: '0',
    time_label: '',
    location_name: '',
    location_type: 'destination',
    map_query: '',
  })
  const [noteForm, setNoteForm] = useState({
    note_type: 'general',
    body: '',
  })
  const [transportForm, setTransportForm] = useState({
    type: 'car',
    note: '',
    car_id: '',
    car_note: '',
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
    const { error } = await supabase.from('schedule_items').insert({
      plan_id: plan.id,
      day: data.day || null,
      time: data.time || null,
      sort_order: Number(data.sort_order || 0),
      time_label: data.time_label || null,
      location_name: data.location_name,
      location_type: data.location_type || null,
      map_query: data.map_query || data.location_name,
    })

    if (error) {
      setServerError('行程の追加に失敗しました: ' + error.message)
      setSubmitting(null)
      return
    }

    setScheduleForm((current) => ({
      ...current,
      time: '',
      sort_order: String(Number(current.sort_order || 0) + 1),
      time_label: '',
      location_name: '',
      map_query: '',
    }))
    refreshAfterMutation()
    setSubmitting(null)
  }

  const addPlanNote = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setServerError(null)
    setSubmitting('note')

    const parsed = noteSchema.safeParse(noteForm)
    if (!parsed.success) {
      setServerError(parsed.error.issues[0]?.message ?? '注釈を確認してください')
      setSubmitting(null)
      return
    }

    const { error } = await supabase.from('plan_notes').insert({
      plan_id: plan.id,
      note_type: parsed.data.note_type,
      body: parsed.data.body,
    })

    if (error) {
      setServerError('注釈の追加に失敗しました: ' + error.message)
      setSubmitting(null)
      return
    }

    setNoteForm((current) => ({ ...current, body: '' }))
    refreshAfterMutation()
    setSubmitting(null)
  }

  const addTransport = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setServerError(null)
    setSubmitting('transport')

    const parsed = transportSchema.safeParse(transportForm)
    if (!parsed.success) {
      setServerError(parsed.error.issues[0]?.message ?? '交通手段を確認してください')
      setSubmitting(null)
      return
    }

    const { data } = parsed
    const { data: created, error } = await supabase
      .from('transports')
      .insert({
        plan_id: plan.id,
        type: data.type,
        note: data.note || null,
      })
      .select('id')
      .single()

    if (error) {
      setServerError('交通手段の追加に失敗しました: ' + error.message)
      setSubmitting(null)
      return
    }

    if (data.type === 'car' && data.car_id) {
      const { error: carError } = await supabase.from('transport_cars').insert({
        transport_id: created.id,
        car_id: data.car_id,
        note: data.car_note || null,
      })

      if (carError) {
        setServerError('車の割り当てに失敗しました: ' + carError.message)
        setSubmitting(null)
        return
      }
    }

    setTransportForm({
      type: 'car',
      note: '',
      car_id: '',
      car_note: '',
    })
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

    const { error } = await supabase
      .from('recruitments')
      .upsert(
        {
          plan_id: plan.id,
          type: parsed.data.type,
          capacity,
          deadline: parsed.data.deadline || null,
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
    table: 'schedule_items' | 'plan_notes' | 'transports',
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
          <DetailItem label="作成日" value={formatDate(plan.created_at)} />
        </dl>

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
        isCreator={isCreator}
        form={scheduleForm}
        setForm={setScheduleForm}
        submitting={submitting === 'schedule'}
        onSubmit={addScheduleItem}
        onDelete={(id) => deleteRow('schedule_items', id)}
      />

      <NotesSection
        notes={planNotes}
        isCreator={isCreator}
        form={noteForm}
        setForm={setNoteForm}
        submitting={submitting === 'note'}
        onSubmit={addPlanNote}
        onDelete={(id) => deleteRow('plan_notes', id)}
      />

      <TransportSection
        transports={transports}
        cars={cars}
        isCreator={isCreator}
        form={transportForm}
        setForm={setTransportForm}
        submitting={submitting === 'transport'}
        onSubmit={addTransport}
        onDelete={(id) => deleteRow('transports', id)}
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
          <DetailItem
            label="締切"
            value={recruitment?.deadline ? formatDateTime(recruitment.deadline) : null}
          />
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
            <div className="grid gap-3 sm:grid-cols-3">
              <select
                value={form.type}
                onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}
                className={inputClass}
              >
                <option value="first_come">先着順</option>
                <option value="deadline">時間締切</option>
              </select>
              <input
                type="number"
                min={1}
                value={form.capacity}
                onChange={(event) => setForm((current) => ({ ...current, capacity: event.target.value }))}
                className={inputClass}
                placeholder="定員（任意）"
              />
              <input
                type="datetime-local"
                value={form.deadline}
                onChange={(event) => setForm((current) => ({ ...current, deadline: event.target.value }))}
                className={inputClass}
              />
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
  isCreator,
  form,
  setForm,
  submitting,
  onSubmit,
  onDelete,
}: {
  items: ScheduleItem[]
  isCreator: boolean
  form: {
    day: string
    time: string
    sort_order: string
    time_label: string
    location_name: string
    location_type: string
    map_query: string
  }
  setForm: React.Dispatch<React.SetStateAction<{
    day: string
    time: string
    sort_order: string
    time_label: string
    location_name: string
    location_type: string
    map_query: string
  }>>
  submitting: boolean
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  onDelete: (id: string) => void
}) {
  return (
    <section className="rounded-2xl bg-white shadow-sm">
      <SectionHeader title="行程表" />
      <div className="divide-y divide-gray-100">
        {items.length === 0 ? (
          <EmptyState text="行程はまだありません" />
        ) : (
          items.map((item) => {
            const mapQuery = item.map_query || item.location_name || ''
            const mapUrl = createGoogleMapsSearchUrl(mapQuery)
            return (
              <div key={item.id} className="px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800">
                      {[item.day, item.time?.slice(0, 5), item.time_label]
                        .filter(Boolean)
                        .join(' ')}
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      {item.location_name || '場所未設定'}
                    </p>
                    {item.location_type && (
                      <p className="mt-1 text-xs text-gray-400">
                        {locationTypeLabel(item.location_type)}
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
          })
        )}
      </div>

      {isCreator && (
        <form onSubmit={onSubmit} className="space-y-3 border-t border-gray-100 p-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <input
              type="date"
              value={form.day}
              onChange={(event) => setForm((current) => ({ ...current, day: event.target.value }))}
              className={inputClass}
            />
            <input
              type="time"
              value={form.time}
              onChange={(event) => setForm((current) => ({ ...current, time: event.target.value }))}
              className={inputClass}
            />
            <input
              value={form.time_label}
              onChange={(event) => setForm((current) => ({ ...current, time_label: event.target.value }))}
              className={inputClass}
              placeholder="集合 / 出発"
            />
            <input
              type="number"
              value={form.sort_order}
              onChange={(event) => setForm((current) => ({ ...current, sort_order: event.target.value }))}
              className={inputClass}
              placeholder="順番"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              value={form.location_name}
              onChange={(event) => setForm((current) => ({ ...current, location_name: event.target.value }))}
              className={inputClass}
              placeholder="場所名"
            />
            <select
              value={form.location_type}
              onChange={(event) => setForm((current) => ({ ...current, location_type: event.target.value }))}
              className={inputClass}
            >
              <option value="meeting">集合</option>
              <option value="destination">目的地</option>
              <option value="dissolution">解散</option>
              <option value="other">その他</option>
            </select>
            <input
              value={form.map_query}
              onChange={(event) => setForm((current) => ({ ...current, map_query: event.target.value }))}
              className={inputClass}
              placeholder="地図検索語（任意）"
            />
          </div>
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

function NotesSection({
  notes,
  isCreator,
  form,
  setForm,
  submitting,
  onSubmit,
  onDelete,
}: {
  notes: PlanNote[]
  isCreator: boolean
  form: { note_type: string; body: string }
  setForm: React.Dispatch<React.SetStateAction<{ note_type: string; body: string }>>
  submitting: boolean
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  onDelete: (id: string) => void
}) {
  return (
    <section className="rounded-2xl bg-white shadow-sm">
      <SectionHeader title="注釈" />
      <div className="divide-y divide-gray-100">
        {notes.length === 0 ? (
          <EmptyState text="注釈はまだありません" />
        ) : (
          notes.map((note) => (
            <div key={note.id} className="px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                    {noteTypeLabel(note.note_type)}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-gray-700">
                    {note.body}
                  </p>
                </div>
                {isCreator && (
                  <button
                    onClick={() => onDelete(note.id)}
                    className="flex-shrink-0 text-xs font-semibold text-red-500 hover:text-red-700"
                  >
                    削除
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {isCreator && (
        <form onSubmit={onSubmit} className="space-y-3 border-t border-gray-100 p-4">
          <select
            value={form.note_type}
            onChange={(event) => setForm((current) => ({ ...current, note_type: event.target.value }))}
            className={inputClass}
          >
            <option value="general">起案者より</option>
            <option value="route">経路</option>
            <option value="place">場所</option>
            <option value="items">持ち物</option>
          </select>
          <textarea
            value={form.body}
            onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}
            className={`${inputClass} min-h-24 resize-y`}
            placeholder="補足事項"
          />
          <button
            disabled={submitting}
            className="w-full rounded-lg bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            {submitting ? '追加中...' : '注釈を追加'}
          </button>
        </form>
      )}
    </section>
  )
}

function TransportSection({
  transports,
  cars,
  isCreator,
  form,
  setForm,
  submitting,
  onSubmit,
  onDelete,
}: {
  transports: Transport[]
  cars: Car[]
  isCreator: boolean
  form: { type: string; note: string; car_id: string; car_note: string }
  setForm: React.Dispatch<React.SetStateAction<{
    type: string
    note: string
    car_id: string
    car_note: string
  }>>
  submitting: boolean
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  onDelete: (id: string) => void
}) {
  return (
    <section className="rounded-2xl bg-white shadow-sm">
      <SectionHeader title="交通手段" />
      <div className="divide-y divide-gray-100">
        {transports.length === 0 ? (
          <EmptyState text="交通手段はまだありません" />
        ) : (
          transports.map((transport) => (
            <div key={transport.id} className="px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    {transportTypeLabel(transport.type)}
                  </p>
                  {transport.note && (
                    <p className="mt-1 text-sm text-gray-600">{transport.note}</p>
                  )}
                  {transport.transport_cars.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {transport.transport_cars.map((transportCar) => (
                        <p key={transportCar.id} className="text-xs text-gray-500">
                          車: {transportCar.cars?.name || '名称なし'}
                          {transportCar.cars?.capacity != null
                            ? ` / ${transportCar.cars.capacity}人`
                            : ''}
                          {transportCar.note ? ` / ${transportCar.note}` : ''}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
                {isCreator && (
                  <button
                    onClick={() => onDelete(transport.id)}
                    className="flex-shrink-0 text-xs font-semibold text-red-500 hover:text-red-700"
                  >
                    削除
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {isCreator && (
        <form onSubmit={onSubmit} className="space-y-3 border-t border-gray-100 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <select
              value={form.type}
              onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}
              className={inputClass}
            >
              <option value="car">車</option>
              <option value="train">電車</option>
              <option value="airplane">飛行機</option>
              <option value="other">その他</option>
            </select>
            <input
              value={form.note}
              onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
              className={inputClass}
              placeholder="交通手段の補足"
            />
          </div>

          {form.type === 'car' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <select
                value={form.car_id}
                onChange={(event) => setForm((current) => ({ ...current, car_id: event.target.value }))}
                className={inputClass}
              >
                <option value="">車を割り当てない</option>
                {cars.map((car) => (
                  <option key={car.id} value={car.id}>
                    {car.name || '名称なし'}
                    {car.profiles?.name ? `（${car.profiles.name}）` : ''}
                    {car.capacity != null ? ` / ${car.capacity}人` : ''}
                  </option>
                ))}
              </select>
              <input
                value={form.car_note}
                onChange={(event) => setForm((current) => ({ ...current, car_note: event.target.value }))}
                className={inputClass}
                placeholder="車割り当てメモ"
              />
            </div>
          )}

          <button
            disabled={submitting}
            className="w-full rounded-lg bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            {submitting ? '追加中...' : '交通手段を追加'}
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

function locationTypeLabel(value: string) {
  if (value === 'meeting') return '集合'
  if (value === 'destination') return '目的地'
  if (value === 'dissolution') return '解散'
  return 'その他'
}

function noteTypeLabel(value: string | null) {
  if (value === 'general') return '起案者より'
  if (value === 'route') return '経路'
  if (value === 'place') return '場所'
  if (value === 'items') return '持ち物'
  return '注釈'
}

function recruitmentTypeLabel(value: string | null | undefined) {
  if (value === 'first_come') return '先着順'
  if (value === 'deadline') return '時間締切'
  return '未設定'
}

function transportTypeLabel(value: string | null) {
  if (value === 'car') return '車'
  if (value === 'train') return '電車'
  if (value === 'airplane') return '飛行機'
  if (value === 'other') return 'その他'
  return '交通手段'
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
