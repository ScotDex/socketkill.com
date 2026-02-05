require(`dotenv`).config();
const { TwitterApi } = require(`twitter-api-v2`)

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
            const status = `💥BOOM! ${names.shipName} destroyed! || ${formattedValue} ISK || https://zkillboard.com/kill/${killId}/ || #TweetFleet #EveOnline #SocketKill || https://socketkill.com/`;
            await twitterClient.v2.tweet(status);
            console.log(`Tweet posted for Kill #${killId}`);
        } catch (err) {
            console.error("Twitter/X API Error:", err.message);
        }
    }
    }
module.exports = TwitterService;