// このページはクライアントコンポーネントで metadata を直接返せないため、
// タイトルだけを持つ layout を挟んでいる。
export const metadata = { title: '新しいパスワードの設定' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
