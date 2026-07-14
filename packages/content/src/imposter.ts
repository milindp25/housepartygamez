import type { ContentPack, ImposterPrompt } from '@hpg/shared'

const p = (id: string, word: string, category: string): ImposterPrompt => ({ id, word, category })

/** Family tier — kid-safe words. */
export const impFamily: ContentPack<ImposterPrompt> = {
  id: 'imposter-family-v1',
  game: 'imposter',
  tone: 'family',
  locale: 'en',
  prompts: [
    p('imp-fam-1', 'Banana', 'Fruit'),
    p('imp-fam-2', 'Giraffe', 'Animal'),
    p('imp-fam-3', 'Pizza', 'Food'),
    p('imp-fam-4', 'Guitar', 'Instrument'),
    p('imp-fam-5', 'Beach', 'Place'),
    p('imp-fam-6', 'Rainbow', 'Nature'),
    p('imp-fam-7', 'Dentist', 'Job'),
    p('imp-fam-8', 'Soccer', 'Sport'),
    p('imp-fam-9', 'Pancake', 'Food'),
    p('imp-fam-10', 'Castle', 'Building'),
  ],
}

/** Friends tier — general audience relatables. */
export const impFriends: ContentPack<ImposterPrompt> = {
  id: 'imposter-friends-v1',
  game: 'imposter',
  tone: 'friends',
  locale: 'en',
  prompts: [
    p('imp-fri-1', 'Karaoke', 'Activity'),
    p('imp-fri-2', 'Road trip', 'Activity'),
    p('imp-fri-3', 'Ghosting', 'Dating'),
    p('imp-fri-4', 'Brunch', 'Food'),
    p('imp-fri-5', 'Gym selfie', 'Social media'),
    p('imp-fri-6', 'Group project', 'School'),
    p('imp-fri-7', 'Wi-Fi password', 'Tech'),
    p('imp-fri-8', 'Monday', 'Time'),
    p('imp-fri-9', 'Escape room', 'Activity'),
    p('imp-fri-10', 'Airport security', 'Travel'),
  ],
}

/** Spicy tier — 18+ only; host confirms the age gate before starting. */
export const impSpicy: ContentPack<ImposterPrompt> = {
  id: 'imposter-spicy-v1',
  game: 'imposter',
  tone: 'spicy',
  locale: 'en',
  prompts: [
    p('imp-spi-1', 'First date', 'Dating'),
    p('imp-spi-2', 'Situationship', 'Dating'),
    p('imp-spi-3', 'Walk of shame', 'Night out'),
    p('imp-spi-4', 'Love bite', 'Romance'),
    p('imp-spi-5', 'Skinny dip', 'Activity'),
    p('imp-spi-6', "Ex's playlist", 'Music'),
    p('imp-spi-7', 'Dating app bio', 'Tech'),
    p('imp-spi-8', 'One-night stand', 'Dating'),
    p('imp-spi-9', 'Body shot', 'Party'),
    p('imp-spi-10', 'Friends with benefits', 'Dating'),
  ],
}
