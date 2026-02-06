<?php
//https://account-data.hytale.com/my-account/game-profile
require_once "../../utils/valadate.php";
require_once "../../utils/get.php";

// Connect to SQLite database
$dbPath = "../../auth.db";
$pdo = new PDO("sqlite:$dbPath");
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

// Valadate client, get session id and account data.
// Othwise do all our utlis script things up here first
$clientVer = valadateClient($pdo);
[$sessionID, $UserInfo] = valadateRequestHeadders($pdo);
[$clientUUID, $clientUsername, $clientEntitlements, $sessionStart, $sessionEnd, $scope] = valadateAuthorization($pdo);
$serverConfig = getServerConfigs($pdo);

// Set headers to accept JSON
header('Content-Type: application/json');

// Get the request method
$method = $_SERVER['REQUEST_METHOD'];

// Get all request headers using PHP's built-in function
$headers = getallheaders();

// Handle GET request
if ($method === 'GET') {
    // Get skin / avatar data for player
    $activeSkin = getActiveSkin($pdo, $clientUUID, $serverConfig);
    //Remove user UUIDs from skin result as its not needed here, its added lator.
	unset($activeSkin['ownerId']);
    unset($activeSkin['skinId']);
    unset($activeSkin['isActive']);

    //TODO: I feel like we should valdate any data was loaded, let alone the cornect data
    //but probs over thinking it, we put the data in the database, so it SHOULD be good to read it.

    // Send response
    echo json_encode([
        'createdAt' => $sessionStart,
        'entitlements' => json_decode($clientEntitlements),
        'nextNameChangeAt' => $sessionEnd,
        'skin' => json_encode($activeSkin),
        'username' => $clientUsername,
        'uuid' => $clientUUID
    ]);

    die();
} else {
    echo json_encode(['Warning' => 'Unknown request']);
}

?>