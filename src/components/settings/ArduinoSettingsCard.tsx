import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ControllerStatus } from '@/components/hardware/ControllerStatus'
import type { ArduinoLinkPhase, ArduinoTransport } from '@/hooks/useArduinoLink'
import type { HallCircuit } from '@/lib/serial/hall'

interface ArduinoSettingsCardProps {
  port: string
  baudRate: number
  bridgeUrl: string
  onPort: (port: string) => void
  onBaudRate: (baudRate: number) => void
  onBridgeUrl: (bridgeUrl: string) => void
  webSerial: boolean
  phase: ArduinoLinkPhase
  error: string | null
  hall: HallCircuit | null
  heartRate: number | null
  transport: ArduinoTransport | null
  deviceLabel: string | null
  grantedPorts: number
  onConnectSerial: () => void
  onReconnectSerial: () => void
  onConnectBridge: () => void
  onDisconnect: () => void
  onRefreshGranted: () => void
}

const fieldClass =
  'min-w-0 w-full border-[#222226] bg-[#0A0A0B] text-zinc-50 placeholder:text-zinc-600 focus-visible:border-emerald-500/50 focus-visible:ring-emerald-500/30'

export function ArduinoSettingsCard({
  port,
  baudRate,
  bridgeUrl,
  onPort,
  onBaudRate,
  onBridgeUrl,
  webSerial,
  phase,
  error,
  hall,
  heartRate,
  transport,
  deviceLabel,
  grantedPorts,
  onConnectSerial,
  onReconnectSerial,
  onConnectBridge,
  onDisconnect,
  onRefreshGranted,
}: ArduinoSettingsCardProps) {
  const [baudDraft, setBaudDraft] = useState(String(baudRate))
  const [baudFocused, setBaudFocused] = useState(false)
  const baudShown = baudFocused ? baudDraft : String(baudRate)
  const busy = phase === 'connecting'
  const open = phase === 'open'

  useEffect(() => {
    onRefreshGranted()
  }, [onRefreshGranted])

  function commitBaud() {
    const next = Number(baudDraft)
    if (!Number.isInteger(next) || next < 300 || next > 1_000_000) {
      setBaudDraft(String(baudRate))
      return
    }
    onBaudRate(next)
  }

  return (
    <Card className="min-w-0 border-[#222226] bg-[#111113] shadow-none">
      <CardHeader className="px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm text-zinc-100">Arduino controller</CardTitle>
          <ControllerStatus phase={phase} hall={hall} heartRate={heartRate} portLabel={port} />
        </div>
        <p className="text-xs font-normal text-zinc-500">
          Packets look like {`{"heart_rate_bpm":59,"hall_state":1}`}. A null heart rate means no
          pulse yet. Hall 0 is Closed and hall 1 is Opened. While a game is open, a change to
          Closed squeezes and Opened releases.
        </p>
      </CardHeader>
      <CardContent className="grid min-w-0 gap-3 px-4 pb-4 sm:px-6 sm:pb-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="arduino-port" className="text-zinc-400">
              COM port
            </Label>
            <Input
              id="arduino-port"
              value={port}
              onChange={(e) => onPort(e.target.value)}
              placeholder="COM3 or /dev/ttyUSB0"
              autoCapitalize="characters"
              spellCheck={false}
              className={fieldClass}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="arduino-baud" className="text-zinc-400">
              Baud rate
            </Label>
            <Input
              id="arduino-baud"
              inputMode="numeric"
              value={baudShown}
              onFocus={() => {
                setBaudDraft(String(baudRate))
                setBaudFocused(true)
              }}
              onChange={(e) => setBaudDraft(e.target.value.replace(/[^\d]/g, ''))}
              onBlur={() => {
                setBaudFocused(false)
                commitBaud()
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
              }}
              placeholder="9600"
              className={fieldClass}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[9600, 19200, 57600, 115200].map((rate) => (
            <Button
              key={rate}
              type="button"
              size="sm"
              variant="outline"
              aria-pressed={baudRate === rate}
              className={
                baudRate === rate
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                  : 'border-[#222226] bg-[#0A0A0B] text-zinc-400'
              }
              onClick={() => onBaudRate(rate)}
            >
              {rate}
            </Button>
          ))}
        </div>
        <p className="text-[11px] leading-relaxed text-zinc-500">
          {webSerial
            ? 'Web Serial asks Chrome or Edge to pick the device. The COM name is the label, and it is the port a bridge opens.'
            : 'This browser has no Web Serial API. Connect through a local bridge instead.'}
          {grantedPorts > 0 ? ` ${grantedPorts} device${grantedPorts === 1 ? '' : 's'} already allowed.` : ''}
        </p>

        <div className="grid gap-1.5">
          <Label htmlFor="arduino-bridge" className="text-zinc-400">
            Bridge URL
          </Label>
          <Input
            id="arduino-bridge"
            value={bridgeUrl}
            onChange={(e) => onBridgeUrl(e.target.value)}
            placeholder="ws://127.0.0.1:8765"
            spellCheck={false}
            className={fieldClass}
          />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            type="button"
            className="h-9 bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
            disabled={!webSerial || busy || open}
            onClick={onConnectSerial}
          >
            Choose port
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-9 border-[#222226] bg-[#0A0A0B] text-zinc-200 hover:bg-zinc-900"
            disabled={!webSerial || grantedPorts < 1 || busy || open}
            onClick={onReconnectSerial}
          >
            Reconnect
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-9 border-[#222226] bg-[#0A0A0B] text-zinc-200 hover:bg-zinc-900"
            disabled={!bridgeUrl.trim() || busy || open}
            onClick={onConnectBridge}
          >
            Connect bridge
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-9 border-[#222226] bg-[#0A0A0B] text-zinc-400 hover:bg-zinc-900"
            disabled={phase === 'idle' && !open}
            onClick={onDisconnect}
          >
            Disconnect
          </Button>
        </div>

        {open && (
          <p className="font-mono text-[11px] text-emerald-300/90">
            Live on {transport === 'bridge' ? 'bridge' : 'Web Serial'}
            {deviceLabel ? ` · ${deviceLabel}` : ''} · {baudRate} baud ·{' '}
            {heartRate == null ? 'no pulse' : `${heartRate} bpm`}
          </p>
        )}
        {error && (
          <p role="alert" className="text-xs text-red-300">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
