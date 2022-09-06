import { existsSync, promises as fsp } from 'fs'
import os from 'os'
import { resolve, extname, dirname } from 'pathe'
import createJiti, { JITI } from 'jiti'
import * as rc9 from 'rc9'
import { defu } from 'defu'
import { findWorkspaceDir } from 'pkg-types'
import type { JITIOptions } from 'jiti/dist/types'
import { DotenvOptions, setupDotenv } from './dotenv'

export interface InputConfig extends Record<string, any> {}

export interface ConfigLayer<T extends InputConfig=InputConfig> {
  config: T | null
  cwd?: string
  configFile?: string
}

export interface ResolvedConfig<T extends InputConfig=InputConfig> extends ConfigLayer<T> {
  layers?: ConfigLayer<T>[]
  cwd?: string
}

export interface ResolveConfigOptions {
  cwd: string
}

export interface LoadConfigOptions<T extends InputConfig=InputConfig> {
  name?: string
  cwd?: string

  configFile?: string

  rcFile?: false | string
  globalRc?: boolean

  dotenv?: boolean | DotenvOptions

  defaults?: T
  overrides?: T

  resolve?: (id: string, opts: LoadConfigOptions) => null | ResolvedConfig | Promise<ResolvedConfig | null>

  jiti?: JITI
  jitiOptions?: JITIOptions,

  extend?: false | {
    extendKey?: string | string[]
  }
}

export async function loadConfig<T extends InputConfig=InputConfig> (opts: LoadConfigOptions<T>): Promise<ResolvedConfig<T>> {
  // Normalize options
  opts.cwd = resolve(process.cwd(), opts.cwd || '.')
  opts.name = opts.name || 'config'
  opts.configFile = opts.configFile ?? ((opts.name !== 'config') ? `${opts.name}.config` : 'config')
  opts.rcFile = opts.rcFile ?? (`.${opts.name}rc`)
  if (opts.extend !== false) {
    opts.extend = {
      extendKey: 'extends',
      ...opts.extend
    }
  }

  // Create jiti instance
  opts.jiti = opts.jiti || createJiti(null, {
    interopDefault: true,
    requireCache: false,
    esmResolve: true,
    ...opts.jitiOptions
  })

  // Create context
  const r: ResolvedConfig<T> = {
    config: {} as any,
    cwd: opts.cwd,
    configFile: resolve(opts.cwd, opts.configFile),
    layers: []
  }

  // Load dotenv
  if (opts.dotenv) {
    await setupDotenv({
      cwd: opts.cwd,
      ...(opts.dotenv === true ? {} : opts.dotenv)
    })
  }

  // Load config file
  const { config, configFile } = await resolveConfig('.', opts)
  if (configFile) {
    r.configFile = configFile
  }

  // Load rc files
  const configRC = {}
  if (opts.rcFile) {
    if (opts.globalRc) {
      Object.assign(configRC, rc9.readUser({ name: opts.rcFile, dir: opts.cwd }))
      const workspaceDir = await findWorkspaceDir(opts.cwd).catch(() => null)
      if (workspaceDir) {
        Object.assign(configRC, rc9.read({ name: opts.rcFile, dir: workspaceDir }))
      }
    }
    Object.assign(configRC, rc9.read({ name: opts.rcFile, dir: opts.cwd }))
  }

  // Combine sources
  r.config = defu(
    opts.overrides,
    config,
    configRC
  ) as T

  // Allow extending
  if (opts.extend) {
    await extendConfig(r.config, opts)
    r.layers = r.config._layers
    delete r.config._layers
    r.config = defu(
      r.config,
      ...r.layers.map(e => e.config)
    ) as T
  }

  // Preserve unmerged sources as layers
  const baseLayers = [
    opts.overrides && { config: opts.overrides, configFile: undefined, cwd: undefined },
    { config, configFile: opts.configFile, cwd: opts.cwd },
    opts.rcFile && { config: configRC, configFile: opts.rcFile }
  ].filter(l => l && l.config) as ConfigLayer<T>[]
  r.layers = [
    ...baseLayers,
    ...r.layers
  ]

  // Apply defaults
  if (opts.defaults) {
    r.config = defu(r.config, opts.defaults) as T
  }

  // Return resolved config
  return r
}

async function extendConfig (config, opts: LoadConfigOptions) {
  config._layers = config._layers || []
  if (!opts.extend) { return }
  let keys = opts.extend.extendKey
  if (typeof keys === 'string') { keys = [keys] }
  const extendSources = []
  for (const key of keys) {
    extendSources.push(...(Array.isArray(config[key]) ? config[key] : [config[key]]).filter(Boolean))
    delete config[key]
  }
  for (const extendSource of extendSources) {
    if (typeof extendSource !== 'string') {
      // TODO: Use error in next major versions
      // eslint-disable-next-line no-console
      console.warn(`Cannot extend config from \`${JSON.stringify(extendSource)}\` (which should be a string) in ${opts.cwd}`)
      continue
    }
    const _config = await resolveConfig(extendSource, opts)
    if (!_config.config) {
      // TODO: Use error in next major versions
      // eslint-disable-next-line no-console
      console.warn(`Cannot extend config from \`${extendSource}\` in ${opts.cwd}`)
      continue
    }
    await extendConfig(_config.config, { ...opts, cwd: _config.cwd })
    config._layers.push(_config)
    if (_config.config._layers) {
      config._layers.push(..._config.config._layers)
      delete _config.config._layers
    }
  }
}

const GIT_PREFIXES = ['github:', 'gitlab:', 'bitbucket:', 'https://']

// https://github.com/dword-design/package-name-regex
const NPM_PACKAGE_RE = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/

async function resolveConfig (source: string, opts: LoadConfigOptions): Promise<ResolvedConfig> {
  // Custom user resolver
  if (opts.resolve) {
    const res = await opts.resolve(source, opts)
    if (res) {
      return res
    }
  }

  // Download git URLs and resolve to local path
  if (GIT_PREFIXES.some(prefix => source.startsWith(prefix))) {
    const url = new URL(source)
    const subPath = url.pathname.split('/').slice(2).join('/')
    const gitRepo = url.protocol + url.pathname.split('/').slice(0, 2).join('/')
    const tmpdir = resolve(os.tmpdir(), 'c12/', gitRepo.replace(/[#:@/\\]/g, '_'))
    await fsp.rm(tmpdir, { recursive: true }).catch(() => {})
    const gittar = await import('gittar').then(r => r.default || r)
    const tarFile = await gittar.fetch(gitRepo)
    await gittar.extract(tarFile, tmpdir)
    source = resolve(tmpdir, subPath)
  }

  // Try resolving as npm package
  if (NPM_PACKAGE_RE.test(source)) {
    try {
      source = opts.jiti.resolve(source, { paths: [opts.cwd] })
    } catch (_err) {}
  }

  // Import from local fs
  const isDir = !extname(source)
  const cwd = resolve(opts.cwd, isDir ? source : dirname(source))
  if (isDir) { source = opts.configFile }
  const res: ResolvedConfig = { config: null, cwd }
  try {
    res.configFile = opts.jiti.resolve(resolve(cwd, source), { paths: [cwd] })
  } catch (_err) { }
  if (!existsSync(res.configFile)) {
    return res
  }
  res.config = opts.jiti(res.configFile)
  if (typeof res.config === 'function') {
    res.config = await res.config()
  }
  return res
}
