#!/usr/bin/env bash
# Builds and runs the engine-free rule tests. No Unreal install needed.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../.." && pwd)"
out="${TMPDIR:-/tmp}/ender-rule-tests"
cxx="${CXX:-g++}"
"$cxx" -std=c++20 -O2 -Wall -Wextra -Werror -Wno-unused-function \
  -I "$root/game/Source/Ender" \
  "$here"/*.cpp -o "$out"
"$out"
