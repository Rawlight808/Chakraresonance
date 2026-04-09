import { useEffect } from 'react'
import { ChakraJourney } from '../components/ChakraJourney'

export function JourneyPage() {
  useEffect(() => {
    document.title = 'Journey | Chakra Resonance'
  }, [])

  return <ChakraJourney />
}
