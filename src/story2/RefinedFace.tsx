/** Option-B portrait geometry. Expression layers share the parent's finite motion controller. */
type Props={turn?:number;gazeX?:number;gazeY?:number;face:string;hairStyle:string;skin:string;hair:string;skinBase:string;hairBase:string;id:string;emotion:string;blink:boolean;mouth:number;startled:boolean;laughing:boolean;firm:boolean;worried:boolean;reduced:boolean;tilt:number};
const tone=(hex:string,t:number)=>'#'+[1,3,5].map(i=>Math.round(parseInt(hex.slice(i,i+2),16)*(1-Math.abs(t))+(t<0?0:255)*Math.abs(t)).toString(16).padStart(2,'0')).join('');
export default function RefinedFace({gazeX=0,gazeY=0,turn=0,face,hairStyle,skin,hair,skinBase,hairBase,id,emotion,blink,mouth,startled,laughing,firm,worried,reduced,tilt}:Props){
 const gazeStyle={transform:`translate(${gazeX}px, ${gazeY}px)`,transition:reduced?'none':'transform 240ms ease-out'};
 const featureStyle={transform:`translateX(${turn*6}px)`,transition:reduced?'none':'transform 280ms ease-out'};
 const soft=face==='spirited',pony=hairStyle==='ponytail',warm=['happy','relieved'].includes(emotion),eager=['excited','proud'].includes(emotion),smile=warm||eager||laughing;
 const ink=tone(hairBase,-.28),shadow=tone(skinBase,-.25),light=tone(skinBase,.32);
 const outline=soft?'M 82 89 Q 118 62 157 88 L 155 123 Q 153 139 144 149 L 129 166 Q 120 174 111 168 L 96 154 Q 85 143 83 126 Z':'M 82 87 Q 120 63 158 88 L 155 121 L 149 136 L 145 148 L 129 168 Q 121 174 111 168 L 97 155 L 90 140 L 85 122 Z';
 const eye=(x:number)=>startled?`M ${x-10} 121 Q ${x} 107 ${x+10} 120 Q ${x} 136 ${x-10} 121 Z`:firm?`M ${x-10} 119 Q ${x} 117 ${x+10} 121 Q ${x} 130 ${x-10} 119 Z`:warm?`M ${x-10} 121 Q ${x} 113 ${x+10} 120 Q ${x} 127 ${x-10} 121 Z`:`M ${x-10} 121 Q ${x} ${soft?111:113} ${x+10} 120 Q ${x} ${soft?133:130} ${x-10} 121 Z`;
 return <g data-refined-face={face} data-expression={warm?'family-warmth':eager?'reward':emotion} strokeLinejoin="round" strokeLinecap="round">
 <defs><clipPath id={`${id}-face-clip`}><path d={outline}/></clipPath>{[102,138].map(x=><clipPath key={x} id={`${id}-eye-${x}`}><path d={eye(x)}/></clipPath>)}</defs>
 {pony&&<g data-ponytail="true" transform={`rotate(${-5+tilt*.15} 156 118)`} style={{transition:reduced?'none':'transform 160ms ease-out'}}><path d="M 149 103 Q 177 107 174 140 Q 169 163 184 191 L 174 187 L 180 203 Q 153 194 150 177 Q 143 156 149 138 Z" fill={hair} stroke={ink} strokeWidth="1.5"/><path d="M 162 125 Q 172 155 163 173 L 173 190 M 155 136 Q 153 160 160 178" fill="none" stroke={tone(hairBase,.16)} strokeWidth="1.4"/><path d="M 153 117 L 168 122" stroke="#695344" strokeWidth="4"/></g>}
 <path d={pony?'M 78 126 Q 65 95 79 73 Q 87 53 113 54 Q 140 42 156 67 Q 172 76 165 110 L 159 137 Z':'M 77 126 L 69 106 L 74 100 L 66 96 L 74 79 L 68 79 L 84 63 L 79 57 L 100 57 L 115 43 L 116 53 L 138 46 L 134 54 L 155 57 L 150 63 L 171 75 L 163 83 L 173 96 L 164 99 L 168 111 L 160 110 L 158 133 Z'} fill={hair} stroke={ink} strokeWidth="1.7"/>
 {[81,159].map(x=><g key={x}><path d={`M ${x} 111 Q ${x+(x<120?-11:11)} 107 ${x+(x<120?-7:7)} 126 Q ${x} 140 ${x+(x<120?5:-5)} 128 Z`} fill={skin} stroke={ink} strokeWidth="1.3"/><path d={`M ${x} 116 Q ${x+(x<120?-5:5)} 115 ${x} 128`} fill="none" stroke={shadow} strokeWidth="1.3"/></g>)}
 <path d={outline} fill={skin} stroke={ink} strokeWidth="1.8"/>
 <g clipPath={`url(#${id}-face-clip)`}>
 <path d="M 78 90 Q 95 112 88 134 L 101 153 L 116 170 L 100 167 L 79 142 Z" fill={shadow} opacity=".38"/>
 <path d="M 147 93 L 159 88 L 159 134 L 146 150 L 129 169 L 122 169 L 142 146 L 142 133 L 151 120 Z" fill={shadow} opacity={soft?.24:.43}/>
 <path d="M 96 128 L 108 132 L 100 140 L 93 140 L 91 147 L 88 130 Z M 146 128 L 133 133 L 142 139 L 145 146 L 151 132 Z" fill={shadow} opacity={warm?.14:soft?.17:.38}/>
 <path d="M 110 104 L 120 100 L 122 122 L 117 136 L 113 133 L 117 120 Z" fill={light} opacity=".48"/>
 <path d="M 122 119 L 120 136 L 129 135 L 125 131 Z" fill={shadow} opacity=".38"/>
 <path d="M 106 156 Q 119 162 134 155 L 126 166 L 115 167 Z" fill={light} opacity=".22"/>
 {(warm||emotion==='embarrassed')&&<g data-blush={emotion} fill="#c57968" opacity={emotion==='embarrassed'?.34:.14}><ellipse cx="99" cy="136" rx="11" ry="5"/><ellipse cx="142" cy="136" rx="10" ry="5"/></g>}
 <path d="M 81 90 Q 120 73 158 87 L 151 106 L 144 94 L 129 109 L 132 94 L 113 111 L 116 94 L 97 109 L 100 92 L 85 113 Z" fill={shadow} opacity=".22"/>
 </g>
 <g style={featureStyle} data-feature="brows" fill="none" stroke={ink} strokeWidth={soft?2:2.8}>
 <path d={startled?'M 92 105 Q 101 98 111 104 M 130 104 Q 140 98 149 105':worried?'M 92 111 Q 103 111 111 105 M 130 105 Q 139 111 149 111':firm?'M 92 107 Q 102 107 111 112 M 130 112 Q 140 107 149 107':warm?'M 92 110 Q 102 105 111 109 M 130 109 Q 139 105 149 109':eager?'M 92 107 Q 101 101 111 106 M 130 108 Q 140 103 149 107':'M 92 110 Q 102 104 111 109 M 130 110 Q 140 106 149 108'}/>
 </g>
 {[102,138].map(x=><g key={x} data-feature="eye" style={{transform:`translateX(${turn*6}px) scaleX(${(x<120)===(turn>0)?1-Math.abs(turn)*.24:1})`,transformOrigin:`${x}px 122px`,transition:reduced?'none':'transform 280ms ease-out'}}>
 {blink||laughing?<path d={`M ${x-9} 122 Q ${x} ${smile?115:127} ${x+9} 121`} fill="none" stroke={ink} strokeWidth="1.8"/>:<>
 <path d={eye(x)} fill="#f8eee1" stroke={ink} strokeWidth="1.15"/>
 <g clipPath={`url(#${id}-eye-${x})`}><ellipse style={gazeStyle} data-gaze-pupil="true" cx={x+1} cy="121" rx={soft?4.5:4} ry={startled?6:5} fill="#71503a"/><ellipse style={gazeStyle} data-gaze-pupil="true" cx={x+1} cy="121" rx="2.3" ry="3.8" fill={ink}/><circle style={gazeStyle} data-gaze-pupil="true" cx={x-.5} cy="119" r="1.2" fill="#fff9ee"/><path d={`M ${x-10} 116 Q ${x} 111 ${x+10} 117`} fill="none" stroke={ink} strokeWidth="5" opacity=".25"/></g>
 <path d={`M ${x-10} ${firm?119:121} Q ${x} ${firm?117:warm?113:soft?111:113} ${x+10} 120`} fill="none" stroke={ink} strokeWidth={soft?2:1.8}/>
 </>}
 <path d={`M ${x-7} ${warm?129:132} Q ${x} ${warm?127:134} ${x+7} ${warm?129:131}`} fill="none" stroke={shadow} strokeWidth=".9" opacity={soft?.4:.7}/>
 </g>)}
 <g style={featureStyle}><path d="M 117 135 Q 120 137 124 134 M 115 137 L 113 136" fill="none" stroke={tone(skinBase,-.4)} strokeWidth="1"/>
 <g transform={soft?"translate(120 148) scale(.85) translate(-120 -148)":undefined} data-mouth={mouth} data-smile={smile?'broad':'none'} stroke={tone(skinBase,-.56)} strokeWidth="1.2">
 {laughing?<><path d="M 106 145 Q 120 151 134 144 Q 133 163 120 164 Q 108 161 106 145 Z" fill="#70463f"/><path d="M 109 147 Q 121 152 131 146 L 130 151 Q 120 156 110 151 Z" fill="#fff3dc" stroke="none"/></>:smile?<>
 <path d={mouth?'M 106 146 Q 120 152 134 143 Q 133 161 120 162 Q 109 158 106 146 Z':'M 106 146 Q 120 151 134 143 Q 131 155 120 157 Q 110 155 106 146 Z'} fill="#795047"/>
 <path d="M 109 148 Q 121 152 131 146 L 129 150 Q 120 155 111 151 Z" fill="#fff2dc" stroke="none"/>
 <path d="M 113 160 Q 121 162 128 158" fill="none" stroke={light} strokeWidth="1.4"/>
 </>:startled&&!mouth?<ellipse cx="120" cy="150" rx="6" ry="8" fill="#795047"/>:mouth?<path d={mouth===1?'M 111 148 Q 120 144 129 147 Q 127 155 119 155 Q 113 154 111 148 Z':'M 115 145 Q 125 144 126 150 Q 124 156 117 153 Z'} fill="#795047"/>:<><path d={emotion==='embarrassed'?'M 110 149 Q 120 152 130 148':emotion==='disappointed'?'M 110 152 Q 120 148 130 153':worried?'M 110 151 Q 120 146 130 151':firm?'M 108 149 Q 119 147 131 149':'M 109 148 Q 121 151 132 146'} fill="none"/><path d="M 115 153 Q 121 155 127 152" fill="none" stroke={light} strokeWidth="1.3"/></>}
 </g>
 {smile&&<path d="M 103 145 Q 101 149 105 153 M 136 141 Q 140 144 137 150" fill="none" stroke={shadow} strokeWidth=".9" opacity=".6"/>}
 </g><g data-feature="hair" className={reduced?'':'refined-hair'}>
 <path d={pony?'M 77 122 Q 67 85 83 69 Q 92 53 115 58 Q 141 47 156 71 Q 166 81 163 112 L 155 124 L 153 103 Q 140 92 134 77 Q 135 96 145 107 Q 126 99 121 79 Q 119 101 107 109 L 111 85 Q 98 103 87 116 L 87 137 Q 79 131 77 122 Z':'M 77 121 L 73 101 L 76 88 L 72 85 Q 87 67 103 63 L 111 51 L 114 62 L 136 52 L 133 61 L 154 65 L 150 71 L 163 77 L 158 91 L 162 105 L 155 125 L 150 105 L 145 87 Q 144 104 131 111 L 136 85 Q 128 105 115 112 L 121 88 Q 108 110 99 115 L 106 88 Q 95 103 87 121 L 85 130 L 83 107 Z'} fill={hair} stroke={ink} strokeWidth="1.4"/>
 <g fill="none" stroke={tone(hairBase,.24)} strokeWidth="1.1" opacity=".8"><path d={pony?'M 80 98 Q 86 68 112 64 M 91 99 Q 105 76 114 67 M 128 65 Q 144 62 157 86 M 139 76 L 155 99 M 80 109 L 82 121':'M 80 93 Q 91 73 109 67 M 95 91 Q 106 73 122 65 M 114 87 Q 127 67 139 64 M 140 74 Q 151 76 155 91 M 84 84 L 91 77'}/></g>
 <g fill="none" stroke={ink} strokeWidth="1"><path d={pony?'M 92 84 Q 78 103 83 135 M 151 99 Q 162 116 153 139':'M 101 76 Q 95 96 87 108 M 128 70 Q 123 88 111 106 M 147 78 L 154 105'}/></g>
 </g>
 </g>;
}
