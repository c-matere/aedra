import json
import base64
import hmac
import hashlib
import time
import requests
import os
import argparse

# Configuration
API_BASE_URL = "http://127.0.0.1:4001" 
SECRET = "zJ4x1QYTW9lNjvr6NniaoAHA9Kzy5zO7"
DEFAULT_SCENARIO_FILE = "/home/chris/aedra/test-suite/src/behavioral/stress_suite.json"
OUTPUT_FILE = "/home/chris/aedra/test-suite/src/behavioral/test_results.json"

def base64url_encode(data):
    return base64.urlsafe_b64encode(data).decode('utf-8').rstrip('=')

def create_token(user_id, role, company_id=None):
    payload = {
        "userId": user_id,
        "role": role,
        "exp": int(time.time()) + 3600 # 1 hour
    }
    if company_id:
        payload["companyId"] = company_id
        
    encoded_payload = base64url_encode(json.dumps(payload).encode('utf-8'))
    
    signature = hmac.new(
        SECRET.encode('utf-8'),
        encoded_payload.encode('utf-8'),
        hashlib.sha256
    ).digest()
    
    encoded_signature = base64url_encode(signature)
    return f"{encoded_payload}.{encoded_signature}"

def get_active_workflow(token):
    url = f"{API_BASE_URL}/ai/workflows/active"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    try:
        response = requests.post(url, headers=headers, json={}, timeout=10)
        if response.status_code == 201:
            data = response.json()
            return data[0] if data else None
        return None
    except:
        return None

def reset_session(chat_id, token, user_id):
    url = f"{API_BASE_URL}/ai/chat/reset"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    data = {
        "userId": user_id,
        "chatId": chat_id
    }
    try:
        response = requests.post(url, headers=headers, json=data, timeout=10)
        if response.status_code == 201:
            res = response.json()
            # Assert all cleared flags are true
            success = all([
                res.get("clearedActiveInstance"),
                res.get("clearedPendingState"),
                res.get("clearedAiSession"),
                res.get("clearedContextMemory")
            ])
            return success, res
        return False, f"HTTP {response.status_code}: {response.text}"
    except Exception as e:
        return False, str(e)

def run_test(message, history, token, expected_state=None, chat_id=None):
    url = f"{API_BASE_URL}/ai/chat"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    data = {
        "message": message,
        "history": history,
        "attachments": [],
        "companyId": "bench-company-001"
    }
    
    if chat_id:
        data["chatId"] = chat_id
    
    try:
        start_time = time.time()
        response = requests.post(url, headers=headers, json=data, timeout=300)
        end_time = time.time()
        
        if response.status_code == 201:
            result = response.json()
            
            # State Verification Logic
            active_workflow = get_active_workflow(token)
            state_match = True
            actual_state = active_workflow.get("currentState") if active_workflow else "NONE"
            
            if expected_state and actual_state != expected_state:
                state_match = False
                
            return {
                "status": "PASS" if ("response" in result and state_match) else "FAIL",
                "latency": end_time - start_time,
                "response": result.get("response"),
                "raw": result,
                "workflow_state": actual_state,
                "error": f"State mismatch: expected {expected_state}, got {actual_state}" if not state_match else None
            }
        else:
            return {
                "status": "ERROR",
                "latency": end_time - start_time,
                "response": None,
                "raw": None,
                "error": f"HTTP {response.status_code}: {response.text}"
            }
    except Exception as e:
        return {
            "status": "ERROR",
            "latency": 0,
            "response": None,
            "raw": None,
            "error": str(e)
        }

def process_workflow(workflow, token, delay):
    import uuid
    execution_id = str(uuid.uuid4())
    print(f"\n>>> Running Workflow: {workflow['workflow_id']} - {workflow['goal']} (Exec ID: {execution_id})")
    history = []
    results = []
    
    for i, req in enumerate(workflow['requests']):
        tagged_message = f"[BENCH_WF:{execution_id}] {req['message']}"
        print(f"  Step {i+1}/{len(workflow['requests'])}: \"{req['message']}\"...", end='\r')
        res = run_test(tagged_message, history, token, expected_state=req.get('expected_state'))
        
        # Maintain history (User message + AI response)
        history.append({"role": "user", "content": tagged_message})
        if res["response"]:
            # Handle cases where response is a string or an object
            resp_content = res["response"]["data"] if isinstance(res["response"], dict) else res["response"]
            history.append({"role": "assistant", "content": resp_content})
            
        res["step"] = i + 1
        res["message"] = req["message"]
        res["expected_state"] = req.get("expected_state")
        results.append(res)
        
        if i < len(workflow['requests']) - 1:
            time.sleep(delay)
            
    # Simple pass check: all steps must pass
    all_passed = all(r["status"] == "PASS" for r in results)
    print(f"  Workflow {workflow['workflow_id']} Result: {'PASS' if all_passed else 'FAIL'}")
    return results

def main():
    parser = argparse.ArgumentParser(description='Run behavioral tests.')
    parser.add_argument('--file', type=str, default=DEFAULT_SCENARIO_FILE, help='Scenario file path')
    parser.add_argument('--limit', type=int, default=20, help='Limit number of scenarios/workflows to run')
    parser.add_argument('--category', type=str, default=None, help='Filter by category')
    parser.add_argument('--delay', type=float, default=2.0, help='Delay between requests in seconds')
    parser.add_argument('--workflow', action='store_true', help='Run as workflow simulation')
    args = parser.parse_args()

    if not os.path.exists(args.file):
        print(f"Scenario file not found: {args.file}")
        return

    with open(args.file, 'r') as f:
        data = json.load(f)

    # Use a real superadmin user ID
    token = create_token("3a33e9db-4e47-4ede-87d0-b4978f455b12", "SUPER_ADMIN")
    all_results = []

    if args.workflow:
        print(f"Starting workflow simulation for {min(len(data), args.limit)} workflows from {args.file}...")
        for i, wf in enumerate(data[:args.limit]):
            wf_results = process_workflow(wf, token, args.delay)
            all_results.append({
                "workflow_id": wf["workflow_id"],
                "goal": wf["goal"],
                "steps": wf_results
            })
    else:
        # Single-shot mode (existing logic)
        scenarios = data
        if args.category:
            scenarios = [s for s in scenarios if s.get("category") == args.category]
            print(f"Filtered to {len(scenarios)} scenarios in category '{args.category}'")

        if not scenarios:
            print("No scenarios found after filtering.")
            return

        run_count = min(len(scenarios), args.limit)
        print(f"Starting single-shot test run for {run_count} scenarios...")
        
        for i, scenario in enumerate(scenarios[:args.limit]):
            msg = scenario.get("message") if "message" in scenario else scenario["input"]["message"]
            print(f"[{i+1}/{run_count}] Running {scenario['id']} ({scenario.get('category', 'N/A')})...", end='\r')
            res = run_test(msg, scenario.get("history", []), token)
            res["id"] = scenario["id"]
            all_results.append(res)
            
            if i < run_count - 1:
                time.sleep(args.delay)
        print("\nTest run complete.")

    with open(OUTPUT_FILE, 'w') as f:
        json.dump(all_results, f, indent=2)
        
    print(f"Details saved to {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
