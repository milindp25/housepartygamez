import type { ContentPack, WstPrompt } from '@hpg/shared'

const p = (id: string, text: string): WstPrompt => ({ id, text })

/** Family tier — kid-safe personal questions. */
export const wstFamily: ContentPack<WstPrompt> = {
  id: 'wst-family-v1',
  game: 'who-said-that',
  tone: 'family',
  locale: 'en',
  prompts: [
    p('wst-fam-1', 'What did you want to be when you were five?'),
    p('wst-fam-2', "What's your weirdest food combo?"),
    p('wst-fam-3', 'What would you buy first with a million dollars?'),
    p('wst-fam-4', "What's your most-used emoji?"),
    p('wst-fam-5', "What's the strangest thing you believed as a kid?"),
    p('wst-fam-6', 'If you were an animal, which one?'),
    p('wst-fam-7', 'What food could you eat every single day?'),
    p('wst-fam-8', "What's your guilty-pleasure TV show?"),
    p('wst-fam-9', 'What would you do first if you were invisible for a day?'),
    p('wst-fam-10', "What's your hidden talent?"),
  ],
}

/** Friends tier — general audience personal questions. */
export const wstFriends: ContentPack<WstPrompt> = {
  id: 'wst-friends-v1',
  game: 'who-said-that',
  tone: 'friends',
  locale: 'en',
  prompts: [
    p('wst-fri-1', "What's the most embarrassing song you love?"),
    p('wst-fri-2', "What's the dumbest way you've injured yourself?"),
    p('wst-fri-3', 'Which celebrity would you swap lives with?'),
    p('wst-fri-4', 'What was your worst fashion phase?'),
    p('wst-fri-5', "What's the strangest compliment you've received?"),
    p('wst-fri-6', 'What do you pretend to understand?'),
    p('wst-fri-7', 'Which app wastes most of your time?'),
    p('wst-fri-8', "What's a hill you'll die on?"),
    p('wst-fri-9', "What's the weirdest dream you've had recently?"),
    p('wst-fri-10', "What's your most irrational fear?"),
  ],
}

/** Spicy tier — 18+ only; host confirms the age gate before starting. */
export const wstSpicy: ContentPack<WstPrompt> = {
  id: 'wst-spicy-v1',
  game: 'who-said-that',
  tone: 'spicy',
  locale: 'en',
  prompts: [
    p('wst-spi-1', 'Describe your worst date in one line'),
    p('wst-spi-2', "What's your most embarrassing crush?"),
    p('wst-spi-3', "What's the biggest red flag you've ignored?"),
    p('wst-spi-4', "What's the pettiest reason you rejected someone?"),
    p('wst-spi-5', "What's the worst pickup line you've used or received?"),
    p('wst-spi-6', "Who's your celebrity hall pass?"),
    p('wst-spi-7', "What's your most chaotic 2am decision?"),
    p('wst-spi-8', 'What have you done to impress a crush?'),
    p('wst-spi-9', "What's your toxic trait in relationships?"),
    p('wst-spi-10', 'Describe your ex in exactly three words'),
  ],
}
