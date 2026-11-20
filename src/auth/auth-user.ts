export interface AuthenticatedUser {
  id_usuario: number;
  email: string;
  role?: string;
  token_version: number;
  sid?: string;
}

export interface JwtPayload {
  id_usuario?: unknown;
  sub?: unknown;
  email?: unknown;
  role?: unknown;
  tv?: unknown;
  sid?: unknown;
}

export function toAuthenticatedUser(payload: JwtPayload): AuthenticatedUser {
  const rawId = payload.id_usuario ?? payload.sub;
  const id_usuario = typeof rawId === 'number' ? rawId : Number(rawId);
  if (!Number.isInteger(id_usuario) || id_usuario <= 0) {
    throw new Error('Token sin id_usuario válido');
  }
  if (typeof payload.email !== 'string' || payload.email.length === 0) {
    throw new Error('Token sin email válido');
  }
  const token_version = typeof payload.tv === 'number' && Number.isInteger(payload.tv) && payload.tv >= 0
    ? payload.tv
    : 0;
  const sid = typeof payload.sid === 'string' && payload.sid.length > 0 ? payload.sid : undefined;
  return {
    id_usuario,
    email: payload.email,
    role: typeof payload.role === 'string' ? payload.role : undefined,
    token_version,
    sid,
  };
}
