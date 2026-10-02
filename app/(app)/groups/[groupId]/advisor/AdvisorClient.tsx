'use client'

// 顧問教員の登録。
//
// 学校提出用の計画書には毎回「顧問教員」を書くが、サークルの顧問は
// 滅多に変わらない。計画書ごとに入力し直すのは手間なので、
// グループに1つ持たせて、すべての計画書に自動で入るようにしている。

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/Toast'
import { toUserMessage } from '@/lib/errorMessage'

type Group = {
  id: string
  name: string
  advisor_name: string | null
  advisor_affiliation: string | null
  advisor_phone: string | null
}

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500'

export default function AdvisorClient({ group }: { group: Group }) {
  const router = useRouter()
  const supabase = createClient()
  const toast = useToast()

  const [form, setForm] = useState({
    name: group.advisor_name ?? '',
    affiliation: group.advisor_affiliation ?? '',
    phone: group.advisor_phone ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setField = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }))

  const save = async () => {
    setError(null)
    setSaving(true)

    const { error: saveError } = await supabase
      .from('groups')
      .update({
        advisor_name: form.name.trim() || null,
        advisor_affiliation: form.affiliation.trim() || null,
        advisor_phone: form.phone.trim() || null,
      })
      .eq('id', group.id)

    setSaving(false)

    if (saveError) {
      setError(toUserMessage(saveError, '顧問教員を保存できませんでした。'))
      return
    }

    toast('顧問教員を保存しました')
    router.refresh()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href={`/groups/${group.id}`} className="text-sm text-gray-500 hover:text-gray-700">
          ← 戻る
        </Link>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            {group.name}
          </p>
          <h1 className="text-xl font-bold text-gray-800">顧問教員</h1>
        </div>
      </div>

      <p className="rounded-xl bg-white p-4 text-sm leading-6 text-gray-600 shadow-sm">
        ここに登録した顧問教員が、<strong>このグループの学校用計画書すべて</strong>に自動で入ります。
        計画書を作るたびに入力し直す必要はありません。
        <br />
        顧問の先生が替わったときだけ、この画面で直してください。
      </p>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">{error}</p>
      )}

      <section className="space-y-4 rounded-2xl bg-white p-6 shadow-sm">
        <Field label="氏名">
          <input
            value={form.name}
            onChange={(event) => setField('name', event.target.value)}
            className={inputClass}
            placeholder="記入例) 山田 太郎"
            autoComplete="off"
          />
        </Field>
        <Field label="所属等">
          <input
            value={form.affiliation}
            onChange={(event) => setField('affiliation', event.target.value)}
            className={inputClass}
            placeholder="記入例) ○○研究院○○研究系"
            autoComplete="off"
          />
        </Field>
        <Field label="TEL">
          <input
            type="tel"
            inputMode="tel"
            value={form.phone}
            onChange={(event) => setField('phone', event.target.value)}
            className={inputClass}
            placeholder="記入例) 050-1234-5678"
            autoComplete="off"
          />
        </Field>
      </section>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={save} disabled={saving} className="btn-primary">
          {saving ? '保存中...' : '保存する'}
        </button>
        <Link href={`/groups/${group.id}`} className="btn-secondary">
          戻る
        </Link>
      </div>

      <p className="text-xs leading-5 text-gray-500">
        ※ すでに作った計画書の内容は変わりません。これから作る計画書に反映されます。
      </p>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      {/* label で囲むことで、ラベル文字をタップしても入力欄に移動できる */}
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      {children}
    </label>
  )
}
