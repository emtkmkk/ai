type Config = {
	host: string;
	i: string;
	wsUrl: string;
	apiUrl: string;
	keywordEnabled: boolean;
	reversiEnabled: boolean;
	mecabDic?: string;
};

const config = require('../config.json');

config.wsUrl = config.host.replace('http', 'ws');
config.apiUrl = config.host + '/api';

export default config as Config;
