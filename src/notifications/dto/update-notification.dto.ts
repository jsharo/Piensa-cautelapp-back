import { PartialType } from '@nestjs/mapped-types';
import { CreateNotificationDto } from './create-notification.dto';

// No hay campo estado en el nuevo schema
export class UpdateNotificationDto extends PartialType(CreateNotificationDto) {}
