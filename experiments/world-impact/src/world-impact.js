/* 大就是强：变异—道路—跨轮回声 / integration candidate 0.1.0
 * Pure JS, no DOM, no storage and no network. NOT an online release.
 * Host keeps sole authority over mass, collision classification and save data.
 * Coordinates: x = world travel unit; lane = normalized road depth [0,1].
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BISWorld = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = '0.1.0';
  const KEYS = Object.freeze(['M', 'A', 'N', 'F']);
  const REGIONS = Object.freeze([
    { id: 'rural', name: '故乡乡野', boss: '裂田巨獠' },
    { id: 'county', name: '县城断电区', boss: '高压猎王' },
    { id: 'city', name: '高楼封锁线', boss: '孢殖母体' },
    { id: 'frontier', name: '全球异变前线', boss: '天穹巨人' }
  ]);
  const ROUTES = Object.freeze({
    M: { name: '巨臂', action: '震地', color: '#f58e61', mark: 'crack',
      instant: '前方裂地：追击者失衡', benefit: '冲击波打断附近追击，碰撞大小规则不变',
      cost: '震动会暴露行进方向', echo: '震裂乡道被发现，前路部署稳脚追击者', tag: '稳脚',
      witness: '路通了！小心地上的裂口。', landmark: '通路已打开' },
    A: { name: '甲壳', action: '架壳', color: '#70d2d9', mark: 'shell',
      instant: '架壳2秒：减伤、减少击退', benefit: '非致命碰撞减伤40%；致命差距仍然致命',
      cost: '架壳期间换道速度降低', echo: '壳片被带往前路，避难点获得护板', tag: '侧袭',
      witness: '这块壳能给孩子挡风。', landmark: '护壳棚已加固' },
    N: { name: '神经', action: '放电', color: '#f1d679', mark: 'charge',
      instant: '电流打断追击，附近路灯复亮', benefit: '短时换道加速；绝缘目标仍可按体型撞赢',
      cost: '亮起的线路也暴露了你', echo: '复电信号沿线传来，绝缘追击者已出现', tag: '绝缘',
      witness: '灯亮了！沿这条路撤离。', landmark: '路灯与路障复电' },
    F: { name: '菌群', action: '播种', color: '#91ce79', mark: 'fungus',
      instant: '脚下菌毯展开：追击者减速', benefit: '菌毯减速；其上取得胜利恢复少量体力',
      cost: '菌丝会附着田地与路边设施', echo: '绿色痕迹传到前路，入口设置隔离带', tag: '避菌',
      witness: '草长得太快了，先别踩进去。', landmark: '路边出现菌带' }
  });
  const LIMITS = Object.freeze({ fields: 40, landmarks: 12, cues: 24, journal: 64,
    history: 8, eventIdsPerRound: 512, adaptationEvery: 5, cooldown: 6 });
  const emptyRoutes = () => ({ M: 0, A: 0, N: 0, F: 0 });
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const clone = o => JSON.parse(JSON.stringify(o));
  function finite(n, name, min = -1e12, max = 1e12) {
    if (typeof n !== 'number' || !Number.isFinite(n) || n < min || n > max)
      throw new TypeError(name + ' must be a finite number in range');
    return n;
  }
  function point(p) {
    if (!p || typeof p !== 'object') throw new TypeError('Position is required');
    return { x: finite(p.x, 'x'), lane: finite(p.lane, 'lane', 0, 1) };
  }
  function eventId(id) {
    if (typeof id !== 'string' || !id.length || id.length > 80) throw new TypeError('Stable event id is required');
    return id;
  }
  function requireKey(k) { if (!KEYS.includes(k)) throw new TypeError('Unknown route: ' + k); }
  function classifyMass(playerMass, enemyMass) {
    const ratio = finite(playerMass, 'playerMass', Number.MIN_VALUE) /
      finite(enemyMass, 'enemyMass', Number.MIN_VALUE);
    if (ratio >= 2.35) return { code: 'crush', label: '碾碎', win: true, fatal: false };
    if (ratio >= 1.55) return { code: 'shatter', label: '撞碎', win: true, fatal: false };
    if (ratio >= 1.04) return { code: 'launch', label: '撞飞', win: true, fatal: false };
    if (ratio >= .78) return { code: 'retreat', label: '撞退', win: false, fatal: false };
    if (ratio >= .52) return { code: 'airborne', label: '重击', win: false, fatal: false };
    return { code: 'fatal', label: '必死', win: false, fatal: true };
  }
  // One camera scale for both actors; do not clamp enemies independently.
  // Use a silhouette-area normalizer in the host for different sprite shapes.
  function projectSizes(playerMass, enemyMass, roundBaseMass, basePixels = 26) {
    finite(roundBaseMass, 'roundBaseMass', Number.MIN_VALUE);
    finite(basePixels, 'basePixels', 1, 1000);
    finite(playerMass, 'playerMass', Number.MIN_VALUE);
    finite(enemyMass, 'enemyMass', Number.MIN_VALUE);
    const ratio = Math.sqrt(playerMass / roundBaseMass);
    const zoom = ratio > 1.55 ? 1.55 / ratio : 1;
    return { player: basePixels * ratio * zoom,
      enemy: basePixels * Math.sqrt(enemyMass / roundBaseMass) * zoom, zoom };
  }
  let instanceCounter = 0;
  class MutationWorld {
    constructor({ seed = 1 } = {}) {
      finite(seed, 'seed', 0, 0xffffffff);
      this._instance = ++instanceCounter;
      this._generation = 0;
      this._seed = seed >>> 0;
      this._counter = 0;
      this._seen = new Set();
      this._cues = [];
      this.state = { version: 1, seed: this._seed, round: 0, phase: 'running', paused: false,
        time: 0, cooldownUntil: 0, guardUntil: 0, hasteUntil: 0,
        routes: emptyRoutes(), primary: null, totals: emptyRoutes(), local: emptyRoutes(),
        currentMaxX: -1e12, lastTrailX: -1e12, fields: [], landmarks: [],
        journal: [], history: [], entryEchoes: [], roundBaseMass: 1, summary: null };
    }
    get token() { return this._instance + ':' + this._generation + ':' + this._seed + ':' + this.state.round; }
    get region() { return REGIONS[this.state.round % REGIONS.length]; }
    get ready() { return this._playing() && this.state.primary !== null &&
      this.state.time >= this.state.cooldownUntil; }
    _playing() { return this.state.phase === 'running' && !this.state.paused; }
    _cue(type, text, route = null) {
      const c = { id: ++this._counter, type, text, route, at: this.state.time };
      this._cues.push(c); if (this._cues.length > LIMITS.cues) this._cues.shift();
      return c;
    }
    _remember(route, cause, text) {
      const s = this.state;
      s.journal.push({ id: ++this._counter, round: s.round, region: this.region.name,
        route, cause, text, at: s.time });
      if (s.journal.length > LIMITS.journal) s.journal.shift();
    }
    _credit(route, cause) {
      this.state.local[route] = Math.min(9999, this.state.local[route] + 1);
      this.state.totals[route] = Math.min(999999, this.state.totals[route] + 1);
      if (this.state.local[route] === 1)
        this._remember(route, cause, ROUTES[route].cost);
    }
    _accept(token, id, critical = false) {
      if (!this._playing() || token !== this.token) return false;
      if (typeof id !== 'string' || id.length < 1 || id.length > 100)
        throw new TypeError('A stable event id (1–100 characters) is required');
      if (this._seen.has(id)) return false;
      // Refuse, rather than evict and accidentally re-award an old collision.
      if (!critical && this._seen.size >= LIMITS.eventIdsPerRound) return false;
      this._seen.add(id); return true;
    }
    _field(route, p, source) {
      const s = this.state;
      const length = { M: 112, A: 76, N: 100, F: 132 }[route];
      const f = { id: ++this._counter, route, kind: ROUTES[route].mark,
        x: p.x, lane: p.lane, length, laneRadius: .20,
        born: s.time, transientUntil: s.time + (route === 'N' ? 1.0 : .45), source };
      s.fields.push(f); if (s.fields.length > LIMITS.fields) s.fields.shift();
      this._credit(route, source);
      for (const l of s.landmarks) {
        if (Math.abs(l.x - p.x) > length || Math.abs(l.lane - p.lane) > .35) continue;
        if (l.effects.includes(route)) continue;
        if (route === 'N' && !['power', 'shelter'].includes(l.kind)) continue;
        if (route === 'A' && !['shelter', 'barrier'].includes(l.kind)) continue;
        l.effects.push(route); l.lastRoute = route;
        this._remember(route, source, ROUTES[route].landmark + '：' + l.name);
        this._cue('witness', ROUTES[route].witness, route);
      }
      return f;
    }
    setPaused(value) { this.state.paused = Boolean(value); }
    tick(dt, position) {
      finite(dt, 'dt', 0, 1);
      if (!this._playing()) return;
      const p = point(position);
      // Caller feeds ordinary simulation steps, not a wall-clock resume gap.
      this.state.time += Math.min(dt, .1);
      const s = this.state;
      s.currentMaxX = Math.max(s.currentMaxX, p.x);
      if (s.routes.F && p.x - s.lastTrailX >= 72 && p.x >= s.currentMaxX - 1) {
        s.lastTrailX = p.x;
        this._field('F', { x: p.x - 24, lane: p.lane }, 'travel');
      }
      // Keep bounded nearby decals; region totals/journal preserve consequences.
      s.fields = s.fields.filter(f => f.x + f.length >= p.x - 700);
    }
    registerLandmark({ id, name, x, lane = .5, kind = 'shelter' }) {
      if (!this._playing()) return false;
      const p = point({ x, lane });
      if (typeof id !== 'string' || !id || typeof name !== 'string' || name.length > 60)
        throw new TypeError('Landmark id and short name are required');
      if (!['shelter', 'power', 'barrier', 'field'].includes(kind)) throw new TypeError('Unknown landmark kind');
      const a = this.state.landmarks;
      if (a.some(l => l.id === id)) return false;
      if (a.length >= LIMITS.landmarks) return false;
      const inherited = this.state.entryEchoes.map(e => e.route).filter(route =>
        (route !== 'N' || ['power', 'shelter'].includes(kind)) &&
        (route !== 'A' || ['shelter', 'barrier'].includes(kind)));
      a.push({ id, name, x: p.x, lane: p.lane, kind, effects: inherited,
        inheritedEffects: inherited.slice(), lastRoute: inherited[inherited.length - 1] || null });
      return true;
    }
    selectMutation({ token, id, route, level = 1, position }) {
      requireKey(route); finite(level, 'level', 1, 3);
      if (!Number.isInteger(level)) throw new TypeError('level must be an integer');
      const p = point(position);
      if (this.state.routes[route] >= level) return { accepted: false, reason: 'already-owned' };
      if (!this._accept(token, 'choice:' + eventId(id), true)) return { accepted: false, reason: 'stale-or-duplicate' };
      this.state.routes[route] = level;
      this.state.primary = route;
      this.state.cooldownUntil = this.state.time;
      this._field(route, { x: p.x + 20, lane: p.lane }, 'mutation-selected');
      if (route === 'F') this.state.lastTrailX = p.x;
      this._cue('mutation', ROUTES[route].instant, route);
      return { accepted: true, route, level };
    }
    setPrimary(route) {
      requireKey(route);
      if (!this._playing() || !this.state.routes[route]) return false;
      this.state.primary = route; return true;
    }
    activate(position) {
      const p = point(position);
      if (!this.ready) return { accepted: false, reason: 'not-ready' };
      const s = this.state, route = s.primary;
      s.cooldownUntil = s.time + LIMITS.cooldown;
      this._field(route, { x: p.x + (route === 'F' ? -14 : 42), lane: p.lane }, 'active');
      if (route === 'A') s.guardUntil = s.time + 2;
      if (route === 'N') s.hasteUntil = s.time + 1.2;
      // Existing hybrids keep their secondary environmental effects; bounded.
      for (const k of KEYS) if (k !== route && s.routes[k])
        this._field(k, { x: p.x - 12, lane: p.lane }, 'hybrid-secondary');
      this._cue('ability', ROUTES[route].instant, route);
      return { accepted: true, route, cooldown: LIMITS.cooldown };
    }
    playerModifiers() {
      const s = this.state, playing = s.phase === 'running';
      const guard = playing && s.guardUntil > s.time;
      const haste = playing && s.hasteUntil > s.time;
      return { damageFactor: guard ? .6 : 1, knockbackFactor: guard ? .5 : 1,
        laneSpeedFactor: (guard ? .78 : 1) * (haste ? 1.22 : 1),
        guard, haste, fatalProtection: false };
    }
    enemyModifiers(enemy) {
      const p = point(enemy); finite(enemy.absMass, 'enemy.absMass', Number.MIN_VALUE);
      if (this.state.phase !== 'running') return { speedFactor: 1, stunned: false, source: null };
      let speedFactor = 1, stunned = false, source = null;
      for (const f of this.state.fields) {
        if (Math.abs(f.x - p.x) > f.length * .5 || Math.abs(f.lane - p.lane) > f.laneRadius) continue;
        if (f.route === 'F') {
          const slow = enemy.adaptation === 'F' ? .9 : .7;
          if (slow < speedFactor) { speedFactor = slow; source = 'F'; }
        }
        if (f.route === 'M') {
          speedFactor = Math.min(speedFactor, enemy.adaptation === 'M' ? .97 : .88);
          if (this.state.time < f.transientUntil && enemy.adaptation !== 'M') { stunned = true; source = 'M'; }
        }
        if (f.route === 'N' && this.state.time < f.transientUntil && enemy.adaptation !== 'N') {
          stunned = true; source = 'N';
        }
      }
      return { speedFactor: stunned ? 0 : speedFactor, stunned, source };
    }
    onCollisionResolved({ token, id, result, position, player }) {
      const p = point(position);
      if (!['crush', 'shatter', 'launch', 'retreat', 'airborne', 'fatal'].includes(result))
        throw new TypeError('Unknown resolved collision outcome');
      finite(player.hp, 'hp', 0); finite(player.maxHp, 'maxHp', 1);
      if (!this._accept(token, 'collision:' + eventId(id), result === 'fatal')) return { accepted: false, heal: 0 };
      if (result === 'fatal') { this.die('体型差距过大'); return { accepted: true, heal: 0, fatal: true }; }
      const win = ['crush', 'shatter', 'launch'].includes(result);
      let heal = 0;
      if (win && this.state.routes.M && result !== 'launch') this._field('M', p, 'strong-collision');
      if (!win && this.state.routes.A) this._field('A', p, 'shell-impact');
      if (win && this.state.routes.F && this.state.fields.some(f => f.route === 'F' &&
          Math.abs(f.x - p.x) <= f.length / 2 && Math.abs(f.lane - p.lane) <= f.laneRadius)) {
        heal = Math.max(0, Math.min(2, player.maxHp - player.hp));
        if (heal) this._cue('heal', '菌毯反哺：体力 +' + heal, 'F');
      }
      return { accepted: true, heal, fatal: false };
    }
    _echoes() {
      const s = this.state;
      return KEYS.filter(k => s.totals[k] > 0).map(k => {
        const inherited = s.entryEchoes.find(e => e.route === k);
        if (!s.local[k] && inherited) return clone(inherited);
        return { route: k,
        fromRound: s.round, fromRegion: this.region.name, count: s.local[k],
        cause: { M: '留下震裂路段', A: '留下可利用壳片', N: '留下复电线路', F: '留下菌群道路' }[k],
        consequence: ROUTES[k].echo, tag: ROUTES[k].tag };
      });
    }
    defeatBoss({ token, bossId, playerMass }) {
      finite(playerMass, 'playerMass', Number.MIN_VALUE);
      if (!this._accept(token, 'boss:' + eventId(bossId), true)) return null;
      const s = this.state;
      const summary = { round: s.round, region: this.region.name, boss: this.region.boss,
        routes: clone(s.routes), traces: clone(s.local), echoes: this._echoes(),
        nextRegion: REGIONS[(s.round + 1) % REGIONS.length].name,
        carriedMass: playerMass, nextDisplayBase: playerMass };
      s.summary = summary; s.phase = 'intermission';
      s.history.push(clone(summary)); if (s.history.length > LIMITS.history) s.history.shift();
      this._cue('clear', 'Boss已击败：能力与道路后果保留');
      return clone(summary);
    }
    enterNextRound() {
      const s = this.state;
      if (s.phase !== 'intermission' || !s.summary) return null;
      s.entryEchoes = clone(s.summary.echoes);
      s.roundBaseMass = s.summary.carriedMass;
      s.round += 1; s.phase = 'running'; s.paused = false;
      s.local = emptyRoutes(); s.fields = []; s.landmarks = [];
      s.lastTrailX = -1e12; s.currentMaxX = -1e12;
      s.cooldownUntil = s.time; s.guardUntil = 0; s.hasteUntil = 0;
      s.summary = null; this._seen.clear();
      for (const e of s.entryEchoes) this._cue('echo', e.fromRegion + '：' + e.cause + ' → ' + e.consequence, e.route);
      return { region: clone(this.region), round: s.round, token: this.token,
        displayBaseMass: s.roundBaseMass, preserveAbsoluteMass: true,
        shelterSupport: s.entryEchoes.some(e => e.route === 'A') ? 4 : 0,
        entryEchoes: clone(s.entryEchoes) };
    }
    decorateSpawn(index) {
      finite(index, 'spawnIndex', 0, 1e9);
      if (!Number.isInteger(index)) throw new TypeError('spawnIndex must be integer');
      const echoes = this.state.entryEchoes;
      if (!echoes.length || (index + 1) % LIMITS.adaptationEvery !== 0) return { adaptation: null, tag: '' };
      const e = echoes[(Math.floor(index / LIMITS.adaptationEvery) + this._seed) % echoes.length];
      // The host MUST visibly mark these variants; do not change their mass.
      return { adaptation: e.route, tag: e.tag, sourceRegion: e.fromRegion, sourceCause: e.cause };
    }
    die(reason = '本局结束') {
      if (this.state.phase === 'dead') return false;
      const s = this.state;
      s.phase = 'dead'; s.paused = false;
      s.fields = []; s.landmarks = []; s.entryEchoes = [];
      s.guardUntil = s.hasteUntil = s.cooldownUntil = 0;
      this._cues = [];
      this._cue('death', reason + '；重新开始将清空本局变异和世界影响');
      return true;
    }
    restart(seed = this._seed + 1) {
      const replacement = new MutationWorld({ seed: seed >>> 0 });
      this._generation += 1;
      this._seed = replacement._seed; this._counter = 0; this._seen = new Set(); this._cues = [];
      this.state = replacement.state;
      return this.token;
    }
    drainCues() { const out = this._cues; this._cues = []; return out; }
    inspect() { return clone(this.state); }
  }
  return Object.freeze({ VERSION, KEYS, REGIONS, ROUTES, LIMITS, MutationWorld, classifyMass, projectSizes });
});
