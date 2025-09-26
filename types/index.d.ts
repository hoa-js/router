// Type definitions for @hoajs/router
// Project: https://github.com/hoa-js/router
// Definitions by: nswbmw

import type { Hoa, HoaContext, HoaRequest } from 'hoa'

export type Method = 'options' | 'head' | 'get' | 'post' | 'put' | 'patch' | 'delete'

export const methods: readonly Method[]

export interface RouterOptions {
  /** Regexp will be case sensitive (default: false) */
  sensitive?: boolean
  /** Validate the match reaches the end of the string (default: true) */
  end?: boolean
  /** Default delimiter for segments (default: '/') */
  delimiter?: string
  /** Allows optional trailing delimiter to match (default: true) */
  trailing?: boolean
}

export type Middleware = (ctx: HoaContext, next: () => Promise<void>) => Promise<any> | any

/**
 * Hoa Router Extension
 * Adds routing capabilities to Hoa applications using path-to-regexp
 */
export declare function hoaRouter (options?: RouterOptions): (app: Hoa) => void

declare const _default: typeof hoaRouter
export default _default
export { hoaRouter as router }

/**
 * Module augmentation: extend Hoa with routing methods and request params fields
 */
declare module 'hoa' {
  interface Hoa {
    options (path: string, ...handlers: Middleware[]): Hoa
    head (path: string, ...handlers: Middleware[]): Hoa
    get (path: string, ...handlers: Middleware[]): Hoa
    post (path: string, ...handlers: Middleware[]): Hoa
    put (path: string, ...handlers: Middleware[]): Hoa
    patch (path: string, ...handlers: Middleware[]): Hoa
    delete (path: string, ...handlers: Middleware[]): Hoa
    all (path: string, ...handlers: Middleware[]): Hoa
  }

  interface HoaRequest {
    /** Parsed route parameters set by @hoajs/router */
    params?: Record<string, string | undefined>
    /** Matched route pattern for the current request */
    routePath?: string
  }
}
