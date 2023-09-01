#!/usr/bin/env bash

source .env

echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc

BUILD_MODE=release yarn build
# yarn lerna publish from-package --yes
