import { existsSync } from 'fs'
import { resolve } from 'pathe'
import createJiti from 'jiti'
import * as rc9 from 'rc9'
import defu from 'defu'
import { DotenvOptions, setupDotenv } from './dotenv'

export type ConfigT = Record<string, any>

export interface LoadConfigOptions<T extends ConfigT=ConfigT> {
  cwd?: string
  name?: string
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

  // Working directory
  const cwd = resolve(process.cwd(), opts.cwd || '.')

  // Resolve config file
  const jiti = createJiti(cwd, { cache: false, interopDefault: true })
  const tryResolve = (id: string) => {
    try { return jiti.resolve(id) } catch (err) {
      if (err.code !== 'MODULE_NOT_FOUND') {
        throw err
      }
      return null
    }
  }
  const configFile = opts.configFile && tryResolve(resolve(cwd, opts.configFile))

  // Load dotenv
  let env
  if (opts.dotenv) {
    env = await setupDotenv({ cwd, ...(opts.dotenv === true ? {} : opts.dotenv) })
  }

  // Initialize with empty object
  let config: any = {}

  // Load config file
  if (configFile && existsSync(configFile)) {
    config = jiti(configFile)
    if (typeof config === 'function') {
      config = await config(opts)
    }
  }

  // Combine sources
  config = defu(
    opts.overrides,
    config,
    opts.rcFile ? rc9.read({ name: opts.rcFile, dir: cwd }) : {},
    (opts.rcFile && opts.globalRc !== false) ? rc9.readUser(opts.rcFile) : {},
    opts.defaults
  )

  // Return context
  return {
    config,
    meta: {
      cwd,
      env,
      configFile
    }
  }
}
