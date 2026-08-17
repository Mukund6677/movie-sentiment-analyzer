CREATE TABLE `analysis_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerOpenId` varchar(64) NOT NULL DEFAULT 'anonymous',
	`datasetName` varchar(255) NOT NULL,
	`totalReviews` int NOT NULL,
	`accuracy` double NOT NULL,
	`macroF1` double NOT NULL,
	`positiveCount` int NOT NULL DEFAULT 0,
	`neutralCount` int NOT NULL DEFAULT 0,
	`negativeCount` int NOT NULL DEFAULT 0,
	`matrixJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `analysis_history_id` PRIMARY KEY(`id`)
);
