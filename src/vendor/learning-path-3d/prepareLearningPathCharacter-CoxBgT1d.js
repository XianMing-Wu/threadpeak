import { t as e } from "./CharacterRig-CH9rqunS.js";
//#region src/infrastructure/three/character/prepareLearningPathCharacter.ts
var t = (e) => `/assets/${e}`, n = () => ({
	run: t("liu-kanshan-run.glb"),
	runStop: t("liu-kanshan-run-stop.glb"),
	idle: t("liu-kanshan-idle.glb"),
	turn: t("liu-kanshan-turn.glb")
});
function r(t = n()) {
	let r = new e(), i = r.load(t);
	return i.catch(() => {}), Object.freeze({
		character: r,
		ready: i
	});
}
//#endregion
export { n as getDefaultCharacterAssetUrls, r as prepareLearningPathCharacter };

//# sourceMappingURL=prepareLearningPathCharacter-CoxBgT1d.js.map