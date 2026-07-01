'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

type Group = {
  id: string
  name: string
  image_url: string | null
}

type Props = {
  myGroups: Group[]
  otherGroups: Group[]
}

const joinSchema = z.object({
  password: z.string().min(1, 'パスワードを入力してください'),
})
type JoinForm = z.infer<typeof joinSchema>

export default function GroupsClient({ myGroups, otherGroups }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [joiningGroup, setJoiningGroup] = useState<Group | null>(null)
  const [joinError, setJoinError] = useState<string | null>(null)

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

  return (
    <div className="space-y-8">
      <Link
        href="/groups/new"
        className="block w-full text-center py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition text-sm"
      >
        ＋ 新しいグループを作成
      </Link>

      {/* 参加中のグループ */}
      <section>
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
          参加中のグループ
        </h2>
        {myGroups.length === 0 ? (
          <p className="text-center text-gray-400 py-10 text-sm bg-white rounded-2xl shadow-sm">
            まだグループに参加していません
          </p>
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

      {/* 参加可能なグループ */}
      {otherGroups.length > 0 && (
        <section>
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
            参加できるグループ
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {otherGroups.map((g) => (
              <div key={g.id} className="bg-white rounded-2xl shadow-sm p-3">
                <GroupCard group={g} />
                <button
                  onClick={() => openJoinModal(g)}
                  className="mt-2 w-full py-1.5 bg-green-50 hover:bg-green-100 text-green-700 text-xs font-semibold rounded-lg transition"
                >
                  参加する
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

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
                <input
                  {...register('password')}
                  type="password"
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
