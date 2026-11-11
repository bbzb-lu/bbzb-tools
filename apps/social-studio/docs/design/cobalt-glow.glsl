precision highp float;
/** @resolution */
uniform vec2 u_resolution;
/**
 * @label Reach
 * @default 0.78
 * @range 0.2, 1.5
 */
uniform float u_reach;
/**
 * @label Angle
 * @default 0.65
 * @range 0.1, 1.5
 */
uniform float u_angle;
/**
 * @label Softness
 * @default 0.55
 * @range 0.1, 1.0
 */
uniform float u_softness;
/**
 * @label White light
 * @default 0.22
 * @range 0.0, 0.6
 */
uniform float u_light;
/**
 * @label Blue
 * @color
 * @default #3444CB
 */
uniform vec3 u_blue;
/**
 * @label Grain
 * @default 0.3
 * @range 0.0, 1.0
 */
uniform float u_grain;
float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
void main() {
 vec2 uv=gl_FragCoord.xy/u_resolution;
 float d=(1.0-uv.y+uv.x*u_angle+0.10*uv.x*uv.x)/max(u_reach,0.01);
 float halo=1.0-smoothstep(0.06,0.48+u_softness,d);
 float white=1.0-smoothstep(u_light-0.18,u_light+0.26,d);
 vec3 col=mix(vec3(0.001,0.002,0.004),u_blue,halo*halo);
 col=mix(col,vec3(0.99,0.993,1.0),white);
 col+=(hash(gl_FragCoord.xy)-0.5)*u_grain/255.0;
 gl_FragColor=vec4(clamp(col,0.0,1.0),1.0);
}
