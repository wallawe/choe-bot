const { RTMClient, WebClient } = require('@slack/client')

const TOKEN = 'xoxp-310635658535-368680301281-370449133009-7f733849197596c5636d28047e2f73f4'
const GENERAL_CHANNEL_ID = 'C93H12QMQ'
const RODERICK_CHANNEL_ID = 'C94CQRQSJ'
const SIGNAL_REGEX = new RegExp(/Signal [\d]{2,}: [A-Z]{2,6}\/[A-Z]{2,6}/)
const RISK_LEVELS = ['HIGH', 'MEDIUM', 'LOW']

const rtm = new RTMClient(TOKEN)

rtm.start()

console.log('*** Realtime connection to slack started ***')

rtm.on('message', (message) => {

  console.log(message)
  const {text} = message

  // For structure of `event`, see https://api.slack.com/events/message
  if (message.type === 'message' && message.channel === RODERICK_CHANNEL_ID ) {
    console.log('message object: ', message)
    console.log(text)

    // make sure it's a roderick signal and not just Eric chiming in with thoughts/opinions
    if (text && SIGNAL_REGEX.test(text)) {

      // we can use riskLevel later to determine how much to buy. lower risk == higher amount
      // it will be low, medium, or high
      const riskLevel = RISK_LEVELS.find(level => text.includes(level))

      // check for inclusion of a risk level even though we're not using it right now.
      // this is so we don't trigger a purchase when he gives the results of a signal.
      if (text.includes('LONG') && !!riskLevel) {
        console.log('going long here')
        // go long
      } else if (text.includes('SHORT') && !!riskLevel) {
        console.log('going short here')
        // short
      }
    }
  }
})

// not currently in use
const listChannels = async function() {
  const web = new WebClient(TOKEN)
  const res = await web.channels.list()
  const channels = res.channels.map(ch => `${ch.name}: ${ch.id}`)

  console.log('Here are the channels and their respective IDs: ', channels)
}
