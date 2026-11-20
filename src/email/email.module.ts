import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { PASSWORD_RESET_MAILER } from './password-reset-mailer';

@Module({
  providers: [
    EmailService,
    { provide: PASSWORD_RESET_MAILER, useExisting: EmailService },
  ],
  exports: [PASSWORD_RESET_MAILER],
})
export class EmailModule {}
