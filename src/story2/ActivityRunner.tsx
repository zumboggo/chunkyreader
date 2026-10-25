import {useEffect,type RefObject} from 'react';
import type {StoryActivity} from './engine/story-engine.js';
import {trainContinuously} from './activity-motion';
export default function ActivityRunner({root,actor,activity,enabled,onResponse}:{root:RefObject<HTMLDivElement|null>;actor:string;activity:StoryActivity;enabled:boolean;onResponse:(actor:string,value:Record<string,string>)=>void}){
 const {kind,pace,targetActor}=activity;
 useEffect(()=>{if(!enabled||kind!=='train'||!root.current)return;
  const controller=new AbortController();
  void trainContinuously(root.current,actor,{kind,pace,targetActor,paused:false},value=>onResponse(actor,value),controller.signal);
  return()=>{controller.abort();onResponse(actor,{});};
 },[root,actor,kind,pace,targetActor,enabled,onResponse]);
 return null;
}
