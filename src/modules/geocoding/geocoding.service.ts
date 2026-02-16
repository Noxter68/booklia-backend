import { Injectable } from '@nestjs/common';

export interface AddressSuggestion {
  label: string;
  address: string;
  city: string;
  postalCode: string;
  latitude: number;
  longitude: number;
}

interface GovApiFeature {
  properties: {
    label: string;
    name: string;
    city: string;
    postcode: string;
    context: string;
  };
  geometry: {
    coordinates: [number, number]; // [longitude, latitude]
  };
}

interface GovApiResponse {
  features: GovApiFeature[];
}

@Injectable()
export class GeocodingService {
  private readonly API_URL = 'https://api-adresse.data.gouv.fr';

  async searchAddress(query: string, limit = 5): Promise<AddressSuggestion[]> {
    if (!query || query.length < 3) {
      return [];
    }

    try {
      const url = `${this.API_URL}/search/?q=${encodeURIComponent(query)}&limit=${limit}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data: GovApiResponse = await response.json();

      return data.features.map((feature) => ({
        label: feature.properties.label,
        address: feature.properties.name,
        city: feature.properties.city,
        postalCode: feature.properties.postcode,
        latitude: feature.geometry.coordinates[1],
        longitude: feature.geometry.coordinates[0],
      }));
    } catch (error) {
      console.error('Geocoding search error:', error);
      return [];
    }
  }

  async reverseGeocode(
    latitude: number,
    longitude: number,
  ): Promise<AddressSuggestion | null> {
    try {
      const url = `${this.API_URL}/reverse/?lat=${latitude}&lon=${longitude}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data: GovApiResponse = await response.json();

      if (data.features.length === 0) {
        return null;
      }

      const feature = data.features[0];
      return {
        label: feature.properties.label,
        address: feature.properties.name,
        city: feature.properties.city,
        postalCode: feature.properties.postcode,
        latitude: feature.geometry.coordinates[1],
        longitude: feature.geometry.coordinates[0],
      };
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return null;
    }
  }
}
