import { useCallback, useEffect, useRef, useState } from 'react'
import { pullSensorSamples, type HallCircuit, type SensorSample } from '@/lib/serial/hall'

export type ArduinoLinkPhase = 'idle' | 'connecting' | 'open' | 'error'
export type ArduinoTransport = 'web-serial' | 'bridge'

export interface ArduinoConnectOptions {
  baudRate: number
  /** COM label sent to a bridge and shown in the UI. Web Serial picks the device itself. */
  portLabel: string
  bridgeUrl: string
}

function serialApi(): Serial | null {
  if (typeof navigator === 'undefined' || !('serial' in navigator)) return null
  return navigator.serial ?? null
}

function linkError(err: unknown, fallback: string): string {
  if (err instanceof DOMException && err.name === 'NotFoundError') return ''
  if (err instanceof Error && err.message) return err.message
  return fallback
}

interface UseArduinoLinkOptions {
  /** Baud used when reopening a previously allowed Web Serial port. */
  baudRate?: number
  /** Reopen the last allowed Web Serial device on mount. Default true. */
  autoConnect?: boolean
}

export function useArduinoLink({
  baudRate = 9600,
  autoConnect = true,
}: UseArduinoLinkOptions = {}) {
  const [phase, setPhase] = useState<ArduinoLinkPhase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [hall, setHall] = useState<HallCircuit | null>(null)
  const [hallTick, setHallTick] = useState(0)
  const [heartRate, setHeartRate] = useState<number | null>(null)
  const [transport, setTransport] = useState<ArduinoTransport | null>(null)
  const [grantedPorts, setGrantedPorts] = useState(0)
  const [deviceLabel, setDeviceLabel] = useState<string | null>(null)

  const generation = useRef(0)
  const hallRef = useRef<HallCircuit | null>(null)
  const heartRef = useRef<number | null>(null)
  const pulseHold = useRef<number | null>(null)
  const userClosed = useRef(false)
  const portRef = useRef<SerialPort | null>(null)
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const webSerial = serialApi() !== null

  const noteHall = useCallback((circuit: HallCircuit) => {
    if (hallRef.current === circuit) return
    hallRef.current = circuit
    setHall(circuit)
    setHallTick((tick) => tick + 1)
  }, [])

  const noteSample = useCallback(
    (sample: SensorSample) => {
      if (sample.hall !== null) noteHall(sample.hall)
      if (sample.heartRateBpm === undefined) return
      if (typeof sample.heartRateBpm === 'number') {
        if (pulseHold.current) {
          window.clearTimeout(pulseHold.current)
          pulseHold.current = null
        }
        if (heartRef.current === sample.heartRateBpm) return
        heartRef.current = sample.heartRateBpm
        setHeartRate(sample.heartRateBpm)
        return
      }
      // A lone null between beats should not wipe a reading the crew can still log.
      if (heartRef.current == null || pulseHold.current) return
      pulseHold.current = window.setTimeout(() => {
        pulseHold.current = null
        heartRef.current = null
        setHeartRate(null)
      }, 1500)
    },
    [noteHall],
  )

  const ingest = useCallback(
    (chunk: string, bufferRef: { current: string }) => {
      bufferRef.current += chunk
      const pulled = pullSensorSamples(bufferRef.current)
      bufferRef.current = pulled.rest
      for (const sample of pulled.samples) noteSample(sample)
    },
    [noteSample],
  )

  const closeCurrent = useCallback(async () => {
    generation.current += 1
    const reader = readerRef.current
    readerRef.current = null
    if (reader) {
      try {
        await reader.cancel()
      } catch {
        /* port already closing */
      }
    }
    const port = portRef.current
    portRef.current = null
    if (port) {
      try {
        await port.close()
      } catch {
        /* already closed */
      }
    }
    const socket = socketRef.current
    socketRef.current = null
    if (socket) {
      socket.onopen = null
      socket.onmessage = null
      socket.onerror = null
      socket.onclose = null
      socket.close()
    }
  }, [])

  const pumpSerial = useCallback(
    async (port: SerialPort, gen: number) => {
      const readable = port.readable
      if (!readable) throw new Error('The serial port has no readable stream.')
      const reader = readable.getReader()
      readerRef.current = reader
      const decoder = new TextDecoder()
      const bufferRef = { current: '' }
      try {
        while (generation.current === gen) {
          const { value, done } = await reader.read()
          if (done || generation.current !== gen) break
          if (value) ingest(decoder.decode(value, { stream: true }), bufferRef)
        }
      } finally {
        try {
          reader.releaseLock()
        } catch {
          /* lock already released */
        }
        if (readerRef.current === reader) readerRef.current = null
      }
    },
    [ingest],
  )

  const openPort = useCallback(
    async (port: SerialPort, baudRate: number) => {
      await closeCurrent()
      const gen = generation.current
      await port.open({ baudRate })
      if (generation.current !== gen) {
        try {
          await port.close()
        } catch {
          /* superseded */
        }
        return
      }
      portRef.current = port
      const info = port.getInfo()
      setDeviceLabel(
        info.usbVendorId != null
          ? `USB ${info.usbVendorId.toString(16)}:${(info.usbProductId ?? 0).toString(16)}`
          : 'Serial device',
      )
      setTransport('web-serial')
      setPhase('open')
      setError(null)
      void pumpSerial(port, gen)
        .then(() => {
          if (generation.current !== gen) return
          heartRef.current = null
          setHeartRate(null)
          setTransport(null)
          setPhase('idle')
        })
        .catch((err: unknown) => {
          if (generation.current !== gen) return
          setPhase('error')
          setError(linkError(err, 'Serial read failed.') || 'Serial read failed.')
        })
    },
    [closeCurrent, pumpSerial],
  )

  const refreshGranted = useCallback(async () => {
    const serial = serialApi()
    if (!serial) return
    const ports = await serial.getPorts()
    setGrantedPorts(ports.length)
  }, [])

  const connectSerial = useCallback(
    async (baudRate: number) => {
      const serial = serialApi()
      if (!serial) {
        setPhase('error')
        setError('This browser cannot open serial ports. Use Chrome or Edge, or connect a bridge.')
        return
      }
      userClosed.current = false
      setPhase('connecting')
      setError(null)
      try {
        const port = await serial.requestPort()
        await openPort(port, baudRate)
        await refreshGranted()
      } catch (err) {
        const message = linkError(err, 'Could not open the serial port.')
        if (!message) {
          setPhase(portRef.current ? 'open' : 'idle')
          return
        }
        setPhase('error')
        setError(message)
      }
    },
    [openPort, refreshGranted],
  )

  const reconnectSerial = useCallback(
    async (baudRate: number) => {
      const serial = serialApi()
      if (!serial) {
        setPhase('error')
        setError('This browser cannot open serial ports. Use Chrome or Edge, or connect a bridge.')
        return
      }
      userClosed.current = false
      setPhase('connecting')
      setError(null)
      try {
        const ports = await serial.getPorts()
        const port = ports[ports.length - 1]
        if (!port) {
          setPhase('idle')
          setError('No serial device has been allowed yet. Choose a port first.')
          return
        }
        await openPort(port, baudRate)
      } catch (err) {
        setPhase('error')
        setError(linkError(err, 'Could not reopen the serial port.') || 'Could not reopen the serial port.')
      }
    },
    [openPort],
  )

  const connectBridge = useCallback(
    async ({ baudRate, portLabel, bridgeUrl }: ArduinoConnectOptions) => {
      const url = bridgeUrl.trim()
      if (!url) {
        setPhase('error')
        setError('Enter a bridge WebSocket URL first.')
        return
      }
      userClosed.current = false
      setPhase('connecting')
      setError(null)
      await closeCurrent()
      const gen = generation.current
      let socket: WebSocket
      try {
        socket = new WebSocket(url)
      } catch (err) {
        setPhase('error')
        setError(linkError(err, 'Could not open the bridge URL.') || 'Could not open the bridge URL.')
        return
      }
      if (generation.current !== gen) {
        socket.close()
        return
      }
      socketRef.current = socket
      const bufferRef = { current: '' }

      socket.onopen = () => {
        if (generation.current !== gen) return
        socket.send(
          JSON.stringify({
            type: 'open',
            port: portLabel.trim() || undefined,
            baudRate,
          }),
        )
        setTransport('bridge')
        setDeviceLabel(portLabel.trim() || url)
        setPhase('open')
        setError(null)
      }
      socket.onmessage = (event) => {
        if (generation.current !== gen || typeof event.data !== 'string') return
        ingest(event.data.endsWith('\n') ? event.data : `${event.data}\n`, bufferRef)
      }
      socket.onerror = () => {
        if (generation.current !== gen) return
        setPhase('error')
        setError('The bridge connection failed.')
      }
      socket.onclose = () => {
        if (generation.current !== gen) return
        heartRef.current = null
        setHeartRate(null)
        setPhase('idle')
        setTransport(null)
        if (socketRef.current === socket) socketRef.current = null
      }
    },
    [closeCurrent, ingest],
  )

  const disconnect = useCallback(async () => {
    userClosed.current = true
    await closeCurrent()
    if (pulseHold.current) {
      window.clearTimeout(pulseHold.current)
      pulseHold.current = null
    }
    hallRef.current = null
    heartRef.current = null
    setHall(null)
    setHeartRate(null)
    setTransport(null)
    setDeviceLabel(null)
    setPhase('idle')
    setError(null)
  }, [closeCurrent])

  useEffect(() => {
    const serial = serialApi()
    if (!serial) return
    const onDisconnect = () => {
      if (!portRef.current) return
      void disconnect().then(() => {
        setError('Controller unplugged.')
        setPhase('error')
      })
    }
    serial.addEventListener('disconnect', onDisconnect)
    return () => serial.removeEventListener('disconnect', onDisconnect)
  }, [disconnect])

  useEffect(() => {
    return () => {
      if (pulseHold.current) window.clearTimeout(pulseHold.current)
      void closeCurrent()
    }
  }, [closeCurrent])

  // Reopen a port the crew already allowed so heart-rate cards see the sensor after refresh.
  useEffect(() => {
    if (!autoConnect || userClosed.current) return
    let cancelled = false
    void (async () => {
      const serial = serialApi()
      if (!serial) return
      try {
        const ports = await serial.getPorts()
        if (cancelled || userClosed.current) return
        setGrantedPorts(ports.length)
        const port = ports[ports.length - 1]
        if (!port || portRef.current || socketRef.current) return
        setPhase('connecting')
        setError(null)
        await openPort(port, baudRate)
      } catch (err) {
        if (cancelled || userClosed.current) return
        setPhase('idle')
        setError(linkError(err, 'Could not reopen the finger sensor.') || null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [autoConnect, baudRate, openPort])

  return {
    webSerial,
    phase,
    error,
    hall,
    hallTick,
    heartRate,
    transport,
    grantedPorts,
    deviceLabel,
    connectSerial,
    reconnectSerial,
    connectBridge,
    disconnect,
    refreshGranted,
  }
}
