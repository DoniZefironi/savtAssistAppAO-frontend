'use client'

import { useCallback, useRef, useState } from 'react'

export function useVoiceRecorder(onFinish: (blob: Blob, duration: number) => void) {
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/ogg; codecs=opus' })
        const duration = Math.round((Date.now() - startTimeRef.current) / 1000)
        onFinish(blob, duration)
        setSeconds(0)
      }
      mr.start(200)
      mediaRef.current = mr
      startTimeRef.current = Date.now()
      setRecording(true)
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000)
    } catch {
      alert('Нет доступа к микрофону')
    }
  }, [onFinish])

  const stop = useCallback(() => {
    mediaRef.current?.stop()
    mediaRef.current = null
    if (timerRef.current) clearInterval(timerRef.current)
    setRecording(false)
  }, [])

  const cancel = useCallback(() => {
    if (mediaRef.current) {
      mediaRef.current.onstop = null
      mediaRef.current.stop()
      mediaRef.current = null
    }
    if (timerRef.current) clearInterval(timerRef.current)
    setRecording(false)
    setSeconds(0)
  }, [])

  return { recording, seconds, start, stop, cancel }
}
