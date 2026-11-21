import*as F from"node:fs";
const{MAKEFUN_INPUT_DIR:I="/input",MAKEFUN_OUTPUT_DIR:O="/output"}=process.env,CH="udlr",S=(a,b)=>a-b;
for(const id of F.readdirSync(I)){let s="";try{s=V(F.readFileSync(I+"/"+id+"/level.txt","utf8"))}catch{}try{F.mkdirSync(O+"/"+id,{recursive:true});F.writeFileSync(O+"/"+id+"/solution.txt",s)}catch{}}function V(T){const L=T.split("\n"),w=Math.max(...L.map(r=>r.length)),N=w*L.length,OF=[-w,w,-1,1],U=()=>new Uint8Array(N),wl=U().fill(1),go=U();
let bx=[],pl=-1,fl=[],rs=[];
for(let s=N;s--;){const c=L[s/w|0][s%w];if(!c||c==="#")continue;wl[s]=0;fl.push(s);go[s]=+(".*+".includes(c));"$*".includes(c)&&bx.push(s);"@+".includes(c)&&(pl=s)}if(pl<0)return"";const pr=pl/w|0,se=U();
for(const s of fl){
if(se[s]||(s/w|0)===pr)continue;
const cb=[],cg=[],st=[s],mk=U();se[s]=1;let mo=-1;
while(st.length){const q=st.pop();mk[q]=1;bx.includes(q)&&cb.push(q);go[q]&&cg.push(q);for(const o of OF){const t=q+o;if(!wl[t]&&!se[t])if((t/w|0)===pr)mo=t;else{se[t]=1;st.push(t)}}}
cb.length&&rs.push([mk,cb.sort(S),cg,mo])}if(!rs.length||bx.some(b=>(b/w|0)===pr)||rs.some(r=>r[3]<0||r[2].length-r[1].length)){rs=[[wl.map(v=>1-v),[...bx].sort(S),fl.filter(q=>go[q]),pl]]}
let mv="",cur=new Set(bx),pp=pl;
for(const rm of rs){const ps=Q(rm);if(!ps)return"";
for(const[b,k]of ps){const o=OF[k],wk=W(pp,b-o,cur);if(wk===null)return"";mv+=wk+CH[k];cur.delete(b);cur.add(b+o);pp=b}}cur=new Set(bx);pp=pl;
for(const c of mv){const o=OF[CH.indexOf(c)],t=pp+o,u=t+o;
if(wl[t]||cur.has(t)&&(wl[u]||cur.has(u)))return"";
if(cur.has(t)){cur.delete(t);cur.add(u)}pp=t}
for(const b of cur)if(!go[b])return"";return mv;
function W(f,to,bs){const par={},q=[f];par[f]="";
for(const s of q){if(s===to)return par[s];
for(let k=4;k--;){const t=s+OF[k];if(!wl[t]&&!bs.has(t)&&!(t in par)){par[t]=par[s]+CH[k];q.push(t)}}}return null}
function Q(rm){
const mk=rm[0],lv=U(),lq=[];
for(const g of rm[2])lv[g]=1,lq.push(g);
for(const s of lq)for(const o of OF){const p=s-o,t=p-o;if(!wl[t]&&!lv[p]&&mk[p])lv[p]=1,lq.push(p)}const ns=[[rm[1],rm[3],-1,0]],vis={};let ni=0;
for(const nd of ns){const B=nd[0],P=nd[1],ci=ni++;
const sn=U(),st=[P];sn[P]=1;let mn=P;
while(st.length){const q=st.pop();if(q<mn)mn=q;for(const o of OF){const t=q+o;if(!sn[t]&&!B.includes(t)&&(mk[t]||t===rm[3])){sn[t]=1;st.push(t)}}}
const key=B.reduce((a,b)=>a*256+b,mn);
if(vis[key])continue;vis[key]=1;
if(B.every(b=>go[b])){const ps=[];for(let j=ci;ns[j][2]>=0;j=ns[j][2])ps.push([ns[j][1],ns[j][3]]);return ps.reverse()}
if(ni>17e6)return null;
for(let bi=B.length;bi--;){const b=B[bi];
for(let k=4;k--;){const o=OF[k],ln=b+o;
if(!sn[b-o]||B.includes(ln)||!lv[ln])continue;
ns.push([B.with(bi,ln).sort(S),b,ci,k])}}}return null}
}
