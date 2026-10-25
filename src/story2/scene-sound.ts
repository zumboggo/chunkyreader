export const SOUND_LABELS:Record<string,string>={swish:'Sword swishes',straw:'Sword strikes straw',thud:'A soft impact',clang:'Blades meet',step:'Footsteps',chime:'A bright chime'};
export type SoundSettings={ambience:boolean;effects:boolean;ambienceVolume:number;effectsVolume:number};
/** Original procedural textures; no downloads, microphones, speech synthesis or autoplay. */
export class SceneSound {
 private context:AudioContext|null=null;
 private ambientGain:GainNode|null=null;
 private effectsGain:GainNode|null=null;
 private ambient:AudioBufferSourceNode|null=null;
 private sources=new Set<AudioScheduledSourceNode>();
 private preset='none';private ducked=false;private hidden=false;private disposed=false;
 private settings:SoundSettings={ambience:false,effects:false,ambienceVolume:.3,effectsVolume:.45};
 private factory:()=>AudioContext;
 constructor(factory=()=>new AudioContext()){this.factory=factory;}
 async activate(){
  if(this.disposed)return;
  if(!this.context){this.context=this.factory();this.ambientGain=this.context.createGain();this.effectsGain=this.context.createGain();this.ambientGain.gain.value=0;this.effectsGain.gain.value=0;this.ambientGain.connect(this.context.destination);this.effectsGain.connect(this.context.destination);}
  await this.context.resume();if(this.disposed)return;this.gains();this.startAmbient();
 }
 configure(settings:SoundSettings,preset:string,ducked:boolean,hidden=false){
  const changed=this.preset!==preset;this.settings=settings;this.preset=preset;this.ducked=ducked;this.hidden=hidden;
  if(changed||!settings.ambience||hidden)this.stopAmbient();
  if(!settings.effects||hidden)this.stopEffects();this.gains();this.startAmbient();
 }
 private gains(){
  if(!this.context)return;const t=this.context.currentTime,duck=this.ducked?.22:1;
  const level=(gain:GainNode|null,value:number)=>{gain?.gain.cancelScheduledValues(t);gain?.gain.setTargetAtTime(value,t,.06);};
  level(this.ambientGain,this.settings.ambience&&!this.hidden?Math.min(1,Math.max(0,this.settings.ambienceVolume))*.12*duck:0);
  level(this.effectsGain,this.settings.effects&&!this.hidden?Math.min(1,Math.max(0,this.settings.effectsVolume))*.4*duck:0);
 }
 private noise(seconds:number){
  const c=this.context!,buffer=c.createBuffer(1,Math.ceil(c.sampleRate*seconds),c.sampleRate),data=buffer.getChannelData(0);let seed=81231;
  for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=(seed/4294967296*2-1);}
  return buffer;
 }
 private startAmbient(){
  const c=this.context;if(!c||c.state!=='running'||this.ambient||!this.settings.ambience||this.hidden||this.preset==='none')return;
  if(!['hall','wind','rain'].includes(this.preset))return;
  const source=c.createBufferSource(),filter=c.createBiquadFilter();source.buffer=this.noise(4);source.loop=true;
  filter.type=this.preset==='rain'?'highpass':'lowpass';filter.frequency.value=this.preset==='rain'?1600:this.preset==='hall'?140:550;
  source.connect(filter);filter.connect(this.ambientGain!);source.onended=()=>{source.disconnect();filter.disconnect();};source.start();this.ambient=source;
 }
 private stopAmbient(){if(this.ambient){try{this.ambient.stop();}catch{/* Already stopped. */}this.ambient=null;}}
 play(cue:string){
  const c=this.context;if(!c||c.state!=='running'||!this.settings.effects||this.hidden||!SOUND_LABELS[cue]||this.disposed)return;
  const t=c.currentTime,duration=cue==='chime'?.65:cue==='swish'?.22:.3;
  const envelope=c.createGain();envelope.connect(this.effectsGain!);
  envelope.gain.setValueAtTime(0,t);envelope.gain.linearRampToValueAtTime(cue==='clang'?.35:.65,t+.012);envelope.gain.exponentialRampToValueAtTime(.001,t+duration);
  const nodes:AudioNode[]=[envelope];
  // A single quiet reflection supplies hall space without a persistent feedback loop.
  if(this.preset==='hall'){const echo=c.createDelay(.2),echoLevel=c.createGain();echo.delayTime.value=.09;echoLevel.gain.value=.12;envelope.connect(echo);echo.connect(echoLevel);echoLevel.connect(this.effectsGain!);nodes.push(echo,echoLevel);}
  const add=(source:AudioScheduledSourceNode)=>{this.sources.add(source);source.onended=()=>{this.sources.delete(source);source.disconnect();if(!active.some(s=>this.sources.has(s)))nodes.forEach(n=>n.disconnect());};active.push(source);};
  const active:AudioScheduledSourceNode[]=[];
  if(cue==='chime'||cue==='clang'){
   for(const frequency of cue==='chime'?[660,990]:[920,1430,2050]){const tone=c.createOscillator();tone.type='sine';tone.frequency.value=frequency;tone.connect(envelope);add(tone);tone.start(t);tone.stop(t+duration);}
  }else{
   const source=c.createBufferSource(),filter=c.createBiquadFilter();source.buffer=this.noise(duration);filter.type='bandpass';filter.Q.value=.7;
   filter.frequency.setValueAtTime(cue==='swish'?2300:cue==='straw'?550:cue==='step'?180:100,t);
   filter.frequency.exponentialRampToValueAtTime(cue==='swish'?500:90,t+duration);nodes.push(filter);source.connect(filter);filter.connect(envelope);add(source);source.start(t);source.stop(t+duration);
  }
 }
 stopEffects(){for(const source of this.sources){try{source.stop();}catch{/* Already stopped. */}}this.sources.clear();}
 dispose(){this.disposed=true;this.stopEffects();this.stopAmbient();void this.context?.close().catch(()=>{});this.context=null;}
}
export function emitSound(root:HTMLElement,cue:string){root.dispatchEvent(new CustomEvent('story-sound',{detail:cue,bubbles:true}));}
