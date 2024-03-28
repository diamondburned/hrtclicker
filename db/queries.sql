-- name: DosageHistory :many
SELECT * FROM hrt_history WHERE hrt_type = ? ORDER BY dosage_at DESC;

-- name: LastDose :one
SELECT * FROM hrt_history WHERE hrt_type = ? ORDER BY dosage_at DESC LIMIT 1;

-- name: RecordDosage :exec
INSERT INTO hrt_history (hrt_type) VALUES (?);

-- name: DeleteLastDose :exec
DELETE FROM hrt_history WHERE dosage_at = (SELECT dosage_at FROM hrt_history WHERE hrt_history.hrt_type = ? ORDER BY dosage_at DESC LIMIT 1);

-- name: MarkNotified :exec
INSERT INTO notified (dosage_at) VALUES (?);
