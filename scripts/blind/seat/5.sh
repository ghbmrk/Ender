#!/bin/sh
# Seat 5 of a parallel round: same as play.sh, on driver port 7785.
BLIND_PORT=7785 exec "$(dirname "$0")/../play.sh" "$@"
