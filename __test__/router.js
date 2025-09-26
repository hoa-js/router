import { Hoa } from 'hoa'
import { router, methods } from '../src/router.js'

// Helper to perform a request against Hoa app
async function req (app, method, path) {
  const r = new Request('http://localhost' + path, { method: method.toUpperCase() })
  return app.fetch(r)
}

// Pick a different method to ensure method-mismatch checks
function otherMethod (method) {
  return method === 'get' ? 'post' : 'get'
}

describe('hoa router basic methods', () => {
  for (const method of methods) {
    describe(method, () => {
      test('200 when method and path match', async () => {
        const app = new Hoa()
        app.extend(router({}))
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
        app.extend(router({}))
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
        app.extend(router({}))
        app[method]('/hoa', async (ctx) => { ctx.res.body = 'hoa' })

        const res = await req(app, otherMethod(method), '/hoa')
        expect(res.status).toBe(404)
      })
    })
  }
})

describe('hoa router composed handlers on a single route', () => {
  test('handlers run in order and can set status/body', async () => {
    const app = new Hoa()
    app.extend(router())

    app.get('/hoa',
      async (ctx, next) => { ctx.state.a = 1; await next() },
      async (ctx, next) => { ctx.res.body = 'ok'; await next() },
      async (ctx, next) => { ctx.res.status = 201; await next() }
    )

    const res = await req(app, 'get', '/hoa')
    expect(res.status).toBe(201)
    expect(await res.text()).toBe('ok')
  })
})

describe('multiple route middlewares chaining', () => {
  test('each route may call next()', async () => {
    const app = new Hoa()
    app.extend(router({}))

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
    app.extend(router({}))
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
    app.extend(router({}))
    app.all('/hoa', async (ctx) => { ctx.res.body = 'ok' })

    const res = await req(app, 'get', '/hoax')
    expect(res.status).toBe(404)
  })
})

describe('route params parsing and decoding', () => {
  test('decodes encoded param value', async () => {
    const app = new Hoa()
    app.extend(router({}))

    app.get('/package/:name', async (ctx) => {
      ctx.res.body = ctx.req.params.name
    })

    const value = encodeURIComponent('http://github.com/hoa-js/hoa')
    const res = await req(app, 'get', '/package/' + value)
    expect(await res.text()).toBe('http://github.com/hoa-js/hoa')
  })

  test('optional parameter :id? can be missing', async () => {
    const app = new Hoa()
    app.extend(router({}))

    app.get('/api/:resource{/:id}', async (ctx) => {
      ctx.res.body = ctx.req.params
    })

    const res = await req(app, 'get', '/api/users')
    const resJson = await res.json()
    expect(resJson.resource).toBe('users')
    expect(resJson.id).toBeUndefined()

    const res2 = await req(app, 'get', '/api/users/1')
    const res2Json = await res2.json()
    expect(res2Json.resource).toBe('users')
    expect(res2Json.id).toBe('1')
  })

  test('/file{.:ext} optional extension segment', async () => {
    const app = new Hoa()
    app.extend(router({}))

    app.get('/file{.:ext}', async (ctx) => {
      ctx.res.body = ctx.req.params.ext
    })

    const res = await req(app, 'get', '/file')
    expect(res.status).toBe(204)
    expect(await res.text()).toBe('')

    const res2 = await req(app, 'get', '/file.txt')
    expect(res2.status).toBe(200)
    expect(await res2.text()).toBe('txt')
  })

  test('/*path wildcard captures the rest of the path', async () => {
    const app = new Hoa()
    app.extend(router({}))

    app.get('/*path', async (ctx) => {
      ctx.res.body = ctx.req.params.path
    })

    const res = await req(app, 'get', '/a')
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('a')

    const res2 = await req(app, 'get', '/a/b')
    expect(res2.status).toBe(200)
    expect(await res2.text()).toBe('a/b')
  })

  test('/files{/*path} optional wildcard tail', async () => {
    const app = new Hoa()
    app.extend(router({}))

    app.get('/files{/*path}', async (ctx) => {
      ctx.res.body = ctx.req.params.path
    })

    const res = await req(app, 'get', '/files')
    expect(res.status).toBe(204)
    expect(await res.text()).toBe('')

    const res2 = await req(app, 'get', '/files/a/b')
    expect(res2.status).toBe(200)
    expect(await res2.text()).toBe('a/b')
  })
})

describe('ctx.req.routePath is set when route matches', () => {
  test('routePath recorded', async () => {
    const app = new Hoa()
    app.extend(router({}))

    app.get('/hoa/:var', async (ctx) => {
      ctx.res.body = ctx.req.routePath
    })

    const res = await req(app, 'get', '/hoa/val')
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('/hoa/:var')
  })
})

describe('HEAD request falls back to GET handler when no HEAD defined', () => {
  test('GET route serves HEAD requests', async () => {
    const app = new Hoa()
    app.extend(router({}))

    app.get('/hoa', async (ctx) => { ctx.res.body = 'ok' })

    const res = await req(app, 'head', '/hoa')
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('')
  })
})

describe('error handling when no handlers provided', () => {
  test('throws if registering route without handler', () => {
    const app = new Hoa()
    app.extend(router({}))
    expect(() => app.get('/hoa')).toThrow(/must have at least one handler/)
  })

  test('throws for app.all without handler (covers ALL branch)', () => {
    const app = new Hoa()
    app.extend(router({}))
    expect(() => app.all('/hoa')).toThrow(/ALL \/hoa/)
  })
})

describe('router options (sensitive, end, delimiter, trailing)', () => {
  test('sensitive=true: path is case-sensitive', async () => {
    const app = new Hoa()
    app.extend(router({ sensitive: true }))

    app.get('/Hoa', async (ctx) => { ctx.res.body = 'ok' })

    const res = await req(app, 'get', '/hoa')
    expect(res.status).toBe(404)

    const res2 = await req(app, 'get', '/Hoa')
    expect(res2.status).toBe(200)
    expect(await res2.text()).toBe('ok')
  })

  test('sensitive=false: path is case-insensitive', async () => {
    const app = new Hoa()
    app.extend(router({ sensitive: false }))

    app.get('/Hoa', async (ctx) => { ctx.res.body = 'ok' })

    const res = await req(app, 'get', '/hoa')
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('ok')

    const res2 = await req(app, 'get', '/Hoa')
    expect(res2.status).toBe(200)
    expect(await res2.text()).toBe('ok')
  })

  test('end=true: requires match to reach end', async () => {
    const app = new Hoa()
    app.extend(router({ end: true }))

    app.get('/api/:resource/:id', async (ctx) => {
      ctx.res.body = `${ctx.req.params.resource}:${ctx.req.params.id}`
    })

    const res = await req(app, 'get', '/api/users/1/posts')
    expect(res.status).toBe(404)

    const res2 = await req(app, 'get', '/api/users/1')
    expect(res2.status).toBe(200)
    expect(await res2.text()).toBe('users:1')
  })

  test('end=false: does not require match to reach end', async () => {
    const app = new Hoa()
    app.extend(router({ end: false }))

    app.get('/api/:resource/:id', async (ctx) => {
      ctx.res.body = `${ctx.req.params.resource}:${ctx.req.params.id}`
    })

    const res = await req(app, 'get', '/api/users/1/posts')
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('users:1')

    const res2 = await req(app, 'get', '/api/users/1')
    expect(res2.status).toBe(200)
    expect(await res2.text()).toBe('users:1')
  })

  test('delimiter changes segment splitting', async () => {
    // Default delimiter ("/") allows dots inside a segment
    const appDefault = new Hoa()
    appDefault.extend(router({}))
    appDefault.get('/a/:b', async (ctx) => { ctx.res.body = ctx.req.params.b })

    const res = await req(appDefault, 'get', '/a/b.c')
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('b.c')

    // Custom delimiter '.' splits at dot, so '/a/b.c' no longer matches '/a/:b'
    const appDot = new Hoa()
    appDot.extend(router({ delimiter: '.' }))
    appDot.get('/a/:b', async (ctx) => { ctx.res.body = ctx.req.params.b })

    const res2 = await req(appDot, 'get', '/a/b.c')
    expect(res2.status).toBe(404)

    const res3 = await req(appDot, 'get', '/a/b')
    expect(res3.status).toBe(200)
    expect(await res3.text()).toBe('b')
  })

  test('trailing=true: optional trailing slash allowed', async () => {
    const app = new Hoa()
    app.extend(router({ trailing: true }))

    app.get('/hoa', async (ctx) => { ctx.res.body = 'ok' })

    const res = await req(app, 'get', '/hoa/')
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('ok')

    const res2 = await req(app, 'get', '/hoa')
    expect(res2.status).toBe(200)
    expect(await res2.text()).toBe('ok')
  })

  test('trailing=false: no optional trailing slash', async () => {
    const app = new Hoa()
    app.extend(router({ trailing: false }))

    app.get('/hoa', async (ctx) => { ctx.res.body = 'ok' })

    const res = await req(app, 'get', '/hoa/')
    expect(res.status).toBe(404)

    const res2 = await req(app, 'get', '/hoa')
    expect(res2.status).toBe(200)
    expect(await res2.text()).toBe('ok')
  })
})
