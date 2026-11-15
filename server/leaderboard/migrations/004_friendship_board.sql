-- Immutable casual board for "Плюхик и Чудо-остров".
-- Score: 100 per collected item + 500 per completed task + 1000 celebration bonus (max 4600).
-- Durations are a full journey; the game has no timer and no losing state.
INSERT IGNORE INTO game_lb_boards
(namespace,id,rules_version,direction,min_score,max_score,min_duration_ms,max_duration_ms,`open`)
VALUES
('production','friendship-v1','v1','desc',0,10000,1000,7200000,TRUE);
