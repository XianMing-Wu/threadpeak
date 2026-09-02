import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import {
  clearCookie,
  OAUTH_STATE_COOKIE,
  SESSION_COOKIE,
  serializeCookie,
  type OauthService,
} from './oauth.ts'

function cookieHeader(request: FastifyRequest): string | undefined {
  const header = request.headers.cookie
  return Array.isArray(header) ? header.join('; ') : header
}

function queryText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function appendCookies(reply: FastifyReply, values: readonly string[]) {
  reply.header('Set-Cookie', values.length === 1 ? values[0] : [...values])
}

export function registerAuthRoutes(app: FastifyInstance, oauth: OauthService) {
  app.get('/api/auth/zhihu/start', async (_request, reply) => {
    const started = oauth.start()
    if (started.kind === 'unavailable') {
      return reply.code(503).type('application/json; charset=utf-8').send({
        kind: 'unavailable',
        title: started.title,
        message: started.message,
      })
    }
    appendCookies(reply, [serializeCookie(OAUTH_STATE_COOKIE, started.state, started.stateMaxAge)])
    return reply.code(200).type('application/json; charset=utf-8').send({
      kind: 'redirect',
      authorizeUrl: started.authorizeUrl,
    })
  })

  app.get('/api/auth/zhihu/callback', async (request, reply) => {
    const query = request.query as Record<string, unknown>
    const result = await oauth.callback({
      authorizationCode: queryText(query.authorization_code) || queryText(query.code),
      state: queryText(query.state),
      cookieHeader: cookieHeader(request),
    })
    if (result.kind !== 'authenticated') {
      appendCookies(reply, [clearCookie(OAUTH_STATE_COOKIE)])
      return reply.redirect(oauth.failureRedirect())
    }
    appendCookies(reply, [
      serializeCookie(SESSION_COOKIE, result.session.id, result.sessionMaxAge),
      clearCookie(OAUTH_STATE_COOKIE),
    ])
    return reply.redirect(oauth.successRedirect())
  })

  app.get('/api/auth/session', async (request, reply) => {
    const session = oauth.sessionFromCookie(cookieHeader(request))
    return reply.code(200).type('application/json; charset=utf-8').send(session)
  })

  app.post('/api/auth/logout', async (request, reply) => {
    oauth.logout(cookieHeader(request))
    appendCookies(reply, [clearCookie(SESSION_COOKIE), clearCookie(OAUTH_STATE_COOKIE)])
    return reply.code(200).type('application/json; charset=utf-8').send({ kind: 'anonymous' })
  })
}
