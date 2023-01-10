/* eslint-disable @typescript-eslint/camelcase */
//Import package
import { SecretsManager } from 'aws-sdk';
import { GetSecretValueRequest, GetSecretValueResponse } from 'aws-sdk/clients/secretsmanager';
import { Tweetv2SearchParams, TwitterApi } from 'twitter-api-v2';

const secretsManager = new SecretsManager({ region: 'us-west-2' });

export const runTwitterQuery = async (query: string, sinceId?: string) => {
	const secret: SecretInfo = await getSecret({ SecretId: 'twitter' });
	const twitterClient = new TwitterApi(secret.bearerToken);
	const readOnlyClient = twitterClient.readOnly.v2;
	const request: Tweetv2SearchParams = {
		query: query,
		sort_order: 'recency',
		'tweet.fields': ['entities', 'created_at', 'referenced_tweets', 'attachments'],
		'media.fields': ['preview_image_url', 'url', 'alt_text'],
	};
	if (!!sinceId) {
		request.since_id = sinceId;
	}
	console.debug('sending request to twitter', request);
	const twitterResposne = await readOnlyClient.search(query, request);
	console.debug('twitter response', twitterResposne);
	return twitterResposne.tweets;
};

const getSecret = (secretRequest: GetSecretValueRequest) => {
	return new Promise<SecretInfo>(resolve => {
		secretsManager.getSecretValue(secretRequest, (err, data: GetSecretValueResponse) => {
			const secretInfo: SecretInfo = data.SecretString === undefined ? null : JSON.parse(data.SecretString);
			resolve(secretInfo);
		});
	});
};

interface SecretInfo {
	readonly apiKey: string;
	readonly apiKeySecret: string;
	readonly bearerToken: string;
}
