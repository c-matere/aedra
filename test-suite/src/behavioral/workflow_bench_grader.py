import json
import os
import requests
import textwrap

# Load from API .env explicitly
env_path = "/home/chris/aedra/api/.env"
GEMINI_API_KEY = "dummy-key"
GEMINI_MODEL = "gemini-2.0-flash"

if os.path.exists(env_path):
    with open(env_path, "r") as f:
        for line in f:
            if line.startswith("GEMINI_API_KEY="):
                GEMINI_API_KEY = line.split("=", 1)[1].strip().strip('"\'')
            if line.startswith("GEMINI_MODEL="):
                GEMINI_MODEL = line.split("=", 1)[1].strip().strip('"\'')

JUDGE_MODEL = GEMINI_MODEL

def grade_journey(workflow_scenario, execution_data):
    """
    Grades the entire multi-turn journey.
    """
    history_str = ""
    for i, step in enumerate(execution_data.get("steps", [])):
        history_str += f"Turn {i+1}:\n"
        history_str += f"  User: {step.get('input')}\n"
        history_str += f"  Agent: {step.get('ai_response')}\n"
        if step.get("vc_summary"):
            history_str += f"  [System Action]: {step['vc_summary'].get('hint', 'Action recorded')}\n"
        history_str += "\n"

    prompt = f"""
You are an expert Property Management auditor grading an AI property management agent's performance across a multi-turn workflow.

WORKFLOW GOAL: {workflow_scenario.get('description', 'Complete the user journey.')}
ACTOR ROLE: {workflow_scenario.get('actor', 'TENANT')}

CONVERSATION HISTORY:
{history_str}

GRADING CRITERIA (Score 0 to 5):
1. Coherence: Did the agent maintain context across turns?
2. Task Completion: Did the agent actually achieve the goal (e.g. record the date, log the ticket)?
3. Accuracy: Did the agent correctly use names, dates, and amounts?
4. Persona: Did the agent stay in character (helpful, professional, compliant)?
5. Resilience: Did the agent handle any ambiguity or errors gracefully?

OUTPUT FORMAT MUST BE STRICT JSON:
{{
  "Coherence": <int 0-5>,
  "TaskCompletion": <int 0-5>,
  "Accuracy": <int 0-5>,
  "Persona": <int 0-5>,
  "Resilience": <int 0-5>,
  "OverallScore": <float 0-5>,
  "Feedback": "<short 1-2 sentence summary of the journey>"
}}
"""

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{JUDGE_MODEL}:generateContent?key={GEMINI_API_KEY}"
    
    data = {
        "contents": [{
            "parts": [{"text": prompt}]
        }],
        "generationConfig": {
            "response_mime_type": "application/json",
            "temperature": 0.0
        }
    }

    try:
        response = requests.post(url, json=data, timeout=30)
        if response.status_code == 200:
            result = response.json()
            content = result["candidates"][0]["content"]["parts"][0]["text"]
            return json.loads(content)
        else:
            return {"error": f"HTTP {response.status_code}"}
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    # Example usage for manual testing
    pass
