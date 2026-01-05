class utils {

    static formatIsk (rawValue) {
        const value = rawValue || 0;
        if (value >= 1000000000) {
            return `${(value / 1000000000).toFixed(2)}B`;
        }
        return `${(value / 1000000).toFixed(2)}M`;
    }


    static getZkillLink (killId){
        return `https://zkillboard.com/kill/${killId}/`;
    }
}

module.exports = utils;