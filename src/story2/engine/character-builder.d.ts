export interface CharacterRecipe {id:string;name:string;version?:number;finish?:'polished'|'hybrid';head?:{src:string;frame:[number,number,number,number]};provenance?:string;palette?:Record<string,string>;appearance?:Record<string,string>}
export function createCharacter(recipe:CharacterRecipe):any;
