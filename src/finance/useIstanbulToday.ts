import { useEffect, useState } from 'react'
import { todayIstanbul } from '../utils/day'
export function useIstanbulToday() {
  const [today, setToday] = useState(todayIstanbul)
  useEffect(() => {
    const update = () => setToday(todayIstanbul())
    const timer = window.setInterval(update, 30_000)
    window.addEventListener('focus', update)
    return () => { clearInterval(timer); window.removeEventListener('focus', update) }
  }, [])
  return today
}
