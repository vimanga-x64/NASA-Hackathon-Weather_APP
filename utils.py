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
  "rating": "GO|CAUTION|NO-GO", // only one rating for all activities
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

def get_weather_data(
    *,
    lat: float,
    lon: float,
    date_iso: str,
    frontend_params: list,           # e.g., ["temperature","precipitation","wind","humidity","clouds","visibility","pressure","uvindex"]
    years_back: int = 20,
    window_days: int = 7,
    community: str = "RE",
    include_percentiles: bool = False,
    timeout_s: int = 45,
) -> dict:
    """
    Fetch ~years_back of NASA POWER *daily* data for a point (lat, lon), filter to a ±window
    around the target date's day-of-year (DOY), and compute mean/mode/min/max per requested
    frontend parameter. Returns a JSON-ready dict suitable for passing to the LLM.

    Frontend parameter mapping:
      - "temperature"   → T2M, T2M_MAX, T2M_MIN
      - "precipitation" → PRECTOTCORR
      - "wind"          → WS10M
      - "humidity"      → RH2M
      - "clouds"        → CLOUD_AMT (or proxy from ALLSKY_SFC_SW_DWN / CLRSKY_SFC_SW_DWN)
      - "visibility"    → ALLSKY_KT (clearness index proxy; 0–1, higher = clearer)
      - "pressure"      → PS
      - "uvindex"       → ALLSKY_SFC_UV_INDEX

    Notes:
      - POWER requires no authentication.
      - If a mapped POWER variable is unavailable for the location/date range, its stats will be None.
      - Mode returns the first mode when multiple modes exist, else None if no mode.

    Returns (example):
      {
        "source": "NASA POWER (daily)",
        "location": {"lat": ..., "lon": ...},
        "target_date": "YYYY-MM-DD",
        "history_window": {"years_back": 20, "start": "YYYYMMDD", "end": "YYYYMMDD", "doy_window_days": 7},
        "parameters_requested": [...],
        "results": {
          "temperature": {
            "label": "Temperature",
            "unit": "°C (mean), °C (Tmax/Tmin)",
            "stats": {"mean": ..., "mode": ..., "min": ..., "max": ...},
            "components": {"tmax": {...}, "tmin": {...}}
          },
          "visibility": { "label":"Visibility", "unit":"index (ALLSKY_KT, 0–1; higher = clearer)", "stats": {...}, "note": "..."}
          ...
        },
        "percentiles": { ... } or None,
        "note": "Stats computed over ± day-of-year window across years. Historical info, not a forecast."
      }
    """
    # Local imports to keep this function drop-in friendly
    import datetime as dt
    from typing import Dict, List, Optional
    import requests
    import pandas as pd
    import numpy as np
    from dateutil.relativedelta import relativedelta

    POWER_BASE = "https://power.larc.nasa.gov/api"

    # ---- Mappings & metadata ----
    FRONTEND_TO_POWER: Dict[str, List[str]] = {
        "temperature":   ["T2M", "T2M_MAX", "T2M_MIN"],                       # °C
        "precipitation": ["PRECTOTCORR"],                                     # mm/day
        "wind":          ["WS10M"],                                           # m/s
        "humidity":      ["RH2M"],                                            # %
        "clouds":        ["CLOUD_AMT", "ALLSKY_SFC_SW_DWN", "CLRSKY_SFC_SW_DWN"],  # % or proxy
        "pressure":      ["PS"],                                              # kPa
        "uvindex":       ["ALLSKY_SFC_UV_INDEX"],                              # index
        "visibility":    ["ALLSKY_KT"],                                       # clearness index proxy (0–1)
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

    UNITS = {
        "temperature": "°C (mean), °C (Tmax/Tmin)",
        "precipitation": "mm/day",
        "wind": "m/s",
        "humidity": "%",
        "clouds": "%",
        "visibility": "index (ALLSKY_KT, 0–1; higher = clearer)",
        "pressure": "kPa",
        "uvindex": "index",
    }

    # ---- Helpers ----
    def _datestr(d: dt.date) -> str:
        return d.strftime("%Y%m%d")

    def _fetch_power_daily_point(lat: float, lon: float, start: str, end: str, params: List[str]) -> pd.DataFrame:
        url = f"{POWER_BASE}/temporal/daily/point"
        r = requests.get(
            url,
            params={
                "parameters": ",".join(params),
                "community": community,
                "longitude": lon,
                "latitude": lat,
                "start": start,
                "end": end,
                "format": "JSON",
            },
            timeout=timeout_s,
        )
        r.raise_for_status()
        block = r.json().get("properties", {}).get("parameter", {})
        if not block:
            raise RuntimeError("POWER returned no data for the requested point/range.")
        frames = []
        for p in params:
            if p in block:
                ser = pd.Series(block[p], dtype="float64")
                ser.index = pd.to_datetime(ser.index, format="%Y%m%d", utc=True)  # daily keys
                frames.append(ser.rename(p))
        if not frames:
            raise RuntimeError("Requested parameters missing in POWER response.")
        return pd.concat(frames, axis=1).sort_index()

    def _window_by_doy(df: pd.DataFrame, target_date: dt.date, window: int) -> pd.DataFrame:
        daily = df.resample("1D").mean()
        doy = daily.index.dayofyear
        center = target_date.timetuple().tm_yday
        mask = (
            (np.abs(doy - center) <= window)
            | (np.abs(doy + 366 - center) <= window)
            | (np.abs(doy - (center + 366)) <= window)
        )
        return daily.loc[mask]

    def _mode1(s: pd.Series) -> Optional[float]:
        m = s.dropna().mode()
        return None if m.empty else float(m.iloc[0])

    def _stats(s: pd.Series) -> Dict[str, Optional[float]]:
        s = s.dropna()
        if s.empty:
            return {"mean": None, "mode": None, "min": None, "max": None}
        return {
            "mean": float(s.mean()),
            "mode": _mode1(s),
            "min":  float(s.min()),
            "max":  float(s.max()),
        }

    def _derive_cloud_pct(win: pd.DataFrame) -> Optional[pd.Series]:
        """If CLOUD_AMT not present, approximate cloud fraction from (1 - ALLSKY/CLRSKY) * 100."""
        if "CLOUD_AMT" in win:
            return win["CLOUD_AMT"]
        need = {"ALLSKY_SFC_SW_DWN", "CLRSKY_SFC_SW_DWN"}
        if not need.issubset(win.columns):
            return None
        num = win["ALLSKY_SFC_SW_DWN"].astype(float)
        den = win["CLRSKY_SFC_SW_DWN"].astype(float)
        with np.errstate(divide="ignore", invalid="ignore"):
            frac = 1.0 - (num / den)
        frac = np.clip(frac, 0.0, 1.0)
        return pd.Series(frac * 100.0, index=win.index, name="CLOUD_PROXY")

    # ---- Parse inputs & range ----
    try:
        target_date = dt.date.fromisoformat(date_iso)
    except Exception as e:
        raise ValueError("date_iso must be 'YYYY-MM-DD'") from e

    today = dt.date.today()
    start_date = max(dt.date(1981, 1, 1), today - relativedelta(years=years_back))
    if start_date > today:
        start_date = today

    # ---- Build POWER parameter list from requested frontend params ----
    power_params: List[str] = []
    for key in frontend_params:
        power_params += FRONTEND_TO_POWER.get(key, [])
    # de-duplicate while preserving order
    seen = set()
    power_params = [p for p in power_params if not (p in seen or seen.add(p))]
    if not power_params:
        # ensure at least one (POWER requires parameters) — T2M is safe default
        power_params = ["T2M"]

    # ---- Fetch data & slice DOY window ----
    df = _fetch_power_daily_point(lat, lon, _datestr(start_date), _datestr(today), power_params)
    win = _window_by_doy(df, target_date, window_days)
    if win.empty:
        raise RuntimeError("No historical rows in the ±DOY window for this point.")

    # ---- Compute stats per requested frontend param ----
    results: Dict[str, dict] = {}
    percentiles: Dict[str, dict] = {}

    for key in frontend_params:
        label = FRONTEND_LABELS.get(key, key)
        unit = UNITS.get(key, "")

        if key == "temperature":
            base = _stats(win["T2M"]) if "T2M" in win else {"mean": None, "mode": None, "min": None, "max": None}
            tmax = _stats(win["T2M_MAX"]) if "T2M_MAX" in win else None
            tmin = _stats(win["T2M_MIN"]) if "T2M_MIN" in win else None
            results[key] = {"label": label, "unit": unit, "stats": base, "components": {"tmax": tmax, "tmin": tmin}}
            if include_percentiles and "T2M" in win:
                s = win["T2M"].dropna()
                if len(s):
                    percentiles[key] = {
                        "p25": float(np.percentile(s, 25)), "p50": float(np.percentile(s, 50)),
                        "p75": float(np.percentile(s, 75)), "p90": float(np.percentile(s, 90))
                    }

        elif key == "clouds":
            cloud_series = _derive_cloud_pct(win)
            if cloud_series is None:
                results[key] = {"label": label, "unit": unit, "stats": None, "available": False,
                                "note": "Cloud cover not directly available; proxy needs ALLSKY & CLRSKY."}
            else:
                results[key] = {"label": label, "unit": unit, "stats": _stats(cloud_series), "available": True}

        elif key == "visibility":
            # Proxy via ALLSKY_KT (clearness index)
            if "ALLSKY_KT" in win:
                results[key] = {
                    "label": label,
                    "unit": unit,
                    "stats": _stats(win["ALLSKY_KT"]),
                    "note": "Clearness Index proxy for visibility; higher = clearer (0–1)."
                }
                if include_percentiles:
                    s = win["ALLSKY_KT"].dropna()
                    if len(s):
                        percentiles[key] = {
                            "p25": float(np.percentile(s, 25)), "p50": float(np.percentile(s, 50)),
                            "p75": float(np.percentile(s, 75)), "p90": float(np.percentile(s, 90))
                        }
            else:
                results[key] = {"label": label, "unit": unit, "stats": None, "available": False}

        else:
            # Single-variable params
            main_var = {
                "precipitation": "PRECTOTCORR",
                "wind": "WS10M",
                "humidity": "RH2M",
                "pressure": "PS",
                "uvindex": "ALLSKY_SFC_UV_INDEX",
            }.get(key, None)

            if main_var and main_var in win:
                results[key] = {"label": label, "unit": unit, "stats": _stats(win[main_var])}
                if include_percentiles:
                    s = win[main_var].dropna()
                    if len(s):
                        percentiles[key] = {
                            "p25": float(np.percentile(s, 25)), "p50": float(np.percentile(s, 50)),
                            "p75": float(np.percentile(s, 75)), "p90": float(np.percentile(s, 90))
                        }
            else:
                results[key] = {"label": label, "unit": unit, "stats": None, "available": False}

    # ---- Compose payload ----
    weather_json = {
        "source": "NASA POWER (daily)",
        "location": {"lat": lat, "lon": lon},
        "target_date": target_date.isoformat(),
        "history_window": {
            "years_back": years_back,
            "start": _datestr(start_date),
            "end": _datestr(today),
            "doy_window_days": window_days
        },
        "parameters_requested": frontend_params,
        "results": results,
        "percentiles": percentiles if include_percentiles else None,
        "note": "Stats computed over ± day-of-year window across years. Historical info, not a forecast."
    }
    return weather_json

