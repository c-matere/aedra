import json
import base64
import hmac
import hashlib
import time
import requests

API_BASE_URL = "http://127.0.0.1:4001"
SECRET = "zJ4x1QYTW9lNjvr6NniaoAHA9Kzy5zO7"

def create_token(user_id, role):
    payload = {"userId": user_id, "role": role, "exp": int(time.time()) + 3600}
    encoded_payload = base64.urlsafe_b64encode(json.dumps(payload).encode('utf-8')).decode('utf-8').rstrip('=')
    signature = hmac.new(SECRET.encode('utf-8'), encoded_payload.encode('utf-8'), hashlib.sha256).digest()
    encoded_signature = base64.urlsafe_b64encode(signature).decode('utf-8').rstrip('=')
    return f"{encoded_payload}.{encoded_signature}"

token = create_token("3a33e9db-4e47-4ede-87d0-b4978f455b12", "SUPER_ADMIN")
chat_id = "repro_045"

print(f"Token: {token}")

# Turn 1
data1 = {
    "message": "Does Fatuma Ali have any arrears?",
    "history": [],
    "chatId": chat_id,
    "companyId": "bench-company-001"
}
print("\n--- TURN 1 ---")
r1 = requests.post(f"{API_BASE_URL}/ai/chat", headers={"Authorization": f"Bearer {token}"}, json=data1)
print(f"Status: {r1.status_code}")
print(f"Response: {r1.text}")

# Turn 2
data2 = {
    "message": "Okay, let them know they need to pay by Friday",
    "history": [], # Server uses its own history
    "chatId": chat_id,
    "companyId": "bench-company-001"
}
print("\n--- TURN 2 ---")
r2 = requests.post(f"{API_BASE_URL}/ai/chat", headers={"Authorization": f"Bearer {token}"}, json=data2)
print(f"Status: {r2.status_code}")
print(f"Response: {r2.text}")
