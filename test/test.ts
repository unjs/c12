import { fileURLToPath } from 'url'
import { loadConfig } from '../src'

async function main () {
  const r = path => fileURLToPath(new URL(path, import.meta.url))
  const fixtureDir = r('./fixture')
  const config = await loadConfig({ cwd: fixtureDir, dotenv: true })
  console.log(config)
}

main().catch(console.error)
