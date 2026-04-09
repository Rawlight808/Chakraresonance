export type ChakraId =
  | 'root'
  | 'sacral'
  | 'solar_plexus'
  | 'heart'
  | 'throat'
  | 'third_eye'
  | 'crown'

export type ChakraProfile = {
  id: ChakraId
  name: string
  sanskritName: string
  color: string
  colorLabel: string
  location: string
  meaning: string
  description: string
  bodyPosition: number
}

export const chakraProfiles: ChakraProfile[] = [
  {
    id: 'root',
    name: 'Root',
    sanskritName: 'Muladhara',
    color: '#E53935',
    colorLabel: 'Red',
    location: 'Base of the spine',
    meaning: 'Grounding, safety, and a sense of belonging in the physical world.',
    description:
      'The root chakra relates to stability, survival, and feeling supported by life. When it feels balanced, you are more likely to feel secure, steady, and able to meet your daily needs with trust instead of fear.',
    bodyPosition: 77.5,
  },
  {
    id: 'sacral',
    name: 'Sacral',
    sanskritName: 'Svadhisthana',
    color: '#FF7043',
    colorLabel: 'Orange',
    location: 'Lower abdomen, below the navel',
    meaning: 'Creativity, emotional flow, pleasure, and relationship to desire.',
    description:
      'The sacral chakra is associated with fluidity, sensuality, and creative expression. A balanced sacral center can support healthy emotional movement, inspired ideas, and the ability to enjoy beauty, connection, and change.',
    bodyPosition: 71.5,
  },
  {
    id: 'solar_plexus',
    name: 'Solar Plexus',
    sanskritName: 'Manipura',
    color: '#FBC02D',
    colorLabel: 'Yellow',
    location: 'Upper abdomen, above the navel',
    meaning: 'Confidence, personal power, will, and inner fire.',
    description:
      'The solar plexus chakra speaks to self-trust and empowered action. When this center is in harmony, you can move through the world with clarity, healthy boundaries, motivation, and a grounded sense of purpose.',
    bodyPosition: 60.5,
  },
  {
    id: 'heart',
    name: 'Heart',
    sanskritName: 'Anahata',
    color: '#43A047',
    colorLabel: 'Green',
    location: 'Center of the chest',
    meaning: 'Love, compassion, healing, and emotional openness.',
    description:
      'The heart chakra bridges the physical and spiritual centers of the body. Its energy is often described as generosity, forgiveness, and connection, helping you relate to yourself and others with tenderness and balance.',
    bodyPosition: 50,
  },
  {
    id: 'throat',
    name: 'Throat',
    sanskritName: 'Vishuddha',
    color: '#1E88E5',
    colorLabel: 'Blue',
    location: 'Throat and neck',
    meaning: 'Truth, communication, listening, and self-expression.',
    description:
      'The throat chakra is linked to honest communication and the ability to express what is real for you. When it feels open, speaking clearly, listening deeply, and creating from your authentic voice can feel much more natural.',
    bodyPosition: 37,
  },
  {
    id: 'third_eye',
    name: 'Third Eye',
    sanskritName: 'Ajna',
    color: '#5E35B1',
    colorLabel: 'Indigo',
    location: 'Between the eyebrows',
    meaning: 'Insight, intuition, perception, and inner wisdom.',
    description:
      'The third eye chakra represents intuition and subtle awareness. A balanced third eye can support discernment, imagination, and the ability to notice patterns or guidance that may not be obvious at first glance.',
    bodyPosition: 27,
  },
  {
    id: 'crown',
    name: 'Crown',
    sanskritName: 'Sahasrara',
    color: '#AB47BC',
    colorLabel: 'Violet',
    location: 'Top of the head',
    meaning: 'Spiritual connection, consciousness, and a sense of wholeness.',
    description:
      'The crown chakra is often described as the center of transcendence and connection to something greater. When this energy feels aligned, you may experience more perspective, reverence, and a gentle sense of unity with life.',
    bodyPosition: 11.5,
  },
]
