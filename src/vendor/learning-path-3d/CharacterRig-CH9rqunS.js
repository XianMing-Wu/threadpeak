import { A as e, C as t, E as n, L as r, S as i, T as a, U as o, _ as s, a as c, b as l, c as u, j as d, m as f, n as p, o as m, s as h, u as g, w as _, x as v, z as y } from "./three-runtime-DPnU7la1.js";
//#region src/render/objects/CharacterRig.ts
var b = 2.8, x = .8, S = 1 / 30, C = .4, w = .4, T = "Armature|run_fast_3_inplace|baselayer", E = "Armature|Idle_11|baselayer", ee = "rigify_clip", te = "rigify_clip", D = Object.freeze([
	"Hips",
	"Spine02",
	"Spine01",
	"Spine",
	"neck",
	"Head",
	"LeftShoulder",
	"RightShoulder",
	"LeftArm",
	"RightArm"
]), O = new Set(D), k = 90, A = 110, j = 66, M = 137, N = 30, P = 5, F = 10, ne = P, I = .2 / P, L = .12 / P, R = .18 / F, z = .3 / F, B = .2 / F, V = .28 / F, H = .12 / P, U = .28 / F, W = .85 * F, G = 1.6 * F, K = .1, q = 1 / 240, J = Math.PI / 2, Y = .035, X = .13, re = .05, Z = .006, Q = i.degToRad(48), ie = i.degToRad(24), ae = i.degToRad(20), oe = i.degToRad(26), se = i.degToRad(22), $ = Object.freeze([
	{
		time: 0,
		value: 0
	},
	{
		time: 12 / 70,
		value: .248
	},
	{
		time: 18 / 70,
		value: .541
	},
	{
		time: 24 / 70,
		value: .787
	},
	{
		time: 30 / 70,
		value: .92
	},
	{
		time: 36 / 70,
		value: .987
	},
	{
		time: 42 / 70,
		value: 1.039
	},
	{
		time: 48 / 70,
		value: 1.065
	},
	{
		time: 60 / 70,
		value: 1.02
	},
	{
		time: 1,
		value: 1
	}
]), ce = (e, t, n, r = K) => {
	let i = Number.isFinite(e) ? Math.max(0, e) : 0, a = Number.isFinite(t) ? Math.max(Math.abs(t), 1e-6) : 1e-6, o = Number.isFinite(n) ? Math.max(0, n) : 0, s = Number.isFinite(r) ? Math.max(0, r) : 0, c = i / a;
	return {
		expectedPlaybackSeconds: c,
		blendSeconds: o,
		marginSeconds: s,
		deadlineSeconds: c + o + s
	};
}, le = class {
	root = new s();
	modelLoaded = !1;
	surfaceTilt = new s();
	poseRoot = new s();
	contactShadow = new t(new g(.7, 48), new _({
		color: "#8d918d",
		transparent: !0,
		opacity: .1,
		depthWrite: !1
	}));
	mixer = null;
	idleAction = null;
	runAction = null;
	runStopAction = null;
	turnAction = null;
	currentAction = null;
	actionBlend = null;
	runClipDuration = x;
	idleClipDuration = 0;
	runStopClipDuration = 0;
	turnClipDuration = 0;
	runClipName = null;
	idleClipName = null;
	runStopClipName = null;
	turnClipName = null;
	loadedModel = null;
	leftFoot = null;
	rightFoot = null;
	upperBodyRoot = null;
	upperBodyCompensationApplied = !1;
	upperBodyCompensationRadians = 0;
	upperBodyCompensation = new d();
	upperBodyCompensationInverse = new d();
	surfaceWorldQuaternion = new d();
	upperBodyParentWorldInverse = new d();
	upperBodyCompensationAxis = new o();
	animationPhase = "loading";
	transitionToken = 0;
	surfaceY = 0;
	surfacePitchRadians = 0;
	groundClearance = 0;
	running = !1;
	reducedMotion = !1;
	desiredQuaternion = new d();
	viewQuaternion = new d();
	turnStartYaw = 0;
	turnYawDelta = 0;
	turnReversed = !1;
	turnElapsed = 0;
	turnPlaybackDuration = 0;
	animationWatchdog = null;
	animationWatchdogTimeoutCount = 0;
	animationWatchdogRecoveryCount = 0;
	ignoredFinishedEventCount = 0;
	lastAnimationRecoveryReason = null;
	lastAnimationRecoveryPhase = null;
	lastAnimationRecoveryTransitionToken = null;
	suppressedFinishedEvents = /* @__PURE__ */ new Set();
	yawAxis = new o(0, 1, 0);
	maxAnisotropy;
	createLoader;
	loadGeneration = 0;
	disposed = !1;
	handleMixerFinished = (e) => {
		if (this.running || this.reducedMotion) return;
		let t = this.animationWatchdog;
		if (!t || e.action !== t.action || this.animationPhase !== t.phase || this.transitionToken !== t.transitionToken) {
			this.ignoredFinishedEventCount += 1;
			return;
		}
		if (t.elapsedSeconds + q < t.expectedPlaybackSeconds) {
			this.ignoredFinishedEventCount += 1;
			return;
		}
		if (!this.suppressedFinishedEvents.delete(t.phase)) {
			if (t.phase === "stopping") {
				this.transitionToRest();
				return;
			}
			t.phase === "turning" && this.finishTurn();
		}
	};
	constructor(e = 4, t = () => new p()) {
		this.maxAnisotropy = Math.max(1, Math.min(e, 8)), this.createLoader = t, this.root.name = "liu-kanshan-character-root", this.surfaceTilt.name = "liu-kanshan-surface-tilt", this.poseRoot.name = "liu-kanshan-pose-root", this.contactShadow.name = "liu-kanshan-contact-shadow", this.contactShadow.rotation.x = -Math.PI / 2, this.contactShadow.position.set(0, Z, 0), this.contactShadow.scale.set(1.2, .55, 1), this.contactShadow.renderOrder = -1, this.root.add(this.surfaceTilt), this.surfaceTilt.add(this.contactShadow, this.poseRoot);
	}
	async load(e, t = {}) {
		if (this.disposed) throw new DOMException("CharacterRig has been disposed.", "AbortError");
		if (this.modelLoaded || this.loadedModel) throw Error("CharacterRig assets are already loaded.");
		let n = ++this.loadGeneration, r = () => !this.disposed && n === this.loadGeneration, i = () => {
			if (!r()) throw new DOMException("Character asset load was superseded or disposed.", "AbortError");
		}, a = this.createLoader(), o = [
			0,
			0,
			0,
			0
		], s = [
			!1,
			!1,
			!1,
			!1
		], c = () => {
			r() && (s.every(Boolean) ? t.onProgress?.(o.reduce((e, t) => e + t, 0) / o.length) : t.onProgress?.(null));
		}, u = async (e, t) => {
			try {
				return await a.loadAsync(e, (e) => {
					e.lengthComputable && e.total > 0 && (o[t] = e.loaded / e.total, s[t] = !0), c();
				});
			} finally {
				o[t] = 1, s[t] = !0, c();
			}
		}, d = async (e, t) => {
			try {
				return {
					gltf: await u(e, t),
					error: null
				};
			} catch (e) {
				return {
					gltf: null,
					error: e instanceof Error ? e : Error(String(e))
				};
			}
		}, [f, p, h, g] = await Promise.all([
			d(e.run, 0),
			d(e.idle, 1),
			d(e.runStop, 2),
			d(e.turn, 3)
		]), _ = [], y = f.gltf, b = y?.scene ?? null;
		try {
			if (i(), !y || !b) throw f.error ?? /* @__PURE__ */ Error("刘看山跑步模型加载失败。");
			this.configureModel(b);
			let e = this.requireClip(y, T);
			this.assertClipTargets(e, b);
			let t = this.createSeamlessRunClip(e), n = null, r, a = null;
			if (p.gltf) try {
				n = this.requireClip(p.gltf, E), this.assertClipTargets(n, b), r = this.createSeamlessIdleClip(n), a = this.getAnimationReferencePose(n, this.getClipTimeRange(n).start);
			} catch (e) {
				_.push(`待机动画不可用，已启用稳定姿势降级：${this.describeError(e)}`), n = null, r = this.createStaticPoseClip(t, t.duration * C);
			}
			else _.push(`待机动画加载失败，已启用稳定姿势降级：${this.describeError(p.error)}`), r = this.createStaticPoseClip(t, t.duration * C);
			a ||= this.getAnimationReferencePose(t, t.duration * C);
			let o = null, s = null;
			if (h.gltf) try {
				o = this.requireClip(h.gltf, ee), this.assertClipTargets(o, b), s = this.createInPlaceRunStopClip(o, a);
			} catch (e) {
				_.push(`跑停动画不可用，将直接柔和衔接待机：${this.describeError(e)}`), o = null;
			}
			else _.push(`跑停动画加载失败，将直接柔和衔接待机：${this.describeError(h.error)}`);
			let c = null, u = null;
			if (g.gltf) try {
				c = this.requireClip(g.gltf, te), this.assertClipTargets(c, b), u = this.createInPlaceTurnClip(c, a);
			} catch (e) {
				_.push(`转身动画不可用，将使用柔和朝向降级：${this.describeError(e)}`), c = null;
			}
			else _.push(`转身动画加载失败，将使用柔和朝向降级：${this.describeError(g.error)}`);
			return i(), this.poseRoot.add(b), this.loadedModel = b, this.leftFoot = b.getObjectByName("LeftFoot") ?? null, this.rightFoot = b.getObjectByName("RightFoot") ?? null, this.upperBodyRoot = b.getObjectByName("Spine02") ?? null, this.normalizeModel(b), this.mixer = new m(b), this.mixer.addEventListener("finished", this.handleMixerFinished), this.idleAction = this.mixer.clipAction(r), this.idleAction.setLoop(v, Infinity), this.idleAction.clampWhenFinished = !1, this.runAction = this.mixer.clipAction(t), this.runAction.setLoop(v, Infinity), this.runAction.clampWhenFinished = !1, s && (this.runStopAction = this.mixer.clipAction(s), this.runStopAction.setLoop(l, 1), this.runStopAction.clampWhenFinished = !0), u && (this.turnAction = this.mixer.clipAction(u), this.turnAction.setLoop(l, 1), this.turnAction.clampWhenFinished = !0), this.runClipName = e.name, this.runClipDuration = t.duration, this.idleClipName = n?.name ?? r.name, this.idleClipDuration = r.duration, this.runStopClipName = o?.name ?? null, this.runStopClipDuration = s?.duration ?? 0, this.turnClipName = c?.name ?? null, this.turnClipDuration = u?.duration ?? 0, this.modelLoaded = !0, this.reducedMotion ? this.enterReducedMotionPose() : this.running ? this.transitionToRun(0) : this.transitionToIdle(0), this.mixer.update(0), this.alignAnimatedPose(b), {
				runClipName: e.name,
				runClipDuration: t.duration,
				runStopClipName: o?.name ?? null,
				runStopClipDuration: s?.duration ?? 0,
				idleClipName: n?.name ?? r.name,
				idleClipDuration: r.duration,
				turnClipName: c?.name ?? null,
				turnClipDuration: u?.duration ?? 0,
				warnings: _
			};
		} catch (e) {
			throw r() && (this.mixer?.removeEventListener("finished", this.handleMixerFinished), this.mixer?.stopAllAction()), b && (this.poseRoot.remove(b), this.disposeObjectResources(b)), r() && (this.loadedModel = null, this.leftFoot = null, this.rightFoot = null, this.mixer = null, this.idleAction = null, this.runAction = null, this.runStopAction = null, this.turnAction = null, this.currentAction = null, this.actionBlend = null, this.animationWatchdog = null, this.modelLoaded = !1, this.animationPhase = "loading"), e;
		} finally {
			p.gltf && (this.disposeObjectResources(p.gltf.scene), p.gltf.scene.clear()), h.gltf && (this.disposeObjectResources(h.gltf.scene), h.gltf.scene.clear()), g.gltf && (this.disposeObjectResources(g.gltf.scene), g.gltf.scene.clear());
		}
	}
	setReducedMotion(e) {
		this.reducedMotion !== e && (this.reducedMotion = e, this.modelLoaded && (e ? this.enterReducedMotionPose() : this.running ? this.transitionToRun(I) : this.animationPhase === "reduced" && this.idleAction ? (this.idleAction.paused = !1, this.idleAction.play(), this.currentAction = this.idleAction, this.setAnimationPhase("idle")) : this.transitionToIdle(I)));
	}
	dispose() {
		this.disposed || (this.disposed = !0, this.loadGeneration += 1, this.mixer?.removeEventListener("finished", this.handleMixerFinished), this.mixer?.stopAllAction(), this.mixer && this.loadedModel && this.mixer.uncacheRoot(this.loadedModel), this.loadedModel && this.disposeObjectResources(this.loadedModel), this.contactShadow.geometry.dispose(), this.contactShadow.material.dispose(), this.poseRoot.clear(), this.loadedModel = null, this.leftFoot = null, this.rightFoot = null, this.upperBodyRoot = null, this.upperBodyCompensationApplied = !1, this.upperBodyCompensationRadians = 0, this.upperBodyCompensation.identity(), this.idleAction = null, this.runAction = null, this.runStopAction = null, this.turnAction = null, this.currentAction = null, this.actionBlend = null, this.animationWatchdog = null, this.suppressedFinishedEvents.clear(), this.turnElapsed = 0, this.turnPlaybackDuration = 0, this.turnReversed = !1, this.mixer = null, this.modelLoaded = !1, this.animationPhase = "loading");
	}
	setRunning(e) {
		if (this.running !== e && (this.running = e, !(!this.modelLoaded || this.reducedMotion))) {
			if (e) {
				let e = this.animationPhase === "stopping" ? L : this.animationPhase === "turning" ? H : I;
				this.transitionToRun(e);
			} else this.transitionToStop();
		}
	}
	setPosition(e, t, n) {
		this.surfaceY = n, this.root.position.x = e, this.root.position.z = t, this.applyGroundSupport();
	}
	setSurfacePitch(e, t, n = Q) {
		let r = Number.isFinite(e) ? e : 0, a = Number.isFinite(n) ? i.clamp(Math.abs(n), 0, Q) : Q, o = i.clamp(r, -a, a), s = this.reducedMotion ? 1 : 1 - Math.exp(-Math.max(0, t) * 14);
		this.surfacePitchRadians = i.lerp(this.surfacePitchRadians, o, s), this.surfaceTilt.rotation.x = -this.surfacePitchRadians;
	}
	getAnimationPhase() {
		return this.animationPhase;
	}
	isVisuallyIdle() {
		return this.animationPhase === "reduced" || this.animationPhase === "idle" && this.actionBlend === null;
	}
	debugSuppressNextFinishedEvent(e) {
		this.suppressedFinishedEvents.add(e);
	}
	debugRecoverStalledAnimation(e = "manual-dev-test-recovery") {
		return this.recoverStalledAnimation(e, !1);
	}
	getDebugState() {
		let e = this.animationWatchdog;
		return {
			clipName: this.runClipName,
			clipDuration: this.runClipDuration,
			mixerTime: this.mixer?.time ?? 0,
			running: this.running,
			reducedMotion: this.reducedMotion,
			phase: this.animationPhase,
			visuallyIdle: this.isVisuallyIdle(),
			activeClip: this.currentAction?.getClip().name ?? null,
			transitionToken: this.transitionToken,
			clips: {
				idle: this.idleClipName,
				run: this.runClipName,
				runStop: this.runStopClipName,
				turn: this.turnClipName,
				idleDuration: this.idleClipDuration,
				runDuration: this.runClipDuration,
				runStopDuration: this.runStopClipDuration,
				turnDuration: this.turnClipDuration
			},
			actions: {
				idle: this.getActionDebugState(this.idleAction),
				run: this.getActionDebugState(this.runAction),
				runStop: this.getActionDebugState(this.runStopAction),
				turn: this.getActionDebugState(this.turnAction)
			},
			feet: {
				leftWorld: this.getObjectWorldPosition(this.leftFoot),
				rightWorld: this.getObjectWorldPosition(this.rightFoot)
			},
			groundSupport: {
				surfaceY: this.surfaceY,
				clearance: this.groundClearance,
				rootY: this.root.position.y
			},
			orientation: {
				rootYawDegrees: Number(i.radToDeg(this.getYaw(this.root.quaternion)).toFixed(2)),
				viewYawDegrees: Number(i.radToDeg(this.getYaw(this.viewQuaternion)).toFixed(2)),
				surfacePitchDegrees: Number(i.radToDeg(this.surfacePitchRadians).toFixed(2)),
				torsoCompensationDegrees: Number(i.radToDeg(this.upperBodyCompensationRadians).toFixed(2)),
				visibleTorsoPitchDegrees: Number(i.radToDeg(this.surfacePitchRadians - this.upperBodyCompensationRadians).toFixed(2)),
				turnProgress: Number(this.getTurnProgress().toFixed(4)),
				turnDirection: this.animationPhase === "turning" ? this.turnReversed ? "left" : "right" : null
			},
			watchdog: {
				activePhase: e?.phase ?? null,
				elapsedSeconds: Number((e?.elapsedSeconds ?? 0).toFixed(4)),
				expectedPlaybackSeconds: Number((e?.expectedPlaybackSeconds ?? 0).toFixed(4)),
				blendSeconds: Number((e?.blendSeconds ?? 0).toFixed(4)),
				marginSeconds: Number((e?.marginSeconds ?? 0).toFixed(4)),
				deadlineSeconds: Number((e?.deadlineSeconds ?? 0).toFixed(4)),
				remainingSeconds: Number(Math.max(0, (e?.deadlineSeconds ?? 0) - (e?.elapsedSeconds ?? 0)).toFixed(4)),
				transitionToken: e?.transitionToken ?? null,
				timeoutCount: this.animationWatchdogTimeoutCount,
				recoveryCount: this.animationWatchdogRecoveryCount,
				ignoredFinishedEventCount: this.ignoredFinishedEventCount,
				lastRecoveryReason: this.lastAnimationRecoveryReason,
				lastRecoveryPhase: this.lastAnimationRecoveryPhase,
				lastRecoveryTransitionToken: this.lastAnimationRecoveryTransitionToken,
				suppressNextFinished: {
					stopping: this.suppressedFinishedEvents.has("stopping"),
					turning: this.suppressedFinishedEvents.has("turning")
				}
			}
		};
	}
	setFacing(e, t, n) {
		let r = Math.atan2(e, t);
		if (this.desiredQuaternion.setFromAxisAngle(this.yawAxis, r), this.animationPhase !== "running" && this.animationPhase !== "stopping") return;
		let i = this.reducedMotion ? 1 : 1 - Math.exp(-n * 11);
		this.root.quaternion.slerp(this.desiredQuaternion, i);
	}
	setViewFacing(e, t, n) {
		let r = Math.atan2(e, t);
		if (this.viewQuaternion.setFromAxisAngle(this.yawAxis, r), this.animationPhase !== "idle" && this.animationPhase !== "reduced" && this.animationPhase !== "loading") return;
		let i = this.reducedMotion ? 1 : 1 - Math.exp(-n * 9);
		this.root.quaternion.slerp(this.viewQuaternion, i);
	}
	update(e, t) {
		this.removeUpperBodySlopeCompensation(), this.updateActionBlend(e), this.applyGroundSupport(), this.advanceAnimationWatchdog(e), this.mixer && !this.reducedMotion && this.mixer.update(e), this.updateTurnOrientation(e), this.recoverExpiredAnimationWatchdog(), this.poseRoot.position.set(0, 0, 0), this.poseRoot.scale.set(1, 1, 1), this.applyUpperBodySlopeCompensation();
	}
	configureModel(e) {
		e.name = "liu-kanshan-model", e.traverse((e) => {
			(e instanceof t || e instanceof r) && (e.castShadow = !1, e.receiveShadow = !0, e.frustumCulled = !1, (Array.isArray(e.material) ? e.material : [e.material]).forEach((e) => {
				e instanceof n && (e.roughness = .42, e.metalness = 0, e.emissiveIntensity = .025, [e.map, e.emissiveMap].forEach((e) => {
					e && (e.anisotropy = this.maxAnisotropy, e.needsUpdate = !0);
				})), e instanceof a && (e.specularIntensity = .82, e.specularColor.set("#ffffff"));
			}));
		});
	}
	normalizeModel(e) {
		e.updateMatrixWorld(!0);
		let t = new u().setFromObject(e), n = t.getSize(new o()), r = t.getCenter(new o());
		if (!Number.isFinite(n.y) || n.y <= 0) throw Error("刘看山模型尺寸无效。 ");
		let i = b / n.y;
		e.scale.multiplyScalar(i), e.position.set(-r.x * i, -t.min.y * i, -r.z * i), e.updateMatrixWorld(!0);
	}
	alignAnimatedPose(e) {
		let t = this.root.quaternion.clone(), n = this.poseRoot.position.clone(), r = this.poseRoot.scale.clone();
		this.root.quaternion.identity(), this.poseRoot.position.set(0, 0, 0), this.poseRoot.scale.set(1, 1, 1), this.root.updateMatrixWorld(!0);
		let i = new u().setFromObject(e, !0), a = i.getCenter(new o()), s = this.poseRoot.getWorldPosition(new o());
		i.isEmpty() || (e.position.x += s.x - a.x, e.position.y += s.y - i.min.y, e.position.z += s.z - a.z), this.root.quaternion.copy(t), this.poseRoot.position.copy(n), this.poseRoot.scale.copy(r), this.root.updateMatrixWorld(!0);
	}
	createSeamlessRunClip(e) {
		let t = e.tracks.map((e) => {
			let t = e.clone(), n = t.getValueSize(), r = [];
			for (let e = 0; e < t.times.length; e += 1) {
				let n = (t.times[e] ?? 0) - S;
				n >= -1e-4 && n < .7999 && r.push(e);
			}
			if (r.length === 0) return t;
			let i = new Float32Array(r.length + 1), a = new Float32Array((r.length + 1) * n);
			r.forEach((e, r) => {
				i[r] = Math.max(0, (t.times[e] ?? S) - S);
				for (let i = 0; i < n; i += 1) a[r * n + i] = t.values[e * n + i] ?? 0;
			}), i[i.length - 1] = x;
			for (let e = 0; e < n; e += 1) a[(i.length - 1) * n + e] = a[e] ?? 0;
			return t.times = i, t.values = a, t;
		});
		return new c(`${e.name}-seamless`, x, t);
	}
	createSeamlessIdleClip(e) {
		let t = this.getClipTimeRange(e), n = e.tracks.map((e) => {
			let n = e.clone();
			n.shift(-t.start);
			let r = n.getValueSize(), i = (n.times.length - 1) * r;
			for (let e = 0; e < r; e += 1) n.values[i + e] = n.values[e] ?? 0;
			return n;
		});
		return new c(`${e.name}-seamless`, t.end - t.start, n);
	}
	createStaticPoseClip(e, t) {
		let n = e.tracks.map((e) => {
			let n = e.clone(), r = n.getValueSize(), i = new Float32Array(r), a = n.createInterpolant(i).evaluate(t), o = new Float32Array(r * 2);
			return o.set(a, 0), o.set(a, r), n.times = new Float32Array([0, 1]), n.values = o, n;
		});
		return new c("liu-kanshan-static-idle-fallback", 1, n);
	}
	createInPlaceRunStopClip(t, n) {
		let r = h.subclip(t, "liu-kanshan-run-stop-in-place", k, A, N);
		return r.tracks.forEach((t) => {
			let r = e.parseTrackName(t.name);
			if (r.nodeName === "Hips" && r.propertyName === "position") for (let e = 0; e < t.values.length; e += 3) t.values[e] = n.position.x, t.values[e + 2] = n.position.z;
			if (r.propertyName === "quaternion" && r.nodeName && O.has(r.nodeName)) {
				let e = n.stableBodyQuaternions.get(r.nodeName);
				if (!e) throw Error(`待机参考姿势缺少 ${r.nodeName} 四元数。`);
				for (let n = 0; n < t.values.length; n += 4) e.toArray(t.values, n);
			}
		}), r.resetDuration(), r;
	}
	createInPlaceTurnClip(t, n) {
		let r = h.subclip(t, "liu-kanshan-turn-in-place", j, M, N);
		return r.tracks.forEach((t) => {
			let r = e.parseTrackName(t.name);
			if (r.nodeName === "Hips" && r.propertyName === "position") for (let e = 0; e < t.values.length; e += 3) t.values[e] = n.position.x, t.values[e + 2] = n.position.z;
			if (r.propertyName === "quaternion" && r.nodeName && O.has(r.nodeName)) {
				let e = n.stableBodyQuaternions.get(r.nodeName);
				if (!e) throw Error(`待机参考姿势缺少 ${r.nodeName} 四元数。`);
				for (let n = 0; n < t.values.length; n += 4) e.toArray(t.values, n);
			}
		}), r.resetDuration(), r;
	}
	transitionToRun(e) {
		!this.runAction || this.animationPhase === "running" || (this.turnElapsed = 0, this.turnPlaybackDuration = 0, this.turnReversed = !1, this.activateAction(this.runAction, ne, e, 0), this.setAnimationPhase("running"));
	}
	transitionToStop() {
		if (this.animationPhase === "running") {
			if (!this.runStopAction) {
				this.transitionToRest(U);
				return;
			}
			this.activateAction(this.runStopAction, W, R, 0), this.setAnimationPhase("stopping"), this.beginAnimationWatchdog("stopping", this.runStopAction, this.runStopClipDuration, W, R);
		}
	}
	transitionToRest(e = z) {
		let t = this.root.quaternion.angleTo(this.viewQuaternion);
		if (!this.turnAction || t <= J) {
			this.transitionToIdle(e);
			return;
		}
		this.turnStartYaw = this.getYaw(this.root.quaternion);
		let n = this.getYaw(this.viewQuaternion) - this.turnStartYaw, r = Math.atan2(Math.sin(n), Math.cos(n));
		this.turnYawDelta = r, this.turnReversed = r > 0, this.turnElapsed = 0, this.turnPlaybackDuration = this.turnClipDuration / G, this.activateAction(this.turnAction, this.turnReversed ? -16 : G, B, this.turnReversed ? this.turnClipDuration : 0), this.setAnimationPhase("turning"), this.beginAnimationWatchdog("turning", this.turnAction, this.turnClipDuration, G, B);
	}
	finishTurn() {
		this.root.quaternion.copy(this.viewQuaternion), this.turnElapsed = this.turnPlaybackDuration, this.transitionToIdle(V);
	}
	transitionToIdle(e) {
		!this.idleAction || this.animationPhase === "idle" || (this.activateAction(this.idleAction, 1, e, 0), this.setAnimationPhase("idle"));
	}
	activateAction(e, t, n, r) {
		let i = this.getAnimationActions(), a = i.map((e) => ({
			action: e,
			weight: e.isScheduled() ? e.getEffectiveWeight() : 0
		})), o = a.find((t) => t.action === e)?.weight ?? 0, s = e.isRunning() && o > 1e-4;
		this.actionBlend = null, i.forEach((e) => e.stopFading().stopWarping()), s ? (e.enabled = !0, e.paused = !1) : (e.reset(), e.time = r), e.setEffectiveTimeScale(t), e.play();
		let c = a.reduce((e, t) => e + t.weight, 0), l = a.map((t) => ({
			action: t.action,
			fromWeight: c > 1e-4 ? t.weight / c : +(t.action === e),
			toWeight: +(t.action === e)
		}));
		l.forEach((t) => {
			(t.fromWeight > 0 || t.action === e) && (t.action.enabled = !0, t.action.play()), t.action.setEffectiveWeight(t.fromWeight);
		}), n > 0 ? this.actionBlend = {
			target: e,
			duration: n,
			elapsed: 0,
			entries: l
		} : this.finishActionBlend(e, l), this.currentAction = e;
	}
	enterReducedMotionPose() {
		!this.mixer || !this.idleAction || (this.removeUpperBodySlopeCompensation(), this.actionBlend = null, this.turnElapsed = 0, this.turnPlaybackDuration = 0, this.turnReversed = !1, this.getAnimationActions().forEach((e) => {
			e.setEffectiveWeight(0), e.stop();
		}), this.idleAction.reset(), this.idleAction.enabled = !0, this.idleAction.setEffectiveWeight(1), this.idleAction.setEffectiveTimeScale(1), this.idleAction.play(), this.mixer.setTime(Math.min(w, this.idleClipDuration)), this.idleAction.paused = !0, this.currentAction = this.idleAction, this.root.quaternion.copy(this.viewQuaternion), this.applyUpperBodySlopeCompensation(), this.setAnimationPhase("reduced"));
	}
	setAnimationPhase(e) {
		this.animationWatchdog = null, this.animationPhase = e, this.transitionToken += 1;
	}
	updateActionBlend(e) {
		let t = this.actionBlend;
		if (!t) return;
		t.elapsed = Math.min(t.duration, t.elapsed + Math.max(0, e));
		let n = t.duration > 0 ? t.elapsed / t.duration : 1, r = n * n * (3 - 2 * n);
		t.entries.forEach((e) => {
			e.action.setEffectiveWeight(i.lerp(e.fromWeight, e.toWeight, r));
		}), n >= 1 && (this.actionBlend = null, this.finishActionBlend(t.target, t.entries));
	}
	beginAnimationWatchdog(e, t, n, r, i) {
		let a = ce(n, r, i);
		this.animationWatchdog = {
			phase: e,
			action: t,
			transitionToken: this.transitionToken,
			expectedPlaybackSeconds: a.expectedPlaybackSeconds,
			blendSeconds: a.blendSeconds,
			marginSeconds: a.marginSeconds,
			deadlineSeconds: a.deadlineSeconds,
			elapsedSeconds: 0
		};
	}
	advanceAnimationWatchdog(e) {
		let t = this.animationWatchdog;
		if (t) {
			if (this.animationPhase !== t.phase || this.transitionToken !== t.transitionToken) {
				this.animationWatchdog = null;
				return;
			}
			t.elapsedSeconds = Math.min(t.deadlineSeconds, t.elapsedSeconds + Math.max(0, e));
		}
	}
	recoverExpiredAnimationWatchdog() {
		let e = this.animationWatchdog;
		!e || e.elapsedSeconds < e.deadlineSeconds || this.recoverStalledAnimation(`${e.phase}-finished-timeout`, !0);
	}
	recoverStalledAnimation(e, t) {
		let n = this.animationWatchdog;
		return !n || this.animationPhase !== n.phase || this.transitionToken !== n.transitionToken ? !1 : (this.animationWatchdog = null, this.animationWatchdogRecoveryCount += 1, t && (this.animationWatchdogTimeoutCount += 1), this.lastAnimationRecoveryReason = e, this.lastAnimationRecoveryPhase = n.phase, this.lastAnimationRecoveryTransitionToken = n.transitionToken, this.suppressedFinishedEvents.delete(n.phase), this.actionBlend?.target === n.action && (this.actionBlend = null), n.action.stopFading().stopWarping(), n.action.setEffectiveWeight(0), n.action.stop(), n.phase === "turning" ? (this.root.quaternion.copy(this.viewQuaternion), this.turnElapsed = this.turnPlaybackDuration, this.transitionToIdle(V)) : this.transitionToRest(z), this.applyGroundSupport(), !0);
	}
	updateTurnOrientation(e) {
		if (this.animationPhase !== "turning") return;
		this.turnElapsed = Math.min(this.turnPlaybackDuration, this.turnElapsed + Math.max(0, e));
		let t = this.getTurnProgress(), n = this.turnReversed ? 1 - this.sampleTurnYawProgress(1 - t) : this.sampleTurnYawProgress(t);
		this.root.quaternion.setFromAxisAngle(this.yawAxis, this.turnStartYaw + this.turnYawDelta * n);
	}
	finishActionBlend(e, t) {
		t.forEach((t) => {
			t.action === e ? (t.action.enabled = !0, t.action.setEffectiveWeight(1), t.action.play()) : (t.action.setEffectiveWeight(0), t.action.stop());
		});
	}
	getAnimationActions() {
		let e = [];
		return this.idleAction && e.push(this.idleAction), this.runAction && e.push(this.runAction), this.runStopAction && e.push(this.runStopAction), this.turnAction && e.push(this.turnAction), e;
	}
	applyUpperBodySlopeCompensation() {
		let e = this.upperBodyRoot, t = e?.parent ?? null;
		if (!e || !t) {
			this.upperBodyCompensationRadians = 0;
			return;
		}
		let n = Math.abs(this.surfacePitchRadians), r = i.clamp(n - ie, 0, se), a = i.smoothstep(n, ae, oe), o = Math.sign(this.surfacePitchRadians) * r * a;
		this.upperBodyCompensationRadians = o, !(Math.abs(o) <= 1e-6) && (this.root.updateMatrixWorld(!0), this.surfaceTilt.getWorldQuaternion(this.surfaceWorldQuaternion), this.upperBodyCompensationAxis.set(1, 0, 0).applyQuaternion(this.surfaceWorldQuaternion).normalize(), t.getWorldQuaternion(this.upperBodyParentWorldInverse).invert(), this.upperBodyCompensationAxis.applyQuaternion(this.upperBodyParentWorldInverse).normalize(), this.upperBodyCompensation.setFromAxisAngle(this.upperBodyCompensationAxis, o), e.quaternion.premultiply(this.upperBodyCompensation).normalize(), this.upperBodyCompensationApplied = !0);
	}
	removeUpperBodySlopeCompensation() {
		if (!this.upperBodyCompensationApplied || !this.upperBodyRoot) {
			this.upperBodyCompensationApplied = !1;
			return;
		}
		this.upperBodyCompensationInverse.copy(this.upperBodyCompensation).invert(), this.upperBodyRoot.quaternion.premultiply(this.upperBodyCompensationInverse).normalize(), this.upperBodyCompensationApplied = !1;
	}
	applyGroundSupport() {
		let e = this.runAction?.getEffectiveWeight() ?? 0, t = this.runStopAction?.getEffectiveWeight() ?? 0, n = this.turnAction?.getEffectiveWeight() ?? 0;
		this.groundClearance = e * Y + t * X + n * re, this.root.position.y = this.surfaceY + this.groundClearance, this.contactShadow.position.y = Z - this.groundClearance;
	}
	getTurnProgress() {
		if (this.animationPhase !== "turning" || this.turnPlaybackDuration <= 0) return +(this.animationPhase === "idle" && this.turnElapsed > 0);
		if (this.turnAction?.isScheduled()) {
			let e = i.clamp(this.turnAction.time / Math.max(this.turnClipDuration, 1e-4), 0, 1);
			return this.turnReversed ? 1 - e : e;
		}
		return i.clamp(this.turnElapsed / this.turnPlaybackDuration, 0, 1);
	}
	sampleTurnYawProgress(e) {
		let t = i.clamp(e, 0, 1);
		for (let e = 1; e < $.length; e += 1) {
			let n = $[e - 1], r = $[e];
			if (!n || !r || t > r.time) continue;
			let a = Math.max(1e-4, r.time - n.time), o = (t - n.time) / a;
			return i.lerp(n.value, r.value, o);
		}
		return 1;
	}
	getYaw(e) {
		return new f().setFromQuaternion(e, "YXZ").y;
	}
	getActionDebugState(e) {
		return e ? {
			time: Number(e.time.toFixed(4)),
			weight: Number(e.getEffectiveWeight().toFixed(4))
		} : null;
	}
	getObjectWorldPosition(e) {
		if (!e) return null;
		let t = e.getWorldPosition(new o());
		return [
			t.x,
			t.y,
			t.z
		];
	}
	requireClip(e, t) {
		let n = e.animations.find((e) => e.name === t);
		if (!n) throw Error(`未找到动画 ${t}；实际包含：${e.animations.map((e) => e.name).join("、") || "无"}`);
		return n;
	}
	assertClipTargets(t, n) {
		let r = /* @__PURE__ */ new Set();
		if (t.tracks.forEach((t) => {
			let i = e.parseTrackName(t.name);
			i.nodeName && !n.getObjectByName(i.nodeName) && r.add(i.nodeName);
		}), r.size > 0) throw Error(`动画骨骼不兼容：${[...r].join("、")}`);
	}
	getAnimationReferencePose(t, n) {
		let r = t.tracks.find((t) => {
			let n = e.parseTrackName(t.name);
			return n.nodeName === "Hips" && n.propertyName === "position";
		});
		if (!r) throw Error("动画缺少 Hips 根位置轨道。");
		let i = /* @__PURE__ */ new Float32Array(3), a = r.createInterpolant(i).evaluate(n), s = /* @__PURE__ */ new Map();
		return D.forEach((r) => {
			let i = t.tracks.find((t) => {
				let n = e.parseTrackName(t.name);
				return n.nodeName === r && n.propertyName === "quaternion";
			});
			if (!i) throw Error(`动画缺少 ${r} 四元数轨道。`);
			let a = /* @__PURE__ */ new Float32Array(4), o = i.createInterpolant(a).evaluate(n);
			s.set(r, new d().fromArray(o).normalize());
		}), {
			position: new o().fromArray(a),
			stableBodyQuaternions: s
		};
	}
	getClipTimeRange(e) {
		let t = Infinity, n = -Infinity;
		if (e.tracks.forEach((e) => {
			t = Math.min(t, e.times[0] ?? t), n = Math.max(n, e.times[e.times.length - 1] ?? n);
		}), !Number.isFinite(t) || !Number.isFinite(n) || n <= t) throw Error(`动画 ${e.name} 的时间轴无效。`);
		return {
			start: t,
			end: n
		};
	}
	disposeObjectResources(e) {
		let n = /* @__PURE__ */ new Set(), i = /* @__PURE__ */ new Set(), a = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set();
		e.traverse((e) => {
			e instanceof t && (n.add(e.geometry), (Array.isArray(e.material) ? e.material : [e.material]).forEach((e) => {
				i.add(e), Object.values(e).forEach((e) => {
					e instanceof y && a.add(e);
				});
			})), e instanceof r && o.add(e.skeleton);
		}), a.forEach((e) => e.dispose()), i.forEach((e) => e.dispose()), n.forEach((e) => e.dispose()), o.forEach((e) => e.dispose());
	}
	describeError(e) {
		return e instanceof Error ? e.message : String(e ?? "未知错误");
	}
};
//#endregion
export { le as t };

//# sourceMappingURL=CharacterRig-CH9rqunS.js.map