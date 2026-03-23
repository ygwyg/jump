# jump

AI-first animation library. Intent-driven, WAAPI-native, zero dependencies.

> **Early release.** Not yet published to npm. Clone the repo to use it.

```sh
git clone https://github.com/ygwyg/jump
```

---

## The idea

Every other animation library was designed for humans reading documentation. Jump was designed for AI generating UI code.

```ts
jump(el, "fade in slide up")         // AI writes this correctly, first try
jump(el, "pop", springs.bouncy)      // real spring physics
jump(".card", "enter from bottom", { stagger: 60 })
```

String literal intents. One consistent function shape. TypeScript types that are enumerable — not open-ended strings. An LLM can hold the entire API in one context window.

---

## Core

```ts
import { jump, springs, createSpring, stagger } from "./src/index.js"

// Intent strings
jump(el, "fade in")
jump(el, "enter from bottom")
jump(el, "fade in slide up")        // compound
jump(el, "pop", springs.bouncy)     // + spring

// Re-target (no snap on interrupt)
jump.to(el, { x: 100, scale: 1.2 }, springs.stiff)

// Animate from explicit start
jump.from(el, { opacity: 0, y: 40 })

// Sequence and parallel
jump.sequence([
  [header, "enter from top"],
  [content, "enter from left"],
  [badge, "pop"],
], { overlap: 80 })

jump.parallel(steps)

// Returns controls
const ctrl = jump(el, "rotate", { iterations: Infinity })
ctrl.pause() · ctrl.seek(0.5) · await ctrl.finished
```

---

## All intent strings

**Entrances** — `fade in` · `enter` · `enter from top` · `enter from bottom` · `enter from left` · `enter from right` · `slide up` · `slide down` · `slide left` · `slide right` · `grow`

**Exits** — `fade out` · `exit` · `exit top` · `exit bottom` · `exit left` · `exit right` · `shrink`

**Emphasis** — `bounce` · `shake` · `wiggle` · `pop` · `emphasize` · `pulse` · `spin` · `flip x` · `flip y` · `rotate` · `wobble` · `jello` · `tada` · `heartbeat` · `flash` · `rubberband`

**Compound** — space-separate any two intents: `"fade in slide up"`, `"fade out exit bottom"`

---

## Springs

Real damped harmonic oscillator physics encoded as CSS `linear()`. Runs on the compositor thread. Genuine overshoot.

```ts
import { springs, createSpring } from "./src/index.js"

// Presets — property getters
jump(el, "enter", springs.bouncy)   // stiffness 300, damping 20
jump(el, "enter", springs.gentle)   // stiffness 120, damping 14
jump(el, "enter", springs.stiff)    // stiffness 500, damping 40
jump(el, "enter", springs.wobbly)   // stiffness 180, damping 8
jump(el, "enter", springs.slow)     // stiffness 60,  damping 15

// Custom
const s = createSpring({ stiffness: 200, damping: 18, mass: 1 })
jump(el, "enter from bottom", s)    // → { easing: "linear(...)", duration: 891 }
```

---

## Stagger

```ts
import { stagger } from "./src/index.js"

jump(".card", "enter from bottom", { stagger: 60 })

// From center
jump(".dot", "pop", { stagger: stagger(40, { from: "center" }) })

// Grid ripple
jump(".cell", "fade in", { stagger: stagger(30, { grid: [8, 4], gridFrom: "center" }) })
```

---

## Gestures

```ts
// Hover — touch-safe, no stuck state on mobile
jump.hover(el, {
  onEnter: el => jump.to(el, { scale: 1.06 }, springs.stiff),
  onLeave: el => jump.to(el, { scale: 1    }, springs.gentle),
})

// Press — keyboard accessible (Enter + Space)
jump.press(el, {
  onPress:   el => jump.to(el, { scale: 0.95 }, springs.stiff),
  onRelease: el => jump.to(el, { scale: 1    }, springs.bouncy),
})

// Drag — momentum, bounds, rubber-band, spring snap
const drag = jump.drag(el, {
  axis: "x",
  bounds: { left: -200, right: 200 },
  snap: { x: [0, 100, 200] },
  momentum: true,
  onDragEnd: state => console.log(state.x, state.velocityX),
})
drag.stop()
drag.reset()
drag.moveTo(100, 0)
```

---

## Layout / FLIP

```ts
// Manual FLIP — capture before, mutate, flip after
const snap = jump.capture(el)
doTheDOMChange()
jump.flip(el, snap, { style: "spring" })   // "spring" | "bouncy" | "snappy" | "smooth" | "slow"

// Auto-watch — animates whenever element layout changes
const stop = jump.layout(el)

// Shared element transition
jump.snapshot(thumb, "hero")
showModal()
jump.shared(heroEl, "hero")
```

---

## SVG

```ts
jump.svg.drawIn(path)                // stroke 0% → 100%
jump.svg.drawOut(path)               // stroke 100% → 0%
jump.svg.draw(path, 0.2, 0.8)       // partial draw
jump.svg.prepare(path)               // set up dasharray manually
```

---

## Scroll

```ts
// One-shot on viewport enter
jump.scroll(el, "fade in slide up")

// Scrub with scroll position
jump.scroll(el, { y: [-40, 0] }, { sync: true })

// Custom trigger window
jump.scroll(el, "fade in", {
  enter: "top 80%",
  exit:  "top 20%",
})

// Reactive progress value
const p = jump.scrollProgress(section)
p.onChange(v => hero.style.opacity = String(1 - v))
p.stop()
```

---

## Text

```ts
jump.text(heading, "reveal by word")
jump.text(heading, "reveal by char", { stagger: 20 })
jump.text(el, "typewriter", { typeSpeed: 30 })
jump.text(el, "scramble", { duration: 600 })
```

---

## Non-DOM / counters

```ts
const counter = { value: 0 }
jump.animate(counter, { value: 1000 }, {
  duration: 800,
  easing: "ease-out-cubic",
  onUpdate: c => el.textContent = Math.round(c.value).toLocaleString(),
})
```

---

## React

```tsx
import {
  useJump, Animate, Presence,
  Layout, LayoutGroup, useLayout,
  useDrag, Reorder,
} from "./src/react/index.js"

// Hook — trigger: mount | visible | manual
const { ref } = useJump("fade in slide up")
const { ref } = useJump("enter from bottom", { trigger: "visible" })
const { ref, animate } = useJump("pop", { trigger: "manual" })

// Components
<Animate animation="enter from bottom" trigger="visible">
  <Card />
</Animate>

<Presence show={isOpen} enter="fade in slide up" exit="fade out">
  <Dialog />
</Presence>

// Layout
<Layout><div className={expanded ? "big" : "small"} /></Layout>
<Layout sharedId="card-42" style="bouncy"><img src={thumb} /></Layout>
<LayoutGroup><Accordion /><Accordion /></LayoutGroup>

// Drag
const { ref } = useDrag({ axis: "x", bounds: { left: -200, right: 200 } })

// Reorder
<Reorder values={items} onReorder={setItems} axis="y">
  {items.map(item => (
    <Reorder.Item key={item} value={item}>
      <div>{item}</div>
    </Reorder.Item>
  ))}
</Reorder>
```

---

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `duration` | `number` | `300` | Milliseconds |
| `delay` | `number` | `0` | Milliseconds |
| `easing` | `EasingPreset \| cubic-bezier() \| linear()` | auto | Auto-selected by intent |
| `stagger` | `number \| StaggerFn` | `0` | Delay between elements |
| `distance` | `number` | `20` | Pixels for slide/enter/exit |
| `iterations` | `number` | `1` | Use `Infinity` for loops |
| `composite` | `"replace" \| "add" \| "accumulate"` | `"replace"` | |
| `onUpdate` | `(progress: number) => void` | — | Per-frame callback |
| `onStart` | `() => void` | — | |
| `onComplete` | `() => void` | — | |
| `respectMotionPreference` | `boolean` | `true` | Respects `prefers-reduced-motion` |

---

## Easing presets

`linear` · `ease` · `ease-in` · `ease-out` · `ease-in-out`
`ease-in-cubic` · `ease-out-cubic` · `ease-in-out-cubic`
`ease-in-quart` · `ease-out-quart` · `ease-in-out-quart`
`ease-in-expo` · `ease-out-expo` · `ease-in-out-expo`
`ease-out-back` · `ease-in-out-back`
`spring` · `spring-gentle` · `spring-bouncy` · `spring-stiff`

---

## Bundle

| Entry | Size |
|-------|------|
| `jump` | ~12KB gzip |
| `jump/react` | ~13KB gzip |

Zero runtime dependencies. Tree-shakeable. SSR-safe.

---

## AGENTS.md

The `AGENTS.md` file in this repo is a machine-readable API reference for AI coding agents. When an LLM reads it, it has everything needed to generate correct Jump animations without hallucinating APIs or guessing intent names.

---

MIT
