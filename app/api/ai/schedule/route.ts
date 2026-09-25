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

// 行程表の下書きを作る。
// 行き先と日程から「集合 → 到着 → 解散」までの流れを提案し、
// 計画作成フォームにそのまま流し込める形で返す。
// 生成結果はあくまで下書きで、保存はしない（ユーザーが手直ししてから作成する）。

const requestSchema = z.object({
  groupId: z.string().uuid(),
  title: z.string().min(1),
  category: z.string().optional(),
  area: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  transport: z.string().optional(),
})

// 既存の行程表の入力欄に合わせた形で返してもらう
const draftSchema = z.object({
  rows: z.array(
    z.object({
      dayOffset: z.number().int().min(0).max(6),
      time: z.string(),
      timeLabel: z.string(),
      locationName: z.string(),
      note: z.string(),
    })
  ),
})

const SYSTEM_PROMPT = `あなたは日本の大学のアウトドアサークルの運営を手伝うアシスタントです。
キャンプ・合宿・日帰り活動の行程表の下書きを作ります。

守ること:
- 必ず「集合」で始まり「解散」で終わる。
- time は "HH:MM" 形式で、30分刻み（00分か30分）のみ。
- timeLabel は次のいずれか、または空文字: 集合 / 出発 / 到着 / 解散 / 休憩 / 買い出し
- dayOffset は 0 が初日、1 が2日目。
- locationName は実在しそうな具体的な場所名にする。地名が与えられていれば活かす。
- note は無くてもよい。書く場合は40文字以内で、その場所での注意点を1つだけ。
- 行数は6〜10行程度。細かすぎる刻みにはしない。
- 移動時間を現実的に見積もる。指定された交通手段を前提にする。`

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

  // そのグループのメンバーでなければ使わせない（APIの無駄打ちを防ぐ）
  const { data: membership } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', input.groupId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) {
    return NextResponse.json({ error: 'このグループのメンバーではありません' }, { status: 403 })
  }

  const nights = countNights(input.startDate, input.endDate)
  const details = [
    `行事名: ${input.title}`,
    `種別: ${input.category || '未設定'}`,
    `場所エリア: ${input.area || '未設定'}`,
    `時期: ${describeSeason(input.startDate)}`,
    nights === 0 ? '日程: 日帰り' : `日程: ${nights}泊${nights + 1}日`,
    `交通手段: ${input.transport || '未定'}`,
  ].join('\n')

  try {
    const ai = createAiClient()
    const response = await ai.models.generateContent({
      model: AI_MODEL,
      contents: `次の計画の行程表の下書きを作ってください。\n\n${details}`,
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
        // 下書きなので長文は不要。使いすぎを防ぐ意味でも絞っておく
        maxOutputTokens: 2048,
        temperature: 0.4,
      },
    })

    // スキーマで縛っていても、こちらでも検証してから返す
    const parsedResult = draftSchema.safeParse(parseJsonResponse(response.text))
    if (!parsedResult.success) {
      return NextResponse.json({ error: '下書きを作れませんでした' }, { status: 502 })
    }

    return NextResponse.json(parsedResult.data)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AIの呼び出しに失敗しました'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
