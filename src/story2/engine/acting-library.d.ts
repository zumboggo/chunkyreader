export const ACTING_VERSION:number;
export const PROPS:string[];
export const EMOTIONS:string[],RESTS:string[],TALKS:string[],RESPONSES:string[],CAMERAS:string[],MOVES:string[],EFFECTS:string[],RIG_PARTS:string[];
export const AUTO_ACTING:Record<string,{rest:string;talk:string}>;
export const POSES:Record<string,Record<string,number>>;
export const ACTING_DESCRIPTIONS:Record<string,string>;
export function packageAssetEntries(pack:any):any[];
export function validateRig(rig:any):string|null;

export function packageContentBytes(pack:any):number;

export const CHARACTER_OPTIONS:Record<string,string[]>;

export const ACTION_DURATION:number;
export const ACTIONS:Record<string,{paired:boolean;actor:string;target?:string;prop?:string;description:string}>;
