**Important:** Keep AGENTS.md updated with project info.

c12 is a smart configuration loader for JavaScript/TypeScript projects. It loads config from multiple sources (files, RC, `package.json`, env, remote), merges them with a defined priority, and supports watching/HMR.

## Project Structure

```
src/
├── index.ts      # Public exports barrel
├── types.ts      # All TypeScript type definitions
├── loader.ts     # Core config loading logic (~450 LoC)
├── watch.ts      # File watcher with HMR support (~150 LoC)
├── dotenv.ts     # .env file parsing and interpolation (~235 LoC)
└── update.ts     # Programmatic config file creation/update (~130 LoC)

test/
├── loader.test.ts   # Config loader tests (fixture-based)
├── dotenv.test.ts   # Dotenv parsing/interpolation tests
├── update.test.ts   # Config update tests
└── fixture/         # Real config files for testing
```

Two build entry points: `./dist/index.mjs` (main) and `./dist/update.mjs` (update utilities).

## Architecture

### Loading Priority (high → low)

1. Config overrides (`overrides` option)
2. Main config file (`{name}.config.{ext}`)
3. RC files (`.{name}rc` — local, workspace, home)
4. `package.json` config key
5. Default config (`defaults` option)
6. Extended layers (`extends` key, recursive)

### Key Design Patterns

- **Lazy loading** — Optional deps (`chokidar`, `giget`, `jiti`, `dotenv`, `magicast`) imported on demand
- **Deep merge** via `defu` — Layers are merged bottom-up with `defu`
- **Environment overrides** — `$test`, `$development`, `$production` keys auto-applied based on env
- **Remote extends** — Config can extend from GitHub/GitLab/npm via `giget`
- **Dynamic config** — Supports `export default (ctx) => ({ ... })` functions
- **ESM cache busting** — Native `import()` with incrementing query string `_${++counter}`

### Core Dependencies

| Package | Purpose |
|---------|---------|
| `confbox` | Parse YAML, JSONC, JSON5, TOML (lazy) |
| `defu` | Deep merge config layers |
| `exsolve` | Module path resolution |
| `pathe` | Cross-platform path utilities |
| `pkg-types` | `package.json` reading |
| `rc9` | RC file parsing |

### Optional Peer Dependencies

| Package | When needed |
|---------|------------|
| `chokidar` | `watchConfig()` |
| `giget` | Remote git extends |
| `jiti` | Legacy/CJS TypeScript loading |
| `dotenv` | `.env` parsing on Node <20.6 |
| `magicast` | `updateConfig()` AST modification |

## Public API

```ts
loadConfig<T>(options)      // Core: load and merge config from all sources
watchConfig<T>(options)     // Watch config files, reload on change
loadDotenv(options)         // Load .env files into an object
setupDotenv(options)        // Load .env files into process.env
updateConfig(options)       // Create or update config files (experimental)
createDefineConfig<T>()     // Type-safe config definition helper
SUPPORTED_EXTENSIONS        // Array of all supported file extensions
```

## Development

### Toolchain

- **Build**: `obuild`
- **Test**: `vitest` (run with `pnpm vitest run <path>`)
- **Lint**: `oxlint` + `oxfmt` (Rust-based)
- **Types**: `tsgo --noEmit`
- **Package manager**: `pnpm`

### Commands

```sh
pnpm build          # Build dist/
pnpm test           # Lint + test + type check
pnpm vitest run test/loader.test.ts  # Run specific test
pnpm dev            # Vitest watch mode
pnpm lint:fix       # Auto-fix lint + format
```

### Testing Patterns

- Fixture-based: real config files in `test/fixture/`
- `transformPaths()` helper normalizes absolute paths for snapshots
- Dotenv tests use temp directories with `beforeEach`/`afterAll` cleanup
- Inline snapshots preferred

### Code Conventions

- ESM-only, no CommonJS
- Explicit `.ts`/`.js` extensions in imports
- No barrel files (except `index.ts` entry)
- Internal helpers at bottom of files
- Options object pattern for multi-arg functions
