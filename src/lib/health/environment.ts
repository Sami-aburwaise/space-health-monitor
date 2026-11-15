import type { MissionEnvironment } from '@/types/health'

export interface EnvironmentInfo {
  id: MissionEnvironment
  label: string
  /** One-way signal delay to mission control */
  commsDelay: string
  gravity: string
  /** First step of every alert: how to reach the flight surgeon from here */
  contactGround: string
  /** How to reach family from here, said warmly */
  familyContact: string
  /** Something calming to look at from here */
  calmView: string
}

export const ENVIRONMENTS: Record<MissionEnvironment, EnvironmentInfo> = {
  station: {
    id: 'station',
    label: 'Space station',
    commsDelay: 'Near-live link (under 1 s)',
    gravity: 'Microgravity',
    contactGround: 'Call the flight surgeon on the space-to-ground loop now.',
    familyContact:
      'You can call home on the station phone, or ask the ground team to set up a private video call with your family.',
    calmView: 'Float over to the window and watch Earth go by for a few minutes.',
  },
  moon: {
    id: 'moon',
    label: 'Moon base',
    commsDelay: 'About 1.3 s each way',
    gravity: '1/6 of Earth gravity',
    contactGround: 'Call the flight surgeon now. Expect a few seconds of delay in each reply.',
    familyContact:
      'Call home. There is only a few seconds of delay, so it still feels like a real conversation.',
    calmView: 'Look out at Earth hanging in the sky for a few minutes.',
  },
  mars: {
    id: 'mars',
    label: 'Mars habitat',
    commsDelay: '4 to 24 min each way',
    gravity: '3/8 of Earth gravity',
    contactGround:
      'Send the alert to the flight surgeon now. A reply can take up to 48 minutes, so follow the onboard steps and tell your Crew Medical Officer while you wait.',
    familyContact:
      'Live calls are not possible from Mars, but you can record a video message for your family. Their reply can arrive the same day, and you can watch it as many times as you like.',
    calmView: 'Look through your photos and videos from home for a few minutes.',
  },
  rover: {
    id: 'rover',
    label: 'Surface rover',
    commsDelay: 'Relayed through the habitat',
    gravity: 'Partial gravity',
    contactGround:
      'Stop driving, radio the habitat, and have them relay your readings to the flight surgeon.',
    familyContact:
      'Once you are parked or back at the habitat, record a message for your family, or ask the habitat to relay one for you.',
    calmView: 'Park somewhere safe and take a minute to look at the view outside.',
  },
}

export const ENVIRONMENT_ORDER: MissionEnvironment[] = ['station', 'moon', 'mars', 'rover']
