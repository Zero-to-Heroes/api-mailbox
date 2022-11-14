export interface MailboxMessagesInfo {
	readonly lastUpdateDate: Date;
	readonly messages: readonly MailboxMessage[];
}

export interface MailboxMessage {
	readonly id: string;
	readonly date: Date;
	readonly text: string;
	readonly categories: readonly MailboxMessageCategory[];
	readonly links?: readonly string[];
	readonly imageUrls?: readonly string[];
}

export enum MailboxMessageCategory {
	GENERAL = 'general',
	REPLAYS = 'replays',
	DUELS = 'duels',
	ARENA = 'arena',
	CONSTRUCTED = 'decktracker',
	BATTLEGROUNDS = 'battlegrounds',
	MERCENARIES = 'mercenaries',
}
