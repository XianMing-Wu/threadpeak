export type RouteFrameItem = {
    x: number;
    y: number;
    left: number;
    right: number;
    top: number;
    bottom: number;
    worldRadius?: number;
};
export type RouteFrameRect = {
    left: number;
    top: number;
    right: number;
    bottom: number;
};
/** Fit projected geometry plus fixed-size HTML lettering into the reserved scene.
 * Text remains at its readable CSS size; camera zoom alone must not crop its tail.
 */
export function fitRouteFrame(items: RouteFrameItem[], rect: RouteFrameRect) {
    const labelScale = Math.min(1, (rect.right - rect.left) / (Math.max(...items.map(i => i.left)) + Math.max(...items.map(i => i.right)) + 1), (rect.bottom - rect.top) / (Math.max(...items.map(i => i.top)) + Math.max(...items.map(i => i.bottom)) + 1));
    const bounds = (scale: number) => ({
        left: Math.min(...items.map(i => i.x * scale - i.left * labelScale - (i.worldRadius ?? 0) * scale)),
        right: Math.max(...items.map(i => i.x * scale + i.right * labelScale + (i.worldRadius ?? 0) * scale)),
        top: Math.min(...items.map(i => i.y * scale - i.top * labelScale - (i.worldRadius ?? 0) * scale)),
        bottom: Math.max(...items.map(i => i.y * scale + i.bottom * labelScale + (i.worldRadius ?? 0) * scale)),
    });
    let low = 0, high = Math.max(rect.right - rect.left, rect.bottom - rect.top);
    for (let i = 0; i < 40; i++) {
        const mid = (low + high) / 2, b = bounds(mid);
        if (b.right - b.left <= rect.right - rect.left && b.bottom - b.top <= rect.bottom - rect.top)
            low = mid;
        else
            high = mid;
    }
    const b = bounds(low);
    return { scale: low, labelScale, x: (rect.left + rect.right - b.left - b.right) / 2, y: (rect.top + rect.bottom - b.top - b.bottom) / 2 };
}
