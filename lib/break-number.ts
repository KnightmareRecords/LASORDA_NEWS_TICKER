// "Break #" tab shown under the ticker (/break). 0 = blank, 1–10 = Break One … Break Ten.

export const MAX_BREAK = 10;

const WORDS = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];

/** "One" for 1, "" for 0 or anything out of range. */
export function breakWord(number: number) {
  return Number.isInteger(number) && number >= 1 && number <= MAX_BREAK ? WORDS[number] : '';
}

/** Dropdown choices: Blank, Break One … Break Ten. */
export const BREAK_CHOICES = WORDS.map((word, number) => ({ number, label: number === 0 ? 'Blank (hide)' : `Break ${word}` }));
