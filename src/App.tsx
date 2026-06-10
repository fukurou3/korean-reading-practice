import {
  BookOpen,
  Brain,
  Eye,
  Gauge,
  Languages,
  List,
  Pause,
  Play,
  RotateCcw,
  Search,
  Shuffle,
  SkipBack,
  SkipForward,
  Square,
  Volume2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import rawContent from "./generated/practice-content.json";
import { SPEECH_RATE, useKoreanSpeech } from "./lib/useKoreanSpeech";
import type {
  Lesson,
  LessonGroup,
  PracticeContent,
  SpeechPracticeItem,
  VocabularyCategory,
} from "./types";

type ViewMode = "sentences" | "words";
type PracticeMode = "list" | "flash";
type FlashPace = "quick" | "standard" | "slow";

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

const FLASH_SETTINGS_KEYS = {
  pace: "korean-practice.flash.pace",
  readAloud: "korean-practice.flash.readAloud",
  shuffle: "korean-practice.flash.shuffle",
} as const;

const FLASH_PACE_OPTIONS: Record<
  FlashPace,
  { answerMultiplier: number; gapMs: number; label: string; questionMultiplier: number }
> = {
  quick: {
    answerMultiplier: 0.76,
    gapMs: 300,
    label: "速め",
    questionMultiplier: 0.76,
  },
  standard: {
    answerMultiplier: 1,
    gapMs: 500,
    label: "標準",
    questionMultiplier: 1,
  },
  slow: {
    answerMultiplier: 1.24,
    gapMs: 700,
    label: "ゆっくり",
    questionMultiplier: 1.24,
  },
};

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>("sentences");
  const [practiceMode, setPracticeMode] = useState<PracticeMode>("list");
  const [selectedLessonIds, setSelectedLessonIds] = useState<string[]>(
    content.lessons[0]?.id ? [content.lessons[0].id] : [],
  );
  const [query, setQuery] = useState("");
  const [flashIndex, setFlashIndex] = useState(0);
  const [isFlashAnswerVisible, setIsFlashAnswerVisible] = useState(false);
  const [isFlashRunning, setIsFlashRunning] = useState(false);
  const [isFlashComplete, setIsFlashComplete] = useState(false);
  const [flashShuffleSeed, setFlashShuffleSeed] = useState(1);
  const [flashShuffle, setFlashShuffle] = useLocalStorageState(
    FLASH_SETTINGS_KEYS.shuffle,
    false,
  );
  const [flashReadAloud, setFlashReadAloud] = useLocalStorageState(
    FLASH_SETTINGS_KEYS.readAloud,
    true,
  );
  const [flashPace, setFlashPace] = useLocalStorageState<FlashPace>(
    FLASH_SETTINGS_KEYS.pace,
    "standard",
  );
  const {
    availability,
    currentItemId,
    hasKoreanVoice,
    isPlaying,
    playOne,
    playQueue,
    rate,
    selectableVoices,
    selectedVoiceURI,
    setRate,
    setSelectedVoiceURI,
    stop,
  } = useKoreanSpeech();

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

  const sentenceItems = useMemo(
    () => sentenceSections.flatMap((section) => section.items),
    [sentenceSections],
  );

  const vocabularyItems = useMemo(
    () => vocabularySections.flatMap((section) => section.items),
    [vocabularySections],
  );

  const flashDeck = useMemo(
    () =>
      flashShuffle
        ? shufflePracticeItems(sentenceItems, flashShuffleSeed)
        : sentenceItems,
    [flashShuffle, flashShuffleSeed, sentenceItems],
  );

  const visibleItems = useMemo(() => {
    if (practiceMode === "flash") {
      return flashDeck;
    }

    return viewMode === "sentences" ? sentenceItems : vocabularyItems;
  }, [flashDeck, practiceMode, sentenceItems, viewMode, vocabularyItems]);

  const currentFlashItem = flashDeck[flashIndex] ?? null;
  const currentFlashTiming = useMemo(
    () => (currentFlashItem ? getFlashTimings(currentFlashItem, flashPace) : null),
    [currentFlashItem, flashPace],
  );

  const canPlay = availability === "supported" && visibleItems.length > 0;
  const practiceHeading = normalizedQuery
    ? "検索結果"
    : practiceMode === "flash"
      ? "フラッシュ暗記"
    : viewMode === "sentences"
      ? selectedLessons.length === 1
        ? selectedLessons[0]?.title
        : `選択中の文法（${selectedLessons.length}件）`
      : "登場単語一覧";
  const practiceEyebrow =
    practiceMode === "flash"
      ? "Flash Drill"
      : viewMode === "sentences"
        ? "Sentence Queue"
        : "Word Queue";

  const resetFlashProgress = (shouldStopAudio: boolean) => {
    setFlashIndex(0);
    setIsFlashAnswerVisible(false);
    setIsFlashRunning(false);
    setIsFlashComplete(false);
    if (shouldStopAudio) {
      stop();
    }
  };

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
    resetFlashProgress(practiceMode === "flash" || isFlashRunning);
  };

  const stopFlash = useCallback(() => {
    setIsFlashRunning(false);
    stop();
  }, [stop]);

  const restartFlash = useCallback(
    (reshuffle: boolean) => {
      setIsFlashRunning(false);
      setIsFlashComplete(false);
      setIsFlashAnswerVisible(false);
      setFlashIndex(0);
      stop();
      if (reshuffle) {
        setFlashShuffle(true);
        setFlashShuffleSeed(Date.now());
      }
    },
    [setFlashShuffle, stop],
  );

  const startFlash = useCallback(() => {
    if (flashDeck.length === 0) {
      return;
    }

    stop();
    setViewMode("sentences");
    setPracticeMode("flash");
    setIsFlashComplete(false);
    setIsFlashAnswerVisible(false);
    setIsFlashRunning(true);
  }, [flashDeck.length, stop]);

  const goToNextFlash = useCallback(() => {
    if (flashDeck.length === 0) {
      return;
    }

    stop();
    setFlashIndex((current) => {
      if (current >= flashDeck.length - 1) {
        setIsFlashRunning(false);
        setIsFlashComplete(true);
        setIsFlashAnswerVisible(true);
        return current;
      }

      setIsFlashComplete(false);
      setIsFlashAnswerVisible(false);
      return current + 1;
    });
  }, [flashDeck.length, stop]);

  const goToPreviousFlash = useCallback(() => {
    stop();
    setFlashIndex((current) => Math.max(0, current - 1));
    setIsFlashComplete(false);
    setIsFlashAnswerVisible(false);
  }, [stop]);

  const revealAnswerOrAdvance = useCallback(() => {
    if (isFlashComplete) {
      restartFlash(false);
      return;
    }

    if (isFlashAnswerVisible) {
      goToNextFlash();
      return;
    }

    setIsFlashAnswerVisible(true);
  }, [goToNextFlash, isFlashAnswerVisible, isFlashComplete, restartFlash]);

  const toggleFlashRunning = useCallback(() => {
    if (isFlashRunning) {
      stopFlash();
      setIsFlashAnswerVisible(false);
      return;
    }

    startFlash();
  }, [isFlashRunning, startFlash, stopFlash]);

  const playCurrentFlashItem = useCallback(() => {
    if (currentFlashItem) {
      void playOne(currentFlashItem);
    }
  }, [currentFlashItem, playOne]);

  const updateFlashShuffle = useCallback(
    (nextValue: boolean) => {
      setFlashShuffle(nextValue);
      setFlashShuffleSeed(Date.now());
      setFlashIndex(0);
      setIsFlashAnswerVisible(false);
      setIsFlashRunning(false);
      setIsFlashComplete(false);
      stop();
    },
    [setFlashShuffle, stop],
  );

  useEffect(() => {
    if (
      practiceMode !== "flash" ||
      !isFlashRunning ||
      isFlashComplete ||
      !currentFlashItem ||
      !currentFlashTiming
    ) {
      return undefined;
    }

    if (!isFlashAnswerVisible) {
      const answerTimer = window.setTimeout(() => {
        setIsFlashAnswerVisible(true);
      }, currentFlashTiming.questionMs);

      return () => {
        window.clearTimeout(answerTimer);
      };
    }

    const nextTimer = window.setTimeout(() => {
      setFlashIndex((current) => {
        if (current >= flashDeck.length - 1) {
          setIsFlashRunning(false);
          setIsFlashComplete(true);
          return current;
        }

        setIsFlashAnswerVisible(false);
        return current + 1;
      });
    }, currentFlashTiming.answerMs + currentFlashTiming.gapMs);

    return () => {
      window.clearTimeout(nextTimer);
    };
  }, [
    currentFlashItem,
    currentFlashTiming,
    flashDeck.length,
    isFlashAnswerVisible,
    isFlashComplete,
    isFlashRunning,
    practiceMode,
  ]);

  useEffect(() => {
    if (
      practiceMode !== "flash" ||
      !isFlashRunning ||
      !flashReadAloud ||
      isFlashComplete ||
      !currentFlashItem
    ) {
      return;
    }

    void playOne(currentFlashItem);
  }, [
    currentFlashItem,
    flashReadAloud,
    isFlashComplete,
    isFlashRunning,
    playOne,
    practiceMode,
  ]);

  useEffect(() => {
    if (practiceMode !== "flash") {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableEventTarget(event.target)) {
        return;
      }

      if (event.key === " ") {
        event.preventDefault();
        revealAnswerOrAdvance();
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        goToNextFlash();
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goToPreviousFlash();
        return;
      }

      if (event.key.toLowerCase() === "p") {
        event.preventDefault();
        toggleFlashRunning();
        return;
      }

      if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        playCurrentFlashItem();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    goToNextFlash,
    goToPreviousFlash,
    playCurrentFlashItem,
    practiceMode,
    revealAnswerOrAdvance,
    toggleFlashRunning,
  ]);

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
              value={selectedVoiceURI}
              onChange={(event) => setSelectedVoiceURI(event.target.value)}
              disabled={availability !== "supported"}
            >
              <option value="">ブラウザ既定</option>
              {selectableVoices.map((voice) => (
                <option key={voice.voiceURI} value={voice.voiceURI}>
                  {voice.name} / {voice.lang}
                </option>
              ))}
            </select>
          </div>

          <label className="rate-control">
            <Gauge size={18} aria-hidden="true" />
            <span>{rate.toFixed(2)}</span>
            <input
              aria-label="速度"
              data-testid="rate-slider"
              type="range"
              min={SPEECH_RATE.min}
              max={SPEECH_RATE.max}
              step={SPEECH_RATE.step}
              value={rate}
              onChange={(event) => setRate(Number(event.target.value))}
            />
          </label>
        </div>
      </header>

      <main className="workspace">
        <aside className="sidebar" aria-label="文法">
          <div className="sidebar-summary">
            <span>文法</span>
            <strong>
              {selectedLessons.length} / {content.lessons.length}
            </strong>
          </div>
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
                  className={practiceMode === "list" && viewMode === "sentences" ? "active" : ""}
                  data-testid="sentences-tab"
                  type="button"
                  role="tab"
                  aria-selected={practiceMode === "list" && viewMode === "sentences"}
                  onClick={() => {
                    stopFlash();
                    setPracticeMode("list");
                    setViewMode("sentences");
                  }}
                >
                  <BookOpen size={18} aria-hidden="true" />
                  例文
                </button>
                <button
                  className={practiceMode === "list" && viewMode === "words" ? "active" : ""}
                  data-testid="words-tab"
                  type="button"
                  role="tab"
                  aria-selected={practiceMode === "list" && viewMode === "words"}
                  onClick={() => {
                    stopFlash();
                    setPracticeMode("list");
                    setViewMode("words");
                  }}
                >
                  <Languages size={18} aria-hidden="true" />
                  単語
                </button>
                <button
                  className={practiceMode === "flash" ? "active" : ""}
                  data-testid="flash-tab"
                  type="button"
                  role="tab"
                  aria-selected={practiceMode === "flash"}
                  onClick={() => {
                    stop();
                    setViewMode("sentences");
                    setPracticeMode("flash");
                  }}
                >
                  <Brain size={18} aria-hidden="true" />
                  暗記
                </button>
              </div>
              <p className="eyebrow">{practiceEyebrow}</p>
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
                  onChange={(event) => {
                    setQuery(event.target.value);
                    resetFlashProgress(practiceMode === "flash" || isFlashRunning);
                  }}
                />
              </label>
              {practiceMode === "list" ? (
                <>
                  <button
                    className="primary-action"
                    data-testid="play-visible"
                    type="button"
                    disabled={!canPlay}
                    onClick={() => playQueue(visibleItems)}
                  >
                    <List size={18} aria-hidden="true" />
                    連続
                  </button>
                  <IconButton
                    label="停止"
                    title="停止"
                    variant="neutral"
                    disabled={!isPlaying}
                    onClick={stop}
                  >
                    <Square size={18} aria-hidden="true" />
                  </IconButton>
                </>
              ) : null}
            </div>
          </div>

          {availability === "unsupported" ? (
            <div className="system-notice">このブラウザは読み上げに対応していません。</div>
          ) : null}

          {availability === "supported" &&
          selectableVoices.length > 0 &&
          !hasKoreanVoice ? (
            <div className="system-notice">
              韓国語音声が見つからないため、ブラウザ既定で再生します。
            </div>
          ) : null}

          {practiceMode === "flash" ? (
            <FlashMemorizationPanel
              canReadAloud={availability === "supported"}
              currentIndex={flashIndex}
              isAnswerVisible={isFlashAnswerVisible}
              isComplete={isFlashComplete}
              isReadAloud={flashReadAloud}
              isRunning={isFlashRunning}
              isShuffle={flashShuffle}
              item={currentFlashItem}
              itemCount={flashDeck.length}
              pace={flashPace}
              onPaceChange={setFlashPace}
              onPlayCurrent={playCurrentFlashItem}
              onPrevious={goToPreviousFlash}
              onReadAloudChange={setFlashReadAloud}
              onRestart={restartFlash}
              onReturnToList={() => {
                stopFlash();
                setPracticeMode("list");
                setViewMode("sentences");
              }}
              onRevealOrNext={revealAnswerOrAdvance}
              onNext={goToNextFlash}
              onShuffleChange={updateFlashShuffle}
              onToggleRunning={toggleFlashRunning}
            />
          ) : viewMode === "sentences" ? (
            <SentenceSections
              sections={sentenceSections}
              currentItemId={currentItemId}
              onPlayOne={playOne}
              onPlayQueue={playQueue}
            />
          ) : (
            <VocabularySections
              sections={vocabularySections}
              currentItemId={currentItemId}
              onPlayOne={playOne}
              onPlayQueue={playQueue}
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
          />
        </section>
      ))}
    </div>
  );
}

function FlashMemorizationPanel({
  canReadAloud,
  currentIndex,
  isAnswerVisible,
  isComplete,
  isReadAloud,
  isRunning,
  isShuffle,
  item,
  itemCount,
  pace,
  onNext,
  onPaceChange,
  onPlayCurrent,
  onPrevious,
  onReadAloudChange,
  onRestart,
  onReturnToList,
  onRevealOrNext,
  onShuffleChange,
  onToggleRunning,
}: {
  canReadAloud: boolean;
  currentIndex: number;
  isAnswerVisible: boolean;
  isComplete: boolean;
  isReadAloud: boolean;
  isRunning: boolean;
  isShuffle: boolean;
  item: SpeechPracticeItem | null;
  itemCount: number;
  pace: FlashPace;
  onNext: () => void;
  onPaceChange: (pace: FlashPace) => void;
  onPlayCurrent: () => void;
  onPrevious: () => void;
  onReadAloudChange: (enabled: boolean) => void;
  onRestart: (reshuffle: boolean) => void;
  onReturnToList: () => void;
  onRevealOrNext: () => void;
  onShuffleChange: (enabled: boolean) => void;
  onToggleRunning: () => void;
}) {
  if (itemCount === 0 || !item) {
    return (
      <div className="empty-state">
        左の文法を選択すると暗記を開始できます。
      </div>
    );
  }

  const progressPercent = Math.round(((currentIndex + 1) / itemCount) * 100);
  const answerButtonLabel = isAnswerVisible || isComplete ? "次へ" : "答えを見る";

  return (
    <section className="flash-panel" aria-label="フラッシュ暗記" data-testid="flash-panel">
      <div className="flash-session">
        <div>
          <p className="eyebrow">Flash Session</p>
          <h3>
            {currentIndex + 1} / {itemCount}
          </h3>
        </div>
        <div className="flash-status" aria-label="暗記状態">
          <span>{isRunning ? "自動中" : "一時停止"}</span>
          <span>{isShuffle ? "シャッフル" : "通常順"}</span>
        </div>
      </div>

      <div className="flash-progress" aria-hidden="true">
        <span style={{ width: `${progressPercent}%` }} />
      </div>

      {isComplete ? (
        <article className="flash-card flash-complete-card" data-testid="flash-complete">
          <p className="eyebrow">Complete</p>
          <h3>完了</h3>
          <p>{itemCount}枚を確認しました。</p>
          <div className="flash-complete-actions">
            <button className="primary-action" type="button" onClick={() => onRestart(false)}>
              <RotateCcw size={18} aria-hidden="true" />
              もう一周
            </button>
            <button className="secondary-action" type="button" onClick={() => onRestart(true)}>
              <Shuffle size={18} aria-hidden="true" />
              シャッフルしてもう一周
            </button>
            <button className="secondary-action" type="button" onClick={onReturnToList}>
              <BookOpen size={18} aria-hidden="true" />
              一覧
            </button>
          </div>
        </article>
      ) : (
        <button
          className={`flash-card ${isAnswerVisible ? "answer-visible" : "answer-hidden"}`}
          data-testid="flash-card"
          type="button"
          onClick={onRevealOrNext}
        >
          <span className="flash-context">{item.context}</span>
          <span className="flash-korean" lang="ko">
            {item.korean}
          </span>
          <span className="flash-answer" aria-hidden={!isAnswerVisible}>
            {item.japanese}
          </span>
        </button>
      )}

      <div className="flash-controls" aria-label="暗記操作">
        <IconButton
          label="前へ"
          title="前へ"
          disabled={currentIndex === 0}
          onClick={onPrevious}
        >
          <SkipBack size={18} aria-hidden="true" />
        </IconButton>
        <button
          className="primary-action flash-answer-action"
          type="button"
          disabled={isComplete}
          onClick={onRevealOrNext}
        >
          {isAnswerVisible ? <SkipForward size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
          {answerButtonLabel}
        </button>
        <IconButton
          label="次へ"
          title="次へ"
          disabled={isComplete}
          onClick={onNext}
        >
          <SkipForward size={18} aria-hidden="true" />
        </IconButton>
        <button
          className="primary-action flash-auto-action"
          type="button"
          disabled={isComplete}
          onClick={onToggleRunning}
        >
          {isRunning ? <Pause size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}
          {isRunning ? "一時停止" : "自動開始"}
        </button>
        <IconButton label="韓国語音声" title="韓国語音声" disabled={!canReadAloud} onClick={onPlayCurrent}>
          <Volume2 size={18} aria-hidden="true" />
        </IconButton>
      </div>

      <div className="flash-settings" aria-label="暗記設定">
        <label className="flash-toggle">
          <input
            type="checkbox"
            checked={isShuffle}
            onChange={(event) => onShuffleChange(event.target.checked)}
          />
          <Shuffle size={16} aria-hidden="true" />
          シャッフル
        </label>
        <label className="flash-toggle">
          <input
            type="checkbox"
            checked={isReadAloud}
            disabled={!canReadAloud}
            onChange={(event) => onReadAloudChange(event.target.checked)}
          />
          <Volume2 size={16} aria-hidden="true" />
          音声
        </label>
        <label className="flash-pace">
          <span>間隔</span>
          <select
            value={pace}
            onChange={(event) => onPaceChange(event.target.value as FlashPace)}
          >
            {Object.entries(FLASH_PACE_OPTIONS).map(([value, option]) => (
              <option key={value} value={value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}

function PracticeRows({
  items,
  currentItemId,
  onPlayOne,
}: {
  items: SpeechPracticeItem[];
  currentItemId: string | null;
  onPlayOne: (item: SpeechPracticeItem) => void;
}) {
  const rowRefs = useRef<Map<string, HTMLElement>>(new Map());

  useEffect(() => {
    if (!currentItemId) {
      return;
    }

    const currentRow = rowRefs.current.get(currentItemId);
    if (!currentRow || isElementFullyInViewport(currentRow)) {
      return;
    }

    currentRow.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });
  }, [currentItemId]);

  return (
    <div className="practice-rows">
      {items.map((item) => (
        <article
          key={item.id}
          ref={(node) => {
            if (node) {
              rowRefs.current.set(item.id, node);
            } else {
              rowRefs.current.delete(item.id);
            }
          }}
          data-practice-item-id={item.id}
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

function getFlashTimings(item: SpeechPracticeItem, pace: FlashPace) {
  const option = FLASH_PACE_OPTIONS[pace];

  return {
    answerMs: clamp(
      Math.round((600 + item.japanese.length * 25) * option.answerMultiplier),
      700,
      3600,
    ),
    gapMs: option.gapMs,
    questionMs: clamp(
      Math.round((700 + item.korean.length * 35) * option.questionMultiplier),
      900,
      3800,
    ),
  };
}

function shufflePracticeItems(items: SpeechPracticeItem[], seed: number) {
  const random = createSeededRandom(seed);
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

function createSeededRandom(seed: number) {
  let value = seed;

  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function isElementFullyInViewport(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;

  return rect.top >= 0 && rect.left >= 0 && rect.bottom <= viewportHeight && rect.right <= viewportWidth;
}

function isEditableEventTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  return ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName);
}

function useLocalStorageState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") {
      return initialValue;
    }

    const storedValue = window.localStorage.getItem(key);
    if (!storedValue) {
      return initialValue;
    }

    try {
      return JSON.parse(storedValue) as T;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue] as const;
}
