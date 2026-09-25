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
import { formatGearBaseline } from '@/lib/ai/gearBaseline'

// 持ち物の抜け漏れをチェックする。
// 計画の条件（季節・泊数・人数・活動内容）と、いま登録されている持ち物から
// 「足りないもの」を指摘する。今のアプリは登録された物を並べるだけで、
// 足りない物には誰も気付けないため、そこを埋めるのが狙い。
//
// 計画IDだけを受け取り、判断材料はサーバー側で集める（クライアントを信用しない）。

const requestSchema = z.object({
  planId: z.string().uuid(),
})

const resultSchema = z.object({
  summary: z.string(),
  findings: z.array(
    z.object({
      severity: z.enum(['warning', 'info']),
      title: z.string(),
      detail: z.string(),
    })
  ),
})

const SYSTEM_PROMPT = `あなたは日本の大学のアウトドアサークルで、装備の点検を担当する先輩です。
計画の条件と、いま登録されている持ち物を見て、足りないものを指摘します。

# 判断の材料
- 「基本装備の目安」として、このサークルが普段案内している持ち物リストが与えられます。
  まずこれと照らし合わせ、登録されていないものを拾ってください。
- そのうえで、今回の計画に固有の事情（季節・標高・泊数・人数・活動内容）から
  追加で必要になるものを考えてください。

# 出力の決まり（必ず守る）
- findings は重要な順に最大6件。無理に数を埋めない。問題が無ければ空配列にする。
- severity は2種類だけ。
  - warning: 無いと安全や実施そのものに関わるもの（防寒具、寝袋、照明、薬など）
  - info: 無くても何とかなるが、あると快適なもの（椅子、マットなど）
- title は20文字以内。何が足りないかを一言で。
- detail は80文字以内。なぜ必要かを、今回の条件に結びつけて書く。
  「季節だから」ではなく「10月の高原は朝晩5度前後まで下がるため」のように具体的に。
- summary は40文字以内の全体講評。

# してはいけないこと
- すでに登録されている物を「足りない」と言わない。
- 一般論だけの指摘をしない（「安全に気をつけましょう」など）。
- 持ち物と関係のない助言（保険、届出など）を書かない。
- 同じ内容を2件に分けて書かない。

# 数の確認
- 人数に対して数が足りない可能性があるものは、具体的な数を挙げて指摘する。
  例: テントの収容人数の合計が参加人数に足りない場合。
- ただし、登録された情報から数が読み取れない場合は、推測で断定しない。`


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

  // 計画が読めるか＝グループのメンバーかどうかは RLS が判断する
  const { data: plan } = await supabase
    .from('plans')
    .select('id, title, category, start_date, end_date, area, description, default_transport')
    .eq('id', parsed.data.planId)
    .maybeSingle()

  if (!plan) {
    return NextResponse.json({ error: 'この計画を参照できません' }, { status: 403 })
  }

  const [{ data: participants }, { data: preparations }] = await Promise.all([
    supabase.from('participants').select('id').eq('plan_id', plan.id),
    supabase.from('preparations').select('type, body').eq('plan_id', plan.id),
  ])

  const personal = (preparations ?? [])
    .filter((row) => row.type !== 'shared')
    .map((row) => row.body)
    .filter(Boolean)
  const shared = (preparations ?? [])
    .filter((row) => row.type === 'shared')
    .map((row) => row.body)
    .filter(Boolean)

  const nights = countNights(plan.start_date, plan.end_date)
  const details = [
    `行事名: ${plan.title}`,
    `種別: ${plan.category || '未設定'}`,
    `場所: ${plan.area || '未設定'}`,
    `時期: ${describeSeason(plan.start_date)}`,
    nights === 0 ? '日程: 日帰り' : `日程: ${nights}泊${nights + 1}日`,
    `交通手段: ${plan.default_transport || '未定'}`,
    `参加人数: ${participants?.length ?? 0}人`,
    plan.description ? `活動内容: ${plan.description}` : '',
    '',
    `個人の持ち物（登録済み）: ${personal.length > 0 ? personal.join('、') : 'なし'}`,
    `共同の持ち物（登録済み）: ${shared.length > 0 ? shared.join('、') : 'なし'}`,
  ]
    .filter(Boolean)
    .join('\n')

  try {
    const ai = createAiClient()
    const response = await ai.models.generateContent({
      model: AI_MODEL,
      contents: `# 今回の計画
${details}

# 基本装備の目安（このサークルの案内）
${formatGearBaseline()}

上記をふまえて、足りない持ち物を点検してください。`,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            findings: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  severity: { type: Type.STRING, enum: ['warning', 'info'] },
                  title: { type: Type.STRING },
                  detail: { type: Type.STRING },
                },
                required: ['severity', 'title', 'detail'],
              },
            },
          },
          required: ['summary', 'findings'],
        },
        maxOutputTokens: 2048,
        temperature: 0.3,
      },
    })

    const parsedResult = resultSchema.safeParse(parseJsonResponse(response.text))
    if (!parsedResult.success) {
      return NextResponse.json({ error: '点検できませんでした' }, { status: 502 })
    }

    return NextResponse.json(parsedResult.data)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AIの呼び出しに失敗しました'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
