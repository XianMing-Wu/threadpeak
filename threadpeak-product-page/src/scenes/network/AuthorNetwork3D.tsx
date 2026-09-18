import { useEffect,useRef,useState,type RefObject } from 'react';
import * as T from 'three';
import type { ScrollTransition } from "../../core/scroll-transition.ts";
import { legacyRaw } from "../../core/story-clock.ts";
import { CardAvatar } from "../../components/learning/CardAvatar.tsx";
import { lerp,part } from "../../core/motion.ts";
import { CONSULTATION_START,NETWORK_EXIT } from "../../core/timeline.ts";
import { arrivingAuthors,graph,networkProgress,networkVolumeProgress,nodeAuthor,projectedNetwork } from "./author-network-motion.ts";
import { networkVolume } from "./author-network-volume.ts";
import { createNetworkToon,networkPalette } from "./network-toon-material.ts";
import { topicGeometry } from "./network-topic-geometry.ts";
const V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
export function AuthorNetwork3D({ transition, selected, onSelect }: {
    transition: RefObject<ScrollTransition>;
    selected: string;
    onSelect: (id: string) => void;
}) {
    const host = useRef<HTMLDivElement>(null), latest = useRef({ selected, onSelect });
    latest.current = { selected, onSelect };
    const [failure, setFailure] = useState(''), [retry, setRetry] = useState(0);
    useEffect(() => {
        const el = host.current!, surface = el.querySelector('canvas')!, labels = new Map([...el.querySelectorAll<HTMLElement>('[data-space-id]')].map(n => [n.dataset.spaceId!, n]));
        const reduced = matchMedia('(prefers-reduced-motion: reduce)');
        let frame = 0, last = 0, time = 0, renderer: T.WebGLRenderer | undefined, scene: T.Scene, world: T.Group, camera: T.PerspectiveCamera;
        let width = 0, height = 0, failed = false, hover = '', down: {
            x: number;
            y: number;
            id: string;
            rx: number;
            ry: number;
            moved: boolean;
        } | null = null;
        let yaw = 0, pitch = 0, targetYaw = 0, targetPitch = 0, autoYaw = 0, lastSelection = '', lastNarrow = false;
        let nodes: Array<{
            mesh: T.Mesh<T.SphereGeometry, T.ShaderMaterial>;
            outline: T.Mesh;
            id: string;
            radius: number;
            entry: number;
            index: number;
            kind: string;
        }> = [];
        let edges: Array<{
            mesh: T.Mesh<T.CylinderGeometry, T.MeshBasicMaterial>;
            bead: T.Mesh;
            source: string;
            target: string;
            index: number;
        }> = [];
        let lettering: Array<{
            id: string;
            mesh: T.Mesh<T.ExtrudeGeometry, T.ShaderMaterial>;
            index: number;
        }> = [];
        const destination = networkVolume(), positions = new Map<string, T.Vector3>(), highlighted = new Set<string>(), resources: Array<{
            dispose: () => void;
        }> = [];
        const keep = <A extends {
            dispose: () => void;
        }>(resource: A) => { resources.push(resource); return resource; };
        const resize = new ResizeObserver(() => { width = el.clientWidth; height = el.clientHeight; if (renderer && width && height) {
            renderer.setSize(width, height, false);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
        } });
        resize.observe(el);
        function dispose() { renderer?.dispose(); renderer = undefined; resources.splice(0).forEach(r => r.dispose()); nodes = []; edges = []; lettering = []; el.dataset.renderer = 'sleeping'; for (const n of labels.values())
            n.style.visibility = 'hidden'; }
        function initialize() {
            try {
                renderer = new T.WebGLRenderer({ canvas: surface, alpha: true, antialias: true, powerPreference: 'low-power' });
            }
            catch {
                failed = true;
                setFailure('3D 网络暂时无法显示');
                return;
            }
            renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
            renderer.setSize(width, height, false);
            renderer.setClearColor(0xffffff, 0);
            renderer.outputColorSpace = T.SRGBColorSpace;
            renderer.toneMapping = T.NoToneMapping;
            scene = new T.Scene();
            world = new T.Group();
            scene.add(world);
            camera = new T.PerspectiveCamera(47, width / height, 1, 1800);
            camera.position.set(0, 0, 820);
            // Three tone bands and a back-face ink silhouette: spatial geometry, drawn finish.
            const sphere = keep(new T.SphereGeometry(1, 32, 24)), cylinder = keep(new T.CylinderGeometry(1, 1, 1, 6)), beadMaterial = keep(new T.MeshBasicMaterial({ color: '#7396bf', transparent: true }));
            const outlineMaterial = keep(new T.MeshBasicMaterial({ color: '#779ec1', side: T.BackSide }));
            nodes = graph.nodes.map((n, index) => {
                const author = nodeAuthor(n.id), featured = author && arrivingAuthors.includes(author.id);
                const material = keep(createNetworkToon(n.kind));
                const mesh = new T.Mesh(sphere, material), outline = new T.Mesh(sphere, outlineMaterial);
                world.add(outline, mesh);
                const radius = n.kind === 'author' ? (featured ? 20 : 6.8) : n.kind === 'carrier' ? 15 : n.kind === 'question' ? 10 : 9;
                const entry = featured ? .54 : n.kind === 'question' ? .575 : n.kind === 'concept' ? .615 : n.kind === 'carrier' ? .66 : .70 + (index % 5) * .007;
                return { mesh, outline, id: n.id, radius, entry, index, kind: n.kind };
            });
            lettering = graph.nodes.filter(n => n.kind === 'carrier').map((n, index) => { const mesh = new T.Mesh(keep(topicGeometry(index)), keep(createNetworkToon('lettering'))); world.add(mesh); return { id: n.id, mesh, index }; });
            edges = graph.edges.map((e, index) => {
                const material = keep(new T.MeshBasicMaterial({ color: '#a9bacb', transparent: true }));
                const mesh = new T.Mesh(cylinder, material), bead = new T.Mesh(sphere, beadMaterial);
                bead.scale.setScalar(1.9);
                world.add(mesh, bead);
                return { mesh, bead, source: e.source, target: e.target, index };
            });
            el.dataset.renderer = 'webgl';
            el.dataset.style = 'toon';
            el.dataset.topicMeshes = String(lettering.length);
            el.dataset.topicVertices = String(lettering.reduce((sum, n) => sum + n.mesh.geometry.attributes.position.count, 0));
            el.dataset.nodeCount = String(nodes.length);
            el.dataset.edgeCount = String(edges.length);
        }
        const pointerId = (e: PointerEvent) => (e.target as Element).closest<HTMLElement>('[data-author-id]')?.dataset.authorId ?? '';
        const enter = (e: PointerEvent) => { hover = pointerId(e); };
        const leave = () => { hover = ''; down = null; };
        const start = (e: PointerEvent) => { if (networkProgress(legacyRaw(transition.current.progress)) < .88)
            return; down = { x: e.clientX, y: e.clientY, id: pointerId(e), rx: targetYaw, ry: targetPitch, moved: false }; el.setPointerCapture(e.pointerId); };
        const move = (e: PointerEvent) => { if (!down) {
            hover = pointerId(e);
            return;
        } const dx = e.clientX - down.x, dy = e.clientY - down.y; down.moved ||= Math.hypot(dx, dy) > 4; targetYaw = down.rx + dx * .006; targetPitch = Math.max(-.62, Math.min(.62, down.ry + dy * .004)); };
        const end = (e: PointerEvent) => { if (down && !down.moved && down.id)
            latest.current.onSelect(down.id); down = null; if (el.hasPointerCapture(e.pointerId))
            el.releasePointerCapture(e.pointerId); };
        el.addEventListener('pointerover', enter);
        el.addEventListener('pointerleave', leave);
        el.addEventListener('pointerdown', start);
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerup', end);
        el.addEventListener('pointercancel', leave);
        const up = V(0, 1, 0), direction = V(), screen = V();
        function tick(now: number) {
            const dt = last ? Math.min(.05, (now - last) / 1000) : 0;
            last = now;
            const raw = legacyRaw(transition.current.progress), p = networkVolumeProgress(networkProgress(raw)), visible = p > .525 && raw < NETWORK_EXIT;
            if (width && height && !renderer && !failed && raw >= 29.2 && raw < NETWORK_EXIT && !document.hidden)
                initialize();
            if (!visible)
                for (const n of labels.values()) {
                    n.style.visibility = 'hidden';
                    n.style.opacity = '0';
                }
            if (visible && width && height && !document.hidden) {
                if (!renderer && !failed)
                    initialize();
                if (renderer) {
                    const narrow = el.closest('section')?.querySelector('[data-narrow="true"]') !== null;
                    if (lastNarrow !== narrow) {
                        lastNarrow = narrow;
                        renderer.setSize(width, height, false);
                        camera.aspect = width / height;
                        camera.updateProjectionMatrix();
                    }
                    time += reduced.matches || raw >= CONSULTATION_START ? 0 : dt;
                    const idle = part(p, .75, .90);
                    if (raw < CONSULTATION_START && !reduced.matches && !hover && !down && !el.contains(document.activeElement))
                        autoYaw += dt * .095 * idle;
                    yaw = lerp(yaw, targetYaw, 1 - Math.exp(-dt * 7));
                    pitch = lerp(pitch, targetPitch, 1 - Math.exp(-dt * 7));
                    if (p < .60) {
                        autoYaw = 0;
                        targetYaw = 0;
                        targetPitch = 0;
                        time = 0;
                    }
                    const formation = part(p, .565, .74);
                    world.rotation.set((-.13 + pitch + Math.sin(time * .19) * .065) * formation, (autoYaw + yaw - .10) * formation, .018 * Math.sin(time * .15) * formation);
                    const spatialScale = lerp(narrow ? .88 : 1, 1, 1 - formation);
                    world.scale.setScalar(spatialScale);
                    if (lastSelection !== latest.current.selected) {
                        lastSelection = latest.current.selected;
                        highlighted.clear();
                        const id = `author:${encodeURIComponent(lastSelection)}`;
                        highlighted.add(id);
                        for (let k = 0; k < 3; k++)
                            for (const e of graph.edges) {
                                if (e.kind === 'authored-at' && e.source === id)
                                    highlighted.add(e.target);
                                if (e.kind !== 'authored-at' && highlighted.has(e.target))
                                    highlighted.add(e.source);
                            }
                    }
                    const arrival = projectedNetwork(p, narrow), rect = narrow ? { x: 20, y: 915, w: 660, h: 470 } : { x: 744, y: 145, w: 636, h: 600 };
                    const span = 2 * Math.tan(T.MathUtils.degToRad(47 / 2)) * 820, aspect = width / height;
                    nodes.forEach(n => {
                        const target = destination.get(n.id)!, a = nodeAuthor(n.id), featured = a && arrivingAuthors.includes(a.id), growth = featured ? part(p, .53, .562) : part(p, n.entry, n.entry + .085);
                        const pos = target.clone();
                        if (featured && formation < 1) {
                            const from = arrival.find(v => v.id === n.id)!;
                            const initial = V(((from.x - rect.x) / rect.w - .5) * span * aspect, (.5 - (from.y - rect.y) / rect.h) * span, 0);
                            pos.lerpVectors(initial, target, formation);
                        }
                        positions.set(n.id, pos);
                        n.mesh.position.copy(pos);
                        n.mesh.visible = growth > .002 && !(featured && raw >= 40.46);
                        const selected = a?.id === lastSelection, hovered = a?.id === hover;
                        const radius = featured && narrow ? lerp(26, n.radius, formation) : n.radius;
                        n.mesh.scale.setScalar(radius * (featured ? 1 : lerp(.12, 1, growth)) * (selected || hovered ? 1.12 : 1));
                        const palette = networkPalette[selected || hovered ? 'selected' : n.kind as keyof typeof networkPalette];
                        n.mesh.material.uniforms.alpha.value = growth;
                        n.mesh.material.uniforms.base.value.set(palette[0]);
                        n.mesh.material.uniforms.shade.value.set(palette[1]);
                        n.mesh.material.uniforms.light.value.set(palette[2]);
                        n.outline.visible = n.mesh.visible && growth > .12;
                        n.outline.position.copy(pos);
                        n.outline.scale.setScalar(n.mesh.scale.x + .52);
                    });
                    const byId = new Map(nodes.map(n => [n.id, n]));
                    edges.forEach(e => {
                        const a = positions.get(e.source)!, b = positions.get(e.target)!, entry = Math.max(byId.get(e.source)!.entry, byId.get(e.target)!.entry), growth = part(p, entry - .015, entry + .085), related = highlighted.has(e.source) && highlighted.has(e.target);
                        e.mesh.visible = growth > .001;
                        e.mesh.position.lerpVectors(a, b, .5);
                        direction.subVectors(b, a);
                        e.mesh.quaternion.setFromUnitVectors(up, direction.clone().normalize());
                        e.mesh.scale.set(related ? .72 : .45, direction.length() * growth, related ? .72 : .45);
                        e.mesh.material.opacity = (related ? .75 : .52) * growth;
                        e.mesh.material.color.set(related ? '#7293b7' : '#a9bacb');
                        e.bead.visible = related && growth > .95 && !reduced.matches;
                        e.bead.position.lerpVectors(a, b, (time * .14 + e.index * .127 + p * .45) % 1);
                    });
                    // Labels have depth, receive the same cel lighting, and participate in depth testing.
                    // Keep their reading direction near the camera while their anchors orbit in world space.
                    const faceCamera = world.quaternion.clone().invert().multiply(camera.quaternion);
                    lettering.forEach(({ id, mesh, index }) => {
                        mesh.position.copy(positions.get(id)!).add(V(0, -35, 6));
                        mesh.quaternion.copy(faceCamera).multiply(new T.Quaternion().setFromEuler(new T.Euler(-.10, .18, (index % 2 ? 1 : -1) * .018)));
                        const grow = part(p, .775 + index * .012, .84 + index * .012);
                        mesh.visible = grow > .001;
                        mesh.scale.setScalar(lerp(.9, 1, grow));
                        mesh.material.uniforms.alpha.value = grow;
                    });
                    world.updateMatrixWorld(true);
                    camera.updateMatrixWorld();
                    nodes.forEach(n => {
                        const label = labels.get(n.id);
                        if (!label)
                            return;
                        screen.copy(n.mesh.position);
                        world.localToWorld(screen);
                        const depth = screen.z;
                        screen.project(camera);
                        const x = (screen.x * .5 + .5) * width, y = (-screen.y * .5 + .5) * height, author = nodeAuthor(n.id), featured = author && arrivingAuthors.includes(author.id), selected = author?.id === lastSelection, over = author?.id === hover;
                        const show = n.mesh.visible && (featured ? p > .53 : p > n.entry + .025);
                        label.style.visibility = show ? 'visible' : 'hidden';
                        label.style.opacity = String(featured ? part(p, .53, .562) : part(p, n.entry + .025, n.entry + .09));
                        label.style.left = `${x}px`;
                        label.style.top = `${y}px`;
                        label.style.zIndex = String(Math.round(depth + 500));
                        label.dataset.selected = String(selected);
                        label.dataset.over = String(over);
                        label.dataset.featured = String(featured ?? false);
                        label.style.setProperty('--depth', String(820 / (820 - depth)));
                        label.style.setProperty('--sphere-diameter', `${(n.mesh.scale.x * spatialScale * 2 * height / span) * 820 / (820 - depth)}px`);
                        label.tabIndex = show && p > .88 && author ? 0 : -1;
                        label.style.pointerEvents = p > .88 && author ? 'auto' : 'none';
                    });
                    renderer.render(scene, camera);
                    el.dataset.rotation = world.rotation.y.toFixed(4);
                    el.dataset.frame = String(Number(el.dataset.frame ?? 0) + 1);
                    el.dataset.depthRange = `${Math.min(...nodes.map(n => n.mesh.getWorldPosition(V()).z)).toFixed(1)},${Math.max(...nodes.map(n => n.mesh.getWorldPosition(V()).z)).toFixed(1)}`;
                }
            }
            frame = requestAnimationFrame(tick);
        }
        frame = requestAnimationFrame(tick);
        return () => { cancelAnimationFrame(frame); resize.disconnect(); dispose(); el.removeEventListener('pointerover', enter); el.removeEventListener('pointerleave', leave); el.removeEventListener('pointerdown', start); el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', end); el.removeEventListener('pointercancel', leave); };
    }, [transition, retry]);
    return <div className="author-network-3d" ref={host} aria-label="可旋转的三维博主网络">
  <canvas aria-hidden="true"/>
  <div className="network-space-labels">{graph.nodes.map(n => {
            const a = nodeAuthor(n.id);
            return a ? <button key={n.id} className="space-author" data-space-id={n.id} data-author-id={a.id} aria-label={`查看${a.name}的学习足迹`} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(a.id);
            } }}>
   <span className="space-portrait"><CardAvatar name={a.name} src={a.evidence[0]?.avatar ?? undefined}/></span>
  </button> : null;
        })}</div>
  {failure && <div className="network-failure">{failure}<button onClick={() => { setFailure(''); setRetry(n => n + 1); }}>重新加载</button></div>}
 </div>;
}
