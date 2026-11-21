import { useRef, useState } from 'react'

type Notice = { message: string; id: number }
export function useToast() {
  const [toast, setToast] = useState<Notice | null>(null)
  const sequence = useRef(0)
  function showToast(message: string) { setToast({ message, id: ++sequence.current }) }
  function dismissToast() { setToast(null) }
  return { toast, showToast, dismissToast }
}
