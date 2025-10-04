from flask import Flask, request, jsonify
import logging
from utils import get_recommendation, get_weather_data
from flask_cors import CORS

app = Flask(__name__)
CORS(app)
logging.basicConfig(level=logging.INFO)



# --- New Recommendation API ---
@app.route('/recommend', methods=['POST'])
def recommend():
    data = request.get_json()
    location = data.get('location')
    date = data.get('date')
    preferences = data.get('preferences')

    if not location or not date or not preferences:
        return jsonify({'error': 'Missing required fields'}), 400
    lat = location.get('latitude')
    lon = location.get('longitude')

    if not date or not preferences or lat is None or lon is None:
        return jsonify({'error': 'Missing required fields: location.latitude, location.longitude, date, preferences'}), 400

    try:
        weather_params = [
            "temperature", "precipitation", "wind", "humidity", 
            "clouds", "visibility", "pressure", "uvindex"
        ]
        
        weather = get_weather_data(
            lat=float(lat),
            lon=float(lon),
            date_iso=date,
            frontend_params=weather_params
        )
    except (ValueError, RuntimeError) as e:
        logging.error(f"Weather data error for location {location} on {date}: {e}")
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logging.error(f"Failed to get weather data: {e}")
        return jsonify({'error': 'An internal error occurred while fetching weather data'}), 500
    row = {
        "preferred_activities": preferences,
        "weather": weather
    }
    recommendation = get_recommendation(row)

    response = {
        "location": location,
        "date": date,
        "weather": weather,
        "recommendation": recommendation
    }
    return jsonify(response)



if __name__ == '__main__':
    try:
        app.run(debug=True, host="0.0.0.0", port=5000)
    except Exception as e:
        logging.error(f"Failed to start the Flask app: {str(e)}")
