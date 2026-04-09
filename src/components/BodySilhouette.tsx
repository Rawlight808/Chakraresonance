import chakraBodyReference from '../assets/chakra-body-reference.png'

type Props = {
  activeChakraId: string
  activeColor: string
}

export function BodySilhouette({ activeChakraId: _activeChakraId, activeColor: _activeColor }: Props) {
  return (
    <div className="body-silhouette">
      <img
        src={chakraBodyReference}
        alt="Meditating figure with chakra points"
        className="body-silhouette__image"
        loading="lazy"
      />
    </div>
  )
}
