<?php
//https://sessions.hytale.com/game-session
//This is more or less a guess at what this api does.
//as we just send off a DELETE request at the end of a session, and get nothing back.
require_once "../utils/valadate.php";

// Connect to SQLite database
$dbPath = "../auth.db";
$pdo = new PDO("sqlite:$dbPath");
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

[$sessionID, $UserInfo] = valadateRequestHeadders($pdo);

// Set headers to accept JSON
header('Content-Type: application/json');

// Get the request method
$method = $_SERVER['REQUEST_METHOD'];

// Get the JSON contents
/*
$json = file_get_contents('php://input');

// decode the json data
$data = json_decode($json);
*/

if ($method === 'DELETE') {
    $stmt = $pdo->prepare("UPDATE accounts SET sessionID = :sessionID WHERE uuid = :uuid");
    $stmt->execute([
        ':sessionID' => null,
        ':uuid' => $UserInfo['uuid']
    ]);
    if ($stmt->rowCount() > 0) {
        echo(json_encode([
            'success'=>true, 
            'session_id'=>$sessionID
        ]));
    }
} else {
    echo(json_encode(['ERROR'=>'Unknown POST method']));
}

?>