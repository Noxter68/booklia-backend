import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { EmployeesService } from './employees.service';
import {
  CreateEmployeeDto,
  UpdateEmployeeDto,
  GetAvailableSlotsDto,
} from './dto/employee.dto';
import { AuthGuard } from '../auth/auth.guard';

@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  @UseGuards(AuthGuard)
  create(@Req() req: any, @Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(req.user.id, dto);
  }

  @Get('business/:businessId')
  findByBusiness(@Param('businessId') businessId: string) {
    return this.employeesService.findByBusiness(businessId);
  }

  @Get('slots')
  getAvailableSlots(@Query() dto: GetAvailableSlotsDto) {
    return this.employeesService.getAvailableSlots(dto);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.employeesService.findById(id);
  }

  @Put(':id')
  @UseGuards(AuthGuard)
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.employeesService.update(req.user.id, id, dto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  delete(@Req() req: any, @Param('id') id: string) {
    return this.employeesService.delete(req.user.id, id);
  }
}
