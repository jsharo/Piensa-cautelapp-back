export const PASSWORD_RESET_MAILER = Symbol('PASSWORD_RESET_MAILER');

export interface PasswordResetMailer {
  canSend(): boolean;
  sendPasswordResetEmail(email: string, code: string, userName?: string): Promise<boolean>;
}
