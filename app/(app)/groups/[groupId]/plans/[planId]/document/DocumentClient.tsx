'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  DEFAULT_RECIPIENT,
  ROSTER_FOOTNOTE,
  buildHospitalLabel,
  buildLodgingLines,
  buildRoster,
  buildScheduleDays,
  formatMonthDayRange,
  formatWareki,
  padRoster,
  type PlanDocumentData,
  type PlanDocumentFormValues,
  type ProfileRow,
} from '@/lib/planDocument'

type Group = { id: string; name: string }

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
  profiles: ProfileRow | null
}

type PlanDocumentRow = {
  id: string
  plan_id: string
  created_date: string | null
  recipient: string | null
  advisor_name: string | null
  advisor_affiliation: string | null
  advisor_phone: string | null
  lodging_name: string | null
  lodging_address: string | null
  lodging_phone: string | null
  transport_note: string | null
  hospital_name: string | null
  hospital_address: string | null
  hospital_phone: string | null
  hospital_distance: string | null
  notes: string | null
}

type Props = {
  group: Group
  plan: Plan
  scheduleItems: ScheduleItem[]
  participants: Participant[]
  memberPositions: { user_id: string; position: string }[]
  planDocument: PlanDocumentRow | null
  creatorProfile: ProfileRow | null
  leaderProfile: ProfileRow | null
  currentUserId: string
}

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500'

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
  memberPositions,
  planDocument,
  creatorProfile,
  leaderProfile,
  currentUserId,
}: Props) {
  const supabase = createClient()
  const isCreator = plan.creator_id === currentUserId
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [form, setForm] = useState<PlanDocumentFormValues>({
    created_date: planDocument?.created_date ?? todayIso(),
    recipient: planDocument?.recipient ?? DEFAULT_RECIPIENT,
    advisor_name: planDocument?.advisor_name ?? '',
    advisor_affiliation: planDocument?.advisor_affiliation ?? '',
    advisor_phone: planDocument?.advisor_phone ?? '',
    lodging_name: planDocument?.lodging_name ?? '',
    lodging_address: planDocument?.lodging_address ?? '',
    lodging_phone: planDocument?.lodging_phone ?? '',
    transport_note: planDocument?.transport_note ?? '',
    hospital_name: planDocument?.hospital_name ?? '',
    hospital_address: planDocument?.hospital_address ?? '',
    hospital_phone: planDocument?.hospital_phone ?? '',
    hospital_distance: planDocument?.hospital_distance ?? '',
    notes: planDocument?.notes ?? '',
  })

  const setField = (key: keyof PlanDocumentFormValues, value: string) =>
    setForm((current) => ({ ...current, [key]: value }))

  // フォームの値と参加者情報から、プレビュー/PDF 共通のデータを組み立てる
  const documentData: PlanDocumentData = useMemo(() => {
    const positions = new Map(
      memberPositions.map((member) => [member.user_id, member.position])
    )
    const representative = leaderProfile ?? creatorProfile

    return {
      createdDateLabel: formatWareki(form.created_date),
      recipient: form.recipient,
      groupName: group.name,
      representative: {
        name: representative?.name ?? '',
        studentId: representative?.student_id ?? '',
        department: representative?.department ?? '',
        phone: representative?.phone ?? '',
        email: representative?.school_email ?? '',
      },
      advisorName: form.advisor_name,
      advisorAffiliation: form.advisor_affiliation,
      advisorPhone: form.advisor_phone,
      drafterName: creatorProfile?.name ?? '',
      title: plan.title,
      dateRangeLabel: formatMonthDayRange(plan.start_date, plan.end_date),
      place: plan.area ?? '',
      scheduleDays: buildScheduleDays(scheduleItems),
      lodgingLines: buildLodgingLines(form),
      transportLabel:
        form.transport_note || plan.default_transport || '未定',
      participantCountLabel: `${participants.length}人`,
      hospitalLabel: buildHospitalLabel(form),
      notes: form.notes,
      roster: buildRoster(participants, positions),
    }
  }, [form, group, plan, scheduleItems, participants, memberPositions, creatorProfile, leaderProfile])

  const saveDocument = async () => {
    setMessage(null)
    setSaving(true)

    const { error } = await supabase.from('plan_documents').upsert(
      {
        plan_id: plan.id,
        created_date: form.created_date || null,
        recipient: form.recipient || null,
        advisor_name: form.advisor_name || null,
        advisor_affiliation: form.advisor_affiliation || null,
        advisor_phone: form.advisor_phone || null,
        lodging_name: form.lodging_name || null,
        lodging_address: form.lodging_address || null,
        lodging_phone: form.lodging_phone || null,
        transport_note: form.transport_note || null,
        hospital_name: form.hospital_name || null,
        hospital_address: form.hospital_address || null,
        hospital_phone: form.hospital_phone || null,
        hospital_distance: form.hospital_distance || null,
        notes: form.notes || null,
      },
      { onConflict: 'plan_id' }
    )

    if (error) {
      setMessage({ type: 'error', text: '保存に失敗しました: ' + error.message })
      setSaving(false)
      return
    }

    setMessage({ type: 'ok', text: '計画書の内容を保存しました' })
    setSaving(false)
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
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'PDFの生成に失敗しました: ' + (error instanceof Error ? error.message : String(error)),
      })
    }
    setGenerating(false)
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
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              {group.name}
            </p>
            <h1 className="text-xl font-bold text-gray-800">計画書（学校提出用）</h1>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:border-green-400 hover:text-green-700"
          >
            印刷
          </button>
          <button
            type="button"
            onClick={downloadPdf}
            disabled={generating}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 active:scale-95 disabled:opacity-50"
          >
            {generating ? 'PDFを生成中...' : '計画書を作成する（PDF）'}
          </button>
        </div>
      </div>

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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] print:block">
        {/* 入力フォーム（起案者のみ編集可） */}
        <section className="space-y-5 self-start rounded-2xl bg-white p-5 shadow-sm print:hidden">
          <div>
            <h2 className="text-sm font-bold text-gray-700">起案者が入力する項目</h2>
            <p className="mt-1 text-xs text-gray-500">
              行事名・日程・参加者名簿などは計画と参加者のプロフィールから自動反映されます。
              {!isCreator && ' （閲覧のみ・保存は起案者だけができます）'}
            </p>
          </div>

          <FormBlock title="基本">
            <Field label="計画書の作成日">
              <input
                type="date"
                value={form.created_date}
                onChange={(event) => setField('created_date', event.target.value)}
                className={inputClass}
                disabled={!isCreator}
              />
            </Field>
            <Field label="宛先">
              <input
                value={form.recipient}
                onChange={(event) => setField('recipient', event.target.value)}
                className={inputClass}
                disabled={!isCreator}
              />
            </Field>
          </FormBlock>

          <FormBlock title="顧問教員">
            <Field label="氏名">
              <input
                value={form.advisor_name}
                onChange={(event) => setField('advisor_name', event.target.value)}
                className={inputClass}
                placeholder="記入例) 山田 太郎"
                disabled={!isCreator}
              />
            </Field>
            <Field label="所属等">
              <input
                value={form.advisor_affiliation}
                onChange={(event) => setField('advisor_affiliation', event.target.value)}
                className={inputClass}
                placeholder="記入例) ○○研究院○○研究系"
                disabled={!isCreator}
              />
            </Field>
            <Field label="TEL">
              <input
                value={form.advisor_phone}
                onChange={(event) => setField('advisor_phone', event.target.value)}
                className={inputClass}
                placeholder="記入例) 050-1234-5678"
                disabled={!isCreator}
              />
            </Field>
          </FormBlock>

          <FormBlock title="宿泊所">
            <Field label="住所">
              <input
                value={form.lodging_address}
                onChange={(event) => setField('lodging_address', event.target.value)}
                className={inputClass}
                placeholder="記入例) 〒000-0000 ○○県○○市○○町1-2-3"
                disabled={!isCreator}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="名称（任意）">
                <input
                  value={form.lodging_name}
                  onChange={(event) => setField('lodging_name', event.target.value)}
                  className={inputClass}
                  placeholder="記入例) ○○キャンプ場"
                  disabled={!isCreator}
                />
              </Field>
              <Field label="TEL">
                <input
                  value={form.lodging_phone}
                  onChange={(event) => setField('lodging_phone', event.target.value)}
                  className={inputClass}
                  placeholder="記入例) 0120-12-3456"
                  disabled={!isCreator}
                />
              </Field>
            </div>
          </FormBlock>

          <FormBlock title="移動手段・病院">
            <Field label={`移動手段（未入力なら「${plan.default_transport || '未定'}」）`}>
              <input
                value={form.transport_note}
                onChange={(event) => setField('transport_note', event.target.value)}
                className={inputClass}
                placeholder="記入例) 車2台"
                disabled={!isCreator}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="病院名">
                <input
                  value={form.hospital_name}
                  onChange={(event) => setField('hospital_name', event.target.value)}
                  className={inputClass}
                  placeholder="記入例) ○○病院"
                  disabled={!isCreator}
                />
              </Field>
              <Field label="TEL">
                <input
                  value={form.hospital_phone}
                  onChange={(event) => setField('hospital_phone', event.target.value)}
                  className={inputClass}
                  placeholder="記入例) 092-123-4567"
                  disabled={!isCreator}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="距離・所要時間">
                <input
                  value={form.hospital_distance}
                  onChange={(event) => setField('hospital_distance', event.target.value)}
                  className={inputClass}
                  placeholder="記入例) 車10分"
                  disabled={!isCreator}
                />
              </Field>
              <Field label="住所（任意）">
                <input
                  value={form.hospital_address}
                  onChange={(event) => setField('hospital_address', event.target.value)}
                  className={inputClass}
                  disabled={!isCreator}
                />
              </Field>
            </div>
          </FormBlock>

          <FormBlock title="備考">
            <textarea
              value={form.notes}
              onChange={(event) => setField('notes', event.target.value)}
              className={`${inputClass} min-h-20 resize-y`}
              placeholder="記入例) 雨天時は中止し、後日改めて実施予定"
              disabled={!isCreator}
            />
          </FormBlock>

          {isCreator && (
            <button
              type="button"
              onClick={saveDocument}
              disabled={saving}
              className="w-full rounded-lg bg-green-600 py-2 text-sm font-semibold text-white transition hover:bg-green-700 active:scale-[0.99] disabled:opacity-50"
            >
              {saving ? '保存中...' : '入力内容を保存'}
            </button>
          )}
        </section>

        {/* プレビュー（入力するとリアルタイムに反映） */}
        <section className="min-w-0">
          <p className="mb-2 text-xs text-gray-400 print:hidden">
            プレビュー（入力内容がリアルタイムで反映されます / PDFは2ページ構成で出力されます）
          </p>
          <div className="space-y-6 overflow-x-auto" id="plan-document-sheets">
            <DocumentSheet data={documentData} />
            <RosterSheet data={documentData} />
          </div>
        </section>
      </div>
    </div>
  )
}

/** 提出様式に似せたA4プレビュー（1枚目: 計画書本体） */
function DocumentSheet({ data }: { data: PlanDocumentData }) {
  return (
    <div
      className="plan-document-sheet mx-auto min-w-[640px] max-w-[794px] bg-white p-10 text-[12px] leading-relaxed text-gray-900 shadow-md print:min-w-0 print:p-0 print:shadow-none"
    >
      <p className="text-right">{data.createdDateLabel || '令和　年　月　日'}</p>

      <p className="mt-6">{data.recipient}</p>

      <table className="ml-auto mt-4 border-separate border-spacing-y-1">
        <tbody>
          <UnderlineRow label="団体名" value={data.groupName} />
          <UnderlineRow label="代表者氏名" value={data.representative.name} />
          <UnderlineRow label="学籍番号" value={data.representative.studentId} />
          <UnderlineRow label="所属等" value={data.representative.department} />
          <UnderlineRow label="TEL" value={data.representative.phone} />
          <UnderlineRow label="E-mail" value={data.representative.email} />
          <UnderlineRow label="顧問教員" value={data.advisorName} />
          <UnderlineRow label="所属等" value={data.advisorAffiliation} />
          <UnderlineRow label="TEL" value={data.advisorPhone} />
        </tbody>
      </table>

      <table className="ml-auto mt-4 border-separate border-spacing-y-1">
        <tbody>
          <UnderlineRow label="起案者代表" value={data.drafterName} />
        </tbody>
      </table>

      <p className="mt-6">下記のとおり、合宿等を企画しました。（申請いたします。）</p>
      <p>許可していただきますようにお願いします。</p>
      <p className="mt-3 text-center">記</p>

      <table className="mt-3 w-full border-collapse [&_td]:border [&_td]:border-gray-800 [&_td]:px-2 [&_td]:py-1.5 [&_th]:border [&_th]:border-gray-800 [&_th]:px-2 [&_th]:py-1.5">
        <tbody>
          <tr>
            <th className="w-24 bg-gray-50 font-normal">行事名</th>
            <td colSpan={2}>{data.title}</td>
          </tr>
          <tr>
            <th className="bg-gray-50 font-normal">日時</th>
            <td colSpan={2}>{data.dateRangeLabel}</td>
          </tr>
          <tr>
            <th className="bg-gray-50 font-normal">場所</th>
            <td colSpan={2}>{data.place}</td>
          </tr>
          <tr>
            <th className="bg-gray-50 font-normal">
              日程
              <br />
              （詳細に）
            </th>
            {data.scheduleDays.length === 0 ? (
              <td colSpan={2} className="text-gray-400">
                行程が未登録です
              </td>
            ) : (
              data.scheduleDays.slice(0, 2).map((day) => (
                <td key={day.label} className="align-top" colSpan={data.scheduleDays.length === 1 ? 2 : 1}>
                  <p className="font-semibold">{day.label}</p>
                  {day.lines.map((line, index) => (
                    <p key={index}>{line}</p>
                  ))}
                </td>
              ))
            )}
          </tr>
          <tr>
            <th className="bg-gray-50 font-normal">宿泊所</th>
            <td colSpan={2}>
              {data.lodgingLines.length === 0
                ? ''
                : data.lodgingLines.map((line, index) => <p key={index}>{line}</p>)}
            </td>
          </tr>
          <tr>
            <th className="bg-gray-50 font-normal">移動手段</th>
            <td colSpan={2}>{data.transportLabel}</td>
          </tr>
          <tr>
            <th className="bg-gray-50 font-normal">参加人数</th>
            <td colSpan={2}>{data.participantCountLabel}</td>
          </tr>
          <tr>
            <th className="bg-gray-50 font-normal">周辺の病院等</th>
            <td colSpan={2}>{data.hospitalLabel}</td>
          </tr>
          <tr>
            <th className="bg-gray-50 font-normal">備考</th>
            <td colSpan={2} className="h-12 whitespace-pre-wrap align-top">
              {data.notes}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

/** 提出様式に似せたA4プレビュー（2枚目: 参加者名簿・20行固定） */
function RosterSheet({ data }: { data: PlanDocumentData }) {
  return (
    <div className="plan-document-sheet mx-auto min-w-[640px] max-w-[794px] bg-white p-10 text-[12px] leading-relaxed text-gray-900 shadow-md print:min-w-0 print:p-0 print:shadow-none">
      <p className="font-semibold">参加者名簿</p>
      <table className="mt-2 w-full border-collapse text-[10px] [&_td]:border [&_td]:border-gray-800 [&_td]:px-1 [&_td]:py-1 [&_th]:border [&_th]:border-gray-800 [&_th]:px-1 [&_th]:py-1 [&_th]:font-normal">
        <thead>
          <tr>
            <th className="w-7"></th>
            <th>学生番号</th>
            <th>役職</th>
            <th className="w-9">学年</th>
            <th>所属</th>
            <th>氏名</th>
            <th>TEL</th>
            <th>E-mail</th>
            <th>指導教員氏名</th>
          </tr>
        </thead>
        <tbody>
          {padRoster(data.roster).map((entry, index) => (
            <tr key={index}>
              <td className="text-center">{index + 1}</td>
              <td>{entry?.studentId}</td>
              <td>{entry?.position}</td>
              <td className="text-center">{entry?.grade}</td>
              <td>{entry?.department}</td>
              <td>{entry?.name}</td>
              <td>{entry?.phone}</td>
              <td className="break-all">{entry?.email}</td>
              <td>{entry?.advisor}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-[10px] text-gray-700">{ROSTER_FOOTNOTE}</p>
    </div>
  )
}

function UnderlineRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td className="pr-4 align-bottom">{label}</td>
      <td className="min-w-64 border-b border-gray-800 pl-2 align-bottom">
        {value || ' '}
      </td>
    </tr>
  )
}

function FormBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-xl border border-gray-100 p-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">{title}</h3>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
      {children}
    </div>
  )
}
