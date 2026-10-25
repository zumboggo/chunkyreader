export type Box={x:number;y:number;width:number;height:number};
export type Framing={scale:number;x:number;y:number};
export function unionBoxes(boxes:Box[]):Box|null{
 if(!boxes.length)return null;
 const x=Math.min(...boxes.map(b=>b.x)),y=Math.min(...boxes.map(b=>b.y));
 return {x,y,width:Math.max(...boxes.map(b=>b.x+b.width))-x,height:Math.max(...boxes.map(b=>b.y+b.height))-y};
}
/** Fit a safe subject rectangle while keeping the background covering the viewport. */
export function fitCamera(width:number,height:number,box:Box|null,maxScale=3.4):Framing{
 if(!box||width<=0||height<=0)return {scale:1,x:0,y:0};
 const scale=Math.max(1,Math.min(maxScale,width*.88/Math.max(1,box.width),height*.86/Math.max(1,box.height)));
 const clamp=(v:number,min:number)=>Math.max(min,Math.min(0,v));
 return {scale,x:clamp(width/2-(box.x+box.width/2)*scale,width*(1-scale)),y:clamp(height/2-(box.y+box.height/2)*scale,height*(1-scale))};
}
/** Untransformed world coordinates: stable during camera movement and limb acting. */
export function actorBounds(el:HTMLElement,shot:string,bodyDrop=0):Box{
 const svg=el.querySelector<SVGSVGElement>('.puppet-actor'),view=svg?.viewBox?.baseVal;
 const h=el.offsetHeight,w=el.offsetWidth;
 if(!view?.height||!view.width)return shot==='action'?{x:el.offsetLeft+w*.15,y:el.offsetTop,width:w*.7,height:h*.72}:{x:el.offsetLeft,y:el.offsetTop,width:w,height:h};
 const unit=Math.min(w/view.width,h/view.height),x=el.offsetLeft+(w-view.width*unit)/2,y=el.offsetTop+(h-view.height*unit)/2;
 if(shot==='close'||shot==='listener'||shot==='speaker'){
  let head={x:55,y:30,width:130,height:170};
  try{const b=el.querySelector<SVGGraphicsElement>('[data-emotion-face]')?.getBBox();if(b&&b.width>0&&b.height>0)head=b;}catch{/* Legacy/hidden SVG: stable head fallback. */}
  return {x:x+(head.x-22)*unit,y:y+(Math.max(0,head.y-22)+bodyDrop)*unit,width:(head.width+44)*unit,height:(head.height+115)*unit};
 }
 if(shot==='medium'||shot==='two')return {x:x+22*unit,y:y+(12+bodyDrop)*unit,width:196*unit,height:390*unit};
 // Action coverage keeps heads, raised wrists and the blade, with a tighter waist-up crop.
 if(shot==='action')return {x:x-28*unit,y:y-12*unit,width:296*unit,height:432*unit};
 // Full-body fallback.
 return {x:x-28*unit,y:y-12*unit,width:296*unit,height:612*unit};
}
