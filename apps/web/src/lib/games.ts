import type { GameId } from '@hpg/shared'

/** One public marketing entry used by the landing and static game pages. */
export interface MarketingGame {
  id: GameId
  slug: string
  name: string
  tagline: string
  description: string
  minPlayers: number
  maxPlayers: number
  minutes: number
  howTo: readonly string[]
  accent: '#F97316' | '#FBBF24' | '#EC4899' | '#C084FC'
}

/** The complete public game catalog in landing-page display order. */
export const MARKETING_GAMES: readonly MarketingGame[] = [
  {
    id: 'would-you-rather',
    slug: 'would-you-rather',
    name: 'Would You Rather',
    tagline: 'Two impossible choices. One revealing room.',
    description:
      'Would You Rather turns every impossible choice into a room-wide conversation starter. The host puts two dilemmas on the shared screen, from ridiculous tradeoffs to questions that expose how well everyone knows each other. Each player chooses privately on their own phone, so nobody can follow the crowd or read the room before deciding. When everyone has voted, the results appear together on the shared display and the debate begins. There is no complicated setup, no cards to pass around, and no pressure to perform alone. It works for a quick warm-up with two people or a lively group of twenty, and a typical game takes about ten minutes. Pick a side, defend your logic, and discover which friends think exactly like you.',
    minPlayers: 2,
    maxPlayers: 20,
    minutes: 10,
    howTo: [
      'Open a room and invite everyone with the room code.',
      'Read each two-choice dilemma on the shared screen.',
      'Choose your answer privately on your phone.',
      'Reveal the split together and debate the result.',
    ],
    accent: '#F97316',
  },
  {
    id: 'most-likely-to',
    slug: 'most-likely-to',
    name: 'Most Likely To',
    tagline: 'Point the prompt at the perfect friend.',
    description:
      'Most Likely To puts your group knowledge on trial, one playful accusation at a time. A prompt appears on the shared screen asking which friend would most likely do something memorable, chaotic, impressive, or unexpectedly wholesome. Every player votes from their own phone for the person who fits best. Because choices stay private until the reveal, honest instincts win over whoever speaks first or campaigns loudest. Once the votes are in, the shared tally shows the room favorite and gives everyone a reason to trade stories, defend a choice, or demand an explanation. The format is welcoming for three players and stays readable with groups up to twenty. Set aside around fifteen minutes for a complete session, though the conversation it starts may last much longer than the tally.',
    minPlayers: 3,
    maxPlayers: 20,
    minutes: 15,
    howTo: [
      'Gather the group in one room with the join code.',
      'Read the Most Likely To prompt aloud.',
      'Vote privately for the friend who fits best.',
      'Reveal the tally and share the stories behind it.',
    ],
    accent: '#FBBF24',
  },
  {
    id: 'never-have-i-ever',
    slug: 'never-have-i-ever',
    name: 'Never Have I Ever',
    tagline: 'Confessions land better when everyone answers.',
    description:
      'Never Have I Ever brings the classic confession game to every phone while keeping the room focused on one shared moment. The screen presents a statement, and each player privately chooses whether they have done it. After everyone answers, the shared display reveals the count and names behind the confessions, giving the group a natural opening for stories, surprises, and good-natured explanations. The host advances through the statements, and the final board celebrates the players with the fewest “I have” answers. There is no hand counting, no watching who moves first, and no special setup to explain. The current game welcomes three to twenty players and usually fills about fifteen minutes. Answer honestly, compare experiences, and discover which friend has the most unexpectedly eventful history.',
    minPlayers: 3,
    maxPlayers: 20,
    minutes: 15,
    howTo: [
      'Join the room and get ready to answer privately.',
      'Read each Never Have I Ever statement together.',
      'Choose “I have” or “Never” on your phone.',
      'Reveal the confessions and compare the final results.',
    ],
    accent: '#EC4899',
  },
  {
    id: 'who-said-that',
    slug: 'who-said-that',
    name: 'Who Said That?',
    tagline: 'Anonymous answers. Suspiciously familiar voices.',
    description:
      'Who Said That? turns ordinary personal answers into a detective game about the people in the room. First, everyone receives a prompt and submits a response from their own phone. The shared screen then presents those answers without giving away their authors. Players study the wording, remember old stories, spot familiar opinions, and choose who they believe wrote each one. The reveal settles every accusation and rewards the friends who can recognize a voice even when no name is attached. It is part guessing game, part conversation starter, and every round creates details the group can laugh about afterward. Three players are enough to make the mystery work, while groups up to twenty create wonderfully crowded suspect lists. Plan on roughly twenty minutes for answers, deductions, reveals, and inevitable explanations.',
    minPlayers: 3,
    maxPlayers: 20,
    minutes: 20,
    howTo: [
      'Join the room and answer the personal prompt privately.',
      'Read the anonymous responses on the shared screen.',
      'Identify the friend you think wrote each answer.',
      'Reveal every author and compare the room’s deductions.',
    ],
    accent: '#C084FC',
  },
  {
    id: 'imposter',
    slug: 'imposter',
    name: 'Imposter',
    tagline: 'Share the clue without exposing the secret.',
    description:
      'Imposter is a social deduction showdown where almost everyone knows the same secret word and one player does not. Each phone privately shows its owner what they need to know, keeping the hidden role hidden from the rest of the room. Players take turns speaking a clue that proves they understand the word without making it obvious enough for the outsider to copy. The imposter listens, improvises, and tries to blend in while everyone else weighs which clues feel suspicious. After the discussion, the group votes for the player they believe is faking it, and the shared screen reveals whether the room found its outsider. It plays well with four to twenty people, takes about fifteen minutes, and rewards careful wording, confident bluffing, and close attention to every nervous explanation.',
    minPlayers: 4,
    maxPlayers: 20,
    minutes: 15,
    howTo: [
      'Check your phone privately for the word or imposter role.',
      'Give one spoken clue without saying the secret word.',
      'Listen closely and discuss who seems out of place.',
      'Vote for the suspected imposter and reveal the result.',
    ],
    accent: '#F97316',
  },
  {
    id: 'bluff-battle',
    slug: 'bluff-battle',
    name: 'Bluff Battle',
    tagline: 'Write the lie your friends want to believe.',
    description:
      'Bluff Battle turns strange trivia into a contest of invention, deduction, and knowing exactly what your friends will believe. The shared screen asks a question with one surprising true answer. Everyone uses their phone to invent a convincing fake, and the game mixes those bluffs with the real response before presenting the full list. Players then choose which answer they think is true while trying not to fall for each other’s writing. Correctly finding the truth earns points, but a great lie scores too whenever it fools another player, so both knowledge and misdirection matter. Three to twenty people can play, and a session takes about twenty minutes. Expect bold claims, suspiciously polished nonsense, and the satisfying reveal that the least believable option was somehow the fact all along.',
    minPlayers: 3,
    maxPlayers: 20,
    minutes: 20,
    howTo: [
      'Read the unusual trivia question on the shared screen.',
      'Invent a believable fake answer on your phone.',
      'Choose the truth from the shuffled answer list.',
      'Reveal the fact and score truth picks and successful bluffs.',
    ],
    accent: '#FBBF24',
  },
  {
    id: 'mafia',
    slug: 'mafia',
    name: 'Mafia',
    tagline: 'Trust the room. Suspect everyone in it.',
    description:
      'Mafia brings the classic hidden-role mystery to a shared screen while every secret stays safely on individual phones. Each player privately receives a Mafia, Doctor, Detective, or Civilian role. During the night, Mafia members choose a target, the Doctor tries to protect someone, and the Detective investigates a suspect without exposing the result to the room. Daylight returns everyone to the same conversation, where claims, alibis, careful questions, and deliberate misdirection lead to a public vote. The town tries to remove the Mafia before the hidden team controls the room; the Mafia works to survive each round without revealing its coordination. The marketing experience is tuned for six to twenty players and about thirty minutes. It delivers tense decisions without a separate moderator tracking roles, night actions, or vote totals by hand.',
    minPlayers: 6,
    maxPlayers: 20,
    minutes: 30,
    howTo: [
      'Check your phone privately to learn your hidden role.',
      'Complete each night action when your role is called.',
      'Debate the evidence together when daylight returns.',
      'Vote out a suspect before the opposing side takes control.',
    ],
    accent: '#EC4899',
  },
]

/** Find a public game by its stable URL slug. */
export function getMarketingGame(slug: string): MarketingGame | undefined {
  return MARKETING_GAMES.find((game) => game.slug === slug)
}
