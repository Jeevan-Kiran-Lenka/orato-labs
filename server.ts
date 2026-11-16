import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { getProviderAvailability, runModelBenchmark } from './server/providers.ts';
import type { BenchmarkRequestMeta } from './src/types/benchmark.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT ?? 3000);

  app.use(express.json({ limit: '25mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  app.get('/api/providers', (_req, res) => {
    res.json(getProviderAvailability());
  });

  app.post('/api/benchmark/run', async (req, res) => {
    try {
      const { runId, modelId, audioBase64, mimeType, meta } = req.body as {
        runId?: string;
        modelId?: string;
        audioBase64?: string;
        mimeType?: string;
        meta?: BenchmarkRequestMeta;
      };

      if (!runId || !modelId || !audioBase64 || !mimeType || !meta) {
        res.status(400).json({ error: 'Missing required fields: runId, modelId, audioBase64, mimeType, meta' });
        return;
      }

      const result = await runModelBenchmark({
        runId,
        modelId,
        audioBase64,
        mimeType,
        meta,
      });

      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Orato Lab server listening on http://localhost:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Orato Lab server:', err);
  process.exit(1);
});
