const { google } = require('googleapis');
const fs = require('fs');
function loadEnv(p){const c=fs.readFileSync(p,'utf8');const e={};for(const l of c.split('\n')){const t=l.trim();if(!t||t.startsWith('#'))continue;const i=t.indexOf('=');if(i===-1)continue;e[t.slice(0,i)]=t.slice(i+1).replace(/^["']|["']$/g,'');}return e;}
const num = v => { if(!v) return 0; const n=parseFloat(String(v).replace(/[^\d.-]/g,'')); return isNaN(n)?0:n; };
const month = d => { if(!d) return ''; const m=String(d).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if(!m) return String(d); const M=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return M[+m[1]-1]+' '+m[3]; };
async function main(){
  const env=loadEnv('.env');const creds=JSON.parse(env['GOOGLE_SERVICE_ACCOUNT_CREDENTIALS']);
  const auth=new google.auth.GoogleAuth({credentials:creds,scopes:['https://www.googleapis.com/auth/spreadsheets.readonly']});
  const sheets=google.sheets({version:'v4',auth});
  const ss='1Ej9Ir2RB7hJ6OL1EP-XByHeke-V_iB0nvTbLlTCnUY8';
  const payRows=(await sheets.spreadsheets.values.get({spreadsheetId:ss,range:'payments!A2:R5000'})).data.values||[];
  const pdRows=(await sheets.spreadsheets.values.get({spreadsheetId:ss,range:'payment_details!A2:T5000'})).data.values||[];
  // payments: pay_id0, pay_date3, pay_total10, deleted16
  const pay=new Map();
  for(const r of payRows){ if(!r[0]||r[16]) continue; pay.set(r[0], {date:r[3]||'', amount:num(r[10])||num(r[5])}); }
  // payment_details: pd_pay_id1, pd_date3, pd_total13, deleted19
  const pd=new Map();
  for(const r of pdRows){ if(!r[1]||r[19]) continue; const k=r[1]; if(!pd.has(k)) pd.set(k,{amount:0, months:new Set(), n:0}); const e=pd.get(k); e.amount+=num(r[13]); e.months.add(month(r[3])); e.n++; }
  console.log('payments rows(active):',pay.size,'| pd distinct pay_id(active):',pd.size);
  let onlyPay=[], onlyPd=[], amtDiff=[], monthDiff=[];
  for(const [id,p] of pay){
    const d=pd.get(id);
    if(!d){ onlyPay.push({id,...p}); continue; }
    if(Math.abs(p.amount-d.amount)>1) amtDiff.push({id, pay:p.amount, pd:d.amount, diff:p.amount-d.amount});
    const pm=month(p.date);
    if(!d.months.has(pm)) monthDiff.push({id, payMonth:pm, pdMonths:[...d.months].join('|'), amount:p.amount});
  }
  for(const [id,d] of pd){ if(!pay.has(id)) onlyPd.push({id, amount:d.amount}); }
  const sum=a=>a.reduce((s,x)=>s+(x.amount||x.diff||0),0);
  console.log('\n== A. Ada di payments tapi TIDAK ada di payment_details:', onlyPay.length, 'total Rp'+Math.round(sum(onlyPay)).toLocaleString('id-ID'));
  onlyPay.slice(0,15).forEach(x=>console.log('   ',x.id, x.date, 'Rp'+Math.round(x.amount).toLocaleString('id-ID')));
  console.log('\n== B. Ada di payment_details tapi TIDAK ada di payments:', onlyPd.length, 'total Rp'+Math.round(sum(onlyPd)).toLocaleString('id-ID'));
  onlyPd.slice(0,15).forEach(x=>console.log('   ',x.id,'Rp'+Math.round(x.amount).toLocaleString('id-ID')));
  console.log('\n== C. Nominal beda (pay_total vs sum pd_total):', amtDiff.length, 'net diff Rp'+Math.round(amtDiff.reduce((s,x)=>s+x.diff,0)).toLocaleString('id-ID'));
  amtDiff.sort((a,b)=>Math.abs(b.diff)-Math.abs(a.diff)).slice(0,15).forEach(x=>console.log('   ',x.id,'payments Rp'+Math.round(x.pay).toLocaleString('id-ID'),'| pd Rp'+Math.round(x.pd).toLocaleString('id-ID'),'| diff Rp'+Math.round(x.diff).toLocaleString('id-ID')));
  console.log('\n== D. Bulan beda (pay_date vs pd_date):', monthDiff.length);
  monthDiff.sort((a,b)=>b.amount-a.amount).slice(0,15).forEach(x=>console.log('   ',x.id,'payments:',x.payMonth,'| pd:',x.pdMonths,'| Rp'+Math.round(x.amount).toLocaleString('id-ID')));
}
main().catch(e=>{console.error('ERR',e.message);process.exit(1)});
