// Paints one command at a time into the material channels, in physical units.
//   tA  albedo rgb, coverage a         (SRGB8_ALPHA8)
//   tH  height mm r, tangent*aniso gb  (RGBA32F, or half floats step on tall slopes)
//   tS  rough r, metal+film g / 2, coat b  (RGBA8)
//   tE  emissive rgb / 4               (SRGB8_ALPHA8)
//   tM  on bare stuff sheen / 2, or .5 + film / 2 where a film lies on it; a clear coat's roughness where there is coat; on bare metal
//       .5 + grooves' tilt. scatter g, marks b  (RGBA8)
//   tD  relief mm r, kept apart from height when height is in half floats  (R16F)
//   tN  with SPLIT, height has a full float to itself (R32F), and tangent*aniso rg and coverage a are here instead, rg as
//       .5 + .25 × each so a screen's mark of 2 fits. Covered paints write it as they do height; what adds to height adds nothing here  (RGBA8)
//   tU  underside mm r, for what stands clear of the ground: nothing's solid below it  (R16F)
//
// Shapes are distances. Surfaces, cuts, ink and glow all read the same distance,
// so anything that works on a rounded rect works on a font glyph.

export const QUAD_VS = `#version 300 es
precision highp float;
uniform vec2 uCanvas;
uniform vec4 uBox;
out vec2 vPx;
void main(){
  vec2 c=vec2(gl_VertexID&1,(gl_VertexID>>1)&1);
  vPx=mix(uBox.xy,uBox.zw,c);
  gl_Position=vec4(vPx/uCanvas*2.-1.,0.,1.);
}`;

export const SHAPE = { rect: 0, capsule: 1, field: 2, holes: 3, mask: 4, arc: 5 } as const;
export const MODE = { surface: 0, cut: 1, ink: 2, glow: 3, screen: 4, glass: 5, frost: 6, light: 7 } as const;
export const SCREEN = { crt: 0, led: 1, lcd: 2, oled: 3, eink: 4, coat: 5, tft: 6 } as const;
export const PATTERN = { twill: 1, knit: 2, wood: 3, stone: 4, terrazzo: 5, leather: 6, pebble: 6, hex: 7, knurl: 8, hazard: 9, ribs: 10, foil: 11, dots: 12, pits: 13, stipple: 0, lines: 0 } as const;
export const PROFILE = { flat: 0, round: 1, chamfer: 2, dome: 3, blend: 4 } as const;

// A command's values go up in one block. Set one at a time, they were most of the cost of a paint.
const COMMAND = `layout(std140) uniform Command{
  vec4 uBox,uCap,uSeen,uFrom,uReach;
  // Where this face's outline's insets start, their step and count, in uRows: see \`across\`.
  vec4 uOutline;
  // Where the maps are on the canvas, which reach only as far as what's drawn: see the light pass.
  vec4 uMap;
  // Where frost's copy of what's under it, and a bridge's of the heights, lie on the maps: each is only as big as what reads it.
  vec4 uBackBox,uUnderBox;
  int uEdge;
  vec2 uCanvas,uCenter,uHalf,uSeed,uSpread,uCapR,uSubRM,uBareRM,uCrown,uDish,uTilt,uBendDir,uBendAt,uInset;
  vec3 uRipple,uColor,uColor2,uSub,uBare,uCoatTint,uPatina,uEmit,uGrain,uInk,uHoles;
  int uShape,uMode,uProfile,uRadial,uKind,uPattern,uBendBoth,uFollow;
  float uRadius,uRot,uBevel,uZEdge,uZTop,uMid;
  float uRough,uMetal,uCoat,uAniso,uTangent,uPeel,uWave,uRelief,uFeature,uSlope,uAcross,uMottle,uFleck,uWear,uDepth,uSoftLod,uWidth,uFeather;
  float uAge,uPatinaOn,uPatinaRough,uTouch,uDents,uFade,uRings,uPores,uFilmVary,uLeak;
  float uGain,uScale,uFilm,uBlur,uZoom,uOpacity,uTransmit,uBendReach,uBendDrop,uBendK,uGrow,uRing;
  float uSheen,uScatter,uMarks,uPolish,uBroad,uCoatRough;
  // How many of the sheet's pixels go to one shown: see PlateSpec.fine.
  float uShown;
  // What a mark lies on, which it stops at: its middle and half size, its corners, its turn and how far its field reaches.
  vec4 uClip;
  vec2 uClipSpread;
  float uClipRadius,uClipRot;
  // How chips run on a surface, and on what a mark is printed on: its wear, the seed it was drawn with, how big its chips are.
  vec2 uGroundSeed;
  float uChip,uGroundWear;
  int uClipShape;
};`;

// The surface's own working: what a command's values make of a surface at one point. It needs MM and PI, and the command's
// values under their uniform names.
const SURFACE = `mat2 rm(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
// Short factors repeat every 50 cells, which shows as bars in any fine noise.
float hash(vec2 p){p=fract(p*vec2(123.3417,456.2113));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vnoise(vec2 p){
  vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
}
// Scratches across a line, from the spacing up, each band three times wider and fainter. A scratch is a row of its
// own, about 40 spacings long whatever its width, and fades out where it likes, so no two end together. Only those a
// texel can tell apart. Comes to about one standard deviation.
float lined(float across,vec2 along,float pitch,float texel){
  float s=0.,e=0.,f=pitch,l=pitch*40.,amp=1.;
  for(int i=0;i<3;i++){
    float row=2.*across/f+.8*vnoise(along/(f*160.)),r=floor(row),k=fract(row),b=float(i)*9.;
    float a=vnoise(along/l+vec2(hash(vec2(r,b))*91.,r+b)),c=vnoise(along/l+vec2(hash(vec2(r+1.,b))*91.,r+1.+b));
    s+=amp*smoothstep(.7,1.6,.5*f/texel)*(mix(a,c,k*k*(3.-2.*k))-.5);
    e+=amp*amp;
    f*=3.;l*=1.5;amp*=.42;
  }
  return s*1.6/sqrt(e);
}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*vnoise(p);p=mat2(1.62,1.19,-1.19,1.62)*p+17.1;a*=.5;}return s/.9375;}
float scratch(vec2 w,float ang,float seed,float amount){
  vec2 q=(rm(ang)*w)*vec2(.028,.55);
  float row=floor(q.y);
  float on=step(.988-amount*.05,hash(vec2(row,seed)));
  float seg=smoothstep(.56,.68,vnoise(vec2(q.x+row*3.1,row+seed)));
  float line=1.-abs(fract(q.y)-.5)*2.;
  return on*seg*smoothstep(.45,.95,line);
}

// Distance to the nearest cell point, the second nearest, and a number for the cell.
vec3 cells(vec2 g){
  vec2 i=floor(g);float a=9.,b=9.,id=0.;
  for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
    vec2 c=i+vec2(x,y);
    float e=length(g-c-vec2(hash(c),hash(c+7.3)));
    if(e<a){b=a;a=e;id=hash(c+3.1);}else if(e<b)b=e;
  }
  return vec3(a,b,id);
}

// How far a point is from the nearest border between cells, in cell spacings, and a number for that border, the same from either side.
vec2 crack(vec2 g){
  vec2 i=floor(g),f=g-i,mr=vec2(0.),mc=vec2(0.);float a=9.;
  for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
    vec2 c=vec2(x,y),o=c+vec2(hash(i+c),hash(i+c+7.3))-f;
    float e=dot(o,o);if(e<a){a=e;mr=o;mc=c;}
  }
  float d=9.,id=0.;
  for(int y=-2;y<=2;y++)for(int x=-2;x<=2;x++){
    vec2 c=mc+vec2(x,y),o=c+vec2(hash(i+c),hash(i+c+7.3))-f;
    if(dot(o-mr,o-mr)>.00001){float e=dot(.5*(mr+o),normalize(o-mr));if(e<d){d=e;id=hash(i*2.+mc+c+.37);}}
  }
  return vec2(d,id);
}

// How far a point is inside its cell, from the nearest border, in cell spacings, and a number for the cell.
vec2 shard(vec2 g){
  vec2 i=floor(g),f=g-i,mr=vec2(0.),mc=vec2(0.);float a=9.;
  for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
    vec2 c=vec2(x,y),o=c+vec2(hash(i+c),hash(i+c+7.3))-f;
    float e=dot(o,o);if(e<a){a=e;mr=o;mc=c;}
  }
  float d=9.;
  for(int y=-2;y<=2;y++)for(int x=-2;x<=2;x++){
    vec2 c=mc+vec2(x,y),o=c+vec2(hash(i+c),hash(i+c+7.3))-f;
    if(dot(o-mr,o-mr)>.00001) d=min(d,dot(.5*(mr+o),normalize(o-mr)));
  }
  return vec2(d,hash(i+mc+3.1));
}

// Plates of a hide, each with a weight of its own, so they come in different sizes. Distance to the plate's border, and a number for it.
// The distance blends all the borders, so a plate is a dome and not a roof with a ridge along it.
vec2 hide(vec2 g){
  vec2 i=floor(g),m=vec2(0.);float a=99.,r0=0.,id=0.;
  for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
    vec2 c=i+vec2(x,y),o=c+vec2(hash(c),hash(c+7.3));
    float r=.22*hash(c+11.1),e=dot(g-o,g-o)-r;
    if(e<a){a=e;m=o;r0=r;id=hash(c+3.1);}
  }
  float w=0.,base=dot(g-m,g-m)-r0;
  for(int y=-2;y<=2;y++)for(int x=-2;x<=2;x++){
    vec2 c=i+vec2(x,y),o=c+vec2(hash(c),hash(c+7.3)),n=o-m;float l=dot(n,n);
    if(l<.0001) continue;
    w+=exp(-9.*((dot(g-o,g-o)-.22*hash(c+11.1))-base)/(2.*sqrt(l)));
  }
  return vec2(max(-log(max(w,1e-6))/9.,0.),id);
}

// What a surface is at a point of it, from its command's values: colour, finish, pattern, wear and age. Everything the
// material pass works out but where the surface is and how it's laid down, so a renderer that draws its pixels another way
// sees the same surface. It reads the command's values by their uniform names.
// Where chips are, and the level the field passes where one starts. Paint goes at raised edges first, and the distance tells us where they are.
float chipField(vec2 w,float size){return fbm(w*.034/size)*.6+fbm(w*.29/size+3.)*.4;}
float chipFrom(float inset,float wear,float size){return mix(.8,.5,clamp(exp(-inset/(11.*size))*wear*1.7,0.,1.))-wear*.05;}

// What a pattern makes of a surface at one point, from what was there before it: q is the point in the pattern's own spacings, p
// in the surface's frame, R its full relief, and far a texel there, css px.
struct Pat{vec3 col;float t,rough,metal,coat,aniso,tang,film;};
Pat pattern(Pat s,vec2 p,vec2 q,float R,float far){
  vec3 col=s.col;float t=s.t,rough=s.rough,metal=s.metal,coat=s.coat,aniso=s.aniso,tang=s.tang,film=s.film;
  if(uPattern==1){
    // Two-by-two twill. Tows run both ways, so each diamond catches the light differently.
    vec2 c=floor(q),f=fract(q);
    bool warp=mod(c.x-c.y,4.)<2.;
    float across=warp?f.x:f.y,b=sin(PI*across);
    t+=R*b;col*=.8+.34*b;
    aniso=max(aniso,.78);tang+=warp?0.:PI*.5;
    col*=.94+.12*vnoise(vec2(across*8.,c.x+c.y));
  }else if(uPattern==2){
    vec2 g=q*vec2(1.,1.5);float row=floor(g.y);
    g.x+=mod(row,2.)*.5;
    vec2 c=floor(g),f=fract(g)-.5;
    float b=1.-smoothstep(.05,.56,length(f*vec2(1.,1.15)));
    t+=(b-.6)*R;col=mix(col,uColor2,step(.62,hash(c+row)));col*=.42+.85*b;
    rough=clamp(rough+.1*(1.-b),.03,1.);
  }else if(uPattern==3){
    // The rings are cylinders round the pith, and a board is a flat cut through them. So they
    // run close and straight at its edges and open into arches where the cut nears the pith.
    vec2 l=rm(uTangent-uRot)*p+vec2(hash(uSeed)*2000.,(hash(uSeed+3.)-.5)*120.),g=l/uScale;
    float cut=95.+70.*sin(l.x*.0021)+14.*sin(l.x*.0063+1.);
    float r=sqrt(l.y*l.y+cut*cut)+(fbm(l*vec2(.0028,.017))-.5)*16.+(fbm(l*vec2(.017,.1)+3.)-.5)*2.6;
    // Good years are wide and hard ones thin.
    float year=r*MM/uRings+.35*sin(r*.021+1.)+.2*sin(r*.057);
    float ring=fract(year),id=floor(year);
    // A year starts pale and ends tight and dark, then stops dead at winter.
    float late=pow(ring,2.6)*smoothstep(1.,.97,ring)*(.55+.7*hash(vec2(id,2.)));
    float streak=fbm(vec2(l.x*.0021,l.y*.028)+7.);
    float fibre=vnoise(vec2(g.x*.1,g.y*6.7))*.55+vnoise(vec2(g.x*.42,g.y*13.8)+5.)*.45;
    // Some trees pack their pores into the spring wood, and that band is what you see on oak.
    float spring=smoothstep(0.,.04,ring)*smoothstep(.5,.1,ring);
    float zone=mix(.4,spring,uPores);
    float pore=smoothstep(.72-zone*.22,.82-zone*.2,vnoise(vec2(g.x*.16,g.y*4.8)+id*3.))*(.25+.75*zone)*uPores;
    col=mix(uColor,uColor2,clamp(late*.8+spring*uPores*.22+(streak-.48)*.8,0.,1.));
    col*=.93+.14*fibre;
    col*=1.-.62*pore;t-=R*pore;rough=clamp(rough+.2*pore,.03,1.);coat*=1.-.5*pore;
    t+=(fibre-.5)*R*.17;
    // The fibres throw light along their length, so the grain shifts as a light moves.
    aniso=max(aniso,.42);tang=uTangent+(streak-.5)*.6;
  }else if(uPattern==4){
    // Marble's veins are cracks, filled later by what the water carried: a network of near-straight runs that meet at angles, each
    // its own width, wandering a little where the stone gave. So they're the borders of cells, bent, and only some of them opened.
    // Stone is folded one way, so the cells are stretched along it. q is in css px here.
    q*=120.;
    vec2 r=mat2(.82,.57,-.57,.82)*q*vec2(.5,1.);
    r+=(vec2(fbm(r*.006),fbm(r*.006+9.))-.5)*70.+(vec2(fbm(r*.07+3.),fbm(r*.07+13.))-.5)*7.;
    vec2 e1=crack(r/110.+uSeed),e2=crack(r/38.+uSeed+40.);
    float d1=e1.x*110.,d2=e2.x*38.;
    // A crack opens along part of its run and closes again, and thickens where it opened wider.
    float along=fbm(r*.018+e1.y*40.),w1=step(.38,e1.y)*mix(.25,3.2,pow(e1.y,3.))*mix(.25,1.,smoothstep(.25,.65,along))*step(.3,along);
    float w2=step(.72,e2.y)*mix(.3,2.2,e2.y)*smoothstep(.4,.62,fbm(r*.03+e2.y*40.))*smoothstep(.0,2.,max(d1-w1,0.)*.05+.5);
    float aa=max(far,.7);
    float core=max((1.-smoothstep(w1*.6,w1+aa+w1*.5,d1))*step(.01,w1),.7*(1.-smoothstep(w2*.5,w2+aa,d2))*step(.01,w2));
    // What filled it bled a little into the stone each side.
    float halo=step(.01,w1)*exp(-max(d1-w1,0.)/(2.+w1*3.))*.18;
    float vein=clamp(core+halo,0.,1.);
    col=mix(col,uColor2,.09*smoothstep(.42,.68,fbm(r*.012+5.)));
    col=mix(col,uColor2,vein*(.7+.3*fbm(r*.05)));t-=R*core;
  }else if(uPattern==5){
    // Terrazzo is crushed stone laid loose in a matrix and ground flat: the cut shows each chip as a broken, angular face with matrix
    // all round it. The stone is graded, so there are many small chips and fewer big ones; each is a stone of its own, a little lighter
    // or darker than its kind, and the matrix carries a fine sand. Larger chips lie over the small, since nothing small sits inside a big
    // one. q is in the finish's spacing, the distance between the small chips.
    // Each size of chip shows only while a pixel can tell one apart, and below that it is the colour it averages to, so far off the big
    // chips still show over a floor the small ones have greyed.
    float px=far*max(uShown,1.)/uScale;
    vec3 mean=uColor2*.45+uSub*.25+mix(uColor2,vec3(.08),.6)*.18+mix(uColor,vec3(1.),.4)*.12;
    col*=.93+.1*vnoise(q*9.)*smoothstep(2.,4.,.11/px);
    float flat_=0.,up=0.;
    for(int k=0;k<3;k++){
      float sc=k==0?1.:k==1?.42:.19,keep=k==0?.55:k==1?.42:.3,seen=smoothstep(2.,4.,.6/sc/px);
      vec2 c=shard(q*sc+float(k)*17.3);
      float hh=hash(vec2(c.y,float(k)+.5)),m=.1+.28*hh,pick=hash(vec2(c.y*7.,float(k)));
      float in_=step(c.y,keep)*smoothstep(m,m+fwidth(c.x)*1.2+.004,c.x);
      vec3 stone=pick<.45?uColor2:pick<.7?uSub:pick<.88?mix(uColor2,vec3(.08),.6):mix(uColor,vec3(1.),.4);
      stone*=(.82+.36*hh)*(.88+.24*vnoise(q*2.5+pick*50.))*(.95+.1*vnoise(q*11.+pick*9.));
      float a=mix(keep*.4,in_,seen);
      col=mix(col,mix(mean,stone,seen),a);
      flat_=mix(flat_,1.,a);up=max(up,in_*seen);
    }
    rough=mix(rough,rough*.8,flat_);t+=R*up;
  }else if(uPattern==6){
    // A hide is round domed plates parted by narrow creases: what looks longer one way is the light raking them. A crease is deeper in
    // some places than others. A finer set of creases crosses the plates, and pores sit in them.
    vec2 g=q+vec2(vnoise(q*1.7+2.),vnoise(q*1.7+5.))*.3+vec2(vnoise(q*.5),vnoise(q*.5+9.))*.86+vec2(vnoise(q*.15+4.),vnoise(q*.15+13.))*2.3;
    vec2 c=hide(g);
    vec3 f=cells(g*2.1+7.);
    float wide=max(.1,1.2*far/uScale),deep=min(.5+vnoise(g*2.3+3.),1.),v=exp(-c.x/wide)*deep;
    float b=1.-exp(-c.x/.45),vf=exp(-(f.y-f.x)/max(.16,2.*wide)),pore=smoothstep(.15,.07,f.x)*step(.8,f.z);
    t+=(.2*b-.85*v-.13*vf*(1.-v)-.2*pore+.06)*R*.66;
    col*=1.-(.3*v+.05*vf+.2*pore);
    rough=clamp(rough+(.12*v-.05*(1.-v)),.03,1.);
  }else if(uPattern==7){
    vec2 s=vec2(1.,1.732),a=mod(q,s)-s*.5,b=mod(q-s*.5,s)-s*.5,g=dot(a,a)<dot(b,b)?a:b;
    float e=max(abs(g.x),dot(abs(g),vec2(.5,.866)));
    float hole=smoothstep(.43,.37,e);
    t-=R*hole;col=mix(col,col*.05,hole);metal*=1.-hole;coat*=1.-hole;
  }else if(uPattern==8){
    t+=(abs(sin(q.x*PI+q.y*PI))+abs(sin(q.x*PI-q.y*PI)))*R*.5;
  }else if(uPattern==9){
    float f=fract((q.x+q.y)*.7071),aa2=max(fwidth(q.x+q.y),.001);
    col=mix(col,uColor2,smoothstep(.5-aa2,.5+aa2,f)*smoothstep(1.,1.-aa2,f));
  }else if(uPattern==10){
    t+=sin(q.y*PI*2.)*R*.5;
  }else if(uPattern==11){
    // Foil is pressed into tiles, each facing its own way, and the colour sweeps across them.
    vec2 g=rm(.7854)*q,c=floor(g),f=fract(g)-.5;
    float pick=hash(c+.3),a=pick*6.2832;
    film=uFilm*(.65+.75*abs(fract((q.x+q.y*.6)*.035)*2.-1.))+(pick-.5)*uFilmVary*.3;
    t+=dot(f,vec2(cos(a),sin(a)))*R;
  }else if(uPattern==12){
    // Cut into the tool on a staggered grid, so they sit in true rows and each one is a dome.
    vec2 s=vec2(1.,1.732),a=mod(q,s)-s*.5,b=mod(q-s*.5,s)-s*.5;
    float e=sqrt(max(1.-min(dot(a,a),dot(b,b))/.0784,0.));
    t+=R*e;col*=1.-.06*(1.-e);
  }else if(uPattern==13){
    // Most cells hold nothing. The few that do hold a hole, and dirt and shadow gather in it.
    vec3 c=cells(q);
    float o=step(.7,c.z)*smoothstep(.1,.05,c.x);
    t-=R*o;col*=1.-.3*o;rough=clamp(rough+.2*o,.03,1.);coat*=1.-o;
  }
  return Pat(col,t,rough,metal,coat,aniso,tang,film);
}

struct Surface{vec3 col,emit;float rough,metal,coat,aniso,tang,sheen,h,t,film,tilt;};
// p is the point in the surface's own frame and w on the part, h how high it stands there, inset how far in from its edge,
// css px, texel one pixel in css px, and far the same where the surface turns away.
Surface surface(vec2 p,vec2 w,float h,float inset,float texel,float far){
  vec3 col=uColor,emit=uEmit;
  float rough=uRough,metal=uMetal,coat=uCoat,aniso=uAniso,tang=uTangent,sheen=uSheen;

  // Round its own middle, as a spun face's lines run: p is in the surface's own frame, so its turn is put back for the device's.
  if(uRadial==1) tang=atan(p.y,p.x)+PI*.5+uRot;

  // Light from under a part is strongest beneath it, and dies out across the gap.
  if(uLeak>0.) emit*=1.-exp(-inset*inset/(uLeak*uLeak));
  float film=0.;
  if(uFilm>0.){
    // Thickness sets the colour. It falls away from where the heat was, and wanders as it does.
    vec2 f=w*(.0034+.0042*uFilmVary)+uFilmVary*1.4*vec2(fbm(w*.0062),fbm(w*.0062+5.));
    film=uFilm*(1.+uFilmVary*(dot(p/max(uHalf,vec2(1.)),vec2(.8,.35))*.6+(fbm(f)-.5)*2.4));
  }
  if(uDents>0.){
    // A knock leaves a shallow cup, which only shows by bending what the surface reflects.
    vec3 c=cells(w*.0115);
    float cup=smoothstep(.44,.02,c.x)*step(1.-uDents*.6,c.z);
    h-=cup*cup*(.1+.36*fract(c.z*17.));
  }
  // Relief goes into t, because it can be far finer than height can hold.
  float t=0.,seen=1.;
  float grooves=0.,held=1.,tilt=0.;
  if(uGrain.x>0.&&uAcross>.5&&metal>.5&&coat<=.01){
    // A line in brushed metal is no taller than the rest. It shows because a pixel holds only so many grooves, so
    // it sees part of the lobe, tilted a little off the middle. Fewer grooves to a pixel, stronger lines.
    float r=length(p);
    vec2 q=rm(uTangent-uRot)*w,along=uRadial==1?p/max(r,.001)*180.:vec2(q.x,0.);
    grooves=lined(uRadial==1?r:q.y,along,uFeature,far);
    held=max(far/uFeature,1.);
    seen=0.;
  }else if(uGrain.x>0.){
    // Noise can't run finer than the sheet. It holds there, keeping what a texel's average of it would.
    float keep=min(.8/(max(uGrain.y,uGrain.z)*texel),1.);
    vec2 q=rm(uTangent-uRot)*w*uGrain.yz*keep;
    // Value noise sits on a square grid, and the eye finds its rows. Each layer turns, so their grids never line up.
    float g=(vnoise(rm(.52)*q)*.42+vnoise(rm(-.79)*q*1.17+5.)*.36+vnoise(rm(1.3)*q*2.3+9.)*.22-.5)*1.45;
    seen=keep*texel/far;
    t+=g*uGrain.x*seen;col*=1.+g*min(uSlope,.2)*.5*seen;rough=clamp(rough+g*.08*seen,.03,1.);
  }
  if(uPeel>0.) t+=(fbm(w*uWave)-.5)*2.*uPeel;
  if(uBroad>0.){
    // Nothing comes out of a process even. Finish and tone drift, and they drift together.
    float m=fbm(w*.0075+21.);
    rough=clamp(rough+(m-.5)*.14*uBroad,.03,1.);
    col*=1.+(m-.5)*.035*uBroad;
  }
  if(uPattern>0){
    // A pattern shows only while a pixel can tell its features apart: from four pixels a feature down to two it goes to what it
    // averages, as the eye sees it from further off, and what it tilted goes into roughness below. A pixel is the shown one, which a
    // sheet drawn finer than it's shown has several texels to, so it holds at any size a device is shown, and never beats with it.
    vec2 q=rm(uTangent-uRot)*w/uScale;
    seen*=smoothstep(2.,4.,uFeature/(far*max(uShown,1.)));
    Pat s=Pat(col,t,rough,metal,coat,aniso,tang,film),o;
    // Wood and stone show what they are at sizes of their own, rings and veins far wider than their spacing, so only their relief fades.
    // Terrazzo has sizes of its own too, and fades each as it goes below a pixel.
    if(uPattern==3||uPattern==4||uPattern==5) o=pattern(s,p,q,uRelief*seen,far);
    else{
      o=pattern(s,p,q,uRelief,far);
      if(seen<1.){
        // Its average, read at points spread over a few of its repeats: the same everywhere, so it can't make a pattern of its own.
        Pat m=Pat(vec3(0.),0.,0.,0.,0.,0.,0.,0.);
        for(int i=0;i<16;i++){
          Pat k=pattern(s,p,4.*fract(float(i)*vec2(.7549,.5698)+.5),uRelief,far);
          m.col+=k.col;m.t+=k.t;m.rough+=k.rough;m.metal+=k.metal;m.coat+=k.coat;m.film+=k.film;
        }
        float n=1./16.;
        o.col=mix(m.col*n,o.col,seen);o.t=mix(m.t*n,o.t,seen);o.rough=mix(m.rough*n,o.rough,seen);
        o.metal=mix(m.metal*n,o.metal,seen);o.coat=mix(m.coat*n,o.coat,seen);o.film=mix(m.film*n,o.film,seen);
        // Which way it runs averages out with it.
        o.aniso=mix(s.aniso,o.aniso,seen);o.tang=mix(s.tang,o.tang,seen);
      }
    }
    col=o.col;t=o.t;rough=o.rough;metal=o.metal;coat=o.coat;aniso=o.aniso;tang=o.tang;film=o.film;
  }
  if(uSlope>0.){
    // What's too fine to see still tilts the light. Its slope joins the roughness, lengthwise or not.
    float s=2.*uSlope*uSlope*(1.-seen*seen),a=rough*rough;
    float at=sqrt(pow(a*(1.-aniso),2.)+s*(1.-uAcross)),ab=sqrt(pow(a*(1.+aniso),2.)+s);
    // What the pixel's grooves lean by comes out of the lobe, which keeps only the rest.
    if(grooves!=0.){tilt=clamp(ab*grooves/sqrt(held),-.5,.5);ab*=sqrt(max(1.-1./held,.2));}
    rough=sqrt(min((at+ab)*.5,1.));aniso=(ab-at)/(ab+at);
  }
  if(uFade>0.){
    float sun=uFade*(.72+.56*fbm(w*.008+13.));
    col=mix(col,vec3(dot(col,vec3(.2126,.7152,.0722)))*1.06+.035,clamp(sun,0.,1.));
  }
  if(uMottle>0.){
    float m=fbm(w*.016),m2=fbm(w*.085+4.);
    col*=mix(1.,(.5+m*1.1)*(.78+.44*m2),uMottle);
    rough+=(m-.5)*.14*uMottle;
  }
  if(uFleck>0.){float f=smoothstep(.74,.82,vnoise(w*.85));col=mix(col,col*2.4+.025,f*uFleck);}
  if(uWear>0.&&uPolish>0.){
    // Soft finishes don't chip. They burnish, shiny at the edges and wherever a hand rubs most.
    // A hand only reaches the tops of a texture, so they go first and the creases stay as they were.
    float rub=fbm(w*.012+7.)*.7+fbm(w*.09+2.)*.3+exp(-inset/18.)*.5+clamp(t/max(uRelief,.01),-1.,1.)*.35;
    float t=smoothstep(.75-uWear*.45,1.05-uWear*.3,rub)*min(uWear*3.,1.);
    // A hand's rub ends at one roughness, whatever it started at: a matt face polishes down to it, and a gloss one hazes up to it, its
    // level worn through.
    rough=mix(rough,clamp(rough*.5,.16,.3),t);sheen*=1.-t;col*=1.-.05*t;coat*=1.-t*.8;
    // Hard stuff in a pocket drags hairlines across anything soft and smooth. They only show on a smooth face, where each one is a
    // line of haze in the highlight, and on a pale one dirt gets into them.
    float smooth_=1.-smoothstep(.15,.4,rough);
    float scr=max(scratch(w,.32,1.,uWear),scratch(w,-.71,2.,uWear))*smoothstep(.02,.3,uWear)*smooth_;
    rough=clamp(rough+.22*scr,.03,1.);coat*=1.-.6*scr;col*=1.-.1*scr*smoothstep(.2,.6,dot(col,vec3(.33)));
  }else if(uWear>0.){
    float field=chipField(w,uChip),t=chipFrom(inset,uWear,uChip);
    // A clear coat is on top, so it goes first, and long before anything chips.
    coat*=1.-smoothstep(t-.3,t-.12,field)*min(uWear*2.5,1.);
    float chip=smoothstep(t,t+.012,field)*smoothstep(0.,.2,uWear);
    // A chip goes through one coat at its rim and on to what the thing is made of at its heart.
    float deep=smoothstep(t+.055,t+.07,field)*smoothstep(.05,.4,uWear);
    col=mix(mix(col,uSub,chip),uBare,deep);
    metal=mix(mix(metal,uSubRM.y,chip),uBareRM.y,deep);
    rough=mix(mix(rough,uSubRM.x,chip),uBareRM.x,deep);
    coat*=1.-chip;film*=1.-chip;
    h-=.05*chip+.05*deep;
    float scr=max(scratch(w,.32,1.,uWear),scratch(w,-.71,2.,uWear))*smoothstep(.02,.3,uWear);
    h-=.012*scr;rough=clamp(rough+.08*scr,.03,1.);col=mix(col,uSub*.9+.05,scr*.12);
    float rub=smoothstep(.45,.75,fbm(w*.012+7.));
    col*=1.-.1*rub*uWear;rough=mix(rough,rough*.8,rub*uWear);
  }

  if(uAge>0.){
    // Finishes go dull everywhere. Patina then creeps in unevenly, from wherever it started.
    coat*=1.-.6*uAge;rough=clamp(rough+.1*uAge,.03,1.);
    // Bare metal polishes too, but it tarnishes like metal, so it's what the surface is that decides, not how it wears.
    if(uPatinaOn>0.&&uPolish>0.&&metal<.5){
      // Soft stuff changes in the light, all over and nearly evenly: plastic yellows, wood and leather darken. Only a broad drift tells where it got more sun.
      float t=clamp(uAge*1.5,0.,1.)*(.8+.4*fbm(w*.004+5.));
      col=mix(col,uPatina,t*.75);
      rough=mix(rough,uPatinaRough,t*.5);
    }else if(uPatinaOn>0.){
      // It starts at the edges and in corners, where nothing rubs it away, and even at its oldest it lies in patches with the metal
      // between them: the field sits about .5, and a threshold that fell past it would cover the face in one even skin.
      float f=fbm(w*.016+5.)*.42+fbm(w*.13+11.)*.38+fbm(w*.7+3.)*.2+exp(-inset/26.)*.14;
      float t=smoothstep(.68-uAge*.26,.86-uAge*.24,f)*min(uAge*2.2,1.);
      col=mix(col,uPatina,t);
      rough=mix(rough,uPatinaRough,t);metal*=1.-t;aniso*=1.-t;
    }
  }
  if(uTouch>0.){
    // Fingers land in the middle. They polish first, then rub through to what is underneath.
    vec2 q=p/max(uHalf,vec2(1.));
    float t=exp(-dot(q,q)*3.2)*uTouch*(.6+.9*fbm(w*.09));
    float through=smoothstep(.62,.8,t);
    rough=mix(rough,max(rough*.5,.08),clamp(t*1.6,0.,1.));coat*=1.-clamp(t,0.,1.);
    col=mix(col,uSub,through*.75);
  }
  // Varnish is a colour too, and it yellows as it ages.
  col*=mix(vec3(1.),uCoatTint,clamp(coat*(.7+uAge*.6),0.,1.));
  return Surface(col,emit,rough,metal,coat,aniso,tang,sheen,h,t,film,tilt);
}`;

/**
 * What a screen shows of its picture at `st`, 0 to 1 across its glass: its colour and the light it gives, as the material pass writes them and
 * as the player does when only the picture changed. Reads `uScreen`, and `uKind`, `uInk`, `uInset`, `uZoom`, `uGain`, `uColor`, `uEmit` and `uMetal`,
 * which whoever includes it declares, and `uDamage`, what broke in it. `px` is where on the canvas, css px.
 */
export const SCREEN_OF = `void screenOf(vec2 st,vec2 px,out vec3 col,out vec3 emit,out float metalLeft){
  vec2 size=vec2(textureSize(uScreen,0));
  col=uColor;emit=uEmit;
  metalLeft=0.;
  // Its glass cell broken, as broken.ts has it: what leaked out of it, rows pulled sideways beside that, lines that died and a bruise in the
  // light behind. A tube, lamps and a printed coat have none of that to lose.
  vec4 dmg=texture(uDamage,st);
  float leak=dmg.r,dead=dmg.b,bruise=dmg.a;
  if(uKind==2||uKind==3||uKind==6) st.x+=(dmg.g*255.-128.)/127.*.25;
  if(uKind==0){
    // A tube bulges, and its scanlines and phosphor stripes sit on the picture. A tube has no ink, so the command's ink says how
    // deep the stripes run, and a monochrome tube, with none, is the even phosphor they average to, then how far it bulges.
    vec2 o=st-.5;
    st=.5+o*(1.+dot(o,o)*uInk.y);
    // The raster may stop short of the glass, and black glass shows beyond it.
    st=(st-uInset)/(1.-2.*uInset);
    float edge=smoothstep(0.,.014,min(min(st.x,1.-st.x),min(st.y,1.-st.y)));
    // When the picture's rows get as fine as the display's pixels, scanlines and a one-pixel pattern would beat against them
    // in rings, so both average out over the pixel, as they do in the eye. On a screen uZoom is sheet pixels to a shown one.
    vec2 foot=fwidth(st)*uZoom;
    float scan=mix(.6+.4*cos((fract(st.y*size.y)-.5)*6.2832),.6,smoothstep(.3,.6,foot.y*size.y));
    vec3 mask=.78+uInk.x*(1.-smoothstep(1.2,2.2,uZoom))*cos(px.x*2.1+vec3(0.,2.1,4.2));
    vec3 pic=(texture(uScreen,st+foot*vec2(-.375,-.125)).rgb+texture(uScreen,st+foot*vec2(.125,-.375)).rgb+texture(uScreen,st+foot*vec2(.375,.125)).rgb+texture(uScreen,st+foot*vec2(-.125,.375)).rgb)*.25;
    emit+=pic*scan*mask*uGain*edge;
  }else if(uKind==3||uKind==6){
    // A colour panel's pixel is a cell of three stripes, red, green and blue, in a black matrix. Shown big, each pixel is a hard square
    // with an edge one shown pixel soft, and its stripes show. Once a stripe is down to a few shown pixels it averages to its colour, as in the eye.
    // The margin round its active pixels stays black.
    vec2 g=(st-uInset)/(1.-2.*uInset)*size,foot=fwidth(g)*uZoom,n=floor(g+.5);
    float inside=step(0.,min(g.x,g.y))*step(0.,min(size.x-g.x,size.y-g.y));
    vec2 sharp=n+clamp((g-n)/max(foot,vec2(1e-4)),-.5,.5);
    vec3 c=texture(uScreen,mix(sharp,g,smoothstep(.6,1.,max(foot.x,foot.y)))/size).rgb;
    vec2 f=fract(g);
    float sx=fract(f.x*3.),wx=min(foot.x*1.5,.2),wy=min(foot.y*.5,.2),which=floor(f.x*3.);
    float lit=smoothstep(.1-wx,.1+wx,sx)*smoothstep(.9+wx,.9-wx,sx)*smoothstep(.05-wy,.05+wy,f.y)*smoothstep(.95+wy,.95-wy,f.y);
    vec3 mask=vec3(equal(vec3(which),vec3(0.,1.,2.)))*lit*(3./.72);
    vec3 pic=c*mix(vec3(1.),mask,1.-smoothstep(.25,.5,foot.x*3.))*uGain*inside;
    // A TFT is lit from behind through its crystals, and the room's light goes through them too, off the reflector and back, so its picture still shows with the backlight off.
    if(uKind==6){pic*=uInk;col*=c*inside;}
    emit+=pic;
  }else if(uKind==4){
    // Reflective, with a few levels of grey. A white canvas is bare paper.
    float y=dot(texture(uScreen,st).rgb,vec3(.2126,.7152,.0722));
    col=mix(uInk,col,floor(pow(y,.45)*7.+.5)/7.);
  }else if(uKind==5){
    // A coat on the back of a pane, with no light but the room's. White is all of it there, and black is none, showing what's behind.
    float left=pow(dot(texture(uScreen,st).rgb,vec3(.2126,.7152,.0722)),.45);
    col=mix(uInk,col,left);
    metalLeft=uMetal*left;
  }else{
    // The inset is the margin of a panel round its active pixels. Nothing there ever turns.
    vec2 g=(st-uInset)/(1.-2.*uInset)*size,f=fract(g)-.5;
    bool inside=all(greaterThanEqual(g,vec2(0.)))&&all(lessThan(g,size));
    vec3 c=inside?texelFetch(uScreen,ivec2(g),0).rgb:vec3(0.);
    if(uKind==1){
      float m=smoothstep(.47,.28,length(f));
      emit+=c*m*uGain;
      col=mix(col,col+c*.08,m);
    }else{
      // A pixel is a cell with a gap round it, until cells are so few of the sheet's pixels across that the gaps beat against them.
      vec2 foot=fwidth(g),w=max(foot*.5,vec2(.02)),e=smoothstep(.48+w,.48-w,abs(f));
      float m=inside?mix(e.x*e.y,.92,smoothstep(.2,.4,max(foot.x,foot.y))):0.;
      // Crystals block the backlight as well as the light from the room. A canvas is written in the eye's terms, so a grey there is that much of a turn, as on e-ink.
      float on=pow(clamp(dot(c,vec3(.3333)),0.,1.),.45)*m;
      // The reflector lies a glass thickness behind the crystals, so room light leaves each dark pixel a shadow on it.
      vec2 b=g-vec2(.2,.3);
      float dark=pow(clamp(dot(texelFetch(uScreen,ivec2(clamp(b,vec2(0.),size-1.)),0).rgb,vec3(.3333)),0.,1.),.45);
      col*=(1.-.24*dark*float(inside))*(1.-.03*m);
      col=mix(col,uInk,on);emit*=(1.-on)*(1.-.03*m);
    }
  }
  if(uKind==2){
    // The crystal gone from between the plates: blue-black, whatever the picture was, and a dead line is all ink.
    col=mix(mix(col,uInk,dead*.8),vec3(.011,.008,.032),leak);
  }else if(uKind==3||uKind==6){
    // A colour panel goes black where it leaked or a line died, lit or not, and its backlight shows paler round where it was pressed.
    float left=(1.-leak)*(1.-dead);
    emit=emit*left+(uKind==6?uInk*uGain*bruise*.04:vec3(0.));
    col*=1.-max(leak*.92,dead*.85);
  }else if(uKind==4){
    // Its ink stuck where the cell broke, half turned.
    col=mix(col,mix(uInk,uColor,.45),leak*.85);
  }
}`;

export const MATERIAL_VS = `#version 300 es
precision highp float;
precision highp int;
${COMMAND}
out vec2 vPx;
void main(){
  vec2 c=vec2(gl_VertexID&1,(gl_VertexID>>1)&1);
  vPx=mix(uBox.xy,uBox.zw,c);
  gl_Position=vec4(vPx/uCanvas*2.-1.,0.,1.);
}`;

export const MATERIAL_FS = `#version 300 es
precision highp float;
precision highp int;
in vec2 vPx;
layout(location=0) out vec4 oA;
layout(location=1) out vec4 oH;
layout(location=2) out vec4 oS;
layout(location=3) out vec4 oE;
layout(location=4) out vec4 oM;
#ifdef RELIEF
layout(location=5) out vec4 oD;
#else
vec4 oD;
#endif
#ifdef SPLIT
layout(location=5) out vec4 oN;
#else
vec4 oN;
#endif
vec4 grain(vec2 t,float c){return vec4(.5+.25*t,0.,c);}
layout(location=6) out vec4 oU;

${COMMAND}
uniform sampler2D uScreen;
// What broke in a screen: see broken.ts.
uniform sampler2D uDamage;
uniform sampler2D uMask,uField,uBackA,uBackE,uBackS,uBackH,uOwn,uRows,uClipField;
#ifdef SPLIT
uniform sampler2D uBackN;
// The heights under a bridge and how much they cover, which with SPLIT are in two maps.
#define UNDER(uv,lod) vec2(textureLod(uBackH,(uv)*uUnderBox.xy+uUnderBox.zw,lod).r,textureLod(uBackN,(uv)*uUnderBox.xy+uUnderBox.zw,lod).a)
#else
#define UNDER(uv,lod) textureLod(uBackH,(uv)*uUnderBox.xy+uUnderBox.zw,lod).ra
#endif
#define AT(uv) ((uv)*uMap.xy+uMap.zw)
#define BACK(uv) (AT(uv)*uBackBox.xy+uBackBox.zw)

const float MM=.25,PI=3.14159265;

${SURFACE}
float sdRR(vec2 p,vec2 b,float r){vec2 q=abs(p)-b+r;return length(max(q,0.))+min(max(q.x,q.y),0.)-r;}
// How far in from the edge of a rounded box, measured along contours that stay round. Plain
// distance has sharp corners inside, and a bevel built on it creases along the diagonal.
float bevelIn(vec2 p,vec2 b,float r){
  vec2 u=abs(p)-b+r;
  float t=r-max(u.x,u.y),gap=u.x-u.y,disc=2.*r*r-gap*gap;
  if(disc>0.){
    float c=(sqrt(disc)-u.x-u.y)*.5;
    if(min(u.x,u.y)+c>=0.) t=c;
  }
  return t;
}

// Capsule keeps its own height profile, so it reports one through these.
float capT=0.,capLift=0.;

// Where this pixel falls on the flat sheet, how far the sheet has dropped there, and how much of the
// pixel is on this side of the point where the sheet goes out of sight.
vec2 P,gArc=vec2(0.);
float fall=0.,side=1.;

// A bend rolls the sheet over a curve seen from above. Each pixel looks up the point of the sheet
// that lands on it, so whatever is painted there closes up as it turns away.
void bend(){
  float t=dot(vPx,uBendDir)-uBendAt.x,aa=max(fwidth(t),.0001),along=uBendBoth==1?sign(t):1.;
  float y=t*along-uBendAt.y;
  if(y<=0.) return;
  if(uBendK>=0.){
    side=clamp((uBendReach-y)/aa+.5,0.,1.);
    if(side<=0.) discard;
  }
  float r=min(y/uBendReach,1.);
  P+=uBendDir*along*max(uBendK,0.)*(uBendReach*asin(r)-y);
  // A rigid body keeps its outline where it was measured, but its grain still runs round the curve, so that closes up as it turns away too.
  float k=abs(uBendDrop)*4./uBendReach;
  gArc=uBendDir*along*max(k*sqrt(k)-max(uBendK,0.),0.)*(uBendReach*asin(r)-y);
  fall=uBendDrop*(1.-sqrt(1.-r*r));
}

float cover(float d){return clamp(.5-d/max(fwidth(d),.0001),0.,1.)*side;}

float solid(vec2 p){
  if(uShape==0){
    float d=sdRR(p,uHalf,uRadius);
    // Waves round the edge, sharp vees, or scoops: round cuts with a flat land left between each and the next.
    if(uRipple.x>0.){
      float a=atan(p.y,p.x)*uRipple.x,f=fract(a/6.2832);
      if(uRipple.z<.5) d+=uRipple.y*(.5+.5*sin(a));
      else if(uRipple.z<1.5) d+=uRipple.y*abs(2.*f-1.);
      else{float x=(f-.5)/.42;d+=uRipple.y*sqrt(max(1.-x*x,0.));}
    }
    return d;
  }
  if(uShape==1){
    vec2 a=uCap.xy,b=uCap.zw-a,q=P-a;
    float bb=max(dot(b,b),.0001);
    capT=clamp(dot(q,b)/bb,0.,1.);
    float rad=mix(uCapR.x,uCapR.y,capT*capT),dd=length(q-b*capT);
    capLift=sqrt(max(rad*rad-dd*dd,0.))*MM;
    return dd-rad;
  }
  if(uShape==2){
    vec2 t=p/(2.*(uHalf+uSpread))+.5;
    if(uEdge==0) return texture(uField,t).r;
    // A drawn outline's edge is only as good as its texels, so from row to row it wanders by half of one. Face-on that's under a
    // pixel; edge-on each row's wander is a step in depth, so the field is blurred over a texel first.
    vec2 k=.75/vec2(textureSize(uField,0));
    return .25*(texture(uField,t+k).r+texture(uField,t-k).r+texture(uField,t+vec2(k.x,-k.y)).r+texture(uField,t+vec2(-k.x,k.y)).r);
  }
  if(uShape==3){
    vec2 s=vec2(uHoles.x,uHoles.x*(uHoles.z>.5?1.:1.732));
    vec2 a=mod(p,s)-s*.5,b=mod(p+s*.5,s)-s*.5;
    vec2 c=uHoles.z>.5||dot(a,a)>=dot(b,b)?b:a;
    if(sdRR(p-c,uHalf,uRadius)>-uHoles.y) discard;
    return length(c)-uHoles.y;
  }
  if(uShape==5){
    float a=mod(atan(p.x,-p.y)-uCap.x+PI,2.*PI)-PI,l=length(p),b=abs(a)-uCap.y;
    if(b<=0.) return abs(l-uCap.z)-uCap.w;
    return length(l*vec2(cos(b),sin(b))-vec2(uCap.z,0.))-uCap.w;
  }
  return -1.;
}

// How much of a mark lands on what holds it. A lamp's light or ink past that edge has nothing to be on.
float toHolder(vec2 q){
  return uClipShape==2?texture(uClipField,q/(2.*(uClip.zw+uClipSpread))+.5).r:sdRR(q,uClip.zw,uClipRadius);
}
float held(){
  if(uClipShape<0) return 1.;
  float d=toHolder(rm(uClipRot)*(P-uClip.xy));
  return clamp(.5-d/max(fwidth(d),.0001),0.,1.);
}
float dist(vec2 p){
  float d=solid(p)-uGrow;
  return uRing>0.?abs(d)-uRing*.5:d;
}

// How high a surface stands at a point, from its outline and profile, before anything is laid on it.
float top(vec2 p,float d){
  if(uShape==1&&uProfile==1) return mix(uZEdge,uZTop,capT)+capLift;
  float inner=-d;
  if(uShape==0&&uProfile!=3){
    float m=min(uHalf.x,uHalf.y);
    // Circles and pills are already round, all the way in.
    if(uRadius<m*.98) inner=bevelIn(p,uHalf,clamp(max(uRadius,uBevel*.8),.01,m*.9));
  }
  float e=clamp(inner/max(uBevel,.01),0.,1.);
  float pe=uProfile==0?1.:uProfile==1?sqrt(1.-(1.-e)*(1.-e)):uProfile==4?e*e*(3.-2.*e):e;
  if(uProfile==3){float n=clamp(length(p)/uHalf.x,0.,1.);pe=sqrt(1.-n*n);}
  vec2 q=clamp(p/uHalf,-1.,1.);
  float h=mix(uZEdge,uZTop-dot(uCrown,q*q)-dot(uTilt,q),pe);
  float deep=max(uDish.x,uDish.y);
  if(deep>0.){vec2 q=p/uHalf,w=uDish/deep;h-=deep*(1.-clamp(dot(w,q*q),0.,1.));}
  return h;
}

// A surface drawn on another face of the body is a solid there: its outline, standing from its ground to its top. Seen from this face,
// edge-on, a column of this plate is one height on that face, and looking down it runs along that face toward its middle. The first
// point of the outline that stands that high is what this face sees. Says how far that stands off this face's ground, mm, or nothing
// below \`stop\`, and leaves P on it.
float meet(float H,float y,float stop){
  float sn=uSeen.x,fx=uSeen.y,me=uFrom.z;
  float dir=sn>0.?1.:-1.,u=sn>0.?uReach.x:uReach.z,end=sn>0.?uReach.z:uReach.x;
  // Fine enough to find where a bevel reaches this height, in the outline's own px.
  float fine=max(min(uBevel,4.)/12.,.06),was=u;
  bool hit=false;
  for(int i=0;i<512;i++){
    if((end-u)*dir<0.||(fx-u*MM)*sn+me<=stop) break;
    P=vec2(u,y);
    vec2 p=rm(uRot)*(P-uCenter);
    float d=dist(p);
    if(d>0.){was=u;u+=dir*max(d,.25);continue;}
    float t=top(p,d);
    if(t>=H&&H>(uMid>0.?2.*uMid-t:-1e9)){hit=true;break;}
    was=u;u+=dir*fine;
  }
  if(!hit) return -1e9;
  // Halved down to where it starts, between the last step out and the first in.
  float a=was,b=u;
  for(int i=0;i<6;i++){
    float m=(a+b)*.5;P=vec2(m,y);vec2 p=rm(uRot)*(P-uCenter);float d=dist(p);
    if(d<=0.&&top(p,d)>=H) b=m; else a=m;
  }
  P=vec2(b,y);
  return (fx-b*MM)*sn+me;
}

// What this face sees of one of the others' parts. Its side wall is laid out by that face's height and its row, so what's on the
// wall doesn't smear along the line of sight.
vec2 wall;
float insetAt(int i,int k){
  if(i<0||i>=int(uOutline.z)) return 1e9;
  vec4 r=texelFetch(uRows,ivec2(i,0),0);
  return k==0?r.r:r.g;
}
float across(){
  vec2 q=vPx*MM-uFrom.xy;
  float H=q.x*uSeen.x+uSeen.w;
  // Where this face's outline turns in at a corner, what stands off the side beside it turns in with it.
  if(uOutline.z>0.){
    float f=(vPx.y-uOutline.x)/uOutline.y;int i0=int(floor(f)),k=uSeen.x<0.?1:0;
    float a=insetAt(i0,k),b=insetAt(i0+1,k);
    if(max(a,b)>1e8) discard;
    H+=mix(a,b,fract(f))*MM;
  }
  if(H<uSeen.w) discard;
  float own=texelFetch(uOwn,ivec2(gl_FragCoord.xy),0).r,lo=own>.01?own+.35:0.,y=(q.y+uSeen.z)/MM;
  float z=meet(H,y,lo);
  if(z<=lo) discard;
  wall=vec2(H/MM,y);
  return z;
}

// A body is one solid, a stack of layers, each an outline standing from its ground to its top. A face beside them has no outline
// of its own: what it shows is each layer, side on. A column of it is one height in the layer, which its edge profile sets in
// from the outline by so much. How far the outline reaches toward this face, row by row, is worked out from the path itself
// (uRows, laid out by uCap: first row, step and count), and set in by rolling a ball of that size along it, so the corners come
// out round as well. Says how far that stands off this face's ground, as \`meet\` does.
float rowsAt(int i,int k){
  if(i<0||i>=int(uCap.z)) return k==0?-1e9:1e9;
  vec4 r=texelFetch(uRows,ivec2(i,0),0);
  return k==0?r.r:r.g;
}
float section(){
  vec2 q=vPx*MM-uFrom.xy;
  float H=q.x*uSeen.x+uSeen.w,y=(q.y+uSeen.z)/MM,D=uZTop-uZEdge;
  if(H<uZEdge||H>uZTop||D<=0.) discard;
  // The same profile the layer's own face shows, turned round: how far in its edge is at this height.
  float hf=(H-uZEdge)/D,a=0.,b=1.;
  if(uProfile==0) b=0.;
  else for(int i=0;i<14;i++){
    float e=(a+b)*.5,pe=uProfile==1||uProfile==3?sqrt(1.-(1.-e)*(1.-e)):uProfile==4?e*e*(3.-2.*e):e;
    if(pe<hf) a=e; else b=e;
  }
  float k=b*uBevel,sn=uSeen.x,f=(y-uCap.x)/uCap.y;
  // From the right the layer's right edge is nearest, so its reach is the least of what the ball allows; from the left, the most.
  int side=sn<0.?0:1;
  int i0=int(floor(f));
  float g=mix(rowsAt(i0,side),rowsAt(i0+1,side),fract(f))+(side==0?-k:k);
  if(k>0.){
    int n=int(ceil(k/uCap.y));
    for(int j=-n;j<=n;j++){
      int i=i0+j;float dy=float(i)*uCap.y+uCap.x-y,r=k*k-dy*dy;
      if(r<0.) continue;
      float e=rowsAt(i,side)+(side==0?-sqrt(r):sqrt(r));
      g=side==0?min(g,e):max(g,e);
    }
  }
  if(abs(g)>1e8) discard;
  float z=(uSeen.y-g*MM)*sn+uFrom.z;
  if(z<=0.) discard;
  return z;
}

${SCREEN_OF}
void main(){
  oM=oD=oU=oN=vec4(0.);
  P=vPx;
  float seenAt=0.;
  if(uEdge==1) seenAt=across();
  else if(uEdge==4) seenAt=section();
  else if(uBendReach>0.) bend();
  vec2 p=rm(uRot)*(P-uCenter);
  // Everything in a surface is cut into the part, so it goes where the part goes.
  vec2 w=(uEdge==1?wall:p+rm(uRot)*gArc)+uSeed;
  vec2 uv=vPx/uCanvas,sheet=P/uCanvas;

  if(uMode==3){
    float c=cover(abs(dist(p))-uWidth);
    oE=vec4(uEmit*.25*c,c);oA=oH=oS=vec4(0.);
    return;
  }

  if(uMode==4){
    float d=dist(p),cov=cover(d);
    vec2 st=(p+uHalf)/(2.*uHalf);
    vec3 col,emit;
    float metalLeft;
    screenOf(st,vPx,col,emit,metalLeft);
    oA=vec4(col,cov);
    // Flat panels sit behind glass with nothing to scatter their light, so they mark themselves
    // to the light pass with a tangent longer than any real one. Tubes and LEDs do glow.
    oH=vec4(uZTop-fall,uKind>=2?2.:0.,0.,cov);
    oN=grain(oH.gb,cov);
    oD=vec4(0.,0.,0.,cov);
    oS=vec4(uRough,metalLeft*.5,uCoat,cov);
    oE=vec4(emit*.25,cov);
    oM=vec4(0.,0.,1.,cov);
    return;
  }

  if(uMode==5){
    // Glass adds to what is below, so the dial keeps its relief and only gains a shine.
    float d=dist(p),cov=cover(d);
    float e=clamp(-d/max(uBevel,.01),0.,1.);
    oH=vec4(uZTop*sqrt(1.-(1.-e)*(1.-e))*cov,0.,0.,0.);
    oS=vec4(0.,0.,uCoat*cov,cov);
    oA=oE=vec4(0.);
    return;
  }

  if(uMode==6){
    float d=dist(p),cov=cover(d);
    float e=clamp(-d/max(uBevel,.01),0.,1.);
    vec3 back=vec3(0.),light=vec3(0.);
    // A spiral of taps, because one level of the mip chain alone shows its blocks.
    float lod=uBlur>0.?max(log2(uBlur*.7),0.):0.;
    // A lens looks at less of what is under it, spread over the same pane.
    vec2 seen=(uCenter+(vPx-uCenter)/uZoom)/uCanvas;
    for(int i=0;i<12;i++){
      float t=float(i)*2.39996,r=sqrt((float(i)+.5)/12.)*uBlur;
      vec2 s=seen+vec2(cos(t),sin(t))*r/uCanvas;
      vec4 c=textureLod(uBackA,BACK(s),lod);
      back+=c.rgb/max(c.a,.05);
      light+=textureLod(uBackE,BACK(s),lod).rgb;
    }
    back/=12.;light/=12.;
    // Clear glass leaves what is under it as it was, metal included. The more a pane
    // scatters, the less of that survives, and bare metal has no colour to give back.
    vec4 under=textureLod(uBackS,BACK(seen),lod);
    float ua=max(under.a,.05),scatter=clamp(uBlur/6.+uOpacity,0.,1.),mf=under.g/ua;
    back*=1.-min(mf*2.,1.)*scatter*.7;
    float pe=sqrt(1.-(1.-e)*(1.-e));
    // A clear plastic wears and ages like any other: rubbed hazy where hands go, hairlines from what it shared a pocket with, and
    // the polymer yellowing, which tints all that comes through it. Glass says it doesn't wear, so none of this reaches it.
    float pr=mix(under.r/ua,uRough,scatter),pc=uCoat;
    if(uWear>0.&&uPolish>0.){
      float rub=smoothstep(.75-uWear*.45,1.05-uWear*.3,fbm(w*.012+7.)*.7+fbm(w*.09+2.)*.3)*min(uWear*3.,1.);
      float scr=max(scratch(w,.32,1.,uWear),scratch(w,-.71,2.,uWear))*smoothstep(.02,.3,uWear);
      pr=clamp(mix(pr,max(pr,.2),rub)+.25*scr,.03,1.);pc*=(1.-.6*scr)*(1.-.5*rub);
    }
    if(uPatinaOn>0.&&uAge>0.) back*=mix(vec3(1.),uPatina/max(uColor,vec3(.01)),clamp(uAge*1.5,0.,1.)*.8);
    oA=vec4(mix(back,uColor,uOpacity),cov);
    oH=vec4(mix(uZEdge,uZTop,pe)-fall+(vnoise(w*1.9)-.5)*.012*min(uBlur,1.),0.,0.,cov);
    oN=grain(vec2(0.),cov);
    oD=vec4(0.,0.,0.,cov);
    oS=vec4(pr,mf*(1.-scatter),pc,cov);
    oE=vec4(light*uTransmit,cov);
    oM=vec4(0.,0.,1.,cov);
    return;
  }

  if(uMode==1||uMode==2||uMode==7){
    float d=uShape==4?0.:dist(p);
    if(uMode==1){
      float c=(uShape==4?textureLod(uMask,sheet,uSoftLod).r:clamp(-d/max(uBevel,.7),0.,1.))*held();
      oH=vec4(-uDepth*c,0.,0.,0.);
      oA=oS=oE=vec4(0.);
      return;
    }
    float a;
    if(uShape==4) a=texture(uMask,sheet).r;
    else a=cover(d);
    if(uFeather>0.) a=smoothstep(0.,uFeather,-d);
    if(uWear>0.){float t=1.-.42*sqrt(uWear);a*=1.-smoothstep(t,t+.08,fbm(w*.13));}
    // A chip in what it's printed on takes the print with it.
    if(uGroundWear>0.&&uClipShape>=0){
      vec2 q=rm(uClipRot)*(P-uClip.xy);
      float t=chipFrom(max(-toHolder(q),0.),uGroundWear,uChip);
      a*=1.-smoothstep(t,t+.012,chipField(q+uGroundSeed,uChip))*smoothstep(0.,.2,uGroundWear);
    }
    a*=held();
    // Light alone, from under what it's on: it adds to what's there and leaves its colour and finish as they were.
    if(uMode==7){oE=vec4(uEmit*.25*a,a);oA=oS=oH=vec4(0.);return;}
    oA=vec4(uColor,a);oS=vec4(uRough,uMetal*.5,0.,a);oE=vec4(uEmit*.25,a);oH=vec4(0.);oM=vec4(0.,0.,1.,a);
    return;
  }

  // A layer seen side on is all inside: its edges are where the section stops.
  float d=uEdge==4?-1e3:dist(p);
  float h=uEdge==4?seenAt:top(p,d);

  // What's underneath was bent already.
  if(uFollow==0) h-=fall;
  float inset=max(-d,0.);
  if(uFollow==3){
    // A spiral of taps as in frost, because one level of the mip chain alone shows its blocks.
    vec2 at=vPx/uCanvas;
    float k=float(textureSize(uBackH,0).x)*uUnderBox.x*uMap.x/uCanvas.x,lod=max(log2(uBlur*.7*k),0.);
    vec2 wide=vec2(0.);
    for(int i=0;i<12;i++){
      float t=float(i)*2.39996,r=sqrt((float(i)+.5)/12.)*uBlur;
      wide+=UNDER(AT(at+vec2(cos(t),sin(t))*r/uCanvas),lod);
    }
    // Past the edge of what holds it there's nothing to read, so it carries straight on at the height it's stuck at.
    // Height is laid down by coverage, so dividing it out counts only what's there.
    vec2 all=UNDER(AT(uCenter/uCanvas),log2(max(uHalf.x,uHalf.y)*2.*k)),here=UNDER(AT(at),0.);
    float held=all.x/max(all.y,.001),over=mix(held,wide.x/max(wide.y,.001),smoothstep(.1,.6,wide.y/12.));
    h+=mix(max(over,mix(held,here.x/max(here.y,.001),here.y)),over,smoothstep(0.,uBlur*.5,inset));
  }
  // One texel of the sheet in css px, then the same where it turns away, so all of this holds on a
  // zoomed or bent device.
  float texel=fwidth(vPx.x),far=uEdge==1?texel:max(max(fwidth(P.x),fwidth(P.y)),texel);
  Surface S=surface(p,w,h,inset,texel,far);
  vec3 col=S.col,emit=S.emit;
  float rough=S.rough,metal=S.metal,coat=S.coat,aniso=S.aniso,tang=S.tang,sheen=S.sheen,t=S.t,film=S.film,tilt=S.tilt;
  h=S.h;

  float cov=uEdge>0?1.:cover(d);
#ifndef RELIEF
  h+=t;
#endif
  oD=vec4(t,0.,0.,cov);
  oA=vec4(col,cov);
  oH=vec4(h,aniso*cos(tang),aniso*sin(tang),cov);
  oN=grain(oH.gb,cov);
  // Eight bits step visibly across a slow change of colour, so the steps are broken up.
  film=clamp(film+(hash(w)-.5)*.012,0.,1.)*step(.001,uFilm);
  oS=vec4(clamp(rough,.03,1.),metal*(1.+film)*.5,coat,cov);
  oE=vec4(emit*.25,cov);
  // Nacre and a soap film are films on what isn't metal, and nothing with a film has a pile, so the two share a channel.
  oM=vec4(coat>.01?uCoatRough:metal>.5?.5+tilt:film>0.?.5+film*.5:sheen*.5,uScatter,uMarks,cov);
  // As far below its middle as it stands above. With no middle that's below the ground, so it's solid all the way down.
  if(uFollow==0) oU=vec4(2.*uMid-h,0.,0.,cov);
  // A following surface goes down twice: its colour leaving the height be, then its height added on.
  // With SPLIT its grain's direction goes down with its colour, over what's there, as nothing can add a signed amount to eight bits.
  if(uFollow==1) oH=oD=vec4(0.);
  if(uFollow==2){oH=vec4(vec3(h,aniso*cos(tang),aniso*sin(tang))*cov,0.);oN=vec4(0.);oD=vec4(t*cov,0.,0.,0.);oA=oS=oE=oM=vec4(0.);}
  // Seen edge-on, its height is how far it stands toward this face, and the nearest of the others' solids is kept.
  if(uEdge==1){
    oH=vec4(seenAt,0.,0.,1.);oN=grain(vec2(0.),1.);oD=oU=vec4(0.);
    gl_FragDepth=1.-clamp(seenAt/1024.,0.,1.);
  }
}`;

// What handling leaves on an object, drawn once per device and read by the light pass, which
// knows how smooth each surface is. So a print shows on glass and vanishes into rubber.
//   r prints and smears  g dust  b hairline scratches  a haze, .5 being none
export const CONDITION_FS = `#version 300 es
precision highp float;
in vec2 vPx;
out vec4 o;
uniform vec2 uSeed;
uniform float uPrints,uDust,uScuff,uHaze;

mat2 rm(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vnoise(vec2 p){
  vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*vnoise(p);p=mat2(1.62,1.19,-1.19,1.62)*p+17.1;a*=.5;}return s/.9375;}

// A fingertip is about 17mm by 23mm, with ridges under half a millimetre apart.
float prints(vec2 w){
  const float CELL=150.;
  vec2 g=floor(w/CELL);
  float sum=0.;
  for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
    vec2 c=g+vec2(x,y);
    if(hash(c+.7)>uPrints*.85) continue;
    vec2 at=(c+.5+(vec2(hash(c+1.3),hash(c+2.9))-.5)*.9)*CELL;
    vec2 q=rm(hash(c+4.1)*6.2832)*(w-at)/(vec2(34.,46.)*(.75+.5*hash(c+5.7)));
    float r=length(q);
    if(r>1.) continue;
    // Ridges arch over a loop, and a finger drags half of them out into a smear.
    float ridge=.5+.5*sin((q.y*.62+q.x*q.x*.85+length(q-vec2(.12,-.3))*.5)*72.+fbm(w*.05+c)*11.);
    float press=smoothstep(1.,.45,r)*smoothstep(.22,.62,fbm(w*.06+c*3.));
    ridge=mix(ridge,.5,smoothstep(.38,.62,fbm(w*.028+c*7.)));
    sum=max(sum,press*(.5+.5*ridge));
  }
  return sum;
}

// Long and faint, on a slow curve, from every direction a cloth or a pocket ever moved.
float hairs(vec2 w,float ang,float seed){
  const float ROW=11.;
  vec2 q=rm(ang)*w;
  q.y+=sin(q.x*.011+seed*2.1)*17.;
  float row=floor(q.y/ROW);
  if(hash(vec2(row,seed))>uScuff*.2) return 0.;
  float seg=smoothstep(.5,.62,vnoise(vec2(q.x*.009+row*3.1,row+seed)));
  float y=abs(fract(q.y/ROW)-.5)*ROW;
  return seg*smoothstep(.62,.16,y)*(.45+.55*hash(vec2(row,seed+3.)));
}

float specks(vec2 w,float cell,float rad,float density){
  vec2 g=w/cell,i=floor(g);
  float best=0.;
  for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
    vec2 c=i+vec2(x,y);
    if(hash(c+2.2)>density) continue;
    float e=length(g-c-vec2(hash(c),hash(c+7.3)))*cell,r=rad*(.5+hash(c+3.1));
    best=max(best,smoothstep(r,r*.35,e));
  }
  return best;
}

float fibres(vec2 w){
  const float CELL=170.;
  vec2 g=floor(w/CELL);
  float sum=0.;
  for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
    vec2 c=g+vec2(x,y);
    if(hash(c+9.1)>uDust*.12) continue;
    vec2 at=(c+vec2(hash(c+1.7),hash(c+6.3)))*CELL;
    vec2 q=rm(hash(c+8.4)*6.2832)*(w-at);
    float k=(hash(c+2.6)-.5)*.03,len=4.+hash(c+5.2)*11.;
    float d=abs(q.y-k*q.x*q.x);
    sum=max(sum,smoothstep(.5,.1,d)*smoothstep(len,len*.7,abs(q.x)));
  }
  return sum;
}

void main(){
  vec2 w=vPx+uSeed;
  float smear=smoothstep(.5,.7,fbm(rm(1.1)*w*vec2(.0042,.02)+3.))*smoothstep(.45,.6,fbm(w*.009+9.));
  float oil=uPrints>0.?max(prints(w),smear*uPrints*.6):0.;

  // Most dust is too fine to see singly and shows as a soft bloom. A few grains stand out.
  float density=smoothstep(.3,.75,fbm(w*.011+5.));
  float dust=0.;
  if(uDust>0.){
    dust=smoothstep(.35,.8,fbm(w*1.3))*uDust*density*.025;
    dust=max(dust,specks(w,14.,.55,uDust*.05*density)*.3);
    dust=max(dust,fibres(w)*.12);
  }

  float hair=0.;
  if(uScuff>0.) for(int i=0;i<8;i++){
    float s=float(i);
    hair=max(hair,hairs(w,s*.78+.2,s+1.));
  }

  float haze=.5+(fbm(w*.0052+7.)*.8+fbm(w*.023+2.)*.2-.5)*2.*uHaze;
  o=vec4(oil,dust,hair,clamp(haze,0.,1.));
}`;

// Runs once per paint, over everything already drawn, because dirt depends on what is around it.
// Reads height and blends into albedo and rough/metal/coat.
export const WEATHER_FS = `#version 300 es
precision highp float;
in vec2 vPx;
layout(location=0) out vec4 oA;
layout(location=1) out vec4 oS;
uniform vec2 uCanvas,uSeed;
uniform float uAge,uDpr;
uniform sampler2D tH;
// What covers a place, which with SPLIT is in the normals' map.
#ifdef SPLIT
uniform sampler2D tN;
#define COVERS tN
#else
#define COVERS tH
#endif
uniform vec4 uMap;
#define AT(uv) ((uv)*uMap.xy+uMap.zw)

float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vnoise(vec2 p){
  vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*vnoise(p);p=mat2(1.62,1.19,-1.19,1.62)*p+17.1;a*=.5;}return s/.9375;}
// A height, as it stands where it covers, read as wide as lod and off css px from the pixel.
float at(vec2 uv,float lod,float off){
  return textureLod(tH,AT(uv),lod).r/max(textureLod(COVERS,AT(uv),lod).a,.05);
}

void main(){
  vec2 uv=vPx/uCanvas,w=vPx+uSeed;
  vec4 H=textureLod(tH,AT(uv),0.);
  float cov=textureLod(COVERS,AT(uv),0.).a;
  if(cov<.01) discard;
  float h=H.r/max(cov,.25),l=log2(uDpr);

  // Dirt settles wherever the surface sits below what is around it.
  float pit=clamp(max(at(uv,2.1+l,0.)-h,0.)*.9+max(at(uv,3.7+l,0.)-h,0.)*.3,0.,1.);
  pit*=.35+1.1*fbm(w*.05);
  // Nothing rests on a slope too steep to hold it, so the side of a tall body beside what stands on it stays clean.
  vec2 e=vec2(1.)/uCanvas;
  vec2 slope=vec2(at(uv+vec2(e.x,0.),l,1.)-at(uv-vec2(e.x,0.),l,1.),at(uv+vec2(0.,e.y),l,1.)-at(uv-vec2(0.,e.y),l,1.))/(2.*.25);
  float holds=1.-smoothstep(1.,2.5,length(slope));
  pit*=holds;

  // Water carries it downhill from anything that stands proud, and leaves it only where the surface is flat enough to keep it: on the
  // fall of a rounded edge, below a whole face that stands proud of it, it would pile up as a tide line along the bottom.
  float run=0.;
  for(int i=1;i<=7;i++){
    float t=float(i)/7.;
    vec2 q=uv-vec2(0.,t*62./uCanvas.y);
    run+=max(at(q,2.+l,t*62.)-h-.4,0.)*(1.-t);
  }
  float column=smoothstep(.4,.8,vnoise(vec2(w.x*.075,w.y*.01)))*(.45+.55*vnoise(vec2(w.x*.5,w.y*.02)));
  run=clamp(run*.1*column*holds,0.,1.);

  float dirt=clamp(pit*uAge*1.5+run*uAge*.9,0.,.9);
  float film=uAge*(.02+.09*fbm(w*.022+2.))*(.7+.6*vnoise(w*.8));
  float a=1.-(1.-dirt)*(1.-film);
  vec3 c=mix(vec3(.17,.15,.12),mix(vec3(.022,.017,.012),vec3(.07,.035,.016),run),dirt/max(a,.001));
  oA=vec4(c*cov,a);
  oS=vec4(.82*cov,0.,0.,a);
}`;

/**
 * How far, css px, a change of height changes what's seen of the room round it, as far as shows: the occlusion below looks out to 48, but
 * past its ring at 24 a part's travel of a few mm moves it by under a level. What lays a moved part without painting it lays this much
 * round it too.
 */
export const OCCLUSION_SEEN = 24;

// How much of the room each point can see, and in which direction the open part lies. It depends
// only on the height, so it is worked out once per paint and the light pass reads it in one tap.
export const OCCLUSION_FS = `#version 300 es
precision highp float;
in vec2 vPx;
out vec4 o;
uniform sampler2D tH;
uniform vec2 uCanvas;
uniform float uDpr;
uniform vec4 uMap;
#define AT(uv) ((uv)*uMap.xy+uMap.zw)
const float MM=.25;
float at(vec2 s,float l){
  return textureLod(tH,AT(s),l).r;
}
void main(){
  vec2 uv=vPx/uCanvas,e=vec2(1.5)/uCanvas;
  float h0=textureLod(tH,AT(uv),0.).r,lod=log2(uDpr);
  // Measured from the surface's own slope, so a dome does not shade itself.
  vec2 g=vec2(at(uv+vec2(e.x,0.),lod)-at(uv-vec2(e.x,0.),lod),at(uv+vec2(0.,e.y),lod)-at(uv-vec2(0.,e.y),lod))/(3.*MM);
  float seen=0.;
  vec2 open=vec2(0.);
  // Samples start a texel out, so with fewer pixels to the mm than one to the css px, they reach further as well.
  for(int i=0;i<10;i++){
    float a=(float(i)+.5)*.62832,r=1.5/min(uDpr,1.),top=0.;
    vec2 dir=vec2(cos(a),sin(a));
    for(int j=0;j<6;j++){
      vec2 s=uv+dir*r/uCanvas;
      float d=r*MM,rise=at(s,max(log2(r*uDpr)-1.3,0.))-h0-dot(g,dir)*d;
      top=max(top,rise/sqrt(rise*rise+d*d)*(1.-float(j)*.1));
      r*=2.;
    }
    seen+=1.-top*top;
    open+=dir*(1.-top);
  }
  o=vec4(seen*.1,open*.1*.5+.5,1.);
}`;
