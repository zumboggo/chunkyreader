import fs from 'node:fs'
import {compileStory} from '../../src/story2/engine/story-engine.js'
const root='public/stories/adventures/v1'
const cast=JSON.parse(fs.readFileSync(`${root}/leahs-big-day-v1.json`)).assets.characters
const stage=scene=>`scene ${scene}\nshow Anna happy left\nshow Sarah curious right\nshow Leah curious center\ncamera wide cut`
const defs=[{
 id:'the-box-boat-v1',title:'The Box Boat',description:'A box, a toy, and room for us all.',scene:'family-box-boat',focusWords:['box','boat','rug','toy','sit'],script:`story 2
variable bear = false hidden
${stage('family-box-boat')}
I: Mum made a box boat. Leah sits by Mum.
Anna [happy]: Let us sail on the rug!
Sarah [curious]: A toy can come, too.
choice toy
option bear "Take the bear." -> bear ; bear = true
option pup "Take the pup." -> pup
label bear
Sarah [happy]: A bear on a boat!
goto room
label pup
Sarah [happy]: A pup on a boat!
goto room
label room
Anna [worried]: Oh! No room for us all.
express Leah sad
I: Leah pats the box.
choice space
option rug "Sit on the rug." -> rug
option toy "Move the toy." -> move
label rug
react Anna crouch
Anna [happy]: The rug is our boat, too!
goto join
label move
react Sarah point
Sarah [happy]: The toy can sit by the box.
goto join
label join
camera listener Leah cut
I: Mum helps Leah join us. She pats our boat.
Anna [happy]: Room for you, Leah!
camera wide cut
choice trip
option sea "Go to sea." -> sea
option home "Go back home." -> home
label sea
Sarah [happy]: A big fish! Wave to it!
goto endtoy
label home
Sarah [happy]: Home! Time for a cup of tea!
goto endtoy
label endtoy
if bear == true -> bearend else pupend
label bearend
Anna [happy]: Our bear had a big day.
goto done
label pupend
Anna [happy]: Our pup had a big day.
goto done
label done
I: Leah pats the rug. One more trip?
end`
},{id:'the-red-hen-v1',title:'The Red Hen',description:'A shy hen needs a calm hello.',scene:'family-red-hen',focusWords:['hen','red','sit','seed','wave'],script:`story 2
variable seed = false hidden
${stage('family-red-hen')}
I: Mum holds Leah. We see a red hen.
Sarah [happy]: Come here, hen!
I: The hen hops away.
Anna [curious]: Let us be calm.
choice calm
option sit "Sit here." -> sit
option back "Step back." -> back
label sit
react Sarah crouch
Sarah [curious]: I sit. I can wait.
goto near
label back
Anna [happy]: More room for you, hen.
goto near
label near
I: The hen peeks at us.
choice kind
option seed "Ask Mum for seed." -> seed ; seed = true
option hum "Hum a soft tune." -> hum
label seed
I: Mum puts seed by the hen.
Sarah [happy]: Peck, peck! A nice meal!
goto wave
label hum
Anna [happy]: A soft tune for you.
I: The hen takes a little hop.
goto wave
label wave
express Leah happy
camera listener Leah cut
I: Leah waves. The hen tilts her head.
Sarah [happy]: She sees you, Leah!
camera wide cut
choice bye
option wave "Wave bye." -> bye
option nod "Give a nod." -> nod
label bye
react Sarah wave
Sarah [happy]: Bye, hen! See you soon!
goto finish
label nod
react Anna nod
Anna [happy]: A little nod. Off you go!
goto finish
label finish
if seed == true -> seedend else tuneend
label seedend
Sarah [happy]: A meal and a new pal!
goto done
label tuneend
Sarah [happy]: A tune and a new pal!
goto done
label done
Anna [happy]: We let the hen come to us.
end`
},{id:'a-tent-for-us-v1',title:'A Tent for Us',description:'A little tent. A big welcome for Leah.',scene:'family-tent',focusWords:['tent','mat','lamp','book','hug'],script:`story 2
variable book = false hidden
${stage('family-tent')}
I: Mum is here. Our tent is up!
Sarah [happy]: A den for us!
Anna [curious]: What goes in our den?
choice bring
option book "A book." -> book ; book = true
option bear "A bear." -> bear
label book
Anna [happy]: A book of pets!
goto dark
label bear
Sarah [happy]: Our bear can come in!
goto dark
label dark
express Leah sad
I: Leah peeks in. It is dim. She turns to Mum.
Anna [curious]: We can help.
choice light
option flap "Open the tent." -> open
option lamp "Ask Mum for a lamp." -> lamp
label open
react Anna reach
Anna [happy]: Look! A wide way in.
goto safe
label lamp
I: Mum puts a lamp up high.
Sarah [happy]: A warm light. We can see!
goto safe
label safe
camera listener Leah cut
express Leah happy
I: Mum sits with Leah by the tent.
Anna [happy]: You can stay here with us.
camera wide cut
choice play
option peek "Play peek-a-boo." -> peek
option hug "Have a hug." -> hug
label peek
react Sarah wave
Sarah [happy]: Peek-a-boo! I see you!
goto last
label hug
I: We sit by Mum. One big hug!
goto last
label last
if book == true -> bookend else bearend
label bookend
Anna [happy]: A book for us all. Turn a page!
goto done
label bearend
Sarah [happy]: A hug for our bear, too!
goto done
label done
I: Leah pats the mat. Our den is for us all.
end`
}]
for(const d of defs){const file=`${root}/${d.id}.json`;if(fs.existsSync(file))throw Error(`Refusing overwrite ${file}`);const image=`stories/adventures/v1/${d.scene}.webp`;const p={format:2,id:d.id,title:d.title,description:d.description,version:1,cover:image,castLabel:'Anna, Sarah & Leah',profile:'growing-reader',sceneLayout:'full',intro:{kind:'still',src:image,alt:d.description},notice:'A make-believe family adventure with Anna, Sarah and one-year-old Leah. Read and choose, or listen together.',focusWords:d.focusWords,script:d.script,assets:{characters:cast,backgrounds:{[d.scene]:{src:image}}},quiz:[],sources:[],audio:{}};const r=compileStory(p.script,p.assets);if(r.errors.length)throw Error(JSON.stringify(r.errors));fs.writeFileSync(file,JSON.stringify(p,null,2)+'\n')}
