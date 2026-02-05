export interface Example {
  hanzi: string;
  romanization: string;
  mandarin_translation: string;
}

export interface Meaning {
  id: number;
  part_of_speech: string;
  explanation: string;
  display_id: number;
  examples: Example[];
}

export interface AltPronunciation {
  id: number;
  hanzi: string;
  romanization: string;
}

export interface PhoneticDifference {
  [key: string]: number | string;
}

export interface Result {
  id: number;
  hanzi: string;
  romanization: string;
  category: string;
  audio_file: string;
  meanings: Meaning[];
  variant_characters: string[];
  alternative_pronunciations: AltPronunciation[];
  phonetic_differences: PhoneticDifference | null;
}

export interface PhoneticQuery {
  initial: string | null;
  final: string | null;
  tone: number | null;
  singleSyllableOnly: boolean;
}

export interface ToneGroup {
  tone: number;
  syllable: string;
  entries: Result[];
}
