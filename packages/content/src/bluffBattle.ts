import type { BluffPrompt, ContentPack } from '@hpg/shared'

const p = (id: string, question: string, answer: string): BluffPrompt => ({ id, question, answer })

/** Family tier — kid-safe trivia and surprising facts. */
export const bluffFamily: ContentPack<BluffPrompt> = {
  id: 'bluff-family-v1',
  game: 'bluff-battle',
  tone: 'family',
  locale: 'en',
  prompts: [
    p('blf-fam-1', 'A group of flamingos is called a…', 'A flamboyance'),
    p('blf-fam-2', 'A baby kangaroo is called a…', 'A joey'),
    p('blf-fam-3', 'The only mammal that can truly fly is the…', 'Bat'),
    p('blf-fam-4', 'Bananas grow pointing…', 'Upward'),
    p('blf-fam-5', 'A snail can sleep for up to…', 'Three years'),
    p('blf-fam-6', 'The dot over a lowercase i is called a…', 'Tittle'),
    p('blf-fam-7', 'Octopuses have this many hearts…', 'Three'),
    p('blf-fam-8', 'The Hawaiian pizza was invented in…', 'Canada'),
    p('blf-fam-9', 'A group of pugs is called a…', 'A grumble'),
    p('blf-fam-10', 'Honey never…', 'Spoils'),
  ],
}

/** Friends tier — offbeat facts for a general audience. */
export const bluffFriends: ContentPack<BluffPrompt> = {
  id: 'bluff-friends-v1',
  game: 'bluff-battle',
  tone: 'friends',
  locale: 'en',
  prompts: [
    p('blf-fri-1', 'In Switzerland it is illegal to own just one…', 'Guinea pig'),
    p('blf-fri-2', 'The fear of running out of phone battery is called…', 'Nomophobia'),
    p('blf-fri-3', 'The first thing ever sold on eBay was a broken…', 'Laser pointer'),
    p('blf-fri-4', 'Wombats poop in this shape…', 'Cubes'),
    p('blf-fri-5', 'The average person spends 6 months of their life waiting for…', 'Red lights'),
    p('blf-fri-6', 'In Japan you can buy this from vending machines…', 'Live rhinoceros beetles'),
    p('blf-fri-7', 'The world record for most T-shirts worn at once is…', '260'),
    p(
      'blf-fri-8',
      'Before alarm clocks, "knocker-uppers" woke people by…',
      'Tapping windows with sticks',
    ),
    p('blf-fri-9', 'The inventor of the Pringles can is buried in…', 'A Pringles can'),
    p('blf-fri-10', 'A cow-bison hybrid is called a…', 'Beefalo'),
  ],
}

/** Spicy tier — dating and relationship facts for adults. */
export const bluffSpicy: ContentPack<BluffPrompt> = {
  id: 'bluff-spicy-v1',
  game: 'bluff-battle',
  tone: 'spicy',
  locale: 'en',
  prompts: [
    p('blf-spi-1', 'The average first kiss happens at age…', '15'),
    p(
      'blf-spi-2',
      'In one survey, 1 in 5 people admitted to doing THIS at a wedding…',
      'Hooking up with a guest',
    ),
    p('blf-spi-3', 'The most common place to hide a dating app is…', 'A folder named Utilities'),
    p('blf-spi-4', 'Historically, Victorians flirted using…', 'Fans'),
    p('blf-spi-5', "The most-returned Valentine's gift is…", 'Lingerie'),
    p('blf-spi-6', '"Cuffing season" officially peaks in…', 'December'),
    p('blf-spi-7', 'The average breakup text is this many words…', 'Seven'),
    p('blf-spi-8', 'In ancient Rome, love potions commonly contained…', 'Sweat'),
    p('blf-spi-9', 'The #1 lie on dating profiles is about…', 'Height'),
    p('blf-spi-10', 'Speed dating was invented by a…', 'Rabbi'),
  ],
}
