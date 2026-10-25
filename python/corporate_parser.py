"""Conservative, deterministic corporate-event extraction. Python standard library only.

No model, download, API key or network access. Every proposed field cites a literal
source sentence. Uncertain, negated and ambiguous assertions are left for review.
"""
import datetime as dt
from decimal import Decimal, InvalidOperation, localcontext
import json
import re
import sys

VERSION = "python-rules-v1"
NAME = r"[A-ZÅÄÖÆØ][\w’'&-]*(?:[ \t]+(?:[A-ZÅÄÖÆØ][\w’'&-]*|of|and|the|&)){0,6}[ \t]+(?:AB|ASA|AS|A/S|ApS|Oyj|Oy|plc|PLC|Ltd\.?|Inc\.?|GmbH|Corporation|Limited|Group|SE)\b"
CURRENCIES = "DKK EUR GBP ISK NOK SEK USD CHF CAD AUD JPY CNY HKD SGD PLN CZK HUF RON ZAR BRL MXN INR".split()
SCALE = {"million": 10**6, "millions": 10**6, "miljoner": 10**6, "miljoner kronor": 10**6, "miljoonaa": 10**6, "mio": 10**6, "mn": 10**6, "m": 10**6, "billion": 10**9, "billions": 10**9, "miljarder": 10**9, "mrd": 10**9, "bn": 10**9, "thousand": 1000}
MONTHS = {name.lower(): i for i, name in enumerate(["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"], 1)}
DATE = r"\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}\s+(?:" + "|".join(MONTHS) + r")\s+\d{4}|(?:" + "|".join(MONTHS) + r")\s+\d{1,2},?\s+\d{4})\b"
# Bounded patterns avoid arbitrary regex evaluation from article data.
EVENT_RULES = [
    ("public-offer", "PUBLIC_OFFER", r"\b(?:public (?:cash |tender |takeover )?offer|takeover (?:offer|bid)|offentligt (?:uppköpserbjudande|uppkjøpstilbud)|offentligt købstilbud)\b"),
    ("merger", "MERGER", r"\b(?:merger agreement|agreed to merge|merger has been completed|fusion(?:savtal|splan))\b"),
    ("divestiture", "DIVESTITURE", r"\b(?:divest(?:ment|iture|s|ed)|avyttr(?:ar|at|ing))\b"),
    ("spin-off", "SPIN_OFF", r"\bspin[ -]off\b"),
    ("rights-issue", "RIGHTS", r"\b(?:rights issue|företrädesemission|fortegningsemission)\b"),
    ("ipo", "IPO", r"\b(?:initial public offering|IPO)\b"),
    ("private-acquisition", "ACQ_PRIVATE", r"\b(?:private acquisition|acquir\w* (?:the |a )?(?:privately held|private company|business)|förvärv(?:ar|at) (?:samtliga aktier|verksamheten))\b"),
    ("loan-refinancing", "REFI_LOAN", r"\b(?:refinanc\w* (?:its |the |existing )*(?:loan|credit|debt facilit)|refinancing (?:loan|credit|facilit))"),
    ("bond-issue", "BOND", r"\b(?:(?:issue[sd]?|placed|placing|issuance of|pricing of) (?:new |senior |secured |unsecured |sustainability-linked )*bonds?|bond issu(?:ance|e))\b"),
    ("strategic-review", "STRATEGIC_REVIEW", r"\b(?:strategic (?:review|alternatives)|strategisk översyn)\b"),
]
HISTORICAL = re.compile(r"\b(?:last year|previously completed|in (?:19|20)\d{2},? (?:the |we |it )?(?:acquired|completed)|prior acquisition|historical acquisition)\b", re.I)
NEGATION = re.compile(r"\b(?:not|never|no longer|hasn't|haven't|no (?:loan|bond|facilit|financ|commitment)\w*|inte|ikke|ej|ei)\b", re.I)


def sentences(text):
    cursor, pending = 0, None
    for part in re.split(r"(?<=[.!?])\s+(?=[A-ZÅÄÖÆØ])|\n+", text):
        part = part.strip()
        if not part:
            continue
        start = text.find(part, cursor)
        cursor = start + len(part)
        if len(part) < 12:
            if pending is None:
                pending = start
            continue
        quote = text[pending if pending is not None else start:cursor]
        pending = None
        if 12 <= len(quote) <= 800:
            yield quote


def exact_date(text):
    found = re.findall(DATE, text, re.I)
    if len(set(found)) != 1:
        return None
    value = found[0]
    try:
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
            return dt.date.fromisoformat(value).isoformat()
        tokens = value.replace(",", "").split()
        if tokens[0].isdigit():
            day, month, year = int(tokens[0]), MONTHS[tokens[1].lower()], int(tokens[2])
        else:
            month, day, year = MONTHS[tokens[0].lower()], int(tokens[1]), int(tokens[2])
        return dt.date(year, month, day).isoformat()
    except (ValueError, KeyError):
        return None


def money(text):
    """Only a unique explicit ISO amount. Ambiguous separators are not guessed."""
    code = "(?:" + "|".join(CURRENCIES) + ")"
    scale = "(?:" + "|".join(sorted(SCALE, key=len, reverse=True)) + ")"
    number = r"\d+(?:[.,\u00a0 ]\d+)*"
    pattern = rf"\b(?P<code>{code})\s*(?P<number>{number})\s*(?P<scale>{scale})?\b"
    matches = list(re.finditer(pattern, text, re.I))
    if len(matches) != 1:
        return None
    m = matches[0]
    raw = m.group("number").strip().replace("\u00a0", " ")
    if " " in raw:
        # Space groups must be conventional thousands groups.
        if not re.fullmatch(r"\d{1,3}(?: \d{3})+(?:[.,]\d{1,2})?", raw):
            return None
        raw = raw.replace(" ", "")
    if "," in raw and "." in raw:
        # US or continental notation only if grouping is unambiguous.
        if re.fullmatch(r"\d{1,3}(?:,\d{3})+\.\d{1,2}", raw):
            raw = raw.replace(",", "")
        elif re.fullmatch(r"\d{1,3}(?:\.\d{3})+,\d{1,2}", raw):
            raw = raw.replace(".", "").replace(",", ".")
        else:
            return None
    elif raw.count(",") > 1 or raw.count(".") > 1:
        sep = "," if "," in raw else "."
        if not re.fullmatch(r"\d{1,3}(?:" + re.escape(sep) + r"\d{3}){2,}", raw):
            return None
        raw = raw.replace(sep, "")
    elif re.search(r"[.,]\d{3}$", raw):
        return None  # 1,500 / 1.500 can mean either 1500 or 1.5.
    else:
        raw = raw.replace(",", ".")
    try:
        with localcontext() as context:
            context.prec = 80
            amount = Decimal(raw) * SCALE.get((m.group("scale") or "").lower(), 1)
        if not amount.is_finite() or amount < 0 or amount >= Decimal(10) ** 20:
            return None
        return m.group("code").upper(), format(amount, "f")
    except InvalidOperation:
        return None


def parse(text):
    if not isinstance(text, str) or not 100 <= len(text) <= 80000:
        raise ValueError("Article text must contain 100–80000 characters")
    rows, notes, rules = {}, [], set()

    def add(key, kind, field, value, quote, rule):
        if value is None:
            return
        if len(quote) < 12 or len(quote) > 800 or quote not in text:
            return
        row = rows.setdefault(key, {"key": key, "kind": kind, "fields": {}})
        existing = row["fields"].get(field)
        if existing and existing["value"] != value:
            row["fields"].pop(field, None)
            conflicts.add((key, field))
            notes.append(f"Conflicting {kind}.{field}; left for manual review")
        if (key, field) not in conflicts:
            row["fields"][field] = {"value": value, "quote": quote, "ruleId": rule}
            rules.add(rule)

    conflicts = set()
    people = {}

    def party(name, role, quote, rule):
        name = name.strip(" ,;:")
        if name.casefold().startswith(("the company", "the group")):
            return None
        identity = name.casefold()
        key = people.get(identity)
        if key is None:
            key = "party_" + str(len(people) + 1)
            people[identity] = key
            add(key, "Entity", "legal_name", name, quote, rule)
        if role:
            link = key + "_" + role.lower()
            add(link, "EventParty", "entity_id", key, quote, rule)
            add(link, "EventParty", "role", role, quote, rule)
        return key

    parts = list(sentences(text))
    event_type = None
    for sentence in parts[:4]:
        if HISTORICAL.search(sentence) or re.search(r"\b(?:does not|not planning|no plans|denies|rumou?r)\b", sentence, re.I):
            continue
        hits = [(rid, kind) for rid, kind, pattern in EVENT_RULES if re.search(pattern, sentence, re.I)]
        if hits:
            if len({kind for _, kind in hits}) > 1:
                notes.append("Multiple event types in lead text; classify manually")
                break
            rule, event_type = hits[0]
            add("event", "CorporateEvent", "event_type_id", event_type, sentence, rule)
            break

    acquisition = re.compile(rf"(?P<buyer>{NAME})\s+(?:has |have )?(?:(?:agreed to |will |plans to )?acquire[sd]?|förvärvar|förvärvat|kjøper|ostaa)\s+(?:all (?:of )?the shares in |all shares in |the shares of |the business of |a private company |the private company )?(?P<target>{NAME})(?:\s+from\s+(?P<seller>{NAME}))?")
    funding_count = 0
    for sentence in parts:
        historical = bool(HISTORICAL.search(sentence))
        negated = bool(NEGATION.search(sentence))
        if not historical and not negated:
            for m in acquisition.finditer(sentence):
                party(m.group("buyer"), "BUYER", sentence, "acquisition-parties")
                party(m.group("target"), "TARGET", sentence, "acquisition-parties")
                if m.group("seller"):
                    party(m.group("seller"), "SELLER", sentence, "acquisition-parties")
            # Explicit incorporation/domicile; headquarters is not legal domicile.
            countries = {"Sweden": "SE", "Norway": "NO", "Finland": "FI", "Denmark": "DK", "Iceland": "IS"}
            for m in re.finditer(rf"(?P<name>{NAME}),?\s+(?:(?:is |a company )?(?:incorporated|domiciled|registered) in)\s+(?P<country>Sweden|Norway|Finland|Denmark|Iceland)\b", sentence):
                key = party(m.group("name"), None, sentence, "explicit-domicile")
                if key:
                    add(key, "Entity", "domicile", countries[m.group("country")], sentence, "explicit-domicile")
                    add(key + "_nordic", "EventJurisdiction", "country", countries[m.group("country")], sentence, "explicit-domicile")
                    add(key + "_nordic", "EventJurisdiction", "nexus_entity_id", key, sentence, "explicit-domicile")
                    add(key + "_nordic", "EventJurisdiction", "nexus_role", "DOMICILE", sentence, "explicit-domicile")

        root_noun = r"(?:acquisition|purchase|transaction|förvärvet)" if event_type in ("ACQ_PRIVATE", "DIVESTITURE", "ASSET_SALE") else r"(?:offer|erbjudandet)" if event_type == "PUBLIC_OFFER" else r"merger" if event_type == "MERGER" else None
        if root_noun and not historical:
            completed = re.search(rf"\b(?:has |have )?(?:completed|closed) (?:the |its )?{root_noun}\b|\b{root_noun} (?:has|have) (?:now )?been (?:completed|closed)\b", sentence, re.I)
            expected = re.search(r"\b(?:expected|expects|planned|will|would|subject to|not yet)\b", sentence, re.I)
            if completed and not negated and not expected:
                add("event", "CorporateEvent", "lifecycle_phase", "COMPLETION", sentence, "explicit-event-completion")
                add("event", "CorporateEvent", "disposition", "COMPLETED", sentence, "explicit-event-completion")
                date = exact_date(sentence)
                if re.search(r"\b(?:on|effective)\b", sentence, re.I):
                    add("event", "CorporateEvent", "actual_completion_at", date, sentence, "explicit-event-completion-date")
            if not negated and re.search(rf"\b{root_noun} (?:has been |was |is )?(?:withdrawn|terminated|lapsed)\b", sentence, re.I):
                state = "WITHDRAWN" if re.search("withdrawn", sentence, re.I) else "TERMINATED" if re.search("terminated", sentence, re.I) else "LAPSED"
                add("event", "CorporateEvent", "disposition", state, sentence, "explicit-event-disposition")
            if not negated and not re.search(r"\b(?:financing|loan|bond|credit)\b", sentence, re.I) and re.search(r"\b(?:completion|closing) is expected (?:on|by)|\bexpected to (?:complete|close) on\b", sentence, re.I):
                add("event", "CorporateEvent", "expected_close_start", exact_date(sentence), sentence, "explicit-expected-close-date")
            if not negated and re.search(r"\b(?:offer|transaction|acquisition) (?:remains|is) active\b", sentence, re.I):
                add("event", "CorporateEvent", "disposition", "ACTIVE", sentence, "explicit-active-event")
            if not negated and re.search(r"\b(?:has signed|signed a|entered into a) (?:definitive |binding )?(?:acquisition |merger |sale )?agreement\b", sentence, re.I) and not re.search(r"\b(?:loan|credit|financing|hedg)\w*\b", sentence, re.I):
                add("event", "CorporateEvent", "lifecycle_phase", "COMMITMENT", sentence, "signed-transaction-agreement")

        # Conditions do not prove overall completion or overall regulatory clearance.
        if not negated and not historical and re.search(r"\bsubject to (?:customary )?(?:regulatory|antitrust|competition) (?:approval|clearance)s?\b", sentence, re.I):
            add("regulatory_condition", "Condition", "condition_type", "REGULATORY", sentence, "pending-regulatory-condition")
            add("regulatory_condition", "Condition", "state", "OPEN", sentence, "pending-regulatory-condition")

        instruments = [("REVOLVER", r"\brevolving (?:credit |loan )?facilit"), ("BRIDGE", r"\bbridge (?:loan|facilit|financ)"), ("BOND", r"\bbonds?\b"), ("LOAN", r"\b(?:term loan|loan facilit|loan agreement|loan)\b")]
        instrument = next((kind for kind, pattern in instruments if re.search(pattern, sentence, re.I)), None)
        # A historical repayment, proposed facility or financial-reporting paragraph is not a draw.
        if not instrument or historical or re.search(r"\b(?:last year|comparative|previous year|reporting currency|enterprise value|purchase price|consideration|revenue|ebitda)\b", sentence, re.I):
            continue
        # Do not guess which of two amounts or facilities belongs to a particular instrument.
        money_value = money(sentence)
        currency_codes = set(re.findall(r"\b(?:" + "|".join(CURRENCIES) + r")\b", sentence, re.I))
        currency = money_value[0] if money_value else next(iter(currency_codes)).upper() if len(currency_codes) == 1 else None
        if len(re.findall(r"\b(?:loans?|bonds?|facilities)\b", sentence.split("\n")[-1], re.I)) > 1:
            notes.append("Multiple financing mentions in one sentence; left for manual allocation")
            continue
        prospective = re.search(r"\b(?:plans? to|intends? to|proposed|may |will |expects? to|expected to)\b", sentence, re.I)
        drawn = re.search(r"\b(?:has|have|was|were|been) (?:fully )?drawn(?: down)?\b", sentence, re.I)
        committed = re.search(r"\b(?:committed|has secured|have secured|signed)\b", sentence, re.I)
        # Local negation of draw does not negate an explicitly committed facility.
        not_drawn = re.search(r"\b(?:not|never|no amount|nothing|not yet)\b.{0,30}\bdrawn\b", sentence, re.I)
        if negated and not (not_drawn and committed and not re.search(r"\bnot (?:yet )?committed\b", sentence, re.I)):
            continue
        commit_future = re.search(r"\b(?:will|may|plans? to|intends? to|expects? to)\s+(?:be |obtain |provide )?(?:commit\w*|secur\w*|sign\w*)\b", sentence, re.I)
        status = "DRAWN" if drawn and not not_drawn else "COMMITTED" if committed and not commit_future else "PROPOSED" if prospective else None
        if not money_value and status is None:
            continue
        funding_count += 1
        key = "funding_" + str(funding_count)
        add(key, "FundingInstrument", "instrument_type", instrument, sentence, "explicit-funding-instrument")
        add(key, "FundingInstrument", "currency", currency, sentence, "explicit-funding-currency")
        add(key, "FundingInstrument", "certainty_status", status, sentence, "explicit-funding-state")
        if money_value and status in ("COMMITTED", "DRAWN"):
            add(key, "FundingInstrument", "drawn_amount" if status == "DRAWN" else "committed_amount", money_value[1], sentence, "explicit-funding-amount")
        elif money_value:
            notes.append(f"Reported funding amount {money_value[0]} {money_value[1]} has no explicit committed/drawn state; assign it manually")
        if re.search(r"\b(?:matures on|maturity date (?:is|of))\b", sentence, re.I):
            add(key, "FundingInstrument", "maturity", exact_date(sentence), sentence, "explicit-funding-maturity")
        borrower = re.search(rf"(?P<name>{NAME})\s+has\s+(?:secured|signed|drawn)", sentence)
        if borrower and not prospective:
            party_key = party(borrower.group("name"), "BORROWER", sentence, "explicit-borrower")
            add(key, "FundingInstrument", "borrower_id", party_key, sentence, "explicit-borrower")

    records = [r for r in rows.values() if r["fields"]]
    if len(records) > 25 or sum(len(r["fields"]) for r in records) > 60:
        raise ValueError("Rule result exceeds review limits; use a manually scoped review")
    return {"records": records, "ruleVersion": VERSION, "rulesMatched": sorted(rules), "notes": sorted(set(notes))}


if __name__ == "__main__":
    try:
        value = json.loads(sys.stdin.read(350001))
        print(json.dumps(parse(value.get("text")), ensure_ascii=False))
    except (ValueError, TypeError) as exc:
        print(json.dumps({"error": str(exc)}))
        sys.exit(1)
