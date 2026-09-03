import { ProductWorkspace } from '../components/Shell'

export function NotFoundPage() {
  return <ProductWorkspace active="paths" page="not-found">
    <main className="query-chat">
      <section className="query-chat-body">
        <article className="chat-answer" role="alert">
          <h2>页面不存在</h2>
          <p>这个地址不是产品里的页面。请从首页或路线列表进入。</p>
          <button type="button" onClick={() => { location.hash = 'home' }}>回到首页</button>
        </article>
      </section>
    </main>
  </ProductWorkspace>
}
