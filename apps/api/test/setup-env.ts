// e2e: deterministic strategy and instant broker replies.
process.env.AI_STRATEGY = 'rules';
process.env.BROKER_SIM_DELAY_MS = '0';
// Own queue namespace so a running `npm run dev` worker never steals test jobs.
process.env.QUEUE_PREFIX = 'bull-e2e';
// Every e2e request comes from one IP; keep the auth rate limit out of the way.
process.env.AUTH_RATE_LIMIT_PER_MINUTE = '10000';
