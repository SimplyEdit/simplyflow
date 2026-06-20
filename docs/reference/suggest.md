# Suggest module

```js
import { closest, editDistance } from './src/suggest.mjs'
```

The suggest module provides small helpers used by developer-friendly warnings, such as unknown app options, commands, actions, routes and behaviors.

## `closest(name, options, settings?)`

Returns the closest option name to `name`, or `undefined` when no useful suggestion exists.

```js
closest('commmands', ['commands', 'actions']) // 'commands'
```

Settings:

| Setting | Default | Description |
| --- | --- | --- |
| `maxDistance` | `2` | Maximum edit distance to accept. |
| `minLength` | `4` | Unknown names shorter than this are ignored. |

Short names such as `api` or `db` are ignored by default to avoid noisy suggestions for common app service properties.

## `editDistance(a, b, maxDistance = 2)`

Returns the Levenshtein edit distance between `a` and `b`.

If the strings are obviously too far apart, it returns `maxDistance + 1` early.

## Stability

This is a support module. It is useful for SimplyFlow extensions, but most applications should not need it directly.
