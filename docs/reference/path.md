# Path module

```js
import path from './src/path.mjs'
```

The path module works with dotted object paths such as `person.name` or `contacts.0.id`.

## `path.get(dataset, pointer)`

Returns the value at `pointer`.

```js
path.get(data, 'person.name')
```

If `pointer` is not a string, it is returned unchanged. If `pointer` is an empty string, the full dataset is returned. Missing path parts return `null`.

Falsy values such as `0`, `false`, and `''` are returned normally.

## `path.set(dataset, pointer, value)`

Sets a value at `pointer`.

```js
path.set(data, 'person.name', 'Ada')
```

Throws when the parent path does not exist:

```text
simplyflow/path: cannot set "person.name" because its parent path does not exist
```

## `path.pop(pointer)`

Returns the last path segment.

```js
path.pop('person.name') // 'name'
```

## `path.push(pointer, name)`

Appends a path segment.

```js
path.push('person', 'name') // 'person.name'
```

## `path.parent(pointer)`

Returns the parent path.

```js
path.parent('person.name') // 'person'
```

## `path.parents(dataset, pointer)`

Returns parent paths from root to the direct parent.

```js
path.parents(data, 'a.b.c') // ['', 'a', 'a.b']
```
