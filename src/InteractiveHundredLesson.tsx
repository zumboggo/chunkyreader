import { useEffect, useMemo, useState } from 'react';
import { playAudioUrl } from './audioClipPack';
import type { HundredLesson, HundredLessonChunk } from './types';

type MascotMood = 'happy' | 'reading' | 'sad' | 'curious';

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

function CollectionCheck({ sounds, onComplete }: { sounds: string[]; onComplete: () => void }) {
  return (
    <div className="distar-activity path-intro">
      <Mascot mood="reading" />
      <div className="activity-copy">
        <span className="activity-kicker">Sound collection</span>
        <h1>Warm up the path.</h1>
        <p>Touch the glowing trail. Then we will wake up each sound.</p>
      </div>
      <div className="sound-badge-row" aria-label="Sounds in this lesson">
        {sounds.map((sound) => (
          <span className="sound-badge" key={sound}>
            {sound}
          </span>
        ))}
      </div>
      <button type="button" className="path-start-button" onClick={onComplete}>
        Start the reading path
      </button>
    </div>
  );
}

function SoundDiscoveryNode({
  items,
  audioPaths,
  onComplete,
}: {
  items: string[];
  audioPaths?: string[];
  onComplete: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [discovered, setDiscovered] = useState<boolean[]>(() => new Array(items.length).fill(false));

  const discover = (index: number) => {
    if (index !== currentIndex) return;
    playLessonAudio(audioPaths?.[index]);
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
}: {
  items: string[];
  audioPaths?: string[];
  onComplete: () => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isTracing, setIsTracing] = useState(false);

  const visit = (index: number) => {
    if (index > activeIndex) return;
    playLessonAudio(audioPaths?.[index]);
    if (index === activeIndex) {
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

function getRime(word: string) {
  return word.length <= 2 ? word : word.slice(1);
}

function RhymePuzzle({
  items,
  audioPaths,
  onComplete,
}: {
  items: string[];
  audioPaths?: string[];
  onComplete: () => void;
}) {
  const [solved, setSolved] = useState<string[]>([]);
  const baseRime = items[0] ? getRime(items[0]) : '';

  useEffect(() => {
    if (items.length > 0 && solved.length === items.length) {
      const timer = window.setTimeout(onComplete, 900);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [items.length, onComplete, solved.length]);

  const choose = (word: string, index: number) => {
    playLessonAudio(audioPaths?.[index]);
    if (!word.endsWith(baseRime)) return;
    setSolved((previous) => {
      if (previous.includes(word)) return previous;
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
          const onset = word.slice(0, Math.max(1, word.length - baseRime.length));
          const isSolved = solved.includes(word);
          return (
            <button
              type="button"
              key={word}
              className={`rhyme-piece ${isSolved ? 'solved' : ''}`}
              onClick={() => choose(word, index)}
            >
              <span>{onset}</span>
              <strong>{baseRime}</strong>
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
}: {
  items: string[];
  audioPaths?: string[];
  wordAudioPaths?: string[][];
  imagePath?: string;
  onComplete: () => void;
}) {
  const [pass, setPass] = useState<1 | 2 | 3>(1);
  const [currentSentence, setCurrentSentence] = useState(0);
  const [wordIndex, setWordIndex] = useState(0);
  const words = wordsFromSentence(items[currentSentence] ?? '');
  const wordCount = words.filter((word) => /[A-Za-z']/u.test(word)).length;
  const allWordsTouched = wordIndex >= wordCount;

  const goToNextSentence = () => {
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

function PictureReveal({ chunk, onComplete }: { chunk: HundredLessonChunk; onComplete: () => void }) {
  return (
    <div className="distar-activity picture-reveal">
      <span className="activity-kicker">Picture unlocked</span>
      <h1>Now see what happened.</h1>
      {chunk.imagePath ? (
        <img src={lessonAsset(chunk.imagePath)} alt="Story reward scene" className="picture-reveal-image" />
      ) : (
        <div className="story-preview-fallback">Picture unlocked</div>
      )}
      <button type="button" className="path-start-button" onClick={onComplete}>
        Talk about it
      </button>
    </div>
  );
}

function SoundWritingSandbox({
  sounds,
  audioPaths,
  onComplete,
}: {
  sounds: string[];
  audioPaths?: string[];
  onComplete: () => void;
}) {
  const [painted, setPainted] = useState<string[]>([]);

  const traceSound = (sound: string, index: number) => {
    playLessonAudio(audioPaths?.[index]);
    setPainted((previous) => (previous.includes(sound) ? previous : [...previous, sound]));
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

export function InteractiveHundredLessonScreen({ lessonId, onDone }: { lessonId: string; onDone: () => void }) {
  const [lesson, setLesson] = useState<HundredLesson | null>(null);
  const [activityIndex, setActivityIndex] = useState(0);

  useEffect(() => {
    setLesson(null);
    setActivityIndex(0);
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
  const sounds = activities.find((item): item is { kind: 'collection-check'; sounds: string[] } => item.kind === 'collection-check')?.sounds ?? [];

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === '4') {
        event.preventDefault();
        if (activityIndex > 0) setActivityIndex((previous) => previous - 1);
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

  const completeActivity = () => setActivityIndex((previous) => Math.min(previous + 1, activities.length - 1));
  const finishLesson = () => {
    localStorage.setItem('100-lessons-progress', String(lesson.lessonNumber + 1));
    onDone();
  };

  const renderActivity = () => {
    switch (activity.kind) {
      case 'collection-check':
        return <CollectionCheck sounds={activity.sounds} onComplete={completeActivity} />;
      case 'picture-reveal':
        return <PictureReveal chunk={activity.chunk} onComplete={completeActivity} />;
      case 'sound-writing':
        return <SoundWritingSandbox sounds={activity.sounds} audioPaths={activity.audioPaths} onComplete={completeActivity} />;
      case 'complete':
        return <LessonComplete lessonNumber={lesson.lessonNumber} sounds={activity.sounds} onDone={finishLesson} />;
      case 'chunk':
        switch (activity.chunk.type) {
          case 'sound-discovery':
          case 'sounds-words':
            return <SoundDiscoveryNode items={activity.chunk.items} audioPaths={activity.chunk.audioPaths} onComplete={completeActivity} />;
          case 'blending-bridge':
            return <BlendingBridge items={activity.chunk.items} audioPaths={activity.chunk.audioPaths} onComplete={completeActivity} />;
          case 'rhyme-puzzle':
            return <RhymePuzzle items={activity.chunk.items} audioPaths={activity.chunk.audioPaths} onComplete={completeActivity} />;
          case 'story-gauntlet':
          case 'story':
            return (
              <StoryGauntlet
                items={activity.chunk.items}
                audioPaths={activity.chunk.audioPaths}
                wordAudioPaths={activity.chunk.wordAudioPaths}
                imagePath={activity.chunk.imagePath}
                onComplete={completeActivity}
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
      <main className="distar-canvas">{renderActivity()}</main>
    </section>
  );
}
