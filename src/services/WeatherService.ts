import { config } from '../utils/config';
import type { WeatherData, ForecastData, Coordinates } from '../types';

export class WeatherService {
    private apiKey: string;
    private baseUrl: string;

    constructor() {
        this.apiKey = config.openWeatherMapKey;
        this.baseUrl = config.weatherApiBase;
    }

    async getCurrentWeather(coords: Coordinates): Promise<WeatherData> {
        try {
            const response = await fetch(
                `${this.baseUrl}/weather?lat=${coords.lat}&lon=${coords.lon}&appid=${this.apiKey}&units=imperial`
            );
            
            if (!response.ok) {
                throw new Error('Failed to fetch weather data');
            }

            const data = await response.json();
            return this.parseWeatherData(data);
        } catch (error) {
            console.error('Error fetching weather:', error);
            throw error;
        }
    }

    async getForecast(coords: Coordinates): Promise<ForecastData[]> {
        try {
            const response = await fetch(
                `${this.baseUrl}/forecast?lat=${coords.lat}&lon=${coords.lon}&appid=${this.apiKey}&units=imperial`
            );
            
            if (!response.ok) {
                throw new Error('Failed to fetch forecast data');
            }

            const data = await response.json();
            return data.list as ForecastData[];
        } catch (error) {
            console.error('Error fetching forecast:', error);
            throw error;
        }
    }

    private parseWeatherData(data: any): WeatherData {
        return {
            temperature: Math.round(data.main.temp),
            precipitation: data.clouds.all,
            snowfall: data.snow?.['1h'] || 0,
            chanceOfSnow: this.calculateSnowChance(data.main.temp, data.clouds.all),
            windSpeed: Math.round(data.wind.speed),
            visibility: Math.round(data.visibility / 1609.34),
            humidity: data.main.humidity,
            clouds: data.clouds.all
        };
    }

    private calculateSnowChance(temp: number, clouds: number): number {
        if (temp > 35) return 0;
        if (temp < 20 && clouds > 70) return 90;
        if (temp < 32 && clouds > 50) return 60;
        return 30;
    }

    getWeatherTileUrl(layer: 'precipitation' | 'clouds' | 'temp' | 'wind'): string {
        return `${config.weatherMapBase}/${layer}_new/{z}/{x}/{y}.png?appid=${this.apiKey}`;
    }
}