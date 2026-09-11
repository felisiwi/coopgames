// One dinosaur: physics, state machine, hitboxes. Knows nothing about the
// network or about drawing — game.js drives it and draw.js reads it. That
// split is what lets the same class run a locally-controlled dino, a
// keyboard-2P dino, and a remote dino whose pad is always idle.
import { STAGE, PHYS, BODY, PEP, MOVES, BLOCK, HURT } from './config.js';

// idle | walk | crouch | air | attack | block | hurt | flop
export class Fighter {
  constructor({ x, facing, skin, label }) {
    this.skin = skin;
    this.label = label;
    this.x = x;
    this.y = STAGE.GROUND_Y;
    this.vx = 0;
    this.vy = 0;
    this.facing = facing;
    this.state = 'idle';
    this.stateTime = 0;
    this.move = null;
    this.attackId = 0;
    this.pep = PEP.MAX;
    this.pepDelay = 0;
    this.onGround = true;
    this.anim = 0;        // free-running clock for idle bob / leg swing
    this.flashTime = 0;   // brief white flash when hit, for readability
    this.dustBurst = 0;   // set to 1 on landing, decays; draw.js reads it
  }

  get crouching() {
    return this.state === 'crouch';
  }

  get height() {
    return this.crouching ? BODY.CROUCH_H : BODY.H;
  }

  // Where a hit can connect. Feet-anchored, so the box grows upward.
  hurtbox() {
    return {
      x: this.x - BODY.W / 2,
      y: this.y - this.height,
      w: BODY.W,
      h: this.height,
    };
  }

  // The rect that hits the opponent, or null outside the active window.
  activeHitbox() {
    if (this.state !== 'attack' || !this.move) return null;
    const { startup, active, box } = this.move;
    if (this.stateTime < startup || this.stateTime >= startup + active) return null;
    return {
      x: this.facing === 1 ? this.x + box.x : this.x - box.x - box.w,
      y: this.y + box.y,
      w: box.w,
      h: box.h,
    };
  }

  // Which slice of the attack we're in, for the renderer's pose blending.
  attackPhase() {
    if (this.state !== 'attack' || !this.move) return null;
    const { startup, active, recovery } = this.move;
    if (this.stateTime < startup) {
      return { phase: 'startup', t: this.stateTime / startup };
    }
    if (this.stateTime < startup + active) {
      return { phase: 'active', t: (this.stateTime - startup) / active };
    }
    return {
      phase: 'recovery',
      t: Math.min(1, (this.stateTime - startup - active) / recovery),
    };
  }

  setState(state) {
    if (this.state === state) return;
    this.state = state;
    this.stateTime = 0;
    if (state !== 'attack') this.move = null;
  }

  startAttack(moveName) {
    this.move = MOVES[moveName];
    this.state = 'attack';
    this.stateTime = 0;
    this.attackId += 1; // so a single swing can only land once
  }

  // Called by game.js when the OTHER fighter's hitbox overlaps this one.
  // Returns the resolved hit so the caller can spark and announce it.
  applyHit({ damage, knockback, lift, fromDir }) {
    // You only block what you are facing — turning your back on a tail
    // swipe eats it in full.
    const blocked = this.state === 'block' && this.facing === -fromDir;
    const dmg = blocked ? damage * BLOCK.DAMAGE_SCALE : damage;
    const kb = blocked ? knockback * BLOCK.KNOCKBACK_SCALE : knockback;

    this.pep = Math.max(0, this.pep - dmg);
    this.pepDelay = PEP.REGEN_DELAY;
    this.vx = fromDir * kb;
    if (!blocked) {
      this.vy = lift;
      this.onGround = false;
    }
    this.flashTime = 0.12;

    if (this.pep <= 0) {
      this.setState('flop');
    } else if (blocked) {
      this.setState('block');
      this.stateTime = -HURT.BLOCK_STUN; // negative time == still in blockstun
    } else {
      this.setState('hurt');
    }
    return { blocked, damage: dmg };
  }

  get flopped() {
    return this.state === 'flop';
  }

  // dt in seconds, pad from input.js, opponent for auto-facing.
  update(dt, pad, opponent) {
    this.anim += dt;
    this.stateTime += dt;
    this.flashTime = Math.max(0, this.flashTime - dt);
    this.dustBurst = Math.max(0, this.dustBurst - dt * 3);
    if (this.pepDelay > 0) this.pepDelay -= dt;

    if (this.state === 'flop') {
      this.vx *= Math.exp(-PHYS.FRICTION * dt);
      this.integrate(dt);
      return;
    }

    // Fighters always turn to face each other, like every 2D fighter since
    // Street Fighter II — except mid-attack, mid-hurt or airborne, where a
    // sudden flip would look wrong and would let you cheat blocks.
    const canTurn = ['idle', 'walk', 'crouch', 'block'].includes(this.state);
    if (opponent && this.onGround && canTurn) {
      this.facing = opponent.x >= this.x ? 1 : -1;
    }

    if (this.state === 'hurt') {
      if (this.stateTime >= HURT.STUN) this.setState(this.onGround ? 'idle' : 'air');
    } else if (this.state === 'attack') {
      const { startup, active, recovery } = this.move;
      if (this.stateTime >= startup + active + recovery) {
        this.setState(this.onGround ? 'idle' : 'air');
      }
    } else {
      this.handleActions(pad);
    }

    this.handleMovement(dt, pad);
    this.integrate(dt);
    this.regen(dt, pad);
  }

  handleActions(pad) {
    // Attacks are edge-triggered so holding the key does not machine-gun.
    if (pad.pressed.chomp) {
      this.startAttack('chomp');
      return;
    }
    if (pad.pressed.tail) {
      this.startAttack('tail');
      return;
    }

    if (!this.onGround) {
      if (this.state !== 'air') this.setState('air');
      return;
    }

    if (pad.held.block) {
      if (this.state !== 'block') this.setState('block');
      return;
    }
    if (this.state === 'block' && this.stateTime < 0) return; // blockstun

    if (pad.pressed.up) {
      this.vy = PHYS.JUMP_VELOCITY;
      this.onGround = false;
      this.setState('air');
      return;
    }
    if (pad.held.down) {
      this.setState('crouch');
      return;
    }
    const moving = pad.held.left !== pad.held.right;
    this.setState(moving ? 'walk' : 'idle');
  }

  handleMovement(dt, pad) {
    const frozen = ['attack', 'hurt', 'flop'].includes(this.state);
    const dir = frozen ? 0 : (pad.held.right ? 1 : 0) - (pad.held.left ? 1 : 0);

    if (this.onGround) {
      let speed = 0;
      if (this.state === 'walk') speed = PHYS.WALK_SPEED;
      else if (this.state === 'crouch') speed = PHYS.CROUCH_SPEED;
      // Blocking, attacking and being hit all leave you at the mercy of
      // whatever knockback you are already carrying.
      const drive = dir * speed;
      this.vx = drive !== 0 ? drive : this.vx * Math.exp(-PHYS.FRICTION * dt);
    } else {
      this.vx += dir * PHYS.WALK_SPEED * PHYS.AIR_CONTROL * dt * 6;
      const cap = PHYS.WALK_SPEED * 1.6;
      this.vx = Math.max(-cap, Math.min(cap, this.vx));
    }
  }

  integrate(dt) {
    if (!this.onGround) this.vy += PHYS.GRAVITY * dt;

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    const min = STAGE.WALL_PAD;
    const max = STAGE.W - STAGE.WALL_PAD;
    if (this.x < min) {
      this.x = min;
      this.vx = 0;
    }
    if (this.x > max) {
      this.x = max;
      this.vx = 0;
    }

    if (this.y >= STAGE.GROUND_Y) {
      if (!this.onGround) {
        this.dustBurst = 1;
        if (this.state === 'air') this.setState('idle');
        else if (this.state === 'hurt') this.stateTime = 0; // full stun on landing
      }
      this.y = STAGE.GROUND_Y;
      this.vy = 0;
      this.onGround = true;
    }
  }

  regen(dt, pad) {
    if (this.state === 'block' && pad.held.block) {
      // Holding block bleeds pep, so turtling is a choice with a cost.
      // Floored at 1 so blocking alone can never flop you.
      this.pep = Math.max(1, this.pep - BLOCK.PEP_COST * dt);
      return;
    }
    const resting = this.onGround && ['idle', 'walk'].includes(this.state);
    if (resting && this.pepDelay <= 0) {
      this.pep = Math.min(PEP.MAX, this.pep + PEP.REGEN * dt);
    }
  }

  // Round reset. Keeps skin and label, drops everything else.
  reset(x, facing) {
    this.x = x;
    this.y = STAGE.GROUND_Y;
    this.vx = 0;
    this.vy = 0;
    this.facing = facing;
    this.state = 'idle';
    this.stateTime = 0;
    this.move = null;
    this.pep = PEP.MAX;
    this.pepDelay = 0;
    this.onGround = true;
    this.flashTime = 0;
    this.dustBurst = 0;
  }
}

export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Keep two dinos from standing inside each other. Each peer only ever
// pushes ITSELF, by half the overlap — the other peer does the same on its
// own screen, so the pair separates symmetrically without either side
// moving a fighter it does not own. Pass bothOwned when one caller drives
// both bodies (couch mode) and each still takes its own half.
export function pushApart(self, other, bothOwned = false) {
  // Someone lying on their back is not in the way.
  if (self.flopped || other.flopped) return;
  // Only bodies at roughly the same height shove each other, so you can
  // still jump right over your friend.
  if (Math.abs(self.y - other.y) > BODY.H * 0.55) return;

  const overlap = BODY.PUSH_W - Math.abs(self.x - other.x);
  if (overlap <= 0) return;

  const min = STAGE.WALL_PAD;
  const max = STAGE.W - STAGE.WALL_PAD;
  const dir = self.x <= other.x ? -1 : 1; // push self away from other
  const clamp = (v) => Math.max(min, Math.min(max, v));

  self.x = clamp(self.x + dir * overlap * 0.5);
  if (bothOwned) other.x = clamp(other.x - dir * overlap * 0.5);
}
