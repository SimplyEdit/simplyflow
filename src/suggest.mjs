/**
 * Return the closest valid option name to a possibly misspelled name.
 *
 * Used for developer-friendly typo suggestions. Short unknown names such as
 * `api` or `db` are ignored by default because they are common app extension
 * properties and edit-distance suggestions are noisy for short strings.
 *
 * @param {string} name The unknown name to compare.
 * @param {Iterable<string>} options Valid option names to compare against.
 * @param {object} [settings] Optional matching settings.
 * @param {number} [settings.maxDistance=2] Maximum edit distance to accept.
 * @param {number} [settings.minLength=4] Minimum unknown-name length to check.
 * @returns {string|undefined} The closest option, or undefined when no useful suggestion exists.
 */
export function closest(name, options, { maxDistance = 2, minLength = 4 } = {})
{
    if (name.length < minLength) {
        return
    }

    let result
    let resultDistance = Infinity
    for (const option of options) {
        const distance = editDistance(name, option, maxDistance)
        if (distance < resultDistance) {
            result = option
            resultDistance = distance
        }
    }
    return resultDistance <= maxDistance ? result : undefined
}

/**
 * Return the edit distance between two short strings.
 *
 * This is used only for friendly typo suggestions in developer warnings, so it
 * intentionally caps large length differences early instead of doing extra work.
 *
 * @param {string} a First string to compare.
 * @param {string} b Second string to compare.
 * @param {number} [maxDistance=2] Maximum useful distance for the caller.
 * @returns {number} The Levenshtein edit distance, or maxDistance + 1 when the strings are too far apart.
 */
export function editDistance(a, b, maxDistance = 2)
{
    const tooFar = maxDistance + 1
    if (Math.abs(a.length - b.length) > maxDistance) {
        return tooFar
    }

    const previous = Array.from({ length: b.length + 1 }, (_, index) => index)
    const current = new Array(b.length + 1)

    for (let ai = 1; ai <= a.length; ai++) {
        current[0] = ai
        for (let bi = 1; bi <= b.length; bi++) {
            const cost = a[ai - 1] === b[bi - 1] ? 0 : 1
            current[bi] = Math.min(
                previous[bi] + 1,
                current[bi - 1] + 1,
                previous[bi - 1] + cost
            )
        }
        previous.splice(0, previous.length, ...current)
    }

    return previous[b.length]
}
