import { z } from 'zod';

const normalizeOptional = (value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
};

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  TMDB_API_KEY: z.string().min(1, 'TMDB_API_KEY is required'),
  STRIPE_SECRET_KEY: z.string().min(1, 'STRIPE_SECRET_KEY is required'),
  STRIPE_WEBHOOK_SECRET: z.string().min(1, 'STRIPE_WEBHOOK_SECRET is required'),
  CLIENT_URL: z.preprocess(normalizeOptional, z.string().url().optional()),
  CORS_ORIGINS: z.preprocess(normalizeOptional, z.string().optional()),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(30),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  REDIS_URL: z.preprocess(normalizeOptional, z.string().url().optional()),
  SENTRY_DSN: z.preprocess(normalizeOptional, z.string().url().optional()),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.2),
  SKIP_DB_CONNECT: z
    .string()
    .optional()
    .transform((value) => value === 'true'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('Invalid environment configuration:');
  console.error(parsedEnv.error.flatten().fieldErrors);
  throw new Error('Environment validation failed. Check your .env file.');
}

export const env = parsedEnv.data;

export const getAllowedOrigins = () => {
  if (env.CORS_ORIGINS) {
    return env.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean);
  }

  if (env.CLIENT_URL) {
    return [env.CLIENT_URL];
  }

  return ['http://localhost:5173'];
};
