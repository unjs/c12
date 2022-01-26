# c11

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![Github Actions][github-actions-src]][github-actions-href]
[![Codecov][codecov-src]][codecov-href]

> Smart Config Loader

## Features

- JSON, CJS, Typescript and ESM config loader with [unjs/jiti](https://github.com/unjs/jiti)
- RC config support with [unjs/rc9](https://github.com/unjs/rc9)
- Multiple sources merged with [unjs/defu](https://github.com/unjs/defu)
- `.env` support with [dotenv](https://www.npmjs.com/package/dotenv)

## Usage

Install package:

```sh
# npm
npm install c11

# yarn
yarn install c11

# pnpm
pnpm install c11
```

Import:

```js
// ESM
import { loadConfig } from 'c11'

// CommonJS
const { loadConfig } = require('c11')
```

Load configuration:

```js
const { config } = await loadConfig({})
```

## Loading priority

c11 merged config sources with [unjs/defu](https://github.com/unjs/defu) by below order:

1. config overrides passed by options
2. config file in CWD
3. RC file in CWD
4. global RC file in user's home directory
5. default config passed by options

## Options

### `cwd`

Resolve configuration from this working directory. Default is `process.cwd()`

### `name`

Configuration base name. Default is `config`.

### `configName`

Configuration file name without extension . Default is generated from `name` (name=foo => `foo.config`).

Set to `false` to avoid loading config file.

### `rcFile`

RC Config file name. Default is generated from `name` (name=foo => `.foorc`).

Set to `false` to disable loading RC config.

### `globalRC`

Load RC config from the user's home directory. Only enabled when `rcFile` is provided. Set to `false` to disable this functionality.

### `dotenv`

Loads `.env` file if enabled. It is disabled by default.

### `defaults`

Specify default configuration. It has the **lowest** priority.

### `overides`

Specify override configuration. It has the **highest** priority.

## 💻 Development

- Clone this repository
- Enable [Corepack](https://github.com/nodejs/corepack) using `corepack enable` (use `npm i -g corepack` for Node.js < 16.10)
- Install dependencies using `yarn install`
- Run interactive tests using `yarn dev`

## License

Made with 💛 Published under [MIT License](./LICENSE).

<!-- Badges -->
[npm-version-src]: https://img.shields.io/npm/v/c11?style=flat-square
[npm-version-href]: https://npmjs.com/package/c11

[npm-downloads-src]: https://img.shields.io/npm/dm/c11?style=flat-square
[npm-downloads-href]: https://npmjs.com/package/c11

[github-actions-src]: https://img.shields.io/github/workflow/status/unjs/c11/ci/main?style=flat-square
[github-actions-href]: https://github.com/unjs/c11/actions?query=workflow%3Aci

[codecov-src]: https://img.shields.io/codecov/c/gh/unjs/c11/main?style=flat-square
[codecov-href]: https://codecov.io/gh/unjs/c11
