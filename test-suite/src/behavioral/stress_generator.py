import json
import random
import os

# Categories and their targets
CATEGORIES = {
    "customer_support": {
        "count": 50,
        "intents": ["fix_tenant_issue", "escalate_complaint", "billing_dispute", "access_denied"],
        "entities": ["tenant", "landlord", "agent"],
    },
    "transaction_management": {
        "count": 50,
        "intents": ["verify_payment", "reverse_charge", "manual_reconciliation", "failed_payout"],
        "entities": ["transaction", "payout", "payment_method"],
    },
    "account_management": {
        "count": 70,
        "intents": ["create_user", "delete_user", "change_role", "reset_mfa", "deactivate_account"],
        "entities": ["super_admin", "company_admin", "agent"],
    },
    "company_management": {
        "count": 70,
        "intents": ["onboard_company", "suspend_company", "update_branding", "list_admins"],
        "entities": ["company", "branch", "license"],
    },
    "crud_operations": {
        "count": 80,
        "intents": ["create_property", "update_unit", "delete_listing", "archive_lease"],
        "entities": ["property", "unit", "listing", "lease"],
    },
    "reporting_analytics": {
        "count": 60,
        "intents": ["revenue_report", "vacancy_report", "occupancy_stats", "growth_trends"],
        "entities": ["financials", "portfolio", "region"],
    },
    "audit_compliance": {
        "count": 40,
        "intents": ["review_logs", "trace_action", "export_audit", "permission_check"],
        "entities": ["audit_log", "user_activity", "system_event"],
    },
    "bulk_imports": {
        "count": 30,
        "intents": ["bulk_upload_tenants", "bulk_create_units", "import_payments"],
        "entities": ["csv_file", "excel_sheet", "data_batch"],
    },
    "image_requests": {
        "count": 20,
        "intents": ["extract_id_data", "parse_receipt_photo", "logo_extraction"],
        "entities": ["image", "photo", "screenshot"],
    },
    "system_errors_edge_cases": {
        "count": 30,
        "intents": ["malformed_json", "vague_command", "unsupported_language", "rate_limit_bypass"],
        "entities": ["system", "api", "database"],
    },
}

NAMES = ["Samuel Kamau", "Grace Wambui", "Peter Otieno", "Fatuma Ali", "John Mwangi", "Sarah Otieno", "Kibet Kiprop"]
COMPANIES = ["Nyota Properties", "Sunrise Estates", "Homeet Ltd", "Aedra Realty"]
LOCATIONS = ["Nairobi", "Mombasa", "Kisumu", "Nyali", "Westlands"]

# Adversarial patterns
SLANG_MIX = [
    "Sasa admin, ", "Niaje, ", "Weba, ", "Ebu ", "Onyesha ", "Toa ", "Weka ", "Hebu "
]

TYPOS = {
    "delete": ["delet", "delite", "dlt"],
    "tenant": ["tenent", "tanant"],
    "property": ["properti", "proprty"],
    "report": ["reprt", "repot"],
    "payment": ["paymnt", "paymet"],
}

VAGUE_PHRASES = [
    "fix that thing", "do it now", "check the usual", "you know what i mean", "make it work", "sasa hivi"
]

def apply_adversarial(message, level=0.3):
    if random.random() > level:
        return message
        
    # Add slang
    if random.random() < 0.4:
        message = random.choice(SLANG_MIX) + message
        
    # Introduce typos
    words = message.split()
    for i, word in enumerate(words):
        word_clean = word.lower().strip(".,!?")
        if word_clean in TYPOS and random.random() < 0.5:
            typo = random.choice(TYPOS[word_clean])
            words[i] = word.replace(word_clean, typo)
    
    # Add vague urgency
    if random.random() < 0.3:
        message = message + " " + random.choice(VAGUE_PHRASES)
        
    return " ".join(words)

def generate_scenario(cat_name, intent, id_num):
    entity = random.choice(CATEGORIES[cat_name]["entities"])
    name = random.choice(NAMES)
    company = random.choice(COMPANIES)
    location = random.choice(LOCATIONS)
    
    # Base message logic
    templates = {
        "customer_support": [
            f"Escalate the complaint for {name} regarding {entity}.",
            f"Fix the access issue for tenant {name} immediately.",
            f"Review the billing dispute for {company}."
        ],
        "transaction_management": [
            f"Verify transaction ID TXN{random.randint(100000, 999999)}.",
            f"Reverse the charge for payout to {name}.",
            f"Manual reconciliation for {company} payments."
        ],
        "account_management": [
            f"Create a new {entity} account for {name} under {company}.",
            f"Delete the account for admin {name}.",
            f"Change role of {name} to {entity}."
        ],
        "company_management": [
            f"Onboard {company} to the platform.",
            f"Suspend all branches for {company}.",
            f"List all admins for {company}."
        ],
        "crud_operations": [
            f"Create a new {entity} in {location} for {company}.",
            f"Update rent for {entity} in {location} to {random.randint(10, 50)}k.",
            f"Delete {entity} listing {random.randint(100, 999)}."
        ],
        "reporting_analytics": [
            f"Generate a {intent.replace('_', ' ')} for {company}.",
            f"Show me {entity} stats for this month.",
            f"Export {intent.replace('_', ' ')} for {location}."
        ],
        "audit_compliance": [
            f"Show audit logs for user {name}.",
            f"Trace the deletion of {entity} by {name}.",
            f"Check permissions for {entity}."
        ],
        "bulk_imports": [
            f"Import {entity} from the attached CSV file.",
            f"Bulk create 50 {entity} records.",
            f"Process this data batch for {company}."
        ],
        "image_requests": [
            f"Extract data from this {entity}.",
            f"Parse the photo of the {entity} from {name}.",
            f"Identify company logo from this image."
        ],
        "system_errors_edge_cases": [
            f"Process this malformed request for {entity}.",
            f"Execute vague command: {random.choice(VAGUE_PHRASES)}.",
            f"Try to bypass the rate limit for {entity}."
        ]
    }
    
    message = random.choice(templates.get(cat_name, ["Help with system requests."]))
    
    # Apply Kenyan context/mixed language 
    if random.random() < 0.4:
        if "delete" in message.lower():
            message = message.replace("Delete", "Onyesha delete").replace("delete", "toa")
        if "show" in message.lower():
            message = message.replace("Show", "Nionyeshe").replace("show", "onyesha")

    final_message = apply_adversarial(message)
    
    # Attachments
    attachments = []
    if cat_name == "image_requests":
        attachments = [f"{entity}_{random.randint(1,5)}.jpg"]
    elif cat_name == "bulk_imports":
        attachments = [f"{entity}.csv"]
    elif random.random() < 0.05:
        attachments = ["misc_doc.pdf"]

    return {
        "id": f"stress_scenario_{id_num:03d}",
        "category": cat_name,
        "message": final_message,
        "attachments": attachments,
        "history": [],
        "expected_behavior": {
            "intent": intent,
            "target_entity": entity,
            "operation": random.choice(["create", "read", "update", "delete"]),
            "notes": f"System should handle {intent} for {entity} correctly."
        }
    }

def main():
    scenarios = []
    id_counter = 1
    
    for cat_name, data in CATEGORIES.items():
        for _ in range(data["count"]):
            intent = random.choice(data["intents"])
            scenarios.append(generate_scenario(cat_name, intent, id_counter))
            id_counter += 1
            
    output_path = "/home/chris/aedra/test-suite/src/behavioral/stress_suite.json"
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    with open(output_path, "w") as f:
        json.dump(scenarios, f, indent=2)
    
    print(f"Generated {len(scenarios)} scenarios at {output_path}")

if __name__ == "__main__":
    main()
