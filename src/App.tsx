import { lazy, Suspense, useCallback, useMemo, useState } from 'react'
import { ChatView } from '@/components/chat/ChatView'
import { Sidebar } from '@/components/layout/Sidebar'
import { SettingsView } from '@/components/settings/SettingsView'
import { SourcesView } from '@/components/sources/SourcesView'
import { VitalsView } from '@/components/vitals/VitalsView'
import { useArduinoLink } from '@/hooks/useArduinoLink'
import { useAvatarVoice } from '@/hooks/useAvatarVoice'
import { useChat } from '@/hooks/useChat'
import { useCoachSession } from '@/hooks/useCoachSession'
import { useDemo } from '@/hooks/useDemo'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { profileDataKey, useProfiles } from '@/hooks/useProfiles'
import { useSettings } from '@/hooks/useSettings'
import { useVitals } from '@/hooks/useVitals'
import { DAILY_CHECKIN_CMD } from '@/lib/coach/classify'
import type { NormalizedGameResult } from '@/lib/games/host'
import { toSpeakableText } from '@/lib/speech'
import { getElevenLabsApiKey, getElevenLabsVoiceId, getExerciseApiKey } from '@/lib/env'
import { currentVitals, isCriticalVitals } from '@/lib/extractVitals'
import { evaluateStatus } from '@/lib/health/status'
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
  const { vitals, addVitalFromChat, clearVitals, loadSampleVitals } = useVitals(vitalsKey)
  const { messages, isTyping, sendMessage, clearChat, logGameResult } = useChat(
    vitals,
    activeProfile.name,
    settings.simulateDelayMs,
    session.state,
    session.routineSlot,
    setCoachState,
    addVitalFromChat,
    settings.environment,
    chatKey,
  )
  const status = useMemo(() => evaluateStatus(vitals), [vitals])

  // Mid-exercise the tour just returns to the workout; otherwise it hands off to the check-in
  const midExercise = session.state === 'coach_set' || session.state === 'measure_strength'
  const startCheckIn = useCallback(() => {
    if (!midExercise) void sendMessage(DAILY_CHECKIN_CMD)
  }, [midExercise, sendMessage])
  const { demoMessages, demoActive, startDemo, cancelDemo, notifySpeechEnd } = useDemo({
    crewName: activeProfile.name,
    exerciseApiKey: getExerciseApiKey(),
    onFinished: startCheckIn,
  })
  const shownMessages = demoMessages ?? messages

  const arduino = useArduinoLink({ baudRate: settings.arduinoBaudRate })
  const { speak } = useAvatarVoice({
    elevenLabsApiKey: getElevenLabsApiKey(),
    elevenLabsVoiceId: getElevenLabsVoiceId(),
  })
  const showAvatar = isDesktop && view === 'chat'

  const onGameFinished = useCallback(
    (result: NormalizedGameResult) => {
      const line = logGameResult(result)
      if (line && settings.ttsEnabled && !showAvatar) {
        void speak(toSpeakableText(line))
      }
    },
    [logGameResult, settings.ttsEnabled, showAvatar, speak],
  )
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
            autoSpeak={settings.ttsEnabled}
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
              status={status}
              environment={settings.environment}
              onOpenStatus={() => setView('vitals')}
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
              onGameFinished={onGameFinished}
              controllerPhase={arduino.phase}
              controllerHall={arduino.hall}
              controllerHallTick={arduino.hallTick}
              controllerHeartRate={arduino.heartRate}
              controllerPort={settings.arduinoPort}
              onOpenControllerSettings={() => setView('settings')}
            />
          )}
          {view === 'vitals' && (
            <VitalsView
              vitals={vitals}
              environment={settings.environment}
              onStartCheckIn={() => {
                setView('chat')
                if (!demoActive) void sendMessage(DAILY_CHECKIN_CMD)
              }}
              onLoadSampleVitals={loadSampleVitals}
            />
          )}
          {view === 'sources' && <SourcesView />}
          {view === 'settings' && (
            <SettingsView
              profiles={profiles}
              activeId={activeId}
              environment={settings.environment}
              onEnvironment={(environment) => update({ environment })}
              onSwitch={switchProfile}
              onCreate={createProfile}
              onRename={renameProfile}
              onDelete={deleteProfile}
              onClearChat={() => {
                clearChat()
                resetCoach()
              }}
              onClearVitals={clearVitals}
              onLoadSampleVitals={loadSampleVitals}
              ttsEnabled={settings.ttsEnabled}
              onTtsEnabled={(ttsEnabled) => update({ ttsEnabled })}
              arduinoPort={settings.arduinoPort}
              arduinoBaudRate={settings.arduinoBaudRate}
              arduinoBridgeUrl={settings.arduinoBridgeUrl}
              onArduinoPort={(arduinoPort) => update({ arduinoPort })}
              onArduinoBaudRate={(arduinoBaudRate) => update({ arduinoBaudRate })}
              onArduinoBridgeUrl={(arduinoBridgeUrl) => update({ arduinoBridgeUrl })}
              arduinoWebSerial={arduino.webSerial}
              arduinoPhase={arduino.phase}
              arduinoError={arduino.error}
              arduinoHall={arduino.hall}
              arduinoHeartRate={arduino.heartRate}
              arduinoTransport={arduino.transport}
              arduinoDeviceLabel={arduino.deviceLabel}
              arduinoGrantedPorts={arduino.grantedPorts}
              onConnectSerial={() => void arduino.connectSerial(settings.arduinoBaudRate)}
              onReconnectSerial={() => void arduino.reconnectSerial(settings.arduinoBaudRate)}
              onConnectBridge={() =>
                void arduino.connectBridge({
                  baudRate: settings.arduinoBaudRate,
                  portLabel: settings.arduinoPort,
                  bridgeUrl: settings.arduinoBridgeUrl,
                })
              }
              onDisconnectArduino={() => void arduino.disconnect()}
              onRefreshArduinoPorts={() => void arduino.refreshGranted()}
            />
          )}
        </main>
      </div>
    </div>
  )
}
