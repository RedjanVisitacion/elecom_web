#!/bin/sh
set -eu
repo=$(git rev-parse --show-toplevel)
if [ "$repo" != "/var/www/elecom" ]; then
    echo "Run this setup in /var/www/elecom on the production server." >&2
    exit 1
fi
cd "$repo"
existing=$(git config --get core.hooksPath || true)
if [ -n "$existing" ] && [ "$existing" != "deploy/hooks" ]; then
    echo "Existing custom Git hooks path detected; setup stopped to preserve it: $existing" >&2
    exit 1
fi
if [ -z "$existing" ] && [ -f .git/hooks/post-merge ]; then
    echo "An existing post-merge hook was found; setup stopped to preserve it." >&2
    exit 1
fi
chmod +x deploy/hooks/post-merge
git config core.hooksPath deploy/hooks
echo "Enabled. Future successful git pull merges will collect static files and restart Gunicorn."
