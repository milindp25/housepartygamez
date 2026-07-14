import type { ContentPack, NhiePrompt } from '@hpg/shared'

const p = (id: string, text: string): NhiePrompt => ({ id, text })

/** Family tier — kid-safe. Statements complete "Never have I ever …". */
export const nhieFamily: ContentPack<NhiePrompt> = {
  id: 'nhie-family-v1',
  game: 'never-have-i-ever',
  tone: 'family',
  locale: 'en',
  prompts: [
    p('nhie-fam-1', 'broken a bone'),
    p('nhie-fam-2', 'stayed up all night'),
    p('nhie-fam-3', 'eaten food off the floor'),
    p('nhie-fam-4', "forgotten someone's name mid-conversation"),
    p('nhie-fam-5', 'sung in the shower'),
    p('nhie-fam-6', 'lost a library book'),
    p('nhie-fam-7', 'talked to myself out loud'),
    p('nhie-fam-8', 'pretended to be asleep'),
    p('nhie-fam-9', 'been on TV'),
    p('nhie-fam-10', 'had a secret handshake'),
  ],
}

/** Friends tier — general audience, mildly cheeky. */
export const nhieFriends: ContentPack<NhiePrompt> = {
  id: 'nhie-friends-v1',
  game: 'never-have-i-ever',
  tone: 'friends',
  locale: 'en',
  prompts: [
    p('nhie-fri-1', 'missed a flight'),
    p('nhie-fri-2', 'fallen asleep at the movies'),
    p('nhie-fri-3', 'texted the wrong person'),
    p('nhie-fri-4', 'pretended to know a song'),
    p('nhie-fri-5', 'googled myself'),
    p('nhie-fri-6', 'laughed till I cried in public'),
    p('nhie-fri-7', "forgotten a friend's birthday"),
    p('nhie-fri-8', 'lied about my age'),
    p('nhie-fri-9', 'walked into a glass door'),
    p('nhie-fri-10', 'returned a gift for the money'),
  ],
}

/** Spicy tier — 18+ only; host confirms the age gate before starting. */
export const nhieSpicy: ContentPack<NhiePrompt> = {
  id: 'nhie-spicy-v1',
  game: 'never-have-i-ever',
  tone: 'spicy',
  locale: 'en',
  prompts: [
    p('nhie-spi-1', "kissed someone whose name I didn't know"),
    p('nhie-spi-2', 'dated two people in the same week'),
    p('nhie-spi-3', "checked a partner's phone"),
    p('nhie-spi-4', 'ghosted someone'),
    p('nhie-spi-5', 'been kicked out of a bar'),
    p('nhie-spi-6', 'gone skinny dipping'),
    p('nhie-spi-7', 'lied on a dating profile'),
    p('nhie-spi-8', 'had a crush on a coworker'),
    p('nhie-spi-9', 'sent a risky text and instantly regretted it'),
    p('nhie-spi-10', 'pretended to be single'),
  ],
}
