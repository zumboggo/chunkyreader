import CartoonActor,{shade} from './CartoonActor';
/** A reusable theatrical horse and the episode's own rider; never a replacement identity. */
export default function MountedActor({character,emotion,reduced,active,performanceKey}:{character:any;emotion:string;reduced:boolean;active:boolean;performanceKey:number}){
 const ink='#344048',coat='#ab967b',skin=character.rig.palette?.skin||'#eac09c';
 const outfit=character.rig.appearance?.outfit,tailored=['workshirt','cardigan','suit'].includes(outfit);
 const legFill=['tunic','robe'].includes(outfit)?skin:outfit==='teacher'?'#b6a183':tailored?shade(character.rig.palette?.shirt||'#b93f46',-.4):'#354459';
 const shoeFill=outfit==='uniform'||!outfit?'#faf2e7':'#65503d';
 return <svg className={`mounted-actor ${active&&!reduced?'galloping':''}`} viewBox="0 0 680 600" preserveAspectRatio="xMidYMax meet" role="img" aria-label={`${character.name} — mounted lance charge`}>
  <ellipse cx="300" cy="575" rx="208" ry="8" fill={ink} opacity=".16"/>
  <g className="horse-body" fill={coat} stroke={ink} strokeWidth="4" strokeLinejoin="round">
   <path d="M 145 345 Q 93 348 65 419 Q 83 421 94 399 Q 116 376 146 382" fill="#645c51"/>
   <g className="horse-leg horse-far"><path d="M 189 394 L 194 460 L 158 549 L 150 569 L 175 569 L 184 551 L 220 468 L 231 404 Z M 381 390 L 402 450 L 431 551 L 430 569 L 458 569 L 451 545 L 440 451 L 424 386 Z" fill="#8e7c65"/></g>
   <path d="M 142 345 Q 239 306 367 336 L 409 261 Q 437 218 471 243 L 496 275 L 530 289 Q 547 311 528 324 L 479 319 L 452 300 L 431 394 Q 408 425 351 426 L 220 427 Q 157 423 142 388 Z"/>
   <path d="M 441 242 L 437 209 L 453 231 M 461 237 L 469 207 L 477 249" fill={coat}/>
   <path d="M 427 256 Q 412 286 401 322 L 389 318 Q 401 256 433 233" fill="#645c51"/>
   <circle cx="481" cy="276" r="4" fill={ink}/><path d="M 520 308 L 525 311 M 474 266 Q 482 260 490 268" fill="none"/>
   <path d="M 471 257 L 473 316 L 510 321 M 470 285 L 527 296 M 478 310 Q 360 355 287 295" fill="none" stroke="#66523c" strokeWidth="5"/>
   <path d="M 224 331 Q 284 315 335 334 L 332 379 Q 276 401 225 370 Z" fill="#b25242"/>
   <path d="M 224 330 Q 280 346 333 329 L 338 344 Q 278 364 220 347 Z" fill="#654e3c"/>
   <g className="horse-leg horse-near"><path d="M 169 393 L 177 464 L 153 552 L 142 570 L 174 570 L 182 550 L 213 458 L 211 407 Z M 364 404 L 357 474 L 382 552 L 379 570 L 410 570 L 401 546 L 391 471 L 408 395 Z"/></g>
   <path d="M 145 564 H 174 M 381 564 H 408 M 430 564 H 456" stroke="#514b43" strokeWidth="10"/>
  </g>
  <g className="mounted-rider">
   <svg x="140" y="-15" width="240" height="600" overflow="visible"><CartoonActor character={character} emotion={emotion} rest="mounted-charge" prop="lance" response="mounted-charge" reduced={reduced} rider performanceKey={performanceKey}/></svg>
   <path data-rider-leg="true" d="M 244 394 L 281 417 L 267 478 L 284 483 L 304 411 L 268 384" fill={legFill} stroke={ink} strokeWidth="3" strokeLinejoin="round"/>
   <path d="M 267 473 L 282 478 L 283 488 L 257 488 L 256 480 Z" fill={shoeFill} stroke={ink} strokeWidth="3"/>
   <path d="M 270 371 L 270 489 Q 278 501 290 490 L 292 479" fill="none" stroke="#71604b" strokeWidth="3"/>
   <ellipse cx="225" cy="283" rx="31" ry="41" fill="#aa946d" stroke={ink} strokeWidth="4"/><ellipse cx="225" cy="283" rx="24" ry="33" fill="none" stroke="#d4c294" strokeWidth="3"/><circle cx="225" cy="283" r="8" fill="#d5dbd4" stroke={ink} strokeWidth="2"/>
  </g>
 </svg>;
}
