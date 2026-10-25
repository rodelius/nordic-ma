import type {Deal} from './model';
const currencies=['SEK','NOK','EUR','USD','GBP','DKK'];
export function assessFicc(deal:Deal){
 const conflicts:string[]=[];
 function fact(labels:string[]){const found=deal.evidence.filter(e=>e.kind==='Fact'&&labels.includes(e.label.trim().toLowerCase())).map(e=>e.value.trim().toUpperCase());const unique=[...new Set(found)];if(unique.length>1){conflicts.push(labels[0]);return null;}return unique[0]||null;}
 function currency(labels:string[]){const v=fact(labels);return v&&currencies.includes(v)?v:null;}
 const settlement=currency(['consideration currency','transaction currency','settlement currency']);
 const funding=currency(['buyer funding currency']);
 const sellerTarget=currency(['seller repatriation currency','seller desired proceeds currency']);
 const denomination=currency(['buyer fund denomination','fund denomination']);
 const debt=currency(['debt currency']);
 const floating=fact(['debt rate type'])==='FLOATING';
 const inflation=fact(['revenue indexation'])==='INFLATION-LINKED';
 const form=fact(['consideration type','payment form']),cash=form==='CASH'||form==='MIXED',failed=deal.status==='Failed';
 const questions:string[]=[],angles:string[]=[];
 const buyer=failed?'No current settlement need established':form==='SHARES'?'No cash FX established':cash&&settlement&&funding?(settlement!==funding?'Potential FX':'No currency mismatch established'):'Unclear';
 const seller=failed?'No current settlement need established':form==='SHARES'?'No cash FX established':cash&&settlement&&sellerTarget?(settlement!==sellerTarget?'Potential FX':'No currency mismatch established'):'Unclear';
 if(buyer==='Potential FX')angles.push(`Buyer funding ${funding} → consideration ${settlement}: assess conversion timing, matching cash/local borrowing${deal.status==='Closed'?' and any remaining post-closing need':' and deal-contingent alternatives'}.`);
 if(seller==='Potential FX')angles.push(`Seller receipts ${settlement} → desired proceeds ${sellerTarget}: assess repatriation plans and timing.`);
 if(!form||!['CASH','SHARES','MIXED'].includes(form))questions.push('Confirm consideration type (CASH, SHARES or MIXED); an acquisition or share issue does not establish a cash conversion.');
 if(form==='MIXED')questions.push('Confirm the cash component amount and timing; do not use full EV as cash FX notional.');
 if(form==='SHARES')questions.push('Share consideration: confirm any actual cash component or later share-sale proceeds before discussing FX.');
 if(!settlement)questions.push('Confirm consideration currency; country and enterprise value do not establish it.');
 if(!funding)questions.push('Confirm actual buyer funding currency and cash/debt mix; reporting currency alone is insufficient.');
 if(!sellerTarget)questions.push('Confirm seller desired proceeds/repatriation currency and amount.');
 if(denomination&&settlement&&denomination!==settlement&&!funding)angles.push(`Fund denomination ${denomination} differs from ${settlement}, but funding is unknown. This is a hypothesis, not an established FX need.`);
 if(floating)angles.push('Confirmed floating-rate debt: discuss swaps/caps/collars after confirming notional, benchmark and duration.');
 if(debt&&funding&&debt!==funding)angles.push(`Debt ${debt} differs from buyer funding ${funding}: investigate cross-currency alternatives; functional currency and debt service exposure still need confirmation.`);
 if(inflation)angles.push('Inflation-linked revenue is documented: assess its relationship with debt costs before suggesting an inflation hedge.');
 if(!debt)questions.push('Confirm debt currency, rate basis, refinancing terms and maturity.');
 if(deal.status==='Closed'||deal.status==='Failed')questions.push('Terminal transaction: do not propose a new deal-contingent hedge; confirm any remaining proceeds, financing or unwind need.');
 for(const label of conflicts)questions.push(`Conflicting Fact entries for ${label}; resolve before relying on this input.`);
 return {buyerFx:buyer,sellerFx:seller,twoSided:buyer==='Potential FX'&&seller==='Potential FX',angles,questions,limitations:'Evidence-based hypotheses only. Confirm treasury intent, notional, natural offsets, approvals and timing. No trades or final FICC score are generated.'};
}
