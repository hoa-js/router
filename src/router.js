import { pathToRegexp } from 'path-to-regexp'
import { compose } from 'hoa'

const methods = ['options', 'head', 'get', 'post', 'put', 'patch', 'delete']

/**
 * Hoa Router Extension
 * Adds routing capabilities to Hoa applications using path-to-regexp
 *
 * @param {Object} options - Router configuration options
 * @param {boolean} [options.sensitive=false] - Regexp will be case sensitive
 * @param {boolean} [options.end=true] - Validate the match reaches the end of the string
 * @param {string} [options.delimiter='/'] - Default delimiter for segments (e.g. used for `:named` parameters)
 * @param {boolean} [options.trailing=true] - Allows optional trailing delimiter to match
 * @returns {Function} Extension function for Hoa app
 */
export function hoaRouter (options = {}) {
  return function hoaRouterExtension (app) {
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
 * Create a route middleware function
 * @param {string} [method] - HTTP method (uppercase), undefined for all methods
 * @param {string} path - Route path pattern
 * @param {Function[]} handlers - Route handlers
 * @param {Object} options - Path-to-regexp options
 * @returns {Function} Route middleware
 */
function createRoute (method, path, handlers, options) {
  const { regexp, keys } = pathToRegexp(path, options)

  const composedHandler = handlers.length === 1 ? handlers[0] : compose(handlers)

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

    return composedHandler(ctx, next)
  }
}

/**
 * Decode URL parameter value
 * @param {string} val - Encoded value
 * @returns {string} Decoded value
 */
function decode (val) {
  if (val) return decodeURIComponent(val)
}

/**
 * Check if request method matches route method
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

export default hoaRouter
export { hoaRouter as router, methods }
