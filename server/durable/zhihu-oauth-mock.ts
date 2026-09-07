import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { CommandError } from './store.ts'

/** Explicitly authorized local demo: never an upstream-error fallback. */
export const MOCK_ZHIHU_ORIGIN = 'https://zhihu-demo.invalid'
export const MOCK_ZHIHU_OWNER_PREFIX = 'account:zhihu:mock:'
export const isMockZhihuOwner = (owner: string) => owner.startsWith(MOCK_ZHIHU_OWNER_PREFIX)
export function isMockZhihuUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try { const url = new URL(value); return url.origin === MOCK_ZHIHU_ORIGIN && !url.username && !url.password } catch { return false }
}

/** Local key survives worker/server restarts; no app key or .env secret is invented. */
export function readOrCreateMockSecret(directory: string): string {
  mkdirSync(directory, { recursive: true, mode: 0o700 })
  const file = join(directory, 'zhihu-oauth-demo.key')
  try { writeFileSync(file, randomBytes(32).toString('hex'), { flag: 'wx', mode: 0o600 }) }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error }
  const value = readFileSync(file, 'utf8').trim()
  if (!/^[a-f0-9]{64}$/.test(value)) throw new Error('OAUTH_MOCK_KEY_INVALID')
  return value
}

type Signed = { kind: 'code' | 'access'; subject: string; expires: number; state?: string }
type Query = Record<string, string | number | undefined>
type ContentType = 'answer' | 'article' | 'zvideo' | 'pin' | 'question'
type Content = { ContentType: ContentType; Url: string; CreatedAt: number; LikeCount: number; CommentCount: number; FavoriteCount: number; Title: string; Summary: string }
type Folder = { UrlToken: number; Url: string; Title: string; Description: string; IsPublic: boolean }
type Author = { Name: string; UrlToken: string; Url: string; Gender: number; Headline: string }
type Collection = Content & { FavTime: number; Favlists: Pick<Folder, 'UrlToken' | 'Title' | 'Url'>[]; Author?: Author }
type Envelope = { Code: number; Message: string; Data?: Record<string, unknown> }
const fail = (Code: number, Message: string): Envelope => ({ Code, Message })
const success = (Data: Record<string, unknown>): Envelope => ({ Code: 0, Message: 'success', Data })

export class ZhihuOAuthMock {
  readonly secret: string
  readonly now: () => number
  constructor(secret: string, production = false, now: () => number = Date.now) {
    if (production || process.env.NODE_ENV === 'production') throw new Error('OAUTH_MOCK_FORBIDDEN_IN_PRODUCTION')
    if (secret.length < 32) throw new Error('OAUTH_MOCK_KEY_INVALID')
    this.secret = secret; this.now = now
  }
  private sign(value: Signed) {
    const body = Buffer.from(JSON.stringify(value)).toString('base64url')
    return `tp-demo.${body}.${createHmac('sha256', this.secret).update(body).digest('base64url')}`
  }
  private read(token: string, kind: Signed['kind'], allowExpired = false): Signed {
    try {
      const [prefix, body, signature, extra] = token.split('.')
      if (prefix !== 'tp-demo' || !body || !signature || extra) throw new Error()
      const expected = createHmac('sha256', this.secret).update(body).digest(), actual = Buffer.from(signature, 'base64url')
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error()
      const value = JSON.parse(Buffer.from(body, 'base64url').toString()) as Signed
      if (value.kind !== kind || !/^[a-f0-9]{32}$/.test(value.subject) || !Number.isFinite(value.expires) || !allowExpired && value.expires <= this.now()) throw new Error()
      return value
    } catch { throw new CommandError('ZHIHU_REAUTHORIZE', 401) }
  }
  authorize(state: string, existingSubject?: string) {
    if (existingSubject !== undefined && !/^[a-f0-9]{32}$/.test(existingSubject)) throw new CommandError('ZHIHU_REAUTHORIZE', 401)
    return this.sign({ kind: 'code', subject: existingSubject ?? randomBytes(16).toString('hex'), state, expires: this.now() + 600_000 })
  }
  /** Only for a token loaded from the resolved owner's encrypted DB account, never a browser token. */
  subjectForRenewal(storedToken: string) { return this.read(storedToken, 'access', true).subject }
  exchange(code: string, state: string) {
    const value = this.read(code, 'code')
    if (value.state !== state) throw new CommandError('OAUTH_STATE_INVALID', 400)
    return { access_token: this.sign({ kind: 'access', subject: value.subject, expires: this.now() + 3600_000 }), token_type: 'Bearer', expires_in: 3600 }
  }
  profile(token: string) {
    const value = this.read(token, 'access')
    return { id: value.subject, name: `演示用户 · ${value.subject.slice(0, 4)}`, avatar: null, demo: true }
  }
  private dataset(subject: string) {
    // A different authorized demo account has different IDs, including shared-author relations.
    const base = Number.parseInt(subject.slice(0, 9), 16) * 1000
    const folderNames = ['线性代数：从直觉到计算', '机器学习基础', '阅读与学习方法', '尚未整理的收藏']
    const folders: Folder[] = folderNames.map((name, index) => ({ UrlToken: base + index + 1, Url: `${MOCK_ZHIHU_ORIGIN}/collection/${base + index + 1}`, Title: `【演示】${name}`, Description: '用于体验收藏夹学习流程的示例数据，并非真实知乎账号内容。', IsPublic: true }))
    const authors: Author[] = ['林小数', '陈知行', '林小数', '许慢读'].map((name, index) => {
      const token = `threadpeak-demo-${subject}-author-${index + 1}`
      return { Name: `【演示作者】${name}`, UrlToken: token, Url: `${MOCK_ZHIHU_ORIGIN}/people/${token}`, Gender: 0, Headline: '演示身份，不代表真实博主或咨询服务。' }
    })
    const definitions: [string, string, ContentType, number | null, number[]][] = [
      ['用二维图像理解向量与基', '基是一组用于描述向量的独立方向。固定向量在不同基下可以有不同坐标；可从二维标准基和斜基分别计算来理解。', 'article', 0, [0, 1]],
      ['矩阵乘法与线性映射', '矩阵的列记录基向量变换后的坐标。两个矩阵相乘对应两个线性映射依次作用，计算顺序需要与映射顺序对应。', 'answer', 0, [0]],
      ['为什么换基会改变矩阵？', '同一映射换用新基后表示矩阵会改变，但映射本身不变。可以先转回旧基，执行映射，再换回新基验证。', 'answer', 1, [0, 1]],
      ['特征向量有什么直观意义', '特征向量在变换后仍沿原方向，特征值描述伸缩比例。通过二维拉伸和旋转对比，可以理解并非每个实矩阵都有实特征向量。', 'article', 2, [0, 1]],
      ['线性回归中的最小二乘', '线性回归用特征组合预测目标，最小二乘使预测残差平方和最小。矩阵写法将多个样本与多个特征统一表达。', 'article', 1, [1]],
      ['从梯度理解模型训练', '梯度指出函数增长最快的局部方向，沿负梯度更新参数可尝试降低损失。学习率影响更新幅度和稳定性。', 'zvideo', 2, [1]],
      ['如何把收藏文章变成学习路线', '先按目标整理概念，再识别先后依赖，为每一阶段设置一个可以完成的练习。收藏只表示兴趣，不能说明已经掌握。', 'article', 3, [1, 2]],
      ['读完以后怎样检验理解', '尝试用自己的话解释、独立完成例题并记录仍未理解的问题。复述、应用与反馈能让阅读内容逐步转化为可用知识。', 'answer', 3, [2]],
      ['给未来自己的复习提醒', '复习时先回忆再查阅资料，将错误原因连接到对应概念。此条演示想法类型。', 'pin', null, [2]],
      ['怎样安排每周学习与练习', '这是用于体验问题类收藏的示例摘要：明确每周时间，给阅读和练习分别留出空间。', 'question', 0, [2]],
    ]
    const collections: Collection[] = definitions.map(([title, summary, type, author, members], index) => {
      const id = base + 100 + index, folderLinks = members.map(i => { const { UrlToken, Title, Url } = folders[i]!; return { UrlToken, Title, Url } })
      return { ContentType: type, Url: `${MOCK_ZHIHU_ORIGIN}/${type}/${id}`, CreatedAt: 1745486539 + index * 86400, LikeCount: (index + 1) * 17, CommentCount: index + 1, FavoriteCount: index * 3, Title: `【演示内容】${title}`, Summary: `【示例资料，非真实知乎内容】${summary}`, FavTime: 1750000000 + index * 3600, Favlists: folderLinks, ...(author === null ? {} : { Author: authors[author] }) }
    })
    const contents: Content[] = collections.slice(0, 6).map(({ FavTime: _time, Favlists: _folders, Author: _author, ...item }) => ({ ...item, Title: item.Title.replace('演示内容', '演示账号创作') }))
    return { folders, collections, contents }
  }
  /** Exact official envelope/field names. No custom author field on user contents. */
  user(path: string, token: string, query: Query): Envelope {
    let subject: string
    try { subject = this.read(token, 'access').subject } catch { return fail(20001, 'authentication failed') }
    const allowed = ['favlists', 'favlist_contents', 'collections', 'contents']
    if (!allowed.includes(path)) return fail(10001, 'unsupported user endpoint')
    const integer = (value: unknown, fallback: number) => value === undefined ? fallback : /^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) ? Number(value) : -1
    const offset = integer(query.Offset, 0), requested = integer(query.Limit, 20)
    if (offset < 0 || requested < 1) return fail(10001, 'invalid pagination')
    const limit = path === 'contents' ? Math.min(requested, 50) : requested
    const { folders, collections, contents } = this.dataset(subject)
    if (path === 'favlists') return success({ Items: folders.slice(0, limit) })
    if (path === 'collections') return success({ Items: [...collections].sort((a, b) => b.FavTime - a.FavTime).slice(0, limit) })
    let items: Content[]
    if (path === 'favlist_contents') {
      const folderId = integer(query.FavlistUrlToken, -1)
      if (!folders.some(folder => folder.UrlToken === folderId)) return fail(10001, 'unknown folder')
      items = collections.filter(item => item.Favlists.some(folder => folder.UrlToken === folderId)).sort((a, b) => b.FavTime - a.FavTime)
    } else {
      if (!['all', 'answer', 'article', 'zvideo', 'pin', 'question'].includes(String(query.ContentType))) return fail(10001, 'invalid content type')
      const sort = query.SortField ?? 'ts', order = query.SortOrder ?? 'desc'
      if (!['like_count', 'ts'].includes(String(sort)) || !['asc', 'desc'].includes(String(order))) return fail(10001, 'invalid sort')
      items = contents.filter(item => query.ContentType === 'all' || item.ContentType === query.ContentType).sort((a, b) => (order === 'asc' ? 1 : -1) * (sort === 'like_count' ? a.LikeCount - b.LikeCount : a.CreatedAt - b.CreatedAt))
    }
    const end = offset + limit >= items.length
    return success({ Items: items.slice(offset, offset + limit), Paging: { IsEnd: end, ...(!end ? { NextOffset: String(offset + limit) } : {}), Totals: items.length } })
  }
}
