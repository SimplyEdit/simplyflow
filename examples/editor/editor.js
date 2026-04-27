const editor = document.getElementById('editor')
const editorContent = document.getElementById('editorInner')
const highlight = document.getElementById('highlight')
const gutter = document.getElementById('gutter')

const state = simply.state.signal({})
const demo = simply.dom.signal(editorContent)
const warnings = document.getElementById('warnings')
const warningSymbol = '⚠'

/* content and lines signals */
simply.state.effect(() => {
  state.content = demo.value
  state.lines = demo.value.split("\n")
})

/* line gutter */
simply.state.effect(() => {
  updateLines(editor, state.lines.length)
})

function updateLines(container, lines) {
  gutter.innerHTML = Array.from({
    length: lines
  }, (_, i) => i+1).join("\n")
}

/* syntax highlighting */
simply.state.effect(() => {
  highlight.innerHTML = Prism.highlight(state.content, Prism.languages.javascript, 'javascript')
})

/* linting */
let options = {
  browser: true,
  for: true,
  single: true,
  this: true,
  unordered: true,
  white: true,
  devel: true,
  subscript: true,
  globals: ["caches", "indexedDb", "console"]
}
simply.state.effect(() => {
    clearWarnings()
    try {
      result = acorn.parse(state.content)
      console.log(result)
    } catch(err) {
      console.log(err.message, err.loc.line)
      setWarning(err.message, err.loc.line)
    }
})

function clearWarnings() {
  warnings.innerHTML = ''
}

function setWarning(message,line) {
  let warn = document.createElement('abbr')
  warn.innerHTML = warningSymbol
  warn.className = 'editor-warning'
  warn.setAttribute('style', "--line:"+line+";")
  warn.title=message
  warnings.appendChild(warn)
}

/* selection signal */
state.selection = null
editorContent.addEventListener('selectionchange', function(evt) {
  state.selection = {
    start: editorContent.selectionStart,
    end: editorContent.selectionEnd,
    before: editorContent.value.substring(0, editorContent.selectionStart).split("\n"),
    after: editorContent.value.substring(editorContent.selectionEnd).split("\n")
  }
})

/* cursor signal and ui */
state.cursor = {
  line: 1,
  col: 1
}
simply.state.effect(() => {
  if (state.selection?.before) {
    state.cursor = {
      line: state.selection.before.length || 1,
      column: state.selection.before[state.selection.before.length-1].length+1
    }
  }
})

const cursor = document.getElementById('cursor')
simply.state.effect(() => {
  if (state.selection?.start!=state.selection?.end) {
    let lines = ''
    if (state.block) {
      lines = state.block.end - state.block.start
      if (lines===1) {
        lines += ' line, '
      } else {
        lines += ' lines, '
      }
    }
    cursor.innerHTML = lines + (state.selection.end - state.selection.start) + ' characters selected'
  } else {
    cursor.innerHTML = 'Line '+state.cursor.line+', column '+state.cursor.column
  }
})

/* indent/outdent */
simply.state.effect(() => {
  if (state.selection) {
    const lines = {
      start: state.selection?.before.length-1
    }
    lines.end = state.lines.length - state.selection?.after.length
    if (lines.start == lines.end) {
      state.block = null
    } else {
      state.block = lines
    }
  }
})

editorContent.addEventListener('keydown', function(evt) {
    switch(evt.key) {
      case 'Tab':
        if (evt.shiftKey) {
          if (state.block) {
            blockChange(editorContent, state.block.start, state.block.end, outdentCode)
            fireInput(evt)
          }
        } else if (state.block) {
          blockChange(editorContent, state.block.start, state.block.end, indentCode)
          fireInput(evt)
        } else {
          insertTab(editorContent, editorContent.selectionStart, editorContent.selectionEnd)
          fireInput(evt)
        }
        break
      case '/':
        if (evt.ctrlKey) {
          blockChange(editorContent, state.block.start, state.block.end, toggleBlockComments)
          fireInput(evt)
        }
        break
  }
})

function fireInput(evt) {
  evt.preventDefault()
  evt.target.dispatchEvent(new Event('input', { bubbles: true }));
}

function insertTab(textarea, start, end) {
  textarea.value = textarea.value.substring(0, start) + "\t" + textarea.value.substring(end)
  textarea.selectionStart = start + 1
  textarea.selectionEnd = textarea.selectionStart
}

function blockChange(textarea, start, end, fn) {
  const block = state.lines.slice(start, end)
  let outblock, outcount;
  [ outblock, outcount ] = fn(block)
  const selection = { start: state.selection.start, end: state.selection.end}
  textarea.value = state.lines.slice(0, start).concat(outblock).concat(state.lines.slice(end)).join("\n")
  textarea.selectionStart = selection.start
  textarea.selectionEnd = selection.end + outcount
}

function indentCode(block) {
  let count = 0
  const indented = block.map(line => {
    count++ //inserted characters
    return "\t"+line
  })
  return [ indented, count ]
}

function outdentCode(block) {
  let count = 0
  const outdented = block.map(line => {
    if (line[0]==="\t") {
      count-- //removed characters
      return line.substring(1)
    }
    return line
  })
  return [ outdented, count ]
}

function toggleBlockComments(block) {
  if (block[0].substring(0,3)=="//\t") {
    return uncommentBlock(block)
  } else {
    return commentBlock(block)
  }
}

function commentBlock(block) {
  let count = 0
  block = block.map(line => {
    count += 3
    return "//\t" + line
  })
  return [block, count]
}

function uncommentBlock(block) {
  count = 0
  block = block.map(line => {
    if (line.substring(0,3)=="//\t") {
      line = line.substring(3)
      count -= 3
    }
    return line
  })
  return [block, count]
}
