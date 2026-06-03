import { useState, useEffect } from 'react';

function Mascot({ mood = 'reading' }: { mood?: 'happy' | 'reading' | 'sad' | 'curious' }) {
  const src = `${import.meta.env.BASE_URL}assets/mascots/mascot-expressions.png`;
  return (
    <span
      className={`mascot-sprite large mood-${mood}`}
      role="img"
      aria-label={`Chunky Learner panda mascot feeling ${mood}`}
      style={{ backgroundImage: `url(${src})` }}
    />
  );
}

function ChunkyLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`chunky-logo ${compact ? 'compact' : ''}`} aria-label="Chunky Learner">
      <span>Chunky</span>
      <strong>Learner</strong>
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
  const [chooserOpen, setChooserOpen] = useState(false);

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

  const handleChooseLesson = (lessonId: string) => {
    if (lessonId) onChooseLesson(lessonId);
  };

  return (
    <section className="growing-reader-home">
      <div className="reader-hero hundred-lessons-hero">
        <img
          className="hundred-journey-map"
          src={`${import.meta.env.BASE_URL}assets/100-lessons/reading-well-journey.png`}
          alt=""
        />
        <div>
          <ChunkyLogo compact />
          <h1>100 Lessons</h1>
          <p>I'm on a journey to the reading well.</p>
        </div>
        <Mascot mood="reading" />
      </div>
      <div className="reader-choice-grid" aria-label="Choose a lesson action">
        <button type="button" className="reader-choice story-choice" onClick={handleStart}>
          <span className="choice-sticker" aria-hidden="true">Book</span>
          <strong>Continue Lesson {nextLesson}</strong>
          <small>Reading path</small>
        </button>
        <button type="button" className="reader-choice word-choice" onClick={handleRestart}>
          <span className="choice-sticker" aria-hidden="true">Start</span>
          <strong>Start from {lessons[0]?.lessonNumber || 50}</strong>
          <small>First Lesson</small>
        </button>
        <button type="button" className="reader-choice choose-lesson-choice" onClick={() => setChooserOpen((open) => !open)}>
          <span className="choice-sticker" aria-hidden="true">Map</span>
          <strong>Choose Lesson</strong>
          <small>{lessons.length} lessons ready</small>
        </button>
      </div>
      {chooserOpen && (
        <div className="hundred-lesson-chooser">
          <label htmlFor="hundred-lesson-select">Pick a lesson</label>
          <select
            id="hundred-lesson-select"
            defaultValue=""
            onChange={(event) => handleChooseLesson(event.currentTarget.value)}
          >
            <option value="" disabled>Choose one</option>
            {lessons.map((lesson) => (
              <option key={lesson.id} value={lesson.id}>
                Lesson {lesson.lessonNumber}
              </option>
            ))}
          </select>
        </div>
      )}
    </section>
  );
}

export { InteractiveHundredLessonScreen as HundredLessonScreen } from './InteractiveHundredLesson';
