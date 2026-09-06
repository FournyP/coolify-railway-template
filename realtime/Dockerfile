# soketi (:6001) and the browser terminal server (:6002). Private service; the
# coolify service's nginx proxies /app and /terminal/ws to it.
#
# https://github.com/coollabsio/coolify/tree/main/docker/coolify-realtime

# Keep in sync with "realtime" in https://cdn.coollabs.io/coolify/versions.json
ARG REALTIME_VERSION=1.0.18

FROM coollabsio/coolify-realtime:${REALTIME_VERSION}

# Upstream defaults to 0.0.0.0; Railway's private network is IPv6. The terminal
# server needs no equivalent - server.listen(6002) with no host is dual-stack.
ENV SOKETI_HOST="::"

EXPOSE 6001 6002
