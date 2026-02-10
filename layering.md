# c12-layer: Understanding & Extending c12's Configuration Layering

## Goals

This document guides analysis of c12's configuration layering system and proposes enhancements for more dynamic, introspectable configuration management.

## Part 1: Understanding the Current System

### Questions to Answer

1. **Where does layering happen?**
   - How does `defu` merge configurations?
   - What is the call graph from `loadConfig()` to final merged config?

2. **When in the lifecycle?**
   - Map the complete execution pipeline from `loadConfig()` invocation to resolved config
   - Identify when each source is loaded, when extends are resolved, when merging occurs

3. **What is the layer resolution order?**
   - Document the priority stack (per README: overrides → config file → RC → global RC → package.json → defaults → extended layers)
   - How does environment-specific config (`$development`, `$production`, etc.) factor in?

### Deliverables

- **Mermaid sequence diagram**: Show the lifecycle from `loadConfig()` call through to final config
- **Mermaid flowchart**: Show decision points (does RC exist? does config extend? etc.)
- **Code citations**: Link to the actual source locations where merging happens

---

## Part 2: Dynamic Configuration Sources

### Problem Statement

c12 currently has a fixed resolution pipeline. We want to explore:

1. **Drop-in config directories** (à la systemd's `*.conf.d/`)
   - Reference: https://github.com/unjs/c12/issues/298
   - Allow `<name>.config.d/` directories where multiple configs can be dropped in
   - Configs sorted alphabetically (or with numeric prefixes like `00-base.ts`, `10-overrides.ts`)

2. **Pluggable source providers**
   - Instead of hardcoded sources (file, RC, package.json), allow registering custom providers
   - Examples: environment variables provider, remote config provider, vault/secrets provider

### Design Questions

- How would drop-in directories integrate with the existing layer system?
- Should drop-in configs be siblings to extended layers, or a separate concept?
- How do we handle ordering/priority for drop-in files?

---

## Part 3: Layer Registry Architecture

### Vision

Transform c12 from a "fixed pipeline config loader" into a "structured config layer manager" with:

1. **Explicit layer registry**
   - Named, ordered collection of configuration sources
   - Each layer has metadata: name, source type, priority, file path(s)

2. **Two-phase execution**
   - **Build phase**: Construct the layer registry, validate sources exist, resolve extends
   - **Run phase**: Execute the registry to produce final merged config

3. **Introspection capabilities**
   - Query which layer provided a specific config key
   - Trace config value provenance (like Rust's `figment` crate metadata)
   - Debug mode showing layer-by-layer merge steps

### Inspiration

- **Rust's figment**: Providers with metadata, value provenance tracking
- **systemd**: Drop-in directories, clear override semantics
- **Kubernetes**: ConfigMap layering, strategic merge patches

### Proposed API Sketch

```typescript
// Build a layer registry explicitly
const registry = createLayerRegistry({
  name: "myapp"
})
  .addSource("defaults", { type: "static", config: { ... } })
  .addSource("base-file", { type: "file", path: "myapp.config.ts" })
  .addSource("drop-ins", { type: "directory", path: "myapp.config.d/" })
  .addSource("env-overrides", { type: "env", prefix: "MYAPP_" })
  .addSource("cli-overrides", { type: "static", config: cliArgs });

// Inspect before running
console.log(registry.layers); // See all registered sources
console.log(registry.resolve("database.host")); // Which layer provides this?

// Execute to get final config
const { config, provenance } = await registry.load();
```

---

## Part 4: Implementation Considerations

### Backward Compatibility

- `loadConfig()` should continue working unchanged
- New APIs are opt-in enhancements

### Key Extension Points to Identify

1. Where can we hook into layer resolution?
2. Can we intercept/wrap the merge function?
3. How do we inject additional sources into the pipeline?

### Files to Analyze

- `src/loader.ts` - Main loading logic
- `src/config.ts` - Config resolution
- Look for `defu` usage patterns
- Look for `extends` resolution logic

---

## Success Criteria

After this analysis, we should have:

1. Clear understanding of c12's internals with diagrams
2. Feasibility assessment for drop-in directories
3. Draft design for layer registry architecture
4. Identified extension points or required changes to c12
