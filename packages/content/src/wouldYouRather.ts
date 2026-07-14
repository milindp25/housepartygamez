import type { ContentPack, WyrPrompt } from '@hpg/shared'

/**
 * Family tier — kid-safe, no romance/relationship content. 10 prompts;
 * plan 5 expands this to 100+ so games don't cycle within a night.
 */
export const wyrFamily: ContentPack<WyrPrompt> = {
  id: 'wyr-family-v1',
  game: 'would-you-rather',
  tone: 'family',
  locale: 'en',
  prompts: [
    { id: 'wyr-fam-1', a: 'Be able to fly', b: 'Be able to turn invisible' },
    { id: 'wyr-fam-2', a: 'Talk to animals', b: 'Speak every human language' },
    { id: 'wyr-fam-3', a: 'Never do homework again', b: 'Never do chores again' },
    { id: 'wyr-fam-4', a: 'Live in a treehouse', b: 'Live in a castle' },
    { id: 'wyr-fam-5', a: 'Only eat pizza forever', b: 'Only eat ice cream forever' },
    { id: 'wyr-fam-6', a: 'Have a pet dragon', b: 'Have a pet dinosaur' },
    {
      id: 'wyr-fam-7',
      a: 'Be 10 minutes early everywhere',
      b: 'Get 10 extra minutes of sleep daily',
    },
    {
      id: 'wyr-fam-8',
      a: 'Have a trampoline floor at home',
      b: 'Have a waterslide instead of stairs',
    },
    {
      id: 'wyr-fam-9',
      a: 'Always have to sing instead of talk',
      b: 'Always have to dance while walking',
    },
    { id: 'wyr-fam-10', a: 'Visit the past', b: 'Visit the future' },
  ],
}

/** Friends tier — general audience, mildly cheeky. */
export const wyrFriends: ContentPack<WyrPrompt> = {
  id: 'wyr-friends-v1',
  game: 'would-you-rather',
  tone: 'friends',
  locale: 'en',
  prompts: [
    { id: 'wyr-fri-1', a: 'Always be 10 minutes late', b: 'Always be 20 minutes early' },
    { id: 'wyr-fri-2', a: 'Free flights for life', b: 'Free food for life' },
    { id: 'wyr-fri-3', a: 'Lose your phone for a month', b: 'Lose your wallet every week' },
    {
      id: 'wyr-fri-4',
      a: 'Always say exactly what you think',
      b: 'Never be able to complain again',
    },
    { id: 'wyr-fri-5', a: 'Be famous but always broke', b: 'Be rich but totally unknown' },
    { id: 'wyr-fri-6', a: 'Have your group chat leaked', b: 'Have your search history leaked' },
    { id: 'wyr-fri-7', a: 'Re-live one year of your life', b: 'Skip one year into the future' },
    { id: 'wyr-fri-8', a: 'Never wait in line again', b: 'Never hit traffic again' },
    { id: 'wyr-fri-9', a: 'Only whisper forever', b: 'Only shout forever' },
    { id: 'wyr-fri-10', a: 'Fight one horse-sized duck', b: 'Fight a hundred duck-sized horses' },
  ],
}

/** Spicy tier — 18+ only; host confirms the age gate before starting. */
export const wyrSpicy: ContentPack<WyrPrompt> = {
  id: 'wyr-spicy-v1',
  game: 'would-you-rather',
  tone: 'spicy',
  locale: 'en',
  prompts: [
    { id: 'wyr-spi-1', a: 'Have your DMs read aloud here', b: 'Have your camera roll shown here' },
    { id: 'wyr-spi-2', a: 'Get back with an ex', b: 'Stay single for five years' },
    { id: 'wyr-spi-3', a: 'Date someone 15 years older', b: 'Date someone your parents pick' },
    { id: 'wyr-spi-4', a: 'Accidentally text your crush', b: 'Accidentally text your boss' },
    { id: 'wyr-spi-5', a: 'Know who has a crush on you', b: 'Know what your ex says about you' },
    {
      id: 'wyr-spi-6',
      a: 'Go on a blind date picked by this group',
      b: 'Let this group read your last 10 texts',
    },
    { id: 'wyr-spi-7', a: 'Never flirt again', b: 'Flirt with everyone, always, badly' },
    { id: 'wyr-spi-8', a: 'Marry rich without love', b: 'Marry broke with love' },
    { id: 'wyr-spi-9', a: 'Have every date livestreamed', b: 'Have your mom on every first date' },
    {
      id: 'wyr-spi-10',
      a: 'Confess to your current crush tonight',
      b: 'Call an ex right now on speaker',
    },
  ],
}
