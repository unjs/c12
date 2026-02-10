# Dynamic Configuration Sources in c12

This document explores how c12 could support more dynamic configuration sources, such as drop-in config directories (systemd-style `.d` directories), and how configuration layering could be made more first-class.

## Background

Currently, c12 has a **fixed set of configuration sources** defined in `ConfigSource`:

```typescript
export type ConfigSource = "overrides" | "main" | "rc" | "packageJson" | "defaultConfig";
```

These sources are loaded in a **hardcoded order** within `loadConfig()` at `src/loader.ts:83-92`:

```typescript
const rawConfigs: Record<
  ConfigSource,
  ResolvableConfig<T> | null | undefined
> = {
  overrides: options.overrides,
  main: undefined,
  rc: undefined,
  packageJson: undefined,
  defaultConfig: options.defaultConfig,
};
```

This works well for the common case, but lacks flexibility for dynamic configuration discovery.

## The Use Case: Drop-in Config Directories

Inspired by systemd's drop-in configuration pattern, this feature would allow:

1. A main config file: `myapp.config.ts`
2. A drop-in directory: `myapp.config.d/`
3. Individual override files in the directory:
   - `myapp.config.d/10-admin-overrides.ts`
   - `myapp.config.d/20-production.ts`
   - `myapp.config.d/99-local.ts`

Files in the `.d` directory are merged in **lexicographic order**, with later files overriding earlier ones. This allows:
- System administrators to layer configurations without modifying the base config
- Easy enable/disable by adding/removing files
- Clear provenance of where config values came from

## Current Limitations

### Fixed Source Types

The `ConfigSource` type is a union literal, which means:
- New sources require type changes
- Cannot dynamically add sources at runtime
- Source ordering is fixed

### Limited Source Metadata

While `ConfigLayer` exists and has `meta` field, it's used differently than a comprehensive provenance system:

```typescript
export interface ConfigLayer<
  T extends UserInputConfig = UserInputConfig,
  MT extends ConfigLayerMeta = ConfigLayerMeta,
> {
  config: T | null;
  source?: string;
  sourceOptions?: SourceOptions<T, MT>;
  meta?: MT;
  cwd?: string;
  configFile?: string;
}
```

The `meta` field is primarily for user-defined metadata, not automatic tracking of:
- Which provider provided the value
- Where in the merge order the value came from
- Priority/ranking of the source

## Inspiration: Rust's Figment Crate

Rust's [figment](https://docs.rs/figment/latest/figment/) takes a more flexible approach:

### Provider Trait

Any type can implement the `Provider` trait to become a configuration source:

```rust
trait Provider {
    fn metadata(&self) -> Metadata;
    fn data(&self) -> Result<Map<Profile, Dict>, Error>;
    fn profile(&self) -> Option<Profile>;
}
```

### Metadata Tracking

Every value is tagged with `Metadata`:

```rust
pub struct Metadata {
    pub name: Cow<'static, str>,  // "TOML File"
    pub source: Option<Source>,     // Path, URL, etc.
    pub provide_location: Option<&'static Location<'static>>,
}
```

This allows:
- Rich error messages showing exactly where a value came from
- "Magic" values like `RelativePathBuf` that know their config file location
- Debugging complex configurations

### Third-Party Providers

The ecosystem can provide custom providers:
- `figment-directory` - Config from directories
- `figment-file-provider-adapter` - Reads `_FILE` suffix variables
- Custom providers for any data source

## Potential Design for c12

### Option 1: Provider Pattern

Introduce a `ConfigProvider` interface:

```typescript
export interface ConfigProvider<T = UserInputConfig> {
  /** Unique identifier for this provider */
  name: string;

  /** Metadata about this provider */
  metadata: ConfigProviderMetadata;

  /** Load configuration from this provider */
  load(context: ConfigProviderContext): Promise<T | null | undefined>;

  /** Priority (lower = higher priority) */
  priority?: number;

  /** Should this provider be enabled? */
  enabled?(options: LoadConfigOptions): boolean;
}

export interface ConfigProviderMetadata {
  name: string;
  source?: string;
  description?: string;
}

export interface ConfigProviderContext {
  cwd: string;
  envName: string | false;
  [key: string]: any;
}
```

#### Drop-in Directory Provider Example

```typescript
class DropInDirProvider<T extends UserInputConfig> implements ConfigProvider<T> {
  name = "drop-in-directory";

  constructor(
    private basePath: string,
    private configName: string,
    private pattern: string = "*.config.{ts,js,json,yaml,yml}",
  ) {}

  metadata = {
    name: "Drop-in Directory",
    source: this.basePath,
  };

  priority = 50; // Between RC and package.json

  async load(context: ConfigProviderContext): Promise<T | null> {
    const dropInDir = path.join(context.cwd, `${this.configName}.d`);

    if (!fs.existsSync(dropInDir)) {
      return null;
    }

    const files = await glob(this.pattern, { cwd: dropInDir });
    const sorted = files.sort(); // Lexicographic order

    let merged: Partial<T> = {};
    for (const file of sorted) {
      const config = await loadConfigFile(path.join(dropInDir, file));
      merged = defu(merged, config);
    }

    return merged as T;
  }
}
```

### Option 2: Source Registry

Add a source registration system to `LoadConfigOptions`:

```typescript
export interface LoadConfigOptions<T, MT> {
  // Existing options...

  /**
   * Register additional config sources
   * Sources are loaded in order of priority (lowest first)
   */
  sources?: ConfigSourceEntry<T, MT>[];
}

export interface ConfigSourceEntry<T, MT> {
  /** Unique identifier */
  id: string;

  /** Provider function returning config */
  provider: ResolvableConfig<T>;

  /** Priority (lower = higher priority) */
  priority: number;

  /** Whether this source should be loaded */
  condition?: (options: LoadConfigOptions<T, MT>) => boolean;

  /** Metadata about this source */
  metadata?: Partial<ConfigLayerMeta>;
}
```

#### Usage Example

```typescript
const config = await loadConfig({
  name: "myapp",

  sources: [
    {
      id: "overrides",
      priority: 10,
      provider: { custom: "overrides" },
    },
    {
      id: "drop-in-dir",
      priority: 20,
      condition: (opts) => opts.envName === "production",
      provider: async (ctx) => {
        const dropInDir = path.join(opts.cwd, "myapp.config.d");
        return await loadDropInConfigs(dropInDir);
      },
      metadata: { name: "Drop-in Directory" },
    },
    {
      id: "main",
      priority: 30,
      provider: { custom: "main" }, // Built-in loader
    },
  ],
});
```

### Option 3: Enhanced Built-in Sources

Add a new `dropIn` option to the existing `LoadConfigOptions`:

```typescript
export interface LoadConfigOptions<T, MT> {
  // Existing options...

  /**
   * Load config from a .d directory
   * Files are merged in lexicographic order
   */
  dropIn?: boolean | string | DropInOptions;
}

export interface DropInOptions {
  /** Directory name (default: <configFile>.d) */
  dir?: string;

  /** File pattern to match */
  pattern?: string;

  /** Where in priority order to insert (default: after main, before defaults) */
  insertAfter?: "main" | "rc" | "packageJson";

  /** Enable only for specific environments */
  env?: string[];
}
```

#### Usage

```typescript
// Simple: auto-detect myapp.config.d/
await loadConfig({ name: "myapp", dropIn: true });

// Custom directory
await loadConfig({
  name: "myapp",
  dropIn: { dir: "config.overrides.d" },
});

// Environment-specific
await loadConfig({
  name: "myapp",
  dropIn: { env: ["production", "staging"] },
});
```

## Layering Provenance

To make layering "first class" as mentioned in issue #298, we need:

### Enhanced Layer Metadata

```typescript
export interface ConfigLayer<T, MT> {
  config: T | null;
  source?: string;
  sourceOptions?: SourceOptions<T, MT>;
  meta?: ConfigLayerMeta;  // User metadata
  cwd?: string;
  configFile?: string;

  // New fields for provenance:
  provider: string;        // "main", "drop-in", "rc", etc.
  priority: number;       // Merge order
  loadTime: Date;        // When it was loaded
  fingerprint?: string;    // Content hash for change detection
}
```

### Layer Tree Visualization

A resolved config could show its full provenance:

```typescript
{
  config: { /* merged config */ },
  layers: [
    { provider: "overrides", priority: 10, configFile: undefined, ... },
    { provider: "drop-in", priority: 20, configFile: "./myapp.config.d/10-admin.ts", ... },
    { provider: "drop-in", priority: 20, configFile: "./myapp.config.d/20-production.ts", ... },
    { provider: "drop-in", priority: 20, configFile: "./myapp.config.d/99-local.ts", ... },
    { provider: "main", priority: 30, configFile: "./myapp.config.ts", ... },
    { provider: "rc", priority: 40, configFile: "/home/user/.myapprc", ... },
  ]
}
```

### Value Attribution

For debugging, we could trace where each config value came from:

```typescript
function traceValue(
  config: ResolvedConfig,
  keyPath: string[]
): ConfigLayer | undefined {
  // Search layers in reverse priority order
  for (const layer of [...config.layers].reverse()) {
    let value = layer.config;
    for (const key of keyPath) {
      value = value?.[key];
    }
    if (value !== undefined) {
      return layer;
    }
  }
  return undefined;
}

// Usage:
const source = traceValue(config, ["server", "port"]);
console.log(`server.port came from: ${source.configFile}`);
```

## Implementation Considerations

### Backward Compatibility

Any changes should maintain backward compatibility:

1. Default behavior unchanged - drop-ins disabled by default
2. Existing `ConfigSource` type could remain for internal use
3. New options as additions only

### Performance

Loading many small files has overhead:

1. Consider caching resolved configs
2. Watch mode should efficiently track file additions/removals
3. Content fingerprinting for change detection

### Error Handling

With more sources, errors are more likely:

```typescript
// Per-layer error tracking
export interface ConfigLayer<T, MT> {
  // ...
  error?: {
    message: string;
    source: string;
    recoverable: boolean;
  };
}

// Strict vs relaxed modes
await loadConfig({
  strict: true,  // Fail on any source error
  // or
  strict: false, // Log warnings, continue
});
```

### File Naming Conventions

For `.d` directories, establish conventions:

```typescript
// Numeric prefix for ordering:
// 00-base.conf
// 10-admin.conf
// 20-deployment.conf
// 99-local.conf

// Or use alphanumeric sorting:
// admin.conf
// base.conf
// local.conf
// production.conf
```

## Related Enhancements

### Watch Mode Integration

For drop-in directories, watch mode should:
- Detect new files added
- Detect files removed
- Detect files renamed
- Re-merge in correct order when changes occur

```typescript
watchConfig({
  name: "myapp",
  dropIn: true,
  onWatch: (event) => {
    console.log(`Drop-in file ${event.type}: ${event.path}`);
  },
});
```

### Configuration Validation

With layered configs, validation should:

1. Validate each layer independently
2. Validate the final merged result
3. Show which layer introduced validation errors

```typescript
const config = await loadConfig({
  name: "myapp",
  validate: (layer, merged) => {
    // Check layer-specific constraints
    // Check final merged constraints
  },
});
```

## Existing Workarounds

Before dynamic sources are implemented, you can:

### Use `extends` for Multiple Files

```typescript
// main.config.ts
export default {
  extends: [
    "./configs/base.config",
    "./configs/admin.config",
    "./configs/production.config",
  ],
  // ...
};
```

### Use Custom Resolver

```typescript
const config = await loadConfig({
  name: "myapp",
  async resolve(source, options) {
    if (source.startsWith("drop-in:")) {
      const dir = source.replace("drop-in:", "");
      return await loadDropInConfigs(dir);
    }
    return null; // Use default resolution
  },

  // Then use it via extends
  overrides: (ctx) => ({
    extends: ["drop-in:./myapp.config.d"],
  }),
});
```

### Merge Multiple Loads

```typescript
const [main, admin, local] = await Promise.all([
  loadConfig({ name: "myapp" }),
  loadConfig({ name: "admin-overrides" }),
  loadConfig({ name: "local-overrides" }),
]);

const merged = defu(local.config, admin.config, main.config);
```

## Summary

Dynamic configuration sources in c12 would enable:

1. **Drop-in config directories** - Systemd-style `.d` directories
2. **Custom providers** - Third-party data sources
3. **Enhanced provenance** - Clear tracking of where values came from
4. **Flexible ordering** - Configurable source priorities
5. **Better debugging** - Layer-by-layer inspection

The key design decision is between:
- **Provider pattern** - Maximum flexibility, ecosystem growth
- **Enhanced built-ins** - Simpler API, controlled feature set
- **Source registry** - Middle ground with explicit registration

All approaches should maintain backward compatibility while enabling the dynamic configuration discovery that makes layering a first-class concept.
