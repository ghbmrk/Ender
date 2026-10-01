#!/bin/sh
# Seat 2 of a parallel round: same as play.sh, on driver port 7779.
BLIND_PORT=7779 exec "$(dirname "$0")/../play.sh" "$@"
