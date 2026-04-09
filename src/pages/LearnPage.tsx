import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export function LearnPage() {
  const navigate = useNavigate()

  useEffect(() => {
    navigate('/', { replace: true, state: { scrollTo: 'learn' } })
  }, [navigate])

  return null
}
