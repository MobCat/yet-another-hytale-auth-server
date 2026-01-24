<?php
//https://sentry.hytale.com/api/2/envelope/
// I really REALLY dont want your telemtery data. like at all. its to much.
// But to make this service function the same as it does for the real game.
// we need to do a loopback that reads "event_id": and sends it back as a responce.

header('Content-Type: application/json');
$method = $_SERVER['REQUEST_METHOD'];

// we would use these if we where doing anything with this data. which we are not.
// $sentryAuth = $_SERVER['HTTP_X_SENTRY_AUTH'];
// $encoding = $_SERVER['HTTP_CONTENT_ENCODING'];
// $postLenth = $_SERVER['CONTENT_LENGTH'];

if ($method === 'POST') {
	$postData = file_get_contents('php://input');
	$gziped = gzdecode($postData);

	$lines = explode("\n", trim($gziped));
	// We get 3 seprate lines of json data. we have to just pick on.
	// We should be doing some checks on which one, but that requires looking at said data. which is what I dont wanna do.
	$json = json_decode(trim($lines[0]), true);

	// Get our event id, dump evreything else into the void.
    $eventID = $json['event_id'];
    unset($postData);
    unset($gziped);
    unset($lines);
    unset($json);

    echo json_encode(['id' => $eventID]);
}
?>