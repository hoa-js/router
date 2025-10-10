import { pathToRegexp } from 'path-to-regexp'
import { compose } from 'hoa'

import { methods } from './methods.js'

/**
 * Hoa Router Extension
 * Adds routing helpers (get/post/...) to Hoa applications using path-to-regexp under the hood.
 *
 * Options:
 * - sensitive: RegExp case sensitivity. When false (default), add the `i` flag.
 * - end: Whether the match must reach the end of the string (default: true).
 * - delimiter: Default delimiter for segments (affects `:named` parameters, default: '/').
 * - trailing: Whether to allow an optional trailing delimiter to match (default: true).
 *
 * Returns: Extension function that augments the Hoa app with routing helpers.
 *
 * Example:
 *   app.use(router({ trailing: true }))
 *   app.get('/users/:id', async (ctx) => {
 *     ctx.res.body = { id: ctx.req.params.id }
 *   })
 *
 * @param {Object} options - Router configuration options
 * @param {boolean} [options.sensitive=false] - RegExp will be case sensitive
 * @param {boolean} [options.end=true] - Validate the match reaches the end of the string
 * @param {string} [options.delimiter='/'] - Default delimiter for segments (e.g. used for `:named` parameters)
 * @param {boolean} [options.trailing=true] - Allows optional trailing delimiter to match
 * @returns {Function} Extension function for Hoa app
 */
export function router (options = {}) {
  return function routerExtension (app) {
    methods.forEach(method => {
      app[method] = createRouteMethod(method.toUpperCase())
    })

    app.all = createRouteMethod()

    function createRouteMethod (method) {
      return function (path, ...handlers) {
        if (handlers.length === 0) {
          throw new Error(`Route ${method || 'ALL'} ${path} must have at least one handler`)
        }

        const routeMiddleware = createRoute(method, path, handlers, options)

        app.use(routeMiddleware)

        return app
      }
    }
  }
}

/**
 * Create and register a route middleware.
 * Matches the given path and method, parses params, and composes handlers.
 * GET routes also handle HEAD requests as a conventional fallback.
 *
 * @param {string} [method] - HTTP method (uppercase), undefined for all methods
 * @param {string} path - Route path pattern
 * @param {Function[]} handlers - Route handlers to execute on match
 * @param {Object} options - Path-to-regexp options
 * @returns {Function} Route middleware (ctx, next) => Promise<void> | void
 */
function createRoute (method, path, handlers, options) {
  const { regexp, keys } = pathToRegexp(path, options)

  const composed = handlers.length === 1 ? handlers[0] : compose(handlers)

  return function routeMiddleware (ctx, next) {
    if (!matches(ctx, method)) return next()

    const m = regexp.exec(ctx.req.pathname)
    if (!m) return next()

    const params = {}
    const args = m.slice(1).map(decode)
    keys.forEach((key, index) => {
      const value = args[index]
      if (value !== undefined) {
        // Assign only when there is a concrete value to avoid clobbering
        // earlier captures for duplicate key names from optional branches
        params[key.name] = value
      }
    })

    ctx.req.params = params
    ctx.req.routePath = path

    return composed(ctx, next)
  }
}

/**
 * Decode a URL parameter value.
 * Returns undefined for falsy input to preserve optional capture semantics.
 *
 * @param {string} val - Encoded value
 * @returns {string|undefined} Decoded value (or undefined if input is falsy)
 */
function decode (val) {
  if (val) return decodeURIComponent(val)
}

/**
 * Check if the request method matches the route method.
 * Also treats HEAD requests as matching GET routes.
 *
 * @param {Object} ctx - Hoa context
 * @param {string} [method] - Route method (uppercase)
 * @returns {boolean} Whether method matches
 */
function matches (ctx, method) {
  if (!method) return true // 'all' method
  if (ctx.req.method === method) return true
  if (method === 'GET' && ctx.req.method === 'HEAD') return true
  return false
}

export default router
