# Corporate event states: Corporate Finance and FICC reference model

Version 1.0 | 25 October 2026 | Designed for the Nordic M&A Monitor

## 1. Design decision

Use a composable event graph with separate lifecycle, workstream, evidence and economic states. A single drop-down of transaction stages cannot represent a real process reliably. This is a proposed banking data ontology; the event paths are practitioner reference templates, not legally prescribed sequences. Country and transaction documents determine applicable gates.

An event is a bounded economic or legal change. A programme groups related changes. A pursuit represents one bidder in a sale process. A milestone is a dated occurrence. A workstream is a concurrent process. A condition is a gate. An exposure is a risk borne by a named entity. A hedge is an actual contract, separate from the potential advisory opportunity.

Example: a sponsor's acquisition of a listed industrial company can comprise a TAKE_PRIVATE programme, a PUBLIC_OFFER implementation event, an LBO financing overlay, a BOND refinancing child event and an ASSET_SALE remedy. These are related records, not five independent acquisition values.

Divestiture and divestment are aliases for a disposal objective. Carve-out is a separation method. LBO is a financing and ownership overlay. IPO is an issuance/listing route. Restructuring must distinguish financial restructuring, operational restructuring and formal insolvency processes.

Rumoured is an evidence classification, not proof that a process has begun. An event can be reported as signed while observed diligence is unknown. Unknown is never equivalent to not started.

## 2. Classification dimensions

| Dimension | Values / design |
|---|---|
| Economic purpose | Ownership change; capital raising; liability management; separation; capital return; distress resolution; strategic review |
| Route | Bilateral; restricted auction; broad auction; public offer; scheme; statutory merger; listing; exchange; court process |
| Control | None; minority; joint control; majority; full ownership; unknown |
| Ownership transition | Private-to-private; public-to-private; private-to-public; public-to-public; intra-group |
| Buyer / seller class | Corporate; sponsor; infrastructure fund; family; sovereign; management; creditor; dispersed investors |
| Consideration | Cash; shares; mixed; asset contribution; debt assumption; rollover; earn-out; deferred consideration |
| Financing | Corporate balance sheet; leveraged; bridge; project finance; equity; mixed; unknown |
| Initiation / support | Solicited or unsolicited; recommended, opposed, neutral or unknown; voluntary or mandatory offer |
| Certainty | Rumour; reported; official; analyst inference; model estimate, attached at claim level |
| Market access | Confidential; public; restricted / wall-crossed; access controlled |
| Scope | Whole company; subsidiary; business unit; assets; portfolio; liabilities; securities |
| Geography | Domicile, operating location, listing venue, governing law and authority jurisdiction separately |

Use stable IDs for all enums; labels can be translated and renamed without rewriting history. Store aliases and ontology versions.

## 3. Common lifecycle and independent state dimensions

| Phase | Meaning | Possible evidence |
|---|---|---|
| ORIGINATION | Opportunity or need identified | Internal strategic mandate or sourced market claim |
| STRATEGIC_REVIEW | Options and feasibility assessed | Review announcement, board mandate |
| PREPARATION | Team, perimeter, materials and readiness established | Adviser appointment, vendor diligence |
| MARKETING_OR_ENGAGEMENT | Buyers, partners, investors or lenders engaged | Teaser, approach, financing launch |
| EVALUATION | Valuation, diligence, feedback or bids evaluated | Bid submission, diligence update |
| NEGOTIATION_AND_SELECTION | Terms and counterparties selected | Negotiation, preferred bidder, exclusivity |
| COMMITMENT | Applicable binding instrument executed or obligation undertaken | SPA, offer commitment, underwriting or credit agreement |
| CONDITIONS_AND_EXECUTION | Remaining gates and settlement steps managed | Approval filing, acceptance process, CP checklist |
| COMPLETION | Defined event-specific legal/economic result achieved | Ownership transfer, debt draw, issue settlement, plan effectiveness |
| POST_COMPLETION | Residual obligations and implementation managed | Earn-out, TSA exit, bridge takeout, integration |

Phase is a summary of the route's principal progression; it is not inferred from the most advanced activity in any workstream. Signing a debt commitment does not move an unsigned acquisition to COMMITMENT. Completion predicates are event-specific and versioned.

Record disposition independently: ACTIVE, ON_HOLD, WITHDRAWN, TERMINATED, LAPSED, SUPERSEDED, COMPLETED. Record outcome separately: UNKNOWN, SUCCESS, PARTIAL_SUCCESS, FAILURE, NO_ACTION. Completed lifecycle, continuing post-close tasks and successful outcome can coexist by defining the parent event boundary and residual child tasks explicitly.

Milestone status: UNKNOWN, PLANNED, IN_PROGRESS, ACHIEVED, FAILED, WAIVED, NOT_APPLICABLE, DISPUTED, REVOKED. Occurrences remain immutable; corrections supersede earlier assertions. A revoked approval does not erase the original approval occurrence.

There is no universal percentage complete. Forecast completion probability, evidence confidence and commercial opportunity score are three different quantities.

## 4. Parallel workstreams

**COMMERCIAL:** NOT_STARTED → ACTIVE → TERMS_PROPOSED → TERMS_AGREED → COMPLETE.

**DILIGENCE:** NOT_STARTED → SCOPING → ACCESS_GRANTED → IN_PROGRESS → ISSUES_IDENTIFIED → REMEDIATION → SUBSTANTIALLY_COMPLETE → COMPLETE.

**DOCUMENTATION:** NOT_STARTED → DRAFTING → NEGOTIATING → AGREED_FORM → EXECUTED → EFFECTIVE.

**FINANCING:** NOT_ASSESSED → CAPACITY_ASSESSED → MARKET_SOUNDING → INDICATIVE_TERMS → CREDIT_APPROVED → COMMITTED → DOCUMENTED → AVAILABLE → PARTIALLY_DRAWN → DRAWN → REFINANCED → REPAID.

**REGULATORY:** APPLICABILITY_UNASSESSED → NOT_REQUIRED → PRE_NOTIFICATION → FILED → IN_REVIEW → IN_DEPTH_REVIEW → REMEDIES_NEGOTIATED → CONDITIONAL_CLEARANCE → CLEARED → PROHIBITED → WITHDRAWN.

**SHAREHOLDER:** NOT_ASSESSED → NOT_REQUIRED → DOCUMENTATION → MEETING_OR_ELECTION_SCHEDULED → VOTING_OR_ELECTION_OPEN → APPROVED → REJECTED.

**SEPARATION:** NOT_REQUIRED → SCOPING → DESIGN → IMPLEMENTATION → DAY_ONE_READY → LEGALLY_SEPARATED → TSA_ACTIVE → TSA_EXITED.

**HEDGING:** NOT_ASSESSED → EXPOSURE_IDENTIFIED → DATA_VALIDATED → STRATEGY_REVIEW → INDICATIVE_QUOTE → CREDIT_AND_DOCUMENTATION_READY → EXECUTABLE_QUOTE → EXECUTED → MONITORED → RESIZED → ROLLED → SETTLED → TERMINATED.

**CLOSING:** NOT_READY → CHECKLIST_OPEN → FUNDS_FLOW_AGREED → CONDITIONS_CONFIRMED → READY → FUNDED → SETTLED → OWNERSHIP_EFFECTIVE → RECONCILED.

These are vocabulary lists with typical display order, not universal legal transition chains. For example, FINANCING can move directly from COMMITTED to AVAILABLE on some facilities, HEDGING can cycle through RESIZED or ROLLED, and REGULATORY records are separate for each authority.

Additional workstream types: valuation and modelling; tax; accounting; legal; commercial diligence; financial diligence; technical/environmental diligence; HR and employee consultation; pensions; IT and cyber; communications and disclosure; integration; treasury and bank accounts; ratings; sanctions/KYC; syndication; collateral and security; earn-outs and post-close adjustments. Instantiate only those applicable to the event.

## 5. Event catalogue and reference process paths

Every path below is an illustrative sequence for display. Steps can overlap, repeat, be skipped with a reason, or follow a different route. Dependencies must be added at the case level. Milestones such as NDA, exclusivity, investment committee approval and quality of earnings are not universally mandatory.

### 1. Private company acquisition (`ACQ_PRIVATE`; Ownership)

Strategic rationale → Target identified → Initial approach → NDA executed → Information memorandum received → Indicative offer submitted → Management presentation → Data room opened → Due diligence underway → Quality of earnings reviewed → SPA negotiated → Final binding bid submitted → Preferred bidder selected → Exclusivity granted → Investment approval obtained → Financing committed → SPA signed → Conditions precedent managed → Closing readiness confirmed → Consideration settled → Ownership transferred → Completion accounts or earn-out administered.

**FICC / modelling:** SPA signing, price adjustment and currency of consideration determine exposure; buyer purchase currency and seller proceeds currency are separate legs.

### 2. Sell-side competitive auction (`SALE_AUCTION`; Ownership)

Exit review → Advisers appointed → Vendor due diligence commissioned → Teaser prepared → Buyer longlist approved → Outreach launched → NDAs executed → Information memoranda distributed → Round-one bids received → Shortlist selected → Management presentations → Confirmatory diligence → SPA markup distributed → Final bids received → Preferred bidder selected → Exclusivity granted → SPA signed → Approvals obtained → Closing → Proceeds distributed.

**FICC / modelling:** One campaign has many bidder pursuits; do not treat every NDA or bid as progress by the eventual buyer.

### 3. Take-private programme (`TAKE_PRIVATE`; Ownership)

Sponsor thesis → Consortium formed → Target approach → Confidential diligence if permitted → Equity commitment arranged → Debt commitment arranged → Investment approval → Binding offer decision → Public offer or scheme launched → Board recommendation recorded → Shareholder and regulatory processes → Offer unconditional or scheme effective → Settlement → Control obtained → Residual minority process → Delisting.

**FICC / modelling:** Compose with public-offer or scheme route and optional LBO financing. Settlement, ownership percentage, squeeze-out and delisting are separate milestones.

### 4. Public contractual takeover offer (`PUBLIC_OFFER`; Ownership)

Stake or approach disclosed → Possible offer announced → Due diligence if permitted → Funding certainty established → Firm offer announced → Offer document published → Acceptance period opened → Board response → Regulatory review → Offer revised if applicable → Acceptance results announced → Conditions satisfied or lawfully waived → Offer unconditional → Settlement → Extended acceptance if applicable → Minority acquisition if applicable.

**FICC / modelling:** Track voluntary versus mandatory and recommended versus hostile independently; never presume private-sale exclusivity or unrestricted diligence.

### 5. Court-sanctioned scheme acquisition (`SCHEME`; Ownership)

Confidential negotiation → Implementation agreement signed → Firm transaction announced → Scheme circular prepared → Meeting convening process → Shareholder meetings → Required votes obtained → Regulatory clearances → Court sanction → Order delivered or registered as required → Scheme effective → Cash and securities settled → Listing cancelled.

**FICC / modelling:** Jurisdiction-specific route, not a standard Nordic takeover step. Court sanction and legal effectiveness must not be conflated.

### 6. Leveraged buyout financing overlay (`LBO`; Financing)

Sponsor screening → LBO model → Debt capacity assessed → Management incentive design → Lender sounding → Debt term sheets → Credit approvals → Equity commitments → Debt commitments → Intercreditor and security negotiation → Financing documents signed → Syndication or flex managed → Draw conditions satisfied → Acquisition funding drawn → Purchase funded → Bridge refinanced → Post-close hedging implemented.

**FICC / modelling:** Attach to an acquisition rather than recording another independent purchase; distinguish committed, syndicated, drawn and refinanced debt.

### 7. Negotiated merger or business combination (`MERGER`; Ownership)

Strategic dialogue → NDA → Mutual valuation → Exchange ratio negotiated → Mutual diligence → Synergy assessment → Governance and domicile agreed → Merger agreement signed → Public announcement → Shareholder documentation → Financing and capital actions → Shareholder approvals → Regulatory approvals → Legal effectiveness → Share exchange → Operational integration.

**FICC / modelling:** Cash boot, exchange ratio, dividend adjustments and post-merger debt currency are separate economic terms.

### 8. Minority or growth equity investment (`MINORITY`; Ownership)

Capital or partner review → Investor outreach → NDA → Indicative terms → Valuation and governance negotiation → Diligence → Investment approval → Subscription or share purchase agreement → Consents → Funding → Share issuance or transfer → Governance rights effective.

**FICC / modelling:** Primary issuance and secondary proceeds require separate cash legs; record vetoes and control rather than inferring control from percentage alone.

### 9. Joint venture formation or expansion (`JV`; Ownership)

Partner selection → NDA → Feasibility assessment → Heads of terms → Asset and business valuation → Diligence → Contribution and governance negotiation → JV agreement signed → Regulatory and third-party consents → Capital contributions → Assets transferred → JV operational → Funding and distributions monitored.

**FICC / modelling:** Separate cash contributions, contributed assets, shareholder loans, guarantees and future capex commitments.

### 10. Business divestiture / divestment (`DIVESTITURE`; Separation)

Portfolio review → Perimeter selected → Disposal method selected → Separation diligence → Tax and structuring → Buyer process launched → Bids evaluated → Separation plan → SPA signed → Carve-out and consents → Closing → Proceeds repatriated → TSA exit → Residual liabilities settled.

**FICC / modelling:** Divestiture and divestment are aliases here; a sale, spin-off or closure is a disposal route rather than another duplicate transaction.

### 11. Asset or asset portfolio sale (`ASSET_SALE`; Separation)

Asset identified → Title and encumbrances verified → Valuation → Buyer outreach → Asset diligence → Environmental and technical review → Offer accepted → Asset purchase agreement → Lien releases and consents → Payment → Title transfer → Tax and residual obligations settled.

**FICC / modelling:** Asset price, assumed liabilities, debt releases and tax are distinct; technical or commodity exposures may survive transfer.

### 12. Carve-out / separation programme (`CARVE_OUT`; Separation)

Perimeter defined → Standalone financials prepared → Shared services mapped → Legal entities designed → Tax structuring → Debt and cash allocation → Employee and contract mapping → IT and treasury separation → TSA terms agreed → Transfer documents signed → Consents obtained → Day-one readiness → Legal separation → Standalone operation → TSA exit.

**FICC / modelling:** Carve-out is a separation method; link to private sale, IPO or spin-off instead of treating readiness as a completed exit.

### 13. Spin-off / demerger (`SPIN_OFF`; Separation)

Strategic review → Perimeter defined → Feasibility and tax assessment → Standalone accounts → Capital structure allocation → Separation agreement → Board approval → Prospectus or information document if required → Creditor and shareholder procedures → Listing approval if applicable → Record date → Shares distributed → Separate trading if listed → TSA exit.

**FICC / modelling:** Normally no cash sale proceeds; cash equalisation, debt allocation, distributions and new hedges still create FICC legs.

### 14. Split-off / exchange distribution (`SPLIT_OFF`; Separation)

Separation plan → Standalone valuation → Exchange structure → Tax and legal approvals → Exchange documentation → Exchange offer launched → Elections received → Proration → Subsidiary shares exchanged → Parent shares retired → Separate operation.

**FICC / modelling:** Model voluntary exchange and participation rather than assuming a pro-rata spin-off.

### 15. Equity carve-out IPO (`EQUITY_CARVE_IPO`; Separation)

Subsidiary perimeter → Standalone readiness → Parent retention target → Separation and TSA → IPO preparation → Prospectus review → Investor education → Bookbuilding → Pricing → Settlement → Subsidiary listed → Parent retained stake monitored.

**FICC / modelling:** Compose separation plus IPO; record retained control and later sell-down as distinct linked events.

### 16. Initial public offering (`IPO`; Equity)

IPO feasibility → Readiness assessment → Banks and advisers appointed → Equity story → Governance and financial reporting readiness → Due diligence → Capital restructuring → Prospectus drafting → Regulatory and exchange review → Pilot fishing where permitted → Intention to float → Investor education → Price range announced → Bookbuilding → Underwriting and pricing → Allocation → First trading → Settlement → Stabilisation and over-allotment → Lock-up expiry.

**FICC / modelling:** Primary versus secondary mix and each selling shareholder currency matter; first trading is not proceeds settlement.

### 17. Direct listing / introduction (`DIRECT_LIST`; Equity)

Listing feasibility → Advisers appointed → Reporting readiness → Diligence → Listing documents → Regulatory review → Exchange admission → Reference price or auction → First trading → Ongoing disclosure.

**FICC / modelling:** Do not assume new proceeds or an underwritten bookbuild; any simultaneous capital raising requires its own structure.

### 18. Dual-track sale and IPO (`DUAL_TRACK`; Programme)

Exit review → Sale and IPO advisers → Shared readiness and diligence → Buyer outreach → IPO preparation → Sale bids → Investor feedback → Route economics compared → Route selected → Alternative track paused or terminated → Selected route executed.

**FICC / modelling:** Parent programme with competing child processes. Conditional outcomes and proceeds are mutually exclusive unless scope is deliberately split.

### 19. Follow-on equity offering / accelerated bookbuild (`FOLLOW_ON`; Equity)

Funding or sell-down decision → Mandate → Diligence and documentation → Wall-crossing where permitted → Launch → Bookbuilding → Price and allocation → Underwriting commitment → Settlement → Proceeds deployment → Lock-up monitoring.

**FICC / modelling:** Distinguish primary issuer fundraising from secondary shareholder sell-down and track each beneficiary.

### 20. Rights issue (`RIGHTS`; Equity)

Capital need → Underwriting discussions → Board proposal → Shareholder authorisation → Prospectus review → Terms fixed → Record date → Rights trading → Subscription period → Take-up results → Rump placement → Settlement → New shares admitted.

**FICC / modelling:** Subscription proceeds can vary with underwriting and take-up; underwriting obligations and currency are separate exposures.

### 21. Share repurchase / tender offer (`BUYBACK`; Equity)

Capital allocation review → Authority obtained → Programme or tender announced → Broker mandate → Trading or tender period → Purchases or acceptances → Settlement → Cancellation or treasury treatment → Programme complete.

**FICC / modelling:** Separate maximum authorisation from actual purchases, with rolling cash and FX settlement.

### 22. Special dividend / capital return (`SPECIAL_DIV`; Equity)

Excess capital assessment → Solvency and liquidity review → Board proposal → Shareholder approval if required → Ex-date → Record date → Payment → Withholding tax and repatriation.

**FICC / modelling:** Do not book acquisition proceeds a second time when subsequently distributed; identify intercompany versus external legs.

### 23. Loan refinancing (`REFI_LOAN`; Debt)

Maturity and liquidity review → Debt and hedge inventory → Funding strategy → Lender outreach → Term sheets → Credit approvals → Mandated arrangers selected → Facility negotiation → Security and consents → Facility signed → Conditions precedent → New debt drawn → Old debt repaid → Old security released → Hedges novated terminated or retained.

**FICC / modelling:** Signing a facility is not drawing it; map old and new debt and derivative break costs separately.

### 24. Bond issuance / refinancing (`BOND`; Debt)

Funding plan → Ratings engagement → Banks mandated → Documentation and diligence → Investor marketing → Issue announced → Books opened → Price guidance → Pricing → Allocation → Subscription agreement → Settlement and issuance → Old debt redemption if relevant → Proceeds swapped or deployed.

**FICC / modelling:** Track announcement, pricing and settlement independently; duration and FX exposure may crystallise at different times.

### 25. Private debt placement (`PRIVATE_DEBT`; Debt)

Borrower strategy → Lender selection → NDA and information pack → Diligence → Indicative terms → Credit committee → Exclusivity if agreed → Final documentation → Intercreditor and security → Commitment → Drawdown → Monitoring.

**FICC / modelling:** Allow delayed draws, PIK, unitranche and multi-currency tranches without duplicating the parent financing.

### 26. Amend-and-extend / repricing (`A_AND_E`; Debt)

Debt review → Lender approach → Consent thresholds mapped → Terms proposed → Lender commitments → Consent fees agreed → Amendment signed → Conditions satisfied → New maturity or margin effective → Hedge tenor reviewed.

**FICC / modelling:** Debt may remain outstanding with no principal cash movement; changed margin or maturity can trigger hedge review.

### 27. Debt tender / exchange / consent solicitation (`DEBT_TENDER`; Debt)

Liability review → Eligible instruments identified → Terms and documentation → Launch → Early participation deadline → Consent results → Expiry → Acceptance and proration → New debt pricing if linked → Settlement → Old debt cancellation.

**FICC / modelling:** Offer launch does not equal acceptance or settlement; model minimum conditions, proration and fallback outcomes.

### 28. Dividend recapitalisation (`DIVIDEND_RECAP`; Debt)

Sponsor distribution review → Debt capacity → Lender marketing → Diligence → Commitment → Financing documents → Drawdown → Dividend declaration → Dividend payment → Hedge resizing.

**FICC / modelling:** Separate new borrower leverage from sponsor receipt; related cash legs eliminate at group level where appropriate.

### 29. Bridge-to-permanent financing (`BRIDGE_TAKEOUT`; Debt)

Bridge mandate → Commitment → Acquisition funding readiness → Bridge draw if needed → Permanent funding preparation → Bond or term loan launch → Pricing or allocation → Permanent funding settlement → Bridge repayment → Hedge transfer.

**FICC / modelling:** Bridge can remain undrawn if permanent financing settles first; avoid assuming two simultaneous funded balances.

### 30. Securitisation / receivables financing (`SECURITISATION`; Debt)

Asset pool selection → Eligibility diligence → Structure and SPV → Ratings if relevant → Servicing and liquidity arrangements → Investor marketing → Documentation → Pricing → Assets transferred → Notes issued or facility drawn → Collections and waterfalls → Amortisation or revolving period end.

**FICC / modelling:** Currency mismatches, basis, prepayment, liquidity support and waterfall priority require pool and tranche records.

### 31. Project financing / infrastructure financial close (`PROJECT_FINANCE`; Debt)

Project development → Permits → Technical studies → Offtake or concession → Construction contracts → Financial model → Lender diligence → Terms and hedging strategy → Credit approval → Finance and security documents → Conditions precedent → Financial close → Staged drawdowns → Construction → Completion tests → Operations → Refinancing.

**FICC / modelling:** Development, financial close, first draw and commercial operation are distinct; track FX capex, interest during construction and commodity-linked revenue.

### 32. Sale and leaseback (`SALE_LEASEBACK`; Separation)

Asset selection → Lease versus own analysis → Valuation → Investor outreach → Lease terms → Buyer diligence → Sale and lease documents → Consents → Sale completion → Lease commencement → Lease payments.

**FICC / modelling:** Sale receipt and long-term rent create different currency and rate sensitivities; separate accounting classification from economics.

### 33. Out-of-court financial restructuring (`RESTRUCT_OOC`; Restructuring)

Liquidity stress detected → 13-week cash forecast → Advisers appointed → Creditor groups mapped → Standstill request → Independent business review → Options assessed → Term sheet → Creditor negotiations → Support agreement → Consent thresholds achieved → Definitive documents → New money → Debt amendment or equitisation → Restructuring effective → Monitoring.

**FICC / modelling:** Distress does not itself terminate derivatives; record contract-specific default, collateral, close-out and hedge replacement facts.

### 34. Formal restructuring / reorganisation (`RESTRUCT_COURT`; Restructuring)

Distress assessment → Procedure selection → Filing or application → Admission or opening order → Administrator appointed where applicable → Stay or moratorium → Claims verified → Business plan → Creditor classes → Plan proposal → Voting → Court confirmation if required → Conditions fulfilled → Plan effective → Exit financing → Emergence.

**FICC / modelling:** Use country and procedure overlays; voting, stays, priority and cram-down cannot be imported unchanged between jurisdictions.

### 35. Distressed M&A / insolvency asset sale (`DISTRESSED_SALE`; Restructuring)

Distress or filing → Seller authority verified → Accelerated marketing → NDA → Limited diligence → Bids → Funding proof → Preferred bidder → Sale agreement → Creditor or court approval where required → Payment → Assets or business transferred → Residual estate administered.

**FICC / modelling:** Link accelerated sale to restructuring case and asset perimeter; seller authority and clean-title assumptions require evidence.

### 36. Debt-for-equity swap (`DEBT_EQUITY_SWAP`; Restructuring)

Unsustainable leverage identified → Claims and valuation → Recovery analysis → Exchange terms → Creditor support → Equity authorisations → Regulatory approvals → Exchange documentation → Debt cancellation → Shares issued → Control and governance reset.

**FICC / modelling:** Track extinguished debt and hedge treatment separately; share issuance often has no corresponding cash receipt.

### 37. Operational restructuring / closure (`OP_RESTRUCT`; Restructuring)

Performance review → Plan developed → Board approval → Employee consultation where required → Announcement → Site or activity rationalisation → Contract exits → Asset disposals → Implementation payments → Savings achieved → Programme complete.

**FICC / modelling:** Restructuring provisions are not cash settlement; timing of redundancy, lease and commodity termination payments matters.

### 38. Liquidation / winding-up (`LIQUIDATION`; Restructuring)

Viability review → Decision or court order → Liquidator appointed → Claims registered → Assets realised → Secured claims resolved → Distributions by priority → Residual distribution → Dissolution.

**FICC / modelling:** Gross asset realisations differ from stakeholder recoveries; cash forecasts must respect priority and restricted cash.

### 39. Sponsor continuation vehicle / GP-led secondary (`CONTINUATION`; Ownership)

Portfolio review → Advisers → Asset valuation → Conflict process → Investor outreach → Diligence → Lead investor bid → LP election materials → Sell or roll elections → Financing → Transaction documents → Approvals → Settlement → Assets transferred to new vehicle.

**FICC / modelling:** Track selling LP cash, rolling interests, new investor funding and asset-level refinancing without double counting.

### 40. Strategic alternatives review (`STRATEGIC_REVIEW`; Programme)

Board review initiated → Advisers appointed → Alternatives defined → Preliminary valuation → Market soundings → Options assessed → Preferred path selected → Child transaction launched → Review concluded.

**FICC / modelling:** Sale, IPO, merger, refinancing and no-action are alternative outcomes; a review is not evidence of an active sale mandate.

## 6. Correct treatment of a private acquisition

Your proposed steps are a strong starting vocabulary. Refine them as follows:

- Rumoured belongs to evidence state; planning belongs to lifecycle; NDA executed is a milestone.
- “Indication of intent” usually needs a more precise label: expression of interest (EOI), indicative offer or non-binding indication of interest (IOI). Store document type and binding provisions separately.
- A letter of intent or heads of terms can be largely non-binding while confidentiality, costs or exclusivity provisions are binding. Do not label every LOI a binding acquisition.
- A bidder normally signs an NDA before receiving sensitive information, but a public bidder may receive limited or no target diligence. Data room access is a permission event, not proof that diligence is complete.
- Quality of earnings is a financial diligence deliverable. It may be vendor-provided before outreach or buyer-commissioned during diligence.
- SPA drafting, financing and diligence commonly overlap.
- In an auction, final bids often precede preferred-bidder selection and exclusivity. Bilateral deals may grant exclusivity before confirmatory diligence. Never enforce one order across both.
- “Binding bid” does not establish that an SPA has been executed or that all conditions are satisfied. Record offer validity, reservations and contractual status.
- Signing, announcement, regulatory clearance, satisfaction of all closing conditions, funding, economic settlement and legal ownership transfer are distinct occurrences, even when simultaneous.

An appropriate acquisition display spine is: review → preparation → outreach/approach → initial terms → diligence and negotiations → bidder selection → binding agreement → conditions → completion → post-close obligations. Show the overlapping workstreams beneath it.

## 7. Data dictionary and relationships

These are logical entity specifications, not executable database DDL. PK means primary key and FK means foreign key. Arrays should normally become junction tables in a relational implementation.

**EventProgramme**

`programme_id PK; title; sponsor_entity_id FK; objective; status; created_at; version`

**CorporateEvent**

`event_id PK; programme_id FK; event_type_id FK; title; lifecycle_phase; disposition; outcome; legal_structure; jurisdictions[]; rulebook_version; expected_close_start; expected_close_end; actual_completion_at; owner_entity_id FK; confidentiality; model_version`

**EventRelationship**

`relationship_id PK; from_event_id FK; to_event_id FK; relationship_type; exclusivity_group_id; effective_from; effective_to`

**Entity**

`entity_id PK; legal_name; LEI; registration_number; domicile; reporting_currency; entity_type; parent_entity_id FK`

**EventParty**

`event_party_id PK; event_id FK; entity_id FK; role; consortium_id; ownership_before; ownership_after; control_rights; valid_from; valid_to`

**TransactionPerimeter**

`perimeter_id PK; event_id FK; included_entity_ids[]; excluded_entity_ids[]; assets; geography; ownership_percent; perimeter_version`

**Pursuit**

`pursuit_id PK; event_id FK; bidder_entity_id FK; round; status; bid_id FK; exclusivity_start; exclusivity_end`

**Bid**

`bid_id PK; pursuit_id FK; submitted_at; binding_status; price_currency; equity_value; enterprise_value; assumed_debt; cash_component; stock_component; conditions; expires_at; source_claim_id FK`

**WorkstreamInstance**

`workstream_id PK; event_id FK; pursuit_id FK optional; workstream_type; status; owner; blocker; next_action; updated_at`

**MilestoneDefinition**

`milestone_definition_id PK; event_type_id FK; label; display_order; workstream_type; optionality_rule; evidence_requirement; rulebook_overlay`

**MilestoneOccurrence**

`milestone_occurrence_id PK; event_id FK; pursuit_id FK optional; milestone_definition_id FK; status; occurred_at; date_precision; observed_at; source_claim_ids[]; supersedes_occurrence_id FK`

**Dependency**

`dependency_id PK; event_id FK; predecessor_id; successor_id; dependency_type; logic_group; required_status; applicability; waiver_rule; rule_source; version`

**Condition**

`condition_id PK; event_id FK; condition_type; authority_or_counterparty; jurisdiction; state; deadline; waiver_permitted; waiver_holder; approval_expiry; evidence_claim_id FK`

**ApprovalCase**

`approval_case_id PK; condition_id FK; filing_at; completeness_at; stage; decision_at; decision; remedy; appeal_state; source_claim_ids[]`

**FundingInstrument**

`funding_id PK; event_id FK; borrower_id FK; instrument_type; currency; committed_amount; drawn_amount; availability_end; maturity; rate_index; margin; fixed_rate; amortisation; priority; guarantee; security; conditions; certainty_status`

**EconomicLeg**

`leg_id PK; event_id FK; funding_id FK optional; payer_id FK; payee_id FK; flow_type; asset_or_instrument; currency; amount_min; amount_base; amount_max; measurement_basis; gross_net_basis; expected_settlement_start; expected_settlement_end; contingency; restriction; source_claim_id FK; internal_group_flag; parent_leg_id FK; mutually_exclusive_group_id`

**RiskExposure**

`exposure_id PK; event_id FK; leg_ids[]; exposed_entity_id FK; risk_type; risk_currency; functional_currency; reporting_currency; direction; notional; delta_equivalent; start_at; end_at; rate_tenor; commodity_unit; underlying_price_index; probability_model_id; estimation_status`

**Hedge**

`hedge_id PK; exposure_ids[]; counterparty_id FK; product; currencies[]; notional; strike_or_fixed_rate; trade_at; value_at; maturity; close_condition; contingent_definition; expiry; extension_terms; unwind_terms; credit_status; documentation_status; accounting_designation`

**SourceDocument**

`source_id PK; url_or_internal_ref; issuer; source_type; publication_at; retrieved_at; document_hash; access_scope; language`

**Claim**

`claim_id PK; source_id FK; subject_id; predicate; value; unit; currency; effective_at; observed_at; evidence_excerpt; assertion_type; evidence_confidence; review_state; supersedes_claim_id FK`

**StateTransition**

`transition_id PK; event_id FK; dimension; prior_value; new_value; effective_at; recorded_at; actor; reason; supporting_claim_ids[]; supersedes_transition_id FK`

**Forecast**

`forecast_id PK; event_id FK; as_of; horizon; target; estimate; low; high; model_version; assumptions; approval_state`

**Feedback**

`feedback_id PK; target_type; target_id; proposed_value; corrected_value; reason; annotator_role; created_at; adjudication; ontology_version`

**Opportunity**

`opportunity_id PK; event_id FK; client_entity_id FK; exposure_id FK; product_family; evidence_status; urgency; potential_notional; commercial_owner; next_action; decision_deadline; status`

Cardinality: Programme 1:N Events; Event M:N Parties through EventParty; Event 1:N Pursuits; Pursuit 1:N Bids; Event 1:N Workstreams, Conditions and MilestoneOccurrences; Condition 1:N ApprovalCases; Event 1:N FundingInstruments and EconomicLegs; EconomicLegs M:N RiskExposures; RiskExposures M:N Hedges; Sources 1:N Claims; Claims M:N milestone, state and term assertions.

A regulator case, bid, facility or hedge has its own ID, not a free-text attribute on the event. One bidder can have several bid revisions. One event can have several closing tranches, authorities and settlement dates. A single hedge can cover several legs, subject to an allocation table and aggregate notional checks.

Add junctions for EventJurisdiction, EventTypeTag, EventEntityPerimeter, ExposureLegAllocation, HedgeExposureAllocation, ClaimSupport and EventSource. Track currency as ISO 4217; countries as ISO 3166; security identifiers as ISIN where available; legal entities as LEI plus local identifier. Use exact decimals for money and percentages with explicit scale. Never infer a currency from a Nordic domicile or reporting currency.

Every fact needs effective_at and recorded_at; every source needs publication_at and retrieved_at. This permits historical “what was known then” reconstruction. Record date precision as exact, day, month, quarter, range or unknown; do not convert “Q2 closing” to a false exact date.

## 8. Transition and gate rules

At template level, define allowed transitions, guard expressions, applicability and required evidence. At case level, instantiate a dependency graph with AND and OR groups, optional gates and documented waivers. Templates in the JSON provide milestone vocabulary; they intentionally do not pretend to encode all legal dependencies.

| Transition / action | Gate | What must not be inferred |
|---|---|---|
| Execute confidential information access | Applicable NDA or documented permitted exception | Access does not prove diligence completed |
| Mark acquisition agreement signed | Executed contract or explicit official statement | Final bid or exclusivity is insufficient |
| Mark financing committed | Binding commitment, amount, expiry and conditions recorded | Lender discussions or term sheet are insufficient |
| Mark financing available | Relevant draw conditions satisfied / waived as permitted | Committed debt may remain unavailable |
| Mark clearance obtained | Decision, authority, jurisdiction, conditions and date recorded | One clearance does not imply all approvals |
| Mark all CPs fulfilled | Every applicable gate satisfied or lawfully waived | Some statutory conditions cannot be privately waived |
| Mark acquisition complete | Applicable ownership/control transfer predicate satisfied | SPA signing, payment or delisting alone may be insufficient |
| Mark bond issued | Event-specific issuance and settlement evidence | Pricing is not cash received |
| Mark IPO settled | Share/cash delivery evidence | First trading is not settlement |
| Mark spin-off complete | Distribution / transfer legally effective | Board approval or listing application is insufficient |
| Mark restructuring effective | Procedure-specific effectiveness gates satisfied | Creditor support is not necessarily court confirmation |
| Mark hedge executed | Trade confirmation or controlled dealing record | Quote, recommendation or credit approval is insufficient |

Additional branches: revision of price; competing bid; bidder withdrawal; re-entry; exclusivity expiry; deadline extension; regulatory prohibition; remedies; litigation; adverse vote; financing expiry; failed syndication; market postponement; partial completion; cancellation; reopening; abandonment; restart. A restart normally creates a new process instance linked by SUPERSEDES or a restart relationship, preserving the old history.

Conditional approval remains distinct from unconditional clearance. Store remedies and implementation prerequisites individually. Long-stop expiry is a deadline event; it is not automatic proof of termination unless the agreement or an exercised right establishes that outcome. Announced intended close is a forecast, not a condition satisfaction fact.

Nordic rule overlays must cover Sweden, Norway, Denmark, Finland and, if within scope, Iceland; UK scheme and US processes are additional routes. Record rulebook and effective date, competent authority, mandatory bid rules, offer conditions, financing certainty, squeeze-out, delisting, merger registration, creditor protection, employee consultation and listing rules as applicable. Do not hard-code one country's thresholds or timetable into the global ontology.

## 9. FICC economic model

The minimal unit is a party-specific economic leg, not headline enterprise value. Enterprise value, equity consideration, debt refinancing, fees, tax, capex and distributions can be different amounts in different currencies. Stock consideration, rolled equity, debt assumption and earn-outs change immediate cash requirements.

For each leg record payer, payee, beneficiary, amount or range, currency, timing window, trigger, contingency, funding source, restrictions, functional currency and source. Separate external cash from intra-group cash. Specify whether the perspective is buyer, seller, borrower, issuer, fund, project or consolidated group.

FX need is the residual mismatch between matching currency inflows, outflows, available cash, financing and executed hedges, on aligned dates and within the same legally accessible liquidity perimeter. Never subtract a funding source twice when its draw is already represented as an EconomicLeg. Unrestricted EUR cash at a subsidiary cannot be presumed available to a sponsor's acquisition vehicle.

Rate exposure includes notional, reference index, repricing tenor, maturity, amortisation, expected draw schedule, fixed/floating profile, option features and prepayment. Record DV01 only with valuation date, curve and method. Currency basis and credit spread exposure are separate from risk-free rate duration.

Commodity exposures need volume, unit, grade, location, delivery period and price formula; a generic energy tag is insufficient. Acquisition capex or project pipelines can generate FX and commodity risk before operating cash flow begins.

| Process trigger | Corporate Finance fact to capture | FICC question / potential action |
|---|---|---|
| Strategic review | Routes, perimeter and beneficiary | What currencies or debt changes could arise under each route? |
| IOI / valuation | Bid currency, funding currency, price range | How sensitive are returns and bid capacity to FX and rates? |
| Preferred bidder / exclusivity | Expected signing, funding plan, diligence gaps | Can exposures be quantified and execution readiness prepared? |
| Financing commitment | Amount, expiry, draw CPs, rate structure | Is there pre-funding, interest-rate or basis risk? |
| SPA signing / firm offer | Contractual consideration, timing range, failure conditions | Assess contingent versus conventional hedging and break risk |
| Clearance or acceptance update | Residual CPs and expected settlement | Reassess timing, notional, contingent eligibility and rollover needs |
| Bond pricing / loan signing | Coupon or margin, availability and settlement | Which rates or currency exposures remain open? |
| Closing readiness | Final funds flow, legal entities, restricted cash | Validate settlement currencies, liquidity and hedge matching |
| Completion | Actual proceeds, debt draw and ownership transfer | Settle hedges, repatriate proceeds, implement ongoing debt mix |
| Post-close | Earn-outs, deferred price, bridge takeout, TSA and capex | Resize hedges and avoid leaving residual or duplicate positions |
| Failure / postponement | Failure reason, termination rights, obligations | Apply actual hedge termination or extension terms; quantify remaining exposure |

Do not mechanically hedge expected notional multiplied by close probability. That can misrepresent the asymmetric exposure on close versus failure. Store both scenario cash flows and candidate hedge payoffs. Deal-contingent products require an expressly defined trigger, expiry, eligible underlying event, extension and unwind treatment; “the deal closes” is not a sufficient contract definition.

A contingent FX hedge, ordinary forward, option, forward-starting IRS and cross-currency swap are distinct products with different failure, timing, credit and collateral implications. A model-identified opportunity is not an instruction to trade. Separate exposure readiness from client coverage, credit, documentation and executed risk.

## 10. Worked synthetic example

A EUR-based sponsor proposes to buy a Swedish listed company for SEK 10bn equity consideration. A EUR 600m financing package is proposed. These are illustrative assumptions, not market observations.

- Programme P1: take-private; public-offer route; sponsor control objective.
- Event E1: PUBLIC_OFFER; target Swedish listed company; disposition ACTIVE; phase CONDITIONS_AND_EXECUTION after firm offer and opening of acceptance.
- Event E2: LBO overlay linked by FINANCES; EUR 600m committed, EUR 0 drawn; amount and availability recorded without converting into SEK at an unspecified rate.
- Pursuit B1: sponsor consortium; cash bid denominated SEK; revision history preserved.
- Commercial state: terms announced. Financing state: COMMITTED. One regulatory case: CLEARED. Another: IN_REVIEW. Shareholder acceptance: IN_PROGRESS with observed percentage, denominator and timestamp. Hedging state: DATA_VALIDATED.
- Leg L1: acquisition vehicle pays up to SEK 10bn to accepting shareholders at settlement, with accepted percentage and staged settlements determining actual cash.
- Leg L2: lenders advance EUR funding to the acquisition vehicle if draw conditions are satisfied.
- Exposure X1: acquisition vehicle must obtain SEK against EUR sources, after matching available SEK cash and any other SEK funding. Amount is not enterprise value.
- Separate seller exposures: a EUR-based shareholder may receive SEK and need EUR, but that is a different beneficiary and a different advisory opportunity.
- Residuals: remaining minorities, squeeze-out, delisting and bridge refinancing are separate occurrences or child events. Offer settlement does not prove all have completed.

If the offer fails, the model records the failed event, undrawn commitments and contract-specific hedge outcome. It does not manufacture an acquisition settlement or automatically declare every hedge cancelled.

## 11. Evidence, classification and user correction

Extract claims before assigning an overall state. Store evidence excerpts, sources, dates, affected entities and assertion types. A press article asserting “exclusive talks” supports that claim, not an executed SPA. A statement that a bidder “plans to bid” does not prove a bid was submitted.

Use an explicit unknown state when private steps are unobservable. A public monitor should show “not publicly evidenced,” not “NDA not signed.” Distinguish reported negative evidence (process cancelled) from absence of a new announcement.

One official source can still be corrected later. Resolve contradictions through claim review, source priority by proposition, recency and transaction-specific evidence; never silently overwrite an earlier claim. Keep confidence attached to the claim and show which evidence supports the projected state.

Feedback targets should include event identity, event type, entity role, perimeter, lifecycle, milestone, date, currency, amount, binding status, condition, relationship and FICC exposure. Record original value, corrected value, rationale, reviewer and ontology version. “Wrong classification” alone is too weak a training label.

Track retrieval relevance, extraction accuracy, entity resolution, type classification, stage inference and exposure inference as distinct evaluation tasks. Keep labelled transaction histories split by programme and time to avoid leaking the same deal into training and test sets. Forecast close probability requires separate outcome-labelled calibration and must not reuse extraction confidence as probability.

## 12. Product views and implementation priorities

The primary screen should show event family, parties, perimeter, headline consideration with basis and currency, current principal phase, disposition, last verified milestone, evidence status, remaining gates, close window, party-specific exposures and next action. Expand into workstream lanes, bidder matrix, approval checklist, funds flow and source timeline.

Support filters for Nordic nexus, cross-border character, target/client roles, foreign-currency cash settlement, refinancing requirement, floating-rate debt, sponsor ownership, exclusivity/final-bid evidence, signed-but-unclosed status, regulatory blockers and near-term decision deadline. Nordic nexus should record which entity or asset establishes scope rather than a single country label.

Implement in this order: stable IDs and ontology; event/party/source/claim records; immutable timeline; route templates; bidder pursuits and conditions; economic legs and funding; exposures and hedges; correction audit; forecasting and commercial ranking. Retain the distinction between a rules-based factual projection and a model-generated hypothesis.

Suggested validation scenarios: two auction bidders at different stages; a public bid without diligence; a spin-off without proceeds; an IPO that trades before settlement; an undrawn refinancing facility; a bridge never drawn; conditional clearance; an approval revoked; mixed consideration and earn-out; minority sale with retained control; dual-track cancellation; distressed debt equitisation without cash; multiple closing tranches; failed deal with a surviving ordinary hedge; overlapping events with deduplicated value and cash flows.

Acceptance criteria: no milestone asserted without evidence or explicit inference; no unknown treated as negative; no deal value counted twice through overlays; no financing commitment treated as a draw; no probability used as evidence confidence; no completion claimed solely because one workstream is complete.

## 13. Source anchors and limits

The ontology and milestone catalogue are a proposed design informed by transaction practice. The sources below anchor selected distinctions, not every illustrative step. Accessed 25 October 2026.

- European Commission, Merger procedures: https://competition-policy.ec.europa.eu/mergers/procedures_en — notification, review and pre-implementation clearance framework.
- Swedish Securities Council, Takeover rules: https://aktiemarknadsnamnden.se/takeover-rules/takeover-rules__4923 — local public takeover rule framework.
- UK Takeover Panel, Offer period definition: https://code.thetakeoverpanel.org.uk/tp/definitions/d_offer-period.html?timeline=True — contractual offer and scheme concepts and different endpoints.
- Nasdaq, European listings: https://www.nasdaq.com/products/european-markets/listings — readiness, documentation, application and admission; market-specific requirements.
- Council of the EU, Preventive restructuring directive adoption: https://www.consilium.europa.eu/en/press/press-releases/2019/06/06/giving-entrepreneurs-a-second-chance-new-rules-on-business-insolvency-adopted/ — separate preventive restructuring framework; individual country implementation still required.

The JSON is a parseable starter vocabulary and logical model, not an executable JSON Schema, SQL migration, full transition graph or country rule engine. Display order is never an automatic legal dependency. Every template requires case-specific applicability and gate configuration before production use.
