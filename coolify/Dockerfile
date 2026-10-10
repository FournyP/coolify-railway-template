# Coolify control plane for Railway.
#
# No Docker-in-Docker, no /var/run/docker.sock. Coolify never builds an image:
# it pipes shell over SSH and the build runs on the target server inside
# coollabsio/coolify-helper. Upstream's compose mounts no docker socket and this
# image ships openssh-client and git but no docker client.
#
# The wrap exists for one reason: upstream delegates websocket path routing to
# Traefik, which Railway does not have, so the image's own nginx takes it over.
# Since 4.4 both websocket servers (Reverb and the terminal) run in this image.
#
# https://github.com/coollabsio/coolify

# https://hub.docker.com/r/coollabsio/coolify/tags - released versions only.
ARG COOLIFY_VERSION=4.4.6

FROM coollabsio/coolify:${COOLIFY_VERSION}

USER root

# Overwrites upstream's site config with the same config plus the two websocket
# locations.
COPY etc/nginx/site-opts.d/http.conf /etc/nginx/site-opts.d/http.conf

RUN chown -R www-data:www-data /etc/nginx

USER www-data

# Coolify's updater SSHes into Server::find(0) to run upgrade.sh - a server that
# does not exist on Railway, so it fails into Horizon on every cron tick instead
# of no-opping, and a fresh instance defaults the flag on. A platform fact, not a
# preference, so it is defaulted here rather than exposed. Still overridable.
ENV AUTOUPDATE=false

EXPOSE 8080

# ENTRYPOINT/CMD stay upstream's: the serversideup entrypoint runs
# /etc/entrypoint.d/* then hands off to s6, which runs migrations, seeders and
# app:init before supervising horizon, the scheduler, Reverb, the terminal
# server, php-fpm and nginx.
