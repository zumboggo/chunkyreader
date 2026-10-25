import fs from 'node:fs/promises'
import {createCharacter} from '../../src/story2/engine/character-builder.js'
import {compileStory} from '../../src/story2/engine/story-engine.js'
const root='public/stories/adventures/v1'
const prior=JSON.parse(await fs.readFile(`${root}/pigs-hat-v1.json`,'utf8'))
const characters={Anna:prior.assets.characters.Anna,
 Anne:createCharacter({id:'Anne',name:'Anne',palette:{skin:'#f0c9ad',hair:'#ba633b',shirt:'#a6bd92'},appearance:{age:'teen',hair:'long',outfit:'robe',face:'round',eyes:'keen'},provenance:'Original stylized book adaptation of Anne Shirley: red hair, imaginative and eager for friendship. Not based on an actor or screen adaptation.'}),
 Diana:createCharacter({id:'Diana',name:'Diana',palette:{skin:'#f0c9ad',hair:'#302b32',shirt:'#99bcd4'},appearance:{age:'teen',hair:'long',outfit:'robe',face:'round',eyes:'gentle'},provenance:'Original stylized book adaptation of Diana Barry: dark hair, warm and practical. Not based on an actor or screen adaptation.'})}
const base=`<rect width="1000" height="600" fill="#e8f3ef"/><circle cx="850" cy="75" r="45" fill="#ffe5a1"/><path d="M0 330Q250 270 500 330T1000 310V600H0Z" fill="#c8dfb3"/><path d="M0 450Q400 390 1000 440V600H0Z" fill="#b5d0a3"/>`
const house=`<g stroke="#58685b" stroke-width="4" stroke-linejoin="round"><path d="M60 300V150L190 55 320 150V300Z" fill="#fff6df"/><path d="M35 155L190 40 345 155" fill="#88a984"/><rect x="166" y="216" width="50" height="84" fill="#8da386"/><path d="M100 180h42v44h-42zM245 180h42v44h-42zM174 117h34v40h-34z" fill="#b9dbe0"/></g><g stroke="#769271" stroke-width="5"><path d="M780 90V310M825 80V310M865 100V310"/><path d="M720 105Q805 0 910 105Q935 200 800 190Q700 195 720 105" fill="#b6d099"/></g>`
const picnic=`<path d="M280 475L690 450 790 575 210 590Z" fill="#eed3d7" stroke="#b2949a" stroke-width="3"/><g fill="none" stroke="#fff5e9" stroke-width="10"><path d="M300 490L720 555M270 530L750 565M350 470L390 580M470 463L520 580M600 455L655 577"/></g>`
const leaf=`<g transform="translate(440 493)"><path d="M-42 3Q-25-52 49-30Q45 38-42 3Z" fill="#84b888" stroke="#4d8056" stroke-width="4"/><path d="M-30 3L30-19" stroke="#527c58" stroke-width="3"/></g>`
const shell=`<g transform="translate(440 493)" fill="#f9e2d3" stroke="#b68f8d" stroke-width="3"><path d="M-40 5Q-75-18-45-35Q-30-58-12-40Q8-65 24-38Q50-45 51-20Q70 5 35 20Z"/><path d="M-40 5L-40-30M-40 5L-12-37M-40 5L24-35M-40 5L48-15" fill="none"/></g>`
const bug=`<g transform="translate(447 467)" stroke="#655362" stroke-width="3"><ellipse rx="13" ry="10" fill="#ea9691"/><path d="M0-10V10M-10 0L-20-9M10 0L20-9M-10 5L-20 13M10 5L20 13"/><circle cx="-4" cy="-3" r="2" fill="#655362"/><circle cx="6" cy="3" r="2" fill="#655362"/></g>`
const buns=`<g fill="#e4af70" stroke="#ac8057" stroke-width="3"><ellipse cx="555" cy="510" rx="29" ry="22"/><ellipse cx="620" cy="495" rx="29" ry="22"/><path d="M545 493l10 11M609 481l10 11"/></g>`
const hat=(x=530,y=405)=>`<g transform="translate(${x} ${y})" stroke="#ac8358" stroke-width="4"><ellipse cy="12" rx="68" ry="18" fill="#e9ce98"/><path d="M-40 12v-35Q0-65 40-35V12Z" fill="#f3deab"/><path d="M-40 0h80" stroke="#b086bc" stroke-width="12"/><path d="M36 0l35 26-28-8" fill="#b086bc" stroke="#b086bc"/></g>`
const duck=`<g transform="translate(680 430)" stroke="#837153" stroke-width="4"><ellipse cy="25" rx="51" ry="33" fill="#f8edc8"/><circle cx="-29" cy="-16" r="26" fill="#f8edc8"/><path d="M-54-13l-30 8 31 8" fill="#e9b767"/><circle cx="-34" cy="-23" r="4" fill="#493f38"/><path d="M-12 19q35-10 30 18" fill="none"/></g>`
const tree=`<path d="M490 390L505 180H535L550 390" fill="#b09070"/><path d="M420 200Q380 120 480 110Q500 45 570 95Q680 90 640 190Q600 260 520 220Q450 260 420 200" fill="#acc991" stroke="#6d8e62" stroke-width="4"/>`
const scenes={
 'anne-garden':base+house,
 'anne-leaf-tea':base+house+picnic+leaf+buns,
 'anne-shell-tea':base+house+picnic+shell+buns,
 'anne-leaf-bug':base+house+picnic+leaf+bug+buns,
 'anne-shell-bug':base+house+picnic+shell+bug+buns,
 'anne-windy-path':base+house+hat(700,210),
 'anne-hat-bush':base+tree+hat(520,220)+duck,
 'anne-hat-safe':base+tree+picnic+hat(530,495)+buns+duck,
}
for(const [id,body]of Object.entries(scenes))await fs.writeFile(`${root}/${id}.svg`,`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 600">${body}</svg>`)
const stage=(scene)=>`scene ${scene}\nshow Anna curious left\nshow Anne happy center\nshow Diana happy right\ncamera wide cut`
const tea=`story 2
variable leaf = false hidden
${stage('anne-garden')}
I: Anna is at Green Gables.
Anne [happy]: I am Anne. This is Diana.
Diana [happy]: Come and play!
choice hello
option wave "Wave hello." -> wave
option bow "Take a bow." -> bow
label wave
react Anna wave
Anna [happy]: Hi! I am Anna.
react Anne wave
Anne [happy]: A new pal! Come in!
goto tea
label bow
react Anna bow
Anna [happy]: Hi! I am Anna.
react Anne bow
Anne [laughing]: A grand guest! Come in!
goto tea
label tea
Anne [excited]: Let us have a grand tea!
Diana [curious]: No cups! What can we use?
choice cup
option leaf "A leaf cup." -> leaf ; leaf = true
option shell "A shell cup." -> shell
label leaf
${stage('anne-leaf-tea')}
Anna [happy]: A leaf can be a cup!
Diana [happy]: It has a drip. Sip fast!
goto bugcheck
label shell
${stage('anne-shell-tea')}
Anna [happy]: A shell can be a cup!
Diana [laughing]: Tea by the sea! In a yard!
goto bugcheck
label bugcheck
if leaf == true -> leafbug else shellbug
label leafbug
${stage('anne-leaf-bug')}
goto bug
label shellbug
${stage('anne-shell-bug')}
goto bug
label bug
Anne [surprised]: A bug! A guest for tea!
choice bug
option tip "Tip it out." -> tip
option sip "Let it sip." -> sip
label tip
react Anna reach
Anna [happy]: Off you go, bug!
Diana [happy]: A soft leaf for you.
goto endcup
label sip
react Anne bow
Anne [laughing]: A sip for Sir Bug!
Diana [laughing]: He has six feet. No boots!
goto endcup
label endcup
if leaf == true -> leafend else shellend
label leafend
${stage('anne-leaf-tea')}
I: A leaf cup. A bun to split.
goto pals
label shellend
${stage('anne-shell-tea')}
I: A shell cup. A bun to split.
goto pals
label pals
Anna [happy]: Can we be pals?
Anne [happy]: Yes! You, Diana, and me!
Diana [happy]: Come back! We can have a picnic.
end`
const hatStory=`story 2
variable net = false hidden
${stage('anne-garden')}
I: Anna is back. Her pals wave.
react Anne wave
Anne [happy]: Come on! A picnic for us!
${stage('anne-windy-path')}
Diana [surprised]: The wind has your hat!
Anne [surprised]: My hat can fly!
choice chase
option hop "Hop, hop!" -> hop
option flap "Flap your arms!" -> flap
label hop
move Anna bounce
Anna [happy]: Hop! I am a frog!
Anne [laughing]: A frog can help!
goto bush
label flap
react Anna excited
Anna [happy]: Flap! I am a duck!
Anne [laughing]: A duck can help!
goto bush
label bush
${stage('anne-hat-bush')}
Diana [curious]: It is stuck in a bush.
Anne [laughing]: A duck wants it for a nest!
choice tool
option net "Get a net." -> net ; net = true
option stick "Get a stick." -> stick
label net
react Anna reach
Anna [happy]: Up goes the net. Got it!
Diana [relieved]: Good catch! No mud on it.
goto safe
label stick
react Anna reach
Anna [happy]: Tap, tap. Down it drops!
Diana [laughing]: Plop! A spot of mud!
goto safe
label safe
${stage('anne-hat-safe')}
Anne [relieved]: My hat is safe. Thank you!
Diana [happy]: Now we can sit and eat.
Anne [excited]: Our pals need a club name!
choice club
option hat "The Hat Club!" -> hatclub
option duck "The Duck Club!" -> duckclub
label hatclub
react Anne bow
Anne [proud]: Hats off to our club!
Diana [laughing]: Hold on to that hat!
goto toolcheck
label duckclub
react Anna laugh
Anna [laughing]: Quack! A club of ducks!
Diana [laughing]: We can quack and eat buns!
goto toolcheck
label toolcheck
if net == true -> netend else stickend
label netend
Anna [happy]: A net, a hat, and my pals.
goto end
label stickend
Anna [happy]: A stick, a hat, and my pals.
goto end
label end
Anne [happy]: A grand day with you, Anna!
end`
const defs=[
 {id:'annas-new-pals-v1',title:'Anna’s New Pals',description:'A pretend tea with Anne and Diana.',cover:'anne-leaf-bug',focusWords:['pal','cup','leaf','bug','bun'],script:tea},
 {id:'hat-on-the-run-v1',title:'The Hat on the Run',description:'Three pals, one hat, and a nosy duck.',cover:'anne-hat-bush',focusWords:['hat','net','duck','mud','help'],script:hatStory},
]
for(const def of defs){
 const file=`${root}/${def.id}.json`;let audio;try{audio=JSON.parse(await fs.readFile(file,'utf8')).audio}catch{}
 const pack={format:2,...def,version:1,cover:`stories/adventures/v1/${def.cover}.svg`,castLabel:'Anna, Anne & Diana',profile:'growing-reader',notice:'A new make-believe visit to the world of Anne of Green Gables by L. M. Montgomery. These visits and words are newly written, not scenes or quotations from the book.',assets:{characters,backgrounds:Object.fromEntries(Object.keys(scenes).map(id=>[id,{src:`stories/adventures/v1/${id}.svg` }]))},quiz:[],sources:['https://www.gutenberg.org/files/45/45-h/45-h.htm'],audio}
 const result=compileStory(pack.script,pack.assets);if(result.errors.length)throw Error(JSON.stringify(result.errors))
 await fs.writeFile(file,JSON.stringify(pack,null,2)+'\n')
}
console.log('Built two new Anne and Diana adventures; existing packages untouched.')
