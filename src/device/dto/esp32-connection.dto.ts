import { IsNotEmpty, IsString, IsOptional, IsNumber } from 'class-validator';

export class Esp32ConnectionDto {
  @IsNotEmpty()
  @IsString()
  deviceId: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsNotEmpty()
  @IsString()
  ssid: string;

  @IsNotEmpty()
  @IsString()
  ip: string;

  @IsOptional()
  @IsNumber()
  rssi?: number;
}
