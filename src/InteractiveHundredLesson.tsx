import { useEffect, useMemo, useState } from 'react';
import { playAudioUrl } from './audioClipPack';
import { recordLocalProgressChange } from './cloudProgressSync';
import type { HundredLesson, HundredLessonChunk } from './types';
import { markHundredLessonComplete, type CompletionRewardResult } from './progress';

type MascotMood = 'happy' | 'reading' | 'sad' | 'curious';
type JourneyStepHandler = () => void;

type LessonActivity =
  | { kind: 'collection-check'; sounds: string[] }
  | { kind: 'chunk'; chunk: HundredLessonChunk }
  | { kind: 'picture-reveal'; chunk: HundredLessonChunk }
  | { kind: 'sound-writing'; sounds: string[]; audioPaths?: string[] }
  | { kind: 'complete'; sounds: string[] };

function lessonAsset(path?: string) {
  if (!path) return undefined;
  if (/^(https?:|data:|blob:)/u.test(path)) return path;
  return `${import.meta.env.BASE_URL}100-lessons/${path}`.replace(/([^:]\/)\/+/gu, '$1');
}

function hundredAsset(path: string) {
  return `${import.meta.env.BASE_URL}assets/100-lessons/${path}`.replace(/([^:]\/)\/+/gu, '$1');
}

function playLessonAudio(path?: string) {
  const url = lessonAsset(path);
  if (url) void playAudioUrl(url);
}

function Mascot({ mood = 'reading' }: { mood?: MascotMood }) {
  const src = `${import.meta.env.BASE_URL}assets/mascots/mascot-expressions.png`;
  return (
    <span
      className={`mascot-sprite large mood-${mood}`}
      role="img"
      aria-label={`Chunky Reader panda mascot feeling ${mood}`}
      style={{ backgroundImage: `url(${src})` }}
    />
  );
}

function buildLessonActivities(chunks: HundredLessonChunk[]): LessonActivity[] {
  const soundChunk = chunks.find((chunk) => chunk.type === 'sound-discovery' || chunk.type === 'sounds-words');
  const storyChunk = chunks.find((chunk) => chunk.type === 'story-gauntlet' || chunk.type === 'story');
  const sounds = soundChunk?.items ?? [];
  const activities: LessonActivity[] = [{ kind: 'collection-check', sounds }];

  for (const chunk of chunks) activities.push({ kind: 'chunk', chunk });

  if (storyChunk?.imagePath) activities.push({ kind: 'picture-reveal', chunk: storyChunk });
  if (sounds.length) activities.push({ kind: 'sound-writing', sounds, audioPaths: soundChunk?.audioPaths });
  activities.push({ kind: 'complete', sounds });
  return activities;
}

function countStoryWords(items: string[]) {
  return items.reduce((sum, sentence) => sum + wordsFromSentence(sentence).filter((word) => /[A-Za-z']/u.test(word)).length, 0);
}

function countJourneyStepsForActivity(activity?: LessonActivity) {
  if (!activity) return 1;
  if (activity.kind === 'collection-check') return 1;
  if (activity.kind === 'picture-reveal') return 1;
  if (activity.kind === 'sound-writing') return Math.max(1, activity.sounds.length);
  if (activity.kind === 'complete') return 1;
  const { chunk } = activity;
  if (chunk.type === 'story-gauntlet' || chunk.type === 'story') return Math.max(1, countStoryWords(chunk.items) + (chunk.items.length * 2));
  return Math.max(1, chunk.items.length);
}

function JourneyTracker({ step, totalSteps }: { step: number; totalSteps: number }) {
  const safeTotal = Math.max(1, totalSteps);
  const progress = Math.min(1, Math.max(0, step / safeTotal));
  const frame = (step % 3) + 1;

  return (
    <aside className="journey-tracker" aria-label={`Reading well journey step ${step} of ${safeTotal}`}>
      <div className="journey-tracker-copy">
        <strong>Reading Well</strong>
        <span>{step} {step === 1 ? 'step' : 'steps'}</span>
      </div>
      <div className="journey-mini-path" aria-hidden="true">
        <span className="journey-path-line" />
        <img
          src={hundredAsset(`panda-walk-${frame}.png`)}
          alt=""
          className="journey-walker"
          style={{ left: `${progress * 82}%` }}
        />
        <span className="journey-well-marker">Well</span>
      </div>
    </aside>
  );
}

function CollectionCheck({ sounds, onComplete, onJourneyStep }: { sounds: string[]; onComplete: () => void; onJourneyStep: JourneyStepHandler }) {
  const startPath = () => {
    onJourneyStep();
    onComplete();
  };

  return (
    <div className="distar-activity path-intro journey-intro">
      <div className="journey-intro-art">
        <img src={hundredAsset('reading-well-journey.png')} alt="" />
      </div>
      <div className="journey-intro-panda">
        <Mascot mood="reading" />
        <p>I'm on a journey to the reading well.</p>
      </div>
      <div className="activity-copy">
        <span className="activity-kicker">Reading journey</span>
        <h1>Walk the reading path.</h1>
        <p>Each sound, word, and sentence helps Chunky take one step.</p>
      </div>
      <div className="sound-badge-row" aria-label="Sounds in this lesson">
        {sounds.map((sound) => (
          <span className="sound-badge" key={sound}>
            {sound}
          </span>
        ))}
      </div>
      <button type="button" className="path-start-button" onClick={startPath}>
        Start the reading path
      </button>
    </div>
  );
}

function SoundDiscoveryNode({
  items,
  audioPaths,
  onComplete,
  onJourneyStep,
}: {
  items: string[];
  audioPaths?: string[];
  onComplete: () => void;
  onJourneyStep: JourneyStepHandler;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [discovered, setDiscovered] = useState<boolean[]>(() => new Array(items.length).fill(false));

  const discover = (index: number) => {
    if (index !== currentIndex) return;
    if (discovered[index]) return;
    playLessonAudio(audioPaths?.[index]);
    onJourneyStep();
    setDiscovered((previous) => previous.map((done, itemIndex) => done || itemIndex === index));
    if (index < items.length - 1) {
      window.setTimeout(() => setCurrentIndex(index + 1), 350);
    } else {
      window.setTimeout(onComplete, 800);
    }
  };

  return (
    <div className="distar-activity sound-discovery">
      <div className="activity-copy compact">
        <span className="activity-kicker">New sounds</span>
        <h1>Trace to wake the sound.</h1>
        <p>The panda waits at the next station.</p>
      </div>
      <div className="reading-path-line" aria-label="Trace sounds from left to right">
        {items.map((item, index) => (
          <button
            type="button"
            key={`${item}-${index}`}
            className={`sound-station ${discovered[index] ? 'is-awake' : ''} ${index === currentIndex ? 'is-current' : ''}`}
            onPointerDown={() => discover(index)}
            disabled={index > currentIndex}
          >
            <span className="station-path" aria-hidden="true" />
            <span className="station-ball" aria-hidden="true" />
            <strong>{item}</strong>
          </button>
        ))}
      </div>
    </div>
  );
}

function BlendingBridge({
  items,
  audioPaths,
  onComplete,
  onJourneyStep,
}: {
  items: string[];
  audioPaths?: string[];
  onComplete: () => void;
  onJourneyStep: JourneyStepHandler;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isTracing, setIsTracing] = useState(false);

  const visit = (index: number) => {
    if (index > activeIndex) return;
    playLessonAudio(audioPaths?.[index]);
    if (index === activeIndex) {
      onJourneyStep();
      if (index < items.length - 1) {
        setActiveIndex(index + 1);
      } else {
        window.setTimeout(onComplete, 900);
      }
    }
  };

  return (
    <div className="distar-activity blending-bridge">
      <div className="activity-copy compact">
        <span className="activity-kicker">Blend bridge</span>
        <h1>Slide across the words.</h1>
        <p>Keep moving left to right. Smooth reading wakes the bridge.</p>
      </div>
      <div
        className="bridge-track"
        onPointerDown={() => setIsTracing(true)}
        onPointerUp={() => setIsTracing(false)}
        onPointerLeave={() => setIsTracing(false)}
      >
        {items.map((word, index) => (
          <button
            type="button"
            key={`${word}-${index}`}
            className={`bridge-step ${index < activeIndex ? 'is-read' : ''} ${index === activeIndex ? 'is-current' : ''}`}
            onClick={() => visit(index)}
            onPointerEnter={() => {
              if (isTracing) visit(index);
            }}
          >
            <span className="bridge-ball" aria-hidden="true" />
            <strong>{word}</strong>
          </button>
        ))}
      </div>
    </div>
  );
}

function deriveSharedRime(words: string[]) {
  const cleanWords = words.map((word) => word.toLowerCase().replace(/[^a-z]/gu, '')).filter(Boolean);
  if (cleanWords.length === 0) return '';
  const shortest = cleanWords.reduce((current, word) => (word.length < current.length ? word : current), cleanWords[0]);

  for (let length = Math.max(1, shortest.length - 1); length >= 1; length -= 1) {
    const suffix = shortest.slice(-length);
    if (cleanWords.every((word) => word.endsWith(suffix))) return suffix;
  }

  return shortest.length <= 2 ? shortest.slice(-1) : shortest.slice(1);
}

function splitRimeWord(word: string, rime: string) {
  if (!rime || !word.toLowerCase().endsWith(rime.toLowerCase())) {
    return { onset: word, rime: '' };
  }
  const onset = word.slice(0, word.length - rime.length);
  return { onset, rime: word.slice(word.length - rime.length) };
}

function RhymePuzzle({
  items,
  audioPaths,
  onComplete,
  onJourneyStep,
}: {
  items: string[];
  audioPaths?: string[];
  onComplete: () => void;
  onJourneyStep: JourneyStepHandler;
}) {
  const [solved, setSolved] = useState<string[]>([]);
  const baseRime = deriveSharedRime(items);
  const targetItems = items.filter((word) => splitRimeWord(word, baseRime).rime);

  useEffect(() => {
    if (targetItems.length > 0 && solved.length === targetItems.length) {
      const timer = window.setTimeout(onComplete, 900);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [onComplete, solved.length, targetItems.length]);

  const choose = (word: string, index: number) => {
    playLessonAudio(audioPaths?.[index]);
    if (!splitRimeWord(word, baseRime).rime) return;
    setSolved((previous) => {
      if (previous.includes(word)) return previous;
      onJourneyStep();
      return [...previous, word];
    });
  };

  return (
    <div className="distar-activity rhyme-puzzle">
      <div className="activity-copy compact">
        <span className="activity-kicker">Rhyme puzzle</span>
        <h1>Build the {baseRime} family.</h1>
        <p>Tap each beginning sound and listen for the matching ending.</p>
      </div>
      <div className="rime-base">-{baseRime}</div>
      <div className="rhyme-container">
        {items.map((word, index) => {
          const { onset, rime } = splitRimeWord(word, baseRime);
          const isSolved = solved.includes(word);
          return (
            <button
              type="button"
              key={word}
              className={`rhyme-piece ${isSolved ? 'solved' : ''}`}
              onClick={() => choose(word, index)}
            >
              <span>{onset}</span>
              <strong>{rime || baseRime}</strong>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function wordsFromSentence(sentence: string) {
  return sentence.match(/[A-Za-z]+(?:'[A-Za-z]+)?|[.,!?;]/gu) ?? [];
}

function StoryGauntlet({
  items,
  audioPaths,
  wordAudioPaths,
  imagePath,
  onComplete,
  onJourneyStep,
}: {
  items: string[];
  audioPaths?: string[];
  wordAudioPaths?: string[][];
  imagePath?: string;
  onComplete: () => void;
  onJourneyStep: JourneyStepHandler;
}) {
  const [pass, setPass] = useState<1 | 2 | 3>(1);
  const [currentSentence, setCurrentSentence] = useState(0);
  const [wordIndex, setWordIndex] = useState(0);
  const words = wordsFromSentence(items[currentSentence] ?? '');
  const wordCount = words.filter((word) => /[A-Za-z']/u.test(word)).length;
  const allWordsTouched = wordIndex >= wordCount;

  const goToNextSentence = () => {
    if (pass > 1) onJourneyStep();
    if (currentSentence < items.length - 1) {
      setCurrentSentence((previous) => previous + 1);
      setWordIndex(0);
      return;
    }
    if (pass < 3) {
      setPass((previous) => (previous + 1) as 1 | 2 | 3);
      setCurrentSentence(0);
      setWordIndex(0);
      return;
    }
    onComplete();
  };

  const touchWord = (visibleWordIndex: number) => {
    if (visibleWordIndex !== wordIndex) return;
    playLessonAudio(wordAudioPaths?.[currentSentence]?.[visibleWordIndex]);
    onJourneyStep();
    setWordIndex((previous) => previous + 1);
  };

  const playSentence = () => playLessonAudio(audioPaths?.[currentSentence]);

  return (
    <div className="distar-activity story-gauntlet">
      <div className="story-stage">
        {imagePath ? (
          <img src={lessonAsset(imagePath)} alt="Story scene" className="story-preview-image" />
        ) : (
          <div className="story-preview-fallback">Story picture</div>
        )}
        <div className="story-pass-card">
          <span className="activity-kicker">Story pass {pass} of 3</span>
          <h1>{pass === 1 ? 'Touch each word.' : pass === 2 ? 'Read it smoother.' : 'Swipe the sentence.'}</h1>
          <p>
            {pass === 1
              ? 'The words glow as you read them.'
              : pass === 2
                ? 'Tap the sentence and say it without stopping.'
                : 'One smooth move unlocks the picture.'}
          </p>
        </div>
      </div>

      <div className={`story-text-path pass-${pass}`}>
        {pass === 1 ? (
          <div className="word-touch-row">
            {words.map((word, index) => {
              if (!/[A-Za-z']/u.test(word)) {
                return (
                  <span className="story-punctuation" key={`${word}-${index}`}>
                    {word}
                  </span>
                );
              }
              const visibleWordIndex = words.slice(0, index + 1).filter((item) => /[A-Za-z']/u.test(item)).length - 1;
              return (
                <button
                  type="button"
                  key={`${word}-${index}`}
                  className={`story-word ${visibleWordIndex < wordIndex ? 'is-read' : ''} ${
                    visibleWordIndex === wordIndex ? 'is-current' : ''
                  }`}
                  onClick={() => touchWord(visibleWordIndex)}
                >
                  {word}
                </button>
              );
            })}
          </div>
        ) : (
          <button type="button" className="sentence-swipe" onClick={playSentence}>
            {items[currentSentence]}
          </button>
        )}
      </div>

      <button
        type="button"
        className="path-start-button secondary"
        onClick={() => {
          if (pass > 1) playSentence();
          if (pass === 1 && !allWordsTouched) return;
          goToNextSentence();
        }}
        disabled={pass === 1 && !allWordsTouched}
      >
        {pass === 1 && !allWordsTouched
          ? 'Touch the glowing word'
          : currentSentence === items.length - 1 && pass === 3
            ? 'Reveal picture'
            : 'Keep reading'}
      </button>
    </div>
  );
}

function PictureReveal({ chunk, onComplete, onJourneyStep }: { chunk: HundredLessonChunk; onComplete: () => void; onJourneyStep: JourneyStepHandler }) {
  const completeReveal = () => {
    onJourneyStep();
    onComplete();
  };

  return (
    <div className="distar-activity picture-reveal">
      <span className="activity-kicker">Picture unlocked</span>
      <h1>Now see what happened.</h1>
      {chunk.imagePath ? (
        <img src={lessonAsset(chunk.imagePath)} alt="Story reward scene" className="picture-reveal-image" />
      ) : (
        <div className="story-preview-fallback">Picture unlocked</div>
      )}
      <button type="button" className="path-start-button" onClick={completeReveal}>
        Talk about it
      </button>
    </div>
  );
}

function SoundWritingSandbox({
  sounds,
  audioPaths,
  onComplete,
  onJourneyStep,
}: {
  sounds: string[];
  audioPaths?: string[];
  onComplete: () => void;
  onJourneyStep: JourneyStepHandler;
}) {
  const [painted, setPainted] = useState<string[]>([]);

  const traceSound = (sound: string, index: number) => {
    playLessonAudio(audioPaths?.[index]);
    setPainted((previous) => {
      if (previous.includes(sound)) return previous;
      onJourneyStep();
      return [...previous, sound];
    });
  };

  return (
    <div className="distar-activity sound-writing">
      <div className="activity-copy compact">
        <span className="activity-kicker">Finger paint</span>
        <h1>Trace the sounds.</h1>
        <p>Touch each card and drag left to right.</p>
      </div>
      <div className="writing-grid">
        {sounds.map((sound, index) => (
          <button
            type="button"
            key={sound}
            className={`writing-card ${painted.includes(sound) ? 'painted' : ''}`}
            onPointerDown={() => traceSound(sound, index)}
          >
            <span className="paint-trail" aria-hidden="true" />
            <strong>{sound}</strong>
          </button>
        ))}
      </div>
      <button type="button" className="path-start-button secondary" onClick={onComplete} disabled={painted.length < sounds.length}>
        {painted.length < sounds.length ? 'Trace every sound' : 'Finish lesson'}
      </button>
    </div>
  );
}

function LessonComplete({ lessonNumber, sounds, onDone }: { lessonNumber: number; sounds: string[]; onDone: () => void }) {
  return (
    <div className="distar-activity lesson-complete">
      <Mascot mood="happy" />
      <span className="activity-kicker">Sticker earned</span>
      <h1>Lesson {lessonNumber} complete!</h1>
      <p>You moved through the whole reading path.</p>
      <div className="sound-badge-row">
        {sounds.map((sound) => (
          <span className="sound-badge earned" key={sound}>
            {sound}
          </span>
        ))}
      </div>
      <button type="button" className="path-start-button" onClick={onDone}>
        Done
      </button>
    </div>
  );
}

function incrementHundredLessonStickers() {
  try {
    const current = Number.parseInt(window.localStorage.getItem('completed-lessons-100') || '0', 10);
    window.localStorage.setItem('completed-lessons-100', String((Number.isFinite(current) ? current : 0) + 1));
    recordLocalProgressChange();
  } catch {
    // Stickers are a reward layer; lessons must still finish if storage is unavailable.
  }
}

export function InteractiveHundredLessonScreen({
  lessonId,
  onDone,
  onHome,
  onReward,
}: {
  lessonId: string;
  onDone: () => void;
  onHome: () => void;
  onReward?: (result: CompletionRewardResult) => void;
}) {
  const [lesson, setLesson] = useState<HundredLesson | null>(null);
  const [activityIndex, setActivityIndex] = useState(0);
  const [journeyStep, setJourneyStep] = useState(0);

  useEffect(() => {
    setLesson(null);
    setActivityIndex(0);
    setJourneyStep(0);
    fetch(`${import.meta.env.BASE_URL}100-lessons/${lessonId}.json`)
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load ${lessonId}.json`);
        return response.json();
      })
      .then((data: HundredLesson) => setLesson(data))
      .catch((error) => console.error(error));
  }, [lessonId]);

  const activities = useMemo(() => buildLessonActivities(lesson?.chunks ?? []), [lesson]);
  const activity = activities[activityIndex];
  const journeyTotalSteps = useMemo(() => countJourneyStepsForActivity(activity), [activity]);
  const sounds = activities.find((item): item is { kind: 'collection-check'; sounds: string[] } => item.kind === 'collection-check')?.sounds ?? [];

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === '4') {
        event.preventDefault();
        if (activityIndex > 0) {
          setJourneyStep(0);
          setActivityIndex((previous) => previous - 1);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activityIndex]);

  if (!lesson || !activity) {
    return (
      <section className="loading-screen">
        <Mascot mood="curious" />
        <h1>Loading Lesson...</h1>
      </section>
    );
  }

  const completeActivity = () => {
    setJourneyStep(0);
    setActivityIndex((previous) => Math.min(previous + 1, activities.length - 1));
  };
  const advanceJourney = () => setJourneyStep((step) => Math.min(step + 1, journeyTotalSteps));
  const finishLesson = () => {
    localStorage.setItem('100-lessons-progress', String(lesson.lessonNumber + 1));
    recordLocalProgressChange();
    incrementHundredLessonStickers();
    const rewardResult = markHundredLessonComplete(lesson.id);
    onReward?.(rewardResult);
    onDone();
  };

  const renderActivity = () => {
    switch (activity.kind) {
      case 'collection-check':
        return <CollectionCheck sounds={activity.sounds} onComplete={completeActivity} onJourneyStep={advanceJourney} />;
      case 'picture-reveal':
        return <PictureReveal chunk={activity.chunk} onComplete={completeActivity} onJourneyStep={advanceJourney} />;
      case 'sound-writing':
        return <SoundWritingSandbox sounds={activity.sounds} audioPaths={activity.audioPaths} onComplete={completeActivity} onJourneyStep={advanceJourney} />;
      case 'complete':
        return <LessonComplete lessonNumber={lesson.lessonNumber} sounds={activity.sounds} onDone={finishLesson} />;
      case 'chunk':
        switch (activity.chunk.type) {
          case 'sound-discovery':
          case 'sounds-words':
            return <SoundDiscoveryNode items={activity.chunk.items} audioPaths={activity.chunk.audioPaths} onComplete={completeActivity} onJourneyStep={advanceJourney} />;
          case 'blending-bridge':
            return <BlendingBridge items={activity.chunk.items} audioPaths={activity.chunk.audioPaths} onComplete={completeActivity} onJourneyStep={advanceJourney} />;
          case 'rhyme-puzzle':
            return <RhymePuzzle items={activity.chunk.items} audioPaths={activity.chunk.audioPaths} onComplete={completeActivity} onJourneyStep={advanceJourney} />;
          case 'story-gauntlet':
          case 'story':
            return (
              <StoryGauntlet
                items={activity.chunk.items}
                audioPaths={activity.chunk.audioPaths}
                wordAudioPaths={activity.chunk.wordAudioPaths}
                imagePath={activity.chunk.imagePath}
                onComplete={completeActivity}
                onJourneyStep={advanceJourney}
              />
            );
          default:
            return <div className="distar-activity">Unknown activity type.</div>;
        }
    }
  };

  return (
    <section className="learning-screen distar-path">
      <header className="distar-header">
        <button type="button" className="mini-button" onClick={onDone}>
          Back
        </button>
        <button type="button" className="mini-button home-mini-button" onClick={onHome}>
          Home
        </button>
        <div className="distar-title">
          <span>100 Lessons</span>
          <strong>Lesson {lesson.lessonNumber}</strong>
        </div>
        <div className="sound-collection-mini" aria-label="Sound collection">
          {sounds.slice(0, 6).map((sound) => (
            <span key={sound}>{sound}</span>
          ))}
        </div>
      </header>
      <div className="distar-progress" aria-label={`Activity ${activityIndex + 1} of ${activities.length}`}>
        <span style={{ width: `${((activityIndex + 1) / activities.length) * 100}%` }} />
      </div>
      <main className="distar-canvas">
        {renderActivity()}
        <JourneyTracker step={journeyStep} totalSteps={journeyTotalSteps} />
      </main>
    </section>
  );
}
