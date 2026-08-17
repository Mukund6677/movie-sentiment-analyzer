# Deployment Notes

## Production fixes included

The movie collage is bundled at `client/public/movie-bg.jpg` and referenced by the application as `/movie-bg.jpg`. The temporary `/manus-storage/` movie background path is no longer used. The production build copies the image to `dist/public/movie-bg.jpg`.

The VADER runtime is reproducible for development and server deployments. `scripts/ensure_python_env.py` creates `.venv`, installs `requirements.txt`, and downloads the VADER lexicon. The server prefers `.venv/bin/python`, supports the `PYTHON_BIN` override, and falls back to `python3`. The Docker build installs NLTK and preloads the lexicon.

## Netlify hosting requirement

The repository currently builds a full Express/tRPC server and a Vite client. The client calls the analysis API at `/api/trpc`, while the CSV analysis procedure launches the Python VADER process from the Node server.

A Netlify deployment that publishes only `dist/public` is a static frontend deployment. It can serve the movie background and UI, but it cannot execute this repository's Express server, tRPC routes, database access, or Python subprocess. In that configuration, the CSV upload screen may render while analysis requests fail.

To run CSV analysis in production, deploy the complete Node/Python application using the included `Dockerfile` on a host that supports the server process, or add a separate production API host and configure the frontend to call it. If Netlify is retained for the frontend, use Netlify Functions or another backend service for `/api/trpc`; the function environment must also provide the database connection and a supported Python/VADER runtime. Keep `client/public/_redirects` and publish the frontend from `dist/public`.

## Verification checklist

Run:

```bash
pnpm test
pnpm run build
```

Then confirm that `dist/public/index.html`, `dist/public/movie-bg.jpg`, and `dist/public/_redirects` exist. Test CSV analysis against the deployed backend separately from the static frontend deployment.
