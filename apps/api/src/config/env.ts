import { z } from 'zod';

// Environment is validated once at boot: the api refuses to start with a
// missing or malformed variable instead of failing later at runtime.
const isLocal = (url: string) =>
  /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(url);

const baseEnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  /** BullMQ (negotiation jobs). */
  REDIS_URL: z.url().default('redis://localhost:6380'),
  /** BullMQ key prefix; isolates environments sharing a Redis (e.g. tests vs dev). */
  QUEUE_PREFIX: z.string().default('bull'),
  /**
   * Negotiation strategy: `claude` (LLM), `rules` (deterministic) or `auto`
   * (claude when Anthropic credentials are configured, else rules).
   */
  AI_STRATEGY: z.enum(['auto', 'claude', 'rules']).default('auto'),
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default('claude-opus-5-5'),
  AI_EFFORT: z.enum(['low', 'medium', 'high']).default('medium'),
  /** Simulated broker reply delay (ms). 0 in tests. */
  BROKER_SIM_DELAY_MS: z.coerce.number().int().min(0).default(4000),
  /** Optional Expo access token for push (required if "enhanced security" is on in Expo). */
  EXPO_ACCESS_TOKEN: z.string().optional(),
  /** S3-compatible storage for trip documents (SeaweedFS locally, S3/R2 in prod). */
  S3_ENDPOINT: z.url().optional(),
  /**
   * Host clients use for presigned URLs (phones can't reach "localhost").
   * Defaults to S3_ENDPOINT. On a physical device use your LAN IP.
   */
  S3_PUBLIC_ENDPOINT: z.url().optional(),
  S3_REGION: z.string().default('ca-central-1'),
  S3_BUCKET: z.string().default('dispatcher-documents'),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: z.stringbool().default(true),
  /**
   * Max attempts per minute and client IP on the public credential endpoints
   * (register, login, accept invitation). Stops password guessing and signup
   * spam. Raised in e2e, where every request comes from one IP.
   */
  AUTH_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(10),
  /** Public URL of the web admin (invitation links). */
  WEB_URL: z.url().default('http://localhost:3000'),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((v) =>
      v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
});

// Production must never fall back to the localhost defaults: invitation links
// and CORS would silently point at a developer machine.
export const envSchema = baseEnvSchema.superRefine((env, ctx) => {
  if (env.NODE_ENV !== 'production') return;
  if (isLocal(env.WEB_URL) || !env.WEB_URL.startsWith('https://'))
    ctx.addIssue({
      code: 'custom',
      path: ['WEB_URL'],
      message: 'must be the public https URL in production',
    });
  if (env.CORS_ORIGINS.some((o) => isLocal(o) || !o.startsWith('https://')))
    ctx.addIssue({
      code: 'custom',
      path: ['CORS_ORIGINS'],
      message: 'must list only public https origins in production',
    });
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${details}`);
  }
  return parsed.data;
}
