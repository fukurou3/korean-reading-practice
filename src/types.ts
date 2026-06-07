export type PracticeContent = {
  schemaVersion: number;
  sourceFormat: string;
  vocabularyCategories: VocabularyCategory[];
  lessons: Lesson[];
  stats: {
    vocabularyCount: number;
    lessonCount: number;
    exampleCount: number;
  };
};

export type VocabularyCategory = {
  id: string;
  title: string;
  words: PracticeEntry[];
};

export type Lesson = {
  id: string;
  number: number;
  title: string;
  groups: LessonGroup[];
  notes: string[];
};

export type LessonGroup = {
  id: string;
  title: string;
  orderHint: string | null;
  examples: PracticeEntry[];
};

export type PracticeEntry = {
  id: string;
  korean: string;
  japanese: string;
};

export type SpeechPracticeItem = PracticeEntry & {
  context: string;
  kind: "word" | "sentence";
};
