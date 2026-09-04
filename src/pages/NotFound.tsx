import { EmptyStatus } from '../components/EmptyStatus'
import { ProductWorkspace } from '../components/Shell'

export function NotFoundPage() {
  return <ProductWorkspace active="paths" page="not-found">
    <main className="query-chat">
      <section className="query-chat-body">
        <article className="chat-answer ux-status-region" role="alert">
          <EmptyStatus
            kind="error"
            title="页面不存在"
            body="这个地址不是产品里的页面。请从首页或路线列表进入。"
            action="回到首页"
            onAction={() => { location.hash = 'home' }}
          />
        </article>
      </section>
    </main>
  </ProductWorkspace>
}
