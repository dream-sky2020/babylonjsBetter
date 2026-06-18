export interface DiceTagOption {
  value: string;
  label: string;
}

export const DICE_TAGS: DiceTagOption[] = [
  { value: 'slash', label: '斩击' },
  { value: 'pierce', label: '突刺' },
  { value: 'blunt', label: '打击' },
  { value: 'guard', label: '防御' },
  { value: 'evade', label: '闪避' },
];
