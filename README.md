# Sokoban Solver

[![make.fun entry](https://make.fun/badge/sokoban-solver-01-run-20261121.svg)](https://make.fun/bounty/sokoban-solver-01-run-20261121)
[![rank](https://make.fun/badge/sokoban-solver-01-run-20261121/0xvand/sokoban-solver/rank.svg)](https://make.fun/bounty/sokoban-solver-01-run-20261121)
[![reward](https://make.fun/badge/sokoban-solver-01-run-20261121/0xvand/sokoban-solver/reward.svg)](https://make.fun/bounty/sokoban-solver-01-run-20261121)

A push-optimal Sokoban solver in a single dependency-free `main.ts`
(Node 22, standard library only). Run it with:

```
MAKEFUN_INPUT_DIR=<dir with i001..i005/level.txt> MAKEFUN_OUTPUT_DIR=<out> node main.ts
```

It writes `<out>/<id>/solution.txt` for every instance: the player's moves
as `u`/`d`/`l`/`r` letters.

## Approach

The levels have a rigid generated structure — one horizontal hallway where
the player starts, and one to four small rooms (3–4 boxes each) that open
onto the hallway through a single door. A box pushed out of its room could
never come back, so each box stays in its room and the level's push optimum
is exactly the sum of the rooms' push optima.

1. **Decompose.** The hallway is the player's row (open floor across the
   whole board). The connected components of the remaining floor are the
   rooms; the hallway squares touching a component are its doors.
2. **Solve each room exactly** with push-level A*:
   - states are the sorted box squares plus the canonical representative of
     the player's reachable region;
   - the heuristic is a minimum-cost matching of boxes to goals over
     precomputed push distances (BFS on the push graph), which is
     admissible, so the first solution found is push-optimal;
   - pushes onto dead squares (reverse pull-reachability from the goals)
     and pushes that freeze a box in a solid 2×2 block are pruned, and a
     transposition table keeps the best known cost per state;
   - the search is budgeted by expanded-node counts only — never by the
     clock — so runs are deterministic and byte-identical. A weighted-A*
     pass stands by as a fallback that still returns a complete solution.
3. **Stitch and verify.** The rooms' push sequences are concatenated in a
   fixed order, with BFS walking paths moving the player between pushes.
   The full move string is replayed in-process; only a verified, fully
   legal, solved replay is ever written out.

## License

MIT — see `LICENSE`.
