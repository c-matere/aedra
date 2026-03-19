import json
import random
import os

# Categories and their specific variations
CATEGORIES = {
    "customer_support": {
        "intents": ["rent_receipt_missing", "login_issue", "listing_disappeared", "payment_pending"],
        "objects": ["tenant", "user", "landlord", "rent"],
    },
    "transaction_management": {
        "intents": ["check_payment_status", "refund_request", "verify_transaction", "duplicate_payment"],
        "objects": ["payment", "transaction", "mpesa_id"],
    },
    "account_management": {
        "intents": ["create_agent", "suspend_landlord", "reset_password", "promote_user", "merge_accounts"],
        "objects": ["agent", "landlord", "user"],
    },
    "crud_operations": {
        "intents": ["create_property", "update_rent", "delete_listing", "show_vacant"],
        "objects": ["property", "unit", "listing", "management"],
    },
    "multi_object_creation": {
        "intents": ["bulk_create_units", "upload_listings", "add_image_properties"],
        "objects": ["apartments", "listings", "units"],
    },
    "image_document_input": {
        "intents": ["extract_from_image", "parse_lease", "process_spreadsheet"],
        "objects": ["photo", "screenshot", "csv", "pdf"],
    },
    "system_error": {
        "intents": ["handle_timeout", "db_failure", "missing_record", "malformed_request"],
        "objects": ["api", "database", "record"],
    },
    "meta_queries": {
        "intents": ["system_activity", "stats_listings", "agent_signups"],
        "objects": ["logs", "dashboard", "report"],
    },
    "security_permissions": {
        "intents": ["delete_all_tenants", "export_emails", "unauthorized_access"],
        "objects": ["security", "admin", "global"],
    },
    "ambiguous_instruction": {
        "intents": ["vague_delete", "vague_show", "vague_update"],
        "objects": ["item", "data", "id"],
    },
}

NAMES = ["John Mwangi", "Sarah Otieno", "Kibet Kiprop", "Fatuma Ali", "Samuel Kamau", "Grace Wambui"]
LOCATIONS = ["Tudor", "Nyali", "Kizingo", "Bamburi", "Likoni", "Mtwapa"]
TONES = ["formal", "casual", "slang", "fragmented"]

def generate_scenario(id_num):
    category_key = random.choice(list(CATEGORIES.keys()))
    category_data = CATEGORIES[category_key]
    intent = random.choice(category_data["intents"])
    obj = random.choice(category_data["objects"])
    name = random.choice(NAMES)
    location = random.choice(LOCATIONS)
    tone = random.choice(TONES)
    
    # Message generation logic based on category and intent
    if category_key == "customer_support":
        if intent == "rent_receipt_missing":
            messages = {
                "formal": f"Dear Admin, tenant {name} reports their rent receipt for {location} was not generated.",
                "casual": f"Hey, {name} says they haven't seen their receipt yet for {location}.",
                "slang": f"Sasa, mbona receipt ya {name} haijatokea kwa system?",
                "fragmented": f"receipt missing {name} {location}"
            }
        else:
            messages = {
                "formal": f"The user {name} is experiencing {intent.replace('_', ' ')}.",
                "casual": f"{name} is having trouble with {obj}.",
                "slang": f"Huyu {name} ako na shida ya {obj}.",
                "fragmented": f"{name} {obj} error"
            }
    elif category_key == "crud_operations":
        if intent == "create_property":
            messages = {
                "formal": f"Please register a new property at {location} for owner {name}.",
                "casual": f"Add a new house in {location}, landlord is {name}.",
                "slang": f"Weka mjengo mpya {location}, ya {name}.",
                "fragmented": f"new property {location} {name}"
            }
        else:
            messages = {
                "formal": f"Requesting to {intent.replace('_', ' ')} for {obj}.",
                "casual": f"Can you {intent.replace('_', ' ')} this {obj}?",
                "slang": f"{intent.replace('_', ' ')} hii {obj} sasa hivi.",
                "fragmented": f"{intent} {obj}"
            }
    elif category_key == "multi_object_creation":
        count = random.randint(2, 10)
        messages = {
            "formal": f"Instructing create {count} {obj} in {location} for {name}.",
            "casual": f"Make {count} more {obj} in {location} for {name}.",
            "slang": f"Ongeza {obj} {count} huko {location}.",
            "fragmented": f"{count} {obj} {location}"
        }
    else:
        # Default generic message
        messages = {
            "formal": f"Execute {intent.replace('_', ' ')} for {obj} {name}.",
            "casual": f"Help with {intent.replace('_', ' ')} for {obj}.",
            "slang": f"Fanya {intent.replace('_', ' ')} ya {obj}.",
            "fragmented": f"{intent} {obj} {name}"
        }

    message = messages.get(tone, messages["formal"])
    
    return {
        "id": f"scenario_{id_num:03d}",
        "category": category_key,
        "input": {
            "message": message,
            "attachments": [] if random.random() > 0.1 else ["attachment.png"]
        },
        "expected_behavior": {
            "intent": intent,
            "tone": tone,
            "response_guidelines": [
                f"Identify {intent} intent",
                f"Address {obj} specifically",
                "Maintain professional helpfulness"
            ]
        },
        "pass_criteria": [
            f"Correctly identifies {intent}",
            "Extracted relevant identifiers"
        ]
    }

def main():
    scenarios = []
    for i in range(1, 501):
        scenarios.append(generate_scenario(i))
    
    output_path = "/home/chris/aedra/test-suite/src/behavioral/behavioral_suite.json"
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    with open(output_path, "w") as f:
        json.dump(scenarios, f, indent=2)
    
    print(f"Generated 500 scenarios at {output_path}")

if __name__ == "__main__":
    main()
