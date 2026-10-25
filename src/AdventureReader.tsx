import {useEffect, useMemo, useRef, useState} from 'react'
import {compileStory, replayStory, advanceStory, type StoryPackage} from './story2/engine/story-engine.js'
import StoryStage from './story2/StoryStage'
import {playSceneMotion} from './story2/scene-motion'
import {assetUrl} from './mediaAssets'
import {progressStorage} from './progressStorage'
import {recordLocalProgressChange} from './cloudProgressSync'
import {playAudioUrl, stopAudioPlayback} from './audioClipPack'
import './story2/story-player.css'
import './adventures.css'


type Adventure = StoryPackage & {id:string;version:number;focusWords:string[];audio:Record<string,string>}
type Save = {steps:(string|null)[];mode:'read'|'listen';phase:'words'|'story';word:number}
const saveKey=(id:string)=>`chunky-reader:story:${id}:adventure`
function loadSave(id:string):Save|undefined {
  try { const s=JSON.parse(progressStorage.getItem(saveKey(id))||'null');
    if(s && Array.isArray(s.steps) && s.steps.length<100 && s.steps.every((v:unknown)=>v===null||typeof v==='string') && ['read','listen'].includes(s.mode) && ['words','story'].includes(s.phase) && Number.isInteger(s.word) && s.word>=0 && s.word<5)return s
  } catch { /* Unavailable or stale storage starts a fresh adventure. */ }
}
export function AdventureReader({id,onBack,onComplete}:{id:string;onBack:()=>void;onComplete:()=>void}) {
 const [pack,setPack]=useState<Adventure>();const [error,setError]=useState(false)
 useEffect(()=>{const c=new AbortController();fetch(assetUrl(`stories/adventures/v1/${id}.json`),{signal:c.signal}).then(r=>{if(!r.ok)throw Error();return r.json()}).then(p=>{for(const bg of Object.values(p.assets.backgrounds) as {src:string}[])bg.src=assetUrl(bg.src);for(const c of Object.values(p.assets.characters) as {expressions:Record<string,{src:string}>}[])for(const a of Object.values(c.expressions))a.src=assetUrl(a.src);setPack(p)}).catch(()=>{if(!c.signal.aborted)setError(true)});return()=>c.abort()},[id])
 if(error)return <section className="adventure-gate"><h1>Let’s try again</h1><p>The story could not load. Please reconnect and open it again.</p><button onClick={onBack}>Back to Stories</button></section>
 if(!pack)return <section className="adventure-gate"><p>Opening your adventure…</p><button onClick={onBack}>Back to Stories</button></section>
 return <AdventurePlayer key={id} pack={pack} onBack={onBack} onComplete={onComplete}/>
}
function AdventurePlayer({pack,onBack,onComplete}:{pack:Adventure;onBack:()=>void;onComplete:()=>void}) {
 const compiled=useMemo(()=>compileStory(pack.script,pack.assets),[pack]); const story=compiled.story
 const [saved]=useState(()=>{const candidate=loadSave(pack.id);if(candidate&&story){try{replayStory(story,candidate.steps,1);return candidate}catch{/* Ignore incompatible saves. */}}return undefined});const [steps,setSteps]=useState<(string|null)[]>(saved?.steps||[])
 const [phase,setPhase]=useState<'gate'|'intro'|'words'|'story'>('gate');const [mode,setMode]=useState<'read'|'listen'>(saved?.mode||'read')
 const [word,setWord]=useState(saved?.word||0);const [audioError,setAudioError]=useState(false);const [speaking,setSpeaking]=useState(false)
 const [reduced,setReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);const [paused,setPaused]=useState(false)
 const [responses,setResponses]=useState<Record<string,string>>({});const [introError,setIntroError]=useState(false)
 const root=useRef<HTMLDivElement>(null);const advancing=useRef(false);const skipResumeMotion=useRef(!!saved?.steps.length);const video=useRef<HTMLVideoElement>(null);const heading=useRef<HTMLHeadingElement>(null);const reward=useRef(false);const audioGeneration=useRef(0);const motion=useRef<AbortController|null>(null)
 const state=useMemo(()=>story?replayStory(story,steps,1):null,[story,steps]);const current=state?story.nodes[state.cursor]:null
 const text=phase==='words'?pack.focusWords[word]:current?.type==='choice'?'What next?':current?.text||''
 const play=async(value:string)=>{const token=++audioGeneration.current;setAudioError(false);setSpeaking(true);try{const path=pack.audio?.[value];if(!path)throw Error();await playAudioUrl(assetUrl(path))}catch{if(token===audioGeneration.current)setAudioError(true)}finally{if(token===audioGeneration.current)setSpeaking(false)}}
 const stop=()=>{audioGeneration.current++;stopAudioPlayback();setSpeaking(false)}
 const save=(next:Save)=>{try{progressStorage.setItem(saveKey(pack.id),JSON.stringify(next));recordLocalProgressChange()}catch{/* Play works without storage. */}}
 useEffect(()=>{const m=matchMedia('(prefers-reduced-motion: reduce)');const update=()=>setReduced(m.matches);m.addEventListener('change',update);return()=>m.removeEventListener('change',update)},[])
 useEffect(()=>{const hidden=()=>{if(document.hidden){video.current?.pause();stopAudioPlayback();audioGeneration.current++;setSpeaking(false);motion.current?.abort()}};document.addEventListener('visibilitychange',hidden);return()=>{document.removeEventListener('visibilitychange',hidden);stopAudioPlayback();stopAudioPlayback();motion.current?.abort()}},[])
 useEffect(()=>{advancing.current=false;if(phase!=='words'&&phase!=='story')return;save({steps,mode,phase,word});heading.current?.focus();if(phase==='words'||mode==='listen'&&!state?.ended)void play(current?.type==='choice'&&phase==='story'?current.options.map((o:{text:string})=>o.text).join(' '):text);return()=>{stopAudioPlayback()}
 // Narration runs only on entering a beat, never from a render or retry.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[phase,word,steps,mode])
 useEffect(()=>{if(phase!=='story'||!state||!root.current)return;if(skipResumeMotion.current){skipResumeMotion.current=false;return}const element=root.current;const controller=new AbortController();motion.current=controller;void playSceneMotion(root.current,state.cues||[],current,reduced||paused,setResponses,controller.signal);return()=>{controller.abort();element.getAnimations({subtree:true}).forEach(a=>a.cancel())}
 // Each beat owns its cancellable finite motion.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[phase,state,reduced,paused])
 const next=(option:string|null)=>{if(!state||state.ended||advancing.current)return;advancing.current=true;stop();advanceStory(story,state,option);setSteps(s=>[...s,option])}
 const start=()=>{stop();skipResumeMotion.current=false;setIntroError(false);setSteps([]);setWord(0);reward.current=false;setPhase(reduced?'words':'intro')}
 if(compiled.errors.length||!state)return <section className="adventure-gate"><p>This adventure needs a repair.</p><button onClick={onBack}>Back to Stories</button></section>
 const back=<button className="soft-back" onClick={()=>{stop();onBack()}}>Back to Stories</button>
 if(phase==='gate')return <section className="adventure-gate">{back}<span className="prompt-topline">Anna & Sarah’s adventures</span><h1>{pack.title}</h1><p>{pack.notice}</p><fieldset><legend>How shall we play?</legend><label><input type="radio" name="mode" checked={mode==='read'} onChange={()=>setMode('read')}/> Read and choose</label><label><input type="radio" name="mode" checked={mode==='listen'} onChange={()=>setMode('listen')}/> Listen together <small>with a grown-up</small></label></fieldset><p className="adventure-note">Hear five words first. Then read at your own pace. Tap “Hear it” whenever you need help.</p><button className="primary" onClick={start}>Accept & play</button>{saved&&<button onClick={()=>{setPhase(saved.phase);setWord(saved.word);setSteps(saved.steps)}}>Accept & continue</button>}</section>
 if(phase==='intro')return <section className="adventure-gate">{back}<h1>{pack.title}</h1>{introError?<p>Let’s go straight to the story!</p>:<video ref={video} controls playsInline poster={assetUrl(`stories/adventures/v1/${pack.id}-intro.poster.jpg`)} src={assetUrl(`stories/adventures/v1/${pack.id}-intro.mp4`)} onEnded={()=>setPhase('words')} onError={()=>setIntroError(true)}/>}<button onClick={()=>{void video.current?.play().catch(()=>setIntroError(true))}}>Play teaser</button><button className="primary" onClick={()=>setPhase('words')}>Skip to words</button></section>
 if(phase==='words')return <section className="adventure-gate">{back}<span className="prompt-topline">Our five words · {word+1} of 5</span><h1 className="adventure-word" ref={heading} tabIndex={-1}>{text}</h1><button onClick={()=>void play(text)}>Hear it</button>{audioError&&<p role="status">Sound could not play. Tap Hear it to retry, or read together.</p>}<button className="primary" onClick={()=>{stop();if(word<4)setWord(w=>w+1);else setPhase('story')}}>{word<4?'Next word':'Into the story'}</button><button onClick={()=>{stop();onComplete();onBack()}}>All done</button></section>
 if(state.ended)return <section className="adventure-gate">{back}<span className="adventure-end" aria-hidden="true">🌟</span><h1>The End</h1><p>You made a story!</p><button className="primary" onClick={()=>{if(!reward.current){reward.current=true;onComplete()}onBack()}}>All done</button><button onClick={()=>{if(!reward.current){reward.current=true;onComplete()}start()}}>Play another way</button></section>
 return <section className="adventure-player" ref={root}><header>{back}<strong>{pack.title}</strong><button aria-pressed={mode==='listen'} onClick={()=>{stop();setMode(mode==='read'?'listen':'read')}}>{mode==='listen'?'Listening together':'Read myself'}</button></header><StoryStage pack={pack} state={state} current={current} speaking={speaking} reduced={reduced} responses={responses} motionPaused={paused} onMotionPause={setPaused}/><div className="adventure-dialogue"><span className="prompt-topline">{current?.actor&&current.actor!=='I'?pack.assets.characters[current.actor].name:'Anna & Sarah'}</span><h1 ref={heading} tabIndex={-1}>{text}</h1><div className="adventure-hear"><button onClick={()=>void play(current?.type==='choice'?current.options.map((o:{text:string})=>o.text).join(' '):text)}>Hear it</button>{speaking&&<button onClick={stop}>Stop sound</button>}</div>{audioError&&<p role="status">Sound could not play. Tap Hear it to retry, or read together.</p>}<div className="adventure-choices">{current?.type==='choice'?current.options.map((o:{id:string;text:string})=><button className="primary" key={o.id} onClick={()=>next(o.id)}>{o.text}</button>):<button className="primary" onClick={()=>next(null)}>Next →</button>}</div></div><footer><button disabled={!steps.length} onClick={()=>{stop();setSteps(s=>s.slice(0,-1))}}>Back a bit</button><button onClick={()=>{stop();onComplete();onBack()}}>All done</button><button onClick={()=>{stop();setPhase('gate')}}>Start again</button></footer></section>
}
