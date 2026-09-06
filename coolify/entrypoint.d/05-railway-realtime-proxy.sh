#!/bin/sh
#
# Renders /etc/nginx/site-opts.d/http.conf so nginx proxies Coolify's two
# websocket paths to the realtime service.
#
# The 05- prefix is load-bearing: entrypoint scripts run through `sort -V`, and
# 10-init-webserver-config.sh only renders its own template when http.conf does
# not already exist.

set -eu

: "${REALTIME_HOST:=coolify-realtime.railway.internal}"

template="/etc/nginx/site-opts.d/railway-http.conf.template"
output="/etc/nginx/site-opts.d/http.conf"

if [ ! -f "$template" ]; then
    echo "🛑 ERROR (railway-realtime-proxy): $template is missing." >&2
    exit 1
fi

# nginx needs an explicit resolver to re-resolve a variable upstream.
NGINX_RESOLVER="$(awk '/^nameserver/ { print $2; exit }' /etc/resolv.conf 2>/dev/null || true)"
if [ -z "$NGINX_RESOLVER" ]; then
    echo "🛑 ERROR (railway-realtime-proxy): no nameserver in /etc/resolv.conf." >&2
    exit 1
fi

# IPv6 nameservers must be bracketed in the resolver directive.
case "$NGINX_RESOLVER" in
    *:*) NGINX_RESOLVER="[${NGINX_RESOLVER}]" ;;
esac

export NGINX_RESOLVER REALTIME_HOST

# The variable list is mandatory: without it envsubst also eats $http_upgrade,
# $host, $scheme and every other nginx variable.
envsubst '${NGINX_RESOLVER} ${REALTIME_HOST}' < "$template" > "${output}.tmp"
mv "${output}.tmp" "$output"

echo "(railway-realtime-proxy): /app and /terminal/ws proxy to ${REALTIME_HOST} (resolver ${NGINX_RESOLVER})."
