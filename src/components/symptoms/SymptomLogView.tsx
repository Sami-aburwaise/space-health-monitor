import { useState, type FormEvent } from 'react'
import { NotebookPen, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/shared/EmptyState'
import type { SymptomEntry } from '@/types/health'

interface SymptomLogViewProps {
  symptoms: SymptomEntry[]
  onAdd: (input: Omit<SymptomEntry, 'id' | 'recordedAt'>) => void
  onRemove: (id: string) => void
}

export function SymptomLogView({ symptoms, onAdd, onRemove }: SymptomLogViewProps) {
  const [symptom, setSymptom] = useState('')
  const [severity, setSeverity] = useState('')
  const [duration, setDuration] = useState('')
  const [notes, setNotes] = useState('')
  const isEmpty = symptoms.length === 0

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!symptom.trim()) return
    const sev = Math.min(5, Math.max(1, Number(severity) || 1)) as 1 | 2 | 3 | 4 | 5
    onAdd({
      symptom: symptom.trim(),
      severity: sev,
      duration: duration.trim() || 'unspecified',
      notes: notes.trim() || undefined,
    })
    setSymptom('')
    setSeverity('')
    setDuration('')
    setNotes('')
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-950">
      <header className="border-b border-slate-800 px-4 py-3 md:px-6">
        <h1 className="text-base font-semibold tracking-tight text-slate-50">Symptom Log</h1>
        <p className="text-xs text-slate-400">
          Track how you feel over time — used by the local chat triage
        </p>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto grid max-w-3xl gap-4 p-4 md:grid-cols-2 md:p-6">
          {isEmpty && (
            <EmptyState
              className="md:col-span-2"
              icon={
                <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 shadow-lg shadow-emerald-500/10">
                  <NotebookPen className="size-5" />
                </div>
              }
              title="No symptoms logged yet"
              description="Add an entry here, or describe how you feel in chat."
            />
          )}

          <Card className="border-slate-800 bg-slate-900 shadow-none">
            <CardHeader>
              <CardTitle className="text-sm text-slate-50">Add symptom</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="grid gap-3" onSubmit={submit}>
                <div className="grid gap-1.5">
                  <Label htmlFor="symptom" className="text-slate-300">
                    Symptom
                  </Label>
                  <Input
                    id="symptom"
                    value={symptom}
                    onChange={(e) => setSymptom(e.target.value)}
                    placeholder="e.g. headache, nausea"
                    required
                    className="border-slate-800 bg-slate-950 text-slate-50 placeholder:text-slate-500 focus-visible:border-emerald-500/50 focus-visible:ring-emerald-500/30"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="severity" className="text-slate-300">
                    Severity (1–5)
                  </Label>
                  <Input
                    id="severity"
                    type="number"
                    min={1}
                    max={5}
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value)}
                    placeholder="e.g. 2"
                    required
                    className="border-slate-800 bg-slate-950 text-slate-50 placeholder:text-slate-500 focus-visible:border-emerald-500/50 focus-visible:ring-emerald-500/30"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="duration" className="text-slate-300">
                    Duration
                  </Label>
                  <Input
                    id="duration"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="e.g. 2 hours"
                    className="border-slate-800 bg-slate-950 text-slate-50 placeholder:text-slate-500 focus-visible:border-emerald-500/50 focus-visible:ring-emerald-500/30"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="symptom-notes" className="text-slate-300">
                    Notes
                  </Label>
                  <Textarea
                    id="symptom-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="border-slate-800 bg-slate-950 text-slate-50 placeholder:text-slate-500 focus-visible:border-emerald-500/50 focus-visible:ring-emerald-500/30"
                  />
                </div>
                <Button
                  type="submit"
                  className="bg-emerald-500 text-emerald-950 shadow-md shadow-emerald-500/15 hover:bg-emerald-400"
                >
                  <Plus data-icon="inline-start" />
                  Save entry
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900 shadow-none">
            <CardHeader>
              <CardTitle className="text-sm text-slate-50">Entries</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {isEmpty && (
                <p className="text-sm text-slate-400">No symptoms logged yet.</p>
              )}
              {symptoms.map((s) => (
                <div
                  key={s.id}
                  className="flex items-start justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2"
                >
                  <div className="min-w-0 text-left">
                    <p className="text-sm font-medium text-slate-100">
                      {s.symptom}{' '}
                      <span className="text-slate-400">· sev {s.severity}/5</span>
                    </p>
                    <p className="text-xs text-slate-400">
                      {new Date(s.recordedAt).toLocaleString()} · {s.duration}
                      {s.notes ? ` · ${s.notes}` : ''}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    className="text-slate-400 hover:text-red-300"
                    aria-label="Delete symptom"
                    onClick={() => onRemove(s.id)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  )
}
