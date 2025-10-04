from flask import Flask, request, jsonify
from flask_cors import CORS
import logging
import requests
import os
from utils import get_recommendation

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Get OpenWeatherMap API key from environment
OPENWEATHER_API_KEY = os.environ.get('OPENWEATHER_API_KEY', 'your_openweather_api_key_here')


def get_weather_data(date, location):
    """
    Fetch REAL weather data from OpenWeatherMap API
    """
    try:
        lat = location.get('latitude')
        lon = location.get('longitude')
        
        logger.info(f"Fetching weather for lat={lat}, lon={lon}")
        
        # OpenWeatherMap Current Weather API
        url = "https://api.openweathermap.org/data/2.5/weather"
        params = {
            'lat': lat,
            'lon': lon,
            'appid': OPENWEATHER_API_KEY,
            'units': 'metric'  # Celsius
        }
        
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        logger.info(f"Weather API response: {data.get('name', 'Unknown')}, {data['main']['temp']}°C")
        
        # Extract weather information
        weather = {
            "temp": round(data['main']['temp'], 1),
            "feels_like": round(data['main']['feels_like'], 1),
            "precipitation": data.get('rain', {}).get('1h', 0) + data.get('snow', {}).get('1h', 0),
            "wind": round(data['wind']['speed'] * 3.6, 1),  # m/s to km/h
            "cloud_cover": data['clouds']['all'],
            "humidity": data['main']['humidity'],
            "pressure": data['main']['pressure'],
            "visibility": data.get('visibility', 10000) / 1000,  # meters to km
            "description": data['weather'][0]['description'],
            "main": data['weather'][0]['main'],
            "location_name": data.get('name', 'Unknown')
        }
        
        return weather
        
    except Exception as e:
        logger.error(f"Weather API error: {e}")
        # Fallback to dummy data if API fails
        logger.warning("Using fallback weather data")
        return {
            "temp": 22,
            "feels_like": 22,
            "precipitation": 0,
            "wind": 5,
            "cloud_cover": 20,
            "humidity": 50,
            "pressure": 1013,
            "visibility": 10,
            "description": "clear sky",
            "main": "Clear",
            "location_name": "Unknown"
        }


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok', 'message': 'Server is running'}), 200


@app.route('/recommend', methods=['POST', 'OPTIONS'])
def recommend():
    """Recommendation API endpoint"""
    # Handle preflight CORS request
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        data = request.get_json()
        location = data.get('location')
        date = data.get('date')
        preferences = data.get('preferences')

        if not location or not date or not preferences:
            return jsonify({'error': 'Missing required fields'}), 400

        logger.info(f"Request: {preferences} at {location}")
        
        # Get real weather data
        weather = get_weather_data(date, location)
        
        # Prepare data for OpenAI recommendation
        row = {
            "preferred_activities": preferences,
            "weather": weather
        }
        
        # Get AI recommendation
        logger.info("Calling OpenAI for recommendation...")
        recommendation = get_recommendation(row)

        if not recommendation:
            return jsonify({'error': 'Failed to generate recommendation'}), 500

        response = {
            "location": location,
            "date": date,
            "weather": weather,
            "recommendation": recommendation
        }
        
        logger.info(f"Recommendation: {recommendation.get('rating', 'N/A')}")
        return jsonify(response), 200
        
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@app.after_request
def after_request(response):
    """Add CORS headers to every response"""
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response


if __name__ == '__main__':
    try:
        logger.info("🚀 Starting Flask server on http://0.0.0.0:5000")
        logger.info(f"📡 OpenWeatherMap API: {'✓ Configured' if OPENWEATHER_API_KEY != 'your_openweather_api_key_here' else '⚠️ Using dummy data'}")
        app.run(debug=True, host="0.0.0.0", port=5000)
    except Exception as e:
        logger.error(f"Failed to start the Flask app: {str(e)}")