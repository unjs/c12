#!/bin/sh

cd "$(dirname "$0")"

hyperfine "node ./c12-v3.mjs" "node ./c12-v4.mjs"
