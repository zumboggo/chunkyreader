import { useState, useEffect } from 'react';

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

export { InteractiveHundredLessonScreen as HundredLessonScreen } from './InteractiveHundredLesson';
