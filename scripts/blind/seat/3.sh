#!/bin/sh
# Seat 3 of a parallel round: same as play.sh, on driver port 7781.
BLIND_PORT=7781 exec "$(dirname "$0")/../play.sh" "$@"
