import { useCallback, useEffect, useRef, useState } from 'react'
import { stopAudioPlayback } from './audioClipPack'
import { playSfx } from './audioEffects'
import { assetUrl } from './mediaAssets'
import { progressStorage } from './progressStorage'
import { recordLocalProgressChange } from './cloudProgressSync'
import { applyReadingResult, buildReadingTile, readingSteps, READING_POCKETS, READING_HELPERS,
  type GuidedReadingPlan, type ReadingStep } from './guidedWords'
import { guidedStateKey, guidedPlanKey, guidedSelectedLessonKey, loadGuidedReadingState } from './guidedWordsStorage'
import { playGuidedSounds, prepareGuidedSounds, stopGuidedSounds } from './guidedWordAudio'
import './guidedWords.css'

type PlayWord = (text: string) => Promise<boolean>
export function GuidedWordsLesson({ deckId, lessonNumber, plan, activityIndex, onActivityChange,
  onComplete, onNext, playWord }: {
  deckId: string; lessonNumber: number; plan: GuidedReadingPlan; activityIndex: number
  onActivityChange: (index: number) => void; onComplete: () => void; onNext: () => void; playWord: PlayWord
}) {
  const steps = readingSteps(plan)
  const [index, setIndex] = useState(() => Math.min(plan.progress?.index ?? activityIndex, steps.length - 1))
  const [results, setResults] = useState<Record<string, boolean>>(plan.progress?.results ?? {})
  const [helped, setHelped] = useState(plan.progress?.helped ?? false)
  const [finished, setFinished] = useState(false)
  const [sentenceIndependent, setSentenceIndependent] = useState(false)
  const [saveWarning, setSaveWarning] = useState(false)
  const completed = useRef(false)
  const session = `${deckId}:${lessonNumber}`
  const save = useCallback((nextIndex: number, nextResults: Record<string, boolean>, nextHelped: boolean) => {
    try { progressStorage.setItem(guidedSelectedLessonKey(deckId), String(lessonNumber)); progressStorage.setItem(guidedPlanKey(deckId, lessonNumber), JSON.stringify({ ...plan,
      savedAt: Date.now(), progress: { index: nextIndex, results: nextResults, helped: nextHelped } })); recordLocalProgressChange() }
    catch { setSaveWarning(true) }
  }, [deckId, lessonNumber, plan])
  useEffect(() => {
    save(index, results, helped)
  }, [save, index, results, helped])
  function advance(independent?: boolean) {
    const step = steps[index]
    const nextResults = step.kind === 'read' ? { ...results, [step.word.text]: independent === true && !helped } : results
    // Save synchronously before the next screen (and before a possible reload).
    save(index + 1, nextResults, false)
    setResults(nextResults); setHelped(false); setIndex(index + 1)
    stopAudioPlayback(); stopGuidedSounds(); onActivityChange(index + 1)
  }
  function markHelped() { save(index, results, true); setHelped(true) }
  function finish(independent: boolean) {
    if (completed.current) return
    completed.current = true
    const state = loadGuidedReadingState(deckId)
    const alreadyCompleted = state.completedSessions.includes(session)
    const unassisted = independent && !helped
    try { progressStorage.setItem(guidedStateKey(deckId), JSON.stringify(applyReadingResult(state, plan, session, results, unassisted))); recordLocalProgressChange() }
    catch { setSaveWarning(true) }
    stopAudioPlayback(); stopGuidedSounds(); setSentenceIndependent(unassisted); setFinished(true)
    playSfx('fireworks')
    if (!alreadyCompleted) onComplete()
  }
  return <section className="focus-lesson older-reader-lesson guided-reading">
    <div className="focus-main"><div className="read-together-card guided-card">
      <span className="stage-label">Words · {finished ? 'Lesson complete' : `${index + 1} of ${steps.length}`} · about 3–4 minutes</span>
      {finished ? <>
        <img className="guided-mascot" src={assetUrl('assets/mascots/mascot-reading.png')} alt="Reading panda" />
        <h2>{sentenceIndependent ? 'You read a sentence!' : 'You practised real reading!'}</h2>
        <p>{sentenceIndependent ? 'You put the words together all by yourself.' : 'Reading together counts. We can try these words again.'}</p>
        <p className="guided-parent-note">She marked {plan.words.slice(0, 4).filter(w => results[w.text]).length} of 4 target words “I knew it” (self-reported).
          {' '}Sentence read aloud, confirmed by a parent: {sentenceIndependent ? 'independent' : 'with help'}. This records practice, not mastery.
          {' '}Both outcomes earn the first-completion reward; replays add practice.</p>
        <div className="focus-actions"><button className="primary choice-action" onClick={onNext}>
          {lessonNumber < READING_POCKETS.length ? `Next lesson: ${lessonNumber + 1}` : 'All lessons finished! Practise lesson 1'}
        </button></div>
      </> : <ReadingActivity key={index} step={steps[index]} index={index} plan={plan} initialHelped={helped}
        onHelp={markHelped} onAdvance={advance} onFinish={finish} playWord={playWord} />}
      {saveWarning && <p role="status">Progress could not be saved on this device. You can still enjoy the lesson.</p>}
    </div></div>
  </section>
}

function ReadingActivity({ step, index, plan, initialHelped, onHelp, onAdvance, onFinish, playWord }: {
  step: ReadingStep; index: number; plan: GuidedReadingPlan; initialHelped: boolean; onHelp: () => void
  onAdvance: (independent?: boolean) => void; onFinish: (independent: boolean) => void; playWord: PlayWord
}) {
  const [helped, setHelped] = useState(initialHelped)
  const [position, setPosition] = useState(0)
  const [retry, setRetry] = useState(false)
  const [parentCheck, setParentCheck] = useState(false)
  const [activeSound, setActiveSound] = useState<number | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const sequence = useRef(0)
  const playRequest = useRef(0)
  const word = 'word' in step ? step.word : undefined
  const play = useCallback(async (text: string) => {
    const request = sequence.current
    const audioRequest = ++playRequest.current
    const ok = await playWord(text)
    if (!ok && request === sequence.current && audioRequest === playRequest.current) setUnavailable(true)
    return ok
  }, [playWord])
  const model = useCallback(async () => {
    if (!word) return
    const request = ++sequence.current
    setUnavailable(false); stopGuidedSounds(); stopAudioPlayback()
    if (!await play(`model:${word.text}`) || request !== sequence.current) return
    const status = await playGuidedSounds(word.text, setActiveSound)
    if (request !== sequence.current) return
    if (status === 'unavailable') setUnavailable(true)
    if (status === 'played') await play(word.text)
  }, [word, play])
  useEffect(() => {
    const playback = sequence
    if (step.kind === 'teach') void model()
    if (step.kind === 'welcome') void play(`helpers:${plan.support.join(',')}`)
    if (step.kind === 'build' && word) {
      const request = playback.current
      void play(word.text).then(ok => {
        if (ok && request === playback.current) void playGuidedSounds(word.text, setActiveSound, 0).then(s => setUnavailable(s === 'unavailable'))
      })
    }
    return () => { playback.current++; stopGuidedSounds(); stopAudioPlayback() }
  }, [step.kind, word, model, play, plan.support])
  function hear() {
    setHelped(true); onHelp(); setUnavailable(false)
    void play(word?.text ?? plan.sentence)
  }
  const audioNotice = unavailable ? <p role="status">Audio is unavailable. Reconnect and tap Hear again to retry.</p> : null
  if (step.kind === 'welcome') return <>
    <h2>{plan.title}</h2><p>{plan.cue}</p>
    <p>Think or whisper each word. Tap “I knew it” or “Help me”. Ask your parent for the last sentence.</p>
    <div className="guided-parent-note">{plan.support.map(helper => <p key={helper}><strong>{helper}</strong> — {READING_HELPERS[helper].note}</p>)}</div>
    {audioNotice}
    <div className="focus-actions">
      <button className="choice-action" onClick={() => { setUnavailable(false); void play(`helpers:${plan.support.join(',')}`) }}>Hear again</button>
      <button className="primary choice-action" onClick={() => { prepareGuidedSounds(plan.words); onAdvance() }}>Let’s read</button>
    </div>
  </>
  if (step.kind === 'sentence') return <>
    <span className="guided-theme" aria-hidden="true">🌷</span><h3>Your tiny sentence</h3>
    <h2 className="guided-sentence">{plan.sentence}</h2><p>Read it out loud. Take your time.</p>
    {!parentCheck ? <>
      <div className="focus-actions"><button className="choice-action" onClick={hear}>Help me hear it</button>
        <button className="primary choice-action" onClick={() => setParentCheck(true)}>Ready for parent check</button></div>
      <p className="guided-parent-note">Parent: let her try before using audio. Sounding out and self-correction count as independent. Any supplied word or audio counts as help.</p>
    </> : <>
      <div className="guided-parent-note"><p>Parent: after listening, ask “{plan.meaningPrompt.question}”</p>
        <p>Suggested answer: {plan.meaningPrompt.answer} Accept her own words; talk it through together. There is no comprehension score.</p>
        <p>How did she read the sentence aloud?</p></div>
      <div className="focus-actions"><button className="primary choice-action" disabled={helped} onClick={() => onFinish(true)}>Read independently</button>
        <button className="choice-action" onClick={() => onFinish(false)}>Read with help</button></div>
      {helped && <p>We listened together this time. Choose “Read with help”.</p>}
    </>}{audioNotice}
  </>
  if (!word) return null
  if (step.kind === 'read') return <>
    <h3>{word.text === plan.reviewWord ? 'A word from before' : 'Your turn to read'}</h3>
    <h2 className="guided-word">{word.text}</h2><p>Think the word, whisper it, or say it softly.</p>
    <div className="focus-actions">{!helped ? <>
      <button className="primary choice-action" onClick={() => onAdvance(true)}>I knew it</button>
      <button className="choice-action" onClick={hear}>Help me</button>
    </> : <><button className="choice-action" onClick={hear}>Hear again</button>
      <button className="primary choice-action" onClick={() => onAdvance(false)}>Keep practising</button></>}</div>
    {helped && <p>Good choice asking for help. This word will come back for practice.</p>}{audioNotice}
  </>
  if (step.kind === 'build') {
    const built = position === word.sounds.length
    const tile = built ? null : buildReadingTile(word, position, index)
    const filled = new Set(word.sounds.slice(0, position).flatMap(u => u.positions))
    return <>
      <h3>Build the word, sound by sound</h3><p>Listen to the word. Choose the spelling for each sound.</p>
      <h2 className="guided-word" aria-label="Your spelling">{[...word.text].map((letter, i) => filled.has(i) ? letter : '＿').join('')}</h2>
      {unavailable ? <><p>Reconnect to hear the word and sound.</p><button className="choice-action" onClick={() => { setUnavailable(false); void play(word.text).then(ok => { if (ok && !built) void playGuidedSounds(word.text, setActiveSound, position).then(s => setUnavailable(s === 'unavailable')) }) }}>Hear again</button></> : built ? <><p>You built {word.text}! This was supported spelling practice.</p>
        <button className="primary choice-action" onClick={() => onAdvance()}>Keep reading</button></> : retry ? <>
        <p role="status">This sound is spelled <strong>{tile!.correct}</strong>. Listen, then try that sound again.</p>
        <button className="primary choice-action" onClick={() => { setRetry(false); void playGuidedSounds(word.text, setActiveSound, position).then(s => setUnavailable(s === 'unavailable')) }}>Try again</button>
      </> : <>
        <p>Sound {position + 1} of {word.sounds.length}{tile!.unit.positions.length > 1 && tile!.correct.includes('_') ? ' — put these letters around the middle sound.' : ''}</p>
        <div className="focus-actions">{tile!.choices.map(choice => <button className="choice-action guided-tile" key={choice} onClick={() => {
          if (choice !== tile!.correct) { setRetry(true); void playGuidedSounds(word.text, setActiveSound, position).then(s => setUnavailable(s === 'unavailable')); return }
          setPosition(position + 1); playSfx('correct')
          if (position + 1 === word.sounds.length) void play(word.text)
          else void playGuidedSounds(word.text, setActiveSound, position + 1).then(s => setUnavailable(s === 'unavailable'))
        }}>{choice}</button>)}</div>
      </>}{audioNotice}
    </>
  }
  const activePositions = activeSound === null ? [] : word.sounds[activeSound].positions
  return <>
    <h3>Meet and blend a word</h3>
    <h2 className="guided-word guided-letter-map">{[...word.text].map((letter, i) => <span key={i} className={activePositions.includes(i) ? 'sound-active' : ''}>{letter}</span>)}</h2>
    <p>{word.meaning}</p><p>Hear the sounds join together. Think or whisper the whole word.</p>
    {word.parts.some(p => p.length > 2) && word.parts.length > 1 && <p className="guided-parent-note">Word parts: {word.parts.join(' · ')}. Each part can contain several sounds.</p>}
    {audioNotice}<div className="focus-actions"><button className="choice-action" onClick={() => void model()}>Hear again</button>
      <button className="primary choice-action" onClick={() => onAdvance()}>Got it</button></div>
  </>
}
