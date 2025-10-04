
import datetime as dt
from typing import Dict, List, Optional
import requests
import pandas as pd
import numpy as np
from dateutil.relativedelta import relativedelta

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
