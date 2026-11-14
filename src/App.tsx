import { lazy, Suspense, useCallback, useState } from 'react'
import { ChatView } from '@/components/chat/ChatView'
import { Sidebar } from '@/components/layout/Sidebar'
import { SettingsView } from '@/components/settings/SettingsView'
import { VitalsView } from '@/components/vitals/VitalsView'
import { useChat } from '@/hooks/useChat'
import { useCoachSession } from '@/hooks/useCoachSession'
import { useDemo } from '@/hooks/useDemo'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { profileDataKey, useProfiles } from '@/hooks/useProfiles'
import { useSettings } from '@/hooks/useSettings'
import { useVitals } from '@/hooks/useVitals'
import { START_ROUTINE_CMD } from '@/lib/coach/classify'
import { getElevenLabsApiKey, getElevenLabsVoiceId, getExerciseApiKey } from '@/lib/env'
import { currentVitals, isCriticalVitals } from '@/lib/extractVitals'
import type { AppView } from '@/types/health'

const AvatarPanel = lazy(() =>
  import('@/components/avatar/AvatarPanel').then((m) => ({ default: m.AvatarPanel })),
)

const AVATAR_PANEL_WIDTH = 'w-80 lg:w-96 xl:w-[28rem]'

export default function App() {
  const [view, setView] = useState<AppView>('chat')
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const { settings, update } = useSettings()
  const {
    profiles,
    activeId,
    activeProfile,
    switchProfile,
    createProfile,
    renameProfile,
    deleteProfile,
  } = useProfiles()

  const chatKey = profileDataKey(activeId, 'chat')
  const vitalsKey = profileDataKey(activeId, 'vitals')
  const coachKey = profileDataKey(activeId, 'coach')

  const { session, setState: setCoachState, reset: resetCoach } = useCoachSession(coachKey)
  const { vitals, addVitalFromChat, clearVitals } = useVitals(vitalsKey)
  const { messages, isTyping, sendMessage, clearChat, logGameTelemetry } = useChat(
    vitals,
    activeProfile.name,
    settings.simulateDelayMs,
    session.state,
    session.routineSlot,
    setCoachState,
    addVitalFromChat,
    chatKey,
  )

  const routineInProgress =
    messages.length > 0 && session.state !== 'idle' && session.state !== 'debrief'
  const startRealRoutine = useCallback(() => {
    if (!routineInProgress) void sendMessage(START_ROUTINE_CMD)
  }, [routineInProgress, sendMessage])
  const { demoMessages, demoActive, startDemo, cancelDemo, notifySpeechEnd } = useDemo({
    crewName: activeProfile.name,
    exerciseApiKey: getExerciseApiKey(),
    onFinished: startRealRoutine,
  })
  const shownMessages = demoMessages ?? messages

  const showAvatar = isDesktop && view === 'chat'
  const chatStartedAt = messages[0] ? new Date(messages[0].createdAt).getTime() : Infinity
  const criticalVitals =
    !demoActive &&
    isCriticalVitals(
      currentVitals(vitals.filter((v) => new Date(v.recordedAt).getTime() >= chatStartedAt)),
    )

  return (
    <div className="flex h-dvh w-full max-w-[100vw] overflow-hidden bg-[#0A0A0B] text-zinc-50">
      <div className="hidden h-full shrink-0 md:block">
        <Sidebar
          view={view}
          onNavigate={setView}
          crewName={activeProfile.name}
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
            messages={shownMessages}
            isTyping={!demoActive && isTyping}
            criticalVitals={criticalVitals}
            demoActive={demoActive}
            onToggleDemo={() => (demoActive ? cancelDemo() : void startDemo())}
            onSpeechEnd={notifySpeechEnd}
            elevenLabsApiKey={getElevenLabsApiKey()}
            elevenLabsVoiceId={getElevenLabsVoiceId()}
            className={`shrink-0 ${AVATAR_PANEL_WIDTH}`}
          />
        </Suspense>
      )}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 border-b border-[#222226] md:hidden">
          <Sidebar
            view={view}
            onNavigate={setView}
            crewName={activeProfile.name}
            variant="mobile"
          />
        </div>

        <main className="min-h-0 min-w-0 flex-1 overflow-hidden bg-[#0A0A0B]">
          {view === 'chat' && (
            <ChatView
              messages={shownMessages}
              isTyping={!demoActive && isTyping}
              coachState={demoActive ? undefined : session.state}
              demoActive={demoActive}
              onSend={(text) => {
                if (!demoActive) void sendMessage(text)
              }}
              onClear={() => {
                if (demoActive) {
                  cancelDemo()
                  return
                }
                clearChat()
                resetCoach()
              }}
              onLogTelemetry={logGameTelemetry}
            />
          )}
          {view === 'vitals' && <VitalsView vitals={vitals} />}
          {view === 'settings' && (
            <SettingsView
              profiles={profiles}
              activeId={activeId}
              onSwitch={switchProfile}
              onCreate={createProfile}
              onRename={renameProfile}
              onDelete={deleteProfile}
              onClearChat={() => {
                clearChat()
                resetCoach()
              }}
              onClearVitals={clearVitals}
            />
          )}
        </main>
      </div>
    </div>
  )
}
