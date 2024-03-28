CREATE TABLE hrt_history (
	dosage_at TIMESTAMP PRIMARY KEY DEFAULT CURRENT_TIMESTAMP,
	hrt_type TEXT NOT NULL
);

CREATE INDEX hrt_history_hrt_type ON hrt_history(hrt_type);

--------------------------------- NEW VERSION ---------------------------------

CREATE TABLE notified (
	dosage_at TIMESTAMP PRIMARY KEY,
	notified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
