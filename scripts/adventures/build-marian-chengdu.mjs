import fs from 'node:fs'
import {compileStory} from '../../src/story2/engine/story-engine.js'
const root='public/stories/adventures/v1'
for(const id of ['marians-bun-run-v1','marians-red-kite-v1','chengdu-boat-v1'])if(fs.existsSync(`${root}/${id}.json`))throw Error(`Refusing to rebuild existing episode ${id}; create a new version.`)
const prior=JSON.parse(fs.readFileSync(`${root}/pigs-hat-v1.json`))
const svg=body=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 600">${body}</svg>`
const meadow='<rect width="1000" height="600" fill="#e9f4ef"/><circle cx="820" cy="85" r="48" fill="#ffdf9b"/><path d="M0 320Q250 260 500 330T1000 305V600H0Z" fill="#c7deb1"/><path d="M0 470Q470 390 1000 480V600H0Z" fill="#abd0a2"/>'
const trees='<g stroke="#648264" stroke-width="4"><path d="M55 360V130h35v230M895 360V130h35v230" fill="#b69272"/><path d="M10 170Q-20 40 90 35Q195 50 155 190Q70 235 10 170M850 165Q820 30 930 35Q1040 50 990 190Q910 230 850 165" fill="#93ba8b"/></g>'
const buns='<g fill="#e8b77d" stroke="#a47a55" stroke-width="3"><ellipse cx="465" cy="455" rx="23" ry="17"/><ellipse cx="515" cy="455" rx="23" ry="17"/><path d="M459 444l8 9M508 444l8 9"/></g>'
const basket='<path d="M420 450h140l-17 60h-106z" fill="#d9b180" stroke="#8e7154" stroke-width="4"/><path d="M438 452Q488 385 544 452" fill="none" stroke="#8e7154" stroke-width="8"/>'
const leaf='<path d="M425 433Q495 362 568 425Q508 480 425 433Z" fill="#7ab58a" stroke="#507a58" stroke-width="3"/><path d="M438 431L550 422" stroke="#507a58" stroke-width="3"/>'
const hat='<g fill="#dfb4d9" stroke="#92638d" stroke-width="4"><ellipse cx="495" cy="436" rx="80" ry="16"/><path d="M450 435v-33q45-35 90 0v33Z"/></g>'
const mud='<ellipse cx="500" cy="480" rx="160" ry="38" fill="#b49c81"/><ellipse cx="500" cy="483" rx="130" ry="20" fill="#c3af91"/>'
const kite='<g stroke="#8b665e" stroke-width="3"><path d="M470 65L535 125 490 205 425 140Z" fill="#eb9297"/><path d="M470 65L490 205M425 140L535 125" fill="none"/><path d="M490 205Q550 260 480 285Q440 300 490 330" fill="none"/><path d="M495 235l-18-10v20zM495 235l18-10v20zM477 290l-18-10v20zM477 290l18-10v20z" fill="#e6bd7d"/></g>'
const bush='<path d="M360 400Q320 320 395 305Q410 245 475 295Q530 250 560 310Q650 310 620 400Z" fill="#8eb889" stroke="#5f825d" stroke-width="4"/>'
const park='<rect width="1000" height="600" fill="#e8f0ef"/><path d="M0 340Q500 285 1000 350V600H0Z" fill="#c1d9be"/><path d="M0 475Q500 410 1000 475V600H0Z" fill="#e6d9bf"/><g stroke="#71976b" stroke-width="7"><path d="M80 355V30M110 355V60M145 355V20M900 350V30M935 350V60"/></g><g fill="#8bb083"><path d="M80 100Q5 30 20 110Q50 140 80 100M110 170Q170 80 180 150Q160 190 110 170M145 80Q220 25 210 95Q180 120 145 80M900 100Q820 30 830 105Q860 130 900 100M935 175Q1000 80 995 170Z"/></g><g stroke="#8d7766" stroke-width="4"><path d="M680 300V160h180v140" fill="#eee3cf"/><path d="M650 165Q705 150 715 115h110q15 35 65 50Z" fill="#889b9c"/><path d="M695 295h155M713 295v48M832 295v48" fill="none"/><ellipse cx="773" cy="278" rx="65" ry="14" fill="#bc9375"/><path d="M748 267h28v-20h-28zM794 268h17v-15h-17z" fill="#e5f0df"/></g>'
const pool='<ellipse cx="500" cy="450" rx="175" ry="48" fill="#add6df" stroke="#82b7c4" stroke-width="3"/>'
const boat='<g stroke="#8d8578" stroke-width="3" stroke-linejoin="round"><path d="M440 435h125l-28 31h-70Z" fill="#fff0d3"/><path d="M455 435l46-45 40 45Z" fill="#fffaf0"/><path d="M501 390v45" fill="none"/></g>'
const ant='<g stroke="#60534e" stroke-width="2.5" fill="#60534e"><ellipse cx="570" cy="421" rx="7" ry="5"/><circle cx="580" cy="420" r="4"/><path d="M567 420l-6-8M568 424l-5 8M574 424l3 8M580 417l4-6" fill="none"/></g>'
const scenes={
 'marian-buns':meadow+trees+'<g transform="translate(130 0)">'+basket+buns+'</g>',
 'marian-leaf':meadow+trees+'<g transform="translate(130 0)">'+basket+buns+'</g>'+'<g transform="translate(130 0)">'+leaf+'</g>',
 'marian-hat':meadow+trees+'<g transform="translate(130 0)">'+basket+buns+'</g>'+'<g transform="translate(130 0)">'+hat+'</g>',
 'marian-mud':meadow+trees+mud+'<path d="M370 468L630 468" stroke="#91714f" stroke-width="22" stroke-linecap="round"/>',
 'marian-picnic':meadow+trees+'<path d="M350 445h300l80 145H270Z" fill="#e9c8d3"/>'+basket+buns,
 'marian-kite-stuck':meadow+trees+bush+`<g transform="translate(130 130)">${kite}</g>`,
 'marian-kite-bow':meadow+trees+'<g transform="translate(130 0)">'+kite+'</g>',
 'marian-kite-leaf':meadow+trees+'<g transform="translate(130 0)">'+kite+'</g>'+'<path d="M478 290Q505 255 532 285Q510 320 478 290" fill="#82b58c"/>',
 'chengdu-boat':park+pool+boat,
 'chengdu-boat-stuck':park+pool+boat+'<ellipse cx="550" cy="463" rx="24" ry="17" fill="#aaa59d"/>',
 'chengdu-ant':park+pool+boat+ant,
 'chengdu-ant-leaf':park+pool+boat+'<path d="M560 480Q615 440 650 480Q610 515 560 480Z" fill="#84b68d"/>',
 'chengdu-ant-stone':park+pool+boat+'<ellipse cx="610" cy="485" rx="36" ry="20" fill="#a7aaa0"/>',
}
for(const [id,body]of Object.entries(scenes))fs.writeFileSync(`${root}/${id}.svg`,svg(body))
// Full-body expression art retains the existing animal actor animation/fallback path.
const fox=(emotion)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 600"><g stroke="#65516b" stroke-width="3" stroke-linejoin="round"><path d="M147 430Q235 440 217 280Q200 335 173 350Z" fill="#c77c4e"/><path d="M217 280Q228 326 212 351L197 335Z" fill="#fff1d9"/><path d="M77 200Q65 360 48 561Q120 590 192 561Q174 360 163 200Z" fill="#b7a2d1"/><path d="M100 220L86 565Q120 574 154 565L140 220Z" fill="#dfcce9"/><path d="M80 202Q65 253 73 313L91 321L105 213M160 202Q181 252 169 313L150 320L135 212" fill="#b7a2d1"/><path d="M73 310Q80 333 94 311M151 311Q164 335 169 309" fill="#d99562"/><path d="M62 178Q48 81 80 54Q120 26 160 54Q190 83 180 180L164 216L76 216Z" fill="#e7d9ee"/><path d="M78 88L73 35L105 66M137 66L170 35L163 96" fill="#cc8758"/><path d="M80 71L80 49L96 68M145 68L163 49L160 77" fill="#e9b3ad"/><path d="M76 85Q120 55 164 85L162 135Q150 170 120 179Q88 165 77 137Z" fill="#d99562"/><path d="M78 120Q99 117 120 139Q141 117 163 120Q158 161 120 178Q83 164 78 120" fill="#fff0d6"/><path d="M110 137Q120 130 130 137L120 146Z" fill="#54434b"/><path d="M89 111Q100 ${emotion==='worried'?100:102} 110 111M131 111Q141 102 151 111" fill="none" stroke-width="3"/>${emotion==='laughing'?'<path d="M91 119q9 9 18 0M132 119q9 9 18 0" fill="none"/>':'<ellipse cx="101" cy="119" rx="5" ry="8" fill="#493d40"/><ellipse cx="141" cy="119" rx="5" ry="8" fill="#493d40"/><circle cx="99" cy="116" r="2" fill="white" stroke="none"/><circle cx="139" cy="116" r="2" fill="white" stroke="none"/>'}<path d="${emotion==='worried'?'M109 157Q120 151 131 157':'M108 151Q120 165 132 151'}" fill="none"/><path d="M86 183Q120 199 154 183L146 211H95Z" fill="#a48ac5"/><circle cx="120" cy="202" r="6" fill="#e9c67c"/></g></svg>`
const expressions={};for(const emotion of ['neutral','happy','curious','worried','laughing','relieved','proud']){const id=`maid-marian-${emotion}`;fs.writeFileSync(`${root}/${id}.svg`,fox(emotion));expressions[emotion]={src:`stories/adventures/v1/${id}.svg`}}
const Marian={name:'Maid Marian',provenance:'Original SVG interpretation of the fox Maid Marian in Disney’s animal Robin Hood (1973); new side adventures, no film dialogue.',expressions}
const cast={Anna:prior.assets.characters.Anna,Sarah:prior.assets.characters.Sarah,Marian}
const stage=(scene,marian=true)=>`scene ${scene}\nshow Anna happy left\nshow Sarah curious right\n${marian?'show Marian happy center\n':''}camera wide cut`
const bunsStory=`story 2
variable leaf = false hidden
${stage('marian-buns')}
I: We meet Maid Marian, a kind fox.
Marian [worried]: Buns for our pals! But rain is here.
Anna [curious]: We can keep them dry.
choice cover
option leaf "Use a leaf." -> leaf ; leaf = true
option hat "Use a hat." -> hat
label leaf
${stage('marian-leaf')}
Sarah [laughing]: A big leaf lid!
goto mud
label hat
${stage('marian-hat')}
Sarah [laughing]: A hat for buns! So grand!
goto mud
label mud
${stage('marian-mud')}
Marian [worried]: Mud! I must not drop the buns.
choice cross
option log "Go on the log." -> log
option round "Go round the mud." -> round
label log
move Anna bounce
Anna [happy]: Step, step. We help you.
Marian [relieved]: Thank you. Slow steps work!
goto picnic
label round
react Sarah point
Sarah [happy]: This way! No mud here.
Marian [relieved]: A long way. But dry feet!
goto picnic
label picnic
${stage('marian-picnic')}
Marian [worried]: Oh! One bun is left for us.
express Sarah worried
camera listener Sarah cut
Anna [happy]: We can share it.
Sarah [relieved]: You and me?
camera wide cut
choice share
option two "Split it in two." -> two
option bits "Make small bits." -> bits
label two
Marian [happy]: Half for each. Two big grins!
goto check
label bits
Sarah [laughing]: Bits for us. Crumbs for the birds!
goto check
label check
if leaf == true -> leafend else hatend
label leafend
Anna [happy]: A leaf lid and a shared bun!
goto end
label hatend
Anna [happy]: A bun hat and a shared bun!
goto end
label end
Marian [happy]: You made room for a pal. Come back!
end`
const kiteStory=`story 2
variable leaf = false hidden
${stage('marian-kite-stuck')}
I: Maid Marian has a red kite.
Marian [worried]: It is stuck! I tug. It will rip.
Anna [curious]: Let us lift it up.
choice lift
option stick "Use a stick." -> stick
option hands "Use our hands." -> hands
label stick
Anna [happy]: Up, stick! Lift, do not tug.
Marian [relieved]: It is free! No rip!
goto tail
label hands
Sarah [happy]: I hold this twig. You lift.
Marian [relieved]: We did it! No rip!
goto tail
label tail
${stage('marian-kite-bow')}
Marian [worried]: But the tail is lost.
choice tail
option bow "Tie on a bow." -> bow
option leaf "Tie on a leaf." -> leaf ; leaf = true
label bow
Sarah [happy]: A bow! Our kite can dress up.
goto wind
label leaf
${stage('marian-kite-leaf')}
Sarah [laughing]: A leaf! Our kite is a tree.
goto wind
label wind
Marian [worried]: What if it gets stuck again?
express Marian worried
camera listener Marian cut
Anna [happy]: We can help again.
Marian [relieved]: Then let us try.
camera wide cut
choice launch
option run "Run with it." -> run
option wind "Wait for wind." -> windwait
label run
move Anna bounce
Anna [excited]: Run, run! Up it goes!
goto check
label windwait
Sarah [curious]: Wait... Now! Up it goes!
goto check
label check
if leaf == true -> leafend else bowend
label leafend
scene marian-kite-leaf
Marian [laughing]: A red kite with a green tail!
goto end
label bowend
scene marian-kite-bow
Marian [laughing]: A red kite with a bow tail!
goto end
label end
Sarah [happy]: Fly, kite! We will catch you.
end`
const boatStory=`story 2
variable leaf = false hidden
${stage('chengdu-boat',false)}
I: We are in a park in Chengdu.
Sarah [happy]: Rain is done. A pool for my boat!
Anna [curious]: What can sail in it?
choice load
option leaf "A leaf." -> leaf
option petal "A pink petal." -> petal
label leaf
Sarah [laughing]: A leaf ship! All on board!
goto stuck
label petal
Sarah [happy]: A pink ship! Just like your dress!
goto stuck
label stuck
scene chengdu-boat-stuck
Sarah [worried]: Oh no. It is stuck on a rock.
choice free
option stick "Push with a twig." -> stick
option cup "Pour in a cup." -> cup
label stick
Anna [happy]: One soft push. Off it goes!
goto ant
label cup
Anna [happy]: More water! Up it floats!
goto ant
label ant
scene chengdu-ant
Sarah [curious]: An ant! It is on the boat.
express Sarah worried
camera listener Sarah cut
Anna [happy]: It needs a way back to land.
Sarah [happy]: Then my boat can help!
camera wide cut
choice land
option leaf "Stop at a leaf." -> leafland ; leaf = true
option stone "Stop at a stone." -> stoneland
label leafland
scene chengdu-ant-leaf
Anna [happy]: A leaf ramp. Off you go, ant!
goto check
label stoneland
scene chengdu-ant-stone
Anna [happy]: A dry stone. Off you go, ant!
goto check
label check
if leaf == true -> leafend else stoneend
label leafend
Sarah [proud]: My boat has a leaf stop!
goto end
label stoneend
Sarah [proud]: My boat has a stone stop!
goto end
label end
Anna [happy]: The ant is home. Time for a bun?
react Sarah laugh
Sarah [laughing]: Yes! No ants in my bun!
end`
const defs=[
{id:'marians-bun-run-v1',title:'Marian’s Bun Run',description:'Keep the buns dry. Save a bit for a pal.',cover:'marian-buns',focusWords:['bun','fox','leaf','mud','share'],script:bunsStory},
{id:'marians-red-kite-v1',title:'Marian’s Red Kite',description:'A stuck kite, a lost tail, and three good pals.',cover:'marian-kite-stuck',focusWords:['kite','fox','stick','tail','wind'],script:kiteStory},
{id:'chengdu-boat-v1',title:'The Chengdu Boat',description:'A tiny boat gets a very tiny guest.',cover:'chengdu-ant',focusWords:['boat','rain','rock','ant','leaf'],script:boatStory},
]
for(const d of defs){d.script=d.script.replace(/^scene (.+)\n(?!show )/gm,(_,id)=>stage(id,d.id!=='chengdu-boat-v1')+'\n');const file=`${root}/${d.id}.json`;if(fs.existsSync(file))throw Error(`Refusing overwrite: ${file}`);const isCity=d.id==='chengdu-boat-v1';const chars=isCity?{Anna:cast.Anna,Sarah:cast.Sarah}:cast;const ids=[...new Set([...d.script.matchAll(/^scene (.+)$/gm)].map(m=>m[1]))];const pack={format:2,...d,version:1,cover:`stories/adventures/v1/${d.cover}.svg`,castLabel:isCity?'Anna & Sarah':'Anna, Sarah & Maid Marian',profile:'growing-reader',sceneLayout:'full',intro:{kind:'still',src:`stories/adventures/v1/${d.id}-intro.poster.jpg`,alt:isCity?'Anna and Sarah watch a paper boat in a Chengdu park puddle.':'Anna and Sarah visit Maid Marian the fox.'},notice:isCity?'A make-believe park adventure in Chengdu with Anna and Sarah. Read and choose, or listen together.':'A new make-believe visit to the animal world of Robin Hood, with Maid Marian the fox. This is a new side adventure, not a scene or quotation from the film.',assets:{characters:chars,backgrounds:Object.fromEntries(ids.map(id=>[id,{src:`stories/adventures/v1/${id}.svg`}]))},quiz:[],sources:isCity?[]:['https://movies.disney.com/robin-hood'],audio:{}};const r=compileStory(pack.script,pack.assets);if(r.errors.length)throw Error(JSON.stringify(r.errors));fs.writeFileSync(file,JSON.stringify(pack,null,2)+'\n')}
console.log('Built three new adventures without modifying released packages.')
