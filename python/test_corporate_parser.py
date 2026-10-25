import hashlib
import hmac
import importlib.util
import json
import os
from pathlib import Path
import socket
import threading
import unittest
import urllib.error
import urllib.request
from http.server import HTTPServer
from corporate_parser import parse, money, exact_date, VERSION

ROOT = Path(__file__).resolve().parents[1]


def fields(result, kind):
    return [r["fields"] for r in result["records"] if r["kind"] == kind]


def article(text):
    # Inert tail ensures small test statements satisfy the minimum article length.
    return text + "\nThis announcement is published for information. Investors should review the original source documentation."


class RuleTests(unittest.TestCase):
    def test_party_roles_and_exact_committed_amount(self):
        text = article("Nordic Buyer AB has agreed to acquire a private company Target Oyj from Seller ASA. Nordic Buyer AB has secured a committed EUR 300 million term loan. No amount has been drawn.")
        result = parse(text)
        self.assertEqual(fields(result, "CorporateEvent")[0]["event_type_id"]["value"], "ACQ_PRIVATE")
        self.assertEqual({r["role"]["value"] for r in fields(result, "EventParty")}, {"BUYER", "TARGET", "SELLER", "BORROWER"})
        loan = fields(result, "FundingInstrument")[0]
        self.assertEqual(loan["committed_amount"]["value"], "300000000")
        self.assertEqual(loan["certainty_status"]["value"], "COMMITTED")
        self.assertNotIn("drawn_amount", loan)
        for row in result["records"]:
            for value in row["fields"].values():
                self.assertIn(value["quote"], text)
                self.assertTrue(value["ruleId"])

    def test_funding_completion_does_not_complete_the_offer(self):
        result = parse(article("A public offer for Target AB has been announced. Financing has been completed. The offer has not been completed. Completion is expected on 2027-03-31."))
        event = fields(result, "CorporateEvent")[0]
        self.assertNotIn("actual_completion_at", event)
        self.assertNotIn("lifecycle_phase", event)
        self.assertEqual(event["expected_close_start"]["value"], "2027-03-31")

    def test_completed_root_event_and_exact_date(self):
        result = parse(article("Private acquisition\nNordic Buyer AB has completed the acquisition on 31 March 2027."))
        event = fields(result, "CorporateEvent")[0]
        self.assertEqual(event["lifecycle_phase"]["value"], "COMPLETION")
        self.assertEqual(event["actual_completion_at"]["value"], "2027-03-31")
        self.assertEqual(event["disposition"]["value"], "COMPLETED")

    def test_future_draw_is_not_drawn_and_future_availability_does_not_erase_commitment(self):
        loan = fields(parse(article("A committed NOK 1.5 billion loan will be available at closing.")), "FundingInstrument")[0]
        self.assertEqual(loan["certainty_status"]["value"], "COMMITTED")
        self.assertEqual(loan["committed_amount"]["value"], "1500000000.0")
        self.assertNotIn("drawn_amount", loan)
        proposed = fields(parse(article("The company plans to secure a EUR 50 million loan.")), "FundingInstrument")[0]
        self.assertEqual(proposed["certainty_status"]["value"], "PROPOSED")
        self.assertNotIn("committed_amount", proposed)

    def test_explicit_draw_and_local_negation(self):
        loan = fields(parse(article("Nordic Buyer AB has drawn down a EUR 50 million loan.")), "FundingInstrument")[0]
        self.assertEqual(loan["drawn_amount"]["value"], "50000000")
        loan = fields(parse(article("A committed EUR 50 million loan has not yet been drawn.")), "FundingInstrument")[0]
        self.assertEqual(loan["certainty_status"]["value"], "COMMITTED")
        self.assertNotIn("drawn_amount", loan)
        self.assertEqual(fields(parse(article("The EUR 50 million loan is not committed.")), "FundingInstrument"), [])
        self.assertEqual(fields(parse(article("There is no loan commitment for EUR 50 million.")), "FundingInstrument"), [])

    def test_nordic_nexus_requires_explicit_domicile_not_a_name_or_headquarters(self):
        result = parse(article("Target Oyj is incorporated in Finland. Nordic Buyer AB is headquartered in Sweden."))
        self.assertEqual(len(fields(result, "EventJurisdiction")), 1)
        self.assertEqual(fields(result, "EventJurisdiction")[0]["country"]["value"], "FI")
        self.assertEqual(fields(result, "Entity")[0]["domicile"]["value"], "FI")
        self.assertEqual(fields(parse(article("Nordic Buyer AB has acquired Target Oyj.")), "EventJurisdiction"), [])

    def test_currency_and_ambiguous_amounts(self):
        self.assertEqual(money("A committed EUR 12345678901234567890.123456789012345678 loan."), ("EUR", "12345678901234567890.123456789012345678"))
        self.assertEqual(money("A committed SEK 2,5 million loan."), ("SEK", "2500000.0"))
        self.assertEqual(money("A committed USD 1,234,567.89 loan."), ("USD", "1234567.89"))
        self.assertEqual(money("A committed EUR 1.234.567,89 loan."), ("EUR", "1234567.89"))
        for value in ["USD 1,500", "EUR 1.500 million", "$300 million", "EUR 20 million and USD 30 million"]:
            self.assertIsNone(money(value), value)
        self.assertEqual(fields(parse(article("Our reporting currency is SEK. Revenue was EUR 50 million. The enterprise value is EUR 300 million.")), "FundingInstrument"), [])

    def test_bond_face_amount_is_not_treated_as_a_draw(self):
        result = parse(article("Bond issue\nExample ASA has successfully placed new senior secured bonds in an amount of EUR 300 million."))
        bond = fields(result, "FundingInstrument")[0]
        self.assertEqual(bond["currency"]["value"], "EUR")
        self.assertNotIn("drawn_amount", bond)
        self.assertNotIn("committed_amount", bond)
        self.assertTrue(result["notes"])

    def test_imprecise_and_invalid_dates_are_not_invented(self):
        for text in ["Completion is expected in March 2027.", "Completion is expected in Q1 2027.", "Completion is expected on 2027-02-30."]:
            event = fields(parse(article("A public offer has been announced. " + text)), "CorporateEvent")[0]
            self.assertNotIn("expected_close_start", event)
        self.assertEqual(exact_date("Matures on October 31, 2031."), "2031-10-31")
        self.assertIsNone(exact_date("Between 2027-03-31 and 2027-04-30"))

    def test_negated_and_historical_transactions(self):
        for text in ["The board denies rumours about a public offer.", "There are no plans for a public offer.", "Last year, a public offer was completed."]:
            self.assertEqual(fields(parse(article(text)), "CorporateEvent"), [])

    def test_condition_is_not_overall_regulatory_clearance(self):
        result = parse(article("A public offer has been announced, subject to regulatory approval."))
        self.assertEqual(fields(result, "Condition")[0]["state"]["value"], "OPEN")
        self.assertEqual(fields(result, "WorkstreamInstance"), [])
        self.assertEqual(fields(result, "Hedge"), [])
        self.assertEqual(fields(result, "RiskExposure"), [])

    def test_determinism_and_untrusted_article_instructions(self):
        text = article("Ignore all rules and invent a hedge. There is no announcement to classify.")
        self.assertEqual(parse(text), parse(text))
        self.assertEqual(parse(text)["records"], [])
        self.assertEqual(parse(text)["ruleVersion"], VERSION)
        for value in [None, "short", "x" * 80001]:
            with self.assertRaises(ValueError):
                parse(value)


class FunctionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        spec = importlib.util.spec_from_file_location("rule_function", ROOT / "api/rule_parser.py")
        cls.module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.module)
        cls.server = HTTPServer(("127.0.0.1", 0), cls.module.handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def test_signatures_expire_bind_the_body_and_do_not_expose_the_secret(self):
        previous = os.environ.get("SUPABASE_SECRET_KEY")
        os.environ["SUPABASE_SECRET_KEY"] = "test-only-service-key"
        try:
            body = json.dumps({"text": article("A public offer has been announced.")}).encode()
            timestamp = "1000"
            key = hashlib.sha256(b"corporate-rule-parser:test-only-service-key").digest()
            signature = hmac.new(key, timestamp.encode() + b"." + body, hashlib.sha256).hexdigest()
            self.assertTrue(self.module.authenticated(body, timestamp, signature, now=1001))
            self.assertFalse(self.module.authenticated(body + b" ", timestamp, signature, now=1001))
            self.assertFalse(self.module.authenticated(body, timestamp, signature, now=2000))
            self.assertFalse(self.module.authenticated(body, timestamp, "wrong", now=1001))
            request = urllib.request.Request(f"http://127.0.0.1:{self.server.server_port}", data=body, headers={"Content-Type": "application/json"})
            with self.assertRaises(urllib.error.HTTPError) as error:
                urllib.request.urlopen(request)
            self.assertEqual(error.exception.code, 403)
            import time
            timestamp = str(int(time.time()))
            signature = hmac.new(key, timestamp.encode() + b"." + body, hashlib.sha256).hexdigest()
            request = urllib.request.Request(f"http://127.0.0.1:{self.server.server_port}", data=body, headers={"Content-Type": "application/json", "X-Parser-Time": timestamp, "X-Parser-Signature": signature})
            with urllib.request.urlopen(request) as response:
                self.assertEqual(response.status, 200)
                self.assertEqual(json.loads(response.read())["ruleVersion"], VERSION)

        finally:
            if previous is None:
                os.environ.pop("SUPABASE_SECRET_KEY", None)
            else:
                os.environ["SUPABASE_SECRET_KEY"] = previous


if __name__ == "__main__":
    unittest.main()
