# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## v1.9.0

[compare changes](https://github.com/unjs/c12/compare/v1.8.0...v1.9.0)

### 🚀 Enhancements

- Use confbox ([#140](https://github.com/unjs/c12/pull/140))

### 🔥 Performance

- Lazy load `chokidar` ([a8b3a1d](https://github.com/unjs/c12/commit/a8b3a1d))

### 🩹 Fixes

- Deep merge rc sources with defu ([#139](https://github.com/unjs/c12/pull/139))
- **watcher:** Watch `.config` and all supported extensions ([94c8181](https://github.com/unjs/c12/commit/94c8181))

### ❤️ Contributors

- Pooya Parsa ([@pi0](http://github.com/pi0))
- Sébastien Chopin ([@Atinux](http://github.com/Atinux))

## v1.8.0

[compare changes](https://github.com/unjs/c12/compare/v1.7.0...v1.8.0)

### 🚀 Enhancements

- Support `.config` dir ([#136](https://github.com/unjs/c12/pull/136))

### 🩹 Fixes

- Use default export of `json5` for parsing ([#135](https://github.com/unjs/c12/pull/135))

### 🏡 Chore

- Add used by section ([9e998a8](https://github.com/unjs/c12/commit/9e998a8))
- Use automd ([b114398](https://github.com/unjs/c12/commit/b114398))

### ✅ Tests

- Refactor to use named configs ([329b6f8](https://github.com/unjs/c12/commit/329b6f8))
- Update tests ([593619a](https://github.com/unjs/c12/commit/593619a))

### ❤️ Contributors

- Sadegh Barati ([@sadeghbarati](http://github.com/sadeghbarati))
- Pooya Parsa ([@pi0](http://github.com/pi0))

## v1.7.0

[compare changes](https://github.com/unjs/c12/compare/v1.6.1...v1.7.0)

### 🚀 Enhancements

- `.jsonc` config support ([#132](https://github.com/unjs/c12/pull/132))
- Json5 support ([#133](https://github.com/unjs/c12/pull/133))

### ❤️ Contributors

- Pooya Parsa ([@pi0](http://github.com/pi0))

## v1.6.1

[compare changes](https://github.com/unjs/c12/compare/v1.6.0...v1.6.1)

### 🩹 Fixes

- Preserve cloned dir if `install` option provided ([81e2891](https://github.com/unjs/c12/commit/81e2891))

### ❤️ Contributors

- Pooya Parsa ([@pi0](http://github.com/pi0))

## v1.6.0

[compare changes](https://github.com/unjs/c12/compare/v1.5.1...v1.6.0)

### 🚀 Enhancements

- Option to omit $ keys from resolved config ([#100](https://github.com/unjs/c12/pull/100))
- Support `install` for source options ([#126](https://github.com/unjs/c12/pull/126))

### 🩹 Fixes

- Normalize windows backslash for `configFile` and `source` ([#48](https://github.com/unjs/c12/pull/48))
- Clone sub layers into `node_modules/.c12` ([#125](https://github.com/unjs/c12/pull/125))
- Handle `http://` prefixes with giget as well ([6c09735](https://github.com/unjs/c12/commit/6c09735))

### 📖 Documentation

- Add package pronunciation ([#118](https://github.com/unjs/c12/pull/118))

### 🏡 Chore

- Update docs ([54ed82b](https://github.com/unjs/c12/commit/54ed82b))
- Update lockfile and vitest ([fecad1a](https://github.com/unjs/c12/commit/fecad1a))

### ❤️ Contributors

- Pooya Parsa ([@pi0](http://github.com/pi0))
- Lo ([@LoTwT](http://github.com/LoTwT))
- Alex Kozack 
- Nozomu Ikuta

## v1.5.1

[compare changes](https://github.com/unjs/c12/compare/v1.4.2...v1.5.1)

### 🚀 Enhancements

- Improve extending github layers ([#109](https://github.com/unjs/c12/pull/109))
- Allow setting giget clone options ([#112](https://github.com/unjs/c12/pull/112))

### 🏡 Chore

- Update dependencies ([1f2ab64](https://github.com/unjs/c12/commit/1f2ab64))
- Update release script ([6c21f09](https://github.com/unjs/c12/commit/6c21f09))

### ✅ Tests

- Update gh fixture to main ([a8b73c2](https://github.com/unjs/c12/commit/a8b73c2))

### 🎨 Styles

- Lint with prettier v3 ([7940e9b](https://github.com/unjs/c12/commit/7940e9b))

### ❤️ Contributors

- Pooya Parsa ([@pi0](http://github.com/pi0))

## v1.4.2

[compare changes](https://github.com/unjs/c12/compare/v1.4.1...v1.4.2)


### 🩹 Fixes

  - Allow extends dir to start with dot ([#71](https://github.com/unjs/c12/pull/71))

### 📖 Documentation

  - Fix typo for `configFile` ([#83](https://github.com/unjs/c12/pull/83))

### 🏡 Chore

  - **release:** V1.4.1 ([2b87193](https://github.com/unjs/c12/commit/2b87193))
  - Update dependencies ([309454a](https://github.com/unjs/c12/commit/309454a))
  - Lint project ([a102400](https://github.com/unjs/c12/commit/a102400))
  - Lint ([e19a6ff](https://github.com/unjs/c12/commit/e19a6ff))

### ❤️  Contributors

- Pooya Parsa ([@pi0](http://github.com/pi0))
- Rijk Van Zanten ([@rijkvanzanten](http://github.com/rijkvanzanten))

## v1.4.1

[compare changes](https://github.com/unjs/c12/compare/v1.4.0...v1.4.1)


### 🩹 Fixes

  - **watchConfig:** Handle custom config names ([eedd141](https://github.com/unjs/c12/commit/eedd141))

### ❤️  Contributors

- Pooya Parsa ([@pi0](http://github.com/pi0))

## v1.4.0

[compare changes](https://github.com/unjs/c12/compare/v1.3.0...v1.4.0)


### 🚀 Enhancements

  - `watchConfig` utility ([#77](https://github.com/unjs/c12/pull/77))
  - **watchConfig:** Support hmr ([#78](https://github.com/unjs/c12/pull/78))

### 📖 Documentation

  - Fix small grammer issues ([5f2b3a1](https://github.com/unjs/c12/commit/5f2b3a1))

### ❤️  Contributors

- Pooya Parsa ([@pi0](http://github.com/pi0))

## v1.3.0

[compare changes](https://github.com/unjs/c12/compare/v1.2.0...v1.3.0)


### 🚀 Enhancements

  - Generic types support ([#64](https://github.com/unjs/c12/pull/64))

### 🩹 Fixes

  - Use `rm` instead of `rmdir` for recursive remove ([#69](https://github.com/unjs/c12/pull/69))

### 🏡 Chore

  - **readme:** Update badges ([ff08ce2](https://github.com/unjs/c12/commit/ff08ce2))
  - **readme:** Add emoji ([9df0498](https://github.com/unjs/c12/commit/9df0498))
  - Update to pnpm 8 ([ecec1f2](https://github.com/unjs/c12/commit/ecec1f2))

### ❤️  Contributors

- Pooya Parsa ([@pi0](http://github.com/pi0))
- Daniel Roe <daniel@roe.dev>
- Sébastien Chopin ([@Atinux](http://github.com/Atinux))

## v1.2.0

[compare changes](https://github.com/unjs/c12/compare/v1.1.2...v1.2.0)


### 🚀 Enhancements

  - Load config from `package.json` ([#52](https://github.com/unjs/c12/pull/52))
  - Environment specific configuration ([#61](https://github.com/unjs/c12/pull/61))
  - Layer meta and source options ([#62](https://github.com/unjs/c12/pull/62))
  - `envName` config ([4a0227d](https://github.com/unjs/c12/commit/4a0227d))

### 🩹 Fixes

  - Allow extending from npm packages with subpath ([#54](https://github.com/unjs/c12/pull/54))

### 📖 Documentation

  - Fix grammer and typos ([3e8436c](https://github.com/unjs/c12/commit/3e8436c))
  - Don't mention unsupported usage ([ea7ac6e](https://github.com/unjs/c12/commit/ea7ac6e))

### 🏡 Chore

  - Update badge ([b0c78e2](https://github.com/unjs/c12/commit/b0c78e2))
  - Update readme ([8480e41](https://github.com/unjs/c12/commit/8480e41))
  - Update mlly ([cf6ef84](https://github.com/unjs/c12/commit/cf6ef84))

### ✅ Tests

  - Update test for env extends ([f363687](https://github.com/unjs/c12/commit/f363687))
  - Update snapshot ([071180f](https://github.com/unjs/c12/commit/071180f))

### ❤️  Contributors

- Pooya Parsa ([@pi0](http://github.com/pi0))
- Christian Preston ([@cpreston321](http://github.com/cpreston321))
- Guillaume Chau ([@Akryum](http://github.com/Akryum))

## v1.1.2

[compare changes](https://github.com/unjs/c12/compare/v1.1.1...v1.1.2)


### 🏡 Chore

  - Update dependencies ([efac912](https://github.com/unjs/c12/commit/efac912))

### ❤️  Contributors

- Pooya Parsa <pooya@pi0.io>

## v1.1.1

[compare changes](https://github.com/unjs/c12/compare/v1.1.0...v1.1.1)


### 🏡 Chore

  - Update mlly ([b085c9b](https://github.com/unjs/c12/commit/b085c9b))

### 🎨 Styles

  - Format with prettier ([f66ddd6](https://github.com/unjs/c12/commit/f66ddd6))

### ❤️  Contributors

- Pooya Parsa <pooya@pi0.io>

## [1.1.0](https://github.com/unjs/c12/compare/v1.0.1...v1.1.0) (2022-12-06)


### Features

* use giget to clone github urls ([4c7590a](https://github.com/unjs/c12/commit/4c7590ab94c667acd45fb1df05026d49b89431bc))


### Bug Fixes

* remove tmp dir to clone ([020e0b0](https://github.com/unjs/c12/commit/020e0b0ede67d02ce6953402201d3913c237dd1c))

### [1.0.1](https://github.com/unjs/c12/compare/v1.0.0...v1.0.1) (2022-11-15)

## [1.0.0](https://github.com/unjs/c12/compare/v0.2.13...v1.0.0) (2022-11-15)

### [0.2.13](https://github.com/unjs/c12/compare/v0.2.12...v0.2.13) (2022-09-19)

### [0.2.12](https://github.com/unjs/c12/compare/v0.2.11...v0.2.12) (2022-09-14)


### Features

* `defaultConfig` to be applied before extending ([1c4e898](https://github.com/unjs/c12/commit/1c4e8984e9ecacdeedfe5e2a98e5cb3991e94462))

### [0.2.11](https://github.com/unjs/c12/compare/v0.2.10...v0.2.11) (2022-09-06)


### Features

* custom `jiti` and `jitiOptions` ([bfd1be5](https://github.com/unjs/c12/commit/bfd1be5a21556eff57c75c1a9d6bece109823923))
* support loading rc from workspace dir in global mode ([7365a9c](https://github.com/unjs/c12/commit/7365a9cea52c6f9b7d266338bf8096c87c24b5ce))


### Bug Fixes

* `jitiOptions` is optional ([457a045](https://github.com/unjs/c12/commit/457a045683bb491bf9a42d035135b3dc7afce07b))
* validate sources value to be string ([#32](https://github.com/unjs/c12/issues/32)) ([f97c850](https://github.com/unjs/c12/commit/f97c850e81f2049e74194b76b82c82974a775141))

### [0.2.10](https://github.com/unjs/c12/compare/v0.2.9...v0.2.10) (2022-09-01)


### Features

* allow extending from multiple keys ([33cb210](https://github.com/unjs/c12/commit/33cb21032ec9d06baac4c69fc0dbf174b89b8944)), closes [#24](https://github.com/unjs/c12/issues/24)

### [0.2.9](https://github.com/unjs/c12/compare/v0.2.8...v0.2.9) (2022-08-04)


### Features

* use native esm resolution where possible ([#26](https://github.com/unjs/c12/issues/26)) ([9744621](https://github.com/unjs/c12/commit/97446215b1069b5f8dec68528e0cfcecdd9f5659))

### [0.2.8](https://github.com/unjs/c12/compare/v0.2.7...v0.2.8) (2022-06-29)


### Features

* try resolving paths as npm package ([7c48947](https://github.com/unjs/c12/commit/7c48947754bce2f881d153eb3c490f2940814c80))


### Bug Fixes

* warn when extend layers cannot be resolved ([f6506e8](https://github.com/unjs/c12/commit/f6506e814520716908944be0d2845b489feac353))

### [0.2.7](https://github.com/unjs/c12/compare/v0.2.6...v0.2.7) (2022-04-20)


### Bug Fixes

* check resolved config file existence before loading ([dda579d](https://github.com/unjs/c12/commit/dda579d26467bb8e3f2964de2f76057cc48edbcf))

### [0.2.6](https://github.com/unjs/c12/compare/v0.2.5...v0.2.6) (2022-04-20)


### Bug Fixes

* only ignore `MODULE_NOT_FOUND` when message contains configFile ([e067a56](https://github.com/unjs/c12/commit/e067a56e5d47bf396b6b8abd898fff249a1037fd))

### [0.2.5](https://github.com/unjs/c12/compare/v0.2.4...v0.2.5) (2022-04-07)

### [0.2.4](https://github.com/unjs/c12/compare/v0.2.3...v0.2.4) (2022-03-21)


### Bug Fixes

* avoid double merging of layers ([367cbf8](https://github.com/unjs/c12/commit/367cbf876bad7c389a462409c1cb1481c7b61804)), closes [nuxt/framework#3800](https://github.com/nuxt/framework/issues/3800)

### [0.2.3](https://github.com/unjs/c12/compare/v0.2.2...v0.2.3) (2022-03-18)


### Bug Fixes

* don't strip empty config files ([#8](https://github.com/unjs/c12/issues/8)) ([67bb1ee](https://github.com/unjs/c12/commit/67bb1ee1d36a0668ccf259a42148002b20ff0c25))

### [0.2.2](https://github.com/unjs/c12/compare/v0.2.0...v0.2.2) (2022-03-16)

## [0.2.0](https://github.com/unjs/c12/compare/v0.1.4...v0.2.0) (2022-03-16)


### ⚠ BREAKING CHANGES

* preserve all merging sources

### Features

* preserve all merging sources ([7a69480](https://github.com/unjs/c12/commit/7a694809c6b21c22fada40256373aced9d56d706))

### [0.1.4](https://github.com/unjs/c12/compare/v0.1.3...v0.1.4) (2022-03-07)


### Bug Fixes

* disable `requireCache` ([#6](https://github.com/unjs/c12/issues/6)) ([1a6f7d3](https://github.com/unjs/c12/commit/1a6f7d368b643bcebfa38d160c3c31dd7339ae65))

### [0.1.3](https://github.com/unjs/c12/compare/v0.1.2...v0.1.3) (2022-02-10)


### Bug Fixes

* apply defaults after extending ([c86024c](https://github.com/unjs/c12/commit/c86024cdc13708b837e5da717fde91ed1bbf6e9a))

### [0.1.2](https://github.com/unjs/c12/compare/v0.1.1...v0.1.2) (2022-02-10)


### Features

* extend options ([a76db4d](https://github.com/unjs/c12/commit/a76db4d6c363e0af7e7249f225f036117a750738))
* support custom resolver ([bd9997b](https://github.com/unjs/c12/commit/bd9997b3e897a9312d4c1bf0862db641d1e5f18f))

### 0.1.1 (2022-01-31)


### Features

* basic extends support ([#1](https://github.com/unjs/c12/issues/1)) ([ef199fc](https://github.com/unjs/c12/commit/ef199fcdbcfbff85f4a434ffc70aa1fb065c9a9f))
* extends support with remote repo ([17ef358](https://github.com/unjs/c12/commit/17ef3586c5b844d7a52e44508d05dbb92618f8fa))
* nested extend support ([4885487](https://github.com/unjs/c12/commit/48854874d9121724961b4275e96675706a86c465))


### Bug Fixes

* escape unsupported chars from tmpdir ([fd04922](https://github.com/unjs/c12/commit/fd04922c40a9893e7e98e06d3be650674b5c6508))
* temp directory initialization ([3aaf5db](https://github.com/unjs/c12/commit/3aaf5dbf57ceb34704de02c4756f0ac50281c6d1))
