# Activity-Based Weather Recommendation App

This is a web application that provides personalized activity recommendations based on weather conditions. It combines an interactive map using NASA's Blue Marble and MODIS satellite imagery with a Python-based backend to generate predictions for user-selected activities.

## Features

- **Interactive Map**: Utilizes Leaflet.js to display an interactive map with OpenStreetMap, NASA Blue Marble, and NASA MODIS layers.
- **Weather Layer Overlays**: Drag-and-drop weather widgets (Temperature, Precipitation, Wind, etc.) onto the map to tailor the weather to predict.
- **Location Search**: Search for any location worldwide using the Nominatim API.
- **Activity-Based Predictions**: Select your preferred activities (e.g., hiking, running, stargazing) and get a detailed weather recommendation.
- **Detailed Recommendations**: The recommendation includes a rating (e.g., "Ideal", "Moderate", "Not Ideal"), a one-liner summary, a breakdown of why the rating was given, and suggestions for alternative activities.
- **Python/Flask Backend**: A simple yet powerful backend that fetches weather data and uses a model to generate recommendations.

## Tech Stack

- **Frontend**:
  - TypeScript
  - Vite
  - Leaflet.js for mapping
  - Lucide Icons for UI elements

- **Backend**:
  - Python
  - Flask
  - `requests` for API calls

- **APIs Used**:
  - OpenWeatherMap (for weather layer tiles)
  - Nominatim (for geocoding/location search)
  - NASA GIBS (for satellite map layers)

## Prerequisites

Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v18 or later recommended)
- [Python](https://www.python.org/downloads/) (v3.8 or later recommended) and `pip`

## Setup and Installation

Follow these steps to get the application running locally.

**1. Clone the Repository**
```bash
git clone <repository-url>
cd NASA-Hackathon-Weather_APP
```

**2. Backend Setup**

First, set up the Python environment and install the required packages.

```bash
# Create and activate a virtual environment (recommended)
python -m venv venv
source venv/bin/activate  # On Windows, use `venv\Scripts\activate`

# Install Python dependencies
pip install -r requirements.txt
```

**3. Frontend Setup**

Next, set up the Node.js environment and install the required packages.

```bash
# Install frontend dependencies
npm install
```

**4. Environment Configuration**

The application requires API keys for the OpenAI backend service.

1.  **Create Environment File**: In the root of the project, create a new file named `.env` by copying the example file.
    ```bash
    touch .env
    ```

2.  **Add API Keys**: Open the new `.env` file in your editor.
    -   Get an **OpenAI API Key** by signing up at [OpenAI](https://platform.openai.com/).

3.  **Update the `.env` file** with your keys:
    ```ini
    # For the backend (recommendation engine)
    OPENAI_API_KEY="your_openai_api_key_here"
    ```

The backend (`utils.py`) is already configured to load the `OPENAI_API_KEY`. The frontend (`src/main.ts`) is configured to load the `VITE_OPENWEATHERMAP_API_KEY`. Vite automatically makes environment variables prefixed with `VITE_` available in the frontend code.

## Running the Application

You need to run both the backend server and the frontend server in separate terminal sessions.

**1. Start the Backend Server**

In your first terminal, with the Python virtual environment activated:
```bash
python app.py
```
The Flask server will start on `http://localhost:5000`.

**2. Start the Frontend Server**

In your second terminal:
```bash
npm run dev
```
The Vite development server will start, and you can access the application at `http://localhost:5173` (or another port if 5173 is in use).

## How to Use

1.  **Search for a Location**: Use the search bar at the top of the sidebar to find a location.
2.  **Select Date and Time**: Choose the date for which you want a prediction.
3.  **Choose Activities**: Use the "Activities" dropdown to select one or more activities you are interested in.
4.  **Get Prediction**: Click the "Predict" button.
5.  **View Recommendation**: A recommendation card will appear in the sidebar with a rating, weather details, and reasons for the prediction.
6.  **Explore Map Layers**: Drag weather widgets from the "Weather Widgets" section onto the map to see live data overlays. Active layers can be managed in the "Active Widgets" list.
