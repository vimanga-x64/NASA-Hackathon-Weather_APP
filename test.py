import requests

url = "http://127.0.0.1:5000/recommend"
payload = {
    "location": {"latitude": 55.75, "longitude": 37.62},
    "date": "2025-10-04",
    "preferences": ["Hiking", "Picnic"]
}

response = requests.post(url, json=payload)

print("Status code:", response.status_code)
print("Response JSON:")
print(response.json())
