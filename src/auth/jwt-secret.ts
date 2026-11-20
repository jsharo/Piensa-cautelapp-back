const MIN_SECRET_LENGTH = 32;

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret || secret === 'change-me' || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      'JWT_SECRET debe estar definido, ser distinto de "change-me" y tener al menos 32 caracteres.',
    );
  }
  return secret;
}
