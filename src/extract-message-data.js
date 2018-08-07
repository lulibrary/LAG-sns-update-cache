const extractMessageData = (event) => {
  try {
    return JSON.parse(event.Records[0].Sns.Message)
  } catch (e) {
    console.log(e)
    throw new Error('Could not parse SNS message')
  }
}

module.exports = extractMessageData
