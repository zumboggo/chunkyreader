import fs from 'node:fs/promises'
import {createCharacter} from '../../src/story2/engine/character-builder.js'
import {compileStory} from '../../src/story2/engine/story-engine.js'
const root='public/stories/adventures/v1'
const svg=(body)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 600"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#e4f4ff"/><stop offset="1" stop-color="#fff3dd"/></linearGradient></defs><rect width="1000" height="600" fill="url(#sky)"/><circle cx="840" cy="85" r="48" fill="#ffe6a1"/><path d="M0 390 Q240 310 500 390 T1000 360 V600 H0Z" fill="#c6e5ce"/><path d="M0 470 Q400 420 1000 470 V600 H0Z" fill="#a9d5b8"/>${body}</svg>`
const pig=(wear='')=>`<g transform="translate(500 440)" stroke="#8c536c" stroke-width="5" stroke-linejoin="round"><ellipse cy="85" rx="145" ry="28" fill="#b99883" stroke="none"/><path d="M-90 15q-60-55-35 0q15 20 29 5" fill="none"/><rect x="-65" y="35" width="25" height="45" rx="10" fill="#ee9cb3"/><rect x="35" y="35" width="25" height="45" rx="10" fill="#ee9cb3"/><ellipse cy="5" rx="95" ry="65" fill="#f6b5c7"/><path d="M-58-40L-70-92-22-58M30-58L70-91 62-38" fill="#ee9cb3"/><circle cx="-32" cy="-18" r="6" fill="#493c52" stroke="none"/><circle cx="32" cy="-18" r="6" fill="#493c52" stroke="none"/><ellipse cy="9" rx="34" ry="23" fill="#ee9cb3"/><circle cx="-12" cy="9" r="5" fill="#8c536c" stroke="none"/><circle cx="12" cy="9" r="5" fill="#8c536c" stroke="none"/><path d="M-15 43q15 13 30 0" fill="none"/>${wear==='hat'?'<path d="M-72-65h144M-43-65l12-58h62l12 58" fill="#dab8ed" stroke="#806691"/>':wear==='pot'?'<path d="M-67-65h134v-57h-134zM67-108h24v24H67" fill="#c2d4e0" stroke="#71899b"/>':''}</g>`
const pet=(kind='cat',bed='')=>`<g transform="translate(500 385)" stroke="#745c67" stroke-width="5" stroke-linejoin="round">${bed==='box'?'<path d="M-155 15h310l-25 145h-260z" fill="#d5af87"/>':bed==='tub'?'<path d="M-160 30h320q0 140-80 140h-160q-80 0-80-140" fill="#badfea"/>':''}<ellipse cy="95" rx="130" ry="85" fill="${kind==='cat'?'#e6b080':'#fff4dc'}"/>${kind==='cat'?'<path d="M-85-5l-18-83 76 43M27-45l76-43-18 83" fill="#e6b080"/><path d="M110 105q100-120 40-160" fill="none" stroke="#e6b080" stroke-width="28"/>':'<path d="M-30-25q-40-70 0-55q10-60 30-10q40-45 35 25" fill="#eb8b91"/>'}<ellipse cy="4" rx="93" ry="72" fill="${kind==='cat'?'#efc49c':'#fff4dc'}"/><circle cx="-30" cy="-5" r="7" fill="#493c52" stroke="none"/><circle cx="30" cy="-5" r="7" fill="#493c52" stroke="none"/>${kind==='cat'?'<path d="M-12 18h24L0 30z" fill="#db8e9b"/><path d="M0 30q-12 20-28 7M0 30q12 20 28 7M-50 20l-65-10M50 20l65-10" fill="none"/>':'<path d="M-19 15h38L0 44z" fill="#efbc63"/>'}</g>`
for(const wear of ['','hat','pot'])await fs.writeFile(`${root}/pig-${wear||'mud'}.svg`,svg(pig(wear)))
for(const kind of ['cat','hen'])for(const bed of ['','box','tub'])await fs.writeFile(`${root}/${kind}-${bed||'big'}.svg`,svg(pet(kind,bed)))
const make=(id,name,hair,shirt,style,outfit='tunic')=>createCharacter({id,name,palette:{skin:'#f0c9ad',hair,shirt},appearance:{age:'teen',hair:style,outfit,face:'round',eyes:'gentle'},provenance:'Storybook adaptation for Chunky Reader; shared polished SVG builder, not a likeness.'})
const characters={Anna:make('Anna','Anna','#70503f','#c491d8','ponytail'),Sarah:make('Sarah','Sarah','#916340','#edaaa9','bob'),Elsa:make('Elsa','Elsa','#eedcb2','#89cddd','long','robe')}
const backgrounds=Object.fromEntries(['pig-mud','pig-hat','pig-pot','cat-big','hen-big','cat-box','cat-tub','hen-box','hen-tub'].map(id=>[id,{src:`stories/adventures/v1/${id}.svg`}]));
const pigScript=`story 2
variable pot = false hidden
scene pig-mud
show Anna happy left
show Sarah curious right
camera wide cut
I: A pig is in the mud.
Anna [curious]: A hat for a pig?
choice hat
option hat "Get a hat." -> hat
option pot "Get a pot." -> pot ; pot = true
label hat
scene pig-hat
react Sarah laugh
Sarah [laughing]: The hat fits!
goto play
label pot
scene pig-pot
react Anna laugh
Anna [laughing]: The pot fits!
goto play
label play
I: The pig can play.
choice play
option hop "Hop, pig!" -> hop
option sit "Sit, pig!" -> sit
label hop
move Sarah bounce
Sarah [happy]: Hop! Hop! Mud on us!
goto rest
label sit
react Sarah laugh
Sarah [laughing]: Plop! A bum in the mud!
goto rest
label rest
Anna [happy]: A fun day! Time to rest.
choice rest
option hug "A hug." -> hug
option nap "A nap." -> nap
label hug
react Anna excited
Anna [happy]: A big hug. Mud on me!
goto endcheck
label nap
rest Sarah downcast
Sarah [happy]: Shh! The pig can nap.
goto endcheck
label endcheck
if pot == true -> potend else hatend
label potend
scene pig-pot
I: A pot for a hat. It fits just right!
goto finish
label hatend
scene pig-hat
I: A hat for a pig. It fits just right!
goto finish
label finish
Anna [happy]: I love this pig!
end`
const elsaScript=`story 2
variable hen = false hidden
variable tub = false hidden
scene meadow
show Anna curious left
show Sarah happy center
show Elsa happy right
camera wide cut
Elsa [happy]: I can make a pet!
choice pet
option cat "A cat!" -> cat
option hen "A hen!" -> hen ; hen = true
label cat
scene cat-big
react Elsa excited
I: Pop! A big cat!
goto big
label hen
scene hen-big
react Elsa excited
I: Pop! A big hen!
goto big
label big
Sarah [surprised]: So big! No bed will fit!
Anna [curious]: A box? A tub?
choice bed
option box "Get a box." -> box
option tub "Get a tub." -> tub ; tub = true
label box
if hen == true -> henbox else catbox
label henbox
scene hen-box
I: The hen fits in the box!
goto settle
label catbox
scene cat-box
I: The cat fits in the box!
goto settle
label tub
if hen == true -> hentub else cattub
label hentub
scene hen-tub
I: The hen fits in the tub!
goto settle
label cattub
scene cat-tub
I: The cat fits in the tub!
goto settle
label settle
Elsa [worried]: My pet will not nap.
choice nap
option pat "Pat the pet." -> pat
option sing "Sing a song." -> sing
label pat
react Anna nod
Anna [happy]: Pat, pat. A soft pat.
goto sleepy
label sing
react Sarah laugh
Sarah [happy]: La, la, la! A song for a pet.
goto sleepy
label sleepy
Elsa [relieved]: A big yawn. It can nap!
if tub == true -> tubend else boxend
label tubend
I: A tub is a bed. What a snug pet!
goto finish
label boxend
I: A box is a bed. What a snug pet!
goto finish
label finish
Sarah [happy]: Shh! We can rest too.
end`
// Supporting animals use the shared sprite actor and motion runner.
await fs.writeFile(`${root}/meadow.svg`,svg(''))
const sprite=(body,viewBox)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${body}</svg>`
for(const wear of ['','hat','pot'])await fs.writeFile(`${root}/actor-pig-${wear||'mud'}.svg`,sprite(pig(wear),'330 290 340 300'))
for(const kind of ['cat','hen'])for(const bed of ['','box','tub'])await fs.writeFile(`${root}/actor-${kind}-${bed||'big'}.svg`,sprite(pet(kind,bed),'320 265 380 310'))
const expression=(file)=>({src:`stories/adventures/v1/actor-${file}.svg`})
characters.Pig={name:'Pig',expressions:{neutral:expression('pig-mud'),happy:expression('pig-hat'),curious:expression('pig-pot')}}
for(const kind of ['Cat','Hen'])characters[kind]={name:kind,expressions:{neutral:expression(`${kind.toLowerCase()}-big`),happy:expression(`${kind.toLowerCase()}-box`),curious:expression(`${kind.toLowerCase()}-tub`)}}
backgrounds.meadow={src:'stories/adventures/v1/meadow.svg'}
for(const bg of Object.values(backgrounds))bg.src='stories/adventures/v1/meadow.svg'
function stage(script,elsa){
 script=script.replace(/^show .+\n/gm,'').replace('move Sarah bounce','move Pig bounce')
 if(elsa)script=script.replace(/^(Sarah|Elsa) \[([^,\]]+)[^\]]*\]:/gm, (line,actor,emotion)=>`show ${actor} ${emotion} right\n${line}`)
 return script.replace(/^scene (.+)$/gm,(_,scene)=>{
  const animal=scene.startsWith('pig')?'Pig':scene.startsWith('cat')?'Cat':'Hen'
  const emotion=scene.endsWith('hat')||scene.endsWith('box')?'happy':scene.endsWith('pot')||scene.endsWith('tub')?'curious':'neutral'
  return `scene ${scene}\nshow Anna happy left\nshow Sarah curious right\n${elsa?'show Elsa happy right\n':''}${scene==='meadow'?'':`show ${animal} ${emotion} center\n`}camera wide cut${elsa&&scene.endsWith('big')?'\nmove '+animal+' bounce':''}`
 })
}
const adventures=[{id:'pigs-hat-v1',title:"The Pig’s Hat",description:'A hat, a pot, and a very muddy pig.',cover:'pig-pot',focus:['pig','hat','pot','mud','hop'],script:pigScript,cast:['Anna','Sarah']},{id:'elsas-pet-v1',title:'Elsa’s Pet',description:'A tiny wish. A very big pet.',cover:'cat-tub',focus:['pet','cat','hen','big','bed'],script:elsaScript,cast:['Anna','Sarah','Elsa']}]
for(const a of adventures){const pack={format:2,title:a.title,description:a.description,profile:'growing-reader',notice:'A make-believe adventure with Anna and Sarah. Read and choose, or listen together.',script:stage(a.script,a.id==='elsas-pet-v1'),assets:{backgrounds,characters:Object.fromEntries([...a.cast,...(a.id==='elsas-pet-v1'?['Cat','Hen']:['Pig'])].map(id=>[id,characters[id]]))},quiz:[]};const result=compileStory(pack.script,pack.assets);if(result.errors.length)throw Error(JSON.stringify(result.errors.map(e=>({...e,text:pack.script.split("\n")[e.line-1]}))));let audio;try{audio=JSON.parse(await fs.readFile(`${root}/${a.id}.json`,'utf8')).audio}catch{};await fs.writeFile(`${root}/${a.id}.json`,JSON.stringify({...pack,audio,id:a.id,version:1,focusWords:a.focus,cover:`stories/adventures/v1/${a.cover}.svg`},null,2)+'\n')}
console.log('Built two Story 2 adventures.')
