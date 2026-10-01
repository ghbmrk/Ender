#!/bin/sh
# Seat 1 of a parallel round: same as play.sh, on driver port 7777.
BLIND_PORT=7777 exec "$(dirname "$0")/../play.sh" "$@"
