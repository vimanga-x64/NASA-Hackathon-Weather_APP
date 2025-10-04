from openai import OpenAI
import json
import time
import os
from dotenv import load_dotenv
load_dotenv()


API_KEY = os.getenv("OPENAI_API_KEY")
if not API_KEY:
    raise RuntimeError("OPENAI_API_KEY is not set. Set it via environment or .env file!")
print(f"API_KEY: ...{API_KEY[-10:]}")



client = OpenAI(api_key=API_KEY)

def get_recommendation(row):
    activity_list = row["preferred_activities"]
    weather_forecast = row["weather"]

    system_prompt = """
You are an outdoor-activity suitability assistant. 
You DO NOT forecast — you interpret the provided weather summary.
Be concise, practical, and safety-aware.
Always return a compact JSON object as described below.
Never add text outside the JSON.

Default heuristics (used only if no custom thresholds provided):
- Parade/Picnic: avoid precipitation ≥2 mm/day; wind <9 m/s; comfort ~0–28 °C.
- Hiking/Walking: avoid storms or heavy rain ≥5 mm/day; ok temp −5…30 °C; wind <12 m/s.
- Camping: avoid heavy rain ≥6 mm/day; wind <10 m/s; temp 0…28 °C.
- Canoe/Kayak/SUP: prefer wind ≤8 m/s; avoid thunderstorms; temp 10…28 °C; rain <5 mm/day.
- Sailing/Windsurf/Kitesurf: good wind 5–14 m/s; caution with gusts >14 m/s or storms.
- Cycling: avoid heavy rain ≥5 mm/day and gusts >14 m/s; temp −2…32 °C.
- Running: avoid thunderstorms; temp −5…30 °C; humidex/heat index >32 °C ⇒ caution.
- Alpine/Cross-country Skiing/Snowshoeing: prefer snow depth ≥10 cm or snow cover ≥50%; ok temp ≤2 °C; wind chill ≤ −20 °C ⇒ caution/no-go.
- Photography/Stargazing: prefer cloud cover <40%; wind <10 m/s; no precipitation.
- Fishing: light wind <8 m/s; avoid thunderstorms; light rain is tolerable.

RATING rules:
- GO: all conditions within comfort thresholds
- CAUTION: minor or borderline issues
- NO-GO: significant safety/weather limitations
"""

    user_prompt = f'''
Evaluate the suitability of each preferred activity given the weather data.

Input JSON:
{{
  "preferred_activities": {json.dumps(activity_list, ensure_ascii=False)},
  "weather": {json.dumps(weather_forecast, ensure_ascii=False)}
}}

Output STRICTLY as JSON with these keys:
{{
  "rating": "IDEAL|EXERCISE CAUTION|NOT IDEAL", // only one rating for all activities
  "why": ["<=12 words", "<=12 words"],  // one for each activity
  "alternatives": ["<=3 words", "<=3 words"],
  "one_liner": "<=22 words summary in English"
}}
'''

    for attempt in range(3):
        try:
            response = client.chat.completions.create(
                model="gpt-5-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
            )

            answer = response.choices[0].message.content.strip()

            # attempt to extract JSON
            json_start = answer.find("{")
            json_end = answer.rfind("}") + 1
            answer_json = answer[json_start:json_end]
            result = json.loads(answer_json)
            return result

        except Exception as e:
            print(f"Error (attempt {attempt+1}): {e}")
            time.sleep(4 * (attempt + 1))
    return None