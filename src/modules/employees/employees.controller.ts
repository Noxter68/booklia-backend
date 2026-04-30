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
  CreateEmployeeExceptionDto,
  ListEmployeeExceptionsDto,
} from './dto/employee.dto';
import { AuthGuard } from '../auth/auth.guard';
import { OptionalAuthGuard } from '../auth/optional-auth.guard';

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
  @UseGuards(OptionalAuthGuard)
  getAvailableSlots(@Req() req: any, @Query() dto: GetAvailableSlotsDto) {
    return this.employeesService.getAvailableSlots(dto, req.user?.id ?? null);
  }

  // Static path — must be declared before `:id` to avoid being shadowed
  @Delete('exceptions/:exceptionId')
  @UseGuards(AuthGuard)
  deleteException(
    @Req() req: any,
    @Param('exceptionId') exceptionId: string,
  ) {
    return this.employeesService.deleteException(req.user.id, exceptionId);
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

  // ============================================
  // EMPLOYEE EXCEPTIONS (closures / special hours)
  // ============================================

  @Get(':employeeId/exceptions')
  @UseGuards(AuthGuard)
  listExceptions(
    @Req() req: any,
    @Param('employeeId') employeeId: string,
    @Query() dto: ListEmployeeExceptionsDto,
  ) {
    return this.employeesService.listExceptions(req.user.id, employeeId, dto);
  }

  @Post(':employeeId/exceptions')
  @UseGuards(AuthGuard)
  createException(
    @Req() req: any,
    @Param('employeeId') employeeId: string,
    @Body() dto: CreateEmployeeExceptionDto,
  ) {
    return this.employeesService.createException(req.user.id, employeeId, dto);
  }
}
