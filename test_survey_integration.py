import sys
import os
import json
import sqlite3

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

import server
from email_service import get_survey_welcome_template

def test_survey_full_flow():
    print('\n--- 1. Testing DB Tables ---', flush=True)
    server.init_db()
    conn = server.get_conn()
    cust_cols = [r['name'] for r in conn.execute("PRAGMA table_info(customers)").fetchall()]
    lead_cols = [r['name'] for r in conn.execute("PRAGMA table_info(leads)").fetchall()]
    conn.close()
    
    assert 'kind' in cust_cols, 'customers table must have kind column'
    assert 'code_used' in lead_cols, 'leads table must have code_used column'
    print('DB schema verified: kind in customers, code_used in leads.', flush=True)

    print('\n--- 2. Testing Welcome Email Template ---', flush=True)
    subject, text, html = get_survey_welcome_template('Tri Dang', 'tangductri15@gmail.com', 'LAUNHA50K')
    assert '50.000' in subject
    assert 'LAUNHA50K' in html
    assert 'zalo.me' in html
    assert 'open_chat=1' in html
    print('Email template verified: Promo code LAUNHA50K and 2 CTA buttons (Zalo, Chatbot) present.', flush=True)

    print('\n--- 3. Testing Survey Submission Handler ---', flush=True)
    payload = server.LeadCreatePayload(
        name='Nguyen Thi Thu Nghiem',
        phone='0988776655',
        email='test_lead_survey@laumangdi.com',
        eat_with='Dong Nghiep Van Phong',
        frequency='Tu 3 - 5 lan',
        main_concern='Ve sinh va don dep nhanh',
        interested_in_service='Co, rat hung thu!',
        discount_code='LAUNHA50K',
        raw_answers={
            'eat_with': 'Dong Nghiep Van Phong',
            'frequency': 'Tu 3 - 5 lan',
            'main_concern': 'Ve sinh va don dep nhanh',
            'interested_in_service': 'Co, rat hung thu!'
        }
    )
    
    res_data = server.handle_survey_submission(payload)
    assert res_data['success'] is True
    assert res_data['discount_code'] == 'LAUNHA50K'
    lead_id = res_data['lead_id']
    customer_id = res_data['customer_id']
    print(f'Survey submitted successfully: lead_id={lead_id}, customer_id={customer_id}', flush=True)

    print('\n--- 4. Verifying Customer in brain.db has kind=lead ---', flush=True)
    conn = server.get_conn()
    cust = conn.execute('SELECT * FROM customers WHERE id = ?', (customer_id,)).fetchone()
    assert cust is not None
    cust_kind = cust['kind']
    assert cust_kind == 'lead', f"Customer kind should be lead, got {cust_kind}"
    assert cust['name'] == payload.name
    assert cust['email'] == payload.email
    assert cust['phone'] == payload.phone
    print(f"Customer in brain.db verified: Name={cust['name']}, Kind={cust_kind}", flush=True)

    print('\n--- 5. Verifying Leads Table in brain.db ---', flush=True)
    lead = conn.execute('SELECT * FROM leads WHERE id = ?', (lead_id,)).fetchone()
    assert lead is not None
    assert lead['name'] == payload.name
    assert lead['eat_with'] == payload.eat_with
    assert lead['code_used'] == 0
    assert lead['discount_code'] == 'LAUNHA50K'
    conn.close()
    print(f"Lead record verified: EatWith={lead['eat_with']}, CodeUsed={lead['code_used']}", flush=True)

    print('\n--- 6. Testing Toggle Code Used API ---', flush=True)
    toggle_res = server.toggle_lead_code_used(lead_id)
    assert toggle_res['code_used'] == 1
    print('Toggle code_used to 1 verified.', flush=True)

    toggle_res2 = server.toggle_lead_code_used(lead_id)
    assert toggle_res2['code_used'] == 0
    print('Toggle code_used back to 0 verified.', flush=True)

    print('\n--- 7. Testing List Leads API ---', flush=True)
    leads_list = server.list_leads()
    assert any(x['id'] == lead_id for x in leads_list)
    print(f'List leads API verified: Found {len(leads_list)} leads.', flush=True)

    print('\n--- ALL INTEGRATION TESTS PASSED SUCCESSFULLY! ---', flush=True)

if __name__ == '__main__':
    test_survey_full_flow()
