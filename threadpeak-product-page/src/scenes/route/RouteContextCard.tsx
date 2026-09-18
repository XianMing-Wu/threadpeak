/** Markup matches the Path3D contextual card in src/vendor/learning-path-3d. */
export function RouteContextCard() {
    return <aside className="lp-context-card" hidden data-placed="false" role="dialog" aria-modal="false" aria-live="polite">
  <span className="lp-context-card__arrow-depth" aria-hidden="true"/>
  <span className="lp-context-card__arrow-face" aria-hidden="true"/>
  <section className="lp-context-card__panel">
   <header className="lp-context-card__header">
    <div className="lp-context-card__heading">
     <p className="lp-context-card__eyebrow"/>
     <h2 className="lp-context-card__title"/>
    </div>
   </header>
   <p className="lp-context-card__description"/>
   <div className="lp-context-card__actions">
    <button className="lp-context-card__button" data-slot="primary" type="button"/>
   </div>
  </section>
 </aside>;
}
