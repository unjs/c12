# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

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
