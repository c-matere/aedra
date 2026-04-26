import { Injectable } from '@nestjs/common';

@Injectable()
export class ConsistencyValidatorService {
  async validatePostRead(name: string, data: any) {
    return { isValid: true, message: '' };
  }

  async validatePreWrite(name: string, args: any) {
    return { isValid: true, message: '' };
  }
}
