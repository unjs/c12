import { promises as fsp } from 'fs'
import os from 'os'
import { resolve, extname, dirname } from 'pathe'
import createJiti from 'jiti'
import * as rc9 from 'rc9'
import defu from 'defu'
import { DotenvOptions, setupDotenv } from './dotenv'

export interface InputConfig extends Record<string, any> {}

export interface ResolvedConfig<T extends InputConfig=InputConfig> {
  config: T
  cwd: string
  configFile: string
  layers: ResolvedConfig<T>[]
}

export interface ExtendConfigOptions {
  extendKey?: string
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

  extend?: false | ExtendConfigOptions
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
  const { config, configFile } = await loadConfigFile(opts.cwd, opts.configFile)
  if (configFile) {
    r.configFile = configFile
  }

  // Load rc files
  const configRC = {}
  if (opts.rcFile) {
    if (opts.globalRc) {
      Object.assign(configRC, rc9.readUser({ name: opts.rcFile, dir: opts.cwd }))
    }
    Object.assign(configRC, rc9.read({ name: opts.rcFile, dir: opts.cwd }))
  }

  // Combine sources
  r.config = defu(
    opts.overrides,
    config,
    configRC,
    opts.defaults
  ) as T

  // Allow extending
  if (opts.extend) {
    await extendConfig(r.config, opts.configFile!, opts.cwd, opts.extend)
    r.layers = r.config._layers
    delete r.config._layers
    r.config = defu(
      r.config,
      ...r.layers.map(e => e.config)
    ) as T
  }

  // Return resolved config
  return r
}

const GIT_PREFIXES = ['github:', 'gitlab:', 'bitbucket:', 'https://']

async function extendConfig (config, configFile: string, cwd: string, opts: ExtendConfigOptions) {
  config._layers = config._layers || []

  const extendSources = (Array.isArray(config[opts.extendKey]) ? config[opts.extendKey] : [config[opts.extendKey]]).filter(Boolean)
  delete config[opts.extendKey]
  for (let extendSource of extendSources) {
    if (GIT_PREFIXES.some(prefix => extendSource.startsWith(prefix))) {
      const url = new URL(extendSource)
      const subPath = url.pathname.split('/').slice(2).join('/')
      const gitRepo = url.protocol + url.pathname.split('/').slice(0, 2).join('/')
      const tmpdir = resolve(os.tmpdir(), 'c12/', gitRepo.replace(/[#:@/\\]/g, '_'))
      await fsp.rm(tmpdir, { recursive: true }).catch(() => {})
      const gittar = await import('gittar').then(r => r.default || r)
      const tarFile = await gittar.fetch(gitRepo)
      await gittar.extract(tarFile, tmpdir)
      extendSource = resolve(tmpdir, subPath)
    }

    const isDir = !extname(extendSource)
    const _cwd = resolve(cwd, isDir ? extendSource : dirname(extendSource))
    const _config = await loadConfigFile(_cwd, isDir ? configFile : extendSource)
    if (!_config.config) { continue }
    await extendConfig(_config.config, configFile, _cwd, opts)
    config._layers.push({
      config: _config.config,
      cwd: _cwd,
      configFile: _config.configFile
    })
    if (_config.config._layers) {
      config._layers.push(..._config.config._layers)
      delete _config.config._layers
    }
  }
}

const jiti = createJiti(null, { cache: false, interopDefault: true })

async function loadConfigFile (cwd: string, configFile: string | false) {
  const res = {
    configFile: null,
    config: null
  }

  if (!configFile) {
    return res
  }

  try {
    res.configFile = jiti.resolve(resolve(cwd, configFile), { paths: [cwd] })
    res.config = jiti(res.configFile)
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
