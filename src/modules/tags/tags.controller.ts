import { Controller, Get, Query } from '@nestjs/common';
import { TagsService } from './tags.service';

@Controller('tags')
export class TagsController {
  constructor(private tagsService: TagsService) {}

  @Get('suggest')
  async suggest(@Query('q') query: string) {
    return this.tagsService.suggest(query);
  }
}
