// What the player's light and the stage's camera share: sizes, the tone curve, and how a body is seen from off straight-on.
export const FULL_VS = `#version 300 es
precision highp float;
out vec2 vUv;
void main(){
  vec2 c=vec2(gl_VertexID&1,(gl_VertexID>>1)&1);
  vUv=vec2(c.x,1.-c.y);
  gl_Position=vec4(c*2.-1.,0.,1.);
}`;

export const DEBUG_VIEWS = ['', 'albedo', 'height', 'normal', 'roughness', 'metal', 'emissive', 'occlusion'] as const;
export type DebugView = Exclude<(typeof DEBUG_VIEWS)[number], ''>;

/** How much height the map of what stands nearby covers at its finest, mm. Something taller doubles it until it fits, and takes coarser steps. */
export const MAX_HEIGHT = 40;
/** How far a view ray can wander and still trust the map of what stands nearby, css px. */
export const NEAR = 48;

/** How many flashes and flames light a device at once: the strongest of them on it. */
export const POINTS = 4;

/** Light to the screen: the tone curve and the screen's encoding, shared by the light pass and the stage's camera. */
export const TONE = `
// Linear light to the screen. Hex colours are read with the same curve, so what comes in goes back out.
vec3 encode(vec3 c){return mix(12.92*c,1.055*pow(c,vec3(1./2.4))-.055,step(.0031308,c));}
vec3 decode(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(.04045,c));}
// Khronos PBR Neutral: colour stays as it is until it nears white, then only the brightest part bends. The toe
// is smaller than theirs, or a black part loses the faint sheen real black things have, and with it its shape.
vec3 neutral(vec3 c){
  const float K=.015,DES=.15,S=.8-K;
  float x=min(c.r,min(c.g,c.b)),f=x<2.*K?x-x*x/(4.*K):K;
  // Taking the same off every channel would turn anything pale muddy as the light on it went, so in the dark the whole
  // colour scales by the same toe, read from its brightest channel.
  float m=max(c.r,max(c.g,c.b)),g=m<2.*K?m*.25/K:1.-K/max(m,2.*K);
  c=mix(c*g,c-f,smoothstep(.03,.1,m));
  float p=max(c.r,max(c.g,c.b));
  if(p<S) return c;
  float d=1.-S,n=1.-d*d/(p+d-S);
  c*=n/p;
  return mix(c,vec3(n),1.-1./(DES*(p-n)+1.));
}`;

/**
 * How a body is seen from off straight-on: where a view ray lands on it, leaning or set at an angle (`land`), and on one turning over
 * (`across`). The same for whatever lights it, which says how it keeps heights and where the eye is: `topOf`, `underOf` and `rise` as the
 * core has them, `viewSlope` and `nearTop`. It reads uCss, uCam, uFace, uPeak, uDpr, uBody, uSpin, uRound and uOwn, and MM.
 */
export const LIGHT_VIEW = `// How far a view ray goes across for each mm it comes down, at a place on the face, mm.
vec2 viewSlope(vec2 at);
// The tallest thing near a place, which is as high as a ray landing there need start.
float nearTop(vec2 s);
// How much light reaches where the ray landed, if that's on a wall with something standing on it.
float gNear=1.;
// The ray went on under what stands clear and reached the page, so that's what it landed on, whatever the texel holds.
bool gGround=false;
// A wall has no texels of its own, so nothing can darken it. But the ray knows how deep it landed, so it can tell how far
// that is from what stands on the wall, the next texels along, and that's a contact shadow that needs no drawing.
float contact(vec2 uv,float z,vec2 du){
  float far=length(du*uCss),top=topOf(uv);
  if(far<.001||top-z<1.) return 1.;
  vec2 q=uv-du/far*2.;
  float low=underOf(q);
  if(low<1.||top-topOf(q)<1.) return 1.;
  float off=max(max(low-z,z-topOf(q)),0.);
  return mix(.3,1.,smoothstep(0.,5.,off));
}

// Halves the last step until it finds where the ray goes in.
vec2 enters(vec2 uv,float z,vec2 du,float dz){
  float k=.5,s=.25;
  for(int i=0;i<5;i++){
    float zk=z+dz*(1.-k);
    vec2 q=uv-du*(1.-k);
    k+=zk<=topOf(q)&&zk>underOf(q)?-s:s;
    s*=.5;
  }
  return uv-du*(1.-k);
}

// Follows the view ray down through the height until it lands, so a tall part leans and its
// side comes into view. A pixel is one texel of travel, so a head-on view takes few steps.
// Whether a ray on a turning body met it, which makes what it landed on solid however thin the edge of the picture is there, how high, and whether that was on a wall.
bool gHit=false,gWall=false;
// How far a wall is seen as a side of its own, square on, and not as the edge of the top beside it. A turn eases into that, as it eases out of the view's lean.
float gSide=0.;
// Turned away, the ray came in under something standing clear, so what it sees is the side of that facing down: the top the other way up.
bool gUnder=false;
float gZ=0.;
vec2 gFace=vec2(0.);
// A body turning over has two faces or more and a plate holds one, so each draws the part of the body nearer it than any other face.
// Front and back split at the plane through the middle, and a side takes what's nearer it than either, out to the diagonals of the box.
// The face that's up takes a ray from its top down. The first thing it goes into is what it sees, and it's only this face's if it's this face's part.
// One that reaches the plane has missed this half, and the face turned away takes it from there up to its own top. So what stands on any face
// comes into view as it should, and none reads another's textures.
vec2 across(vec2 s,vec2 slope,vec2 size){
  float mid=uBody.x*MM/size.x,plane=uFace-uSpin.y,sn=uRound.x,cs=uRound.y,M=uBody.x*MM;
  // Part of the slope is only the viewer stepped round to show the turn. What's left is the view's own lean, as a point's shift for how high it stands in the room.
  float t=sn/cs*uCam.z/(uCam.z-uFace),w=min(abs(sn)*4.,1.);
  vec2 lean=slope-vec2(-t,0.);
  // Across, the lean eases out over the first few degrees, so a face is narrowed by the turn alone and goes edge on at a right angle, with neither end of a side
  // wider than the other. Up and down it's the one lean through the middle, which is no lean on a side seen square.
  lean=mix(lean,vec2(0.,viewSlope(vec2(0.,uBody.y*MM)).y),w);
  // Turned, a point on the plane lands further from the middle than the pixel looking at it.
  s.x=mid+(s.x-mid)*uSpin.x;
  // Where a point at z on this ray is across the face: a straight line in z, solved with its lean, which goes by its height in the room and so by where it is across.
  // At rest that's the ray as land() takes it, so a turn settling down hands over without a jump.
  float k=lean.x/cs,D=1.+k*sn,A=(s.x*size.x+k*(uSpin.y+M*sn))/D,B=(t-lean.x)/D;
  bool away=cs<0.;
  gGround=true;
  // Each half runs a pixel or so past the plane into the other's, where both are the same side wall. Stopping dead on it,
  // the two edges meet with a sliver of page between them.
  // A side's own ground is inside the body, where there's nothing to meet, so no ray goes down to it.
  float tol=1.5*MM/uDpr,lo=max((uOwn.y*uOwn.z>0.?max(plane,uFace-uOwn.x):plane)-tol,tol),hi=uPeak;
  // Nearly edge on a ray crosses the whole picture in a few mm of height, so all it can use is the stretch that's over it. Lugs and the like stand past the body.
  if(abs(B)>.0005){
    float a=plane-A/B,b=plane+(size.x-A)/B;
    hi=min(hi,max(a,b));
    lo=max(lo,min(a,b));
  }
  if(hi<=lo) return s;
  // Up and down, what moves a point is how high it stands in the room, and turned that's along the face as much as off it.
  // Both faces say the same height for the same point, so nothing jumps as one hands over to the other edge on.
  #define ACROSS(z) ((A+B*((z)-plane))/size.x)
  #define ALONG(z) vec2(ACROSS(z),s.y+lean.y*(uSpin.y-(ACROSS(z)-mid)*size.x*sn-((z)-plane)*cs)/size.y)
  // Coming down, a step that went right through something thin still sees it, by where it was before. Going up only sees what a step lands in,
  // so it takes no more than half a mm at a time.
  // Edge on, a ray runs the length of the face at one height, and long strides catch a thin rim on one row and miss it on the next.
  // That's only the last moment of a turn and the picture it lands on, so it can take the steps. Going round, the strides are short enough for what's seen in passing.
  int n=int(clamp(max(ceil(length(vec2(B,lean.y))*(hi-lo)/MM*min(uDpr,3.)),away?ceil((hi-lo)*2.):0.),1.,abs(cs)<.006?512.:96.));
  float dz=(hi-lo)/float(n)*(away?1.:-1.),z=away?lo:hi;
  // Inside is under the top and over whatever is under that, so something standing clear has air beneath it.
  #define INSIDE(z,uv) ((z)<=topOf(uv)&&(z)>underOf(uv))
  // Starting inside the body, the ray was the other half's.
  if(INSIDE(z,ALONG(z))) return s;
  // Toward an end that meets another face, what's nearer that face is that face's, and so is all that's past the end. What stands clear of the body, as lugs do, is front and back's.
  #define OWNED(z,uv) ((z)>=(underOf(uv)>0.?plane:max(plane,OWNS(ACROSS(z)*size.x-M)))-tol)
  #define OWNS(dx) ((dx<0.?uOwn.y:uOwn.z)>0.?uFace-uOwn.x+abs(dx):plane)
  for(int i=0;i<n;i++){
    float a=z;
    z+=dz;
    vec2 uv=ALONG(z);
    // Coming down, a ray lands on a top. Going up from the middle, it comes in under whatever is there, the near side of it from the face turned away.
    if(away?INSIDE(z,uv):z<=topOf(uv)&&a>underOf(uv)){
      // A step is up to half a mm across a wall, and where it lands in the wall's few texels shows as ripples. So halve it down.
      float b=z;
      for(int k=0;k<6;k++){
        float m=(a+b)*.5;
        if(away?!INSIDE(m,ALONG(m)):m>topOf(ALONG(m))) a=m;else b=m;
      }
      uv=ALONG(b);
      if(!OWNED(b,uv)) return s;
      gUnder=away&&underOf(uv)>0.;
      gGround=false;
      gHit=true;
      gZ=b;
      // Bisected, it sits right on the height, so what says it's a wall is how fast the height falls either side of it.
      vec2 e=1./(uCss*uDpr);
      gWall=abs(topOf(uv-vec2(e.x,0.))-topOf(uv+vec2(e.x,0.)))+abs(topOf(uv-vec2(0.,e.y))-topOf(uv+vec2(0.,e.y)))>6.*MM/uDpr;
      if(gWall){
        gSide=w;
        // Which way it faces is which way the height falls away, taken wide enough that where in its few texels a ray landed doesn't show.
        float l=2.+log2(uDpr);
        vec2 w=e*exp2(l)*1.5,g=vec2(rise(uv-vec2(w.x,0.),l)-rise(uv+vec2(w.x,0.),l),rise(uv-vec2(0.,w.y),l)-rise(uv+vec2(0.,w.y),l));
        gFace=g/max(length(g),.001);
        // A wall has no texels of its own, and what it's made of is what stands at the top of it.
        uv-=gFace*.75*w/size;
      }
      return uv;
    }
  }
  return s;
}

vec2 land(vec2 s){
  gHit=gWall=gUnder=false;
  gSide=0.;
  gNear=1.;
  gGround=false;
  vec2 size=uCss*MM,at=s*size;
  vec2 slope=viewSlope(at);
  if(uSpin.y>0.) return across(s,slope,size);
  // It can only land on what stands near it, so it starts above that, not above the whole device.
  float top=length(slope)*uPeak/MM<${NEAR}.?nearTop(s):uPeak;
  int n=int(clamp(ceil(length(slope)*top/MM*min(uDpr,3.)),1.,96.));
  float dz=top/float(n),z=top;
  vec2 uv=s+slope*(uFace-top)/size,du=slope*dz/size;
  float was=z-topOf(uv);
  for(int i=0;i<n;i++){
    z-=dz;
    uv+=du;
    float gap=z-topOf(uv);
    // One that was already below an underside goes on under it, so only a ray that lands looks there.
    if(gap<=0.&&z+dz>underOf(uv)){
      gNear=contact(uv,z,du);
      // Across a wall the two ends say nothing about where it stood, and guessing leaves a stair round anything thin.
      if(was-gap>dz*2.) return enters(uv,z,du,dz);
      return uv-du*(1.-was/max(was-gap,.0001));
    }
    was=max(gap,0.);
  }
  // Past what stands clear and on down to the ground, where the texel is still the part's and showing it would lay a copy on the page.
  gGround=underOf(uv)>0.;
  return uv;
}
`;
