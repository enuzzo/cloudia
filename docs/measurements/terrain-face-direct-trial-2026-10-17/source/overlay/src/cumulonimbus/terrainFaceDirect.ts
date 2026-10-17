import {terrainOpticalSurfaceWGSL} from './terrainOpticalMaterial';

const ordinaryDiffuse='\n let diffuse=max(0.0,dot(n,sun));\n';
const faceDiffuse=`
 let faceDirectCross=cross(dpdy(point),dpdx(point));
 let faceDirectLength2=dot(faceDirectCross,faceDirectCross);
 let faceDirectUnit=faceDirectCross*inverseSqrt(max(faceDirectLength2,1e-20));
 let faceDirectUp=select(-faceDirectUnit,faceDirectUnit,faceDirectUnit.y>=0.0);
 let faceDirectNormal=select(normal,faceDirectUp,faceDirectLength2>1e-20);
 let diffuse=max(0.0,dot(faceDirectNormal,sun));
`;

function unique(source:string,anchor:string,label:string):void{
 const first=source.indexOf(anchor);
 if(first<0||source.indexOf(anchor,first+anchor.length)!==-1)
  throw new Error(`Terrain face direct: ${label} expected exactly one occurrence`);
}

/** Immutable owner-selected experiment. The disabled library is returned
 * byte-for-byte. Enabled changes only D: an upward geometric face normal
 * derived from the installed world point, with the existing normalized macro
 * normal as the fallback for a degenerate derivative cross. Derivatives run
 * outside control flow; n, albedo, sky visibility and cast visibility stay as
 * authored. This is a lighting experiment, not measured physical irradiance.
 */
export function terrainFaceDirectSurfaceWGSL(enabled=false,optical=true):string{
 const source=terrainOpticalSurfaceWGSL(optical);
 if(!enabled)return source;
 unique(source,ordinaryDiffuse,'ordinary diffuse line');
 if(/\bfaceDirect[A-Za-z0-9_]*\b/.test(source))throw new Error('Terrain face direct: diagnostic identifiers already present');
 const result=source.replace(ordinaryDiffuse,faceDiffuse);
 unique(result,faceDiffuse,'face diffuse block');
 if(result.replace(faceDiffuse,ordinaryDiffuse)!==source)throw new Error('Terrain face direct: inverse transformation changed other source');
 return result;
}
