import { lazy, Suspense, useState } from 'react'
import { ChatView } from '@/components/chat/ChatView'
import { Sidebar } from '@/components/layout/Sidebar'
import { SettingsView } from '@/components/settings/SettingsView'
import { SymptomLogView } from '@/components/symptoms/SymptomLogView'
import { VitalsView } from '@/components/vitals/VitalsView'
import { useChat } from '@/hooks/useChat'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useSettings } from '@/hooks/useSettings'
import { useSymptoms } from '@/hooks/useSymptoms'
import { useVitals } from '@/hooks/useVitals'
import type { AppView } from '@/types/health'

const AvatarPanel = lazy(() =>
  import('@/components/avatar/AvatarPanel').then((m) => ({ default: m.AvatarPanel })),
)

const AVATAR_PANEL_WIDTH = 'w-64 lg:w-72'

export default function App() {
  const [view, setView] = useState<AppView>('chat')
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const { settings, update } = useSettings()
  const { vitals, addVitalFromChat, clearVitals } = useVitals()
  const { symptoms, addSymptom, removeSymptom, clearSymptoms } = useSymptoms()
  const { messages, isTyping, sendMessage, clearChat } = useChat(
    vitals,
    symptoms,
    settings.simulateDelayMs,
    addVitalFromChat,
  )

  const showAvatar = isDesktop && view === 'chat'

  return (
    <div className="flex h-dvh w-full max-w-[100vw] overflow-hidden bg-[#0A0A0B] text-zinc-50">
      <div className="hidden h-full shrink-0 md:block">
        <Sidebar
          view={view}
          onNavigate={setView}
          crewName={settings.crewName}
          variant="desktop"
          collapsed={settings.sidebarCollapsed}
          onToggleCollapsed={() => update({ sidebarCollapsed: !settings.sidebarCollapsed })}
        />
      </div>

      {showAvatar && (
        <Suspense
          fallback={
            <div className={`h-full shrink-0 border-r border-[#222226] ${AVATAR_PANEL_WIDTH}`} />
          }
        >
          <AvatarPanel
            messages={messages}
            isTyping={isTyping}
            className={`shrink-0 ${AVATAR_PANEL_WIDTH}`}
          />
        </Suspense>
      )}

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
