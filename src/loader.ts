import { existsSync } from 'fs'
import { resolve } from 'pathe'
import createJiti from 'jiti'
import * as rc9 from 'rc9'
import defu from 'defu'
import { DotenvOptions, setupDotenv } from './dotenv'

export type ConfigT = Record<string, any>

export interface LoadConfigOptions<T extends ConfigT=ConfigT> {
  name?: string
  cwd?: string

  configFile?: false | string

  rcFile?: false | string
  globalRc?: boolean

  dotenv?: boolean | DotenvOptions

  defaults?: T
  overrides?: T
}

export interface ResolvedConfig<T extends ConfigT=ConfigT> {
  config: T
  meta: {
    cwd: string,
    configFile?: string
    env?: Record<string, any>
  }
}

export async function loadConfig<T extends ConfigT=ConfigT> (opts: LoadConfigOptions<T>): Promise<ResolvedConfig<T>> {
  // Normalize options
  opts.name = opts.name || 'config'
  opts.configFile = opts.configFile ?? ((opts.name !== 'config') ? `${opts.name}.config` : 'config')
  opts.rcFile = opts.rcFile ?? (`.${opts.name}rc`)

  // Create context
  const ctx: ResolvedConfig<T> = {
    config: {} as any,
    meta: {
      cwd: resolve(process.cwd(), opts.cwd || '.'),
      configFile: null,
      env: {}
    }
  }

  // Resolve config file
  const jiti = createJiti(ctx.meta.cwd, { cache: false, interopDefault: true })
  const tryResolve = (id: string) => {
    try { return jiti.resolve(id) } catch (err) {
      if (err.code !== 'MODULE_NOT_FOUND') {
        throw err
      }
      return null
    }
  }
  ctx.meta.configFile = opts.configFile && tryResolve(resolve(ctx.meta.cwd, opts.configFile))

  // Load dotenv
  if (opts.dotenv) {
    ctx.meta.env = await setupDotenv({
      cwd: ctx.meta.cwd,
      ...(opts.dotenv === true
        ? {}
        : opts.dotenv)
    })
  }

  // Initialize with empty object
  let config: any = {}

  // Load config file
  if (ctx.meta.configFile && existsSync(ctx.meta.configFile)) {
    config = jiti(ctx.meta.configFile)
    if (typeof config === 'function') {
      config = await config(opts)
    }
  }

  // Combine sources
  config = defu(
    opts.overrides,
    config,
    opts.rcFile ? rc9.read({ name: opts.rcFile, dir: ctx.meta.cwd }) : {},
    (opts.rcFile && opts.globalRc !== false) ? rc9.readUser(opts.rcFile) : {},
    opts.defaults
  )

  // Return resolved context
  return ctx
}
