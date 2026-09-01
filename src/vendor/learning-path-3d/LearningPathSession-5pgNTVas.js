import { a as e, n as t, o as n, s as r, t as i } from "./overpassSpec-CjJGXqVE.js";
import { B as a, C as o, D as s, E as c, F as l, H as u, I as d, M as f, N as p, O as m, P as h, R as g, S as _, T as v, U as y, V as b, _ as x, d as S, f as C, g as w, h as T, i as E, k as D, l as O, p as k, r as A, t as j, u as M, v as N, w as P, y as F, z as ee } from "./three-runtime-CHDI8JSc.js";
import { t as te } from "./CharacterRig-BpJUYaY6.js";
//#region src/runtime/gateway/LearningPathSceneRuntimePort.ts
var I = class {
	handlers;
	listeners = /* @__PURE__ */ new Set();
	disposed = !1;
	constructor(e) {
		this.handlers = e;
	}
	subscribe(e) {
		this.assertLive(), this.listeners.add(e);
		let t = !0;
		return () => {
			t && (t = !1, this.listeners.delete(e));
		};
	}
	dispatch(e) {
		switch (this.assertLive(), e.type) {
			case "PRESENTATION.EXECUTE": return this.handlers.executePresentation(e, this.publish);
			case "PRESENTATION.CANCEL_TRANSACTION": return this.handlers.cancelPresentationTransaction(e, this.publish);
			case "MOTION.EXECUTE": return this.handlers.executeMotion(e, this.publish);
			case "MOTION.ABORT": return this.handlers.abortMotion(e, this.publish);
			case "CHARACTER.FORCE_SETTLE": return this.handlers.forceSettleCharacter(e, this.publish);
		}
	}
	publish = (e) => {
		this.disposed || this.listeners.forEach((t) => t(e));
	};
	dispose() {
		this.disposed || (this.disposed = !0, this.listeners.clear(), this.handlers.dispose?.());
	}
	get isDisposed() {
		return this.disposed;
	}
	assertLive() {
		if (this.disposed) throw Error("LearningPathSceneRuntimePort is disposed.");
	}
}, ne = {
	none: 0,
	"first-short-road": 1,
	arch: 2,
	"second-short-road": 3
}, L = class {
	platforms = /* @__PURE__ */ new Map();
	longRoads = /* @__PURE__ */ new Map();
	overpasses = /* @__PURE__ */ new Map();
	character;
	constructor(e) {
		e.nodes.forEach((e) => {
			this.platforms.set(e.id, this.createPresence(e.initiallyVisible));
		}), e.edges.forEach((e) => {
			e.pathKind === "straight" ? this.longRoads.set(e.id, this.createPresence(e.initiallyVisible)) : this.registerOverpass(e);
		}), this.character = {
			state: e.initialCharacterPhase,
			context: {
				observedPhase: e.initialCharacterPhase,
				visuallyIdle: e.initiallyCharacterVisuallyIdle,
				sequence: 0,
				error: null
			}
		};
	}
	registerOverpass(e) {
		this.overpasses.has(e.id) || this.overpasses.set(e.id, {
			state: e.initiallyVisible ? "ready" : "absent",
			desiredVisible: e.initiallyVisible,
			occupied: !1,
			activeCommandId: null,
			internalPhase: "none"
		});
	}
	acceptPresentationCommand(e) {
		if (e.objectKind === "overpass") {
			let t = this.requireOverpass(e.objectId);
			t.desiredVisible = e.visible, t.activeCommandId = e.commandId, t.internalPhase = "none", e.visible ? (t.state === "absent" || t.state === "retiring") && (t.state = "assembling") : (t.state === "assembling" || t.state === "ready") && (t.state = "retiring");
			return;
		}
		let t = this.requirePresence(e.objectKind, e.objectId);
		t.desiredVisible = e.visible, t.activeCommandId = e.commandId, e.visible ? (t.state === "hidden" || t.state === "rising") && (t.state = "dropping") : (t.state === "visible" || t.state === "dropping") && (t.state = "rising");
	}
	getDesiredVisibility(e, t) {
		return e === "overpass" ? this.overpasses.get(t)?.desiredVisible : (e === "platform" ? this.platforms.get(t) : this.longRoads.get(t))?.desiredVisible;
	}
	reconcileStableVisibility(e, t, n) {
		if (e === "overpass") {
			let e = this.requireOverpass(t);
			e.desiredVisible = n, e.occupied = !1, e.activeCommandId = null, e.internalPhase = "none", e.state = n ? "ready" : "absent";
			return;
		}
		let r = this.requirePresence(e, t);
		r.desiredVisible = n, r.activeCommandId = null, r.state = n ? "visible" : "hidden";
	}
	acceptPresentationEvent(e) {
		if (e.type === "PRESENTATION.STARTED" || e.type === "PRESENTATION.FAILED") return;
		if (e.type === "PRESENTATION.PHASE") {
			let t = this.overpasses.get(e.objectId);
			if (!t || t.activeCommandId !== e.commandId || t.state !== "assembling" && t.state !== "retiring") return;
			let n = ne[t.internalPhase], r = ne[e.phase];
			e.phase !== "none" && (r === n || r === n + 1) && (t.internalPhase = e.phase);
			return;
		}
		if (e.objectKind === "overpass") {
			let t = this.overpasses.get(e.objectId);
			if (!t || t.activeCommandId !== e.commandId) return;
			if (e.terminal === "visible" && t.desiredVisible) t.state = t.occupied ? "occupied" : "ready";
			else if (e.terminal === "hidden" && !t.desiredVisible) t.state = "absent";
			else return;
			t.activeCommandId = null, t.internalPhase = "none";
			return;
		}
		let t = this.requirePresence(e.objectKind, e.objectId);
		if (t.activeCommandId === e.commandId) {
			if (e.terminal === "visible" && t.desiredVisible) t.state = "visible";
			else if (e.terminal === "hidden" && !t.desiredVisible) t.state = "hidden";
			else return;
			t.activeCommandId = null;
		}
	}
	setOccupiedOverpass(e) {
		this.overpasses.forEach((t, n) => {
			let r = n === e;
			t.occupied !== r && (t.occupied = r, r && t.state === "ready" ? t.state = "occupied" : !r && t.state === "occupied" && (t.state = t.desiredVisible ? "ready" : "retiring"));
		});
	}
	acceptCharacterEvent(e) {
		if (!(e.sequence <= this.character.context.sequence)) {
			if (e.type === "CHARACTER.PHASE") {
				this.character = {
					state: e.phase,
					context: {
						observedPhase: e.phase,
						visuallyIdle: (e.phase === "idle" || e.phase === "reduced") && e.visuallyIdle,
						sequence: e.sequence,
						error: null
					}
				};
				return;
			}
			if (e.type === "CHARACTER.FAILED") {
				this.character = {
					state: "failed",
					context: {
						observedPhase: "failed",
						visuallyIdle: !1,
						sequence: e.sequence,
						error: e.error
					}
				};
				return;
			}
			this.character = {
				state: "disposed",
				context: {
					observedPhase: "disposed",
					visuallyIdle: !1,
					sequence: e.sequence,
					error: null
				}
			};
		}
	}
	snapshot() {
		return Object.freeze({
			platforms: Object.freeze(Object.fromEntries([...this.platforms.entries()].map(([e, t]) => [e, t.state]))),
			longRoads: Object.freeze(Object.fromEntries([...this.longRoads.entries()].map(([e, t]) => [e, t.state]))),
			overpasses: Object.freeze(Object.fromEntries([...this.overpasses.entries()].map(([e, t]) => [e, Object.freeze({
				state: t.state,
				internalPhase: t.internalPhase
			})]))),
			character: Object.freeze({
				state: this.character.state,
				context: Object.freeze({ ...this.character.context })
			})
		});
	}
	createPresence(e) {
		return {
			state: e ? "visible" : "hidden",
			desiredVisible: e,
			activeCommandId: null
		};
	}
	requirePresence(e, t) {
		let n = e === "platform" ? this.platforms.get(t) : this.longRoads.get(t);
		if (!n) throw Error(`Missing ${e} diagnostic "${t}".`);
		return n;
	}
	requireOverpass(e) {
		let t = this.overpasses.get(e);
		if (!t) throw Error(`Missing overpass diagnostic "${e}".`);
		return t;
	}
};
//#endregion
//#region src/workflows/recovery/RecoveryBoundaryStore.ts
function re(e, t) {
	if (e.trim().length === 0) throw Error(`${t} must not be empty.`);
	return e;
}
function ie(e) {
	let t = JSON.parse(JSON.stringify(e));
	if (typeof t != "object" || !t || Array.isArray(t)) throw Error("Recovery journal metadata must serialize to an object.");
	return Object.freeze(t);
}
var ae = class {
	port;
	boundary = null;
	nextCheckpointRevision = 1;
	constructor(e) {
		this.port = e;
	}
	begin(e) {
		return re(e, "safeNodeId"), !this.boundary && (this.boundary = {
			transactionId: null,
			safeNodeId: e,
			checkpointId: this.allocateCheckpointId(),
			checkpoint: this.port.captureCheckpoint(),
			journalById: /* @__PURE__ */ new Map(),
			journalOrder: [],
			terminalOperationIds: /* @__PURE__ */ new Set(),
			restored: !1
		}, !0);
	}
	bind(e, t) {
		re(e, "transactionId"), this.boundary || this.begin(t);
		let n = this.requireBoundary();
		if (n.transactionId !== null && n.transactionId !== e) throw Error(`Recovery transaction "${n.transactionId}" cannot accept "${e}".`);
		n.transactionId = e;
	}
	record(e) {
		let t = this.boundary;
		if (!t || t.transactionId !== e.transactionId) return !1;
		let n = `${e.objectKind}:${e.objectId}`;
		return !t.journalById.has(n) && (t.journalById.set(n, Object.freeze({
			...e,
			journalId: n
		})), t.journalOrder.push(n), !0);
	}
	terminal(e, t) {
		let n = this.boundary;
		return !n || n.transactionId !== e ? !1 : (n.terminalOperationIds.add(t), !0);
	}
	advance(e, t) {
		let n = this.boundary;
		if (!n || n.transactionId !== t) return !1;
		let r = n.journalOrder.flatMap((e) => {
			let t = n.journalById.get(e);
			return t && !n.terminalOperationIds.has(t.operationId) ? [t] : [];
		});
		return n.safeNodeId = e, n.checkpointId = this.allocateCheckpointId(), n.checkpoint = this.port.captureCheckpoint(), n.restored = !1, n.journalById.clear(), n.journalOrder.length = 0, n.terminalOperationIds.clear(), r.forEach((e) => {
			n.journalById.set(e.journalId, e), n.journalOrder.push(e.journalId);
		}), !0;
	}
	prepare(e) {
		let t = this.requireBoundary();
		if (t.transactionId !== e.transactionId || t.safeNodeId !== e.safeNodeId) throw Error(`Missing recovery checkpoint for ${e.transactionId}.`);
		let n = Object.freeze(t.journalOrder.flatMap((e) => {
			let n = t.journalById.get(e);
			return n ? [Object.freeze({
				journalId: n.journalId,
				objectId: n.objectId,
				objectKind: n.objectKind,
				visibleBefore: n.visibleBefore,
				order: n.objectKind === "overpass" ? n.order : null,
				metadata: ie(n.metadata)
			})] : [];
		}));
		return Object.freeze({
			recoveryId: e.recoveryId,
			sessionRevision: e.sessionRevision,
			transactionId: e.transactionId,
			checkpointId: t.checkpointId,
			safeNodeId: e.safeNodeId,
			journal: n
		});
	}
	restore(e) {
		let t = this.requireBoundary();
		if (t.checkpointId !== e) throw Error(`Missing recovery checkpoint "${e}".`);
		if (t.restored) throw Error(`Recovery checkpoint "${e}" was already restored.`);
		this.port.restoreCheckpoint(t.checkpoint), this.port.discardPendingAfterRecovery(), t.restored = !0;
	}
	complete(e) {
		return !this.boundary || this.boundary.transactionId !== e ? !1 : (this.boundary = null, !0);
	}
	reset() {
		this.boundary = null;
	}
	getSnapshot() {
		if (!this.boundary) return null;
		let e = this.boundary;
		return Object.freeze({
			transactionId: e.transactionId,
			safeNodeId: e.safeNodeId,
			checkpointId: e.checkpointId,
			journalObjectIds: Object.freeze(e.journalOrder.map((t) => e.journalById.get(t)?.objectId ?? t))
		});
	}
	requireBoundary() {
		if (!this.boundary) throw Error("No recovery boundary is active.");
		return this.boundary;
	}
	allocateCheckpointId() {
		let e = `recovery-checkpoint:${this.nextCheckpointRevision}`;
		return this.nextCheckpointRevision += 1, e;
	}
};
//#endregion
//#region src/statecharts/orchestration/selectors.ts
function R(e) {
	let t = e.children.navigationWorkflow?.getSnapshot();
	return z(t) ? t : null;
}
function z(e) {
	return typeof e == "object" && !!e && "machine" in e && typeof e.machine == "object" && e.machine !== null && "id" in e.machine && e.machine.id === "navigation-workflow";
}
function oe(e) {
	let t = e.children.zoneSessionWorkflow?.getSnapshot();
	return se(t) ? t : null;
}
function se(e) {
	return typeof e == "object" && !!e && "machine" in e && typeof e.machine == "object" && e.machine !== null && "id" in e.machine && e.machine.id === "zone-session";
}
function ce(e) {
	let t = R(e);
	return t === null ? e.context.navigationWorkflowPhase === "idle" : r(t) === "idle";
}
function le(t) {
	let n = oe(t);
	return n === null ? !t.context.zoneInitiallyActive && !t.context.zoneTransitionActive : e(n).phase === "inactive";
}
function ue(t) {
	let n = oe(t);
	return n === null ? t.context.zoneInitiallyActive && !t.context.zoneTransitionActive : e(n).phase === "active";
}
function de(e) {
	return e === "awaiting-character-settle" || e === "awaiting-linked-cleanup" ? "awaiting-settle" : e === "failed" ? "planning" : e;
}
function B(e) {
	return e === "inactive" || e === "active" ? e : e === "planningRevealFromInactive" || e === "planningRevealFromActive" ? "planning-reveal" : e === "selectingRevealBeforeAction" || e === "revealBeforeBridge" || e === "selectingRevealStep" || e === "revealing" ? "revealing" : e === "planningDismissFromInactive" || e === "planningDismissFromActive" ? "planning-dismiss" : "dismissing";
}
function fe(e) {
	return e.hasTag("character-settling") ? "settling" : e.hasTag("character-moving") ? e.context.arrivedNodeId === null ? "running" : "settling" : e.context.characterVisualIdle ? "idle" : "running";
}
function V(t) {
	let r = t.context, i = R(t), a = oe(t), o = i ? n(i) : null, s = a ? e(a) : null, c = o?.command ?? r.navigationWorkflowCommand, l = c ? c.type === "CHARACTER.FORCE_SETTLE" ? c.attemptId : c.token : null;
	return Object.freeze({
		stateValue: t.value,
		health: Object.freeze({
			status: t.matches("degraded") ? "degraded" : t.matches("recovering") ? "recovering" : "live",
			error: r.fatalError
		}),
		currentNodeId: o?.currentNodeId ?? r.currentNodeId,
		queuedTargetNodeId: o?.queuedTargetNodeId ?? r.pendingNavigationTargetNodeId,
		character: Object.freeze({
			phase: fe(t),
			visualIdle: o?.characterVisualIdle ?? r.characterVisualIdle,
			motionToken: r.motionCommandToken
		}),
		navigation: Object.freeze({
			phase: de(o?.phase ?? r.navigationWorkflowPhase),
			planId: o?.planId ?? r.navigationPlan?.id ?? null,
			stageIndex: o?.stageIndex ?? r.navigationStageIndex,
			beforeActionIndex: o?.beforeActionIndex ?? r.navigationBeforeActionIndex,
			afterActionIndex: o?.afterActionIndex ?? r.navigationAfterActionIndex,
			commandToken: l,
			commandAttempt: c?.attempt ?? r.navigationCommandAttempt,
			linkedZoneCleanupComplete: o?.linkedCleanupComplete ?? r.linkedZoneCleanupComplete
		}),
		zoneSession: Object.freeze({
			phase: B(s?.phase ?? (r.zoneInitiallyActive ? "active" : "inactive")),
			revealPlanId: s?.revealPlan?.id ?? r.zoneRevealPlan?.id ?? null,
			revealStepIndex: s?.revealStepIndex ?? r.zoneRevealStepIndex,
			dismissPlanId: s?.dismissPlan?.id ?? r.zoneDismissPlan?.id ?? null,
			dismissStepIndex: s?.dismissStepIndex ?? r.zoneDismissStepIndex,
			commandToken: s?.revealCommandToken ?? s?.dismissCommandToken ?? r.zoneRevealCommandToken ?? r.zoneDismissCommandToken,
			commandAttempt: s?.revealCommandToken ? s.revealCommandAttempt : s?.dismissCommandAttempt ?? r.zoneDismissCommandAttempt
		}),
		recovery: Object.freeze({
			active: t.matches("recovering"),
			request: r.recoveryRequest,
			lastComplete: r.lastRecovery
		})
	});
}
//#endregion
//#region src/diagnostics/PerformanceMeter.ts
var pe = class {
	fps = 0;
	accumulatedSeconds = 0;
	accumulatedFrames = 0;
	update(e) {
		if (this.accumulatedSeconds += e, this.accumulatedFrames += 1, this.accumulatedSeconds >= .5) {
			let e = this.accumulatedFrames / this.accumulatedSeconds;
			this.fps = this.fps === 0 ? e : this.fps * .72 + e * .28, this.accumulatedSeconds = 0, this.accumulatedFrames = 0;
		}
	}
}, me = Object.freeze({ kind: "pass" }), he = Object.freeze([]), ge = Object.freeze({
	PRESENTATION_COMMAND: "presentation.command",
	PRESENTATION_ACK: "presentation.ack",
	MOTION_COMMAND: "motion.command",
	MOTION_DEPARTED: "motion.departed",
	MOTION_ARRIVED: "motion.arrived",
	CHARACTER_STOP_FINISHED: "character.stop.finished",
	CHARACTER_TURN_FINISHED: "character.turn.finished"
}), H = Object.freeze(new class {
	activeScenarioId = null;
	decide(e) {
		return me;
	}
	intercept(e, t) {
		return {
			status: "continued",
			value: t()
		};
	}
	getTimeline() {
		return he;
	}
}());
Object.freeze({ schedule(e, t) {
	let n = globalThis.setTimeout(e, t);
	return () => globalThis.clearTimeout(n);
} });
var _e = 6, ve = 64, ye = class {
	canvas;
	camera;
	pickTargets;
	nodeCount;
	resolveNodeIndex;
	resolveKeyboardIndex;
	isNodeVisibleOverride;
	onActivate;
	onBackgroundActivate;
	onPanByPixels;
	onHover;
	onPress;
	onKeyboardSelection;
	raycaster = new f();
	pointer = new u();
	projectedTargetPosition = new y();
	keyboardIndex;
	hoveredIndex = null;
	hoverLatchClientX = 0;
	hoverLatchClientY = 0;
	pressedIndex = null;
	capturedPointerId = null;
	pointerStartX = 0;
	pointerStartY = 0;
	pointerLastX = 0;
	pointerLastY = 0;
	isPanning = !1;
	enabled = !1;
	constructor(e) {
		this.canvas = e.canvas, this.camera = e.camera, this.pickTargets = e.pickTargets, this.nodeCount = e.nodeCount, this.keyboardIndex = e.initialNodeIndex, this.resolveNodeIndex = e.resolveNodeIndex, this.resolveKeyboardIndex = e.resolveKeyboardIndex, this.isNodeVisibleOverride = e.isNodeVisible, this.onActivate = e.onActivate, this.onBackgroundActivate = e.onBackgroundActivate, this.onPanByPixels = e.onPanByPixels, this.onHover = e.onHover, this.onPress = e.onPress, this.onKeyboardSelection = e.onKeyboardSelection, this.raycaster.layers.set(1), this.canvas.addEventListener("pointermove", this.handlePointerMove), this.canvas.addEventListener("pointerdown", this.handlePointerDown), this.canvas.addEventListener("pointerup", this.handlePointerUp), this.canvas.addEventListener("pointercancel", this.handlePointerCancel), this.canvas.addEventListener("pointerleave", this.handlePointerLeave), this.canvas.addEventListener("lostpointercapture", this.handleLostPointerCapture), this.canvas.addEventListener("wheel", this.handleWheel, { passive: !1 }), this.canvas.addEventListener("keydown", this.handleKeyDown), this.canvas.addEventListener("focus", this.handleFocus), this.canvas.addEventListener("blur", this.handleBlur), this.canvas.setAttribute("aria-disabled", "true"), this.canvas.dataset.viewportPan = String(this.onPanByPixels !== void 0);
	}
	setEnabled(e) {
		this.enabled !== e && (this.enabled = e, this.canvas.setAttribute("aria-disabled", String(!e)), e || (this.releaseActivePointerCapture(), this.resetPointerState(), this.canvas.blur()));
	}
	setKeyboardIndex(e) {
		e >= 0 && e < this.nodeCount && this.isNodeVisible(e) && (this.keyboardIndex = e);
	}
	dispose() {
		this.releaseActivePointerCapture(), this.resetPointerState(), this.enabled = !1, this.canvas.setAttribute("aria-disabled", "true"), this.canvas.removeEventListener("pointermove", this.handlePointerMove), this.canvas.removeEventListener("pointerdown", this.handlePointerDown), this.canvas.removeEventListener("pointerup", this.handlePointerUp), this.canvas.removeEventListener("pointercancel", this.handlePointerCancel), this.canvas.removeEventListener("pointerleave", this.handlePointerLeave), this.canvas.removeEventListener("lostpointercapture", this.handleLostPointerCapture), this.canvas.removeEventListener("wheel", this.handleWheel), this.canvas.removeEventListener("keydown", this.handleKeyDown), this.canvas.removeEventListener("focus", this.handleFocus), this.canvas.removeEventListener("blur", this.handleBlur);
	}
	handlePointerMove = (e) => {
		if (!this.enabled) return;
		if (this.capturedPointerId === e.pointerId && e.buttons !== 0) {
			let t = Math.hypot(e.clientX - this.pointerStartX, e.clientY - this.pointerStartY);
			!this.isPanning && this.onPanByPixels !== void 0 && t >= _e && (this.isPanning = !0, this.pressedIndex = null, this.onPress(null), this.publishHover(null), this.canvas.style.cursor = "grabbing");
			let n = e.clientX - this.pointerLastX, r = e.clientY - this.pointerLastY;
			this.pointerLastX = e.clientX, this.pointerLastY = e.clientY, this.isPanning && (e.preventDefault(), this.onPanByPixels?.(-n, -r));
			return;
		}
		if (e.pointerType !== "mouse" && e.buttons === 0) return;
		let t = this.pickNode(e);
		if (t === null && e.pointerType === "mouse" && this.hoveredIndex !== null && Math.hypot(e.clientX - this.hoverLatchClientX, e.clientY - this.hoverLatchClientY) < ve) {
			this.canvas.style.cursor = "pointer";
			return;
		}
		t !== null && (this.hoverLatchClientX = e.clientX, this.hoverLatchClientY = e.clientY), this.canvas.style.cursor = t === null && this.onPanByPixels ? "grab" : t === null ? "default" : "pointer", this.publishHover(t);
	};
	handlePointerDown = (e) => {
		!this.enabled || e.button !== 0 || (this.pressedIndex = this.pickNode(e), this.pointerStartX = e.clientX, this.pointerStartY = e.clientY, this.pointerLastX = e.clientX, this.pointerLastY = e.clientY, this.isPanning = !1, this.onPress(this.pressedIndex), this.canvas.setPointerCapture(e.pointerId), this.capturedPointerId = e.pointerId, this.canvas.focus({ preventScroll: !0 }));
	};
	handlePointerUp = (e) => {
		if (!this.enabled) {
			this.resetPointerState();
			return;
		}
		let t = this.isPanning, n = t ? null : this.pickNode(e), r = !t && n !== null && n === this.pressedIndex;
		this.pressedIndex = null, this.isPanning = !1, this.onPress(null), this.canvas.hasPointerCapture(e.pointerId) && this.canvas.releasePointerCapture(e.pointerId), this.capturedPointerId === e.pointerId && (this.capturedPointerId = null), r ? (this.keyboardIndex = n, this.onActivate(n)) : !t && n === null && this.onBackgroundActivate?.(), this.canvas.style.cursor = n === null && this.onPanByPixels ? "grab" : n === null ? "default" : "pointer";
	};
	handlePointerCancel = (e) => {
		this.canvas.hasPointerCapture(e.pointerId) && this.canvas.releasePointerCapture(e.pointerId), this.capturedPointerId === e.pointerId && (this.capturedPointerId = null), this.resetPointerState();
	};
	handlePointerLeave = () => {
		this.capturedPointerId === null && this.resetPointerState();
	};
	handleLostPointerCapture = () => {
		this.capturedPointerId = null, this.resetPointerState();
	};
	handleWheel = (e) => {
		if (!this.enabled || !this.onPanByPixels) return;
		e.preventDefault();
		let t = Math.max(1, this.canvas.clientHeight * .84), n = e.deltaMode === e.DOM_DELTA_LINE ? 18 : e.deltaMode === e.DOM_DELTA_PAGE ? t : 1, r = e.deltaX * n, i = e.deltaY * n;
		e.shiftKey && Math.abs(r) < .01 && (r = i, i = 0);
		let a = Math.max(this.canvas.clientWidth, this.canvas.clientHeight, 1);
		this.publishHover(null), this.onPanByPixels(Math.max(-a, Math.min(a, r)), Math.max(-a, Math.min(a, i))), this.canvas.style.cursor = "grab";
	};
	handleKeyDown = (e) => {
		if (!this.enabled) return;
		switch (e.key) {
			case "Enter":
			case " ":
				e.preventDefault(), this.isNodeVisible(this.keyboardIndex) && this.onActivate(this.keyboardIndex);
				return;
		}
		let t = this.getKeyboardCommand(e.key);
		if (t === null) return;
		e.preventDefault();
		let n = this.keyboardIndex, r = this.resolveKeyboardIndex(n, t);
		r !== null && Number.isInteger(r) && r >= 0 && r < this.nodeCount && this.isNodeVisible(r) && (this.keyboardIndex = r), n !== this.keyboardIndex && (this.publishHover(this.keyboardIndex), this.onKeyboardSelection(this.keyboardIndex));
	};
	handleFocus = () => {
		if (this.enabled) {
			if (!this.isNodeVisible(this.keyboardIndex)) {
				this.publishHover(null);
				return;
			}
			this.publishHover(this.keyboardIndex), this.onKeyboardSelection(this.keyboardIndex);
		}
	};
	handleBlur = () => {
		this.resetPointerState();
	};
	resetPointerState() {
		this.pressedIndex = null, this.isPanning = !1, this.publishHover(null), this.onPress(null), this.canvas.style.cursor = this.onPanByPixels ? "grab" : "default";
	}
	publishHover(e) {
		this.hoveredIndex !== e && (this.hoveredIndex = e, this.onHover(e));
	}
	releaseActivePointerCapture() {
		let e = this.capturedPointerId;
		this.capturedPointerId = null, e !== null && this.canvas.hasPointerCapture(e) && this.canvas.releasePointerCapture(e);
	}
	getKeyboardCommand(e) {
		switch (e) {
			case "ArrowLeft": return "left";
			case "ArrowRight": return "right";
			case "ArrowUp": return "up";
			case "ArrowDown": return "down";
			case "Home": return "home";
			case "End": return "end";
			default: return null;
		}
	}
	pickNode(e) {
		let t = this.canvas.getBoundingClientRect();
		this.pointer.set((e.clientX - t.left) / t.width * 2 - 1, -((e.clientY - t.top) / t.height) * 2 + 1), this.raycaster.setFromCamera(this.pointer, this.camera);
		let n = this.pickTargets.filter((e) => this.isPickTargetVisible(e)), r = this.raycaster.intersectObjects(n, !1)[0];
		if (e.pointerType === "touch" || e.pointerType === "pen") {
			let n = this.pickNearestTouchTarget(e, t);
			if (n !== null) return n;
		}
		return this.resolveNodeIndex(r?.object ?? null);
	}
	pickNearestTouchTarget(e, t) {
		let n = e.clientX - t.left, r = e.clientY - t.top, i = null, a = Infinity;
		for (let e of this.pickTargets) {
			if (!this.isPickTargetVisible(e) || (e.getWorldPosition(this.projectedTargetPosition).project(this.camera), this.projectedTargetPosition.z < -1 || this.projectedTargetPosition.z > 1)) continue;
			let o = (this.projectedTargetPosition.x + 1) * .5 * t.width, s = (1 - this.projectedTargetPosition.y) * .5 * t.height, c = n - o, l = r - s, u = c * c + l * l;
			u <= 484 && u < a && (i = e, a = u);
		}
		return this.resolveNodeIndex(i);
	}
	isPickTargetVisible(e) {
		if (!e.visible || e.userData.pathNodeVisible === !1) return !1;
		let t = this.resolveNodeIndex(e);
		return t !== null && (this.isNodeVisibleOverride?.(t) ?? !0);
	}
	isNodeVisible(e) {
		return this.isNodeVisibleOverride ? this.isNodeVisibleOverride(e) : this.pickTargets.some((t) => this.resolveNodeIndex(t) === e && t.visible && t.userData.pathNodeVisible !== !1);
	}
}, be = class {
	#e;
	#t;
	#n;
	#r;
	#i = /* @__PURE__ */ new Map();
	#a = 1;
	#o;
	#s = !1;
	constructor(e) {
		this.#e = e.document, this.#t = e.now ?? (() => globalThis.performance?.now() ?? Date.now()), this.#n = e.setTimeout ?? ((e, t) => globalThis.setTimeout(e, t)), this.#r = e.clearTimeout ?? ((e) => globalThis.clearTimeout(e)), this.#o = !e.document.hidden, this.#e.addEventListener("visibilitychange", this.#c);
	}
	setTimeout(e, t) {
		let n = this.#a++, r = {
			callback: e,
			remainingMs: Math.max(0, t),
			startedAtMs: null,
			nativeHandle: null
		};
		return this.#i.set(n, r), this.#o && !this.#s && this.#l(n, r), n;
	}
	clearTimeout(e) {
		let t = Number(e), n = this.#i.get(t);
		n && (n.nativeHandle !== null && this.#r(n.nativeHandle), this.#i.delete(t));
	}
	dispose() {
		if (!this.#s) {
			this.#s = !0, this.#e.removeEventListener("visibilitychange", this.#c);
			for (let e of this.#i.values()) e.nativeHandle !== null && this.#r(e.nativeHandle);
			this.#i.clear();
		}
	}
	#c = () => {
		if (this.#s) return;
		let e = !this.#e.hidden;
		e !== this.#o && (this.#o = e, e ? this.#d() : this.#u());
	};
	#l(e, t) {
		t.startedAtMs = this.#t(), t.nativeHandle = this.#n(() => {
			this.#s || this.#i.get(e) !== t || (this.#i.delete(e), t.nativeHandle = null, t.startedAtMs = null, t.callback());
		}, t.remainingMs);
	}
	#u() {
		let e = this.#t();
		for (let t of this.#i.values()) t.nativeHandle !== null && t.startedAtMs !== null && (this.#r(t.nativeHandle), t.remainingMs = Math.max(0, t.remainingMs - Math.max(0, e - t.startedAtMs)), t.nativeHandle = null, t.startedAtMs = null);
	}
	#d() {
		for (let [e, t] of this.#i) t.nativeHandle === null && this.#l(e, t);
	}
}, xe = class {
	#e;
	#t;
	#n;
	#r;
	#i = !1;
	#a = !1;
	#o = 0;
	#s = 0;
	constructor(e) {
		this.#e = e.scheduler, this.#t = e.clock, this.#n = e.steps, this.#r = Math.max(0, e.maxDeltaSeconds ?? .1);
	}
	get running() {
		return this.#i;
	}
	get disposed() {
		return this.#a;
	}
	start() {
		this.#a || this.#i || (this.#i = !0, this.#t.reset(), this.#e.start(this.#c));
	}
	stop() {
		this.#i && (this.#i = !1, this.#e.stop());
	}
	dispose() {
		this.#a || (this.#a = !0, this.stop(), this.#t.dispose());
	}
	#c = (e) => {
		if (!this.#i || this.#a) return;
		let t = Math.max(0, this.#t.update(e)), n = Math.min(t, this.#r);
		this.#s += n;
		let r = Object.freeze({
			sequence: ++this.#o,
			...e === void 0 ? {} : { timestamp: e },
			rawDeltaSeconds: t,
			deltaSeconds: n,
			elapsedSeconds: this.#s
		});
		this.#n.updateSimulation(r), this.#n.updateCamera(r), this.#n.updateCharacter(r), this.#n.publishVisualIdleEdge(r), this.#n.updatePathView(r), this.#n.updateRuntime(r), this.#n.updatePerformanceMeter(r), this.#n.renderScene(r), this.#n.afterRender?.(r);
	};
}, Se = (e) => ({
	start: (t) => e.setAnimationLoop(t),
	stop: () => e.setAnimationLoop(null)
}), Ce = (e) => {
	let t = new a();
	return t.connect(e), {
		reset: () => t.reset(),
		update: (e) => (t.update(e), t.getDelta()),
		dispose: () => t.dispose()
	};
}, we = () => new DOMException("Presentation cancelled.", "AbortError"), Te = (e) => ({
	now: () => e.performance.now(),
	request: (t) => e.requestAnimationFrame(t),
	cancel: (t) => e.cancelAnimationFrame(t)
}), Ee = class {
	presentation;
	#e;
	#t;
	#n;
	#r;
	#i;
	#a;
	#o;
	#s;
	#c;
	#l;
	#u;
	#d = /* @__PURE__ */ new Set();
	#f;
	#p = null;
	#m = null;
	#h = !1;
	#g = !1;
	constructor(e) {
		this.#e = e.initialNodeId, this.#t = e.nodeExists, this.#n = new Map(e.edges.map((e) => [e.id, e])), this.#r = e.pathView, this.#i = e.characterStage, this.#a = e.setSemanticNodeVisible, this.#o = e.publishState, this.#s = e.frameScheduler ?? Te(window), this.#c = e.presenceSpeedMultiplier ?? 1, this.#l = e.characterDropHeight ?? 5.4, this.#u = Math.max(0, e.characterDropDurationSeconds ?? .48), this.#f = new Promise((e, t) => {
			this.#p = e, this.#m = t;
		}), this.#f.catch(() => {}), this.presentation = Object.freeze({
			revealNode: this.#_,
			revealEdge: this.#v,
			revealCharacter: this.#y
		});
	}
	markCharacterReady() {
		this.#g || this.#h || (this.#h = !0, this.#p?.(), this.#T());
	}
	markCharacterFailed(e) {
		this.#g || this.#h || (this.#h = !0, this.#m?.(e), this.#T());
	}
	dispose() {
		if (this.#g) return;
		this.#g = !0;
		let e = we();
		this.#h || (this.#h = !0, this.#m?.(e), this.#T()), [...this.#d].forEach((t) => {
			this.#C(t, e);
		});
	}
	get disposed() {
		return this.#g;
	}
	get activeAnimationCount() {
		return this.#d.size;
	}
	#_ = async (e, t, n) => {
		if (this.#w(n), !this.#t(e)) throw Error(`Cannot reveal unknown node "${e}".`);
		await this.#b((n) => this.#r.updateNodePresence(e, n, {
			desiredVisible: !0,
			reducedMotion: t,
			speedMultiplier: this.#c
		}).status === "visible", n), this.#w(n), this.#a(e, !0), this.#o();
	};
	#v = async (e, t, n) => {
		this.#w(n);
		let r = this.#n.get(e);
		if (!r) throw Error(`Cannot reveal unknown edge "${e}".`);
		if (r.pathKind !== "straight") throw Error(`Initial generation cannot reveal overpass edge "${e}".`);
		await this.#b((n) => this.#r.updateStraightEdgePresence(e, n, {
			desiredVisible: !0,
			reducedMotion: t,
			speedMultiplier: this.#c
		}).status === "visible", n), this.#w(n), this.#o();
	};
	#y = async (e, t, n) => {
		if (this.#w(n), e !== this.#e) throw Error(`Character reveal must target initial node "${this.#e}".`);
		if (await this.#S(n), this.#w(n), this.#i.visible = !0, t) {
			this.#i.position.y = 0, this.#o();
			return;
		}
		let r = 0;
		this.#i.position.y = this.#l, await this.#b((e) => {
			r = Math.min(this.#u, r + e);
			let t = this.#u <= 0 ? 1 : r / this.#u, n = 1 - (1 - t) ** 4;
			return this.#i.position.y = this.#l * (1 - n), t >= 1;
		}, n), this.#w(n), this.#i.position.y = 0, this.#o();
	};
	#b(e, t) {
		return this.#w(t), new Promise((n, r) => {
			let i = this.#s.now(), a = {
				frameId: 0,
				active: !0,
				...t ? { signal: t } : {},
				abort: () => {
					this.#C(a, we());
				},
				reject: r
			}, o = (r) => {
				if (!a.active || this.#g) return;
				if (t?.aborted) {
					a.abort();
					return;
				}
				let s = Math.min(Math.max(0, (r - i) / 1e3), .1);
				i = r;
				try {
					if (e(s)) {
						this.#C(a), n();
						return;
					}
				} catch (e) {
					this.#C(a, e);
					return;
				}
				this.#x(a, o);
			};
			this.#d.add(a), t?.addEventListener("abort", a.abort, { once: !0 }), this.#x(a, o);
		});
	}
	#x(e, t) {
		if (e.active) try {
			e.frameId = this.#s.request(t);
		} catch (t) {
			this.#C(e, t);
		}
	}
	#S(e) {
		return this.#w(e), e ? new Promise((t, n) => {
			let r = !1, i = (i) => {
				r || (r = !0, e.removeEventListener("abort", a), i === void 0 ? t() : n(i));
			}, a = () => i(we());
			e.addEventListener("abort", a, { once: !0 }), this.#f.then(() => i(), (e) => i(e));
		}) : this.#f;
	}
	#C(e, t) {
		e.active && (e.active = !1, this.#s.cancel(e.frameId), e.signal?.removeEventListener("abort", e.abort), this.#d.delete(e), t !== void 0 && e.reject(t));
	}
	#w(e) {
		if (this.#g || e?.aborted) throw we();
	}
	#T() {
		this.#p = null, this.#m = null;
	}
}, De = () => Object.freeze({
	sequence: 0,
	modelPhase: "not-started",
	modelError: null,
	presentationPhase: "not-started",
	presentationError: null,
	contextAvailable: !0
}), Oe = class {
	#e = /* @__PURE__ */ new Set();
	#t = De();
	#n = !1;
	getSnapshot() {
		return this.#t;
	}
	subscribe(e) {
		if (this.#n) return Object.freeze({ unsubscribe: () => {} });
		this.#e.add(e);
		let t = !0;
		return Object.freeze({ unsubscribe: () => {
			t && (t = !1, this.#e.delete(e));
		} });
	}
	record(e) {
		if (this.#n || !this.#r(e)) return;
		let t = this.#t, n = { sequence: t.sequence + 1 };
		switch (e.type) {
			case "MODEL.LOAD_STARTED":
				this.#t = Object.freeze({
					...t,
					...n,
					modelPhase: "loading",
					modelError: null
				});
				break;
			case "MODEL.READY":
				this.#t = Object.freeze({
					...t,
					...n,
					modelPhase: "ready",
					modelError: null
				});
				break;
			case "MODEL.FAILED":
				this.#t = Object.freeze({
					...t,
					...n,
					modelPhase: "failed",
					modelError: e.error
				});
				break;
			case "PRESENTATION.STARTED":
				this.#t = Object.freeze({
					...t,
					...n,
					presentationPhase: "presenting",
					presentationError: null
				});
				break;
			case "PRESENTATION.READY":
				this.#t = Object.freeze({
					...t,
					...n,
					presentationPhase: "ready",
					presentationError: null
				});
				break;
			case "PRESENTATION.FAILED":
				this.#t = Object.freeze({
					...t,
					...n,
					presentationPhase: "failed",
					presentationError: e.error
				});
				break;
			case "CONTEXT.LOST":
				this.#t = Object.freeze({
					...t,
					...n,
					contextAvailable: !1
				});
				break;
			case "CONTEXT.RESTORED": this.#t = Object.freeze({
				...t,
				...n,
				contextAvailable: !0
			});
		}
		let r = this.#t;
		[...this.#e].forEach((t) => t(e, r));
	}
	dispose() {
		this.#n || (this.#n = !0, this.#e.clear());
	}
	#r(e) {
		let t = this.#t;
		switch (e.type) {
			case "MODEL.LOAD_STARTED": return t.modelPhase !== "loading";
			case "MODEL.READY": return t.modelPhase !== "ready";
			case "MODEL.FAILED": return t.modelPhase !== "failed" || t.modelError !== e.error;
			case "PRESENTATION.STARTED": return t.presentationPhase !== "presenting";
			case "PRESENTATION.READY": return t.presentationPhase !== "ready";
			case "PRESENTATION.FAILED": return t.presentationPhase !== "failed" || t.presentationError !== e.error;
			case "CONTEXT.LOST": return t.contextAvailable;
			case "CONTEXT.RESTORED": return !t.contextAvailable;
		}
	}
}, ke = "(prefers-reduced-motion: reduce)", Ae = (e) => e.matchMedia(ke).matches, je = () => typeof ResizeObserver > "u" ? null : (e) => new ResizeObserver((t) => e(t)), Me = class {
	#e;
	#t;
	#n;
	#r;
	#i;
	#a;
	#o;
	#s;
	#c;
	#l = !1;
	#u = !1;
	#d = !1;
	constructor(e) {
		this.#e = e.browserWindow, this.#t = e.document, this.#n = e.canvas, this.#r = e.viewport, this.#i = e.frameLoop, this.#a = e.callbacks, this.#c = !e.document.hidden, this.#o = e.browserWindow.matchMedia(ke);
		let t = e.resizeObserverFactory === void 0 ? je() : e.resizeObserverFactory;
		this.#s = t?.(this.#p) ?? null;
	}
	get reducedMotion() {
		return this.#o.matches;
	}
	get visible() {
		return this.#c;
	}
	get contextLost() {
		return this.#l;
	}
	get started() {
		return this.#u;
	}
	get disposed() {
		return this.#d;
	}
	start() {
		this.#d || this.#u || (this.#u = !0, this.#n.addEventListener("webglcontextlost", this.#g), this.#n.addEventListener("webglcontextrestored", this.#_), this.#t.addEventListener("visibilitychange", this.#m), this.#o.addEventListener("change", this.#h), this.#s ? this.#s.observe(this.#r) : this.#e.addEventListener("resize", this.#f, { passive: !0 }), this.#v());
	}
	dispose() {
		this.#d || (this.#d = !0, this.#u && (this.#u = !1, this.#n.removeEventListener("webglcontextlost", this.#g), this.#n.removeEventListener("webglcontextrestored", this.#_), this.#t.removeEventListener("visibilitychange", this.#m), this.#o.removeEventListener("change", this.#h), this.#s ? this.#s.disconnect() : this.#e.removeEventListener("resize", this.#f)), this.#i.stop());
	}
	#f = () => {
		!this.#u || this.#d || this.#a.onResize();
	};
	#p = (e) => {
		if (!this.#u || this.#d) return;
		let t = e[e.length - 1];
		t && this.#a.onResize(t.contentRect.width, t.contentRect.height);
	};
	#m = () => {
		if (!this.#u || this.#d) return;
		let e = !this.#t.hidden;
		e !== this.#c && (this.#c = e, this.#a.onVisibilityChanged?.(e), this.#v());
	};
	#h = (e) => {
		!this.#u || this.#d || this.#a.onReducedMotionChanged(e.matches);
	};
	#g = (e) => {
		e.preventDefault(), !(!this.#u || this.#d || this.#l) && (this.#l = !0, this.#i.stop(), this.#a.onContextLost(e));
	};
	#_ = () => {
		!this.#u || this.#d || !this.#l || (this.#l = !1, this.#a.onContextRestored(), this.#v());
	};
	#v() {
		if (!this.#u || this.#d || this.#l || !this.#c) {
			this.#i.stop();
			return;
		}
		this.#i.start();
	}
}, Ne = (e) => e === "green" ? "绿色" : e === "brown" ? "棕色" : "灰色", Pe = class {
	#e = [];
	#t = /* @__PURE__ */ new Map();
	#n;
	#r = !1;
	constructor(e) {
		this.#n = e.announcements;
		for (let t of e.nodes) {
			let n = e.resolveOptionElement(t.id), r = e.resolveNodeIndex(t.id);
			if (!n || r < 0) continue;
			let i = () => {
				this.#r || e.onInspectRequested(r);
			}, a = (t) => {
				if (this.#r) return;
				let n = t.key;
				(n === "Enter" || n === " ") && (t.preventDefault(), e.onInspectRequested(r));
			};
			n.addEventListener("click", i), n.addEventListener("keydown", a);
			let o = Object.freeze({
				node: t,
				nodeIndex: r,
				option: n,
				handleClick: i,
				handleKeyDown: a
			});
			this.#e.push(o), this.#t.set(r, o);
		}
	}
	get disposed() {
		return this.#r;
	}
	publish(e) {
		if (!this.#r) for (let t of this.#e) {
			let { node: n, nodeIndex: r, option: i } = t, a = !e.isRunning && e.currentNodeId === n.id, o = e.targetNodeId === n.id || e.queuedTargetNodeId === n.id;
			i.textContent = [
				n.label,
				Ne(e.getNodeColor(r)),
				a ? "当前位置" : null,
				o ? "目标位置" : null
			].filter(Boolean).join("，"), a ? i.setAttribute("aria-current", "step") : i.removeAttribute("aria-current");
		}
	}
	announceKeyboardSelection(e) {
		if (this.#r) return;
		let t = this.#t.get(e);
		t && this.#n.announceKeyboardSelection(t.node);
	}
	dispose() {
		if (!this.#r) {
			this.#r = !0;
			for (let e of this.#e) e.option.removeEventListener("click", e.handleClick), e.option.removeEventListener("keydown", e.handleKeyDown);
			this.#e.length = 0, this.#t.clear();
		}
	}
}, Fe = class {
	controller;
	disposed = !1;
	constructor(e) {
		let t = Ie(e, new Map(e.nodes.map((e, t) => [e.id, t]))), n = e.createController ?? ((e) => new ye(e));
		this.controller = n({
			canvas: e.canvas,
			camera: e.camera,
			pickTargets: e.pickTargets,
			nodeCount: e.nodes.length,
			initialNodeIndex: e.initialNodeIndex,
			resolveNodeIndex: e.resolveNodeIndex,
			resolveKeyboardIndex: t,
			isNodeVisible: e.isNodeInspectable,
			onActivate: e.inspectNode,
			onBackgroundActivate: e.onBackgroundActivated,
			onPanByPixels: (t, n) => {
				e.panByScreenPixels(t, n), e.renderScene();
			},
			onHover: (t) => {
				e.setHoveredNode(t), e.onNodeHovered?.(t === null ? null : e.nodes[t]?.id ?? null);
			},
			onPress: e.setPressedNode,
			onKeyboardSelection: (t) => {
				let n = e.nodes[t];
				n && e.onKeyboardSelection(n, t);
			}
		});
	}
	setEnabled(e) {
		this.disposed || this.controller.setEnabled(e);
	}
	setKeyboardIndex(e) {
		this.disposed || this.controller.setKeyboardIndex(e);
	}
	dispose() {
		this.disposed || (this.disposed = !0, this.controller.dispose());
	}
};
function Ie(e, t) {
	let n = new y(), r = new y(), i = new u(), a = new u();
	return (o, s) => {
		if (s === "home" || s === "end") {
			let n = s === "home" ? e.entryNodeId : e.goalNodeId, r = t.get(n) ?? -1;
			return r >= 0 && e.isNodeInspectable(r) ? r : null;
		}
		let c = e.nodes[o];
		if (!c) return null;
		a.set(s === "left" ? -1 : +(s === "right"), s === "up" ? 1 : s === "down" ? -1 : 0), n.set(c.position.x, e.keyboardSurfaceY, c.position.z).project(e.camera);
		let l = null, u = -Infinity;
		for (let t of e.authoredAdjacencyByIndex[o] ?? []) {
			let o = e.nodes[t];
			if (!o || !e.isNodeInspectable(t)) continue;
			r.set(o.position.x, e.keyboardSurfaceY, o.position.z).project(e.camera), i.set(r.x - n.x, r.y - n.y);
			let s = i.length();
			if (s <= 1e-5) continue;
			i.multiplyScalar(1 / s);
			let c = i.dot(a);
			if (c <= .08) continue;
			let d = c * 1e3 - s, f = l === null ? null : e.nodes[l], p = Math.abs(d - u) <= 1e-5 && f != null && o.navigationOrder < f.navigationOrder;
			(d > u + 1e-5 || p) && (l = t, u = d);
		}
		return l;
	};
}
//#endregion
//#region src/render/app/SceneBounds.ts
function Le(e, t) {
	if (e.length === 0) throw Error("Learning scene requires at least one path node.");
	let n = t.minimumHorizontalMargin ?? 1.35, r = t.proportionalHorizontalMargin ?? .035, i = Infinity, a = -Infinity, o = Infinity, s = -Infinity;
	e.forEach((e, t) => {
		let { x: n, z: r } = e.position;
		if (!Number.isFinite(n) || !Number.isFinite(r)) throw Error(`Learning scene node at index ${t} has a non-finite position.`);
		i = Math.min(i, n), a = Math.max(a, n), o = Math.min(o, r), s = Math.max(s, r);
	});
	let c = Math.max(n, (a - i) * r), l = Math.max(n, (s - o) * r);
	i -= c, a += c, o -= l, s += l;
	let u = new y((i + a) / 2, (t.floorY + t.topY) / 2, (o + s) / 2), d = [];
	for (let e of [i, a]) for (let n of [t.floorY, t.topY]) for (let t of [o, s]) d.push(new y(e, n, t));
	return Object.freeze({
		minX: i,
		maxX: a,
		minZ: o,
		maxZ: s,
		spanX: a - i,
		spanZ: s - o,
		center: u,
		corners: Object.freeze(d),
		radius: Math.max(...d.map((e) => e.distanceTo(u)))
	});
}
//#endregion
//#region src/render/app/ViewportPanPolicy.ts
function U(e) {
	if (![
		e.contentMin,
		e.contentMax,
		e.viewportMinOffset,
		e.viewportMaxOffset,
		e.proposedTarget
	].every(Number.isFinite) || e.contentMin > e.contentMax || e.viewportMinOffset > e.viewportMaxOffset) throw TypeError("Viewport pan bounds require finite, ordered values.");
	let t = e.contentMax - e.contentMin, n = e.viewportMaxOffset - e.viewportMinOffset, r = (e.viewportMinOffset + e.viewportMaxOffset) / 2;
	if (t <= n) {
		let t = (e.contentMin + e.contentMax) / 2 - r;
		return Object.freeze({
			target: t,
			minimumTarget: t,
			maximumTarget: t,
			pannable: !0
		});
	}
	let i = e.contentMin - r, a = e.contentMax - r;
	return Object.freeze({
		target: Math.min(a, Math.max(i, e.proposedTarget)),
		minimumTarget: i,
		maximumTarget: a,
		pannable: a - i > 1e-4
	});
}
//#endregion
//#region src/render/app/LearningScene.ts
var Re = new S("#fcfcfc"), ze = Math.max(4.6, t.bridgeSurfaceY + 2.8 + .15), Be = -.05, W = .92, G = 1.35, Ve = 30, K = 24, He = 1e-4, Ue = Object.freeze({
	position: Object.freeze({
		x: 0,
		z: 0
	}),
	initiallyVisible: !0
}), We = class {
	renderer;
	scene = new h();
	camera = new m(42, 1, .1, 500);
	fullBounds;
	initialBounds;
	cameraTarget = new y();
	framingCameraTarget = new y();
	viewportPanOffset = new y();
	panRaycaster = new f();
	shadowLights = [];
	canvas;
	viewportElement;
	ground = null;
	keyLight = null;
	fillLight = null;
	initialCameraFrame = null;
	fullCameraFrame = null;
	viewportBaseFov = 42;
	currentFov = 42;
	desiredFov = 42;
	fittedCameraDistance = 1;
	framingExpansionProgress = 0;
	framingExpansionTarget = 0;
	viewportWidthPixels = 1;
	viewportHeightPixels = 1;
	currentHorizontalCompositionOffsetPixels = 0;
	desiredHorizontalCompositionOffsetPixels = 0;
	currentVerticalCompositionOffsetPixels = 0;
	desiredVerticalCompositionOffsetPixels = 0;
	currentOverlayFovBonusDegrees = 0;
	desiredOverlayFovBonusDegrees = 0;
	disposed = !1;
	constructor(e, t = [], n) {
		this.canvas = e;
		let r = Array.isArray(t) ? {
			nodes: t,
			viewport: n
		} : t, i = r.nodes?.length ? r.nodes : [Ue], a = this.resolvePathBounds(i);
		this.fullBounds = a.full, this.initialBounds = a.initial, this.cameraTarget.copy(this.initialBounds.center), this.viewportElement = r.viewport ?? e.parentElement ?? e, this.renderer = new E({
			canvas: e,
			antialias: !0,
			alpha: !1,
			powerPreference: "high-performance",
			stencil: !1
		}), this.renderer.outputColorSpace = p, this.renderer.toneMapping = 7, this.renderer.toneMappingExposure = 1.14, this.renderer.shadowMap.enabled = !0, this.renderer.shadowMap.type = 3, this.scene.background = Re, this.scene.fog = new w(Re, 100, 300), this.scene.name = "liu-kanshan-learning-path-scene", this.createLighting(), this.createGround(), this.resize();
	}
	setPathNodes(e, t = {}) {
		if (this.disposed) throw Error("Cannot replace path nodes after the learning scene is disposed.");
		let n = this.resolvePathBounds(e);
		this.fullBounds = n.full, this.initialBounds = n.initial, t.preserveFramingProgress || (this.framingExpansionProgress = 0, this.framingExpansionTarget = 0, this.viewportPanOffset.set(0, 0, 0)), this.updateLightingBounds(), this.updateGroundBounds(), this.resize();
	}
	setViewportElement(e) {
		this.viewportElement = e ?? this.canvas.parentElement ?? this.canvas, this.resize();
	}
	resize(e, t) {
		let n = this.measureViewport(), r = this.normalizeViewportDimension(e, n.width), i = this.normalizeViewportDimension(t, n.height), a = Math.max(1, r), o = Math.max(1, i);
		this.viewportWidthPixels = a, this.viewportHeightPixels = o;
		let s = a / o, c = this.getPortraitCameraBlend(s);
		this.viewportBaseFov = this.getBaseFov(s), this.currentFov = this.viewportBaseFov, this.desiredFov = this.viewportBaseFov, this.camera.aspect = s, this.camera.fov = Math.min(82, this.currentFov + this.currentOverlayFovBonusDegrees);
		let l = _.lerp(55, 72, c), u = _.degToRad(l), d = new y(0, Math.sin(u), Math.cos(u)).normalize();
		this.initialCameraFrame = this.createCameraFrame(this.initialBounds, d, s, this.viewportBaseFov), this.fullCameraFrame = this.createCameraFrame(this.fullBounds, d, s, this.viewportBaseFov), this.applyPathFraming(), this.applyCompositionOffset(), this.updateShadowQuality(a);
		let f = a < 700 ? 1.6 : 2, p = Number.isFinite(globalThis.devicePixelRatio) ? Math.max(1, globalThis.devicePixelRatio) : 1;
		this.renderer.setPixelRatio(Math.min(p, f)), this.renderer.setSize(a, o, !1);
	}
	render() {
		this.renderer.render(this.scene, this.camera);
	}
	prepareTravel(e) {
		this.desiredFov = Math.max(this.currentFov, this.getFramingFov(e));
	}
	settleAt(e) {
		this.desiredFov = this.getFramingFov(e);
	}
	panByScreenPixels(e, t) {
		if (this.disposed || !Number.isFinite(e) || !Number.isFinite(t) || Math.abs(e) < He && Math.abs(t) < He) return this.getViewportPanSnapshot();
		let n = this.intersectGroundAtNdc(0, 0), r = this.intersectGroundAtNdc(e / this.viewportWidthPixels * 2, -(t / this.viewportHeightPixels) * 2);
		return !n || !r ? this.getViewportPanSnapshot() : (this.viewportPanOffset.x += r.x - n.x, this.viewportPanOffset.z += r.z - n.z, this.applyPathFraming(), this.applyCompositionOffset(), this.getViewportPanSnapshot());
	}
	resetViewportPan() {
		this.viewportPanOffset.set(0, 0, 0), this.applyPathFraming(), this.applyCompositionOffset();
	}
	getViewportPanSnapshot() {
		let e = this.resolveViewportPanConstraints();
		return Object.freeze({
			offsetX: this.viewportPanOffset.x,
			offsetZ: this.viewportPanOffset.z,
			minimumTargetX: e.x.minimumTarget,
			maximumTargetX: e.x.maximumTarget,
			minimumTargetZ: e.z.minimumTarget,
			maximumTargetZ: e.z.maximumTarget,
			canPanHorizontally: e.x.pannable,
			canPanVertically: e.z.pannable
		});
	}
	setVerticalCompositionOffsetPixels(e, t = !1) {
		let n = this.viewportHeightPixels * .48;
		this.desiredVerticalCompositionOffsetPixels = _.clamp(Number.isFinite(e) ? e : 0, 0, n), t && (this.currentVerticalCompositionOffsetPixels = this.desiredVerticalCompositionOffsetPixels, this.applyCompositionOffset());
	}
	getVerticalCompositionOffsetPixels() {
		return this.currentVerticalCompositionOffsetPixels;
	}
	setHorizontalCompositionOffsetPixels(e, t = !1) {
		let n = this.viewportWidthPixels * .42;
		this.desiredHorizontalCompositionOffsetPixels = _.clamp(Number.isFinite(e) ? e : 0, -n, n), t && (this.currentHorizontalCompositionOffsetPixels = this.desiredHorizontalCompositionOffsetPixels, this.applyCompositionOffset());
	}
	getHorizontalCompositionOffsetPixels() {
		return this.currentHorizontalCompositionOffsetPixels;
	}
	setOverlayFovBonusDegrees(e, t = !1) {
		this.desiredOverlayFovBonusDegrees = _.clamp(Number.isFinite(e) ? e : 0, 0, 20), t && (this.currentOverlayFovBonusDegrees = this.desiredOverlayFovBonusDegrees);
	}
	setPathFramingExpanded(e, t) {
		let n = this.getViewportPanSnapshot();
		if (n.canPanHorizontally || n.canPanVertically) {
			this.framingExpansionTarget = 0, this.framingExpansionProgress = 0, this.applyPathFraming(), this.applyCompositionOffset();
			return;
		}
		this.framingExpansionTarget = +!!e, t && (this.framingExpansionProgress = this.framingExpansionTarget, this.applyPathFraming());
	}
	expandPathFraming(e) {
		this.setPathFramingExpanded(!0, e);
	}
	collapsePathFraming(e) {
		this.setPathFramingExpanded(!1, e);
	}
	updateCamera(e, t) {
		let n = t ? 1 : 1 - Math.exp(-e * 7.5);
		this.currentFov = _.lerp(this.currentFov, this.desiredFov, n), this.currentOverlayFovBonusDegrees = _.lerp(this.currentOverlayFovBonusDegrees, this.desiredOverlayFovBonusDegrees, n), Math.abs(this.currentOverlayFovBonusDegrees - this.desiredOverlayFovBonusDegrees) < .01 && (this.currentOverlayFovBonusDegrees = this.desiredOverlayFovBonusDegrees), this.camera.fov = Math.min(82, this.currentFov + this.currentOverlayFovBonusDegrees);
		let r = this.framingExpansionTarget - this.framingExpansionProgress;
		if (Math.abs(r) > 2 ** -52) {
			let n = t ? Math.abs(r) : Math.max(0, e) / G;
			this.framingExpansionProgress = Math.abs(r) <= n ? this.framingExpansionTarget : this.framingExpansionProgress + Math.sign(r) * n, this.applyPathFraming();
		}
		this.currentVerticalCompositionOffsetPixels = _.lerp(this.currentVerticalCompositionOffsetPixels, this.desiredVerticalCompositionOffsetPixels, n), Math.abs(this.currentVerticalCompositionOffsetPixels - this.desiredVerticalCompositionOffsetPixels) < .05 && (this.currentVerticalCompositionOffsetPixels = this.desiredVerticalCompositionOffsetPixels), this.currentHorizontalCompositionOffsetPixels = _.lerp(this.currentHorizontalCompositionOffsetPixels, this.desiredHorizontalCompositionOffsetPixels, n), Math.abs(this.currentHorizontalCompositionOffsetPixels - this.desiredHorizontalCompositionOffsetPixels) < .05 && (this.currentHorizontalCompositionOffsetPixels = this.desiredHorizontalCompositionOffsetPixels), this.applyCompositionOffset(), this.applyPathFraming();
	}
	dispose() {
		this.disposed || (this.disposed = !0, this.renderer.setAnimationLoop(null), this.ground &&= (this.scene.remove(this.ground), this.ground.geometry.dispose(), this.ground.material.dispose(), null), this.shadowLights.forEach((e) => {
			e.shadow.map?.dispose(), e.shadow.mapPass?.dispose(), e.shadow.map = null, e.shadow.mapPass = null, e.shadow.dispose(), this.scene.remove(e, e.target);
		}), this.shadowLights.length = 0, this.keyLight = null, this.fillLight = null, this.renderer.dispose());
	}
	resolvePathBounds(e) {
		if (e.length === 0) throw Error("Learning scene requires at least one injected path node.");
		let t = e.some((e) => e.initiallyVisible === !0) ? e.filter((e) => e.initiallyVisible !== !1) : e, n = {
			floorY: Be,
			topY: ze
		};
		return {
			full: Le(e, n),
			initial: Le(t, n)
		};
	}
	measureViewport() {
		let e = this.viewportElement.getBoundingClientRect(), t = e.width > 0 ? e.width : this.viewportElement.clientWidth > 0 ? this.viewportElement.clientWidth : this.canvas.clientWidth > 0 ? this.canvas.clientWidth : this.canvas.width, n = e.height > 0 ? e.height : this.viewportElement.clientHeight > 0 ? this.viewportElement.clientHeight : this.canvas.clientHeight > 0 ? this.canvas.clientHeight : this.canvas.height;
		return {
			width: Math.max(1, t),
			height: Math.max(1, n)
		};
	}
	normalizeViewportDimension(e, t) {
		return e !== void 0 && Number.isFinite(e) && e > 0 ? e : t;
	}
	calculateFitDistance(e, t, n, r, i) {
		let a = new y(1, 0, 0), o = new y().crossVectors(n, a).normalize(), s = Math.tan(_.degToRad(i) / 2) * W, c = s * r, l = 0;
		return e.corners.forEach((e) => {
			let r = e.clone().sub(t), i = r.dot(n), u = Math.abs(r.dot(a)), d = Math.abs(r.dot(o));
			l = Math.max(l, i + u / c, i + d / s);
		}), l;
	}
	createCameraFrame(e, t, n, r) {
		let i = e.center.clone(), a = this.calculateFitDistance(e, i, t, n, r), o = this.getPortraitCameraBlend(n), s = _.lerp(Ve, K, o), c = Math.min(a, s), l = e.radius * 1.8;
		return {
			target: i,
			direction: t.clone(),
			distance: c,
			near: Math.max(.1, c - l),
			far: c + l,
			fogNear: c + e.radius * .72,
			fogFar: c + e.radius * 1.9
		};
	}
	applyPathFraming() {
		if (!this.initialCameraFrame || !this.fullCameraFrame) return;
		let e = _.smoothstep(this.framingExpansionProgress, 0, 1), t = this.initialCameraFrame.direction.clone().lerp(this.fullCameraFrame.direction, e).normalize();
		this.framingCameraTarget.lerpVectors(this.initialCameraFrame.target, this.fullCameraFrame.target, e), this.fittedCameraDistance = _.lerp(this.initialCameraFrame.distance, this.fullCameraFrame.distance, e), this.cameraTarget.copy(this.framingCameraTarget).add(this.viewportPanOffset), this.camera.position.copy(this.cameraTarget).addScaledVector(t, this.fittedCameraDistance), this.camera.lookAt(this.cameraTarget), this.camera.near = _.lerp(this.initialCameraFrame.near, this.fullCameraFrame.near, e), this.camera.far = _.lerp(this.initialCameraFrame.far, this.fullCameraFrame.far, e), this.scene.fog instanceof w && (this.scene.fog.near = _.lerp(this.initialCameraFrame.fogNear, this.fullCameraFrame.fogNear, e), this.scene.fog.far = _.lerp(this.initialCameraFrame.fogFar, this.fullCameraFrame.fogFar, e)), this.camera.updateProjectionMatrix(), this.clampViewportPanToBounds(t);
	}
	clampViewportPanToBounds(e) {
		let t = this.resolveViewportPanConstraints(), n = t.x.target, r = t.z.target, i = n - this.cameraTarget.x, a = r - this.cameraTarget.z;
		Math.abs(i) <= He && Math.abs(a) <= He || (this.viewportPanOffset.x += i, this.viewportPanOffset.z += a, this.cameraTarget.x = n, this.cameraTarget.z = r, this.camera.position.copy(this.cameraTarget).addScaledVector(e, this.fittedCameraDistance), this.camera.lookAt(this.cameraTarget), this.camera.updateMatrixWorld(!0));
	}
	resolveViewportPanConstraints() {
		this.camera.updateMatrixWorld(!0);
		let e = [
			this.intersectGroundAtNdc(-1, -1),
			this.intersectGroundAtNdc(-1, 1),
			this.intersectGroundAtNdc(1, -1),
			this.intersectGroundAtNdc(1, 1)
		].filter((e) => e !== null);
		if (e.length === 0) return {
			x: U({
				contentMin: this.cameraTarget.x,
				contentMax: this.cameraTarget.x,
				viewportMinOffset: 0,
				viewportMaxOffset: 0,
				proposedTarget: this.cameraTarget.x
			}),
			z: U({
				contentMin: this.cameraTarget.z,
				contentMax: this.cameraTarget.z,
				viewportMinOffset: 0,
				viewportMaxOffset: 0,
				proposedTarget: this.cameraTarget.z
			})
		};
		let t = e.map((e) => e.x - this.cameraTarget.x), n = e.map((e) => e.z - this.cameraTarget.z);
		return {
			x: U({
				contentMin: this.fullBounds.minX,
				contentMax: this.fullBounds.maxX,
				viewportMinOffset: Math.min(...t),
				viewportMaxOffset: Math.max(...t),
				proposedTarget: this.cameraTarget.x
			}),
			z: U({
				contentMin: this.fullBounds.minZ,
				contentMax: this.fullBounds.maxZ,
				viewportMinOffset: Math.min(...n),
				viewportMaxOffset: Math.max(...n),
				proposedTarget: this.cameraTarget.z
			})
		};
	}
	intersectGroundAtNdc(e, t) {
		this.panRaycaster.setFromCamera(new u(e, t), this.camera);
		let { origin: n, direction: r } = this.panRaycaster.ray;
		if (Math.abs(r.y) <= He) return null;
		let i = (Be - n.y) / r.y;
		return !Number.isFinite(i) || i <= 0 ? null : n.clone().addScaledVector(r, i);
	}
	applyCompositionOffset() {
		Math.abs(this.currentHorizontalCompositionOffsetPixels) <= .01 && this.currentVerticalCompositionOffsetPixels <= .01 ? this.camera.clearViewOffset() : this.camera.setViewOffset(this.viewportWidthPixels, this.viewportHeightPixels, this.currentHorizontalCompositionOffsetPixels, this.currentVerticalCompositionOffsetPixels, this.viewportWidthPixels, this.viewportHeightPixels), this.camera.updateProjectionMatrix();
	}
	createLighting() {
		let e = new N("#ffffff", "#e5e8e5", 1.24);
		e.name = "soft-hemisphere-light", this.scene.add(e);
		let t = new k("#fffdf9", 1.72);
		t.name = "key-light", t.castShadow = !0, t.shadow.mapSize.set(2048, 2048), t.shadow.camera.near = 1, t.shadow.bias = -22e-5, t.shadow.normalBias = .035, t.shadow.radius = 8, t.shadow.blurSamples = 16, this.scene.add(t, t.target), this.shadowLights.push(t), this.keyLight = t;
		let n = new k("#edf8f0", .3);
		n.name = "green-tinted-fill", this.scene.add(n), this.fillLight = n, this.updateLightingBounds();
	}
	updateLightingBounds() {
		let e = Math.max(4, Math.max(this.fullBounds.spanX, this.fullBounds.spanZ) * .78);
		if (this.keyLight) {
			this.keyLight.position.copy(this.fullBounds.center).add(new y(-e * .35, e, e * .28)), this.keyLight.target.position.copy(this.fullBounds.center), this.keyLight.target.updateMatrixWorld(), this.keyLight.shadow.camera.far = e * 2.8;
			let t = Math.max(2, Math.max(this.fullBounds.spanX, this.fullBounds.spanZ) * .72);
			this.keyLight.shadow.camera.left = -t, this.keyLight.shadow.camera.right = t, this.keyLight.shadow.camera.top = t, this.keyLight.shadow.camera.bottom = -t, this.keyLight.shadow.camera.updateProjectionMatrix(), this.keyLight.shadow.needsUpdate = !0;
		}
		this.fillLight?.position.copy(this.fullBounds.center).add(new y(e * .45, e * .38, -e * .32));
	}
	updateShadowQuality(e) {
		if (!this.keyLight) return;
		let t = e >= 1100 ? 4096 : 2048;
		this.keyLight.shadow.mapSize.width !== t && (this.keyLight.shadow.mapSize.set(t, t), this.keyLight.shadow.map?.dispose(), this.keyLight.shadow.map = null, this.keyLight.shadow.needsUpdate = !0);
	}
	getFramingFov(e) {
		let t = _.smoothstep(this.framingExpansionProgress, 0, 1), n = _.inverseLerp(_.lerp(this.initialBounds.minZ, this.fullBounds.minZ, t), _.lerp(this.initialBounds.maxZ, this.fullBounds.maxZ, t), e);
		return this.viewportBaseFov + 1.5 * (1 - n);
	}
	getBaseFov(e) {
		let t = 1 - _.smoothstep(e, .55, 1.45);
		return _.lerp(42, 62, t);
	}
	getPortraitCameraBlend(e) {
		return 1 - _.smoothstep(e, .55, 1.05);
	}
	createGround() {
		let e = new o(new D(1, 1), new c({
			color: "#fcfcfc",
			emissive: "#ffffff",
			emissiveIntensity: 1.2,
			metalness: 0,
			roughness: .94
		}));
		e.name = "matte-ground", e.rotation.x = -Math.PI / 2, e.renderOrder = -20, e.receiveShadow = !0, this.scene.add(e), this.ground = e, this.updateGroundBounds();
	}
	updateGroundBounds() {
		if (!this.ground) return;
		let e = Math.max(12, this.fullBounds.radius * .24), t = new D(this.fullBounds.spanX + e * 2, this.fullBounds.spanZ + e * 2);
		this.ground.geometry.dispose(), this.ground.geometry = t, this.ground.position.set(this.fullBounds.center.x, -.01, this.fullBounds.center.z);
	}
}, q = {
	greenTop: new S("#29b765"),
	greenSide: new S("#168f4f"),
	greenHighlight: new S("#55d789"),
	grayTop: new S("#e2e2e2"),
	graySide: new S("#e6e6e6"),
	grayHighlight: new S("#ffffff"),
	brownTop: new S("#1772f6"),
	brownSide: new S("#0d5fd1"),
	brownHighlight: new S("#4c97ff"),
	baseTop: new S("#ffffff"),
	baseSide: new S("#e4e6e5"),
	pathTop: new S("#b8cff2"),
	pathSide: new S("#91b1e3"),
	overpassSide: new S("#789ed5"),
	overpassBottom: new S("#6489c2"),
	current: new S("#ffc928")
}, Ge = .523, J = .026, Ke = .64, qe = .693, Je = .66, Ye = 24, Xe = 160, Y = 10, Ze = .18 / Y, Qe = .08 / Y, $e = .25 / Y, et = .08 / Y, tt = 0, nt = 0, rt = 1.4, it = 1.85, at = .965, ot = .24, st = .22, ct = 1.4, lt = .97, ut = .702, dt = .022, ft = .052, pt = Math.PI * 1.72, mt = .116, ht = -(Math.PI * 2) / 1.6, gt = _.degToRad(-90.4), _t = .18, vt = .96, yt = .471, bt = .007999999999999896, xt = .38, St = {
	locked: "\n    <svg viewBox=\"0 0 24 24\" xmlns=\"http://www.w3.org/2000/svg\">\n      <path d=\"M7 10V7a5 5 0 0 1 10 0v3h2v11H5V10h2zm3 0h4V7a2 2 0 0 0-4 0v3z\"/>\n    </svg>\n  ",
	available: "\n    <svg viewBox=\"0 0 24 24\" xmlns=\"http://www.w3.org/2000/svg\">\n      <path d=\"M7 4.7 20 12 7 19.3z\"/>\n    </svg>\n  ",
	"in-progress": "\n    <svg viewBox=\"0 0 24 24\" xmlns=\"http://www.w3.org/2000/svg\">\n      <path d=\"M6 3h12v3c0 2.6-1.4 4.5-3.6 6 2.2 1.5 3.6 3.4 3.6 6v3H6v-3c0-2.6 1.4-4.5 3.6-6C7.4 10.5 6 8.6 6 6V3zm3 3c0 1.6 1 2.8 3 4 2-1.2 3-2.4 3-4H9zm3 8c-2 1.2-3 2.4-3 4h6c0-1.6-1-2.8-3-4z\"/>\n    </svg>\n  ",
	completed: "\n    <svg viewBox=\"0 0 24 24\" xmlns=\"http://www.w3.org/2000/svg\">\n      <path d=\"m3.6 12.2 3-3 3.2 3.2 7.7-7.7 3 3L9.8 18.4z\"/>\n    </svg>\n  "
}, Ct = class {
	root = new x();
	pickTargets;
	nodes;
	nodeById;
	nodeViews;
	nodeViewById;
	badgeGeometryCache = /* @__PURE__ */ new Map();
	badgeGeometrySource = typeof DOMParser > "u" ? "shape-fallback" : "svg-loader";
	connectorTopMaterial = new c({
		color: q.pathTop,
		metalness: 0,
		roughness: .98,
		depthWrite: !0
	});
	connectorSideMaterial = new c({
		color: q.pathSide,
		metalness: 0,
		roughness: .93,
		depthWrite: !0
	});
	overpassSideMaterial = new c({
		color: q.overpassSide,
		metalness: 0,
		roughness: .94,
		depthWrite: !0
	});
	overpassBottomMaterial = new c({
		color: q.overpassBottom,
		metalness: 0,
		roughness: .97,
		depthWrite: !0
	});
	geometryRegistry;
	currentSpinner = this.createCurrentSpinner();
	currentIndex;
	targetIndex = null;
	currentIndicatorMode = "hidden";
	currentIndicatorReveal = 0;
	connectorRoot = new x();
	overpassDefinitions = /* @__PURE__ */ new Map();
	overpassAnimations = /* @__PURE__ */ new Map();
	straightEdgePresences = /* @__PURE__ */ new Map();
	constructor(e) {
		this.nodes = e.nodes, this.nodeById = new Map(this.nodes.map((e) => [e.id, e])), this.geometryRegistry = e.geometryRegistry, this.currentIndex = e.initialNodeIndex, this.root.name = "learning-path", this.connectorRoot.name = "path-connectors", e.edges.forEach((e) => {
			let t = this.nodeById.get(e.fromNodeId), n = this.nodeById.get(e.toNodeId);
			if (!t || !n) throw Error(`Cannot render learning-path edge "${e.id}": missing endpoint`);
			if (e.pathKind === "overpass") {
				if (this.overpassDefinitions.has(e.id)) throw Error(`Duplicate overpass learning-path edge id: ${e.id}`);
				this.overpassDefinitions.set(e.id, {
					edge: e,
					from: t,
					to: n
				});
				return;
			}
			this.connectorRoot.add(this.createConnector(e, t, n));
		}), this.root.add(this.connectorRoot), this.nodeViews = this.nodes.map((e, t) => this.createNode(e, t)), this.nodeViewById = new Map(this.nodes.map((e, t) => [e.id, this.nodeViews[t]])), this.nodeViews.forEach((e) => this.root.add(e.group)), this.pickTargets = Object.freeze(this.nodeViews.map((e) => e.hitTarget)), this.root.add(this.currentSpinner.group), this.updateCurrentButtonScale(), this.moveCurrentSpinner(e.initialNodeIndex);
	}
	resolveNodeIndex(e) {
		let t = e;
		for (; t;) {
			let e = t.userData.nodeIndex;
			if (typeof e == "number") return e;
			t = t.parent;
		}
		return null;
	}
	registerOverpass(e) {
		let t = this.overpassDefinitions.get(e.id);
		if (t) {
			if (t.edge === e || JSON.stringify(t.edge) === JSON.stringify(e)) return !1;
			throw Error(`Overpass view id "${e.id}" is already registered.`);
		}
		let n = this.nodeById.get(e.fromNodeId), r = this.nodeById.get(e.toNodeId);
		if (!n || !r) throw Error(`Cannot register overpass "${e.id}": missing endpoint.`);
		return this.geometryRegistry.registerEdge(e), this.overpassDefinitions.set(e.id, {
			edge: e,
			from: n,
			to: r
		}), !0;
	}
	setHovered(e) {
		this.nodeViews.forEach((t, n) => {
			t.hovered = t.presence.desiredVisible && t.presence.progress >= 1 - 1e-6 && n === e;
		});
	}
	setPressed(e) {
		this.nodeViews.forEach((t, n) => {
			t.pressed = t.presence.desiredVisible && t.presence.progress >= 1 - 1e-6 && n === e;
		});
	}
	setTarget(e) {
		this.targetIndex = e, e !== null && this.hideCurrentSpinner();
	}
	commitArrival(e) {
		this.nodeViews[e] && (this.currentIndex = e, this.targetIndex = null, this.updateCurrentButtonScale(), this.moveCurrentSpinner(e));
	}
	setNodeLearningState(e, t) {
		let n = this.nodeViewById.get(e);
		if (!n || (this.assertNodeLearningState(t), n.learningState.kind === t.kind && n.learningState.status === t.status)) return !1;
		let r = Object.freeze({
			kind: t.kind,
			status: t.status
		}), i = this.getToneForLearningState(r), a = this.getIconForLearningState(r);
		return n.learningState = r, n.tone = i, n.group.userData.nodeLearningState = r, this.applyNodeTone(n, i), this.applyNodeBadge(n.badge, a, i), !0;
	}
	getNodeLearningState(e) {
		let t = this.nodeViewById.get(e)?.learningState;
		return t ? Object.freeze({
			kind: t.kind,
			status: t.status
		}) : null;
	}
	getNodeLearningBadgeDebugInfo(e) {
		let t = this.nodeViewById.get(e);
		return t ? this.readNodeLearningBadgeDebugInfo(e, t) : null;
	}
	getNodeLearningBadgeDebugInfos() {
		return Object.freeze(this.nodeViews.map((e, t) => this.readNodeLearningBadgeDebugInfo(this.nodes[t].id, e)));
	}
	update(e, t, n) {
		let r = t ? 1 : 1 - Math.exp(-e * 18);
		this.nodeViews.forEach((e, t) => {
			if (!e.group.visible) {
				e.hovered = !1, e.pressed = !1;
				return;
			}
			let n = .06 + (t === this.currentIndex ? 0 : e.pressed ? -.01 : e.hovered ? .012 : 0);
			e.buttonGroup.position.y = _.lerp(e.buttonGroup.position.y, n, r);
			let i = t === this.targetIndex, a = e.hovered || i, o = e.tone === "brown" ? q.brownHighlight : e.tone === "green" ? q.greenHighlight : q.grayHighlight;
			e.topMaterial.emissive.copy(o), e.topMaterial.emissiveIntensity = a ? e.hovered ? .11 : .065 : 0;
		}), this.updateCurrentSpinner(e, t, n);
	}
	updateOverpassVisibility(e, t, n) {
		let r = typeof e == "string" ? e : this.getLegacySingleOverpassEdgeId(), i = typeof e == "string" ? t : e, a = typeof e == "string" ? n : t;
		if (!a) throw Error(`Missing overpass visibility state for "${r}"`);
		if (r === null || !this.overpassDefinitions.has(r)) return this.createMissingOverpassState(r);
		let o = this.overpassAnimations.get(r);
		if (!o && !a.desiredVisible || (o ??= this.instantiateOverpass(r), !o)) return this.createMissingOverpassState(r);
		let s = a.characterSideNodeId === o.edge.fromNodeId || a.characterSideNodeId === o.edge.toNodeId ? a.characterSideNodeId : o.characterSideNodeId, c = Object.values(o.pieces).every((e) => e.progress >= 1 - 1e-6), l = o.desiredVisible && a.desiredVisible && !c ? o.characterSideNodeId : s, u = l !== o.characterSideNodeId, d = a.desiredVisible !== o.desiredVisible;
		(u || d) && (o.transitionElapsed = 0), o.characterSideNodeId = l, o.desiredVisible = a.desiredVisible;
		let f = Math.max(0, i), p = o.transitionElapsed, m = p + f;
		o.transitionElapsed = m;
		let h = a.reducedMotion ? tt : a.desiredVisible ? Ze : $e, g = a.reducedMotion ? nt : a.desiredVisible ? Qe : et;
		this.getOrderedOverpassPieces(o).forEach((e, t) => {
			let n = t * g, r = n + h, i = h <= 0 ? 0 : Math.max(0, Math.min(m, r) - Math.max(p, n)), o = h <= 0 ? 1 : i / h;
			e.progress = a.desiredVisible ? Math.min(1, e.progress + o) : Math.max(0, e.progress - o), this.applyOverpassPieceTransform(e);
		});
		let _ = this.getOverpassAnimationState(o.edge.id);
		return !o.desiredVisible && _.status === "hidden" && this.disposeHiddenOverpassAnimation(o), _;
	}
	updateNodePresence(e, t, n) {
		let r = this.nodes.findIndex((t) => t.id === e), i = this.nodeViews[r];
		return i ? this.updatePresence(i.presence, t, n) : this.createMissingPresenceState(e);
	}
	updateNodeVisibility(e, t, n) {
		return this.updateNodePresence(e, t, n);
	}
	updateStraightEdgePresence(e, t, n) {
		let r = this.straightEdgePresences.get(e);
		return r ? this.updatePresence(r, t, n) : this.createMissingPresenceState(e);
	}
	updateStraightEdgeVisibility(e, t, n) {
		return this.updateStraightEdgePresence(e, t, n);
	}
	setNodeVisible(e, t) {
		return this.updateNodePresence(e, 0, {
			desiredVisible: t,
			reducedMotion: !0
		});
	}
	setStraightEdgeVisible(e, t) {
		return this.updateStraightEdgePresence(e, 0, {
			desiredVisible: t,
			reducedMotion: !0
		});
	}
	getCurrentIndex() {
		return this.currentIndex;
	}
	getNodeColor(e) {
		return this.nodeViews[e]?.tone ?? "gray";
	}
	getCurrentIndicatorState() {
		return {
			mode: this.currentIndicatorMode,
			visible: this.currentSpinner.group.visible,
			opacity: Number(this.currentSpinner.material.opacity.toFixed(3)),
			rotationDegrees: Number(_.radToDeg(this.currentSpinner.arcGroup.rotation.y).toFixed(2))
		};
	}
	getOverpassAnimationState(e) {
		let t = e ?? this.getLegacySingleOverpassEdgeId(), n = t === null ? void 0 : this.overpassAnimations.get(t);
		if (!n) return this.createMissingOverpassState(t);
		let r = [
			"from-approach",
			"arch",
			"to-approach"
		].map((e) => {
			let t = n.pieces[e], r = this.getOverpassPieceEasing(t.progress);
			return {
				role: e,
				visible: t.group.visible,
				progress: Number(t.progress.toFixed(3)),
				opacity: Number(r.toFixed(3)),
				yOffset: Number((t.dropHeight * (1 - r)).toFixed(3))
			};
		}), i = Object.values(n.pieces), a = i.every((e) => e.progress <= 1e-6 && !e.group.visible), o = i.every((e) => e.progress >= 1 - 1e-6), s = a ? "hidden" : o ? "visible" : n.desiredVisible ? "appearing" : "disappearing";
		return {
			edgeId: n.edge.id,
			desiredVisible: n.desiredVisible,
			characterSideNodeId: n.characterSideNodeId,
			status: s,
			pieces: r
		};
	}
	getOverpassAnimationStates() {
		return Object.freeze([...this.overpassAnimations.keys()].map((e) => this.getOverpassAnimationState(e)));
	}
	getNodePresenceState(e) {
		let t = this.nodes.findIndex((t) => t.id === e), n = this.nodeViews[t]?.presence;
		return n ? this.readPresenceState(n) : this.createMissingPresenceState(e);
	}
	getNodePresenceStates() {
		return Object.freeze(this.nodeViews.map((e) => this.readPresenceState(e.presence)));
	}
	getStraightEdgePresenceState(e) {
		let t = this.straightEdgePresences.get(e);
		return t ? this.readPresenceState(t) : this.createMissingPresenceState(e);
	}
	getStraightEdgePresenceStates() {
		return Object.freeze([...this.straightEdgePresences.values()].map((e) => this.readPresenceState(e)));
	}
	dispose() {
		let e = /* @__PURE__ */ new Set(), t = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set();
		this.root.traverse((r) => {
			r instanceof o && (e.add(r.geometry), (Array.isArray(r.material) ? r.material : [r.material]).forEach((e) => {
				t.add(e), Object.values(e).forEach((e) => {
					e instanceof ee && n.add(e);
				});
			}));
		}), t.add(this.connectorTopMaterial), t.add(this.connectorSideMaterial), t.add(this.overpassSideMaterial), t.add(this.overpassBottomMaterial), this.badgeGeometryCache.forEach((t) => e.add(t)), n.forEach((e) => e.dispose()), t.forEach((e) => e.dispose()), e.forEach((e) => e.dispose()), this.overpassDefinitions.clear(), this.overpassAnimations.clear(), this.straightEdgePresences.clear(), this.badgeGeometryCache.clear(), this.root.clear();
	}
	createPresenceAnimation(e, t, n, r) {
		let i = /* @__PURE__ */ new Set();
		t.traverse((e) => {
			e instanceof o && (Array.isArray(e.material) ? e.material : [e.material]).forEach((e) => i.add(e));
		});
		let a = {
			id: e,
			group: t,
			restingY: t.position.y,
			dropHeight: ct,
			hitTarget: n,
			materials: [...i].map((e) => {
				let t = e.opacity, n = e.depthWrite;
				return e.transparent = !0, e.needsUpdate = !0, {
					material: e,
					restingOpacity: t,
					restingDepthWrite: n
				};
			}),
			desiredVisible: r,
			progress: +!!r
		};
		return this.applyPresenceTransform(a), a;
	}
	updatePresence(e, t, n) {
		e.desiredVisible = n.desiredVisible;
		let r = Number.isFinite(n.speedMultiplier) && (n.speedMultiplier ?? 0) > 0 ? n.speedMultiplier : 1, i = n.reducedMotion ? 0 : n.desiredVisible ? ot / r : st / r, a = i <= 0 ? 1 : Math.max(0, t) / i;
		return e.progress = n.desiredVisible ? Math.min(1, e.progress + a) : Math.max(0, e.progress - a), this.applyPresenceTransform(e), !n.desiredVisible && e.id === this.nodes[this.currentIndex]?.id && this.hideCurrentSpinner(), this.readPresenceState(e);
	}
	applyPresenceTransform(e) {
		let t = _.smoothstep(e.progress, 0, 1);
		e.group.visible = e.progress > 1e-5, e.group.position.y = e.restingY + e.dropHeight * (1 - t);
		let n = _.lerp(lt, 1, t);
		e.group.scale.set(n, n, n), e.materials.forEach(({ material: e, restingOpacity: n, restingDepthWrite: r }) => {
			e.opacity = n * t, e.depthWrite = r && t >= .99999;
		});
		let r = e.desiredVisible && e.progress >= 1 - 1e-6;
		e.hitTarget && (e.hitTarget.visible = r, e.hitTarget.userData.pathNodeVisible = r, r ? e.hitTarget.layers.enable(1) : e.hitTarget.layers.disable(1));
	}
	readPresenceState(e) {
		let t = e.progress <= 1e-6, n = e.progress >= 1 - 1e-6, r = t ? "hidden" : n ? "visible" : e.desiredVisible ? "appearing" : "disappearing", i = _.smoothstep(e.progress, 0, 1);
		return {
			id: e.id,
			desiredVisible: e.desiredVisible,
			status: r,
			visible: e.group.visible,
			interactive: e.hitTarget === null ? n && e.desiredVisible : e.hitTarget.userData.pathNodeVisible === !0,
			progress: Number(e.progress.toFixed(3)),
			yOffset: Number((e.dropHeight * (1 - i)).toFixed(3))
		};
	}
	createMissingPresenceState(e) {
		return {
			id: e,
			desiredVisible: !1,
			status: "hidden",
			visible: !1,
			interactive: !1,
			progress: 0,
			yOffset: ct
		};
	}
	createMissingOverpassState(e) {
		return {
			edgeId: e,
			desiredVisible: !1,
			characterSideNodeId: null,
			status: "hidden",
			pieces: []
		};
	}
	getLegacySingleOverpassEdgeId() {
		if (this.overpassDefinitions.size > 1) throw Error("An edgeId is required when more than one overpass is registered.");
		return this.overpassDefinitions.keys().next().value ?? null;
	}
	createInitialNodeLearningState(e, t) {
		return e.variant === "brown" ? Object.freeze({
			kind: "concept",
			status: "locked"
		}) : Object.freeze({
			kind: "subject",
			status: t === this.currentIndex ? "completed" : "locked"
		});
	}
	assertNodeLearningState(e) {
		let t = e.kind, n = e.status, r = t === "subject" || t === "goal", i = t === "concept", a = n === "locked" || n === "available" || n === "completed";
		if (!(r && a || i && (a || n === "in-progress"))) throw TypeError(`Invalid node learning state: ${JSON.stringify(e)}`);
	}
	getToneForLearningState(e) {
		return e.kind === "concept" ? e.status === "in-progress" || e.status === "completed" ? "brown" : "gray" : e.status === "completed" ? "green" : "gray";
	}
	getIconForLearningState(e) {
		return e.status;
	}
	getNodeTopColor(e) {
		return e === "green" ? q.greenTop : e === "brown" ? q.brownTop : q.grayTop;
	}
	getNodeSideColor(e) {
		return e === "green" ? q.greenSide : e === "brown" ? q.brownSide : q.graySide;
	}
	getNodeTopSpecularColor(e) {
		return e === "green" ? q.greenHighlight : e === "brown" ? q.brownHighlight : q.grayTop;
	}
	getNodeBadgeColor(e, t) {
		return t === "gray" ? new S(e === "locked" ? "#747d76" : "#354139") : new S("#fffdf7");
	}
	applyNodeTone(e, t) {
		e.topMaterial.color.copy(this.getNodeTopColor(t)), e.sideMaterial.color.copy(this.getNodeSideColor(t)), e.topMaterial.clearcoat = 0, e.topMaterial.specularColor.copy(this.getNodeTopSpecularColor(t)), e.sideMaterial.specularColor.copy(this.getNodeSideColor(t));
	}
	createNodeLearningBadge(e, t) {
		let n = new x();
		n.position.y = yt, n.rotation.x = -Math.PI / 2, n.userData.nodeLearningBadge = !0;
		let r = new P({
			color: this.getNodeBadgeColor(e, t),
			transparent: !0,
			opacity: 1,
			depthTest: !0,
			depthWrite: !1,
			side: 2,
			toneMapped: !1,
			polygonOffset: !0,
			polygonOffsetFactor: -4,
			polygonOffsetUnits: -4
		}), i = new o(this.getNodeBadgeGeometry(e), r);
		return i.name = `learning-state-${e}`, i.castShadow = !1, i.receiveShadow = !1, i.renderOrder = 3, i.userData.nodeLearningBadgeIcon = e, n.add(i), {
			group: n,
			mesh: i,
			material: r,
			icon: e
		};
	}
	applyNodeBadge(e, t, n) {
		e.icon = t, e.mesh.geometry = this.getNodeBadgeGeometry(t), e.mesh.name = `learning-state-${t}`, e.mesh.userData.nodeLearningBadgeIcon = t, e.material.color.copy(this.getNodeBadgeColor(t, n));
	}
	getNodeBadgeGeometry(e) {
		let t = this.badgeGeometryCache.get(e);
		if (t) return t;
		let n;
		return n = this.badgeGeometrySource === "svg-loader" ? this.createNodeBadgeGeometryFromSvg(e) : this.createFallbackNodeBadgeGeometry(e), this.normalizeNodeBadgeGeometry(n), n.name = `node-learning-badge-${e}-${this.badgeGeometrySource}`, this.badgeGeometryCache.set(e, n), n;
	}
	createNodeBadgeGeometryFromSvg(e) {
		let t = new j().parse(St[e]).paths.flatMap((e) => e.toShapes().map((e) => new d(e, 12))), n = t.length === 1 ? t[0] : A(t, !1);
		return n ? (t.length > 1 && t.forEach((e) => e.dispose()), n) : (t.forEach((e) => e.dispose()), this.createFallbackNodeBadgeGeometry(e));
	}
	createFallbackNodeBadgeGeometry(e) {
		let t = new l();
		if (e === "available") t.moveTo(7, 4.7), t.lineTo(20, 12), t.lineTo(7, 19.3), t.closePath();
		else if (e === "completed") t.moveTo(3.6, 12.2), t.lineTo(6.6, 9.2), t.lineTo(9.8, 12.4), t.lineTo(17.5, 4.7), t.lineTo(20.5, 7.7), t.lineTo(9.8, 18.4), t.closePath();
		else if (e === "in-progress") t.moveTo(6, 3), t.lineTo(18, 3), t.lineTo(18, 6), t.lineTo(14.4, 12), t.lineTo(18, 18), t.lineTo(18, 21), t.lineTo(6, 21), t.lineTo(6, 18), t.lineTo(9.6, 12), t.lineTo(6, 6), t.closePath();
		else {
			t.moveTo(5, 10), t.lineTo(7, 10), t.lineTo(7, 7), t.absarc(12, 7, 5, Math.PI, 0, !1), t.lineTo(17, 10), t.lineTo(19, 10), t.lineTo(19, 21), t.lineTo(5, 21), t.closePath();
			let e = new s();
			e.moveTo(10, 10), e.lineTo(10, 7), e.absarc(12, 7, 2, Math.PI, 0, !1), e.lineTo(14, 10), e.closePath(), t.holes.push(e);
		}
		return new d(t, 12);
	}
	normalizeNodeBadgeGeometry(e) {
		e.scale(1, -1, 1), e.computeBoundingBox();
		let t = e.boundingBox;
		if (!t) return;
		let n = t.getCenter(new y()), r = t.getSize(new y());
		e.translate(-n.x, -n.y, -n.z);
		let i = xt / Math.max(r.x, r.y, 1e-6);
		e.scale(i, i, i), e.computeBoundingBox(), e.computeBoundingSphere();
	}
	readNodeLearningBadgeDebugInfo(e, t) {
		return Object.freeze({
			nodeId: e,
			kind: t.learningState.kind,
			status: t.learningState.status,
			tone: t.tone,
			icon: t.badge.icon,
			visible: t.group.visible && t.badge.group.visible && t.badge.mesh.visible,
			meshCount: 1,
			surfaceOffset: Number(bt.toFixed(3)),
			source: this.badgeGeometrySource,
			color: `#${t.badge.material.color.getHexString()}`
		});
	}
	createNode(e, t) {
		let n = new x();
		n.name = e.id, n.position.set(e.position.x, 0, e.position.z), n.userData.nodeIndex = t;
		let r = new v({
			color: q.baseTop,
			metalness: 0,
			roughness: .7,
			clearcoat: .12,
			clearcoatRoughness: .76
		}), i = new o(this.createRoundedCylinderGeometry(.71, .14, .06), r);
		i.name = `${e.id}-base`, i.castShadow = !1, i.receiveShadow = !0, n.add(i);
		let a = this.createInitialNodeLearningState(e, t), s = this.getToneForLearningState(a);
		n.userData.nodeLearningState = a;
		let c = new v({
			color: this.getNodeTopColor(s),
			metalness: 0,
			roughness: .52,
			clearcoat: 0,
			clearcoatRoughness: .68,
			specularIntensity: 0,
			specularColor: this.getNodeTopSpecularColor(s)
		}), l = new v({
			color: this.getNodeSideColor(s),
			metalness: 0,
			roughness: .58,
			clearcoat: 0,
			clearcoatRoughness: .78,
			specularIntensity: 0,
			specularColor: this.getNodeSideColor(s)
		}), u = new x();
		u.name = `${e.id}-button-group`, u.position.y = .06;
		let d = new o(this.createRoundedCylinderGeometry(.625, .46, .07), l);
		d.name = `${e.id}-button`, d.castShadow = !0, d.receiveShadow = !0, u.add(d);
		let f = new o(new M(.558, 64), c);
		f.name = `${e.id}-button-top`, f.rotation.x = -Math.PI / 2, f.position.y = .463, f.receiveShadow = !0, u.add(f);
		let p = this.createNodeLearningBadge(this.getIconForLearningState(a), s);
		p.group.name = `${e.id}-learning-state-badge`, u.add(p.group), n.add(u);
		let m = new o(new M(.72, 64), new P({
			color: "#787d79",
			transparent: !0,
			opacity: .08,
			depthWrite: !1
		}));
		m.name = `${e.id}-contact-shadow`, m.rotation.x = -Math.PI / 2, m.position.set(.03, .012, .045), m.renderOrder = -1, n.add(m);
		let h = new P({
			transparent: !0,
			opacity: 0,
			depthWrite: !1,
			colorWrite: !1
		}), g = new o(new C(.79, .79, .58, 24), h);
		return g.name = `${e.id}-hit-target`, g.position.y = .29, g.userData.nodeIndex = t, g.layers.set(1), n.add(g), {
			group: n,
			buttonGroup: u,
			topMaterial: c,
			sideMaterial: l,
			hitTarget: g,
			presence: this.createPresenceAnimation(e.id, n, g, e.initiallyVisible),
			badge: p,
			learningState: a,
			tone: s,
			hovered: !1,
			pressed: !1
		};
	}
	createConnector(e, t, n) {
		let r = new x();
		r.name = `connector-${e.id}`;
		let i = n.position.x - t.position.x, a = n.position.z - t.position.z, s = Math.hypot(i, a), c = -Math.atan2(a, i), l = (t.position.x + n.position.x) / 2, u = (t.position.z + n.position.z) / 2, d = this.createAnimatedMaterialCopies([this.connectorTopMaterial, this.connectorSideMaterial]), f = new o(this.createConnectorGeometry(s), d);
		if (f.position.set(l, J, u), f.rotation.y = c, f.receiveShadow = !0, f.castShadow = !1, r.add(f), this.straightEdgePresences.has(e.id)) throw Error(`Duplicate straight learning-path edge id: ${e.id}`);
		return this.straightEdgePresences.set(e.id, this.createPresenceAnimation(e.id, r, null, e.initiallyVisible)), r;
	}
	createOverpassConnector(e, t, n) {
		let r = new x();
		r.name = `connector-${e.id}`;
		let i = this.geometryRegistry.get(e.id), a = Math.max(Xe, i.lutSegments), s = n.position.x - t.position.x, c = n.position.z - t.position.z, l = Math.hypot(s, c), d = s / l, f = c / l, p = e.platformEdgeOffset + e.straightApproachLength, m = new u(t.position.x + d * p, t.position.z + f * p), h = new u(n.position.x - d * p, n.position.z - f * p), g = 0, _ = .5;
		for (let e = 0; e < 40; e += 1) {
			let e = (g + _) / 2, n = i.sample(e).position;
			(n.x - t.position.x) * d + (n.z - t.position.z) * f < p ? g = e : _ = e;
		}
		let v = (g + _) / 2, b = 1 - v, S = -Math.atan2(c, s), C = (t, n, i, a, s, c) => {
			let l = new x();
			l.name = `${e.id}-${t}-animation`, l.position.set((i.x + a.x) / 2, J, (i.y + a.y) / 2), l.rotation.y = S;
			let u = this.createAnimatedMaterialCopies([this.connectorTopMaterial, this.connectorSideMaterial], !0), d = new o(this.createConnectorGeometry(p, s, c), u);
			return d.name = n, d.receiveShadow = !0, d.castShadow = !1, l.add(d), r.add(l), this.createOverpassAnimatedPiece(t, l, u, rt);
		}, w = C("from-approach", `${e.id}-left-ground-approach`, new u(t.position.x, t.position.z), m, !0, !1), T = C("to-approach", `${e.id}-right-ground-approach`, h, new u(n.position.x, n.position.z), !1, !0), E = this.createOverpassGeometry(e, v, b, a);
		E.computeBoundingBox();
		let D = E.boundingBox?.getCenter(new y()) ?? new y();
		E.translate(-D.x, -D.y, -D.z);
		let O = this.createAnimatedMaterialCopies([
			this.connectorTopMaterial,
			this.overpassSideMaterial,
			this.overpassBottomMaterial
		]), k = new o(E, O);
		k.name = `${e.id}-symmetric-arch-deck`, k.castShadow = !0, k.receiveShadow = !0;
		let A = new x();
		A.name = `${e.id}-arch-animation`, A.position.copy(D), A.add(k), r.add(A);
		let j = this.createOverpassAnimatedPiece("arch", A, O, it);
		if (this.overpassAnimations.has(e.id)) throw Error(`Duplicate overpass learning-path edge id: ${e.id}`);
		let M = e.initiallyVisible, N = {
			edge: e,
			container: r,
			pieces: {
				"from-approach": w,
				arch: j,
				"to-approach": T
			},
			desiredVisible: M,
			characterSideNodeId: e.fromNodeId,
			transitionElapsed: 0
		};
		return Object.values(N.pieces).forEach((e) => {
			e.progress = +!!M, this.applyOverpassPieceTransform(e);
		}), this.overpassAnimations.set(e.id, N), r;
	}
	instantiateOverpass(e) {
		let t = this.overpassAnimations.get(e);
		if (t) return t;
		let n = this.overpassDefinitions.get(e);
		if (!n) return;
		let r = this.createOverpassConnector(n.edge, n.from, n.to);
		this.connectorRoot.add(r);
		let i = this.overpassAnimations.get(e);
		if (!i) throw Error(`Overpass "${e}" was not registered after instantiation.`);
		return i;
	}
	disposeHiddenOverpassAnimation(e) {
		let t = Object.values(e.pieces).every((e) => e.progress <= 1e-6 && !e.group.visible);
		if (e.desiredVisible || !t) return;
		let n = /* @__PURE__ */ new Set(), r = /* @__PURE__ */ new Set();
		e.container.traverse((e) => {
			e instanceof o && (n.add(e.geometry), (Array.isArray(e.material) ? e.material : [e.material]).forEach((e) => r.add(e)));
		}), e.container.removeFromParent(), e.container.clear(), n.forEach((e) => e.dispose()), r.forEach((e) => e.dispose()), this.overpassAnimations.delete(e.edge.id);
	}
	createAnimatedMaterialCopies(e, t = !1) {
		return e.map((e) => {
			let n = e.clone();
			return n.transparent = !0, n.opacity = 1, n.depthWrite = !0, n.polygonOffset = t, n.polygonOffsetFactor = t ? -1 : 0, n.polygonOffsetUnits = t ? -1 : 0, n.needsUpdate = !0, n;
		});
	}
	createOverpassAnimatedPiece(e, t, n, r) {
		let i = {
			role: e,
			group: t,
			materials: n,
			restingY: t.position.y,
			dropHeight: r,
			progress: 0
		};
		return this.applyOverpassPieceTransform(i), i;
	}
	getOrderedOverpassPieces(e) {
		let t = e.pieces["from-approach"], n = e.pieces["to-approach"];
		return e.characterSideNodeId === e.edge.toNodeId ? [
			n,
			e.pieces.arch,
			t
		] : [
			t,
			e.pieces.arch,
			n
		];
	}
	getOverpassPieceEasing(e) {
		return _.smoothstep(e, 0, 1);
	}
	applyOverpassPieceTransform(e) {
		let t = this.getOverpassPieceEasing(e.progress);
		e.group.visible = e.progress > 1e-5, e.group.position.y = e.restingY + e.dropHeight * (1 - t);
		let n = _.lerp(at, 1, t);
		e.group.scale.set(n, n, n), e.materials.forEach((e) => {
			e.opacity = t, e.depthWrite = t >= .99999;
		});
	}
	createOverpassGeometry(e, t, n, r) {
		let i = this.geometryRegistry.get(e.id), a = e.width / 2, o = [], s = new y();
		for (let c = 0; c <= r; c += 1) {
			let l = _.lerp(t, n, c / r), u = i.sample(l), d = new y(u.position.x, u.position.y, u.position.z), f = new y(-u.tangent.z, 0, u.tangent.x);
			f.lengthSq() < 1e-10 ? f.copy(s.lengthSq() > 0 ? s : new y(0, 0, 1)) : (f.normalize(), s.lengthSq() > 0 && f.dot(s) < 0 && f.multiplyScalar(-1)), s.copy(f);
			let p = f.multiplyScalar(a), m = d.clone().add(p), h = d.clone().sub(p), g = new y(0, e.deckThickness, 0);
			o.push({
				topLeft: m,
				topRight: h,
				bottomLeft: m.clone().sub(g),
				bottomRight: h.clone().sub(g)
			});
		}
		let c = [], l = [], u = [], d = [], f = (e) => {
			let t = c.length / 3;
			return c.push(e.x, e.y, e.z), t;
		}, p = o.map((e) => ({
			left: f(e.topLeft),
			right: f(e.topRight)
		}));
		for (let e = 0; e < r; e += 1) {
			let t = p[e], n = p[e + 1];
			l.push(t.left, n.left, n.right, t.left, n.right, t.right);
		}
		let m = o.map((e) => ({
			top: f(e.topLeft),
			bottom: f(e.bottomLeft)
		})), h = o.map((e) => ({
			top: f(e.topRight),
			bottom: f(e.bottomRight)
		}));
		for (let e = 0; e < r; e += 1) {
			let t = m[e], n = m[e + 1];
			u.push(t.top, t.bottom, n.bottom, t.top, n.bottom, n.top);
			let r = h[e], i = h[e + 1];
			u.push(r.top, i.top, i.bottom, r.top, i.bottom, r.bottom);
		}
		let g = o.map((e) => ({
			left: f(e.bottomLeft),
			right: f(e.bottomRight)
		}));
		for (let e = 0; e < r; e += 1) {
			let t = g[e], n = g[e + 1];
			d.push(t.left, t.right, n.right, t.left, n.right, n.left);
		}
		let v = o[0], b = f(v.topLeft), x = f(v.topRight), S = f(v.bottomRight), C = f(v.bottomLeft);
		u.push(b, x, S, b, S, C);
		let w = o[o.length - 1], E = f(w.topLeft), D = f(w.bottomLeft), k = f(w.bottomRight), A = f(w.topRight);
		u.push(E, D, k, E, k, A);
		let j = [
			...l,
			...u,
			...d
		], M = new O();
		return M.setAttribute("position", new T(c, 3)), M.setIndex(j), M.addGroup(0, l.length, 0), M.addGroup(l.length, u.length, 1), M.addGroup(l.length + u.length, d.length, 2), M.computeVertexNormals(), M.computeBoundingBox(), M.computeBoundingSphere(), M;
	}
	createConnectorGeometry(e, t = !0, n = !0) {
		let r = [], i = [], a = e / 2, o = Ke / 2, s = (e, t, n, r) => {
			e.push(...t, ...n, ...r);
		}, c = (e, t, n, r, i) => {
			s(e, t, n, r), s(e, t, r, i);
		}, l = (e, t) => Math.sqrt(Math.max(0, e * e - t * t)), u = [], d = [], f = [], p = [];
		for (let e = 0; e <= Ye; e += 1) {
			let r = _.lerp(-.32, o, e / Ye), i = l(qe, r), s = l(Je, r);
			u.push([
				-a + (t ? i : 0),
				0,
				r
			]), d.push([
				a - (n ? i : 0),
				0,
				r
			]), f.push([
				-a + (t ? s : 0),
				-.038,
				r
			]), p.push([
				a - (n ? s : 0),
				-.038,
				r
			]);
		}
		for (let e = 0; e < Ye; e += 1) {
			let t = e + 1, n = u[e], a = d[e], o = u[t], s = d[t], l = f[e], m = p[e], h = f[t], g = p[t];
			c(r, n, o, s, a), c(i, l, m, g, h), c(i, n, l, h, o), c(i, a, s, g, m);
		}
		let m = u[0], h = d[0], g = f[0], v = p[0];
		c(i, m, h, v, g);
		let y = Ye, b = u[y], x = d[y], S = f[y], C = p[y];
		c(i, b, S, C, x);
		let w = [...r, ...i], E = new O();
		return E.setAttribute("position", new T(w, 3)), E.addGroup(0, r.length / 3, 0), E.addGroup(r.length / 3, i.length / 3, 1), E.computeVertexNormals(), E.computeBoundingBox(), E.computeBoundingSphere(), E;
	}
	createRoundedCylinderGeometry(e, t, n) {
		let r = [new u(0, 0)], i = e - n;
		for (let e = 0; e <= 5; e += 1) {
			let t = -Math.PI / 2 + e / 5 * (Math.PI / 2);
			r.push(new u(i + Math.cos(t) * n, n + Math.sin(t) * n));
		}
		for (let e = 0; e <= 5; e += 1) {
			let a = e / 5 * (Math.PI / 2);
			r.push(new u(i + Math.cos(a) * n, t - n + Math.sin(a) * n));
		}
		return r.push(new u(0, t)), new F(r, 48);
	}
	createCurrentSpinner() {
		let e = new x();
		e.name = "current-node-ring", e.visible = !1;
		let t = new x();
		t.name = "idle-spinner-arc", t.rotation.y = gt;
		let n = new v({
			color: q.current,
			emissive: q.current,
			emissiveIntensity: .12,
			metalness: 0,
			roughness: .36,
			clearcoat: .16,
			clearcoatRoughness: .58,
			specularIntensity: .3,
			specularColor: q.current,
			transparent: !0,
			opacity: 0,
			depthTest: !0,
			depthWrite: !1
		}), r = new b(ut, dt, 16, 96, pt);
		r.rotateX(Math.PI / 2);
		let i = new o(r, n);
		i.name = "idle-spinner-ring", i.castShadow = !1, t.add(i);
		let a = new g(dt, 16, 12), s = new o(a, n);
		s.name = "idle-spinner-start-cap", s.position.set(ut, 0, 0), s.castShadow = !1, t.add(s);
		let c = new g(ft, 18, 14), l = new o(c, n);
		return l.name = "idle-spinner-end-cap", l.position.set(Math.cos(pt) * ut, 0, Math.sin(pt) * ut), l.castShadow = !1, t.add(l), e.add(t), {
			group: e,
			arcGroup: t,
			material: n
		};
	}
	moveCurrentSpinner(e) {
		let t = this.nodes[e];
		t && this.currentSpinner.group.position.set(t.position.x, mt, t.position.z);
	}
	updateCurrentSpinner(e, t, n) {
		if (!n) {
			this.hideCurrentSpinner();
			return;
		}
		this.currentSpinner.group.visible || (this.currentSpinner.group.visible = !0, this.currentSpinner.arcGroup.rotation.y = gt, this.currentIndicatorReveal = +!!t), t ? (this.currentIndicatorMode = "static", this.currentIndicatorReveal = 1) : (this.currentIndicatorMode = "spinning", this.currentIndicatorReveal = Math.min(1, this.currentIndicatorReveal + e / _t), this.currentSpinner.arcGroup.rotation.y = _.euclideanModulo(this.currentSpinner.arcGroup.rotation.y + ht * e + Math.PI, Math.PI * 2) - Math.PI);
		let r = _.smoothstep(this.currentIndicatorReveal, 0, 1);
		this.currentSpinner.material.opacity = r * vt;
	}
	hideCurrentSpinner() {
		this.currentIndicatorMode = "hidden", this.currentIndicatorReveal = 0, this.currentSpinner.material.opacity = 0, this.currentSpinner.group.visible = !1;
	}
	updateCurrentButtonScale() {
		this.nodeViews.forEach((e) => {
			e.buttonGroup.scale.set(1, 1, 1);
		});
	}
}, wt = class {
	rig;
	listeners = /* @__PURE__ */ new Set();
	lastPhase = null;
	lastVisuallyIdle = null;
	sequence = 0;
	disposed = !1;
	constructor(e, t) {
		this.rig = e, t && this.listeners.add(t);
	}
	subscribe(e) {
		if (this.disposed) throw Error("Cannot subscribe to a disposed XStateCharacterAdapter.");
		return this.listeners.add(e), () => this.listeners.delete(e);
	}
	frame() {
		if (this.disposed) return null;
		let e = this.rig.getAnimationPhase(), t = this.rig.isVisuallyIdle();
		if (e === this.lastPhase && t === this.lastVisuallyIdle) return null;
		this.lastPhase = e, this.lastVisuallyIdle = t;
		let n = {
			type: "CHARACTER.PHASE",
			phase: e,
			visuallyIdle: t,
			sequence: this.nextSequence()
		};
		return this.emit(n), n;
	}
	reportFailure(e) {
		if (this.disposed) return null;
		let t = {
			type: "CHARACTER.FAILED",
			error: e instanceof Error ? e.message : String(e),
			sequence: this.nextSequence()
		};
		return this.emit(t), t;
	}
	dispose() {
		if (this.disposed) return null;
		this.disposed = !0;
		let e = {
			type: "CHARACTER.DISPOSED",
			sequence: this.nextSequence()
		};
		return this.emit(e), this.listeners.clear(), e;
	}
	getLastObservedPhase() {
		return this.lastPhase;
	}
	nextSequence() {
		return this.sequence += 1, this.sequence;
	}
	emit(e) {
		this.listeners.forEach((t) => t(e));
	}
}, Tt = class {
	view;
	nodeById;
	edgeById;
	intents = /* @__PURE__ */ new Map();
	commandOwnerById = /* @__PURE__ */ new Map();
	commandIntentById = /* @__PURE__ */ new Map();
	pendingFaultDelays = /* @__PURE__ */ new Set();
	listeners = /* @__PURE__ */ new Set();
	reducedMotion;
	faultInjection;
	disposed = !1;
	constructor(e) {
		this.view = e.view, this.nodeById = this.createUniqueCatalog(e.nodes, "node"), this.edgeById = this.createUniqueCatalog(e.edges, "edge"), this.reducedMotion = e.reducedMotion ?? !1, this.faultInjection = e.faultInjection ?? H, e.onEvent && this.listeners.add(e.onEvent);
	}
	subscribe(e) {
		return this.disposed ? () => void 0 : (this.listeners.add(e), () => this.listeners.delete(e));
	}
	setReducedMotion(e) {
		this.reducedMotion = e;
	}
	registerEdge(e) {
		this.assertNotDisposed();
		let t = this.edgeById.get(e.id);
		if (t) {
			if (t === e || JSON.stringify(t) === JSON.stringify(e)) return !1;
			throw Error(`Presentation edge id "${e.id}" is already registered.`);
		}
		if (!this.nodeById.has(e.fromNodeId) || !this.nodeById.has(e.toNodeId)) throw Error(`Presentation overpass "${e.id}" has a missing endpoint.`);
		return this.view.registerOverpass(e), this.edgeById.set(e.id, e), !0;
	}
	cancelTransaction(e) {
		this.intents.forEach((t, n) => {
			t.command.transactionId === e && this.retireIntent(t, n);
		}), this.cancelPendingFaultDelays((t) => t.transactionId === e);
	}
	isCurrentCommand(e, t, n) {
		let r = this.getObjectKey(t, n);
		return this.intents.get(r)?.command.commandId === e;
	}
	command(e) {
		this.assertNotDisposed(), this.validateCommand(e);
		let t = this.getObjectKey(e.objectKind, e.objectId), n = this.commandOwnerById.get(e.commandId);
		if (n && n !== t) throw Error(`Presentation commandId "${e.commandId}" already belongs to ${n}; it cannot be reused for ${t}.`);
		let r = this.intents.get(t);
		r && this.retireIntent(r, t), this.commandOwnerById.set(e.commandId, t);
		let i = {
			command: e,
			characterSideNodeId: e.objectKind === "overpass" ? this.resolveCharacterSideNodeId(e) : null,
			acknowledged: !1,
			blocked: !1,
			lastPhase: null
		};
		if (this.intents.set(t, i), this.commandIntentById.set(e.commandId, i), this.publishEvent(this.createStartedEvent(i)), this.disposed || this.intents.get(t) !== i) return;
		let a = this.faultInjection.decide({
			point: ge.PRESENTATION_COMMAND,
			operation: e.operationId,
			attempt: e.attempt,
			transactionId: e.transactionId,
			metadata: {
				commandId: e.commandId,
				objectId: e.objectId
			}
		});
		a.kind === "throw" ? (i.acknowledged = !0, this.publishEvent(this.createFailedEvent(i, Error(a.message)), i)) : a.kind === "drop" || a.kind === "stall" ? i.blocked = !0 : a.kind === "delay" && (i.blocked = !0, this.scheduleFaultDelay(i, a.delayMs, () => {
			let e = this.intents.get(t);
			e === i && (e.blocked = !1);
		}));
	}
	frame(e) {
		let t = [], n = Number.isFinite(e) ? Math.max(0, e) : 0;
		return this.intents.forEach((e) => {
			if (e.blocked || e.acknowledged) return;
			let { command: r } = e;
			try {
				if (r.objectKind === "platform") {
					let i = this.view.updateNodeVisibility(r.objectId, n, {
						desiredVisible: r.visible,
						reducedMotion: this.reducedMotion
					});
					this.collectPresenceTerminal(e, i, t);
					return;
				}
				if (r.objectKind === "long-road") {
					let i = this.view.updateStraightEdgeVisibility(r.objectId, n, {
						desiredVisible: r.visible,
						reducedMotion: this.reducedMotion
					});
					this.collectPresenceTerminal(e, i, t);
					return;
				}
				let i = this.view.updateOverpassVisibility(r.objectId, n, {
					desiredVisible: r.visible,
					characterSideNodeId: e.characterSideNodeId,
					reducedMotion: this.reducedMotion
				});
				this.collectOverpassPhase(e, i, t), this.collectOverpassTerminal(e, i, t);
			} catch (n) {
				e.acknowledged = !0, t.push(this.createFailedEvent(e, n));
			}
		}), t.forEach((e) => {
			let t = e.type === "PRESENTATION.SETTLED" || e.type === "PRESENTATION.FAILED" ? this.findIntentForEvent(e) : void 0;
			this.publishEvent(e, t);
		}), Object.freeze(t);
	}
	getActiveCommands() {
		return Object.freeze([...this.intents.values()].map((e) => e.command));
	}
	dispose() {
		this.disposed || (this.disposed = !0, this.cancelPendingFaultDelays(() => !0), this.intents.clear(), this.commandOwnerById.clear(), this.commandIntentById.clear(), this.listeners.clear());
	}
	collectPresenceTerminal(e, t, n) {
		if (t.id !== e.command.objectId) throw Error(`LearningPathView returned presence "${t.id}" for requested "${e.command.objectId}".`);
		let r = e.command.visible ? "visible" : "hidden";
		!e.acknowledged && t.status === r && (e.acknowledged = !0, this.collectAckWithFault(e, this.createSettledEvent(e, r), n));
	}
	collectOverpassTerminal(e, t, n) {
		if (t.edgeId !== e.command.objectId) throw Error(`LearningPathView returned overpass "${t.edgeId ?? "null"}" for requested "${e.command.objectId}".`);
		let r = e.command.visible ? "visible" : "hidden";
		!e.acknowledged && t.status === r && (e.acknowledged = !0, this.collectAckWithFault(e, this.createSettledEvent(e, r), n));
	}
	collectOverpassPhase(e, t, n) {
		let r = this.resolveOverpassPhase(e, t);
		r !== e.lastPhase && (e.lastPhase = r, n.push({
			type: "PRESENTATION.PHASE",
			commandId: e.command.commandId,
			transactionId: e.command.transactionId,
			operationId: e.command.operationId,
			attempt: e.command.attempt,
			objectKind: "overpass",
			objectId: e.command.objectId,
			phase: r,
			metadata: e.command.metadata
		}));
	}
	createSettledEvent(e, t) {
		return {
			type: "PRESENTATION.SETTLED",
			commandId: e.command.commandId,
			transactionId: e.command.transactionId,
			operationId: e.command.operationId,
			attempt: e.command.attempt,
			objectKind: e.command.objectKind,
			objectId: e.command.objectId,
			terminal: t,
			metadata: e.command.metadata
		};
	}
	collectAckWithFault(e, t, n) {
		let r = this.faultInjection.decide({
			point: ge.PRESENTATION_ACK,
			operation: e.command.operationId,
			attempt: e.command.attempt,
			transactionId: e.command.transactionId,
			metadata: {
				commandId: e.command.commandId,
				objectId: e.command.objectId
			}
		});
		if (r.kind === "pass") {
			n.push(t);
			return;
		}
		if (r.kind === "throw") {
			n.push(this.createFailedEvent(e, Error(r.message)));
			return;
		}
		r.kind === "delay" && this.scheduleFaultDelay(e, r.delayMs, () => {
			let n = this.getObjectKey(e.command.objectKind, e.command.objectId);
			this.intents.get(n) === e && this.publishEvent(t, e);
		});
	}
	createStartedEvent(e) {
		let { command: t } = e;
		return {
			type: "PRESENTATION.STARTED",
			commandId: t.commandId,
			transactionId: t.transactionId,
			operationId: t.operationId,
			attempt: t.attempt,
			objectKind: t.objectKind,
			objectId: t.objectId,
			metadata: t.metadata
		};
	}
	createFailedEvent(e, t) {
		let { command: n } = e;
		return {
			type: "PRESENTATION.FAILED",
			commandId: n.commandId,
			transactionId: n.transactionId,
			operationId: n.operationId,
			attempt: n.attempt,
			objectKind: n.objectKind,
			objectId: n.objectId,
			error: t instanceof Error ? t.message : String(t),
			metadata: n.metadata
		};
	}
	publishEvent(e, t) {
		try {
			if (this.disposed) return;
			for (let t of [...this.listeners]) {
				if (this.disposed) break;
				t(e);
			}
		} finally {
			t && this.retireIntent(t);
		}
	}
	findIntentForEvent(e) {
		let t = this.getObjectKey(e.objectKind, e.objectId), n = this.intents.get(t);
		return n?.command.commandId === e.commandId ? n : void 0;
	}
	scheduleFaultDelay(e, t, n) {
		if (this.disposed) return;
		let r, i = globalThis.setTimeout(() => {
			this.pendingFaultDelays.delete(r), !this.disposed && n();
		}, t);
		r = {
			commandId: e.command.commandId,
			transactionId: e.command.transactionId,
			intent: e,
			handle: i
		}, this.pendingFaultDelays.add(r);
	}
	cancelPendingFaultDelays(e) {
		[...this.pendingFaultDelays].forEach((t) => {
			e(t) && (globalThis.clearTimeout(t.handle), this.pendingFaultDelays.delete(t));
		});
	}
	retireIntent(e, t = this.getObjectKey(e.command.objectKind, e.command.objectId)) {
		this.intents.get(t) === e && this.intents.delete(t), this.cancelPendingFaultDelays((t) => t.intent === e), this.commandIntentById.get(e.command.commandId) === e && (this.commandOwnerById.delete(e.command.commandId), this.commandIntentById.delete(e.command.commandId));
	}
	assertNotDisposed() {
		if (this.disposed) throw Error("XStatePresentationCoordinator is disposed.");
	}
	resolveOverpassPhase(e, t) {
		if (t.status === "visible" || t.status === "hidden") return "none";
		let n = this.getOrderedPieceRoles(e.characterSideNodeId, e.command.objectId), r = new Map(t.pieces.map((e) => [e.role, e])), i = (t) => {
			let n = r.get(t)?.progress;
			return n === void 0 ? !1 : e.command.visible ? n > 1e-6 : n < 1 - 1e-6;
		};
		return i(n[2]) ? "second-short-road" : i(n[1]) ? "arch" : "first-short-road";
	}
	getOrderedPieceRoles(e, t) {
		return e === this.getOverpassEdge(t).toNodeId ? [
			"to-approach",
			"arch",
			"from-approach"
		] : [
			"from-approach",
			"arch",
			"to-approach"
		];
	}
	resolveCharacterSideNodeId(e) {
		let t = this.getOverpassEdge(e.objectId), n = [t.fromNodeId, t.toNodeId];
		if (e.order === "world-left-to-right") return this.getWorldOrderedEndpoint(n, !0);
		if (e.order === "world-right-to-left") return this.getWorldOrderedEndpoint(n, !1);
		let r = e.order === "source-to-target" ? "sourceNodeId" : "targetNodeId", i = e.metadata[r];
		if (typeof i != "string" || !n.includes(i)) throw Error(`Overpass ${e.order} command "${e.commandId}" requires metadata.${r} to be one of ${n.join(", ")}.`);
		return i;
	}
	getWorldOrderedEndpoint(e, t) {
		let [n, r] = e, i = this.nodeById.get(n), a = this.nodeById.get(r);
		if (!i || !a) throw Error(`Overpass endpoint catalog is incomplete: ${n}, ${r}.`);
		return i.position.x === a.position.x ? t ? n : r : t === i.position.x < a.position.x ? n : r;
	}
	validateCommand(e) {
		if (e.commandId.trim().length === 0) throw Error("Presentation commandId must not be empty.");
		if (e.objectKind === "platform") {
			if (!this.nodeById.has(e.objectId)) throw Error(`Unknown platform id "${e.objectId}".`);
			return;
		}
		let t = this.edgeById.get(e.objectId);
		if (!t) throw Error(`Unknown ${e.objectKind} id "${e.objectId}".`);
		let n = e.objectKind === "long-road" ? "straight" : "overpass";
		if (t.pathKind !== n) throw Error(`Presentation object "${e.objectId}" is ${t.pathKind}, not ${e.objectKind}.`);
	}
	getOverpassEdge(e) {
		let t = this.edgeById.get(e);
		if (!t || t.pathKind !== "overpass") throw Error(`Unknown overpass id "${e}".`);
		return t;
	}
	getObjectKey(e, t) {
		return `${e}:${t}`;
	}
	createUniqueCatalog(e, t) {
		let n = /* @__PURE__ */ new Map();
		return e.forEach((e) => {
			if (n.has(e.id)) throw Error(`Duplicate ${t} id "${e.id}".`);
			n.set(e.id, e);
		}), n;
	}
}, Et = class {
	coordinator;
	simulation;
	pathView;
	character;
	edgeById;
	presentation;
	characterAdapter;
	diagnosticLedger;
	sceneRuntimePort;
	sceneRuntimeCommandSink;
	pendingCharacterSettles = /* @__PURE__ */ new Map();
	deferredPresentations = /* @__PURE__ */ new Map();
	onPhysicalArrival;
	onPresentationSettled;
	onNavigationSettled;
	onNavigationRejected;
	onTransition;
	faultInjection;
	presentationAckTimeoutSeconds;
	motionRouteTimeoutMs;
	characterNaturalSettleTimeoutMs;
	characterForceSettleAckTimeoutMs;
	recoveryBoundaryStore;
	actor = null;
	orchestrationBinding;
	stopArrivalSubscription;
	stopPresentationSubscription;
	stopCharacterSubscription;
	motionDeliveryLease = null;
	activeRecoveryInput = null;
	activeRecoveryCommand = null;
	lastExecutedRecoveryAttemptId = null;
	recoverySessionRevision;
	zoneRevealFailureLatchNodeId = null;
	occupiedOverpassId = null;
	lastVisualIdleToken = null;
	reducedMotion;
	lastCharacterWatchdogTimeoutCount = 0;
	disposed = !1;
	constructor(e) {
		this.coordinator = e.coordinator, this.recoveryBoundaryStore = new ae({
			captureCheckpoint: () => this.coordinator.createRecoveryCheckpoint(),
			restoreCheckpoint: (e) => {
				this.coordinator.restoreRecoveryCheckpoint(e);
			},
			discardPendingAfterRecovery: () => {
				this.coordinator.discardPendingTransactionsAfterRecovery();
			}
		}), this.simulation = e.simulation, this.pathView = e.pathView, this.character = e.character, this.faultInjection = e.faultInjection ?? H, this.presentationAckTimeoutSeconds = e.presentationAckTimeoutSeconds ?? .8, this.motionRouteTimeoutMs = (e.motionTimeoutSeconds ?? 12) * 1e3;
		let t = (e.characterSettleTimeoutSeconds ?? 1.2) * 1e3;
		if (this.characterNaturalSettleTimeoutMs = e.characterNaturalSettleTimeoutMs ?? t, this.characterForceSettleAckTimeoutMs = e.characterForceSettleAckTimeoutMs ?? t, this.recoverySessionRevision = e.sessionRevision ?? 1, !Number.isSafeInteger(this.recoverySessionRevision) || this.recoverySessionRevision < 0) throw Error("sessionRevision must be a non-negative safe integer.");
		this.reducedMotion = e.reducedMotion ?? !1, this.onPhysicalArrival = e.onPhysicalArrival, this.onPresentationSettled = e.onPresentationSettled, this.onNavigationSettled = e.onNavigationSettled, this.onNavigationRejected = e.onNavigationRejected, this.onTransition = e.onTransition, this.edgeById = this.createUniqueCatalog(e.edges, "edge"), this.diagnosticLedger = new L({
			nodes: e.nodes,
			edges: e.edges,
			initialCharacterPhase: this.character.getAnimationPhase(),
			initiallyCharacterVisuallyIdle: this.character.isVisuallyIdle()
		}), this.characterAdapter = new wt(this.character), this.stopCharacterSubscription = this.characterAdapter.subscribe((e) => {
			this.diagnosticLedger.acceptCharacterEvent(e), e.type === "CHARACTER.PHASE" && e.visuallyIdle ? this.settlePendingCharacterCommands() : e.type === "CHARACTER.FAILED" && this.failPendingCharacterCommands(e.error), e.type === "CHARACTER.PHASE" ? ((!e.visuallyIdle || this.motionDeliveryLease === null) && this.actor?.send({
				type: "ORCHESTRATION.CHARACTER.VISUAL_IDLE_CHANGED",
				visuallyIdle: e.visuallyIdle
			}), e.visuallyIdle && (this.publishVisualIdleIfReady(), this.acknowledgeRecoveryCharacterIdle())) : e.type === "CHARACTER.FAILED" ? this.actor?.send({
				type: "ORCHESTRATION.CHARACTER.FAILED",
				error: e.error
			}) : this.actor?.send({
				type: "ORCHESTRATION.CHARACTER.VISUAL_IDLE_CHANGED",
				visuallyIdle: !1
			});
		}), this.presentation = new Tt({
			view: e.pathView,
			nodes: e.nodes,
			edges: e.edges,
			reducedMotion: this.reducedMotion,
			faultInjection: this.faultInjection
		}), this.stopPresentationSubscription = this.presentation.subscribe((e) => {
			this.handlePresentationEvent(e);
		}), this.sceneRuntimePort = new I({
			executePresentation: (e) => {
				let t = this.requireDomainPresentationPayload(e);
				return this.executePresentation(t), {
					disposition: this.deferredPresentations.has(t.token) ? "deferred" : "accepted",
					deferredReason: this.deferredPresentations.get(t.token)?.reason,
					cancel: () => this.cancelPresentationDelivery(e.transactionId)
				};
			},
			cancelPresentationTransaction: (e) => {
				this.cancelPresentationDelivery(e.transactionId);
			},
			executeMotion: (e) => {
				let t = this.requireMotionPayload(e);
				return this.executeMotion(t), {
					disposition: "accepted",
					cancel: () => this.abortMotionDelivery(t)
				};
			},
			abortMotion: (e) => {
				let t = this.motionDeliveryLease;
				t && t.command.transactionId === e.transactionId && t.command.operationId === e.operationId && this.abortMotionDelivery(t.command);
			},
			forceSettleCharacter: (e) => this.forceSettleCharacter(e)
		}), this.sceneRuntimeCommandSink = e.sceneRuntimeCommandSink ?? ((e) => {
			throw Error(`Scene runtime command route is not bound for ${e.type}.`);
		});
		let n = {
			planNavigation: (e, t) => this.planNavigationWithRecovery(e, t),
			planZoneReveal: (e) => this.planZoneRevealWithRecovery(e),
			planZoneDismiss: (e) => this.planZoneDismissWithRecovery(e),
			commitNavigationBeforeAction: (e, t, n) => {
				this.coordinator.commitNavigationBeforeAction(e, t, n);
			},
			commitNavigationStageStarted: (e, t) => {
				this.coordinator.commitNavigationStageStarted(e, t);
			},
			commitNavigationAfterAction: (e, t, n, r) => {
				this.coordinator.commitNavigationAfterAction(e, t, n, r);
			},
			commitNavigationStageArrived: (e, t, n) => {
				this.coordinator.commitNavigationStageArrived(e, t, n);
				let r = this.recoveryBoundaryStore.getSnapshot()?.transactionId;
				r && this.recoveryBoundaryStore.advance(n, r);
			},
			cancelNavigationPlan: (e) => this.coordinator.cancelNavigationPlan(e),
			commitZoneRevealBeforeAction: (e, t) => {
				this.coordinator.commitZoneRevealBeforeAction(e, t);
			},
			commitZoneRevealStep: (e, t) => {
				this.coordinator.commitZoneRevealStep(e, t);
			},
			commitZoneDismissStep: (e, t) => {
				this.coordinator.commitZoneDismissStep(e, t);
			},
			executePresentation: (e) => this.issuePresentationCommand(e),
			executeMotion: (e) => this.issueMotionCommand(e),
			executeCharacterForceSettle: (e) => {
				this.issueCharacterForceSettleCommand(e);
			},
			characterNaturalSettleTimeoutMs: this.characterNaturalSettleTimeoutMs,
			characterForceSettleAckTimeoutMs: this.characterForceSettleAckTimeoutMs,
			prepareRecoveryInput: (e) => this.prepareRecoveryInput(e),
			executeRecoveryCommand: (e) => this.executeRecoveryCommand(e),
			finalizeRecovery: (e, t) => {
				this.finalizeRecovery(e, t);
			},
			cancelRecovery: (e) => this.cancelRecoveryAdapter(e),
			recoveryCommandTimeoutMs: this.presentationAckTimeoutSeconds * 1e3,
			recoveryCharacterIdleTimeoutMs: this.characterNaturalSettleTimeoutMs + this.characterForceSettleAckTimeoutMs,
			onOperationRetry: (e) => {
				this.emitTransition("operation-retrying", e.operationId, `attempt=${e.nextAttempt}; ${e.reason}`);
			},
			onNavigationTransactionSettled: (e) => {
				this.motionDeliveryLease?.command.navigationPlanId === e.planId && (this.motionDeliveryLease = null);
				let t = this.recoveryBoundaryStore.getSnapshot();
				!this.activeRecoveryInput && t?.transactionId === e.transactionId ? this.recoveryBoundaryStore.complete(e.transactionId) : !this.activeRecoveryInput && t?.transactionId === null && this.recoveryBoundaryStore.reset();
			},
			onNavigationSettled: (e) => {
				this.emitTransition("navigation-settled", e.planId, e.nodeId), this.onNavigationSettled?.(e);
			},
			onStandaloneZoneTransactionSettled: ({ transactionId: e, kind: t }) => {
				!this.activeRecoveryInput && this.recoveryBoundaryStore.getSnapshot()?.transactionId === e && this.recoveryBoundaryStore.complete(e), this.emitTransition("zone-transaction-settled", e, t);
			},
			onNavigationRejected: (e) => {
				this.emitTransition("navigation-rejected", e.targetNodeId, e.detail), this.onNavigationRejected?.(e);
			}
		};
		this.orchestrationBinding = Object.freeze({
			input: Object.freeze({
				initialNodeId: e.initialNodeId,
				initialCharacterVisualIdle: this.character.isVisuallyIdle(),
				initialZoneStatus: "inactive"
			}),
			services: n,
			bindActor: (e) => {
				if (this.disposed) throw Error("Cannot bind a disposed learning-path runtime.");
				if (this.actor && this.actor !== e) throw Error("Learning-path runtime is already bound to another orchestration actor.");
				this.actor = e;
			},
			unbindActor: (e) => {
				e && this.actor !== e || (this.actor = null);
			}
		}), this.stopArrivalSubscription = this.simulation.onArrival((e) => {
			this.handlePhysicalArrival(e);
		});
	}
	requestNavigation(e) {
		this.assertLive(), this.completeRecoveryBoundaryIfStable(), e !== this.zoneRevealFailureLatchNodeId && (this.zoneRevealFailureLatchNodeId = null), this.requireOrchestrationActor().send({
			type: "NAVIGATION.REQUESTED",
			targetNodeId: e
		});
	}
	frame(e) {
		if (this.disposed) return;
		let t = Number.isFinite(e) ? Math.max(0, e) : 0;
		this.syncOccupiedOverpass(), this.flushDeferredPresentations(), this.presentation.frame(t), this.characterAdapter.frame(), this.publishVisualIdleIfReady(), this.acknowledgeRecoveryCharacterIdle(), this.observeMotionFaultPoint(), this.observeCharacterWatchdogRecovery(), this.completeRecoveryBoundaryIfStable(), this.driveIdleZoneRules();
	}
	setReducedMotion(e) {
		this.assertLive(), this.reducedMotion = e, this.presentation.setReducedMotion(e);
		let t = this.motionDeliveryLease;
		if (!(!e || !t || !this.simulation.getSnapshot().isRunning) && (t.expectedRouteRevision = this.simulation.getSnapshot().routeRevision + 1, !this.simulation.moveImmediatelyTo(t.command.toNodeId))) throw Error(`Cannot complete reduced-motion route to "${t.command.toNodeId}".`);
	}
	reportCharacterFailure(e) {
		this.assertLive(), this.characterAdapter.reportFailure(e);
	}
	getSnapshot() {
		return this.requireOrchestrationActor().getSnapshot();
	}
	isPathOrchestrationBound() {
		return !this.disposed && this.actor !== null;
	}
	getDebugSnapshot() {
		let e = this.diagnosticLedger.snapshot(), t = this.recoveryBoundaryStore.getSnapshot();
		return Object.freeze({
			orchestration: V(this.requireOrchestrationActor().getSnapshot()),
			motionDeliveryLease: this.motionDeliveryLease ? Object.freeze({
				token: this.motionDeliveryLease.command.token,
				fromNodeId: this.motionDeliveryLease.command.fromNodeId,
				toNodeId: this.motionDeliveryLease.command.toNodeId,
				expectedRouteRevision: this.motionDeliveryLease.expectedRouteRevision,
				progress35Observed: this.motionDeliveryLease.progress35Observed
			}) : null,
			deferredPresentations: Object.freeze([...this.deferredPresentations.values()].map(({ command: e, reason: t }) => Object.freeze({
				commandId: e.commandId,
				objectId: e.objectId,
				objectKind: e.objectKind,
				reason: t
			}))),
			presentationObjects: Object.freeze({
				platforms: e.platforms,
				longRoads: e.longRoads,
				overpasses: e.overpasses,
				character: e.character
			}),
			recoveryRuntime: Object.freeze({
				transactionId: t?.transactionId ?? null,
				safeNodeId: t?.safeNodeId ?? null,
				journalObjectIds: t?.journalObjectIds ?? Object.freeze([]),
				activeRecoveryId: this.activeRecoveryInput?.recoveryId ?? null,
				activeStepIndex: this.activeRecoveryCommand?.type === "RECOVERY.COMPENSATE_PRESENTATION" && this.activeRecoveryInput?.journal.length ? this.activeRecoveryInput.journal.length - this.activeRecoveryCommand.journalIndex : 0,
				activeStepCount: this.activeRecoveryInput?.journal.length ?? 0
			}),
			faultTimeline: this.faultInjection.getTimeline()
		});
	}
	isNavigationIdle() {
		return ce(this.requireOrchestrationActor().getSnapshot());
	}
	getSceneRuntimePort() {
		return this.sceneRuntimePort;
	}
	bindSceneRuntimeGateway(e, t) {
		if (this.assertLive(), !Number.isSafeInteger(e) || e < 0) throw Error("sessionRevision must be a non-negative safe integer.");
		this.recoverySessionRevision = e, this.sceneRuntimeCommandSink = t;
	}
	reconcileRestoredRuleProjection(e, t) {
		this.assertLive();
		let n = this.coordinator.restoreStableZoneSessionForNode(e, t), r = this.coordinator.getDebugSnapshot(), i = new Set(r.unlockedNodeIds), a = new Set(r.unlockedStraightEdgeIds);
		for (let e of this.pathView.getNodePresenceStates()) {
			let t = i.has(e.id);
			this.pathView.setNodeVisible(e.id, t), this.diagnosticLedger.reconcileStableVisibility("platform", e.id, t);
		}
		for (let e of this.pathView.getStraightEdgePresenceStates()) {
			let t = a.has(e.id);
			this.pathView.setStraightEdgeVisible(e.id, t), this.diagnosticLedger.reconcileStableVisibility("long-road", e.id, t);
		}
		let o = r.bridges.filter((e) => e.active);
		for (let e of o) this.registerOverpass(e.edge), this.pathView.updateOverpassVisibility(e.bridgeId, 0, {
			desiredVisible: !0,
			characterSideNodeId: e.ownerSourceNodeId,
			reducedMotion: !0
		}), this.diagnosticLedger.reconcileStableVisibility("overpass", e.bridgeId, !0);
		return Object.freeze({
			restoredZoneId: n?.zoneId ?? null,
			visibleNodeIds: Object.freeze([...i].sort()),
			visibleStraightEdgeIds: Object.freeze([...a].sort()),
			visibleOverpassIds: Object.freeze(o.map((e) => e.bridgeId).sort())
		});
	}
	getPathOrchestrationBinding() {
		return this.assertLive(), Object.freeze({
			...this.orchestrationBinding,
			input: Object.freeze({
				...this.orchestrationBinding.input,
				initialNodeId: this.simulation.getSnapshot().currentNodeId,
				initialCharacterVisualIdle: this.character.isVisuallyIdle(),
				initialZoneStatus: this.coordinator.hasVisibleZoneSession() ? "active" : "inactive"
			})
		});
	}
	dispose() {
		this.disposed || (this.disposed = !0, this.stopArrivalSubscription(), this.stopPresentationSubscription(), this.stopCharacterSubscription(), this.characterAdapter.dispose(), this.presentation.dispose(), this.pendingCharacterSettles.clear(), this.sceneRuntimePort.dispose(), this.actor = null, this.clearRecoveryAdapterState(), this.deferredPresentations.clear(), this.recoveryBoundaryStore.reset());
	}
	planNavigationWithRecovery(e, t) {
		let n = this.recoveryBoundaryStore.begin(e), r = this.coordinator.planNavigation(e, t);
		return !r.accepted && n && this.recoveryBoundaryStore.reset(), r;
	}
	planZoneRevealWithRecovery(e) {
		let t = this.recoveryBoundaryStore.begin(e), n = this.coordinator.planIdleZoneReveal(e);
		return n ? this.recoveryBoundaryStore.bind(n.id, e) : t && this.recoveryBoundaryStore.reset(), n;
	}
	planZoneDismissWithRecovery(e) {
		let t = this.recoveryBoundaryStore.begin(e), n = this.coordinator.planIdleZoneDismissal(e);
		return n ? this.recoveryBoundaryStore.bind(n.linkedNavigationPlanId ?? n.id, e) : t && this.recoveryBoundaryStore.reset(), n;
	}
	recordPresentationJournal(e) {
		let t = this.diagnosticLedger.getDesiredVisibility(e.objectKind, e.objectId);
		if (t === void 0) throw Error(`Cannot journal unknown ${e.objectKind} "${e.objectId}".`);
		this.recoveryBoundaryStore.record(Object.freeze({
			transactionId: e.transactionId,
			operationId: e.operationId,
			objectId: e.objectId,
			objectKind: e.objectKind,
			visibleBefore: t,
			order: e.order,
			metadata: e.metadata
		}));
	}
	completeRecoveryBoundaryIfStable() {
		let e = this.recoveryBoundaryStore.getSnapshot();
		if (!e || this.activeRecoveryInput) return;
		let t = this.requireOrchestrationActor().getSnapshot();
		!ce(t) || t.context.navigationPlan !== null || t.context.zoneRevealPlan !== null || t.context.zoneDismissPlan !== null || t.context.zoneTransitionActive || !t.context.characterVisualIdle || (e.transactionId ? this.recoveryBoundaryStore.complete(e.transactionId) : this.recoveryBoundaryStore.reset());
	}
	issuePresentationCommand(e) {
		try {
			this.sceneRuntimeCommandSink({
				type: "PRESENTATION.EXECUTE",
				sessionRevision: this.recoverySessionRevision,
				transactionId: e.transactionId,
				operationId: e.operationId,
				attemptId: e.attemptId,
				attempt: e.attempt,
				payload: e,
				timeoutMs: this.presentationAckTimeoutSeconds * 1e3
			});
		} catch (t) {
			let n = t instanceof Error ? t.message : String(t);
			this.sceneRuntimePort.publish({
				type: "PRESENTATION.FAILED",
				sessionRevision: this.recoverySessionRevision,
				transactionId: e.transactionId,
				operationId: e.operationId,
				attemptId: e.attemptId,
				attempt: e.attempt,
				error: n
			});
		}
	}
	issueMotionCommand(e) {
		try {
			this.sceneRuntimeCommandSink({
				type: "MOTION.EXECUTE",
				sessionRevision: this.recoverySessionRevision,
				transactionId: e.transactionId,
				operationId: e.operationId,
				attemptId: e.attemptId,
				attempt: e.attempt,
				payload: e,
				timeoutMs: this.motionRouteTimeoutMs
			});
		} catch (t) {
			this.failMotionCommand(e, t instanceof Error ? t.message : String(t));
		}
	}
	issueCharacterForceSettleCommand(e) {
		try {
			this.sceneRuntimeCommandSink({
				type: "CHARACTER.FORCE_SETTLE",
				sessionRevision: this.recoverySessionRevision,
				transactionId: e.transactionId,
				operationId: e.operationId,
				attemptId: e.attemptId,
				attempt: e.attempt,
				reason: e.reason,
				timeoutMs: this.characterForceSettleAckTimeoutMs
			});
		} catch (t) {
			this.sceneRuntimePort.publish({
				type: "CHARACTER.FAILED",
				sessionRevision: this.recoverySessionRevision,
				transactionId: e.transactionId,
				operationId: e.operationId,
				attemptId: e.attemptId,
				attempt: e.attempt,
				error: t instanceof Error ? t.message : String(t)
			});
		}
	}
	requireDomainPresentationPayload(e) {
		let t = e.payload;
		if (!t || t.type !== "PRESENTATION.BRIDGE" && t.type !== "PRESENTATION.CONSTRUCT" || t.transactionId !== e.transactionId || t.operationId !== e.operationId || t.attemptId !== e.attemptId || t.attempt !== e.attempt) throw Error(`Invalid presentation payload for "${e.attemptId}".`);
		return t;
	}
	requireMotionPayload(e) {
		let t = e.payload;
		if (!t || t.type !== "MOTION.NAVIGATE" || t.transactionId !== e.transactionId || t.operationId !== e.operationId || t.attemptId !== e.attemptId || t.attempt !== e.attempt) throw Error(`Invalid motion payload for "${e.attemptId}".`);
		return t;
	}
	cancelPresentationDelivery(e) {
		this.presentation.cancelTransaction(e), [...this.deferredPresentations.entries()].forEach(([t, n]) => {
			n.command.transactionId === e && this.deferredPresentations.delete(t);
		});
	}
	abortMotionDelivery(e) {
		this.motionDeliveryLease?.command.token === e.token && (this.simulation.abortToNode(this.recoveryBoundaryStore.getSnapshot()?.safeNodeId ?? e.fromNodeId), this.motionDeliveryLease = null, this.lastVisualIdleToken = null);
	}
	forceSettleCharacter(e) {
		return this.pendingCharacterSettles.set(e.attemptId, e), this.character.debugRecoverStalledAnimation(e.reason ?? "scene-runtime-force-settle"), this.character.isVisuallyIdle() && queueMicrotask(() => this.settlePendingCharacterCommands()), {
			disposition: "accepted",
			cancel: () => {
				this.pendingCharacterSettles.delete(e.attemptId);
			}
		};
	}
	settlePendingCharacterCommands() {
		this.disposed || !this.character.isVisuallyIdle() || [...this.pendingCharacterSettles.values()].forEach((e) => {
			this.sceneRuntimePort.publish({
				type: "CHARACTER.SETTLED",
				sessionRevision: e.sessionRevision,
				transactionId: e.transactionId,
				operationId: e.operationId,
				attemptId: e.attemptId,
				attempt: e.attempt
			}), this.pendingCharacterSettles.delete(e.attemptId);
		});
	}
	failPendingCharacterCommands(e) {
		this.disposed || [...this.pendingCharacterSettles.values()].forEach((t) => {
			this.sceneRuntimePort.publish({
				type: "CHARACTER.FAILED",
				sessionRevision: t.sessionRevision,
				transactionId: t.transactionId,
				operationId: t.operationId,
				attemptId: t.attemptId,
				attempt: t.attempt,
				error: e
			}), this.pendingCharacterSettles.delete(t.attemptId);
		});
	}
	executePresentation(e) {
		try {
			let t = e.type === "PRESENTATION.CONSTRUCT" ? this.resolveConstructCommand(e) : this.resolveBridgeCommand(e.action, e);
			this.recoveryBoundaryStore.bind(e.transactionId, this.actor?.getSnapshot().context.currentNodeId ?? this.simulation.getSnapshot().currentNodeId), this.recordPresentationJournal(t), this.emitTransition("presentation-command", t.objectId, `${t.commandId}; visible=${t.visible}`), this.dispatchOrDeferPresentation(t);
		} catch (t) {
			let n = t instanceof Error ? t.message : String(t);
			this.sceneRuntimePort.publish({
				type: "PRESENTATION.FAILED",
				sessionRevision: this.recoverySessionRevision,
				transactionId: e.transactionId,
				operationId: e.operationId,
				attemptId: e.attemptId,
				attempt: e.attempt,
				error: n
			});
		}
	}
	resolveConstructCommand(e) {
		if (e.construct.kind === "bridge") throw Error(`Construct command "${e.token}" cannot contain a bridge.`);
		let t = e.construct.kind === "node";
		return Object.freeze({
			commandId: e.token,
			transactionId: e.transactionId,
			operationId: e.operationId,
			attempt: e.attempt,
			objectId: t ? e.construct.nodeId : e.construct.edgeId,
			objectKind: t ? "platform" : "long-road",
			visible: e.direction === "fall-in",
			order: null,
			metadata: Object.freeze({
				token: e.token,
				lane: e.lane,
				planId: e.planId,
				stepIndex: e.stepIndex,
				reason: e.direction
			})
		});
	}
	resolveBridgeCommand(e, t) {
		e.kind === "ensure-bridge" && this.registerOverpass(e.bridge.edge);
		let n = e.kind === "ensure-bridge" ? e.bridge.bridgeId : e.bridgeId, r = this.requireOverpass(n), i = this.findRegisteredBridge(n), a = e.kind === "ensure-bridge" ? e.bridge.role : i?.role ?? "ordinary", o = e.characterSideNodeId, s = r.fromNodeId === o ? r.toNodeId : r.fromNodeId, c = a === "zone-entry" || a === "zone-transient" || t.lane === "zone-reveal" || t.lane === "zone-reveal-before" || t.lane === "zone-dismiss";
		return Object.freeze({
			commandId: t.token,
			transactionId: t.transactionId,
			operationId: t.operationId,
			attempt: t.attempt,
			objectId: n,
			objectKind: "overpass",
			visible: e.kind === "ensure-bridge",
			order: c ? "world-left-to-right" : "source-to-target",
			metadata: Object.freeze({
				token: t.token,
				lane: t.lane,
				planId: t.planId,
				stepIndex: t.stepIndex,
				sourceNodeId: o,
				targetNodeId: s,
				role: a,
				reason: e.kind
			})
		});
	}
	dispatchOrDeferPresentation(e) {
		let t = this.getPresentationDeferralReason(e);
		if (t) {
			this.deferredPresentations.set(e.commandId, {
				command: e,
				reason: t
			}), this.emitTransition("presentation-deferred", e.objectId, t);
			return;
		}
		this.dispatchPresentation(e);
	}
	dispatchPresentation(e) {
		this.diagnosticLedger.acceptPresentationCommand(e), this.presentation.command(e);
	}
	getPresentationDeferralReason(e) {
		if (e.visible) return null;
		let t = this.simulation.getSnapshot();
		return e.objectKind === "platform" && t.remainingRouteNodeIds.includes(e.objectId) && !(t.isRunning && this.motionDeliveryLease?.command.fromNodeId === e.objectId) || e.objectKind === "long-road" && t.remainingRouteEdgeIds.includes(e.objectId) || e.objectKind === "overpass" && t.remainingRouteEdgeIds.includes(e.objectId) ? "route-lease" : e.objectKind === "overpass" && t.activeLeg?.edgeId === e.objectId ? "occupied-overpass" : null;
	}
	flushDeferredPresentations() {
		[...this.deferredPresentations.entries()].forEach(([e, t]) => {
			if (!this.getPresentationDeferralReason(t.command)) {
				this.deferredPresentations.delete(e), this.emitTransition("presentation-lease-released", t.command.objectId, t.reason);
				try {
					this.dispatchPresentation(t.command);
				} catch (e) {
					let n = e instanceof Error ? e.message : String(e);
					this.sceneRuntimePort.publish({
						type: "PRESENTATION.FAILED",
						sessionRevision: this.recoverySessionRevision,
						transactionId: t.command.transactionId,
						operationId: t.command.operationId,
						attemptId: t.command.commandId,
						attempt: t.command.attempt,
						error: n
					});
				}
			}
		});
	}
	executeMotion(e) {
		if (this.recoveryBoundaryStore.bind(e.transactionId, e.fromNodeId), this.motionDeliveryLease && this.simulation.getSnapshot().isRunning) {
			this.failMotionCommand(e, `Motion "${e.token}" cannot replace active motion "${this.motionDeliveryLease.command.token}".`);
			return;
		}
		this.motionDeliveryLease = {
			command: e,
			expectedRouteRevision: this.simulation.getSnapshot().routeRevision + 1,
			arrived: !1,
			progress35Observed: !1
		};
		let t = this.faultInjection.decide({
			point: ge.MOTION_COMMAND,
			operation: e.operationId,
			attempt: e.attempt,
			transactionId: e.transactionId,
			metadata: {
				token: e.token,
				from: e.fromNodeId,
				to: e.toNodeId
			}
		});
		if (t.kind === "throw") {
			this.failMotionCommand(e, t.message);
			return;
		}
		if (t.kind === "drop" || t.kind === "stall") {
			this.emitTransition("motion-issued", e.token, `injected-${t.kind}`);
			return;
		}
		try {
			let t = this.simulation.requestRoute({
				targetNodeId: e.toNodeId,
				nodeIds: e.routeNodeIds,
				edgeIds: e.routeEdgeIds
			});
			if (!t.accepted || t.status !== "started") {
				let n = t.accepted ? t.status : t.message;
				this.failMotionCommand(e, `Explicit motion failed: ${n}.`);
				return;
			}
			if (this.lastVisualIdleToken = null, this.emitTransition("motion-issued", e.token, e.stageId), this.sceneRuntimePort.publish({
				type: "MOTION.DEPARTED",
				sessionRevision: this.recoverySessionRevision,
				transactionId: e.transactionId,
				operationId: e.operationId,
				attemptId: e.attemptId,
				attempt: e.attempt,
				nodeId: e.fromNodeId
			}), this.emitTransition("motion-departed", e.token, e.fromNodeId), this.reducedMotion) {
				let t = this.motionDeliveryLease;
				t?.command.token === e.token && (t.expectedRouteRevision = this.simulation.getSnapshot().routeRevision + 1, this.simulation.moveImmediatelyTo(e.toNodeId) || this.failMotionCommand(e, "Reduced-motion teleport failed."));
			}
		} catch (t) {
			this.failMotionCommand(e, t instanceof Error ? t.message : String(t));
		}
	}
	handlePhysicalArrival(e) {
		let t = this.motionDeliveryLease;
		if (!t || t.command.toNodeId !== e.nodeId || t.expectedRouteRevision !== e.routeRevision) return;
		let n = this.requireOrchestrationActor().getSnapshot().context.navigationPlan, r = t.command.stageIndex === Math.max(0, (n?.stages.length ?? 1) - 1), i = t.command;
		t.arrived = !0, this.emitTransition("motion-arrived", i.token, e.nodeId), this.sceneRuntimePort.publish({
			type: "MOTION.ARRIVED",
			sessionRevision: this.recoverySessionRevision,
			transactionId: i.transactionId,
			operationId: i.operationId,
			attemptId: i.attemptId,
			attempt: i.attempt,
			nodeId: e.nodeId
		}), this.onPhysicalArrival?.({
			command: i,
			nodeId: e.nodeId,
			routeRevision: e.routeRevision,
			finalStage: r
		}), this.motionDeliveryLease?.command.token === i.token && this.publishVisualIdleIfReady();
	}
	publishVisualIdleIfReady() {
		let e = this.motionDeliveryLease;
		!e || this.lastVisualIdleToken === e.command.token || this.requireOrchestrationActor().getSnapshot().context.arrivedNodeId !== e.command.toNodeId || !this.character.isVisuallyIdle() || (this.lastVisualIdleToken = e.command.token, this.emitTransition("motion-visual-idle", e.command.token, e.command.toNodeId), this.sceneRuntimePort.publish({
			type: "MOTION.VISUAL_IDLE",
			sessionRevision: this.recoverySessionRevision,
			transactionId: e.command.transactionId,
			operationId: e.command.operationId,
			attemptId: e.command.attemptId,
			attempt: e.command.attempt,
			nodeId: e.command.toNodeId
		}));
	}
	isCurrentPresentationCommand(e) {
		let t = this.currentRecoveryCommand();
		if (t?.type === "RECOVERY.COMPENSATE_PRESENTATION" && t.attemptId === e) return !0;
		let n = this.requireOrchestrationActor().getSnapshot().context;
		return e === n.navigationCommandToken || e === n.zoneRevealCommandToken || e === n.zoneDismissCommandToken;
	}
	handlePresentationEvent(e) {
		let t = this.currentRecoveryCommand(), n = t?.type === "RECOVERY.COMPENSATE_PRESENTATION" && t.attemptId === e.commandId, r = this.isCurrentPresentationCommand(e.commandId), i = this.presentation.isCurrentCommand(e.commandId, e.objectKind, e.objectId);
		if (e.type === "PRESENTATION.STARTED") {
			if (!i) {
				this.emitTransition("stale-event-ignored", e.commandId, "presentation STARTED");
				return;
			}
			this.sceneRuntimePort.publish({
				type: "PRESENTATION.STARTED",
				sessionRevision: this.recoverySessionRevision,
				transactionId: e.transactionId,
				operationId: e.operationId,
				attemptId: e.commandId,
				attempt: e.attempt
			}), this.emitTransition("presentation-started", e.objectId, e.commandId);
			return;
		}
		if (e.type === "PRESENTATION.PHASE") {
			if (!i) {
				this.emitTransition("stale-event-ignored", e.commandId, "presentation PHASE");
				return;
			}
			this.diagnosticLedger.acceptPresentationEvent(e);
			return;
		}
		if (e.type === "PRESENTATION.FAILED") {
			if (!i || !r) {
				this.emitTransition("stale-event-ignored", e.commandId, "presentation failure");
				return;
			}
			if (this.emitTransition("presentation-failed", e.objectId, `${e.commandId}; ${e.error}`), this.sceneRuntimePort.publish({
				type: "PRESENTATION.FAILED",
				sessionRevision: this.recoverySessionRevision,
				transactionId: e.transactionId,
				operationId: e.operationId,
				attemptId: e.commandId,
				attempt: e.attempt,
				error: e.error
			}), n && t) {
				this.sendRecoveryPresentationAck(t, e, e.error);
				return;
			}
			return;
		}
		if (!r) {
			this.emitTransition("stale-event-ignored", e.commandId, "presentation ACK");
			return;
		}
		if (this.diagnosticLedger.acceptPresentationEvent(e), this.sceneRuntimePort.publish({
			type: "PRESENTATION.SETTLED",
			sessionRevision: this.recoverySessionRevision,
			transactionId: e.transactionId,
			operationId: e.operationId,
			attemptId: e.commandId,
			attempt: e.attempt,
			result: {
				objectKind: e.objectKind,
				objectId: e.objectId,
				terminal: e.terminal
			}
		}), this.emitTransition("presentation-settled", e.objectId, `${e.commandId}; ${e.terminal}`), n || this.recoveryBoundaryStore.terminal(e.transactionId, e.operationId), this.onPresentationSettled?.(e), n && t) {
			this.sendRecoveryPresentationAck(t, e);
			return;
		}
	}
	prepareRecoveryInput(e) {
		if (this.activeRecoveryInput?.recoveryId === e.recoveryId) return this.activeRecoveryInput;
		if (this.activeRecoveryInput) throw Error(`Recovery "${this.activeRecoveryInput.recoveryId}" is already active.`);
		let t = this.recoveryBoundaryStore.prepare({
			recoveryId: e.recoveryId,
			sessionRevision: this.recoverySessionRevision,
			transactionId: e.transactionId,
			safeNodeId: e.safeNodeId
		});
		return (e.kind === "presentation-failed" || e.kind === "presentation-timeout") && this.requireOrchestrationActor().getSnapshot().context.zoneRevealPlan !== null && (this.zoneRevealFailureLatchNodeId = e.safeNodeId), this.emitTransition("recovery-started", e.recoveryId, `${e.kind}; steps=${t.journal.length}`), this.activeRecoveryInput = t, this.activeRecoveryCommand = null, this.lastExecutedRecoveryAttemptId = null, t;
	}
	currentRecoveryCommand() {
		return this.activeRecoveryCommand;
	}
	executeRecoveryCommand(e) {
		let t = this.activeRecoveryInput;
		if (!t || t.recoveryId !== e.recoveryId || t.sessionRevision !== e.sessionRevision || t.transactionId !== e.transactionId) {
			this.emitTransition("stale-event-ignored", e.attemptId, "recovery command");
			return;
		}
		e.attemptId !== this.lastExecutedRecoveryAttemptId && (this.lastExecutedRecoveryAttemptId = e.attemptId, this.activeRecoveryCommand = e, this.dispatchRecoveryCommand(e));
	}
	dispatchRecoveryCommand(e) {
		try {
			if (e.type === "RECOVERY.CANCEL_PRESENTATION") {
				this.presentation.cancelTransaction(e.transactionId), this.deferredPresentations.clear(), this.sendRecoveryCommandResult(e);
				return;
			}
			if (e.type === "RECOVERY.ABORT_MOTION") {
				if (this.motionDeliveryLease = null, this.lastVisualIdleToken = null, !this.simulation.abortToNode(e.safeNodeId)) {
					this.sendRecoveryCommandResult(e, `Cannot restore safe node "${e.safeNodeId}".`);
					return;
				}
				this.character.debugRecoverStalledAnimation("transaction-recovery"), this.sendRecoveryCommandResult(e);
				return;
			}
			if (e.type === "RECOVERY.COMPENSATE_PRESENTATION") {
				let { entry: t } = e, n = Object.freeze({
					commandId: e.attemptId,
					transactionId: e.transactionId,
					operationId: e.operationId,
					attempt: e.attempt,
					objectId: t.objectId,
					objectKind: t.objectKind,
					visible: t.visibleBefore,
					order: t.objectKind === "overpass" ? t.order : null,
					metadata: Object.freeze({
						...t.metadata,
						reason: "transaction-compensation",
						recoveryId: e.recoveryId
					})
				});
				this.emitTransition("recovery-step", t.objectId, `${e.operationId}; ${t.visibleBefore ? "show" : "hide"}`), this.dispatchPresentation(n);
				return;
			}
			if (e.type === "RECOVERY.RESTORE_RULE_LEDGER") {
				try {
					this.recoveryBoundaryStore.restore(e.checkpointId);
				} catch (t) {
					this.sendRecoveryCommandResult(e, t instanceof Error ? t.message : String(t));
					return;
				}
				this.sendRecoveryCommandResult(e);
				return;
			}
			this.character.isVisuallyIdle() && this.sendRecoveryCommandResult(e);
		} catch (t) {
			this.sendRecoveryCommandResult(e, t instanceof Error ? t.message : String(t));
		}
	}
	sendRecoveryCommandResult(e, t) {
		let n = {
			recoveryId: e.recoveryId,
			sessionRevision: e.sessionRevision,
			transactionId: e.transactionId,
			operationId: e.operationId,
			attemptId: e.attemptId,
			attempt: e.attempt
		};
		t ? this.requireOrchestrationActor().send({
			type: "RECOVERY.COMMAND.FAILED",
			...n,
			error: t
		}) : this.requireOrchestrationActor().send({
			type: "RECOVERY.COMMAND.SUCCEEDED",
			...n
		});
	}
	sendRecoveryPresentationAck(e, t, n) {
		let r = {
			recoveryId: e.recoveryId,
			sessionRevision: e.sessionRevision,
			transactionId: t.transactionId,
			operationId: t.operationId,
			attemptId: t.commandId,
			attempt: t.attempt
		};
		n ? this.requireOrchestrationActor().send({
			type: "RECOVERY.COMMAND.FAILED",
			...r,
			error: n
		}) : this.requireOrchestrationActor().send({
			type: "RECOVERY.COMMAND.SUCCEEDED",
			...r
		});
	}
	acknowledgeRecoveryCharacterIdle() {
		if (!this.character.isVisuallyIdle()) return;
		let e = this.currentRecoveryCommand();
		e?.type === "RECOVERY.AWAIT_CHARACTER_IDLE" && this.sendRecoveryCommandResult(e);
	}
	finalizeRecovery(e, t) {
		let n = this.activeRecoveryInput;
		if (!(!n || n.recoveryId !== e.recoveryId)) {
			if (t.status === "succeeded") {
				this.completeRecovery(e, t);
				return;
			}
			if (t.status === "degraded") {
				this.failRecovery(e, t);
				return;
			}
			this.clearRecoveryAdapterState();
		}
	}
	completeRecovery(e, t) {
		let n = this.coordinator.getDebugSnapshot().zones.some((e) => e.sessionState === "active") ? "active" : "inactive", r = {
			type: "ORCHESTRATION.RECOVERY.COMPLETE",
			recoveryId: e.recoveryId,
			transactionId: e.transactionId,
			nodeId: t.safeNodeId,
			zoneStatus: n,
			compensatedOperationCount: t.compensatedOperationCount
		};
		this.emitTransition("recovery-complete", e.recoveryId, `compensated=${t.compensatedOperationCount}`), this.clearRecoveryAdapterState(), this.recoveryBoundaryStore.complete(e.transactionId), this.requireOrchestrationActor().send(r);
	}
	failRecovery(e, t) {
		this.presentation.cancelTransaction(e.transactionId), this.deferredPresentations.clear(), this.motionDeliveryLease = null, this.lastVisualIdleToken = null, this.simulation.abortToNode(t.safeNodeId), this.character.debugRecoverStalledAnimation("recovery-failed"), this.emitTransition("recovery-failed", e.recoveryId, t.failure.error), this.clearRecoveryAdapterState(), this.recoveryBoundaryStore.complete(e.transactionId), this.requireOrchestrationActor().send({
			type: "ORCHESTRATION.RECOVERY.FAILED",
			recoveryId: e.recoveryId,
			transactionId: e.transactionId,
			error: t.failure.error
		});
	}
	cancelRecoveryAdapter(e) {
		this.activeRecoveryInput && this.activeRecoveryInput.recoveryId !== e.recoveryId || !this.activeRecoveryInput && this.recoveryBoundaryStore.getSnapshot()?.transactionId !== e.transactionId || (this.presentation.cancelTransaction(e.transactionId), this.deferredPresentations.clear(), this.motionDeliveryLease = null, this.lastVisualIdleToken = null, this.simulation.abortToNode(e.safeNodeId), this.character.debugRecoverStalledAnimation("recovery-cancelled"), this.clearRecoveryAdapterState(), this.recoveryBoundaryStore.complete(e.transactionId));
	}
	clearRecoveryAdapterState() {
		this.activeRecoveryInput = null, this.activeRecoveryCommand = null, this.lastExecutedRecoveryAttemptId = null;
	}
	observeMotionFaultPoint() {
		let e = this.motionDeliveryLease;
		if (!e || e.arrived || e.progress35Observed || this.activeRecoveryInput) return;
		let t = this.simulation.getSnapshot().activeLeg;
		if (!t || t.progress < .35) return;
		e.progress35Observed = !0;
		let n = this.faultInjection.decide({
			point: "motion.progress-35",
			operation: e.command.operationId,
			attempt: e.command.attempt,
			transactionId: e.command.transactionId,
			metadata: {
				progress: t.progress,
				edgeId: t.edgeId
			}
		});
		if (n.kind === "pass") return;
		let r = n.kind === "throw" ? n.message : `Injected motion ${n.kind} at 35%.`;
		this.failMotionCommand(e.command, r);
	}
	failMotionCommand(e, t) {
		this.motionDeliveryLease?.command.token === e.token && (this.simulation.abortToNode(this.recoveryBoundaryStore.getSnapshot()?.safeNodeId ?? e.fromNodeId), this.motionDeliveryLease = null), this.emitTransition("motion-failed", e.operationId, t), this.sceneRuntimePort.publish({
			type: "MOTION.FAILED",
			sessionRevision: this.recoverySessionRevision,
			transactionId: e.transactionId,
			operationId: e.operationId,
			attemptId: e.attemptId,
			attempt: e.attempt,
			error: t
		});
	}
	observeCharacterWatchdogRecovery() {
		let e = this.character.getDebugState().watchdog;
		e.timeoutCount <= this.lastCharacterWatchdogTimeoutCount || (this.lastCharacterWatchdogTimeoutCount = e.timeoutCount, this.emitTransition("character-watchdog-recovered", e.lastRecoveryReason ?? "animation-watchdog", `count=${e.timeoutCount}`));
	}
	syncOccupiedOverpass() {
		let e = this.simulation.getSnapshot().activeLeg, t = e?.pathKind === "overpass" ? e.edgeId : null;
		t !== this.occupiedOverpassId && (this.occupiedOverpassId = t, this.diagnosticLedger.setOccupiedOverpass(t));
	}
	driveIdleZoneRules() {
		let e = this.requireOrchestrationActor().getSnapshot();
		if (!(!ce(e) || !e.context.characterVisualIdle)) {
			if (le(e)) {
				if (e.context.currentNodeId === this.zoneRevealFailureLatchNodeId) return;
				this.requireOrchestrationActor().send({
					type: "ZONE.REVEAL.REQUESTED",
					nodeId: e.context.currentNodeId
				});
				return;
			}
			ue(e) && this.requireOrchestrationActor().send({
				type: "ZONE.DISMISS.REQUESTED",
				nodeId: e.context.currentNodeId
			});
		}
	}
	findRegisteredBridge(e) {
		return this.coordinator.getDebugSnapshot().bridges.find((t) => t.bridgeId === e) ?? null;
	}
	requireOverpass(e) {
		let t = this.edgeById.get(e);
		if (!t || t.pathKind !== "overpass") throw Error(`Unknown overpass "${e}".`);
		return t;
	}
	registerOverpass(e) {
		let t = this.edgeById.get(e.id);
		if (t) {
			if (t.pathKind !== "overpass" || JSON.stringify(t) !== JSON.stringify(e)) throw Error(`Runtime edge id "${e.id}" is already registered.`);
			this.diagnosticLedger.registerOverpass(e);
			return;
		}
		this.simulation.registerEdge(e), this.presentation.registerEdge(e), this.edgeById.set(e.id, e), this.diagnosticLedger.registerOverpass(e);
	}
	createUniqueCatalog(e, t) {
		let n = /* @__PURE__ */ new Map();
		return e.forEach((e) => {
			if (n.has(e.id)) throw Error(`Duplicate ${t} id "${e.id}".`);
			n.set(e.id, e);
		}), n;
	}
	emitTransition(e, t, n) {
		this.onTransition?.(Object.freeze({
			type: e,
			objectId: t,
			...n ? { detail: n } : {}
		}));
	}
	requireOrchestrationActor() {
		if (this.assertLive(), !this.actor) throw Error("LearningPathXStateRuntime is not bound to the application-owned orchestration actor.");
		return this.actor;
	}
	assertLive() {
		if (this.disposed) throw Error("LearningPathXStateRuntime is disposed.");
	}
}, Dt = class {
	adjacencyByNodeId = /* @__PURE__ */ new Map();
	constructor(e, t) {
		let n = /* @__PURE__ */ new Set();
		e.forEach((e, t) => {
			let r = typeof e == "string" ? e : e.id;
			if (r.trim().length === 0 || n.has(r)) throw Error(`Base path has an invalid or duplicate node at index ${t}.`);
			n.add(r), this.adjacencyByNodeId.set(r, []);
		});
		let r = /* @__PURE__ */ new Set(), i = /* @__PURE__ */ new Set();
		t.forEach((e, t) => {
			if (e.id.trim().length === 0 || r.has(e.id)) throw Error(`Base path has an invalid or duplicate edge at index ${t}.`);
			if (!n.has(e.fromNodeId) || !n.has(e.toNodeId)) throw Error(`Base path edge "${e.id}" references a missing endpoint.`);
			if (e.fromNodeId === e.toNodeId) throw Error(`Base path edge "${e.id}" is a self-loop.`);
			let a = kt(e.fromNodeId, e.toNodeId);
			if (i.has(a)) throw Error(`Base path repeats the physical connection between "${e.fromNodeId}" and "${e.toNodeId}".`);
			r.add(e.id), i.add(a), this.adjacencyByNodeId.get(e.fromNodeId).push({
				nodeId: e.toNodeId,
				edgeId: e.id
			}), this.adjacencyByNodeId.get(e.toNodeId).push({
				nodeId: e.fromNodeId,
				edgeId: e.id
			});
		}), this.adjacencyByNodeId.forEach((e) => {
			e.sort((e, t) => {
				let n = At(e.nodeId, t.nodeId);
				return n === 0 ? At(e.edgeId, t.edgeId) : n;
			});
		});
	}
	hasNode(e) {
		return this.adjacencyByNodeId.has(e);
	}
	hopDistance(e, t) {
		return this.shortestRoute(e, t)?.hopCount ?? null;
	}
	shortestRoute(e, t) {
		if (!this.hasNode(e) || !this.hasNode(t)) return null;
		if (e === t) return Object.freeze({
			nodeIds: Object.freeze([e]),
			edgeIds: Object.freeze([]),
			legs: Object.freeze([]),
			hopCount: 0
		});
		let n = /* @__PURE__ */ new Set([e]), r = /* @__PURE__ */ new Map(), i = [e], a = 0;
		for (; a < i.length;) {
			let o = i[a++];
			for (let a of this.adjacencyByNodeId.get(o)) if (!n.has(a.nodeId)) {
				if (n.add(a.nodeId), r.set(a.nodeId, {
					nodeId: o,
					edgeId: a.edgeId
				}), a.nodeId === t) return Ot(e, t, r);
				i.push(a.nodeId);
			}
		}
		return null;
	}
};
function Ot(e, t, n) {
	let r = [t], i = [], a = t;
	for (; a !== e;) {
		let e = n.get(a);
		if (!e) throw Error("Base path predecessor chain is incomplete.");
		i.push(e.edgeId), r.push(e.nodeId), a = e.nodeId;
	}
	r.reverse(), i.reverse();
	let o = i.map((e, t) => Object.freeze({
		edgeId: e,
		fromNodeId: r[t],
		toNodeId: r[t + 1]
	}));
	return Object.freeze({
		nodeIds: Object.freeze(r),
		edgeIds: Object.freeze(i),
		legs: Object.freeze(o),
		hopCount: i.length
	});
}
function kt(e, t) {
	return e < t ? `${e}\u0000${t}` : `${t}\u0000${e}`;
}
function At(e, t) {
	return e < t ? -1 : +(e > t);
}
//#endregion
//#region src/simulation/PathGeometryRegistry.ts
var jt = .523, Mt = .026, Nt = .64, Pt = .52, X = 1e-6, Ft = 4096, It = class {
	edge;
	lutSegments;
	evaluateCurve;
	id;
	pathKind;
	fromNodeId;
	toNodeId;
	length;
	samples;
	clearanceAudits = [];
	clearanceAudit = null;
	constructor(e, t, n) {
		this.edge = e, this.lutSegments = t, this.evaluateCurve = n, this.id = e.id, this.pathKind = e.pathKind, this.fromNodeId = e.fromNodeId, this.toNodeId = e.toNodeId;
		let r = [], i = 0, a = null;
		for (let e = 0; e <= t; e += 1) {
			let o = e / t, s = n(o);
			a !== null && (i += Xt(a, s.position)), r.push({
				sourceT: o,
				normalizedDistance: 0,
				distance: i,
				position: s.position,
				tangent: Yt(s.derivative),
				surfaceY: s.position.y
			}), a = s.position;
		}
		if (!Number.isFinite(i) || i <= X) throw Error(`Path edge "${e.id}" has zero or non-finite 3D length.`);
		this.length = i, this.samples = Object.freeze(r.map((e) => Object.freeze({
			...e,
			normalizedDistance: e.distance / i
		})));
	}
	sample(e) {
		Zt(e, `Normalized distance for edge "${this.id}"`);
		let t = Z(e), n = this.findRightSampleIndex(t), r = this.samples[n], i = this.samples[Math.max(0, n - 1)], a = r.normalizedDistance - i.normalizedDistance, o = a > X ? (t - i.normalizedDistance) / a : 0, s = en(i.sourceT, r.sourceT, o), c = this.evaluateCurve(s);
		return {
			sourceT: s,
			normalizedDistance: t,
			distance: t * this.length,
			position: c.position,
			tangent: Yt(c.derivative),
			surfaceY: c.position.y
		};
	}
	sampleSourceT(e) {
		return this.evaluateCurve(Z(e));
	}
	findRightSampleIndex(e) {
		let t = 0, n = this.samples.length - 1;
		for (; t < n;) {
			let r = Math.floor((t + n) / 2);
			this.samples[r].normalizedDistance < e ? t = r + 1 : n = r;
		}
		return t;
	}
}, Lt = class {
	lutSegments;
	edgeById = /* @__PURE__ */ new Map();
	nodeById;
	compiledById = /* @__PURE__ */ new Map();
	clearanceAudits = [];
	overpassProfileAudits = [];
	constructor(e, t = {}) {
		let n = t.lutSegments ?? 256;
		if (!Number.isInteger(n) || n < 160) throw Error("Path LUT segments must be an integer >= 160.");
		this.lutSegments = n, this.nodeById = this.validateNodes(e), this.validateEdgeIdentities(e, this.nodeById), e.edges.forEach((e) => this.edgeById.set(e.id, e));
	}
	get(e) {
		let t = this.compiledById.get(e) ?? this.compile(e);
		if (t === null) throw Error(`Unknown path edge "${e}".`);
		return t;
	}
	tryGet(e) {
		return this.compiledById.get(e) ?? this.compile(e);
	}
	registerEdge(e) {
		let t = this.edgeById.get(e.id);
		if (t) {
			if (t === e || Qt(t, e)) return !1;
			throw Error(`Path geometry edge id "${e.id}" is already registered.`);
		}
		if (e.id.trim().length === 0) throw Error("Path geometry cannot register an edge with an empty id.");
		if (!this.nodeById.has(e.fromNodeId) || !this.nodeById.has(e.toNodeId)) throw Error(`Path edge "${e.id}" references a missing endpoint.`);
		if (e.fromNodeId === e.toNodeId) throw Error(`Path edge "${e.id}" is a self-loop.`);
		if (e.pathKind === "overpass") {
			if (this.validateOverpassConfiguration(e), new Set(e.underpassEdgeIds).size !== e.underpassEdgeIds.length) throw Error(`Overpass "${e.id}" repeats an underpass edge.`);
			e.underpassEdgeIds.forEach((t) => {
				if (!this.edgeById.has(t)) throw Error(`Overpass "${e.id}" references missing underpass "${t}".`);
				if (t === e.id) throw Error(`Overpass "${e.id}" cannot pass under itself.`);
			});
		}
		return this.edgeById.set(e.id, e), !0;
	}
	sampleRoute(e, t, n) {
		let r = this.get(e);
		Zt(n, `Normalized route distance for edge "${e}"`);
		let i = Z(n), a = t === r.fromNodeId;
		if (!a && t !== r.toNodeId) throw Error(`Node "${t}" is not an endpoint of path edge "${e}".`);
		let o = a ? i : 1 - i, s = r.sample(o), c = a ? 1 : -1;
		return {
			...s,
			edgeId: e,
			pathKind: r.pathKind,
			fromNodeId: t,
			toNodeId: a ? r.toNodeId : r.fromNodeId,
			normalizedDistance: i,
			canonicalNormalizedDistance: o,
			tangent: {
				x: s.tangent.x * c,
				y: s.tangent.y * c,
				z: s.tangent.z * c
			}
		};
	}
	getClearanceAudits() {
		return this.compileAllOverpasses(), this.clearanceAudits;
	}
	getOverpassProfileAudits() {
		return this.compileAllOverpasses(), this.overpassProfileAudits;
	}
	get compiledPathCount() {
		return this.compiledById.size;
	}
	compile(e) {
		let t = this.edgeById.get(e);
		if (!t) return null;
		let n = this.nodeById.get(t.fromNodeId), r = this.nodeById.get(t.toNodeId), i = t.pathKind === "overpass" ? this.createOverpassEvaluator(t, n.position, r.position) : this.createStraightEvaluator(n.position, r.position), a = new It(t, this.lutSegments, i);
		if (this.compiledById.set(t.id, a), t.pathKind !== "overpass") return a;
		let o = this.auditOverpassProfile(t, a, this.nodeById);
		if (this.overpassProfileAudits.push(o), !o.passed) throw this.compiledById.delete(t.id), Error(`Overpass "${t.id}" profile failed: pitch ${o.maximumSurfacePitchDegrees.toFixed(3)}° / ${o.allowedSurfacePitchDegrees.toFixed(3)}°, symmetry error ${o.maximumSymmetryError.toExponential(3)}.`);
		return t.underpassEdgeIds.forEach((e, n) => {
			this.get(e);
			let r = this.auditOverpassClearance(t, e);
			if (a.clearanceAudits.push(r), n === 0 && (a.clearanceAudit = r), this.clearanceAudits.push(r), !r.passed) throw Error(`Overpass "${t.id}" clearance above "${e}" ${r.minimumClearance.toFixed(3)} is below required ${r.requiredClearance.toFixed(3)} (bridge t=${r.crossingSourceT.toFixed(3)}, ground t=${r.underpassCrossingSourceT.toFixed(3)}, bottom=${r.bridgeBottomY.toFixed(3)}, ground=${r.underpassSurfaceY.toFixed(3)}, symmetric=${String(r.isSymmetric)}).`);
		}), a;
	}
	compileAllOverpasses() {
		for (let e of this.edgeById.values()) e.pathKind === "overpass" && this.get(e.id);
	}
	validateNodes(e) {
		let t = /* @__PURE__ */ new Map();
		return e.nodes.forEach((e, n) => {
			if (e.id.trim().length === 0 || t.has(e.id)) throw Error(`Path geometry has an invalid or duplicate node at index ${n}.`);
			$t(e.position, `Node "${e.id}"`), Zt(e.surfaceY, `Node "${e.id}" surfaceY`), t.set(e.id, e);
		}), t;
	}
	validateEdgeIdentities(e, t) {
		let n = /* @__PURE__ */ new Set();
		e.edges.forEach((e, r) => {
			if (e.id.trim().length === 0 || n.has(e.id)) throw Error(`Path geometry has an invalid or duplicate edge at index ${r}.`);
			if (!t.has(e.fromNodeId) || !t.has(e.toNodeId)) throw Error(`Path edge "${e.id}" references a missing endpoint.`);
			if (e.fromNodeId === e.toNodeId) throw Error(`Path edge "${e.id}" is a self-loop.`);
			e.pathKind === "overpass" && this.validateOverpassConfiguration(e), n.add(e.id);
		});
		for (let t of e.edges) if (t.pathKind === "overpass") {
			if (new Set(t.underpassEdgeIds).size !== t.underpassEdgeIds.length) throw Error(`Overpass "${t.id}" repeats an underpass edge.`);
			for (let e of t.underpassEdgeIds) {
				if (!n.has(e)) throw Error(`Overpass "${t.id}" references missing underpass "${e}".`);
				if (e === t.id) throw Error(`Overpass "${t.id}" cannot pass under itself.`);
			}
		}
	}
	validateOverpassConfiguration(e) {
		for (let [t, n] of [
			["width", e.width],
			["deckThickness", e.deckThickness],
			["platformEdgeOffset", e.platformEdgeOffset],
			["straightApproachLength", e.straightApproachLength],
			["bridgeSurfaceY", e.bridgeSurfaceY],
			["maximumSurfacePitchDegrees", e.maximumSurfacePitchDegrees],
			["routingCost", e.routingCost],
			["requiredClearance", e.requiredClearance]
		]) Zt(n, `Overpass "${e.id}" ${t}`);
		if (e.width <= 0 || e.deckThickness <= 0 || e.platformEdgeOffset <= 0 || e.straightApproachLength <= 0 || e.maximumSurfacePitchDegrees <= 0 || e.maximumSurfacePitchDegrees >= 90 || e.routingCost <= 0 || e.requiredClearance <= 0) throw Error(`Overpass "${e.id}" dimensions and clearance must be positive.`);
		if (e.curveStyle !== "symmetric-eased-arch") throw Error(`Overpass "${e.id}" has an unsupported curve style.`);
		if (Math.abs(e.width - .64) > X) throw Error(`Overpass "${e.id}" must match the ordinary road width.`);
		if (e.bridgeSurfaceY <= .523) throw Error(`Overpass "${e.id}" arch must rise above its endpoints.`);
	}
	auditOverpassProfile(e, t, n) {
		let r = n.get(e.fromNodeId), i = n.get(e.toNodeId), a = i.position.x - r.position.x, o = i.position.z - r.position.z, s = Math.hypot(a, o), c = a / s, l = o / s, u = -l, d = c, f = (r.position.x + i.position.x) / 2, p = (r.position.z + i.position.z) / 2, m = e.platformEdgeOffset + e.straightApproachLength, h = 0, g = 0;
		t.samples.forEach((e, n) => {
			let r = t.samples[t.samples.length - 1 - n], i = e.position.x - f, a = e.position.z - p, o = r.position.x - f, _ = r.position.z - p, v = i * c + a * l, y = o * c + _ * l, b = i * u + a * d, x = o * u + _ * d, S = e.tangent.x * c + e.tangent.z * l, C = r.tangent.x * c + r.tangent.z * l, w = e.tangent.x * u + e.tangent.z * d, T = r.tangent.x * u + r.tangent.z * d;
			h = Math.max(h, Math.abs(e.surfaceY - r.surfaceY), Math.abs(v + y), Math.abs(b - x), Math.abs(S - C), Math.abs(w + T), Math.abs(e.tangent.y + r.tangent.y));
			let E = v + s / 2;
			E + X >= m && E - X <= s - m && (g = Math.max(g, Math.atan2(Math.abs(e.tangent.y), Math.hypot(e.tangent.x, e.tangent.z))));
		});
		let _ = g * 180 / Math.PI, v = h <= 1e-5, y = v && _ <= e.maximumSurfacePitchDegrees + 1e-5;
		return Object.freeze({
			edgeId: e.id,
			maximumSurfacePitchDegrees: _,
			allowedSurfacePitchDegrees: e.maximumSurfacePitchDegrees,
			maximumSymmetryError: h,
			isSymmetric: v,
			passed: y
		});
	}
	createStraightEvaluator(e, t) {
		let n = t.x - e.x, r = t.z - e.z, i = Math.hypot(n, r);
		if (!Number.isFinite(i) || i <= X) throw Error("Straight path endpoints must not coincide.");
		return (a) => {
			let o = Z(a), s = (Math.min(o, 1 - o) * i - Pt) / .29999999999999993, c = Z(s), l = en(Mt, jt, 1 - qt(c)), u = 0;
			if (s > 0 && s < 1) {
				let e = (o < .5 ? i : -i) / .29999999999999993;
				u = -.497 * Jt(c) * e;
			}
			return {
				position: {
					x: en(e.x, t.x, o),
					y: l,
					z: en(e.z, t.z, o)
				},
				derivative: {
					x: n,
					y: u,
					z: r
				}
			};
		};
	}
	createOverpassEvaluator(e, t, n) {
		let r = n.x - t.x, i = n.z - t.z, a = Math.hypot(r, i);
		if (a <= X) throw Error(`Overpass "${e.id}" endpoints must not coincide.`);
		let o = e.platformEdgeOffset + e.straightApproachLength;
		if (o * 2 >= a) throw Error(`Overpass "${e.id}" approaches consume its entire span.`);
		let s = r / a, c = i / a, l = (t.x + n.x) / 2, u = (t.z + n.z) / 2, d = a / 2 - o, f = e.bridgeSurfaceY - Mt, p = Wt(d, f), m = Math.hypot(o, .497), h = m / (p + m * 2), g = h, _ = 1 - h, v = _ - g;
		return (e) => {
			let r = Z(e);
			if (r < g) {
				let e = r / h, n = o * e, i = Ut(n), a = o / h;
				return {
					position: {
						x: t.x + s * n,
						y: i.surfaceY,
						z: t.z + c * n
					},
					derivative: {
						x: s * a,
						y: i.derivativePerDistance * a,
						z: c * a
					}
				};
			}
			if (r > _) {
				let e = (r - _) / h, t = o * (1 - e), i = Ut(t), a = o / h;
				return {
					position: {
						x: n.x - s * t,
						y: i.surfaceY,
						z: n.z - c * t
					},
					derivative: {
						x: s * a,
						y: -i.derivativePerDistance * a,
						z: c * a
					}
				};
			}
			let i = Bt((r - g) / v, d), a = d * i.normalizedX, p = l + s * a, m = u + c * a, y = Mt + f * i.normalizedHeight, b = d * i.normalizedXDerivative / v;
			return {
				position: {
					x: p,
					y,
					z: m
				},
				derivative: {
					x: s * b,
					y: f * i.normalizedHeightDerivative / v,
					z: c * b
				}
			};
		};
	}
	auditOverpassClearance(e, t) {
		let n = this.compiledById.get(e.id), r = this.compiledById.get(t);
		if (!r) throw Error(`Missing compiled underpass "${t}".`);
		let i = (Gt(n.edge) + Gt(r.edge)) / 2, a = Infinity, o = -Infinity, s = Infinity, c = Infinity, l = -Infinity, u = Infinity, d = 0, f = 0;
		for (let t = 0; t <= Ft; t += 1) {
			let p = t / Ft, m = n.sampleSourceT(p).position, h = Kt(m, r.samples);
			if (h.distanceXZ < u && (u = h.distanceXZ, d = p, f = h.sourceT), h.distanceXZ > i + X) continue;
			a = Math.min(a, p), o = Math.max(o, p);
			let g = m.y - e.deckThickness, _ = g - h.surfaceY;
			_ < s && (s = _, c = g, l = h.surfaceY);
		}
		if (!Number.isFinite(a) || !Number.isFinite(s)) throw Error(`Overpass "${e.id}" has no measurable overlap with "${t}".`);
		let p = this.overpassProfileAudits.find((t) => t.edgeId === e.id)?.isSymmetric ?? !1, m = p && s + X >= e.requiredClearance;
		return Object.freeze({
			overpassEdgeId: e.id,
			underpassEdgeId: t,
			requiredClearance: e.requiredClearance,
			minimumClearance: s,
			bridgeBottomY: c,
			underpassSurfaceY: l,
			crossingSourceT: d,
			underpassCrossingSourceT: f,
			overlapStartT: a,
			overlapEndT: o,
			bridgeSurfaceY: e.bridgeSurfaceY,
			isSymmetric: p,
			passed: m
		});
	}
}, Rt = .08, zt = .65;
function Bt(e, t) {
	let n = Z(e), r = n <= .5, a = r ? n * 2 : (n - .5) * 2, o = (r ? a : 1 - a) * t, s = t > 2.3 ? t / i : 1, c = Vt(Z(t > 2.3 ? o / i : o / t));
	return {
		normalizedX: r ? -1 + a : a,
		normalizedHeight: c.height,
		normalizedXDerivative: 2,
		normalizedHeightDerivative: (r ? 1 : -1) * c.derivative * s * 2
	};
}
function Vt(e) {
	let t = Z(e), n = Rt, r = zt, i = 1 / .7850000000000001;
	if (t < n) {
		let e = t / n;
		return {
			height: i * n * Ht(e),
			derivative: i * qt(e)
		};
	}
	if (t <= r) return {
		height: i * (t - n / 2),
		derivative: i
	};
	let a = .35, o = (t - r) / a;
	return {
		height: i * (r - n / 2) + i * a * (o - Ht(o)),
		derivative: i * (1 - qt(o))
	};
}
function Ht(e) {
	let t = Z(e);
	return t ** 6 - 3 * t ** 5 + 2.5 * t ** 4;
}
function Ut(e) {
	let t = (e - Pt) / .29999999999999993, n = Z(t), r = 1 - qt(n), i = t > 0 && t < 1 ? -.497 * Jt(n) / .29999999999999993 : 0;
	return {
		surfaceY: en(Mt, jt, r),
		derivativePerDistance: i
	};
}
function Wt(e, t) {
	let n = 0, r = Bt(0, e);
	for (let i = 1; i <= 256; i += 1) {
		let a = Bt(i / 256, e);
		n += Math.hypot((a.normalizedX - r.normalizedX) * e, (a.normalizedHeight - r.normalizedHeight) * t), r = a;
	}
	return n;
}
function Gt(e) {
	return e.pathKind === "overpass" ? e.width : Nt;
}
function Kt(e, t) {
	let n = Infinity, r = t[0].surfaceY, i = t[0].sourceT;
	for (let a = 1; a < t.length; a += 1) {
		let o = t[a - 1], s = t[a], c = s.position.x - o.position.x, l = s.position.z - o.position.z, u = c * c + l * l, d = u > X ? Z(((e.x - o.position.x) * c + (e.z - o.position.z) * l) / u) : 0, f = o.position.x + c * d, p = o.position.z + l * d, m = e.x - f, h = e.z - p, g = m * m + h * h;
		g < n && (n = g, r = en(o.surfaceY, s.surfaceY, d), i = en(o.sourceT, s.sourceT, d));
	}
	return {
		distanceXZ: Math.sqrt(n),
		surfaceY: r,
		sourceT: i
	};
}
function qt(e) {
	let t = Z(e);
	return t * t * t * (t * (t * 6 - 15) + 10);
}
function Jt(e) {
	let t = Z(e);
	return 30 * t * t * (t - 1) * (t - 1);
}
function Yt(e) {
	let t = Math.hypot(e.x, e.y, e.z);
	if (!Number.isFinite(t) || t <= X) throw Error("Path curve produced a zero or non-finite tangent.");
	return {
		x: e.x / t,
		y: e.y / t,
		z: e.z / t
	};
}
function Xt(e, t) {
	return Math.hypot(t.x - e.x, t.y - e.y, t.z - e.z);
}
function Zt(e, t) {
	if (!Number.isFinite(e)) throw Error(`${t} must be finite.`);
}
function Qt(e, t) {
	return e.pathKind === t.pathKind && e.fromNodeId === t.fromNodeId && e.toNodeId === t.toNodeId && JSON.stringify(e) === JSON.stringify(t);
}
function $t(e, t) {
	Zt(e.x, `${t} x`), Zt(e.z, `${t} z`);
}
function Z(e) {
	return Math.max(0, Math.min(1, e));
}
function en(e, t, n) {
	return e + (t - e) * n;
}
//#endregion
//#region src/simulation/PathRuleCoordinator.ts
var Q = class extends Error {
	reason;
	constructor(e, t) {
		super(t), this.reason = e;
	}
}, tn = class {
	nodes;
	authoredStraightEdges;
	authoredLogicalEdges;
	dynamicBridgeRule;
	specialZones;
	overpassPairLookup;
	basePathIndex;
	nodeById = /* @__PURE__ */ new Map();
	straightEdgeById = /* @__PURE__ */ new Map();
	zoneById = /* @__PURE__ */ new Map();
	activationZoneByNodeId = /* @__PURE__ */ new Map();
	memberZoneByNodeId = /* @__PURE__ */ new Map();
	entryConnectorIdByZoneId = /* @__PURE__ */ new Map();
	unlockedNodeIds = /* @__PURE__ */ new Set();
	unlockedStraightEdgeIds = /* @__PURE__ */ new Set();
	bridgeRegistry = /* @__PURE__ */ new Map();
	activeZoneSession = null;
	activeStraightPathIndex;
	revision = 0;
	pendingNavigation = null;
	pendingZoneRevealById = /* @__PURE__ */ new Map();
	pendingZoneDismissById = /* @__PURE__ */ new Map();
	recoveryPayloadByCheckpoint = /* @__PURE__ */ new WeakMap();
	restoredRecoveryCheckpoints = /* @__PURE__ */ new WeakSet();
	constructor(e) {
		this.nodes = e.nodes, this.authoredStraightEdges = e.authoredStraightEdges, this.authoredLogicalEdges = e.authoredLogicalEdges, this.dynamicBridgeRule = e.dynamicBridgeRule, this.specialZones = e.specialZones, this.overpassPairLookup = e.overpassPairLookup, this.basePathIndex = e.basePathIndex, this.validateAndIndexConfiguration(), this.nodes.forEach((e) => {
			e.initiallyVisible && this.unlockedNodeIds.add(e.id);
		}), this.authoredStraightEdges.forEach((e) => {
			e.initiallyVisible && this.unlockedStraightEdgeIds.add(e.id);
		}), this.activeStraightPathIndex = this.buildActiveStraightPathIndex(), this.assertInvariants();
	}
	isNodeUnlocked(e) {
		return this.unlockedNodeIds.has(e);
	}
	isStraightEdgeUnlocked(e) {
		return this.unlockedStraightEdgeIds.has(e);
	}
	isZoneActivated(e) {
		return this.activeZoneSession?.zoneId === e && this.activeZoneSession.state !== "revealing";
	}
	getActiveBridgeInstances() {
		return Object.freeze([...this.bridgeRegistry.values()].filter((e) => e.active).sort(vn).map(fn));
	}
	createRecoveryCheckpoint() {
		this.assertInvariants();
		let e = Object.freeze(Object.create(null));
		return this.recoveryPayloadByCheckpoint.set(e, {
			revision: this.revision,
			unlockedNodeIds: [...this.unlockedNodeIds],
			unlockedStraightEdgeIds: [...this.unlockedStraightEdgeIds],
			bridgeRegistry: [...this.bridgeRegistry.values()].map(rn),
			activeZoneSession: an(this.activeZoneSession),
			entryConnectorIdByZoneId: [...this.entryConnectorIdByZoneId.entries()],
			pendingNavigation: on(this.pendingNavigation),
			pendingZoneReveals: [...this.pendingZoneRevealById.entries()].map(([e, t]) => [e, sn(t)]),
			pendingZoneDismissals: [...this.pendingZoneDismissById.entries()].map(([e, t]) => [e, cn(t)])
		}), e;
	}
	restoreRecoveryCheckpoint(e) {
		if (typeof e != "object" || !e) throw Error("Path-rule recovery checkpoint is invalid.");
		if (this.restoredRecoveryCheckpoints.has(e)) throw Error("Path-rule recovery checkpoint was already restored.");
		let t = this.recoveryPayloadByCheckpoint.get(e);
		if (!t) throw Error("Path-rule recovery checkpoint belongs to another coordinator or is invalid.");
		let n = Math.max(this.revision, t.revision) + 1;
		ln(this.unlockedNodeIds, t.unlockedNodeIds), ln(this.unlockedStraightEdgeIds, t.unlockedStraightEdgeIds), un(this.bridgeRegistry, t.bridgeRegistry.map((e) => [e.bridgeId, rn(e)])), this.activeZoneSession = an(t.activeZoneSession), un(this.entryConnectorIdByZoneId, t.entryConnectorIdByZoneId), this.pendingNavigation = on(t.pendingNavigation), un(this.pendingZoneRevealById, t.pendingZoneReveals.map(([e, t]) => [e, sn(t)])), un(this.pendingZoneDismissById, t.pendingZoneDismissals.map(([e, t]) => [e, cn(t)])), this.revision = n, this.rebuildActiveStraightPathIndex(), this.assertInvariants(), this.restoredRecoveryCheckpoints.add(e);
	}
	discardPendingTransactionsAfterRecovery() {
		this.pendingNavigation = null, this.pendingZoneRevealById.clear(), this.pendingZoneDismissById.clear(), this.activeZoneSession && this.stabilizeActiveZoneSessionAfterRecovery(this.activeZoneSession), this.nextRevision(), this.rebuildActiveStraightPathIndex(), this.assertInvariants();
	}
	planIdleZoneReveal(e) {
		if (this.pendingNavigation || this.pendingZoneDismissById.size > 0) return null;
		let t = this.activeZoneSession, n = t ? this.zoneById.get(t.zoneId) ?? null : this.activationZoneByNodeId.get(e) ?? null;
		if (!n || t && (t.state === "dismissing" || !this.isNodeInSession(e, t, n))) return null;
		let r = this.pendingZoneRevealById.get(n.id);
		if (r) return r.plan;
		if (this.pendingZoneRevealById.size > 0) return null;
		let i = [...this.bridgeRegistry.values()].some((e) => e.active && e.role !== "zone-entry");
		if (t && this.isSessionEntryConnectorActive(t) && !i) return null;
		let a = this.nextRevision(), o = t ?? this.createZoneSession(n, e, a), s = this.snapshotActiveBridges(), c = [...s.values()].filter((e) => e.role !== "zone-entry" || e.zoneSessionId !== o.id).sort((t, n) => this.compareBridgesByCharacterProximity(t, n, e)).map((t) => this.makeRetireBridgeAction(t, e));
		c.forEach((e) => {
			pn(e, s);
		});
		let l = (t ? [Object.freeze({ kind: "session-entry-connector" })] : n.revealSequence.slice(o.revealProgress)).map((t, r) => {
			let i = this.resolveRevealStep(t, o), a = i.kind === "bridge" ? this.makeEnsureBridgeAction(i.endpoints.fromNodeId, i.endpoints.toNodeId, o.activationNodeId, "zone-entry", n.id, o.id, e, s) : null;
			return Object.freeze({
				index: r,
				source: i,
				bridgeAction: a
			});
		}), u = Object.freeze({
			id: `zone-reveal:${n.id}:${a}`,
			revision: a,
			zoneId: n.id,
			sessionId: o.id,
			activationNodeId: o.activationNodeId,
			entryConnectorKind: o.entryConnector.kind,
			entryConnectorId: o.entryConnector.edgeId,
			entryConnectorEndpoints: o.entryConnector.endpoints,
			entryBridgeEndpoints: o.entryConnector.endpoints,
			characterNodeId: e,
			kind: t ? "restore-entry-connector" : "initial-reveal",
			beforeRevealBridgeActions: Object.freeze(c),
			steps: Object.freeze(l)
		});
		return this.pendingZoneRevealById.set(n.id, {
			plan: u,
			nextBeforeActionIndex: 0,
			nextStepIndex: 0
		}), u;
	}
	commitZoneRevealBeforeAction(e, t) {
		let n = this.findPendingZoneReveal(e);
		if (t !== n.nextBeforeActionIndex) throw Error(`Zone reveal "${e}" expected before-action ${n.nextBeforeActionIndex}, received ${t}.`);
		let r = n.plan.beforeRevealBridgeActions[t];
		if (!r) throw Error(`Zone reveal "${e}" has no before-action ${t}.`);
		this.applyBridgeAction(r), n.nextBeforeActionIndex += 1, this.assertInvariants();
	}
	commitZoneRevealStep(e, t) {
		let n = this.findPendingZoneReveal(e);
		if (n.nextBeforeActionIndex !== n.plan.beforeRevealBridgeActions.length) throw Error(`Zone reveal "${e}" still has before-actions.`);
		if (t !== n.nextStepIndex) throw Error(`Zone reveal "${e}" expected step ${n.nextStepIndex}, received ${t}.`);
		let r = n.plan.steps[t];
		if (!r) throw Error(`Zone reveal "${e}" has no step ${t}.`);
		r.source.kind === "node" ? this.unlockNode(r.source.nodeId) : r.source.kind === "straight-edge" ? this.unlockStraightEdge(r.source.edgeId) : r.bridgeAction && this.applyBridgeAction(r.bridgeAction), n.nextStepIndex += 1;
		let i = this.requireSession(n.plan.sessionId);
		n.plan.kind === "initial-reveal" && (i.revealProgress += 1), n.nextStepIndex === n.plan.steps.length && (i.state = "active", this.pendingZoneRevealById.delete(n.plan.zoneId)), this.assertInvariants();
	}
	commitEntireZoneReveal(e) {
		let t = this.findPendingZoneReveal(e);
		for (; t.nextBeforeActionIndex < t.plan.beforeRevealBridgeActions.length;) this.commitZoneRevealBeforeAction(e, t.nextBeforeActionIndex);
		for (; t.nextStepIndex < t.plan.steps.length;) this.commitZoneRevealStep(e, t.nextStepIndex);
	}
	planZoneDepartureDismissal(e, t) {
		return null;
	}
	planIdleZoneDismissal(e) {
		if (!this.nodeById.has(e) || this.pendingNavigation || this.pendingZoneRevealById.size > 0) return null;
		let t = [...this.pendingZoneDismissById.values()].sort((e, t) => e.plan.zoneId.localeCompare(t.plan.zoneId))[0];
		if (t) return t.plan;
		let n = this.activeZoneSession, r = n ? this.zoneById.get(n.zoneId) ?? null : null;
		return !n || !r || n.state !== "active" || this.isNodeInSession(e, n, r) ? null : this.buildZoneDismissPlan(n, r, e, "idle-outside-zone");
	}
	buildZoneDismissPlan(e, t, n, r) {
		let i = this.createZoneDismissPlan(e, t, n, r, null);
		return this.registerZoneDismissPlan(e, t, i), i;
	}
	createZoneDismissPlan(e, t, n, r, i) {
		let a = this.nextRevision(), o = [...t.revealSequence].reverse().map((t) => this.resolveRevealStep(t, e)).filter((e) => e.kind !== "bridge").map((e) => Object.freeze({
			source: e,
			bridgeAction: null
		})).map((e, t) => Object.freeze({
			index: t,
			source: e.source,
			bridgeAction: e.bridgeAction
		}));
		return Object.freeze({
			id: `zone-dismiss:${t.id}:${a}`,
			revision: a,
			zoneId: t.id,
			sessionId: e.id,
			activationNodeId: e.activationNodeId,
			entryConnectorKind: e.entryConnector.kind,
			entryConnectorId: e.entryConnector.edgeId,
			entryConnectorEndpoints: e.entryConnector.endpoints,
			entryBridgeEndpoints: e.entryConnector.endpoints,
			characterNodeId: n,
			kind: "zone-dismissal",
			trigger: r,
			linkedNavigationPlanId: i,
			steps: Object.freeze(o)
		});
	}
	registerZoneDismissPlan(e, t, n) {
		e.state = "dismissing", this.pendingZoneDismissById.set(t.id, {
			plan: n,
			nextStepIndex: 0
		});
	}
	commitZoneDismissStep(e, t) {
		let n = this.findPendingZoneDismiss(e);
		if (t !== n.nextStepIndex) throw Error(`Zone dismissal "${e}" expected step ${n.nextStepIndex}, received ${t}.`);
		let r = n.plan.steps[t];
		if (!r) throw Error(`Zone dismissal "${e}" has no step ${t}.`);
		if (n.plan.trigger === "concurrent-departure-from-session-envelope") {
			let t = this.pendingNavigation;
			if (!t || t.plan.id !== n.plan.linkedNavigationPlanId || !t.departureCommitted) throw Error(`Concurrent dismissal "${e}" cannot commit before its linked navigation emits MOTION.DEPARTED and starts stage 0.`);
			let r = [...this.bridgeRegistry.values()].find((e) => e.active && e.zoneSessionId === n.plan.sessionId);
			if (r) throw Error(`Concurrent dismissal "${e}" must wait for navigation to retire session bridge "${r.bridgeId}".`);
		}
		if (r.source.kind === "bridge") {
			if (!r.bridgeAction || r.bridgeAction.kind !== "retire-bridge") throw Error(`Zone dismissal "${e}" has an invalid bridge step.`);
			this.applyBridgeAction(r.bridgeAction);
		} else r.source.kind === "node" ? this.lockNode(r.source.nodeId) : this.lockStraightEdge(r.source.edgeId);
		n.nextStepIndex += 1, n.nextStepIndex === n.plan.steps.length && this.finishZoneDismissal(n.plan.zoneId), this.assertInvariants();
	}
	commitEntireZoneDismissal(e) {
		let t = this.findPendingZoneDismiss(e);
		for (; t.nextStepIndex < t.plan.steps.length;) this.commitZoneDismissStep(e, t.nextStepIndex);
	}
	planNavigation(e, t) {
		if (this.pendingNavigation || this.pendingZoneRevealById.size > 0 || this.pendingZoneDismissById.size > 0) return dn("rule-conflict", "A rule transaction is already awaiting visual or movement commits.");
		if (!this.nodeById.has(e) || !this.nodeById.has(t)) return dn("unknown-node", "Navigation references an unknown node.");
		if (!this.unlockedNodeIds.has(e)) return dn("locked-node", `Current node "${e}" is locked.`);
		if (!this.unlockedNodeIds.has(t)) return dn("locked-node", `Target node "${t}" is locked.`);
		if (this.hasActivatedZoneOutsideCharacter(e)) return dn("rule-conflict", "A completed zone exit must finish its idle dismissal before navigation.");
		let n = this.resolveConcurrentZoneDeparture(e, t), r = this.nextRevision(), i = {
			activeBridges: this.snapshotActiveBridges(),
			stages: [],
			pendingBeforeActions: [],
			traversedTransientBridgeIds: /* @__PURE__ */ new Set()
		};
		try {
			e !== t && (this.buildNavigationStages(e, t, i), this.attachTransientRetirements(i, t)), n && this.normalizeConcurrentDepartureBridgeActions(n.session, i);
			let a = `navigation-plan:${r}`, o = n ? this.createZoneDismissPlan(n.session, n.zone, e, "concurrent-departure-from-session-envelope", a) : null, s = this.freezeNavigationPlan(r, e, t, i.stages, o?.id ?? null);
			return o && this.validateConcurrentDepartureTransaction(n.session, s, o), this.pendingNavigation = s.stages.length === 0 ? null : {
				plan: s,
				nextStageIndex: 0,
				nextBeforeActionIndex: 0,
				nextAfterActionIndex: 0,
				awaitingArrival: !1,
				departureCommitted: !1
			}, o && this.registerZoneDismissPlan(n.session, n.zone, o), this.assertInvariants(), {
				accepted: !0,
				plan: s,
				concurrentZoneDismissalPlan: o
			};
		} catch (e) {
			if (e instanceof Q) return dn(e.reason, e.message);
			throw e;
		}
	}
	commitNavigationBeforeAction(e, t, n) {
		let r = this.requirePendingNavigation(e, t);
		if (r.awaitingArrival) throw Error(`Navigation stage ${t} has already started.`);
		if (n !== r.nextBeforeActionIndex) throw Error(`Navigation stage ${t} expected before-action ${r.nextBeforeActionIndex}, received ${n}.`);
		let i = r.plan.stages[t].beforeTravelBridgeActions[n];
		if (!i) throw Error(`Navigation stage ${t} has no before-action ${n}.`);
		this.applyBridgeAction(i), r.nextBeforeActionIndex += 1, this.assertInvariants();
	}
	commitNavigationStageStarted(e, t) {
		let n = this.requirePendingNavigation(e, t), r = n.plan.stages[t];
		if (n.nextBeforeActionIndex !== r.beforeTravelBridgeActions.length) throw Error(`Navigation stage ${t} still has uncommitted before-actions.`);
		if (n.awaitingArrival) throw Error(`Navigation stage ${t} was already started.`);
		n.awaitingArrival = !0, t === 0 && (n.departureCommitted = !0), this.assertInvariants();
	}
	commitNavigationAfterAction(e, t, n, r) {
		let i = this.requirePendingNavigation(e, t), a = i.plan.stages[t];
		if (this.assertExpectedArrival(i, a, r), n !== i.nextAfterActionIndex) throw Error(`Navigation stage ${t} expected after-action ${i.nextAfterActionIndex}, received ${n}.`);
		let o = a.afterArrivalBridgeActions[n];
		if (!o) throw Error(`Navigation stage ${t} has no after-action ${n}.`);
		this.applyBridgeAction(o), i.nextAfterActionIndex += 1, this.assertInvariants();
	}
	commitNavigationStageArrived(e, t, n) {
		let r = this.requirePendingNavigation(e, t), i = r.plan.stages[t];
		if (this.assertExpectedArrival(r, i, n), r.nextAfterActionIndex !== i.afterArrivalBridgeActions.length) throw Error(`Navigation stage ${t} still has uncommitted after-actions.`);
		r.nextStageIndex += 1, r.nextBeforeActionIndex = 0, r.nextAfterActionIndex = 0, r.awaitingArrival = !1, r.nextStageIndex === r.plan.stages.length && (r.plan.linkedZoneDismissalPlanId !== null && [...this.pendingZoneDismissById.values()].some((e) => e.plan.id === r.plan.linkedZoneDismissalPlanId) || (this.pendingNavigation = null)), this.assertInvariants();
	}
	cancelNavigationPlan(e) {
		let t = this.pendingNavigation;
		if (!t || t.plan.id !== e) return;
		let n = t.plan.linkedZoneDismissalPlanId;
		if (n) {
			let r = [...this.pendingZoneDismissById.values()].find((e) => e.plan.id === n);
			if (!r) throw Error(`Navigation plan "${e}" cannot be cancelled after its linked dismissal has completed.`);
			if (!(t.nextStageIndex === 0 && t.nextBeforeActionIndex === 0 && t.nextAfterActionIndex === 0 && !t.awaitingArrival && !t.departureCommitted && r.nextStepIndex === 0)) throw Error(`Atomic navigation plan "${e}" cannot be cancelled after commits begin.`);
			this.pendingZoneDismissById.delete(r.plan.zoneId);
			let i = this.activeZoneSession;
			if (!i || i.id !== r.plan.sessionId) throw Error(`Atomic navigation plan "${e}" lost its zone session.`);
			i.state = "active", this.nextRevision();
		}
		this.pendingNavigation = null, this.assertInvariants();
	}
	unlockNode(e) {
		if (!this.nodeById.has(e)) throw Error(`Cannot unlock unknown node "${e}".`);
		this.unlockedNodeIds.has(e) || (this.unlockedNodeIds.add(e), this.nextRevision(), this.rebuildActiveStraightPathIndex());
	}
	unlockStraightEdge(e) {
		if (!this.straightEdgeById.get(e)) throw Error(`Cannot unlock unknown straight edge "${e}".`);
		this.unlockedStraightEdgeIds.has(e) || (this.unlockedStraightEdgeIds.add(e), this.nextRevision(), this.rebuildActiveStraightPathIndex());
	}
	lockNode(e) {
		let t = this.nodeById.get(e);
		if (!t) throw Error(`Cannot lock unknown node "${e}".`);
		if (t.initiallyVisible) throw Error(`Repeatable dismissal cannot lock initial node "${e}".`);
		this.unlockedNodeIds.delete(e) && (this.nextRevision(), this.rebuildActiveStraightPathIndex());
	}
	lockStraightEdge(e) {
		let t = this.straightEdgeById.get(e);
		if (!t) throw Error(`Cannot lock unknown straight edge "${e}".`);
		if (t.initiallyVisible) throw Error(`Repeatable dismissal cannot lock initial edge "${e}".`);
		this.unlockedStraightEdgeIds.delete(e) && (this.nextRevision(), this.rebuildActiveStraightPathIndex());
	}
	retireBridge(e, t) {
		if (!this.nodeById.has(t)) throw Error(`Cannot retire a bridge from unknown safe node "${t}".`);
		this.commitBridgeRetirement(e), this.assertInvariants();
	}
	getDebugSnapshot() {
		let e = this.specialZones.map((e) => {
			let t = this.activeZoneSession?.zoneId === e.id ? this.activeZoneSession : null, n = t ? this.entryConnectorIdByZoneId.get(e.id) ?? null : null, r = t?.entryConnector.kind === "overpass" ? n : null, i = t !== null && t.state !== "revealing", a = this.pendingZoneRevealById.has(e.id), o = this.pendingZoneDismissById.has(e.id), s = r === null ? null : this.bridgeRegistry.get(r) ?? null;
			return Object.freeze({
				id: e.id,
				activated: i,
				revealProgress: t?.revealProgress ?? 0,
				revealStepCount: e.revealSequence.length,
				entryConnectorKind: t?.entryConnector.kind ?? null,
				entryConnectorId: n,
				entryConnectorActive: t ? this.isSessionEntryConnectorActive(t) : !1,
				entryConnectorEndpoints: t?.entryConnector.endpoints ?? null,
				entryBridgeId: r,
				entryBridgeActive: s?.active === !0 && s.role === "zone-entry" && s.zoneSessionId === t?.id,
				dismissalPending: o,
				sessionState: o ? "dismissing" : a ? "revealing" : i ? "active" : "inactive",
				sessionId: t?.id ?? null,
				activationNodeId: t?.activationNodeId ?? null,
				entryNodeId: e.entryNodeId,
				entryBridgeEndpoints: t?.entryConnector.endpoints ?? null
			});
		});
		return Object.freeze({
			revision: this.revision,
			unlockedNodeIds: Object.freeze([...this.unlockedNodeIds].sort()),
			unlockedStraightEdgeIds: Object.freeze([...this.unlockedStraightEdgeIds].sort()),
			zones: Object.freeze(e),
			bridges: Object.freeze([...this.bridgeRegistry.values()].sort(vn).map(fn)),
			invariants: this.getInvariantDebug()
		});
	}
	hasVisibleZoneSession() {
		return this.activeZoneSession !== null;
	}
	restoreStableZoneSessionForNode(e, t) {
		if (!this.nodeById.has(e)) throw Error(`Cannot restore an unknown node "${e}".`);
		let n = this.memberZoneByNodeId.get(e) ?? null;
		if (!n) return null;
		let r = this.activeZoneSession;
		if (r) {
			if (r.zoneId !== n.id || r.state !== "active" || !this.isNodeInSession(e, r, n)) throw Error(`Cannot restore zone "${n.id}" while session "${r.id}" is active.`);
			return Object.freeze({
				zoneId: n.id,
				sessionId: r.id,
				activationNodeId: r.activationNodeId,
				entryNodeId: r.entryNodeId
			});
		}
		if (this.pendingNavigation || this.pendingZoneRevealById.size > 0 || this.pendingZoneDismissById.size > 0) throw Error(`Cannot restore zone "${n.id}" while another path transaction is pending.`);
		let i = t ?? n.activationNodeIds.find((e) => this.unlockedNodeIds.has(e)) ?? n.activationNodeIds[0];
		if (!i || !n.activationNodeIds.includes(i)) throw Error(`Node "${String(t)}" is not an activation for zone "${n.id}".`);
		this.unlockNode(i);
		let a = this.planIdleZoneReveal(i);
		if (!a) throw Error(`Cannot reconstruct the reveal plan for zone "${n.id}".`);
		this.commitEntireZoneReveal(a.id);
		let o = this.activeZoneSession;
		if (!o || o.zoneId !== n.id || o.state !== "active" || !this.unlockedNodeIds.has(e) || !this.isSessionEntryConnectorActive(o)) throw Error(`Zone "${n.id}" did not reach a stable restored state.`);
		return this.assertInvariants(), Object.freeze({
			zoneId: n.id,
			sessionId: o.id,
			activationNodeId: o.activationNodeId,
			entryNodeId: o.entryNodeId
		});
	}
	assertInvariants() {
		let e = this.getInvariantDebug();
		if (e.violations.length > 0) throw Error(`Path-rule invariant failed: ${e.violations.join("; ")}`);
	}
	resolveConcurrentZoneDeparture(e, t) {
		let n = this.activeZoneSession, r = n ? this.zoneById.get(n.zoneId) ?? null : null;
		return !n || !r || n.state !== "active" || t === e || !this.isNodeInSession(e, n, r) || !this.unlockedNodeIds.has(t) || this.isNodeInSession(t, n, r) ? null : {
			session: n,
			zone: r
		};
	}
	normalizeConcurrentDepartureBridgeActions(e, t) {
		let n = t.stages[0];
		if (!n) throw new Q("unreachable", "Concurrent zone departure did not produce a navigation stage.");
		let r = e.entryConnector.kind === "overpass" ? this.bridgeRegistry.get(e.entryConnector.edgeId) ?? null : null, i = r?.active === !0 && r.role === "zone-entry" && r.zoneSessionId === e.id ? r.bridgeId : null, a = (e) => e.filter((e) => e.kind !== "retire-bridge" || e.bridgeId !== i);
		t.stages.forEach((e) => {
			e.beforeTravelBridgeActions = a(e.beforeTravelBridgeActions), e.afterArrivalBridgeActions = a(e.afterArrivalBridgeActions);
		}), t.pendingBeforeActions = a(t.pendingBeforeActions), n.beforeTravelBridgeActions = [...i && r ? [this.makeRetireBridgeAction(fn(r), e.activationNodeId)] : [], ...n.beforeTravelBridgeActions], i && t.activeBridges.delete(i);
	}
	validateConcurrentDepartureTransaction(e, t, n) {
		if (n.trigger !== "concurrent-departure-from-session-envelope" || n.linkedNavigationPlanId !== t.id || t.linkedZoneDismissalPlanId !== n.id) throw new Q("rule-conflict", "Concurrent zone departure plans are not linked symmetrically.");
		if (n.steps.some((e) => e.source.kind === "bridge" || e.bridgeAction !== null)) throw new Q("rule-conflict", "Concurrent construct dismissal cannot contain bridge steps.");
		let r = e.entryConnector.kind === "overpass" && this.bridgeRegistry.get(e.entryConnector.edgeId)?.active === !0 ? e.entryConnector.edgeId : null, i = t.stages[0];
		if (!i) throw new Q("unreachable", "Concurrent zone departure has no first navigation stage.");
		let a = t.stages.flatMap((e) => [...e.beforeTravelBridgeActions, ...e.afterArrivalBridgeActions]);
		if (r) {
			let e = a.filter((e) => e.kind === "retire-bridge" && e.bridgeId === r).length;
			if (e !== 1) throw new Q("rule-conflict", `Session entry bridge "${r}" has ${e} departure retirements.`);
		}
		let o = i.beforeTravelBridgeActions[0];
		if (r && (o?.kind !== "retire-bridge" || o.bridgeId !== r || o.characterSideNodeId !== e.activationNodeId)) throw new Q("rule-conflict", "The session entry overpass must preclear left-to-right before travel.");
		let s = this.snapshotActiveBridges();
		t.stages.forEach((t) => {
			t.beforeTravelBridgeActions.forEach((t) => {
				if (t.kind === "ensure-bridge" && t.bridge.role === "ordinary") {
					let t = [...s.values()].find((t) => t.active && t.zoneSessionId === e.id);
					if (t) throw new Q("rule-conflict", `Ordinary bridge was ensured before session bridge "${t.bridgeId}" retired.`);
				}
				pn(t, s);
			}), t.afterArrivalBridgeActions.forEach((e) => {
				pn(e, s);
			});
		});
	}
	buildNavigationStages(e, t, n) {
		if (e === t) return;
		let r = this.activeZoneSession, i = r ? this.zoneById.get(r.zoneId) ?? null : null, a = r !== null && i !== null && this.isNodeInSession(e, r, i), o = r !== null && i !== null && this.isNodeInSession(t, r, i);
		if (a && r && i) {
			if (r.state !== "active") throw new Q("rule-conflict", `Zone session "${r.id}" is not ready for traversal.`);
			o ? this.planInsideZone(i, r, e, t, n) : this.planLeaveZone(i, r, e, t, n);
			return;
		}
		if (o) throw new Q("rule-conflict", "An active zone cannot be entered from outside before its prior exit is dismissed.");
		this.planOrdinaryRoute(e, t, n, "base-route", "ordinary-overpass");
	}
	planInsideZone(e, t, n, r, i) {
		this.planEnsureZoneEntry(t, n, i);
		let a = e.activationMemberRoutingPolicy === "direct-only-from-activation-to-far-member-otherwise-existing-chain" && n === t.activationNodeId && e.memberNodeIds.includes(r) ? this.sessionAwareHopDistance(n, r) : null;
		if (a !== null && this.requiresDynamicBridge(a)) {
			this.planZoneTransientOverpass(e, n, r, i, a, !0);
			return;
		}
		if (n === t.activationNodeId) {
			this.addSessionEntryStage(t, n, e.entryNodeId, i), r !== e.entryNodeId && this.planZoneMemberRoute(e.entryNodeId, r, i);
			return;
		}
		if (r === t.activationNodeId) {
			n !== e.entryNodeId && this.planZoneMemberRoute(n, e.entryNodeId, i), this.addSessionEntryStage(t, e.entryNodeId, t.activationNodeId, i);
			return;
		}
		this.planZoneMemberRoute(n, r, i);
	}
	planZoneMemberRoute(e, t, n) {
		let r = this.activeStraightPathIndex.shortestRoute(e, t), i = this.basePathIndex.hopDistance(e, t);
		if (!r || i === null) throw new Q("unreachable", `No existing brown-chain route exists from "${e}" to "${t}".`);
		this.addBaseStage(r, "zone-base-route", i, n);
	}
	planZoneTransientOverpass(e, t, n, r, i, a = !1) {
		let o = mn(r.activeBridges, t, n);
		if (o) {
			this.addOverpassStage(t, n, o.edge, "reuse-overpass", r, i);
			return;
		}
		let s = this.requireOverpass(t, n);
		this.planRetireUnservedTransientBridges(s.id, t, r);
		let c = hn(r.activeBridges, t), l = a && c?.role === "zone-entry";
		c && c.bridgeId !== s.id && !l && this.queueBridgeAction(this.makeRetireBridgeAction(c, t), r);
		let u = this.requireActiveSessionForZone(e.id), d = this.planEnsureBridge(t, n, t, "zone-transient", e.id, u.id, t, r, a);
		if (!d && !mn(r.activeBridges, t, n)) throw new Q("rule-conflict", `Node "${t}" already owns a different transient bridge.`);
		let f = this.requireOverpass(t, n);
		this.addOverpassStage(t, n, f, d ? "zone-transient-overpass" : "reuse-overpass", r, i);
	}
	planLeaveZone(e, t, n, r, i) {
		let a = n === t.activationNodeId ? null : this.activeStraightPathIndex.shortestRoute(n, e.entryNodeId), o = this.activeStraightPathIndex.shortestRoute(t.activationNodeId, r), s = this.sessionAwareHopDistance(n, r);
		if (s === null || !o || n !== t.activationNodeId && !a) throw new Q("unreachable", `No resolved zone-exit route exists from "${n}" to "${r}".`);
		if (t.entryConnector.kind === "overpass" && n !== t.activationNodeId) {
			this.planSafeMemberDepartureAfterEntryPreclear(e, t, n, r, s, i);
			return;
		}
		if (!this.requiresDynamicBridge(s)) {
			this.planRetireUnservedTransientBridges(null, n, i), a && a.hopCount > 0 && this.addBaseStage(a, "leave-zone-base-route", a.hopCount, i), n !== t.activationNodeId && (this.planEnsureZoneEntry(t, e.entryNodeId, i), this.addSessionEntryStage(t, e.entryNodeId, t.activationNodeId, i)), o.hopCount > 0 && this.addBaseStage(o, "leave-zone-base-route", o.hopCount, i);
			let s = i.stages.at(-1), c = t.entryConnector.kind === "overpass" ? i.activeBridges.get(t.entryConnector.edgeId) : null;
			s && c?.role === "zone-entry" && s.afterArrivalBridgeActions.push(this.makeRetireBridgeAction(c, r));
			return;
		}
		if (!this.overpassPairLookup(n, r) && this.canLeaveZoneViaAdjacentActivation(e, t, n, r)) {
			this.planLeaveZoneViaCurrentActivation(e, t, n, r, a, o, i);
			return;
		}
		let c = this.requireOverpass(n, r);
		this.planRetireUnservedTransientBridges(c.id, n, i), this.planRetireZoneLineageBeforeExternalBridge(e, t, i);
		let l = hn(i.activeBridges, n);
		l && l.bridgeId !== c.id && this.queueBridgeAction(this.makeRetireBridgeAction(l, n), i);
		let u = mn(i.activeBridges, n, r), d = this.planEnsureBridge(n, r, n, "ordinary", null, null, n, i);
		this.addOverpassStage(n, r, c, u && !d ? "reuse-overpass" : "leave-zone-overpass", i);
	}
	planSafeMemberDepartureAfterEntryPreclear(e, t, n, r, i, a) {
		let o = this.overpassPairLookup(n, r), s = o ? null : e.memberNodeIds.filter((e) => e !== n).map((e) => {
			let t = this.activeStraightPathIndex.shortestRoute(n, e), i = this.overpassPairLookup(e, r);
			return t && i ? {
				bridgeFromNodeId: e,
				groundRoute: t,
				edge: i
			} : null;
		}).filter((e) => e !== null).sort((e, t) => e.groundRoute.hopCount - t.groundRoute.hopCount || e.bridgeFromNodeId.localeCompare(t.bridgeFromNodeId))[0] ?? null, c = o ? n : s?.bridgeFromNodeId, l = o ?? s?.edge ?? null;
		if (!c || !l) throw new Q("missing-overpass", `No safe post-preclear departure exists from "${n}" to "${r}".`);
		this.planRetireUnservedTransientBridges(l.id, n, a), this.planRetireZoneLineageBeforeExternalBridge(e, t, a), s && s.groundRoute.hopCount > 0 && this.addBaseStage(s.groundRoute, "leave-zone-base-route", s.groundRoute.hopCount, a);
		let u = hn(a.activeBridges, c);
		u && u.bridgeId !== l.id && this.queueBridgeAction(this.makeRetireBridgeAction(u, n), a);
		let d = mn(a.activeBridges, c, r), f = this.planEnsureBridge(c, r, c, "ordinary", null, null, n, a);
		this.addOverpassStage(c, r, l, d && !f ? "reuse-overpass" : "leave-zone-overpass", a, o ? i : void 0);
	}
	canLeaveZoneViaAdjacentActivation(e, t, n, r) {
		if (n === t.activationNodeId || r === t.activationNodeId || this.activationZoneByNodeId.get(r)?.id !== e.id) return !1;
		let i = this.requireZoneEntryConnection(e, r);
		if (i.kind !== "straight-edge") return !1;
		let a = this.straightEdgeById.get(i.edgeId);
		return a !== void 0 && $(a.fromNodeId, a.toNodeId) === $(e.entryNodeId, r);
	}
	planLeaveZoneViaCurrentActivation(e, t, n, r, i, a, o) {
		this.planRetireUnservedTransientBridges(null, n, o), i && i.hopCount > 0 && this.addBaseStage(i, "leave-zone-base-route", i.hopCount, o), this.planEnsureZoneEntry(t, e.entryNodeId, o), this.addSessionEntryStage(t, e.entryNodeId, t.activationNodeId, o), a.hopCount > 0 && this.addBaseStage(a, "leave-zone-base-route", a.hopCount, o);
		let s = o.stages.at(-1), c = t.entryConnector.kind === "overpass" ? o.activeBridges.get(t.entryConnector.edgeId) : null;
		s && c?.role === "zone-entry" && s.afterArrivalBridgeActions.push(this.makeRetireBridgeAction(c, r));
	}
	planOrdinaryRoute(e, t, n, r, i) {
		let a = this.basePathIndex.hopDistance(e, t);
		if (a === null) throw new Q("unreachable", `No authored route exists from "${e}" to "${t}".`);
		let o = this.activeStraightPathIndex.shortestRoute(e, t);
		if (o && a !== null && !this.requiresDynamicBridge(a)) {
			this.planRetireUnservedTransientBridges(null, e, n), this.addBaseStage(o, r, a, n);
			return;
		}
		let s = this.requireOverpass(e, t);
		this.planRetireUnservedTransientBridges(s.id, e, n);
		let c = mn(n.activeBridges, e, t), l = hn(n.activeBridges, e);
		l && l.bridgeId !== s.id && this.queueBridgeAction(this.makeRetireBridgeAction(l, e), n);
		let u = this.planEnsureBridge(e, t, e, "ordinary", null, null, e, n);
		this.addOverpassStage(e, t, s, c && !u ? "reuse-overpass" : i, n);
	}
	planEnsureZoneEntry(e, t, n) {
		if (e.entryConnector.kind === "straight") {
			if (!this.unlockedStraightEdgeIds.has(e.entryConnector.edgeId)) throw new Q("rule-conflict", `Session entry road "${e.entryConnector.edgeId}" is not visible.`);
			return;
		}
		this.planEnsureBridge(e.entryConnector.endpoints.fromNodeId, e.entryConnector.endpoints.toNodeId, e.activationNodeId, "zone-entry", e.zoneId, e.id, t, n);
	}
	addSessionEntryStage(e, t, n, r) {
		if ($(t, n) !== $(e.entryConnector.endpoints.fromNodeId, e.entryConnector.endpoints.toNodeId)) throw new Q("rule-conflict", `Session entry connector "${e.entryConnector.edgeId}" has mismatched endpoints.`);
		if (e.entryConnector.kind === "overpass") {
			this.addOverpassStage(t, n, this.requireOverpass(t, n), "zone-entry", r);
			return;
		}
		let i = this.straightEdgeById.get(e.entryConnector.edgeId);
		if (!i || !this.unlockedStraightEdgeIds.has(i.id)) throw new Q("rule-conflict", `Session entry road "${e.entryConnector.edgeId}" is not traversable.`);
		this.addBaseStage(Object.freeze({
			nodeIds: Object.freeze([t, n]),
			edgeIds: Object.freeze([i.id]),
			legs: Object.freeze([Object.freeze({
				edgeId: i.id,
				fromNodeId: t,
				toNodeId: n
			})]),
			hopCount: 1
		}), "zone-entry", 1, r);
	}
	planRetireUnservedTransientBridges(e, t, n) {
		[...n.activeBridges.values()].filter((t) => t.role !== "zone-entry" && t.bridgeId !== e).sort(vn).forEach((e) => {
			this.queueBridgeAction(this.makeRetireBridgeAction(e, t), n);
		});
	}
	planRetireZoneLineageBeforeExternalBridge(e, t, n) {
		if (e.externalBridgeReplacement !== "retire-entry-overpass-before-ensure" || t.entryConnector.kind !== "overpass") return;
		let r = n.activeBridges.get(t.entryConnector.edgeId);
		r?.active && r.role === "zone-entry" && r.zoneSessionId === t.id && this.queueBridgeAction(this.makeRetireBridgeAction(r, t.activationNodeId), n);
	}
	planEnsureBridge(e, t, n, r, i, a, o, s, c = !1) {
		let l = this.makeEnsureBridgeAction(e, t, n, r, i, a, o, s.activeBridges, c);
		return l && this.queueBridgeAction(l, s), l;
	}
	makeEnsureBridgeAction(e, t, n, r, i, a, o, s, c = !1) {
		let l = this.requireOverpass(e, t), u = mn(s, e, t), d = n, f = r, p = i, m = a;
		if (u && u.role === f && u.zoneId === p && u.zoneSessionId === m) return null;
		let h = hn(s, d), g = c && h?.role === "zone-entry" && f === "zone-transient" && h.zoneId === p && h.zoneSessionId === m;
		if (h && h.bridgeId !== l.id && !g) throw new Q("rule-conflict", `Node "${d}" already owns bridge "${h.bridgeId}".`);
		return Object.freeze({
			kind: "ensure-bridge",
			characterSideNodeId: this.resolveBridgeAnimationSideNodeId(l, o),
			bridge: Object.freeze({
				bridgeId: l.id,
				edge: l,
				ownerSourceNodeId: d,
				role: f,
				zoneId: p,
				zoneSessionId: m,
				active: !0,
				createdRevision: u?.createdRevision ?? this.revision + 1,
				changedRevision: this.revision + 1
			})
		});
	}
	makeRetireBridgeAction(e, t) {
		return Object.freeze({
			kind: "retire-bridge",
			bridgeId: e.bridgeId,
			characterSideNodeId: this.resolveBridgeAnimationSideNodeId(e.edge, t)
		});
	}
	compareBridgesByCharacterProximity(e, t, n) {
		return this.bridgeEndpointDistanceSquared(e.edge, n) - this.bridgeEndpointDistanceSquared(t.edge, n) || vn(e, t);
	}
	bridgeEndpointDistanceSquared(e, t) {
		let n = this.nodeById.get(t), r = this.nodeById.get(e.fromNodeId), i = this.nodeById.get(e.toNodeId);
		return !n || !r || !i ? Infinity : Math.min(xn(n, r), xn(n, i));
	}
	resolveBridgeAnimationSideNodeId(e, t) {
		if (t === e.fromNodeId || t === e.toNodeId) return t;
		let n = this.basePathIndex.hopDistance(t, e.fromNodeId), r = this.basePathIndex.hopDistance(t, e.toNodeId);
		if (n !== null && (r === null || n < r)) return e.fromNodeId;
		if (r !== null && (n === null || r < n)) return e.toNodeId;
		let i = this.nodeById.get(t), a = this.nodeById.get(e.fromNodeId), o = this.nodeById.get(e.toNodeId);
		if (i && a && o) {
			let t = xn(i, a), n = xn(i, o);
			if (t !== n) return t < n ? e.fromNodeId : e.toNodeId;
		}
		return e.fromNodeId < e.toNodeId ? e.fromNodeId : e.toNodeId;
	}
	queueBridgeAction(e, t) {
		t.pendingBeforeActions.push(e), pn(e, t.activeBridges);
	}
	addBaseStage(e, t, n, r) {
		e.hopCount !== 0 && r.stages.push({
			decisionKind: t,
			fromNodeId: e.nodeIds[0],
			toNodeId: e.nodeIds.at(-1),
			routeNodeIds: [...e.nodeIds],
			routeEdgeIds: [...e.edgeIds],
			baseHopCount: n,
			beforeTravelBridgeActions: this.takePendingBeforeActions(r),
			afterArrivalBridgeActions: []
		});
	}
	addOverpassStage(e, t, n, r, i, a) {
		i.activeBridges.get(n.id)?.role !== "zone-entry" && i.traversedTransientBridgeIds.add(n.id), i.stages.push({
			decisionKind: r,
			fromNodeId: e,
			toNodeId: t,
			routeNodeIds: [e, t],
			routeEdgeIds: [n.id],
			baseHopCount: a ?? this.basePathIndex.hopDistance(e, t),
			beforeTravelBridgeActions: this.takePendingBeforeActions(i),
			afterArrivalBridgeActions: []
		});
	}
	attachTransientRetirements(e, t) {
		let n = e.stages.at(-1);
		if (!n || e.traversedTransientBridgeIds.size === 0) return;
		let r = [...e.traversedTransientBridgeIds].map((t) => e.activeBridges.get(t) ?? null).filter((e) => e !== null && e.active && e.role !== "zone-entry").sort((e, n) => this.compareBridgesByCharacterProximity(e, n, t)).map((e) => this.makeRetireBridgeAction(e, t));
		n.afterArrivalBridgeActions.push(...r);
	}
	takePendingBeforeActions(e) {
		let t = e.pendingBeforeActions;
		return e.pendingBeforeActions = [], t;
	}
	freezeNavigationPlan(e, t, n, r, i) {
		if (r.length === 0 && t !== n) throw new Q("unreachable", `No route was produced from "${t}" to "${n}".`);
		let a = new Set(r.flatMap((e) => e.beforeTravelBridgeActions.filter((e) => e.kind === "retire-bridge").map((e) => e.bridgeId))), o = r.flatMap((e) => e.routeEdgeIds).find((e) => a.has(e));
		if (o) throw new Q("rule-conflict", `Navigation cannot retire route edge "${o}" before travel.`);
		let s = gn(r).map((t, n) => Object.freeze({
			id: `navigation-stage:${e}:${n}`,
			index: n,
			decisionKind: t.decisionKind,
			fromNodeId: t.fromNodeId,
			toNodeId: t.toNodeId,
			routeNodeIds: Object.freeze([...t.routeNodeIds]),
			routeEdgeIds: Object.freeze([...t.routeEdgeIds]),
			baseHopCount: t.baseHopCount,
			beforeTravelBridgeActions: Object.freeze([...t.beforeTravelBridgeActions]),
			afterArrivalBridgeActions: Object.freeze([...t.afterArrivalBridgeActions])
		})), c = _n(s, t);
		return Object.freeze({
			id: `navigation-plan:${e}`,
			revision: e,
			sourceNodeId: t,
			targetNodeId: n,
			authoredHopCount: this.sessionAwareHopDistance(t, n),
			linkedZoneDismissalPlanId: i,
			stages: Object.freeze(s),
			flattenedRouteNodeIds: Object.freeze(c.nodeIds),
			flattenedRouteEdgeIds: Object.freeze(c.edgeIds)
		});
	}
	applyBridgeAction(e) {
		if (e.kind === "retire-bridge") {
			this.commitBridgeRetirement(e.bridgeId);
			return;
		}
		let t = e.bridge, n = this.bridgeRegistry.get(t.bridgeId), r = this.nextRevision();
		this.bridgeRegistry.set(t.bridgeId, {
			bridgeId: t.bridgeId,
			edge: t.edge,
			ownerSourceNodeId: t.ownerSourceNodeId,
			role: t.role,
			zoneId: t.zoneId,
			zoneSessionId: t.zoneSessionId,
			active: !0,
			createdRevision: n?.createdRevision ?? r,
			changedRevision: r
		});
	}
	commitBridgeRetirement(e) {
		let t = this.bridgeRegistry.get(e);
		t?.active && (t.active = !1, t.changedRevision = this.nextRevision());
	}
	requiresDynamicBridge(e) {
		return e > this.dynamicBridgeRule.hopThresholdExclusive;
	}
	requireOverpass(e, t) {
		let n = this.overpassPairLookup(e, t);
		if (!n) throw new Q("missing-overpass", `No bridge geometry exists between "${e}" and "${t}".`);
		if ($(n.fromNodeId, n.toNodeId) !== $(e, t)) throw new Q("rule-conflict", `Bridge lookup returned mismatched edge "${n.id}".`);
		return n;
	}
	snapshotActiveBridges() {
		return new Map([...this.bridgeRegistry.values()].filter((e) => e.active).map((e) => [e.bridgeId, fn(e)]));
	}
	buildActiveStraightPathIndex() {
		let e = this.authoredStraightEdges.filter((e) => this.unlockedStraightEdgeIds.has(e.id) && this.unlockedNodeIds.has(e.fromNodeId) && this.unlockedNodeIds.has(e.toNodeId));
		return new Dt(this.nodes, e);
	}
	rebuildActiveStraightPathIndex() {
		this.activeStraightPathIndex = this.buildActiveStraightPathIndex();
	}
	validateAndIndexConfiguration() {
		this.validateDynamicRule(), this.nodes.forEach((e, t) => {
			if (e.id.trim().length === 0 || this.nodeById.has(e.id)) throw Error(`Path rules received an invalid node at index ${t}.`);
			this.nodeById.set(e.id, e);
		}), this.authoredStraightEdges.forEach((e, t) => {
			if (e.pathKind !== "straight") throw Error(`Authored edge at index ${t} is not straight.`);
			if (e.id.trim().length === 0 || this.straightEdgeById.has(e.id)) throw Error(`Path rules received an invalid straight edge at index ${t}.`);
			if (!this.nodeById.has(e.fromNodeId) || !this.nodeById.has(e.toNodeId)) throw Error(`Straight edge "${e.id}" references a missing node.`);
			this.straightEdgeById.set(e.id, e);
		}), this.specialZones.forEach((e) => this.validateAndIndexZone(e)), this.validateAuthoredLogicalIndex();
	}
	validateAuthoredLogicalIndex() {
		let e = new Dt(this.nodes, this.authoredLogicalEdges);
		if (new Map(this.authoredLogicalEdges.map((e) => [e.id, e])).size !== this.authoredLogicalEdges.length) throw Error("Authored logical path repeats an edge id.");
		let t = new Set(this.specialZones.flatMap((e) => e.entryConnections.filter((e) => e.kind === "straight-edge").map((e) => e.edgeId)));
		this.authoredLogicalEdges.forEach((e) => {
			let n = this.straightEdgeById.get(e.id);
			if (!n || $(e.fromNodeId, e.toNodeId) !== $(n.fromNodeId, n.toNodeId)) throw Error(`Authored logical edge "${e.id}" is not a matching runtime straight road.`);
			if (t.has(e.id)) throw Error(`Session entry road "${e.id}" cannot enter authored logical hop truth.`);
		}), this.nodes.forEach((t) => {
			this.nodes.forEach((n) => {
				let r = e.shortestRoute(t.id, n.id), i = this.basePathIndex.shortestRoute(t.id, n.id), a = bn(r);
				if (bn(i) !== a) throw Error(`Supplied BasePathIndex differs from authored logical truth for "${t.id}" -> "${n.id}".`);
			});
		});
	}
	validateDynamicRule() {
		if (!Number.isInteger(this.dynamicBridgeRule.hopThresholdExclusive) || this.dynamicBridgeRule.hopThresholdExclusive < 0) throw Error("Dynamic bridge hop threshold must be a non-negative integer.");
		if (!Number.isInteger(this.dynamicBridgeRule.ordinaryBridgeLimit) || this.dynamicBridgeRule.ordinaryBridgeLimit < 1) throw Error("Ordinary bridge limit must be a positive integer.");
		if (!Number.isInteger(this.dynamicBridgeRule.outgoingBridgeLimitPerAnchor) || this.dynamicBridgeRule.outgoingBridgeLimitPerAnchor < 1) throw Error("Outgoing bridge limit must be a positive integer.");
	}
	validateAndIndexZone(e) {
		if (e.id.trim().length === 0 || this.zoneById.has(e.id)) throw Error(`Special path zone has invalid or duplicate id "${e.id}".`);
		if (e.unlockPolicy !== "repeatable-session" || e.retention !== "retain-inside-session-envelope" || e.externalBridgeReplacement !== "retire-entry-overpass-before-ensure" || e.dismissalTrigger !== "departure-from-session-envelope" || e.dismissalBridgeOrder !== "entry-left-to-right-preclear" || e.dismissalConstructOrder !== "reverse-reveal-right-to-left" || e.lockHiddenMembersAfterDismissal !== !0 || e.activationTrigger !== "idle-at-any-activation-node" || !nn(e.activationMemberRoutingPolicy) || e.memberDynamicBridgeLifetime !== "retire-at-physical-arrival" || e.entryConnectorRevealPolicy !== "first" || e.retainEntryConnectorDuringMemberRoutes !== !0 || e.retainedEntryOverpassCountsTowardOrdinaryLimit !== !1 || e.entryConnectorAffectsAuthoredHopDistance !== !1) throw Error(`Zone "${e.id}" does not satisfy the repeatable-session lifecycle contract.`);
		let t = new Set(e.activationNodeIds);
		if (t.size === 0 || t.size !== e.activationNodeIds.length) throw Error(`Zone "${e.id}" must contain unique activation nodes.`);
		let n = /* @__PURE__ */ new Map();
		if (e.entryConnections.forEach((r) => {
			if (!t.has(r.activationNodeId)) throw Error(`Zone "${e.id}" entry connection references non-activation "${r.activationNodeId}".`);
			if (n.has(r.activationNodeId)) throw Error(`Zone "${e.id}" repeats entry connection for "${r.activationNodeId}".`);
			n.set(r.activationNodeId, r);
		}), n.size !== t.size) throw Error(`Zone "${e.id}" needs exactly one entry connection per activation.`);
		t.forEach((t) => {
			let r = this.nodeById.get(t);
			if (!r || !r.initiallyVisible || r.variant !== "green") throw Error(`Zone "${e.id}" activation "${t}" must be a visible green node.`);
			let i = this.activationZoneByNodeId.get(t);
			if (i) throw Error(`Activation "${t}" belongs to both "${i.id}" and "${e.id}".`);
			if (this.memberZoneByNodeId.has(t)) throw Error(`Activation "${t}" is already a hidden zone member.`);
			this.activationZoneByNodeId.set(t, e);
			let a = n.get(t);
			if (a.kind === "overpass") this.requireOverpass(t, e.entryNodeId);
			else {
				let n = this.straightEdgeById.get(a.edgeId);
				if (!n || $(n.fromNodeId, n.toNodeId) !== $(t, e.entryNodeId)) throw Error(`Zone "${e.id}" has invalid entry road "${a.edgeId}" for activation "${t}".`);
				if (n.initiallyVisible) throw Error(`Zone "${e.id}" entry road "${n.id}" must start hidden.`);
			}
		});
		let r = new Set(e.memberNodeIds);
		if (r.size !== e.memberNodeIds.length || !r.has(e.entryNodeId)) throw Error(`Zone "${e.id}" must uniquely include its brown entry node.`);
		r.forEach((t) => {
			let n = this.nodeById.get(t);
			if (!n) throw Error(`Zone "${e.id}" references unknown node "${t}".`);
			if (n.initiallyVisible || n.variant !== "brown") throw Error(`Zone "${e.id}" member "${t}" must be hidden brown.`);
			if (this.activationZoneByNodeId.has(t)) throw Error(`Zone member "${t}" is already an activation node.`);
			let r = this.memberZoneByNodeId.get(t);
			if (r) throw Error(`Node "${t}" belongs to both "${r.id}" and "${e.id}".`);
			this.memberZoneByNodeId.set(t, e);
		});
		let i = new Set(e.memberStraightEdgeIds);
		if (i.size !== e.memberStraightEdgeIds.length) throw Error(`Zone "${e.id}" repeats a member straight edge.`);
		if (i.forEach((t) => {
			let n = this.straightEdgeById.get(t);
			if (!n || !r.has(n.fromNodeId) || !r.has(n.toNodeId)) throw Error(`Zone "${e.id}" has invalid member straight edge "${t}".`);
		}), e.revealSequence.filter((e) => e.kind === "session-entry-connector").length !== 1 || e.revealSequence[0]?.kind !== "session-entry-connector") throw Error(`Zone "${e.id}" reveal sequence must start with one session entry connector.`);
		e.revealSequence.forEach((t) => this.validateRevealStep(e, t)), this.zoneById.set(e.id, e);
	}
	validateRevealStep(e, t) {
		if (t.kind === "node") {
			if (!e.memberNodeIds.includes(t.nodeId)) throw Error(`Zone "${e.id}" reveal references non-member node "${t.nodeId}".`);
			return;
		}
		if (t.kind === "straight-edge") {
			if (!e.memberStraightEdgeIds.includes(t.edgeId)) throw Error(`Zone "${e.id}" reveal references non-member edge "${t.edgeId}".`);
			return;
		}
		if (t.kind !== "session-entry-connector") throw Error(`Zone "${e.id}" has an unknown reveal template step.`);
	}
	createZoneSession(e, t, n) {
		if (this.activeZoneSession) throw Error(`Cannot create zone session while "${this.activeZoneSession.id}" is active.`);
		if (this.activationZoneByNodeId.get(t)?.id !== e.id) throw Error(`Node "${t}" is not an activation for zone "${e.id}".`);
		let r = Object.freeze({
			fromNodeId: t,
			toNodeId: e.entryNodeId
		}), i = this.requireZoneEntryConnection(e, t), a = i.kind === "straight-edge" ? Object.freeze({
			kind: "straight",
			edgeId: i.edgeId,
			endpoints: r
		}) : (() => {
			let e = this.requireOverpass(r.fromNodeId, r.toNodeId);
			return Object.freeze({
				kind: "overpass",
				edgeId: e.id,
				endpoints: r
			});
		})(), o = {
			id: `zone-session:${e.id}:${t}:${n}`,
			zoneId: e.id,
			activationNodeId: t,
			entryNodeId: e.entryNodeId,
			entryConnector: a,
			state: "revealing",
			revealProgress: 0
		};
		return this.activeZoneSession = o, this.entryConnectorIdByZoneId.set(e.id, a.edgeId), o;
	}
	resolveRevealStep(e, t) {
		return e.kind === "session-entry-connector" ? t.entryConnector.kind === "straight" ? Object.freeze({
			kind: "straight-edge",
			edgeId: t.entryConnector.edgeId
		}) : Object.freeze({
			kind: "bridge",
			endpoints: t.entryConnector.endpoints
		}) : e;
	}
	requireZoneEntryConnection(e, t) {
		let n = e.entryConnections.find((e) => e.activationNodeId === t);
		if (!n) throw Error(`Zone "${e.id}" has no entry connection for "${t}".`);
		return n;
	}
	isSessionEntryConnectorActive(e) {
		if (e.entryConnector.kind === "straight") return this.unlockedStraightEdgeIds.has(e.entryConnector.edgeId);
		let t = this.bridgeRegistry.get(e.entryConnector.edgeId);
		return t?.active === !0 && t.role === "zone-entry" && t.zoneSessionId === e.id;
	}
	requireSession(e) {
		let t = this.activeZoneSession;
		if (!t || t.id !== e) throw Error(`Zone session "${e}" is not active.`);
		return t;
	}
	requireActiveSessionForZone(e) {
		let t = this.activeZoneSession;
		if (!t || t.zoneId !== e || t.state !== "active") throw new Q("rule-conflict", `Zone "${e}" has no active traversal session.`);
		return t;
	}
	isNodeInSession(e, t, n) {
		return e === t.activationNodeId || this.memberZoneByNodeId.get(e)?.id === n.id;
	}
	sessionAwareHopDistance(e, t) {
		let n = this.activeZoneSession, r = n ? this.zoneById.get(n.zoneId) ?? null : null;
		if (!n || !r) return this.basePathIndex.hopDistance(e, t);
		let i = this.isNodeInSession(e, n, r), a = this.isNodeInSession(t, n, r);
		if (!i && !a) return this.basePathIndex.hopDistance(e, t);
		if (i && a) {
			if (e === n.activationNodeId) {
				let e = this.basePathIndex.hopDistance(r.entryNodeId, t);
				return e === null ? null : e + 1;
			}
			if (t === n.activationNodeId) {
				let t = this.basePathIndex.hopDistance(e, r.entryNodeId);
				return t === null ? null : t + 1;
			}
			return this.basePathIndex.hopDistance(e, t);
		}
		let o = i ? e : t, s = i ? t : e, c = o === n.activationNodeId ? 0 : this.basePathIndex.hopDistance(o, r.entryNodeId), l = this.basePathIndex.hopDistance(n.activationNodeId, s);
		return c === null || l === null ? null : c + (o === n.activationNodeId ? 0 : 1) + l;
	}
	requirePendingNavigation(e, t) {
		let n = this.pendingNavigation;
		if (!n || n.plan.id !== e) throw Error(`Navigation plan "${e}" is not pending.`);
		if (t !== n.nextStageIndex) throw Error(`Navigation plan "${e}" expected stage ${n.nextStageIndex}, received ${t}.`);
		return n;
	}
	findPendingZoneReveal(e) {
		let t = [...this.pendingZoneRevealById.values()].find((t) => t.plan.id === e);
		if (!t) throw Error(`Zone reveal plan "${e}" is not pending.`);
		return t;
	}
	findPendingZoneDismiss(e) {
		let t = [...this.pendingZoneDismissById.values()].find((t) => t.plan.id === e);
		if (!t) throw Error(`Zone dismissal plan "${e}" is not pending.`);
		return t;
	}
	stabilizeActiveZoneSessionAfterRecovery(e) {
		let t = this.zoneById.get(e.zoneId);
		if (!t) throw Error(`Cannot stabilize recovery for unknown zone "${e.zoneId}".`);
		for (let t of this.bridgeRegistry.values()) {
			let n = e.entryConnector.kind === "overpass" && t.bridgeId === e.entryConnector.edgeId && t.role === "zone-entry" && t.zoneSessionId === e.id;
			t.active && !n && this.commitBridgeRetirement(t.bridgeId);
		}
		for (let e of t.memberNodeIds) this.unlockNode(e);
		for (let e of t.memberStraightEdgeIds) this.unlockStraightEdge(e);
		if (e.entryConnector.kind === "straight") this.unlockStraightEdge(e.entryConnector.edgeId);
		else {
			let t = this.bridgeRegistry.get(e.entryConnector.edgeId);
			if (t?.active !== !0 || t.role !== "zone-entry" || t.zoneSessionId !== e.id) {
				let n = this.nextRevision();
				this.bridgeRegistry.set(e.entryConnector.edgeId, {
					bridgeId: e.entryConnector.edgeId,
					edge: this.requireOverpass(e.entryConnector.endpoints.fromNodeId, e.entryConnector.endpoints.toNodeId),
					ownerSourceNodeId: e.activationNodeId,
					role: "zone-entry",
					zoneId: e.zoneId,
					zoneSessionId: e.id,
					active: !0,
					createdRevision: t?.createdRevision ?? n,
					changedRevision: n
				});
			}
		}
		this.entryConnectorIdByZoneId.set(e.zoneId, e.entryConnector.edgeId), e.revealProgress = t.revealSequence.length, e.state = "active";
	}
	finishZoneDismissal(e) {
		if (!this.zoneById.get(e)) throw Error(`Cannot finish unknown zone dismissal "${e}".`);
		let t = this.activeZoneSession;
		if (!t || t.zoneId !== e) throw Error(`Zone dismissal "${e}" has no matching session.`);
		let n = [...this.bridgeRegistry.values()].find((e) => e.active && e.zoneSessionId === t.id);
		if (n) throw Error(`Zone dismissal "${e}" left bridge "${n.bridgeId}" active.`);
		let r = this.pendingZoneDismissById.get(e);
		if (!r) throw Error(`Zone dismissal "${e}" is not pending.`);
		this.entryConnectorIdByZoneId.delete(e), this.pendingZoneDismissById.delete(e), this.activeZoneSession = null;
		let i = this.pendingNavigation;
		i && i.plan.linkedZoneDismissalPlanId === r.plan.id && i.nextStageIndex === i.plan.stages.length && !i.awaitingArrival && (this.pendingNavigation = null), this.nextRevision(), this.rebuildActiveStraightPathIndex();
	}
	hasActivatedZoneOutsideCharacter(e) {
		let t = this.activeZoneSession, n = t ? this.zoneById.get(t.zoneId) ?? null : null;
		return t !== null && n !== null && t.state !== "revealing" && !this.isNodeInSession(e, t, n);
	}
	assertExpectedArrival(e, t, n) {
		if (!e.awaitingArrival) throw Error(`Navigation stage ${t.index} has not started.`);
		if (n !== t.toNodeId) throw Error(`Navigation stage ${t.index} expected arrival at "${t.toNodeId}", received "${n}".`);
	}
	getInvariantDebug() {
		let e = [...this.bridgeRegistry.values()].filter((e) => e.active), t = e.filter((e) => e.role === "ordinary"), n = this.activeZoneSession, r = n ? this.zoneById.get(n.zoneId) ?? null : null, i = e.filter((e) => e.role === "zone-entry"), a = e.filter((e) => e.role === "zone-transient"), o = yn(e, (e) => e.ownerSourceNodeId), s = yn(e, (e) => $(e.edge.fromNodeId, e.edge.toNodeId)), c = Math.max(0, ...o.values()), l = [...s.values()].filter((e) => e > 1).length, u = [], d = e.length === 2 && n !== null && r !== null && n.entryConnector.kind === "overpass" && i.length === 1 && a.length === 1 && i[0]?.bridgeId === n.entryConnector.edgeId && a[0]?.zoneSessionId === n.id && a[0]?.zoneId === r.id && a[0]?.ownerSourceNodeId === n.activationNodeId && $(a[0].edge.fromNodeId, a[0].edge.toNodeId) === $(n.activationNodeId, a[0].edge.fromNodeId === n.activationNodeId ? a[0].edge.toNodeId : a[0].edge.fromNodeId) && r.memberNodeIds.includes(a[0].edge.fromNodeId === n.activationNodeId ? a[0].edge.toNodeId : a[0].edge.fromNodeId) && (() => {
			let e = a[0].edge.fromNodeId === n.activationNodeId ? a[0].edge.toNodeId : a[0].edge.fromNodeId, t = this.sessionAwareHopDistance(n.activationNodeId, e);
			return t !== null && this.requiresDynamicBridge(t);
		})(), f = [...this.pendingZoneDismissById.values()];
		if (this.pendingNavigation && f.length > 0) {
			let e = f.length === 1 ? f[0] : null;
			(!e || e.plan.trigger !== "concurrent-departure-from-session-envelope" || e.plan.linkedNavigationPlanId !== this.pendingNavigation.plan.id || this.pendingNavigation.plan.linkedZoneDismissalPlanId !== e.plan.id) && u.push("navigation overlaps an unlinked zone dismissal");
		}
		let p = f.filter((e) => e.plan.trigger === "concurrent-departure-from-session-envelope");
		p.length > 1 && u.push(`concurrent zone dismissals ${p.length}/1`), t.length > this.dynamicBridgeRule.ordinaryBridgeLimit && u.push(`ordinary bridges ${t.length}/${this.dynamicBridgeRule.ordinaryBridgeLimit}`), (e.length > 2 || e.length === 2 && !d) && u.push("active bridge combination is not the activation-to-far-brown exception"), c > this.dynamicBridgeRule.outgoingBridgeLimitPerAnchor && !d && u.push(`per-source bridges ${c}`), l > 0 && u.push(`duplicate endpoint pairs ${l}`), i.length > 1 && u.push(`active session entry bridges ${i.length}/1`), p.length > 0 && n?.state !== "dismissing" && u.push("concurrent zone dismissal lacks a dismissing session"), e.filter((e) => e.role !== "ordinary").forEach((e) => {
			(!n || e.zoneId !== n.zoneId || e.zoneSessionId !== n.id) && u.push(`bridge ${e.bridgeId} belongs to a stale zone session`);
		}), a.forEach((e) => {
			if (!n || !r || e.zoneSessionId !== n.id || e.zoneId !== r.id || e.ownerSourceNodeId !== n.activationNodeId) {
				u.push(`zone transient ${e.bridgeId} is not activation-owned`);
				return;
			}
			let t = e.edge.fromNodeId === n.activationNodeId ? e.edge.toNodeId : e.edge.toNodeId === n.activationNodeId ? e.edge.fromNodeId : null, i = t === null ? null : this.sessionAwareHopDistance(n.activationNodeId, t);
			(t === null || !r.memberNodeIds.includes(t) || i === null || !this.requiresDynamicBridge(i)) && u.push(`zone transient ${e.bridgeId} is not activation-to-far-member`);
		}), n && (n.entryConnector.kind === "straight" && i.length > 0 && u.push(`straight-entry session ${n.id} owns a zone-entry bridge`), n.entryConnector.kind === "overpass" && i.some((e) => e.bridgeId !== n.entryConnector.edgeId || $(e.edge.fromNodeId, e.edge.toNodeId) !== $(n.entryConnector.endpoints.fromNodeId, n.entryConnector.endpoints.toNodeId)) && u.push(`zone session ${n.id} has a mismatched entry bridge`));
		let m = new Set(this.specialZones.flatMap((e) => e.entryConnections.filter((e) => e.kind === "straight-edge").map((e) => e.edgeId)));
		return [...this.unlockedStraightEdgeIds].filter((e) => m.has(e)).forEach((e) => {
			(!n || n.entryConnector.kind !== "straight" || n.entryConnector.edgeId !== e) && u.push(`session entry road ${e} is unlocked without its session`);
		}), n?.entryConnector.kind === "straight" && n.state === "active" && !this.unlockedStraightEdgeIds.has(n.entryConnector.edgeId) && u.push(`active session ${n.id} is missing entry road ${n.entryConnector.edgeId}`), Object.freeze({
			ordinaryBridgeCount: t.length,
			activeBridgeCount: e.length,
			maximumActiveBridgesFromOneSource: c,
			duplicateEndpointPairCount: l,
			violations: Object.freeze(u)
		});
	}
	nextRevision() {
		return this.revision += 1, this.revision;
	}
};
function nn(e) {
	return e === "entry-then-existing-chain" || e === "direct-only-from-activation-to-far-member-otherwise-existing-chain";
}
function rn(e) {
	return {
		bridgeId: e.bridgeId,
		edge: e.edge,
		ownerSourceNodeId: e.ownerSourceNodeId,
		role: e.role,
		zoneId: e.zoneId,
		zoneSessionId: e.zoneSessionId,
		active: e.active,
		createdRevision: e.createdRevision,
		changedRevision: e.changedRevision
	};
}
function an(e) {
	return e === null ? null : {
		id: e.id,
		zoneId: e.zoneId,
		activationNodeId: e.activationNodeId,
		entryNodeId: e.entryNodeId,
		entryConnector: e.entryConnector,
		state: e.state,
		revealProgress: e.revealProgress
	};
}
function on(e) {
	return e === null ? null : {
		plan: e.plan,
		nextStageIndex: e.nextStageIndex,
		nextBeforeActionIndex: e.nextBeforeActionIndex,
		nextAfterActionIndex: e.nextAfterActionIndex,
		awaitingArrival: e.awaitingArrival,
		departureCommitted: e.departureCommitted
	};
}
function sn(e) {
	return {
		plan: e.plan,
		nextBeforeActionIndex: e.nextBeforeActionIndex,
		nextStepIndex: e.nextStepIndex
	};
}
function cn(e) {
	return {
		plan: e.plan,
		nextStepIndex: e.nextStepIndex
	};
}
function ln(e, t) {
	e.clear();
	for (let n of t) e.add(n);
}
function un(e, t) {
	e.clear();
	for (let [n, r] of t) e.set(n, r);
}
function dn(e, t) {
	return {
		accepted: !1,
		reason: e,
		detail: t
	};
}
function fn(e) {
	return Object.freeze({
		bridgeId: e.bridgeId,
		edge: e.edge,
		ownerSourceNodeId: e.ownerSourceNodeId,
		role: e.role,
		zoneId: e.zoneId,
		zoneSessionId: e.zoneSessionId,
		active: e.active,
		createdRevision: e.createdRevision,
		changedRevision: e.changedRevision
	});
}
function pn(e, t) {
	e.kind === "retire-bridge" ? t.delete(e.bridgeId) : t.set(e.bridge.bridgeId, e.bridge);
}
function mn(e, t, n) {
	let r = $(t, n);
	return [...e.values()].find((e) => e.active && $(e.edge.fromNodeId, e.edge.toNodeId) === r) ?? null;
}
function hn(e, t) {
	return [...e.values()].find((e) => e.active && e.ownerSourceNodeId === t) ?? null;
}
function gn(e) {
	let t = [];
	return e.forEach((e) => {
		let n = {
			decisionKind: e.decisionKind,
			fromNodeId: e.fromNodeId,
			toNodeId: e.toNodeId,
			routeNodeIds: [...e.routeNodeIds],
			routeEdgeIds: [...e.routeEdgeIds],
			baseHopCount: e.baseHopCount,
			beforeTravelBridgeActions: [...e.beforeTravelBridgeActions],
			afterArrivalBridgeActions: [...e.afterArrivalBridgeActions]
		}, r = t.at(-1);
		if (!(r && r.toNodeId === n.fromNodeId && r.routeNodeIds.at(-1) === n.routeNodeIds[0] && r.afterArrivalBridgeActions.length === 0 && n.beforeTravelBridgeActions.every((e) => e.kind === "ensure-bridge"))) {
			t.push(n);
			return;
		}
		r.toNodeId = n.toNodeId, r.routeNodeIds.push(...n.routeNodeIds.slice(1)), r.routeEdgeIds.push(...n.routeEdgeIds), r.beforeTravelBridgeActions.push(...n.beforeTravelBridgeActions), r.afterArrivalBridgeActions = n.afterArrivalBridgeActions, r.baseHopCount = r.baseHopCount === null || n.baseHopCount === null ? null : r.baseHopCount + n.baseHopCount;
	}), t;
}
function _n(e, t) {
	let n = [t], r = [];
	return e.forEach((e) => {
		if (n.at(-1) !== e.routeNodeIds[0]) throw new Q("rule-conflict", `Navigation stages are discontinuous at "${e.id}".`);
		n.push(...e.routeNodeIds.slice(1)), r.push(...e.routeEdgeIds);
	}), {
		nodeIds: n,
		edgeIds: r
	};
}
function vn(e, t) {
	return e.bridgeId.localeCompare(t.bridgeId);
}
function yn(e, t) {
	let n = /* @__PURE__ */ new Map();
	return e.forEach((e) => {
		let r = t(e);
		n.set(r, (n.get(r) ?? 0) + 1);
	}), n;
}
function $(e, t) {
	return e < t ? `${e}\u0000${t}` : `${t}\u0000${e}`;
}
function bn(e) {
	return e === null ? "unreachable" : `${e.nodeIds.join("")}\u0002${e.edgeIds.join("")}`;
}
function xn(e, t) {
	let n = e.position.x - t.position.x, r = e.position.z - t.position.z;
	return n * n + r * r;
}
//#endregion
//#region src/simulation/PathSimulation.ts
var Sn = 1e-5, Cn = 1e-7, wn = .1;
function Tn(e, t) {
	return e < t ? `${e}\u0000${t}` : `${t}\u0000${e}`;
}
function En(e, t) {
	return e.pathKind === t.pathKind && e.fromNodeId === t.fromNodeId && e.toNodeId === t.toNodeId && JSON.stringify(e) === JSON.stringify(t);
}
var Dn = class {
	geometryRegistry;
	nodes;
	nodeIndexById = /* @__PURE__ */ new Map();
	edgeIndexById = /* @__PURE__ */ new Map();
	physicalPairKeys = /* @__PURE__ */ new Set();
	runtimeEdges = [];
	adjacency;
	nodeTieRanks;
	speed;
	currentNodeIndex;
	targetNodeIndex = null;
	isRunning = !1;
	routeNodeIndices = [];
	routeEdgeIndices = [];
	routeCursor = 0;
	edgeProgress = 0;
	routeRevision = 0;
	positionX;
	positionZ;
	surfaceY = jt;
	surfacePitchRadians = 0;
	activePathKind = null;
	facingX = 0;
	facingZ = -1;
	arrivalListeners = /* @__PURE__ */ new Set();
	nodeTraversedListeners = /* @__PURE__ */ new Set();
	constructor(e, t = 13.25, n = new Lt(e)) {
		if (!Number.isFinite(t) || t <= 0) throw Error("PathSimulation speed must be a positive finite number.");
		this.nodes = e.nodes, this.speed = t, this.geometryRegistry = n, this.adjacency = e.nodes.map(() => []), this.nodeTieRanks = new Int32Array(e.nodes.length), this.validateAndBuildGraph(e);
		let r = this.nodeIndexById.get(e.initialNodeId);
		if (r === void 0) throw Error(`Initial node "${e.initialNodeId}" does not exist.`);
		this.currentNodeIndex = r;
		let i = this.nodes[r].position;
		this.positionX = i.x, this.positionZ = i.z, this.surfaceY = this.nodes[r].surfaceY;
		let a = this.adjacency[r]?.[0];
		a && this.setFacingToward(this.nodes[a.nodeIndex].position);
	}
	requestTarget(e) {
		let t = this.nodeIndexById.get(e);
		if (t === void 0) return {
			accepted: !1,
			reason: "unknown-node"
		};
		if (!this.isRunning) {
			if (t === this.currentNodeIndex) return {
				accepted: !0,
				status: "already-there",
				routeNodeIds: [e]
			};
			let n = this.findShortestPath(this.currentNodeIndex, t);
			return n ? (this.installRoute(n.nodeIndices, n.edgeIndices, 0), this.targetNodeIndex = t, this.isRunning = !0, this.routeRevision += 1, this.refreshPositionAndFacing(), {
				accepted: !0,
				status: "started",
				routeNodeIds: this.routeNodeIndices.map((e) => this.nodes[e].id)
			}) : {
				accepted: !1,
				reason: "unreachable"
			};
		}
		let n = this.routeEdgeIndices[this.routeCursor], r = this.routeNodeIndices[this.routeCursor], i = this.routeNodeIndices[this.routeCursor + 1], a = n === void 0 ? void 0 : this.runtimeEdges[n];
		if (n === void 0 || r === void 0 || i === void 0 || !a) return {
			accepted: !1,
			reason: "unreachable"
		};
		let o = this.findShortestPath(r, t), s = this.findShortestPath(i, t);
		if (!o && !s) return {
			accepted: !1,
			reason: "unreachable"
		};
		let c = o ? this.edgeProgress * a.length + o.distance : Infinity, l = s ? (1 - this.edgeProgress) * a.length + s.distance : Infinity, u = c + Cn < l, d = u ? o : s;
		if (!d) return {
			accepted: !1,
			reason: "unreachable"
		};
		let f = this.edgeProgress, p = u ? [
			i,
			r,
			...d.nodeIndices.slice(1)
		] : [
			r,
			i,
			...d.nodeIndices.slice(1)
		], m = [n, ...d.edgeIndices];
		return this.installRoute(p, m, u ? 1 - f : f), this.targetNodeIndex = t, this.isRunning = !0, this.routeRevision += 1, this.refreshPositionAndFacing(), {
			accepted: !0,
			status: "retargeted",
			routeNodeIds: this.routeNodeIndices.map((e) => this.nodes[e].id)
		};
	}
	registerEdge(e) {
		let t = this.edgeIndexById.get(e.id);
		if (t !== void 0) {
			let n = this.runtimeEdges[t]?.source;
			if (n === e || n && En(n, e)) return !1;
			throw Error(`PathSimulation edge id "${e.id}" is already registered.`);
		}
		this.validateRuntimeEdgeIdentity(e);
		let n = Tn(e.fromNodeId, e.toNodeId);
		if (this.physicalPairKeys.has(n)) throw Error(`Duplicate physical edge between "${e.fromNodeId}" and "${e.toNodeId}".`);
		return this.geometryRegistry.registerEdge(e), this.installRuntimeEdge(e), this.sortAdjacencyForNode(e.fromNodeId), this.sortAdjacencyForNode(e.toNodeId), !0;
	}
	requestRoute(e) {
		if (this.isRunning) return {
			accepted: !1,
			reason: "busy",
			message: "An explicit route can only be installed while the character is idle."
		};
		let t = this.nodeIndexById.get(e.targetNodeId);
		if (t === void 0) return {
			accepted: !1,
			reason: "unknown-node",
			message: `Explicit route target "${e.targetNodeId}" does not exist.`
		};
		if (e.nodeIds.length === 0) return {
			accepted: !1,
			reason: "invalid-route",
			message: "An explicit route must contain at least the occupied node."
		};
		let n = this.nodes[this.currentNodeIndex].id;
		if (e.nodeIds[0] !== n) return {
			accepted: !1,
			reason: "invalid-route",
			message: `Explicit route must start at occupied node "${n}".`
		};
		if (e.nodeIds[e.nodeIds.length - 1] !== e.targetNodeId) return {
			accepted: !1,
			reason: "invalid-route",
			message: `Explicit route must end at target "${e.targetNodeId}".`
		};
		if (e.nodeIds.length !== e.edgeIds.length + 1) return {
			accepted: !1,
			reason: "invalid-route",
			message: "Explicit route must contain exactly one edge per consecutive node pair."
		};
		if (e.edgeIds.length === 0) return t === this.currentNodeIndex ? {
			accepted: !0,
			status: "already-there",
			routeNodeIds: Object.freeze([n]),
			routeEdgeIds: Object.freeze([])
		} : {
			accepted: !1,
			reason: "invalid-route",
			message: "A zero-leg explicit route can only target the occupied node."
		};
		let r = [];
		for (let t of e.nodeIds) {
			let e = this.nodeIndexById.get(t);
			if (e === void 0) return {
				accepted: !1,
				reason: "unknown-node",
				message: `Explicit route node "${t}" does not exist.`
			};
			r.push(e);
		}
		let i = [];
		for (let t = 0; t < e.edgeIds.length; t += 1) {
			let n = e.edgeIds[t], a = this.edgeIndexById.get(n);
			if (a === void 0) return {
				accepted: !1,
				reason: "unknown-edge",
				message: `Explicit route edge "${n}" does not exist.`
			};
			let o = r[t], s = r[t + 1], c = this.runtimeEdges[a];
			if (!(c.fromNodeIndex === o && c.toNodeIndex === s || c.fromNodeIndex === s && c.toNodeIndex === o)) return {
				accepted: !1,
				reason: "invalid-route",
				message: `Explicit route edge "${n}" does not connect "${e.nodeIds[t]}" and "${e.nodeIds[t + 1]}".`
			};
			i.push(a);
		}
		return this.installRoute(r, i, 0), this.targetNodeIndex = t, this.isRunning = !0, this.routeRevision += 1, this.refreshPositionAndFacing(), {
			accepted: !0,
			status: "started",
			routeNodeIds: Object.freeze([...e.nodeIds]),
			routeEdgeIds: Object.freeze([...e.edgeIds])
		};
	}
	moveImmediatelyTo(e) {
		let t = this.nodeIndexById.get(e);
		if (t === void 0) return !1;
		let n = this.nodes[t].position;
		return this.setFacingToward(n), this.surfaceY = this.nodes[t].surfaceY, this.routeRevision += 1, this.finishAt(t), !0;
	}
	abortToNode(e) {
		let t = this.nodeIndexById.get(e);
		if (t === void 0) return !1;
		let n = this.nodes[t];
		return this.routeRevision += 1, this.currentNodeIndex = t, this.targetNodeIndex = null, this.isRunning = !1, this.positionX = n.position.x, this.positionZ = n.position.z, this.surfaceY = n.surfaceY, this.surfacePitchRadians = 0, this.activePathKind = null, this.routeNodeIndices.length = 0, this.routeEdgeIndices.length = 0, this.routeCursor = 0, this.edgeProgress = 0, !0;
	}
	update(e) {
		if (!this.isRunning || this.targetNodeIndex === null || !Number.isFinite(e) || e <= 0) return;
		let t = Math.min(e, wn) * this.speed;
		for (; t > 0 && this.isRunning;) {
			let e = this.routeEdgeIndices[this.routeCursor], n = this.routeNodeIndices[this.routeCursor + 1], r = e === void 0 ? void 0 : this.runtimeEdges[e];
			if (e === void 0 || n === void 0 || !r) throw Error("PathSimulation encountered an invalid active route leg.");
			let i = Math.max(0, (1 - this.edgeProgress) * r.length);
			if (t + Sn < i) {
				this.edgeProgress += t / r.length, t = 0;
				break;
			}
			if (this.edgeProgress = 1, this.refreshPositionAndFacing(), t = Math.max(0, t - i), this.currentNodeIndex = n, n === this.targetNodeIndex && this.routeCursor === this.routeEdgeIndices.length - 1) {
				this.finishAt(n);
				return;
			}
			let a = {
				nodeId: this.nodes[n].id,
				routeRevision: this.routeRevision
			};
			this.nodeTraversedListeners.forEach((e) => e(a)), this.routeCursor += 1, this.edgeProgress = 0;
		}
		this.refreshPositionAndFacing();
	}
	onArrival(e) {
		return this.arrivalListeners.add(e), () => this.arrivalListeners.delete(e);
	}
	onNodeTraversed(e) {
		return this.nodeTraversedListeners.add(e), () => this.nodeTraversedListeners.delete(e);
	}
	getSnapshot() {
		let e = this.getActiveLegSnapshot(), t = [], n = [];
		if (this.isRunning) {
			for (let e = this.routeCursor; e < this.routeNodeIndices.length; e += 1) t.push(this.nodes[this.routeNodeIndices[e]].id);
			for (let e = this.routeCursor; e < this.routeEdgeIndices.length; e += 1) n.push(this.runtimeEdges[this.routeEdgeIndices[e]].source.id);
		}
		return {
			currentNodeId: this.nodes[this.currentNodeIndex].id,
			targetNodeId: this.targetNodeIndex === null ? null : this.nodes[this.targetNodeIndex].id,
			isRunning: this.isRunning,
			activeLeg: e,
			remainingRouteNodeIds: t,
			remainingRouteEdgeIds: n,
			position: {
				x: this.positionX,
				z: this.positionZ
			},
			facing: {
				x: this.facingX,
				z: this.facingZ
			},
			surfaceY: this.surfaceY,
			surfacePitchRadians: this.surfacePitchRadians,
			pathKind: this.activePathKind,
			routeRevision: this.routeRevision
		};
	}
	installRoute(e, t, n) {
		if (e.length !== t.length + 1 || t.length === 0) throw Error("A moving route must contain one more node than edge.");
		this.routeNodeIndices.length = 0, this.routeEdgeIndices.length = 0, this.routeNodeIndices.push(...e), this.routeEdgeIndices.push(...t), this.routeCursor = 0, this.edgeProgress = Math.max(0, Math.min(1, n));
	}
	refreshPositionAndFacing() {
		if (!this.isRunning) return;
		let e = this.routeNodeIndices[this.routeCursor], t = this.routeNodeIndices[this.routeCursor + 1];
		if (e === void 0 || t === void 0) return;
		let n = this.routeEdgeIndices[this.routeCursor];
		if (n === void 0) return;
		let r = this.runtimeEdges[n], i = this.geometryRegistry.sampleRoute(r.source.id, this.nodes[e].id, this.edgeProgress);
		this.positionX = i.position.x, this.positionZ = i.position.z, this.surfaceY = i.surfaceY, this.surfacePitchRadians = Math.atan2(i.tangent.y, Math.hypot(i.tangent.x, i.tangent.z)), this.activePathKind = i.pathKind;
		let a = Math.hypot(i.tangent.x, i.tangent.z);
		a > Sn && (this.facingX = i.tangent.x / a, this.facingZ = i.tangent.z / a);
	}
	setFacingToward(e) {
		let t = e.x - this.positionX, n = e.z - this.positionZ, r = Math.hypot(t, n);
		r > Sn && (this.facingX = t / r, this.facingZ = n / r);
	}
	finishAt(e) {
		let t = this.isRunning || this.currentNodeIndex !== e, n = this.nodes[e];
		if (this.currentNodeIndex = e, this.targetNodeIndex = null, this.isRunning = !1, this.positionX = n.position.x, this.positionZ = n.position.z, this.surfacePitchRadians = 0, this.activePathKind = null, this.routeNodeIndices.length = 0, this.routeEdgeIndices.length = 0, this.routeCursor = 0, this.edgeProgress = 0, t) {
			let e = {
				nodeId: n.id,
				routeRevision: this.routeRevision
			};
			this.arrivalListeners.forEach((t) => t(e));
		}
	}
	getActiveLegSnapshot() {
		if (!this.isRunning) return null;
		let e = this.routeEdgeIndices[this.routeCursor], t = this.routeNodeIndices[this.routeCursor], n = this.routeNodeIndices[this.routeCursor + 1];
		if (e === void 0 || t === void 0 || n === void 0) return null;
		let r = this.runtimeEdges[e], i = this.geometryRegistry.sampleRoute(r.source.id, this.nodes[t].id, this.edgeProgress);
		return {
			edgeId: r.source.id,
			fromNodeId: this.nodes[t].id,
			toNodeId: this.nodes[n].id,
			progress: this.edgeProgress,
			length: r.length,
			surfaceY: i.surfaceY,
			surfacePitchRadians: Math.atan2(i.tangent.y, Math.hypot(i.tangent.x, i.tangent.z)),
			pathKind: i.pathKind
		};
	}
	findShortestPath(e, t) {
		if (e === t) return {
			nodeIndices: [e],
			edgeIndices: [],
			distance: 0
		};
		let n = this.nodes.length, r = new Float64Array(n), i = new Uint8Array(n), a = new Int32Array(n), o = new Int32Array(n);
		r.fill(Infinity), a.fill(-1), o.fill(-1), r[e] = 0;
		for (let e = 0; e < n; e += 1) {
			let e = -1, s = Infinity;
			for (let t = 0; t < n; t += 1) {
				if (i[t] === 1) continue;
				let n = r[t], a = n + Cn < s, o = Math.abs(n - s) <= Cn && e >= 0 && this.nodeTieRanks[t] < this.nodeTieRanks[e];
				(a || o) && (e = t, s = n);
			}
			if (e < 0 || !Number.isFinite(s) || e === t) break;
			i[e] = 1;
			let c = this.adjacency[e];
			for (let t = 0; t < c.length; t += 1) {
				let n = c[t];
				if (i[n.nodeIndex] === 1) continue;
				let l = s + n.routingCost, u = r[n.nodeIndex], d = l + Cn < u, f = a[n.nodeIndex], p = Math.abs(l - u) <= Cn && (f < 0 || this.nodeTieRanks[e] < this.nodeTieRanks[f] || this.nodeTieRanks[e] === this.nodeTieRanks[f] && this.runtimeEdges[n.edgeIndex].source.id < this.runtimeEdges[o[n.nodeIndex]].source.id);
				(d || p) && (r[n.nodeIndex] = l, a[n.nodeIndex] = e, o[n.nodeIndex] = n.edgeIndex);
			}
		}
		if (!Number.isFinite(r[t])) return null;
		let s = [t], c = [], l = t;
		for (; l !== e;) {
			let e = a[l], t = o[l];
			if (e < 0 || t < 0) return null;
			c.push(t), s.push(e), l = e;
		}
		return s.reverse(), c.reverse(), {
			nodeIndices: s,
			edgeIndices: c,
			distance: r[t]
		};
	}
	validateAndBuildGraph(e) {
		if (e.nodes.length < 1) throw Error("PathSimulation requires at least one graph node.");
		let t = /* @__PURE__ */ new Set();
		e.nodes.forEach((e, n) => {
			if (e.id.trim().length === 0) throw Error(`Node at index ${n} has an empty id.`);
			if (t.has(e.id)) throw Error(`Duplicate node id "${e.id}".`);
			if (!Number.isFinite(e.position.x) || !Number.isFinite(e.position.z)) throw Error(`Node "${e.id}" has a non-finite position.`);
			t.add(e.id), this.nodeIndexById.set(e.id, n);
		});
		for (let [t, n] of [
			["initial", e.initialNodeId],
			["entry", e.entryNodeId],
			["goal", e.goalNodeId]
		]) if (!this.nodeIndexById.has(n)) throw Error(`Graph ${t} node "${n}" does not exist.`);
		e.nodes.map((e, t) => t).sort((t, n) => e.nodes[t].id.localeCompare(e.nodes[n].id)).forEach((e, t) => {
			this.nodeTieRanks[e] = t;
		}), e.edges.forEach((e) => {
			this.validateRuntimeEdgeIdentity(e);
			let t = Tn(e.fromNodeId, e.toNodeId);
			if (this.physicalPairKeys.has(t)) throw Error(`Duplicate physical edge between "${e.fromNodeId}" and "${e.toNodeId}".`);
			this.installRuntimeEdge(e);
		}), this.adjacency.forEach((e) => {
			e.sort((e, t) => {
				let n = this.nodeTieRanks[e.nodeIndex] - this.nodeTieRanks[t.nodeIndex];
				return n === 0 ? this.runtimeEdges[e.edgeIndex].source.id.localeCompare(this.runtimeEdges[t.edgeIndex].source.id) : n;
			});
		}), this.validateConnectedGraph(), this.validateDirectedAcyclicGraph();
	}
	validateRuntimeEdgeIdentity(e) {
		if (e.id.trim().length === 0) throw Error("PathSimulation cannot register an edge with an empty id.");
		if (this.edgeIndexById.has(e.id)) throw Error(`Duplicate edge id "${e.id}".`);
		let t = this.nodeIndexById.get(e.fromNodeId), n = this.nodeIndexById.get(e.toNodeId);
		if (t === void 0 || n === void 0) throw Error(`Edge "${e.id}" references a missing endpoint (${e.fromNodeId} -> ${e.toNodeId}).`);
		if (t === n) throw Error(`Edge "${e.id}" is a self-loop.`);
	}
	installRuntimeEdge(e) {
		let t = this.nodeIndexById.get(e.fromNodeId), n = this.nodeIndexById.get(e.toNodeId), r = this.geometryRegistry.get(e.id);
		if (r.fromNodeId !== e.fromNodeId || r.toNodeId !== e.toNodeId || r.pathKind !== e.pathKind) throw Error(`Geometry registry edge "${e.id}" does not match the graph.`);
		let i = r.length;
		if (!Number.isFinite(i) || i <= Sn) throw Error(`Edge "${e.id}" has zero or non-finite length.`);
		let a = e.pathKind === "overpass" ? e.routingCost : i;
		if (!Number.isFinite(a) || a <= Sn) throw Error(`Edge "${e.id}" has an invalid routing cost.`);
		let o = this.runtimeEdges.length;
		this.edgeIndexById.set(e.id, o), this.physicalPairKeys.add(Tn(e.fromNodeId, e.toNodeId)), this.runtimeEdges.push({
			source: e,
			fromNodeIndex: t,
			toNodeIndex: n,
			length: i,
			routingCost: a
		}), this.adjacency[t].push({
			nodeIndex: n,
			edgeIndex: o,
			length: i,
			routingCost: a
		}), this.adjacency[n].push({
			nodeIndex: t,
			edgeIndex: o,
			length: i,
			routingCost: a
		});
	}
	sortAdjacencyForNode(e) {
		let t = this.nodeIndexById.get(e);
		t !== void 0 && this.adjacency[t].sort((e, t) => this.nodeTieRanks[e.nodeIndex] - this.nodeTieRanks[t.nodeIndex] || this.runtimeEdges[e.edgeIndex].source.id.localeCompare(this.runtimeEdges[t.edgeIndex].source.id));
	}
	validateConnectedGraph() {
		let e = new Uint8Array(this.nodes.length), t = new Int32Array(this.nodes.length), n = 0, r = 1;
		for (t[0] = 0, e[0] = 1; n < r;) {
			let i = t[n++];
			for (let n of this.adjacency[i]) e[n.nodeIndex] !== 1 && (e[n.nodeIndex] = 1, t[r++] = n.nodeIndex);
		}
		if (r !== this.nodes.length) throw Error(`Learning path graph is disconnected (${r}/${this.nodes.length} reachable nodes).`);
	}
	validateDirectedAcyclicGraph() {
		let e = new Int32Array(this.nodes.length), t = this.nodes.map(() => []);
		for (let n of this.runtimeEdges) n.source.pathKind !== "overpass" && (e[n.toNodeIndex] = e[n.toNodeIndex] + 1, t[n.fromNodeIndex].push(n.toNodeIndex));
		let n = new Int32Array(this.nodes.length), r = 0, i = 0;
		for (let t = 0; t < this.nodes.length; t += 1) e[t] === 0 && (n[i++] = t);
		let a = 0;
		for (; r < i;) {
			let o = n[r++];
			a += 1;
			for (let r of t[o]) e[r] = e[r] - 1, e[r] === 0 && (n[i++] = r);
		}
		if (a !== this.nodes.length) throw Error("Learning path progression edges must form a directed acyclic graph.");
	}
}, On = class {
	app;
	canvas;
	nodeOptions;
	statusLabel;
	loadingPanel;
	loadingLabel;
	toast;
	screenReaderStatus;
	document;
	browserWindow;
	optionIdPrefix;
	nodesById = /* @__PURE__ */ new Map();
	nodeOptionById = /* @__PURE__ */ new Map();
	learningStatusByNodeId = /* @__PURE__ */ new Map();
	hiddenNodeIds = /* @__PURE__ */ new Set();
	activeNodeId = null;
	currentNodeId = null;
	toastTimer = 0;
	hudTimer = 0;
	announcementFrame = 0;
	constructor(e, t) {
		this.app = e.root, this.canvas = e.canvas, this.nodeOptions = e.nodeOptions, this.statusLabel = e.statusLabel, this.loadingPanel = e.loadingPanel, this.loadingLabel = e.loadingLabel, this.toast = e.toast, this.screenReaderStatus = e.screenReaderStatus, this.document = e.root.ownerDocument;
		let n = this.document.defaultView;
		if (!n) throw Error("Learning-path UI requires a browser window.");
		this.browserWindow = n, this.optionIdPrefix = `learning-path-${t}-node-option`;
	}
	setLoading(e) {
		this.showHud(!1), this.app.setAttribute("aria-busy", "true"), this.loadingPanel.dataset.state = "visible", this.loadingLabel.textContent = e === null ? "正在召唤刘看山…" : `正在召唤刘看山… ${Math.round(e * 100)}%`;
	}
	dispose() {
		this.browserWindow.clearTimeout(this.toastTimer), this.browserWindow.clearTimeout(this.hudTimer), this.browserWindow.cancelAnimationFrame(this.announcementFrame);
	}
	configureNodes(e, t = null) {
		this.nodesById.clear(), this.nodeOptionById.clear(), this.learningStatusByNodeId.clear(), this.hiddenNodeIds.clear(), this.activeNodeId = null, this.currentNodeId = this.resolveNodeId(t), this.canvas.removeAttribute("aria-activedescendant");
		let n = this.document.createDocumentFragment();
		for (let t of e) {
			if (this.nodesById.has(t.id)) throw Error(`Duplicate learning-path node id: ${t.id}`);
			this.nodesById.set(t.id, t), this.learningStatusByNodeId.set(t.id, t.initiallyGreen ? "completed" : "locked");
			let e = this.document.createElement("li");
			e.id = this.getOptionId(t.id), e.dataset.nodeId = t.id, e.setAttribute("role", "option"), e.setAttribute("aria-selected", "false"), t.initiallyVisible ? this.applyNodeOptionVisibility(e, !0) : (this.hiddenNodeIds.add(t.id), this.applyNodeOptionVisibility(e, !1)), this.nodeOptionById.set(t.id, e), n.append(e);
		}
		this.nodeOptions.replaceChildren(n), this.nodeOptions.setAttribute("aria-label", `${e.length - this.hiddenNodeIds.size} 个可见学习路径节点`), this.updateAllNodeOptions(), this.currentNodeId !== null && this.setActiveNode(this.currentNodeId);
	}
	setReady(e) {
		this.app.setAttribute("aria-busy", "false"), this.loadingPanel.dataset.state = "hidden", this.statusLabel.textContent = `${e.label} · 点击任意圆台查看`, this.setCurrentNode(e.id), this.setActiveNode(e), this.showHud(!0), this.announce(`学习路径已就绪，刘看山位于${e.label}。`);
	}
	setTravelling(e) {
		this.statusLabel.textContent = `正在前往 ${e.label}`, this.setCurrentNode(null), this.setActiveNode(e), this.app.dataset.hint = "hidden", this.showHud(!0), this.announce(`刘看山正在前往${e.label}。`);
	}
	setArrived(e) {
		this.statusLabel.textContent = `${e.label} · 已到达`, this.setCurrentNode(e.id), this.setActiveNode(e), this.showToast(`已到达 ${e.label}`), this.showHud(!0), this.announce(`刘看山已到达${e.label}。`);
	}
	announceKeyboardSelection(e) {
		this.setActiveNode(e), this.announce(`已选择${e.label}，按回车键查看详情。`);
	}
	getNodeOptionElement(e) {
		return this.nodeOptionById.get(e) ?? null;
	}
	setNodeLearningStatus(e, t) {
		this.nodesById.has(e) && this.learningStatusByNodeId.get(e) !== t && (this.learningStatusByNodeId.set(e, t), this.updateNodeOption(e));
	}
	setNodeVisible(e, t) {
		let n = this.resolveNodeId(e);
		if (n === null || !this.nodesById.has(n)) return;
		let r = this.nodeOptionById.get(n);
		r && !this.hiddenNodeIds.has(n) !== t && (t ? this.hiddenNodeIds.delete(n) : (this.hiddenNodeIds.add(n), this.activeNodeId === n && (this.activeNodeId = null, this.canvas.removeAttribute("aria-activedescendant"))), this.applyNodeOptionVisibility(r, t), this.nodeOptions.setAttribute("aria-label", `${this.nodesById.size - this.hiddenNodeIds.size} 个可见学习路径节点`), this.updateNodeOption(n), this.updateSelectedOptions());
	}
	setContextPaused() {
		this.statusLabel.textContent = "图形显示已暂停，正在恢复…", this.showToast("3D 显示暂时中断，正在安全恢复"), this.showHud(!1);
	}
	setError(e) {
		this.app.setAttribute("aria-busy", "false"), this.loadingPanel.dataset.state = "error", this.loadingLabel.textContent = e, this.statusLabel.textContent = "3D 场景暂不可用", this.showHud(!1), this.announce(e);
	}
	showToast(e) {
		this.browserWindow.clearTimeout(this.toastTimer), this.toast.textContent = e, this.toast.dataset.state = "visible", this.toastTimer = this.browserWindow.setTimeout(() => {
			this.toast.dataset.state = "hidden";
		}, 1800);
	}
	setActiveNode(e) {
		let t = this.resolveNodeId(e), n = t === null ? null : this.nodeOptionById.get(t) ?? null;
		if (!n || !this.nodeOptions.contains(n) || this.hiddenNodeIds.has(t)) {
			if (this.activeNodeId === null) return;
			this.activeNodeId = null, this.canvas.removeAttribute("aria-activedescendant"), this.updateSelectedOptions();
			return;
		}
		this.activeNodeId !== t && (this.activeNodeId = t, this.updateSelectedOptions(), this.canvas.setAttribute("aria-activedescendant", n.id));
	}
	setCurrentNode(e) {
		let t = this.resolveNodeId(e);
		this.currentNodeId !== t && (this.currentNodeId = t, this.updateAllNodeOptions());
	}
	updateAllNodeOptions() {
		for (let e of this.nodesById.keys()) this.updateNodeOption(e);
		this.updateSelectedOptions();
	}
	updateNodeOption(e) {
		let t = this.nodesById.get(e), n = this.nodeOptionById.get(e);
		if (!t || !n) return;
		let r = this.learningStatusByNodeId.get(e) ?? "locked", i = t.variant === "brown" && (r === "in-progress" || r === "completed") ? "棕色" : t.variant !== "brown" && r === "completed" ? "绿色" : "灰色", a = r === "locked" ? "未解锁" : r === "available" ? "可学习" : r === "in-progress" ? "学习中" : "已完成", o = e === this.currentNodeId;
		n.dataset.learningState = r, n.textContent = `${t.label}，${i}，${a}${o ? "，当前位置" : ""}`, n.setAttribute("aria-disabled", String(this.hiddenNodeIds.has(e))), o ? n.setAttribute("aria-current", "step") : n.removeAttribute("aria-current");
	}
	updateSelectedOptions() {
		for (let [e, t] of this.nodeOptionById) t.setAttribute("aria-selected", String(!this.hiddenNodeIds.has(e) && e === this.activeNodeId));
	}
	applyNodeOptionVisibility(e, t) {
		e.hidden = !t, e.setAttribute("aria-hidden", String(!t)), e.setAttribute("aria-disabled", String(!t)), e.tabIndex = -1;
	}
	resolveNodeId(e) {
		return typeof e == "string" ? e : e?.id ?? null;
	}
	getOptionId(e) {
		return `${this.optionIdPrefix}-${e}`;
	}
	announce(e) {
		this.browserWindow.cancelAnimationFrame(this.announcementFrame), this.screenReaderStatus.textContent = "", this.announcementFrame = this.browserWindow.requestAnimationFrame(() => {
			this.announcementFrame = 0, this.screenReaderStatus.textContent = e;
		});
	}
	showHud(e) {
		this.browserWindow.clearTimeout(this.hudTimer), this.app.dataset.hud = "visible", e && (this.hudTimer = this.browserWindow.setTimeout(() => {
			this.app.dataset.hud = "hidden";
		}, 3200));
	}
}, kn = .79, An = .593, jn = 12, Mn = Math.PI * 2, Nn = class {
	worldPoint = new y();
	result = {
		nodeId: "",
		visible: !1,
		left: 0,
		top: 0,
		right: 0,
		bottom: 0,
		width: 0,
		height: 0,
		centerX: 0,
		anchorClientX: 0,
		anchorClientY: 0,
		normalizedDepth: 1
	};
	project(e, t, n, r) {
		let i = typeof r == "function" ? r(e) : r.get(e);
		if (!i || !Fn(n) || !In(i)) return null;
		let a = Pn(i.overlayRadius) ? i.overlayRadius : kn, o = Number.isFinite(i.overlayBottomY) ? i.overlayBottomY : i.surfaceY - An, s = Infinity, c = -Infinity, l = Infinity, u = -Infinity, d = Infinity, f = !1;
		t.updateMatrixWorld();
		for (let e = 0; e < jn; e += 1) {
			let r = e / jn * Mn;
			this.worldPoint.set(i.position.x + Math.cos(r) * a, o, i.position.z + Math.sin(r) * a).project(t);
			let p = n.left + (this.worldPoint.x + 1) * .5 * n.width, m = n.top + (1 - this.worldPoint.y) * .5 * n.height;
			s = Math.min(s, p), c = Math.max(c, p), l = Math.min(l, m), u = Math.max(u, m), d = Math.min(d, this.worldPoint.z), this.worldPoint.z >= -1 && this.worldPoint.z <= 1 && (f = !0);
		}
		let p = c >= n.left && s <= n.left + n.width && u >= n.top && l <= n.top + n.height;
		return this.result.nodeId = e, this.result.visible = f && p, this.result.left = s, this.result.top = l, this.result.right = c, this.result.bottom = u, this.result.width = c - s, this.result.height = u - l, this.result.centerX = (s + c) * .5, this.result.anchorClientX = this.result.centerX, this.result.anchorClientY = u, this.result.normalizedDepth = d, this.result;
	}
};
function Pn(e) {
	return e !== void 0 && Number.isFinite(e) && e > 0;
}
function Fn(e) {
	return Number.isFinite(e.left) && Number.isFinite(e.top) && Number.isFinite(e.width) && Number.isFinite(e.height) && e.width > 0 && e.height > 0;
}
function In(e) {
	return Number.isFinite(e.position.x) && Number.isFinite(e.position.z) && Number.isFinite(e.surfaceY);
}
//#endregion
//#region src/ui/RecoveryStatusOverlay.ts
var Ln = {
	injected: {
		title: "检测到故障",
		message: "已暂停当前事务，正在检查故障",
		progress: 0
	},
	retrying: {
		title: "正在重试",
		message: "正在重新执行失败步骤",
		progress: null
	},
	compensating: {
		title: "正在安全回滚",
		message: "正在恢复最后一个稳定状态",
		progress: null
	},
	recovered: {
		title: "已自动恢复",
		message: "状态已校正，可以继续操作",
		progress: 1
	},
	failed: {
		title: "恢复失败",
		message: "自动恢复未完成，请重新操作",
		progress: null
	}
}, Rn = 240, zn = class {
	app;
	document;
	browserWindow;
	styleElement;
	root;
	titleElement;
	messageElement;
	progressElement;
	progressFill;
	recoveredAutoHideMs;
	failedAutoHideMs;
	autoHideTimer = 0;
	hideTransitionTimer = 0;
	disposed = !1;
	state = Object.freeze({
		phase: "hidden",
		title: "",
		message: "",
		progress: null,
		visible: !1,
		revision: 0
	});
	constructor(e) {
		this.app = e.app, this.document = this.app.ownerDocument;
		let t = this.document.defaultView;
		if (!t) throw Error("RecoveryStatusOverlay requires a browser window.");
		this.browserWindow = t, this.recoveredAutoHideMs = this.normalizeDelay(e.recoveredAutoHideMs, 2600), this.failedAutoHideMs = this.normalizeDelay(e.failedAutoHideMs, 6200), this.styleElement = this.createStyleElement(), this.root = this.document.createElement("section"), this.root.className = "recovery-status-overlay", this.root.dataset.recoveryStatusOverlay = "true", this.root.dataset.phase = "hidden", this.root.dataset.visible = "false", this.root.hidden = !0, this.root.setAttribute("role", "status"), this.root.setAttribute("aria-live", "polite"), this.root.setAttribute("aria-atomic", "true");
		let n = this.document.createElement("span");
		n.className = "recovery-status-overlay__marker", n.setAttribute("aria-hidden", "true");
		let r = this.document.createElement("span");
		r.className = "recovery-status-overlay__copy", this.titleElement = this.document.createElement("strong"), this.titleElement.className = "recovery-status-overlay__title", this.messageElement = this.document.createElement("span"), this.messageElement.className = "recovery-status-overlay__message";
		let i = this.document.createElement("span");
		i.className = "recovery-status-overlay__progress-row";
		let a = this.document.createElement("span");
		a.className = "recovery-status-overlay__progress-track", a.setAttribute("role", "progressbar"), a.setAttribute("aria-label", "恢复进度"), a.setAttribute("aria-valuemin", "0"), a.setAttribute("aria-valuemax", "100"), this.progressFill = this.document.createElement("span"), this.progressFill.className = "recovery-status-overlay__progress-fill", a.append(this.progressFill), this.progressElement = this.document.createElement("span"), this.progressElement.className = "recovery-status-overlay__progress-label", i.append(a, this.progressElement), r.append(this.titleElement, this.messageElement, i), this.root.append(n, r), (this.document.head ?? this.document.documentElement).append(this.styleElement), this.app.append(this.root);
	}
	get snapshot() {
		return Object.freeze({ ...this.state });
	}
	get element() {
		return this.root;
	}
	setPhase(e, t = {}) {
		if (this.assertActive(), this.clearTimers(), e === "hidden") return this.hide(), this.snapshot;
		let n = Ln[e], r = t.progress === void 0 ? n.progress : this.normalizeProgress(t.progress), i = t.message ?? n.message;
		this.root.hidden = !1, this.root.dataset.phase = e, this.root.dataset.visible = "true", this.root.setAttribute("aria-live", e === "failed" ? "assertive" : "polite"), this.root.setAttribute("aria-label", `${n.title}。${i}`), this.titleElement.textContent = n.title, this.messageElement.textContent = i, this.renderProgress(r), this.state = Object.freeze({
			phase: e,
			title: n.title,
			message: i,
			progress: r,
			visible: !0,
			revision: this.state.revision + 1
		});
		let a = this.resolveAutoHideDelay(e, t.autoHideMs);
		return a > 0 && (this.autoHideTimer = this.browserWindow.setTimeout(() => this.hide(), a)), this.snapshot;
	}
	hide() {
		this.disposed || (this.clearTimers(), this.root.dataset.phase = "hidden", this.root.dataset.visible = "false", this.root.setAttribute("aria-live", "polite"), this.root.removeAttribute("aria-label"), this.state = Object.freeze({
			phase: "hidden",
			title: "",
			message: "",
			progress: null,
			visible: !1,
			revision: this.state.revision + 1
		}), this.hideTransitionTimer = this.browserWindow.setTimeout(() => {
			this.hideTransitionTimer = 0, this.root.dataset.visible === "false" && (this.root.hidden = !0);
		}, Rn));
	}
	dispose() {
		this.disposed || (this.clearTimers(), this.disposed = !0, this.root.remove(), this.styleElement.remove());
	}
	renderProgress(e) {
		let t = this.progressFill.parentElement;
		if (!t) return;
		if (e === null) {
			t.dataset.indeterminate = "true", t.removeAttribute("aria-valuenow"), t.setAttribute("aria-valuetext", "处理中"), this.progressFill.style.removeProperty("--recovery-progress"), this.progressElement.textContent = "处理中";
			return;
		}
		let n = Math.round(e * 100);
		t.dataset.indeterminate = "false", t.setAttribute("aria-valuenow", String(n)), t.setAttribute("aria-valuetext", `${n}%`), this.progressFill.style.setProperty("--recovery-progress", `${n}%`), this.progressElement.textContent = `${n}%`;
	}
	resolveAutoHideDelay(e, t) {
		return t === void 0 ? e === "recovered" ? this.recoveredAutoHideMs : e === "failed" ? this.failedAutoHideMs : 0 : this.normalizeDelay(t, 0);
	}
	normalizeProgress(e) {
		return e === null ? null : Number.isFinite(e) ? Math.min(1, Math.max(0, e)) : 0;
	}
	normalizeDelay(e, t) {
		return e === void 0 || !Number.isFinite(e) ? t : Math.max(0, e);
	}
	clearTimers() {
		this.browserWindow.clearTimeout(this.autoHideTimer), this.browserWindow.clearTimeout(this.hideTransitionTimer), this.autoHideTimer = 0, this.hideTransitionTimer = 0;
	}
	assertActive() {
		if (this.disposed) throw Error("RecoveryStatusOverlay has already been disposed.");
	}
	createStyleElement() {
		let e = this.document.createElement("style");
		return e.dataset.recoveryStatusOverlayStyles = "true", e.textContent = "\n[data-learning-path-root] .recovery-status-overlay {\n  --recovery-accent: #dc3f49;\n  --recovery-accent-rgb: 220 63 73;\n  position: absolute;\n  z-index: 8;\n  top: var(--safe-top, max(18px, env(safe-area-inset-top)));\n  right: max(18px, env(safe-area-inset-right));\n  display: grid;\n  grid-template-columns: 30px minmax(0, 1fr);\n  align-items: center;\n  width: min(330px, calc(100% - 36px));\n  min-height: 64px;\n  padding: 10px 13px 10px 11px;\n  border: 1px solid rgb(255 255 255 / 88%);\n  border-radius: 18px;\n  color: #343836;\n  background: rgb(255 255 255 / 90%);\n  box-shadow:\n    0 14px 38px rgb(46 55 49 / 13%),\n    0 3px 10px rgb(var(--recovery-accent-rgb) / 10%),\n    inset 3px 0 0 var(--recovery-accent),\n    inset 0 1px 0 rgb(255 255 255 / 88%);\n  backdrop-filter: blur(18px) saturate(1.08);\n  pointer-events: none;\n  opacity: 1;\n  transform: translate3d(0, 0, 0);\n  transform-origin: right top;\n  transition:\n    opacity 180ms ease,\n    transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1),\n    box-shadow 240ms ease;\n}\n\n[data-learning-path-root] .recovery-status-overlay[data-visible=\"false\"] {\n  opacity: 0;\n  transform: translate3d(8px, -5px, 0) scale(0.985);\n}\n\n[data-learning-path-root] .recovery-status-overlay[data-phase=\"retrying\"],\n[data-learning-path-root] .recovery-status-overlay[data-phase=\"compensating\"] {\n  --recovery-accent: #f2b51d;\n  --recovery-accent-rgb: 242 181 29;\n}\n\n[data-learning-path-root] .recovery-status-overlay[data-phase=\"recovered\"] {\n  --recovery-accent: #27b957;\n  --recovery-accent-rgb: 39 185 87;\n}\n\n[data-learning-path-root] .recovery-status-overlay[data-phase=\"failed\"] {\n  --recovery-accent: #c72d3a;\n  --recovery-accent-rgb: 199 45 58;\n}\n\n[data-learning-path-root] .recovery-status-overlay__marker {\n  position: relative;\n  display: block;\n  width: 19px;\n  height: 19px;\n  margin-inline: auto;\n  border: 2px solid var(--recovery-accent);\n  border-radius: 50%;\n  background: rgb(var(--recovery-accent-rgb) / 12%);\n  box-shadow: 0 0 0 5px rgb(var(--recovery-accent-rgb) / 10%);\n}\n\n[data-learning-path-root] .recovery-status-overlay__marker::after {\n  content: \"\";\n  position: absolute;\n  inset: 4px;\n  border-radius: inherit;\n  background: var(--recovery-accent);\n}\n\n[data-learning-path-root] .recovery-status-overlay[data-phase=\"retrying\"] .recovery-status-overlay__marker,\n[data-learning-path-root] .recovery-status-overlay[data-phase=\"compensating\"] .recovery-status-overlay__marker {\n  border-color: rgb(var(--recovery-accent-rgb) / 28%);\n  border-top-color: var(--recovery-accent);\n  background: transparent;\n  animation: recovery-status-spin 720ms linear infinite;\n}\n\n[data-learning-path-root] .recovery-status-overlay[data-phase=\"retrying\"] .recovery-status-overlay__marker::after,\n[data-learning-path-root] .recovery-status-overlay[data-phase=\"compensating\"] .recovery-status-overlay__marker::after {\n  display: none;\n}\n\n[data-learning-path-root] .recovery-status-overlay[data-phase=\"recovered\"] .recovery-status-overlay__marker::after {\n  inset: 3px;\n  border: solid #fff;\n  border-width: 0 2px 2px 0;\n  border-radius: 0;\n  background: transparent;\n  transform: rotate(45deg) translate(-1px, -1px);\n}\n\n[data-learning-path-root] .recovery-status-overlay__copy {\n  display: grid;\n  min-width: 0;\n  padding-left: 9px;\n}\n\n[data-learning-path-root] .recovery-status-overlay__title {\n  overflow: hidden;\n  color: #2f3331;\n  font-size: 12px;\n  font-weight: 780;\n  letter-spacing: 0.025em;\n  line-height: 1.25;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n[data-learning-path-root] .recovery-status-overlay__message {\n  margin-top: 2px;\n  overflow: hidden;\n  color: #6b716d;\n  font-size: 10.5px;\n  font-weight: 580;\n  letter-spacing: 0.01em;\n  line-height: 1.3;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n[data-learning-path-root] .recovery-status-overlay__progress-row {\n  display: grid;\n  grid-template-columns: minmax(64px, 1fr) 34px;\n  align-items: center;\n  gap: 8px;\n  margin-top: 6px;\n}\n\n[data-learning-path-root] .recovery-status-overlay__progress-track {\n  position: relative;\n  display: block;\n  height: 3px;\n  overflow: hidden;\n  border-radius: 999px;\n  background: rgb(var(--recovery-accent-rgb) / 14%);\n}\n\n[data-learning-path-root] .recovery-status-overlay__progress-fill {\n  position: absolute;\n  inset: 0 auto 0 0;\n  display: block;\n  width: var(--recovery-progress, 0%);\n  border-radius: inherit;\n  background: var(--recovery-accent);\n  transition: width 260ms cubic-bezier(0.2, 0.8, 0.2, 1);\n}\n\n[data-learning-path-root] .recovery-status-overlay__progress-track[data-indeterminate=\"true\"] .recovery-status-overlay__progress-fill {\n  width: 42%;\n  animation: recovery-status-progress 900ms ease-in-out infinite;\n}\n\n[data-learning-path-root] .recovery-status-overlay__progress-label {\n  color: var(--recovery-accent);\n  font-size: 9.5px;\n  font-weight: 760;\n  line-height: 1;\n  text-align: right;\n}\n\n@keyframes recovery-status-spin {\n  to { transform: rotate(360deg); }\n}\n\n@keyframes recovery-status-progress {\n  0% { left: -42%; }\n  55% { left: 50%; }\n  100% { left: 100%; }\n}\n\n@container (max-width: 600px) {\n  [data-learning-path-root] .recovery-status-overlay {\n    top: calc(var(--safe-top, max(18px, env(safe-area-inset-top))) + 54px);\n    right: max(12px, env(safe-area-inset-right));\n    width: min(300px, calc(100% - 24px));\n    min-height: 58px;\n    padding-block: 8px;\n  }\n}\n\n@media (prefers-reduced-motion: reduce) {\n  [data-learning-path-root] .recovery-status-overlay,\n  [data-learning-path-root] .recovery-status-overlay__progress-fill {\n    transition-duration: 1ms;\n  }\n\n  [data-learning-path-root] .recovery-status-overlay__marker,\n  [data-learning-path-root] .recovery-status-overlay__progress-fill {\n    animation-duration: 1600ms !important;\n  }\n}\n", e;
	}
};
//#endregion
//#region src/app/pathOrchestrationBindingBarrier.ts
function Bn(e, t) {
	return e.isPathOrchestrationBound() ? (t(), !0) : !1;
}
//#endregion
//#region src/app/LearningPathSession.ts
var Vn = _.degToRad(26), Hn = _.degToRad(48), Un = 320, Wn = (e) => `/assets/${e}`, Gn = () => ({
	run: Wn("liu-kanshan-run.glb"),
	runStop: Wn("liu-kanshan-run-stop.glb"),
	idle: Wn("liu-kanshan-idle.glb"),
	turn: Wn("liu-kanshan-turn.glb")
});
function Kn(e) {
	let t = e.canvas, n = t.ownerDocument, r = n.defaultView;
	if (!r) throw Error("Learning-path session requires a browser window.");
	let { runtimeBundle: i } = e, a = i.graph.initialNodeId, o = i.nodes, s = i.authoredStraightEdges, c = i.authoredLogicalEdges, l = i.runtimeStraightEdges, u = i.overpassCatalog, d = i.edges, f = i.graph, p = i.diagnostics, m = e.specialZones, h = e.dynamicBridgeRule, g = i.getNodeById, v = i.getNodeIndex, b = i.getOverpassEdgeBetween, S = new Nn(), C = v(a), w = g(a);
	if (C < 0 || !w) throw Error(`Initial learning-path node "${a}" is missing.`);
	let T = new On(e.ui, e.instanceId);
	T.configureNodes(o, w);
	let E = new URLSearchParams(r.location.search), D = e.diagnostics ?? E.get("qa") === "1", O = null;
	if (D) {
		let t = `learning-path-${e.instanceId}-qa-debug`, r = e.ui.root.querySelector(`#${t}`);
		r instanceof HTMLOutputElement ? O = r : (O = n.createElement("output"), O.id = t, O.hidden = !0, O.setAttribute("aria-hidden", "true"), e.ui.root.append(O));
	}
	let k = "booting", A = !1, j = null, M = !1, N = C, P = !1, F = new Oe(), ee = new be({ document: n }), I;
	try {
		let n = e.compiledPath.nodeById.get(a)?.layer ?? 0;
		I = new We(t, o.map((t) => ({
			...t,
			initiallyVisible: (() => {
				let r = e.compiledPath.nodeById.get(t.id);
				return r?.entityKind === "subject" && r.layer <= n + 5;
			})()
		})), e.viewport);
	} catch (e) {
		throw k = "degraded", T.setError("当前浏览器无法启动 3D 显示，请启用 WebGL 后重试。"), e;
	}
	let ne = new Lt(f), L = new Dn(f, 13.25, ne), re = L.onNodeTraversed((t) => {
		e.onNodeTraversed?.(Object.freeze({
			nodeId: t.nodeId,
			routeRevision: t.routeRevision
		}));
	}), ie = new tn({
		nodes: o,
		authoredStraightEdges: l,
		authoredLogicalEdges: c,
		dynamicBridgeRule: h,
		specialZones: m,
		overpassPairLookup: b,
		basePathIndex: new Dt(o, c)
	}), ae = e.introAnimation ?? !0, R = new Ct({
		nodes: ae ? o.map((e) => ({
			...e,
			initiallyVisible: !1
		})) : o,
		edges: ae ? d.map((e) => ({
			...e,
			initiallyVisible: !1
		})) : d,
		initialNodeIndex: C,
		geometryRegistry: ne
	}), z = e.preparedCharacter?.character ?? new te(I.renderer.capabilities.getMaxAnisotropy()), oe = new zn({
		app: e.ui.root,
		recoveredAutoHideMs: 3200,
		failedAutoHideMs: 8e3
	}), se = /* @__PURE__ */ new Set(), ce = 0, le = 0, ue = 0, de = 0, B = null, fe = () => {
		ce += 1, se.forEach((e) => r.clearTimeout(e)), se.clear(), le = 0, ue = 0, de = 0, B = null;
	}, V = (e, t, n = 0) => {
		let i = ce, a = ++ue, o = performance.now(), s = Math.max(o, le);
		le = s + Math.max(0, n);
		let c = () => {
			i !== ce || a <= de || (de = a, oe.setPhase(e, t));
		}, l = Math.max(0, s - o);
		if (l <= 8) {
			c();
			return;
		}
		let u = r.setTimeout(() => {
			se.delete(u), c();
		}, l);
		se.add(u);
	}, me = E;
	Object.freeze([
		Object.freeze({
			id: "presentation-failure",
			label: "表现命令连续失败",
			rules: Object.freeze([Object.freeze({
				id: "fail-presentation-attempts",
				point: ge.PRESENTATION_COMMAND,
				attempt: Object.freeze([1, 2]),
				times: 2,
				behavior: Object.freeze({
					kind: "throw",
					message: "演示注入：表现命令失败。"
				})
			})])
		}),
		Object.freeze({
			id: "motion-failure",
			label: "移动中途失败",
			rules: Object.freeze([Object.freeze({
				id: "fail-motion-at-35-percent",
				point: "motion.progress-35",
				times: 1,
				behavior: Object.freeze({
					kind: "throw",
					message: "演示注入：移动在 35% 处失败。"
				})
			})])
		}),
		Object.freeze({
			id: "ack-timeout",
			label: "表现 ACK 超时与迟到 ACK",
			rules: Object.freeze([Object.freeze({
				id: "delay-first-presentation-ack",
				point: ge.PRESENTATION_ACK,
				attempt: 1,
				times: 1,
				behavior: Object.freeze({
					kind: "delay",
					delayMs: 1800
				})
			})])
		}),
		Object.freeze({
			id: "partial-commit",
			label: "部分提交后的补偿回滚",
			rules: Object.freeze([Object.freeze({
				id: "fail-next-two-presentation-attempts",
				point: ge.PRESENTATION_COMMAND,
				attempt: Object.freeze([1, 2]),
				times: 2,
				behavior: Object.freeze({
					kind: "throw",
					message: "演示注入：部分提交后的下一步骤失败。"
				})
			})])
		}),
		Object.freeze({
			id: "character-stop-timeout",
			label: "跑停完成事件丢失",
			rules: Object.freeze([])
		}),
		Object.freeze({
			id: "character-turn-timeout",
			label: "转身完成事件丢失",
			rules: Object.freeze([])
		})
	]);
	let he = new pe(), H = e.reducedMotion ?? Ae(r), _e = 0, ve = 0, ye = 0, we = new Map(u.map((e) => [e.id, e])), Te = (e) => {
		let t = we.get(e);
		if (t) return t;
		let n = i.overpassCatalog.find((t) => t.id === e);
		return n && we.set(e, n), n;
	}, De = [], ke = 0, je = (e, t, n) => {
		D && (De.push(Object.freeze({
			sequence: ++ke,
			frame: ye,
			time: Number(_e.toFixed(3)),
			type: e,
			objectId: t,
			...n ? { detail: n } : {}
		})), De.length > Un && De.splice(0, De.length - Un));
	}, Ne = /* @__PURE__ */ new Map();
	u.forEach((e) => {
		let t = g(e.fromNodeId), n = g(e.toNodeId);
		if (!t || !n) throw Error(`Overpass "${e.id}" has a missing endpoint.`);
		Ne.set(e.id, {
			fromX: t.position.x,
			fromZ: t.position.z,
			toX: n.position.x,
			toZ: n.position.z,
			endInset: e.platformEdgeOffset + e.straightApproachLength
		});
	});
	let Ie = (e) => {
		let t = Ne.get(e);
		if (t) return t;
		let n = Te(e);
		if (!n) return;
		let r = g(n.fromNodeId), i = g(n.toNodeId);
		if (!r || !i) return;
		let a = {
			fromX: r.position.x,
			fromZ: r.position.z,
			toX: i.position.x,
			toZ: i.position.z,
			endInset: n.platformEdgeOffset + n.straightApproachLength
		};
		return Ne.set(e, a), a;
	}, Le = /* @__PURE__ */ new Map();
	l.forEach((e) => {
		Le.set(e.id, ne.get(e.id).length);
	});
	let U = o.map(() => []), Re = new Map(o.map((e) => [e.id, 0])), ze = new Map(o.map((e) => [e.id, 0]));
	s.forEach((e) => {
		let t = v(e.fromNodeId), n = v(e.toNodeId);
		if (t < 0 || n < 0) throw Error(`Edge "${e.id}" has a missing endpoint.`);
		U[t].push(n), U[n].push(t), ze.set(e.fromNodeId, (ze.get(e.fromNodeId) ?? 0) + 1), Re.set(e.toNodeId, (Re.get(e.toNodeId) ?? 0) + 1);
	}), U.forEach((e) => e.sort((e, t) => o[e].navigationOrder - o[t].navigationOrder));
	let Be = new x();
	Be.name = "learning-path-character-stage", Be.visible = !ae, Be.add(z.root), I.scene.add(R.root, Be), z.setPosition(w.position.x, w.position.z, w.surfaceY), z.setViewFacing(I.camera.position.x - w.position.x, I.camera.position.z - w.position.z, 1), z.setReducedMotion(H);
	let W = null, G = () => {}, Ve = !1, K = !1, He = () => z.isVisuallyIdle(), Ue = (e) => {
		let t = o[e];
		return !!(t && ie.isNodeUnlocked(t.id) && R.getNodePresenceState(t.id).interactive);
	}, q = (e) => {
		let t = o[e];
		return !!(t && R.getNodePresenceState(t.id).interactive);
	}, J = new Et({
		coordinator: ie,
		simulation: L,
		pathView: R,
		character: z,
		nodes: o,
		edges: d,
		initialNodeId: a,
		reducedMotion: H,
		onPhysicalArrival: ({ nodeId: t, finalStage: n, command: r, routeRevision: i }) => {
			if (je("xstate-physical-arrival", r.token, `${t}; final=${n}`), !n) {
				e.onNodeTraversed?.(Object.freeze({
					nodeId: t,
					routeRevision: i
				}));
				return;
			}
			let a = v(t), s = o[a];
			a < 0 || !s || (R.commitArrival(a), I.settleAt(s.position.z), W?.setKeyboardIndex(a));
		},
		onPresentationSettled: (e) => {
			e.objectKind === "platform" && T.setNodeVisible(e.objectId, e.terminal === "visible"), e.metadata.lane === "zone-reveal" && e.terminal === "visible" && I.expandPathFraming(H), queueMicrotask(() => {
				K || (e.metadata.lane === "zone-dismiss" && e.terminal === "hidden" && !ie.hasVisibleZoneSession() && J.isNavigationIdle() && I.setPathFramingExpanded(!1, H), G());
			});
		},
		onNavigationSettled: ({ nodeId: e }) => {
			let t = v(e), n = o[t];
			t < 0 || !n || (N = t, R.setTarget(null), W?.setKeyboardIndex(t), T.setArrived(n), G());
		},
		onNavigationRejected: ({ targetNodeId: t, detail: n }) => {
			let r = L.getSnapshot().currentNodeId, i = v(r), a = o[i];
			R.setTarget(null), i >= 0 && a && (N = i, W?.setKeyboardIndex(i), T.setArrived(a), I.settleAt(a.position.z)), console.warn(`[learning-path] Cannot route to ${t}: ${n}`), e.onMovementCancelled?.(Object.freeze({
				safeNodeId: r,
				reason: "navigation-rejected"
			})), G();
		},
		onTransition: ({ type: t, objectId: n, detail: r }) => {
			if (je(`xstate-${t}`, n, r), t === "presentation-failed" || t === "motion-failed" || t === "presentation-timeout" || t === "motion-timeout") {
				V("injected", {
					message: r ?? `故障步骤：${n}`,
					autoHideMs: 0
				}, 240);
				return;
			}
			if (t === "operation-retrying") {
				B = n;
				let e = r?.replace(/Presentation ACK timed out after ([\d.]+)s\./, "表现确认在 $1 秒内未返回");
				V("retrying", {
					message: e ?? "正在用新的尝试编号重试",
					autoHideMs: 0
				}, 240);
				return;
			}
			if (t === "recovery-started") {
				B = null, V("compensating", {
					message: "事务已停止，正在逆序撤销未完成的视觉与规则状态",
					progress: 0,
					autoHideMs: 0
				}, 360);
				return;
			}
			if (t === "recovery-step") {
				let e = r?.match(/(\d+)\/(\d+)/), t = e && Number(e[2]) > 0 ? Number(e[1]) / Number(e[2]) : null;
				V("compensating", {
					message: `正在补偿 ${n}`,
					progress: t,
					autoHideMs: 0
				});
				return;
			}
			if (t === "recovery-complete") {
				let t = J.getSnapshot().context.currentNodeId, n = v(t), i = o[n];
				n >= 0 && i && (N = n, R.commitArrival(n), R.setTarget(null), W?.setKeyboardIndex(n), T.setArrived(i), I.settleAt(i.position.z));
				let a = r?.match(/compensated=(\d+)/)?.[1] ?? "0", s = (() => {
					switch (void 0) {
						case "presentation-failure": return `两次表现尝试均失败；已逆序补偿 ${a} 项并回到安全节点`;
						case "motion-failure": return "移动过程失败；已中止路线并回到安全节点";
						case "partial-commit": return `部分提交已逆序补偿 ${a} 项；规则与画面重新一致`;
						default: return `已回到安全节点；逆序补偿 ${a} 项，状态一致性已恢复`;
					}
				})();
				V("recovered", { message: s }), e.onMovementCancelled?.(Object.freeze({
					safeNodeId: t,
					reason: "recovery-complete"
				})), G();
				return;
			}
			if (t === "recovery-failed") {
				B = null, k = "degraded", W?.setEnabled(!1), R.setTarget(null);
				let t = g(L.getSnapshot().currentNodeId), n = t ? `自动恢复失败，已停在「${t.label}」；请刷新后重试。` : "自动恢复失败；请刷新后重试。";
				T.setError(n), e.onRuntimeError?.(Object.freeze({
					error: r,
					message: n
				})), V("failed", { message: r ?? "恢复事务失败" }), e.onMovementCancelled?.(Object.freeze({
					safeNodeId: L.getSnapshot().currentNodeId,
					reason: "recovery-failed"
				})), G();
				return;
			}
			if (t === "character-watchdog-recovered") {
				oe.setPhase("recovered", { message: `动作完成事件缺失，已由帧驱动看门狗接管（${n}）` });
				return;
			}
			if (t === "presentation-settled" && B !== null && r?.startsWith(`${B}:attempt:`)) {
				B = null, V("recovered", { message: "重试成功；迟到或重复的确认信号将被忽略" });
				return;
			}
			t === "stale-event-ignored" && r === "presentation ACK" && V("recovered", { message: "已忽略迟到确认；当前尝试的画面与业务状态保持不变" }, 900);
		}
	}), Ke = (t, n = "direct") => {
		let r = o[t];
		if (!r || !P || !A || M || !J.isPathOrchestrationBound() || J.getDebugSnapshot().orchestration.health.status !== "live" || !Ue(t) || e.canNavigateToNode?.(r.id, n) === !1) return !1;
		N = t, W?.setKeyboardIndex(t), T.setActiveNode(r), G();
		let i = L.getSnapshot(), a = J.getSnapshot();
		if (!i.isRunning && J.isNavigationIdle() && a.context.characterVisualIdle && a.context.currentNodeId === r.id) return !0;
		R.setTarget(t), T.setTravelling(r), I.prepareTravel(r.position.z);
		let s = !J.isNavigationIdle() || !a.context.characterVisualIdle || a.context.zoneTransitionActive;
		return J.requestNavigation(r.id), je("xstate-navigation-requested", r.id, s ? "latest-intent-queued" : "accepted-or-planning"), G(), !0;
	}, qe = (t) => {
		let n = o[t];
		if (!n || !P || !A || M) return !1;
		N = t, W?.setKeyboardIndex(t), T.setActiveNode(n);
		let r = L.getSnapshot().currentNodeId;
		return G(), e.onNodeActivated?.(Object.freeze({
			nodeId: n.id,
			currentNodeId: r,
			isCurrent: r === n.id
		})), !0;
	}, Je = new Pe({
		nodes: o,
		resolveNodeIndex: v,
		resolveOptionElement: (e) => T.getNodeOptionElement(e),
		onInspectRequested: (e) => {
			qe(e);
		},
		announcements: { announceKeyboardSelection: (e) => T.announceKeyboardSelection(e) }
	});
	W = new Fe({
		canvas: t,
		camera: I.camera,
		pickTargets: R.pickTargets,
		nodes: o,
		authoredAdjacencyByIndex: U,
		entryNodeId: f.entryNodeId,
		goalNodeId: f.goalNodeId,
		initialNodeIndex: C,
		keyboardSurfaceY: Ge,
		resolveNodeIndex: (e) => R.resolveNodeIndex(e),
		isNodeInspectable: q,
		inspectNode: (e) => {
			qe(e);
		},
		onBackgroundActivated: () => e.onBackgroundActivated?.(),
		panByScreenPixels: (e, t) => I.panByScreenPixels(e, t),
		renderScene: () => I.render(),
		setHoveredNode: (e) => R.setHovered(e),
		setPressedNode: (e) => R.setPressed(e),
		onNodeHovered: (t) => e.onNodeHovered?.(Object.freeze({ nodeId: t })),
		onKeyboardSelection: (e, t) => {
			N = t, Je.announceKeyboardSelection(t), G();
		}
	});
	let Ye = () => {
		let e = L.getSnapshot(), t = J.isPathOrchestrationBound() ? J.getSnapshot().context : null;
		return Object.freeze({
			currentNodeId: e.currentNodeId,
			selectedNodeId: o[N]?.id ?? e.currentNodeId,
			targetNodeId: t?.navigationPlan?.targetNodeId ?? t?.queuedTargetNodeId ?? null,
			isRunning: e.isRunning,
			visuallyIdle: z.isVisuallyIdle(),
			modelLoaded: A,
			interactionEnabled: P,
			visibleNodeIds: Object.freeze(R.getNodePresenceStates().filter((e) => e.status === "visible").map((e) => e.id)),
			visibleEdgeIds: Object.freeze(R.getStraightEdgePresenceStates().filter((e) => e.status === "visible").map((e) => e.id).concat(R.getOverpassAnimationStates().filter((e) => e.edgeId !== null && e.status !== "hidden").map((e) => e.edgeId)))
		});
	}, Xe = () => {
		let e = L.getSnapshot(), t = J.isPathOrchestrationBound() ? J.getSnapshot().context : null;
		Je.publish({
			currentNodeId: e.currentNodeId,
			isRunning: e.isRunning,
			targetNodeId: t?.navigationPlan?.targetNodeId ?? null,
			queuedTargetNodeId: t?.queuedTargetNodeId ?? null,
			getNodeColor: (e) => R.getNodeColor(e)
		});
	};
	G = () => {
		Xe(), e.onStateChanged?.(Ye());
	};
	let Y = new Ee({
		initialNodeId: a,
		nodeExists: (e) => g(e) !== void 0,
		edges: d,
		pathView: R,
		characterStage: Be,
		setSemanticNodeVisible: (e, t) => T.setNodeVisible(e, t),
		publishState: G,
		presenceSpeedMultiplier: 100,
		characterDropDurationSeconds: .48 / 10
	}), Ze = (e) => e instanceof Error ? e.message : String(e), Qe = (e) => e instanceof DOMException && e.name === "AbortError", $e = async (e, t) => {
		let n = F.getSnapshot().presentationPhase;
		n !== "presenting" && n !== "ready" && F.record({ type: "PRESENTATION.STARTED" });
		try {
			await e(), t && F.record({ type: "PRESENTATION.READY" });
		} catch (e) {
			throw Qe(e) || F.record({
				type: "PRESENTATION.FAILED",
				error: Ze(e)
			}), e;
		}
	}, et = Object.freeze({
		revealNode: (e, t, n) => $e(() => Y.presentation.revealNode(e, t, n), !1),
		revealEdge: (e, t, n) => $e(() => Y.presentation.revealEdge(e, t, n), !1),
		revealCharacter: (e, t, n) => $e(() => Y.presentation.revealCharacter(e, t, n), !0)
	}), tt = (e, t) => {
		if (!e) return 0;
		let n = (1 - e.progress) * e.length;
		for (let e = 1; e < t.length; e += 1) {
			let r = t[e], i = Le.get(r);
			i === void 0 && (i = ne.get(r).length, Le.set(r, i)), n += i;
		}
		return n;
	}, nt = () => {
		let e = L.getSnapshot(), n = ie.getDebugSnapshot(), r = J.getDebugSnapshot(), a = J.getSnapshot().context, c = a.navigationPlan, u = t.getBoundingClientRect(), d = z.root.position.clone().project(I.camera), h = new Map(n.bridges.map((e) => [e.bridgeId, e])), g = [.../* @__PURE__ */ new Set([...h.keys(), ...R.getOverpassAnimationStates().flatMap((e) => e.edgeId === null ? [] : [e.edgeId])])].map((e) => R.getOverpassAnimationState(e)), b = new Map(g.flatMap((e) => e.edgeId ? [[e.edgeId, e]] : [])), x = new Set(e.remainingRouteEdgeIds), S = g.filter((e) => e.edgeId !== null && (e.desiredVisible || e.status !== "hidden" || h.has(e.edgeId))).map((e) => {
			let t = e.edgeId, n = h.get(t), r = n?.edge ?? Te(t), i = e.pieces.length === 0 ? +(e.status === "visible") : e.pieces.reduce((e, t) => e + t.progress, 0) / e.pieces.length;
			return {
				id: t,
				ownerSourceNodeId: n?.ownerSourceNodeId ?? null,
				fromNodeId: r?.fromNodeId ?? null,
				toNodeId: r?.toNodeId ?? null,
				kind: n?.role ?? null,
				zoneId: n?.zoneId ?? null,
				sessionId: n?.zoneSessionId ?? null,
				coordinatorActive: n?.active ?? !1,
				desiredVisible: e.desiredVisible,
				routePinned: x.has(t),
				phase: e.status,
				sequenceSideNodeId: e.characterSideNodeId,
				progress: Number(i.toFixed(4)),
				pieces: e.pieces
			};
		}), C = o.map((t, n) => {
			let r = R.getNodePresenceState(t.id), i = new y(t.position.x, t.surfaceY, t.position.z).project(I.camera), s = new y(t.position.x + .79, t.surfaceY, t.position.z).project(I.camera);
			return {
				id: t.id,
				index: n,
				color: R.getNodeColor(n),
				desiredVisible: r.desiredVisible,
				phase: r.status,
				progress: r.progress,
				interactive: ie.isNodeUnlocked(t.id) && r.interactive,
				neighborIds: U[n].map((e) => o[e].id),
				isCurrent: !e.isRunning && e.currentNodeId === t.id,
				isTarget: c?.targetNodeId === t.id || a.queuedTargetNodeId === t.id,
				isSelected: N === n,
				screenX: Number(((i.x + 1) * .5 * u.width).toFixed(2)),
				screenY: Number(((1 - i.y) * .5 * u.height).toFixed(2)),
				hitRadiusPx: Number(Math.max(Math.abs(s.x - i.x) * .5 * u.width, 22).toFixed(2))
			};
		}), w = C.filter((e) => e.phase !== "visible" && e.interactive).length, T = +(e.activeLeg?.pathKind === "overpass" && b.get(e.activeLeg.edgeId)?.status !== "visible"), E = c?.stages[a.navigationStageIndex] ?? null;
		return Object.freeze({
			currentNodeId: e.currentNodeId,
			targetNodeId: c?.targetNodeId ?? a.queuedTargetNodeId,
			selectedNodeId: o[N]?.id ?? e.currentNodeId,
			isRunning: e.isRunning,
			modelLoaded: A,
			readiness: k,
			fps: Number(he.fps.toFixed(1)),
			reducedMotion: H,
			contextLost: M,
			graph: {
				nodeCount: o.length,
				authoredStraightEdgeCount: s.length,
				runtimeStraightEdgeCount: l.length,
				bridgeCatalogCount: i.overpassCatalog.length,
				initialNodeId: f.initialNodeId,
				entryNodeId: f.entryNodeId,
				goalNodeId: f.goalNodeId,
				splitNodeIds: o.filter((e) => (ze.get(e.id) ?? 0) > 1).map((e) => e.id),
				mergeNodeIds: o.filter((e) => (Re.get(e.id) ?? 0) > 1).map((e) => e.id),
				authoredEdges: s.map((e) => ({
					id: e.id,
					fromNodeId: e.fromNodeId,
					toNodeId: e.toNodeId,
					unlocked: ie.isStraightEdgeUnlocked(e.id)
				}))
			},
			catalog: p,
			xstate: r,
			navigationDecision: c ? {
				requestId: c.id,
				sourceNodeId: c.sourceNodeId,
				targetNodeId: c.targetNodeId,
				baseHopCount: c.authoredHopCount,
				decisionKind: E?.decisionKind ?? null,
				stageIndex: a.navigationStageIndex,
				stagePhase: r.orchestration.navigation.phase,
				queuedTargetNodeId: a.queuedTargetNodeId,
				concurrentZoneDismissalPlanId: c.linkedZoneDismissalPlanId,
				concurrentZoneDismissalStarted: a.zoneDismissPlan !== null
			} : null,
			linkedZoneDeparture: c?.linkedZoneDismissalPlanId ? {
				navigationPlanId: c.id,
				dismissalPlanId: c.linkedZoneDismissalPlanId,
				targetNodeId: c.targetNodeId,
				navigationPhase: r.orchestration.navigation.phase,
				dismissalPhase: r.orchestration.zoneSession.phase,
				cleanupComplete: r.orchestration.navigation.linkedZoneCleanupComplete
			} : null,
			route: {
				revision: e.routeRevision,
				activeEdgeId: e.activeLeg?.edgeId ?? null,
				fromNodeId: e.activeLeg?.fromNodeId ?? null,
				toNodeId: e.activeLeg?.toNodeId ?? null,
				edgeProgress: Number((e.activeLeg?.progress ?? 0).toFixed(5)),
				activePathKind: e.pathKind,
				remainingNodeIds: e.remainingRouteNodeIds,
				remainingEdgeIds: e.remainingRouteEdgeIds,
				remainingDistance: Number(tt(e.activeLeg, e.remainingRouteEdgeIds).toFixed(4))
			},
			revealGroups: n.zones.map((e) => {
				let t = m.find((t) => t.id === e.id)?.revealSequence.map((t) => {
					if (t.kind === "node") {
						let e = R.getNodePresenceState(t.nodeId);
						return {
							kind: t.kind,
							id: t.nodeId,
							desiredVisible: e.desiredVisible,
							phase: e.status,
							progress: e.progress
						};
					}
					if (t.kind === "straight-edge") {
						let e = R.getStraightEdgePresenceState(t.edgeId);
						return {
							kind: t.kind,
							id: t.edgeId,
							desiredVisible: e.desiredVisible,
							phase: e.status,
							progress: e.progress
						};
					}
					let n = e.entryConnectorId;
					if (e.entryConnectorKind === "straight" && n) {
						let r = R.getStraightEdgePresenceState(n);
						return {
							kind: t.kind,
							connectorKind: e.entryConnectorKind,
							id: n,
							desiredVisible: r.desiredVisible,
							phase: r.status,
							progress: Number(r.progress.toFixed(4))
						};
					}
					let r = n ? b.get(n) : void 0, i = r && r.pieces.length > 0 ? r.pieces.reduce((e, t) => e + t.progress, 0) / r.pieces.length : +(r?.status === "visible");
					return {
						kind: t.kind,
						connectorKind: e.entryConnectorKind,
						id: n,
						desiredVisible: r?.desiredVisible ?? !1,
						phase: r?.status ?? "missing",
						progress: Number(i.toFixed(4))
					};
				}) ?? [];
				return {
					...e,
					activePlanId: a.zoneRevealPlan?.zoneId === e.id ? a.zoneRevealPlan.id : null,
					activePhase: r.orchestration.zoneSession.phase,
					activeStepIndex: a.zoneRevealPlan?.zoneId === e.id ? a.zoneRevealStepIndex : null,
					activeDismissPlanId: a.zoneDismissPlan?.zoneId === e.id ? a.zoneDismissPlan.id : null,
					activeDismissTrigger: a.zoneDismissPlan?.zoneId === e.id ? a.zoneDismissPlan.trigger : null,
					activeDismissStepIndex: a.zoneDismissPlan?.zoneId === e.id ? a.zoneDismissStepIndex : null,
					orderedItems: t
				};
			}),
			nodes: C,
			straightEdges: R.getStraightEdgePresenceStates().map((e) => ({
				...e,
				unlocked: ie.isStraightEdgeUnlocked(e.id)
			})),
			bridges: S,
			runner: {
				currentIndex: v(e.currentNodeId),
				targetIndex: c ? v(c.targetNodeId) : null,
				position: [e.position.x, e.position.z],
				facing: [e.facing.x, e.facing.z],
				surfaceY: Number(e.surfaceY.toFixed(5)),
				surfacePitchDegrees: Number(_.radToDeg(e.surfacePitchRadians).toFixed(3)),
				renderPosition: [
					z.root.position.x,
					z.root.position.y,
					z.root.position.z
				],
				renderScreen: [(d.x + 1) * .5 * u.width, (1 - d.y) * .5 * u.height]
			},
			animation: z.getDebugState(),
			currentIndicator: R.getCurrentIndicatorState(),
			invariants: {
				...n.invariants,
				hiddenInteractiveNodeCount: w,
				unsafeActiveBridgeCount: T,
				activeDeferredPresentationCount: r.deferredPresentations.length,
				passed: n.invariants.violations.length === 0 && w === 0 && T === 0
			},
			transitionEvents: Object.freeze([...De]),
			renderer: {
				width: u.width,
				height: u.height,
				pixelRatio: I.renderer.getPixelRatio(),
				fov: Number(I.camera.fov.toFixed(2)),
				calls: I.renderer.info.render.calls,
				triangles: I.renderer.info.render.triangles,
				viewportPan: I.getViewportPanSnapshot()
			}
		});
	}, rt = () => {
		D && Bn(J, () => {
			Xe(), O && (O.textContent = JSON.stringify(nt()));
		});
	};
	D && e.exposeGlobalDebug && (r.__LEARNING_PATH_DEBUG__ = Object.freeze({
		get currentNodeId() {
			return L.getSnapshot().currentNodeId;
		},
		get targetNodeId() {
			if (!J.isPathOrchestrationBound()) return null;
			let e = J.getSnapshot().context;
			return e.navigationPlan?.targetNodeId ?? e.queuedTargetNodeId;
		},
		get selectedNodeId() {
			return o[N]?.id ?? L.getSnapshot().currentNodeId;
		},
		get isRunning() {
			return L.getSnapshot().isRunning;
		},
		get modelLoaded() {
			return A;
		},
		get readiness() {
			return k;
		},
		get fps() {
			return Number(he.fps.toFixed(1));
		},
		getState: () => J.isPathOrchestrationBound() ? nt() : Object.freeze({
			phase: "binding-path-orchestration",
			currentNodeId: L.getSnapshot().currentNodeId,
			modelLoaded: A,
			readiness: k
		}),
		goToNode(e) {
			let t = v(e);
			return t >= 0 && Ke(t);
		}
	}));
	let it = async () => {
		me.get("scenario");
	}, at = L.getSnapshot(), ot = !1, st = !1, ct = new xe({
		scheduler: Se(I.renderer),
		clock: Ce(n),
		steps: {
			updateSimulation: (e) => {
				D && (ye = e.sequence), _e = e.elapsedSeconds, D && (ve += e.deltaSeconds), L.update(e.deltaSeconds), at = L.getSnapshot();
			},
			updateCamera: (e) => {
				I.updateCamera(e.deltaSeconds, H);
			},
			updateCharacter: (e) => {
				let t = at;
				z.setPosition(t.position.x, t.position.z, t.surfaceY);
				let n = t.activeLeg ? Ie(t.activeLeg.edgeId) : void 0, r = n !== void 0 && Math.hypot(t.position.x - n.fromX, t.position.z - n.fromZ) >= n.endInset - 1e-4 && Math.hypot(t.position.x - n.toX, t.position.z - n.toZ) >= n.endInset - 1e-4;
				z.setSurfacePitch(t.surfacePitchRadians, e.deltaSeconds, r ? Hn : Vn), z.setRunning(t.isRunning), z.setFacing(t.facing.x, t.facing.z, e.deltaSeconds), z.setViewFacing(I.camera.position.x - t.position.x, I.camera.position.z - t.position.z, e.deltaSeconds), z.update(e.deltaSeconds, e.elapsedSeconds);
			},
			publishVisualIdleEdge: () => {
				ot = He(), ot !== Ve && (Ve = ot, queueMicrotask(() => {
					K || G();
				}));
			},
			updatePathView: (e) => {
				let t = !at.isRunning && at.targetNodeId === null && at.activeLeg === null;
				R.update(e.deltaSeconds, H, t && ot);
			},
			updateRuntime: (e) => {
				P && J.frame(e.deltaSeconds);
			},
			updatePerformanceMeter: (e) => {
				D && he.update(e.rawDeltaSeconds);
			},
			renderScene: () => {
				I.render();
			},
			afterRender: () => {
				D && ve >= .1 && (ve = 0, rt());
			}
		}
	}), lt = new Me({
		browserWindow: r,
		document: n,
		canvas: t,
		viewport: e.viewport,
		frameLoop: {
			start: () => {
				st || ct.start();
			},
			stop: () => ct.stop()
		},
		callbacks: {
			onResize: (e, t) => {
				e === void 0 || t === void 0 ? I.resize() : I.resize(e, t), I.render();
			},
			onReducedMotionChanged: (e) => {
				H = e, z.setReducedMotion(H), J.setReducedMotion(H);
			},
			onContextLost: () => {
				M = !0, F.record({ type: "CONTEXT.LOST" }), k = "context-lost", W?.setEnabled(!1), T.setContextPaused();
			},
			onContextRestored: () => {
				M = !1, F.record({ type: "CONTEXT.RESTORED" }), k = j ? "degraded" : A ? "ready" : "loading-model";
				let e = L.getSnapshot(), t = g(e.currentNodeId), n = J.isPathOrchestrationBound() ? J.getSnapshot().context : null, r = n?.navigationPlan?.targetNodeId ?? n?.queuedTargetNodeId, i = r ? g(r) : null;
				j ? T.setError(j) : A && i ? T.setTravelling(i) : A && t ? T.setReady(t) : T.setLoading(null), W?.setEnabled(P && A && !j && (!J.isPathOrchestrationBound() || J.getDebugSnapshot().orchestration.health.status === "live")), I.resize();
			}
		}
	}), ut = () => {
		K || (K = !0, Y.dispose(), lt.dispose(), ee.dispose(), F.dispose(), re(), J.dispose(), e.exposeGlobalDebug && (delete r.__LEARNING_PATH_DEBUG__, delete r.__LEARNING_PATH_QA__), Je.dispose(), W?.dispose(), T.dispose(), fe(), oe.dispose(), z.dispose(), R.dispose(), ct.dispose(), I.dispose(), O?.remove(), O = null);
	};
	k = "loading-model", F.record({ type: "MODEL.LOAD_STARTED" }), ae || T.setLoading(null), lt.start(), (e.preparedCharacter?.ready ?? z.load(e.characterAssetUrls ?? Gn(), { onProgress: (e) => {
		!K && !ae && T.setLoading(e);
	} })).then((e) => {
		if (!K) {
			if (A = !0, j = null, F.record({ type: "MODEL.READY" }), Y.markCharacterReady(), k = M ? "context-lost" : "ready", !M) {
				let e = g(L.getSnapshot().currentNodeId);
				e && P && T.setReady(e), W?.setEnabled(P);
			}
			D && rt(), it(), console.info(`[learning-path] Loaded run=${e.runClipName} (${e.runClipDuration.toFixed(3)}s), stop=${e.runStopClipName ?? "fallback"} (${e.runStopClipDuration.toFixed(3)}s), idle=${e.idleClipName} (${e.idleClipDuration.toFixed(3)}s), turn=${e.turnClipName ?? "fallback"} (${e.turnClipDuration.toFixed(3)}s).`), e.warnings.forEach((e) => console.warn(`[learning-path] ${e}`));
		}
	}).catch((t) => {
		if (K || t instanceof DOMException && t.name === "AbortError") return;
		Y.markCharacterFailed(t), J.isPathOrchestrationBound() && J.reportCharacterFailure(t), k = "degraded";
		let n = t instanceof Error ? t.message : String(t);
		j = `刘看山模型加载失败。请刷新重试。${n ? `（${n}）` : ""}`, F.record({
			type: "MODEL.FAILED",
			error: j
		}), W?.setEnabled(!1), console.error("[learning-path] Character model failed to load:", t), T.setError(j), e.onRuntimeError?.(Object.freeze({
			error: t,
			message: j
		}));
	});
	let dt = () => {
		if (K) return;
		P = !0;
		let e = g(L.getSnapshot().currentNodeId);
		e && A && !M && !j && (T.setReady(e), W?.setEnabled(!0)), G();
	}, ft = {
		horizontalOffsetPixels: 0,
		verticalOffsetPixels: 0
	}, pt = Object.freeze({
		projectNodeAnchor(e, t) {
			return S.project(e, I.camera, t, (e) => g(e));
		},
		getOverlayComposition() {
			return ft.horizontalOffsetPixels = I.getHorizontalCompositionOffsetPixels(), ft.verticalOffsetPixels = I.getVerticalCompositionOffsetPixels(), ft;
		},
		setOverlayComposition(e, t = !1) {
			I.setOverlayFovBonusDegrees(e.fovBonusDegrees, t), I.setHorizontalCompositionOffsetPixels(e.horizontalOffsetPixels, t), I.setVerticalCompositionOffsetPixels(e.verticalOffsetPixels, t);
		}
	});
	return Object.freeze({
		overlay: pt,
		presentation: et,
		activate: dt,
		reconcileRestoredProgress(t) {
			if (K) return !1;
			let n = v(t), r = o[n];
			if (n < 0 || !r || !L.abortToNode(t)) return !1;
			let i = e.compiledPath.nodeById.get(t), a = J.reconcileRestoredRuleProjection(t, i?.ownerSubjectId), s = new Set(a.visibleNodeIds);
			return o.forEach((e) => {
				T.setNodeVisible(e.id, s.has(e.id));
			}), N = n, R.commitArrival(n), R.setTarget(null), W?.setKeyboardIndex(n), z.setPosition(r.position.x, r.position.z, r.surfaceY), z.setRunning(!1), z.setSurfacePitch(0, 1), z.setViewFacing(I.camera.position.x - r.position.x, I.camera.position.z - r.position.z, 1), T.setArrived(r), I.setPathFramingExpanded(a.restoredZoneId !== null, !0), I.settleAt(r.position.z), !0;
		},
		goToNode(e, t = "direct") {
			let n = v(e);
			return n >= 0 && Ke(n, t);
		},
		selectNode(e) {
			let t = v(e);
			if (t < 0) return !1;
			N = t, W?.setKeyboardIndex(t);
			let n = o[t];
			return n && T.setActiveNode(n), G(), !0;
		},
		replaceNodeLearningStates(e) {
			for (let t of e) R.setNodeLearningState(t.nodeId, t.learningState), T.setNodeLearningStatus(t.nodeId, t.learningState.status);
		},
		patchNodeLearningStates(e) {
			for (let t of e) R.setNodeLearningState(t.nodeId, t.learningState), T.setNodeLearningStatus(t.nodeId, t.learningState.status);
		},
		getNodeLearningBadgeDebugInfos: () => R.getNodeLearningBadgeDebugInfos(),
		bindSceneRuntimeGateway: (e, t) => J.bindSceneRuntimeGateway(e, t),
		getSceneRuntimePort: () => J.getSceneRuntimePort(),
		getSceneRuntimeGatewayScheduler: () => ee,
		getSceneSessionLifecycleSnapshot: () => F.getSnapshot(),
		subscribeSceneSessionLifecycle: (e) => F.subscribe(e),
		getPathOrchestrationBinding: () => J.getPathOrchestrationBinding(),
		getSnapshot: Ye,
		pause: () => {
			st = !0, ct.stop();
		},
		resume: () => {
			st = !1, !K && lt.visible && !lt.contextLost && ct.start();
		},
		dispose: ut
	});
}
//#endregion
export { Kn as createLearningPathSession };

//# sourceMappingURL=LearningPathSession-5pgNTVas.js.map
