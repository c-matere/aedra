import json
import time
import requests
import os
import sys
import uuid
from test_runner import create_token, run_test, API_BASE_URL, reset_session

# Configuration
V3_SCENARIO_FILE = "/home/chris/aedra/test-suite/src/behavioral/pm_bench_v3_stateful.json"
V3_RESULTS_FILE = "/home/chris/aedra/test-suite/src/behavioral/pm_bench_v3_results.json"
USER_ID = "3a33e9db-4e47-4ede-87d0-b4978f455b12"

def get_active_workflow(token):
    url = f"{API_BASE_URL}/ai/workflows/active"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    try:
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code == 200:
            return response.json()
        return None
    except:
        return None

def run_v3_scenario(scenario):
    print(f"\n🚀 Running PM-BENCH v3 Scenario [{scenario['id']}]: {scenario['name']}")
    
    # ADMIN token for management
    admin_token = create_token(USER_ID, "SUPER_ADMIN", "bench-company-001")
    reset_success, error_msg = reset_session("", admin_token, USER_ID)
    if not reset_success:
        print(f"  ❌ Failed to reset session. Error: {error_msg}")
        return {"id": scenario["id"], "name": scenario["name"], "passed": False, "turns": []}

    history = []
    all_turns_passed = True
    turn_results = []

    for i, turn in enumerate(scenario['turns']):
        # Role-specific token
        role_token = create_token(USER_ID, turn['role'], "bench-company-001")
        print(f"  [Turn {i+1}] {turn['role']}: \"{turn['message'][:40]}...\"", end=' ', flush=True)
        
        start_time = time.time()
        res = run_test(turn['message'], history, role_token)
        latency = time.time() - start_time
        
        if res['status'] != "PASS":
            print(f"✗ FAILED (API Error: {res.get('error')})")
            all_turns_passed = False
            break

        # Extract metadata
        metadata = res.get('raw', {}).get('metadata', {})
        actual_intent = metadata.get('intent')
        actual_tools = metadata.get('tools', [])
        
        # Check Workflow Status
        wf = get_active_workflow(role_token)
        actual_wf_status = wf.get('status') if wf else "NONE"
        actual_wf_state = wf.get('currentState') if wf else "NONE"

        # Validations
        turn_passed = True
        reasons = []

        if turn.get('expectedIntent') and actual_intent != turn['expectedIntent']:
            turn_passed = False
            reasons.append(f"Intent Mismatch (Exp: {turn['expectedIntent']}, Got: {actual_intent})")

        if turn.get('expectedWorkflowStatus') and actual_wf_status != turn['expectedWorkflowStatus']:
             turn_passed = False
             reasons.append(f"WF Status Mismatch (Exp: {turn['expectedWorkflowStatus']}, Got: {actual_wf_status})")

        if turn.get('expectedState') and actual_wf_state != turn['expectedState']:
             turn_passed = False
             reasons.append(f"WF State Mismatch (Exp: {turn['expectedState']}, Got: {actual_wf_state})")

        if turn.get('requiredKeywords'):
            resp_text = res.get('response', '')
            if isinstance(resp_text, dict): resp_text = resp_text.get('data', str(resp_text))
            if not all(k.lower() in resp_text.lower() for k in turn['requiredKeywords']):
                turn_passed = False
                reasons.append("Keywords Missing")

        if turn.get('expectedForbiddenTools'):
             if any(t in actual_tools for t in turn['expectedForbiddenTools']):
                 turn_passed = False
                 reasons.append(f"POLICY VIOLATION: Forbidden tools found: {actual_tools}")

        if turn_passed:
            print(f"✓ ({latency:.2f}s)")
        else:
            print(f"✗ FAILED ({', '.join(reasons)})")
            all_turns_passed = False

        turn_results.append({
            "turn": i+1,
            "passed": turn_passed,
            "reasons": reasons,
            "intent": actual_intent,
            "wf_status": actual_wf_status,
            "wf_state": actual_wf_state,
            "tools": actual_tools,
            "latency": latency
        })

        # Update history
        history.append({"role": "user", "content": turn['message']})
        resp_data = res.get('response', '')
        if isinstance(resp_data, dict): resp_data = resp_data.get('data', '')
        history.append({"role": "assistant", "content": resp_data})

    return {
        "id": scenario["id"],
        "name": scenario["name"],
        "passed": all_turns_passed,
        "turns": turn_results
    }

def main():
    if not os.path.exists(V3_SCENARIO_FILE):
        print(f"File not found: {V3_SCENARIO_FILE}")
        return
        
    with open(V3_SCENARIO_FILE, 'r') as f:
        scenarios = json.load(f)
        
    results = []
    for s in scenarios:
        results.append(run_v3_scenario(s))
        
    print("\n" + "="*60)
    print("📊 PM-BENCH v3 (STATEFUL) RESULTS 📊")
    print("="*60)
    
    passed_sc = sum(1 for r in results if r["passed"])
    for r in results:
        status = "✅ PASS" if r["passed"] else "❌ FAIL"
        print(f"{status} | {r['name']:<40}")
        
    print("-" * 60)
    print(f"TOTAL: {passed_sc} / {len(results)} ({ (passed_sc/len(results))*100:.1f}%)")
    print("="*60)
    
    with open(V3_RESULTS_FILE, 'w') as f:
        json.dump(results, f, indent=2)

if __name__ == "__main__":
    main()
