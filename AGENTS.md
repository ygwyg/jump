# Jump — AI Agent Reference

> Machine-readable API reference for AI coding agents.
> Clone from https://github.com/ygwyg/jump — not yet on npm.

## Core Concept

Jump uses **intent strings** — plain English descriptions of animations. An AI should use these instead of raw keyframes whenever possible.

```ts
import { jump } from "./src/index.js"

jump(element, "fade in")                    // intent string
jump(element, "fade in slide up")           // compound intent
jump(element, { opacity: 0, x: 100 })      // property object
jump(element, [{ scale: 0 }, { scale: 1 }]) // keyframe array
```

## All Valid Intent Strings

### Entrances (default easing: ease-out-cubic)
- `"fade in"` — opacity 0→1
- `"enter"` — opacity 0→1 + scale 0.95→1
- `"enter from top"` — opacity 0→1 + translateY from above
- `"enter from bottom"` — opacity 0→1 + translateY from below
- `"enter from left"` — opacity 0→1 + translateX from left
- `"enter from right"` — opacity 0→1 + translateX from right
- `"slide up"` — translateY from below to rest
- `"slide down"` — translateY from above to rest
- `"slide left"` — translateX from right to rest
- `"slide right"` — translateX from left to rest
- `"grow"` — scale 0→1 + opacity 0→1

### Exits (default easing: ease-in-cubic)
- `"fade out"` — opacity 1→0
- `"exit"` — opacity 1→0 + scale 1→0.95
- `"exit top"` — opacity 1→0 + translateY upward
- `"exit bottom"` — opacity 1→0 + translateY downward
- `"exit left"` — opacity 1→0 + translateX left
- `"exit right"` — opacity 1→0 + translateX right
- `"shrink"` — scale 1→0 + opacity 1→0

### Emphasis (default easing: spring)
- `"emphasize"` — scale pulse 1→1.06→1
- `"pulse"` — opacity pulse 1→0.4→1
- `"shake"` — horizontal shake
- `"bounce"` — vertical bounce
- `"wiggle"` — rotational wiggle
- `"pop"` — scale overshoot 1→1.18→0.94→1

### Transform
- `"scale up"` — scale 1→1.2
- `"scale down"` — scale 1→0.8
- `"flip x"` — rotateX 0→180 (with perspective)
- `"flip y"` — rotateY 0→180 (with perspective)
- `"rotate"` — rotate 0→360

### Compound Intents
Combine two intents with a space:
- `"fade in slide up"` — both animations merged
- `"fade out exit bottom"` — both animations merged

## jump() — Main Function

```ts
jump(target, animation, options?): JumpControls
```

**target**: `Element | Element[] | NodeList | string (CSS selector) | React ref`
**animation**: intent string | property object | keyframe array
**options**:
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| duration | number | 300 | Milliseconds |
| delay | number | 0 | Milliseconds |
| easing | EasingPreset \| cubic-bezier() \| linear() | auto | Auto-selected by intent type |
| stagger | number \| StaggerFn | 0 | Delay between elements in ms, or stagger() function |
| distance | number | 20 | Pixels for slide/enter/exit |
| iterations | number | 1 | Use Infinity for looping |
| composite | "replace" \| "add" \| "accumulate" | "replace" | How to composite with existing animations |
| onUpdate | (progress: number) => void | — | Called every frame with 0–1 progress |

**Returns `JumpControls`**:
- `.play()` / `.pause()` / `.reverse()` / `.cancel()` / `.finish()`
- `.seek(0-1)` / `.speed(rate)`
- `.finished` — Promise
- `.animations` — raw WAAPI Animation[]

## jump.to() — Re-targeting

```ts
jump.to(target, { x: 100, y: 50 }, options?)
```
Animates from current position to target. Calls `commitStyles()` + cancel before starting — no snap on interrupt. Use for mouse-follow, drag, continuous updates.

## jump.from() — Animate In

```ts
jump.from(target, { opacity: 0, y: 40 }, options?)
```
Animates from provided values to element's current CSS state.

## jump.sequence() / jump.parallel()

```ts
jump.sequence([
  [el1, "fade in", { duration: 300 }],
  [el2, "slide up"],
  [el3, "pop"],
], { overlap: 80 })

jump.parallel([
  [el1, "fade in"],
  [el2, "slide up"],
])
```

## Springs

```ts
import { springs, createSpring } from "./src/index.js"

// Presets (getters, not function calls)
jump(el, "enter", springs.bouncy)   // { easing: "linear(...)", duration: 941 }
jump(el, "enter", springs.gentle)   // soft overshoot, 1298ms
jump(el, "enter", springs.default)  // slight overshoot, 891ms
jump(el, "enter", springs.stiff)    // near-instant, 489ms
jump(el, "enter", springs.slow)     // dramatic, 2540ms
jump(el, "enter", springs.wobbly)   // lots of oscillation, 2274ms

// Custom
const s = createSpring({ stiffness: 200, damping: 18, mass: 1 })
jump(el, "enter", s)
```

## Stagger

```ts
import { stagger } from "./src/index.js"

// Flat
jump(".card", "enter from bottom", { stagger: 50 })

// From center
jump(".dot", "pop", { stagger: stagger(40, { from: "center" }) })

// Eased
jump(".item", "fade in", { stagger: stagger(60, { ease: "ease-in-out" }) })

// Grid ripple
jump(".cell", "fade in", { stagger: stagger(30, { grid: [8, 6], gridFrom: "center" }) })
```

## Gestures

```ts
// Hover (touch-safe)
jump.hover(el, {
  onEnter: (el) => {
    jump.to(el, { scale: 1.05 }, springs.gentle)
    return () => jump.to(el, { scale: 1 }, springs.gentle)
  }
})

// Press (keyboard accessible)
jump.press(el, {
  onPress: (el) => {
    jump.to(el, { scale: 0.95 }, springs.stiff)
    return () => jump.to(el, { scale: 1 }, springs.stiff)
  }
})

// Drag (momentum, bounds, snap)
const drag = jump.drag(el, {
  axis: "x",
  bounds: { left: -200, right: 200 },
  snap: { x: [0, 100, 200] },
  momentum: true,
  onDragEnd: (state) => console.log(state.x, state.velocityX),
})
drag.stop()   // cleanup
drag.reset()  // spring back to origin
drag.moveTo(100, 0) // programmatic move
```

## Layout / FLIP

```ts
// Auto-watch: element animates when layout changes
const stop = jump.layout(el)

// Manual FLIP
const snap = jump.capture(el)
toggleClass(el)
jump.flip(el, snap, { style: "spring" }) // "spring"|"bouncy"|"snappy"|"smooth"|"slow"

// Shared element transition
jump.snapshot(thumb, "hero")
showModal()
jump.shared(heroEl, "hero")
```

## Text Animation

```ts
// Reveal words from center with stagger
jump.text(heading, "reveal by word")
jump.text(heading, "reveal by char", { stagger: 20 })
jump.text(heading, "reveal by line")

// Typewriter effect
jump.text(el, "typewriter", { typeSpeed: 30 })

// Scramble/decode effect
jump.text(el, "scramble", { duration: 600 })
```

## SVG Drawing

```ts
// Draw a stroke (line drawing effect)
jump.svg.drawIn(svgPath)                    // draw 0% → 100%
jump.svg.drawOut(svgPath)                   // erase 100% → 0%
jump.svg.draw(svgPath, 0.2, 0.8)           // partial draw
jump.svg.prepare(svgPath)                   // set up dasharray manually
```

## Non-DOM Animation (Counters, Canvas, WebGL)

```ts
// Animate a plain JS object
const counter = { value: 0 }
jump.animate(counter, { value: 1000 }, {
  duration: 800,
  easing: "ease-out-cubic",
  onUpdate: (c) => el.textContent = Math.round(c.value).toLocaleString(),
})
```

## Scroll Progress

```ts
// Element progress (0 entering → 1 exiting viewport)
const p = jump.scrollProgress(section)
p.onChange(v => hero.style.transform = `translateY(${v * -40}px)`)

// Page-level progress bar
const page = jump.scrollProgress()
page.onChange(v => bar.style.width = v * 100 + '%')
p.stop() // cleanup
```

## Scroll-Driven

```ts
// One-shot on viewport enter
jump.scroll(el, "fade in slide up")

// Scrub with scroll position
jump.scroll(el, { y: [-40, 0] }, { sync: true })

// Custom trigger
jump.scroll(el, "fade in", { enter: "top 80%", exit: "top 20%" })
```

## React

```tsx
import { useJump, Animate, Presence, Layout, LayoutGroup, useDrag, Reorder } from "./src/react/index.js"

// Hook
const { ref } = useJump("fade in slide up")
const { ref, animate } = useJump("pop", { trigger: "manual" })
const { ref } = useJump("enter from bottom", { trigger: "visible" })

// Components
<Animate animation="fade in slide up"><div>...</div></Animate>
<Animate animation="enter from bottom" trigger="visible"><Card /></Animate>

<Presence show={isOpen} enter="fade in slide up" exit="fade out">
  <Dialog />
</Presence>
<Presence show={isOpen} initial={false}> {/* skip enter on first render */}

<Layout><div className={expanded ? "big" : "small"} /></Layout>
<Layout sharedId="card-42"><img src={thumb} /></Layout>
<Layout style="bouncy"><div>...</div></Layout>
<LayoutGroup><Accordion /><Accordion /></LayoutGroup>

// Drag hook
const { ref } = useDrag({ axis: "x", bounds: { left: -200, right: 200 } })
const { ref, moveTo, reset } = useDrag({ snap: { x: [0, 100, 200] } })

// Reorder list
<Reorder values={items} onReorder={setItems} axis="y">
  {items.map(item => (
    <Reorder.Item key={item} value={item}>
      <div>{item}</div>
    </Reorder.Item>
  ))}
</Reorder>
```

## Easing Presets

`linear`, `ease`, `ease-in`, `ease-out`, `ease-in-out`,
`ease-in-quad`, `ease-out-quad`, `ease-in-out-quad`,
`ease-in-cubic`, `ease-out-cubic`, `ease-in-out-cubic`,
`ease-in-quart`, `ease-out-quart`, `ease-in-out-quart`,
`ease-in-expo`, `ease-out-expo`, `ease-in-out-expo`,
`ease-in-circ`, `ease-out-circ`, `ease-in-out-circ`,
`ease-in-back`, `ease-out-back`, `ease-in-out-back`,
`spring`, `spring-gentle`, `spring-bouncy`, `spring-stiff`

## Accessibility

All animations respect `prefers-reduced-motion: reduce` by default.
Set `{ respectMotionPreference: false }` to override.
`JumpControls.finish()` jumps to end state instantly — use for skip buttons.

## Bundle

- Core: ~11.8KB gzipped (all features, tree-shakeable)
- React: ~13KB gzipped (includes core)
- Zero dependencies
