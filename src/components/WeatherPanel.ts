class WeatherPanel {
    private weatherData: any;

    constructor() {
        this.weatherData = null;
    }

    async fetchWeatherData(location: string): Promise<void> {
        const response = await WeatherService.getWeather(location);
        this.weatherData = response;
        this.displayWeather();
    }

    displayWeather(): void {
        if (this.weatherData) {
            // Code to update the UI with weather data
            console.log(`Weather in ${this.weatherData.location}: ${this.weatherData.temperature}°C`);
        } else {
            console.log("No weather data available.");
        }
    }
}

export default WeatherPanel;