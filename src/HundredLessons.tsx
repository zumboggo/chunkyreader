import { useState, useEffect } from 'react';
import { playAudioUrl } from './audioClipPack';
import type { HundredLesson } from './types';

function Mascot({ mood = 'reading' }: { mood?: 'happy' | 'reading' | 'sad' | 'curious' }) {
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

function ChunkyLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`chunky-logo ${compact ? 'compact' : ''}`} aria-label="Chunky Reader">
      <span>Chunky</span>
      <strong>Reading</strong>
    </div>
  );
}

function PlayIcon() {
  return <span className="play-icon" aria-hidden="true" />;
}

export function HundredLessonsHome({
  onChooseLesson
}: {
  onChooseLesson: (lessonId: string) => void
}) {
  const [lessons, setLessons] = useState<{ id: string, lessonNumber: number }[]>([]);
  const [nextLesson, setNextLesson] = useState<number>(50);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}100-lessons/index.json`)
      .then(r => r.json())
      .then(data => {
        setLessons(data);
        const saved = localStorage.getItem('100-lessons-progress');
        if (saved) {
          setNextLesson(parseInt(saved, 10));
        } else {
          setNextLesson(data[0]?.lessonNumber || 50);
        }
      })
      .catch(e => console.error(e));
  }, []);

  const handleStart = () => {
    const lesson = lessons.find(l => l.lessonNumber === nextLesson) || lessons[0];
    if (lesson) onChooseLesson(lesson.id);
  };

  const handleRestart = () => {
    const lesson = lessons[0];
    if (lesson) onChooseLesson(lesson.id);
  };

  return (
    <section className="growing-reader-home">
      <div className="reader-hero">
        <div>
          <ChunkyLogo compact />
          <h1>100 Lessons</h1>
          <p>Teach Your Child to Read in 100 Easy Lessons</p>
        </div>
        <Mascot mood="reading" />
      </div>
      <div className="reader-choice-grid" aria-label="Choose a lesson action">
        <button type="button" className="reader-choice story-choice" onClick={handleStart}>
          <span className="choice-sticker" aria-hidden="true">📖</span>
          <strong>Continue Lesson {nextLesson}</strong>
          <small>Next Lesson</small>
        </button>
        <button type="button" className="reader-choice word-choice" onClick={handleRestart}>
          <span className="choice-sticker" aria-hidden="true">⏪</span>
          <strong>Start from {lessons[0]?.lessonNumber || 50}</strong>
          <small>First Lesson</small>
        </button>
      </div>
    </section>
  );
}

export function HundredLessonScreen({
  lessonId,
  onDone
}: {
  lessonId: string;
  onDone: () => void;
}) {
  const [lesson, setLesson] = useState<HundredLesson | null>(null);
  const [chunkIndex, setChunkIndex] = useState(0);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}100-lessons/${lessonId}.json`)
      .then(r => r.json())
      .then((data: HundredLesson) => setLesson(data))
      .catch(e => console.error(e));
  }, [lessonId]);

  useEffect(() => {
    if (lesson && lesson.chunks[chunkIndex]) {
      const chunk = lesson.chunks[chunkIndex];
      // Autoplay audio for the first item in the chunk if available
      if (chunk.audioPaths?.[0]) {
        playAudioUrl(`${import.meta.env.BASE_URL}100-lessons/${chunk.audioPaths[0]}`);
      }
    }
  }, [lesson, chunkIndex]);

  if (!lesson) {
    return (
      <section className="loading-screen">
        <Mascot mood="curious" />
        <h1>Loading Lesson...</h1>
      </section>
    );
  }

  const chunk = lesson.chunks[chunkIndex];
  if (!chunk) return null;

  const handleNext = () => {
    if (chunkIndex < lesson.chunks.length - 1) {
      setChunkIndex(chunkIndex + 1);
    } else {
      localStorage.setItem('100-lessons-progress', String(lesson.lessonNumber + 1));
      onDone();
    }
  };

  const handlePrev = () => {
    if (chunkIndex > 0) {
      setChunkIndex(chunkIndex - 1);
    }
  };

  const playItemAudio = (index: number) => {
    if (chunk.audioPaths?.[index]) {
      playAudioUrl(`${import.meta.env.BASE_URL}100-lessons/${chunk.audioPaths[index]}`);
    }
  };

  return (
    <section className="learning-screen">
      <div className="story-reader-top" style={{ padding: '1rem', background: 'white' }}>
        <div>
          <span>100 Lessons</span>
          <strong>Lesson {lesson.lessonNumber}</strong>
        </div>
        <div>Chunk {chunkIndex + 1} of {lesson.chunks.length}</div>
      </div>
      
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        {chunk.type === 'sounds-words' ? (
          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            {chunk.items.map((item, i) => (
              <button key={i} onClick={() => playItemAudio(i)} style={{ fontSize: '4rem', padding: '1rem 2rem', borderRadius: '1rem', border: '2px solid #eee', background: 'white', cursor: 'pointer' }}>
                {item}
              </button>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: '2.5rem', textAlign: 'center', background: 'white', padding: '2rem', borderRadius: '1rem', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            {chunk.items[0]}
            <div style={{ marginTop: '1rem' }}>
              <button onClick={() => playItemAudio(0)} className="sound-button read-to-me">
                <PlayIcon /> Read to Me
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="story-nav" style={{ padding: '1rem', background: 'white', display: 'flex', justifyContent: 'space-between' }}>
        <button type="button" disabled={chunkIndex === 0} onClick={handlePrev}>
          Back
        </button>
        <button type="button" className="primary" onClick={handleNext}>
          {chunkIndex >= lesson.chunks.length - 1 ? 'Finish Lesson' : 'Next'}
        </button>
      </div>
    </section>
  );
}
