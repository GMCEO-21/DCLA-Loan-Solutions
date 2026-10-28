import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class RepaymentSmsBatchDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  repaymentIds: string[];
}
