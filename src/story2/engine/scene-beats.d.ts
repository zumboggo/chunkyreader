export const SCENE_BEATS:Record<string,{name:string;description:string;emotions:string[];rests:string[];responses:(string|null)[];shot:string}>;
export function sceneBeatCommand(preset:string,actor:string,listener:string,caption:string):string;
export function expandSceneBeat(preset:string,actor:string,listener:string,text:string):any[];
