'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {MutationWorld}=require('../src/world-impact.js');
const {createHostHooks}=require('../src/host-hooks.js');
function fixture(){const world=new MutationWorld();const p={x:0,lane:.5,absMass:4,hp:60,maxHp:100,displayBase:1};
 const cues=[];const hooks=createHostHooks({world,getPlayer:()=>p,applyHeal:n=>p.hp+=n,setDisplayBaseMass:n=>p.displayBase=n,onCue:c=>cues.push(c)});return {world,p,hooks,cues};}
test('host callback contract rejects incomplete adapters',()=>assert.throws(()=>createHostHooks({}),/required/));
test('host receives immediate route cue on mutation commit',()=>{const {world,hooks,cues}=fixture();hooks.onMutationCommitted({token:world.token,choiceId:'1',route:'F'});assert.ok(cues.some(c=>c.type==='mutation'))});
test('adapter applies collision healing exactly once',()=>{const {world,p,hooks}=fixture();hooks.onMutationCommitted({token:world.token,choiceId:'1',route:'F'});const e={token:world.token,eventId:'1',outcome:'shatter',position:p};hooks.onCollisionResolved(e);hooks.onCollisionResolved(e);assert.equal(p.hp,62)});
test('adapter respects fatal collision even while guarded',()=>{const {world,hooks}=fixture();hooks.onMutationCommitted({token:world.token,choiceId:'1',route:'A'});hooks.activate();assert.deepEqual(hooks.injuryAmounts({fatal:true,damage:100,knockback:30}),{damage:100,knockback:30});assert.deepEqual(hooks.injuryAmounts({fatal:false,damage:100,knockback:30}),{damage:60,knockback:15})});
test('cross-round adapter changes only projection and gives support once',()=>{const {world,p,hooks}=fixture();hooks.onMutationCommitted({token:world.token,choiceId:'1',route:'A'});hooks.onBossDefeated({token:world.token,bossId:'b1'});hooks.enterNextRound();assert.equal(p.absMass,4);assert.equal(p.displayBase,4);assert.equal(p.hp,64);assert.equal(hooks.enterNextRound(),null);assert.equal(p.hp,64)});
test('adapter detects an incorrectly wired host that resets real strength',()=>{const world=new MutationWorld(),p={x:0,lane:.5,absMass:9,hp:50,maxHp:100};const h=createHostHooks({world,getPlayer:()=>p,applyHeal:()=>{},setDisplayBaseMass:()=>p.absMass=1});h.onBossDefeated({token:world.token,bossId:'b'});assert.throws(()=>h.enterNextRound(),/absolute mass/)});
