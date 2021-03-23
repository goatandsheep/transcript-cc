(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.TranscriptExporter = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
const webvtt = require('node-webvtt')
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
    console.log('output', output)

    return webvtt.compile({valid: true, cues: output})

}

module.exports = TranscriptExporter

},{"node-webvtt":2}],2:[function(require,module,exports){
'use strict';

const parse = require('./lib/parser').parse;
const compile = require('./lib/compiler').compile;
const segment = require('./lib/segmenter').segment;
const hls = require('./lib/hls');

module.exports = { parse, compile, segment, hls };

},{"./lib/compiler":3,"./lib/hls":4,"./lib/parser":5,"./lib/segmenter":6}],3:[function(require,module,exports){
'use strict';

/**
 * See spec: https://www.w3.org/TR/webvtt1/#file-structure
 */

function CompilerError (message, error) {
  this.message = message;
  this.error = error;
}

CompilerError.prototype = Object.create(Error.prototype);

function compile (input) {

  if (!input) {
    throw new CompilerError('Input must be non-null');
  }

  if (typeof input !== 'object') {
    throw new CompilerError('Input must be an object');
  }

  if (Array.isArray(input)) {
    throw new CompilerError('Input cannot be array');
  }

  if (!input.valid) {
    throw new CompilerError('Input must be valid');
  }

  let output = 'WEBVTT\n';

  if (input.meta) {
    if (typeof input.meta !== 'object' || Array.isArray(input.meta)) {
      throw new CompilerError('Metadata must be an object');
    }

    Object.entries(input.meta).forEach((i) => {
      if (typeof i[1] !== 'string') {
        throw new CompilerError(`Metadata value for "${i[0]}" must be string`);
      }

      output += `${i[0]}: ${i[1]}\n`;
    });
  }

  let lastTime = null;

  input.cues.forEach((cue, index) => {
    if (lastTime && lastTime > cue.start) {
      throw new CompilerError(`Cue number ${index} is not in chronological`
        + ' order');
    }

    lastTime = cue.start;

    output += '\n';
    output += compileCue(cue);
    output += '\n';
  });

  return output;
}

/**
 * Compile a single cue block.
 *
 * @param {array} cue Array of content for the cue
 *
 * @returns {object} cue Cue object with start, end, text and styles.
 *                       Null if it's a note
 */
function compileCue (cue) {
  // TODO: check for malformed JSON
  if (typeof cue !== 'object') {
    throw new CompilerError('Cue malformed: not of type object');
  }

  if (typeof cue.identifier !== 'string' &&
      typeof cue.identifier !== 'number' &&
      cue.identifier !== null) {
    throw new CompilerError(`Cue malformed: identifier value is not a string.
    ${JSON.stringify(cue)}`);
  }

  if (isNaN(cue.start)) {
    throw new CompilerError(`Cue malformed: null start value.
    ${JSON.stringify(cue)}`);
  }

  if (isNaN(cue.end)) {
    throw new CompilerError(`Cue malformed: null end value.
    ${JSON.stringify(cue)}`);
  }

  if (cue.start >= cue.end) {
    throw new CompilerError(`Cue malformed: start timestamp greater than end
    ${JSON.stringify(cue)}`);
  }

  if (typeof cue.text !== 'string') {
    throw new CompilerError(`Cue malformed: null text value.
    ${JSON.stringify(cue)}`);
  }

  if (typeof cue.styles !== 'string') {
    throw new CompilerError(`Cue malformed: null styles value.
    ${JSON.stringify(cue)}`);
  }

  let output = '';

  if (cue.identifier.length > 0) {
    output += `${cue.identifier}\n`;
  }

  const startTimestamp = convertTimestamp(cue.start);
  const endTimestamp = convertTimestamp(cue.end);

  output += `${startTimestamp} --> ${endTimestamp}`;
  output += cue.styles ? ` ${cue.styles}` : '';
  output += `\n${cue.text}`;

  return output;
}

function convertTimestamp (time) {
  const hours = pad(calculateHours(time), 2);
  const minutes = pad(calculateMinutes(time), 2);
  const seconds = pad(calculateSeconds(time), 2);
  const milliseconds = pad(calculateMs(time), 3);
  return `${hours}:${minutes}:${seconds}.${milliseconds}`;
}

function pad (num, zeroes) {
  let output = `${num}`;

  while (output.length < zeroes) {
    output = `0${ output }`;
  }

  return output;
}

function calculateHours (time) {
  return Math.floor(time / 60 / 60);
}

function calculateMinutes (time) {
  return (Math.floor(time / 60) % 60);
}

function calculateSeconds (time) {
  return Math.floor((time) % 60);
}

function calculateMs (time) {
  return Math.floor((time % 1).toFixed(4) * 1000);
}

module.exports = { CompilerError, compile };

},{}],4:[function(require,module,exports){
'use strict';

const segment = require('./segmenter').segment;

function hlsSegment (input, segmentLength, startOffset) {

  if (typeof startOffset === 'undefined') {
    startOffset = '900000';
  }

  const segments = segment(input, segmentLength);

  const result = [];
  segments.forEach((seg, i) => {

    const content = `WEBVTT
X-TIMESTAMP-MAP=MPEGTS:${startOffset},LOCAL:00:00:00.000

${printableCues(seg.cues)}
`;
    const filename = generateSegmentFilename(i);
    result.push({ filename, content });
  });
  return result;
}

function hlsSegmentPlaylist (input, segmentLength) {

  const segmented = segment(input, segmentLength);

  const printable = printableSegments(segmented);
  const longestSegment = Math.round(findLongestSegment(segmented));

  const template = `#EXTM3U
#EXT-X-TARGETDURATION:${longestSegment}
#EXT-X-VERSION:3
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-PLAYLIST-TYPE:VOD
${printable}
#EXT-X-ENDLIST
`;
  return template;
}

function pad (num, n) {
  const padding = '0'.repeat(Math.max(0, n - num.toString().length));

  return `${padding}${num}`;
}

function generateSegmentFilename (index) {
  return `${index}.vtt`;
}

function printableSegments (segments) {
  const result = [];
  segments.forEach((seg, i) => {
    result.push(`#EXTINF:${seg.duration.toFixed(5)},
${generateSegmentFilename(i)}`);
  });

  return result.join('\n');
}

function findLongestSegment (segments) {
  let max = 0;
  segments.forEach((seg) => {
    if (seg.duration > max) {
      max = seg.duration;
    }
  });

  return max;
}

function printableCues (cues) {
  const result = [];
  cues.forEach((cue) => {
    result.push(printableCue(cue));
  });

  return result.join('\n\n');
}

function printableCue (cue) {
  const printable = [];

  if (cue.identifier) {
    printable.push(cue.identifier);
  }

  const start = printableTimestamp(cue.start);
  const end = printableTimestamp(cue.end);

  const styles = cue.styles ? `${cue.styles}` : '';

  // always add a space after end timestamp, otherwise JWPlayer will not
  // handle cues correctly
  printable.push(`${start} --> ${end} ${styles}`);

  printable.push(cue.text);

  return printable.join('\n');
}

function printableTimestamp (timestamp) {
  const ms = (timestamp % 1).toFixed(3);
  timestamp = Math.round(timestamp - ms);
  const hours = Math.floor(timestamp / 3600);
  const mins = Math.floor((timestamp - (hours * 3600)) / 60);
  const secs = timestamp - (hours * 3600) - (mins * 60);

  // TODO hours aren't required by spec, but we include them, should be config
  const hourString = `${pad(hours, 2)}:`;
  return `${hourString}${pad(mins, 2)}:${pad(secs, 2)}.${pad(ms * 1000, 3)}`;
}

module.exports = { hlsSegment, hlsSegmentPlaylist };

},{"./segmenter":6}],5:[function(require,module,exports){
'use strict';

/**
 * See spec: https://www.w3.org/TR/webvtt1/#file-structure
 */

function ParserError (message, error) {
  this.message = message;
  this.error = error;
}

ParserError.prototype = Object.create(Error.prototype);

const TIMESTAMP_REGEXP = /([0-9]{1,2})?:?([0-9]{2}):([0-9]{2}\.[0-9]{2,3})/;

function parse (input, options) {
  if (!options) {
    options = {};
  }

  const { meta = false, strict = true } = options;

  if (typeof input !== 'string') {
    throw new ParserError('Input must be a string');
  }

  input = input.trim();
  input = input.replace(/\r\n/g, '\n');
  input = input.replace(/\r/g, '\n');

  const parts = input.split('\n\n');
  const header = parts.shift();

  if (!header.startsWith('WEBVTT')) {
    throw new ParserError('Must start with "WEBVTT"');
  }

  const headerParts = header.split('\n');

  const headerComments = headerParts[0].replace('WEBVTT', '');

  if (headerComments.length > 0
      && (headerComments[0] !== ' ' && headerComments[0] !== '\t')
  ) {
    throw new ParserError('Header comment must start with space or tab');
  }

  // nothing of interests, return early
  if (parts.length === 0 && headerParts.length === 1) {
    return { valid: true, strict, cues: [], errors: [] };
  }

  if (!meta && headerParts.length > 1 && headerParts[1] !== '') {
    throw new ParserError('Missing blank line after signature');
  }

  const { cues, errors } = parseCues(parts, strict);

  if (strict && errors.length > 0) {
    throw errors[0];
  }

  const headerMeta = meta ? parseMeta(headerParts) : null;

  const result = { valid: errors.length === 0, strict, cues, errors };

  if (meta) {
    result.meta = headerMeta;
  }

  return result;
}

function parseMeta (headerParts) {
  const meta = {};
  headerParts.slice(1).forEach(header => {
    const splitIdx = header.indexOf(':');
    const key = header.slice(0, splitIdx).trim();
    const value = header.slice(splitIdx + 1).trim();
    meta[key] = value;
  });
  return Object.keys(meta).length > 0 ? meta : null;
}

function parseCues (cues, strict) {
  const errors = [];

  const parsedCues = cues
    .map((cue, i) => {
      try {
        return parseCue(cue, i, strict);
      } catch (e) {
        errors.push(e);
        return null;
      }
    })
    .filter(Boolean);

  return {
    cues: parsedCues,
    errors
  };
}

/**
 * Parse a single cue block.
 *
 * @param {array} cue Array of content for the cue
 * @param {number} i Index of cue in array
 *
 * @returns {object} cue Cue object with start, end, text and styles.
 *                       Null if it's a note
 */
function parseCue (cue, i, strict) {
  let identifier = '';
  let start = 0;
  let end = 0.01;
  let text = '';
  let styles = '';

  // split and remove empty lines
  const lines = cue.split('\n').filter(Boolean);

  if (lines.length > 0 && lines[0].trim().startsWith('NOTE')) {
    return null;
  }

  if (lines.length === 1 && !lines[0].includes('-->')) {
    throw new ParserError(`Cue identifier cannot be standalone (cue #${i})`);
  }

  if (lines.length > 1 &&
      !(lines[0].includes('-->') || lines[1].includes('-->'))) {
    const msg = `Cue identifier needs to be followed by timestamp (cue #${i})`;
    throw new ParserError(msg);
  }

  if (lines.length > 1 && lines[1].includes('-->')) {
    identifier = lines.shift();
  }

  const times = typeof lines[0] === 'string' && lines[0].split(' --> ');

  if (times.length !== 2 ||
      !validTimestamp(times[0]) ||
      !validTimestamp(times[1])) {

    throw new ParserError(`Invalid cue timestamp (cue #${i})`);
  }

  start = parseTimestamp(times[0]);
  end = parseTimestamp(times[1]);

  if (strict) {
    if (start > end) {
      throw new ParserError(`Start timestamp greater than end (cue #${i})`);
    }

    if (end <= start) {
      throw new ParserError(`End must be greater than start (cue #${i})`);
    }
  }

  if (!strict && end < start) {
    throw new ParserError(
      `End must be greater or equal to start when not strict (cue #${i})`
    );
  }

  // TODO better style validation
  styles = times[1].replace(TIMESTAMP_REGEXP, '').trim();

  lines.shift();

  text = lines.join('\n');

  if (!text) {
    return false;
  }

  return { identifier, start, end, text, styles };
}

function validTimestamp (timestamp) {
  return TIMESTAMP_REGEXP.test(timestamp);
}

function parseTimestamp (timestamp) {
  const matches = timestamp.match(TIMESTAMP_REGEXP);
  let secs = parseFloat(matches[1] || 0) * 60 * 60; // hours
  secs += parseFloat(matches[2]) * 60; // mins
  secs += parseFloat(matches[3]);
  // secs += parseFloat(matches[4]);
  return secs;
}

module.exports = { ParserError, parse };

},{}],6:[function(require,module,exports){
'use strict';

const parse = require('./parser').parse;

function segment (input, segmentLength) {
  segmentLength = segmentLength || 10;

  const parsed = parse(input);
  const segments = [];

  let cues = [];
  let queuedCue = null;
  let currentSegmentDuration = 0;
  let totalSegmentsDuration = 0;

  /**
   * One pass segmenting of cues
   */
  parsed.cues.forEach((cue, i) => {
    const firstCue = i === 0;
    const lastCue = i === parsed.cues.length - 1;
    const start = cue.start;
    const end = cue.end;
    const nextStart = lastCue ? Infinity : parsed.cues[i + 1].start;
    const cueLength = firstCue ? end : end - start;
    const silence = firstCue ? 0 : (start - parsed.cues[i - 1].end);

    currentSegmentDuration = currentSegmentDuration + cueLength + silence;

    debug('------------');
    debug(`Cue #${i}, segment #${segments.length + 1}`);
    debug(`Start ${start}`);
    debug(`End ${end}`);
    debug(`Length ${cueLength}`);
    debug(`Total segment duration = ${totalSegmentsDuration}`);
    debug(`Current segment duration = ${currentSegmentDuration}`);
    debug(`Start of next = ${nextStart}`);

    // if there's a boundary cue queued, push and clear queue
    if (queuedCue) {
      cues.push(queuedCue);
      currentSegmentDuration += queuedCue.end - totalSegmentsDuration;
      queuedCue = null;
    }

    cues.push(cue);

    // if a cue passes a segment boundary, it appears in both
    let shouldQueue = nextStart - end < segmentLength &&
                        silence < segmentLength &&
                        currentSegmentDuration > segmentLength;

    if (shouldSegment(totalSegmentsDuration, segmentLength, nextStart,
      silence)) {

      const duration = segmentDuration(lastCue, end, segmentLength,
        currentSegmentDuration,
        totalSegmentsDuration);

      segments.push({ duration, cues });

      totalSegmentsDuration += duration;
      currentSegmentDuration = 0;
      cues = [];
    } else {
      shouldQueue = false;
    }

    if (shouldQueue) {
      queuedCue = cue;
    }
  });

  return segments;
}

function shouldSegment (total, length, nextStart, silence) {

  // this is stupid, but gets one case fixed...
  const x = alignToSegmentLength(silence, length);
  const nextCueIsInNextSegment = silence <= length ||
                                 x + total < nextStart;

  return nextCueIsInNextSegment && nextStart - total >= length;
}

function segmentDuration (lastCue, end, length, currentSegment, totalSegments) {
  let duration = length;

  if (currentSegment > length) {
    duration = alignToSegmentLength(currentSegment - length, length);
  }

  // make sure the last cue covers the whole time of the cues
  if (lastCue) {
    duration = parseFloat((end - totalSegments).toFixed(2));
  } else {
    duration = Math.round(duration);
  }

  return duration;
}

function alignToSegmentLength (n, segmentLength) {
  n += segmentLength - n % segmentLength;
  return n;
}

const debugging = false;

/* istanbul ignore next */
function debug (m) {
  if (debugging) {
    console.log(m);
  }
}

module.exports = { segment };

},{"./parser":5}]},{},[1])(1)
});
