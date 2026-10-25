/** Closed, versioned vocabulary shared by parser, renderer, studio and authoring tools. */
export const ACTING_VERSION=7;
export const CHARACTER_OPTIONS={age:['teen','adult','elder'],hair:['layered','side-part','long','bob','cropped','tousled','bun','swept','ponytail'],glasses:['none','round'],outfit:['uniform','teacher','tunic','robe','workshirt','cardigan','suit'],face:['default','oval','round','angular','lean','broad','scrappy','spirited'],eyes:['default','keen','gentle','narrow'],facialHair:['none','full']};
export const EMOTIONS=['neutral','happy','worried','sad','angry','surprised','curious','confused','skeptical','embarrassed','relieved','determined','shocked','laughing','excited','scared','frustrated','proud','pleading','disappointed'];
export const PROPS=['none','phone','sword','bow','lance','rubber-duck','pool-noodle'];
export const RESTS=['arms-crossed','kneeling','crouched','sheltered','relaxed','attentive','guarded','downcast'];
export const TALKS=['cross-arms','phone-talk','phone-shout','explain','reassure','question','insist','hesitant','celebrate','shock','laugh','rage','excited','scared','facepalm','proud','plead','disappointed'];
export const RESPONSES=['wince','support','brace','cross-arms','lance-threat','kneel','crouch','duck','cover-head','phone-talk','phone-shout','sword-strike','draw-bow','cast-beam','nod','shake-head','shrug','point','wave','recoil','laugh','sigh','bow','cheer','reach','cower','stumble','strike','block','dodge','shock','rage','excited','scared','facepalm','proud','plead','disappointed'];
/** Explicit outcomes: choreography never rolls a result or changes the literary plot. */
export const ACTIONS={
 'mounted-charge':{paired:false,actor:'mounted-charge',prop:'lance',description:'Ride a visible horse forward with a levelled lance in one finite charge. The horse is shown for this action caption only; no impact or fall is implied.'},
 wince:{paired:false,actor:'wince',description:'Draw one hand to the ribs and bend slightly with a pained flinch. No recovery or injury outcome is implied.'},
 steady:{paired:true,actor:'support',target:'brace',prop:'none',description:'Step close and offer a supporting arm as the other character braces. A mimed helping gesture; narrate any rise or remount separately.'},
 'cross-arms':{paired:false,actor:'cross-arms',prop:'none',description:'Fold both arms tightly across the chest. Follow with rest Actor arms-crossed to stay folded during speech.'},
 'lance-threat':{paired:true,actor:'lance-threat',target:'cower',prop:'lance',description:'Level a visible lance at another character, who draws back. No thrust or hit; the lance stays held.'},
 kneel:{paired:false,actor:'kneel',description:'Lower onto one knee, pause, then rise. Use rest Actor kneeling to remain down.'},
 crouch:{paired:false,actor:'crouch',description:'Bend both knees into a low crouch, then rise. Use rest Actor crouched to stay low.'},
 duck:{paired:false,actor:'duck',description:'Drop the head and bend the knees beneath an incoming threat, then recover.'},
 'cover-head':{paired:false,actor:'cover-head',description:'Crouch with both hands shielding the head. Use rest Actor sheltered to hold the pose.'},
 'attack-ducked':{paired:true,actor:'strike',target:'duck',description:'A strike passes over the target as they duck; no hit lands.'},
 'phone-talk':{paired:false,actor:'phone-talk',prop:'phone',description:'Hold a visible phone at the ear and talk. The phone stays equipped until prop Actor none.'},
 'phone-shout':{paired:false,actor:'phone-shout',prop:'phone',description:'Keep the phone at the ear while leaning forward and emphasizing with the free hand.'},
 'sword-strike':{paired:true,actor:'sword-strike',target:'recoil',prop:'sword',description:'Strike with a visible sword; the target recoils without gore.'},
 'sword-blocked':{paired:true,actor:'sword-strike',target:'block',prop:'sword',description:'A sword strike meets the target’s guard; no hit lands.'},
 'sword-dodged':{paired:true,actor:'sword-strike',target:'dodge',prop:'sword',description:'The target dodges the sword strike.'},
 'shoot-arrow':{paired:true,actor:'draw-bow',target:'recoil',prop:'bow',description:'Draw the bowstring and release a visible arrow toward the target, who recoils.'},
 'magic-beam':{paired:true,actor:'cast-beam',target:'recoil',prop:'none',description:'Extend an empty palm and cast a finite beam toward the target, who recoils.'},
 attack:{paired:true,actor:'strike',target:'recoil',description:'A stylized lunge and strike; the other character recoils.'},
 'attack-blocked':{paired:true,actor:'strike',target:'block',description:'A strike meets a raised guard; both return to their marks.'},
 'attack-dodged':{paired:true,actor:'strike',target:'dodge',description:'A strike misses as the other character leans away.'},
 challenge:{paired:true,actor:'point',target:'shrug',description:'One character challenges; the other answers with a shrug.'},
 give:{paired:true,actor:'reach',target:'reach',description:'Both reach for a mimed handoff; describe the object in the caption.'},
 bow:{paired:false,actor:'bow',description:'A brief formal bow.'},
 cheer:{paired:false,actor:'cheer',description:'An enthusiastic raised-arm celebration.'},
 reach:{paired:false,actor:'reach',description:'Reach out to inspect or take something described in the caption.'},
 cower:{paired:false,actor:'cower',description:'Cover the head and draw back.'},
 stumble:{paired:false,actor:'stumble',description:'Lose balance, catch it, and return upright.'},
};
export const ACTION_DURATION=2200;
export const MOVES=['enter','exit','left','center','right','turn','nod','shake','bounce','recoil'];
export const EFFECTS=['fade','closeup','shake','magic'];
export const CAMERAS=['auto','wide','medium','close','two','action','speaker','listener'];
export const RIG_PARTS=['torso','pelvis','head','leftUpperArm','leftForearm','leftHand','rightUpperArm','rightForearm','rightHand','leftThigh','leftShin','rightThigh','rightShin'];
export const AUTO_ACTING={
 shocked:{rest:'attentive',talk:'shock'},laughing:{rest:'relaxed',talk:'laugh'},
 excited:{rest:'attentive',talk:'excited'},scared:{rest:'guarded',talk:'scared'},
 frustrated:{rest:'downcast',talk:'facepalm'},proud:{rest:'attentive',talk:'proud'},
 pleading:{rest:'guarded',talk:'plead'},disappointed:{rest:'downcast',talk:'disappointed'},
 neutral:{rest:'relaxed',talk:'explain'},happy:{rest:'relaxed',talk:'celebrate'},
 worried:{rest:'guarded',talk:'hesitant'},sad:{rest:'downcast',talk:'hesitant'},
 angry:{rest:'guarded',talk:'rage'},surprised:{rest:'attentive',talk:'question'},
 curious:{rest:'attentive',talk:'question'},confused:{rest:'attentive',talk:'question'},
 skeptical:{rest:'guarded',talk:'question'},embarrassed:{rest:'downcast',talk:'hesitant'},
 relieved:{rest:'relaxed',talk:'reassure'},determined:{rest:'attentive',talk:'insist'},
};
// Joint angles in degrees. Every preset uses the same anatomy; skins supply only artwork.
const kneeling={bodyDrop:115,leftFootX:89,rightFootX:16,leftBend:-1,rightBend:-1,head:8,leftForearm:30,rightForearm:-35};
const crouched={bodyDrop:80,leftFootX:18,rightFootX:-18,leftBend:-1,rightBend:1,torso:10,head:8,leftForearm:40,rightForearm:-40};
const sheltered={...crouched,bodyDrop:95,torso:12,head:18,leftUpperArm:-160,leftForearm:-20,rightUpperArm:160,rightForearm:20};
const crossed={head:7,torso:3,leftUpperArm:-40,leftForearm:-85,leftHand:15,rightUpperArm:40,rightForearm:90,rightHand:-15};
export const POSES={
 'mounted-charge':{torso:9,head:-4,rightUpperArm:-75,rightForearm:-15,rightHand:180,leftUpperArm:-10,leftForearm:-70},
 wince:{torso:14,head:13,leftUpperArm:12,leftForearm:-90,rightUpperArm:5,rightForearm:-30},
 support:{torso:8,head:5,rightUpperArm:-55,rightForearm:-25,leftForearm:25},
 brace:{torso:10,head:12,leftUpperArm:-20,leftForearm:-35,rightForearm:30},
 'arms-crossed':crossed,'cross-arms':crossed,
 'lance-hold':{rightUpperArm:-15,rightForearm:-25,rightHand:40},
 'lance-threat':{torso:5,rightUpperArm:-75,rightForearm:-15,rightHand:180,leftForearm:25},
 kneeling,crouched,sheltered,kneel:kneeling,crouch:crouched,
 duck:{...crouched,bodyDrop:105,torso:22,head:20,leftForearm:75,rightForearm:-75},
 'cover-head':sheltered,
 'phone-hold':{rightUpperArm:100,rightForearm:135,rightHand:125},
 'phone-talk':{head:3,leftUpperArm:20,leftForearm:48},
 'phone-shout':{torso:8,head:4,leftUpperArm:35,leftForearm:-65},
 'sword-hold':{rightUpperArm:-18,rightForearm:-30,rightHand:48},
 'sword-strike':{torso:6,rightUpperArm:-70,rightForearm:-15,rightHand:85,leftForearm:35},
 'bow-hold':{rightUpperArm:-36,rightForearm:-25,rightHand:61,leftUpperArm:-15,leftForearm:-55},
 'draw-bow':{rightUpperArm:-78,rightForearm:-12,rightHand:90,leftUpperArm:-60,leftForearm:-75},
 'cast-beam':{rightUpperArm:-78,rightForearm:-12,rightHand:0,leftForearm:40},
 bow:{torso:16,head:18,leftUpperArm:-6,rightUpperArm:6},
 cheer:{head:-9,leftUpperArm:100,leftForearm:35,rightUpperArm:-100,rightForearm:-35},
 reach:{head:4,rightUpperArm:-55,rightForearm:-20},
 cower:{torso:-10,head:12,leftUpperArm:-30,leftForearm:-135,rightUpperArm:30,rightForearm:135},
 stumble:{torso:10,head:-10,leftUpperArm:65,leftForearm:20,rightUpperArm:-65,rightForearm:-20},
 strike:{torso:8,head:-5,rightUpperArm:-80,rightForearm:-10,rightHand:0,leftForearm:40},
 block:{torso:-4,head:4,leftUpperArm:-35,leftForearm:-125,rightUpperArm:35,rightForearm:125},
 dodge:{torso:-15,head:10,leftForearm:25,rightForearm:-25},
 relaxed:{},attentive:{head:-3,leftForearm:8,rightForearm:-8},
 guarded:{head:3,leftUpperArm:-12,leftForearm:-42,rightUpperArm:12,rightForearm:42},
 downcast:{head:8,torso:2,leftUpperArm:3,rightUpperArm:-3},
 explain:{head:-3,rightUpperArm:-24,rightForearm:-62,rightHand:-12},
 reassure:{head:-5,leftUpperArm:12,leftForearm:45,rightUpperArm:-15,rightForearm:-44},
 question:{head:7,leftUpperArm:22,leftForearm:63,rightUpperArm:-22,rightForearm:-63},
 insist:{head:-2,rightUpperArm:-30,rightForearm:-86,rightHand:12},
 hesitant:{head:8,leftUpperArm:8,leftForearm:30,rightForearm:-12},
 celebrate:{head:-5,leftUpperArm:48,leftForearm:75,rightUpperArm:-48,rightForearm:-75},
 nod:{head:12},'shake-head':{head:-10},
 shrug:{head:7,leftUpperArm:30,leftForearm:60,rightUpperArm:-30,rightForearm:-60},
 point:{head:-5,rightUpperArm:-70,rightForearm:-15,rightHand:0},
 wave:{rightUpperArm:-55,rightForearm:-110,rightHand:-15},
 recoil:{torso:-5,head:7,leftUpperArm:20,leftForearm:80,rightUpperArm:-20,rightForearm:-80},
 shock:{torso:-8,head:-7,leftUpperArm:-100,leftForearm:-115,rightUpperArm:100,rightForearm:115,leftHand:20,rightHand:-20},
 laugh:{head:-28,torso:-14,leftUpperArm:15,leftForearm:-95,rightUpperArm:-15,rightForearm:95},
 rage:{torso:10,head:8,leftUpperArm:28,leftForearm:-75,rightUpperArm:-28,rightForearm:75},
 excited:{head:-12,leftUpperArm:130,leftForearm:25,rightUpperArm:-130,rightForearm:-25},
 scared:{torso:-15,head:10,leftUpperArm:-55,leftForearm:-125,rightUpperArm:55,rightForearm:125},
 facepalm:{torso:8,head:15,rightUpperArm:88,rightForearm:140,rightHand:-20,leftForearm:12},
 proud:{torso:-8,head:-14,leftUpperArm:45,leftForearm:-110,rightUpperArm:-45,rightForearm:110},
 plead:{torso:8,head:-8,leftUpperArm:-25,leftForearm:-110,rightUpperArm:25,rightForearm:110},
 disappointed:{torso:12,head:22,leftUpperArm:15,leftForearm:10,rightUpperArm:-15,rightForearm:-10},
 sigh:{head:9,torso:3,leftUpperArm:5,rightUpperArm:-5},
};
export const ACTING_DESCRIPTIONS={
 support:'Extend an arm to offer support.',brace:'Lean forward and brace with bent arms.',
 'arms-crossed':'Keep both arms firmly folded across the chest, including while speaking. Pair with angry emotion for a sustained angry stance.',
 kneeling:'Remain on one knee until the resting pose changes.',crouched:'Remain low with bent knees.',sheltered:'Stay crouched with hands shielding the head.',
 shock:'Both hands fly to the cheeks as the eyes widen and mouth opens.',rage:'Clench both fists and swing the arms in two frustrated emphases.',excited:'Throw both hands overhead with an eager bounce.',scared:'Recoil with open hands shielding the face.',facepalm:'Bring one hand over the face and bow the head.',proud:'Plant hands at the waist and lift the chin.',plead:'Bring both hands together at the chest and lean forward.',disappointed:'Let both arms fall as the head and shoulders sink.',
 ...Object.fromEntries(Object.entries(ACTIONS).filter(([,a])=>!a.paired).map(([id,a])=>[id,a.description])),
 strike:'Extend the leading arm in a stylized strike.',block:'Raise both forearms to guard.',dodge:'Lean away and recover balance.',
 relaxed:'Soft breathing, occasional blink, shoulders at ease.',attentive:'Slight head tilt and alert listening.',guarded:'Arms held nearer the body; restrained movement.',downcast:'Lowered head and quieter breathing.',
 explain:'One open hand presents an idea.',reassure:'Gentle open hands and a sympathetic tilt.',question:'Both hands open with a questioning head tilt.',insist:'A firm single-hand emphasis.',hesitant:'Small hand movement and a tentative tilt.',celebrate:'Open arms and an upbeat emphasis.',
 nod:'One head nod, then return to rest.','shake-head':'A small side-to-side head motion.',shrug:'Raised forearms and a questioning tilt.',point:'Extend an arm toward something.',wave:'Lift a forearm and wave the hand.',recoil:'Lean back with raised forearms.',laugh:'Lean back, tip the head up and hold the belly through a burst of laughter.',sigh:'Head and shoulders settle downward.',
};
export function packageAssetEntries(pack){return [...Object.values(pack.assets?.backgrounds||{}),...Object.values(pack.assets?.characters||{}).flatMap(c=>[...Object.values(c.expressions||{}),...Object.values(c.rig?.parts||{}),...(c.rig?.head?[c.rig.head]:[])]),...(pack.assets?.music?[pack.assets.music]:[])];}
export function validateRig(rig){
 if(rig?.version===2&&rig.preset==='cartoon-v1'){if(rig.style!==undefined&&!['manga','simple'].includes(rig.style))return 'Cartoon style must be simple or manga';if(!rig.palette||Object.keys(rig.palette).some(k=>!['skin','hair','shirt','glasses','beard','trim'].includes(k))||Object.values(rig.palette).some(v=>typeof v!=='string'||!/^#[0-9a-fA-F]{6}$/.test(v)))return 'Cartoon palette accepts only skin, hair, shirt, glasses, beard and trim hex colours';if(rig.appearance!==undefined&&(typeof rig.appearance!=='object'||rig.appearance===null||Array.isArray(rig.appearance)||Object.entries(rig.appearance).some(([k,v])=>!Object.hasOwn(CHARACTER_OPTIONS,k)||!CHARACTER_OPTIONS[k].includes(v))))return 'Cartoon appearance must use the shared age, hair, glasses, outfit, face, eyes and facialHair options';if(rig.parts)return 'Cartoon rigs use continuous vector shapes, not image parts';
  if(rig.finish!==undefined&&!['polished','hybrid'].includes(rig.finish))return 'Character finish must be polished or hybrid';
  if(rig.finish==='hybrid'&&!rig.head)return 'Hybrid characters require an embedded head';
  if(rig.head!==undefined){
   const h=rig.head;
   if(rig.finish!=='hybrid'||!h||typeof h!=='object'||Array.isArray(h)||Object.keys(h).some(k=>!['src','frame'].includes(k))||typeof h.src!=='string'||!/^data:image\/webp;base64,[A-Za-z0-9+/]+=*$/.test(h.src))return 'Hybrid heads must be embedded WebP images';
   if(!Array.isArray(h.frame)||h.frame.length!==4||h.frame.some(n=>typeof n!=='number'||!Number.isFinite(n))||h.frame[0]<-40||h.frame[0]>240||h.frame[1]<-40||h.frame[1]>240||h.frame[2]<40||h.frame[2]>240||h.frame[3]<40||h.frame[3]>260)return 'Hybrid head frame must have bounded x, y, width and height';
  }
  return null;}
 if(!rig||rig.version!==1||rig.preset!=='teen-v1')return 'Use rig version 1 and the teen-v1 preset';
 if(!rig.parts||RIG_PARTS.some(k=>!rig.parts[k]?.src)||Object.keys(rig.parts).some(k=>!RIG_PARTS.includes(k)))return 'Rig requires exactly the 13 standard body parts';
 if(rig.faceSkin&&!/^#[0-9a-fA-F]{6}$/.test(rig.faceSkin))return 'Rig faceSkin must be a six-digit hex colour';
 return null;
}

/** Decoded payload plus metadata; shared so studio and backend enforce the same budget. */
export function packageContentBytes(pack){const copy=structuredClone(pack);let bytes=0;for(const a of packageAssetEntries(copy)){const data=String(a.src||'').split(',')[1]||'';bytes+=Math.floor(data.length*3/4)-(data.endsWith('==')?2:data.endsWith('=')?1:0);a.src='';}return bytes+new TextEncoder().encode(JSON.stringify(copy)).length;}
