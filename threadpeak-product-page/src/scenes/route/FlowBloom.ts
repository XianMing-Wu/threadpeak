import * as T from 'three';
const vertex = 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
/** Selective blue bloom. Only the moving ribbon is blurred, never the page. */
export class FlowBloom {
    private base = new T.WebGLRenderTarget(1, 1, { depthBuffer: false });
    private scratch = new T.WebGLRenderTarget(1, 1, { depthBuffer: false });
    private inner = new T.WebGLRenderTarget(1, 1, { depthBuffer: false });
    private outer = new T.WebGLRenderTarget(1, 1, { depthBuffer: false });
    private scene = new T.Scene();
    private camera = new T.Camera();
    private geometry = new T.PlaneGeometry(2, 2);
    private blur = new T.ShaderMaterial({ depthTest: false, depthWrite: false, toneMapped: false, uniforms: { source: { value: null }, stepSize: { value: new T.Vector2() } }, vertexShader: vertex, fragmentShader: `varying vec2 vUv;uniform sampler2D source;uniform vec2 stepSize;void main(){vec4 c=vec4(0.);float total=0.;for(int i=-5;i<=5;i++){float weight=exp(-float(i*i)/9.);c+=texture2D(source,vUv+stepSize*float(i))*weight;total+=weight;}gl_FragColor=c/total;}` });
    private composite = new T.ShaderMaterial({ transparent: true, depthTest: false, depthWrite: false, toneMapped: false, uniforms: { core: { value: this.base.texture }, nearGlow: { value: this.inner.texture }, farGlow: { value: this.outer.texture } }, vertexShader: vertex, fragmentShader: `varying vec2 vUv;uniform sampler2D core;uniform sampler2D nearGlow;uniform sampler2D farGlow;
  void main(){vec4 beam=texture2D(core,vUv);float nearA=texture2D(nearGlow,vUv).a;float farA=texture2D(farGlow,vUv).a;
   float aFar=clamp(farA*2.6,0.,.20),aNear=clamp(nearA*1.8,0.,.50);
   vec3 c=vec3(.015,.28,1.)*aFar;float a=aFar;
   c=vec3(.0,.53,1.)*aNear+c*(1.-aNear);a=aNear+a*(1.-aNear);
   c=beam.rgb+c*(1.-beam.a);a=beam.a+a*(1.-beam.a);gl_FragColor=vec4(c/max(a,.0001),a);
  }` });
    private quad = new T.Mesh(this.geometry, this.blur);
    private width = 0;
    private height = 0;
    constructor() { this.base.samples = 4; this.quad.frustumCulled = false; this.scene.add(this.quad); }
    render(renderer: T.WebGLRenderer, scene: T.Scene, camera: T.Camera, w: number, h: number, visible: boolean) {
        camera.layers.set(0);
        renderer.setRenderTarget(null);
        renderer.render(scene, camera);
        if (!visible)
            return;
        const width = Math.max(1, Math.round(w)), height = Math.max(1, Math.round(h));
        if (width !== this.width || height !== this.height) {
            this.width = width;
            this.height = height;
            for (const target of [this.base, this.scratch, this.inner, this.outer])
                target.setSize(width, height);
        }
        const clear = renderer.getClearColor(new T.Color()), alpha = renderer.getClearAlpha();
        renderer.setClearColor(0, 0);
        camera.layers.set(1);
        renderer.setRenderTarget(this.base);
        renderer.render(scene, camera);
        camera.layers.set(0);
        this.quad.material = this.blur;
        for (const [radius, target] of [[7, this.inner], [22, this.outer]] as const) {
            this.blur.uniforms.source.value = this.base.texture;
            this.blur.uniforms.stepSize.value.set(radius / 5 / width, 0);
            renderer.setRenderTarget(this.scratch);
            renderer.render(this.scene, this.camera);
            this.blur.uniforms.source.value = this.scratch.texture;
            this.blur.uniforms.stepSize.value.set(0, radius / 5 / height);
            renderer.setRenderTarget(target);
            renderer.render(this.scene, this.camera);
        }
        renderer.setRenderTarget(null);
        renderer.setClearColor(clear, alpha);
        this.quad.material = this.composite;
        const autoClear = renderer.autoClear;
        renderer.autoClear = false;
        renderer.render(this.scene, this.camera);
        renderer.autoClear = autoClear;
    }
    dispose() { for (const t of [this.base, this.scratch, this.inner, this.outer])
        t.dispose(); this.blur.dispose(); this.composite.dispose(); this.geometry.dispose(); }
}
