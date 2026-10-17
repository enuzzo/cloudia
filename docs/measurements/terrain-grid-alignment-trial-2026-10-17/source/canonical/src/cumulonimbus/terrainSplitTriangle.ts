/** Append a conforming subdivision of one oriented triangle.
 * ab/bc/ca are shared midpoint vertex IDs, or -1 for an unsplit edge.
 * Caller validates integer/distinct IDs and assigns identical IDs on shared
 * edges before this hot path. No geometry, midpoint selection or validation is
 * performed here. Cyclic vertex rotations preserve the same subdivision.
 * No internal arrays/objects: only append to the caller-owned output array.
 */
export function appendTerrainSplitTriangle(
 out:number[],a:number,b:number,c:number,ab:number,bc:number,ca:number,
):void {
 const mask=(ab>=0?1:0)|(bc>=0?2:0)|(ca>=0?4:0);
 switch(mask){
  case 0:out.push(a,b,c);return;
  case 1:out.push(a,ab,c, ab,b,c);return;
  case 2:out.push(a,b,bc, a,bc,c);return;
  case 4:out.push(a,b,ca, b,c,ca);return;
  // Two split edges: cut the common corner first. Triangulate the residual
  // quad from the incoming midpoint to the next original vertex. This rule
  // uses the oriented vertex cycle, never camera state or numeric ID ordering.
  case 3:out.push(ab,b,bc, a,ab,c, ab,bc,c);return;
  case 6:out.push(bc,c,ca, b,bc,a, bc,ca,a);return;
  case 5:out.push(ca,a,ab, c,ca,b, ca,ab,b);return;
  case 7:out.push(a,ab,ca, ab,b,bc, ca,bc,c, ab,bc,ca);return;
 }
}
