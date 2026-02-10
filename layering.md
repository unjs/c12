# c12-layer: Configuration Layering Analysis & Enhancement Proposal

## Problem Statement

c12 is a powerful configuration loader, but it has limitations that prevent advanced use cases:

1. **Fixed Pipeline**: Sources are hardcoded (overrides → config file → RC → package.json → defaults). Users cannot inject custom sources or reorder the pipeline.

2. **No Drop-in Directories**: Unlike systemd's `*.conf.d/` pattern, there's no way to have a directory of config fragments merged automatically. See [unjs/c12#298](https://github.com/unjs/c12/issues/298).

3. **No Provenance Tracking**: After merge, it's impossible to know which layer contributed a specific key. Debugging configuration issues requires manual bisection.

4. **Opaque Lifecycle**: The loading process is a black box—no hooks to observe or modify layers before final merge.

### Goals

1. Understand c12's current layering internals
2. Assess feasibility of drop-in directory support
3. Design a layer registry architecture with provenance tracking
4. Identify extension points for backward-compatible enhancements

---

## Findings: How c12 Works Today

### Layer Resolution Order

Priority from highest to lowest, based on [`loader.ts#L157-L164`](src/loader.ts#L157-L164):

| Priority | Source | Code Location |
|----------|--------|---------------|
| 1 (highest) | `options.overrides` | Passed to loadConfig |
| 2 | Main config file (`<name>.config.ts`) | [`L103-L108`](src/loader.ts#L103-L108) |
| 3 | RC files (cwd → workspace → home) | [`L115-L129`](src/loader.ts#L115-L129) |
| 4 | `package.json[name]` | [`L132-L141`](src/loader.ts#L132-L141) |
| 5 | `options.defaultConfig` | Passed to loadConfig |
| 6 | Extended layers (from `extends` key) | [`L167-L172`](src/loader.ts#L167-L172) |
| 7 (lowest) | `options.defaults` | [`L193-L195`](src/loader.ts#L193-L195) |

### Environment-Specific Config

Handled in [`resolveConfig` L411-L420](src/loader.ts#L411-L420):
- Checks for `$development`, `$production`, `$test` based on `options.envName`
- Also checks `$env.{envName}` object
- Merged with **highest priority** on top of the file's base config

### Merge Points

All merges use `defu` (or custom `options.merger`):

| Operation | Location | Code |
|-----------|----------|------|
| RC sources merge | [`L128`](src/loader.ts#L128) | `_merger({}, ...rcSources)` |
| Package.json values | [`L140`](src/loader.ts#L140) | `_merger({}, ...values)` |
| Main 5-source merge | [`L158-L164`](src/loader.ts#L158-L164) | `_merger(overrides, main, rc, packageJson, defaultConfig)` |
| Extended layers | [`L171`](src/loader.ts#L171) | `_merger(config, ...layers.map(e => e.config))` |
| Env-specific | [`L418`](src/loader.ts#L418) | `_merger(envConfig, res.config)` |
| Final defaults | [`L194`](src/loader.ts#L194) | `_merger(config, defaults)` |

### Lifecycle Sequence

```mermaid
sequenceDiagram
    participant User
    participant loadConfig
    participant resolveConfig
    participant rc9
    participant pkg-types
    participant extendConfig
    participant defu

    User->>loadConfig: loadConfig(options)
    loadConfig->>loadConfig: Normalize options
    
    opt options.dotenv
        loadConfig->>loadConfig: setupDotenv()
    end
    
    loadConfig->>resolveConfig: resolveConfig(".", options)
    resolveConfig-->>loadConfig: {config, configFile}
    
    opt options.rcFile
        loadConfig->>rc9: read(cwd)
        opt options.globalRc
            loadConfig->>rc9: read(workspace)
            loadConfig->>rc9: readUser(home)
        end
        loadConfig->>defu: merge RC sources
    end
    
    opt options.packageJson
        loadConfig->>pkg-types: readPackageJSON()
    end
    
    loadConfig->>defu: merge(overrides, main, rc, pkg, defaultConfig)
    
    opt options.extend
        loadConfig->>extendConfig: extendConfig(config)
        loop each extends source
            extendConfig->>resolveConfig: resolveConfig(source)
            extendConfig->>extendConfig: recursive
        end
        loadConfig->>defu: merge(config, ...layers)
    end
    
    opt options.defaults
        loadConfig->>defu: merge(config, defaults)
    end
    
    loadConfig-->>User: ResolvedConfig
```

### Decision Flowchart

```mermaid
flowchart TD
    start([loadConfig]) --> normalize[Normalize options]
    normalize --> dotenv{dotenv?}
    dotenv -->|yes| loadDotenv[setupDotenv]
    dotenv -->|no| mainFile
    loadDotenv --> mainFile
    
    mainFile{Config file exists?} -->|yes| loadMain[resolveConfig: load file]
    mainFile -->|no| rcCheck
    loadMain --> rcCheck
    
    rcCheck{rcFile?} -->|yes| loadRC[rc9.read cwd]
    rcCheck -->|no| pkgCheck
    loadRC --> globalRC{globalRc?}
    globalRC -->|yes| loadGlobal[rc9.read workspace + home]
    globalRC -->|no| mergeRC
    loadGlobal --> mergeRC[defu merge RC sources]
    mergeRC --> pkgCheck
    
    pkgCheck{packageJson?} -->|yes| loadPkg[readPackageJSON]
    pkgCheck -->|no| mainMerge
    loadPkg --> mainMerge
    
    mainMerge[defu: overrides → main → rc → pkg → defaultConfig]
    mainMerge --> extend{extends?}
    
    extend -->|yes| extendLoop[extendConfig recursively]
    extendLoop --> mergeLayers[defu merge layers]
    extend -->|no| defaults
    mergeLayers --> defaults
    
    defaults{defaults?} -->|yes| applyDefaults[defu merge defaults]
    defaults -->|no| cleanup
    applyDefaults --> cleanup
    
    cleanup --> omitKeys{omit$Keys?}
    omitKeys -->|yes| removeKeys[Remove $ prefixed keys]
    omitKeys -->|no| done
    removeKeys --> done([ResolvedConfig])
```

### Existing Extension Points

1. **`options.resolve`** ([`L284-L288`](src/loader.ts#L284-L288)): Custom resolver can intercept any source before default resolution
2. **`options.merger`** ([`L71`](src/loader.ts#L71)): Replace `defu` with custom merge function
3. **`options.import`** ([`L385-L386`](src/loader.ts#L385-L386)): Custom module loader
4. **`extends` key**: Already supports arrays of sources with recursive resolution

### Current Limitations

1. **No insertion points**: Can't add sources between existing ones (e.g., between RC and package.json)
2. **Post-hoc layers**: `ResolvedConfig.layers` preserves sources but only after merge—no pre-merge introspection
3. **No directory scanning**: `resolveConfig` handles single files only
4. **No key-level tracking**: `defu` merges destructively with no provenance

---

## Proposed Solutions

### Solution 1: Drop-in Directory Support

**Problem**: Users want `myapp.config.d/` directories with sorted fragments like `00-base.ts`, `10-local.ts`.

**Approach**: Add a `configDir` source type that scans a directory and sorts files.

```typescript
// New function in loader.ts
async function loadConfigDir<T>(
  dirPath: string,
  options: LoadConfigOptions<T>
): Promise<ConfigLayer<T>[]> {
  const dir = resolve(options.cwd!, dirPath);
  if (!existsSync(dir)) return [];
  
  const entries = await readdir(dir);
  const configFiles = entries
    .filter(f => SUPPORTED_EXTENSIONS.some(ext => f.endsWith(ext)))
    .sort(); // Alphabetical: 00-base.ts < 10-overrides.ts
  
  const layers: ConfigLayer<T>[] = [];
  for (const file of configFiles) {
    const res = await resolveConfig(join(dir, file), options);
    if (res.config) {
      layers.push(res);
    }
  }
  return layers;
}
```

**Integration Options**:

| Option | Where | Behavior |
|--------|-------|----------|
| A. New rawConfigs source | After `main` | `rawConfigs.configDir = loadConfigDir(...)` |
| B. Auto-extend | In `extendConfig` | Treat `.config.d/` as implicit extends |
| C. User-opt-in | Via `options.configDir` | Explicit enable with priority control |

**Recommended**: Option C with priority parameter:
```typescript
loadConfig({
  name: 'myapp',
  configDir: {
    path: 'myapp.config.d/',
    priority: 'after-main' // or 'before-rc', 'after-extends'
  }
})
```

---

### Solution 2: Pluggable Source Providers

**Problem**: Users want custom sources (env vars, remote config, Vault) integrated into the pipeline.

**Approach**: Define a `ConfigProvider` interface and allow registration.

```typescript
// New types
interface ConfigProvider<T = any> {
  name: string;
  priority: number; // Lower = higher priority
  load(options: LoadConfigOptions<T>): Promise<ConfigLayer<T> | null>;
}

// Built-in providers
const builtinProviders: ConfigProvider[] = [
  { name: 'overrides', priority: 0, load: (o) => ({ config: o.overrides }) },
  { name: 'main', priority: 100, load: (o) => resolveConfig('.', o) },
  { name: 'rc', priority: 200, load: loadRcFiles },
  { name: 'packageJson', priority: 300, load: loadPackageJson },
  { name: 'defaultConfig', priority: 400, load: (o) => ({ config: o.defaultConfig }) },
];

// User registration
loadConfig({
  providers: [
    ...defaultProviders,
    { name: 'env', priority: 50, load: envProvider },
    { name: 'vault', priority: 150, load: vaultProvider },
  ]
})
```

**Benefits**:
- Full control over source order
- Clean separation of concerns
- Easy to add/remove/reorder sources

---

### Solution 3: Layer Registry with Two-Phase Execution

**Problem**: No way to inspect layers before merge or trace value provenance.

**Approach**: Separate "build" and "load" phases.

```typescript
// New API
interface LayerRegistry<T> {
  readonly layers: ReadonlyArray<RegisteredLayer<T>>;
  
  // Build phase
  addSource(name: string, source: SourceDefinition): LayerRegistry<T>;
  validate(): Promise<ValidationResult>;
  
  // Introspection (pre-load)
  getLayerByName(name: string): RegisteredLayer<T> | undefined;
  
  // Execution
  load(): Promise<ResolvedConfigWithProvenance<T>>;
}

interface RegisteredLayer<T> {
  name: string;
  priority: number;
  source: SourceDefinition;
  status: 'pending' | 'loaded' | 'not-found' | 'error';
  config?: T;
  configFile?: string;
}

interface ResolvedConfigWithProvenance<T> {
  config: T;
  layers: RegisteredLayer<T>[];
  provenance: Map<string, LayerProvenance>; // key path → which layer
}

interface LayerProvenance {
  layerName: string;
  configFile?: string;
  keyPath: string;
}
```

**Usage**:
```typescript
const registry = createLayerRegistry({ name: 'myapp' })
  .addSource('defaults', { type: 'static', config: { port: 3000 } })
  .addSource('base', { type: 'file', path: 'myapp.config.ts' })
  .addSource('drop-ins', { type: 'directory', path: 'myapp.config.d/' })
  .addSource('env', { type: 'env', prefix: 'MYAPP_' })
  .addSource('cli', { type: 'static', config: cliArgs });

// Validate before loading
const validation = await registry.validate();
if (!validation.ok) {
  console.error('Missing sources:', validation.missing);
}

// Load with provenance
const { config, provenance } = await registry.load();

// Debug: where did database.host come from?
console.log(provenance.get('database.host'));
// → { layerName: 'drop-ins', configFile: 'myapp.config.d/20-database.ts', keyPath: 'database.host' }
```

---

### Solution 4: Provenance-Tracking Merger

**Problem**: `defu` merges destructively—no way to know which layer contributed a key.

**Approach**: Wrap merge with a tracking layer.

```typescript
function createProvenanceMerger<T>() {
  const provenance = new Map<string, LayerProvenance>();
  
  function trackingMerger(
    layerName: string,
    configFile: string | undefined
  ): (...sources: T[]) => T {
    return (...sources) => {
      // Use defu for actual merge
      const result = defu(...sources);
      
      // Track which keys came from which layer
      // (Simplified: real impl would deep-traverse)
      for (const [key, value] of Object.entries(sources[0] || {})) {
        if (value !== undefined && !provenance.has(key)) {
          provenance.set(key, { layerName, configFile, keyPath: key });
        }
      }
      
      return result;
    };
  }
  
  return { trackingMerger, provenance };
}
```

**Deep tracking** would require a recursive merge that records the path for every leaf value.

---

### Solution 5: Backward-Compatible Integration

**Problem**: New features must not break existing `loadConfig()` users.

**Approach**: Layer registry is opt-in; `loadConfig` continues unchanged.

```typescript
// Existing API unchanged
const config = await loadConfig({ name: 'myapp' });

// New API for power users
const registry = await buildLayerRegistry({ name: 'myapp' });
const { config, provenance } = await registry.load();

// Or: loadConfig with provenance opt-in
const { config, provenance } = await loadConfig({
  name: 'myapp',
  trackProvenance: true, // New option
});
```

**Implementation**: Refactor `loadConfig` internals to use registry, but expose existing return type by default.

---

## Implementation Roadmap

### Phase 1: Drop-in Directories
- Add `loadConfigDir()` function
- Add `options.configDir` to `LoadConfigOptions`
- Integrate into layer collection before extends resolution
- **Effort**: Small, self-contained change

### Phase 2: Provider Interface
- Define `ConfigProvider` interface
- Refactor existing sources as built-in providers
- Add `options.providers` for custom sources
- **Effort**: Medium, requires restructuring loader.ts

### Phase 3: Layer Registry
- Create `LayerRegistry` class
- Implement two-phase execution
- Add `buildLayerRegistry()` export
- **Effort**: Large, new module

### Phase 4: Provenance Tracking
- Implement tracking merger
- Integrate with registry
- Add `trackProvenance` option to loadConfig
- **Effort**: Medium, requires careful deep-object traversal

---

## Open Questions

1. **Priority notation**: Should priorities be numeric (0-1000) or named slots (`before-main`, `after-rc`)?

2. **Drop-in merge order**: Should drop-ins merge left-to-right (later files override) or right-to-left (earlier files have priority)?

3. **Provenance granularity**: Track at key level only, or full path (`database.connection.host`)?

4. **Async providers**: How to handle slow providers (Vault, remote config) gracefully?

5. **Caching**: Should registry cache loaded configs for repeated `.load()` calls?

---

## Implemented: ConfigProvider System

Phase 2 of the roadmap has been implemented. The c12-layer fork now includes a fully functional pluggable provider system that allows users to customize the configuration loading pipeline while maintaining complete backward compatibility.

### Architecture Overview

The provider system introduces a `ConfigProvider` interface that abstracts each configuration source. Instead of hardcoded loading logic, `loadConfig()` now iterates through an ordered list of providers, each responsible for loading one source of configuration.

```mermaid
flowchart LR
    subgraph providers["Provider Pipeline"]
        direction TB
        p1[overrides<br/>priority: 100]
        p2[main<br/>priority: 200]
        p3[rc<br/>priority: 300]
        p4[packageJson<br/>priority: 400]
        p5[defaultConfig<br/>priority: 500]
    end
    
    loadConfig --> sort[Sort by priority]
    sort --> providers
    providers --> merge[defu merge all configs]
    merge --> extends[Process extends]
    extends --> result[ResolvedConfig]
```

### Core Types

The implementation adds these types in [`src/providers.ts`](src/providers.ts):

```typescript
/**
 * Context passed to config providers during loading
 */
interface ProviderContext<T, MT> {
  /** Normalized load options */
  options: LoadConfigOptions<T, MT>;
  /** Merger function (defu or custom) */
  merger: (...sources: Array<T | null | undefined>) => T;
  /** Resolve a config file (used by main provider) */
  resolveConfig: (source: string, options: LoadConfigOptions<T, MT>) => Promise<ResolvedConfig<T, MT>>;
  /** Results from previously loaded providers (by name) */
  loadedConfigs: Map<string, T | null | undefined>;
}

/**
 * Result returned by a config provider
 */
interface ProviderResult<T, MT> {
  /** The loaded configuration (or null/undefined if not found) */
  config: T | null | undefined;
  /** Layer metadata for introspection */
  layer?: Partial<ConfigLayer<T, MT>>;
  /** Additional metadata to merge into ResolvedConfig */
  meta?: MT;
  /** Resolved config file path (for main provider) */
  configFile?: string;
  /** Internal config file path */
  _configFile?: string;
}

/**
 * A pluggable configuration source provider
 */
interface ConfigProvider<T, MT> {
  /** Unique name for this provider */
  name: string;
  /**
   * Priority determines merge order.
   * Lower numbers = higher priority (merged first, so they "win").
   */
  priority: number;
  /**
   * Load configuration from this provider.
   * Return null/undefined if this provider has no config to contribute.
   */
  load(ctx: ProviderContext<T, MT>): Promise<ProviderResult<T, MT> | null | undefined>;
}
```

### Built-in Providers

Five built-in providers replicate the original c12 behavior:

| Provider | Priority | Factory Function | Description |
|----------|----------|------------------|-------------|
| overrides | 100 | `createOverridesProvider()` | Returns `options.overrides` |
| main | 200 | `createMainProvider()` | Loads `<name>.config.ts` via `resolveConfig()` |
| rc | 300 | `createRcProvider()` | Loads `.namerc` files (cwd, workspace, home) |
| packageJson | 400 | `createPackageJsonProvider()` | Loads from `package.json[name]` |
| defaultConfig | 500 | `createDefaultConfigProvider()` | Returns `options.defaultConfig` |

Each provider is a standalone factory function that can be individually imported and customized.

### Exports

The following are exported from the main `c12` module:

```typescript
// Types
export type { ConfigProvider, ProviderContext, ProviderResult } from "./providers.ts";

// Factory functions for built-in providers
export {
  getDefaultProviders,      // Returns all 5 built-in providers
  sortProviders,            // Sort providers by priority
  createOverridesProvider,
  createMainProvider,
  createRcProvider,
  createPackageJsonProvider,
  createDefaultConfigProvider,
} from "./providers.ts";
```

### Usage Examples

#### Basic: No Changes Required

Existing code works without modification:

```typescript
import { loadConfig } from 'c12';

// Works exactly as before
const { config } = await loadConfig({ name: 'myapp' });
```

#### Adding a Custom Provider

Inject a custom source between existing ones:

```typescript
import { loadConfig, getDefaultProviders, ConfigProvider } from 'c12';

// Create a provider that loads from environment variables
const envProvider: ConfigProvider = {
  name: 'env',
  priority: 150, // Between overrides (100) and main (200)
  async load(ctx) {
    const config: Record<string, any> = {};
    const prefix = `${ctx.options.name?.toUpperCase()}_`;
    
    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith(prefix)) {
        const configKey = key.slice(prefix.length).toLowerCase();
        config[configKey] = value;
      }
    }
    
    if (Object.keys(config).length === 0) return null;
    
    return {
      config,
      layer: {
        config,
        configFile: 'environment',
      },
    };
  },
};

const { config, layers } = await loadConfig({
  name: 'myapp',
  providers: [...getDefaultProviders(), envProvider],
});

// layers will include { configFile: 'environment', config: {...} }
```

#### Replacing Default Providers

Use only specific sources:

```typescript
import { loadConfig, createMainProvider, createOverridesProvider } from 'c12';

// Only load from overrides and main config file (no RC, no package.json)
const { config } = await loadConfig({
  name: 'myapp',
  providers: [
    createOverridesProvider(),
    createMainProvider(),
  ],
  overrides: { debug: true },
});
```

#### Reordering Providers

Change the default priority order:

```typescript
import { loadConfig, getDefaultProviders } from 'c12';

// Make package.json take precedence over RC files
const providers = getDefaultProviders().map(p => {
  if (p.name === 'packageJson') return { ...p, priority: 250 };
  if (p.name === 'rc') return { ...p, priority: 350 };
  return p;
});

const { config } = await loadConfig({
  name: 'myapp',
  providers,
});
```

#### Provider Dependencies

Access previously loaded configs in your provider:

```typescript
const conditionalProvider: ConfigProvider = {
  name: 'conditional',
  priority: 250,
  async load(ctx) {
    // Check what the main config loaded
    const mainConfig = ctx.loadedConfigs.get('main');
    
    if (mainConfig?.featureFlags?.enableAdvanced) {
      return {
        config: { advancedSetting: 'enabled' },
      };
    }
    
    return null; // Don't contribute if feature not enabled
  },
};
```

#### Remote Configuration Provider

Load config from a remote source:

```typescript
const remoteProvider: ConfigProvider = {
  name: 'remote',
  priority: 175, // After env, before main
  async load(ctx) {
    const endpoint = process.env.CONFIG_ENDPOINT;
    if (!endpoint) return null;
    
    try {
      const response = await fetch(`${endpoint}/${ctx.options.name}`);
      if (!response.ok) return null;
      
      const config = await response.json();
      return {
        config,
        layer: {
          config,
          configFile: endpoint,
        },
      };
    } catch {
      // Network error - silently skip
      return null;
    }
  },
};
```

### How the Provider System Works

1. **Initialization**: `loadConfig()` normalizes options and sets up dotenv (unchanged)

2. **Provider Selection**: 
   - If `options.providers` is specified, use those providers
   - Otherwise, call `getDefaultProviders()` to get the built-in set

3. **Sorting**: Providers are sorted by `priority` (ascending). Lower priority numbers are processed first and "win" in the merge.

4. **Sequential Loading**: Each provider's `load()` method is called in order. The `ProviderContext` includes:
   - The normalized `options`
   - The `merger` function (defu or custom)
   - A `resolveConfig` helper for loading files
   - A `loadedConfigs` map with results from previous providers

5. **Result Collection**: Non-null results are collected. Each result includes:
   - `config`: The configuration object
   - `layer`: Optional metadata for the `layers` array
   - `configFile`, `_configFile`, `meta`: For the main provider

6. **Merging**: All collected configs are merged using the merger function, in priority order

7. **Extends Processing**: The `extends` mechanism works as before, after the main merge

8. **Layer Preservation**: Provider results with `layer` data are added to `ResolvedConfig.layers`

### Impact on Existing c12 Users

#### Zero Breaking Changes

The provider system is **fully backward compatible**. Existing code continues to work without any modifications:

```typescript
// This code works identically before and after the change
const { config } = await loadConfig({
  name: 'myapp',
  overrides: { debug: true },
  rcFile: '.myapprc',
  packageJson: true,
  defaults: { port: 3000 },
});
```

#### Behavioral Equivalence

When `options.providers` is not specified, the system behaves identically to the original c12:

1. Same source loading order (overrides → main → rc → packageJson → defaultConfig)
2. Same merge semantics (defu, or custom merger)
3. Same `extends` processing
4. Same `layers` array structure
5. Same handling of `$development`, `$production`, etc.

#### Minor Differences

There is one minor difference in error messages:

| Scenario | Original | With Providers |
|----------|----------|----------------|
| `configFileRequired: true` with missing file | `Required config (CUSTOM) cannot be resolved.` | `Required config (/full/path/CUSTOM) cannot be resolved.` |

The new message includes the full resolved path, which is more helpful for debugging.

#### New Option

One new option is added to `LoadConfigOptions`:

```typescript
interface LoadConfigOptions<T, MT> {
  // ... existing options ...
  
  /**
   * Custom configuration providers.
   * When specified, replaces the built-in source loading.
   * Use getDefaultProviders() to include defaults.
   */
  providers?: ConfigProvider<T, MT>[];
}
```

### Testing the Provider System

The implementation includes comprehensive tests in [`test/loader.test.ts`](test/loader.test.ts):

```typescript
describe("providers", () => {
  it("uses default providers when none specified");
  it("allows custom providers to inject config");
  it("respects provider priority order");
  it("allows removing default providers");
  it("provider can access previously loaded configs");
});
```

Run tests with:
```bash
pnpm test
```

### Future Enhancements

The provider system creates a foundation for additional features:

1. **Drop-in Directory Provider**: A `createConfigDirProvider()` that scans `*.config.d/` directories

2. **Provenance Tracking**: Providers already return layer metadata; a tracking merger could record which provider contributed each key

3. **Validation Phase**: A `validateProviders()` function that checks all sources exist before loading

4. **Parallel Loading**: Independent providers could load concurrently for better performance

5. **Provider Plugins**: A registry of community providers (Vault, AWS SSM, Consul, etc.)

### Files Changed

| File | Change |
|------|--------|
| [`src/providers.ts`](src/providers.ts) | New file: Provider types and built-in implementations |
| [`src/types.ts`](src/types.ts) | Added `providers` option to `LoadConfigOptions` |
| [`src/loader.ts`](src/loader.ts) | Refactored to use provider pipeline |
| [`src/index.ts`](src/index.ts) | Export provider types and functions |
| [`test/loader.test.ts`](test/loader.test.ts) | Added provider system tests |

### Summary

The ConfigProvider system transforms c12 from a fixed-pipeline loader into an extensible, customizable configuration platform while maintaining complete backward compatibility. Users who don't need customization see no changes; power users gain full control over the loading pipeline.
