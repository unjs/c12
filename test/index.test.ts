import { fileURLToPath } from 'url'
import { resolve } from 'pathe'
import { expect, it, describe } from 'vitest'
import { loadConfig } from '../src'

describe('c12', () => {
  it('load fixture config', async () => {
    const fixtureDir = fileURLToPath(new URL('./fixture', import.meta.url))
    const rFixture = (...segments: string[]) => resolve(fixtureDir, ...segments)

    const { config, layers } = await loadConfig({
      cwd: fixtureDir,
      dotenv: true,
      overrides: {
        overriden: true
      },
      defaults: {
        defaultConfig: true
      }
    })

    expect(config).toMatchObject({
      configFile: true,
      rcFile: true,
      defaultConfig: true,
      overriden: true,
      baseConfig: true,
      devConfig: true,
      colors: {
        primary: 'user_primary',
        secondary: 'theme_secondary',
        text: 'base_text'
      }
    })

    expect(layers).toMatchObject([
      {
        config: {
          colors: {
            primary: 'theme_primary',
            secondary: 'theme_secondary'
          }
        },
        configFile: rFixture('theme/config.ts'),
        cwd: rFixture('theme')
      },
      {
        config: {
          baseConfig: true,
          colors: {
            primary: 'base_primary',
            text: 'base_text'
          }
        },
        configFile: rFixture('base/config.ts'),
        cwd: rFixture('base')
      },
      {
        config: { devConfig: true },
        configFile: rFixture('config.dev.ts'),
        cwd: rFixture('.')
      }
    ])
  })
})
