import type { CSSProperties } from 'react'
import chakraBodyReference from '../assets/chakra-body-reference.png'

type Props = {
  activeChakraId: string
  activeColor: string
}

const CHAKRA_Y: Record<string, number> = {
  root: 77.5,
  sacral: 71.5,
  solar_plexus: 60.5,
  heart: 50,
  throat: 37,
  third_eye: 27,
  crown: 11.5,
}

export function BodySilhouette({ activeChakraId, activeColor }: Props) {
  const dotY = CHAKRA_Y[activeChakraId] ?? 50

  return (
    <div className="body-silhouette">
      <img
        src={chakraBodyReference}
        alt="Meditating figure with chakra points"
        className="body-silhouette__image"
        loading="lazy"
      />
      <span
        className="body-silhouette__pulse"
        style={{
          '--pulse-y': `${dotY}%`,
          '--pulse-color': activeColor,
        } as CSSProperties}
        aria-hidden="true"
      />
    </div>
  )
}
