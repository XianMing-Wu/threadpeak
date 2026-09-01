import { c as e, d as t, f as n, g as r, h as i, i as a, l as o, m as s, p as c, r as l, u } from "./overpassSpec-3Tu8NqTy.js";
//#region src/content/types.ts
var d = "learning-path", f = Object.freeze({
	maxSubjects: 128,
	maxConcepts: 1024,
	maxConceptsPerSubject: 32,
	maxFlowEdges: 2048,
	maxFlowGroups: 256,
	maxCards: 1152,
	maxActions: 1024,
	maxResources: 1024,
	maxIdLength: 64,
	maxShortTextLength: 160,
	maxSummaryLength: 500,
	maxBodyLength: 4e3,
	maxUrlLength: 2048,
	maxTagsPerCard: 12,
	maxIssues: 200
}), p = class {
	issues = [];
	add(e, t, n) {
		this.issues.length >= f.maxIssues || this.issues.push({
			code: e,
			path: t,
			message: n
		});
	}
}, m = class extends Error {
	issues;
	constructor(e) {
		super(`Learning path document is invalid (${e.length} issue(s)).`), this.name = "LearningPathValidationError", this.issues = e;
	}
};
function h(e) {
	let t = new p();
	if (_(e, t), t.issues.length > 0) return {
		ok: !1,
		issues: Object.freeze([...t.issues])
	};
	let n = e;
	return D(n, t), t.issues.length > 0 ? {
		ok: !1,
		issues: Object.freeze([...t.issues])
	} : {
		ok: !0,
		document: n,
		issues: []
	};
}
function g(e) {
	let t = h(e);
	if (!t.ok) throw new m(t.issues);
	return t.document;
}
function _(e, t) {
	let n = N(e, "$", [
		"protocol",
		"version",
		"id",
		"metadata",
		"structure",
		"data",
		"presentation"
	], [], t);
	n && (L(n.protocol, "$.protocol", d, t), L(n.version, "$.version", "1.0", t), F(n.id, "$.id", t), v(n.metadata, "$.metadata", t), y(n.structure, "$.structure", t), C(n.data, "$.data", t), E(n.presentation, "$.presentation", t));
}
function v(e, t, n) {
	let r = N(e, t, ["title", "locale"], ["description"], n);
	r && (I(r.title, `${t}.title`, 1, f.maxShortTextLength, n), r.description !== void 0 && I(r.description, `${t}.description`, 1, f.maxSummaryLength, n), I(r.locale, `${t}.locale`, 2, 16, n) && !/^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(r.locale) && n.add("invalid_value", `${t}.locale`, "Locale must use a language tag such as zh-CN or en."));
}
function y(e, t, n) {
	let r = N(e, t, [
		"entrySubjectId",
		"goalSubjectIds",
		"subjects",
		"concepts",
		"flow",
		"flowGroups"
	], [], n);
	r && (F(r.entrySubjectId, `${t}.entrySubjectId`, n), ce(r.goalSubjectIds, `${t}.goalSubjectIds`, 1, f.maxSubjects, n), P(r.subjects, `${t}.subjects`, 1, f.maxSubjects, b, n), P(r.concepts, `${t}.concepts`, 0, f.maxConcepts, ee, n), P(r.flow, `${t}.flow`, 0, f.maxFlowEdges, x, n), P(r.flowGroups, `${t}.flowGroups`, 0, f.maxFlowGroups, S, n));
}
function b(e, t, n) {
	let r = N(e, t, ["id", "cardRef"], ["orderHint"], n);
	r && (F(r.id, `${t}.id`, n), F(r.cardRef, `${t}.cardRef`, n), r.orderHint !== void 0 && de(r.orderHint, `${t}.orderHint`, 0, 1e6, n));
}
function ee(e, t, n) {
	let r = N(e, t, [
		"id",
		"subjectId",
		"cardRef",
		"actionRef"
	], ["orderHint"], n);
	r && (F(r.id, `${t}.id`, n), F(r.subjectId, `${t}.subjectId`, n), F(r.cardRef, `${t}.cardRef`, n), F(r.actionRef, `${t}.actionRef`, n), r.orderHint !== void 0 && de(r.orderHint, `${t}.orderHint`, 0, 1e6, n));
}
function x(e, t, n) {
	let r = N(e, t, [
		"id",
		"fromSubjectId",
		"toSubjectId"
	], ["semantics"], n);
	if (r && (F(r.id, `${t}.id`, n), F(r.fromSubjectId, `${t}.fromSubjectId`, n), F(r.toSubjectId, `${t}.toSubjectId`, n), r.semantics !== void 0)) {
		let e = N(r.semantics, `${t}.semantics`, [], ["splitGroupId", "joinGroupId"], n);
		if (!e) return;
		e.splitGroupId === void 0 && e.joinGroupId === void 0 && n.add("invalid_value", `${t}.semantics`, "Semantics must reference a split group, a join group, or both."), e.splitGroupId !== void 0 && F(e.splitGroupId, `${t}.semantics.splitGroupId`, n), e.joinGroupId !== void 0 && F(e.joinGroupId, `${t}.semantics.joinGroupId`, n);
	}
}
function S(e, t, n) {
	let r = N(e, t, [
		"id",
		"type",
		"anchorSubjectId",
		"policy"
	], [], n);
	r && (F(r.id, `${t}.id`, n), F(r.anchorSubjectId, `${t}.anchorSubjectId`, n), r.type === "split" ? L(r.policy, `${t}.policy`, "parallel", n) : r.type === "join" ? L(r.policy, `${t}.policy`, "all-required", n) : n.add("invalid_value", `${t}.type`, "Flow group type must be split or join."));
}
function C(e, t, n) {
	let r = N(e, t, [
		"cards",
		"resources",
		"actions"
	], [], n);
	r && (P(r.cards, `${t}.cards`, 1, f.maxCards, te, n), P(r.resources, `${t}.resources`, 0, f.maxResources, w, n), P(r.actions, `${t}.actions`, 0, f.maxActions, T, n));
}
function te(e, t, n) {
	let r = N(e, t, [
		"id",
		"title",
		"summary"
	], [
		"eyebrow",
		"body",
		"tags",
		"imageUrl"
	], n);
	r && (F(r.id, `${t}.id`, n), I(r.title, `${t}.title`, 1, f.maxShortTextLength, n), I(r.summary, `${t}.summary`, 1, f.maxSummaryLength, n), r.eyebrow !== void 0 && I(r.eyebrow, `${t}.eyebrow`, 1, 80, n), r.body !== void 0 && I(r.body, `${t}.body`, 1, f.maxBodyLength, n), r.imageUrl !== void 0 && R(r.imageUrl, `${t}.imageUrl`, n), r.tags !== void 0 && le(r.tags, `${t}.tags`, 0, f.maxTagsPerCard, 40, n));
}
function w(e, t, n) {
	let r = N(e, t, ["id", "href"], [], n);
	r && (F(r.id, `${t}.id`, n), R(r.href, `${t}.href`, n));
}
function T(e, t, n) {
	let r = N(e, t, [
		"id",
		"kind",
		"label",
		"resourceId"
	], ["target"], n);
	r && (F(r.id, `${t}.id`, n), L(r.kind, `${t}.kind`, "open-resource", n), I(r.label, `${t}.label`, 1, 80, n), F(r.resourceId, `${t}.resourceId`, n), r.target !== void 0 && r.target !== "self" && r.target !== "blank" && n.add("invalid_value", `${t}.target`, "Target must be self or blank."));
}
function E(e, t, n) {
	let r = N(e, t, ["layout"], [], n);
	if (!r) return;
	let i = N(r.layout, `${t}.layout`, ["direction"], [
		"subjectGap",
		"layerGap",
		"conceptGap",
		"conceptColumnGap"
	], n);
	if (i) {
		L(i.direction, `${t}.layout.direction`, "top-to-bottom", n);
		for (let e of [
			"subjectGap",
			"layerGap",
			"conceptGap",
			"conceptColumnGap"
		]) i[e] !== void 0 && fe(i[e], `${t}.layout.${e}`, 1, 100, n);
	}
}
function D(e, t) {
	let { subjects: n, concepts: r, flow: i, flowGroups: a, entrySubjectId: o, goalSubjectIds: s } = e.structure, { cards: c, actions: l, resources: u } = e.data, d = A(n, "$.structure.subjects", "subject", t), p = A(r, "$.structure.concepts", "concept", t);
	A(i, "$.structure.flow", "flow", t);
	let m = A(a, "$.structure.flowGroups", "flow group", t), h = A(c, "$.data.cards", "card", t), g = A(l, "$.data.actions", "action", t), _ = A(u, "$.data.resources", "resource", t);
	for (let [e] of p) d.has(e) && t.add("duplicate_id", "$.structure.concepts", `Entity ID ${B(e)} is shared by a subject and a concept.`);
	d.has(o) || t.add("invalid_reference", "$.structure.entrySubjectId", `Entry subject ${B(o)} does not exist.`), M(s, "$.structure.goalSubjectIds", t);
	for (let [e, n] of s.entries()) d.has(n) || t.add("invalid_reference", `$.structure.goalSubjectIds[${e}]`, `Goal subject ${B(n)} does not exist.`);
	let v = /* @__PURE__ */ new Set();
	for (let [e, r] of n.entries()) j(h, r.cardRef, `$.structure.subjects[${e}].cardRef`, "card", t), v.add(r.cardRef);
	let y = /* @__PURE__ */ new Map(), b = new Set(s), ee = /* @__PURE__ */ new Set();
	for (let [e, n] of r.entries()) d.has(n.subjectId) ? b.has(n.subjectId) && t.add("invalid_concept_ownership", `$.structure.concepts[${e}].subjectId`, `Goal subject ${B(n.subjectId)} terminates the path and cannot own concept platforms.`) : t.add("invalid_concept_ownership", `$.structure.concepts[${e}].subjectId`, `Owner subject ${B(n.subjectId)} does not exist.`), y.set(n.subjectId, (y.get(n.subjectId) ?? 0) + 1), j(h, n.cardRef, `$.structure.concepts[${e}].cardRef`, "card", t), j(g, n.actionRef, `$.structure.concepts[${e}].actionRef`, "action", t), v.add(n.cardRef), ee.add(n.actionRef);
	for (let [e, n] of y) n > f.maxConceptsPerSubject && t.add("limit_exceeded", "$.structure.concepts", `Subject ${B(e)} has ${n} concepts; maximum is ${f.maxConceptsPerSubject}.`);
	let x = /* @__PURE__ */ new Set();
	for (let [e, n] of l.entries()) j(_, n.resourceId, `$.data.actions[${e}].resourceId`, "resource", t), x.add(n.resourceId);
	ae(c, v, "$.data.cards", "card", t), ae(l, ee, "$.data.actions", "action", t), ae(u, x, "$.data.resources", "resource", t);
	let S = /* @__PURE__ */ new Map(), C = /* @__PURE__ */ new Map(), te = /* @__PURE__ */ new Set();
	for (let [e, n] of i.entries()) {
		let r = `$.structure.flow[${e}]`;
		j(d, n.fromSubjectId, `${r}.fromSubjectId`, "subject", t), j(d, n.toSubjectId, `${r}.toSubjectId`, "subject", t), n.fromSubjectId === n.toSubjectId && t.add("invalid_value", r, "A subject flow cannot point to itself.");
		let i = `${n.fromSubjectId}\u0000${n.toSubjectId}`;
		te.has(i) && t.add("duplicate_id", r, `Duplicate directed flow ${B(n.fromSubjectId)} -> ${B(n.toSubjectId)}.`), te.add(i), oe(S, n.fromSubjectId, n), oe(C, n.toSubjectId, n), re(n, e, m, t);
	}
	for (let [e, n] of a.entries()) j(d, n.anchorSubjectId, `$.structure.flowGroups[${e}].anchorSubjectId`, "subject", t);
	O(n, S, C, m, t), ie(n, S, C, o, s, t);
}
function O(e, t, n, r, i) {
	let a = /* @__PURE__ */ new Set();
	for (let o of e) {
		let e = t.get(o.id) ?? [];
		ne(o.id, "split", e, r, a, i);
		let s = n.get(o.id) ?? [];
		ne(o.id, "join", s, r, a, i);
	}
	for (let e of r.keys()) a.has(e) || i.add("invalid_flow_semantics", "$.structure.flowGroups", `Flow group ${B(e)} is declared but not used by a valid branch or merge.`);
}
function ne(e, t, n, r, i, a) {
	let o = t === "split" ? "splitGroupId" : "joinGroupId", s = n.map((e) => e.semantics?.[o]);
	if (n.length > 1) {
		let n = s[0];
		if (!n || s.some((e) => e !== n)) {
			a.add("invalid_flow_semantics", "$.structure.flow", `${t} at ${B(e)} must put every participating edge in one explicit ${t} group.`);
			return;
		}
		let o = r.get(n);
		if (!o || o.type !== t || o.anchorSubjectId !== e) {
			a.add("invalid_flow_semantics", "$.structure.flowGroups", `${t} group ${B(n)} must be anchored at ${B(e)}.`);
			return;
		}
		i.add(n);
	} else s[0] !== void 0 && a.add("invalid_flow_semantics", "$.structure.flow", `A ${t} group cannot be attached at ${B(e)} because it has fewer than two participating edges.`);
}
function re(e, t, n, r) {
	let i = e.semantics;
	if (!i) return;
	let a = `$.structure.flow[${t}].semantics`;
	if (i.splitGroupId) {
		let t = n.get(i.splitGroupId);
		!t || t.type !== "split" ? r.add("invalid_flow_semantics", `${a}.splitGroupId`, `Split group ${B(i.splitGroupId)} does not exist or has the wrong type.`) : t.anchorSubjectId !== e.fromSubjectId && r.add("invalid_flow_semantics", `${a}.splitGroupId`, "Split group anchor must equal the edge source.");
	}
	if (i.joinGroupId) {
		let t = n.get(i.joinGroupId);
		!t || t.type !== "join" ? r.add("invalid_flow_semantics", `${a}.joinGroupId`, `Join group ${B(i.joinGroupId)} does not exist or has the wrong type.`) : t.anchorSubjectId !== e.toSubjectId && r.add("invalid_flow_semantics", `${a}.joinGroupId`, "Join group anchor must equal the edge destination.");
	}
}
function ie(e, t, n, r, i, a) {
	let o = new Set(e.map((e) => e.id)), s = new Map([...o].map((e) => [e, n.get(e)?.length ?? 0])), c = [...o].filter((e) => s.get(e) === 0).sort(), l = 0;
	for (; c.length > 0;) {
		let e = c.shift();
		if (!e) break;
		l += 1;
		for (let n of t.get(e) ?? []) {
			let e = (s.get(n.toSubjectId) ?? 0) - 1;
			s.set(n.toSubjectId, e), e === 0 && se(c, n.toSubjectId);
		}
	}
	if (l !== o.size) {
		a.add("cycle_detected", "$.structure.flow", "Subject flow must be a directed acyclic graph.");
		return;
	}
	(n.get(r)?.length ?? 0) > 0 && a.add("invalid_value", "$.structure.entrySubjectId", "Entry subject must not have prerequisites.");
	let u = k(r, t, (e) => e.toSubjectId);
	for (let e of o) u.has(e) || a.add("unreachable_subject", "$.structure.flow", `Subject ${B(e)} is not reachable from entry ${B(r)}.`);
	let d = new Set(i);
	for (let e of d) (t.get(e)?.length ?? 0) > 0 && a.add("invalid_value", "$.structure.goalSubjectIds", `Goal subject ${B(e)} must be terminal.`);
	for (let e of o) (t.get(e)?.length ?? 0) === 0 && !d.has(e) && a.add("invalid_value", "$.structure.goalSubjectIds", `Terminal subject ${B(e)} must be listed as a goal.`);
	let f = /* @__PURE__ */ new Map();
	for (let e of t.values()) for (let t of e) oe(f, t.toSubjectId, t);
	let p = /* @__PURE__ */ new Set(), m = [...d];
	for (; m.length > 0;) {
		let e = m.pop();
		if (!(!e || p.has(e))) {
			p.add(e);
			for (let t of f.get(e) ?? []) m.push(t.fromSubjectId);
		}
	}
	for (let e of o) p.has(e) || a.add("no_goal_path", "$.structure.flow", `Subject ${B(e)} cannot reach any declared goal.`);
}
function k(e, t, n) {
	let r = /* @__PURE__ */ new Set(), i = [e];
	for (; i.length > 0;) {
		let e = i.pop();
		if (!(!e || r.has(e))) {
			r.add(e);
			for (let r of t.get(e) ?? []) i.push(n(r));
		}
	}
	return r;
}
function A(e, t, n, r) {
	let i = /* @__PURE__ */ new Map();
	for (let [a, o] of e.entries()) i.has(o.id) ? r.add("duplicate_id", `${t}[${a}].id`, `Duplicate ${n} ID ${B(o.id)}.`) : i.set(o.id, o);
	return i;
}
function j(e, t, n, r, i) {
	e.has(t) || i.add("invalid_reference", n, `Referenced ${r} ${B(t)} does not exist.`);
}
function ae(e, t, n, r, i) {
	for (let [a, o] of e.entries()) t.has(o.id) || i.add("unused_data", `${n}[${a}].id`, `${r} ${B(o.id)} is not referenced.`);
}
function M(e, t, n) {
	let r = /* @__PURE__ */ new Set();
	for (let [i, a] of e.entries()) r.has(a) && n.add("duplicate_id", `${t}[${i}]`, `Duplicate ID ${B(a)}.`), r.add(a);
}
function oe(e, t, n) {
	let r = e.get(t);
	r ? r.push(n) : e.set(t, [n]);
}
function se(e, t) {
	let n = 0;
	for (; n < e.length && (e[n] ?? "") < t;) n += 1;
	e.splice(n, 0, t);
}
function N(e, t, n, r, i) {
	if (!z(e)) {
		i.add("type_mismatch", t, "Expected an object.");
		return;
	}
	let a = /* @__PURE__ */ new Set([...n, ...r]);
	for (let n of Object.keys(e)) a.has(n) || i.add("unknown_field", `${t}.${n}`, `Field ${B(n)} is not allowed in protocol v1.`);
	for (let r of n) Object.hasOwn(e, r) || i.add("missing_field", `${t}.${r}`, `Required field ${B(r)} is missing.`);
	return e;
}
function P(e, t, n, r, i, a) {
	if (!Array.isArray(e)) {
		a.add("type_mismatch", t, "Expected an array.");
		return;
	}
	ue(e, t, n, r, a);
	for (let n = 0; n < Math.min(e.length, r + 1); n += 1) i(e[n], `${t}[${n}]`, a);
}
function ce(e, t, n, r, i) {
	if (!Array.isArray(e)) {
		i.add("type_mismatch", t, "Expected an array.");
		return;
	}
	ue(e, t, n, r, i);
	for (let n = 0; n < Math.min(e.length, r + 1); n += 1) F(e[n], `${t}[${n}]`, i);
}
function le(e, t, n, r, i, a) {
	if (!Array.isArray(e)) {
		a.add("type_mismatch", t, "Expected an array.");
		return;
	}
	ue(e, t, n, r, a);
	for (let n = 0; n < Math.min(e.length, r + 1); n += 1) I(e[n], `${t}[${n}]`, 1, i, a);
}
function ue(e, t, n, r, i) {
	e.length < n && i.add("invalid_value", t, `Array must contain at least ${n} item(s).`), e.length > r && i.add("limit_exceeded", t, `Array exceeds the ${r}-item protocol limit.`);
}
function F(e, t, n) {
	return I(e, t, 1, f.maxIdLength, n) ? /^[a-z][a-z0-9]*(?:[-_.:][a-z0-9]+)*$/.test(e) ? !0 : (n.add("invalid_value", t, "ID must start with a lowercase letter and contain only lowercase letters, digits, -, _, . or : separators."), !1) : !1;
}
function I(e, t, n, r, i) {
	return typeof e == "string" ? e.length < n || e.length > r ? (i.add(e.length > r ? "limit_exceeded" : "invalid_value", t, `String length must be between ${n} and ${r}.`), !1) : e.trim() !== e || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(e) ? (i.add("invalid_value", t, "String must be trimmed and cannot contain control characters."), !1) : !0 : (i.add("type_mismatch", t, "Expected a string."), !1);
}
function L(e, t, n, r) {
	e !== n && r.add("invalid_value", t, `Expected literal ${B(n)}.`);
}
function de(e, t, n, r, i) {
	typeof e != "number" || !Number.isSafeInteger(e) ? i.add("type_mismatch", t, "Expected a safe integer.") : (e < n || e > r) && i.add("invalid_value", t, `Integer must be between ${n} and ${r}.`);
}
function fe(e, t, n, r, i) {
	typeof e != "number" || !Number.isFinite(e) ? i.add("type_mismatch", t, "Expected a finite number.") : (e < n || e > r) && i.add("invalid_value", t, `Number must be between ${n} and ${r}.`);
}
function R(e, t, n) {
	if (!I(e, t, 1, f.maxUrlLength, n)) return;
	let r = e;
	if (r.startsWith("#")) {
		/^#[a-zA-Z][a-zA-Z0-9_-]*$/.test(r) || n.add("invalid_url", t, "Invalid in-page URL.");
		return;
	}
	if (r.startsWith("/") && !r.startsWith("//")) {
		(r.includes("\\") || r.split(/[?#]/u, 1)[0]?.split("/").includes("..")) && n.add("invalid_url", t, "Root-relative URL cannot contain backslashes or parent traversal.");
		return;
	}
	try {
		let e = new URL(r);
		(e.protocol !== "https:" || e.username || e.password) && n.add("invalid_url", t, "External URL must use HTTPS and cannot contain credentials.");
	} catch {
		n.add("invalid_url", t, "URL must be HTTPS, root-relative, or an in-page hash.");
	}
}
function z(e) {
	return typeof e == "object" && !!e && !Array.isArray(e);
}
function B(e) {
	return `"${e}"`;
}
//#endregion
//#region src/content/compiler.ts
var pe = 3.75, me = 3.5, he = 3.75, ge = 4.4, _e = .523;
function ve(e) {
	let { subjects: t, concepts: n, flow: r, flowGroups: i } = e.structure, a = Ce(r, (e) => e.fromSubjectId), o = Ce(r, (e) => e.toSubjectId), s = be(t, a, o), c = xe(s, o), l = Se(s, c), u = H(n), f = new Map(e.data.cards.map((e) => [e.id, e])), p = new Map(e.data.actions.map((e) => [e.id, e])), m = new Map(e.data.resources.map((e) => [e.id, e])), h = e.presentation.layout.subjectGap ?? pe, g = e.presentation.layout.layerGap ?? me, _ = e.presentation.layout.conceptGap ?? he, v = e.presentation.layout.conceptColumnGap ?? ge, y = Math.max(...c.values()), b = -(y * g) / 2, ee = [], x = t.length, S = [], C = /* @__PURE__ */ new Map();
	for (let e = 0; e <= y; e += 1) {
		let t = l.get(e) ?? [], n = -((t.length - 1) * h) / 2, r = Oe(b + e * g);
		for (let [e, i] of t.entries()) C.set(i.id, {
			x: Oe(n + e * h),
			z: r
		});
		let i = t.flatMap((e) => u.get(e.id) ?? []), a = n + Math.max(0, t.length - 1) * h + v;
		for (let n of t) {
			let t = u.get(n.id) ?? [];
			for (let [n, i] of t.entries()) {
				let t = W(f, i.cardRef, "card"), o = W(p, i.actionRef, "action"), s = W(m, o.resourceId, "resource");
				ee.push(Object.freeze({
					id: i.id,
					entityId: i.id,
					entityKind: "concept",
					navigationOrder: x,
					label: t.title,
					position: Object.freeze({
						x: Oe(a + n * _),
						z: r
					}),
					layer: e,
					initiallyGreen: !1,
					initiallyVisible: !1,
					completionPolicy: "preserve-variant",
					activationGroupId: De(i.subjectId),
					surfaceY: _e,
					variant: "brown",
					card: t,
					action: Object.freeze({
						...o,
						resource: s
					}),
					ownerSubjectId: i.subjectId
				})), x += 1;
			}
		}
		S.push(Object.freeze({
			index: e,
			subjectNodeIds: Object.freeze(t.map((e) => e.id)),
			conceptNodeIds: Object.freeze(i.map((e) => e.id))
		}));
	}
	let te = new Map(s.map((e, t) => [e.id, t])), w = s.map((e) => {
		let t = W(f, e.cardRef, "card");
		return Object.freeze({
			id: e.id,
			entityId: e.id,
			entityKind: "subject",
			navigationOrder: W(te, e.id, "navigation order"),
			label: t.title,
			position: Object.freeze(W(C, e.id, "position")),
			layer: W(c, e.id, "layer"),
			initiallyGreen: !0,
			initiallyVisible: !0,
			completionPolicy: "promote-to-green",
			surfaceY: _e,
			variant: "green",
			card: t
		});
	}), T = ee, E = /* @__PURE__ */ new Map();
	for (let e of T) e.ownerSubjectId && !E.has(e.ownerSubjectId) && E.set(e.ownerSubjectId, e);
	let D = Object.freeze([...w, ...T]), O = [...r].sort(we).map((e) => Object.freeze({
		id: e.id,
		fromNodeId: e.fromSubjectId,
		toNodeId: e.toSubjectId,
		pathKind: "straight",
		initiallyVisible: !0,
		completionPolicy: "promote-to-green",
		sourceKind: "subject-flow",
		...e.semantics ? { flowSemantics: Object.freeze({ ...e.semantics }) } : {}
	})), ne = V(i, r, w, new Set(O.map((e) => e.id))), re = [], ie = [];
	for (let e of s) {
		let t = u.get(e.id) ?? [];
		if (t.length === 0) continue;
		let n = W(C, e.id, "subject position"), r = W(E, e.id, "first concept node"), i = (l.get(W(c, e.id, "layer")) ?? []).some((t) => {
			if (t.id === e.id) return !1;
			let i = W(C, t.id, "sibling subject position");
			return i.x > Math.min(n.x, r.position.x) && i.x < Math.max(n.x, r.position.x);
		}), a = De(e.id), o = [], s = [{
			kind: "node",
			id: G(t, 0, "first concept").id
		}];
		for (let e = 1; e < t.length; e += 1) {
			let n = G(t, e - 1, "previous concept"), r = G(t, e, "current concept"), i = `concept-flow:${n.id}:${r.id}`;
			o.push(i), re.push(Object.freeze({
				id: i,
				fromNodeId: n.id,
				toNodeId: r.id,
				pathKind: "straight",
				initiallyVisible: !1,
				completionPolicy: "preserve-variant",
				activationGroupId: a,
				sourceKind: "concept-chain"
			})), s.push({
				kind: "edge",
				id: i
			}, {
				kind: "node",
				id: r.id
			});
		}
		ie.push(Object.freeze({
			id: a,
			activationSubjectNodeId: e.id,
			entryConnection: Object.freeze({
				fromSubjectNodeId: e.id,
				toConceptNodeId: G(t, 0, "first concept").id,
				preferredPathKind: i ? "overpass" : "straight"
			}),
			memberConceptNodeIds: Object.freeze(t.map((e) => e.id)),
			memberEdgeIds: Object.freeze(o),
			revealOrder: Object.freeze(s.map((e) => Object.freeze(e)))
		}));
	}
	let k = Object.freeze([
		...O,
		...ne,
		...re
	]);
	return Object.freeze({
		protocol: d,
		version: "1.0",
		sourceDocumentId: e.id,
		initialNodeId: e.structure.entrySubjectId,
		entryNodeId: e.structure.entrySubjectId,
		goalNodeIds: Object.freeze([...e.structure.goalSubjectIds]),
		nodes: D,
		edges: k,
		conceptZones: Object.freeze(ie),
		layers: Object.freeze(S),
		nodeById: new Map(D.map((e) => [e.id, e])),
		edgeById: new Map(k.map((e) => [e.id, e]))
	});
}
function V(e, t, n, r) {
	let i = new Map(n.map((e) => [e.id, e])), a = [];
	for (let n of e) {
		if (n.type !== "split" || n.policy !== "parallel") continue;
		let e = t.filter((e) => e.fromSubjectId === n.anchorSubjectId && e.semantics?.splitGroupId === n.id).map((e) => W(i, e.toSubjectId, "parallel subject")).sort((e, t) => e.position.x - t.position.x || e.navigationOrder - t.navigationOrder || e.id.localeCompare(t.id));
		for (let t = 1; t < e.length; t += 1) {
			let i = G(e, t - 1, "left parallel subject"), o = G(e, t, "right parallel subject"), s = ye(`parallel-peer:${n.id}:${i.id}:${o.id}`, r);
			r.add(s), a.push(Object.freeze({
				id: s,
				fromNodeId: i.id,
				toNodeId: o.id,
				pathKind: "straight",
				initiallyVisible: !0,
				completionPolicy: "promote-to-green",
				sourceKind: "parallel-peer"
			}));
		}
	}
	return Object.freeze(a);
}
function ye(e, t) {
	if (!t.has(e)) return e;
	let n = 2;
	for (; t.has(`${e}:${n}`);) n += 1;
	return `${e}:${n}`;
}
function be(e, t, n) {
	let r = new Map(e.map((e) => [e.id, e])), i = new Map(e.map((e) => [e.id, n.get(e.id)?.length ?? 0])), a = e.filter((e) => i.get(e.id) === 0).sort(U), o = [];
	for (; a.length > 0;) {
		let e = a.shift();
		if (!e) break;
		o.push(e);
		for (let n of t.get(e.id) ?? []) {
			let e = (i.get(n.toSubjectId) ?? 0) - 1;
			i.set(n.toSubjectId, e), e === 0 && Te(a, W(r, n.toSubjectId, "subject"));
		}
	}
	if (o.length !== e.length) throw Error("Compiler received a cyclic or incomplete document. Validate before compiling.");
	return o;
}
function xe(e, t) {
	let n = /* @__PURE__ */ new Map();
	for (let r of e) {
		let e = (t.get(r.id) ?? []).reduce((e, t) => Math.max(e, (n.get(t.fromSubjectId) ?? -1) + 1), 0);
		n.set(r.id, e);
	}
	return n;
}
function Se(e, t) {
	let n = /* @__PURE__ */ new Map();
	for (let r of e) Ee(n, W(t, r.id, "layer"), r);
	for (let e of n.values()) e.sort(U);
	return n;
}
function H(e) {
	let t = /* @__PURE__ */ new Map();
	for (let n of e) Ee(t, n.subjectId, n);
	for (let e of t.values()) e.sort(U);
	return t;
}
function Ce(e, t) {
	let n = /* @__PURE__ */ new Map();
	for (let r of e) Ee(n, t(r), r);
	for (let e of n.values()) e.sort(we);
	return n;
}
function U(e, t) {
	return (e.orderHint ?? 2 ** 53 - 1) - (t.orderHint ?? 2 ** 53 - 1) || e.id.localeCompare(t.id);
}
function we(e, t) {
	return e.fromSubjectId.localeCompare(t.fromSubjectId) || e.toSubjectId.localeCompare(t.toSubjectId) || e.id.localeCompare(t.id);
}
function Te(e, t) {
	let n = 0;
	for (; n < e.length && U(G(e, n, "queued subject"), t) < 0;) n += 1;
	e.splice(n, 0, t);
}
function Ee(e, t, n) {
	let r = e.get(t);
	r ? r.push(n) : e.set(t, [n]);
}
function W(e, t, n) {
	let r = e.get(t);
	if (r === void 0) throw Error(`Missing compiled ${n}.`);
	return r;
}
function G(e, t, n) {
	let r = e[t];
	if (r === void 0) throw Error(`Missing compiled ${n}.`);
	return r;
}
function De(e) {
	return `concept-zone:${e}`;
}
function Oe(e) {
	return Math.round(e * 1e6) / 1e6;
}
//#endregion
//#region src/progression/persistence/types.ts
var ke = "learning-progress", Ae = Object.freeze([
	"schema",
	"version",
	"pathRevision",
	"lastSafeNodeId",
	"subjectStatusById",
	"conceptStatusById",
	"visitedNodeIds",
	"celebrationSeen",
	"celebrationCount"
]), je = /* @__PURE__ */ new Set([
	"locked",
	"available",
	"completed"
]), Me = /* @__PURE__ */ new Set([
	"locked",
	"available",
	"in-progress",
	"completed"
]);
function Ne(e) {
	if (typeof e != "object" || !e || Array.isArray(e)) return !1;
	let t = Object.getPrototypeOf(e);
	return t === Object.prototype || t === null;
}
function Pe(e, t) {
	let n = Object.keys(e).sort(), r = [...t].sort();
	return n.length === r.length && n.every((e, t) => e === r[t]);
}
function Fe(e) {
	return typeof e == "string" && e.trim().length > 0;
}
function Ie(e, t) {
	return Ne(e) ? Object.entries(e).every(([e, n]) => Fe(e) && t.has(n)) : !1;
}
function Le(e) {
	return e.schema === "learning-progress" && Fe(e.pathRevision) && Fe(e.lastSafeNodeId) && Ie(e.subjectStatusById, je) && Ie(e.conceptStatusById, Me) && typeof e.celebrationSeen == "boolean" && Number.isSafeInteger(e.celebrationCount) && e.celebrationCount >= 0 && (e.celebrationCount === 0 || e.celebrationSeen === !0);
}
function Re(e) {
	return !Ne(e) || !Pe(e, Ae) || e.version !== 1 || !Le(e) || !Ne(e.visitedNodeIds) ? !1 : Object.entries(e.visitedNodeIds).every(([e, t]) => Fe(e) && t === !0);
}
function ze(e) {
	if (!Ne(e) || !Pe(e, Ae) || e.version !== 2 || !Le(e) || !Array.isArray(e.visitedNodeIds)) return !1;
	let t = e.visitedNodeIds;
	return t.every(Fe) && new Set(t).size === t.length;
}
function Be(e) {
	return Object.freeze(Object.fromEntries(Object.entries(e).sort(([e], [t]) => e.localeCompare(t))));
}
function Ve(e) {
	return Object.freeze({
		schema: ke,
		version: 2,
		pathRevision: e.pathRevision,
		lastSafeNodeId: e.lastSafeNodeId,
		subjectStatusById: Be(e.subjectStatusById),
		conceptStatusById: Be(e.conceptStatusById),
		visitedNodeIds: Object.freeze([...e.visitedNodeIds]),
		celebrationSeen: e.celebrationSeen,
		celebrationCount: e.celebrationCount
	});
}
function He(e) {
	if (!Ne(e) || e.schema !== "learning-progress") return Object.freeze({
		ok: !1,
		reason: "invalid-document"
	});
	if (e.version === 2) return ze(e) ? Object.freeze({
		ok: !0,
		document: Ve(e),
		migratedFromVersion: null
	}) : Object.freeze({
		ok: !1,
		reason: "invalid-document"
	});
	if (e.version === 1) {
		if (!Re(e)) return Object.freeze({
			ok: !1,
			reason: "invalid-document"
		});
		let t = {
			schema: ke,
			version: 2,
			pathRevision: e.pathRevision,
			lastSafeNodeId: e.lastSafeNodeId,
			subjectStatusById: e.subjectStatusById,
			conceptStatusById: e.conceptStatusById,
			visitedNodeIds: Object.keys(e.visitedNodeIds).sort((e, t) => e.localeCompare(t)),
			celebrationSeen: e.celebrationSeen,
			celebrationCount: e.celebrationCount
		};
		return Object.freeze({
			ok: !0,
			document: Ve(t),
			migratedFromVersion: 1
		});
	}
	return Object.freeze({
		ok: !1,
		reason: "unknown-version"
	});
}
function Ue(e) {
	let t = He({
		schema: ke,
		version: 2,
		...e
	});
	if (!t.ok) throw TypeError(`Invalid learning progress persistence payload: ${t.reason}`);
	return t.document;
}
//#endregion
//#region src/progression/persistence/codec.ts
function We(e, t) {
	let n = e.trim();
	if (n.length === 0) throw TypeError(`${t} must be a non-empty string.`);
	return n;
}
function Ge(e) {
	return /* @__PURE__ */ new Set([...Object.keys(e.subjectStatusById), ...Object.keys(e.conceptStatusById)]);
}
function Ke(e, t) {
	let n = Object.keys(e).sort(), r = Object.keys(t).sort();
	return n.length === r.length && n.every((e, t) => e === r[t]);
}
function qe(e, t) {
	if (!Ke(e.subjectStatusById, t.subjectStatusById) || !Ke(e.conceptStatusById, t.conceptStatusById)) return !1;
	let n = Ge(t);
	return n.has(e.lastSafeNodeId) && e.visitedNodeIds.includes(e.lastSafeNodeId) && e.visitedNodeIds.every((e) => n.has(e));
}
function Je(e) {
	return Object.freeze({ ...e });
}
function Ye(e) {
	return Object.freeze(Object.fromEntries(e.map((e) => [e, !0])));
}
function Xe(e, t, n) {
	let r = Ge(e).has(t) ? t : e.currentNodeId, i = n?.visitedNodeIds ?? Object.keys(e.visitedNodeIds), a = i.includes(r) ? i : [...i, r];
	return Object.freeze({
		...e,
		currentNodeId: r,
		subjectStatusById: Je(n?.subjectStatusById ?? e.subjectStatusById),
		conceptStatusById: Je(n?.conceptStatusById ?? e.conceptStatusById),
		visitedNodeIds: Ye(a),
		celebrationSeen: n?.celebrationSeen ?? e.celebrationSeen,
		celebrationCount: n?.celebrationCount ?? e.celebrationCount,
		lastNavigationDecision: null,
		lastCatchUpResult: null,
		lastConceptAction: null,
		pendingLearningIntent: null,
		lastLearningLaunch: null,
		learningLaunchRevision: 0,
		pendingUnlockCommit: null,
		lastMovementCancellation: null,
		lastRejection: null
	});
}
function Ze(e, t) {
	let n = e.fallbackSafeNodeId ?? e.fallbackContext.currentNodeId;
	return Object.freeze({
		status: "fallback",
		context: Xe(e.fallbackContext, n),
		reason: t
	});
}
function Qe(e, t) {
	let n = We(t.pathRevision, "pathRevision"), r = We(t.lastSafeNodeId, "lastSafeNodeId");
	if (!Ge(e).has(r)) throw TypeError("lastSafeNodeId is not part of the learning path.");
	if (e.visitedNodeIds[r] !== !0) throw TypeError("lastSafeNodeId must be present in visitedNodeIds.");
	let i = Ue({
		pathRevision: n,
		lastSafeNodeId: r,
		subjectStatusById: e.subjectStatusById,
		conceptStatusById: e.conceptStatusById,
		visitedNodeIds: Object.keys(e.visitedNodeIds).sort((e, t) => e.localeCompare(t)),
		celebrationSeen: e.celebrationSeen,
		celebrationCount: e.celebrationCount
	});
	return JSON.stringify(i);
}
function $e(e, t) {
	We(t.pathRevision, "pathRevision");
	let n = e;
	if (typeof e == "string") {
		if (e.trim().length === 0) return Ze(t, "empty");
		try {
			n = JSON.parse(e);
		} catch {
			return Ze(t, "corrupt-json");
		}
	}
	let r = He(n);
	return r.ok ? r.document.pathRevision === t.pathRevision.trim() ? qe(r.document, t.fallbackContext) ? Object.freeze({
		status: "restored",
		context: Xe(t.fallbackContext, r.document.lastSafeNodeId, r.document),
		document: r.document,
		migratedFromVersion: r.migratedFromVersion
	}) : Ze(t, "path-shape-mismatch") : Ze(t, "path-revision-mismatch") : Ze(t, r.reason);
}
//#endregion
//#region src/progression/persistence/storagePort.ts
var et = class extends Error {
	code;
	constructor(e, t, n) {
		super(t, n), this.name = "LearningProgressStorageError", this.code = e;
	}
};
function tt(e, t) {
	return e instanceof et ? Object.freeze({
		code: e.code,
		message: e.message
	}) : Object.freeze({
		code: t,
		message: e instanceof Error ? e.message : String(e)
	});
}
//#endregion
//#region src/progression/persistence/machine.ts
var nt = 250;
function rt(e, t) {
	let n = e.trim();
	if (n.length === 0) throw TypeError(`${t} must be a non-empty string.`);
	return n;
}
function it(e, t) {
	if (!Number.isSafeInteger(e) || e < 0) throw TypeError(`${t} must be a non-negative safe integer.`);
	return e;
}
function at(e) {
	if (e === void 0) return nt;
	if (!Number.isSafeInteger(e) || e < 0) throw TypeError("debounceMs must be a non-negative safe integer.");
	return e;
}
function K(e) {
	return Object.freeze({
		sessionRevision: e.sessionRevision,
		pathRevision: e.pathRevision,
		progressRevision: e.progressRevision,
		operationId: e.operationId
	});
}
function ot(e, t) {
	return e !== null && t !== null && e.sessionRevision === t.sessionRevision && e.pathRevision === t.pathRevision && e.progressRevision === t.progressRevision && e.operationId === t.operationId;
}
function st(e) {
	return typeof e != "object" || !e || !("output" in e) ? null : e.output ?? null;
}
function ct(e) {
	return $e("", {
		pathRevision: e.pathRevision,
		fallbackContext: e.fallbackContext,
		fallbackSafeNodeId: e.fallbackSafeNodeId
	}).context;
}
function lt(e) {
	return Object.freeze({
		...K(e),
		serialized: Qe(e.context, {
			pathRevision: e.pathRevision,
			lastSafeNodeId: e.lastSafeNodeId
		})
	});
}
function ut(e, t) {
	return Object.freeze([...e, t].slice(-128));
}
function dt(e) {
	let t = s(async ({ input: t, signal: n }) => {
		try {
			let r = await e.read({ key: t.storageKey }, { signal: n });
			if (n.aborted) throw new DOMException("Persistence read aborted.", "AbortError");
			let i = $e(r ?? "", {
				pathRevision: t.pathRevision,
				fallbackContext: t.fallbackContext,
				fallbackSafeNodeId: t.fallbackSafeNodeId
			});
			if (i.status === "fallback") return Object.freeze({
				correlation: K(t),
				loadResult: Object.freeze({
					status: "fallback",
					context: i.context,
					reason: i.reason
				}),
				canonicalJson: null,
				migrationWrite: null,
				failure: null
			});
			let a = Qe(i.context, {
				pathRevision: t.pathRevision,
				lastSafeNodeId: i.document.lastSafeNodeId
			});
			return Object.freeze({
				correlation: K(t),
				loadResult: Object.freeze({
					status: "restored",
					context: i.context,
					migratedFromVersion: i.migratedFromVersion
				}),
				canonicalJson: a,
				migrationWrite: i.migratedFromVersion === 1 ? Object.freeze({
					...K({
						...t,
						operationId: `${t.operationId}:migrate-v2`
					}),
					serialized: a
				}) : null,
				failure: null
			});
		} catch (e) {
			let n = tt(e, "read-failed"), r = K(t), i = ct(t);
			return Object.freeze({
				correlation: r,
				loadResult: Object.freeze({
					status: "fallback",
					context: i,
					reason: "read-error"
				}),
				canonicalJson: null,
				migrationWrite: null,
				failure: Object.freeze({
					phase: "read",
					...n,
					correlation: r
				})
			});
		}
	}), r = s(async ({ input: t, signal: n }) => {
		try {
			if (await e.write({
				key: t.storageKey,
				value: t.operation.serialized
			}, { signal: n }), n.aborted) throw new DOMException("Persistence write aborted.", "AbortError");
			return Object.freeze({
				correlation: K(t.operation),
				failure: null
			});
		} catch (e) {
			let n = tt(e, "write-failed"), r = K(t.operation);
			return Object.freeze({
				correlation: r,
				failure: Object.freeze({
					phase: "write",
					...n,
					correlation: r
				})
			});
		}
	});
	return o({
		types: {},
		actors: {
			loadProgress: t,
			writeProgress: r
		},
		delays: { debounce: ({ context: e }) => e.debounceMs },
		guards: {
			currentSaveRequest: ({ context: e, event: t }) => t.type === "PERSISTENCE.SAVE.REQUESTED" && t.sessionRevision === e.sessionRevision && t.pathRevision === e.pathRevision && Number.isSafeInteger(t.progressRevision) && t.progressRevision > e.latestProgressRevision && t.operationId.trim().length > 0 && !e.seenOperationIds.includes(t.operationId),
			currentFlushRequest: ({ context: e, event: t }) => t.type === "PERSISTENCE.FLUSH.REQUESTED" && ot(e.pendingWrite, t),
			currentLoadResult: ({ context: e, event: t }) => {
				let n = st(t);
				return n !== null && ot(n.correlation, {
					sessionRevision: e.sessionRevision,
					pathRevision: e.pathRevision,
					progressRevision: 0,
					operationId: e.loadOperationId
				});
			},
			currentWriteSucceeded: ({ context: e, event: t }) => {
				let n = st(t);
				return n !== null && n.failure === null && ot(e.activeWrite, n.correlation);
			},
			currentWriteFailed: ({ context: e, event: t }) => {
				let n = st(t);
				return n !== null && n.failure !== null && ot(e.activeWrite, n.correlation);
			},
			hasPendingWrite: ({ context: e }) => e.pendingWrite !== null,
			hasNoPendingWrite: ({ context: e }) => e.pendingWrite === null
		},
		actions: {
			acceptLoadResult: n(({ context: e, event: t }) => {
				let n = st(t);
				if (!n) return {};
				let r = e.pendingWrite !== null && n.loadResult.status === "restored" && n.loadResult.migratedFromVersion === null && e.pendingWrite.serialized === n.canonicalJson, i = r ? null : e.pendingWrite, a = i ?? n.migrationWrite, o = i === null && !r && n.migrationWrite !== null;
				return {
					restoredContext: n.loadResult.context,
					loadResult: n.loadResult,
					pendingWrite: a,
					lastPersistedJson: n.loadResult.status === "restored" ? n.canonicalJson : null,
					lastFailure: n.failure,
					lastCompletedCorrelation: r && e.pendingWrite ? K(e.pendingWrite) : e.lastCompletedCorrelation,
					seenOperationIds: o && n.migrationWrite ? ut(e.seenOperationIds, n.migrationWrite.operationId) : e.seenOperationIds
				};
			}),
			queueSave: n(({ context: e, event: t }) => {
				if (t.type !== "PERSISTENCE.SAVE.REQUESTED") return {};
				try {
					let n = lt(t), r = e.activeWrite === null && e.lastPersistedJson === n.serialized;
					return {
						latestProgressRevision: n.progressRevision,
						seenOperationIds: ut(e.seenOperationIds, n.operationId),
						pendingWrite: r ? null : n,
						lastCompletedCorrelation: r ? K(n) : e.lastCompletedCorrelation,
						lastFailure: null
					};
				} catch (n) {
					let r = K(t);
					return {
						latestProgressRevision: t.progressRevision,
						seenOperationIds: ut(e.seenOperationIds, t.operationId),
						pendingWrite: null,
						lastFailure: Object.freeze({
							phase: "request",
							code: "invalid-request",
							message: n instanceof Error ? n.message : String(n),
							correlation: r
						})
					};
				}
			}),
			promotePendingWrite: n(({ context: e }) => ({
				activeWrite: e.pendingWrite,
				pendingWrite: null
			})),
			commitWrite: n(({ context: e, event: t }) => {
				if (!st(t) || !e.activeWrite) return {};
				let n = e.pendingWrite?.serialized === e.activeWrite.serialized ? e.pendingWrite : null;
				return {
					lastPersistedJson: e.activeWrite.serialized,
					lastCompletedCorrelation: K(n ?? e.activeWrite),
					pendingWrite: n ? null : e.pendingWrite,
					activeWrite: null,
					lastFailure: null
				};
			}),
			failWrite: n(({ context: e, event: t }) => {
				let n = st(t);
				return !n?.failure || !e.activeWrite ? {} : {
					pendingWrite: e.pendingWrite ?? e.activeWrite,
					activeWrite: null,
					lastFailure: n.failure
				};
			})
		}
	}).createMachine({
		id: "learningProgressPersistence",
		initial: "loading",
		context: ({ input: e }) => {
			let t = it(e.sessionRevision, "sessionRevision"), n = rt(e.pathRevision, "pathRevision"), r = rt(e.storageKey, "storageKey"), i = rt(e.loadOperationId, "loadOperationId"), a = e.fallbackSafeNodeId ?? e.fallbackContext.currentNodeId;
			return {
				storageKey: r,
				sessionRevision: t,
				pathRevision: n,
				debounceMs: at(e.debounceMs),
				fallbackContext: e.fallbackContext,
				fallbackSafeNodeId: a,
				restoredContext: e.fallbackContext,
				loadOperationId: i,
				loadResult: null,
				latestProgressRevision: 0,
				seenOperationIds: Object.freeze([]),
				pendingWrite: null,
				activeWrite: null,
				lastPersistedJson: null,
				lastCompletedCorrelation: null,
				lastFailure: null
			};
		},
		states: {
			loading: {
				invoke: {
					id: "loadLearningProgress",
					src: "loadProgress",
					input: ({ context: e }) => ({
						storageKey: e.storageKey,
						sessionRevision: e.sessionRevision,
						pathRevision: e.pathRevision,
						progressRevision: 0,
						operationId: e.loadOperationId,
						fallbackContext: e.fallbackContext,
						fallbackSafeNodeId: e.fallbackSafeNodeId
					}),
					onDone: [{
						guard: ({ context: e, event: t }) => (e.pendingWrite !== null || st(t)?.migrationWrite !== null) && ot(st(t)?.correlation ?? null, {
							sessionRevision: e.sessionRevision,
							pathRevision: e.pathRevision,
							progressRevision: 0,
							operationId: e.loadOperationId
						}),
						actions: "acceptLoadResult",
						target: "debouncing"
					}, {
						guard: "currentLoadResult",
						actions: "acceptLoadResult",
						target: "idle"
					}]
				},
				on: { "PERSISTENCE.SAVE.REQUESTED": {
					guard: "currentSaveRequest",
					actions: "queueSave"
				} }
			},
			idle: { on: { "PERSISTENCE.SAVE.REQUESTED": {
				guard: "currentSaveRequest",
				actions: "queueSave",
				target: "debouncing"
			} } },
			debouncing: {
				always: {
					guard: "hasNoPendingWrite",
					target: "idle"
				},
				after: { debounce: {
					guard: "hasPendingWrite",
					target: "preparingWrite"
				} },
				on: {
					"PERSISTENCE.SAVE.REQUESTED": {
						guard: "currentSaveRequest",
						actions: "queueSave",
						target: "debouncing",
						reenter: !0
					},
					"PERSISTENCE.FLUSH.REQUESTED": {
						guard: "currentFlushRequest",
						target: "preparingWrite"
					}
				}
			},
			preparingWrite: {
				entry: "promotePendingWrite",
				always: "writing"
			},
			writing: {
				invoke: {
					id: "writeLearningProgress",
					src: "writeProgress",
					input: ({ context: e }) => {
						if (!e.activeWrite) throw Error("Persistence write entered without an operation.");
						return {
							storageKey: e.storageKey,
							operation: e.activeWrite
						};
					},
					onDone: [{
						guard: "currentWriteSucceeded",
						actions: "commitWrite",
						target: "writeSettled"
					}, {
						guard: "currentWriteFailed",
						actions: "failWrite",
						target: "writeFailed"
					}]
				},
				on: { "PERSISTENCE.SAVE.REQUESTED": {
					guard: "currentSaveRequest",
					actions: "queueSave"
				} }
			},
			writeSettled: { always: [{
				guard: "hasPendingWrite",
				target: "preparingWrite"
			}, { target: "idle" }] },
			writeFailed: { on: {
				"PERSISTENCE.SAVE.REQUESTED": {
					guard: "currentSaveRequest",
					actions: "queueSave",
					target: "debouncing"
				},
				"PERSISTENCE.FLUSH.REQUESTED": {
					guard: "currentFlushRequest",
					target: "preparingWrite"
				}
			} }
		}
	});
}
//#endregion
//#region src/application/learning-resource/machine.ts
function ft(e) {
	if (!Number.isSafeInteger(e) || e < 0) throw TypeError("sessionRevision must be a non-negative safe integer.");
	return e;
}
function pt(e) {
	return typeof e.nodeId == "string" && e.nodeId.length > 0 && typeof e.actionId == "string" && e.actionId.length > 0 && typeof e.resourceId == "string" && e.resourceId.length > 0 && typeof e.href == "string" && e.href.length > 0 && (e.target === "self" || e.target === "blank");
}
function mt(e) {
	return e.type === "RESOURCE.LAUNCH.REQUESTED";
}
function ht(e) {
	return Object.freeze({
		binding: Object.freeze({ ...e.binding }),
		intent: e.intent,
		launchId: e.launchId,
		sessionRevision: e.sessionRevision
	});
}
function gt(e, t) {
	let n = e.activeLaunch;
	return t !== void 0 && n !== null && t.launchId === n.launchId && t.sessionRevision === n.sessionRevision && t.sessionRevision === e.sessionRevision;
}
function _t(e) {
	if (!(typeof e != "object" || !e || !("output" in e))) return e.output;
}
function vt(e) {
	return e instanceof Error ? e.message : typeof e == "string" ? e : "Learning resource navigation failed.";
}
function yt(e) {
	return e.status === "accepted" || e.status === "popup-blocked" || e.status === "invalid-url" || e.status === "failed" ? Object.freeze({ ...e }) : Object.freeze({
		status: "failed",
		message: "Navigator returned an unsupported result."
	});
}
function bt(e) {
	let t = s(async ({ input: t, signal: n }) => {
		try {
			let r = yt(await e.navigate(t, { signal: n }));
			return Object.freeze({
				...t,
				...r
			});
		} catch (e) {
			if (n.aborted) throw e;
			return Object.freeze({
				...t,
				status: "failed",
				message: vt(e)
			});
		}
	});
	return o({
		types: {},
		actors: { navigateResource: t },
		guards: {
			acceptsLaunch: ({ context: e, event: t }) => mt(t) && t.sessionRevision === e.sessionRevision && typeof t.launchId == "string" && t.launchId.length > 0 && (t.intent === "start" || t.intent === "continue" || t.intent === "review") && !e.seenLaunchIds.includes(t.launchId) && pt(t.binding),
			acceptsRevision: ({ context: e, event: t }) => t.type === "SESSION.REVISION.CHANGED" && Number.isSafeInteger(t.sessionRevision) && t.sessionRevision >= 0 && t.sessionRevision > e.sessionRevision,
			currentLaunchAccepted: ({ context: e, event: t }) => {
				let n = _t(t);
				return gt(e, n) && n.status === "accepted";
			},
			currentLaunchFailed: ({ context: e, event: t }) => {
				let n = _t(t);
				return gt(e, n) && n.status !== "accepted";
			}
		},
		actions: {
			beginLaunch: n(({ context: e, event: t }) => mt(t) ? {
				activeLaunch: ht(t),
				seenLaunchIds: Object.freeze([...e.seenLaunchIds, t.launchId])
			} : {}),
			acceptResult: n(({ event: e }) => ({
				activeLaunch: null,
				lastResult: _t(e) ?? null
			})),
			advanceRevision: n(({ event: e }) => e.type === "SESSION.REVISION.CHANGED" ? {
				sessionRevision: e.sessionRevision,
				activeLaunch: null,
				seenLaunchIds: Object.freeze([]),
				lastResult: null
			} : {})
		}
	}).createMachine({
		id: "learningResource",
		initial: "idle",
		context: ({ input: e }) => ({
			sessionRevision: ft(e.sessionRevision),
			activeLaunch: null,
			seenLaunchIds: Object.freeze([]),
			lastResult: null
		}),
		on: { "SESSION.REVISION.CHANGED": {
			guard: "acceptsRevision",
			actions: "advanceRevision",
			target: ".idle"
		} },
		states: {
			idle: { on: { "RESOURCE.LAUNCH.REQUESTED": {
				guard: "acceptsLaunch",
				actions: "beginLaunch",
				target: "launching"
			} } },
			launching: {
				invoke: {
					id: "resourceNavigation",
					src: "navigateResource",
					input: ({ context: e }) => {
						if (!e.activeLaunch) throw Error("Resource navigation entered without an active launch.");
						return e.activeLaunch;
					},
					onDone: [{
						guard: "currentLaunchAccepted",
						actions: "acceptResult",
						target: "accepted"
					}, {
						guard: "currentLaunchFailed",
						actions: "acceptResult",
						target: "failed"
					}]
				},
				on: { "RESOURCE.LAUNCH.REQUESTED": {
					guard: "acceptsLaunch",
					actions: "beginLaunch",
					target: "launching",
					reenter: !0
				} }
			},
			accepted: { on: { "RESOURCE.LAUNCH.REQUESTED": {
				guard: "acceptsLaunch",
				actions: "beginLaunch",
				target: "launching"
			} } },
			failed: { on: { "RESOURCE.LAUNCH.REQUESTED": {
				guard: "acceptsLaunch",
				actions: "beginLaunch",
				target: "launching"
			} } }
		}
	});
}
//#endregion
//#region src/application/scene-session/machine.ts
var xt = /* @__PURE__ */ new Set([
	"PRESENTATION.EXECUTE",
	"PRESENTATION.CANCEL_TRANSACTION",
	"MOTION.EXECUTE",
	"MOTION.ABORT",
	"CHARACTER.FORCE_SETTLE"
]), St = /* @__PURE__ */ new Set([
	"PRESENTATION.ACCEPTED",
	"PRESENTATION.DEFERRED",
	"PRESENTATION.STARTED",
	"PRESENTATION.SETTLED",
	"PRESENTATION.FAILED",
	"MOTION.ACCEPTED",
	"MOTION.DEPARTED",
	"MOTION.ARRIVED",
	"MOTION.VISUAL_IDLE",
	"MOTION.FAILED",
	"CHARACTER.ACCEPTED",
	"CHARACTER.SETTLED",
	"CHARACTER.FAILED",
	"SCENE_RUNTIME.COMMAND_REJECTED"
]);
function Ct(e) {
	return xt.has(e.type);
}
function wt(e) {
	return St.has(e.type) ? "transactionId" in e && "operationId" in e && "attemptId" in e && "attempt" in e : !1;
}
function Tt(e) {
	return (e.type === "PRESENTATION.STARTED" || e.type === "PRESENTATION.FAILED") && !("transactionId" in e);
}
function Et(e) {
	if (e.type === "PRESENTATION.SETTLED") {
		let { result: t, ...n } = e;
		return Object.freeze(n);
	}
	return Object.freeze({ ...e });
}
function Dt(e, t) {
	return Object.freeze({
		...e.readiness,
		...t
	});
}
function Ot(e, t) {
	return Object.freeze({
		stage: e,
		message: t
	});
}
function kt(r) {
	let i = typeof r == "function" ? null : r;
	if (i && !Number.isFinite(i.sessionRevision)) throw Error("sceneSessionMachine requires a finite sessionRevision.");
	let a = typeof r == "function" ? r : () => r, s = (e) => {
		let t = a(e);
		if (!Number.isFinite(t.sessionRevision) || t.sessionRevision !== e) throw Error("sceneSessionMachine resolver returned a mismatched sessionRevision.");
		return t;
	}, c = e(), l = {
		id: "sceneRuntimeGateway",
		src: "sceneRuntimeGateway",
		input: ({ context: e }) => {
			let t = s(e.sessionRevision);
			return {
				sessionRevision: e.sessionRevision,
				port: t.runtimePort,
				defaultTimeoutMs: t.gatewayTimeoutMs,
				scheduler: t.gatewayScheduler
			};
		}
	};
	return o({
		types: {},
		actors: { sceneRuntimeGateway: c },
		guards: {
			currentSession: ({ context: e, event: t }) => t.sessionRevision === e.sessionRevision,
			currentLifecyclePresentationEvent: ({ context: e, event: t }) => t.sessionRevision === e.sessionRevision && Tt(t),
			currentGatewayCommand: ({ context: e, event: t }) => t.sessionRevision === e.sessionRevision && Ct(t),
			currentGatewayAck: ({ context: e, event: t }) => t.sessionRevision === e.sessionRevision && wt(t),
			presentationReady: ({ context: e }) => e.readiness.presentationReady,
			modelReady: ({ context: e }) => e.readiness.modelReady
		},
		actions: {
			beginModelLoad: n(({ context: e }) => ({
				readiness: Dt(e, {
					modelReady: !1,
					presentationStarted: !1,
					presentationReady: !1,
					contextAvailable: !0
				}),
				error: null
			})),
			markModelReady: n(({ context: e }) => ({
				readiness: Dt(e, { modelReady: !0 }),
				error: null
			})),
			markPresentationStarted: n(({ context: e }) => ({
				readiness: Dt(e, { presentationStarted: !0 }),
				error: null
			})),
			markPresentationReady: n(({ context: e }) => ({
				readiness: Dt(e, {
					presentationStarted: !0,
					presentationReady: !0,
					contextAvailable: !0
				}),
				error: null
			})),
			markContextLost: n(({ context: e }) => ({ readiness: Dt(e, { contextAvailable: !1 }) })),
			markContextRestored: n(({ context: e }) => ({
				readiness: Dt(e, { contextAvailable: !0 }),
				error: null
			})),
			recordModelFailure: n(({ context: e, event: t }) => ({
				readiness: Dt(e, {
					modelReady: !1,
					presentationStarted: !1,
					presentationReady: !1
				}),
				error: t.type === "MODEL.FAILED" ? Ot("model", t.error) : e.error
			})),
			recordPresentationFailure: n(({ context: e, event: t }) => ({
				readiness: Dt(e, { presentationReady: !1 }),
				error: t.type === "PRESENTATION.FAILED" && !wt(t) ? Ot("presentation", t.error) : e.error
			})),
			recordGatewayAck: n(({ context: e, event: t }) => ({
				lastGatewayAck: wt(t) ? Et(t) : null,
				gatewayAckSequence: wt(t) ? e.gatewayAckSequence + 1 : e.gatewayAckSequence
			})),
			forwardGatewayCommand: t("sceneRuntimeGateway", ({ event: e }) => e)
		}
	}).createMachine({
		id: "sceneSession",
		initial: "preparing",
		context: ({ input: e }) => {
			if (i && e.sessionRevision !== i.sessionRevision) throw Error("sceneSessionMachine actor input must match its configured sessionRevision.");
			return {
				sessionRevision: e.sessionRevision,
				readiness: Object.freeze({
					modelReady: !1,
					presentationStarted: !1,
					presentationReady: !1,
					contextAvailable: !0
				}),
				error: null,
				lastGatewayAck: null,
				gatewayAckSequence: 0
			};
		},
		on: {
			"SESSION.STOP": {
				guard: "currentSession",
				target: ".disposed"
			},
			"*": [{
				guard: "currentGatewayAck",
				actions: "recordGatewayAck"
			}]
		},
		states: {
			preparing: { on: {
				"MODEL.LOAD_STARTED": {
					guard: "currentSession",
					actions: "beginModelLoad",
					target: "loadingModel"
				},
				"CONTEXT.LOST": {
					guard: "currentSession",
					actions: "markContextLost",
					target: "contextLost"
				}
			} },
			loadingModel: { on: {
				"MODEL.READY": {
					guard: "currentSession",
					actions: "markModelReady",
					target: "presenting"
				},
				"MODEL.FAILED": {
					guard: "currentSession",
					actions: "recordModelFailure",
					target: "degraded"
				},
				"CONTEXT.LOST": {
					guard: "currentSession",
					actions: "markContextLost",
					target: "contextLost"
				}
			} },
			presenting: {
				invoke: l,
				on: {
					"PRESENTATION.STARTED": [{
						guard: "currentLifecyclePresentationEvent",
						actions: "markPresentationStarted"
					}, {
						guard: "currentGatewayAck",
						actions: "recordGatewayAck"
					}],
					"PRESENTATION.READY": {
						guard: "currentSession",
						actions: "markPresentationReady",
						target: "active"
					},
					"PRESENTATION.FAILED": [{
						guard: "currentLifecyclePresentationEvent",
						actions: "recordPresentationFailure",
						target: "degraded"
					}, {
						guard: "currentGatewayAck",
						actions: "recordGatewayAck"
					}],
					"CONTEXT.LOST": {
						guard: "currentSession",
						actions: "markContextLost",
						target: "contextLost"
					},
					"*": {
						guard: "currentGatewayCommand",
						actions: "forwardGatewayCommand"
					}
				}
			},
			active: {
				invoke: l,
				on: {
					"PRESENTATION.FAILED": [{
						guard: "currentLifecyclePresentationEvent",
						actions: "recordPresentationFailure",
						target: "degraded"
					}, {
						guard: "currentGatewayAck",
						actions: "recordGatewayAck"
					}],
					"CONTEXT.LOST": {
						guard: "currentSession",
						actions: "markContextLost",
						target: "contextLost"
					},
					"*": {
						guard: "currentGatewayCommand",
						actions: "forwardGatewayCommand"
					}
				}
			},
			contextLost: { on: {
				"CONTEXT.RESTORED": [
					{
						guard: ({ context: e, event: t }) => t.sessionRevision === e.sessionRevision && e.readiness.presentationReady,
						actions: "markContextRestored",
						target: "active"
					},
					{
						guard: ({ context: e, event: t }) => t.sessionRevision === e.sessionRevision && e.readiness.modelReady,
						actions: "markContextRestored",
						target: "presenting"
					},
					{
						guard: "currentSession",
						actions: "markContextRestored",
						target: "loadingModel"
					}
				],
				"PRESENTATION.FAILED": [{
					guard: "currentLifecyclePresentationEvent",
					actions: "recordPresentationFailure",
					target: "degraded"
				}, {
					guard: "currentGatewayAck",
					actions: "recordGatewayAck"
				}]
			} },
			degraded: { on: {
				"MODEL.LOAD_STARTED": {
					guard: "currentSession",
					actions: "beginModelLoad",
					target: "loadingModel"
				},
				"MODEL.READY": {
					guard: "currentSession",
					actions: "markModelReady",
					target: "presenting"
				},
				"PRESENTATION.STARTED": {
					guard: ({ context: e, event: t }) => t.sessionRevision === e.sessionRevision && Tt(t) && e.readiness.modelReady,
					actions: "markPresentationStarted",
					target: "presenting"
				},
				"CONTEXT.RESTORED": [{
					guard: ({ context: e, event: t }) => t.sessionRevision === e.sessionRevision && e.readiness.presentationReady,
					actions: "markContextRestored",
					target: "active"
				}, {
					guard: ({ context: e, event: t }) => t.sessionRevision === e.sessionRevision && e.readiness.modelReady,
					actions: "markContextRestored",
					target: "presenting"
				}]
			} },
			disposed: { type: "final" }
		}
	});
}
//#endregion
//#region src/application/scene-session/lifecycleBinding.ts
function At(e) {
	let t = !0, n = (n) => {
		if (!(!t || !e.isCurrentSession())) switch (n.type) {
			case "MODEL.LOAD_STARTED":
			case "MODEL.READY":
			case "PRESENTATION.STARTED":
			case "PRESENTATION.READY":
			case "CONTEXT.LOST":
			case "CONTEXT.RESTORED":
				e.send({
					type: n.type,
					sessionRevision: e.sessionRevision
				});
				break;
			case "MODEL.FAILED":
			case "PRESENTATION.FAILED": e.send({
				type: n.type,
				sessionRevision: e.sessionRevision,
				error: n.error
			});
		}
	}, r = e.source.subscribeSceneSessionLifecycle(n), i = e.source.getSceneSessionLifecycleSnapshot();
	return i.modelPhase !== "not-started" && n({ type: "MODEL.LOAD_STARTED" }), i.modelPhase === "ready" ? n({ type: "MODEL.READY" }) : i.modelPhase === "failed" && n({
		type: "MODEL.FAILED",
		error: i.modelError ?? "Character model loading failed."
	}), i.presentationPhase !== "not-started" && n({ type: "PRESENTATION.STARTED" }), i.presentationPhase === "ready" ? n({ type: "PRESENTATION.READY" }) : i.presentationPhase === "failed" && n({
		type: "PRESENTATION.FAILED",
		error: i.presentationError ?? "Generation presentation failed."
	}), i.contextAvailable || n({ type: "CONTEXT.LOST" }), Object.freeze({ unsubscribe: () => {
		t && (t = !1, r.unsubscribe());
	} });
}
//#endregion
//#region src/contracts/json.ts
function jt(e) {
	if (e === null) return "null";
	if (Array.isArray(e)) return "Array";
	let t = typeof e;
	return t === "object" ? (Object.getPrototypeOf(e) === null ? null : e.constructor)?.name ?? "object" : t;
}
function Mt(e, t) {
	return /^[A-Za-z_$][\w$]*$/u.test(t) ? `${e}.${t}` : `${e}[${JSON.stringify(t)}]`;
}
function q(e, t, n) {
	return Object.freeze({
		safe: !1,
		failure: Object.freeze({
			path: e,
			reason: t,
			receivedType: jt(n)
		})
	});
}
function Nt(e) {
	let t = /* @__PURE__ */ new Map(), n = (e, r) => {
		if (e === null) return Object.freeze({ safe: !0 });
		switch (typeof e) {
			case "string":
			case "boolean": return Object.freeze({ safe: !0 });
			case "number": return Number.isFinite(e) ? Object.freeze({ safe: !0 }) : q(r, "numbers must be finite", e);
			case "undefined": return q(r, "undefined is omitted or coerced by JSON.stringify", e);
			case "bigint":
			case "symbol":
			case "function": return q(r, `${typeof e} values are not JSON data`, e);
			case "object": break;
			default: return q(r, "unsupported JavaScript value", e);
		}
		let i = e, a = t.get(i);
		if (a) return q(r, `cyclic reference to ${a}`, e);
		let o = Object.getPrototypeOf(i), s = Array.isArray(i);
		if (!s && o !== Object.prototype && o !== null) return q(r, "only arrays and plain objects may cross the actor serialization boundary", e);
		if (Object.getOwnPropertySymbols(i).length > 0) return q(r, "symbol-keyed properties are not representable in JSON", e);
		t.set(i, r);
		try {
			if (s) {
				let e = i;
				for (let t = 0; t < e.length; t += 1) {
					if (!Object.hasOwn(e, t)) return q(`${r}[${t}]`, "sparse array entries are coerced to null by JSON.stringify", void 0);
					let i = n(e[t], `${r}[${t}]`);
					if (!i.safe) return i;
				}
				let t = Object.getOwnPropertyNames(e).filter((t) => {
					if (t === "length") return !1;
					let n = Number(t);
					return !Number.isInteger(n) || n < 0 || n >= e.length || String(n) !== t;
				});
				return t.length > 0 ? q(Mt(r, t[0] ?? "<unknown>"), "custom array properties are ignored by JSON.stringify", e[t[0]]) : Object.freeze({ safe: !0 });
			}
			for (let t of Object.getOwnPropertyNames(i)) {
				let a = Object.getOwnPropertyDescriptor(i, t);
				if (!a) continue;
				if (a.get || a.set) return q(Mt(r, t), "accessor properties are executable behavior, not inert JSON data", e);
				if (!a.enumerable) return q(Mt(r, t), "non-enumerable properties are ignored by JSON.stringify", a.value);
				let o = n(a.value, Mt(r, t));
				if (!o.safe) return o;
			}
			return Object.freeze({ safe: !0 });
		} finally {
			t.delete(i);
		}
	};
	return n(e, "$");
}
//#endregion
//#region src/statecharts/page/revealOrder.ts
function J(e) {
	return Object.freeze({
		valid: !1,
		error: e
	});
}
function Pt(e) {
	if (typeof e.revision != "string" || e.revision.trim().length === 0) return J("Compiled revision must be a non-empty string.");
	if (!Array.isArray(e.nodes) || !Array.isArray(e.edges) || !Array.isArray(e.revealOrder)) return J("Compiled nodes, edges, and revealOrder must be arrays.");
	let t = e.revealOrder[0];
	if (!t || t.kind !== "node" || t.nodeId !== e.initialNodeId) return J(`revealOrder must begin with initialNodeId "${e.initialNodeId}".`);
	let n = /* @__PURE__ */ new Set(), r = /* @__PURE__ */ new Set();
	for (let t of e.nodes) {
		if (n.has(t.id)) return J(`Duplicate compiled node "${t.id}".`);
		if (typeof t.initiallyVisible != "boolean") return J(`Node "${t.id}" must declare initiallyVisible.`);
		n.add(t.id), t.initiallyVisible && r.add(t.id);
	}
	if (!n.has(e.initialNodeId)) return J(`Compiled nodes do not contain initialNodeId "${e.initialNodeId}".`);
	if (!r.has(e.initialNodeId)) return J(`Initial node "${e.initialNodeId}" must be initially visible.`);
	let i = new Map(e.edges.map((e) => [e.id, e]));
	if (i.size !== e.edges.length) return J("Compiled edges contain duplicate IDs.");
	let a = /* @__PURE__ */ new Set();
	for (let t of e.edges) {
		if (typeof t.initiallyVisible != "boolean") return J(`Edge "${t.id}" must declare initiallyVisible.`);
		if (!n.has(t.fromNodeId) || !n.has(t.toNodeId)) return J(`Edge "${t.id}" references an unknown endpoint node.`);
		t.initiallyVisible && a.add(t.id);
	}
	let o = /* @__PURE__ */ new Set(), s = /* @__PURE__ */ new Set();
	for (let t of e.revealOrder) {
		if (t.kind === "node") {
			if (!n.has(t.nodeId)) return J(`Reveal order references unknown node "${t.nodeId}".`);
			if (!r.has(t.nodeId)) return J(`Reveal order includes hidden node "${t.nodeId}".`);
			if (o.has(t.nodeId)) return J(`Reveal order repeats node "${t.nodeId}".`);
			o.add(t.nodeId);
			continue;
		}
		let e = i.get(t.edgeId);
		if (!e) return J(`Reveal order references unknown edge "${t.edgeId}".`);
		if (!a.has(t.edgeId)) return J(`Reveal order includes hidden edge "${t.edgeId}".`);
		if (s.has(t.edgeId)) return J(`Reveal order repeats edge "${t.edgeId}".`);
		if (e.fromNodeId !== t.fromNodeId || e.toNodeId !== t.toNodeId) return J(`Reveal step endpoints do not match edge "${t.edgeId}".`);
		if (!o.has(t.fromNodeId) || !o.has(t.toNodeId)) return J(`Edge "${t.edgeId}" appears before both endpoint nodes.`);
		s.add(t.edgeId);
	}
	return o.size === r.size ? s.size === a.size ? Object.freeze({
		valid: !0,
		error: null
	}) : J("Reveal order does not contain every initially visible edge exactly once.") : J("Reveal order does not contain every initially visible node exactly once.");
}
function Ft(e) {
	return e.kind === "node" ? `node:${e.nodeId}` : `edge:${e.edgeId}`;
}
//#endregion
//#region src/statecharts/page/runtimeDataRegistry.ts
var It = /* @__PURE__ */ new Map(), Lt = 0;
function Rt(e) {
	if (e.trim().length === 0) throw Error("Compiled page runtime data requires a non-empty revision.");
}
function zt(e, t) {
	Rt(e);
	let n = `${e}:runtime:${++Lt}`;
	return It.set(e, Object.freeze({
		token: n,
		value: t
	})), Object.freeze({
		kind: "compiled-page-runtime-data",
		revision: e,
		token: n
	});
}
function Bt(e) {
	let t = It.get(e.revision);
	return t?.token === e.token ? t.value : null;
}
function Vt(e) {
	return !e || It.get(e.revision)?.token !== e.token ? !1 : It.delete(e.revision);
}
//#endregion
//#region src/statecharts/page/pageGenerationMachine.ts
var Ht = 8e3;
function Ut(e) {
	return e instanceof Error ? e.message : typeof e == "string" ? e : "Unknown generation error.";
}
function Wt(e) {
	return typeof e == "object" && e && "output" in e ? e.output : null;
}
function Gt(e) {
	let t = Nt(e);
	if (!t.safe) throw TypeError(`Page template is not JSON-safe at ${t.failure.path}: ${t.failure.reason}.`);
	return typeof e != "object" || !e ? e : Object.freeze(Array.isArray(e) ? e.map((e) => Gt(e)) : Object.fromEntries(Object.entries(e).map(([e, t]) => [e, Gt(t)])));
}
function Kt(e) {
	let t = Wt(e);
	return t == null ? null : Gt(t);
}
function qt(e, t, n) {
	return Object.freeze({
		kind: t,
		transactionId: e.transactionId,
		revision: e.revision,
		message: n
	});
}
function Jt(e, t) {
	return t.type === "PAGE.GENERATE.REQUESTED" && "template" in t ? t.template ?? null : e.template;
}
function Yt(e, t) {
	let n = Jt(e, t);
	return n !== null && Nt(n).safe;
}
function Xt(e) {
	let t = Wt(e);
	return typeof t != "object" || !t ? null : t;
}
function Zt(e) {
	return Object.freeze({
		revision: e.revision,
		initialNodeId: e.initialNodeId,
		nodes: Object.freeze(e.nodes.map((e) => Object.freeze({ ...e }))),
		edges: Object.freeze(e.edges.map((e) => Object.freeze({ ...e }))),
		revealOrder: Object.freeze(e.revealOrder.map((e) => Object.freeze({ ...e }))),
		...e.data ? { data: Object.freeze({ ...e.data }) } : {}
	});
}
function Qt(e) {
	Vt(e?.data);
}
function $t(e, t) {
	let n = e.outstandingCommand;
	return !n || t.type !== "PAGE.PATH_STEP.SETTLED" && t.type !== "PAGE.CHARACTER.SETTLED" && t.type !== "PAGE.PRESENTATION.FAILED" ? !1 : t.transactionId === n.transactionId && t.revision === n.revision && t.token === n.token;
}
function en(e) {
	let t = e.compiledPath, n = e.transactionId, r = e.revision, i = t?.revealOrder[e.revealIndex];
	if (!t || !n || !r || !i) return null;
	let a = `page:reveal:${e.revealIndex}:${Ft(i)}`;
	return Object.freeze({
		type: "PAGE.PRESENTATION.REVEAL_PATH_STEP",
		transactionId: n,
		revision: r,
		operationId: a,
		token: `${n}:${r}:${a}`,
		motionPreference: e.reducedMotion ? "reduced" : "animated",
		sequenceIndex: e.revealIndex,
		sequenceLength: t.revealOrder.length,
		step: i
	});
}
function tn(e) {
	let t = e.compiledPath, n = e.transactionId, r = e.revision;
	if (!t || !n || !r) return null;
	let i = `page:character:${t.initialNodeId}`;
	return Object.freeze({
		type: "PAGE.PRESENTATION.REVEAL_CHARACTER",
		transactionId: n,
		revision: r,
		operationId: i,
		token: `${n}:${r}:${i}`,
		motionPreference: e.reducedMotion ? "reduced" : "animated",
		nodeId: t.initialNodeId
	});
}
function nn(e) {
	return o({
		types: {},
		actors: {
			runtimeDataLifetime: c(({ receive: e }) => {
				let t = null;
				return e((e) => {
					t = e.reference;
				}), () => {
					Vt(t), t = null;
				};
			}),
			validateTemplate: s(async ({ input: t, signal: n }) => Gt(await e.validateTemplate({
				...t,
				signal: n
			}))),
			compilePath: s(async ({ input: t, signal: n }) => e.compilePath({
				...t,
				signal: n
			})),
			preparePresentation: s(async ({ input: t, signal: n }) => e.preparePresentation({
				...t,
				signal: n
			}))
		},
		delays: { presentationAckTimeout: ({ context: e }) => e.presentationAckTimeoutMs },
		guards: {
			hasTemplateForRequest: ({ context: e, event: t }) => Yt(e, t),
			hasRetryTemplate: ({ context: e }) => e.template !== null,
			receivedTemplateIsJsonSafe: ({ event: e }) => e.type === "PAGE.TEMPLATE.RECEIVED" && Nt(e.template).safe,
			compiledContractIsValid: ({ event: e }) => {
				let t = Xt(e);
				if (!t) return !1;
				try {
					return Nt(t).safe && (t.data === void 0 || t.data.revision === t.revision) && Pt(t).valid;
				} catch {
					return !1;
				}
			},
			hasMorePathSteps: ({ context: e }) => e.compiledPath !== null && e.revealIndex < e.compiledPath.revealOrder.length,
			pathAckMatches: ({ context: e, event: t }) => t.type === "PAGE.PATH_STEP.SETTLED" && e.outstandingCommand?.type === "PAGE.PRESENTATION.REVEAL_PATH_STEP" && $t(e, t),
			characterAckMatches: ({ context: e, event: t }) => t.type === "PAGE.CHARACTER.SETTLED" && e.outstandingCommand?.type === "PAGE.PRESENTATION.REVEAL_CHARACTER" && $t(e, t),
			failureMatches: ({ context: e, event: t }) => t.type === "PAGE.PRESENTATION.FAILED" && $t(e, t)
		},
		actions: {
			receiveTemplate: n(({ event: e }) => e.type === "PAGE.TEMPLATE.RECEIVED" ? { template: Gt(e.template) } : {}),
			beginGeneration: n(({ context: t, event: n }) => {
				let r = Jt(t, n), i = r === null ? null : Gt(r), a = n.type === "PAGE.GENERATE.REQUESTED" ? n.reducedMotion ?? t.reducedMotion : t.reducedMotion;
				return {
					template: i,
					transactionTemplate: i,
					validatedTemplate: null,
					compiledPath: null,
					transactionId: e.createTransactionId(),
					revision: null,
					revealIndex: 0,
					outstandingCommand: null,
					reducedMotion: a,
					generationAttempt: t.generationAttempt + 1,
					lastError: null
				};
			}),
			recordDuplicateGenerateRequest: n(({ context: e }) => ({ duplicateGenerateRequestCount: e.duplicateGenerateRequestCount + 1 })),
			recordMissingTemplate: u(({ context: t, enqueue: n }) => {
				let r = qt(t, "missing-template", "No learning-path JSON template is available.");
				n.assign({ lastError: r }), n(() => e.onGenerationFailed?.(r));
			}),
			recordNonJsonTemplate: u(({ context: t, enqueue: n }) => {
				let r = qt(t, "validation", "Learning-path template must be a finite, plain JSON document.");
				n.assign({ lastError: r }), n(() => e.onGenerationFailed?.(r));
			}),
			acceptValidatedTemplate: n(({ event: e }) => ({ validatedTemplate: Kt(e) })),
			acceptCompiledPath: u(({ event: e, enqueue: t }) => {
				let n = Xt(e), r = n ? Zt(n) : null;
				n && r && (t.assign({
					compiledPath: r,
					revision: r?.revision ?? null,
					revealIndex: 0,
					outstandingCommand: null
				}), t.sendTo("runtimeDataLifetime", {
					type: "RUNTIME_DATA.OWNERSHIP_CHANGED",
					reference: r.data ?? null
				}));
			}),
			recordValidationFailure: u(({ context: t, event: n, enqueue: r }) => {
				let i = qt(t, "validation", Ut(typeof n == "object" && n && "error" in n ? n.error : n));
				r.assign({
					lastError: i,
					transactionTemplate: null,
					validatedTemplate: null
				}), r(() => e.onGenerationFailed?.(i));
			}),
			recordCompilationFailure: u(({ context: t, event: n, enqueue: r }) => {
				let i = qt(t, "compilation", Ut(typeof n == "object" && n && "error" in n ? n.error : n));
				r.assign({
					lastError: i,
					transactionTemplate: null,
					validatedTemplate: null
				}), r(() => e.onGenerationFailed?.(i));
			}),
			recordCompiledContractFailure: u(({ context: t, event: n, enqueue: r }) => {
				let i = Xt(n);
				Qt(i);
				let a = "Compiler returned an invalid learning-path contract.";
				if (i) try {
					a = Pt(i).error ?? a;
				} catch (e) {
					a = Ut(e);
				}
				let o = Object.freeze({
					...qt(t, "compiled-contract", a),
					revision: i?.revision ?? t.revision
				});
				r.assign({
					lastError: o,
					transactionTemplate: null,
					validatedTemplate: null,
					compiledPath: null,
					revision: i?.revision ?? null
				}), r(() => e.onGenerationFailed?.(o));
			}),
			recordPresentationPreparationFailure: u(({ context: t, event: n, enqueue: r }) => {
				Qt(t.compiledPath);
				let i = qt(t, "presentation-preparation", Ut(typeof n == "object" && n && "error" in n ? n.error : n));
				r.assign({
					lastError: i,
					transactionTemplate: null,
					validatedTemplate: null,
					compiledPath: null,
					outstandingCommand: null
				}), r(() => e.onGenerationFailed?.(i));
			}),
			issuePathRevealCommand: u(({ context: t, enqueue: n }) => {
				let r = en(t);
				r && (n.assign({ outstandingCommand: r }), n(() => e.executePresentation(r)));
			}),
			commitPathRevealAck: n(({ context: e }) => ({
				revealIndex: e.revealIndex + 1,
				outstandingCommand: null
			})),
			issueCharacterRevealCommand: u(({ context: t, enqueue: n }) => {
				let r = tn(t);
				r && (n.assign({ outstandingCommand: r }), n(() => e.executePresentation(r)));
			}),
			recordPresentationFailure: u(({ context: t, event: n, enqueue: r }) => {
				Qt(t.compiledPath);
				let i = qt(t, "presentation", n.type === "PAGE.PRESENTATION.FAILED" ? n.error : "Presentation command failed.");
				r.assign({
					lastError: i,
					outstandingCommand: null
				}), r(() => e.onGenerationFailed?.(i));
			}),
			recordPresentationTimeout: u(({ context: t, enqueue: n }) => {
				Qt(t.compiledPath);
				let r = t.outstandingCommand, i = qt(t, "presentation-timeout", r ? `Presentation ACK timed out for "${r.operationId}".` : "Presentation ACK timed out.");
				n.assign({
					lastError: i,
					outstandingCommand: null
				}), n(() => e.onGenerationFailed?.(i));
			}),
			completeGeneration: u(({ context: t, enqueue: n }) => {
				let r = t.compiledPath, i = t.transactionId, a = t.revision;
				if (n.assign({
					outstandingCommand: null,
					transactionTemplate: null,
					validatedTemplate: null,
					lastError: null
				}), r && i && a) {
					let t = Object.freeze({
						transactionId: i,
						revision: a,
						compiledPath: r
					});
					n(() => e.onGenerationReady?.(t)), n(() => Qt(r)), n.sendTo("runtimeDataLifetime", {
						type: "RUNTIME_DATA.OWNERSHIP_CHANGED",
						reference: null
					});
				}
			}),
			releaseCurrentCompiledRuntimeData: u(({ context: e, enqueue: t }) => {
				Qt(e.compiledPath), t.sendTo("runtimeDataLifetime", {
					type: "RUNTIME_DATA.OWNERSHIP_CHANGED",
					reference: null
				});
			})
		}
	}).createMachine({
		id: "learning-path-page-generation",
		initial: "awaitingGenerate",
		context: ({ input: e }) => ({
			template: e.initialTemplate === void 0 ? null : Gt(e.initialTemplate),
			transactionTemplate: null,
			validatedTemplate: null,
			compiledPath: null,
			transactionId: null,
			revision: null,
			revealIndex: 0,
			outstandingCommand: null,
			reducedMotion: e.reducedMotion ?? !1,
			presentationAckTimeoutMs: Math.max(1, e.presentationAckTimeoutMs ?? Ht),
			generationAttempt: 0,
			duplicateGenerateRequestCount: 0,
			lastError: null
		}),
		invoke: {
			id: "runtimeDataLifetime",
			src: "runtimeDataLifetime"
		},
		on: { "PAGE.TEMPLATE.RECEIVED": [{
			guard: "receivedTemplateIsJsonSafe",
			actions: "receiveTemplate"
		}, { actions: "recordNonJsonTemplate" }] },
		states: {
			awaitingGenerate: { on: {
				"PAGE.GENERATE.REQUESTED": [
					{
						guard: "hasTemplateForRequest",
						target: "validating",
						actions: ["releaseCurrentCompiledRuntimeData", "beginGeneration"]
					},
					{
						guard: ({ context: e, event: t }) => Jt(e, t) === null,
						actions: "recordMissingTemplate"
					},
					{ actions: "recordNonJsonTemplate" }
				],
				"PAGE.GENERATE.RETRY_REQUESTED": [{
					guard: "hasRetryTemplate",
					target: "validating",
					actions: ["releaseCurrentCompiledRuntimeData", "beginGeneration"]
				}, { actions: "recordMissingTemplate" }]
			} },
			validating: {
				invoke: {
					src: "validateTemplate",
					input: ({ context: e }) => ({
						template: e.transactionTemplate,
						transactionId: e.transactionId ?? "invalid-transaction"
					}),
					onDone: {
						target: "compiling",
						actions: "acceptValidatedTemplate"
					},
					onError: {
						target: "awaitingGenerate",
						actions: "recordValidationFailure"
					}
				},
				on: {
					"PAGE.GENERATE.REQUESTED": { actions: "recordDuplicateGenerateRequest" },
					"PAGE.GENERATE.RETRY_REQUESTED": { actions: "recordDuplicateGenerateRequest" }
				}
			},
			compiling: {
				invoke: {
					src: "compilePath",
					input: ({ context: e }) => ({
						validatedTemplate: e.validatedTemplate,
						transactionId: e.transactionId ?? "invalid-transaction"
					}),
					onDone: [{
						guard: "compiledContractIsValid",
						target: "preparingPresentation",
						actions: "acceptCompiledPath"
					}, {
						target: "awaitingGenerate",
						actions: "recordCompiledContractFailure"
					}],
					onError: {
						target: "awaitingGenerate",
						actions: "recordCompilationFailure"
					}
				},
				on: {
					"PAGE.GENERATE.REQUESTED": { actions: "recordDuplicateGenerateRequest" },
					"PAGE.GENERATE.RETRY_REQUESTED": { actions: "recordDuplicateGenerateRequest" }
				}
			},
			preparingPresentation: {
				invoke: {
					src: "preparePresentation",
					input: ({ context: e }) => ({
						compiledPath: e.compiledPath,
						transactionId: e.transactionId ?? "invalid-transaction",
						revision: e.revision ?? "invalid-revision"
					}),
					onDone: { target: "revealingPath" },
					onError: {
						target: "awaitingGenerate",
						actions: "recordPresentationPreparationFailure"
					}
				},
				on: {
					"PAGE.GENERATE.REQUESTED": { actions: "recordDuplicateGenerateRequest" },
					"PAGE.GENERATE.RETRY_REQUESTED": { actions: "recordDuplicateGenerateRequest" }
				}
			},
			revealingPath: {
				initial: "selecting",
				on: {
					"PAGE.GENERATE.REQUESTED": { actions: "recordDuplicateGenerateRequest" },
					"PAGE.GENERATE.RETRY_REQUESTED": { actions: "recordDuplicateGenerateRequest" }
				},
				states: {
					selecting: { always: [{
						guard: "hasMorePathSteps",
						target: "issuing"
					}, { target: "#learning-path-page-generation.revealingCharacter" }] },
					issuing: {
						entry: "issuePathRevealCommand",
						on: {
							"PAGE.PATH_STEP.SETTLED": {
								guard: "pathAckMatches",
								target: "selecting",
								actions: "commitPathRevealAck"
							},
							"PAGE.PRESENTATION.FAILED": {
								guard: "failureMatches",
								target: "#learning-path-page-generation.awaitingGenerate",
								actions: "recordPresentationFailure"
							}
						},
						after: { presentationAckTimeout: {
							target: "#learning-path-page-generation.awaitingGenerate",
							actions: "recordPresentationTimeout"
						} }
					}
				}
			},
			revealingCharacter: {
				entry: "issueCharacterRevealCommand",
				on: {
					"PAGE.GENERATE.REQUESTED": { actions: "recordDuplicateGenerateRequest" },
					"PAGE.GENERATE.RETRY_REQUESTED": { actions: "recordDuplicateGenerateRequest" },
					"PAGE.CHARACTER.SETTLED": {
						guard: "characterAckMatches",
						target: "ready",
						actions: "completeGeneration"
					},
					"PAGE.PRESENTATION.FAILED": {
						guard: "failureMatches",
						target: "awaitingGenerate",
						actions: "recordPresentationFailure"
					}
				},
				after: { presentationAckTimeout: {
					target: "awaitingGenerate",
					actions: "recordPresentationTimeout"
				} }
			},
			ready: { on: { "PAGE.GENERATE.REQUESTED": [{
				guard: "hasTemplateForRequest",
				target: "validating",
				actions: "beginGeneration"
			}, { actions: "recordMissingTemplate" }] } }
		}
	});
}
//#endregion
//#region src/ui/node-card/cardPlacementPolicy.ts
var rn = 132, an = 14, on = 20;
function sn(e) {
	let t = Math.max(0, e.reservedBottomPixels ?? rn), n = Math.max(0, e.shadowAllowancePixels ?? an), r = e.viewportBottomClientY - t, i = e.cardBottomClientY + n - r;
	return Math.min(Math.max(0, e.maximumLiftPixels), Math.max(0, e.currentLiftPixels + i));
}
function cn(e) {
	let t = Math.max(0, e.maximumOffsetPixels), n = Math.max(0, e.safeMarginPixels ?? on), r = e.viewportLeftClientX + n, i = e.viewportRightClientX - n, a = r - e.cardLeftClientX, o = e.cardRightClientX - i, s = e.currentOffsetPixels;
	return a > 0 ? s += a : o > 0 ? s -= o : s > 0 ? s = Math.max(0, s - Math.max(0, e.cardLeftClientX - r)) : s < 0 && (s = Math.min(0, s + Math.max(0, i - e.cardRightClientX))), Math.min(t, Math.max(-t, s));
}
//#endregion
//#region src/ui/node-card/createNodeCardViewModel.ts
function ln(e) {
	let t = e.nodeId, n = e.runtime.source.nodeById.get(t), r = e.progress.nodeStatusById[t];
	if (!n || !r) return null;
	let i = r === "completed" ? n.entityKind === "concept" ? "brown" : "green" : r === "in-progress" ? "brown" : "gray", a = r === "locked" ? "未解锁" : r === "available" ? "可学习" : r === "in-progress" ? "学习中" : "已完成", o = r === "locked" ? Object.freeze({
		id: "unlock:go",
		label: "解锁并前往"
	}) : n.entityKind === "subject" ? Object.freeze({
		id: "subject:enter",
		label: e.subjectActionLabel?.trim() || (r === "completed" ? "复习本学科" : "开始学习")
	}) : Object.freeze(r === "available" ? {
		id: "learn:start",
		label: "进入学习"
	} : r === "in-progress" ? {
		id: "learn:continue",
		label: "继续学习"
	} : {
		id: "learn:review",
		label: "开始复习"
	}), s = n.entityKind === "concept" ? r === "available" ? Object.freeze({
		id: "concept:defer",
		label: "稍后选择"
	}) : r === "in-progress" ? Object.freeze({
		id: "concept:complete",
		label: "标记为已完成"
	}) : void 0 : void 0, c = !e.session.interactionEnabled, l = Object.freeze({
		...o,
		enabled: !c,
		busy: c
	}), u = s ? Object.freeze({
		...s,
		enabled: !c,
		busy: c
	}) : void 0;
	return Object.freeze({
		instanceId: e.instanceId,
		nodeId: t,
		kind: n.entityKind,
		tone: i,
		title: n.card.title,
		description: n.card.summary,
		eyebrow: n.id === e.runtime.source.entryNodeId ? "学习导览" : n.card.eyebrow ?? (n.entityKind === "subject" ? "学科" : "概念"),
		statusLabel: a,
		visible: !0,
		primaryAction: l,
		...u ? { secondaryAction: u } : {}
	});
}
//#endregion
//#region src/ui/node-card/types.ts
var un = Object.freeze([
	"unlock:go",
	"subject:enter",
	"learn:start",
	"learn:continue",
	"learn:review",
	"concept:defer",
	"concept:complete"
]), dn = new Set(un);
function fn(e) {
	return dn.has(e);
}
//#endregion
//#region src/ui/node-card/machine.ts
function pn(e) {
	return e === void 0 || !Number.isFinite(e) ? 0 : Math.max(0, Math.trunc(e));
}
function mn(e, t) {
	return t.type !== "NODE_CARD.DISMISS" && t.type !== "NODE_CARD.ACTION_REQUESTED" ? !1 : e.nodeId !== null && t.instance.nodeId === e.nodeId && t.instance.revision === e.revision;
}
function hn(e, t) {
	return t.type === "NODE_CARD.ACTION_REQUESTED" && t.enabled !== !1 && fn(t.actionId) && mn(e, t);
}
var gn = o({
	types: {},
	guards: {
		targetsCurrentInstance: ({ context: e, event: t }) => mn(e, t),
		acceptsActionRequest: ({ context: e, event: t }) => hn(e, t)
	},
	actions: {
		openCard: n(({ context: e, event: t }) => t.type !== "NODE_CARD.PIN" && t.type !== "NODE_CARD.REOPEN" ? {} : {
			nodeId: t.nodeId,
			revision: e.revision + 1
		}),
		dismissCard: n(({ event: e }) => e.type === "NODE_CARD.DISMISS" ? {
			nodeId: null,
			lastClose: Object.freeze({
				...e.instance,
				reason: "dismiss",
				actionId: null
			})
		} : {}),
		closeForAction: n(({ event: e }) => e.type !== "NODE_CARD.ACTION_REQUESTED" || !fn(e.actionId) ? {} : {
			nodeId: null,
			lastAction: Object.freeze({
				...e.instance,
				actionId: e.actionId
			}),
			lastClose: Object.freeze({
				...e.instance,
				reason: "action-requested",
				actionId: e.actionId
			})
		}),
		resetSession: n(({ context: e }) => e.nodeId === null ? {} : {
			nodeId: null,
			lastClose: Object.freeze({
				nodeId: e.nodeId,
				revision: e.revision,
				reason: "session-reset",
				actionId: null
			})
		})
	}
}).createMachine({
	id: "nodeCard",
	initial: "hidden",
	context: ({ input: e }) => ({
		nodeId: null,
		revision: pn(e.initialRevision),
		lastClose: null,
		lastAction: null
	}),
	states: {
		hidden: { on: {
			"NODE_CARD.PIN": {
				actions: "openCard",
				target: "visible"
			},
			"NODE_CARD.REOPEN": {
				actions: "openCard",
				target: "visible"
			}
		} },
		visible: { on: {
			"NODE_CARD.PIN": { actions: "openCard" },
			"NODE_CARD.REOPEN": { actions: "openCard" },
			"NODE_CARD.DISMISS": {
				guard: "targetsCurrentInstance",
				actions: "dismissCard",
				target: "hidden"
			},
			"NODE_CARD.ACTION_REQUESTED": {
				guard: "acceptsActionRequest",
				actions: "closeForAction",
				target: "hidden"
			},
			"SESSION.RESET": {
				actions: "resetSession",
				target: "hidden"
			}
		} }
	}
}), _n = class {
	viewport;
	view;
	resolveContext;
	scheduler;
	nodeId = null;
	frameHandle = 0;
	disposed = !1;
	lastOverlay = null;
	constructor(e) {
		let t = e.scheduler ?? e.viewport.ownerDocument.defaultView;
		if (!t) throw Error("Node-card placement requires a browser frame scheduler.");
		this.viewport = e.viewport, this.view = e.view, this.resolveContext = e.resolveContext, this.scheduler = t, this.scheduler.addEventListener("resize", this.handleResize);
	}
	setNodeId(e) {
		if (this.disposed) return;
		let t = e?.trim() || null;
		if (this.nodeId === t) {
			t !== null && this.schedule();
			return;
		}
		if (this.nodeId = t, t === null) {
			this.cancelFrame(), this.clearPlacement();
			return;
		}
		this.schedule();
	}
	requestUpdate() {
		this.disposed || this.nodeId === null || this.schedule();
	}
	dispose() {
		this.disposed || (this.disposed = !0, this.nodeId = null, this.scheduler.removeEventListener("resize", this.handleResize), this.cancelFrame(), this.clearPlacement());
	}
	handleResize = () => this.requestUpdate();
	update = () => {
		if (this.frameHandle = 0, this.disposed || this.nodeId === null) return;
		let e = this.nodeId, t = this.resolveContext(e);
		if (!t) {
			this.nodeId = null, this.clearPlacement();
			return;
		}
		this.lastOverlay = t.overlay;
		let n = this.viewport.getBoundingClientRect(), r = t.overlay.projectNodeAnchor(e, n);
		this.view.setCardPlacement(r?.visible ? {
			anchorClientX: r.anchorClientX,
			anchorClientY: r.anchorClientY,
			viewportRect: n
		} : null), this.applySafeArea(t, n, r), !this.disposed && this.nodeId === e && this.schedule();
	};
	applySafeArea(e, t, n) {
		let r = this.view.getCardLayoutMetrics(), i = e.overlay, a = i.getOverlayComposition();
		if (n?.visible && r.visible && r.placed) {
			let n = cn({
				currentOffsetPixels: a.horizontalOffsetPixels,
				cardLeftClientX: r.centerX - r.width / 2,
				cardRightClientX: r.centerX + r.width / 2,
				viewportLeftClientX: t.left,
				viewportRightClientX: t.right,
				maximumOffsetPixels: t.width * .8
			}), o = sn({
				currentLiftPixels: a.verticalOffsetPixels,
				cardBottomClientY: r.bottom,
				viewportBottomClientY: t.bottom,
				maximumLiftPixels: t.height * .72
			});
			i.setOverlayComposition({
				horizontalOffsetPixels: n,
				verticalOffsetPixels: o,
				fovBonusDegrees: 0
			}, e.reducedMotion);
			return;
		}
		vn(i, e.reducedMotion);
	}
	schedule() {
		this.frameHandle !== 0 || this.disposed || this.nodeId === null || (this.frameHandle = this.scheduler.requestAnimationFrame(this.update));
	}
	cancelFrame() {
		this.frameHandle !== 0 && (this.scheduler.cancelAnimationFrame(this.frameHandle), this.frameHandle = 0);
	}
	clearPlacement() {
		this.view.setCardPlacement(null), this.lastOverlay && vn(this.lastOverlay, !1), this.lastOverlay = null;
	}
};
function vn(e, t) {
	e.setOverlayComposition({
		horizontalOffsetPixels: 0,
		verticalOffsetPixels: 0,
		fovBonusDegrees: 0
	}, t);
}
//#endregion
//#region src/ui/node-card/selectors.ts
function yn(e) {
	let t = e.context.nodeId;
	return !e.matches("visible") || t === null ? null : Object.freeze({
		nodeId: t,
		revision: e.context.revision
	});
}
//#endregion
//#region src/workflows/journey/machine.ts
function bn(e) {
	return Object.freeze({ ...e });
}
function xn(e) {
	return Object.freeze({
		sourceNodeId: e.sourceNodeId,
		targetNodeId: e.targetNodeId,
		routeNodeIds: Object.freeze([...e.routeNodeIds]),
		requiredCompletionNodeIds: Object.freeze([...e.requiredCompletionNodeIds])
	});
}
function Sn(e) {
	return Object.freeze([...e]);
}
function Cn(e) {
	return "transactionId" in e;
}
function wn(e) {
	return e.type === "NODE_TRAVERSED" || e.type === "NODE_ARRIVED" ? e.nodeId : void 0;
}
function Tn(e, t, n) {
	return e.sourceNodeId === n ? e.targetNodeId === t.targetNodeId ? e.routeNodeIds.length === 0 ? "plan-route-empty" : e.routeNodeIds[0] === n ? e.routeNodeIds.at(-1) === t.targetNodeId ? null : "plan-route-must-end-at-target-node" : "plan-route-must-start-at-current-node" : "plan-target-mismatch" : "plan-source-mismatch";
}
function En(e) {
	let t = e.plan?.routeNodeIds;
	return t ? t[e.reachedNodeIds.length] ?? null : null;
}
function Dn(e, t) {
	return e.reachedNodeIds.at(-1) === t ? e.reachedNodeIds : Sn([...e.reachedNodeIds, t]);
}
function On(e) {
	return o({
		types: {},
		guards: {
			hasPlan: ({ context: e }) => e.plan !== null,
			activeTransactionMatches: ({ context: e, event: t }) => Cn(t) && e.transactionId !== null && t.transactionId === e.transactionId,
			staleTransaction: ({ context: e, event: t }) => Cn(t) && t.transactionId !== e.transactionId,
			expectedTraversedNode: ({ context: e, event: t }) => t.type === "NODE_TRAVERSED" && t.transactionId === e.transactionId && t.nodeId === En(e) && t.nodeId !== e.plan?.targetNodeId,
			expectedDestinationArrival: ({ context: e, event: t }) => t.type === "NODE_ARRIVED" && t.transactionId === e.transactionId && t.nodeId === e.plan?.targetNodeId && (t.nodeId === En(e) || e.plan?.routeNodeIds.includes(t.nodeId) === !0)
		},
		actions: {
			beginRequest: n(({ context: t, event: n }) => {
				if (n.type !== "REQUESTED") return {};
				let r = e.createTransactionId();
				if (r.length === 0) throw Error("createTransactionId() must return a non-empty string.");
				return {
					request: bn(n.request),
					plan: null,
					transactionId: r,
					reachedNodeIds: Sn([t.currentNodeId]),
					lastOutcome: null
				};
			}),
			buildPlan: n(({ context: t }) => {
				let n = t.request, r = t.transactionId;
				if (!n || !r) return {};
				try {
					let i = e.planJourney({
						request: n,
						currentNodeId: t.currentNodeId,
						transactionId: r
					});
					if (!i.accepted) return {
						plan: null,
						transactionId: null,
						lastOutcome: Object.freeze({
							type: "rejected",
							transactionId: r,
							targetNodeId: n.targetNodeId,
							reason: i.reason
						})
					};
					let a = xn(i.plan), o = Tn(a, n, t.currentNodeId);
					return o ? {
						plan: null,
						transactionId: null,
						lastOutcome: Object.freeze({
							type: "rejected",
							transactionId: r,
							targetNodeId: n.targetNodeId,
							reason: o
						})
					} : {
						plan: a,
						lastOutcome: null
					};
				} catch (e) {
					return {
						plan: null,
						transactionId: null,
						lastOutcome: Object.freeze({
							type: "rejected",
							transactionId: r,
							targetNodeId: n.targetNodeId,
							reason: e instanceof Error ? e.message : "journey-planner-failed"
						})
					};
				}
			}),
			recordReachedNode: n(({ context: e, event: t }) => t.type !== "NODE_TRAVERSED" && t.type !== "NODE_ARRIVED" ? {} : {
				currentNodeId: t.nodeId,
				reachedNodeIds: Dn(e, t.nodeId),
				lastOutcome: null
			}),
			settleJourney: n(({ context: e, event: t }) => t.type !== "VISUAL_SETTLED" || !e.plan || !e.transactionId ? {} : {
				request: null,
				plan: null,
				transactionId: null,
				lastOutcome: Object.freeze({
					type: "settled",
					transactionId: e.transactionId,
					targetNodeId: e.plan.targetNodeId,
					reachedNodeIds: Sn(e.reachedNodeIds)
				})
			}),
			cancelJourney: n(({ context: e, event: t }) => {
				if (t.type !== "CANCELLED" || !e.plan || !e.transactionId) return {};
				let n = Dn(e, t.safeNodeId), r = Object.freeze({
					type: "cancelled",
					transactionId: e.transactionId,
					targetNodeId: e.plan.targetNodeId,
					safeNodeId: t.safeNodeId,
					reachedNodeIds: Sn(n),
					reason: t.reason
				});
				return {
					request: null,
					plan: null,
					transactionId: null,
					currentNodeId: t.safeNodeId,
					reachedNodeIds: n,
					lastOutcome: r
				};
			}),
			recordStaleEvent: n(({ context: e, event: t }) => Cn(t) ? { lastOutcome: Object.freeze({
				type: "event-ignored",
				eventType: t.type,
				transactionId: t.transactionId,
				activeTransactionId: e.transactionId,
				reason: "stale-transaction"
			}) } : {}),
			recordUnexpectedEvent: n(({ context: e, event: t }) => ({ lastOutcome: Object.freeze({
				type: "event-rejected",
				eventType: t.type,
				transactionId: Cn(t) ? t.transactionId : null,
				activeTransactionId: e.transactionId,
				reason: t.type === "REQUESTED" ? "journey-active" : "invalid-state",
				...wn(t) ? { nodeId: wn(t) } : {}
			}) })),
			recordUnexpectedRouteNode: n(({ context: e, event: t }) => ({ lastOutcome: Object.freeze({
				type: "event-rejected",
				eventType: t.type,
				transactionId: Cn(t) ? t.transactionId : null,
				activeTransactionId: e.transactionId,
				reason: "unexpected-route-node",
				...wn(t) ? { nodeId: wn(t) } : {}
			}) })),
			resetJourney: n(({ context: e }) => ({
				request: null,
				plan: null,
				transactionId: null,
				reachedNodeIds: Sn([e.currentNodeId]),
				lastOutcome: null
			}))
		}
	}).createMachine({
		id: "journey",
		initial: "idle",
		context: ({ input: e }) => ({
			request: null,
			plan: null,
			transactionId: null,
			currentNodeId: e.currentNodeId,
			reachedNodeIds: Sn([e.currentNodeId]),
			lastOutcome: null
		}),
		on: {
			RESET: {
				target: ".idle",
				actions: "resetJourney"
			},
			REQUESTED: { actions: "recordUnexpectedEvent" },
			MOVEMENT_STARTED: [{
				guard: "staleTransaction",
				actions: "recordStaleEvent"
			}, { actions: "recordUnexpectedEvent" }],
			NODE_TRAVERSED: [{
				guard: "staleTransaction",
				actions: "recordStaleEvent"
			}, { actions: "recordUnexpectedEvent" }],
			NODE_ARRIVED: [{
				guard: "staleTransaction",
				actions: "recordStaleEvent"
			}, { actions: "recordUnexpectedEvent" }],
			VISUAL_SETTLED: [{
				guard: "staleTransaction",
				actions: "recordStaleEvent"
			}, { actions: "recordUnexpectedEvent" }],
			CANCELLED: [{
				guard: "staleTransaction",
				actions: "recordStaleEvent"
			}, { actions: "recordUnexpectedEvent" }]
		},
		states: {
			idle: { on: { REQUESTED: {
				target: "planning",
				actions: "beginRequest"
			} } },
			planning: {
				entry: "buildPlan",
				always: [{
					guard: "hasPlan",
					target: "ready"
				}, { target: "rejected" }]
			},
			ready: { on: {
				MOVEMENT_STARTED: {
					guard: "activeTransactionMatches",
					target: "moving"
				},
				CANCELLED: {
					guard: "activeTransactionMatches",
					target: "cancelled",
					actions: "cancelJourney"
				}
			} },
			moving: { on: {
				NODE_TRAVERSED: [{
					guard: "expectedTraversedNode",
					actions: "recordReachedNode"
				}, {
					guard: "activeTransactionMatches",
					actions: "recordUnexpectedRouteNode"
				}],
				NODE_ARRIVED: [{
					guard: "expectedDestinationArrival",
					target: "settling",
					actions: "recordReachedNode"
				}, {
					guard: "activeTransactionMatches",
					actions: "recordUnexpectedRouteNode"
				}],
				CANCELLED: {
					guard: "activeTransactionMatches",
					target: "cancelled",
					actions: "cancelJourney"
				}
			} },
			settling: { on: {
				VISUAL_SETTLED: {
					guard: "activeTransactionMatches",
					target: "idle",
					actions: "settleJourney"
				},
				CANCELLED: {
					guard: "activeTransactionMatches",
					target: "cancelled",
					actions: "cancelJourney"
				}
			} },
			rejected: { on: { REQUESTED: {
				target: "planning",
				actions: "beginRequest"
			} } },
			cancelled: { on: { REQUESTED: {
				target: "planning",
				actions: "beginRequest"
			} } }
		}
	});
}
Object.freeze([
	"idle",
	"planning",
	"ready",
	"moving",
	"settling",
	"rejected",
	"cancelled"
]);
//#endregion
//#region src/workflows/completion-celebration/machine.ts
function kn(e) {
	return Number.isSafeInteger(e) && (e ?? 0) >= 0 ? e ?? 0 : 0;
}
var An = o({
	types: {},
	guards: {
		recordsNewCelebration: ({ context: e, event: t }) => t.type === "PROGRESS.CELEBRATION_RECORDED" && Number.isSafeInteger(t.count) && t.count > e.acknowledgedCount,
		acknowledgesActiveCelebration: ({ context: e, event: t }) => t.type === "PRESENTATION.ACKNOWLEDGED" && e.activeCount !== null && t.count === e.activeCount,
		hidesAcknowledgedCelebration: ({ context: e, event: t }) => t.type === "PRESENTATION.HIDDEN" && e.activeCount !== null && t.count === e.activeCount && t.count <= e.acknowledgedCount
	},
	actions: {
		recordCelebration: n(({ context: e, event: t }) => t.type === "PROGRESS.CELEBRATION_RECORDED" ? {
			observedCount: Math.max(e.observedCount, t.count),
			activeCount: t.count
		} : {}),
		acknowledgeCelebration: n(({ context: e, event: t }) => t.type === "PRESENTATION.ACKNOWLEDGED" ? { acknowledgedCount: Math.max(e.acknowledgedCount, t.count) } : {}),
		clearPresentation: n({ activeCount: null }),
		resetSession: n(({ event: e }) => {
			if (e.type !== "SESSION.RESET") return {};
			let t = kn(e.restoredCount);
			return {
				observedCount: t,
				activeCount: null,
				acknowledgedCount: t
			};
		})
	}
}).createMachine({
	id: "completionCelebration",
	initial: "hidden",
	context: ({ input: e }) => {
		let t = kn(e.restoredCount);
		return {
			observedCount: t,
			activeCount: null,
			acknowledgedCount: t
		};
	},
	on: { "SESSION.RESET": {
		target: ".hidden",
		actions: "resetSession"
	} },
	states: {
		hidden: { on: { "PROGRESS.CELEBRATION_RECORDED": {
			guard: "recordsNewCelebration",
			target: "showing",
			actions: "recordCelebration"
		} } },
		showing: { on: {
			"PROGRESS.CELEBRATION_RECORDED": {
				guard: "recordsNewCelebration",
				actions: "recordCelebration"
			},
			"PRESENTATION.ACKNOWLEDGED": {
				guard: "acknowledgesActiveCelebration",
				target: "acknowledged",
				actions: "acknowledgeCelebration"
			}
		} },
		acknowledged: { on: {
			"PROGRESS.CELEBRATION_RECORDED": {
				guard: "recordsNewCelebration",
				target: "showing",
				actions: "recordCelebration"
			},
			"PRESENTATION.HIDDEN": {
				guard: "hidesAcknowledgedCelebration",
				target: "hidden",
				actions: "clearPresentation"
			}
		} }
	}
}), jn = Object.freeze([
	"hidden",
	"showing",
	"acknowledged"
]);
function Mn(e) {
	return jn.find((t) => e.matches(t)) ?? "hidden";
}
function Nn(e) {
	let t = Mn(e);
	return Object.freeze({
		phase: t,
		visible: t === "showing",
		activeCount: e.context.activeCount,
		acknowledgedCount: e.context.acknowledgedCount
	});
}
//#endregion
//#region src/progression/domain/graph.ts
function Y(e, t) {
	return [...e].sort((e, n) => {
		let r = t.get(e), i = t.get(n);
		return (r?.navigationOrder ?? 2 ** 53 - 1) - (i?.navigationOrder ?? 2 ** 53 - 1) || e.localeCompare(n);
	});
}
function Pn(e) {
	let t = e.nodes.filter((e) => e.entityKind === "subject"), n = e.nodes.filter((e) => e.entityKind === "concept"), r = Y(t.map((e) => e.id), e.nodeById), i = Y(n.map((e) => e.id), e.nodeById), a = /* @__PURE__ */ new Map(), o = /* @__PURE__ */ new Map();
	for (let e of r) a.set(e, []), o.set(e, []);
	for (let t of e.edges) t.sourceKind === "subject-flow" && (a.get(t.toNodeId)?.push(t.fromNodeId), o.get(t.fromNodeId)?.push(t.toNodeId));
	let s = /* @__PURE__ */ new Map();
	for (let e of r) s.set(e, []);
	for (let e of n) e.ownerSubjectId && s.get(e.ownerSubjectId)?.push(e.id);
	return Object.freeze({
		path: e,
		nodeById: e.nodeById,
		subjectIds: r,
		conceptIds: i,
		goalIds: new Set(e.goalNodeIds),
		incomingBySubjectId: new Map([...a].map(([t, n]) => [t, Y(n, e.nodeById)])),
		outgoingBySubjectId: new Map([...o].map(([t, n]) => [t, Y(n, e.nodeById)])),
		conceptsBySubjectId: new Map([...s].map(([t, n]) => [t, Y(n, e.nodeById)]))
	});
}
//#endregion
//#region src/progression/domain/policies.ts
function Fn(e) {
	return Object.freeze({ ...e });
}
function In(e) {
	return Object.freeze({ ...e });
}
function Ln(e) {
	let t = {}, n = {};
	for (let n of e.subjectIds) t[n] = "locked";
	for (let t of e.conceptIds) n[t] = "locked";
	t[e.path.entryNodeId] = "completed";
	for (let t of e.conceptsBySubjectId.get(e.path.entryNodeId) ?? []) n[t] = "completed";
	return zn(e, t), Object.freeze({
		currentNodeId: e.path.entryNodeId,
		goalNodeIds: Object.freeze([...e.path.goalNodeIds]),
		subjectStatusById: Fn(t),
		conceptStatusById: Fn(n),
		visitedNodeIds: In({ [e.path.entryNodeId]: !0 }),
		celebrationSeen: !1,
		celebrationCount: 0,
		lastNavigationDecision: null,
		lastCatchUpResult: null,
		lastConceptAction: null,
		pendingLearningIntent: null,
		lastLearningLaunch: null,
		learningLaunchRevision: 0,
		pendingUnlockCommit: null,
		lastMovementCancellation: null,
		lastRejection: null
	});
}
function Rn(e) {
	return {
		...e,
		subjectStatusById: { ...e.subjectStatusById },
		conceptStatusById: { ...e.conceptStatusById },
		visitedNodeIds: { ...e.visitedNodeIds }
	};
}
function X(e) {
	return Object.freeze({
		...e,
		subjectStatusById: Fn({ ...e.subjectStatusById }),
		conceptStatusById: Fn({ ...e.conceptStatusById }),
		visitedNodeIds: In({ ...e.visitedNodeIds })
	});
}
function zn(e, t) {
	for (let n of e.subjectIds) {
		if (t[n] !== "locked") continue;
		let r = e.incomingBySubjectId.get(n) ?? [];
		r.length > 0 && r.every((e) => t[e] === "completed") && (t[n] = "available");
	}
}
function Bn(e, t, n) {
	let r = e.nodeById.get(n);
	return r ? r.entityKind === "subject" ? t.subjectStatusById[n] ?? null : t.conceptStatusById[n] ?? null : null;
}
function Z(e, t, n, r = "nodeId" in t ? t.nodeId ?? null : null) {
	e.lastRejection = Object.freeze({
		eventType: t.type,
		nodeId: r,
		reason: n
	});
}
function Q(e, t) {
	e.lastNavigationDecision = Object.freeze({
		...t,
		routeNodeIds: Object.freeze([...t.routeNodeIds]),
		requiredCompletionNodeIds: Object.freeze([...t.requiredCompletionNodeIds])
	}), t.accepted && (e.lastRejection = null);
}
function Vn(e, t) {
	let n = e.nodeById.get(t);
	return n ? n.entityKind === "subject" ? n.id : n.ownerSubjectId ?? null : null;
}
function Hn(e, t, n) {
	if (t === n) return Object.freeze([t]);
	let r = [[t]], i = /* @__PURE__ */ new Set([t]);
	for (; r.length > 0;) {
		let t = r.shift(), a = t?.at(-1);
		if (!t || !a) break;
		for (let o of e.outgoingBySubjectId.get(a) ?? []) {
			if (i.has(o)) continue;
			let e = [...t, o];
			if (o === n) return Object.freeze(e);
			i.add(o), r.push(e);
		}
	}
	return null;
}
function Un(e, t) {
	let n = /* @__PURE__ */ new Set(), r = (t) => {
		for (let i of e.incomingBySubjectId.get(t) ?? []) n.has(i) || (n.add(i), r(i));
	};
	return r(t), Y(n, e.nodeById);
}
function Wn(e, t, n) {
	let r = Vn(e, n), i = Vn(e, t.currentNodeId);
	if (!r || !i) return null;
	let a = e.nodeById.get(t.currentNodeId), o = e.nodeById.get(n);
	if (!a || !o) return null;
	if (a.entityKind === "concept" && o.entityKind === "concept" && i === r) {
		let t = e.conceptsBySubjectId.get(i) ?? [], n = t.indexOf(a.id), r = t.indexOf(o.id);
		return n < 0 || r < 0 ? null : Object.freeze(n <= r ? t.slice(n, r + 1) : [
			a.id,
			i,
			...t.slice(0, r + 1)
		]);
	}
	let s = Hn(e, i, r) ?? Hn(e, e.path.entryNodeId, r);
	if (!s) return null;
	let c = a.entityKind === "concept" ? [a.id, ...s] : [...s];
	if (o.entityKind === "subject") return Object.freeze(c);
	let l = e.conceptsBySubjectId.get(r) ?? [], u = l.indexOf(n);
	return u < 0 ? null : Object.freeze([...c, ...l.slice(0, u + 1)]);
}
function Gn(e, t, n, r, i) {
	t.subjectStatusById[n] !== "completed" && (t.subjectStatusById = {
		...t.subjectStatusById,
		[n]: "completed"
	}, r.push(n));
	for (let r of e.conceptsBySubjectId.get(n) ?? []) t.conceptStatusById[r] !== "completed" && (t.conceptStatusById = {
		...t.conceptStatusById,
		[r]: "completed"
	}, i.push(r));
}
function Kn(e, t, n) {
	let r = e.conceptsBySubjectId.get(n) ?? [];
	if (r.length === 0) return;
	let i = r.findIndex((e) => t.conceptStatusById[e] !== "completed");
	if (i < 0) return;
	let a = r[i];
	a && t.conceptStatusById[a] === "locked" && (t.conceptStatusById = {
		...t.conceptStatusById,
		[a]: "available"
	});
}
function qn(e, t, n) {
	let r = e.conceptsBySubjectId.get(n) ?? [];
	if (r.length === 0 || !r.every((e) => t.conceptStatusById[e] === "completed")) {
		Kn(e, t, n);
		return;
	}
	t.subjectStatusById = {
		...t.subjectStatusById,
		[n]: "completed"
	}, zn(e, t.subjectStatusById);
}
function Jn(e, t, n) {
	let r = e.nodeById.get(n);
	if (!r) return !1;
	if (r.entityKind === "subject") t.subjectStatusById[n] === "locked" && (t.subjectStatusById = {
		...t.subjectStatusById,
		[n]: "available"
	});
	else {
		let e = r.ownerSubjectId;
		e && t.subjectStatusById[e] === "locked" && (t.subjectStatusById = {
			...t.subjectStatusById,
			[e]: "available"
		}), t.conceptStatusById[n] === "locked" && (t.conceptStatusById = {
			...t.conceptStatusById,
			[n]: "available"
		});
	}
	return t.visitedNodeIds = {
		...t.visitedNodeIds,
		[n]: !0
	}, !0;
}
function Yn(e, t, n, r) {
	let i = e.nodeById.get(n), a = e.nodeById.get(r);
	if (!i) return !1;
	if (i.entityKind === "subject") {
		if (t.subjectStatusById = {
			...t.subjectStatusById,
			[n]: "completed"
		}, a?.entityKind !== "concept" || a.ownerSubjectId !== n) {
			let r = { ...t.conceptStatusById };
			for (let t of e.conceptsBySubjectId.get(n) ?? []) r[t] = "completed";
			t.conceptStatusById = r;
		}
	} else t.conceptStatusById = {
		...t.conceptStatusById,
		[n]: "completed"
	};
	return t.visitedNodeIds = {
		...t.visitedNodeIds,
		[n]: !0
	}, zn(e, t.subjectStatusById), !0;
}
function Xn(e, t, n) {
	for (let r of n.requiredCompletionNodeIds) Yn(e, t, r, n.targetNodeId);
}
function Zn(e, t, n) {
	let r = t.currentNodeId, i = e.nodeById.get(r), a = new Set(n.requiredCompletionNodeIds), o = /* @__PURE__ */ new Set();
	if (a.has(r) && o.add(r), i?.entityKind === "subject") for (let t of e.outgoingBySubjectId.get(r) ?? []) for (let n of e.incomingBySubjectId.get(t) ?? []) a.has(n) && o.add(n);
	for (let r of Y(o, e.nodeById)) Yn(e, t, r, n.targetNodeId);
}
function Qn(e, t, n, r) {
	let i = e.nodeById.get(r);
	if (!i) return !1;
	let a = new Set(n.requiredCompletionNodeIds), o = /* @__PURE__ */ new Set(), s = Vn(e, r);
	if (s) for (let t of Un(e, s)) a.has(t) && o.add(t);
	if (i.entityKind === "concept" && i.ownerSubjectId) {
		let t = e.conceptsBySubjectId.get(i.ownerSubjectId) ?? [], n = t.indexOf(r);
		for (let e of t.slice(0, Math.max(0, n))) a.has(e) && o.add(e);
	}
	a.has(r) && o.add(r);
	for (let r of Y(o, e.nodeById)) Yn(e, t, r, n.targetNodeId);
	return !0;
}
function $n(e, t, n) {
	let r = Vn(e, t);
	if (!r) return Object.freeze([]);
	let i = new Set(Un(e, r));
	for (let e of n) {
		if (e === t) break;
		i.add(e);
	}
	return Object.freeze(Y(i, e.nodeById));
}
function er(e, t, n) {
	let r = e.nodeById.get(t);
	return r ? r.entityKind === "subject" ? n === "subject-enter" : n !== "subject-enter" : !1;
}
//#endregion
//#region src/progression/domain/unlockCommit.ts
function tr(e) {
	let t = e.transactionId.trim();
	if (t.length === 0) throw TypeError("Pending unlock commit requires a non-empty Journey transaction id.");
	return Object.freeze({
		targetNodeId: e.targetNodeId,
		transactionId: t,
		requiredCompletionNodeIds: Object.freeze([...e.requiredCompletionNodeIds])
	});
}
//#endregion
//#region src/progression/domain/reducer.ts
function nr(e, t, n) {
	let r = Rn(t), i = e.nodeById.get(n.nodeId);
	if (!i) return Z(r, n, "unknown-node"), r.lastCatchUpResult = Object.freeze({
		accepted: !1,
		sourceNodeId: t.currentNodeId,
		targetNodeId: n.nodeId,
		routeNodeIds: Object.freeze([]),
		completedSubjectNodeIds: Object.freeze([]),
		completedConceptNodeIds: Object.freeze([]),
		targetStatus: null,
		reason: "unknown-node"
	}), X(r);
	let a = Wn(e, t, n.nodeId);
	if (!a) return Z(r, n, "no-authored-route"), r.lastCatchUpResult = Object.freeze({
		accepted: !1,
		sourceNodeId: t.currentNodeId,
		targetNodeId: n.nodeId,
		routeNodeIds: Object.freeze([]),
		completedSubjectNodeIds: Object.freeze([]),
		completedConceptNodeIds: Object.freeze([]),
		targetStatus: Bn(e, t, n.nodeId),
		reason: "no-authored-route"
	}), X(r);
	let o = Vn(e, n.nodeId);
	if (!o) return Z(r, n, "unknown-node"), X(r);
	let s = [], c = [];
	for (let t of Un(e, o)) Gn(e, r, t, s, c);
	if (zn(e, r.subjectStatusById), i.entityKind === "concept") {
		r.subjectStatusById[o] === "locked" && (r.subjectStatusById = {
			...r.subjectStatusById,
			[o]: "available"
		});
		let t = e.conceptsBySubjectId.get(o) ?? [], n = t.indexOf(i.id);
		for (let e of t.slice(0, Math.max(0, n))) r.conceptStatusById[e] !== "completed" && (r.conceptStatusById = {
			...r.conceptStatusById,
			[e]: "completed"
		}, c.push(e));
		r.conceptStatusById[i.id] === "locked" && (r.conceptStatusById = {
			...r.conceptStatusById,
			[i.id]: "available"
		});
	}
	return r.lastCatchUpResult = Object.freeze({
		accepted: !0,
		sourceNodeId: t.currentNodeId,
		targetNodeId: n.nodeId,
		routeNodeIds: Object.freeze([...a]),
		completedSubjectNodeIds: Object.freeze(s),
		completedConceptNodeIds: Object.freeze(c),
		targetStatus: Bn(e, r, n.nodeId)
	}), Q(r, {
		accepted: !0,
		sourceNodeId: t.currentNodeId,
		targetNodeId: n.nodeId,
		mode: "catch-up",
		routeNodeIds: a,
		requiredCompletionNodeIds: Object.freeze([])
	}), X(r);
}
function rr(e, t, n, r) {
	let i = Rn(t), a = e.nodeById.get(n.nodeId), o = t.conceptStatusById[n.nodeId] ?? null, s = (e) => {
		let t = Object.freeze({
			accepted: !1,
			kind: r,
			nodeId: n.nodeId,
			status: o,
			reason: e
		});
		return i.lastConceptAction = t, Z(i, n, e), X(i);
	};
	if (!a) return s("unknown-node");
	if (a.entityKind !== "concept") return s("not-a-concept");
	if (r !== "defer" && (r !== "mark-completed" || o !== "in-progress") && t.currentNodeId !== n.nodeId) return s("not-current-node");
	let c = o, l = !1;
	return r === "start" ? (l = o === "available" || o === "in-progress", l && (c = "in-progress")) : r === "continue" ? l = o === "in-progress" : r === "mark-completed" ? (l = o === "available" || o === "in-progress" || o === "completed", l && (c = "completed")) : l = r === "defer" ? o === "available" : o === "completed", !l || !c ? s("invalid-concept-status") : (c !== o && (i.conceptStatusById = {
		...i.conceptStatusById,
		[n.nodeId]: c
	}), r === "mark-completed" && a.ownerSubjectId && qn(e, i, a.ownerSubjectId), i.lastConceptAction = Object.freeze({
		accepted: !0,
		kind: r,
		nodeId: n.nodeId,
		status: c
	}), i.lastRejection = null, X(i));
}
function ir(e, t, n) {
	let r = Rn(t);
	if (!e.nodeById.get(n.nodeId)) return Z(r, n, "unknown-node"), Q(r, {
		accepted: !1,
		sourceNodeId: t.currentNodeId,
		targetNodeId: n.nodeId,
		mode: "catch-up",
		routeNodeIds: [],
		requiredCompletionNodeIds: Object.freeze([]),
		reason: "unknown-node"
	}), X(r);
	let i = Wn(e, t, n.nodeId);
	if (!i) return Z(r, n, "no-authored-route"), Q(r, {
		accepted: !1,
		sourceNodeId: t.currentNodeId,
		targetNodeId: n.nodeId,
		mode: "catch-up",
		routeNodeIds: [],
		requiredCompletionNodeIds: Object.freeze([]),
		reason: "no-authored-route"
	}), X(r);
	let a = $n(e, n.nodeId, i);
	return r.lastMovementCancellation = null, Q(r, {
		accepted: !0,
		sourceNodeId: t.currentNodeId,
		targetNodeId: n.nodeId,
		mode: "catch-up",
		routeNodeIds: i,
		requiredCompletionNodeIds: a
	}), X(r);
}
function ar(e, t, n) {
	let r = Rn(t), i = e.nodeById.get(n.nodeId), a = Bn(e, t, n.nodeId);
	if (!i) Z(r, n, "unknown-node");
	else if (a === "locked") Z(r, n, "locked-node");
	else if (!er(e, n.nodeId, n.kind)) Z(r, n, "invalid-concept-status");
	else return r.pendingLearningIntent = Object.freeze({
		nodeId: n.nodeId,
		kind: n.kind
	}), Q(r, {
		accepted: !0,
		sourceNodeId: t.currentNodeId,
		targetNodeId: n.nodeId,
		mode: "direct",
		routeNodeIds: Object.freeze([t.currentNodeId, n.nodeId]),
		requiredCompletionNodeIds: Object.freeze([])
	}), X(r);
	return Q(r, {
		accepted: !1,
		sourceNodeId: t.currentNodeId,
		targetNodeId: n.nodeId,
		mode: "direct",
		routeNodeIds: [],
		requiredCompletionNodeIds: Object.freeze([]),
		reason: r.lastRejection?.reason ?? "unknown-node"
	}), X(r);
}
function or(e, t, n) {
	let r = t.pendingLearningIntent, i = t.learningLaunchRevision + 1;
	if (!r || r.nodeId !== n.nodeId || t.currentNodeId !== n.nodeId) {
		let e = Rn(t);
		return e.lastLearningLaunch = Object.freeze({
			accepted: !1,
			nodeId: n.nodeId,
			kind: r?.kind ?? "subject-enter",
			revision: i,
			reason: "not-current-node"
		}), e.learningLaunchRevision = i, Z(e, n, "not-current-node"), X(e);
	}
	if (r.kind === "subject-enter") {
		let e = Rn(t);
		return e.pendingLearningIntent = null, e.lastLearningLaunch = Object.freeze({
			...r,
			accepted: !0,
			revision: i
		}), e.learningLaunchRevision = i, e.lastRejection = null, X(e);
	}
	let a = rr(e, t, r.kind === "concept-start" ? {
		type: "CONCEPT.START.REQUESTED",
		nodeId: r.nodeId
	} : r.kind === "concept-continue" ? {
		type: "CONCEPT.CONTINUE.REQUESTED",
		nodeId: r.nodeId
	} : {
		type: "CONCEPT.REVIEW.REQUESTED",
		nodeId: r.nodeId
	}, r.kind === "concept-start" ? "start" : r.kind === "concept-continue" ? "continue" : "review"), o = Rn(a), s = a.lastConceptAction?.accepted === !0;
	return o.pendingLearningIntent = null, o.lastLearningLaunch = Object.freeze({
		...r,
		accepted: s,
		revision: i,
		...s ? {} : { reason: a.lastConceptAction?.reason ?? "invalid-concept-status" }
	}), o.learningLaunchRevision = i, X(o);
}
function sr(e, t, n) {
	if (n.type === "CATCH_UP.REQUESTED") return nr(e, t, n);
	if (n.type === "UNLOCK.REQUESTED") return ir(e, t, n);
	if (n.type === "LEARNING.REQUESTED") return ar(e, t, n);
	if (n.type === "LEARNING.SETTLED") return or(e, t, n);
	if (n.type === "CONCEPT.START.REQUESTED") return rr(e, t, n, "start");
	if (n.type === "CONCEPT.CONTINUE.REQUESTED") return rr(e, t, n, "continue");
	if (n.type === "CONCEPT.MARK_COMPLETED") return rr(e, t, n, "mark-completed");
	if (n.type === "CONCEPT.DEFERRED") return rr(e, t, n, "defer");
	if (n.type === "CONCEPT.REVIEW.REQUESTED") return rr(e, t, n, "review");
	let r = Rn(t), i = (e) => {
		let n = t.pendingUnlockCommit?.transactionId;
		return n !== void 0 && e !== n;
	};
	if (n.type === "UNLOCK.COMMIT.REGISTERED") {
		let i = t.lastNavigationDecision, a = n.commit, o = i?.requiredCompletionNodeIds.length === a.requiredCompletionNodeIds.length && i.requiredCompletionNodeIds.every((e, t) => a.requiredCompletionNodeIds[t] === e);
		!(a.transactionId.trim().length > 0 && i?.accepted === !0 && i.mode === "catch-up" && i.targetNodeId === a.targetNodeId && o && a.requiredCompletionNodeIds.every((t) => e.nodeById.has(t))) || t.pendingUnlockCommit !== null && t.pendingUnlockCommit.transactionId !== a.transactionId ? Z(r, n, "stale-transaction") : (r.pendingUnlockCommit = tr(a), r.lastMovementCancellation = null, r.lastRejection = null);
	} else if (n.type === "UNLOCK.DEPARTED") i(n.transactionId) ? Z(r, n, "stale-transaction") : (r.lastMovementCancellation = null, r.pendingUnlockCommit && Zn(e, r, r.pendingUnlockCommit), r.lastRejection = null);
	else if (n.type === "MOVEMENT.CANCELLED") {
		if (i(n.transactionId)) return Z(r, n, "stale-transaction"), X(r);
		let t = e.nodeById.get(n.safeNodeId), a = Bn(e, r, n.safeNodeId), o = r.pendingUnlockCommit?.targetNodeId ?? r.pendingLearningIntent?.nodeId ?? r.lastNavigationDecision?.targetNodeId ?? null;
		t && a !== null && a !== "locked" && (r.currentNodeId = n.safeNodeId, r.visitedNodeIds = {
			...r.visitedNodeIds,
			[n.safeNodeId]: !0
		}), r.pendingUnlockCommit = null, r.pendingLearningIntent = null, r.lastMovementCancellation = Object.freeze({
			reason: n.reason,
			safeNodeId: n.safeNodeId,
			targetNodeId: o
		}), r.lastRejection = null;
	} else if (n.type === "NODE.TRAVERSED") {
		if (i(n.transactionId)) return Z(r, n, "stale-transaction"), X(r);
		let a = t.pendingUnlockCommit, o = a?.targetNodeId !== n.nodeId && a?.requiredCompletionNodeIds.includes(n.nodeId), s = Bn(e, t, n.nodeId);
		(o && a ? Qn(e, r, a, n.nodeId) : s !== null && s !== "locked" && Jn(e, r, n.nodeId)) ? r.lastRejection = null : Z(r, n, s === "locked" ? "locked-node" : "unknown-node");
	} else if (n.type === "NAVIGATION.REQUESTED") {
		let i = e.nodeById.get(n.nodeId), a = Bn(e, t, n.nodeId);
		i ? a === "locked" ? (Z(r, n, "locked-node"), Q(r, {
			accepted: !1,
			sourceNodeId: t.currentNodeId,
			targetNodeId: n.nodeId,
			mode: "direct",
			routeNodeIds: [],
			requiredCompletionNodeIds: Object.freeze([]),
			reason: "locked-node"
		}), r.lastRejection = Object.freeze({
			eventType: n.type,
			nodeId: n.nodeId,
			reason: "locked-node"
		})) : Q(r, {
			accepted: !0,
			sourceNodeId: t.currentNodeId,
			targetNodeId: n.nodeId,
			mode: "direct",
			routeNodeIds: Object.freeze([t.currentNodeId, n.nodeId]),
			requiredCompletionNodeIds: Object.freeze([])
		}) : (Z(r, n, "unknown-node"), Q(r, {
			accepted: !1,
			sourceNodeId: t.currentNodeId,
			targetNodeId: n.nodeId,
			mode: "direct",
			routeNodeIds: [],
			requiredCompletionNodeIds: Object.freeze([]),
			reason: "unknown-node"
		}));
	} else if (n.type === "NODE.ARRIVED") {
		if (i(n.transactionId)) return Z(r, n, "stale-transaction"), X(r);
		let a = e.nodeById.get(n.nodeId), o = t.pendingUnlockCommit?.targetNodeId === n.nodeId;
		o && t.pendingUnlockCommit && (Xn(e, r, t.pendingUnlockCommit), Jn(e, r, n.nodeId));
		let s = Bn(e, r, n.nodeId);
		a ? s === "locked" ? Z(r, n, "locked-node") : (r.currentNodeId = n.nodeId, r.lastMovementCancellation = null, r.visitedNodeIds = {
			...r.visitedNodeIds,
			[n.nodeId]: !0
		}, o && (r.pendingUnlockCommit = null), r.lastRejection = null, e.goalIds.has(n.nodeId) ? (r.subjectStatusById[n.nodeId] !== "completed" && (r.subjectStatusById = {
			...r.subjectStatusById,
			[n.nodeId]: "completed"
		}), t.celebrationSeen || (r.celebrationSeen = !0, r.celebrationCount = t.celebrationCount + 1)) : a.entityKind === "subject" && r.subjectStatusById[n.nodeId] === "available" && ((e.conceptsBySubjectId.get(n.nodeId) ?? []).length === 0 ? (r.subjectStatusById = {
			...r.subjectStatusById,
			[n.nodeId]: "completed"
		}, zn(e, r.subjectStatusById)) : Kn(e, r, n.nodeId))) : Z(r, n, "unknown-node");
	}
	return X(r);
}
//#endregion
//#region src/application/learning-path/progressChild.ts
function cr(e) {
	let t = /* @__PURE__ */ new Map(), n = (n) => {
		let r = t.get(n);
		if (r) return r;
		let i = Pn(e(n));
		return t.clear(), t.set(n, i), i;
	};
	return i((e, t) => Object.freeze({
		revision: e.revision,
		model: sr(n(e.revision), e.model, t)
	}), ({ input: e }) => Object.freeze({
		revision: e.revision,
		model: e.initialContext ?? Ln(n(e.revision))
	}));
}
function lr(e, t) {
	return Ln(Pn(e(t)));
}
//#endregion
//#region src/application/learning-path/pathOrchestrationChild.ts
function ur(e) {
	let t = () => e().services, n = {
		planNavigation: (...e) => t().planNavigation(...e),
		planZoneReveal: (...e) => t().planZoneReveal(...e),
		planZoneDismiss: (...e) => t().planZoneDismiss(...e),
		commitNavigationBeforeAction: (...e) => t().commitNavigationBeforeAction(...e),
		commitNavigationStageStarted: (...e) => t().commitNavigationStageStarted(...e),
		commitNavigationAfterAction: (...e) => t().commitNavigationAfterAction(...e),
		commitNavigationStageArrived: (...e) => t().commitNavigationStageArrived(...e),
		cancelNavigationPlan: (...e) => t().cancelNavigationPlan?.(...e),
		commitZoneRevealBeforeAction: (...e) => t().commitZoneRevealBeforeAction(...e),
		commitZoneRevealStep: (...e) => t().commitZoneRevealStep(...e),
		commitZoneDismissStep: (...e) => t().commitZoneDismissStep(...e),
		executePresentation: (...e) => t().executePresentation(...e),
		executeMotion: (...e) => t().executeMotion(...e),
		executeCharacterForceSettle: (...e) => t().executeCharacterForceSettle?.(...e),
		get characterNaturalSettleTimeoutMs() {
			return t().characterNaturalSettleTimeoutMs;
		},
		get characterForceSettleAckTimeoutMs() {
			return t().characterForceSettleAckTimeoutMs;
		},
		onRecoveryStarted: (...e) => t().onRecoveryStarted?.(...e),
		prepareRecoveryInput: (...e) => t().prepareRecoveryInput(...e),
		executeRecoveryCommand: (...e) => t().executeRecoveryCommand(...e),
		finalizeRecovery: (...e) => t().finalizeRecovery(...e),
		cancelRecovery: (...e) => t().cancelRecovery(...e),
		get recoveryCommandTimeoutMs() {
			return t().recoveryCommandTimeoutMs;
		},
		get recoveryCharacterIdleTimeoutMs() {
			return t().recoveryCharacterIdleTimeoutMs;
		},
		onOperationRetry: (...e) => t().onOperationRetry?.(...e),
		onNavigationTransactionSettled: (...e) => t().onNavigationTransactionSettled?.(...e),
		onNavigationSettled: (...e) => t().onNavigationSettled?.(...e),
		onStandaloneZoneTransactionSettled: (...e) => t().onStandaloneZoneTransactionSettled?.(...e),
		onNavigationRejected: (...e) => t().onNavigationRejected?.(...e)
	}, r = /* @__PURE__ */ new WeakMap(), i = (e) => {
		let t = r.get(e.self);
		if (t) return t;
		let i = a(n);
		return r.set(e.self, i), i;
	};
	return {
		transition: (e, t, n) => i(n).transition(e, t, n),
		getInitialSnapshot: (e, t) => i(e).getInitialSnapshot(e, t),
		restoreSnapshot: (e, t) => i(t).restoreSnapshot(e, t),
		start: (t, n) => {
			e().bindActor(n.self), i(n).start(t);
		},
		getPersistedSnapshot: (e, t) => e.machine.getPersistedSnapshot(e, t)
	};
}
//#endregion
//#region src/application/learning-path/machine.ts
var dr = /* @__PURE__ */ new Set([
	"UNLOCK.DEPARTED",
	"NODE.TRAVERSED",
	"NODE.ARRIVED",
	"MOVEMENT.CANCELLED",
	"LEARNING.SETTLED",
	"CONCEPT.START.REQUESTED",
	"CONCEPT.CONTINUE.REQUESTED",
	"CONCEPT.MARK_COMPLETED",
	"CONCEPT.DEFERRED",
	"CONCEPT.REVIEW.REQUESTED"
]);
function fr(e) {
	return typeof e != "object" || !e || !("snapshot" in e) ? null : e.snapshot;
}
function pr(e) {
	return fr(e)?.context ?? null;
}
function mr(e) {
	return typeof e != "object" || !e || !("snapshot" in e) ? null : e.snapshot;
}
function hr(e) {
	return typeof e != "object" || !e || !("snapshot" in e) ? null : e.snapshot;
}
function gr(e) {
	return typeof e != "object" || !e || !("snapshot" in e) ? null : e.snapshot;
}
function _r(e) {
	return typeof e != "object" || !e || !("snapshot" in e) ? null : e.snapshot;
}
function vr(e) {
	return typeof e != "object" || !e || !("output" in e) ? null : e.output ?? null;
}
function yr(e) {
	switch (e.type) {
		case "PRESENTATION.STARTED": return {
			type: "PRESENTATION.STARTED",
			token: e.attemptId
		};
		case "PRESENTATION.SETTLED": return {
			type: "PRESENTATION.SETTLED",
			token: e.attemptId,
			transactionId: e.transactionId,
			operationId: e.operationId,
			attemptId: e.attemptId,
			attempt: e.attempt
		};
		case "PRESENTATION.FAILED": return {
			type: e.timedOut ? "PRESENTATION.TIMED_OUT" : "PRESENTATION.FAILED",
			token: e.attemptId,
			operationId: e.operationId,
			transactionId: e.transactionId,
			attemptId: e.attemptId,
			attempt: e.attempt,
			error: e.error
		};
		case "MOTION.DEPARTED": return e.nodeId ? {
			type: "MOTION.DEPARTED",
			token: e.attemptId,
			fromNodeId: e.nodeId,
			transactionId: e.transactionId,
			operationId: e.operationId,
			attemptId: e.attemptId,
			attempt: e.attempt
		} : null;
		case "MOTION.ARRIVED": return {
			type: "MOTION.ARRIVED",
			token: e.attemptId,
			nodeId: e.nodeId,
			transactionId: e.transactionId,
			operationId: e.operationId,
			attemptId: e.attemptId,
			attempt: e.attempt
		};
		case "MOTION.VISUAL_IDLE": return {
			type: "MOTION.VISUAL_IDLE",
			token: e.attemptId,
			nodeId: e.nodeId,
			transactionId: e.transactionId,
			operationId: e.operationId,
			attemptId: e.attemptId,
			attempt: e.attempt
		};
		case "MOTION.FAILED": return {
			type: e.timedOut ? "MOTION.TIMED_OUT" : "MOTION.FAILED",
			token: e.attemptId,
			operationId: e.operationId,
			transactionId: e.transactionId,
			attemptId: e.attemptId,
			attempt: e.attempt,
			error: e.error
		};
		case "CHARACTER.SETTLED": return {
			type: "CHARACTER.SETTLED",
			token: e.attemptId,
			transactionId: e.transactionId,
			operationId: e.operationId,
			attemptId: e.attemptId,
			attempt: e.attempt
		};
		case "CHARACTER.FAILED": return {
			type: "CHARACTER.FAILED",
			token: e.attemptId,
			transactionId: e.transactionId,
			operationId: e.operationId,
			attemptId: e.attemptId,
			attempt: e.attempt,
			error: e.error,
			timedOut: e.timedOut
		};
		default: return null;
	}
}
function br(e) {
	let t = e.data ? Bt(e.data) : null;
	if (typeof t != "object" || !t || !("source" in t)) throw Error(`No current CompiledLearningPath runtime data is registered for page revision "${e.revision}".`);
	let n = t.source;
	if (typeof n != "object" || !n || !("nodeById" in n) || !("edges" in n)) throw Error(`Page revision "${e.revision}" does not expose a valid data.source progression model.`);
	return n;
}
function xr(e) {
	return e.type === "APP.PROGRESS.EVENT" || e.type === "APP.JOURNEY.EVENT" || e.type === "APP.NODE_CARD.EVENT" || e.type === "APP.COMPLETION_CELEBRATION.EVENT" || e.type === "APP.SCENE_RUNTIME.COMMAND" || e.type === "APP.SCENE_SESSION.EVENT" || e.type === "APP.LEARNING_RESOURCE.EVENT" || e.type === "APP.LEARNING_RESOURCE.AFTER_PERSISTENCE.REQUESTED" || e.type === "APP.PERSISTENCE.FLUSH.REQUESTED";
}
function Sr(e, t) {
	let n = "sessionRevision" in t ? t.sessionRevision ?? null : null, r = t.type === "APP.PAGE.EVENT" && "transactionId" in t.event || t.type === "APP.JOURNEY.EVENT" && "transactionId" in t.event ? t.event.transactionId : t.type === "APP.SCENE_RUNTIME.COMMAND" ? t.command.transactionId : null;
	return Object.freeze({
		eventType: t.type,
		reason: e.activeExperience === null ? "inactive-experience" : t.type === "APP.PAGE.EVENT" ? "stale-generation-transaction" : "stale-session-revision",
		sessionRevision: n,
		transactionId: r
	});
}
function Cr(e) {
	let r = /* @__PURE__ */ new Map(), i = e.resolveCompiledLearningPath ?? (({ page: e }) => br(e)), a = nn({
		...e.pageGeneration,
		onGenerationReady: (t) => {
			let n = i({
				revision: t.revision,
				transactionId: t.transactionId,
				page: t.compiledPath
			});
			r.clear(), r.set(t.revision, n), e.pageGeneration.onGenerationReady?.(t);
		}
	}), c = cr((e) => {
		let t = r.get(e);
		if (!t) throw Error(`No progression model registered for revision "${e}".`);
		return t;
	}), l = On(e.journey), u = /* @__PURE__ */ new Map(), d = /* @__PURE__ */ new Map(), f = /* @__PURE__ */ new Map(), p = () => {
		let e = [...f.values()][0];
		if (!e) throw Error("No active path-orchestration runtime binding is registered.");
		return e;
	}, m = ur(p), h = kt((e) => {
		if (!u.get(e)) throw Error(`No active experience registered for scene session ${e}.`);
		let t = d.get(e);
		if (!t) throw Error(`No runtime input registered for scene session ${e}.`);
		return {
			sessionRevision: e,
			runtimePort: t.port,
			gatewayTimeoutMs: t.defaultTimeoutMs,
			gatewayScheduler: t.scheduler
		};
	}), g = bt(e.learningResource), _ = dt(e.learningProgressStorage), v = s(async ({ input: t, signal: n }) => {
		if (await e.reconcileRestoredProgress({
			...t.identity,
			safeNodeId: t.safeNodeId,
			signal: n
		}), n.aborted) throw new DOMException("Restored progress reconciliation was aborted.", "AbortError");
		return Object.freeze({ ...t });
	});
	return o({
		types: {},
		actors: {
			pageGeneration: a,
			progress: c,
			journey: l,
			nodeCard: gn,
			completionCelebration: An,
			sceneSession: h,
			learningResource: g,
			pathOrchestration: m,
			persistence: _,
			reconcileRestoredProgress: v
		},
		guards: {
			pageSnapshotIsNewReadyExperience: ({ context: e, event: t }) => {
				let n = fr(t);
				if (!n?.matches("ready")) return !1;
				let r = n.context;
				return r.revision !== null && r.transactionId !== null && r.compiledPath !== null && (e.activeExperience?.revision !== r.revision || e.activeExperience.transactionId !== r.transactionId);
			},
			pageSnapshotHasNewFailure: ({ context: e, event: t }) => {
				let n = pr(t)?.lastError;
				if (!n) return !1;
				let r = e.lastGenerationFailure;
				return !r || r.transactionId !== n.transactionId || r.revision !== n.revision || r.kind !== n.kind || r.message !== n.message;
			},
			pageEventMatchesGeneration: ({ context: e, event: t }) => t.type === "APP.PAGE.EVENT" ? "transactionId" in t.event ? e.generationTransactionId !== null && t.event.transactionId === e.generationTransactionId && (!("revision" in t.event) || e.generationRevision === null || t.event.revision === e.generationRevision) : !0 : !1,
			experienceRevisionMatches: ({ context: e, event: t }) => xr(t) && e.activeExperience !== null && t.sessionRevision === e.activeExperience.sessionRevision && (t.type !== "APP.SCENE_RUNTIME.COMMAND" || t.command.sessionRevision === t.sessionRevision) && (t.type !== "APP.SCENE_SESSION.EVENT" || t.event.sessionRevision === t.sessionRevision) && (t.type !== "APP.LEARNING_RESOURCE.EVENT" || t.event.sessionRevision === t.sessionRevision) && (t.type !== "APP.LEARNING_RESOURCE.AFTER_PERSISTENCE.REQUESTED" || t.event.sessionRevision === t.sessionRevision),
			degradationMatches: ({ context: e, event: t }) => t.type === "APP.RUNTIME.DEGRADED" && (t.sessionRevision === void 0 || e.activeExperience?.sessionRevision === t.sessionRevision),
			recoveryMatches: ({ context: e, event: t }) => t.type === "APP.RUNTIME.RECOVERED" && e.activeExperience !== null && (t.sessionRevision === void 0 || t.sessionRevision === e.activeExperience.sessionRevision),
			hasActiveExperience: ({ context: e }) => e.activeExperience !== null,
			journeyReadyRequiresNavigation: ({ context: e, event: t }) => {
				let n = mr(t), r = n?.context.plan, i = n?.context.transactionId;
				return !!(n?.matches("ready") && r && i && r.sourceNodeId !== r.targetNodeId && e.lastDispatchedJourneyTransactionId !== i);
			},
			journeyReadyIsAlreadyAtTarget: ({ context: e, event: t }) => {
				let n = mr(t), r = n?.context.plan, i = n?.context.transactionId;
				return !!(n?.matches("ready") && r && i && r.sourceNodeId === r.targetNodeId && e.lastDispatchedJourneyTransactionId !== i);
			},
			sceneSessionSnapshotHasNewMappableGatewayAck: ({ context: e, event: t }) => {
				let n = hr(t), r = n?.context.lastGatewayAck;
				return !!(n && r && n.context.gatewayAckSequence > e.lastRoutedGatewayAckSequence && yr(r) !== null);
			},
			sceneSessionSnapshotHasNewGatewayAck: ({ context: e, event: t }) => {
				let n = hr(t);
				return !!(n?.context.lastGatewayAck && n.context.gatewayAckSequence > e.lastRoutedGatewayAckSequence);
			},
			persistenceLoadedForActiveExperience: ({ context: e, event: t }) => {
				let n = e.activeExperience, r = _r(t)?.context;
				return !!(n && e.hydratedProgressContext === null && r?.loadResult && r.sessionRevision === n.sessionRevision && r.pathRevision === n.revision);
			},
			reconciliationMatchesActiveExperience: ({ context: e, event: t }) => {
				let n = e.activeExperience, r = vr(t);
				return !!(n && r && r.identity.sessionRevision === n.sessionRevision && r.identity.revision === n.revision && r.identity.transactionId === n.transactionId);
			},
			stableProgressEventMatchesExperience: ({ context: e, event: t }) => t.type === "APP.PROGRESS.EVENT" && e.activeExperience !== null && t.sessionRevision === e.activeExperience.sessionRevision && dr.has(t.event.type),
			hasHydratedProgress: ({ context: e }) => e.activeExperience !== null && e.hydratedProgressContext !== null,
			progressSnapshotHasPendingPersistenceSave: ({ context: e, event: t }) => {
				let n = e.activeExperience, r = gr(t);
				return !!(n && e.pendingPersistenceOperationId && r && r.context.revision === n.revision);
			},
			persistenceSnapshotHasNewFailure: ({ context: e, event: t }) => {
				let n = _r(t)?.context.lastFailure, r = e.lastPersistenceFailure;
				return !!(n && (r === null || n.correlation.operationId !== r.correlation.operationId || n.code !== r.code || n.phase !== r.phase));
			},
			persistenceCompletedPendingLearningResourceLaunch: ({ context: e, event: t }) => {
				let n = e.pendingLearningResourceLaunch, r = _r(t)?.context.lastCompletedCorrelation;
				return !!(n && r && r.operationId === n.persistenceOperationId && r.sessionRevision === e.activeExperience?.sessionRevision);
			},
			persistenceSnapshotHasNewCompletion: ({ context: e, event: t }) => {
				let n = _r(t)?.context.lastCompletedCorrelation;
				return !!(n && n.sessionRevision === e.activeExperience?.sessionRevision && n.operationId !== e.lastCompletedPersistenceOperationId);
			},
			deferredLearningResourceLaunchAlreadyPersisted: ({ context: e, event: t }) => t.type === "APP.LEARNING_RESOURCE.AFTER_PERSISTENCE.REQUESTED" && e.activeExperience !== null && t.sessionRevision === e.activeExperience.sessionRevision && t.event.sessionRevision === t.sessionRevision && e.lastPersistenceOperationId !== null && e.lastPersistenceOperationId === e.lastCompletedPersistenceOperationId
		},
		actions: {
			recordLaunchRequest: n(({ event: e }) => {
				if (e.type !== "APP.GENERATE.REQUESTED") return {};
				let t = e.progressStorageKey?.trim() || null;
				return {
					pendingLaunchMode: e.launchMode ?? "generate",
					pendingProgressStorageKey: t
				};
			}),
			sendGenerateRequest: t("pageGeneration", ({ event: e }) => e.type === "APP.GENERATE.REQUESTED" ? {
				type: "PAGE.GENERATE.REQUESTED",
				...e.template === void 0 ? {} : { template: e.template },
				...e.reducedMotion === void 0 ? {} : { reducedMotion: e.reducedMotion }
			} : { type: "PAGE.GENERATE.REQUESTED" }),
			sendGenerateRetry: t("pageGeneration", { type: "PAGE.GENERATE.RETRY_REQUESTED" }),
			routePageEvent: t("pageGeneration", ({ event: e }) => e.type === "APP.PAGE.EVENT" ? e.event : { type: "PAGE.GENERATE.RETRY_REQUESTED" }),
			routeProgressEvent: t("progress", ({ event: e }) => e.type === "APP.PROGRESS.EVENT" ? e.event : {
				type: "NAVIGATION.REQUESTED",
				nodeId: "invalid-node"
			}),
			routeJourneyEvent: t("journey", ({ event: e }) => e.type === "APP.JOURNEY.EVENT" ? e.event : { type: "RESET" }),
			routeJourneyNavigation: t("pathOrchestration", ({ event: e }) => ({
				type: "NAVIGATION.REQUESTED",
				targetNodeId: mr(e)?.context.plan?.targetNodeId ?? "invalid-node"
			})),
			beginSettledJourney: t("journey", ({ event: e }) => ({
				type: "MOVEMENT_STARTED",
				transactionId: mr(e)?.context.transactionId ?? "invalid-transaction"
			})),
			arriveSettledJourney: t("journey", ({ event: e }) => {
				let t = mr(e);
				return {
					type: "NODE_ARRIVED",
					transactionId: t?.context.transactionId ?? "invalid-transaction",
					nodeId: t?.context.plan?.targetNodeId ?? "invalid-node"
				};
			}),
			visuallySettleJourney: t("journey", ({ event: e }) => ({
				type: "VISUAL_SETTLED",
				transactionId: mr(e)?.context.transactionId ?? "invalid-transaction"
			})),
			recordJourneyDispatch: n(({ event: e }) => ({ lastDispatchedJourneyTransactionId: mr(e)?.context.transactionId ?? null })),
			routeNodeCardEvent: t("nodeCard", ({ event: e }) => e.type === "APP.NODE_CARD.EVENT" ? e.event : { type: "SESSION.RESET" }),
			routeCompletionCelebrationEvent: t("completionCelebration", ({ event: e }) => e.type === "APP.COMPLETION_CELEBRATION.EVENT" ? e.event : { type: "SESSION.RESET" }),
			routeProgressCelebrationCount: t("completionCelebration", ({ event: e }) => ({
				type: "PROGRESS.CELEBRATION_RECORDED",
				count: gr(e)?.context.model.celebrationCount ?? 0
			})),
			routeSceneRuntimeCommand: t("sceneSession", ({ event: e }) => e.type === "APP.SCENE_RUNTIME.COMMAND" ? e.command : { type: "MOTION.ABORT" }),
			routeSceneSessionEvent: t("sceneSession", ({ event: e }) => e.type === "APP.SCENE_SESSION.EVENT" ? e.event : {
				type: "SESSION.STOP",
				sessionRevision: -1
			}),
			routeSceneRuntimeAck: t("pathOrchestration", ({ event: e }) => {
				let t = hr(e)?.context.lastGatewayAck, n = t ? yr(t) : null;
				if (!n) throw Error("Cannot route an unmappable scene-runtime ACK.");
				return n;
			}),
			recordSceneRuntimeAckSequence: n(({ event: e }) => ({ lastRoutedGatewayAckSequence: hr(e)?.context.gatewayAckSequence ?? 0 })),
			routeLearningResourceEvent: t("learningResource", ({ event: e }) => e.type === "APP.LEARNING_RESOURCE.EVENT" ? e.event : {
				type: "SESSION.REVISION.CHANGED",
				sessionRevision: -1
			}),
			queueLearningResourceAfterPersistence: n(({ context: e, event: t }) => t.type !== "APP.LEARNING_RESOURCE.AFTER_PERSISTENCE.REQUESTED" || !e.lastPersistenceOperationId ? {} : { pendingLearningResourceLaunch: Object.freeze({
				persistenceOperationId: e.lastPersistenceOperationId,
				event: Object.freeze({
					...t.event,
					binding: Object.freeze({ ...t.event.binding })
				})
			}) }),
			routePersistedLearningResourceLaunch: t("learningResource", ({ context: e }) => {
				let t = e.pendingLearningResourceLaunch;
				if (!t) throw Error("Cannot launch a learning resource without a persisted request.");
				return t.event;
			}),
			routeAlreadyPersistedLearningResourceLaunch: t("learningResource", ({ event: e }) => {
				if (e.type !== "APP.LEARNING_RESOURCE.AFTER_PERSISTENCE.REQUESTED") throw Error("Cannot route an unrelated event as a learning resource launch.");
				return e.event;
			}),
			clearPendingLearningResourceLaunch: n({ pendingLearningResourceLaunch: null }),
			recordCompletedPersistenceOperation: n(({ event: e }) => ({ lastCompletedPersistenceOperationId: _r(e)?.context.lastCompletedCorrelation?.operationId ?? null })),
			armStablePersistenceSave: n(({ context: e, event: t }) => {
				if (t.type !== "APP.PROGRESS.EVENT" || !e.activeExperience) return {};
				let n = e.persistenceProgressRevision + 1;
				return {
					persistenceProgressRevision: n,
					pendingPersistenceOperationId: `progress:${e.activeExperience.sessionRevision}:${n}:${t.event.type}`
				};
			}),
			persistProgressSnapshot: t("persistence", ({ context: e, event: t }) => {
				let n = e.activeExperience, r = gr(t);
				if (!n || !r || !e.pendingPersistenceOperationId) throw Error("Cannot persist an uncorrelated progress snapshot.");
				return {
					type: "PERSISTENCE.SAVE.REQUESTED",
					sessionRevision: n.sessionRevision,
					pathRevision: n.revision,
					progressRevision: e.persistenceProgressRevision,
					operationId: e.pendingPersistenceOperationId,
					context: r.context.model,
					lastSafeNodeId: r.context.model.currentNodeId
				};
			}),
			recordPersistenceSaveDispatch: n(({ context: e }) => ({
				lastPersistenceOperationId: e.pendingPersistenceOperationId,
				pendingPersistenceOperationId: null
			})),
			flushPersistence: t("persistence", ({ context: e }) => {
				let t = e.activeExperience, n = e.lastPersistenceOperationId ?? `persistence-load:${t?.sessionRevision ?? -1}:none`;
				return {
					type: "PERSISTENCE.FLUSH.REQUESTED",
					sessionRevision: t?.sessionRevision ?? -1,
					pathRevision: t?.revision ?? "invalid-revision",
					progressRevision: e.persistenceProgressRevision,
					operationId: n
				};
			}),
			acceptHydratedProgress: n(({ context: e, event: t }) => {
				let n = _r(t)?.context, r = n?.loadResult;
				return !n || !r ? {} : {
					hydratedProgressContext: r.context,
					lastPersistenceFailure: n.lastFailure,
					lastPersistenceOperationId: n.pendingWrite?.operationId ?? e.lastPersistenceOperationId
				};
			}),
			prepareInteractiveBindings: ({ context: t }) => {
				let n = t.activeExperience;
				if (!n) throw Error("Interactive bindings require an active experience.");
				let r = e.createSceneRuntimeInput(n), i = e.createPathOrchestrationBinding(n);
				d.clear(), d.set(n.sessionRevision, r), f.clear(), f.set(n.sessionRevision, i);
			},
			recordPersistenceFailure: n(({ event: e }) => ({ lastPersistenceFailure: _r(e)?.context.lastFailure ?? null })),
			recordReconciliationFailure: n(({ event: e }) => ({ degradedReason: typeof e == "object" && e && "error" in e ? `Progress scene reconciliation failed: ${String(e.error)}` : "Progress scene reconciliation failed." })),
			bindPathOrchestrationActor: ({ self: e }) => {
				let t = e.getSnapshot().children.pathOrchestration;
				t && p().bindActor(t);
			},
			unbindPathOrchestrationActor: ({ self: e }) => {
				let t = [...f.values()][0], n = e.getSnapshot().children.pathOrchestration;
				t?.unbindActor(n);
			},
			activateExperience: n(({ context: e, event: t }) => {
				let n = pr(t);
				if (!n?.revision || !n.transactionId || !n.compiledPath) return {};
				let r = Object.freeze({
					revision: n.revision,
					transactionId: n.transactionId,
					initialNodeId: n.compiledPath.initialNodeId,
					sessionRevision: e.activationCount + 1,
					launchMode: e.pendingLaunchMode,
					progressStorageKey: e.pendingProgressStorageKey ?? `learning-path-progress:${n.revision}`
				});
				return u.clear(), u.set(r.sessionRevision, r), d.clear(), f.clear(), {
					generationTransactionId: n.transactionId,
					generationRevision: n.revision,
					activeExperience: r,
					activationCount: e.activationCount + 1,
					pendingLaunchMode: r.launchMode,
					pendingProgressStorageKey: r.progressStorageKey,
					hydratedProgressContext: null,
					persistenceProgressRevision: 0,
					pendingPersistenceOperationId: null,
					lastPersistenceOperationId: null,
					lastCompletedPersistenceOperationId: null,
					lastPersistenceFailure: null,
					pendingLearningResourceLaunch: null,
					lastDispatchedJourneyTransactionId: null,
					lastRoutedGatewayAckSequence: 0,
					lastGenerationFailure: null,
					degradedReason: null
				};
			}),
			recordGenerationFailure: n(({ event: e }) => ({
				generationTransactionId: pr(e)?.transactionId ?? null,
				generationRevision: pr(e)?.revision ?? null,
				lastGenerationFailure: pr(e)?.lastError ?? null
			})),
			observePageSnapshot: n(({ event: e }) => {
				let t = pr(e);
				return t ? {
					generationTransactionId: t.transactionId,
					generationRevision: t.revision
				} : {};
			}),
			recordIgnoredEvent: n(({ context: e, event: t }) => ({
				ignoredEventCount: e.ignoredEventCount + 1,
				lastIgnoredEvent: Sr(e, t)
			})),
			recordDegraded: n(({ event: e }) => ({ degradedReason: e.type === "APP.RUNTIME.DEGRADED" ? e.reason : "runtime-degraded" })),
			clearDegraded: n({ degradedReason: null }),
			resetApplication: n(() => (u.clear(), d.clear(), f.clear(), r.clear(), {
				activeExperience: null,
				pendingLaunchMode: "generate",
				pendingProgressStorageKey: null,
				hydratedProgressContext: null,
				persistenceProgressRevision: 0,
				pendingPersistenceOperationId: null,
				lastPersistenceOperationId: null,
				lastCompletedPersistenceOperationId: null,
				lastPersistenceFailure: null,
				pendingLearningResourceLaunch: null,
				generationTransactionId: null,
				generationRevision: null,
				lastDispatchedJourneyTransactionId: null,
				lastRoutedGatewayAckSequence: 0,
				lastGenerationFailure: null,
				degradedReason: null
			}))
		}
	}).createMachine({
		id: "learning-path-application",
		initial: "gate",
		context: ({ input: e }) => ({
			pageGenerationInput: Object.freeze({ ...e }),
			generationTransactionId: null,
			generationRevision: null,
			activeExperience: null,
			activationCount: 0,
			pendingLaunchMode: "generate",
			pendingProgressStorageKey: null,
			hydratedProgressContext: null,
			persistenceProgressRevision: 0,
			pendingPersistenceOperationId: null,
			lastPersistenceOperationId: null,
			lastCompletedPersistenceOperationId: null,
			lastPersistenceFailure: null,
			pendingLearningResourceLaunch: null,
			lastDispatchedJourneyTransactionId: null,
			lastRoutedGatewayAckSequence: 0,
			lastGenerationFailure: null,
			degradedReason: null,
			ignoredEventCount: 0,
			lastIgnoredEvent: null
		}),
		invoke: {
			id: "pageGeneration",
			src: "pageGeneration",
			input: ({ context: e }) => e.pageGenerationInput,
			onSnapshot: [
				{
					guard: "pageSnapshotIsNewReadyExperience",
					target: ".active",
					actions: "activateExperience"
				},
				{
					guard: "pageSnapshotHasNewFailure",
					target: ".generationFailed",
					actions: "recordGenerationFailure"
				},
				{ actions: "observePageSnapshot" }
			]
		},
		on: {
			"APP.PAGE.EVENT": [{
				guard: "pageEventMatchesGeneration",
				actions: "routePageEvent"
			}, { actions: "recordIgnoredEvent" }],
			"APP.RUNTIME.DEGRADED": [{
				guard: "degradationMatches",
				target: ".degraded",
				actions: "recordDegraded"
			}, { actions: "recordIgnoredEvent" }],
			"APP.RESET": {
				target: ".gate",
				actions: "resetApplication"
			}
		},
		states: {
			gate: { on: {
				"APP.GENERATE.REQUESTED": {
					target: "generating",
					actions: ["recordLaunchRequest", "sendGenerateRequest"]
				},
				"APP.GENERATE.RETRY_REQUESTED": {
					target: "generating",
					actions: "sendGenerateRetry"
				},
				"APP.PROGRESS.EVENT": { actions: "recordIgnoredEvent" },
				"APP.JOURNEY.EVENT": { actions: "recordIgnoredEvent" },
				"APP.NODE_CARD.EVENT": { actions: "recordIgnoredEvent" },
				"APP.COMPLETION_CELEBRATION.EVENT": { actions: "recordIgnoredEvent" },
				"APP.SCENE_RUNTIME.COMMAND": { actions: "recordIgnoredEvent" },
				"APP.SCENE_SESSION.EVENT": { actions: "recordIgnoredEvent" },
				"APP.LEARNING_RESOURCE.EVENT": { actions: "recordIgnoredEvent" },
				"APP.LEARNING_RESOURCE.AFTER_PERSISTENCE.REQUESTED": { actions: "recordIgnoredEvent" }
			} },
			generating: { on: {
				"APP.GENERATE.REQUESTED": { actions: "sendGenerateRequest" },
				"APP.GENERATE.RETRY_REQUESTED": { actions: "sendGenerateRetry" },
				"APP.PROGRESS.EVENT": { actions: "recordIgnoredEvent" },
				"APP.JOURNEY.EVENT": { actions: "recordIgnoredEvent" },
				"APP.NODE_CARD.EVENT": { actions: "recordIgnoredEvent" },
				"APP.COMPLETION_CELEBRATION.EVENT": { actions: "recordIgnoredEvent" },
				"APP.SCENE_RUNTIME.COMMAND": { actions: "recordIgnoredEvent" },
				"APP.SCENE_SESSION.EVENT": { actions: "recordIgnoredEvent" },
				"APP.LEARNING_RESOURCE.EVENT": { actions: "recordIgnoredEvent" },
				"APP.LEARNING_RESOURCE.AFTER_PERSISTENCE.REQUESTED": { actions: "recordIgnoredEvent" }
			} },
			active: {
				initial: "hydrating",
				exit: "unbindPathOrchestrationActor",
				invoke: {
					id: "persistence",
					src: "persistence",
					input: ({ context: t }) => {
						let n = t.activeExperience;
						if (!n) throw Error("Persistence requires an active experience.");
						return {
							storageKey: n.progressStorageKey || e.resolveLearningProgressStorageKey?.(n) || `learning-path-progress:${n.revision}`,
							sessionRevision: n.sessionRevision,
							pathRevision: n.revision,
							fallbackContext: lr((e) => {
								let t = r.get(e);
								if (!t) throw Error(`No progression model registered for persistence revision "${e}".`);
								return t;
							}, n.revision),
							fallbackSafeNodeId: n.initialNodeId,
							loadOperationId: `persistence-load:${n.sessionRevision}:${n.revision}`,
							debounceMs: e.persistenceDebounceMs
						};
					},
					onSnapshot: [
						{
							guard: "persistenceLoadedForActiveExperience",
							actions: "acceptHydratedProgress"
						},
						{
							guard: "persistenceCompletedPendingLearningResourceLaunch",
							actions: [
								"recordCompletedPersistenceOperation",
								"routePersistedLearningResourceLaunch",
								"clearPendingLearningResourceLaunch"
							]
						},
						{
							guard: "persistenceSnapshotHasNewCompletion",
							actions: "recordCompletedPersistenceOperation"
						},
						{
							guard: "persistenceSnapshotHasNewFailure",
							actions: "recordPersistenceFailure"
						}
					]
				},
				on: {
					"APP.GENERATE.REQUESTED": {
						target: ".draining",
						actions: [
							"recordLaunchRequest",
							"flushPersistence",
							"sendGenerateRequest"
						]
					},
					"APP.GENERATE.RETRY_REQUESTED": {
						target: ".draining",
						actions: ["flushPersistence", "sendGenerateRetry"]
					},
					"APP.PERSISTENCE.FLUSH.REQUESTED": [{
						guard: "experienceRevisionMatches",
						actions: "flushPersistence"
					}, { actions: "recordIgnoredEvent" }]
				},
				states: {
					draining: { on: {
						"APP.GENERATE.REQUESTED": { actions: [
							"recordLaunchRequest",
							"flushPersistence",
							"sendGenerateRequest"
						] },
						"APP.GENERATE.RETRY_REQUESTED": { actions: ["flushPersistence", "sendGenerateRetry"] },
						"APP.PROGRESS.EVENT": { actions: "recordIgnoredEvent" },
						"APP.JOURNEY.EVENT": { actions: "recordIgnoredEvent" },
						"APP.NODE_CARD.EVENT": { actions: "recordIgnoredEvent" },
						"APP.COMPLETION_CELEBRATION.EVENT": { actions: "recordIgnoredEvent" },
						"APP.SCENE_RUNTIME.COMMAND": { actions: "recordIgnoredEvent" },
						"APP.SCENE_SESSION.EVENT": { actions: "recordIgnoredEvent" },
						"APP.LEARNING_RESOURCE.EVENT": { actions: "recordIgnoredEvent" },
						"APP.LEARNING_RESOURCE.AFTER_PERSISTENCE.REQUESTED": { actions: "recordIgnoredEvent" }
					} },
					hydrating: {
						always: {
							guard: "hasHydratedProgress",
							target: "reconciling"
						},
						on: {
							"APP.PROGRESS.EVENT": { actions: "recordIgnoredEvent" },
							"APP.JOURNEY.EVENT": { actions: "recordIgnoredEvent" },
							"APP.NODE_CARD.EVENT": { actions: "recordIgnoredEvent" },
							"APP.COMPLETION_CELEBRATION.EVENT": { actions: "recordIgnoredEvent" },
							"APP.SCENE_RUNTIME.COMMAND": { actions: "recordIgnoredEvent" },
							"APP.SCENE_SESSION.EVENT": { actions: "recordIgnoredEvent" },
							"APP.LEARNING_RESOURCE.EVENT": { actions: "recordIgnoredEvent" },
							"APP.LEARNING_RESOURCE.AFTER_PERSISTENCE.REQUESTED": { actions: "recordIgnoredEvent" }
						}
					},
					reconciling: {
						invoke: {
							id: "reconcileRestoredProgress",
							src: "reconcileRestoredProgress",
							input: ({ context: e }) => {
								let t = e.activeExperience, n = e.hydratedProgressContext;
								if (!t || !n) throw Error("Restored progress reconciliation requires hydrated progress.");
								return {
									identity: t,
									safeNodeId: n.currentNodeId
								};
							},
							onDone: {
								guard: "reconciliationMatchesActiveExperience",
								actions: "prepareInteractiveBindings",
								target: "interactive"
							},
							onError: {
								actions: "recordReconciliationFailure",
								target: "#learning-path-application.degraded"
							}
						},
						on: {
							"APP.PROGRESS.EVENT": { actions: "recordIgnoredEvent" },
							"APP.JOURNEY.EVENT": { actions: "recordIgnoredEvent" },
							"APP.NODE_CARD.EVENT": { actions: "recordIgnoredEvent" },
							"APP.COMPLETION_CELEBRATION.EVENT": { actions: "recordIgnoredEvent" },
							"APP.SCENE_RUNTIME.COMMAND": { actions: "recordIgnoredEvent" },
							"APP.SCENE_SESSION.EVENT": { actions: "recordIgnoredEvent" },
							"APP.LEARNING_RESOURCE.EVENT": { actions: "recordIgnoredEvent" },
							"APP.LEARNING_RESOURCE.AFTER_PERSISTENCE.REQUESTED": { actions: "recordIgnoredEvent" }
						}
					},
					interactive: {
						invoke: [
							{
								id: "progress",
								src: "progress",
								input: ({ context: e }) => ({
									revision: e.activeExperience?.revision ?? "invalid-revision",
									initialContext: e.hydratedProgressContext ?? void 0
								}),
								onSnapshot: [{
									guard: "progressSnapshotHasPendingPersistenceSave",
									actions: [
										"persistProgressSnapshot",
										"recordPersistenceSaveDispatch",
										"routeProgressCelebrationCount"
									]
								}, { actions: "routeProgressCelebrationCount" }]
							},
							{
								id: "journey",
								src: "journey",
								input: ({ context: e }) => ({ currentNodeId: e.hydratedProgressContext?.currentNodeId ?? e.activeExperience?.initialNodeId ?? "invalid-node" }),
								onSnapshot: [{
									guard: "journeyReadyRequiresNavigation",
									actions: ["recordJourneyDispatch", "routeJourneyNavigation"]
								}, {
									guard: "journeyReadyIsAlreadyAtTarget",
									actions: [
										"recordJourneyDispatch",
										"beginSettledJourney",
										"arriveSettledJourney",
										"visuallySettleJourney"
									]
								}]
							},
							{
								id: "nodeCard",
								src: "nodeCard",
								input: {}
							},
							{
								id: "completionCelebration",
								src: "completionCelebration",
								input: ({ context: e }) => ({ restoredCount: e.hydratedProgressContext?.celebrationCount ?? 0 })
							},
							{
								id: "sceneSession",
								src: "sceneSession",
								input: ({ context: e }) => {
									let t = e.activeExperience;
									if (!t) throw Error("Scene session requires an active experience.");
									let n = d.get(t.sessionRevision);
									if (!n) throw Error(`No runtime input registered for scene session ${t.sessionRevision}.`);
									return {
										sessionRevision: t.sessionRevision,
										runtimePort: n.port,
										gatewayTimeoutMs: n.defaultTimeoutMs,
										gatewayScheduler: n.scheduler
									};
								},
								onSnapshot: [{
									guard: "sceneSessionSnapshotHasNewMappableGatewayAck",
									actions: ["routeSceneRuntimeAck", "recordSceneRuntimeAckSequence"]
								}, {
									guard: "sceneSessionSnapshotHasNewGatewayAck",
									actions: "recordSceneRuntimeAckSequence"
								}]
							},
							{
								id: "learningResource",
								src: "learningResource",
								input: ({ context: e }) => ({ sessionRevision: e.activeExperience?.sessionRevision ?? -1 })
							},
							{
								id: "pathOrchestration",
								src: "pathOrchestration",
								input: ({ context: e }) => ({
									...p().input,
									initialNodeId: e.hydratedProgressContext?.currentNodeId ?? e.activeExperience?.initialNodeId ?? "invalid-node"
								}),
								onSnapshot: { actions: "bindPathOrchestrationActor" }
							}
						],
						on: {
							"APP.PROGRESS.EVENT": [
								{
									guard: "stableProgressEventMatchesExperience",
									actions: ["armStablePersistenceSave", "routeProgressEvent"]
								},
								{
									guard: "experienceRevisionMatches",
									actions: "routeProgressEvent"
								},
								{ actions: "recordIgnoredEvent" }
							],
							"APP.COMPLETION_CELEBRATION.EVENT": [{
								guard: "experienceRevisionMatches",
								actions: "routeCompletionCelebrationEvent"
							}, { actions: "recordIgnoredEvent" }],
							"APP.JOURNEY.EVENT": [{
								guard: "experienceRevisionMatches",
								actions: "routeJourneyEvent"
							}, { actions: "recordIgnoredEvent" }],
							"APP.NODE_CARD.EVENT": [{
								guard: "experienceRevisionMatches",
								actions: "routeNodeCardEvent"
							}, { actions: "recordIgnoredEvent" }],
							"APP.SCENE_RUNTIME.COMMAND": [{
								guard: "experienceRevisionMatches",
								actions: "routeSceneRuntimeCommand"
							}, { actions: "recordIgnoredEvent" }],
							"APP.SCENE_SESSION.EVENT": [{
								guard: "experienceRevisionMatches",
								actions: "routeSceneSessionEvent"
							}, { actions: "recordIgnoredEvent" }],
							"APP.LEARNING_RESOURCE.EVENT": [{
								guard: "experienceRevisionMatches",
								actions: "routeLearningResourceEvent"
							}, { actions: "recordIgnoredEvent" }],
							"APP.LEARNING_RESOURCE.AFTER_PERSISTENCE.REQUESTED": [
								{
									guard: "deferredLearningResourceLaunchAlreadyPersisted",
									actions: "routeAlreadyPersistedLearningResourceLaunch"
								},
								{
									guard: "experienceRevisionMatches",
									actions: ["queueLearningResourceAfterPersistence", "flushPersistence"]
								},
								{ actions: "recordIgnoredEvent" }
							]
						}
					}
				}
			},
			generationFailed: { on: {
				"APP.GENERATE.REQUESTED": {
					target: "generating",
					actions: ["recordLaunchRequest", "sendGenerateRequest"]
				},
				"APP.GENERATE.RETRY_REQUESTED": {
					target: "generating",
					actions: "sendGenerateRetry"
				},
				"APP.PROGRESS.EVENT": { actions: "recordIgnoredEvent" },
				"APP.JOURNEY.EVENT": { actions: "recordIgnoredEvent" },
				"APP.NODE_CARD.EVENT": { actions: "recordIgnoredEvent" },
				"APP.COMPLETION_CELEBRATION.EVENT": { actions: "recordIgnoredEvent" },
				"APP.SCENE_RUNTIME.COMMAND": { actions: "recordIgnoredEvent" },
				"APP.SCENE_SESSION.EVENT": { actions: "recordIgnoredEvent" },
				"APP.LEARNING_RESOURCE.EVENT": { actions: "recordIgnoredEvent" },
				"APP.LEARNING_RESOURCE.AFTER_PERSISTENCE.REQUESTED": { actions: "recordIgnoredEvent" }
			} },
			degraded: { on: {
				"APP.RUNTIME.RECOVERED": [{
					guard: "recoveryMatches",
					target: "active",
					actions: "clearDegraded"
				}, { actions: "recordIgnoredEvent" }],
				"APP.GENERATE.REQUESTED": {
					target: "generating",
					actions: ["recordLaunchRequest", "sendGenerateRequest"]
				},
				"APP.GENERATE.RETRY_REQUESTED": {
					target: "generating",
					actions: "sendGenerateRetry"
				},
				"APP.PROGRESS.EVENT": { actions: "recordIgnoredEvent" },
				"APP.JOURNEY.EVENT": { actions: "recordIgnoredEvent" },
				"APP.NODE_CARD.EVENT": { actions: "recordIgnoredEvent" },
				"APP.COMPLETION_CELEBRATION.EVENT": { actions: "recordIgnoredEvent" },
				"APP.SCENE_RUNTIME.COMMAND": { actions: "recordIgnoredEvent" },
				"APP.SCENE_SESSION.EVENT": { actions: "recordIgnoredEvent" },
				"APP.LEARNING_RESOURCE.EVENT": { actions: "recordIgnoredEvent" },
				"APP.LEARNING_RESOURCE.AFTER_PERSISTENCE.REQUESTED": { actions: "recordIgnoredEvent" }
			} }
		}
	});
}
function wr(e, t = {}) {
	let n = r(Cr(e), {
		input: t.input ?? {},
		...t.inspect ? { inspect: t.inspect } : {}
	});
	return n.start(), n;
}
//#endregion
//#region src/application/learning-path/selectors.ts
var Tr = Object.freeze([
	"gate",
	"generating",
	"generationFailed",
	"degraded"
]);
function Er(e) {
	return e.matches({ active: "interactive" }) ? "active" : e.matches({ active: "hydrating" }) || e.matches({ active: "reconciling" }) ? "restoring" : e.matches({ active: "draining" }) ? "generating" : Tr.find((t) => e.matches(t)) ?? "gate";
}
function Dr(e) {
	return e.context.activeExperience?.sessionRevision ?? null;
}
function Or(e) {
	return e.children.progress ?? null;
}
function kr(e) {
	return e.children.journey ?? null;
}
function Ar(e) {
	return e.children.nodeCard ?? null;
}
function jr(e) {
	return e.children.completionCelebration ?? null;
}
function Mr(e) {
	let t = jr(e);
	return t ? Nn(t.getSnapshot()) : null;
}
function Nr(e) {
	return e.children.sceneSession ?? null;
}
function Pr(e) {
	return e.children.pathOrchestration ?? null;
}
//#endregion
//#region src/application/shared/subscribeActorSelector.ts
function Fr(e, t, n, r = {}) {
	let i = r.equals ?? Object.is, a = t(e.getSnapshot());
	return r.emitInitial && n(a, null), e.subscribe((e) => {
		let r = t(e);
		if (i(a, r)) return;
		let o = a;
		a = r, n(r, o);
	});
}
//#endregion
//#region src/infrastructure/browser/LearningResourceNavigator.ts
function Ir() {
	return new DOMException("Learning resource navigation was cancelled.", "AbortError");
}
function Lr(e, t) {
	try {
		let n = new URL(e, t);
		return n.protocol === "http:" || n.protocol === "https:" ? n : null;
	} catch {
		return null;
	}
}
var Rr = class {
	browserWindow;
	constructor(e = window) {
		this.browserWindow = e;
	}
	navigate(e, t) {
		if (t.signal.aborted) throw Ir();
		let n = Lr(e.binding.href, this.browserWindow.location.href);
		if (!n) return Object.freeze({
			status: "invalid-url",
			message: "Only valid HTTP(S) learning-resource URLs are allowed."
		});
		try {
			if (e.binding.target === "blank") {
				if (this.browserWindow.open(n.href, "_blank", "noopener,noreferrer") === null) return Object.freeze({
					status: "popup-blocked",
					resolvedHref: n.href,
					message: "The browser blocked the learning-resource window."
				});
			} else this.browserWindow.location.assign(n.href);
			return Object.freeze({
				status: "accepted",
				resolvedHref: n.href
			});
		} catch (e) {
			return Object.freeze({
				status: "failed",
				resolvedHref: n.href,
				message: e instanceof Error ? e.message : "Browser navigation failed."
			});
		}
	}
};
function zr(e) {
	return new Rr(e);
}
//#endregion
//#region src/infrastructure/browser/BrowserLearningProgressStorage.ts
function Br() {
	return new et("aborted", "Learning progress storage operation was aborted.");
}
function Vr(e, t) {
	if (e instanceof et) return e;
	let n = typeof e == "object" && e && "name" in e ? String(e.name) : "";
	return n === "SecurityError" ? new et("security-error", "Browser storage access was denied.", { cause: e }) : n === "QuotaExceededError" || n === "NS_ERROR_DOM_QUOTA_REACHED" ? new et("quota-exceeded", "Browser storage quota was exceeded.", { cause: e }) : new et(t === "read" ? "read-failed" : "write-failed", `Browser storage ${t} failed.`, { cause: e });
}
var Hr = class {
	#e;
	constructor(e = () => {
		if (globalThis.localStorage === void 0) throw new et("storage-unavailable", "Browser localStorage is unavailable.");
		return globalThis.localStorage;
	}) {
		this.#e = e;
	}
	read(e, t) {
		if (t.signal.aborted) throw Br();
		try {
			let n = this.#e().getItem(e.key);
			if (t.signal.aborted) throw Br();
			return n;
		} catch (e) {
			throw Vr(e, "read");
		}
	}
	write(e, t) {
		if (t.signal.aborted) throw Br();
		try {
			if (this.#e().setItem(e.key, e.value), t.signal.aborted) throw Br();
		} catch (e) {
			throw Vr(e, "write");
		}
	}
}, Ur = /* @__PURE__ */ new Set([
	"__proto__",
	"constructor",
	"prototype"
]);
function Wr(e, t) {
	if (typeof e != "object" || !e || Array.isArray(e)) throw TypeError(`${t} 必须是普通 JSON 对象。`);
	let n = Object.getPrototypeOf(e);
	if (n !== Object.prototype && n !== null) throw TypeError(`${t} 不能包含类实例或自定义原型。`);
}
function Gr(e, t, n) {
	let r = new Set(t);
	for (let t of Reflect.ownKeys(e)) if (typeof t != "string" || !r.has(t)) throw TypeError(`${n} 包含未列入白名单的字段 ${String(t)}。`);
}
function Kr(e, t, n) {
	let r = Object.getOwnPropertyDescriptor(e, t);
	if (!r || !("value" in r) || !r.enumerable) throw TypeError(`${n}.${t} 必须是可枚举的数据属性。`);
	return r.value;
}
function qr(e) {
	let t = /* @__PURE__ */ new WeakSet(), n = (e, r) => {
		if (e === null || typeof e == "string" || typeof e == "boolean") return e;
		if (typeof e == "number") {
			if (!Number.isFinite(e)) throw TypeError(`${r} 包含非有限数值。`);
			return e;
		}
		if (typeof e != "object") throw TypeError(`${r} 不是合法 JSON 值。`);
		if (t.has(e)) throw TypeError(`${r} 包含循环引用。`);
		t.add(e);
		try {
			if (Array.isArray(e)) {
				let t = Reflect.ownKeys(e);
				for (let e of t) if (e !== "length" && (typeof e != "string" || !/^(?:0|[1-9]\d*)$/.test(e))) throw TypeError(`${r} 包含非 JSON 数组字段 ${String(e)}。`);
				let i = [];
				for (let t = 0; t < e.length; t += 1) {
					let a = Object.getOwnPropertyDescriptor(e, String(t));
					if (!a || !("value" in a) || !a.enumerable) throw TypeError(`${r}[${t}] 必须是可枚举的数据属性。`);
					i.push(n(a.value, `${r}[${t}]`));
				}
				return i;
			}
			Wr(e, r);
			let t = Object.create(null);
			for (let i of Reflect.ownKeys(e)) {
				if (typeof i != "string" || Ur.has(i)) throw TypeError(`${r} 包含不安全字段 ${String(i)}。`);
				let a = Object.getOwnPropertyDescriptor(e, i);
				if (!a || !("value" in a) || !a.enumerable) throw TypeError(`${r}.${i} 必须是可枚举的数据属性。`);
				t[i] = n(a.value, `${r}.${i}`);
			}
			return t;
		} finally {
			t.delete(e);
		}
	};
	return n(e, "$document");
}
//#endregion
//#region src/host/learning-path/templateLoader.ts
var Jr = /^(?:application|text)\/(?:[a-z0-9!#$&^_.+-]+\+)?json$/i;
function Yr(e, t) {
	return Object.prototype.hasOwnProperty.call(e, t);
}
function Xr(e) {
	if ([
		"document",
		"documentUrl",
		"documentProvider"
	].filter((t) => Yr(e, t)).length > 1) throw TypeError("document、documentUrl、documentProvider 只能配置一个。");
	if (Yr(e, "documentUrl") && (typeof e.documentUrl != "string" || e.documentUrl.trim() === "")) throw TypeError("documentUrl 必须是非空字符串。");
	if (Yr(e, "documentProvider") && typeof e.documentProvider != "function") throw TypeError("documentProvider 必须是函数。");
}
function Zr(e, t) {
	if (!e) return /* @__PURE__ */ new Set([t.origin]);
	let n = /* @__PURE__ */ new Set([t.origin]);
	for (let r of e) {
		if (typeof r != "string" || r.trim() === "") throw TypeError("allowedDocumentOrigins 只能包含非空 URL 字符串。");
		let e = new URL(r, t);
		if (!/^https?:$/.test(e.protocol) || e.username || e.password) throw TypeError(`不允许的 JSON 来源：${r}`);
		n.add(e.origin);
	}
	return n;
}
async function Qr(e, t) {
	if (Xr(e), t.signal.aborted) throw new DOMException("Template request cancelled.", "AbortError");
	if (Yr(e, "document")) return qr(e.document);
	if (Yr(e, "documentProvider")) {
		let n = e.documentProvider;
		if (typeof n != "function") throw TypeError("documentProvider 必须是函数。");
		let r = await n({ signal: t.signal });
		if (t.signal.aborted) throw new DOMException("Template request cancelled.", "AbortError");
		return qr(r);
	}
	let n = new URL(t.baseUrl), r = Yr(e, "documentUrl") ? e.documentUrl : t.defaultDocumentUrl;
	if (typeof r != "string") throw TypeError("documentUrl 必须是非空字符串。");
	let i = new URL(r, n);
	if (!/^https?:$/.test(i.protocol) || i.username || i.password) throw TypeError(`学习路径 JSON 只允许 http(s) URL：${i.href}`);
	if (!Zr(e.allowedDocumentOrigins, n).has(i.origin)) throw TypeError(`学习路径 JSON 来源未列入白名单：${i.origin}`);
	let a = await (t.fetcher ?? fetch)(i.href, {
		signal: t.signal,
		headers: { Accept: "application/json" },
		credentials: i.origin === n.origin ? "same-origin" : "omit"
	});
	if (!a.ok) throw Error(`HTTP ${a.status}`);
	let o = a.headers.get("content-type")?.split(";", 1)[0]?.trim();
	if (!o || !Jr.test(o)) throw TypeError(`学习路径响应必须使用 JSON Content-Type，当前为 ${o || "缺失"}。`);
	return qr(await a.json());
}
function $r(e) {
	let t = new URL({
		BASE_URL: "/",
		DEV: !1,
		MODE: "production",
		PROD: !0,
		SSR: !1
	}.BASE_URL ?? "./", e);
	return new URL("data/default-learning-path.json", t).href;
}
//#endregion
//#region src/host/learning-path/contracts.ts
var ei = "__LEARNING_PATH_PAGE_CONFIG__", ti = "learning-path-page";
//#endregion
//#region src/host/learning-path/windowConfig.ts
function ni(e) {
	let t = `$window.${ei}`;
	if (Wr(e, t), Gr(e, [
		"protocol",
		"version",
		"source"
	], t), Kr(e, "protocol", t) !== "learning-path-page") throw TypeError(`宿主协议必须是 ${ti}。`);
	if (Kr(e, "version", t) !== "1.0") throw TypeError("宿主协议版本必须是 1.0。");
	let n = "$window.__LEARNING_PATH_PAGE_CONFIG__.source", r = Kr(e, "source", t);
	Wr(r, n);
	let i = Kr(r, "kind", n);
	if (i === "document") return Gr(r, ["kind", "document"], n), { document: qr(Kr(r, "document", n)) };
	if (i === "url") {
		Gr(r, ["kind", "documentUrl"], n);
		let e = Kr(r, "documentUrl", n);
		if (typeof e != "string" || e.trim() === "") throw TypeError("宿主 documentUrl 必须是非空字符串。");
		return { documentUrl: e };
	}
	throw TypeError("宿主 source.kind 只能是 document 或 url。");
}
function ri(e) {
	let t = Object.getOwnPropertyDescriptor(e, ei);
	if (!t) return null;
	if (!("value" in t)) throw TypeError(`${ei} 不能使用 getter/setter。`);
	return ni(t.value);
}
//#endregion
//#region src/diagnostics/LearningPathXStateInspector.ts
async function ii(e) {
	return null;
}
//#endregion
//#region src/progression/domain/selectors.ts
function ai(e) {
	return "context" in e ? e.context : e;
}
function oi(e) {
	let t = ai(e), n = Object.freeze({
		...t.subjectStatusById,
		...t.conceptStatusById
	}), r = new Set(t.goalNodeIds), i = {};
	for (let [e, n] of Object.entries(t.subjectStatusById)) i[e] = Object.freeze({
		kind: r.has(e) ? "goal" : "subject",
		status: n
	});
	for (let [e, n] of Object.entries(t.conceptStatusById)) i[e] = Object.freeze({
		kind: "concept",
		status: n
	});
	return Object.freeze({
		currentNodeId: t.currentNodeId,
		nodeStatusById: n,
		nodeLearningStateById: Object.freeze(i),
		subjectStatusById: Fn({ ...t.subjectStatusById }),
		conceptStatusById: Fn({ ...t.conceptStatusById }),
		celebration: Object.freeze({
			seen: t.celebrationSeen,
			count: t.celebrationCount
		}),
		lastNavigationDecision: t.lastNavigationDecision,
		lastCatchUpResult: t.lastCatchUpResult,
		lastConceptAction: t.lastConceptAction,
		pendingLearningIntent: t.pendingLearningIntent,
		lastLearningLaunch: t.lastLearningLaunch,
		pendingUnlockCommit: t.pendingUnlockCommit,
		lastMovementCancellation: t.lastMovementCancellation,
		lastRejection: t.lastRejection
	});
}
//#endregion
//#region src/progression/presentation/NodeLearningPatchProjector.ts
function si(e) {
	let t = e.context.model;
	return Object.freeze({
		goalNodeIds: t.goalNodeIds,
		subjectStatusById: t.subjectStatusById,
		conceptStatusById: t.conceptStatusById
	});
}
function ci(e, t) {
	if (e === t) return !0;
	let n = Object.keys(e), r = Object.keys(t);
	return n.length === r.length && n.every((n) => e[n] === t[n]);
}
function li(e, t) {
	return (e.goalNodeIds === t.goalNodeIds || e.goalNodeIds.length === t.goalNodeIds.length && e.goalNodeIds.every((e, n) => e === t.goalNodeIds[n])) && ci(e.subjectStatusById, t.subjectStatusById) && ci(e.conceptStatusById, t.conceptStatusById);
}
function ui(e, t) {
	return e?.kind === t.kind && e.status === t.status;
}
var di = class {
	presentedByNodeId = /* @__PURE__ */ new Map();
	initialized = !1;
	project(e) {
		let t = new Set(e.goalNodeIds), n = [];
		for (let [r, i] of Object.entries(e.subjectStatusById)) {
			let e = Object.freeze({
				kind: t.has(r) ? "goal" : "subject",
				status: i
			});
			(!this.initialized || !ui(this.presentedByNodeId.get(r), e)) && (this.presentedByNodeId.set(r, e), n.push(Object.freeze({
				nodeId: r,
				learningState: e
			})));
		}
		for (let [t, r] of Object.entries(e.conceptStatusById)) {
			let e = Object.freeze({
				kind: "concept",
				status: r
			});
			(!this.initialized || !ui(this.presentedByNodeId.get(t), e)) && (this.presentedByNodeId.set(t, e), n.push(Object.freeze({
				nodeId: t,
				learningState: e
			})));
		}
		let r = this.initialized ? "patch" : "replace";
		return this.initialized = !0, Object.freeze({
			type: r,
			changes: Object.freeze(n)
		});
	}
}, fi = Object.freeze({ actionRequested: "learning-path:contextual-card-action" }), pi = Object.freeze({ settled: "learning-path:completion-celebration-settled" }), mi = "data-learning-path-celebration-styles", hi = /* @__PURE__ */ new WeakMap(), gi = [
	"#ffd33d",
	"#42d66b",
	"#ffffff",
	"#d78224",
	"#73c8ff"
], _i = 26, vi = "\n[data-learning-path-root] .lp-completion-celebration {\n  position: absolute;\n  z-index: 20;\n  inset: 0;\n  display: grid;\n  place-items: center;\n  overflow: hidden;\n  pointer-events: none;\n  font-family: Inter, ui-rounded, \"SF Pro Rounded\", \"PingFang SC\", \"Microsoft YaHei\", system-ui, sans-serif;\n}\n[data-learning-path-root] .lp-completion-celebration[hidden] { display: none; }\n[data-learning-path-root] .lp-completion-celebration__halo {\n  position: absolute;\n  width: min(66%, 570px);\n  aspect-ratio: 1;\n  border-radius: 50%;\n  background: radial-gradient(circle, rgb(255 215 59 / 26%), rgb(255 215 59 / 7%) 43%, transparent 69%);\n  opacity: 0;\n}\n[data-learning-path-root] .lp-completion-celebration__message {\n  position: relative;\n  max-width: min(470px, calc(100% - 32px));\n  border: 1px solid rgb(255 255 255 / 86%);\n  border-radius: 24px;\n  padding: 22px 27px 24px;\n  color: #27352c;\n  background: rgb(255 255 255 / 92%);\n  box-shadow: 0 22px 60px rgb(42 66 49 / 20%), 0 7px 0 rgb(223 229 224 / 92%);\n  opacity: 0;\n  text-align: center;\n  backdrop-filter: blur(18px) saturate(1.08);\n}\n[data-learning-path-root] .lp-completion-celebration__mark {\n  display: grid;\n  width: 58px;\n  height: 58px;\n  margin: -51px auto 12px;\n  place-items: center;\n  border: 5px solid #fff;\n  border-radius: 50%;\n  color: #fff;\n  background: linear-gradient(180deg, #48d96e, #21af4d);\n  box-shadow: 0 7px 0 #12883a, 0 12px 22px rgb(25 138 62 / 28%);\n  font-size: 30px;\n  font-weight: 900;\n}\n[data-learning-path-root] .lp-completion-celebration__title { margin: 0; font-size: clamp(25px, 4cqw, 38px); font-weight: 900; letter-spacing: -.035em; line-height: 1.13; }\n[data-learning-path-root] .lp-completion-celebration__body { margin: 9px 0 0; color: #667168; font-size: 14px; font-weight: 620; line-height: 1.55; }\n[data-learning-path-root] .lp-completion-celebration__body[hidden] { display: none; }\n[data-learning-path-root] .lp-completion-celebration__confetti {\n  position: absolute;\n  top: -8cqh;\n  left: var(--lp-confetti-x);\n  width: var(--lp-confetti-w);\n  height: var(--lp-confetti-h);\n  border-radius: 2px;\n  background: var(--lp-confetti-color);\n  opacity: 0;\n  transform: translate3d(0, -8cqh, 0) rotate(var(--lp-confetti-turn));\n}\n[data-learning-path-root] .lp-completion-celebration[data-active=\"true\"] .lp-completion-celebration__halo { animation: lp-celebration-halo 1450ms cubic-bezier(.16,.8,.24,1) both; }\n[data-learning-path-root] .lp-completion-celebration[data-active=\"true\"] .lp-completion-celebration__message { animation: lp-celebration-message 1700ms cubic-bezier(.16,.82,.24,1) both; }\n[data-learning-path-root] .lp-completion-celebration[data-active=\"true\"] .lp-completion-celebration__confetti { animation: lp-celebration-confetti 1540ms cubic-bezier(.18,.72,.28,1) var(--lp-confetti-delay) both; }\n@keyframes lp-celebration-halo {\n  0% { opacity: 0; transform: scale(.35); }\n  27% { opacity: 1; transform: scale(1); }\n  100% { opacity: 0; transform: scale(1.22); }\n}\n@keyframes lp-celebration-message {\n  0% { opacity: 0; transform: translate3d(0, 18px, 0) scale(.84); }\n  18%, 76% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }\n  100% { opacity: 0; transform: translate3d(0, -9px, 0) scale(.985); }\n}\n@keyframes lp-celebration-confetti {\n  0% { opacity: 0; transform: translate3d(0, -8cqh, 0) rotate(0); }\n  9% { opacity: 1; }\n  100% { opacity: 0; transform: translate3d(var(--lp-confetti-drift), 112cqh, 0) rotate(var(--lp-confetti-spin)); }\n}\n[data-learning-path-root] .lp-completion-celebration[data-reduced-motion=\"true\"] .lp-completion-celebration__confetti { display: none; }\n[data-learning-path-root] .lp-completion-celebration[data-reduced-motion=\"true\"][data-active=\"true\"] .lp-completion-celebration__halo { animation: lp-celebration-halo-reduced 700ms ease-out both; }\n[data-learning-path-root] .lp-completion-celebration[data-reduced-motion=\"true\"][data-active=\"true\"] .lp-completion-celebration__message { animation: lp-celebration-message-reduced 700ms ease-out both; }\n@keyframes lp-celebration-halo-reduced { 0%, 100% { opacity: 0; } 20%, 80% { opacity: .65; } }\n@keyframes lp-celebration-message-reduced { 0%, 100% { opacity: 0; } 14%, 82% { opacity: 1; } }\n@media (prefers-reduced-motion: reduce) {\n  [data-learning-path-root] .lp-completion-celebration__confetti { display: none; }\n  [data-learning-path-root] .lp-completion-celebration[data-active=\"true\"] .lp-completion-celebration__halo { animation: lp-celebration-halo-reduced 700ms ease-out both; }\n  [data-learning-path-root] .lp-completion-celebration[data-active=\"true\"] .lp-completion-celebration__message { animation: lp-celebration-message-reduced 700ms ease-out both; }\n}\n", yi = class {
	document;
	root;
	title;
	message;
	releaseStyles;
	onSettled;
	lastPlayCount = -1;
	activePlayCount = -1;
	activationFrame = 0;
	settleTimer = 0;
	disposed = !1;
	constructor(e, t = {}) {
		this.document = e.ownerDocument, this.releaseStyles = bi(this.document), this.onSettled = t.onSettled, this.root = this.document.createElement("div"), this.root.className = "lp-completion-celebration", this.root.hidden = !0, this.root.setAttribute("role", "status"), this.root.setAttribute("aria-live", "assertive"), this.root.setAttribute("aria-atomic", "true");
		let n = this.document.createElement("div");
		n.className = "lp-completion-celebration__halo", n.setAttribute("aria-hidden", "true");
		let r = this.document.createElement("section");
		r.className = "lp-completion-celebration__message";
		let i = this.document.createElement("span");
		i.className = "lp-completion-celebration__mark", i.textContent = "✓", i.setAttribute("aria-hidden", "true"), this.title = this.document.createElement("h2"), this.title.className = "lp-completion-celebration__title", this.message = this.document.createElement("p"), this.message.className = "lp-completion-celebration__body", r.append(i, this.title, this.message), this.root.append(n, ...this.createConfetti(), r), e.append(this.root);
	}
	setViewModel(e) {
		if (this.disposed) return;
		if (e === null || e.visible === !1) {
			this.hide();
			return;
		}
		if (!Number.isSafeInteger(e.playCount) || e.playCount < 0 || e.playCount <= this.lastPlayCount) return;
		this.lastPlayCount = e.playCount, this.activePlayCount = e.playCount, this.title.textContent = e.title;
		let t = e.message?.trim() ?? "";
		this.message.textContent = t, this.message.hidden = t.length === 0;
		let n = this.document.defaultView?.matchMedia?.("(prefers-reduced-motion: reduce)").matches === !0, r = e.reducedMotion === !0 || n;
		this.root.dataset.reducedMotion = String(r), this.root.dataset.playCount = String(e.playCount), this.root.hidden = !1, this.root.removeAttribute("data-active"), this.clearPlaybackHandles();
		let i = this.document.defaultView;
		if (!i) {
			this.root.dataset.active = "true";
			return;
		}
		this.activationFrame = i.requestAnimationFrame(() => {
			this.activationFrame = 0, !this.disposed && !this.root.hidden && (this.root.dataset.active = "true");
		}), this.settleTimer = i.setTimeout(() => this.settle(e.playCount), r ? 740 : 1900);
	}
	dispose() {
		this.disposed || (this.disposed = !0, this.clearPlaybackHandles(), this.root.remove(), this.releaseStyles());
	}
	createConfetti() {
		let e = [];
		for (let t = 0; t < _i; t += 1) {
			let n = this.document.createElement("i");
			n.className = "lp-completion-celebration__confetti", n.setAttribute("aria-hidden", "true"), n.style.setProperty("--lp-confetti-x", `${3 + t * 37 % 94}%`), n.style.setProperty("--lp-confetti-w", `${6 + t % 4 * 2}px`), n.style.setProperty("--lp-confetti-h", `${10 + t % 3 * 3}px`), n.style.setProperty("--lp-confetti-color", gi[t % gi.length] ?? "#fff"), n.style.setProperty("--lp-confetti-delay", `${t % 7 * 26}ms`), n.style.setProperty("--lp-confetti-drift", `${-84 + t * 53 % 168}px`), n.style.setProperty("--lp-confetti-turn", `${t * 31 % 180}deg`), n.style.setProperty("--lp-confetti-spin", `${440 + t % 6 * 126}deg`), e.push(n);
		}
		return e;
	}
	settle(e) {
		if (this.disposed || e !== this.activePlayCount) return;
		this.settleTimer = 0, this.root.hidden = !0, this.root.removeAttribute("data-active");
		let t = Object.freeze({
			type: "completion-celebration.settled",
			playCount: e,
			occurredAt: this.document.defaultView?.performance.now() ?? Date.now()
		}), n = this.document.defaultView?.CustomEvent ?? CustomEvent;
		this.root.dispatchEvent(new n(pi.settled, {
			bubbles: !0,
			composed: !0,
			detail: t
		})), this.onSettled?.(t);
	}
	hide() {
		this.clearPlaybackHandles(), this.activePlayCount = -1, this.root.hidden = !0, this.root.removeAttribute("data-active");
	}
	clearPlaybackHandles() {
		let e = this.document.defaultView;
		this.activationFrame && e?.cancelAnimationFrame(this.activationFrame), this.settleTimer && e?.clearTimeout(this.settleTimer), this.activationFrame = 0, this.settleTimer = 0;
	}
};
function bi(e) {
	let t = hi.get(e);
	if (t) return t.owners += 1, () => xi(e);
	let n = e.createElement("style");
	return n.setAttribute(mi, ""), n.textContent = vi, (e.head ?? e.documentElement).append(n), hi.set(e, {
		element: n,
		owners: 1
	}), () => xi(e);
}
function xi(e) {
	let t = hi.get(e);
	t && (--t.owners, !(t.owners > 0) && (t.element.remove(), hi.delete(e)));
}
//#endregion
//#region src/ui/domViewUtils.ts
var Si = "data-learning-path-ui-styles", Ci = /* @__PURE__ */ new WeakMap(), wi = "\n[data-learning-path-root] .lp-ui-shell {\n  position: absolute;\n  z-index: 8;\n  inset: 0;\n  color: #27302a;\n  pointer-events: none;\n  font-family: Inter, ui-rounded, \"SF Pro Rounded\", \"PingFang SC\", \"Microsoft YaHei\", system-ui, sans-serif;\n}\n[data-learning-path-root] .lp-ui-shell button { font: inherit; }\n[data-learning-path-root] .lp-ui-shell__gate,\n[data-learning-path-root] .lp-ui-shell__context-card,\n[data-learning-path-root] .lp-ui-shell__celebration { position: absolute; inset: 0; pointer-events: none; }\n[data-learning-path-root] .lp-ui-generation-gate {\n  position: absolute;\n  inset: 0;\n  display: grid;\n  place-items: center;\n  pointer-events: auto;\n  background: rgb(250 252 250 / 78%);\n  backdrop-filter: blur(14px) saturate(.9);\n}\n[data-learning-path-root] .lp-ui-generation-gate[hidden] { display: none; }\n[data-learning-path-root] .lp-ui-generation-gate__panel {\n  width: min(440px, calc(100% - 36px));\n  box-sizing: border-box;\n  padding: 34px;\n  border: 1px solid rgb(27 70 42 / 10%);\n  border-radius: 28px;\n  background: rgb(255 255 255 / 94%);\n  box-shadow: 0 24px 70px rgb(38 72 48 / 16%), inset 0 1px 0 #fff;\n}\n[data-learning-path-root] .lp-ui-generation-gate__title {\n  margin: 0;\n  color: #203628;\n  font-size: clamp(26px, 4cqw, 34px);\n  line-height: 1.15;\n  letter-spacing: -.025em;\n}\n[data-learning-path-root] .lp-ui-generation-gate__description {\n  margin: 12px 0 24px;\n  color: #657169;\n  font-size: 14px;\n  font-weight: 600;\n  line-height: 1.65;\n}\n[data-learning-path-root] .lp-ui-generation-gate__actions { display: grid; gap: 14px; }\n[data-learning-path-root] .lp-ui-generation-gate__button {\n  width: 100%;\n  min-height: 50px;\n  border: 1px solid rgb(13 121 50 / 14%);\n  border-radius: 999px;\n  padding: 13px 24px;\n  color: #fff;\n  background: linear-gradient(180deg, #35d56c, #1caf4e);\n  box-shadow: 0 7px 0 #128c3e, 0 18px 34px rgb(27 171 75 / 24%), inset 0 1px 0 rgb(255 255 255 / 35%);\n  cursor: pointer;\n  font-weight: 800;\n  transition: transform 160ms ease, filter 160ms ease, box-shadow 160ms ease;\n}\n[data-learning-path-root] .lp-ui-generation-gate__button[data-tone=\"secondary\"] {\n  color: #176b36;\n  background: #f2fff6;\n  border-color: rgb(23 107 54 / 22%);\n  box-shadow: 0 5px 0 #cbeed6, 0 12px 24px rgb(31 137 69 / 10%);\n}\n[data-learning-path-root] .lp-ui-generation-gate__button[data-tone=\"quiet\"] {\n  color: #56615a;\n  background: #f1f3f1;\n  border-color: rgb(65 76 68 / 12%);\n  box-shadow: 0 5px 0 #d8ddda, 0 10px 20px rgb(45 59 50 / 8%);\n}\n[data-learning-path-root] .lp-ui-generation-gate__button:hover:not(:disabled) { transform: translateY(-2px); filter: saturate(1.06); }\n[data-learning-path-root] .lp-ui-generation-gate__button:active:not(:disabled) { transform: translateY(4px); box-shadow: 0 2px 0 #128c3e; }\n[data-learning-path-root] .lp-ui-generation-gate__button:focus-visible { outline: 3px solid #176b36; outline-offset: 4px; }\n[data-learning-path-root] .lp-ui-generation-gate__button:disabled { cursor: wait; filter: grayscale(.16); opacity: .72; }\n[data-learning-path-root] .lp-ui-generation-gate[data-phase=\"error\"] .lp-ui-generation-gate__button { background: linear-gradient(180deg, #68716b, #505852); box-shadow: 0 7px 0 #3e4540; }\n[data-learning-path-root] .lp-ui-generation-gate__error {\n  margin: 20px 0 0;\n  color: #8a3838;\n  font-size: 13px;\n  font-weight: 650;\n  line-height: 1.5;\n  text-align: center;\n}\n@media (prefers-reduced-motion: reduce) {\n  [data-learning-path-root] .lp-ui-generation-gate__button { transition: none; }\n}\n";
function Ti(e) {
	let t = Ci.get(e);
	if (t) return t.owners += 1, () => Ei(e);
	let n = e.createElement("style");
	return n.setAttribute(Si, ""), n.textContent = wi, (e.head ?? e.documentElement).append(n), Ci.set(e, {
		element: n,
		owners: 1
	}), () => Ei(e);
}
function Ei(e) {
	let t = Ci.get(e);
	t && (--t.owners, !(t.owners > 0) && (t.element.remove(), Ci.delete(e)));
}
function Di(e) {
	return e.defaultView?.performance.now() ?? Date.now();
}
function Oi(e, t, n, r) {
	let i = new ((t.defaultView?.CustomEvent) ?? CustomEvent)(n, {
		bubbles: !0,
		cancelable: !0,
		composed: !0,
		detail: r
	});
	return e.dispatchEvent(i), i;
}
//#endregion
//#region src/ui/GenerationGateView.ts
var ki = class e {
	document;
	root;
	title;
	buttons;
	error;
	releaseStyles;
	onLaunchRequested;
	disposed = !1;
	constructor(t, n = {}) {
		this.document = t.ownerDocument, this.releaseStyles = Ti(this.document), this.onLaunchRequested = n.onLaunchRequested, this.root = this.document.createElement("div"), this.root.className = "lp-ui-generation-gate", this.root.dataset.phase = "ready", this.root.setAttribute("role", "dialog"), this.root.setAttribute("aria-labelledby", `learning-path-gate-title-${e.nextId}`), this.root.setAttribute("aria-modal", "true");
		let r = this.document.createElement("section");
		r.className = "lp-ui-generation-gate__panel", this.title = this.document.createElement("h1"), this.title.className = "lp-ui-generation-gate__title", this.title.id = `learning-path-gate-title-${e.nextId}`, this.title.textContent = "选择学习路径";
		let i = this.document.createElement("p");
		i.className = "lp-ui-generation-gate__description", i.textContent = "创建一条新路径、接着上次进度，或清空当前路径重新开始。";
		let a = this.document.createElement("div");
		a.className = "lp-ui-generation-gate__actions";
		let o = (e, t, n) => {
			let r = this.document.createElement("button");
			return r.className = "lp-ui-generation-gate__button", r.dataset.action = e, r.dataset.tone = n, r.type = "button", r.textContent = t, r.addEventListener("click", this.handleLaunchRequest), r;
		};
		this.buttons = Object.freeze({
			generate: o("generate", "生成学习路径", "primary"),
			continue: o("continue", "继续学习路径", "secondary"),
			reset: o("reset", "重置学习路径", "quiet")
		}), a.append(this.buttons.generate, this.buttons.continue, this.buttons.reset), this.error = this.document.createElement("p"), this.error.className = "lp-ui-generation-gate__error", this.error.id = `learning-path-generation-error-${e.nextId++}`, this.error.setAttribute("role", "alert"), this.error.hidden = !0, r.append(this.title, i, a, this.error), this.root.append(r), t.append(this.root);
	}
	setViewModel(e) {
		if (this.disposed) return;
		let t = e.phase === "requested" || e.phase === "generating", n = e.phase === "hidden" || t, r = e.phase === "error", i = t ? "正在生成学习路径…" : r ? "重新生成学习路径" : "生成学习路径";
		this.root.hidden = n, this.root.dataset.phase = e.phase, this.root.setAttribute("aria-busy", String(t)), Object.values(this.buttons).forEach((e) => {
			e.disabled = t;
		}), this.buttons.continue.disabled = t || e.canContinue !== !0, this.buttons.generate.textContent = e.buttonLabel?.trim() || i, this.buttons.continue.textContent = "继续学习路径", this.buttons.reset.textContent = "重置学习路径";
		let a = r ? e.errorMessage?.trim() ?? "生成失败，请重试。" : "";
		this.error.hidden = a.length === 0, this.error.textContent !== a && (this.error.textContent = a), a.length > 0 ? Object.values(this.buttons).forEach((e) => {
			e.setAttribute("aria-describedby", this.error.id);
		}) : Object.values(this.buttons).forEach((e) => {
			e.removeAttribute("aria-describedby");
		}), !n && !t && this.document.defaultView?.requestAnimationFrame(() => {
			!this.disposed && !this.root.hidden && (e.canContinue ? this.buttons.continue : this.buttons.generate).focus({ preventScroll: !0 });
		});
	}
	focus() {
		!this.disposed && !this.root.hidden && (this.buttons.continue.disabled ? this.buttons.generate : this.buttons.continue).focus({ preventScroll: !0 });
	}
	dispose() {
		this.disposed || (this.disposed = !0, Object.values(this.buttons).forEach((e) => {
			e.removeEventListener("click", this.handleLaunchRequest);
		}), this.root.remove(), this.releaseStyles());
	}
	handleLaunchRequest = (e) => {
		let t = e.currentTarget;
		if (this.disposed || !(t instanceof HTMLButtonElement) || t.disabled) return;
		let n = t.dataset.action;
		if (n !== "generate" && n !== "continue" && n !== "reset") return;
		let r = Object.freeze({
			type: "path.launch",
			action: n,
			source: "generation-gate",
			occurredAt: Di(this.document)
		});
		Oi(this.root, this.document, "learning-path-ui:launch-requested", r).defaultPrevented || (Object.values(this.buttons).forEach((e) => {
			e.disabled = !0;
		}), this.root.dataset.phase = "requested", this.root.setAttribute("aria-busy", "true"), t.textContent = n === "continue" ? "正在恢复学习路径…" : n === "reset" ? "正在重置学习路径…" : "正在生成学习路径…", this.root.hidden = !0, this.onLaunchRequested?.(r));
	};
	static nextId = 1;
}, Ai = "data-contextual-learning-card-styles", ji = /* @__PURE__ */ new WeakMap(), Mi = "\n[data-learning-path-root] .lp-context-card {\n  --lp-card-face: #2fca5c;\n  --lp-card-face-hi: #45d96e;\n  --lp-card-side: #159445;\n  --lp-card-side-dark: #0e7535;\n  --lp-card-ink: #fff;\n  --lp-card-soft-ink: rgb(255 255 255 / 82%);\n  --lp-card-arrow-x: 50%;\n  --lp-card-available-width: calc(100% - 24px);\n  --lp-card-max-height: 370px;\n  position: absolute;\n  z-index: 12;\n  left: 0;\n  top: 0;\n  width: min(366px, var(--lp-card-available-width));\n  min-width: min(280px, var(--lp-card-available-width));\n  color: var(--lp-card-ink);\n  filter: drop-shadow(0 18px 19px rgb(23 58 35 / 23%));\n  pointer-events: auto;\n  transform: translate3d(-10000px, -10000px, 0);\n  transform-origin: var(--lp-card-arrow-x) 0;\n  isolation: isolate;\n  font-family: Inter, ui-rounded, \"SF Pro Rounded\", \"PingFang SC\", \"Microsoft YaHei\", system-ui, sans-serif;\n  -webkit-font-smoothing: antialiased;\n  will-change: transform;\n}\n[data-learning-path-root] .lp-context-card[hidden] { display: none; }\n[data-learning-path-root] .lp-context-card[data-placed=\"false\"] { visibility: hidden; }\n[data-learning-path-root] .lp-context-card[data-tone=\"brown\"] {\n  --lp-card-face: #b96b18;\n  --lp-card-face-hi: #cb7b22;\n  --lp-card-side: #87440f;\n  --lp-card-side-dark: #67320c;\n}\n[data-learning-path-root] .lp-context-card[data-tone=\"gray\"] {\n  --lp-card-face: #6f7972;\n  --lp-card-face-hi: #818b84;\n  --lp-card-side: #4e5751;\n  --lp-card-side-dark: #3d443f;\n}\n[data-learning-path-root] .lp-context-card__arrow-depth,\n[data-learning-path-root] .lp-context-card__arrow-face {\n  position: absolute;\n  left: var(--lp-card-arrow-x);\n  width: 25px;\n  height: 25px;\n  border-radius: 5px 0 0;\n  pointer-events: none;\n  transform: translateX(-50%) rotate(45deg);\n}\n[data-learning-path-root] .lp-context-card__arrow-depth {\n  z-index: -2;\n  top: -8px;\n  background: var(--lp-card-side-dark);\n  box-shadow: 3px 3px 0 var(--lp-card-side-dark);\n}\n[data-learning-path-root] .lp-context-card__arrow-face {\n  z-index: 0;\n  top: -12px;\n  background: linear-gradient(135deg, var(--lp-card-face-hi), var(--lp-card-face) 72%);\n  box-shadow: inset 1px 1px 0 rgb(255 255 255 / 22%);\n}\n[data-learning-path-root] .lp-context-card__panel {\n  position: relative;\n  z-index: 1;\n  display: grid;\n  gap: 13px;\n  box-sizing: border-box;\n  min-height: 128px;\n  max-height: min(46cqh, var(--lp-card-max-height));\n  overflow: auto;\n  overscroll-behavior: contain;\n  border: 1px solid rgb(255 255 255 / 16%);\n  border-radius: 18px;\n  padding: 18px 18px 20px;\n  background:\n    radial-gradient(115% 95% at 12% 0%, rgb(255 255 255 / 15%), transparent 47%),\n    linear-gradient(180deg, var(--lp-card-face-hi), var(--lp-card-face) 56%);\n  box-shadow:\n    0 9px 0 var(--lp-card-side),\n    0 12px 0 var(--lp-card-side-dark),\n    inset 0 1px 0 rgb(255 255 255 / 24%),\n    inset 0 -1px 0 rgb(0 0 0 / 8%);\n  scrollbar-width: thin;\n}\n[data-learning-path-root] .lp-context-card__header {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr) auto;\n  gap: 10px 14px;\n  align-items: start;\n}\n[data-learning-path-root] .lp-context-card__heading { min-width: 0; }\n[data-learning-path-root] .lp-context-card__eyebrow {\n  margin: 0 0 4px;\n  color: var(--lp-card-soft-ink);\n  font-size: 11px;\n  font-weight: 800;\n  letter-spacing: .105em;\n  line-height: 1.2;\n  text-transform: uppercase;\n}\n[data-learning-path-root] .lp-context-card__title {\n  margin: 0;\n  overflow-wrap: anywhere;\n  font-size: clamp(20px, 2.2cqw, 27px);\n  font-weight: 850;\n  letter-spacing: -.025em;\n  line-height: 1.18;\n  text-wrap: balance;\n}\n[data-learning-path-root] .lp-context-card__status {\n  min-height: 27px;\n  box-sizing: border-box;\n  border: 1px solid rgb(255 255 255 / 19%);\n  border-radius: 999px;\n  padding: 5px 9px;\n  color: #fff;\n  background: rgb(0 0 0 / 12%);\n  box-shadow: inset 0 1px 0 rgb(255 255 255 / 12%);\n  font-size: 11px;\n  font-weight: 800;\n  line-height: 1.35;\n  white-space: nowrap;\n}\n[data-learning-path-root] .lp-context-card__status[hidden] { display: none; }\n[data-learning-path-root] .lp-context-card__description {\n  margin: 0;\n  color: var(--lp-card-soft-ink);\n  font-size: 14px;\n  font-weight: 570;\n  line-height: 1.62;\n  text-wrap: pretty;\n}\n[data-learning-path-root] .lp-context-card__description[hidden] { display: none; }\n[data-learning-path-root] .lp-context-card__actions {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr);\n  gap: 9px;\n  padding-top: 1px;\n}\n[data-learning-path-root] .lp-context-card__actions[hidden] { display: none; }\n[data-learning-path-root] .lp-context-card__button {\n  position: relative;\n  min-height: 48px;\n  box-sizing: border-box;\n  border: 0;\n  border-radius: 13px;\n  padding: 11px 16px;\n  cursor: pointer;\n  font: inherit;\n  font-size: 14px;\n  font-weight: 850;\n  letter-spacing: .008em;\n  line-height: 1.2;\n  transition: transform 140ms ease, box-shadow 140ms ease, filter 140ms ease, opacity 140ms ease;\n  touch-action: manipulation;\n  -webkit-tap-highlight-color: transparent;\n}\n[data-learning-path-root] .lp-context-card__button[data-slot=\"primary\"] {\n  color: var(--lp-card-side-dark);\n  background: #fff;\n  box-shadow: 0 4px 0 rgb(226 232 227), 0 7px 12px rgb(0 0 0 / 13%);\n}\n[data-learning-path-root] .lp-context-card__button[data-slot=\"secondary\"] {\n  border: 2px solid rgb(255 255 255 / 78%);\n  color: #fff;\n  background: rgb(0 0 0 / 7%);\n  box-shadow: 0 4px 0 rgb(0 0 0 / 13%);\n}\n[data-learning-path-root] .lp-context-card__button:hover:not(:disabled) { filter: brightness(1.035); transform: translateY(-1px); }\n[data-learning-path-root] .lp-context-card__button:active:not(:disabled) { transform: translateY(3px); box-shadow: 0 1px 0 rgb(0 0 0 / 15%); }\n[data-learning-path-root] .lp-context-card__button:focus-visible {\n  outline: 3px solid #fff3a5;\n  outline-offset: 3px;\n}\n[data-learning-path-root] .lp-context-card__button:disabled {\n  cursor: not-allowed;\n  filter: saturate(.55);\n  opacity: .58;\n}\n[data-learning-path-root] .lp-context-card[data-opening=\"true\"] { animation: lp-context-card-enter 220ms cubic-bezier(.2,.82,.25,1); }\n@keyframes lp-context-card-enter {\n  from { opacity: 0; scale: .965; }\n  to { opacity: 1; scale: 1; }\n}\n@media (min-width: 560px) {\n  [data-learning-path-root] .lp-context-card__actions:has(.lp-context-card__button:nth-child(2)) { grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); }\n}\n@media (max-width: 559px) {\n  [data-learning-path-root] .lp-context-card {\n    width: min(342px, var(--lp-card-available-width));\n    min-width: min(264px, var(--lp-card-available-width));\n  }\n  [data-learning-path-root] .lp-context-card__panel { gap: 11px; border-radius: 16px; padding: 16px 15px 18px; }\n  [data-learning-path-root] .lp-context-card__title { font-size: clamp(19px, 6cqw, 24px); }\n  [data-learning-path-root] .lp-context-card__description { font-size: 13px; }\n}\n@media (prefers-reduced-motion: reduce) {\n  [data-learning-path-root] .lp-context-card[data-opening=\"true\"] { animation: none; }\n  [data-learning-path-root] .lp-context-card__button { transition: none; }\n}\n", Ni = class e {
	document;
	mount;
	root;
	panel;
	eyebrow;
	title;
	status;
	description;
	actions;
	primaryButton;
	secondaryButton;
	releaseStyles;
	onActionRequested;
	resizeObserver;
	layoutMetrics = {
		visible: !1,
		placed: !1,
		top: 0,
		bottom: 0,
		width: 0,
		height: 0,
		centerX: 0
	};
	viewModel = null;
	placement = null;
	openingFrame = 0;
	disposed = !1;
	constructor(t, n = {}) {
		this.document = t.ownerDocument, this.mount = t, this.releaseStyles = Pi(this.document), this.onActionRequested = n.onActionRequested, this.root = this.document.createElement("aside"), this.root.className = "lp-context-card", this.root.hidden = !0, this.root.dataset.placed = "false", this.root.setAttribute("role", "dialog"), this.root.setAttribute("aria-modal", "false"), this.root.setAttribute("aria-live", "polite"), this.root.tabIndex = -1;
		let r = this.document.createElement("span");
		r.className = "lp-context-card__arrow-depth", r.setAttribute("aria-hidden", "true");
		let i = this.document.createElement("span");
		i.className = "lp-context-card__arrow-face", i.setAttribute("aria-hidden", "true"), this.panel = this.document.createElement("section"), this.panel.className = "lp-context-card__panel";
		let a = this.document.createElement("header");
		a.className = "lp-context-card__header";
		let o = this.document.createElement("div");
		o.className = "lp-context-card__heading", this.eyebrow = this.document.createElement("p"), this.eyebrow.className = "lp-context-card__eyebrow", this.title = this.document.createElement("h2"), this.title.className = "lp-context-card__title", this.title.id = `lp-context-card-title-${e.nextId++}`, this.root.setAttribute("aria-labelledby", this.title.id), o.append(this.eyebrow, this.title), this.status = this.document.createElement("span"), this.status.className = "lp-context-card__status", this.status.hidden = !0, a.append(o, this.status), this.description = this.document.createElement("p"), this.description.className = "lp-context-card__description", this.description.hidden = !0, this.actions = this.document.createElement("div"), this.actions.className = "lp-context-card__actions", this.actions.hidden = !0, this.primaryButton = this.createButton("primary"), this.secondaryButton = this.createButton("secondary"), this.actions.append(this.primaryButton, this.secondaryButton), this.panel.append(a, this.description, this.actions), this.root.append(r, i, this.panel), t.append(this.root), this.root.addEventListener("pointerdown", this.stopEventPropagation), this.root.addEventListener("pointerup", this.stopEventPropagation), this.root.addEventListener("click", this.stopEventPropagation), this.root.addEventListener("dblclick", this.stopEventPropagation), this.root.addEventListener("contextmenu", this.stopEventPropagation), this.root.addEventListener("wheel", this.stopEventPropagation), this.root.addEventListener("animationend", this.handleOpeningMotionEnd);
		let s = this.document.defaultView?.ResizeObserver;
		this.resizeObserver = s ? new s(() => this.applyPlacement()) : null, this.resizeObserver?.observe(this.root);
	}
	setViewModel(e) {
		if (this.disposed) return;
		let t = this.viewModel;
		if (Ii(t, e)) return;
		let n = t !== null && t.visible !== !1;
		this.viewModel = e;
		let r = e !== null && e.visible !== !1;
		if (this.root.hidden = !r, this.root.setAttribute("aria-hidden", String(!r)), !r || e === null) {
			this.root.removeAttribute("data-node-id"), this.root.removeAttribute("data-instance-id"), this.root.dataset.placed = "false", this.root.removeAttribute("data-opening");
			return;
		}
		this.root.dataset.nodeId = e.nodeId, this.root.dataset.instanceId = e.instanceId, this.root.dataset.kind = e.kind, this.root.dataset.tone = e.tone, this.eyebrow.textContent = e.eyebrow?.trim() ?? "", this.eyebrow.hidden = this.eyebrow.textContent.length === 0, this.title.textContent = e.title, this.setOptionalText(this.status, e.statusLabel), this.setOptionalText(this.description, e.description), this.configureButton(this.primaryButton, e.primaryAction, "primary"), this.configureButton(this.secondaryButton, e.secondaryAction, "secondary"), this.actions.hidden = !e.primaryAction && !e.secondaryAction, this.panel.setAttribute("aria-busy", String(e.primaryAction?.busy === !0 || e.secondaryAction?.busy === !0)), this.applyPlacement(), (!n || t?.instanceId !== e.instanceId) && this.playOpeningMotion();
	}
	setPlacement(e) {
		this.disposed || Ri(this.placement, e) || (this.placement = e, this.applyPlacement());
	}
	getLayoutMetrics() {
		let e = this.root.getBoundingClientRect();
		return this.layoutMetrics.visible = !this.root.hidden, this.layoutMetrics.placed = this.root.dataset.placed === "true", this.layoutMetrics.top = e.top, this.layoutMetrics.bottom = e.bottom, this.layoutMetrics.width = e.width, this.layoutMetrics.height = e.height, this.layoutMetrics.centerX = e.left + e.width / 2, this.layoutMetrics;
	}
	focus() {
		this.disposed || this.root.hidden || ([this.primaryButton, this.secondaryButton].find((e) => !e.hidden && !e.disabled) ?? this.root).focus({ preventScroll: !0 });
	}
	containsEventPath(e) {
		if (e === null) return !1;
		if (Array.isArray(e)) return e.includes(this.root);
		let t = this.document.defaultView;
		if (t && e instanceof t.Event) {
			if ((typeof e.composedPath == "function" ? e.composedPath() : []).includes(this.root)) return !0;
			let n = e.target;
			return n instanceof t.Node && this.root.contains(n);
		}
		return t !== null && e instanceof t.Node && this.root.contains(e);
	}
	dispose() {
		this.disposed || (this.disposed = !0, this.cancelOpeningFrame(), this.resizeObserver?.disconnect(), this.primaryButton.removeEventListener("click", this.handleActionClick), this.secondaryButton.removeEventListener("click", this.handleActionClick), this.root.removeEventListener("pointerdown", this.stopEventPropagation), this.root.removeEventListener("pointerup", this.stopEventPropagation), this.root.removeEventListener("click", this.stopEventPropagation), this.root.removeEventListener("dblclick", this.stopEventPropagation), this.root.removeEventListener("contextmenu", this.stopEventPropagation), this.root.removeEventListener("wheel", this.stopEventPropagation), this.root.removeEventListener("animationend", this.handleOpeningMotionEnd), this.root.remove(), this.releaseStyles());
	}
	createButton(e) {
		let t = this.document.createElement("button");
		return t.className = "lp-context-card__button", t.type = "button", t.dataset.slot = e, t.hidden = !0, t.addEventListener("click", this.handleActionClick), t;
	}
	configureButton(e, t, n) {
		if (e.hidden = t === void 0, !t) {
			e.disabled = !0, e.removeAttribute("data-action-id"), e.removeAttribute("data-instance-id"), e.removeAttribute("aria-label"), e.removeAttribute("aria-busy"), e.textContent = "";
			return;
		}
		e.dataset.slot = n, e.dataset.actionId = t.id, e.dataset.instanceId = this.viewModel?.instanceId ?? "", e.textContent = t.label, e.disabled = t.enabled === !1 || t.busy === !0, e.setAttribute("aria-busy", String(t.busy === !0)), e.setAttribute("aria-label", t.ariaLabel?.trim() || t.label);
	}
	setOptionalText(e, t) {
		let n = t?.trim() ?? "";
		e.textContent = n, e.hidden = n.length === 0;
	}
	applyPlacement() {
		if (this.disposed || this.root.hidden || !this.placement) {
			this.root.dataset.placed = "false";
			return;
		}
		let e = this.placement;
		if (!Number.isFinite(e.anchorClientX) || !Number.isFinite(e.anchorClientY)) {
			this.root.dataset.placed = "false";
			return;
		}
		let t = e.viewportRect ?? this.mount.getBoundingClientRect(), n = Math.max(8, e.margin ?? 12), r = Math.max(9, e.gap ?? 18);
		this.root.style.setProperty("--lp-card-available-width", `${Math.max(180, t.width - n * 2)}px`), this.root.style.setProperty("--lp-card-max-height", `${Math.max(150, t.height - n * 2 - r)}px`);
		let i = this.mount.getBoundingClientRect(), a = this.root.getBoundingClientRect().width || Math.min(366, Math.max(180, t.width - n * 2)), o = e.anchorClientX - a / 2, s = t.left + n, c = Math.max(s, t.left + t.width - n - a), l = Math.min(c, Math.max(s, o)), u = e.anchorClientY + r, d = l - i.left + this.mount.scrollLeft, f = u - i.top + this.mount.scrollTop, p = Math.min(92, Math.max(8, (e.anchorClientX - l) / a * 100));
		this.root.style.setProperty("--lp-card-arrow-x", `${p}%`), this.root.style.transform = `translate3d(${Bi(d)}, ${Bi(f)}, 0)`, this.root.dataset.anchorClientX = String(e.anchorClientX), this.root.dataset.anchorClientY = String(e.anchorClientY), this.root.dataset.placed = "true";
	}
	playOpeningMotion() {
		this.cancelOpeningFrame(), this.root.removeAttribute("data-opening");
		let e = this.document.defaultView?.requestAnimationFrame;
		e && (this.openingFrame = e(() => {
			this.openingFrame = 0, !this.disposed && !this.root.hidden && (this.root.dataset.opening = "true");
		}));
	}
	cancelOpeningFrame() {
		this.openingFrame &&= (this.document.defaultView?.cancelAnimationFrame(this.openingFrame), 0);
	}
	handleActionClick = (e) => {
		let t = e.currentTarget === this.primaryButton ? this.primaryButton : e.currentTarget === this.secondaryButton ? this.secondaryButton : null, n = this.viewModel;
		if (t === null || this.disposed || t.disabled || n === null) return;
		let r = t.dataset.slot === "secondary" ? "secondary" : "primary", i = r === "primary" ? n.primaryAction : n.secondaryAction, a = t.dataset.instanceId;
		if (!i || t.dataset.actionId !== i.id || a !== n.instanceId) return;
		let o = Object.freeze({
			type: "contextual-card.action",
			source: "contextual-node-card",
			instanceId: n.instanceId,
			nodeId: n.nodeId,
			actionId: i.id,
			slot: r,
			occurredAt: this.document.defaultView?.performance.now() ?? Date.now()
		}), s = new ((this.document.defaultView?.CustomEvent) ?? CustomEvent)(fi.actionRequested, {
			bubbles: !0,
			cancelable: !0,
			composed: !0,
			detail: o
		});
		this.root.dispatchEvent(s), s.defaultPrevented || this.onActionRequested?.(o);
	};
	stopEventPropagation = (e) => {
		e.stopPropagation();
	};
	handleOpeningMotionEnd = (e) => {
		e.target === this.root && e.animationName === "lp-context-card-enter" && this.root.removeAttribute("data-opening");
	};
	static nextId = 1;
};
function Pi(e) {
	let t = ji.get(e);
	if (t) return t.owners += 1, () => Fi(e);
	let n = e.createElement("style");
	return n.setAttribute(Ai, ""), n.textContent = Mi, (e.head ?? e.documentElement).append(n), ji.set(e, {
		element: n,
		owners: 1
	}), () => Fi(e);
}
function Fi(e) {
	let t = ji.get(e);
	t && (--t.owners, !(t.owners > 0) && (t.element.remove(), ji.delete(e)));
}
function Ii(e, t) {
	return e === t ? !0 : e === null || t === null ? !1 : e.instanceId === t.instanceId && e.nodeId === t.nodeId && e.kind === t.kind && e.tone === t.tone && e.title === t.title && e.description === t.description && e.eyebrow === t.eyebrow && e.statusLabel === t.statusLabel && e.visible === t.visible && Li(e.primaryAction, t.primaryAction) && Li(e.secondaryAction, t.secondaryAction);
}
function Li(e, t) {
	return e === t ? !0 : !e || !t ? !1 : e.id === t.id && e.label === t.label && e.enabled === t.enabled && e.busy === t.busy && e.ariaLabel === t.ariaLabel;
}
function Ri(e, t) {
	if (e === t) return !0;
	if (e === null || t === null) return !1;
	let n = e.viewportRect, r = t.viewportRect;
	return zi(e.anchorClientX, t.anchorClientX) && zi(e.anchorClientY, t.anchorClientY) && e.gap === t.gap && e.margin === t.margin && n !== void 0 && r !== void 0 && zi(n.left, r.left) && zi(n.top, r.top) && zi(n.width, r.width) && zi(n.height, r.height);
}
function zi(e, t) {
	return Math.abs(e - t) < .05;
}
function Bi(e) {
	return `${Math.round(e * 1e3) / 1e3}px`;
}
//#endregion
//#region src/ui/LearningPathPageShell.ts
var Vi = class {
	root;
	generationGate;
	card;
	celebration;
	releaseStyles;
	disposed = !1;
	constructor(e, t = {}) {
		let n = e.ownerDocument;
		this.releaseStyles = Ti(n), this.root = n.createElement("div"), this.root.className = "lp-ui-shell", this.root.dataset.generationPhase = "ready";
		let r = n.createElement("div");
		r.className = "lp-ui-shell__gate";
		let i = n.createElement("div");
		i.className = "lp-ui-shell__context-card";
		let a = n.createElement("div");
		a.className = "lp-ui-shell__celebration", this.root.append(r, i, a), e.append(this.root), this.generationGate = new ki(r, { onLaunchRequested: t.onLaunchRequested }), this.card = new Ni(i, { onActionRequested: t.onCardActionRequested }), this.celebration = new yi(a, { onSettled: t.onCelebrationSettled });
	}
	setViewModel(e) {
		this.disposed || (this.root.dataset.generationPhase = e.generation.phase, this.root.setAttribute("aria-busy", String(e.generation.phase === "requested" || e.generation.phase === "generating")), this.generationGate.setViewModel(e.generation), this.card.setViewModel(e.card ?? null), this.celebration.setViewModel(e.celebration ?? null));
	}
	setCardPlacement(e) {
		this.card.setPlacement(e);
	}
	getCardLayoutMetrics() {
		return this.card.getLayoutMetrics();
	}
	containsCardEventPath(e) {
		return this.card.containsEventPath(e);
	}
	focusCard() {
		this.card.focus();
	}
	focusGenerationAction() {
		this.generationGate.focus();
	}
	dispose() {
		this.disposed || (this.disposed = !0, this.generationGate.dispose(), this.card.dispose(), this.celebration.dispose(), this.root.remove(), this.releaseStyles());
	}
};
//#endregion
//#region src/ui/LearningPathDom.ts
function Hi(e) {
	let t = e.trim();
	if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(t)) throw Error("Learning-path instanceId must start with a letter and contain only letters, numbers, '_' or '-'.");
	return t;
}
function Ui(e, t) {
	let n = Hi(t), r = e.ownerDocument, i = `learning-path-${n}`, a = r.createElement("section");
	a.className = "learning-path-root", a.dataset.learningPathRoot = n, a.dataset.pagePhase = "generating", a.dataset.hud = "visible", a.setAttribute("aria-busy", "true"), a.setAttribute("aria-label", "3D 学习路径");
	let o = r.createElement("div");
	o.className = "learning-path-workspace";
	let s = r.createElement("div");
	s.id = `${i}-viewport`, s.className = "learning-path-viewport";
	let c = r.createElement("canvas");
	c.id = `${i}-canvas`, c.className = "learning-path-canvas", c.tabIndex = 0, c.setAttribute("role", "application"), c.setAttribute("aria-label", "3D 学习路径。使用方向键选择圆台，按回车查看详情。");
	let l = r.createElement("section");
	l.className = "status-chip", l.setAttribute("aria-label", "学习路径状态");
	let u = r.createElement("span");
	u.className = "status-dot", u.setAttribute("aria-hidden", "true");
	let d = r.createElement("span");
	d.id = `${i}-status-label`, d.textContent = "准备学习路径", l.append(u, d);
	let f = r.createElement("p");
	f.id = `${i}-interaction-hint`, f.className = "interaction-hint";
	let p = r.createElement("span");
	p.className = "pointer-copy", p.textContent = "点击圆台查看 · 卡片内学习或解锁后移动 · 拖动或滚轮浏览";
	let m = r.createElement("span");
	m.className = "keyboard-copy", m.textContent = "← ↑ → ↓ 选择 · Enter 确认", f.append(p, m);
	let h = r.createElement("section");
	h.id = `${i}-loading-panel`, h.className = "loading-panel", h.dataset.state = "hidden", h.setAttribute("aria-live", "polite");
	let g = r.createElement("span");
	g.className = "loading-mark", g.setAttribute("aria-hidden", "true");
	let _ = r.createElement("span");
	_.id = `${i}-loading-label`, _.textContent = "正在召唤刘看山…", h.append(g, _);
	let v = r.createElement("p");
	v.id = `${i}-toast`, v.className = "toast", v.setAttribute("role", "status"), v.setAttribute("aria-live", "polite");
	let y = r.createElement("p");
	y.id = `${i}-screen-reader-status`, y.className = "sr-only", y.setAttribute("role", "status"), y.setAttribute("aria-live", "polite"), y.setAttribute("aria-atomic", "true");
	let b = r.createElement("ol");
	return b.id = `${i}-node-options`, b.className = "sr-only", b.setAttribute("role", "listbox"), b.setAttribute("aria-label", "学习路径节点"), c.setAttribute("aria-describedby", f.id), c.setAttribute("aria-controls", b.id), c.setAttribute("aria-owns", b.id), s.append(c, l, f, h, v), o.append(s), a.append(o, y, b), e.append(a), Object.freeze({
		root: a,
		viewport: s,
		canvas: c,
		statusLabel: d,
		interactionHint: f,
		loadingPanel: h,
		loadingLabel: _,
		toast: v,
		screenReaderStatus: y,
		nodeOptions: b
	});
}
//#endregion
//#region src/config/DynamicOverpassCatalog.ts
var Wi = 1e-6;
function Gi(e, t) {
	let n = qi(e), r = new Map(n.map((e) => [e.id, e])), { directPairKeys: i, existingEdgeIds: a } = Ji(t, r), o = /* @__PURE__ */ new Map(), s = n.length * (n.length - 1) / 2 - i.size, c = () => Object.freeze([...o.values()].sort(Qi)), u = () => Object.freeze(c().map((e) => e.edge)), d = (e, t) => {
		if (e === t) return null;
		let n = r.get(e), s = r.get(t);
		if (!n || !s) return null;
		let c = Ki(e, t);
		if (i.has(c)) return null;
		let u = o.get(c);
		if (u) return u.edge;
		let [d, f] = ta(n, s) <= 0 ? [n, s] : [s, n], p = Math.hypot(f.position.x - d.position.x, f.position.z - d.position.z), m = l(p, Math.max(d.surfaceY, f.surfaceY)), h = Xi(d.id, f.id);
		if (a.has(h)) throw Error(`Dynamic bridge ID "${h}" collides with an authored straight edge.`);
		let g = Object.freeze({
			edge: Yi(d, f, h, m),
			profile: m
		});
		return o.set(c, g), g.edge;
	}, f = () => {
		for (let e = 0; e < n.length; e += 1) for (let t = e + 1; t < n.length; t += 1) d(n[e].id, n[t].id);
		return c();
	}, p = {
		diagnostics: $i({
			stableNodes: n,
			authoredStraightEdgeCount: t.length,
			directPairCount: i.size,
			expectedBridgeCount: s,
			entriesByPairKey: o
		}),
		getOverpassBetween: d,
		getMaterializedEdges: u
	};
	return Object.defineProperty(p, "edges", {
		enumerable: !0,
		get: () => (f(), u())
	}), Object.freeze(p);
}
function Ki(e, t) {
	if (e === t) throw Error(`A bridge cannot connect node "${e}" to itself.`);
	let [n, r] = na(e, t) <= 0 ? [e, t] : [t, e];
	return `pair:${encodeURIComponent(n)}|${encodeURIComponent(r)}`;
}
function qi(e) {
	if (e.length < 1) throw Error("Dynamic bridge catalogue requires at least one node.");
	let t = /* @__PURE__ */ new Set();
	return e.forEach((e, n) => {
		if (e.id.trim().length === 0 || t.has(e.id)) throw Error(`Dynamic bridge catalogue has an invalid or duplicate node at index ${n}.`);
		if (!Number.isFinite(e.navigationOrder)) throw Error(`Node "${e.id}" has a non-finite navigation order.`);
		if (!Number.isFinite(e.position.x) || !Number.isFinite(e.position.z) || !Number.isFinite(e.surfaceY)) throw Error(`Node "${e.id}" has non-finite bridge geometry.`);
		t.add(e.id);
	}), Object.freeze([...e].sort(ta));
}
function Ji(e, t) {
	let n = /* @__PURE__ */ new Set(), r = /* @__PURE__ */ new Set();
	return e.forEach((e, i) => {
		if (e.pathKind !== "straight") throw Error(`Authored edge at index ${i} is not straight.`);
		if (e.id.trim().length === 0 || r.has(e.id)) throw Error(`Authored graph has an invalid or duplicate edge at index ${i}.`);
		if (!t.has(e.fromNodeId) || !t.has(e.toNodeId)) throw Error(`Authored edge "${e.id}" references a missing node.`);
		let a = Ki(e.fromNodeId, e.toNodeId);
		if (n.has(a)) throw Error(`Authored graph repeats physical pair "${a}".`);
		n.add(a), r.add(e.id);
	}), {
		directPairKeys: n,
		existingEdgeIds: r
	};
}
function Yi(e, t, n, r) {
	let i = ta(e, t) <= 0 ? e : t, a = i === e ? t : e, o = r.bridge;
	return Object.freeze({
		id: n,
		fromNodeId: i.id,
		toNodeId: a.id,
		pathKind: "overpass",
		initiallyVisible: !1,
		completionPolicy: "preserve-variant",
		curveStyle: o.curveStyle,
		width: o.width,
		deckThickness: o.deckThickness,
		platformEdgeOffset: o.platformEdgeOffset,
		straightApproachLength: o.straightApproachLength,
		bridgeSurfaceY: o.bridgeSurfaceY,
		maximumSurfacePitchDegrees: o.maximumSurfacePitchDegrees,
		routingCost: o.routingCost,
		underpassEdgeIds: Object.freeze([]),
		requiredClearance: o.requiredClearance
	});
}
function Xi(e, t) {
	return `edge-overpass:${encodeURIComponent(e)}:${encodeURIComponent(t)}`;
}
function Zi(e) {
	let t = e[0] ?? null;
	if (t === null) return null;
	for (let n = 1; n < e.length; n += 1) {
		let r = e[n];
		r.profile.chordLength < t.profile.chordLength - Wi && (t = r);
	}
	return t;
}
function Qi(e, t) {
	return na(e.edge.id, t.edge.id);
}
function $i(e) {
	let t = () => [...e.entriesByPairKey.values()], n = {
		nodeCount: e.stableNodes.length,
		authoredStraightEdgeCount: e.authoredStraightEdgeCount,
		totalUnorderedPairCount: e.stableNodes.length * (e.stableNodes.length - 1) / 2,
		directlyConnectedPairCount: e.directPairCount,
		catalogBridgeCount: e.expectedBridgeCount
	};
	return Object.defineProperties(n, {
		materializedBridgeCount: {
			enumerable: !0,
			get: () => e.entriesByPairKey.size
		},
		shortenedApproachCount: {
			enumerable: !0,
			get: () => t().filter((e) => e.profile.approachWasShortened).length
		},
		loweredCrownCount: {
			enumerable: !0,
			get: () => t().filter((e) => e.profile.crownWasLowered).length
		},
		minimumChordLength: {
			enumerable: !0,
			get: () => Zi(t())?.profile.chordLength ?? 0
		},
		maximumChordLength: {
			enumerable: !0,
			get: () => Math.max(0, ...t().map((e) => e.profile.chordLength))
		},
		maximumPredictedSurfacePitchDegrees: {
			enumerable: !0,
			get: () => Math.max(0, ...t().map((e) => e.profile.predictedMaximumSurfacePitchDegrees))
		},
		shortestBridge: {
			enumerable: !0,
			get: () => {
				let e = Zi(t());
				return e ? ea(e) : null;
			}
		}
	}), Object.freeze(n);
}
function ea(e) {
	return Object.freeze({
		edgeId: e.edge.id,
		fromNodeId: e.edge.fromNodeId,
		toNodeId: e.edge.toNodeId,
		chordLength: e.profile.chordLength,
		straightApproachLength: e.edge.straightApproachLength,
		bridgeSurfaceY: e.edge.bridgeSurfaceY,
		predictedMaximumSurfacePitchDegrees: e.profile.predictedMaximumSurfacePitchDegrees
	});
}
function ta(e, t) {
	return e.navigationOrder - t.navigationOrder || na(e.id, t.id);
}
function na(e, t) {
	return e < t ? -1 : +(e > t);
}
//#endregion
//#region src/config/pathData.ts
var $ = .523, ra = "special-zone-row-2-brown-chain", ia = "special-zone-4-brown-chain", aa = "special-zone-row-8-brown-chain", oa = "special-zone-row-9-10-brown-chain", sa = Object.freeze([
	{
		id: "node-1",
		navigationOrder: 0,
		label: "第 1 节点",
		position: {
			x: 0,
			z: -7
		},
		initiallyGreen: !0,
		initiallyVisible: !0,
		completionPolicy: "promote-to-green",
		surfaceY: $,
		variant: "green"
	},
	{
		id: "node-2",
		navigationOrder: 1,
		label: "第 2 节点",
		position: {
			x: 0,
			z: -3.5
		},
		initiallyGreen: !0,
		initiallyVisible: !0,
		completionPolicy: "promote-to-green",
		surfaceY: $,
		variant: "green"
	},
	{
		id: "node-3",
		navigationOrder: 2,
		label: "第 3 节点",
		position: {
			x: -3.75,
			z: 0
		},
		initiallyGreen: !0,
		initiallyVisible: !0,
		completionPolicy: "promote-to-green",
		surfaceY: $,
		variant: "green"
	},
	{
		id: "node-4",
		navigationOrder: 3,
		label: "第 4 节点",
		position: {
			x: 0,
			z: 0
		},
		initiallyGreen: !0,
		initiallyVisible: !0,
		completionPolicy: "promote-to-green",
		surfaceY: $,
		variant: "green"
	},
	{
		id: "node-5",
		navigationOrder: 4,
		label: "第 5 节点",
		position: {
			x: 3.75,
			z: 0
		},
		initiallyGreen: !0,
		initiallyVisible: !0,
		completionPolicy: "promote-to-green",
		surfaceY: $,
		variant: "green"
	},
	{
		id: "node-6",
		navigationOrder: 5,
		label: "第 6 节点",
		position: {
			x: 7.5,
			z: 0
		},
		initiallyGreen: !1,
		initiallyVisible: !1,
		completionPolicy: "preserve-variant",
		activationGroupId: ia,
		surfaceY: $,
		variant: "brown"
	},
	{
		id: "node-7",
		navigationOrder: 6,
		label: "第 7 节点",
		position: {
			x: 11.25,
			z: 0
		},
		initiallyGreen: !1,
		initiallyVisible: !1,
		completionPolicy: "preserve-variant",
		activationGroupId: ia,
		surfaceY: $,
		variant: "brown"
	},
	{
		id: "node-8",
		navigationOrder: 7,
		label: "第 8 节点",
		position: {
			x: 0,
			z: 3.5
		},
		initiallyGreen: !0,
		initiallyVisible: !0,
		completionPolicy: "promote-to-green",
		surfaceY: $,
		variant: "green"
	},
	{
		id: "node-9",
		navigationOrder: 8,
		label: "第 9 节点",
		position: {
			x: -2.6,
			z: 5.8
		},
		initiallyGreen: !0,
		initiallyVisible: !0,
		completionPolicy: "promote-to-green",
		surfaceY: $,
		variant: "green"
	},
	{
		id: "node-10",
		navigationOrder: 9,
		label: "第 10 节点",
		position: {
			x: 2.6,
			z: 5.8
		},
		initiallyGreen: !0,
		initiallyVisible: !0,
		completionPolicy: "promote-to-green",
		surfaceY: $,
		variant: "green"
	},
	{
		id: "node-11",
		navigationOrder: 10,
		label: "第 11 节点",
		position: {
			x: 0,
			z: 8.3
		},
		initiallyGreen: !1,
		initiallyVisible: !0,
		completionPolicy: "preserve-variant",
		surfaceY: $,
		variant: "gray"
	},
	{
		id: "node-12",
		navigationOrder: 11,
		label: "第 12 节点",
		position: {
			x: 15,
			z: 0
		},
		initiallyGreen: !1,
		initiallyVisible: !1,
		completionPolicy: "preserve-variant",
		activationGroupId: ia,
		surfaceY: $,
		variant: "brown"
	},
	{
		id: "node-13",
		navigationOrder: 12,
		label: "第 13 节点",
		position: {
			x: 18.75,
			z: 0
		},
		initiallyGreen: !1,
		initiallyVisible: !1,
		completionPolicy: "preserve-variant",
		activationGroupId: ia,
		surfaceY: $,
		variant: "brown"
	},
	{
		id: "node-14",
		navigationOrder: 13,
		label: "第 14 节点",
		position: {
			x: 3.75,
			z: -3.5
		},
		initiallyGreen: !1,
		initiallyVisible: !1,
		completionPolicy: "preserve-variant",
		activationGroupId: ra,
		surfaceY: $,
		variant: "brown"
	},
	{
		id: "node-15",
		navigationOrder: 14,
		label: "第 15 节点",
		position: {
			x: 7.5,
			z: -3.5
		},
		initiallyGreen: !1,
		initiallyVisible: !1,
		completionPolicy: "preserve-variant",
		activationGroupId: ra,
		surfaceY: $,
		variant: "brown"
	},
	{
		id: "node-16",
		navigationOrder: 15,
		label: "第 16 节点",
		position: {
			x: 11.25,
			z: -3.5
		},
		initiallyGreen: !1,
		initiallyVisible: !1,
		completionPolicy: "preserve-variant",
		activationGroupId: ra,
		surfaceY: $,
		variant: "brown"
	},
	{
		id: "node-17",
		navigationOrder: 16,
		label: "第 17 节点",
		position: {
			x: 15,
			z: -3.5
		},
		initiallyGreen: !1,
		initiallyVisible: !1,
		completionPolicy: "preserve-variant",
		activationGroupId: ra,
		surfaceY: $,
		variant: "brown"
	},
	{
		id: "node-18",
		navigationOrder: 17,
		label: "第 18 节点",
		position: {
			x: 4.8,
			z: 3.5
		},
		initiallyGreen: !1,
		initiallyVisible: !1,
		completionPolicy: "preserve-variant",
		activationGroupId: aa,
		surfaceY: $,
		variant: "brown"
	},
	{
		id: "node-19",
		navigationOrder: 18,
		label: "第 19 节点",
		position: {
			x: 9.2,
			z: 3.5
		},
		initiallyGreen: !1,
		initiallyVisible: !1,
		completionPolicy: "preserve-variant",
		activationGroupId: aa,
		surfaceY: $,
		variant: "brown"
	},
	{
		id: "node-20",
		navigationOrder: 19,
		label: "第 20 节点",
		position: {
			x: 13.6,
			z: 3.5
		},
		initiallyGreen: !1,
		initiallyVisible: !1,
		completionPolicy: "preserve-variant",
		activationGroupId: aa,
		surfaceY: $,
		variant: "brown"
	},
	{
		id: "node-21",
		navigationOrder: 20,
		label: "第 21 节点",
		position: {
			x: 18,
			z: 3.5
		},
		initiallyGreen: !1,
		initiallyVisible: !1,
		completionPolicy: "preserve-variant",
		activationGroupId: aa,
		surfaceY: $,
		variant: "brown"
	},
	{
		id: "node-22",
		navigationOrder: 21,
		label: "第 22 节点",
		position: {
			x: 7,
			z: 5.8
		},
		initiallyGreen: !1,
		initiallyVisible: !1,
		completionPolicy: "preserve-variant",
		activationGroupId: oa,
		surfaceY: $,
		variant: "brown"
	},
	{
		id: "node-23",
		navigationOrder: 22,
		label: "第 23 节点",
		position: {
			x: 11.4,
			z: 5.8
		},
		initiallyGreen: !1,
		initiallyVisible: !1,
		completionPolicy: "preserve-variant",
		activationGroupId: oa,
		surfaceY: $,
		variant: "brown"
	},
	{
		id: "node-24",
		navigationOrder: 23,
		label: "第 24 节点",
		position: {
			x: 15.8,
			z: 5.8
		},
		initiallyGreen: !1,
		initiallyVisible: !1,
		completionPolicy: "preserve-variant",
		activationGroupId: oa,
		surfaceY: $,
		variant: "brown"
	},
	{
		id: "node-25",
		navigationOrder: 24,
		label: "第 25 节点",
		position: {
			x: 20.2,
			z: 5.8
		},
		initiallyGreen: !1,
		initiallyVisible: !1,
		completionPolicy: "preserve-variant",
		activationGroupId: oa,
		surfaceY: $,
		variant: "brown"
	}
]), ca = Object.freeze([
	{
		id: "edge-1-2",
		fromNodeId: "node-1",
		toNodeId: "node-2",
		pathKind: "straight",
		initiallyVisible: !0,
		completionPolicy: "promote-to-green"
	},
	{
		id: "edge-2-3",
		fromNodeId: "node-2",
		toNodeId: "node-3",
		pathKind: "straight",
		initiallyVisible: !0,
		completionPolicy: "promote-to-green"
	},
	{
		id: "edge-2-4",
		fromNodeId: "node-2",
		toNodeId: "node-4",
		pathKind: "straight",
		initiallyVisible: !0,
		completionPolicy: "promote-to-green"
	},
	{
		id: "edge-2-5",
		fromNodeId: "node-2",
		toNodeId: "node-5",
		pathKind: "straight",
		initiallyVisible: !0,
		completionPolicy: "promote-to-green"
	},
	{
		id: "edge-3-8",
		fromNodeId: "node-3",
		toNodeId: "node-8",
		pathKind: "straight",
		initiallyVisible: !0,
		completionPolicy: "promote-to-green"
	},
	{
		id: "edge-4-8",
		fromNodeId: "node-4",
		toNodeId: "node-8",
		pathKind: "straight",
		initiallyVisible: !0,
		completionPolicy: "promote-to-green"
	},
	{
		id: "edge-5-8",
		fromNodeId: "node-5",
		toNodeId: "node-8",
		pathKind: "straight",
		initiallyVisible: !0,
		completionPolicy: "promote-to-green"
	},
	{
		id: "edge-6-7",
		fromNodeId: "node-6",
		toNodeId: "node-7",
		pathKind: "straight",
		initiallyVisible: !1,
		completionPolicy: "preserve-variant",
		activationGroupId: ia
	},
	{
		id: "edge-7-12",
		fromNodeId: "node-7",
		toNodeId: "node-12",
		pathKind: "straight",
		initiallyVisible: !1,
		completionPolicy: "preserve-variant",
		activationGroupId: ia
	},
	{
		id: "edge-12-13",
		fromNodeId: "node-12",
		toNodeId: "node-13",
		pathKind: "straight",
		initiallyVisible: !1,
		completionPolicy: "preserve-variant",
		activationGroupId: ia
	},
	{
		id: "edge-8-9",
		fromNodeId: "node-8",
		toNodeId: "node-9",
		pathKind: "straight",
		initiallyVisible: !0,
		completionPolicy: "promote-to-green"
	},
	{
		id: "edge-8-10",
		fromNodeId: "node-8",
		toNodeId: "node-10",
		pathKind: "straight",
		initiallyVisible: !0,
		completionPolicy: "promote-to-green"
	},
	{
		id: "edge-9-11",
		fromNodeId: "node-9",
		toNodeId: "node-11",
		pathKind: "straight",
		initiallyVisible: !0,
		completionPolicy: "preserve-variant"
	},
	{
		id: "edge-10-11",
		fromNodeId: "node-10",
		toNodeId: "node-11",
		pathKind: "straight",
		initiallyVisible: !0,
		completionPolicy: "preserve-variant"
	},
	{
		id: "edge-14-15",
		fromNodeId: "node-14",
		toNodeId: "node-15",
		pathKind: "straight",
		initiallyVisible: !1,
		completionPolicy: "preserve-variant",
		activationGroupId: ra
	},
	{
		id: "edge-15-16",
		fromNodeId: "node-15",
		toNodeId: "node-16",
		pathKind: "straight",
		initiallyVisible: !1,
		completionPolicy: "preserve-variant",
		activationGroupId: ra
	},
	{
		id: "edge-16-17",
		fromNodeId: "node-16",
		toNodeId: "node-17",
		pathKind: "straight",
		initiallyVisible: !1,
		completionPolicy: "preserve-variant",
		activationGroupId: ra
	},
	{
		id: "edge-18-19",
		fromNodeId: "node-18",
		toNodeId: "node-19",
		pathKind: "straight",
		initiallyVisible: !1,
		completionPolicy: "preserve-variant",
		activationGroupId: aa
	},
	{
		id: "edge-19-20",
		fromNodeId: "node-19",
		toNodeId: "node-20",
		pathKind: "straight",
		initiallyVisible: !1,
		completionPolicy: "preserve-variant",
		activationGroupId: aa
	},
	{
		id: "edge-20-21",
		fromNodeId: "node-20",
		toNodeId: "node-21",
		pathKind: "straight",
		initiallyVisible: !1,
		completionPolicy: "preserve-variant",
		activationGroupId: aa
	},
	{
		id: "edge-22-23",
		fromNodeId: "node-22",
		toNodeId: "node-23",
		pathKind: "straight",
		initiallyVisible: !1,
		completionPolicy: "preserve-variant",
		activationGroupId: oa
	},
	{
		id: "edge-23-24",
		fromNodeId: "node-23",
		toNodeId: "node-24",
		pathKind: "straight",
		initiallyVisible: !1,
		completionPolicy: "preserve-variant",
		activationGroupId: oa
	},
	{
		id: "edge-24-25",
		fromNodeId: "node-24",
		toNodeId: "node-25",
		pathKind: "straight",
		initiallyVisible: !1,
		completionPolicy: "preserve-variant",
		activationGroupId: oa
	}
]), la = Object.freeze([
	{
		id: "edge-session-2-14",
		fromNodeId: "node-2",
		toNodeId: "node-14",
		pathKind: "straight",
		initiallyVisible: !1,
		completionPolicy: "preserve-variant",
		activationGroupId: ra
	},
	{
		id: "edge-session-5-6",
		fromNodeId: "node-5",
		toNodeId: "node-6",
		pathKind: "straight",
		initiallyVisible: !1,
		completionPolicy: "preserve-variant",
		activationGroupId: ia
	},
	{
		id: "edge-session-8-18",
		fromNodeId: "node-8",
		toNodeId: "node-18",
		pathKind: "straight",
		initiallyVisible: !1,
		completionPolicy: "preserve-variant",
		activationGroupId: aa
	},
	{
		id: "edge-session-10-22",
		fromNodeId: "node-10",
		toNodeId: "node-22",
		pathKind: "straight",
		initiallyVisible: !1,
		completionPolicy: "preserve-variant",
		activationGroupId: oa
	}
]), ua = 1e-6, da = Object.freeze({
	id: "dynamic-bridge-for-hop-distant-target",
	distanceMetric: "minimum-hop-count",
	distanceGraph: "authored-logical",
	hopThresholdExclusive: 2,
	dynamicBridgesAffectDistance: !1,
	routeBehavior: "direct-current-to-target",
	ordinaryBridgeLimit: 1,
	outgoingBridgeLimitPerAnchor: 1,
	endpointPairIdentity: "undirected",
	reuseExistingEndpointPair: !0,
	waitForBridgeBeforeTraversal: !0
});
function fa(e) {
	return Object.freeze(e.map((e) => Object.freeze({ ...e })));
}
var pa = Object.freeze({
	entryConnectorRevealPolicy: "first",
	activationTrigger: "idle-at-any-activation-node",
	unlockPolicy: "repeatable-session",
	retention: "retain-inside-session-envelope",
	externalBridgeReplacement: "retire-entry-overpass-before-ensure",
	dismissalTrigger: "departure-from-session-envelope",
	dismissalBridgeOrder: "entry-left-to-right-preclear",
	dismissalConstructOrder: "reverse-reveal-right-to-left",
	lockHiddenMembersAfterDismissal: !0,
	activationMemberRoutingPolicy: "direct-only-from-activation-to-far-member-otherwise-existing-chain",
	recomputeRemainingHopsAtEntry: !0,
	retainEntryConnectorDuringMemberRoutes: !0,
	memberDynamicBridgeLifetime: "retire-at-physical-arrival",
	retainedEntryOverpassCountsTowardOrdinaryLimit: !1,
	entryConnectorAffectsAuthoredHopDistance: !1
}), ma = Object.freeze({
	id: ra,
	activationNodeIds: Object.freeze(["node-2"]),
	entryNodeId: "node-14",
	memberNodeIds: Object.freeze([
		"node-14",
		"node-15",
		"node-16",
		"node-17"
	]),
	memberStraightEdgeIds: Object.freeze([
		"edge-14-15",
		"edge-15-16",
		"edge-16-17"
	]),
	entryConnections: Object.freeze([Object.freeze({
		activationNodeId: "node-2",
		kind: "straight-edge",
		edgeId: "edge-session-2-14"
	})]),
	revealSequence: fa([
		{ kind: "session-entry-connector" },
		{
			kind: "node",
			nodeId: "node-14"
		},
		{
			kind: "straight-edge",
			edgeId: "edge-14-15"
		},
		{
			kind: "node",
			nodeId: "node-15"
		},
		{
			kind: "straight-edge",
			edgeId: "edge-15-16"
		},
		{
			kind: "node",
			nodeId: "node-16"
		},
		{
			kind: "straight-edge",
			edgeId: "edge-16-17"
		},
		{
			kind: "node",
			nodeId: "node-17"
		}
	]),
	...pa
}), ha = Object.freeze({
	id: ia,
	activationNodeIds: Object.freeze([
		"node-3",
		"node-4",
		"node-5"
	]),
	entryNodeId: "node-6",
	memberNodeIds: Object.freeze([
		"node-6",
		"node-7",
		"node-12",
		"node-13"
	]),
	memberStraightEdgeIds: Object.freeze([
		"edge-6-7",
		"edge-7-12",
		"edge-12-13"
	]),
	entryConnections: Object.freeze([
		Object.freeze({
			activationNodeId: "node-3",
			kind: "overpass"
		}),
		Object.freeze({
			activationNodeId: "node-4",
			kind: "overpass"
		}),
		Object.freeze({
			activationNodeId: "node-5",
			kind: "straight-edge",
			edgeId: "edge-session-5-6"
		})
	]),
	revealSequence: fa([
		{ kind: "session-entry-connector" },
		{
			kind: "node",
			nodeId: "node-6"
		},
		{
			kind: "straight-edge",
			edgeId: "edge-6-7"
		},
		{
			kind: "node",
			nodeId: "node-7"
		},
		{
			kind: "straight-edge",
			edgeId: "edge-7-12"
		},
		{
			kind: "node",
			nodeId: "node-12"
		},
		{
			kind: "straight-edge",
			edgeId: "edge-12-13"
		},
		{
			kind: "node",
			nodeId: "node-13"
		}
	]),
	...pa
}), ga = Object.freeze({
	id: aa,
	activationNodeIds: Object.freeze(["node-8"]),
	entryNodeId: "node-18",
	memberNodeIds: Object.freeze([
		"node-18",
		"node-19",
		"node-20",
		"node-21"
	]),
	memberStraightEdgeIds: Object.freeze([
		"edge-18-19",
		"edge-19-20",
		"edge-20-21"
	]),
	entryConnections: Object.freeze([Object.freeze({
		activationNodeId: "node-8",
		kind: "straight-edge",
		edgeId: "edge-session-8-18"
	})]),
	revealSequence: fa([
		{ kind: "session-entry-connector" },
		{
			kind: "node",
			nodeId: "node-18"
		},
		{
			kind: "straight-edge",
			edgeId: "edge-18-19"
		},
		{
			kind: "node",
			nodeId: "node-19"
		},
		{
			kind: "straight-edge",
			edgeId: "edge-19-20"
		},
		{
			kind: "node",
			nodeId: "node-20"
		},
		{
			kind: "straight-edge",
			edgeId: "edge-20-21"
		},
		{
			kind: "node",
			nodeId: "node-21"
		}
	]),
	...pa
}), _a = Object.freeze({
	id: oa,
	activationNodeIds: Object.freeze(["node-9", "node-10"]),
	entryNodeId: "node-22",
	memberNodeIds: Object.freeze([
		"node-22",
		"node-23",
		"node-24",
		"node-25"
	]),
	memberStraightEdgeIds: Object.freeze([
		"edge-22-23",
		"edge-23-24",
		"edge-24-25"
	]),
	entryConnections: Object.freeze([Object.freeze({
		activationNodeId: "node-9",
		kind: "overpass"
	}), Object.freeze({
		activationNodeId: "node-10",
		kind: "straight-edge",
		edgeId: "edge-session-10-22"
	})]),
	revealSequence: fa([
		{ kind: "session-entry-connector" },
		{
			kind: "node",
			nodeId: "node-22"
		},
		{
			kind: "straight-edge",
			edgeId: "edge-22-23"
		},
		{
			kind: "node",
			nodeId: "node-23"
		},
		{
			kind: "straight-edge",
			edgeId: "edge-23-24"
		},
		{
			kind: "node",
			nodeId: "node-24"
		},
		{
			kind: "straight-edge",
			edgeId: "edge-24-25"
		},
		{
			kind: "node",
			nodeId: "node-25"
		}
	]),
	...pa
}), va = Object.freeze([
	ma,
	ha,
	ga,
	_a
]), ya = Object.freeze({
	dynamicBridge: da,
	specialPathZones: va
}), ba = Object.freeze(ca.map((e) => Object.freeze({
	id: e.id,
	fromNodeId: e.fromNodeId,
	toNodeId: e.toNodeId,
	connectionKind: "straight"
})));
function xa(e) {
	let t = e.initialNodeId ?? "node-1";
	Sa(e.rules.dynamicBridge);
	let n = Ma(e.nodes, "node"), r = Ma(e.straightEdges, "straight edge"), i = /* @__PURE__ */ new Set();
	for (let t of e.straightEdges) {
		if (Na(n, t.fromNodeId, `Straight edge "${t.id}"`), Na(n, t.toNodeId, `Straight edge "${t.id}"`), t.fromNodeId === t.toNodeId) throw Error(`Straight edge "${t.id}" cannot be a self-loop.`);
		let e = Pa(t.fromNodeId, t.toNodeId);
		if (i.has(e)) throw Error(`Physical straight topology repeats node pair "${e}".`);
		i.add(e);
	}
	let a = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set();
	for (let i of e.rules.specialPathZones) Ca(i, n, r, a, o, t);
	for (let t of e.nodes) if (t.activationGroupId && !a.has(t.activationGroupId)) throw Error(`Node "${t.id}" references unknown activation group "${t.activationGroupId}".`);
	for (let t of e.straightEdges) if (t.activationGroupId && !a.has(t.activationGroupId)) throw Error(`Straight edge "${t.id}" references unknown activation group "${t.activationGroupId}".`);
	Oa(e.authoredLogicalEdges, e.straightEdges, e.rules.specialPathZones, n);
}
function Sa(e) {
	if (!Number.isInteger(e.hopThresholdExclusive) || e.hopThresholdExclusive < 0) throw Error("Dynamic bridge hopThresholdExclusive must be a non-negative integer.");
	if (!Number.isInteger(e.ordinaryBridgeLimit) || e.ordinaryBridgeLimit < 1) throw Error("Dynamic bridge ordinaryBridgeLimit must be a positive integer.");
	if (!Number.isInteger(e.outgoingBridgeLimitPerAnchor) || e.outgoingBridgeLimitPerAnchor < 1) throw Error("Dynamic bridge outgoingBridgeLimitPerAnchor must be a positive integer.");
}
function Ca(e, t, n, r, i, a) {
	if (e.id.trim().length === 0 || r.has(e.id)) throw Error(`Special path zone has an empty or duplicate id "${e.id}".`);
	if (r.add(e.id), wa(e), e.activationNodeIds.length === 0) throw Error(`Special zone "${e.id}" needs at least one activation node.`);
	let o = /* @__PURE__ */ new Set(), s = [];
	for (let n of e.activationNodeIds) {
		if (o.has(n) || i.has(n)) throw Error(`Activation node "${n}" has duplicate row-zone ownership.`);
		o.add(n), i.add(n);
		let r = Na(t, n, `Special zone "${e.id}"`);
		if (n === a || r.variant !== "green" || !r.initiallyGreen || !r.initiallyVisible) throw Error(`Special zone "${e.id}" activation "${n}" must be an initially visible green node other than the initial node.`);
		if (r.activationGroupId !== void 0) throw Error(`Activation green "${n}" cannot be a hidden zone member.`);
		s.push(r);
	}
	let c = s[0].position.z;
	if (s.some((e) => !Fa(e.position.z, c))) throw Error(`Special zone "${e.id}" activation nodes must share one row.`);
	if (e.memberNodeIds.length === 0) throw Error(`Special zone "${e.id}" must own at least one brown platform.`);
	let l = /* @__PURE__ */ new Set(), u = [];
	for (let n of e.memberNodeIds) {
		if (l.has(n)) throw Error(`Special zone "${e.id}" repeats member node "${n}".`);
		l.add(n);
		let r = Na(t, n, `Special zone "${e.id}"`);
		if (r.activationGroupId !== e.id || r.variant !== "brown" || r.initiallyGreen || r.initiallyVisible || r.completionPolicy !== "preserve-variant") throw Error(`Special zone "${e.id}" member "${n}" must be an owned hidden brown platform.`);
		if (!Fa(r.position.z, c)) throw Error(`Special zone "${e.id}" brown members must share the activation row.`);
		u.push(r);
	}
	if (!l.has(e.entryNodeId)) throw Error(`Special zone "${e.id}" entry must be one of its brown members.`);
	for (let n of t.values()) if (n.activationGroupId === e.id && !l.has(n.id)) throw Error(`Node "${n.id}" belongs to special zone "${e.id}" but is absent from memberNodeIds.`);
	let d = Na(t, e.entryNodeId, `Special zone "${e.id}"`), f = Math.min(...u.map((e) => e.position.x));
	if (!Fa(d.position.x, f)) throw Error(`Special zone "${e.id}" entry must be its leftmost brown platform.`);
	let p = [...t.values()].filter((e) => e.initiallyVisible && e.initiallyGreen && e.variant === "green" && Fa(e.position.z, c)), m = Math.max(...p.map((e) => e.position.x));
	if (!(d.position.x > m + ua)) throw Error(`Special zone "${e.id}" first brown platform must sit right of the row's rightmost green platform.`);
	let h = Da(e, t, n, o, d);
	if (e.memberStraightEdgeIds.length !== e.memberNodeIds.length - 1) throw Error(`Special zone "${e.id}" brown chain must contain exactly one fewer road than platforms.`);
	let g = /* @__PURE__ */ new Set(), _ = [];
	for (let t of e.memberStraightEdgeIds) {
		if (g.has(t)) throw Error(`Special zone "${e.id}" repeats member edge "${t}".`);
		g.add(t);
		let r = n.get(t);
		if (!r) throw Error(`Special zone "${e.id}" references missing edge "${t}".`);
		if (!l.has(r.fromNodeId) || !l.has(r.toNodeId) || r.activationGroupId !== e.id || r.initiallyVisible || r.completionPolicy !== "preserve-variant") throw Error(`Special zone "${e.id}" edge "${t}" is not a hidden owned member road.`);
		_.push(r);
	}
	for (let t of n.values()) if (t.activationGroupId === e.id && !g.has(t.id) && !h.has(t.id)) throw Error(`Straight edge "${t.id}" belongs to special zone "${e.id}" but is absent from memberStraightEdgeIds.`);
	Aa(_, l, `Special zone "${e.id}" brown chain`), Ea(e, l, g);
}
function wa(e) {
	if (e.entryConnectorRevealPolicy !== "first" || e.activationTrigger !== "idle-at-any-activation-node" || e.unlockPolicy !== "repeatable-session" || e.retention !== "retain-inside-session-envelope" || e.externalBridgeReplacement !== "retire-entry-overpass-before-ensure" || e.dismissalTrigger !== "departure-from-session-envelope" || e.dismissalBridgeOrder !== "entry-left-to-right-preclear" || e.dismissalConstructOrder !== "reverse-reveal-right-to-left" || e.lockHiddenMembersAfterDismissal !== !0 || !Ta(e.activationMemberRoutingPolicy) || e.recomputeRemainingHopsAtEntry !== !0 || e.retainEntryConnectorDuringMemberRoutes !== !0 || e.memberDynamicBridgeLifetime !== "retire-at-physical-arrival" || e.retainedEntryOverpassCountsTowardOrdinaryLimit !== !1 || e.entryConnectorAffectsAuthoredHopDistance !== !1) throw Error(`Special zone "${e.id}" has an unsupported session policy.`);
}
function Ta(e) {
	return e === "entry-then-existing-chain" || e === "direct-only-from-activation-to-far-member-otherwise-existing-chain";
}
function Ea(e, t, n) {
	let r = /* @__PURE__ */ new Set(["session-entry-connector"]);
	for (let e of t) r.add(`node:${e}`);
	for (let e of n) r.add(`straight-edge:${e}`);
	let i = /* @__PURE__ */ new Set();
	for (let r of e.revealSequence) {
		let a;
		if (r.kind === "node") {
			if (!t.has(r.nodeId)) throw Error(`Special zone "${e.id}" reveal references non-member node "${r.nodeId}".`);
			a = `node:${r.nodeId}`;
		} else if (r.kind === "straight-edge") {
			if (!n.has(r.edgeId)) throw Error(`Special zone "${e.id}" reveal references non-member edge "${r.edgeId}".`);
			a = `straight-edge:${r.edgeId}`;
		} else a = "session-entry-connector";
		if (i.has(a)) throw Error(`Special zone "${e.id}" reveal repeats "${a}".`);
		i.add(a);
	}
	if (ja(i, r, `Special zone "${e.id}" reveal sequence`), e.revealSequence[0]?.kind !== "session-entry-connector") throw Error(`Special zone "${e.id}" session entry connector must reveal first.`);
}
function Da(e, t, n, r, i) {
	if (e.entryConnections.length !== r.size) throw Error(`Special zone "${e.id}" must declare exactly one entry connector per activation node.`);
	let a = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set();
	for (let s of e.entryConnections) {
		if (!r.has(s.activationNodeId)) throw Error(`Special zone "${e.id}" entry connector references non-activation node "${s.activationNodeId}".`);
		if (a.has(s.activationNodeId)) throw Error(`Special zone "${e.id}" repeats entry connector for activation "${s.activationNodeId}".`);
		a.add(s.activationNodeId);
		let c = Na(t, s.activationNodeId, `Special zone "${e.id}" entry connector`);
		if (!Fa(c.position.z, i.position.z)) throw Error(`Special zone "${e.id}" entry connector endpoints must share one horizontal row.`);
		let l = [...t.values()].some((e) => e.id !== c.id && e.id !== i.id && Fa(e.position.z, c.position.z) && e.position.x > Math.min(c.position.x, i.position.x) + ua && e.position.x < Math.max(c.position.x, i.position.x) - ua);
		if (s.kind === "overpass") {
			if (!l) throw Error(`Special zone "${e.id}" adjacent entry ${c.id} <-> ${i.id} must use a straight road.`);
			continue;
		}
		if (l) throw Error(`Special zone "${e.id}" non-adjacent entry ${c.id} <-> ${i.id} must use an overpass.`);
		if (o.has(s.edgeId)) throw Error(`Special zone "${e.id}" repeats session entry straight "${s.edgeId}".`);
		let u = n.get(s.edgeId);
		if (!u) throw Error(`Special zone "${e.id}" references missing session entry straight "${s.edgeId}".`);
		if (!(u.fromNodeId === c.id && u.toNodeId === i.id || u.fromNodeId === i.id && u.toNodeId === c.id) || u.initiallyVisible || u.activationGroupId !== e.id || u.completionPolicy !== "preserve-variant") throw Error(`Special zone "${e.id}" straight entry "${s.edgeId}" must be a hidden owned road joining exactly ${c.id} and ${i.id}.`);
		o.add(s.edgeId);
	}
	return ja(a, r, `Special zone "${e.id}" entry connector activations`), o;
}
function Oa(e, t, n, r) {
	let i = Ma(e, "authored logical edge"), a = Ma(t, "physical straight edge"), o = new Set(n.flatMap((e) => e.entryConnections.flatMap((e) => e.kind === "straight-edge" ? [e.edgeId] : []))), s = /* @__PURE__ */ new Set();
	for (let t of e) {
		Na(r, t.fromNodeId, `Logical edge "${t.id}"`), Na(r, t.toNodeId, `Logical edge "${t.id}"`);
		let e = Pa(t.fromNodeId, t.toNodeId);
		if (s.has(e)) throw Error(`Authored logical graph repeats node pair "${e}".`);
		s.add(e);
		let n = a.get(t.id);
		if (!n || n.fromNodeId !== t.fromNodeId || n.toNodeId !== t.toNodeId) throw Error(`Authored logical edge "${t.id}" is missing or mismatched in physical straight topology.`);
		if (o.has(t.id)) throw Error(`Session entry straight "${t.id}" must not affect authored logical hop distance.`);
	}
	for (let e of t) {
		if (o.has(e.id)) {
			if (i.has(e.id)) throw Error(`Session entry straight "${e.id}" leaked into authored logical topology.`);
			continue;
		}
		let t = i.get(e.id);
		if (!t || t.connectionKind !== "straight" || t.fromNodeId !== e.fromNodeId || t.toNodeId !== e.toNodeId) throw Error(`Straight edge "${e.id}" is missing or mismatched in authored logical topology.`);
	}
	if (e.length + o.size !== t.length) throw Error("Authored logical topology contains a non-straight or unowned connection.");
	ka(e, r);
	let c = new Set([...r.values()].filter((e) => e.initiallyVisible).map((e) => e.id));
	Aa(t.filter((e) => e.initiallyVisible && c.has(e.fromNodeId) && c.has(e.toNodeId)), c, "Initially visible base graph");
	for (let e of n) Aa(t.filter((t) => e.memberStraightEdgeIds.includes(t.id)), new Set(e.memberNodeIds), `Special zone "${e.id}" brown chain`);
}
function ka(e, t) {
	let n = /* @__PURE__ */ new Map(), r = /* @__PURE__ */ new Map();
	for (let e of t.keys()) n.set(e, 0), r.set(e, []);
	for (let t of e) r.get(t.fromNodeId).push(t.toNodeId), n.set(t.toNodeId, n.get(t.toNodeId) + 1);
	let i = [...n].filter(([, e]) => e === 0).map(([e]) => e), a = 0;
	for (let e = 0; e < i.length; e += 1) {
		let t = i[e];
		a += 1;
		for (let e of r.get(t)) {
			let t = n.get(e) - 1;
			n.set(e, t), t === 0 && i.push(e);
		}
	}
	if (a !== t.size) throw Error("Authored logical topology must remain a directed acyclic graph.");
}
function Aa(e, t, n) {
	let r = t.values().next().value;
	if (!r) throw Error(`${n} requires at least one node.`);
	let i = /* @__PURE__ */ new Map();
	for (let e of t) i.set(e, []);
	for (let n of e) !t.has(n.fromNodeId) || !t.has(n.toNodeId) || (i.get(n.fromNodeId).push(n.toNodeId), i.get(n.toNodeId).push(n.fromNodeId));
	let a = /* @__PURE__ */ new Set([r]), o = [r];
	for (let e = 0; e < o.length; e += 1) for (let t of i.get(o[e])) a.has(t) || (a.add(t), o.push(t));
	if (a.size !== t.size) throw Error(`${n} must be internally connected.`);
}
function ja(e, t, n) {
	for (let r of t) if (!e.has(r)) throw Error(`${n} omits "${String(r)}".`);
	for (let r of e) if (!t.has(r)) throw Error(`${n} contains unexpected "${String(r)}".`);
}
function Ma(e, t) {
	let n = /* @__PURE__ */ new Map();
	return e.forEach((e, r) => {
		if (e.id.trim().length === 0 || n.has(e.id)) throw Error(`Configured ${t} at index ${r} has an empty or duplicate id.`);
		n.set(e.id, e);
	}), n;
}
function Na(e, t, n) {
	let r = e.get(t);
	if (!r) throw Error(`${n} references missing node "${t}".`);
	return r;
}
function Pa(e, t) {
	if (e === t) throw Error(`Logical connection cannot loop at "${e}".`);
	return e < t ? `${e}\u0000${t}` : `${t}\u0000${e}`;
}
function Fa(e, t) {
	return Math.abs(e - t) <= ua;
}
xa({
	nodes: sa,
	straightEdges: Object.freeze([...ca, ...la]),
	rules: ya,
	authoredLogicalEdges: ba
});
//#endregion
//#region src/config/createRuntimePathBundle.ts
function Ia(e) {
	let t = Object.freeze(e.nodes.map(La)), n = Object.freeze(e.authoredStraightEdges.map(Ra)), r = Object.freeze(e.sessionEntryStraightEdges.map(Ra)), i = Object.freeze([...n, ...r]), a = Object.freeze(n.map((e) => Object.freeze({
		id: e.id,
		fromNodeId: e.fromNodeId,
		toNodeId: e.toNodeId,
		connectionKind: "straight"
	})));
	xa({
		nodes: t,
		straightEdges: i,
		rules: Object.freeze({
			dynamicBridge: e.dynamicBridgeRule,
			specialPathZones: e.specialZones
		}),
		authoredLogicalEdges: a,
		initialNodeId: e.initialNodeId
	});
	let o = /* @__PURE__ */ new Map();
	t.forEach((e, t) => o.set(e.id, t)), za(o, e.initialNodeId, "initialNodeId"), za(o, e.entryNodeId, "entryNodeId"), za(o, e.goalNodeId, "goalNodeId");
	let s = Gi(t, i), c = (e) => o.get(e) ?? -1, l = (e) => {
		if (e === null) return null;
		let n = c(e);
		return n >= 0 ? t[n] ?? null : null;
	}, u = (e, t) => e === t ? null : s.getOverpassBetween(e, t), d = Ba({
		specialZones: e.specialZones,
		sessionEntryStraightEdges: r,
		runtimeStraightEdges: i,
		getOverpassBetween: u
	}), f = () => Object.freeze([...i, ...s.getMaterializedEdges()]), p = {
		catalog: s.diagnostics,
		authoredStraightEdgeCount: n.length,
		runtimeStraightEdgeCount: i.length,
		configuredSpecialBridgeIds: d.bridgeIds,
		configuredSpecialStraightEdgeIds: d.straightEdgeIds,
		configuredSpecialConnectorCount: d.connectorCount,
		underpassAuditMode: "disabled",
		physicalBridgeIdentity: "one-per-undirected-pair"
	};
	Object.defineProperty(p, "staticGeometryEdgeCount", {
		enumerable: !0,
		get: () => f().length
	}), Object.freeze(p);
	let m = {
		nodes: t,
		initialNodeId: e.initialNodeId,
		entryNodeId: e.entryNodeId,
		goalNodeId: e.goalNodeId
	};
	Object.defineProperty(m, "edges", {
		enumerable: !0,
		get: f
	}), Object.freeze(m);
	let h = {
		nodes: t,
		authoredStraightEdges: n,
		authoredLogicalEdges: a,
		runtimeStraightEdges: i,
		diagnostics: p,
		graph: m,
		getNode: l,
		getNodeById: l,
		getNodeIndex: c,
		getOverpassBetween: u,
		getOverpassEdgeBetween: u
	};
	return Object.defineProperties(h, {
		overpassCatalog: {
			enumerable: !0,
			get: s.getMaterializedEdges
		},
		edges: {
			enumerable: !0,
			get: f
		}
	}), Object.freeze(h);
}
function La(e) {
	return Object.freeze({
		...e,
		position: Object.freeze({ ...e.position })
	});
}
function Ra(e) {
	return Object.freeze({ ...e });
}
function za(e, t, n) {
	if (!e.has(t)) throw Error(`Runtime path ${n} references missing node "${t}".`);
}
function Ba(e) {
	let t = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set(), r = new Map(e.runtimeStraightEdges.map((e) => [e.id, e])), i = 0;
	for (let a of e.specialZones) {
		if (a.revealSequence.filter((e) => e.kind === "session-entry-connector").length !== 1) throw Error(`Special zone "${a.id}" must declare exactly one session entry connector template.`);
		for (let o of a.entryConnections) {
			if (i += 1, o.kind === "straight-edge") {
				let t = r.get(o.edgeId);
				if (!t) throw Error(`Special zone "${a.id}" is missing runtime entry straight "${o.edgeId}".`);
				if (!(t.fromNodeId === o.activationNodeId && t.toNodeId === a.entryNodeId || t.fromNodeId === a.entryNodeId && t.toNodeId === o.activationNodeId) || e.getOverpassBetween(o.activationNodeId, a.entryNodeId) !== null) throw Error(`Special zone "${a.id}" runtime straight ${o.activationNodeId} <-> ${a.entryNodeId} is mismatched or still has bridge geometry.`);
				n.add(t.id);
				continue;
			}
			let s = e.getOverpassBetween(o.activationNodeId, a.entryNodeId);
			if (s === null) throw Error(`Special zone "${a.id}" requires session entry bridge ${o.activationNodeId} <-> ${a.entryNodeId}, but that pair is straight-connected or missing.`);
			t.add(s.id);
		}
	}
	let a = e.specialZones.reduce((e, t) => e + t.activationNodeIds.length, 0), o = new Set(e.sessionEntryStraightEdges.map((e) => e.id));
	if (i !== a) throw Error(`Expected ${a} configured special entry connectors, got ${i}.`);
	if (n.size !== o.size || [...o].some((e) => !n.has(e))) throw Error(`Configured special entries must use all ${o.size} session straight roads exactly once.`);
	if (t.size !== a - o.size) throw Error(`Expected ${a - o.size} overpass entries, got ${t.size}.`);
	return Object.freeze({
		bridgeIds: Object.freeze([...t].sort(Va)),
		straightEdgeIds: Object.freeze([...n].sort(Va)),
		connectorCount: i
	});
}
function Va(e, t) {
	return e < t ? -1 : +(e > t);
}
//#endregion
//#region src/app/compileLearningPathRuntime.ts
function Ha(e, t = {}) {
	let n = Object.freeze(e.nodes.map(Ua)), r = Object.freeze(e.edges.map(Wa)), i = new Set(r.map((e) => e.id)), a = new Set(r.map((e) => ro(e.fromNodeId, e.toNodeId))), o = [], s = [];
	for (let t of e.conceptZones) {
		let n = Ga(t, e.nodes, i, a);
		o.push(n.zone), n.sessionEntryStraightEdge && (s.push(n.sessionEntryStraightEdge), i.add(n.sessionEntryStraightEdge.id), a.add(ro(n.sessionEntryStraightEdge.fromNodeId, n.sessionEntryStraightEdge.toNodeId)));
	}
	let c = Object.freeze([...e.goalNodeIds]), l = Ja(e, t.primaryGoalNodeId), u = t.dynamicBridgeRule ?? da, d = Object.freeze(o), f = Object.freeze(s), p = Ia({
		nodes: n,
		authoredStraightEdges: r,
		sessionEntryStraightEdges: f,
		specialZones: d,
		dynamicBridgeRule: u,
		initialNodeId: e.initialNodeId,
		entryNodeId: e.entryNodeId,
		goalNodeId: l
	}), m = qa(e), h = Object.freeze(e.nodes.map((e) => Object.freeze({
		id: e.id,
		initiallyVisible: e.entityKind === "subject" && e.initiallyVisible
	}))), g = Object.freeze(e.edges.map((e) => Object.freeze({
		id: e.id,
		fromNodeId: e.fromNodeId,
		toNodeId: e.toNodeId,
		initiallyVisible: (e.sourceKind === "subject-flow" || e.sourceKind === "parallel-peer") && e.initiallyVisible
	}))), _ = Ka(e), v = Ya(e, t.revision), y = Object.freeze({
		source: e,
		runtimeBundle: p,
		specialZones: d,
		dynamicBridgeRule: u,
		actionRegistry: m,
		goalNodeIds: c,
		primaryGoalNodeId: l
	}), b = Object.freeze({
		revision: v,
		initialNodeId: e.initialNodeId,
		nodes: h,
		edges: g,
		revealOrder: _,
		data: zt(v, y)
	});
	return Object.freeze({
		source: e,
		runtimeBundle: p,
		specialZones: d,
		sessionEntryStraightEdges: f,
		dynamicBridgeRule: u,
		actionRegistry: m,
		page: b,
		goalNodeIds: c,
		primaryGoalNodeId: l
	});
}
function Ua(e) {
	return Object.freeze({
		id: e.id,
		navigationOrder: e.navigationOrder,
		label: e.label,
		position: Object.freeze({ ...e.position }),
		initiallyGreen: e.initiallyGreen,
		initiallyVisible: e.initiallyVisible,
		completionPolicy: e.completionPolicy,
		...e.activationGroupId ? { activationGroupId: e.activationGroupId } : {},
		surfaceY: e.surfaceY,
		variant: e.variant
	});
}
function Wa(e) {
	return Object.freeze({
		id: e.id,
		fromNodeId: e.fromNodeId,
		toNodeId: e.toNodeId,
		pathKind: "straight",
		initiallyVisible: e.initiallyVisible,
		completionPolicy: e.completionPolicy,
		...e.activationGroupId ? { activationGroupId: e.activationGroupId } : {}
	});
}
function Ga(e, t, n, r) {
	let i = Qa(t, e.activationSubjectNodeId, `Concept zone "${e.id}" activation`), a = Qa(t, e.entryConnection.toConceptNodeId, `Concept zone "${e.id}" entry`), o = ro(i.id, a.id);
	if (r.has(o)) throw Error(`Concept zone "${e.id}" entry duplicates physical pair "${o}".`);
	let s, c = null;
	if (e.entryConnection.preferredPathKind === "overpass") s = Object.freeze({
		activationNodeId: i.id,
		kind: "overpass"
	});
	else {
		let t = Za(e.id, i.id, a.id, n);
		s = Object.freeze({
			activationNodeId: i.id,
			kind: "straight-edge",
			edgeId: t
		}), c = Object.freeze({
			id: t,
			fromNodeId: i.id,
			toNodeId: a.id,
			pathKind: "straight",
			initiallyVisible: !1,
			completionPolicy: "preserve-variant",
			activationGroupId: e.id
		});
	}
	let l = Object.freeze([Object.freeze({ kind: "session-entry-connector" }), ...e.revealOrder.map((e) => e.kind === "node" ? Object.freeze({
		kind: "node",
		nodeId: e.id
	}) : Object.freeze({
		kind: "straight-edge",
		edgeId: e.id
	}))]);
	return Object.freeze({
		zone: Object.freeze({
			id: e.id,
			activationNodeIds: Object.freeze([e.activationSubjectNodeId]),
			entryNodeId: e.entryConnection.toConceptNodeId,
			memberNodeIds: Object.freeze([...e.memberConceptNodeIds]),
			memberStraightEdgeIds: Object.freeze([...e.memberEdgeIds]),
			entryConnections: Object.freeze([s]),
			revealSequence: l,
			entryConnectorRevealPolicy: "first",
			activationTrigger: "idle-at-any-activation-node",
			unlockPolicy: "repeatable-session",
			retention: "retain-inside-session-envelope",
			externalBridgeReplacement: "retire-entry-overpass-before-ensure",
			dismissalTrigger: "departure-from-session-envelope",
			dismissalBridgeOrder: "entry-left-to-right-preclear",
			dismissalConstructOrder: "reverse-reveal-right-to-left",
			lockHiddenMembersAfterDismissal: !0,
			activationMemberRoutingPolicy: "entry-then-existing-chain",
			recomputeRemainingHopsAtEntry: !0,
			retainEntryConnectorDuringMemberRoutes: !0,
			memberDynamicBridgeLifetime: "retire-at-physical-arrival",
			retainedEntryOverpassCountsTowardOrdinaryLimit: !1,
			entryConnectorAffectsAuthoredHopDistance: !1
		}),
		sessionEntryStraightEdge: c
	});
}
function Ka(e) {
	let t = e.nodes.filter((e) => e.entityKind === "subject" && e.initiallyVisible), n = new Set(t.map((e) => e.id)), r = e.edges.filter((e) => (e.sourceKind === "subject-flow" || e.sourceKind === "parallel-peer") && e.initiallyVisible && n.has(e.fromNodeId) && n.has(e.toNodeId)), i = r.filter((e) => e.sourceKind === "subject-flow"), a = /* @__PURE__ */ new Map(), o = new Map(t.map((e) => [e.id, 0]));
	for (let e of i) {
		let t = a.get(e.fromNodeId) ?? [];
		t.push(e), a.set(e.fromNodeId, t), o.set(e.toNodeId, (o.get(e.toNodeId) ?? 0) + 1);
	}
	for (let e of a.values()) e.sort(to);
	let s = new Map(t.map((e) => [e.id, e])), c = t.filter((e) => o.get(e.id) === 0).sort((t, n) => $a(t, n, e.initialNodeId)), l = /* @__PURE__ */ new Set(), u = /* @__PURE__ */ new Set(), d = [];
	for (; c.length > 0;) {
		let t = c.shift();
		if (!t) break;
		d.push(Object.freeze({
			kind: "node",
			nodeId: t.id
		})), l.add(t.id);
		let n = r.filter((e) => !u.has(e.id) && l.has(e.fromNodeId) && l.has(e.toNodeId)).sort(to);
		for (let e of n) d.push(Object.freeze({
			kind: "edge",
			edgeId: e.id,
			fromNodeId: e.fromNodeId,
			toNodeId: e.toNodeId
		})), u.add(e.id);
		for (let n of a.get(t.id) ?? []) {
			let t = (o.get(n.toNodeId) ?? 0) - 1;
			if (o.set(n.toNodeId, t), t === 0) {
				let t = s.get(n.toNodeId);
				t && no(c, t, (t, n) => $a(t, n, e.initialNodeId));
			}
		}
	}
	if (d[0]?.kind !== "node" || d[0].nodeId !== e.initialNodeId) throw Error(`Initial reveal order cannot start at compiled entry "${e.initialNodeId}".`);
	if (l.size !== t.length) throw Error("Initial subject flow is cyclic or disconnected from its entry node.");
	if (u.size !== r.length) throw Error("Initial subject reveal omitted one or more visible flow edges.");
	return Object.freeze(d);
}
function qa(e) {
	let t = e.nodes.flatMap((e) => e.action ? [[e.id, Object.freeze({
		nodeId: e.id,
		action: e.action,
		resource: e.action.resource
	})]] : []), n = new Map(t), r = new Map(t.map(([, e]) => [e.action.id, e.resource]));
	return Object.freeze({
		actionByNodeId: n,
		resourceByActionId: r,
		getAction: (e) => e === null ? null : n.get(e) ?? null
	});
}
function Ja(e, t) {
	if (t !== void 0) {
		if (!e.goalNodeIds.includes(t)) throw Error(`Requested primary goal "${t}" is not a compiled goal.`);
		return t;
	}
	let n = e.goalNodeIds.map((t) => Qa(e.nodes, t, "Compiled goal")).sort(eo)[0];
	if (!n) throw Error("Compiled learning path must declare at least one goal node.");
	return n.id;
}
function Ya(e, t) {
	if (t !== void 0) {
		let e = t.trim();
		if (e.length === 0) throw Error("Learning path revision cannot be empty.");
		return e;
	}
	let n = [
		e.protocol,
		e.version,
		e.sourceDocumentId,
		e.initialNodeId,
		...e.nodes.flatMap((e) => [
			e.id,
			e.entityKind,
			String(e.navigationOrder),
			String(e.position.x),
			String(e.position.z),
			e.card.title,
			e.action?.id ?? "",
			e.action?.resource.id ?? ""
		]),
		...e.edges.flatMap((e) => [
			e.id,
			e.fromNodeId,
			e.toNodeId,
			e.sourceKind
		])
	].join("");
	return `${e.sourceDocumentId}@${e.version}-${Xa(n)}`;
}
function Xa(e) {
	let t = 2166136261;
	for (let n = 0; n < e.length; n += 1) t ^= e.charCodeAt(n), t = Math.imul(t, 16777619);
	return (t >>> 0).toString(16).padStart(8, "0");
}
function Za(e, t, n, r) {
	let i = `session-entry:${encodeURIComponent(e)}:${encodeURIComponent(t)}:${encodeURIComponent(n)}`;
	if (!r.has(i)) return i;
	let a = 2;
	for (; r.has(`${i}:${a}`);) a += 1;
	return `${i}:${a}`;
}
function Qa(e, t, n) {
	let r = e.find((e) => e.id === t);
	if (!r) throw Error(`${n} references missing node "${t}".`);
	return r;
}
function $a(e, t, n) {
	return e.id === n ? t.id === n ? 0 : -1 : t.id === n ? 1 : eo(e, t);
}
function eo(e, t) {
	return e.navigationOrder - t.navigationOrder || io(e.id, t.id);
}
function to(e, t) {
	return io(e.id, t.id);
}
function no(e, t, n) {
	let r = 0;
	for (; r < e.length && n(e[r], t) <= 0;) r += 1;
	e.splice(r, 0, t);
}
function ro(e, t) {
	return io(e, t) <= 0 ? `${e}\u001f${t}` : `${t}\u001f${e}`;
}
function io(e, t) {
	return e < t ? -1 : +(e > t);
}
//#endregion
//#region src/app/PageGenerationPresenter.ts
function ao(e) {
	return `${e.transactionId}\u0000${e.revision}\u0000${e.token}`;
}
function oo(e) {
	return e.type === "PAGE.PRESENTATION.REVEAL_PATH_STEP" ? Object.freeze({
		...e,
		step: Object.freeze({ ...e.step })
	}) : Object.freeze({ ...e });
}
function so(e) {
	return e instanceof Error ? e.message : typeof e == "string" ? e : "Unknown page presentation failure.";
}
function co(e) {
	return e.type === "PAGE.PRESENTATION.REVEAL_PATH_STEP" ? Object.freeze({
		type: "PAGE.PATH_STEP.SETTLED",
		transactionId: e.transactionId,
		revision: e.revision,
		token: e.token
	}) : Object.freeze({
		type: "PAGE.CHARACTER.SETTLED",
		transactionId: e.transactionId,
		revision: e.revision,
		token: e.token
	});
}
function lo(e, t) {
	return Object.freeze({
		type: "PAGE.PRESENTATION.FAILED",
		transactionId: e.transactionId,
		revision: e.revision,
		token: e.token,
		error: so(t)
	});
}
var uo = class {
	queue = [];
	pendingKeys = /* @__PURE__ */ new Set();
	finalizedKeys = /* @__PURE__ */ new Set();
	runtime = null;
	active = null;
	generation = 0;
	draining = !1;
	disposed = !1;
	constructor(e) {
		e && (this.runtime = e);
	}
	executePresentation = (e) => {
		if (this.disposed) return;
		let t = ao(e);
		this.pendingKeys.has(t) || this.finalizedKeys.has(t) || (this.pendingKeys.add(t), this.queue.push(Object.freeze({
			command: oo(e),
			key: t,
			generation: this.generation
		})), this.requestDrain());
	};
	installRuntime(e) {
		if (this.disposed) throw Error("Cannot install a runtime on a disposed PageGenerationPresenter.");
		this.runtime && this.runtime !== e && this.cancel(), this.runtime = e, this.requestDrain();
	}
	cancel() {
		if (!this.disposed) {
			this.generation += 1, this.active?.controller.abort(), this.active && this.finalizeWithoutResult(this.active.key);
			for (let e of this.queue) this.finalizeWithoutResult(e.key);
			this.queue.length = 0;
		}
	}
	dispose() {
		this.disposed || (this.cancel(), this.disposed = !0, this.runtime = null);
	}
	get pendingCommandCount() {
		return this.queue.length + +!!this.active;
	}
	get isDisposed() {
		return this.disposed;
	}
	requestDrain() {
		this.draining || this.disposed || !this.runtime || (this.draining = !0, this.drain());
	}
	async drain() {
		try {
			for (; !this.disposed && this.runtime && this.queue.length > 0;) {
				let e = this.queue.shift();
				if (!e) continue;
				if (e.generation !== this.generation || this.finalizedKeys.has(e.key)) {
					this.finalizeWithoutResult(e.key);
					continue;
				}
				let t = this.runtime, n = new AbortController(), r = Object.freeze({
					...e,
					controller: n
				});
				this.active = r;
				let i;
				try {
					await this.perform(t.presentation, r.command, n.signal), i = co(r.command);
				} catch (e) {
					i = lo(r.command, e);
				}
				let a = !this.disposed && r.generation === this.generation && !n.signal.aborted && this.runtime === t && !this.finalizedKeys.has(r.key);
				this.active = null, this.pendingKeys.delete(r.key), this.finalizedKeys.add(r.key), a && this.emit(t, i);
			}
		} finally {
			this.draining = !1, !this.disposed && this.runtime && this.queue.length > 0 && this.requestDrain();
		}
	}
	perform(e, t, n) {
		let r = t.motionPreference === "reduced";
		return t.type === "PAGE.PRESENTATION.REVEAL_CHARACTER" ? e.revealCharacter(t.nodeId, r, n) : t.step.kind === "node" ? e.revealNode(t.step.nodeId, r, n) : e.revealEdge(t.step.edgeId, r, n);
	}
	finalizeWithoutResult(e) {
		this.pendingKeys.delete(e), this.finalizedKeys.add(e);
	}
	emit(e, t) {
		try {
			e.send(t);
		} catch {}
	}
}, fo = null, po = null;
function mo() {
	return fo ??= import("./LearningPathSession-BWw2RtRt.js").catch((e) => {
		throw fo = null, e;
	}), fo;
}
function ho() {
	return po ??= import("./prepareLearningPathCharacter-Bvm1PXv0.js").catch((e) => {
		throw po = null, e;
	}), po;
}
function go(e) {
	return e.pagePhase === "ready" && e.hasSnapshot && e.hasRuntime && e.hasProgress;
}
function _o(e) {
	return e.phase === "active" && e.sessionRevision !== null && e.activatedSessionRevision !== e.sessionRevision && e.hasSession && e.hasPathOrchestrationActor;
}
function vo(e, t) {
	return Object.prototype.hasOwnProperty.call(e, t);
}
function yo(e) {
	return e instanceof DOMException && e.name === "AbortError";
}
function bo(e) {
	switch (e.kind) {
		case "validation": return `路径数据未通过校验：${e.message}`;
		case "compilation": return `路径编译失败：${e.message}`;
		case "compiled-contract": return `生成顺序不完整：${e.message}`;
		case "presentation-preparation": return `3D 场景准备失败：${e.message}`;
		case "presentation-timeout": return "路径动画等待超时，请重新生成。";
		case "presentation": return `路径动画失败：${e.message}`;
		default: return "未找到学习路径模板，请重试。";
	}
}
async function xo(e, t) {
	let n = t.elements, r = n.root, i = n.canvas, a = n.viewport, o = r.ownerDocument, s = o.defaultView;
	if (!s) throw Error("Learning-path runtime requires a browser window.");
	let c = t.mode, l = t.instanceId, u = t.standaloneTemplatePool ?? null;
	if (c === "standalone" && !u) throw Error("Standalone Demo/QA runtime requires its template-pool adapter.");
	let d = new uo(), f = s.matchMedia("(prefers-reduced-motion: reduce)"), p = () => t?.reducedMotion ?? f.matches, m = await ii(c === "standalone" || t?.diagnostics ? s.location.search : "").catch((e) => (console.warn("[learning-path] Stately Inspector could not start.", e), null)), h = t?.learningProgressStorage ?? new Hr(() => s.localStorage), _ = c === "standalone" ? u.readPersistedLearningPathChoice(s.localStorage) : null;
	if (c === "standalone" && _) try {
		u.writePersistedLearningPathChoice(s.localStorage, _);
	} catch {}
	let v = !1, y = 0, b = 0, ee = 0, x = null, S = null, C = null, te = null, w = null, T = null, E = null, D = null, O = null, ne = null, re = null, ie = null, k = null, A = null, j = 0, ae = null, M = null, oe = null, se = null, N = 0, P = null, ce = t?.diagnostics ?? new URLSearchParams(s.location.search).get("qa") === "1" ? (() => {
		let e = `learning-path-${l}-application-qa-debug`, t = r.querySelector(`#${e}`);
		if (t instanceof HTMLOutputElement) return t;
		let n = o.createElement("output");
		return n.id = e, n.hidden = !0, n.setAttribute("aria-hidden", "true"), r.append(n), n;
	})() : null, le = () => {
		if (!ce || !x) return;
		let e = x.getSnapshot(), t = Nr(e);
		ce.textContent = JSON.stringify({
			phase: Er(e),
			stateValue: e.value,
			activeSessionRevision: Dr(e),
			ignoredEventCount: e.context.ignoredEventCount,
			lastIgnoredEvent: e.context.lastIgnoredEvent,
			sceneSession: t ? {
				stateValue: t.getSnapshot().value,
				sessionRevision: t.getSnapshot().context.sessionRevision,
				gatewayAckSequence: t.getSnapshot().context.gatewayAckSequence,
				lastGatewayAck: t.getSnapshot().context.lastGatewayAck
			} : null
		});
	}, ue = () => M ? Promise.resolve(M) : (oe ??= ho().then((e) => {
		if (v) throw new DOMException("Character preload cancelled.", "AbortError");
		let n = e.prepareLearningPathCharacter(t?.characterAssetUrls);
		if (v) throw n.character.dispose(), new DOMException("Character preload cancelled.", "AbortError");
		return M ? (n.character.dispose(), M) : (M = n, n);
	}).catch((e) => {
		throw oe = null, e;
	}), oe);
	ue().catch(() => {});
	let F = (e) => {
		if (t?.progressionMode !== "open") return e;
		let n = Object.freeze(Object.fromEntries(Object.keys(e.subjectStatusById).map((e) => [e, "completed"]))), r = Object.freeze(Object.fromEntries(Object.keys(e.conceptStatusById).map((e) => [e, "in-progress"]))), i = Object.freeze({
			...n,
			...r
		}), a = Object.freeze(Object.fromEntries(Object.entries(e.nodeLearningStateById).map(([e, t]) => [e, Object.freeze({
			kind: t.kind,
			status: t.kind === "concept" ? "in-progress" : "completed"
		})])));
		return Object.freeze({
			...e,
			subjectStatusById: n,
			conceptStatusById: r,
			nodeStatusById: i,
			nodeLearningStateById: a
		});
	}, I = (e) => t?.progressionMode === "open" ? Object.freeze({
		goalNodeIds: e.goalNodeIds,
		subjectStatusById: Object.freeze(Object.fromEntries(Object.keys(e.subjectStatusById).map((e) => [e, "completed"]))),
		conceptStatusById: Object.freeze(Object.fromEntries(Object.keys(e.conceptStatusById).map((e) => [e, "in-progress"])))
	}) : e, L = () => {
		let e = x ? Or(x.getSnapshot()) : null;
		return e ? F(oi(e.getSnapshot().context.model)) : null;
	}, de = () => {
		let e = r.dataset.pagePhase;
		return Object.freeze({
			instanceId: l,
			phase: v ? "disposed" : e === "ready" ? "ready" : e === "failed" ? "failed" : e === "generating" ? "generating" : "mounting",
			sessionRevision: R(),
			session: S?.getSnapshot() ?? null,
			progress: L()
		});
	}, fe = (e, n, r) => {
		t?.onError?.(Object.freeze({
			phase: e,
			error: n,
			message: r
		}));
	}, R = () => x ? Dr(x.getSnapshot()) : null, z = (e) => {
		let t = R();
		t !== null && x?.send({
			type: "APP.PROGRESS.EVENT",
			sessionRevision: t,
			event: e
		});
	}, B = () => {
		let e = x;
		return e ? kr(e.getSnapshot())?.getSnapshot().context.transactionId ?? null : null;
	}, pe = () => {
		let e = x;
		if (!e) return null;
		let t = kr(e.getSnapshot())?.getSnapshot();
		return t?.context.transactionId ?? t?.context.lastOutcome?.transactionId ?? null;
	}, me = (e) => {
		let t = R();
		t !== null && x?.send({
			type: "APP.JOURNEY.EVENT",
			sessionRevision: t,
			event: e
		});
	}, he = (e) => {
		let t = R();
		t !== null && x?.send({
			type: "APP.COMPLETION_CELEBRATION.EVENT",
			sessionRevision: t,
			event: e
		});
	}, ge = () => {
		let e = x;
		return e ? Mr(e.getSnapshot()) : null;
	}, _e = (e, t) => {
		me({
			type: "REQUESTED",
			request: {
				targetNodeId: e,
				intent: t
			}
		});
		let n = x;
		if (!n) return !1;
		let r = kr(n.getSnapshot())?.getSnapshot(), i = !!(r && (r.matches("ready") || r.matches("moving") || r.matches("settling") || r.matches("idle") && r.context.lastOutcome?.type === "settled"));
		return i && t === "unlock" && r?.context.plan && r.context.transactionId && z({
			type: "UNLOCK.COMMIT.REGISTERED",
			commit: {
				targetNodeId: r.context.plan.targetNodeId,
				transactionId: r.context.transactionId,
				requiredCompletionNodeIds: r.context.plan.requiredCompletionNodeIds
			}
		}), i;
	}, V = () => {
		let e = x ? Ar(x.getSnapshot()) : null;
		return e ? yn(e.getSnapshot()) : null;
	}, ye = (e, t) => `node-card-${e}-${t.revision}-${t.nodeId}`, be = (e, t = !0) => {
		let n = R(), r = V();
		return n === null || !r ? !1 : (x?.send({
			type: "APP.NODE_CARD.EVENT",
			sessionRevision: n,
			event: {
				type: "NODE_CARD.ACTION_REQUESTED",
				instance: r,
				actionId: e,
				enabled: t
			}
		}), V() === null);
	}, xe = () => {
		let e = R(), t = V();
		e !== null && t && x?.send({
			type: "APP.NODE_CARD.EVENT",
			sessionRevision: e,
			event: {
				type: "NODE_CARD.DISMISS",
				instance: t
			}
		});
	}, Se = (e) => {
		let t = C, n = R();
		if (!t || n === null) return;
		z({
			type: "LEARNING.SETTLED",
			nodeId: e
		});
		let r = L();
		if (!r) return;
		let i = r.lastLearningLaunch;
		if (!i?.accepted || i.revision <= j || (j = i.revision, t.source.nodeById.get(e)?.entityKind !== "concept")) return;
		let a = t.actionRegistry.getAction(e);
		if (!a) return;
		let o = i.kind === "concept-start" ? "start" : i.kind === "concept-continue" ? "continue" : i.kind === "concept-review" ? "review" : null;
		o && x?.send({
			type: "APP.LEARNING_RESOURCE.AFTER_PERSISTENCE.REQUESTED",
			sessionRevision: n,
			event: {
				type: "RESOURCE.LAUNCH.REQUESTED",
				sessionRevision: n,
				intent: o,
				launchId: `resource-${n}-${i.revision}-${a.action.id}`,
				binding: {
					nodeId: e,
					actionId: a.action.id,
					resourceId: a.resource.id,
					href: a.resource.href,
					target: a.action.target ?? "self"
				}
			}
		});
	}, H = new Vi(a, {
		onLaunchRequested: (e) => {
			W(e.action);
		},
		onCardActionRequested: (e) => {
			let n = S, r = C, i = R(), a = V(), o = L();
			if (!n || !r || i === null || !a || !o || e.instanceId !== ye(i, a) || a.nodeId !== e.nodeId || !fn(e.actionId) || !be(e.actionId)) return;
			if (t?.progressionMode === "open" && e.actionId === "subject:enter") {
				n.goToNode(e.nodeId, "direct");
				return;
			}
			if (e.actionId === "unlock:go") {
				if (z({
					type: "UNLOCK.REQUESTED",
					nodeId: e.nodeId
				}), L()?.lastNavigationDecision?.accepted && !_e(e.nodeId, "unlock")) {
					let e = pe();
					e && z({
						type: "MOVEMENT.CANCELLED",
						safeNodeId: n.getSnapshot().currentNodeId,
						reason: "host-rejected",
						transactionId: e
					});
				}
				return;
			}
			if (e.actionId === "concept:defer") {
				z({
					type: "CONCEPT.DEFERRED",
					nodeId: e.nodeId
				});
				return;
			}
			if (e.actionId === "concept:complete") {
				z({
					type: "CONCEPT.MARK_COMPLETED",
					nodeId: e.nodeId
				});
				return;
			}
			let s = e.actionId === "subject:enter" ? "subject-enter" : e.actionId === "learn:start" ? "concept-start" : e.actionId === "learn:continue" ? "concept-continue" : e.actionId === "learn:review" ? "concept-review" : null;
			if (!s || (z({
				type: "LEARNING.REQUESTED",
				nodeId: e.nodeId,
				kind: s
			}), !L()?.lastNavigationDecision?.accepted)) return;
			let c = n.getSnapshot();
			if (c.currentNodeId === e.nodeId && !c.isRunning && c.visuallyIdle && c.targetNodeId === null) _e(e.nodeId, e.actionId === "learn:review" ? "review" : "learn") && Se(e.nodeId);
			else if (!_e(e.nodeId, e.actionId === "learn:review" ? "review" : "learn")) {
				let e = pe();
				e && z({
					type: "MOVEMENT.CANCELLED",
					safeNodeId: n.getSnapshot().currentNodeId,
					reason: "host-rejected",
					transactionId: e
				});
			}
		},
		onCelebrationSettled: (e) => {
			ge()?.activeCount === e.playCount && (he({
				type: "PRESENTATION.ACKNOWLEDGED",
				count: e.playCount
			}), he({
				type: "PRESENTATION.HIDDEN",
				count: e.playCount
			}));
		}
	}), Ce = new _n({
		viewport: a,
		view: H,
		resolveContext: (e) => {
			let t = S, n = C;
			return !t || !n || !n.source.nodeById.has(e) ? null : {
				overlay: t.overlay,
				reducedMotion: p()
			};
		}
	}), U = (e) => {
		let n = C, i = L(), a = R(), o = V(), s = ge(), c = go({
			pagePhase: r.dataset.pagePhase,
			hasSnapshot: e !== null,
			hasRuntime: n !== null,
			hasProgress: i !== null
		}), l = c && n && i && e && a !== null && o !== null ? ln({
			runtime: n,
			nodeId: o.nodeId,
			progress: i,
			session: e,
			instanceId: ye(a, o),
			subjectActionLabel: t?.progressionMode === "open" ? "走到这" : void 0
		}) : null, u = {
			generation: { phase: c ? "hidden" : "generating" },
			card: l,
			celebration: c && s?.visible ? {
				playCount: s.activeCount ?? 0,
				title: "完整学习路径已完成！",
				message: "你已经抵达图形学学习路径终点，所有阶段都已连成一条完整知识链。",
				reducedMotion: p(),
				visible: !0
			} : null
		};
		H.setViewModel(u), Ce.setNodeId(l?.nodeId ?? null);
	}, we = (e) => {
		let t = S;
		if (!t || !se) return;
		let n = se.project(I(e));
		n.changes.length !== 0 && (n.type === "replace" ? t.replaceNodeLearningStates(n.changes) : t.patchNodeLearningStates(n.changes), V() !== null && U(k ?? t.getSnapshot()));
	}, Te = () => {
		Ce.setNodeId(null), d.cancel(), w?.unsubscribe(), T?.unsubscribe(), w = null, T?.unsubscribe(), T = null, E?.unsubscribe(), E = null, D?.unsubscribe(), D = null, O?.unsubscribe(), O = null, re = null, ie = null, S?.dispose(), S = null, C = null, te = null, k = null, A = null, j = 0, se = null, H.setCardPlacement(null), P = null, t?.exposeGlobalDebug && delete s.__LEARNING_PATH_EXPERIENCE__;
	};
	x = wr({
		pageGeneration: {
			createTransactionId: () => `generation-${Date.now()}-${++y}`,
			validateTemplate: ({ template: e, signal: t }) => {
				if (t.aborted) throw new DOMException("Validation cancelled.", "AbortError");
				return g(e);
			},
			compilePath: ({ validatedTemplate: e, signal: t }) => {
				if (t.aborted) throw new DOMException("Compilation cancelled.", "AbortError");
				let n = ve(e), i = Ha(n);
				return te = n, C = i, r.dataset.pagePhase = "generating", i.page;
			},
			preparePresentation: async ({ revision: e, signal: r }) => {
				let o = te, u = C;
				if (Te(), !o || !u || u.page.revision !== e) throw Error("Compiled runtime is unavailable for this revision.");
				let [f, p] = await Promise.all([mo(), ue()]), { createLearningPathSession: m } = f;
				if (M === p && (M = null), oe = null, r.aborted) throw p.character.dispose(), new DOMException("Presentation preparation cancelled.", "AbortError");
				C = u, A = o.entryNodeId;
				let h = t?.subjectCardTrigger === "hover", g = t?.subjectCardTrigger === "activate-dismiss-on-leave", _ = (e) => o.nodeById.get(e)?.entityKind === "subject", y = () => {
					let e = R(), t = V();
					e === null || !t || !_(t.nodeId) || x?.send({
						type: "APP.NODE_CARD.EVENT",
						sessionRevision: e,
						event: { type: "SESSION.RESET" }
					});
				};
				S = m({
					canvas: i,
					viewport: a,
					ui: n,
					instanceId: l,
					characterAssetUrls: t?.characterAssetUrls,
					reducedMotion: t?.reducedMotion,
					diagnostics: t?.diagnostics,
					exposeGlobalDebug: t?.exposeGlobalDebug ?? c === "standalone",
					compiledPath: o,
					runtimeBundle: u.runtimeBundle,
					specialZones: u.specialZones,
					dynamicBridgeRule: u.dynamicBridgeRule,
					introAnimation: !0,
					preparedCharacter: p,
					nodeBadgeIconById: t?.nodeBadgeIconById,
					canNavigateToNode: (e, n) => n !== "direct" || t?.progressionMode === "open" || (() => {
						let t = L()?.nodeStatusById[e];
						return t !== void 0 && t !== "locked";
					})(),
					onNodeActivated: ({ nodeId: e }) => {
						if (h && _(e)) return;
						let t = R();
						t !== null && x?.send({
							type: "APP.NODE_CARD.EVENT",
							sessionRevision: t,
							event: {
								type: "NODE_CARD.PIN",
								nodeId: e
							}
						});
					},
					onNodeHovered: ({ nodeId: e }) => {
						if (!(!h && !g)) {
							if (e && _(e)) {
								if (h) {
									let t = R();
									if (t === null) return;
									x?.send({
										type: "APP.NODE_CARD.EVENT",
										sessionRevision: t,
										event: {
											type: "NODE_CARD.PIN",
											nodeId: e
										}
									});
								} else V()?.nodeId !== e && y();
								return;
							}
							y();
						}
					},
					onNodeTraversed: ({ nodeId: e }) => {
						let t = B();
						if (t) {
							me({
								type: "NODE_TRAVERSED",
								transactionId: t,
								nodeId: e
							});
							let n = x ? kr(x.getSnapshot())?.getSnapshot() : null;
							n?.matches("moving") && n.context.transactionId === t && n.context.currentNodeId === e && n.context.lastOutcome === null && z({
								type: "NODE.TRAVERSED",
								nodeId: e,
								transactionId: t
							});
						}
					},
					onMovementCancelled: ({ safeNodeId: e, reason: t }) => {
						let n = B();
						if (n) {
							me({
								type: "CANCELLED",
								transactionId: n,
								safeNodeId: e,
								reason: t
							});
							let r = x ? kr(x.getSnapshot())?.getSnapshot() : null;
							r?.matches("cancelled") && r.context.lastOutcome?.type === "cancelled" && r.context.lastOutcome.transactionId === n && z({
								type: "MOVEMENT.CANCELLED",
								safeNodeId: e,
								reason: t,
								transactionId: n
							});
						}
					},
					onRuntimeError: ({ error: e, message: t }) => {
						fe("runtime", e, t);
					},
					onBackgroundActivated: xe,
					onStateChanged: (e) => {
						if (v || S === null) return;
						let t = k;
						if (k = e, e.isRunning && t?.isRunning !== !0) {
							let e = B();
							if (e) {
								me({
									type: "MOVEMENT_STARTED",
									transactionId: e
								});
								let t = x ? kr(x.getSnapshot())?.getSnapshot() : null;
								t?.matches("moving") && t.context.transactionId === e && t.context.lastOutcome === null && L()?.pendingUnlockCommit?.transactionId === e && z({
									type: "UNLOCK.DEPARTED",
									transactionId: e
								});
							}
						}
						if (e.visuallyIdle && !e.isRunning && e.targetNodeId === null && A !== e.currentNodeId) {
							A = e.currentNodeId;
							let t = B();
							if (t) {
								me({
									type: "NODE_ARRIVED",
									transactionId: t,
									nodeId: e.currentNodeId
								});
								let n = x ? kr(x.getSnapshot())?.getSnapshot() : null;
								n?.matches("settling") && n.context.transactionId === t && n.context.currentNodeId === e.currentNodeId && n.context.lastOutcome === null && (z({
									type: "NODE.ARRIVED",
									nodeId: e.currentNodeId,
									transactionId: t
								}), me({
									type: "VISUAL_SETTLED",
									transactionId: t
								}));
							}
						}
						L()?.pendingLearningIntent?.nodeId === e.currentNodeId && e.visuallyIdle && !e.isRunning && e.targetNodeId === null && Se(e.currentNodeId), U(e);
					}
				}), (t?.exposeGlobalDebug ?? c === "standalone") && (s.__LEARNING_PATH_EXPERIENCE__ = Object.freeze({
					getState: () => {
						let e = L();
						return Object.freeze({
							progress: e,
							card: (() => {
								let n = C, r = k, i = R(), a = V();
								return e && n && r && i !== null && a ? ln({
									runtime: n,
									nodeId: a.nodeId,
									progress: e,
									session: r,
									instanceId: ye(i, a),
									subjectActionLabel: t?.progressionMode === "open" ? "走到这" : void 0
								}) : null;
							})(),
							celebration: ge(),
							nodeBadges: S?.getNodeLearningBadgeDebugInfos() ?? []
						});
					},
					selectNode: (e) => S?.selectNode(e) ?? !1,
					dismissCard: xe
				})), d.installRuntime({
					presentation: S.presentation,
					send: (e) => x?.send({
						type: "APP.PAGE.EVENT",
						event: e
					})
				});
			},
			executePresentation: d.executePresentation,
			onGenerationFailed: (e) => {
				Te(), r.dataset.pagePhase = c === "module" ? "failed" : "gate", fe("generation", e, bo(e)), H.setViewModel({
					generation: {
						phase: c === "module" ? "hidden" : "error",
						buttonLabel: "重新生成学习路径",
						canContinue: _ !== null,
						errorMessage: bo(e)
					},
					card: null,
					celebration: null
				});
			},
			onGenerationReady: () => {
				r.dataset.pagePhase = "ready";
			}
		},
		journey: {
			createTransactionId: () => `journey-${Date.now()}-${++ee}`,
			planJourney: ({ currentNodeId: e, request: t }) => {
				let n = L()?.lastNavigationDecision;
				return !n?.accepted || n.sourceNodeId !== e || n.targetNodeId !== t.targetNodeId ? {
					accepted: !1,
					reason: n?.reason ?? "no-progress-navigation-decision"
				} : {
					accepted: !0,
					plan: Object.freeze({
						sourceNodeId: e,
						targetNodeId: t.targetNodeId,
						routeNodeIds: Object.freeze([...n.routeNodeIds]),
						requiredCompletionNodeIds: t.intent === "unlock" ? Object.freeze([...n.requiredCompletionNodeIds]) : Object.freeze([])
					})
				};
			}
		},
		learningResource: t?.learningResource ?? zr(s),
		learningProgressStorage: h,
		resolveCompiledLearningPath: ({ revision: e }) => {
			let t = C;
			if (!t || t.page.revision !== e) throw Error(`Learning-path instance "${l}" has no compiled progression model for revision "${e}".`);
			return t.source;
		},
		reconcileRestoredProgress: ({ safeNodeId: e, signal: t }) => {
			if (t.aborted) throw new DOMException("Restored progress reconciliation cancelled.", "AbortError");
			let n = S;
			if (!n?.reconcileRestoredProgress(e)) throw Error(`Cannot reconcile restored safe node "${e}".`);
			A = e, k = n.getSnapshot();
		},
		createSceneRuntimeInput: ({ sessionRevision: e }) => {
			let t = S;
			if (!t) throw Error("Active learning session is unavailable for scene runtime.");
			return t.bindSceneRuntimeGateway(e, (t) => {
				x?.send({
					type: "APP.SCENE_RUNTIME.COMMAND",
					sessionRevision: e,
					command: t
				});
			}), {
				port: t.getSceneRuntimePort(),
				defaultTimeoutMs: 2e4,
				scheduler: t.getSceneRuntimeGatewayScheduler()
			};
		},
		createPathOrchestrationBinding: () => {
			if (!S) throw Error("Active learning session is unavailable for path orchestration.");
			return S.getPathOrchestrationBinding();
		}
	}, {
		input: {
			reducedMotion: p(),
			presentationAckTimeoutMs: 2e4
		},
		...m ? { inspect: m.inspect } : {}
	});
	let Ee = () => {
		let e = x;
		if (!e) return;
		let n = e.getSnapshot();
		le();
		let r = Dr(n), a = Er(n), o = Pr(n);
		if (a !== "active" || r === null || !o) {
			w?.unsubscribe(), w = null, T?.unsubscribe(), T = null, E?.unsubscribe(), E = null, D?.unsubscribe(), D = null, O?.unsubscribe(), O = null, se = null, re = null;
			return;
		}
		if (re === r) return;
		w?.unsubscribe(), T?.unsubscribe(), E?.unsubscribe(), D?.unsubscribe(), O?.unsubscribe();
		let s = Or(n), c = Ar(n), u = jr(n);
		se = new di(), w = s ? Fr(s, si, (e) => we(e), {
			equals: li,
			emitInitial: !0
		}) : null, T = s?.subscribe((e) => {
			t?.onProgressChange?.(F(oi(e.context.model)));
		}) ?? null, E = u?.subscribe(() => {
			U(k ?? S?.getSnapshot() ?? null);
			let e = ge(), n = e?.activeCount ?? 0;
			e?.visible && n > N && (N = n, t?.onComplete?.(Object.freeze({
				instanceId: l,
				playCount: n,
				snapshot: de()
			})));
		}) ?? null, D = c?.subscribe(() => U(k)) ?? null;
		let d = S;
		O = d ? At({
			sessionRevision: r,
			source: d,
			isCurrentSession: () => !v && S === d && R() === r,
			send: (e) => x?.send({
				type: "APP.SCENE_SESSION.EVENT",
				sessionRevision: r,
				event: e
			})
		}) : null, re = r, _o({
			phase: a,
			sessionRevision: r,
			activatedSessionRevision: ie,
			hasSession: d !== null,
			hasPathOrchestrationActor: o !== null
		}) && d && (ie = r, d.activate(), k = d.getSnapshot(), i.focus({ preventScroll: !0 }), P !== r && (P = r, t?.onReady?.(de()))), d && U(d.getSnapshot());
	};
	ne = x.subscribe(Ee), Ee();
	let W = async (i) => {
		if (!v) {
			m?.start(), ae?.abort(), ae = new AbortController(), r.dataset.pagePhase = "generating", H.setViewModel({ generation: {
				phase: "generating",
				canContinue: _ !== null
			} });
			try {
				let n = vo(e, "document") || vo(e, "documentUrl") || vo(e, "documentProvider") ? e : c === "standalone" ? ri(s) ?? e : e, r = vo(n, "document") || vo(n, "documentUrl") || vo(n, "documentProvider");
				if (c === "standalone" && i === "continue" && _ === null) throw Error("还没有可继续的学习路径，请先生成一条路径。");
				let a = c === "module" || r ? null : i === "generate" ? u.selectNextLearningPathTemplate(_?.templateId ?? null) : u.BUNDLED_LEARNING_PATH_TEMPLATES.find((e) => e.id === _?.templateId) ?? u.BUNDLED_LEARNING_PATH_TEMPLATES[0], o = await Qr(a ? { documentUrl: u.createBundledLearningPathTemplateUrl(s.location.href, a.fileName) } : n, {
					signal: ae.signal,
					baseUrl: s.location.href,
					defaultDocumentUrl: $r(s.location.href)
				});
				if (v || ae.signal.aborted) return;
				let l = a?.id ?? "host-provided", d = s.crypto?.randomUUID?.() ?? `${Date.now()}-${++b}`, f = c === "module" ? t?.progressStorageKey : i === "continue" ? _.progressStorageKey : u.createFreshLearningProgressStorageKey(l, d);
				if (!f?.trim()) throw Error("正式学习路径模块必须提供非空 progressStorageKey。");
				let m = Object.freeze({
					version: 1,
					templateId: l,
					progressStorageKey: f
				});
				if (c === "standalone" && a) try {
					u.writePersistedLearningPathChoice(s.localStorage, m), _ = m;
				} catch (e) {
					console.warn("[learning-path] Cannot persist the selected path slot.", e);
				}
				x?.send({
					type: "APP.GENERATE.REQUESTED",
					template: o,
					reducedMotion: p(),
					launchMode: i,
					progressStorageKey: f
				});
			} catch (e) {
				if (v || yo(e)) return;
				r.dataset.pagePhase = c === "module" ? "failed" : "gate";
				let t = `无法读取学习路径模板：${e instanceof Error ? e.message : String(e)}`;
				fe("host", e, t), c === "module" && (n.loadingPanel.dataset.state = "error", n.loadingLabel.textContent = t), H.setViewModel({ generation: {
					phase: c === "module" ? "hidden" : "error",
					buttonLabel: "重新生成学习路径",
					canContinue: _ !== null,
					errorMessage: t
				} });
			}
		}
	}, G = (e) => {
		H.containsCardEventPath(e) || e.target === i || xe();
	}, De = (e) => {
		if (e.key !== "Escape") return;
		let t = e.composedPath(), n = o.activeElement;
		!t.includes(r) && !(n && r.contains(n)) || (xe(), i.focus({ preventScroll: !0 }));
	}, Oe = () => {
		let e = x;
		if (!e) return;
		let t = Dr(e.getSnapshot());
		t !== null && e.send({
			type: "APP.PERSISTENCE.FLUSH.REQUESTED",
			sessionRevision: t
		});
	}, ke = () => {
		Oe();
	}, Ae = () => {
		o.visibilityState === "hidden" && Oe();
	};
	o.addEventListener("pointerdown", G, { capture: !0 }), o.addEventListener("keydown", De), o.addEventListener("visibilitychange", Ae), s.addEventListener("pagehide", ke);
	let je = () => {
		v || (Oe(), v = !0, s.removeEventListener("beforeunload", je), s.removeEventListener("pagehide", ke), o.removeEventListener("pointerdown", G, { capture: !0 }), o.removeEventListener("keydown", De), o.removeEventListener("visibilitychange", Ae), Ce.dispose(), ae?.abort(), ne?.unsubscribe(), ne = null, x?.stop(), x = null, d.dispose(), w?.unsubscribe(), T?.unsubscribe(), E?.unsubscribe(), D?.unsubscribe(), O?.unsubscribe(), S?.dispose(), M?.character.dispose(), M = null, oe = null, H.dispose(), m?.stop(), (t?.exposeGlobalDebug ?? c === "standalone") && delete s.__LEARNING_PATH_EXPERIENCE__, ce?.remove());
	};
	return s.addEventListener("beforeunload", je, { once: !0 }), c === "module" ? (r.dataset.pagePhase = "generating", H.setViewModel({
		generation: { phase: "hidden" },
		card: null,
		celebration: null
	}), await W(t?.launchMode ?? "continue")) : (r.dataset.pagePhase = "gate", H.setViewModel({
		generation: {
			phase: "ready",
			buttonLabel: "生成学习路径",
			canContinue: _ !== null
		},
		card: null,
		celebration: null
	}), H.focusGenerationAction()), Object.freeze({
		getSnapshot: de,
		focusNode: (e) => S?.selectNode(e) ?? !1,
		pause: () => S?.pause(),
		resume: () => S?.resume(),
		dispose: je
	});
}
//#endregion
//#region src/module/instanceRegistry.ts
var So = /* @__PURE__ */ new WeakMap();
function Co(e, t) {
	let n = So.get(e);
	if (n || (n = /* @__PURE__ */ new Set(), So.set(e, n)), n.has(t)) throw Error(`Learning-path instance "${t}" is already mounted.`);
	n.add(t);
	let r = !1;
	return () => {
		r || (r = !0, n?.delete(t), n?.size === 0 && So.delete(e));
	};
}
//#endregion
//#region src/module/mountLearningPath.ts
function wo(e) {
	if (e.characterAssets) return e.characterAssets;
	if (!e.assetBaseUrl) throw Error("mountLearningPath requires assetBaseUrl or characterAssets.");
	let t = new URL(e.assetBaseUrl, e.mount.ownerDocument.baseURI), n = (e) => new URL(e, t).href;
	return Object.freeze({
		run: n("liu-kanshan-run.glb"),
		runStop: n("liu-kanshan-run-stop.glb"),
		idle: n("liu-kanshan-idle.glb"),
		turn: n("liu-kanshan-turn.glb")
	});
}
function To(e) {
	let t = e.mount?.ownerDocument.defaultView?.HTMLElement;
	if (!t || !(e.mount instanceof t)) throw TypeError("mountLearningPath requires a host HTMLElement.");
	if (!e.instanceId.trim()) throw Error("mountLearningPath requires a non-empty instanceId.");
	Hi(e.instanceId);
	let n = e.progressKey.split(":");
	if (n.length < 4 || n.length % 2 != 0 || n.some((e) => e.trim().length === 0 || /\s/.test(e))) throw Error("mountLearningPath progressKey must use at least two non-empty namespace:value pairs.");
	if (!(Object.prototype.hasOwnProperty.call(e, "document") || Object.prototype.hasOwnProperty.call(e, "documentUrl") || Object.prototype.hasOwnProperty.call(e, "documentProvider"))) throw Error("mountLearningPath requires document, documentUrl or documentProvider.");
	if (typeof e.assetBaseUrl == "string" && !e.assetBaseUrl.trim()) throw Error("mountLearningPath requires a non-empty assetBaseUrl.");
	if (e.characterAssets) {
		for (let [t, n] of Object.entries(e.characterAssets)) if (!n.trim()) throw Error(`mountLearningPath characterAssets.${t} must be non-empty.`);
	}
}
async function Eo(e) {
	To(e);
	let t = Co(e.mount.ownerDocument, e.instanceId), n = null, r = null, i = !1;
	try {
		n = Ui(e.mount, e.instanceId), r = await xo(e, {
			mode: "module",
			instanceId: e.instanceId,
			elements: n,
			learningResource: e.navigator,
			learningProgressStorage: e.storage,
			progressStorageKey: e.progressKey,
			launchMode: e.launchMode ?? "continue",
			characterAssetUrls: wo(e),
			reducedMotion: e.reducedMotion,
			diagnostics: e.diagnostics ?? !1,
			exposeGlobalDebug: !1,
			subjectCardTrigger: e.subjectCardTrigger ?? "activate",
			progressionMode: e.progressionMode ?? "gated",
			nodeBadgeIconById: e.nodeBadgeIconById,
			onReady: e.onReady,
			onProgressChange: e.onProgressChange,
			onComplete: e.onComplete,
			onError: e.onError
		});
	} catch (r) {
		throw n?.root.remove(), t(), e.onError?.(Object.freeze({
			phase: "host",
			error: r,
			message: r instanceof Error ? r.message : String(r)
		})), r;
	}
	if (!n || !r) throw t(), Error("Learning-path module failed to create a runtime handle.");
	let a = r, o = n;
	return Object.freeze({
		getSnapshot: () => a.getSnapshot(),
		focusNode: (e) => a.focusNode(e),
		pause: () => a.pause(),
		resume: () => a.resume(),
		dispose: () => {
			i || (i = !0, a.dispose(), o.root.remove(), t());
		}
	});
}
//#endregion
export { Eo as mountLearningPath };

//# sourceMappingURL=index.js.map