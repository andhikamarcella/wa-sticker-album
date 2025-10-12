const DIACRITICS_REGEX = /[\u0300-\u036f]/g;
const NON_ALPHANUMERIC_REGEX = /[^a-z0-9]+/g;
const MULTI_DASH_REGEX = /-{2,}/g;
const TRIM_DASH_REGEX = /(^-+|-+$)/g;

export function slugify(name: string): string {
  return name
    .trim()
    .normalize('NFKD')
    .replace(DIACRITICS_REGEX, '')
    .toLowerCase()
    .replace(NON_ALPHANUMERIC_REGEX, '-')
    .replace(MULTI_DASH_REGEX, '-')
    .replace(TRIM_DASH_REGEX, '');
}
