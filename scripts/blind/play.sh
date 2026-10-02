#!/bin/sh
# play.sh <command> [key=value ...]   e.g. play.sh tap x=200 y=700 | play.sh taptext t=Begin | play.sh wait ms=800
c="$1"; shift; q=""
for a in "$@"; do q="$q&$(printf %s "$a" | sed 's/ /%20/g')"; done
curl -s "http://127.0.0.1:${BLIND_PORT:-7777}/$c?${q#&}"
