import { IsNotEmpty, IsString } from 'class-validator';

export class Esp32ConnectionDto {
  @IsNotEmpty()
  @IsString()
  device: string;

  @IsNotEmpty()
  @IsString()
  ssid: string;

  @IsNotEmpty()
  @IsString()
  ip: string;
}
