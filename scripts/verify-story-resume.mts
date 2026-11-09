import assert from 'node:assert/strict'
import { latestUnfinishedStory, rememberStoryVisit } from '../src/storyResume.ts'
import { AccountStorage } from '../src/progressStorage.ts'
class MemoryStorage implements Storage {
 data=new Map<string,string>();get length(){return this.data.size}key(n:number){return [...this.data.keys()][n]??null}getItem(k:string){return this.data.get(k)??null}setItem(k:string,v:string){this.data.set(k,v)}removeItem(k:string){this.data.delete(k)}clear(){this.data.clear()}
}
const raw=new MemoryStorage(),store=new AccountStorage(raw)
const items=[{id:'book',title:'Book',kind:'book' as const},{id:'adventure',title:'Adventure',kind:'adventure' as const}]
assert.equal(latestUnfinishedStory(items,store),undefined)
store.setItem('chunky-reader:story:book:page','0');rememberStoryVisit('book','book',false,store,10)
assert.equal(latestUnfinishedStory(items,store)?.id,'book','First page can be resumed')
store.setItem('chunky-reader:story:adventure:adventure',JSON.stringify({steps:[],word:2,mode:'read',phase:'words'}));rememberStoryVisit('adventure','adventure',false,store,20)
assert.equal(latestUnfinishedStory(items,store)?.id,'adventure','A word introduction is unfinished progress')
rememberStoryVisit('adventure','adventure',true,store,30)
assert.equal(latestUnfinishedStory(items,store)?.id,'book','Completed adventures are skipped')
rememberStoryVisit('book','book',true,store,40)
assert.equal(latestUnfinishedStory(items,store),undefined,'No Resume when everything is finished')
rememberStoryVisit('adventure','adventure',false,store,50)
assert.equal(latestUnfinishedStory(items,store)?.id,'adventure','Replay is a new unfinished visit')
store.activate('another-user');assert.equal(latestUnfinishedStory(items,store),undefined,'Progress stays account scoped')
store.activate(null);assert.equal(latestUnfinishedStory(items,store)?.id,'adventure')
store.setItem('chunky-reader:story:adventure:adventure','{broken');assert.equal(latestUnfinishedStory(items,store),undefined)
store.removeItem('chunky-reader:story:book:resume');store.setItem('chunkyLearnerProgress.v1',JSON.stringify({storyCompletions:{book:1}}));assert.equal(latestUnfinishedStory(items,store),undefined,'Legacy completed books are skipped')
store.setItem('chunkyLearnerProgress.v1','{}');assert.equal(latestUnfinishedStory(items,store)?.id,'book','Legacy unfinished progress remains usable')
console.log('Story Resume: recency, first-page/word progress, completion, replay, legacy, corrupt data and account isolation passed.')
