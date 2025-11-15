export function escape_html(context, next) {
    let content = context.value.innerHTML
    if (typeof context.value == 'string') {
        content = context.value
        context.value = { innerHTML: content }
    }
    if (content) {
        content = content.replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
        context.value.innerHTML = content
    }
    next(context)
}

export function fixed_content(context, next) {
    if (typeof context.value == 'string') {
        context.value = {}
    } else {
        delete context.value.innerHTML
    }
    next(context)
}
