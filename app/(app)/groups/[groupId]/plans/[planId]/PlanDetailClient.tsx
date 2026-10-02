'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { createGoogleMapsSearchUrl } from '@/lib/maps'
import { formatJpDate, formatJpDateRange, formatJpDateTime } from '@/lib/formatDate'
import { pickMeetingItem } from '@/lib/meetingPoint'
import MeetingCard from '@/components/MeetingCard'
import FirstTimeNote from '@/components/FirstTimeNote'
import { useConfirm } from '@/components/ConfirmDialog'
import { useDialogDismiss } from '@/components/useDialogDismiss'
import { getMissingDocumentFields, type ProfileLike } from '@/lib/profileCompleteness'
import { useToast } from '@/components/Toast'
import { StatusBadge } from '@/components/StatusBadge'
import {
  getPlanPhase,
  isDeadlinePassed,
  isRecruitmentClosed,
  type PlanPhase,
} from '@/lib/recruitmentStatus'
import { toUserMessage } from '@/lib/errorMessage'

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
  /** going=参加 / maybe=未定 */
  status: string | null
  /** 集金が済んだ日時。null は未払い */
  paid_at: string | null
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



const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500'


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
  const confirm = useConfirm()
  const isCreator = plan.creator_id === currentUserId
  const missingProfileFields = getMissingDocumentFields(currentUserProfile)
  // 参加直後に持ち物・車を登録してもらうモーダル
  const [showPrepModal, setShowPrepModal] = useState(false)
  const closePrepModal = useCallback(() => setShowPrepModal(false), [])
  useDialogDismiss(closePrepModal, showPrepModal)
  const [selectedGearIds, setSelectedGearIds] = useState<string[]>([])
  const [selectedCarIds, setSelectedCarIds] = useState<string[]>([])
  const [prepSaving, setPrepSaving] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState<PlanStatus | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
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

  // 「未定」は定員の枠を埋めない。確定した人だけで数える
  const goingParticipants = participants.filter(
    (participant) => (participant.status ?? 'going') === 'going'
  )
  const maybeParticipants = participants.filter(
    (participant) => (participant.status ?? 'going') === 'maybe'
  )
  const capacityReached =
    recruitment?.capacity != null && goingParticipants.length >= recruitment.capacity
  // 締切は「時間締切」「先着順＆時間締切」の両方で使う
  const deadlinePassed = isDeadlinePassed(recruitment?.deadline)
  // 募集が締め切られていれば「実施前」、実施日を過ぎていれば「過去」に自動で移る
  const recruitmentClosed = isRecruitmentClosed(recruitment, goingParticipants.length)
  const phase: PlanPhase = getPlanPhase({
    status: plan.status,
    recruitmentClosed,
    startDate: plan.start_date,
    endDate: plan.end_date,
  })

  // 参加できるのは「募集中」フェーズのときだけ
  const canJoin = phase === 'recruiting' && !myParticipant

  // 当日の集合と、自分が持っていくもの（終わった計画では出さない）
  const meetingItem = phase === 'past' ? null : pickMeetingItem(scheduleItems)
  const myPreparationLabels = preparations
    .filter((preparation) => preparation.user_id === currentUserId)
    .map((preparation) => preparation.body ?? '')
    .filter((body) => body !== '')

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
      setServerError(toUserMessage(error, '状態の更新できませんでした。'))
      setUpdatingStatus(null)
      return
    }

    refreshAfterMutation()
    setUpdatingStatus(null)
  }



  /** 行程の編集を開始（その行の値をフォームに読み込む） */



  const joinPlan = async (status: 'going' | 'maybe' = 'going') => {
    // プロフィール未入力があれば、名簿が空欄になる旨を伝えてから参加させる
    if (missingProfileFields.length > 0) {
      const labels = missingProfileFields.map((field) => field.label).join('・')
      if (
        !(await confirm({
          title: 'プロフィールに未入力があります',
          message: `未入力：${labels}\n\nこのまま参加すると、計画書の名簿でこれらが空欄になります。`,
          confirmLabel: 'このまま参加する',
        }))
      ) {
        return
      }
    }

    setServerError(null)
    setSubmitting('participant')

    const { error } = await supabase.from('participants').insert({
      plan_id: plan.id,
      user_id: currentUserId,
      status,
    })

    if (error) {
      setServerError(toUserMessage(error, '参加登録できませんでした。'))
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

  /** 「未定」と「参加」を切り替える */
  const changeMyStatus = async (status: 'going' | 'maybe') => {
    if (!myParticipant) return
    setServerError(null)
    setSubmitting('participant')

    const { error } = await supabase
      .from('participants')
      .update({ status })
      .eq('id', myParticipant.id)

    if (error) {
      setServerError(toUserMessage(error, '変更できませんでした。'))
      setSubmitting(null)
      return
    }

    toast(status === 'going' ? '参加に変更しました' : '未定に変更しました')
    refreshAfterMutation()
    setSubmitting(null)
  }

  /** 集金の受け取りを記録する（起案者のみ） */
  const togglePaid = async (participant: Participant) => {
    setServerError(null)
    const { error } = await supabase
      .from('participants')
      .update({ paid_at: participant.paid_at ? null : new Date().toISOString() })
      .eq('id', participant.id)

    if (error) {
      setServerError(toUserMessage(error, '集金の記録を更新できませんでした。'))
      return
    }
    refreshAfterMutation()
  }

  const leavePlan = async () => {
    if (!myParticipant) return
    if (
      !(await confirm({
        title: 'この計画の参加をキャンセルしますか？',
        confirmLabel: 'キャンセルする',
        cancelLabel: 'やめる',
        tone: 'danger',
      }))
    ) {
      return
    }

    setServerError(null)
    setSubmitting('participant')

    const { error } = await supabase
      .from('participants')
      .delete()
      .eq('id', myParticipant.id)

    if (error) {
      setServerError(toUserMessage(error, '参加キャンセルできませんでした。'))
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
      setServerError(toUserMessage(error, 'レビューの保存できませんでした。'))
      setSubmitting(null)
      return
    }

    toast(myReview ? 'レビューを更新しました' : 'レビューを投稿しました')
    refreshAfterMutation()
    setSubmitting(null)
  }

  const deleteReview = async () => {
    if (!myReview) return
    if (
      !(await confirm({
        title: '自分のレビューを削除しますか？',
        confirmLabel: '削除する',
        tone: 'danger',
      }))
    ) {
      return
    }

    setServerError(null)
    setSubmitting('review')

    const { error } = await supabase.from('plan_reviews').delete().eq('id', myReview.id)

    if (error) {
      setServerError(toUserMessage(error, 'レビューの削除できませんでした。'))
      setSubmitting(null)
      return
    }

    setReviewForm({ body: '', cost: '' })
    toast('レビューを削除しました')
    refreshAfterMutation()
    setSubmitting(null)
  }

  // 募集を締め切る → 自動的に「実施前」フェーズへ進む
  const closeRecruitment = async () => {
    if (
      !(await confirm({
        title: '募集を締め切りますか？',
        message: '締め切ると「実施前」に進み、これ以上の参加はできなくなります。',
        confirmLabel: '締め切る',
      }))
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
      setServerError(toUserMessage(error, '募集の締め切りできませんでした。'))
      setSubmitting(null)
      return
    }

    toast('募集を締め切りました。「実施前」に進みます')
    refreshAfterMutation()
    setSubmitting(null)
  }

  /**
   * この計画をテンプレートとして保存する。
   * 一度うまくいった行程を、次の年もそのまま使えるようにするのが狙い。
   * 名前や説明はあとからテンプレート管理画面で直せるので、ここでは聞かない。
   */
  const saveAsTemplate = async () => {
    setServerError(null)
    setSubmitting('template')

    // 日付は「初日から何日目か」に直して保存する（日程が変わっても使えるように）
    const base = plan.start_date ? new Date(`${plan.start_date}T00:00:00`) : null
    const schedule = scheduleItems.map((item) => {
      let dayOffset = 0
      if (base && item.day) {
        const day = new Date(`${item.day}T00:00:00`)
        const diff = Math.round((day.getTime() - base.getTime()) / 86400000)
        dayOffset = diff > 0 ? diff : 0
      }
      return {
        dayOffset,
        time: item.time ? item.time.slice(0, 5) : '',
        time_label: item.time_label ?? '',
        location_name: item.location_name ?? '',
        note: item.note ?? '',
      }
    })

    const nights =
      plan.start_date && plan.end_date && plan.start_date !== plan.end_date
        ? Math.max(
            0,
            Math.round(
              (new Date(`${plan.end_date}T00:00:00`).getTime() -
                new Date(`${plan.start_date}T00:00:00`).getTime()) /
                86400000
            )
          )
        : 0

    const { error } = await supabase.from('plan_templates').insert({
      group_id: plan.group_id,
      created_by: currentUserId,
      name: plan.title,
      summary: plan.area ? `${plan.area}・${nights === 0 ? '日帰り' : `${nights}泊`}` : '',
      category: plan.category,
      nights,
      budget: plan.budget_per_person,
      transport: plan.default_transport,
      description: plan.description,
      schedule,
    })

    if (error) {
      setServerError(toUserMessage(error, 'テンプレートとして保存できませんでした。'))
      setSubmitting(null)
      return
    }

    toast('テンプレートに保存しました')
    setSubmitting(null)
  }

  const duplicatePlan = async () => {
    if (
      !(await confirm({
        title: 'この計画を複製しますか？',
        message:
          '複製した計画は「自分の計画」タブに未公開で追加されます（日程は未設定）。\n続けて日程などを編集できます。',
        confirmLabel: '複製する',
      }))
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
      setServerError(toUserMessage(error, '複製できませんでした。'))
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
      setServerError(toUserMessage(error, '持ち物の追加できませんでした。'))
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
          setServerError(toUserMessage(error, '持ち物の登録できませんでした。'))
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
      setServerError(toUserMessage(error, '削除できませんでした。'))
      return
    }
    refreshAfterMutation()
  }

  const deletePlan = async () => {
    if (
      !(await confirm({
        title: 'この計画を削除しますか？',
        message:
          '行程・募集・参加者・提出書類もすべて削除され、元に戻せません。',
        confirmLabel: '完全に削除する',
        tone: 'danger',
      }))
    ) {
      return
    }

    setServerError(null)
    setSubmitting('delete-plan')

    const { error } = await supabase.from('plans').delete().eq('id', plan.id)

    if (error) {
      setServerError(toUserMessage(error, '計画の削除できませんでした。'))
      setSubmitting(null)
      return
    }

    router.push(`/groups/${group.id}`)
    router.refresh()
  }


  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href={`/groups/${group.id}`} className="text-sm text-gray-500 hover:text-gray-700">
            ← 戻る
          </Link>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
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
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition-ui hover:border-green-400 hover:text-green-700 disabled:opacity-50"
            title="この計画をコピーして、自分の新しい計画（未公開）を作ります"
          >
            {submitting === 'duplicate' ? '複製中...' : '📋 自分の計画に複製'}
          </button>
          <button
            type="button"
            onClick={saveAsTemplate}
            disabled={submitting === 'template'}
            title="この行程をテンプレートとして保存し、次の計画づくりで使えるようにします"
            className="pressable rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:border-green-400 hover:text-green-700 disabled:opacity-50"
          >
            {submitting === 'template' ? '保存中...' : '⭐ テンプレートに保存'}
          </button>
          <Link
            href={`/groups/${group.id}/plans/${plan.id}/document`}
            className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm font-semibold text-green-700 transition-ui hover:bg-green-100"
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
            <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
              起案者
            </span>
          )}
        </div>

        {meetingItem && (
          <div className="mb-4">
            <MeetingCard
              item={meetingItem}
              myItems={myParticipant ? myPreparationLabels : []}
            />
          </div>
        )}

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
            onChange={updateStatus}
            onClose={closeRecruitment}
          />
        )}

        {/* 基本情報。編集は「計画を編集」画面に集約しているので、ここは表示だけ */}
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-gray-700">基本情報</h2>
          {isCreator && phase !== 'past' && (
            <Link
              href={`/groups/${group.id}/plans/${plan.id}/edit`}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition-ui hover:border-green-400 hover:text-green-700"
            >
              ✏️ 計画を編集
            </Link>
          )}
        </div>

        {/* 見やすさ優先で、基本情報は タイトル(見出し)・日程・場所・予算 のみ */}
        <dl className="grid gap-4 sm:grid-cols-3">
          <DetailItem label="日程" value={formatJpDateRange(plan.start_date, plan.end_date)} />
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
        editHref={`/groups/${group.id}/plans/${plan.id}/edit`}
      />

      <RecruitmentSection
        recruitment={recruitment}
        participants={participants}
        currentUserId={currentUserId}
        isCreator={isCreator}
        isParticipating={Boolean(myParticipant)}
        isCreatorParticipant={Boolean(myParticipant && isCreator)}
        canJoin={canJoin}
        capacityReached={capacityReached}
        deadlinePassed={deadlinePassed}
        submitting={submitting}
        onJoin={joinPlan}
        onLeave={leavePlan}
        onChangeStatus={changeMyStatus}
        onTogglePaid={togglePaid}
        goingCount={goingParticipants.length}
        maybeCount={maybeParticipants.length}
        budgetPerPerson={plan.budget_per_person}
        missingProfileFields={missingProfileFields}
        editHref={`/groups/${group.id}/plans/${plan.id}/edit`}
      />

      {/* 持ち物・準備は、募集を開始してから（募集中・実施前）だけ表示する */}
      {(phase === 'recruiting' || phase === 'in_progress') && (
        <PreparationSection
          planId={plan.id}
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

      {/* 中身は計画の削除だけ。以前は「この計画を管理」という名前で、
         中に何があるのか開くまで分からなかったので、そのまま名前にした。
         取り消せない操作なので、既定では畳んでおく。 */}
      {isCreator && (
        <details className="group rounded-2xl bg-white p-4 shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
            <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-sm font-bold text-gray-700">この計画を削除する</span>
              <span className="text-xs font-normal text-gray-500">起案者だけに見えます</span>
            </span>
            <span aria-hidden className="text-gray-400 transition-ui group-open:rotate-90">
              ›
            </span>
          </summary>

          <div className="mt-4">
            <div>
              <p className="text-xs leading-5 text-gray-500">
                行程・募集・参加者・提出書類がすべて削除されます。元に戻せません。
                <br />
                内容を直したいだけなら、上の「✏️ 計画を編集」を使ってください。
              </p>
              <button
                type="button"
                onClick={deletePlan}
                disabled={submitting === 'delete-plan'}
                className="pressable mt-3 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:border-red-400 hover:bg-red-50 disabled:opacity-50"
              >
                {submitting === 'delete-plan' ? '削除中...' : 'この計画を削除'}
              </button>
            </div>
          </div>
        </details>
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
//   未公開 →（募集開始）→ 募集中 →（締め切り/締切日時/定員）→ 実施前 →（実施日経過）→ 過去
// 戻す操作は用意しない。各フェーズで「次にやること」だけを提示する。
function StatusManager({
  phase,
  groupName,
  updatingStatus,
  closing,
  onChange,
  onClose,
}: {
  phase: PlanPhase
  groupName: string
  updatingStatus: PlanStatus | null
  closing: boolean
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
          <div className="mt-2">
            <FirstTimeNote id="plan-draft" label="未公開とは">
          <p className="text-sm leading-6 text-amber-800">
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
            <span className="rounded-full bg-white px-2 py-0.5 text-gray-500 ring-1 ring-gray-200">
              実施前
            </span>
            <span className="text-amber-300">→</span>
            <span className="rounded-full bg-white px-2 py-0.5 text-gray-500 ring-1 ring-gray-200">
              過去
            </span>
          </div>
            </FirstTimeNote>
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
          {/* 編集ボタンは、すぐ下の「基本情報」の横に1つだけ置く。
             同じボタンが近くに2つあると、どちらを押すのか迷うため。 */}
          <p className="mt-2 text-xs text-amber-700">
            公開したあとも、下の「✏️ 計画を編集」からいつでも直せます。
          </p>
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
          自動的に<strong>「実施前」</strong>へ進みます。
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
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
        <p className="text-sm font-bold text-indigo-800">「実施前」です</p>
        <p className="mt-1 text-xs leading-5 text-indigo-700">
          募集は締め切られ、参加者が確定しました。当日に向けて、行程や持ち物を確認しましょう。
          <strong>実施日（終了日）を過ぎると、自動的に「過去」へ移ります。</strong>
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
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
  currentUserId,
  isCreator,
  isParticipating,
  isCreatorParticipant,
  canJoin,
  capacityReached,
  deadlinePassed,
  submitting,
  onJoin,
  onLeave,
  onChangeStatus,
  onTogglePaid,
  goingCount,
  maybeCount,
  budgetPerPerson,
  missingProfileFields,
  editHref,
}: {
  recruitment: Recruitment | null
  participants: Participant[]
  currentUserId: string
  isCreator: boolean
  isParticipating: boolean
  isCreatorParticipant: boolean
  canJoin: boolean
  capacityReached: boolean
  deadlinePassed: boolean
  submitting: string | null
  onJoin: (status?: 'going' | 'maybe') => void
  onLeave: () => void
  onChangeStatus: (status: 'going' | 'maybe') => void
  onTogglePaid: (participant: Participant) => void
  goingCount: number
  maybeCount: number
  budgetPerPerson: number | null
  missingProfileFields: { label: string }[]
  editHref: string
}) {
  // 未定は定員に数えないので、確定した人数を主に出す
  const participantCountText =
    (recruitment?.capacity != null ? `${goingCount} / ${recruitment.capacity}人` : `${goingCount}人`) +
    (maybeCount > 0 ? `（未定 ${maybeCount}人）` : '')

  const myStatus = participants.find((participant) => participant.user_id === currentUserId)?.status ?? 'going'
  const unpaidCount = participants.filter(
    (participant) => (participant.status ?? 'going') === 'going' && participant.paid_at == null
  ).length

  return (
    <section className="rounded-2xl bg-white shadow-sm">
      <SectionHeader
        title="募集・参加"
        action={
          isCreator && !recruitment?.is_closed ? (
            <Link href={editHref} className="text-xs font-semibold text-green-700 hover:underline">
              募集設定を編集
            </Link>
          ) : null
        }
      />
      <div className="space-y-5 p-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <DetailItem label="募集方式" value={recruitmentTypeLabel(recruitment?.type)} />
          <DetailItem label="参加人数" value={participantCountText} />
          {recruitment?.deadline != null && (
            <DetailItem label="締切" value={formatJpDateTime(recruitment.deadline)} />
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
        </div>

        {/* 集金の進み具合。予算が設定されている計画でだけ出す */}
        {budgetPerPerson != null && isCreator && goingCount > 0 && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <p className="text-sm font-bold text-gray-700">
              集金：{goingCount - unpaidCount} / {goingCount}人
              <span className="ml-2 text-xs font-normal text-gray-500">
                （一人 {budgetPerPerson.toLocaleString()}円 / 残り{' '}
                {(unpaidCount * budgetPerPerson).toLocaleString()}円）
              </span>
            </p>
          </div>
        )}

        <div>
          <h3 className="mb-3 text-sm font-bold text-gray-700">参加者</h3>
          {participants.length === 0 ? (
            <p className="rounded-lg bg-gray-50 px-4 py-4 text-center text-sm text-gray-500">
              参加者はまだいません
            </p>
          ) : (
            <div className="divide-y divide-gray-100 rounded-lg border border-gray-100">
              {participants.map((participant) => (
                <div key={participant.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-gray-800">
                      <span className="truncate">
                        {participant.profiles?.name ?? '名前未設定'}
                      </span>
                      {participant.user_id === currentUserId && (
                        <span className="text-xs font-normal text-green-700">（あなた）</span>
                      )}
                      {(participant.status ?? 'going') === 'maybe' && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                          未定
                        </span>
                      )}
                    </p>
                    {/* 参加日時は誰も見ないうえ、人数ぶん並ぶと数字で画面が埋まるので出さない */}
                    <p className="text-xs text-gray-500">
                      {participant.position}
                      {participant.profiles?.grade != null
                        ? ` / ${participant.profiles.grade}年生`
                        : ''}
                    </p>
                  </div>

                  {/* 集金。起案者は受け取りを記録でき、他の人は自分の状態が見える */}
                  {budgetPerPerson != null && (participant.status ?? 'going') === 'going' && (
                    isCreator ? (
                      <button
                        type="button"
                        onClick={() => onTogglePaid(participant)}
                        className={`pressable flex-shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                          participant.paid_at
                            ? 'bg-green-100 text-green-700'
                            : 'border border-gray-300 text-gray-500'
                        }`}
                        title={participant.paid_at ? '取り消す' : '受け取ったことを記録する'}
                      >
                        {participant.paid_at ? '✓ 受取済み' : '未払い'}
                      </button>
                    ) : (
                      participant.user_id === currentUserId && (
                        <span
                          className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                            participant.paid_at
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {participant.paid_at ? '✓ 支払い済み' : '未払い'}
                        </span>
                      )
                    )
                  )}
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
            <>
              <button
                type="button"
                onClick={() => onJoin('going')}
                disabled={submitting === 'participant' || (!canJoin && !isCreator)}
                className="btn-primary flex-1 py-3 sm:flex-none sm:px-8"
              >
                {isCreator ? '起案者を参加登録' : '参加する'}
              </button>
              {!isCreator && (
                <button
                  type="button"
                  onClick={() => onJoin('maybe')}
                  disabled={submitting === 'participant' || !canJoin}
                  className="pressable rounded-xl border border-amber-300 bg-amber-50 px-5 py-3 text-sm font-semibold text-amber-800 hover:border-amber-400 disabled:opacity-50"
                  title="行けるか分からない場合はこちら。あとから変更できます"
                >
                  未定で登録
                </button>
              )}
            </>
          )}

          {/* 「未定」で登録した人が、あとから確定できるようにする */}
          {isParticipating && myStatus === 'maybe' && (
            <button
              type="button"
              onClick={() => onChangeStatus('going')}
              disabled={submitting === 'participant'}
              className="btn-primary flex-1 py-3 sm:flex-none sm:px-8"
            >
              参加に変更する
            </button>
          )}
          {isParticipating && myStatus === 'going' && !isCreatorParticipant && (
            <button
              type="button"
              onClick={() => onChangeStatus('maybe')}
              disabled={submitting === 'participant'}
              className="pressable rounded-xl px-3 py-3 text-sm font-semibold text-amber-700 underline-offset-4 hover:underline disabled:opacity-50"
            >
              未定に変更
            </button>
          )}
          {isParticipating && !isCreatorParticipant && (
            <button
              type="button"
              onClick={onLeave}
              disabled={submitting === 'participant'}
              className="pressable rounded-xl px-3 py-3 text-sm font-semibold text-red-500 underline-offset-4 hover:underline disabled:opacity-50"
            >
              参加をキャンセル
            </button>
          )}
        </div>

      </div>
    </section>
  )
}


/** 募集の設定（起案者のみ）。参加者には不要なので管理セクションに置く */

// 持ち物・準備：上に「個人の持ち物」、下に「共同の持ち物（みんなで使う）」を
// それぞれ独立した欄として表示し、各欄に追加ボタンを置く（見やすさ優先）。
function PreparationSection({
  planId,
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
  planId: string
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
  // AIによる持ち物の点検
  const [checking, setChecking] = useState(false)
  const [checkError, setCheckError] = useState<string | null>(null)
  const [checkResult, setCheckResult] = useState<{
    summary: string
    findings: { severity: 'warning' | 'info'; title: string; detail: string }[]
  } | null>(null)

  const runGearCheck = async () => {
    setCheckError(null)
    setChecking(true)
    try {
      const response = await fetch('/api/ai/gear-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      })
      const result = await response.json()
      if (!response.ok) {
        setCheckError(result.error ?? '点検に失敗しました')
      } else {
        setCheckResult(result)
      }
    } catch (error) {
      setCheckError(toUserMessage(error, '点検に失敗しました。通信を確認してもう一度お試しください。'))
    }
    setChecking(false)
  }

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
          <span className="text-xs text-gray-500">👤</span>
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
      <span className="flex-shrink-0 text-xs text-gray-500">
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

      {/* 足りない物は誰も気付けないので、AIに点検させる */}
      <div className="mb-4">
        <button
          type="button"
          onClick={runGearCheck}
          disabled={checking}
          className="pressable rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-700 hover:border-green-400 disabled:opacity-50"
        >
          {checking ? '点検中...' : '✨ 足りない物をチェック'}
        </button>

        {checkError && (
          <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{checkError}</p>
        )}

        {checkResult && (
          <div className="mt-3 rounded-xl border border-gray-200 bg-white p-3">
            <p className="text-xs font-bold text-gray-700">{checkResult.summary}</p>
            {checkResult.findings.length === 0 ? (
              <p className="mt-2 text-xs text-gray-500">
                特に足りない物は見つかりませんでした。
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {checkResult.findings.map((finding, index) => (
                  <li
                    key={index}
                    className={`rounded-lg px-3 py-2 text-xs ${
                      finding.severity === 'warning'
                        ? 'bg-amber-50 text-amber-900'
                        : 'bg-gray-50 text-gray-600'
                    }`}
                  >
                    <p className="font-bold">
                      {finding.severity === 'warning' ? '⚠️ ' : 'ℹ️ '}
                      {finding.title}
                    </p>
                    <p className="mt-0.5 leading-5">{finding.detail}</p>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-gray-500">
              AIの提案です。最終的な判断は自分たちで行ってください。
            </p>
          </div>
        )}
      </div>

      <div className="space-y-6 p-4">
        {/* ───────── 個人の持ち物 ───────── */}
        <div>
          <p className="mb-2 text-sm font-bold text-gray-700">🎒 個人の持ち物</p>
          {personalItems.length === 0 ? (
            <p className="rounded-lg bg-gray-50 px-4 py-4 text-center text-xs text-gray-500">
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
                      className="rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600 transition-ui hover:border-green-400 hover:bg-green-50 hover:text-green-700 disabled:opacity-50"
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
                      className="rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600 transition-ui hover:border-green-400 hover:bg-green-50 hover:text-green-700 disabled:opacity-50"
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
            <p className="rounded-lg bg-gray-50 px-4 py-4 text-center text-xs text-gray-500">
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
          <p className="text-center text-xs text-gray-500">
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
          <p className="rounded-lg bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
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
                      <span className="text-sm text-gray-500">👤</span>
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
              <label htmlFor="review-cost" className="mb-1 block text-xs font-medium text-gray-600">
                一人あたりの費用（円・任意）
              </label>
              <input
                id="review-cost"
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
                className="flex-1 rounded-lg bg-green-600 py-2.5 text-sm font-bold text-white transition-ui hover:bg-green-700 active:scale-[0.99] disabled:opacity-50"
              >
                {submitting ? '保存中...' : hasMyReview ? '更新する' : '投稿する'}
              </button>
              {hasMyReview && (
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={submitting}
                  className="rounded-lg border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 transition-ui hover:border-red-400 hover:bg-red-50 disabled:opacity-50"
                >
                  削除
                </button>
              )}
            </div>
          </form>
        ) : (
          <p className="border-t border-gray-100 pt-4 text-xs text-gray-500">
            レビューはこの計画に参加したメンバーが書けます。
          </p>
        )}
      </div>
    </section>
  )
}

/**
 * 行程表。表示だけを担当する。
 * 以前はここで追加・編集・削除までできたが、計画作成画面と二重になって
 * 「どこで直すのか」が分からなかったため、編集は編集画面に集約した。
 */
function ScheduleSection({
  items,
  defaultTransport,
  isCreator,
  editHref,
}: {
  items: ScheduleItem[]
  defaultTransport: string | null
  isCreator: boolean
  editHref: string
}) {
  const groupedItems = groupScheduleItemsByDay(items)

  return (
    <section className="rounded-2xl bg-white shadow-sm">
      <SectionHeader
        title="行程表"
        action={
          isCreator && items.length > 0 ? (
            <Link href={editHref} className="text-xs font-semibold text-green-700 hover:underline">
              編集
            </Link>
          ) : null
        }
      />

      {/* 全体の交通手段はここに1度だけ出す。
         以前は行ごとに同じ内容が並んでいて、くどかった。 */}
      {defaultTransport && items.length > 0 && (
        <p className="border-b border-gray-100 px-4 py-2 text-xs text-gray-600">
          交通手段は全体で <span className="font-semibold text-gray-800">{defaultTransport}</span>
          です
        </p>
      )}

      <div className="pb-2">
        {items.length === 0 ? (
          <div className="px-4 pb-4">
            <EmptyState text="行程はまだありません" />
            {isCreator && (
              <Link
                href={editHref}
                className="pressable mt-3 block rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-center text-xs font-semibold text-green-700 hover:border-green-400"
              >
                行程表をつくる
              </Link>
            )}
          </div>
        ) : (
          groupedItems.map((group) => (
            <div key={group.day ?? 'undated'}>
              <div className="bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700">
                {formatScheduleDayLabel(group.day)}
              </div>
              <div className="py-1">
                {group.items.map((item, index) => {
                  const mapQuery = item.map_query || item.location_name || ''
                  const mapUrl = createGoogleMapsSearchUrl(mapQuery)
                  const timeText = item.time?.slice(0, 5) || '未定'
                  // 全体と違う区間だけ注釈を出す。同じなら上の1行で足りる
                  const transportNote =
                    item.transport && item.transport !== defaultTransport ? item.transport : null
                  // タイムラインの縦線を、最初と最後で余らせないための判定
                  const isFirst = index === 0
                  const isLast = index === group.items.length - 1

                  return (
                    <div key={item.id} className="flex gap-3 px-4">
                      {/* 時刻 */}
                      <div className="w-12 flex-shrink-0 py-3 text-right text-xs font-bold tabular-nums text-gray-700">
                        {timeText}
                      </div>

                      {/* タイムラインの縦線と点 */}
                      <div className="relative flex w-3 flex-shrink-0 justify-center">
                        {!(isFirst && isLast) && (
                          <span
                            aria-hidden
                            className={`absolute w-px bg-gray-200 ${
                              isFirst ? 'bottom-0 top-4' : isLast ? 'top-0 h-4' : 'inset-y-0'
                            }`}
                          />
                        )}
                        <span
                          aria-hidden
                          className={`absolute top-3.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${
                            item.time_label === '集合' ? 'bg-green-500' : 'bg-gray-300'
                          }`}
                        />
                      </div>

                      <div className="min-w-0 flex-1 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-800">
                              <span className="min-w-0 break-words">
                                {item.location_name || '場所未設定'}
                              </span>
                              {item.time_label && (
                                <span className="flex-shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-600">
                                  {item.time_label}
                                </span>
                              )}
                            </p>
                            {item.note && (
                              <p className="mt-2 whitespace-pre-wrap rounded-lg bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-900">
                                {item.note}
                              </p>
                            )}
                            {transportNote && (
                              <p className="mt-1 text-xs text-gray-500">
                                ※ ここは {transportNote} で移動します
                              </p>
                            )}
                          </div>
                          {mapUrl && (
                            <a
                              href={mapUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="pressable flex-shrink-0 rounded-lg bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-100"
                            >
                              地図
                            </a>
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
    </section>
  )
}


function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
      <h2 className="text-sm font-bold text-gray-700">{title}</h2>
      {action}
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return <div className="p-8 text-center text-sm text-gray-500">{text}</div>
}

function DetailItem({ label, value }: { label: string; value: string | null | undefined }) {
  const filled = value != null && value !== ''
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wider text-gray-500">{label}</dt>
      {/* 「未設定」が並ぶと壊れて見えるので、空欄は静かなダッシュにする。
         起案者には見出しの横に編集ボタンがあるので、ここに導線は置かない。 */}
      <dd
        className={`mt-1 text-sm font-semibold ${filled ? 'text-gray-800' : 'text-gray-400'}`}
      >
        {filled ? value : '—'}
      </dd>
    </div>
  )
}

function recruitmentTypeLabel(value: string | null | undefined) {
  if (value === 'first_come') return '先着順＆時間締切'
  if (value === 'deadline') return '時間締切'
  return '未設定'
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
  return formatJpDate(value)
}
