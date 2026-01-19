import { IsInt, IsOptional, Min } from 'class-validator';

export class ItemDto {
  @IsInt()
  id_producto: number;

  @IsInt()
  @Min(1)
  cantidad: number;

  @IsOptional()
  notas?: string;
}
