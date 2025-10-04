# Weather Forecast Application

This project is a weather forecast web application that utilizes NASA's maps, similar to Worldview. It provides users with an interactive interface to view weather data alongside satellite imagery.

## Project Structure

```
weather-forecast-app
├── src
│   ├── index.html          # Main HTML entry point
│   ├── main.ts             # Main TypeScript entry point
│   ├── styles
│   │   └── main.css        # Main styles for the application
│   ├── components
│   │   ├── Map.ts          # Handles rendering of NASA's maps
│   │   ├── WeatherPanel.ts  # Displays weather information
│   │   └── LayerControl.ts  # Manages map layer visibility
│   ├── services
│   │   ├── NasaMapService.ts # Interacts with NASA's map API
│   │   └── WeatherService.ts  # Interacts with weather API
│   ├── utils
│   │   └── config.ts       # Configuration constants and settings
│   └── types
│       └── index.ts        # TypeScript interfaces and types
├── public
│   └── index.html          # Static HTML file for deployment
├── package.json             # npm configuration file
├── tsconfig.json            # TypeScript configuration file
├── vite.config.ts           # Vite configuration file
└── README.md                # Project documentation
```

## Setup Instructions

1. **Clone the repository:**
   ```
   git clone <repository-url>
   cd weather-forecast-app
   ```

2. **Install dependencies:**
   ```
   npm install
   ```

3. **Run the application:**
   ```
   npm run dev
   ```

4. **Open your browser:**
   Navigate to `http://localhost:3000` to view the application.

## Usage Guidelines

- Use the map component to explore NASA's satellite imagery.
- The weather panel displays current weather conditions based on your selected location.
- The layer control allows you to toggle different map layers for a customized view.

## Contributing

Feel free to submit issues or pull requests to improve the application. Your contributions are welcome!