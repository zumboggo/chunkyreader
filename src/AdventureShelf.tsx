import {ADVENTURES} from './adventures'
import {assetUrl} from './mediaAssets'
import {progressStorage} from './progressStorage'
import './adventures.css'
function hasAdventureProgress(id:string){try{return !!JSON.parse(progressStorage.getItem(`chunky-reader:story:${id}:adventure`)||'null')?.steps?.length}catch{return false}}
export function AdventureShelf({onOpen}:{onOpen:(id:string)=>void}) {
 return <section className="adventure-shelf" aria-label="Read and choose adventures"><div className="adventure-heading"><span className="prompt-topline">Anna & Sarah’s adventures</span><h2>What happens next?</h2><p>Little words. Big giggles. You choose!</p></div><div className="adventure-covers">{ADVENTURES.map(a=><button className="adventure-cover" key={a.id} onClick={()=>onOpen(a.id)}><img src={assetUrl(`stories/adventures/v1/${a.cover}.svg`)} alt=""/><span><small>Read & choose · 3 choices · under 4 min</small><strong>{a.title}</strong><span>{a.description}</span><b>{hasAdventureProgress(a.id)?'Play or continue':'Let’s play'} →</b></span></button>)}</div></section>
}
