import { IsNotEmpty, IsString, IsNumber, IsOptional } from 'class-validator';

export class Esp32ConnectionDto {
  @IsNotEmpty()
  @IsString()
  device: string;

  @IsNotEmpty()
  @IsString()
  status: string;

  @IsNotEmpty()
  @IsString()
  ssid: string;

  @IsNotEmpty()
  @IsNumber()
  rssi: number;

  @IsOptional()
  @IsString()
  ip?: string;

  @IsOptional()
  @IsString()
  mac_address?: string;
}
