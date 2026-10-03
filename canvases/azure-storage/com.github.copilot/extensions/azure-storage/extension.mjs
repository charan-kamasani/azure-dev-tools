import { createRequire as __canvasCreateRequire } from "node:module";
const require = __canvasCreateRequire(import.meta.url);
import{createCanvas,joinSession}from"@github/copilot-sdk/extension";import os2 from"node:os";import path2 from"node:path";import fs from"node:fs/promises";import{spawn as spawn3}from"node:child_process";import http from"node:http";import{randomBytes}from"node:crypto";var HOST_SESSION_VARIABLE=/^(?:SESSION_ID|(?:COPILOT|AGENCY)_\w*SESSION\w*)$/i;function inheritedCliEnvironment(source=process.env){let env={};for(let[key,value]of Object.entries(source))typeof value=="string"&&!HOST_SESSION_VARIABLE.test(key)&&(env[key]=value);return env}function scrubHostSessionEnv(target=process.env){let removed=[];for(let key of Object.keys(target))HOST_SESSION_VARIABLE.test(key)&&(delete target[key],removed.push(key));return removed}function classifyAuthError(message="",code=""){let text=`${message} ${code}`,aadCode=/\bAADSTS(\d{5,7})\b/.exec(text)?.[1]||null;return aadCode==="901001"||/invalid[_ ]request|client_session/i.test(text)?{needsAuth:!1,kind:"invalid-request",aadCode}:/\b403\b|AuthorizationFailed|\bForbidden\b|does not have authorization/i.test(text)?{needsAuth:!1,kind:"permission",aadCode}:/\b429\b|TooManyRequests|throttl/i.test(text)?{needsAuth:!1,kind:"throttled",aadCode}:/\b401\b|CredentialUnavailable|DefaultAzureCredential|az login|not (?:logged|signed) in|AADSTS(?:50076|50079|50078|50158|65001|700082|70043|50173)|\bcredential\b/i.test(text)?{needsAuth:!0,kind:"needs-auth",aadCode}:aadCode||/authenticat/i.test(text)?{needsAuth:!0,kind:"needs-auth",aadCode}:{needsAuth:!1,kind:"other",aadCode}}function cspHeader(nonce){return["default-src 'none'",`script-src 'nonce-${nonce}'`,"style-src 'unsafe-inline'","img-src 'self' data:","connect-src 'self'","font-src 'self'","base-uri 'none'","form-action 'none'","frame-ancestors 'none'"].join("; ")}var MAX_BODY=100*1024*1024;function isLoopbackHost(hostHeader){if(!hostHeader)return!1;let h=String(hostHeader).toLowerCase(),host=h.startsWith("[")?h.slice(0,h.indexOf("]")+1):h.split(":")[0];return host==="127.0.0.1"||host==="localhost"||host==="[::1]"||host==="::1"}function sameOriginLoopback(req){if(!isLoopbackHost(req.headers.host))return!1;let origin=req.headers.origin;if(origin)try{if(!isLoopbackHost(new URL(origin).host))return!1}catch{return!1}return!0}function createCanvasServer({html,routes={},media=null,initialState={},port=0}={}){let state={activityLog:[],...initialState},clients=new Set;function broadcast(){let data=`data: ${JSON.stringify(state)}

`;for(let res of clients)try{res.write(data)}catch{}}function setState(patch){state={...state,...patch},broadcast()}function getState(){return state}function log(msg){let line=`[${new Date().toLocaleTimeString()}] ${msg}`,activityLog=[...state.activityLog||[],line].slice(-200);setState({activityLog})}let ctx={getState,setState,log},server2=http.createServer(async(req,res)=>{if(req.method==="GET"&&req.url==="/events"){res.writeHead(200,{"Content-Type":"text/event-stream","Cache-Control":"no-cache",Connection:"keep-alive"}),res.write(`data: ${JSON.stringify(state)}

`),clients.add(res),req.on("close",()=>clients.delete(res));return}if(req.method==="GET"&&(req.url==="/"||req.url.startsWith("/?"))){let nonce=randomBytes(16).toString("base64");res.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Content-Security-Policy":cspHeader(nonce),"X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"}),res.end(typeof html=="function"?html(nonce):String(html||""));return}if(req.method==="GET"&&media&&req.url!=="/"&&!req.url.startsWith("/?")){let u=new URL(req.url,"http://127.0.0.1"),out=null;try{out=await media(u.pathname,u.searchParams,ctx)}catch(err){res.writeHead(500,{"Content-Type":"text/plain"}),res.end(String(err?.message||err));return}if(out&&out.buffer){res.writeHead(200,{"Content-Type":out.contentType||"application/octet-stream","Cache-Control":"no-store"}),res.end(out.buffer);return}}if(req.method==="POST"){if(!sameOriginLoopback(req)){res.writeHead(403,{"Content-Type":"application/json"}),res.end(JSON.stringify({ok:!1,error:"cross-origin request blocked"}));return}let path3=req.url.split("?")[0],handler=routes[path3];if(!handler){res.writeHead(404,{"Content-Type":"application/json"}),res.end(JSON.stringify({ok:!1,error:"no route "+path3}));return}let body="",tooLarge=!1;req.on("data",c=>{tooLarge||(body+=c,body.length>MAX_BODY&&(tooLarge=!0,res.writeHead(413,{"Content-Type":"application/json"}),res.end(JSON.stringify({ok:!1,error:"request body too large"})),req.destroy()))}),req.on("end",async()=>{if(tooLarge)return;let payload;try{payload=body?JSON.parse(body):{}}catch{res.writeHead(400,{"Content-Type":"application/json"}),res.end(JSON.stringify({ok:!1,error:"malformed JSON body"}));return}try{let out=await handler(payload,ctx);res.writeHead(200,{"Content-Type":"application/json"}),res.end(JSON.stringify(out??{ok:!0}))}catch(err){res.writeHead(500,{"Content-Type":"application/json"}),res.end(JSON.stringify({ok:!1,error:String(err?.message||err)}))}});return}res.writeHead(404),res.end()});return new Promise(resolve=>{server2.listen(port,"127.0.0.1",()=>{let port2=server2.address().port;resolve({port:port2,url:`http://127.0.0.1:${port2}`,getState,setState,log,close:()=>{for(let res of clients)try{res.end()}catch{}clients.clear(),server2.close()}})})})}async function safe(fn){try{return{ok:!0,data:await fn()}}catch(err){let msg=String(err?.message||err),code=String(err?.code||err?.statusCode||""),{needsAuth,kind}=classifyAuthError(msg,code);return{ok:!1,error:msg,needsAuth,authKind:kind}}}import{AzureCliCredential}from"./sdk/identity.mjs";import{BlobServiceClient,StorageSharedKeyCredential,ContainerClient,generateBlobSASQueryParameters,BlobSASPermissions,ContainerSASPermissions,SASProtocol}from"./sdk/blob.mjs";import{QueueServiceClient,StorageSharedKeyCredential as QueueSharedKey}from"./sdk/queue.mjs";import{ShareServiceClient,StorageSharedKeyCredential as FileSharedKey}from"./sdk/file.mjs";import{TableServiceClient,TableClient,AzureNamedKeyCredential}from"./sdk/tables.mjs";import{spawn,spawnSync}from"node:child_process";import{existsSync}from"node:fs";var ARM="https://management.azure.com",API="2023-01-01";scrubHostSessionEnv();var _cred=null;function credential(){return _cred||=new AzureCliCredential}var _tokens=new Map;async function tokenFor(scope){let now=Date.now(),hit=_tokens.get(scope);if(hit?.token&&hit.exp-12e4>now)return hit.token;if(hit?.inflight)return hit.inflight;let inflight=credential().getToken(scope).then(t=>{if(!t?.token)throw new Error(`Could not acquire a token for ${scope}. Run \`az login\`.`);return _tokens.set(scope,{token:t.token,exp:t.expiresOnTimestamp||now+33e5}),t.token}).catch(e=>{throw _tokens.delete(scope),e});return _tokens.set(scope,{...hit||{},inflight}),inflight}var sharedCredential={getToken:async(scopes,options)=>{if(options?.claims)return credential().getToken(scopes,options);let scope=Array.isArray(scopes)?scopes[0]:scopes;return{token:await tokenFor(scope),expiresOnTimestamp:_tokens.get(scope)?.exp??Date.now()+33e5}}},_warmed=null;function warmup(){return _warmed||(_warmed=Promise.allSettled([tokenFor("https://management.azure.com/.default"),tokenFor("https://storage.azure.com/.default")]),_warmed)}function resetTokenCache(){_tokens.clear(),_cred=null,_warmed=null}function azMissingMsg(e){let m=String(e&&e.message||e);return/ENOENT/i.test(m)?"Azure CLI (az) was not found on PATH. Install it from aka.ms/azure-cli, then try again, or run `az login` manually.":"Could not start az login: "+m}var _signInInflight=null;function signIn(opts={}){return _signInInflight||(_signInInflight=_doSignIn(opts).finally(()=>{_signInInflight=null}),_signInInflight)}function _doSignIn({timeoutMs=18e4,_spawn=spawn}={}){return new Promise(resolve=>{let isWin=process.platform==="win32",env={...inheritedCliEnvironment(),AZURE_CORE_LOGIN_EXPERIENCE_V2:"off"},child;try{child=_spawn("az",["login","--only-show-errors"],{env,windowsHide:!0,shell:isWin,stdio:["ignore","ignore","pipe"]})}catch(e){resolve({ok:!1,error:azMissingMsg(e)});return}let err="";child.stderr&&child.stderr.on("data",d=>{err+=String(d)});let timer=setTimeout(()=>{try{child.kill()}catch{}resolve({ok:!1,error:"Sign-in timed out after 3 minutes. Finish az login in the browser, then click Refresh."})},timeoutMs);child.on("error",e=>{clearTimeout(timer),resolve({ok:!1,error:azMissingMsg(e)})}),child.on("close",code=>{if(clearTimeout(timer),code===0){resetTokenCache(),resolve({ok:!0});return}resolve({ok:!1,error:err.trim()||"az login exited with code "+code})})})}var SE_RESOURCE_TYPE={blob:"Azure.BlobContainer",file:"Azure.FileShare",queue:"Azure.Queue",table:"Azure.Table"};function storageExplorerDeepLink({account,kind,item}={}){let m=account?accountMeta(account):null;if(!m||!m.subscriptionId||!m.resourceGroup)return null;let accountId=`/subscriptions/${m.subscriptionId}/resourceGroups/${m.resourceGroup}/providers/Microsoft.Storage/storageAccounts/${m.name}`,link="storageexplorer://v=1&accountid="+encodeURIComponent(accountId)+"&subscriptionid="+encodeURIComponent(m.subscriptionId),rt=kind?SE_RESOURCE_TYPE[kind]:null;return rt&&item&&(link+="&resourcetype="+encodeURIComponent(rt)+"&resourcename="+encodeURIComponent(item)),link}function storageExplorerExe(){if(process.platform!=="win32")return null;let candidates=[process.env.LOCALAPPDATA&&process.env.LOCALAPPDATA+"\\Programs\\Microsoft Azure Storage Explorer\\StorageExplorer.exe",process.env.ProgramFiles&&process.env.ProgramFiles+"\\Microsoft Azure Storage Explorer\\StorageExplorer.exe",process.env["ProgramFiles(x86)"]&&process.env["ProgramFiles(x86)"]+"\\Microsoft Azure Storage Explorer\\StorageExplorer.exe"].filter(Boolean);for(let p of candidates)try{if(existsSync(p))return p}catch{}return null}var SE_DOWNLOAD="https://aka.ms/storageexplorer",_seInstalled;function storageExplorerInstalled(){if(_seInstalled!==void 0)return _seInstalled;if(storageExplorerExe())return _seInstalled=!0;if(process.platform==="win32"){for(let key of["HKCU\\Software\\Classes\\storageexplorer","HKCR\\storageexplorer"])try{let r=spawnSync("reg",["query",key],{stdio:"ignore",windowsHide:!0});if(r&&r.status===0)return _seInstalled=!0}catch{}return _seInstalled=!1}return _seInstalled=null}function openBrowser(url){let opts={detached:!0,stdio:"ignore"},file,args;process.platform==="win32"?(file=process.env.ComSpec||"cmd.exe",args=["/c","start","",url]):process.platform==="darwin"?(file="open",args=[url]):(file="xdg-open",args=[url]);try{let c=spawn(file,args,opts);c.on("error",()=>{}),c.unref&&c.unref()}catch{}}function seMissingMsg(e){let m=String(e&&e.message||e);return/ENOENT/i.test(m)?"Azure Storage Explorer isn't installed. Get the free desktop app at "+SE_DOWNLOAD+".":"Could not launch Azure Storage Explorer: "+m}function openInStorageExplorer({account,kind,item}={}){return new Promise(resolve=>{if(storageExplorerInstalled()===!1){openBrowser(SE_DOWNLOAD),resolve({ok:!1,notInstalled:!0,install:SE_DOWNLOAD});return}let link=storageExplorerDeepLink({account,kind,item}),exe=storageExplorerExe(),opts={detached:!0,stdio:"ignore"},file,args;if(exe)file=exe,args=link?[link]:[];else if(process.platform==="win32"){if(!link){openBrowser(SE_DOWNLOAD),resolve({ok:!1,notInstalled:!0,install:SE_DOWNLOAD});return}file=process.env.ComSpec||"cmd.exe",args=["/c","start","",link]}else process.platform==="darwin"?(file="open",args=link?[link]:["-a","Microsoft Azure Storage Explorer"]):(file="StorageExplorer",args=link?[link]:[]);let onFail=e=>{if(e&&/ENOENT/i.test(String(e.message||e))){openBrowser(SE_DOWNLOAD),resolve({ok:!1,notInstalled:!0,install:SE_DOWNLOAD});return}resolve({ok:!1,error:seMissingMsg(e)})},child;try{child=spawn(file,args,opts)}catch(e){onFail(e);return}child.on("error",onFail),child.on("spawn",()=>{try{child.unref()}catch{}resolve({ok:!0,deepLink:!!link})})})}async function armToken(){return tokenFor("https://management.azure.com/.default")}async function armPost(path3){let res=await fetch(`${ARM}${path3}`,{method:"POST",headers:{Authorization:`Bearer ${await armToken()}`}});if(!res.ok){let e=new Error(`ARM POST ${path3} \u2192 HTTP ${res.status}`);throw e.statusCode=res.status,e}return res.json()}async function armGetAll(path3){let token=await armToken(),url=path3.startsWith("http")?path3:`${ARM}${path3}`,items=[];for(;url;){let res=await fetch(url,{headers:{Authorization:`Bearer ${token}`}});if(!res.ok){let e=new Error(`ARM GET ${url} \u2192 HTTP ${res.status}`);throw e.statusCode=res.status,e}let j=await res.json();if(Array.isArray(j.value))for(let v of j.value)items.push(v);url=j.nextLink||j["@odata.nextLink"]||null}return items}async function listSubscriptions(){return(await armGetAll("/subscriptions?api-version=2022-12-01")).map(s=>({subscriptionId:s.subscriptionId,displayName:s.displayName}))}var accountIndex=new Map;function rgFromId(id){let m=/\/resourceGroups\/([^/]+)\//i.exec(id||"");return m?m[1]:""}async function mapLimit(items,limit,fn){let results=[],i=0,workers=Array.from({length:Math.min(limit,items.length)},async()=>{for(;i<items.length;){let idx=i++;results[idx]=await fn(items[idx])}});return await Promise.all(workers),results}async function listStorageAccounts({concurrency=16}={}){let subs=await listSubscriptions(),{accounts}=await listStorageAccountsForSubs(subs,{concurrency});return accounts}async function listStorageAccountsForSubs(subs,{concurrency=16}={}){let out=[],errors=[];return await mapLimit(subs,concurrency,async sub=>{let accts;try{accts=await armGetAll(`/subscriptions/${sub.subscriptionId}/providers/Microsoft.Storage/storageAccounts?api-version=${API}`)}catch(e){errors.push({subscriptionName:sub.displayName,subscriptionId:sub.subscriptionId,error:String(e?.message||e)});return}for(let a of accts){let acct={name:a.name,subscriptionId:sub.subscriptionId,subscriptionName:sub.displayName,resourceGroup:rgFromId(a.id),location:a.location||"",sku:a.sku?.name||"",kind:a.kind||""};accountIndex.set(a.name,acct),out.push(acct)}}),out.sort((x,y)=>x.name.localeCompare(y.name)),{accounts:out,errors}}function accountMeta(account){return accountIndex.get(account)||null}async function fetchAccountKey(account){let m=accountIndex.get(account);if(!m)throw new Error(`account '${account}' not indexed`);let key=(await armPost(`/subscriptions/${m.subscriptionId}/resourceGroups/${m.resourceGroup}/providers/Microsoft.Storage/storageAccounts/${account}/listKeys?api-version=${API}`))?.keys?.[0]?.value;if(!key)throw new Error("listKeys returned no key");return key}var svcCache=new Map;function accountUrl(account){return`https://${account}.blob.core.windows.net`}async function probe(svc){await svc.listContainers().byPage({maxPageSize:1})[Symbol.asyncIterator]().next()}function isAuthError(e){let s=e?.statusCode??e?.response?.status;if(s===401||s===403)return!0;let txt=`${e?.code||e?.name||""} ${e?.message||""}`;return/Authoriz|Authentic|KeyBasedAuthenticationNotPermitted|InvalidAuthenticationInfo|NoAuthenticationInformation/i.test(txt)}async function buildEntry(account){try{let key=await fetchAccountKey(account);return{svc:new BlobServiceClient(accountUrl(account),new StorageSharedKeyCredential(account,key)),mode:"sharedKey",key}}catch{return{svc:new BlobServiceClient(accountUrl(account),sharedCredential),mode:"aad",key:null}}}async function withBlob(account,fn){let entry=svcCache.get(account);entry||(entry=await buildEntry(account),svcCache.set(account,entry));try{return await fn(entry.svc)}catch(e){if(entry.mode==="sharedKey"&&isAuthError(e)){let aad={svc:new BlobServiceClient(accountUrl(account),sharedCredential),mode:"aad",key:null};return svcCache.set(account,aad),await fn(aad.svc)}throw e}}async function resolveBlobService(account){if(svcCache.has(account))return svcCache.get(account);let keyErr=null,aadErr=null;try{let key=await fetchAccountKey(account),cred=new StorageSharedKeyCredential(account,key),svc=new BlobServiceClient(accountUrl(account),cred);await probe(svc);let entry={svc,mode:"sharedKey",key};return svcCache.set(account,entry),entry}catch(err){keyErr=err}try{let svc=new BlobServiceClient(accountUrl(account),sharedCredential);await probe(svc);let entry={svc,mode:"aad",key:null};return svcCache.set(account,entry),entry}catch(err){aadErr=err}throw new Error(`Could not access '${account}': key fallback ${keyErr?.code||keyErr?.message||"n/a"}; AAD ${aadErr?.code||aadErr?.message||"n/a"}.`)}async function listContainers(account){return withBlob(account,async svc=>{let out=[];for await(let c of svc.listContainers())out.push({name:c.name,lastModified:c.properties?.lastModified||null});return out})}function mapBlob(b){return{name:b.name,size:b.properties?.contentLength??0,lastModified:b.properties?.lastModified?new Date(b.properties.lastModified).toISOString():null,contentType:b.properties?.contentType||"",accessTier:b.properties?.accessTier||"",blobType:b.properties?.blobType||"",tags:b.tags||null}}async function collectBlobs(cc,max){let out=[],truncated=!1;try{for await(let b of cc.listBlobsFlat({includeTags:!0})){if(out.length>=max){truncated=!0;break}out.push(mapBlob(b))}}catch{out.length=0,truncated=!1;for await(let b of cc.listBlobsFlat()){if(out.length>=max){truncated=!0;break}out.push(mapBlob(b))}}return out.truncated=truncated,out.limit=max,out}async function listBlobs(account,container,{max=5e3}={}){return withBlob(account,svc=>collectBlobs(svc.getContainerClient(container),max))}async function createContainer(account,container){let{svc}=await resolveBlobService(account);return await svc.getContainerClient(container).createIfNotExists(),{ok:!0,container}}async function deleteContainer(account,container){let{svc}=await resolveBlobService(account);return await svc.getContainerClient(container).delete(),{ok:!0}}async function deleteBlob(account,container,name){let{svc}=await resolveBlobService(account);return await svc.getContainerClient(container).getBlockBlobClient(name).delete(),{ok:!0}}async function setBlobTier(account,container,name,tier){let{svc}=await resolveBlobService(account);return await svc.getContainerClient(container).getBlockBlobClient(name).setAccessTier(tier),{ok:!0}}async function uploadBlob(account,container,name,buffer,contentType){let{svc}=await resolveBlobService(account),cc=svc.getContainerClient(container);return await cc.createIfNotExists(),await cc.getBlockBlobClient(name).uploadData(buffer,contentType?{blobHTTPHeaders:{blobContentType:contentType}}:void 0),{ok:!0,name,size:buffer.length}}async function downloadBlob(account,container,name,{maxBytes=null}={}){let{svc}=await resolveBlobService(account),bc=svc.getContainerClient(container).getBlockBlobClient(name);if(Number.isFinite(maxBytes)&&maxBytes>0){let resp=await bc.download(0,maxBytes);return await streamToBuffer(resp.readableStreamBody)}return await bc.downloadToBuffer()}async function blobSize(account,container,name){let{svc}=await resolveBlobService(account),props=await svc.getContainerClient(container).getBlockBlobClient(name).getProperties();return Number(props.contentLength)||0}async function streamToBuffer(stream){let chunks=[];for await(let chunk of stream)chunks.push(Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk));return Buffer.concat(chunks)}async function generateBlobSas(account,container,name,{minutes=60,permissions="r"}={}){let entry=await resolveBlobService(account),perms=BlobSASPermissions.parse(permissions||"r"),startsOn=new Date(Date.now()-5*6e4),expiresOn=new Date(Date.now()+Math.max(1,minutes)*6e4),common={containerName:container,blobName:name,permissions:perms,startsOn,expiresOn,protocol:SASProtocol.Https},sas,mode;if(entry.mode==="sharedKey"&&entry.key){let cred=new StorageSharedKeyCredential(account,entry.key);sas=generateBlobSASQueryParameters(common,cred).toString(),mode="account-key"}else{let udk=await entry.svc.getUserDelegationKey(startsOn,expiresOn);sas=generateBlobSASQueryParameters(common,udk,account).toString(),mode="user-delegation"}let encName=name.split("/").map(encodeURIComponent).join("/");return{url:`${accountUrl(account)}/${container}/${encName}?${sas}`,expiresOn:expiresOn.toISOString(),permissions:permissions||"r",mode}}async function generateContainerSas(account,container,{minutes=1440,permissions="rl"}={}){let entry=await resolveBlobService(account),perms=ContainerSASPermissions.parse(permissions||"rl"),startsOn=new Date(Date.now()-5*6e4),expiresOn=new Date(Date.now()+Math.max(1,minutes)*6e4),common={containerName:container,permissions:perms,startsOn,expiresOn,protocol:SASProtocol.Https},sas,mode;if(entry.mode==="sharedKey"&&entry.key){let cred=new StorageSharedKeyCredential(account,entry.key);sas=generateBlobSASQueryParameters(common,cred).toString(),mode="account-key"}else{let udk=await entry.svc.getUserDelegationKey(startsOn,expiresOn);sas=generateBlobSASQueryParameters(common,udk,account).toString(),mode="user-delegation"}return{url:`${accountUrl(account)}/${container}?${sas}`,expiresOn:expiresOn.toISOString(),permissions:permissions||"rl",mode}}async function listSasBlobs(sasUrl,{max=5e3}={}){let cc=new ContainerClient(sasUrl);return collectBlobs(cc,max)}async function downloadSasBlob(sasUrl,name){return await new ContainerClient(sasUrl).getBlockBlobClient(name).downloadToBuffer()}var queueCache=new Map;function queueUrl(account){return`https://${account}.queue.core.windows.net`}async function resolveQueueService(account){if(queueCache.has(account))return queueCache.get(account);let keyErr=null;try{let key=await fetchAccountKey(account),svc=new QueueServiceClient(queueUrl(account),new QueueSharedKey(account,key));await svc.listQueues().byPage({maxPageSize:1})[Symbol.asyncIterator]().next();let e={svc,mode:"sharedKey"};return queueCache.set(account,e),e}catch(err){keyErr=err}try{let svc=new QueueServiceClient(queueUrl(account),sharedCredential);await svc.listQueues().byPage({maxPageSize:1})[Symbol.asyncIterator]().next();let e={svc,mode:"aad"};return queueCache.set(account,e),e}catch(err){throw new Error(`Could not access queues for '${account}': key ${keyErr?.code||keyErr?.message||"n/a"}; AAD ${err?.code||err?.message||"n/a"}.`)}}async function listQueues(account){let{svc}=await resolveQueueService(account),out=[];for await(let q of svc.listQueues()){let count=null;try{count=(await svc.getQueueClient(q.name).getProperties()).approximateMessagesCount??null}catch{}out.push({name:q.name,approximateMessagesCount:count})}return out}async function peekQueueMessages(account,queue,{max=32}={}){let{svc}=await resolveQueueService(account);return((await svc.getQueueClient(queue).peekMessages({numberOfMessages:Math.min(max,32)})).peekedMessageItems||[]).map(m=>({messageId:m.messageId,messageText:m.messageText,insertedOn:m.insertedOn?new Date(m.insertedOn).toISOString():null,dequeueCount:m.dequeueCount??0}))}async function createQueue(account,queue){let{svc}=await resolveQueueService(account);return await svc.getQueueClient(queue).create(),{ok:!0}}async function deleteQueue(account,queue){let{svc}=await resolveQueueService(account);return await svc.getQueueClient(queue).delete(),{ok:!0}}async function sendQueueMessage(account,queue,text){let{svc}=await resolveQueueService(account);return{ok:!0,messageId:(await svc.getQueueClient(queue).sendMessage(String(text??""))).messageId}}async function clearQueueMessages(account,queue){let{svc}=await resolveQueueService(account);return await svc.getQueueClient(queue).clearMessages(),{ok:!0}}async function withReceivedMessage(account,queue,messageId,act){let{svc}=await resolveQueueService(account),qc=svc.getQueueClient(queue),msgs=(await qc.receiveMessages({numberOfMessages:32,visibilityTimeout:30})).receivedMessageItems||[],target=msgs.find(m=>m.messageId===messageId);for(let m of msgs)if(m.messageId!==messageId)try{await qc.updateMessage(m.messageId,m.popReceipt,void 0,0)}catch{}if(!target)throw new Error("That message isn't among the first 32 in the queue, so it can't be changed directly.");return await act(qc,target),{ok:!0}}async function updateQueueMessage(account,queue,messageId,text){return withReceivedMessage(account,queue,messageId,(qc,target)=>qc.updateMessage(messageId,target.popReceipt,String(text??""),0))}async function deleteQueueMessage(account,queue,messageId){return withReceivedMessage(account,queue,messageId,(qc,target)=>qc.deleteMessage(messageId,target.popReceipt))}var tableCache=new Map;function tableUrl(account){return`https://${account}.table.core.windows.net`}async function resolveTableService(account){if(tableCache.has(account))return tableCache.get(account);let keyErr=null;try{let key=await fetchAccountKey(account),cred=new AzureNamedKeyCredential(account,key),svc=new TableServiceClient(tableUrl(account),cred);await svc.listTables().byPage({maxPageSize:1})[Symbol.asyncIterator]().next();let e={svc,mode:"sharedKey",cred};return tableCache.set(account,e),e}catch(err){keyErr=err}try{let cred=sharedCredential,svc=new TableServiceClient(tableUrl(account),cred);await svc.listTables().byPage({maxPageSize:1})[Symbol.asyncIterator]().next();let e={svc,mode:"aad",cred};return tableCache.set(account,e),e}catch(err){throw new Error(`Could not access tables for '${account}': key ${keyErr?.code||keyErr?.message||"n/a"}; AAD ${err?.code||err?.message||"n/a"}.`)}}async function listTables(account){let{svc}=await resolveTableService(account),out=[];for await(let t of svc.listTables())out.push({name:t.name});return out}async function queryTableEntities(account,table,{max=100}={}){let{cred}=await resolveTableService(account),tc=new TableClient(tableUrl(account),table,cred),rows=[],cols=new Set(["partitionKey","rowKey","timestamp"]);for await(let ent of tc.listEntities()){let row={};for(let k of Object.keys(ent)){if(k.startsWith("odata.")||k==="etag")continue;cols.add(k);let v=ent[k];row[k]=v&&typeof v=="object"&&typeof v.toISOString=="function"?v.toISOString():v}if(rows.push(row),rows.length>=max)break}return{columns:Array.from(cols),rows}}async function createTable(account,table){let{svc}=await resolveTableService(account);return await svc.createTable(table),{ok:!0}}async function deleteTable(account,table){let{svc}=await resolveTableService(account);return await svc.deleteTable(table),{ok:!0}}async function upsertEntity(account,table,entity){if(!entity||!entity.partitionKey||!entity.rowKey)throw new Error("entity requires partitionKey and rowKey");let{cred}=await resolveTableService(account);return await new TableClient(tableUrl(account),table,cred).upsertEntity(entity,"Merge"),{ok:!0}}async function deleteEntity(account,table,partitionKey,rowKey){let{cred}=await resolveTableService(account);return await new TableClient(tableUrl(account),table,cred).deleteEntity(partitionKey,rowKey),{ok:!0}}var shareCache=new Map;function fileUrl(account){return`https://${account}.file.core.windows.net`}async function resolveShareService(account){if(shareCache.has(account))return shareCache.get(account);let keyErr=null;try{let key=await fetchAccountKey(account),svc=new ShareServiceClient(fileUrl(account),new FileSharedKey(account,key));await svc.listShares().byPage({maxPageSize:1})[Symbol.asyncIterator]().next();let e={svc,mode:"sharedKey"};return shareCache.set(account,e),e}catch(err){keyErr=err}try{let svc=new ShareServiceClient(fileUrl(account),sharedCredential,{fileRequestIntent:"backup"});await svc.listShares().byPage({maxPageSize:1})[Symbol.asyncIterator]().next();let e={svc,mode:"aad"};return shareCache.set(account,e),e}catch(err){throw new Error(`Could not access file shares for '${account}': key ${keyErr?.code||keyErr?.message||"n/a"}; AAD ${err?.code||err?.message||"n/a"}.`)}}async function listShares(account){let{svc}=await resolveShareService(account),out=[];for await(let s of svc.listShares())out.push({name:s.name,quotaGiB:s.properties?.quota??null});return out}async function listShareItems(account,share,dir=""){let{svc}=await resolveShareService(account),dc=svc.getShareClient(share).getDirectoryClient(dir||""),out=[];for await(let item of dc.listFilesAndDirectories())out.push({name:item.name,kind:item.kind,size:item.kind==="file"?item.properties?.contentLength??0:null});return out}async function createShare(account,share){let{svc}=await resolveShareService(account);return await svc.getShareClient(share).create(),{ok:!0}}async function deleteShare(account,share){let{svc}=await resolveShareService(account);return await svc.getShareClient(share).delete(),{ok:!0}}async function createShareDirectory(account,share,dir){let{svc}=await resolveShareService(account);return await svc.getShareClient(share).getDirectoryClient(dir).create(),{ok:!0}}async function uploadShareFile(account,share,name,buffer){let{svc}=await resolveShareService(account),fc=svc.getShareClient(share).rootDirectoryClient.getFileClient(name);return await fc.create(buffer.length),buffer.length&&await fc.uploadData(buffer),{ok:!0,size:buffer.length}}async function downloadShareFile(account,share,name){let{svc}=await resolveShareService(account);return await svc.getShareClient(share).rootDirectoryClient.getFileClient(name).downloadToBuffer()}async function deleteShareItem(account,share,name,kind){let{svc}=await resolveShareService(account),sc=svc.getShareClient(share);return kind==="directory"?await sc.getDirectoryClient(name).delete():await sc.rootDirectoryClient.getFileClient(name).delete(),{ok:!0}}function fmtBytes(n){if(n=Number(n)||0,n<1024)return`${n} B`;let u=["KB","MB","GB","TB","PB"],i=-1;do n/=1024,i++;while(n>=1024&&i<u.length-1);return`${n.toFixed(n>=10?0:1)} ${u[i]}`}function globToRe(glob){let body=String(glob).replace(/[.+^${}()|[\]\\]/g,"\\$&").replace(/\*/g,".*").replace(/\?/g,".");return new RegExp("^"+body+"$","i")}function typeFamily(contentType,name){let ct=String(contentType||"").toLowerCase(),ext=String(name||"").toLowerCase().split(".").pop();return/^image\//.test(ct)||/^(png|jpe?g|gif|webp|bmp|svg|tiff?)$/.test(ext)?"image":/^video\//.test(ct)||/^(mp4|mov|avi|mkv|webm)$/.test(ext)?"video":/^audio\//.test(ct)||/^(mp3|wav|flac|ogg|m4a)$/.test(ext)?"audio":/json|xml|csv|text\/|javascript|yaml/.test(ct)||/^(json|xml|csv|txt|log|md|yaml|yml|js|ts|html?|css)$/.test(ext)?"text/data":/pdf|word|excel|powerpoint|officedocument|msword/.test(ct)||/^(pdf|docx?|xlsx?|pptx?)$/.test(ext)?"document":/zip|gzip|tar|compress|x-7z|rar/.test(ct)||/^(zip|gz|tar|7z|rar|bz2)$/.test(ext)?"archive":/octet-stream/.test(ct)||/^(bin|dat|iso|vhd|img)$/.test(ext)?"binary":ct.split("/")[0]||"other"}function applyBlobFilter(blobs,c={}){let list=Array.isArray(blobs)?blobs:[],nowMs=c.now?Date.parse(c.now):Date.now(),re=c.namePattern&&String(c.namePattern).trim()?globToRe(String(c.namePattern).trim()):null,prefix=c.prefix!=null&&String(c.prefix)!==""?String(c.prefix).toLowerCase():null,suffix=c.suffix!=null&&String(c.suffix)!==""?String(c.suffix).toLowerCase():null,contains=c.contains!=null&&String(c.contains)!==""?String(c.contains).toLowerCase():null,min=c.minSize!=null&&c.minSize!==""?Number(c.minSize):null,max=c.maxSize!=null&&c.maxSize!==""?Number(c.maxSize):null,older=c.olderThanDays!=null&&c.olderThanDays!==""?Number(c.olderThanDays):null,newer=c.newerThanDays!=null&&c.newerThanDays!==""?Number(c.newerThanDays):null,type=c.type&&String(c.type).trim()&&c.type!=="all"?String(c.type).trim():null,tiers=normList(c.tiers).map(t=>t.toLowerCase()),blobTypes=normList(c.blobTypes).map(t=>t.toLowerCase()),tagKeys=normList(c.tagKeys),tags=c.tags&&typeof c.tags=="object"?c.tags:null,DAY=864e5;return list.filter(b=>{let nm=String(b.name||""),nml=nm.toLowerCase();if(re&&!re.test(nm)||prefix&&!nml.startsWith(prefix)||suffix&&!nml.endsWith(suffix)||contains&&nml.indexOf(contains)===-1)return!1;let sz=Number(b.size)||0;if(min!=null&&sz<min||max!=null&&sz>max)return!1;if((older!=null||newer!=null)&&b.lastModified){let ageMs=nowMs-Date.parse(b.lastModified);if(older!=null&&!(ageMs>older*DAY)||newer!=null&&!(ageMs<=newer*DAY))return!1}else if(older!=null||newer!=null)return!1;if(type&&typeFamily(b.contentType,b.name)!==type||tiers.length&&tiers.indexOf(String(b.accessTier||"").toLowerCase())===-1||blobTypes.length&&blobTypes.indexOf(String(b.blobType||"").toLowerCase())===-1)return!1;if(tagKeys.length){let bt=b.tags||{};for(let k of tagKeys)if(!(k in bt))return!1}if(tags){let bt=b.tags||{};for(let k of Object.keys(tags))if(String(bt[k])!==String(tags[k]))return!1}return!0})}function normList(v){return v==null||v===""?[]:Array.isArray(v)?v.map(x=>String(x).trim()).filter(Boolean):String(v).split(",").map(x=>x.trim()).filter(Boolean)}function computeBlobStats(blobs){let list=Array.isArray(blobs)?blobs:[],n=list.length,sizes=list.map(b=>Number(b.size)||0),total=sizes.reduce((a,s)=>a+s,0),max=n?Math.max(...sizes):0,avg=n?Math.round(total/n):0,buckets=[{label:"0\u20131 KB",lo:0,hi:1024},{label:"1 KB\u20131 MB",lo:1024,hi:1048576},{label:"1\u2013100 MB",lo:1048576,hi:104857600},{label:"100 MB\u20131 GB",lo:104857600,hi:1073741824},{label:">1 GB",lo:1073741824,hi:1/0}].map(bk=>({label:bk.label,n:sizes.filter(s=>s>=bk.lo&&s<bk.hi).length})),byTypeMap=new Map;for(let b of list){let fam=typeFamily(b.contentType,b.name),cur=byTypeMap.get(fam)||{n:0,bytes:0};cur.n++,cur.bytes+=Number(b.size)||0,byTypeMap.set(fam,cur)}let byType=[...byTypeMap.entries()].map(([label,v])=>({label,n:v.n,bytes:v.bytes})).sort((a,b)=>b.bytes-a.bytes),byTierMap=new Map;for(let b of list){let tier=String(b.accessTier||"").trim()||"\u2014",cur=byTierMap.get(tier)||{n:0,bytes:0};cur.n++,cur.bytes+=Number(b.size)||0,byTierMap.set(tier,cur)}let byTier=[...byTierMap.entries()].map(([label,v])=>({label,n:v.n,bytes:v.bytes})).sort((a,b)=>b.bytes-a.bytes),hasTier=byTier.some(t=>t.label!=="\u2014"),byExtMap=new Map;for(let b of list){let parts=String(b.name||"").toLowerCase().split("."),ext=parts.length>1?"."+parts.pop():"(none)",cur=byExtMap.get(ext)||{n:0,bytes:0};cur.n++,cur.bytes+=Number(b.size)||0,byExtMap.set(ext,cur)}let byExt=[...byExtMap.entries()].map(([label,v])=>({label,n:v.n,bytes:v.bytes})).sort((a,b)=>b.bytes-a.bytes).slice(0,8),topLargest=[...list].sort((a,b)=>(Number(b.size)||0)-(Number(a.size)||0)).slice(0,10).map(b=>({name:b.name,size:Number(b.size)||0,sizeh:fmtBytes(b.size),lastModified:b.lastModified||null}));return{count:n,totalBytes:total,totalh:fmtBytes(total),avgBytes:avg,avgh:fmtBytes(avg),maxBytes:max,maxh:fmtBytes(max),buckets,byType,byTier:hasTier?byTier:[],byExt,topLargest}}function filterAndStat(blobs,criteria={}){let filtered=applyBlobFilter(blobs,criteria);return{filtered,stats:computeBlobStats(filtered),criteria}}var OVERWRITE={overwrite:"true",skip:"false","if-newer":"ifSourceNewer"};function resolutionFlag(resolution){return OVERWRITE[resolution]||"true"}function planTransfer(sourceBlobs,destBlobs,resolution="overwrite"){let src=Array.isArray(sourceBlobs)?sourceBlobs:[],dstByName=new Map((Array.isArray(destBlobs)?destBlobs:[]).map(b=>[b.name,b])),conflicts=[],newFiles=[];for(let b of src)dstByName.has(b.name)?conflicts.push(b):newFiles.push(b);let toTransfer;if(resolution==="skip")toTransfer=newFiles.slice();else if(resolution==="if-newer"){let newerConflicts=conflicts.filter(b=>{let d=dstByName.get(b.name),s=Date.parse(b.lastModified||""),dm=Date.parse(d?.lastModified||"");return Number.isFinite(s)&&Number.isFinite(dm)?s>dm:!0});toTransfer=newFiles.concat(newerConflicts)}else toTransfer=src.slice();let bytes=toTransfer.reduce((a,b)=>a+(Number(b.size)||0),0),skipped=src.length-toTransfer.length;return{resolution,sourceCount:src.length,destCount:dstByName.size,conflictCount:conflicts.length,newCount:newFiles.length,transferCount:toTransfer.length,skippedCount:skipped,transferBytes:bytes,transferBytesh:fmtBytes(bytes),conflicts:conflicts.slice(0,100).map(b=>({name:b.name,size:Number(b.size)||0,sizeh:fmtBytes(b.size),lastModified:b.lastModified||null})),toTransfer:toTransfer.map(b=>b.name)}}function azcopyCommand({sourceUrl,destUrl,resolution="overwrite",includeNames=null,allSource=!1}={}){let q=s=>`"${String(s||"").replace(/[\\"$`]/g,"\\$&")}"`,flags=[`--overwrite=${resolutionFlag(resolution)}`];if(allSource)flags.push("--recursive");else if(Array.isArray(includeNames)){if(!includeNames.length)return{command:null,needsLogin:!1,empty:!0};flags.push(`--include-path ${q(includeNames.join(";"))}`),flags.push("--recursive")}else flags.push("--recursive");let needsLogin=!/[?&]sig=/.test(String(sourceUrl||""))||!/[?&]sig=/.test(String(destUrl||""));return{command:`azcopy copy ${q(sourceUrl)} ${q(destUrl)} ${flags.join(" ")}`,needsLogin}}function sniffText(bytes){let buf=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes||[]);if(!buf.length)return{isText:!0,text:""};let control=0;for(let i=0;i<buf.length;i++){let c=buf[i];if(c===0)return{isText:!1,text:null};(c<9||c>13&&c<32||c===127)&&control++}if(control/buf.length>.1)return{isText:!1,text:null};try{let text=new TextDecoder("utf-8",{fatal:!1}).decode(buf);return(text.match(/\uFFFD/g)||[]).length/Math.max(text.length,1)>.1?{isText:!1,text:null}:{isText:!0,text}}catch{return{isText:!1,text:null}}}var MAGIC=[{off:0,hex:"67 6C 54 46",format:"glTF binary (GLB) 3D model",category:"3D model"},{off:0,hex:"89 50 4E 47 0D 0A 1A 0A",format:"PNG image",category:"image"},{off:0,hex:"FF D8 FF",format:"JPEG image",category:"image"},{off:0,hex:"47 49 46 38",format:"GIF image",category:"image"},{off:0,hex:"42 4D",format:"BMP image",category:"image"},{off:0,hex:"49 49 2A 00",format:"TIFF image (little-endian)",category:"image"},{off:0,hex:"4D 4D 00 2A",format:"TIFF image (big-endian)",category:"image"},{off:0,hex:"00 00 01 00",format:"ICO icon",category:"image"},{off:0,hex:"25 50 44 46",format:"PDF document",category:"document"},{off:0,hex:"D0 CF 11 E0 A1 B1 1A E1",format:"Legacy MS Office (OLE2: .doc/.xls/.ppt)",category:"document"},{off:0,hex:"50 4B 03 04",format:"ZIP archive (or OOXML .docx/.xlsx/.pptx, JAR, APK)",category:"archive"},{off:0,hex:"50 4B 05 06",format:"ZIP archive (empty)",category:"archive"},{off:0,hex:"1F 8B",format:"gzip archive",category:"archive"},{off:0,hex:"42 5A 68",format:"bzip2 archive",category:"archive"},{off:0,hex:"37 7A BC AF 27 1C",format:"7-Zip archive",category:"archive"},{off:0,hex:"52 61 72 21 1A 07",format:"RAR archive",category:"archive"},{off:0,hex:"FD 37 7A 58 5A 00",format:"XZ archive",category:"archive"},{off:257,hex:"75 73 74 61 72",format:"TAR archive",category:"archive"},{off:0,hex:"7F 45 4C 46",format:"ELF executable / shared object",category:"executable"},{off:0,hex:"4D 5A",format:"Windows PE executable (.exe/.dll)",category:"executable"},{off:0,hex:"CA FE BA BE",format:"Java class file",category:"executable"},{off:0,hex:"00 61 73 6D",format:"WebAssembly (WASM) module",category:"executable"},{off:0,hex:"4F 67 67 53",format:"Ogg media",category:"audio"},{off:0,hex:"49 44 33",format:"MP3 audio (ID3)",category:"audio"},{off:0,hex:"66 4C 61 43",format:"FLAC audio",category:"audio"},{off:0,hex:"53 51 4C 69 74 65 20 66 6F 72 6D 61 74 20 33 00",format:"SQLite database",category:"database"},{off:0,hex:"50 41 52 31",format:"Apache Parquet",category:"data"},{off:0,hex:"4F 62 6A 01",format:"Apache Avro",category:"data"}],EXT_FORMAT={glb:["glTF binary (GLB) 3D model","3D model"],gltf:["glTF 3D model","3D model"],obj:["Wavefront OBJ 3D model","3D model"],fbx:["Autodesk FBX 3D model","3D model"],stl:["STL 3D model","3D model"],usdz:["USDZ 3D scene","3D model"],ply:["PLY 3D model","3D model"],png:["PNG image","image"],jpg:["JPEG image","image"],jpeg:["JPEG image","image"],gif:["GIF image","image"],webp:["WebP image","image"],bmp:["BMP image","image"],tiff:["TIFF image","image"],ico:["ICO icon","image"],heic:["HEIC image","image"],avif:["AVIF image","image"],svg:["SVG vector image","image"],psd:["Photoshop document","image"],pdf:["PDF document","document"],docx:["Word document (OOXML)","document"],xlsx:["Excel workbook (OOXML)","document"],pptx:["PowerPoint deck (OOXML)","document"],doc:["Legacy Word document","document"],xls:["Legacy Excel workbook","document"],ppt:["Legacy PowerPoint deck","document"],zip:["ZIP archive","archive"],gz:["gzip archive","archive"],tgz:["gzip TAR archive","archive"],tar:["TAR archive","archive"],rar:["RAR archive","archive"],"7z":["7-Zip archive","archive"],bz2:["bzip2 archive","archive"],xz:["XZ archive","archive"],zst:["Zstandard archive","archive"],mp3:["MP3 audio","audio"],wav:["WAV audio","audio"],flac:["FLAC audio","audio"],ogg:["Ogg audio","audio"],m4a:["AAC audio","audio"],mp4:["MP4 video","video"],mov:["QuickTime video","video"],avi:["AVI video","video"],mkv:["Matroska video","video"],webm:["WebM video","video"],exe:["Windows executable","executable"],dll:["Windows library","executable"],so:["Shared object","executable"],wasm:["WebAssembly module","executable"],parquet:["Apache Parquet","data"],avro:["Apache Avro","data"],orc:["Apache ORC","data"],db:["SQLite database","database"],sqlite:["SQLite database","database"],bin:["Raw binary","binary"],dat:["Raw data","binary"]};function hexHead(buf,n=16){let out=[];for(let i=0;i<Math.min(buf.length,n);i++)out.push(buf[i].toString(16).padStart(2,"0").toUpperCase());return out.join(" ")}function extFormat(name){let m=/\.([a-z0-9]+)$/i.exec(String(name||"")),ext=m?m[1].toLowerCase():"",g=EXT_FORMAT[ext];return g?{format:g[0],category:g[1],viaExt:!0}:{format:ext?ext.toUpperCase()+" file":"unknown binary",category:"binary",viaExt:!0}}function sniffBinaryFormat(bytes,name){let buf=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes||[]),magicHex=hexHead(buf),at=(off,hex)=>{let sig=hex.split(" ").map(h=>parseInt(h,16));if(off+sig.length>buf.length)return!1;for(let i=0;i<sig.length;i++)if(buf[off+i]!==sig[i])return!1;return!0};for(let m of MAGIC)if(at(m.off||0,m.hex))return{format:m.format,category:m.category,magicHex,viaExt:!1};if(at(0,"52 49 46 46"))return at(8,"57 45 42 50")?{format:"WebP image",category:"image",magicHex,viaExt:!1}:at(8,"57 41 56 45")?{format:"WAV audio",category:"audio",magicHex,viaExt:!1}:at(8,"41 56 49 20")?{format:"AVI video",category:"video",magicHex,viaExt:!1}:{format:"RIFF container",category:"media",magicHex,viaExt:!1};if(at(4,"66 74 79 70")){let brand=String.fromCharCode(buf[8]||32,buf[9]||32,buf[10]||32,buf[11]||32).trim(),cat=/hei|avif|mif/i.test(brand)?"image":"video";return{format:"ISO media (MP4/MOV/HEIC, brand '"+brand+"')",category:cat,magicHex,viaExt:!1}}let e=extFormat(name);return{format:e.format,category:e.category,magicHex,viaExt:!0}}var IMAGE_MIME={png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",jfif:"image/jpeg",gif:"image/gif",webp:"image/webp",bmp:"image/bmp",ico:"image/x-icon",avif:"image/avif",apng:"image/apng"};function imageMime(name){let m=/\.([a-z0-9]+)$/i.exec(String(name||"")),ext=m?m[1].toLowerCase():"";return IMAGE_MIME[ext]||null}function parseGlb(bytes){let buf=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes||[]);if(buf.length<12)return null;let dv=new DataView(buf.buffer,buf.byteOffset,buf.byteLength);if(dv.getUint32(0,!0)!==1179937895)return null;let version=dv.getUint32(4,!0),off=12,json=null;for(;off+8<=buf.length;){let clen=dv.getUint32(off,!0),ctype=dv.getUint32(off+4,!0),dstart=off+8,dend=dstart+clen;if(ctype===1313821514){if(dend>buf.length)return{version,truncated:!0};json=new TextDecoder("utf-8").decode(buf.subarray(dstart,dend));break}off=dend}if(json==null)return{version,truncated:!0};let g;try{g=JSON.parse(json)}catch{return{version,truncated:!0}}let n=a=>Array.isArray(a)?a.length:0,accessors=g.accessors||[],vertices=0,triangles=0;for(let mesh of g.meshes||[])for(let prim of mesh.primitives||[]){let posIdx=prim.attributes&&prim.attributes.POSITION;posIdx!=null&&accessors[posIdx]&&(vertices+=accessors[posIdx].count||0),prim.indices!=null&&accessors[prim.indices]&&(triangles+=Math.floor((accessors[prim.indices].count||0)/3))}return{version,truncated:!1,meshes:n(g.meshes),materials:n(g.materials),textures:n(g.textures),images:n(g.images),animations:n(g.animations),nodes:n(g.nodes),accessors:n(g.accessors),vertices,triangles,generator:g.asset&&g.asset.generator||null,gltfVersion:g.asset&&g.asset.version||null}}function previewLang(name){let m=/\.([a-z0-9]+)$/i.exec(String(name||"")),ext=m?m[1].toLowerCase():"";return{json:"json",ndjson:"json",js:"javascript",mjs:"javascript",ts:"typescript",csv:"csv",tsv:"csv",xml:"xml",html:"html",htm:"html",md:"markdown",yml:"yaml",yaml:"yaml",log:"log",txt:"text",ini:"ini",conf:"ini",sql:"sql",sh:"shell",py:"python",cs:"csharp"}[ext]||ext||"text"}function parseSasUrl(rawUrl){let u;try{u=new URL(String(rawUrl||"").trim())}catch{return{ok:!1,error:"That doesn't look like a URL."}}if(u.protocol!=="https:"){let emulator=/^(127\.0\.0\.1|localhost|\[::1\])$/i.test(u.hostname);if(!(u.protocol==="http:"&&emulator))return{ok:!1,error:"SAS URL must use HTTPS \u2014 a SAS signature is a bearer credential and must not travel over plain HTTP."}}let q=u.searchParams;if(!q.get("sig"))return{ok:!1,error:"No SAS signature (sig=) in the URL \u2014 that's a plain URL, not a SAS."};let host=u.hostname,accountMatch=/^([^.]+)\.blob\./.exec(host),account=accountMatch?accountMatch[1]:host,segs=u.pathname.replace(/^\/+/,"").split("/"),container=segs[0]||"",blobPath=segs.slice(1).join("/"),perms=q.get("sp")||"",expiry=q.get("se")||"",resource=q.get("sr")||(blobPath?"b":container?"c":""),now=Date.now(),expMs=expiry?Date.parse(expiry):NaN,expired=Number.isFinite(expMs)&&expMs<now;return{ok:!0,account,container,blobPath,permissions:perms,canList:/l/i.test(perms),canRead:/r/i.test(perms),canWrite:/[wac]/i.test(perms),canDelete:/d/i.test(perms),expiresOn:expiry||null,expired,resource,containerUrl:`${u.protocol}//${u.host}/${container}${u.search}`}}function describeSas(p){if(!p?.ok)return p?.error||"Invalid SAS.";let acts=[p.canRead&&"read",p.canList&&"list",p.canWrite&&"write",p.canDelete&&"delete"].filter(Boolean).join(", ")||"none",exp=p.expiresOn?p.expired?`EXPIRED ${p.expiresOn}`:`expires ${p.expiresOn}`:"no expiry";return`Account ${p.account} \xB7 container '${p.container||"(none)"}' \xB7 can ${acts} \xB7 ${exp}`}function blobSasUrl(sasUrl,name){let p=parseSasUrl(sasUrl);if(!p.ok||!p.container)return null;let u;try{u=new URL(String(sasUrl).trim())}catch{return null}let enc=String(name).split("/").map(encodeURIComponent).join("/");return`${u.protocol}//${u.host}/${p.container}/${enc}${u.search}`}async function listSasBlobs2(sasUrl){let p=parseSasUrl(sasUrl);if(!p.ok)throw new Error(p.error);if(!p.container)throw new Error("This SAS has no container in its path \u2014 need a container SAS URL.");if(p.expired)throw new Error(`This SAS expired on ${p.expiresOn}.`);if(!p.canList)throw new Error("This SAS can't LIST (no 'l' permission) \u2014 ask for a list-enabled SAS.");let blobs=await listSasBlobs(p.containerUrl);return{account:p.account,container:p.container,permissions:p.permissions,expiresOn:p.expiresOn,blobs}}async function downloadSasBlob2(sasUrl,name){let p=parseSasUrl(sasUrl);if(!p.ok)throw new Error(p.error);if(p.expired)throw new Error(`This SAS expired on ${p.expiresOn}.`);if(!p.canRead)throw new Error("This SAS can't READ (no 'r' permission).");let buf=await downloadSasBlob(p.containerUrl,name);return{name,contentBase64:buf.toString("base64"),contentType:"application/octet-stream",size:buf.length}}import{execFile}from"node:child_process";var AZCOPY_INSTALL_URL="https://aka.ms/downloadazcopy",azcopyProbe=null;function azcopyDoctor({refresh=!1}={}){return azcopyProbe&&!refresh||(azcopyProbe=new Promise(resolve=>{let done=!1,finish=value=>{done||(done=!0,resolve(value))};execFile("azcopy",["--version"],{timeout:4e3,windowsHide:!0},(err,stdout)=>{if(err){let missing=err.code==="ENOENT";finish({installed:!1,version:null,reason:missing?"notFound":"error",hint:missing?`AzCopy isn't on your PATH. Install it from ${AZCOPY_INSTALL_URL}, then re-open the transfer plan.`:`AzCopy was found but couldn't be queried (${String(err.message||err).slice(0,120)}).`,installUrl:AZCOPY_INSTALL_URL});return}let version=(String(stdout||"").match(/\d+\.\d+\.\d+/)||[])[0]||null;finish({installed:!0,version,reason:"ok",hint:null,installUrl:AZCOPY_INSTALL_URL})}).on("error",()=>finish({installed:!1,version:null,reason:"notFound",hint:`AzCopy isn't on your PATH. Install it from ${AZCOPY_INSTALL_URL}, then re-open the transfer plan.`,installUrl:AZCOPY_INSTALL_URL}))})),azcopyProbe}import{execFile as execFile2,spawn as spawn2,spawnSync as spawnSync2}from"node:child_process";import{createHash}from"node:crypto";import{accessSync,constants,readFileSync}from"node:fs";import{cp,lstat,mkdir,mkdtemp,readFile,readdir,rename,rm,stat,writeFile}from"node:fs/promises";import os from"node:os";import path from"node:path";import{fileURLToPath}from"node:url";function resolveStudioRoot(moduleUrl){let directory=path.dirname(fileURLToPath(moduleUrl)),candidates=path.basename(directory)==="src"?[directory,path.dirname(directory)]:[directory];for(let candidate of candidates)for(let metadata of["studio-package.json","package.json"])try{return accessSync(path.join(candidate,metadata)),candidate}catch(error){if(error.code!=="ENOENT")throw error}throw new Error(`Missing canvas package metadata for ${moduleUrl}`)}function resolveStudioBuildInfo(moduleUrl,fallbackVersion="unknown"){let version=fallbackVersion,revision="unknown";try{let manifest;try{manifest=readFileSync(new URL("./studio-package.json",moduleUrl),"utf8")}catch(error){if(error.code!=="ENOENT")throw error;manifest=readFileSync(path.join(resolveStudioRoot(moduleUrl),"package.json"),"utf8")}version=JSON.parse(manifest).version||fallbackVersion}catch{}try{revision=createHash("sha256").update(readFileSync(new URL(moduleUrl))).digest("hex").slice(0,10)}catch{}return{version,revision}}var ICONS={vscode:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23.15 2.587 18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352zm-5.146 14.861L10.826 12l7.178-5.448v10.896z"/></svg>',github:'<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>',azure:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.05 2 4 20.01h5.86l1.45-3.73 5.63 5.72H24L13.05 2Zm.8 6.42 4.37 10.36-5.25-4.79 2.91-5.01-2.03-.56ZM10.1 17.73H6.78l5.45-10.85 1.43 3.38-3.56 7.47Z"/></svg>'},COMMAND_BUTTONS=`<button class="btn ghost" id="open-vscode">${ICONS.vscode}<span class="label">Open in VS Code</span></button>
      <button class="btn ghost" id="save-github">${ICONS.github}<span class="label">Save to GitHub</span></button>
      <button class="btn ghost" id="deploy-azure">${ICONS.azure}<span class="label">Deploy to Azure</span></button>`;var BUILD_INFO=resolveStudioBuildInfo(new URL("./extension.mjs",import.meta.url));var CSS=`
:root{
  color-scheme:dark;
  /* Fluent 2 dark is the default tone. When the GitHub Copilot app delivers its
     semantic theme tokens they win through the var() fallbacks; the light override
     and the OS-preference fallback below cover light mode. */
  --bg:var(--background-color-default,#0b0b0b);--bg-2:#141414;
  --panel:#1a1a1a;--surface:#1f1f1f;--surface-2:#242424;--surface-3:#2e2e2e;
  --stroke:var(--border-color-default,#333333);--stroke-2:#424242;
  --text:var(--text-color-default,#ffffff);--text-2:#d6d6d6;--text-3:var(--text-color-muted,#a6a6a6);
  --azure:#479ef5;--azure-2:#62abf5;--cyan:#62abf5;
  --accent:#479ef5;--accent-2:#62abf5;--accent-soft:rgba(71,158,245,.12);--sel:rgba(71,158,245,.16);
  --brand:#0f6cbd;--brand-hover:#115ea3;--brand-press:#0c3b5e;
  --on-accent:#04121f;--code-bg:#0b0e14;--code-text:#cbd5e1;
  --glow:0 0 0 2px rgba(71,158,245,.35);
  --grad:linear-gradient(135deg,#0f6cbd,#2886de);
  --grad-soft:rgba(71,158,245,.10);
  --ok:#6ccb5f;--warn:#f2c661;--bad:#f1707b;
  --shadow:0 4px 14px rgba(0,0,0,.4);
  --radius:8px;
}
/* Follow the host (GitHub Copilot app) theme. A valid data-theme-tone wins; a
   missing or invalid tone falls back to data-color-mode; OS preference is the last
   resort. The host updates these attributes live, so the canvas re-themes with no
   reload, no sign-in, and no Azure requery. */
:root[data-theme-tone="dark"],
:root:not([data-theme-tone="light"]):not([data-theme-tone="dark"])[data-color-mode="dark"]{color-scheme:dark}
:root[data-theme-tone="light"],
:root:not([data-theme-tone="light"]):not([data-theme-tone="dark"])[data-color-mode="light"]{
  color-scheme:light;
  --bg:var(--background-color-default,#ffffff);--bg-2:#f6f8fa;
  --panel:#ffffff;--surface:#f6f8fa;--surface-2:#eaeef2;--surface-3:#e1e6ea;
  --stroke:var(--border-color-default,#d0d7de);--stroke-2:#afb8c1;
  --text:var(--text-color-default,#1f2328);--text-2:#424a53;--text-3:var(--text-color-muted,#656d76);
  --azure:#0b6bcb;--azure-2:#0f6cbd;--cyan:#0f6cbd;
  --accent:#0f6cbd;--accent-2:#115ea3;--accent-soft:rgba(15,108,189,.10);--sel:rgba(15,108,189,.12);
  --on-accent:#ffffff;--code-bg:#f6f8fa;--code-text:#1f2328;
  --glow:0 0 0 2px rgba(15,108,189,.35);
  --grad-soft:rgba(15,108,189,.08);
  --ok:#1a7f37;--warn:#9a6700;--bad:#cf222e;
  --shadow:0 4px 14px rgba(140,149,159,.2);
}
@media (prefers-color-scheme: light){
  :root:not([data-color-mode]):not([data-theme-tone]){
    color-scheme:light;
    --bg:var(--background-color-default,#ffffff);--bg-2:#f6f8fa;
    --panel:#ffffff;--surface:#f6f8fa;--surface-2:#eaeef2;--surface-3:#e1e6ea;
    --stroke:var(--border-color-default,#d0d7de);--stroke-2:#afb8c1;
    --text:var(--text-color-default,#1f2328);--text-2:#424a53;--text-3:var(--text-color-muted,#656d76);
    --azure:#0b6bcb;--azure-2:#0f6cbd;--cyan:#0f6cbd;
    --accent:#0f6cbd;--accent-2:#115ea3;--accent-soft:rgba(15,108,189,.10);--sel:rgba(15,108,189,.12);
    --on-accent:#ffffff;--code-bg:#f6f8fa;--code-text:#1f2328;
    --glow:0 0 0 2px rgba(15,108,189,.35);
    --grad-soft:rgba(15,108,189,.08);
    --ok:#1a7f37;--warn:#9a6700;--bad:#cf222e;
    --shadow:0 4px 14px rgba(140,149,159,.2);
  }
}
*{box-sizing:border-box}
html,body{height:100%}
body{margin:0;font:13px/1.5 -apple-system,"Segoe UI",Roboto,system-ui,Helvetica,Arial,sans-serif;
  color:var(--text);-webkit-font-smoothing:antialiased;
  background:linear-gradient(180deg,var(--bg-2),var(--bg))}
::-webkit-scrollbar{width:10px;height:10px}
::-webkit-scrollbar-thumb{background:var(--stroke-2);border-radius:999px;border:2px solid transparent;background-clip:padding-box}
::-webkit-scrollbar-thumb:hover{background:var(--accent);background-clip:padding-box}
::-webkit-scrollbar-track{background:transparent}

/* signature brand hairline at the very top */
body::before{content:"";position:fixed;top:0;left:0;right:0;height:2px;background:var(--brand);z-index:50}

.appbar{display:flex;align-items:center;gap:12px;padding:13px 20px;border-bottom:1px solid var(--stroke);
  background:var(--panel);position:sticky;top:0;z-index:20}
.appbar .logo{width:30px;height:30px;display:grid;place-items:center;flex:none}
.appbar .logo svg{width:30px;height:30px;display:block}
.appbar .sub{font-size:11px;color:var(--text-3);margin-left:2px}
.appbar h1{font-size:15.5px;margin:0;font-weight:600;letter-spacing:.2px;color:var(--text)}
.appbar .spacer{flex:1}
.appbar .seopen{display:inline-flex;align-items:center;gap:6px;cursor:pointer;background:transparent;border:1px solid var(--stroke-2);color:var(--text-3);font-size:12px;font-weight:500;border-radius:999px;padding:5px 7px;white-space:nowrap;transition:background .12s ease,border-color .12s ease,color .12s ease}
.appbar .seopen:hover{background:var(--surface-2);border-color:var(--stroke-2);color:var(--text-2)}
.appbar .seopen .seopen-lbl{display:none}
.appbar .seopen.on .seopen-lbl{display:inline}
.appbar .seopen.on{color:var(--text-2);border-color:var(--stroke-2);background:var(--surface);padding:5px 13px 5px 10px}
.appbar .seopen.on:hover{background:var(--surface-2);border-color:#555;color:var(--text)}
.appbar .seopen:active{transform:translateY(.5px)}
.appbar .seopen svg{width:15px;height:15px;flex:none}
.appbar .seopen:disabled{opacity:.6;cursor:default}
/* Contextual hand-off strip: appears only where the canvas hits its limits */
.secta{display:flex;align-items:center;gap:12px;margin-top:14px;padding:11px 13px;border:1px solid var(--stroke-2);border-radius:12px;background:var(--surface-2)}
.secta-ic{flex:none;display:inline-flex}
.secta-tx{display:flex;flex-direction:column;gap:2px;min-width:0}
.secta-tx b{font-size:12.5px;color:var(--text-1);font-weight:600}
.secta-tx span{font-size:11.5px;color:var(--text-3);line-height:1.45}
.secta-btn{margin-left:auto;flex:none;display:inline-flex;align-items:center;gap:7px;cursor:pointer;background:var(--surface-3,#182338);border:1px solid var(--stroke-2);color:var(--text-1);font-size:12px;font-weight:600;border-radius:999px;padding:7px 14px 7px 11px;white-space:nowrap;transition:background .12s ease,border-color .12s ease}
.secta-btn:hover{background:var(--sel);border-color:rgba(71,158,245,.5)}
.secta-btn:active{transform:translateY(.5px)}
.secta-btn svg{flex:none}
.ctx{display:flex;align-items:center;gap:8px;margin-left:8px;padding-left:16px;border-left:1px solid var(--stroke);min-width:0;overflow:hidden}
.ctx-none{font-size:12px;color:var(--text-3);font-style:italic}
.cx{display:inline-flex;align-items:center;gap:6px;min-width:0;font-size:13px;color:var(--text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cx.strong{color:var(--text);font-weight:600;max-width:240px}
.cx-i{display:inline-flex;flex:none;opacity:.85}
.cx-i svg{width:14px;height:14px}
.cx-sep{color:var(--text-3);opacity:.5;font-size:15px;line-height:1;flex:none}
@media(max-width:900px){.cx.strong{max-width:130px}}
.chip{font-size:10.5px;color:var(--text-2);border:1px solid var(--stroke-2);border-radius:999px;padding:3px 10px;
  background:var(--surface);white-space:nowrap}
.chip.accent{color:var(--accent);border-color:rgba(71,158,245,.45);background:var(--accent-soft)}
.chip.warn{color:#ffb454;border-color:rgba(255,180,84,.4);background:rgba(255,180,84,.1)}

.shell{display:grid;grid-template-columns:320px 1fr;gap:0;height:calc(100vh - 56px);min-height:0}
.shell.collapsed{grid-template-columns:54px 1fr}
.side{border-right:1px solid var(--stroke);background:var(--bg-2);display:flex;flex-direction:column;min-height:0;overflow:hidden}
.main{overflow-y:auto;padding:18px 22px 70px}
.mainwrap{max-width:1080px;margin:0 auto}

.side-head{display:flex;align-items:center;gap:10px;padding:13px 12px;border-bottom:1px solid var(--stroke);min-height:56px;box-sizing:border-box}
.side-head .t{font-size:14px;font-weight:600;letter-spacing:.2px;color:var(--text)}
.side-head .head-ico{flex:none;display:grid;place-items:center}
.side-head .head-ico svg{width:30px;height:30px;display:block}
.iconbtn{cursor:pointer;background:transparent;border:1px solid transparent;border-radius:8px;color:var(--text-2);
  width:28px;height:28px;display:grid;place-items:center;font-size:14px;transition:.12s}
.iconbtn:hover{background:var(--surface-2);color:var(--cyan);border-color:var(--stroke-2)}
#sideToggle{padding:0}
#sideToggle svg{width:17px;height:17px;display:block}
#refreshBtn svg{width:16px;height:16px;display:block}
.side.collapsed .side-head .t,.side.collapsed .side-body,.side.collapsed .side-tools,.side.collapsed .side-head .head-ico{display:none}
.side.collapsed .side-head{justify-content:center;padding:13px 0}
.side.collapsed #refreshBtn{display:none}
/* collapsed vertical icon rail (Azure DevOps style) */
.side-rail{display:none}
.side.collapsed .side-rail{display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 0;overflow-y:auto}
.railbtn{width:36px;height:36px;border-radius:8px;display:grid;place-items:center;cursor:pointer;background:transparent;border:1px solid transparent;position:relative}
.railbtn:hover{background:var(--surface-2);border-color:var(--stroke-2)}
.railbtn .svi{width:19px;height:19px}
.railbtn .rk{font-size:16px;line-height:1}
.railbtn .rk svg{width:16px;height:16px;display:block}
.rail-sep{width:22px;height:1px;background:var(--stroke);margin:5px 0;flex:none}
.side-tools{padding:11px 12px;border-bottom:1px solid var(--stroke)}
.side-body{flex:1;overflow-y:auto;padding:8px 6px 20px}

.search{position:relative}
.search input{width:100%;background:var(--surface);border:1px solid var(--stroke-2);border-radius:10px;
  padding:9px 10px 9px 32px;color:var(--text);font-size:12.5px;outline:none;transition:.12s}
.search input:focus{border-color:var(--accent);box-shadow:var(--glow)}
.search .mag{position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--accent);display:flex;align-items:center;pointer-events:none}
.search .mag svg{width:15px;height:15px;display:block}
.search:focus-within .mag{color:var(--brand)}

.tree{font-size:13px}
.tnode{user-select:none}
.trow{position:relative;display:flex;align-items:center;gap:7px;padding:6px 9px;border-radius:9px;cursor:pointer;white-space:nowrap;overflow:hidden;transition:.1s}
.trow:hover{background:var(--surface-2)}
.trow.sel{background:var(--sel);box-shadow:inset 0 0 0 1px rgba(71,158,245,.45)}
.trow.sel::before{content:"";position:absolute;left:0;top:4px;bottom:4px;width:3px;border-radius:999px;background:var(--grad)}
.tw{width:14px;text-align:center;color:var(--text-3);font-size:10px;transition:transform .15s;flex:none}
.tw.open{transform:rotate(90deg);color:var(--accent)}
.ti{width:18px;display:inline-flex;align-items:center;justify-content:center;flex:none;font-size:13px}
.svi{width:15px;height:15px;display:block;flex:none}
.trow .svi{opacity:.92}
.tlabel{overflow:hidden;text-overflow:ellipsis}
.tmeta{margin-left:auto;color:var(--text-3);font-size:10px;flex:none;padding-left:8px;background:var(--surface-2);border-radius:999px;padding:1px 8px}
.tchildren{margin-left:15px;border-left:1px solid var(--stroke-2);padding-left:5px}
.tempty{color:var(--text-3);font-size:12px;padding:6px 10px;font-style:italic}
.tspin{color:var(--text-2);font-size:12px;padding:6px 10px;display:flex;align-items:center;gap:7px}

.card{background:var(--surface);border:1px solid var(--stroke);
  border-radius:var(--radius);margin-bottom:15px;box-shadow:var(--shadow);overflow:hidden;position:relative;transition:border-color .15s}
.card:hover{border-color:var(--stroke-2)}
.card-head{display:flex;align-items:center;gap:10px;padding:13px 16px;cursor:pointer}
.card-head h2{font-size:14px;margin:0;font-weight:640;display:flex;align-items:center;gap:8px}
.hdr-acct{color:var(--text-2);font-weight:560}
.hdr-sep{color:var(--text-2);opacity:.6;margin:0 2px;font-weight:400}
.hdr-item{color:var(--text);font-weight:680}
.card-head .badge{font-size:10px;color:var(--text-2);border:1px solid var(--stroke-2);border-radius:999px;padding:2px 10px;font-weight:500;background:var(--surface-2)}
.card-head .badge:empty{display:none}
.card-head .cw{margin-left:auto;color:var(--text-3);font-size:12px;transition:transform .15s}
.card-sub{margin:-4px 0 13px;font-size:12px;color:var(--text-3);line-height:1.5}
.xdesthint{font-size:11.5px;color:var(--text-3);margin-top:6px;line-height:1.5}
.xsrc{display:flex;align-items:center;gap:10px;padding:10px 14px;margin-bottom:14px;border-radius:9px;font-size:12.5px}
.xsrc.on{background:rgba(71,158,245,.07);border:1px solid rgba(71,158,245,.28);color:var(--text-2)}
.xsrc.off{background:var(--surface-2);border:1px dashed var(--stroke-2);color:var(--text-3)}
.xsrc-lbl{font-size:10.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--text-3)}
.xsrc-chip{display:inline-flex;align-items:center;gap:6px;padding:4px 11px;border-radius:7px;background:var(--surface-2);border:1px solid var(--stroke-2);font-size:13px;font-weight:600;color:var(--text)}
.xsrc-chip svg{color:var(--accent)}
.xsrc-acct{color:var(--text-2);font-weight:500}
.xsrc-sep{color:var(--text-3);margin:0 1px}
.xsrc-cnt{margin-left:auto;font-size:11.5px;color:var(--text-3);font-weight:500}
.xsrc-ic{display:inline-flex;color:var(--text-3)}
.xsrc.off .xsrc-ic svg{color:var(--text-3)}
.xdesthint code{background:var(--surface-2);border:1px solid var(--stroke-2);border-radius:4px;padding:1px 5px;color:var(--text-2);font-size:11px}
.xerr{display:flex;gap:11px;align-items:flex-start;padding:13px 15px;border-radius:9px;background:rgba(241,112,123,.10);border:1px solid rgba(241,112,123,.42)}
.xerr-ic{color:#f1707b;font-size:16px;line-height:1.2;flex:0 0 auto}
.xerr b{font-size:13px;color:var(--text)}
.xerr-msg{font-size:12.5px;color:var(--text-2);margin-top:3px;line-height:1.5}
/* Transfer plan \u2014 Fluent/Portal-style result */
.xplan{background:linear-gradient(180deg,rgba(71,158,245,.06),rgba(71,158,245,0));border:1px solid var(--stroke-2);border-radius:12px;padding:16px 18px}
.xroute{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.xep{display:inline-flex;align-items:center;gap:7px;padding:6px 12px;border-radius:8px;background:var(--surface-2);border:1px solid var(--stroke-2);font-size:13px;font-weight:600;color:var(--text);max-width:100%}
.xep-t{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.xep-src .xep-ic{color:var(--accent)}
.xep-dst .xep-ic{color:#a78bfa}
.xarrow{color:var(--text-3);display:inline-flex;flex:0 0 auto}
.xpolicy{display:inline-flex;align-items:center;font-size:11px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;padding:4px 10px;border-radius:999px;margin-left:auto;border:1px solid transparent}
.xpol-overwrite{background:rgba(241,112,123,.14);border-color:rgba(241,112,123,.4);color:#f1a0a7}
.xpol-skip{background:rgba(166,166,166,.14);border-color:var(--stroke-2);color:var(--text-2)}
.xpol-if-newer{background:rgba(71,158,245,.14);border-color:rgba(71,158,245,.4);color:#8fc2fb}
.xmetrics{display:grid;grid-template-columns:repeat(5,1fr);gap:1px;margin-top:16px;background:var(--stroke-2);border:1px solid var(--stroke-2);border-radius:10px;overflow:hidden}
.xmetric{background:var(--surface-2);padding:14px 12px;text-align:center;position:relative}
.xm-v{font-size:22px;font-weight:700;color:var(--text);line-height:1.1;letter-spacing:-.01em}
.xm-l{font-size:11px;color:var(--text-3);margin-top:5px;text-transform:uppercase;letter-spacing:.04em}
.xm-accent{box-shadow:inset 3px 0 0 var(--accent)}
.xm-accent .xm-v{color:var(--accent)}
.xm-ok .xm-v{color:var(--ok)}
.xm-warn{box-shadow:inset 3px 0 0 #f1707b}
.xm-warn .xm-v{color:#f1707b}
.xsub{margin-top:12px;font-size:12px;color:var(--text-3)}
.xexplain{display:flex;gap:9px;align-items:flex-start;margin-top:12px;padding:11px 13px;border-radius:9px;font-size:12.5px;line-height:1.55;color:var(--text-2)}
.xexplain svg{flex:0 0 auto;margin-top:1px}
.xexplain b{color:var(--text)}
.pe-ow{background:rgba(241,112,123,.08);border:1px solid rgba(241,112,123,.3)}
.pe-ow svg{color:#f1707b}
.pe-skip{background:rgba(166,166,166,.08);border:1px solid var(--stroke-2)}
.pe-skip svg{color:var(--text-3)}
.pe-ifn{background:rgba(71,158,245,.08);border:1px solid rgba(71,158,245,.3)}
.pe-ifn svg{color:var(--accent)}
.xact{display:inline-flex;align-items:center;font-size:11px;font-weight:600;padding:2px 9px;border-radius:6px}
.act-ow{background:rgba(241,112,123,.16);color:#f1a0a7}
.act-skip{background:rgba(166,166,166,.14);color:var(--text-3)}
.act-ifn{background:rgba(71,158,245,.16);color:#8fc2fb}
.xsub .xdot{margin:0 6px;color:var(--stroke-2)}
.xconf{margin-top:14px;border:1px solid var(--stroke-2);border-radius:10px;overflow:hidden}
.xconf-h{padding:10px 14px;font-size:12.5px;color:var(--text-2);background:rgba(241,112,123,.06);border-bottom:1px solid var(--stroke-2)}
.xconf-badge{display:inline-flex;min-width:20px;height:20px;align-items:center;justify-content:center;padding:0 6px;border-radius:6px;background:rgba(241,112,123,.2);color:#f1a0a7;font-weight:700;font-size:12px;margin-right:6px}
.xtbl{width:100%;border-collapse:collapse;font-size:12.5px}
.xtbl th{text-align:left;padding:8px 14px;color:var(--text-3);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.03em;background:var(--surface-2)}
.xtbl td{padding:8px 14px;border-top:1px solid var(--stroke-2);color:var(--text-2)}
.xcmd-card{margin-top:16px;border:1px solid var(--stroke-2);border-radius:10px;overflow:hidden;background:var(--panel)}
.xcmd-head{display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--surface-2);border-bottom:1px solid var(--stroke-2)}
.xcmd-title{display:inline-flex;align-items:center;font-size:12.5px;font-weight:600;color:var(--text-2)}
.xchip{display:inline-flex;align-items:center;font-size:11px;font-weight:600;padding:3px 9px;border-radius:999px;border:1px solid transparent}
.xchip-ok{background:rgba(108,203,95,.13);border-color:rgba(108,203,95,.38);color:#8fd985}
.xchip-warn{background:rgba(233,165,74,.14);border-color:rgba(233,165,74,.42);color:#e9b96a}
.xcopy{margin-left:auto;display:inline-flex;align-items:center;background:var(--accent);color:var(--on-accent);border:none;border-radius:7px;padding:6px 13px;font-size:12px;font-weight:600;cursor:pointer;transition:filter .12s}
.xcopy:hover{filter:brightness(1.08)}
.xcmd{margin:0;padding:14px;font-family:ui-monospace,Consolas,monospace;font-size:12.5px;line-height:1.6;color:var(--code-text);white-space:pre-wrap;word-break:break-all;background:var(--code-bg)}
.xnote{display:flex;gap:9px;align-items:flex-start;padding:11px 14px;font-size:12px;color:var(--text-3);line-height:1.55;border-top:1px solid var(--stroke-2);background:var(--surface-2)}
.xnote code{background:var(--surface);border:1px solid var(--stroke-2);border-radius:4px;padding:1px 5px;color:var(--text-2);font-size:11.5px}
.xnote-warn{color:var(--text-2);background:rgba(240,170,60,.08)}
.xnote-warn a{color:var(--cyan)}
@media(max-width:640px){.xmetrics{grid-template-columns:repeat(2,1fr)}}
.scopechip{font-size:10.5px;font-weight:600;border-radius:6px;padding:2px 8px;display:inline-flex;align-items:center;gap:5px;max-width:340px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;line-height:1.55;letter-spacing:.1px}
.scopechip.on{color:var(--text-3);background:rgba(71,158,245,.10);border:1px solid rgba(71,158,245,.30)}
.scopechip.on b{color:var(--text);font-weight:650}
.scopechip.off{color:var(--text-3);background:transparent;border:1px dashed var(--stroke-2);font-weight:500}
.scopechip .sc-dot{width:5px;height:5px;border-radius:50%;background:#6ccb5f;flex:0 0 auto}
.scopechip .sc-sep{color:var(--text-3);font-weight:400;opacity:.65;margin:0 1px}
.statscap{font-size:12px;color:var(--text-2);margin:0 0 10px;display:flex;align-items:center;gap:7px}
.statscap b{color:var(--text)}
.statscap .sc-dot{width:7px;height:7px;border-radius:50%;background:#479ef5;flex:0 0 auto}
.card.min .cw{transform:rotate(-90deg)}
.card-body{padding:0 16px 16px}
.card.min .card-body{display:none}

button{cursor:pointer;background:var(--surface-2);color:var(--text);border:1px solid var(--stroke-2);border-radius:8px;
  padding:7px 13px;font-size:12.5px;transition:.12s;font-weight:550}
button:hover{border-color:var(--stroke-2);color:var(--text);background:var(--surface-3)}
button.primary{background:var(--brand);border:1px solid transparent;color:#fff}
button.primary:hover{background:var(--brand-hover);color:#fff}
button.ghost{background:transparent;border:1px solid var(--stroke-2);color:var(--text-2)}
button.ghost:hover{background:var(--grad-soft);color:var(--text);border-color:var(--accent)}
button.danger-ghost{color:#e8705f;border-color:rgba(232,112,95,.35)}
button.danger-ghost:hover{background:rgba(232,112,95,.12);color:#ff8f7f;border-color:rgba(232,112,95,.6)}
button.accent{background:var(--accent-soft);border:1px solid rgba(71,158,245,.45);color:var(--accent);font-weight:600}
button.accent:hover{background:rgba(71,158,245,.20);color:#8fc4fb;border-color:var(--accent)}
button svg{vertical-align:-2px;margin-right:2px}
.cpdot{display:inline-block;width:12px;height:12px;border-radius:50%;background:radial-gradient(circle at 32% 30%,#ff8ad4,#c452e0 55%,#7a3ff0);box-shadow:0 0 6px rgba(196,82,224,.55);vertical-align:-1px;margin-right:3px}
button:disabled{opacity:.5;cursor:not-allowed}
input,select{background:var(--bg-2);color:var(--text);border:1px solid var(--stroke-2);border-radius:9px;
  padding:9px 12px;font-size:12.5px;outline:none;transition:.12s}
select{appearance:none;-webkit-appearance:none;padding-right:30px;
  background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23a6a6a6' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>");
  background-repeat:no-repeat;background-position:right 11px center}
input:hover,select:hover{border-color:var(--stroke-2);background:var(--surface)}
input:focus,select:focus{border-color:var(--accent);box-shadow:var(--glow);background:var(--surface)}
input::placeholder{color:var(--text-3)}

.list{border:1px solid var(--stroke);border-radius:10px;overflow:hidden;max-height:360px;overflow-y:auto;background:rgba(7,11,22,.5)}
.row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 13px;border-bottom:1px solid var(--stroke);cursor:pointer;transition:.1s}
.row:last-child{border-bottom:none}
.row:hover{background:var(--surface-2)}
.row.sel{background:var(--grad-soft);box-shadow:inset 2px 0 0 var(--accent)}
.row .fname{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.row .meta{color:var(--text-3);font-size:11px}
.muted{color:var(--text-2)}
.empty{color:var(--text-3);font-size:12.5px;padding:16px 4px;text-align:center}
.xempty{display:flex;flex-direction:column;align-items:center;text-align:center;gap:10px;padding:26px 20px;background:linear-gradient(180deg,rgba(124,58,237,.08),rgba(124,58,237,0));border:1px solid var(--stroke);border-radius:14px}
.xempty .xe-ic{width:46px;height:46px;border-radius:13px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#7c3aed,#a78bfa);box-shadow:0 5px 16px rgba(124,58,237,.42)}
.xempty .xe-ic svg{width:23px;height:23px}
.xempty .xe-t{font-size:14px;font-weight:650;color:var(--text)}
.xempty .xe-s{font-size:12px;color:var(--text-3);line-height:1.55;max-width:400px}
.flex{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.crumb{display:flex;align-items:center;gap:7px;font-size:13px;color:var(--text-2);margin-bottom:12px;flex-wrap:wrap}
.crumb b{color:var(--text)}
.crumb .sep{color:var(--text-3)}

.bar{height:9px;border-radius:999px;background:var(--surface);border:1px solid var(--stroke-2);overflow:hidden;flex:1;min-width:160px}
.bar>i{display:block;height:100%;width:0;background:var(--brand);transition:width .25s}
.pill{display:inline-block;font-size:10.5px;font-weight:700;border-radius:999px;padding:2px 10px}
.pill.ok{background:rgba(108,203,95,.16);color:var(--ok)}
.pill.bad{background:rgba(241,112,123,.16);color:var(--bad)}
.pill.warn{background:rgba(242,198,97,.16);color:var(--warn)}
.sas-banner{background:var(--surface);border:1px solid var(--stroke-2);border-radius:12px;padding:12px 14px}
.sas-tbl th{text-align:left;font-size:11px;color:var(--muted);font-weight:600;padding:4px 8px;border-bottom:1px solid var(--stroke-2)}
.sas-tbl td{padding:5px 8px;border-bottom:1px solid var(--stroke);font-size:12.5px;vertical-align:middle}
.sas-tbl td.fname{max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sas-tbl tr:hover td{background:rgba(255,255,255,.02)}
/* SAS connected view */
.sasconn{background:linear-gradient(160deg,rgba(71,158,245,.06),rgba(98,171,245,.02) 60%,transparent);border:1px solid var(--stroke-2);border-radius:14px;padding:14px 16px;box-shadow:inset 0 1px 0 rgba(255,255,255,.03),0 8px 24px -16px rgba(0,0,0,.7)}
.sashead{display:flex;align-items:center;gap:13px}
.sasavatar{width:40px;height:40px;border-radius:11px;flex:none;display:grid;place-items:center;background:var(--grad);box-shadow:0 4px 14px -3px rgba(15,108,189,.6)}
.sasid{flex:1;min-width:0}
.sastitle{display:flex;align-items:center;gap:8px;font-size:16.5px;line-height:1.2;overflow:hidden}
.sastitle b{font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sastitle .chev{color:var(--text-3);font-weight:400;flex:none}
.sassub{font-size:11.5px;color:var(--text-3);margin-top:3px}
.sasmeta{display:flex;align-items:center;gap:8px;flex:none}
.constatus{display:inline-flex;align-items:center;gap:7px;font-size:11.5px;font-weight:600;color:var(--ok);background:rgba(108,203,95,.12);border:1px solid rgba(108,203,95,.38);border-radius:999px;padding:4px 12px 4px 9px}
.livedot{width:8px;height:8px;border-radius:50%;background:var(--ok);box-shadow:0 0 0 0 rgba(108,203,95,.5);animation:lpulse 2s infinite;flex:none}
@keyframes lpulse{0%{box-shadow:0 0 0 0 rgba(108,203,95,.45)}70%{box-shadow:0 0 0 6px rgba(108,203,95,0)}100%{box-shadow:0 0 0 0 rgba(108,203,95,0)}}
.permrow{display:flex;align-items:center;gap:14px;margin-top:13px;padding-top:13px;border-top:1px solid var(--stroke)}
.plabel{font-size:10px;font-weight:700;letter-spacing:.9px;text-transform:uppercase;color:var(--text-3);flex:none;width:78px}
.caps{display:flex;gap:8px;flex-wrap:wrap}
.cap{display:inline-flex;align-items:center;gap:7px;font-size:12px;font-weight:600;border-radius:9px;padding:6px 12px;border:1px solid var(--stroke);transition:.14s}
.cap .ci{width:15px;height:15px;display:inline-flex;flex:none}
.cap .lk{width:12px;height:12px;display:inline-flex;margin-left:1px;opacity:.7}
.cap.on{background:linear-gradient(180deg,rgba(108,203,95,.16),rgba(108,203,95,.07));border-color:rgba(108,203,95,.5);color:#8fd782;box-shadow:inset 0 1px 0 rgba(255,255,255,.05)}
.cap.on .ci{color:#8fd782}
.cap.off{background:rgba(255,255,255,.015);color:var(--text-3);border-color:var(--stroke)}
.cap.off .ci{color:var(--text-3);opacity:.75}
.expchip{font-size:11px;font-weight:600;border-radius:999px;padding:4px 12px;border:1px solid var(--stroke-2);color:var(--text-2);background:rgba(255,255,255,.02)}
.expchip.warn{background:rgba(242,198,97,.12);border-color:rgba(242,198,97,.4);color:var(--warn)}
.expchip.bad{background:rgba(241,112,123,.14);border-color:rgba(241,112,123,.4);color:var(--bad)}
.sasm{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:13px}
.sasm .c{background:rgba(255,255,255,.025);border:1px solid var(--stroke);border-radius:12px;padding:11px 13px}
.sasm .c b{display:block;font-size:18px;font-weight:700;line-height:1.1;color:var(--text)}
.sasm .c span{display:block;margin-top:3px;font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:.6px;font-weight:600}
.sasact{width:40px;height:34px;padding:0;font-size:12px;line-height:0;display:inline-flex;align-items:center;justify-content:center;color:var(--text);background:var(--surface-2);border:1px solid var(--stroke-2);border-radius:9px;transition:.12s}
.sasact:hover{color:var(--text);border-color:var(--accent);background:var(--surface-3)}
.sasact svg{width:18px;height:18px;margin:0;vertical-align:middle;stroke-width:1.85}
.sas-tbl th.acth,.sas-tbl td.acth{text-align:right;padding-right:8px}
.acthdr,.rowacts{display:inline-grid;grid-auto-flow:column;grid-auto-columns:40px;gap:12px;justify-content:end;justify-items:center;align-items:center}
.acthdr span{font-size:10px;color:var(--text-3);font-weight:700;text-transform:uppercase;letter-spacing:.4px}
.tierpill{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:600;color:var(--text-2);background:rgba(255,255,255,.03);border:1px solid var(--stroke-2);border-radius:999px;padding:2px 10px}
.tdot{width:7px;height:7px;border-radius:50%;flex:none}
.dlmsg{display:flex;align-items:center;gap:10px;flex-wrap:nowrap;margin-top:12px;padding:10px 12px;background:rgba(108,203,95,.08);border:1px solid rgba(108,203,95,.28);border-radius:10px;font-size:12.5px}
.dlmsg .ok{color:var(--ok);font-weight:600;flex:none}
.dlpath{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11.5px;color:var(--text-2);background:rgba(0,0,0,.3);padding:4px 8px;border-radius:6px;flex:1 1 auto;min-width:60px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dlacts{display:inline-flex;gap:8px;flex:none}
.dlacts button{padding:5px 11px;font-size:12px;white-space:nowrap}
#sasDlAll{display:inline-flex;align-items:center;gap:6px}
#sasDlAll svg{width:13px;height:13px;margin:0}
.xradio{display:inline-flex;align-items:center;gap:5px;font-size:12.5px;color:var(--text);cursor:pointer}
.xradio input{margin:0}
.xstat{display:inline-flex;flex-direction:column;min-width:70px}
.xstat b{font-size:19px;font-weight:700;line-height:1.1;color:var(--text)}
.xstat b.warn{color:var(--warn,#e5a83c)}
.xstat span{font-size:11px;color:var(--muted);margin-top:2px}
.mv{display:inline-flex;color:var(--muted)}
.pill.warn{background:rgba(229,168,60,.14);border-color:rgba(229,168,60,.4);color:#e5a83c}
.xcmd{background:var(--code-bg);border:1px solid var(--stroke-2);border-radius:8px;padding:10px 12px;margin-top:6px;
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:var(--code-text);white-space:pre-wrap;word-break:break-all;overflow-x:auto}

/* aligned form primitives (filter / SAS / transfer cards) */
.filterbar{background:var(--bg-2);border:1px solid var(--stroke);border-radius:14px;padding:14px 15px 13px}
.fgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(158px,1fr));gap:13px 14px}
.field{display:flex;flex-direction:column;gap:6px;min-width:0}
.field>label{font-size:10px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--text-3)}
.field input,.field select{width:100%;box-sizing:border-box}
.factions{display:flex;gap:10px;align-items:center;margin-top:13px;padding-top:12px;border-top:1px solid var(--stroke);flex-wrap:wrap}
.factions .grow{flex:1}
.factions button{display:inline-flex;align-items:center;gap:5px;padding:8px 15px;font-size:12.5px}
.hicon{width:26px;height:26px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;background:var(--grad);box-shadow:0 2px 8px rgba(15,108,189,.45)}
.hicon.g-sas{background:linear-gradient(135deg,#0891b2,#22d3ee);box-shadow:0 2px 8px rgba(8,145,178,.45)}
.hicon.g-xfer{background:linear-gradient(135deg,#7c3aed,#a78bfa);box-shadow:0 2px 8px rgba(124,58,237,.45)}
.hicon.g-log{background:linear-gradient(135deg,#0d9488,#2dd4bf);box-shadow:0 2px 8px rgba(13,148,136,.45)}
.hicon.g-ask{background:linear-gradient(135deg,#8b5cf6,#22d3ee);box-shadow:0 2px 8px rgba(139,92,246,.45)}
.askrow{display:flex;gap:10px;align-items:stretch}
.askbar{flex:1;display:flex;align-items:center;gap:9px;background:var(--surface-2);border:1px solid var(--stroke-2);border-radius:11px;padding:2px 14px;transition:border-color .15s,box-shadow .15s;animation:askglow 3.8s ease-in-out infinite}
.askbar:focus-within{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft);animation:none}
@keyframes askglow{0%,100%{box-shadow:0 0 0 0 rgba(71,158,245,0)}50%{box-shadow:0 0 0 3px rgba(71,158,245,.10)}}
.askbar .ask-mag{color:var(--accent);flex:none;display:flex}
.askbar input{flex:1;background:transparent;border:none;outline:none;color:var(--text);font-size:13.5px;padding:10px 0;min-width:0}
.askbar input::placeholder{color:var(--text-3);transition:opacity .3s ease}
.askbar input.ph-dim::placeholder{opacity:.1}
.askgo{flex:none;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:0 18px;border-radius:10px;font-weight:600}
.askchips{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:11px}
.askchip-lbl{font-size:11px;font-weight:600;letter-spacing:.03em;text-transform:uppercase;color:var(--text-3);margin-right:1px}
.askchip{display:inline-flex;align-items:center;gap:7px;padding:7px 12px;border-radius:999px;background:var(--surface-2);border:1px solid var(--stroke-2);color:var(--text-2);font-size:12px;font-weight:500;cursor:pointer;transition:border-color .14s,background .14s,color .14s,transform .1s}
.askchip:hover{border-color:var(--accent);background:var(--surface-3);color:var(--text);transform:translateY(-1px)}
.askchip:active{transform:translateY(0)}
.askchip>svg{color:#a78bfa;flex:none}
.askout{margin-top:15px;display:flex;flex-direction:column;gap:13px}
.ask-q{display:flex;justify-content:flex-end}
.ask-qtext{max-width:82%;background:linear-gradient(135deg,var(--brand),#2b88d8);color:#fff;padding:9px 14px;border-radius:14px 14px 4px 14px;font-size:13px;line-height:1.5;box-shadow:0 2px 10px rgba(15,108,189,.32);word-break:break-word}
.ask-a{display:flex;gap:10px;align-items:flex-start}
.ask-av{width:30px;height:30px;flex:none;border-radius:9px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#8b5cf6,#22d3ee);box-shadow:0 2px 8px rgba(139,92,246,.4)}
.ask-abody{flex:1;min-width:0;background:var(--surface-2);border:1px solid var(--stroke);border-radius:4px 14px 14px 14px;padding:13px 15px;animation:askpop .22s ease}
@keyframes askpop{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.ask-atext{font-size:13px;line-height:1.6;color:var(--text);white-space:pre-wrap;word-break:break-word}
.ask-abody code,.insight-box code{background:var(--surface-3);border:1px solid var(--stroke);border-radius:5px;padding:1px 6px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;color:#8fd0ff;white-space:normal;word-break:break-word}
.ask-abody strong,.insight-box strong{color:var(--text);font-weight:600}
.ask-abody .stat{background:var(--accent-soft);border-color:rgba(71,158,245,.3);margin:12px 10px 2px 0}
.ask-abody .hbar{font-size:12px;margin:6px 0}
.ask-abody table{width:100%;border-collapse:collapse;margin-top:12px;font-size:12.5px}
.ask-abody th{text-align:left;color:var(--text-3);font-weight:600;font-size:10.5px;text-transform:uppercase;letter-spacing:.04em;padding:6px 10px;border-bottom:1px solid var(--stroke-2)}
.ask-abody td{padding:7px 10px;border-bottom:1px solid var(--stroke);color:var(--text-2)}
.ask-abody tr:last-child td{border-bottom:none}
.sasrow{display:flex;gap:10px;align-items:stretch}
.sasrow input{flex:1;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px}
.sasrow button{white-space:nowrap;display:inline-flex;align-items:center;gap:5px;padding:0 16px}
.fbhint{color:var(--text-2);font-size:11.5px;line-height:1.5;margin-top:12px;padding-top:12px;border-top:1px solid var(--stroke)}
.fbhint code{background:var(--surface-2);border:1px solid var(--stroke-2);border-radius:5px;padding:1px 5px;font-size:11px}
.hint{color:var(--text-2);font-size:12px;margin:12px 2px 0;line-height:1.5}
.hint.top{margin:2px 2px 14px}
.seg{display:inline-flex;border:1px solid var(--stroke-2);border-radius:8px;overflow:hidden}
.seg label{display:inline-flex;align-items:center;gap:6px;padding:7px 14px;font-size:12.5px;cursor:pointer;color:var(--text-2);border-right:1px solid var(--stroke-2);transition:.12s;white-space:nowrap}
.seg label:last-child{border-right:none}
.seg label:hover{background:var(--surface-2);color:var(--text)}
.seg input{position:absolute;opacity:0;pointer-events:none}
.seg label:has(input:checked){background:var(--grad-soft);color:var(--text);font-weight:600;box-shadow:inset 0 -2px 0 var(--accent)}
.seg-wide{display:flex;width:100%;border-radius:9px}
.seg-wide label{flex:1;justify-content:center;padding:9px 10px}
.seg-wide label svg{opacity:.85}
.seg-wide label:has(input:checked) svg{color:var(--accent);opacity:1}
.check{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;color:var(--text-2);cursor:pointer;user-select:none}
.check input{margin:0}
.insight-box{margin-top:12px;border:1px solid var(--stroke-2);border-radius:12px;padding:12px 14px;background:var(--grad-soft);font-size:13px;line-height:1.55}
.insight-head{display:flex;align-items:center;gap:8px;font-weight:640;font-size:12.5px;margin-bottom:6px}
.insight-head .ix{margin-left:auto}
.insight-sug{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:10px;padding-top:10px;border-top:1px solid var(--stroke-2)}
.insight-why{margin-top:10px;font-size:11.5px;color:var(--text-2);line-height:1.5;background:rgba(255,255,255,.03);border:1px solid var(--stroke);border-radius:8px;padding:8px 10px}
.sugcount{font-size:11px;color:var(--accent);background:var(--accent-soft);border:1px solid rgba(71,158,245,.35);border-radius:999px;padding:2px 9px;font-variant-numeric:tabular-nums}
.ix{background:transparent;border:none;color:var(--text-3);font-size:12px;padding:2px 6px;cursor:pointer;border-radius:6px}
.ix:hover{background:var(--surface-2);color:var(--text)}
.rowact{background:var(--surface-2);border:1px solid var(--stroke-2);border-radius:6px;padding:2px 8px;font-size:11px;color:var(--text-2)}
.rowact:hover{background:var(--surface-3);color:var(--text)}
.rowact.del:hover{color:var(--bad,#f1707b);border-color:var(--bad,#f1707b)}

.stat{display:inline-flex;flex-direction:column;padding:12px 18px;border:1px solid var(--stroke-2);border-radius:10px;
  background:var(--grad-soft);margin:0 10px 10px 0;min-width:96px}
.stat b{font-size:20px;font-weight:700;line-height:1.1;color:var(--text)}
.stat span{font-size:11px;color:var(--text-3);margin-top:3px}
.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:16px 0 4px}
.metric{position:relative;padding:14px 16px;border-radius:13px;background:linear-gradient(180deg,var(--surface),var(--surface-2));border:1px solid var(--stroke-2);overflow:hidden}
.metric::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--mc,var(--accent))}
.metric .mk{display:flex;align-items:center;gap:6px;font-size:10.5px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-3)}
.metric .mk .md{width:8px;height:8px;border-radius:50%;background:var(--mc,var(--accent));box-shadow:0 0 8px var(--mc,var(--accent))}
.metric .mv{font-size:23px;font-weight:750;line-height:1.15;color:var(--text);margin-top:7px;font-variant-numeric:tabular-nums;white-space:nowrap}
.metric .mv small{font-size:13px;font-weight:600;color:var(--text-2);margin-left:2px}
@media(max-width:720px){.metrics{grid-template-columns:repeat(2,1fr)}}
.hbar{display:flex;align-items:center;gap:9px;margin:3px 0;font-size:11.5px}
.hbar .track{flex:1;height:8px;background:var(--surface);border-radius:999px;overflow:hidden}
.hbar .track>i{display:block;height:100%;background:linear-gradient(90deg,var(--accent),#8b5cf6);border-radius:999px}
.chart{max-width:680px}
.sect{color:var(--text-3);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;margin:16px 0 8px}
.brow{display:grid;grid-template-columns:108px 1fr;align-items:center;gap:12px;margin:6px 0}
.brow .blabel{color:var(--text-2);font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bwrap{position:relative;height:24px;background:rgba(255,255,255,.05);border-radius:7px;overflow:hidden}
.bwrap .bfill{position:absolute;left:0;top:0;bottom:0;border-radius:7px;min-width:3px;box-shadow:0 1px 6px rgba(0,0,0,.25) inset;transition:width .35s cubic-bezier(.4,0,.2,1)}
.bwrap .bval{position:absolute;right:6px;top:50%;transform:translateY(-50%);line-height:16px;padding:1px 7px;border-radius:6px;background:rgba(15,18,24,.55);font-size:11px;color:#fff;white-space:nowrap;font-variant-numeric:tabular-nums;text-shadow:0 1px 2px rgba(0,0,0,.9)}
.bwrap .bval b{font-weight:700}
.bwrap .bval .bmut{color:var(--text-2)}
.lrow{position:relative;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 12px;border-radius:9px;overflow:hidden;margin:5px 0;background:rgba(255,255,255,.04);border:1px solid var(--stroke)}
.lrow .lfill{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,rgba(56,189,248,.30),rgba(139,92,246,.10));border-right:1px solid rgba(56,189,248,.45)}
.lrow .lname{position:relative;font-size:12.5px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lrow .lsize{position:relative;font-size:12px;color:var(--text-2);white-space:nowrap;font-variant-numeric:tabular-nums;flex:none}
table{width:100%;border-collapse:collapse;font-size:12.5px}
th,td{text-align:left;padding:7px 9px;border-bottom:1px solid var(--stroke)}
th{color:var(--text-3);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.5px}

.err{background:rgba(241,112,123,.1);border:1px solid rgba(241,112,123,.5);color:#f1a3aa;border-radius:10px;padding:10px 14px;margin:14px 22px 0;font-size:12.5px;display:flex;align-items:flex-start;gap:10px}
.err .etext{flex:1}
.err .eclose{cursor:pointer;background:transparent;border:none;color:#f1a3aa;font-size:16px;line-height:1;padding:0 2px;opacity:.8;flex:none}
.err .eclose:hover{opacity:1}
.err .eact{display:flex;align-items:center;gap:8px;flex:none}
.err .ebtn{cursor:pointer;background:#0f6cbd;border:none;color:#fff;font-size:12px;font-weight:600;border-radius:7px;padding:5px 12px;white-space:nowrap}
.err .ebtn:hover{background:#1277c9}
.err.err-auth{background:rgba(71,158,245,.1);border-color:rgba(71,158,245,.45);color:#bcddff}
.err.err-auth .eclose{color:#bcddff}
.log{font-family:ui-monospace,SFMono-Regular,monospace;font-size:11px;color:var(--text-2);white-space:pre-wrap;max-height:170px;overflow-y:auto;background:rgba(7,11,22,.5);border:1px solid var(--stroke);border-radius:10px;padding:10px 12px}
.mono{font-family:ui-monospace,monospace;font-size:11px;color:var(--text-3);white-space:pre-wrap;word-break:break-all;background:rgba(7,11,22,.5);border:1px solid var(--stroke);border-radius:8px;padding:8px 10px;margin-top:6px}
.spin{width:13px;height:13px;border:2px solid var(--stroke-2);border-top-color:var(--cyan);border-radius:50%;display:inline-block;animation:sp .7s linear infinite;vertical-align:middle}
@keyframes sp{to{transform:rotate(360deg)}}

/* subscription scope bar + chip */
.scopebar{display:flex;align-items:stretch;gap:8px}
.scopechip{flex:1;display:flex;align-items:center;gap:8px;min-width:0;padding:8px 11px;border-radius:10px;
  background:var(--grad-soft);border:1px solid var(--stroke-2);font-size:12.5px;font-weight:600;color:var(--text);cursor:pointer}
.scopechip:hover{border-color:var(--accent)}
.scopechip .k{font-size:13px}
.scopechip #scopeLabel{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.scopechip .scope-sub{color:var(--text-3);font-weight:400;font-size:11px;margin-left:3px}
.scopebtn{border:1px solid var(--stroke-2);background:var(--surface);color:var(--text-2);border-radius:10px;padding:0 12px;font-size:12px;font-weight:600;cursor:pointer}
.scopebtn:hover{border-color:var(--accent);color:var(--text)}

/* CTA shown in the tree when nothing is selected */
.tree-cta{text-align:center;padding:26px 14px;color:var(--text-2)}
.tree-cta .ic{font-size:26px;margin-bottom:8px}
.tree-cta p{margin:0 0 14px;font-size:12.5px;line-height:1.5}
.tree-cta button{background:var(--brand);color:#fff;border:none;border-radius:8px;padding:9px 16px;font-weight:600;font-size:12.5px;cursor:pointer}
.tree-cta button:hover{background:var(--brand-hover)}

/* subscription picker modal */
.overlay{position:fixed;inset:0;z-index:100;display:none;align-items:center;justify-content:center;
  background:rgba(0,0,0,.6);backdrop-filter:blur(3px)}
.overlay.open{display:flex}
.dialog{width:min(440px,90vw);max-height:70vh;display:flex;flex-direction:column;
  background:var(--panel);border:1px solid var(--stroke-2);border-radius:12px;
  box-shadow:0 16px 48px rgba(0,0,0,.55);overflow:hidden}
.dialog::before{content:"";display:block;height:2px;background:var(--brand)}
.dlg-head{display:flex;align-items:flex-start;gap:10px;padding:16px 18px 8px}
.dlg-head h3{margin:0;font-size:15px;font-weight:600;color:var(--text)}
.dlg-sub{margin:4px 0 0;font-size:12px;color:var(--text-3)}
.dlg-head .iconbtn{margin-left:auto}
.dlg-search{position:relative;margin:6px 20px 0}
.dlg-search input{width:100%;background:var(--surface);border:1px solid var(--stroke-2);border-radius:10px;padding:9px 12px 9px 32px;color:var(--text);font-size:13px;outline:none}
.dlg-search input:focus{border-color:var(--accent);box-shadow:var(--glow)}
.dlg-search .mag{position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--accent);display:flex;align-items:center;pointer-events:none}
.dlg-search .mag svg{width:15px;height:15px;display:block}
.dlg-meta{display:flex;align-items:center;justify-content:space-between;padding:11px 20px 6px;font-size:11.5px}
.linkbtn{background:none;border:none;color:var(--accent);font-size:11.5px;font-weight:600;cursor:pointer;padding:0}
.linkbtn:hover{color:var(--cyan);text-decoration:underline}
.dlg-list{flex:1;overflow-y:auto;padding:4px 12px 10px;margin:0 8px}
.subrow{display:flex;align-items:center;gap:11px;padding:9px 11px;border-radius:10px;cursor:pointer;border:1px solid transparent}
.subrow:hover{background:var(--surface)}
.subrow.on{background:var(--grad-soft);border-color:var(--stroke-2)}
.subrow input{width:16px;height:16px;accent-color:var(--accent);cursor:pointer;flex:none}
.subrow .info{min-width:0}
.subrow .nm{font-size:12.5px;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.subrow .id{font-size:10.5px;color:var(--text-3);font-family:ui-monospace,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dlg-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:13px 20px;border-top:1px solid var(--stroke)}
button.danger{border-color:rgba(241,112,123,.5);color:#f1a3aa;background:var(--surface-2)}
button.danger:hover{background:rgba(241,112,123,.14);color:#f5c2c7}
.addbtn,.delbtn{background:none;border:none;color:var(--text-3);cursor:pointer;font-size:12px;line-height:1;padding:2px 5px;flex:none;border-radius:6px}
.addbtn{margin-left:auto}
.tmeta+.addbtn,.tmeta+.delbtn{margin-left:6px}
.addbtn:hover{color:var(--cyan);background:var(--surface-2)}
.delbtn:hover{color:var(--bad);background:var(--surface-2)}
.trow .delbtn{opacity:0;margin-left:6px}
.trow:hover .delbtn{opacity:1}
.pinbtn,.hidebtn{background:none;border:none;color:var(--text-3);cursor:pointer;font-size:12px;line-height:1;padding:2px 5px;flex:none;border-radius:6px;opacity:0;margin-left:4px}
.trow:hover .pinbtn,.trow:hover .hidebtn{opacity:1}
.pinbtn.on{opacity:1;color:var(--azure)}
.pinbtn:hover{color:var(--azure);background:var(--surface-2)}
.hidebtn:hover{color:var(--bad);background:var(--surface-2)}
.pinhdr .ti,.hidhdr .ti{color:var(--azure)}
#dataBody{position:relative}
.dropmask{position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(71,158,245,.10);border:2px dashed var(--accent);border-radius:12px;z-index:6;pointer-events:none}
#dataBody.dragging .dropmask{display:flex}
.dropmsg{display:flex;flex-direction:column;align-items:center;gap:8px;color:var(--accent);font-weight:600;font-size:14px;text-align:center}
.dropic{font-size:30px;line-height:1}
.vtool{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid var(--stroke)}
.rowact{background:none;border:1px solid var(--stroke-2);color:var(--text-2);border-radius:7px;padding:2px 9px;font-size:11px;cursor:pointer;flex:none}
.rowact:hover{border-color:var(--accent);color:var(--text)}
.rowact.del:hover{border-color:var(--bad);color:#f1a3aa}
.dti{display:inline-flex;align-items:center}.dti .svi{width:17px;height:17px}
.vtool .grow{margin-left:auto}
.browsetools button{padding:7px 13px;font-size:12px}
.browsetools .primary{background:var(--brand);color:#fff;border:1px solid transparent;font-weight:600}
.browsetools .primary:hover{background:var(--brand-hover);color:#fff}
.browsetools input[type=file]{min-width:230px;font-size:12px;color:var(--text-2)}
.browsetools input[type=file]::file-selector-button{background:var(--surface-3);color:var(--text);border:1px solid var(--stroke-2);border-radius:7px;padding:6px 12px;margin-right:9px;font-size:12px;font-weight:560;cursor:pointer}
.browsetools input[type=file]::file-selector-button:hover{border-color:var(--accent)}
.vhint{color:var(--text-3);font-size:11.5px;margin:10px 2px 0;display:flex;align-items:center;gap:6px}
.welcome{padding:6px 2px 10px}
.wlead{display:flex;align-items:center;gap:11px;padding:2px 2px 16px}
.wlead .wl-ic{width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:var(--grad-soft);border:1px solid var(--stroke-2);flex:none}
.wlead .wl-ic .svi{width:21px;height:21px}
.wlead h3{margin:0;font-size:14.5px;font-weight:640}
.wlead p{margin:2px 0 0;font-size:12px;color:var(--text-2);line-height:1.45}
.wtiles{display:grid;grid-template-columns:repeat(2,1fr);gap:11px}
.wtile{text-align:left;background:var(--surface-2);border:1px solid var(--stroke);border-radius:11px;padding:14px;display:flex;gap:11px;align-items:flex-start;transition:border-color .15s,background .15s,transform .12s}
.wtile.act{cursor:pointer}
.wtile.act:hover{border-color:var(--accent);background:var(--grad-soft);transform:translateY(-1px)}
.wtile .wt-ic{width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:var(--bg);border:1px solid var(--stroke-2);flex:none}
.wtile .wt-ic .svi{width:18px;height:18px}
.wtile h4{margin:0 0 3px;font-size:12.5px;font-weight:620;display:flex;align-items:center;gap:7px}
.wtile p{margin:0;font-size:11px;color:var(--text-2);line-height:1.5}
.wtile .wt-cta{margin-top:7px;font-size:10.5px;font-weight:600;color:var(--accent);display:flex;align-items:center;gap:4px;opacity:0;transition:opacity .15s}
.wtile.act:hover .wt-cta{opacity:1}
@media (max-width:640px){.wtiles{grid-template-columns:1fr}}
.svcbar{display:flex;gap:6px;background:var(--surface-2);border:1px solid var(--stroke);border-radius:12px;padding:5px;margin-bottom:14px}
.seg{flex:1;display:flex;align-items:center;justify-content:center;gap:7px;padding:9px 8px;border-radius:9px;background:transparent;border:1px solid transparent;color:var(--text-2);font-size:12px;font-weight:560;cursor:pointer;transition:.13s}
.seg:hover{background:var(--bg);color:var(--text)}
.seg.act{background:var(--grad-soft);border-color:var(--accent);color:var(--text);box-shadow:var(--glow)}
.seg .svi{width:16px;height:16px;flex:none}
.segl{white-space:nowrap}
.segn{min-width:19px;padding:0 5px;height:18px;line-height:17px;text-align:center;border-radius:9px;background:var(--bg);border:1px solid var(--stroke-2);font-size:10.5px;font-weight:660;color:var(--text-2)}
.seg.act .segn{background:var(--accent);color:var(--on-accent);border-color:transparent}
@media (max-width:600px){.segl{display:none}}
.svc-sub{display:flex;align-items:center;gap:12px;margin:-4px 0 14px;padding-bottom:12px;border-bottom:1px solid var(--stroke)}
.backlink{background:transparent;border:1px solid var(--stroke-2);border-radius:8px;padding:5px 11px;color:var(--accent);font-size:12px;font-weight:560;cursor:pointer}
.backlink:hover{background:var(--surface-2);border-color:var(--accent)}
.svc-cur{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:620}
.svc-cur .svi{width:16px;height:16px}
.blobnav{margin:16px 0 18px}
.blobtab-back{display:inline-flex;align-items:center;gap:5px;background:var(--surface-2);border:1px solid var(--stroke-2);color:var(--text-2);font-size:11.5px;font-weight:600;cursor:pointer;padding:6px 12px;border-radius:8px;margin-bottom:10px}
.blobtab-back:hover{color:var(--text);border-color:var(--accent);background:var(--surface-3)}
.blobtabgroup{display:flex;gap:5px;padding:5px;background:var(--surface-2);border:1px solid var(--stroke);border-radius:13px;box-shadow:inset 0 1px 0 rgba(255,255,255,.02)}
.blobtab{flex:1;position:relative;display:inline-flex;align-items:center;justify-content:center;gap:9px;background:transparent;border:0;padding:12px 10px;color:var(--text-2);font-size:13.5px;font-weight:600;cursor:pointer;border-radius:9px;transition:background .15s,color .15s,box-shadow .15s}
.blobtab:hover{background:var(--surface-3);color:var(--text)}
.blobtab.active{background:linear-gradient(180deg,#4aa2f7,#3d87dd);color:#fff;box-shadow:0 2px 9px rgba(61,135,221,.4)}
.blobtab .tbi{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:8px;background:rgba(255,255,255,.05);flex:none}
.blobtab.active .tbi{background:rgba(255,255,255,.18)}
.xdestmode{margin:6px auto 9px;display:flex;width:fit-content;max-width:100%;flex:none;justify-content:flex-start;padding:0;border:1px solid var(--stroke-2);border-radius:8px;overflow:hidden}
.xdestpick{display:flex;align-items:center;gap:8px}
.xdestpick select{flex:1;min-width:0}
.xdestslash{color:var(--text-3);font-weight:700;flex:none}
.xferbar{padding:16px 18px}
.xflow{display:grid;grid-template-columns:1fr 44px 1.25fr;gap:12px;align-items:end}
.xcol{display:flex;flex-direction:column;gap:7px;min-width:0}
.xlbl{font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text-3)}
.xlbl-row{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:24px}
.xcol .xdestmode{margin:0}
.seg-sm label{padding:3px 11px;font-size:10.5px;font-weight:600}
.xarrow{align-self:end;width:34px;height:34px;margin:0 auto 3px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--accent);background:var(--accent-soft);border:1px solid rgba(71,158,245,.32);box-shadow:0 2px 8px rgba(71,158,245,.18)}
.xfoot{display:flex;align-items:center;gap:14px;margin-top:15px;padding-top:14px;border-top:1px solid var(--stroke);flex-wrap:wrap}
.xfoot .grow{flex:1;min-width:8px}
.xconf{display:flex;align-items:center;gap:11px;min-width:0}
.xconf .xlbl{white-space:nowrap}
.xres-seg{flex:none}
.xres-seg label{padding:6px 13px}
.xfoot .check{white-space:nowrap;color:var(--text-2);font-size:12px}
.xfoot button.primary{padding:8px 16px;font-size:12.5px}
.selx{position:relative;min-width:0}
.selx-native{position:absolute!important;width:1px;height:1px;padding:0;margin:0;opacity:0;pointer-events:none;overflow:hidden;clip:rect(0 0 0 0)}
.selx-btn{width:100%;box-sizing:border-box;display:flex;align-items:center;gap:8px;padding:9px 12px;background:var(--surface-2);border:1px solid var(--stroke-2);border-radius:9px;color:var(--text);font-size:13px;cursor:pointer;transition:border-color .14s,box-shadow .14s,background .14s;text-align:left}
.selx-btn:hover{border-color:var(--accent);background:var(--surface-3)}
.selx-btn:disabled{opacity:.55;cursor:not-allowed}
.selx.open .selx-btn{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft);background:var(--surface-3)}
.selx-txt{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.selx-car{flex:none;color:var(--text-3);transition:transform .18s,color .18s}
.selx.open .selx-car{transform:rotate(180deg);color:var(--accent)}
.selx-pop{position:fixed;z-index:9999;background:var(--surface-2);border:1px solid var(--stroke-2);border-radius:12px;padding:5px;box-shadow:0 18px 48px rgba(0,0,0,.55),0 3px 10px rgba(0,0,0,.4);max-height:260px;overflow-y:auto;opacity:0;transform:translateY(-6px) scale(.98);pointer-events:none;transition:opacity .15s,transform .15s}
.selx-pop.show{opacity:1;transform:none;pointer-events:auto}
.selx-item{display:flex;align-items:center;gap:9px;padding:9px 10px;border-radius:8px;font-size:13px;color:var(--text-2);cursor:pointer;transition:background .1s,color .1s}
.selx-item:hover{background:var(--grad-soft);color:var(--text)}
.selx-item.on{color:var(--text);font-weight:600;background:var(--accent-soft)}
.selx-item>svg{flex:none;opacity:0;color:var(--accent)}
.selx-item.on>svg{opacity:1}
.selx-item>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.selx-pop::-webkit-scrollbar{width:10px}
.selx-pop::-webkit-scrollbar-thumb{background:var(--stroke-2);border-radius:6px;border:2px solid var(--surface-2)}
.xdestpick .selx{flex:1;min-width:0}
.confseg{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}
.conf-opt{position:relative;display:flex;align-items:center;justify-content:center;gap:9px;padding:10px 12px;border:1px solid var(--stroke-2);border-radius:11px;background:var(--surface-2);cursor:pointer;transition:border-color .15s,background .15s,box-shadow .15s}
.conf-opt:hover{border-color:var(--stroke-2);background:var(--surface-3)}
.conf-opt input{position:absolute;opacity:0;pointer-events:none}
.conf-ic{width:30px;height:30px;flex:none;border-radius:8px;display:flex;align-items:center;justify-content:center;background:var(--surface-3);color:var(--text-3);transition:.15s}
.conf-t{font-size:12.5px;font-weight:600;color:var(--text-2);transition:color .15s;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.conf-opt:has(input:checked) .conf-t{color:var(--text)}
.conf-opt:has(input:checked){border-color:var(--accent);background:var(--accent-soft);box-shadow:inset 0 0 0 1px var(--accent)}
.conf-opt:has(input:checked) .conf-ic{background:var(--accent);color:#fff;box-shadow:0 2px 7px rgba(71,158,245,.35)}
.blobtab .svi{width:16px;height:16px;flex:none}
.hubpanel{margin-top:12px}
.hubshare{padding:8px 2px;display:flex;flex-direction:column;align-items:center;text-align:center}
.hubshare .hs-lead{color:var(--text-2);font-size:12.5px;margin:0 auto 16px;line-height:1.6;max-width:660px}
.svc-desc{display:flex;align-items:center;gap:8px;color:var(--text-2);font-size:11.5px}
.svc-desc .svi{width:15px;height:15px;flex:none}
.svc-item .fname{display:flex;align-items:center;gap:8px}
.svc-item .fname .svi{width:15px;height:15px;flex:none}
.imeta{color:var(--text-3);font-size:11px;margin-right:8px}
.dlsaved{display:flex;flex-direction:column;align-items:stretch;gap:10px;margin-top:12px;padding:13px 14px;border:1px solid rgba(64,190,120,.4);background:linear-gradient(180deg,rgba(52,150,95,.14),rgba(40,120,80,.08));border-radius:12px}
.dlsaved .dls-top{display:flex;align-items:center;gap:10px}
.dlsaved .dls-ic{width:30px;height:30px;flex:none;display:flex;align-items:center;justify-content:center;border-radius:8px;background:rgba(64,190,120,.18);font-size:16px}
.dlsaved .dls-lead{font-size:13px;font-weight:640;color:var(--text);line-height:1.25}
.dlsaved .dls-path{display:block;font-size:11.5px;color:var(--text-2);background:var(--bg);border:1px solid var(--stroke-2);border-radius:8px;padding:7px 10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
.dlsaved .dls-acts{display:flex;gap:8px}
.dlsaved .dls-acts .primary{flex:1;justify-content:center}
.dlsaved .dls-acts .ghost{flex:none}
.xfer{position:fixed;right:18px;bottom:18px;width:372px;max-width:calc(100vw - 36px);z-index:120;background:var(--surface);border:1px solid var(--stroke);border-radius:14px;padding:14px 15px;box-shadow:0 12px 40px rgba(0,0,0,.5);animation:xfup .18s ease}
@keyframes xfup{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.xf-head{display:flex;align-items:center;gap:8px;margin-bottom:10px}
.xf-title{font-size:12.5px;font-weight:640;display:flex;align-items:center;gap:7px;flex:1}
.xf-x{background:transparent;border:0;color:var(--text-3);cursor:pointer;font-size:13px;line-height:1;padding:3px 6px;border-radius:6px}
.xf-x:hover{background:var(--surface-2);color:var(--text)}
.xf-bar{height:7px;border-radius:999px;background:var(--surface-2);overflow:hidden}
.xf-bar i{display:block;height:100%;background:var(--grad);border-radius:999px;transition:width .25s}
.xf-meta{display:flex;align-items:center;gap:8px;margin-top:8px;font-size:11px;color:var(--text-2)}
.xf-fails{margin-top:10px;display:flex;flex-direction:column;gap:5px;max-height:130px;overflow:auto}
.xf-fail{font-size:11px;background:rgba(200,70,70,.1);border:1px solid rgba(200,70,70,.28);border-radius:8px;padding:6px 8px}
.xf-fail b{display:block;color:var(--text);word-break:break-all}
.xf-fail span{color:var(--text-3)}
.xfer .dlsaved{margin-top:11px}
.entgrid{display:grid;grid-template-columns:1fr 1fr;gap:11px;margin-bottom:14px}
.entfield{display:flex;flex-direction:column;gap:5px}
.entfield span{font-size:11px;color:var(--text-2);font-weight:600}
.entfield input{background:var(--surface);border:1px solid var(--stroke-2);border-radius:9px;padding:8px 11px;color:var(--text);font-size:12.5px;outline:none}
.entfield input:focus{border-color:var(--accent);box-shadow:var(--glow)}
.entfield input[readonly]{opacity:.7;cursor:not-allowed}
.entprops-head{display:flex;align-items:center;justify-content:space-between;margin:4px 0 8px}
.entprops-head span{font-size:11px;color:var(--text-2);font-weight:600;text-transform:uppercase;letter-spacing:.4px}
#entProps{display:flex;flex-direction:column;gap:8px;max-height:240px;overflow:auto}
.entrow{display:grid;grid-template-columns:1fr 108px 1.3fr 30px;gap:7px;align-items:center}
.entrow input,.entrow select{background:var(--surface);border:1px solid var(--stroke-2);border-radius:8px;padding:7px 9px;color:var(--text);font-size:12px;outline:none;min-width:0}
.entrow input:focus,.entrow select:focus{border-color:var(--accent);box-shadow:var(--glow)}
.entrow .epx{padding:5px 0;text-align:center}
.dlg-err{color:#f1a3aa;font-size:11.5px}
.sgfield{margin-bottom:16px}
.sgfield .sglabel{display:block;font-size:11px;color:var(--text-2);font-weight:600;text-transform:uppercase;letter-spacing:.4px;margin-bottom:9px}
.sgperms{display:grid;grid-template-columns:repeat(auto-fit,minmax(118px,1fr));gap:9px}
.sgperm{display:flex;flex-direction:column;gap:2px;position:relative;padding:11px 12px 11px 34px;border:1px solid var(--stroke-2);border-radius:10px;cursor:pointer;transition:.13s;background:var(--surface-2)}
.sgperm:hover{border-color:var(--accent)}
.sgperm input{position:absolute;left:12px;top:13px;width:15px;height:15px;accent-color:var(--accent)}
.sgperm .sgpttl{font-size:12.5px;font-weight:620;color:var(--text)}
.sgperm .sgpdesc{font-size:10.5px;color:var(--text-3)}
.sgperm:has(input:checked){border-color:var(--accent);background:rgba(71,158,245,.1)}
.sgexp{display:flex;gap:8px;flex-wrap:wrap}
.sgchip{font-size:12px;font-weight:600;padding:7px 14px;border-radius:999px;border:1px solid var(--stroke-2);background:var(--surface-2);color:var(--text-2);cursor:pointer;transition:.13s}
.sgchip:hover{border-color:var(--accent);color:var(--text)}
.sgchip.active{background:var(--grad);border-color:transparent;color:#fff}
.sgresult{margin-top:4px;padding:13px 14px;border:1px solid rgba(64,190,120,.4);background:linear-gradient(180deg,rgba(52,150,95,.14),rgba(40,120,80,.07));border-radius:12px}
.sgresult .sgok{font-size:12px;font-weight:600;color:var(--ok);margin-bottom:9px;display:flex;align-items:center;gap:7px;flex-wrap:wrap}
.sgresult .sgbadge{font-size:10px;font-weight:700;color:var(--text-2);background:var(--surface-2);border:1px solid var(--stroke-2);border-radius:999px;padding:2px 9px;text-transform:none;letter-spacing:0}
.sgurl{width:100%;box-sizing:border-box;background:var(--bg);border:1px solid var(--stroke-2);border-radius:9px;padding:9px 11px;color:var(--text);font:11.5px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;outline:none;resize:vertical;min-height:56px;word-break:break-all}
.footer-meta{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:22px auto 0;padding:12px 2px 4px;border-top:1px solid var(--stroke);font-size:11.5px;color:var(--text-3)}
.build-stamp{display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.01em}
.build-stamp .bs-rev{color:var(--text-2);opacity:.85}
.feedback-link{display:inline-flex;align-items:center;gap:6px;color:var(--accent);text-decoration:none;font-weight:600;font-family:inherit;border-radius:6px;padding:3px 6px}
.feedback-link:hover{text-decoration:underline}
.feedback-link:focus-visible{outline:2px solid var(--color-focus-outline,var(--accent));outline-offset:2px}
`,BODY=`
<div class="appbar">
  <div class="logo"><svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="azlogo" x1="5" y1="3" x2="27" y2="29" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#50e6ff"/><stop offset=".5" stop-color="#1b9de2"/><stop offset="1" stop-color="#005ba1"/></linearGradient></defs><rect x="1.5" y="1.5" width="29" height="29" rx="7.5" fill="url(#azlogo)"/><path d="M8.4 9.8v12.4c0 1.49 3.4 2.7 7.6 2.7s7.6-1.21 7.6-2.7V9.8Z" fill="#fff" opacity=".95"/><ellipse cx="16" cy="9.8" rx="7.6" ry="2.7" fill="#fff"/><path d="M8.4 15.8c0 1.49 3.4 2.7 7.6 2.7s7.6-1.21 7.6-2.7" fill="none" stroke="#0078d4" stroke-width="1.1" opacity=".55"/><path d="M8.4 20c0 1.49 3.4 2.7 7.6 2.7s7.6-1.21 7.6-2.7" fill="none" stroke="#0078d4" stroke-width="1.1" opacity=".4"/></svg></div>
  <h1>Azure Storage</h1>
  <div class="ctx" id="ctxBar"></div>
  <div class="spacer"></div>
  <span class="chip" id="statusChip">starting\u2026</span>
</div>
<div id="err"></div>
<div class="shell" id="shell">
  <aside class="side" id="side">
    <div class="side-head">
      <span class="t">Storage Explorer</span>
      <button class="iconbtn" id="refreshBtn" title="Refresh subscriptions" style="margin-left:auto"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M13.2 8a5.2 5.2 0 1 1-1.5-3.7"/><path d="M13.6 2.6v3.1h-3.1"/></svg></button>
      <button class="iconbtn" id="sideToggle" title="Collapse panel"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3.5 3.5 8 8 12.5"/><path d="M13 3.5 8.5 8 13 12.5"/></svg></button>
    </div>
    <div class="side-rail" id="sideRail"></div>
    <div class="side-tools">
      <div class="scopebar">
        <div class="scopechip" id="scopeChip"><span class="k">\u{1F511}</span><span id="scopeLabel">Select subscriptions</span></div>
        <button id="scopeChange" class="scopebtn">Change \u25BE</button>
      </div>
      <div class="search" style="margin-top:9px"><span class="mag"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="6.8" cy="6.8" r="4.3"/><path d="M13 13 9.9 9.9"/></svg></span><input id="treeSearch" placeholder="Search accounts\u2026"></div>
    </div>
    <div class="side-body">
      <div id="tree" class="tree"></div>
    </div>
  </aside>
  <main class="main">
    <div class="mainwrap">
      <div id="crumb" class="crumb"></div>

      <div class="card" data-card="ask">
        <div class="card-head"><h2><span class="hicon g-ask"><svg viewBox="0 0 24 24" width="15" height="15" fill="#fff" aria-hidden="true"><path d="M12 2l1.7 4.8L18.5 8.5 13.7 10.2 12 15l-1.7-4.8L5.5 8.5l4.8-1.7z"/><path d="M18.5 13l.95 2.6 2.55.9-2.55.9-.95 2.6-.95-2.6-2.55-.9 2.55-.9z"/></svg></span> Ask about your storage</h2><span class="cw">\u25BE</span></div>
        <div class="card-body">
          <div class="askrow">
            <div class="askbar">
              <span class="ask-mag"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M12 2l1.7 4.8L18.5 8.5 13.7 10.2 12 15l-1.7-4.8L5.5 8.5l4.8-1.7z"/><path d="M18.5 13l.95 2.6 2.55.9-2.55.9-.95 2.6-.95-2.6-2.55-.9 2.55-.9z"/></svg></span>
              <input id="askIn" placeholder="What is taking up the most space?">
            </div>
            <button class="primary askgo" id="askBtn"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M12 2l1.5 4.3L18 7.8l-4.5 1.5L12 13.6l-1.5-4.3L6 7.8l4.5-1.5z"/></svg> Ask</button>
          </div>
          <div id="askChips" class="askchips"></div>
          <div id="askOut" class="askout"></div>
        </div>
      </div>

      <div class="card" data-card="data" id="dataCard">
        <div class="card-head"><h2><span class="dti" id="dataTitleIc"></span> <span id="dataTitleTxt">Storage data</span> <span class="badge" id="dataCount"></span></h2><span class="cw">\u25BE</span></div>
        <div class="card-body"><div id="svcBar"></div><div id="dataBody"></div><div id="hubFilter" class="hubpanel" style="display:none"></div><div id="hubShare" class="hubpanel" style="display:none"></div></div>
      </div>

      <div id="xfer" class="xfer" style="display:none"></div>

      <div class="card" data-card="stats">
        <div class="card-head"><h2><span class="hicon"><svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><rect x="3" y="12" width="4.2" height="8" rx="1.3" fill="#fff"/><rect x="9.9" y="7" width="4.2" height="13" rx="1.3" fill="#fff"/><rect x="16.8" y="3" width="4.2" height="17" rx="1.3" fill="#fff"/></svg></span> Filter &amp; statistics</h2><span class="scopechip off" id="statsScope">No container selected</span><span class="cw">\u25BE</span></div>
        <div class="card-body">
          <div class="filterbar">
          <div class="fgrid">
            <div class="field"><label>Name pattern</label><input id="fName" placeholder="e.g. logs/*.json"></div>
            <div class="field"><label>Min size (bytes)</label><input id="fMin" type="number" placeholder="any"></div>
            <div class="field"><label>Max size (bytes)</label><input id="fMax" type="number" placeholder="any"></div>
            <div class="field"><label>Older than (days)</label><input id="fOlder" type="number" placeholder="any"></div>
            <div class="field"><label>Newer than (days)</label><input id="fNewer" type="number" placeholder="any"></div>
            <div class="field"><label>Content type</label>
              <select id="fType"><option value="all">any type</option><option>image</option><option>video</option><option>audio</option><option>text/data</option><option>document</option><option>archive</option><option>binary</option></select>
            </div>
            <div class="field"><label>Access tier</label>
              <select id="fTier"><option value="">any tier</option><option>Hot</option><option>Cool</option><option>Cold</option><option>Archive</option></select>
            </div>
            <div class="field"><label>Blob type</label>
              <select id="fBlobType"><option value="">any blob type</option><option>BlockBlob</option><option>PageBlob</option><option>AppendBlob</option></select>
            </div>
            <div class="field"><label>Tag</label><input id="fTag" placeholder="key or key=value"></div>
          </div>
          <div class="factions">
            <button class="primary" id="filterBtn"><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M4 5h16l-6 7v6l-4 2v-8L4 5z" fill="currentColor"/></svg> Filter</button>
            <button class="ghost" id="dlFilteredBtn"><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M12 3v10m0 0l-4-4m4 4l4-4M5 19h14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg> Download matched</button>
            <button class="ghost" id="archiveFilteredBtn" title="Move the matched blobs to the Archive tier to cut cost (reversible)"><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M3 5h18v4H3V5zm2 6h14v8H5v-8zm4 2v2h6v-2H9z" fill="currentColor"/></svg> Clean up (Archive)</button>
            <button class="ghost danger-ghost" id="deleteFilteredBtn" title="Permanently delete the matched blobs"><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M6 7h12l-1 13H7L6 7zm3-3h6l1 2H8l1-2z" fill="currentColor"/></svg> Delete matched</button>
            <span class="grow"></span>
            <button class="accent" id="insightBtn" title="Ask Copilot to interpret these statistics"><span class="cpdot"></span> Explain these statistics</button>
          </div>
          </div>
          <div id="stats"></div>
          <div id="insight"></div>
        </div>
      </div>


      <div class="card" data-card="sas">
        <div class="card-head"><h2><span class="hicon g-sas"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.5 14.5l5-5"/><path d="M8 12l-2 2a3 3 0 0 0 4.2 4.2l2-2"/><path d="M16 12l2-2a3 3 0 0 0-4.2-4.2l-2 2"/></svg></span> Instant SAS</h2> <span class="cw">\u25BE</span></div>
        <div class="card-body">
          <div class="filterbar">
            <div class="field"><label>Container SAS URL</label>
              <div class="sasrow">
                <input id="sasIn" placeholder="https://account.blob.core.windows.net/container?sv=\u2026&amp;sig=\u2026">
                <button class="primary" id="sasBtn"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg> Connect</button>
              </div>
            </div>
            <div class="fbhint">Paste a container SAS URL for an Explorer-style read view: list, filter, inspect sizes/tiers and download, all from the SAS alone. No Azure sign-in required.</div>
          </div>
          <div id="sas" style="margin-top:12px"></div>
        </div>
      </div>

      <div class="card" data-card="transfer">
        <div class="card-head"><h2><span class="hicon g-xfer"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h13l-3-3"/><path d="M20 16H7l3 3"/></svg></span> Transfer planning</h2> <span class="cw">\u25BE</span></div>
        <div class="card-body">
          <p class="card-sub">Preview an AzCopy copy from the open container to another container or SAS URL: see new vs. conflicting files, choose how conflicts resolve, and get the exact <b>azcopy</b> command. Nothing moves until you run it yourself.</p>
          <div class="filterbar">
            <div class="field"><label>Source container</label><select id="xsrcsel"></select><div id="xsrc" class="xsrc"></div></div>
            <div class="field" style="margin-top:10px"><label>Destination</label>
              <div class="seg xdestmode"><label><input type="radio" name="xdestmode" value="pick" checked> Pick a container</label><label><input type="radio" name="xdestmode" value="paste"> Paste path / SAS URL</label></div>
              <div id="xdestpick" class="xdestpick"><select id="xdestAcct" title="Destination account"></select><span class="xdestslash">/</span><select id="xdestCont" title="Destination container"></select></div>
              <div id="xdestpaste" style="display:none"><input id="xdest" placeholder="account/container   or a container SAS URL"></div>
            </div>
            <div class="field" style="margin-top:10px"><label>When a file already exists at the destination</label>
              <div class="confseg">
                <label class="conf-opt" data-c="ow"><input type="radio" name="xres" value="overwrite" checked><span class="conf-ic"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 1 1 2.3 5.6M4 12V7m0 5h5"/></svg></span><span class="conf-t">Overwrite</span></label>
                <label class="conf-opt" data-c="skip"><input type="radio" name="xres" value="skip"><span class="conf-ic"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg></span><span class="conf-t">Skip existing</span></label>
                <label class="conf-opt" data-c="new"><input type="radio" name="xres" value="if-newer"><span class="conf-ic"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg></span><span class="conf-t">If source newer</span></label>
              </div>
            </div>
            <div class="factions">
              <button class="primary" id="xplanBtn"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h10"/></svg> Plan transfer</button>
              <span class="grow"></span>
              <label class="check"><input type="checkbox" id="xfiltered"> Only the filtered set</label>
            </div>
          </div>
          <div id="transfer" style="margin-top:12px"></div>
        </div>
      </div>

      <div class="card" data-card="log">
        <div class="card-head"><h2><span class="hicon g-log"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12h3.5l2.2-6 3.6 12 2.2-6H21"/></svg></span> Activity log</h2><span class="badge" id="logCount">0 entries</span><span class="cw">\u25BE</span></div>
        <div class="card-body"><div id="log" class="log"></div></div>
      </div>
      <!--FOOTER-->
    </div>
  </main>
</div>

<div class="overlay" id="pickerOverlay">
  <div class="dialog">
    <div class="dlg-head">
      <div>
        <h3>Select subscriptions</h3>
        <p class="dlg-sub">Choose one or more subscriptions. Storage accounts load from your selection.</p>
      </div>
      <button class="iconbtn" id="pickClose" title="Close">\u2715</button>
    </div>
    <div class="dlg-search"><span class="mag"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="6.8" cy="6.8" r="4.3"/><path d="M13 13 9.9 9.9"/></svg></span><input id="pickSearch" placeholder="Search by name or ID\u2026"></div>
    <div class="dlg-meta"><span id="pickCount" class="muted"></span><button id="pickClear" class="linkbtn">Clear selection</button></div>
    <div class="dlg-list" id="pickList"></div>
    <div class="dlg-foot">
      <span id="pickSelected" class="muted">0 selected</span>
      <div class="flex" style="gap:8px">
        <button id="pickCancel">Cancel</button>
        <button id="pickApply" class="primary">Apply</button>
      </div>
    </div>
  </div>
</div>

<div class="overlay" id="confirmOverlay">
  <div class="dialog" style="width:min(440px,92vw)">
    <div class="dlg-head"><div><h3 id="cfTitle">Confirm</h3><p class="dlg-sub" id="cfMsg"></p></div></div>
    <div id="cfInputWrap" style="display:none;padding:6px 20px 0"><textarea id="cfInput" rows="1" style="width:100%;background:var(--surface);border:1px solid var(--stroke-2);border-radius:10px;padding:9px 12px;color:var(--text);font:13px/1.5 ui-monospace,monospace;outline:none;resize:vertical"></textarea></div>
    <div class="dlg-foot"><span></span><div class="flex" style="gap:8px"><button id="cfCancel">Cancel</button><button id="cfOk" class="primary">OK</button></div></div>
  </div>
</div>

<div class="overlay" id="entityOverlay">
  <div class="dialog" style="width:min(580px,94vw)">
    <div class="dlg-head"><div><h3 id="entTitle">Add entity</h3><p class="dlg-sub">PartitionKey and RowKey identify the entity. Add any number of typed properties.</p></div><button class="iconbtn" id="entClose" title="Close">\u2715</button></div>
    <div style="padding:6px 20px 0">
      <div class="entgrid">
        <label class="entfield"><span>PartitionKey</span><input id="entPK" placeholder="e.g. orders"></label>
        <label class="entfield"><span>RowKey</span><input id="entRK" placeholder="e.g. 1001"></label>
      </div>
      <div class="entprops-head"><span>Properties</span><button class="linkbtn" id="entAddProp">\uFF0B Add property</button></div>
      <div id="entProps"></div>
    </div>
    <div class="dlg-foot"><span id="entErr" class="dlg-err"></span><div class="flex" style="gap:8px"><button id="entCancel">Cancel</button><button id="entSave" class="primary">Save entity</button></div></div>
  </div>
</div>

<div class="overlay" id="sasOverlay">
  <div class="dialog" style="width:min(600px,94vw)">
    <div class="dlg-head"><div><h3 id="sgTitle">\u{1F517} Create SAS link</h3><p class="dlg-sub" id="sgSub">A secure, time-limited URL. No Azure login needed to use it.</p></div><button class="iconbtn" id="sgClose" title="Close">\u2715</button></div>
    <div style="padding:8px 20px 0">
      <div class="sgfield"><span class="sglabel">What can the link do?</span>
        <div class="sgperms">
          <label class="sgperm"><input type="checkbox" id="sgpR" checked><span class="sgpttl">\u{1F441} Read</span><span class="sgpdesc">view &amp; download</span></label>
          <label class="sgperm" id="sgpLwrap" style="display:none"><input type="checkbox" id="sgpL"><span class="sgpttl">\u{1F4CB} List</span><span class="sgpdesc">browse contents</span></label>
          <label class="sgperm"><input type="checkbox" id="sgpW"><span class="sgpttl">\u270F Write</span><span class="sgpdesc">upload / overwrite</span></label>
          <label class="sgperm"><input type="checkbox" id="sgpD"><span class="sgpttl">\u{1F5D1} Delete</span><span class="sgpdesc">remove content</span></label>
        </div>
      </div>
      <div class="sgfield"><span class="sglabel">Expires in</span>
        <div class="sgexp">
          <button type="button" class="sgchip" data-min="60">1 hour</button>
          <button type="button" class="sgchip active" data-min="1440">24 hours</button>
          <button type="button" class="sgchip" data-min="10080">7 days</button>
          <button type="button" class="sgchip" data-min="43200">30 days</button>
        </div>
      </div>
      <div id="sgResult" class="sgresult" style="display:none"></div>
    </div>
    <div class="dlg-foot"><span id="sgErr" class="dlg-err"></span><div class="flex" style="gap:8px"><button id="sgCancel">Close</button><button id="sgGo" class="primary">Generate link</button></div></div>
  </div>
</div>
`,CLIENT=`
const $=function(id){return document.getElementById(id)};
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function mdInline(s){
  var t=esc(s==null?'':s);
  var p=t.split('**');
  if(p.length>2&&p.length%2===1){var o='';for(var i=0;i<p.length;i++)o+=(i%2===1?'<strong>'+p[i]+'</strong>':p[i]);t=o}
  var bt=String.fromCharCode(96);
  var c=t.split(bt);
  if(c.length>2&&c.length%2===1){var o2='';for(var j=0;j<c.length;j++)o2+=(j%2===1?'<code>'+c[j]+'</code>':c[j]);t=o2}
  return t;
}
function fmtBytes(n){n=Number(n)||0;if(n<1024)return n+' B';var u=['KB','MB','GB','TB','PB'],i=-1;do{n/=1024;i++}while(n>=1024&&i<u.length-1);return n.toFixed(n>=10?0:1)+' '+u[i]}
var bridge={send:function(route,payload){return fetch(route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload||{})}).then(function(r){return r.json()}).catch(function(){return{ok:false}})}};
var state={};var selected=new Set();
var openSubs={};
var openAccts={};
var openCat={};
var treeQuery='';
function ascLoad(k){try{return JSON.parse(localStorage.getItem(k)||'null')||{}}catch(e){return{}}}
var pinnedAccts=ascLoad('asc_pinned');
var hiddenAccts=ascLoad('asc_hidden');
var showHidden=false;
function saveAcctPrefs(){try{localStorage.setItem('asc_pinned',JSON.stringify(pinnedAccts));localStorage.setItem('asc_hidden',JSON.stringify(hiddenAccts))}catch(e){}try{bridge.send('/save-prefs',{pinned:pinnedAccts,hidden:hiddenAccts})}catch(e){}}
var activeSvc=null;var svcListMode=false;var lastAcct='';var lastItemKey='';var lastPrevName='';
var blobTab='browse';
var xSourceCont='';
var xDestMode='pick';var xDestAcct='';var xDestCont='';var xDestReq={};
var pickOpen=false;var pickSel=new Set();var pickQuery='';
var sasFilterText='';var sasSort='name';

var es=new EventSource('/events');
es.onmessage=function(ev){try{state=JSON.parse(ev.data)}catch(e){return}render()};
(function(){bridge.send('/get-prefs',{}).then(function(r){if(r&&r.ok&&r.prefs){if(r.prefs.pinned)pinnedAccts=r.prefs.pinned;if(r.prefs.hidden)hiddenAccts=r.prefs.hidden;try{localStorage.setItem('asc_pinned',JSON.stringify(pinnedAccts));localStorage.setItem('asc_hidden',JSON.stringify(hiddenAccts))}catch(e){}if(typeof renderTree==='function')renderTree()}})})();

var lastStatCont='';
function render(){renderCtx();renderError();renderStatus();renderSeBtn();renderScope();renderTree();renderCrumb();renderData();renderBatch();resetFilterOnSwitch();renderStatsScope();renderStats();renderInsight();renderSas();renderTransferSrc();renderXDest();renderTransfer();renderAskChips();renderAsk();renderLog();if(pickOpen)renderPicker()}
function renderCtx(){
  var el=$('ctxBar');if(!el)return;
  if(!state.s_account){el.className='ctx';el.innerHTML='<span class="ctx-none">No storage account open</span>';return}
  var svc=activeSvc||'blob';
  var showItem=state.s_item&&state.s_kind===svc&&!svcListMode;
  var kindName={blob:'Container',file:'File share',queue:'Queue',table:'Table'}[svc]||'Item';
  var svcName={blob:'Blob containers',file:'File shares',queue:'Queues',table:'Tables'}[svc]||'Data';
  var sep='<span class="cx-sep">\u203A</span>';
  var sideEl=$('side');var collapsed=sideEl&&sideEl.classList.contains('collapsed');
  var h='';
  if(collapsed){
    var acct=(state.s_accounts||[]).filter(function(x){return x.name===state.s_account})[0]||{};
    var sub=acct.subscriptionName||'';
    if(sub)h+='<span class="cx" title="Subscription"><span class="cx-i">'+svgIcon('sub')+'</span>'+esc(sub)+'</span>'+sep;
  }
  h+='<span class="cx strong" title="Storage account"><span class="cx-i">'+svgIcon('account')+'</span>'+esc(state.s_account)+'</span>';
  if(showItem){h+=sep+'<span class="cx strong" title="'+esc(kindName)+'"><span class="cx-i">'+svgIcon(svc)+'</span>'+esc(state.s_item)+'</span>'}
  else{h+=sep+'<span class="cx" title="Viewing '+esc(svcName)+'"><span class="cx-i">'+svgIcon(svc)+'</span>'+esc(svcName)+'</span>'}
  el.className='ctx on';el.innerHTML=h;
}
function renderTransferSrc(){
  var sel=$('xsrcsel'),banner=$('xsrc');var acct=state.s_account;
  var tree=(state.s_tree||{})[acct]||{};var conts=tree.containers||[];
  var names=conts.map(function(c){return c.name});
  if(sel){
    if(!acct){sel.innerHTML='<option value="">Open a storage account first</option>';sel.disabled=true}
    else if(!names.length){sel.innerHTML='<option value="">No containers in this account</option>';sel.disabled=true}
    else{
      if(!xSourceCont||names.indexOf(xSourceCont)<0){xSourceCont=(state.s_container&&names.indexOf(state.s_container)>=0)?state.s_container:names[0]}
      sel.disabled=false;
      sel.innerHTML=names.map(function(n){return '<option value="'+esc(n)+'"'+(n===xSourceCont?' selected':'')+'>'+esc(acct)+' / '+esc(n)+'</option>'}).join('');
      sel.value=xSourceCont;
    }
    sel.onchange=function(){xSourceCont=sel.value;renderTransferSrc()};
    selxEnhance(sel);
  }
  if(banner){
    if(!acct){banner.style.display='';banner.className='xsrc off';banner.innerHTML='<span class="xsrc-ic">'+CONTAINER_IC+'</span>Open a storage account in the Explorer to choose a source container.';return}
    if(!names.length){banner.style.display='';banner.className='xsrc off';banner.innerHTML='<span class="xsrc-ic">'+CONTAINER_IC+'</span>This account has no blob containers to transfer from.';return}
    banner.style.display='none';banner.innerHTML='';
  }
}
function renderXDest(){
  var mode=xDestMode;
  var pick=$('xdestpick'),paste=$('xdestpaste');
  if(pick)pick.style.display=mode==='pick'?'':'none';
  if(paste)paste.style.display=mode==='paste'?'':'none';
  Array.prototype.forEach.call(document.getElementsByName('xdestmode'),function(r){r.checked=(r.value===mode);r.onchange=function(){if(r.checked){xDestMode=r.value;renderXDest()}}});
  if(mode!=='pick')return;
  var accts=(state.s_accounts||[]).map(function(x){return x.name});
  var aSel=$('xdestAcct'),cSel=$('xdestCont');
  if(aSel){
    if(!accts.length){aSel.innerHTML='<option value="">No accounts loaded</option>';aSel.disabled=true}
    else{
      if(!xDestAcct||accts.indexOf(xDestAcct)<0){xDestAcct=state.s_account&&accts.indexOf(state.s_account)>=0?state.s_account:accts[0]}
      aSel.disabled=false;
      aSel.innerHTML=accts.map(function(n){return '<option value="'+esc(n)+'"'+(n===xDestAcct?' selected':'')+'>'+esc(n)+'</option>'}).join('');
      aSel.value=xDestAcct;
    }
    aSel.onchange=function(){xDestAcct=aSel.value;xDestCont='';renderXDest()};
    selxEnhance(aSel);
  }
  if(cSel){
    var tree=(state.s_tree||{})[xDestAcct]||{};var conts=tree.containers;
    if(!xDestAcct){cSel.innerHTML='<option value="">Select a container</option>';cSel.disabled=true}
    else if(conts==null){
      cSel.innerHTML='<option value="">loading\u2026</option>';cSel.disabled=true;
      if(!xDestReq[xDestAcct]){xDestReq[xDestAcct]=true;bridge.send('/tree-containers',{account:xDestAcct})}
    }
    else{
      var names=conts.map(function(c){return c.name}).filter(function(n){return !(xDestAcct===state.s_account&&n===xSourceCont)});
      if(!names.length){cSel.innerHTML='<option value="">No other containers here</option>';cSel.disabled=true;xDestCont=''}
      else{
        if(!xDestCont||names.indexOf(xDestCont)<0)xDestCont=names[0];
        cSel.disabled=false;
        cSel.innerHTML=names.map(function(n){return '<option value="'+esc(n)+'"'+(n===xDestCont?' selected':'')+'>'+esc(n)+'</option>'}).join('');
        cSel.value=xDestCont;
      }
    }
    cSel.onchange=function(){xDestCont=cSel.value};
    selxEnhance(cSel);
  }
}
var SELX_CARET='<svg class="selx-car" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
var SELX_CHECK='<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
var selxOpen=null;
function selxCloseAll(){if(selxOpen){selxOpen.host.classList.remove('open');selxOpen.pop.classList.remove('show');selxOpen=null}}
function selxPlace(w){
  var r=w.btn.getBoundingClientRect(),p=w.pop;
  p.style.width=r.width+'px';p.style.left=r.left+'px';p.style.top='';p.style.bottom='';
  var spaceBelow=window.innerHeight-r.bottom-8,needed=Math.min(p.scrollHeight,260);
  if(spaceBelow<needed&&r.top-8>spaceBelow){p.style.bottom=(window.innerHeight-r.top+6)+'px'}
  else{p.style.top=(r.bottom+6)+'px'}
}
function selxToggle(w){if(selxOpen===w){selxCloseAll();return}selxCloseAll();w.host.classList.add('open');w.pop.classList.add('show');selxOpen=w;selxPlace(w)}
function selxRefresh(sel){
  var w=sel.__selx;if(!w)return;
  var cur=sel.options[sel.selectedIndex];
  w.btn.disabled=sel.disabled;w.lbl.textContent=cur?cur.textContent:'';
  var html='';for(var i=0;i<sel.options.length;i++){var o=sel.options[i];html+='<div class="selx-item'+(o.selected?' on':'')+'" data-i="'+i+'">'+SELX_CHECK+'<span>'+esc(o.textContent)+'</span></div>'}
  w.pop.innerHTML=html;
  if(selxOpen===w)selxPlace(w);
}
function selxEnhance(sel){
  if(sel.__selx){selxRefresh(sel);return}
  var host=document.createElement('div');host.className='selx';
  sel.parentNode.insertBefore(host,sel);host.appendChild(sel);sel.classList.add('selx-native');
  var btn=document.createElement('button');btn.type='button';btn.className='selx-btn';
  var lbl=document.createElement('span');lbl.className='selx-txt';
  btn.appendChild(lbl);btn.insertAdjacentHTML('beforeend',SELX_CARET);host.appendChild(btn);
  var pop=document.createElement('div');pop.className='selx-pop';document.body.appendChild(pop);
  var w={host:host,btn:btn,lbl:lbl,pop:pop,sel:sel};sel.__selx=w;
  btn.onclick=function(e){e.stopPropagation();if(sel.disabled)return;selxToggle(w)};
  pop.onclick=function(e){var it=e.target.closest('.selx-item');if(!it)return;var i=+it.getAttribute('data-i');if(sel.selectedIndex!==i){sel.selectedIndex=i;sel.dispatchEvent(new Event('change'))}selxCloseAll()};
  selxRefresh(sel);
}
document.addEventListener('click',function(e){if(selxOpen&&selxOpen.pop.contains(e.target))return;selxCloseAll()});
window.addEventListener('resize',function(){if(selxOpen)selxPlace(selxOpen)});
window.addEventListener('scroll',function(e){if(!selxOpen)return;if(selxOpen.pop.contains(e.target))return;var r=selxOpen.btn.getBoundingClientRect();if(r.bottom<4||r.top>window.innerHeight-4){selxCloseAll();return}selxPlace(selxOpen)},true);
function renderStatsScope(){var el=$('statsScope');if(!el)return;if(containerOpen()){el.className='scopechip on';el.innerHTML='<span class="sc-dot"></span>'+esc(state.s_account)+' <span class="sc-sep">/</span> <b>'+esc(state.s_container)+'</b>'}else{el.className='scopechip off';el.textContent='No container selected'}}
function resetFilterOnSwitch(){var c=(state.s_kind==='blob'?state.s_container:'')||'';if(c===lastStatCont)return;lastStatCont=c;['fName','fMin','fMax','fOlder','fNewer','fTag'].forEach(function(id){var e=$(id);if(e)e.value=''});['fType','fTier','fBlobType'].forEach(function(id){var e=$(id);if(e)e.selectedIndex=0});}

function renderStatus(){
  var c=$('statusChip');if(!c)return;var a=state.s_accounts||[];
  if(state.s_loading&&!a.length){c.className='chip';c.innerHTML='<span class="spin"></span> loading\u2026';return}
  if(state.s_signingIn){c.className='chip';c.innerHTML='<span class="spin"></span> signing in\u2026';return}
  if(state.s_needsAuth){c.className='chip warn';c.textContent='not signed in';return}
  if(state.s_error){c.className='chip warn';c.textContent='error';return}
  if(a.length){c.className='chip';c.textContent=a.length+(a.length===1?' account':' accounts');return}
  c.className='chip';c.textContent='no accounts';
}
// The ASE hand-off is a quiet escape hatch, not a front door: muted/icon-only
// until a specific resource is open, then it emphasizes + labels itself because
// that is the moment a user might actually need bulk ops the canvas won't do.
function renderSeBtn(){
  var b=$('seOpenBtn');if(!b||b.disabled)return;
  var lbl=b.querySelector('.seopen-lbl');
  if(state.s_seInstalled===false){
    b.className='seopen on';
    if(lbl)lbl.textContent='Get Azure Storage Explorer';
    b.title='Azure Storage Explorer is not installed. Click to get the free desktop app.';
    return;
  }
  var itemOpen=!!(state.s_item&&state.s_kind&&!svcListMode);
  if(itemOpen){
    b.className='seopen on';
    if(lbl)lbl.textContent='Open in Azure Storage Explorer';
    b.title='Open '+state.s_item+' in the Azure Storage Explorer desktop app, for bulk upload, folders and full management.';
  }else{
    b.className='seopen';
    if(lbl)lbl.textContent='Open in Azure Storage Explorer';
    b.title=state.s_account?'Open this account in the Azure Storage Explorer desktop app':'Open the Azure Storage Explorer desktop app';
  }
}

// The official Azure Storage Explorer product mark, as an inline SVG at any size.
function aseIcon(sz){var s=sz||16;return '<svg viewBox="0 0 18 18" width="'+s+'" height="'+s+'" aria-hidden="true"><defs><linearGradient id="seIconGrad" x1="9.286" y1="7.103" x2="8.876" y2="19.415" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#e6e6e6"/><stop offset="1" stop-color="#b3b3b3"/></linearGradient></defs><path d="M16.218,6.589H11.293a.259.259,0,0,0-.259.259V9.829a.259.259,0,0,1-.259.259H6.406a.257.257,0,0,0-.257.257v3.043a.26.26,0,0,1-.26.259H1.521a.258.258,0,0,0-.258.257v3.581A.516.516,0,0,0,1.778,18h9.816a.233.233,0,0,0,.053-.006h4.571a.518.518,0,0,0,.519-.518V7.107A.518.518,0,0,0,16.218,6.589Z" fill="url(#seIconGrad)"/><rect x="11.851" y="14.495" width="4.068" height="2.711" rx="0.259" fill="#005ba1"/><rect x="11.851" y="10.936" width="4.068" height="2.711" rx="0.259" fill="#5ea0ef"/><rect x="11.851" y="7.377" width="4.068" height="2.711" rx="0.259" fill="#fff"/><rect x="6.966" y="14.5" width="4.068" height="2.711" rx="0.259" fill="#005ba1"/><rect x="6.966" y="10.942" width="4.068" height="2.711" rx="0.259" fill="#fff"/><rect x="2.081" y="14.5" width="4.068" height="2.711" rx="0.259" fill="#005ba1"/><rect x="6.097" y="3.396" width="4.834" height="3.221" rx="0.308" fill="#5ea0ef"/><rect x="1.263" y="6.76" width="4.834" height="3.221" rx="0.308" fill="#0078d4"/><rect x="1.263" width="4.834" height="3.221" rx="0.308" fill="#83b9f9"/></svg>';}

// A contextual hand-off strip, shown only where the canvas reaches its own limits
// (nested folders, whole-folder or bulk upload, access tiers, metadata, snapshots).
// The button label flips to "Get" when we know the desktop app is not installed.
function seCtaHtml(title,msg){
  var absent=state.s_seInstalled===false;
  var lab=absent?'Get Azure Storage Explorer':'Open in Azure Storage Explorer';
  return '<div class="secta"><span class="secta-ic">'+aseIcon(22)+'</span><div class="secta-tx"><b>'+esc(title)+'</b><span>'+esc(msg)+'</span></div><button class="secta-btn" data-seopen="1">'+aseIcon(15)+lab+'</button></div>';
}

// Launch the desktop app (or its download page when absent). Shared by the
// toolbar button and every contextual hand-off strip.
function openSE(){
  var b=$('seOpenBtn');
  if(b){b.disabled=true;b.classList.add('on');var l=b.querySelector('.seopen-lbl');if(l)l.textContent='Opening\u2026';}
  Promise.resolve(bridge.send('/open-storage-explorer',{})).catch(function(){}).then(function(){
    setTimeout(function(){if(b)b.disabled=false;renderSeBtn()},1200);
  });
}

// Wire any data-seopen buttons inside a freshly-rendered element to openSE().
function wireSeCta(el){
  if(!el)return;
  Array.prototype.forEach.call(el.querySelectorAll('[data-seopen]'),function(btn){btn.onclick=function(e){e.stopPropagation();openSE()}});
}

function renderScope(){
  var lab=$('scopeLabel');if(!lab)return;
  var sel=state.s_selectedSubs||[];
  if(!sel.length){lab.textContent='Select subscriptions';lab.title='';return}
  var base=sel.length+(sel.length===1?' subscription':' subscriptions');
  var accts=state.s_accounts||[];
  var withAcct={};accts.forEach(function(a){if(a.subscriptionName)withAcct[a.subscriptionName]=1});
  var n=Object.keys(withAcct).length;
  if(!state.s_loading&&accts.length&&n<sel.length){
    lab.innerHTML=esc(base)+' <span class="scope-sub">'+n+' with accounts</span>';
    lab.title=base+' selected, '+n+' contain storage accounts';
  } else {lab.textContent=base;lab.title=base;}
}
function renderError(){var e=$('err');if(!e)return;if(state.s_signingIn){e.innerHTML='<div class="err err-auth"><span class="etext"><span class="spin"></span> Opening az login\u2026 complete the sign-in in your browser window.</span></div>';return}if(state.s_error){var authBtn=state.s_needsAuth?'<button class="ebtn" id="errSignin">Sign in</button>':'';var extra=state.s_needsAuth?'. Sign in to continue.':'';e.innerHTML='<div class="err'+(state.s_needsAuth?' err-auth':'')+'"><span class="etext">\u26A0 '+esc(state.s_error)+extra+'</span><span class="eact">'+authBtn+'<button class="eclose" id="errClose" title="Dismiss">\u2715</button></span></div>';var s=$('errSignin');if(s)s.onclick=function(){doSignin()};var b=$('errClose');if(b)b.onclick=function(){state.s_error=null;state.s_needsAuth=false;renderError();bridge.send('/dismiss-error',{})}}else e.innerHTML=''}
function doSignin(){state.s_signingIn=true;renderError();var p=bridge.send('/sign-in',{});if(p&&p.then)p.then(function(r){state.s_signingIn=false;if(r&&r.ok===false)renderError()})}

function svgIcon(kind){
  var col={account:'#4db8ff',blob:'#4fc3f0',file:'#f2c661',queue:'#b18cf5',table:'#f0885a',sub:'#f2c661'}[kind]||'#9db1d6';
  var g={
    account:'<path d="M8 2.3c2.9 0 5.1.8 5.1 1.85v7.7c0 1.05-2.2 1.85-5.1 1.85s-5.1-.8-5.1-1.85V4.15C2.9 3.1 5.1 2.3 8 2.3Z"/><path d="M13.1 4.15c0 1.02-2.2 1.85-5.1 1.85S2.9 5.17 2.9 4.15M13.1 7.9c0 1.02-2.2 1.85-5.1 1.85S2.9 8.92 2.9 7.9"/>',
    sub:'<circle cx="5.4" cy="6.2" r="2.7"/><path d="M7.5 8l4.1 4.1M9.9 12.5l1.7-1.7M11.5 10.9l1.2-1.2"/>',
    blob:'<path d="M8 1.9 13.5 5.05v5.9L8 14.1 2.5 10.95v-5.9z"/><path d="M2.5 5.05 8 8.2l5.5-3.15M8 8.2v5.9"/>',
    file:'<path d="M2.4 4.5h4l1.2 1.5h6v6.5H2.4z"/>',
    queue:'<rect x="2.4" y="4" width="11.2" height="2.3" rx="1.1"/><rect x="2.4" y="7.35" width="11.2" height="2.3" rx="1.1"/><rect x="2.4" y="10.7" width="7" height="2.3" rx="1.1"/>',
    table:'<rect x="2.6" y="3.4" width="10.8" height="9.2" rx="1"/><path d="M2.6 6.5h10.8M2.6 9.6h10.8M6.2 3.4v9.2M9.8 3.4v9.2"/>'
  };
  return '<svg class="svi" viewBox="0 0 16 16" fill="none" stroke="'+col+'" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round">'+(g[kind]||g.blob)+'</svg>';
}
function catNode(account,kind,label,items,loading){
  var key=account+'|'+kind;
  var open=!!openCat[key];
  var ea=esc(account);
  var h='<div class="tnode">';
  h+='<div class="trow catrow" data-cat="'+kind+'" data-acct="'+ea+'"><span class="tw'+(open?' open':'')+'">\u25B6</span><span class="ti">'+svgIcon(kind)+'</span><span class="tlabel">'+label+'</span>'+(items&&items.length?'<span class="tmeta">'+items.length+'</span>':'')+'<button class="addbtn" data-add="'+kind+'" data-acct="'+ea+'" title="New">\uFF0B</button></div>';
  if(open){
    h+='<div class="tchildren">';
    if(loading){h+='<div class="tspin"><span class="spin"></span> loading\u2026</div>'}
    else if(!items||!items.length){h+='<div class="tempty">None</div>'}
    else{items.forEach(function(it){
      var isSel=(state.s_account===account&&state.s_kind===kind&&state.s_item===it.name);
      var meta='';
      if(kind==='queue'&&it.approximateMessagesCount!=null)meta='<span class="tmeta">'+it.approximateMessagesCount+'</span>';
      if(kind==='file'&&it.quotaGiB!=null)meta='<span class="tmeta">'+it.quotaGiB+' GiB</span>';
      h+='<div class="trow'+(isSel?' sel':'')+'" data-item="'+esc(it.name)+'" data-kind="'+kind+'" data-acct="'+ea+'"><span class="tw"></span><span class="ti">'+svgIcon(kind)+'</span><span class="tlabel">'+esc(it.name)+'</span>'+meta+'<button class="delbtn" data-del="'+kind+'" data-delname="'+esc(it.name)+'" data-acct="'+ea+'" title="Delete">\u{1F5D1}</button></div>';
    })}
    h+='</div>';
  }
  h+='</div>';
  return h;
}

function acctNode(x){
  var ao=!!openAccts[x.name];
  var t=(state.s_tree||{})[x.name]||{};
  var ld=t.loading||{};
  var pinned=!!pinnedAccts[x.name];
  var h='<div class="tnode">';
  h+='<div class="trow'+(state.s_account===x.name?' sel':'')+'" data-acct="'+esc(x.name)+'"><span class="tw'+(ao?' open':'')+'">\u25B6</span><span class="ti">'+svgIcon('account')+'</span><span class="tlabel">'+esc(x.name)+'</span>'+(x.location?'<span class="tmeta">'+esc(x.location)+'</span>':'')+'<button class="pinbtn'+(pinned?' on':'')+'" data-pin="'+esc(x.name)+'" title="'+(pinned?'Unpin':'Pin to top')+'">'+(pinned?'\u2605':'\u2606')+'</button><button class="hidebtn" data-hide="'+esc(x.name)+'" title="Hide from list">\u2298</button></div>';
  if(ao){
    h+='<div class="tchildren">';
    h+=catNode(x.name,'blob','Blob Containers',t.containers,!!ld.blob&&!(t.containers&&t.containers.length));
    h+=catNode(x.name,'file','File Shares',t.shares,!!ld.file);
    h+=catNode(x.name,'queue','Queues',t.queues,!!ld.queue);
    h+=catNode(x.name,'table','Tables',t.tables,!!ld.table);
    h+='</div>';
  }
  h+='</div>';
  return h;
}

function renderTree(){
  var el=$('tree');var a=state.s_accounts||[];
  var sel=state.s_selectedSubs||[];
  if(!sel.length&&!a.length){
    if(state.s_loading){el.innerHTML='<div class="tspin"><span class="spin"></span> Loading storage accounts\u2026</div>';return}
    var loadingSubs=state.s_subsLoading&&!(state.s_subscriptions||[]).length;
    el.innerHTML='<div class="tree-cta"><div class="ic">\u{1F511}</div><p>'+(loadingSubs?'Loading your subscriptions\u2026':'Pick which subscriptions to load your storage accounts from.')+'</p>'+(loadingSubs?'<span class="spin"></span>':'<button id="ctaPick">Select subscriptions</button>')+'</div>';
    var b=$('ctaPick');if(b)b.onclick=openPicker;
    return;
  }
  if(state.s_loading&&!a.length){el.innerHTML='<div class="tspin"><span class="spin"></span> Loading storage accounts\u2026</div>';return}
  if(!a.length){el.innerHTML='<div class="tempty">No storage accounts in the selected subscriptions.</div>';return}
  var q=treeQuery.toLowerCase();
  function matchAcct(x){return !q||x.name.toLowerCase().indexOf(q)>=0||(x.subscriptionName||'').toLowerCase().indexOf(q)>=0}
  var html='';
  var pins=a.filter(function(x){return pinnedAccts[x.name]&&!hiddenAccts[x.name]&&matchAcct(x)});
  if(pins.length){
    html+='<div class="tnode"><div class="trow pinhdr"><span class="tw"></span><span class="ti">\u2605</span><span class="tlabel">Pinned</span><span class="tmeta">'+pins.length+'</span></div><div class="tchildren">';
    pins.forEach(function(x){html+=acctNode(x)});
    html+='</div></div>';
  }
  var groups={};var order=[];
  a.forEach(function(x){var s=x.subscriptionName||'(no subscription)';if(!groups[s]){groups[s]=[];order.push(s)}groups[s].push(x)});
  order.sort();
  order.forEach(function(sub){
    var accts=groups[sub].filter(function(x){return !hiddenAccts[x.name]&&!pinnedAccts[x.name]&&matchAcct(x)});
    if(!accts.length)return;
    var so=q?true:!!openSubs[sub];
    html+='<div class="tnode">';
    html+='<div class="trow" data-sub="'+esc(sub)+'"><span class="tw'+(so?' open':'')+'">\u25B6</span><span class="ti">\u{1F511}</span><span class="tlabel">'+esc(sub)+'</span><span class="tmeta">'+accts.length+'</span></div>';
    if(so){
      html+='<div class="tchildren">';
      accts.forEach(function(x){html+=acctNode(x)});
      html+='</div>';
    }
    html+='</div>';
  });
  var hid=a.filter(function(x){return hiddenAccts[x.name]&&matchAcct(x)});
  if(hid.length){
    html+='<div class="tnode"><div class="trow hidhdr" data-togglehidden="1"><span class="tw'+(showHidden?' open':'')+'">\u25B6</span><span class="ti">\u2298</span><span class="tlabel">Hidden</span><span class="tmeta">'+hid.length+'</span></div>';
    if(showHidden){
      html+='<div class="tchildren">';
      hid.forEach(function(x){html+='<div class="trow"><span class="tw"></span><span class="ti">'+svgIcon('account')+'</span><span class="tlabel" style="opacity:.6">'+esc(x.name)+'</span><button class="pinbtn on" data-unhide="'+esc(x.name)+'" title="Show again">\u21A9</button></div>'});
      html+='</div>';
    }
    html+='</div>';
  }
  el.innerHTML=html||'<div class="tempty">No matches.</div>';
  Array.prototype.forEach.call(el.querySelectorAll('[data-sub]'),function(r){r.onclick=function(){var s=r.getAttribute('data-sub');openSubs[s]=!openSubs[s];renderTree()}});
  Array.prototype.forEach.call(el.querySelectorAll('[data-acct]'),function(r){if(r.getAttribute('data-cat')||r.getAttribute('data-item'))return;r.onclick=function(e){var n=r.getAttribute('data-acct');var open=!!openAccts[n];var onCaret=e.target.classList&&e.target.classList.contains('tw');if(onCaret){openAccts[n]=!open;renderTree();if(openAccts[n])bridge.send('/tree-containers',{account:n});return}openAccts[n]=true;renderTree();bridge.send('/account',{account:n})}});
  Array.prototype.forEach.call(el.querySelectorAll('[data-pin]'),function(r){r.onclick=function(e){e.stopPropagation();var n=r.getAttribute('data-pin');if(pinnedAccts[n])delete pinnedAccts[n];else pinnedAccts[n]=1;saveAcctPrefs();renderTree()}});
  Array.prototype.forEach.call(el.querySelectorAll('[data-hide]'),function(r){r.onclick=function(e){e.stopPropagation();var n=r.getAttribute('data-hide');hiddenAccts[n]=1;delete pinnedAccts[n];saveAcctPrefs();renderTree()}});
  Array.prototype.forEach.call(el.querySelectorAll('[data-unhide]'),function(r){r.onclick=function(e){e.stopPropagation();var n=r.getAttribute('data-unhide');delete hiddenAccts[n];saveAcctPrefs();renderTree()}});
  var th=el.querySelector('[data-togglehidden]');if(th)th.onclick=function(){showHidden=!showHidden;renderTree()};
  Array.prototype.forEach.call(el.querySelectorAll('[data-cat]'),function(r){r.onclick=function(e){e.stopPropagation();var kind=r.getAttribute('data-cat');var acct=r.getAttribute('data-acct');var key=acct+'|'+kind;openCat[key]=!openCat[key];if(openCat[key]){if(kind==='file')bridge.send('/list-shares',{account:acct});else if(kind==='queue')bridge.send('/list-queues',{account:acct});else if(kind==='table')bridge.send('/list-tables',{account:acct})}renderTree()}});
  Array.prototype.forEach.call(el.querySelectorAll('[data-add]'),function(r){r.onclick=function(e){e.stopPropagation();createInCategory(r.getAttribute('data-add'),r.getAttribute('data-acct'))}});
  Array.prototype.forEach.call(el.querySelectorAll('[data-del]'),function(r){r.onclick=function(e){e.stopPropagation();deleteItem(r.getAttribute('data-del'),r.getAttribute('data-delname'),r.getAttribute('data-acct'))}});
  Array.prototype.forEach.call(el.querySelectorAll('[data-item]'),function(r){r.onclick=function(e){e.stopPropagation();var kind=r.getAttribute('data-kind');var name=r.getAttribute('data-item');var acct=r.getAttribute('data-acct');if(kind==='blob')bridge.send('/container',{container:name,account:acct});else if(kind==='queue')bridge.send('/open-queue',{queue:name,account:acct});else if(kind==='table')bridge.send('/open-table',{table:name,account:acct});else if(kind==='file')bridge.send('/open-share',{share:name,account:acct})}});
}

function renderCrumb(){
  var el=$('crumb');if(!el)return;el.style.display='none';
}

var DATA_KINDS=[
  {k:'blob',label:'Blob Containers',desc:'Unstructured object storage for files, images, logs and backups. Upload, download, filter and delete blobs.'},
  {k:'file',label:'File Shares',desc:'Fully-managed SMB file shares you can mount. Browse folders, upload and download files.'},
  {k:'queue',label:'Queues',desc:'Durable message queues for decoupled apps. Send, peek and clear messages.'},
  {k:'table',label:'Tables',desc:'Schemaless NoSQL key/value store. Add, edit and delete entities.'}
];
function dataTitleFor(k){return k==='blob'?'Blob container':k==='file'?'File share':k==='queue'?'Queue':k==='table'?'Table':'Storage data'}

function openCategoryFor(kind){
  var acct=state.s_account;if(!acct)return;
  var accObj=(state.s_accounts||[]).filter(function(x){return x.name===acct})[0];
  if(accObj&&accObj.subscriptionName)openSubs[accObj.subscriptionName]=true;
  openAccts[acct]=true;
  openCat[acct+'|'+kind]=true;
  if(kind==='file')bridge.send('/list-shares',{account:acct});
  else if(kind==='queue')bridge.send('/list-queues',{account:acct});
  else if(kind==='table')bridge.send('/list-tables',{account:acct});
  renderTree();
}

function renderWelcome(el){
  var acct=state.s_account;
  var lead;
  if(acct){lead='<div class="wlead"><span class="wl-ic">'+svgIcon('account')+'</span><div><h3>'+esc(acct)+'</h3><p>Storage account is open. Choose a data service below to jump straight to it, or pick an item from the Explorer to view and manage its contents.</p></div></div>'}
  else{lead='<div class="wlead"><span class="wl-ic">'+svgIcon('account')+'</span><div><h3>Azure Storage</h3><p>Select a storage account from the Explorer on the left to browse and manage its blob containers, file shares, queues and tables, all with full create, read, update and delete.</p></div></div>'}
  var tiles=DATA_KINDS.map(function(d){
    var act=acct?' act':'';
    return '<div class="wtile'+act+'" data-tile="'+d.k+'"><span class="wt-ic">'+svgIcon(d.k)+'</span><div><h4>'+d.label+'</h4><p>'+d.desc+'</p>'+(acct?'<div class="wt-cta">Open in Explorer \u2192</div>':'')+'</div></div>'
  }).join('');
  el.innerHTML=lead+'<div class="wtiles">'+tiles+'</div>';
  if(acct){Array.prototype.forEach.call(el.querySelectorAll('[data-tile]'),function(r){r.onclick=function(){openCategoryFor(r.getAttribute('data-tile'))}})}
}

function uploadFiles(fl){
  if(!fl||!fl.length)return;
  var items=[];var pending=fl.length;
  Array.prototype.forEach.call(fl,function(file){
    var rd=new FileReader();
    rd.onload=function(){var b64=String(rd.result).split(',')[1]||'';items.push({name:file.name,contentBase64:b64,contentType:file.type});if(--pending===0)bridge.send('/upload-many',{items:items})};
    rd.onerror=function(){if(--pending===0&&items.length)bridge.send('/upload-many',{items:items})};
    rd.readAsDataURL(file);
  });
}
function wireDrop(el){
  var depth=0;
  el.ondragenter=function(e){e.preventDefault();depth++;el.classList.add('dragging')};
  el.ondragover=function(e){e.preventDefault();if(e.dataTransfer)e.dataTransfer.dropEffect='copy'};
  el.ondragleave=function(){depth--;if(depth<=0){depth=0;el.classList.remove('dragging')}};
  el.ondrop=function(e){e.preventDefault();depth=0;el.classList.remove('dragging');var dt=e.dataTransfer;if(dt&&dt.files&&dt.files.length)uploadFiles(dt.files)};
}

function renderBlobData(el,cnt){
  var b=state.s_blobs||[];cnt.textContent=b.length?b.length:'';
  var names={};b.forEach(function(x){names[x.name]=1});selected.forEach(function(n){if(!names[n])selected.delete(n)});
  var h='<div class="vtool browsetools"><button class="primary" id="dlBtn">\u2B07 Download selected</button><button id="selAll">Select all</button><button id="selNone">Clear</button><label class="flex grow" style="gap:6px;justify-content:flex-end"><input type="file" id="upFiles" multiple style="max-width:250px"><button id="upBtn" class="primary">\u2B06 Upload</button></label></div>';
  if(state.s_blobsMore){h+='<div class="vhint" style="color:#f2b705">Showing the first '+b.length+' blobs \u2014 this container has more. Statistics and filters below reflect only this capped sample.</div>'}
  if(!b.length){h+='<div class="empty">No blobs in this container yet. <b>Drag files here</b> or use <b>Upload</b> to add them.</div>'+seCtaHtml('Adding a whole folder of files?','This view uploads loose files (drag a selection, or pick them). For whole folders with nested directory structure and very large bulk uploads, open the free desktop app.')}
  else{h+='<div class="list">'+b.map(function(x){var sel=selected.has(x.name)?' sel':'';var d=x.lastModified?new Date(x.lastModified).toLocaleDateString():'';return '<div class="row'+sel+'" data-blob="'+esc(x.name)+'" role="checkbox" aria-checked="'+(selected.has(x.name)?'true':'false')+'" tabindex="0" aria-label="'+esc(x.name)+'"><span class="fname">'+(selected.has(x.name)?'\u2611 ':'\u2610 ')+esc(x.name)+'</span><span class="meta">'+fmtBytes(x.size)+' \xB7 '+esc(d)+' &nbsp; <button class="rowact" data-blobsas="'+esc(x.name)+'" title="Create a secure, time-limited SAS link">\u{1F517} SAS link</button> <button class="rowact del" data-blobdel="'+esc(x.name)+'">Delete</button></span></div>'}).join('')+'</div>';h+='<div class="vhint">Select blobs then Download, drag files here or upload to add new ones, or \u{1F517} SAS link to share a secure time-limited URL.</div>'+seCtaHtml('Need more than browse, upload and download?','Nested folders, whole-folder upload, access tiers, metadata, snapshots and property editing live in the free Azure Storage Explorer desktop app.')}
  h+='<div class="dropmask"><div class="dropmsg"><span class="dropic">\u2B06</span><div>Drop files to upload to <b>'+esc(state.s_container||'this container')+'</b></div></div></div>';
  el.innerHTML=h;
  wireDrop(el);
  $('dlBtn').onclick=function(){if(selected.size)bridge.send('/download-many',{blobs:Array.from(selected)})};
  $('selAll').onclick=function(){(state.s_blobs||[]).forEach(function(x){selected.add(x.name)});renderData()};
  $('selNone').onclick=function(){selected.clear();renderData()};
  $('upBtn').onclick=function(){uploadFiles($('upFiles').files)};
  Array.prototype.forEach.call(el.querySelectorAll('[data-blob]'),function(r){var toggle=function(){var n=r.getAttribute('data-blob');if(selected.has(n))selected.delete(n);else selected.add(n);renderData()};r.onclick=toggle;r.onkeydown=function(e){if(e.key===' '||e.key==='Spacebar'||e.key==='Enter'){e.preventDefault();toggle()}}});
  Array.prototype.forEach.call(el.querySelectorAll('[data-blobsas]'),function(bt){bt.onclick=function(e){e.stopPropagation();openSasGen(bt.getAttribute('data-blobsas'))}});
  Array.prototype.forEach.call(el.querySelectorAll('[data-blobdel]'),function(bt){bt.onclick=function(e){e.stopPropagation();var n=bt.getAttribute('data-blobdel');askConfirm({title:'Delete blob',msg:'Delete blob "'+n+'" from container "'+state.s_container+'"?',okLabel:'Delete',danger:true}).then(function(ok){if(ok)bridge.send('/blob-delete',{container:state.s_container,name:n})})}});
  wireSeCta(el);
}

var SEGS=[{k:'blob',label:'Blobs'},{k:'file',label:'File shares'},{k:'queue',label:'Queues'},{k:'table',label:'Tables'}];
function svcPlural(k){return k==='blob'?'blob containers':k==='file'?'file shares':k==='queue'?'queues':'tables'}
function svcTagline(k){return k==='blob'?'Object storage for files, images, logs and backups.':k==='file'?'Mountable SMB file shares you can map as a drive.':k==='queue'?'Durable messages passed between app components.':'Schemaless NoSQL key/value records.'}
function svcListOf(k){var t=(state.s_tree||{})[state.s_account]||{};return k==='blob'?t.containers:k==='file'?t.shares:k==='queue'?t.queues:t.tables}
function svcCount(k){var a=svcListOf(k);return a?a.length:null}
function ensureList(k){if(svcListOf(k)!=null)return;var a=state.s_account;if(!a)return;if(k==='blob')bridge.send('/account',{account:a});else if(k==='file')bridge.send('/list-shares',{account:a});else if(k==='queue')bridge.send('/list-queues',{account:a});else bridge.send('/list-tables',{account:a})}
function renderSwitcher(){return '<div class="svcbar">'+SEGS.map(function(s){var n=svcCount(s.k);var badge=n!=null?'<span class="segn">'+n+'</span>':'';return '<button class="seg'+(s.k===activeSvc?' act':'')+'" data-seg="'+s.k+'" title="'+esc(svcTagline(s.k))+'">'+svgIcon(s.k)+'<span class="segl">'+s.label+'</span>'+badge+'</button>'}).join('')+'</div>'}
function wireSwitcher(root){Array.prototype.forEach.call(root.querySelectorAll('[data-seg]'),function(b){b.onclick=function(){var kd=b.getAttribute('data-seg');activeSvc=kd;svcListMode=true;ensureList(kd);renderData()}})}
function itemMetaHtml(k,it){if(k==='queue'&&it.approximateMessagesCount!=null)return '<span class="imeta">'+it.approximateMessagesCount+' msgs</span>';if(k==='file'&&it.quotaGiB!=null)return '<span class="imeta">'+it.quotaGiB+' GiB</span>';return ''}
function openSvcItem(k,name){activeSvc=k;svcListMode=false;if(k==='blob')blobTab='browse';var a=state.s_account;if(k==='blob')bridge.send('/container',{container:name,account:a});else if(k==='queue')bridge.send('/open-queue',{queue:name,account:a});else if(k==='table')bridge.send('/open-table',{table:name,account:a});else bridge.send('/open-share',{share:name,account:a})}
function blobTabsHtml(){
  var tabs=[
    ['browse','Browse','<svg viewBox="0 0 24 24" class="svi" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="4" width="7" height="7" rx="1.4"/><rect x="13.5" y="4" width="7" height="7" rx="1.4"/><rect x="3.5" y="14" width="7" height="6" rx="1.4"/><rect x="13.5" y="14" width="7" height="6" rx="1.4"/></svg>'],
    ['filter','Filter &amp; stats','<svg viewBox="0 0 24 24" class="svi" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16l-6 7v6l-4 2v-8L4 5z"/></svg>'],
    ['share','Share','<svg viewBox="0 0 24 24" class="svi" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="12" r="2.4"/><circle cx="17.5" cy="6" r="2.4"/><circle cx="17.5" cy="18" r="2.4"/><path d="M8.2 10.9 15.3 7.1M8.2 13.1l7.1 3.8"/></svg>']
  ];
  return '<div class="blobnav"><button class="blobtab-back" data-blobback="1">\u2039 All containers</button><div class="blobtabgroup">'+tabs.map(function(t){return '<button class="blobtab'+(blobTab===t[0]?' active':'')+'" data-blobtab="'+t[0]+'"><span class="tbi">'+t[2]+'</span><span class="tbl">'+t[1]+'</span></button>'}).join('')+'</div></div>';
}
function wireBlobTabs(root){Array.prototype.forEach.call(root.querySelectorAll('[data-blobtab]'),function(b){b.onclick=function(){blobTab=b.getAttribute('data-blobtab');renderData()}});var bk=root.querySelector('[data-blobback]');if(bk)bk.onclick=function(){svcListMode=true;renderData()}}
function applyBlobTab(){
  var body=$('dataBody'),hf=$('hubFilter'),hs=$('hubShare');
  if(!hf||!hs)return;
  var isBlobItem=state.s_item&&state.s_kind==='blob'&&activeSvc==='blob'&&!svcListMode;
  if(!isBlobItem){if(body)body.style.display='';hf.style.display='none';hs.style.display='none';return}
  if(body)body.style.display=blobTab==='browse'?'':'none';
  hf.style.display=blobTab==='filter'?'':'none';
  hs.style.display=blobTab==='share'?'':'none';
}
function renderServiceList(el){
  var k=activeSvc,a=state.s_account,arr=svcListOf(k),plural=svcPlural(k);
  var newLabel=k==='blob'?'New container':k==='file'?'New share':k==='queue'?'New queue':'New table';
  var h='<div class="vtool"><span class="svc-desc">'+svgIcon(k)+'<span>'+svcTagline(k)+'</span></span><button class="primary grow" id="svcNew">\uFF0B '+newLabel+'</button></div>';
  if(arr==null){h+='<div class="empty"><span class="spin"></span> loading '+plural+'\u2026</div>';el.innerHTML=h;var nb0=$('svcNew');if(nb0)nb0.onclick=function(){createInCategory(k,a)};return}
  if(!arr.length){h+='<div class="empty">No '+plural+' in this account yet. Use <b>'+newLabel+'</b> to create one.</div>'}
  else{h+='<div class="list">'+arr.map(function(it){return '<div class="row svc-item" data-open="'+esc(it.name)+'"><span class="fname">'+svgIcon(k)+' '+esc(it.name)+'</span><span class="meta">'+itemMetaHtml(k,it)+'<button class="rowact del" data-itemdel="'+esc(it.name)+'">Delete</button></span></div>'}).join('')+'</div>'}
  el.innerHTML=h;
  $('svcNew').onclick=function(){createInCategory(k,a)};
  Array.prototype.forEach.call(el.querySelectorAll('[data-open]'),function(r){r.onclick=function(){openSvcItem(k,r.getAttribute('data-open'))}});
  Array.prototype.forEach.call(el.querySelectorAll('[data-itemdel]'),function(b){b.onclick=function(e){e.stopPropagation();deleteItem(k,b.getAttribute('data-itemdel'),a)}});
}
function renderData(){renderDataInner();applyBlobTab();renderCtx();renderCrumb();}
function renderDataInner(){
  var card=$('dataCard'),el=$('dataBody'),tEl=$('dataTitleTxt'),icEl=$('dataTitleIc'),cnt=$('dataCount'),bar=$('svcBar');
  card.style.display='';card.classList.remove('min');
  var acct=state.s_account;cnt.textContent='';
  if(!acct){icEl.innerHTML=svgIcon('account');tEl.textContent='Storage data';if(bar){bar.innerHTML='';bar.style.display='none'}activeSvc=null;lastAcct='';renderWelcome(el);return}
  if(acct!==lastAcct){lastAcct=acct;activeSvc='blob';svcListMode=true;lastItemKey='';ensureList('file');ensureList('queue');ensureList('table')}
  var itemKey=(state.s_kind||'')+'|'+(state.s_item||'');
  if(itemKey!==lastItemKey){lastItemKey=itemKey;if(state.s_item){activeSvc=state.s_kind;svcListMode=false}}
  if(!activeSvc)activeSvc='blob';
  var k=state.s_kind,item=state.s_item;
  var showItem=item&&k===activeSvc&&!svcListMode;
  if(showItem){icEl.innerHTML=svgIcon(k);tEl.innerHTML='<span class="hdr-acct">'+esc(acct)+'</span><span class="hdr-sep">\u203A</span><span class="hdr-item">'+esc(item)+'</span>';}
  else{icEl.innerHTML=svgIcon('account');tEl.textContent=esc(acct);}
  if(bar){bar.style.display='';var bh=renderSwitcher();if(showItem){if(k==='blob'){bh+=blobTabsHtml()}else{bh+='<div class="svc-sub"><button class="backlink" id="svcBack">\u2039 All '+svcPlural(k)+'</button><span class="svc-cur">'+svgIcon(k)+' '+esc(item)+'</span></div>'}}bar.innerHTML=bh;wireSwitcher(bar);if(showItem){var bk=$('svcBack');if(bk)bk.onclick=function(){svcListMode=true;renderData()};if(k==='blob')wireBlobTabs(bar)}}
  if(!showItem){renderServiceList(el);return}
  if(state.s_loading){el.innerHTML='<div class="empty"><span class="spin"></span> loading\u2026</div>';return}
  if(k==='blob'){renderBlobData(el,cnt);return}
  if(k==='queue'){
    var m=state.s_messages||[];
    var h='<div class="vtool"><input id="qMsg" placeholder="message text\u2026" style="flex:1"><button class="primary" id="qSend">Send</button><button id="qClear">Clear messages</button><button class="danger" id="qDel">Delete queue</button></div>';
    if(!m.length){h+='<div class="empty">No messages to peek (queue empty or peek returned none).</div>'}
    else{h+='<table><thead><tr><th>Message ID</th><th>Dequeue #</th><th>Inserted</th><th>Text</th><th></th></tr></thead><tbody>'+m.map(function(x){var d=x.insertedOn?new Date(x.insertedOn).toLocaleString():'';var txt=x.messageText||'';return '<tr><td class="mono" style="border:0;padding:6px 9px">'+esc(x.messageId)+'</td><td>'+x.dequeueCount+'</td><td>'+esc(d)+'</td><td>'+esc(txt.slice(0,400))+'</td><td style="white-space:nowrap"><button class="rowact" data-qedit="'+esc(x.messageId)+'" data-qtext="'+esc(txt)+'">Edit</button> <button class="rowact del" data-qdel="'+esc(x.messageId)+'">Delete</button></td></tr>'}).join('')+'</tbody></table><div class="vhint">Peek shows up to 32 messages. Editing or deleting one briefly receives the batch (Azure has no random-access), so dequeue counts may rise.</div>'}
    el.innerHTML=h;
    $('qSend').onclick=function(){var t=$('qMsg').value;if(!t)return;bridge.send('/queue-send',{queue:item,text:t})};
    $('qMsg').onkeydown=function(e){if(e.key==='Enter')$('qSend').click()};
    $('qClear').onclick=function(){askConfirm({title:'Clear messages',msg:'Delete ALL messages in queue "'+item+'"?',okLabel:'Clear',danger:true}).then(function(ok){if(ok)bridge.send('/queue-clear',{queue:item})})};
    $('qDel').onclick=function(){deleteItem('queue',item)};
    Array.prototype.forEach.call(el.querySelectorAll('[data-qedit]'),function(b){b.onclick=function(){var id=b.getAttribute('data-qedit');var cur=b.getAttribute('data-qtext');askConfirm({title:'Edit message',msg:'Update the text of this queue message:',input:true,rows:3,value:cur,okLabel:'Save'}).then(function(t){if(t===null)return;bridge.send('/queue-msg-update',{queue:item,messageId:id,text:t})})}});
    Array.prototype.forEach.call(el.querySelectorAll('[data-qdel]'),function(b){b.onclick=function(){var id=b.getAttribute('data-qdel');askConfirm({title:'Delete message',msg:'Delete this message from queue "'+item+'"?',okLabel:'Delete',danger:true}).then(function(ok){if(ok)bridge.send('/queue-msg-delete',{queue:item,messageId:id})})}});
  }
  else if(k==='table'){
    var e=state.s_entities;
    var h='<div class="vtool"><button class="primary" id="tAdd">\uFF0B Add entity</button><button class="danger" id="tDel">Delete table</button></div>';
    if(!e||!e.rows.length){h+='<div class="empty">No entities yet. Use <b>Add entity</b> to create one.</div>'}
    else{
      var cols=e.columns;
      var head=cols.map(function(c){return '<th>'+esc(c)+'</th>'}).join('')+'<th></th>';
      var body=e.rows.map(function(row,ri){return '<tr>'+cols.map(function(c){var v=row[c];return '<td>'+esc(v==null?'':String(v)).slice(0,300)+'</td>'}).join('')+'<td style="white-space:nowrap"><button class="rowact" data-entedit="'+ri+'">Edit</button> <button class="rowact del" data-entpk="'+esc(row.partitionKey||'')+'" data-entrk="'+esc(row.rowKey||'')+'">Delete</button></td></tr>'}).join('');
      h+='<div style="overflow:auto"><table><thead><tr>'+head+'</tr></thead><tbody>'+body+'</tbody></table></div><p class="muted" style="margin-top:8px">First '+e.rows.length+' entities.</p>';
    }
    el.innerHTML=h;
    $('tAdd').onclick=function(){openEntityForm(null)};
    $('tDel').onclick=function(){deleteItem('table',item)};
    Array.prototype.forEach.call(el.querySelectorAll('[data-entedit]'),function(b){b.onclick=function(){var ri=parseInt(b.getAttribute('data-entedit'),10);var row=(state.s_entities&&state.s_entities.rows)?state.s_entities.rows[ri]:null;if(row)openEntityForm(row)}});
    Array.prototype.forEach.call(el.querySelectorAll('[data-entpk]'),function(b){b.onclick=function(){var pk=b.getAttribute('data-entpk'),rk=b.getAttribute('data-entrk');askConfirm({title:'Delete entity',msg:'Delete entity ('+pk+', '+rk+')?',okLabel:'Delete',danger:true}).then(function(ok){if(ok)bridge.send('/entity-delete',{table:item,partitionKey:pk,rowKey:rk})})}});
  }
  else if(k==='file'){
    var f=state.s_files||[];
    var h='<div class="vtool"><input type="file" id="shFile" style="max-width:220px"><button class="primary" id="shUp">\u2B06 Upload</button><button id="shMkdir">New folder</button><button class="danger" id="shDel">Delete share</button></div>';
    if(!f.length){h+='<div class="empty">Empty share. No files or folders yet. Use <b>Upload</b> or <b>New folder</b> to add content.</div>'}
    else{h+='<div class="list">'+f.map(function(x){var ic=x.kind==='directory'?'\u{1F4C2}':'\u{1F4C4}';var meta=x.kind==='file'?fmtBytes(x.size):'folder';var acts=(x.kind==='file'?'<button class="rowact" data-shdl="'+esc(x.name)+'">\u2B07</button> ':'')+'<button class="rowact del" data-shdel="'+esc(x.name)+'" data-shkind="'+esc(x.kind)+'">Delete</button>';return '<div class="row" style="cursor:default"><span class="fname">'+ic+' '+esc(x.name)+'</span><span class="meta">'+esc(meta)+' &nbsp; '+acts+'</span></div>'}).join('')+'</div>'}
    el.innerHTML=h;
    $('shUp').onclick=function(){var fl=$('shFile').files;if(!fl||!fl.length)return;var file=fl[0];var rd=new FileReader();rd.onload=function(){var b64=String(rd.result).split(',')[1]||'';bridge.send('/share-upload',{share:item,name:file.name,contentBase64:b64})};rd.readAsDataURL(file)};
    $('shMkdir').onclick=function(){askConfirm({title:'New folder',msg:'Directory name to create in "'+item+'":',input:true,okLabel:'Create'}).then(function(d){d=(d||'').trim();if(d)bridge.send('/share-mkdir',{share:item,dir:d})})};
    $('shDel').onclick=function(){deleteItem('file',item)};
    Array.prototype.forEach.call(el.querySelectorAll('[data-shdl]'),function(b){b.onclick=function(){bridge.send('/share-download',{share:item,name:b.getAttribute('data-shdl')})}});
    Array.prototype.forEach.call(el.querySelectorAll('[data-shdel]'),function(b){b.onclick=function(){var n=b.getAttribute('data-shdel'),kd=b.getAttribute('data-shkind');askConfirm({title:'Delete '+kd,msg:'Delete '+kd+' "'+n+'"?',okLabel:'Delete',danger:true}).then(function(ok){if(ok)bridge.send('/share-delete-item',{share:item,name:n,kind:kd})})}});
  }
}
var xferTimer=null;
function dismissXfer(){if(xferTimer){clearTimeout(xferTimer);xferTimer=null}var el=$('xfer');if(el){el.style.display='none';el.innerHTML=''}bridge.send('/dismiss-batch',{})}
function shortPath(p){if(!p)return '';var sep=String.fromCharCode(92);var norm=p.split('/').join(sep);var parts=norm.split(sep);if(parts.length<=3)return norm;return parts[0]+sep+'\u2026'+sep+parts.slice(-2).join(sep)}
function renderBatch(){
  var el=$('xfer');if(!el)return;var s=state.s_batch;
  if(!s){if(xferTimer){clearTimeout(xferTimer);xferTimer=null}el.style.display='none';el.innerHTML='';return}
  var pct=s.total?Math.round(100*s.done/s.total):0;
  var opn={upload:{g:'Uploading',d:'Upload',n:'file'},download:{g:'Downloading',d:'Download',n:'file'},archive:{g:'Moving to Archive',d:'Archive',n:'blob'},'delete':{g:'Deleting',d:'Delete',n:'blob'}};
  var o=opn[s.op]||opn.download;
  var title=s.running?o.g+'\u2026':(s.failed.length?o.d+' finished with issues':o.d+' complete');
  var h='<div class="xf-head"><span class="xf-title">'+(s.running?'<span class="spin"></span> ':'\u2713 ')+esc(title)+'</span><button class="xf-x" id="xferClose" title="Dismiss">\u2715</button></div>';
  h+='<div class="xf-bar"><i style="width:'+pct+'%"></i></div>';
  h+='<div class="xf-meta"><span>'+s.done+' of '+s.total+' '+o.n+(s.total===1?'':'s')+'</span>'+(s.failed.length?'<span class="pill bad">'+s.failed.length+' failed</span>'+(s.ok?'<span class="pill ok">'+s.ok+' done</span>':''):(!s.running?'<span class="pill ok">Completed</span>':''))+'</div>';
  if(s.failed.length){h+='<div class="xf-fails">'+s.failed.slice(0,4).map(function(f){return '<div class="xf-fail"><b>'+esc(f.name)+'</b><span>'+esc(f.error)+'</span></div>'}).join('')+(s.failed.length>4?'<div class="muted" style="font-size:11px">+'+(s.failed.length-4)+' more</div>':'')+'</div>'}
  if(s.op==='download'&&!s.running&&s.ok>0&&s.dir){h+='<div class="dlsaved"><div class="dls-top"><span class="dls-ic">\u{1F4C1}</span><span class="dls-lead">'+s.ok+' file'+(s.ok>1?'s':'')+' saved to your PC</span></div><code id="dlPath" class="dls-path" title="'+esc(s.dir)+'">'+esc(shortPath(s.dir))+'</code><div class="dls-acts"><button class="primary" id="openDlFolder">\u{1F4C2} Open folder</button><button class="ghost" id="copyDlPath" title="Copy folder path">\u{1F4CB} Copy path</button></div></div>'}
  el.innerHTML=h;el.style.display='';
  var cx=$('xferClose');if(cx)cx.onclick=dismissXfer;
  var of=$('openDlFolder');if(of)of.onclick=function(){if(xferTimer){clearTimeout(xferTimer);xferTimer=null}of.disabled=true;of.textContent='Opening\u2026';bridge.send('/open-folder',{dir:s.dir}).then(function(r){if(r&&r.ok){of.textContent='\u2713 Opened';setTimeout(function(){if($('openDlFolder')){of.disabled=false;of.textContent='\u{1F4C2} Open folder'}},1600)}else{of.textContent='Couldn\u2019t open. Copy the path instead.';of.disabled=false}})};
  var cp=$('copyDlPath');if(cp)cp.onclick=function(){if(xferTimer){clearTimeout(xferTimer);xferTimer=null}var t=s.dir;try{navigator.clipboard.writeText(t)}catch(e){}cp.textContent='\u2713 Copied';setTimeout(function(){if($('copyDlPath'))cp.textContent='\u{1F4CB} Copy path'},1400)};
  if(xferTimer){clearTimeout(xferTimer);xferTimer=null}
  if(!s.running&&!s.failed.length){xferTimer=setTimeout(dismissXfer,(s.op==='download'&&s.dir)?9000:4500)}
}
function renderStats(){
  var el=$('stats');var s=state.s_stats;
  if(!s){el.innerHTML=containerOpen()?'<div class="empty">Set optional criteria above and click <b>Filter</b> to see live totals, a size histogram, a by-type breakdown and the largest blobs.</div>':'<div class="empty">'+cubeIc()+'Open a container first. Pick one from the tree on the left, then Filter its blobs.</div>';return}
  var maxb=Math.max.apply(null,s.buckets.map(function(x){return x.n}).concat([1]));
  var h='';
  if(containerOpen())h+='<div class="statscap"><span class="sc-dot"></span>Statistics for <b>'+esc(state.s_container)+'</b> <span class="sc-sep">\xB7</span> '+s.count+' blob'+(s.count===1?'':'s')+' matched in <b>'+esc(state.s_account)+'</b></div>';
  h+='<div class="metrics">'+metricCard('matched',String(s.count),'#479ef5')+metricCard('total',s.totalh,'#8b5cf6')+metricCard('avg',s.avgh,'#22d3ee')+metricCard('largest',s.maxh,'#f59e0b')+'</div>';
  h+='<div class="chart">';
  h+='<div class="sect">Size distribution</div>'+s.buckets.map(function(bk){return brkBar(bk.label,bk.n/maxb,'<b>'+bk.n+'</b>',gradFor('size',bk.label))}).join('');
  h+=brkSection('By type',s.byType,'type');
  h+=brkSection('By access tier',s.byTier,'tier');
  h+=brkSection('By extension',s.byExt,'ext');
  if(s.topLargest&&s.topLargest.length){var mx=Math.max.apply(null,s.topLargest.map(function(x){return Number(x.size)||0}).concat([1]));
    h+='<div class="sect">Largest blobs</div>'+s.topLargest.map(function(t){var w=(Number(t.size)>0)?Math.max(6,Math.round(100*(Number(t.size)||0)/mx)):0;return '<div class="lrow"><i class="lfill" style="width:'+w+'%"></i><span class="lname" title="'+esc(t.name)+'">'+esc(t.name)+'</span><span class="lsize">'+esc(t.sizeh)+'</span></div>'}).join('');
  }
  h+='</div>';
  el.innerHTML=h;
}
function visualHtml(v){
  if(!v)return '';
  if(v.kind==='stat')return '<div class="stat" style="margin-top:10px"><b>'+esc(v.value)+'</b><span>'+esc(v.label||'')+'</span></div>';
  if(v.kind==='bar'&&v.items){var mx=Math.max.apply(null,v.items.map(function(x){return Number(x.value)||0}).concat([1]));return '<div style="margin-top:10px">'+v.items.map(function(x){var w=Math.round(100*(Number(x.value)||0)/mx);return '<div class="hbar"><span style="width:120px">'+esc(x.label)+'</span><div class="track"><i style="width:'+w+'%"></i></div><span>'+esc(x.value)+'</span></div>'}).join('')+'</div>'}
  if(v.kind==='table'&&v.rows){return '<table style="margin-top:10px">'+v.rows.map(function(r,i){var c=r.map(function(cell){return (i===0?'<th>':'<td>')+esc(cell)+(i===0?'</th>':'</td>')}).join('');return '<tr>'+c+'</tr>'}).join('')+'</table>'}
  return '';
}
function renderInsight(){
  var el=$('insight');if(!el)return;var ins=state.s_insight;
  if(!ins){el.innerHTML='';return}
  if(ins.pending){el.innerHTML='<div class="insight-box"><span class="muted"><span class="spin"></span> Copilot is interpreting the statistics\u2026</span></div>';return}
  var h='<div class="insight-box"><div class="insight-head">\u{1F9E0} Copilot insight <button class="ix" id="insightX" title="Dismiss">\u2715</button></div>';
  h+='<div>'+mdInline(ins.answer)+'</div>';
  h+=visualHtml(ins.visual);
  if(ins.suggestedFilter&&Object.keys(ins.suggestedFilter).length){
    var parts=[];var f=ins.suggestedFilter;
    if(f.olderThanDays!=null)parts.push('older than '+f.olderThanDays+'d');
    if(f.newerThanDays!=null)parts.push('newer than '+f.newerThanDays+'d');
    if(f.minSize!=null)parts.push('\u2265 '+fmtBytes(f.minSize));
    if(f.maxSize!=null)parts.push('\u2264 '+fmtBytes(f.maxSize));
    if(f.tiers)parts.push('tier '+[].concat(f.tiers).join('/'));
    if(f.type)parts.push('type '+f.type);
    if(f.namePattern)parts.push('name '+f.namePattern);
    var n=countMatch(f);var cnt=' <span class="sugcount">matches '+n+' of '+((state.s_blobs||[]).length)+'</span>';
    h+='<div class="insight-why">\u{1F4A1} Based on the analysis above, Copilot recommends this one-click filter to isolate the blobs worth acting on in <b>this</b> container.</div>';
    h+='<div class="insight-sug"><span class="muted">Suggested filter:</span> <b>'+esc(parts.join(' \xB7 ')||'custom')+'</b>'+cnt+'<button class="primary" id="applySug"'+(n===0?' disabled title="No blobs in this container match this filter"':'')+'>Apply filter</button></div>';
  }
  h+='</div>';
  el.innerHTML=h;
  if($('insightX'))$('insightX').onclick=function(){bridge.send('/dismiss-insight',{})};
  if($('applySug'))$('applySug').onclick=function(){var f=state.s_insight.suggestedFilter||{};syncFilterForm(f);bridge.send('/filter',f);var sb=$('applySug');if(sb){sb.disabled=true;sb.textContent='\u2713 Applied'}};
}
function globOk(pat,name){pat=(''+pat).toLowerCase();name=(''+name).toLowerCase();
  if(pat.indexOf('*')===-1)return pat===name;
  var segs=pat.split('*');
  if(segs[0]&&name.slice(0,segs[0].length)!==segs[0])return false;
  var pos=segs[0].length;
  for(var i=1;i<segs.length;i++){var s=segs[i];if(!s)continue;
    if(i===segs.length-1){if(name.slice(name.length-s.length)!==s)return false;}
    else{var at=name.indexOf(s,pos);if(at===-1)return false;pos=at+s.length;}}
  return true;}
function countMatch(f){f=f||{};var b=state.s_blobs||[];if(!b.length)return 0;
  var min=(f.minSize!=null&&f.minSize!=='')?Number(f.minSize):null;
  var max=(f.maxSize!=null&&f.maxSize!=='')?Number(f.maxSize):null;
  var older=(f.olderThanDays!=null&&f.olderThanDays!=='')?Number(f.olderThanDays):null;
  var newer=(f.newerThanDays!=null&&f.newerThanDays!=='')?Number(f.newerThanDays):null;
  var tiers=f.tiers?[].concat(f.tiers).map(function(t){return String(t).toLowerCase()}):null;
  var pat=(f.namePattern&&String(f.namePattern).trim())?String(f.namePattern).trim():null;
  var DAY=86400000,now=Date.now();
  return b.filter(function(x){var sz=Number(x.size)||0;
    if(min!=null&&sz<min)return false;
    if(max!=null&&sz>max)return false;
    if(pat&&!globOk(pat,String(x.name||'')))return false;
    if(tiers&&tiers.indexOf(String(x.accessTier||'').toLowerCase())===-1)return false;
    if(older!=null||newer!=null){if(!x.lastModified)return false;var age=now-Date.parse(x.lastModified);if(older!=null&&!(age>older*DAY))return false;if(newer!=null&&!(age<=newer*DAY))return false;}
    return true;}).length;}
function metricCard(label,val,color){var v=String(val==null?'':val);var m=v.match(/^([d.,]+)s*(.*)$/);var main=m?m[1]:v;var unit=(m&&m[2])?' <small>'+esc(m[2])+'</small>':'';return '<div class="metric" style="--mc:'+color+'"><div class="mk"><span class="md"></span>'+esc(label)+'</div><div class="mv">'+esc(main)+unit+'</div></div>'}
function gradFor(kind,label){
  if(kind==='tier'){var t=String(label||'').toLowerCase();
    if(t.indexOf('hot')>=0)return 'linear-gradient(90deg,#f59e0b,#fcd34d)';
    if(t.indexOf('archive')>=0)return 'linear-gradient(90deg,#7c3aed,#a78bfa)';
    if(t.indexOf('cool')>=0)return 'linear-gradient(90deg,#2563eb,#60a5fa)';
    if(t.indexOf('cold')>=0)return 'linear-gradient(90deg,#0891b2,#22d3ee)';
    return 'linear-gradient(90deg,#4b5563,#9ca3af)';}
  if(kind==='type')return 'linear-gradient(90deg,#8b5cf6,#c084fc)';
  if(kind==='ext')return 'linear-gradient(90deg,#0ea5e9,#38bdf8)';
  return 'linear-gradient(90deg,#3b82f6,#22d3ee)';
}
function brkBar(label,frac,valHtml,grad){var f=frac||0;var w=(f>0)?Math.max(3,Math.min(100,Math.round(100*f))):0;return '<div class="brow"><span class="blabel" title="'+esc(label)+'">'+esc(label)+'</span><div class="bwrap"><i class="bfill" style="width:'+w+'%;background:'+grad+'"></i><span class="bval">'+valHtml+'</span></div></div>'}
function brkSection(title,items,kind){if(!items||!items.length)return '';var maxb=Math.max.apply(null,items.map(function(x){return Number(x.bytes)||0}).concat([1]));return '<div class="sect">'+esc(title)+'</div>'+items.map(function(t){var lbl=(t.label==null||t.label===''||t.label==='\u2014')?'(untiered)':String(t.label);return brkBar(lbl,(Number(t.bytes)||0)/maxb,'<b>'+t.n+'</b> <span class="bmut">\xB7 '+esc(fmtBytes(t.bytes))+'</span>',gradFor(kind,lbl))}).join('')}
function sasPerm(on,label){return '<span class="pill '+(on?'ok':'')+'" style="'+(on?'':'opacity:.4')+'">'+(on?'\u2713 ':'\u2715 ')+label+'</span>'}
var SAS_CHECK='<svg class="pi" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 4.5 6.5 12 3 8.5"/></svg>';
var SAS_LOCK='<svg class="pi" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3.5" y="7" width="9" height="6.3" rx="1.3"/><path d="M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7"/></svg>';
var IC_OPEN='<svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3H3.5v9.5h9.5V10"/><path d="M9 3h4v4M13 3 7.5 8.5"/></svg>';
var IC_LINK='<svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 9.5 9.5 6.5"/><path d="M8 4.5 9.2 3.3a2.4 2.4 0 0 1 3.5 3.4L11.5 8"/><path d="M8 11.5 6.8 12.7a2.4 2.4 0 0 1-3.5-3.4L4.5 8"/></svg>';
var IC_DL='<svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2.5v7M5 6.5 8 9.5l3-3"/><path d="M3 12.5h10"/></svg>';
function permChip(on,label){return '<span class="perm '+(on?'on':'off')+'">'+(on?SAS_CHECK:SAS_LOCK)+label+'</span>'}
var CAP_READ='<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M1.4 8S3.9 3.6 8 3.6 14.6 8 14.6 8 12.1 12.4 8 12.4 1.4 8 1.4 8Z"/><circle cx="8" cy="8" r="2.1"/></svg>';
var CAP_LIST='<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 4.5h8M5.5 8h8M5.5 11.5h8"/><path d="M2.6 4.5h.01M2.6 8h.01M2.6 11.5h.01"/></svg>';
var CAP_WRITE='<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M10.8 2.6 13.4 5.2 5.4 13.2 2.4 13.9 3.1 10.9Z"/><path d="M9.6 3.8 12.2 6.4"/></svg>';
var CAP_DELETE='<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4.5h10M6.2 4.5V3.1h3.6v1.4M4.6 4.5l.55 8.4h5.7l.55-8.4"/></svg>';
var CAP_LOCK='<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="4" y="7.2" width="8" height="5.6" rx="1.2"/><path d="M5.7 7.2V5.6a2.3 2.3 0 0 1 4.6 0v1.6"/></svg>';
function capChip(on,label,ic){return '<span class="cap '+(on?'on':'off')+'"><span class="ci">'+ic+'</span>'+label+(on?'':'<span class="lk">'+CAP_LOCK+'</span>')+'</span>'}
function tierColor(t){var k=String(t||'').toLowerCase();if(k==='hot')return '#e0a13c';if(k==='cool')return '#4b9df0';if(k==='cold')return '#42c5c5';if(k==='archive')return '#a06cf0';return '#8a93a6'}
function tierChip(t){if(!t)return '<span class="muted">\xB7</span>';var c=tierColor(t);return '<span class="tierpill"><span class="tdot" style="background:'+c+'"></span>'+esc(t)+'</span>'}
function expChipHtml(info){
  if(!info.expiresOn)return '<span class="expchip">no expiry</span>';
  var t=Date.parse(info.expiresOn);var d=String(info.expiresOn).slice(0,10);
  if(info.expired||(isFinite(t)&&t<Date.now()))return '<span class="expchip bad">\u26A0 expired '+esc(d)+'</span>';
  if(isFinite(t)){var days=Math.round((t-Date.now())/86400000);if(days<=7)return '<span class="expchip warn">expires in '+days+'d ('+esc(d)+')</span>'}
  return '<span class="expchip">expires '+esc(d)+'</span>';
}
function renderSas(){
  var el=$('sas');var info=state.s_sasInfo;var blobs=state.s_sasBlobs||[];
  if(!info){el.innerHTML='<div class="empty">\u{1F511} No SAS connected yet. Paste a container SAS URL above and click <b>Connect</b>.</div>';return}
  var st=state.s_sasStats;
  var h='<div class="sasconn">';
  h+='<div class="sashead"><div class="sasavatar"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"><rect x="3" y="4" width="18" height="5" rx="1.3"/><rect x="3" y="10.5" width="18" height="5" rx="1.3"/><rect x="3" y="17" width="18" height="3" rx="1.3"/><path d="M6 6.5h.01M6 13h.01"/></svg></div>';
  h+='<div class="sasid"><div class="sastitle"><b>'+esc(info.account)+'</b><span class="chev">\u203A</span>'+cubeIc()+'<b>'+esc(info.container)+'</b></div><div class="sassub">Shared Access Signature \xB7 read-only connection</div></div>';
  h+='<div class="sasmeta"><span class="constatus"><span class="livedot"></span>Connected</span>'+expChipHtml(info)+'</div></div>';
  h+='<div class="permrow"><span class="plabel">Permissions</span><div class="caps">'+capChip(info.canRead,'Read',CAP_READ)+capChip(info.canList,'List',CAP_LIST)+capChip(info.canWrite,'Write',CAP_WRITE)+capChip(info.canDelete,'Delete',CAP_DELETE)+'</div></div>';
  if(st){h+='<div class="sasm"><div class="c"><b>'+st.count+'</b><span>blobs</span></div><div class="c"><b>'+esc(st.totalh)+'</b><span>total size</span></div><div class="c"><b>'+esc(st.maxh)+'</b><span>largest</span></div></div>'}
  h+='</div>';
  if(!blobs.length){h+='<div class="empty" style="margin-top:10px">No blobs (or this SAS lacks list permission).</div>';el.innerHTML=h;return}
  var ft=sasFilterText.toLowerCase();
  var shown=blobs.filter(function(x){return !ft||String(x.name).toLowerCase().indexOf(ft)>-1});
  if(sasSort==='size')shown=shown.slice().sort(function(a,b){return (Number(b.size)||0)-(Number(a.size)||0)});
  else shown=shown.slice().sort(function(a,b){return String(a.name).localeCompare(String(b.name))});
  var urlMap={};shown.forEach(function(x){urlMap[x.name]=x.url||''});
  h+='<div class="flex" style="margin:12px 0 8px;gap:8px;align-items:center"><input id="sasFilter" placeholder="filter blobs by name" value="'+esc(sasFilterText)+'" style="flex:1"><button id="sasSortName" class="'+(sasSort==='name'?'primary':'')+'">A\u2192Z</button><button id="sasSortSize" class="'+(sasSort==='size'?'primary':'')+'">Size</button><button id="sasDlAll">'+IC_DL+' Download '+shown.length+'</button></div>';
  h+='<span class="muted" style="font-size:12px">'+shown.length+' of '+blobs.length+' shown</span>';
  var hasVS=!!info.canRead;
  var actHead=hasVS?'<div class="acthdr"><span>View</span><span>Share</span><span>Save</span></div>':'<div class="acthdr one"><span>Save</span></div>';
  h+='<table class="sas-tbl" style="margin-top:8px;width:100%"><tr><th>Name</th><th>Size</th><th>Modified</th><th>Tier</th><th class="acth">'+actHead+'</th></tr>';
  h+=shown.map(function(x){
    var mod=x.lastModified?String(x.lastModified).slice(0,10):'\xB7';
    var tier=tierChip(x.accessTier);
    var acts='<div class="rowacts'+(hasVS?'':' one')+'">';
    if(x.url){acts+='<button class="sasact" data-sasopen="'+esc(x.name)+'" title="Open in browser">'+IC_OPEN+'</button><button class="sasact" data-sascopy="'+esc(x.name)+'" title="Copy shareable link">'+IC_LINK+'</button>'}
    acts+='<button class="sasact" data-sasdl="'+esc(x.name)+'" title="Download">'+IC_DL+'</button></div>';
    return '<tr><td class="fname">'+esc(x.name)+'</td><td>'+esc(fmtBytes(x.size))+'</td><td class="muted">'+esc(mod)+'</td><td>'+tier+'</td><td class="acth">'+acts+'</td></tr>'
  }).join('')+'</table>';
  h+='<div id="sasDlMsg" class="dlmsg" style="display:none"></div>';
  el.innerHTML=h;
  var fi=$('sasFilter');if(fi){fi.oninput=function(){sasFilterText=fi.value;var pos=fi.selectionStart;renderSas();var nf=$('sasFilter');if(nf){nf.focus();try{nf.setSelectionRange(pos,pos)}catch(e){}}}}
  if($('sasSortName'))$('sasSortName').onclick=function(){sasSort='name';renderSas()};
  if($('sasSortSize'))$('sasSortSize').onclick=function(){sasSort='size';renderSas()};
  function sasShowDl(dir,label){var m=$('sasDlMsg');if(!m)return;if(!dir){m.style.display='flex';m.innerHTML='<span class="ok">\u2713 '+esc(label)+'</span>';return}m.style.display='flex';m.innerHTML='<span class="ok">\u2713 '+esc(label)+'</span><code class="dlpath">'+esc(dir)+'</code><span class="dlacts"><button id="sasOpenDir">Open folder</button><button id="sasCopyDir">Copy path</button></span>';var od=$('sasOpenDir');if(od)od.onclick=function(){od.textContent='Opening\u2026';bridge.send('/open-folder',{dir:dir}).then(function(r){od.textContent=(r&&r.ok)?'\u2713 Opened':'Couldn\u2019t open';setTimeout(function(){if($('sasOpenDir'))od.textContent='Open folder'},1600)})};var cd=$('sasCopyDir');if(cd)cd.onclick=function(){try{navigator.clipboard.writeText(dir)}catch(e){}cd.textContent='\u2713 Copied';setTimeout(function(){if($('sasCopyDir'))cd.textContent='Copy path'},1400)}}
  if($('sasDlAll'))$('sasDlAll').onclick=function(){var b=$('sasDlAll');b.disabled=true;var o=b.innerHTML;b.innerHTML='Saving\u2026';var n=shown.length,done=0,dir=null;shown.forEach(function(x){bridge.send('/sas-download',{name:x.name}).then(function(r){done++;if(r&&r.dir)dir=r.dir;if(done===n){b.disabled=false;b.innerHTML=o;sasShowDl(dir,'Saved '+n+' file'+(n===1?'':'s')+' to')}})})};
  Array.prototype.forEach.call(el.querySelectorAll('[data-sasdl]'),function(btn){btn.onclick=function(){var nm=btn.getAttribute('data-sasdl');bridge.send('/sas-download',{name:nm}).then(function(r){if(r&&r.ok){sasShowDl(r.dir,'Saved '+nm+' to')}else{sasShowDl(null,'Download failed'+(r&&r.error?': '+r.error:''))}})}});
  Array.prototype.forEach.call(el.querySelectorAll('[data-sasopen]'),function(btn){btn.onclick=function(){var u=urlMap[btn.getAttribute('data-sasopen')];if(u){try{window.open(u,'_blank')}catch(e){}}}});
  Array.prototype.forEach.call(el.querySelectorAll('[data-sascopy]'),function(btn){btn.onclick=function(){var u=urlMap[btn.getAttribute('data-sascopy')];if(!u)return;try{navigator.clipboard.writeText(u)}catch(e){}var o=btn.innerHTML;btn.innerHTML=SAS_CHECK;setTimeout(function(){btn.innerHTML=o},1300)}});
}
function renderTransfer(){
  var el=$('transfer');var t=state.s_transfer;
  if(!t){
    if(state.s_transferErr){el.innerHTML='<div class="xerr"><span class="xerr-ic">\u26A0</span><div><b>Transfer plan failed</b><div class="xerr-msg">'+esc(state.s_transferErr)+'</div></div></div>';return}
    el.innerHTML='';return}
  var p=t.plan;
  var conflictHi=p.conflictCount>0;
  var h='<div class="xplan">';
  h+='<div class="xroute"><span class="xep xep-src" title="Source"><span class="xep-ic">'+CONTAINER_IC+'</span><span class="xep-t">'+esc(t.sourceLabel)+'</span></span>';
  h+='<span class="xarrow">'+MOVE_ARROW+'</span>';
  h+='<span class="xep xep-dst" title="Destination"><span class="xep-ic">'+CONTAINER_IC+'</span><span class="xep-t">'+esc(t.destLabel)+'</span></span>';
  h+='<span class="xpolicy xpol-'+esc(p.resolution)+'">'+POLICY_IC+esc(p.resolution)+'</span></div>';
  h+='<div class="xmetrics">';
  h+='<div class="xmetric xm-accent"><div class="xm-v">'+p.transferCount+'</div><div class="xm-l">To transfer</div></div>';
  h+='<div class="xmetric"><div class="xm-v">'+esc(p.transferBytesh)+'</div><div class="xm-l">Total size</div></div>';
  h+='<div class="xmetric '+(conflictHi?'xm-warn':'')+'"><div class="xm-v">'+p.conflictCount+'</div><div class="xm-l">Conflicts</div></div>';
  h+='<div class="xmetric xm-ok"><div class="xm-v">'+p.newCount+'</div><div class="xm-l">New</div></div>';
  h+='<div class="xmetric"><div class="xm-v">'+p.skippedCount+'</div><div class="xm-l">Skipped</div></div>';
  h+='</div>';
  h+='<div class="xsub">'+esc(t.source)+' at source <span class="xdot">\xB7</span> '+p.destCount+' blob'+(p.destCount===1?'':'s')+' at destination</div>';
  var newerN=Math.max(0,p.transferCount-p.newCount);var keptN=Math.max(0,p.conflictCount-newerN);var pe='';var pcls='';
  if(p.resolution==='overwrite'){pcls='pe-ow';pe='<b>Overwrite:</b> all '+p.newCount+' new blob'+(p.newCount===1?'':'s')+' plus all '+p.conflictCount+' existing (conflicting) blob'+(p.conflictCount===1?'':'s')+' will be re-uploaded, replacing the destination copies. Nothing is skipped.'}
  else if(p.resolution==='skip'){pcls='pe-skip';pe='<b>Skip existing:</b> only the '+p.newCount+' new blob'+(p.newCount===1?'':'s')+' transfer'+(p.newCount===1?'s':'')+'. The '+p.conflictCount+' blob'+(p.conflictCount===1?'':'s')+' that already exist at the destination are left untouched.'}
  else{pcls='pe-ifn';pe='<b>If source newer:</b> new blobs always transfer; a conflicting blob transfers only if the source copy is newer than the destination. Here '+newerN+' of '+p.conflictCount+' '+(newerN===1?'is':'are')+' newer (will replace), and '+keptN+' '+(keptN===1?'is':'are')+' not newer (kept). '+(newerN===0?'That is why the totals match <b>Skip</b> for this data.':'')}
  h+='<div class="xexplain '+pcls+'">'+POLICY_IC+'<span>'+pe+'</span></div>';
  h+='</div>';
  if(p.conflicts&&p.conflicts.length){
    var actLabel=p.resolution==='overwrite'?'Overwrite':(p.resolution==='skip'?'Skip':'If newer');
    var actCls=p.resolution==='overwrite'?'act-ow':(p.resolution==='skip'?'act-skip':'act-ifn');
    h+='<div class="xconf"><div class="xconf-h"><span class="xconf-badge">'+p.conflictCount+'</span> conflicting blob'+(p.conflictCount===1?'':'s')+', resolved by <b>'+esc(p.resolution)+'</b></div>';
    h+='<table class="xtbl"><thead><tr><th>Name</th><th>Source size</th><th>Modified</th><th>Action</th></tr></thead><tbody>';
    h+=p.conflicts.map(function(c){var mod=c.lastModified?String(c.lastModified).slice(0,10):'\xB7';return '<tr><td class="fname">'+esc(c.name)+'</td><td>'+esc(c.sizeh)+'</td><td class="muted">'+esc(mod)+'</td><td><span class="xact '+actCls+'">'+actLabel+'</span></td></tr>'}).join('');
    h+='</tbody></table></div>';
  }
  h+='<div class="xcmd-card"><div class="xcmd-head"><span class="xcmd-title">'+TERM_IC+'AzCopy command</span>'+(t.needsLogin?'<span class="xchip xchip-warn" title="an endpoint has no SAS token">'+LOCK_IC+'Sign-in required</span>':'<span class="xchip xchip-ok">'+CHECK_IC+'Ready to run</span>')+'<button class="xcopy" id="xcopyBtn">'+COPY_IC+'Copy</button></div>';
  h+='<pre class="xcmd" id="xcmd">'+esc(t.command)+'</pre>';
  if(t.needsLogin)h+='<div class="xnote">'+INFO_IC+'<span>One endpoint has no SAS token. Run <code>azcopy login</code> first, or use a destination <b>SAS URL</b> so no sign-in is needed. Nothing moves until you run this command.</span></div>';
  else h+='<div class="xnote">'+INFO_IC+'<span>Copy and run in your terminal. Nothing moves until you run it.</span></div>';
  if(t.azcopy&&t.azcopy.installed)h+='<div class="xnote">'+CHECK_IC+'<span>AzCopy '+esc(t.azcopy.version||'')+' detected on your PATH.</span></div>';
  else if(t.azcopy)h+='<div class="xnote xnote-warn">'+LOCK_IC+'<span>'+esc(t.azcopy.hint||'AzCopy is required to run this command.')+' Install it from <a href="https://aka.ms/downloadazcopy" target="_blank" rel="noopener">aka.ms/downloadazcopy</a>, then re-open the plan.</span></div>';
  h+='</div>';
  el.innerHTML=h;
  if($('xcopyBtn'))$('xcopyBtn').onclick=function(){var txt=t.command;if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(txt)}else{var r=document.createRange();r.selectNode($('xcmd'));var s=window.getSelection();s.removeAllRanges();s.addRange(r);try{document.execCommand('copy')}catch(e){}}$('xcopyBtn').textContent='Copied \u2713';setTimeout(function(){if($('xcopyBtn'))$('xcopyBtn').textContent='Copy command'},1500)};
}
var ASK_AV='<svg viewBox="0 0 24 24" width="16" height="16" fill="#fff" aria-hidden="true"><path d="M12 2l1.7 4.8L18.5 8.5 13.7 10.2 12 15l-1.7-4.8L5.5 8.5l4.8-1.7z"/><path d="M18.5 13l.95 2.6 2.55.9-2.55.9-.95 2.6-.95-2.6-2.55-.9 2.55-.9z"/></svg>';
var ASK_SPARK='<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M12 3l1.4 4L17 8.4l-3.6 1.4L12 14l-1.4-4.2L7 8.4l3.6-1.4z"/></svg>';
function doAsk(q){q=(q||'').trim();if(!q)return;var inp=$('askIn');if(inp)inp.value=q;bridge.send('/ask',{question:q})}
function askSuggestions(){
  var k=state.s_kind,item=state.s_item,acct=state.s_account;
  if(k==='blob'&&item)return ['What is taking up the most space here?','Find blobs I can clean up','Which blobs are the biggest?','Any old or stale blobs?','Break these blobs down by type'];
  if(acct)return ['Which container is the largest?','How many blobs are in this account?','Summarize this storage account'];
  return ['What can I ask here?','How do I choose a container to explore?'];
}
function renderAskChips(){
  var el=$('askChips');if(!el)return;
  var s=askSuggestions();
  el.innerHTML='<span class="askchip-lbl">Try</span>'+s.map(function(q){return '<button class="askchip" data-q="'+esc(q)+'">'+ASK_SPARK+'<span>'+esc(q)+'</span></button>'}).join('');
  Array.prototype.forEach.call(el.querySelectorAll('.askchip'),function(b){b.onclick=function(){doAsk(b.getAttribute('data-q'))}});
}
function renderAsk(){
  var el=$('askOut');var a=state.s_ask;if(!a){el.innerHTML='';return}
  var h='';
  if(a.question)h+='<div class="ask-q"><div class="ask-qtext">'+esc(a.question)+'</div></div>';
  if(a.pending){el.innerHTML=h+'<div class="ask-a"><span class="ask-av">'+ASK_AV+'</span><div class="ask-abody"><span class="muted"><span class="spin"></span> Reading your live storage\u2026</span></div></div>';return}
  h+='<div class="ask-a"><span class="ask-av">'+ASK_AV+'</span><div class="ask-abody"><div class="ask-atext">'+mdInline(a.answer)+'</div>'+visualHtml(a.visual)+'</div></div>';
  el.innerHTML=h;
}
function renderLog(){var el=$('log');var lines=(state.activityLog||[]);el.textContent=lines.slice(-40).join('\\n');el.scrollTop=el.scrollHeight;var b=$('logCount');if(b)b.textContent=lines.length+(lines.length===1?' entry':' entries')}
var MOVE_ARROW='<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 8h11"/><path d="M9.5 4l4 4-4 4"/></svg>';
var CONTAINER_IC='<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M8 1.6l5.5 3v6.8L8 14.4 2.5 11.4V4.6z"/><path d="M2.6 4.7L8 7.7l5.4-3"/><path d="M8 7.7v6.6"/></svg>';
var POLICY_IC='<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px"><path d="M8 1.7l5.6 2.1v3.4c0 3.4-2.3 5.8-5.6 6.9C4.7 13 2.4 10.6 2.4 7.2V3.8z"/></svg>';
var TERM_IC='<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px"><rect x="1.6" y="2.6" width="12.8" height="10.8" rx="1.6"/><path d="M4.4 6l2.2 2-2.2 2"/><path d="M8.4 10.2h3"/></svg>';
var COPY_IC='<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" style="margin-right:5px"><rect x="5.4" y="5.4" width="8.2" height="8.2" rx="1.4"/><path d="M10.6 5.4V3.8a1.4 1.4 0 0 0-1.4-1.4H3.8a1.4 1.4 0 0 0-1.4 1.4v5.4a1.4 1.4 0 0 0 1.4 1.4h1.6"/></svg>';
var LOCK_IC='<svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px"><rect x="3.4" y="7" width="9.2" height="6.6" rx="1.3"/><path d="M5.2 7V5a2.8 2.8 0 0 1 5.6 0v2"/></svg>';
var CHECK_IC='<svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px"><path d="M3 8.4l3 3 7-7"/></svg>';
var INFO_IC='<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="flex:0 0 auto;margin-top:1px"><circle cx="8" cy="8" r="6.4"/><path d="M8 7.4v3.4"/><path d="M8 5.2h.01"/></svg>';

Array.prototype.forEach.call(document.querySelectorAll('.card-head'),function(head){
  head.onclick=function(){head.parentNode.classList.toggle('min')};
});

var CHEV_LEFT='<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3.5 3.5 8 8 12.5"/><path d="M13 3.5 8.5 8 13 12.5"/></svg>';
var CHEV_RIGHT='<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3.5 12.5 8 8 12.5"/><path d="M3 3.5 7.5 8 3 12.5"/></svg>';
function expandSide(){var side=$('side'),shell=$('shell');side.classList.remove('collapsed');shell.classList.remove('collapsed');$('sideToggle').innerHTML=CHEV_LEFT;renderCtx()}
function scrollToTreeTarget(kind){
  setTimeout(function(){
    var sel=kind==='account'?'[data-acct="'+state.s_account+'"]':'[data-cat="'+kind+'"]';
    var r=document.querySelector(sel);if(r)r.scrollIntoView({block:'nearest'});
  },80);
}
// rail icon \u2192 jump straight to that service for the active account (not just expand)
function railGo(kind){
  expandSide();
  var acct=state.s_account;
  if(!acct){
    // no account opened yet \u2014 reveal the subscription/account list so the user can pick one
    (state.s_selectedSubs||[]).forEach(function(s){openSubs[s]=true});
    (state.s_accounts||[]).forEach(function(x){openSubs[x.subscriptionName||'(no subscription)']=true});
    renderTree();return;
  }
  var entry=null;(state.s_accounts||[]).forEach(function(x){if(x.name===acct)entry=x});
  if(entry)openSubs[entry.subscriptionName||'(no subscription)']=true;
  openAccts[acct]=true;
  if(kind!=='account'){
    openCat[acct+'|'+kind]=true;
    if(kind==='file')bridge.send('/list-shares',{account:acct});
    else if(kind==='queue')bridge.send('/list-queues',{account:acct});
    else if(kind==='table')bridge.send('/list-tables',{account:acct});
  }
  renderTree();
  scrollToTreeTarget(kind);
}
$('sideToggle').onclick=function(){
  var side=$('side'),shell=$('shell');
  side.classList.toggle('collapsed');shell.classList.toggle('collapsed');
  $('sideToggle').innerHTML=side.classList.contains('collapsed')?CHEV_RIGHT:CHEV_LEFT;
  renderCtx();
};
(function buildRail(){
  var r=$('sideRail');if(!r)return;
  var h='<button class="railbtn" data-rail="key" title="Subscriptions"><span class="rk">\u{1F511}</span></button>';
  h+='<div class="rail-sep"></div>';
  h+='<button class="railbtn" data-rail="account" title="Storage accounts">'+svgIcon('account')+'</button>';
  h+='<button class="railbtn" data-rail="blob" title="Blob containers">'+svgIcon('blob')+'</button>';
  h+='<button class="railbtn" data-rail="file" title="File shares">'+svgIcon('file')+'</button>';
  h+='<button class="railbtn" data-rail="queue" title="Queues">'+svgIcon('queue')+'</button>';
  h+='<button class="railbtn" data-rail="table" title="Tables">'+svgIcon('table')+'</button>';
  h+='<div class="rail-sep"></div>';
  h+='<button class="railbtn" data-rail="search" title="Search accounts"><span class="rk"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="6.8" cy="6.8" r="4.3"/><path d="M13 13 9.9 9.9"/></svg></span></button>';
  h+='<button class="railbtn" data-rail="refresh" title="Refresh subscriptions"><span class="rk">\u27F3</span></button>';
  r.innerHTML=h;
  Array.prototype.forEach.call(r.querySelectorAll('[data-rail]'),function(b){b.onclick=function(){
    var kind=b.getAttribute('data-rail');
    if(kind==='refresh'){expandSide();bridge.send('/load-subscriptions',{});return}
    if(kind==='key'){expandSide();openPicker();return}
    if(kind==='search'){expandSide();setTimeout(function(){var s=$('treeSearch');if(s)s.focus()},0);return}
    railGo(kind);
  }});
})();
$('refreshBtn').onclick=function(){bridge.send('/load-subscriptions',{})};
$('treeSearch').oninput=function(){treeQuery=$('treeSearch').value;renderTree()};

function openPicker(){
  pickOpen=true;pickQuery='';
  pickSel=new Set(state.s_selectedSubs||[]);
  $('pickSearch').value='';
  $('pickerOverlay').classList.add('open');
  if(!(state.s_subscriptions||[]).length&&!state.s_subsLoading){bridge.send('/load-subscriptions',{})}
  renderPicker();$('pickSearch').focus();
}
function closePicker(){pickOpen=false;$('pickerOverlay').classList.remove('open')}
function renderPicker(){
  var subs=state.s_subscriptions||[];
  $('pickCount').textContent=subs.length?subs.length+' subscriptions':'';
  var q=pickQuery.toLowerCase();
  var list=$('pickList');
  if(state.s_subsLoading&&!subs.length){list.innerHTML='<div class="empty"><span class="spin"></span> Loading subscriptions\u2026</div>'}
  else if(!subs.length){list.innerHTML='<div class="empty">No subscriptions found.</div>'}
  else{
    var shown=subs.filter(function(s){if(!q)return true;return (s.displayName||'').toLowerCase().indexOf(q)>=0||(s.subscriptionId||'').toLowerCase().indexOf(q)>=0});
    if(!shown.length){list.innerHTML='<div class="empty">No subscriptions match.</div>'}
    else{
      list.innerHTML=shown.map(function(s){var on=pickSel.has(s.subscriptionId);return '<label class="subrow'+(on?' on':'')+'" data-sub="'+esc(s.subscriptionId)+'"><input type="checkbox"'+(on?' checked':'')+'><span class="info"><span class="nm">'+esc(s.displayName||s.subscriptionId)+'</span><span class="id">'+esc(s.subscriptionId)+'</span></span></label>'}).join('');
      Array.prototype.forEach.call(list.querySelectorAll('[data-sub]'),function(r){r.onclick=function(e){e.preventDefault();var id=r.getAttribute('data-sub');if(pickSel.has(id))pickSel.delete(id);else pickSel.add(id);renderPicker()}});
    }
  }
  $('pickSelected').textContent=pickSel.size+' selected';
  $('pickApply').disabled=!pickSel.size;
}
$('scopeChip').onclick=openPicker;
$('scopeChange').onclick=openPicker;
$('pickClose').onclick=closePicker;
$('pickCancel').onclick=closePicker;
$('pickClear').onclick=function(){pickSel.clear();renderPicker()};
$('pickSearch').oninput=function(){pickQuery=$('pickSearch').value;renderPicker()};
$('pickApply').onclick=function(){if(!pickSel.size)return;bridge.send('/select-subscriptions',{subscriptionIds:Array.from(pickSel)});closePicker()};
$('pickerOverlay').onclick=function(e){if(e.target===$('pickerOverlay'))closePicker()};
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&pickOpen)closePicker()});

// \u2500\u2500 confirm / prompt dialog (guards every mutation) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
var cfResolve=null;
function askConfirm(opts){
  return new Promise(function(resolve){
    cfResolve=resolve;
    $('cfTitle').textContent=opts.title||'Confirm';
    $('cfMsg').textContent=opts.msg||'';
    $('cfInputWrap').style.display=opts.input?'':'none';
    $('cfInput').value=opts.value||'';
    $('cfInput').rows=opts.rows||1;
    $('cfOk').textContent=opts.okLabel||'OK';
    $('cfOk').className=opts.danger?'danger':'primary';
    $('confirmOverlay').classList.add('open');
    if(opts.input)setTimeout(function(){$('cfInput').focus();$('cfInput').select()},0);
  });
}
function cfClose(val){$('confirmOverlay').classList.remove('open');var r=cfResolve;cfResolve=null;if(r)r(val)}
$('cfCancel').onclick=function(){cfClose(null)};
$('cfOk').onclick=function(){cfClose($('cfInputWrap').style.display==='none'?true:$('cfInput').value)};
$('cfInput').onkeydown=function(e){if(e.key==='Enter'&&e.metaKey===false&&$('cfInput').rows==1){e.preventDefault();$('cfOk').click()}if(e.key==='Escape')cfClose(null)};
$('confirmOverlay').onclick=function(e){if(e.target===$('confirmOverlay'))cfClose(null)};

// \u2500\u2500 Table entity form (friendly, no raw JSON) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function entPropRow(name,type,val){
  var opt=function(t){return '<option'+(type===t?' selected':'')+'>'+t+'</option>'};
  return '<div class="entrow"><input class="epn" placeholder="property name" value="'+esc(name||'')+'"><select class="ept">'+opt('String')+opt('Number')+opt('Boolean')+'</select><input class="epv" placeholder="value" value="'+esc(val==null?'':String(val))+'"><button class="rowact del epx" title="Remove">\u2715</button></div>';
}
function entInferType(v){if(typeof v==='boolean')return 'Boolean';if(typeof v==='number')return 'Number';return 'String'}
function entAddPropRow(name,type,val){
  var wrap=document.createElement('div');wrap.innerHTML=entPropRow(name,type,val);var node=wrap.firstChild;
  $('entProps').appendChild(node);
  node.querySelector('.epx').onclick=function(){node.remove()};
}
function openEntityForm(existing){
  $('entTitle').textContent=existing?'Edit entity':'Add entity';
  $('entErr').textContent='';
  $('entPK').value=existing?(existing.partitionKey||''):'';
  $('entRK').value=existing?(existing.rowKey||''):'';
  $('entPK').readOnly=!!existing;$('entRK').readOnly=!!existing;
  $('entProps').innerHTML='';
  if(existing){Object.keys(existing).forEach(function(key){if(key==='partitionKey'||key==='rowKey'||key==='timestamp'||key==='etag'||key.indexOf('odata.')===0)return;entAddPropRow(key,entInferType(existing[key]),existing[key])})}
  if(!$('entProps').children.length)entAddPropRow('','String','');
  $('entityOverlay').classList.add('open');
  setTimeout(function(){$(existing?'entProps':'entPK').focus()},0);
}
function closeEntityForm(){$('entityOverlay').classList.remove('open')}
function saveEntityForm(){
  var pk=$('entPK').value.trim(),rk=$('entRK').value.trim();
  if(!pk||!rk){$('entErr').textContent='PartitionKey and RowKey are required.';return}
  var ent={partitionKey:pk,rowKey:rk};var bad='';
  Array.prototype.forEach.call($('entProps').querySelectorAll('.entrow'),function(r){
    var n=r.querySelector('.epn').value.trim();if(!n)return;
    if(n==='partitionKey'||n==='rowKey')return;
    var t=r.querySelector('.ept').value,raw=r.querySelector('.epv').value,v;
    if(t==='Number'){if(raw===''){v=0}else{v=Number(raw);if(isNaN(v)){bad=n;return}}}
    else if(t==='Boolean'){v=(raw==='true'||raw==='True'||raw==='1')}
    else{v=raw}
    ent[n]=v;
  });
  if(bad){$('entErr').textContent='Property "'+bad+'" is not a valid number.';return}
  bridge.send('/entity-upsert',{table:state.s_item,entity:ent});
  closeEntityForm();
}
$('entAddProp').onclick=function(){entAddPropRow('','String','')};
$('entCancel').onclick=closeEntityForm;
$('entClose').onclick=closeEntityForm;
$('entSave').onclick=saveEntityForm;
$('entityOverlay').onclick=function(e){if(e.target===$('entityOverlay'))closeEntityForm()};

// \u2500\u2500 SAS generator (create a shareable, time-limited SAS for a blob or container) \u2500
var sasGenName=null;var sasGenContainer=null;var sasScope='blob';var sasGenMinutes=1440;
function sasResetCommon(){
  sasGenMinutes=1440;
  Array.prototype.forEach.call(document.querySelectorAll('.sgchip'),function(c){c.classList.toggle('active',c.getAttribute('data-min')==='1440')});
  $('sgResult').style.display='none';$('sgResult').innerHTML='';
  $('sgErr').textContent='';$('sgGo').disabled=false;$('sgGo').textContent='Generate link';
  $('sasOverlay').classList.add('open');
}
function openSasGen(name){
  sasScope='blob';sasGenName=name;
  $('sgTitle').textContent='\u{1F517} Create SAS link';
  $('sgSub').textContent='A secure, time-limited URL for the blob "'+name+'". No Azure login needed to use it.';
  $('sgpLwrap').style.display='none';$('sgpL').checked=false;
  $('sgpR').checked=true;$('sgpW').checked=false;$('sgpD').checked=false;
  sasResetCommon();
}
function openContainerSas(){
  var c=state.s_container;if(!c)return;
  sasScope='container';sasGenContainer=c;
  $('sgTitle').textContent='\u{1F517} Share container (SAS)';
  $('sgSub').textContent='A secure, time-limited URL to browse & download everything in the container "'+c+'". Share it, or paste it into the Instant SAS tab / Storage Explorer.';
  $('sgpLwrap').style.display='';$('sgpL').checked=true;
  $('sgpR').checked=true;$('sgpW').checked=false;$('sgpD').checked=false;
  sasResetCommon();
}
function closeSasGen(){$('sasOverlay').classList.remove('open')}
Array.prototype.forEach.call(document.querySelectorAll('.sgchip'),function(c){c.onclick=function(){Array.prototype.forEach.call(document.querySelectorAll('.sgchip'),function(x){x.classList.remove('active')});c.classList.add('active');sasGenMinutes=Number(c.getAttribute('data-min'))||1440}});
$('sgGo').onclick=function(){
  var isC=sasScope==='container';
  var perms=($('sgpR').checked?'r':'')+((isC&&$('sgpL').checked)?'l':'')+($('sgpW').checked?'w':'')+($('sgpD').checked?'d':'');
  if(!perms){$('sgErr').textContent='Pick at least one permission.';return}
  $('sgErr').textContent='';var b=$('sgGo');b.disabled=true;b.textContent='Generating\u2026';
  var route=isC?'/generate-container-sas':'/generate-sas';
  var payload=isC?{container:sasGenContainer,minutes:sasGenMinutes,permissions:perms}:{name:sasGenName,minutes:sasGenMinutes,permissions:perms};
  bridge.send(route,payload).then(function(r){
    b.disabled=false;b.textContent='Generate link';
    if(!r||!r.ok){$('sgErr').textContent='Failed: '+((r&&r.error)||'unknown error');return}
    var exp=r.expiresOn?new Date(r.expiresOn).toLocaleString():'';
    var modeTxt=r.mode==='user-delegation'?'User delegation (AAD)':'Account key';
    var scopeTxt=isC?'Container':'Blob';
    var res=$('sgResult');res.style.display='';
    res.innerHTML='<div class="sgok">\u2713 SAS ready<span class="sgbadge">'+scopeTxt+'</span><span class="sgbadge">expires '+esc(exp)+'</span><span class="sgbadge">'+esc(modeTxt)+'</span></div><textarea id="sgUrl" class="sgurl" readonly rows="3"></textarea><div class="flex" style="gap:8px;margin-top:9px"><button class="primary" id="sgCopy">\u{1F4CB} Copy link</button><button class="ghost" id="sgOpen">\u2197 Open</button></div>';
    var u=$('sgUrl');u.value=r.url;setTimeout(function(){u.focus();u.select()},0);
    $('sgCopy').onclick=function(){try{navigator.clipboard.writeText(r.url)}catch(e){}var cb=$('sgCopy');cb.textContent='\u2713 Copied';setTimeout(function(){if($('sgCopy'))cb.textContent='\u{1F4CB} Copy link'},1400)};
    $('sgOpen').onclick=function(){var ou=r.url;if(isC)ou=r.url+'&restype=container&comp=list';window.open(ou,'_blank')};
  });
};
$('sgCancel').onclick=closeSasGen;
$('sgClose').onclick=closeSasGen;
$('sasOverlay').onclick=function(e){if(e.target===$('sasOverlay'))closeSasGen()};

// category \uFF0B create (Blob Containers / File Shares / Queues / Tables)
function createInCategory(kind,account){
  account=account||state.s_account;if(!account)return;
  var label=kind==='blob'?'blob container':kind==='queue'?'queue':kind==='table'?'table':'file share';
  askConfirm({title:'New '+label,msg:'Name for the new '+label+':',input:true,okLabel:'Create'}).then(function(name){
    name=(name||'').trim();if(!name)return;
    openCat[account+'|'+kind]=true;
    if(kind==='blob')bridge.send('/container-create',{container:name,account:account});
    else if(kind==='queue')bridge.send('/queue-create',{queue:name,account:account});
    else if(kind==='table')bridge.send('/table-create',{table:name,account:account});
    else bridge.send('/share-create',{share:name,account:account});
  });
}
// item \u{1F5D1} delete (category leaf)
function deleteItem(kind,name,account){
  account=account||state.s_account;
  var label=kind==='blob'?'container':kind==='queue'?'queue':kind==='table'?'table':'file share';
  askConfirm({title:'Delete '+label,msg:'Permanently delete '+label+' "'+name+'"? This cannot be undone.',okLabel:'Delete',danger:true}).then(function(ok){
    if(!ok)return;
    if(kind==='blob')bridge.send('/container-delete',{container:name,account:account});
    else if(kind==='queue')bridge.send('/queue-delete',{queue:name,account:account});
    else if(kind==='table')bridge.send('/table-delete',{table:name,account:account});
    else bridge.send('/share-delete',{share:name,account:account});
  });
}

function containerOpen(){return state.s_kind==='blob'&&!!state.s_container}
function cubeIc(){return '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="#4fc3f0" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round" style="vertical-align:-2px;margin-right:3px"><path d="M8 1.9 13.5 5.05v5.9L8 14.1 2.5 10.95v-5.9z"/><path d="M2.5 5.05 8 8.2l5.5-3.15M8 8.2v5.9"/></svg>'}
function acctIc(){return '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="#c7d0dc" stroke-width="1.25" stroke-linejoin="round" stroke-linecap="round" style="vertical-align:-3px;margin-right:5px"><ellipse cx="8" cy="4" rx="5" ry="2"/><path d="M3 4v8c0 1.05 2.24 1.9 5 1.9s5-.85 5-1.9V4"/><path d="M3 8c0 1.05 2.24 1.9 5 1.9s5-.85 5-1.9"/></svg>'}
function needContainerHint(){$('stats').innerHTML='<div class="empty">'+cubeIc()+'Open a container first. Pick one from the tree on the left, then Filter its blobs.</div>'}
$('filterBtn').onclick=function(){
  if(!containerOpen()){needContainerHint();return}
  var crit={namePattern:$('fName').value,minSize:$('fMin').value,maxSize:$('fMax').value,olderThanDays:$('fOlder').value,newerThanDays:$('fNewer').value,type:$('fType').value,tiers:$('fTier').value,blobTypes:$('fBlobType').value};
  var tag=$('fTag').value.trim();
  if(tag){var eq=tag.indexOf('=');if(eq>-1){var o={};o[tag.slice(0,eq).trim()]=tag.slice(eq+1).trim();crit.tags=o}else{crit.tagKeys=tag}}
  bridge.send('/filter',crit);
};
function syncFilterForm(f){
  f=f||{};
  function setV(id,v){var e=$(id);if(e)e.value=(v==null?'':String(v))}
  setV('fName',f.namePattern);
  setV('fMin',f.minSize);
  setV('fMax',f.maxSize);
  setV('fOlder',f.olderThanDays);
  setV('fNewer',f.newerThanDays);
  setV('fType',f.type||'all');
  setV('fTier',f.tiers?[].concat(f.tiers)[0]:'');
  var card=document.querySelector('[data-card="stats"]');if(card&&card.classList.contains('min'))card.classList.remove('min');
}
$('dlFilteredBtn').onclick=function(){if(!containerOpen()){needContainerHint();return}bridge.send('/download-filtered',{})};
function filteredCount(){return (state.s_filtered||[]).length}
function cleanupSummary(){var n=filteredCount();var sz=(state.s_stats&&state.s_stats.totalh)?state.s_stats.totalh:'';return n+' matched blob'+(n===1?'':'s')+(sz?' ('+sz+')':'')}
function needMatchedHint(){$('stats').innerHTML='<div class="empty">Click <b>Filter</b> first so there is a matched set to clean up.</div>'}
$('archiveFilteredBtn').onclick=function(){if(!containerOpen()){needContainerHint();return}if(!filteredCount()){needMatchedHint();return}askConfirm({title:'Move to Archive tier',msg:'Move '+cleanupSummary()+' to the Archive tier? This cuts storage cost and is reversible, you can rehydrate anytime.',okLabel:'Move to Archive'}).then(function(ok){if(ok)bridge.send('/cleanup-filtered',{action:'archive'})})};
$('deleteFilteredBtn').onclick=function(){if(!containerOpen()){needContainerHint();return}if(!filteredCount()){needMatchedHint();return}askConfirm({title:'Permanently delete matched blobs',msg:'Permanently delete '+cleanupSummary()+'? This cannot be undone.',okLabel:'Delete',danger:true}).then(function(ok){if(ok)bridge.send('/cleanup-filtered',{action:'delete'})})};
$('insightBtn').onclick=function(){if(!containerOpen()){needContainerHint();return}if(!state.s_stats){$('stats').innerHTML='<div class="empty">Click <b>Filter</b> first so there are statistics for Copilot to explain.</div>';return}bridge.send('/insights',{})};
$('sasBtn').onclick=function(){bridge.send('/sas-connect',{url:$('sasIn').value})};
function xShowErr(msg){state.s_transferErr=msg;state.s_transfer=null;renderTransfer();var e=$('transfer');if(e){var box=e.querySelector('.xerr');(box||e).scrollIntoView({behavior:'smooth',block:'center'})}}
$('xplanBtn').onclick=function(){
  var isPick=xDestMode==='pick';
  var dest;
  if(isPick){
    if(!xDestAcct||!xDestCont){xShowErr('Pick a destination account and container, or switch to '+String.fromCharCode(39)+'Paste path / SAS URL'+String.fromCharCode(39)+'.');return}
    dest=xDestAcct+'/'+xDestCont;
  }else{
    dest=($('xdest').value||'').trim();
    var isSas=/[?&]sig=/.test(dest);
    if(!isSas)dest=dest.split('/').map(function(s){return s.trim()}).filter(function(s){return s}).join('/');
  }
  var isSas2=/[?&]sig=/.test(dest);
  if(!state.s_account){xShowErr('Open a storage account first. Pick one in the Explorer on the left.');return}
  if(!xSourceCont){xShowErr('Choose a source container from the Source dropdown.');return}
  if(!dest){xShowErr('Enter a destination: '+String.fromCharCode(39)+'account/container'+String.fromCharCode(39)+' (e.g. '+esc(state.s_account||'myaccount')+'/backups) or a container SAS URL.');if(!isPick)$('xdest').focus();return}
  if(!isPick&&!isSas2&&dest.replace('https://','').replace('http://','').split('/').filter(function(x){return x}).length<2){xShowErr('Destination must be '+String.fromCharCode(39)+'account/container'+String.fromCharCode(39)+', not just '+String.fromCharCode(39)+dest+String.fromCharCode(39)+'. Try '+esc(state.s_account||'myaccount')+'/'+dest+', or paste a container SAS URL.');$('xdest').focus();return}
  var res='overwrite';Array.prototype.forEach.call(document.getElementsByName('xres'),function(r){if(r.checked)res=r.value});
  state.s_transferErr=null;state.s_error=null;renderError();$('transfer').innerHTML='<div class="empty"><span class="spin"></span> Planning transfer\u2026</div>';
  $('transfer').scrollIntoView({behavior:'smooth',block:'center'});
  var p=bridge.send('/transfer-plan',{dest:dest,resolution:res,useFiltered:$('xfiltered').checked,source:xSourceCont});
  if(p&&p.then)p.then(function(r){if(r&&r.ok===false)xShowErr(r.error||'Transfer plan failed.')});
};
$('askBtn').onclick=function(){doAsk($('askIn').value)};
$('askIn').onkeydown=function(e){if(e.key==='Enter'){doAsk($('askIn').value)}};
// Rotate inviting example questions through the Ask placeholder (idle only, so we
// never interrupt typing). Kept apostrophe- and dash-free on purpose.
(function(){
  var inp=$('askIn');if(!inp)return;
  var phs=['What is taking up the most space?','Which containers are the largest?','Show me my biggest blobs','How much am I storing in total?','What can I clean up to save money?','Which account is growing the fastest?'];
  var i=0;
  setInterval(function(){
    if(document.activeElement===inp||inp.value)return;
    i=(i+1)%phs.length;
    inp.classList.add('ph-dim');
    setTimeout(function(){inp.setAttribute('placeholder',phs[i]);inp.classList.remove('ph-dim')},220);
  },3600);
})();
// Fold Filter & statistics and Transfer planning into the container hub tabs.
// Moving DOM nodes preserves their already-wired event handlers.
(function(){
  var sf=document.querySelector('[data-card="stats"]');
  var hf=$('hubFilter'),hs=$('hubShare');
  if(sf&&hf){var sb=sf.querySelector('.card-body');while(sb&&sb.firstChild)hf.appendChild(sb.firstChild);sf.style.display='none'}
  if(hs){hs.innerHTML='<div class="hubshare"><div class="hs-lead">Create a secure, time-limited <b>SAS link</b> for this entire container. Anyone with the link gets the permissions you choose, until it expires. No Azure sign-in required. To share just one file, use the <b>Browse</b> tab.</div><button class="primary" id="hubSasBtn"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:6px"><path d="M9.5 14.5l5-5"/><path d="M8 12l-2 2a3 3 0 0 0 4.2 4.2l2-2"/><path d="M16 12l2-2a3 3 0 0 0-4.2-4.2l-2 2"/></svg> Create container SAS link</button></div>';var hb=$('hubSasBtn');if(hb)hb.onclick=function(){openContainerSas()}}
})();
render();
`,FEEDBACK_BASE="https://github.com/microsoft/azure-dev-tools/issues/new";function buildFeedbackUrl(info){let title="Azure Storage canvas feedback",body=`Product: Azure Storage
Canvas: azure-storage
Version: `+info.version+`
Revision: `+info.revision+`

## Feedback

`;return(FEEDBACK_BASE+"?title="+encodeURIComponent(title)+"&body="+encodeURIComponent(body)).replace(/&/g,"&amp;")}function escAttr(s){return String(s??"").replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}var FOOTER_HTML='<footer class="footer-meta"><span class="build-stamp">Azure Storage canvas <span class="bs-ver">v'+escAttr(BUILD_INFO.version)+'</span> <span class="bs-rev">rev '+escAttr(BUILD_INFO.revision)+'</span></span><a class="feedback-link" href="'+buildFeedbackUrl(BUILD_INFO)+'" target="_blank" rel="noopener noreferrer">Send feedback</a></footer>',BODY_WITH_FOOTER=BODY.replace("<!--FOOTER-->",FOOTER_HTML);function pageHtml(nonce){let n=nonce?' nonce="'+nonce+'"':"";return'<!doctype html><html><head><meta charset="utf-8"><meta name="color-scheme" content="light dark"><title>Azure Storage</title><style>'+CSS+"</style></head><body>"+BODY_WITH_FOOTER+'<script type="module"'+n+">"+CLIENT+"</script></body></html>"}var DL_ROOT=path2.join(os2.homedir(),"Downloads","azure-storage"),PREFS_FILE=path2.join(os2.homedir(),".azure-storage","prefs.json");async function readPrefs(){try{let raw=await fs.readFile(PREFS_FILE,"utf8"),obj=JSON.parse(raw)||{};return{pinned:obj.pinned&&typeof obj.pinned=="object"?obj.pinned:{},hidden:obj.hidden&&typeof obj.hidden=="object"?obj.hidden:{}}}catch{return{pinned:{},hidden:{}}}}async function writePrefs({pinned,hidden}={}){let safePinned=pinned&&typeof pinned=="object"?pinned:{},safeHidden=hidden&&typeof hidden=="object"?hidden:{};return await fs.mkdir(path2.dirname(PREFS_FILE),{recursive:!0}),await fs.writeFile(PREFS_FILE,JSON.stringify({pinned:safePinned,hidden:safeHidden})),{pinned:safePinned,hidden:safeHidden}}async function saveDownload(container,name,buffer){let root=path2.resolve(DL_ROOT),full=path2.resolve(root,String(container||""),String(name||"").replace(/[\\/]+/g,path2.sep));if(full!==root&&!full.startsWith(root+path2.sep))throw new Error(`refusing to write outside the download folder: ${container}/${name}`);return await fs.mkdir(path2.dirname(full),{recursive:!0}),await fs.writeFile(full,buffer),full}async function openFolder(dir){let target=path2.resolve(dir||DL_ROOT),isDir=!1;try{isDir=(await fs.stat(target)).isDirectory()}catch{isDir=!1}if(!isDir){if(dir)return{ok:!1,target,error:"folder not found"};await fs.mkdir(target,{recursive:!0}).catch(()=>{}),isDir=!0}let attempts=process.platform==="win32"?[["explorer.exe",[target]],[process.env.ComSpec||"cmd.exe",["/c","start","",target]]]:process.platform==="darwin"?[["open",[target]]]:[["xdg-open",[target]]];for(let[cmd,args]of attempts)if(await new Promise(resolve=>{try{let child=spawn3(cmd,args,{detached:!0,stdio:"ignore"}),settled=!1;child.on("error",()=>{settled||(settled=!0,resolve(!1))}),child.unref(),setTimeout(()=>{settled||(settled=!0,resolve(!0))},200)}catch{resolve(!1)}}))return{ok:!0,target};return{ok:!1,target,error:"no file manager available"}}async function start({agent:agent2,port}={}){async function loadAccounts(_p,{setState,log}){setState({s_loading:!0,s_error:null});let r=await safe(()=>listStorageAccounts());return r.ok?(setState({s_loading:!1,s_accounts:r.data}),log(`Loaded ${r.data.length} storage accounts.`),{ok:!0,count:r.data.length}):(setState({s_loading:!1,s_error:r.error,s_needsAuth:r.needsAuth}),log(`Load accounts failed: ${r.error}`),{ok:!1,error:r.error})}async function loadSubscriptions(_p,{setState,log}){warmup(),setState({s_subsLoading:!0,s_error:null,s_seInstalled:storageExplorerInstalled()});let r=await safe(()=>listSubscriptions());if(!r.ok)return setState({s_subsLoading:!1,s_error:r.error,s_needsAuth:r.needsAuth}),log(`Load subscriptions failed: ${r.error}`),{ok:!1,error:r.error};let subs=r.data.slice().sort((a,b)=>(a.displayName||"").localeCompare(b.displayName||""));return setState({s_subsLoading:!1,s_subscriptions:subs}),log(`Found ${subs.length} subscriptions. Pick which to load.`),{ok:!0,count:subs.length}}async function selectSubscriptions({subscriptionIds},{getState,setState,log}){let ids=Array.isArray(subscriptionIds)?subscriptionIds:[],chosen=(getState().s_subscriptions||[]).filter(s=>ids.includes(s.subscriptionId));if(setState({s_selectedSubs:ids,s_loading:!0,s_error:null,s_accounts:[],s_account:null,s_container:null,s_tree:{},s_containers:[],s_blobs:[],s_stats:null,s_filtered:[]}),!chosen.length)return setState({s_loading:!1}),log("Scope cleared. No subscriptions selected."),{ok:!0,count:0};log(`Loading storage accounts for ${chosen.length} subscription(s)\u2026`);let r=await safe(()=>listStorageAccountsForSubs(chosen));if(!r.ok)return setState({s_loading:!1,s_error:r.error,s_needsAuth:r.needsAuth}),log(`Load accounts failed: ${r.error}`),{ok:!1,error:r.error};let{accounts,errors}=r.data,patch={s_loading:!1,s_accounts:accounts};return errors&&errors.length&&(patch.s_error=`${errors.length} subscription(s) could not be read (disabled or missing Reader): ${errors.slice(0,2).map(e=>e.subscriptionName).join(", ")}${errors.length>2?"\u2026":""}`),setState(patch),log(`Loaded ${accounts.length} accounts from ${chosen.length} subscription(s).`),{ok:!0,count:accounts.length}}function setTree({getState,setState},account,patch,loadingPatch){let tree={...getState().s_tree||{}},cur=tree[account]||{containers:null,shares:null,queues:null,tables:null,loading:{}};tree[account]={...cur,...patch||{},loading:{...cur.loading,...loadingPatch||{}}},setState({s_tree:tree})}async function openAccount({account},ctx){let{getState,setState,log}=ctx;if(!account)return{ok:!1,error:"account required"};if(setState({s_error:null,s_account:account,s_container:null,s_blobs:[],s_stats:null,s_filtered:[],s_criteria:null,s_insight:null,s_kind:null,s_item:null,s_files:[],s_messages:[],s_entities:null}),getState().s_tree&&getState().s_tree[account]&&getState().s_tree[account].containers!=null)return log(`Focused account ${account}.`),{ok:!0,cached:!0};setTree(ctx,account,{},{blob:!0}),log(`Opening account ${account}\u2026`);let r=await safe(()=>listContainers(account));return r.ok?(setTree(ctx,account,{containers:r.data},{blob:!1}),log(`${account}: ${r.data.length} containers.`),{ok:!0,containers:r.data.map(c=>c.name)}):(setTree(ctx,account,{},{blob:!1}),setState({s_error:r.error,s_needsAuth:r.needsAuth}),log(`Open ${account} failed: ${r.error}`),{ok:!1,error:r.error})}async function openContainer({container,account},{getState,setState,log}){if(account=account||getState().s_account,!account)return{ok:!1,error:"open an account first"};if(!container)return{ok:!1,error:"container required"};setState({s_loading:!0,s_error:null,s_account:account,s_container:container,s_kind:"blob",s_item:container,s_blobs:[],s_blobsMore:!1,s_stats:null,s_filtered:[],s_criteria:null,s_insight:null}),log(`Listing blobs in ${account}/${container}\u2026`);let r=await safe(()=>listBlobs(account,container));return r.ok?(setState({s_loading:!1,s_blobs:r.data,s_blobsMore:!!r.data.truncated}),log(`${container}: ${r.data.length} blobs${r.data.truncated?"+ (capped at "+r.data.limit+")":""}.`),{ok:!0,blobs:r.data.length}):(setState({s_loading:!1,s_error:r.error,s_needsAuth:r.needsAuth}),log(`List ${container} failed: ${r.error}`),{ok:!1,error:r.error})}async function listShares2({account}={},ctx){let{getState,log}=ctx;if(account=account||getState().s_account,!account)return{ok:!1,error:"open an account first"};setTree(ctx,account,{},{file:!0});let r=await safe(()=>listShares(account));return r.ok?(setTree(ctx,account,{shares:r.data},{file:!1}),log(`${account}: ${r.data.length} file shares.`),{ok:!0,count:r.data.length}):(setTree(ctx,account,{},{file:!1}),ctx.setState({s_error:r.error,s_needsAuth:r.needsAuth}),log(`List shares failed: ${r.error}`),{ok:!1,error:r.error})}async function listQueues2({account}={},ctx){let{getState,log}=ctx;if(account=account||getState().s_account,!account)return{ok:!1,error:"open an account first"};setTree(ctx,account,{},{queue:!0});let r=await safe(()=>listQueues(account));return r.ok?(setTree(ctx,account,{queues:r.data},{queue:!1}),log(`${account}: ${r.data.length} queues.`),{ok:!0,count:r.data.length}):(setTree(ctx,account,{},{queue:!1}),ctx.setState({s_error:r.error,s_needsAuth:r.needsAuth}),log(`List queues failed: ${r.error}`),{ok:!1,error:r.error})}async function listTables2({account}={},ctx){let{getState,log}=ctx;if(account=account||getState().s_account,!account)return{ok:!1,error:"open an account first"};setTree(ctx,account,{},{table:!0});let r=await safe(()=>listTables(account));return r.ok?(setTree(ctx,account,{tables:r.data},{table:!1}),log(`${account}: ${r.data.length} tables.`),{ok:!0,count:r.data.length}):(setTree(ctx,account,{},{table:!1}),ctx.setState({s_error:r.error,s_needsAuth:r.needsAuth}),log(`List tables failed: ${r.error}`),{ok:!1,error:r.error})}async function listContainersTree({account}={},ctx){let{getState,log}=ctx;if(account=account||getState().s_account,!account)return{ok:!1,error:"account required"};if(getState().s_tree&&getState().s_tree[account]&&getState().s_tree[account].containers!=null)return{ok:!0,cached:!0};setTree(ctx,account,{},{blob:!0});let r=await safe(()=>listContainers(account));return r.ok?(setTree(ctx,account,{containers:r.data},{blob:!1}),log(`${account}: ${r.data.length} containers (tree).`),{ok:!0,count:r.data.length}):(setTree(ctx,account,{},{blob:!1}),ctx.setState({s_error:r.error,s_needsAuth:r.needsAuth}),log(`List containers failed: ${r.error}`),{ok:!1,error:r.error})}async function openQueue({queue,account},{getState,setState,log}){if(account=account||getState().s_account,!account||!queue)return{ok:!1,error:"open an account first"};setState({s_loading:!0,s_error:null,s_account:account,s_kind:"queue",s_item:queue,s_messages:[]}),log(`Peeking messages in ${account} \xB7 queue ${queue}\u2026`);let r=await safe(()=>peekQueueMessages(account,queue));return r.ok?(setState({s_loading:!1,s_messages:r.data}),log(`${queue}: peeked ${r.data.length} message(s).`),{ok:!0,messages:r.data.length}):(setState({s_loading:!1,s_error:r.error,s_needsAuth:r.needsAuth}),log(`Peek ${queue} failed: ${r.error}`),{ok:!1,error:r.error})}async function openTable({table,account},{getState,setState,log}){if(account=account||getState().s_account,!account||!table)return{ok:!1,error:"open an account first"};setState({s_loading:!0,s_error:null,s_account:account,s_kind:"table",s_item:table,s_entities:null}),log(`Querying entities in ${account} \xB7 table ${table}\u2026`);let r=await safe(()=>queryTableEntities(account,table));return r.ok?(setState({s_loading:!1,s_entities:r.data}),log(`${table}: ${r.data.rows.length} entities.`),{ok:!0,entities:r.data.rows.length}):(setState({s_loading:!1,s_error:r.error,s_needsAuth:r.needsAuth}),log(`Query ${table} failed: ${r.error}`),{ok:!1,error:r.error})}async function openShare({share,account},{getState,setState,log}){if(account=account||getState().s_account,!account||!share)return{ok:!1,error:"open an account first"};setState({s_loading:!0,s_error:null,s_account:account,s_kind:"file",s_item:share,s_files:[]}),log(`Listing files in ${account} \xB7 share ${share}\u2026`);let r=await safe(()=>listShareItems(account,share,""));return r.ok?(setState({s_loading:!1,s_files:r.data}),log(`${share}: ${r.data.length} item(s).`),{ok:!0,items:r.data.length}):(setState({s_loading:!1,s_error:r.error,s_needsAuth:r.needsAuth}),log(`List ${share} failed: ${r.error}`),{ok:!1,error:r.error})}async function refreshCategory(account,kind,ctx){if(kind==="blob"){let r=await safe(()=>listContainers(account));r.ok&&setTree(ctx,account,{containers:r.data})}else if(kind==="queue"){let r=await safe(()=>listQueues(account));r.ok&&setTree(ctx,account,{queues:r.data})}else if(kind==="table"){let r=await safe(()=>listTables(account));r.ok&&setTree(ctx,account,{tables:r.data})}else if(kind==="file"){let r=await safe(()=>listShares(account));r.ok&&setTree(ctx,account,{shares:r.data})}}function mutate(fn,{refresh,reopen}={}){return async(payload,ctx)=>{let account=payload&&payload.account||ctx.getState().s_account;if(!account)return{ok:!1,error:"open an account first"};let r=await safe(()=>fn(account,payload,ctx));return r.ok?(refresh&&await refreshCategory(account,refresh,ctx),reopen&&await reopen(account,payload,ctx),r.data??{ok:!0}):(ctx.setState({s_error:r.error,s_needsAuth:r.needsAuth}),ctx.log(`Operation failed: ${r.error}`),{ok:!1,error:r.error})}}let reopenQueue=(account,{queue},ctx)=>openQueue({queue},ctx),reopenTable=(account,{table},ctx)=>openTable({table},ctx),reopenShare=(account,{share},ctx)=>openShare({share},ctx);async function runBatchDownload(names,{getState,setState,log}){let st=getState(),account=st.s_account,container=st.s_container;if(!account||!container)return{ok:!1,error:"open a container first"};let list=(names||[]).filter(Boolean);if(!list.length)return{ok:!1,error:"no blobs given"};let dir=path2.join(DL_ROOT,container),done=0,okc=0,failed=[];setState({s_batch:{op:"download",total:list.length,done,ok:okc,failed:[],running:!0,dir}}),log(`Downloading ${list.length} blob(s) from ${container}\u2026`);for(let name of list){let r=await safe(()=>downloadBlob(account,container,name));if(done++,r.ok)try{await saveDownload(container,name,r.data),okc++}catch(e){failed.push({name,error:"could not save to disk: "+(e&&e.message?e.message:String(e))})}else failed.push({name,error:r.error});setState({s_batch:{op:"download",total:list.length,done,ok:okc,failed:[...failed],running:done<list.length,dir}})}return log(`Download complete: ${okc} ok, ${failed.length} failed. Saved under ${dir}`),{ok:!0,downloaded:okc,failed,dir}}async function runBatchUpload(items,{getState,setState,log}){let st=getState(),account=st.s_account,container=st.s_container;if(!account||!container)return{ok:!1,error:"open a container first"};let list=(items||[]).filter(i=>i&&i.name&&i.contentBase64);if(!list.length)return{ok:!1,error:"no items given"};let done=0,okc=0,failed=[];setState({s_batch:{op:"upload",total:list.length,done,ok:okc,failed:[],running:!0}}),log(`Uploading ${list.length} file(s) to ${container}\u2026`);for(let it of list){let buf=Buffer.from(it.contentBase64,"base64"),r=await safe(()=>uploadBlob(account,container,it.name,buf,it.contentType));done++,r.ok?okc++:failed.push({name:it.name,error:r.error}),setState({s_batch:{op:"upload",total:list.length,done,ok:okc,failed:[...failed],running:done<list.length}})}let rl=await safe(()=>listBlobs(account,container));return rl.ok&&setState({s_blobs:rl.data}),log(`Upload complete: ${okc} ok, ${failed.length} failed.`),{ok:!0,uploaded:okc,failed}}async function runBatchCleanup(action,{getState,setState,log}){let st=getState(),account=st.s_account,container=st.s_container;if(!account||!container)return{ok:!1,error:"open a container first"};let list=(st.s_filtered||[]).filter(Boolean);if(!list.length)return{ok:!1,error:"filter some blobs first, nothing matched"};let op=action==="delete"?"delete":"archive",done=0,okc=0,failed=[];setState({s_batch:{op,total:list.length,done,ok:okc,failed:[],running:!0}}),log(`${op==="delete"?"Deleting":"Archiving"} ${list.length} matched blob(s) in ${container}\u2026`);for(let name of list){let r=op==="delete"?await safe(()=>deleteBlob(account,container,name)):await safe(()=>setBlobTier(account,container,name,"Archive"));done++,r.ok?okc++:failed.push({name,error:r.error}),setState({s_batch:{op,total:list.length,done,ok:okc,failed:[...failed],running:done<list.length}})}let rl=await safe(()=>listBlobs(account,container));return rl.ok&&setState({s_blobs:rl.data}),log(`${op==="delete"?"Delete":"Archive"} complete: ${okc} ok, ${failed.length} failed.`),{ok:!0,op,cleaned:okc,failed}}let routes={"/load-accounts":loadAccounts,"/load-subscriptions":loadSubscriptions,"/select-subscriptions":selectSubscriptions,"/account":openAccount,"/container":openContainer,"/list-shares":listShares2,"/list-queues":listQueues2,"/list-tables":listTables2,"/tree-containers":listContainersTree,"/open-queue":openQueue,"/open-table":openTable,"/open-share":openShare,"/download-many":({blobs},ctx)=>runBatchDownload(blobs,ctx),"/open-folder":async({dir},_ctx)=>await openFolder(dir),"/dismiss-batch":(_p,{setState})=>(setState({s_batch:null}),{ok:!0}),"/get-prefs":async()=>({ok:!0,prefs:await readPrefs()}),"/save-prefs":async({pinned,hidden}={})=>({ok:!0,prefs:await writePrefs({pinned,hidden})}),"/upload-many":({items},ctx)=>runBatchUpload(items,ctx),"/container-create":mutate((a,{container})=>createContainer(a,container),{refresh:"blob"}),"/container-delete":async({container,account},ctx)=>{let a=account||ctx.getState().s_account,r=await safe(()=>deleteContainer(a,container));return r.ok?(await refreshCategory(a,"blob",ctx),ctx.getState().s_kind==="blob"&&ctx.getState().s_item===container&&ctx.setState({s_kind:null,s_item:null,s_container:null,s_blobs:[]}),ctx.log(`Deleted container ${container}.`),{ok:!0}):(ctx.setState({s_error:r.error,s_needsAuth:r.needsAuth}),{ok:!1,error:r.error})},"/blob-delete":async({container,name,account},ctx)=>{let a=account||ctx.getState().s_account,r=await safe(()=>deleteBlob(a,container,name));if(!r.ok)return ctx.setState({s_error:r.error,s_needsAuth:r.needsAuth}),{ok:!1,error:r.error};let rl=await safe(()=>listBlobs(a,container));return rl.ok&&ctx.setState({s_blobs:rl.data}),ctx.log(`Deleted blob ${name}.`),{ok:!0}},"/generate-sas":async({container,name,account,minutes,permissions},{getState,log})=>{let a=account||getState().s_account,c=container||getState().s_container;if(!c||!name)return{ok:!1,error:"no blob selected"};let r=await safe(()=>generateBlobSas(a,c,name,{minutes:Number(minutes)||60,permissions:permissions||"r"}));return r.ok?(log(`Generated ${r.data.mode} SAS for ${name} (${r.data.permissions}, expires ${r.data.expiresOn}).`),{ok:!0,name,...r.data}):{ok:!1,error:r.error,needsAuth:r.needsAuth}},"/generate-container-sas":async({container,account,minutes,permissions},{getState,log})=>{let a=account||getState().s_account,c=container||getState().s_container;if(!c)return{ok:!1,error:"no container selected"};let r=await safe(()=>generateContainerSas(a,c,{minutes:Number(minutes)||1440,permissions:permissions||"rl"}));return r.ok?(log(`Generated ${r.data.mode} container SAS for ${c} (${r.data.permissions}, expires ${r.data.expiresOn}).`),{ok:!0,container:c,...r.data}):{ok:!1,error:r.error,needsAuth:r.needsAuth}},"/queue-create":mutate((a,{queue})=>createQueue(a,queue),{refresh:"queue"}),"/queue-delete":async({queue,account},ctx)=>{let a=account||ctx.getState().s_account,r=await safe(()=>deleteQueue(a,queue));return r.ok?(await refreshCategory(a,"queue",ctx),ctx.getState().s_kind==="queue"&&ctx.getState().s_item===queue&&ctx.setState({s_kind:null,s_item:null,s_messages:[]}),ctx.log(`Deleted queue ${queue}.`),{ok:!0}):(ctx.setState({s_error:r.error,s_needsAuth:r.needsAuth}),{ok:!1,error:r.error})},"/queue-send":mutate((a,{queue,text})=>sendQueueMessage(a,queue,text),{reopen:reopenQueue}),"/queue-clear":mutate((a,{queue})=>clearQueueMessages(a,queue),{reopen:reopenQueue}),"/queue-msg-update":mutate((a,{queue,messageId,text})=>updateQueueMessage(a,queue,messageId,text),{reopen:reopenQueue}),"/queue-msg-delete":mutate((a,{queue,messageId})=>deleteQueueMessage(a,queue,messageId),{reopen:reopenQueue}),"/table-create":mutate((a,{table})=>createTable(a,table),{refresh:"table"}),"/table-delete":async({table,account},ctx)=>{let a=account||ctx.getState().s_account,r=await safe(()=>deleteTable(a,table));return r.ok?(await refreshCategory(a,"table",ctx),ctx.getState().s_kind==="table"&&ctx.getState().s_item===table&&ctx.setState({s_kind:null,s_item:null,s_entities:null}),ctx.log(`Deleted table ${table}.`),{ok:!0}):(ctx.setState({s_error:r.error,s_needsAuth:r.needsAuth}),{ok:!1,error:r.error})},"/entity-upsert":mutate((a,{table,entity})=>upsertEntity(a,table,entity),{reopen:reopenTable}),"/entity-delete":mutate((a,{table,partitionKey,rowKey})=>deleteEntity(a,table,partitionKey,rowKey),{reopen:reopenTable}),"/share-create":mutate((a,{share})=>createShare(a,share),{refresh:"file"}),"/share-delete":async({share,account},ctx)=>{let a=account||ctx.getState().s_account,r=await safe(()=>deleteShare(a,share));return r.ok?(await refreshCategory(a,"file",ctx),ctx.getState().s_kind==="file"&&ctx.getState().s_item===share&&ctx.setState({s_kind:null,s_item:null,s_files:[]}),ctx.log(`Deleted file share ${share}.`),{ok:!0}):(ctx.setState({s_error:r.error,s_needsAuth:r.needsAuth}),{ok:!1,error:r.error})},"/share-mkdir":mutate((a,{share,dir})=>createShareDirectory(a,share,dir),{reopen:reopenShare}),"/share-delete-item":mutate((a,{share,name,kind})=>deleteShareItem(a,share,name,kind),{reopen:reopenShare}),"/share-upload":mutate((a,{share,name,contentBase64})=>uploadShareFile(a,share,name,Buffer.from(contentBase64||"","base64")),{reopen:reopenShare}),"/share-download":async({share,name},ctx)=>{let a=ctx.getState().s_account,r=await safe(()=>downloadShareFile(a,share,name));if(!r.ok)return ctx.setState({s_error:r.error,s_needsAuth:r.needsAuth}),{ok:!1,error:r.error};let dir=path2.join(DL_ROOT,share);try{await saveDownload(share,name,r.data)}catch(e){let msg="could not save to disk: "+(e&&e.message?e.message:String(e));return ctx.setState({s_error:msg}),{ok:!1,error:msg}}return ctx.setState({s_batch:{op:"download",total:1,done:1,ok:1,failed:[],running:!1,dir}}),ctx.log(`Downloaded ${name} from share ${share} to ${dir}.`),{ok:!0,dir}},"/diagnose":(_p,_ctx)=>({ok:!1,error:"diagnosis removed"}),"/filter":async(criteria,{getState,setState,log})=>{let st=getState();if(!(st.s_kind==="blob"&&st.s_container))return{ok:!1,error:"Open a container first to filter its blobs."};let blobs=st.s_blobs||[],{filtered,stats}=filterAndStat(blobs,criteria||{});return setState({s_criteria:criteria||{},s_filtered:filtered.map(b=>b.name),s_stats:stats}),log(`Filter matched ${filtered.length} of ${blobs.length} blobs.`),{ok:!0,matched:filtered.length,stats}},"/download-filtered":async(_p,ctx)=>{let names=ctx.getState().s_filtered||[];return runBatchDownload(names,ctx)},"/cleanup-filtered":({action},ctx)=>runBatchCleanup(action,ctx),"/transfer-plan":async({dest,resolution,useFiltered,source:srcContainer},{getState,setState,log})=>{let st=getState(),account=st.s_account,container=String(srcContainer||st.s_container||"").trim(),fail=msg=>(setState({s_transferErr:msg,s_transfer:null}),log(`Transfer plan failed: ${msg}`),{ok:!1,error:msg});if(!account)return fail("Open a storage account first. Pick one in the Explorer.");if(!container)return fail("Choose a source container.");let isOpen=st.s_kind==="blob"&&st.s_item===container,allBlobs;if(isOpen)allBlobs=st.s_blobs||[];else{let rs=await safe(()=>listBlobs(account,container));if(!rs.ok)return fail(`Couldn't read source container '${container}': ${rs.error}`);allBlobs=rs.data}let canFilter=isOpen&&(st.s_filtered||[]).length,names=useFiltered&&canFilter?new Set(st.s_filtered):null,source=names?allBlobs.filter(b=>names.has(b.name)):allBlobs,destStr=String(dest||"").trim();if(!destStr)return fail("Enter a destination: 'account/container' (e.g. myaccount/backups) or a container SAS URL.");if(!/[?&]sig=/.test(destStr)&&destStr.replace(/^https?:\/\//,"").split("/").filter(Boolean).length<2)return fail(`Destination must be 'account/container', not just '${destStr}'. Example: ${account}/${destStr||"backups"}, or paste a container SAS URL.`);if(`${account}/${container}`===destStr.replace(/^https?:\/\//,"").replace(".blob.core.windows.net",""))return fail("Source and destination are the same container. Pick a different destination.");let res=["overwrite","skip","if-newer"].includes(resolution)?resolution:"overwrite",destBlobs=[],destUrl="",destSas=!1,r=await safe(async()=>{if(/[?&]sig=/.test(destStr)){let p=parseSasUrl(destStr);if(!p.ok)throw new Error(p.error);return destUrl=p.containerUrl,destSas=!0,await listSasBlobs2(destStr).then(x=>x.blobs)}let m=destStr.replace(/^https?:\/\//,"").split("/"),dAcct=m[0].split(".")[0],dCont=m[1];if(!dAcct||!dCont)throw new Error("Destination must be 'account/container' or a container SAS URL.");return destUrl=`https://${dAcct}.blob.core.windows.net/${dCont}`,await listBlobs(dAcct,dCont)});if(!r.ok)return fail(`Couldn't read the destination: ${r.error}`);destBlobs=r.data;let plan=planTransfer(source,destBlobs,res),sourceUrl=`https://${account}.blob.core.windows.net/${container}`,allSource=!names,{command,needsLogin,empty}=azcopyCommand({sourceUrl,destUrl,resolution:res,includeNames:names?plan.toTransfer:null,allSource});if(empty)return fail("Nothing to transfer \u2014 every selected blob already exists at the destination under the current conflict rule.");let azcopy=await azcopyDoctor();return setState({s_transferErr:null,s_transfer:{plan,command,needsLogin,azcopy,sourceLabel:`${account}/${container}`,destLabel:destSas?`${plan.destCount} blobs (SAS)`:destStr,source:allSource?"all blobs":`${source.length} filtered blobs`}}),log(`Transfer plan: ${plan.transferCount} to transfer, ${plan.conflictCount} conflicts (${res}).${azcopy.installed?` AzCopy ${azcopy.version||"detected"}.`:" AzCopy not found \u2014 install it to run the command."}`),{ok:!0,plan,command,azcopy}},"/azcopy-doctor":async(_p,_ctx)=>({ok:!0,azcopy:await azcopyDoctor({refresh:!0})}),"/sas-connect":async({url},{setState,log})=>{setState({s_loading:!0,s_error:null});let parsed=parseSasUrl(url);if(!parsed.ok)return setState({s_loading:!1,s_error:parsed.error}),{ok:!1,error:parsed.error};log(`Connecting to SAS: ${describeSas(parsed)}`);let r=await safe(()=>listSasBlobs2(url));if(!r.ok)return setState({s_loading:!1,s_error:r.error}),log(`SAS connect failed: ${r.error}`),{ok:!1,error:r.error};let{stats}=filterAndStat(r.data.blobs,{}),withUrls=parsed.canRead?r.data.blobs.map(b=>({...b,url:blobSasUrl(url,b.name)})):r.data.blobs;return setState({s_loading:!1,s_sasUrl:url,s_sasInfo:{account:r.data.account,container:r.data.container,permissions:r.data.permissions,expiresOn:r.data.expiresOn,canRead:parsed.canRead,canList:parsed.canList,canWrite:parsed.canWrite,canDelete:parsed.canDelete,expired:parsed.expired,resource:parsed.resource},s_sasBlobs:withUrls,s_sasStats:stats}),log(`SAS connected: ${r.data.blobs.length} blobs in ${r.data.container}.`),{ok:!0,blobs:r.data.blobs.length}},"/sas-download":async({name},{getState,setState,log})=>{let url=getState().s_sasUrl;if(!url)return{ok:!1,error:"connect a SAS first"};let r=await safe(()=>downloadSasBlob2(url,name));if(!r.ok)return setState({s_error:r.error}),{ok:!1,error:r.error};let container=getState().s_sasInfo?.container||"sas",savedPath;try{savedPath=await saveDownload(container,name,Buffer.from(r.data.contentBase64,"base64"))}catch(e){let msg="could not save to disk: "+(e&&e.message?e.message:String(e));return setState({s_error:msg}),log(`SAS download failed: ${msg}`),{ok:!1,name,error:msg}}return log(`Downloaded '${name}' (${r.data.size} bytes) from SAS.`),{ok:!0,name,size:r.data.size,path:savedPath,dir:path2.dirname(savedPath)}},"/ask":async({question},{setState,log})=>(setState({s_ask:{question,pending:!0,answer:null,visual:null}}),log(`Asked Copilot: "${question}"`),await agent2?.askCanvas?.({question}),{ok:!0}),"/read-state":(_p,{getState})=>{let st=getState();return{ok:!0,state:{account:st.s_account,container:st.s_container,subscriptions:(st.s_subscriptions||[]).length,selectedSubs:st.s_selectedSubs||[],accounts:(st.s_accounts||[]).map(a=>a.name),tree:st.s_tree||{},containers:Object.values(st.s_tree||{}).flatMap(t=>(t.containers||[]).map(c=>c.name)),blobs:st.s_blobs||[],blobsTruncated:!!(st.s_blobs&&st.s_blobs.truncated),stats:st.s_stats||null,filtered:st.s_filtered||[],batch:st.s_batch||null,sasInfo:st.s_sasInfo||null,sasBlobs:(st.s_sasBlobs||[]).map(b=>({name:b.name,size:b.size,lastModified:b.lastModified||null,contentType:b.contentType||null})),transfer:st.s_transfer?(()=>{let{command,sourceUrl,destUrl,...rest}=st.s_transfer;return rest})():null,insight:st.s_insight||null,preview:st.s_preview?{name:st.s_preview.name,isText:st.s_preview.isText,size:st.s_preview.size,truncated:st.s_preview.truncated,lang:st.s_preview.lang,format:st.s_preview.format||null,category:st.s_preview.category||null,magicHex:st.s_preview.magicHex||null,glb:st.s_preview.glb||null,isImage:!!st.s_preview.image,explaining:!!st.s_preview.explaining,explained:!!st.s_preview.explanation,text:st.s_preview.text||null}:null,s_queues:(st.s_queues||[]).map(q=>({name:q.name})),s_tables:(st.s_tables||[]).map(t=>({name:t.name})),s_shares:(st.s_shares||[]).map(x=>({name:x.name})),s_messages:(st.s_messages||[]).map(m=>({messageText:m.messageText})),s_entities:st.s_entities||null,s_files:(st.s_files||[]).map(f=>({name:f.name,kind:f.kind})),s_kind:st.s_kind||null,s_item:st.s_item||null}}},"/canvas-answer":({answer,visual,target,suggestedFilter},{getState,setState})=>{let payload={pending:!1,answer:String(answer||""),visual:visual||null},st=getState(),t=target==="insights"||target==="preview"||target==="ask"?target:null;if(st.s_preview&&st.s_preview.explaining?t="preview":st.s_insight&&st.s_insight.pending?t="insights":t||(t="ask"),t==="insights")setState({s_insight:{...payload,suggestedFilter:suggestedFilter||null}});else if(t==="preview"){let p=st.s_preview||{};setState({s_preview:{...p,explaining:!1,explanation:payload}})}else setState({s_ask:payload});return{ok:!0}},"/insights":async(_p,{getState,setState,log})=>{let st=getState();return st.s_stats?(setState({s_insight:{pending:!0,answer:null,visual:null,suggestedFilter:null}}),log("Asked Copilot to explain the statistics."),await agent2?.requestInsight?.({account:st.s_account,container:st.s_container}),{ok:!0}):{ok:!1,error:"Filter or open a container first so there are statistics to explain."}},"/preview-blob":async({name},{getState,setState,log})=>{let st=getState(),account=st.s_account,container=st.s_container;if(!account||!container||!name)return{ok:!1,error:"Open a container and pick a blob to preview."};setState({s_preview:{name,pending:!0}});let MAX=32*1024,r=await safe(()=>downloadBlob(account,container,name,{maxBytes:MAX}));if(!r.ok)return setState({s_preview:{name,pending:!1,error:r.error}}),log(`Preview failed: ${r.error}`),{ok:!1,error:r.error};let slice=r.data.subarray(0,MAX),{isText,text}=sniffText(slice),bin=isText?null:sniffBinaryFormat(slice,name),mime=isText?null:imageMime(name),sz=await safe(()=>blobSize(account,container,name)),total=sz.ok?sz.data:slice.length,RENDER_MAX=25*1024*1024,GLB_MAX=50*1024*1024,image=mime&&total<=RENDER_MAX?{mime}:null,glb=null;if(bin&&/GLB/.test(bin.format)&&total<=GLB_MAX){let full=await safe(()=>downloadBlob(account,container,name));full.ok&&(glb=parseGlb(full.data))}return setState({s_preview:{name,pending:!1,size:total,truncated:total>MAX,isText,lang:previewLang(name),text:isText?text:null,format:bin?bin.format:null,category:bin?bin.category:null,magicHex:bin?bin.magicHex:null,image,glb,explanation:null}}),log(`Previewed ${name}: ${isText?"text":bin.format}, ${total} bytes.`),{ok:!0,isText,bytes:total}},"/explain-blob":async(_p,{getState,setState})=>{let p=getState().s_preview;return!p||p.pending||p.error?{ok:!1,error:"Preview a blob first."}:!p.isText&&!p.format?{ok:!1,error:"Preview a blob first."}:(setState({s_preview:{...p,explaining:!0,explanation:null}}),await agent2?.requestPreviewExplain?.({name:p.name,isText:!!p.isText,format:p.format||null,category:p.category||null,size:p.size,glb:p.glb||null}),{ok:!0})},"/dismiss-preview":(_p,{setState})=>(setState({s_preview:null}),{ok:!0}),"/dismiss-insight":(_p,{setState})=>(setState({s_insight:null}),{ok:!0}),"/open-storage-explorer":async(_p,{getState,log})=>{let st=getState(),account=st.s_account||null,kind=st.s_kind||null,item=st.s_item||null,where=item?`${account}/${item}`:account||"the app";log(`Opening Azure Storage Explorer \u2192 ${where}\u2026`);let r=await openInStorageExplorer({account,kind,item});return r.ok?(log(r.deepLink?`Opened Storage Explorer at ${where}.`:"Opened Storage Explorer."),{ok:!0,deepLink:r.deepLink}):r.notInstalled?(log("Azure Storage Explorer isn't installed. Opening the download page so you can get the free desktop app."),{ok:!1,notInstalled:!0,install:r.install}):(log(`Storage Explorer: ${r.error}`),{ok:!1,error:r.error})},"/dismiss-error":(_p,{setState})=>(setState({s_error:null,s_needsAuth:!1}),{ok:!0}),"/sign-in":async(_p,ctx)=>{let{setState,log}=ctx;setState({s_signingIn:!0,s_error:null}),log("Opening az login in your browser\u2026");let r=await signIn();return r.ok?(setState({s_signingIn:!1,s_needsAuth:!1,s_error:null}),log("Signed in successfully. Loading subscriptions\u2026"),await loadSubscriptions({},ctx),{ok:!0}):(setState({s_signingIn:!1,s_error:r.error,s_needsAuth:!0}),log(`Sign-in failed: ${r.error}`),{ok:!1,error:r.error})}},initialState={s_subscriptions:[],s_selectedSubs:[],s_subsLoading:!1,s_accounts:[],s_tree:{},s_containers:[],s_blobs:[],s_filtered:[],s_shares:[],s_queues:[],s_tables:[],s_files:[],s_messages:[],s_entities:null,s_kind:null,s_item:null,s_svcLoading:null,s_account:null,s_container:null,s_stats:null,s_batch:null,s_sasInfo:null,s_sasBlobs:[],s_ask:null,s_transfer:null,s_insight:null,s_preview:null,s_transferErr:null,s_loading:!1,s_error:null,activityLog:[],s_signingIn:!1,s_seInstalled:null};async function mediaHandler(pathname,query,{getState}){if(pathname!=="/blob-media")return null;let name=query.get("name"),st=getState(),p=st.s_preview;if(!p||p.name!==name||!p.image)return null;let account=st.s_account,container=st.s_container;if(!account||!container)return null;let r=await safe(()=>downloadBlob(account,container,name));return r.ok?{contentType:p.image.mime||imageMime(name)||"application/octet-stream",buffer:r.data}:null}let server2=await createCanvasServer({html:pageHtml,routes,media:mediaHandler,initialState,port});return server2.loadAccounts=()=>loadAccounts({},{getState:server2.getState,setState:server2.setState,log:server2.log}),server2.loadSubscriptions=()=>loadSubscriptions({},{getState:server2.getState,setState:server2.setState,log:server2.log}),server2}var session;async function post(server2,route,body){let res=await fetch(`http://127.0.0.1:${server2.port}${route}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body||{})});try{return await res.json()}catch{return{ok:res.ok}}}var agent={async askCanvas({question}){session?.send({prompt:`On the "Azure Storage" canvas, the user asked: "${question}"
Call read_canvas_state to pull the live blob list / stats / account context, then answer via answer_on_canvas citing real numbers. If the answer ranks or compares numbers, also pass a visual ({kind:'bar'|'stat'|'table', ...}) so the user SEES it.`,displayPrompt:`\u{1F4AC} Storage canvas \u2014 asked: "${String(question).slice(0,80)}"`})},async requestInsight({container}={}){session?.send({prompt:`On the "Azure Storage" canvas, the user clicked "Explain these statistics"${container?` for container "${container}"`:""}.
Call read_canvas_state ONCE and read the "stats" object (count, total/avg/max size, size histogram buckets, byType, byTier, byExt, topLargest) and the "filtered" set. The numbers are ALREADY provided \u2014 do NOT run shell commands or call other tools to compute them.
Then immediately call answer_on_canvas with target:"insights" and a concise, specific interpretation: what stands out about size distribution, access tiers (Hot/Cool/Cold/Archive), file types, and any cost/cleanup/lifecycle opportunity (e.g. large cold data, many tiny files, old blobs). Cite real numbers. Include a visual ({kind:'bar'|'stat'|'table', ...}) when it helps. If an obvious cleanup/selection would help, ALSO pass suggestedFilter = a storage_filter_blobs criteria object (e.g. {olderThanDays:180} or {tiers:["Archive"],minSize:1048576}) so the user can apply it in one click. Do NOT explain in chat \u2014 render on the canvas.`,displayPrompt:"\u{1F9E0} Storage canvas \u2014 explain statistics"})},async requestPreviewExplain({name,isText,format,category,glb}={}){let glbNote=glb&&!glb.truncated?` The GLB's embedded JSON was parsed \u2014 read preview.glb for the REAL counts (meshes:${glb.meshes}, materials:${glb.materials}, textures:${glb.textures}, nodes:${glb.nodes}, animations:${glb.animations}, vertices:${glb.vertices}, triangles:${glb.triangles}${glb.generator?`, generator:"${glb.generator}"`:""}) and CITE these actual numbers instead of speaking generically.`:"",prompt=isText?`On the "Azure Storage" canvas, the user clicked "Ask Copilot to explain" for the previewed blob "${name}".
Call read_canvas_state ONCE and read "preview" ({name, lang, size, truncated, text}). The file content is ALREADY provided in preview.text \u2014 do NOT run any shell commands, do NOT read files from disk, and do NOT call other tools to fetch it. Work only from preview.text.
Then immediately call answer_on_canvas with target:"preview" and a concise explanation: what this file is, its structure/schema (columns/keys/format), what the data represents, and anything notable. If it was truncated, say so. Add a visual ({kind:'table'|'bar'|'stat'}) only if it clarifies the structure. Do NOT explain in chat \u2014 render on the canvas.`:`On the "Azure Storage" canvas, the user clicked "Explain this file" for the BINARY blob "${name}" (no text preview).
Call read_canvas_state ONCE and read "preview" ({name, size, format, category, magicHex, glb}). The format was detected from the leading magic bytes${format?` and is "${format}"${category?` (${category})`:""}`:""}.${glbNote} The bytes are binary \u2014 do NOT run any shell commands, do NOT download or read the file, and do NOT call other tools. Reason only from the fields in preview.
Then immediately call answer_on_canvas with target:"preview" and a concise explanation of THIS FILE: what "${format||"this format"}" is and what it's used for, ${glb&&!glb.truncated?"PLUS the specific model composition using the real preview.glb counts (meshes/materials/textures/vertices/triangles), and a visual ({kind:'table'} listing those counts). ":""}what tooling opens/produces it, and practical Azure Storage tips (right Content-Type, whether it compresses, viewing, lifecycle/tiering). Keep it specific and do NOT claim to have inspected raw geometry beyond the provided counts. Do NOT explain in chat \u2014 render on the canvas.`;session?.send({prompt,displayPrompt:`\u{1F441} Storage canvas \u2014 explain "${String(name).slice(0,60)}"`})}},server=await start({agent}),canvas=createCanvas({id:"azure-storage",displayName:"Azure Storage",description:"Browse Azure Storage blobs/containers, bulk-transfer with live progress, filter + aggregate statistics, and open SAS links with no login \u2014 all agent-drivable on one live surface.",actions:[{name:"read_canvas_state",description:"Pull the live data shown on the Storage canvas (current account/container, the blob list with name/size/lastModified/contentType, computed stats, filtered set, batch progress, SAS info). Use this before answering any question about what's on the canvas.",inputSchema:{type:"object",properties:{keys:{type:"array",items:{type:"string"}}}},handler:async()=>post(server,"/read-state",{})},{name:"answer_on_canvas",description:"Render an answer back inside the canvas. `target` selects the panel: 'ask' (default, the Ask card), 'insights' (the statistics 'Explain' panel), or 'preview' (the blob preview panel). Always pass text `answer`; also pass an optional `visual` ({kind:'bar'|'stat'|'table', ...}) whenever the answer is quantitative/comparative so the user SEES it. When target='insights' you may also pass `suggestedFilter` (a storage_filter_blobs criteria object) to offer the user a one-click cleanup filter.",inputSchema:{type:"object",properties:{answer:{type:"string"},visual:{type:"object"},target:{type:"string",enum:["ask","insights","preview"]},suggestedFilter:{type:"object"}},required:["answer"]},handler:async({input})=>post(server,"/canvas-answer",{answer:input.answer,visual:input.visual,target:input.target,suggestedFilter:input.suggestedFilter})},{name:"storage_open_account",description:"Open a storage account on the canvas and load its containers live. Pass the account name exactly as shown in the account list (read_canvas_state \u2192 accounts).",inputSchema:{type:"object",properties:{account:{type:"string"}},required:["account"]},handler:async({input})=>post(server,"/account",{account:input.account})},{name:"storage_open_container",description:"Open a blob container on the canvas and list its blobs live (each blob's name/size/lastModified/contentType). Requires an account to be open first.",inputSchema:{type:"object",properties:{container:{type:"string"}},required:["container"]},handler:async({input})=>post(server,"/container",{container:input.container})},{name:"storage_batch_download",description:"Download several blobs at once from the open container with a LIVE progress bar and per-file pass/fail summary. Pass `blobs` = array of exact blob names (choose them by reading the blob list \u2014 e.g. the largest, or those older than a date). Non-destructive to the cloud.",inputSchema:{type:"object",properties:{blobs:{type:"array",items:{type:"string"}}},required:["blobs"]},handler:async({input})=>post(server,"/download-many",{blobs:input.blobs})},{name:"storage_batch_upload",description:"MUTATION \u2014 upload multiple files into the open container with a live progress bar. Only after the user has clearly asked to upload; narrate what you're uploading first. Pass `items` = array of {name, contentBase64, contentType}.",mutates:!0,inputSchema:{type:"object",properties:{items:{type:"array",items:{type:"object"}}},required:["items"]},handler:async({input})=>post(server,"/upload-many",{items:input.items})},{name:"storage_filter_blobs",description:"Filter the open container's blobs and compute LIVE statistics on the canvas (count, total/avg/max size, size histogram, by-type/by-tier/by-extension breakdown, top-10 largest). All criteria optional: namePattern (glob), prefix/suffix/contains (substring match on blob name), minSize/maxSize (bytes), olderThanDays/newerThanDays, type (image|video|audio|text/data|document|archive|binary), tiers (Hot|Cool|Cold|Archive \u2014 array or comma list), blobTypes (BlockBlob|PageBlob|AppendBlob), tagKeys (blob-index tag keys that must exist), tags (object of key=value that must all match). The matched NAMES become the filtered set for storage_download_filtered. This is aggregation MCP cannot do.",inputSchema:{type:"object",properties:{namePattern:{type:"string"},prefix:{type:"string"},suffix:{type:"string"},contains:{type:"string"},minSize:{type:"number"},maxSize:{type:"number"},olderThanDays:{type:"number"},newerThanDays:{type:"number"},type:{type:"string"},tiers:{type:"array",items:{type:"string"}},blobTypes:{type:"array",items:{type:"string"}},tagKeys:{type:"array",items:{type:"string"}},tags:{type:"object"}}},handler:async({input})=>post(server,"/filter",input)},{name:"storage_download_filtered",description:"Download every blob currently matched by the last storage_filter_blobs, with a live progress bar. Use after filtering, e.g. 'download everything older than 30 days'. Non-destructive to the cloud.",inputSchema:{type:"object",properties:{}},handler:async()=>post(server,"/download-filtered",{})},{name:"storage_open_sas",description:"Open a container SAS URL on the canvas WITHOUT any az login \u2014 parses the SAS, lists its blobs, and shows a read view. Use when the user pastes a 'https://acct.blob.core.windows.net/container?...&sig=...' link. Impossible for the Azure/Storage MCP (they require a full account + RBAC).",inputSchema:{type:"object",properties:{url:{type:"string"}},required:["url"]},handler:async({input})=>post(server,"/sas-connect",{url:input.url})},{name:"storage_download_sas_blob",description:"Download one blob from the currently-connected SAS container. Pass the exact blob `name` from the SAS blob list. Read-only.",inputSchema:{type:"object",properties:{name:{type:"string"}},required:["name"]},handler:async({input})=>post(server,"/sas-download",{name:input.name})},{name:"storage_plan_transfer",description:"Plan an AzCopy transfer FROM the currently-open container TO a destination, detecting name conflicts up-front and applying a resolution policy before anything moves. `dest` is either 'account/container' or a container SAS URL. `resolution` \u2208 overwrite|skip|if-newer. Set `useFiltered` true to transfer only the last-filtered set. Returns the plan (counts/conflicts/bytes) and the exact `azcopy copy` command; it does NOT move data. Use for 'copy these blobs to <dest>, skip ones that already exist'.",inputSchema:{type:"object",properties:{dest:{type:"string"},resolution:{type:"string",enum:["overwrite","skip","if-newer"]},useFiltered:{type:"boolean"}},required:["dest"]},handler:async({input})=>post(server,"/transfer-plan",{dest:input.dest,resolution:input.resolution,useFiltered:input.useFiltered})},{name:"storage_preview_blob",description:"Open an inline text PREVIEW of one blob from the open container (first 32 KB). Pass the exact blob `name`. Read-only. Binary blobs are detected and reported as non-text. After previewing, you can read the text via read_canvas_state \u2192 preview.text and explain it via answer_on_canvas target:'preview'.",inputSchema:{type:"object",properties:{name:{type:"string"}},required:["name"]},handler:async({input})=>post(server,"/preview-blob",{name:input.name})},{name:"storage_explain_stats",description:"Trigger the canvas's 'Explain these statistics' insight panel \u2014 reads the live filtered stats and renders an interpretation (via answer_on_canvas target:'insights'). Use when the user asks what the storage stats mean or how to clean up / optimize cost.",inputSchema:{type:"object",properties:{}},handler:async()=>post(server,"/insights",{})},{name:"storage_list_queues",description:"List the Storage queues in the open account on the canvas (read-only). Opens the Queues view and shows each queue with its approximate message count. Requires an account to be open first (storage_open_account).",inputSchema:{type:"object",properties:{account:{type:"string"}}},handler:async({input})=>post(server,"/list-queues",{account:input.account})},{name:"storage_open_queue",description:"Open one Storage queue on the canvas and peek its messages live (read-only \u2014 peeking does not dequeue). Pass the exact queue `name` from storage_list_queues. Requires an account to be open first.",inputSchema:{type:"object",properties:{queue:{type:"string"},account:{type:"string"}},required:["queue"]},handler:async({input})=>post(server,"/open-queue",{queue:input.queue,account:input.account})},{name:"storage_list_tables",description:"List the Storage tables in the open account on the canvas (read-only). Opens the Tables view. Requires an account to be open first (storage_open_account).",inputSchema:{type:"object",properties:{account:{type:"string"}}},handler:async({input})=>post(server,"/list-tables",{account:input.account})},{name:"storage_open_table",description:"Open one Storage table on the canvas and list its entities live (read-only). Pass the exact table `name` from storage_list_tables. Requires an account to be open first.",inputSchema:{type:"object",properties:{table:{type:"string"},account:{type:"string"}},required:["table"]},handler:async({input})=>post(server,"/open-table",{table:input.table,account:input.account})},{name:"storage_list_shares",description:"List the Azure File shares in the open account on the canvas (read-only). Opens the File shares view. Requires an account to be open first (storage_open_account).",inputSchema:{type:"object",properties:{account:{type:"string"}}},handler:async({input})=>post(server,"/list-shares",{account:input.account})},{name:"storage_open_share",description:"Open one Azure File share on the canvas and list its files and directories live (read-only). Pass the exact share `name` from storage_list_shares. Requires an account to be open first.",inputSchema:{type:"object",properties:{share:{type:"string"},account:{type:"string"}},required:["share"]},handler:async({input})=>post(server,"/open-share",{share:input.share,account:input.account})},{name:"log_message",description:"Append a message to the canvas activity log visible to the user.",inputSchema:{type:"object",properties:{message:{type:"string"}},required:["message"]},handler:({input})=>(server.log(input.message),{ok:!0})}],open(){return server.loadSubscriptions().catch(()=>{}),{url:`http://127.0.0.1:${server.port}`,title:"Azure Storage",status:"ready"}},onClose(){server.close?.()}});session=await joinSession({canvases:[canvas]});
