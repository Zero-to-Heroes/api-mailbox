/* eslint-disable @typescript-eslint/no-use-before-define */
import { logBeforeTimeout, S3 } from '@firestone-hs/aws-lambda-utils';
import { Context } from 'aws-lambda';
import { TweetV2 } from 'twitter-api-v2';
import { gzipSync } from 'zlib';
import { MailboxMessage, MailboxMessageCategory, MailboxMessagesInfo } from './model';
import { runTwitterQuery } from './twitter';

export const BUCKET = 'static.zerotoheroes.com';
export const FILE_KEY = `api/mailbox/mailbox.gz.json`;

export const s3 = new S3();

// This example demonstrates a NodeJS 8.10 async handler[1], however of course you could use
// the more traditional callback-style handler.
// [1]: https://aws.amazon.com/blogs/compute/node-js-8-10-runtime-now-available-in-aws-lambda/
export default async (event, context: Context): Promise<any> => {
	const cleanup = logBeforeTimeout(context);
	const existingMessages = await getExistingMessages();
	const lastMessageId = extractLastMessageId(existingMessages);
	const newTweets = await runTwitterQuery(`from:ZerotoHeroes_HS #mailbox`, lastMessageId);
	const newMessages = buildNewMessages(newTweets);
	const allMessages = appendNewMessage(existingMessages, newMessages);
	const trimmedMessages = trimMessages(allMessages);
	await saveNewMessages(trimmedMessages);
	cleanup();
	return { statusCode: 200, body: null };
};

const getExistingMessages = async (): Promise<readonly MailboxMessage[]> => {
	const messagesStr = await s3.readGzipContent(BUCKET, FILE_KEY);
	if (!messagesStr?.length) {
		return [];
	}
	const info: MailboxMessagesInfo = JSON.parse(messagesStr);
	return (info?.messages ?? []).map(msg => ({
		...msg,
		date: new Date(msg.date),
	}));
};

const extractLastMessageId = (messages: readonly MailboxMessage[]): string => {
	return [...messages].sort((a, b) => b.date.getTime() - a.date.getTime()).pop()?.id;
};

const buildNewMessages = (tweets: readonly TweetV2[]): readonly MailboxMessage[] => {
	return (tweets ?? []).map(tweet => buildNewMessage(tweet));
};

const buildNewMessage = (tweet: TweetV2): MailboxMessage => {
	console.debug('parsing tweet', JSON.stringify(tweet));

	const categories = tweet.entities.hashtags
		.map(tag => MailboxMessageCategory[tag.tag?.toUpperCase()])
		.filter(cat => !!cat);
	console.debug('categories', categories, tweet);
	let finalText = tweet.text;
	for (const tag of tweet.entities.hashtags) {
		finalText = finalText.replace(new RegExp(`#${tag.tag}`, 'gm'), '');
	}
	finalText = finalText.replace(/[ ]{2,}/gm, ' ');

	const links = tweet.entities?.urls?.flatMap(url => url.url);
	for (const link of links) {
		finalText = finalText.replace(link, '');
	}

	finalText = finalText.trim();
	return {
		id: tweet.id,
		date: new Date(tweet.created_at),
		text: finalText,
		categories: categories,
		links: links,
	};
};

const appendNewMessage = (
	messages: readonly MailboxMessage[],
	newMessages: readonly MailboxMessage[],
): readonly MailboxMessage[] => {
	const messagesToAppend = (newMessages ?? []).filter(m => !messages.some(existing => existing.id === m.id));
	return [...(messages ?? []), ...messagesToAppend];
};

const trimMessages = (messages: readonly MailboxMessage[]): readonly MailboxMessage[] => {
	return [...messages].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 20);
};

const saveNewMessages = async (messages: readonly MailboxMessage[]): Promise<void> => {
	const result: MailboxMessagesInfo = {
		lastUpdateDate: new Date(),
		messages: messages,
	};
	await s3.writeFile(gzipSync(JSON.stringify(result)), BUCKET, FILE_KEY, 'application/json', 'gzip');
};
