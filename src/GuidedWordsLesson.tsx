import { useCallback, useEffect, useRef, useState } from 'react'
import { stopAudioPlayback } from './audioClipPack'
import { playSfx } from './audioEffects'
import { assetUrl } from './mediaAssets'
import { progressStorage } from './progressStorage'
import { applyReadingResult, buildReadingTile, readingSteps,
  type GuidedReadingPlan, type ReadingStep } from './guidedWords'
import { guidedStateKey, guidedPlanKey, loadGuidedReadingState } from './guidedWordsStorage'
import { guidedSoundUnits, playGuidedSounds, prepareGuidedSounds, stopGuidedSounds } from './guidedWordAudio'
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
    return () => { stopAudioPlayback(); stopGuidedSounds() }
  }, [deckId, lessonNumber, plan])

  function advance(independent?: boolean) {
    const step = steps[index]
    if ('word' in step && step.kind === 'read') {
      setResults(old => ({ ...old, [step.word.text]: independent === true }))
    }
    stopAudioPlayback()
    stopGuidedSounds()
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
          <p className="guided-parent-note">She marked {Object.values(results).filter(Boolean).length} of 4 words “I knew it” (self-reported).
            {' '}Sentence read aloud, confirmed by a parent: {sentenceIndependent ? 'independent' : 'with help'}. Both outcomes earn the lesson reward.</p>
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
  const [activeSound, setActiveSound] = useState<number | null>(null)
  const [soundUnavailable, setSoundUnavailable] = useState(false)
  const [soundsPlayed, setSoundsPlayed] = useState(false)
  const played = useRef(false)
  const word = 'word' in step ? step.word : undefined
  const modelSounds = useCallback(() => {
    if (!word) return
    stopAudioPlayback()
    setSoundUnavailable(false)
    setSoundsPlayed(false)
    void playGuidedSounds(word.text, setActiveSound).then(status => {
      if (status === 'unavailable') setSoundUnavailable(true)
      if (status === 'played') setSoundsPlayed(true)
    })
  }, [word])
  useEffect(() => {
    if (step.kind === 'blend') modelSounds()
    return () => stopGuidedSounds()
  }, [step.kind, modelSounds])
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
    <p>Listen to the sounds. Think the word, or whisper it. You do not need to say each sound.</p>
    <p>Tap “I knew it” when you know a word, or “Help me” to hear it. Ask your parent only for the last sentence.</p>
    <p>Our little helper word: <strong>is</strong>.</p>
    <div className="focus-actions">
      <button className="choice-action" onClick={() => playWord('is')}>Hear “is”</button>
      <button className="primary choice-action" onClick={() => { prepareGuidedSounds(plan.words); onAdvance() }}>Let’s read</button>
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
      <p className="guided-parent-note">Parent check: did she read the whole sentence out loud? Choose how she read it. Only confirm after hearing her.</p>
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
    <p>Think the word, whisper it, or say the whole word softly.</p>
    <div className="focus-actions">
      {!helped ? <>
        <button className="primary choice-action" onClick={() => onAdvance(true)}>I knew it</button>
        <button className="choice-action" onClick={hear}>Help me</button>
      </> : <>
        <button className="choice-action" onClick={hear}>Hear again</button>
        <button className="primary choice-action" onClick={() => onAdvance(false)}>Keep practising</button>
      </>}
    </div>
    {helped && <p>Good choice asking for help. This word will come back for practice.</p>}
  </>
  if (step.kind === 'build') {
    const tile = buildReadingTile(word, index)
    return <>
      <h3>Build the word</h3>
      <p>Listen, think, then tap the missing part. No talking needed.</p>
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
      {retry && !built && <p role="status">Listen and try again. Look for “{tile.correct}”.</p>}
    </>
  }
  return <>
    <h3>{step.kind === 'teach' ? 'Meet a word' : 'Blend it together'}</h3>
    <h2 className="guided-word">{word.text}</h2>
    <div className="guided-parts" aria-label="Reading sounds">{guidedSoundUnits(word.text).map((unit, i) =>
      <span key={i} className={activeSound === i ? 'sound-active' : ''}>{unit.spelling}</span>)}</div>
    <p>{step.kind === 'teach' ? 'Listen and look. You can say just the whole word.' : 'Listen to each sound. Join them in your head, then whisper or say the whole word.'}</p>
    {step.kind === 'blend' && soundsPlayed && <p role="status">Your turn! Think or say the whole word.</p>}
    {soundUnavailable && <p role="status">Sound clips are unavailable. Reconnect and tap “Hear the sounds” to retry. We will not say letter names instead.</p>}
    <div className="focus-actions">
      <button className="choice-action" onClick={step.kind === 'blend' ? modelSounds : () => playWord(word.text)}>{step.kind === 'blend' ? 'Hear the sounds' : 'Hear the word'}</button>
      <button className="primary choice-action" onClick={() => onAdvance()}>{step.kind === 'teach' ? 'Got it' : 'I blended it'}</button>
    </div>
  </>
}
