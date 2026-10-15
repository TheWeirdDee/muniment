/**
 * One polite live region for meaningful asynchronous changes (results loaded, transaction stages).
 * Messages are deduplicated so screen readers are not flooded by polling.
 */
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react"

const Ctx = createContext<(msg: string) => void>(() => {})

export function AnnouncerProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState("")
  const last = useRef("")
  const announce = useCallback((m: string) => {
    if (m === last.current) return
    last.current = m
    setMsg("")
    window.setTimeout(() => setMsg(m), 60)
  }, [])
  return (
    <Ctx.Provider value={announce}>
      {children}
      <div className="visually-hidden" aria-live="polite" aria-atomic="true">
        {msg}
      </div>
    </Ctx.Provider>
  )
}

export const useAnnounce = () => useContext(Ctx)
