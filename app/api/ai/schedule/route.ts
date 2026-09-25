import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import {
  AI_MODEL,
  Type,
  countNights,
  createAiClient,
  describeSeason,
  parseJsonResponse,
} from '@/lib/ai/client'
import { normalizeScheduleRows } from '@/lib/ai/schedule'
import { PLAN_TEMPLATES } from '@/lib/planTemplates'

// 行程表の下書きを作る。
// 生成した内容は保存せず、計画作成フォームに流し込むだけ。
//
// 形式（2桁ゼロ埋め・30分刻み・ラベルの種類・並び順）は
// プロンプトで指示したうえで、lib/ai/schedule.ts で必ず正規化する。
// モデルの出力に頼りきらないことで、フォームに入らない値が生まれないようにしている。

const requestSchema = z.object({
  groupId: z.string().uuid(),
  title: z.string().min(1),
  category: z.string().optional(),
  area: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  transport: z.string().optional(),
})

const SYSTEM_PROMPT = `あなたは日本の大学のアウトドアサークルで、キャンプ・合宿・日帰り活動の行程表を作る担当者です。
与えられた条件から、当日そのまま使える行程表の下書きを作ります。

# 出力形式（必ず守る）
- time は24時間表記の "HH:MM"。時も分も必ず2桁。分は "00" か "30" のみ。
  正しい例: "09:00" "13:30"
  誤った例: "9:00"（1桁）, "09:15"（15分）, "9時"
- dayOffset は整数。初日が 0、2日目が 1、3日目が 2。泊数を超える値は使わない。
- timeLabel は次のいずれか1つ。当てはまらない行は空文字 "" にする。
  集合 / 出発 / 到着 / 解散 / 休憩 / 買い出し
- locationName は「どこで何をするか」が分かる短い言葉。空にしない。
- note は補足が要るときだけ。不要なら空文字 "" にする。

# 行程の組み立て方（必ず守る）
- 1行目の timeLabel は必ず "集合"。最終行の timeLabel は必ず "解散"。
- 時刻は必ず前の行より後にする。日をまたぐときは dayOffset を1つ増やす。
- 連続する行の間隔を3時間以上空けない。空くときは、その間にしていることを行として足す。
  （例: "テント設営" "昼食（現地）" "自由時間" "川遊び" "薪割り・火起こし"）
  何をしているか分からない空白を残さないこと。
- 1日あたり5〜8行。分刻みの細かすぎる行程にはしない。
- 宿泊を伴う場合:
  - 初日に「到着」「テント設営」「夕食」にあたる行を入れる。
  - 最終日に「撤収」「出発」にあたる行を入れてから解散する。
  - 就寝・起床は書かなくてよい。
- 日帰りの場合は dayOffset をすべて 0 にし、その日のうちに解散する。

# 時間の見積もり（必ず守る）
- 移動時間は、指定された交通手段で実際にかかる時間にする。
- 車で片道2時間以上かかるなら、途中に timeLabel "休憩" の行を1回入れる。
- 集合時刻の目安は 08:00〜10:00。行き先が遠いほど早める。
- 解散時刻は、日帰りなら 17:00〜18:00、宿泊を伴うなら 18:00〜21:00 を目安にする。
  行き先が遠い場合は 22:00 以降になることもある。無理に夕方に収めない。
- 食材が必要な計画なら、現地へ向かう途中に timeLabel "買い出し" の行を入れる。

# 場所の書き方
- 条件に施設名が含まれていれば、その名前をそのまま使う。別の施設名に置き換えない。
- 場所エリアだけが与えられている場合は、その地域として自然な書き方にする。
- 確信が持てない固有名詞は作らない。"現地のスーパー" のように一般的な言い方にする。

# 参考情報の使い方
- 「参考」として行程表が与えられる。
  時間の組み立て方・場所名の書き方・note の粒度を、それに合わせる。
- 参考の行程に共通して現れる立ち寄り先の型（観光、入浴、買い出しなど）があれば、
  今回の計画にも同じように組み込む。そのサークルの定番だからである。
- ただし日程・行き先・交通手段が違えば内容は変える。そのまま写さない。

# 書いてはいけないこと
- 条件にない持ち物・費用・人数の話を note に書かない。
- "事故に注意" のような一般論を書かない。書くならその場面固有の注意にする。
- 同じ場所名を連続する行で繰り返さない。`

/** 組み込みテンプレートを、行程の骨格として参考提示する */
function buildTemplateReference(nights: number): string {
  const candidates = PLAN_TEMPLATES.filter((template) => template.nights === nights)
  const picked = (candidates.length > 0 ? candidates : PLAN_TEMPLATES).slice(0, 2)

  return picked
    .map((template) => {
      const lines = template.schedule
        .map(
          (row) =>
            `  ${row.dayOffset + 1}日目 ${row.time} ${row.location_name}${
              row.time_label ? `（${row.time_label}）` : ''
            }`
        )
        .join('\n')
      return `・${template.name}（${template.nights === 0 ? '日帰り' : `${template.nights}泊`}／${template.transport}）\n${lines}`
    })
    .join('\n')
}

type PastScheduleItem = {
  day: string | null
  time: string | null
  sort_order: number | null
  time_label: string | null
  location_name: string | null
}

/** このグループが実際に作った行程表を参考提示する（最大2件） */
function buildPastReference(
  plans: { title: string; schedule_items: PastScheduleItem[] }[]
): string {
  return plans
    .map((plan) => {
      const items = [...plan.schedule_items]
        .sort((a, b) => {
          const dayCompare = (a.day ?? '').localeCompare(b.day ?? '')
          if (dayCompare !== 0) return dayCompare
          const timeCompare = (a.time ?? '').localeCompare(b.time ?? '')
          if (timeCompare !== 0) return timeCompare
          return (a.sort_order ?? 0) - (b.sort_order ?? 0)
        })
        .slice(0, 12)

      const lines = items
        .map(
          (item) =>
            `  ${(item.time ?? '').slice(0, 5) || '時刻未定'} ${item.location_name ?? ''}${
              item.time_label ? `（${item.time_label}）` : ''
            }`
        )
        .join('\n')

      return `・${plan.title}\n${lines}`
    })
    .join('\n')
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'ログインしてください' }, { status: 401 })
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: '入力が正しくありません' }, { status: 400 })
  }
  const input = parsed.data

  // そのグループのメンバーでなければ使わせない
  const { data: membership } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', input.groupId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) {
    return NextResponse.json({ error: 'このグループのメンバーではありません' }, { status: 403 })
  }

  // 過去にこのグループが作った行程表を参考にする（書き方の癖を引き継ぐため）
  const { data: pastPlanRows } = await supabase
    .from('plans')
    .select('title, schedule_items(day, time, sort_order, time_label, location_name)')
    .eq('group_id', input.groupId)
    .order('created_at', { ascending: false })
    .limit(6)

  const pastPlans = (pastPlanRows ?? [])
    .map((plan) => ({
      title: plan.title as string,
      schedule_items: (plan.schedule_items ?? []) as PastScheduleItem[],
    }))
    .filter((plan) => plan.schedule_items.length >= 3)
    .slice(0, 2)

  const nights = countNights(input.startDate, input.endDate)

  const sections = [
    `# 今回の計画
行事名: ${input.title}
種別: ${input.category || '未設定'}
場所エリア: ${input.area || '未設定'}
時期: ${describeSeason(input.startDate)}
日程: ${nights === 0 ? '日帰り' : `${nights}泊${nights + 1}日`}
交通手段: ${input.transport || '未定'}`,
    `# 参考: 定番の組み立て方
${buildTemplateReference(nights)}`,
  ]

  if (pastPlans.length > 0) {
    sections.push(`# 参考: このグループが過去に作った行程表
${buildPastReference(pastPlans)}`)
  }

  sections.push('上記をふまえて、今回の計画の行程表を作ってください。')

  try {
    const ai = createAiClient()
    const response = await ai.models.generateContent({
      model: AI_MODEL,
      contents: sections.join('\n\n'),
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            rows: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  dayOffset: { type: Type.INTEGER },
                  time: { type: Type.STRING },
                  timeLabel: { type: Type.STRING },
                  locationName: { type: Type.STRING },
                  note: { type: Type.STRING },
                },
                required: ['dayOffset', 'time', 'timeLabel', 'locationName', 'note'],
              },
            },
          },
          required: ['rows'],
        },
        maxOutputTokens: 2048,
        temperature: 0.4,
      },
    })

    const raw = parseJsonResponse(response.text) as { rows?: unknown } | null
    const rows = normalizeScheduleRows(raw?.rows, nights)

    if (rows.length === 0) {
      return NextResponse.json({ error: '下書きを作れませんでした' }, { status: 502 })
    }

    return NextResponse.json({ rows })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AIの呼び出しに失敗しました'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
