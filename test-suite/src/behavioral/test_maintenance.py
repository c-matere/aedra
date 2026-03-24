import sys
import json
import uuid
import time
from test_runner import create_token, run_test

print("DEBUG: Script started", flush=True)

# Scenario for Maintenance Resolution
SCENARIO = {
    "workflow_id": "wf_tenant_02_maintenance_tracking",
    "name": "Tenant: Maintenance Tracking",
    "actor": "TENANT",
    "steps": [
        {
            "input": "The toilet is overflowing! Send help please.",
            "expected_intent": "report_maintenance"
        },
        {
            "input": "Who is the technician and when will they arrive?",
            "expected_intent": "check_maintenance_status"
        }
    ]
}

def main():
    token = create_token("3a33e9db-4e47-4ede-87d0-b4978f455b12", "SUPER_ADMIN", "bench-company-001")
    history = []
    execution_id = str(uuid.uuid4())
    print(f"🚀 Running Targeted Test: {SCENARIO['name']} [{execution_id}]")

    for i, step in enumerate(SCENARIO['steps']):
        print(f"\n[Step {i+1}] User: {step['input']}")
        # Inject benchmark tag
        msg = f"[BENCH_WF:{execution_id}] {step['input']}"
        
        start = time.time()
        res = run_test(msg, history, token)
        latency = time.time() - start
        
        if res['status'] != "PASS":
            print(f"✗ FAILED: {res.get('error')}")
            break
            
        raw = res['raw']
        ai_resp = raw.get('response', '')
        if isinstance(ai_resp, dict):
            ai_text = ai_resp.get('data', '')
        else:
            ai_text = ai_resp

        vc = raw.get('vcSummary')
        
        print(f"Agent: {ai_text}")
        if vc:
            print(f"System Action: {vc.get('hint')}")
            if vc.get('changedFields'):
                print(f"Changed Fields: {vc.get('changedFields')}")
            
        history.append({"role": "user", "content": step['input']})
        history.append({"role": "assistant", "content": ai_text})

if __name__ == "__main__":
    main()
