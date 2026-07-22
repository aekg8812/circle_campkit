'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { openDatePicker } from '@/lib/dateInput'
import { createGoogleMapsSearchUrl } from '@/lib/maps'
import { getMissingDocumentFields, type ProfileLike } from '@/lib/profileCompleteness'
import { useToast } from '@/components/Toast'
import { StatusBadge } from '@/components/StatusBadge'
import {
  getPlanPhase,
  isRecruitmentClosed,
  type PlanPhase,
} from '@/lib/recruitmentStatus'

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
  budget_per_person: number | null
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

type GearItem = { id: string; name: string }
type CarItem = { id: string; name: string | null; capacity: number | null }

type Props = {
  group: Group
  plan: Plan
  scheduleItems: ScheduleItem[]
  recruitment: Recruitment | null
  participants: Participant[]
  reviews: Review[]
  preparations: Preparation[]
  myGear: GearItem[]
  myCars: CarItem[]
  currentUserId: string
  currentUserProfile: ProfileLike | null
}

/** 車の表示名（例: プリウス（5人乗り）） */
function carLabel(car: CarItem): string {
  const name = car.name?.trim() || '車'
  return car.capacity != null ? `${name}（${car.capacity}人乗り）` : name
}

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
  myGear,
  myCars,
  currentUserId,
  currentUserProfile,
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const toast = useToast()
  const isCreator = plan.creator_id === currentUserId
  const missingProfileFields = getMissingDocumentFields(currentUserProfile)
  // 参加直後に持ち物・車を登録してもらうモーダル
  const [showPrepModal, setShowPrepModal] = useState(false)
  const [selectedGearIds, setSelectedGearIds] = useState<string[]>([])
  const [selectedCarIds, setSelectedCarIds] = useState<string[]>([])
  const [prepSaving, setPrepSaving] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState<PlanStatus | null>(null)
  const [updatingTransport, setUpdatingTransport] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [scheduleForm, setScheduleForm] = useState({
    day: plan.start_date ?? '',
    time: '',
    time_label: '',
    location_name: '',
    note: '',
    // 全体で選んだ交通手段を最初から入れておく（すぐ出るように）
    transport: plan.default_transport ?? '',
  })
  // 行程の編集（編集中の行程IDと、その入力内容）
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null)
  const [editScheduleForm, setEditScheduleForm] = useState({
    day: '',
    time: '',
    time_label: '',
    location_name: '',
    note: '',
    transport: '',
  })
  const [recruitmentForm, setRecruitmentForm] = useState({
    type: recruitment?.type === 'first_come' ? 'first_come' : 'deadline',
    capacity: recruitment?.capacity != null ? String(recruitment.capacity) : '',
    deadline: toDateTimeLocalValue(recruitment?.deadline ?? null),
    is_closed: recruitment?.is_closed ?? false,
  })
  const [submitting, setSubmitting] = useState<string | null>(null)
  // 持ち物: 個人用・共同用でそれぞれ自由入力欄を持つ
  const [personalInput, setPersonalInput] = useState('')
  const [sharedInput, setSharedInput] = useState('')
  const myReview = reviews.find((review) => review.user_id === currentUserId)
  const [reviewForm, setReviewForm] = useState({
    body: myReview?.body ?? '',
    cost: myReview?.cost_per_person != null ? String(myReview.cost_per_person) : '',
  })
  const myParticipant = participants.find((participant) => participant.user_id === currentUserId)
  const capacityReached =
    recruitment?.capacity != null && participants.length >= recruitment.capacity
  // 締切は「時間締切」「先着順＆時間締切」の両方で使う
  const deadlinePassed =
    recruitment?.deadline != null &&
    new Date(recruitment.deadline).getTime() < Date.now()
  // 募集が締め切られていれば「実施」、実施日を過ぎていれば「過去」に自動で移る
  const recruitmentClosed = isRecruitmentClosed(recruitment, participants.length)
  const phase: PlanPhase = getPlanPhase({
    status: plan.status,
    recruitmentClosed,
    startDate: plan.start_date,
    endDate: plan.end_date,
  })

  // 参加できるのは「募集中」フェーズのときだけ
  const canJoin = phase === 'recruiting' && !myParticipant

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
      // 全体で選んだ交通手段は、次の行程でもそのまま出しておく
      transport: plan.default_transport ?? '',
    }))
    refreshAfterMutation()
    setSubmitting(null)
  }

  /** 行程の編集を開始（その行の値をフォームに読み込む） */
  const startEditSchedule = (item: ScheduleItem) => {
    setServerError(null)
    setEditingScheduleId(item.id)
    setEditScheduleForm({
      day: item.day ?? '',
      time: item.time ? item.time.slice(0, 5) : '',
      time_label: item.time_label ?? '',
      location_name: item.location_name ?? '',
      note: item.note ?? '',
      transport: item.transport ?? '',
    })
  }

  const saveScheduleEdit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingScheduleId) return

    setServerError(null)

    const parsed = scheduleSchema.safeParse(editScheduleForm)
    if (!parsed.success) {
      setServerError(parsed.error.issues[0]?.message ?? '行程を確認してください')
      return
    }

    setSubmitting('schedule-edit')

    const { data } = parsed
    const { error } = await supabase
      .from('schedule_items')
      .update({
        day: data.day || null,
        time: data.time || null,
        time_label: data.time_label || null,
        location_name: data.location_name,
        map_query: data.location_name,
        note: data.note || null,
        transport: data.transport || null,
      })
      .eq('id', editingScheduleId)

    if (error) {
      setServerError('行程の更新に失敗しました: ' + error.message)
      setSubmitting(null)
      return
    }

    setEditingScheduleId(null)
    toast('行程を更新しました')
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

    // どちらの方式でも締切日時は必須
    if (!parsed.data.deadline) {
      setServerError('締切日時を入力してください')
      setSubmitting(null)
      return
    }

    // datetime-local の値（ローカル時刻）を ISO（UTC）に変換して保存し、
    // 保存⇔表示で時刻がずれないようにする（タイムゾーン対応）
    const deadlineDate = new Date(parsed.data.deadline)
    if (Number.isNaN(deadlineDate.getTime())) {
      setServerError('締切日時が正しくありません')
      setSubmitting(null)
      return
    }
    const deadlineIso = deadlineDate.toISOString()

    // 先着順（＆時間締切）のときだけ定員が必要
    if (parsed.data.type === 'first_come' && capacity == null) {
      setServerError('先着順では定員を入力してください')
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
          deadline: deadlineIso,
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

    // 参加したら、持っていく道具・出せる車の登録をその場でお願いする
    setSelectedGearIds([])
    setSelectedCarIds([])
    setShowPrepModal(true)

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

  // 募集を締め切る → 自動的に「実施」フェーズへ進む
  const closeRecruitment = async () => {
    if (
      !confirm(
        '募集を締め切りますか？\n締め切ると「実施」フェーズに進み、これ以上の参加はできなくなります。'
      )
    ) {
      return
    }

    setServerError(null)
    setSubmitting('close')

    const { error } = await supabase.from('recruitments').upsert(
      {
        plan_id: plan.id,
        type: recruitment?.type ?? 'deadline',
        capacity: recruitment?.capacity ?? null,
        deadline: recruitment?.deadline ?? null,
        is_closed: true,
      },
      { onConflict: 'plan_id' }
    )

    if (error) {
      setServerError('募集の締め切りに失敗しました: ' + error.message)
      setSubmitting(null)
      return
    }

    toast('募集を締め切りました。「実施」フェーズに進みます')
    refreshAfterMutation()
    setSubmitting(null)
  }

  const duplicatePlan = async () => {
    if (
      !confirm(
        'この計画を複製しますか？\n\n複製した計画は「自分の計画」タブに未公開で追加されます（日程は未設定）。\n続けて日程などを編集できます。'
      )
    ) {
      return
    }

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

    toast('「自分の計画」に複製しました。日程を設定してください')
    router.push(`/groups/${group.id}/plans/${created.id}/edit`)
    router.refresh()
  }

  const addPreparationRow = async (body: string, type: 'gear' | 'car' | 'shared') => {
    setServerError(null)
    setSubmitting('preparation')

    const { error } = await supabase.from('preparations').insert({
      plan_id: plan.id,
      user_id: currentUserId,
      type,
      body,
    })

    if (error) {
      setServerError('持ち物の追加に失敗しました: ' + error.message)
      setSubmitting(null)
      return
    }

    refreshAfterMutation()
    setSubmitting(null)
  }

  const addPersonalItem = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const body = personalInput.trim()
    if (!body) return
    await addPreparationRow(body, 'gear')
    setPersonalInput('')
  }

  const addSharedItem = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const body = sharedInput.trim()
    if (!body) return
    await addPreparationRow(body, 'shared')
    setSharedInput('')
  }

  // 参加直後のモーダルで選んだ道具・車をまとめて登録する
  const savePostJoinPreparations = async (skip: boolean) => {
    setPrepSaving(true)

    if (!skip) {
      const rows = [
        ...myGear
          .filter((gear) => selectedGearIds.includes(gear.id))
          .map((gear) => ({
            plan_id: plan.id,
            user_id: currentUserId,
            type: 'gear',
            body: gear.name,
          })),
        ...myCars
          .filter((car) => selectedCarIds.includes(car.id))
          .map((car) => ({
            plan_id: plan.id,
            user_id: currentUserId,
            type: 'car',
            body: carLabel(car),
          })),
      ]

      if (rows.length > 0) {
        const { error } = await supabase.from('preparations').insert(rows)
        if (error) {
          setServerError('持ち物の登録に失敗しました: ' + error.message)
          setPrepSaving(false)
          return
        }
        toast('持ち物・車を登録しました')
      }
    }

    setPrepSaving(false)
    setShowPrepModal(false)
    refreshAfterMutation()
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
            title="この計画をコピーして、自分の新しい計画（未公開）を作ります"
          >
            {submitting === 'duplicate' ? '複製中...' : '📋 自分の計画に複製'}
          </button>
          <Link
            href={`/groups/${group.id}/plans/${plan.id}/document`}
            className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm font-semibold text-green-700 transition hover:bg-green-100"
            title="学校に提出する書類（計画書＋参加者名簿）を作成します"
          >
            📄 提出書類をつくる
          </Link>
        </div>
      </div>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <StatusBadge status={phase} className="px-3 py-1" />
          {isCreator && (
            <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-500">
              起案者
            </span>
          )}
        </div>

        {serverError && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {serverError}
          </p>
        )}

        {isCreator && (
          <StatusManager
            phase={phase}
            groupName={group.name}
            updatingStatus={updatingStatus}
            closing={submitting === 'close'}
            editHref={`/groups/${group.id}/plans/${plan.id}/edit`}
            onChange={updateStatus}
            onClose={closeRecruitment}
          />
        )}

        {/* 基本情報（何が編集されるのかが分かるよう、この見出しの横に編集ボタンを置く） */}
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-gray-700">基本情報</h2>
          {isCreator && phase !== 'past' && (
            <Link
              href={`/groups/${group.id}/plans/${plan.id}/edit`}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:border-green-400 hover:text-green-700"
            >
              ✏️ 基本情報を編集
            </Link>
          )}
        </div>

        {/* 見やすさ優先で、基本情報は タイトル(見出し)・日程・場所・予算 のみ */}
        <dl className="grid gap-4 sm:grid-cols-3">
          <DetailItem label="日程" value={formatDateRange(plan.start_date, plan.end_date)} />
          <DetailItem label="場所" value={plan.area} />
          <DetailItem
            label="一人あたり予算"
            value={
              plan.budget_per_person != null
                ? `約${plan.budget_per_person.toLocaleString()}円`
                : null
            }
          />
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

      {phase === 'past' && (
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

      {/* 行程表 → 募集・参加 の順に表示 */}
      <ScheduleSection
        items={scheduleItems}
        defaultTransport={plan.default_transport}
        isCreator={isCreator}
        form={scheduleForm}
        setForm={setScheduleForm}
        submitting={submitting === 'schedule'}
        onSubmit={addScheduleItem}
        onDelete={(id) => deleteRow('schedule_items', id)}
        editingId={editingScheduleId}
        editForm={editScheduleForm}
        setEditForm={setEditScheduleForm}
        editSubmitting={submitting === 'schedule-edit'}
        onStartEdit={startEditSchedule}
        onCancelEdit={() => setEditingScheduleId(null)}
        onSaveEdit={saveScheduleEdit}
      />

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

      {/* 持ち物・準備は、募集を開始してから（募集中・実施）だけ表示する */}
      {(phase === 'recruiting' || phase === 'in_progress') && (
        <PreparationSection
          preparations={preparations}
          currentUserId={currentUserId}
          isParticipant={Boolean(myParticipant)}
          myGear={myGear}
          myCars={myCars}
          personalInput={personalInput}
          setPersonalInput={setPersonalInput}
          sharedInput={sharedInput}
          setSharedInput={setSharedInput}
          submitting={submitting === 'preparation'}
          onAddPersonal={addPersonalItem}
          onAddShared={addSharedItem}
          onAddItem={addPreparationRow}
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

      {/* 参加直後: 持っていく道具・出せる車を登録してもらう（なければ「なし」） */}
      {showPrepModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="持ち物・車の登録"
        >
          <div className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-base font-bold text-gray-800">持ち物・車の登録</h2>
            <p className="mt-1 text-xs leading-5 text-gray-500">
              参加ありがとうございます！持っていく道具と、出せる車を選んでください。
              みんなに共有され、かぶりや不足を防げます。
            </p>

            {myGear.length === 0 && myCars.length === 0 ? (
              <div className="mt-4 rounded-xl bg-gray-50 p-4 text-center">
                <p className="text-sm text-gray-600">
                  プロフィールに道具・車が登録されていません。
                </p>
                <Link
                  href="/profile"
                  className="mt-2 inline-block text-sm font-bold text-green-600 underline"
                >
                  プロフィールで登録する →
                </Link>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {myGear.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs font-bold text-gray-600">🎒 持っていく道具</p>
                    <div className="space-y-1">
                      {myGear.map((gear) => (
                        <label
                          key={gear.id}
                          className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          <input
                            type="checkbox"
                            checked={selectedGearIds.includes(gear.id)}
                            onChange={(event) =>
                              setSelectedGearIds((current) =>
                                event.target.checked
                                  ? [...current, gear.id]
                                  : current.filter((id) => id !== gear.id)
                              )
                            }
                            className="h-4 w-4"
                          />
                          {gear.name}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {myCars.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs font-bold text-gray-600">🚗 出せる車</p>
                    <div className="space-y-1">
                      {myCars.map((car) => (
                        <label
                          key={car.id}
                          className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          <input
                            type="checkbox"
                            checked={selectedCarIds.includes(car.id)}
                            onChange={(event) =>
                              setSelectedCarIds((current) =>
                                event.target.checked
                                  ? [...current, car.id]
                                  : current.filter((id) => id !== car.id)
                              )
                            }
                            className="h-4 w-4"
                          />
                          {carLabel(car)}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-5 space-y-2">
              {(myGear.length > 0 || myCars.length > 0) && (
                <button
                  type="button"
                  onClick={() => savePostJoinPreparations(false)}
                  disabled={
                    prepSaving ||
                    (selectedGearIds.length === 0 && selectedCarIds.length === 0)
                  }
                  className="btn-primary w-full"
                >
                  {prepSaving ? '登録中...' : 'この内容で登録する'}
                </button>
              )}
              <button
                type="button"
                onClick={() => savePostJoinPreparations(true)}
                disabled={prepSaving}
                className="btn-secondary w-full"
              >
                なし（持っていかない）
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// 状態（下書き/募集中/過去）の意味を説明し、次にとる操作を分かりやすく提示する
// 計画の状態は一方向にだけ進む（不可逆）:
//   未公開 →（募集開始）→ 募集中 →（締め切り/締切日時/定員）→ 実施 →（実施日経過）→ 過去
// 戻す操作は用意しない。各フェーズで「次にやること」だけを提示する。
function StatusManager({
  phase,
  groupName,
  updatingStatus,
  closing,
  editHref,
  onChange,
  onClose,
}: {
  phase: PlanPhase
  groupName: string
  updatingStatus: PlanStatus | null
  closing: boolean
  editHref: string
  onChange: (status: PlanStatus) => void
  onClose: () => void
}) {
  const busy = updatingStatus != null || closing

  if (phase === 'draft') {
    return (
      <div className="mb-6 overflow-hidden rounded-xl border border-amber-200 bg-amber-50">
        <div className="p-4">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-gray-200 px-2.5 py-0.5 text-xs font-bold text-gray-600">
              未公開
            </span>
            <span className="text-xs text-gray-500">＝ 今はあなただけが見られます</span>
          </div>
          <p className="mt-2 text-sm leading-6 text-amber-800">
            内容がそろったら<strong>「募集を開始」</strong>を押すと、
            <strong>{groupName ? `「${groupName}」の` : ''}グループ全員に公開</strong>され、メンバーが参加できるようになります。
          </p>

          {/* 進み方を視覚的に（今どこか分かるように） */}
          <div className="mt-3 flex items-center gap-1 text-xs font-semibold">
            <span className="rounded-full bg-amber-500 px-2 py-0.5 text-white">未公開</span>
            <span className="text-amber-400">→</span>
            <span className="rounded-full bg-white px-2 py-0.5 text-amber-700 ring-1 ring-amber-200">
              募集中
            </span>
            <span className="text-amber-300">→</span>
            <span className="rounded-full bg-white px-2 py-0.5 text-gray-400 ring-1 ring-gray-200">
              実施
            </span>
            <span className="text-amber-300">→</span>
            <span className="rounded-full bg-white px-2 py-0.5 text-gray-400 ring-1 ring-gray-200">
              過去
            </span>
          </div>
        </div>

        {/* 目立つ公開ボタン */}
        <div className="border-t border-amber-200 bg-amber-100/60 p-4">
          <button
            type="button"
            onClick={() => onChange('recruiting')}
            disabled={busy}
            className="btn-primary w-full py-3 text-base"
          >
            {updatingStatus === 'recruiting'
              ? '公開しています...'
              : '📣 募集を開始する（グループ全員に公開）'}
          </button>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-amber-700">まだ内容を直せます：</span>
            <Link href={editHref} className="font-bold text-green-700 hover:underline">
              ✏️ 基本情報を編集
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'recruiting') {
    return (
      <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4">
        <p className="text-sm font-bold text-green-800">「募集中」です（グループに公開中）</p>
        <p className="mt-1 text-xs leading-5 text-green-700">
          メンバーが参加できます。締切日時を過ぎるか、定員に達するか、下の「募集を締め切る」を押すと、
          自動的に<strong>「実施」</strong>フェーズへ進みます。
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href={editHref} className="btn-secondary">
            ✏️ 内容を再編集
          </Link>
          <button type="button" onClick={onClose} disabled={busy} className="btn-primary">
            {closing ? '締め切り中...' : '🔒 募集を締め切る'}
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'in_progress') {
    return (
      <div className="mb-6 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
        <p className="text-sm font-bold text-indigo-800">「実施」フェーズです</p>
        <p className="mt-1 text-xs leading-5 text-indigo-700">
          募集は締め切られ、参加者が確定しました。当日に向けて、行程や持ち物を確認しましょう。
          <strong>実施日（終了日）を過ぎると、自動的に「過去」へ移ります。</strong>
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href={editHref} className="btn-secondary">
            ✏️ 内容を再編集
          </Link>
          <button
            type="button"
            onClick={() => onChange('past')}
            disabled={busy}
            className="btn-secondary"
          >
            {updatingStatus === 'past' ? '更新中...' : '活動を終えた（今すぐ「過去」にする）'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-6 rounded-xl border border-sky-200 bg-sky-50 p-4">
      <p className="text-sm font-bold text-sky-800">「過去」の計画です</p>
      <p className="mt-1 text-xs leading-5 text-sky-700">
        実施日を過ぎた（または終了した）計画です。ふりかえり（感想・費用）を記録できます。
      </p>
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
          {recruitment?.deadline != null && (
            <DetailItem label="締切" value={formatDateTime(recruitment.deadline)} />
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
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">募集方式</label>
                <select
                  value={form.type}
                  onChange={(event) => {
                    const type = event.target.value
                    setForm((current) => ({
                      ...current,
                      type,
                      // 締切は両方式で使うので残す。定員は先着順のときだけ
                      capacity: type === 'first_come' ? current.capacity : '',
                    }))
                  }}
                  className={inputClass}
                >
                  <option value="deadline">時間締切</option>
                  <option value="first_come">先着順＆時間締切</option>
                </select>
              </div>
              {form.type === 'first_come' && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">定員（先着人数）</label>
                  <input
                    type="number"
                    min={1}
                    value={form.capacity}
                    onChange={(event) => setForm((current) => ({ ...current, capacity: event.target.value }))}
                    className={inputClass}
                    placeholder="例: 10"
                  />
                </div>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">締切日時</label>
              <input
                type="datetime-local"
                onClick={openDatePicker}
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

// 持ち物・準備：上に「個人の持ち物」、下に「共同の持ち物（みんなで使う）」を
// それぞれ独立した欄として表示し、各欄に追加ボタンを置く（見やすさ優先）。
function PreparationSection({
  preparations,
  currentUserId,
  isParticipant,
  myGear,
  myCars,
  personalInput,
  setPersonalInput,
  sharedInput,
  setSharedInput,
  submitting,
  onAddPersonal,
  onAddShared,
  onAddItem,
  onDelete,
}: {
  preparations: Preparation[]
  currentUserId: string
  isParticipant: boolean
  myGear: GearItem[]
  myCars: CarItem[]
  personalInput: string
  setPersonalInput: React.Dispatch<React.SetStateAction<string>>
  sharedInput: string
  setSharedInput: React.Dispatch<React.SetStateAction<string>>
  submitting: boolean
  onAddPersonal: (event: React.FormEvent<HTMLFormElement>) => void
  onAddShared: (event: React.FormEvent<HTMLFormElement>) => void
  onAddItem: (body: string, type: 'gear' | 'car' | 'shared') => void
  onDelete: (id: string) => void
}) {
  // すでに自分が登録した内容は、プロフィールからのクイック追加の候補から外す
  const myBodies = new Set(
    preparations.filter((p) => p.user_id === currentUserId).map((p) => p.body ?? '')
  )
  const gearChips = myGear.filter((gear) => !myBodies.has(gear.name))
  const carChips = myCars.filter((car) => !myBodies.has(carLabel(car)))

  // 個人の持ち物（道具・車） / 共同の持ち物 に振り分け
  const personalItems = preparations.filter((p) => p.type !== 'shared')
  const sharedItems = preparations.filter((p) => p.type === 'shared')

  const renderItem = (prep: Preparation) => (
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
      <span className="min-w-0 flex-1 truncate text-sm text-gray-800">
        {prep.type === 'car' && (
          <span aria-hidden className="mr-1">
            🚗
          </span>
        )}
        {prep.body}
      </span>
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
  )

  return (
    <section className="rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.03]">
      <SectionHeader title="持ち物・準備" />

      <div className="space-y-6 p-4">
        {/* ───────── 個人の持ち物 ───────── */}
        <div>
          <p className="mb-2 text-sm font-bold text-gray-700">🎒 個人の持ち物</p>
          {personalItems.length === 0 ? (
            <p className="rounded-lg bg-gray-50 px-4 py-4 text-center text-xs text-gray-400">
              まだありません
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100">
              {personalItems.map(renderItem)}
            </ul>
          )}

          {isParticipant && (
            <div className="mt-3 space-y-2">
              {/* プロフィールの登録から追加 */}
              {(gearChips.length > 0 || carChips.length > 0) && (
                <div className="flex flex-wrap gap-1.5">
                  {gearChips.map((gear) => (
                    <button
                      key={gear.id}
                      type="button"
                      disabled={submitting}
                      onClick={() => onAddItem(gear.name, 'gear')}
                      className="rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600 transition hover:border-green-400 hover:bg-green-50 hover:text-green-700 disabled:opacity-50"
                    >
                      ＋ 🎒 {gear.name}
                    </button>
                  ))}
                  {carChips.map((car) => (
                    <button
                      key={car.id}
                      type="button"
                      disabled={submitting}
                      onClick={() => onAddItem(carLabel(car), 'car')}
                      className="rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600 transition hover:border-green-400 hover:bg-green-50 hover:text-green-700 disabled:opacity-50"
                    >
                      ＋ 🚗 {carLabel(car)}
                    </button>
                  ))}
                </div>
              )}
              <form onSubmit={onAddPersonal} className="flex gap-2">
                <input
                  value={personalInput}
                  onChange={(event) => setPersonalInput(event.target.value)}
                  className={`${inputClass} flex-1`}
                  placeholder="自分が持っていく物（例: ランタン、まな板）"
                />
                <button
                  type="submit"
                  disabled={submitting || personalInput.trim() === ''}
                  className="btn-primary flex-shrink-0"
                >
                  個人の持ち物を追加
                </button>
              </form>
            </div>
          )}
        </div>

        {/* ───────── 共同の持ち物 ───────── */}
        <div className="border-t border-gray-100 pt-5">
          <p className="mb-2 text-sm font-bold text-gray-700">🤝 共同の持ち物（みんなで使う）</p>
          {sharedItems.length === 0 ? (
            <p className="rounded-lg bg-gray-50 px-4 py-4 text-center text-xs text-gray-400">
              まだありません
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 rounded-xl border border-green-200 bg-green-50/40">
              {sharedItems.map(renderItem)}
            </ul>
          )}

          {isParticipant && (
            <form onSubmit={onAddShared} className="mt-3 flex gap-2">
              <input
                value={sharedInput}
                onChange={(event) => setSharedInput(event.target.value)}
                className={`${inputClass} flex-1`}
                placeholder="みんなで使う物（例: テント、大鍋、タープ）"
              />
              <button
                type="submit"
                disabled={submitting || sharedInput.trim() === ''}
                className="btn-primary flex-shrink-0"
              >
                みんなで使うものを追加
              </button>
            </form>
          )}
        </div>

        {!isParticipant && (
          <p className="text-center text-xs text-gray-400">
            持ち物を登録できるのは、この計画に参加したメンバーだけです。
          </p>
        )}
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
  editingId,
  editForm,
  setEditForm,
  editSubmitting,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
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
  editingId: string | null
  editForm: {
    day: string
    time: string
    time_label: string
    location_name: string
    note: string
    transport: string
  }
  setEditForm: React.Dispatch<React.SetStateAction<{
    day: string
    time: string
    time_label: string
    location_name: string
    note: string
    transport: string
  }>>
  editSubmitting: boolean
  onStartEdit: (item: ScheduleItem) => void
  onCancelEdit: () => void
  onSaveEdit: (event: React.FormEvent<HTMLFormElement>) => void
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

                  // 編集中の行は、その場でフォームに切り替える
                  if (editingId === item.id) {
                    return (
                      <form
                        key={item.id}
                        onSubmit={onSaveEdit}
                        className="space-y-3 bg-green-50/40 px-4 py-4"
                      >
                        <p className="text-xs font-bold text-gray-600">行程を編集</p>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <input
                            type="date"
                            onClick={openDatePicker}
                            value={editForm.day}
                            onChange={(event) =>
                              setEditForm((current) => ({ ...current, day: event.target.value }))
                            }
                            className={inputClass}
                          />
                          <select
                            value={editForm.time}
                            onChange={(event) =>
                              setEditForm((current) => ({ ...current, time: event.target.value }))
                            }
                            className={inputClass}
                          >
                            <option value="">時刻未定</option>
                            {timeOptions.map((time) => (
                              <option key={time} value={time}>
                                {time}
                              </option>
                            ))}
                          </select>
                          <select
                            value={editForm.time_label}
                            onChange={(event) =>
                              setEditForm((current) => ({
                                ...current,
                                time_label: event.target.value,
                              }))
                            }
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
                        <input
                          value={editForm.location_name}
                          onChange={(event) =>
                            setEditForm((current) => ({
                              ...current,
                              location_name: event.target.value,
                            }))
                          }
                          className={inputClass}
                          placeholder="場所名"
                        />
                        <textarea
                          value={editForm.note}
                          onChange={(event) =>
                            setEditForm((current) => ({ ...current, note: event.target.value }))
                          }
                          className={`${inputClass} min-h-16 resize-y`}
                          placeholder="この場所の注釈（任意）"
                        />
                        <select
                          value={editForm.transport}
                          onChange={(event) =>
                            setEditForm((current) => ({
                              ...current,
                              transport: event.target.value,
                            }))
                          }
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
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            disabled={editSubmitting}
                            className="btn-primary flex-1"
                          >
                            {editSubmitting ? '保存中...' : '変更を保存'}
                          </button>
                          <button
                            type="button"
                            onClick={onCancelEdit}
                            className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-200"
                          >
                            キャンセル
                          </button>
                        </div>
                      </form>
                    )
                  }

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
                            <>
                              <button
                                onClick={() => onStartEdit(item)}
                                className="text-xs font-semibold text-gray-500 hover:text-green-700"
                              >
                                編集
                              </button>
                              <button
                                onClick={() => onDelete(item.id)}
                                className="text-xs font-semibold text-red-500 hover:text-red-700"
                              >
                                削除
                              </button>
                            </>
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
              onClick={openDatePicker}
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
  if (value === 'first_come') return '先着順＆時間締切'
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
