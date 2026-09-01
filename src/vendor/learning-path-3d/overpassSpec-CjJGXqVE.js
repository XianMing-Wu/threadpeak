//#region node_modules/xstate/dist/xstate-dev.esm.js
function e() {
	if (typeof globalThis < "u") return globalThis;
	if (typeof self < "u") return self;
	if (typeof window < "u") return window;
	if (typeof global < "u") return global;
}
function t() {
	let t = e();
	if (t.__xstate__) return t.__xstate__;
}
var n = (e) => {
	if (typeof window > "u") return;
	let n = t();
	n && n.register(e);
}, r = class {
	constructor(e) {
		this._process = e, this._active = !1, this._current = null, this._last = null;
	}
	start() {
		this._active = !0, this.flush();
	}
	clear() {
		this._current && (this._current.next = null, this._last = this._current);
	}
	enqueue(e) {
		let t = {
			value: e,
			next: null
		};
		if (this._current) {
			this._last.next = t, this._last = t;
			return;
		}
		this._current = t, this._last = t, this._active && this.flush();
	}
	flush() {
		for (; this._current;) {
			let e = this._current;
			this._process(e.value), this._current = e.next;
		}
		this._last = null;
	}
}, i = "", a = "#", o = "*", s = "xstate.init", c = "xstate.stop";
function l(e, t) {
	return { type: `xstate.after.${e}.${t}` };
}
function u(e, t) {
	return {
		type: `xstate.done.state.${e}`,
		output: t
	};
}
function d(e, t) {
	return {
		type: `xstate.done.actor.${e}`,
		output: t,
		actorId: e
	};
}
function f(e, t) {
	return {
		type: `xstate.error.actor.${e}`,
		error: t,
		actorId: e
	};
}
function p(e) {
	return {
		type: s,
		input: e
	};
}
function m(e) {
	setTimeout(() => {
		throw e;
	});
}
var ee = typeof Symbol == "function" && Symbol.observable || "@@observable";
function te(e, t) {
	let n = g(e), r = g(t);
	return typeof r == "string" ? typeof n == "string" && r === n : typeof n == "string" ? n in r : Object.keys(n).every((e) => e in r && te(n[e], r[e]));
}
function h(e) {
	if (ae(e)) return e;
	let t = [], n = "";
	for (let r = 0; r < e.length; r++) {
		switch (e.charCodeAt(r)) {
			case 92:
				n += e[r + 1], r++;
				continue;
			case 46:
				t.push(n), n = "";
				continue;
		}
		n += e[r];
	}
	return t.push(n), t;
}
function g(e) {
	return yt(e) ? e.value : typeof e == "string" ? ne(h(e)) : e;
}
function ne(e) {
	if (e.length === 1) return e[0];
	let t = {}, n = t;
	for (let t = 0; t < e.length - 1; t++) if (t === e.length - 2) n[e[t]] = e[t + 1];
	else {
		let r = n;
		n = {}, r[e[t]] = n;
	}
	return t;
}
function _(e, t) {
	let n = {}, r = Object.keys(e);
	for (let i = 0; i < r.length; i++) {
		let a = r[i];
		n[a] = t(e[a], a, e, i);
	}
	return n;
}
function re(e) {
	return ae(e) ? e : [e];
}
function v(e) {
	return e === void 0 ? [] : re(e);
}
function ie(e, t, n, r) {
	return typeof e == "function" ? e({
		context: t,
		event: n,
		self: r
	}) : e;
}
function ae(e) {
	return Array.isArray(e);
}
function oe(e) {
	return e.type.startsWith("xstate.error.actor");
}
function y(e) {
	return re(e).map((e) => e === void 0 || typeof e == "string" ? { target: e } : e);
}
function se(e) {
	if (e !== void 0 && e !== i) return v(e);
}
function ce(e, t, n) {
	let r = typeof e == "object", i = r ? e : void 0;
	return {
		next: (r ? e.next : e)?.bind(i),
		error: (r ? e.error : t)?.bind(i),
		complete: (r ? e.complete : n)?.bind(i)
	};
}
function le(e, t) {
	return `${t}.${e}`;
}
function ue(e, t) {
	let n = t.match(/^xstate\.invoke\.(\d+)\.(.*)/);
	if (!n) return e.implementations.actors[t];
	let [, r, i] = n, a = e.getStateNodeById(i).config.invoke;
	return (Array.isArray(a) ? a[r] : a).src;
}
function de(e, t) {
	if (t === e || t === o) return !0;
	if (!t.endsWith(".*")) return !1;
	let n = t.split("."), r = e.split(".");
	for (let e = 0; e < n.length; e++) {
		let t = n[e], i = r[e];
		if (t === "*") return e === n.length - 1;
		if (t !== i) return !1;
	}
	return !0;
}
function fe(e, t) {
	return `${e.sessionId}.${t}`;
}
var pe = 0;
function me(e, t) {
	let n = /* @__PURE__ */ new Map(), r = /* @__PURE__ */ new Map(), i = /* @__PURE__ */ new WeakMap(), a = /* @__PURE__ */ new Set(), o = {}, { clock: s, logger: c } = t, l = {
		schedule: (e, t, n, r, i = Math.random().toString(36).slice(2)) => {
			let a = {
				source: e,
				target: t,
				event: n,
				delay: r,
				id: i,
				startedAt: Date.now()
			}, c = fe(e, i);
			u._snapshot._scheduledEvents[c] = a;
			let l = s.setTimeout(() => {
				delete o[c], delete u._snapshot._scheduledEvents[c], u._relay(e, t, n);
			}, r);
			o[c] = l;
		},
		cancel: (e, t) => {
			let n = fe(e, t), r = o[n];
			delete o[n], delete u._snapshot._scheduledEvents[n], r !== void 0 && s.clearTimeout(r);
		},
		cancelAll: (e) => {
			for (let t in u._snapshot._scheduledEvents) {
				let n = u._snapshot._scheduledEvents[t];
				n.source === e && l.cancel(e, n.id);
			}
		}
	}, u = {
		_snapshot: { _scheduledEvents: (t?.snapshot && t.snapshot.scheduler) ?? {} },
		_bookId: () => `x:${pe++}`,
		_register: (e, t) => (n.set(e, t), e),
		_unregister: (e) => {
			n.delete(e.sessionId);
			let t = i.get(e);
			t !== void 0 && (r.delete(t), i.delete(e));
		},
		get: (e) => r.get(e),
		getAll: () => Object.fromEntries(r.entries()),
		_set: (e, t) => {
			let n = r.get(e);
			if (n && n !== t) throw Error(`Actor with system ID '${e}' already exists.`);
			r.set(e, t), i.set(t, e);
		},
		inspect: (e) => {
			let t = ce(e);
			return a.add(t), { unsubscribe() {
				a.delete(t);
			} };
		},
		_sendInspectionEvent: (t) => {
			if (!a.size) return;
			let n = {
				...t,
				rootId: e.sessionId
			};
			a.forEach((e) => e.next?.(n));
		},
		_relay: (e, t, n) => {
			u._sendInspectionEvent({
				type: "@xstate.event",
				sourceRef: e,
				actorRef: t,
				event: n
			}), t._send(n);
		},
		scheduler: l,
		getSnapshot: () => ({ _scheduledEvents: { ...u._snapshot._scheduledEvents } }),
		start: () => {
			let e = u._snapshot._scheduledEvents;
			u._snapshot._scheduledEvents = {};
			for (let t in e) {
				let { source: n, target: r, event: i, delay: a, id: o } = e[t];
				l.schedule(n, r, i, a, o);
			}
		},
		_clock: s,
		_logger: c
	};
	return u;
}
var he = !1, b = /*#__PURE__*/ function(e) {
	return e[e.NotStarted = 0] = "NotStarted", e[e.Running = 1] = "Running", e[e.Stopped = 2] = "Stopped", e;
}({}), ge = {
	clock: {
		setTimeout: (e, t) => setTimeout(e, t),
		clearTimeout: (e) => clearTimeout(e)
	},
	logger: console.log.bind(console),
	devTools: !1
}, _e = class {
	constructor(e, t) {
		this.logic = e, this._snapshot = void 0, this.clock = void 0, this.options = void 0, this.id = void 0, this.mailbox = new r(this._process.bind(this)), this.observers = /* @__PURE__ */ new Set(), this.eventListeners = /* @__PURE__ */ new Map(), this.logger = void 0, this._processingStatus = b.NotStarted, this._parent = void 0, this._syncSnapshot = void 0, this.ref = void 0, this._actorScope = void 0, this.systemId = void 0, this.sessionId = void 0, this.system = void 0, this._doneEvent = void 0, this.src = void 0, this._deferred = [];
		let n = {
			...ge,
			...t
		}, { clock: i, logger: a, parent: o, syncSnapshot: s, id: c, systemId: l, inspect: u } = n;
		this.system = o ? o.system : me(this, {
			clock: i,
			logger: a
		}), u && !o && this.system.inspect(ce(u)), this.sessionId = this.system._bookId(), this.id = c ?? this.sessionId, this.logger = t?.logger ?? this.system._logger, this.clock = t?.clock ?? this.system._clock, this._parent = o, this._syncSnapshot = s, this.options = n, this.src = n.src ?? e, this.ref = this, this._actorScope = {
			self: this,
			id: this.id,
			sessionId: this.sessionId,
			logger: this.logger,
			defer: (e) => {
				this._deferred.push(e);
			},
			system: this.system,
			stopChild: (e) => {
				if (e._parent !== this) throw Error(`Cannot stop child actor ${e.id} of ${this.id} because it is not a child`);
				e._stop();
			},
			emit: (e) => {
				let t = this.eventListeners.get(e.type), n = this.eventListeners.get("*");
				if (!t && !n) return;
				let r = [...t ? t.values() : [], ...n ? n.values() : []];
				for (let t of r) try {
					t(e);
				} catch (e) {
					m(e);
				}
			},
			actionExecutor: (e) => {
				let t = () => {
					if (this._actorScope.system._sendInspectionEvent({
						type: "@xstate.action",
						actorRef: this,
						action: {
							type: e.type,
							params: e.params
						}
					}), !e.exec) return;
					let t = he;
					try {
						he = !0, e.exec(e.info, e.params);
					} finally {
						he = t;
					}
				};
				this._processingStatus === b.Running ? t() : this._deferred.push(t);
			}
		}, this.send = this.send.bind(this), this.system._sendInspectionEvent({
			type: "@xstate.actor",
			actorRef: this
		}), l && (this.systemId = l, this.system._set(l, this)), this._initState(t?.snapshot ?? t?.state), l && this._snapshot.status !== "active" && this.system._unregister(this);
	}
	_initState(e) {
		try {
			this._snapshot = e ? this.logic.restoreSnapshot ? this.logic.restoreSnapshot(e, this._actorScope) : e : this.logic.getInitialSnapshot(this._actorScope, this.options?.input);
		} catch (e) {
			this._snapshot = {
				status: "error",
				output: void 0,
				error: e
			};
		}
	}
	update(e, t) {
		this._snapshot = e;
		let n;
		for (; n = this._deferred.shift();) try {
			n();
		} catch (t) {
			this._deferred.length = 0, this._snapshot = {
				...e,
				status: "error",
				error: t
			};
		}
		switch (this._snapshot.status) {
			case "active":
				for (let t of this.observers) try {
					t.next?.(e);
				} catch (e) {
					m(e);
				}
				break;
			case "done":
				for (let t of this.observers) try {
					t.next?.(e);
				} catch (e) {
					m(e);
				}
				this._stopProcedure(), this._complete(), this._doneEvent = d(this.id, this._snapshot.output), this._parent && this.system._relay(this, this._parent, this._doneEvent);
				break;
			case "error": this._error(this._snapshot.error);
		}
		this.system._sendInspectionEvent({
			type: "@xstate.snapshot",
			actorRef: this,
			event: t,
			snapshot: e
		});
	}
	subscribe(e, t, n) {
		let r = ce(e, t, n);
		if (this._processingStatus !== b.Stopped) this.observers.add(r);
		else switch (this._snapshot.status) {
			case "done":
				try {
					r.complete?.();
				} catch (e) {
					m(e);
				}
				break;
			case "error": {
				let e = this._snapshot.error;
				if (!r.error) m(e);
				else try {
					r.error(e);
				} catch (e) {
					m(e);
				}
				break;
			}
		}
		return { unsubscribe: () => {
			this.observers.delete(r);
		} };
	}
	on(e, t) {
		let n = this.eventListeners.get(e);
		n || (n = /* @__PURE__ */ new Set(), this.eventListeners.set(e, n));
		let r = t.bind(void 0);
		return n.add(r), { unsubscribe: () => {
			n.delete(r);
		} };
	}
	select(e, t = Object.is) {
		return {
			subscribe: (n) => {
				let r = ce(n), i = e(this.getSnapshot());
				return this.subscribe((n) => {
					let a = e(n);
					t(i, a) || (i = a, r.next?.(a));
				});
			},
			get: () => e(this.getSnapshot())
		};
	}
	start() {
		if (this._processingStatus === b.Running) return this;
		this._syncSnapshot && this.subscribe({
			next: (e) => {
				e.status === "active" && this.system._relay(this, this._parent, {
					type: `xstate.snapshot.${this.id}`,
					snapshot: e
				});
			},
			error: () => {}
		}), this.system._register(this.sessionId, this), this.systemId && this.system._set(this.systemId, this), this._processingStatus = b.Running;
		let e = p(this.options.input);
		switch (this.system._sendInspectionEvent({
			type: "@xstate.event",
			sourceRef: this._parent,
			actorRef: this,
			event: e
		}), this._snapshot.status) {
			case "done": return this.update(this._snapshot, e), this;
			case "error": return this._error(this._snapshot.error), this;
		}
		if (this._parent || this.system.start(), this.logic.start) try {
			this.logic.start(this._snapshot, this._actorScope);
		} catch (e) {
			return this._snapshot = {
				...this._snapshot,
				status: "error",
				error: e
			}, this._error(e), this;
		}
		return this.update(this._snapshot, e), this.options.devTools && this.attachDevTools(), this.mailbox.start(), this;
	}
	_process(e) {
		let t, n;
		try {
			t = this.logic.transition(this._snapshot, e, this._actorScope);
		} catch (e) {
			n = { err: e };
		}
		if (n) {
			let { err: e } = n;
			this._snapshot = {
				...this._snapshot,
				status: "error",
				error: e
			}, this._error(e);
			return;
		}
		this.update(t, e), e.type === "xstate.stop" && (this._stopProcedure(), this._complete());
	}
	_stop() {
		return this._processingStatus === b.Stopped ? this : (this.mailbox.clear(), this._processingStatus === b.NotStarted ? (this._processingStatus = b.Stopped, this) : (this.mailbox.enqueue({ type: c }), this));
	}
	stop() {
		if (this._parent) throw Error("A non-root actor cannot be stopped directly.");
		return this._stop();
	}
	_complete() {
		for (let e of this.observers) try {
			e.complete?.();
		} catch (e) {
			m(e);
		}
		this.observers.clear(), this.eventListeners.clear();
	}
	_reportError(e) {
		if (!this.observers.size) {
			this._parent || m(e), this.eventListeners.clear();
			return;
		}
		let t = !1;
		for (let n of this.observers) {
			let r = n.error;
			t ||= !r;
			try {
				r?.(e);
			} catch (e) {
				m(e);
			}
		}
		this.observers.clear(), this.eventListeners.clear(), t && m(e);
	}
	_error(e) {
		this._stopProcedure(), this._reportError(e), this._parent && this.system._relay(this, this._parent, f(this.id, e));
	}
	_stopProcedure() {
		return this._processingStatus === b.Running ? (this.system.scheduler.cancelAll(this), this.mailbox.clear(), this.mailbox = new r(this._process.bind(this)), this._processingStatus = b.Stopped, this.system._unregister(this), this) : this;
	}
	_send(e) {
		this._processingStatus !== b.Stopped && this.mailbox.enqueue(e);
	}
	send(e) {
		this.system._relay(void 0, this, e);
	}
	attachDevTools() {
		let { devTools: e } = this.options;
		e && (typeof e == "function" ? e : n)(this);
	}
	toJSON() {
		return {
			xstate$$type: 1,
			id: this.id
		};
	}
	getPersistedSnapshot(e) {
		return this.logic.getPersistedSnapshot(this._snapshot, e);
	}
	[ee]() {
		return this;
	}
	getSnapshot() {
		return this._snapshot;
	}
};
function x(e, ...[t]) {
	return new _e(e, t);
}
function ve(e, t, n, r, { sendId: i }) {
	return [
		t,
		{ sendId: typeof i == "function" ? i(n, r) : i },
		void 0
	];
}
function ye(e, t) {
	e.defer(() => {
		e.system.scheduler.cancel(e.self, t.sendId);
	});
}
function be(e) {
	function t(e, t) {}
	return t.type = "xstate.cancel", t.sendId = e, t.resolve = ve, t.execute = ye, t;
}
function xe(e, t, n, r, { id: i, systemId: a, src: o, input: s, syncSnapshot: c }) {
	let l = typeof o == "string" ? ue(t.machine, o) : o, u = typeof i == "function" ? i(n) : i, d, f;
	return l && (f = typeof s == "function" ? s({
		context: t.context,
		event: n.event,
		self: e.self
	}) : s, d = x(l, {
		id: u,
		src: o,
		parent: e.self,
		syncSnapshot: c,
		systemId: a,
		input: f
	})), [
		P(t, { children: {
			...t.children,
			[u]: d
		} }),
		{
			id: i,
			systemId: a,
			actorRef: d,
			src: o,
			input: f
		},
		void 0
	];
}
function Se(e, { actorRef: t }) {
	t && e.defer(() => {
		t._processingStatus !== b.Stopped && t.start();
	});
}
function Ce(...[e, { id: t, systemId: n, input: r, syncSnapshot: i = !1 } = {}]) {
	function a(e, t) {}
	return a.type = "xstate.spawnChild", a.id = t, a.systemId = n, a.src = e, a.input = r, a.syncSnapshot = i, a.resolve = xe, a.execute = Se, a;
}
function we(e, t, n, r, { actorRef: i }) {
	let a = typeof i == "function" ? i(n, r) : i, o = typeof a == "string" ? t.children[a] : a, s = t.children;
	return o && (s = { ...s }, delete s[o.id]), [
		P(t, { children: s }),
		o,
		void 0
	];
}
function Te(e, t) {
	let n = t.getSnapshot();
	if (n && "children" in n) for (let t of Object.values(n.children)) Te(e, t);
	e.system._unregister(t);
}
function Ee(e, t) {
	if (t) {
		if (Te(e, t), t._processingStatus !== b.Running) {
			e.stopChild(t);
			return;
		}
		e.defer(() => {
			e.stopChild(t);
		});
	}
}
function S(e) {
	function t(e, t) {}
	return t.type = "xstate.stopChild", t.actorRef = e, t.resolve = we, t.execute = Ee, t;
}
function De(e, { context: t, event: n }, { guards: r }) {
	return r.every((r) => C(r, t, n, e));
}
function Oe(e) {
	function t(e, t) {
		return !1;
	}
	return t.check = De, t.guards = e, t;
}
function C(e, t, n, r) {
	let { machine: i } = r, a = typeof e == "function", o = a ? e : i.implementations.guards[typeof e == "string" ? e : e.type];
	if (!a && !o) throw Error(`Guard '${typeof e == "string" ? e : e.type}' is not implemented.'.`);
	if (typeof o != "function") return C(o, t, n, r);
	let s = {
		context: t,
		event: n
	}, c = a || typeof e == "string" ? void 0 : "params" in e ? typeof e.params == "function" ? e.params({
		context: t,
		event: n
	}) : e.params : void 0;
	return "check" in o ? o.check(r, s, o) : o(s, c);
}
function ke(e) {
	return e.type === "atomic" || e.type === "final";
}
function w(e) {
	return Object.values(e.states).filter((e) => e.type !== "history");
}
function T(e, t) {
	let n = [];
	if (t === e) return n;
	let r = e.parent;
	for (; r && r !== t;) n.push(r), r = r.parent;
	return n;
}
function Ae(e) {
	let t = new Set(e), n = Me(t);
	for (let e of t) if (e.type === "compound" && (!n.get(e) || !n.get(e).length)) He(e).forEach((e) => t.add(e));
	else if (e.type === "parallel") {
		for (let n of w(e)) if (n.type !== "history" && !t.has(n)) {
			let e = He(n);
			for (let n of e) t.add(n);
		}
	}
	for (let e of t) {
		let n = e.parent;
		for (; n;) t.add(n), n = n.parent;
	}
	return t;
}
function je(e, t) {
	let n = t.get(e);
	if (!n) return {};
	if (e.type === "compound") {
		let e = n[0];
		if (e) {
			if (ke(e)) return e.key;
		} else return {};
	}
	let r = {};
	for (let e of n) r[e.key] = je(e, t);
	return r;
}
function Me(e) {
	let t = /* @__PURE__ */ new Map();
	for (let n of e) t.has(n) || t.set(n, []), n.parent && (t.has(n.parent) || t.set(n.parent, []), t.get(n.parent).push(n));
	return t;
}
function Ne(e, t) {
	return je(e, Me(Ae(t)));
}
function Pe(e, t) {
	return t.type === "compound" ? w(t).some((t) => t.type === "final" && e.has(t)) : t.type === "parallel" ? w(t).every((t) => Pe(e, t)) : t.type === "final";
}
var E = (e) => e[0] === a;
function Fe(e, t) {
	let n = e.transitions.get(t), r = [...e.transitions.keys()].filter((e) => e !== t && de(t, e)).sort((e, t) => t.length - e.length).flatMap((t) => e.transitions.get(t));
	return n ? [...n, ...r] : r;
}
function Ie(e) {
	let t = e.config.after;
	if (!t) return [];
	let n = (t) => {
		let n = l(t, e.id), r = n.type;
		return e.entry.push(At(n, {
			id: r,
			delay: t
		})), e.exit.push(be(r)), r;
	};
	return Object.keys(t).flatMap((e) => {
		let r = t[e], i = typeof r == "string" ? { target: r } : r, a = Number.isNaN(+e) ? e : +e, o = n(a);
		return v(i).map((e) => ({
			...e,
			event: o,
			delay: a
		}));
	}).map((t) => {
		let { delay: n } = t;
		return {
			...D(e, t.event, t),
			delay: n
		};
	});
}
function D(e, t, n) {
	let r = se(n.target), i = n.reenter ?? !1, a = Be(e, r), o = {
		...n,
		actions: v(n.actions),
		guard: n.guard,
		target: a,
		source: e,
		reenter: i,
		eventType: t,
		toJSON: () => ({
			...o,
			source: `#${e.id}`,
			target: a ? a.map((e) => `#${e.id}`) : void 0
		})
	};
	return o;
}
function Le(e) {
	let t = /* @__PURE__ */ new Map();
	if (e.config.on) for (let n of Object.keys(e.config.on)) {
		if (n === "") throw Error("Null events (\"\") cannot be specified as a transition key. Use `always: { ... }` instead.");
		let r = e.config.on[n];
		t.set(n, y(r).map((t) => D(e, n, t)));
	}
	if (e.config.onDone) {
		let n = `xstate.done.state.${e.id}`;
		t.set(n, y(e.config.onDone).map((t) => D(e, n, t)));
	}
	for (let n of e.invoke) {
		if (n.onDone) {
			let r = `xstate.done.actor.${n.id}`;
			t.set(r, y(n.onDone).map((t) => D(e, r, t)));
		}
		if (n.onError) {
			let r = `xstate.error.actor.${n.id}`;
			t.set(r, y(n.onError).map((t) => D(e, r, t)));
		}
		if (n.onSnapshot) {
			let r = `xstate.snapshot.${n.id}`;
			t.set(r, y(n.onSnapshot).map((t) => D(e, r, t)));
		}
	}
	for (let n of e.after) {
		let e = t.get(n.eventType);
		e || (e = [], t.set(n.eventType, e)), e.push(n);
	}
	return t;
}
function Re(e) {
	let t = [], n = (r) => {
		Object.values(r).forEach((r) => {
			if (r.config.route && r.config.id) {
				let n = r.config.id, i = r.config.route.guard, a = ({ event: e }) => e.to === `#${n}`, o = {
					...r.config.route,
					guard: i ? Oe([a, i]) : a,
					target: `#${n}`
				};
				t.push(D(e, "xstate.route", o));
			}
			r.states && n(r.states);
		});
	};
	n(e.states), t.length > 0 && e.transitions.set("xstate.route", t);
}
function ze(e, t) {
	let n = typeof t == "string" ? e.states[t] : t ? e.states[t.target] : void 0;
	if (!n && t) throw Error(`Initial state node "${t}" not found on parent state node #${e.id}`);
	let r = {
		source: e,
		actions: !t || typeof t == "string" ? [] : v(t.actions),
		eventType: null,
		reenter: !1,
		target: n ? [n] : [],
		toJSON: () => ({
			...r,
			source: `#${e.id}`,
			target: n ? [`#${n.id}`] : []
		})
	};
	return r;
}
function Be(e, t) {
	if (t !== void 0) return t.map((t) => {
		if (typeof t != "string") return t;
		if (E(t)) return e.machine.getStateNodeById(t);
		let n = t[0] === ".";
		if (n && !e.parent) return We(e, t.slice(1));
		let r = n ? e.key + t : t;
		if (e.parent) try {
			return We(e.parent, r);
		} catch (t) {
			throw Error(`Invalid transition definition for state node '${e.id}':\n${t.message}`);
		}
		throw Error(`Invalid target: "${t}" is not a valid target from the root node. Did you mean ".${t}"?`);
	});
}
function Ve(e) {
	let t = se(e.config.target);
	return t ? { target: t.map((t) => typeof t == "string" ? We(e.parent, t) : t) } : e.parent.type === "parallel" ? { target: [e.parent] } : e.parent.initial;
}
function O(e) {
	return e.type === "history";
}
function He(e) {
	let t = Ue(e);
	for (let n of t) for (let r of T(n, e)) t.add(r);
	return t;
}
function Ue(e) {
	let t = /* @__PURE__ */ new Set();
	function n(e) {
		if (!t.has(e)) {
			if (t.add(e), e.type === "compound") n(e.initial.target[0]);
			else if (e.type === "parallel") for (let t of w(e)) n(t);
		}
	}
	return n(e), t;
}
function k(e, t) {
	if (E(t)) return e.machine.getStateNodeById(t);
	if (!e.states) throw Error(`Unable to retrieve child state '${t}' from '${e.id}'; no child states exist.`);
	let n = e.states[t];
	if (!n) throw Error(`Child state '${t}' does not exist on '${e.id}'`);
	return n;
}
function We(e, t) {
	if (typeof t == "string" && E(t)) try {
		return e.machine.getStateNodeById(t);
	} catch {}
	let n = h(t).slice(), r = e;
	for (; n.length;) {
		let e = n.shift();
		if (!e.length) break;
		r = k(r, e);
	}
	return r;
}
function Ge(e, t) {
	if (typeof t == "string") {
		let n = e.states[t];
		if (!n) throw Error(`State '${t}' does not exist on '${e.id}'`);
		return [e, n];
	}
	let n = Object.keys(t), r = n.map((t) => k(e, t)).filter(Boolean);
	return [e.machine.root, e].concat(r, n.reduce((n, r) => {
		let i = k(e, r);
		if (!i) return n;
		let a = Ge(i, t[r]);
		return n.concat(a);
	}, []));
}
function Ke(e, t, n, r) {
	let i = k(e, t).next(n, r);
	return !i || !i.length ? e.next(n, r) : i;
}
function qe(e, t, n, r) {
	let i = Object.keys(t), a = Ye(k(e, i[0]), t[i[0]], n, r);
	return !a || !a.length ? e.next(n, r) : a;
}
function Je(e, t, n, r) {
	let i = [];
	for (let a of Object.keys(t)) {
		let o = t[a];
		if (!o) continue;
		let s = Ye(k(e, a), o, n, r);
		s && i.push(...s);
	}
	return i.length ? i : e.next(n, r);
}
function Ye(e, t, n, r) {
	return typeof t == "string" ? Ke(e, t, n, r) : Object.keys(t).length === 1 ? qe(e, t, n, r) : Je(e, t, n, r);
}
function Xe(e) {
	return Object.keys(e.states).map((t) => e.states[t]).filter((e) => e.type === "history");
}
function A(e, t) {
	let n = e;
	for (; n.parent && n.parent !== t;) n = n.parent;
	return n.parent === t;
}
function Ze(e, t) {
	let n = new Set(e), r = new Set(t);
	for (let e of n) if (r.has(e)) return !0;
	for (let e of r) if (n.has(e)) return !0;
	return !1;
}
function Qe(e, t, n) {
	let r = /* @__PURE__ */ new Set();
	for (let i of e) {
		let e = !1, a = /* @__PURE__ */ new Set();
		for (let o of r) if (Ze(nt([i], t, n), nt([o], t, n))) {
			if (A(i.source, o.source)) a.add(o);
			else {
				e = !0;
				break;
			}
		}
		if (!e) {
			for (let e of a) r.delete(e);
			r.add(i);
		}
	}
	return Array.from(r);
}
function $e(e) {
	let [t, ...n] = e;
	for (let e of T(t, void 0)) if (n.every((t) => A(t, e))) return e;
}
function et(e, t) {
	if (!e.target) return [];
	let n = /* @__PURE__ */ new Set();
	for (let r of e.target) if (O(r)) {
		if (t[r.id]) for (let e of t[r.id]) n.add(e);
		else for (let e of et(Ve(r), t)) n.add(e);
	} else n.add(r);
	return [...n];
}
function tt(e, t) {
	let n = et(e, t);
	if (!n) return;
	if (!e.reenter && n.every((t) => t === e.source || A(t, e.source))) return e.source;
	let r = $e(n.concat(e.source));
	if (r) return r;
	if (!e.reenter) return e.source.machine.root;
}
function nt(e, t, n) {
	let r = /* @__PURE__ */ new Set();
	for (let i of e) if (i.target?.length) {
		let e = tt(i, n);
		i.reenter && i.source === e && r.add(e);
		for (let n of t) A(n, e) && r.add(n);
	}
	return [...r];
}
function rt(e, t) {
	if (e.length !== t.size) return !1;
	for (let n of e) if (!t.has(n)) return !1;
	return !0;
}
function it(e, t, n, r, i) {
	return at([{
		target: [...Ue(e)],
		source: e,
		reenter: !0,
		actions: [],
		eventType: null,
		toJSON: null
	}], t, n, r, !0, i);
}
function at(e, t, n, r, i, a) {
	let o = [];
	if (!e.length) return [t, o];
	let s = n.actionExecutor;
	n.actionExecutor = (e) => {
		o.push(e), s(e);
	};
	try {
		let s = new Set(t._nodes), c = t.historyValue, l = Qe(e, s, c), u = t;
		i || ([u, c] = dt(u, r, n, l, s, c, a, n.actionExecutor)), u = M(u, r, n, l.flatMap((e) => e.actions), a, void 0), u = st(u, r, n, l, s, a, c, i);
		let d = [...s];
		u.status === "done" && (u = M(u, r, n, d.sort((e, t) => t.order - e.order).flatMap((e) => e.exit), a, void 0));
		try {
			return c === t.historyValue && rt(t._nodes, s) ? [u, o] : [P(u, {
				_nodes: d,
				historyValue: c
			}), o];
		} catch (e) {
			throw e;
		}
	} finally {
		n.actionExecutor = s;
	}
}
function ot(e, t, n, r, i) {
	if (r.output === void 0) return;
	let a = u(i.id, i.output !== void 0 && i.parent ? ie(i.output, e.context, t, n.self) : void 0);
	return ie(r.output, e.context, a, n.self);
}
function st(e, t, n, r, i, a, o, s) {
	let c = e, l = /* @__PURE__ */ new Set(), d = /* @__PURE__ */ new Set();
	ct(r, o, d, l), s && d.add(e.machine.root);
	let f = /* @__PURE__ */ new Set();
	for (let e of [...l].sort((e, t) => e.order - t.order)) {
		i.add(e);
		let r = [];
		r.push(...e.entry);
		for (let t of e.invoke) r.push(Ce(t.src, {
			...t,
			syncSnapshot: !!t.onSnapshot
		}));
		if (d.has(e)) {
			let t = e.initial.actions;
			r.push(...t);
		}
		if (c = M(c, t, n, r, a, e.invoke.map((e) => e.id)), e.type === "final") {
			let r = e.parent, o = r?.type === "parallel" ? r : r?.parent, s = o || e;
			for (r?.type === "compound" && a.push(u(r.id, e.output === void 0 ? void 0 : ie(e.output, c.context, t, n.self))); o?.type === "parallel" && !f.has(o) && Pe(i, o);) f.add(o), a.push(u(o.id)), s = o, o = o.parent;
			if (o) continue;
			c = P(c, {
				status: "done",
				output: ot(c, t, n, c.machine.root, s)
			});
		}
	}
	return c;
}
function ct(e, t, n, r) {
	for (let i of e) {
		let e = tt(i, t);
		for (let a of i.target || []) !O(a) && (i.source !== a || i.source !== e || i.reenter) && (r.add(a), n.add(a)), j(a, t, n, r);
		let a = et(i, t);
		for (let o of a) {
			let a = T(o, e);
			e?.type === "parallel" && a.push(e), lt(r, t, n, a, !i.source.parent && i.reenter ? void 0 : e);
		}
	}
}
function j(e, t, n, r) {
	if (O(e)) {
		if (t[e.id]) {
			let i = t[e.id];
			for (let e of i) r.add(e), j(e, t, n, r);
			for (let a of i) ut(a, e.parent, r, t, n);
		} else {
			let i = Ve(e);
			for (let a of i.target) r.add(a), i === e.parent?.initial && n.add(e.parent), j(a, t, n, r);
			for (let a of i.target) ut(a, e.parent, r, t, n);
		}
	} else if (e.type === "compound") {
		let [i] = e.initial.target;
		O(i) || (r.add(i), n.add(i)), j(i, t, n, r), ut(i, e, r, t, n);
	} else if (e.type === "parallel") for (let i of w(e).filter((e) => !O(e))) [...r].some((e) => A(e, i)) || (O(i) || (r.add(i), n.add(i)), j(i, t, n, r));
}
function lt(e, t, n, r, i) {
	for (let a of r) if ((!i || A(a, i)) && e.add(a), a.type === "parallel") for (let r of w(a).filter((e) => !O(e))) [...e].some((e) => A(e, r)) || (e.add(r), j(r, t, n, e));
}
function ut(e, t, n, r, i) {
	lt(n, r, i, T(e, t));
}
function dt(e, t, n, r, i, a, o, s) {
	let c = e, l = nt(r, i, a);
	l.sort((e, t) => t.order - e.order);
	let u;
	for (let e of l) for (let t of Xe(e)) {
		let n;
		n = t.history === "deep" ? (t) => ke(t) && A(t, e) : (t) => t.parent === e, u ??= { ...a }, u[t.id] = Array.from(i).filter(n);
	}
	for (let e of l) c = M(c, t, n, [...e.exit, ...e.invoke.map((e) => S(e.id))], o, void 0), i.delete(e);
	return [c, u || a];
}
function ft(e, t) {
	return e.implementations.actions[t];
}
function pt(e, t, n, r, i, a) {
	let { machine: o } = e, s = e;
	for (let e of r) {
		let r = typeof e == "function", c = r ? e : ft(o, typeof e == "string" ? e : e.type), l = {
			context: s.context,
			event: t,
			self: n.self,
			system: n.system
		}, u = r || typeof e == "string" ? void 0 : "params" in e ? typeof e.params == "function" ? e.params({
			context: s.context,
			event: t
		}) : e.params : void 0;
		if (!c || !("resolve" in c)) {
			n.actionExecutor({
				type: typeof e == "string" ? e : typeof e == "object" ? e.type : e.name || "(anonymous)",
				info: l,
				params: u,
				exec: c
			});
			continue;
		}
		let d = c, [f, p, m] = d.resolve(n, s, l, u, c, i);
		s = f, "retryResolve" in d && a?.push([d, p]), "execute" in d && n.actionExecutor({
			type: d.type,
			info: l,
			params: p,
			exec: d.execute.bind(null, n, p)
		}), m && (s = pt(s, t, n, m, i, a));
	}
	return s;
}
function M(e, t, n, r, i, a) {
	let o = a ? [] : void 0, s = pt(e, t, n, r, {
		internalQueue: i,
		deferredActorIds: a
	}, o);
	return o?.forEach(([e, t]) => {
		e.retryResolve(n, s, t);
	}), s;
}
function mt(e, t, n, r) {
	let i = e, a = [];
	function o(e, t, r) {
		n.system._sendInspectionEvent({
			type: "@xstate.microstep",
			actorRef: n.self,
			event: t,
			snapshot: e[0],
			_transitions: r
		}), a.push(e);
	}
	if (t.type === "xstate.stop") return i = P(ht(i, t, n), { status: "stopped" }), o([i, []], t, []), {
		snapshot: i,
		microsteps: a
	};
	let c = t;
	if (c.type !== s) {
		let t = c, s = oe(t), l = gt(t, i);
		if (s && !l.length) return i = P(e, {
			status: "error",
			error: t.error
		}), o([i, []], t, []), {
			snapshot: i,
			microsteps: a
		};
		let u = at(l, e, n, c, !1, r);
		i = u[0], o(u, t, l);
	}
	let l = !0, u = e.machine.options?.maxIterations ?? Infinity, d = 0;
	for (; i.status === "active";) {
		if (d++, d > u) throw Error(`Infinite loop detected: the machine has processed more than ${u} microsteps without reaching a stable state. This usually happens when there's a cycle of transitions (e.g., eventless transitions or raised events causing state A -> B -> C -> A).`);
		let e = l ? _t(i, c) : [], t = e.length ? i : void 0;
		if (!e.length) {
			if (!r.length) break;
			c = r.shift(), e = gt(c, i);
		}
		let a = at(e, i, n, c, !1, r);
		i = a[0], l = i !== t, o(a, c, e);
	}
	return i.status !== "active" && ht(i, c, n), {
		snapshot: i,
		microsteps: a
	};
}
function ht(e, t, n) {
	return M(e, t, n, Object.values(e.children).map((e) => S(e)), [], void 0);
}
function gt(e, t) {
	return t.machine.getTransitionData(t, e);
}
function _t(e, t) {
	let n = /* @__PURE__ */ new Set(), r = e._nodes.filter(ke);
	for (let i of r) loop: for (let r of [i].concat(T(i, void 0))) if (r.always) {
		for (let i of r.always) if (i.guard === void 0 || C(i.guard, e.context, t, e)) {
			n.add(i);
			break loop;
		}
	}
	return Qe(Array.from(n), new Set(e._nodes), e.historyValue);
}
function vt(e, t) {
	return Ne(e, [...Ae(Ge(e, t))]);
}
function yt(e) {
	return !!e && typeof e == "object" && "machine" in e && "value" in e;
}
var bt = function(e) {
	return te(e, this.value);
}, xt = function(e) {
	return this.tags.has(e);
}, St = function(e) {
	let t = this.machine.getTransitionData(this, e);
	return !!t?.length && t.some((e) => e.target !== void 0 || e.actions.length);
}, Ct = function() {
	let { _nodes: e, tags: t, machine: n, getMeta: r, toJSON: i, can: a, hasTag: o, matches: s, ...c } = this;
	return {
		...c,
		tags: Array.from(t)
	};
}, wt = function() {
	return this._nodes.reduce((e, t) => (t.meta !== void 0 && (e[t.id] = t.meta), e), {});
};
function N(e, t) {
	return {
		status: e.status,
		output: e.output,
		error: e.error,
		machine: t,
		context: e.context,
		_nodes: e._nodes,
		value: Ne(t.root, e._nodes),
		tags: new Set(e._nodes.flatMap((e) => e.tags)),
		children: e.children,
		historyValue: e.historyValue || {},
		matches: bt,
		hasTag: xt,
		can: St,
		getMeta: wt,
		toJSON: Ct
	};
}
function P(e, t = {}) {
	return N({
		...e,
		...t
	}, e.machine);
}
function Tt(e) {
	if (typeof e != "object" || !e) return {};
	let t = {};
	for (let n in e) {
		let r = e[n];
		Array.isArray(r) && (t[n] = r.map((e) => ({ id: e.id })));
	}
	return t;
}
function Et(e, t) {
	let { _nodes: n, tags: r, machine: i, children: a, context: o, can: s, hasTag: c, matches: l, getMeta: u, toJSON: d, ...f } = e, p = {};
	for (let e in a) {
		let n = a[e];
		p[e] = {
			snapshot: n.getPersistedSnapshot(t),
			src: n.src,
			systemId: n.systemId,
			syncSnapshot: n._syncSnapshot
		};
	}
	return {
		...f,
		context: Dt(o),
		children: p,
		historyValue: Tt(f.historyValue)
	};
}
function Dt(e) {
	let t;
	for (let n in e) {
		let r = e[n];
		if (r && typeof r == "object") {
			if ("sessionId" in r && "send" in r && "ref" in r) t ??= Array.isArray(e) ? e.slice() : { ...e }, t[n] = {
				xstate$$type: 1,
				id: r.id
			};
			else {
				let i = Dt(r);
				i !== r && (t ??= Array.isArray(e) ? e.slice() : { ...e }, t[n] = i);
			}
		}
	}
	return t ?? e;
}
function Ot(e, t, n, r, { event: i, id: a, delay: o }, { internalQueue: s }) {
	let c = t.machine.implementations.delays;
	if (typeof i == "string") throw Error(`Only event objects may be used with raise; use raise({ type: "${i}" }) instead`);
	let l = typeof i == "function" ? i(n, r) : i, u;
	if (typeof o == "string") {
		let e = c && c[o];
		u = typeof e == "function" ? e(n, r) : e;
	} else u = typeof o == "function" ? o(n, r) : o;
	return typeof u != "number" && s.push(l), [
		t,
		{
			event: l,
			id: a,
			delay: u
		},
		void 0
	];
}
function kt(e, t) {
	let { event: n, delay: r, id: i } = t;
	if (typeof r == "number") {
		e.defer(() => {
			let t = e.self;
			e.system.scheduler.schedule(t, t, n, r, i);
		});
		return;
	}
}
function At(e, t) {
	function n(e, t) {}
	return n.type = "xstate.raise", n.event = e, n.id = t?.id, n.delay = t?.delay, n.resolve = Ot, n.execute = kt, n;
}
//#endregion
//#region node_modules/xstate/dist/xstate-actors.esm.js
function jt(e, t) {
	return {
		config: e,
		transition: (t, n, r) => ({
			...t,
			context: e(t.context, n, r)
		}),
		getInitialSnapshot: (e, n) => ({
			status: "active",
			output: void 0,
			error: void 0,
			context: typeof t == "function" ? t({ input: n }) : t
		}),
		getPersistedSnapshot: (e) => e,
		restoreSnapshot: (e) => e
	};
}
var Mt = /* #__PURE__ */ new WeakMap();
function Nt(e) {
	return {
		config: e,
		start: (t, n) => {
			let { self: r, system: i, emit: a } = n, o = {
				receivers: void 0,
				dispose: void 0
			};
			Mt.set(r, o), o.dispose = e({
				input: t.input,
				system: i,
				self: r,
				sendBack: (e) => {
					r.getSnapshot().status !== "stopped" && r._parent && i._relay(r, r._parent, e);
				},
				receive: (e) => {
					o.receivers ??= /* @__PURE__ */ new Set(), o.receivers.add(e);
				},
				emit: a
			});
		},
		transition: (e, t, n) => {
			let r = Mt.get(n.self);
			return t.type === "xstate.stop" ? (e = {
				...e,
				status: "stopped",
				error: void 0
			}, Mt.delete(n.self), r.receivers?.clear(), r.dispose?.(), e) : (r.receivers?.forEach((e) => e(t)), e);
		},
		getInitialSnapshot: (e, t) => ({
			status: "active",
			output: void 0,
			error: void 0,
			input: t
		}),
		getPersistedSnapshot: (e) => e,
		restoreSnapshot: (e) => e
	};
}
var Pt = "xstate.promise.resolve", Ft = "xstate.promise.reject", F = /* @__PURE__ */ new WeakMap();
function It(e) {
	return {
		config: e,
		transition: (e, t, n) => {
			if (e.status !== "active") return e;
			switch (t.type) {
				case Pt: {
					let n = t.data;
					return {
						...e,
						status: "done",
						output: n,
						input: void 0
					};
				}
				case Ft: return {
					...e,
					status: "error",
					error: t.data,
					input: void 0
				};
				case c: return F.get(n.self)?.abort(), F.delete(n.self), {
					...e,
					status: "stopped",
					input: void 0
				};
				default: return e;
			}
		},
		start: (t, { self: n, system: r, emit: i }) => {
			if (t.status !== "active") return;
			let a = new AbortController();
			F.set(n, a), Promise.resolve(e({
				input: t.input,
				system: r,
				self: n,
				signal: a.signal,
				emit: i
			})).then((e) => {
				n.getSnapshot().status === "active" && (F.delete(n), r._relay(n, n, {
					type: Pt,
					data: e
				}));
			}, (e) => {
				n.getSnapshot().status === "active" && (F.delete(n), r._relay(n, n, {
					type: Ft,
					data: e
				}));
			});
		},
		getInitialSnapshot: (e, t) => ({
			status: "active",
			output: void 0,
			error: void 0,
			input: t
		}),
		getPersistedSnapshot: (e) => e,
		restoreSnapshot: (e) => e
	};
}
//#endregion
//#region node_modules/xstate/dist/assign-29f23f4d.esm.js
function Lt(e, { machine: t, context: n }, r, i) {
	let a = (a, o) => {
		if (typeof a == "string") {
			let s = ue(t, a);
			if (!s) throw Error(`Actor logic '${a}' not implemented in machine '${t.id}'`);
			let c = x(s, {
				id: o?.id,
				parent: e.self,
				syncSnapshot: o?.syncSnapshot,
				input: typeof o?.input == "function" ? o.input({
					context: n,
					event: r,
					self: e.self
				}) : o?.input,
				src: a,
				systemId: o?.systemId
			});
			return i[c.id] = c, c;
		}
		return x(a, {
			id: o?.id,
			parent: e.self,
			syncSnapshot: o?.syncSnapshot,
			input: o?.input,
			src: a,
			systemId: o?.systemId
		});
	};
	return (t, n) => {
		let r = a(t, n);
		return i[r.id] = r, e.defer(() => {
			r._processingStatus !== b.Stopped && r.start();
		}), r;
	};
}
function Rt(e, t, n, r, { assignment: i }) {
	if (!t.context) throw Error("Cannot assign to undefined `context`. Ensure that `context` is defined in the machine config.");
	let a = {}, o = {
		context: t.context,
		event: n.event,
		spawn: Lt(e, t, n.event, a),
		self: e.self,
		system: e.system
	}, s = {};
	if (typeof i == "function") s = i(o, r);
	else for (let e of Object.keys(i)) {
		let t = i[e];
		s[e] = typeof t == "function" ? t(o, r) : t;
	}
	return [
		P(t, {
			context: Object.assign({}, t.context, s),
			children: Object.keys(a).length ? {
				...t.children,
				...a
			} : t.children
		}),
		void 0,
		void 0
	];
}
function I(e) {
	function t(e, t) {}
	return t.type = "xstate.assign", t.assignment = e, t.resolve = Rt, t;
}
//#endregion
//#region node_modules/xstate/dist/StateMachine-5f345bba.esm.js
var zt = /* @__PURE__ */ new WeakMap();
function L(e, t, n) {
	let r = zt.get(e);
	return r ? t in r || (r[t] = n()) : (r = { [t]: n() }, zt.set(e, r)), r[t];
}
var Bt = {}, R = (e) => typeof e == "string" ? { type: e } : typeof e == "function" ? "resolve" in e ? { type: e.type } : { type: e.name } : e, Vt = class e {
	constructor(t, n) {
		if (this.config = t, this.key = void 0, this.id = void 0, this.type = void 0, this.path = void 0, this.states = void 0, this.history = void 0, this.entry = void 0, this.exit = void 0, this.parent = void 0, this.machine = void 0, this.meta = void 0, this.output = void 0, this.order = -1, this.description = void 0, this.tags = [], this.transitions = void 0, this.always = void 0, this.parent = n._parent, this.key = n._key, this.machine = n._machine, this.path = this.parent ? this.parent.path.concat(this.key) : [], this.id = this.config.id || [this.machine.id, ...this.path].join("."), this.type = this.config.type || (this.config.states && Object.keys(this.config.states).length ? "compound" : this.config.history ? "history" : "atomic"), this.description = this.config.description, this.order = this.machine.idMap.size, this.machine.idMap.set(this.id, this), this.states = this.config.states ? _(this.config.states, (t, n) => new e(t, {
			_parent: this,
			_key: n,
			_machine: this.machine
		})) : Bt, this.type === "compound" && !this.config.initial) throw Error(`No initial state specified for compound state node "#${this.id}". Try adding { initial: "${Object.keys(this.states)[0]}" } to the state config.`);
		this.history = this.config.history === !0 ? "shallow" : this.config.history || !1, this.entry = v(this.config.entry).slice(), this.exit = v(this.config.exit).slice(), this.meta = this.config.meta, this.output = this.type === "final" || !this.parent ? this.config.output : void 0, this.tags = v(t.tags).slice();
	}
	_initialize() {
		this.transitions = Le(this), this.config.always && (this.always = y(this.config.always).map((e) => D(this, "", e))), Object.keys(this.states).forEach((e) => {
			this.states[e]._initialize();
		});
	}
	get definition() {
		return {
			id: this.id,
			key: this.key,
			version: this.machine.version,
			type: this.type,
			initial: this.initial ? {
				target: this.initial.target,
				source: this,
				actions: this.initial.actions.map(R),
				eventType: null,
				reenter: !1,
				toJSON: () => ({
					target: this.initial.target.map((e) => `#${e.id}`),
					source: `#${this.id}`,
					actions: this.initial.actions.map(R),
					eventType: null
				})
			} : void 0,
			history: this.history,
			states: _(this.states, (e) => e.definition),
			on: this.on,
			transitions: [...this.transitions.values()].flat().map((e) => ({
				...e,
				actions: e.actions.map(R)
			})),
			entry: this.entry.map(R),
			exit: this.exit.map(R),
			meta: this.meta,
			order: this.order || -1,
			output: this.output,
			invoke: this.invoke,
			description: this.description,
			tags: this.tags
		};
	}
	toJSON() {
		return this.definition;
	}
	get invoke() {
		return L(this, "invoke", () => v(this.config.invoke).map((e, t) => {
			let { src: n, systemId: r } = e, i = e.id ?? le(this.id, t), a = typeof n == "string" ? n : `xstate.invoke.${le(this.id, t)}`;
			return {
				...e,
				src: a,
				id: i,
				systemId: r,
				toJSON() {
					let { onDone: t, onError: n, ...r } = e;
					return {
						...r,
						type: "xstate.invoke",
						src: a,
						id: i
					};
				}
			};
		}));
	}
	get on() {
		return L(this, "on", () => [...this.transitions].flatMap(([e, t]) => t.map((t) => [e, t])).reduce((e, [t, n]) => (e[t] = e[t] || [], e[t].push(n), e), {}));
	}
	get after() {
		return L(this, "delayedTransitions", () => Ie(this));
	}
	get initial() {
		return L(this, "initial", () => ze(this, this.config.initial));
	}
	next(e, t) {
		let n = t.type, r = [], i, a = L(this, `candidates-${n}`, () => Fe(this, n));
		for (let o of a) {
			let { guard: a } = o, s = e.context, c = !1;
			try {
				c = !a || C(a, s, t, e);
			} catch (e) {
				let t = typeof a == "string" ? a : typeof a == "object" ? a.type : void 0;
				throw Error(`Unable to evaluate guard ${t ? `'${t}' ` : ""}in transition for event '${n}' in state node '${this.id}':\n${e.message}`);
			}
			if (c) {
				r.push(...o.actions), i = o;
				break;
			}
		}
		return i ? [i] : void 0;
	}
	get events() {
		return L(this, "events", () => {
			let { states: e } = this, t = new Set(this.ownEvents);
			if (e) for (let n of Object.keys(e)) {
				let r = e[n];
				if (r.states) for (let e of r.events) t.add(`${e}`);
			}
			return Array.from(t);
		});
	}
	get ownEvents() {
		let e = Object.keys(Object.fromEntries(this.transitions)), t = new Set(e.filter((e) => this.transitions.get(e).some((e) => !(!e.target && !e.actions.length && !e.reenter))));
		return Array.from(t);
	}
}, Ht = class e {
	constructor(e, t) {
		this.config = e, this.version = void 0, this.schemas = void 0, this.implementations = void 0, this.options = void 0, this.__xstatenode = !0, this.idMap = /* @__PURE__ */ new Map(), this.root = void 0, this.id = void 0, this.states = void 0, this.events = void 0, this.id = e.id || "(machine)", this.implementations = {
			actors: t?.actors ?? {},
			actions: t?.actions ?? {},
			delays: t?.delays ?? {},
			guards: t?.guards ?? {}
		}, this.version = this.config.version, this.schemas = this.config.schemas, this.options = {
			maxIterations: Infinity,
			...this.config.options
		}, this.transition = this.transition.bind(this), this.getInitialSnapshot = this.getInitialSnapshot.bind(this), this.getPersistedSnapshot = this.getPersistedSnapshot.bind(this), this.restoreSnapshot = this.restoreSnapshot.bind(this), this.start = this.start.bind(this), this.root = new Vt(e, {
			_key: this.id,
			_machine: this
		}), this.root._initialize(), Re(this.root), this.states = this.root.states, this.events = this.root.events;
	}
	provide(t) {
		let { actions: n, guards: r, actors: i, delays: a } = this.implementations;
		return new e(this.config, {
			actions: {
				...n,
				...t.actions
			},
			guards: {
				...r,
				...t.guards
			},
			actors: {
				...i,
				...t.actors
			},
			delays: {
				...a,
				...t.delays
			}
		});
	}
	resolveState(e) {
		let t = vt(this.root, e.value), n = Ae(Ge(this.root, t));
		return N({
			_nodes: [...n],
			context: e.context || {},
			children: {},
			status: Pe(n, this.root) ? "done" : e.status || "active",
			output: e.output,
			error: e.error,
			historyValue: e.historyValue
		}, this);
	}
	transition(e, t, n) {
		return mt(e, t, n, []).snapshot;
	}
	microstep(e, t, n) {
		return mt(e, t, n, []).microsteps.map(([e]) => e);
	}
	getTransitionData(e, t) {
		return Ye(this.root, e.value, e, t) || [];
	}
	_getPreInitialState(e, t, n) {
		let { context: r } = this.config, i = N({
			context: typeof r != "function" && r ? r : {},
			_nodes: [this.root],
			children: {},
			status: "active"
		}, this);
		return typeof r == "function" ? M(i, t, e, [I(({ spawn: e, event: t, self: n }) => r({
			spawn: e,
			input: t.input,
			self: n
		}))], n, void 0) : i;
	}
	getInitialSnapshot(e, t) {
		let n = p(t), r = [], i = this._getPreInitialState(e, n, r), [a] = it(this.root, i, e, n, r), { snapshot: o } = mt(a, n, e, r);
		return o;
	}
	start(e) {
		Object.values(e.children).forEach((e) => {
			e.getSnapshot().status === "active" && e.start();
		});
	}
	getStateNodeById(e) {
		let t = h(e), n = t.slice(1), r = E(t[0]) ? t[0].slice(1) : t[0], i = this.idMap.get(r);
		if (!i) throw Error(`Child state node '#${r}' does not exist on machine '${this.id}'`);
		return We(i, n);
	}
	get definition() {
		return this.root.definition;
	}
	toJSON() {
		return this.definition;
	}
	getPersistedSnapshot(e, t) {
		return Et(e, t);
	}
	restoreSnapshot(e, t) {
		let n = {}, r = e.children;
		Object.keys(r).forEach((e) => {
			let i = r[e], a = i.snapshot, o = i.src, s = typeof o == "string" ? ue(this, o) : o;
			if (!s) return;
			let c = x(s, {
				id: e,
				parent: t.self,
				syncSnapshot: i.syncSnapshot,
				snapshot: a,
				src: o,
				systemId: i.systemId
			});
			n[e] = c;
		});
		function i(e, t) {
			if (t instanceof Vt) return t;
			try {
				return e.machine.getStateNodeById(t.id);
			} catch {}
		}
		function a(e, t) {
			if (!t || typeof t != "object") return {};
			let n = {};
			for (let r in t) {
				let a = t[r];
				for (let t of a) {
					let a = i(e, t);
					a && (n[r] ??= [], n[r].push(a));
				}
			}
			return n;
		}
		let o = a(this.root, e.historyValue), s = N({
			...e,
			children: n,
			_nodes: Array.from(Ae(Ge(this.root, e.value))),
			historyValue: o
		}, this), c = /* @__PURE__ */ new Set();
		function l(e, t) {
			if (!c.has(e)) {
				c.add(e);
				for (let n in e) {
					let r = e[n];
					if (r && typeof r == "object") {
						if ("xstate$$type" in r && r.xstate$$type === 1) {
							e[n] = t[r.id];
							continue;
						}
						l(r, t);
					}
				}
			}
		}
		return l(s.context, n), s;
	}
};
//#endregion
//#region node_modules/xstate/dist/log-79409d72.esm.js
function Ut(e, t, n, r, { event: i }) {
	return [
		t,
		{ event: typeof i == "function" ? i(n, r) : i },
		void 0
	];
}
function Wt(e, { event: t }) {
	e.defer(() => e.emit(t));
}
function Gt(e) {
	function t(e, t) {}
	return t.type = "xstate.emit", t.event = e, t.resolve = Ut, t.execute = Wt, t;
}
var Kt = /*#__PURE__*/ function(e) {
	return e.Parent = "#_parent", e.Internal = "#_internal", e;
}({});
function qt(e, t, n, r, { to: i, event: a, id: o, delay: s }, c) {
	let l = t.machine.implementations.delays;
	if (typeof a == "string") throw Error(`Only event objects may be used with sendTo; use sendTo({ type: "${a}" }) instead`);
	let u = typeof a == "function" ? a(n, r) : a, d;
	if (typeof s == "string") {
		let e = l && l[s];
		d = typeof e == "function" ? e(n, r) : e;
	} else d = typeof s == "function" ? s(n, r) : s;
	let f = typeof i == "function" ? i(n, r) : i, p;
	if (typeof f == "string") {
		if (p = f === Kt.Parent ? e.self._parent : f === Kt.Internal ? e.self : f.startsWith("#_") ? t.children[f.slice(2)] : c.deferredActorIds?.includes(f) ? f : t.children[f], !p) throw Error(`Unable to send event to actor '${f}' from machine '${t.machine.id}'.`);
	} else p = f || e.self;
	return [
		t,
		{
			to: p,
			targetId: typeof f == "string" ? f : void 0,
			event: u,
			id: o,
			delay: d
		},
		void 0
	];
}
function Jt(e, t, n) {
	typeof n.to == "string" && (n.to = t.children[n.to]);
}
function Yt(e, t) {
	e.defer(() => {
		let { to: n, event: r, delay: i, id: a } = t;
		if (typeof i == "number") {
			e.system.scheduler.schedule(e.self, n, r, i, a);
			return;
		}
		e.system._relay(e.self, n, r.type === "xstate.error" ? f(e.self.id, r.data) : r);
	});
}
function z(e, t, n) {
	function r(e, t) {}
	return r.type = "xstate.sendTo", r.to = e, r.event = t, r.id = n?.id, r.delay = n?.delay, r.resolve = qt, r.retryResolve = Jt, r.execute = Yt, r;
}
function B(e, t) {
	return z(Kt.Parent, e, t);
}
function Xt(e, t, n, r, { collect: i }) {
	let a = [], o = function(e) {
		a.push(e);
	};
	return o.assign = (...e) => {
		a.push(I(...e));
	}, o.cancel = (...e) => {
		a.push(be(...e));
	}, o.raise = (...e) => {
		a.push(At(...e));
	}, o.sendTo = (...e) => {
		a.push(z(...e));
	}, o.sendParent = (...e) => {
		a.push(B(...e));
	}, o.spawnChild = (...e) => {
		a.push(Ce(...e));
	}, o.stopChild = (...e) => {
		a.push(S(...e));
	}, o.emit = (...e) => {
		a.push(Gt(...e));
	}, i({
		context: n.context,
		event: n.event,
		enqueue: o,
		check: (e) => C(e, t.context, n.event, t),
		self: e.self,
		system: e.system
	}, r), [
		t,
		void 0,
		a
	];
}
function V(e) {
	function t(e, t) {}
	return t.type = "xstate.enqueueActions", t.collect = e, t.resolve = Xt, t;
}
function Zt(e, t, n, r, { value: i, label: a }) {
	return [
		t,
		{
			value: typeof i == "function" ? i(n, r) : i,
			label: a
		},
		void 0
	];
}
function Qt({ logger: e }, { value: t, label: n }) {
	n ? e(n, t) : e(t);
}
function $t(e = ({ context: e, event: t }) => ({
	context: e,
	event: t
}), t) {
	function n(e, t) {}
	return n.type = "xstate.log", n.value = e, n.label = t, n.resolve = Zt, n.execute = Qt, n;
}
//#endregion
//#region node_modules/xstate/dist/xstate.esm.js
function en(e, t) {
	return new Ht(e, t);
}
function H({ schemas: e, actors: t, actions: n, guards: r, delays: i }) {
	return {
		assign: I,
		sendTo: z,
		raise: At,
		log: $t,
		cancel: be,
		stopChild: S,
		enqueueActions: V,
		emit: Gt,
		spawnChild: Ce,
		createStateConfig: (e) => e,
		createAction: (e) => e,
		createMachine: (a) => en({
			...a,
			schemas: e
		}, {
			actors: t,
			actions: n,
			guards: r,
			delays: i
		}),
		extend: (a) => H({
			schemas: e,
			actors: t,
			actions: {
				...n,
				...a.actions
			},
			guards: {
				...r,
				...a.guards
			},
			delays: {
				...i,
				...a.delays
			}
		})
	};
}
//#endregion
//#region src/runtime/gateway/sceneRuntimeGateway.ts
var tn = 15e3, nn = 512;
function rn(e) {
	return Object.freeze({
		sessionRevision: e.sessionRevision,
		transactionId: e.transactionId,
		operationId: e.operationId,
		attemptId: e.attemptId,
		attempt: e.attempt
	});
}
function an(e) {
	return `${e.transactionId}\u0000${e.operationId}`;
}
function on(e) {
	return `${e.type}\u0000${an(e)}`;
}
function sn(e, t) {
	return `${e}\u0000${an(t)}`;
}
function cn(e, t) {
	return e.sessionRevision === t.sessionRevision && e.transactionId === t.transactionId && e.operationId === t.operationId && e.attemptId === t.attemptId && e.attempt === t.attempt;
}
function ln(e) {
	return e.type === "PRESENTATION.EXECUTE" ? "presentation" : e.type === "MOTION.EXECUTE" ? "motion" : e.type === "CHARACTER.FORCE_SETTLE" ? "character" : null;
}
function un(e) {
	return e.type.startsWith("PRESENTATION.") ? "presentation" : e.type.startsWith("MOTION.") ? "motion" : "character";
}
function dn(e) {
	return e.type === "PRESENTATION.SETTLED" || e.type === "PRESENTATION.FAILED" || e.type === "MOTION.VISUAL_IDLE" || e.type === "MOTION.FAILED" || e.type === "CHARACTER.SETTLED" || e.type === "CHARACTER.FAILED";
}
function fn(e, t) {
	return {
		type: e === "presentation" ? "PRESENTATION.ACCEPTED" : e === "motion" ? "MOTION.ACCEPTED" : "CHARACTER.ACCEPTED",
		...t
	};
}
function pn(e) {
	let t = {
		...e.correlation,
		error: `${e.kind} attempt timed out.`,
		timedOut: !0
	};
	return e.kind === "presentation" ? {
		type: "PRESENTATION.FAILED",
		...t
	} : e.kind === "motion" ? {
		type: "MOTION.FAILED",
		...t
	} : {
		type: "CHARACTER.FAILED",
		...t
	};
}
function mn(e, t, n) {
	let r = {
		...t,
		error: n instanceof Error ? n.message : String(n)
	};
	return e === "presentation" ? {
		type: "PRESENTATION.FAILED",
		...r
	} : e === "motion" ? {
		type: "MOTION.FAILED",
		...r
	} : {
		type: "CHARACTER.FAILED",
		...r
	};
}
function hn(e) {
	return typeof e == "function" ? e : () => e.unsubscribe();
}
function gn() {
	return Nt(({ input: e, receive: t, sendBack: n }) => {
		let r = e.scheduler ?? {
			setTimeout: (e, t) => globalThis.setTimeout(e, t),
			clearTimeout: (e) => globalThis.clearTimeout(e)
		}, i = e.defaultTimeoutMs ?? tn, a = /* @__PURE__ */ new Map(), o = /* @__PURE__ */ new Map(), s = [], c = !1, l = !1, u = !1, d = (e) => {
			l || n(e);
		}, f = (e) => {
			e.timer !== null && (r.clearTimeout(e.timer), e.timer = null);
		}, p = (e, t, n) => {
			if (f(t), n && t.cancel) {
				let e = t.cancel;
				t.cancel = null;
				try {
					e();
				} catch {}
			} else t.cancel = null;
			a.get(e) === t && a.delete(e);
		}, m = (e, t) => {
			t.timeoutMs <= 0 || t.timer !== null || a.get(e) !== t || (t.timer = r.setTimeout(() => {
				l || a.get(e) !== t || (d(pn(t)), p(e, t, !0));
			}, t.timeoutMs));
		}, ee = (t) => {
			if (l || t.sessionRevision !== e.sessionRevision) return;
			let n = un(t), r = sn(n, t), i = a.get(r);
			!i || i.kind !== n || !cn(i.correlation, t) || (t.type === "PRESENTATION.STARTED" ? (i.phase = "running", m(r, i)) : t.type === "MOTION.ARRIVED" && (f(i), i.phase = "waiting-visual-idle"), d(t), dn(t) && p(r, i, !1));
		}, te = hn(e.port.subscribe((e) => {
			if (!l) {
				if (c) {
					s.push(e);
					return;
				}
				ee(e);
			}
		})), h = (e, t) => {
			d({
				type: "SCENE_RUNTIME.COMMAND_REJECTED",
				...rn(e),
				reason: t
			});
		}, g = (e, t) => {
			for (o.delete(e), o.set(e, t); o.size > nn;) {
				let e = o.keys().next().value;
				if (e === void 0) break;
				o.delete(e);
			}
		}, ne = (t) => {
			if (l) return h(t, "disposed"), !1;
			if (t.sessionRevision !== e.sessionRevision) return h(t, "stale-session"), !1;
			let n = on(t), r = o.get(n);
			return r ? t.attempt < r.attempt ? (h(t, "stale-attempt"), !1) : t.attempt !== r.attempt || (t.attemptId !== r.attemptId && h(t, "attempt-id-conflict"), !1) : !0;
		}, _ = (e) => {
			[...a.entries()].forEach(([t, n]) => {
				e(n) && p(t, n, !0);
			});
		}, re = (t) => {
			try {
				e.port.dispatch(t);
			} catch {}
		}, v = (t, n) => {
			let r = sn(n, t), o = a.get(r);
			o && p(r, o, !0);
			let l = rn(t), u = {
				kind: n,
				correlation: l,
				timeoutMs: ("timeoutMs" in t ? t.timeoutMs : void 0) ?? i,
				cancel: null,
				timer: null,
				phase: "running"
			};
			a.set(r, u), g(on(t), {
				attempt: t.attempt,
				attemptId: t.attemptId
			}), d(fn(n, l));
			let f;
			c = !0;
			try {
				f = e.port.dispatch(t);
			} catch (e) {
				c = !1, d(mn(n, l, e)), p(r, u, !1), s.splice(0).forEach(ee);
				return;
			}
			c = !1, f?.cancel && (u.cancel = f.cancel), n === "presentation" && f?.disposition === "deferred" && (u.phase = "waiting-start", d({
				type: "PRESENTATION.DEFERRED",
				...l,
				reason: f.deferredReason
			})), u.phase === "running" && m(r, u), s.splice(0).forEach(ee);
		};
		return t((e) => {
			if (!ne(e)) return;
			if (e.type === "PRESENTATION.CANCEL_TRANSACTION") {
				g(on(e), {
					attempt: e.attempt,
					attemptId: e.attemptId
				}), _((t) => t.kind === "presentation" && t.correlation.transactionId === e.transactionId), re(e);
				return;
			}
			if (e.type === "MOTION.ABORT") {
				g(on(e), {
					attempt: e.attempt,
					attemptId: e.attemptId
				}), _((t) => t.kind === "motion" && t.correlation.transactionId === e.transactionId && t.correlation.operationId === e.operationId), re(e);
				return;
			}
			let t = ln(e);
			t && v(e, t);
		}), () => {
			if (!u) {
				u = !0, l = !0;
				try {
					te();
				} catch {}
				[...a.entries()].forEach(([e, t]) => {
					p(e, t, !0);
				}), s.length = 0, o.clear();
			}
		};
	});
}
gn();
//#endregion
//#region src/statecharts/orchestration/context.ts
function _n() {
	return {
		requestedTargetNodeId: null,
		queuedTargetNodeId: null,
		navigationPlan: null,
		navigationStageIndex: 0,
		navigationBeforeActionIndex: 0,
		navigationAfterActionIndex: 0,
		navigationCommandToken: null,
		navigationCommandAttempt: 1,
		motionCommandToken: null,
		navigationStageStartedCommitted: !1,
		arrivedNodeId: null,
		linkedZoneCleanupComplete: !0,
		navigationWorkflowPhase: "idle",
		navigationWorkflowCommand: null,
		navigationLinkedCleanupCorrelation: null,
		navigationLinkedCleanupPlanId: null
	};
}
function vn() {
	return {
		zoneRevealPlan: null,
		zoneRevealBeforeActionIndex: 0,
		zoneRevealStepIndex: 0,
		zoneRevealCommandToken: null,
		zoneRevealCommandAttempt: 1,
		zoneDismissPlan: null,
		zoneDismissStepIndex: 0,
		zoneDismissCommandToken: null,
		zoneDismissCommandAttempt: 1,
		zoneTransitionActive: !1
	};
}
function yn(e) {
	return {
		zoneInitiallyActive: e.initialZoneStatus === "active",
		navigationEpochBase: e.navigationEpoch ?? `navigation:${e.initialNodeId}`,
		navigationEpochRevision: 1,
		navigationSequence: 0,
		pendingNavigationTargetNodeId: null,
		currentNodeId: e.initialNodeId,
		..._n(),
		...vn(),
		characterVisualIdle: e.initialCharacterVisualIdle ?? !0,
		fatalError: null,
		recoveryRequest: null,
		lastRecovery: null,
		lastRejectedNavigation: null
	};
}
function bn(e, t) {
	let { queuedTargetNodeId: n, ...r } = _n();
	return {
		zoneInitiallyActive: t.zoneStatus === "active",
		navigationEpochRevision: e.navigationEpochRevision + 1,
		pendingNavigationTargetNodeId: e.pendingNavigationTargetNodeId,
		navigationSequence: e.navigationSequence,
		currentNodeId: t.nodeId,
		...r,
		...vn(),
		characterVisualIdle: !0,
		fatalError: null,
		recoveryRequest: null,
		queuedTargetNodeId: e.pendingNavigationTargetNodeId,
		lastRecovery: Object.freeze({
			recoveryId: t.recoveryId,
			transactionId: t.transactionId,
			nodeId: t.nodeId,
			zoneStatus: t.zoneStatus,
			compensatedOperationCount: t.compensatedOperationCount
		})
	};
}
//#endregion
//#region src/statecharts/domain/commandBuilders.ts
function xn(e, t) {
	return `zone:${e}:reveal-before:${t}`;
}
function Sn(e, t) {
	return `zone:${e}:reveal:${t}`;
}
function Cn(e, t) {
	return `zone:${e}:dismiss:${t}`;
}
function wn(e, t) {
	return `${e}:attempt:${t}`;
}
function Tn(e, t, n, r, i, a) {
	let o = r, s = wn(e, t);
	return Object.freeze({
		type: "PRESENTATION.BRIDGE",
		token: s,
		transactionId: o,
		operationId: e,
		attemptId: s,
		attempt: t,
		lane: n,
		planId: r,
		stepIndex: i,
		action: a
	});
}
function En(e, t, n = 1) {
	let r = e.steps[t];
	if (!r) throw Error(`Reveal plan "${e.id}" has no step ${t}.`);
	let i = Sn(e.id, t), a = wn(i, n);
	if (r.source.kind === "bridge") {
		if (!r.bridgeAction) throw Error(`Reveal bridge step ${t} has no bridge action.`);
		return Tn(i, n, "zone-reveal", e.id, t, r.bridgeAction);
	}
	return Object.freeze({
		type: "PRESENTATION.CONSTRUCT",
		token: a,
		transactionId: e.id,
		operationId: i,
		attemptId: a,
		attempt: n,
		lane: "zone-reveal",
		planId: e.id,
		stepIndex: t,
		direction: "fall-in",
		construct: r.source
	});
}
function Dn(e, t, n = 1, r) {
	let i = e.steps[t];
	if (!i) throw Error(`Dismiss plan "${e.id}" has no step ${t}.`);
	let a = r ?? e.linkedNavigationPlanId ?? e.id, o = Cn(e.id, t), s = wn(o, n);
	if (i.source.kind === "bridge") {
		if (!i.bridgeAction) throw Error(`Dismiss bridge step ${t} has no bridge action.`);
		return Object.freeze({
			...Tn(o, n, "zone-dismiss", a, t, i.bridgeAction),
			planId: e.id
		});
	}
	return Object.freeze({
		type: "PRESENTATION.CONSTRUCT",
		token: s,
		transactionId: a,
		operationId: o,
		attemptId: s,
		attempt: n,
		lane: "zone-dismiss",
		planId: e.id,
		stepIndex: t,
		direction: "rise-out",
		construct: i.source
	});
}
//#endregion
//#region src/workflows/recovery/machine.ts
var On = 8e3, kn = 4e3;
function An(e) {
	return Object.freeze({
		...e,
		metadata: Object.freeze({ ...e.metadata })
	});
}
function U(e, t) {
	if (e.length === 0) throw Error(`${t} must be non-empty.`);
	return e;
}
function jn(e) {
	if (!Number.isSafeInteger(e.sessionRevision) || e.sessionRevision < 0) throw Error("sessionRevision must be a non-negative safe integer.");
	let t = /* @__PURE__ */ new Set(), n = e.journal.map((e) => {
		if (U(e.journalId, "journalId"), t.has(e.journalId)) throw Error(`Duplicate recovery journal id \"${e.journalId}\".`);
		return t.add(e.journalId), An(e);
	});
	return Object.freeze({
		recoveryId: U(e.recoveryId, "recoveryId"),
		sessionRevision: e.sessionRevision,
		transactionId: U(e.transactionId, "transactionId"),
		checkpointId: U(e.checkpointId, "checkpointId"),
		safeNodeId: U(e.safeNodeId, "safeNodeId"),
		journal: Object.freeze(n),
		cursor: n.length - 1,
		compensatedOperationCount: 0,
		failure: null
	});
}
function W(e, t) {
	let n = `${e.recoveryId}:${t}`;
	return Object.freeze({
		recoveryId: e.recoveryId,
		sessionRevision: e.sessionRevision,
		transactionId: e.transactionId,
		operationId: n,
		attemptId: `${n}:attempt:1`,
		attempt: 1
	});
}
function G(e, t) {
	if (t === "cancelling-presentation") return Object.freeze({
		type: "RECOVERY.CANCEL_PRESENTATION",
		step: t,
		...W(e, "cancel-presentation")
	});
	if (t === "aborting-motion") return Object.freeze({
		type: "RECOVERY.ABORT_MOTION",
		step: t,
		safeNodeId: e.safeNodeId,
		...W(e, "abort-motion")
	});
	if (t === "compensating") {
		let n = e.journal[e.cursor];
		return n ? Object.freeze({
			type: "RECOVERY.COMPENSATE_PRESENTATION",
			step: t,
			journalIndex: e.cursor,
			entry: n,
			...W(e, `compensate:${e.cursor}:${n.journalId}`)
		}) : null;
	}
	return Object.freeze(t === "restoring-rule-ledger" ? {
		type: "RECOVERY.RESTORE_RULE_LEDGER",
		step: t,
		checkpointId: e.checkpointId,
		...W(e, "restore-rule-ledger")
	} : {
		type: "RECOVERY.AWAIT_CHARACTER_IDLE",
		step: t,
		safeNodeId: e.safeNodeId,
		...W(e, "await-character-idle")
	});
}
function K(e, t) {
	return t !== null && e.type !== "RECOVERY.RESET" && e.recoveryId === t.recoveryId && e.sessionRevision === t.sessionRevision && e.transactionId === t.transactionId && e.operationId === t.operationId && e.attemptId === t.attemptId && e.attempt === t.attempt;
}
function Mn(e, t, n) {
	let { recoveryId: r, sessionRevision: i, transactionId: a, operationId: o, attemptId: s, attempt: c } = e;
	return Object.freeze({
		kind: t,
		step: e.step,
		commandType: e.type,
		error: n,
		correlation: Object.freeze({
			recoveryId: r,
			sessionRevision: i,
			transactionId: a,
			operationId: o,
			attemptId: s,
			attempt: c
		})
	});
}
function Nn(e) {
	return e.type === "RECOVERY.COMMAND.FAILED" ? e.error : "Recovery command failed.";
}
function q(e, t, n) {
	let r = G(e, n);
	return r ? { failure: Mn(r, "command-failed", Nn(t)) } : {};
}
function J(e, t) {
	let n = G(e, t);
	return n ? { failure: Mn(n, "timeout", `${n.type} timed out.`) } : {};
}
function Pn(e = {}) {
	let t = e.commandTimeoutMs ?? On, n = e.characterIdleTimeoutMs ?? kn;
	if (!Number.isFinite(t) || t < 0) throw Error("commandTimeoutMs must be a finite non-negative number.");
	if (!Number.isFinite(n) || n < 0) throw Error("characterIdleTimeoutMs must be a finite non-negative number.");
	return H({
		types: {},
		delays: {
			recoveryCommandTimeout: t,
			recoveryCharacterIdleTimeout: n
		},
		guards: {
			noCompensationRemaining: ({ context: e }) => e.cursor < 0,
			cancelAckMatches: ({ context: e, event: t }) => K(t, G(e, "cancelling-presentation")),
			abortAckMatches: ({ context: e, event: t }) => K(t, G(e, "aborting-motion")),
			compensationAckMatches: ({ context: e, event: t }) => K(t, G(e, "compensating")),
			restoreAckMatches: ({ context: e, event: t }) => K(t, G(e, "restoring-rule-ledger")),
			characterIdleAckMatches: ({ context: e, event: t }) => K(t, G(e, "awaiting-character-idle"))
		},
		actions: {
			advanceCompensation: I(({ context: e }) => ({
				cursor: e.cursor - 1,
				compensatedOperationCount: e.compensatedOperationCount + 1
			})),
			finishCompensation: I(({ context: e }) => ({
				cursor: -1,
				compensatedOperationCount: e.compensatedOperationCount + 1
			})),
			closeRecovery: I(() => ({ failure: null })),
			recordCancelFailure: I(({ context: e, event: t }) => q(e, t, "cancelling-presentation")),
			recordAbortFailure: I(({ context: e, event: t }) => q(e, t, "aborting-motion")),
			recordCompensationFailure: I(({ context: e, event: t }) => q(e, t, "compensating")),
			recordRestoreFailure: I(({ context: e, event: t }) => q(e, t, "restoring-rule-ledger")),
			recordCharacterFailure: I(({ context: e, event: t }) => q(e, t, "awaiting-character-idle")),
			recordCancelTimeout: I(({ context: e }) => J(e, "cancelling-presentation")),
			recordAbortTimeout: I(({ context: e }) => J(e, "aborting-motion")),
			recordCompensationTimeout: I(({ context: e }) => J(e, "compensating")),
			recordRestoreTimeout: I(({ context: e }) => J(e, "restoring-rule-ledger")),
			recordCharacterTimeout: I(({ context: e }) => J(e, "awaiting-character-idle"))
		}
	}).createMachine({
		id: "recovery-workflow",
		initial: "preparing",
		context: ({ input: e }) => jn(e),
		output: ({ event: e }) => {
			if (!("output" in e) || !e.output) throw Error("Recovery workflow completed without a terminal output.");
			return e.output;
		},
		on: { "RECOVERY.RESET": {
			target: ".closed",
			actions: "closeRecovery"
		} },
		states: {
			preparing: { always: "cancellingPresentation" },
			cancellingPresentation: {
				tags: ["recovery-command-pending"],
				after: { recoveryCommandTimeout: {
					target: "failed",
					actions: "recordCancelTimeout"
				} },
				on: {
					"RECOVERY.COMMAND.SUCCEEDED": {
						guard: "cancelAckMatches",
						target: "abortingMotion"
					},
					"RECOVERY.COMMAND.FAILED": {
						guard: "cancelAckMatches",
						target: "failed",
						actions: "recordCancelFailure"
					}
				}
			},
			abortingMotion: {
				tags: ["recovery-command-pending"],
				after: { recoveryCommandTimeout: {
					target: "failed",
					actions: "recordAbortTimeout"
				} },
				on: {
					"RECOVERY.COMMAND.SUCCEEDED": {
						guard: "abortAckMatches",
						target: "compensating"
					},
					"RECOVERY.COMMAND.FAILED": {
						guard: "abortAckMatches",
						target: "failed",
						actions: "recordAbortFailure"
					}
				}
			},
			compensating: {
				tags: ["recovery-command-pending"],
				always: {
					guard: "noCompensationRemaining",
					target: "restoringRuleLedger"
				},
				after: { recoveryCommandTimeout: {
					target: "failed",
					actions: "recordCompensationTimeout"
				} },
				on: {
					"RECOVERY.COMMAND.SUCCEEDED": [{
						guard: ({ context: e, event: t }) => K(t, G(e, "compensating")) && e.cursor > 0,
						target: "compensating",
						reenter: !0,
						actions: "advanceCompensation"
					}, {
						guard: "compensationAckMatches",
						target: "restoringRuleLedger",
						actions: "finishCompensation"
					}],
					"RECOVERY.COMMAND.FAILED": {
						guard: "compensationAckMatches",
						target: "failed",
						actions: "recordCompensationFailure"
					}
				}
			},
			restoringRuleLedger: {
				tags: ["recovery-command-pending"],
				after: { recoveryCommandTimeout: {
					target: "failed",
					actions: "recordRestoreTimeout"
				} },
				on: {
					"RECOVERY.COMMAND.SUCCEEDED": {
						guard: "restoreAckMatches",
						target: "awaitingCharacterIdle"
					},
					"RECOVERY.COMMAND.FAILED": {
						guard: "restoreAckMatches",
						target: "failed",
						actions: "recordRestoreFailure"
					}
				}
			},
			awaitingCharacterIdle: {
				tags: ["recovery-command-pending"],
				after: { recoveryCharacterIdleTimeout: {
					target: "failed",
					actions: "recordCharacterTimeout"
				} },
				on: {
					"RECOVERY.COMMAND.SUCCEEDED": {
						guard: "characterIdleAckMatches",
						target: "succeeded"
					},
					"RECOVERY.COMMAND.FAILED": {
						guard: "characterIdleAckMatches",
						target: "failed",
						actions: "recordCharacterFailure"
					}
				}
			},
			succeeded: {
				type: "final",
				tags: ["recovery-succeeded"],
				output: ({ context: e }) => Object.freeze({
					status: "succeeded",
					recoveryId: e.recoveryId,
					safeNodeId: e.safeNodeId,
					compensatedOperationCount: e.compensatedOperationCount
				})
			},
			failed: {
				type: "final",
				tags: ["recovery-degraded"],
				output: ({ context: e }) => {
					if (!e.failure) throw Error("A failed recovery must include failure details.");
					return Object.freeze({
						status: "degraded",
						recoveryId: e.recoveryId,
						safeNodeId: e.safeNodeId,
						failure: e.failure
					});
				}
			},
			closed: {
				type: "final",
				tags: ["recovery-closed"],
				output: ({ context: e }) => Object.freeze({
					status: "closed",
					recoveryId: e.recoveryId
				})
			}
		}
	});
}
//#endregion
//#region src/workflows/recovery/selectors.ts
function Fn(e) {
	return e.matches("cancellingPresentation") ? "cancelling-presentation" : e.matches("abortingMotion") ? "aborting-motion" : e.matches("compensating") ? "compensating" : e.matches("restoringRuleLedger") ? "restoring-rule-ledger" : e.matches("awaitingCharacterIdle") ? "awaiting-character-idle" : null;
}
function In(e) {
	let t = Fn(e);
	return t ? G(e.context, t) : null;
}
//#endregion
//#region src/workflows/character-settle/machine.ts
var Ln = 1200, Rn = 1200;
function zn(e, t) {
	if (e.length === 0) throw Error(`${t} must be non-empty.`);
	return e;
}
function Bn(e) {
	let t = `${e.motionOperationId}:character-settle`;
	return Object.freeze({
		type: "CHARACTER.FORCE_SETTLE",
		motionToken: e.motionToken,
		arrivedNodeId: e.arrivedNodeId,
		transactionId: e.transactionId,
		operationId: t,
		attemptId: `${t}:attempt:1`,
		attempt: 1,
		reason: "motion-arrived-not-visually-idle"
	});
}
function Vn(e) {
	if (!Number.isSafeInteger(e.motionAttempt) || e.motionAttempt < 1) throw Error("motionAttempt must be a positive safe integer.");
	let t = Object.freeze({
		motionToken: zn(e.motionToken, "motionToken"),
		transactionId: zn(e.transactionId, "transactionId"),
		motionOperationId: zn(e.motionOperationId, "motionOperationId"),
		motionAttempt: e.motionAttempt,
		arrivedNodeId: zn(e.arrivedNodeId, "arrivedNodeId")
	});
	return Object.freeze({
		...t,
		command: Bn(t),
		settledBy: null,
		failure: null
	});
}
function Hn(e, t) {
	return (t.type === "CHARACTER.SETTLED" || t.type === "CHARACTER.FAILED") && t.transactionId === e.command.transactionId && t.operationId === e.command.operationId && t.attemptId === e.command.attemptId && t.attempt === e.command.attempt;
}
function Un(e, t) {
	return t.type === "MOTION.VISUAL_IDLE" && t.token === e.motionToken && t.nodeId === e.arrivedNodeId;
}
function Wn(e) {
	return Object.freeze({
		kind: "force-settle-timeout",
		error: "Character failed to reach a stable idle pose after forced settle.",
		command: e.command
	});
}
function Gn(e = {}) {
	let t = e.naturalSettleTimeoutMs ?? Ln, n = e.forcedSettleAckTimeoutMs ?? Rn;
	if (!Number.isFinite(t) || t < 0) throw Error("naturalSettleTimeoutMs must be a finite non-negative number.");
	if (!Number.isFinite(n) || n < 0) throw Error("forcedSettleAckTimeoutMs must be a finite non-negative number.");
	return H({
		types: {},
		delays: {
			naturalSettleTimeout: t,
			forcedSettleAckTimeout: n
		},
		guards: {
			visualIdleMatches: ({ context: e, event: t }) => Un(e, t),
			dispatchMatches: ({ context: e, event: t }) => t.type === "CHARACTER.SETTLE.COMMAND_DISPATCHED" && t.attemptId === e.command.attemptId,
			forceSettleAckMatches: ({ context: e, event: t }) => Hn(e, t)
		},
		actions: {
			markNaturalIdle: I({ settledBy: "natural-idle" }),
			markForcedSettle: I({ settledBy: "forced-settle" }),
			recordForcedFailure: I(({ context: e, event: t }) => ({ failure: t.type === "CHARACTER.FAILED" ? Object.freeze({
				kind: t.timedOut ? "force-settle-timeout" : "force-settle-failed",
				error: t.error,
				command: e.command
			}) : e.failure })),
			recordForcedTimeout: I(({ context: e }) => ({ failure: Wn(e) }))
		}
	}).createMachine({
		id: "character-settle-workflow",
		initial: "naturallySettling",
		context: ({ input: e }) => Vn(e),
		output: ({ event: e }) => {
			if (!("output" in e) || !e.output) throw Error("Character settle workflow completed without an output.");
			return e.output;
		},
		states: {
			naturallySettling: {
				tags: ["character-settle-natural"],
				after: { naturalSettleTimeout: "issuingForceSettle" },
				on: { "MOTION.VISUAL_IDLE": {
					guard: "visualIdleMatches",
					target: "settled",
					actions: "markNaturalIdle"
				} }
			},
			issuingForceSettle: {
				tags: ["character-settle-command-pending"],
				on: {
					"MOTION.VISUAL_IDLE": {
						guard: "visualIdleMatches",
						target: "settled",
						actions: "markNaturalIdle"
					},
					"CHARACTER.SETTLE.COMMAND_DISPATCHED": {
						guard: "dispatchMatches",
						target: "awaitingForceSettleAck"
					}
				}
			},
			awaitingForceSettleAck: {
				tags: ["character-settle-forced"],
				after: { forcedSettleAckTimeout: {
					target: "failed",
					actions: "recordForcedTimeout"
				} },
				on: {
					"MOTION.VISUAL_IDLE": {
						guard: "visualIdleMatches",
						target: "settled",
						actions: "markNaturalIdle"
					},
					"CHARACTER.SETTLED": {
						guard: "forceSettleAckMatches",
						target: "settled",
						actions: "markForcedSettle"
					},
					"CHARACTER.FAILED": {
						guard: "forceSettleAckMatches",
						target: "failed",
						actions: "recordForcedFailure"
					}
				}
			},
			settled: {
				type: "final",
				output: ({ context: e }) => {
					if (!e.settledBy) throw Error("Settled character workflow is missing its settle source.");
					return Object.freeze({
						status: "settled",
						motionToken: e.motionToken,
						transactionId: e.transactionId,
						motionOperationId: e.motionOperationId,
						arrivedNodeId: e.arrivedNodeId,
						settledBy: e.settledBy
					});
				}
			},
			failed: {
				type: "final",
				output: ({ context: e }) => {
					if (!e.failure) throw Error("Failed character workflow is missing failure details.");
					return Object.freeze({
						status: "failed",
						motionToken: e.motionToken,
						transactionId: e.transactionId,
						motionOperationId: e.motionOperationId,
						motionAttempt: e.motionAttempt,
						arrivedNodeId: e.arrivedNodeId,
						failure: e.failure
					});
				}
			}
		}
	});
}
//#endregion
//#region src/workflows/character-settle/selectors.ts
function Kn(e) {
	return e.matches("issuingForceSettle") ? e.context.command : null;
}
//#endregion
//#region src/workflows/navigation/protocol.ts
function qn(e, t) {
	if (e.length === 0) throw Error(`${t} must be non-empty.`);
	return e;
}
function Jn(e, t, n = !1) {
	if (!Number.isSafeInteger(e) || e < +!n) throw Error(`${t} must be a ${n ? "non-negative" : "positive"} safe integer.`);
	return e;
}
function Yn(e, t = {}) {
	return qn(e.epoch, "epoch"), Jn(e.sequence, "sequence", t.allowSequenceZero ?? !1), qn(e.transactionId, "transactionId"), qn(e.operationId, "operationId"), qn(e.attemptId, "attemptId"), Jn(e.attempt, "attempt"), e;
}
function Y(e, t) {
	return `${e}:attempt:${t}`;
}
function Xn(e, t, n, r) {
	let i = `${n}:request`;
	return Object.freeze({
		epoch: e,
		sequence: t,
		transactionId: n,
		operationId: i,
		attemptId: Y(i, 1),
		attempt: 1,
		targetNodeId: r
	});
}
function Zn(e, t, n, r, i, a) {
	let o = t.stages[n], s = r === "before" ? o?.beforeTravelBridgeActions[i] : o?.afterArrivalBridgeActions[i];
	if (!o || !s) throw Error(`Navigation plan "${t.id}" has no ${r} action ${i} at stage ${n}.`);
	let c = `${e.transactionId}:stage:${n}:${r}:${i}`, l = Y(c, a);
	return Object.freeze({
		type: "PRESENTATION.BRIDGE",
		token: l,
		epoch: e.epoch,
		sequence: e.sequence,
		transactionId: e.transactionId,
		operationId: c,
		attemptId: l,
		attempt: a,
		lane: r === "before" ? "navigation-before" : "navigation-after-arrival",
		planId: t.id,
		stageIndex: n,
		stepIndex: i,
		action: s
	});
}
function Qn(e, t, n, r = 1) {
	let i = t.stages[n];
	if (!i) throw Error(`Navigation plan "${t.id}" has no stage ${n}.`);
	let a = `${e.transactionId}:stage:${n}:motion:${i.id}`, o = Y(a, r);
	return Object.freeze({
		type: "MOTION.NAVIGATE",
		token: o,
		epoch: e.epoch,
		sequence: e.sequence,
		transactionId: e.transactionId,
		operationId: a,
		attemptId: o,
		attempt: r,
		navigationPlanId: t.id,
		stageId: i.id,
		stageIndex: n,
		fromNodeId: i.fromNodeId,
		toNodeId: i.toNodeId,
		routeNodeIds: Object.freeze([...i.routeNodeIds]),
		routeEdgeIds: Object.freeze([...i.routeEdgeIds])
	});
}
function $n(e) {
	let t = `${e.transactionId}:linked-zone-cleanup`;
	return Object.freeze({
		epoch: e.epoch,
		sequence: e.sequence,
		transactionId: e.transactionId,
		operationId: t,
		attemptId: Y(t, 1),
		attempt: 1
	});
}
function er(e) {
	let t = `${e.transactionId}:settled`;
	return Object.freeze({
		epoch: e.epoch,
		sequence: e.sequence,
		transactionId: e.transactionId,
		operationId: t,
		attemptId: Y(t, 1),
		attempt: 1
	});
}
function tr(e, t, n, r, i, a) {
	return Object.freeze({
		type: "CHARACTER.FORCE_SETTLE",
		motionToken: t.token,
		arrivedNodeId: n,
		reason: "motion-arrived-not-visually-idle",
		epoch: e.epoch,
		sequence: e.sequence,
		transactionId: e.transactionId,
		operationId: r,
		attemptId: i,
		attempt: a
	});
}
function nr(e, t) {
	return e !== null && t.epoch === e.epoch && t.sequence === e.sequence && t.transactionId === e.transactionId && t.operationId === e.operationId && t.attemptId === e.attemptId && t.attempt === e.attempt;
}
//#endregion
//#region src/workflows/navigation/machine.ts
var rr = 2;
function ir(e) {
	return Object.freeze({
		epoch: e.epoch,
		sequence: e.sequence,
		transactionId: e.transactionId,
		operationId: e.operationId,
		attemptId: e.attemptId,
		attempt: e.attempt,
		targetNodeId: e.targetNodeId
	});
}
function ar(e) {
	let t = Yn(e.correlation, { allowSequenceZero: !0 });
	return {
		lifecycle: Object.freeze({ ...t }),
		currentNodeId: e.initialNodeId,
		latestSequence: t.sequence,
		activeIntent: null,
		queuedIntent: null,
		plan: null,
		linkedDismissPlan: null,
		stageIndex: 0,
		beforeActionIndex: 0,
		afterActionIndex: 0,
		presentationCommand: null,
		motionCommand: null,
		characterCommand: null,
		presentationAttempt: 1,
		stageStartedCommitted: !1,
		arrivedNodeId: null,
		characterVisualIdle: e.initialCharacterVisualIdle ?? !0,
		linkedCleanupComplete: !0,
		linkedCleanupCorrelation: null,
		rejection: null,
		failure: null
	};
}
function or(e) {
	return e.plan?.stages[e.stageIndex] ?? null;
}
function sr(e) {
	return typeof e != "object" || !e || !("snapshot" in e) ? null : e.snapshot;
}
function cr(e) {
	return typeof e != "object" || !e || !("output" in e) ? null : e.output ?? null;
}
function lr(e) {
	return e ? {
		epoch: e.epoch,
		sequence: e.sequence,
		transactionId: e.transactionId,
		operationId: e.operationId,
		attemptId: e.attemptId,
		attempt: e.attempt
	} : null;
}
function ur(e) {
	if (!e.activeIntent || !e.plan) throw Error("Settled navigation is missing its active transaction.");
	return Object.freeze({
		type: "NAVIGATION.SETTLED",
		...er(e.activeIntent),
		planId: e.plan.id,
		nodeId: e.currentNodeId
	});
}
function X(e, t) {
	return e !== null && t.token === e.token && nr(e, t);
}
function dr(e) {
	switch (e.type) {
		case "PRESENTATION.FAILED": return "presentation-failed";
		case "PRESENTATION.TIMED_OUT": return "presentation-timeout";
		case "MOTION.FAILED": return "motion-failed";
		case "MOTION.TIMED_OUT": return "motion-timeout";
		case "CHARACTER.FAILED": return e.timedOut ? "character-timeout" : "character-failed";
	}
}
function fr(e, t) {
	return Object.freeze({
		epoch: t.epoch,
		sequence: t.sequence,
		transactionId: t.transactionId,
		operationId: t.operationId,
		attemptId: t.attemptId,
		attempt: t.attempt,
		kind: dr(t),
		error: t.error,
		safeNodeId: e.currentNodeId,
		planId: e.plan?.id ?? null
	});
}
function pr(e, t) {
	return {
		activeIntent: t,
		queuedIntent: null,
		plan: null,
		linkedDismissPlan: null,
		stageIndex: 0,
		beforeActionIndex: 0,
		afterActionIndex: 0,
		presentationCommand: null,
		motionCommand: null,
		characterCommand: null,
		presentationAttempt: 1,
		stageStartedCommitted: !1,
		arrivedNodeId: null,
		linkedCleanupComplete: !0,
		linkedCleanupCorrelation: null,
		rejection: null,
		failure: null,
		characterVisualIdle: e.characterVisualIdle
	};
}
function mr(e) {
	return H({
		types: {},
		actors: { characterSettleWorkflow: Gn({
			naturalSettleTimeoutMs: e.characterNaturalSettleTimeoutMs,
			forcedSettleAckTimeoutMs: e.characterForceSettleAckTimeoutMs
		}) },
		guards: {
			newerIntent: ({ context: e, event: t }) => t.type === "NAVIGATION.REQUESTED" && t.epoch === e.lifecycle.epoch && t.epoch.length > 0 && t.transactionId.length > 0 && t.operationId.length > 0 && t.targetNodeId.length > 0 && t.sequence > e.latestSequence && t.attempt === 1 && t.attemptId === `${t.operationId}:attempt:1`,
			hasPlan: ({ context: e }) => e.plan !== null,
			hasStages: ({ context: e }) => (e.plan?.stages.length ?? 0) > 0,
			hasBeforeAction: ({ context: e }) => {
				let t = or(e);
				return t !== null && e.beforeActionIndex < t.beforeTravelBridgeActions.length;
			},
			hasAfterAction: ({ context: e }) => {
				let t = or(e);
				return t !== null && e.afterActionIndex < t.afterArrivalBridgeActions.length;
			},
			hasMoreStages: ({ context: e }) => e.plan !== null && e.stageIndex < e.plan.stages.length,
			shouldArmLinkedCleanup: ({ context: e }) => e.stageIndex === 0 && e.linkedDismissPlan !== null && e.motionCommand !== null,
			presentationAckMatches: ({ context: e, event: t }) => t.type === "PRESENTATION.SETTLED" && X(e.presentationCommand, t),
			presentationFailureMatches: ({ context: e, event: t }) => (t.type === "PRESENTATION.FAILED" || t.type === "PRESENTATION.TIMED_OUT") && X(e.presentationCommand, t),
			presentationCanRetry: ({ context: e, event: t }) => (t.type === "PRESENTATION.FAILED" || t.type === "PRESENTATION.TIMED_OUT") && X(e.presentationCommand, t) && e.presentationAttempt < rr,
			motionAckMatches: ({ context: e, event: t }) => (t.type === "MOTION.DEPARTED" || t.type === "MOTION.ARRIVED" || t.type === "MOTION.VISUAL_IDLE") && X(e.motionCommand, t),
			arrivalMatches: ({ context: e, event: t }) => t.type === "MOTION.ARRIVED" && X(e.motionCommand, t) && t.nodeId === or(e)?.toNodeId,
			motionFailureMatches: ({ context: e, event: t }) => (t.type === "MOTION.FAILED" || t.type === "MOTION.TIMED_OUT") && X(e.motionCommand, t),
			visualIdleMatches: ({ context: e, event: t }) => t.type === "MOTION.VISUAL_IDLE" && X(e.motionCommand, t) && t.nodeId === e.arrivedNodeId,
			characterAlreadyIdle: ({ context: e }) => e.characterVisualIdle,
			characterSettleSucceeded: ({ event: e }) => cr(e)?.status === "settled",
			characterAckMatches: ({ context: e, event: t }) => (t.type === "CHARACTER.SETTLED" || t.type === "CHARACTER.FAILED") && X(e.characterCommand ? {
				...e.characterCommand,
				token: e.characterCommand.attemptId
			} : null, t),
			cleanupMatches: ({ context: e, event: t }) => t.type === "ZONE.CLEANUP.COMPLETED" && t.navigationPlanId === e.plan?.id && nr(e.linkedCleanupCorrelation, t),
			cleanupComplete: ({ context: e }) => e.linkedCleanupComplete,
			hasQueuedIntent: ({ context: e }) => e.queuedIntent !== null
		},
		actions: {
			acceptIntent: I(({ event: e }) => e.type === "NAVIGATION.REQUESTED" ? (Yn(e), {
				activeIntent: ir(e),
				queuedIntent: null,
				latestSequence: e.sequence,
				rejection: null,
				failure: null
			}) : {}),
			queueLatestIntent: I(({ event: e }) => e.type === "NAVIGATION.REQUESTED" ? (Yn(e), {
				queuedIntent: ir(e),
				latestSequence: e.sequence
			}) : {}),
			planNavigation: I(({ context: t }) => {
				let n = t.activeIntent;
				if (!n) return {};
				let r;
				try {
					r = e.planNavigation(t.currentNodeId, n.targetNodeId);
				} catch (e) {
					return {
						plan: null,
						rejection: Object.freeze({
							type: "NAVIGATION.REJECTED",
							...n,
							sourceNodeId: t.currentNodeId,
							targetNodeId: n.targetNodeId,
							reason: "rule-conflict",
							detail: e instanceof Error ? e.message : "navigation-planner-failed"
						})
					};
				}
				if (!r.accepted) return {
					plan: null,
					rejection: Object.freeze({
						type: "NAVIGATION.REJECTED",
						...n,
						sourceNodeId: t.currentNodeId,
						targetNodeId: n.targetNodeId,
						reason: r.reason,
						detail: r.detail
					})
				};
				let i = r.plan;
				if (i.sourceNodeId !== t.currentNodeId || i.targetNodeId !== n.targetNodeId || i.stages.some((e, t) => e.index !== t)) return {
					plan: null,
					rejection: Object.freeze({
						type: "NAVIGATION.REJECTED",
						...n,
						sourceNodeId: t.currentNodeId,
						targetNodeId: n.targetNodeId,
						reason: "rule-conflict",
						detail: "navigation-plan-correlation-mismatch"
					})
				};
				let a = r.concurrentZoneDismissalPlan === null ? null : $n(n);
				return {
					plan: i,
					linkedDismissPlan: r.concurrentZoneDismissalPlan,
					stageIndex: 0,
					beforeActionIndex: 0,
					afterActionIndex: 0,
					presentationCommand: null,
					motionCommand: null,
					characterCommand: null,
					presentationAttempt: 1,
					stageStartedCommitted: !1,
					arrivedNodeId: null,
					linkedCleanupComplete: a === null,
					linkedCleanupCorrelation: a,
					rejection: null,
					failure: null
				};
			}),
			issueBeforePresentation: V(({ context: t, enqueue: n }) => {
				if (!t.activeIntent || !t.plan) return;
				let r = Zn(t.activeIntent, t.plan, t.stageIndex, "before", t.beforeActionIndex, t.presentationAttempt);
				n.assign({ presentationCommand: r }), n(() => e.executePresentation(r));
			}),
			commitBeforePresentation: I(({ context: t }) => t.plan ? (e.commitNavigationBeforeAction(t.plan.id, t.stageIndex, t.beforeActionIndex), {
				beforeActionIndex: t.beforeActionIndex + 1,
				presentationCommand: null,
				presentationAttempt: 1
			}) : {}),
			issueMotion: V(({ context: t, enqueue: n }) => {
				if (!t.activeIntent || !t.plan) return;
				let r = Qn(t.activeIntent, t.plan, t.stageIndex);
				n.assign({
					motionCommand: r,
					characterCommand: null,
					stageStartedCommitted: !1,
					arrivedNodeId: null,
					characterVisualIdle: !1
				}), n(() => e.executeMotion(r));
			}),
			notifyLinkedCleanup: B(({ context: e }) => {
				let t = e.activeIntent, n = e.plan, r = e.linkedDismissPlan, i = e.motionCommand, a = e.linkedCleanupCorrelation;
				if (!t || !n || !r || !i || !a) throw Error("Linked cleanup notification requires a complete navigation transaction.");
				return {
					type: "NAVIGATION.LINKED_ZONE_CLEANUP.REQUESTED",
					...lr(i),
					plan: r,
					navigationPlanId: n.id,
					motionToken: i.token,
					completion: a
				};
			}),
			commitStageStarted: I(({ context: t }) => !t.plan || t.stageStartedCommitted ? {} : (e.commitNavigationStageStarted(t.plan.id, t.stageIndex), { stageStartedCommitted: !0 })),
			recordArrival: I(({ event: e }) => e.type === "MOTION.ARRIVED" ? {
				currentNodeId: e.nodeId,
				arrivedNodeId: e.nodeId,
				afterActionIndex: 0,
				presentationCommand: null,
				presentationAttempt: 1,
				characterVisualIdle: !1
			} : {}),
			markVisualIdle: I({ characterVisualIdle: !0 }),
			issueAfterPresentation: V(({ context: t, enqueue: n }) => {
				if (!t.activeIntent || !t.plan) return;
				let r = Zn(t.activeIntent, t.plan, t.stageIndex, "after", t.afterActionIndex, t.presentationAttempt);
				n.assign({ presentationCommand: r }), n(() => e.executePresentation(r));
			}),
			commitAfterPresentation: I(({ context: t }) => !t.plan || !t.arrivedNodeId ? {} : (e.commitNavigationAfterAction(t.plan.id, t.stageIndex, t.afterActionIndex, t.arrivedNodeId), {
				afterActionIndex: t.afterActionIndex + 1,
				presentationCommand: null,
				presentationAttempt: 1
			})),
			completeStage: I(({ context: t }) => !t.plan || !t.arrivedNodeId ? {} : (e.commitNavigationStageArrived(t.plan.id, t.stageIndex, t.arrivedNodeId), {
				stageIndex: t.stageIndex + 1,
				beforeActionIndex: 0,
				afterActionIndex: 0,
				presentationCommand: null,
				presentationAttempt: 1,
				stageStartedCommitted: !1,
				characterCommand: null
			})),
			retryPresentation: V(({ context: t, event: n, enqueue: r }) => {
				if (n.type !== "PRESENTATION.FAILED" && n.type !== "PRESENTATION.TIMED_OUT") return;
				let i = t.presentationAttempt + 1;
				r.assign({
					presentationAttempt: i,
					presentationCommand: null
				}), r(() => e.onOperationRetry?.(Object.freeze({
					epoch: n.epoch,
					sequence: n.sequence,
					transactionId: n.transactionId,
					operationId: n.operationId,
					attemptId: n.attemptId,
					attempt: n.attempt,
					failedAttemptId: n.attemptId,
					nextAttempt: i,
					reason: n.error
				})));
			}),
			recordFailure: I(({ context: e, event: t }) => t.type !== "PRESENTATION.FAILED" && t.type !== "PRESENTATION.TIMED_OUT" && t.type !== "MOTION.FAILED" && t.type !== "MOTION.TIMED_OUT" && t.type !== "CHARACTER.FAILED" ? {} : { failure: fr(e, t) }),
			markCleanupComplete: I({ linkedCleanupComplete: !0 }),
			dispatchCharacterSettleCommand: V(({ context: t, event: n, enqueue: r }) => {
				let i = sr(n), a = i ? Kn(i) : null;
				if (!a || !t.activeIntent || !t.motionCommand || !t.arrivedNodeId) return;
				let o = tr(t.activeIntent, t.motionCommand, t.arrivedNodeId, a.operationId, a.attemptId, a.attempt);
				r.assign({ characterCommand: o }), r(() => e.executeCharacterForceSettle?.(o)), r.sendTo("characterSettleWorkflow", {
					type: "CHARACTER.SETTLE.COMMAND_DISPATCHED",
					attemptId: o.attemptId
				});
			}),
			forwardVisualIdleToCharacter: z("characterSettleWorkflow", ({ event: e }) => {
				if (e.type !== "MOTION.VISUAL_IDLE") throw Error("Expected a correlated visual-idle event.");
				return {
					type: e.type,
					token: e.token,
					nodeId: e.nodeId
				};
			}),
			forwardCharacterAck: z("characterSettleWorkflow", ({ event: e }) => {
				if (e.type !== "CHARACTER.SETTLED" && e.type !== "CHARACTER.FAILED") throw Error("Expected a correlated character acknowledgement.");
				return e.type === "CHARACTER.SETTLED" ? {
					type: e.type,
					transactionId: e.transactionId,
					operationId: e.operationId,
					attemptId: e.attemptId,
					attempt: e.attempt
				} : {
					type: e.type,
					transactionId: e.transactionId,
					operationId: e.operationId,
					attemptId: e.attemptId,
					attempt: e.attempt,
					error: e.error,
					timedOut: e.timedOut
				};
			}),
			completeCharacterSettle: I(({ event: e }) => {
				let t = cr(e);
				return t?.status === "settled" ? {
					currentNodeId: t.arrivedNodeId,
					arrivedNodeId: t.arrivedNodeId,
					characterVisualIdle: !0
				} : {};
			}),
			recordCharacterSettleFailure: I(({ context: e, event: t }) => {
				let n = cr(t);
				return n?.status !== "failed" || !e.activeIntent ? {} : { failure: Object.freeze({
					epoch: e.activeIntent.epoch,
					sequence: e.activeIntent.sequence,
					transactionId: e.activeIntent.transactionId,
					operationId: n.failure.command.operationId,
					attemptId: n.failure.command.attemptId,
					attempt: n.failure.command.attempt,
					kind: n.failure.kind === "force-settle-timeout" ? "character-timeout" : "character-failed",
					error: n.failure.error,
					safeNodeId: e.currentNodeId,
					planId: e.plan?.id ?? null
				}) };
			}),
			recordCharacterActorFailure: I(({ context: e, event: t }) => {
				let n = e.characterCommand ?? e.motionCommand, r = e.activeIntent;
				return !n || !r ? {} : { failure: Object.freeze({
					...lr(n),
					kind: "child-actor-failed",
					error: typeof t == "object" && t && "error" in t ? `Character settle actor failed: ${String(t.error)}` : "Character settle actor failed without an error payload.",
					safeNodeId: e.currentNodeId,
					planId: e.plan?.id ?? null
				}) };
			}),
			closeSettledTransaction: ({ context: t }) => {
				e.onTransactionSettled?.(ur(t));
			},
			notifySettled: B(({ context: e }) => ur(e)),
			notifyRejected: B(({ context: e }) => {
				if (!e.rejection) throw Error("Rejected navigation is missing rejection details.");
				return e.rejection;
			}),
			notifyRecovery: B(({ context: e }) => {
				if (!e.failure) throw Error("Failed navigation is missing failure details.");
				return {
					type: "NAVIGATION.RECOVERY.REQUESTED",
					...e.failure
				};
			}),
			closeTransaction: I(({ context: e }) => pr(e, null)),
			promoteQueuedIntent: I(({ context: e }) => e.queuedIntent ? pr(e, e.queuedIntent) : {})
		}
	}).createMachine({
		id: "navigation-workflow",
		initial: "idle",
		context: ({ input: e }) => ar(e),
		on: {
			"NAVIGATION.REQUESTED": {
				guard: "newerIntent",
				actions: "queueLatestIntent"
			},
			"ZONE.CLEANUP.COMPLETED": {
				guard: "cleanupMatches",
				actions: "markCleanupComplete"
			},
			"MOTION.VISUAL_IDLE": {
				guard: "visualIdleMatches",
				actions: "markVisualIdle"
			}
		},
		states: {
			idle: {
				tags: ["navigation-idle"],
				on: { "NAVIGATION.REQUESTED": {
					guard: "newerIntent",
					target: "planning",
					actions: "acceptIntent"
				} }
			},
			planning: {
				tags: ["navigation-busy", "navigation-planning"],
				entry: "planNavigation",
				always: [{
					guard: "hasPlan",
					target: "selectingBeforeAction"
				}, { target: "rejected" }]
			},
			selectingBeforeAction: {
				tags: ["navigation-busy", "navigation-planning"],
				always: [
					{
						guard: "hasBeforeAction",
						target: "beforeBridge"
					},
					{
						guard: "hasStages",
						target: "issuingMotion"
					},
					{ target: "selectingSettle" }
				]
			},
			beforeBridge: {
				tags: ["navigation-busy", "navigation-before-bridge"],
				entry: "issueBeforePresentation",
				on: {
					"PRESENTATION.SETTLED": {
						guard: "presentationAckMatches",
						target: "selectingBeforeAction",
						actions: "commitBeforePresentation"
					},
					"PRESENTATION.FAILED": [{
						guard: "presentationCanRetry",
						target: "beforeBridge",
						reenter: !0,
						actions: "retryPresentation"
					}, {
						guard: "presentationFailureMatches",
						target: "failed",
						actions: "recordFailure"
					}],
					"PRESENTATION.TIMED_OUT": [{
						guard: "presentationCanRetry",
						target: "beforeBridge",
						reenter: !0,
						actions: "retryPresentation"
					}, {
						guard: "presentationFailureMatches",
						target: "failed",
						actions: "recordFailure"
					}]
				}
			},
			issuingMotion: {
				tags: ["navigation-busy", "navigation-moving"],
				entry: "issueMotion",
				always: [{
					guard: "shouldArmLinkedCleanup",
					target: "armingLinkedCleanup"
				}, { target: "moving" }]
			},
			armingLinkedCleanup: {
				tags: ["navigation-busy", "navigation-moving"],
				entry: "notifyLinkedCleanup",
				always: "moving"
			},
			moving: {
				tags: ["navigation-busy", "navigation-moving"],
				on: {
					"MOTION.DEPARTED": {
						guard: "motionAckMatches",
						actions: "commitStageStarted"
					},
					"MOTION.ARRIVED": {
						guard: "arrivalMatches",
						target: "selectingAfterAction",
						actions: ["commitStageStarted", "recordArrival"]
					},
					"MOTION.FAILED": {
						guard: "motionFailureMatches",
						target: "failed",
						actions: "recordFailure"
					},
					"MOTION.TIMED_OUT": {
						guard: "motionFailureMatches",
						target: "failed",
						actions: "recordFailure"
					}
				}
			},
			selectingAfterAction: {
				tags: ["navigation-busy", "navigation-after-arrival"],
				always: [{
					guard: "hasAfterAction",
					target: "afterArrivalBridge"
				}, { target: "completingStage" }]
			},
			afterArrivalBridge: {
				tags: ["navigation-busy", "navigation-after-arrival"],
				entry: "issueAfterPresentation",
				on: {
					"PRESENTATION.SETTLED": {
						guard: "presentationAckMatches",
						target: "selectingAfterAction",
						actions: "commitAfterPresentation"
					},
					"PRESENTATION.FAILED": [{
						guard: "presentationCanRetry",
						target: "afterArrivalBridge",
						reenter: !0,
						actions: "retryPresentation"
					}, {
						guard: "presentationFailureMatches",
						target: "failed",
						actions: "recordFailure"
					}],
					"PRESENTATION.TIMED_OUT": [{
						guard: "presentationCanRetry",
						target: "afterArrivalBridge",
						reenter: !0,
						actions: "retryPresentation"
					}, {
						guard: "presentationFailureMatches",
						target: "failed",
						actions: "recordFailure"
					}]
				}
			},
			completingStage: {
				tags: ["navigation-busy", "navigation-after-arrival"],
				entry: "completeStage",
				always: [{
					guard: "hasMoreStages",
					target: "selectingBeforeAction"
				}, { target: "selectingSettle" }]
			},
			selectingSettle: {
				tags: ["navigation-busy", "navigation-awaiting-settle"],
				always: [{
					guard: "characterAlreadyIdle",
					target: "settleBarrier"
				}, { target: "awaitingCharacterSettle" }]
			},
			awaitingCharacterSettle: {
				tags: ["navigation-busy", "navigation-awaiting-settle"],
				invoke: {
					id: "characterSettleWorkflow",
					src: "characterSettleWorkflow",
					input: ({ context: e }) => {
						if (!e.motionCommand || !e.arrivedNodeId || !e.activeIntent) throw Error("Character settle requires a correlated final motion arrival.");
						return {
							motionToken: e.motionCommand.token,
							transactionId: e.activeIntent.transactionId,
							motionOperationId: e.motionCommand.operationId,
							motionAttempt: e.motionCommand.attempt,
							arrivedNodeId: e.arrivedNodeId
						};
					},
					onSnapshot: { actions: "dispatchCharacterSettleCommand" },
					onDone: [{
						guard: "characterSettleSucceeded",
						target: "settleBarrier",
						actions: "completeCharacterSettle"
					}, {
						target: "failed",
						actions: "recordCharacterSettleFailure"
					}],
					onError: {
						target: "failed",
						actions: "recordCharacterActorFailure"
					}
				},
				on: {
					"MOTION.VISUAL_IDLE": {
						guard: "visualIdleMatches",
						actions: ["markVisualIdle", "forwardVisualIdleToCharacter"]
					},
					"CHARACTER.SETTLED": {
						guard: "characterAckMatches",
						actions: "forwardCharacterAck"
					},
					"CHARACTER.FAILED": {
						guard: "characterAckMatches",
						actions: "forwardCharacterAck"
					}
				}
			},
			settleBarrier: {
				tags: ["navigation-busy", "navigation-awaiting-settle"],
				always: {
					guard: "cleanupComplete",
					target: "completed"
				},
				on: { "ZONE.CLEANUP.COMPLETED": {
					guard: "cleanupMatches",
					target: "completed",
					actions: "markCleanupComplete"
				} }
			},
			completed: {
				tags: ["navigation-busy"],
				entry: ["closeSettledTransaction", "notifySettled"],
				always: [{
					guard: "hasQueuedIntent",
					target: "planning",
					actions: "promoteQueuedIntent"
				}, {
					target: "idle",
					actions: "closeTransaction"
				}]
			},
			rejected: {
				entry: "notifyRejected",
				always: [{
					guard: "hasQueuedIntent",
					target: "planning",
					actions: "promoteQueuedIntent"
				}, {
					target: "idle",
					actions: "closeTransaction"
				}]
			},
			failed: {
				tags: ["navigation-failed"],
				entry: "notifyRecovery"
			}
		}
	});
}
//#endregion
//#region src/workflows/navigation/selectors.ts
function hr(e) {
	return e.matches("idle") ? "idle" : e.matches("beforeBridge") ? "before-bridge" : e.matches("issuingMotion") || e.matches("armingLinkedCleanup") || e.matches("moving") ? "moving" : e.matches("selectingAfterAction") || e.matches("afterArrivalBridge") || e.matches("completingStage") ? "after-arrival-bridge" : e.matches("awaitingCharacterSettle") || e.matches("selectingSettle") ? "awaiting-character-settle" : e.matches("settleBarrier") ? "awaiting-linked-cleanup" : e.matches("failed") ? "failed" : "planning";
}
function gr(e) {
	let t = e.context;
	return Object.freeze({
		phase: hr(e),
		epoch: t.lifecycle.epoch,
		latestSequence: t.latestSequence,
		currentNodeId: t.currentNodeId,
		activeTargetNodeId: t.activeIntent?.targetNodeId ?? null,
		queuedTargetNodeId: t.queuedIntent?.targetNodeId ?? null,
		planId: t.plan?.id ?? null,
		stageIndex: t.stageIndex,
		beforeActionIndex: t.beforeActionIndex,
		afterActionIndex: t.afterActionIndex,
		command: t.presentationCommand ?? t.characterCommand ?? t.motionCommand,
		characterVisualIdle: t.characterVisualIdle,
		linkedCleanupComplete: t.linkedCleanupComplete,
		failure: t.failure
	});
}
//#endregion
//#region src/workflows/zone-session/machine.ts
var _r = 2;
function vr(e, t) {
	return t.type === "PRESENTATION.SETTLED" && t.token === e;
}
function Z(e, t, n) {
	return (n.type === "PRESENTATION.FAILED" || n.type === "PRESENTATION.TIMED_OUT") && e !== null && n.token === e && n.operationId === e.replace(/:attempt:\d+$/u, "") && n.transactionId === t;
}
function yr(e) {
	return {
		initialStatus: e.initialStatus,
		revealPlan: null,
		revealBeforeActionIndex: 0,
		revealStepIndex: 0,
		revealCommandToken: null,
		revealCommandAttempt: 1,
		dismissPlan: null,
		dismissStepIndex: 0,
		dismissCommandToken: null,
		dismissCommandAttempt: 1,
		linkedNavigationPlanId: null,
		linkedNavigationTransactionId: null,
		linkedMotionToken: null
	};
}
function br(e) {
	return H({
		types: {},
		guards: {
			initiallyActive: ({ context: e }) => e.initialStatus === "active",
			hasRevealPlan: ({ context: e }) => e.revealPlan !== null,
			hasRevealBeforeAction: ({ context: e }) => e.revealPlan !== null && e.revealBeforeActionIndex < e.revealPlan.beforeRevealBridgeActions.length,
			hasRevealStep: ({ context: e }) => e.revealPlan !== null && e.revealStepIndex < e.revealPlan.steps.length,
			hasDismissPlan: ({ context: e }) => e.dismissPlan !== null,
			hasDismissStep: ({ context: e }) => e.dismissPlan !== null && e.dismissStepIndex < e.dismissPlan.steps.length,
			hasLinkedNavigation: ({ context: e }) => e.linkedNavigationPlanId !== null && e.dismissPlan?.linkedNavigationPlanId === e.linkedNavigationPlanId,
			hasStandaloneDismiss: ({ context: e }) => e.dismissPlan !== null && e.dismissPlan.linkedNavigationPlanId === null,
			revealSettledMatches: ({ context: e, event: t }) => vr(e.revealCommandToken, t),
			revealCanRetry: ({ context: e, event: t }) => Z(e.revealCommandToken, e.revealPlan?.id ?? null, t) && e.revealCommandAttempt < _r,
			revealFailureMatches: ({ context: e, event: t }) => Z(e.revealCommandToken, e.revealPlan?.id ?? null, t),
			dismissSettledMatches: ({ context: e, event: t }) => vr(e.dismissCommandToken, t),
			dismissCanRetry: ({ context: e, event: t }) => Z(e.dismissCommandToken, e.linkedNavigationTransactionId ?? e.dismissPlan?.linkedNavigationPlanId ?? e.dismissPlan?.id ?? null, t) && e.dismissCommandAttempt < _r,
			dismissFailureMatches: ({ context: e, event: t }) => Z(e.dismissCommandToken, e.linkedNavigationTransactionId ?? e.dismissPlan?.linkedNavigationPlanId ?? e.dismissPlan?.id ?? null, t),
			linkedDepartureMatches: ({ context: e, event: t }) => t.type === "MOTION.DEPARTED" && e.dismissPlan !== null && e.linkedNavigationPlanId !== null && e.dismissPlan.linkedNavigationPlanId === e.linkedNavigationPlanId && t.token === e.linkedMotionToken
		},
		actions: {
			planReveal: I(({ event: t }) => t.type === "ZONE.REVEAL.REQUESTED" ? {
				revealPlan: e.planReveal(t.nodeId),
				revealBeforeActionIndex: 0,
				revealStepIndex: 0,
				revealCommandToken: null,
				revealCommandAttempt: 1
			} : {}),
			planDismiss: I(({ event: t }) => t.type === "ZONE.DISMISS.REQUESTED" ? {
				dismissPlan: e.planDismiss(t.nodeId),
				dismissStepIndex: 0,
				dismissCommandToken: null,
				dismissCommandAttempt: 1,
				linkedNavigationPlanId: null,
				linkedNavigationTransactionId: null,
				linkedMotionToken: null
			} : {}),
			armLinkedDismiss: I(({ event: e }) => e.type === "ZONE.LINKED_DISMISS.ARMED" ? {
				dismissPlan: e.plan,
				dismissStepIndex: 0,
				dismissCommandToken: null,
				dismissCommandAttempt: 1,
				linkedNavigationPlanId: e.navigationPlanId,
				linkedNavigationTransactionId: e.navigationTransactionId,
				linkedMotionToken: e.motionToken
			} : {}),
			issueRevealBefore: V(({ context: t, enqueue: n }) => {
				let r = t.revealPlan, i = r?.beforeRevealBridgeActions[t.revealBeforeActionIndex];
				if (!r || !i) return;
				let a = Tn(xn(r.id, t.revealBeforeActionIndex), t.revealCommandAttempt, "zone-reveal-before", r.id, t.revealBeforeActionIndex, i);
				n.assign({ revealCommandToken: a.token }), n(() => e.executePresentation(a));
			}),
			commitRevealBefore: I(({ context: t }) => {
				let n = t.revealPlan;
				return n ? (e.commitRevealBeforeAction(n.id, t.revealBeforeActionIndex), {
					revealBeforeActionIndex: t.revealBeforeActionIndex + 1,
					revealCommandToken: null,
					revealCommandAttempt: 1
				}) : {};
			}),
			issueRevealStep: V(({ context: t, enqueue: n }) => {
				if (!t.revealPlan) return;
				let r = En(t.revealPlan, t.revealStepIndex, t.revealCommandAttempt);
				n.assign({ revealCommandToken: r.token }), n(() => e.executePresentation(r));
			}),
			commitRevealStep: I(({ context: t }) => t.revealPlan ? (e.commitRevealStep(t.revealPlan.id, t.revealStepIndex), {
				revealStepIndex: t.revealStepIndex + 1,
				revealCommandToken: null,
				revealCommandAttempt: 1
			}) : {}),
			finishReveal: I({
				revealPlan: null,
				revealBeforeActionIndex: 0,
				revealStepIndex: 0,
				revealCommandToken: null,
				revealCommandAttempt: 1
			}),
			notifyStandaloneRevealSettled: ({ context: t }) => {
				t.revealPlan && e.onStandaloneTransactionSettled?.(Object.freeze({
					transactionId: t.revealPlan.id,
					kind: "reveal"
				}));
			},
			issueDismissStep: V(({ context: t, enqueue: n }) => {
				if (!t.dismissPlan) return;
				let r = Dn(t.dismissPlan, t.dismissStepIndex, t.dismissCommandAttempt, t.linkedNavigationTransactionId);
				n.assign({ dismissCommandToken: r.token }), n(() => e.executePresentation(r));
			}),
			commitDismissStep: I(({ context: t }) => t.dismissPlan ? (e.commitDismissStep(t.dismissPlan.id, t.dismissStepIndex), {
				dismissStepIndex: t.dismissStepIndex + 1,
				dismissCommandToken: null,
				dismissCommandAttempt: 1
			}) : {}),
			finishDismiss: I({
				dismissPlan: null,
				dismissStepIndex: 0,
				dismissCommandToken: null,
				dismissCommandAttempt: 1,
				linkedNavigationPlanId: null,
				linkedNavigationTransactionId: null,
				linkedMotionToken: null
			}),
			notifyStandaloneDismissSettled: ({ context: t }) => {
				let n = t.dismissPlan;
				!n || n.linkedNavigationPlanId !== null || e.onStandaloneTransactionSettled?.(Object.freeze({
					transactionId: n.id,
					kind: "dismiss"
				}));
			},
			retryReveal: V(({ context: t, event: n, enqueue: r }) => {
				if (!Z(t.revealCommandToken, t.revealPlan?.id ?? null, n)) return;
				let i = t.revealCommandAttempt + 1;
				r.assign({
					revealCommandAttempt: i,
					revealCommandToken: null
				}), r(() => e.onOperationRetry?.(Object.freeze({
					transactionId: n.transactionId,
					operationId: n.operationId,
					failedAttemptId: n.token,
					nextAttempt: i,
					reason: n.error
				})));
			}),
			retryDismiss: V(({ context: t, event: n, enqueue: r }) => {
				let i = t.linkedNavigationTransactionId ?? t.dismissPlan?.linkedNavigationPlanId ?? t.dismissPlan?.id ?? null;
				if (!Z(t.dismissCommandToken, i, n)) return;
				let a = t.dismissCommandAttempt + 1;
				r.assign({
					dismissCommandAttempt: a,
					dismissCommandToken: null
				}), r(() => e.onOperationRetry?.(Object.freeze({
					transactionId: n.transactionId,
					operationId: n.operationId,
					failedAttemptId: n.token,
					nextAttempt: a,
					reason: n.error
				})));
			}),
			notifyFailure: B(({ event: e }) => ({
				type: "ORCHESTRATION.ZONE.RECOVERY.REQUESTED",
				failure: e
			})),
			notifyCleanupComplete: B(({ context: e }) => ({
				type: "ORCHESTRATION.CLEANUP.COMPLETE",
				navigationPlanId: e.linkedNavigationPlanId
			}))
		}
	}).createMachine({
		id: "zone-session",
		initial: "initializing",
		context: ({ input: e }) => yr(e),
		states: {
			initializing: { always: [{
				guard: "initiallyActive",
				target: "active"
			}, { target: "inactive" }] },
			inactive: { on: {
				"ZONE.REVEAL.REQUESTED": { target: "planningRevealFromInactive" },
				"ZONE.DISMISS.REQUESTED": { target: "planningDismissFromInactive" },
				"ZONE.LINKED_DISMISS.ARMED": { actions: "armLinkedDismiss" },
				"MOTION.DEPARTED": {
					guard: "linkedDepartureMatches",
					target: "selectingDismissStep"
				}
			} },
			planningRevealFromInactive: {
				entry: "planReveal",
				always: [{
					guard: "hasRevealPlan",
					target: "selectingRevealBeforeAction"
				}, { target: "inactive" }]
			},
			planningRevealFromActive: {
				entry: "planReveal",
				always: [{
					guard: "hasRevealPlan",
					target: "selectingRevealBeforeAction"
				}, { target: "active" }]
			},
			selectingRevealBeforeAction: { always: [{
				guard: "hasRevealBeforeAction",
				target: "revealBeforeBridge"
			}, { target: "selectingRevealStep" }] },
			revealBeforeBridge: {
				entry: "issueRevealBefore",
				on: {
					"PRESENTATION.SETTLED": {
						guard: "revealSettledMatches",
						target: "selectingRevealBeforeAction",
						actions: "commitRevealBefore"
					},
					"PRESENTATION.FAILED": [{
						guard: "revealCanRetry",
						target: "revealBeforeBridge",
						reenter: !0,
						actions: "retryReveal"
					}, {
						guard: "revealFailureMatches",
						target: "failed",
						actions: "notifyFailure"
					}],
					"PRESENTATION.TIMED_OUT": [{
						guard: "revealCanRetry",
						target: "revealBeforeBridge",
						reenter: !0,
						actions: "retryReveal"
					}, {
						guard: "revealFailureMatches",
						target: "failed",
						actions: "notifyFailure"
					}]
				}
			},
			selectingRevealStep: { always: [{
				guard: "hasRevealStep",
				target: "revealing"
			}, {
				target: "active",
				actions: ["notifyStandaloneRevealSettled", "finishReveal"]
			}] },
			revealing: {
				entry: "issueRevealStep",
				on: {
					"PRESENTATION.SETTLED": {
						guard: "revealSettledMatches",
						target: "selectingRevealStep",
						actions: "commitRevealStep"
					},
					"PRESENTATION.FAILED": [{
						guard: "revealCanRetry",
						target: "revealing",
						reenter: !0,
						actions: "retryReveal"
					}, {
						guard: "revealFailureMatches",
						target: "failed",
						actions: "notifyFailure"
					}],
					"PRESENTATION.TIMED_OUT": [{
						guard: "revealCanRetry",
						target: "revealing",
						reenter: !0,
						actions: "retryReveal"
					}, {
						guard: "revealFailureMatches",
						target: "failed",
						actions: "notifyFailure"
					}]
				}
			},
			active: { on: {
				"ZONE.REVEAL.REQUESTED": { target: "planningRevealFromActive" },
				"ZONE.DISMISS.REQUESTED": { target: "planningDismissFromActive" },
				"ZONE.LINKED_DISMISS.ARMED": { actions: "armLinkedDismiss" },
				"MOTION.DEPARTED": {
					guard: "linkedDepartureMatches",
					target: "selectingDismissStep"
				}
			} },
			planningDismissFromInactive: {
				entry: "planDismiss",
				always: [{
					guard: "hasDismissPlan",
					target: "selectingDismissStep"
				}, { target: "inactive" }]
			},
			planningDismissFromActive: {
				entry: "planDismiss",
				always: [{
					guard: "hasDismissPlan",
					target: "selectingDismissStep"
				}, { target: "active" }]
			},
			selectingDismissStep: { always: [
				{
					guard: "hasDismissStep",
					target: "dismissing"
				},
				{
					guard: "hasLinkedNavigation",
					target: "inactive",
					actions: ["notifyCleanupComplete", "finishDismiss"]
				},
				{
					guard: "hasStandaloneDismiss",
					target: "inactive",
					actions: ["notifyStandaloneDismissSettled", "finishDismiss"]
				},
				{
					target: "inactive",
					actions: "finishDismiss"
				}
			] },
			dismissing: {
				entry: "issueDismissStep",
				on: {
					"PRESENTATION.SETTLED": {
						guard: "dismissSettledMatches",
						target: "selectingDismissStep",
						actions: "commitDismissStep"
					},
					"PRESENTATION.FAILED": [{
						guard: "dismissCanRetry",
						target: "dismissing",
						reenter: !0,
						actions: "retryDismiss"
					}, {
						guard: "dismissFailureMatches",
						target: "failed",
						actions: "notifyFailure"
					}],
					"PRESENTATION.TIMED_OUT": [{
						guard: "dismissCanRetry",
						target: "dismissing",
						reenter: !0,
						actions: "retryDismiss"
					}, {
						guard: "dismissFailureMatches",
						target: "failed",
						actions: "notifyFailure"
					}]
				}
			},
			failed: {}
		}
	});
}
//#endregion
//#region src/workflows/zone-session/selectors.ts
var xr = /* @__PURE__ */ new Set([
	"planningRevealFromInactive",
	"planningRevealFromActive",
	"selectingRevealBeforeAction",
	"revealBeforeBridge",
	"selectingRevealStep",
	"revealing",
	"planningDismissFromInactive",
	"planningDismissFromActive",
	"selectingDismissStep",
	"dismissing",
	"failed"
]);
function Sr(e) {
	let t = e.value;
	return Object.freeze({
		phase: t,
		transitionActive: xr.has(t),
		revealPlan: e.context.revealPlan,
		revealBeforeActionIndex: e.context.revealBeforeActionIndex,
		revealStepIndex: e.context.revealStepIndex,
		revealCommandToken: e.context.revealCommandToken,
		revealCommandAttempt: e.context.revealCommandAttempt,
		dismissPlan: e.context.dismissPlan,
		dismissStepIndex: e.context.dismissStepIndex,
		dismissCommandToken: e.context.dismissCommandToken,
		dismissCommandAttempt: e.context.dismissCommandAttempt
	});
}
//#endregion
//#region src/statecharts/orchestration/setup.ts
function Cr(e) {
	return typeof e != "object" || !e || !("snapshot" in e) ? null : e.snapshot;
}
function wr(e) {
	return typeof e != "object" || !e || !("output" in e) ? null : e.output ?? null;
}
function Tr(e) {
	return typeof e != "object" || !e || !("snapshot" in e) ? null : e.snapshot;
}
function Er(e) {
	return typeof e != "object" || !e || !("snapshot" in e) ? null : e.snapshot;
}
function Dr(e) {
	return `${e.navigationEpochBase}:epoch:${e.navigationEpochRevision}`;
}
function Q(e, t) {
	if (e === null || !("token" in t) || !("transactionId" in t) || !("operationId" in t) || !("attemptId" in t) || !("attempt" in t)) return !1;
	let n = e.type === "CHARACTER.FORCE_SETTLE" ? e.attemptId : e.token;
	return t.token === n && t.transactionId === e.transactionId && t.operationId === e.operationId && t.attemptId === e.attemptId && t.attempt === e.attempt;
}
function Or(e) {
	return e.type === "PRESENTATION.SETTLED" || e.type === "PRESENTATION.FAILED" || e.type === "PRESENTATION.TIMED_OUT" || e.type === "MOTION.DEPARTED" || e.type === "MOTION.ARRIVED" || e.type === "MOTION.VISUAL_IDLE" || e.type === "MOTION.FAILED" || e.type === "MOTION.TIMED_OUT" || e.type === "CHARACTER.SETTLED" || e.type === "CHARACTER.FAILED";
}
function kr(e) {
	let t = [], n = e.zoneRevealPlan;
	if (n) {
		let r = n.beforeRevealBridgeActions[e.zoneRevealBeforeActionIndex];
		if (r) {
			let i = xn(n.id, e.zoneRevealBeforeActionIndex);
			t.push(Tn(i, e.zoneRevealCommandAttempt, "zone-reveal-before", n.id, e.zoneRevealBeforeActionIndex, r));
		}
		n.steps[e.zoneRevealStepIndex] && t.push(En(n, e.zoneRevealStepIndex, e.zoneRevealCommandAttempt));
	}
	let r = e.zoneDismissPlan;
	return r?.steps[e.zoneDismissStepIndex] && t.push(Dn(r, e.zoneDismissStepIndex, e.zoneDismissCommandAttempt, r.linkedNavigationPlanId ? e.navigationLinkedCleanupCorrelation?.transactionId : null)), t;
}
function Ar(e, t) {
	return t.type !== "PRESENTATION.SETTLED" && t.type !== "PRESENTATION.FAILED" && t.type !== "PRESENTATION.TIMED_OUT" ? !1 : kr(e).some((e) => t.token === e.token && t.transactionId === e.transactionId && t.operationId === e.operationId && t.attemptId === e.attemptId && t.attempt === e.attempt);
}
function jr(e, t) {
	let n = e.navigationWorkflowCommand;
	if (!n || !Or(t) || !Q(n, t)) throw Error("Cannot forward an uncorrelated navigation gateway event.");
	let r = {
		epoch: n.epoch,
		sequence: n.sequence,
		transactionId: t.transactionId,
		operationId: t.operationId,
		attemptId: t.attemptId,
		attempt: t.attempt,
		token: t.token
	};
	switch (t.type) {
		case "PRESENTATION.SETTLED": return {
			type: t.type,
			...r
		};
		case "PRESENTATION.FAILED":
		case "PRESENTATION.TIMED_OUT": return {
			type: t.type,
			...r,
			error: t.error
		};
		case "MOTION.DEPARTED": return {
			type: t.type,
			...r,
			fromNodeId: t.fromNodeId
		};
		case "MOTION.ARRIVED":
		case "MOTION.VISUAL_IDLE": return {
			type: t.type,
			...r,
			nodeId: t.nodeId
		};
		case "MOTION.FAILED":
		case "MOTION.TIMED_OUT": return {
			type: t.type,
			...r,
			error: t.error
		};
		case "CHARACTER.SETTLED": return {
			type: t.type,
			...r
		};
		case "CHARACTER.FAILED": return {
			type: t.type,
			...r,
			error: t.error,
			timedOut: t.timedOut
		};
	}
}
function Mr(e) {
	return Object.freeze({
		recoveryId: `recovery:${e.transactionId}:${e.operationId}`,
		transactionId: e.transactionId,
		operationId: e.operationId,
		failedAttemptId: e.attemptId,
		kind: e.kind,
		error: e.error,
		safeNodeId: e.safeNodeId
	});
}
function Nr(e, t) {
	let n = t.failure, r = n.type === "PRESENTATION.TIMED_OUT" ? "presentation-timeout" : "presentation-failed";
	return Object.freeze({
		recoveryId: `recovery:${n.transactionId}:${n.operationId}`,
		transactionId: n.transactionId,
		operationId: n.operationId,
		failedAttemptId: n.token,
		kind: r,
		error: n.error,
		safeNodeId: e.currentNodeId
	});
}
function Pr(e) {
	return H({
		types: {},
		actors: {
			navigationWorkflow: mr({
				planNavigation: e.planNavigation,
				commitNavigationBeforeAction: e.commitNavigationBeforeAction,
				commitNavigationStageStarted: e.commitNavigationStageStarted,
				commitNavigationAfterAction: e.commitNavigationAfterAction,
				commitNavigationStageArrived: e.commitNavigationStageArrived,
				executePresentation: e.executePresentation,
				executeMotion: e.executeMotion,
				executeCharacterForceSettle: e.executeCharacterForceSettle,
				onOperationRetry: e.onOperationRetry,
				onTransactionSettled: e.onNavigationTransactionSettled,
				characterNaturalSettleTimeoutMs: e.characterNaturalSettleTimeoutMs,
				characterForceSettleAckTimeoutMs: e.characterForceSettleAckTimeoutMs
			}),
			recoveryWorkflow: Pn({
				commandTimeoutMs: e.recoveryCommandTimeoutMs,
				characterIdleTimeoutMs: e.recoveryCharacterIdleTimeoutMs
			}),
			zoneSessionWorkflow: br({
				planReveal: e.planZoneReveal,
				planDismiss: e.planZoneDismiss,
				commitRevealBeforeAction: e.commitZoneRevealBeforeAction,
				commitRevealStep: e.commitZoneRevealStep,
				commitDismissStep: e.commitZoneDismissStep,
				executePresentation: e.executePresentation,
				onOperationRetry: e.onOperationRetry,
				onStandaloneTransactionSettled: e.onStandaloneZoneTransactionSettled
			})
		},
		guards: {
			recoveryCompleteMatches: ({ context: e, event: t }) => t.type === "ORCHESTRATION.RECOVERY.COMPLETE" && t.recoveryId === e.recoveryRequest?.recoveryId && t.transactionId === e.recoveryRequest.transactionId,
			recoveryFailedMatches: ({ context: e, event: t }) => t.type === "ORCHESTRATION.RECOVERY.FAILED" && t.recoveryId === e.recoveryRequest?.recoveryId && t.transactionId === e.recoveryRequest.transactionId,
			canRequestZoneWork: ({ context: e }) => e.navigationWorkflowPhase === "idle" && e.characterVisualIdle,
			zonePresentationEventRelevant: ({ context: e, event: t }) => Ar(e, t),
			linkedDismissDepartureMatches: ({ context: e, event: t }) => t.type === "MOTION.DEPARTED" && Q(e.navigationWorkflowCommand, t) && e.zoneDismissPlan?.linkedNavigationPlanId === e.navigationPlan?.id,
			zoneInitiallyActive: ({ context: e }) => e.zoneInitiallyActive,
			zonePhaseMatches: ({ event: e }, t) => e.type === "ORCHESTRATION.ZONE.PHASE_CHANGED" && e.phase === t.phase,
			navigationPhaseMatches: ({ event: e }, t) => e.type === "ORCHESTRATION.NAVIGATION.PHASE_CHANGED" && e.phase === t.phase,
			canFlushPendingNavigation: ({ context: e }) => e.pendingNavigationTargetNodeId !== null && e.navigationWorkflowPhase === "idle" && !e.zoneTransitionActive && e.characterVisualIdle,
			navigationPresentationEventRelevant: ({ context: e, event: t }) => (t.type === "PRESENTATION.SETTLED" || t.type === "PRESENTATION.FAILED" || t.type === "PRESENTATION.TIMED_OUT") && e.navigationWorkflowCommand?.type === "PRESENTATION.BRIDGE" && Q(e.navigationWorkflowCommand, t),
			navigationMotionEventRelevant: ({ context: e, event: t }) => (t.type === "MOTION.DEPARTED" || t.type === "MOTION.ARRIVED" || t.type === "MOTION.VISUAL_IDLE" || t.type === "MOTION.FAILED" || t.type === "MOTION.TIMED_OUT") && e.navigationWorkflowCommand?.type === "MOTION.NAVIGATE" && Q(e.navigationWorkflowCommand, t) && (t.type !== "MOTION.DEPARTED" || t.fromNodeId === e.navigationWorkflowCommand.fromNodeId) && (t.type !== "MOTION.ARRIVED" || t.nodeId === e.navigationWorkflowCommand.toNodeId) && (t.type !== "MOTION.VISUAL_IDLE" || t.nodeId === e.arrivedNodeId),
			navigationCharacterEventRelevant: ({ context: e, event: t }) => (t.type === "CHARACTER.SETTLED" || t.type === "CHARACTER.FAILED") && e.navigationWorkflowCommand?.type === "CHARACTER.FORCE_SETTLE" && Q(e.navigationWorkflowCommand, t),
			characterReadinessCanSync: ({ context: e }) => e.navigationWorkflowPhase === "idle"
		},
		actions: {
			routeOrQueueNavigationIntent: V(({ context: e, event: t, enqueue: n }) => {
				if (t.type !== "NAVIGATION.REQUESTED") return;
				if (e.navigationWorkflowPhase === "idle" && (e.zoneTransitionActive || !e.characterVisualIdle)) {
					n.assign({
						pendingNavigationTargetNodeId: t.targetNodeId,
						queuedTargetNodeId: t.targetNodeId
					});
					return;
				}
				let r = e.navigationSequence + 1, i = Dr(e), a = Xn(i, r, `${i}:navigation:${r}`, t.targetNodeId);
				n.assign({
					navigationSequence: r,
					pendingNavigationTargetNodeId: null,
					requestedTargetNodeId: t.targetNodeId,
					queuedTargetNodeId: null
				}), n.sendTo("navigationWorkflow", {
					type: "NAVIGATION.REQUESTED",
					...a
				});
			}),
			queueLatestNavigationIntent: I(({ event: e }) => e.type === "NAVIGATION.REQUESTED" ? {
				pendingNavigationTargetNodeId: e.targetNodeId,
				queuedTargetNodeId: e.targetNodeId
			} : {}),
			flushPendingNavigationIntent: V(({ context: e, enqueue: t }) => {
				let n = e.pendingNavigationTargetNodeId;
				if (!n) return;
				let r = e.navigationSequence + 1, i = Dr(e), a = Xn(i, r, `${i}:navigation:${r}`, n);
				t.assign({
					navigationSequence: r,
					pendingNavigationTargetNodeId: null,
					requestedTargetNodeId: n,
					queuedTargetNodeId: null
				}), t.sendTo("navigationWorkflow", {
					type: "NAVIGATION.REQUESTED",
					...a
				});
			}),
			forwardNavigationGatewayEvent: z("navigationWorkflow", ({ context: e, event: t }) => jr(e, t)),
			syncNavigationSnapshot: V(({ context: e, event: t, enqueue: n }) => {
				let r = Tr(t);
				if (!r) return;
				let i = r.context, a = gr(r), o = i.presentationCommand, s = i.motionCommand?.token ?? null;
				n.assign({
					navigationWorkflowPhase: a.phase,
					navigationWorkflowCommand: a.command,
					navigationSequence: Math.max(e.navigationSequence, a.latestSequence),
					currentNodeId: a.currentNodeId,
					requestedTargetNodeId: a.activeTargetNodeId,
					queuedTargetNodeId: a.queuedTargetNodeId ?? e.pendingNavigationTargetNodeId,
					navigationPlan: i.plan,
					navigationStageIndex: i.stageIndex,
					navigationBeforeActionIndex: i.beforeActionIndex,
					navigationAfterActionIndex: i.afterActionIndex,
					navigationCommandToken: o?.token ?? null,
					navigationCommandAttempt: o?.attempt ?? 1,
					motionCommandToken: s,
					navigationStageStartedCommitted: i.stageStartedCommitted,
					arrivedNodeId: i.arrivedNodeId,
					linkedZoneCleanupComplete: i.linkedCleanupComplete,
					characterVisualIdle: i.characterVisualIdle
				}), s && s !== e.motionCommandToken && n.raise({
					type: "ORCHESTRATION.MOTION.ISSUED",
					token: s
				});
			}),
			raiseNavigationProjection: V(({ event: e, enqueue: t }) => {
				let n = Tr(e);
				n && t.raise({
					type: "ORCHESTRATION.NAVIGATION.PHASE_CHANGED",
					phase: gr(n).phase
				});
			}),
			armLinkedZoneCleanup: V(({ event: e, enqueue: t }) => {
				e.type === "NAVIGATION.LINKED_ZONE_CLEANUP.REQUESTED" && (t.assign({
					navigationLinkedCleanupCorrelation: e.completion,
					navigationLinkedCleanupPlanId: e.navigationPlanId
				}), t.sendTo("zoneSessionWorkflow", {
					type: "ZONE.LINKED_DISMISS.ARMED",
					plan: e.plan,
					navigationPlanId: e.navigationPlanId,
					navigationTransactionId: e.transactionId,
					motionToken: e.motionToken
				}));
			}),
			forwardLinkedCleanupComplete: V(({ context: e, event: t, enqueue: n }) => {
				if (t.type !== "ORCHESTRATION.CLEANUP.COMPLETE" || t.navigationPlanId !== e.navigationLinkedCleanupPlanId || e.navigationLinkedCleanupCorrelation === null) return;
				let r = e.navigationLinkedCleanupCorrelation;
				n.sendTo("navigationWorkflow", {
					type: "ZONE.CLEANUP.COMPLETED",
					navigationPlanId: t.navigationPlanId,
					...r
				}), n.assign({
					navigationLinkedCleanupCorrelation: null,
					navigationLinkedCleanupPlanId: null
				});
			}),
			notifyNavigationSettled: V(({ event: t, enqueue: n }) => {
				t.type === "NAVIGATION.SETTLED" && (n(() => e.onNavigationSettled?.(Object.freeze({
					transactionId: t.transactionId,
					planId: t.planId,
					nodeId: t.nodeId
				}))), n.assign({
					navigationLinkedCleanupCorrelation: null,
					navigationLinkedCleanupPlanId: null
				}));
			}),
			notifyNavigationRejected: V(({ event: t, enqueue: n }) => {
				if (t.type !== "NAVIGATION.REJECTED") return;
				let r = Object.freeze({
					sourceNodeId: t.sourceNodeId,
					targetNodeId: t.targetNodeId,
					reason: t.reason,
					detail: t.detail
				});
				n(() => e.onNavigationRejected?.(r)), n.assign({
					lastRejectedNavigation: r,
					requestedTargetNodeId: null
				});
			}),
			syncCharacterVisualIdle: I(({ event: e }) => e.type === "ORCHESTRATION.CHARACTER.VISUAL_IDLE_CHANGED" ? { characterVisualIdle: e.visuallyIdle } : {}),
			recordCharacterFailure: I(({ event: e }) => e.type === "ORCHESTRATION.CHARACTER.FAILED" ? {
				characterVisualIdle: !1,
				requestedTargetNodeId: null,
				pendingNavigationTargetNodeId: null,
				queuedTargetNodeId: null,
				fatalError: e.error
			} : {}),
			forwardZoneRequest: z("zoneSessionWorkflow", ({ context: e, event: t }) => {
				if (t.type === "ZONE.REVEAL.REQUESTED" || t.type === "ZONE.DISMISS.REQUESTED") return {
					type: t.type,
					nodeId: t.nodeId ?? e.currentNodeId
				};
				throw Error(`Cannot forward zone request ${t.type}.`);
			}),
			forwardZonePresentationEvent: z("zoneSessionWorkflow", ({ event: e }) => {
				if (e.type === "PRESENTATION.SETTLED") return {
					type: e.type,
					token: e.token
				};
				if (e.type === "PRESENTATION.FAILED" || e.type === "PRESENTATION.TIMED_OUT") return {
					type: e.type,
					token: e.token,
					operationId: e.operationId,
					transactionId: e.transactionId,
					error: e.error
				};
				throw Error(`Cannot forward zone presentation event ${e.type}.`);
			}),
			forwardZoneDeparture: z("zoneSessionWorkflow", ({ event: e }) => {
				if (e.type !== "MOTION.DEPARTED") throw Error(`Cannot forward zone departure ${e.type}.`);
				return {
					type: e.type,
					token: e.token,
					fromNodeId: e.fromNodeId
				};
			}),
			syncZoneSessionSnapshot: I(({ event: e }) => {
				let t = Er(e);
				if (!t) return {};
				let n = Sr(t);
				return {
					zoneRevealPlan: n.revealPlan,
					zoneRevealBeforeActionIndex: n.revealBeforeActionIndex,
					zoneRevealStepIndex: n.revealStepIndex,
					zoneRevealCommandToken: n.revealCommandToken,
					zoneRevealCommandAttempt: n.revealCommandAttempt,
					zoneDismissPlan: n.dismissPlan,
					zoneDismissStepIndex: n.dismissStepIndex,
					zoneDismissCommandToken: n.dismissCommandToken,
					zoneDismissCommandAttempt: n.dismissCommandAttempt,
					zoneTransitionActive: n.transitionActive
				};
			}),
			raiseZoneSessionProjection: V(({ event: e, enqueue: t }) => {
				let n = Er(e);
				n && t.raise({
					type: "ORCHESTRATION.ZONE.PHASE_CHANGED",
					phase: Sr(n).phase
				});
			}),
			recordNavigationRecoveryRequest: I(({ event: e }) => e.type === "NAVIGATION.RECOVERY.REQUESTED" ? {
				recoveryRequest: Mr(e),
				requestedTargetNodeId: null,
				navigationCommandToken: null,
				motionCommandToken: null,
				zoneRevealCommandToken: null,
				zoneDismissCommandToken: null,
				characterVisualIdle: !1
			} : {}),
			recordZoneRecoveryRequest: I(({ context: e, event: t }) => t.type === "ORCHESTRATION.ZONE.RECOVERY.REQUESTED" ? {
				recoveryRequest: Nr(e, t),
				requestedTargetNodeId: null,
				navigationCommandToken: null,
				motionCommandToken: null,
				zoneRevealCommandToken: null,
				zoneDismissCommandToken: null,
				characterVisualIdle: !1
			} : {}),
			notifyRecoveryStarted: ({ context: t }) => {
				t.recoveryRequest && e.onRecoveryStarted?.(t.recoveryRequest);
			},
			dispatchRecoveryCommand: ({ event: t }) => {
				let n = Cr(t), r = n ? In(n) : null;
				r && e.executeRecoveryCommand(r);
			},
			finalizeRecoveryWorkflow: ({ context: t, event: n }) => {
				let r = wr(n);
				t.recoveryRequest && r && e.finalizeRecovery(t.recoveryRequest, r);
			},
			cleanupRecoveryAdapter: ({ context: t }) => {
				t.recoveryRequest && e.cancelRecovery(t.recoveryRequest);
			},
			recordRecoveryActorFailure: I(({ event: e }) => ({
				fatalError: typeof e == "object" && e && "error" in e ? `Recovery actor failed: ${String(e.error)}` : "Recovery actor failed without an error payload.",
				characterVisualIdle: !1
			})),
			completeRecovery: I(({ context: e, event: t }) => t.type === "ORCHESTRATION.RECOVERY.COMPLETE" ? bn(e, t) : {}),
			recordRecoveryFailure: I(({ event: e }) => e.type === "ORCHESTRATION.RECOVERY.FAILED" ? {
				fatalError: e.error,
				characterVisualIdle: !1
			} : {}),
			forwardRecoveryAck: z("recoveryWorkflow", ({ event: e }) => e)
		}
	});
}
//#endregion
//#region src/statecharts/orchestration/regions/character.ts
var Fr = {
	initial: "idle",
	on: {
		"ORCHESTRATION.MOTION.ISSUED": { target: ".departing" },
		"MOTION.DEPARTED": {
			guard: "navigationMotionEventRelevant",
			target: ".running"
		},
		"MOTION.ARRIVED": {
			guard: "navigationMotionEventRelevant",
			target: ".settling"
		},
		"ORCHESTRATION.NAVIGATION.PHASE_CHANGED": [
			{
				guard: {
					type: "navigationPhaseMatches",
					params: { phase: "idle" }
				},
				target: ".idle"
			},
			{
				guard: {
					type: "navigationPhaseMatches",
					params: { phase: "awaiting-character-settle" }
				},
				target: ".settling"
			},
			{
				guard: {
					type: "navigationPhaseMatches",
					params: { phase: "awaiting-linked-cleanup" }
				},
				target: ".idle"
			}
		]
	},
	states: {
		idle: { tags: ["character-idle"] },
		departing: { tags: ["character-moving"] },
		running: { tags: ["character-moving"] },
		settling: { tags: ["character-settling"] }
	}
}, Ir = Object.freeze({
	idle: ".idle",
	planning: ".planning",
	"before-bridge": ".beforeBridge",
	moving: ".moving",
	"after-arrival-bridge": ".afterArrivalBridge",
	"awaiting-character-settle": ".awaitingSettle",
	"awaiting-linked-cleanup": ".awaitingSettle",
	failed: ".failed"
}), Lr = {
	initial: "initializing",
	invoke: {
		id: "navigationWorkflow",
		src: "navigationWorkflow",
		input: ({ context: e }) => {
			let t = `${e.navigationEpochBase}:epoch:${e.navigationEpochRevision}`, n = `${t}:child-lifecycle`;
			return {
				correlation: {
					epoch: t,
					sequence: e.navigationSequence,
					transactionId: `${t}:session`,
					operationId: n,
					attemptId: `${n}:attempt:1`,
					attempt: 1
				},
				initialNodeId: e.currentNodeId,
				initialCharacterVisualIdle: e.characterVisualIdle
			};
		},
		onSnapshot: { actions: ["syncNavigationSnapshot", "raiseNavigationProjection"] }
	},
	on: {
		"ORCHESTRATION.NAVIGATION.PHASE_CHANGED": Object.keys(Ir).map((e) => ({
			guard: {
				type: "navigationPhaseMatches",
				params: { phase: e }
			},
			target: Ir[e]
		})),
		"NAVIGATION.REQUESTED": { actions: "routeOrQueueNavigationIntent" },
		"PRESENTATION.SETTLED": {
			guard: "navigationPresentationEventRelevant",
			actions: "forwardNavigationGatewayEvent"
		},
		"PRESENTATION.FAILED": {
			guard: "navigationPresentationEventRelevant",
			actions: "forwardNavigationGatewayEvent"
		},
		"PRESENTATION.TIMED_OUT": {
			guard: "navigationPresentationEventRelevant",
			actions: "forwardNavigationGatewayEvent"
		},
		"MOTION.DEPARTED": {
			guard: "navigationMotionEventRelevant",
			actions: "forwardNavigationGatewayEvent"
		},
		"MOTION.ARRIVED": {
			guard: "navigationMotionEventRelevant",
			actions: "forwardNavigationGatewayEvent"
		},
		"MOTION.VISUAL_IDLE": {
			guard: "navigationMotionEventRelevant",
			actions: "forwardNavigationGatewayEvent"
		},
		"MOTION.FAILED": {
			guard: "navigationMotionEventRelevant",
			actions: "forwardNavigationGatewayEvent"
		},
		"MOTION.TIMED_OUT": {
			guard: "navigationMotionEventRelevant",
			actions: "forwardNavigationGatewayEvent"
		},
		"CHARACTER.SETTLED": {
			guard: "navigationCharacterEventRelevant",
			actions: "forwardNavigationGatewayEvent"
		},
		"CHARACTER.FAILED": {
			guard: "navigationCharacterEventRelevant",
			actions: "forwardNavigationGatewayEvent"
		},
		"NAVIGATION.LINKED_ZONE_CLEANUP.REQUESTED": { actions: "armLinkedZoneCleanup" },
		"NAVIGATION.SETTLED": { actions: "notifyNavigationSettled" },
		"NAVIGATION.REJECTED": { actions: "notifyNavigationRejected" }
	},
	states: {
		initializing: {},
		idle: {
			tags: ["navigation-idle"],
			always: {
				guard: "canFlushPendingNavigation",
				actions: "flushPendingNavigationIntent"
			}
		},
		planning: { tags: ["navigation-busy", "navigation-planning"] },
		selectingBeforeAction: { tags: ["navigation-busy", "navigation-planning"] },
		beforeBridge: { tags: ["navigation-busy", "navigation-before-bridge"] },
		moving: { tags: ["navigation-busy", "navigation-moving"] },
		selectingAfterAction: { tags: ["navigation-busy", "navigation-after-arrival"] },
		afterArrivalBridge: { tags: ["navigation-busy", "navigation-after-arrival"] },
		completingStage: { tags: ["navigation-busy", "navigation-after-arrival"] },
		awaitingSettle: { tags: ["navigation-busy", "navigation-awaiting-settle"] },
		failed: { tags: ["navigation-failed"] }
	}
}, Rr = {
	initial: "initializing",
	invoke: {
		id: "zoneSessionWorkflow",
		src: "zoneSessionWorkflow",
		input: ({ context: e }) => ({ initialStatus: e.zoneInitiallyActive ? "active" : "inactive" }),
		onSnapshot: { actions: ["syncZoneSessionSnapshot", "raiseZoneSessionProjection"] }
	},
	on: {
		"ORCHESTRATION.ZONE.PHASE_CHANGED": [
			"inactive",
			"planningRevealFromInactive",
			"planningRevealFromActive",
			"selectingRevealBeforeAction",
			"revealBeforeBridge",
			"selectingRevealStep",
			"revealing",
			"active",
			"planningDismissFromInactive",
			"planningDismissFromActive",
			"selectingDismissStep",
			"dismissing"
		].map((e) => ({
			guard: {
				type: "zonePhaseMatches",
				params: { phase: e }
			},
			target: `.${e}`
		})),
		"ZONE.REVEAL.REQUESTED": {
			guard: "canRequestZoneWork",
			actions: "forwardZoneRequest"
		},
		"ZONE.DISMISS.REQUESTED": {
			guard: "canRequestZoneWork",
			actions: "forwardZoneRequest"
		},
		"PRESENTATION.SETTLED": {
			guard: "zonePresentationEventRelevant",
			actions: "forwardZonePresentationEvent"
		},
		"PRESENTATION.FAILED": {
			guard: "zonePresentationEventRelevant",
			actions: "forwardZonePresentationEvent"
		},
		"PRESENTATION.TIMED_OUT": {
			guard: "zonePresentationEventRelevant",
			actions: "forwardZonePresentationEvent"
		},
		"MOTION.DEPARTED": {
			guard: "linkedDismissDepartureMatches",
			actions: "forwardZoneDeparture"
		}
	},
	states: {
		initializing: {},
		inactive: { tags: ["zone-inactive"] },
		planningRevealFromInactive: { tags: ["zone-transitional", "zone-revealing"] },
		planningRevealFromActive: { tags: ["zone-transitional", "zone-revealing"] },
		selectingRevealBeforeAction: { tags: ["zone-transitional", "zone-revealing"] },
		revealBeforeBridge: { tags: ["zone-transitional", "zone-revealing"] },
		selectingRevealStep: { tags: ["zone-transitional", "zone-revealing"] },
		revealing: { tags: ["zone-transitional", "zone-revealing"] },
		active: { tags: ["zone-active"] },
		planningDismissFromInactive: { tags: ["zone-transitional", "zone-dismissing"] },
		planningDismissFromActive: { tags: ["zone-transitional", "zone-dismissing"] },
		selectingDismissStep: { tags: ["zone-transitional", "zone-dismissing"] },
		dismissing: { tags: ["zone-transitional", "zone-dismissing"] }
	}
};
//#endregion
//#region src/statecharts/orchestration/machine.ts
function zr(e) {
	return Pr(e).createMachine({
		id: "learning-path-orchestration",
		initial: "live",
		context: ({ input: e }) => yn(e),
		states: {
			live: {
				type: "parallel",
				on: {
					"ORCHESTRATION.CLEANUP.COMPLETE": { actions: "forwardLinkedCleanupComplete" },
					"ORCHESTRATION.CHARACTER.VISUAL_IDLE_CHANGED": {
						guard: "characterReadinessCanSync",
						actions: "syncCharacterVisualIdle"
					},
					"NAVIGATION.RECOVERY.REQUESTED": {
						target: "#learning-path-orchestration.recovering",
						actions: "recordNavigationRecoveryRequest"
					},
					"ORCHESTRATION.CHARACTER.FAILED": {
						target: "#learning-path-orchestration.degraded",
						actions: "recordCharacterFailure"
					},
					"ORCHESTRATION.ZONE.RECOVERY.REQUESTED": {
						target: "#learning-path-orchestration.recovering",
						actions: "recordZoneRecoveryRequest"
					}
				},
				states: {
					navigation: Lr,
					zoneSession: Rr,
					character: Fr
				}
			},
			recovering: {
				id: "recovering",
				tags: ["orchestration-recovering"],
				entry: "notifyRecoveryStarted",
				exit: "cleanupRecoveryAdapter",
				invoke: {
					id: "recoveryWorkflow",
					src: "recoveryWorkflow",
					input: ({ context: t }) => {
						if (!t.recoveryRequest) throw Error("Recovery state requires a recovery request.");
						return e.prepareRecoveryInput(t.recoveryRequest);
					},
					onSnapshot: { actions: "dispatchRecoveryCommand" },
					onDone: { actions: "finalizeRecoveryWorkflow" },
					onError: {
						target: "degraded",
						actions: "recordRecoveryActorFailure"
					}
				},
				on: {
					"RECOVERY.COMMAND.SUCCEEDED": { actions: "forwardRecoveryAck" },
					"RECOVERY.COMMAND.FAILED": { actions: "forwardRecoveryAck" },
					"NAVIGATION.REQUESTED": { actions: "queueLatestNavigationIntent" },
					"ORCHESTRATION.RECOVERY.COMPLETE": {
						guard: "recoveryCompleteMatches",
						target: "live",
						actions: "completeRecovery"
					},
					"ORCHESTRATION.RECOVERY.FAILED": {
						guard: "recoveryFailedMatches",
						target: "degraded",
						actions: "recordRecoveryFailure"
					}
				}
			},
			degraded: {
				id: "degraded",
				tags: ["orchestration-degraded"]
			}
		}
	});
}
//#endregion
//#region src/config/overpassSpec.ts
var Br = 1.9, Vr = .615, Hr = .9, Ur = .22, Wr = .08, Gr = 2.3, Kr = .523, qr = .026, Jr = 1e-6, Yr = 1 / .7850000000000001, Xr = Object.freeze({
	curveStyle: "symmetric-eased-arch",
	width: .64,
	deckThickness: .18,
	platformEdgeOffset: Vr,
	maximumSurfacePitchDegrees: 48,
	routingCost: .25,
	requiredClearance: 3.23
}), Zr = Object.freeze({
	...Xr,
	straightApproachLength: Hr,
	bridgeSurfaceY: Br,
	minimumChordLength: $r(48)
});
function Qr(e, t = Kr) {
	$(e, "Bridge chord length"), $(t, "Bridge endpoint surface height");
	let n = e / 2 - Vr, r = ni(47), i = n - 1.8739999999999999 * Yr / Math.tan(r), a = i >= .22 ? Math.min(Hr, i) : Ur, o = n - a;
	if (o <= Jr) throw Error(`Bridge chord ${e.toFixed(4)}m is too short for its platform rims and approaches.`);
	let s = o * Math.tan(r) / Yr, c = t + Wr - qr;
	if (s + Jr < c) throw Error(`Bridge chord ${e.toFixed(4)}m cannot rise above its ${t.toFixed(4)}m endpoint surface without exceeding 48°.`);
	let l = Math.min(Br, qr + s), u = l - qr, d = Math.min(o, Gr), f = ri(Math.atan(u * Yr / d));
	if (f > 48.000001) throw Error(`Adaptive bridge pitch ${f.toFixed(4)}° exceeds the 48° contract.`);
	return Object.freeze({
		bridge: Object.freeze({
			...Xr,
			straightApproachLength: a,
			bridgeSurfaceY: l,
			minimumChordLength: ei(l, a, 48)
		}),
		chordLength: e,
		curveHalfRun: o,
		predictedMaximumSurfacePitchDegrees: f,
		approachWasShortened: a < .899999,
		crownWasLowered: l < 1.899999
	});
}
function $r(e) {
	return ei(Br, Hr, e);
}
function ei(e, t, n) {
	$(e, "Bridge crown height"), $(t, "Bridge approach length"), ti(n);
	let r = e - qr;
	if (r <= 0) throw Error("Bridge crown must be above the straight-road surface.");
	let i = r * Yr / Math.tan(ni(n));
	return 2 * (Vr + t + i);
}
function $(e, t) {
	if (!Number.isFinite(e) || e <= 0) throw Error(`${t} must be positive and finite.`);
}
function ti(e) {
	if (!Number.isFinite(e) || e <= 0 || e >= 90) throw Error("Bridge pitch must be finite and between 0° and 90°.");
}
function ni(e) {
	return e * Math.PI / 180;
}
function ri(e) {
	return e * 180 / Math.PI;
}
//#endregion
export { Sr as a, gn as c, z as d, I as f, x as g, jt as h, zr as i, H as l, It as m, Zr as n, gr as o, Nt as p, Qr as r, hr as s, Gr as t, V as u };

//# sourceMappingURL=overpassSpec-CjJGXqVE.js.map