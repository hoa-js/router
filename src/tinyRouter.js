import { compose } from 'hoa'

import { methods } from './methods.js'

/**
 * Hoa Tiny Router Extension
 * Adds lightweight routing helpers (get/post/...) to Hoa applications using a minimal path compiler.
 *
 * Options:
 * - sensitive: RegExp case sensitivity. When false (default), add the `i` flag.
 * - trailing: Whether to allow an optional trailing slash (default: true).
 *
 * Returns: Extension function that augments the Hoa app with routing helpers.
 *
 * Example:
 *   app.use(tinyRouter({ trailing: true }))
 *   app.get('/users/:id', async (ctx) => {
 *     ctx.res.body = { id: ctx.req.params.id }
 *   })
 *
 * @param {Object} [options] Router configuration options.
 * @param {boolean} [options.sensitive=false] Whether route regexp is case-sensitive. Defaults to insensitive (adds `i` flag).
 * @param {boolean} [options.trailing=true] Whether to allow an optional trailing slash. When true, both `/path` and `/path/` match.
 * @returns {Function} Extension function that augments the Hoa app with routing helpers.
 */
export function tinyRouter (options = {}) {
  return function tinyRouterExtension (app) {
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
 * @param {string} path - Route path pattern (supports ":name" and greedy ":name+" params, wildcard "*")
 * @param {Function[]} handlers - Route handlers to execute on match
 * @param {Object} options - Compile options passed through to {@link compile}
 * @returns {Function} Route middleware (ctx, next) => Promise<void> | void
 */
function createRoute (method, path, handlers, options) {
  const regexp = compile(path, options)

  const composed = handlers.length === 1 ? handlers[0] : compose(handlers)

  return function routeMiddleware (ctx, next) {
    if (!matches(ctx, method)) return next()

    const m = regexp.exec(ctx.req.pathname)
    if (!m) return next()

    const params = {}
    if (m.groups) {
      for (const [key, value] of Object.entries(m.groups)) {
        params[key] = decode(value)
      }
    }
    ctx.req.params = params
    ctx.req.routePath = path

    return composed(ctx, next)
  }
}

/**
 * Decode a URL parameter value.
 * Returns undefined for falsy input to preserve optional capture semantics.
 *
 * @param {string} val - Encoded parameter value
 * @returns {string|undefined} Decoded value, or undefined if input is falsy
 */
function decode (val) {
  if (val) return decodeURIComponent(val)
}

/**
 * Check if the request method matches the route method.
 * Also treats HEAD requests as matching GET routes.
 *
 * @param {Object} ctx - Hoa context object containing the request
 * @param {string} [method] - Route method (uppercase); when undefined, matches all methods
 * @returns {boolean} Whether the current request method matches the route
 */
function matches (ctx, method) {
  if (!method) return true
  if (ctx.req.method === method) return true
  if (method === 'GET' && ctx.req.method === 'HEAD') return true
  return false
}

/**
 * Compile a path pattern into a RegExp.
 * The compiler supports:
 * - Stripping duplicate and trailing slashes
 * - Greedy parameters (":name+") capturing to the end of the segment
 * - Named parameters (":name") excluding segment boundary ("/" or "." if prefix contains dot)
 * - Dot escaping and wildcard ("*") segments
 * - Optional trailing slash via the `trailing` option
 * - Case-insensitive matching unless `sensitive: true`
 *
 * @param {string} path - Route path pattern
 * @param {Object} [options] - Compile options
 * @param {boolean} [options.sensitive=false] - Case sensitivity (adds `i` flag when false)
 * @param {boolean} [options.trailing=true] - Allow optional trailing slash
 * @returns {RegExp} Compiled RegExp for matching the path
 */
function compile (path, options) {
  const { sensitive = false, trailing = true } = options
  const pattern = path
    .replace(/\/+(\/|$)/g, '$1')                        // strip double & trailing splash
    .replace(/(\/?\.?):(\w+)\+/g, '($1(?<$2>*))')       // greedy params
    .replace(/(\/?\.?):(\w+)/g, '($1(?<$2>[^$1/]+?))')  // named params and image format
    .replace(/\./g, '\\.')                              // dot in path
    .replace(/(\/?)\*/g, '($1.*)?')                     // wildcard

  const patternWithTrailing = trailing ? `${pattern}(?:\\/)?` : pattern
  const flags = sensitive ? '' : 'i'
  const regexp = RegExp(`^${patternWithTrailing}$`, flags)
  return regexp
}

export default tinyRouter
