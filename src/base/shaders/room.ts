// What everything reflects. It is drawn once into a square map, then blurred into a chain
// of levels, one per roughness, so a reflection costs one read however rough the surface is.
//
// Directions: x right, y down the page, z out of the page towards the viewer.

/** Folds the sphere into a square, with straight up at the centre, where most surfaces look. */
export const OCT = `
vec2 oct(vec3 r){
  r/=abs(r.x)+abs(r.y)+abs(r.z);
  vec2 p=r.z>=0.?r.xy:(1.-abs(r.yx))*vec2(r.x>=0.?1.:-1.,r.y>=0.?1.:-1.);
  return p*.5+.5;
}
vec3 unoct(vec2 uv){
  vec2 p=uv*2.-1.;
  vec3 n=vec3(p,1.-abs(p.x)-abs(p.y));
  float t=max(-n.z,0.);
  n.x+=n.x>=0.?-t:t;
  n.y+=n.y>=0.?-t:t;
  return normalize(n);
}`;

const RADICAL = `
float radical(uint b){
  b=(b<<16u)|(b>>16u);
  b=((b&0x55555555u)<<1u)|((b&0xAAAAAAAAu)>>1u);
  b=((b&0x33333333u)<<2u)|((b&0xCCCCCCCCu)>>2u);
  b=((b&0x0F0F0F0Fu)<<4u)|((b&0xF0F0F0F0u)>>4u);
  b=((b&0x00FF00FFu)<<8u)|((b&0xFF00FF00u)>>8u);
  return float(b)*2.3283064365e-10;
}`;

export const ROOM_LEVELS = 7;
/** How many panes of glass a device can give a surface of their own, and how many numbers each takes. */
export const PANES = 8;
export const PANE_SIZE = 18;

/** How many panels a room can have. */
export const PANELS = 6;

export const ROOM_VS = `#version 300 es
void main(){
  vec2 c=vec2(gl_VertexID&1,(gl_VertexID>>1)&1);
  gl_Position=vec4(c*2.-1.,0.,1.);
}`;

export const ROOM_FS = `#version 300 es
precision highp float;
out vec4 o;
uniform float uSize,uDark,uGlow,uTent;
uniform int uPanels;
uniform vec4 uPanelAt[${PANELS}];
uniform vec2 uPanelLight[${PANELS}];
${OCT}
// Metal has no look of its own: it shows what it faces. So over the object hangs a dark room with big soft panels in
// it, turned so no edge lines up with anything built, and with nothing in them to recognise. A flat plate gets a run
// from bright to dark across it, as in a product photograph. Alpha keeps the plain even light that diffuse surfaces
// take, brightest overhead and to the top left, where the lamp is, so a matt thing is lit the same as it ever was.
// Blue is what a matt surface gets back as it turns away, from the tent and off the lit table.
// Green is the same room as clear glass sees it. Metal smears a panel however polished it is, so red's panels can fade
// out, but glass mirrors one with a hard edge and nothing else, and that edge is how an eye knows there's glass at all.
float panel(vec2 p,vec2 c,vec2 h,float s){
  vec2 d=abs(p-c)-h;
  return(1.-smoothstep(-s,s,d.x))*(1.-smoothstep(-s,s,d.y));
}
void main(){
  vec3 d=unoct(gl_FragCoord.xy/uSize);
  float t=smoothstep(.1,.97,dot(d,normalize(vec3(-.25,-.3,1.)))),l=uDark,g=uDark*.4;
  if(d.z>.02){
    vec2 p=d.xy/d.z,q=mat2(.929,.371,-.371,.929)*p;
    l+=uGlow*max(0.,1.-.3*length(p));
    for(int i=0;i<uPanels;i++){
      l+=panel(q,uPanelAt[i].xy,uPanelAt[i].zw,uPanelLight[i].x)*uPanelLight[i].y;
      g+=panel(q,uPanelAt[i].xy,uPanelAt[i].zw,uPanelLight[i].x*.04)*uPanelLight[i].y;
    }
  }
  // Round the sides and below the room is pale, as in a tent, so what turns away at an edge meets light and not black.
  float tent=uTent*(1.-smoothstep(.55,.95,d.z));
  // Below the horizon is the table, lit on the lamp's side and in the object's own shadow on the far one. Glass and what's matt don't
  // pick that out, but a steep polished edge sees little else, and bright down one side and dark down the other is how it reads as chrome.
  float table=mix(.5,3.2,smoothstep(-.3,.1,dot(normalize(d.xy+1e-5),vec2(-.6,-.8))));
  o=vec4(l+tent*mix(table,1.,smoothstep(-.1,.4,d.z)),g+tent,uTent*max(1.-d.z,0.),mix(.1,.98,t));
}`;

// How much of a uniform room a surface hands back, by angle and roughness, as the scale and bias on f0. Integrated
// once with the same GGX and visibility the lamp uses, since no fit holds at the roughness of brushed metal.
export const DFG_SIZE = 64;
export const DFG_FS = `#version 300 es
precision highp float;
precision highp int;
out vec4 o;
${RADICAL}
float V(float NoV,float NoL,float a2){
  return .5/max(NoL*sqrt(NoV*NoV*(1.-a2)+a2)+NoV*sqrt(NoL*NoL*(1.-a2)+a2),.0005);
}
void main(){
  vec2 uv=gl_FragCoord.xy/${DFG_SIZE.toFixed(1)};
  float NoV=max(uv.x,.02),a=max(uv.y*uv.y,.0016),a2=a*a;
  vec3 v=vec3(sqrt(1.-NoV*NoV),0.,NoV);
  vec2 sum=vec2(0.);
  const int N=1024;
  for(int i=0;i<N;i++){
    float u=(float(i)+.5)/float(N),phi=6.2831853*radical(uint(i));
    float c=sqrt((1.-u)/(1.+(a2-1.)*u)),s=sqrt(max(1.-c*c,0.));
    vec3 h=vec3(s*cos(phi),s*sin(phi),c),l=reflect(-v,h);
    float NoL=l.z,VoH=dot(v,h);
    if(NoL<=0.||VoH<=0.) continue;
    // What GGX weights by, once sampling it has cancelled its D.
    float g=V(NoV,NoL,a2)*4.*NoL*VoH/h.z,f=pow(1.-VoH,5.);
    sum+=vec2(1.-f,f)*g;
  }
  o=vec4(sum/float(N),0.,1.);
}`;

// A brushed surface smears the room right across its grooves and hardly at all along them, which no level of the
// room can stand in for. So the room is also filtered through stretched lobes, once, one layer per turn of the lobe
// and how far it reaches. Its mips add the narrow side. Grey, as the room is.
export const BRUSH_SIZE = 128;
export const BRUSH_TURNS = 8;
export const BRUSH_REACH = [0.06, 0.12, 0.25, 0.5];
export const BRUSH_LEVELS = 4;
/** The narrow side of the lobe at the top of those mips. */
export const BRUSH_THIN = 0.02;
export const BRUSH_FS = `#version 300 es
precision highp float;
precision highp int;
out vec4 o;
uniform sampler2D tRoom;
uniform float uSize,uTurn,uReach,uThin;
${OCT}
${RADICAL}
void main(){
  vec3 R=unoct(gl_FragCoord.xy/uSize),a=vec3(cos(uTurn),sin(uTurn),0.);
  vec3 U=normalize(a-R*dot(a,R)+vec3(0.,0.,1e-4)),W=cross(R,U);
  float sum=0.,weight=0.;
  const int N=96;
  for(int i=0;i<N;i++){
    float u=(float(i)+.5)/float(N),e=6.2831853*radical(uint(i));
    float phi=atan(uThin*sin(e),uReach*cos(e)),c=cos(phi),s=sin(phi);
    float t=sqrt(u/(1.-u)/(c*c/(uReach*uReach)+s*s/(uThin*uThin)));
    vec3 H=normalize(R+t*(U*c+W*s)),L=reflect(-R,H);
    float NoL=dot(R,L);
    if(NoL<=0.) continue;
    sum+=textureLod(tRoom,oct(L),1.).r*NoL;
    weight+=NoL;
  }
  o=vec4(sum/max(weight,.0001),0.,0.,1.);
}`;

// Roughness spreads a reflection, so each level is the room seen through a wider lobe of GGX.
export const FILTER_FS = `#version 300 es
precision highp float;
precision highp int;
out vec4 o;
uniform sampler2D tRoom;
uniform float uRough,uSize,uSource;
uniform int uSamples;
const float PI=3.14159265;
${OCT}
${RADICAL}
void main(){
  vec3 N=unoct(gl_FragCoord.xy/uSize);
  vec3 up=abs(N.z)<.999?vec3(0.,0.,1.):vec3(1.,0.,0.);
  vec3 T=normalize(cross(up,N)),B=cross(N,T);
  float a=max(uRough*uRough,.002),a2=a*a;
  float texel=4.*PI/(uSource*uSource);
  vec4 sum=vec4(0.);
  float weight=0.;
  for(int i=0;i<uSamples;i++){
    float u=(float(i)+.5)/float(uSamples),v=radical(uint(i));
    float cosT=sqrt((1.-u)/(1.+(a2-1.)*u)),sinT=sqrt(max(1.-cosT*cosT,0.)),phi=6.2831853*v;
    vec3 H=normalize(T*sinT*cos(phi)+B*sinT*sin(phi)+N*cosT);
    vec3 L=reflect(-N,H);
    float NoL=dot(N,L);
    if(NoL<=0.) continue;
    // Taking a level that matches the sample's footprint keeps the softbox from turning to dots.
    float dn=cosT*cosT*(a2-1.)+1.,pdf=a2/(PI*dn*dn)*.25+.0001;
    float lod=.5*log2(1./(float(uSamples)*pdf)/texel)+1.;
    sum+=textureLod(tRoom,oct(L),max(lod,0.))*NoL;
    weight+=NoL;
  }
  o=sum/max(weight,.001);
}`;
