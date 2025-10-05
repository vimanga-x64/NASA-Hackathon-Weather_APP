import json
import time
import datetime as dt
from openai import OpenAI
from dotenv import load_dotenv
load_dotenv()
import os
from typing import Dict, List, Optional
import requests
import pandas as pd
import numpy as np
from dateutil.relativedelta import relativedelta


API_KEY = os.getenv("OPENAI_API_KEY")
if not API_KEY:
    raise RuntimeError("OPENAI_API_KEY is not set. Set it via environment or .env file!")



client = OpenAI(api_key=API_KEY)

POWER_BASE = "https://power.larc.nasa.gov/api"

FRONTEND_TO_POWER = {
    "temperature": ["T2M", "T2M_MAX", "T2M_MIN"],
    "precipitation": ["PRECTOTCORR"],
    "wind": ["WS10M"],
    "humidity": ["RH2M"],
    "clouds": ["CLOUD_AMT", "ALLSKY_SFC_SW_DWN", "CLRSKY_SFC_SW_DWN"],
    "pressure": ["PS"],
    "uvindex": ["ALLSKY_SFC_UV_INDEX"],
    "visibility": ["ALLSKY_KT"],
}

FRONTEND_LABELS = {
    "temperature": "Temperature",
    "precipitation": "Precipitation",
    "wind": "Wind Speed",
    "humidity": "Humidity",
    "clouds": "Cloud Cover",
    "visibility": "Visibility",
    "pressure": "Pressure",
    "uvindex": "UV Index",
}

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
- IDEAL: all conditions within comfort thresholds
- CAUTION: minor or borderline issues
- NOT IDEAL: significant safety/weather limitations
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
  "rating": "IDEAL|CAUTION|NOT_IDEAL", // only one rating for all activities
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

def _datestr(d: dt.date) -> str:
    return d.strftime("%Y%m%d")

def _mode1(s: pd.Series) -> Optional[float]:
    m = s.dropna().mode()
    return None if m.empty else float(m.iloc[0])

def _stats(s: pd.Series) -> Dict[str, Optional[float]]:
    s = s.dropna()
    return {
        "mean": float(s.mean()) if not s.empty else None,
        "mode": _mode1(s),
        "min": float(s.min()) if not s.empty else None,
        "max": float(s.max()) if not s.empty else None,
    }

def _fetch_power_data(lat, lon, start, end, params, timeout=30):
    url = f"{POWER_BASE}/temporal/daily/point"
    response = requests.get(
        url,
        params={
            "parameters": ",".join(params),
            "community": "RE",
            "longitude": lon,
            "latitude": lat,
            "start": start,
            "end": end,
            "format": "JSON",
        },
        timeout=timeout,
    )
    response.raise_for_status()
    data = response.json()["properties"]["parameter"]
    df = pd.DataFrame({k: pd.Series(v) for k, v in data.items()})
    df.index = pd.to_datetime(df.index, format="%Y%m%d")
    return df

def _window_by_doy(df: pd.DataFrame, target_date: dt.date, window: int) -> pd.DataFrame:
    doy = df.index.dayofyear
    center = target_date.timetuple().tm_yday
    mask = (np.abs(doy - center) <= window) | (np.abs(doy + 366 - center) <= window)
    return df.loc[mask]

def get_weather_data(
    lat: float,
    lon: float,
    date_iso: str,
    frontend_params: List[str],
    years_back: int = 20,
    window_days: int = 7,
) -> Dict:
    try:
        target_date = dt.date.fromisoformat(date_iso)
    except Exception as e:
        raise ValueError("date_iso must be 'YYYY-MM-DD'") from e

    today = dt.date.today()
    start_date = max(dt.date(1981, 1, 1), today - relativedelta(years=years_back))

    power_params = []
    for p in frontend_params:
        power_params += FRONTEND_TO_POWER.get(p, [])
    power_params = list(dict.fromkeys(power_params))  # remove duplicates

    df = _fetch_power_data(lat, lon, _datestr(start_date), _datestr(today), power_params)
    win = _window_by_doy(df, target_date, window_days)

    results = {}
    for key in frontend_params:
        label = FRONTEND_LABELS.get(key, key)
        stats = {}
        for var in FRONTEND_TO_POWER.get(key, []):
            if var in win.columns:
                stats[var] = _stats(win[var])
        results[key] = {"label": label, "stats": stats}

    return {
        "location": {"lat": lat, "lon": lon},
        "date": date_iso,
        "parameters": frontend_params,
        "results": results,
        "note": "Historical averages based on NASA POWER data using ±DOY window.",
    }
