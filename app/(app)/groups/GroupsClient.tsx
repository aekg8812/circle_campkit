'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import PasswordInput from '@/components/PasswordInput'
import { EmptyState } from '@/components/EmptyState'

type Group = {
  id: string
  name: string
  image_url: string | null
}

type Props = {
  myGroups: Group[]
  otherGroups: Group[]
  initialJoinGroupId: string | null
}

const joinSchema = z.object({
  password: z.string().min(1, 'パスワードを入力してください'),
})
type JoinForm = z.infer<typeof joinSchema>

export default function GroupsClient({ myGroups, otherGroups, initialJoinGroupId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [joiningGroup, setJoiningGroup] = useState<Group | null>(null)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [searchText, setSearchText] = useState('')
  const [handledInitialJoin, setHandledInitialJoin] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<JoinForm>({ resolver: zodResolver(joinSchema) })

  const openJoinModal = (group: Group) => {
    setJoiningGroup(group)
    setJoinError(null)
    reset()
  }

  const closeModal = () => {
    setJoiningGroup(null)
    setJoinError(null)
    reset()
  }

  const onJoin = async (data: JoinForm) => {
    if (!joiningGroup) return
    setJoinError(null)
    const { error } = await supabase.rpc('join_group', {
      p_group_id: joiningGroup.id,
      p_password: data.password,
    })
    if (error) {
      const msg = error.message
      setJoinError(
        msg.includes('パスワード') ? 'パスワードが正しくありません' : msg
      )
      return
    }
    closeModal()
    router.push(`/groups/${joiningGroup.id}`)
  }

  const normalizedSearch = searchText.trim().toLowerCase()
  const filteredGroups = useMemo(() => {
    if (!normalizedSearch) return []
    return otherGroups.filter((group) =>
      group.name.toLowerCase().includes(normalizedSearch)
    )
  }, [normalizedSearch, otherGroups])

  useEffect(() => {
    if (handledInitialJoin || !initialJoinGroupId) return

    const alreadyJoined = myGroups.some((group) => group.id === initialJoinGroupId)
    if (alreadyJoined) {
      router.replace(`/groups/${initialJoinGroupId}`)
      setHandledInitialJoin(true)
      return
    }

    const invitedGroup = otherGroups.find((group) => group.id === initialJoinGroupId)
    if (invitedGroup) {
      openJoinModal(invitedGroup)
    }
    setHandledInitialJoin(true)
  }, [handledInitialJoin, initialJoinGroupId, myGroups, otherGroups, router])

  return (
    <div className="space-y-8">
      <Link
        href="/groups/new"
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-green-600 py-4 text-base font-bold text-white shadow-sm transition hover:bg-green-700 active:scale-[0.99]"
      >
        ＋ 新しいグループを作成
      </Link>

      {/* 参加中のグループ */}
      <section>
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
          参加中のグループ
        </h2>
        {myGroups.length === 0 ? (
          <EmptyState
            icon="⛺"
            title="まだグループに参加していません"
            description="下の検索から参加するか、新しいグループを作りましょう。"
          />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {myGroups.map((g) => (
              <Link
                key={g.id}
                href={`/groups/${g.id}`}
                className="bg-white rounded-2xl shadow-sm p-3 hover:shadow-md transition"
              >
                <GroupCard group={g} />
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
          グループに参加する
        </h2>
        <div className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
          <input
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="グループ名で検索"
          />

          {!normalizedSearch ? (
            <p className="rounded-lg bg-gray-50 px-4 py-4 text-center text-sm text-gray-400">
              グループ名を入力して検索してください
            </p>
          ) : filteredGroups.length === 0 ? (
            <p className="rounded-lg bg-gray-50 px-4 py-4 text-center text-sm text-gray-400">
              該当するグループはありません
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {filteredGroups.map((g) => (
                <div key={g.id} className="rounded-2xl border border-gray-100 bg-white p-3">
                  <GroupCard group={g} />
                  <button
                    onClick={() => openJoinModal(g)}
                    className="mt-2 w-full rounded-lg bg-green-50 py-1.5 text-xs font-semibold text-green-700 transition hover:bg-green-100"
                  >
                    パスワードを入力して参加
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 参加モーダル */}
      {joiningGroup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-2xl shadow-xl p-6 w-80 mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-bold text-gray-800 mb-1">
              グループに参加
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              「{joiningGroup.name}」の参加パスワードを入力してください
            </p>

            {joinError && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">
                {joinError}
              </p>
            )}

            <form onSubmit={handleSubmit(onJoin)} className="space-y-3">
              <div>
                <PasswordInput
                  {...register('password')}
                  placeholder="パスワード"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  autoFocus
                />
                {errors.password && (
                  <p className="text-xs text-red-500 mt-1">
                    {errors.password.message}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-lg transition disabled:opacity-50 text-sm"
                >
                  {isSubmitting ? '参加中...' : '参加する'}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2 rounded-lg transition text-sm"
                >
                  キャンセル
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function GroupCard({ group }: { group: Group }) {
  return (
    <>
      <div className="w-full h-24 rounded-lg mb-2 bg-gray-100 overflow-hidden flex items-center justify-center">
        {group.image_url ? (
          <Image
            src={group.image_url}
            alt={group.name}
            width={200}
            height={96}
            className="object-cover w-full h-full"
          />
        ) : (
          <span className="text-3xl text-gray-300">&#x26FA;</span>
        )}
      </div>
      <p className="font-semibold text-sm text-gray-800 truncate">{group.name}</p>
    </>
  )
}
