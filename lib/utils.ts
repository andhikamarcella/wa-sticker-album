import { twMerge } from 'tailwind-merge';

export function cn(...classes: Array<string | false | null | undefined>): string {
  const filtered = classes.filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
  return twMerge(...filtered);
}

const COUNT_UNITS = [
  { value: 1_000_000_000, suffix: 'B' },
  { value: 1_000_000, suffix: 'M' },
  { value: 1_000, suffix: 'K' },
] as const;

export function formatCount(n: number): string {
  if (!Number.isFinite(n)) {
    return '0';
  }

  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);

  for (const unit of COUNT_UNITS) {
    if (abs >= unit.value) {
      const scaled = abs / unit.value;
      const rounded = scaled >= 10 ? Math.round(scaled).toString() : scaled.toFixed(1).replace(/\.0$/, '');
      return `${sign}${rounded}${unit.suffix}`;
    }
  }

  if (abs >= 1) {
    return `${sign}${abs.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  }

  return `${sign}${abs.toPrecision(1)}`;
}

export function assertOk<T>(value: T, message = 'Unexpected null or undefined value'): T {
  if (value === null || value === undefined) {
    throw new Error(message);
  }

  return value;
}

const SUPABASE_SCHEMA_ERROR_PATTERN = /could not find the table 'public\./i;
const SUPABASE_RELATIONSHIP_ERROR_PATTERN = /relationship "[^"]+" does not exist/i;
const POSTGRES_UNDEFINED_TABLE_CODE = '42P01';

export class SupabaseSchemaMissingError extends Error {
  constructor(message?: string) {
    super(message ?? 'Supabase schema is missing required tables');
    this.name = 'SupabaseSchemaMissingError';
  }
}

export function shouldUseMockFromSupabaseError(error: unknown): boolean {
  if (!error) return false;

  const message = extractSupabaseErrorMessage(error);
  const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code?: unknown }).code ?? '') : '';
  const details = typeof error === 'object' && error !== null && 'details' in error ? String((error as { details?: unknown }).details ?? '') : '';

  if (code === POSTGRES_UNDEFINED_TABLE_CODE) {
    return true;
  }

  if (SUPABASE_SCHEMA_ERROR_PATTERN.test(message) || SUPABASE_SCHEMA_ERROR_PATTERN.test(details)) {
    return true;
  }

  if (SUPABASE_RELATIONSHIP_ERROR_PATTERN.test(message) || SUPABASE_RELATIONSHIP_ERROR_PATTERN.test(details)) {
    return true;
  }

  if (typeof error === 'object' && error !== null && 'hint' in error) {
    const hint = String((error as { hint?: unknown }).hint ?? '');
    if (SUPABASE_SCHEMA_ERROR_PATTERN.test(hint) || SUPABASE_RELATIONSHIP_ERROR_PATTERN.test(hint)) {
      return true;
    }
  }

  return false;
}

function extractSupabaseErrorMessage(error: unknown): string {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && 'message' in error) {
    const value = (error as { message?: unknown }).message;
    if (typeof value === 'string') return value;
  }
  return '';
}
