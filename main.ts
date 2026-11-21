import fs from"node:fs"
let{MAKEFUN_INPUT_DIR:I="/input",MAKEFUN_OUTPUT_DIR:O="/output"}=process.env,D,S="LURD"
let Z=t=>{
let rs=t.split("\n"),w=Math.max(...rs.map(r=>r.length)),W=w+1
let f=new Set,g=new Set,X=[],p=0,sn=[];D=[-1,-W,1,W]
rs.forEach((r,y)=>{[...r].forEach((c,x)=>{let i=y*W+x
if(c!="#"){f.add(i)
if(".+*".includes(c))g.add(i);if("$*".includes(c))X.push(i);if("@+".includes(c))p=i}})})
let L=new Set(g)
for(let t of L)for(let d in D){let b=t-D[d],p=b-D[d]
if(f.has(b)&&f.has(p)&&!L.has(b))L.add(b)}
let v=[],N=0
let F=(s,B,A,W,e,j)=>{N++
let q=[s],H=W?{[s]:""}:0;v[s]=N
for(let i=0;i<q.length;i++){let u=q[i]
for(let d=0;d<4;d++){let n=u+D[d]
if(v[n]!=N&&A.has(n)&&n!=j&&(n==e||!B.has(n))){v[n]=N;q.push(n);if(W)H[n]=H[u]+S[d]}}}
return W?H:q}
let G=(A,R,E,P,Q)=>{if(E.every(x=>g.has(x)))return["",P]
let V=new Set,W=[[E,P,""]],i=0
for(let[B,U,h]of W){if(i++>1e6)return null
let K=new Set(Q.concat(B)),H=F(U,K,i==1?f:A,1)
for(let b of B)for(let y=0;y<4;y++){let d=D[y],z=b+d,s=b-d
if(!(s in H)||!L.has(z)||B.includes(z)||!R.includes(z))continue
let M=B.map(x=>x==b?z:x);M.sort((a,b)=>a-b)
let k=M+"|"+Math.min(...F(b,K,A,0,b,z))
if(!V.has(k)){V.add(k);let w=h+H[s]+S[y]
if(M.every(x=>g.has(x)))return[w,b]
W.push([M,b,w])}}}
return null}
let H=new Set([...f].filter(i=>i-i%W==p-p%W)),o="",u=p,Y=X,e=0
for(let z of X){if(sn[z])continue
let C=F(z,H,f,0);C.map(x=>sn[x]=1)
let b=X.filter(x=>C.includes(x))
let OB=Y.filter(x=>!b.includes(x)),r=G(new Set([...C,...H]),C,b,u,OB)
if(!r){e=1;break}
o+=r[0];u=r[1]
Y=OB.concat(C.filter(c=>g.has(c)))}
if(e||X.some(x=>!sn[x]))o=(G(f,[...f],X,p,[])||[o])[0]
let J=new Set(X),P=p
for(let ch of o){let d=D[S.indexOf(ch)],n=P+d
if(!f.has(n))return""
if(J.has(n)){let m=n+d;if(!f.has(m)||J.has(m))return"";J.delete(n);J.add(m)}
P=n}
return[...J].every(x=>g.has(x))?o:""}
for(let i of fs.readdirSync(I)){let s=Z(""+fs.readFileSync(I+"/"+i+"/level.txt"))
let p=O+"/"+i;fs.mkdirSync(p,{recursive:!0});fs.writeFileSync(p+"/solution.txt",s)}
