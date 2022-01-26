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
  configPath?: string
  env?: Record<string, any>
}

export async function loadConfig<T extends ConfigT=ConfigT> (opts: LoadConfigOptions<T>): Promise<ResolvedConfig<T>> {
  // Normalize options
  opts.cwd = resolve(process.cwd(), opts.cwd || '.')
  opts.name = opts.name || 'config'
  opts.configFile = opts.configFile ?? ((opts.name !== 'config') ? `${opts.name}.config` : 'config')
  opts.rcFile = opts.rcFile ?? (`.${opts.name}rc`)

  // Create context
  const ctx: ResolvedConfig<T> = {
    config: {} as any
  }

  // Load dotenv
  if (opts.dotenv) {
    ctx.env = await setupDotenv({
      cwd: opts.cwd,
      ...(opts.dotenv === true
        ? {}
        : opts.dotenv)
    })
  }

  // Load config file
  const { config, configPath } = await loadConfigFile(opts)
  ctx.configPath = configPath

  // Load rc files
  const configRC = {}
  if (opts.rcFile) {
    if (opts.globalRc) {
      Object.assign(configRC, rc9.readUser({ name: opts.rcFile, dir: opts.cwd }))
    }
    Object.assign(configRC, rc9.read({ name: opts.rcFile, dir: opts.cwd }))
  }

  // Combine sources
  ctx.config = defu(
    opts.overrides,
    config,
    configRC,
    opts.defaults
  ) as T

  // Return resolved context
  return ctx
}

const jiti = createJiti(null, { cache: false, interopDefault: true })

async function loadConfigFile (opts: LoadConfigOptions) {
  const res = {
    configPath: null,
    config: null
  }

  if (!opts.configFile) {
    return res
  }

  try {
    res.configPath = jiti.resolve(resolve(opts.cwd, opts.configFile), { paths: [opts.cwd] })
    res.config = jiti(res.configPath)
    if (typeof res.config === 'function') {
      res.config = await res.config()
    }
  } catch (err) {
    if (err.code !== 'MODULE_NOT_FOUND') {
      throw err
    }
  }

  return res
}
