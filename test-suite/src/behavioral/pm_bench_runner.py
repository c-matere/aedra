import json
import time
import os
import argparse
import textwrap
from test_runner import create_token, run_test, reset_session
from pm_bench_grader import score_response
import random

# Re-use test_runner's logic for executing against /ai/chat
DEFAULT_SCENARIO_FILE = "/home/chris/aedra/test-suite/src/behavioral/pm_bench_scenarios.json"
OUTPUT_FILE = "/home/chris/aedra/test-suite/src/behavioral/pm_bench_results.json"

def print_summary(results):
    print("\n" + "="*60)
    print("🎯 PM-BENCH v1 RESULTS 🎯")
    print("="*60)
    
    total = len(results)
    if total == 0:
        print("No results to display.")
        return
        
    dimensions = ["Coherence", "TaskCompletion", "Accuracy", "Persona", "Resilience"]
    avg_scores = {d: 0.0 for d in dimensions}
    
    categories = {}
    
    for r in results:
        # Use first part of ID or category for breakdown
        cat = r.get("category", "unknown")
        if cat not in categories:
            categories[cat] = {"total": 0, "scores": {d: 0.0 for d in dimensions}}
            
        categories[cat]["total"] += 1
        
        grading = r.get("grading", {})
        for d in dimensions:
            score = grading.get(d, 0)
            avg_scores[d] += score
            categories[cat]["scores"][d] += score
            
    print(f"\nOVERALL AVERAGES (n={total})")
    for d in dimensions:
        avg = avg_scores[d] / total
        print(f"  {d:<15}: {avg:.1f} / 5.0")
        
    print("\nPER-CATEGORY BREAKDOWN:")
    for cat, data in categories.items():
        count = data["total"]
        print(f"\n  {cat.upper()} (n={count})")
        for d in dimensions:
            avg = data["scores"][d] / count
            print(f"    {d:<13}: {avg:.1f}")
            
    passed = sum(1 for r in results if r["overall_pass"])
    pass_rate = (passed / total) * 100
    print(f"\nScenarios meeting pass threshold (OverallScore >= 3.5): {passed}/{total} ({pass_rate:.1f}%)")
    print("="*60 + "\n")

def main():
    parser = argparse.ArgumentParser(description='Run PM-Bench Property Management simulations.')
    parser.add_argument('--file', type=str, default=DEFAULT_SCENARIO_FILE, help='Scenario dataset file')
    parser.add_argument('--limit', type=int, default=100, help='Limit number of scenarios to run')
    parser.add_argument('--category', type=str, default=None, help='Filter by category')
    parser.add_argument('--delay', type=float, default=1.0, help='Delay between requests in seconds')
    parser.add_argument('--dry-run', action='store_true', help='Test scenario loading without hitting AI')
    args = parser.parse_args()

    if not os.path.exists(args.file):
        print(f"Scenario file not found: {args.file}")
        return

    with open(args.file, 'r') as f:
        scenarios = json.load(f)

    if args.category:
        scenarios = [s for s in scenarios if s.get("category") == args.category]
        print(f"Filtered to {len(scenarios)} scenarios in category '{args.category}'")

    if not scenarios:
        print("No scenarios found to run.")
        return

    run_count = min(len(scenarios), args.limit)
    scenarios_to_run = scenarios[:run_count]
    
    if args.dry_run:
        print(f"DRY RUN: Loaded {run_count} scenarios. Exiting...")
        return

    print(f"\nStarting PM-Bench execution for {run_count} scenarios...")
    
    # Use the verified SUPER_ADMIN user from the DB for ALL benchmark tokens.
    BENCH_USER_ID = "3a33e9db-4e47-4ede-87d0-b4978f455b12"
    
    # Specific signatures for true bleed (contamination)
    BLEED_SIGNATURES = [
        "✏️ Changed: first name, phone",
        "✏️ Changed: firstName, phone",
        "✏️ Changed: firstName, phone",
        "update_user",
        "grant access",
        "Changed: firstName, phone\n- Changed: firstName, phone",
        "updated first name and phone number",
        "Sawa, updated"
    ]

    def check_for_bleed(response: str) -> bool:
        return any(sig in response for sig in BLEED_SIGNATURES)

    # Execution stats
    stats = {
        'total': 0,
        'passed': 0,
        'failed': 0,
        'errors': 0,
        'bleed': 0,
        'categories': {}
    }

    all_results = []
    
    for i, scenario in enumerate(scenarios_to_run):
        import uuid
        execution_id = str(uuid.uuid4())
        role = scenario.get("role", "TENANT")
        token = create_token(BENCH_USER_ID, "SUPER_ADMIN")
        
        category = scenario.get('category', 'unknown')
        if category not in stats['categories']:
            stats['categories'][category] = {'total': 0, 'passed': 0}
        
        stats['total'] += 1
        stats['categories'][category]['total'] += 1
        
        print(f"[{i+1}/{run_count}] ({category}) {role} scenario: {scenario['id']} ", end='', flush=True)
        
        # 0. Reset session for clean baseline
        ok, detail = reset_session(execution_id, token, BENCH_USER_ID)
        if not ok:
            print(f"✗ Reset FAILED ({detail})")
            stats['errors'] += 1
            continue
            
        print("✓ reset ", end='', flush=True)
        time.sleep(0.5)

        # Handle turns (sequential tasks)
        turns = scenario.get("turns", [])
        if not turns:
            # Fallback for legacy single-turn scenarios
            turns = [{"user": scenario.get("input", {}).get("message", "")}]

        history = []
        steps_recorded = []
        bleed_detected = False
        api_error = False

        for turn_idx, turn in enumerate(turns):
            raw_msg = turn.get("user", "")
            # Prefix with persona context and BENCH_WF ID
            role_hint = f"[BENCH_WF:{execution_id}] [BENCH_PERSONA:{role}] Simulate responding as if speaking to a {role}. Message: "
            msg = role_hint + raw_msg
            
            print(f"(turn {turn_idx+1}) ", end='', flush=True)
            
            start_time = time.time()
            res = None
            for attempt in range(4):
                res = run_test(msg, [], token, chat_id=execution_id)
                if res and (res.get('response') or res.get('status') == 'PASS'):
                    break
                
                err = str(res.get('error', '')).lower() if res else ""
                is_transient = any(k in err for k in ["timed out", "connection refused", "reboot", "502", "503", "504"])
                if not is_transient:
                    break
                time.sleep(2 * (2**attempt))

            latency = time.time() - start_time

            if not res or (res.get('status') != 'PASS' and not res.get('response')):
                print(f"✗ API ERROR ", end='')
                api_error = True
                break

            ai_res = res.get('response', '')
            ai_text = ai_res.get('data') if isinstance(ai_res, dict) else ai_res
            if ai_text is None and isinstance(ai_res, dict) and 'response' in ai_res:
                ai_text = ai_res['response']
            
            ai_text = str(ai_text)
            
            steps_recorded.append({
                "step": turn_idx + 1,
                "input": raw_msg,
                "ai_response": ai_text,
                "latency_sec": latency
            })
            history.append({"user": raw_msg, "ai": ai_text})

            if check_for_bleed(ai_text):
                bleed_detected = True
                print(f"⚠ BLEED ", end='')
                break

        if api_error:
            stats['errors'] += 1
            print("✗")
            continue

        if bleed_detected:
            stats['bleed'] += 1
            grading = {
                "Coherence": 0, "TaskCompletion": 0, "Accuracy": 0, "Persona": 0, "Resilience": 0,
                "OverallScore": 0.0,
                "Feedback": "ISOLATION FAILURE: Bleed signatures detected."
            }
        else:
            print("✓ agent done -> Grader... ", end='', flush=True)
            grading = score_response(scenario, history)
            print("✓ graded")

        overall_pass = grading.get("OverallScore", 0) >= 3.5
        if overall_pass:
            stats['passed'] += 1
            stats['categories'][category]['passed'] += 1
        else:
            stats['failed'] += 1

        all_results.append({
            "execution_id": execution_id,
            "workflow_id": scenario["id"],
            "category": category,
            "name": f"{category} - {role}",
            "overall_pass": overall_pass,
            "status": "PASS" if not bleed_detected else "BLEED_DETECTED",
            "steps": steps_recorded,
            "grading": grading
        })
            
        if i < run_count - 1:
            time.sleep(args.delay)

    # Save to disk
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(all_results, f, indent=2)
        
    print(f"\nDetailed results saved to {OUTPUT_FILE}")
    print_summary(all_results)

if __name__ == "__main__":
    main()
