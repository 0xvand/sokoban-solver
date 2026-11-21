import{readdirSync as rd,readFileSync as rf,writeFileSync as wf,mkdirSync as mk}from"node:fs";
import{join as J}from"node:path";
const IN=process.env.MAKEFUN_INPUT_DIR||"/input",OUT=process.env.MAKEFUN_OUTPUT_DIR||"/output";
const D=[-1,0,1,0,0,1,0,-1],DL="urdl",INF=1e9,U8=Uint8Array,I32=Int32Array;
function sv(txt){
const rw=txt.split(/\r?\n/);while(rw.length&&!rw.at(-1))rw.pop();
const H=rw.length,W=Math.max(...rw.map(r=>r.length)),N=H*W;
const wl=new U8(N).fill(1),go=new U8(N),bz=[];
let pl=-1,pr=0;
for(let r=0;r<H;r++)for(let c=0;c<W;c++){const ch=rw[r][c]||"#",i=r*W+c;
if(ch!="#")wl[i]=0;
if(".*+".includes(ch))go[i]=1;
if("$*".includes(ch))bz.push(i);
if("@+".includes(ch)){pl=i;pr=r;}}
if(pl<0)return null;
const nb=(i,d)=>{const r=(i/W|0)+D[d],c=i%W+D[d+4];return r<0||c<0||r>=H||c>=W?-1:r*W+c;};
const gl=[];
for(let i=0;i<N;i++)if(go[i])gl.push(i);
const pd=[];
for(const g of gl){const ds=new I32(N).fill(INF);ds[g]=0;pd[g]=ds;const q=[g];
for(let h=0;h<q.length;h++){const t=q[h];
for(let d=0;d<4;d++){const s=nb(t,d^2),p=nb(s,d^2);
if(s>=0&&p>=0&&!wl[s]&&!wl[p]&&ds[s]===INF){ds[s]=ds[t]+1;q.push(s);}}}}
const dd=new U8(N);
for(let i=0;i<N;i++)if(!wl[i]&&!go[i]&&pd.every(ds=>ds[i]===INF))dd[i]=1;
const sH=new I32(N).fill(-1);
{let s=0;for(let c=0;c<W;c++){const i=pr*W+c;
if(!wl[i])sH[i]=c&&!wl[i-1]?sH[i-1]:s++;}}
const iS=sH[pl];
const cp=new I32(N).fill(-1),cs=[];
for(let i=0;i<N;i++){if(wl[i]||(i/W|0)===pr||cp[i]>=0)continue;
const sq=[],q=[i],id=cs.length;cp[i]=id;
for(let h=0;h<q.length;h++){const x=q[h];sq.push(x);
for(let d=0;d<4;d++){const y=nb(x,d);
if(y>=0&&!wl[y]&&(y/W|0)!==pr&&cp[y]<0){cp[y]=id;q.push(y);}}}
cs.push(sq);}
function rn(F,o,s,bs){
const R=new Set();let tc=false;
const fl=st=>{if(R.has(st)||bs.has(st))return;const q=[st];R.add(st);
for(let h=0;h<q.length;h++){const x=q[h];if(o.has(x))tc=true;
for(let d=0;d<4;d++){const y=nb(x,d);
if(y>=0&&F[y]&&!bs.has(y)&&!R.has(y)){R.add(y);q.push(y);}}}};
if(s>=0)fl(s);else tc=true;
if(tc)for(const dq of o)fl(dq);
return[R,tc,tc?-1:Math.min(...R)];}
function hu(bx,P){
const n=bx.length,m=P.length;
if(m<=8){let an=INF;const u=new U8(m);
const dfs=(i,ac)=>{if(ac>=an)return;if(i===n){an=ac;return;}
for(let j=0;j<m;j++)if(!u[j]&&P[j][bx[i]]<INF){u[j]=1;dfs(i+1,ac+P[j][bx[i]]);u[j]=0;}};
dfs(0,0);return an;}
let s=0;
for(const b of bx){let mn=INF;for(let j=0;j<m;j++)if(P[j][b]<mn)mn=P[j][b];
if(mn>=INF)return INF;s+=mn;}
return s;}
function fz(t,bs){const r=t/W|0,c=t%W;
for(let o=0;o<4;o++){const r0=r-(o>>1),c0=c-(o&1);let all=1,bad=0;
for(let z=0;z<4;z++){const rr=r0+(z>>1),cc=c0+(z&1);
if(rr<0||cc<0||rr>=H||cc>=W)continue;const x=rr*W+cc;
if(!wl[x]&&!bs.has(x))all=0;else if(bs.has(x)&&!go[x])bad=1;}
if(all&&bad)return true;}
return false;}
function as(F,P,o,b,s){
const bt=new Map(),B=[];let cf=0,op=0,ex=0;
const push=nd=>{const bk=B[nd[0]]??(B[nd[0]]=[[],0]);bk[0].push(nd);op++;};
const pop=()=>{op--;while(!B[cf]||B[cf][1]>=B[cf][0].length)cf++;return B[cf][0][B[cf][1]++];};
const h0=hu(b,P);if(h0>=INF)return null;
const k0=b.join(",")+"|"+rn(F,o,s,new Set(b))[2];
bt.set(k0,[0,null]);push([h0,0,k0,b,s]);
while(op){
const nd=pop(),g=nd[1],ky=nd[2],bx=nd[3];
if(g>bt.get(ky)[0])continue;
if(bx.every(b2=>go[b2])){const pt=[];let k=ky,e;
while((e=bt.get(k))&&e[1]!==null){pt.push([e[2],e[3]]);k=e[1];}
return pt.reverse();}
if(++ex>800000)return null;
const bs=new Set(bx),rv=rn(F,o,nd[4],bs),R=rv[0];
for(let i=0;i<bx.length;i++){const b=bx[i];
for(let d=0;d<4;d++){const t=nb(b,d);
if(t<0||!F[t]||bs.has(t)||dd[t])continue;
const s=nb(b,d^2);if(s<0)continue;
if(!R.has(s)&&!(rv[1]&&sH[s]===iS))continue;
const nx=bx.slice();nx[i]=t;nx.sort((x,y)=>x-y);
const bs2=new Set(nx);
if(fz(t,bs2))continue;
const hh=hu(nx,P);if(hh>=INF)continue;
const ng=g+1,k2=nx.join(",")+"|"+rn(F,o,b,bs2)[2];
if(bt.has(k2)&&bt.get(k2)[0]<=ng)continue;
bt.set(k2,[ng,ky,b,d]);
push([ng+hh,ng,k2,nx,b]);}}}
return null;}
let pn=null;
{let ok=iS>=0&&bz.every(b=>cp[b]>=0)&&gl.every(g=>cp[g]>=0);
const ls=[];
if(ok)for(let ci=0;ci<cs.length;ci++){
const bx=bz.filter(b=>cp[b]===ci),gs=gl.filter(g=>cp[g]===ci);
if(!bx.length&&!gs.length)continue;
const dr=new Set();
for(const x of cs[ci]){const r=x/W|0;
if(r!==pr-1&&r!==pr+1)continue;const sg=sH[nb(x,r<pr?2:0)];
if(sg>=0){if(sg!==iS)ok=false;dr.add(x);}}
if(bx.length!==gs.length||!dr.size){ok=false;break;}
const RF=new U8(N);for(const x of cs[ci])RF[x]=1;
ls.push({F:RF,d:gs.map(g=>pd[g]),o:dr,b:bx.sort((a,b)=>a-b),s:-1});}
if(ok&&ls.length)pn=ls;}
if(!pn){const RF=new U8(N);
for(let i=0;i<N;i++)if(!wl[i])RF[i]=1;
pn=[{F:RF,d:gl.map(g=>pd[g]),o:new Set(),b:[...bz].sort((a,b)=>a-b),s:pl}];}
let tt=0;const seqs=[];
for(const m of pn){const p=as(m.F,m.d,m.o,m.b,m.s);
if(!p)return null;seqs.push(p);tt+=p.length;}
const bs=new Set(bz);let p=pl,mv="";
const wk=to=>{
if(p===to)return "";
const par=new I32(N).fill(-2),wd=new Int8Array(N),q=[p];par[p]=-1;
for(let h=0;h<q.length;h++){const x=q[h];
for(let d=0;d<4;d++){const y=nb(x,d);
if(y>=0&&!wl[y]&&!bs.has(y)&&par[y]===-2){par[y]=x;wd[y]=d;
if(y===to){let s="";for(let cur=to;par[cur]>=0;cur=par[cur])s=DL[wd[cur]]+s;return s;}
q.push(y);}}}
return null;};
for(const pth of seqs)for(const[b,d]of pth){const s=nb(b,d^2),w=wk(s);
if(w===null)return null;
mv+=w+DL[d];bs.delete(b);bs.add(nb(b,d));p=b;}
const bs2=new Set(bz);let pp=pl,np=0;
for(const ch of mv){const d=DL.indexOf(ch),t=nb(pp,d);
if(t<0||wl[t])return null;
if(bs2.has(t)){const u=nb(t,d);
if(u<0||wl[u]||bs2.has(u))return null;
bs2.delete(t);bs2.add(u);np++;}
pp=t;}
if(np!==tt||[...bs2].some(x=>!go[x]))return null;
return mv;}
let L=[];try{L=rd(IN,{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name).sort();}catch{}
for(const i of L){let s="";
try{s=sv(rf(J(IN,i,"level.txt"),"utf8"))||"";}catch{}
mk(J(OUT,i),{recursive:true});wf(J(OUT,i,"solution.txt"),s);}
