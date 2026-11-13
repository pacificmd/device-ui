// The player's two programs. `PACK` turns a plate's maps, as the material pass left them, into what a lamp frame reads: two RGBA8 at the
// maps' own size (slope, openness and height; finish with its wear already on it) and the heights again at half size for the shadow's march.
// `LIGHT` is the lamp frame: one lamp, a microfacet lobe and a coat, the room for what's mirrored, over shadows `SHADOW` marched first
// at half size. Nothing is kept from one frame to the next. What it leaves out of the engine's own light is in `install.ts`, with what falls back for it.
import { BRUSH_LEVELS, BRUSH_REACH, BRUSH_THIN, BRUSH_TURNS, OCT, PANES, PANE_SIZE } from '../shaders/room.js';
import { LIGHT_VIEW, POINTS, TONE } from '../shaders/light.js';
import { SCREEN_OF } from '../shaders/material.js';
import { TILT_RANGE } from '../broken.js';

// The march toward a light through the heights, which the shadow pass runs for the lamp, the room's bright side, a flash and a torch.
const MARCH = `// How far above what's here a height is. Under something standing clear counts as above it too, by as far as it's below.
// It's off along the ray, css px.
float clearOf(vec2 uv,float z,float lod){
  float gap=z-marchH(uv,lod);
  return gap<0.?max(gap,marchU(uv)-z):gap;
}
float grazes(vec2 uv,float h0,vec3 L,float t,float soft){
  vec2 size=uCss*MM;
  vec3 q=vec3(uv*size,h0+.03)+L*t;
  return clamp(.5+clearOf(q.xy/size,q.z,0.)/(t*soft+.05),0.,1.);
}
float shadow(vec2 uv,float h0,vec3 L,float soft,float stride){
  vec2 size=uCss*MM;
  // Steps land the same way from pixel to pixel, and scallop an edge, so each pixel starts a little apart: see marchStart.
  float k=1.,t=.25,near=0.,j=marchStart(uv),top=marchTop(uv,h0,L);
  // A low thing's shadow is short, and a step as long as a tall thing's would fray its edge. The steps there are run out
  // about 37mm along at the longest of these, so a ray that has further to go past whatever stands here takes longer ones.
  float clear=(top-h0)/max(L.z,.1),most=max(min(1.6,clear*.07),(clear-21.)*.1);
  for(int i=0;i<36;i++){
    // Steps stop growing, or a small tall object falls between them and casts a row of dots.
    float step=min(t*.22,most)*stride,lod=clamp(log2(step*${1 / 0.25}.*uDpr)-1.,0.,3.);
    vec3 q=vec3(uv*size,h0+.03)+L*(t+step*j);
    if(q.z>top) break;
    float was=clamp(.5+clearOf(q.xy/size,q.z,lod)/(t*soft+.05),0.,1.);
    if(was<k){k=was;near=t+step*j;}
    if(k<.01) break;
    t+=step;
  }
  // Steps that long land anywhere near an edge, and from pixel to pixel that's a torn line. So look again where the ray came closest.
  if(most>1.6&&k>.01) for(float s=most*.5;s>.5;s*=.5){
    float a=near>s?grazes(uv,h0,L,near-s,soft):1.,b=grazes(uv,h0,L,near+s,soft);
    if(a<k){k=a;near-=s;}
    if(b<k){k=b;near+=s;}
  }
  return k*k*(3.-2.*k);
}
`;

/** Texel for texel over a target, the first row at the top of the maps as the plate's own are. */
export const PACK_VS = `#version 300 es
precision highp float;
out vec2 vT;
void main(){
  vec2 c=vec2(gl_VertexID&1,(gl_VertexID>>1)&1);
  vT=c;
  gl_Position=vec4(c*2.-1.,0.,1.);
}`;

// A slope as the maps keep it in eight bits: 127 is level, so level is exactly level. Kept as .5 it fell between two steps, and a face
// all but flat came out a step tilted one way or the other, in patches as wide as its broadest wave, which a coat mirrors as blotches.
const SLOPE = `
vec2 putSlope(vec2 v){return (127.+127.*clamp(v,-1.,1.))/255.;}
vec2 getSlope(vec2 v){return (v*255.-127.)/127.;}`;

export const PACK_FS = `#version 300 es
precision highp float;
in vec2 vT;
layout(location=0) out vec4 oB;
layout(location=1) out vec4 oC;
layout(location=2) out vec4 oT;
uniform sampler2D tA,tH,tS,tC,tO,tM,tD,tN;
// Canvas to maps, as the light pass has it, mm a texel, the height eight bits cover, how coarse a smooth face's slope is read, and whether
// relief and grain are kept apart from height.
uniform vec4 uMap;
uniform float uMm,uMost,uLod;
uniform bool uRelief,uSplit;
${SLOPE}
float rise(ivec2 p){
  ivec2 q=clamp(p,ivec2(0),textureSize(tH,0)-1);
  return texelFetch(tH,q,0).r+(uRelief?texelFetch(tD,q,0).r:0.);
}
float wide(vec2 t,float l){return textureLod(tH,t,l).r+(uRelief?textureLod(tD,t,l).r:0.);}
void main(){
  ivec2 p=ivec2(gl_FragCoord.xy);
  vec4 A=texelFetch(tA,p,0),S=texelFetch(tS,p,0),C=texelFetch(tC,p,0),M=texelFetch(tM,p,0);
  if(A.a<=0.){oB=vec4(putSlope(vec2(0.)),1.,0.);oC=vec4(1.,0.,0.,0.);oT=vec4(putSlope(vec2(0.)),0.,0.);return;}
  // The slope, from the heights as they're kept: thinned by cover, so an edge is as steep as it's drawn.
  vec2 g=vec2(rise(p-ivec2(1,0))-rise(p+ivec2(1,0)),rise(p-ivec2(0,1))-rise(p+ivec2(0,1)))/(2.*uMm);
  vec3 n=normalize(vec3(g,1.));
  float h=rise(p)/max(A.a,.25);
  float sa=max(S.a,.001),rough=clamp(S.r/sa,.03,1.),mf=S.g/sa*2.,metal=clamp(mf,0.,1.),coat=S.b/sa;
  // Pure metal rounds to just over 1 here, and that speck of film would tint a dark metal.
  float film=clamp(mf-1.004,0.,1.);
  // What handling left, as the engine's light takes it, here once: prints and scratches roughen what's glossy and go through a lacquer,
  // haze roughens, and dust lies pale over everything. Only what can hold a mark takes one.
  float takes=M.b/max(M.a,.001);
  C.rgb*=takes;C.a=mix(.5,C.a,takes);
  float gloss=1.-smoothstep(.12,.72,rough),mark=(C.r*.6+C.b*.55)*gloss;
  rough=clamp(rough*(1.+(C.a-.5)*.3)+mark*.2,.03,1.);
  coat*=1.-min(mark*1.1,.85);
  metal*=1.-C.g;
  rough=mix(rough,.9,C.g);
  coat*=1.-C.g;
  vec2 px=1./vec2(textureSize(tA,0));
  // A clear coat levels the texture under it, and a sharp reflection would show it as a weave: what's smooth takes its slope from further
  // apart, except across a real edge, where that would lean a bevel that isn't there.
  if(rough<.34||coat>.01){
    vec2 es=px*exp2(uLod);
    float l=max(uLod-1.5,0.),a=wide(vT+vec2(-es.x,-es.y),l),b=wide(vT+vec2(es.x,-es.y),l),c=wide(vT+vec2(-es.x,es.y),l),d=wide(vT+vec2(es.x,es.y),l);
    vec3 ns=normalize(vec3(vec2(a+c-b-d,a+b-c-d)/(4.*uMm*exp2(uLod)),1.));
    float stands=max(a,max(b,max(c,d)))-min(a,min(b,min(c,d)));
    ns=normalize(mix(ns,n,max(smoothstep(.16,.36,length(n.xy/n.z-ns.xy/ns.z)),smoothstep(.08,.24,stands))));
    n=normalize(mix(ns,n,smoothstep(.14,.34,rough)));
  }
  // The grooves of bare brushed metal lean across their length.
  float ma=max(M.a,.001),scatter=M.g/ma;
  vec4 Tq=uSplit?texelFetch(tN,p,0):texelFetch(tH,p,0);
  vec2 tv=uSplit?(Tq.rg-.5*Tq.a)*4./max(Tq.a,.001):Tq.gb/max(Tq.a,.001);
  tv*=1.-step(1.5,tv.x);
  float an=clamp(length(tv),0.,.92);
  if(an>.05&&metal>.5&&coat<=.01) n=normalize(vec3(n.xy/n.z+vec2(-tv.y,tv.x)/an*(M.r/ma-.5),1.));
  // What it can see of the room, kept at half size, so read about itself. Light that goes in and comes back out elsewhere fills what
  // would have been dark. Where one part stands on another the join is a dark line, far tighter than that reaches, and a pale metal
  // fills its own creases.
  vec2 cu=(vT-uMap.zw)/uMap.xy,eo=2.5*px/uMap.xy;
  float O=(texture(tO,cu+eo).r+texture(tO,cu-eo).r+texture(tO,cu+vec2(eo.x,-eo.y)).r+texture(tO,cu-vec2(eo.x,-eo.y)).r)*.25;
  float open=mix(O*O,O,scatter);
  vec2 ej=max(.3/uMm,1.2)*px;
  float hj=textureLod(tH,vT,0.).r*2.;
  float crease=max(textureLod(tH,vT-vec2(ej.x,0.),0.).r+textureLod(tH,vT+vec2(ej.x,0.),0.).r-hj,0.)+max(textureLod(tH,vT-vec2(0.,ej.y),0.).r+textureLod(tH,vT+vec2(0.,ej.y),0.).r-hj,0.);
  open*=1.-.82*smoothstep(.08,.7,crease);
  vec3 alb=mix(A.rgb/max(A.a,.001),vec3(.6,.58,.55),C.g),f0=mix(vec3(.04),alb+.04*(1.-alb),metal);
  float fill=min(max(f0.r,max(f0.g,f0.b)),.95);
  open=mix(open,open/(1.-fill*(1.-open)),metal);
  oB=vec4(putSlope(n.xy),open,clamp(h/uMost,0.,1.));
  oC=vec4(rough,metal,clamp(coat,0.,1.),C.g);
  // Which way its grain runs, 127 for none so none is exactly none; then one of three that never meet, by what it is: how rough a coat
  // is, how thick a film lies on bare metal, or a matt face's sheen; and how far light goes into it, which on metal is how hard it's ruled.
  oT=vec4(putSlope(tv),coat>.01||metal<=.5?M.r/ma:film,clamp(scatter,0.,1.));
}`;

/** Heights alone, at half size, for the shadow's march: what stands there, not thinned by its cover. */
export const HEIGHT_FS = `#version 300 es
precision highp float;
in vec2 vT;
out vec4 o;
uniform sampler2D tA,tH,tD;
uniform bool uRelief;
void main(){
  float a=texture(tA,vT).a,h=texture(tH,vT).r+(uRelief?texture(tD,vT).r:0.);
  o=vec4(a>.004?h/max(a,.25):0.,0.,0.,1.);
}`;

/**
 * A spring's two ends laid over where they were cut from, as far between them as it is: only where the ends differ, so what the spring
 * doesn't move is left as it is, whatever else has moved there. Past either end it goes on in a line, as a spring overshoots.
 *
 * `uMode` 0 lays it whole. Where two parts moving at once both change a place, the gap between two keys, neither one's ends are right
 * there, and one laid over the other leaves each pixel whichever came last, in specks. So there they're laid as the place at rest (1) and
 * then each part's change added to it, what goes up (2) and what goes down (3), by the blend: every part moved adds what it moves.
 */
export const LAY_FS = `#version 300 es
precision highp float;
layout(location=0) out vec4 o0;
layout(location=1) out vec4 o1;
uniform sampler2D tB,tC,tB0,tC0;
uniform ivec2 uAt;
uniform float uF;
uniform bool uHalf;
uniform int uMode;
vec4 as(vec4 b0,vec4 b){
  vec4 d=(b-b0)*uF;
  return uMode==1?b0:uMode==2?max(d,0.):uMode==3?max(-d,0.):b0+d;
}
void main(){
  ivec2 p=ivec2(gl_FragCoord.xy)-uAt;
  vec4 b=texelFetch(tB,p,0),b0=texelFetch(tB0,p,0);
  if(uHalf){
    if(b.r==b0.r) discard;
    o0=vec4(as(b0,b).r,0.,0.,uMode>1?0.:1.);
    o1=vec4(0.);
    return;
  }
  vec4 c=texelFetch(tC,p,0),c0=texelFetch(tC0,p,0);
  if(b==b0&&c==c0) discard;
  o0=as(b0,b);
  o1=as(c0,c);
}`;

/**
 * A part its joint carries whole, a slide or a turn, laid over where it sweeps: the body without it, and over that the part as it rests,
 * moved by its joint. Two maps a pass, each its own kind: 0 as it is, 1 a slope in its first two channels, which turns with the part,
 * 2 a grain's lie as the pack keeps it. `uScale` is 1 for maps at their own size and .5 for the heights at half.
 * `tOver` is where the body stands over the part, and hides it.
 *
 * Moved, the part takes its own shade along, but where it meets the body the shade is the body's and stays: a key gone into a case is
 * dark where the case's lip meets it, wherever it's gone to. The maker painted it at its far end (`tF0`, `tF1`), so what the part carried
 * there misses of that is known, and it's added as far as the part has gone toward that end (`uW`). At either end it's the maker's, to the bit.
 */
export const CARRY_FS = `#version 300 es
precision highp float;
layout(location=0) out vec4 o0;
layout(location=1) out vec4 o1;
uniform sampler2D tU0,tR0,tU1,tR1,tMask,tOver,tF0,tF1;
uniform ivec2 uAt;
// Where it's gone, map px, how far it's turned, and the pin it turns about, from the crop's corner. And where its far end is.
uniform vec2 uGo,uPin,uFar;
uniform float uTurn,uScale,uW;
uniform ivec2 uKind;
${SLOPE}
vec2 spin(vec2 v,float a){float c=cos(a),s=sin(a);return vec2(c*v.x-s*v.y,s*v.x+c*v.y);}
// A slope and a grain's lie are kept the same way, so they turn the same way.
vec4 turned(vec4 v,int kind){
  if(kind==1||kind==2) v.xy=putSlope(spin(getSlope(v.xy),uTurn));
  return v;
}
// The part as read, at a place between texels: a turn lands nowhere on the grid, and read in a line between four texels a knurl's teeth
// go soft. Through sixteen, as a cubic through them, they keep their edge, and on the grid, as a slide along it lands, it's the texel.
vec4 sharp(sampler2D t,vec2 uv){
  vec2 n=vec2(textureSize(t,0)),s=uv*n-.5,f0=floor(s),f=s-f0;
  vec2 w0=f*(-.5+f*(1.-.5*f)),w1=1.+f*f*(-2.5+1.5*f),w2=f*(.5+f*(2.-1.5*f)),w3=f*f*(-.5+.5*f),w12=w1+w2;
  vec2 t0=(f0-.5)/n,t3=(f0+2.5)/n,t12=(f0+.5+w2/w12)/n;
  return (textureLod(t,vec2(t0.x,t0.y),0.)*w0.x+textureLod(t,vec2(t12.x,t0.y),0.)*w12.x+textureLod(t,vec2(t3.x,t0.y),0.)*w3.x)*w0.y
    +(textureLod(t,vec2(t0.x,t12.y),0.)*w0.x+textureLod(t,vec2(t12.x,t12.y),0.)*w12.x+textureLod(t,vec2(t3.x,t12.y),0.)*w3.x)*w12.y
    +(textureLod(t,vec2(t0.x,t3.y),0.)*w0.x+textureLod(t,vec2(t12.x,t3.y),0.)*w12.x+textureLod(t,vec2(t3.x,t3.y),0.)*w3.x)*w3.y;
}
// A cubic overshoots an edge a little: kept to what an eight-bit map holds. Heights in mm hold what they're given.
vec4 kept(vec4 v){return uScale<1.?v:clamp(v,0.,1.);}
// The part as it rests, gone by \`go\`, over the body without it, at \`p\`.
void carried(vec2 p,vec2 go,out vec4 a,out vec4 b){
  // Where this was on the part at rest.
  vec2 q=spin(p/uScale-go-uPin,-uTurn)+uPin;
  vec2 size=vec2(textureSize(tMask,0)),uq=q/size;
  float m=all(greaterThan(q,vec2(0.)))&&all(lessThan(q,size))?textureLod(tMask,uq,0.).r:0.;
  ivec2 ip=ivec2(p);
  // What of the body stands over it hides it there: a key gone into the side of a case is under the case.
  float part=m;
  m*=1.-texelFetch(tOver,ivec2(p/uScale),0).r;
  vec4 u0=texelFetch(tU0,ip,0);
  // What the part shades of the body round it goes where it goes: how much less open the body was there with it than without. Round
  // it, and not under it, where how open it is itself says nothing of the body.
  bool inside=uq==clamp(uq,0.,1.);
  // Where the part covers round here just what it covered at rest, as a round knob turned on its own pin does, what it leaves on the body
  // is what was read right here, to the texel, over a groove or a print as much as on bare body. Where it covers otherwise, it went with it.
  vec2 r=p/uScale,bq=r/size;
  float moved=0.;
  for(int i=0;i<9;i++){
    vec2 x=r+(i==8?vec2(0.):spin(vec2(6.,0.),float(i)*.785398)),xq=spin(x-go-uPin,-uTurn)+uPin;
    moved+=abs(textureLod(tMask,x/size,0.).r-textureLod(tMask,xq/size,0.).r);
  }
  float w=clamp(moved*.5,0.,1.);
  bool here=bq==clamp(bq,0.,1.);
  // The shade it casts: how much less open the body was there with it than without.
  if(uKind.x==1&&inside){
    float s=clamp(textureLod(tR0,uq,0.).b/max(textureLod(tU0,uq,0.).b,.004),0.,1.);
    if(here) s=mix(clamp(textureLod(tR0,bq,0.).b/max(textureLod(tU0,bq,0.).b,.004),0.,1.),s,w);
    u0.b*=mix(s,1.,part);
  }
  // And the colour and finish it leaves there, the dirt gathered at its foot: what the body was with it, over what it was without.
  if(uKind.x==3&&inside) u0+=mix(here?textureLod(tR0,bq,0.)-textureLod(tU0,bq,0.):vec4(0.),textureLod(tR0,uq,0.)-textureLod(tU0,uq,0.),here?w:1.)*(1.-part);
  vec4 u1=texelFetch(tU1,ip,0);
  if(uKind.y==3&&inside) u1+=mix(here?textureLod(tR1,bq,0.)-textureLod(tU1,bq,0.):vec4(0.),textureLod(tR1,uq,0.)-textureLod(tU1,uq,0.),here?w:1.)*(1.-part);
  a=mix(u0,turned(kept(sharp(tR0,uq)),uKind.x),m);
  b=mix(u1,turned(kept(sharp(tR1,uq)),uKind.y),m);
}
void main(){
  vec2 p=gl_FragCoord.xy-vec2(uAt);
  carried(p,uGo,o0,o1);
  if(uW>0.){
    vec4 f0,f1;
    carried(p,uFar,f0,f1);
    ivec2 ip=ivec2(p);
    o0+=uW*(texelFetch(tF0,ip,0)-f0);
    o1+=uW*(texelFetch(tF1,ip,0)-f1);
  }
}`;

// How plainly two readings of one place differ, in form, colour or finish: over .03 and it isn't the same thing there. What a part only
// leaves on the body round it, the shade it casts and the marks of the hands that worked it, is fainter than that.
const PLAIN = `float plain(sampler2D a0,sampler2D a1,sampler2D b0,sampler2D b1,sampler2D c0,sampler2D c1,ivec2 p){
  vec4 a=abs(texelFetch(a0,p,0)-texelFetch(a1,p,0)),b=abs(texelFetch(b0,p,0)-texelFetch(b1,p,0)),c=abs(texelFetch(c0,p,0)-texelFetch(c1,p,0));
  float form=max(max(b.r,b.g),b.a*4.),colour=max(max(a.r,a.g),max(a.b,a.a)),finish=max(c.r*.5,max(c.g,c.b));
  return max(form,max(colour*.5,finish*.5));
}`;

/**
 * Where the part is: where the device with it stands otherwise than the device without, by its slope or by its height, which the half-size
 * heights hold to the hundredth of a mm. Not by its colour or finish: a part carried whole stands on what holds it, and all it changes of
 * the body round it, the shade it casts and the dirt and wear gathered at its foot, is colour and finish and stays where it is. Taken for
 * the part, that would turn with it, a brushed panel's grain and all.
 */
export const APART_FS = `#version 300 es
precision highp float;
out vec4 o;
uniform sampler2D tB,tB0,tH,tH0;
void main(){
  ivec2 p=ivec2(gl_FragCoord.xy);
  vec2 b=abs(texelFetch(tB,p,0).rg-texelFetch(tB0,p,0).rg);
  float h=abs(texelFetch(tH,p/2,0).r-texelFetch(tH0,p/2,0).r);
  o=vec4(max(step(.03,max(b.r,b.g)),step(.01,h)));
}`;

/**
 * Where the body stands over the part: where the part would be with its joint at its far end, and the maker, painting it there, shows the
 * body without it all the same. Measured and not worked out from heights, as only the maker knows what it draws over what.
 */
export const COVER_FS = `#version 300 es
precision highp float;
out vec4 o;
uniform sampler2D tA,tAF,tB,tBF,tC,tCF,tMask;
uniform vec2 uGo,uPin;
uniform float uTurn;
${PLAIN}
vec2 spin(vec2 v,float a){float c=cos(a),s=sin(a);return vec2(c*v.x-s*v.y,s*v.x+c*v.y);}
void main(){
  vec2 p=gl_FragCoord.xy,q=spin(p-uGo-uPin,-uTurn)+uPin,size=vec2(textureSize(tMask,0));
  float m=all(greaterThan(q,vec2(0.)))&&all(lessThan(q,size))?texture(tMask,q/size).r:0.;
  o=vec4(step(.5,m)*(1.-step(.03,plain(tA,tAF,tB,tBF,tC,tCF,ivec2(p)))));
}`;

// A screen's picture is the page's, and a new one is no paint: the player draws what the screen makes of it, with the maker's own words
// for that, straight into the maker's colour and light. What stands between the screen and the eye, a bezel's lip or print on the glass, was
// measured once: the maker drew the screen all black and all white, and how much of the difference came through at each pixel is how
// much of any picture does.
/**
 * The screen's own box, drawn onto the maps as the maker draws it: the same corners through the same viewport, so each pixel is the same
 * place on the glass to the last bit, and a picture's pixel that falls on an edge falls the same side of it.
 */
export const SCREEN_VS = `#version 300 es
precision highp float;
precision highp int;
uniform vec4 uBox;
uniform vec2 uCanvas;
out vec2 vPx;
void main(){
  vec2 c=vec2(gl_VertexID&1,(gl_VertexID>>1)&1);
  vPx=mix(uBox.xy,uBox.zw,c);
  gl_Position=vec4(vPx/uCanvas*2.-1.,0.,1.);
}`;

const SCREEN_HEAD = `in vec2 vPx;
uniform sampler2D uScreen,uDamage;
uniform int uKind;
uniform vec3 uInk,uColor,uEmit;
uniform vec2 uInset,uCenter,uHalf;
uniform float uZoom,uGain,uMetal,uRot;
${SCREEN_OF}
// What the screen alone makes of its picture here, as the maker's maps hold it: its colour, and its light at a quarter.
void alone(out vec3 col,out vec3 emit){
  float c=cos(uRot),s=sin(uRot),metal;
  vec2 p=mat2(c,-s,s,c)*(vPx-uCenter);
  screenOf((p+uHalf)/(2.*uHalf),vPx,col,emit,metal);
  col=clamp(col,0.,1.);emit=clamp(emit*.25,0.,1.);
}`;

/** The screen alone, over its crop: colour and light. */
export const ALONE_FS = `#version 300 es
precision highp float;
layout(location=0) out vec4 o0;
layout(location=1) out vec4 o1;
${SCREEN_HEAD}
void main(){vec3 col,emit;alone(col,emit);o0=vec4(col,1.);o1=vec4(emit,1.);}`;

/**
 * How much of the screen comes through at each pixel, in colour and in light, from the maker's maps with it black and with it white
 * against the screen alone the same two ways. And the maps with none of the screen in them, to lay any picture over.
 */
export const THROUGH_FS = `#version 300 es
precision highp float;
layout(location=0) out vec4 oT;
layout(location=1) out vec4 oA;
layout(location=2) out vec4 oE;
uniform sampler2D tAb,tEb,tAw,tEw,tSAb,tSEb,tSAw,tSEw;
float through(vec3 fb,vec3 fw,vec3 sb,vec3 sw){vec3 d=sw-sb;float n=dot(d,d);return n<.0004?0.:clamp(dot(fw-fb,d)/n,0.,1.);}
void main(){
  ivec2 p=ivec2(gl_FragCoord.xy);
  vec4 ab=texelFetch(tAb,p,0),eb=texelFetch(tEb,p,0);
  vec3 sab=texelFetch(tSAb,p,0).rgb,seb=texelFetch(tSEb,p,0).rgb;
  float ta=through(ab.rgb,texelFetch(tAw,p,0).rgb,sab,texelFetch(tSAw,p,0).rgb),te=through(eb.rgb,texelFetch(tEw,p,0).rgb,seb,texelFetch(tSEw,p,0).rgb);
  oT=vec4(ta,te,0.,1.);
  oA=vec4(ab.rgb-ta*sab,ab.a);
  oE=vec4(eb.rgb-te*seb,eb.a);
}`;

/**
 * A picture on its screen, into the maker's colour and light: the maps without the screen, and what the screen makes of the picture as
 * far as it comes through. Asked instead (uJudge), it passes only pixels that aren't what the maker painted of the same picture.
 */
export const SHOW_FS = `#version 300 es
precision highp float;
layout(location=0) out vec4 o0;
layout(location=1) out vec4 o1;
uniform sampler2D tBaseA,tBaseE,tT,tRealA,tRealE;
uniform ivec2 uAt;
uniform bool uJudge,uLit;
${SCREEN_HEAD}
void main(){
  vec3 col,emit;
  alone(col,emit);
  ivec2 q=ivec2(gl_FragCoord.xy)-uAt;
  vec2 T=texelFetch(tT,q,0).rg;
  vec4 a=texelFetch(tBaseA,q,0),e=texelFetch(tBaseE,q,0);
  o0=vec4(a.rgb+T.r*col,a.a);
  o1=vec4(e.rgb+T.g*emit,e.a);
  if(uJudge){
    vec3 d=abs(o0.rgb-texelFetch(tRealA,q,0).rgb);
    if(uLit) d=max(d,abs(o1.rgb-texelFetch(tRealE,q,0).rgb));
    if(max(d.r,max(d.g,d.b))<=.06) discard;
    o0=vec4(1.);
  }
}`;

/**
 * Whether a spring's maps are a straight line between its ends: heights at rest, at the far end and half way. Passes a pixel that
 * moved at all (uWhat 0), or one whose half way is off the middle of its ends by more than a twentieth of how far it moved (1).
 */
export const JUDGE_FS = `#version 300 es
precision highp float;
out vec4 o;
uniform sampler2D tRest,tTo,tMid;
uniform ivec2 uAt;
uniform int uWhat;
void main(){
  ivec2 p=ivec2(gl_FragCoord.xy);
  float r=texelFetch(tRest,p+uAt,0).r,t=texelFetch(tTo,p,0).r,m=texelFetch(tMid,p,0).r,went=abs(t-r);
  if(went<=.004) discard;
  if(uWhat==1&&abs(m-(r+t)*.5)<=max(.02,went*.08)) discard;
  o=vec4(1.);
}`;

/**
 * The same asked of a part's colour and light, a lamp coming on: whether they went anywhere between its ends, and whether half way was
 * anything but half of each. Compared as the eye takes them, by their roots, as a dim lamp is most of what's seen of one.
 */
export const JUDGE_GLOW_FS = `#version 300 es
precision highp float;
out vec4 o;
uniform sampler2D tRestA,tToA,tMidA,tRestE,tToE,tMidE;
uniform ivec2 uAt;
uniform int uWhat;
float most(vec4 v){return max(max(v.r,v.g),max(v.b,v.a));}
void main(){
  ivec2 p=ivec2(gl_FragCoord.xy);
  vec4 r=texelFetch(tRestA,p+uAt,0),t=texelFetch(tToA,p,0),m=texelFetch(tMidA,p,0);
  vec4 re=texelFetch(tRestE,p+uAt,0),te=texelFetch(tToE,p,0),me=texelFetch(tMidE,p,0);
  if(max(most(abs(t-r)),most(abs(te-re)))<=.004) discard;
  if(uWhat==1&&max(most(abs(sqrt(m)-sqrt((r+t)*.5))),most(abs(sqrt(me)-sqrt((re+te)*.5))))<=.04) discard;
  o=vec4(1.);
}`;

// What the lamp frame's two passes share: the numbers the renderer sets, how heights are read, where a view ray lands, and the march
// toward a light.
const HEAD = `precision highp float;
in vec2 vUv;
layout(location=0) out vec4 o;
uniform sampler2D tA,tB,tC,tHalf,tRoom,tE,tDFG,tT,tU,tShade,tTorchShade,tSpread;
// Its broken glass, over the canvas, if it has any: see broken.ts.
uniform sampler2D tCrack;
// Where a crack's face shows through a thick sheet beside it, and how wide its gap of air is there: see broken.ts.
uniform sampler2D tFace;
uniform int uCracked;
uniform highp sampler2DArray tBrush;
uniform vec4 uMap,uFrame,uBody;
uniform vec2 uCss,uShift;
uniform bool uLinear;
// Glass with a face of its own, as the engine reads it: see PANE_FIELDS in maps.ts.
uniform int uPanes;
uniform float uPane[${PANES * PANE_SIZE}];
uniform vec3 uKey,uCam,uRoomColor,uSky;
uniform float uDpr,uPeak,uFace,uLift,uRoom,uLamp,uLampSoft,uFill,uPageShade;
// The player's own: map px a mm, the height eight bits cover, and whether anything glows.
uniform float uPx,uMost;
// What glows: nothing, over the canvas, or over the maps.
uniform int uGlows;
uniform int uPoints;
uniform vec4 uPoint[${POINTS}];
uniform vec3 uPointColor[${POINTS}];
uniform vec4 uTorch,uBeam,uCone;
uniform vec3 uAim,uTint;
// A debug view: one of the maps as it is, past a split if there is one (mm across the canvas), or else in a torch's pool.
uniform int uDebug;
uniform float uSplit;
// The shadows' share of the scratch they were left in, which is as big as the biggest device's.
uniform vec2 uShadeAt;
// Seen from off straight-on: how far the eye has gone from where it rests, mm, and a body turning over, as the engine has them.
uniform vec2 uLean,uSpin,uRound;
uniform vec3 uOwn;
const float MM=.25,PI=3.14159265,EXPOSURE=.62;
#define AT(uv) ((uv)*uMap.xy+uMap.zw)
${OCT}
${TONE}
${SLOPE}
float rnd(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
vec2 onMap(vec2 mm){return AT(mm/(uCss*MM));}
// What a view ray meets, and under what stands clear as the plate has it. The pack's heights are whole right out to an edge, and a ray
// that landed on one where there's hardly any cover would show the page through the wall: thinned by cover again, as the plate's are.
float topOf(vec2 uv){vec2 t=AT(uv);return textureLod(tB,t,0.).a*uMost*max(textureLod(tA,t,0.).a,.25);}
float underOf(vec2 uv){return textureLod(tU,AT(uv),0.).r;}
float rise(vec2 uv,float l){return textureLod(tHalf,AT(uv),max(l-1.,0.)).r;}
${LIGHT_VIEW}
// At rest the player sees every point from right over it, so a ray leans only by how far the eye has gone from there: the same all over
// the face, and nothing when it hasn't.
vec2 viewSlope(vec2 at){return -uLean/(uCam.z-uFace);}
float nearTop(vec2 s){return uPeak;}
// A turning body takes the room round with it the other way, and a wall that looks out past the room's plane sees the room again.
vec3 inRoom(vec3 r){
  vec3 o=vec3(r.x*uRound.y-r.z*uRound.x,r.y,r.x*uRound.x+r.z*uRound.y);
  if(uSpin.y>0.) o.z=abs(o.z);
  return o;
}
// Light off the top of a clear film meets light off the metal below it, and rulings a little over a micron apart send each wavelength
// off at its own angle: the engine's own, see thin() and the grating in shaders/light.ts.
float gFilm=0.,gGrate=0.,gPitch=0.;
// A film on clear stuff is a stack of them, as nacre and pearl are, layer on layer of chalk platelets: a single one on a pale body sends
// back too little to see in a room's light. On metal it's the one oxide.
float gStack=1.;
// The normal the lamp's colour sees, where that isn't the one its shine does: light that goes into the stuff comes out somewhere else.
vec3 gColor=vec3(0.);
// How much of a surface is a pile, which has no face to shine.
float gPile=0.;
// How much of what glows here a crack in the glass over it turns aside.
float gCrack=0.;
vec3 gRuled=vec3(0.);
vec3 spectrum(float nm){
  vec3 d=(nm-vec3(600.,540.,455.))/vec3(52.,44.,36.);
  return exp(-d*d);
}
vec3 thin(float c,vec3 f0){
  const float N=1.9;
  float path=gFilm*800.*sqrt(1.-(1.-c*c)/(N*N));
  float r1=mix(.31,1.,pow(1.-c,5.));
  vec3 r2=sqrt(f0),b=2.*r1*r2;
  vec3 w=(cos(6.2832*path/vec3(640.,540.,460.))+cos(6.2832*path/vec3(605.,515.,440.))+cos(6.2832*path/vec3(675.,565.,480.)))/3.;
  vec3 R=(r1*r1+r2*r2+b*w)/(1.+r1*r1*r2*r2+b*w);
  // A stack of such films sends back what each does in step, many times over: nearly all of a narrow band of colour, and little else.
  if(gStack>1.) R=pow(tanh(gStack*atanh(min(sqrt(R),vec3(.999)))),vec3(2.));
  return mix(f0,R,smoothstep(0.,.03,gFilm));
}
float D(float NoH,float ToH,float BoH,float at,float ab){float a2=at*ab;vec3 f=vec3(ab*ToH,at*BoH,a2*NoH);float w=a2/dot(f,f);return a2*w*w/PI;}
float V(float NoV,float NoL,float a){float a2=a*a;return .5/max(NoL*sqrt(NoV*NoV*(1.-a2)+a2)+NoV*sqrt(NoL*NoL*(1.-a2)+a2),.0005);}
// The lamp is a soft one on the surface itself, as the engine's: its highlight is as wide as it looks, and dimmer for it. Glass and a
// coat over it take the lamp as it is.
vec3 lobe(vec3 n,vec3 v,vec3 l,vec3 rad,vec3 dif,vec3 f0,float rough,float an,vec3 T,float soft){
  float NoL=dot(n,l);
  if(NoL<=0.) return vec3(0.);
  vec3 h=normalize(v+l);
  float NoV=max(dot(n,v),.02),NoH=max(dot(n,h),0.),VoH=max(dot(v,h),0.),r2=max(rough*rough,.0016),a=min(r2+soft,1.),k=soft>0.?min((r2+.04)/a,1.):1.;
  // Grooves spread a highlight across them and hardly along them.
  float at=max(a*(1.-an),.0008),ab=max(a*(1.+an),.0008);
  T=normalize(T-n*dot(T,n));
  vec3 f1=gFilm>0.?thin(VoH,f0):f0,F=f1+(1.-f1)*pow(1.-VoH,5.);
  vec3 spec=F*D(NoH,dot(T,h),dot(cross(n,T),h),at,ab)*V(NoV,NoL,a)*k*k*(1.-gPile);
  // Rulings gPitch microns apart send a wavelength off where the light and the eye, laid flat on the surface, differ across the rulings
  // by a whole number of waves: d (v+l)·g = m λ. Along the rulings they act as a mirror, so it shows only near that line. The lamp and
  // the eye sit at a distance, so the colour sweeps across a face as each point sees them from its own angle.
  if(gGrate>0.){
    vec3 kk=v+l;
    vec2 kt=kk.xy-n.xy*dot(kk,n),g=gRuled.xy;
    float s=abs(dot(kt,g)),w=dot(kt,vec2(-g.y,g.x)),sig=.06+.5*r2+soft*.5,on=exp(-w*w/(sig*sig));
    vec3 seen=spectrum(gPitch*1000.*s)+spectrum(gPitch*500.*s)*.5+spectrum(gPitch*333.*s)*.25;
    spec+=gGrate*on*seen*mix(f0,vec3(1.),.5)*k*1.6/max(sig*8.,.6);
  }
  return (dif/PI*(1.-F)*(gColor.z>0.?max(dot(gColor,l),0.):NoL)+spec*NoL)*rad;
}
// Past the edge of the maps there's nothing, and what was blurred out of them runs out as it would into an empty pixel beyond the last
// at that size: left to itself the last pixel goes on for ever. The maps stop close to what's drawn: see \`Renderer\`.
float past(vec2 uv,float lod){float t=exp2(lod);vec2 f=clamp(.5-max(-uv,uv-1.)*vec2(textureSize(tA,0))/t,0.,1.);return f.x*f.y;}
// The engine's own march toward a light, over the pack's heights at half size: the same steps, so the same shadow.
float marchH(vec2 uv,float lod){vec2 t=AT(uv);return textureLod(tHalf,t,max(lod-1.,0.)).r*past(t,max(lod,1.));}
float marchU(vec2 uv){return underOf(uv);}
float marchTop(vec2 uv,float h0,vec3 L){return uPeak;}
float marchStart(vec2 uv){return rnd(gl_FragCoord.xy+uShift);}
${MARCH}
// A torch, as the engine has it. How far off its axis a point is, where 1 is the edge of its beam, and what lands there: a hot core, a
// flood that eases off towards the edge with the reflector's rings in it, and a wide spill past that from the bulb itself.
float offAxis(vec3 P){return acos(clamp(dot(normalize(P-uTorch.xyz),uAim),-1.,1.))/uCone.x;}
float pool(vec3 P,float x){
  float near=uCone.y/length(P-uTorch.xyz),spill=1.-smoothstep(.6,2.6,x);
  return (uBeam.x*exp(-x*x*9.)+uBeam.y*(1.-smoothstep(uBeam.z,1.,x))*(1.+uCone.z*sin(x*26.))+uBeam.w*spill*spill)*near*near*uTorch.w;
}
// What a direction sees of the room from here: the eye is over the object's middle, so the far ends look a little outward.
vec3 facing(vec3 r,vec2 pm){return vec3(r.xy+(pm-uBody.xy*MM)/(2.4*max(uBody.z,uBody.w)*MM)*r.z,r.z);}
// The room as grooves smear it: right across them and hardly along them.
float brushed(vec3 r,vec2 b,float reach,float thin){
  float t=fract(atan(b.y,b.x)/PI)*${BRUSH_TURNS.toFixed(1)},l=floor(t),m=clamp(log2(reach/${BRUSH_REACH[0]!.toFixed(2)}),0.,${(BRUSH_REACH.length - 1.01).toFixed(2)}),q=floor(m);
  float lod=clamp(log2(thin/${BRUSH_THIN.toFixed(2)}),0.,${(BRUSH_LEVELS - 1).toFixed(1)}),f=t-l,g=mod(l+1.,${BRUSH_TURNS.toFixed(1)});
  vec2 u=oct(normalize(inRoom(r)));
  float x=mix(textureLod(tBrush,vec3(u,q*${BRUSH_TURNS.toFixed(1)}+l),lod).r,textureLod(tBrush,vec3(u,q*${BRUSH_TURNS.toFixed(1)}+g),lod).r,f);
  float y=mix(textureLod(tBrush,vec3(u,(q+1.)*${BRUSH_TURNS.toFixed(1)}+l),lod).r,textureLod(tBrush,vec3(u,(q+1.)*${BRUSH_TURNS.toFixed(1)}+g),lod).r,f);
  return mix(x,y,m-q);
}
`;

/**
 * The shadows of a lamp frame, at half size into a scratch: the lamp's on what it lights, the page's under the body, and the bright side
 * of the room's, and the strongest flash's or flame's, by the engine's march. Kept apart from the light so a march that long is paid for a quarter of the pixels, as the
 * engine's own quick light does. What a pixel's shade would be with no march is 1.
 */
export const SHADOW_FS = `#version 300 es
${HEAD}
layout(location=1) out vec4 oTorch;
void main(){
  bool still=uLean==vec2(0.)&&uSpin.y<=0.;
  vec2 s=still?vUv:land(vUv),uv=AT(s);
  float lodS=log2(uDpr),near=textureLod(tA,uv,2.+lodS).a*past(uv,2.+lodS),sk=1.,pk=1.,sky=1.,sp=1.;
  if(near>.004&&!gGround&&uRoom>.15&&gSide<1.){
    float h=gHit?gZ:textureLod(tB,uv,0.).a*uMost;
    vec3 L=normalize(uKey-vec3(s*uCss*MM,h));
    if(uSpin.y<=0.) L=normalize(vec3(L.xy,max(L.z,.6*length(L.xy))));
    sk=mix(shadow(s,h,L,.34,1.),1.,gSide);
    // Soft, so it can take longer steps.
    sky=mix(shadow(s,h,uSky,.75,2.),1.,gSide);
  }
  // Only the strongest flash or flame casts, as in the engine's light.
  if(near>.004&&!gGround&&uPoints>0&&gSide<1.){
    float h=gHit?gZ:textureLod(tB,uv,0.).a*uMost;
    vec3 P=vec3(s*uCss*MM,h);
    sp=mix(shadow(s,h,normalize(uPoint[0].xyz-P),.3,1.),1.,gSide);
  }
  // A torch's, only where its pool reaches.
  float st=1.;
  if(near>.004&&!gGround&&uTorch.w>0.&&gSide<1.){
    float h=gHit?gZ:textureLod(tB,uv,0.).a*uMost;
    vec3 P=vec3(s*uCss*MM,h);
    if(pool(P,offAxis(P))>.002) st=mix(shadow(s,h,normalize(uTorch.xyz-P),.2,1.),1.,gSide);
  }
  oTorch=vec4(st,0.,0.,1.);
  if(near<.996&&uLift<uFace&&uSpin.x>0.){
    // In a dark room what falls on the page falls from the torch.
    vec3 L=normalize((uTorch.w>0.&&uRoom<.5?uTorch.xyz:uKey)-vec3(s*uCss*MM,0.));
    L=normalize(vec3(L.xy,max(L.z,.75*length(L.xy))));
    // Nothing stands within reach of the ray, so there's nothing to march through: most of the margin.
    float reach=log2(max((uPeak-uLift)/L.z*length(L.xy)*uPx,1.))+1.;
    if(textureLod(tA,uv,reach).a*past(uv,reach)>.001) pk=shadow(s,uLift,L,.6,1.);
  }
  o=vec4(sk,pk,sky,sp);
}`;

export const LIGHT_FS = `#version 300 es
${HEAD}
// What glows, read as wide as l, device px: over the canvas where the maker spreads it, or the pack's copy of it at half size.
vec3 eAt(vec2 s,float l){return textureLod(tSpread,AT(s),max(l-1.,0.)).rgb;}
// How much of a glow this far off, mm, lands on a surface at height z facing n: only what stands above the glow's plane and faces it.
float faces(vec2 s,vec3 n,vec2 toward,float z,float lod,float far){
  vec2 uv=AT(s);
  float c=textureLod(tA,uv,lod).a*past(uv,lod),dz=z-rise(s,lod)/max(c,.25),R=sqrt(far*far+dz*dz);
  return max(dz,0.)/R*max(dot(n,vec3(toward*far,-dz))/R,0.);
}
// A glow's light on what stands round it, from three sizes of it, near, middle and far, each read once. One read of a coarse size shows its
// texels, but this light lands only on the sides of what stands, too narrow to see that. It comes from the way the middle size grows brighter.
vec3 spill(vec2 s,vec3 n,float z,float lodS){
  float l0=2.+lodS,l1=4.4+lodS,l2=6.8+lodS;
  vec3 a=eAt(s,l0),b=eAt(s,l1),c=eAt(s,l2);
  if(dot(a+b+c,vec3(1.))<.0001) return vec3(0.);
  const vec3 Y=vec3(.3,.6,.1);
  vec2 o=exp2(l1)*.5/(uCss*uDpr);
  float y=dot(b,Y);
  vec2 t=vec2(dot(eAt(s+vec2(o.x,0.),l1),Y)-y,dot(eAt(s+vec2(0.,o.y),l1),Y)-y);
  t/=max(length(t),1e-6);
  return (a*1.45*faces(s,n,t,z,l0,exp2(2.)*MM*.5)+b*3.05*faces(s,n,t,z,l1,exp2(4.4)*MM*.5)+c*1.4*faces(s,n,t,z,l2,exp2(6.8)*MM*.5))*4.;
}
// What's seen at a place on the canvas, where the view ray landed.
vec4 shade(vec2 s){
  gCrack=0.;
  vec4 SH=textureLod(tShade,vec2(vUv.x,1.-vUv.y)*uShadeAt,0.);
  vec2 uv=AT(s),pm=s*uCss*MM;
  float lodS=log2(uDpr);
  // A wall has one line of the top to go on, and read sharp that would streak the length of it.
  float wall=(1.+lodS)*gSide;
  vec4 a=textureLod(tA,uv,wall),b=textureLod(tB,uv,wall),c=textureLod(tC,uv,0.);
  float inside=step(0.,uv.x)*step(uv.x,1.)*step(0.,uv.y)*step(uv.y,1.),cov=gGround?0.:gHit?1.:a.a*inside;
  float h=gHit?gZ:b.a*uMost*inside;
  vec3 n=vec3(getSlope(b.rg),0.);n.z=sqrt(max(1.-dot(n.xy,n.xy),.01));
  if(gUnder) n.z=-n.z;
  vec3 side=vec3(gFace,.04);
  if(gWall) n=normalize(mix(n,side,gSide));
  vec3 P=vec3(pm,h),L=normalize(uKey-P),v=normalize(uCam-P);
  // Seen from behind its own plane. Turned, a lamp really can be down at the horizon, and behind.
  if(uSpin.x<0.) v.xz=-v.xz;
  if(uSpin.y<=0.) L=normalize(vec3(L.xy,max(L.z,.6*length(L.xy))));
  vec3 lamp=uRoomColor*uLamp*uRoom,amb=uRoomColor*uRoom*uFill*mix(vec3(.62,.76,1.),vec3(1.),smoothstep(.04,.4,uRoom));
  // The page under it: what the lamp loses to the body, and a little more close in, where the room can't see past it.
  float shA=0.;
  if(cov<.996&&uLift<uFace&&uSpin.x>0.){
    float shp=SH.g;
    // What stands 1mm or more crowds the light out, measured against the body.
    float deep=4./max(uFace,4.),crowd=min(textureLod(tHalf,uv,2.2+lodS).r*deep,textureLod(tA,uv,3.2+lodS).a)*past(uv,3.2+lodS),crowd2=min(textureLod(tHalf,uv,3.8+lodS).r*deep,textureLod(tA,uv,4.8+lodS).a)*past(uv,4.8+lodS);
    vec2 at=s*uCss,toEdge=min(at-uFrame.xy,uFrame.zw-at);
    float loss=(1.-(1.-min((1.-shp)*.38*uPageShade,.9))*(1.-crowd*.3)*(1.-crowd2*.22))*smoothstep(0.,36.,min(toEdge.x,toEdge.y))*mix(.45,1.,smoothstep(0.,.5,uRoom));
    // A body turning over lifts off the page, and comes back down.
    if(uSpin.y>0.) loss*=uRound.y*uRound.y;
    shA=1.-pow(1.-loss,1./2.2);
  }
  vec3 rgb=vec3(0.);
  if(cov>.004){
    float sh=SH.r,sky=SH.b,ao=mix(b.b,1.,gSide);
    // A dark metal is a clear oxide over metal, and that oxide reflects like anything else.
    vec3 alb=mix(a.rgb/max(a.a,.001),vec3(.6,.58,.55),c.a),dif=alb*(1.-c.g),f0=mix(vec3(.04),alb+.04*(1.-alb),c.g);
    // Which way its grain runs, if it has one, as the plate keeps it. A panel's mark is 2, and a real tangent at most 1.
    vec4 tq=textureLod(tT,uv,0.);
    vec2 tv=getSlope(tq.rg);
    // What only the finish knows: a coat's roughness, a film's thickness, or a sheen; and a ruling's depth on metal.
    float coatRough=tq.b<.01?.02:max(tq.b,.09);
    // A film or a ruling is bare metal's alone, and the numbers mean other things on anything else, so only a place all metal takes them:
    // where metal meets plastic, a blend of the two would read the plastic's scatter as a ruling.
    float bare=c.b<=.01?smoothstep(.9,1.,c.g):0.;
    // On bare stuff that isn't metal the same number is a sheen below a half and a film above it.
    float plain=c.b<=.01&&c.g<=.5?1.:0.;
    gFilm=tq.b*bare+plain*max(tq.b*2.-1.,0.);
    gStack=mix(1.,3.,plain);
    gGrate=tq.a*bare;
    // Prism foil is a mosaic of tiny holograms, each ruled any way at all and at its own pitch, about half a millimetre across, so
    // wherever the lamp is some of them send it to the eye; a slow drift over centimetres lights neighbours together. Pitch 0.8-1.6 microns, about 600-1200 lines a mm: spec.
    vec2 gq=mat2(.866,.5,-.5,.866)*pm/vec2(.45,.7),cell=floor(gq+vec2(.5*floor(gq.y),0.)),dr=pm*.045;
    float drift=sin(dr.x+1.7*sin(dr.y*.8))+sin(dr.y*1.3+.9*sin(dr.x*1.1)),turn=drift*.35+rnd(cell)*3.1416;
    gRuled=vec3(cos(turn),sin(turn),0.);
    // Rubber's sheen is its own face at a glance. Cloth's comes from a pile, and a pile has no face to shine: what it sends back is its
    // sheen and its colour, nothing more, so flock is the blackest thing there is.
    float sheen=plain*(tq.b<.5?tq.b*2.:0.);
    gPile=smoothstep(.6,.8,sheen);
    gPitch=mix(.9,1.4,rnd(cell+.37));
    // Light that goes into the stuff comes out somewhere else, so its colour doesn't see the fine relief its shine does: the slope as much
    // wider as it scatters, which the maps keep at every size. Only relief: near a step, which the height at that size says, it stays sharp,
    // or the blur would lay a soft dish round the step that isn't there.
    float scatter=c.g>.5?0.:tq.a;
    vec3 nd=n;
    if(scatter>.05){
      vec4 bd=textureLod(tB,uv,lodS+scatter*4.);
      vec3 n0=vec3(getSlope(b.rg),0.);n0.z=sqrt(max(1.-dot(n0.xy,n0.xy),.01));
      nd=vec3(getSlope(bd.rg),0.);nd.z=sqrt(max(1.-dot(nd.xy,nd.xy),.01));
      nd=normalize(mix(nd,n0,max(smoothstep(.2,.5,length(n0.xy/n0.z-nd.xy/nd.z)),smoothstep(.04,.12,abs(bd.a-b.a)*uMost))));
      if(gUnder) nd.z=-nd.z;
      if(gWall) nd=normalize(mix(nd,side,gSide));
    }
    // A grain on the top runs off the edge of it, so it says nothing about a wall.
    float an=clamp(length(tv),0.,.92)*(1.-gSide);
    vec3 T=normalize(mix(vec3(an>.001?normalize(tv):vec2(1.,0.),0.),vec3(0.,0.,1.),gSide));
    float rough=clamp(c.r,.03,1.),NoV=max(n.z,.02),polish=1.-smoothstep(.1,.4,rough);
    // Where the surface turns faster than a pixel, what it mirrors is spread over that turn.
    vec3 nx=dFdx(n),ny=dFdy(n);
    rough=sqrt(sqrt(min(rough*rough*rough*rough+min(.5*(dot(nx,nx)+dot(ny,ny)),.3),1.)));
    gColor=nd;
    rgb=lobe(n,v,L,lamp,dif,f0,rough,an,T,uLampSoft)*sh*mix(1.,ao,.3);
    gColor=vec3(0.);
    // Flashes and flames, and what glows on the devices round this one, as the engine lights by them: each falls off as its distance
    // squared from something its size, a size under nothing is a glowing face flat in the page, which gives most straight out and
    // none along itself, and only the strongest casts a shadow.
    for(int i=0;i<${POINTS};i++){
      if(i>=uPoints) break;
      vec3 d=uPoint[i].xyz-P;
      float r2=abs(uPoint[i].w),fall=r2/(r2+dot(d,d));
      if(uPoint[i].w<0.) fall*=max(-d.z,0.)*inversesqrt(max(dot(d,d),1e-6));
      vec3 Lq=normalize(d);
      float sp=mix(1.,ao,.3);
      if(i==0) sp*=SH.a;
      rgb+=lobe(n,v,Lq,uPointColor[i]*fall*(PI/EXPOSURE),dif,f0,rough,an,T,0.)*sp;
    }
    // A torch is a second lamp, held off to one side and aimed at the pointer. What it throws comes back off everything near its pool.
    float beam=0.,st=0.;
    vec3 Lt=vec3(0.,0.,1.),beamTint=vec3(0.);
    if(uTorch.w>0.){
      float x=offAxis(P),bounce=1.-smoothstep(0.,3.,x);
      beam=pool(P,x);
      // A reflector's rim runs warmer than its centre.
      beamTint=uTint*mix(vec3(1.),vec3(1.,.92,.78),smoothstep(.6,1.,x))*10.;
      if(beam>.002){
        Lt=normalize(uTorch.xyz-P);
        st=textureLod(tTorchShade,vec2(vUv.x,1.-vUv.y)*uShadeAt,0.).r*mix(1.,ao,.3);
        // Close overhead, it would lay a sheen over a whole black dial. Only metal takes all of it.
        rgb+=lobe(n,v,Lt,beamTint*beam,dif,f0*mix(.15,1.,smoothstep(.04,.3,max(f0.r,max(f0.g,f0.b)))),rough,an,T,0.)*st;
        // Brighteners show in what's pale: paper, white plastic, white print.
        if(uCone.w>0.) rgb+=vec3(.6,.78,1.)*uCone.w*beam*st*max(dot(nd,Lt),0.)*smoothstep(.25,.8,min(alb.r,min(alb.g,alb.b)))*smoothstep(.1,.28,scatter)*(1.-c.g);
      }
      amb+=beamTint*(beam*.055+bounce*bounce*uTorch.w*.014);
    }
    if(scatter>0.){
      // So the turn into shade is gradual, and it stays warm with the colour of the stuff.
      float NoD=dot(nd,L),wrap=scatter*.55,gain=clamp((NoD+wrap)/(1.+wrap),0.,1.)-max(NoD,0.);
      rgb+=dif/PI*lamp*gain*mix(1.,sh*mix(1.,ao,.3),.6)*mix(vec3(1.),sqrt(alb),scatter);
    }
    if(sheen>0.){
      // A velvety surface holds light at a glancing angle, which is what makes it look soft.
      float NoH=max(dot(n,normalize(v+L)),0.),sinH=sqrt(max(1.-NoH*NoH,0.)),fall=pow(1.-max(dot(n,v),.02),2.);
      vec3 fuzz=mix(alb,vec3(1.),.12)*sheen;
      rgb+=fuzz*pow(sinH,3.)*max(dot(n,L),0.)*lamp*(.05+.6*fall)*sh*mix(1.,ao,.3);
      rgb+=fuzz*textureLod(tRoom,oct(normalize(inRoom(n))),4.8).a*amb*fall*ao*.7;
    }
    // The room: what's mirrored of it, by how rough, and the plain light matt things take.
    vec2 ab=textureLod(tDFG,vec2(NoV,rough),0.).rg;
    vec3 f2=gFilm>0.?thin(NoV,f0):f0,F=(f2*ab.x+ab.y)*(1.+f2*(1./(ab.x+ab.y)-1.));
    vec3 Rr=facing(reflect(-v,n),pm);
    // What stands between a surface and the bright side of the room takes that away too, or a shadow on metal is only a lamp gone.
    float kept=ao*clamp(ao+NoV-.6,.15,1.)*mix(1.,sky,.45);
    // Smooth metal looks one way, so only what's on that line can hide the room from it: three reads of the heights along it, and a
    // rolled edge that looks out past everything keeps all the room.
    float ln=max(length(Rr.xy),.01),sharp=c.g*polish*(1.-smoothstep(.6,.9,Rr.z));
    if(sharp>0.){
      float up=0.;
      for(float t=.5;t<5.;t*=3.) up=max(up,textureLod(tHalf,onMap(pm+Rr.xy/ln*t),0.).r-max(h+t*Rr.z/ln,0.));
      kept=mix(kept,1.,sharp*(1.-smoothstep(.05,.4,up)));
    }
    float seen=textureLod(tRoom,oct(normalize(inRoom(Rr))),rough*6.).r;
    if(an>.001){
      vec3 Tn=normalize(T-n*dot(T,n));
      float aa=rough*rough;
      seen=mix(seen,brushed(Rr,cross(n,Tn).xy,aa*(1.+an),aa*(1.-an)),smoothstep(0.,.2,an));
    }
    // What the rulings send off into colours isn't mirrored: a ruled foil gives about half its light to them.
    rgb+=seen*amb*F*kept*(1.-gPile)*(1.-.5*gGrate);
    // Rulings send each colour off its own way, so each colour of the room reaches the eye from its own part of the room: where the
    // light and the eye laid flat differ by m λ / d across them. A room all one grey would come back grey; its panels' edges come back
    // as colour, which is why foil shines in any room.
    if(gGrate>0.){
      vec3 vt=v-n*dot(v,n),g3=vec3(gRuled.xy,0.);g3=normalize(g3-n*dot(g3,n)+vec3(1e-5,0.,0.));
      vec3 lam=vec3(.61,.54,.46)/gPitch,cut=vec3(0.);
      for(int m=-1;m<=1;m+=2)for(int i=0;i<3;i++){
        vec3 lt=float(m)*lam[i]*g3-vt;float q=dot(lt,lt);
        if(q<.97) cut[i]+=textureLod(tRoom,oct(normalize(inRoom(facing(lt+n*sqrt(1.-q),pm)))),rough*6.).r;
      }
      rgb+=gGrate*cut*amb*kept*.5*f0;
    }
    // What a film on clear stuff sends back never gets into it, so the room lights the body in the colours the film let through, as the
    // lamp's lobe already does: on a white body that's the film's colour turned round, pale pinks and greens.
    if(gFilm>0.&&c.g<=.5) dif*=1.-f2;
    rgb+=dif*textureLod(tRoom,oct(normalize(inRoom(n))),6.).a*amb*ao*.45*mix(1.,sky,.75);
    rgb+=dif*textureLod(tRoom,oct(normalize(inRoom(n))),2.).b*amb*ao*2.5;
    // What the room no longer reaches, nearby surfaces hand on in their own colour.
    vec4 near=textureLod(tA,uv,3.+lodS);
    rgb+=dif*near.rgb/max(near.a,.1)*(1.-ao)*.34;
    gPile=0.;
    if(c.b>.01||uPanes>0||uCracked>0){
      // A coat lies on what it coats, as smooth as that is in the large. A pane is a thing of its own over what's under it: nothing below
      // shades it, it's seen and lit where it is, on top, and each one adds a reflection. The pass after the last is the surface's own coat.
      vec4 bs=textureLod(tB,uv,lodS+.5);
      vec3 ns=vec3(getSlope(bs.rg),0.);ns.z=sqrt(max(1.-dot(ns.xy,ns.xy),.01));
      if(gUnder) ns.z=-ns.z;
      if(gWall) ns=normalize(mix(ns,side,gSide));
      vec2 at=s*uCss;
      // Broken glass is in the topmost pane here, or else in the surface's own coat: a crack is two new faces through the sheet, and each
      // piece it leaves lies a little off the others. See broken.ts.
      int ck=-1;
      vec4 K=vec4(.5,.5,0.,0.),F=vec4(0.);
      if(uCracked>0){
        K=texture(tCrack,s);
        F=texture(tFace,s);
        ck=uPanes;
        for(int i=0;i<uPanes;i++){
          int k=i*${PANE_SIZE};
          vec2 q=abs(at-vec2(uPane[k],uPane[k+1]))-vec2(uPane[k+2],uPane[k+3])+uPane[k+4];
          if(length(max(q,0.))+min(max(q.x,q.y),0.)-uPane[k+4]<.5) ck=i;
        }
      }
      for(int i=0;i<=uPanes;i++){
        vec3 nc=ns,tint=vec3(1.),vc=v,Lc=L;
        float f0c=.04,gr=coatRough,hide=ao,lit=sh,amount=c.b;
        if(i<uPanes){
          int k=i*${PANE_SIZE};
          vec2 p=at-vec2(uPane[k],uPane[k+1]),half_=vec2(uPane[k+2],uPane[k+3]);
          float r=uPane[k+4];
          vec2 q=abs(p)-half_+r;
          float d=length(max(q,0.))+min(max(q.x,q.y),0.)-r;
          if(d>=.5) continue;
          // Which way is out from here, and how fast the glass falls that way: its own dome, then the edge rolling over.
          vec2 out_=(max(q.x,q.y)>0.?normalize(max(q,0.)+.0001):q.x>q.y?vec2(1.,0.):vec2(0.,1.))*sign(p+.0001);
          float e=1.-clamp(-d/uPane[k+6],0.,1.),u=1.-clamp(-d/uPane[k+8],0.,1.);
          float drop=uPane[k+5]*e/max(sqrt(1.-e*e),.2)+4.*u*u;
          float cw=uPane[k+15];
          if(cw>0.) drop+=uPane[k+16]*smoothstep(-.5,.5,(cw+d)*uDpr);
          nc=normalize(vec3(out_*drop+p/half_*uPane[k+7],1.));
          vec3 Pc=vec3(pm,uPane[k+14]);
          vc=normalize(uCam-Pc);
          Lc=normalize(uKey-Pc);Lc=normalize(vec3(Lc.xy,max(Lc.z,.6*length(Lc.xy))));
          f0c=uPane[k+17];
          tint=vec3(uPane[k+9],uPane[k+10],uPane[k+11]);
          amount=uPane[k+12]*clamp(.5-d,0.,1.);
          gr=.02;
          // A coating takes each face from 4% down to under half a percent, in the colour its film leaves at that angle, so the dim room
          // drops out and only what's far brighter than it still shows, out of focus past the glass above it.
          if(uPane[k+13]>0.){
            float was=gFilm,stack=gStack;
            gFilm=uPane[k+13];gStack=1.;
            vec3 cf=thin(max(dot(nc,vc),.02),vec3(f0c));
            gFilm=was;gStack=stack;
            tint*=mix(vec3(1.),cf*3./max(cf.r+cf.g+cf.b,.001),.6);
            f0c=.008;
            gr=.1;
          }
          hide=lit=1.;
        // A bare sheet that broke, a screen's own glass with nothing over it, is seen by its cracks even where it isn't coated.
        }else if(c.b<=.01&&K.b<.002&&F.r<.004&&all(equal(floor(K.rg*255.+.5),vec2(128.)))) break;
        float line=0.,fa=0.;
        if(i==ck){
          fa=F.r;
          nc=normalize(nc+vec3((floor(K.rg*255.+.5)-128.)/127.*${TILT_RANGE.toFixed(4)},0.)*nc.z);
          line=K.b;
        }
        float Fc=(f0c+(1.-f0c)*pow(1.-max(dot(nc,vc),.02),5.))*amount;
        rgb*=1.-Fc;
        vec3 seen=textureLod(tRoom,oct(normalize(inRoom(facing(reflect(-vc,nc),pm)))),max(gr-.02,0.)*6.).g*amb/max(uFill,.1);
        // The room's panels are a couple of times paper white, where a real softbox is tens of times it: a coating cuts so deep that only
        // that range is left, so it's put back, as a guess.
        if(i<uPanes&&uPane[i*${PANE_SIZE}+13]>0.) seen*=seen*seen/.64;
        rgb+=seen*Fc*hide*tint;
        rgb+=lobe(nc,vc,Lc,vec3(1.,.95,.86)*.6923*lamp,vec3(0.),vec3(f0c),gr,0.,vec3(1.,0.,0.),0.)*lit*amount*tint;
        if(beam>.002) rgb+=lobe(nc,vc,i<uPanes?normalize(uTorch.xyz-vec3(pm,uPane[i*${PANE_SIZE}+14])):Lt,beamTint*beam,vec3(0.),vec3(f0c),gr,0.,vec3(1.,0.,0.),0.)*(i<uPanes?1.:st)*amount*tint;
        if(line>.002){
          // The crack's faces stand square to the sheet, rough as broken stuff is. What's under loses what they turn aside, and they send
          // back light that crosses them: a lamp across the crack lights it, one along it hardly, and the room on either side of it.
          float a=K.a*PI;
          vec2 nf=vec2(-sin(a),cos(a));
          float across=abs(dot(Lc.xy,nf));
          vec3 sides=(textureLod(tRoom,oct(normalize(inRoom(vec3(nf,.5)))),3.).g+textureLod(tRoom,oct(normalize(inRoom(vec3(-nf,.5)))),3.).g)*amb/max(uFill,.1);
          // Broken faces aren't flat: along its length one catches the light here and not a millimetre on, so it glints in runs, and
          // between them it's still a line, fainter: over a lit screen a crack never breaks into dashes.
          vec2 q=at/7.,qi=floor(q),qf=fract(q),qu=qf*qf*(3.-2.*qf);
          float rough_=mix(mix(rnd(qi),rnd(qi+vec2(1.,0.)),qu.x),mix(rnd(qi+vec2(0.,1.)),rnd(qi+1.),qu.x),qu.y);
          float glint=.45+1.1*smoothstep(.45,.85,rough_);
          rgb*=1.-line*.6;
          gCrack=max(gCrack,line*.75);
          rgb+=(sides*.08*glint+vec3(1.,.95,.86)*.6923*lamp*lit*(.01+1.2*across*across*across)*glint)*line*tint;
        }
        if(fa>.004){
          // In thick glass a crack is seen beside itself: its face slants down through the sheet, and from inside, glass to air, it turns
          // back most of what reaches it. So it's a silvery band, as wide as the sheet is thick times how far it leans, showing the room
          // tilted hard and the lamp in streaks: a face that broke fast is rippled square to the crack (hackle), so the light runs in
          // stripes across the band. Where its sides have barely parted, the gap of air between them shows colours, as a soap film does.
          float a=K.a*PI;
          vec2 nf=vec2(-sin(a),cos(a)),tf=vec2(cos(a),sin(a));
          // Hackle is fine, a few tenths of a millimetre apart, and only tips the face a little.
          float along=dot(at,tf)*.25,rip=sin(along*18.+4.*sin(along*1.3))*.5+.5;
          vec3 nh=normalize(vec3(nf*1.4+tf*(rip-.5)*.25,.7));
          vec3 mirror=textureLod(tRoom,oct(normalize(inRoom(facing(reflect(-vc,nh),pm)))),2.5).g*amb/max(uFill,.1);
          float was=gFilm;
          gFilm=.12+.55*F.g;
          vec3 film=thin(max(dot(nh,vc),.05),vec3(.04));
          gFilm=was;
          film=mix(vec3(1.),film*3./max(film.r+film.g+film.b,.001),.3*(1.-F.g));
          float hit=abs(dot(normalize(Lc.xy+.0001),nf));
          rgb*=1.-fa*.3;
          rgb+=(mirror*.22+vec3(1.,.95,.86)*.6923*lamp*lit*.06*(.6+.4*rip)*hit*hit)*film*fa*tint;
          gCrack=max(gCrack,fa*.45);
        }
      }
    }
    // What glows, as it is, and what lands of it on what's round it: exposure is for what the lamps light. A coat doesn't reach it,
    // as it comes from under one. Anything takes a little of it, unless it's black right through, like print on a lit bar.
    if(uGlows>0){
      rgb+=textureLod(tE,uv,0.).rgb*4.*(1.-c.a)*(.35+.65*pow(clamp(n.z,0.,1.),4.))/EXPOSURE*(1.-gCrack);
      rgb+=spill(s,n,h,lodS)*(dif*.9+.09*smoothstep(0.,.006,dot(alb,vec3(1.))))*mix(.55,1.,ao);
    }
    // A picture the stage keeps is light, for its camera. One copied to a canvas of its own is finished here.
    rgb*=gNear*EXPOSURE;
    if(!uLinear) rgb=encode(neutral(rgb));
    if(uDebug>0){
      // A map shown as it is: what's lit stops at the split, or at the edge of the torch's pool.
      vec3 lit=rgb,m=vec3(clamp(c.r,.03,1.));
      if(uDebug==1) m=pow(alb,vec3(1./2.2));
      // The face is grey, lighter up to the tallest thing on it and as much darker below, so a thick body reads as well as a thin one.
      else if(uDebug==2) m=vec3(clamp(.5+.5*(h-uFace)/max(uPeak-uFace,1.),0.,1.));
      else if(uDebug==3) m=n*.5+.5;
      else if(uDebug==5) m=vec3(c.g);
      else if(uDebug==6) m=uGlows>0?pow(clamp(textureLod(tE,uv,0.).rgb*4.,0.,1.),vec3(1./2.2)):vec3(0.);
      else if(uDebug==7) m=vec3(b.b);
      if(uLinear) m=decode(m);
      rgb=uSplit>=0.?mix(lit,m,step(uSplit,pm.x)):uTorch.w>0.?mix(m,lit,smoothstep(.94,1.,offAxis(P))):m;
    }
  }
  return vec4(rgb*cov,cov+(1.-cov)*shA);
}
void main(){
  if(uLean==vec2(0.)&&uSpin.y<=0.) o=shade(vUv);
  else{
    vec2 uv=land(vUv);
    // Where the landing point jumps, the ray has crossed an edge, and one ray per pixel leaves it stepped. Only those pixels pay for more.
    vec2 jump=(abs(dFdx(uv))+abs(dFdy(uv)))*uCss*uDpr/vec2(abs(uSpin.x),1.);
    if(max(jump.x,jump.y)<2.2) o=shade(uv);
    else{
      vec2 px=1./(uCss*uDpr);
      o=(shade(land(vUv+px*vec2(-.125,-.375)))+shade(land(vUv+px*vec2(.375,-.125)))
        +shade(land(vUv+px*vec2(.125,.375)))+shade(land(vUv+px*vec2(-.375,.125))))*.25;
    }
  }
  if(!uLinear) o.rgb+=(rnd(gl_FragCoord.xy+uShift)-.5)/255.*o.a;
}`;
