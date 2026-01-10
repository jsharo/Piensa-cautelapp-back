import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

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

  @IsNotEmpty()
  @IsString()
  username: string;
}
