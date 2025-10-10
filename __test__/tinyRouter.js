import { Hoa } from 'hoa'
import { tinyRouter, methods } from '../src/index.js'

// Helper to perform a request against Hoa app
async function req (app, method, path) {
  const r = new Request('http://localhost' + path, { method: method.toUpperCase() })
  return app.fetch(r)
}

// Pick a different method to ensure method-mismatch checks
function otherMethod (method) {
  return method === 'get' ? 'post' : 'get'
}

describe('hoa tinyRouter basic methods', () => {
  for (const method of methods) {
    describe(method, () => {
      test('200 when method and path match', async () => {
        const app = new Hoa()
        app.extend(tinyRouter({}))
        app[method]('/hoa', async (ctx, next) => {
          ctx.res.body = method === 'head' ? undefined : 'hoa'
          await next()
        })

        const res = await req(app, method, '/hoa')
        if (method === 'head') {
          expect(res.status).toBe(204)
          expect(await res.text()).toBe('')
        } else {
          expect(res.status).toBe(200)
          expect(await res.text()).toBe('hoa')
        }
      })

      test('404 when only method matches (path mismatch)', async () => {
        const app = new Hoa()
        app.extend(tinyRouter({}))
        app[method]('/hoa', async (ctx) => { ctx.res.body = 'hoa' })

        const res = await req(app, method, '/hoax')
        // In Hoa, HEAD requests without matching routes return 200 by default
        if (method === 'head') {
          expect(res.status).toBe(200)
        } else {
          expect(res.status).toBe(404)
        }
      })

      test('404 when only path matches (method mismatch)', async () => {
        const app = new Hoa()
        app.extend(tinyRouter({}))
        app[method]('/hoa', async (ctx) => { ctx.res.body = 'hoa' })

        const res = await req(app, otherMethod(method), '/hoa')
        expect(res.status).toBe(404)
      })
    })
  }
})

describe('middleware composition and chaining', () => {
  test('multiple handlers on single route run in order', async () => {
    const app = new Hoa()
    app.extend(tinyRouter())

    app.get('/hoa',
      async (ctx, next) => { ctx.state.a = 1; await next() },
      async (ctx, next) => { ctx.res.body = 'ok'; await next() },
      async (ctx, next) => { ctx.res.status = 201; await next() }
    )

    const res = await req(app, 'get', '/hoa')
    expect(res.status).toBe(201)
    expect(await res.text()).toBe('ok')
  })

  test('multiple routes can chain via next()', async () => {
    const app = new Hoa()
    app.extend(tinyRouter({}))

    app
      .get('/hoa', async (ctx, next) => { await next() })
      .get('/hoa', async (ctx, next) => { ctx.res.body = 'hoa' })
      .get('/hoa', async (ctx, next) => { ctx.res.status = 202; await next() })

    const res = await req(app, 'get', '/hoa')
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('hoa')
  })
})

describe('route.all()', () => {
  test('works for all methods', async () => {
    const app = new Hoa()
    app.extend(tinyRouter({}))
    app.all('/hoa', async (ctx) => { ctx.res.body = 'x' })

    for (const m of methods) {
      const res = await req(app, m, '/hoa')
      expect(res.status).toBe(200)

      if (m === 'head') {
        expect(await res.text()).toBe('')
      } else {
        expect(await res.text()).toBe('x')
      }
    }
  })

  test('404 when path does not match', async () => {
    const app = new Hoa()
    app.extend(tinyRouter({}))
    app.all('/hoa', async (ctx) => { ctx.res.body = 'ok' })

    const res = await req(app, 'get', '/hoax')
    expect(res.status).toBe(404)
  })
})

describe('request context enrichment', () => {
  test('ctx.req.routePath records matched route pattern', async () => {
    const app = new Hoa()
    app.extend(tinyRouter({}))

    app.get('/hoa/:var', async (ctx) => {
      ctx.res.body = ctx.req.routePath
    })

    const res = await req(app, 'get', '/hoa/val')
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('/hoa/:var')
  })

  test('HEAD requests fall back to GET handlers', async () => {
    const app = new Hoa()
    app.extend(tinyRouter({}))

    app.get('/hoa', async (ctx) => { ctx.res.body = 'ok' })

    const res = await req(app, 'head', '/hoa')
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('')
  })
})

describe('tinyRouter options (sensitive, trailing)', () => {
  test('sensitive=true: path is case-sensitive', async () => {
    const app = new Hoa()
    app.extend(tinyRouter({ sensitive: true }))

    app.get('/Hoa', async (ctx) => { ctx.res.body = 'ok' })

    const res = await req(app, 'get', '/hoa')
    expect(res.status).toBe(404)

    const res2 = await req(app, 'get', '/Hoa')
    expect(res2.status).toBe(200)
    expect(await res2.text()).toBe('ok')
  })

  test('sensitive=false: path is case-insensitive', async () => {
    const app = new Hoa()
    app.extend(tinyRouter({ sensitive: false }))

    app.get('/Hoa', async (ctx) => { ctx.res.body = 'ok' })

    const res = await req(app, 'get', '/hoa')
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('ok')

    const res2 = await req(app, 'get', '/Hoa')
    expect(res2.status).toBe(200)
    expect(await res2.text()).toBe('ok')
  })

  test('trailing=true: optional trailing slash matches', async () => {
    const app = new Hoa()
    app.extend(tinyRouter({ trailing: true }))

    app.get('/users', async (ctx) => { ctx.res.body = 'ok' })

    const res = await req(app, 'get', '/users')
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('ok')

    const res2 = await req(app, 'get', '/users/')
    expect(res2.status).toBe(200)
    expect(await res2.text()).toBe('ok')
  })

  test('trailing=false: trailing slash does not match', async () => {
    const app = new Hoa()
    app.extend(tinyRouter({ trailing: false }))

    app.get('/users', async (ctx) => { ctx.res.body = 'ok' })

    const res = await req(app, 'get', '/users/')
    expect(res.status).toBe(404)

    const res2 = await req(app, 'get', '/users')
    expect(res2.status).toBe(200)
    expect(await res2.text()).toBe('ok')
  })
})

describe('wildcard matching (no params)', () => {
  test('anonymous * wildcard matches remaining path', async () => {
    const app = new Hoa()
    app.extend(tinyRouter({}))

    app.get('/files/*', async (ctx) => { ctx.res.body = 'ok' })

    const res = await req(app, 'get', '/files/a/b')
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('ok')

    const res2 = await req(app, 'get', '/files')
    expect(res2.status).toBe(200)
    expect(await res2.text()).toBe('ok')
  })
})

describe('route parameters', () => {
  test('greedy params (:name+) capture remaining path', async () => {
    const app = new Hoa()
    app.extend(tinyRouter({}))

    app.get('/docs/:path+', async (ctx) => {
      ctx.res.body = ctx.req.params?.path
    })

    const res = await req(app, 'get', '/docs/a/b/c')
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('a/b/c')
  })

  test('URL-encoded params are decoded', async () => {
    const app = new Hoa()
    app.extend(tinyRouter({}))

    app.get('/package/:name', async (ctx) => {
      ctx.res.body = ctx.req.params.name
    })

    const value = encodeURIComponent('http://github.com/hoa-js/hoa')
    const res = await req(app, 'get', '/package/' + value)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('http://github.com/hoa-js/hoa')
  })

  test('empty greedy param with trailing slash returns undefined', async () => {
    const app = new Hoa()
    app.extend(tinyRouter({ trailing: true }))

    app.get('/docs/:path+', async (ctx) => {
      const val = ctx.req.params?.path
      ctx.res.body = String(val === undefined)
    })

    const res = await req(app, 'get', '/docs/')
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('true')
  })
})

describe('error handling', () => {
  test('throws when registering route without handler', () => {
    const app = new Hoa()
    app.extend(tinyRouter({}))
    expect(() => app.get('/hoa')).toThrow(/must have at least one handler/)
    expect(() => app.all('/hoa')).toThrow(/ALL \/hoa/)
  })
})
