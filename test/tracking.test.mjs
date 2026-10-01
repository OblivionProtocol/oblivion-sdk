import test from 'node:test';import assert from 'node:assert/strict';
import {OblivionClient} from '../dist/esm/server.js';import {sendTrackedTransaction} from '../dist/esm/wallet.js';
const address='0x'+'11'.repeat(20),hash='0x'+'22'.repeat(32),tracking='x'.repeat(64);
const request={from:address,value:'0x0',data:'0x6000',nonce:'0x0',chainId:'0x1237',gas:'0x10000',gasPrice:'0x1'};
const review={account:address,kind:'execution',valueWei:'0',data:request.data,nonce:'0x0'};
test('SDK registers returned wallet hash; a reporting failure never resubmits',async()=>{
 let sends=0,registered=0;const provider={request:async({method})=>{if(method==='eth_accounts')return[address];if(method==='eth_chainId')return'0x1237';if(method==='eth_sendTransaction'){sends++;return hash;}throw Error(method);}};
 const r=await sendTrackedTransaction(provider,{request,tracking},review,async s=>{registered++;assert.equal(s.hash,hash);return{registered:true,hash};});assert.equal(r.trackingRegistered,true);assert.equal(sends,1);assert.equal(registered,1);
 const failed=await sendTrackedTransaction(provider,{request,tracking},review,async()=>{throw Error('offline');});assert.equal(failed.trackingRegistered,false);assert.equal(failed.hash,hash);assert.equal(sends,2);
 await assert.rejects(sendTrackedTransaction(provider,{request,tracking},{...review,kind:'approval'},async()=>({registered:true,hash})));assert.equal(sends,2);
});
test('server client uses authenticated durable tracking endpoint',async()=>{
 const api=new OblivionClient({apiKey:'a'.repeat(64),fetch:async(url,init)=>{assert.ok(String(url).endsWith('/v1/transactions/track'));assert.deepEqual(JSON.parse(init.body),{tracking,hash});return Response.json({registered:true,hash,state:'queued'});}});
 assert.equal((await api.track(tracking,hash)).registered,true);
});
