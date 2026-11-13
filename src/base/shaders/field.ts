// Turns any rasterised shape into a signed distance field on the GPU, by jump flooding.
//
// Seeds are edge pixels, and each keeps its coverage. The coverage says where inside the
// pixel the edge really runs, which gets the result well below one pixel of error.

const VS = `#version 300 es
precision highp float;
void main(){
  vec2 c=vec2(gl_VertexID&1,(gl_VertexID>>1)&1);
  gl_Position=vec4(c*2.-1.,0.,1.);
}`;

export const FIELD_VS = VS;

// Many fields are made at once in one atlas, each a box of it drawn as one instance. A box is read from a texture by the instance's
// number, two texels each: where it sits and how big, then how many pixels it has per css px. Nothing crosses a box's edge, so each
// comes out as it would alone, and seeds keep their place inside their own box, so a half float holds it as exactly as it did.
export const BOX_VS = `#version 300 es
precision highp float;
uniform highp sampler2D uBoxes;
uniform vec2 uAtlas;
flat out vec4 vBox;
flat out float vScale;
void main(){
  vec2 c=vec2(gl_VertexID&1,(gl_VertexID>>1)&1);
  ivec2 at=ivec2((gl_InstanceID*2)%1024,(gl_InstanceID*2)/1024);
  vBox=texelFetch(uBoxes,at,0);
  vScale=texelFetch(uBoxes,at+ivec2(1,0),0).r;
  gl_Position=vec4((vBox.xy+c*vBox.zw)/uAtlas*2.-1.,0.,1.);
}`;

export const SEED_FS = `#version 300 es
precision highp float;
out vec4 o;
uniform sampler2D uMask;
flat in vec4 vBox;
float cov(ivec2 p){return texelFetch(uMask,clamp(p,ivec2(vBox.xy),ivec2(vBox.xy+vBox.zw)-1),0).r;}
void main(){
  ivec2 p=ivec2(gl_FragCoord.xy);
  float c=cov(p);
  bool inside=c>=.5;
  bool edge=c>0.&&c<1.;
  edge=edge||(cov(p+ivec2(1,0))>=.5)!=inside||(cov(p-ivec2(1,0))>=.5)!=inside
           ||(cov(p+ivec2(0,1))>=.5)!=inside||(cov(p-ivec2(0,1))>=.5)!=inside;
  o=edge?vec4(gl_FragCoord.xy-vBox.xy,c-.5,1.):vec4(0.);
}`;

export const FLOOD_FS = `#version 300 es
precision highp float;
out vec4 o;
uniform sampler2D uSeeds,uMask;
uniform int uStep;
flat in vec4 vBox;
void main(){
  ivec2 p=ivec2(gl_FragCoord.xy),lo=ivec2(vBox.xy),hi=lo+ivec2(vBox.zw);
  vec2 at=gl_FragCoord.xy-vBox.xy;
  // The nearest edge is what counts, and that is not always the nearest seed.
  float side=texelFetch(uMask,p,0).r>=.5?1.:-1.;
  vec4 best=vec4(0.);
  float bestD=1e12;
  for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
    ivec2 q=p+ivec2(x,y)*uStep;
    if(q.x<lo.x||q.y<lo.y||q.x>=hi.x||q.y>=hi.y) continue;
    vec4 s=texelFetch(uSeeds,q,0);
    if(s.a==0.) continue;
    float dd=length(s.xy-at)+side*s.z;
    if(dd<bestD){bestD=dd;best=s;}
  }
  o=best;
}`;

export const RESOLVE_FS = `#version 300 es
precision highp float;
out vec4 o;
uniform sampler2D uSeeds,uMask;
flat in vec4 vBox;
flat in float vScale;
void main(){
  ivec2 p=ivec2(gl_FragCoord.xy);
  vec4 s=texelFetch(uSeeds,p,0);
  bool inside=texelFetch(uMask,p,0).r>=.5;
  float d=s.a==0.?1e4:length(s.xy-(gl_FragCoord.xy-vBox.xy));
  // A covered seed has its edge beyond its centre, so outside pixels are closer than they look.
  d=inside?d+s.z:d-s.z;
  o=vec4((inside?-d:d)/vScale);
}`;

// Each pixel measures to one seed, which steps along a diagonal edge, and a bevel's normals
// turn those steps into ribs. Averaging leaves a straight edge's distances as they were, and
// the edge itself is left alone so that thin strokes keep their width. Further in the steps are
// wider, so the same samples spread out: a big bevel needs them far apart. It reads its own box of the atlas, at uAt, into its own texture.
export const SMOOTH_FS = `#version 300 es
precision highp float;
out vec4 o;
uniform sampler2D uField;
uniform float uScale;
uniform ivec2 uSize,uAt;
void main(){
  ivec2 p=ivec2(gl_FragCoord.xy),size=uSize;
  float d=texelFetch(uField,uAt+p,0).r,sum=0.,total=0.;
  float stride=clamp(abs(d)*uScale/6.,1.,6.);
  // Lopsided near the border it would drift, so it shrinks to stay centred.
  int r=min(3,int(float(min(min(p.x,p.y),min(size.x-1-p.x,size.y-1-p.y)))/stride));
  for(int y=-r;y<=r;y++)for(int x=-r;x<=r;x++){
    float w=float((4-abs(x))*(4-abs(y)));
    sum+=texture(uField,(vec2(uAt)+gl_FragCoord.xy+vec2(x,y)*stride)/vec2(textureSize(uField,0))).r*w;
    total+=w;
  }
  o=vec4(mix(d,sum/total,smoothstep(1.,3.,abs(d)*uScale)));
}`;

// A field's slopes kept, and its reach cut off at another outline: what's outside that is outside.
export const WITHIN_FS = `#version 300 es
precision highp float;
out vec4 o;
uniform sampler2D uField,uEdge;
uniform float uSteep;
void main(){
  ivec2 p=ivec2(gl_FragCoord.xy);
  o=vec4(max(texelFetch(uField,p,0).r,texelFetch(uEdge,p,0).r*uSteep));
}`;
