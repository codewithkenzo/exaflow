import { z } from "zod";

const envSchema = z.object({
  EXA_API_KEY: z.string().min(1, "EXA_API_KEY is required"),
  WEBHOOK_SECRET: z.string().optional(),
  WEBHOOK_URL: z.string().url().optional(),
  DEFAULT_TIMEOUT_MS: z.number().positive().default(30000),
  MAX_RETRIES: z.number().int().min(0).max(10).default(3),
  CONCURRENCY_LIMIT: z.number().int().min(1).max(20).default(5),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

export function loadEnv(): Env {
  if (cachedEnv) {
    return cachedEnv;
  }

  // Try to load .env file if it exists
  try {
    const fs = require('fs');
    const path = require('path');
    const envPath = path.join(process.cwd(), '.env');
    
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      envContent.split('\n').forEach((line: string) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const [key, ...values] = trimmed.split('=');
          const value = values.join('=');
          if (key && value) {
            process.env[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
          }
        }
      });
    }
  } catch (error) {
    // Ignore .env loading errors, process.env might be set directly
  }

  const result = envSchema.safeParse(process.env);
  
  if (!result.success) {
    // Secure logging - don't expose sensitive environment variables
    const errors = result.error.issues.map((err: any) => `${err.path.join('.')}: ${err.message}`).join(', ') || 'Unknown validation error';

    // Log validation errors without exposing sensitive data
    if (process.env.NODE_ENV === 'development') {
      console.error('Environment validation failed in development mode');
      console.error('Validation errors:', errors);
      // Only in development, show which env vars are expected (not their values)
      console.error('Expected environment variables:', envSchema.keyof().options);
    } else {
      console.error('Environment configuration is invalid');
      console.error('Please check your environment variables');
    }

    throw new Error(`Environment validation failed: ${errors}`);
  }

  cachedEnv = result.data;
  return cachedEnv;
}

export function getEnv(): Env {
  if (!cachedEnv) {
    throw new Error("Environment not loaded. Call loadEnv() first.");
  }
  return cachedEnv;
}
