import type { WeatherData, ActivityRecommendation } from '../types';

export class ActivityService {
    getAvailableActivities(): string[] {
        return ['hiking', 'skiing', 'camping', 'cycling'];
    }

    evaluateActivity(activity: string, weather: WeatherData): ActivityRecommendation {
        switch (activity) {
            case 'hiking':
                return this.evaluateHiking(weather);
            case 'skiing':
                return this.evaluateSkiing(weather);
            case 'camping':
                return this.evaluateCamping(weather);
            case 'cycling':
                return this.evaluateCycling(weather);
            default:
                return {
                    activity,
                    score: 50,
                    reasons: [],
                    warnings: []
                };
        }
    }

    private evaluateHiking(weather: WeatherData): ActivityRecommendation {
        let score = 100;
        const reasons: string[] = [];
        const warnings: string[] = [];

        if (weather.temperature >= 50 && weather.temperature <= 75) {
            reasons.push('Perfect temperature for hiking');
        } else if (weather.temperature < 40) {
            score -= 20;
            warnings.push('Cold weather - dress warmly');
        } else if (weather.temperature > 85) {
            score -= 15;
            warnings.push('Hot weather - bring extra water');
        }

        if (weather.precipitation > 50) {
            score -= 30;
            warnings.push('High chance of rain');
        }

        if (weather.windSpeed > 20) {
            score -= 15;
            warnings.push('Strong winds expected');
        }

        if (weather.visibility > 5) {
            reasons.push('Excellent visibility');
        } else {
            score -= 10;
            warnings.push('Reduced visibility');
        }

        return { activity: 'hiking', score: Math.max(0, score), reasons, warnings };
    }

    private evaluateSkiing(weather: WeatherData): ActivityRecommendation {
        let score = 100;
        const reasons: string[] = [];
        const warnings: string[] = [];

        if (weather.temperature >= 15 && weather.temperature <= 32) {
            reasons.push('Perfect skiing temperature');
            score += 10;
        } else if (weather.temperature > 35) {
            score -= 40;
            warnings.push('Too warm - snow may be slushy');
        } else if (weather.temperature < 0) {
            score -= 20;
            warnings.push('Extremely cold - dress in layers');
        }

        if (weather.snowfall > 6) {
            reasons.push('Fresh powder!');
            score += 15;
        } else if (weather.snowfall > 2) {
            reasons.push('Recent snowfall');
        } else {
            score -= 10;
        }

        if (weather.windSpeed > 25) {
            score -= 25;
            warnings.push('High winds - lifts may be closed');
        }

        if (weather.visibility < 3) {
            score -= 30;
            warnings.push('Poor visibility - whiteout conditions possible');
        }

        return { activity: 'skiing', score: Math.max(0, score), reasons, warnings };
    }

    private evaluateCamping(weather: WeatherData): ActivityRecommendation {
        let score = 100;
        const reasons: string[] = [];
        const warnings: string[] = [];

        if (weather.temperature >= 55 && weather.temperature <= 75) {
            reasons.push('Comfortable camping weather');
        } else if (weather.temperature < 40) {
            score -= 25;
            warnings.push('Cold nights - bring warm sleeping bag');
        }

        if (weather.precipitation > 40) {
            score -= 35;
            warnings.push('Rain expected - ensure waterproof gear');
        }

        if (weather.windSpeed > 15) {
            score -= 20;
            warnings.push('Windy - secure tent properly');
        }

        return { activity: 'camping', score: Math.max(0, score), reasons, warnings };
    }

    private evaluateCycling(weather: WeatherData): ActivityRecommendation {
        let score = 100;
        const reasons: string[] = [];
        const warnings: string[] = [];

        if (weather.temperature >= 60 && weather.temperature <= 80) {
            reasons.push('Great cycling weather');
        } else if (weather.temperature > 90) {
            score -= 20;
            warnings.push('Very hot - stay hydrated');
        }

        if (weather.precipitation > 30) {
            score -= 40;
            warnings.push('Wet roads - reduced traction');
        }

        if (weather.windSpeed > 15) {
            score -= 15;
            warnings.push('Strong headwinds possible');
        }

        return { activity: 'cycling', score: Math.max(0, score), reasons, warnings };
    }
}