import { Controller, Get, Query } from '@nestjs/common';
import { GeocodingService } from './geocoding.service';

@Controller('geocoding')
export class GeocodingController {
  constructor(private readonly geocodingService: GeocodingService) {}

  @Get('search')
  async search(
    @Query('q') query: string,
    @Query('limit') limit?: string,
  ) {
    const suggestions = await this.geocodingService.searchAddress(
      query,
      limit ? parseInt(limit, 10) : 5,
    );
    return { suggestions };
  }

  @Get('reverse')
  async reverse(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
  ) {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (isNaN(latitude) || isNaN(longitude)) {
      return { address: null };
    }

    const address = await this.geocodingService.reverseGeocode(latitude, longitude);
    return { address };
  }
}
