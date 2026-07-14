import type { ContentPack, MltPrompt } from '@hpg/shared'

const p = (id: string, text: string): MltPrompt => ({ id, text })

/** Family tier — kid-safe. Plan 5 will expand these to 100+ each. */
export const mltFamily: ContentPack<MltPrompt> = {
  id: 'mlt-family-v1',
  game: 'most-likely-to',
  tone: 'family',
  locale: 'en',
  prompts: [
    p('mlt-fam-1', 'become a famous inventor'),
    p('mlt-fam-2', 'forget their own birthday'),
    p('mlt-fam-3', 'laugh at the worst possible moment'),
    p('mlt-fam-4', 'win a gold medal someday'),
    p('mlt-fam-5', 'eat dessert before dinner'),
    p('mlt-fam-6', 'get lost inside a mall'),
    p('mlt-fam-7', 'adopt ten pets'),
    p('mlt-fam-8', 'sleep through three alarms'),
    p('mlt-fam-9', 'become a teacher'),
    p('mlt-fam-10', 'talk to animals like they understand'),
  ],
}

/** Friends tier — general audience, mildly cheeky. */
export const mltFriends: ContentPack<MltPrompt> = {
  id: 'mlt-friends-v1',
  game: 'most-likely-to',
  tone: 'friends',
  locale: 'en',
  prompts: [
    p('mlt-fri-1', 'become famous accidentally'),
    p('mlt-fri-2', 'reply "lol" to terrible news'),
    p('mlt-fri-3', 'ghost the group chat for a week'),
    p('mlt-fri-4', 'cry at a commercial'),
    p('mlt-fri-5', 'spend rent money on concert tickets'),
    p('mlt-fri-6', 'forget where they parked'),
    p('mlt-fri-7', 'trip over absolutely nothing'),
    p('mlt-fri-8', 'argue with a stranger online'),
    p('mlt-fri-9', 'get a tattoo on a whim'),
    p('mlt-fri-10', 'become a millionaire and lose it all'),
  ],
}

/** Spicy tier — 18+ only; host confirms the age gate before starting. */
export const mltSpicy: ContentPack<MltPrompt> = {
  id: 'mlt-spicy-v1',
  game: 'most-likely-to',
  tone: 'spicy',
  locale: 'en',
  prompts: [
    p('mlt-spi-1', 'text an ex at 2am'),
    p('mlt-spi-2', 'have a secret dating profile'),
    p('mlt-spi-3', 'kiss a stranger on vacation'),
    p('mlt-spi-4', 'accidentally date two people at once'),
    p('mlt-spi-5', 'flirt their way out of a parking ticket'),
    p('mlt-spi-6', 'marry someone they met a month ago'),
    p('mlt-spi-7', 'have a crush on someone in this room'),
    p('mlt-spi-8', "slide into a celebrity's DMs"),
    p('mlt-spi-9', "get caught checking out their ex's profile"),
    p('mlt-spi-10', 'leave a bad date through the bathroom window'),
  ],
}
