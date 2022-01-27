import { fileURLToPath } from 'url'
import { expect, it, describe } from 'vitest'
import { loadConfig } from '../src'

describe('c12', () => {
  it('load fixture config', async () => {
    const fixtureDir = fileURLToPath(new URL('./fixture', import.meta.url))
    const { config } = await loadConfig({
      cwd: fixtureDir,
      dotenv: true,
      name: 'foo',
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
      overriden: true
    })
  })
})
