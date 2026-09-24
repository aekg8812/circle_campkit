// LINEで共有するためのURLを組み立てる。
// LIFF IDが設定されていれば LIFF URL を返し、タップするとLINEアプリ内で
// そのままアプリが開く（通常URLだとLIFFとして認識されず、ログインが余計に一手間増える）。
// LIFF IDが無い環境では、従来どおり現在のドメインのURLを返す。

export function buildShareUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID

  if (liffId) {
    return `https://liff.line.me/${liffId}${normalized}`
  }

  if (typeof window === 'undefined') return normalized
  return `${window.location.origin}${normalized}`
}
