/* Explicit host integration contract. Not an automatic patch for the unavailable v15 source. */
(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory();else root.BISHostHooks=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function createHostHooks({world,getPlayer,applyHeal,setDisplayBaseMass,onCue=()=>{}}){
  if(!world||typeof getPlayer!=='function'||typeof applyHeal!=='function'||typeof setDisplayBaseMass!=='function')
   throw new TypeError('world, getPlayer, applyHeal and setDisplayBaseMass are required');
  function flush(){for(const c of world.drainCues())onCue(c);}
  return Object.freeze({
   onFrame(dt){const p=getPlayer();world.tick(dt,{x:p.x,lane:p.lane});flush();return world.playerModifiers();},
   onMutationCommitted({token,choiceId,route,level=1}){
    const p=getPlayer();const r=world.selectMutation({token,id:choiceId,route,level,position:p});flush();return r;
   },
   activate(){const r=world.activate(getPlayer());flush();return r;},
   // Call after resolving size category, before applying the host's ONE injury.
   injuryAmounts({fatal,damage,knockback}){
    if(!Number.isFinite(damage)||damage<0||!Number.isFinite(knockback)||knockback<0)throw new TypeError('Invalid damage');
    if(fatal)return {damage,knockback};
    const m=world.playerModifiers();return {damage:damage*m.damageFactor,knockback:knockback*m.knockbackFactor};
   },
   // Host already consumed this collision. Never call once per overlapping frame.
   onCollisionResolved({token,eventId,outcome,position}){
    const p=getPlayer();const r=world.onCollisionResolved({token,id:eventId,result:outcome,position,player:{hp:p.hp,maxHp:p.maxHp}});
    if(r.accepted&&r.heal>0)applyHeal(r.heal);flush();return r;
   },
   enemyModifiers(enemy){return world.enemyModifiers(enemy);},
   onBossDefeated({token,bossId}){const r=world.defeatBoss({token,bossId,playerMass:getPlayer().absMass});flush();return r;},
   enterNextRound(){
    const before=getPlayer().absMass,transition=world.enterNextRound();if(!transition)return null;
    setDisplayBaseMass(transition.displayBaseMass);
    if(getPlayer().absMass!==before)throw new Error('Host changed absolute mass when setting the display baseline');
    if(transition.shelterSupport>0){const p=getPlayer();applyHeal(Math.max(0,Math.min(transition.shelterSupport,p.maxHp-p.hp)));}
    flush();return transition;
   },
   pause(value){world.setPaused(value);},
   die(reason){const r=world.die(reason);flush();return r;},
   restart(seed){const token=world.restart(seed);flush();return token;}
  });
 }
 return Object.freeze({createHostHooks});
});
