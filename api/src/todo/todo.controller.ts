import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Req,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { TodoService } from './todo.service';
import { TodoSchedulerService } from './todo-scheduler.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/roles.enum';

@Controller('todos')
@UseGuards(RolesGuard)
export class TodoController {
  constructor(
    private readonly todoService: TodoService,
    private readonly todoScheduler: TodoSchedulerService,
  ) {}

  @Get()
  async getTodos(@Req() req: any) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException();
    return this.todoService.listTodos(userId);
  }

  @Patch(':id/done')
  async markDone(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException();
    return this.todoService.markAsDone(id, userId);
  }

  @Post('trigger')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN) // Restrict to admins
  async triggerDaily() {
    await this.todoScheduler.triggerNow();
    return { message: 'Daily to-do task generation triggered.' };
  }
}
