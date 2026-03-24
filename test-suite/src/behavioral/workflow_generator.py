import json
import random
import os

# Contextual data
COMPANIES = ["Nyota Properties", "Sunrise Estates", "Homeet Ltd", "Aedra Realty", "Lakeside Realty"]
ADMINS = ["Grace Wambui", "Peter Otieno", "Fatuma Ali", "Samuel Kamau", "Sarah Otieno"]
TENANTS = ["John Mwangi", "Fatuma Ali", "Kibet Kiprop", "Mary Atieno", "David Njuguna"]
UNITS = ["B12", "C4", "A1", "D10", "E5", "G7", "F2"]

def generate_tenant_onboarding(id_num):
    company = random.choice(COMPANIES)
    admin = random.choice(ADMINS)
    t1 = random.choice(TENANTS)
    t2 = random.choice([t for t in TENANTS if t != t1])
    u1 = random.choice(UNITS)
    u2 = random.choice([u for u in UNITS if u != u1])
    rent1 = random.choice([25000, 30000, 35000])
    rent2 = random.choice([20000, 22000, 28000])

    requests = [
        {"message": f"Create company admin for {company} called {admin}."},
        {"message": f"Create new tenants: {t1}, {t2} under {company}."},
        {"message": f"Assign units {u1} and {u2} to {t1} and {t2} respectively."},
        {"message": f"Update rent for unit {u1} to {rent1} and unit {u2} to {rent2}."},
        {"message": f"Generate monthly rent report for {company}."},
        {"message": f"Notify {t1} and {t2} about their new rent amounts via WhatsApp."}
    ]

    return {
        "workflow_id": f"wf_onboard_{id_num:03d}",
        "actor": "SUPER_ADMIN",
        "goal": f"Onboard {company}, add tenants {t1}/{t2}, and generate report.",
        "requests": requests,
        "expected_outcome": {
            "company_admin_created": True,
            "tenants_created": True,
            "units_assigned": True,
            "rent_updated": True,
            "report_generated": True
        }
    }

def generate_audit_investigation(id_num):
    admin = random.choice(ADMINS)
    tenant = random.choice(TENANTS)
    company = random.choice(COMPANIES)

    requests = [
        {"message": f"Show audit logs for user {admin} from last week."},
        {"message": f"Filter logs for any delete operations in {company}."},
        {"message": f"Identify who deleted the record for tenant {tenant}."},
        {"message": f"Recreate the deleted tenant record for {tenant} under {company}."},
        {"message": f"Log a security incident regarding unauthorized deletion by {admin}."},
        {"message": f"Send a summary of this investigation to the global security mailbox."}
    ]

    return {
        "workflow_id": f"wf_audit_{id_num:03d}",
        "actor": "SUPER_ADMIN",
        "goal": f"Investigate deletion of {tenant} by {admin} and restore data.",
        "requests": requests,
        "expected_outcome": {
            "logs_reviewed": True,
            "culprit_identified": True,
            "data_restored": True,
            "incident_logged": True
        }
    }

def generate_bulk_ops(id_num):
    company = random.choice(COMPANIES)
    
    requests = [
        {"message": f"Import properties for {company} from properties_batch.csv."},
        {"message": f"List all units that were created without a landlord assigned."},
        {"message": f"Bulk assign {random.choice(ADMINS)} as the company admin for all new units in {company}."},
        {"message": f"Generate a portfolio summary for {company} showing total unit count."},
        {"message": f"Alert me if any property in {company} has more than 5 vacant units."}
    ]

    return {
        "workflow_id": f"wf_bulk_{id_num:03d}",
        "actor": "SUPER_ADMIN",
        "goal": f"Bulk import and setup properties for {company}.",
        "requests": requests,
        "expected_outcome": {
            "properties_imported": True,
            "admin_assigned": True,
            "summary_generated": True,
            "alert_rule_created": True
        }
    }

def generate_compliance_monitoring(id_num):
    requests = [
        {"message": "Show me all companies with more than 10% unpaid tenants this month."},
        {"message": "List specific overdue tenants for the top 3 offending companies."},
        {"message": f"Freeze account access for {random.choice(COMPANIES)} due to compliance failure."},
        {"message": "Generate a global compliance report for all property groups."},
        {"message": "Schedule a follow-up alert for Monday to check payment status again."}
    ]

    return {
        "workflow_id": f"wf_compliance_{id_num:03d}",
        "actor": "SUPER_ADMIN",
        "goal": "Monitor payment compliance and take action on laggards.",
        "requests": requests,
        "expected_outcome": {
            "risk_identified": True,
            "action_taken": True,
            "report_generated": True
        }
    }

def generate_disaster_recovery(id_num):
    txn_id = f"TXN{random.randint(100000, 999999)}"
    
    requests = [
        {"message": f"Identify all failed M-Pesa transactions for today."},
        {"message": f"Check status of transaction {txn_id} specifically."},
        {"message": f"Reverse the failed payment {txn_id} and credit the tenant's wallet."},
        {"message": f"Notify the affected tenant about the reversal for {txn_id}."},
        {"message": "Generate a system health report focusing on payment gateway stability."},
        {"message": "Escalate the gateway timeout issues to the dev team."}
    ]

    return {
        "workflow_id": f"wf_recovery_{id_num:03d}",
        "actor": "SUPER_ADMIN",
        "goal": f"Recover failed transaction {txn_id} and notify user.",
        "requests": requests,
        "expected_outcome": {
            "failure_identified": True,
            "reversal_complete": True,
            "tenant_notified": True,
            "system_escalated": True
        }
    }

def generate_payment_dispute(id_num):
    t = random.choice(TENANTS)
    company = random.choice(COMPANIES)
    amount = random.choice([5000, 7500, 10000])
    
    requests = [
        {"message": f"I've paid {amount} but my balance didn't update. Here is the receipt."},
        {"message": "Why was I charged a late fee? I paid on the 3rd."},
        {"message": "Please waive the late fee this once, I had a family emergency."},
        {"message": "Check my new balance after the waiver."},
        {"message": "Generate a statement showing the corrected balance."}
    ]
    
    return {
        "workflow_id": f"wf_dispute_{id_num:03d}",
        "actor": "TENANT",
        "goal": f"Handle a payment dispute and fee waiver for {t}.",
        "requests": requests,
        "expected_outcome": {
            "payment_verified": True,
            "penalty_reviewed": True,
            "waiver_applied": True,
            "statement_generated": True
        }
    }

def generate_maintenance_escalation(id_num):
    t = random.choice(TENANTS)
    unit = random.choice(UNITS)
    issue = random.choice(["broken elevator", "roof leak", "security gate failure"])
    
    requests = [
        {"message": f"Urgent: {issue} in {unit}. Please fix ASAP."},
        {"message": "It's been 2 hours, no one has come. What is the status?"},
        {"message": "I want to talk to the property manager, this is unacceptable."},
        {"message": "Assign the most senior technician immediately."},
        {"message": "Confirm when the parts are ordered and the ETA for completion."}
    ]
    
    return {
        "workflow_id": f"wf_escalate_{id_num:03d}",
        "actor": "TENANT",
        "goal": f"Escalate a maintenance issue for {issue} in {unit}.",
        "requests": requests,
        "expected_outcome": {
            "issue_logged": True,
            "manager_notified": True,
            "technician_assigned": True,
            "eta_provided": True
        }
    }

def generate_tenant_move_out(id_num):
    t = random.choice(TENANTS)
    unit = random.choice(UNITS)
    company = random.choice(COMPANIES)
    
    requests = [
        {"message": f"I am moving out of {unit} at the end of the month."},
        {"message": "Schedule a move-out inspection for Friday 2pm."},
        {"message": "Generate the inspection report and list any deductions."},
        {"message": "Calculate the deposit refund after deducting for the broken window."},
        {"message": "Process the refund to my M-Pesa and close my lease."}
    ]
    
    return {
        "workflow_id": f"wf_moveout_{id_num:03d}",
        "actor": "TENANT",
        "goal": f"Handle move-out process for {t} in {unit}.",
        "requests": requests,
        "expected_outcome": {
            "notice_recorded": True,
            "inspection_scheduled": True,
            "deductions_calculated": True,
            "refund_processed": True,
            "lease_closed": True
        }
    }

def main():
    workflows = []
    
    generators = [
        generate_tenant_onboarding,
        generate_audit_investigation,
        generate_bulk_ops,
        generate_compliance_monitoring,
        generate_disaster_recovery,
        generate_payment_dispute,
        generate_maintenance_escalation,
        generate_tenant_move_out
    ]
    
    # Generate 13 of each (Total 104)
    for i in range(1, 14):
        for gen in generators:
            workflows.append(gen(i))
            
    output_path = "/home/chris/aedra/test-suite/src/behavioral/workflow_suite.json"
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    with open(output_path, "w") as f:
        json.dump(workflows, f, indent=2)
    
    print(f"Generated {len(workflows)} workflows at {output_path}")

if __name__ == "__main__":
    main()
