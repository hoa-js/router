// Type definitions for @hoajs/router
// Project: https://github.com/hoa-js/router
// Definitions by: nswbmw

import type { Hoa, HoaMiddleware, HoaExtension } from 'hoa'

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

export declare function router (options?: RouterOptions): HoaExtension

export default router

/**
 * Module augmentation: extend Hoa with routing methods and request params fields
 */
declare module 'hoa' {
  interface Hoa {
    options (path: string, ...handlers: HoaMiddleware[]): Hoa
    head (path: string, ...handlers: HoaMiddleware[]): Hoa
    get (path: string, ...handlers: HoaMiddleware[]): Hoa
    post (path: string, ...handlers: HoaMiddleware[]): Hoa
    put (path: string, ...handlers: HoaMiddleware[]): Hoa
    patch (path: string, ...handlers: HoaMiddleware[]): Hoa
    delete (path: string, ...handlers: HoaMiddleware[]): Hoa
    all (path: string, ...handlers: HoaMiddleware[]): Hoa
  }

  interface HoaRequest {
    /** Parsed route parameters set by @hoajs/router */
    params?: Record<string, string | undefined>
    /** Matched route pattern for the current request */
    routePath?: string
  }
}
