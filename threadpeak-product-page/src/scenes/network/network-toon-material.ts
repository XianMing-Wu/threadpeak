import * as T from 'three';
// Explicit ink colors keep shadows chromatic instead of multiplying them to gray.
export const networkPalette = {
    author: ['#b8d9f6', '#85b7e4', '#f0f8ff'],
    concept: ['#c8e7f6', '#93bfd9', '#f5fcff'],
    carrier: ['#82cfb7', '#54aa96', '#d9f5e9'],
    question: ['#94bdf0', '#6594ce', '#e4f0ff'],
    selected: ['#73abea', '#4887c6', '#ddecff'],
    lettering: ['#4e89b9', '#376b99', '#acd2e8'],
} as const;
export function createNetworkToon(kind: keyof typeof networkPalette) {
    const colors = networkPalette[kind];
    return new T.ShaderMaterial({
        transparent: true,
        uniforms: { base: { value: new T.Color(colors[0]) }, shade: { value: new T.Color(colors[1]) }, light: { value: new T.Color(colors[2]) }, alpha: { value: 1 } },
        vertexShader: `varying vec3 faceNormal;void main(){faceNormal=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
        fragmentShader: `varying vec3 faceNormal;uniform vec3 base;uniform vec3 shade;uniform vec3 light;uniform float alpha;
   void main(){
    float diffuse=dot(normalize(faceNormal),normalize(vec3(-0.5,0.7,0.85)));
    float aa=max(fwidth(diffuse),0.006);
    vec3 ink=mix(shade,base,smoothstep(0.06-aa,0.06+aa,diffuse));
    ink=mix(ink,light,smoothstep(0.76-aa,0.76+aa,diffuse));
    gl_FragColor=vec4(ink,alpha);
    #include <colorspace_fragment>
   }`,
    });
}
