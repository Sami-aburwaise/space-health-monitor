import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { clearAllAppData } from '@/lib/storage'
import type { AppSettings } from '@/types/health'

interface SettingsViewProps {
  settings: AppSettings
  onUpdate: (patch: Partial<AppSettings>) => void
  onClearChat: () => void
  onClearVitals: () => void
  onClearSymptoms: () => void
}

const fieldClass =
  'min-w-0 w-full border-[#222226] bg-[#0A0A0B] text-zinc-50 placeholder:text-zinc-600 focus-visible:border-emerald-500/50 focus-visible:ring-emerald-500/30'

export function SettingsView({
  settings,
  onUpdate,
  onClearChat,
  onClearVitals,
  onClearSymptoms,
}: SettingsViewProps) {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-[#0A0A0B]">
      <header className="shrink-0 border-b border-[#222226] px-3 py-3 sm:px-4 md:px-6">
        <h1 className="text-base font-medium tracking-tight text-zinc-100">
          Settings & Disclaimer
        </h1>
        <p className="text-xs text-zinc-500">
          Local preferences only — nothing leaves this device
        </p>
      </header>

      <ScrollArea className="h-full min-h-0 min-w-0 flex-1 overflow-hidden">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 p-3 pb-8 sm:gap-4 sm:p-4 md:p-6">
          <Card className="min-w-0 border-[#222226] bg-[#111113] shadow-none">
            <CardHeader className="px-4 py-3 sm:px-6 sm:py-4">
              <CardTitle className="text-sm text-zinc-100">Profile</CardTitle>
            </CardHeader>
            <CardContent className="grid min-w-0 gap-3 px-4 pb-4 sm:px-6 sm:pb-6">
              <div className="grid min-w-0 gap-1.5">
                <Label htmlFor="crew-name" className="text-zinc-400">
                  Display name
                </Label>
                <Input
                  id="crew-name"
                  value={settings.crewName}
                  onChange={(e) => onUpdate({ crewName: e.target.value })}
                  placeholder="Optional"
                  className={fieldClass}
                />
              </div>
              <div className="grid min-w-0 gap-1.5">
                <Label htmlFor="api-key" className="text-zinc-400">
                  API key (local only)
                </Label>
                <Input
                  id="api-key"
                  type="password"
                  autoComplete="off"
                  value={settings.apiKey}
                  onChange={(e) => onUpdate({ apiKey: e.target.value })}
                  placeholder="Stored in localStorage only"
                  className={fieldClass}
                />
                <p className="text-[11px] text-zinc-600">
                  Never synced. Cleared when you wipe local data.
                </p>
              </div>
              <div className="grid min-w-0 gap-1.5">
                <Label htmlFor="delay" className="text-zinc-400">
                  Simulated reply delay (ms)
                </Label>
                <Input
                  id="delay"
                  type="number"
                  min={0}
                  max={5000}
                  step={100}
                  value={settings.simulateDelayMs}
                  onChange={(e) =>
                    onUpdate({ simulateDelayMs: Number(e.target.value) || 0 })
                  }
                  className={fieldClass}
                />
              </div>
              <label className="flex items-start gap-2 text-sm leading-snug text-zinc-400">
                <input
                  type="checkbox"
                  className="mt-1 size-4 shrink-0 accent-emerald-500"
                  checked={settings.disclaimerAccepted}
                  onChange={(e) => onUpdate({ disclaimerAccepted: e.target.checked })}
                />
                <span className="min-w-0 break-words">
                  I understand this is a hackathon demo with simulated triage, not medical
                  advice, diagnosis, or emergency care.
                </span>
              </label>
            </CardContent>
          </Card>

          <Card className="min-w-0 border-[#222226] bg-[#111113] shadow-none">
            <CardHeader className="px-4 py-3 sm:px-6 sm:py-4">
              <CardTitle className="text-sm text-zinc-100">Medical disclaimer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 px-4 pb-4 text-sm leading-relaxed break-words text-zinc-500 sm:px-6 sm:pb-6">
              <p>
                Space Health Monitor stores chat, vitals, symptoms, and API keys only in your
                browser&apos;s localStorage. There is no cloud backend and no clinician on call.
              </p>
              <p>
                Responses are rule-based simulations for demo purposes. Do not rely on them for
                real medical decisions. In an emergency, contact local emergency services or your
                designated medical officer immediately.
              </p>
            </CardContent>
          </Card>

          <Card className="min-w-0 border-[#222226] bg-[#111113] shadow-none">
            <CardHeader className="px-4 py-3 sm:px-6 sm:py-4">
              <CardTitle className="text-sm text-zinc-100">Data controls</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 px-4 pb-4 sm:px-6 sm:pb-6">
              <Button
                type="button"
                variant="outline"
                className="h-9 w-full justify-center border-[#222226] bg-[#0A0A0B] text-zinc-200 hover:bg-zinc-900 sm:justify-start"
                onClick={onClearChat}
              >
                Clear chat history
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-9 w-full justify-center border-[#222226] bg-[#0A0A0B] text-zinc-200 hover:bg-zinc-900 sm:justify-start"
                onClick={onClearVitals}
              >
                Clear vitals
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-9 w-full justify-center border-[#222226] bg-[#0A0A0B] text-zinc-200 hover:bg-zinc-900 sm:justify-start"
                onClick={onClearSymptoms}
              >
                Clear symptoms
              </Button>
              <Separator className="my-1 bg-[#222226]" />
              <Button
                type="button"
                variant="destructive"
                className="h-9 w-full bg-red-500/15 text-red-300 hover:bg-red-500/25"
                onClick={() => {
                  clearAllAppData()
                  window.location.reload()
                }}
              >
                Clear Local Data
              </Button>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  )
}
