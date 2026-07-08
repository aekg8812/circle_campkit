import { MountainScene } from '@/components/MountainScene'

// 認証まわり（ログイン/新規登録/パスワード再設定）の共通レイアウト。
// トップページと同じアウトドア背景を敷き、上に白いカードを中央表示する。
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <MountainScene />
      {/* 背景を少し落ち着かせてカードを引き立てる */}
      <div className="absolute inset-0 bg-black/20" />
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-10">
        {children}
      </div>
    </div>
  )
}
