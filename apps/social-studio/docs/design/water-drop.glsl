precision highp float;

/** @resolution */
uniform vec2 u_resolution;
/** @time */
uniform float u_time;
/** @backdrop */
uniform sampler2D u_backdrop;
/** @sdf */
uniform sampler2D u_sdf;

/**
 * @label Drop radius
 * @default 0.36
 * @range 0.25, 0.44
 */
uniform float u_radius;
/**
 * @label Drop shape waviness
 * @default 0.21
 * @range 0, 2
 */
uniform float u_shapeWave;
/**
 * @label Motion speed
 * @default 1
 * @range 0, 3
 */
uniform float u_speed;
/**
 * @label Animation phase
 * @default 0
 * @range 0, 20
 */
uniform float u_phase;

/**
 * @label Water IOR
 * @default 1.333
 * @range 1.01, 1.6
 */
uniform float u_ior;
/**
 * @label Bubble refraction strength
 * @default 1
 * @range 0, 2
 */
uniform float u_waterRefraction;
/**
 * @label Background distance
 * @default 3
 * @range 0, 8
 */
uniform float u_refraction;
/**
 * @label Water drop chromatic aberration
 * @default 0.7
 * @range 0, 2
 */
uniform float u_dropChromatic;

/**
 * @label Logo depth
 * @default 0.28
 * @range 0.03, 0.65
 */
uniform float u_logoDepth;
/**
 * @label Logo depth roundness
 * @default 0.2
 * @range 0, 1
 */
uniform float u_depthRoundness;
/**
 * @label Logo rotation X
 * @default 8
 * @range -180, 180
 */
uniform float u_logoPitch;
/**
 * @label Logo wiggle X intensity
 * @default 4
 * @range 0, 45
 */
uniform float u_wiggleX;
/**
 * @label Logo rotation Y
 * @default -18
 * @range -180, 180
 */
uniform float u_logoYaw;
/**
 * @label Logo wiggle Y intensity
 * @default 6
 * @range 0, 45
 */
uniform float u_wiggleY;
/**
 * @label Logo rotation Z
 * @default 0
 * @range -180, 180
 */
uniform float u_logoRoll;
/**
 * @label Logo wiggle Z intensity
 * @default 3
 * @range 0, 45
 */
uniform float u_wiggleZ;
/**
 * @label Logo wiggle speed
 * @default 0.6
 * @range 0, 3
 */
uniform float u_wiggleSpeed;

/**
 * @label Logo glass refraction
 * @default 1
 * @range 0, 2
 */
uniform float u_glass;
/**
 * @label Logo blackness
 * @default 0.45
 * @range 0, 1
 */
uniform float u_logoBlack;
/**
 * @label Logo glass reflections
 * @default 0.9
 * @range 0, 1.5
 */
uniform float u_glassShine;

/**
 * @label Key light brightness
 * @default 1.4
 * @range 0, 5
 */
uniform float u_keyPower;
/**
 * @label Key light color
 * @color
 * @default #FFFFFF
 */
uniform vec3 u_keyColor;
/**
 * @label Key light azimuth
 * @default -35
 * @range -180, 180
 */
uniform float u_keyAngle;
/**
 * @label Key light elevation
 * @default 40
 * @range -85, 85
 */
uniform float u_keyElevation;
/**
 * @label Key light softness
 * @default 0.45
 * @range 0.02, 1
 */
uniform float u_keySoftness;

/**
 * @label Fill light brightness
 * @default 0.9
 * @range 0, 5
 */
uniform float u_fillPower;
/**
 * @label Fill light color
 * @color
 * @default #BCDFFF
 */
uniform vec3 u_fillColor;
/**
 * @label Fill light azimuth
 * @default 75
 * @range -180, 180
 */
uniform float u_fillAngle;
/**
 * @label Fill light elevation
 * @default -20
 * @range -85, 85
 */
uniform float u_fillElevation;
/**
 * @label Fill light softness
 * @default 0.65
 * @range 0.02, 1
 */
uniform float u_fillSoftness;

/**
 * @label Air pocket chromatic aberration
 * @default 0.25
 * @range 0, 2
 */
uniform float u_chromatic;
/**
 * @label Air pockets
 * @default 50
 * @range 0, 64
 */
uniform float u_bubbles;
/**
 * @label Air pocket size
 * @default 1
 * @range 0.1, 3
 */
uniform float u_pocketSize;
/**
 * @label Air pocket flow speed
 * @default 0.7
 * @range 0, 3
 */
uniform float u_flowSpeed;
/**
 * @label Air pocket turbulence
 * @default 1.7
 * @range 0, 2
 */
uniform float u_turbulence;
/**
 * @label Air pocket turbulence scale
 * @default 2.5
 * @range 0.5, 6
 */
uniform float u_turbulenceScale;

/**
 * @label Bloom
 * @default 0.6
 * @range 0, 2
 */
uniform float u_bloom;

/**
 * @label Top highlight strength
 * @default 1
 * @range 0, 3
 */
uniform float u_topHighlight;
/**
 * @label Top highlight spread
 * @default 0.355
 * @range 0.25, 2
 */
uniform float u_topSpread;
/**
 * @label Top glow strength
 * @default 0.42
 * @range 0, 3
 */
uniform float u_topGlowStrength;
/**
 * @label Top glow spread
 * @default 0.8275
 * @range 0.25, 2
 */
uniform float u_topGlowSpread;

/**
 * @label Bottom highlight strength
 * @default 1
 * @range 0, 3
 */
uniform float u_bottomHighlight;
/**
 * @label Bottom highlight spread
 * @default 0.7575
 * @range 0.25, 2
 */
uniform float u_bottomSpread;
/**
 * @label Bottom glow strength
 * @default 1.59
 * @range 0, 3
 */
uniform float u_bottomGlowStrength;
/**
 * @label Bottom glow spread
 * @default 0.5475
 * @range 0.25, 2
 */
uniform float u_bottomGlowSpread;

float hash(float n){return fract(sin(n*127.1+311.7)*43758.5453);}
float gauss(float x){return exp(-x*x);}
vec2 uvFor(vec2 point){return 0.5+vec2(point.x,-point.y)*min(u_resolution.x,u_resolution.y)*u_radius/u_resolution;}
vec3 environment(vec2 point){return texture2D(u_backdrop,clamp(uvFor(point),vec2(0.002),vec2(0.998))).rgb;}
vec2 exitToBackground(vec3 origin,vec3 ray,float ior){
 float b=dot(origin,ray);
 float travel=-b+sqrt(max(0.0,b*b+1.0-dot(origin,origin)));
 vec3 exitPoint=origin+ray*travel;
 vec3 outside=refract(ray,-normalize(exitPoint),ior);
 float valid=step(0.00001,dot(outside,outside));
 outside=mix(reflect(ray,-normalize(exitPoint)),outside,valid);
 float dz=min(outside.z,-0.035);
 float planeTravel=(-1.0-u_refraction-exitPoint.z)/dz;
 return exitPoint.xy+outside.xy*planeTravel;
}
float smoothNoise(float t){
 float i=floor(t);
 float f=fract(t);
 f=f*f*f*(f*(f*6.0-15.0)+10.0);
 return mix(hash(i),hash(i+1.0),f)*2.0-1.0;
}
float wiggle(float seed){
 float t=u_time*u_wiggleSpeed;
 return (smoothNoise(t+seed)+0.35*smoothNoise(t*1.73+seed*2.13))/1.35;
}
mat2 rollM,yawM,pitchM;
void setupLogoRotation(){
 float roll=radians(u_logoRoll+u_wiggleZ*wiggle(97.2));
 rollM=mat2(cos(roll),-sin(roll),sin(roll),cos(roll));
 float yaw=radians(u_logoYaw+u_wiggleY*wiggle(51.7));
 float pitch=radians(u_logoPitch+u_wiggleX*wiggle(13.4));
 yawM=mat2(cos(yaw),-sin(yaw),sin(yaw),cos(yaw));
 pitchM=mat2(cos(pitch),-sin(pitch),sin(pitch),cos(pitch));
}
vec3 logoLocal(vec3 p){
 p.xy=rollM*p.xy;
 p.xz=yawM*p.xz;
 p.yz=pitchM*p.yz;
 return p;
}
float logoDistance(vec3 world){
 vec3 local=logoLocal(world);
 float scale=min(u_resolution.x,u_resolution.y)*u_radius*1.35;
 float shape=-texture2D(u_sdf,uvFor(local.xy*1.35)).r/scale;
 float roundness=u_logoDepth*0.5*u_depthRoundness;
 vec2 d=vec2(shape+roundness,abs(local.z)-u_logoDepth*0.5+roundness);
 return min(max(d.x,d.y),0.0)+length(max(d,vec2(0.0)))-roundness;
}
vec3 logoNormal(vec3 p){
 vec2 e=vec2(0.002,0.0);
 vec3 g=vec3(logoDistance(p+e.xyy)-logoDistance(p-e.xyy),logoDistance(p+e.yxy)-logoDistance(p-e.yxy),logoDistance(p+e.yyx)-logoDistance(p-e.yyx));
 return normalize(g+vec3(0.0,0.0,0.000001));
}
vec3 studioLight(vec3 point,vec3 n,vec3 view,float azimuth,float elevation,float softness,vec3 color,float power){
 float az=radians(azimuth);
 float el=radians(elevation);
 vec3 source=3.0*vec3(sin(az)*cos(el),-sin(el),cos(az)*cos(el));
 vec3 l=normalize(source-point);
 vec3 h=normalize(l+view+vec3(0.0,0.0,0.00001));
 float exponent=mix(220.0,5.0,softness*softness);
 float facing=max(dot(n,l),0.0);
 float spec=pow(max(dot(n,h),0.0),exponent)*smoothstep(0.0,0.08,facing);
 float edge=pow(1.0-clamp(dot(n,view),0.0,1.0),3.0);
 float broad=facing*(0.035+0.12*edge);
 return color*power*(spec*0.85+broad)*u_glassShine;
}
void main(){
 setupLogoRotation();
 float sz=min(u_resolution.x,u_resolution.y);
 float t=u_time*u_speed+u_phase;
 vec2 p=(gl_FragCoord.xy-u_resolution*0.5)/(sz*u_radius);
 p.y=-p.y;
 float stretch=1.0+u_shapeWave*0.06*sin(t*1.3);
 vec2 q=vec2(p.x*stretch,p.y/stretch);
 q.x+=u_shapeWave*0.022*sin(p.y*4.0+t);
 float theta=atan(q.y,q.x);
 float outline=1.0+u_shapeWave*(0.023*sin(theta*3.0+t*0.9)+0.014*cos(theta*2.0-t));
 vec2 sphere=q/outline;
 float r=length(sphere);
 float mask=1.0-smoothstep(0.996,1.004,r);
 vec2 hitXY=sphere*min(1.0,0.9999/max(r,0.0001));
 vec3 entry=vec3(hitXY,sqrt(max(0.0001,1.0-dot(hitXY,hitXY))));
 vec3 normal=normalize(entry);
 float ior=1.0+(u_ior-1.0)*u_waterRefraction;
 float dispersion=0.025*u_chromatic*u_waterRefraction;
 float iorR=max(1.0,ior-dispersion);
 float iorB=ior+dispersion;
 vec3 ray=refract(vec3(0.0,0.0,-1.0),normal,1.0/ior);
 vec3 rayR=refract(vec3(0.0,0.0,-1.0),normal,1.0/iorR);
 vec3 rayB=refract(vec3(0.0,0.0,-1.0),normal,1.0/iorB);
 vec2 backPoint=exitToBackground(entry,ray,ior);
 float dropDispersion=0.045*u_dropChromatic*u_waterRefraction;
 float dropIORR=max(1.0,ior-dropDispersion);
 float dropIORB=ior+dropDispersion;
 vec3 dropRayR=refract(vec3(0.0,0.0,-1.0),normal,1.0/dropIORR);
 vec3 dropRayB=refract(vec3(0.0,0.0,-1.0),normal,1.0/dropIORB);
 vec2 backR=exitToBackground(entry,dropRayR,dropIORR);
 vec2 backB=exitToBackground(entry,dropRayB,dropIORB);
 vec3 transmitted=vec3(environment(backR).r,environment(backPoint).g,environment(backB).b);
 vec3 reflectedRay=reflect(vec3(0.0,0.0,-1.0),normal);
 vec3 reflected=environment(reflectedRay.xy*2.0);
 float f0=pow((ior-1.0)/(ior+1.0),2.0);
 float fresnel=f0+(1.0-f0)*pow(1.0-normal.z,5.0);
 vec3 col=mix(transmitted,reflected,fresnel);

 float fringe=0.012*u_dropChromatic;
 if(r-abs(fringe)<1.004){
  vec3 logoView=vec3(0.0,0.0,-1.0);
  float focusTravel=-entry.z/min(ray.z,-0.001);
  vec3 focusPoint=entry+ray*focusTravel;
  vec3 logoCamera=vec3(focusPoint.xy,1.0);
  float logoTravel=0.0;
  float found=0.0;
  for(int j=0;j<56;j++){
   float ld=logoDistance(logoCamera+logoView*logoTravel);
   float hit=(1.0-step(0.0015,ld))*step(logoTravel,2.2);
   found=max(found,hit);
   if(found>0.5||logoTravel>2.2) break;
   logoTravel+=max(ld*0.8,0.001);
  }
  float a=found*mask;
  vec3 logoPoint=logoCamera+logoView*logoTravel;
  vec3 glassN=logoNormal(logoPoint);
  float glassIOR=mix(ior,1.52,u_glass);
  vec3 entryRefraction=refract(logoView,glassN,ior/glassIOR);
  float entryTIR=1.0-step(0.00001,dot(entryRefraction,entryRefraction));
  vec3 glassRay=normalize(mix(entryRefraction,reflect(logoView,glassN),entryTIR));
  vec3 internalOrigin=logoPoint+glassRay*0.004;
  float glassTravel=0.0;
  float exited=0.0;
  for(int j=0;j<48;j++){
   float ld=logoDistance(internalOrigin+glassRay*glassTravel);
   exited=max(exited,step(-0.001,ld));
   if(exited>0.5||glassTravel>1.5) break;
   glassTravel+=max(-ld*0.8,0.001);
  }
  vec3 glassExit=internalOrigin+glassRay*glassTravel;
  vec3 exitN=logoNormal(glassExit);
  vec3 exitRay=refract(glassRay,-exitN,glassIOR/ior);
  float exitTIR=1.0-step(0.00001,dot(exitRay,exitRay));
  vec3 glassOut=normalize(mix(exitRay,reflect(glassRay,exitN),exitTIR)+ray-logoView);
  vec3 glassOrigin=glassExit+glassOut*0.003;
  glassOrigin*=min(1.0,0.98/max(length(glassOrigin),0.001));
  vec3 glassColor=environment(exitToBackground(glassOrigin,glassOut,ior));
  vec3 surfaceReflection=environment(exitToBackground(logoPoint+glassN*0.004,reflect(logoView,glassN),ior));
  float glassF0=pow((glassIOR-ior)/(glassIOR+ior),2.0);
  float glassF=glassF0+(1.0-glassF0)*pow(1.0-clamp(dot(-logoView,glassN),0.0,1.0),5.0);
  glassColor=mix(glassColor,surfaceReflection,clamp(glassF+entryTIR+exitTIR*0.65,0.0,1.0));
  float absorption=exp(-u_logoBlack*14.0*(glassTravel+0.004));
  glassColor=mix(vec3(0.003,0.006,0.01),glassColor,absorption);
  glassColor+=studioLight(logoPoint,glassN,-logoView,u_keyAngle,u_keyElevation,u_keySoftness,u_keyColor,u_keyPower);
  glassColor+=studioLight(logoPoint,glassN,-logoView,u_fillAngle,u_fillElevation,u_fillSoftness,u_fillColor,u_fillPower);
  col=mix(col,glassColor,a);
  float bt=u_time*u_flowSpeed+u_phase;
  for(int i=0;i<64;i++){
   if(float(i)+0.5>u_bubbles) break;
   float fi=float(i);
   float phase=hash(fi+47.0)*6.283185;
   float speed=0.28+0.48*hash(fi+101.0);
   float clock=bt*speed;
   float direction=mix(-1.0,1.0,step(0.5,hash(fi+78.0)));
   float frac=(fi+0.5)/max(u_bubbles,1.0);
   float rad=0.90*pow(clamp(frac,0.0,1.0),0.333333);
   float zz=mix(-0.8,0.8,hash(fi+31.0));
   vec3 seed=vec3(sqrt(1.0-zz*zz)*cos(fi*2.399963),sqrt(1.0-zz*zz)*sin(fi*2.399963),zz)*rad;
   vec3 flow=seed+0.17*u_turbulence*vec3(sin(clock*direction+phase),sin(clock*0.79+phase*1.3),cos(clock*0.61+phase));
   flow+=0.05*u_turbulence*sin(flow.yzx*u_turbulenceScale*2.0+clock);
   flow/=pow(1.0+pow(length(flow)/0.91,12.0),1.0/12.0);
   float radius=mix(0.014,0.037,hash(fi+89.0))*u_pocketSize;
   float behind=step(flow.z,logoPoint.z)*a;
   vec3 bray=normalize(mix(ray,glassOut,behind));
   vec3 borigin=mix(entry,glassOrigin,behind);
   vec3 delta=flow-borigin;
   float along=dot(delta,bray);
   vec3 perpendicular=delta-bray*along;
   float dist=length(perpendicular)/radius;
   vec3 pr=normalize(mix(rayR,glassOut,behind));
   vec3 pb=normalize(mix(rayB,glassOut,behind));
   float alongR=dot(delta,pr);
   float alongB=dot(delta,pb);
   float distR=length(delta-pr*alongR)/radius;
   float distB=length(delta-pb*alongB)/radius;
   if(along<0.0||min(dist,min(distR,distB))>=1.10) continue;
   float clearance=logoDistance(flow);
   float isActive=step(fi+0.5,u_bubbles)*step(0.0,along)*smoothstep(radius,radius+0.015,clearance);
   vec3 bubbleMask=(vec3(1.0)-smoothstep(vec3(0.85),vec3(1.10),vec3(distR,dist,distB)))*isActive;
   vec3 bn=normalize(-perpendicular-bray*radius*sqrt(max(0.001,1.0-min(dist*dist,0.999))));
   vec3 bubbleRay=refract(bray,bn,ior);
   float tir=1.0-step(0.0001,dot(bubbleRay,bubbleRay));
   vec3 bubbleEntry=borigin+bray*(along-radius*sqrt(max(0.001,1.0-min(dist*dist,0.999))));
   vec3 innerRay=mix(bubbleRay,reflect(bray,bn),tir);
   float airTravel=max(0.0,-2.0*dot(bubbleEntry-flow,innerRay));
   vec3 bubbleExit=bubbleEntry+innerRay*airTravel;
   vec3 airNormal=normalize(bubbleExit-flow);
   vec3 resumedRay=refract(innerRay,-airNormal,1.0/ior);
   resumedRay=normalize(mix(resumedRay,reflect(bray,bn),tir));
   vec3 safeExit=bubbleExit*min(1.0,0.98/max(length(bubbleExit),0.001));
   vec3 bubbleSample=environment(exitToBackground(safeExit,resumedRay,ior));
   float bf=0.035+0.75*pow(clamp(dist,0.0,1.0),5.0);
   vec3 bubbleColor=mix(bubbleSample,reflected,bf);
   float spec=pow(max(dot(bn,normalize(vec3(-0.4,-0.55,0.7))),0.0),16.0);
   bubbleColor+=vec3(0.85,0.92,1.0)*(spec*0.8+tir*0.22);
   col=mix(col,bubbleColor,bubbleMask);
  }
 }
 vec3 scene=texture2D(u_backdrop,gl_FragCoord.xy/u_resolution).rgb;
 vec3 spectralRadius=vec3(r-fringe,r,r+fringe);
 vec3 spectralMask=vec3(1.0)-smoothstep(vec3(0.996),vec3(1.004),spectralRadius);
 vec3 rgb=mix(scene,col,spectralMask);
 float topAngle=acos(clamp(-sphere.y/max(r,0.0001),-1.0,1.0));
 float bottomAngle=3.14159265-topAngle;
 float edgeDistance=r-1.0;
 float topWidth=mix(0.026+0.24*u_topSpread,0.026,step(0.0,edgeDistance));
 float bottomWidth=mix(0.026+0.24*u_bottomSpread,0.026,step(0.0,edgeDistance));
 vec3 spectralEdge=spectralRadius-vec3(1.0);
 vec3 topDistance=spectralEdge/vec3(topWidth);
 vec3 bottomDistance=spectralEdge/vec3(bottomWidth);
 vec3 topRadial=exp(-topDistance*topDistance);
 vec3 bottomRadial=exp(-bottomDistance*bottomDistance);
 vec3 topSurface=gauss(topAngle/(0.48+0.62*sqrt(u_topSpread)))*topRadial;
 vec3 bottomSurface=gauss(bottomAngle/(0.48+0.62*sqrt(u_bottomSpread)))*bottomRadial;
 vec3 surface=topSurface*u_topHighlight+bottomSurface*u_bottomHighlight;
 rgb=mix(rgb,vec3(1.0),vec3(1.0)-exp(-surface*2.5));
 float topHalo=gauss(topAngle/(0.58+0.35*u_topGlowSpread))*gauss(edgeDistance/(0.045+0.15*u_topGlowSpread));
 float bottomHalo=gauss(bottomAngle/(0.58+0.35*u_bottomGlowSpread))*gauss(edgeDistance/(0.045+0.15*u_bottomGlowSpread));
 float halo=(topHalo*u_topGlowStrength+bottomHalo*u_bottomGlowStrength)*u_bloom;
 rgb=vec3(1.0)-(vec3(1.0)-rgb)*exp(-vec3(0.9,0.95,1.0)*halo*1.5);
 gl_FragColor=vec4(clamp(rgb,0.0,1.0),1.0);
}
