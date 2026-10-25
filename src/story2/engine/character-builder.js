import {validateRig} from './acting-library.js';
/** Class-independent character recipe used by Studio, CLI and the cast build. */
export function createCharacter(recipe){
 if(!recipe||!/^[A-Za-z][\w-]{0,63}$/.test(recipe.id||'')||recipe.id==='I')throw Error('Use a character ID starting with a letter; I is reserved for the narrator');
 if(typeof recipe.name!=='string'||!recipe.name.trim()||recipe.name.length>80)throw Error('Add a character name (up to 80 characters)');
 const rig={version:2,preset:'cartoon-v1',style:'manga',finish:recipe.finish??'polished',...(recipe.head?{head:structuredClone(recipe.head)}:{}),palette:{skin:'#eac09c',hair:'#293338',shirt:'#b93f46',...recipe.palette},appearance:{...recipe.appearance}};
 const error=validateRig(rig);if(error)throw Error(error);
 const version=recipe.version??1;if(!Number.isInteger(version)||version<1)throw Error('Character version must be a positive integer');
 return {name:recipe.name.trim(),version,provenance:String(recipe.provenance||'Original fictional character assembled from shared polished SVG components.').slice(0,1000),expressions:{},rig};
}
