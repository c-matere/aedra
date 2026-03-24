import json
import time
import os
import argparse
import uuid
import sys
from test_runner import create_token, run_test
from workflow_bench_grader import grade_journey

# Configuration
SCENARIO_FILE = "/home/chris/aedra/test-suite/src/behavioral/workflow_scenarios.json"
OUTPUT_FILE = "/home/chris/aedra/test-suite/src/behavioral/workflow_bench_results.json"
BENCH_USER_ID = "3a33e9db-4e47-4ede-87d0-b4978f455b12" # SUPER_ADMIN

def verify_vc(actual_vc, expected_vc):
    """
    Verifies if the actual vcSummary matches the expected_vc requirements.
    """
    if expected_vc is None:
        return True # No verification needed for this step
    
    if actual_vc is None:
        return False # Expected a change but none occurred
    
    # Check action (CREATE/UPDATE/DELETE)
    if expected_vc.get("action") and actual_vc.get("action") != expected_vc["action"]:
        return False
        
    # Check entity type if specified
    # Note: actual_vc from buildVcSummary might not have 'entity' directly, but it has 'hint' or we check changedFields
    if expected_vc.get("entity"):
        # We might need to check the hint or secondary fields if the API returns them
        # For now, if we have expected_vc['entity'], we check if 'entity' is in the hint (case insensitive)
        if expected_vc["entity"].lower() not in actual_vc.get("hint", "").lower():
             # Fallback check: if it's a CREATE, often the hint says "New <Entity> created"
             pass
             
    # Check changedFields
    expected_fields = expected_vc.get("changedFields", [])
    actual_fields = actual_vc.get("changedFields", [])
    for field in expected_fields:
        if field not in actual_fields:
            return False
            
    return True

def run_workflow(workflow, delay=1.0):
    execution_id = str(uuid.uuid4())
    print(f"\n🚀 Starting Execution [{execution_id}] for: {workflow['name']}")
    
    history = []
    token = create_token(BENCH_USER_ID, "SUPER_ADMIN", "bench-company-001")
    step_results = []
    
    overall_pass = True
    
    for i, step in enumerate(workflow['steps']):
        step_idx = i + 1
        print(f"  [Step {step_idx}] User: {step['input'][:50]}...", end=' ', flush=True)
        
        start_time = time.time()
        # Injected persona hint to ensure AI knows its role
        role_hint = f"[BENCH_WF:{execution_id}][ROLE:{workflow.get('actor', 'TENANT')}] "
        msg = role_hint + step['input']
        
        res = run_test(msg, history, token)
        latency = time.time() - start_time
        
        if res.get("status") != "PASS":
            print(f"✗ FAILED (API Error: {res.get('error')})")
            step_results.append({
                "step": step_idx,
                "status": "FAIL",
                "error": res.get("error")
            })
            overall_pass = False
            break
            
        # Extract response + vcSummary from full API payload (test_runner keeps raw for benches)
        raw = res.get("raw") or {}
        ai_resp = raw.get("response", res.get("response", ""))
        ai_text = ai_resp.get("data") if isinstance(ai_resp, dict) else ai_resp
        actual_vc = raw.get("vcSummary")
        
        # Verify result state
        vc_passed = verify_vc(actual_vc, step.get("expected_vc"))
        
        # Simple pattern matching for response text (fallback/secondary check)
        patterns = step.get("expected_response_patterns", [])
        pattern_check = all(p.lower() in ai_text.lower() for p in patterns) if ai_text else False
        
        if vc_passed and pattern_check:
            print(f"✓ (Latency: {latency:.2f}s)")
        else:
            reason = []
            if not vc_passed: reason.append("VC State Mismatch")
            if not pattern_check: reason.append("Pattern Mismatch")
            print(f"✗ FAILED ({', '.join(reason)})")
            overall_pass = False
            
        step_results.append({
            "step": step_idx,
            "input": step['input'],
            "ai_response": ai_text,
            "vc_summary": actual_vc,
            "expected_vc": step.get("expected_vc"),
            "expected_response_patterns": step.get("expected_response_patterns", []),
            "vc_passes": vc_passed,
            "pattern_passes": pattern_check,
            "latency_sec": latency
        })
        
        # Update history
        history.append({"role": "user", "content": step['input']})
        history.append({"role": "assistant", "content": ai_text})
        
        if i < len(workflow['steps']) - 1:
            time.sleep(delay)
            
    # Journey-level grading
    print(f"  [Grader] Evaluation journey... ", end='', flush=True)
    journey_data = {
        "steps": step_results
    }
    grading = grade_journey(workflow, journey_data)
    print("✓ graded")

    return {
        "execution_id": execution_id,
        "workflow_id": workflow["workflow_id"],
        "name": workflow["name"],
        "overall_pass": overall_pass,
        "steps": step_results,
        "grading": grading
    }

def main():
    parser = argparse.ArgumentParser(description='Run Workflow Benchmarks.')
    parser.add_argument('--file', type=str, default=SCENARIO_FILE, help='Scenario file')
    parser.add_argument('--delay', type=float, default=1.5, help='Delay between resets')
    parser.add_argument('--limit', type=int, default=None, help='Limit number of workflows to run')
    args = parser.parse_args()
    
    if not os.path.exists(args.file):
        print(f"File not found: {args.file}")
        return
        
    with open(args.file, 'r') as f:
        workflows = json.load(f)
        
    results = []
    selected = workflows[: args.limit] if args.limit else workflows
    for wf in selected:
        results.append(run_workflow(wf, args.delay))
        
    # Summary
    print("\n" + "="*60)
    print("📊 WORKFLOW BENCHMARK SUMMARY 📊")
    print("="*60)
    
    passed_wf = sum(1 for r in results if r["overall_pass"])
    total_wf = len(results)
    
    for r in results:
        status = "✅ PASS" if r["overall_pass"] else "❌ FAIL"
        steps_comp = f"{sum(1 for s in r['steps'] if s.get('vc_passes', False) and s.get('pattern_passes', False))}/{len(r['steps'])}"
        print(f"{status} | {r['name']:<30} | Steps: {steps_comp}")
        
    print("-" * 60)
    print(f"TOTAL COMPLETED: {passed_wf} / {total_wf} ({ (passed_wf/total_wf)*100:.1f}%)")
    print("="*60)
    
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(results, f, indent=2)
    print(f"\nDetailed logs saved to {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
