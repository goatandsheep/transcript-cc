
/**
 * 
 */
const TranscriptExporter = function(data, timeString) {
    const timeSplit = timeString.split(':')
    const hours = parseInt(timeSplit[0])
    const minutes = parseInt(timeSplit[1])
    const seconds = parseInt(timeSplit[2])
    const time = hours * 3600 + minutes * 60 + seconds
    const wrapSize = 37
    const cueSize = 1 + wrapSize * 2 // newline + 2 lines

    let output = []
    
    const segments = 1
    const segLen = time / segments
    let segCounter = 0

    const words = data.replace(/\n/g, ' ').split(' ')
    let cues = []
    let nextCue = words[0]
    let line1 = true
    // create cues
    for (let j = 1, wordsLen = words.length; j < wordsLen; j++) {
        if (line1) {
            let temp = `${nextCue} ${words[j]}`
            if (temp.length <= wrapSize) {
                nextCue = temp
            } else {
                nextCue = `${nextCue}\n${words[j]}`
                line1 = false
            }
        } else {
            let temp = `${nextCue} ${words[j]}`
            if (temp.length <= cueSize) {
                nextCue = temp
            } else {
                cues.push(nextCue)
                nextCue = words[j]
                line1 = true
            }
        }
    }
    cues.push(nextCue)
    const cuesNum = cues.length
    const cueTime = segLen / cuesNum
    let segCues = []
    for (let cueId = 0; cueId < cuesNum; cueId++) {
        segCues.push({
            text: cues[cueId].trim(),
            start: cueId * cueTime,
            end: (cueId + 1) * cueTime,
            identifier: `${segCounter}`,
            styles: ''
        })
        segCounter++
    }
    output = output.concat(segCues)

    return output

}

module.exports = TranscriptExporter