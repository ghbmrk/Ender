#!/bin/sh
# Seat 4 of a parallel round: same as play.sh, on driver port 7783.
BLIND_PORT=7783 exec "$(dirname "$0")/../play.sh" "$@"
