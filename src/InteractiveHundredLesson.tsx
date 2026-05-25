import { useState, useEffect } from 'react';
import { playAudioUrl } from './audioClipPack';
import type { HundredLesson, HundredLessonChunk } from './types';

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

// 1. Sound Discovery Node: trace path to wake up sound
function SoundDiscoveryNode({ items, audioPaths, onComplete }: { items: string[], audioPaths?: string[], onComplete: () => void }) {
  const [discovered, setDiscovered] = useState<boolean[]>(new Array(items.length).fill(false));
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleDiscover = (index: number) => {
    if (index === currentIndex) {
      if (audioPaths && audioPaths[index]) {
        playAudioUrl(`${import.meta.env.BASE_URL}100-lessons/${audioPaths[index]}`);
      }
      
      const newDiscovered = [...discovered];
      newDiscovered[index] = true;
      setDiscovered(newDiscovered);
      
      if (index < items.length - 1) {
        setCurrentIndex(index + 1);
      } else {
        setTimeout(onComplete, 1000);
      }
    }
  };

  return (
    <div className="distar-activity sound-discovery">
      <h2>Trace the arrow to wake up the sound!</h2>
      <div className="discovery-nodes">
        {items.map((item, index) => (
          <div 
            key={index} 
            className={`node-container ${discovered[index] ? 'discovered' : ''} ${index === currentIndex ? 'active' : ''}`}
            onClick={() => handleDiscover(index)}
          >
            <div className="tracing-arrow" />
            <div className="sound-node">{item}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 2. Blending Bridge: slide across balls to blend
function BlendingBridge({ items, audioPaths, onComplete }: { items: string[], audioPaths?: string[], onComplete: () => void }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handlePlayWord = (index: number) => {
    if (audioPaths && audioPaths[index]) {
      playAudioUrl(`${import.meta.env.BASE_URL}100-lessons/${audioPaths[index]}`);
    }
    if (index === currentIndex) {
      if (index < items.length - 1) {
        setCurrentIndex(index + 1);
      } else {
        setTimeout(onComplete, 1500);
      }
    }
  };

  return (
    <div className="distar-activity blending-bridge">
      <h2>Slide across to read the word!</h2>
      <div className="bridge-words">
        {items.map((word, index) => (
          <div 
            key={index} 
            className={`bridge-word-container ${index <= currentIndex ? 'active' : ''}`}
            onClick={() => handlePlayWord(index)}
          >
             <div className="blending-arrow" />
             <div className="bridge-word">{word}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 3. Rhyme Puzzle: pattern matching
function RhymePuzzle({ items, onComplete }: { items: string[], onComplete: () => void }) {
  const [solved, setSolved] = useState(false);

  const handleSolve = () => {
    setSolved(true);
    setTimeout(onComplete, 1500);
  };

  return (
    <div className="distar-activity rhyme-puzzle">
      <h2>Match the rhymes!</h2>
      <div className="rhyme-container" onClick={handleSolve}>
        {items.map((word, index) => (
          <div key={index} className={`rhyme-piece ${solved ? 'solved' : ''}`}>
            {word}
          </div>
        ))}
        {!solved && <div className="rhyme-hint">Tap to solve puzzle</div>}
      </div>
    </div>
  );
}

// 4. Story Gauntlet: 3 passes through the text
function StoryGauntlet({ items, audioPaths, imagePath, onComplete }: { items: string[], audioPaths?: string[], wordAudioPaths?: string[][], imagePath?: string, onComplete: () => void }) {
  const [pass, setPass] = useState<1 | 2 | 3>(1);
  const [currentSentence, setCurrentSentence] = useState(0);
  
  const handleNextSentence = () => {
    if (audioPaths && audioPaths[currentSentence]) {
        playAudioUrl(`${import.meta.env.BASE_URL}100-lessons/${audioPaths[currentSentence]}`);
    }
    
    if (currentSentence < items.length - 1) {
      setCurrentSentence(prev => prev + 1);
    } else {
      if (pass < 3) {
        setPass((prev) => (prev + 1) as 1 | 2 | 3);
        setCurrentSentence(0);
      } else {
        setTimeout(onComplete, 2000);
      }
    }
  };

  return (
    <div className="distar-activity story-gauntlet">
      {imagePath && (
        <div className="story-image-container">
          <img src={`${import.meta.env.BASE_URL}${imagePath}`} alt="Story illustration" className="story-image" />
        </div>
      )}
      <div className="story-text-container" onClick={handleNextSentence}>
         <div className={`pass-indicator pass-${pass}`}>
            Pass {pass}: {pass === 1 ? 'Touch each word' : pass === 2 ? 'Read faster' : 'Swipe full sentence'}
         </div>
         <div className={`story-sentence pass-${pass}-style`}>
           {items[currentSentence]}
         </div>
         <div className="story-hint">Tap to continue reading</div>
      </div>
    </div>
  );
}

export function InteractiveHundredLessonScreen({
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

  const renderChunk = (chunk: HundredLessonChunk) => {
    switch (chunk.type) {
      case 'sound-discovery':
      case 'sounds-words': // Fallback for old data
        return <SoundDiscoveryNode items={chunk.items} audioPaths={chunk.audioPaths} onComplete={handleNext} />;
      case 'blending-bridge':
        return <BlendingBridge items={chunk.items} audioPaths={chunk.audioPaths} onComplete={handleNext} />;
      case 'rhyme-puzzle':
        return <RhymePuzzle items={chunk.items} onComplete={handleNext} />;
      case 'story-gauntlet':
      case 'story': // Fallback for old data
        return <StoryGauntlet 
                 items={chunk.items} 
                 audioPaths={chunk.audioPaths} 
                 wordAudioPaths={chunk.wordAudioPaths} 
                 imagePath={chunk.imagePath} 
                 onComplete={handleNext} 
               />;
      default:
        return <div>Unknown activity type</div>;
    }
  };

  return (
    <section className="learning-screen distar-path">
      <div className="story-reader-top" style={{ padding: '1rem', background: 'white' }}>
        <div>
          <span>100 Lessons</span>
          <strong>Lesson {lesson.lessonNumber}</strong>
        </div>
        <div className="progress-bar">
           <div className="progress-fill" style={{ width: `${((chunkIndex + 1) / lesson.chunks.length) * 100}%` }} />
        </div>
      </div>
      
      <div className="distar-canvas">
        {renderChunk(chunk)}
      </div>
    </section>
  );
}
