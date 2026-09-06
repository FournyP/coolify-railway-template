# Coolify control plane for Railway.
#
# No Docker-in-Docker, no /var/run/docker.sock. Coolify never builds an image:
# it pipes shell over SSH and the build runs on the target server inside
# coollabsio/coolify-helper. Upstream's compose mounts no docker socket and this
# image ships openssh-client and git but no docker client.
#
# The wrap exists for one reason: upstream delegates websocket path routing to
# Traefik, which Railway does not have, so the image's own nginx takes it over.
#
# https://github.com/coollabsio/coolify

# https://hub.docker.com/r/coollabsio/coolify/tags - released versions only.
ARG COOLIFY_VERSION=4.3.17

FROM coollabsio/coolify:${COOLIFY_VERSION}

USER root

# railway-http.conf.template, not http.conf.template: the serversideup base
# image already owns that filename.
COPY etc/nginx/site-opts.d/railway-http.conf.template /etc/nginx/site-opts.d/railway-http.conf.template
COPY entrypoint.d/05-railway-realtime-proxy.sh /etc/entrypoint.d/05-railway-realtime-proxy.sh

RUN chmod 755 /etc/entrypoint.d/05-railway-realtime-proxy.sh && \
    chown -R www-data:www-data /etc/nginx

USER www-data

# Private DNS name of the realtime service.
ENV REALTIME_HOST=coolify-realtime.railway.internal

# Coolify's updater SSHes into Server::find(0) to run upgrade.sh - a server that
# does not exist on Railway, so it fails into Horizon on every cron tick instead
# of no-opping, and a fresh instance defaults the flag on. A platform fact, not a
# preference, so it is defaulted here rather than exposed. Still overridable.
ENV AUTOUPDATE=false

EXPOSE 8080

# ENTRYPOINT/CMD stay upstream's: the serversideup entrypoint runs
# /etc/entrypoint.d/* then hands off to s6, which runs migrations, seeders and
# app:init before supervising horizon, the scheduler, php-fpm and nginx.
