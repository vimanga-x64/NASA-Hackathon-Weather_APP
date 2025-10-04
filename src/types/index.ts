export interface WeatherData {
    precipitation: number;
    snowfall: number;
    chanceOfSnow: number;
    temperature: number;
    windSpeed: number;
    visibility: number;
    humidity: number;
    clouds: number;
}

export interface Coordinates {
    lat: number;
    lon: number;
}

export interface ForecastData {
    dt: number;
    temp: number;
    feels_like: number;
    weather: {
        main: string;
        description: string;
        icon: string;
    }[];
    pop: number;
    snow?: {
        '3h': number;
    };
    rain?: {
        '3h': number;
    };
    wind_speed: number;
    visibility: number;
    humidity: number;
    clouds: number;
}

export interface ActivityRecommendation {
    activity: string;
    score: number;
    reasons: string[];
    warnings: string[];
}