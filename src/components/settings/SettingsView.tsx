import { useState } from 'react'
import { Check, Plus, Trash2, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { clearAllAppData } from '@/lib/storage'
import { cn } from '@/lib/utils'
import type { CrewProfile } from '@/types/health'

interface SettingsViewProps {
  profiles: CrewProfile[]
  activeId: string
  onSwitch: (id: string) => void
  onCreate: (name: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  onClearChat: () => void
  onClearVitals: () => void
}

const fieldClass =
  'min-w-0 w-full border-[#222226] bg-[#0A0A0B] text-zinc-50 placeholder:text-zinc-600 focus-visible:border-emerald-500/50 focus-visible:ring-emerald-500/30'

export function SettingsView({
  profiles,
  activeId,
  onSwitch,
  onCreate,
  onRename,
  onDelete,
  onClearChat,
  onClearVitals,
}: SettingsViewProps) {
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  function submitCreate() {
    const name = newName.trim()
    if (!name) return
    onCreate(name)
    setNewName('')
  }

  function startRename(profile: CrewProfile) {
    setEditingId(profile.id)
    setEditName(profile.name)
  }

  function commitRename() {
    if (!editingId) return
    onRename(editingId, editName)
    setEditingId(null)
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-[#0A0A0B]">
      <header className="shrink-0 border-b border-[#222226] px-3 py-3 sm:px-4 md:px-6">
        <h1 className="text-base font-medium tracking-tight text-zinc-100">Settings</h1>
        <p className="text-xs text-zinc-500">
          Switch crew profiles — chat and vitals stay per profile
        </p>
      </header>

      <ScrollArea className="h-full min-h-0 min-w-0 flex-1 overflow-hidden">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 p-3 pb-8 sm:gap-4 sm:p-4 md:p-6">
          <Card className="min-w-0 border-[#222226] bg-[#111113] shadow-none">
            <CardHeader className="px-4 py-3 sm:px-6 sm:py-4">
              <CardTitle className="text-sm text-zinc-100">Crew profiles</CardTitle>
              <p className="text-xs font-normal text-zinc-500">
                Each profile has its own chat, vitals, and routine.
              </p>
            </CardHeader>
            <CardContent className="grid min-w-0 gap-3 px-4 pb-4 sm:px-6 sm:pb-6">
              <ul className="grid gap-2">
                {profiles.map((profile) => {
                  const active = profile.id === activeId
                  const editing = editingId === profile.id
                  return (
                    <li
                      key={profile.id}
                      className={cn(
                        'flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2.5',
                        active
                          ? 'border-emerald-500/40 bg-emerald-500/10'
                          : 'border-[#222226] bg-[#0A0A0B]',
                      )}
                    >
                      <span
                        className={cn(
                          'flex size-8 shrink-0 items-center justify-center rounded-lg border',
                          active
                            ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                            : 'border-[#222226] text-zinc-500',
                        )}
                      >
                        <UserRound className="size-4" />
                      </span>

                      {editing ? (
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitRename()
                            if (e.key === 'Escape') setEditingId(null)
                          }}
                          className={cn(fieldClass, 'h-8')}
                          autoFocus
                          aria-label="Rename profile"
                        />
                      ) : (
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left"
                          onClick={() => onSwitch(profile.id)}
                        >
                          <p className="truncate text-sm font-medium text-zinc-100">
                            {profile.name}
                          </p>
                          <p className="truncate text-[11px] text-zinc-500">
                            {active ? 'Active' : 'Tap to switch'}
                          </p>
                        </button>
                      )}

                      <div className="flex shrink-0 items-center gap-1">
                        {editing ? (
                          <Button
                            type="button"
                            size="sm"
                            className="h-8 bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
                            onClick={commitRename}
                          >
                            <Check className="size-3.5" />
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 text-xs text-zinc-400 hover:text-zinc-100"
                            onClick={() => startRename(profile)}
                          >
                            Rename
                          </Button>
                        )}
                        {profiles.length > 1 && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 text-zinc-500 hover:text-red-300"
                            aria-label={`Delete ${profile.name}`}
                            onClick={() => onDelete(profile.id)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="grid min-w-0 flex-1 gap-1.5">
                  <Label htmlFor="new-profile" className="text-zinc-400">
                    New profile
                  </Label>
                  <Input
                    id="new-profile"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') submitCreate()
                    }}
                    placeholder="Astronaut name"
                    className={fieldClass}
                  />
                </div>
                <Button
                  type="button"
                  className="h-9 shrink-0 bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
                  disabled={!newName.trim()}
                  onClick={submitCreate}
                >
                  <Plus data-icon="inline-start" />
                  Add
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="min-w-0 border-[#222226] bg-[#111113] shadow-none">
            <CardHeader className="px-4 py-3 sm:px-6 sm:py-4">
              <CardTitle className="text-sm text-zinc-100">Data controls</CardTitle>
              <p className="text-xs font-normal text-zinc-500">
                Clears data for the active profile only, except Clear Local Data.
              </p>
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
