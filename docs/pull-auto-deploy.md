# Deploy using git pull

Once these scripts have been committed, pushed, and pulled onto the production server,
run once from /var/www/elecom:

```bash
sh deploy/enable-pull-deploy.sh
```

After setup, the normal update command is:

```bash
git pull origin main
```

The post-merge hook collects static files and restarts Gunicorn after a successful merge.
It checks service health and reports deployment errors. It does not run outside the
production repository, change .env, apply database migrations, or resolve local edits.
For a release requiring migrations, follow that release's instructions separately.
An already-up-to-date pull does not trigger the hook. To rerun deployment without a merge,
run `sh deploy/hooks/post-merge`. Only pull reviewed, trusted release commits.
Existing custom hook configurations are preserved by refusing setup until manually integrated.
To disable: `git config --unset core.hooksPath`.
