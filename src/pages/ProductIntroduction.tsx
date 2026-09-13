import './product-introduction.css'

/** A separate document keeps the cinematic canvas and the workspace CSS isolated. */
export function ProductIntroduction() {
  return <main className="product-introduction"><iframe
    title="问山产品介绍"
    src={`${import.meta.env.BASE_URL}introduction.html`}
    allow="autoplay"
  /></main>
}
