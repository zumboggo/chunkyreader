import { useEffect, useRef, useState } from 'react'
import { stopAudioPlayback } from './audioClipPack'
import { playSfx } from './audioEffects'
import { assetUrl } from './mediaAssets'
import { progressStorage } from './progressStorage'
import { applyReadingResult, buildReadingTile, readingSteps,
  type GuidedReadingPlan, type ReadingStep } from './guidedWords'
import { guidedStateKey, guidedPlanKey, loadGuidedReadingState } from './guidedWordsStorage'
import './guidedWords.css'

export function GuidedWordsLesson({ deckId, lessonNumber, plan, activityIndex, onActivityChange,
  onComplete, onNext, onDone, playWord }: {
  deckId: string; lessonNumber: number; plan: GuidedReadingPlan; activityIndex: number
  onActivityChange: (index: number) => void
  onComplete: () => void; onNext: () => void; onDone: () => void
  playWord: (word: string) => void
}) {
  const steps = readingSteps(plan)
  const index = Math.min(Math.max(0, activityIndex), steps.length - 1)
  const session = `${deckId}:${lessonNumber}`
  const [results, setResults] = useState<Record<string, boolean>>({})
  const [finished, setFinished] = useState(false)
  const [sentenceIndependent, setSentenceIndependent] = useState(false)
  const [saveWarning, setSaveWarning] = useState(false)
  const completed = useRef(false)

  useEffect(() => {
    try { progressStorage.setItem(guidedPlanKey(deckId, lessonNumber), JSON.stringify(plan)) }
    catch { setSaveWarning(true) }
    return () => stopAudioPlayback()
  }, [deckId, lessonNumber, plan])

  function advance(independent?: boolean) {
    const step = steps[index]
    if ('word' in step && step.kind === 'read') {
      setResults(old => ({ ...old, [step.word.text]: independent === true }))
    }
    stopAudioPlayback()
    onActivityChange(index + 1)
  }
  function finish(independent: boolean) {
    if (completed.current) return
    completed.current = true
    const state = loadGuidedReadingState(deckId)
    const alreadyCompleted = state.completedSessions.includes(session)
    try {
      progressStorage.setItem(guidedStateKey(deckId), JSON.stringify(applyReadingResult(state, plan, session, results, independent)))
    } catch { setSaveWarning(true) }
    stopAudioPlayback()
    setSentenceIndependent(independent)
    setFinished(true)
    if (!alreadyCompleted) {
      playSfx('fireworks')
      onComplete()
    }
  }

  return <section className="focus-lesson older-reader-lesson guided-reading">
    <div className="focus-main">
      <div className="read-together-card guided-card">
        <span className="stage-label">Words · {finished ? 'Lesson complete' : `${index + 1} of ${steps.length}`} · about 3–4 minutes</span>
        {finished ? <>
          <img className="guided-mascot" src={assetUrl('assets/mascots/mascot-reading.png')} alt="Reading panda" />
          <h2>{sentenceIndependent ? 'You read a sentence!' : 'You practised real reading!'}</h2>
          <p>{sentenceIndependent ? 'You put the words together all by yourself.' : 'Reading together counts. We can try these words again.'}</p>
          <p>Talk together: what did your sentence tell you?</p>
          <p className="guided-parent-note">Parent: {Object.values(results).filter(Boolean).length} of 4 words read independently.
            {' '}Sentence: {sentenceIndependent ? 'independent' : 'with help'}. Both outcomes earn the lesson reward.</p>
          {saveWarning && <p role="status">Progress could not be saved on this device. You can still enjoy the lesson.</p>}
          <div className="focus-actions">
            <button className="primary choice-action" onClick={onDone}>Done for now</button>
            <button className="choice-action" onClick={onNext}>Another little lesson</button>
          </div>
        </> : <ReadingActivity key={index} step={steps[index]} index={index} plan={plan}
          onAdvance={advance} onFinish={finish} playWord={playWord} />}
      </div>
    </div>
  </section>
}

function ReadingActivity({ step, index, plan, onAdvance, onFinish, playWord }: {
  step: ReadingStep; index: number; plan: GuidedReadingPlan
  onAdvance: (independent?: boolean) => void; onFinish: (independent: boolean) => void
  playWord: (word: string) => void
}) {
  const [helped, setHelped] = useState(false)
  const [built, setBuilt] = useState(false)
  const [retry, setRetry] = useState(false)
  const [parentCheck, setParentCheck] = useState(false)
  const played = useRef(false)
  const word = 'word' in step ? step.word : undefined
  useEffect(() => {
    // No answer audio on independent word checks or the sentence finale.
    if (step.kind === 'welcome' && !played.current) {
      played.current = true
      playWord('is')
      return
    }
    if ((step.kind !== 'teach' && step.kind !== 'build') || !word || played.current) return
    played.current = true
    playWord(word.text)
  }, [step.kind, word, playWord])

  function hear() {
    setHelped(true)
    if (word) playWord(word.text)
    else playWord(plan.sentence)
  }
  if (step.kind === 'welcome') return <>
    <h2>{plan.title}</h2>
    <p>{plan.cue}</p>
    <p className="guided-parent-note">Parent: model the sounds without adding “uh”, then let her blend them.
      {' '}A blend keeps both sounds; a spelling such as sh represents one sound. This starts beyond simple three-letter words.</p>
    <p>Our little helper word: <strong>is</strong>. Read it together before you start.</p>
    <div className="focus-actions">
      <button className="choice-action" onClick={() => playWord('is')}>Hear “is”</button>
      <button className="primary choice-action" onClick={() => onAdvance()}>Let’s read</button>
    </div>
  </>
  if (step.kind === 'sentence') return <>
    <span className="guided-theme" aria-hidden="true">🌷</span>
    <h3>Your tiny sentence</h3>
    <h2 className="guided-sentence">{plan.sentence}</h2>
    <p>Read it out loud. Take your time.</p>
    {!parentCheck ? <>
      <div className="focus-actions">
        <button className="choice-action" onClick={hear}>Help me hear it</button>
        <button className="primary choice-action" onClick={() => setParentCheck(true)}>Ready for parent check</button>
      </div>
      <p className="guided-parent-note">Parent: let her try before using audio. Sounding it out and correcting herself count as independent reading.</p>
    </> : <>
      <p className="guided-parent-note">Parent check: did she read the whole sentence without someone supplying a word?</p>
      <div className="focus-actions">
        <button className="primary choice-action" disabled={helped} onClick={() => onFinish(true)}>Read independently</button>
        <button className="choice-action" onClick={() => onFinish(false)}>Read with help</button>
      </div>
      {helped && <p>We listened together this time. Choose “Read with help”.</p>}
    </>}
  </>
  if (!word) return null
  if (step.kind === 'read') return <>
    <h3>Your turn to read</h3>
    <h2 className="guided-word">{word.text}</h2>
    <p>Read the whole word out loud.</p>
    {!parentCheck ? <div className="focus-actions">
      <button className="choice-action" onClick={hear}>Help me</button>
      <button className="primary choice-action" onClick={() => setParentCheck(true)}>Parent check</button>
    </div> : <>
      <p className="guided-parent-note">Parent: sounding out is welcome. Did she do it without an answer or sound supplied?</p>
      <div className="focus-actions">
        <button className="primary choice-action" disabled={helped} onClick={() => onAdvance(true)}>Read independently</button>
        <button className="choice-action" onClick={() => onAdvance(false)}>Read with help</button>
      </div>
    </>}
    {helped && <p>Read it together: {word.parts.join(' · ')}</p>}
  </>
  if (step.kind === 'build') {
    const tile = buildReadingTile(word, index)
    return <>
      <h3>Build the word</h3>
      <p>Listen, say the sounds, then choose the missing part.</p>
      <button className="choice-action" onClick={() => playWord(word.text)}>Hear the word</button>
      <h2 className="guided-word" aria-label="Word with a missing part">{word.parts.map((part, i) => i === tile.position && !built ? ' __ ' : part).join('')}</h2>
      {!built ? <div className="focus-actions">{tile.choices.map(choice => <button className="choice-action guided-tile" key={choice}
        onClick={() => {
          if (choice === tile.correct) { setBuilt(true); playSfx('correct'); playWord(word.text) }
          else { setRetry(true); playWord(word.text) }
        }}>{choice}</button>)}</div> : <>
        <p>You checked the whole word!</p>
        <button className="primary choice-action" onClick={() => onAdvance()}>Keep reading</button>
      </>}
      {retry && !built && <p role="status">Listen and try together. The missing part is “{tile.correct}”.</p>}
    </>
  }
  return <>
    <h3>{step.kind === 'teach' ? 'Meet a word' : 'Blend it together'}</h3>
    <h2 className="guided-word">{word.text}</h2>
    <div className="guided-parts" aria-label="Reading parts">{word.parts.map((part, i) => <span key={i}>{part}</span>)}</div>
    <p>{step.kind === 'teach' ? 'Listen, look, then say it together.' : 'Point to each part. Blend the whole word out loud.'}</p>
    <div className="focus-actions">
      <button className="choice-action" onClick={() => playWord(word.text)}>Hear the word</button>
      <button className="primary choice-action" onClick={() => onAdvance()}>{step.kind === 'teach' ? 'We said it' : 'We blended it'}</button>
    </div>
  </>
}
