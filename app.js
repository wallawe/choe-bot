require('dotenv').load()
const express = require('express')
const bodyParser = require('body-parser')
const { RTMClient, WebClient } = require('@slack/client')
const ccxt = require('ccxt')
var mailgun = require('mailgun-js')({apiKey: process.env.MAILGUN_KEY, domain: process.env.MAILGUN_DOMAIN })

const VALID_SIGNAL = new RegExp(/Signal [\d]{2,}: [A-Z]{2,6}\/[A-Z]{2,6}/)
const PAIR = new RegExp(/[A-Z]{3,5}\/[A-Z]{3,5}/)
const RISK_LEVELS = ['high', 'medium', 'low']
const inDevelopment = process.env.NODE_ENV === 'development'

let app = express()
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

app.get('/', (req, res) => { res.send('\n 👋 🌍 \n') })

function getShitPoppin() {

  const rtm = new RTMClient(process.env.SLACK_TOKEN)
  rtm.start()

  console.log('*** Realtime connection to Slack started ***')

  let binance = new ccxt.binance ({
    apiKey: process.env.BINANCE_API,
    secret: process.env.BINANCE_SECRET,
  })

  rtm.on('message', async message => {

    const {text} = message

    if (message.type === 'message' && message.channel === process.env.RODERICK_CHANNEL_ID ) {
      const isResult = text.toLowerCase().includes('result')
      const isUpdate = text.toLowerCase().includes('update')

      // make sure it's a roderick signal and not just Eric chiming in with thoughts/opinions
      if (text && VALID_SIGNAL.test(text) && !isResult && !isUpdate) {

        // we can use riskLevel later to determine how much to buy. lower risk == higher amount
        // it will be low, medium, or high
        const riskLevel = RISK_LEVELS.find(level => text.toLowerCase().includes(level))
        if (!riskLevel) {
          return
        }

        // grab the pairing from the string
        let pairing = text.match(PAIR)[0].trim()

        // one off pairing change for NANO bc they changed their name after listing
        if (pairing === 'NANO/BTC') {
          pairing = 'XRB/BTC'
        }

        // Coin we want to buy
        const buy = pairing.split('/')[0]

        // Coin we want to sell
        const sell = pairing.split('/')[1]

        // check for inclusion of a risk level even though we're not using it right now.
        // this is so we don't trigger a purchase when he gives the results of a signal.
        if (text.includes('LONG') && sell === 'BTC') {

          const RISK_AMOUNT = 0.25 // amount of bitcoin to risk on any given trade. we can get more advanced later
          const SLIPPAGE_TOLERANCE = 0.005 // % above last ask we're willing to pay in case another bot beats us

          const recommendedBuyPrice = getBuyPrice(text, pairing)
          const maxBuyPrice = recommendedBuyPrice * (1 + SLIPPAGE_TOLERANCE)
          const buyAmount = RISK_AMOUNT / parseFloat(recommendedBuyPrice)

          if (!inDevelopment) {
            try {
              const purchase = await binance.createLimitBuyOrder(pairing, buyAmount, maxBuyPrice)
              const emailText = `We just purchased ${purchase.amount} ${buy} at a price of ${purchase.price} for a total cost of ${purchase.cost} ${sell}. Looking for 2.5-3% return.`
              sendEmail('Automated Purchase Initiated', emailText)
              console.log('PURCHASE: ', purchase)
            } catch(err) {
              console.log(err)
            }
          }

        } else if (text.includes('SHORT')) {

          console.log('going short here')
          // hook up to kraken!

        }
      } else {
        sendEmail('Update from Eric Choe (non-signal)', text)
      }
    }
  })
}

function sendEmail(subject, text) {
  if (inDevelopment) return // don't actually send emails if testing locally

  var data = {
    from: 'Will Wallace <wallac.will@gmail.com>',
    to: 'wallac.will@gmail.com',
    cc: 'mt2344@gmail.com, cullenawallace@gmail.com',
    subject,
    text
  }

  mailgun.messages().send(data, function (error, body) {
    if (error) {
      return console.log('Error sending email: ', error)
    }

    console.log('Email successfully sent', body)
  })
}

app.listen(process.env.PORT, (err) => {
  if (err) throw err

  if (process.env.SLACK_TOKEN) {
    getShitPoppin()
  }
})

function getBuyPrice(text, pairing) {
  const symbol = '->'
  const first = text.split(symbol)[0]
  return parseFloat(first.split(pairing).pop().trim())
}

// not currently in use
const listChannels = async function() {
  const web = new WebClient(process.env.SLACK_TOKEN)
  const res = await web.channels.list()
  const channels = res.channels.map(ch => `${ch.name}: ${ch.id}`)

  console.log('Here are the channels and their respective IDs: ', channels)
}

// listChannels()
