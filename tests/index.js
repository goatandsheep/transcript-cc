const TranscriptExporter = require('../index')

const data = `
this is learned to have left the start up corporate partnership through camp
that teaches you how to grow your start up through corporate partnerships in a
ten week virtual experience throughout the boot camp you'll get exclusive inside
look at how start ups are working with Comcast NBCUniversal plus other large
fortune five hundred companies and you'll learn the proven practical ways to
find and land your startup's next enterprise partner hello everyone and welcome
to the learn at last to start up corporate partnership boot camp this is an
introduction and your overview to this learn at left program where we'll preview
everything you're going to learn throughout the boot camp and we'll go over what
you want to do to make the most out of your experience throughout these episodes
you'll be hearing from Patrick Riley C. E. O. of our boot camp partner the
global accelerator network or gan and network of a hundred and eighty of the top
independent start up accelerators and startup studios from around the world in
addition to Patrick you'll hear up close interviews with Comcast NBCUniversal
leaders by participating in this program you'll not only get a peek behind the
curtain to what it's like to do business with Comcast NBCUniversal you'll also
be learning the practices that thousands of start ups and corporate teams and
again network have used to build some really powerful collaborations all
condensed into the content you're diving into today so to set the stage for a
time together we want you to know something you are important your job is
important you are start up as a job creator a culture maker and the innovation
engine of our cities and our industries and yet the reality is that your startup
can never and will never operate in a vacuum as a founder or an operator you
need partners you need investment product feedback safe spaces to work and to
grow and you need revenue do you know what's great about corporate partnerships
generating revenue lots of it to create capital that won't dilute you or your
investors it's the path to growing your company and staying in business at the
next investment never comes through and you know what's more you have a lot to
offer large companies your start up can be a path to faster product development
insights on emerging technologies or access to fresh talent and a new
perspective large corporates want to work with start ups like yours and there's
a huge opportunity when you combine the scale of a large corporate with the
speed and tack of your start up this is exactly why the learn at left boot camp
exists and that's why we're here together Comcast NBCUniversal has programs for
entrepreneurs happening all across the country which makes it easy for you to
find the right connections mentors and product experts from across our business
if you didn't already know these programs not only include this experience right
here learn it left but other educational resources live events and accelerator
`

const output = TranscriptExporter(data, '00:11:00')
console.log(output)
