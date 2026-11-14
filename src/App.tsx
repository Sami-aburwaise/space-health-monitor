import { useState } from 'react'
import { ChatView } from '@/components/chat/ChatView'
import { Sidebar } from '@/components/layout/Sidebar'
import { SettingsView } from '@/components/settings/SettingsView'
import { SymptomLogView } from '@/components/symptoms/SymptomLogView'
import { VitalsView } from '@/components/vitals/VitalsView'
import { useChat } from '@/hooks/useChat'
import { useSettings } from '@/hooks/useSettings'
import { useSymptoms } from '@/hooks/useSymptoms'
import { useVitals } from '@/hooks/useVitals'
import type { AppView } from '@/types/health'

export default function App() {
  const [view, setView] = useState<AppView>('chat')
  const { settings, update } = useSettings()
  const { vitals, addVitalFromChat, clearVitals } = useVitals()
  const { symptoms, addSymptom, removeSymptom, clearSymptoms } = useSymptoms()
  const { messages, isTyping, sendMessage, clearChat } = useChat(
    vitals,
    symptoms,
    settings.simulateDelayMs,
    addVitalFromChat,
  )

  return (
    <div className="flex h-dvh w-full max-w-[100vw] overflow-hidden bg-[#0A0A0B] text-zinc-50">
      <div className="hidden h-full shrink-0 md:block">
        <Sidebar
          view={view}
          onNavigate={setView}
          crewName={settings.crewName}
          variant="desktop"
        />
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 border-b border-[#222226] md:hidden">
          <Sidebar
            view={view}
            onNavigate={setView}
            crewName={settings.crewName}
            variant="mobile"
          />
        </div>

        <main className="min-h-0 min-w-0 flex-1 overflow-hidden bg-[#0A0A0B]">
          {view === 'chat' && (
            <ChatView
              messages={messages}
              isTyping={isTyping}
              onSend={sendMessage}
              onClear={clearChat}
            />
          )}
          {view === 'vitals' && <VitalsView vitals={vitals} />}
          {view === 'symptoms' && (
            <SymptomLogView
              symptoms={symptoms}
              onAdd={addSymptom}
              onRemove={removeSymptom}
            />
          )}
          {view === 'settings' && (
            <SettingsView
              settings={settings}
              onUpdate={update}
              onClearChat={clearChat}
              onClearVitals={clearVitals}
              onClearSymptoms={clearSymptoms}
            />
          )}
        </main>
      </div>
    </div>
  )
}
