 // Derivatives must execute in uniform fragment control flow, before the UV branch below.
 let dx=dpdx(point);let dy=dpdy(point);
 let size=textureDimensions(shadowMap);
 let radial=normalize(point-center+vec3<f32>(0.0,${EARTH_RADIUS}.0,0.0));
 // Rescale before cross so every finite derivative component stays bounded.
 let scaleX=max(max(abs(dx.x),abs(dx.y)),abs(dx.z));
 let scaleY=max(max(abs(dy.x),abs(dy.y)),abs(dy.z));
 let faceCross=cross(dx/max(scaleX,1e-20),dy/max(scaleY,1e-20));
 let lengthSquared=dot(faceCross,faceCross);
 let rawNormal=faceCross*inverseSqrt(max(lengthSquared,1e-20));
 let alignment=dot(rawNormal,radial);
 let oriented=select(-rawNormal,rawNormal,alignment>=0.0);
 let valid=lengthSquared>1e-20;
 let faceNormal=select(radial,oriented,valid);
 let cosine=select(1.0,clamp(abs(alignment),0.0,1.0),valid);
 let e=radius/f32(size.x);
 // Complete the radial offset to half-texel clearance from this face plane.
 // UV and solar height both use this same point; visible geometry is unchanged.
 let lookupPoint=point+radial*e+faceNormal*(e*(1.0-cosine));
