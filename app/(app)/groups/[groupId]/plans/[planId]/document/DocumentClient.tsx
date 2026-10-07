'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { openDatePicker } from '@/lib/dateInput'
import {
  DEFAULT_RECIPIENT,
  buildApplicationTitle,
  buildLodgingLines,
  buildRoster,
  buildScheduleDays,
  formatPresence,
  formatWareki,
  formatWarekiRange,
  isOvernight,
  padRoster,
  type PlanDocumentData,
  type PlanDocumentFormValues,
  type ProfileRow,
} from '@/lib/planDocument'
import { getMissingDocumentFields } from '@/lib/profileCompleteness'
import { useToast } from '@/components/Toast'
import { useDialogDismiss } from '@/components/useDialogDismiss'
import {
  hasSource,
  isCustomRow,
  parseDocumentTemplate,
  resolveDocumentRows,
} from '@/lib/documentTemplate'
import FirstTimeNote from '@/components/FirstTimeNote'
import DocumentSheet from '@/components/DocumentSheet'
import SubmissionDeadlineNotice from '@/components/SubmissionDeadlineNotice'
import {
  ACTIVITY_KIND_OPTIONS,
  ACTIVITY_LOCATION_OPTIONS,
  getSubmissionRequirement,
  parseActivityKind,
  parseActivityLocation,
  type ActivityKind,
  type ActivityLocation,
  type SubmissionRequirement,
} from '@/lib/submissionRequirement'
import { toUserMessage } from '@/lib/errorMessage'

type DocumentStep = 'check' | 'input' | 'preview' | 'submit'

const STUDENT_AFFAIRS_EMAIL = 'jho-gakusei@jimu.kyutech.ac.jp'

type Group = {
  id: string
  name: string
  // 顧問教員はグループに1つ。計画書ごとに入れ直さなくて済むようにしている
  advisor_name: string | null
}

type Plan = {
  id: string
  group_id: string
  creator_id: string | null
  title: string
  status: string | null
  start_date: string | null
  end_date: string | null
  area: string | null
  default_transport: string | null
}

type ScheduleItem = {
  id: string
  day: string | null
  time: string | null
  sort_order: number | null
  time_label: string | null
  location_name: string | null
}

type Participant = {
  id: string
  user_id: string
  joined_at: string | null
  /** 車を出せるか。null は未回答 */
  brings_car: boolean | null
  profiles: ProfileRow | null
}

type PlanDocumentRow = {
  id: string
  plan_id: string
  created_date: string | null
  recipient: string | null
  place: string | null
  advisor_name: string | null
  lodging_name: string | null
  lodging_address: string | null
  notes: string | null
  custom_values: Record<string, string> | null
  apply_facility: boolean | null
  facility_name: string | null
  apply_event: boolean | null
  event_name: string | null
  outside_visitor_count: number | null
  submitted_at: string | null
  activity_location: string | null
  activity_kind: string | null
}

type Props = {
  group: Group
  plan: Plan
  scheduleItems: ScheduleItem[]
  participants: Participant[]
  /** 役職が「部長」のメンバー。代表者・責任者になる */
  leaderProfiles: ProfileRow[]
  defaultRepresentativeId: string | null
  planDocument: PlanDocumentRow | null
  previousDocument: PlanDocumentRow | null
  creatorProfile: ProfileRow | null
  /** グループが決めた様式。null なら標準様式 */
  documentTemplate: unknown
}

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500'

function todayIso() {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}


export default function DocumentClient({
  group,
  plan,
  scheduleItems,
  participants,
  leaderProfiles,
  defaultRepresentativeId,
  planDocument,
  previousDocument,
  creatorProfile,
  documentTemplate,
}: Props) {
  const supabase = createClient()
  const toast = useToast()
  // 計画書はグループのメンバーなら誰でも編集できる（分担して入力できるように）
  const canEdit = true
  // 保存状態（自動保存の進み具合を控えめに見せる）
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  // 作業は「入力 → 確認 → 提出」の一直線なので、画面もその順に分ける。
  // 現在位置をURLに持たせることで、戻る操作と再読み込みで位置が保たれる。
  const router = useRouter()
  const searchParams = useSearchParams()
  // 最初に「学生係に何を出すか」を確認する（活動場所 × 活動内容で決まる）
  const [activityLocation, setActivityLocation] = useState<ActivityLocation | null>(() =>
    parseActivityLocation(planDocument?.activity_location)
  )
  const [activityKind, setActivityKind] = useState<ActivityKind | null>(() =>
    parseActivityKind(planDocument?.activity_kind)
  )
  const requirement = getSubmissionRequirement(activityLocation, activityKind)
  // 未回答のとき・提出不要のときは、確認ステップから先へ進ませない
  const canProceed = requirement?.required === true
  const includeRoster = requirement?.roster ?? true

  const stepParam = searchParams.get('step')
  const step: DocumentStep = !canProceed
    ? 'check'
    : stepParam === 'check' ||
        stepParam === 'input' ||
        stepParam === 'preview' ||
        stepParam === 'submit'
      ? stepParam
      : 'input'

  const goToStep = (next: DocumentStep) => {
    router.replace(`?step=${next}`, { scroll: true })
  }

  // A4のプレビューは小さい画面に収まらないため、全画面で見せる
  const [previewOpen, setPreviewOpen] = useState(false)

  // グループが決めた様式（未設定なら標準様式）
  const templateRows = useMemo(
    () => parseDocumentTemplate(documentTemplate),
    [documentTemplate]
  )

  // 自分で足した項目に入力された値
  const [customValues, setCustomValues] = useState<Record<string, string>>(
    () => planDocument?.custom_values ?? {}
  )

  const setCustomValue = (key: string, value: string) =>
    setCustomValues((current) => ({ ...current, [key]: value }))
  const [generating, setGenerating] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [representativeId, setRepresentativeId] = useState<string | null>(
    defaultRepresentativeId
  )
  // 学生係へ提出した日時（提出期限の催促を止めるため）
  const [submittedAt, setSubmittedAt] = useState<string | null>(
    planDocument?.submitted_at ?? null
  )
  const [markingSubmitted, setMarkingSubmitted] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  // この計画にまだ書類が無いとき、同グループの直近の書類から引き継ぐ
  // （初期値のみ。作成日・企画名・場所・学外者・その他報告事項は計画ごとに違うので除く）
  const base = planDocument ?? previousDocument
  const carriedOver = !planDocument && previousDocument != null
  const [form, setForm] = useState<PlanDocumentFormValues>({
    created_date: planDocument?.created_date ?? todayIso(),
    recipient: base?.recipient ?? DEFAULT_RECIPIENT,
    apply_facility: base?.apply_facility ?? false,
    facility_name: base?.facility_name ?? '',
    apply_event: base?.apply_event ?? true,
    event_name: planDocument?.event_name ?? '',
    // 場所は計画書に入っていればそれを、無ければ計画の「場所エリア」を初期値にする
    place: planDocument?.place ?? plan.area ?? '',
    outside_visitor_count: planDocument?.outside_visitor_count ?? 0,
    lodging_name: base?.lodging_name ?? '',
    lodging_address: base?.lodging_address ?? '',
    notes: planDocument?.notes ?? '',
  })

  const setField = <K extends keyof PlanDocumentFormValues>(
    key: K,
    value: PlanDocumentFormValues[K]
  ) => setForm((current) => ({ ...current, [key]: value }))

  // 顧問はグループの登録を優先。古い計画書しか無い場合はそれを引き継ぐ
  const advisorName = group.advisor_name ?? base?.advisor_name ?? ''
  const overnight = isOvernight(plan.start_date, plan.end_date)

  // 代表者・責任者は役職が「部長」の人（複数いれば選んだ人）
  const representative =
    leaderProfiles.find((profile) => profile.id === representativeId) ??
    leaderProfiles[0] ??
    null

  // 入構車両: 参加するときに「車を出せる」と答えた人の数
  const carParticipants = participants.filter((participant) => participant.brings_car === true)
  const unansweredCarParticipants = participants.filter(
    (participant) => participant.brings_car == null
  )

  // フォームの値と参加者情報から、プレビュー/PDF 共通のデータを組み立てる
  const documentBase: Omit<PlanDocumentData, 'rows'> = useMemo(
    () => ({
      createdDateLabel: formatWareki(form.created_date),
      recipient: form.recipient,
      groupName: group.name,
      representativeName: representative?.name ?? '',
      advisorName,
      applicationTitle: buildApplicationTitle(form, plan.title),
      responsible: {
        name: representative?.name ?? '',
        studentId: representative?.student_id ?? '',
        phone: representative?.phone ?? '',
        email: representative?.school_email ?? '',
      },
      drafterName: creatorProfile?.name ?? '',
      title: plan.title,
      dateRangeLabel: formatWarekiRange(plan.start_date, plan.end_date),
      place: form.place.trim() || plan.area || '',
      scheduleDays: buildScheduleDays(scheduleItems),
      vehiclesLabel: formatPresence(carParticipants.length, '台'),
      outsideVisitorsLabel: formatPresence(form.outside_visitor_count, '人'),
      lodgingLines: buildLodgingLines(form, overnight),
      notes: form.notes,
      participantCountLabel: `${participants.length}人`,
      roster: buildRoster(participants),
      includeRoster,
    }),
    [
      form,
      group.name,
      plan,
      scheduleItems,
      participants,
      carParticipants.length,
      representative,
      advisorName,
      overnight,
      creatorProfile,
      includeRoster,
    ]
  )

  // 様式に沿って、表に出す行を組み立てる。
  // プレビュー・PDF・Excel はいずれもこの rows から描く。
  const documentData: PlanDocumentData = useMemo(
    () => ({
      ...documentBase,
      rows: resolveDocumentRows(templateRows, documentBase, customValues),
    }),
    [documentBase, templateRows, customValues]
  )

  // 提出前チェック（1）計画書そのものの未入力。
  // 顧問・部長はグループ側で直すので、直す場所が分かるように書いておく
  const representativeMissing = representative
    ? getMissingDocumentFields(representative, { isLeader: true }).map(
        (field) => `部長の${field.label}`
      )
    : ['部長（グループで役職を設定）']
  const missingDocumentFields = [
    { label: '顧問教員（グループ設定）', filled: advisorName.trim() !== '' },
    { label: '表題（利用許可願・企画のどちらか）', filled: form.apply_facility || form.apply_event },
    {
      label: '利用する施設',
      filled: !form.apply_facility || form.facility_name.trim() !== '',
    },
    { label: '場所', filled: documentBase.place.trim() !== '' },
    { label: '内容（行程表）', filled: documentBase.scheduleDays.length > 0 },
    { label: '宿泊先', filled: !overnight || form.lodging_name.trim() !== '' },
  ]
    .filter((field) => !field.filled)
    .map((field) => field.label)
    .concat(representativeMissing)

  // 提出前チェック（2）参加者ごとに、名簿で空欄になる項目を洗い出す
  const incompleteParticipants = participants
    .map((participant) => ({
      name: participant.profiles?.name ?? '名前未設定',
      missing: getMissingDocumentFields(participant.profiles).map((field) => field.label),
    }))
    .filter((entry) => entry.missing.length > 0)

  // 入力が止まってから自動で保存する。
  // 項目が多く、スマホで埋めている途中に離脱すると全部消えていたため、
  // 「保存ボタンを押し忘れる」という事故そのものを無くす。
  // 旧様式の欄（顧問の所属・病院・移動手段など）は送らない＝保存済みの値はそのまま残る。
  const persistDocument = useCallback(async () => {
    setSaveState('saving')

    const { error } = await supabase.from('plan_documents').upsert(
      {
        plan_id: plan.id,
        created_date: form.created_date || null,
        recipient: form.recipient || null,
        apply_facility: form.apply_facility,
        facility_name: form.facility_name || null,
        apply_event: form.apply_event,
        event_name: form.event_name || null,
        place: form.place || null,
        outside_visitor_count: Math.max(0, Math.floor(form.outside_visitor_count) || 0),
        lodging_name: form.lodging_name || null,
        lodging_address: form.lodging_address || null,
        notes: form.notes || null,
        custom_values: customValues,
        representative_user_id: representativeId,
        activity_location: activityLocation,
        activity_kind: activityKind,
      },
      { onConflict: 'plan_id' }
    )

    if (error) {
      setSaveState('error')
      setMessage({ type: 'error', text: toUserMessage(error, '保存できませんでした。') })
      return
    }

    setMessage(null)
    setSaveState('saved')
  }, [supabase, plan.id, form, representativeId, customValues, activityLocation, activityKind])

  // 初回描画では保存しない（読み込んだ内容をそのまま書き戻さないため）
  const skipFirstSave = useRef(true)

  useEffect(() => {
    if (skipFirstSave.current) {
      skipFirstSave.current = false
      return
    }
    const timer = window.setTimeout(() => {
      void persistDocument()
    }, 1500)
    return () => window.clearTimeout(timer)
  }, [persistDocument])

  /** 学生係へ提出したことを記録する（取り消しもできる） */
  const toggleSubmitted = async () => {
    setMarkingSubmitted(true)
    const next = submittedAt ? null : new Date().toISOString()
    const { error } = await supabase
      .from('plan_documents')
      .upsert({ plan_id: plan.id, submitted_at: next }, { onConflict: 'plan_id' })
    setMarkingSubmitted(false)
    if (error) {
      setMessage({ type: 'error', text: toUserMessage(error, '記録できませんでした。') })
      return
    }
    setSubmittedAt(next)
    toast(next ? '提出済みにしました' : '提出済みを取り消しました')
    router.refresh()
  }

  /** ファイルをダウンロードさせる共通処理 */
  const saveBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
    URL.revokeObjectURL(url)
  }

  // Excel（1ファイル・2シート：計画書／参加者名簿）
  const downloadExcel = async () => {
    setMessage(null)
    setExporting(true)
    try {
      const { generatePlanDocumentExcel } = await import('@/lib/excel/planDocumentExcel')
      const blob = await generatePlanDocumentExcel(documentData)
      saveBlob(blob, `計画書_${plan.title || 'plan'}.xlsx`)
      toast('Excelを作成しました')
    } catch (error) {
      const text =
        'Excelの生成に失敗しました: ' +
        (error instanceof Error ? error.message : String(error))
      setMessage({ type: 'error', text })
      toast('Excelの生成に失敗しました', 'error')
    }
    setExporting(false)
  }

  const downloadPdf = async () => {
    setMessage(null)
    setGenerating(true)
    try {
      // PDF 生成モジュールはサイズが大きいのでクリック時に読み込む
      const { generatePlanDocumentPdf } = await import('@/lib/pdf/planDocumentPdf')
      const blob = await generatePlanDocumentPdf(documentData)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `計画書_${plan.title || 'plan'}.pdf`
      anchor.click()
      URL.revokeObjectURL(url)
      toast('PDFを作成しました')
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'PDFの生成に失敗しました: ' + (error instanceof Error ? error.message : String(error)),
      })
      toast('PDFの生成に失敗しました', 'error')
    }
    setGenerating(false)
  }

  // 提出メールの定型文（データから自動生成。送信はせず、コピーして各自のメールソフトで使う）
  // 宛先は学生係。添付するものは「何を出すか」の答えで変わる
  const documentLabel = includeRoster ? '企画書・参加者名簿' : '企画書'
  const attachments = [
    `${documentLabel}（PDF）`,
    requirement?.advisorMail && '顧問教員から確認を得たメール等のスクリーンショット',
    requirement?.tournamentNote &&
      '（大会・イベントに参加する場合）大会要項など詳細が分かるもの',
  ].filter((item): item is string => Boolean(item))

  const mailSubject = `【企画書提出】${documentData.applicationTitle || documentData.title}（${documentData.groupName}）`
  const mailBody = [
    '情報工学部 学生係 御中',
    '',
    `お世話になっております。${documentData.groupName}の${documentData.drafterName || documentData.responsible.name}です。`,
    `下記の活動について、${documentLabel}を提出いたします。`,
    'ご確認のほど、よろしくお願いいたします。',
    '',
    `■ 表題：${documentData.applicationTitle}`,
    `■ 日時：${documentData.dateRangeLabel}`,
    `■ 場所：${documentData.place}`,
    ...(includeRoster ? [`■ 参加人数：${documentData.participantCountLabel}`] : []),
    '',
    '【添付】',
    ...attachments.map((item) => `・${item}`),
    '',
    '——',
    documentData.groupName,
    `責任者：${documentData.responsible.name}`,
    documentData.responsible.email,
  ].join('\n')

  const mailSteps = [
    `上の「PDFで出力」で${documentLabel}のPDFをダウンロードする`,
    requirement?.advisorMail &&
      '顧問教員に活動内容を伝えて確認をもらい、そのメール等のスクリーンショットを撮る（「先生の承認済み」と書くだけでは認められません）',
    requirement?.tournamentNote &&
      '大会やイベントに参加する場合は、大会要項など詳細が分かるものを用意する',
    'メールソフト（Gmail・大学メールなど）で新規メールを作成し、宛先に学生係のアドレスを入れる',
    '下の「件名」「本文」をコピーして貼り付ける（内容は必要に応じて調整）',
    '添付するものをすべて付けて送信する',
    '送信したら、上の「学生係へ提出した」を押す',
  ].filter((item): item is string => Boolean(item))

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast(`${label}をコピーしました`)
    } catch {
      toast('コピーに失敗しました', 'error')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <Link
            href={`/groups/${group.id}/plans/${plan.id}`}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← 計画に戻る
          </Link>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              {group.name}
            </p>
            <h1 className="text-xl font-bold text-gray-800">計画書（学校提出用）</h1>
          </div>
        </div>
        <SaveIndicator state={saveState} />
      </div>

      <StepNav step={step} onChange={goToStep} locked={!canProceed} />

      {/* 学生係への提出期限（実施日の7営業日前）。どのステップでも見えるようにする */}
      {requirement?.required !== false && (
        <SubmissionDeadlineNotice startDate={plan.start_date} submittedAt={submittedAt} />
      )}

      {message && (
        <p
          className={`rounded-lg px-3 py-2 text-sm print:hidden ${
            message.type === 'ok'
              ? 'bg-green-50 text-green-700'
              : 'bg-red-50 text-red-600'
          }`}
        >
          {message.text}
        </p>
      )}

      {/* 提出前チェック：確認ステップでまとめて出す */}
      {step === 'preview' && includeRoster && participants.length > 0 && (
        <div className="print:hidden">
          {incompleteParticipants.length === 0 ? (
            <p className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
              参加者全員のプロフィールがそろっています。提出準備OKです。
            </p>
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-bold text-amber-800">
                名簿に未入力の項目があります（{incompleteParticipants.length}名）
              </p>
              <ul className="mt-2 space-y-1">
                {incompleteParticipants.map((entry) => (
                  <li key={entry.name} className="text-xs leading-5 text-amber-700">
                    <span className="font-semibold">{entry.name}</span>：
                    {entry.missing.join('・')}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-amber-700">
                本人がプロフィール画面で入力すると、自動で反映されます。
              </p>
            </div>
          )}
        </div>
      )}

      {/* 0. 学生係に何を出すか（活動場所 × 活動内容）。答えるまで先へ進めない */}
      {step === 'check' && (
        <section className="space-y-5 rounded-2xl bg-white p-5 shadow-sm print:hidden">
          <div>
            <h2 className="text-sm font-bold text-gray-700">学生係に何を出すか確認する</h2>
            <p className="mt-1 text-xs leading-5 text-gray-500">
              学生係の「活動内容ごとの提出書類一覧」に沿って、この計画で必要な書類を決めます。
              答えは計画ごとに保存され、あとから変えられます。
            </p>
          </div>

          <ChoiceGroup
            legend="活動場所"
            options={ACTIVITY_LOCATION_OPTIONS}
            value={activityLocation}
            onChange={setActivityLocation}
          />
          <ChoiceGroup
            legend="活動内容"
            options={ACTIVITY_KIND_OPTIONS}
            value={activityKind}
            onChange={setActivityKind}
          />
          <p className="text-xs leading-5 text-gray-500">
            「通常の活動」はサークル本来の目的に沿った活動（キャンプ・練習・大会など）、
            「通常と異なる活動」はそれ以外（合宿・親睦会・地域イベントへの参加など）です。
          </p>

          {requirement && <RequirementSummary requirement={requirement} />}

          {requirement?.required ? (
            <button type="button" onClick={() => goToStep('input')} className="btn-primary w-full">
              内容の入力へ →
            </button>
          ) : (
            requirement && (
              <p className="rounded-lg bg-green-50 px-3 py-2 text-sm font-semibold text-green-700">
                この計画は、学生係への提出は不要です。提出期限のお知らせも出ません。
              </p>
            )
          )}
        </section>
      )}

      {/* 入力フォーム（グループのメンバーなら誰でも編集できる） */}
      {step === 'input' && (
        <section className="space-y-5 rounded-2xl bg-white p-5 shadow-sm print:hidden">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-sm font-bold text-gray-700">手入力する項目</h2>
            <Link
              href={`/groups/${group.id}/document-template`}
              className="pressable flex-shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:border-green-400 hover:text-green-700"
            >
              様式を編集
            </Link>
          </div>
          <div>
            <p className="mt-1 text-xs text-gray-500">
              日時・内容・入構車両・参加者名簿などは、計画と参加者のプロフィールから自動反映されます。
              グループのメンバーなら<strong>誰でも編集・保存できます</strong>（分担して入力できます）。
            </p>
            {carriedOver && (
              <p className="mt-2 rounded-lg bg-green-50 px-3 py-2 text-xs leading-5 text-green-700">
                宛先・表題の種類・宿泊先などを、<strong>前回の計画書から引き継ぎ</strong>ました。
                内容を確認して、今回に合わせて修正してください。
              </p>
            )}
          </div>

          {/* 新様式では、代表者氏名と【責任者】に役職「部長」の人がそのまま入る */}
          <FormBlock title="代表者・責任者（部長）">
            {leaderProfiles.length > 1 && (
              <Field label="部長が複数いるため、載せる人を選んでください">
                <select
                  value={representative?.id ?? ''}
                  onChange={(event) => setRepresentativeId(event.target.value || null)}
                  className={inputClass}
                  disabled={!canEdit}
                >
                  {leaderProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {/* 学籍番号などは本人のプロフィールから入る。
               ここに欄が無い理由が分からないと探してしまうので、出どころを書く。 */}
            <FixedInfo
              rows={[
                { label: '団体名', value: group.name },
                { label: '代表者氏名', value: documentBase.responsible.name },
                { label: '学籍番号', value: documentBase.responsible.studentId },
                { label: 'TEL', value: documentBase.responsible.phone },
                { label: 'Mail', value: documentBase.responsible.email },
              ]}
              note={
                representative
                  ? 'グループで役職が「部長」の人が自動で入ります。学籍番号・TEL・Mail は部長本人のプロフィールから入ります。'
                  : 'グループに役職が「部長」の人がいません。グループのメンバー一覧で部長を設定してください。'
              }
              href={representative ? '/profile' : `/groups/${group.id}`}
              linkLabel={representative ? 'プロフィールを開く' : 'メンバー一覧を開く'}
            />
          </FormBlock>

          {/* 顧問は滅多に変わらないので、グループに1つ登録して使い回す。 */}
          <FormBlock title="顧問教員">
            <FixedInfo
              rows={[{ label: '氏名', value: advisorName }]}
              note="グループに登録した顧問教員が、すべての計画書に自動で入ります。"
              href={`/groups/${group.id}/advisor`}
              linkLabel={advisorName.trim() === '' ? '顧問教員を登録する' : 'グループ設定で変更'}
            />
          </FormBlock>

          {/* 表題「○○利用許可願・○○企画」。どちらか、または両方を選ぶ */}
          <FormBlock title="表題">
            <div className="space-y-2">
              <CheckField
                checked={form.apply_facility}
                onChange={(checked) => setField('apply_facility', checked)}
                label="施設の利用許可願"
                disabled={!canEdit}
              >
                <div className="flex items-center gap-2">
                  <input
                    value={form.facility_name}
                    onChange={(event) => setField('facility_name', event.target.value)}
                    className={inputClass}
                    placeholder="記入例) 講義室・体育館"
                    disabled={!canEdit || !form.apply_facility}
                  />
                  <span className="flex-shrink-0 text-sm text-gray-600">利用許可願</span>
                </div>
              </CheckField>
              <CheckField
                checked={form.apply_event}
                onChange={(checked) => setField('apply_event', checked)}
                label="企画"
                disabled={!canEdit}
              >
                <div className="flex items-center gap-2">
                  <input
                    value={form.event_name}
                    onChange={(event) => setField('event_name', event.target.value)}
                    className={inputClass}
                    placeholder={plan.title}
                    disabled={!canEdit || !form.apply_event}
                  />
                  <span className="flex-shrink-0 text-sm text-gray-600">企画</span>
                </div>
              </CheckField>
            </div>
            <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm">
              <span className="text-xs text-gray-500">計画書の表題：</span>
              <span className="font-semibold text-gray-800">
                {documentBase.applicationTitle || 'どちらかを選んでください'}
              </span>
            </p>
            <p className="text-xs leading-5 text-gray-500">
              学内の施設（講義室・体育館など）を使うときは「利用許可願」を選びます。両方選ぶこともできます。
              企画名が空欄なら、計画の行事名が入ります。
            </p>
          </FormBlock>

          <FormBlock title="基本">
            <Field label="計画書の作成日">
              <input
                type="date"
                onClick={openDatePicker}
                value={form.created_date}
                onChange={(event) => setField('created_date', event.target.value)}
                className={inputClass}
                disabled={!canEdit}
              />
            </Field>
            <Field label="宛先">
              <input
                value={form.recipient}
                onChange={(event) => setField('recipient', event.target.value)}
                className={inputClass}
                disabled={!canEdit}
              />
            </Field>
            <Field label="場所">
              <input
                value={form.place}
                onChange={(event) => setField('place', event.target.value)}
                className={inputClass}
                placeholder="記入例) 大分県竹田市 久住高原（沢水キャンプ場）"
                disabled={!canEdit}
              />
              <p className="mt-1 text-xs text-gray-500">
                計画の「場所エリア」が初めから入っています。提出用に詳しく書きたいときは、ここで直せます。
              </p>
            </Field>
            <FixedInfo
              rows={[
                { label: '日時', value: documentBase.dateRangeLabel },
                {
                  label: '内容',
                  value:
                    documentBase.scheduleDays.length > 0
                      ? `行程表から自動で入ります（${documentBase.scheduleDays.length}日分）`
                      : '',
                },
              ]}
              note="日時と内容（詳細に）は、計画の日程と行程表がそのまま入ります。"
              href={`/groups/${group.id}/plans/${plan.id}/edit`}
              linkLabel="計画を編集"
            />
          </FormBlock>

          {hasSource(templateRows, 'vehicles') && (
            <FormBlock title="入構車両">
              <p className="text-sm text-gray-800">
                計画書には <strong>{documentBase.vehiclesLabel}</strong> と載ります。
              </p>
              <p className="text-xs leading-5 text-gray-500">
                大学に集合するため、参加者が参加するときに答えた「車を出せるか」から自動で数えます。
                {carParticipants.length > 0 &&
                  `（車を出す人：${carParticipants
                    .map((participant) => participant.profiles?.name ?? '名前未設定')
                    .join('・')}）`}
              </p>
              {unansweredCarParticipants.length > 0 && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                  まだ答えていない人がいます（
                  {unansweredCarParticipants
                    .map((participant) => participant.profiles?.name ?? '名前未設定')
                    .join('・')}
                  ）。計画のページで回答してもらってください。
                </p>
              )}
            </FormBlock>
          )}

          {hasSource(templateRows, 'outsideVisitors') && (
            <FormBlock title="来校予定の学外者">
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-1.5 text-sm text-gray-700">
                  <input
                    type="radio"
                    checked={form.outside_visitor_count === 0}
                    onChange={() => setField('outside_visitor_count', 0)}
                    disabled={!canEdit}
                    className="h-4 w-4"
                  />
                  無
                </label>
                <label className="flex items-center gap-1.5 text-sm text-gray-700">
                  <input
                    type="radio"
                    checked={form.outside_visitor_count > 0}
                    onChange={() => setField('outside_visitor_count', 1)}
                    disabled={!canEdit}
                    className="h-4 w-4"
                  />
                  有
                </label>
                {form.outside_visitor_count > 0 && (
                  <label className="flex items-center gap-1.5 text-sm text-gray-700">
                    <input
                      type="number"
                      min={1}
                      value={form.outside_visitor_count}
                      onChange={(event) =>
                        setField(
                          'outside_visitor_count',
                          Math.max(1, Math.floor(Number(event.target.value)) || 1)
                        )
                      }
                      className={`${inputClass} w-24`}
                      disabled={!canEdit}
                    />
                    人
                  </label>
                )}
              </div>
            </FormBlock>
          )}

          {hasSource(templateRows, 'lodging') && (
            <FormBlock title="宿泊">
              {overnight ? (
                <>
                  <p className="text-xs text-gray-500">
                    日程が{documentBase.dateRangeLabel}のため「有」になります。
                  </p>
                  <Field label="宿泊先">
                    <input
                      value={form.lodging_name}
                      onChange={(event) => setField('lodging_name', event.target.value)}
                      className={inputClass}
                      placeholder="記入例) ○○キャンプ場"
                      disabled={!canEdit}
                    />
                  </Field>
                  <Field label="宿泊先の住所（任意）">
                    <input
                      value={form.lodging_address}
                      onChange={(event) => setField('lodging_address', event.target.value)}
                      className={inputClass}
                      placeholder="記入例) ○○県○○市○○町1-2-3"
                      disabled={!canEdit}
                    />
                  </Field>
                </>
              ) : (
                <p className="text-sm text-gray-700">日帰りのため「無」になります。</p>
              )}
            </FormBlock>
          )}

          {hasSource(templateRows, 'notes') && (
            <FormBlock title="その他報告事項">
              <textarea
                value={form.notes}
                onChange={(event) => setField('notes', event.target.value)}
                className={`${inputClass} min-h-20 resize-y`}
                placeholder="記入例) 雨天時は中止し、後日改めて実施予定"
                disabled={!canEdit}
              />
            </FormBlock>
          )}

          {/* このグループが様式に足した項目 */}
          {templateRows.filter(isCustomRow).length > 0 && (
            <FormBlock title="このグループで追加した項目">
              {templateRows.filter(isCustomRow).map((row) => (
                <Field key={row.key} label={row.label}>
                  <input
                    value={customValues[row.key] ?? ''}
                    onChange={(event) => setCustomValue(row.key, event.target.value)}
                    className={inputClass}
                    disabled={!canEdit}
                  />
                </Field>
              ))}
            </FormBlock>
          )}

          {canEdit && (
            <button type="button" onClick={() => goToStep('preview')} className="btn-primary w-full">
              見た目を確認する →
            </button>
          )}
        </section>
      )}

      {step === 'preview' && (
        <section className="min-w-0 print:hidden">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500">
              {includeRoster
                ? 'PDFは2ページ構成（企画書＋参加者名簿）で出力されます'
                : '学内の活動なので、PDFは企画書の1ページだけです（名簿は不要）'}
            </p>
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="pressable rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:border-green-400 hover:text-green-700"
            >
              原寸で見る
            </button>
          </div>

          {/* A4はスマホ幅に収まらないため、小さい画面では全画面表示に誘導する */}
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-5 text-center lg:hidden">
            <p className="text-sm font-semibold text-gray-700">
              プレビューはA4サイズです
            </p>
            <p className="mt-1 text-xs leading-5 text-gray-500">
              この画面幅では文字が小さくなるため、全画面で表示します。
            </p>
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="btn-primary mt-3"
            >
              プレビューを開く
            </button>
          </div>

          <div className="hidden overflow-x-auto lg:block">
            <div className="space-y-6">
              <DocumentSheet data={documentData} />
              {includeRoster && <RosterSheet data={documentData} />}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => goToStep('input')} className="btn-secondary">
              ← 入力に戻る
            </button>
            <button type="button" onClick={() => goToStep('submit')} className="btn-primary">
              提出の準備へ →
            </button>
          </div>
        </section>
      )}

      {/* 印刷のときだけ現れる本体（どのステップにいても印刷できるようにする） */}
      <div className="hidden print:block" id="plan-document-sheets">
        <DocumentSheet data={documentData} />
        {includeRoster && <RosterSheet data={documentData} />}
      </div>

      {/* 提出ステップ: ここで初めて出力できる */}
      {step === 'submit' && (
        <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm print:hidden">
          <h2 className="text-sm font-bold text-gray-700">書類を出力する</h2>

          {(missingDocumentFields.length > 0 || (includeRoster && participants.length === 0)) && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
              未入力のまま出力できますが、
              {includeRoster && participants.length === 0 && '参加者が0人です。'}
              {missingDocumentFields.length > 0 &&
                `${missingDocumentFields.join('・')}が空欄です。`}
            </p>
          )}
          {unansweredCarParticipants.length > 0 && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
              車を出せるか答えていない人が{unansweredCarParticipants.length}人います。
              入構車両の台数が変わる可能性があります。
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={downloadPdf} disabled={generating} className="btn-primary">
              {generating ? 'PDFを生成中...' : 'PDFで出力'}
            </button>
            <button
              type="button"
              onClick={downloadExcel}
              disabled={exporting}
              className="btn-secondary"
            >
              {exporting ? 'Excelを生成中...' : 'Excelで出力'}
            </button>
            <button type="button" onClick={() => window.print()} className="btn-secondary">
              印刷
            </button>
          </div>

          {/* 提出したら記録しておく。ホームや計画のページの催促が止まる */}
          <div className="rounded-xl border border-gray-100 p-3">
            <p className="text-xs leading-5 text-gray-500">
              学生係へ提出したら、記録しておくと提出期限のお知らせが止まります。
            </p>
            <button
              type="button"
              onClick={toggleSubmitted}
              disabled={markingSubmitted}
              className={`mt-2 ${submittedAt ? 'btn-secondary' : 'btn-primary'}`}
            >
              {markingSubmitted
                ? '記録中...'
                : submittedAt
                  ? '提出済みを取り消す'
                  : '学生係へ提出した'}
            </button>
          </div>

          <button type="button" onClick={() => goToStep('preview')} className="btn-secondary">
            ← 確認に戻る
          </button>
        </section>
      )}

      {/* メールで提出する方法（送信はせず、手順とコピペ用の定型文を案内） */}
      {step === 'submit' && (
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/[0.03] print:hidden">
        <h2 className="text-sm font-bold text-gray-700">メールで学生係へ提出する</h2>
        <p className="mt-1 text-xs leading-5 text-gray-500">
          このアプリからは送信しません。下の手順で、ご自身のメールから学生係へ提出してください。
          メールでの提出はいつでも受け付けています。
        </p>

        <div className="mt-4 rounded-xl border border-gray-100 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold text-gray-500">宛先（情報工学部 学生係）</p>
            <button
              type="button"
              onClick={() => copyText(STUDENT_AFFAIRS_EMAIL, '宛先')}
              className="rounded-lg bg-green-50 px-3 py-1 text-xs font-semibold text-green-700 transition-ui hover:bg-green-100"
            >
              コピー
            </button>
          </div>
          <p className="mt-1.5 break-all text-sm text-gray-800">{STUDENT_AFFAIRS_EMAIL}</p>
        </div>

        <div className="mt-3 rounded-xl bg-gray-50 p-3">
          <p className="text-xs font-bold text-gray-500">添付するもの</p>
          <ul className="mt-1 space-y-0.5">
            {attachments.map((item) => (
              <li key={item} className="text-sm text-gray-800">・{item}</li>
            ))}
          </ul>
        </div>

        <div className="mt-3">
          <FirstTimeNote id="document-mail" label="提出の手順を見る">
            <ol className="space-y-2">
              {mailSteps.map((item, index) => (
                <li key={index} className="flex gap-2.5 text-sm text-gray-700">
                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-green-600 text-xs font-bold text-white">
                    {index + 1}
                  </span>
                  <span className="leading-6">{item}</span>
                </li>
              ))}
            </ol>
          </FirstTimeNote>
        </div>

        {/* 学内の施設を使うときは、学生係のあとに教務係への手続きが続く */}
        {requirement?.facilityNote && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
            体育館や講義室などの施設を使う場合は、学生係の確認が終わったあとに企画書の写しを受け取り、
            <strong>施設使用許可願と一緒に教務係へ提出</strong>します。
            講義室の予約は利用日の1か月前からです。
          </p>
        )}

        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-gray-100 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-gray-500">件名</p>
              <button
                type="button"
                onClick={() => copyText(mailSubject, '件名')}
                className="rounded-lg bg-green-50 px-3 py-1 text-xs font-semibold text-green-700 transition-ui hover:bg-green-100"
              >
                コピー
              </button>
            </div>
            <p className="mt-1.5 break-words text-sm text-gray-800">{mailSubject}</p>
          </div>

          <div className="rounded-xl border border-gray-100 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-gray-500">本文</p>
              <button
                type="button"
                onClick={() => copyText(mailBody, '本文')}
                className="rounded-lg bg-green-50 px-3 py-1 text-xs font-semibold text-green-700 transition-ui hover:bg-green-100"
              >
                コピー
              </button>
            </div>
            <pre className="mt-1.5 whitespace-pre-wrap break-words font-sans text-sm leading-6 text-gray-800">
              {mailBody}
            </pre>
          </div>
        </div>

        <p className="mt-3 text-xs text-gray-500">
          ※ 件名・本文は入力内容から自動で作成されます。必要に応じて調整してください。
        </p>
      </section>
      )}

      {/* 全画面プレビュー */}
      {previewOpen && (
        <PreviewModal onClose={() => setPreviewOpen(false)}>
          <DocumentSheet data={documentData} />
          {includeRoster && <RosterSheet data={documentData} />}
        </PreviewModal>
      )}
    </div>
  )
}

/** 提出様式に似せたA4プレビュー（2枚目: 参加者名簿・20行固定） */
function RosterSheet({ data }: { data: PlanDocumentData }) {
  return (
    <div className="plan-document-sheet mx-auto min-w-[640px] max-w-[794px] bg-white p-10 text-[12px] leading-relaxed text-gray-900 shadow-md print:min-w-0 print:p-0 print:shadow-none">
      <p>参加者名簿</p>
      <table className="mt-3 w-full border-collapse [&_td]:border [&_td]:border-gray-800 [&_td]:px-2 [&_td]:py-2 [&_th]:border [&_th]:border-gray-800 [&_th]:px-2 [&_th]:py-2 [&_th]:font-normal">
        <thead>
          <tr>
            <th className="w-10"></th>
            <th className="w-1/4">学生番号</th>
            <th className="w-1/4">学科学年</th>
            <th>氏　　　名</th>
          </tr>
        </thead>
        <tbody>
          {padRoster(data.roster).map((entry, index) => (
            <tr key={index}>
              <td>{index + 1}</td>
              <td className="text-center">{entry?.studentId}</td>
              <td>{entry?.departmentGrade}</td>
              <td>{entry?.name}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}


/** 作業の流れ（提出物の確認 → 入力 → 確認 → 提出）を上部に出す */
function StepNav({
  step,
  onChange,
  locked,
}: {
  step: DocumentStep
  onChange: (next: DocumentStep) => void
  /** 提出物の確認が済むまで（または提出不要なら）、1〜3 は押せない */
  locked: boolean
}) {
  const steps: { id: DocumentStep; label: string }[] = [
    { id: 'check', label: '0. 提出物' },
    { id: 'input', label: '1. 入力' },
    { id: 'preview', label: '2. 確認' },
    { id: 'submit', label: '3. 提出' },
  ]

  return (
    <nav className="flex overflow-hidden rounded-xl border border-gray-200 bg-white print:hidden">
      {steps.map((item) => {
        const active = item.id === step
        const disabled = locked && item.id !== 'check'
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            disabled={disabled}
            aria-current={active ? 'step' : undefined}
            className={`pressable flex-1 px-2 py-2.5 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-40 sm:text-sm ${
              active ? 'bg-green-600 text-white' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            {item.label}
          </button>
        )
      })}
    </nav>
  )
}

/** 自動保存の状況。押し忘れの不安をなくすため、状態だけ静かに見せる */
function SaveIndicator({ state }: { state: 'idle' | 'saving' | 'saved' | 'error' }) {
  if (state === 'idle') {
    return <p className="text-xs text-gray-500 print:hidden">入力すると自動で保存されます</p>
  }
  if (state === 'saving') {
    return <p className="text-xs text-gray-500 print:hidden">● 保存中...</p>
  }
  if (state === 'saved') {
    return <p className="text-xs font-semibold text-green-700 print:hidden">保存しました</p>
  }
  return (
    <p className="text-xs font-semibold text-red-600 print:hidden">
      保存できていません
    </p>
  )
}

/** A4のプレビューを全画面で見せる（小さい画面でも原寸で確認できるように） */
function PreviewModal({
  onClose,
  children,
}: {
  onClose: () => void
  children: React.ReactNode
}) {
  useDialogDismiss(onClose)

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/70 print:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="計画書のプレビュー"
    >
      <div className="flex flex-shrink-0 items-center justify-between gap-3 px-4 py-3">
        <p className="text-sm font-bold text-white">プレビュー</p>
        <button
          type="button"
          onClick={onClose}
          className="pressable rounded-lg bg-white/20 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-sm hover:bg-white/30"
        >
          閉じる
        </button>
      </div>
      {/* 横にも縦にもスクロールできる。全画面なので原寸で読める */}
      <div className="min-h-0 flex-1 overflow-auto px-4 pb-4">
        <div className="space-y-6">{children}</div>
      </div>
    </div>
  )
}

/**
 * 計画書に載るが、この画面では直さない項目。
 * 「欄が無い＝入力できない」と誤解されないよう、いまの値と直す場所を並べて出す。
 */
function FixedInfo({
  rows,
  note,
  href,
  linkLabel,
}: {
  rows: { label: string; value: string }[]
  note: string
  href: string
  linkLabel: string
}) {
  return (
    <div className="rounded-xl bg-gray-50 p-3">
      <dl className="space-y-1.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline gap-3 text-sm">
            <dt className="w-20 flex-shrink-0 text-xs font-medium text-gray-500">{row.label}</dt>
            <dd
              className={`min-w-0 flex-1 break-words ${
                row.value.trim() === '' ? 'text-amber-700' : 'font-semibold text-gray-800'
              }`}
            >
              {row.value.trim() === '' ? '未登録' : row.value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs leading-5 text-gray-500">{note}</p>
      <Link
        href={href}
        className="mt-2 inline-block text-xs font-bold text-green-700 hover:underline"
      >
        {linkLabel} →
      </Link>
    </div>
  )
}

function FormBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-xl border border-gray-100 p-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">{title}</h3>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      {/* label で囲むことで、ラベル文字をタップしても入力欄に移動できる */}
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      {children}
    </label>
  )
}

/** チェックを入れると、下の入力欄が使えるようになる項目 */
function CheckField({
  checked,
  onChange,
  label,
  disabled,
  children,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={`rounded-lg border p-3 ${checked ? 'border-green-300 bg-green-50/40' : 'border-gray-200'}`}>
      <label className="mb-2 flex cursor-pointer items-center gap-2 text-sm font-semibold text-gray-700">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          disabled={disabled}
          className="h-4 w-4"
        />
        {label}
      </label>
      {children}
    </div>
  )
}

/** 2〜3択から1つ選ぶボタン群（提出物の確認で使う） */
function ChoiceGroup<T extends string>({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string
  options: { value: T; label: string; hint: string }[]
  value: T | null
  onChange: (value: T) => void
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-bold text-gray-600">{legend}</legend>
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => {
          const selected = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              aria-pressed={selected}
              className={`pressable rounded-xl border px-3 py-2.5 text-left ${
                selected
                  ? 'border-green-500 bg-green-50 ring-1 ring-green-500'
                  : 'border-gray-200 hover:border-green-300'
              }`}
            >
              <span className="block text-sm font-bold text-gray-800">{option.label}</span>
              <span className="mt-0.5 block text-xs leading-4 text-gray-500">{option.hint}</span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

/** 答えに応じて、学生係に出すものを一覧にする */
function RequirementSummary({ requirement }: { requirement: SubmissionRequirement }) {
  const items = [
    { label: '企画書', needed: requirement.planDocument },
    { label: '参加者名簿', needed: requirement.roster },
    { label: '顧問確認メールのスクリーンショット', needed: requirement.advisorMail },
  ]

  return (
    <div className="rounded-xl border border-gray-200 p-3">
      <p className="text-xs font-bold text-gray-600">学生係に出すもの</p>
      <ul className="mt-2 space-y-1">
        {items.map((item) => (
          <li
            key={item.label}
            className={`flex items-center gap-2 text-sm ${
              item.needed ? 'font-semibold text-gray-800' : 'text-gray-400'
            }`}
          >
            <span
              aria-hidden
              className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                item.needed ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-400'
              }`}
            >
              {item.needed ? '✓' : '－'}
            </span>
            {item.label}
            <span className="text-xs font-normal">{item.needed ? '必要' : '不要'}</span>
          </li>
        ))}
      </ul>
      {requirement.facilityNote && (
        <p className="mt-2 text-xs leading-5 text-amber-800">
          体育館や講義室などの施設を使う場合は、別に施設使用許可願（教務係）が必要です。
        </p>
      )}
      {requirement.tournamentNote && (
        <p className="mt-2 text-xs leading-5 text-amber-800">
          大会やイベントに参加する場合は、大会要項など詳細が分かるものも一緒に提出します。
        </p>
      )}
    </div>
  )
}
