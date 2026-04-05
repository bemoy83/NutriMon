import type { CSSProperties } from 'react'

export function ArenaPlatformImage({ src, imgStyle }: { src: string; imgStyle: CSSProperties }) {
  return (
    <img src={src} alt="" draggable={false} className="absolute z-0 object-contain" style={imgStyle} />
  )
}
