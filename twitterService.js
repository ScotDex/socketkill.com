require(`dotenv`).config();
const { TwitterApi } = require(`twitter-api-v2`)

console.log("Checking Keys:", {
    key: process.env.TWITTER_API_KEY ? "Loaded" : "MISSING",
    secret: process.env.TWITTER_API_SECRET ? "Loaded" : "MISSING"
});

// Kick off twitter client

const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});


class TwitterService {
    static async postWhale (names, formattedValue, killId){
        try {
            const status = `🚨 WHALE ALERT 🚨\n\nA ${names.shipName} worth ${formattedValue}ISK was destroyed - View: https://zkillboard.com/kill/${killId}/ \n\n#EveOnline`;
            await twitterClient.v2.tweet(status);
            console.log(`Tweet posted for Kill #${killId}`);
        } catch (err) {
            console.error("Twitter/X API Error:", err.message);
        }
    }
    }
module.exports = TwitterService;