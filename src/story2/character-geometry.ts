/** Rounded elbow joins without a rubber-hose spline; shared by every skin. */
export function armGeometry(side:'left'|'right',upperDegrees:number,forearmDegrees:number){
 const sign=side==='left'?-1:1,x=120+sign*44,y=213,a=upperDegrees*Math.PI/180,b=a+forearmDegrees*Math.PI/180;
 const ex=x-Math.sin(a)*58,ey=y+Math.cos(a)*58,wx=ex-Math.sin(b)*57,wy=ey+Math.cos(b)*57;
 const before={x:ex+Math.sin(a)*10,y:ey-Math.cos(a)*10},after={x:ex-Math.sin(b)*10,y:ey+Math.cos(b)*10};
 return {x,y,ex,ey,wx,wy,a,b,path:`M ${x} ${y} L ${before.x} ${before.y} Q ${ex} ${ey} ${after.x} ${after.y} L ${wx} ${wy}`};
}
export const FACE_PATHS:Record<string,string>={
 lean:'M 83 88 Q 120 65 157 88 L 153 127 Q 149 138 144 145 L 129 166 Q 120 173 111 166 L 96 145 Q 91 136 87 124 Z',
 broad:'M 80 88 Q 120 61 160 88 L 158 137 L 149 162 Q 120 180 91 162 L 82 137 Z',
 oval:'M 82 88 Q 120 62 158 88 L 156 132 Q 153 157 130 172 Q 120 178 110 172 Q 87 157 84 132 Z',
 round:'M 82 88 Q 120 62 158 88 L 157 132 Q 156 157 139 167 Q 120 178 101 167 Q 84 157 83 132 Z',
 angular:'M 82 88 Q 120 62 158 88 L 156 135 L 145 155 L 128 172 Q 120 177 112 172 L 95 155 L 84 135 Z',
};

export function heldPropPose(prop?:string){return prop==='lance'?'lance-hold':['phone','rubber-duck'].includes(prop||'')?'phone-hold':['sword','pool-noodle'].includes(prop||'')?'sword-hold':prop==='bow'?'bow-hold':'relaxed';}

/** Two fixed-length leg segments solve toward a grounded ankle. */
export function legGeometry(side:'left'|'right',drop:number,footOffset=0,bend=side==='left'?-1:1,footLift=0){
 const x=side==='left'?98:142,y=348+Math.max(0,drop),fx=x+footOffset,fy=566-Math.max(0,Math.min(30,footLift));
 const dx=fx-x,dy=fy-y,d=Math.max(.001,Math.min(218,Math.hypot(dx,dy))),half=d/2;
 const h=Math.sqrt(Math.max(0,109*109-half*half)),sign=bend<0?-1:1;
 const kx=x+dx/2+sign*dy/d*h,ky=y+dy/2-sign*dx/d*h;
 return {x,y,kx,ky,fx,fy,path:`M ${x} ${y} L ${kx} ${ky} L ${fx} ${fy}`};
}
