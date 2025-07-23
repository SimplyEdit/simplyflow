# Introduction

SimplyFlow is a collection of components intenden to be used with SimplyView[https://github.com/simplyedit/simplyview/]
, but they can also be used standalone. SimplyFlow is experimental and, once vetted
will be integrated into SimplyView.

## Install


```shell
npm install simplyflow
```

or using GIT

```shell
git clone https://github.com/SimplyEdit/simplyflow.git
```

## Usage

Import the functions you need like this:
```javascript
	import {signal, effect, batch} from 'simplyflow/src/state.mjs'
	import {bind} from 'simplyflow/src/bind.mjs'
	import {model, paging, sort, filter, columns} from 'simplyflow/src/model.mjs'

	let mySignal = signal({value:1})
	bind({
		root: mySignal
	})
	let myModel = model({
		data: mySignal
	})
```

Or include the entire set of code from a cdn like this:
```
<script src="https://cdn.jsdelivr.net/npm/simplyflow/dist/simply.flow.js"></script>
```

In the latter case you can access the functions like this:
```javascript
	let mySignal = simply.state.signal({value: 1})
	simply.bind({
		root: mySignal
	})
	let myModel = simply.flow.model({
		data: mySignal
	})
```

Read more about the bundled libraries here:
- [simply.bind](docs/simply.bind.md)
- [simply.flow](docs/simply.flow.md)
- [simply.state](docs/simply.state.md)

Or check the [examples](examples/) for more information.

## License

[MIT](LICENSE) &copy; Muze.nl

## Contributions

Contributions are welcome, but make sure that all code is MIT licensed. If you want to send a merge request, please make sure that there is a ticket that shows the bug/feature and reference it. If you find any problem, please do file a ticket, but you should not expect a timely resolution. This project is still very experimental, don't use it in production unless you are ready to fix problems yourself.
