require(`dotenv`).config();
const { TwitterApi } = require(`twitter-api-v2`)
const { AtpAgent } = require ('@atproto/api');


const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

const agent = new AtpAgent({ service: 'https://bsky.social' });
agent.login({
    identifier: process.env.BLUESKY_IDENTIFIER,
    password: process.env.BLUESKY_APP_PASSWORD,
}).then(() => {
    console.log(`âœ… [BLUESKY] Logged in as ${process.env.BLUESKY_IDENTIFIER}`);
}).catch((err) => {
    console.error(`âŒ [BLUESKY] Login failed: ${err.message}`);
});

class TwitterService {
    static async postWhale (names, formattedValue, killId){
        try {
            const status = `ðŸ’¥BOOM! ${names.shipName} destroyed! || ${formattedValue} ISK || https://zkillboard.com/kill/${killId}/ || #TweetFleet #EveOnline #SocketKill || https://socketkill.com/`;
            await twitterClient.v2.tweet(status);
            console.log(`Tweet posted for Kill #${killId}`);
        } catch (err) {
            console.error("Twitter/X API Error:", err.message);
        }
    }
    }


class BlueSkyService {
    static async postWhale (names, formattedValue, killId) {
        try {
        const status = `ðŸ’¥BOOM! ${names.shipName} destroyed! || ${formattedValue} ISK || https://zkillboard.com/kill/${killId}/ || #TweetFleet #EveOnline #SocketKill || https://socketkill.com/`;
        await agent.post({ text: status})
        console.log(`Bluesky post made for Kill #${killId}`);
    } catch (err) {
        console.error ("Bluesky API Error:", err.message);
    }
    }
}    
module.exports = { TwitterService, BlueSkyService};