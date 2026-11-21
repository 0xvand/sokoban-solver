// Sokoban solver — entry for make.fun sokoban-solver-01-run-20261121.
//
// Approach: the level generator guarantees a rigid structure — one horizontal
// hallway where the player starts, and 1-4 small rooms (3-4 boxes each) that
// open onto it through a single door. A box can never leave its room, so the
// level's push optimum is the sum of the rooms' push optima. This solver
// decomposes the level into hallway + rooms, solves every room exactly with
// push-level A* (matching heuristic over precomputed push distances, dead
// square and freeze pruning), then stitches the rooms' push sequences into
// one move string and verifies it by replaying it before writing anything.
//
// The search is budgeted by expanded-node counts only — never by the clock —
// so two runs on the same input produce byte-identical output.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const INPUT_DIR = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Fixed direction order (deterministic search): up, down, left, right.
const DIRS = [
  { dx: 0, dy: -1, ch: 'u' },
  { dx: 0, dy: 1, ch: 'd' },
  { dx: -1, dy: 0, ch: 'l' },
  { dx: 1, dy: 0, ch: 'r' },
];

// ---------------------------------------------------------------------------
// Parsing. Mirrors the checker's reading of XSB: rows are the non-empty lines,
// the grid is as wide as the longest row, and cells past a short row's end are
// walls. '#' wall, '.' goal, '$' box, '*' box on goal, '@' player, '+' player
// on goal, anything else open floor.
// ---------------------------------------------------------------------------
function parseLevel(text) {
  const rows = text.split('\n').filter((r) => r.length > 0);
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const size = w * h;
  const wall = new Uint8Array(size).fill(1);
  const goal = new Uint8Array(size);
  const boxes = [];
  let player = -1;
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      const i = y * w + x;
      if (ch === '#') continue;
      wall[i] = 0;
      if (ch === '.' || ch === '*' || ch === '+') goal[i] = 1;
      if (ch === '$' || ch === '*') boxes.push(i);
      if (ch === '@' || ch === '+') player = i;
    }
  });
  boxes.sort((a, b) => a - b);
  const goals = [];
  for (let i = 0; i < size; i++) if (goal[i]) goals.push(i);
  return { w, h, size, wall, goal, boxes, goals, player };
}

// ---------------------------------------------------------------------------
// Reverse pull reachability. live[i] = 1 when a box on square i can still be
// pushed onto some goal (ignoring the other boxes and where the player can
// stand — an over-approximation, so pruning with it is always safe). A push
// moves a box from a to a+d and needs the player on a-d; reversed: a box on t
// may have come from a = t-d when both a and a-d are open floor.
// ---------------------------------------------------------------------------
function computeLiveSquares(level) {
  const { w, h, wall, goal, size } = level;
  const live = new Uint8Array(size);
  const queue = [];
  for (let i = 0; i < size; i++) {
    if (goal[i]) {
      live[i] = 1;
      queue.push(i);
    }
  }
  for (let head = 0; head < queue.length; head++) {
    const t = queue[head];
    const tx = t % w;
    const ty = (t / w) | 0;
    for (const { dx, dy } of DIRS) {
      const ax = tx - dx;
      const ay = ty - dy;
      const sx = ax - dx;
      const sy = ay - dy;
      if (ax < 0 || ay < 0 || sx < 0 || sy < 0 || ax >= w || ay >= h || sx >= w || sy >= h) continue;
      const a = ay * w + ax;
      const stand = sy * w + sx;
      if (wall[a] || wall[stand] || live[a]) continue;
      live[a] = 1;
      queue.push(a);
    }
  }
  return live;
}

// ---------------------------------------------------------------------------
// Push distances: for every goal g, distByGoal[g][i] = the fewest pushes that
// bring a box from square i to g when other boxes are ignored and the player
// can stand on any open square. -1 when unreachable. These feed the matching
// heuristic, which stays admissible because every real push sequence must
// move each box along pushes at least this long.
// ---------------------------------------------------------------------------
function computePushDistances(level) {
  const { w, h, wall, goals, size } = level;
  const distByGoal = new Map();
  for (const g of goals) {
    const dist = new Int32Array(size).fill(-1);
    dist[g] = 0;
    const queue = [g];
    for (let head = 0; head < queue.length; head++) {
      const t = queue[head];
      const tx = t % w;
      const ty = (t / w) | 0;
      for (const { dx, dy } of DIRS) {
        const ax = tx - dx;
        const ay = ty - dy;
        const sx = ax - dx;
        const sy = ay - dy;
        if (ax < 0 || ay < 0 || sx < 0 || sy < 0 || ax >= w || ay >= h || sx >= w || sy >= h) continue;
        const a = ay * w + ax;
        const stand = sy * w + sx;
        if (wall[a] || wall[stand] || dist[a] !== -1) continue;
        dist[a] = dist[t] + 1;
        queue.push(a);
      }
    }
    distByGoal.set(g, dist);
  }
  return distByGoal;
}

// ---------------------------------------------------------------------------
// Decomposition. The hallway is the player's row: the generator lays it one
// square wide across the whole board, so every interior cell of that row is
// open floor. Rooms are the connected components of the remaining floor.
// Each room touches the hallway through its door — the hallway squares next
// to the component. A box may sit on its room's door squares but must never
// be pushed further into the hallway, so a room's box squares are its own
// cells plus its door squares; the player may roam the room plus the whole
// hallway row.
//
// Returns a list of rooms, or null when the level does not have the expected
// shape (the caller then falls back to solving the level as one region).
// ---------------------------------------------------------------------------
function decompose(level) {
  const { w, h, wall, goal, boxes, goals, player, size } = level;
  const hallY = (player / w) | 0;
  for (let x = 1; x < w - 1; x++) {
    if (wall[hallY * w + x]) return null; // hallway row is not fully open
  }
  const inHallRow = (i) => ((i / w) | 0) === hallY;

  const seen = new Uint8Array(size);
  const rooms = [];
  let coveredBoxes = 0;
  let coveredGoals = 0;
  for (let s = 0; s < size; s++) {
    if (wall[s] || inHallRow(s) || seen[s]) continue;
    // Flood one off-hallway component.
    const cells = [];
    const stack = [s];
    seen[s] = 1;
    while (stack.length > 0) {
      const c = stack.pop();
      cells.push(c);
      const cx = c % w;
      const cy = (c / w) | 0;
      for (const { dx, dy } of DIRS) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const n = ny * w + nx;
        if (wall[n] || inHallRow(n) || seen[n]) continue;
        seen[n] = 1;
        stack.push(n);
      }
    }
    const cellMask = new Uint8Array(size);
    for (const c of cells) cellMask[c] = 1;
    // Door squares: hallway-row squares adjacent to this component.
    const doorMask = new Uint8Array(size);
    const doorList = [];
    for (const c of cells) {
      const cx = c % w;
      const cy = (c / w) | 0;
      if (Math.abs(cy - hallY) !== 1) continue;
      const d = hallY * w + cx;
      if (!doorMask[d]) {
        doorMask[d] = 1;
        doorList.push(d);
      }
    }
    if (doorList.length === 0) return null; // a floor region the player cannot reach
    const roomBoxes = boxes.filter((b) => cellMask[b] === 1 || doorMask[b] === 1);
    const roomGoals = goals.filter((g) => cellMask[g] === 1 || doorMask[g] === 1);
    if (roomBoxes.length === 0 && roomGoals.length === 0) continue; // inert pocket
    if (roomBoxes.length !== roomGoals.length) return null;
    if (roomBoxes.length < 1 || roomBoxes.length > 4) return null;
    coveredBoxes += roomBoxes.length;
    coveredGoals += roomGoals.length;
    // Squares a box of this room may occupy: the room's own cells, plus a
    // door square only when it carries one of the room's goals. A box parked
    // on a plain hallway square could block the one-wide hallway for the
    // rooms stitched after this one, and the room's optimum never needs it:
    // the generator solves each room from its door, inside the room.
    const boxMask = new Uint8Array(size);
    for (let i = 0; i < size; i++) boxMask[i] = cellMask[i] | (doorMask[i] & goal[i]);
    // Squares the player may occupy while working this room: room + hallway.
    const playerMask = new Uint8Array(size);
    for (const c of cells) playerMask[c] = 1;
    for (let x = 0; x < w; x++) {
      const i = hallY * w + x;
      if (!wall[i]) playerMask[i] = 1;
    }
    rooms.push({ boxes: roomBoxes, goals: roomGoals, boxMask, playerMask, firstCell: cells[0] });
  }
  if (rooms.length === 0) return null;
  if (coveredBoxes !== boxes.length || coveredGoals !== goals.length) return null;
  rooms.sort((a, b) => a.firstCell - b.firstCell);
  return rooms;
}

// ---------------------------------------------------------------------------
// Matching heuristic: the cheapest assignment of boxes to distinct goals,
// where moving one box to one goal costs its precomputed push distance.
// Rooms hold at most 4 boxes, so a subset DP over goal assignments is cheap;
// for a whole-level fallback with many boxes it degrades to the sum of each
// box's own nearest-goal distance, which is still admissible. Returns
// Infinity when some box cannot reach any goal it could take.
// ---------------------------------------------------------------------------
function matchingHeuristic(boxes, goals, distByGoal) {
  const n = boxes.length;
  const nGoals = goals.length;
  const cost = [];
  for (let i = 0; i < n; i++) {
    const row = [];
    for (let j = 0; j < nGoals; j++) {
      const d = distByGoal.get(goals[j])[boxes[i]];
      row.push(d < 0 ? Infinity : d);
    }
    cost.push(row);
  }
  if (n > 10) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const m = Math.min(...cost[i]);
      if (m === Infinity) return Infinity;
      sum += m;
    }
    return sum;
  }
  // dp[mask] = cheapest cost of putting the boxes selected by mask onto
  // distinct goals, considering the goals one at a time (a goal may be left
  // unused, so levels with more goals than boxes are handled too).
  let dp = new Array(1 << n).fill(Infinity);
  dp[0] = 0;
  for (let j = 0; j < nGoals; j++) {
    const next = [...dp]; // goal j stays unused
    for (let mask = 0; mask < dp.length; mask++) {
      if (dp[mask] === Infinity) continue;
      for (let i = 0; i < n; i++) {
        if (mask & (1 << i)) continue;
        const c = cost[i][j];
        if (c === Infinity) continue;
        const nm = mask | (1 << i);
        if (dp[mask] + c < next[nm]) next[nm] = dp[mask] + c;
      }
    }
    dp = next;
  }
  return dp[(1 << n) - 1];
}

// ---------------------------------------------------------------------------
// The player's reachable region: flood fill over the squares the player may
// occupy, with boxes as obstacles. Returns the region mask and its canonical
// representative (smallest square index), which names the region in a state.
// ---------------------------------------------------------------------------
function playerRegion(level, playerMask, boxSet, from) {
  const { w, h, size } = level;
  const region = new Uint8Array(size);
  let rep = from;
  const stack = [from];
  region[from] = 1;
  while (stack.length > 0) {
    const c = stack.pop();
    if (c < rep) rep = c;
    const cx = c % w;
    const cy = (c / w) | 0;
    for (const { dx, dy } of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const n = ny * w + nx;
      if (region[n] || !playerMask[n] || boxSet.has(n)) continue;
      region[n] = 1;
      stack.push(n);
    }
  }
  return { region, rep };
}

// ---------------------------------------------------------------------------
// Freeze deadlock: a 2x2 block of only walls and boxes can never move again.
// If such a block holds a box that is not on a goal, the state is dead. Only
// the four blocks around the square a box just moved to can newly freeze.
// ---------------------------------------------------------------------------
function freezesDeadBox(level, boxSet, target) {
  const { w, h, wall, goal } = level;
  const tx = target % w;
  const ty = (target / w) | 0;
  for (let oy = -1; oy <= 0; oy++) {
    for (let ox = -1; ox <= 0; ox++) {
      const x0 = tx + ox;
      const y0 = ty + oy;
      if (x0 < 0 || y0 < 0 || x0 + 1 >= w || y0 + 1 >= h) continue;
      let solid = true;
      let deadBox = false;
      for (let dy = 0; dy <= 1 && solid; dy++) {
        for (let dx = 0; dx <= 1; dx++) {
          const i = (y0 + dy) * w + (x0 + dx);
          if (boxSet.has(i)) {
            if (!goal[i]) deadBox = true;
          } else if (!wall[i]) {
            solid = false;
            break;
          }
        }
      }
      if (solid && deadBox) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Push-level A* over one region (a room, or the whole level as a fallback).
// A state is the sorted box squares plus the canonical representative of the
// player's reachable region; an edge is one push. With weight 1 the search is
// exact (the matching heuristic is admissible); a larger weight trades
// optimality for speed as a fallback. Expansion budgets are node counts, so
// the search is fully deterministic. Returns the push list
// [{ from, to, dir }] or null when no solution is found within budget.
// ---------------------------------------------------------------------------
function searchRegion(level, region0, ctx, weight, budget) {
  const { w, goal, live, distByGoal } = ctx;
  const goals = region0.goals;
  const boxMask = region0.boxMask;
  const playerMask = region0.playerMask;

  const startBoxes = [...region0.boxes].sort((a, b) => a - b);
  const startSet = new Set(startBoxes);
  // The player starts wherever the level put them; for a room that is the
  // hallway, which the room's player mask includes.
  const startRegion = playerRegion(level, playerMask, startSet, level.player);
  const h0 = matchingHeuristic(startBoxes, goals, distByGoal);
  if (h0 === Infinity) return null;

  // Binary heap ordered by (f, h, insertion order): fully deterministic.
  const heap = [];
  let counter = 0;
  const before = (a, b) =>
    a.f !== b.f ? a.f < b.f : a.h !== b.h ? a.h < b.h : a.order < b.order;
  const pushHeap = (node) => {
    heap.push(node);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!before(heap[i], heap[p])) break;
      [heap[i], heap[p]] = [heap[p], heap[i]];
      i = p;
    }
  };
  const popHeap = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length > 0) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && before(heap[l], heap[m])) m = l;
        if (r < heap.length && before(heap[r], heap[m])) m = r;
        if (m === i) break;
        [heap[i], heap[m]] = [heap[m], heap[i]];
        i = m;
      }
    }
    return top;
  };

  const best = new Map(); // state key -> fewest pushes known to reach it
  const startNode = {
    boxes: startBoxes,
    rep: startRegion.rep,
    g: 0,
    h: h0,
    f: h0 * weight,
    order: counter++,
    parent: null,
    push: null,
  };
  best.set(startBoxes.join(',') + '|' + startRegion.rep, 0);
  pushHeap(startNode);

  let expansions = 0;
  while (heap.length > 0) {
    const node = popHeap();
    const key = node.boxes.join(',') + '|' + node.rep;
    if (node.g > (best.get(key) ?? Infinity)) continue; // stale heap entry
    if (node.h === 0) {
      // Every box matched a goal at distance 0: the region is solved.
      const pushes = [];
      for (let n = node; n.push !== null; n = n.parent) pushes.push(n.push);
      pushes.reverse();
      return pushes;
    }
    if (expansions >= budget) return null;
    expansions++;
    ctx.expansions++;

    const boxSet = new Set(node.boxes);
    const { region } = playerRegion(level, playerMask, boxSet, node.rep);
    for (let bi = 0; bi < node.boxes.length; bi++) {
      const b = node.boxes[bi];
      const bx = b % w;
      const by = (b / w) | 0;
      for (let di = 0; di < DIRS.length; di++) {
        const { dx, dy } = DIRS[di];
        const sx = bx - dx;
        const sy = by - dy;
        const tx = bx + dx;
        const ty = by + dy;
        if (sx < 0 || sy < 0 || tx < 0 || ty < 0 || sx >= w || sy >= level.h || tx >= w || ty >= level.h) continue;
        const stand = sy * w + sx;
        const target = ty * w + tx;
        if (!region[stand]) continue; // the player cannot get behind the box
        if (!boxMask[target] || boxSet.has(target)) continue; // box stays in its region
        if (!live[target]) continue; // dead square: the box could never reach a goal
        const nextBoxes = [...node.boxes];
        nextBoxes[bi] = target;
        nextBoxes.sort((a, b2) => a - b2);
        const nextSet = new Set(nextBoxes);
        if (freezesDeadBox(level, nextSet, target)) continue;
        const h = matchingHeuristic(nextBoxes, goals, distByGoal);
        if (h === Infinity) continue;
        const g = node.g + 1;
        // After the push the player stands on the box's old square.
        const nextRegion = playerRegion(level, playerMask, nextSet, b);
        const nextKey = nextBoxes.join(',') + '|' + nextRegion.rep;
        if (g >= (best.get(nextKey) ?? Infinity)) continue;
        best.set(nextKey, g);
        pushHeap({
          boxes: nextBoxes,
          rep: nextRegion.rep,
          g,
          h,
          f: g + weight * h,
          order: counter++,
          parent: node,
          push: { from: b, to: target, dir: di },
        });
      }
    }
  }
  return null;
}

// Solve one region: exact A* first, weighted A* as a fallback that still
// produces a complete (if not push-optimal) solution.
function solveRegion(level, region0, ctx) {
  const exact = searchRegion(level, region0, ctx, 1, 800000);
  if (exact !== null) return exact;
  return searchRegion(level, region0, ctx, 3, 400000);
}

// ---------------------------------------------------------------------------
// BFS walking path for the player on the live board (boxes are obstacles).
// Returns the move letters, or null when the target cannot be reached.
// ---------------------------------------------------------------------------
function walkPath(level, boxSet, from, to) {
  if (from === to) return '';
  const { w, h, wall, size } = level;
  const prev = new Int32Array(size).fill(-2);
  prev[from] = -1;
  const queue = [from];
  for (let head = 0; head < queue.length; head++) {
    const c = queue[head];
    const cx = c % w;
    const cy = (c / w) | 0;
    for (let di = 0; di < DIRS.length; di++) {
      const { dx, dy } = DIRS[di];
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const n = ny * w + nx;
      if (prev[n] !== -2 || wall[n] || boxSet.has(n)) continue;
      prev[n] = di;
      if (n === to) {
        let out = '';
        for (let cur = to; cur !== from; ) {
          const d = prev[cur];
          out = DIRS[d].ch + out;
          cur = cur - (DIRS[d].dy * w + DIRS[d].dx);
        }
        return out;
      }
      queue.push(n);
    }
  }
  return null;
}

// Replay a move string exactly as the checker does. Returns the push count
// when every move is legal and the final position is solved, else -1.
function replay(level, moves) {
  const { w, wall, goal } = level;
  const boxSet = new Set(level.boxes);
  let player = level.player;
  let pushes = 0;
  for (const ch of moves) {
    const d = DIRS.find((dd) => dd.ch === ch);
    const step = d.dy * w + d.dx;
    const next = player + step;
    if (wall[next]) return -1;
    if (boxSet.has(next)) {
      const beyond = next + step;
      if (wall[beyond] || boxSet.has(beyond)) return -1;
      boxSet.delete(next);
      boxSet.add(beyond);
      pushes++;
    }
    player = next;
  }
  for (const b of boxSet) if (!goal[b]) return -1;
  return pushes;
}

// ---------------------------------------------------------------------------
// Stitch the regions' push sequences into one move string on the real board:
// walk the player to each push's stand square, then push. Regions are solved
// independently and their boxes never interact, so any fixed order works.
// The stitched string is verified by a full replay before it is trusted.
// ---------------------------------------------------------------------------
function stitchAndVerify(level, solutions) {
  const boxSet = new Set(level.boxes);
  let player = level.player;
  let out = '';
  for (const pushes of solutions) {
    for (const push of pushes) {
      const { dx, dy, ch } = DIRS[push.dir];
      const stand = push.from - (dy * level.w + dx);
      const walk = walkPath(level, boxSet, player, stand);
      if (walk === null) return null;
      out += walk + ch;
      boxSet.delete(push.from);
      boxSet.add(push.to);
      player = push.from;
    }
  }
  if (replay(level, out) < 0) return null;
  return out;
}

function solveLevel(text) {
  const level = parseLevel(text);
  if (level.player < 0) return '';
  if (level.boxes.every((b) => level.goal[b])) return ''; // already solved
  const ctx = {
    w: level.w,
    live: computeLiveSquares(level),
    distByGoal: computePushDistances(level),
    expansions: 0,
  };
  // Preferred route: hallway + rooms decomposition.
  const rooms = decompose(level);
  if (rooms !== null) {
    const solutions = [];
    let ok = true;
    for (const room of rooms) {
      const pushes = solveRegion(level, room, ctx);
      if (pushes === null) {
        ok = false;
        break;
      }
      solutions.push(pushes);
    }
    if (ok) {
      const moves = stitchAndVerify(level, solutions);
      if (moves !== null) return moves;
      // Insurance: a finished room can narrow the hallway (a box resting on
      // a goal by the door). Retrying in reverse order routes the player
      // past the still-empty rooms first.
      const reversed = stitchAndVerify(level, [...solutions].reverse());
      if (reversed !== null) return reversed;
    }
  }
  // Fallback: treat the whole level as one region.
  const whole = {
    boxes: level.boxes,
    goals: level.goals,
    boxMask: new Uint8Array(level.size).fill(1),
    playerMask: new Uint8Array(level.size).fill(1),
  };
  for (let i = 0; i < level.size; i++) {
    if (level.wall[i]) {
      whole.boxMask[i] = 0;
      whole.playerMask[i] = 0;
    }
  }
  const pushes = solveRegion(level, whole, ctx);
  if (pushes !== null) {
    const moves = stitchAndVerify(level, [pushes]);
    if (moves !== null) return moves;
  }
  return ''; // no verified solution found: an empty answer is valid, worth 0
}

// ---------------------------------------------------------------------------
// Entry point: solve every instance directory, in sorted order.
// ---------------------------------------------------------------------------
for (const id of readdirSync(INPUT_DIR).sort()) {
  const moves = solveLevel(readFileSync(join(INPUT_DIR, id, 'level.txt'), 'utf8'));
  mkdirSync(join(OUTPUT_DIR, id), { recursive: true });
  writeFileSync(join(OUTPUT_DIR, id, 'solution.txt'), `${moves}\n`);
}
