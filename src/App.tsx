import {
  BookOpen,
  Gauge,
  Languages,
  List,
  Play,
  Search,
  Square,
  Volume2,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import rawContent from "./generated/practice-content.json";
import { useKoreanSpeech } from "./lib/useKoreanSpeech";
import type {
  Lesson,
  LessonGroup,
  PracticeContent,
  SpeechPracticeItem,
  VocabularyCategory,
} from "./types";

type ViewMode = "sentences" | "words";

type SentenceSection = {
  lesson: Lesson;
  group: LessonGroup;
  items: SpeechPracticeItem[];
};

type VocabularySection = {
  category: VocabularyCategory;
  items: SpeechPracticeItem[];
};

const content = rawContent as PracticeContent;

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>("sentences");
  const [selectedLessonIds, setSelectedLessonIds] = useState<string[]>(
    content.lessons[0]?.id ? [content.lessons[0].id] : [],
  );
  const [query, setQuery] = useState("");
  const speech = useKoreanSpeech();

  const normalizedQuery = query.trim().toLowerCase();
  const selectedLessons = useMemo(() => {
    const selectedIds = new Set(selectedLessonIds);
    return content.lessons.filter((lesson) => selectedIds.has(lesson.id));
  }, [selectedLessonIds]);

  const sentenceSections = useMemo(
    () => buildSentenceSections(content.lessons, selectedLessons, normalizedQuery),
    [normalizedQuery, selectedLessons],
  );

  const vocabularySections = useMemo(
    () => buildVocabularySections(content.vocabularyCategories, normalizedQuery),
    [normalizedQuery],
  );

  const visibleItems = useMemo(() => {
    const sections = viewMode === "sentences" ? sentenceSections : vocabularySections;
    return sections.flatMap((section) => section.items);
  }, [sentenceSections, viewMode, vocabularySections]);

  const canPlay = speech.availability === "supported" && visibleItems.length > 0;
  const practiceHeading = normalizedQuery
    ? "検索結果"
    : viewMode === "sentences"
      ? selectedLessons.length === 1
        ? selectedLessons[0]?.title
        : `選択中の文法（${selectedLessons.length}件）`
      : "登場単語一覧";

  const toggleLessonSelection = (lessonId: string) => {
    setSelectedLessonIds((current) => {
      if (current.includes(lessonId)) {
        if (current.length === 1) {
          return current;
        }
        return current.filter((id) => id !== lessonId);
      }

      return [...current, lessonId];
    });
  };

  if (content.lessons.length === 0) {
    return <div className="app unavailable">教材データがありません。</div>;
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            한
          </div>
          <div>
            <p className="eyebrow">Korean Reading Practice</p>
            <h1>韓国語リピート練習</h1>
          </div>
        </div>

        <div className="topbar-actions">
          <div className="voice-control">
            <Volume2 size={18} aria-hidden="true" />
            <select
              aria-label="音声"
              data-testid="voice-select"
              value={speech.selectedVoiceURI}
              onChange={(event) => speech.setSelectedVoiceURI(event.target.value)}
              disabled={speech.availability !== "supported"}
            >
              <option value="">ブラウザ既定</option>
              {speech.selectableVoices.map((voice) => (
                <option key={voice.voiceURI} value={voice.voiceURI}>
                  {voice.name} / {voice.lang}
                </option>
              ))}
            </select>
          </div>

          <label className="rate-control">
            <Gauge size={18} aria-hidden="true" />
            <span>{speech.rate.toFixed(2)}</span>
            <input
              aria-label="速度"
              data-testid="rate-slider"
              type="range"
              min="0.7"
              max="1.15"
              step="0.05"
              value={speech.rate}
              onChange={(event) => speech.setRate(Number(event.target.value))}
            />
          </label>
        </div>
      </header>

      <main className="workspace">
        <aside className="sidebar" aria-label="文法">
          <div className="lesson-list">
            {content.lessons.map((lesson) => (
              <button
                key={lesson.id}
                className={selectedLessonIds.includes(lesson.id) ? "selected" : ""}
                type="button"
                aria-pressed={selectedLessonIds.includes(lesson.id)}
                onClick={() => {
                  toggleLessonSelection(lesson.id);
                  setViewMode("sentences");
                }}
              >
                <span>{String(lesson.number).padStart(2, "0")}</span>
                <strong>{lesson.title}</strong>
              </button>
            ))}
          </div>
        </aside>

        <section className="practice-area">
          <div className="practice-toolbar">
            <div className="practice-title-group">
              <div className="mode-switch" role="tablist" aria-label="表示">
                <button
                  className={viewMode === "sentences" ? "active" : ""}
                  data-testid="sentences-tab"
                  type="button"
                  role="tab"
                  aria-selected={viewMode === "sentences"}
                  onClick={() => setViewMode("sentences")}
                >
                  <BookOpen size={18} aria-hidden="true" />
                  例文
                </button>
                <button
                  className={viewMode === "words" ? "active" : ""}
                  data-testid="words-tab"
                  type="button"
                  role="tab"
                  aria-selected={viewMode === "words"}
                  onClick={() => setViewMode("words")}
                >
                  <Languages size={18} aria-hidden="true" />
                  単語
                </button>
              </div>
              <p className="eyebrow">{viewMode === "sentences" ? "Sentence Queue" : "Word Queue"}</p>
              <h2>{practiceHeading}</h2>
            </div>

            <div className="practice-actions">
              <label className="search-field">
                <Search size={18} aria-hidden="true" />
                <input
                  type="search"
                  aria-label="検索"
                  data-testid="search-input"
                  placeholder="検索"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <button
                className="primary-action"
                data-testid="play-visible"
                type="button"
                disabled={!canPlay}
                onClick={() => speech.playQueue(visibleItems)}
              >
                <List size={18} aria-hidden="true" />
                連続
              </button>
              <IconButton
                label="停止"
                title="停止"
                variant="neutral"
                disabled={!speech.isPlaying}
                onClick={speech.stop}
              >
                <Square size={18} aria-hidden="true" />
              </IconButton>
            </div>
          </div>

          {speech.availability === "unsupported" ? (
            <div className="system-notice">このブラウザは読み上げに対応していません。</div>
          ) : null}

          {speech.availability === "supported" &&
          speech.selectableVoices.length > 0 &&
          !speech.hasKoreanVoice ? (
            <div className="system-notice">
              韓国語音声が見つからないため、ブラウザ既定で再生します。
            </div>
          ) : null}

          {viewMode === "sentences" ? (
            <SentenceSections
              sections={sentenceSections}
              currentItemId={speech.currentItemId}
              onPlayOne={speech.playOne}
              onPlayQueue={speech.playQueue}
            />
          ) : (
            <VocabularySections
              sections={vocabularySections}
              currentItemId={speech.currentItemId}
              onPlayOne={speech.playOne}
              onPlayQueue={speech.playQueue}
            />
          )}
        </section>
      </main>
    </div>
  );
}

function SentenceSections({
  sections,
  currentItemId,
  onPlayOne,
  onPlayQueue,
}: {
  sections: SentenceSection[];
  currentItemId: string | null;
  onPlayOne: (item: SpeechPracticeItem) => void;
  onPlayQueue: (items: SpeechPracticeItem[], startItemId?: string) => void;
}) {
  if (sections.length === 0) {
    return <div className="empty-state">一致する例文がありません。</div>;
  }

  return (
    <div className="section-stack">
      {sections.map((section) => (
        <section className="practice-section" key={`${section.lesson.id}-${section.group.id}`}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">
                {String(section.lesson.number).padStart(2, "0")} / {section.lesson.title}
              </p>
              <h3>{section.group.title}</h3>
              {section.group.orderHint ? <p className="order-hint">{section.group.orderHint}</p> : null}
            </div>
            <IconButton
              label="このまとまりを連続"
              title="このまとまりを連続"
              onClick={() => onPlayQueue(section.items)}
            >
              <List size={18} aria-hidden="true" />
            </IconButton>
          </div>

          <PracticeRows
            items={section.items}
            currentItemId={currentItemId}
            onPlayOne={onPlayOne}
            onPlayQueue={onPlayQueue}
          />

          {section.lesson.notes.length > 0 ? (
            <div className="content-notes">
              {section.lesson.notes.map((note) => (
                <p key={note}>{note}</p>
              ))}
            </div>
          ) : null}
        </section>
      ))}
    </div>
  );
}

function VocabularySections({
  sections,
  currentItemId,
  onPlayOne,
  onPlayQueue,
}: {
  sections: VocabularySection[];
  currentItemId: string | null;
  onPlayOne: (item: SpeechPracticeItem) => void;
  onPlayQueue: (items: SpeechPracticeItem[], startItemId?: string) => void;
}) {
  if (sections.length === 0) {
    return <div className="empty-state">一致する単語がありません。</div>;
  }

  return (
    <div className="section-stack vocabulary-stack">
      {sections.map((section) => (
        <section className="practice-section" key={section.category.id}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Vocabulary</p>
              <h3>{section.category.title}</h3>
            </div>
            <IconButton
              label="この単語群を連続"
              title="この単語群を連続"
              onClick={() => onPlayQueue(section.items)}
            >
              <List size={18} aria-hidden="true" />
            </IconButton>
          </div>

          <PracticeRows
            items={section.items}
            currentItemId={currentItemId}
            onPlayOne={onPlayOne}
            onPlayQueue={onPlayQueue}
          />
        </section>
      ))}
    </div>
  );
}

function PracticeRows({
  items,
  currentItemId,
  onPlayOne,
  onPlayQueue,
}: {
  items: SpeechPracticeItem[];
  currentItemId: string | null;
  onPlayOne: (item: SpeechPracticeItem) => void;
  onPlayQueue: (items: SpeechPracticeItem[], startItemId?: string) => void;
}) {
  return (
    <div className="practice-rows">
      {items.map((item) => (
        <article
          key={item.id}
          data-testid="practice-row"
          className={`practice-row ${currentItemId === item.id ? "speaking" : ""}`}
        >
          <div className="row-play-cell">
            <IconButton label="単発" title="単発" onClick={() => onPlayOne(item)}>
              <Play size={18} aria-hidden="true" />
            </IconButton>
          </div>
          <div className="korean-text" lang="ko">
            {item.korean}
          </div>
          <div className="japanese-text">{item.japanese}</div>
          <div className="row-actions">
            <IconButton label="ここから連続" title="ここから連続" onClick={() => onPlayQueue(items, item.id)}>
              <List size={18} aria-hidden="true" />
            </IconButton>
          </div>
        </article>
      ))}
    </div>
  );
}

function IconButton({
  children,
  disabled = false,
  label,
  onClick,
  title,
  variant = "standard",
}: {
  children: ReactNode;
  disabled?: boolean;
  label: string;
  onClick: () => void;
  title: string;
  variant?: "standard" | "neutral";
}) {
  return (
    <button
      aria-label={label}
      className={`icon-button ${variant}`}
      disabled={disabled}
      title={title}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function buildSentenceSections(
  lessons: Lesson[],
  selectedLessons: Lesson[],
  normalizedQuery: string,
): SentenceSection[] {
  const sourceLessons = normalizedQuery ? lessons : selectedLessons.length > 0 ? selectedLessons : lessons;

  return sourceLessons.flatMap((lesson) =>
    lesson.groups
      .map((group) => {
        const items = group.examples
          .map((example) => ({
            ...example,
            context: `${lesson.title} / ${group.title}`,
            kind: "sentence" as const,
          }))
          .filter((item) => matchesQuery(item, normalizedQuery));

        return { lesson, group, items };
      })
      .filter((section) => section.items.length > 0),
  );
}

function buildVocabularySections(
  categories: VocabularyCategory[],
  normalizedQuery: string,
): VocabularySection[] {
  return categories
    .map((category) => {
      const items = category.words
        .map((word) => ({
          ...word,
          context: category.title,
          kind: "word" as const,
        }))
        .filter((item) => matchesQuery(item, normalizedQuery));

      return { category, items };
    })
    .filter((section) => section.items.length > 0);
}

function matchesQuery(item: SpeechPracticeItem, normalizedQuery: string) {
  if (!normalizedQuery) {
    return true;
  }

  return [item.korean, item.japanese, item.context].some((value) =>
    value.toLowerCase().includes(normalizedQuery),
  );
}
