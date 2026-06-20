# Symbols module

```js
import { DEP } from './src/symbols.mjs'
```

The symbols module contains shared symbols and dependency keys used internally by the state and binding layers.

## `DEP`

| Key | Description |
| --- | --- |
| `DEP.ITERATE` | Dependency key for object key iteration. |
| `DEP.XRAY` | Symbol used to access the raw target behind a signal. Prefer `state.raw()` in public code. |
| `DEP.SIGNAL` | Symbol used to identify signal proxies. Prefer `state.isSignal()` in public code. |
| `DEP.TEMPLATE` | Binding metadata: template used for a rendered item. |
| `DEP.VALUE` | Binding metadata: value used for a rendered item. |
| `DEP.LENGTH` | String dependency key for length. |
| `DEP.SIZE` | String dependency key for size. |

## Stability

This module is advanced/internal. Use the higher-level state helpers (`raw()`, `isSignal()`, `createSignal()`) when possible.
