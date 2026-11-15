import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), '');
  const apiKey = environment.NASA_API_KEY || '';

  return {
    plugins: [{
      name: 'donki-sep-local-api',
      configureServer(server) {
        server.middlewares.use(async (request, response, next) => {
          const requestUrl = new URL(request.url || '/', 'http://localhost');
          if (requestUrl.pathname !== '/api/donki/sep') return next();

          const startDate = requestUrl.searchParams.get('startDate');
          const endDate = requestUrl.searchParams.get('endDate');
          const isDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
          response.setHeader('Cache-Control', 'no-store');
          response.setHeader('Content-Type', 'application/json; charset=utf-8');

          if (!isDate(startDate) || !isDate(endDate) || startDate > endDate) {
            response.statusCode = 400;
            response.end(JSON.stringify({ error: 'Provide valid startDate and endDate values in YYYY-MM-DD format.' }));
            return;
          }
          if (!apiKey) {
            response.statusCode = 500;
            response.end(JSON.stringify({ error: 'NASA API key is missing. Add NASA_API_KEY to .env.local and restart the dev server.' }));
            return;
          }

          const nasaUrl = new URL('https://api.nasa.gov/DONKI/SEP');
          nasaUrl.searchParams.set('startDate', startDate);
          nasaUrl.searchParams.set('endDate', endDate);
          nasaUrl.searchParams.set('api_key', apiKey);

          try {
            const nasaResponse = await fetch(nasaUrl);
            response.statusCode = nasaResponse.status;
            response.end(await nasaResponse.text());
          } catch {
            response.statusCode = 502;
            response.end(JSON.stringify({ error: 'Could not reach NASA DONKI. Check the dev server’s internet connection and try again.' }));
          }
        });
      }
    }]
  };
});
