import fs from 'node:fs'
import {compileStory} from '../../src/story2/engine/story-engine.js'
const root='public/stories/adventures/v1'
const prior=JSON.parse(fs.readFileSync(`${root}/chengdu-boat-v1.json`))
// A seated baby silhouette, kept low in a full-body canvas so Leah is smaller than her sisters.
const expressions={}
for(const emotion of ['neutral','happy','curious','sad','proud']){
 const smile=emotion==='sad'?'M106 397Q120 387 134 397':'M105 387Q120 403 135 387'
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 600"><g stroke="#805d59" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="120" cy="574" rx="91" ry="12" fill="#d9b5b5" opacity=".25" stroke="none"/><path d="M85 482Q36 493 40 548Q54 573 100 548L120 514L144 548Q188 573 200 546Q202 509 156 482" fill="#f4d5b9"/><path d="M82 423Q120 409 158 423L168 505Q120 535 73 505Z" fill="#f4d58a"/><path d="M79 433Q45 444 57 487Q66 501 77 486L91 450M158 433Q190 447 182 483Q173 501 162 486L150 451" fill="#f4d5b9"/><circle cx="120" cy="365" r="64" fill="#f4d5b9"/><path d="M71 334Q77 298 119 300Q153 297 173 328Q147 316 126 322Q103 330 96 313" fill="#876044"/><path d="M112 301Q105 281 124 286Q139 292 126 303" fill="#876044"/><ellipse cx="97" cy="365" rx="5" ry="7" fill="#59474a"/><ellipse cx="143" cy="365" rx="5" ry="7" fill="#59474a"/><ellipse cx="82" cy="383" rx="12" ry="7" fill="#eaa8a6" stroke="none"/><ellipse cx="158" cy="383" rx="12" ry="7" fill="#eaa8a6" stroke="none"/><path d="${smile}" fill="none"/><path d="M100 427Q120 453 141 427L136 466H105Z" fill="#fff6df"/><circle cx="121" cy="451" r="5" fill="#eaa8a6" stroke="none"/></g></svg>`
 const file=`leah-baby-${emotion}.svg`;fs.writeFileSync(`${root}/${file}`,svg);expressions[emotion]={src:`stories/adventures/v1/${file}`}
}
const characters={...prior.assets.characters,Leah:{name:'Leah',expressions,provenance:'Original storybook illustration of a seated one-year-old; no photograph used.'}}
const stage=scene=>`scene ${scene}\nshow Anna happy left\nshow Sarah curious right\nshow Leah curious center\ncamera wide cut`
const birthday=`story 2
variable red = false hidden
${stage('leah-birthday-room')}
I: Leah is one! Mum is here, too.
Anna [happy]: A ball for you, Leah!
Sarah [curious]: Red or blue?
choice ball
option red "A red ball." -> red ; red = true
option blue "A blue ball." -> blue
label red
Sarah [happy]: Red! Like my hat!
goto try
label blue
Sarah [happy]: Blue! Like the sea!
goto try
label try
I: Leah sits on the rug. Anna rolls the ball.
express Leah sad
I: Leah pats it. It does not roll back.
Anna [curious]: Let us help.
choice help
option near "Sit near." -> near
option show "Show her." -> show
label near
react Anna crouch
Anna [happy]: I sit near you. Roll it to me.
goto roll
label show
react Sarah point
Sarah [happy]: See? I roll it. Now you!
goto roll
label roll
express Leah happy
camera listener Leah cut
I: Leah rolls it back! She did it!
Anna [happy]: You can do it now!
camera wide cut
Sarah [happy]: Again?
choice endgame
option more "One more go!" -> more
option hug "Time for a hug." -> hug
label more
I: Anna rolls. Leah rolls. Sarah has a go.
goto colour
label hug
I: Mum sits by Leah. We all hug.
goto colour
label colour
if red == true -> redend else blueend
label redend
Anna [happy]: A red ball. A new game!
goto done
label blueend
Anna [happy]: A blue ball. A new game!
goto done
label done
express Leah proud
Sarah [happy]: One big day for you!
end`
const garden=`story 2
variable box = false hidden
${stage('leah-toy-garden')}
I: Mum sits by Leah on the mat.
Sarah [sad]: My toy pup! It is not here.
Anna [curious]: We can look. A box! A mat!
choice look
option box "Look in the box." -> box ; box = true
option mat "Look by the mat." -> mat
label box
react Anna point
Anna [curious]: A sock! No pup in here.
goto clue
label mat
react Sarah point
Sarah [curious]: A cup! No pup by the mat.
goto clue
label clue
express Leah happy
I: Leah pats the mat. A bit of fur!
Sarah [curious]: Is it my pup?
choice find
option lift "Lift the mat." -> lift
option peek "Have a peek." -> peek
label lift
react Anna reach
Anna [happy]: Up, mat! Here is the pup!
goto found
label peek
react Sarah crouch
Sarah [happy]: I see a nose! Here is my pup!
goto found
label found
express Sarah happy
camera listener Leah cut
Sarah [happy]: You saw it, Leah! You can help!
I: Leah hugs the pup.
camera wide cut
Anna [curious]: A home for the pup?
choice home
option boxbed "A box bed." -> boxbed
option matbed "A mat bed." -> matbed
label boxbed
Sarah [happy]: In the box, pup. Have a nap.
goto callback
label matbed
Sarah [happy]: On the mat, pup. Have a nap.
goto callback
label callback
if box == true -> sock else cup
label sock
Anna [happy]: The sock can be a hat!
goto done
label cup
Anna [happy]: The cup can be a bath!
goto done
label done
express Leah happy
Sarah [happy]: A pup and us. All here!
end`
for(const d of [
{id:'leahs-big-day-v1',title:'Leah’s Big Day',description:'Leah is one! Can she roll a ball back?',scene:'leah-birthday-room',focusWords:['ball','roll','rug','pat','hug'],script:birthday},
{id:'the-toy-pup-v1',title:'The Toy Pup',description:'A lost toy. A little sister who can help.',scene:'leah-toy-garden',focusWords:['pup','mat','box','sock','cup'],script:garden}
]){
 const file=`${root}/${d.id}.json`;if(fs.existsSync(file))throw Error(`Do not overwrite released ${file}`)
 const image=`stories/adventures/v1/${d.scene}.webp`
 const pack={format:2,id:d.id,title:d.title,description:d.description,version:1,cover:image,castLabel:'Anna, Sarah & Leah',profile:'growing-reader',sceneLayout:'full',intro:{kind:'still',src:image,alt:d.scene==='leah-birthday-room'?'A cozy room ready for Leah’s first birthday.':'A sunny garden with a mat and a toy box.'},notice:'A make-believe family adventure with Anna, Sarah and one-year-old Leah. Read and choose, or listen together.',focusWords:d.focusWords,script:d.script,assets:{characters,backgrounds:{[d.scene]:{src:image}}},quiz:[],sources:[],audio:{}}
 const result=compileStory(pack.script,pack.assets);if(result.errors.length)throw Error(JSON.stringify(result.errors));fs.writeFileSync(file,JSON.stringify(pack,null,2)+'\n')
}
