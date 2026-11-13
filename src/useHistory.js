import { useEffect, useRef, useState } from 'react'

export function useHistory(value, maxPoints = 40, intervalMs = 1000) {
  const [history, setHistory] = useState([])
  const valueRef = useRef(value)

  useEffect(() => {
    valueRef.current = value
  }, [value])

  useEffect(() => {
    const id = setInterval(() => {
      const v = valueRef.current
      if (v === null || v === undefined) return
      setHistory((prev) => {
        const next = [...prev, Number(v)]
        return next.length > maxPoints ? next.slice(next.length - maxPoints) : next
      })
    }, intervalMs)
    return () => clearInterval(id)
  }, [maxPoints, intervalMs])

  return history
}
