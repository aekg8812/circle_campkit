// このページはクライアントコンポーネントで metadata を直接返せないため、
// タイトルだけを持つ layout を挟んでいる。
export const metadata = { title: 'グループを作成' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
